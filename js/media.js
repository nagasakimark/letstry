// Audio bar, custom video player, chant player
import { h, icon } from "./ui.js";
import { openLayer } from "./layers.js";
import { t } from "./i18n.js";

const fmt = s => !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const RATES = [1, 0.75, 0.5];
const rateLabel = r => (r === 1 ? "1" : String(r).replace(/^0/, "")) + "×";

// A draggable progress bar shared by the audio bar and the video player.
function scrubber(media) {
  const buf = h("i", { class: "buf" }), prog = h("i", { class: "prog" }), knob = h("i", { class: "knob" });
  const el = h("div", { class: "scrub", role: "slider", "aria-label": "Position", tabindex: "0" },
    h("div", { class: "track" }, buf, prog), knob);
  const seekTo = x => {
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (x - r.left) / r.width));
    if (media.duration) media.currentTime = f * media.duration;
    paint();
  };
  el.addEventListener("pointerdown", e => {
    el.setPointerCapture(e.pointerId); el.classList.add("drag"); seekTo(e.clientX);
    const mv = ev => seekTo(ev.clientX);
    const up = () => { el.classList.remove("drag"); el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up);
  });
  el.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { media.currentTime += 5; e.preventDefault(); e.stopPropagation(); }
    if (e.key === "ArrowLeft") { media.currentTime -= 5; e.preventDefault(); e.stopPropagation(); }
  });
  function paint() {
    const d = media.duration || 0, f = d ? media.currentTime / d : 0;
    prog.style.width = knob.style.left = f * 100 + "%";
    let b = 0;
    try { if (media.buffered.length) b = media.buffered.end(media.buffered.length - 1) / (d || 1); } catch {}
    buf.style.width = Math.min(1, b) * 100 + "%";
    el.setAttribute("aria-valuenow", Math.round(f * 100));
  }
  ["timeupdate", "progress", "loadedmetadata", "seeked", "emptied"].forEach(ev => media.addEventListener(ev, paint));
  return el;
}

// ------------------------------------------------------------------ audio
const audio = new Audio();
audio.preload = "auto";
let bar, mainBtn, rateBtn, currentEl = null, rateIdx = 0;

function buildBar() {
  mainBtn = h("button", { class: "ib main", type: "button", "aria-label": t("playPause"), onclick: () => audio.paused ? audio.play() : audio.pause() }, icon("pause"));
  rateBtn = h("button", { class: "chip", type: "button", title: t("speed"), onclick: () => {
    rateIdx = (rateIdx + 1) % RATES.length; audio.playbackRate = RATES[rateIdx]; rateBtn.textContent = rateLabel(RATES[rateIdx]);
  } }, "1×");
  bar = h("div", { class: "audiobar", hidden: true, role: "region", "aria-label": "Audio" },
    mainBtn,
    h("button", { class: "ib", type: "button", "aria-label": t("again"), title: t("again"), onclick: () => { audio.currentTime = 0; audio.play(); } }, icon("replay")),
    scrubber(audio), rateBtn,
    h("button", { class: "ib", type: "button", "aria-label": t("close"), title: t("close"), onclick: stopAudio }, icon("close")));
  document.body.append(bar);
  audio.addEventListener("play", () => mainBtn.replaceChildren(icon("pause")));
  audio.addEventListener("pause", () => mainBtn.replaceChildren(icon("play")));
  audio.addEventListener("ended", () => markPlaying(null));
}
function markPlaying(el) {
  if (currentEl) currentEl.classList.remove("playing");
  currentEl = el;
  if (el) el.classList.add("playing");
}
export function playAudio(src, el = null, { showBar = true } = {}) {
  if (!bar) buildBar();
  document.querySelectorAll("video").forEach(v => v.pause());
  audio.onended = null;
  audio.src = src;
  audio.playbackRate = RATES[rateIdx];
  audio.play().catch(() => {});
  markPlaying(el);
  bar.hidden = !showBar;
  return audio;
}
export function stopAudio() {
  audio.pause(); audio.onended = null;
  audio.removeAttribute("src"); audio.load();
  markPlaying(null);
  if (bar) bar.hidden = true;
}

// ------------------------------------------------------------------ video
// Custom player: always-visible controls, and the picture is the largest box
// of the video's own shape that fits the space (never cropped, never overflowing).
export function videoPlayer({ src, head = [], extra = [], rates = true, autoplay = true }) {
  const video = h("video", { playsinline: true, preload: "auto" });
  const frame = h("div", { class: "frame" }, video,
    h("button", { class: "bigplay", type: "button", "aria-label": t("play") }, icon("play")), h("i", { class: "spin" }));
  const big = frame.querySelector(".bigplay");
  const root = h("div", { class: "vp" }, h("div", { class: "head" }, head), h("div", { class: "stage" }, frame));
  const main = h("button", { class: "ib main", type: "button", "aria-label": t("playPause") }, icon("play"));
  const time = h("span", { class: "time" }, "0:00 / 0:00");
  let rIdx = 0;
  const rateBtn = rates ? h("button", { class: "chip", type: "button", title: t("speed"), onclick: () => {
    rIdx = (rIdx + 1) % RATES.length; video.playbackRate = RATES[rIdx]; rateBtn.textContent = rateLabel(RATES[rIdx]);
  } }, "1×") : null;
  const mute = h("button", { class: "ib", type: "button", "aria-label": t("mute"), title: t("mute"), onclick: () => { video.muted = !video.muted; mute.replaceChildren(icon(video.muted ? "mute" : "speaker")); } }, icon("speaker"));
  const full = h("button", { class: "ib", type: "button", "aria-label": t("full"), title: t("full"), onclick: () => {
    if (document.fullscreenElement === frame) document.exitFullscreen(); else frame.requestFullscreen().catch(() => {});
  } }, icon("full"));
  const replay = h("button", { class: "ib", type: "button", "aria-label": t("startAgain"), title: t("startAgain"), onclick: () => { video.currentTime = 0; video.play(); } }, icon("replay"));
  const vbar = h("div", { class: "vbar" }, main, replay, time, scrubber(video), rateBtn, ...extra, mute, full);
  root.append(vbar);

  const toggle = () => video.paused || video.ended ? video.play() : video.pause();
  main.onclick = toggle; big.onclick = e => { e.stopPropagation(); toggle(); };
  frame.addEventListener("click", toggle);
  frame.addEventListener("dblclick", () => full.click());
  video.addEventListener("play", () => { root.classList.add("playing"); main.replaceChildren(icon("pause")); });
  video.addEventListener("pause", () => { root.classList.remove("playing"); main.replaceChildren(icon("play")); });
  video.addEventListener("ended", () => { big.classList.add("replay"); big.replaceChildren(icon("replay")); });
  video.addEventListener("playing", () => { big.classList.remove("replay"); big.replaceChildren(icon("play")); root.classList.remove("waiting"); });
  video.addEventListener("waiting", () => root.classList.add("waiting"));
  video.addEventListener("canplay", () => root.classList.remove("waiting"));
  video.addEventListener("timeupdate", () => { time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`; });
  video.addEventListener("loadedmetadata", () => {
    if (video.videoWidth) frame.style.setProperty("--var-ar", video.videoWidth / video.videoHeight);
    time.textContent = `0:00 / ${fmt(video.duration)}`;
  });
  const key = e => {
    if (!root.isConnected || e.target.closest("input, textarea")) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); video.currentTime += 5; }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); video.currentTime -= 5; }
    else if (e.key === "m") mute.click();
  };
  window.addEventListener("keydown", key, true);

  function setSrc(s, play = true) {
    video.src = s; video.load();
    video.playbackRate = RATES[rIdx];
    if (play) video.play().catch(() => {});
  }
  if (src) setSrc(src, autoplay);
  return {
    root, video, setSrc,
    destroy() { window.removeEventListener("keydown", key, true); video.pause(); video.removeAttribute("src"); video.load(); },
  };
}

export function playVideo(src) {
  stopAudio();
  const vp = videoPlayer({ src });
  openLayer(vp.root, { onClose: vp.destroy });
}

// Chant / song player built from {options:[{variants:{normal, slow, karaoke-normal, karaoke-slow, repeat}}]}
export function chantPlayer(screen) {
  stopAudio();
  const opts = screen.chant.options;
  const st = { opt: 0, speed: "normal", mode: "sing" };
  const src = () => {
    const v = opts[st.opt].variants;
    if (st.mode === "repeat" && v.repeat) return v.repeat;
    return v[(st.mode === "karaoke" ? "karaoke-" : "") + st.speed] || v.normal || Object.values(v)[0];
  };
  const sing = /sing/.test(opts[0].base || "");
  const banner = h("h2", { class: "title" }, h("span", { class: "tag" }, sing ? t("song") : t("chant")), sing ? "Let's Sing" : "Let's Chant");
  const optSeg = h("div", { class: "seg", role: "group", "aria-label": "Chant number" });
  const speedSeg = h("div", { class: "seg", role: "group", "aria-label": "Speed" });
  const modeSeg = h("div", { class: "seg", role: "group", "aria-label": "Voice" });
  const vp = videoPlayer({ head: [banner, opts.length > 1 ? optSeg : null].filter(Boolean), extra: [speedSeg, modeSeg], rates: false, autoplay: false });
  const fill = (seg, items, cur, pick, cls = "") => seg.replaceChildren(...items.map(([val, label, title]) =>
    h("button", { type: "button", class: cls, "aria-pressed": String(val === cur), title: title || label, onclick: () => pick(val) }, label)));
  const render = () => {
    const v = opts[st.opt].variants;
    if (st.mode === "repeat" && !v.repeat) st.mode = "sing";
    fill(optSeg, opts.map((o, i) => [i, "①②③④⑤"[i] || String(i + 1), `Chant ${i + 1}`]), st.opt, i => { st.opt = i; change(); }, "num");
    fill(speedSeg, [["normal", t("normal")], ["slow", t("slow")]], st.mode === "repeat" ? null : st.speed, s => { st.speed = s; if (st.mode === "repeat") st.mode = "sing"; change(); });
    fill(modeSeg, [["sing", t("withVoice")], ["karaoke", t("karaoke")], ...(v.repeat ? [["repeat", t("repeat")]] : [])], st.mode, m => { st.mode = m; change(); });
  };
  const change = () => { render(); vp.setSrc(src(), true); };
  render();
  vp.setSrc(src(), true);
  return { root: vp.root, close: vp.destroy };
}
