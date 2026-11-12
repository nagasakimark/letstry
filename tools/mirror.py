#!/usr/bin/env python3
"""
Let's Try digital textbook mirror for plip-plop-land.com

Mirrors the Let's Try 1 & 2 digital textbooks (menus, every unit page, and all
images / audio / video they use) plus the Let's Try storybook reader.
The separate games on the site are deliberately NOT crawled.

Pure Python 3 standard library - no installs needed.

    python3 mirror.py                 # mirror everything into ./mirror
    python3 mirror.py --out D:/lt     # choose output folder
    python3 mirror.py --no-storybooks # textbooks only
    python3 mirror.py --dry-run       # discover & list files, download nothing
    python3 mirror.py --refresh       # re-download files even if present

Re-running is safe: files already downloaded (same size) are skipped, and
probe results are cached in <out>/.probe-cache.json.

Afterwards run  `python3 serve.py`  and open http://localhost:8000/letstry1
"""

import argparse
import concurrent.futures as cf
import hashlib
import html.parser
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://www.plip-plop-land.com"

# Only these pages are crawled. Anything else (games, news, etc.) is ignored.
PAGE_RE = re.compile(r"^/(letstry[12](?:-\d{1,2})?|storybooks)$")
BOOK_SEEDS = ["/letstry1", "/letstry2"]
STORY_SEEDS = ["/storybooks"]

# Asset folders we are allowed to pull from (textbook/storybook content,
# plus the reader UI's own css/js/favicons needed for pages to work).
ASSET_RE = re.compile(
    r"^/(letstrydata/|images/|css/(letstry[12]|storybooks)styles\.css|"
    r"js/(letstry[12]app|storybooksapp)\.js|js/letstrypages/|fav/)"
)

MEDIA_EXT = {
    "audio": ["mp3", "m4a", "wav", "ogg"],
    "video": ["mp4", "webm"],
    "images": ["png", "jpg", "jpeg", "gif", "svg", "webp"],
}
ALL_EXT = sorted({e for v in MEDIA_EXT.values() for e in v} | {"css", "js", "json", "ico", "webmanifest"})
EXT_ALT = "|".join(ALL_EXT)

UA = "LetsTryMirror/1.0 (authorised MEXT textbook mirror; contact via plip-plop-land)"


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
class Http:
    def __init__(self, delay=0.0, retries=3, timeout=60):
        self.delay, self.retries, self.timeout = delay, retries, timeout
        self._lock = threading.Lock()
        self._last = 0.0

    def _throttle(self):
        if self.delay <= 0:
            return
        with self._lock:
            wait = self._last + self.delay - time.time()
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()

    def _open(self, url, method="GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
        last_err = None
        for attempt in range(self.retries):
            self._throttle()
            try:
                return urllib.request.urlopen(req, timeout=self.timeout)
            except urllib.error.HTTPError as e:
                if e.code in (404, 410, 403):
                    return e  # definitive answer
                last_err = e
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
                last_err = e
            time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"{method} {url} failed: {last_err}")

    def exists(self, url):
        """HEAD probe -> (exists, size)."""
        r = self._open(url, "HEAD")
        code = getattr(r, "status", None) or r.code
        ctype = r.headers.get("Content-Type", "")
        size = int(r.headers.get("Content-Length") or -1)
        r.close()
        # unknown *pages* come back 200 text/html, but real assets never are html
        ok = code == 200 and not ctype.startswith("text/html")
        return ok, size

    def text(self, url):
        r = self._open(url)
        code = getattr(r, "status", None) or r.code
        if code != 200:
            r.close()
            return None
        data = r.read()
        r.close()
        return data.decode("utf-8", "replace")

    def download(self, url, dest):
        r = self._open(url)
        code = getattr(r, "status", None) or r.code
        if code != 200:
            r.close()
            return None
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        tmp = dest + ".part"
        h = hashlib.sha256()
        size = 0
        with open(tmp, "wb") as f:
            while True:
                chunk = r.read(1 << 16)
                if not chunk:
                    break
                f.write(chunk)
                h.update(chunk)
                size += len(chunk)
        r.close()
        os.replace(tmp, dest)
        return size, h.hexdigest(), r.headers.get("Content-Type", "")


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
class TagCollector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs, self.values = set(), set()

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if not v:
                continue
            if k in ("src", "href", "poster", "data-src"):
                self.refs.add(v)
            if k == "id" or k.startswith("data-"):
                self.values.add(v.strip())
            if k == "style":
                self.refs.update(re.findall(r"url\(['\"]?([^'\")]+)", v))


def norm_path(ref, base_path="/"):
    """Turn a reference into a site-absolute path, or None if off-site."""
    ref = ref.strip()
    if not ref or ref.startswith(("data:", "javascript:", "mailto:", "#", "blob:")):
        return None
    full = urllib.parse.urljoin(SITE + base_path, ref)
    p = urllib.parse.urlparse(full)
    if p.netloc not in ("www.plip-plop-land.com", "plip-plop-land.com"):
        return None
    return urllib.parse.unquote(p.path)


STR_LIT = re.compile(r"""(["'`])((?:\\.|(?!\1).)*?)\1""", re.S)


def js_analyse(js):
    """Return (literal asset paths, dynamic prefixes, suffixes, string values)."""
    literals, prefixes, values = set(), set(), set()
    suffixes = set()
    for _, s in STR_LIT.findall(js):
        # template literals: split on ${...}; keep the static head as a prefix
        parts = re.split(r"\$\{[^}]*\}", s)
        if len(parts) > 1:
            # templates may wrap markup, e.g. `<img src="./letstrydata/x/${id}.png">`
            head, tail = parts[-2] if len(parts) > 2 else parts[0], parts[-1]
            hm = re.search(r"(\.?/?(?:letstrydata|images)/[^\s\"'<>]*)$", head)
            if hm and "letstrydata/" in hm.group(1) or (hm and hm.group(1).lstrip("./").startswith("images/")):
                pre = hm.group(1)
                prefixes.add(pre if pre.startswith(("./", "/")) else "./" + pre)
            tail = re.split(r"[\"'\s>]", tail, 1)[0]
            m = re.fullmatch(r"(-[\w]+)?\.(%s)" % EXT_ALT, tail)
            if m:
                suffixes.add(tail)
            continue
        if re.search(r"\.(%s)$" % EXT_ALT, s, re.I) and "/" in s:
            literals.add(s)
        elif ("letstrydata/" in s or s.startswith(("./images/", "/images/"))) and (
            s.endswith("/") or s.endswith("-") or s.endswith("_")
        ):
            prefixes.add(s)
        elif re.fullmatch(r"(-[\w]+)?\.(%s)" % EXT_ALT, s):
            suffixes.add(s)  # e.g. ".mp3", "-big.png", "-s.mp3"
        elif re.fullmatch(r"[\w][\w.\-]{0,60}", s):
            values.add(s)  # ids, page names, object keys...
    # unquoted object keys like  page1: "..."
    values.update(re.findall(r"[{,]\s*([A-Za-z_][\w\-]{0,60})\s*:", js))
    return literals, prefixes, suffixes, values


def folder_kind(prefix):
    for kind in MEDIA_EXT:
        if f"/{kind}/" in prefix:
            return kind
    return "images" if "/images/" in prefix else None


# --------------------------------------------------------------------------- #
# Mirror
# --------------------------------------------------------------------------- #
class Mirror:
    def __init__(self, args):
        self.a = args
        self.out = os.path.abspath(args.out)
        self.http = Http(delay=args.delay)
        self.pages = {}          # path -> html
        self.assets = {}         # path -> how found
        self.texts = {}          # css/js path -> text
        self.probe_cache_file = os.path.join(self.out, ".probe-cache.json")
        try:
            with open(self.probe_cache_file) as f:
                self.probe_cache = json.load(f)
        except (OSError, ValueError):
            self.probe_cache = {}
        self.lock = threading.Lock()
        self.manifest = {"site": SITE, "generated": None, "pages": [], "files": [], "external": []}

    def log(self, *a):
        print(*a, flush=True)

    # ---- phase 1: crawl pages ------------------------------------------- #
    def crawl(self):
        queue = list(BOOK_SEEDS) + ([] if self.a.no_storybooks else list(STORY_SEEDS))
        seen = set(queue)
        while queue:
            path = queue.pop(0)
            html_txt = self.http.text(SITE + path)
            # unknown routes return a tiny placeholder page - skip those
            if not html_txt or len(html_txt) < 500 or "<script" not in html_txt:
                continue
            self.pages[path] = html_txt
            self.log(f"  page  {path}")
            tc = TagCollector()
            tc.feed(html_txt)
            for ref in tc.refs:
                p = norm_path(ref, path)
                if p is None:
                    if ref.startswith("http"):
                        self.manifest["external"].append(ref)
                    continue
                if PAGE_RE.match(p) and p not in seen:
                    seen.add(p)
                    queue.append(p)
                elif ASSET_RE.match(p):
                    self.assets.setdefault(p, f"html:{path}")
        self.manifest["external"] = sorted(set(self.manifest["external"]))

    # ---- phase 2: css/js static extraction ------------------------------ #
    def scan_code(self):
        code_paths = [p for p in self.assets if p.endswith((".js", ".css", ".webmanifest"))]
        for p in code_paths:
            t = self.http.text(SITE + p)
            if t is None:
                continue
            self.texts[p] = t
            if p.endswith(".css") or p.endswith(".webmanifest"):
                refs = re.findall(r"url\(['\"]?([^'\")]+)", t) + re.findall(r'"src"\s*:\s*"([^"]+)"', t)
                for r in refs:
                    q = norm_path(r, p)
                    if q and ASSET_RE.match(q):
                        self.assets.setdefault(q, f"css:{p}")
            else:
                lits, _, _, _ = js_analyse(t)
                for r in lits:
                    # js paths are relative to the *page*, which lives at "/"
                    q = norm_path(r, "/")
                    if q and ASSET_RE.match(q):
                        self.assets.setdefault(q, f"js:{p}")

    # ---- phase 3: probe runtime-built URLs ------------------------------ #
    def _probe(self, path):
        if path in self.assets:
            return True
        with self.lock:
            if path in self.probe_cache:
                return self.probe_cache[path]
        try:
            ok, _ = self.http.exists(SITE + urllib.parse.quote(path))
        except RuntimeError as e:
            self.log("   !", e)
            return False
        with self.lock:
            self.probe_cache[path] = ok
            self._since_save = getattr(self, "_since_save", 0) + 1
            if self._since_save >= 250:  # survive interruptions
                self._since_save = 0
                self._write_cache_locked()
        return ok

    def probe(self):
        # Pair each page with its own script(s) so values stay unit-local.
        jobs = []          # candidate paths
        seq_jobs = []      # (prefix, suffix) for numbered sequences
        stem_seq = []      # (prefix, value, suffix) for value-1, value-2 ...
        for page, html_txt in self.pages.items():
            tc = TagCollector()
            tc.feed(html_txt)
            page_vals = set(tc.values)
            scripts = [norm_path(r, page) for r in tc.refs if r.endswith(".js")]
            for sp in scripts:
                js = self.texts.get(sp)
                if not js:
                    continue
                _, prefixes, suffixes, js_vals = js_analyse(js)
                vals = {v for v in page_vals | js_vals if re.fullmatch(r"[\w][\w.\-]{0,60}", v)}
                # does this script build names like  path + "-" + stepCount ?
                steps = bool(re.search(r"\+\s*[\"']-[\"']\s*\+\s*\w+\s*\+", js))
                for pre in prefixes:
                    kind = folder_kind(pre)
                    if not kind:
                        continue
                    sfx = {s for s in suffixes if s.rsplit(".", 1)[-1] in MEDIA_EXT[kind]}
                    if not sfx:
                        sfx = {"." + MEDIA_EXT[kind][0]}
                    base = norm_path(pre if pre.startswith(("/", ".")) else "./" + pre, "/")
                    if base is None:
                        continue
                    if not pre.endswith("/"):
                        # numbered prefix like ".../play-audio-3-"
                        for s in sfx:
                            seq_jobs.append((base, s))
                        continue
                    if not base.endswith("/"):
                        base += "/"
                    for v in vals:
                        has_ext = re.search(r"\.(%s)$" % EXT_ALT, v)
                        if has_ext:
                            if v.rsplit(".", 1)[-1] in MEDIA_EXT[kind]:
                                jobs.append(base + v)
                            continue
                        for s in sfx:
                            jobs.append(base + v + s)
                            if steps:
                                stem_seq.append((base, v, s))

        jobs = sorted(set(jobs) - set(self.assets))
        self.log(f"  probing {len(jobs)} candidate URLs (cached ones are instant)...")
        found = 0
        with cf.ThreadPoolExecutor(self.a.workers) as ex:
            for path, ok in zip(jobs, ex.map(self._probe, jobs)):
                if ok:
                    self.assets.setdefault(path, "probe")
                    found += 1
        self.log(f"  probe hits: {found}")

        # numbered sequences: prefix + 0..N + suffix, stop after 3 misses in a row
        def run_seq(make):
            hits, miss, n = 0, 0, 0
            while miss < 3 and n < 400:
                p = make(n)
                if self._probe(p):
                    self.assets.setdefault(p, "probe-seq")
                    hits += 1
                    miss = 0
                elif n > 0:
                    miss += 1
                n += 1
            return hits

        seqs = sorted(set(seq_jobs))
        with cf.ThreadPoolExecutor(self.a.workers) as ex:
            total = sum(ex.map(lambda t: run_seq(lambda n: f"{t[0]}{n}{t[1]}"), seqs))
        self.log(f"  numbered-sequence hits: {total} (from {len(seqs)} patterns)")

        # value-N sequences (e.g. path1-1.png, path1-2.png ...) - only try the
        # stems whose "-1" exists, so this stays cheap.
        stems = sorted(set(stem_seq))
        with cf.ThreadPoolExecutor(self.a.workers) as ex:
            first = list(ex.map(lambda t: self._probe(f"{t[0]}{t[1]}-1{t[2]}"), stems))
        live = [t for t, ok in zip(stems, first) if ok]
        with cf.ThreadPoolExecutor(self.a.workers) as ex:
            total = sum(ex.map(lambda t: run_seq(lambda n: f"{t[0]}{t[1]}-{n}{t[2]}"), live))
        self.log(f"  step-sequence hits: {total}")
        self.save_cache()

    def _write_cache_locked(self):
        os.makedirs(self.out, exist_ok=True)
        tmp = self.probe_cache_file + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self.probe_cache, f, sort_keys=True)
        os.replace(tmp, self.probe_cache_file)

    def save_cache(self):
        with self.lock:
            self._write_cache_locked()

    # ---- phase 4: write everything -------------------------------------- #
    def local(self, path):
        rel = path.lstrip("/")
        if not os.path.splitext(rel)[1]:
            rel += ".html"
        return os.path.join(self.out, "site", *rel.split("/"))

    def fetch_one(self, path):
        dest = self.local(path)
        if not self.a.refresh and os.path.exists(dest) and os.path.getsize(dest) > 0:
            with open(dest, "rb") as f:
                data = f.read()
            return path, len(data), hashlib.sha256(data).hexdigest(), "cached"
        res = self.http.download(SITE + urllib.parse.quote(path), dest)
        if res is None:
            return path, None, None, "missing"
        return path, res[0], res[1], "downloaded"

    def write(self):
        # pages
        for path, txt in sorted(self.pages.items()):
            dest = self.local(path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as f:
                f.write(txt)
            self.manifest["pages"].append({"route": path, "file": os.path.relpath(dest, self.out)})

        paths = sorted(self.assets)
        total_bytes, done = 0, 0
        with cf.ThreadPoolExecutor(self.a.workers) as ex:
            for path, size, sha, status in ex.map(self.fetch_one, paths):
                done += 1
                if size:
                    total_bytes += size
                if status != "cached" or done % 100 == 0:
                    self.log(f"  [{done}/{len(paths)}] {status:10} {path}")
                self.manifest["files"].append({
                    "path": path,
                    "file": os.path.relpath(self.local(path), self.out),
                    "bytes": size, "sha256": sha, "status": status,
                    "found_by": self.assets[path],
                    **classify(path),
                })
        self.manifest["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        self.manifest["total_bytes"] = total_bytes
        with open(os.path.join(self.out, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=1, ensure_ascii=False)
        return total_bytes

    def run(self):
        t0 = time.time()
        self.log("1/4 crawling textbook pages")
        self.crawl()
        self.log(f"    {len(self.pages)} pages, {len(self.assets)} assets referenced directly")
        self.log("2/4 scanning css/js")
        self.scan_code()
        self.log(f"    {len(self.assets)} assets after static scan")
        self.log("3/4 probing runtime-built media URLs")
        self.probe()
        self.log(f"    {len(self.assets)} assets total")
        if self.a.dry_run:
            for p in sorted(self.assets):
                print(f"{self.assets[p]:28} {p}")
            return
        self.log("4/4 downloading")
        b = self.write()
        missing = [f["path"] for f in self.manifest["files"] if f["status"] == "missing"]
        self.log(f"\nDone in {time.time()-t0:.0f}s: {len(self.pages)} pages, "
                 f"{len(self.manifest['files'])} files, {b/1e6:.1f} MB -> {self.out}")
        if missing:
            self.log(f"  {len(missing)} referenced files are missing on the server itself:")
            for m in missing:
                self.log("   -", m)


def classify(path):
    m = re.match(r"/letstrydata/letstry(\d)/(audio|video|images)/(?:unit(\d+)/)?", path)
    if m:
        return {"book": f"letstry{m[1]}", "unit": int(m[3]) if m[3] else None, "type": m[2]}
    m = re.match(r"/images/([^/]+)/", path)
    if m:
        return {"book": "storybooks", "story": m[1], "type": "images"}
    return {"type": "ui"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="mirror", help="output folder (default ./mirror)")
    ap.add_argument("--workers", type=int, default=6, help="parallel requests (default 6)")
    ap.add_argument("--delay", type=float, default=0.0, help="min seconds between requests, to be gentle")
    ap.add_argument("--no-storybooks", action="store_true", help="skip the storybook reader")
    ap.add_argument("--dry-run", action="store_true", help="list what would be mirrored")
    ap.add_argument("--refresh", action="store_true", help="re-download existing files")
    args = ap.parse_args()
    try:
        Mirror(args).run()
    except KeyboardInterrupt:
        sys.exit("\ninterrupted - re-run to resume")


if __name__ == "__main__":
    main()
