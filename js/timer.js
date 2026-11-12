// Classroom timer. Set it with +1 min / +30 sec, start it, and the countdown
// shows large in the middle of the screen. It keeps running across pages.
import { h, icon } from "./ui.js";
import { t, onLang } from "./i18n.js";

const st = { total: 0, left: 0, running: false, end: 0, mini: false, done: false };
let panel = null, big = null, tick = 0, railBtn = null;
const subs = new Set();
const emit = () => subs.forEach(f => f());
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function add(sec) {
  st.done = false;
  if (st.running) { st.end += sec * 1000; st.total += sec * 1000; }
  else { st.left += sec * 1000; st.total = st.left; }
  emit();
}
function start() {
  if (!st.left) return;
  st.running = true; st.done = false; st.mini = false; st.end = Date.now() + st.left;
  closePanel(); loop(); emit();
}
function pause() { if (!st.running) return; st.left = Math.max(0, st.end - Date.now()); st.running = false; cancelAnimationFrame(tick); emit(); }
function stop() { st.running = false; st.left = 0; st.total = 0; st.done = false; cancelAnimationFrame(tick); emit(); }
function loop() {
  cancelAnimationFrame(tick);
  const step = () => {
    if (!st.running) return;
    const left = st.end - Date.now();
    if (left <= 0) { st.running = false; st.left = 0; st.done = true; st.mini = false; chime(); emit(); return; }
    st.left = left; paint();
    tick = requestAnimationFrame(step);
  };
  step();
}

function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56].forEach((d, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = [880, 1175, 1568][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.35, ac.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.9);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 1);
    });
    setTimeout(() => ac.close(), 2000);
  } catch {}
}

// ---------------------------------------------------------------- setup panel (beside the rail)
function closePanel() { panel && panel.remove(); panel = null; railBtn && railBtn.setAttribute("aria-pressed", String(st.running || st.left > 0)); }
function openPanel(anchor) {
  if (panel) return closePanel();
  const disp = h("div", { class: "tdisp" });
  const startBtn = h("button", { class: "pill", type: "button", onclick: start }, icon("play"), t("start"));
  panel = h("div", { class: "timerpanel", role: "dialog", "aria-label": t("timer") },
    disp,
    h("div", { class: "trow" },
      h("button", { class: "chip big", type: "button", onclick: () => add(60) }, t("plus1m")),
      h("button", { class: "chip big", type: "button", onclick: () => add(30) }, t("plus30s"))),
    h("div", { class: "trow" }, startBtn, h("button", { class: "ib", type: "button", "aria-label": t("reset"), "data-tip": t("reset"), onclick: stop }, icon("reset"))));
  const sync = () => { if (!panel) return; disp.textContent = fmt(st.left); startBtn.disabled = !st.left; };
  subs.add(sync); sync();
  anchor.closest(".rail").append(panel);
  railBtn.setAttribute("aria-pressed", "true");
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
}
function outside(e) {
  if (!panel) return document.removeEventListener("pointerdown", outside, true);
  if (!panel.contains(e.target) && !e.target.closest(".timer-btn")) { closePanel(); document.removeEventListener("pointerdown", outside, true); }
}

// ---------------------------------------------------------------- big centre display
function render() {
  const show = st.running || st.done || (st.left > 0 && st.total > 0 && !st.running && big);
  if (!show && !st.left) { big && big.remove(); big = null; updateRail(); return; }
  if (!big) { big = h("div", { class: "bigtimer" }); document.body.append(big); }
  big.classList.toggle("mini", st.mini && !st.done);
  big.classList.toggle("done", st.done);
  big.classList.toggle("paused", !st.running && !st.done);
  const frac = st.total ? Math.max(0, st.left) / st.total : 0;
  const R = 46, C = 2 * Math.PI * R;
  big.innerHTML = "";
  big.append(
    h("div", { class: "tface", onclick: () => { if (st.mini) { st.mini = false; emit(); } } },
      h("div", { class: "tring", html: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="bg"/><circle cx="50" cy="50" r="${R}" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>` }),
      h("div", { class: "tnum" }, st.done ? t("timesUp") : fmt(st.left))),
    h("div", { class: "tctl" },
      st.done ? null : h("button", { class: "ib", type: "button", "aria-label": t("plus30s"), "data-tip": t("plus30s"), onclick: () => add(30) }, h("b", {}, "+30")),
      st.done ? null : h("button", { class: "ib main", type: "button", "aria-label": st.running ? t("pause") : t("resume"), onclick: () => st.running ? pause() : start() }, icon(st.running ? "pause" : "play")),
      h("button", { class: "ib", type: "button", "aria-label": t("stop"), "data-tip": t("stop"), onclick: stop }, icon("stop")),
      st.done ? null : h("button", { class: "ib", type: "button", "aria-label": t("minimize"), "data-tip": t("minimize"), onclick: () => { st.mini = !st.mini; emit(); } }, icon(st.mini ? "full" : "minimize"))));
  updateRail();
}
// per-frame update: just the digits and the ring
function paint() {
  if (!big) return render();
  const num = big.querySelector(".tnum"), fg = big.querySelector(".fg");
  if (num) num.textContent = fmt(st.left);
  if (fg && st.total) fg.setAttribute("stroke-dashoffset", 2 * Math.PI * 46 * (1 - st.left / st.total));
}
function updateRail() {
  if (!railBtn) return;
  const active = st.running || st.left > 0;
  railBtn.setAttribute("aria-pressed", String(active || !!panel));
  railBtn.classList.toggle("ticking", st.running);
}
subs.add(render);
onLang(() => render());

// rail button
export function timerButton() {
  railBtn = h("button", { class: "ib timer-btn", type: "button", "aria-label": t("timer"), "data-tip": t("timer") }, icon("timer"));
  railBtn.onclick = () => {
    if (st.running || st.done || (st.left && big)) { st.mini = false; if (st.done) stop(); emit(); return; }
    openPanel(railBtn);
  };
  updateRail();
  return railBtn;
}
