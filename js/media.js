// Audio bar, video lightbox and chant player
import { h, icon } from "./ui.js";
import { openLayer } from "./layers.js";

const audio = new Audio();
audio.preload = "auto";
let bar, fill, playBtn, speedBtn, currentEl = null;
const SPEEDS = [1, 0.75, 0.5];
let speedIdx = 0;

function buildBar() {
  fill = h("i");
  const track = h("div", { class: "track", title: "Seek", onclick: e => {
    const r = track.getBoundingClientRect();
    if (audio.duration) audio.currentTime = audio.duration * ((e.clientX - r.left) / r.width);
  } }, fill);
  playBtn = h("button", { type: "button", "aria-label": "Play or pause", onclick: () => audio.paused ? audio.play() : audio.pause() }, icon("pause"));
  speedBtn = h("button", { type: "button", class: "speed", title: "Playback speed", onclick: () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audio.playbackRate = SPEEDS[speedIdx];
    speedBtn.textContent = SPEEDS[speedIdx] === 1 ? "1×" : SPEEDS[speedIdx] + "×";
  } }, "1×");
  bar = h("div", { class: "audiobar", hidden: true, role: "region", "aria-label": "Audio" },
    playBtn,
    h("button", { type: "button", class: "lite", "aria-label": "Play again", title: "Play again", onclick: () => { audio.currentTime = 0; audio.play(); } }, icon("replay")),
    track, speedBtn,
    h("button", { type: "button", class: "lite", "aria-label": "Stop", title: "Stop", onclick: stopAudio }, icon("close")));
  document.body.append(bar);
  audio.addEventListener("timeupdate", () => { fill.style.width = (audio.duration ? audio.currentTime / audio.duration * 100 : 0) + "%"; });
  audio.addEventListener("play", () => { playBtn.replaceChildren(icon("pause")); });
  audio.addEventListener("pause", () => { playBtn.replaceChildren(icon("play")); });
  audio.addEventListener("ended", () => { fill.style.width = "100%"; markPlaying(null); });
}

function markPlaying(el) {
  if (currentEl) currentEl.classList.remove("playing");
  currentEl = el;
  if (el) el.classList.add("playing");
}

export function playAudio(src, el = null, { showBar = true } = {}) {
  if (!bar) buildBar();
  pauseVideos();
  audio.src = src;
  audio.playbackRate = SPEEDS[speedIdx];
  audio.currentTime = 0;
  audio.play().catch(() => {});
  markPlaying(el);
  bar.hidden = !showBar;
  return audio;
}
export function stopAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  markPlaying(null);
  if (bar) bar.hidden = true;
}
export const audioEl = audio;

function pauseVideos() { document.querySelectorAll("video").forEach(v => v.pause()); }

export function playVideo(src) {
  stopAudio();
  const v = h("video", { src, controls: true, autoplay: true, playsinline: true, preload: "auto" });
  openLayer(h("div", { class: "vid" }, v), { onClose: () => { v.pause(); v.removeAttribute("src"); v.load(); } });
  v.play().catch(() => {});
}

// Chant / song player built from {options:[{label, variants:{normal, slow, karaoke-normal, karaoke-slow, repeat}}]}
const SPEED_LBL = { normal: "ふつう", slow: "ゆっくり" };
export function chantPlayer(screen, onClose) {
  stopAudio();
  const opts = screen.chant.options;
  const st = { opt: 0, speed: "normal", mode: "sing" }; // mode: sing | karaoke | repeat
  const video = h("video", { controls: true, playsinline: true, preload: "auto" });
  const banner = h("div", { class: "banner" }, h("img", { src: screen.image, alt: "", style: { objectFit: "cover", objectPosition: "left top" } }));
  // crop the original title strip from the page image
  const bImg = banner.firstChild;
  bImg.style.height = "auto"; bImg.style.width = "auto";
  bImg.onload = () => {
    const ratio = bImg.naturalWidth / bImg.naturalHeight;
    const hpx = banner.clientHeight;
    // title strip is roughly the top 11% of the image
    bImg.style.height = hpx / 0.11 + "px";
    banner.style.width = Math.min(hpx / 0.11 * ratio * 0.97, banner.parentElement.clientWidth) + "px";
  };
  const controls = h("div", { class: "controls" });

  const key = () => {
    const v = opts[st.opt].variants;
    if (st.mode === "repeat" && v.repeat) return v.repeat;
    const k = (st.mode === "karaoke" ? "karaoke-" : "") + st.speed;
    return v[k] || v.normal || Object.values(v)[0];
  };
  const load = (autoplay = true) => {
    const t = video.currentTime;
    video.src = key();
    video.load();
    if (autoplay) video.play().catch(() => {});
    return t;
  };
  const seg = (items, cur, onPick, cls = "") => h("div", { class: "seg", role: "group" },
    items.map(([val, label, title]) => h("button", { type: "button", class: cls, "aria-pressed": String(val === cur), title: title || label, onclick: () => onPick(val) }, label)));

  const render = () => {
    const v = opts[st.opt].variants;
    controls.replaceChildren(...[
      opts.length > 1 ? seg(opts.map((o, i) => [i, "①②③④⑤"[i] || o.label, `Chant ${i + 1}`]), st.opt, i => { st.opt = i; if (st.mode === "repeat" && !opts[i].variants.repeat) st.mode = "sing"; render(); load(); }, "num") : null,
      seg([["normal", SPEED_LBL.normal, "Normal speed"], ["slow", SPEED_LBL.slow, "Slow"]], st.speed, s => { st.speed = s; if (st.mode === "repeat") st.mode = "sing"; render(); load(); }),
      seg([["sing", "うたあり", "With voice"], ["karaoke", "カラオケ", "Karaoke (no voice)"], ...(v.repeat ? [["repeat", "リピート", "Repeat after"]] : [])],
        st.mode, m => { st.mode = m; render(); load(); }),
    ].filter(Boolean));
  };
  render();
  load(true);
  const root = h("div", { class: "chant" }, banner, h("div", { class: "screen" }, video), controls);
  return { root, close: () => { video.pause(); video.removeAttribute("src"); video.load(); } };
}
