"""Turn raw recordings into the app's data model + report unclassified behaviour."""
import json, glob, re, os, sys, collections

RAW = os.environ.get("LT_RAW", "tools/raw")
SCREEN_RE = re.compile(r"\b(main-image|page-image|play-image)\b")


def screen_key(cls):
    """'page-image wat-page unit1-wat-page' -> 'unit1-wat-page'"""
    toks = [t for t in cls.split() if t not in ("closed", "main-image", "page-image", "play-image")]
    for t in toks:
        if re.match(r"unit\d+-", t):
            return t
    return toks[-1] if toks else cls


def classify(h, screens_by_key):
    acts, unknown = [], []
    for e in h["effects"]:
        k = e["kind"]
        cls = e.get("cls") or ""
        if k == "class" and SCREEN_RE.search(cls):
            if "closed" in e["removed"]:
                acts.append({"open": screen_key(cls)})
            continue  # closing the old screen is implied
        if k == "class" and re.search(r"contents-return-button|main-audio-window|main-video-window|back-button|canvas", cls):
            continue
        if k == "src":
            src = e["src"]
            if not src or src.endswith("/undefined") or src == "/":
                continue
            if e["tag"] == "audio":
                acts.append({"audio": src, **({"player": cls} if "main-audio" not in cls else {})})
            elif e["tag"] == "video":
                acts.append({"chant" if "chant" in cls else "video": src})
            elif e["tag"] == "img":
                acts.append({"image": src, "rect": e.get("rect"), "slot": e["path"]})
            else:
                unknown.append(e)
            continue
        if k == "class" and ("closed" in e["removed"] or "closed" in e["added"]):
            acts.append({"toggle": e["path"], "img": e.get("img"), "rect": e.get("rect"),
                         "show": "closed" in e["removed"], "cls": cls})
            continue
        if k == "added" and e["imgs"]:
            acts.append({"overlay": e["imgs"][0], "rect": e.get("rect") or e.get("parentRect"), "slot": e["parent"]})
            continue
        unknown.append(e)
    return acts, unknown


def main():
    report = collections.defaultdict(list)
    out = {}
    for f in sorted(glob.glob(f"{RAW}/*.json")):
        d = json.load(open(f))
        u = d["unit"]
        screens = {}
        for s in d["screens"]:
            key = screen_key(s["cls"])
            hs = []
            for h in s["hotspots"]:
                if h["isClose"]:
                    continue
                acts, unk = classify(h, screens)
                if h["tag"] == "a":
                    acts = [{"link": h["href"]}]
                rec = {"id": h["id"], "cls": h["cls"], "rect": h["rect"], "text": h["text"],
                       "data": h["data"], "acts": acts}
                if h.get("innerImg"):
                    rec["innerImg"] = h["innerImg"]
                if unk:
                    rec["unknown"] = unk
                    report[u].append((key, h["id"] or h["cls"], [(x["kind"], x.get("cls", "")[:40], x.get("added"), x.get("removed"), x.get("style")) for x in unk][:3]))
                if not acts and not unk:
                    report[u].append((key, h["id"] or h["cls"], "NO EFFECT"))
                hs.append(rec)
            screens[key] = {"key": key, "type": "page" if "main-image" in s["cls"] else "popup",
                            "image": s["image"], "size": s["natural"], "imgRect": s["imgRect"],
                            "hotspots": hs, "layers": s["layers"]}
        out[u] = screens
    json.dump(out, open(os.path.join(RAW, "..", "normalized.json"), "w"), indent=1)
    for u, items in report.items():
        print(f"== {u}  ({len(items)})")
        seen = set()
        for it in items:
            sig = (it[0], str(it[2])[:80])
            if sig in seen:
                continue
            seen.add(sig)
            print("   ", it[0], "|", it[1], "|", str(it[2])[:220])


if __name__ == "__main__":
    main()
