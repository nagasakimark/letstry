"""Copy media into the repo: PNG -> WebP (max 2560px, q82, alpha kept); mp3/mp4 copied."""
import os, sys, shutil
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

SRC = os.environ.get("LT_MIRROR", "mirror/site")
DST = sys.argv[1] if len(sys.argv) > 1 else "media"
MAXSIDE = 2560


def target(rel):
    if rel.startswith("letstrydata/letstry"):
        rel = "lt" + rel[len("letstrydata/letstry"):]
    elif rel.startswith("images/"):
        rel = "stories/" + rel[len("images/"):]
    if rel.endswith(".png"):
        rel = rel[:-4] + ".webp"
    return os.path.join(DST, rel)


def job(rel):
    src, dst = os.path.join(SRC, rel), target(rel)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return 0, 0
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if rel.endswith(".png"):
        im = Image.open(src)
        im = im.convert("RGBA") if (im.mode in ("RGBA", "LA", "P") and ("transparency" in im.info or im.mode != "P" and "A" in im.mode)) else im.convert("RGB")
        if im.mode == "RGBA" and im.getchannel("A").getextrema() == (255, 255):
            im = im.convert("RGB")
        if max(im.size) > MAXSIDE:
            im.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
        im.save(dst, "WEBP", quality=82, method=5)
    else:
        shutil.copy2(src, dst)
    return os.path.getsize(src), os.path.getsize(dst)


def main():
    rels = []
    for root in ("letstrydata", "images"):
        for dp, _, fs in os.walk(os.path.join(SRC, root)):
            for f in fs:
                if f.endswith((".png", ".mp3", ".mp4")) and "/canvas" not in dp:
                    rels.append(os.path.relpath(os.path.join(dp, f), SRC))
    a = b = 0
    with ProcessPoolExecutor() as ex:
        for s, d in ex.map(job, rels, chunksize=8):
            a += s; b += d
    print(f"{len(rels)} files, {a/1e6:.0f} MB -> {b/1e6:.0f} MB")


if __name__ == "__main__":
    main()
