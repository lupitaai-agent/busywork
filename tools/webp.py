"""WebP copies of the website's pictures (health check, 16 November 2026): about 60% lighter than the JPEGs and PNGs.
The originals stay: browsers without WebP and the share images (og:image) use them. Run by build.py; by hand:

    /opt/homebrew/bin/python3 tools/webp.py            (needs Pillow; only makes what is missing or older than its original)

Which pictures: every room picture the places load (assets/<place>/room-*.jpg), and every JPEG or PNG a page shows in
an <img> (build.py's webp_pictures() then wraps those in <picture> with the WebP first)."""
import glob
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"


def shown() -> set:
    out = set()
    pages = list(SITE.glob("*.html")) + [p for d in ("business", "games", "growth", "home", "films") for p in (SITE / d).glob("*.html")]
    for page in pages:
        for m in re.finditer(r'<img[^>]+src="([^"#?]+\.(?:png|jpe?g))"', page.read_text()):
            if m.group(1).startswith(("http:", "https:", "data:")):
                continue
            f = (page.parent / m.group(1)).resolve()
            if f.is_file() and SITE.resolve() in f.parents and "/app/" not in str(f):
                out.add(f)
    return out


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
    print(f"webp: {len(files)} pictures, {made} new WebP copies")
    return 0


if __name__ == "__main__":
    sys.exit(main())
