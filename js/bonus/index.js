// Bonus activities: which units get which, and opening them full screen.
import { h, icon } from "../ui.js";
import { t } from "../i18n.js";
import { openLayer, closeAll } from "../layers.js";
import { stopAudio } from "../media.js";

const GAMES = "https://nagasakimark.github.io";
// Each entry: id, label key, icon, and either a module loader or an external URL
const DEFS = {
  feelings: { label: "b_feelings", icon: "smile", load: () => import("./slot.js") },
  howmany: { label: "b_howmany", icon: "count", load: () => import("./howmany.js") },
  cardmaker: { label: "b_cardmaker", icon: "shapes", load: () => import("./cardmaker.js") },
  weather: { label: "b_weather", icon: "sun", load: () => import("./weather.js") },
  clock: { label: "b_clock", icon: "timer", load: () => import("./clock.js") },
  pencilcase: { label: "b_pencilcase", icon: "pouch", load: () => import("./pencilcase.js") },
  parfait: { label: "b_parfait", icon: "parfait", load: () => import("./parfait.js") },
  gettingaround: { label: "b_gettingaround", icon: "route", load: () => import("./gettingaround.js") },
  hidden: { label: "b_hidden", icon: "search", url: `${GAMES}/hiddenletters/` },
  "poll:colors": { label: "b_poll_colors", icon: "poll", url: `${GAMES}/poll/#colors` },
  "poll:fruits": { label: "b_poll_fruits", icon: "poll", url: `${GAMES}/poll/#fruits` },
  "poll:sports": { label: "b_poll_sports", icon: "poll", url: `${GAMES}/poll/#sports` },
  "poll:animals": { label: "b_poll_animals", icon: "poll", url: `${GAMES}/poll/#animals` },
  "poll:days": { label: "b_poll_days", icon: "poll", url: `${GAMES}/poll/#days` },
  "poll:vegetables": { label: "b_poll_vegetables", icon: "poll", url: `${GAMES}/poll/#vegetables` },
};
const BY_UNIT = {
  lt1: { 2: ["feelings"], 3: ["howmany"], 4: ["poll:colors"], 5: ["poll:fruits", "poll:sports", "poll:animals"], 6: ["hidden"], 7: ["cardmaker"] },
  lt2: { 2: ["weather"], 3: ["poll:days"], 4: ["clock"], 5: ["pencilcase"], 7: ["parfait", "poll:fruits", "poll:vegetables"], 8: ["gettingaround"] },
};
// Vocabulary games: every unit gets all five, opening with that unit's words
export const WORD_GAMES = {
  flashcards: { label: "g_flashcards", icon: "cards", load: () => import("./flashcards.js") },
  mystery: { label: "g_mystery", icon: "question", load: () => import("./mystery.js") },
  memory: { label: "g_memory", icon: "pairs", load: () => import("./memory.js") },
  flashgame: { label: "g_flashgame", icon: "bolt", load: () => import("./flashgame.js") },
  soundmatch: { label: "g_soundmatch", icon: "ear", load: () => import("./soundmatch.js") },
};
export const wordGamesFor = (bookId, unit) => Object.entries(WORD_GAMES).map(([id, d]) => ({ id, ...d, ctx: { book: bookId, unit } }));

export function bonusFor(bookId, unit) {
  return (BY_UNIT[bookId] && BY_UNIT[bookId][unit] || []).map(id => ({ id, ...DEFS[id], ctx: { book: bookId, unit } }));
}
export const bonusLabel = d => t(d.label);

export async function openBonus(d) {
  stopAudio(); closeAll();
  const title = h("h2", { class: "btitle" }, t(d.label));
  const tools = h("div", { class: "btools" });
  const stage = h("div", { class: "bstage" });
  const root = h("div", { class: "bonus b-" + (d.id || "x") }, h("div", { class: "bhead" }, title, tools), stage);
  let destroy = () => {};
  openLayer(root, { onClose: () => { destroy(); } });
  if (d.url) {
    root.classList.add("embed");
    if (!navigator.onLine) { stage.append(h("p", { class: "bnote" }, t("needsOnline"))); return; }
    const frame = h("iframe", { src: d.url, title: t(d.label), allow: "autoplay; fullscreen", loading: "eager" });
    stage.append(frame);
    tools.append(h("a", { class: "ib", href: d.url, target: "_blank", rel: "noopener", "data-tip": t("openNewTab"), "aria-label": t("openNewTab") }, icon("external")));
    setTimeout(() => frame.focus(), 300);
    return;
  }
  stage.append(h("div", { class: "loading" }, "…"));
  try {
    const mod = await d.load();
    stage.replaceChildren();
    destroy = (await mod.mount(stage, { tools, title, ctx: d.ctx })) || destroy;
  } catch (e) {
    console.error(e);
    stage.replaceChildren(h("p", { class: "bnote" }, t("loadErr")));
  }
}
