import fs from 'fs';
import * as topo from 'topojson-client';
import * as simp from 'topojson-simplify';
import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
const t = JSON.parse(fs.readFileSync('node_modules/jpn-atlas/japan/japan.json'));
const pre = simp.presimplify(t);
const s = simp.simplify(pre, simp.quantile(pre, 0.975));
const country = topo.feature(s, s.objects.country);
const planar = geoPath(null);
const polys = [];
for (const f of (country.features || [country])) {
  const g = f.geometry;
  for (const c of (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates])) polys.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [c[0]] } });
}
const src = geoAzimuthalEqualArea().center([138.5, 36 - 18 / 60]).rotate([-138.5, -36 + 18 / 60]).scale(1700).translate([2500, -1930]);
const naha = src([127.68, 26.21]);
const isOki = p => { const [cx, cy] = planar.centroid(p); return Math.hypot(cx - naha[0], cy - naha[1]) < 90; };
const latOf = p => src.invert(planar.centroid(p))[1];
const main = polys.filter(p => !isOki(p) && planar.area(p) > 6 && latOf(p) > 30.6);
const oki = polys.filter(p => { const [cx, cy] = planar.centroid(p); return isOki(p) && planar.area(p) > 0.3 && Math.hypot(cx - naha[0], cy - naha[1]) < 26; });
// fit mainland into the view, Okinawa into an inset box
const W = 1000, H = 760;
const bb = fc => { let a = [1e9, 1e9, -1e9, -1e9]; for (const f of fc) { const [[x0, y0], [x1, y1]] = planar.bounds(f); a = [Math.min(a[0], x0), Math.min(a[1], y0), Math.max(a[2], x1), Math.max(a[3], y1)]; } return a; };
const fit = (b, [x0, y0, x1, y1]) => { const k = Math.min((x1 - x0) / (b[2] - b[0]), (y1 - y0) / (b[3] - b[1])); const ox = x0 + ((x1 - x0) - (b[2] - b[0]) * k) / 2, oy = y0 + ((y1 - y0) - (b[3] - b[1]) * k) / 2; return ([x, y]) => [ox + (x - b[0]) * k, oy + (y - b[1]) * k]; };
const fm = fit(bb(main), [200, 14, W - 14, H - 14]);
const box = [[24, 34], [214, 200]];
const fo = fit(bb(oki), [box[0][0] + 18, box[0][1] + 18, box[1][0] - 18, box[1][1] - 18]);
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0; const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len; if (d > dmax) { dmax = d; idx = i; } }
  if (dmax > eps) { const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps); return l.slice(0, -1).concat(r); }
  return [a, b];
}
const ringRdp = (r, eps) => { const h = Math.floor(r.length / 2); return rdp(r.slice(0, h + 1), eps).slice(0, -1).concat(rdp(r.slice(h), eps)); };
const toPath = (f, tf, eps = 1.1) => f.geometry.coordinates.map(r => { const pts = ringRdp(r.map(tf), eps); return pts.length < 4 ? '' : 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L') + 'Z'; }).join('');
const cities = [
  ['Sapporo', 'さっぽろ', 141.35, 43.06, 'north'], ['Sendai', 'せんだい', 140.87, 38.27, 'north'], ['Niigata', 'にいがた', 139.02, 37.92, 'snow'],
  ['Tokyo', 'とうきょう', 139.69, 35.69, 'pacific'], ['Nagoya', 'なごや', 136.91, 35.18, 'pacific'], ['Osaka', 'おおさか', 135.50, 34.69, 'pacific'],
  ['Hiroshima', 'ひろしま', 132.46, 34.39, 'pacific'], ['Kochi', 'こうち', 133.53, 33.56, 'pacific'], ['Fukuoka', 'ふくおか', 130.40, 33.59, 'pacific'],
  ['Nagasaki', 'ながさき', 129.87, 32.75, 'pacific'], ['Kagoshima', 'かごしま', 130.56, 31.60, 'pacific'], ['Naha', 'なは', 127.68, 26.21, 'south'],
].map(([en, ja, lon, lat, zone]) => { const p = (en === 'Naha' ? fo : fm)(src([lon, lat])); return { en, ja, x: +p[0].toFixed(1), y: +p[1].toFixed(1), zone }; });
const out = { w: W, h: H, credit: '地図: 地球地図日本（国土地理院）を加工', land: main.map(f => toPath(f, fm)).filter(Boolean), okinawa: oki.map(f => toPath(f, fo, 0.7)).filter(Boolean), okinawaBox: box, cities };
fs.writeFileSync('japan-map.json', JSON.stringify(out));
console.log('main', main.length, 'oki', oki.length, 'KB', (JSON.stringify(out).length / 1024).toFixed(0));
