// Service worker
// - The app shell is cached on install so the site opens without a connection.
// - Images and audio are cached as they're used.
// - Books saved with "Use offline" live in their own caches (letstry-offline-*),
//   including videos, which are served here with byte-range support so they can seek.
const VERSION = "letstry-v8";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/ui.js", "js/media.js", "js/layers.js",
  "js/viewer.js", "js/pen.js", "js/board.js", "js/rps.js", "js/flipbook.js", "js/zoom.js", "js/timer.js",
  "js/offline.js", "js/i18n.js", "fonts/Pook.woff2",
  "js/bonus/index.js", "js/bonus/common.js", "js/bonus/weather.js", "js/bonus/howmany.js", "js/bonus/slot.js",
  "js/bonus/cardmaker.js", "js/bonus/clock.js", "js/bonus/picker.js", "media/bonus/weather/japan.webp",
  "media/bonus/clock/face.webp", "media/bonus/clock/hour.webp", "media/bonus/clock/minute.webp",
  "data/lt1.json", "data/lt2.json", "data/stories.json",
  "data/offline-lt1.json", "data/offline-lt2.json", "data/offline-stories.json", "icons/icon.svg", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k !== VERSION && !k.startsWith("letstry-offline-"))
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function ranged(res, range) {
  const blob = await res.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range || "");
  let start = m && m[1] ? +m[1] : 0;
  let end = m && m[2] ? +m[2] : blob.size - 1;
  if (m && !m[1] && m[2]) { start = blob.size - +m[2]; end = blob.size - 1; }
  end = Math.min(end, blob.size - 1);
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.includes("/media/")) {
    const range = req.headers.get("range");
    e.respondWith((async () => {
      const hit = await caches.match(url.href);               // any cache, incl. offline books
      if (hit) return range ? ranged(hit, range) : hit;
      const res = await fetch(req);
      // cache images & audio as they're used (videos only when a book is saved for offline)
      if (!range && req.cache !== "reload" && res.status === 200 && !url.pathname.endsWith(".mp4")) {
        const c = await caches.open(VERSION); c.put(url.href, res.clone());
      }
      return res;
    })());
    return;
  }
  // app files: network first, cache when offline
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
