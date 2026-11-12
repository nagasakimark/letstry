// Feelings slot machine (Let's Try! 1, Unit 2): "How are you?" "I'm sleepy."
import { h } from "../ui.js";
import { t, getLang } from "../i18n.js";
import { btn, wait } from "./common.js";

const FEELINGS = [["fine", "🙂", "げんき"], ["happy", "😄", "うれしい"], ["good", "😊", "いい"], ["great", "🤩", "さいこう"],
  ["sleepy", "😪", "ねむい"], ["hungry", "😋", "おなかがすいた"], ["tired", "😫", "つかれた"], ["sad", "😢", "かなしい"]];

export function mount(stage) {
  const ja = getLang() === "ja";
  let on = new Set(FEELINGS.map(f => f[0]));
  try { const saved = JSON.parse(localStorage.getItem("slotFeelings") || "null"); if (saved && saved.length >= 2) on = new Set(saved); } catch {}
  const strip = h("div", { class: "reelstrip" });
  const reel = h("div", { class: "reel" }, strip);
  const result = h("div", { class: "slotsay" }, h("b", {}, "How are you?"));
  const lever = h("button", { class: "lever", type: "button", "aria-label": t("sl_spin") }, h("i"));
  const machine = h("div", { class: "slotm" }, h("div", { class: "slottop" }, "How are you?"), h("div", { class: "reelwin" }, reel), lever);
  const spinBtn = btn("dice", t("sl_spin"), () => spin(), "pill");
  const chips = h("div", { class: "fchips" }, FEELINGS.map(([k, e]) => {
    const b = h("button", { class: "fchip", type: "button", "aria-pressed": String(on.has(k)) }, e, " ", k);
    b.onclick = () => {
      if (on.has(k) && on.size <= 2) return;
      on.has(k) ? on.delete(k) : on.add(k);
      b.setAttribute("aria-pressed", String(on.has(k)));
      try { localStorage.setItem("slotFeelings", JSON.stringify([...on])); } catch {}
      build(0);
    };
    return b;
  }));
  stage.append(h("div", { class: "bpanel slotpanel" }, h("div", { class: "slotarea" }, machine, result), h("div", { class: "bbar" }, spinBtn, chips)));

  const list = () => FEELINGS.filter(f => on.has(f[0]));
  const cell = f => h("div", { class: "rcell" }, h("span", { class: "rface" }, f[1]), h("span", { class: "rword" }, f[0]));
  let idx = 0, busy = false;
  function build(at) {
    const l = list();
    strip.style.transition = "none";
    strip.replaceChildren(cell(l[at % l.length]));
    strip.style.transform = "translateY(0)";
    idx = at % l.length;
  }
  build(0);
  async function spin() {
    if (busy) return;
    busy = true; lever.classList.add("pull"); setTimeout(() => lever.classList.remove("pull"), 450);
    result.replaceChildren(h("b", {}, "How are you?"));
    const l = list();
    const target = Math.floor(Math.random() * l.length);
    const loops = 3 + Math.floor(Math.random() * 2);
    const seq = [];
    for (let i = 0; i <= loops * l.length + ((target - idx + l.length) % l.length); i++) seq.push(l[(idx + i) % l.length]);
    strip.style.transition = "none";
    strip.replaceChildren(...seq.map(cell));
    strip.style.transform = "translateY(0)";
    const H = reel.clientHeight;
    void strip.offsetHeight;
    const dur = 2400 + Math.random() * 600;
    strip.style.transition = `transform ${dur}ms cubic-bezier(.12,.62,.18,1.02)`;
    strip.style.transform = `translateY(${-(seq.length - 1) * H}px)`;
    await wait(dur + 80);
    build(target);
    const f = l[idx];
    reel.classList.add("win"); setTimeout(() => reel.classList.remove("win"), 900);
    result.replaceChildren(h("b", {}, `I'm ${f[0]}.`), h("small", {}, ja ? f[2] : ""));
    busy = false;
  }
  lever.onclick = spin;
  return () => {};
}
