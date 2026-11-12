"""Give every page/screen background image a white background (no transparency).

Pages in the original were drawn on white paper; their PNGs are partly transparent,
which shows up black anywhere the image is drawn without a white sheet behind it.
Pictures drawn ON a page (answers, overlays, swaps, path steps) keep their transparency.
"""
import json, os, sys
from PIL import Image

SRC = os.environ.get("LT_MIRROR", "mirror/site")
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

def source(media):
    rel = media[len("media/"):]
    if rel.startswith("lt"):
        rel = "letstrydata/letstry" + rel[2:]
    elif rel.startswith("stories/"):
        rel = "images/" + rel[len("stories/"):]
    return os.path.join(SRC, rel[:-5] + ".png")

def strings(o, out):
    if isinstance(o, dict):
        for v in o.values(): strings(v, out)
    elif isinstance(o, list):
        for v in o: strings(v, out)
    elif isinstance(o, str) and o.endswith(".webp"): out.add(o)

backgrounds, overlays = set(), set()
for name in ("lt1", "lt2"):
    d = json.load(open(os.path.join(ROOT, "data", f"{name}.json")))
    for u in d["units"]:
        screens = list(u["pages"]) + list(u["popups"].values())
        for s in screens:
            if s.get("image"): backgrounds.add(s["image"])
            strings(s.get("hotspots", []), overlays)
            strings(s.get("layers", {}), overlays)
        strings(u.get("pictureBook", {}), backgrounds)
d = json.load(open(os.path.join(ROOT, "data", "stories.json")))
strings(d, backgrounds)

done = 0
for m in sorted(backgrounds - overlays):
    dst = os.path.join(ROOT, m)
    im = Image.open(dst)
    if im.mode != "RGBA": continue
    src = source(m)
    base = Image.open(src).convert("RGBA") if os.path.exists(src) else im.convert("RGBA")
    if max(base.size) > 2560: base.thumbnail((2560, 2560), Image.LANCZOS)
    flat = Image.new("RGB", base.size, (255, 255, 255))
    flat.paste(base, mask=base.getchannel("A"))
    flat.save(dst, "WEBP", quality=82, method=5)
    done += 1
print(f"{done} page images flattened onto white; kept transparency on {len(overlays & backgrounds)} shared overlay images")
