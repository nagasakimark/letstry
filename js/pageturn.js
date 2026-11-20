// A paper page turn, like turning a page of the real textbook.
//
// The textbook pictures are two-page spreads, so turning forward lifts the right-hand page by
// its bottom corner and turns it over the middle: a fold line sweeps across it, the part past
// the fold is cut away to show the next spread's right page underneath (with a soft shadow on
// it), and that part is mirrored across the fold to become the back of the sheet — the next
// spread's left page — which lands on the left. Single pages turn at their left edge, with a
// paper back that shows the print faintly through it.
// Turning back is the same movement played in reverse, from the previous spread to this one.

const DUR = 720;
let active = null;

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Copy of a page for the animation (no buttons to press, no ids)
function snapshot(sheet, w, h) {
  const c = sheet.cloneNode(true);
  c.classList.remove("pending", "turn-next", "turn-prev", "zoom-anim");
  c.removeAttribute("id");
  c.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
  c.querySelectorAll("canvas").forEach(e => e.remove());              // (empty copies of the ink layer)
  Object.assign(c.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px", margin: "0",
    transform: "none", boxShadow: "none", pointerEvents: "none", visibility: "visible", animation: "none" });
  return c;
}

// Keep the part of the polygon on the side where side(p) <= 0 (one Sutherland–Hodgman pass).
function clip(poly, side) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa <= 0) !== (sb <= 0)) { const k = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out;
}
const poly = pts => pts.length >= 3 ? `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})` : "polygon(0 0,0 0,0 0)";

// A linear gradient across the fold: `stops` are [distance from the fold in px, colour].
function foldGradient(W, H, M, n, stops) {
  const deg = Math.atan2(n[0], -n[1]) * 180 / Math.PI;               // CSS angle whose direction is n
  const L = Math.abs(W * n[0]) + Math.abs(H * n[1]);                  // length of the gradient line
  const at = ((M[0] - W / 2) * n[0] + (M[1] - H / 2) * n[1]) / L + .5; // where the fold falls along it (0..1)
  return `linear-gradient(${deg.toFixed(2)}deg, ${stops.map(([d, c]) => `${c} ${((at + d / L) * 100).toFixed(2)}%`).join(", ")})`;
}

export function cancelTurn() { if (active) active.stop(); }

// Capture the page that's about to be turned. Returns a function that animates the turn
// once the new page is on screen (call it with the new page's sheet element).
export function prepareTurn(oldSheet, dir) {
  cancelTurn();
  // (plays even with "reduce motion" on: it only ever happens when someone turns a page, and
  // school computers often have that setting on without anyone choosing it)
  if (!oldSheet || oldSheet.classList.contains("pending")) return null;
  const r0 = oldSheet.getBoundingClientRect();
  if (r0.width < 50) return null;
  const oldCopy = snapshot(oldSheet, r0.width, r0.height);
  return async newSheet => {
    // wait for the new page's picture (it stays hidden until ready)
    const t0 = performance.now();
    while (newSheet.classList.contains("pending") && performance.now() - t0 < 1500) await new Promise(r => requestAnimationFrame(r));
    if (!newSheet.isConnected) return;
    const r = newSheet.getBoundingClientRect();
    const W = r.width, H = r.height;
    const fwd = dir !== "prev";
    const newCopy = () => snapshot(newSheet, W, H);
    const fit = el => { Object.assign(el.style, { width: W + "px", height: H + "px" }); return el; };
    // Textbook pictures are two-page spreads: the right-hand page turns over the middle (S = W/2),
    // and the back of the turning sheet is the next spread's left page. A single page turns at its left edge.
    const spread = W / H > 1.15;
    const S = spread ? W / 2 : 0;
    // In forward terms A is the spread being turned away from and B the one being revealed.
    // Going back plays the forward turn in reverse, from the previous spread (A) to this one (B).
    const A = fwd ? fit(oldCopy) : newCopy();
    const B = fwd ? (spread ? newCopy() : null) : fit(oldCopy);

    const box = document.createElement("div");
    box.className = "pageturn" + (spread ? " spread" : "");
    Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: W + "px", height: H + "px" });
    const layer = cls => { const d = document.createElement("div"); d.className = cls; return d; };
    // what lies underneath: going forward the real new page is already there; going back it isn't
    if (!fwd) { const under = layer("pt-under"); under.append(B.cloneNode(true)); box.append(under); }
    // left page of A stays until the turning sheet lands on it
    if (spread) { const base = layer("pt-base"); base.append(A.cloneNode(true)); base.style.clipPath = `inset(0 ${W - S}px 0 0)`; box.append(base); }
    const shade = layer("pt-shade");
    const front = layer("pt-front"); front.append(A);
    const frontFold = layer("pt-fill"); front.append(frontFold);
    const backWrap = layer("pt-backwrap");
    const back = layer("pt-back" + (spread ? " printed" : ""));
    let backPrint;
    if (spread) { backPrint = B; backPrint.classList.add("pt-mirror"); }      // B's left page, mirrored so it reads right once turned over
    else { backPrint = A.cloneNode(true); backPrint.classList.add("pt-print"); } // paper, with the print showing through
    const backShade = layer("pt-fill");
    back.append(backPrint, backShade);
    backWrap.append(back);
    const cast = layer("pt-cast");                      // the sheet's shadow on the page below (an offset copy of its shape: no blur, so it stays smooth on Chromebooks)
    box.append(shade, front, cast, backWrap);
    document.body.append(box);
    newSheet.classList.add("pt-under-real");

    const rect = [[S, 0], [W, 0], [W, H], [S, H]];       // the turning sheet
    const C = [W, H];                                    // its bottom outer corner
    const span = W - S;
    const frame = t => {
      const e = ease(t);
      // the corner travels over the spine to where it lands, rising on the way
      const P = [W - 2 * span * e, H - Math.sin(Math.PI * e) * H * (spread ? .28 : .32)];
      const dx = C[0] - P[0], dy = C[1] - P[1], len = Math.hypot(dx, dy);
      if (len < .5) {                                    // not lifted yet
        front.style.clipPath = spread ? `inset(0 0 0 ${S}px)` : "none"; back.style.clipPath = shade.style.clipPath = poly([]);
        frontFold.style.background = "none"; cast.style.clipPath = poly([]); return;
      }
      const n = [dx / len, dy / len];                    // fold normal, pointing at the lifted corner
      const M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];  // a point on the fold
      const side = p => (p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1];
      const keep = clip(rect, side), gone = clip(rect, p => -side(p));
      front.style.clipPath = poly(keep);
      shade.style.clipPath = poly(gone);
      back.style.clipPath = poly(gone);
      // mirror the lifted part across the fold: x' = x - 2((x - M)·n) n
      const k = 2 * (M[0] * n[0] + M[1] * n[1]);
      back.style.transform = `matrix(${1 - 2 * n[0] * n[0]},${-2 * n[0] * n[1]},${-2 * n[0] * n[1]},${1 - 2 * n[1] * n[1]},${k * n[0]},${k * n[1]})`;
      const depth = Math.min(1, len / (span * .6));      // shadows deepen as the sheet lifts
      const s = Math.sin(Math.PI * e);
      shade.style.background = foldGradient(W, H, M, n, [[0, `rgba(0,0,0,${(.42 * s + .08) * depth})`], [span * .06, `rgba(0,0,0,${.16 * s * depth})`], [span * .22, "rgba(0,0,0,0)"]]);
      frontFold.style.background = foldGradient(W, H, M, n, [[-span * .1, "rgba(0,0,0,0)"], [-span * .015, `rgba(0,0,0,${.12 * depth})`], [0, `rgba(0,0,0,${.22 * depth})`]]);
      backShade.style.background = spread
        ? foldGradient(W, H, M, n, [[0, `rgba(0,0,0,${.22 * s})`], [span * .04, `rgba(255,255,255,${.12 * s})`], [span * .16, "rgba(255,255,255,0)"], [span * .9, `rgba(0,0,0,${.10 * s})`]])
        : foldGradient(W, H, M, n, [[0, "rgba(0,0,0,.20)"], [span * .03, "rgba(255,255,255,.10)"], [span * .12, "rgba(255,255,255,0)"], [span * .5, "rgba(0,0,0,.08)"]]);
      cast.style.clipPath = poly(gone);
      cast.style.transform = `translate(${(-n[0] * 7 * depth).toFixed(1)}px,${(3 * depth).toFixed(1)}px) ${back.style.transform}`;
      cast.style.opacity = (.16 * depth * (.4 + .6 * s)).toFixed(3);
    };
    let raf = 0, done = false;
    const stop = () => { if (done) return; done = true; cancelAnimationFrame(raf); box.remove(); newSheet.classList.remove("pt-under-real"); if (active && active.stop === stop) active = null; };
    active = { stop };
    frame(fwd ? 0 : 1);
    const start = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - start) / DUR);
      frame(fwd ? p : 1 - p);
      if (p < 1) raf = requestAnimationFrame(tick); else stop();
    };
    raf = requestAnimationFrame(tick);
  };
}
