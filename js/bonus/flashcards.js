// Flashcards: one big card at a time. Tap the card to hear it; choose what shows
// (picture + word, picture only, word only); step with the arrows/keys or let it play itself.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle } from "./common.js";
import { loadWords, setBar, card, say, tx, preloadWords } from "./words.js";

export async function mount(stage, { ctx }) {
  await loadWords();
  let list = [], i = 0, show = "both", auto = null, autoSound = true;
  const holder = h("div", { class: "fcstage" });
  const dots = h("div", { class: "fcdots" });
  const pos = h("span", { class: "fcpos" });
  const prev = h("button", { class: "fcnav l", type: "button", "aria-label": tx("まえ", "Previous"), onclick: () => go(-1) }, icon("left"));
  const next = h("button", { class: "fcnav r", type: "button", "aria-label": tx("つぎ", "Next"), onclick: () => go(1) }, icon("right"));
  const picker = setBar(ctx, w => { list = w; i = 0; preloadWords(list); draw(0); });
  list = picker.words(); preloadWords(list);

  function draw(dir) {
    stopAuto(false);
    const item = list[i];
    const c = card(item, { word: show !== "pic", cls: "fc big show-" + show });
    c.classList.add(dir > 0 ? "in-r" : dir < 0 ? "in-l" : "in");
    c.onclick = () => { say(item, c); c.classList.remove("tap"); void c.offsetWidth; c.classList.add("tap"); };
    holder.replaceChildren(prev, c, next);
    pos.textContent = `${i + 1} / ${list.length}`;
    dots.replaceChildren(...list.map((_, k) => h("i", { class: k === i ? "on" : "" })));
    if (autoSound && dir !== 0) say(item, c);
  }
  function go(d) { if (!list.length) return; i = (i + d + list.length) % list.length; draw(d); }

  const showSeg = seg([["both", tx("絵と文字", "Picture + word")], ["pic", tx("絵だけ", "Picture")], ["word", tx("文字だけ", "Word")]],
    show, v => { show = v; draw(0); }, "small");
  const shuf = btn("dice", tx("シャッフル", "Shuffle"), () => { list = shuffle(list); i = 0; draw(0); }, "pill ghost");
  const play = btn("play", tx("自動", "Auto"), () => auto ? stopAuto() : startAuto(), "pill ghost");
  const soundBtn = h("button", { class: "pill ghost", type: "button", "aria-pressed": "true", title: tx("めくるときに音声", "Say each card") }, icon("speaker"));
  soundBtn.onclick = () => { autoSound = !autoSound; soundBtn.setAttribute("aria-pressed", String(autoSound)); };
  function startAuto() {
    play.replaceChildren(icon("pause"), tx("とめる", "Stop"));
    auto = setInterval(() => { i = (i + 1) % list.length; const keep = auto; auto = null; draw(1); auto = keep; }, 3200);
  }
  function stopAuto(reset = true) {
    if (!auto) return;
    if (reset) { clearInterval(auto); auto = null; play.replaceChildren(icon("play"), tx("自動", "Auto")); }
  }
  const key = e => {
    if (e.target.closest("input, textarea, .wpicker")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === " ") { e.preventDefault(); say(list[i]); }
  };
  addEventListener("keydown", key);
  stage.append(h("div", { class: "wgame" }, picker.bar, h("div", { class: "fcwrap" }, holder, dots),
    h("div", { class: "bbar" }, pos, showSeg, shuf, play, soundBtn)));
  draw(0);
  return () => { removeEventListener("keydown", key); clearInterval(auto); stopAudio(); };
}
