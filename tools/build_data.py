"""Build the new app's data files from the recordings.

Output: <repo>/data/lt1.json, lt2.json, stories.json
Media paths are rewritten from /letstrydata/letstryN/... to media/ltN/...
and .png -> .webp (images are converted separately by build_media.py).
"""
import json, os, re, glob, sys

SRC = os.environ.get("LT_MIRROR", "mirror/site")
RAW = os.environ.get("LT_RAW", "tools/raw")
OUT = sys.argv[1] if len(sys.argv) > 1 else "data"
os.makedirs(OUT, exist_ok=True)

TITLES = {
    1: ["Hello!", "How are you?", "How many?", "I like blue.", "What do you like?",
        "ALPHABET", "This is for you.", "What's this?", "Who are you?"],
    2: ["Hello, world!", "Let's play cards.", "I like Mondays.", "What time is it?",
        "Do you have a pen?", "Alphabet", "What do you want?", "This is my favorite place.",
        "This is my day."],
}


def M(p):
    """media path rewrite"""
    if not p:
        return p
    p = p.split("?")[0]
    m = re.match(r"^/?\.?/?letstrydata/letstry(\d)/(.*)$", p.lstrip("/").lstrip("./") if False else p.replace("./", "/", 1) if p.startswith("./") else p)
    if m:
        p = f"media/lt{m[1]}/{m[2]}"
    elif p.startswith("/images/"):
        p = "media/stories/" + p[len("/images/"):]
    if p.endswith(".png"):
        p = p[:-4] + ".webp"
    return p


def exists(src_path):
    return os.path.exists(SRC + src_path)


def r4(r):
    return [round(v, 4) for v in r] if r else r


def screen_key(cls):
    toks = [t for t in cls.split() if t not in ("closed", "main-image", "page-image", "play-image")]
    for t in toks:
        if re.match(r"unit\d+-", t):
            return t
    return toks[-1] if toks else cls


def finite(r):
    return r and all(isinstance(v, (int, float)) and v == v and abs(v) < 1e6 for v in r)


# ---------------------------------------------------------------- chant players
VARIANT_RE = re.compile(r"-(normal|slow|karaoke|repeat)(-(normal|slow|karaoke))?$")


def chant_player(book, unit, srcs):
    """srcs: chant video paths seen for this screen. Returns {options:[{label, variants:{}}]}"""
    folder = f"/letstrydata/letstry{book}/video/unit{unit}/"
    bases = []
    for s in srcs:
        name = os.path.basename(s)[:-4]
        base = VARIANT_RE.sub("", name)
        if base not in bases:
            bases.append(base)
    files = sorted(os.listdir(SRC + folder))
    # include sibling numbered chants (chant-3-1, chant-3-2, ...) of the same family
    for b in list(bases):
        m = re.match(r"^(.*-)(\d+)$", b)
        if m:
            for f in files:
                mm = re.match(re.escape(m[1]) + r"(\d+)-", f)
                if mm and m[1] + mm[1] not in bases:
                    bases.append(m[1] + mm[1])
    options = []
    for base in sorted(bases, key=lambda b: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', b)]):
        var = {}
        for f in files:
            if not f.endswith(".mp4") or not f.startswith(base + "-"):
                continue
            rest = f[len(base) + 1:-4]
            if not re.fullmatch(r"(normal|slow|karaoke|repeat)(-(normal|slow|karaoke))?", rest):
                continue
            toks = set(rest.split("-"))
            key = ("repeat" if "repeat" in toks else
                   ("karaoke-" if "karaoke" in toks else "") + ("slow" if "slow" in toks else "normal"))
            var[key] = M(folder + f)
        if var:
            options.append({"base": base, "variants": var})
    for i, o in enumerate(options):
        o["label"] = str(i + 1)
    return {"options": options}


# ---------------------------------------------------------------- per screen
def layer_from(elements, path, fallback):
    e = elements.get(path)
    if not e:
        return None
    lay = {"rect": r4(e["rect"]), "hidden": e["hidden"]}
    if e["img"]:
        lay["img"] = M(e["img"])
    elif fallback.get("img"):
        lay["img"] = M(fallback["img"])
    elif e["bg"]:
        lay["cover"] = e["bg"]
        if e.get("radius") and e["radius"] not in ("0px",):
            lay["radius"] = e["radius"]
    else:
        return None
    return lay


def random_list(book, unit, src):
    """play-audio-3-7.mp3 -> all play-audio-3-N.mp3 (same suffix)"""
    m = re.match(r"^(.*/)([a-z]+-audio-\d+-)(\d+)((?:-s)?\.mp3)$", src)
    if not m:
        return [M(src)]
    folder, stem, _, suf = m.groups()
    out = []
    for f in sorted(os.listdir(SRC + folder), key=lambda x: [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", x)]):
        mm = re.fullmatch(re.escape(stem) + r"(\d+)" + re.escape(suf), f)
        if mm:
            out.append(M(folder + f))
    return out


def build_unit(book, unit, raw):
    screens = {}
    order = []
    openers = {}  # popup key -> chant srcs set by opener
    for s in raw["screens"]:
        key = screen_key(s["cls"])
        order.append((key, s))
        for h in s["hotspots"]:
            for e in h.get("effects", []):
                if e["kind"] == "src" and e["tag"] == "video" and "chant" in (e.get("cls") or "") or \
                   (e["kind"] == "src" and e["tag"] == "video" and re.search(r"(sing|chant)-video", e.get("cls") or "")):
                    for e2 in h["effects"]:
                        if e2["kind"] == "class" and "closed" in e2["removed"] and re.search(r"page-image|play-image", e2["cls"]):
                            openers.setdefault(screen_key(e2["cls"]), []).append(e["src"])

    pages = [k for k, s in order if "main-image" in s["cls"]]
    for key, s in order:
        elements = s.get("elements", {})
        is_page = "main-image" in s["cls"]
        out = {"image": M(s["image"]), "size": s["natural"], "hotspots": [], "layers": {}}
        if not is_page:
            out["title"] = None
        chant_srcs = list(openers.get(key, []))
        layer_ids = {}

        def add_layer(path, act):
            if path in layer_ids:
                return layer_ids[path]
            lay = layer_from(elements, path, act)
            if not lay:
                return None
            lid = f"L{len(layer_ids) + 1}"
            layer_ids[path] = lid
            out["layers"][lid] = lay
            return lid

        for h in s["hotspots"]:
            if h["isClose"]:
                continue
            cls = h["cls"]
            rect = r4(h["rect"])
            # page navigation / links are replaced by the app's own navigation
            if h["tag"] == "a" or "pages-button" in cls:
                continue
            acts = []
            effects = h.get("effects", [])
            hid = h["id"] or ""
            spot = None
            for e in effects:
                k = e["kind"]
                ecls = e.get("cls") or ""
                if k == "class" and re.search(r"\b(main-image|page-image|play-image)\b", ecls):
                    if "closed" in e["removed"]:
                        tgt = screen_key(ecls)
                        if tgt != key:
                            acts.append({"t": "page" if "main-image" in ecls else "open", "s": tgt})
                    continue
                if k == "src":
                    src = e["src"]
                    if not src or src.endswith("/undefined") or src in ("/", ""):
                        continue
                    if e["tag"] == "audio":
                        if re.search(r"random", hid) or re.search(r"random", cls):
                            acts.append({"t": "random", "list": random_list(book, unit, src)})
                        else:
                            acts.append({"t": "audio", "src": M(src)})
                    elif e["tag"] == "video":
                        if re.search(r"chant|sing", ecls):
                            chant_srcs.append(src)
                            acts.append({"t": "chantsrc"})
                        else:
                            acts.append({"t": "video", "src": M(src)})
                    elif e["tag"] == "img":
                        if is_page and not re.match(r"book-page", hid):
                            continue
                        spot = spot or {}
                        spot["img"] = M(src)
                        spot["_r"] = e.get("rect")
                    continue
                if k == "added" and e.get("imgs"):
                    if is_page:
                        continue
                    spot = spot or {}
                    spot["img"] = M(e["imgs"][0])
                    continue
                if k == "class" and ("closed" in e["removed"] or "closed" in e["added"]):
                    if re.search(r"audio-window|contents-return|main-video-window|back-button|canvas|overlay-back|grayed", ecls):
                        continue
                    if is_page:
                        continue
                    r = e.get("rect")
                    big = finite(r) and r[2] > 0.5 and r[3] > 0.5
                    if big and e.get("img"):
                        spot = spot or {}
                        spot.setdefault("img", M(e["img"]))
                        spot.setdefault("_r", r)
                        continue
                    lid = add_layer(e["path"], e)
                    if lid:
                        acts.append({"t": "toggle", "l": lid})
                    continue
            if spot and any(a["t"] in ("open", "page") for a in acts):
                spot = None  # an opener only opens
            if spot:
                # attach audio played by the same click
                aud = [a for a in acts if a["t"] == "audio"]
                acts = [a for a in acts if a["t"] != "audio"]
                spot["t"] = "spot"
                # the original drew this picture on the page itself -> draw it in place
                pr = spot.pop("_r", None)
                if (finite(pr) and pr[0] > -0.03 and pr[1] > -0.03 and pr[0] + pr[2] < 1.03 and pr[1] + pr[3] < 1.03
                        and "shimen" not in key and "highlight" not in hid):
                    spot["r"] = [round(min(max(v, 0), 1), 4) + 0 for v in pr]
                if any(a["t"] == "random" for a in acts):
                    spot["stay"] = True  # each tap is a new random question; the picture stays
                if aud:
                    spot["audio"] = aud[0]["src"]
                acts.append(spot)
            acts = [a for a in acts if a["t"] != "chantsrc"]
            if not acts:
                continue
            hs = {"r": rect, "a": acts}
            if hid:
                hs["id"] = hid
            # icon hint for the UI
            kinds = {a["t"] for a in acts}
            hs["k"] = ("video" if "video" in kinds else "audio" if kinds & {"audio", "random"} else
                       "open" if kinds & {"open", "page"} else "spot" if "spot" in kinds else
                       "answer" if "toggle" in kinds else "other")
            out["hotspots"].append(hs)

        # initially visible layers that are never toggled are part of the art -> skip
        if chant_srcs or re.search(r"(chant|sing)(-\d)?-page$", key):
            if not chant_srcs:
                # find from layers (video src)
                chant_srcs = [l["src"] for l in s["layers"] if l["tag"] == "video" and l["src"]]
            out["kind"] = "chant"
            out["chant"] = chant_player(book, unit, chant_srcs)
            out["hotspots"] = []
            out["layers"] = {}
        screens[key] = out
    return pages, screens


# ---------------------------------------------------------------- overrides
def printed(raw_screen, cls):
    for h in raw_screen["hotspots"]:
        if cls in h["cls"].split():
            return r4(h["rect"])
    return None

def apply_overrides(book, unit, pages, screens):
    U = f"{book}-{unit}"
    img = lambda p: M(f"/letstrydata/letstry{book}/images/unit{unit}/{p}")
    aud = lambda p: M(f"/letstrydata/letstry{book}/audio/unit{unit}/{p}")
    raw = json.load(open(f"{RAW}/{U}.json"))
    rs = {screen_key(s["cls"]): s for s in raw["screens"]}

    def els(key):
        return rs[key]["elements"]

    if U == "1-3":
        # rock-paper-scissors game
        sc = screens["unit3-play-2-2-page"]
        langs = [("america", "English", "rps-america"), ("japan", "日本語", "rps-japan"), ("france", "Français", "rps-france"),
                 ("china", "中文", "rps-china"), ("korea", "한국어", "rps-korea"), ("spain", "Español", "rps-spain")]
        flags = {e["id"]: r4(e["rect"]) for e in els("unit3-play-2-2-page").values() if e["id"].startswith("rps-")}
        sc["kind"] = "rps"
        sc["image"] = None
        sc["hotspots"] = []
        sc["layers"] = {}
        res = [e for e in els("unit3-play-2-2-page").values() if "result-image" in e["cls"]]
        btn = [e for e in els("unit3-play-2-2-page").values() if "again-button" in e["cls"]]
        delays = {"japan": 5000, "spain": 6500}
        sc["rps"] = {
            "result": r4(res[0]["rect"]) if res else [0.05, 0.1, 0.5, 0.6],
            "button": r4(btn[0]["rect"]) if btn else [0.55, 0.3, 0.4, 0.2],
            "pregame": img("play2-pregame.png"),
            "hands": [img("play2-rock.png"), img("play2-scissors.png"), img("play2-paper.png")],
            "buttonImg": img("play2-2-button.png"),
            "langs": [{"id": c, "label": l, "rect": flags.get(fid), "img": img(f"play2-{c}.png"), "call": aud(f"rps-audio-{c}.mp3"),
                       "hands": [aud(f"rps-audio-{c}-{h}.mp3") for h in ("rock", "scissors", "paper")],
                       "delay": delays.get(c, 6000)} for c, l, fid in langs],
        }
        # apples: tap to fill / empty
        sc = screens["unit3-activity-1-page"]
        apples = [e for e in els("unit3-activity-1-page").values() if "apple" in e["cls"] and e["img"]]
        for e in apples:
            sc["hotspots"].append({"r": r4(e["rect"]), "a": [{"t": "swap", "imgs": [img("noapple.png"), img("yesapple.png")]}], "k": "swap"})
        sc["kind"] = "swap"
    if U == "1-6":
        sc = screens["unit6-play-page"]
        e = els("unit6-play-page")
        cards = [v for v in e.values() if "moveable-card" in v["cls"] and v["img"]]
        zones = [v for v in e.values() if v["cls"].startswith("unit6-play-letters-grid-left")]
        sc["kind"] = "board"
        sc["board"] = {"mode": "once", "pieces": [{"img": M(c["img"]), "rect": r4(c["rect"])} for c in cards],
                       "areas": [r4(z["rect"]) for z in zones], "reset": printed(rs["unit6-play-page"], "unit6-reset-button")}
        sc["hotspots"] = [h for h in sc["hotspots"] if h["k"] == "audio"]
        sc["layers"] = {}
        # letter shimen: spotlight with letter + word audio
        sc = screens["unit6-shimen-page"]
        for h in sc["hotspots"]:
            if h.get("id", "").startswith("shimen-highlight-"):
                L = h["id"]
                h["a"] = [{"t": "spot", "img": img(f"shimen/{L}.png"),
                           "buttons": [{"label": "Letter", "audio": aud(f"{L}.mp3")},
                                       {"label": "Word", "audio": aud(f"{L}-1.mp3")}]}]
                h["k"] = "spot"
    if U == "1-8":
        sc = screens["unit8-play-1-page"]
        for h in sc["hotspots"]:
            for a in h["a"]:
                if a["t"] == "spot":
                    big = a["img"].replace(".webp", "-big.webp")
                    if exists("/letstrydata/letstry1/images/unit8/" + os.path.basename(big).replace(".webp", ".png")):
                        a["img"] = big
            h["a"] = [a for a in h["a"] if a["t"] != "open"]
        screens.pop("unit8-play-1-image-layer", None)
    if U == "2-5":
        sc = screens["unit5-play-2-page"]
        e = els("unit5-play-2-page")
        cards = sorted([v for v in e.values() if "pickupzone" in v["cls"]], key=lambda v: int(v["id"][4:]))
        drops = [v for v in e.values() if "dropzone" in v["cls"]]
        sc["kind"] = "board"
        sc["board"] = {"mode": "copy", "pieces": [{"img": img(f"{c['id']}.png"), "rect": r4(c["rect"]), "ghost": True} for c in cards],
                       "slots": [r4(d["rect"]) for d in drops], "reset": printed(rs["unit5-play-2-page"], "unit5-play-2-reset")}
        sc["hotspots"] = [h for h in sc["hotspots"] if h["k"] == "audio"]
    if U == "2-7":
        sc = screens["unit7-activity-1-page"]
        e = els("unit7-activity-1-page")
        src = [v for v in e.values() if v["img"] and "parfait/" in v["img"] and "paffeglasse" not in v["img"]]
        glass = [v for v in e.values() if v["img"] and "paffeglasse" in v["img"]]
        sc["kind"] = "board"
        sc["board"] = {"mode": "copy", "pieces": [{"img": M(v["img"]), "rect": r4(v["rect"])} for v in src],
                       "front": {"img": M(glass[0]["img"]), "rect": r4(glass[0]["rect"])} if glass else None,
                       "reset": printed(rs["unit7-activity-1-page"], "unit7-activity-1-clearall"),
                       "undo": printed(rs["unit7-activity-1-page"], "unit7-activity-1-clear-block")}
        sc["hotspots"] = [h for h in sc["hotspots"] if h["k"] == "audio"]
        sc["layers"] = {}
    if U == "2-8":
        sc = screens["unit8-listen-1-page"]
        # path buttons step through path<k>-<n> image+audio
        e = rs["unit8-listen-1-page"]
        for h in e["hotspots"]:
            d = h.get("data", {})
            if d.get("audio") == "path-step-audio":
                p = d["path"]
                steps = []
                n = 1
                while exists(f"/letstrydata/letstry2/images/unit8/{p}-{n}.png"):
                    steps.append({"img": img(f"{p}-{n}.png"), "audio": aud(f"{p}-{n}.mp3") if exists(f"/letstrydata/letstry2/audio/unit8/{p}-{n}.mp3") else None})
                    n += 1
                for hh in sc["hotspots"]:
                    if hh.get("id") == h["id"] or hh["r"] == r4(h["rect"]):
                        hh["a"] = [{"t": "steps", "steps": steps, "r": [0, 0, 1, 1]}]
                        hh["k"] = "spot"
        # the printed "clear" button wipes the drawn path
        sc["hotspots"].append({"r": [0.517, 0.906, 0.1, 0.07], "a": [{"t": "clear"}], "k": "other", "id": "clear"})
    if unit == 9:
        # picture book: pages book-page-1..6 with narration
        n = 1
        bp = []
        while exists(f"/letstrydata/letstry{book}/images/unit9/book-page-{n}.png"):
            bp.append({"img": img(f"book-page-{n}.png"),
                       "audio": aud(f"book-page-{n}.mp3") if exists(f"/letstrydata/letstry{book}/audio/unit9/book-page-{n}.mp3") else None})
            n += 1
        screens.pop("unit9-book-view", None)
        for k in pages:
            sc = screens[k]
            for h in sc["hotspots"]:
                m = re.match(r"book-page-(\d+)", h.get("id", ""))
                if m:
                    h["a"] = [{"t": "book", "page": int(m[1]) - 1}]
                    h["k"] = "book"
        return {"title": TITLES[book][unit - 1], "pictureBook": bp}
    return {}


def main():
    for book in (1, 2):
        units = []
        for unit in range(1, 10):
            raw = json.load(open(f"{RAW}/{book}-{unit}.json"))
            pages, screens = build_unit(book, unit, raw)
            extra = apply_overrides(book, unit, pages, screens)
            # drop pop-ups nobody opens and the old stand-alone screens
            opened = {a["s"] for sc in screens.values() for h in sc["hotspots"] for a in h["a"] if a["t"] in ("open", "page")}
            popups = {k: v for k, v in screens.items() if k not in pages}
            orphans = [k for k in popups if k not in opened]
            for k in orphans:
                print(f"  note: lt{book} u{unit} pop-up {k} has no opener", file=sys.stderr)
            # page turns are handled by the app; keep only popup opens on pages
            for k in pages:
                screens[k]["hotspots"] = [h for h in screens[k]["hotspots"] if not any(a["t"] == "page" for a in h["a"])]
            units.append({"n": unit, "title": TITLES[book][unit - 1],
                          "pages": [{"key": k, **screens[k]} for k in pages],
                          "popups": popups, **({"pictureBook": extra["pictureBook"]} if extra.get("pictureBook") else {})})
        data = {"id": f"lt{book}", "title": f"Let's Try! {book}", "grade": book + 2, "units": units}
        json.dump(data, open(f"{OUT}/lt{book}.json", "w"), ensure_ascii=False, separators=(",", ":"))
        n_hs = sum(len(p["hotspots"]) for u in units for p in u["pages"]) + sum(len(p["hotspots"]) for u in units for p in u["popups"].values())
        print(f"lt{book}: {len(units)} units, {n_hs} hotspots, {os.path.getsize(f'{OUT}/lt{book}.json')//1024} KB")

    stories = []
    for sid, title in (("autumn", "In the Autumn Forest"), ("morning", "Good Morning")):
        files = sorted(glob.glob(f"{SRC}/images/{sid}/img*.png"), key=lambda f: int(re.search(r"img(\d+)", f)[1]))
        stories.append({"id": sid, "title": title, "size": [457, 320],
                        "pages": [M("/images/" + sid + "/" + os.path.basename(f)) for f in files]})
    json.dump({"stories": stories}, open(f"{OUT}/stories.json", "w"), ensure_ascii=False, indent=1)
    print("stories:", [(s["id"], len(s["pages"])) for s in stories])


if __name__ == "__main__":
    main()
