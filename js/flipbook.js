// A real page-turning book. Two-page spreads on wide screens, single pages on
// narrow ones. Turn by tapping the arrows, swiping/dragging a page corner, or
// with the arrow keys. Optional narration per page ("Read aloud").
import { h, icon, preload } from "./ui.js";
import { playAudio, stopAudio } from "./media.js";
import { t } from "./i18n.js";

export function flipbook({ title, pages, aspect, startPage = 0, onPage }) {
  // pages: [{img, audio?}]
  const hasAudio = pages.some(p => p.audio);
  const st = { spread: true, view: 0, busy: false, readAloud: hasAudio, views: [] };
  const spreadEl = h("div", { class: "spread" });
  const stageWrap = h("div", { class: "stagewrap" }, spreadEl);
  const L = h("div", { class: "pg L" }), R = h("div", { class: "pg R" });
  spreadEl.append(L, R);
  const label = h("span", { class: "count" });
  const prevBtn = h("button", { class: "pill ghost side l", type: "button", "aria-label": t("prev"), onclick: () => turn(-1) }, icon("left"));
  const nextBtn = h("button", { class: "pill ghost side r", type: "button", "aria-label": t("next"), onclick: () => turn(1) }, icon("right"));
  const readBtn = hasAudio ? h("button", { class: "pill ghost", type: "button", "aria-pressed": "true", onclick: () => {
    st.readAloud = !st.readAloud; readBtn.setAttribute("aria-pressed", st.readAloud);
    readBtn.classList.toggle("ghost", !st.readAloud);
    if (st.readAloud) narrate(); else stopAudio();
  } }, icon("speaker"), t("readAloud")) : null;
  if (readBtn) readBtn.classList.remove("ghost");
  const grabL = h("div", { class: "grab l" }), grabR = h("div", { class: "grab r" });
  stageWrap.append(prevBtn, nextBtn, grabL, grabR);
  const root = h("div", { class: "book" },
    h("div", { class: "head" }, h("h2", {}, title)),
    stageWrap,
    h("div", { class: "nav" }, label, readBtn));

  const pageImg = i => (i >= 0 && i < pages.length) ? h("img", { src: pages[i].img, alt: `Page ${i + 1}`, draggable: "false" }) : null;
  // A "view" is what's open at once: a left/right pair of pages, or one page that is itself a
  // two-page picture ({w}) and fills the whole open book.
  function buildViews(spread) {
    const V = [];
    if (!spread) { pages.forEach((p, i) => V.push(p.wide ? { w: i } : { l: -1, r: i })); return V; }
    let i = 0;
    if (pages[0] && !pages[0].wide) { V.push({ l: -1, r: 0 }); i = 1; }   // cover on the right
    while (i < pages.length) {
      if (pages[i].wide) { V.push({ w: i }); i++; continue; }
      if (i + 1 < pages.length && !pages[i + 1].wide) { V.push({ l: i, r: i + 1 }); i += 2; }
      else { V.push({ l: i, r: -1 }); i++; }
    }
    return V;
  }
  st.views = buildViews(true);
  const views = () => st.views.length;
  const isWide = v => st.views[v] && st.views[v].w != null;
  const sides = v => { const x = st.views[v]; return !x ? [-1, -1] : x.w != null ? [-1, x.w] : [x.l, x.r]; };
  const shownPages = v => sides(v).filter(i => i >= 0 && i < pages.length);
  const viewOf = page => Math.max(0, st.views.findIndex(x => x.w === page || x.l === page || x.r === page));
  function fill(el, i) { el.replaceChildren(...[pageImg(i)].filter(Boolean)); el.classList.toggle("blank", !(i >= 0 && i < pages.length)); }

  function layout() {
    const cw = stageWrap.clientWidth - 112, ch = stageWrap.clientHeight - 16;
    if (cw <= 0 || ch <= 0) return;
    const singleH = Math.min(ch, cw / aspect), spreadH = Math.min(ch, cw / (2 * aspect));
    const want = spreadH >= singleH * 0.62;
    if (want !== st.spread) {
      const firstPage = shownPages(st.view)[0] || 0;
      st.spread = want;
      st.views = buildViews(want);
      st.view = viewOf(firstPage);
    }
    draw();
  }
  function draw() {
    const wide = isWide(st.view);
    // a spread page is shown at twice a page's width; a single page alone at one page's width
    spreadEl.classList.toggle("single", !st.spread && !wide);
    spreadEl.classList.toggle("widepage", wide);
    spreadEl.style.setProperty("--sar", st.spread || wide ? 2 * aspect : aspect);
    spreadEl.style.setProperty("--pw", st.spread && !wide ? "50%" : "100%");
    L.style.display = st.spread && !wide ? "" : "none";
    const [a, b] = sides(st.view);
    fill(L, a); fill(R, b);
    const n = pages.length;
    const shown = shownPages(st.view).map(i => i + 1);
    label.textContent = (shown.length > 1 ? `${shown[0]}–${shown[1]}` : shown[0] || "") + ` / ${n}`;
    prevBtn.disabled = st.view === 0;
    nextBtn.disabled = st.view >= views() - 1;
    preload([...shownPages(st.view + 1), ...shownPages(st.view - 1)].map(i => pages[i].img));
    onPage && onPage(shown[0] - 1);
  }
  function narrate() {
    if (!st.readAloud) return;
    const list = sides(st.view).filter(i => i >= 0 && i < pages.length && pages[i].audio);
    let k = 0;
    const next = () => {
      if (k >= list.length || !st.readAloud) return;
      const a = playAudio(pages[list[k++]].audio, null, { showBar: true });
      a.onended = next;
    };
    next();
  }

  // --- the turning leaf
  function makeLeaf(dir) {
    const [a, b] = sides(st.view), [na, nb] = sides(st.view + dir);
    const leaf = h("div", { class: "leaf" });
    const shade = h("div", { class: "shade" });
    let front, back;
    if (st.spread) {
      // forward: lift the right page (front = current right, back = next left), reveal next right
      // backward: bring the previous right page over (front = prev right, back = current left), reveal prev left
      if (dir > 0) { front = b; back = na; fill(R, nb); }
      else { front = nb; back = a; fill(L, na); }
    } else {
      // single page: the leaf flips off to the left (or back in from the left)
      if (dir > 0) { front = b; back = -1; fill(R, nb); }
      else { front = nb; back = -1; fill(R, b); }
    }
    const f = h("div", { class: "face front" }, ...[pageImg(front)].filter(Boolean));
    const bk = h("div", { class: "face back" }, ...[pageImg(back)].filter(Boolean));
    if (back < 0 || back >= pages.length) bk.style.background = st.spread ? "transparent" : "var(--paper)";
    f.append(shade.cloneNode()); bk.append(shade);
    leaf.append(f, bk);
    spreadEl.append(leaf);
    return leaf;
  }
  function setAngle(leaf, deg) {
    leaf.style.transform = `rotateY(${deg}deg)`;
    const t = Math.abs(deg) / 180;
    leaf.querySelectorAll(".shade").forEach(s => s.style.setProperty("--sh", (Math.sin(t * Math.PI) * 0.35).toFixed(3)));
    if (!st.spread) leaf.style.opacity = deg < -150 ? String(1 - (Math.abs(deg) - 150) / 30) : "1";
  }
  function animate(leaf, from, to, ms, done) {
    const t0 = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = now => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setAngle(leaf, from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }
  function slideTurn(dir, target) {
    // to or from a two-page picture: slide the book across instead of lifting a single leaf
    const out = spreadEl.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-dir * 40}px)` }],
      { duration: 170, easing: "ease-in" });
    out.onfinish = () => {
      st.view = target; draw();
      const inn = spreadEl.animate([{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: "none" }],
        { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" });
      inn.onfinish = () => { st.busy = false; narrate(); };
    };
  }
  function turn(dir, leaf = null, fromAngle = null) {
    const target = st.view + dir;
    if (st.busy || target < 0 || target >= views()) { leaf && leaf.remove(); draw(); return; }
    st.busy = true;
    stopAudio();
    if (isWide(st.view) || isWide(target)) { leaf && leaf.remove(); return slideTurn(dir, target); }
    leaf ||= makeLeaf(dir);
    const a0 = fromAngle ?? (dir > 0 ? 0 : -180), a1 = dir > 0 ? -180 : 0;
    animate(leaf, a0, a1, 650 * Math.abs(a1 - a0) / 180 + 120, () => {
      leaf.remove(); st.view = target; st.busy = false; draw(); narrate();
    });
  }

  // drag a corner to turn
  function dragFrom(zone, dir) {
    zone.addEventListener("pointerdown", e => {
      if (st.busy) return;
      const target = st.view + dir;
      if (target < 0 || target >= views()) return;
      zone.setPointerCapture(e.pointerId);
      if (isWide(st.view) || isWide(target)) {   // no leaf to drag: a tap or a swipe turns the page
        const up = ev => { zone.removeEventListener("pointerup", up); const dx = ev.clientX - e.clientX;
          if (Math.abs(dx) < 6 || (dir > 0 ? dx < -30 : dx > 30)) turn(dir); };
        zone.addEventListener("pointerup", up);
        return;
      }
      const leaf = makeLeaf(dir);
      const w = spreadEl.clientWidth / (st.spread ? 2 : 1);
      let ang = dir > 0 ? 0 : -180, moved = false;
      setAngle(leaf, ang);
      const mv = ev => {
        const dx = ev.clientX - e.clientX;
        if (Math.abs(dx) > 4) moved = true;
        const p = Math.max(0, Math.min(1, (dir > 0 ? -dx : dx) / (w * 1.4)));
        ang = dir > 0 ? -180 * p : -180 + 180 * p;
        setAngle(leaf, ang);
      };
      const up = () => {
        zone.removeEventListener("pointermove", mv); zone.removeEventListener("pointerup", up); zone.removeEventListener("pointercancel", up);
        const p = dir > 0 ? -ang / 180 : (ang + 180) / 180;
        if (!moved || p > 0.25) turn(dir, leaf, ang);
        else animate(leaf, ang, dir > 0 ? 0 : -180, 250, () => { leaf.remove(); draw(); });
      };
      zone.addEventListener("pointermove", mv); zone.addEventListener("pointerup", up); zone.addEventListener("pointercancel", up);
    });
  }
  dragFrom(grabR, 1); dragFrom(grabL, -1);

  const key = e => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable='true']")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); turn(1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); turn(-1); }
  };
  window.addEventListener("keydown", key);
  const ro = new ResizeObserver(layout);
  ro.observe(stageWrap);
  st.view = viewOf(startPage);
  requestAnimationFrame(() => { layout(); st.view = viewOf(startPage); draw(); narrate(); });
  return { root, destroy: () => { window.removeEventListener("keydown", key); ro.disconnect(); stopAudio(); } };
}
