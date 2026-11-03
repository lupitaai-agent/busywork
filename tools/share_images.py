"""The share images (what a link to busy.com.ai looks like on LinkedIn, WhatsApp, in a search result) in every
language Busy speaks: website/assets/og-<name>.png in English and og-<name>-<lang>.png for the others. build.py gives
each language version of a page its own picture, and the words go through the same word lists as the site.

    python3 tools/share_images.py            all images, all languages
    python3 tools/share_images.py juno nl    some of them

Made with the installed Chrome (headless) from small HTML pages in the house style: 1200 × 630."""
import html
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "website" / "assets"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

LIGHT = {"bg": "#FBF3E4", "ink": "#1E1B2E", "sub": "#4A4560", "dot": "rgba(30,27,46,.06)", "line": "#1E1B2E", "chip": "#FFC93C", "chip_ink": "#1E1B2E"}
BLOBS_LIGHT = [("#FFB3D9", 420, "right:-90px;top:-150px"), ("#9CC8FF", 300, "left:-120px;bottom:-160px"), ("#8FE3B8", 260, "right:60px;bottom:-140px")]
# name: (mark, title, subtitle, headline, chips, picture beside it or None, colours, blobs)
IMAGES = {
    "busy": ("favicon.svg", "Busy", "Free, private tools for work and life", "Make your paperwork fun again.",
             ["💼 Business", "🏡 Home", "🌱 Growth", "🧩 Games", "No account"], None, LIGHT, BLOBS_LIGHT),
    "business": ("favicon.svg", "Busy Business", "Free tools for small businesses", "Make your paperwork fun again.",
                 ["Invoices", "Time", "Receipts", "Projects", "No account"], None, LIGHT, BLOBS_LIGHT),
    "games": ("favicon.svg", "Busy Games", "Free daily puzzles", "A new puzzle every day. Free, no account.",
              ["Stars", "Duo", "Trail", "Six"], "film:street-day",
              {"bg": "#1D2350", "ink": "#FBF7EE", "sub": "#FFC93C", "dot": "rgba(255,255,255,.06)", "line": "#0E1130", "chip": "#FFC93C", "chip_ink": "#1E1B2E"},
              [("#3B4BB0", 380, "right:-120px;top:-160px"), ("#F2C14E", 240, "left:-90px;bottom:-130px")]),
    "olaf": ("olaf-mark.svg", "Olaf", "by Busy", "Your AI marketing expert. More customers, every week.",
             ["90-day plan", "Weekly check-in", "Work done with you"], "experts/olaf-card.jpg",
             {"bg": "#221D33", "ink": "#FBF7EE", "sub": "#B48CFF", "dot": "rgba(255,255,255,.06)", "line": "#120E1E", "chip": "#9B6BFF", "chip_ink": "#FBF7EE"},
             [("#6B4BA8", 380, "right:-110px;top:-170px"), ("#B5482A", 260, "left:-100px;bottom:-140px")]),
    "ivy": ("ivy-mark.svg", "Ivy", "by Busy", "Your AI coach for professional growth.",
            ["Learn", "Prove it", "Land the job"], "experts/ivy-card.jpg",
            {"bg": "#12261E", "ink": "#FBF7EE", "sub": "#2FD18C", "dot": "rgba(255,255,255,.06)", "line": "#07130E", "chip": "#2FD18C", "chip_ink": "#12261E"},
            [("#13834F", 380, "right:-110px;top:-170px"), ("#C9A227", 260, "left:-100px;bottom:-140px")]),
    "juno": ("juno-mark.svg", "Juno", "by Busy", "Your AI expert for household paperwork.",
             ["Explains the letter", "Writes the reply", "Keeps you ahead"], "experts/juno-card.jpg",
             {"bg": "#2A1611", "ink": "#FFF3EC", "sub": "#FFB899", "dot": "rgba(255,255,255,.07)", "line": "#140A07", "chip": "#FF8A5B", "chip_ink": "#1E1B2E"},
             [("#B5482A", 400, "right:-100px;top:-160px"), ("#C9A227", 280, "left:-100px;bottom:-150px")]),
}
LANGS = ["en", "nl", "de", "es", "it", "pt-br"]


def texts() -> list:
    """Every piece of text on the images, for the word lists (i18n/i18n.py)."""
    out = []
    for mark, title, sub, h1, chips, *_ in IMAGES.values():
        for s in [sub, h1, *[c for c in chips if c[0] < "\u2000"]]:  # a chip with an emoji is a suite: its name stays
            if s not in out:
                out.append(s)
    return out


SOCIAL = ROOT.parent / "releases" / "social"  # the films at full size (busy-studio loops_web.py)
FRAMES = Path(tempfile.mkdtemp())


def picture_of(pic: str, lang: str) -> str:
    """A picture from the assets, or "film:<name>": the kiosk in the first frame of that street film, whose sign
    ("Today's puzzles") is in this language."""
    if not pic.startswith("film:"):
        return (ASSETS / pic).as_uri()
    src = SOCIAL / f"{pic[5:]}{'' if lang == 'en' else '-' + lang}.mp4"
    out = FRAMES / f"{pic[5:]}-{lang}.jpg"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-frames:v", "1", "-vf", "crop=522:600:1398:390", "-q:v", "2", str(out)], check=True)
    return out.as_uri()


def page(name: str, t, lang: str = "en") -> str:
    mark, title, sub, h1, chips, pic, c, blobs = IMAGES[name]
    tr = lambda s: html.escape(t(s))
    chip = lambda s: tr(s) if s[0] < "\u2000" else html.escape(s)
    width = "560px" if pic else "1040px"
    size = 76 if pic else 84  # the headline shrinks until it fits above the chips (fit() below): longer languages
    blob = "".join(f'<div class="blob" style="width:{w}px;height:{w}px;{at};background:{col}"></div>' for col, w, at in blobs)
    picture = f'<div class="pic" style="background-image:url(\'{picture_of(pic, lang)}\')"></div>' if pic else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
* {{ margin: 0; box-sizing: border-box; }}
html, body {{ width: 1200px; height: 630px; overflow: hidden; }}
body {{ font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; position: relative; padding: 64px 72px; background: {c['bg']}; color: {c['ink']}; }}
.dots {{ position: absolute; inset: 0; background-image: radial-gradient({c['dot']} 1.6px, transparent 1.7px); background-size: 26px 26px; }}
.blob {{ position: absolute; border-radius: 50%; }}
.top {{ position: relative; display: flex; align-items: center; gap: 22px; }}
.top img {{ width: 84px; height: 84px; }}
.name {{ font-size: 44px; font-weight: 800; letter-spacing: -.5px; line-height: 1; }}
.sub {{ font-size: 23px; font-weight: 700; margin-top: 8px; color: {c['sub']}; }}
h1 {{ position: relative; width: {width}; font-size: {size}px; line-height: 1.06; font-weight: 900; letter-spacing: -2px; margin-top: 48px; }}
.chips {{ position: absolute; left: 72px; bottom: 60px; width: {width}; display: flex; flex-wrap: wrap; gap: 14px; }}
.chip {{ font-size: 22px; font-weight: 800; padding: 11px 20px; border-radius: 999px; background: {c['chip']}; color: {c['chip_ink']};
  border: 4px solid {c['line']}; box-shadow: 4px 4px 0 {c['line']}; }}
.pic {{ position: absolute; right: 44px; top: 40px; width: 480px; height: 550px; border-radius: 26px; border: 5px solid {c['line']};
  box-shadow: 8px 8px 0 {c['line']}; background: center / cover no-repeat; }}
</style></head><body><div class="dots"></div>{blob}{picture}
<div class="top"><img src="{(ASSETS / mark).as_uri()}" alt=""><div><div class="name">{html.escape(title)}</div><div class="sub">{tr(sub)} · busy.com.ai</div></div></div>
<h1>{tr(h1)}</h1>
<div class="chips">{''.join(f'<span class="chip">{chip(s)}</span>' for s in chips)}</div>
<script>
  const h = document.querySelector('h1'), chips = document.querySelector('.chips');
  let px = {size};
  while (px > 40 && (h.scrollWidth > h.clientWidth + 1 || h.getBoundingClientRect().bottom > chips.getBoundingClientRect().top - 28)) h.style.fontSize = (px -= 2) + 'px';
</script>
</body></html>"""


def main() -> None:
    sys.path.insert(0, str(ROOT / "i18n"))
    import i18n as I
    names = [a for a in sys.argv[1:] if a in IMAGES] or list(IMAGES)
    langs = [a for a in sys.argv[1:] if a in LANGS] or LANGS
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            for lang in langs:
                t = (lambda s: s) if lang == "en" else (lambda s, lang=lang: I.translate_text(s, lang))
                src = Path(tmp) / f"{name}-{lang}.html"
                src.write_text(page(name, t, lang))
                out = ASSETS / (f"og-{name}.png" if lang == "en" else f"og-{name}-{lang}.png")
                subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                                "--window-size=1200,630", "--allow-file-access-from-files", f"--screenshot={out}", src.as_uri()],
                               check=True, capture_output=True)
                print(out.relative_to(ROOT))


if __name__ == "__main__":
    main()
