// Shared helpers for bonus activities
import { h, icon } from "../ui.js";
import { t } from "../i18n.js";


// ---- small UI builders
export function seg(items, cur, onPick, cls = "") {
  const el = h("div", { class: "seg " + cls, role: "group" });
  const draw = v => el.replaceChildren(...items.map(([val, label, tip]) =>
    h("button", { type: "button", "aria-pressed": String(val === v), title: tip || label, onclick: () => { draw(val); onPick(val); } }, label)));
  draw(cur);
  el.set = draw;
  return el;
}
export const btn = (ic, label, onclick, cls = "pill") => h("button", { class: cls, type: "button", onclick }, ic ? icon(ic) : null, label);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const wait = ms => new Promise(r => setTimeout(r, ms));

// number words for counting aloud
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const numWord = n => ONES[n] || String(n);
