// Getting around: a little map of rooms (school) or places (town) on a grid of corridors/streets.
// Drive the walker with "Go straight", "Turn left", "Turn right" (buttons or arrow keys).
// Practice: every place is visible; walking into one says its name.
// Treasure: something is hidden in one place; walk in to look.
// Secret: places are hidden behind numbers and revealed as you walk in.
import { h, icon } from "../ui.js";
import { playAudio, stopAudio } from "../media.js";
import { btn, seg, shuffle, pick } from "./common.js";
import { loadWords, tx } from "./words.js";

const COLS = 4, ROWS = 3;
const ROAD = 64, BW = 196, BH = 158, STUB = 84;
const pos = (i, road, block) => Math.floor(i / 2) * (road + block) + (i % 2 ? road : 0);
const span = (i, road, block) => i % 2 ? block : road;
const cx = i => pos(i, ROAD, BW) + span(i, ROAD, BW) / 2;
const cy = i => i > 2 * ROWS ? pos(2 * ROWS, ROAD, BH) + ROAD + STUB / 2 : pos(i, ROAD, BH) + span(i, ROAD, BH) / 2;
const W = pos(2 * COLS, ROAD, BW) + ROAD, H = pos(2 * ROWS, ROAD, BH) + ROAD + STUB;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];               // N E S W
const START = { x: COLS, y: 2 * ROWS + 1, d: 0 };            // below the bottom street, facing north
const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.append(...kids); return e; };

export async function mount(stage) {
  const DATA = await loadWords();
  let set = "school", mode = "practice", me = { ...START }, places = [], treasure = -1, moving = false;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "gamap", role: "img" });
  const msg = h("div", { class: "gamsg" });

  function build() {
    const list = DATA.places[set];
    const start = set === "school" ? list.find(p => p.w === "entrance") : list[list.length - 1];
    let rooms = list.filter(p => p !== start).slice(0, COLS * ROWS);
    rooms = shuffle(rooms);
    while (rooms.length < COLS * ROWS) rooms.splice(Math.floor(Math.random() * rooms.length), 0, null);   // a garden fills any gap
    places = rooms.map((p, i) => ({ p, c: i % COLS, r: Math.floor(i / COLS), seen: false }));
    treasure = mode === "treasure" ? pick(places.map((x, i) => x.p ? i : -1).filter(i => i >= 0)) : -1;
    me = { ...START };
    draw(start);
    say(mode === "secret" ? tx("番号の場所に行ってみよう", "Walk into a numbered place to see what it is.")
      : mode === "treasure" ? tx("たからものはどこ？道を案内しよう", "Where is the treasure? Give directions to find it.")
      : tx("道を案内しよう：Go straight. Turn left. Turn right.", "Give directions: Go straight. Turn left. Turn right."));
  }
  function draw(start) {
    svg.replaceChildren();
    // ground and streets
    svg.append(s("rect", { x: 0, y: 0, width: W, height: H, rx: 26, class: "gaground" }));
    for (let x = 0; x <= 2 * COLS; x += 2) svg.append(s("rect", { x: pos(x, ROAD, BW), y: 0, width: ROAD, height: pos(2 * ROWS, ROAD, BH) + ROAD, class: "garoad" }));
    for (let y = 0; y <= 2 * ROWS; y += 2) svg.append(s("rect", { x: 0, y: pos(y, ROAD, BH), width: W, height: ROAD, class: "garoad" }));
    svg.append(s("rect", { x: cx(START.x) - ROAD / 2, y: pos(2 * ROWS, ROAD, BH) + ROAD, width: ROAD, height: STUB, class: "garoad" }));
    // centre lines
    for (let y = 0; y <= 2 * ROWS; y += 2) svg.append(s("line", { x1: 0, x2: W, y1: cy(y), y2: cy(y), class: "galine" }));
    for (let x = 0; x <= 2 * COLS; x += 2) svg.append(s("line", { x1: cx(x), x2: cx(x), y1: 0, y2: pos(2 * ROWS, ROAD, BH) + ROAD, class: "galine" }));
    // places
    places.forEach((pl, i) => {
      const x = pos(2 * pl.c + 1, ROAD, BW) + 8, y = pos(2 * pl.r + 1, ROAD, BH) + 8, w = BW - 16, hh = BH - 16;
      const g = s("g", { class: "gaplace", "data-i": i });
      if (!pl.p) {
        g.append(s("rect", { x, y, width: w, height: hh, rx: 18, class: "gagarden" }),
          ...[0.25, 0.5, 0.75].map((f, k) => s("circle", { cx: x + w * f, cy: y + hh * (k % 2 ? .4 : .62), r: 22, class: "gatree" })));
      } else {
        const hidden = mode === "secret" && !pl.seen;
        g.append(s("rect", { x, y, width: w, height: hh, rx: 18, class: "gacard" }));
        if (hidden) {
          g.append(s("text", { x: x + w / 2, y: y + hh / 2 + 22, class: "ganum" }, String(i + 1)));
        } else {
          g.append(s("image", { href: pl.p.img, x: x + 10, y: y + 6, width: w - 20, height: hh - 38, preserveAspectRatio: "xMidYMid meet" }),
            s("text", { x: x + w / 2, y: y + hh - 12, class: "galabel" }, pl.p.w));
        }
        if (mode === "treasure" && pl.seen) g.append(s("g", { class: "gamark " + (i === treasure ? "yes" : "no") },
          s("circle", { cx: x + w - 22, cy: y + 22, r: 18 }), s("text", { x: x + w - 22, y: y + 30 }, i === treasure ? "★" : "✕")));
        g.addEventListener("click", () => { if (mode === "practice") speak(pl); });
      }
      svg.append(g);
    });
    // where we start
    if (start) {
      const sx = cx(START.x), sy = pos(2 * ROWS, ROAD, BH) + ROAD + STUB / 2;
      svg.append(s("g", { class: "gastart" }, s("rect", { x: sx + ROAD / 2 + 10, y: sy - 34, width: 176, height: 68, rx: 14, class: "gacard" }),
        s("image", { href: start.img, x: sx + ROAD / 2 + 16, y: sy - 29, width: 58, height: 58 }),
        s("text", { x: sx + ROAD / 2 + 84, y: sy + 7, class: "galabel small", style: "text-anchor:start" }, "START")));
    }
    // the walker
    svg.append(s("g", { class: "gawalker", id: "walker" },
      s("circle", { r: 24, class: "gawbody" }), s("path", { d: "M0 -17 11 6 0 1 -11 6Z", class: "gawarrow" })));
    place(false);
  }
  function place(anim = true) {
    const w = svg.querySelector("#walker");
    w.classList.toggle("anim", anim);
    w.style.transform = `translate(${cx(me.x)}px, ${cy(me.y)}px) rotate(${me.rot ?? me.d * 90}deg)`;
  }
  const isRoad = (x, y) => (x === START.x && y === START.y) || (x >= 0 && y >= 0 && x <= 2 * COLS && y <= 2 * ROWS && (x % 2 === 0 || y % 2 === 0));
  function straight() {
    if (moving) return;
    const [dx, dy] = DIRS[me.d], nx = me.x + dx, ny = me.y + dy;
    if (isRoad(nx, ny)) { me.x = nx; me.y = ny; bump(); place(); return; }
    // walking into a building
    if (nx % 2 === 1 && ny % 2 === 1 && ny <= 2 * ROWS) {
      const i = Math.floor(ny / 2) * COLS + Math.floor(nx / 2);
      enter(i); return;
    }
    nudge();
  }
  function turn(dir) {
    if (moving) return;
    const prev = me.rot ?? me.d * 90;      // keep turning the short way round
    me.d = (me.d + dir + 4) % 4;
    me.rot = prev + dir * 90;
    place();
  }
  function enter(i) {
    const pl = places[i];
    if (!pl.p) { say(tx("ここは庭です", "That's a garden.")); nudge(); return; }
    pl.seen = true;
    draw(startOf());
    const g = svg.querySelector(`.gaplace[data-i="${i}"]`);
    g.classList.add("enter");
    if (mode === "treasure") {
      if (i === treasure) { say(tx("みつけた！ ★", "You found the treasure! ★"), "win"); playAudio(pl.p.audio, null, { showBar: false }); }
      else { say(tx(`${pl.p.w} … ここにはないよ`, `${pl.p.w}: no treasure here.`)); speak(pl); }
    } else speak(pl);
  }
  const startOf = () => { const list = DATA.places[set]; return set === "school" ? list.find(p => p.w === "entrance") : list[list.length - 1]; };
  function speak(pl) { if (pl.p.audio) playAudio(pl.p.audio, null, { showBar: false }); if (mode !== "treasure") say(`“${pl.p.w}”`); }
  function say(text, cls = "") { msg.className = "gamsg " + cls; msg.textContent = text; }
  function bump() { moving = true; setTimeout(() => moving = false, 180); }
  function nudge() { const w = svg.querySelector("#walker"); w.classList.remove("no"); void w.getBBox(); w.classList.add("no"); }

  const key = e => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowUp") { e.preventDefault(); straight(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
  };
  addEventListener("keydown", key);
  const ctl = h("div", { class: "gactl" },
    h("button", { class: "gabtn", type: "button", onclick: () => turn(-1) }, h("span", { class: "gaic l" }, icon("replay")), "Turn left"),
    h("button", { class: "gabtn main", type: "button", onclick: straight }, h("span", { class: "gaic" }, icon("left")), "Go straight"),
    h("button", { class: "gabtn", type: "button", onclick: () => turn(1) }, h("span", { class: "gaic r" }, icon("replay")), "Turn right"));
  const setSeg = seg([["school", tx("学校", "School")], ["town1", tx("町 1", "Town 1")], ["town2", tx("町 2", "Town 2")]], set, v => { set = v; build(); }, "small");
  const modeSeg = seg([["practice", tx("れんしゅう", "Practice")], ["treasure", tx("たからさがし", "Treasure")], ["secret", tx("ひみつ", "Secret")]], mode, v => { mode = v; build(); }, "small");
  stage.append(h("div", { class: "gagame" },
    h("div", { class: "gamapwrap" }, svg),
    h("div", { class: "gaside" }, msg, ctl,
      h("div", { class: "gaopts" }, setSeg, modeSeg,
        btn("reset", tx("スタートにもどる", "Back to start"), () => { me = { ...START }; place(); }, "pill ghost"),
        btn("dice", tx("ならべかえ", "New map"), build, "pill ghost")))));
  build();
  return () => { removeEventListener("keydown", key); stopAudio(); };
}
