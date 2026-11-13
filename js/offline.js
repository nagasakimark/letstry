// Offline copies, kept in Cache Storage (one cache per part, letstry-offline-<id>):
//   app      the app itself (page, code, styles, fonts, data, icons, game pictures)
//   lt1/lt2  each textbook's pictures, audio and videos
//   stories  the picture books
// Each cache also holds its own record (which files, with their fingerprints), so an update only
// downloads what changed, and every start-up checks that nothing has gone missing.
import { t } from "./i18n.js";

export const PARTS = ["app", "lt1", "lt2", "stories"];
const CACHE = id => `letstry-offline-${id}`;
const KEY = id => `offline:${id}`;              // older copies kept their record here (no fingerprints)
const abs = f => new URL(f, location.href).href;
const REC = abs("__offline-record.json");
const manifests = {};
const state = {};            // id -> {status: none|busy|ready|broken|error, progress, missing, stale}
const subs = new Set();
export const onOffline = f => subs.add(f);
const emit = id => subs.forEach(f => f(id, state[id]));
export const offlineState = id => state[id] || { status: "none" };

async function manifest(id) {
  manifests[id] ||= fetch(`data/offline-${id}.json`, { cache: "no-cache" }).then(r => { if (!r.ok) throw 0; return r.json(); })
    .catch(() => { delete manifests[id]; throw new Error("manifest"); });
  return manifests[id];
}
export async function sizeOf(id) { try { return (await manifest(id)).bytes; } catch { return 0; } }

async function readRec(cache, id) {
  try { const r = await cache.match(REC); if (r) return await r.json(); } catch {}
  try {                                          // a copy saved by an older version of the app
    const old = JSON.parse(localStorage.getItem(KEY(id)) || "null");
    if (old) return { version: old.version, legacy: true, files: Object.fromEntries((old.files || []).map(f => [f, null])) };
  } catch {}
  return null;
}
async function writeRec(cache, id, rec) {
  await cache.put(REC, new Response(JSON.stringify(rec), { headers: { "Content-Type": "application/json" } }));
  try { localStorage.setItem(KEY(id), JSON.stringify({ version: rec.version, date: rec.date })); } catch {}
}

// What needs fetching for this part: files that are missing or have changed.
async function plan(id) {
  const cache = await caches.open(CACHE(id));
  const have = new Set((await cache.keys()).map(r => r.url));
  const rec = await readRec(cache, id);
  let m = null;
  try { m = await manifest(id); } catch { /* offline: check against the record */ }
  if (!m) {
    const files = rec ? Object.keys(rec.files) : [];
    return { cache, rec, m, have, missing: files.filter(f => !have.has(abs(f))), todo: [], changed: 0 };
  }
  const todo = [];
  let changed = 0;
  for (const row of m.files) {
    const [f, size, fp] = row;
    const url = abs(f);
    if (!have.has(url)) { todo.push(row); continue; }
    const was = rec && rec.files[f];
    if (was === fp) continue;
    if (rec && rec.legacy && was === null) {
      // older record without fingerprints: trust a cached file of the right size
      const hit = await cache.match(url);
      const len = hit && +hit.headers.get("Content-Length");
      if (len && len === size) continue;
    }
    todo.push(row); changed++;
  }
  const missing = todo.filter(([f]) => !have.has(abs(f))).map(([f]) => f);
  return { cache, rec, m, have, missing, todo, changed };
}

// Is the saved copy complete and up to date?
export async function verify(id) {
  if (!("caches" in window)) { state[id] = { status: "none" }; emit(id); return state[id]; }
  try {
    const p = await plan(id);
    if (!p.rec && p.have.size === 0) state[id] = { status: "none" };
    else if (!p.rec) state[id] = { status: "broken", missing: p.todo.length };
    else state[id] = { status: p.missing.length || p.changed ? "broken" : "ready", missing: p.missing.length, stale: p.changed };
    // an older-style copy that checks out: give it a proper record so this is quick from now on
    if (state[id].status === "ready" && p.rec.legacy && p.m)
      await writeRec(p.cache, id, { version: p.m.version, date: Date.now(), files: Object.fromEntries(p.m.files.map(([f, , fp]) => [f, fp])) });
  } catch {
    state[id] = { status: "broken" };
  }
  emit(id);
  return state[id];
}

// Download (or bring up to date) one part. onBytes(n) reports progress for "install everything".
export async function download(id, { onBytes } = {}) {
  if (state[id] && state[id].status === "busy") return state[id];
  state[id] = { status: "busy", progress: 0 }; emit(id);
  try {
    const p = await plan(id);
    if (!p.m) throw new Error("fetch");
    const need = p.todo.reduce((a, [, s]) => a + s, 0);
    if (need && navigator.storage && navigator.storage.estimate) {
      const { quota = Infinity, usage = 0 } = await navigator.storage.estimate();
      if (quota - usage < need * 1.05) throw new Error("space");
    }
    protect();
    let done = p.m.bytes - need;
    const report = () => { state[id] = { status: "busy", progress: p.m.bytes ? done / p.m.bytes : 1 }; emit(id); };
    report();
    const queue = p.todo.slice();
    let failed = 0;
    const worker = async () => {
      while (queue.length) {
        const [f, size] = queue.shift();
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(f, { cache: "reload" });
            if (!res.ok || res.status !== 200) throw new Error(res.status);
            await p.cache.put(abs(f), res);
            done += size; onBytes && onBytes(size); report();
            break;
          } catch (e) {
            if (e && e.name === "QuotaExceededError") throw new Error("space");
            if (attempt === 2) failed++;
            else await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (failed) throw new Error("fetch");
    // tidy away files this part no longer uses
    const keep = new Set(p.m.files.map(([f]) => abs(f)).concat(REC));
    for (const r of await p.cache.keys()) if (!keep.has(r.url)) await p.cache.delete(r);
    await writeRec(p.cache, id, { version: p.m.version, date: Date.now(), files: Object.fromEntries(p.m.files.map(([f, , fp]) => [f, fp])) });
    const st = await verify(id);
    if (st.status === "ready" && need) { st.justDone = true; emit(id); st.justDone = false; }
    return st;
  } catch (e) {
    state[id] = { status: "error", reason: e.message === "space" ? "space" : "fetch" };
    emit(id);
    return state[id];
  }
}

export async function remove(id) {
  await caches.delete(CACHE(id));
  try { localStorage.removeItem(KEY(id)); } catch {}
  state[id] = { status: "none" }; emit(id);
}

// ---- the whole app at once
const allSubs = new Set();
export const onInstallAll = f => allSubs.add(f);
let all = { busy: false };
export const installAllState = () => all;
export async function installAll() {
  if (all.busy) return;
  const sizes = await Promise.all(PARTS.map(async id => {
    const p = await plan(id).catch(() => null);
    return p && p.m ? p.todo.reduce((a, [, s]) => a + s, 0) : 0;
  }));
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  let got = 0;
  all = { busy: true, progress: 0, part: PARTS[0] };
  allSubs.forEach(f => f(all));
  await protect();
  for (const id of PARTS) {
    all.part = id; allSubs.forEach(f => f(all));
    const st = await download(id, { onBytes: n => { got += n; all.progress = got / total; allSubs.forEach(f => f(all)); } });
    if (st.status !== "ready") { all = { busy: false, error: st.reason || "fetch", part: id }; allSubs.forEach(f => f(all)); return all; }
  }
  try { localStorage.setItem("offline:all", "1"); } catch {}
  all = { busy: false, done: true };
  allSubs.forEach(f => f(all));
  return all;
}
export const wantsAll = () => { try { return localStorage.getItem("offline:all") === "1"; } catch { return false; } };
export const allReady = () => PARTS.every(id => offlineState(id).status === "ready");

// ---- keeping it safe
// Persistent storage means the browser won't clear it to make room (only the user can).
// Chrome grants it quietly for installed apps and sites people use a lot.
export async function protect() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}
export async function isProtected() {
  try { return !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch { return false; }
}
export async function storageUse() {
  try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
}

// On every start-up (and when the connection comes back): check every saved part, quietly
// repair anything missing or out of date when online, and say so when offline.
let warned = false, repairing = false;
export async function checkAll(names, say) {
  if (repairing) return;
  const res = await Promise.all(PARTS.map(async id => [id, await verify(id)]));
  const saved = res.filter(([, s]) => s.status !== "none");
  if (saved.length) protect();
  // after "save everything", a part that has vanished completely is put back too
  const want = wantsAll();
  const broken = res.filter(([, s]) => s.status === "broken" || s.status === "error" || (want && s.status === "none"));
  if (!broken.length) return;
  if (navigator.onLine) {
    repairing = true;
    say(t("offlineRepairing"), 4000);
    let ok = true;
    for (const [id] of broken) ok = (await download(id)).status === "ready" && ok;
    repairing = false;
    say(ok ? t("offlineRepaired") : t("offlineRepairFail"), 5000);
  } else if (!warned) {
    warned = true;
    const lost = broken.filter(([, s]) => s.missing || s.status === "none").map(([id]) => names[id]).filter(Boolean);
    if (lost.length) say(t("offlineLost", { book: lost.join(" / ") }), 7000);
  }
}
