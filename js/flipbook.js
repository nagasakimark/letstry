// A real page-turning book. Two-page spreads on wide screens, single pages on
// narrow ones. Turn by tapping the arrows, swiping/dragging a page corner, or
// with the arrow keys. Optional narration per page ("Read aloud").
import { h, icon, preload } from "./ui.js";
import { playAudio, stopAudio } from "./media.js";
import { t } from "./i18n.js";

export function flipbook({ title, pages, aspect, startPage = 0, onPage }) {
  // pages: [{img, audio?}]
  const hasAudio = pages.some(p => p.audio);
  const st = { spread: true, view: 0, busy: false, readAloud: hasAudio };
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
  const views = () => st.spread ? Math.floor(pages.length / 2) + 1 : pages.length;
  const sides = v => st.spread ? [v === 0 ? -1 : 2 * v - 1, 2 * v] : [-1, v];
  function fill(el, i) { el.replaceChildren(...[pageImg(i)].filter(Boolean)); el.classList.toggle("blank", !(i >= 0 && i < pages.length)); }

  function layout() {
    const cw = stageWrap.clientWidth - 112, ch = stageWrap.clientHeight - 16;
    if (cw <= 0 || ch <= 0) return;
    const singleH = Math.min(ch, cw / aspect), spreadH = Math.min(ch, cw / (2 * aspect));
    const want = spreadH >= singleH * 0.62;
    if (want !== st.spread) {
      const firstPage = Math.max(0, sides(st.view)[1] === -1 ? sides(st.view)[0] : sides(st.view)[1]);
      st.spread = want;
      st.view = want ? Math.floor((firstPage + 1) / 2) : firstPage;
    }
    spreadEl.classList.toggle("single", !st.spread);
    spreadEl.style.setProperty("--sar", st.spread ? 2 * aspect : aspect);
    spreadEl.style.setProperty("--pw", st.spread ? "50%" : "100%");
    L.style.display = st.spread ? "" : "none";
    draw();
  }
  function draw() {
    const [a, b] = sides(st.view);
    fill(L, a); fill(R, b);
    const n = pages.length;
    const shown = [a, b].filter(i => i >= 0 && i < n).map(i => i + 1);
    label.textContent = (shown.length > 1 ? `${shown[0]}–${shown[1]}` : shown[0] || "") + ` / ${n}`;
    prevBtn.disabled = st.view === 0;
    nextBtn.disabled = st.view >= views() - 1;
    preload([...sides(st.view + 1), ...sides(st.view - 1)].filter(i => i >= 0 && i < n).map(i => pages[i].img));
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
  function turn(dir, leaf = null, fromAngle = null) {
    const target = st.view + dir;
    if (st.busy || target < 0 || target >= views()) { leaf && leaf.remove(); draw(); return; }
    st.busy = true;
    stopAudio();
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
  st.view = startPage ? Math.floor((startPage + 1) / 2) : 0;
  requestAnimationFrame(() => { layout(); if (st.view) { if (!st.spread) st.view = startPage; draw(); } narrate(); });
  return { root, destroy: () => { window.removeEventListener("keydown", key); ro.disconnect(); stopAudio(); } };
}
