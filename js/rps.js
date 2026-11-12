// Rock-paper-scissors around the world (Let's Try! 1, Unit 3)
import { h, place, icon } from "./ui.js";
import { playAudio } from "./media.js";

export function mountRps(sheetEl, cfg) {
  let lang = cfg.langs[0], busy = false, timer = null, quit = false;
  const img = h("img", { src: cfg.pregame, alt: "" });
  const res = place(h("div", { class: "rps-res" }, img), cfg.result);
  res.style.border = "3px solid #6c6ad8";
  sheetEl.append(res);
  const flags = cfg.langs.map(l => {
    if (!l.rect) return null;
    const b = place(h("button", { class: "hs flag" + (l === lang ? " on" : ""), type: "button", "aria-label": l.label, title: l.label },
      h("img", { src: l.img, alt: "", style: { width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" } })), l.rect);
    b.addEventListener("click", () => { if (busy) return; lang = l; flags.forEach(f => f && f.classList.toggle("on", f === b)); });
    sheetEl.append(b);
    return b;
  });
  const go = place(h("button", { class: "hs", type: "button", "aria-label": "Play rock paper scissors", title: "じゃんけん" },
    h("img", { src: cfg.buttonImg, alt: "", style: { width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" } })), cfg.button);
  go.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    img.src = cfg.pregame;
    img.classList.add("shake");
    playAudio(lang.call, go, { showBar: false });
    const pick = Math.floor(Math.random() * 3);
    timer = setTimeout(() => {
      if (quit) return;
      img.classList.remove("shake");
      img.src = cfg.hands[pick];
      playAudio(lang.hands[pick], go, { showBar: false });
      busy = false;
    }, lang.delay);
  });
  sheetEl.append(go);
  return () => { quit = true; clearTimeout(timer); };
}
