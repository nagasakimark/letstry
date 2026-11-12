// Shared pieces for the vocabulary games: word data, picture cards, sounds and the word-set picker.
// A unit opens its games with its own word set already chosen; the picker lets the teacher
// switch to another of the unit's sets, browse any unit, combine sets, or leave words out.
import { h, icon } from "../ui.js";
import { getLang } from "../i18n.js";
import { playAudio } from "../media.js";

let DATA = null;
export async function loadWords() {
  DATA ||= await fetch("data/words.json").then(r => r.json());
  return DATA;
}
export const tx = (ja, en) => getLang() === "ja" ? ja : en;
export const setName = id => DATA.sets[id] ? tx(DATA.sets[id].ja, DATA.sets[id].en) : id;
const BOOKS = [["lt1", "Let's Try! 1"], ["lt2", "Let's Try! 2"]];

// The sets a unit starts with (its first set is selected)
export function unitSets(ctx) {
  const u = ctx && DATA.units[ctx.book] && DATA.units[ctx.book][ctx.unit];
  return u && u.length ? u : ["animals"];
}

// selection: { sets: [ids], off: Set("set|word") } -> the words in play (no duplicates)
export function wordsOf(sel) {
  const seen = new Set(), out = [];
  for (const id of sel.sets) for (const w of DATA.sets[id].words) {
    if (sel.off.has(id + "|" + w.w) || seen.has(w.w)) continue;
    seen.add(w.w); out.push({ ...w, set: id });
  }
  return out;
}

// A picture card. Letters are drawn in Pook; words without a picture yet get a clear placeholder.
export function card(item, { word = false, cls = "" } = {}) {
  let face;
  if (item.letter) face = h("span", { class: "wletter" }, item.w);
  else if (item.img) face = h("img", { src: item.img, alt: item.w, draggable: "false" });
  else face = h("span", { class: "wmissing" }, icon("photo"), h("small", {}, tx("絵を準備中", "Picture coming")));
  return h("div", { class: "wcard " + cls + (item.img || item.letter ? "" : " noimg") },
    h("div", { class: "wpic" }, face),
    word || !(item.img || item.letter) ? h("div", { class: "wword" }, item.w) : null);
}
export const say = (item, el) => item && item.audio && playAudio(item.audio, el || null, { showBar: false });

export function preloadWords(items) {
  items.forEach(w => { if (w.img) { const i = new Image(); i.src = w.img; } });
}

// ---------------------------------------------------------------- the picker
// Returns a bar element: quick chips for the unit's sets + a "More" button that opens the full picker.
export function setBar(ctx, onChange, { min = 2 } = {}) {
  const own = unitSets(ctx);
  const sel = { sets: [own[0]], off: new Set() };
  const bar = h("div", { class: "wsetbar" });
  const count = h("span", { class: "wcount" });
  const draw = () => {
    const extra = sel.sets.filter(id => !own.includes(id));
    bar.replaceChildren(
      ...own.map(id => {
        const b = h("button", { class: "wchip", type: "button", "aria-pressed": String(sel.sets.includes(id)) }, setName(id));
        b.onclick = () => {
          // a tap chooses just that set; the picker is for combining
          sel.sets = [id]; sel.off.clear(); changed();
        };
        return b;
      }),
      ...extra.map(id => h("span", { class: "wchip on extra" }, setName(id))),
      h("button", { class: "wchip more", type: "button", onclick: openPicker }, icon("list"), tx("ことばをえらぶ", "Choose words")),
      count);
    count.textContent = tx(`${wordsOf(sel).length}語`, `${wordsOf(sel).length} words`);
  };
  const changed = () => { draw(); onChange(wordsOf(sel)); };

  function openPicker() {
    let book = ctx ? ctx.book : "lt1", unit = ctx ? ctx.unit : 1;
    const work = { sets: [...sel.sets], off: new Set(sel.off) };
    const panel = h("div", { class: "wpicker", role: "dialog", "aria-label": tx("ことばをえらぶ", "Choose words") });
    const close = () => panel.remove();
    function render() {
      const tabs = h("div", { class: "seg small" }, BOOKS.map(([id, name]) =>
        h("button", { type: "button", "aria-pressed": String(id === book), onclick: () => { book = id; unit = 1; render(); } }, name)));
      const units = h("div", { class: "wunits" }, Object.keys(DATA.units[book]).map(n =>
        h("button", { type: "button", class: "wunit", "aria-pressed": String(+n === +unit),
          onclick: () => { unit = +n; render(); } }, n)));
      const sets = h("div", { class: "wsets" }, DATA.units[book][unit].map(id => {
        const on = work.sets.includes(id);
        const thumbs = DATA.sets[id].words.slice(0, 4).map(w => w.letter ? h("b", {}, w.w) : w.img ? h("img", { src: w.img, alt: "" }) : h("i"));
        const b = h("button", { type: "button", class: "wset", "aria-pressed": String(on) },
          h("span", { class: "wthumbs" }, thumbs),
          h("span", { class: "wsetname" }, setName(id)), h("small", {}, tx(`${DATA.sets[id].words.length}語`, `${DATA.sets[id].words.length} words`)),
          h("span", { class: "wtick" }, icon("check")));
        b.onclick = () => {
          if (on) { if (work.sets.length > 1) work.sets = work.sets.filter(x => x !== id); }
          else work.sets.push(id);
          render();
        };
        return b;
      }));
      const list = wordsOfAll(work);
      const words = h("div", { class: "wlist" }, list.map(({ id, w }) => {
        const key = id + "|" + w.w, on = !work.off.has(key);
        const b = h("button", { type: "button", class: "wtoggle", "aria-pressed": String(on) },
          w.letter ? h("b", {}, w.w) : w.img ? h("img", { src: w.img, alt: "" }) : h("i", {}, "?"), h("span", {}, w.w));
        b.onclick = () => { on ? work.off.add(key) : work.off.delete(key); render(); };
        return b;
      }));
      const n = wordsOf(work).length;
      const done = h("button", { class: "pill", type: "button", disabled: n < min || null, onclick: () => {
        sel.sets = work.sets; sel.off = work.off; close(); changed();
      } }, icon("check"), tx(`この${n}語であそぶ`, `Play with ${n} words`));
      panel.replaceChildren(
        h("div", { class: "wphead" }, h("h3", {}, tx("ことばをえらぶ", "Choose words")), tabs,
          h("button", { class: "ib", type: "button", "aria-label": tx("とじる", "Close"), onclick: close }, icon("close"))),
        h("div", { class: "wpbody" },
          h("div", { class: "wpcol" }, h("div", { class: "wplabel" }, "Unit"), units, sets),
          h("div", { class: "wpcol words" }, h("div", { class: "wplabel" }, tx("ことば（タップで外す）", "Words (tap to leave out)")), words)),
        h("div", { class: "wpfoot" }, n < min ? h("span", { class: "wwarn" }, tx(`${min}語以上えらんでください`, `Choose at least ${min} words`)) : null, done));
    }
    render();
    bar.closest(".bonus").append(panel);
  }
  const wordsOfAll = s => s.sets.flatMap(id => DATA.sets[id].words.map(w => ({ id, w })));
  draw();
  return { bar, sel, words: () => wordsOf(sel), refresh: changed };
}
