// Offline cache: the app shell is cached on install; images, audio and data are
// cached as they are used, so a unit opened once loads instantly next time
// (useful on slow school Wi-Fi). Videos stream normally and are not cached.
const VERSION = "letstry-v1";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/ui.js", "js/media.js", "js/layers.js",
  "js/viewer.js", "js/pen.js", "js/board.js", "js/rps.js", "js/flipbook.js",
  "data/lt1.json", "data/lt2.json", "data/stories.json", "icons/icon.svg", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith(".mp4") || e.request.headers.has("range")) return; // stream video normally
  const isMedia = url.pathname.includes("/media/");
  if (isMedia) {
    // cache-first for images and audio
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok && res.status === 200) c.put(e.request, res.clone());
      return res;
    }));
  } else {
    // network-first for the app itself, falling back to cache when offline
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  }
});
