// Overlay stack: pop-up activities, video, spotlight images.
// Esc or the X closes the top one; the browser Back button does too.
import { h, icon } from "./ui.js";

const stack = [];
let root;
const listeners = new Set();

export function onLayersChange(fn) { listeners.add(fn); }
function changed() { listeners.forEach(f => f(stack.length)); }

export function openLayer(content, { onClose, history: useHistory = true, tag } = {}) {
  root ||= document.getElementById("layer");
  const closer = h("button", { class: "closer", type: "button", "aria-label": "Close", title: "Close (Esc)" }, icon("close"));
  const el = h("div", { class: "pop", role: "dialog", "aria-modal": "true" }, content, closer);
  const entry = { el, onClose, tag };
  closer.addEventListener("click", () => closeTop());
  // tap on the dimmed background (not the content) closes, except on interactive sheets
  el.addEventListener("pointerdown", e => { if (e.target === el || e.target.classList.contains("vid") || e.target.classList.contains("spot")) entry.armed = true; });
  el.addEventListener("click", e => {
    if (entry.armed && (e.target === el || e.target.classList.contains("vid") || e.target.classList.contains("spot"))) closeTop();
    entry.armed = false;
  });
  root.append(el);
  stack.push(entry);
  if (useHistory) { history.pushState({ layer: stack.length }, ""); entry.hist = true; }
  changed();
  setTimeout(() => closer.focus({ preventScroll: true }), 30);
  return entry;
}

export function closeTop(fromPop = false) {
  const e = stack.pop();
  if (!e) return false;
  e.el.remove();
  e.onClose && e.onClose();
  if (e.hist && !fromPop) { ignorePop++; history.back(); }
  changed();
  return true;
}
// used when navigating: close everything without touching browser history
export function closeAll() { while (stack.length) closeTop(true); }
export function layerCount() { return stack.length; }
export function topLayer() { return stack[stack.length - 1]; }

let ignorePop = 0;
window.addEventListener("popstate", e => {
  if (ignorePop) { ignorePop--; e.stopImmediatePropagation(); return; }
  if (stack.length && stack[stack.length - 1].hist) { closeTop(true); e.stopImmediatePropagation(); }
}, true);
window.addEventListener("keydown", e => { if (e.key === "Escape" && stack.length) { e.preventDefault(); closeTop(); } });
