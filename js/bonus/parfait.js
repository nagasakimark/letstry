// Parfait shop (Let's Try! 2, Unit 7: "What do you want?" "I want strawberries, please.")
// Make: build your own parfait, layer by layer; the sentence builds itself.
// Order: a customer asks for three things. Make it, then check.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, wait } from "./common.js";
import { loadWords, card, say, tx } from "./words.js";

const FRUIT = ["strawberry", "banana", "kiwi fruit", "peach", "melon", "cherry", "orange", "pineapple", "grapes", "apple", "watermelon"];
const TOP = ["ice cream", "chocolate", "pudding", "nut"];
const UNCOUNT = new Set(["ice cream", "chocolate", "pudding", "melon", "watermelon", "pineapple", "grapes"]);
const plural = w => UNCOUNT.has(w) ? w : w.endsWith("y") ? w.slice(0, -1) + "ies" : w.endsWith("ch") ? w + "es" : w + "s";
const list = ws => ws.length <= 1 ? ws.join("") : ws.slice(0, -1).join(", ") + " and " + ws[ws.length - 1];
const MAX = 6;

export async function mount(stage) {
  const DATA = await loadWords();
  const find = (set, w) => DATA.sets[set].words.find(x => x.w === w);
  const things = [...FRUIT.map(w => find("fruitveg", w)), ...TOP.map(w => find("foods", w))].filter(Boolean);
  let mode = "make", layers = [], order = [], served = 0, stars = 0;
  const shelf = h("div", { class: "pfshelf" });
  const glass = h("div", { class: "pfglass" });
  const sentence = h("div", { class: "pcsay" });
  const ticket = h("div", { class: "pfticket" });

  function drawShelf() {
    shelf.replaceChildren(...things.map(w => {
      const b = h("button", { type: "button", class: "pcitem" }, card(w));
      b.onclick = () => add(w, b);
      return b;
    }));
  }
  function drawGlass() {
    glass.replaceChildren(
      h("div", { class: "pfcup" },
        h("div", { class: "pflayers" }, layers.map((w, i) => {
          const L = h("button", { type: "button", class: "pflayer", title: tx("タップで取る", "Tap to take out"), style: { "--i": i } },
            ...[0, 1, 2].map(() => w.img ? h("img", { src: w.img, alt: "" }) : h("span", {}, w.w)));
          L.onclick = () => { layers.splice(i, 1); drawGlass(); talk(); };
          return L;
        })),
        h("div", { class: "pfshine" })),
      h("div", { class: "pfstem" }), h("div", { class: "pffoot" }));
  }
  function add(w, b) {
    say(w, b);
    if (layers.length >= MAX) { glass.classList.remove("full"); void glass.offsetWidth; glass.classList.add("full"); return; }
    layers.push(w);
    drawGlass(); talk();
  }
  const uniq = ws => [...new Set(ws.map(x => x.w))];
  function talk() {
    if (mode === "make") {
      sentence.replaceChildren(layers.length
        ? h("b", {}, `I want ${list(uniq(layers).map(plural))}, please.`)
        : h("span", {}, tx("タップしてパフェに入れよう", "Tap things to add them to the parfait.")));
    }
  }
  function newOrder() {
    order = shuffle(things).slice(0, 3);
    layers = [];
    ticket.replaceChildren(
      h("div", { class: "pfwho" }, icon("smile"), tx(`お客さん ${served + 1}`, `Customer ${served + 1}`)),
      h("b", {}, `I want ${list(order.map(x => plural(x.w)))}, please.`),
      h("div", { class: "pforder" }, order.map(w => card(w, { word: true }))));
    sentence.replaceChildren(h("span", {}, tx("注文どおりに作ったら「できた！」", "Make the order, then press Done.")));
    drawGlass();
  }
  async function check() {
    const want = new Set(order.map(x => x.w)), got = new Set(layers.map(x => x.w));
    const ok = want.size === got.size && [...want].every(w => got.has(w));
    if (ok) {
      served++; stars++;
      sentence.replaceChildren(h("b", { class: "ok" }, "Here you are! ★"), h("span", {}, "Thank you!"));
      glass.classList.add("party");
      await wait(1600);
      glass.classList.remove("party");
      newOrder();
    } else {
      const missing = [...want].filter(w => !got.has(w)), extra = [...got].filter(w => !want.has(w));
      sentence.replaceChildren(h("b", { class: "ng" }, tx("ちょっとちがうよ", "Not quite!")),
        h("span", {}, [missing.length ? tx(`たりない: ${missing.join(", ")}`, `Missing: ${missing.join(", ")}`) : "",
          extra.length ? tx(`  いらない: ${extra.join(", ")}`, `  Not ordered: ${extra.join(", ")}`) : ""].join(" ")));
    }
  }
  function start() {
    layers = []; served = 0;
    ticket.hidden = mode !== "order"; doneBtn.hidden = mode !== "order";
    if (mode === "order") newOrder(); else { drawGlass(); talk(); }
  }
  const doneBtn = btn("check", tx("できた！", "Done"), check, "pill");
  const modeSeg = seg([["make", tx("つくろう", "Make")], ["order", tx("ちゅうもん", "Orders")]], mode, v => { mode = v; start(); }, "small");
  stage.append(h("div", { class: "wgame pfgame" },
    h("div", { class: "pcwrap" }, shelf, h("div", { class: "pfright" }, ticket, glass, sentence)),
    h("div", { class: "bbar" }, modeSeg, doneBtn, btn("trash", tx("からにする", "Empty the glass"), () => { layers = []; drawGlass(); talk(); }, "pill ghost"))));
  drawShelf(); start();
  return () => stopAudio();
}
