"""Write data/offline-<id>.json: every file needed offline, with sizes, content fingerprints and a version.

  app      the app itself: page, code, styles, fonts, data, icons and the games' own pictures
  lt1/lt2  a textbook's pictures, audio and videos (plus the word-game pictures and sounds)
  stories  the two picture books

Each row is [path, bytes, fingerprint]. The app compares fingerprints with what it saved,
so an update only downloads the files that actually changed.
"""
import json, os, hashlib, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
P = lambda *a: os.path.join(ROOT, *a)


def walk(o, out):
    if isinstance(o, dict):
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
    elif isinstance(o, str) and o.startswith("media/"):
        out.add(o)


def tree(folder, exts=None):
    out = set()
    for root, _, fs in os.walk(P(folder)):
        for f in fs:
            if exts and not f.endswith(exts): continue
            out.add(os.path.relpath(os.path.join(root, f), ROOT).replace(os.sep, "/"))
    return out


def fingerprint(path):
    h = hashlib.sha1()
    with open(P(path), "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()[:10]


def write(name, files, extra_rows=()):
    rows = [[f, os.path.getsize(P(f)), fingerprint(f)] for f in sorted(files)] + list(extra_rows)
    v = hashlib.sha1("".join(f + fp for f, _, fp in rows).encode()).hexdigest()[:12]
    out = {"book": name, "version": v, "bytes": sum(s for _, s, _ in rows), "files": rows}
    json.dump(out, open(P("data", f"offline-{name}.json"), "w"), separators=(",", ":"))
    print(f"{name:8s} {len(rows):5d} files {out['bytes'] / 1e6:7.1f} MB  {v}")


fonts = {f"fonts/{f}" for f in os.listdir(P("fonts")) if f.endswith(".woff2")}

for name in ("lt1", "lt2", "stories"):
    files = set()
    walk(json.load(open(P("data", f"{name}.json"))), files)
    if name != "stories":
        files |= {f"media/thumbs/{name}-u{u}.webp" for u in range(1, 10)}
        # the word games, pencil case, parfait and getting-around pictures and sounds
        walk(json.load(open(P("data", "words.json"))), files)
    else:
        files.add("media/thumbs/stories.webp")
    files |= fonts                     # so Japanese text looks right with no connection
    write(name, files)

# The app itself. offline-app.json is left out of its own list (it changes when written).
app = {"index.html", "manifest.webmanifest"}
app |= tree("js", (".js",)) | tree("css", (".css",)) | tree("fonts") | tree("icons")
app |= {f for f in tree("data", (".json",)) if not f.endswith("offline-app.json")}
app |= tree("media/bonus") | tree("media/parfait") | tree("media/thumbs") | {"media/logo.webp"}
# the address the app is opened at ("./") is the same page as index.html
idx = [["./", os.path.getsize(P("index.html")), fingerprint("index.html")]]
write("app", app, idx)
