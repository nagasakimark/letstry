// How many? flash count (Let's Try! 1, Unit 3)
// Objects flash up for a moment; students say how many; reveal counts them together.
import { h } from "../ui.js";
import { t, getLang } from "../i18n.js";
import { speak, seg, btn, pick, wait, numWord } from "./common.js";

const THINGS = [["🍎", "apples"], ["⚽", "balls"], ["⭐", "stars"], ["🐟", "fish"], ["🍓", "strawberries"], ["🎈", "balloons"],
  ["🐱", "cats"], ["🌸", "flowers"], ["🍩", "donuts"], ["🚗", "cars"], ["🐶", "dogs"], ["🍌", "bananas"], ["✏️", "pencils"], ["🐸", "frogs"]];

export function mount(stage) {
  const ja = getLang() === "ja";
  const st = { max: 10, secs: 2, n: 0, thing: THINGS[0], busy: false, run: 0 };
  const field = h("div", { class: "hmfield" });
  const cover = h("div", { class: "hmcover", hidden: true }, h("span", {}, "?"));
  const big = h("div", { class: "hmbig", hidden: true });
  const prompt = h("div", { class: "hmprompt" }, "How many?");
  const area = h("div", { class: "hmarea" }, field, cover, big, prompt);
  const startBtn = btn("play", t("hm_start"), () => round(), "pill");
  const againBtn = btn("replay", t("hm_again"), () => flash(), "pill ghost");
  const answerBtn = btn("check", t("hm_answer"), () => reveal(), "pill ghost");
  const rangeSeg = seg([[10, "1–10"], [20, "1–20"]], st.max, v => st.max = v, "small");
  const timeSeg = seg([[1, ja ? "1秒" : "1 s"], [2, ja ? "2秒" : "2 s"], [3, ja ? "3秒" : "3 s"], [0, ja ? "ずっと" : "Stay"]], st.secs, v => st.secs = v, "small");
  againBtn.disabled = answerBtn.disabled = true;
  stage.append(h("div", { class: "bpanel" }, area, h("div", { class: "bbar" }, startBtn, againBtn, answerBtn, rangeSeg, timeSeg)));

  function layout(n) {
    // scatter n items without overlap: jittered cells of a grid sized to the area
    field.replaceChildren();
    const W = area.clientWidth, H = area.clientHeight - 70;
    const cols = Math.ceil(Math.sqrt(n * W / H)), rows = Math.ceil(n / cols);
    const cw = W / cols, ch = H / rows, size = Math.min(cw, ch) * 0.62;
    const cells = [...Array(cols * rows).keys()].sort(() => Math.random() - .5).slice(0, n);
    return cells.map((c, i) => {
      const x = (c % cols) * cw + (cw - size) / 2 + (Math.random() - .5) * (cw - size) * .8;
      const y = 60 + Math.floor(c / cols) * ch + (ch - size) / 2 + (Math.random() - .5) * (ch - size) * .8;
      const el = h("span", { class: "hmitem" }, st.thing[0]);
      Object.assign(el.style, { left: x + "px", top: y + "px", fontSize: size + "px", animationDelay: i * 25 + "ms", rotate: (Math.random() * 30 - 15) + "deg" });
      field.append(el);
      return el;
    }).sort((a, b) => (parseFloat(a.style.top) - parseFloat(b.style.top)) || (parseFloat(a.style.left) - parseFloat(b.style.left)));
  }
  let items = [];
  async function round() {
    const run = ++st.run;
    st.n = 1 + Math.floor(Math.random() * st.max);
    st.thing = pick(THINGS);
    big.hidden = true; cover.hidden = true; field.replaceChildren();
    for (const k of ["3", "2", "1"]) { if (run !== st.run) return; big.hidden = false; big.className = "hmbig count"; big.textContent = k; await wait(600); }
    if (run !== st.run) return;
    big.hidden = true;
    items = layout(st.n);
    againBtn.disabled = answerBtn.disabled = false;
    speak("How many?");
    hideAfter(run);
  }
  async function hideAfter(run) {
    if (!st.secs) return;
    await wait(st.secs * 1000);
    if (run === st.run) cover.hidden = false;
  }
  function flash() {
    const run = ++st.run;
    cover.hidden = true; big.hidden = true;
    items.forEach(el => el.classList.remove("counted"));
    hideAfter(run);
  }
  async function reveal() {
    const run = ++st.run;
    cover.hidden = true;
    for (let i = 0; i < items.length; i++) {
      if (run !== st.run) return;
      items[i].classList.add("counted");
      items[i].dataset.n = i + 1;
      speak(numWord(i + 1), { rate: 1 });
      await wait(st.n > 12 ? 520 : 650);
    }
    if (run !== st.run) return;
    big.hidden = false; big.className = "hmbig answer"; big.textContent = st.n;
    speak(`${numWord(st.n)} ${st.n === 1 ? st.thing[1].replace(/ies$/, "y").replace(/s$/, "") : st.thing[1]}!`);
  }
  return () => { st.run++; };
}
