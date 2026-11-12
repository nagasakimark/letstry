"""Record the original plip-plop-land unit pages into a data model.

Runs the mirrored original in headless Chrome. For each "screen" (a book page or a
pop-up activity page) it measures every clickable element relative to the screen's
page image, clicks it, and records the resulting effects (media played, screens
opened, elements shown/hidden, images swapped). Output: raw JSON per unit.
"""
import json, sys, os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8765"
OUT = sys.argv[1] if len(sys.argv) > 1 else "tools/raw"
UNITS = sys.argv[2:] or [f"{b}-{u}" for b in (1, 2) for u in range(1, 10)]
os.makedirs(OUT, exist_ok=True)

INSTRUMENT = r"""
window.__muts = [];
window.__obs = new MutationObserver(list => {
  for (const m of list) {
    if (m.type === 'attributes') {
      window.__muts.push({t:'attr', el:m.target, name:m.attributeName, old:m.oldValue});
    } else if (m.type === 'childList') {
      window.__muts.push({t:'child', el:m.target, added:[...m.addedNodes], removed:[...m.removedNodes]});
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
  window.__obs.observe(document.body, {subtree:true, attributes:true, attributeOldValue:true,
     attributeFilter:['class','src','style'], childList:true});
});
HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
HTMLDialogElement.prototype.showModal = function(){ this.setAttribute('open',''); };
"""

JS_LIB = r"""
(() => {
const L = {};
L.path = el => {
  if (el.id) return '#' + el.id;
  const parts = [];
  while (el && el !== document.body) {
    let i = 0, s = el; while ((s = s.previousElementSibling)) i++;
    parts.unshift(el.tagName.toLowerCase() + ':' + i);
    el = el.parentElement;
  }
  return parts.join('>');
};
L.byPath = p => {
  if (p.startsWith('#')) return document.getElementById(p.slice(1));
  let el = document.body;
  for (const part of p.split('>')) { const i = +part.split(':')[1]; el = el.children[i]; if (!el) return null; }
  return el;
};
L.visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  return r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
L.rel = (el, ref) => { const r = el.getBoundingClientRect(), b = ref.getBoundingClientRect();
  return [ (r.left-b.left)/b.width, (r.top-b.top)/b.height, r.width/b.width, r.height/b.height ].map(v=>Math.round(v*10000)/10000); };
L.abs = u => u ? new URL(u, location.href).pathname : u;
L.screens = () => {
  const c = document.querySelector('.unit-container');
  return [...c.children].filter(e => e.matches('.main-image, .page-image, .play-image'));
};
L.screenImg = s => {
  const imgs = [...s.querySelectorAll(':scope > img')];
  return imgs[0] || s.querySelector('img');
};
L.show = s => {
  L.screens().forEach(x => x.classList.add('closed'));
  s.classList.remove('closed');
  const c0 = s.children[0];
  if (c0 && c0.tagName === 'DIV' && /^\s*X\s*$/.test(c0.textContent)) c0.classList.add('back-button');
  document.querySelectorAll('.main-audio-window, .main-video-window').forEach(w => w.classList.add('closed'));
  window.__obs.takeRecords(); window.__muts.length = 0;
};
window.__L = L;
})();
"""


def snapshot_effects(page):
    """Turn recorded mutations into effect descriptors, then revert them."""
    return page.evaluate(r"""(screenPath) => {
      const L = window.__L;
      for (const m of window.__obs.takeRecords()) window.__muts.push(m.type==='attributes'?{t:'attr',el:m.target,name:m.attributeName,old:m.oldValue}:{t:'child',el:m.target,added:[...m.addedNodes],removed:[...m.removedNodes]});
      let muts = window.__muts.splice(0);
      // net diff: keep first old value per (el, attr)
      const seen = new Map(), net = [];
      for (const m of muts) { if (m.t !== 'attr') { net.push(m); continue; }
        const k = m.el; if (!seen.has(k)) seen.set(k, {});
        const o = seen.get(k); if (!(m.name in o)) { o[m.name] = m.old; net.push(m); } }
      const reverts = muts; muts = net;
      const ref = L.byPath(screenPath) || null;
      const eff = [];
      for (const m of muts) {
        const el = m.el;
        if (m.t === 'attr') {
          const now = el.getAttribute(m.name);
          if (now === m.old) continue;
          if (m.name === 'src') {
            eff.push({kind:'src', tag:el.tagName.toLowerCase(), cls:el.className, path:L.path(el), src:L.abs(now),
                      rect: ref && L.visible(el) ? L.rel(el, ref) : null});
          } else if (m.name === 'class') {
            const was = (m.old||'').split(/\s+/), is = (now||'').split(/\s+/);
            const added = is.filter(c => c && !was.includes(c)), removed = was.filter(c => c && !is.includes(c));
            eff.push({kind:'class', tag:el.tagName.toLowerCase(), cls:now, id:el.id, path:L.path(el), added, removed,
                      img: el.tagName === 'IMG' ? L.abs(el.getAttribute('src')) : (el.querySelector('img') ? L.abs(el.querySelector('img').getAttribute('src')) : null),
                      rect: ref && L.visible(el) ? L.rel(el, ref) : null});
          } else if (m.name === 'style') {
            eff.push({kind:'style', path:L.path(el), cls:el.className, style:now});
          }
        } else if (m.t === 'child') {
          for (const n of m.added) if (n.nodeType === 1) {
            const imgs = n.tagName === 'IMG' ? [n] : [...n.querySelectorAll('img')];
            eff.push({kind:'added', parent:L.path(el), parentCls:el.className, html:n.outerHTML.slice(0,300),
                      imgs: imgs.map(i => L.abs(i.getAttribute('src'))),
                      rect: ref && L.visible(n) ? L.rel(n, ref) : null,
                      parentRect: ref && L.visible(el) ? L.rel(el, ref) : null});
          }
        }
      }
      // revert attribute changes (reverse order); leave childList changes
      for (const m of reverts.slice().reverse()) {
        if (m.t === 'attr') { if (m.old === null) m.el.removeAttribute(m.name); else m.el.setAttribute(m.name, m.old); }
      }
      window.__muts.length = 0;
      return eff;
    }""", screen_path_holder[0])


screen_path_holder = [None]


def record_unit(page, unit):
    page.goto(f"{BASE}/letstry{unit}", wait_until="networkidle")
    page.evaluate(JS_LIB)
    page.wait_for_timeout(300)
    info = page.evaluate(r"""() => {
      const L = window.__L;
      return { title: document.title,
        screens: L.screens().map(s => ({path: L.path(s), cls: s.className.replace('closed','').trim(), id: s.id})) };
    }""")
    screens = []
    for sc in info["screens"]:
        screen_path_holder[0] = sc["path"]
        page.evaluate("p => { const L = window.__L; L.show(L.byPath(p)); window.__muts.length = 0; }", sc["path"])
        page.wait_for_timeout(150)
        # resize viewport so the screen box has the image's true aspect ratio (no stretching)
        for _ in range(2):
            g = page.evaluate("p => { const L=window.__L, s=L.byPath(p), i=L.screenImg(s); if(!i) return null; const r=s.getBoundingClientRect(); return [r.width, r.height, i.naturalWidth, i.naturalHeight]; }", sc["path"])
            if not g or not g[3] or not g[1]:
                break
            want = g[2] / g[3]
            vw = page.viewport_size["width"]
            nw = max(600, min(4000, round(vw * want / (g[0] / g[1]))))
            if abs(nw - vw) <= 2:
                break
            page.set_viewport_size({"width": nw, "height": 1000})
            page.wait_for_timeout(150)
        meta = page.evaluate(r"""(p) => {
          const L = window.__L, s = L.byPath(p), img = L.screenImg(s);
          if (!img) return null;
          const hs = []; const ref = s;
          for (const el of s.querySelectorAll('*')) {
            if (el === img || !L.visible(el)) continue;
            const cs = getComputedStyle(el);
            const isClose = /^\s*X\s*$/.test(el.textContent) && el.parentElement === s;
            const clickable = cs.cursor === 'pointer' || el.tagName === 'A' || isClose ||
                 /(button|audio|video|answer|card)/.test(el.className);
            if (!clickable) continue;
            // skip descendants of an already-counted clickable
            if (hs.some(h => L.byPath(h.path).contains(el) && L.byPath(h.path) !== el)) continue;
            hs.push({path: L.path(el), tag: el.tagName.toLowerCase(), id: el.id, cls: el.className,
                     text: el.textContent.trim().slice(0, 40), href: el.getAttribute('href'),
                     data: {...el.dataset}, rect: L.rel(el, ref), isClose,
                     innerImg: el.querySelector('img') ? L.abs(el.querySelector('img').getAttribute('src')) : null});
          }
          // non-clickable visual layers (videos, answer displays etc.)
          const layers = [];
          for (const el of s.querySelectorAll('video, audio, img, canvas')) {
            if (el === img) continue;
            layers.push({path: L.path(el), tag: el.tagName.toLowerCase(), cls: el.className, id: el.id,
                         src: L.abs(el.getAttribute('src')), visible: L.visible(el),
                         rect: L.visible(el) ? L.rel(el, ref) : null});
          }
          const elements = {};
          for (const el of s.querySelectorAll('*')) {
            if (el === img) continue;
            const hidden = el.classList.contains('closed');
            if (hidden) el.classList.remove('closed');
            // make sure ancestors are visible too
            const anc = []; let a = el.parentElement;
            while (a && a !== s) { if (a.classList.contains('closed')) { a.classList.remove('closed'); anc.push(a); } a = a.parentElement; }
            if (L.visible(el)) {
              const cs = getComputedStyle(el);
              elements[L.path(el)] = {id: el.id, tag: el.tagName.toLowerCase(), cls: el.className.replace('closed','').trim(),
                rect: L.rel(el, ref), hidden, img: el.tagName === 'IMG' ? L.abs(el.getAttribute('src')) : null,
                bg: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : null,
                bgImg: cs.backgroundImage !== 'none' ? cs.backgroundImage : null,
                radius: cs.borderRadius, opacity: cs.opacity, z: cs.zIndex,
                text: el.children.length ? '' : el.textContent.trim().slice(0, 60)};
            }
            anc.forEach(x => x.classList.add('closed'));
            if (hidden) el.classList.add('closed');
          }
          window.__obs.takeRecords();
          const r = img.getBoundingClientRect();
          return {image: L.abs(img.getAttribute('src')), natural: [img.naturalWidth, img.naturalHeight], imgRect: L.rel(img, ref),
                  hotspots: hs, layers, elements};
        }""", sc["path"])
        if not meta:
            continue
        # click each hotspot and capture effects
        for h in meta["hotspots"]:
            if h["isClose"] or h["tag"] == "a":
                h["effects"] = []
                continue
            page.evaluate("p => { const L = window.__L; L.show(L.byPath(p)); window.__muts.length = 0; }", sc["path"])
            try:
                page.evaluate("p => window.__L.byPath(p).click()", h["path"])
            except Exception as e:
                h["error"] = str(e)
            page.wait_for_timeout(120)
            h["effects"] = snapshot_effects(page)
        screens.append({**sc, **meta})
    return {"unit": unit, "title": info["title"], "screens": screens}


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-proxy-server", "--mute-audio"])
        ctx = b.new_context(viewport={"width": 1600, "height": 1000})
        ctx.add_init_script(INSTRUMENT)
        page = ctx.new_page()
        page.on("pageerror", lambda e: None)
        for u in UNITS:
            data = record_unit(page, u)
            with open(f"{OUT}/{u}.json", "w") as f:
                json.dump(data, f, indent=1)
            n = sum(len(s["hotspots"]) for s in data["screens"])
            print(u, len(data["screens"]), "screens", n, "hotspots", flush=True)
        b.close()


if __name__ == "__main__":
    main()
