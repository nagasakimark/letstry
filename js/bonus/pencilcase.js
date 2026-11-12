// My pencil case (Let's Try! 2, Unit 5: "Do you have a pen?").
// Pack: tap things to put them in (or take them out); the sentence builds itself: "I have a pen and a ruler."
// Guess: the case is packed in secret. Ask "Do you have a …?" by tapping a thing;
// the case answers "Yes, I do." or "No, I don't." Find everything inside.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, wait } from "./common.js";
import { loadWords, card, say, tx } from "./words.js";

const art = w => /^[aeiou]/.test(w) ? "an " + w : "a " + w;
const listing = ws => ws.length <= 1 ? ws.map(art).join("") : ws.slice(0, -1).map(art).join(", ") + " and " + art(ws[ws.length - 1]);

export async function mount(stage) {
  const DATA = await loadWords();
  const items = DATA.sets.stationery.words.filter(w => w.w !== "pencil case");
  let mode = "pack", inside = [], secret = [], asked = new Set(), hidden = 4;
  const tray = h("div", { class: "pctray" });
  const caseEl = h("div", { class: "pccase" });
  const sentence = h("div", { class: "pcsay" });

  function drawTray() {
    tray.replaceChildren(...items.map(w => {
      const b = h("button", { type: "button", class: "pcitem" }, card(w));
      const was = asked.has(w.w);
      if (mode === "guess" && was) b.classList.add(secret.some(s => s.w === w.w) ? "yes" : "no");
      if (mode === "pack" && inside.includes(w)) b.classList.add("in");
      b.onclick = () => mode === "pack" ? toggle(w) : ask(w, b);
      return b;
    }));
  }
  function drawCase(open) {
    const show = mode === "pack" ? inside : secret.filter(s => asked.has(s.w) || open);
    caseEl.className = "pccase" + (mode === "guess" && !open ? " zipped" : "");
    caseEl.replaceChildren(
      h("div", { class: "pcbody" },
        h("div", { class: "pczip" }),
        h("div", { class: "pcin" }, show.map(w => {
          const c = h("button", { type: "button", class: "pcthing" }, card(w));
          c.onclick = () => mode === "pack" ? toggle(w) : say(w, c);
          return c;
        }), mode === "guess" ? Array.from({ length: secret.length - show.length }, () => h("span", { class: "pcslot" }, "?")) : null)));
  }
  function toggle(w) {
    const i = inside.indexOf(w);
    if (i >= 0) inside.splice(i, 1); else { if (inside.length >= 8) return; inside.push(w); say(w); }
    drawTray(); drawCase();
    sentence.replaceChildren(inside.length ? h("b", {}, `I have ${listing(inside.map(x => x.w))}.`)
      : h("span", {}, tx("文房具をタップして入れよう", "Tap things to put them in your pencil case.")));
  }
  async function ask(w, b) {
    if (asked.has(w.w)) return say(w, b);
    asked.add(w.w);
    say(w, b);
    const yes = secret.some(s => s.w === w.w);
    sentence.replaceChildren(h("span", { class: "pcq" }, `Do you have ${art(w.w)}?`),
      h("b", { class: yes ? "ok" : "ng" }, yes ? "Yes, I do. ○" : "No, I don't. ✕"));
    drawTray(); drawCase();
    const found = secret.filter(s => asked.has(s.w)).length;
    count.textContent = tx(`見つけた ${found} / ${secret.length}　しつもん ${asked.size}回`, `Found ${found} of ${secret.length} · ${asked.size} questions`);
    if (found === secret.length) {
      await wait(900);
      sentence.replaceChildren(h("b", { class: "ok" }, tx(`ぜんぶ見つけた！ ${asked.size}回のしつもんで`, `All found in ${asked.size} questions!`)),
        h("span", {}, `I have ${listing(secret.map(x => x.w))}.`));
      caseEl.classList.add("party");
    }
  }
  function start() {
    asked = new Set(); inside = [];
    secret = shuffle(items).slice(0, hidden);
    count.textContent = "";
    sentence.replaceChildren(mode === "guess"
      ? h("span", {}, tx(`ふでばこに${hidden}つ入っています。"Do you have a …?" と聞いてみよう`, `There are ${hidden} things inside. Ask: “Do you have a …?”`))
      : h("span", {}, tx("文房具をタップして入れよう", "Tap things to put them in your pencil case.")));
    countSeg.hidden = mode !== "guess"; revealBtn.hidden = mode !== "guess";
    drawTray(); drawCase();
  }
  const count = h("span", { class: "pccount" });
  const modeSeg = seg([["pack", tx("入れてみよう", "Pack")], ["guess", tx("なにが入ってる？", "Guess")]], mode, v => { mode = v; start(); }, "small");
  const countSeg = seg([[3, "3"], [4, "4"], [5, "5"]], hidden, v => { hidden = v; start(); }, "small");
  const revealBtn = btn("eye", tx("あける", "Open it"), () => { drawCase(true); }, "pill ghost");
  stage.append(h("div", { class: "wgame pcgame" },
    h("div", { class: "pcwrap" }, tray, h("div", { class: "pcright" }, caseEl, sentence)),
    h("div", { class: "bbar" }, modeSeg, countSeg, count, revealBtn, btn("reset", tx("はじめから", "Start again"), start, "pill ghost"))));
  start();
  return () => stopAudio();
}
