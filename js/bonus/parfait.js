// Parfait maker (Let's Try! 2, Unit 7: "What do you want?" "I want strawberries, please.")
// Drag fruit from the tray into the glass and put it anywhere. Tap a piece to turn it round,
// drag it back to the tray to take it out. The sentence builds itself from what's in the glass.
// Orders: a customer asks for three things. Make it, then press Done.
import { h, icon } from "../ui.js";
import { stopAudio } from "../media.js";
import { btn, seg, shuffle, wait } from "./common.js";
import { loadWords, card, say, tx } from "./words.js";

const ART = "media/parfait/";
// word, art file, set the word's audio comes from, piece width in glass widths
const FRUIT = [
  ["strawberry", "strawberry", "fruitveg", .27], ["banana", "banana", "fruitveg", .32], ["kiwi fruit", "kiwi", "fruitveg", .32],
  ["peach", "peach", "fruitveg", .32], ["melon", "melon", "fruitveg", .38], ["cherry", "cherry", "fruitveg", .27],
  ["orange", "orange", "fruitveg", .36], ["pineapple", "pineapple", "fruitveg", .34], ["apple", "apple", "fruitveg", .4],
  ["ice cream", "icecream", "foods", .42],
];
const UNCOUNT = new Set(["ice cream", "melon", "pineapple"]);
const plural = w => UNCOUNT.has(w) ? w : w === "kiwi fruit" ? "kiwi fruit" : w.endsWith("y") ? w.slice(0, -1) + "ies" : w.endsWith("ch") ? w + "es" : w + "s";
const list = ws => ws.length <= 1 ? ws.join("") : ws.slice(0, -1).join(", ") + " and " + ws[ws.length - 1];
const MAX = 40;

export async function mount(stage) {
  const DATA = await loadWords();
  const fruits = FRUIT.map(([w, file, set, size]) => {
    const item = DATA.sets[set].words.find(x => x.w === w) || { w };
    return { w, file, size, item };
  });
  let mode = "make", pieces = [], order = [], served = 0, z = 1;

  const tray = h("div", { class: "pftray", title: tx("ここにもどすと消えるよ", "Drag a piece back here to take it out") });
  const back = h("img", { class: "pfback", src: ART + "glass.webp", alt: "", draggable: "false" });
  const tint = h("img", { class: "pftint", src: ART + "glass.webp", alt: "", draggable: "false" });
  const box = h("div", { class: "pfbox" }, back, tint);
  const scene = h("div", { class: "pfscene" }, box);
  const sentence = h("div", { class: "pcsay" });
  const ticket = h("div", { class: "pfticket" });

  // Pointer position as a fraction of the glass box (0..1 across the glass; can go above it).
  const rel = e => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const overTray = e => { const r = tray.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const inScene = e => { const r = scene.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  const clampPos = (x, y) => {
    const s = scene.getBoundingClientRect(), b = box.getBoundingClientRect();
    return [Math.min(Math.max(x, (s.left - b.left) / b.width + .04), (s.right - b.left) / b.width - .04),
            Math.min(Math.max(y, (s.top - b.top) / b.height + .05), 1)];
  };

  function place(p) {
    p.el.style.left = p.x * 100 + "%";
    p.el.style.top = p.y * 100 + "%";
    p.el.style.zIndex = p.z;
    p.el.style.setProperty("--r", p.r + "deg");
    p.img.src = `${ART}${p.f.file}-${p.side}.webp`;
  }
  function spawn(f, x, y) {
    if (pieces.length >= MAX) return null;
    const img = h("img", { alt: f.w, draggable: "false" });
    const el = h("div", { class: "pfpiece", style: { width: f.size * 100 + "%" } }, img);
    const p = { f, el, img, x, y, z: ++z, r: Math.round(Math.random() * 16 - 8), side: f.flip ? "right" : "left" };
    f.flip = !f.flip;                                   // alternate left / right pieces, like the textbook
    pieces.push(p);
    box.insertBefore(el, tint);
    place(p);
    el.addEventListener("pointerdown", e => grab(e, p, false));
    return p;
  }
  function remove(p) {
    pieces = pieces.filter(q => q !== p);
    p.el.classList.add("gone");
    setTimeout(() => p.el.remove(), 220);
    talk();
  }

  // One drag handler for new pieces (from the tray) and pieces already in the glass.
  function grab(e, p, fresh) {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    const [sx, sy] = [e.clientX, e.clientY];
    const [px, py] = rel(e);
    const off = fresh ? [0, 0] : [p.x - px, p.y - py];
    let moved = false;
    if (!fresh) { p.z = ++z; place(p); }
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      if (!moved) {
        moved = true;
        if (fresh) p = spawn(p, ...rel(ev));            // p is the fruit until the first move
        if (!p) return end();
        p.el.classList.add("held");
      }
      const [x, y] = rel(ev);
      p.x = x + off[0]; p.y = y + off[1];
      p.el.classList.toggle("bin", overTray(ev) || !inScene(ev));
      place(p);
    };
    const up = ev => {
      end();
      if (!moved) {
        if (fresh) drop(p);                                // tap a fruit: it falls into the glass
        else { p.side = p.side === "left" ? "right" : "left"; p.el.classList.remove("flip"); void p.el.offsetWidth; p.el.classList.add("flip"); place(p); }
        return;
      }
      if (!p) return;
      p.el.classList.remove("held", "bin");
      if (overTray(ev) || !inScene(ev)) return remove(p);
      [p.x, p.y] = clampPos(p.x, p.y);
      place(p);
      talk();
    };
    function end() {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }
  // Tapped fruit: drop it onto the pile in the bowl.
  function drop(f) {
    const inBowl = pieces.filter(q => q.y < .78).length;
    const y = Math.max(.02, .52 - inBowl * .07);
    const x = .5 + (Math.random() - .5) * Math.min(.55, .12 + (.52 - y) * 1.2);
    const p = spawn(f, x, y);
    if (!p) return;
    p.el.classList.add("fall");
    talk();
  }

  function drawTray() {
    tray.replaceChildren(...fruits.map(f => {
      const b = h("button", { type: "button", class: "pffruit", "aria-label": f.w },
        h("img", { src: `${ART}${f.file}-left.webp`, alt: "", draggable: "false" }), h("span", {}, f.w));
      b.addEventListener("pointerdown", e => { say(f.item, b); grab(e, f, true); });
      return b;
    }));
  }
  const inGlass = () => [...new Set(pieces.map(p => p.f.w))];
  function talk() {
    if (mode !== "make") return;
    const ws = inGlass();
    sentence.replaceChildren(ws.length
      ? h("b", {}, `I want ${list(ws.map(plural))}, please.`)
      : h("span", {}, tx("くだものをグラスにドラッグしよう（タップでも入るよ）", "Drag fruit into the glass, or tap it to drop it in.")));
  }
  function empty() { pieces.forEach(p => p.el.remove()); pieces = []; talk(); }

  function newOrder() {
    order = shuffle(fruits).slice(0, 3);
    empty();
    ticket.replaceChildren(
      h("div", { class: "pfwho" }, icon("smile"), tx(`お客さん ${served + 1}`, `Customer ${served + 1}`)),
      h("b", {}, `I want ${list(order.map(f => plural(f.w)))}, please.`),
      h("div", { class: "pforder" }, order.map(f => h("button", { type: "button", class: "pfo", onclick: e => say(f.item, e.currentTarget) },
        h("img", { src: `${ART}${f.file}-left.webp`, alt: "" }), h("span", {}, f.w)))));
    sentence.replaceChildren(h("span", {}, tx("注文どおりに作ったら「できた！」", "Make the order, then press Done.")));
  }
  async function check() {
    const want = new Set(order.map(f => f.w)), got = new Set(inGlass());
    const ok = want.size === got.size && [...want].every(w => got.has(w));
    if (ok) {
      served++;
      sentence.replaceChildren(h("b", { class: "ok" }, "Here you are! ★"), h("span", {}, "Thank you!"));
      scene.classList.add("party");
      await wait(1600);
      scene.classList.remove("party");
      if (mode === "order") newOrder();
    } else {
      const missing = [...want].filter(w => !got.has(w)), extra = [...got].filter(w => !want.has(w));
      sentence.replaceChildren(h("b", { class: "ng" }, tx("ちょっとちがうよ", "Not quite!")),
        h("span", {}, [missing.length ? tx(`たりない: ${missing.join(", ")}`, `Missing: ${missing.join(", ")}`) : "",
          extra.length ? tx(`いらない: ${extra.join(", ")}`, `Not ordered: ${extra.join(", ")}`) : ""].join("  ")));
    }
  }
  function start() {
    served = 0;
    ticket.hidden = mode !== "order"; doneBtn.hidden = mode !== "order";
    root.classList.toggle("ordering", mode === "order");
    if (mode === "order") newOrder(); else empty();
  }
  const doneBtn = btn("check", tx("できた！", "Done"), check, "pill");
  const modeSeg = seg([["make", tx("つくろう", "Make")], ["order", tx("ちゅうもん", "Orders")]], mode, v => { mode = v; start(); }, "small");
  const root = h("div", { class: "wgame pfgame" },
    h("div", { class: "pfwrap" }, tray, scene, ticket, sentence),
    h("div", { class: "bbar" }, modeSeg, doneBtn, btn("trash", tx("からにする", "Empty the glass"), () => { empty(); if (mode === "order") sentence.replaceChildren(h("span", {}, tx("注文どおりに作ったら「できた！」", "Make the order, then press Done."))); }, "pill ghost")));
  stage.append(root);
  drawTray(); start();
  return () => stopAudio();
}
