// Card maker (Let's Try! 1, Unit 7 "This is for you."): build a card from shapes and colours.
import { h, icon } from "../ui.js";
import { t, getLang } from "../i18n.js";
import { speak, btn } from "./common.js";

const SHAPES = {
  circle: "M50,6 a44,44 0 1 1 -0.1,0 z",
  triangle: "M50,8 L94,88 L6,88 z",
  square: "M10,10 H90 V90 H10 z",
  rectangle: "M4,26 H96 V74 H4 z",
  star: "M50,4 L61,37 L96,37 L68,58 L78,92 L50,72 L22,92 L32,58 L4,37 L39,37 z",
  diamond: "M50,4 L90,50 L50,96 L10,50 z",
  heart: "M50,90 C18,68 4,50 4,32 C4,16 16,6 29,6 C39,6 46,12 50,20 C54,12 61,6 71,6 C84,6 96,16 96,32 C96,50 82,68 50,90 z",
};
const SHAPE_JA = { circle: "まる", triangle: "さんかく", square: "しかく", rectangle: "ながしかく", star: "ほし", diamond: "ひしがた", heart: "ハート" };
const COLORS = [["red", "#e53935"], ["blue", "#1e63d6"], ["yellow", "#f7c400"], ["green", "#2e9d47"], ["pink", "#ec5c9a"],
  ["orange", "#f57c00"], ["purple", "#7b45c4"], ["brown", "#8b5a2b"], ["black", "#222222"], ["white", "#ffffff"]];
const svgShape = (shape, fill) => `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${SHAPES[shape]}" fill="${fill}" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linejoin="round"/></svg>`;
const article = c => /^[aeiou]/.test(c) ? "An" : "A";

export function mount(stage) {
  const st = { color: COLORS[0], items: [], sel: null };
  const card = h("div", { class: "cmcard" });
  const caption = h("div", { class: "cmsay" }, h("b", {}, "What do you want?"));
  const palette = h("div", { class: "cmshapes" });
  const swatches = h("div", { class: "cmcolors" }, COLORS.map(c => {
    const b = h("button", { class: "sw", type: "button", title: c[0], "aria-label": c[0] });
    b.style.setProperty("--c", c[1]);
    b.onclick = () => { st.color = c; drawPalette(); if (st.sel) { st.sel.color = c; paint(st.sel); say(st.sel); } sync(); };
    return b;
  }));
  const selbar = h("div", { class: "cmsel", hidden: true },
    h("button", { class: "ib", type: "button", "data-tip": t("cm_smaller"), "aria-label": t("cm_smaller"), onclick: () => resize(1 / 1.2) }, icon("minus")),
    h("button", { class: "ib", type: "button", "data-tip": t("cm_bigger"), "aria-label": t("cm_bigger"), onclick: () => resize(1.2) }, icon("plus")),
    h("button", { class: "ib", type: "button", "data-tip": t("cm_turn"), "aria-label": t("cm_turn"), onclick: () => { st.sel.rot = (st.sel.rot + 30) % 360; paint(st.sel); } }, icon("reset")),
    h("button", { class: "ib", type: "button", "data-tip": t("cm_delete"), "aria-label": t("cm_delete"), onclick: () => remove(st.sel) }, icon("trash")));
  const giveBtn = btn("star", "This is for you!", () => give(), "pill");
  const clearBtn = btn("trash", t("cm_clear"), () => { [...st.items].forEach(remove); caption.replaceChildren(h("b", {}, "What do you want?")); }, "pill ghost");
  stage.append(h("div", { class: "bpanel cmpanel" },
    h("div", { class: "cmside" }, palette, swatches),
    h("div", { class: "cmmain" }, card, selbar, caption),
    h("div", { class: "bbar" }, giveBtn, clearBtn)));

  function drawPalette() {
    palette.replaceChildren(...Object.keys(SHAPES).map(sh => {
      const b = h("button", { class: "cmshape", type: "button", title: sh, "aria-label": `${st.color[0]} ${sh}`, html: svgShape(sh, st.color[1]) });
      b.addEventListener("pointerdown", e => dragNew(e, sh));
      b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(sh, .5, .5); } });
      return b;
    }));
    swatches.querySelectorAll(".sw").forEach((b, i) => b.setAttribute("aria-pressed", String(COLORS[i] === st.color)));
  }
  drawPalette();

  function paint(it) {
    it.el.innerHTML = svgShape(it.shape, it.color[1]);
    Object.assign(it.el.style, { left: it.x * 100 + "%", top: it.y * 100 + "%", width: it.size * 100 + "%", transform: `translate(-50%,-50%) rotate(${it.rot}deg)` });
  }
  function say(it) {
    const words = `${article(it.color[0])} ${it.color[0]} ${it.shape}, please.`;
    caption.replaceChildren(h("b", {}, words), getLang() === "ja" ? h("small", {}, `${it.color[0]} の ${SHAPE_JA[it.shape]}`) : null);
    speak(words);
  }
  function select(it) {
    st.sel = it;
    st.items.forEach(i => i.el.classList.toggle("sel", i === it));
    selbar.hidden = !it;
  }
  function add(shape, x, y) {
    const it = { shape, color: st.color, x, y, size: .2, rot: 0 };
    it.el = h("div", { class: "cmitem", role: "button", tabindex: "0", "aria-label": `${it.color[0]} ${shape}` });
    it.el.addEventListener("pointerdown", e => dragItem(e, it));
    card.append(it.el);
    st.items.push(it);
    paint(it); select(it); say(it);
    return it;
  }
  function remove(it) {
    if (!it) return;
    it.el.remove(); st.items.splice(st.items.indexOf(it), 1);
    if (st.sel === it) select(null);
  }
  function resize(k) { if (!st.sel) return; st.sel.size = Math.max(.06, Math.min(.7, st.sel.size * k)); paint(st.sel); }
  const rel = e => { const r = card.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };

  function dragNew(e, shape) {
    e.preventDefault();
    const ghost = h("div", { class: "cmghost", html: svgShape(shape, st.color[1]) });
    document.body.append(ghost);
    const mv = ev => { ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; };
    mv(e);
    const sx = e.clientX, sy = e.clientY;
    const up = ev => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      ghost.remove();
      const [x, y] = rel(ev);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) add(shape, .3 + Math.random() * .4, .3 + Math.random() * .4);   // a tap adds it to the card
      else if (x > 0 && x < 1 && y > 0 && y < 1) add(shape, x, y);
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  function dragItem(e, it) {
    e.preventDefault(); e.stopPropagation();
    select(it);
    card.append(it.el);
    st.items.push(st.items.splice(st.items.indexOf(it), 1)[0]);
    const [sx, sy] = rel(e), ox = it.x, oy = it.y;
    let moved = false;
    it.el.setPointerCapture(e.pointerId);
    const mv = ev => { const [x, y] = rel(ev); if (Math.hypot(x - sx, y - sy) > .01) moved = true; it.x = ox + x - sx; it.y = oy + y - sy; paint(it); };
    const up = ev => {
      it.el.removeEventListener("pointermove", mv); it.el.removeEventListener("pointerup", up);
      const [x, y] = rel(ev);
      if (x < -.05 || x > 1.05 || y < -.05 || y > 1.05) remove(it);   // dragged off the card
      else if (!moved) say(it);
    };
    it.el.addEventListener("pointermove", mv); it.el.addEventListener("pointerup", up);
  }
  card.addEventListener("pointerdown", e => { if (e.target === card) select(null); });
  function give() {
    select(null);
    card.classList.remove("give"); void card.offsetWidth; card.classList.add("give");
    caption.replaceChildren(h("b", {}, "This is for you!"), h("small", {}, "Thank you!"));
    speak("This is for you!");
  }
  function sync() { swatches.querySelectorAll(".sw").forEach((b, i) => b.setAttribute("aria-pressed", String(COLORS[i] === st.color))); }
  return () => {};
}
