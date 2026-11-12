// Let's Try! digital textbook — app shell and routing
//   #/                 home
//   #/lt1              contents of Let's Try! 1
//   #/lt1/3/2          unit 3, page 2
//   #/stories/autumn   storybook
import { $, h, icon, tbtn, preload, toast } from "./ui.js";
import { renderScreen } from "./viewer.js";
import { stopAudio } from "./media.js";
import { closeAll, layerCount, onLayersChange } from "./layers.js";
import { pen, setPen, COLORS, SIZES, undo, clearInk, hasInk } from "./pen.js";
import { flipbook } from "./flipbook.js";

const view = $("#view"), tray = $("#tray");
const cache = {};
async function load(name) {
  cache[name] ||= fetch(`data/${name}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  return cache[name];
}
const BOOKS = { lt1: { color: "#e8502e", grade: "3年生" }, lt2: { color: "#1f8fd1", grade: "4年生" } };
let current = { destroy: null };

function setView(node, trayItems) {
  current.destroy && current.destroy();
  current = { destroy: null };
  closeAll();
  stopAudio();
  view.replaceChildren(node);
  tray.replaceChildren(...trayItems);
}

// ------------------------------------------------------------------ tray parts
const fsBtn = () => {
  const b = tbtn(document.fullscreenElement ? "unfull" : "full", "Full screen", () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener("fullscreenchange", () => b.replaceChildren(icon(document.fullscreenElement ? "unfull" : "full")));
  return b;
};
const sep = () => h("span", { class: "sep" });
const spacer = () => h("span", { class: "spacer" });

function penControls() {
  const toggle = tbtn("pen", "Pen", () => setPen({ on: !pen.on }), { showLabel: true });
  const chalks = h("div", { class: "chalks", role: "group", "aria-label": "Pen colour" },
    COLORS.map(([c, name]) => {
      const b = h("button", { class: "chalk", type: "button", title: name, "aria-label": name, style: { "--c": c } });
      b.style.setProperty("--c", c);
      b.onclick = () => setPen({ on: true, color: c, tool: pen.tool === "eraser" ? "pen" : pen.tool });
      return b;
    }));
  const sizeBtn = h("button", { class: "tbtn", type: "button", title: "Line size", "aria-label": "Line size", onclick: () => setPen({ size: (pen.size + 1) % SIZES.length }) });
  const markerBtn = tbtn("marker", "Highlighter", () => setPen({ on: true, tool: pen.tool === "marker" ? "pen" : "marker" }));
  const eraseBtn = tbtn("eraser", "Eraser (tap a line)", () => setPen({ on: true, tool: pen.tool === "eraser" ? "pen" : "eraser" }));
  const undoBtn = tbtn("undo", "Undo", undo);
  const clearBtn = tbtn("trash", "Clear drawing", () => { clearInk(); toast("けしました"); });
  const tools = h("div", { class: "pen-tools" }, chalks, sizeBtn, markerBtn, eraseBtn, undoBtn, clearBtn);
  const sync = () => {
    toggle.setAttribute("aria-pressed", pen.on);
    toggle.replaceChildren(icon(pen.on ? "hand" : "pen"), h("span", { class: "lbl" }, pen.on ? "Done" : "Pen"));
    toggle.title = pen.on ? "Stop drawing" : "Draw on the page";
    tools.hidden = !pen.on;
    chalks.querySelectorAll(".chalk").forEach((b, i) => b.setAttribute("aria-pressed", String(pen.tool !== "eraser" && COLORS[i][0] === pen.color)));
    sizeBtn.replaceChildren(h("span", { class: "size-dot", style: { "--s": [6, 11, 18][pen.size] + "px" } }));
    sizeBtn.firstChild.style.setProperty("--s", [6, 11, 18][pen.size] + "px");
    markerBtn.setAttribute("aria-pressed", pen.tool === "marker");
    eraseBtn.setAttribute("aria-pressed", pen.tool === "eraser");
    undoBtn.disabled = clearBtn.disabled = !hasInk();
  };
  pen.listeners.add(sync);
  sync();
  return [toggle, tools];
}

function revealBtn() {
  const b = tbtn("eye", "Show buttons", () => {
    const on = !document.body.classList.contains("reveal");
    document.body.classList.toggle("reveal", on);
    b.setAttribute("aria-pressed", on);
  });
  b.setAttribute("aria-pressed", document.body.classList.contains("reveal"));
  return b;
}

// ------------------------------------------------------------------ views
async function home() {
  const [b1, b2, st] = await Promise.all([load("lt1"), load("lt2"), load("stories")]);
  const card = (b, href, cover, name, sub, color, tag) => h("button", { class: "bookcard", type: "button", onclick: () => go(href), style: { "--spine": color } },
    h("div", { class: "cover" }, h("img", { src: cover, alt: "" }), tag ? h("b", {}, tag) : null),
    h("div", { class: "name" }, name, h("span", {}, sub)));
  const cards = [
    card(b1, "#/lt1", "media/thumbs/lt1-u1.webp", "Let's Try! 1", "3年生 · 9 units", BOOKS.lt1.color, "3年"),
    card(b2, "#/lt2", "media/thumbs/lt2-u1.webp", "Let's Try! 2", "4年生 · 9 units", BOOKS.lt2.color, "4年"),
    card(st, "#/stories", "media/thumbs/stories.webp", "Storybooks", "えほん · 2 books", "#2e9d47", "えほん"),
  ];
  cards.forEach(c => c.querySelector(".cover").style.setProperty("--spine", c.style.getPropertyValue("--spine")));
  setView(h("section", { class: "home" },
    h("h1", {}, "Let's Try!", h("small", {}, "デジタル教科書 · Digital textbook")),
    h("div", { class: "shelf" }, cards),
    h("p", { class: "foot" }, "Textbook content © MEXT 文部科学省. Rebuilt from plip-plop-land.com with permission. Works best in full screen — press F or the button at bottom right.")),
    [spacer(), fsBtn()]);
}

async function contents(bookId) {
  const book = await load(bookId);
  const grid = h("div", { class: "units" }, book.units.map(u =>
    h("button", { class: "unit", type: "button", onclick: () => go(`#/${bookId}/${u.n}/1`) },
      h("div", { class: "thumb" }, h("img", { src: `media/thumbs/${bookId}-u${u.n}.webp`, alt: "", loading: "lazy" })),
      h("div", { class: "t" }, h("span", { class: "n" }, u.n), h("span", { class: "ti" }, u.title)))));
  setView(h("section", { class: "contents" },
    h("header", {}, h("h2", {}, book.title), h("p", {}, `${BOOKS[bookId].grade} · もくじ Contents`)), grid),
    [tbtn("home", "Home", () => go("#/"), { showLabel: true }), spacer(), fsBtn()]);
}

async function unitPage(bookId, un, pn) {
  const book = await load(bookId);
  const unit = book.units[un - 1];
  if (!unit) return go(`#/${bookId}`);
  const pIdx = Math.max(0, Math.min(unit.pages.length - 1, pn - 1));
  const page = unit.pages[pIdx];
  const flat = book.units.flatMap(u => u.pages.map((_, i) => [u.n, i + 1]));
  const pos = flat.findIndex(([a, b]) => a === un && b === pIdx + 1);
  const prev = flat[pos - 1], next = flat[pos + 1];
  const dir = sessionStorage.getItem("turn") || "";
  sessionStorage.removeItem("turn");

  const ctx = { book, unit, inkKey: `${bookId}/${un}/p${pIdx + 1}` };
  const v = renderScreen(page, ctx);
  if (dir) v.sheet.classList.add("turn-" + dir);
  const goPrev = () => prev && turnTo(`#/${bookId}/${prev[0]}/${prev[1]}`, "prev");
  const goNext = () => next && turnTo(`#/${bookId}/${next[0]}/${next[1]}`, "next");
  const edgeL = h("button", { class: "edge l", type: "button", "aria-label": "Previous page", hidden: !prev || null, onclick: goPrev }, icon("left"));
  const edgeR = h("button", { class: "edge r", type: "button", "aria-label": "Next page", hidden: !next || null, onclick: goNext }, icon("right"));
  const wrap = h("div", { style: { position: "absolute", inset: "0" } }, v.fit, edgeL, edgeR);

  // swipe to turn (when not drawing)
  let sx = null, sy = 0;
  wrap.addEventListener("pointerdown", e => { if (!pen.on && e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
  wrap.addEventListener("pointerup", e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) dx < 0 ? goNext() : goPrev();
  });

  const pager = h("span", { class: "pager" }, `Unit ${un}  ·  ${pIdx + 1}/${unit.pages.length}`);
  setView(wrap, [
    tbtn("home", "Home", () => go("#/")),
    tbtn("grid", "Contents", () => go(`#/${bookId}`), { showLabel: true }),
    sep(),
    tbtn("left", "Previous page", goPrev, { disabled: !prev || null }),
    pager,
    tbtn("right", "Next page", goNext, { disabled: !next || null }),
    spacer(),
    ...penControls(),
    sep(), revealBtn(), fsBtn(),
  ]);
  current.destroy = v.destroy;
  current.keys = e => {
    if (layerCount() || e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") goNext();
    if (e.key === "ArrowLeft" || e.key === "PageUp") goPrev();
  };
  // warm the cache for the neighbouring pages and this unit's pop-ups
  const neighbour = (p) => p && book.units[p[0] - 1].pages[p[1] - 1].image;
  preload([neighbour(next), neighbour(prev), ...Object.values(unit.popups).map(s => s.image)].filter(Boolean));
}

async function stories(id) {
  const st = await load("stories");
  if (!id) {
    const grid = h("div", { class: "units" }, st.stories.map(s =>
      h("button", { class: "unit", type: "button", onclick: () => go(`#/stories/${s.id}`) },
        h("div", { class: "thumb", style: { aspectRatio: "457/320" } }, h("img", { src: s.pages[0], alt: "" })),
        h("div", { class: "t" }, h("span", { class: "ti" }, s.title)))));
    setView(h("section", { class: "contents" }, h("header", {}, h("h2", {}, "Storybooks"), h("p", {}, "えほん")), grid),
      [tbtn("home", "Home", () => go("#/"), { showLabel: true }), spacer(), fsBtn()]);
    return;
  }
  const s = st.stories.find(x => x.id === id);
  if (!s) return go("#/stories");
  const fb = flipbook({ title: s.title, pages: s.pages.map(img => ({ img })), aspect: s.size[0] / s.size[1] });
  setView(fb.root, [tbtn("home", "Home", () => go("#/")), tbtn("grid", "Storybooks", () => go("#/stories"), { showLabel: true }), spacer(), fsBtn()]);
  current.destroy = fb.destroy;
}

// ------------------------------------------------------------------ routing
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function turnTo(hash, dir) { sessionStorage.setItem("turn", dir); go(hash); }

async function route() {
  // reset pen state before a view builds its toolbar
  pen.listeners.clear();
  if (pen.on) setPen({ on: false });
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  try {
    if (!parts.length) await home();
    else if (parts[0] === "stories") await stories(parts[1]);
    else if (/^lt[12]$/.test(parts[0])) {
      if (parts.length === 1) await contents(parts[0]);
      else await unitPage(parts[0], +parts[1] || 1, +parts[2] || 1);
    } else await home();
  } catch (err) {
    console.error(err);
    view.replaceChildren(h("div", { class: "loading" }, "Couldn't load this page. Check the connection and reload."));
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (e.key === "f" || e.key === "F") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  current.keys && current.keys(e);
});
onLayersChange(() => { if (pen.on) pen.listeners.forEach(f => f()); });
route();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
