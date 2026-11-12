// Small DOM helpers and icon set
export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  left: '<path d="m14.5 5-7 7 7 7"/>',
  right: '<path d="m9.5 5 7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pen: '<path d="M4 20l1.2-4.6L15.5 5.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.5 7.2l3.3 3.3"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8.5c0 3.6-2.4 6-6 6-2.6 0-4-1.3-5.4-3.6L4 14a1.5 1.5 0 0 1 2.5-1.6L8 14.5"/>',
  undo: '<path d="M9 7 4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
  eraser: '<path d="M8.5 20H20"/><path d="m4.4 15.6 9.9-9.9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z"/><path d="m9.5 10.5 5 5"/>',
  marker: '<path d="M9 15 4 20h5l2-2"/><path d="m9 15 7.5-9.5a2.1 2.1 0 0 1 3 3L10 16z"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  unfull: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4.5h4.5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 12h13"/><path d="m13 6 6 6-6 6"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5V19"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2"/><path d="M9.5 2.5h5"/><path d="M12 2.5V6"/>',
  minimize: '<path d="M5 19h14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>',
  zoomreset: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/><path d="M8 10.5h5"/>',
  download: '<path d="M12 4v11"/><path d="m7 10.5 5 5 5-5"/><path d="M5 20h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  warn: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.6 3.5 5.3 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.3-3.5-8.5s1-5.9 3.5-8.5z"/>',
  watch: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-2.5 4-3.5 5.5S12.5 18 10 18"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  puzzle: '<path d="M9 4h3.5a2 2 0 1 1 3 0H19v4.5a2 2 0 1 0 0 3V16h-4a2 2 0 1 0-3 0H8v-4a2 2 0 1 1 0-3V4z"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
  count: '<path d="M5 18V7l-2 1.5"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-5 4.5-5 9h5"/><path d="M17.5 7.5h3.5l-2 3a2.5 2.5 0 1 1-2 4"/>',
  shapes: '<circle cx="7.5" cy="7.5" r="4"/><path d="m16.5 3.5 4.5 8h-9z"/><rect x="4" y="14" width="7" height="7" rx="1"/><path d="m17 13.5 1.2 2.6 2.8.3-2.1 1.9.6 2.7-2.5-1.5-2.5 1.5.6-2.7-2.1-1.9 2.8-.3z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  poll: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="15.5" y="13" width="3" height="5" rx="1"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  reset: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/>',
};
export function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = P[name] || "";
  return s;
}

export function tbtn(ic, label, onclick, extra = {}) {
  const { big, cls, showLabel, ...rest } = extra;
  return h("button", { class: "ib" + (big ? " big" : "") + (cls ? " " + cls : ""), type: "button", "aria-label": label, "data-tip": label, onclick, ...rest }, icon(ic));
}

let toastTimer;
export function toast(msg, ms = 1600) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// Position helper: rect is [x, y, w, h] as fractions of the sheet
export function place(el, r) {
  el.style.left = r[0] * 100 + "%";
  el.style.top = r[1] * 100 + "%";
  el.style.width = r[2] * 100 + "%";
  el.style.height = r[3] * 100 + "%";
  return el;
}

// A "sheet": the page image at its true aspect ratio, contained in its box.
export function sheet(image, size, cls = "") {
  const fit = h("div", { class: "fit" });
  const sh = h("div", { class: "sheet " + cls, style: { "--ar": `${size[0]} / ${size[1]}` } });
  sh.style.setProperty("--ar", `${size[0] / size[1]}`);
  const art = image ? h("img", { class: "art", src: image, alt: "", draggable: "false", decoding: "async" }) : null;
  if (art) sh.append(art);
  fit.append(sh);
  return { fit, sheet: sh, art };
}

export function ringAt(sheetEl, r) {
  const ring = h("span", { class: "ring" });
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
  const sz = Math.max(r[2] * sheetEl.clientWidth, r[3] * sheetEl.clientHeight, 30);
  ring.style.width = ring.style.height = sz + "px";
  ring.style.left = `calc(${cx * 100}% - ${sz / 2}px)`;
  ring.style.top = `calc(${cy * 100}% - ${sz / 2}px)`;
  sheetEl.append(ring);
  setTimeout(() => ring.remove(), 500);
}

export function preload(srcs) {
  for (const s of srcs) { const i = new Image(); i.decoding = "async"; i.src = s; }
}
