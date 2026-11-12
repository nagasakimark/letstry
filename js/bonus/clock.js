// What time is it? (Let's Try! 2, Unit 4). Clock art: いらすとや (irasutoya.com)
import { h, icon } from "../ui.js";
import { t, getLang } from "../i18n.js";
import { seg, btn } from "./common.js";

// measured from the irasutoya parts (486×486 face; hands pivot on their black dot)
const FACE = { w: 486, cx: 239.5, cy: 240.6 };
const HOUR = { w: 59, h: 146, px: 30.6, py: 118.0 };
const MIN = { w: 63, h: 180, px: 31.6, py: 152.1 };
const ROUTINE = { 6: "wake-up time", 7: "breakfast time", 8: "study time", 12: "lunch time", 15: "snack time", 16: "homework time", 18: "dinner time", 19: "bath time", 20: "TV time", 21: "bed time" };

function hand(spec, src, cls) {
  const img = h("img", { src, alt: "", class: "hand " + cls, draggable: "false" });
  Object.assign(img.style, {
    left: (FACE.cx - spec.px) / FACE.w * 100 + "%", top: (FACE.cy - spec.py) / FACE.w * 100 + "%",
    width: spec.w / FACE.w * 100 + "%", transformOrigin: `${spec.px / spec.w * 100}% ${spec.py / spec.h * 100}%`,
  });
  return img;
}

export function mount(stage) {
  const ja = getLang() === "ja";
  const st = { step: 60, h24: 7, m: 0, shown: false, total: 7 * 60 };   // total minutes on the dial since 0:00 (for smooth turning)
  let saved = null; try { saved = +localStorage.getItem("clockStep"); } catch {}
  if ([60, 30, 5].includes(saved)) st.step = saved;
  const hourH = hand(HOUR, "media/bonus/clock/hour.webp", "hh");
  const minH = hand(MIN, "media/bonus/clock/minute.webp", "mh");
  const dial = h("div", { class: "dial" }, h("img", { src: "media/bonus/clock/face.webp", alt: "", class: "face", draggable: "false" }), hourH, minH);
  const sky = h("div", { class: "sky" });
  const answer = h("div", { class: "ckans", hidden: true });
  const q = h("div", { class: "ckq" }, h("b", {}, "What time is it?"));
  const side = h("div", { class: "ckside" }, q, sky, answer);
  const nextBtn = btn("dice", t("ck_new"), () => newTime(), "pill");
  const ansBtn = btn("check", t("ck_answer"), () => reveal(), "pill ghost");
  const stepSeg = seg([[60, ja ? "ちょうど" : "o'clock"], [30, ja ? "30分" : ":30"], [5, ja ? "5分" : "5 min"]], st.step, v => {
    st.step = v; try { localStorage.setItem("clockStep", v); } catch {}
  }, "small");
  stage.append(h("div", { class: "bpanel ckpanel" }, h("div", { class: "ckarea" }, h("div", { class: "dialbox" }, dial), side),
    h("div", { class: "bbar" }, nextBtn, ansBtn, stepSeg),
    h("div", { class: "credit2" }, "時計のイラスト: いらすとや")));

  function draw(animate) {
    const mins = st.total;
    hourH.style.transition = minH.style.transition = animate ? "transform 1.6s cubic-bezier(.3,.7,.2,1)" : "none";
    minH.style.transform = `rotate(${mins * 6}deg)`;          // 360° per 60 min
    hourH.style.transform = `rotate(${mins * 0.5}deg)`;       // 360° per 12 h
    const day = st.h24 >= 6 && st.h24 < 18;
    sky.className = "sky " + (day ? "day" : "night");
    sky.replaceChildren(h("span", { class: "skyicon" }, day ? "☀️" : "🌙"), h("span", {}, day ? (ja ? "ひる" : "day") : (ja ? "よる" : "night")));
  }
  function words() {
    const h12 = st.h24 % 12 || 12, ap = st.h24 < 12 ? "a.m." : "p.m.";
    const text = st.m === 0 ? `It's ${h12} ${ap}` : `It's ${h12}:${String(st.m).padStart(2, "0")} ${ap}`;
    return { text, digital: `${h12}:${String(st.m).padStart(2, "0")}`, ap };
  }
  function newTime(first = false) {
    answer.hidden = true; st.shown = false;
    let h24, m;
    do { h24 = Math.floor(Math.random() * 24); m = Math.floor(Math.random() * (60 / st.step)) * st.step; }
    while (!first && h24 === st.h24 && m === st.m);
    // always turn the hands forwards, at least a little way round
    const from = st.total, cur = from % 720, want = (h24 % 12) * 60 + m;
    let add = (want - cur + 720) % 720; if (add < 60 && !first) add += 720;
    st.h24 = h24; st.m = m; st.total = first ? want : from + add;
    draw(!first);
  }
  function reveal() {
    const w = words();
    const r = ROUTINE[st.h24] && st.m === 0 ? ROUTINE[st.h24] : null;
    answer.hidden = false;
    answer.replaceChildren(h("div", { class: "digital" }, w.digital, h("small", {}, w.ap)), h("b", {}, /\.$/.test(w.text) ? w.text : w.text + "."), r ? h("small", {}, `It's ${r}.`) : null);
  }
  newTime(true);
  return () => {};
}
