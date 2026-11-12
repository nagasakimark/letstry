// Renders a page or pop-up screen and runs hotspot actions.
import { h, icon, place, sheet, ringAt, toast } from "./ui.js";
import { playAudio, playVideo, stopAudio, chantPlayer } from "./media.js";
import { openLayer, closeAll } from "./layers.js";
import { attachInk } from "./pen.js";
import { mountBoard } from "./board.js";
import { mountRps } from "./rps.js";
import { flipbook } from "./flipbook.js";
import { attachZoom } from "./zoom.js";
import { t } from "./i18n.js";


export function renderScreen(screen, ctx) {
  // ctx: {inkKey, unit, book}
  const { fit, sheet: sh } = sheet(screen.image, screen.size);
  const cleanups = [];
  const layerEls = {};
  for (const [id, L] of Object.entries(screen.layers || {})) {
    const el = place(h("div", { class: "lay", hidden: L.hidden || null }), L.rect);
    if (L.img) el.append(h("img", { src: L.img, alt: "", loading: "lazy", draggable: "false" }));
    else { el.style.background = L.cover; if (L.radius) el.style.borderRadius = L.radius; }
    layerEls[id] = el;
    sh.append(el);
  }
  for (const hs of screen.hotspots || []) sh.append(hotspot(hs, sh, layerEls, ctx));
  if (screen.kind === "board") cleanups.push(mountBoard(sh, screen.board));
  if (screen.kind === "rps") cleanups.push(mountRps(sh, screen.rps));
  cleanups.push(attachInk(sh, ctx.inkKey));
  const zoom = attachZoom(fit, sh);
  cleanups.push(zoom.destroy);
  return { fit, sheet: sh, zoom, destroy: () => cleanups.forEach(f => f && f()) };
}

function hotspot(hs, sh, layerEls, ctx) {
  const book = hs.k === "book";
  const b = h("button", { class: "hs" + (book ? " book-btn" : "") + (hs.k === "swap" ? " swap" : ""), type: "button",
    "data-k": hs.k, "aria-label": t("k_" + hs.k), title: t("k_" + hs.k) });
  if (book) {
    b.append(icon("book"), " " + t("readBook"));
    b.style.display = "inline-flex"; b.style.gap = "6px"; b.style.alignItems = "center";
    b.style.right = (1 - hs.r[0] - hs.r[2]) * 100 + 1 + "%";
    b.style.bottom = (1 - hs.r[1] - hs.r[3]) * 100 + 1 + "%";
  } else place(b, hs.r);
  const opener = hs.a.find(a => a.t === "open" || a.t === "book");
  if (opener) b.dataset.open = opener.t === "book" ? "book" : opener.s;
  let swapState = 0;
  if (hs.k === "swap") b.append(h("img", { src: hs.a[0].imgs[0], alt: "" }));
  b.addEventListener("click", () => {
    ringAt(sh, hs.r);
    for (const a of hs.a) run(a, b, { layerEls, ctx, setSwap: () => { swapState ^= 1; b.firstChild.src = a.imgs[swapState]; } });
  });
  return b;
}

function run(a, btn, env) {
  switch (a.t) {
    case "audio": return playAudio(a.src, btn);
    case "random": {
      const i = Math.floor(Math.random() * a.list.length);
      toast("🎲 " + t("random"));
      return playAudio(a.list[i], btn);
    }
    case "video": return playVideo(a.src);
    case "toggle": { const el = env.layerEls[a.l]; if (el) el.hidden = !el.hidden; return; }
    case "swap": return env.setSwap();
    case "open": return openPopup(a.s, env.ctx);
    case "spot": return spotlight(a);
    case "steps": return steps(a.steps);
    case "book": return openPictureBook(env.ctx.unit, a.page);
  }
}

export const popupState = { key: null, subs: new Set() };
function setPopupKey(k) { popupState.key = k; popupState.subs.forEach(f => f(k)); }

export function openPopup(key, ctx) {
  const scr = ctx.unit.popups[key];
  if (!scr) return;
  stopAudio();
  closeAll();
  setPopupKey(key);
  if (scr.kind === "chant") {
    const cp = chantPlayer(scr);
    openLayer(cp.root, { onClose: () => { cp.close(); setPopupKey(null); } });
    return;
  }
  const v = renderScreen(scr, { ...ctx, inkKey: `${ctx.book.id}/${ctx.unit.n}/${key}` });
  openLayer(v.fit, { onClose: () => { v.destroy(); stopAudio(); setPopupKey(null); } });
}

function spotlight(a) {
  const img = h("img", { src: a.img, alt: "" });
  const bar = h("div", { class: "bar" });
  if (a.audio) {
    bar.append(h("button", { class: "pill", type: "button", onclick: () => playAudio(a.audio) }, icon("replay"), t("again")));
  }
  for (const b of a.buttons || []) bar.append(h("button", { class: "pill", type: "button", onclick: () => playAudio(b.audio) }, icon("speaker"), b.label === "Letter" ? t("letter") : b.label === "Word" ? t("word") : b.label));
  openLayer(h("div", { class: "spot" }, img, bar.childNodes.length ? bar : null), { onClose: stopAudio });
  if (a.audio) playAudio(a.audio, null, { showBar: false });
}

function steps(list) {
  let i = 0;
  const img = h("img", { src: list[0].img, alt: "" });
  const count = h("span", { class: "count" });
  const prev = h("button", { class: "pill ghost", type: "button", "aria-label": t("prevStep") }, icon("left"));
  const next = h("button", { class: "pill", type: "button" }, t("nextStep"), icon("next"));
  const replay = h("button", { class: "pill ghost", type: "button", "aria-label": t("again") }, icon("replay"));
  const show = () => {
    img.src = list[i].img;
    count.textContent = `${i + 1} / ${list.length}`;
    prev.disabled = i === 0; next.disabled = i === list.length - 1;
    if (list[i].audio) playAudio(list[i].audio, null, { showBar: false });
  };
  prev.onclick = () => { if (i > 0) { i--; show(); } };
  next.onclick = () => { if (i < list.length - 1) { i++; show(); } };
  replay.onclick = () => list[i].audio && playAudio(list[i].audio, null, { showBar: false });
  openLayer(h("div", { class: "spot" }, img, h("div", { class: "bar" }, prev, count, next, replay)), { onClose: stopAudio });
  show();
}

export function openPictureBook(unit, page = 0) {
  const pb = unit.pictureBook;
  if (!pb) return;
  stopAudio();
  closeAll();
  const fb = flipbook({ title: unit.title, pages: pb, aspect: 0.72, startPage: page });
  setPopupKey("book");
  openLayer(fb.root, { onClose: () => { fb.destroy(); setPopupKey(null); } });
}
