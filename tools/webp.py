"""WebP copies of the website's pictures (health check, 16 November 2026): about 60% lighter than the JPEGs and PNGs.
The originals stay: browsers without WebP and the share images (og:image) use them. Run by build.py; by hand:

    /opt/homebrew/bin/python3 tools/webp.py            (needs Pillow; only makes what is missing or older than its original)

Which pictures: every room picture the places load (assets/<place>/room-*.jpg), every JPEG or PNG a page shows in
an <img> (build.py's webp_pictures() then wraps those in <picture> with the WebP first) or as a film's poster (site.js
fetches the WebP when the film comes near the screen), and Busy Kitchen's own pictures on its page, which live with
the app (app/shared/kitchen/pics): those get copies in assets/kitchen/, 1280 and 640 wide (build.py kitchen_img())."""
import glob
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"


def shown() -> set:
    out = set()
    pages = list(SITE.glob("*.html")) + [p for d in ("business", "games", "growth", "home", "rentals", "kitchen", "films") for p in (SITE / d).glob("*.html")]
    for page in pages:
        for m in re.finditer(r'<(?:img[^>]+src|video[^>]+poster)="([^"#?]+\.(?:png|jpe?g))"', page.read_text()):
            if m.group(1).startswith(("http:", "https:", "data:")):
                continue
            f = (page.parent / m.group(1)).resolve()
            # not what the build copies in afresh each time (the demo, the game's own folder): a WebP there would not last
            if f.is_file() and SITE.resolve() in f.parents and "/app/" not in str(f) and "/games/tucks-errand/" not in str(f):
                out.add(f)
    return out


def kitchen(Image) -> int:
    """Busy Kitchen's page shows pictures that belong to the app (1280 wide, about 300 KB each). The app keeps its JPEGs;
    the page gets WebP copies in assets/kitchen/: <name>.webp as it is, and <name>-640.webp for phones and the tiles."""
    page, made = SITE / "kitchen" / "index.html", 0
    if not page.is_file():
        return 0
    out = SITE / "assets" / "kitchen"
    for name in sorted(set(re.findall(r'<img[^>]+src="[^"]*app/shared/kitchen/pics/([\w-]+)\.jpg"', page.read_text()))):
        f = SITE / "app" / "shared" / "kitchen" / "pics" / f"{name}.jpg"
        if not f.is_file():
            f = ROOT / "app" / "shared" / "kitchen" / "pics" / f"{name}.jpg"
        if not f.is_file():
            continue
        for wide, w in ((0, out / f"{name}.webp"), (640, out / f"{name}-640.webp")):
            if w.exists() and w.stat().st_mtime >= f.stat().st_mtime:
                continue
            im = Image.open(f).convert("RGB")
            if wide and im.width > wide:
                im = im.resize((wide, round(im.height * wide / im.width)), Image.LANCZOS)
            out.mkdir(parents=True, exist_ok=True)
            im.save(w, "WEBP", quality=80, method=6)
            made += 1
    return made


def main() -> int:
    try:
        from PIL import Image
    except ImportError:
        print("webp: Pillow is not installed here; the site keeps its JPEGs and PNGs")
        return 0
    files = {Path(p).resolve() for p in glob.glob(str(SITE / "assets" / "*" / "room-*.jpg"))} | shown()
    made = 0
    for f in sorted(files):
        w = f.with_suffix(".webp")
        if w.exists() and w.stat().st_mtime >= f.stat().st_mtime:
            continue
        im = Image.open(f)
        if im.mode == "P":
            im = im.convert("RGBA")
        im.save(w, "WEBP", quality=80, method=6)
        made += 1
    made += kitchen(Image)
    print(f"webp: {len(files)} pictures, {made} new WebP copies")
    return 0


if __name__ == "__main__":
    sys.exit(main())
