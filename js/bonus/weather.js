// Japan weather map (Let's Try! 2, Unit 2): "How's the weather in Sapporo?" "It's snowy."
import { h, icon } from "../ui.js";
import { t, getLang } from "../i18n.js";
import { speak, seg, btn, pick } from "./common.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  kids.flat().forEach(k => k && el.append(k));
  return el;
};
const KINDS = ["sunny", "cloudy", "rainy", "snowy"];
const JA = { sunny: "はれ", cloudy: "くもり", rainy: "あめ", snowy: "ゆき" };
// relative chances by season and region  [sunny, cloudy, rainy, snowy]
const W = {
  winter: { north: [2, 3, 1, 6], snow: [1, 3, 1, 7], pacific: [7, 2, 1, .4], south: [4, 4, 2, 0] },
  spring: { north: [4, 3, 2, .6], snow: [4, 3, 3, .3], pacific: [5, 3, 3, 0], south: [5, 3, 3, 0] },
  rainy:  { north: [4, 4, 2, 0], snow: [2, 3, 6, 0], pacific: [2, 3, 7, 0], south: [3, 3, 6, 0] },
  summer: { north: [6, 3, 2, 0], snow: [7, 2, 2, 0], pacific: [7, 2, 2, 0], south: [6, 2, 3, 0] },
  autumn: { north: [5, 3, 2, .5], snow: [4, 3, 3, 0], pacific: [6, 3, 2, 0], south: [6, 3, 2, 0] },
};
const seasonNow = () => { const m = new Date().getMonth() + 1; return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m === 6 ? "rainy" : m <= 8 ? "summer" : "autumn"; };
function roll(zone, season) {
  const w = W[season][zone]; let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) return KINDS[i]; }
  return "sunny";
}

// cute weather icons (drawn at 0,0 within a 100x100 box)
function iconSvg(kind) {
  const g = s("g");
  const face = (cx, cy, k = 1) => [
    s("circle", { cx: cx - 9 * k, cy, r: 3.6 * k, fill: "#3b2a1a" }), s("circle", { cx: cx + 9 * k, cy, r: 3.6 * k, fill: "#3b2a1a" }),
    s("path", { d: `M${cx - 6 * k},${cy + 8 * k} q${6 * k},${6 * k} ${12 * k},0`, stroke: "#3b2a1a", "stroke-width": 3 * k, fill: "none", "stroke-linecap": "round" }),
    s("circle", { cx: cx - 15 * k, cy: cy + 7 * k, r: 4 * k, fill: "#ff9aa8", opacity: .7 }), s("circle", { cx: cx + 15 * k, cy: cy + 7 * k, r: 4 * k, fill: "#ff9aa8", opacity: .7 })];
  const cloud = (fill, dy = 0) => s("path", { d: `M24,${68 + dy} a16,16 0 0 1 2,-31 a22,22 0 0 1 41,-6 a17,17 0 0 1 12,37 z`, fill, stroke: "#5f7686", "stroke-width": 3, "stroke-linejoin": "round" });
  if (kind === "sunny") {
    const rays = s("g", { class: "rays" });
    for (let i = 0; i < 8; i++) rays.append(s("path", { d: "M50,6 L55,18 L45,18 z", fill: "#ffb300", transform: `rotate(${i * 45} 50 50)` }));
    g.append(rays, s("circle", { cx: 50, cy: 50, r: 27, fill: "#ffd93b", stroke: "#f59e0b", "stroke-width": 3 }), ...face(50, 48));
  } else if (kind === "cloudy") {
    g.append(cloud("#f4f7fa"), ...face(50, 50, .9));
  } else if (kind === "rainy") {
    const drops = s("g", { class: "drops" });
    [[32, 80], [50, 86], [68, 80]].forEach(([x, y]) => drops.append(s("path", { d: `M${x},${y} q-5,8 0,11 q5,-3 0,-11z`, fill: "#3b9ae1" })));
    g.append(drops, cloud("#c9d6e2", -8), ...face(50, 42, .85));
  } else {
    const flakes = s("g", { class: "flakes" });
    [[30, 84], [50, 90], [70, 84]].forEach(([x, y]) => flakes.append(s("text", { x, y, "text-anchor": "middle", "font-size": 16, fill: "#5aa9e6" }, document.createTextNode("❄"))));
    g.append(flakes, cloud("#ffffff", -8), ...face(50, 42, .85));
  }
  return g;
}

export function mount(stage, { tools }) {
  const st = { season: seasonNow(), hidden: false, weather: {}, shown: {}, asking: null };
  const svg = s("svg", { class: "wmap", viewBox: "0 0 1000 760", role: "img", "aria-label": "Japan weather map" });
  const caption = h("div", { class: "wcap", hidden: true });
  const wrap = h("div", { class: "wwrap" }, svg, caption);
  const ja = getLang() === "ja";
  const seasonSeg = seg([["spring", ja ? "春" : "Spring"], ["rainy", ja ? "梅雨" : "Rainy season"], ["summer", ja ? "夏" : "Summer"], ["autumn", ja ? "秋" : "Autumn"], ["winter", ja ? "冬" : "Winter"]],
    st.season, v => { st.season = v; newWeather(); }, "small");
  const hideBtn = btn("eye", t("w_hide"), () => setHidden(!st.hidden), "pill ghost");
  const askBtn = btn("question", t("w_ask"), ask, "pill ghost");
  const rollBtn = btn("dice", t("w_new"), () => newWeather(), "pill");
  stage.append(h("div", { class: "bpanel" }, wrap, h("div", { class: "bbar" }, rollBtn, hideBtn, askBtn, seasonSeg)));

  let cities = [], els = {};
  fetch("data/japan-map.json").then(r => r.json()).then(d => {
    cities = d.cities;
    const defs = s("defs", {},
      s("linearGradient", { id: "sea", x1: 0, y1: 0, x2: 0, y2: 1 }, s("stop", { offset: 0, "stop-color": "#8fd3f4" }), s("stop", { offset: 1, "stop-color": "#5bb7e5" })),
      s("pattern", { id: "waves", width: 60, height: 34, patternUnits: "userSpaceOnUse" },
        s("path", { d: "M2,20 q7,-8 14,0 t14,0", stroke: "rgba(255,255,255,.35)", "stroke-width": 2.5, fill: "none", "stroke-linecap": "round" })));
    const land = (paths, cls) => s("g", { class: cls }, paths.map(p => s("path", { d: p })));
    const b = d.okinawaBox;
    svg.append(defs,
      s("rect", { width: 1000, height: 760, fill: "url(#sea)" }), s("rect", { width: 1000, height: 760, fill: "url(#waves)" }),
      s("g", { transform: "translate(5 7)", class: "landshadow" }, land(d.land), land(d.okinawa)),
      land(d.land, "land"),
      s("rect", { x: b[0][0], y: b[0][1], width: b[1][0] - b[0][0], height: b[1][1] - b[0][1], rx: 16, class: "inset" }),
      land(d.okinawa, "land"),
      s("text", { x: b[0][0] + 12, y: b[1][1] - 12, class: "insetlabel" }, document.createTextNode("Okinawa")),
      s("text", { x: 990, y: 750, "text-anchor": "end", class: "credit" }, document.createTextNode(d.credit)));
    const layer = s("g", { class: "cities" });
    svg.append(layer);
    // hand-placed bubbles over the sea, with a short line back to the pin: [dx, dy, label side]
    const OFF = { Sapporo: [-6, -78, "r"], Sendai: [84, -36, "b"], Niigata: [-84, -54, "b"], Tokyo: [84, 26, "b"], Nagoya: [-8, 96, "l"],
      Osaka: [-16, -88, "b"], Hiroshima: [-34, -92, "b"], Kochi: [16, 88, "r"], Fukuoka: [-80, -70, "r"], Nagasaki: [-96, 4, "b"],
      Kagoshima: [-88, 62, "r"], Naha: [70, -6, "b"] };
    for (const c of cities) {
      const [dx, dy, side] = OFF[c.en] || [0, -80, "r"];
      const bx = c.x + dx, by = c.y + dy;
      const lp = { r: [c.x + 13, c.y + 7, "start"], l: [c.x - 13, c.y + 7, "end"], b: [c.x, c.y + 30, "middle"], t: [c.x, c.y - 16, "middle"] }[side];
      const badge = s("g", { class: "badge", transform: `translate(${bx - 34} ${by - 34}) scale(.68)` });
      const g = s("g", { class: "city", tabindex: 0, role: "button", "aria-label": c.en },
        s("line", { x1: c.x, y1: c.y, x2: bx, y2: by, class: "leader" }),
        s("circle", { cx: c.x, cy: c.y, r: 9, class: "pin" }),
        s("text", { x: lp[0], y: lp[1], "text-anchor": lp[2], class: "cname" }, document.createTextNode(c.en)),
        badge);
      g.addEventListener("click", () => tapCity(c));
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapCity(c); } });
      layer.append(g);
      els[c.en] = { g, badge };
    }
    newWeather(true);
  });

  function drawBadge(c) {
    const { badge } = els[c.en];
    badge.replaceChildren(s("circle", { cx: 50, cy: 50, r: 50, class: "bubble" }));
    if (st.hidden && !st.shown[c.en]) badge.append(s("text", { x: 50, y: 68, "text-anchor": "middle", class: "qmark" }, document.createTextNode("?")));
    else badge.append(iconSvg(st.weather[c.en]));
  }
  async function newWeather(first = false) {
    st.asking = null; caption.hidden = true;
    Object.values(els).forEach(e => e.g.classList.remove("asked"));
    st.shown = {};
    cities.forEach((c, i) => {
      st.weather[c.en] = roll(c.zone, st.season);
      if (first) return drawBadge(c);
      // a quick shuffle, then settle (staggered)
      let n = 0; const tick = setInterval(() => {
        const keep = st.weather[c.en];
        if (++n > 6 + i % 4) { clearInterval(tick); st.weather[c.en] = keep; drawBadge(c); els[c.en].badge.classList.add("pop"); setTimeout(() => els[c.en].badge.classList.remove("pop"), 300); return; }
        if (!st.hidden) { st.weather[c.en] = KINDS[n % 4]; drawBadge(c); st.weather[c.en] = keep; }
      }, 70);
    });
    if (first) cities.forEach(drawBadge);
  }
  function setHidden(v) {
    st.hidden = v; st.shown = {};
    hideBtn.replaceChildren(icon("eye"), v ? t("w_show") : t("w_hide"));
    hideBtn.setAttribute("aria-pressed", String(v));
    cities.forEach(drawBadge);
  }
  function say(c) {
    const k = st.weather[c.en];
    caption.hidden = false;
    caption.replaceChildren(h("b", {}, `It's ${k} in ${c.en}.`), h("small", {}, `${c.ja}は ${JA[k]}`));
    speak(`It's ${k} in ${c.en}.`);
  }
  function tapCity(c) {
    Object.values(els).forEach(e => e.g.classList.remove("asked"));
    if (st.hidden && !st.shown[c.en]) {
      st.shown[c.en] = true; drawBadge(c);
      els[c.en].badge.classList.add("pop"); setTimeout(() => els[c.en].badge.classList.remove("pop"), 300);
    }
    say(c);
  }
  function ask() {
    const pool = st.hidden ? cities.filter(c => !st.shown[c.en]) : cities;
    const c = pick(pool.length ? pool : cities);
    Object.values(els).forEach(e => e.g.classList.remove("asked"));
    els[c.en].g.classList.add("asked");
    caption.hidden = false;
    caption.replaceChildren(h("b", {}, `How's the weather in ${c.en}?`), h("small", {}, `${c.ja}の天気は？`));
    speak(`How's the weather in ${c.en}?`);
  }
  return () => {};
}
