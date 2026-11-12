// Smooth zoom & pan for a page sheet.
//  Touch:    pinch to zoom, drag with one finger to pan (when zoomed), double-tap to zoom in/out
//  Trackpad: pinch (or ctrl + scroll) to zoom, two-finger scroll to pan
//  Mouse:    wheel to zoom at the pointer, right-drag (or middle-drag) to pan, double-click to zoom
//  Keys:     + / - to zoom, 0 to reset
const MIN = 1, MAX = 5;
const stack = [];          // active controllers, top-most last
const subs = new Set();
export const onZoom = f => subs.add(f);
const emit = () => subs.forEach(f => f(activeZoom()));
export function activeZoom() {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i].fit.isConnected) return stack[i];
  return null;
}

export function attachZoom(fit, sheet) {
  let s = 1, tx = 0, ty = 0, raf = 0;
  const z = { fit, get scale() { return s; } };
  fit.classList.add("zoomable");

  const geo = () => ({ ox: sheet.offsetLeft, oy: sheet.offsetTop, W: sheet.offsetWidth, H: sheet.offsetHeight, FW: fit.clientWidth, FH: fit.clientHeight });
  function clamp() {
    const g = geo();
    const axis = (t, o, size, F) => {
      const sz = size * s;
      if (sz <= F) return (F - sz) / 2 - o;           // smaller than the box: keep centred
      return Math.min(-o, Math.max(F - sz - o, t));    // otherwise never show past an edge
    };
    tx = axis(tx, g.ox, g.W, g.FW);
    ty = axis(ty, g.oy, g.H, g.FH);
  }
  function apply(animate = false) {
    clamp();
    if (animate) {
      sheet.classList.add("zoom-anim");
      clearTimeout(z._t); z._t = setTimeout(() => sheet.classList.remove("zoom-anim"), 260);
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      sheet.style.transform = s === 1 && Math.abs(tx) < 0.5 && Math.abs(ty) < 0.5 ? "" : `translate(${tx}px, ${ty}px) scale(${s})`;
      fit.classList.toggle("zoomed", s > 1.001);
    });
    emit();
  }
  function zoomAt(cx, cy, ns, animate = false) {
    ns = Math.max(MIN, Math.min(MAX, ns));
    const r = fit.getBoundingClientRect(), g = geo();
    const px = cx - r.left, py = cy - r.top;
    const lx = (px - g.ox - tx) / s, ly = (py - g.oy - ty) / s;   // point on the unscaled page
    s = ns;
    tx = px - g.ox - lx * s; ty = py - g.oy - ly * s;
    if (s === 1) { tx = 0; ty = 0; }
    apply(animate);
  }
  const centre = () => { const r = fit.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  z.reset = () => { s = 1; tx = 0; ty = 0; apply(true); };
  z.zoomBy = f => { const [cx, cy] = centre(); zoomAt(cx, cy, s * f, true); };

  // ---- wheel: trackpad pinch arrives as ctrl+wheel; mouse wheels have big whole-number steps
  fit.addEventListener("wheel", e => {
    e.preventDefault();
    const mouseWheel = e.deltaMode === 1 || (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);
    if (e.ctrlKey || mouseWheel) {
      const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      zoomAt(e.clientX, e.clientY, s * Math.exp(-d * (e.ctrlKey ? 0.009 : 0.0022)));
    } else if (s > 1) {
      tx -= e.deltaX; ty -= e.deltaY; apply();
    }
  }, { passive: false });

  // ---- pointers
  const pts = new Map();
  let mode = null, start = null, moved = false, lastTap = 0, lastTapXY = [0, 0];
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = [...pts.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; };
  const blocksPan = el => el.closest(".piece, .placed, .scrub, .seg, .pill, .closer") || document.body.classList.contains("pen-on");

  fit.addEventListener("contextmenu", e => e.preventDefault());
  fit.addEventListener("pointerdown", e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "mouse") {
      if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        mode = "pan"; moved = false; start = { x: e.clientX, y: e.clientY, tx, ty };
        fit.setPointerCapture(e.pointerId); fit.classList.add("panning");
      }
      return;
    }
    if (pts.size === 2) {
      // second finger: pinch (cancels any pan / drawing in progress)
      const [cx, cy] = mid(), r = fit.getBoundingClientRect(), g = geo();
      mode = "pinch"; moved = true;
      start = { d: dist(), s, lx: (cx - r.left - g.ox - tx) / s, ly: (cy - r.top - g.oy - ty) / s };
      document.body.classList.add("pinching");
      for (const id of pts.keys()) try { fit.setPointerCapture(id); } catch {}
    } else if (pts.size === 1 && s > 1 && !blocksPan(e.target)) {
      mode = "maybe-pan"; moved = false; start = { x: e.clientX, y: e.clientY, tx, ty };
    }
  }, true);

  fit.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === "pinch" && pts.size >= 2) {
      const [cx, cy] = mid(), r = fit.getBoundingClientRect(), g = geo();
      s = Math.max(MIN, Math.min(MAX, start.s * dist() / start.d));
      tx = cx - r.left - g.ox - start.lx * s; ty = cy - r.top - g.oy - start.ly * s;
      apply();
    } else if (mode === "maybe-pan" || mode === "pan") {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (mode === "maybe-pan" && Math.hypot(dx, dy) > 8) { mode = "pan"; fit.setPointerCapture(e.pointerId); fit.classList.add("panning"); }
      if (mode === "pan") { moved = moved || Math.hypot(dx, dy) > 4; tx = start.tx + dx; ty = start.ty + dy; apply(); }
    }
  }, true);

  const end = e => {
    const was = mode;
    pts.delete(e.pointerId);
    if (was === "pinch") {
      if (pts.size < 2) { mode = pts.size ? "done" : null; document.body.classList.remove("pinching"); if (s < 1.03) z.reset(); }
    } else if (was === "pan" || was === "maybe-pan") {
      mode = null; fit.classList.remove("panning");
    }
    if (!pts.size) mode = null;
    // a drag that panned or pinched must not also press the button underneath
    if (moved && (was === "pan" || was === "pinch" || was === "done")) {
      const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
      fit.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => fit.removeEventListener("click", stop, true), 350);
      moved = pts.size ? moved : false;
    }
    // double-tap (touch) on the page background: zoom in, or back out
    if (e.type === "pointerup" && e.pointerType !== "mouse" && was !== "pinch" && was !== "pan" && !e.target.closest(".hs, .piece, .placed") && !document.body.classList.contains("pen-on")) {
      const now = Date.now();
      if (now - lastTap < 300 && Math.hypot(e.clientX - lastTapXY[0], e.clientY - lastTapXY[1]) < 30) {
        s > 1.05 ? z.reset() : zoomAt(e.clientX, e.clientY, 2.2, true); lastTap = 0;
      } else { lastTap = now; lastTapXY = [e.clientX, e.clientY]; }
    }
  };
  fit.addEventListener("pointerup", end, true);
  fit.addEventListener("pointercancel", end, true);
  fit.addEventListener("dblclick", e => {
    if (e.target.closest(".hs, .piece, .placed") || document.body.classList.contains("pen-on")) return;
    s > 1.05 ? z.reset() : zoomAt(e.clientX, e.clientY, 2.2, true);
  });

  const ro = new ResizeObserver(() => apply());
  ro.observe(fit);
  stack.push(z);
  emit();
  z.destroy = () => { ro.disconnect(); const i = stack.indexOf(z); if (i >= 0) stack.splice(i, 1); emit(); };
  return z;
}

window.addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  const z = activeZoom();
  if (!z) return;
  if (e.key === "0") z.reset();
  else if (e.key === "+" || e.key === "=") z.zoomBy(1.4);
  else if (e.key === "-" || e.key === "_") z.zoomBy(1 / 1.4);
});
