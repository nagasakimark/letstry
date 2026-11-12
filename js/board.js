// Sticker board: drag picture cards onto the page (letters, pencil case, parfait).
// mode "once": each card moves (its home spot dims); mode "copy": unlimited copies.
// Placed cards can be moved again; double-tap or drag off the page to remove.
import { h, icon, place } from "./ui.js";

export function mountBoard(sheetEl, cfg) {
  const placed = []; // {el, piece, x, y}
  const slots = (cfg.slots || []).map(r => place(h("div", { class: "slot" }), r));
  sheetEl.append(...slots);
  const W = () => sheetEl.clientWidth, H = () => sheetEl.clientHeight;

  const pieces = cfg.pieces.map((p, i) => {
    const el = place(h("div", { class: "piece" + (p.ghost ? " ghost" : ""), role: "button", tabindex: "0",
      "aria-label": "Card " + (i + 1) }, h("img", { src: p.img, alt: "", draggable: "false" })), p.rect);
    el.addEventListener("pointerdown", e => startDrag(e, null, p, el));
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dropAt(p, el, centerOfFirstFree(p)); } });
    sheetEl.append(el);
    return { p, el };
  });
  if (cfg.front) sheetEl.append(place(h("div", { class: "front" }, h("img", { src: cfg.front.img, alt: "" })), cfg.front.rect));

  function centerOfFirstFree(p) {
    const free = (cfg.slots || []).find(r => !placed.some(q => Math.abs(q.x - r[0]) < 1e-3 && Math.abs(q.y - r[1]) < 1e-3));
    if (free) return [free[0] + free[2] / 2, free[1] + free[3] / 2];
    const a = (cfg.areas && cfg.areas[0]) || (cfg.front && cfg.front.rect) || [0.1, 0.3, 0.3, 0.4];
    return [a[0] + a[2] * (0.2 + Math.random() * 0.6), a[1] + a[3] * (0.2 + Math.random() * 0.6)];
  }

  function makePlaced(p, homeEl) {
    const el = h("div", { class: "placed" }, h("img", { src: p.img, alt: "", draggable: "false" }));
    el.style.width = p.rect[2] * 100 + "%";
    el.style.height = p.rect[3] * 100 + "%";
    const item = { el, p, homeEl, x: 0, y: 0 };
    el.addEventListener("pointerdown", e => startDrag(e, item));
    let lastTap = 0;
    el.addEventListener("pointerup", () => { const t = Date.now(); if (t - lastTap < 320) remove(item); lastTap = t; });
    sheetEl.append(el);
    placed.push(item);
    return item;
  }
  function setPos(item, x, y) { item.x = x; item.y = y; item.el.style.left = x * 100 + "%"; item.el.style.top = y * 100 + "%"; }
  function remove(item) {
    item.el.remove();
    placed.splice(placed.indexOf(item), 1);
    if (cfg.mode === "once" && item.homeEl) item.homeEl.classList.remove("used");
  }
  function slotAt(cx, cy) {
    return (cfg.slots || []).find(r => cx >= r[0] && cx <= r[0] + r[2] && cy >= r[1] && cy <= r[1] + r[3]);
  }
  function dropAt(p, homeEl, c) {
    const it = makePlaced(p, homeEl);
    const s = slotAt(c[0], c[1]);
    if (s) setPos(it, s[0] + (s[2] - p.rect[2]) / 2, s[1] + (s[3] - p.rect[3]) / 2);
    else setPos(it, c[0] - p.rect[2] / 2, c[1] - p.rect[3] / 2);
    if (cfg.mode === "once") homeEl.classList.add("used");
  }

  function startDrag(e, item, p, homeEl) {
    if (document.body.classList.contains("pen-on")) return;
    if (!item && cfg.mode === "once" && homeEl.classList.contains("used")) return;
    e.preventDefault();
    const r = sheetEl.getBoundingClientRect();
    const rel = ev => [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
    let it = item, offX, offY;
    const start = rel(e);
    if (!it) {
      it = makePlaced(p, homeEl);
      offX = start[0] - p.rect[0]; offY = start[1] - p.rect[1];
      setPos(it, p.rect[0], p.rect[1]);
      if (cfg.mode === "once") homeEl.classList.add("used");
    } else {
      offX = start[0] - it.x; offY = start[1] - it.y;
      sheetEl.append(it.el); // bring to front
    }
    it.el.classList.add("drag");
    let hot = null;
    const move = ev => {
      const q = rel(ev);
      setPos(it, q[0] - offX, q[1] - offY);
      const c = [it.x + it.p.rect[2] / 2, it.y + it.p.rect[3] / 2];
      const s = slotAt(c[0], c[1]);
      const sEl = s ? slots[(cfg.slots).indexOf(s)] : null;
      if (hot !== sEl) { hot && hot.classList.remove("hot"); sEl && sEl.classList.add("hot"); hot = sEl; }
    };
    const up = ev => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      hot && hot.classList.remove("hot");
      it.el.classList.remove("drag");
      const c = [it.x + it.p.rect[2] / 2, it.y + it.p.rect[3] / 2];
      // dropped off the page, or back onto its home card -> remove
      const home = it.homeEl && it.p.rect;
      const onHome = home && c[0] > home[0] && c[0] < home[0] + home[2] && c[1] > home[1] && c[1] < home[1] + home[3];
      const moved = Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 6;
      if (c[0] < 0 || c[0] > 1 || c[1] < 0 || c[1] > 1 || (onHome && (moved || !item))) { remove(it); return; }
      const s = slotAt(c[0], c[1]);
      if (s) setPos(it, s[0] + (s[2] - it.p.rect[2]) / 2, s[1] + (s[3] - it.p.rect[3]) / 2);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const resetAll = () => [...placed].forEach(remove);
  if (cfg.reset) sheetEl.append(place(h("button", { class: "hs", type: "button", "aria-label": "Clear all cards", title: "Clear all", onclick: resetAll }), cfg.reset));
  else sheetEl.append(h("button", { class: "pill board-reset", type: "button", onclick: resetAll }, icon("reset"), "やりなおす"));
  if (cfg.undo) sheetEl.append(place(h("button", { class: "hs", type: "button", "aria-label": "Remove last card", title: "Remove last", onclick: () => placed.length && remove(placed[placed.length - 1]) }), cfg.undo));
  return () => [...placed].forEach(remove);
}
