"""Write data/offline-<book>.json: every file a book needs offline, with sizes and a version."""
import json, os, hashlib, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

def walk(o, out):
    if isinstance(o, dict):
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
    elif isinstance(o, str) and o.startswith("media/"):
        out.add(o)

for name in ("lt1", "lt2", "stories"):
    d = json.load(open(os.path.join(ROOT, "data", f"{name}.json")))
    files = set()
    walk(d, files)
    if name != "stories":
        files |= {f"media/thumbs/{name}-u{u}.webp" for u in range(1, 10)}
    else:
        files.add("media/thumbs/stories.webp")
    rows = []
    for f in sorted(files):
        p = os.path.join(ROOT, f)
        rows.append([f, os.path.getsize(p)])
    h = hashlib.sha1()
    for f, size in rows:
        h.update(f.encode()); h.update(str(os.path.getmtime(os.path.join(ROOT, f)) if False else size).encode())
    out = {"book": name, "version": h.hexdigest()[:12], "bytes": sum(s for _, s in rows), "files": rows}
    json.dump(out, open(os.path.join(ROOT, "data", f"offline-{name}.json"), "w"), separators=(",", ":"))
    print(name, len(rows), "files", round(out["bytes"] / 1e6), "MB", out["version"])
