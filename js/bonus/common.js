// Shared helpers for bonus activities
import { h, icon } from "../ui.js";
import { t } from "../i18n.js";

// ---- English speech (device voice). Teachers can switch it off; the choice is remembered.
let voiceOn = true;
try { voiceOn = localStorage.getItem("bonusVoice") !== "off"; } catch {}
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => /^en(-|_)/i.test(v.lang));
  voice = vs.find(v => /Google US English/i.test(v.name)) || vs.find(v => /en-US/i.test(v.lang) && /natural|neural|samantha|aria|jenny/i.test(v.name))
    || vs.find(v => /en-US/i.test(v.lang)) || vs[0] || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener?.("voiceschanged", pickVoice); }
export function speak(text, { rate = 0.88, onend } = {}) {
  if (!voiceOn || !("speechSynthesis" in window)) { onend && setTimeout(onend, 300); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : "en-US";
  u.rate = rate;
  if (onend) u.onend = onend;
  speechSynthesis.speak(u);
}
export const hush = () => { try { speechSynthesis.cancel(); } catch {} };
export function voiceToggle() {
  const b = h("button", { class: "ib", type: "button", "data-tip": t("voice"), "aria-label": t("voice") }, icon(voiceOn ? "speaker" : "mute"));
  b.setAttribute("aria-pressed", String(voiceOn));
  b.onclick = () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem("bonusVoice", voiceOn ? "on" : "off"); } catch {}
    b.replaceChildren(icon(voiceOn ? "speaker" : "mute")); b.setAttribute("aria-pressed", String(voiceOn));
    if (!voiceOn) hush();
  };
  return b;
}

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
