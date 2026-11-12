"""Build data/words.json and media/words/ for the vocabulary games.

Pictures: Mark's picture dictionary (cards are cropped above the ruled lines, so the word
isn't printed on the picture; the games draw the word themselves). Audio: the word sounds
from the original site, downloaded once into media/words/audio/. Pictures in tools/words/extra/
fill gaps in the dictionary and are used as they are.
Run:  python3 tools/words/build_words.py <picture-dictionary-folder>
"""
import json, os, re, sys, urllib.request
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(__file__))
from sets import SETS, UNITS, ALIASES, PREFER, GA, FLAGS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PD = sys.argv[1]
VOC = json.load(open(os.path.join(os.path.dirname(__file__), "plipplop-vocab.json")))["topics"]
OUT_IMG = os.path.join(ROOT, "media", "words")
os.makedirs(OUT_IMG, exist_ok=True)
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

files = []
for d, _, fs in os.walk(PD):
    for f in fs:
        if f.lower().endswith(".png"): files.append(os.path.relpath(os.path.join(d, f), PD))
EXTRA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra")   # extra pictures, already cut (no ruled lines)
for f in sorted(os.listdir(EXTRA)):
    if f.lower().endswith(".png"): files.append("Extra/" + f)
by = {}
for f in files: by.setdefault(norm(os.path.splitext(os.path.basename(f))[0]), []).append(f)
NUM = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split()

def find(sid, w):
    key = ALIASES.get(w, w)
    if sid == "numbers": key = str(NUM.index(w) + 1)
    if key is None: return None
    c = list(by.get(norm(key), [])) or by.get(norm(key)[:-1], []) if norm(key).endswith("s") else list(by.get(norm(key), []))
    c = c or by.get(norm(key) + "s", [])
    pref = PREFER.get(sid, [])
    c = sorted(c, key=lambda f: (0 if f.startswith("Extra/") else 1, 0 if any(f.startswith(p + "/") for p in pref) else 1, f.count("/"), f))
    return c[0] if c else None

done = {}
def picture(rel):
    """Crop the card above its ruled lines, trim, centre on a square, save as WebP."""
    if rel in done: return done[rel]
    name = slug(os.path.splitext(rel)[0].replace("/", "-")) + ".webp"
    dst = os.path.join(OUT_IMG, name)
    if not os.path.exists(dst):
        extra = rel.startswith("Extra/")
        im = Image.open(os.path.join(EXTRA, rel[6:]) if extra else os.path.join(PD, rel)).convert("RGB")
        w, h = im.size
        art = im if extra else im.crop((0, 0, w, int(h * 0.79)))   # ruled lines start at 0.8 of the card
        bbox = ImageOps.invert(art.convert("L")).point(lambda v: 255 if v > 18 else 0).getbbox() or (0, 0, *art.size)
        art = art.crop(bbox)
        side = int(max(art.size) * 1.08)
        sq = Image.new("RGB", (side, side), (255, 255, 255))
        sq.paste(art, ((side - art.size[0]) // 2, (side - art.size[1]) // 2))
        sq.thumbnail((440, 440), Image.LANCZOS)
        sq.save(dst, "WEBP", quality=84, method=6)
    done[rel] = f"media/words/{name}"
    return done[rel]

def audio(topic, idx):
    src = VOC[topic]["sounds"][idx]                      # e.g. ./sounds/alphabet/img27.mp3
    rel = "media/words/audio/" + src[len("./sounds/"):]
    dst = os.path.join(ROOT, rel)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        url = "https://plip-plop-land.com/" + src[2:]
        try:
            with urllib.request.urlopen(url, timeout=30) as r: data = r.read()
            open(dst, "wb").write(data)
        except Exception as e:
            print("  no audio", url, e); return None
    return rel

SHAPE_SVG = {
    "circle": '<circle cx="50" cy="50" r="40"/>',
    "square": '<rect x="13" y="13" width="74" height="74" rx="4"/>',
    "rectangle": '<rect x="6" y="25" width="88" height="50" rx="4"/>',
    "triangle": '<path d="M50 9 93 86H7Z" stroke-linejoin="round"/>',
    "diamond": '<path d="M50 5 88 50 50 95 12 50Z"/>',
    "heart": '<path d="M50 88C20 66 6 50 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 18-14 34-44 56Z"/>',
    "star": '<path d="M50 6l12.6 27.4 29.9 3.3-22.3 20.2 6.2 29.4L50 71.4 23.6 86.3l6.2-29.4L7.5 36.7l29.9-3.3Z"/>',
    "cross": '<path d="M37 8h26v29h29v26H63v29H37V63H8V37h29Z"/>',
}
COLORS = {"red": "#e53935", "blue": "#1e88e5", "yellow": "#fdd835", "green": "#43a047", "pink": "#f06292", "purple": "#8e24aa",
          "orange": "#fb8c00", "black": "#212121", "white": "#ffffff", "brown": "#6d4c41", "light blue": "#4fc3f7"}
def drawn_shape(word):
    for c in sorted(COLORS, key=len, reverse=True):
        if word.startswith(c + " "):
            shape = word[len(c) + 1:]
            name = f"shape-{slug(word)}.svg"
            svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="{COLORS[c]}" '
                   f'stroke="#333" stroke-width="2.5">{SHAPE_SVG[shape]}</g></svg>')
            open(os.path.join(OUT_IMG, name), "w").write(svg)
            return f"media/words/{name}"
    return None

def flag(word):
    """A flag-icons SVG with a thin frame, so white flags (Japan, Finland) still show their edge."""
    code = FLAGS.get(word)
    if not code: return None
    svg = open(os.path.join(os.path.dirname(__file__), "flags", code + ".svg")).read().rstrip()
    svg = svg[:svg.rindex("</svg>")] + '<rect width="640" height="480" fill="none" stroke="#3336" stroke-width="10"/></svg>'
    name = f"flag-{code}.svg"
    open(os.path.join(OUT_IMG, name), "w").write(svg)
    return f"media/words/{name}"

out = {"sets": {}, "units": UNITS, "places": {}}
missing = {}
for sid, (topic, en, ja, opt) in SETS.items():
    words = VOC[topic]["words"]
    n = opt.get("first", len(words))
    seen, items = set(), []
    for i, w in enumerate(words[:n]):
        if w in seen: continue
        seen.add(w)
        item = {"w": w, "audio": audio(topic, i)}
        if opt.get("letters"): item["letter"] = True
        elif opt.get("drawn"): item["img"] = drawn_shape(w)
        elif opt.get("flags"):
            item["img"] = flag(w)
            if not item["img"]: missing.setdefault(sid, []).append(w)
        else:
            f = find(sid, w)
            item["img"] = picture(f) if f else None
            if not f: missing.setdefault(sid, []).append(w)
        items.append(item)
    out["sets"][sid] = {"en": en, "ja": ja, "words": items}
    print(f"{sid:12} {len(items):3} words, {sum(1 for x in items if x.get('img') or x.get('letter')):3} pictures")

# Getting Around places, with audio from the original's school / buildings lists where the word matches
snd = {}
for topic in ("school", "lt-school", "buildings"):
    t = VOC.get(topic)
    if t:
        for i, w in enumerate(t["words"]): snd.setdefault(norm(w), (topic, i))
for k, lst in GA.items():
    folder = "School" if k == "school" else "Town"
    items = []
    for w, f in lst:
        key = norm(w.replace("nurse's", "school nurses").replace("principal's", "school principals").replace("teachers'", "teachers"))
        a = snd.get(key) or snd.get(norm(w))
        items.append({"w": w, "img": picture(f"{folder}/{f}.png"), "audio": audio(*a) if a else None})
    out["places"][k] = items
json.dump(out, open(os.path.join(ROOT, "data", "words.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(missing, open(os.path.join(os.path.dirname(__file__), "missing.json"), "w"), indent=1)
print("missing pictures:", sum(len(v) for v in missing.values()))
