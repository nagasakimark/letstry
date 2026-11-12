// Drawing on the page. Works with mouse, touch and stylus (pointer events).
// Strokes are stored relative to the page, so they stay put through resizing,
// fullscreen and page turns (each page keeps its own drawing until cleared).
export const COLORS = [
  ["#e53935", "Red"], ["#1e63d6", "Blue"], ["#f7c400", "Yellow"], ["#2e9d47", "Green"],
  ["#f57c00", "Orange"], ["#ec5c9a", "Pink"], ["#7b45c4", "Purple"], ["#222222", "Black"], ["#ffffff", "White"],
];
export const SIZES = [0.004, 0.008, 0.016];

const store = new Map(); // key -> strokes
const surfaces = [];
export const pen = {
  on: false, color: COLORS[0][0], size: 1, tool: "pen", // pen | marker | eraser
  listeners: new Set(),
};
const emit = () => pen.listeners.forEach(f => f());

export function setPen(patch) { Object.assign(pen, patch); document.body.classList.toggle("pen-on", pen.on); emit(); }

function strokes(key) { if (!store.has(key)) store.set(key, []); return store.get(key); }

export function attachInk(sheetEl, key) {
  const cv = document.createElement("canvas");
  cv.className = "ink";
  sheetEl.append(cv);
  const ctx = cv.getContext("2d");
  const surf = { cv, ctx, key, sheetEl };
  surfaces.push(surf);
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
    for (const s of strokes(key)) drawStroke(s);
  }
  surf.redraw = redraw;

  let cur = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  function eraseAt(p) {
    const list = strokes(key);
    const w = sheetEl.clientWidth, hgt = sheetEl.clientHeight;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i], tol = Math.max(14, s.w * w);
      if (s.pts.some(q => Math.hypot((q[0] - p[0]) * w, (q[1] - p[1]) * hgt) < tol)) { list.splice(i, 1); redraw(); return; }
    }
  }
  cv.addEventListener("pointerdown", e => {
    if (!pen.on) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const p = pt(e);
    if (pen.tool === "eraser") { cur = { erase: true }; eraseAt(p); return; }
    const marker = pen.tool === "marker";
    cur = { c: pen.color, w: SIZES[pen.size] * (marker ? 3.2 : 1), a: marker ? 0.38 : 1, pts: [p] };
    strokes(key).push(cur);
    drawStroke(cur);
  });
  cv.addEventListener("pointermove", e => {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (cur.erase) { evs.forEach(ev => eraseAt(pt(ev))); return; }
    for (const ev of evs) cur.pts.push(pt(ev));
    redraw();
  });
  const end = () => {
    if (cur && !cur.erase) emit();
    cur = null;
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  resize();
  return () => { ro.disconnect(); const i = surfaces.indexOf(surf); if (i >= 0) surfaces.splice(i, 1); cv.remove(); };
}

function activeSurface() {
  for (let i = surfaces.length - 1; i >= 0; i--) if (surfaces[i].cv.isConnected) return surfaces[i];
  return null;
}
export function undo() { const s = activeSurface(); if (!s) return; strokes(s.key).pop(); s.redraw(); emit(); }
export function clearInk() { const s = activeSurface(); if (!s) return; store.set(s.key, []); s.redraw(); emit(); }
export function hasInk() { const s = activeSurface(); return !!(s && strokes(s.key).length); }
