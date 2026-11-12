// Let's Try! digital textbook — app shell and routing
//   #/                 home
//   #/lt1              contents of Let's Try! 1
//   #/lt1/3/2          unit 3, page 2
//   #/stories/autumn   storybook
import { $, h, icon, tbtn, preload, toast } from "./ui.js";
import { renderScreen, openPopup, openPictureBook, popupState } from "./viewer.js";
import { stopAudio } from "./media.js";
import { closeAll, layerCount } from "./layers.js";
import { pen, setPen, COLORS, SIZES, TEXT_SIZES, undo, clearInk, hasInk, isTyping } from "./pen.js";
import { flipbook } from "./flipbook.js";
import { activeZoom, onZoom } from "./zoom.js";
import { timerButton } from "./timer.js";
import { t, getLang, setLang, onLang } from "./i18n.js";
import { offlineState, onOffline, download, remove, checkAll } from "./offline.js";

const view = $("#view"), railL = $("#railL"), railR = $("#railR");
const cache = {};
async function load(name) {
  cache[name] ||= fetch(`data/${name}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .catch(e => { delete cache[name]; throw e; });
  return cache[name];
}
const BOOKS = {
  lt1: { color: "#e8502e", grade: "grade3", name: "Let's Try! 1" },
  lt2: { color: "#1f8fd1", grade: "grade4", name: "Let's Try! 2" },
  stories: { color: "#2e9d47", name: "Storybooks" },
};
let current = { destroy: null };

// ------------------------------------------------------------------ layout mode
// "wide": a labelled sidebar fits beside the page; "rails": slim icon rails; "dock": bottom bar
function layoutMode() {
  const w = innerWidth, hh = innerHeight;
  if (w / hh <= 1.7) return "dock";
  return w - hh * 1.45 >= 200 + 64 + 30 ? "wide" : "rails";
}
function applyLayout() { const m = layoutMode(); document.body.dataset.layout = m; return m; }
let lastMode = applyLayout();
addEventListener("resize", () => { const m = applyLayout(); if (m !== lastMode) { lastMode = m; route(); } });

// rails: { top, body, mid, bot, extra } per side
function fillRail(rail, spec = {}) {
  const grp = (items, cls = "grp") => items && items.filter(Boolean).length ? h("div", { class: cls }, items.filter(Boolean)) : null;
  rail.replaceChildren(...[grp(spec.top), spec.body || null, h("div", { class: "mid" }, grp(spec.mid, "grp bare")), grp(spec.bot), ...(spec.extra || [])].filter(Boolean));
}
function setView(node, left = {}, right = {}) {
  current.destroy && current.destroy();
  current = { destroy: null };
  closeAll({ keepHistory: false });
  stopAudio();
  view.replaceChildren(node);
  fillRail(railL, left);
  fillRail(railR, right);
}

// ------------------------------------------------------------------ rail parts
const fsBtn = () => {
  const b = tbtn(document.fullscreenElement ? "unfull" : "full", t("full"), () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener("fullscreenchange", () => b.replaceChildren(icon(document.fullscreenElement ? "unfull" : "full")));
  return b;
};
const langBtn = () => h("button", { class: "ib langbtn", type: "button", "aria-label": t("langTip"), "data-tip": t("langTip"),
  onclick: () => setLang(getLang() === "ja" ? "en" : "ja") }, h("span", {}, getLang() === "ja" ? "EN" : "日本"));

const zoomSubs = new Set();
onZoom(z => zoomSubs.forEach(f => f(z)));
function zoomBtn() {
  const b = tbtn("zoomreset", t("resetZoom"), () => { const z = activeZoom(); z && z.reset(); });
  const sync = z => { b.disabled = !z || z.scale <= 1.001; };
  zoomSubs.add(sync); sync(activeZoom());
  return b;
}

function penControls() {
  const toggle = tbtn("pen", t("pen"), () => setPen({ on: !pen.on }));
  const swatches = h("div", { class: "swatches", role: "group" },
    COLORS.map(([c, name]) => {
      const b = h("button", { class: "sw", type: "button", title: name, "aria-label": name });
      b.style.setProperty("--c", c);
      b.onclick = () => setPen({ on: true, color: c, tool: pen.tool === "eraser" ? "pen" : pen.tool });
      return b;
    }));
  const sizeBtn = tbtn("pen", t("lineSize"), () => setPen({ size: (pen.size + 1) % SIZES.length }));
  const markerBtn = tbtn("marker", t("marker"), () => setPen({ on: true, tool: pen.tool === "marker" ? "pen" : "marker" }));
  const eraseBtn = tbtn("eraser", t("eraser"), () => setPen({ on: true, tool: pen.tool === "eraser" ? "pen" : "eraser" }));
  const undoBtn = tbtn("undo", t("undo"), undo);
  const clearBtn = tbtn("trash", t("clear"), () => { clearInk(); toast(t("cleared")); });
  const handBtn = tbtn("hand", t("stopPen"), () => setPen({ on: false }));
  const textBtn = h("button", { class: "ib tool-text", type: "button", "aria-label": t("textTool"), "data-tip": t("textTool"),
    onclick: () => setPen({ on: true, tool: pen.tool === "text" ? "pen" : "text" }) }, h("span", { class: "tglyph" }, "Aa"));
  const tsizes = h("div", { class: "tsizes", role: "group", "aria-label": t("textSize") },
    TEXT_SIZES.map((_, i) => h("button", { class: "tsz", type: "button", "data-tip": t("textSize") + " " + "SMLX"[i],
      "aria-label": t("textSize") + " " + ["S", "M", "L", "XL"][i], onclick: () => setPen({ textSize: i }) },
      h("span", { style: { fontSize: [12, 16, 21, 27][i] + "px" } }, "A"))));
  tsizes.querySelectorAll(".tsz span").forEach((sp, i) => sp.style.fontSize = [12, 16, 21, 27][i] + "px");
  const panel = h("div", { class: "penpanel", hidden: true }, swatches,
    h("div", { class: "pentools" }, sizeBtn, markerBtn, textBtn, eraseBtn, undoBtn, clearBtn), tsizes,
    h("div", { class: "penfoot" }, handBtn));
  // keep focus in an open text box while picking colours and sizes
  panel.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
  const sync = () => {
    toggle.setAttribute("aria-pressed", pen.on);
    panel.hidden = !pen.on;
    swatches.querySelectorAll(".sw").forEach((b, i) => b.setAttribute("aria-pressed", String(pen.tool !== "eraser" && COLORS[i][0] === pen.color)));
    const d = h("span", { class: "size-dot" }); d.style.setProperty("--s", [6, 11, 18][pen.size] + "px");
    sizeBtn.replaceChildren(d);
    markerBtn.setAttribute("aria-pressed", pen.tool === "marker");
    eraseBtn.setAttribute("aria-pressed", pen.tool === "eraser");
    textBtn.setAttribute("aria-pressed", pen.tool === "text");
    tsizes.hidden = pen.tool !== "text";
    sizeBtn.disabled = pen.tool === "text" || pen.tool === "eraser";
    tsizes.querySelectorAll(".tsz").forEach((b, i) => b.setAttribute("aria-pressed", String(i === pen.textSize)));
    undoBtn.disabled = clearBtn.disabled = !hasInk();
  };
  pen.listeners.add(sync);
  sync();
  return { toggle, panel };
}

function revealBtn() {
  const b = tbtn("eye", t("reveal"), () => {
    const on = !document.body.classList.contains("reveal");
    document.body.classList.toggle("reveal", on);
    b.setAttribute("aria-pressed", on);
  });
  b.setAttribute("aria-pressed", document.body.classList.contains("reveal"));
  return b;
}

// ------------------------------------------------------------------ activity list
const TYPE_ICON = { wat: "watch", chant: "music", sing: "music", listen: "ear", play: "star", activity: "puzzle",
  shimen: "photo", "3hints": "star", kanji: "star", footprints: "star", book: "book" };
function activityLabel(key) {
  if (key === "book") return { label: t("t_book"), type: "book" };
  const m = /^unit\d+-(.+?)(?:-(\d+))?-page$/.exec(key) || [];
  const type = m[1] || "activity";
  const name = t("t_" + type);
  return { label: (name === "t_" + type ? type : name) + (m[2] ? " " + m[2] : ""), type };
}
function pageActivities(page) {
  // in reading order: left page top-to-bottom, then right page
  const first = new Map();
  for (const hs of page.hotspots) for (const a of hs.a) {
    const k = a.t === "open" ? a.s : a.t === "book" ? "book" : null;
    if (k && !first.has(k)) first.set(k, hs.r);
  }
  const order = r => (r[0] + r[2] / 2 >= 0.5 ? 1 : 0) * 10 + r[1];
  return [...first.keys()].sort((a, b) => order(first.get(a)) - order(first.get(b)));
}
function activityList(page, ctx, firstBookPage) {
  const items = pageActivities(page).map(k => {
    const { label, type } = activityLabel(k);
    const b = h("button", { class: "act", type: "button", "data-key": k, "data-type": type },
      h("span", { class: "ai" }, icon(TYPE_ICON[type] || "puzzle")), h("span", { class: "al" }, label));
    b.onclick = () => k === "book" ? openPictureBook(ctx.unit, firstBookPage) : openPopup(k, ctx);
    const hint = on => document.querySelectorAll(`.view .hs[data-open="${CSS.escape(k)}"]`).forEach(x => x.classList.toggle("hint", on));
    b.addEventListener("pointerenter", () => hint(true));
    b.addEventListener("pointerleave", () => hint(false));
    b.addEventListener("click", () => hint(false));
    return b;
  });
  const list = h("div", { class: "acts" }, items.length ? items : h("p", { class: "none" }, t("noActivities")));
  const sync = key => items.forEach(b => b.setAttribute("aria-current", String(b.dataset.key === key)));
  popupState.subs.clear(); popupState.subs.add(sync);
  return { list, count: items.length };
}

// a floating panel attached to a rail button (beside the rail, or above the dock)
function popover(anchorBtn, content) {
  let pop = null;
  const out = e => { if (pop && !pop.contains(e.target) && !anchorBtn.contains(e.target)) close(); };
  function close() { pop && pop.remove(); pop = null; anchorBtn.setAttribute("aria-pressed", "false"); document.removeEventListener("pointerdown", out, true); }
  anchorBtn.addEventListener("click", () => {
    if (pop) return close();
    pop = h("div", { class: "popover" }, content);
    pop.addEventListener("click", e => { if (e.target.closest(".act")) close(); });
    anchorBtn.closest(".rail").append(pop);
    anchorBtn.setAttribute("aria-pressed", "true");
    setTimeout(() => document.addEventListener("pointerdown", out, true), 0);
  });
}

// ------------------------------------------------------------------ home: offline panel under each book
const sizes = {};
function offlinePanel(id) {
  const box = h("div", { class: "offline", "data-book": id });
  box.render = () => {
    const st = offlineState(id);
    const mb = sizes[id] ? Math.max(1, Math.round(sizes[id] / 1e6)) : "…";
    const retry = h("button", { class: "obtn", type: "button", onclick: () => download(id) }, icon("download"), t("offlineRedo"));
    let kids;
    if (st.status === "busy") {
      const p = Math.floor((st.progress || 0) * 100);
      const fill = h("i"); fill.style.width = p + "%";
      kids = [h("div", { class: "obar", role: "progressbar", "aria-valuenow": p }, fill), h("span", { class: "otext" }, t("offlineBusy", { p }))];
    } else if (st.status === "ready") {
      kids = [h("span", { class: "otext ok" }, icon("check"), t("offlineOn")),
        h("button", { class: "olink", type: "button", onclick: async () => { await remove(id); toast(t("offlineRemoved")); } }, t("offlineRemove"))];
    } else if (st.status === "broken") {
      kids = [h("span", { class: "otext warn" }, icon("warn"), t("offlineBroken")), retry];
    } else if (st.status === "error") {
      kids = [h("span", { class: "otext warn" }, icon("warn"), st.reason === "space" ? t("offlineNoSpace") : t("offlineFail")), retry];
    } else {
      kids = [h("button", { class: "obtn", type: "button", onclick: () => download(id) }, icon("download"), t("offline"), h("small", {}, t("offlineSize", { mb })))];
    }
    box.replaceChildren(...kids);
  };
  box.render();
  if (!sizes[id]) fetch(`data/offline-${id}.json`).then(r => r.json()).then(m => { sizes[id] = m.bytes; box.render(); }).catch(() => {});
  return box;
}
onOffline((id, st) => {
  document.querySelectorAll(`.offline[data-book="${id}"]`).forEach(b => b.render && b.render());
  if (st && st.justDone) toast(t("offlineDone", { book: BOOKS[id].name }), 4000);
});

// ------------------------------------------------------------------ views
async function home() {
  await Promise.all([load("lt1"), load("lt2"), load("stories")]);
  const ja = getLang() === "ja";
  const card = (id, href, cover, name, sub, tag) => {
    const c = h("div", { class: "bookslot" },
      h("button", { class: "bookcard", type: "button", onclick: () => go(href) },
        h("div", { class: "cover" }, h("img", { src: cover, alt: "" }), h("b", {}, tag)),
        h("div", { class: "name" }, name, h("span", {}, sub))),
      offlinePanel(id));
    c.style.setProperty("--accent", BOOKS[id].color);
    return c;
  };
  setView(h("section", { class: "home" },
    h("h1", {}, "Let's Try!", h("small", {}, t("subtitle"))),
    h("div", { class: "shelf" },
      card("lt1", "#/lt1", "media/thumbs/lt1-u1.webp", "Let's Try! 1", `${t("grade3")} · ${t("units9")}`, ja ? "3年" : "G3"),
      card("lt2", "#/lt2", "media/thumbs/lt2-u1.webp", "Let's Try! 2", `${t("grade4")} · ${t("units9")}`, ja ? "4年" : "G4"),
      card("stories", "#/stories", "media/thumbs/stories.webp", t("storybooks"), `${t("storybooksEn")} · ${t("books2")}`, ja ? "えほん" : "Books")),
    h("p", { class: "foot" }, t("copyright"))),
    {}, { top: [langBtn()], bot: [fsBtn()] });
}

async function contents(bookId) {
  const book = await load(bookId);
  const grid = h("div", { class: "units" }, book.units.map(u =>
    h("button", { class: "unit", type: "button", onclick: () => go(`#/${bookId}/${u.n}/1`) },
      h("div", { class: "thumb" }, h("img", { src: `media/thumbs/${bookId}-u${u.n}.webp`, alt: "", loading: "lazy" })),
      h("div", { class: "t" }, h("span", { class: "n" }, u.n), h("span", { class: "ti" }, u.title)))));
  setView(h("section", { class: "contents" },
    h("header", {}, h("h2", {}, book.title), h("p", {}, `${t(BOOKS[bookId].grade)} · ${t("contents")}`)), grid),
    { top: [tbtn("home", t("home"), () => go("#/"))] }, { top: [langBtn()], bot: [fsBtn()] });
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
  const mode = layoutMode();
  const edge = (side, fn, ok) => h("button", { class: `edge ${side} navbtn`, type: "button", "aria-label": side === "l" ? t("prev") : t("next"),
    title: side === "l" ? t("prev") : t("next"), disabled: !ok || null, onclick: fn }, icon(side === "l" ? "left" : "right"));
  const wrap = h("div", { class: "pagewrap" }, v.fit, mode !== "dock" ? edge("l", goPrev, prev) : null, mode !== "dock" ? edge("r", goNext, next) : null);

  // swipe to turn the page (touch only; not while zoomed in or drawing)
  let sx = null, sy = 0;
  wrap.addEventListener("pointerdown", e => { sx = !pen.on && e.pointerType !== "mouse" && v.zoom.scale <= 1.001 ? e.clientX : null; sy = e.clientY; });
  wrap.addEventListener("pointerup", e => {
    if (sx == null || document.body.classList.contains("pinching") || v.zoom.scale > 1.001) { sx = null; return; }
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) dx < 0 ? goNext() : goPrev();
  });

  let firstBookPage = 0;
  outer: for (const hs of page.hotspots) for (const a of hs.a) if (a.t === "book") { firstBookPage = a.page; break outer; }
  const acts = activityList(page, ctx, firstBookPage);
  const where = h("div", { class: "where", title: `Unit ${un} · ${pIdx + 1} / ${unit.pages.length}` },
    h("small", {}, t("unit")), h("b", {}, un), h("small", {}, `${pIdx + 1} / ${unit.pages.length}`));
  const penc = penControls();
  const right = { top: [penc.toggle, revealBtn(), zoomBtn(), timerButton()], bot: [langBtn(), fsBtn()], extra: [penc.panel] };
  const homeBtn = () => tbtn("home", t("home"), () => go("#/"));
  const contentsBtn = () => tbtn("grid", t("contents"), () => go(`#/${bookId}`));

  if (mode === "wide") {
    const head = h("div", { class: "sidehead" },
      h("div", { class: "row" }, homeBtn(), contentsBtn()),
      h("div", { class: "utitle" }, h("span", { class: "un" }, un), h("span", { class: "ut" }, unit.title)),
      h("div", { class: "upage" }, `${t("page")} ${pIdx + 1} / ${unit.pages.length}`));
    setView(wrap, { body: h("div", { class: "side" }, head, h("div", { class: "acthead" }, t("activities")), acts.list) }, right);
  } else {
    const actBtn = tbtn("list", t("activities"), () => {});
    popover(actBtn, h("div", { class: "popacts" }, h("div", { class: "acthead" }, t("activities")), acts.list));
    if (mode === "dock") {
      setView(wrap, {
        top: [homeBtn(), contentsBtn(), actBtn],
        mid: [tbtn("left", t("prev"), goPrev, { big: true, cls: "navbtn", disabled: !prev || null }), where,
              tbtn("right", t("next"), goNext, { big: true, cls: "navbtn", disabled: !next || null })],
      }, right);
    } else {
      setView(wrap, { top: [homeBtn(), contentsBtn(), actBtn], bot: [where] }, right);
    }
  }
  current.destroy = v.destroy;
  current.keys = e => {
    if (layerCount() || isTyping(e)) return;
    if (v.zoom.scale > 1.001 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") goNext();
    if (e.key === "ArrowLeft" || e.key === "PageUp") goPrev();
  };
  const neighbour = p => p && book.units[p[0] - 1].pages[p[1] - 1].image;
  preload([neighbour(next), neighbour(prev), ...Object.values(unit.popups).map(s => s.image)].filter(Boolean));
}

async function stories(id) {
  const st = await load("stories");
  if (!id) {
    const grid = h("div", { class: "units" }, st.stories.map(s =>
      h("button", { class: "unit", type: "button", onclick: () => go(`#/stories/${s.id}`) },
        h("div", { class: "thumb", style: { aspectRatio: "457/320" } }, h("img", { src: s.pages[0], alt: "" })),
        h("div", { class: "t" }, h("span", { class: "ti" }, s.title)))));
    setView(h("section", { class: "contents" }, h("header", {}, h("h2", {}, t("storybooks")), h("p", {}, t("storybooksEn"))), grid),
      { top: [tbtn("home", t("home"), () => go("#/"))] }, { top: [langBtn()], bot: [fsBtn()] });
    return;
  }
  const s = st.stories.find(x => x.id === id);
  if (!s) return go("#/stories");
  const fb = flipbook({ title: s.title, pages: s.pages.map(img => ({ img })), aspect: s.size[0] / s.size[1] });
  setView(fb.root, { top: [tbtn("home", t("home"), () => go("#/")), tbtn("grid", t("storybooks"), () => go("#/stories"))] },
    { top: [timerButton(), langBtn()], bot: [fsBtn()] });
  current.destroy = fb.destroy;
}

// ------------------------------------------------------------------ routing
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function turnTo(hash, dir) { sessionStorage.setItem("turn", dir); go(hash); }

async function route() {
  pen.listeners.clear();
  zoomSubs.clear();
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
    view.replaceChildren(h("div", { class: "loading" }, t("loadErr")));
  }
}
addEventListener("hashchange", () => route());
addEventListener("keydown", e => {
  if (isTyping(e)) return;
  if (e.key === "f" || e.key === "F") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  current.keys && current.keys(e);
});
onLang(() => route());
route();

// offline: check saved books on every start-up and warn if anything is missing
checkAll({ lt1: BOOKS.lt1.name, lt2: BOOKS.lt2.name, stories: BOOKS.stories.name }, msg => toast(msg, 7000));

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
