// Make a whole book available offline (images, audio and video) using Cache Storage,
// and check on every load that it is still complete.
import { t } from "./i18n.js";

const CACHE = id => `letstry-offline-${id}`;
const KEY = id => `offline:${id}`;
const manifests = {};
const state = {};            // id -> {status: none|busy|ready|broken, progress}
const subs = new Set();
export const onOffline = f => subs.add(f);
const emit = id => subs.forEach(f => f(id, state[id]));
export const offlineState = id => state[id] || { status: "none" };

async function manifest(id) {
  manifests[id] ||= fetch(`data/offline-${id}.json`, { cache: "no-cache" }).then(r => r.json())
    .catch(() => { delete manifests[id]; throw new Error("manifest"); });
  return manifests[id];
}
const saved = id => { try { return JSON.parse(localStorage.getItem(KEY(id)) || "null"); } catch { return null; } };
const save = (id, v) => { try { v ? localStorage.setItem(KEY(id), JSON.stringify(v)) : localStorage.removeItem(KEY(id)); } catch {} };
const abs = f => new URL(f, location.href).href;

// Is the saved copy still complete (and the same version as the site)?
export async function verify(id) {
  const rec = saved(id);
  if (!rec || !("caches" in window)) { state[id] = { status: "none" }; emit(id); return state[id]; }
  try {
    const cache = await caches.open(CACHE(id));
    const have = new Set((await cache.keys()).map(r => r.url));
    let m = null;
    try { m = await manifest(id); } catch { /* offline: check against what we saved */ }
    const list = m ? m.files.map(([f]) => f) : rec.files || [];
    const missing = list.filter(f => !have.has(abs(f)));
    const stale = m && rec.version !== m.version;
    state[id] = { status: missing.length || stale ? "broken" : "ready", missing: missing.length, stale };
  } catch {
    state[id] = { status: "broken" };
  }
  emit(id);
  return state[id];
}

export async function download(id) {
  if (state[id] && state[id].status === "busy") return;
  state[id] = { status: "busy", progress: 0 }; emit(id);
  try {
    const m = await manifest(id);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if (navigator.storage && navigator.storage.estimate) {
      const { quota = Infinity, usage = 0 } = await navigator.storage.estimate();
      if (quota - usage < m.bytes * 1.05) throw new Error("space");
    }
    const cache = await caches.open(CACHE(id));
    const have = new Set((await cache.keys()).map(r => r.url));
    let done = m.files.filter(([f]) => have.has(abs(f))).reduce((a, [, s]) => a + s, 0);
    const queue = m.files.filter(([f]) => !have.has(abs(f)));
    const report = () => { state[id] = { status: "busy", progress: done / m.bytes }; emit(id); };
    report();
    let failed = 0;
    const worker = async () => {
      while (queue.length) {
        const [f, size] = queue.shift();
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(f, { cache: "reload" });
            if (!res.ok || res.status !== 200) throw new Error(res.status);
            await cache.put(abs(f), res);
            done += size; report();
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
    save(id, { version: m.version, files: m.files.map(([f]) => f), date: Date.now() });
    const st = await verify(id);
    if (st.status === "ready") { st.justDone = true; emit(id); st.justDone = false; }
    return st;
  } catch (e) {
    state[id] = { status: "error", reason: e.message === "space" ? "space" : "fetch" };
    emit(id);
    return state[id];
  }
}

export async function remove(id) {
  await caches.delete(CACHE(id));
  save(id, null);
  state[id] = { status: "none" }; emit(id);
}

// check every saved book on start-up; warn once per session about broken ones
let warned = false;
export async function checkAll(names, warn) {
  const res = await Promise.all(Object.keys(names).map(async id => [id, await verify(id)]));
  const broken = res.filter(([, s]) => s.status === "broken").map(([id]) => names[id]);
  if (broken.length && !warned) { warned = true; warn(t("offlineLost", { book: broken.join(" / ") })); }
}
