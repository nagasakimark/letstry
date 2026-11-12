// Random student picker with a scratch card.
// Set the class size once (remembered). Numbers aren't repeated until everyone has had a turn.
// Scratch the card; after enough is scratched it wipes clean so it's never left half-done.
import { h, icon } from "../ui.js";
import { t } from "../i18n.js";
import { openLayer, closeTop } from "../layers.js";

const KEY = "picker";
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
const st = Object.assign({ size: 30, used: [], noRepeat: true }, load() || {});

function draw() {
  const pool = [];
  for (let i = 1; i <= st.size; i++) if (!st.noRepeat || !st.used.includes(i)) pool.push(i);
  if (!pool.length) { st.used = []; return draw(); }
  const n = pool[Math.floor(Math.random() * pool.length)];
  if (st.noRepeat) st.used.push(n);
  save(st);
  return n;
}

let openRoot = null;   // the picker that's showing, if any

export function openPicker() {
  // the toolbar button toggles: pressing it again closes the picker instead of opening a second one
  if (openRoot && openRoot.isConnected) {
    if (openRoot.closest(".pop") === document.querySelector("#layer .pop:last-child")) closeTop();
    return;
  }
  const root = h("div", { class: "picker" });
  openRoot = root;
  let destroyCard = null;
  openLayer(root, { onClose: () => { destroyCard && destroyCard(); openRoot = null; } });
  setupView();

  function setupView() {
    destroyCard && destroyCard(); destroyCard = null;
    const num = h("output", { class: "pknum" }, st.size);
    const set = v => { st.size = Math.max(2, Math.min(60, v)); st.used = st.used.filter(n => n <= st.size); num.textContent = st.size; save(st); left.textContent = remaining(); };
    const remaining = () => t("pk_left", { n: st.size - (st.noRepeat ? st.used.length : 0) });
    const left = h("span", { class: "pkleft" }, remaining());
    const step = (d, label) => h("button", { class: "ib", type: "button", "aria-label": label, onclick: () => set(st.size + d) }, icon(d > 0 ? "plus" : "minus"));
    const noRep = h("button", { class: "fchip", type: "button", "aria-pressed": String(st.noRepeat), onclick: () => {
      st.noRepeat = !st.noRepeat; noRep.setAttribute("aria-pressed", String(st.noRepeat)); save(st); left.textContent = remaining();
    } }, t("pk_norepeat"));
    const reset = h("button", { class: "olink", type: "button", onclick: () => { st.used = []; save(st); left.textContent = remaining(); } }, t("pk_reset"));
    root.replaceChildren(h("div", { class: "pkset" },
      h("h2", { class: "btitle" }, t("picker")),
      h("div", { class: "pkrow" }, h("span", {}, t("pk_class")), step(-1, "−1"), num, step(1, "+1")),
      h("div", { class: "pkrow" }, noRep, left, reset),
      h("button", { class: "pill pkgo", type: "button", onclick: cardView }, icon("dice"), t("pk_pick"))));
  }

  function cardView() {
    const n = draw();
    const card = h("div", { class: "scard" });
    const face = h("div", { class: "sface" }, h("small", {}, "No."), h("b", {}, n));
    const cv = h("canvas", { class: "scratch" });
    const hint = h("div", { class: "shint" }, t("pk_scratch"));
    card.append(face, cv, hint);
    const again = h("button", { class: "pill", type: "button", onclick: cardView }, icon("dice"), t("pk_again"));
    const showNow = h("button", { class: "pill ghost", type: "button", onclick: () => wipe() }, icon("eye"), t("pk_show"));
    const settings = h("button", { class: "pill ghost", type: "button", onclick: setupView }, icon("grid"), t("pk_settings"));
    root.replaceChildren(h("div", { class: "pkcard" }, card, h("div", { class: "bbar" }, showNow, again, settings),
      h("div", { class: "pkleft" }, st.noRepeat ? t("pk_left", { n: st.size - st.used.length }) : "")));
    destroyCard && destroyCard();
    destroyCard = scratchable(card, cv, hint, () => { showNow.disabled = true; });
    function wipe() { card.dispatchEvent(new Event("wipe")); }
  }
}

function scratchable(card, cv, hint, onDone) {
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  let W = 0, H = 0, done = false;
  function paintFoil() {
    const r = card.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#c9ced6"); g.addColorStop(.45, "#eef1f5"); g.addColorStop(.55, "#b9bfc8"); g.addColorStop(1, "#d8dde4");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // a little texture and a pattern of stars so it looks like a real scratch card
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 40; i++) { ctx.font = `${12 + Math.random() * 18}px sans-serif`; ctx.fillText("★", Math.random() * W, Math.random() * H); }
    ctx.fillStyle = "rgba(80,90,105,.55)"; ctx.font = `700 ${Math.round(H * .11)}px "Zen Maru Gothic", sans-serif`; ctx.textAlign = "center";
    ctx.fillText("SCRATCH!", W / 2, H * .55);
  }
  paintFoil();
  const ro = new ResizeObserver(() => { if (!done) paintFoil(); });
  ro.observe(card);
  let last = null, moves = 0;
  // Only the number decides when to reveal: we sample the foil over the digits themselves
  // (not the whole card), so scratching the edges never gives the answer away.
  const digits = card.querySelector(".sface b");
  function numberBox() {
    const c = card.getBoundingClientRect(), b = digits.getBoundingClientRect();
    // trim the empty space around the glyphs (line box and side bearings)
    const w = b.width * .8, hgt = b.height * .62;
    return [b.left - c.left + (b.width - w) / 2, b.top - c.top + (b.height - hgt) / 2, w, hgt];
  }
  function cleared() {
    const [bx, by, bw, bh] = numberBox();
    const sx = cv.width / W, sy = cv.height / H;
    const d = ctx.getImageData(Math.max(0, Math.floor(bx * sx)), Math.max(0, Math.floor(by * sy)), Math.max(1, Math.ceil(bw * sx)), Math.max(1, Math.ceil(bh * sy)));
    let clear = 0, n = 0;
    for (let gy = 0; gy < 16; gy++) for (let gx = 0; gx < 24; gx++) {
      const x = Math.floor((gx + .5) / 24 * d.width), y = Math.floor((gy + .5) / 16 * d.height);
      n++; if (d.data[(y * d.width + x) * 4 + 3] < 40) clear++;
    }
    return clear / n;
  }
  const REVEAL = 0.6;   // share of the number that must be scratched clear
  function scratchAt(x, y) {
    const rad = Math.max(16, W * .045);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    if (last) {
      // a stroke exactly as wide as a single tap
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = rad * 2;
      ctx.moveTo(last[0], last[1]); ctx.lineTo(x, y); ctx.stroke();
    } else {
      ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    last = [x, y];
    // every few strokes, measure how much of the number is really showing
    if (++moves % 5 === 0 && cleared() >= REVEAL) wipe();
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cv.addEventListener("pointerdown", e => {
    if (done) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId); hint.classList.add("gone");
    last = null; scratchAt(...pos(e));
    const mv = ev => { (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]).forEach(c => !done && scratchAt(...pos(c))); };
    const up = () => { last = null; if (!done && cleared() >= REVEAL) wipe(); cv.removeEventListener("pointermove", mv); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); };
    cv.addEventListener("pointermove", mv); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  });
  card.addEventListener("wipe", wipe);
  function wipe() {
    if (done) return;
    done = true; onDone && onDone(); hint.classList.add("gone");
    cv.classList.add("wipe");            // CSS sweeps the remaining foil away with a shine
    card.classList.add("revealed");
    setTimeout(() => { cv.style.display = "none"; }, 700);
  }
  return () => ro.disconnect();
}
