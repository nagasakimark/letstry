// Memory: numbered cards face down; find the pairs. Pairs can be picture + picture or
// picture + word. Optional two teams take turns (a miss passes the turn). Each match is said aloud.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, wait } from "./common.js";
import { loadWords, setBar, card, say, tx, preloadWords } from "./words.js";

export async function mount(stage, { ctx }) {
  await loadWords();
  let words = [], pairs = 6, kind = "pp", teams = 0, turn = 0, score = [0, 0], open = [], busy = false, found = 0;
  const grid = h("div", { class: "mmgrid" });
  const status = h("div", { class: "mmstatus" });
  const picker = setBar(ctx, w => { words = w; preloadWords(words); deal(); }, { min: 4 });
  words = picker.words(); preloadWords(words);

  function deal() {
    const n = Math.min(pairs, words.length);
    const chosen = shuffle(words).slice(0, n);
    const cards = shuffle(chosen.flatMap(w => [{ w, side: 0 }, { w, side: 1 }]));
    open = []; found = 0; busy = false; score = [0, 0]; turn = 0;
    const cols = cards.length <= 8 ? 4 : cards.length <= 12 ? 4 : 4;
    grid.style.setProperty("--cols", cards.length > 12 ? 4 : cols);
    grid.style.setProperty("--rows", Math.ceil(cards.length / (cards.length > 12 ? 4 : cols)));
    grid.dataset.n = cards.length;
    grid.replaceChildren(...cards.map((c, i) => {
      const asWord = kind === "pw" && c.side === 1;
      const face = asWord ? h("div", { class: "wcard wordonly" }, h("div", { class: "wword big" }, c.w.w)) : card(c.w);
      const el = h("button", { type: "button", class: "mmcard", "aria-label": `${i + 1}` },
        h("span", { class: "mmin" }, h("span", { class: "mmback" }, String(i + 1)), h("span", { class: "mmfront" }, face)));
      el.onclick = () => flip(el, c);
      return el;
    }));
    drawStatus();
  }
  async function flip(el, c) {
    if (busy || el.classList.contains("up")) return;
    el.classList.add("up");
    open.push({ el, c });
    if (open.length < 2) return;
    busy = true;
    const [a, b] = open; open = [];
    if (a.c.w.w === b.c.w.w) {
      await wait(350);
      say(a.c.w);
      a.el.classList.add("match"); b.el.classList.add("match");
      found++; if (teams) score[turn]++;
      busy = false;
      drawStatus();
      if (found === grid.children.length / 2) celebrate();
    } else {
      await wait(1300);
      a.el.classList.remove("up"); b.el.classList.remove("up");
      if (teams) turn = 1 - turn;
      busy = false;
      drawStatus();
    }
  }
  function drawStatus() {
    const left = grid.children.length / 2 - found;
    status.replaceChildren(...[
      teams ? h("div", { class: "mmteams" }, ["A", "B"].map((t, i) =>
        h("div", { class: "mmteam" + (i === turn ? " on" : "") }, h("span", {}, tx(`チーム${t}`, `Team ${t}`)), h("b", {}, String(score[i]))))) : null,
      h("span", { class: "mmleft" }, tx(`のこり ${left} ペア`, `${left} pairs left`))].filter(Boolean));
  }
  function celebrate() {
    const msg = teams ? (score[0] === score[1] ? tx("ひきわけ！", "It's a draw!") : tx(`チーム${score[0] > score[1] ? "A" : "B"}の勝ち！`, `Team ${score[0] > score[1] ? "A" : "B"} wins!`))
      : tx("ぜんぶ見つけた！", "All pairs found!");
    status.replaceChildren(h("div", { class: "mmwin" }, icon("star"), msg), btn("reset", tx("もう一回", "Play again"), deal, "pill"));
  }
  const pairSeg = seg([[4, "4"], [6, "6"], [8, "8"]], pairs, v => { pairs = v; deal(); }, "small");
  const kindSeg = seg([["pp", tx("絵と絵", "Picture–picture")], ["pw", tx("絵と文字", "Picture–word")]], kind, v => { kind = v; deal(); }, "small");
  const teamSeg = seg([[0, tx("ひとり", "Solo")], [1, tx("2チーム", "2 teams")]], teams, v => { teams = v; deal(); }, "small");
  stage.append(h("div", { class: "wgame" }, picker.bar, h("div", { class: "mmwrap" }, grid),
    h("div", { class: "bbar" }, status, h("span", { class: "bsep" }), h("span", { class: "blabel" }, tx("ペア", "Pairs")), pairSeg, kindSeg, teamSeg,
      btn("reset", tx("くばりなおす", "New game"), deal, "pill ghost"))));
  deal();
  return () => stopAudio();
}
