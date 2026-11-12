// Mystery picture: a hidden picture is revealed a little at a time and the class guesses.
// Three ways to reveal: tiles (tap or pick at random), scratch (teacher rubs it away), zoom
// (starts as a close-up and zooms out). "Answer" shows it all with the word and its sound.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, pick } from "./common.js";
import { loadWords, setBar, card, say, tx, preloadWords } from "./words.js";

const TILE_COLORS = ["#f6cf4a", "#f08a3c", "#e2617f", "#8a63c9", "#3c9c94", "#2a8fd0", "#5bb35a"];

export async function mount(stage, { ctx }) {
  await loadWords();
  let deck = [], k = 0, mode = "tiles", brush = 2, cleanup = () => {};
  const box = h("div", { class: "mybox" });
  const pos = h("span", { class: "fcpos" });
  const answer = h("div", { class: "myanswer", hidden: true });
  const picker = setBar(ctx, w => { deck = shuffle(w); k = 0; preloadWords(deck); round(); });
  deck = shuffle(picker.words()); preloadWords(deck);

  function round() {
    cleanup(); cleanup = () => {};
    answer.hidden = true;
    const item = deck[k];
    pos.textContent = `${k + 1} / ${deck.length}`;
    const pic = card(item, { cls: "mypic" });
    box.replaceChildren(pic);
    box.dataset.mode = mode;
    if (mode === "tiles") tiles(); else if (mode === "scratch") scratch(); else zoom(pic);
    sizeSeg.hidden = mode !== "scratch";
    tileBtn.hidden = mode !== "tiles";
    zoomBtn.hidden = mode !== "zoom";
  }
  function tiles() {
    const cols = 4, rows = 3;
    const grid = h("div", { class: "mytiles", style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } });
    for (let n = 0; n < cols * rows; n++) {
      const t = h("button", { type: "button", class: "mytile", style: { background: TILE_COLORS[n % TILE_COLORS.length] } }, String(n + 1));
      t.onclick = () => t.classList.add("gone");
      grid.append(t);
    }
    box.append(grid);
  }
  function scratch() {
    const cv = h("canvas", { class: "myscratch" });
    box.append(cv);
    const ctx2 = cv.getContext("2d");
    const paint = () => {
      const r = box.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx2.createLinearGradient(0, 0, r.width, r.height);
      g.addColorStop(0, "#3c9c94"); g.addColorStop(1, "#2a8fd0");
      ctx2.fillStyle = g; ctx2.fillRect(0, 0, r.width, r.height);
      ctx2.fillStyle = "rgba(255,255,255,.18)"; ctx2.font = `700 ${Math.round(r.height * .5)}px Pook, sans-serif`;
      ctx2.textAlign = "center"; ctx2.textBaseline = "middle"; ctx2.fillText("?", r.width / 2, r.height / 2);
    };
    paint();
    let last = null;
    const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const rub = (x, y) => {
      const rad = [12, 24, 44][brush - 1] * Math.max(1, box.clientWidth / 600);
      ctx2.globalCompositeOperation = "destination-out";
      ctx2.beginPath();
      if (last) { ctx2.lineCap = "round"; ctx2.lineWidth = rad * 2; ctx2.moveTo(...last); ctx2.lineTo(x, y); ctx2.stroke(); }
      else { ctx2.arc(x, y, rad, 0, Math.PI * 2); ctx2.fill(); }
      last = [x, y];
    };
    cv.addEventListener("pointerdown", e => {
      cv.setPointerCapture(e.pointerId); last = null; rub(...at(e));
      const mv = ev => (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]).forEach(c => rub(...at(c)));
      const up = () => { cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); last = null; };
      cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up);
    });
  }
  let zoomLevel = 6;
  function zoom(pic) {
    zoomLevel = 6;
    const img = pic.querySelector("img, .wletter");
    if (!img) return;
    // aim at a busy part of the picture, not empty white space
    img.style.transformOrigin = `${30 + Math.random() * 40}% ${30 + Math.random() * 40}%`;
    img.style.transform = `scale(${zoomLevel})`;
    img.classList.add("zoomable");
  }
  function zoomOut() {
    const img = box.querySelector(".zoomable");
    if (!img) return;
    zoomLevel = Math.max(1, zoomLevel * 0.62);
    if (zoomLevel < 1.15) zoomLevel = 1;
    img.style.transform = `scale(${zoomLevel})`;
  }
  function reveal() {
    box.querySelectorAll(".mytile").forEach((t, n) => setTimeout(() => t.classList.add("gone"), n * 35));
    const cv = box.querySelector(".myscratch"); if (cv) cv.classList.add("wipe");
    const img = box.querySelector(".zoomable"); if (img) img.style.transform = "scale(1)";
    answer.replaceChildren(h("b", {}, deck[k].w));
    answer.hidden = false;
    say(deck[k]);
  }
  const modeSeg = seg([["tiles", tx("タイル", "Tiles")], ["scratch", tx("けずる", "Scratch")], ["zoom", tx("ズーム", "Zoom")]],
    mode, v => { mode = v; round(); }, "small");
  const sizeSeg = seg([[1, "S"], [2, "M"], [3, "L"]], brush, v => { brush = v; }, "small");
  const tileBtn = btn("dice", tx("1まいめくる", "Open a tile"), () => {
    const left = [...box.querySelectorAll(".mytile:not(.gone)")];
    if (left.length) pick(left).classList.add("gone");
  }, "pill ghost");
  const zoomBtn = btn("zoomreset", tx("ズームアウト", "Zoom out"), zoomOut, "pill ghost");
  const ansBtn = btn("eye", tx("こたえ", "Answer"), reveal, "pill");
  const nextBtn = btn("next", tx("つぎ", "Next"), () => { k = (k + 1) % deck.length; round(); }, "pill ghost");
  stage.append(h("div", { class: "wgame" }, picker.bar,
    h("div", { class: "mywrap" }, box, answer),
    h("div", { class: "bbar" }, pos, modeSeg, sizeSeg, tileBtn, zoomBtn, ansBtn, nextBtn)));
  round();
  return () => { cleanup(); stopAudio(); };
}
