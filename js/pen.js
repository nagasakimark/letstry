// Drawing and writing on the page. Works with mouse, touch and stylus.
// Everything is stored relative to the page, so it stays put through resizing,
// zooming, full screen and page turns (each page keeps its own until cleared).
export const COLORS = [
  ["#e53935", "Red"], ["#1e63d6", "Blue"], ["#f7c400", "Yellow"], ["#2e9d47", "Green"],
  ["#f57c00", "Orange"], ["#ec5c9a", "Pink"], ["#7b45c4", "Purple"], ["#222222", "Black"], ["#ffffff", "White"],
];
export const SIZES = [0.004, 0.008, 0.016];
// Text sizes as a fraction of page height, matched to the printed book:
// S = sentence text in the book, M = unit titles, L = readable from the back, XL = one big word
export const TEXT_SIZES = [0.026, 0.048, 0.08, 0.13];

const store = new Map(); // key -> items (strokes and text)
const surfaces = [];
export const pen = {
  on: false, color: COLORS[0][0], size: 1, textSize: 1,
  tool: "pen", // pen | marker | eraser | text
  listeners: new Set(),
};
const emit = () => pen.listeners.forEach(f => f());

export function setPen(patch) {
  Object.assign(pen, patch);
  document.body.classList.toggle("pen-on", pen.on);
  document.body.dataset.tool = pen.on ? pen.tool : "";
  if (!pen.on || pen.tool !== "text") document.activeElement?.closest?.(".tbox")?.blur();
  emit();
}
export const isTyping = e => !!(e.target && e.target.closest && e.target.closest("input, textarea, [contenteditable='true']"));

function items(key) { if (!store.has(key)) store.set(key, []); return store.get(key); }

export function attachInk(sheetEl, key) {
  const cv = document.createElement("canvas");
  cv.className = "ink";
  const layer = document.createElement("div");
  layer.className = "textlayer";
  sheetEl.append(cv, layer);
  const ctx = cv.getContext("2d");
  const surf = { cv, ctx, key, sheetEl };
  surfaces.push(surf);
  const boxes = new Map(); // text item -> element
  const ro = new ResizeObserver(() => resize());
  ro.observe(sheetEl);
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = sheetEl.clientWidth, hgt = sheetEl.clientHeight;
    if (!w) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function drawStroke(s) {
    const w = sheetEl.clientWidth, hgt = sheetEl.clientHeight;
    ctx.save();
    ctx.globalAlpha = s.a;
    ctx.strokeStyle = s.c;
    ctx.lineWidth = Math.max(1.5, s.w * w);
    ctx.lineCap = s.a < 1 ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const p = s.pts;
    ctx.moveTo(p[0][0] * w, p[0][1] * hgt);
    if (p.length === 1) ctx.lineTo(p[0][0] * w + 0.1, p[0][1] * hgt);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2 * w, my = (p[i][1] + p[i + 1][1]) / 2 * hgt;
      ctx.quadraticCurveTo(p[i][0] * w, p[i][1] * hgt, mx, my);
    }
    if (p.length > 1) ctx.lineTo(p[p.length - 1][0] * w, p[p.length - 1][1] * hgt);
    ctx.stroke();
    ctx.restore();
  }
  function redraw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const list = items(key);
    for (const s of list) if (!s.text && s.pts) drawStroke(s);
    renderTexts();
  }
  surf.redraw = redraw;

  // ------------------------------------------------------------ text boxes
  function renderTexts() {
    const list = items(key).filter(i => i.text !== undefined);
    for (const [it, el] of boxes) if (!list.includes(it)) { el.remove(); boxes.delete(it); }
    const H = sheetEl.clientHeight;
    for (const it of list) {
      let el = boxes.get(it);
      if (!el) { el = makeBox(it); boxes.set(it, el); layer.append(el); }
      el.style.left = it.x * 100 + "%";
      el.style.top = it.y * 100 + "%";
      el.style.fontSize = Math.max(8, it.s * H) + "px";
      el.style.color = it.c;
      el.classList.toggle("light", it.c.toLowerCase() === "#ffffff" || it.c.toLowerCase() === "#f7c400");
      if (document.activeElement !== el && el.innerText !== it.text) el.innerText = it.text;
    }
  }
  function removeItem(it) { const l = items(key); const i = l.indexOf(it); if (i >= 0) l.splice(i, 1); renderTexts(); emit(); }
  function edit(el) {
    el.contentEditable = "true";
    el.classList.add("editing");
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  function makeBox(it) {
    const el = document.createElement("div");
    el.className = "tbox";
    el.spellcheck = false;
    el.setAttribute("role", "textbox");
    el.addEventListener("input", () => { it.text = el.innerText.replace(/\n$/, ""); });
    el.addEventListener("blur", () => {
      el.contentEditable = "false"; el.classList.remove("editing");
      if (!it.text.trim()) removeItem(it); else emit();
    });
    el.addEventListener("keydown", e => {
      e.stopPropagation(); // typing must not trigger page shortcuts
      if (e.key === "Escape") { e.preventDefault(); el.blur(); }
    });
    // with the text tool: drag to move, tap to edit; with the eraser: tap to delete
    el.addEventListener("pointerdown", e => {
      if (!pen.on) return;
      if (pen.tool === "eraser") { e.preventDefault(); removeItem(it); return; }
      if (pen.tool !== "text" || el.isContentEditable) return;
      e.preventDefault(); e.stopPropagation();
      const r = sheetEl.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, ox = it.x, oy = it.y;
      let moved = false;
      el.setPointerCapture(e.pointerId);
      const mv = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true; el.classList.add("moving");
        it.x = ox + dx / r.width; it.y = oy + dy / r.height;
        el.style.left = it.x * 100 + "%"; el.style.top = it.y * 100 + "%";
      };
      const up = () => {
        el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
        el.classList.remove("moving");
        if (!moved) edit(el); else emit();
      };
      el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    });
    return el;
  }

  // ------------------------------------------------------------ drawing
  let cur = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  function eraseAt(p) {
    const list = items(key);
    const w = sheetEl.clientWidth, hgt = sheetEl.clientHeight;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (!s.pts) continue;
      const tol = Math.max(14, s.w * w);
      if (s.pts.some(q => Math.hypot((q[0] - p[0]) * w, (q[1] - p[1]) * hgt) < tol)) { list.splice(i, 1); redraw(); return; }
    }
  }
  cv.addEventListener("pointerdown", e => {
    if (!pen.on) return;
    e.preventDefault();
    const p = pt(e);
    if (pen.tool === "text") {
      // finish any open box first; a tap on empty page starts a new one
      const open = layer.querySelector(".tbox.editing");
      if (open) { open.blur(); return; }
      const s = TEXT_SIZES[pen.textSize];
      const it = { text: "", x: p[0], y: Math.max(0, p[1] - s * 0.6), s, c: pen.color };
      items(key).push(it);
      renderTexts();
      setTimeout(() => edit(boxes.get(it)), 0);
      return;
    }
    cv.setPointerCapture(e.pointerId);
    if (pen.tool === "eraser") { cur = { erase: true }; eraseAt(p); return; }
    const marker = pen.tool === "marker";
    cur = { c: pen.color, w: SIZES[pen.size] * (marker ? 3.2 : 1), a: marker ? 0.38 : 1, pts: [p] };
    items(key).push(cur);
    drawStroke(cur);
  });
  cv.addEventListener("pointermove", e => {
    if (!cur) return;
    if (document.body.classList.contains("pinching")) { // a second finger turned this into a pinch
      if (!cur.erase) { const l = items(key); const i = l.indexOf(cur); if (i >= 0) l.splice(i, 1); redraw(); }
      cur = null; return;
    }
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (cur.erase) { evs.forEach(ev => eraseAt(pt(ev))); return; }
    for (const ev of evs) cur.pts.push(pt(ev));
    redraw();
  });
  const end = () => { if (cur && !cur.erase) emit(); cur = null; };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  // changing colour or size while a box is being edited restyles that box
  const onPen = () => {
    const open = layer.querySelector(".tbox.editing");
    if (!open) return;
    for (const [it, el] of boxes) if (el === open) { it.c = pen.color; it.s = TEXT_SIZES[pen.textSize]; renderTexts(); }
  };
  pen.listeners.add(onPen);
  resize();
  return () => { ro.disconnect(); pen.listeners.delete(onPen); const i = surfaces.indexOf(surf); if (i >= 0) surfaces.splice(i, 1); cv.remove(); layer.remove(); };
}

function activeSurface() {
  for (let i = surfaces.length - 1; i >= 0; i--) if (surfaces[i].cv.isConnected) return surfaces[i];
  return null;
}
export function undo() { const s = activeSurface(); if (!s) return; items(s.key).pop(); s.redraw(); emit(); }
export function clearInk() { const s = activeSurface(); if (!s) return; store.set(s.key, []); s.redraw(); emit(); }
export function hasInk() { const s = activeSurface(); return !!(s && items(s.key).length); }
