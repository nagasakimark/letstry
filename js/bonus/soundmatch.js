// Sound match: a picture appears and a word is heard. Does it match? ○ or ✕.
// About two in three are matches. After each answer the right word is shown and said.
import { h, icon } from "../ui.js";
import { playAudio, stopAudio } from "../media.js";
import { btn, seg, shuffle, pick, wait } from "./common.js";
import { loadWords, setBar, card, say, tx, preloadWords } from "./words.js";

export async function mount(stage, { ctx }) {
  await loadWords();
  let words = [], deck = [], q = 0, score = 0, total = 10, cur = null, heard = null, locked = true;
  const picBox = h("div", { class: "smpic" });
  const progress = h("div", { class: "smprog" });
  const feedback = h("div", { class: "smfeed", hidden: true });
  const yes = h("button", { class: "smbtn yes", type: "button", "aria-label": tx("あってる", "Match") }, h("span", {}, "○"));
  const no = h("button", { class: "smbtn no", type: "button", "aria-label": tx("ちがう", "No match") }, h("span", {}, "✕"));
  const replay = btn("speaker", tx("もう一回きく", "Hear again"), () => heard && playAudio(heard.audio, null, { showBar: false }), "pill ghost");
  const picker = setBar(ctx, w => { words = w.filter(x => x.audio); preloadWords(words); start(); }, { min: 3 });
  words = picker.words().filter(x => x.audio); preloadWords(words);

  function start() {
    deck = [];
    while (deck.length < total) deck.push(...shuffle(words));
    deck = deck.slice(0, total); q = 0; score = 0;
    next();
  }
  async function next() {
    feedback.hidden = true;
    yes.className = "smbtn yes"; no.className = "smbtn no";
    if (q >= total) return finish();
    cur = deck[q];
    heard = Math.random() < 0.66 ? cur : pick(words.filter(w => w.w !== cur.w)) || cur;
    const c = card(cur, { cls: "smcard" });
    picBox.replaceChildren(c);
    drawProgress();
    locked = true;
    await wait(450);
    playAudio(heard.audio, null, { showBar: false });
    locked = false;
  }
  async function answer(saidYes) {
    if (locked) return;
    locked = true;
    const right = (heard.w === cur.w) === saidYes;
    if (right) score++;
    (saidYes ? yes : no).classList.add(right ? "right" : "wrong");
    feedback.replaceChildren(
      h("span", { class: "smmark " + (right ? "ok" : "ng") }, right ? tx("せいかい！", "Correct!") : tx("ざんねん", "Not quite")),
      heard.w === cur.w ? h("span", {}, tx(`「${cur.w}」でした`, `It was “${cur.w}”.`))
        : h("span", {}, tx(`聞こえたのは「${heard.w}」、絵は「${cur.w}」`, `You heard “${heard.w}”. The picture is “${cur.w}”.`)));
    feedback.hidden = false;
    picBox.firstChild.classList.add("named");
    picBox.firstChild.append(h("div", { class: "wword" }, cur.w));
    await wait(700);
    say(cur);
    q++; drawProgress();
    await wait(1700);
    next();
  }
  function drawProgress() {
    progress.replaceChildren(...Array.from({ length: total }, (_, i) => h("i", { class: i < q ? "done" : i === q ? "now" : "" })),
      h("b", {}, `${score}`), h("span", {}, ` / ${total}`));
  }
  function finish() {
    const stars = score >= total * .9 ? 3 : score >= total * .6 ? 2 : 1;
    picBox.replaceChildren(h("div", { class: "smend" },
      h("div", { class: "smstars" }, [0, 1, 2].map(i => h("span", { class: i < stars ? "on" : "" }, icon("star")))),
      h("b", {}, tx(`${total}問中 ${score}問 せいかい`, `${score} out of ${total}`)),
      btn("reset", tx("もう一回", "Play again"), start, "pill")));
    drawProgress();
  }
  yes.onclick = () => answer(true);
  no.onclick = () => answer(false);
  const key = e => {
    if (e.target.closest(".wpicker")) return;
    if (e.key === "o" || e.key === "ArrowLeft") answer(true);
    if (e.key === "x" || e.key === "ArrowRight") answer(false);
  };
  addEventListener("keydown", key);
  const lenSeg = seg([[5, "5"], [10, "10"], [20, "20"]], total, v => { total = v; start(); }, "small");
  stage.append(h("div", { class: "wgame" }, picker.bar,
    h("div", { class: "smwrap" }, yes, h("div", { class: "smcenter" }, picBox, feedback), no),
    h("div", { class: "bbar" }, progress, replay, h("span", { class: "blabel" }, tx("問題数", "Questions")), lenSeg)));
  start();
  return () => { removeEventListener("keydown", key); stopAudio(); };
}
