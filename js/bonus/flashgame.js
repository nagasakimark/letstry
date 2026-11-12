// Flash game: numbered boxes each flash their picture once, one after another.
// Then the class remembers: "No. 3 was a cat!" Tap a box to check it, or show them all.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, wait } from "./common.js";
import { loadWords, setBar, card, say, tx, preloadWords } from "./words.js";

const SPEEDS = { slow: 1500, mid: 900, fast: 500 };

export async function mount(stage, { ctx }) {
  await loadWords();
  let words = [], n = 6, speed = "mid", order = "seq", running = false, stop = false, cells = [];
  const grid = h("div", { class: "fggrid" });
  const picker = setBar(ctx, w => { words = w; preloadWords(words); deal(); }, { min: 6 });
  words = picker.words(); preloadWords(words);

  function deal() {
    stop = true; running = false;
    const k = Math.min(n, words.length);
    const chosen = shuffle(words).slice(0, k);
    grid.style.setProperty("--cols", k <= 6 ? 3 : k <= 8 ? 4 : k <= 10 ? 5 : 4);
    cells = chosen.map((w, i) => {
      const el = h("button", { type: "button", class: "fgcell" }, h("span", { class: "fgnum" }, String(i + 1)), card(w));
      el.onclick = () => { if (running) return; el.classList.toggle("open"); if (el.classList.contains("open")) say(w, el); };
      return { el, w };
    });
    grid.replaceChildren(...cells.map(c => c.el));
    startBtn.disabled = false; startBtn.replaceChildren(icon("play"), tx("スタート", "Start"));
  }
  async function run() {
    if (running) { stop = true; return; }
    cells.forEach(c => c.el.classList.remove("open", "flash"));
    running = true; stop = false;
    startBtn.replaceChildren(icon("stop"), tx("とめる", "Stop"));
    await wait(500);
    const seq = order === "seq" ? cells : shuffle(cells);
    for (const c of seq) {
      if (stop) break;
      c.el.classList.add("flash");
      await wait(SPEEDS[speed]);
      c.el.classList.remove("flash");
      await wait(Math.max(180, SPEEDS[speed] * 0.35));
    }
    running = false;
    startBtn.replaceChildren(icon("replay"), tx("もう一回", "Again"));
  }
  const startBtn = btn("play", tx("スタート", "Start"), run, "pill");
  const allBtn = btn("eye", tx("ぜんぶ見せる", "Show all"), () => {
    if (running) return;
    const anyClosed = cells.some(c => !c.el.classList.contains("open"));
    cells.forEach(c => c.el.classList.toggle("open", anyClosed));
  }, "pill ghost");
  const countSeg = seg([[6, "6"], [8, "8"], [10, "10"], [12, "12"]], n, v => { n = v; deal(); }, "small");
  const speedSeg = seg([["slow", tx("ゆっくり", "Slow")], ["mid", tx("ふつう", "Medium")], ["fast", tx("はやい", "Fast")]], speed, v => { speed = v; }, "small");
  const orderSeg = seg([["seq", "1→" + "N"], ["rand", tx("ランダム", "Random")]], order, v => { order = v; }, "small");
  stage.append(h("div", { class: "wgame" }, picker.bar, h("div", { class: "fgwrap" }, grid),
    h("div", { class: "bbar" }, startBtn, allBtn, countSeg, speedSeg, orderSeg, btn("dice", tx("入れかえ", "New pictures"), deal, "pill ghost"))));
  deal();
  return () => { stop = true; stopAudio(); };
}
