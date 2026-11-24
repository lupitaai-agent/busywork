#!/usr/bin/env python3
"""Builds the website from the tools and the product-page content.

- website/app/                    a copy of app/, so visitors can try the tools online
- website/downloads/busy.zip      the download: app/ inside a "Busy" folder
- website/tools/*.html            one product page per tool, from website/content/tools.json
- website/sitemap.xml, robots.txt
- app/apps/marketing/library.js   the Marketing Studio's foundation and skill library, from marketing/
- website/app/apps/olaf/          the Olaf demo, copied from olaf-demo/ (made by the private Olaf build)

All of these are generated: edit app/ or the content file and run this again, never edit them by hand.
Usage: python3 build.py
"""
import hashlib
import html
import json
import os
import re
import shutil
import sys
import subprocess
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
SITE = ROOT / "website"
MKT = ROOT / "marketing"
TOOLS_JSON = SITE / "content" / "tools.json"  # the product-page copy for every tool
# The live address of the website. Used for canonical links, Open Graph tags and the sitemap.
# The GitHub workflow passes the real one (the Pages address, or your custom domain).
SITE_URL = os.environ.get("SITE_URL", "https://busywork.example").rstrip("/")

START_HERE = """Busy - busy with what matters.

1. Move this Busy folder somewhere you will find it again, like Documents.
2. Double-click index.html. It opens in your browser. Use Chrome or Edge: they can
   save your business as files in a folder (Safari and Firefox cannot).
3. Pick a folder for your business files. Put it inside Google Drive, Dropbox,
   OneDrive or iCloud Drive if you want backups and syncing.

Your data stays on your computer and is never sent to us. The free tools have no
AI and no account. Updating later? Replace this Busy folder with the new one.
Your business folder is separate, so nothing is lost.

Want more done for you? Olaf, the brand consultant, is the
paid edition: see the Olaf page on the Busy website.
"""

e = html.escape


def skip(path: Path) -> bool:
    return path.name.startswith(".") or path.name == "__pycache__"


def site_core(text: str) -> str:
    """Links from the tools back to the website (for example "Get Olaf") use the real address."""
    return text.replace("BW.siteUrl = 'https://busywork.example';", f"BW.siteUrl = '{SITE_URL}';")


# Busy Growth is built in app/ next to the business tools. Until it launches it stays out of the website
# demo and every download, and the site says "coming soon". The launch switch is GROWTH_LIVE=1 (a GitHub
# variable): then Growth gets its own download (busy-growth.zip), a place in the website demo, and the
# site's words change. The Busy Business download never includes it: each suite is its own download.
GROWTH_LIVE = os.environ.get("GROWTH_LIVE", "").strip().lower() in ("1", "true", "yes")
GROWTH_APPS = ("library", "learning", "skills", "wins", "jobs", "cv", "stories", "contacts", "review")
GROWTH_FILES = {"growth.html", "growth-home.js", "growth-worth.html", "growth-grow.html", "growth-sayit.html", "part-growth.js", "shared/growth.js", "shared/growth.css", "shared/filetext.js", "shared/growth-examples.js", "shared/linkedin.js"}


def growth_part(rel: str) -> bool:
    return rel in GROWTH_FILES or rel.startswith("shared/places/glasshouse/") or any(rel == f"apps/{a}" or rel.startswith(f"apps/{a}/") for a in GROWTH_APPS)


# Busy Home (household paperwork) works the same way, with its own switch HOME_LIVE=1 and its own
# download (busy-home.zip). Its code id is "house", because "home" already means the dashboard.
HOME_LIVE = os.environ.get("HOME_LIVE", "").strip().lower() in ("1", "true", "yes")
HOUSE_APPS = ("papers", "contracts", "upkeep", "inventory", "letters", "moving", "binder", "costs")
HOUSE_FILES = {"home.html", "home-suite.js", "home-tray.html", "home-dates.html", "home-people.html", "home-tax.html", "part-house.js", "part-household.js", "part-tax.js", "shared/house.js", "shared/house.css", "shared/house-examples.js", "shared/filetext.js",
               "shared/media/tuck-cheer.mp4", "shared/media/tuck-cheer.jpg"}


def house_part(rel: str) -> bool:
    return rel in HOUSE_FILES or rel.startswith("shared/places/house/") or any(rel == f"apps/{a}" or rel.startswith(f"apps/{a}/") for a in HOUSE_APPS)


# Busy Rentals (people who let one home or a few) is built behind its own switch RENTALS_LIVE=1. Until then none of
# its files reach the website, the demo or any download.
RENTALS_LIVE = os.environ.get("RENTALS_LIVE", "").strip().lower() in ("1", "true", "yes")
RENTALS_APPS = ("homes", "rent", "rentcosts", "rentletters")
RENTALS_FILES = {"rentals.html", "rentals-suite.js", "rentals-dates.html", "part-rentals.js", "shared/rentals.js", "shared/rentals.css", "shared/rentals-examples.js"}


# How many apps the site speaks of: three until Busy Rentals is live, four from that day. Every place that counts
# the apps or names what they are for takes its words from here, so the switch changes them all together.
APPS_COUNT = "four" if RENTALS_LIVE else "three"
APPS_FOR = "your brand, your growth, your home and the home you let" if RENTALS_LIVE else "your brand, your growth and your home"
if os.environ.get("KITCHEN_LIVE", "").strip().lower() in ("1", "true", "yes") and RENTALS_LIVE:  # Busy Kitchen makes five
    APPS_COUNT, APPS_FOR = "five", "your brand, your growth, your home, the home you let and your kitchen"


def rentals_part(rel: str) -> bool:
    return rel in RENTALS_FILES or any(rel == f"apps/{a}" or rel.startswith(f"apps/{a}/") for a in RENTALS_APPS)


# Busy Kitchen (the six kitchens of the six languages) is built behind its own switch KITCHEN_LIVE=1, like Rentals
# was. Until then none of its files reach the website, the demo or any download (owner, 17 November 2026: wave one).
KITCHEN_LIVE = os.environ.get("KITCHEN_LIVE", "").strip().lower() in ("1", "true", "yes")
KITCHEN_APPS = ("kitchens", "recipes", "plan", "pantry")
KITCHEN_FILES = {"kitchen.html", "kitchen-suite.js", "kitchen-calendar.html", "part-kitchen-calendar.js", "shared/kitchen.js", "shared/kitchen.css", "shared/kitchen-data.js", "shared/kitchen-words.js", "shared/kitchen-swaps.js", "shared/kitchen-examples.js"}


def kitchen_part(rel: str) -> bool:
    return rel in KITCHEN_FILES or rel == "shared/kitchen" or rel.startswith("shared/kitchen/") or any(rel == f"apps/{a}" or rel.startswith(f"apps/{a}/") for a in KITCHEN_APPS)


def suites_of(rel: str) -> set:
    """The suites a file belongs to; none for the business tools and the shared core."""
    return {s for s, part in (("growth", growth_part), ("house", house_part), ("rentals", rentals_part), ("kitchen", kitchen_part)) if part(rel)}


def on_site(rel: str) -> bool:
    """A suite's files reach the website demo only once that suite is live (a file shared by two
    suites, like the PDF reader, once either is)."""
    s = suites_of(rel)
    return not s or ("growth" in s and GROWTH_LIVE) or ("house" in s and HOME_LIVE) or ("rentals" in s and RENTALS_LIVE) or ("kitchen" in s and KITCHEN_LIVE)


def copy_app() -> None:
    target = SITE / "app"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(APP, target, ignore=lambda d, names: [n for n in names if n.startswith(".") or not on_site((Path(d) / n).relative_to(APP).as_posix())])
    core = target / "shared" / "core.js"
    core.write_text(site_core(core.read_text()))
    print(f"website/app: {sum(1 for _ in target.rglob('*') if _.is_file())} files")


# The free download has no AI and no example business: the AI client is Olaf's (paid), and the examples
# (Busy itself, and the pretend studio) live only in the website demo.
NOT_IN_DOWNLOAD = {"shared/ai.js", "shared/examples.js", "shared/busy-example.js", "shared/growth-examples.js", "shared/house-examples.js", "shared/rentals-examples.js", "shared/kitchen-examples.js"}


def zip_text(p: Path, files: list):
    """A file as it goes into a download, when it differs from the app folder: core.js points at the website,
    and the word lists hold only the words of this download's own files."""
    if p == APP / "shared" / "core.js":
        return site_core(p.read_text())
    if p.parent == APP / "shared" / "i18n" and p.suffix == ".js":
        return I18N.words_js(p.stem, files)
    return None


def make_zip() -> None:
    downloads = SITE / "downloads"
    downloads.mkdir(exist_ok=True)
    out = downloads / "busy.zip"
    old = downloads / "busywork.zip"  # the download under the old name (before 25 October 2026): no page links to it, so a folder that still has it loses it
    if old.exists():
        old.unlink()
    files = sorted(p for p in APP.rglob("*") if p.is_file() and not any(skip(part) for part in p.relative_to(APP).parents if part.name) and not skip(p)
                   and p.relative_to(APP).as_posix() not in NOT_IN_DOWNLOAD and not suites_of(p.relative_to(APP).as_posix()))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy/START HERE.txt", START_HERE)
        for p in files:
            text = zip_text(p, files)
            if text is not None:
                z.writestr((Path("Busy") / p.relative_to(APP)).as_posix(), text)
            else:
                z.write(p, Path("Busy") / p.relative_to(APP))
    print(f"{out.relative_to(ROOT)}: {len(files) + 1} files, {out.stat().st_size // 1024} KB")


GROWTH_START_HERE = """Busy Growth - free tools to grow your career.

1. Move this Busy Growth folder somewhere you will find it again, like Documents.
2. Double-click growth.html. It opens in your browser. Use Chrome or Edge: they can
   save your growth folder as files (Safari and Firefox cannot).
3. Pick a folder for your files: your library, skills, wins and CVs. Put it inside
   Google Drive, Dropbox, OneDrive or iCloud Drive if you want backups and syncing.

Your data stays on your computer and is never sent to us. No account. Updating
later? Replace this Busy Growth folder with the new one. Your growth folder is
separate, so nothing is lost.
"""


def suite_zip_files(name: str) -> list:
    """What a suite needs: the shared core and its own tools, none of another suite's."""
    out = []
    for p in sorted(APP.rglob("*")):
        rel = p.relative_to(APP).as_posix()
        if not p.is_file() or any(skip(part) for part in p.relative_to(APP).parents if part.name) or skip(p) or rel in NOT_IN_DOWNLOAD:
            continue
        s = suites_of(rel)
        if rel.startswith("shared/places/workshop/"):  # the Workshop's rooms belong to Busy Business
            continue
        if name in s or (rel.startswith("shared/") and not s):
            out.append(p)
    return out


def growth_zip_files() -> list:
    return suite_zip_files("growth")


HOME_START_HERE = """Busy Home - free tools for your household paperwork.

1. Move this Busy Home folder somewhere you will find it again, like Documents.
2. Double-click home.html. It opens in your browser. Use Chrome or Edge: they can
   save your home folder as files (Safari and Firefox cannot).
3. Pick a folder for your files: your documents, contracts, scans and photos. Put it
   inside Google Drive, Dropbox, OneDrive or iCloud Drive if you want backups and syncing.

Your data stays on your computer and is never sent to us. No account. Updating
later? Replace this Busy Home folder with the new one. Your home folder is
separate, so nothing is lost.
"""


def make_home_zip() -> None:
    out = SITE / "downloads" / "busy-home.zip"
    if not HOME_LIVE:
        if out.exists():
            out.unlink()
        return
    out.parent.mkdir(exist_ok=True)
    files = suite_zip_files("house")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy Home/START HERE.txt", HOME_START_HERE)
        for p in files:
            name = (Path("Busy Home") / p.relative_to(APP)).as_posix()
            text = zip_text(p, files)
            if text is not None:
                z.writestr(name, text)
            else:
                z.write(p, name)
    print(f"website/downloads/{out.name}: {len(files) + 1} files, {out.stat().st_size // 1024} KB")



RENTALS_START_HERE = """Busy Rentals - free rental management for people who let one home or a few.

1. Move this Busy Rentals folder somewhere you will find it again, like Documents.
2. Double-click rentals.html. It opens in your browser. Use Chrome or Edge: they can
   save your rentals folder as files (Safari and Firefox cannot).
3. Pick a folder for your files: your homes, tenancies, certificates, receipts and letters.
   Put it inside Google Drive, Dropbox, OneDrive or iCloud Drive if you want backups and syncing.

Your data stays on your computer and is never sent to us. No account, no AI. Busy keeps the
dates and the records, with the official source for each; it never gives legal or tax advice.

More: https://busy.com.ai/rentals/
"""


def make_rentals_zip() -> None:
    out = SITE / "downloads" / "busy-rentals.zip"
    if not RENTALS_LIVE:
        if out.exists():
            out.unlink()
        return
    out.parent.mkdir(exist_ok=True)
    # Rentals' pages read documents with filetext.js, which the build counts as Home's and Growth's: it comes along.
    files = suite_zip_files("rentals") + [APP / "shared" / "filetext.js"]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy Rentals/START HERE.txt", RENTALS_START_HERE)
        for p in files:
            name = (Path("Busy Rentals") / p.relative_to(APP)).as_posix()
            text = zip_text(p, files)
            if text is not None:
                z.writestr(name, text)
            else:
                z.write(p, name)
    print(f"website/downloads/{out.name}: {len(files) + 1} files, {out.stat().st_size // 1024} KB")


def make_growth_zip() -> None:
    out = SITE / "downloads" / "busy-growth.zip"
    if not GROWTH_LIVE:
        if out.exists():
            out.unlink()
        return
    out.parent.mkdir(exist_ok=True)
    files = growth_zip_files()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy Growth/START HERE.txt", GROWTH_START_HERE)
        for p in files:
            name = (Path("Busy Growth") / p.relative_to(APP)).as_posix()
            text = zip_text(p, files)
            if text is not None:
                z.writestr(name, text)
            else:
                z.write(p, name)
    print(f"website/downloads/{out.name}: {len(files) + 1} files, {out.stat().st_size // 1024} KB")


# ---------- marketing studio library ----------

def parse_skill(path: Path) -> dict:
    text = path.read_text()
    _, fm, body = text.split("---", 2)
    meta = {}
    for line in fm.strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    body = body.strip()
    base = MKT / "skills" / "base" / f"{meta['id']}.md"
    if meta.get("base") == "true":
        body += "\n\n## Playbook\n\n" + base.read_text().strip()
    return {
        "id": meta["id"], "name": meta["name"], "emoji": meta["emoji"], "group": meta["group"],
        "summary": meta["summary"], "ask": meta["ask"], "web": meta.get("web") == "true",
        "starters": [x.strip() for x in meta.get("starters", "").split("|") if x.strip()],
        "source": meta.get("source", ""), "body": body,
    }


def build_marketing() -> None:
    """Bundles the vetted skill library into one plain script the Studio loads. Nothing is fetched at
    run time, so the library only changes when someone edits marketing/ and rebuilds on purpose."""
    skills = [parse_skill(p) for p in sorted((MKT / "skills").glob("*.md"))]
    # The free Studio has no AI: it shows the playbooks as what Olaf does for you, so it gets each
    # playbook's name and summary only, never the instructions (those are Olaf's).
    data = {
        "foundationDoc": (MKT / "FOUNDATION.md").read_text().strip(),
        "skills": [{k: s[k] for k in ("id", "emoji", "name", "summary", "group") if k in s} for s in skills],
    }
    out = APP / "apps" / "marketing" / "library.js"
    out.write_text("/* Generated by build.py from marketing/: do not edit by hand. */\n"
                   "window.BW = window.BW || {};\nBW.mktLibrary = " + json.dumps(data, ensure_ascii=False) + ";\n")
    lic = APP / "apps" / "marketing" / "licenses"
    lic.mkdir(exist_ok=True)
    for f in (MKT / "licenses").iterdir():
        shutil.copy(f, lic / f.name)
    print(f"marketing library: {len(skills)} skills, {out.stat().st_size // 1024} KB")


# ---------- olaf (paid, private) ----------
# Olaf lives in a private repository. Its build drops two things here: olaf-demo/ (the website demo:
# screens and example business, no skill instructions, no AI) and olaf-fingerprints.json (one-way
# hashes of every line that is Olaf's alone). This build publishes the demo and refuses to publish
# anything that matches a fingerprint.

OLAF_DEMO = ROOT / "olaf-demo"
FINGERPRINTS = ROOT / "olaf-fingerprints.json"


def olaf_lib() -> dict:
    f = OLAF_DEMO / "library.js"
    if not f.is_file():
        return {"skills": [], "groups": []}
    return json.loads(f.read_text().split("BW.olafLibrary = ", 1)[1].rstrip().rstrip(";"))


def copy_olaf_demo() -> None:
    if not OLAF_DEMO.is_dir():
        print("olaf demo: not found (build the private Olaf repo to add it)")
        return
    lib = olaf_lib()
    if lib.get("edition") != "demo" or any(s.get("body") for s in lib["skills"]) or lib.get("refs") or lib.get("templates"):
        raise SystemExit("olaf-demo/library.js is not a demo build: it contains skill text. Rebuild it with the private Olaf build.")
    target = SITE / "app" / "apps" / "olaf"
    shutil.copytree(OLAF_DEMO, target, ignore=lambda d, names: [n for n in names if n.startswith(".") or n == "README.md"])
    print(f"olaf demo: {len(lib['skills'])} skills listed, no instructions")
    # Ivy and Juno have no screens on the website, but the demo shows what they prepare ("Needs your yes"): the same
    # link script as Olaf's (pretend cards only: it carries no skill), with each expert's picture.
    for name in ("ivy", "juno"):
        room = SITE / "app" / "apps" / name / "room"
        room.mkdir(parents=True, exist_ok=True)
        shutil.copy2(OLAF_DEMO / "room" / "link.js", room / "link.js")
        shutil.copy2(ROOT / "website" / "assets" / "experts" / f"{name}-hello.png", room / f"{name}-hello.png")


def make_demo() -> None:
    """The website's copy of the tools is a demo: every page loads assets/demo.js before core.js, which
    fills the tools with the pretend studio for as long as the tab is open (see that file)."""
    # every tool page, and every page at the top of the app (each suite's Today and the screens of its parts)
    pages = sorted(set((SITE / "app").rglob("index.html")) | set((SITE / "app").glob("*.html")))
    for page in pages:
        html = page.read_text()
        rel = os.path.relpath(SITE / "assets" / "demo.js", page.parent).replace(os.sep, "/")
        tag = f'<script src="{rel}"></script>\n'
        new, n = re.subn(r'(<script src="[^"]*shared/core\.js"></script>)', lambda m: tag + m.group(1), html, count=1)
        if not n:
            raise SystemExit(f"{page.relative_to(ROOT)} does not load core.js")
        page.write_text(new)
    print(f"website demo: {len(pages)} pages")


def sentences(text: str):
    """Sentences as the leak check sees them, wherever they sit: in markdown, in HTML, or inside a
    JavaScript string. Headings, list items, paragraphs and HTML blocks each start fresh; tags,
    escapes, list markers and line wrapping are ignored.
    Keep this in step with the copy in the other repository's build.py."""
    text = text.replace("\\n", "\n").replace('\\"', '"').replace("\\u2019", "’")
    text = re.sub(r"</?(p|li|h[1-6]|div|section|td|th|tr|br|ul|ol|summary|details|blockquote)\b[^>]*>", "\n\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    # Quotes and backticks end a piece of text, so code around a string can't hide what is in it.
    text = re.sub(r'["`]', "\n\n", text)
    blocks, cur = [], []
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("#"):  # a heading is a block of its own
            if cur:
                blocks.append(" ".join(cur))
            blocks.append(s)
            cur = []
        elif not s or re.match(r"^([>|*`-]|\d+[.)]\s)", s):
            if cur:
                blocks.append(" ".join(cur))
            cur = [s] if s else []
        else:
            cur.append(s)
    if cur:
        blocks.append(" ".join(cur))
    for block in blocks:
        for s in re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", block)):
            s = re.sub(r"^[\s\-*#>|0-9.)]+", "", s).strip().lower()
            if len(s) >= 40 and sum(c.isalpha() or c == " " for c in s) / len(s) >= 0.8:
                yield s


def leak_check() -> None:
    """No line that belongs only to Olaf may reach the website or the free download."""
    if (APP / "apps" / "olaf").exists():
        raise SystemExit("app/apps/olaf exists in the free repo: Olaf must only live in the private repo.")
    if not FINGERPRINTS.is_file():
        print("leak check: no olaf-fingerprints.json, skipped")
        return
    bad = set(json.loads(FINGERPRINTS.read_text())["hashes"])
    hits = {}
    for base in (SITE, APP):
        for f in base.rglob("*"):
            if f.is_file() and f.suffix in (".html", ".js", ".json", ".md", ".txt", ".css", ".xml"):
                n = sum(1 for x in sentences(f.read_text(errors="ignore")) if hashlib.sha256(x.encode()).hexdigest()[:20] in bad)
                if n:
                    hits[str(f.relative_to(ROOT))] = n
    if hits:
        raise SystemExit(f"leak check: Olaf's paid text found in {hits}. Nothing was published; remove it and rebuild.")
    print(f"leak check: clean ({len(bad)} Olaf-only sentences checked)")


# ---------- product pages ----------

def scenes() -> dict:
    """The little moving pictures from the Busy Business showcase, reused on each product page."""
    src = (SITE / "content" / "scenes.html").read_text()
    found = re.findall(r'(<div class="scene" data-scene="(\w+)">.*?</div>)(?=\s*<div class="scene"|\s*</div>\s*</div>\s*</div>)', src, re.S)
    return {sid: block.replace('class="scene"', 'class="scene on"', 1) for block, sid in found}


OLAF_PRICE = "$7.99 once"  # Busy Business with Olaf on itch.io (owner, 2026-11-12); the same figure as PRODUCTS["olaf"]
# The Olaf waitlist. The site has no server, so the form posts to a form service (Formspree or any
# service that accepts a normal form POST and answers JSON). Set both in the GitHub repository:
# Settings → Secrets and variables → Actions → Variables.
WAITLIST_ENDPOINT = os.environ.get("WAITLIST_ENDPOINT", "")
CF_ANALYTICS_TOKEN = os.environ.get("CF_ANALYTICS_TOKEN", "")  # see site_counter
WAITLIST_PROVIDER = os.environ.get("WAITLIST_PROVIDER") or "MailerLite"
# Busy Growth has its own list (a second MailerLite form), so Olaf's list stays Olaf's.
GROWTH_WAITLIST_ENDPOINT = os.environ.get("GROWTH_WAITLIST_ENDPOINT", "")

# What is for sale, and where (owner, 2026-11-12): the paid apps and the games are sold on itch.io, in dollars, at
# introductory prices. Every button, price, table and the search data read from this one table. A link always goes
# to the product's own page, never to the profile, and always opens in a new tab (itch_button).
ITCH = "https://busyai.itch.io/"
PRODUCTS = {
    "olaf": {"name": "Busy Business with Olaf", "who": "Olaf", "suite": "Busy Business", "url": ITCH + "busy-business", "price": "$7.99", "amount": "7.99",
             "film": "busy-business", "runs": "Mac and Windows", "adds": "Olaf, your brand consultant"},
    "ivy": {"name": "Busy Growth with Ivy", "who": "Ivy", "suite": "Busy Growth", "url": ITCH + "busy-growth", "price": "$1.49", "amount": "1.49",
            "film": "busy-growth", "runs": "Mac and Windows", "adds": "Ivy, your career coach"},
    "juno": {"name": "Busy Home with Juno", "who": "Juno", "suite": "Busy Home", "url": ITCH + "busy-home", "price": "$1.49", "amount": "1.49",
             "film": "busy-home", "runs": "Mac and Windows", "adds": "Juno, your household assistant"},
    "tuck": {"name": "Busy Street: Tuck's Errand", "who": "", "suite": "Busy Games", "url": ITCH + "tucks-errand", "price": "$1.99", "amount": "1.99",
             "film": "tucks-errand", "runs": "Mac and Windows", "adds": "all 15 levels: the street and nine worlds"},
    "street3d": {"name": "Busy Street 3D", "who": "", "suite": "Busy Games", "url": ITCH + "busy-street-3d", "price": "$3.99", "amount": "3.99",
                 "film": "busy-street-3d", "runs": "Mac (Apple silicon)", "adds": "23 levels in 3D, eight worlds"},
}

# Busy Rentals' paid edition (owner, 17 November 2026): on sale, and in every list of what is for sale, only once
# Busy Rentals is live, so nothing names Wren before then.
WREN_RUNS_ON = "macOS, Windows"  # the same words on every page that describes her
WREN = {"name": "Busy Rentals with Wren", "who": "Wren", "suite": "Busy Rentals", "url": ITCH + "busy-rentals", "price": "$4.99", "amount": "4.99",
        "film": "busy-rentals", "runs": "Mac and Windows", "adds": "Wren, your property manager"}
if RENTALS_LIVE:
    PRODUCTS["wren"] = WREN
# Busy Kitchen's chef (decided 18 November 2026: Sal, a man, the sun colour; $1.49 once on itch.io).
SAL = {"name": "Busy Kitchen with Sal", "who": "Sal", "suite": "Busy Kitchen", "url": ITCH + "busy-kitchen", "price": "$1.49", "amount": "1.49",
       "film": "busy-kitchen", "runs": "Mac and Windows", "adds": "Sal, your chef"}
if KITCHEN_LIVE:
    PRODUCTS["sal"] = SAL

FROM_PRICE = "$" + min(PRODUCTS[k]["amount"] for k in ("olaf", "ivy", "juno"))  # the cheapest app with an expert: "from $1.49"

# The one honest line about Claude, the same words under every expert's buy button (20 November 2026), so nobody
# buys an expert they cannot run. One sentence, one translation.
CLAUDE_LINE = "Works on your own Claude: the Claude app with a paid plan, or a Claude API key."
# Where each expert is introduced on the site: their own page, or their section on their suite's page.
EXPERT_PAGE = {"olaf": "business/olaf.html", "ivy": "growth/ivy.html", "juno": "home/juno.html", "wren": "rentals/wren.html", "sal": "kitchen/sal.html"}


def experts_live() -> list:
    """The experts on sale, in the order the site names them."""
    return [k for k in ("olaf", "ivy", "juno", "wren", "sal") if k in PRODUCTS]


def claude_small(cls: str = "") -> str:
    """The Claude sentence inline, inside a paragraph or a table cell (claude_line() is the block one)."""
    return f'<small class="claude-line{" " + cls if cls else ""}">{CLAUDE_LINE}</small>'


def itch_button(key: str, label: str = None, big: bool = False, primary: bool = True) -> str:
    """The way to buy: the product's own page on itch.io, in a new tab, with where it goes and what it costs."""
    x = PRODUCTS[key]
    cls = "btn" + (" btn-big" if big else "") + (" btn-primary" if primary else "") + " out"
    return f'<a class="{cls}" href="{e(x["url"])}" target="_blank" rel="noopener">{e(label or "Get it on itch.io")} · {x["price"]} <span aria-hidden="true">↗</span></a>'




def claude_line(cls: str = "") -> str:
    return f'<p class="claude-line{" " + cls if cls else ""}">{CLAUDE_LINE}</p>'


def film(key: str, prefix: str = "../", label: str = None) -> str:
    """A product's short film: our own file, nothing loads until the visitor presses play (the site sends nothing anywhere)."""
    x = PRODUCTS[key]
    return (f'<figure class="film reveal"><video controls playsinline preload="none" poster="{prefix}assets/films/{x["film"]}.jpg" '
            f'src="{prefix}assets/films/{x["film"]}.mp4" aria-label="{e(label or x["name"])}: a short film"></video>'
            f'<figcaption class="center faint"><a href="{prefix}films/{x["film"]}.html">The film on its own page →</a></figcaption></figure>')


def waitlist_form(where: str, endpoint: str = None, consent: str = None, button: str = "🧭 Put me on the list", who: str = None) -> str:
    """The sign-up form for people who want to buy Olaf when checkout opens. MailerLite (the default)
    takes its own field names: fields[email], and the business in fields[name] (the form's "Company"
    box is MailerLite's Name field). It confirms each address by email
    (double opt-in, set in MailerLite); Formspree takes plain names and a hidden spam trap."""
    endpoint = WAITLIST_ENDPOINT if endpoint is None else endpoint
    consent = consent or "Email me when Olaf is ready. Nothing else, and I can unsubscribe any time."
    ml = WAITLIST_PROVIDER.lower() == "mailerlite"
    email, business = ("fields[email]", "fields[name]") if ml else ("email", "business")
    extra = ('<input type="hidden" name="ml-submit" value="1"><input type="hidden" name="anticsrf" value="true">' if ml
             else f'<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="wl-hp" aria-hidden="true"><input type="hidden" name="source" value="{e(where)}">')
    return f"""<form class="waitlist" data-waitlist data-provider="{e(WAITLIST_PROVIDER.lower())}" action="{e(endpoint)}" method="post" data-where="{e(where)}">
          <label class="wl-field"><span>Your email</span><input class="in" type="email" name="{email}" required autocomplete="email" placeholder="you@yourbusiness.com"></label>
          {who if who is not None else f'<label class="wl-field"><span>Your business <em>(optional)</em></span><input class="in" name="{business}" autocomplete="organization" placeholder="e.g. bike shop in Haarlem"></label>'}
          <label class="wl-check"><input type="checkbox" name="consent" value="yes" required> <span>{e(consent)}</span></label>
          {extra}
          <button class="btn btn-big btn-primary" type="submit">{button}</button>
          <p class="wl-msg" role="status" aria-live="polite"></p>
          <small class="faint">We only use your email for this. How we handle it: <a href="privacy.html#waitlist">privacy</a>.</small>
        </form>"""


def paths_block(prefix: str, on_olaf: bool = False) -> str:
    """The choice between the free toolbox and Olaf, shared by the Busy Business page, the Studio page and the Olaf
    page (on_olaf: there the card has no "Meet Olaf", which would lead to the page it is on)."""
    n_skills = len(olaf_lib()["skills"]) or 52
    return f"""  <section class="section" id="grow">
    <div class="wrap">
      <div class="center reveal"><h2 class="big">Two ways to grow your business</h2><p class="lead">Both run on the same proven marketing science and the same project plan. The difference is who does the thinking, the remembering and the work.</p></div>
      <div class="paths">
        <article class="card path reveal pop">
          <span class="chip chip-mint">Free</span>
          <span class="e">🧰</span>
          <h3>Do it yourself</h3>
          <p class="path-sub">The Busy toolbox with the Marketing Studio and the Project Planner</p>
          <ul>
            <li>All {len(json.loads(TOOLS_JSON.read_text()))} tools, from invoices to stock, free forever</li>
            <li>A Marketing Studio: brand profile, year plan, content calendar and insights, on the same science Olaf uses</li>
            <li>A Project Planner: timeline, who does what, and a weekly update</li>
            <li>You decide what to work on, and when</li>
            <li>No account and no AI: everything stays in your own folder</li>
          </ul>
          <p class="price"><b>Free</b> <small>forever</small></p>
          <a class="btn btn-big" href="{prefix}business/download.html">⬇️ Download free</a>
        </article>
        <article class="card path featured reveal pop" style="transition-delay:.1s">
          <span class="chip chip-sun">Most help</span>
          <span class="e">🧭</span>
          <h3>Guided by Olaf, your brand consultant</h3>
          <p class="path-sub">A marketing coach and a project lead in one, inside Busy</p>
          <ul>
            <li><b>Looks at your business</b> and tells you where you stand</li>
            <li><b>A 90-day marketing plan</b>, then a ten-minute check-in each week with one to three steps that fit your hours</li>
            <li><b>Does the work with you</b>: writes the posts, review requests, newsletter and plan, fixes your listing text</li>
            <li><b>Runs your projects</b>: writes the plan, checks in every week, re-plans when something slips, drafts the update for your client</li>
            <li><b>One plan for both</b>: every marketing action is a task on your team's Project Board</li>
            <li><b>Remembers everything</b>, researches the web and reads your sales numbers for a monthly review</li>
          </ul>
          <p class="price"><b>{PRODUCTS["olaf"]["price"]}</b> <small>once, on your own Claude</small></p>
          <div class="row-flex">{itch_button("olaf", big=True)}{"" if on_olaf else f'<a class="btn btn-big" href="{prefix}business/olaf.html">Meet Olaf</a>'}<a class="btn btn-big" href="{prefix}app/apps/olaf/index.html">Try the demo</a></div>
          {claude_line()}
          <p class="fine">Already using the Studio? Olaf starts from your brand profile.</p>
        </article>
      </div>
      <details class="cmp-details" open><summary>Compare the two in detail</summary>
      <div class="cmp reveal" role="region" aria-label="Free toolbox compared with Olaf" tabindex="0">
        <table>
          <thead><tr><th></th><th>Do it yourself</th><th>Guided by Olaf</th></tr></thead>
          <tbody>
            <tr><td>Proven brand growth science built in</td><td>✓</td><td>✓</td></tr>
            <tr><td>Marketing</td><td>Brand profile, year plan, content calendar, insights</td><td>All of that, plus {n_skills} skills that do the work, with the growth coach and a project lead</td></tr>
            <tr><td>AI</td><td>None: you do the work</td><td>Claude, on your own account: the Claude app with a paid plan, or a Claude API key</td></tr>
            <tr><td>Who decides what to do next</td><td>You</td><td>Olaf suggests, you approve</td></tr>
            <tr><td>Weekly check-ins and a 90-day plan</td><td>You plan it yourself</td><td>✓</td></tr>
            <tr><td>Does the work (reads your files, researches, writes it all)</td><td>You do it yourself</td><td>✓</td></tr>
            <tr><td>Remembers past work and results</td><td>Your brand profile</td><td>Profile, plans, journey and every output</td></tr>
            <tr><td>Reads your sales numbers</td><td>New customers on the Monitor tab</td><td>✓ Uses them in every monthly review</td></tr>
            <tr><td>Project planning</td><td>Project Planner: timeline, workload, updates you send</td><td>Olaf writes the plan, checks in weekly, re-plans and drafts updates</td></tr>
            <tr><td>Marketing actions as tasks on your Project Board</td><td>✓</td><td>✓</td></tr>
            <tr><td>Your data</td><td>Your folder, never sent to us</td><td>Your folder, never sent to us</td></tr>
            <tr><td>Price</td><td>Free</td><td>{PRODUCTS["olaf"]["price"]} once on itch.io, on your own Claude</td></tr>
          </tbody>
        </table>
      </div>
      </details>
    </div>
  </section>
"""


def olaf_strip(prefix: str = "../") -> str:
    return f"""  <section class="wrap olaf-strip reveal"><div class="card">
    <span class="e">🧭</span>
    <div><b>With Olaf, your brand consultant · {PRODUCTS["olaf"]["price"]} once</b><p>Olaf, our brand consultant, looks at your business, plans what comes next and checks in every week to do the work with you.</p>{claude_line()}</div>
    <a class="btn" href="{prefix}business/olaf.html">Meet Olaf →</a>
  </div></section>"""


SIBLINGS = ("olaf.html", "download.html")  # business pages that sit next to each other in /business/


def to_business(html_text: str) -> str:
    """A page written for the site root, moved into /business/: links to the root get ../, business
    pages stay siblings, and old /tools/ addresses become their /business/ ones."""
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r"(?:[a-z]+:|#|/|\.\./|data:|mailto:)", url):
            return m.group(0)
        if url.startswith("tools/"):
            url = "tools.html" + url[len("tools/index.html"):] if url.startswith("tools/index.html") else url[len("tools/"):]
        elif url.startswith("business/"):
            url = url[len("business/"):]
        elif not url.split("#")[0] in SIBLINGS:
            url = "../" + url
        return f'{attr}="{url}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, html_text)


FORWARD = '<meta name="busy-forward"'


def forward_page(new_rel: str, depth: int) -> str:
    """An old address, kept working: forwards at once (keeping #part), and names the new page as canonical."""
    rel = "../" * depth + new_rel
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">{FORWARD} content="{new_rel}">
<title>Moved to {SITE_URL}/{new_rel}</title>
<link rel="canonical" href="{SITE_URL}/{new_rel}">
<meta http-equiv="refresh" content="0; url={rel}">
<script>location.replace({json.dumps(rel)} + location.hash);</script>
</head><body><p>This page moved to <a href="{rel}">{SITE_URL}/{new_rel}</a>.</p></body></html>
"""


def site_pages(forwards: bool = False) -> list:
    """Every published page: the root, the suites, the games. Forwarding pages only when asked."""
    pages = list(SITE.glob("*.html"))
    for d in ("business", "games", "growth", "home", "rentals", "kitchen", "films"):
        pages += list((SITE / d).glob("*.html"))
    return [p for p in pages if forwards or FORWARD not in p.read_text()]


# The hand-written homepage says "soon" about Busy Growth until it launches. Each pair is (soon, live);
# the build writes whichever matches the switch, so turning it off again puts the old words back.
HOMEPAGE_GROWTH = [
    ("and soon Busy Growth for your career", "and Busy Growth for your career"),
    ("Busy Growth is coming soon.", "Start with Busy Growth."),
    ('<li>Job tracker, CV builder, interview stories</li>', '<li>Job tracker, CVs, stories and contacts</li>'),
    ('<span class="chip chip-grey">Coming soon</span><span class="expert-chip ivy">', f'<span class="chip chip-mint">Live · {len(GROWTH_APPS)} tools</span><span class="expert-chip ivy">'),
]


# The same for Busy Home.
HOMEPAGE_HOME = [
    ('<span class="chip chip-grey">Soon</span><span class="expert-chip juno">', f'<span class="chip chip-tomato">Live · {len(HOUSE_APPS)} tools</span><span class="expert-chip juno">'),
    ("Drowning in household paperwork? Busy Home is on its way.", "Drowning in household paperwork? Busy Home."),
]


def sync_home_launch() -> None:
    page = SITE / "index.html"
    text = page.read_text()
    # The live chip counts Home's tools; a count from an older build is brought up to date first.
    text = re.sub(r'(<span class="chip chip-tomato">Live · )\d+( tools</span><span class="expert-chip juno">)', lambda m: f"{m.group(1)}{len(HOUSE_APPS)}{m.group(2)}", text)
    for soon, live in HOMEPAGE_HOME:
        old, new = (soon, live) if HOME_LIVE else (live, soon)
        text = text.replace(old, new)
        if new not in text:
            raise SystemExit(f"website/index.html lost the Busy Home words: {new!r}")
    page.write_text(text)


def sync_growth_launch() -> None:
    page = SITE / "index.html"
    text = page.read_text()
    for soon, live in HOMEPAGE_GROWTH:
        old, new = (soon, live) if GROWTH_LIVE else (live, soon)
        text = text.replace(old, new)
        if new not in text:
            raise SystemExit(f"website/index.html lost the Busy Growth words: {new!r}")
    page.write_text(text)


# The same for Busy Rentals: the homepage's own descriptions (for search and for sharing) count the apps. Each pair
# is (three apps, four apps); the hero's line is written by street_card() from the same words (APPS_COUNT, APPS_FOR).
HOMEPAGE_RENTALS = [
    ("three free, private apps for your brand, your growth and your home, and daily brain games.",
     "four free, private apps for your brand, your growth, your home and the home you let, and daily brain games."),
    ("three free apps for your brand, your growth and your home. The boring part made easy",
     "four free apps for your brand, your growth, your home and the home you let. The boring part made easy"),
]


HOMEPAGE_KITCHEN = [
    ("four free, private apps for your brand, your growth, your home and the home you let, and daily brain games.",
     "five free, private apps for your brand, your growth, your home, the home you let and your kitchen, and daily brain games."),
    ("four free apps for your brand, your growth, your home and the home you let. The boring part made easy",
     "five free apps for your brand, your growth, your home, the home you let and your kitchen. The boring part made easy"),
]


def sync_kitchen_launch() -> None:
    """Five apps on the homepage while Busy Kitchen is live (with Busy Rentals); four again when it is off."""
    if not RENTALS_LIVE:
        return
    page = SITE / "index.html"
    text = page.read_text()
    for four, five in HOMEPAGE_KITCHEN:
        old, new = (four, five) if KITCHEN_LIVE else (five, four)
        text = text.replace(old, new)
    page.write_text(text)


def sync_rentals_launch() -> None:
    page = SITE / "index.html"
    text = page.read_text()
    for four, five in HOMEPAGE_KITCHEN:  # back to four first; sync_kitchen_launch() makes it five again while Kitchen is live
        text = text.replace(five, four)
    for three, four in HOMEPAGE_RENTALS:
        old, new = (three, four) if RENTALS_LIVE else (four, three)
        text = text.replace(old, new)
        if new not in text:
            raise SystemExit(f"website/index.html lost the words that count the apps: {new!r}")
    page.write_text(text)


def sync_homepage_paths() -> None:
    page = SITE / "business" / "index.html"
    html = page.read_text()
    new = re.sub(r"(  <!-- paths:start \(generated by build\.py\) -->\n).*?(  <!-- paths:end -->)",
                 lambda m: m.group(1) + paths_block("../") + m.group(2), html, flags=re.S)
    if new == html and "paths:start" not in html:
        raise SystemExit("website/business/index.html lost its paths:start marker")
    page.write_text(new)


# The hand-written pages get the same top bar and footer as the generated ones, at every build.
HAND_WRITTEN = {"index.html": ("", "explore"), "privacy.html": ("", "explore"), "terms.html": ("", "explore"), "404.html": ("/", "explore"),
                "business/index.html": ("../", None), "business/download.html": ("../", None)}


def sync_chrome(tools: list) -> None:
    for rel, (prefix, cta) in HAND_WRITTEN.items():
        page = SITE / rel
        html = page.read_text()
        bar = nav_header(prefix, explore(prefix) if cta == "explore" else None)
        # Keep a page's own variant of the bar (the solid one on text pages); 404 has no footer.
        new, n1 = re.subn(r'<header class="(nav[^"]*)">.*?</header>', lambda m: bar.replace('<header class="nav">', f'<header class="{m.group(1)}">', 1), html, count=1, flags=re.S)
        new = re.sub(r'<footer class="footer[^"]*">.*?</footer>', lambda m: footer(prefix, tools), new, count=1, flags=re.S)
        if not n1:
            raise SystemExit(f"website/{rel} has no <header class=\"nav\">")
        page.write_text(new)


def explore(prefix: str) -> tuple:
    """The nav button outside a suite: to the suites on the homepage."""
    return ("🧰 Explore the apps", f"{prefix}index.html#suites")


def nav_header(prefix: str, cta: tuple = None) -> str:
    """The top bar: Busy, the suites, and one button (inside Busy Business: the free download)."""
    label, href = cta or ("⬇️ Download free", f"{prefix}business/download.html")
    links = f'''<a href="{prefix}business/index.html">💼 Business</a><a href="{prefix}growth/index.html">🌱 Growth</a><a href="{prefix}home/index.html">🏡 Home</a>{f'<a href="{prefix}rentals/index.html">🔑 Rentals</a>' if RENTALS_LIVE else ""}{f'<a href="{prefix}kitchen/index.html">🍳 Kitchen</a>' if KITCHEN_LIVE else ""}<a href="{prefix}games/index.html">🧩 Games</a><a href="{prefix}pricing.html">Pricing</a><a href="{prefix}about.html">About</a>'''
    # On a narrow screen the links fold into a menu: a <details>, so it opens without scripts; site.js closes it on a
    # tap outside and on Escape. Its links are the same ones, in the same order.
    return f"""<header class="nav"><div class="wrap">
  <a class="brandmark" href="{prefix}index.html"><span class="blob">✦</span><span class="word">Busy</span></a>
  <nav class="links" aria-label="Main">{links}</nav>
  <a class="btn btn-primary" href="{href}">{label}</a>
  <details class="menu"><summary><span class="menu-icon" aria-hidden="true"></span><span class="menu-word">Menu</span></summary><nav class="menu-links" aria-label="Menu">{links}</nav></details>
</div></header>"""


def nav(prefix: str, cta: tuple = None) -> str:
    return f"""<div class="progress" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
{nav_header(prefix, cta)}"""


# The footer stays short: per suite its two best-known tools, the way to all of them and its expert.
FOOTER_PICKS = {"business": ["brand", "projects"], "growth": ["cv", "stories"], "house": ["upkeep", "papers"], "rentals": ["homes", "rent"], "games": ["stars", "trail"]}


def footer(prefix: str, tools: list) -> str:
    by_id = {t["id"]: t for t in tools}
    biz = "".join(f'<li><a href="{prefix}business/{i}.html">{by_id[i]["emoji"]} {e(by_id[i]["name"])}</a></li>' for i in FOOTER_PICKS["business"] if i in by_id)
    games = "".join(f'<li><a href="{prefix}games/{g["id"]}.html">{g["emoji"]} {e(g["name"])}</a></li>' for g in GAMES if g["id"] in FOOTER_PICKS["games"])

    def suite(name, folder, live, expert):
        if not live:
            return f'<li><a href="{prefix}{folder}/index.html">Coming soon</a></li>{expert}'
        ts = {t["id"]: t for t in suite_tools(folder)}
        picks = "".join(f'<li><a href="{prefix}{folder}/{i}.html">{ts[i]["emoji"]} {e(ts[i]["name"])}</a></li>' for i in FOOTER_PICKS[name] if i in ts)
        extra = f'<li><a href="{prefix}growth/your-review.html">Your review is coming</a></li>' if folder == "growth" else ""
        return f'{picks}<li><a href="{prefix}{folder}/index.html#tools">All {len(ts)} tools</a></li>{extra}{expert}'
    return f"""<footer class="footer sitemap"><div class="wrap">
  <div><span class="brandmark"><span class="blob">✦</span>Busy</span><p class="faint">Busy with what matters.<br>Free, private tools for work and life.</p>
    <ul><li><a href="{prefix}about.html">About Busy</a></li><li><a href="{prefix}pricing.html">Free and paid</a></li><li><a href="{prefix}updates.html">What's new</a></li><li><a href="{prefix}press.html">Press</a></li><li><a href="{prefix}films/index.html">Films</a></li><li><a href="{prefix}close-the-year.html">Close the year in an evening</a></li><li><a href="{prefix}privacy.html">Privacy</a></li><li><a href="{prefix}terms.html">Terms</a></li></ul><!--langs--></div>
  <div><b>💼 Busy Business</b><ul>{biz}<li><a href="{prefix}business/tools.html">All {len(tools)} tools</a></li><li><a href="{prefix}business/quiet-month.html">A quiet month?</a></li><li><a href="{prefix}business/olaf.html">🧭 Olaf by Busy</a></li><li><a href="{PRODUCTS["olaf"]["url"]}" target="_blank" rel="noopener">With Olaf · {PRODUCTS["olaf"]["price"]} ↗</a></li></ul>{rentals_footer(prefix, suite) if RENTALS_LIVE else ""}{kitchen_footer(prefix) if KITCHEN_LIVE else ""}
    <p style="margin-top:22px"><b>🧩 Busy Games</b></p><ul><li><a href="{prefix}games/tucks-errand.html">Tuck's Errand</a></li>{games}<li><a href="{prefix}games/index.html">All games</a></li><li><a href="{PRODUCTS["tuck"]["url"]}" target="_blank" rel="noopener">Tuck's Errand, the full game · {PRODUCTS["tuck"]["price"]} ↗</a></li><li><a href="{PRODUCTS["street3d"]["url"]}" target="_blank" rel="noopener">Busy Street 3D · {PRODUCTS["street3d"]["price"]} ↗</a></li></ul></div>
  <div><b>🌱 Busy Growth</b><ul>{suite("growth", "growth", GROWTH_LIVE, f'<li><a href="{prefix}growth/ivy.html">🌿 Ivy by Busy</a></li><li><a href="{PRODUCTS["ivy"]["url"]}" target="_blank" rel="noopener">With Ivy · {PRODUCTS["ivy"]["price"]} ↗</a></li>')}</ul>
    <p style="margin-top:22px"><b>🏡 Busy Home</b></p><ul>{suite("house", "home", HOME_LIVE, f'<li><a href="{prefix}home/juno.html">🏡 Juno by Busy</a></li><li><a href="{PRODUCTS["juno"]["url"]}" target="_blank" rel="noopener">With Juno · {PRODUCTS["juno"]["price"]} ↗</a></li>')}</ul></div>
  <p class="foot-claude">Each expert works on your own Claude: the Claude app with a paid plan, or a Claude API key.</p>
</div>{download_panel(prefix)}</footer>"""



def rentals_footer(prefix: str, suite) -> str:
    """Busy Rentals in the footer, under Busy Home: only once it is live."""
    return (f'<p style="margin-top:22px"><b>🔑 Busy Rentals</b></p><ul>'
            + suite("rentals", "rentals", True, f'<li><a href="{prefix}rentals/wren.html">🔑 Wren by Busy</a></li><li><a href="{WREN["url"]}" target="_blank" rel="noopener">With Wren · {WREN["price"]} ↗</a></li>')
            + "</ul>")


# Icons the website (and crawlers) can fetch: not under app/, which robots.txt keeps out.
ICONS = '<link rel="icon" href="{prefix}favicon.ico" sizes="any"><link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png"><link rel="manifest" href="{prefix}site.webmanifest">'


def head(title: str, desc: str, path: str, prefix: str, extra: str = "", image: str = "og-busy.png") -> str:
    url = f"{SITE_URL}/{path}"
    img = f"{SITE_URL}/assets/{image}"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Busy">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}">
<meta property="og:image" content="{img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{e(IMAGES["assets/" + image][1])}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{img}"><meta name="twitter:image:alt" content="{e(IMAGES["assets/" + image][1])}">
<meta name="theme-color" content="#FFC93C">
{ICONS.replace("{prefix}", prefix)}
<link rel="stylesheet" href="{prefix}app/shared/brand.css">
<link rel="stylesheet" href="{prefix}assets/site.css">
{extra}</head>"""


# ---------- images: what they are, for people, search engines and AI ----------
# Alt text for each share image (og:image:alt), and readable metadata inside the files: PNG text
# chunks (Title, Description, Author, Copyright, Source) and an SVG <title>/<desc>. Written by
# image_metadata() at build time; running it again changes nothing.
IMAGES = {
    "assets/og-busy.png": ("Busy: free, private tools for work and life",
                           "Busy share image: free, private tools for work and life, with suites for business, daily brain games and career growth."),
    "assets/og-tucks-errand.png": ("Busy Street: Tuck's Errand, a free game",
                                   "Share image of the game Busy Street: Tuck's Errand: Tuck, Rivet and Zip at the foot of the Glasshouse."),
    "assets/og-games.png": ("Busy Games: free daily puzzles",
                            "Busy Games share image: a new puzzle every day, free and without an account, at the puzzle kiosk on Busy Street."),
    "assets/og-olaf.png": ("Olaf by Busy: your brand consultant",
                           "Olaf share image: the brand consultant in the paid edition of Busy, in his study above the Workshop."),
    "assets/logo-512.png": ("Busy logo", "The Busy logo: a sun-yellow rounded tile with a dark sparkle."),
    "apple-touch-icon.png": ("Busy icon", "The Busy app icon: a sun-yellow rounded tile with a dark sparkle."),
    "assets/favicon.svg": ("Busy logo", "The Busy logo: a sun-yellow rounded tile with a dark sparkle."),
    "assets/olaf-mark.svg": ("Olaf logo", "The Olaf logo: a purple compass pointing up and to the right."),
    "assets/og-business.png": ("Busy Business: free tools for small businesses",
                               "Busy Business share image: free, private business tools for invoices, time, receipts, money, projects and marketing."),
    "assets/og-ivy.png": ("Ivy by Busy: your career coach",
                          "Ivy share image: the career coach in Busy Growth, at the top of the Glasshouse."),
    "assets/ivy-mark.svg": ("Ivy logo", "The Ivy logo: a green ivy leaf on a short stem, leaning up and to the right."),
    "assets/og-juno.png": ("Juno by Busy: your household assistant",
                           "Juno share image: the household assistant in Busy Home. Explains the letter, writes the reply, keeps you ahead. Juno in her gable room."),
    "assets/juno-mark.svg": ("Juno logo", "The Juno logo: a coral house with a lit window and a chimney, leaning up and to the right."),
}
if RENTALS_LIVE:  # Busy Rentals' pictures are on the website only while it is live
    IMAGES.update({"assets/og-wren.png": ("Busy Rentals: be the landlord people hope for",
                                          "Busy Rentals share image: be the landlord people hope for. Free, no AI, with Wren, your property manager, and her sky-blue key."),
                   "assets/wren-mark.svg": ("Wren logo", "The Wren logo: a sky-blue key with a round bow and two teeth, leaning up and to the right.")})
if KITCHEN_LIVE:  # Busy Kitchen's share image, only while it is live
    IMAGES.update({"assets/og-kitchen.png": ("Busy Kitchen: bring the world to your table",
                                             "Busy Kitchen share image: the yellow tile, the promise, and a picture made with AI of pasta rolled by hand in Bologna.")})


def png_text(data: bytes, fields: dict) -> bytes:
    """The PNG with iTXt chunks for these fields (UTF-8), replacing any it already had."""
    import struct, zlib
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    chunks, i = [], 8
    while i < len(data):
        n = struct.unpack(">I", data[i:i + 4])[0]
        kind, body = data[i + 4:i + 8], data[i + 8:i + 8 + n]
        if not (kind == b"iTXt" and body.split(b"\0", 1)[0].decode("latin-1") in fields):
            chunks.append((kind, body))
        i += 12 + n
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
    text = [(b"iTXt", k.encode("latin-1") + b"\0\0\0\0\0" + v.encode("utf-8")) for k, v in fields.items()]
    out = [chunks[0]] + text + chunks[1:]  # IHDR first, then the text
    return data[:8] + b"".join(chunk(k, b) for k, b in out)


def image_metadata() -> None:
    year = date.today().year
    for rel, (title, desc) in IMAGES.items():
        f = SITE / rel
        if f.suffix == ".png":
            data = f.read_bytes()
            new = png_text(data, {"Title": title, "Description": desc, "Author": "Busy", "Copyright": f"© {year} Busy", "Source": SITE_URL})
            if new != data:
                f.write_bytes(new)
        elif f.suffix == ".svg":
            svg = f.read_text()
            svg = re.sub(r"\s*<title>.*?</title>\s*<desc>.*?</desc>", "", svg, flags=re.S)
            svg = re.sub(r"<svg ([^>]*?)(?: role=\"img\" aria-label=\"[^\"]*\")?>", lambda m: f'<svg {m.group(1)} role="img" aria-label="{e(title)}">', svg, count=1)
            svg = svg.replace(">", f">\n  <title>{e(title)}</title><desc>{e(desc)}</desc>", 1)
            f.write_text(svg)


def jsonld(obj) -> str:
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"


def words(n: int) -> str:
    """Small counts in words, for copy like "all thirteen tools"."""
    return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen"][n] if n <= 16 else str(n)


def tool_page(t: dict, tools: list, scene: str) -> str:
    by_id = {x["id"]: x for x in tools}
    title = f'{t["title"]} · Busy'
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f'Busy {t["name"]}', "applicationCategory": "BusinessApplication",
                 "operatingSystem": "Windows, macOS, ChromeOS (in Chrome or Edge)", "description": t["description"], "url": f'{SITE_URL}/business/{t["id"]}.html',
                 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]})
    feats = "".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(t["features"]))
    steps = "".join(f'<div class="card step reveal" style="--c:var(--{t["color"]});transition-delay:{i * .1:.1f}s"><span class="num">{i + 1}</span><h3>{e(s[0])}</h3><p>{e(s[1])}</p></div>' for i, s in enumerate(t["steps"]))
    checks = "".join(f"<li>{e(c)}</li>" for c in t["checklist"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in t["faq"])
    related = "".join(f'<a class="card rel" href="{r}.html" style="--c:var(--{by_id[r]["color"]})"><span class="em">{by_id[r]["emoji"]}</span><b>{e(by_id[r]["name"])}</b><small>{e(by_id[r]["h1"])}</small></a>' for r in t["related"])
    return f"""{head(title, t["description"], f'business/{t["id"]}.html', "../", ld, image="og-business.png")}
<body class="site app-{t["color"]}">
{nav("../")}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--{t["color"]});right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <a class="crumbs" href="tools.html">← All Busy Business tools</a>
        <span class="em big" style="--c:var(--{t["color"]})">{t["emoji"]}</span>
        <p class="kicker">{e(t["name"])} · free, private, no account</p>
        <h1>{e(t["h1"])}</h1>
        <p class="lead">{e(t["lead"])}</p>
        <div class="ctas"><a class="btn btn-primary btn-big" href="../app/apps/{t["id"]}/index.html">👀 See it in the demo</a><a class="btn btn-big" href="download.html" data-download>⬇️ Download all {len(tools)} tools</a></div>
        <p class="note">Free app for Mac and Windows · Nothing is sent to us · Part of Busy Business: {len(tools)} tools for a small business</p>
      </div>
      <div class="stage solo reveal from-right"><div class="mock" style="--active:var(--{t["color"]})"><div class="mock-bar"><i></i><i></i><i></i><b>{e(t["name"])}</b></div><div class="scenes">{scene}</div></div></div>
    </div>
  </section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What it does</h2></div>
    <div class="feats">{feats}</div>
  </div></section>
{paths_block("../") if t["id"] == "marketing" else ""}  <section class="section tint" style="--c:var(--{t["color"]})"><div class="wrap">
    <div class="center reveal"><h2 class="big">Three steps, then you’re done</h2></div>
    <div class="steps">{steps}</div>
  </div></section>
  <section class="section"><div class="wrap two-col">
    <div class="reveal from-left"><h2 class="big">{e(t["checklistTitle"])}</h2><p class="lead">{e(t["name"])} puts all of this in place for you.</p></div>
    <ul class="checks-list reveal from-right">{checks}</ul>
  </div></section>
  <div class="ad-slot" data-ad="tool"></div>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">Works even better with</h2><p class="lead">All {words(len(tools))} tools share your clients, your logo and your folder.</p></div>
    <div class="rel-grid">{related}</div>
  </div></section>
{"" if t["id"] == "marketing" else olaf_strip("../")}  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{faq}</div>
  </div></section>
  <section class="final">
    <h2 class="reveal pop">{e(t["name"])}, free.</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">See it all in the demo with a pretend business, or download the whole toolbox.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px"><a class="btn btn-big" href="../app/apps/{t["id"]}/index.html">✨ Try {e(t["name"])}</a><a class="btn btn-big ghost-light" href="download.html">⬇️ Download</a></div>
  </section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def tools_index(tools: list) -> str:
    cards = "".join(f'<a class="card rel big reveal pop" href="{t["id"]}.html" style="--c:var(--{t["color"]})"><span class="em">{t["emoji"]}</span><b>{e(t["name"])}</b><small>{e(t["h1"])}</small><span class="go">See what it does →</span></a>' for t in tools)
    desc = f"{words(len(tools)).capitalize()} free, private tools for small businesses and freelancers: invoices, time, receipts, money, projects, marketing and more. No account."
    return f"""{head("All tools · Busy Business", desc, "business/tools.html", "../", image="og-business.png")}
<body class="site app-sun">
{nav("../")}
<main id="main" class="wrap">
  <section class="center" style="padding:70px 0 40px"><h1 class="reveal">The whole toolbox 🧰</h1><p class="lead reveal">{words(len(tools)).capitalize()} free tools that share one folder, one client list and one look. Pick one to see what it does.</p></section>
  <div class="rel-grid all">{cards}</div>
{olaf_strip("../")}
  <div class="ad-slot" data-ad="tool"></div>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


# ---------- the tool pages of Busy Home and Busy Growth ----------
# One page per tool, like Busy Business has: what it does, three steps and the questions, with the tool's own
# room as rendered in the Busy Studio and the guide in it. The words are in website/content/<suite>-tools.json.
SUITE_PAGES = {"home": {"name": "Busy Home", "place": "house", "guide": "tuck", "expert": "juno", "category": "LifestyleApplication",
                        "intro": "household paperwork"},
               "growth": {"name": "Busy Growth", "place": "glasshouse", "guide": "pim", "expert": "ivy", "category": "BusinessApplication",
                          "intro": "growing your career"},
               "rentals": {"name": "Busy Rentals", "place": None, "guide": None, "expert": "wren", "category": "BusinessApplication",
                           "intro": "letting one home or a few"}}


def suite_tools(folder: str) -> list:
    # The words are source, not output: read them from the repository (tests build into a temporary site).
    # Busy Rentals' words live outside the website until it is live (RENTALS_SITE), so nothing of it is published early.
    base = RENTALS_SITE / "content" if folder == "rentals" else ROOT / "website" / "content"
    return json.loads((base / f"{folder}-tools.json").read_text())


# Busy Rentals' own website files (its tool words, share image, Wren's mark, the screenshots, the film) wait in
# rentals-site/, outside the published website: copied in while RENTALS_LIVE is on, and taken out again when it is off.
RENTALS_SITE = ROOT / "rentals-site"
KITCHEN_SITE = ROOT / "kitchen-site"  # Busy Kitchen's share image and film, copied in only while KITCHEN_LIVE is on


def sync_kitchen_assets() -> None:
    for src in sorted((KITCHEN_SITE / "assets").rglob("*")) if (KITCHEN_SITE / "assets").exists() else []:
        if not src.is_file():
            continue
        dst = SITE / "assets" / src.relative_to(KITCHEN_SITE / "assets")
        if KITCHEN_LIVE:
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.read_bytes() != src.read_bytes():
                shutil.copy2(src, dst)
        else:
            for f in (dst, dst.with_suffix(".webp")):
                if f.exists():
                    f.unlink()
    if not KITCHEN_LIVE and (SITE / "assets" / "kitchen").exists():  # the page's WebP copies of the app's pictures (tools/webp.py)
        shutil.rmtree(SITE / "assets" / "kitchen")


def sync_rentals_assets() -> None:
    for src in sorted((RENTALS_SITE / "assets").rglob("*")):
        if not src.is_file():
            continue
        dst = SITE / "assets" / src.relative_to(RENTALS_SITE / "assets")
        if RENTALS_LIVE:
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.read_bytes() != src.read_bytes():
                shutil.copy2(src, dst)
        else:
            for f in (dst, dst.with_suffix(".webp")):  # and a WebP copy a build may have made of it
                if f.exists():
                    f.unlink()


def tool_sources(t: dict) -> str:
    """A Busy Rentals tool page that states a rule (a deposit cap, the days for a copy, a tax year) names the official
    page of each, and the date Busy last checked it. The pages are the app's own (app/shared/rentals.js): a page the
    app does not know stops the build, so the site and the app never give different sources."""
    rows = t.get("sources") or []
    if not rows:
        return ""
    known = (APP / "shared" / "rentals.js").read_text()
    for country, what, url in rows:
        if country not in RENTALS_PACK_OF:
            raise SystemExit(f'rentals-tools.json, {t["id"]}: "{country}" has no country pack')
        if url != ENGLAND_DEPOSIT_CAP_PAGE and f"'{url}'" not in known:
            raise SystemExit(f'rentals-tools.json, {t["id"]}: {url} is not a source in app/shared/rentals.js; the site and the app must name the same official page')
    items = "".join(f'<li><b>{e(c)}</b> <span>{e(what)}</span> <a class="out" href="{e(u)}" target="_blank" rel="noopener">Official page ↗</a></li>' for c, what, u in rows)
    return f"""
  <section class="section" id="sources"><div class="wrap">
    <div class="center reveal"><h2 class="big">Where the rules come from</h2></div>
    <div class="faq reveal"><ul class="get-list">{items}</ul>
      <p class="faint">{rentals_checked_line({c for c, _, _ in rows})}</p></div>
  </div></section>"""


# What the suite's expert does with each tool, in one line, for the strip on the tool's page (and the one under Busy
# Kitchen's tools). Each line is a job the expert's skills really have; none promises a result.
EXPERT_STRIPS = {
    "growth": {"library": "Ivy answers your questions from what you saved in your Library, and names the sources.",
               "learning": "Ivy turns a gap in your skills into a week-by-week plan in your Learning Planner, at the hours you really have.",
               "skills": "Ivy lays a job advert next to your Skills Map: what matches, with its proof, and what is missing.",
               "wins": "Ivy brings back the wins you never wrote down, with a short interview, and saves each with what changed.",
               "jobs": "Ivy reads the advert in your Job Tracker and prepares the CV, the cover letter and the interview questions for that job.",
               "cv": "Ivy writes a CV version for one job from your real wins, and your LinkedIn headline and About from the same facts.",
               "stories": "Ivy shapes your wins into interview stories and practises them with you, one question at a time.",
               "contacts": "Ivy drafts the message to catch up, to ask for a referral or to say thank you. You send it.",
               "review": "Ivy runs the weekly check-in with you: what moved, what was hard, and a small plan for next week, saved in your Weekly Review."},
    "home": {"papers": "Juno reads the scans in your Paper Trail, gives each a clear title, its dates and its person, and says what each one asks of you.",
             "contracts": "Juno reads the contract or the policy and fills in the cost, the term and the last day to cancel. Before it renews, she lays out keep, switch or cancel.",
             "upkeep": "Juno plans a repair or a renovation with you, from the quotes to ask for to the order of the work, and adds the upkeep that follows.",
             "inventory": "After water damage or a break-in, Juno lists what was lost from your Home Inventory, with values and proof, and drafts the claim letter.",
             "letters": "Juno writes the cancellation, the complaint, the claim or the objection from the facts in your own papers, ready in Letters.",
             "moving": "Juno plans the move back from moving day and drafts a change-of-address letter for every contract.",
             "binder": "Juno fills in Just in Case with you, section by section, in a calm conversation. She never asks for passwords or PINs.",
             "costs": "Juno adds this month's costs from your bills and receipts and works out who owes whom, in the fewest payments."},
    "rentals": {"homes": "Wren reads the tenancy agreement and fills in the tenants, the dates, the rent and the deposit, and prepares each check that falls due.",
                "rent": "Wren drafts a friendly reminder when the rent is late, checks the deposit against your country's cap and prepares the deposit letter at the end.",
                "rentletters": "Wren drafts the welcome letter, the reply to a repair report and the note about a visit. You send them.",
                "rentcosts": "Wren sorts a pile of bills and receipts into costs per home, and puts the year's figures together for you or your accountant."},
    "kitchen": {"": "Sal cooks with what's left, plans your week and writes the shopping list from it, minus what is in your pantry."},
}
EXPERT_OF = {"growth": "ivy", "home": "juno", "rentals": "wren", "kitchen": "sal"}  # the expert of each suite's folder


def expert_strip(folder: str, tool: str = "") -> str:
    """One line on what the suite's expert does with this very tool, the price, the Claude sentence and the way to the
    expert's own page (Busy Business has olaf_strip)."""
    key = EXPERT_OF[folder]
    x, line = PRODUCTS[key], EXPERT_STRIPS[folder].get(tool)
    if not line:
        return ""
    mark = '<span class="e" aria-hidden="true">🧂</span>' if key == "sal" else f'<img src="../assets/{key}-mark.svg" alt="" width="56" height="56">'
    return f"""  <section class="wrap expert-strip reveal"><div class="card">
    {mark}
    <div><b>With {x["adds"]} · {x["price"]} once</b><p>{e(line)}</p>{claude_line()}</div>
    <a class="btn" href="{EXPERTS[key]["page"]}">Meet {x["who"]} →</a>
  </div></section>"""


def suite_tool_page(t: dict, ts: list, folder: str) -> str:
    x, by_id = SUITE_PAGES[folder], {i["id"]: i for i in ts}
    url = f'{SITE_URL}/{folder}/{t["id"]}.html'
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f'{x["name"]} {t["name"]}', "applicationCategory": x["category"],
                 "operatingSystem": "macOS, Windows, ChromeOS (in Chrome or Edge)", "description": t["description"], "url": url,
                 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t["faq"]]})
    feats = "".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(t["features"]))
    steps = "".join(f'<div class="card step reveal" style="--c:var(--{t["color"]});transition-delay:{i * .1:.1f}s"><span class="num">{i + 1}</span><h3>{e(a)}</h3><p>{e(b)}</p></div>' for i, (a, b) in enumerate(t["steps"]))
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in t["faq"])
    related = "".join(f'<a class="card rel" href="{r}.html" style="--c:var(--{by_id[r]["color"]})"><span class="em">{by_id[r]["emoji"]}</span><b>{e(by_id[r]["name"])}</b><small>{e(by_id[r]["h1"])}</small></a>' for r in t["related"] if r in by_id)
    room = (f'<figure class="tool-room"><img src="../assets/shots/{folder}-{t["shot"]}.jpg" alt="{e(t["name"])} in {e(x["name"])}, with the demo’s example data" width="1280" height="720"></figure>'
            if t.get("shot") else
            f'<figure class="tool-room"><img src="../assets/{x["place"]}/room-{t["room"]}-1280.jpg" alt="{e(t["name"])}: its room in {e(x["name"])}, rendered in the Busy Studio" width="1280" height="720">'
            f'<img class="guide" src="../app/shared/places/{x["place"]}/{x["guide"]}-point.png" alt="" width="300" height="354"></figure>')
    return f"""{head(f'{t["title"]} · {x["name"]}', t["description"], f'{folder}/{t["id"]}.html', "../", ld, image=f'og-{x["expert"]}.png')}
<body class="site app-{t["color"]}">
{nav("../", ("⬇️ Download free", "index.html#get"))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--{t["color"]});right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <a class="crumbs" href="index.html#tools">← All {e(x["name"])} tools</a>
        <span class="em big" style="--c:var(--{t["color"]})">{t["emoji"]}</span>
        <p class="kicker">{e(t["name"])} · free, private, no account</p>
        <h1>{e(t["h1"])}</h1>
        <p class="lead">{e(t["lead"])}</p>
        <div class="ctas"><a class="btn btn-primary btn-big" href="../app/apps/{t["id"]}/index.html">👀 See it in the demo</a><a class="btn btn-big" href="index.html#get">⬇️ Get {e(x["name"])}, free</a></div>
        <p class="note">Free app for Mac and Windows · Nothing is sent to us · Part of {e(x["name"])}: {len(ts)} tools for {e(x["intro"])}</p>
      </div>
      <div class="stage solo reveal from-right">{room}</div>
    </div>
  </section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What it does</h2></div>
    <div class="feats">{feats}</div>
  </div></section>
  <section class="section tint" style="--c:var(--{t["color"]})"><div class="wrap">
    <div class="center reveal"><h2 class="big">Three steps, then you’re done</h2></div>
    <div class="steps">{steps}</div>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">Works even better with</h2><p class="lead">All {words(len(ts))} tools share your folder.</p></div>
    <div class="rel-grid">{related}</div>
  </div></section>
{expert_strip(folder, t["id"])}
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{faq}</div>
  </div></section>{tool_sources(t) if folder == "rentals" else ""}
  <section class="final">
    <h2 class="reveal pop">{e(t["name"])}, free.</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">See it in the demo, or take all of {e(x["name"])} home.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px"><a class="btn btn-big" href="../app/apps/{t["id"]}/index.html">✨ Try {e(t["name"])}</a><a class="btn btn-big ghost-light" href="index.html#get">⬇️ Download</a></div>
  </section>
</main>
{footer("../", json.loads((SITE / "content" / "tools.json").read_text()))}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def in_short(name: str, answers: list, wrap: bool = True) -> str:
    """"X in short": the short answers people and AI search ask for first, each able to stand alone, the product named
    in each. The same questions and answers go into the page's FAQPage data (faq_ld), word for word."""
    cards = "".join(f'<div class="card feat reveal pop"><h3>{e(q)}</h3><p>{e(a)}</p></div>' for q, a in answers)
    inner = f'<div class="center reveal"><h2 class="big">{e(name)} in short</h2></div>\n    <div class="feats">{cards}</div>'
    return f'<section class="section" id="in-short">{"<div class=wrap>" if wrap else ""}\n    {inner}\n  {"</div>" if wrap else ""}</section>'


def faq_ld(items: list) -> str:
    return jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                   "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]})


def suite_ld(folder: str, desc: str) -> str:
    """A suite page's own structured data: the free suite, and its paid expert."""
    x = SUITE_PAGES[folder]
    ex = EXPERTS[x["expert"]]
    return (jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": x["name"], "applicationCategory": x["category"],
                    "operatingSystem": "macOS, Windows, ChromeOS (in Chrome or Edge)", "description": desc, "url": f"{SITE_URL}/{folder}/index.html",
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}})
            + jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f'{ex["name"]} by Busy', "applicationCategory": x["category"],
                      "operatingSystem": WREN_RUNS_ON, "url": f'{SITE_URL}/{folder}/{ex["page"]}',
                      "description": f'The paid AI expert in {x["name"]}, on the owner’s own Claude.',
                      "offers": {"@type": "Offer", "price": PRODUCTS[x["expert"]]["amount"], "priceCurrency": "USD", "url": PRODUCTS[x["expert"]]["url"]}}))


# What Olaf does and the questions people ask, used on the Olaf page and in llms-full.txt.
OLAF_FEATS = [("🔍", "Looks at where you stand", "Reads your brand profile, your website and your reviews, and tells you plainly what is working and what is missing."),
         ("🗺️", "Plans your next 90 days", "A week-by-week roadmap that fits the hours you actually have, built on proven brand growth science."),
         ("⏰", "Checks in every week", "Ten minutes: what got done, what's next, and one to three steps for this week."),
         ("✍️", "Does the work with you", "Writes the posts, review requests, newsletter, press pitch and plan, and saves them in your folder."),
         ("🌐", "Researches for you", "Searches the web for your reviews, competitors, local media and the numbers it needs."),
         ("📊", "Reviews the month", "Counts new customers from your Busy invoices and adjusts the plan to what works.")]
OLAF_PROJECT_FEATS = [
    ("🚀", "A kick-off that writes the plan", "Tell Olaf the job and the date that matters. It asks a few questions and puts the milestones, tasks, people and risks in your Project Planner."),
    ("📋", "A weekly check-in", "Olaf reads the plan, sees what slipped, what waits on whom and who has too much on, agrees the week with you and updates the plan."),
    ("🛟", "Back on track", "When a project slips, Olaf works out how late it really is and lays out the options: cut scope, move a date, or get help. You choose; it re-plans."),
    ("📣", "Updates and notes, done", "Updates your client reads, a brief for a freelancer, and meeting notes turned into tasks and decisions."),
]
OLAF_FAQ = [("Is Olaf a person?", "No. Olaf is an AI brand consultant, running on Claude, Anthropic's AI. It follows proven marketing science, explains its reasoning in plain words, checks its writing, and never invents facts, reviews or numbers. You approve everything before it goes out."),
       ("What does it cost?", f"Olaf comes inside {PRODUCTS['olaf']['name']}: {PRODUCTS['olaf']['price']} once on itch.io, an introductory price. Olaf works on your own Claude: the Claude app with a paid plan, or a Claude API key. With a key you pay Anthropic for what you use."),
       ("What does the AI cost to run?", "In your own Claude app, Olaf works within your paid Claude plan. With a Claude API key you pay Anthropic for what Olaf uses. In our own tests with a key and Claude Sonnet: a weekly check-in cost about $0.10 to $0.15, making a full plan about $0.25 to $0.30, and writing a month of posts about $0.15. With a key you see the cost of every conversation and set a monthly limit."),
       ("Do I need the Marketing Studio first?", "No. If you have filled in the Studio's brand profile, Olaf starts from it. If not, Olaf's onboarding asks the questions itself, one at a time."),
       ("Where is my data?", "In your own business folder. Olaf's briefing and his prepared work are files in that folder too, read by your own Claude. What Claude reads goes to Anthropic, under your own account, and never to us. We have no server that sees your business."),
       ("Does Olaf post for me?", "No. Olaf writes and prepares; you post, send and publish. That keeps you in control of what goes out under your name."),
       ("Which computers does it work on?", "Busy Business with Olaf is an app for Mac and Windows. The demo on this site runs in your browser and shows Olaf with an example business."),
       ("Is Olaf in the free download?", "No. The free download has every Busy tool and the Marketing Studio. Olaf comes in its own download when you buy it, with Busy included. The demo on this site shows what it looks like with an example business.")]


# The seven groups of Olaf's skills, each in one plain line (the library's own descriptions are written for Claude).
OLAF_GROUP_LINES = {
    "Grow the brand": "Your brand on one page, the moments people need you, what makes you recognisable, the plan for the year and what needs you today.",
    "Projects": "A plan from a brief, the weekly check-in, the update for your client, meeting notes turned into tasks, and a late project brought back on track.",
    "Everyday marketing": "Your local listing, your posts, the newsletter, review requests, offers, the local press and the stories of happy customers.",
    "Content": "Articles and pages written in your voice, checked before they go out, and older pieces brought up to date.",
    "Website, search & AI answers": "How your website is found in search engines and in AI answers: a check of each page, the words people search for, and the fixes in order.",
    "Launches, ads & competitors": "A launch planned from start to finish, adverts written and tested, and a clear view of who else your customers consider.",
    "Numbers & upkeep": "What the numbers say each month, a warning when something drops, and a memory of everything done so far.",
}


def olaf_page(tools: list) -> str:
    """Olaf's product page, with its skill list built from the library itself: the groups, how many skills each has and
    their names. What a group does is said in one plain line of our own (OLAF_GROUP_LINES)."""
    lib = olaf_lib()
    n_skills = len(lib["skills"])
    def name(i):
        n = " ".join(w.capitalize() for w in i.split("-"))
        for a, b in (("Icp", "ICP"), ("Seo", "SEO"), ("Geo", "GEO"), ("Pr ", "PR "), ("Ab ", "A/B ")):
            n = n.replace(a, b)
        return n
    def group_line(label):
        return next((line for k, line in OLAF_GROUP_LINES.items() if label.endswith(k)), "")
    groups = "".join(
        f'<details class="card sk-group reveal"{" open" if k == 0 else ""}><summary><b>{e(label)}</b><small>{len(ids)} skills</small></summary>'
        f'<p class="sk-line">{e(group_line(label))}</p><p class="sk-names">'
        + "".join(f"<span>{e(name(i))}</span>" for i in ids) + "</p></details>"
        for k, (label, ids) in enumerate(lib["groups"]))
    stages = ["Know how you grow", "Be easy to find and buy", "Own your moments and assets", "Plan always-on reach", "Show up every month", "Measure and learn"]
    stage_why = ["Who buys, the moments they need you, what they know you by, your budget and hours.",
                 "Google profile, opening hours, prices, reviews, booking: often the cheapest growth there is.",
                 "Link your name to the common buying moments, and use the same colours and signs everywhere.",
                 "A small, steady presence every month beats one big burst. Reach new buyers, not only regulars.",
                 "Posts, newsletter, press and offers, written with you and checked before they go out.",
                 "New customers per month from your invoices, a brand survey now and then, and what to change."]
    feats, project_feats, faq = OLAF_FEATS, OLAF_PROJECT_FEATS, OLAF_FAQ
    # What Olaf brings, said of Olaf alone (no other way of doing it beside him).
    gives = [("Built on proven marketing science", "✓ In every answer"),
             ("Knows your business and remembers results", "✓ Your profile, plan, numbers and every piece of work"),
             ("Tells you what to do next", "✓ A 90-day plan and a weekly check-in"),
             ("Does the work", "✓ Drafts it all; you approve"),
             ("Reads your real sales numbers", "✓ From your Busy invoices"),
             ("Your data", "Stays on your computer"),
             ("Cost", f'{PRODUCTS["olaf"]["price"]} once, on your own Claude')]
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Olaf by Busy", "applicationCategory": "BusinessApplication",
                 "operatingSystem": WREN_RUNS_ON, "url": f"{SITE_URL}/business/olaf.html",
                 "description": "An AI brand consultant for small businesses: a 90-day marketing plan, project plans, a weekly check-in and the work done with you, built on proven marketing science.",
                 "offers": {"@type": "Offer", "price": PRODUCTS["olaf"]["amount"], "priceCurrency": "USD", "url": PRODUCTS["olaf"]["url"]}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    return f"""{head("Olaf, your brand consultant · Busy", "Olaf plans your marketing and your projects, checks in every week and does the work with you. Built on proven marketing science. Works on your own Claude.", "business/olaf.html", "", ld, image="og-olaf.png")}
<body class="site app-grape">
{nav("")}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--grape);right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <img class="olaf-hero-mark" src="assets/olaf-mark.svg" alt="" width="96" height="96">
        <p class="kicker">Olaf · your brand consultant · by Busy</p>
        <h1>Be the name people think of first.</h1>
        <p class="lead">Olaf is your brand consultant. He puts your brand on one page, plans your next 90 days and checks in every week. Then he prepares the work for your yes: the posts, the review requests, the reminders, the plan. Everything rests on decades of marketing science about how people really buy.</p>
        <div class="ctas">{itch_button("olaf", "Get Busy Business with Olaf", big=True)}<a class="btn btn-big" href="app/apps/olaf/index.html">👀 Try the demo</a></div>
        <p class="note">{OLAF_PRICE} · On your own Claude · Nothing is sent to us</p>
        {claude_line()}
      </div>
      <div class="stage solo reveal from-right"><div class="mock" style="--active:var(--grape)"><div class="mock-bar"><i></i><i></i><i></i><b>Olaf</b></div>
        <div class="olaf-mock">
          <p class="om-title">Stage 2 of 6: Be easy to find and buy</p>
          <div class="om-stages">{"".join(f'<span class="{c}">{x}</span>' for x, c in (("✓", "done"), ("2", "now"), ("3", ""), ("4", ""), ("5", ""), ("6", "")))}</div>
          <p class="om-h">This week · about an hour</p>
          <ul><li class="done">Add prices and photos to your Google profile</li><li>Ask five happy customers for a review</li><li>Post the two "before the weekend ride" posts</li></ul>
          <div class="om-bubble">Your review request is ready. Send it by text on Thursday, after the morning rush. 🚲</div>
        </div></div></div>
    </div>
  </section>
  {film_top("olaf", "../")}
  <section class="section"><div class="wrap">{expert_intro("olaf", "Rivet", "app/shared/places/workshop/rivet-hello.png", "business/index.html#upstairs", "", free="business/download.html", job=True, meet="")}</div></section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What Olaf does</h2><p class="lead">The free Marketing Studio gives you the playbooks. Olaf runs them with you, week after week.</p></div>
    <div class="feats">{"".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(feats))}</div>
  </div></section>
  <section class="section tint" style="--c:var(--grape)"><div class="wrap">
    <div class="center reveal"><h2 class="big">Six stages, in the order that grows a business</h2><p class="lead">Olaf works out where you are and starts there. Most businesses keep cycling through the last two.</p></div>
    <div class="steps six">{"".join(f'<div class="card step reveal" style="--c:var(--grape);transition-delay:{i * .06:.2f}s"><span class="num">{i + 1}</span><h3>{e(s)}</h3><p>{e(stage_why[i])}</p></div>' for i, s in enumerate(stages))}</div>
  </div></section>
{paths_block("", on_olaf=True)}
  <section class="section" id="projects"><div class="wrap">
    <div class="center reveal"><h2 class="big">Your projects, run with you</h2><p class="lead">The free Project Planner holds the plan. Olaf keeps it honest: it writes the plan with you, checks in every week and does the paperwork.</p></div>
    <div class="feats">{"".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(project_feats))}</div>
  </div></section>
  <section class="section" id="skills"><div class="wrap">
    <div class="center reveal"><h2 class="big">{n_skills} skills behind the coach</h2><p class="lead">Olaf picks the right one for each step. You can also run any of them yourself.</p></div>
    <div class="sk-groups">{groups}</div>
  </div></section>
  <section class="section" id="why"><div class="wrap">
    <div class="center reveal"><h2 class="big">An expert at your side</h2><p class="lead">What Olaf brings to your marketing, week after week.</p></div>
    <div class="cmp gives reveal" role="region" aria-label="What Olaf brings" tabindex="0"><table>
      <thead><tr><th></th><th>Olaf</th></tr></thead>
      <tbody>
        {"".join(f"<tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in gives)}
      </tbody></table></div>
  </div></section>
  <section class="section" id="get"><div class="wrap">
    <div class="card get-olaf reveal">
      <span class="e">🧭</span>
      <div><h2>Get Olaf</h2>
        <p>Olaf comes inside <b>{PRODUCTS["olaf"]["name"]}</b>, sold on itch.io for {PRODUCTS["olaf"]["price"]} once: an introductory price. He runs on your own Claude usage.</p>
        <ul class="get-list"><li>Olaf: the growth coach, setup, dashboard, insights and content calendar</li><li>{n_skills} skills for marketing and projects, built on proven marketing science</li><li>The full Busy toolbox in the same download</li><li>Every update, no subscription</li></ul>
        <div class="row-flex">{itch_button("olaf", big=True)}<a class="btn btn-big" href="claude-key.html">How Olaf connects to Claude</a></div>
        {claude_line()}
        <p class="faint" style="font-size:.88rem;margin-top:8px">The free Busy download never contains Olaf. The demo shows an example business; Olaf's work and the AI run only in the paid version.</p></div>
    </div>
  </div></section>
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{"".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faq)}</div>
  </div></section>
  <section class="final">
    <h2 class="reveal pop">Your marketing and your projects, with an expert.</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">Try the demo with an example business, or get Olaf and keep it all in your own folder.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px">{itch_button("olaf", "Get Busy Business with Olaf", big=True)}<a class="btn btn-big ghost-light" href="app/apps/olaf/index.html">👀 Try the demo</a></div>
    {claude_line()}
  </section>
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


# ---------- brain games: free, daily, in the browser ----------
# The puzzles themselves are made in the browser by website/assets/games/engine.js; these are the
# pages around them. Classic puzzle types under our own names, never another site's names or art.
GAME_LEVELS = 10000
GAMES = [
    {"id": "stars", "name": "Stars", "emoji": "⭐", "color": "sun", "classic": "Star Battle",
     "title": "Stars: free daily Star Battle puzzles · Busy",
     "desc": "Stars, a free Star Battle logic puzzle: one star per row, column and colour patch. A new puzzle every day and 10,000 levels. No account.",
     "h1": "Stars", "lead": "One star in every row, column and colour patch. Simple rules, real thinking.",
     "rules": ["Put one star in every row, every column and every colour patch.",
               "Stars never touch, not even corner to corner.",
               "Tap a cell once for a cross (no star can go there) and twice for a star. Drag to cross out several cells at once."],
     "about": "Stars is a one-star Star Battle, a classic logic puzzle. Every board has exactly one answer, so you can always find it by reasoning, without guessing."},
    {"id": "duo", "name": "Duo", "emoji": "🟡", "color": "grape", "classic": "Takuzu (Binairo)",
     "title": "Duo: free daily Takuzu (Binairo) puzzles · Busy",
     "desc": "Duo, a free Takuzu (Binairo) logic puzzle with suns and grapes: half and half, never three in a row. A new puzzle every day and 10,000 levels.",
     "h1": "Duo", "lead": "Suns and grapes, half and half, never three in a row.",
     "rules": ["Fill every cell with a sun (yellow circle) or a grape (purple square).",
               "Every row and every column has as many suns as grapes.",
               "Never three of the same next to each other, across or down.",
               "No two rows are the same, and no two columns.",
               "Tap a cell to go from sun to grape to empty. Grey cells are given."],
     "about": "Duo is a Takuzu, also known as Binairo or the binary puzzle, a classic logic puzzle. Every board has exactly one answer."},
    {"id": "trail", "name": "Trail", "emoji": "🧶", "color": "tomato", "classic": "a path puzzle",
     "title": "Trail: free daily path puzzles · Busy",
     "desc": "Trail, a free path puzzle: draw one line through every cell, passing the numbers in order. A new puzzle every day and 10,000 levels. No account.",
     "h1": "Trail", "lead": "One line through every cell, passing the numbers in order.",
     "rules": ["Start at 1 and draw one line through every cell of the board.",
               "Pass the numbers in order, and finish on the highest number.",
               "The line never crosses itself and never goes through a thick wall.",
               "Drag to draw. Go back over the line to undo, or tap a cell on the line to cut it there. On a keyboard, use the arrow keys."],
     "about": "Trail is a classic kind of path puzzle: one route that visits every cell exactly once. Every board has exactly one answer."},
    {"id": "six", "name": "Six", "emoji": "🎲", "color": "mint", "classic": "6 × 6 Sudoku",
     "title": "Six: free daily 6×6 Sudoku · Busy",
     "desc": "Six, a free 6×6 Sudoku: fill every row, column and box with 1 to 6. A new puzzle every day and 10,000 levels, from easy to expert. No account.",
     "h1": "Six", "lead": "Sudoku on a 6 × 6 grid: quick to start, tricky to finish.",
     "rules": ["Fill every row, every column and every 2 × 3 box with the numbers 1 to 6.",
               "Each number appears once in each row, column and box.",
               "Tap a cell, then a number below the board. On a keyboard, type 1 to 6; Backspace erases."],
     "about": "Six is Sudoku on a smaller 6 × 6 grid with 2 × 3 boxes. Every puzzle has exactly one answer."},
]
# The free apps for Mac and Windows: one per suite (and one for the games), built by the private repo's
# desktop/build-free.py and published as a GitHub release of this repository. The file names stay the
# same from release to release, so these links always give the latest.
APP_RELEASE = "https://github.com/lupitaai-agent/busywork/releases/latest/download/"
# The installers' sizes, as people read them ("96 MB"), by file name. The installers are built and released outside
# this repository, so the build knows none yet: add a file here (or fill this from the release) and the panel that
# opens after a download click shows its size.
DOWNLOAD_SIZES = {}


def app_download(word: str, name: str) -> str:
    """The download buttons for one free app, with what it runs on and how to open the beta."""
    # data-suite and data-os tell site.js which app and which system a click is for (the panel that opens after it);
    # data-size is there only for a file whose size the build knows (DOWNLOAD_SIZES).
    at = lambda system, file: f'data-download data-suite="{word.lower()}" data-os="{system}"' + (f' data-size="{e(DOWNLOAD_SIZES[file])}"' if file in DOWNLOAD_SIZES else "")
    mac, win = f"Busy-{word}-Beta-Mac.dmg", f"Busy-{word}-Beta-Windows.exe"
    return f"""<div class="row-flex" style="justify-content:center">
      <a class="btn btn-primary btn-big" href="{APP_RELEASE}{mac}" {at("mac", mac)}>⬇️ {e(name)} for Mac</a>
      <a class="btn btn-primary btn-big" href="{APP_RELEASE}{win}" {at("windows", win)}>⬇️ {e(name)} for Windows</a></div>
    <p class="faint" style="margin-top:14px">Free · Beta · Mac: macOS 13 or newer, Apple chip or Intel · Windows 10 or 11, 64-bit</p>
    <details class="first-open"><summary>Opening it the first time</summary><p>The beta isn’t signed by Apple or Microsoft yet, so your computer asks first, once.
      <b>Mac:</b> open the downloaded file, drag {e(name)} into Applications and open it. Click Done, then open System Settings → Privacy &amp; Security, scroll down and click <b>Open Anyway</b>.
      <b>Windows:</b> run the downloaded file; if Windows says it protected your PC, click <b>More info</b>, then <b>Run anyway</b>.</p></details>"""


# After a download click (site.js): the page says what happens next. Each free app's demo in the browser (for a
# phone, where an installer is of no use) and the expert that goes with it, in one line.
DOWNLOAD_DEMO = {"business": "app/index.html", "growth": "app/growth.html", "home": "app/home.html", "rentals": "app/rentals.html",
                 "games": "games/index.html", "tucks-errand": "games/tucks-errand.html"}
DOWNLOAD_EXPERT = {"business": ("olaf", "He puts your brand on one page and prepares the work."),
                   "growth": ("ivy", "She finds the words for your review, your raise and your next job."),
                   "home": ("juno", "She reads the letter and drafts the reply."),
                   "rentals": ("wren", "She reads the tenancy and drafts every letter.")}


def download_panel(prefix: str) -> str:
    """The panel site.js opens after a click on an installer (a link to APP_RELEASE): the download has started, how
    to open the file (the words of app_download's "Opening it the first time", in steps), and the suite's expert in
    one line with the line about Claude. On a phone: Busy runs on a computer, with the demo and a link to copy.
    (The phone's button says what it opens: the demo of an app, or the games themselves; tests/test_build.py keeps
    "Try it in your browser" off the site, because the browser shows the demo, not the app.)
    It waits in a <template> in every page's footer, so its words are translated with the page and its links are
    right in every folder; site.js keeps the parts for this app and this system."""
    experts = "".join(
        f'<div class="dl-expert" data-dl-expert="{suite}"><p><b>While it downloads: meet {PRODUCTS[k]["who"]}.</b> <span>{e(line)}</span> '
        f'<span class="expert-chip {k}">{PRODUCTS[k]["price"]} once</span></p><p>{claude_small()}</p>'
        f'<a class="btn" href="{prefix}{EXPERT_PAGE[k]}">Meet {PRODUCTS[k]["who"]} →</a></div>'
        for suite, (k, line) in DOWNLOAD_EXPERT.items() if k in PRODUCTS)
    demos = "".join(f'<a data-suite="{suite}" href="{prefix}{page}"></a>' for suite, page in DOWNLOAD_DEMO.items())
    return f"""<template id="dl-panel"><div class="dl-panel card" role="dialog" tabindex="-1">
  <button type="button" class="dl-close" data-dl-close aria-label="Close">✕</button>
  <div data-dl-when="computer">
    <h2>Your download has started</h2>
    <p class="dl-file" data-dl-file></p>
    <ol data-dl-os="mac"><li>Open the downloaded file and drag the app into Applications.</li><li>Open the app. The beta isn’t signed by Apple yet, so your Mac asks first, once.</li><li>Click Done, then open System Settings → Privacy &amp; Security, scroll down and click Open Anyway.</li></ol>
    <ol data-dl-os="windows"><li>Run the downloaded file.</li><li>The beta isn’t signed by Microsoft yet, so Windows asks first, once.</li><li>If Windows says it protected your PC, click More info, then Run anyway.</li></ol>
    <p class="dl-again">Nothing happening? <a data-dl-again href="#">Download it again</a></p>
    {experts}
  </div>
  <div data-dl-when="phone">
    <h2>Busy runs on a Mac or Windows computer</h2>
    <p>Try it here in your browser, or copy the link and open it on your computer.</p>
    <p class="row-flex"><a class="btn btn-primary" data-dl-demo data-dl-for="app" href="#">👀 Try the demo in your browser</a><a class="btn btn-primary" data-dl-demo data-dl-for="game" href="#">🧩 Play in your browser</a><button type="button" class="btn" data-dl-copy>🔗 Copy the link</button></p>
    <p class="dl-copied" role="status" aria-live="polite"><span data-dl-copied hidden>Link copied.</span></p>
    <span hidden data-dl-demos>{demos}</span>
  </div>
</div></template>"""


def trust_lines(prefix: str) -> str:
    """Two true lines for the homepage's "Your stuff stays yours": the free apps' code is public (public, not open
    source: the repository has no licence file), and how many releases there have been since the first, counted
    from website/content/updates.json so it stays true. The number and the date stand apart from the words, so a
    new release changes no sentence."""
    ups = site_updates()   # the same list What's new shows, so the number matches the page it opens
    first = min(u["date"] for u in ups)
    return (f'<li><span>👀</span><span><a href="https://github.com/lupitaai-agent/busywork" target="_blank" rel="noopener"><b>The code of the free apps is public on GitHub.</b></a> Anyone can read what they do.</span></li>\n'
            f'          <li><span>📅</span><span><a href="{prefix}updates.html"><b><span>{len(ups)}</span> releases since <time datetime="{first}">{date_words(first)}</time></b></a></span></li>')


GAMES_FAQ = [
    ("Is it free?", "Yes. Every puzzle and every level is free: in your browser, or in the free Busy Games app for Mac and Windows. No account."),
    ("How many levels are there?", f"{GAME_LEVELS:,} per game, from gentle small boards to expert ones, plus a new daily puzzle. Every puzzle has exactly one answer, so it can always be solved by reasoning."),
    ("Is there a new puzzle every day?", "Yes: one per game, the same for everyone, gentle on Monday and hardest at the weekend. Solve it to keep your streak going."),
    ("Where is my progress kept?", "In this browser (or the app) only: your streak, solved levels and an unfinished puzzle. Nothing is sent to us, and there is no account. Another browser or a private window starts fresh."),
]


GAMES_ANSWERS = [
    ("What is Busy Games?", f"Busy Games is four free logic puzzles, Stars, Duo, Trail and Six, with a new puzzle every day and {GAME_LEVELS:,} levels each, and the puzzle adventure Busy Street: Tuck's Errand."),
    ("Who is it for?", "Busy Games is for anyone who likes a short puzzle in a break. Every puzzle has exactly one answer and is solved by reasoning."),
    ("What does it cost?", f"Busy Games is free: every puzzle and every level, in your browser or in the free app for Mac and Windows, with no account. The full Busy Street: Tuck's Errand is {PRODUCTS['tuck']['price']} once on itch.io, and Busy Street 3D for Mac is {PRODUCTS['street3d']['price']} once."),
    ("Is there AI in Busy Games?", "No. Busy Games has no AI. The puzzles are made on your own device by fixed rules, and the daily puzzle is the same for everyone."),
    ("Where is my progress?", "Busy Games keeps your streak, your solved levels and an unfinished puzzle in your own browser or in the app. Nothing is sent to us, and there is no account."),
    ("Which languages?", "Busy Games is in English, Dutch, German, Spanish, Italian and Brazilian Portuguese."),
]


def games_hub() -> str:
    cards = """<a class="card game-card reveal pop" href="tucks-errand.html" style="--c:var(--sun)"><span class="em">✂️</span><h2>Tuck's Errand</h2><p>Our free puzzle adventure: six levels, six friends to cut loose from the Red Tape.</p><span class="go">Play Tuck's Errand →</span></a>"""
    cards += "".join(f'<a class="card game-card reveal pop" href="{g["id"]}.html" style="--c:var(--{g["color"]})"><span class="em">{g["emoji"]}</span><h2>{e(g["name"])}</h2>'
                    f'<p>{e(g["lead"])}</p><p class="status" data-status="{g["id"]}">🗓️ Today\'s puzzle is waiting<br>🏁 {GAME_LEVELS:,} levels to play</p><span class="go">Play {e(g["name"])} →</span></a>' for g in GAMES)
    questions = GAMES_ANSWERS + [qa for qa in GAMES_FAQ if qa[0] in ("How many levels are there?", "Is there a new puzzle every day?")]
    # "Busy Games in short" stands right above the questions, so the list below it holds only the ones not answered there;
    # the structured data carries them all (each is on the page, word for word).
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in questions[len(GAMES_ANSWERS):])
    ld = faq_ld(questions)
    desc = f"Free daily brain games from Busy: Stars, Duo, Trail and Six. A new logic puzzle every day and {GAME_LEVELS:,} levels each. In your browser or as an app. No account."
    extra = ld + '<link rel="stylesheet" href="../assets/games/games.css">' + PLACE_HEAD.format(first="../assets/parlour/room-kiosk-1920.jpg")
    return f"""{head("Free brain games: a new puzzle every day · Busy", desc, "games/index.html", "../", extra, image="og-games.png")}
<body class="site app-sun" data-hub>
{nav("../", explore("../"))}
<main id="main">
  {place_html("parlour", PARLOUR_STEPS, parlour_card, "The Puzzle Parlour: a tour of Busy Games", decals=PARLOUR_DECALS)}
  <div class="wrap">
  <figure class="film film-first reveal" id="film"><video controls playsinline preload="none" poster="../assets/films/busy-games.jpg" src="../assets/films/busy-games.mp4" aria-label="The brain games: a short film"></video><figcaption class="center">The four brain games in 24 seconds. Free, a new puzzle every day. <a href="../films/busy-games.html">The film on its own page →</a></figcaption></figure>
  {street_block("../", wrap=False)}
  <div class="game-cards" id="games">{cards}</div>
  <section class="section" id="get-app"><div class="center reveal"><h2 class="big">Play without a browser</h2>
    <p class="lead">Busy Games as a free app on your computer: the same puzzles, your streak kept, and it works offline.</p>
    {app_download("Games", "Busy Games")}</div></section>
  {in_short("Busy Games", GAMES_ANSWERS, wrap=False)}
  <section class="section" id="faq"><div class="center reveal"><h2 class="big">Questions</h2></div><div class="faq reveal">{faq}</div></section>
  </div>
</main>
{footer("../", json.loads(TOOLS_JSON.read_text()))}
<script src="../assets/games/engine.js"></script>
<script src="../assets/games/play.js"></script>
<script src="../assets/site.js"></script>
<script type="module" src="../assets/place.js"></script>
</body>
</html>
"""


def game_page(g: dict) -> str:
    faq_items = [(f"What is {g['name']}?", g["about"])] + GAMES_FAQ
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f'Busy {g["name"]}', "applicationCategory": "GameApplication",
                 "operatingSystem": "Any modern browser", "description": g["desc"], "url": f'{SITE_URL}/games/{g["id"]}.html',
                 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq_items]})
    rules = "".join(f"<li>{e(r)}</li>" for r in g["rules"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faq_items)
    others = "".join(f'<a class="card rel" href="{o["id"]}.html" style="--c:var(--{o["color"]})"><span class="em">{o["emoji"]}</span><b>{e(o["name"])}</b><small>{e(o["lead"])}</small></a>' for o in GAMES if o["id"] != g["id"])
    three = '<script type="importmap">{"imports":{"three":"../assets/vendor/three/build/three.module.min.js"}}</script>'
    return f"""{head(g["title"], g["desc"], f'games/{g["id"]}.html', "../", ld + '<link rel="stylesheet" href="../assets/games/games.css">' + three, image="og-games.png")}
<body class="site app-{g["color"]}" data-game="{g["id"]}">
{nav("../", explore("../"))}
<main id="main" class="game-page">
  <a class="crumbs" href="index.html">← All games</a>
  <h1>{g["emoji"]} {e(g["h1"])}</h1>
  <p class="lead">{e(g["lead"])}</p>
  <section id="play" class="play" aria-label="{e(g["name"])} puzzle"><noscript><p>The puzzles need JavaScript switched on.</p></noscript></section>
  <section class="game-rules card" style="padding:18px 22px"><h2>How to play</h2><ol>{rules}</ol></section>
  <section class="section" style="padding-bottom:0"><h2>More brain breaks</h2><div class="more-games">{others}</div></section>
  <section class="section" id="faq"><h2>Questions</h2><div class="faq">{faq}</div></section>
</main>
{footer("../", json.loads(TOOLS_JSON.read_text()))}
<script src="../assets/games/engine.js"></script>
<script src="../assets/games/play.js"></script>
<script type="module" src="../assets/games/room.js"></script>
<script src="../assets/site.js"></script>
</body>
</html>
"""


GROWTH_TOOLS = [("📚", "Library", "Files, links and notes from everything you read and learn, tagged and searchable."),
                ("🗓️", "Learning planner", "Courses, books and projects with goals, dates and hours a week."),
                ("🧠", "Skills map", "What you can do, how well, and the proof behind it."),
                ("🏆", "Wins log", "Achievements as they happen, ready for your CV and your next review."),
                ("🗂️", "Job tracker", "Paste an ad and it's on your board: the skills it asks for, the words your CV misses, who you know there, and follow-ups that don't slip."),
                ("📄", "CV and LinkedIn builder", "CVs and cover letters from your real skills and wins, a CV check, and your LinkedIn profile from the same facts."),
                ("🎤", "Interview story bank", "Your best stories, linked to the skills they prove."),
                ("🤝", "Contacts", "The people in your corner, your LinkedIn connections included, with a reminder when it's time to catch up."),
                ("🪞", "Weekly review", "Ten minutes on Friday: what moved, what was hard, what's next.")]


GROWTH_ANSWERS = [
    ("What is Busy Growth?", f"Busy Growth is a free app for Mac and Windows that keeps what you learn, what you can do and what you achieved, and turns it into a CV, a LinkedIn profile and interview stories. It has {len(GROWTH_TOOLS)} tools, and everything is saved in a folder on your own computer."),
    ("Who is it for?", "Busy Growth is for anyone with a review, a raise or a job change ahead: people in work who want their year on one page, and people applying for their next role."),
    ("What does it cost?", f"Busy Growth is free, with no account and no subscription. Ivy, the AI career coach, comes in the paid edition: Busy Growth with Ivy, {PRODUCTS['ivy']['price']} once on itch.io."),
    ("Is there AI in the free version?", "No. The free Busy Growth has no AI and sends nothing anywhere. Only Ivy, in the paid edition, uses AI: Claude, on your own Claude account."),
    ("Where is my data?", "Busy Growth saves plain files in Documents/Busy/Growth on your own computer, or in a folder you choose. Put it in Google Drive or Dropbox to sync it. Nothing is sent to us."),
    ("Which languages?", "Busy Growth is in English, Dutch, German, Spanish, Italian and Brazilian Portuguese."),
]


def growth_page(tools: list) -> str:
    feats = tool_cards(GROWTH_TOOLS, "growth", GROWTH_LIVE)
    if GROWTH_WAITLIST_ENDPOINT:
        signup = waitlist_form("growth", GROWTH_WAITLIST_ENDPOINT, "Email me when Ivy is ready. Nothing else, and I can unsubscribe any time." if GROWTH_LIVE
                               else "Email me when Busy Growth and Ivy are ready. Nothing else, and I can unsubscribe any time.",
                               "🌿 Tell me when Ivy is ready" if GROWTH_LIVE else "🌱 Tell me when it's ready", who="")
    else:
        signup = '<p class="lead">The list opens soon. Meanwhile, keep your brain busy with <a href="../games/index.html">today\'s puzzles</a>.</p>'
    ivy = f"""<section class="section" id="ivy"><div class="wrap">
    <div class="card ivy-card reveal"><img src="../assets/ivy-mark.svg" alt="" width="96" height="96">
      <div><p class="kicker">Ivy by Busy · {PRODUCTS["ivy"]["price"]} once</p><h2>Your career coach</h2>
      <p>Ivy turns what you learn into skills and wins, those into a stronger CV, and helps with every application and interview. Learn it, prove it, land it. Ivy never invents experience: every line comes with its proof.</p>
      <p class="row-flex" style="margin-top:14px">{itch_button("ivy", "Get Busy Growth with Ivy")} {'<a class="btn" href="ivy.html">Meet Ivy</a> ' if GROWTH_LIVE else ""}<a class="btn" href="../claude-key.html">How Ivy connects to Claude</a></p>
      {claude_line()}{"" if GROWTH_LIVE else film("ivy")}</div></div>
  </div></section>"""
    if not GROWTH_LIVE:
        desc = "Busy Growth, coming soon: free tools to grow your career. A library of what you learn, skills, wins, job tracker and CV builder, plus Ivy, your career coach."
        return f"""{head("Busy Growth: free tools to grow your career (soon)", desc, "growth/index.html", "../", image="og-ivy.png")}
<body class="site app-mint">
{nav("../", explore("../"))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--mint);right:-140px;top:-120px"></div>
    <div class="wrap center" style="padding:70px 16px 30px;display:block;text-align:center">
      <span class="chip chip-grey">Coming soon</span>
      <h1 class="reveal" style="margin-top:12px">Busy Growth 🌱</h1>
      <p class="lead reveal" style="max-width:680px;margin:0 auto">Free tools to grow your career: learn something, prove it, show it and land the next role. Everything in your own folder, no account, like the rest of Busy.</p>
    </div>
  </section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What's coming</h2><p class="lead">Free, the whole set.</p></div>
    <div class="feats">{feats}</div>
  </div></section>
  {ivy}
  <section class="section" id="get"><div class="wrap center">
    <h2 class="big">Want to know when it's ready?</h2>
    {signup}
  </div></section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""
    desc = (f"Know what you’re worth. Say it well. Busy Growth is a free personal growth tool for your next review, raise and job: {len(GROWTH_TOOLS)} tools for skills, wins, CVs and more. No account. "
            f"With Ivy, your career coach, {PRODUCTS['ivy']['price']} once.")
    steps = [("⬇️", "Install Busy Growth", "The free app for Mac and Windows, in beta. No account, no AI."),
             ("🌱", "Open it", "It works offline, and nothing is sent anywhere."),
             ("📁", "Your own folder", "Your library, skills, wins and CVs are saved as plain files in Documents/Busy/Growth. Move it into Google Drive or Dropbox to sync it."),
             ("💼", "Start from LinkedIn", "Download your own data from LinkedIn and Busy fills in your jobs, education, skills and certificates in minutes.")]
    how = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in steps)
    extra = PLACE_HEAD.format(first="../assets/glasshouse/room-foot-1920.jpg")
    return f"""{head("Busy Growth: know what you’re worth, and say it well", desc, "growth/index.html", "../", extra=extra + suite_ld("growth", desc) + faq_ld(GROWTH_ANSWERS), image="og-ivy.png")}
<body class="site app-mint">
{nav("../", ("⬇️ Download free", "#get"))}
<main id="main">
  {place_html("glasshouse", GLASSHOUSE_STEPS, glasshouse_card, "The Glasshouse: a tour of Busy Growth", next_label="Up a floor ↑", decals=GLASSHOUSE_DECALS,
             model="../assets/pim/pim.glb", height=1.25, expert="ivy")}
  {film_top("ivy")}
  <section class="section"><div class="wrap">{expert_intro("ivy", "Pim", "../app/shared/places/glasshouse/pim-hello.png", "#upstairs", free_line=True, job=True)}</div></section>
  <section class="section" id="tools"><div class="wrap">
    <div class="center reveal"><h2 class="big">{len(GROWTH_TOOLS)} tools that work together</h2><p class="lead">A gap in your skills becomes a plan, the plan becomes a win, the win becomes a CV line and an interview story.</p></div>
    <div class="feats">{feats}</div>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">💼</span>
      <div><p class="kicker">Works with LinkedIn, the honest way</p><h2>Your LinkedIn in, and back out</h2>
      <p>LinkedIn lets every member download their own data. Busy reads that file on your computer and fills in your career, skills, certificates and, if you like, your connections. Then the CV Builder gives your profile back: headline, About and every job as text to paste, within LinkedIn's limits, with a checklist of what recruiters look for. No password, no extension, nothing sent anywhere.</p></div></div>
  </div></section>
  {in_short("Busy Growth", GROWTH_ANSWERS)}
  <section class="section" id="get"><div class="wrap">
    <div class="center reveal"><h2 class="big">Get Busy Growth</h2><p class="lead">Free, the whole set. No account, no subscription, nothing sent to us.</p></div>
    <div class="feats">{how}</div>
    <div class="center" style="margin-top:22px">{app_download("Growth", "Busy Growth")}
      <p class="faint" style="margin-top:10px">Can’t install apps? <a href="../downloads/busy-growth.zip" download>Use the browser version (zip)</a> in Chrome or Edge.</p>
      <p class="faint" style="margin-top:10px">Want the expert too? <a class="out" href="{PRODUCTS["ivy"]["url"]}" target="_blank" rel="noopener">{PRODUCTS["ivy"]["name"]} · {PRODUCTS["ivy"]["price"]} <span aria-hidden="true">↗</span></a></p>
      {claude_line("center")}</div>
  </div></section>
  {ivy}
  {f'''<section class="section"><div class="wrap center">
    <h2 class="big">Want to know when Ivy is ready?</h2>
    {signup}
  </div></section>''' if GROWTH_WAITLIST_ENDPOINT else ""}
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
<script type="module" src="../assets/place.js"></script>
</body>
</html>
"""


HOME_TOOLS = [("🗂️", "Paper Trail", "Passports, policies, contracts and warranties in one place, searchable down to the words inside a PDF, with a nudge before anything expires."),
              ("🔁", "Contracts & Renewals", "Insurance, energy, phone, the gym: what each costs a month and the last day to cancel before it renews by itself."),
              ("🛠️", "Home Upkeep", "The boiler service, smoke alarms and gutters: when each is due, when it was done, by whom and for how much."),
              ("🛋️", "Home Inventory", "What you own, room by room, with photos, receipts and warranties. After a break-in, the claim pack is one click away."),
              ("✉️", "Letters", "Cancel, complain, claim, object or ask for your data: letters with your details, the company and the dates filled in."),
              ("🚚", "Moving Planner", "A checklist worked back from moving day, and everyone to tell, with your contracts already on the list."),
              ("📕", "Just in Case", "Everything your family would need if something happened to you: people to call, where things are, wishes. One PDF."),
              ("🧮", "Shared Costs", "Who paid what, and who owes whom: split equally, by income share or your own way, between any number of people.")]


# Tuck, the Busy Home helper, lives on the Busy Home page (assets/tuck/tuck.js, the model from the Busy Studio).
# Not an AI: these are its lines. One per tool (said when you point at it), one per part of the page, and a few
# for when you poke it. Moves: Idle, Waving, Happy, Victory.
# Tuck's house: the Busy Home page as a place (assets/place.js). Each step is a room rendered in the
# Busy Studio (Unreal Engine), with the live Tuck on top. Per step: the room it shows (plate), its title,
# what Tuck says and does when you arrive, the card's words, and what happens when you click something in
# the room ("acts": the spot's id from the studio's rooms.json, Tuck's move, his line, the result card, and
# what else happens: "next", "confetti", "beep", "show:<decal>").
# Tuck is not an AI: these are its lines. Moves: Idle, Waving, Happy, Victory, PointingGesture, Stomping,
# Typing, JoggingWithBox, Walk.
HOUSE_STEPS = [
    {"id": "door", "title": "Tuck's front door", "say": "Hi, I'm Tuck! I keep a household's paperwork in order. Knock, and I'll show you around.", "move": "Waving",
     "acts": [("door", "Happy", "Come in, come in! Mind the keys.", "", "next")]},
    {"id": "papers", "title": "Hallway · Paper Trail", "tool": "papers", "kicker": "Paper Trail", "h": "Never miss an expiry date again",
     "p": "Passports, policies, contracts and warranties in one place, searchable down to the words inside a PDF, with a nudge before anything expires.",
     "task": "Tap the passport on the drawers.", "say": "The hallway. Passports, policies, warranties: I keep them all, and I can find any of them.",
     "acts": [("passport", "PointingGesture", "This passport expires in four months. I'll nudge you now, so there's time to renew.",
               "<b>🗂️ Passport</b><span>Expires in 4 months</span><span>⏰ Reminder set: today, with time to renew</span>", "")]},
    {"id": "contracts", "title": "Kitchen · Contracts & Renewals", "tool": "contracts", "kicker": "Contracts & Renewals", "h": "The last day to cancel, before it renews",
     "p": "Insurance, energy, phone, the gym: what each costs a month and the last day to cancel before it renews by itself.",
     "task": "Tap the contract on the fridge.", "say": "The kitchen. That gym contract on the fridge renews by itself next month…",
     "acts": [("contract", "PointingGesture", "Gym: €34.95 a month. The last day to cancel is in 12 days. Shall we?",
               "<b>🔁 Fit Utrecht</b><span>€34.95 a month · renews by itself in 1 month</span><span><b>Last day to cancel: in 12 days</b></span>"
               "<button type=\"button\" class=\"btn btn-primary\" data-house-do=\"stamp\">✂️ Stamp it: cancel in time</button>", ""),
              ("stamp", "Victory", "Cancelled in time! It stops instead of renewing for another year. That's what I live for.",
               "<b>✅ Cancelled in time</b><span>Saves €419 a year</span><span>✉️ The cancellation letter is ready in Letters</span>", "confetti")]},
    {"id": "upkeep", "title": "Boiler cupboard · Home Upkeep", "tool": "upkeep", "kicker": "Home Upkeep", "h": "Every job around the house, on time",
     "p": "The boiler service, smoke alarms and gutters: when each is due, when it was done, by whom and for how much.",
     "task": "Tap the smoke alarm, or the boiler.", "say": "The boiler cupboard. Smoke alarms, the boiler, the gutters: I keep the dates.",
     "acts": [("smoke_alarm", "Happy", "Beep! It works. The next test is in six months; it's on the list.",
               "<b>🛠️ Smoke alarm</b><span>Tested today</span><span>Next test: in 6 months</span>", "beep"),
              ("boiler", "PointingGesture", "The boiler service is due in three weeks. I'll remind you before the cold comes.",
               "<b>🔥 Boiler service</b><span>Due in 3 weeks</span><span>Last time: Warm &amp; Co, €95</span>", "")]},
    {"id": "inventory", "title": "Living room · Home Inventory", "tool": "inventory", "kicker": "Home Inventory", "h": "What you own, ready for a claim",
     "p": "What you own, room by room, with photos, receipts and warranties. After a break-in, the claim pack is one click away.",
     "task": "Tap the TV, then the sofa.", "say": "The living room. If something ever happens, you'll want to know what was here.",
     "acts": [("tv", "PointingGesture", "TV: bought in 2024 for €449. Photo and receipt saved.",
               "<b>📺 Television</b><span>€449 · bought 2024 · receipt ✓</span>", ""),
              ("sofa", "Happy", "Sofa: €899. After a break-in, the claim pack is one click.",
               "<b>🛋️ Sofa</b><span>€899 · bought 2023 · receipt ✓</span><span><b>Claim pack: 2 items, €1,348</b> · one PDF</span>", "")]},
    {"id": "letters", "title": "Study · Letters", "tool": "letters", "kicker": "Letters", "h": "The letter writes itself",
     "p": "Cancel, complain, claim, object or ask for your data: letters with your details, the company and the dates filled in.",
     "task": "Tap the laptop.", "say": "My study. Cancel, complain, claim: the letter writes itself.",
     "acts": [("laptop", "Typing", "Your details, the company, the dates: all filled in. You just sign.",
               "<b>✉️ Cancellation</b><span data-type>Dear Fit Utrecht, I hereby cancel my membership (no. 2187) as of the end of the current term, 30 November. Please confirm in writing. Kind regards, Sam de Boer</span>", "")]},
    {"id": "moving", "title": "Attic · Moving Planner", "tool": "moving", "kicker": "Moving Planner", "h": "Moving day, worked back",
     "p": "A checklist worked back from moving day, and everyone to tell, with your contracts already on the list.",
     "task": "Tap the boxes.", "say": "The attic. Moving house? I count back from moving day.",
     "acts": [("boxes", "JoggingWithBox", "Eight weeks to go. Everyone to tell is on the list already, your contracts too.",
               "<b>🚚 Moving day: in 8 weeks</b><ul class=\"house-ticks\"><li data-tick>Give notice on the rent</li><li data-tick>Tell the energy company, internet and gym</li><li data-tick>Book the van</li><li data-tick>Forward the post</li></ul>", "")]},
    {"id": "binder", "title": "Safe corner · Just in Case", "tool": "binder", "kicker": "Just in Case", "h": "What your family would need",
     "p": "Everything your family would need if something happened to you: people to call, where things are, wishes. One PDF.",
     "task": "Tap the safe.", "say": "The safe corner. The binder your family would need if something happened to you.",
     "acts": [("safe", "Victory", "People to call, where everything is, your wishes: one PDF. Important stuff.",
               "<b>📕 Just in Case</b><span>6 people · 14 documents · wishes</span><span>One PDF for the family</span>", "confetti")]},
    {"id": "upstairs", "plate": "juno", "title": "Upstairs · Juno", "expert": "juno",
     "h": "Juno reads the letter and writes the reply", "task": "Tap the letter on Juno's desk.",
     "p": "Upstairs, in the gable, works Juno: Busy Home's household assistant. She explains a letter in plain words, says what to do by when, and writes the reply, from your own Busy Home files.",
     "say": "Hello, I'm Juno. Tuck keeps the paperwork in order; I read the letters. Hand me one.", "move": "Waving",
     "acts": [("desk", "Thinking>Writing>Nodding", "An energy bill with a higher monthly amount. Here's what it says, and your reply.",
               "<b>📬 The energy bill, explained</b><span>Your monthly payment goes from €118 to €142 from 1 December.</span>"
               "<span>⏰ Send a meter reading before 14 November: the new amount may be too high.</span>"
               "<span class=\"faint\">An example. Juno works from your own letters, on your own Claude.</span>", "")]},
    {"id": "home", "plate": "door", "title": "Take Tuck home", "say": "That's the tour! Take me home: I'm free, for Mac and Windows.", "move": "Waving", "acts": []},
]


EXPERTS = {  # the paid AI experts upstairs: their room and model (busy-studio), size next to Tuck, page and price
    "olaf": {"name": "Olaf", "size": 1.45, "page": "olaf.html", "price": lambda: PRODUCTS["olaf"]["price"] + " once"},
    "ivy": {"name": "Ivy", "size": 1.28, "page": "ivy.html", "price": lambda: PRODUCTS["ivy"]["price"] + " once"},
    "juno": {"name": "Juno", "size": 1.05, "page": "juno.html", "price": lambda: PRODUCTS["juno"]["price"] + " once"},
    "wren": {"name": "Wren", "size": 1.0, "page": "wren.html", "price": lambda: WREN["price"] + " once"},
    "sal": {"name": "Sal", "size": 1.0, "page": "sal.html", "price": lambda: SAL["price"] + " once"},
}


FREE_AND_PAID = "Free: the boring part made easy, with no account and no AI. Paid: the boring part done for you by an expert, for a few dollars, once. That is what keeps Busy going."


# "One job, done": one worked example per expert, shown where the price and the buy button are (the expert's own page
# and the suite's page). Left, what the person hands over; right, what the expert hands back, with the numbers and
# dates of the example, ending in what waits for the person's yes. Every example is a job that expert's skills and
# tools really do (checked against the private repo, 20 November 2026), with pretend people, and says so underneath.
# No word about speed or results.
ONE_JOB = {
    "olaf": {"pretend": "An example with a pretend business.",
             "give_h": "One line about your business",
             "give": ["“Studio Noor paints signs and lettering for cafés and shops in Utrecht.”"],
             "back_h": "Your brand on one page",
             "back": ["After a few questions, eight at most: what you sell and to whom, in your customers' own words.",
                      "The moments people need you, with the three or four to be known for: a café about to open, a shop front that looks tired.",
                      "What makes you recognisable, to use every time: the tomato red and the hand-painted letters.",
                      "The first three things to do, each with its time: opening hours, prices and six photos on your Google listing, 40 minutes; ask your last five clients for a review, 20 minutes; two short posts about the new sign, 15 minutes."],
             "yes": "The page saved in your own folder, and the three jobs in this week's plan."},
    "ivy": {"pretend": "An example with a pretend person.",
            "give_h": "A job advert and three wins",
            "give": ["The advert: Data analyst at Northwind.",
                     "Your wins: the weekly ticket report cut from 3 hours to 20 minutes; four colleagues trained on the new support dashboard; the first-reply time brought down to under 2 hours."],
            "back_h": "Where you stand, and a CV for this job",
            "back": ["What the advert asks for, must-haves first, each next to your proof: SQL and Excel are shown by the report you cut from 3 hours to 20 minutes.",
                     "What is missing, said plainly: Power BI. With a first step for your Learning Planner.",
                     "A CV for Northwind that leads with your three wins, in the advert's own words where they honestly mean the same.",
                     "The gaps to be ready to talk about in the interview."],
            "yes": "The CV saved in your CV Builder as “CV for Northwind”, linked to the application in your Job Tracker."},
    "juno": {"pretend": "An example with a pretend household.",
             "give_h": "A letter from the energy company",
             "give": ["“From 1 December your monthly payment changes from €118 to €142.”", "Two pages, with small print on the back."],
             "back_h": "The letter explained, and the reply ready",
             "back": ["In plain words: your monthly payment goes from €118 to €142 from 1 December. That is €24 a month more, €288 a year.",
                      "What to do, by when: send your meter reading before 14 November, so the new amount rests on what you really use.",
                      "What your contract says about a change of price, quoted from the contract itself.",
                      "A short reply with your meter reading, drafted in Letters."],
             "yes": "The letter filed in Paper Trail with 14 November as its date, €142 on the contract in Contracts & Renewals, and the reply saved in Letters."},
    "wren": {"pretend": "An example with a pretend landlord.",
             "give_h": "A tenancy agreement",
             "give": ["“The rent is £1,150 per calendar month, payable in advance on the 1st. The deposit is £1,300.”", "Eleven pages, as a PDF: a flat in England, let from 1 March."],
             "back_h": "The tenancy filled in, and the deposit checked",
             "back": ["Filled in from the agreement, each with its place in the document: the tenants, the start on 1 March, the rent of £1,150 a month due on the 1st, and the deposit of £1,300.",
                      "The deposit next to England's cap of five weeks' rent: £1,326.92. Your £1,300 is within it.",
                      "The date to protect the deposit by: 31 March, 30 days after you received it on 1 March.",
                      "What the agreement says about notice, pets and access, in its own words, listed as clauses worth checking with a solicitor or your landlords' association."],
             "yes": "The home and the tenancy saved in Busy Rentals."},
    "sal": {"pretend": "An example with a pretend kitchen.",
            "give_h": "What is in the fridge",
            "give": ["“Half a bag of curly kale, use by tomorrow. A smoked sausage, bacon and four eggs. Potatoes, an onion, milk, butter and mustard in the cupboard. Dinner for two.”"],
            "back_h": "Dinner for tonight, from what you have",
            "back": ["First, because the kale goes off tomorrow: boerenkoolstamppot met rookworst, kale and potato mash with smoked sausage, from the Dutch kitchen. Nothing is missing.",
                     "Second: tortilla de patatas, the Spanish potato omelette, from the potatoes, the eggs and the onion.",
                     "The recipe you choose, scaled from four portions to two: 750 g of potatoes and 250 g of kale for the stamppot.",
                     "Its allergens, milk and mustard, with the reminder to check the labels, and the line “not yet cooked by us”."],
            "yes": "The stamppot in tonight's week plan. The kale and the sausage leave your pantry once you say they are used up."},
}


def one_job(key: str, buy: str = "") -> str:
    """The two cards of an expert's worked example. buy: what stands under them (the buy button and the Claude line on
    the expert's own page; on a suite page the two doors follow, so nothing here)."""
    j, who = ONE_JOB[key], PRODUCTS[key]["who"]
    paper = "".join(f"<p>{e(line)}</p>" for line in j["give"])
    back = "".join(f"<li>{e(line)}</li>" for line in j["back"])
    return f"""<div class="one-job" id="one-job">
      <div class="center reveal"><p class="kicker">{who} at work</p><h2 class="big">One job, done</h2></div>
      <div class="job-cards">
        <article class="card job-card job-in reveal"><p class="job-tag">You hand over</p><h3>{e(j["give_h"])}</h3><div class="job-paper">{paper}</div></article>
        <article class="card job-card job-out reveal"><p class="job-tag">{who} hands back</p><h3>{e(j["back_h"])}</h3><ul class="job-list">{back}</ul>
          <p class="job-yes"><b>Waiting for your yes</b> <span>{e(j["yes"])}</span></p></article>
      </div>
      <p class="center faint job-note">{e(j["pretend"])}</p>{buy}
    </div>"""


# The suite's film, right under the hero: one line on what you will see and how long it is.
FILM_CAPTIONS = {"olaf": "30 seconds: what needs you today in Busy Business, and what Olaf has ready for your yes.",
                 "ivy": "30 seconds: your worth on one page in Busy Growth, and the words Ivy has ready for your review.",
                 "juno": "30 seconds: ten minutes with Busy Home, and the letter Juno has ready for your yes.",
                 "wren": "88 seconds: the homes, the rent, the landlord's year and the letters in Busy Rentals, and Wren, your property manager.",
                 "sal": "30 seconds: tell Busy Kitchen what is in your fridge, see what's for dinner, and plan the week."}


def film_top(key: str, prefix: str = "../") -> str:
    """A suite's film where the decision is made: under the hero of its suite page and on its expert's page."""
    name = PRODUCTS[key]["film"]
    if not any((base / "assets" / "films" / f"{name}.mp4").exists() for base in (ROOT / "website", RENTALS_SITE, KITCHEN_SITE)):
        return ""
    return (f'<section class="section film-top" id="film"><div class="wrap"><figure class="film reveal">{film_video(key, prefix)}'
            f'<figcaption>{e(FILM_CAPTIONS[key])} <a href="{prefix}films/{name}.html">The film on its own page →</a></figcaption></figure></div></section>')


def expert_intro(expert: str, guide: str, guide_pic: str, tour: str, prefix: str = "../", free_line: bool = False, free: str = "#get",
                 job: bool = False, meet: str = None) -> str:
    """An expert on their page: in their room upstairs (rendered in the Busy Studio), a way to watch them at work in
    the tour's last room, and the guide next to them: the guide is free and scripted, the expert is paid AI. job: the
    expert's worked example between the picture and the two doors, so the price stands next to a finished job.
    meet: the expert's own page, a third and quieter door ("" where this is that page)."""
    x = EXPERTS[expert]
    meet = x["page"] if meet is None else meet
    return f"""<div class="expert-intro reveal">
      <figure class="expert-pic"><img src="{prefix}assets/experts/{expert}-card.jpg" alt="{x["name"]} in the room upstairs, rendered in the Busy Studio" loading="lazy" width="1200" height="675">
        <a class="btn btn-primary" href="{tour}">👀 See {x["name"]} at work</a></figure>
      <div class="expert-duo">
        <div class="card"><img src="{guide_pic}" alt="" loading="lazy"><div><b>{guide} · free</b><small>Your guide downstairs: shows you every tool. Scripted, no AI.</small></div></div>
        <div class="card"><img src="{prefix}assets/experts/{expert}-hello.png" alt="" loading="lazy"><div><b>{x["name"]}</b><small>The expert upstairs, on your own Claude. {e(x["price"]())}.</small></div></div>
      </div>
    </div>{one_job(expert) if job else ""}
    <p class="two-doors reveal"><a class="btn btn-big" href="{free}">⬇️ Download free</a>{itch_button(expert, "Get it with " + x["name"], big=True)}{f'<a class="btn btn-big" href="{meet}">Meet {x["name"]}</a>' if meet else ""}</p>
    {claude_line("center")}{f'<p class="center lead reveal" style="margin-top:26px">{FREE_AND_PAID}</p>' if free_line else ""}"""


# ---------- what is for sale, shown the same way everywhere ----------
def film_video(key: str, prefix: str) -> str:
    x = PRODUCTS[key]
    return (f'<video controls playsinline preload="none" poster="{prefix}assets/films/{x["film"]}.jpg" src="{prefix}assets/films/{x["film"]}.mp4" '
            f'aria-label="{e(x["name"])}: a short film"></video>')


def films_block(prefix: str) -> str:
    """The home page's films: the apps at work, each with its two doors (free, and with its expert) and, under the
    expert's door, the one line about Claude. Busy Kitchen's free door opens it in the browser: it has no installer."""
    get = "⬇️ Download free"
    rows = (("olaf", "business/download.html", get, "Be the name people think of first: your brand, your marketing and your daily operations in one place."),
            ("ivy", "growth/index.html#get", get, "Know what you’re worth, and say it well: at your review, for your raise and for your next job."),
            ("juno", "home/index.html#get", get, "Get your evenings back: the contracts, the letters and the dates, taken care of."),
            *([("wren", "rentals/index.html#get", get, "Be the landlord people hope for: every date, deposit and letter, in order.")] if RENTALS_LIVE and (SITE / "assets" / "films" / "busy-rentals.mp4").exists() else []),
            *([("sal", "app/kitchen.html", "🍳 Open it in your browser", f"Bring the world to your table: {KITCHEN_DISHES} dishes from six kitchens, matched to what is in your fridge.")] if KITCHEN_LIVE and (SITE / "assets" / "films" / "busy-kitchen.mp4").exists() else []))
    cards = "".join(f'<article class="card film-card reveal pop">{film_video(k, prefix)}<h3>{e(PRODUCTS[k]["suite"])}</h3><p>{e(line)}</p>'
                    f'<div class="row-flex"><a class="btn" href="{prefix}{free}">{label}</a>{itch_button(k, "With " + PRODUCTS[k]["who"])}</div>{claude_small("in-film")}</article>' for k, free, label, line in rows)
    return f"""<section class="section film-band" id="films"><div class="wrap">
    <div class="center reveal"><h2 class="big">See Busy at work</h2><p class="lead">{"A short film each." if RENTALS_LIVE else "Half a minute each."} Every app is free. Its expert does the work for you, for a few dollars, once.</p></div>
    <div class="film-row">{cards}</div>
    <p class="center film-note">{claude_small()}</p>
  </div></section>"""


def offer_rows(tools: list, prefix: str) -> str:
    rows = [("💼 Busy Business", f"{len(tools)} tools: you build your brand with the method", "Olaf, your brand consultant, builds it with you and checks in every week", "olaf"),
            ("🌱 Busy Growth", f"{len(GROWTH_TOOLS)} tools: you keep the record and write from it", "Ivy, your career coach, writes it for you", "ivy"),
            ("🏡 Busy Home", f"{len(HOME_TOOLS)} tools: you add it once and are told in time", "Juno, your household assistant, reads it, files it and answers it", "juno"),
            *([("🔑 Busy Rentals", f"{len(RENTALS_TOOLS)} tools: every date, deposit, payment and receipt in order", "Wren, your property manager, reads the tenancy and drafts every letter", "wren")] if RENTALS_LIVE else []),
            *([("🍳 Busy Kitchen", f"{KITCHEN_DISHES} dishes: you cook from what is in your fridge", "Sal, your chef, cooks with what is left and plans your week", "sal")] if KITCHEN_LIVE else []),
            ("✂️ Busy Street: Tuck's Errand", "Six levels, in your browser or as a download", "All 15 levels: the street and nine worlds", "tuck"),
            ("🏙️ Busy Street 3D", "", "23 levels in 3D, for Mac with Apple silicon", "street3d"),
            ("🧩 Brain games", "Stars, Duo, Trail and Six: a new puzzle every day", "", "")]
    # data-label: on a phone each row is a card of its own (site.css), and the column's name stands above its words.
    cell = lambda label, text: f'<td data-label="{label}">{e(text)}</td>' if text else '<td class="none">–</td>'
    live = experts_live()
    return "".join(f'<tr><td><b>{e(a)}</b></td>{cell("Free", b)}{cell("Paid, once", c)}'
                   f'<td>{(itch_button(k, "itch.io", primary=False) + (claude_small("in-card") if k in live else "")) if k else "Free"}</td></tr>' for a, b, c, k in rows)


def offer_block(tools: list, prefix: str) -> str:
    """The home page's small table: what is free, what the paid edition adds, what it costs."""
    return f"""<section class="section" id="offer"><div class="wrap">
    <div class="center reveal"><h2 class="big">Free, or with an expert</h2><p class="lead">{FREE_AND_PAID}</p></div>
    <div class="cmp offer reveal" role="region" aria-label="Free and paid editions" tabindex="0"><table>
      <thead><tr><th></th><th>Free</th><th>Paid, once</th><th></th></tr></thead><tbody>{offer_rows(tools, prefix)}</tbody></table></div>
    <p class="offer-note">{claude_small()}</p>
    <p class="center" style="margin-top:18px"><a class="btn" href="{prefix}pricing.html">How free and paid work →</a></p>
  </div></section>"""


WRONG_YEAR = (("istanbul", "Istanbul, 1555"), ("amsterdam", "Amsterdam, 1637"), ("hanyang", "Hanyang, 1795"), ("deadwood", "Deadwood, 1876"), ("paris", "Paris, 1889"),
              ("london", "London, 1908"), ("newyork", "New York, 1931"), ("berlin", "Berlin, 1989"), ("tokyo", "Tokyo, today"))   # the game's next nine levels: a picture each, from the game


def street_block(prefix: str, wrap: bool = True) -> str:
    """Busy Street, the game: free to try, cheap to own. On the home page and at the top of Busy Games."""
    inner = f"""<div class="center reveal"><h2 class="big">Busy Street, the game</h2><p class="lead">The Red Tape has crept over Busy Street, and Tuck only went out to get a stamp back. Play six levels free. Then go on: nine worlds in 2D, and the whole street in 3D.</p></div>
    <div class="film-row two">
      <article class="card film-card reveal pop">{film_video("tuck", prefix)}<h3>Busy Street: Tuck's Errand</h3><p>A puzzle platformer. Six levels are free; the full game has 15, in six languages, for Mac and Windows.</p>
        <div class="row-flex"><a class="btn" href="{prefix}games/tucks-errand.html">▶ Play six levels free</a>{itch_button("tuck", "The full game")}</div></article>
      <article class="card film-card reveal pop">{film_video("street3d", prefix)}<h3>Busy Street 3D</h3><p>A puzzle adventure: 23 levels and eight worlds, in six languages. For Mac with Apple silicon. Next: music, and nine cities.</p>
        <div class="row-flex">{itch_button("street3d", "Get it")}</div></article>
    </div>
    <div class="center reveal wrong-year"><p class="kicker">Coming next, in 2D and in 3D</p><h3 class="big">The Wrong Year</h3>
      <p class="lead">The stamp came down on the wrong date, nine times. Nine cities to put right, from Istanbul in 1555 to Tokyo today, each with its own music.</p></div>
    <div class="city-row reveal">{"".join(f'<figure><img src="{prefix}assets/films/wrong-year/{c}.jpg" alt="{e(n)}" loading="lazy" width="640" height="360"><figcaption>{e(n)}</figcaption></figure>' for c, n in WRONG_YEAR)}</div>"""
    return f'<section class="section" id="busy-street">{"<div class=wrap>" if wrap else ""}{inner}{"</div>" if wrap else ""}</section>'


def sync_home_prices() -> None:
    """The hand-written home page names the experts' prices in six places: the build writes them from PRODUCTS."""
    page = SITE / "index.html"
    text = page.read_text()
    low = min(float(PRODUCTS[k]["amount"]) for k in ("olaf", "ivy", "juno"))
    for k in ("olaf", "ivy", "juno"):
        who, price = PRODUCTS[k]["who"], PRODUCTS[k]["price"]
        text, n1 = re.subn(rf'(<span class="expert-chip {k}"><img [^>]*>)[^<]*</span>', rf"\g<1>With {who} · {price}</span>", text)
        text, n2 = re.subn(rf'(<span class="expert-chip {k}">)(?!<img)[^<]*</span>', rf'\g<1>{PRODUCTS[k]["name"]} · {price}</span>', text)
        if not (n1 and n2):
            raise SystemExit(f"website/index.html lost {who}'s price chips")
    page.write_text(text)


# Where each expert sits, in a sentence: "Olaf in Busy Business, Ivy in Busy Growth, …"
EXPERTS_IN = ", ".join(f'{PRODUCTS[k]["who"]} in {PRODUCTS[k]["suite"]}' for k in experts_live())
PRICING_FAQ = [
    ("Do the free tools stay free?", "Yes. Every tool in every suite is free, with no account, no trial and no time limit. They have no AI in them."),
    ("What exactly do I buy?", f"The same app with its AI expert inside: {EXPERTS_IN}. You pay once and keep it. Updates are free."),
    ("How does the expert run?", "The expert is Claude, made by Anthropic, and works on your own Claude: the Claude app with a paid plan, or a Claude API key. If you already pay for Claude, the expert's price is all you pay: you add the expert to your Claude app in three steps. With an API key you pay Anthropic for what you use, a few cents a conversation. The expert prepares the work; you say yes in Busy. The free app is complete on its own."),
    ("Why itch.io?", "itch.io takes the payment and hands you the download, so we never see your card. The buttons on this site open the product's own page there in a new tab."),
    ("Are these the final prices?", "They are introductory prices. If they change, people who already bought keep what they have."),
    ("Which languages?", "English, Dutch, German, Spanish, Italian and Brazilian Portuguese: the apps, the experts' own screens and both games."),
    ("Mac or Windows?", "The apps and Tuck's Errand run on Mac and Windows" + ("; the free Busy Kitchen opens in your browser" if KITCHEN_LIVE else "") + ". Busy Street 3D is for Mac with Apple silicon. The apps are not signed yet, so your computer warns you the first time you open one."),
]

# "Which one first?": one line per expert, starting from where the visitor is, most to gain first.
WHICH_FIRST = [("olaf", "You run a business or work freelance: start with Olaf. He puts your brand on one page and prepares the work for your yes."),
               ("wren", "You let a home or a few: start with Wren. She reads the tenancy and drafts every letter."),
               ("ivy", "A review or a job hunt is ahead: start with Ivy. She finds the words from your own record."),
               ("juno", "A pile of post is waiting: start with Juno. She reads the letter and drafts the reply."),
               ("sal", "Dinner needs deciding: start with Sal. He cooks with what is left in your fridge.")]
INTRO_PRICES = "Introductory prices. If they change, people who already bought keep what they have."


def which_first(prefix: str) -> str:
    rows = "".join(f'<li><a class="card which-row {k}" href="{prefix}{EXPERT_PAGE[k]}"><span class="which-line">{e(line)}</span>'
                   f'<span class="expert-chip {k}">{PRODUCTS[k]["price"]}</span><span class="which-go" aria-hidden="true">→</span></a></li>'
                   for k, line in WHICH_FIRST if k in PRODUCTS)
    return f"""<section class="section which" id="which"><div class="wrap">
    <div class="center reveal"><h2 class="big">Which one first?</h2></div>
    <ul class="which-list reveal">{rows}</ul>
  </div></section>"""


def pricing_page(tools: list) -> str:
    """Free and paid: the one page that explains what is free, what is paid, what it costs and where to buy it."""
    desc = "What Busy costs: the tools are free and stay free. Each suite also comes with an AI expert, paid once on itch.io. Prices, what you get and how the expert runs on your own Claude."
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in PRICING_FAQ)
    ld = jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                 "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in PRICING_FAQ]})
    live = experts_live()
    suites = [PRODUCTS[k]["suite"] for k in live]
    every_tool = "Every tool in " + ", ".join(suites[:-1]) + " and " + suites[-1]
    # the free doors: an installer's page for each app; Busy Kitchen opens in the browser
    doors = {"olaf": ("business/download.html", "⬇️ Business"), "ivy": ("growth/index.html#get", "⬇️ Growth"), "juno": ("home/index.html#get", "⬇️ Home"),
             "wren": ("rentals/index.html#get", "⬇️ Rentals"), "sal": ("kitchen/index.html#get", "🍳 Kitchen")}
    does = {"olaf": "<b>Olaf</b>, your brand consultant, builds your brand with you and prepares the work",
            "ivy": "<b>Ivy</b>, your career coach, finds the words for your review, your raise and your next job",
            "juno": "<b>Juno</b>, your household assistant, reads the letter, files it and drafts the reply",
            "wren": "<b>Wren</b>, your property manager, reads the tenancy, keeps the landlord’s year and drafts every letter",
            "sal": "<b>Sal</b>, your chef, cooks with what is left and plans your week"}
    buy = {"olaf": "Business with Olaf", "ivy": "Growth with Ivy", "juno": "Home with Juno", "wren": "Rentals with Wren", "sal": "Kitchen with Sal"}
    return f"""{head("Free and paid: what Busy costs", desc, "pricing.html", "", ld)}
<body class="site app-sun">
{nav("", explore(""))}
<main id="main">
  <section class="section pricing-top"><div class="wrap">
    <div class="center reveal"><p class="kicker">Free and paid</p><h1 class="big">Every app is free. Its expert costs a few dollars, once.</h1>
      <p class="lead">Free, you do the work with good tools. Paid, the expert prepares the work and you say yes.</p></div>
    <div class="cmp offer reveal" role="region" aria-label="Free and paid editions" tabindex="0" style="margin-top:28px"><table>
      <thead><tr><th></th><th>Free</th><th>Paid, once</th><th></th></tr></thead><tbody>{offer_rows(tools, "")}</tbody></table></div>
    <p class="offer-note">{claude_small()}<small>{INTRO_PRICES}</small><small>Prices in US dollars, charged by itch.io.</small></p>
  </div></section>
  {which_first("")}
  <section class="section"><div class="wrap">
    <div class="paths">
      <article class="card path reveal pop"><span class="chip chip-mint">Free</span><span class="e">🧰</span><h3>The tools</h3>
        <ul><li>{every_tool}</li><li>The four daily brain games, and six levels of Tuck's Errand</li><li>No account, no AI, no trial: free forever</li><li>Everything is saved in a folder on your own computer</li></ul>
        <p class="price"><b>Free</b> <small>forever</small></p>
        <div class="row-flex">{"".join(f'<a class="btn btn-big" href="{doors[k][0]}">{doors[k][1]}</a>' for k in live)}</div></article>
      <article class="card path featured reveal pop" style="transition-delay:.1s"><span class="chip chip-sun">Most help</span><span class="e">🧭</span><h3>The same app, with its expert</h3>
        <ul>{"".join(f"<li>{does[k]}</li>" for k in live)}<li>Paid once on itch.io; updates are free</li></ul>
        <p class="price"><b>From {PRODUCTS["ivy"]["price"]}</b> <small>once</small></p>
        <div class="row-flex">{"".join(itch_button(k, buy[k]) for k in live)}</div>
        <p class="fine">{claude_small()} <span>{INTRO_PRICES}</span></p>
        <p class="fine">If you already pay for Claude, the expert's price is all you pay. With an API key you pay Anthropic for what you use. The free app is complete on its own. <a href="claude-key.html">How the expert connects to your Claude →</a></p></article>
    </div>
  </div></section>
  {street_block("")}
  <section class="section" id="faq"><div class="wrap"><div class="center reveal"><h2 class="big">Questions</h2></div><div class="faq reveal">{faq}</div></div></section>
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


def hero_doors(free: str, demo: str, tour: str, expert: str) -> str:
    """The doors of a suite's hero, the way Busy Rentals has them: the free download first, the demo in the browser,
    then the tour as the third and quieter one, and one line with what the app is and what its expert costs. On a phone
    the demo comes first (site.css), with a line that Busy itself is for a computer."""
    x = PRODUCTS[expert]
    title = x["adds"].split(", ", 1)[1]  # "your brand consultant"
    return (f'<div class="row-flex hero-doors"><a class="btn btn-primary" href="{free}">⬇️ Download free</a>'
            f'<a class="btn hero-demo" href="{demo}">👀 Try the demo in your browser</a>{tour}</div>'
            f'<p class="hero-note">Free app for Mac and Windows · No AI · With <a href="{EXPERTS[expert]["page"]}">{x["who"]}</a>, {title}: {x["price"]} once</p>'
            '<p class="phone-note">Busy runs on a Mac or Windows computer. On your phone, try the demo.</p>')


def expert_card(s: dict) -> str:
    """The last room of a tour: upstairs, the paid expert at work (scripted here: no AI on the website)."""
    x = EXPERTS[s["expert"]]
    return (f'<span class="chip chip-grape">AI expert · {e(x["price"]())}</span><h2>{e(s["h"])}</h2><p>{e(s["p"])}</p>'
            f'<p class="house-task">👉 {e(s["task"])}</p><div class="house-result" data-result hidden></div>'
            f'<p class="house-try"><a href="{x["page"]}">Meet {x["name"]} →</a></p>')


def house_card(s: dict) -> str:
    """The words of one room, shown in the card next to it."""
    if s.get("expert"):
        return expert_card(s)
    if s["id"] == "door":
        return ('<span class="chip chip-tomato">Free · no account · Mac and Windows</span><p class="kicker">Busy Home</p><h1>Get your evenings back.</h1>'
                '<p>More time with the people you love. Busy Home takes care of the boring part: the contracts, the renewals, the letters and the upkeep. '
                'Free, in your own folder. Tuck shows you around.</p>'
                + hero_doors("#get", "../app/home.html", '<button type="button" class="btn btn-quiet" data-house-do="door">🚪 Knock to come in</button>', "juno")
                + '<div class="house-result" data-result hidden></div>')
    if s["id"] == "home":
        return (f'<p class="kicker">The end of the tour</p><h2>Take Tuck home</h2><p>All {len(HOME_TOOLS)} tools, free. No account, no subscription, nothing sent to us.</p>'
                f'{app_download("Home", "Busy Home")}<p class="faint"><a href="juno.html">Want help with the scary letters? Meet Juno →</a></p>')
    return (f'<p class="kicker">{e(s["kicker"])}</p><h2>{e(s["h"])}</h2><p>{e(s["p"])}</p><p class="house-task">👉 {e(s["task"])}</p>'
            f'<div class="house-result" data-result hidden></div>'
            f'<p class="house-try"><a href="../app/apps/{s["tool"]}/index.html">Try {e(s["kicker"])} for real →</a></p>')


# What a page with a place needs in its head: three.js for the live guide (once it has one) and the first room early.
PLACE_HEAD = ('<script type="importmap">{{"imports":{{"three":"../assets/vendor/three/build/three.module.min.js"}}}}</script>'
              '<link rel="preload" href="{first}" as="image">')


# The places' intro films (busy-studio render_loops.sh + loops_web.py): assets/<place>/loop-<time>[-<lang>].mp4. Places whose
# signs carry words (the "Today's puzzles" board) have a film per language; the others show only names, so one film
# serves every language. An evening without a film in the page's language plays nothing.
WORDED_SIGNS = {"street", "parlour"}


# The places' films as videos for search engines (VideoObject on the page, and the video sitemap): which page shows
# which place's film, and what to call it. The film with words on its signs comes in each language.
PAGE_FILM = {"": "street", "business/index.html": "workshop", "growth/index.html": "glasshouse", "home/index.html": "house", "games/index.html": "parlour"}
FILM_TEXT = {"street": ("Busy Street", "A short film of Busy Street, where every Busy suite has its own building. Rendered in the Busy Studio."),
             "workshop": ("The Workshop", "A short film of the Workshop, the home of Busy Business: free tools for small businesses. Rendered in the Busy Studio."),
             "glasshouse": ("The Glasshouse", "A short film of the Glasshouse, the home of Busy Growth: free tools to grow your career. Rendered in the Busy Studio."),
             "house": ("Tuck's house", "A short film of Tuck's house, the home of Busy Home: free tools for household paperwork. Rendered in the Busy Studio."),
             "parlour": ("The Puzzle Parlour", "A short film of the Puzzle Parlour, the home of Busy Games: a new puzzle every day. Rendered in the Busy Studio.")}


def film_of(place: str, lang: str = "en"):
    """The VideoObject for a place's daytime film, or None while there is none."""
    film = SITE / "assets" / place / (f"loop-day-{lang}.mp4" if place in WORDED_SIGNS and lang != "en" else "loop-day.mp4")
    if not film.exists():
        film = SITE / "assets" / place / "loop-day.mp4"
    if not film.exists():
        return None
    rooms = json.loads((SITE / "assets" / place / "rooms.json").read_text())["rooms"]
    tr = (lambda s: s) if lang == "en" else (lambda s: I18N.translate_text(s, lang))
    name, desc = FILM_TEXT[place]
    return {"@context": "https://schema.org", "@type": "VideoObject", "name": tr(name), "description": tr(desc),
            "thumbnailUrl": f"{SITE_URL}/assets/{place}/room-{rooms[0]['id']}-1920.jpg", "uploadDate": "2026-11-03",
            "duration": "PT8S", "contentUrl": f"{SITE_URL}/assets/{place}/{film.name}", "isFamilyFriendly": True,
            "inLanguage": "en" if lang == "en" else I18N.HTML_LANG[lang]}


def film_ld(place: str, root: str) -> str:
    """Nothing: a room's loop moves behind the page's words, and a search engine only lists a video that is what the
    page is about. film_of() stays for the day each suite has a real film on a page of its own."""
    return ""


def place_loops(place: str) -> str:
    out = {}  # {"day": {lang: file}, "winter-day": {...}}: summer is the plain one, as with the pictures
    for season in ("", "spring-", "autumn-", "winter-"):
        for t in ("morning", "day", "evening"):
            files = {lang: f"loop-{season}{t}{'' if lang == 'en' else '-' + lang}.mp4" for lang in ["en", *I18N.LANGS]}
            have = {lang: f for lang, f in files.items() if (SITE / "assets" / place / f).exists()}
            if place not in WORDED_SIGNS and "en" in have:
                have = {lang: have["en"] for lang in files}
            if have:
                out[season + t] = have
    return f" data-loops='{json.dumps(out)}'" if out else ""


def plate_focus(place: str, room: str, W: float = 390, H: float = 490) -> float:
    """Where the first room's picture is cut before place.js arrives, as the x of object-position (0 to 100). The
    picture covers its box from the first paint (.house-plate in site.css); on a phone only part of the room fits, and
    this is the part place.js will choose (its onScreen, standFor, framing and layout, worked out here for a phone of
    390 by 844), so the picture stays where it is when the script takes over. On a wide screen the whole room shows."""
    import math
    try:
        r = next(x for x in json.loads((SITE / "assets" / place / "rooms.json").read_text())["rooms"] if x["id"] == room)
        cam, walk, spot = r["camera"], r["walk"], (r.get("hotspots") or [None])[0]
    except (OSError, ValueError, KeyError, StopIteration):
        return 50.0
    sub = lambda a, b: [a[i] - b[i] for i in range(3)]
    dot = lambda a, b: sum(a[i] * b[i] for i in range(3))
    unit = lambda a: [x / (math.hypot(*a) or 1) for x in a]
    f = unit(sub(cam["target"], cam["position"]))
    right = unit([-f[2], 0, f[0]])  # forward x up, with up = (0, 1, 0)
    tan = math.tan(cam["hfov"] * math.pi / 360)

    def across(p):  # a point of the room, as a part of the picture's width (None: behind the camera)
        d = sub(p, cam["position"])
        return (dot(d, right) / dot(d, f) / tan + 1) / 2 if dot(d, f) > 0 else None
    fw = max(W, H * 16 / 9)
    if fw <= W:
        return 50.0
    left = lambda fx: min(0, max(W - fw, W / 2 - fx * fw))
    stand = walk["stand"]
    if spot and W / fw <= 0.8 and across(spot["at"]) is not None and across(stand) is not None:
        at, home, reach = across(spot["at"]) * fw, across(stand) * fw, W * 0.42  # the guide this far from the spot at most
        if abs(home - at) > reach:
            want = at + (reach if home >= at else -reach)
            line = [[walk["from"][i] + (walk["to"][i] - walk["from"][i]) * k / 40 for i in range(3)] for k in range(41)]
            stand = min((p for p in line if across(p) is not None), key=lambda p: abs(across(p) * fw - want), default=stand)
    xs = [x for x in [across(stand)] + ([across(spot["at"])] if spot else []) if x is not None]
    focus = min(0.85, max(0.15, sum(xs) / len(xs))) if xs else 0.5
    return round(100 * left(focus) / (W - fw), 1)


def place_html(place: str, steps: list, card, label: str, model: str = "", next_label: str = "Next room →",
               decals: dict = None, brand: str = "", root: str = "../", height: float = 1, expert: str = "") -> str:
    """A place (assets/place.js) and every room's words as plain HTML (search engines and screen readers read these).
    decals: {id: (html, shown from the start)}, the words the page draws on the rooms. Without a model the place has no
    live guide (yet): the guide's lines float where it will stand. height: the guide's size next to Tuck (1)."""
    rooms = "".join(
        f'<article data-room="{s["id"]}" data-plate="{s.get("plate", s["id"])}" data-title="{e(s["title"])}" data-say="{e(s["say"])}"'
        f'{(" data-move=" + chr(34) + s["move"] + chr(34)) if s.get("move") else ""} hidden>'
        f'<template data-card>{"" if s is steps[0] else card(s)}</template>'
        + "".join(f'<template data-act="{a}" data-move="{m}" data-say="{e(say)}"{(" data-then=" + chr(34) + then + chr(34)) if then else ""}>{html}</template>'
                  for a, m, say, html, then in s["acts"])
        + "</article>" for s in steps)
    words = "".join(f'<template data-decal="{d}"{" data-shown" if shown else ""}>{html}</template>' for d, (html, shown) in (decals or {}).items())
    first = steps[0]
    return f"""<section class="house house-{place}" data-house data-house-rooms="{root}assets/{place}/rooms.json" data-house-plates="{root}assets/{place}/"{f' data-tuck-model="{model}"' if model else ''}{f' data-guide-height="{height}"' if height != 1 else ''}{f' data-expert="{expert}" data-expert-model="{root}assets/experts/{expert}.glb" data-expert-size="{EXPERTS[expert]["size"]}" data-extra-rooms="{root}assets/experts/rooms.json" data-extra-plates="{root}assets/experts/"' if expert else ''} data-next-label="{e(next_label)}"{f' data-brand-color="{brand}"' if brand else ''} {place_loops(place)} aria-label="{e(label)}">
    <div class="house-view" data-house-view>
      <img class="house-plate" data-house-plate src="{root}assets/{place}/room-{first.get("plate", first["id"])}-1920.jpg" alt="{e(first["title"])}, rendered in the Busy Studio" width="1920" height="1080" fetchpriority="high" style="object-position:{plate_focus(place, first.get("plate", first["id"])):g}% 50%">
      <div class="house-decals" data-house-decals></div>
      <div class="house-spots" data-house-spots></div>
      <p class="tuck-bubble house-bubble" data-tuck-bubble aria-live="polite" hidden></p>
      <div class="house-hud"><span data-house-count>1 / {len(steps)}</span><b data-house-title>{e(first["title"])}</b></div>
    </div>
    <div class="house-card card" data-house-card>{card(first)}</div>
    <nav class="house-nav" aria-label="Rooms"><button type="button" class="btn" data-house-prev>← Back</button><div class="house-dots" data-house-dots></div><button type="button" class="btn btn-primary" data-house-next>{e(next_label)}</button></nav>
    {words}
  </section>
  {film_ld(place, root)}<div class="house-rooms">{rooms}</div>"""


def house_html() -> str:
    return place_html("house", HOUSE_STEPS, house_card, "Tuck's house: a tour of Busy Home", model="../assets/tuck/tuck.glb", expert="juno")


def tool_cards(rows: list, folder: str, live: bool) -> str:
    """A suite's tools as cards; live, each card opens the tool's own page."""
    ids = [t["id"] for t in suite_tools(folder)]
    return "".join((f'<a class="card feat reveal pop" href="{ids[i]}.html"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p><span class="go">More about {e(n)} →</span></a>' if live and i < len(ids)
                    else f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>') for i, (em, n, d) in enumerate(rows))


HOME_ANSWERS = [
    ("What is Busy Home?", "Busy Home is a free app for Mac and Windows for a household's paperwork: documents with their expiry dates, contracts with the last day to cancel, upkeep, an inventory, letters, a moving planner, a Just in Case binder and shared costs. Everything is saved in a folder on your own computer."),
    ("Who is it for?", "Busy Home is for any household, from one person to a family with pets: whoever looks after the contracts, the insurance, the letters and the dates."),
    ("What does it cost?", f"Busy Home is free, with no account and no subscription. Juno, the AI household assistant, comes in the paid edition: Busy Home with Juno, {PRODUCTS['juno']['price']} once on itch.io."),
    ("Is there AI in the free version?", "No. The free Busy Home has no AI and sends nothing anywhere. Only Juno, in the paid edition, uses AI: Claude, on your own Claude account."),
    ("Where is my data?", "Busy Home saves plain files in Documents/Busy/Home on your own computer, or in a folder you choose. Put it in Google Drive or Dropbox to share it with your partner. Nothing is sent to us."),
    ("Which languages?", "Busy Home is in English, Dutch, German, Spanish, Italian and Brazilian Portuguese. Juno writes a letter in the language of the person who receives it."),
]


def home_page(tools: list) -> str:
    feats = tool_cards(HOME_TOOLS, "home", HOME_LIVE)
    buy = (f'<p class="row-flex" style="margin-top:14px">{itch_button("juno", "Get Busy Home with Juno")} ' + ('<a class="btn" href="juno.html">Meet Juno</a> ' if HOME_LIVE else "")
           + f'<a class="btn" href="../claude-key.html">How Juno connects to Claude</a></p>{claude_line()}{"" if HOME_LIVE else film("juno")}')
    juno = f"""<section class="section" id="juno"><div class="wrap">
    <div class="card ivy-card juno-card reveal"><img src="../assets/juno-mark.svg" alt="" width="96" height="96">
      <div><p class="kicker">Juno by Busy · {PRODUCTS["juno"]["price"]} once</p><h2>Your household assistant</h2>
      <p>Attach the letter you've been avoiding and Juno tells you what it means and what to do by when, with the reply already drafted. It reads your contracts and policies, says when to keep, switch or cancel, sorts a pile of scans, helps with a claim or a move, and sends you a short briefing each month. It works on your own folder and never gives legal advice: it tells you when to ask a professional.</p>
      <ul class="get-list" style="margin-top:12px"><li>New in 2.1: tax time, a fair split for the household, pet care and the renewal check</li><li>Explains letters, bills and decisions, and spots scams</li><li>Writes cancellations, complaints, claims and objections in the recipient's language</li><li>Keeps every renewal, expiry and upkeep date in view</li></ul>
      {buy}</div></div>
  </div></section>"""
    steps = [("⬇️", "Install Busy Home", "The free app for Mac and Windows, in beta. No account, no AI."),
             ("🏡", "Open it", "It works offline, and nothing is sent anywhere."),
             ("📁", "Your own folder", "Your documents, scans and photos are saved as plain files in Documents/Busy/Home. Move it into Google Drive or Dropbox to share it with your partner."),
             ("🪪", "Start with your passports", "Add them with their expiry dates. Then your contracts: Busy shows the last day to cancel each one.")]
    how = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in steps)
    get = f"""<section class="section" id="get"><div class="wrap">
    <div class="center reveal"><h2 class="big">Get Busy Home</h2><p class="lead">Free, the whole set. No account, no subscription, nothing sent to us.</p></div>
    <div class="feats">{how}</div>
    <div class="center" style="margin-top:22px">{app_download("Home", "Busy Home")}
      <p class="faint" style="margin-top:10px">Can’t install apps? <a href="../downloads/busy-home.zip" download>Use the browser version (zip)</a> in Chrome or Edge.</p>
      <p class="faint" style="margin-top:10px">Want the expert too? <a class="out" href="{PRODUCTS["juno"]["url"]}" target="_blank" rel="noopener">{PRODUCTS["juno"]["name"]} · {PRODUCTS["juno"]["price"]} <span aria-hidden="true">↗</span></a></p>
      {claude_line("center")}</div>
  </div></section>""" if HOME_LIVE else """<section class="section" id="get"><div class="wrap center">
    <h2 class="big">On its way</h2><p class="lead">Busy Home is nearly ready. Meanwhile, keep your brain busy with <a href="../games/index.html">today's puzzles</a>.</p></div></section>"""
    title = "Busy Home: get your evenings back from household paperwork" if HOME_LIVE else "Busy Home: free tools for your household paperwork (soon)"
    desc = (f"Get your evenings back. Busy Home takes care of household paperwork: documents, contracts with the last day to cancel, upkeep and letters. {len(HOME_TOOLS)} free tools, no account. "
            f"With Juno, your household assistant, {PRODUCTS['juno']['price']} once."
            if HOME_LIVE else "Busy Home, coming soon: free tools for household paperwork. Documents, contracts with the last day to cancel, upkeep, inventory, letters and moving.")
    three = ('<script type="importmap">{"imports":{"three":"../assets/vendor/three/build/three.module.min.js"}}</script>'
             '<link rel="preload" href="../assets/house/room-door-1920.jpg" as="image">') if HOME_LIVE else ""
    top = house_html() if HOME_LIVE else f"""<section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--tomato);right:-140px;top:-120px"></div>
    <div class="wrap center" style="padding:70px 16px 30px;display:block;text-align:center">
      <span class="chip chip-grey">Coming soon</span>
      <h1 class="reveal" style="margin-top:12px">Busy Home 🏡</h1>
      <p class="lead reveal" style="max-width:680px;margin:0 auto">Free tools for the paperwork every household has: passports, policies, contracts, upkeep, the things you own and the letters you need to send. Everything in your own folder, no account, like the rest of Busy.</p>
    </div>
  </section>"""
    return f"""{head(title, desc, "home/index.html", "../", extra=three + suite_ld("home", desc) + (faq_ld(HOME_ANSWERS) if HOME_LIVE else ""), image="og-juno.png")}
<body class="site app-tomato">
{nav("../", ("⬇️ Download free", "#get") if HOME_LIVE else explore("../"))}
<main id="main">
  {top}
  {film_top("juno") if HOME_LIVE else ""}
  {'<section class="section"><div class="wrap">' + expert_intro("juno", "Tuck", "../app/shared/places/house/tuck-hello.png", "#upstairs", free_line=True, job=True) + "</div></section>" if HOME_LIVE else ""}
  <section class="section" id="tools"><div class="wrap">
    <div class="center reveal"><h2 class="big">{len(HOME_TOOLS)} tools that work together</h2><p class="lead">A contract knows its cancellation letter, the move knows your contracts, and the Just in Case binder knows where every document is.{' <a href="../app/home.html">Try them all in the demo →</a>' if HOME_LIVE else ''}</p></div>
    <div class="feats">{feats}</div>
  </div></section>
  {home_new() if HOME_LIVE else ""}
  <section class="section"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🔒</span>
      <div><p class="kicker">The most private paperwork you have</p><h2>Your passports never leave your folder</h2>
      <p>IDs, insurance policies, contracts, the family's plans: this is the most sensitive paperwork a household has. Busy Home keeps all of it as plain files in a folder you choose. There is no Busy account and no Busy server, so there is nothing to hack and nothing to sell.</p></div></div>
  </div></section>
  {in_short("Busy Home", HOME_ANSWERS) if HOME_LIVE else ""}
  {get}
  {juno}
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
{'<script type="module" src="../assets/place.js"></script>' if HOME_LIVE else ''}
</body>
</html>
"""


# ---------- Busy Rentals (behind RENTALS_LIVE) ----------
# Words and facts from FRAMEWORK-RENTALS-HOME-2026-11-16 and the law check of 16 November 2026 (RENTALS-LAW-CHECK):
# every rule stated no stronger than its official source, each with its link. No AI in the free app.
RENTALS_TOOLS = [("🏠", "Homes & Tenancies", "Every home you let, who lives there, and every check and certificate with its date and its official source."),
                 ("💶", "Rent & Deposits", "What came in, what is late, and where each deposit stands: the cap, and the date to protect or return it."),
                 ("✉️", "Letters to Tenants", "A welcome, a visit, a repair, a copy of a certificate and the deposit at the end, in six languages: you choose for each tenant."),
                 ("🧾", "Costs & the Tax Year", "Costs per home with the receipt, and each home's totals for the year, ready for your return or your accountant.")]
RENTALS_PROMISE = "Be the landlord people hope for."
RENTALS_WHAT = "Rental management for people who let one home or a few: the dates, the papers, the rent and the tax year, in one place."
# Short answers for people and for AI search, also the page's FAQ data.
RENTALS_ANSWERS = [
    ("What is Busy Rentals?", "Busy Rentals is a free app for Mac and Windows for people who let one home or a few. It keeps every date, certificate, deposit, rent payment and receipt in a folder on your own computer."),
    ("Who is it for?", "People who let one home or a few and run it themselves: someone who moved in with a partner and kept their flat, inherited a parent's home, or bought one for their pension."),
    ("Which countries does Busy Rentals cover?", "England, the Netherlands and Germany: each duty Busy keeps, with how often it comes back, its official page and the date Busy last checked it. In any other country, Busy keeps your homes, rent, deposits, costs and letters, without country dates."),
    ("What does it cost?", "Busy Rentals is free, with no account and no subscription. Wren, the AI property manager, comes in the paid edition: Busy Rentals with Wren, $4.99 once on itch.io."),
    ("Is there AI in the free version?", "No. The free Busy Rentals has no AI and sends nothing anywhere. Only Wren, in the paid edition, uses AI: Claude, on your own Claude account."),
    ("Does Busy give legal or tax advice?", "No. Busy states each rule plainly, links the official page and shows when it was checked. For advice, ask a solicitor, an accountant or your landlords' association."),
]
RENTALS_MORE_FAQ = [
    ("Can a partner or co-owner use it too?", "Yes. Put the folder in Google Drive, Dropbox, OneDrive or iCloud Drive and open it on each computer."),
    ("Does Busy collect the rent or send letters?", "No. Busy keeps the record and drafts the letters; the rent and the letters go the way they do now."),
    ("Which languages?", "The app and the letters to tenants are in English, Dutch, German, Spanish, Italian and Brazilian Portuguese. A letter starts in the home's country's language, and you can choose another for each tenant."),
    ("Which computers?", "The free app is for Mac and Windows, in beta. The Windows installer has not yet been run by us on a Windows computer: tell us how it goes. Without installing, a folder that runs in Chrome or Edge is there too."),
]
# The country packs are the app's (app/shared/rentals.js): the site reads each pack's checked date, each duty's official
# page and whether the pack marks it as optional or changing from there, so the site never says more than the app.
RENTALS_PACK_OF = {"England": "england", "The Netherlands": "nl", "Germany": "de"}
MONTH_NAMES = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
_packs = {}


def rentals_packs() -> dict:
    """{pack: {"checked": "YYYY-MM-DD", "sources": {duty id | "deposit" | "tax" | "year": url}, "optional": {ids}, "changing": {ids}}}"""
    if _packs:
        return _packs
    src = (APP / "shared" / "rentals.js").read_text()
    body = src[src.index("R.PACKS = {"):src.index("R.pack = ")]
    heads = list(re.finditer(r"^    (\w+): \{\n\s+name: '[^']*'[^\n]*?checked: '(\d{4}-\d\d-\d\d)'", body, re.M))
    for i, m in enumerate(heads):
        block = body[m.start():heads[i + 1].start() if i + 1 < len(heads) else len(body)]
        pack = {"checked": m.group(2), "sources": {}, "optional": set(), "changing": set()}
        for line in block.splitlines():
            duty = re.search(r"\{ id: '(\w+)'", line)
            link = re.search(r"source: '([^']+)'", line)
            key = duty.group(1) if duty else next((k for k in ("deposit", "tax", "year") if re.match(rf"\s*{k}: [\[{{]", line)), None)
            if not key or not link:
                continue
            pack["sources"][key] = link.group(1)
            if duty and "optional: true" in line:
                pack["optional"].add(key)
            if duty and ("changing: true" in line or "(changing)" in line):
                pack["changing"].add(key)
        _packs[m.group(1)] = pack
    missing = [c for c in RENTALS_PACK_OF.values() if c not in _packs]
    if missing:
        raise SystemExit(f"app/shared/rentals.js: could not read the country pack(s) {missing}")
    return _packs


def date_words(iso: str) -> str:
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d} {MONTH_NAMES[m - 1]} {y}"


def rentals_checked(countries=None) -> str:
    """The date the rules shown were last checked, in words: the oldest of the packs named (all three when none is)."""
    packs = rentals_packs()
    return date_words(min(packs[RENTALS_PACK_OF[c]]["checked"] for c in (countries or RENTALS_PACK_OF)))


def rentals_checked_line(countries=None) -> str:
    return f"Checked on {rentals_checked(countries)}. Busy states the rules; it never gives legal or tax advice."


# England's deposit cap has its own official page (law check of 16 November 2026, E13); the pack's deposit page is
# the one about protecting the deposit.
ENGLAND_DEPOSIT_CAP_PAGE = "https://www.gov.uk/assured-tenancy-agreements-a-guide-for-landlords/rent-in-advance-and-deposits"
# A few of each country's dated duties, worded as the pack words them: (the fact, the pack's duty it comes from, any
# official page besides the pack's own). The links, the marks and the checked date are read from the pack.
RENTALS_COUNTRIES = [
    ("🏴󠁧󠁢󠁥󠁮󠁧󠁿", "England", [
        ("A gas safety check every 12 months, with a copy to the tenant within 28 days.", "gas", ()),
        ("An electrical safety check at least every 5 years, with a copy within 28 days.", "eicr", ()),
        ("The deposit: at most 5 weeks' rent, or 6 weeks when the rent is £50,000 a year or more, protected within 30 days.", "deposit", (ENGLAND_DEPOSIT_CAP_PAGE,)),
        ("The new landlord register opens region by region from 15 December 2026, at £65 per property per year.", "register", ())]),
    ("🇳🇱", "The Netherlands", [
        ("An energy label, valid for 10 years, given at letting.", "label", ()),
        ("The yearly service-cost statement, by 30 June for the year before.", "service", ()),
        ("The deposit: at most 2 months' bare rent, returned within 14 days, or 30 days when costs are kept back.", "deposit", ())]),
    ("🇩🇪", "Germany", [
        ("The service-charge statement within 12 months of the end of the billing period.", "statement", ()),
        ("The deposit: at most 3 months' rent without the service-charge advance.", "deposit", ()),
        ("Where heating or hot water is shared and billed by use: meters fitted before 1 December 2021 that cannot be read remotely are retrofitted or replaced by 31 December 2026; the rule has exceptions.", "heatmeters", ())]),
]


def rentals_facts(country: str, facts: list) -> list:
    """Each fact of a country card with what the pack says about it: (text, [official pages], changing, optional)."""
    pack = rentals_packs()[RENTALS_PACK_OF[country]]
    out = []
    for text, duty, more in facts:
        if duty not in pack["sources"]:
            raise SystemExit(f"app/shared/rentals.js: {country} has no '{duty}' any more, and the Busy Rentals page names it")
        out.append((text, [*more, pack["sources"][duty]], duty in pack["changing"], duty in pack["optional"]))
    return out


WREN_FEATS = [("📄", "Reads the tenancy", "The dates, the rent, the deposit and who pays what, filled in. The clauses worth asking a professional about, listed."),
              ("🗓️", "This month", "A short briefing: rent in, what falls due, what to send, and the one thing to do first."),
              ("🔥", "The certificate round", "When a check falls due: the message to book it, the note to the tenant about access, then the copy to the tenant with its date."),
              ("🔑", "A new tenant", "What to hand over and record in your country, the welcome letter, and the check-in report ready to fill in."),
              ("🛡️", "Check-out and the deposit", "Check-out compared with check-in, room by room, and the deposit letter drafted within your country's deadline."),
              ("🔧", "A repair message", "A calm reply, the repair logged, and a short brief for the tradesperson."),
              ("📈", "The rent review", "The rent history, your country's rule and the earliest date. She explains; she never picks a figure for you."),
              ("🧾", "The tax year", "Costs sorted per home and by kind, and the year's figures ready for you or your accountant."),
              ("📰", "What changed for me", "Which rules marked as changing touch your homes, with the source and the date it was checked.")]
WREN_FAQ = [("Is Wren a person?", "No. Wren is an AI property manager that runs on Claude, made by Anthropic, on your own Claude account. She works only from your own records and your country's rules in Busy, and shows the source for each rule."),
            ("What does she cost?", "Wren comes in Busy Rentals with Wren: $4.99 once on itch.io. She runs on your own Claude: with the Claude app and a paid Claude plan, or with a Claude API key, when you pay Anthropic for what you use."),
            ("Where are my tenants' details?", "In your own rentals folder on your computer. What Claude reads goes to Anthropic under your own account, never to us."),
            ("Does Wren send letters?", "No. Wren drafts; every letter and every change waits for your yes, and you send it the way you always do."),
            ("Does Wren give legal or tax advice?", "No. She explains what the official guidance says, with its source, and tells you when to ask a solicitor, an accountant or the tribunal."),
            ("Which countries does she know?", "England, the Netherlands and Germany, from the same country rules as the free app. Elsewhere she keeps your records and points you to your country's official guidance."),
            ("Is Wren in the free download?", "No. The free Busy Rentals has every tool and no AI. Wren comes in her own download when you buy her, with Busy Rentals included.")]


def rentals_countries() -> str:
    mark = lambda changing, optional: (' <span class="chip chip-grey">Changing</span>' if changing else "") + (' <span class="chip chip-grey">Applies to some homes</span>' if optional else "")
    cards = "".join(f'<div class="card feat reveal pop"><span class="fe">{flag}</span><h3>{e(name)}</h3><ul class="get-list">'
                    + "".join(f'<li>{e(t)}{mark(ch, opt)} ' + " ".join(f'<a class="out" href="{e(u)}" target="_blank" rel="noopener">Official page ↗</a>' for u in links) + "</li>"
                              for t, links, ch, opt in rentals_facts(name, facts)) + "</ul></div>"
                    for flag, name, facts in RENTALS_COUNTRIES)
    return f"""<section class="section" id="countries"><div class="wrap">
    <div class="center reveal"><h2 class="big">Your country's landlord year, built in</h2><p class="lead">A few of the dates Busy keeps for you. Every duty in the app links its official page and shows when Busy last checked it. Rules marked as changing are checked again before each release.</p></div>
    <div class="feats">{cards}</div>
    <p class="center faint reveal" style="margin-top:14px">{rentals_checked_line()}</p>
  </div></section>"""


def rentals_page(tools: list) -> str:
    """Busy Rentals' front page: the promise, the answers, the tools, the countries, free and paid, the download, Wren."""
    feats = tool_cards(RENTALS_TOOLS, "rentals", True)
    answers = "".join(f'<div class="card feat reveal pop"><h3>{e(q)}</h3><p>{e(a)}</p></div>' for q, a in RENTALS_ANSWERS)
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in RENTALS_ANSWERS + RENTALS_MORE_FAQ)
    desc = (f"{RENTALS_WHAT} Every certificate, deposit, payment and receipt in your own folder, with the landlord's year for England, the Netherlands and Germany built in. "
            f"Free, no AI. With Wren, your property manager, {WREN['price']} once.")
    ld = suite_ld("rentals", desc) + jsonld({"@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in RENTALS_ANSWERS + RENTALS_MORE_FAQ]})
    rows = [("Every date, certificate, deposit and payment, in your own folder", True, True),
            ("Your country's landlord year: England, the Netherlands, Germany", True, True),
            ("Check-in and check-out reports, letters to tenants, the tax year", True, True),
            ("Reads the tenancy agreement and fills in the dates", False, True),
            ("A monthly briefing, and the certificate round prepared", False, True),
            ("Drafts the deposit letter, the repair reply and the rent review", False, True)]
    cmp = "".join(f'<tr><td>{e(a)}</td><td>{"✓" if f else "–"}</td><td>{"✓" if p else "–"}</td></tr>' for a, f, p in rows)
    steps = [("⬇️", "Install Busy Rentals", "The free app for Mac and Windows, in beta. No account, no AI."),
             ("🏠", "Add the home you let", "Its address and its country: Busy loads that country's duties."),
             ("📁", "Your own folder", "Your homes, tenancies, certificates and receipts are saved as plain files in a folder you choose."),
             ("📋", "Record what is done", "The last gas check or energy label, the rent, the deposit: Busy keeps every next date.")]
    how = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in steps)
    return f"""{head("Busy Rentals: be the landlord people hope for", desc, "rentals/index.html", "../", extra=ld, image="og-wren.png")}
<body class="site app-sky">
{nav("../", ("⬇️ Download free", "#get"))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--sky);right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <span class="em big" style="--c:var(--sky)">🔑</span>
        <p class="kicker">Busy Rentals · free, private, no account</p>
        <h1>{e(RENTALS_PROMISE)}</h1>
        <p class="lead">{e(RENTALS_WHAT)} Good tenants stay where a home is well looked after.</p>
        <div class="ctas"><a class="btn btn-primary btn-big" href="#get">⬇️ Download free</a><a class="btn btn-big" href="../app/rentals.html">👀 See it in the demo</a></div>
        <p class="note">Free app for Mac and Windows · No AI · Nothing is sent to us · With Wren, your property manager: {WREN["price"]} once</p>
      </div>
      <div class="stage solo reveal from-right"><figure class="tool-room"><img src="../assets/shots/rentals-today.jpg" alt="Busy Rentals: This month, with the demo’s example landlord" width="1280" height="720"></figure></div>
    </div>
  </section>
  {film_top("wren")}
  <section class="section" id="in-short"><div class="wrap">
    <div class="center reveal"><h2 class="big">Busy Rentals in short</h2></div>
    <div class="feats">{answers}</div>
  </div></section>
  <section class="section" id="tools"><div class="wrap">
    <div class="center reveal"><h2 class="big">{len(RENTALS_TOOLS)} tools that work together</h2><p class="lead">This month shows at most three things to do. The landlord's year shows every date. <a href="../app/rentals.html">Try them all in the demo →</a></p></div>
    <div class="feats">{feats}</div>
  </div></section>
  {rentals_countries()}
  <section class="section" id="free-and-paid"><div class="wrap">
    <div class="center reveal"><h2 class="big">Free, or with Wren</h2><p class="lead">{FREE_AND_PAID}</p></div>
    <div class="cmp offer reveal" role="region" aria-label="Busy Rentals, free and with Wren" tabindex="0"><table>
      <thead><tr><th></th><th>Busy Rentals<br><small>free</small></th><th>With Wren<br><small>{WREN["price"]} once</small></th></tr></thead><tbody>{cmp}
      <tr><td>AI</td><td>None</td><td>Claude, on your own account</td></tr></tbody></table></div>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🔒</span>
      <div><p class="kicker">Your tenants' details stay yours</p><h2>Everything in your own folder</h2>
      <p>Tenancies, deposits, certificates and receipts are kept as plain files in a folder you choose. There is no Busy account and no Busy server, so there is nothing to hack and nothing to sell.</p></div></div>
  </div></section>
  <section class="section" id="get"><div class="wrap">
    <div class="center reveal"><h2 class="big">Get Busy Rentals</h2><p class="lead">Free, the whole set. No account, no subscription, no AI, nothing sent to us.</p></div>
    <div class="feats">{how}</div>
    <div class="center" style="margin-top:22px">{app_download("Rentals", "Busy Rentals")}
      <p class="faint" style="margin-top:10px">Can’t install apps? <a href="../downloads/busy-rentals.zip" download>Use the browser version (zip)</a> in Chrome or Edge.</p>
      <p class="faint" style="margin-top:10px">Want the expert too? <a class="out" href="{WREN["url"]}" target="_blank" rel="noopener">{WREN["name"]} · {WREN["price"]} <span aria-hidden="true">↗</span></a></p>
      {claude_line("center")}</div>
  </div></section>
  <section class="section" id="wren"><div class="wrap">
    <div class="card ivy-card wren-card reveal"><img src="../assets/wren-mark.svg" alt="" width="96" height="96">
      <div><p class="kicker">Wren by Busy · {WREN["price"]} once</p><h2>Your property manager</h2>
      <p>Drop in the tenancy agreement and Wren fills in the dates, the rent and the deposit. She keeps the landlord's year, prepares the certificate round, compares check-out with check-in and drafts every letter to your tenants. Each one waits for your yes. She never gives legal or tax advice: she tells you when to ask a professional.</p>
      <ul class="get-list" style="margin-top:12px"><li>Reads the tenancy and keeps every date</li><li>Drafts the letters, the deposit statement and the rent review</li><li>Fair to tenants and landlords alike</li></ul>
      <p class="row-flex" style="margin-top:14px">{itch_button("wren", "Get Busy Rentals with Wren")} <a class="btn" href="wren.html">More about Wren</a></p>
      {claude_line()}</div></div>
    {one_job("wren")}
  </div></section>
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{faq}</div>
  </div></section>
  <section class="final">
    <h2 class="reveal pop">{e(RENTALS_PROMISE)}</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">Busy Rentals is free. Wren does the boring part for you.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px"><a class="btn btn-big" href="#get">⬇️ Download free</a>{itch_button("wren", "With Wren", big=True)}</div>
    {claude_line()}
  </section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


# ---------- a page of their own for Ivy, Juno, Wren and Sal ----------
# One template (Wren's page of 17 November 2026 was the model), filled per expert: who they are, in the suite's
# promise; the buy button with the price; one job, done; what they do (jobs their skills really have, in our own
# words: never the skills' text); how they run on your own Claude; what they never do; the questions; the film.
IVY_FEATS = [("📃", "Your worth on a page", "What you can do, what you achieved and what you are growing into, on one page. The start of a review, a raise, a CV or a profile."),
             ("🏆", "Find my wins", "A short interview that brings back what you achieved and never wrote down. Each win is saved with what changed."),
             ("🔎", "Am I ready for this job?", "A job advert next to your Skills Map: what matches, with its proof, what is missing, and what to do first."),
             ("📄", "A CV for one job", "A version of your CV that leads with the wins that fit the advert, honest about the gaps, with a cover letter to match."),
             ("🎤", "Interview practice", "The likely questions for one job, a practice interview one question at a time, and your wins shaped into the stories interviewers ask for."),
             ("📈", "Review and raise", "Your year in a short pack for the review, and the case for a raise: the reasons from your own results and a range with its sources."),
             ("🗓️", "A learning plan", "A gap in your skills becomes a week-by-week plan in the Learning Planner, at the hours you really have, free resources first."),
             ("💼", "Your LinkedIn profile", "Headline, About and experience rewritten from your real wins, within LinkedIn's limits, ready to copy.")]
IVY_FAQ = [("Is Ivy a person?", "No. Ivy is an AI career coach that runs on Claude, made by Anthropic, on your own Claude account. She works only from your own record in Busy Growth and from what you tell her."),
           ("What does she cost?", f"Ivy comes in Busy Growth with Ivy: {PRODUCTS['ivy']['price']} once on itch.io. She runs on your own Claude: with the Claude app and a paid Claude plan, or with a Claude API key, when you pay Anthropic for what you use."),
           ("Does Ivy make things up for my CV?", "No. Ivy never invents experience, skills, results or numbers. Every line comes from your own wins, career and learning, and she says plainly where a role asks for something you have not done yet."),
           ("Does Ivy apply for jobs or send messages?", "No. Ivy drafts the CV, the letter and the message. You read them, change them and send them yourself."),
           ("Where is my career record?", "In your own Growth folder on your computer. What Claude reads goes to Anthropic under your own account, never to us."),
           ("Is Ivy in the free download?", "No. The free Busy Growth has every tool and no AI. Ivy comes in her own download when you buy her, with Busy Growth included.")]
JUNO_FEATS = [("📬", "Explains the letter", "Who it is from, what it means and what must happen by when, with the reply drafted. She also points out the signs of a scam."),
              ("🧾", "Checks the bill", "A bill or a yearly statement read next to your contract and last time: what changed, whether it adds up, and when to pay."),
              ("📑", "Reads the contract", "A policy, an energy or phone contract, a lease: the cost, the term, the notice period and the last day to cancel, filled in."),
              ("🔁", "Keep, switch or cancel", "Before a contract renews: what it costs, how the price changed and what to compare. The cancellation is drafted if you choose to stop."),
              ("✉️", "Writes the letter", "Cancellations, complaints, claims, objections and requests for your data, with the facts from your own papers, firm and polite."),
              ("🗂️", "Sorts the pile", "Scans and photos, also from your phone: each one read, named, dated and filed, with what it asks of you."),
              ("🗓️", "The monthly briefing", "What is coming in the next eight weeks: last days to cancel, renewals, papers that expire and upkeep that falls due."),
              ("🧮", "Tax time and fair shares", "The papers for the yearly return gathered, with what is still missing, and who owes whom in the household, in the fewest payments.")]
JUNO_FAQ = [("Is Juno a person?", "No. Juno is an AI household assistant that runs on Claude, made by Anthropic, on your own Claude account. She works only from your own papers and contracts in Busy Home, and quotes the document when it matters."),
            ("What does she cost?", f"Juno comes in Busy Home with Juno: {PRODUCTS['juno']['price']} once on itch.io. She runs on your own Claude: with the Claude app and a paid Claude plan, or with a Claude API key, when you pay Anthropic for what you use."),
            ("Does Juno give legal or financial advice?", "No. Juno explains what a letter, a contract or a policy says and drafts the reply. For advice she tells you who to ask: a legal advice desk, your insurer, a tax adviser or debt counselling."),
            ("Does Juno send letters or cancel contracts?", "No. Juno drafts; every letter and every change waits for your yes, and you send it the way you always do."),
            ("Where are my papers?", "In your own Home folder on your computer. What Claude reads goes to Anthropic under your own account, never to us."),
            ("Is Juno in the free download?", "No. The free Busy Home has every tool and no AI. Juno comes in her own download when you buy her, with Busy Home included.")]
SAL_FEATS = [("🍳", "Cook with what's left", "Tonight's dinner from what is in the fridge, the food that goes off first on top. When no dish fits, a new one of his own, marked as new."),
             ("🗓️", "Plan my week", "The coming dinners around your evenings, your allergies and diets, your budget and what needs using up, with a kitchen to travel to now and then."),
             ("🛒", "The shopping run", "The list from the week plan, minus what is already in the pantry, grouped the way your shop is laid out."),
             ("🥗", "Make it for", "Any recipe made vegetarian, vegan, without dairy or gluten among the ingredients, or for two instead of six, with the allergens checked again."),
             ("📷", "Read my recipe", "A photo of a handwritten family recipe becomes a recipe in your Recipe Box, exactly as written, with its story and the photo kept."),
             ("🎉", "Guests are coming", "A menu for the number at the table and their allergies, with a timeline for the day, so the cook sits down too."),
             ("🧯", "Fix this dish", "Too salty, too thin, split or burnt at the bottom: what to do now, step by step, and what to do next time."),
             ("👩‍🍳", "Teach me", "One technique explained step by step, a white sauce or a risotto, with why each step matters and a dish to practise on.")]
SAL_FAQ = [("Is Sal a person?", "No. Sal is an AI chef that runs on Claude, made by Anthropic, on your own Claude account. He works from Busy Kitchen's dishes and from your own recipes, pantry and week plan."),
           ("What does he cost?", f"Sal comes in Busy Kitchen with Sal: {SAL['price']} once on itch.io. He runs on your own Claude: with the Claude app and a paid Claude plan, or with a Claude API key, when you pay Anthropic for what you use."),
           ("Are Sal's own recipes tested?", "No. A recipe Sal creates or adapts is new: it is marked as Sal's new recipe, not yet cooked by us. Busy's house recipes are checked against written rules, and are also not yet cooked by us."),
           ("Does Sal give diet or medical advice?", "No. Sal cooks: he can leave gluten or dairy out of the ingredients, and he lists the allergens. Managing an allergy, an illness or a diet is for a dietitian or a doctor."),
           ("Does Sal order the shopping?", "No. Sal prepares the week plan and the shopping list. Each waits for your yes, and you do the shopping."),
           ("Where are my recipes?", "In your own kitchen folder on your computer. What Claude reads goes to Anthropic under your own account, never to us."),
           ("Is Sal in the free download?", "No. The free Busy Kitchen has the six kitchens and every tool, and no AI. Sal comes in his own download when you buy him, with Busy Kitchen included.")]


def expert_pages() -> dict:
    """What each expert's page says. The words that differ per expert; the shape is expert_page()."""
    on_claude = lambda who: (f"Connect {who} to your Claude app: a plugin and a folder, set up in a few steps, with a paid Claude plan. "
                             "Or use a Claude API key: then you pay Anthropic for what you use. Nothing goes through Busy.")
    return {
        "wren": {"folder": "rentals", "suite": "Busy Rentals", "color": "sky", "image": "og-wren.png", "category": "BusinessApplication", "promise": RENTALS_PROMISE,
                 "title": "Wren by Busy: your property manager",
                 "desc": (f"Wren reads the tenancy, keeps the landlord's year and drafts every letter to your tenants, on your own Claude. "
                          f"She never gives legal advice and never sends anything. Busy Rentals with Wren, {WREN['price']} once on itch.io."),
                 "h1": "Wren, your property manager.",
                 "lead": "She reads the tenancy, keeps the landlord's year and drafts every letter to your tenants. Each one waits for your yes.",
                 "note": "Mac and Windows · Runs on your own Claude · Never gives legal or tax advice · Never sends anything",
                 "picture": '<img src="../assets/wren-mark.svg" alt="The Wren logo: a sky-blue key" width="260" height="260" style="width:260px;height:260px">',
                 "feats_lead": "From your own records in Busy Rentals and your country's rules, with the official source for each.", "feats": WREN_FEATS,
                 "claude": "Connect Wren to the Claude app you already use: a plugin and a folder, set up in a few steps, with a paid Claude plan. Or use a Claude API key: then you pay Anthropic for what you use. Nothing goes through Busy.",
                 "never": ("⚖️", "Fair to both sides", "Wren never helps to refuse a tenant unlawfully, to skip a required check or to pressure someone out of their home. Letters are polite, clear and specific. She says when to ask a solicitor, an accountant or the tribunal."),
                 "faq": WREN_FAQ, "final": f"Busy Rentals with Wren: {WREN['price']} once on itch.io. The tools alone are free."},
        "ivy": {"folder": "growth", "suite": "Busy Growth", "color": "mint", "image": "og-ivy.png", "category": "BusinessApplication", "promise": "Know what you’re worth. Say it well.",
                "title": "Ivy by Busy: your career coach",
                "desc": (f"Ivy turns what you learned and did into your worth on a page, a CV for one job and the words for your review, on your own Claude. "
                         f"She never invents experience. Busy Growth with Ivy, {PRODUCTS['ivy']['price']} once on itch.io."),
                "h1": "Ivy, your career coach.",
                "lead": "Know what you’re worth. Say it well. Ivy reads your skills, your wins and what you learned, and finds the words for a review, a raise or a job application. Every line waits for your yes.",
                "note": "Mac and Windows · Runs on your own Claude · Never invents experience · Never sends anything",
                "picture": '<figure class="tool-room expert-room"><img src="../assets/experts/ivy-card.jpg" alt="Ivy in the room upstairs, rendered in the Busy Studio" width="1200" height="675"></figure>',
                "feats_lead": "From your own record in Busy Growth: your skills, your wins, what you learned and the adverts you saved.", "feats": IVY_FEATS,
                "claude": on_claude("Ivy"),
                "never": ("🌱", "Only what is true", "Ivy never invents experience, skills, results or numbers: every line comes from your own record or from what you tell her. Where a role asks for something you have not done yet, she says so plainly. A salary range comes with its sources and is never a guarantee. She drafts; you send."),
                "faq": IVY_FAQ, "final": f"Busy Growth with Ivy: {PRODUCTS['ivy']['price']} once on itch.io. The tools alone are free."},
        "juno": {"folder": "home", "suite": "Busy Home", "color": "tomato", "image": "og-juno.png", "category": "LifestyleApplication", "promise": "Get your evenings back.",
                 "title": "Juno by Busy: your household assistant",
                 "desc": (f"Juno explains the letter, drafts the reply and keeps every renewal in view, on your own Claude. "
                          f"She never gives legal or financial advice. Busy Home with Juno, {PRODUCTS['juno']['price']} once on itch.io."),
                 "h1": "Juno, your household assistant.",
                 "lead": "Get your evenings back. Juno reads the letter you have been avoiding, says what to do by when and drafts the reply. Each step waits for your yes.",
                 "note": "Mac and Windows · Runs on your own Claude · Never gives legal or financial advice · Never sends anything",
                 "picture": '<figure class="tool-room expert-room"><img src="../assets/experts/juno-card.jpg" alt="Juno in the room upstairs, rendered in the Busy Studio" width="1200" height="675"></figure>',
                 "feats_lead": "From your own papers, contracts and dates in Busy Home.", "feats": JUNO_FEATS,
                 "claude": on_claude("Juno"),
                 "never": ("⚖️", "Where Juno's help ends", "Juno explains and drafts. She never gives legal, tax, financial, insurance or medical advice, and never recommends an insurer, a bank or a loan. When the stakes are high she says so and names who to ask. She never asks for passwords or PINs."),
                 "faq": JUNO_FAQ, "final": f"Busy Home with Juno: {PRODUCTS['juno']['price']} once on itch.io. The tools alone are free."},
        "sal": {"folder": "kitchen", "suite": "Busy Kitchen", "color": "sun", "image": "og-kitchen.png", "category": "LifestyleApplication", "promise": KITCHEN_PROMISE,
                "title": "Sal by Busy: your chef",
                "desc": (f"Sal cooks with what is left, plans your week and reads the family's handwritten recipes, on your own Claude. "
                         f"He never gives medical or diet advice. Busy Kitchen with Sal, {SAL['price']} once on itch.io."),
                "h1": "Sal, your chef.",
                "lead": "Bring the world to your table. Sal knows all six kitchens, cooks with what is in your fridge and plans the week around who is home. He prepares; you decide.",
                "note": "Mac and Windows · Runs on your own Claude · Never gives medical or diet advice · Every change waits for your yes",
                "picture": '<span class="expert-emoji" aria-hidden="true">🧂</span>',
                "feats_lead": f"From Busy Kitchen's {KITCHEN_DISHES} dishes and your own Recipe Box, pantry and week plan.", "feats": SAL_FEATS,
                "claude": on_claude("Sal"),
                "never": ("🧂", "What Sal never does", "Sal gives no medical or diet advice and makes no health claims: for that, a dietitian or a doctor is the right person. A recipe he creates or adapts is marked new and not yet cooked by us. He lists the allergens and never calls a dish safe for an allergy: always check the labels of what you buy. He never shops, orders or pays."),
                "faq": SAL_FAQ, "final": f"Busy Kitchen with Sal: {SAL['price']} once on itch.io. Busy Kitchen alone is free.",
                "nav": ("🍳 Open free", "index.html#get")},
    }


def expert_page(key: str, tools: list) -> str:
    """An expert's own page: what they do, one job done, how they run, what they never do, and where to get them.
    The page's own words (p[...]) are ours and go in as they are; Wren's are byte for byte those of her first page."""
    p, x = expert_pages()[key], PRODUCTS[key]
    who, rel = x["who"], f'{EXPERTS[key]["page"]}'
    path = f'{p["folder"]}/{rel}'
    feats = "".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .05:.2f}s"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for i, (em, n, d) in enumerate(p["feats"]))
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in p["faq"])
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f"{who} by Busy", "applicationCategory": p["category"],
                 "operatingSystem": WREN_RUNS_ON, "url": f"{SITE_URL}/{path}", "description": p["desc"],
                 "offers": {"@type": "Offer", "price": x["amount"], "priceCurrency": "USD", "url": x["url"]}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in p["faq"]]})
    buy = f'<div class="job-buy reveal"><p class="row-flex">{itch_button(key, "Get " + x["name"], big=True)}</p>{claude_line()}</div>'
    em, never_h, never = p["never"]
    return f"""{head(p["title"], p["desc"], path, "../", ld, image=p["image"])}
<body class="site app-{p["color"]}">
{nav("../", p.get("nav", ("⬇️ Download free", "index.html#get")))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--{p["color"]});right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <a class="crumbs" href="index.html">← {p["suite"]}</a>
        <p class="kicker">{who} by Busy · in {x["name"]} · {x["price"]} once</p>
        <h1>{p["h1"]}</h1>
        <p class="lead">{p["lead"]}</p>
        <div class="ctas">{itch_button(key, "Get " + x["name"], big=True)}<a class="btn btn-big" href="index.html#get">⬇️ The free app, without AI</a></div>
        <p class="note">{p["note"]}</p>
        {claude_line()}
      </div>
      <div class="reveal from-right" style="display:grid;place-items:center;min-height:320px">{p["picture"]}</div>
    </div>
  </section>
  <section class="section" style="padding-top:20px"><div class="wrap">{one_job(key, buy)}</div></section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What {who} does</h2><p class="lead">{p["feats_lead"]}</p></div>
    <div class="feats">{feats}</div>
  </div></section>
  {film_top(key)}
  <section class="section"><div class="wrap">
    <div class="paths">
      <article class="card path reveal pop"><span class="e">☁️</span><h3>On your own Claude</h3>
        <p>{p["claude"]}</p></article>
      <article class="card path reveal pop" style="transition-delay:.1s"><span class="e">{em}</span><h3>{never_h}</h3>
        <p>{never}</p></article>
    </div>
  </div></section>
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{faq}</div>
  </div></section>
  <section class="final" id="get">
    <h2 class="reveal pop">{e(p["promise"])}</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">{p["final"]}</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px">{itch_button(key, "Get it on itch.io", big=True)}<a class="btn btn-big ghost-light" href="index.html#get">⬇️ Download free</a></div>
    {claude_line()}
  </section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def wren_page(tools: list) -> str:
    """Wren's own page (the template's first)."""
    return expert_page("wren", tools)


def rentals_suite_card() -> str:
    return (f'<a class="card suite reveal pop" href="rentals/" style="--c:var(--sky);transition-delay:.2s">\n'
            f'          <span class="e">🔑</span><h3>Busy Rentals</h3><span class="d">{e(RENTALS_PROMISE)}</span>\n'
            f'          <ul><li>Every certificate and deposit, with its date</li><li>England, the Netherlands and Germany built in</li><li>Rent, letters and the tax year</li></ul>\n'
            f'          <span class="foot"><span class="chip chip-sky">New · {len(RENTALS_TOOLS)} tools</span><span class="expert-chip wren"><img src="assets/wren-mark.svg" alt="" width="20" height="20">With Wren · {WREN["price"]}</span></span>\n'
            f'        </a>')


def rentals_expert_card() -> str:
    return (f'<a class="card expert wren reveal from-right" href="rentals/wren.html"><img src="assets/wren-mark.svg" alt="" width="84" height="84">\n'
            f'          <span><b>Wren by Busy</b><span>Your property manager. She reads the tenancy, keeps the landlord’s year and drafts every letter, for your yes.</span><span class="expert-chip wren">{WREN["name"]} · {WREN["price"]}</span></span></a>')


def rentals_llms(b: str) -> list:
    return (["", "## Busy Rentals: free rental management for one home or a few", "",
             f"- [Busy Rentals]({b}/rentals/index.html): {RENTALS_WHAT} Free, no AI, no account. The landlord's year for England, the Netherlands and Germany is built in, each duty with its official source; elsewhere it keeps homes, rent, deposits, costs and letters without country dates. Never legal or tax advice.",
             f"- [Download Busy Rentals]({b}/rentals/index.html#get): the free Busy Rentals app for Mac and Windows (beta), or a zip for the browser."]
            + [f"- [{t['name']}]({b}/rentals/{t['id']}.html): {t['description']}" for t in suite_tools("rentals")]
            + [f"- [Wren, the property manager]({b}/rentals/wren.html): reads the tenancy, keeps the landlord's year and drafts every letter for the owner's yes; never sends anything. In Busy Rentals with Wren, {WREN['price']} once on itch.io ({WREN['url']}), {ON_OWN_CLAUDE}."])


def rentals_llms_full(b: str) -> list:
    out = ["", "# Busy Rentals: free rental management for one home or a few", "", f"Page: {b}/rentals/index.html. {RENTALS_PROMISE} {RENTALS_WHAT}", ""]
    out += [f"- {q} {a}" for q, a in RENTALS_ANSWERS]
    for flag, name, facts in RENTALS_COUNTRIES:
        out += ["", f"## {name}: some of the dates Busy keeps (checked {rentals_checked([name])})", ""]
        out += [f"- {t}{' (this rule is changing)' if ch else ''}{' (applies to some homes)' if opt else ''} Source: {' and '.join(links)}" for t, links, ch, opt in rentals_facts(name, facts)]
    for t in suite_tools("rentals"):
        out += ["", f"## {t['name']}", "", f"{t['h1']} {t['lead']}", "", f"Page: {b}/rentals/{t['id']}.html", "", "What it does:"]
        out += [f"- {f[1]}: {f[2]}" for f in t["features"]] + ["", "Questions:"] + [f"- {q} {a}" for q, a in t["faq"]]
        if t.get("sources"):
            out += ["", f"Official sources (checked {rentals_checked({c for c, _, _ in t['sources']})}):"] + [f"- {c}, {what.lower()}: {u}" for c, what, u in t["sources"]]
    out += ["", "## Wren, the property manager (paid edition of Busy Rentals)", "", f"Page: {b}/rentals/wren.html. {WREN['price']} once on itch.io ({WREN['url']}).", ""]
    out += [f"- {n}: {d}" for _, n, d in WREN_FEATS] + ["", "Questions:"] + [f"- {q} {a}" for q, a in WREN_FAQ] + [""]
    return out


# ---------- Busy Home 2.1 on its page ----------
HOME_NEW = [("👪", "The whole household", "Everyone who lives there, people and pets, each with a colour. Say who looks after what, and see just your own things.", "home-household"),
            ("🧮", "Shared Costs", "Who paid what, and who owes whom: split equally, by income share or your own way, between any number of people.", "home-costs"),
            ("🐾", "Pets", "Vaccinations and check-ups with their next dates, a sitter's booklet as a PDF, and a checklist for travelling with a pet in the EU.", ""),
            ("🧾", "Tax time", "The date for the UK, the Netherlands, Germany, Spain, Italy or Brazil, the papers to gather, and a tag to keep a paper for the return.", "home-tax"),
            ("📱", "Drop here", "A folder for the scans and photos from your phone: they wait in the tray to be filed.", ""),
            ("🔁", "The renewal check", "Last year's price beside this year's, and a reminder to compare energy deals before a fixed deal ends.", "")]


# Where each card leads: the tool's own page where it has one, else its place in the demo.
HOME_NEW_LINKS = {"The whole household": "../app/home-people.html", "Shared Costs": "costs.html", "Pets": "../app/home-people.html",
                  "Tax time": "../app/home-tax.html", "Drop here": "../app/home-tray.html", "The renewal check": "contracts.html"}


def home_new() -> str:
    # each card opens what it describes: Shared Costs has its own page, the others their place in the demo
    cards = "".join(f'<a class="card feat reveal pop" href="{HOME_NEW_LINKS[n]}"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></a>' for em, n, d, _ in HOME_NEW)
    shots = "".join(f'<figure class="tool-room reveal"><img src="../assets/shots/{s}.jpg" alt="{e(n)} in Busy Home, with the demo’s example household" width="1280" height="720" loading="lazy"><figcaption class="faint">{e(n)}</figcaption></figure>'
                    for _, n, _, s in HOME_NEW if s)
    return f"""<section class="section" id="new"><div class="wrap">
    <div class="center reveal"><p class="kicker">New in Busy Home 2.1</p><h2 class="big">For a household of any size</h2><p class="lead">Free, like the rest. Juno, in the paid edition, does the boring part of each for you.</p></div>
    <div class="feats">{cards}</div>
    <div class="feats" style="margin-top:18px">{shots}</div>
  </div></section>"""


# The Workshop: the Busy Business page as a place (assets/place.js, rooms from the Busy Studio's
# places/workshop.py). The tour follows one job of the demo's pretend studio (Studio Noor's sign for Café
# Morgenrood) through the shop: the hours, the invoice, paid, the receipts, where you stand. The guide
# (Rivet) comes later; until then the lines float where Rivet will stand. Same step format as HOUSE_STEPS.
WORKSHOP_SWATCHES = (("#FF6B4A", "", "Tomato"), ("#2FD18C", "Georgia, serif", "Mint, classic letters"),
                     ("#9B6BFF", "'Courier New', monospace", "Grape, typewriter"), ("#1E1B2E", "Georgia, serif", "Ink, classic letters"))
WORKSHOP_STEPS = [
    {"id": "front", "title": "The shop front · Brand Kit", "tool": "brand", "kicker": "Brand Kit",
     "say": "Welcome to Studio Noor's workshop. The sign above the door is still blank: shall we paint it?", "move": "Waving",
     "acts": [("sign", "PointingGesture", "Your brand, your colours. Pick one and watch the sign.",
               "<b>🎨 Brand Kit</b><span>Pick the colour and letters for the sign:</span><div class=\"house-swatches\">"
               + "".join(f'<button type="button" class="btn" data-house-do="painted" data-paint="{c}" data-font="{e(f)}"><i style="background:{c}"></i>{e(n)}</button>'
                         for c, f, n in WORKSHOP_SWATCHES) + "</div>", ""),
              ("painted", "Victory", "Looking sharp! The same colours go on your invoices, your email signature and your business cards.",
               "<b>✅ Sign painted</b><span>The same colours and logo on every invoice and quote</span><span>An email signature for every mail app, business cards with a QR code</span>"
               "<button type=\"button\" class=\"btn btn-primary\" data-house-next>🔑 Open up →</button>", "")]},
    {"id": "bench", "title": "Workbench · Time Tracker", "tool": "time", "kicker": "Time Tracker, Project Board & Planner", "h": "Every hour counted, every job on track",
     "p": "One big button for the hours, a board for every job and a planner for the dates. The hours go straight onto the invoice.",
     "task": "Tap the big clock, then the board.", "say": "The workbench. Today: the new sign for Café Morgenrood. Start the clock.",
     "acts": [("clock", "Happy", "The clock's running. Two and a half hours on the Café Morgenrood sign.",
               "<b>⏱️ Signage for Café Morgenrood</b><span>2 h 30 m today · billable</span><span>This week: 11 of 40 planned hours</span>", ""),
              ("board", "Victory", "Into Done it goes, confetti and all. Next: the invoice.",
               "<b>🗂️ Signage for Café Morgenrood</b><ul class=\"house-ticks\"><li data-tick>Measure the walls</li><li data-tick>Three sketch directions</li><li data-tick>Paint the sign</li></ul>"
               "<span>3 of 3 done · the planner moves the install date forward</span>", "confetti")]},
    {"id": "counter", "title": "The counter · Invoices & Quotes", "tool": "invoices", "kicker": "Invoices & Quotes, Client Book", "h": "From hours to paid, in one click",
     "p": "Pick a client and the hours are already there. The maths, the numbering, the PDF, a QR code to pay and the reminder are done for you.",
     "task": "Tap the till, or the client cards.", "say": "The counter. The hours from the workbench are waiting to become an invoice.",
     "acts": [("till", "PointingGesture", "Ding! The hours became an invoice: numbered, VAT added, with a QR code to pay.",
               "<b>🧾 Invoice 2026-014 · Café Morgenrood</b><span>Signage: 2.5 hours × €75 = €187.50</span><span>VAT 21%: €39.38 · <b>total €226.88</b></span>"
               "<span>📱 QR code to pay · reminder set for day 30</span><button type=\"button\" class=\"btn btn-primary\" data-house-do=\"paid\">📱 Sam scans and pays</button>", ""),
              ("paid", "Victory", "Paid! Sam scanned the code. The nicest sound in the shop.",
               "<b>✅ Paid</b><span>€226.88 from Café Morgenrood, two days after sending</span><span>The Money Dashboard knows already</span>", "confetti"),
              ("cards", "Happy", "The client book: what Café Morgenrood paid, what's open, and the little things worth remembering.",
               "<b>📇 Café Morgenrood · Sam Okafor</b><span>Rotterdam · pays within 30 days</span><span>Paid this year: €2,840 · open: €0</span><span>📝 Opening night on the 14th: send flowers</span>", "")]},
    {"id": "office", "title": "Back office · Receipts & Money", "tool": "expenses", "kicker": "Receipts, Money Dashboard & Subscriptions", "h": "See where you stand",
     "p": "Drop a photo of a receipt and it's filed, with the VAT you claim back. The dashboard shows profit, what to put aside and who still owes you, and every little monthly bill is in one place.",
     "task": "Tap the shoebox, then the gauge on the wall.", "say": "The back office. Everyone has a shoebox like that one…",
     "acts": [("shoebox", "Stretch", "Sorted! Every receipt filed, with the VAT you can claim back.",
               "<b>📸 Receipts sorted</b><ul class=\"house-ticks\"><li data-tick>Paint and brushes · €84.20 · materials</li><li data-tick>Oak boards · €126.00 · materials</li>"
               "<li data-tick>Train to Rotterdam · €12.40 · travel</li></ul><span>VAT to claim back: <b>€37.84</b></span>", ""),
              ("gauge", "PointingGesture", "Here's where you stand: profit, what to keep aside, and who still owes you.",
               "<b>📈 This quarter</b><span>Profit so far: €6,420</span><span>Keep aside: €1,180 VAT and €1,350 income tax</span><span>Still to come in: €1,045 from 2 clients</span>"
               "<span>🔁 Subscriptions: €47 a month · one renews in 9 days</span>", "")]},
    {"id": "desk", "title": "Writing desk · Document Maker", "tool": "docs", "kicker": "Document Maker", "h": "Quotes and contracts, filled in",
     "p": "Pick a template and a client. Names, addresses, dates and bank details are filled in; you add the good bits and save a PDF with your logo.",
     "task": "Tap the laptop.", "say": "The writing desk. Café Morgenrood wants lettering on the side window too. A quote?",
     "acts": [("laptop", "Happy", "Names, addresses, dates and bank details: all filled in. Your logo on top.",
               "<b>📝 Quote: window lettering</b><span data-type>Dear Sam, thank you for asking us about lettering for the side window. Below is our quote for the design and two sessions of hand lettering, materials included. Valid until the end of the month. Kind regards, Noor Visser, Studio Noor</span>"
               "<span>📄 Saved as a PDF with your logo</span>", "")]},
    {"id": "stock", "title": "Stockroom · Stock Keeper", "tool": "stock", "kicker": "Stock Keeper", "h": "Never run out halfway through a job",
     "p": "Tap plus and minus as things come in and go out. Busy warns you before the shelf runs empty and keeps a history of every change.",
     "task": "Tap the stack of oak boards.", "say": "The stockroom. Those oak boards go fast.",
     "acts": [("boards", "Stomp", "Three boards out for the sign. Only four left: time to order.",
               "<b>📦 Oak boards</b><span>7 → 4 left (3 for Café Morgenrood)</span><span><b>⚠️ Running low: order 10 before Friday</b></span><span>Every change kept in the history</span>", "")]},
    {"id": "yard", "title": "The yard · Trip Log", "tool": "trips", "kicker": "Trip Log", "h": "Every kilometre counts at tax time",
     "p": "Log a trip in seconds, tap your usual routes, and see what your kilometres are worth at tax time.",
     "task": "Tap the van.", "say": "The yard. The sign's ready: off to Rotterdam!",
     "acts": [("van", "Waving", "Logged! Utrecht to Rotterdam and back, one tap on the usual route.",
               "<b>🚗 Utrecht → Rotterdam · Café Morgenrood</b><span>114 km return, logged in one tap</span><span>Worth <b>€26.22</b> at tax time (€0.23 a km)</span><span>This year: 3,480 km, worth €800.40</span>", "")]},
    {"id": "window", "title": "Shop window · Marketing Studio", "tool": "marketing", "kicker": "Marketing Studio", "h": "Marketing that keeps going",
     "p": "A brand profile, a year plan that's always on, a content calendar, and what your own invoices say about your best clients. Plan it, make it, see what works.",
     "task": "Tap the poster in the window.", "say": "The shop window. What does the street get to see this week?",
     "acts": [("poster", "PointingGesture", "This week's post, in your colours. The calendar already has the next three.",
               "<b>📣 This week: Café Morgenrood opens</b><span>Instagram · Thursday · a photo of the finished sign</span><ul class=\"house-ticks\">"
               "<li data-tick>Next week: behind the scenes of the lettering</li><li data-tick>In two weeks: a customer story</li><li data-tick>In three weeks: open studio day</li></ul>", "show:poster"),
              ("chalkboard", "Happy", "Your own invoices say it: your best clients come through recommendations. So ask for them!",
               "<b>💡 From your invoices</b><span>4 of your 5 best clients came through a recommendation</span><span>Idea: a small thank-you for every referral</span>", "")]},
    {"id": "upstairs", "plate": "olaf", "title": "Upstairs · Olaf", "expert": "olaf",
     "h": "Olaf plans your marketing and does the work with you", "task": "Tap the plan on Olaf's desk.",
     "p": "Upstairs in the Workshop works Olaf: Busy Business's brand consultant. He works out where you stand, makes a plan you can keep up with, checks in every week and does the work with you.",
     "say": "Good evening, I'm Olaf. Rivet runs the shop; I plan how people find it.", "move": "Waving",
     "acts": [("desk", "Thinking>Writing>Nodding", "Studio Noor's next step: be easy to find. Three jobs for this week.",
               "<b>🧭 This week, for Studio Noor</b><span>☐ Opening hours, prices and six photos on your Google listing · 40 min</span>"
               "<span>☐ Ask your last five clients for a review · 20 min</span><span>☐ Two short posts about the new sign · 15 min</span>"
               "<span class=\"faint\">An example. Olaf works from your own business, on your own Claude.</span>", "")]},
    {"id": "end", "plate": "front", "title": "Take the workshop home", "say": "That's the workshop! Take it home: free, for Mac and Windows.", "acts": []},
]
# The order of the tour is the order of what Busy Business is for: grow the brand (the sign, the shop window, Olaf
# upstairs), deliver the work (the workbench), run the money and admin (the counter and the rooms behind it).
WORKSHOP_STEPS = [next(s for s in WORKSHOP_STEPS if s["id"] == i) for i in ("front", "window", "upstairs", "bench", "counter", "office", "desk", "stock", "yard", "end")]
WORKSHOP_DECALS = {"sign": ("Studio Noor", False), "van": ("Studio Noor", True),
                   "poster": ("<b>Now open</b><span>Café Morgenrood</span><span>A new sign by Studio Noor</span>", False)}


def workshop_card(s: dict) -> str:
    """The words of one room of the Workshop, shown in the card next to it."""
    if s.get("expert"):
        return expert_card(s)
    if s["id"] == "front":
        return ('<span class="chip chip-sun">Free · no account · Mac and Windows</span><p class="kicker">Busy Business</p><h1>Be the name people think of first.</h1>'
                f'<p>Brand management for small businesses, from brand strategy to daily operations. Free, and everything stays in your own folder. Walk round the workshop to see how.</p>'
                + hero_doors("download.html", "../app/index.html", '<button type="button" class="btn btn-quiet" data-house-next>Take the tour →</button>', "olaf")
                + '<p class="house-task">👉 Tap the blank sign above the door.</p><div class="house-result" data-result hidden></div>')
    if s["id"] == "end":
        return (f'<p class="kicker">The end of the tour</p><h2>Take the workshop home</h2><p>All 13 tools, free. No account, no subscription, nothing sent to us.</p>'
                f'{app_download("Business", "Busy Business")}<p class="faint"><a href="olaf.html">Want an expert alongside you? Meet Olaf, your brand consultant →</a></p>')
    return (f'<p class="kicker">{e(s["kicker"])}</p><h2>{e(s["h"])}</h2><p>{e(s["p"])}</p><p class="house-task">👉 {e(s["task"])}</p>'
            f'<div class="house-result" data-result hidden></div>'
            # the tour tells the pretend studio's story, so its rooms open the demo on that studio; every other
            # way into the demo opens on Busy itself (website/assets/demo.js)
            f'<p class="house-try"><a href="../app/apps/{s["tool"]}/index.html?example=studio">Try it for real →</a></p>')


# Busy Business in short, and the page's other questions. Both are written into the hand-made page (the "in-short"
# and "faq" blocks) and into its structured data (the "ld" block in its head), so the two always say the same.
BUSINESS_ANSWERS = [
    ("What is Busy Business?", "Busy Business is a free app for Mac and Windows with thirteen tools for a small business: a marketing studio and a brand kit, a project planner and a board, invoices and quotes, time, clients, documents, receipts, a money dashboard, subscriptions, trips and stock. Everything is saved in a folder on your own computer."),
    ("Who is it for?", "Busy Business is for freelancers, shops, makers and small studios of up to about ten people, who run the business themselves and want one place for the brand, the projects and the admin."),
    ("What does it cost?", f"Busy Business is free, with no account and no subscription. Olaf, the AI brand consultant, comes in the paid edition: Busy Business with Olaf, {PRODUCTS['olaf']['price']} once on itch.io."),
    ("Is there AI in the free version?", "No. The free Busy Business has no AI and sends nothing anywhere. Only Olaf, in the paid edition, uses AI: Claude, on your own Claude account."),
    ("Where is my data?", "Busy Business saves plain files in a folder you choose on your own computer. Put the folder in Google Drive, Dropbox or OneDrive for backups and syncing. We have no copy and no way to see it."),
    ("Which languages?", "Busy Business is in English, Dutch, German, Spanish, Italian and Brazilian Portuguese. Invoices, quotes and letters can be made in any of them."),
]
BUSINESS_MORE_FAQ = [
    ("What is Olaf?", f"Olaf is the AI brand consultant in Busy Business with Olaf. He works out where your business stands, makes a 90-day plan, runs your projects with you and prepares the work each step needs: posts, review requests, your newsletter, your local listing. Olaf is built on proven marketing science. {CLAUDE_LINE}"),
    ("What is the difference between the free Marketing Studio and Olaf?", "The Studio gives you the tools to do your own marketing: a brand profile, a year plan, a content calendar and insights from your invoices. You do the work, and there is no AI in it. Olaf is our AI brand consultant, right inside Busy: it works out where your business stands, makes a 90-day plan, checks in with you every week, and does the work each step needs. Both use the same marketing science."),
    ("Do I need Olaf to use the tools?", "No. Every tool, the Marketing Studio included, is free and complete on its own. Olaf is for owners who would rather be guided than figure out their marketing alone."),
    ("Where does my data go when I use Olaf?", "What Olaf reads goes to Anthropic under your own Claude account, and nowhere else. Your files stay in your own folder, and the free tools have no AI."),
    ("Can I use Google Drive?", "Yes. Install Google Drive for desktop and pick a folder inside it. Drive backs it up and keeps it in sync across your computers."),
    ("Which computers?", "Busy Business is an app for Mac and Windows, in beta. Without installing, a folder that runs in Chrome or Edge is there too. The demo on this site shows every tool with a pretend business."),
    ("Can I work on it with my team?", "Share the folder through Google Drive and everyone sees the same clients and invoices. Team Mode is on the workbench."),
    ("Do the invoices meet the rules?", "They include what EU invoices need: numbers that count up, dates, both parties, VAT per rate and your VAT number. Check with your accountant for anything special."),
]


def business_blocks(page: Path) -> None:
    """The generated parts of the hand-made Busy Business page: the film under the hero, Olaf with his worked example
    and the two doors, Busy Business in short, the questions, and the structured data that says the same."""
    put_block(page, "film", film_top("olaf"))
    # The free guide downstairs, the paid expert upstairs, one job done and the two doors: right after the film.
    put_block(page, "experts", '<section class="section"><div class="wrap">' + expert_intro("olaf", "Rivet", "../app/shared/places/workshop/rivet-hello.png", "#upstairs", free="download.html", job=True) + "</div></section>")
    put_block(page, "in-short", in_short("Busy Business", BUSINESS_ANSWERS))
    questions = BUSINESS_ANSWERS + BUSINESS_MORE_FAQ
    # "Busy Business in short" stands right above the questions: the list holds only the ones not answered there (the data carries all).
    put_block(page, "faq", '<div class="faq reveal">' + "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in BUSINESS_MORE_FAQ) + "</div>")
    ld = (jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Busy Business", "applicationCategory": "BusinessApplication",
                  "operatingSystem": "macOS, Windows, ChromeOS (in Chrome or Edge)", "description": "Thirteen free, private tools for small businesses and freelancers.",
                  "url": f"{SITE_URL}/business/index.html", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}})
          + jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Olaf by Busy", "applicationCategory": "BusinessApplication",
                    "operatingSystem": WREN_RUNS_ON, "url": f"{SITE_URL}/business/olaf.html", "description": "The paid AI expert in Busy Business, on the owner’s own Claude.",
                    "offers": {"@type": "Offer", "price": PRODUCTS["olaf"]["amount"], "priceCurrency": "USD", "url": PRODUCTS["olaf"]["url"]}})
          + faq_ld(questions))
    put_block(page, "ld", ld.rstrip("\n"))


def workshop_html() -> str:
    return place_html("workshop", WORKSHOP_STEPS, workshop_card, "The Workshop: a tour of Busy Business", decals=WORKSHOP_DECALS, brand="#FF6B4A",
                      model="../assets/rivet/rivet.glb", height=0.9, expert="olaf")


def put_block(page: Path, name: str, html: str) -> None:
    """Writes a block into a hand-made page, between its <!-- name --> and <!-- /name --> markers."""
    text = page.read_text()
    new, n = re.subn(rf"<!-- {name} -->.*?<!-- /{name} -->", lambda m: f"<!-- {name} -->\n  {html}\n  <!-- /{name} -->", text, count=1, flags=re.S)
    if not n:
        raise SystemExit(f"{page}: the <!-- {name} --> markers are missing")
    page.write_text(new)


# ---------- Busy Kitchen (behind KITCHEN_LIVE) ----------
# Words from kitchen/PLAN-BUSY-KITCHEN-2026-11-17.md and the launch kit (launch-kit-kitchen/). Every number is read from
# the app's own data (kitchen-data.js, recipes-en.js), so the page cannot say more than the app holds. No AI in the app.
KITCHEN_PROMISE = "Bring the world to your table."
KITCHEN_FEEDBACK = "https://busyai.itch.io/busy-kitchen#comments"  # "Tell us how it went" (owner, 18 November 2026: itch.io, in the comments)


def kitchen_data() -> dict:
    """The six kitchens and their dishes as the app has them, and how many house recipes and notes there are."""
    def load(name, var):
        text = (APP / "shared" / name).read_text()
        # the object only: kitchen-data.js goes on with the line that loads the page language's details
        return json.JSONDecoder().raw_decode(text, text.index(f"window.{var} = ") + len(f"window.{var} = "))[0]
    data = load("kitchen-data.js", "BW_KITCHEN")
    recipes = load("kitchen/recipes-en.js", "BW_KITCHEN_RECIPES") if (APP / "shared" / "kitchen" / "recipes-en.js").exists() else {}
    data["recipes"] = sum(1 for r in recipes.values() if r.get("k") == "r")
    data["notes"] = sum(1 for r in recipes.values() if r.get("k") == "n")
    return data


KITCHEN = kitchen_data() if KITCHEN_LIVE else {"kitchens": [], "dishes": [], "recipes": 0, "notes": 0}
KITCHEN_DISHES = f"{len(KITCHEN['dishes']):,}"
KITCHEN_WHAT = (f"{KITCHEN_DISHES} dishes from six kitchens, matched to what's in your fridge. The home cooking of Busy's six "
                "languages, with each kitchen's story, regions and feast days, and a recipe for every dish.")
KITCHEN_TOOLS = [("🍳", "Tonight", "Type what is in your fridge, in any of the six languages, and see what you can cook now, and what needs one thing more. Or travel tonight to one kitchen."),
                 ("🌍", "The six kitchens", "Each kitchen's story, how to say its dishes, its regions, its pantry, how people eat, its calendar and its dishes, with pictures."),
                 ("📅", "Food calendar", "What the six kitchens cook through the year: Sinterklaas, Advent, Semana Santa, Natale, Festa Junina, Thanksgiving and every season."),
                 ("📖", "Recipe Box", "Your own recipes and the family's, with a photo of the handwritten card, the story behind it, and a family cookbook to print."),
                 ("🗓️", "Week Plan & Shopping", "The next two weeks' dinners and the leftovers, and the shopping list that follows, on your phone through your synced folder or printed."),
                 ("🧺", "Pantry", "What is in the fridge, the freezer and the cupboard, with use-by dates. What goes off first comes first.")]
KITCHEN_EXTRAS = [("👩‍🍳", "Cooking mode", "One step at a time, in big letters, with a timer, and a screen that stays on."),
                  ("🔁", "Ingredients abroad", "Can't find speculaas spice or queso fresco where you live? What to use instead."),
                  ("⚖️", "Cups, grams and gas marks", "Fahrenheit and Celsius, fan and conventional ovens, and portions with a + and a −."),
                  ("🛂", "A kitchen passport", "A stamp for every dish you cook, kitchen by kitchen.")]
KITCHEN_ANSWERS = [
    ("What is Busy Kitchen?", f"Busy Kitchen is a free app with the home cooking of six language worlds: {KITCHEN_DISHES} dishes from the Dutch, German, Spanish, Italian, Portuguese and English kitchens, each with its story, its regions, its feast days and a recipe, in English, Dutch, German, Spanish, Italian and Brazilian Portuguese."),
    ("Who is it for?", "Busy Kitchen is for home cooks who want dinner from what is in the fridge, and for anyone curious how families in six language worlds eat: at home, on feast days and through the seasons."),
    ("How does it find dinner?", "Type what is in your fridge, in any of the six languages. Busy Kitchen shows the dishes you can cook now, and the ones that need one or two things more. Salt, oil and the other basics are taken as read."),
    ("Are the recipes any good?", "Busy wrote every recipe in its own words, from how the dish is made at home in its region, and checked each one against written rules: the amounts, the oven, the allergens and how to know meat is cooked through. Nobody at Busy has cooked them all yet, and each recipe says so. Tell us how it went, and the recipes get better from what you tell us."),
    ("What does it cost?", f"Nothing. Busy Kitchen is free, with no account and no AI. Busy Kitchen with Sal, your chef, is {SAL['price']} once on itch.io, and Sal works on your own Claude."),
    ("Is there AI in the free version?", "No. The free Busy Kitchen has no AI and sends nothing anywhere: it matches your fridge to the dishes on your own computer. Only Sal, in the paid edition, uses AI: Claude, on your own Claude account. The pictures of the kitchens' places and customs were made with AI, and the app says so beside them."),
    ("Where are my recipes?", "In a folder you choose on your own computer, as plain files. Put it in Google Drive, Dropbox, OneDrive or iCloud Drive and the shopping list reaches your phone. Nothing is sent to us.")]
KITCHEN_MORE_FAQ = [
    ("Which kitchens are in it?", "The Dutch kitchen (the Netherlands, Flanders, and Surinamese and Indonesian-Dutch home cooking), the German (Germany, Austria and Switzerland), the Spanish (Spain and Latin America), the Italian (all twenty regions), the Portuguese (Brazil and Portugal) and the English (Britain, Ireland and the United States)."),
    ("Can I add my own recipes?", "Yes. The Recipe Box keeps your own and your family's recipes, with a photo, the story and the country it came from. Every house recipe can go into it too, as your own copy to change. Print them all as a family cookbook."),
    ("What about allergies?", "Each recipe lists what it contains from the EU's 14 allergens, hidden ones such as stock and soy sauce included. It never says a dish is free of anything. Always check the labels of what you buy."),
    ("What if I can't find an ingredient?", "Each kitchen has its ingredients abroad: what to use instead, close and never quite the same. A missing ingredient in Tonight shows its swap."),
    ("Are the pictures real?", "The pictures of the kitchens' places and customs are made with AI, to show each kitchen as it lives, and the app says so beside them."),
    ("Will the recipes keep changing?", "No. The collection is fixed and complete. We improve a recipe when people tell us how it went."),
    ("Why six kitchens?", "Busy speaks six languages, and each language has a kitchen behind it. So Busy Kitchen is a cultural kitchen: the dishes those languages grew up with, at home and on their feast days.")]
KITCHEN_START_HERE = """Busy Kitchen - free: 1,886 dishes from six kitchens, matched to what's in your fridge.

1. Move this Busy Kitchen folder somewhere you will find it again, like Documents.
2. Double-click kitchen.html. It opens in your browser. Use Chrome or Edge: they can
   save your kitchen folder as files (Safari and Firefox cannot).
3. Pick a folder for your files: your recipes, week plan, shopping list and pantry.
   Put it inside Google Drive, Dropbox, OneDrive or iCloud Drive and the shopping list reaches your phone.

Your data stays on your computer and is never sent to us. No account, no AI.
The house recipes are not yet cooked by us: tell us how it went, in the comments on
https://busyai.itch.io/busy-kitchen

More: https://busy.com.ai/kitchen/
""".replace("1,886", KITCHEN_DISHES)


def make_kitchen_zip() -> None:
    out = SITE / "downloads" / "busy-kitchen.zip"
    if not KITCHEN_LIVE:
        if out.exists():
            out.unlink()
        return
    out.parent.mkdir(exist_ok=True)
    files = suite_zip_files("kitchen") + [APP / "shared" / "pdf.js"]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy Kitchen/START HERE.txt", KITCHEN_START_HERE)
        for p in dict.fromkeys(files):
            name = (Path("Busy Kitchen") / p.relative_to(APP)).as_posix()
            text = zip_text(p, files)
            if text is not None:
                z.writestr(name, text)
            else:
                z.write(p, name)
    print(f"website/downloads/{out.name}: {len(files) + 1} files, {out.stat().st_size // 1024} KB")


def kitchen_pic(pid: str, prefix: str) -> str:
    return f"{prefix}app/shared/kitchen/pics/{pid}.jpg"


def kitchen_img(pid: str, alt: str, prefix: str, sizes: str, lazy: bool = True) -> str:
    """One of Busy Kitchen's own pictures on its page: the app's JPEG (1280 wide, about 300 KB), and before it, where
    tools/webp.py has made them (assets/kitchen/), WebP copies 640 and 1280 wide. `sizes` says how wide the picture
    shows, and counts a phone's as half its screen on purpose: a phone then takes the 640 one, which on its sharp
    screen is still nearly two picture points to the point, at a fraction of the weight."""
    img = f'<img src="{kitchen_pic(pid, prefix)}" alt="{e(alt)}" width="1280" height="714"' + (' loading="lazy">' if lazy else ' fetchpriority="high">')
    if not all((SITE / "assets" / "kitchen" / f"{pid}{w}.webp").exists() for w in ("", "-640")):
        return img
    at = f"{prefix}assets/kitchen/{pid}"
    return f'<picture><source srcset="{at}-640.webp 640w, {at}.webp 1280w" sizes="{sizes}" type="image/webp">{img}</picture>'


def kitchen_page(tools: list) -> str:
    """Busy Kitchen's front page: the promise, the six kitchens, the fridge, the recipes and how they were made, free."""
    pre = "../"
    feats = "".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .05:.2f}s"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for i, (em, n, d) in enumerate(KITCHEN_TOOLS))
    extras = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in KITCHEN_EXTRAS)
    answers = "".join(f'<div class="card feat reveal pop"><h3>{e(q)}</h3><p>{e(a)}</p></div>' for q, a in KITCHEN_ANSWERS)
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in KITCHEN_ANSWERS + KITCHEN_MORE_FAQ)
    count = {k["id"]: sum(1 for d in KITCHEN["dishes"] if d["k"] == k["id"]) for k in KITCHEN["kitchens"]}
    kitchens = "".join(f'<a class="card kitchen-tile reveal pop" href="{pre}app/apps/kitchens/index.html#{k["id"]}">'
                       f'{kitchen_img(k["pictures"][0]["id"], k["pictures"][0]["title"], pre, "(max-width: 580px) 50vw, 400px")}'
                       f'<span class="txt"><b>{k["flag"]} {e(k["name"])}</b><span>{e(k["line"])}</span><small>{count[k["id"]]} dishes</small></span></a>'
                       for k in KITCHEN["kitchens"] if k["pictures"])
    desc = f"{KITCHEN_DISHES} dishes from six kitchens, matched to what's in your fridge. Free, no account, no AI, in six languages."
    ld = (jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Busy Kitchen", "applicationCategory": "LifestyleApplication",
                  "operatingSystem": "macOS, Windows, ChromeOS (in Chrome or Edge)", "description": desc, "url": f"{SITE_URL}/kitchen/index.html",
                  "inLanguage": ["en", "nl", "de", "es", "it", "pt-BR"], "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}})
          + jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Sal by Busy", "applicationCategory": "LifestyleApplication",
                    "operatingSystem": WREN_RUNS_ON, "url": f"{SITE_URL}/kitchen/sal.html", "description": "The paid AI expert in Busy Kitchen, on the owner’s own Claude.",
                    "offers": {"@type": "Offer", "price": SAL["amount"], "priceCurrency": "USD", "url": SAL["url"]}})
          + jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                    "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in KITCHEN_ANSWERS + KITCHEN_MORE_FAQ]}))
    hero = KITCHEN["kitchens"][3]["pictures"][0] if len(KITCHEN["kitchens"]) > 3 else {"id": "", "title": ""}
    steps = [("🍳", "Open Busy Kitchen", "In your browser, straight away, or from a folder you download. No account, no AI."),
             ("📁", "Your own folder", "Choose a folder for your recipes, week plan, shopping list and pantry. In a synced folder, the list reaches your phone."),
             ("🧊", "Tell it what you have", "Type what is in your fridge, in your own language, and see what you can cook tonight."),
             ("🌍", "Travel tonight", "Or pick a kitchen, read its story and cook one of its dishes. Stamp your passport.")]
    how = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in steps)
    return f"""{head("Busy Kitchen: bring the world to your table", desc, "kitchen/index.html", pre, extra=ld, image="og-kitchen.png")}
<body class="site app-sun">
{nav(pre, ("🍳 Open free", "#get"))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--sun);right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <span class="em big" style="--c:var(--sun)">🍳</span>
        <p class="kicker">Busy Kitchen · free, private, six languages</p>
        <h1>{e(KITCHEN_PROMISE)}</h1>
        <p class="lead">{e(KITCHEN_WHAT)}</p>
        <div class="ctas"><a class="btn btn-primary btn-big" href="{pre}app/kitchen.html">🍳 Open it in your browser</a><a class="btn btn-big" href="#get">⬇️ Download free</a></div>
        <p class="note">Free · No account · No AI · Nothing is sent to us · English, Nederlands, Deutsch, Español, Italiano, Português · Pictures made with AI · With Sal, your chef: {SAL["price"]} once</p>
      </div>
      <div class="stage solo reveal from-right"><figure class="tool-room">{kitchen_img(hero["id"], hero["title"], pre, "(max-width: 600px) 50vw, (max-width: 900px) calc(100vw - 32px), 560px", lazy=False)}</figure></div>
    </div>
  </section>
  {film_top("sal", pre)}
  <section class="section" id="in-short"><div class="wrap">
    <div class="center reveal"><h2 class="big">Busy Kitchen in short</h2></div>
    <div class="feats">{answers}</div>
  </div></section>
  <section class="section" id="kitchens"><div class="wrap">
    <div class="center reveal"><h2 class="big">Six languages, six kitchens</h2><p class="lead">The dishes each language grew up with, at home and on its feast days: {KITCHEN_DISHES} in all.</p></div>
    <div class="kitchen-tiles">{kitchens}</div>
    <p class="center faint" style="margin-top:12px">Pictures made with AI, to show each kitchen's places and customs.</p>
  </div></section>
  <section class="section" id="tools"><div class="wrap">
    <div class="center reveal"><h2 class="big">What's in your fridge, and what's for dinner</h2><p class="lead">Type what you have in any of the six languages: aardappelen, Kartoffeln, patatas or potatoes all find the same dishes. <a href="{pre}app/kitchen.html">Try it now →</a></p></div>
    <div class="feats">{feats}</div>
    <div class="feats" style="margin-top:18px">{extras}</div>
  </div></section>
{expert_strip("kitchen")}
  <section class="section" id="recipes"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🧪</span>
      <div><p class="kicker">{KITCHEN["recipes"]:,} recipes and {KITCHEN["notes"]} notes, in six languages</p><h2>A recipe for every dish, not yet cooked by us</h2>
      <p>Busy wrote every recipe in its own words, the way the dish is made at home in its region, and checked each one against written rules: the amounts, the oven, the EU's 14 allergens and how to know meat is cooked through. For a ham, a cheese or a café drink there is a short note on how to enjoy it instead. Nobody at Busy has cooked them all yet, and each recipe says so.</p>
      <p style="margin-top:10px">Cooked one? <a class="out" href="{KITCHEN_FEEDBACK}" target="_blank" rel="noopener">Tell us how it went, in the comments <span aria-hidden="true">↗</span></a></p></div></div>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🔒</span>
      <div><p class="kicker">Your kitchen stays yours</p><h2>Everything in your own folder</h2>
      <p>Your recipes, the family's cards, the week plan and the pantry are kept as plain files in a folder you choose. There is no Busy account and no Busy server, so there is nothing to hack and nothing to sell.</p></div></div>
  </div></section>
  <section class="section" id="get"><div class="wrap">
    <div class="center reveal"><h2 class="big">Get Busy Kitchen</h2><p class="lead">Free, the whole kitchen. No account, no subscription, no AI, nothing sent to us.</p></div>
    <div class="feats">{how}</div>
    <div class="center" style="margin-top:22px"><div class="row-flex" style="justify-content:center"><a class="btn btn-primary btn-big" href="{pre}app/kitchen.html">🍳 Open it in your browser</a><a class="btn btn-big" href="{pre}downloads/busy-kitchen.zip" download>⬇️ Download (zip)</a></div>
      <p class="faint" style="margin-top:10px">The download runs in Chrome or Edge, on Mac, Windows, ChromeOS and Linux: unzip it and open kitchen.html.</p>
      <p class="faint" style="margin-top:10px">Want the chef too? <a class="out" href="{SAL["url"]}" target="_blank" rel="noopener">{SAL["name"]} · {SAL["price"]} <span aria-hidden="true">↗</span></a></p>
      {claude_line("center")}</div>
  </div></section>
  <section class="section" id="sal"><div class="wrap">
    <div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🧂</span>
      <div><p class="kicker">Sal by Busy · {SAL["price"]} once</p><h2>Sal, your chef</h2>
      <p>Sal knows all six kitchens. He cooks with what's left when no recipe fits, plans your week around who is home, the allergies and what goes off first, and turns a photo of a handwritten family recipe into a recipe in your Recipe Box. He prepares; you decide.</p>
      <ul class="get-list" style="margin-top:12px"><li>Cook with what's left, and leftovers into lunch</li><li>Plan my week, a shopping run, guests are coming</li><li>Make it vegetarian, gluten-free or for two</li><li>Fix this dish, and teach me a technique</li></ul>
      <p style="margin-top:10px" class="faint">Sal never gives medical or diet advice, and every recipe he creates is marked new and not yet cooked by us.</p>
      <p class="row-flex" style="margin-top:14px">{itch_button("sal", "Get Busy Kitchen with Sal")} <a class="btn" href="sal.html">Meet Sal</a></p>
      {claude_line()}</div></div>
    {one_job("sal")}
  </div></section>
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{faq}</div>
  </div></section>
  <section class="final">
    <h2 class="reveal pop">{e(KITCHEN_PROMISE)}</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">{KITCHEN_DISHES} dishes, six kitchens, one fridge. Free.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px"><a class="btn btn-big btn-primary" href="{pre}app/kitchen.html">🍳 Open it in your browser</a>{itch_button("sal", "With Sal", big=True)}</div>
    {claude_line()}
  </section>
</main>
{footer(pre, tools)}
<script src="{pre}assets/site.js"></script>
</body>
</html>
"""


def kitchen_suite_card() -> str:
    return (f'<a class="card suite reveal pop" href="kitchen/" style="--c:var(--sun);transition-delay:.25s">\n'
            f'          <span class="e">🍳</span><h3>Busy Kitchen</h3><span class="d">{e(KITCHEN_PROMISE)}</span>\n'
            f'          <ul><li>{KITCHEN_DISHES} dishes from six kitchens</li><li>Matched to what is in your fridge</li><li>A recipe for every dish, in six languages</li></ul>\n'
            f'          <span class="foot"><span class="chip chip-sun">New · {len(KITCHEN_TOOLS)} tools</span><span class="expert-chip sal">🧂 With Sal · {SAL["price"]}</span></span>\n'
            f'        </a>')


def kitchen_expert_card() -> str:
    """Sal among the experts on the homepage, only while Busy Kitchen is live. He has no drawn mark yet: the salt shaker stands in."""
    return (f'<a class="card expert sal reveal from-left" href="{EXPERT_PAGE["sal"]}"><span class="expert-emoji" aria-hidden="true">🧂</span>\n'
            f'          <span><b>Sal by Busy</b><span>Your chef. He cooks with what is left, plans your week and reads the family’s handwritten recipes. He prepares; you decide.</span><span class="expert-chip sal">{SAL["name"]} · {SAL["price"]}</span></span></a>')


def kitchen_footer(prefix: str) -> str:
    return (f'<p style="margin-top:22px"><b>🍳 Busy Kitchen</b></p><ul><li><a href="{prefix}kitchen/index.html#tools">What is in your fridge</a></li>'
            f'<li><a href="{prefix}kitchen/index.html#kitchens">The six kitchens</a></li><li><a href="{prefix}app/kitchen.html">Open it free</a></li>'
            f'<li><a href="{prefix}kitchen/sal.html">🧂 Sal by Busy</a></li><li><a href="{SAL["url"]}" target="_blank" rel="noopener">With Sal · {SAL["price"]} ↗</a></li></ul>')


def kitchen_update() -> dict:
    """Busy Kitchen's entry in What's new, only while it is live (like Busy Rentals'), dated the day the switch went on."""
    rec = json.loads(DATES_FILE.read_text()) if DATES_FILE.exists() else {}
    day = LAUNCH_DAYS.get("kitchen-1.0") or (rec.get("kitchen/index.html") or [None, date.today().isoformat()])[1]   # the launch day: the page's own date moves with every edit
    return {"version": "Kitchen 1.0", "id": "kitchen-1.0", "date": day, "title": KITCHEN_PROMISE,
            "items": [KITCHEN_WHAT, *([n, d] for _, n, d in KITCHEN_TOOLS), dict(KITCHEN_ANSWERS)["Are the recipes any good?"], dict(KITCHEN_ANSWERS)["What does it cost?"]]}


def kitchen_llms(b: str) -> list:
    return ["", "## Busy Kitchen: free home cooking from six kitchens", "",
            f"- [Busy Kitchen]({b}/kitchen/index.html): {KITCHEN_WHAT} Free, no account, no AI, in six languages. {KITCHEN['recipes']:,} house recipes and {KITCHEN['notes']} notes, "
            "written by Busy and checked against written rules (amounts, oven, the EU's 14 allergens, doneness), marked \"not yet cooked by us\".",
            f"- [Get Busy Kitchen]({b}/kitchen/index.html#get): runs in Chrome or Edge, online at {b}/app/kitchen.html or from a downloaded folder (a zip), on Mac, Windows, ChromeOS and Linux. "
            f"Feedback in the comments on {KITCHEN_FEEDBACK.split('#')[0]}.",
            f"- [What it does]({b}/kitchen/index.html#tools): " + " ".join(f"{n}: {d}" for _, n, d in KITCHEN_TOOLS),
            f"- [Sal, the chef]({b}/kitchen/sal.html): knows all six kitchens; cooks with what's left when no recipe fits, plans the week around who is home, the allergies and what goes off first, "
            "and turns a photo of a handwritten family recipe into a recipe in the Recipe Box. He prepares, the owner decides; never medical or diet advice. "
            f"In Busy Kitchen with Sal, {SAL['price']} once on itch.io ({SAL['url']}), {ON_OWN_CLAUDE}."]


def kitchen_llms_full(b: str) -> list:
    out = ["# Busy Kitchen: the cultural kitchen of six languages", "", f"Page: {b}/kitchen/index.html", "", KITCHEN_WHAT, "", "## Tools", ""]
    out += [f"- {n}: {d}" for _, n, d in KITCHEN_TOOLS + KITCHEN_EXTRAS]
    out += ["", "## Questions", ""] + [f"Q: {q}\nA: {a}\n" for q, a in KITCHEN_ANSWERS + KITCHEN_MORE_FAQ]
    return out


def put_switched_block(page: Path, name: str, html: str, before: str = "", after: str = "") -> None:
    """A block that is on a hand-made page only while its switch is on. Off: the block and its markers are gone, so the
    page carries no trace of it. On: the block stands between its markers, right before (or after) a line that is
    always there."""
    text = re.sub(rf"[ \t]*<!-- {name} -->.*?<!-- /{name} -->\n?", "", page.read_text(), flags=re.S)
    if html:
        block = f"        <!-- {name} -->\n        {html}\n        <!-- /{name} -->\n"
        m = re.search(before or after, text, flags=re.S)
        if not m:
            raise SystemExit(f"{page}: the place for the {name} block is missing")
        at = text.rfind("\n", 0, m.start()) + 1 if before else text.index("\n", m.end()) + 1
        text = text[:at] + block + text[at:]
    page.write_text(text)


def put_place(page: Path, html: str) -> None:
    """Writes a place into a hand-made page, between its <!-- place --> and <!-- /place --> markers."""
    src = page.read_text()
    a, b = src.index("<!-- place -->") + len("<!-- place -->"), src.index("<!-- /place -->")
    page.write_text(src[:a] + "\n  " + html + "\n  " + src[b:])


# The Glasshouse: the Busy Growth page as a place (assets/place.js, rooms from the Busy Studio's
# places/glasshouse.py). You climb from the roots (the Library) to the roof garden (the weekly review),
# following the demo's pretend person, Lena, a customer service lead moving into data analysis. The guide
# (Pim) comes later; until then the lines float where Pim will stand. Same step format as HOUSE_STEPS.
GLASSHOUSE_STEPS = [
    {"id": "foot", "title": "The Glasshouse", "say": "Welcome to the Glasshouse. Ring the bell: we climb from the roots to the roof.", "move": "Waving",
     "acts": [("bell", "Waving", "Ding! Up we go, one floor at a time.", "", "next")]},
    {"id": "roots", "title": "The roots · Library", "tool": "library", "kicker": "Library", "h": "Everything you learn, findable",
     "p": "Files, links and notes from everything you read and learn, tagged and searchable down to the words inside a PDF.",
     "task": "Tap the shelf.", "say": "The roots: everything Lena reads ends up here.",
     "acts": [("shelf", "PointingGesture", "Tagged and findable. Search 'SQL' and three things light up.",
               "<b>📚 A friendly guide to SQL window functions</b><span>Tags: SQL · data analysis</span><span>🔎 'SQL' finds 3 things: a course, an article and her notes</span>", "")]},
    {"id": "potting", "title": "Potting bench · Learning planner", "tool": "learning", "kicker": "Learning planner", "h": "Plant a course, watch it grow",
     "p": "Courses, books and projects with goals, dates and the hours a week you can give them.",
     "task": "Tap the seed tray.", "say": "The potting bench: every course starts as a seed.",
     "acts": [("tray", "Happy", "Planted: three hours a week, done before the summer.",
               "<b>🗓️ SQL for data analysis</b><span>3 hours a week · 40% done</span><span><b>Done by 12 December</b> at this pace</span>", "show:label")]},
    {"id": "trellis", "title": "The trellis · Skills map & Wins", "tool": "skills", "kicker": "Skills map & Wins log", "h": "Every skill with its proof",
     "p": "What you can do and how well, with the proof behind it. Wins go in as they happen, ready for your CV and your next review.",
     "task": "Tap the jar of wins, then the trellis.", "say": "The trellis: skills grow here, and every one needs proof.",
     "acts": [("jar", "Victory", "A win from the jar: three hours of work cut to twenty minutes.",
               "<b>🏆 Cut the weekly ticket report from 3 hours to 20 minutes</b><span>March · at Fietsplan</span>"
               "<button type=\"button\" class=\"btn btn-primary\" data-house-do=\"trellis\">🌿 Tie it to a skill</button>", ""),
              ("trellis", "Backflip", "Tied to Excel as proof. The skill grows a leaf.",
               "<b>🧠 Excel</b><span>Level 3 → 4 · proof: the three-hour report</span><span>SQL, Data visualisation and Python are growing too</span>", "show:skill")]},
    {"id": "lookout", "title": "The lookout · Job tracker", "tool": "jobs", "kicker": "Job tracker", "h": "Paste an ad, see where you stand",
     "p": "Paste an ad and it's on your board: the skills it asks for, the words your CV misses, who you know there, and follow-ups that don't slip.",
     "task": "Tap an ad on the line.", "say": "The lookout: from up here you see every job on the line.",
     "acts": [("ad", "PointingGesture", "Northwind wants a data analyst. And Lena knows someone there.",
               "<b>🗂️ Data analyst · Northwind</b><span>Matches 7 of 9 skills · your CV misses 'Power BI'</span><span>🤝 You know Bram Peters there</span><span>⏰ Follow up on Tuesday</span>", "")]},
    {"id": "print", "title": "The print room · CV & stories", "tool": "cv", "kicker": "CV and LinkedIn builder, Interview story bank", "h": "A CV from what you can prove",
     "p": "CVs and cover letters from your real skills and wins, a CV check, and your LinkedIn profile from the same facts. Your best stories wait for the interview.",
     "task": "Tap the press, or the tapes.", "say": "The print room: everything from the floors below comes together here.",
     "acts": [("press", "Penguin", "Printed: the skills and wins from downstairs, nothing made up.",
               "<b>📄 Data analyst CV</b><span>Customer service lead moving into data analysis</span><span>✓ 6 skills with proof · ✓ 3 wins · ✓ fits on one page</span><span>💼 The same facts as LinkedIn text, ready to paste</span>", ""),
              ("tape", "Happy", "The interview story for 'tell me about a time you improved something'.",
               "<b>🎤 The three-hour report</b><span>Situation, task, action, result: 3 hours became 20 minutes</span><span>Proves: Excel, SQL, process</span>", "")]},
    {"id": "bridge", "title": "The rope bridge · Contacts", "tool": "contacts", "kicker": "Contacts", "h": "The people in your corner",
     "p": "The people who help you along, your LinkedIn connections included, with a reminder when it's time to catch up.",
     "task": "Tap the lantern.", "say": "The rope bridge to the next tower: people.",
     "acts": [("lantern", "Tightrope", "The lantern glows: it's been three months since Bram.",
               "<b>🤝 Bram Peters · Senior data analyst, Northwind</b><span>Last spoke: 3 months ago</span><span><b>Catch up this week</b> · and he works where you applied</span>", "")]},
    {"id": "roof", "title": "The roof garden · Weekly review", "tool": "review", "kicker": "Weekly review", "h": "Ten minutes on Friday",
     "p": "What moved, what was hard, what's next. Ten minutes at the end of the week keep the whole tower growing.",
     "task": "Tap the bench.", "say": "The roof garden. Friday, sunset, ten minutes.",
     "acts": [("bench", "Victory", "That was a good week.",
               "<b>🪞 This week</b><ul class=\"house-ticks\"><li data-tick>Moved: SQL course to 40%</li><li data-tick>Hard: finding time on Wednesdays</li><li data-tick>Next: apply to Northwind, catch up with Bram</li></ul>", "confetti")]},
    {"id": "upstairs", "plate": "ivy", "title": "The top · Ivy", "expert": "ivy",
     "h": "Ivy turns what you did into proof", "task": "Tap Ivy's desk.",
     "p": "At the top of the Glasshouse works Ivy: Busy Growth's career coach. She reads your library, skills and wins, and helps you learn, prove it and land the job, without inventing anything.",
     "say": "Hi, I'm Ivy. Pim shows you the floors; I help you climb them. Show me your wins.", "move": "Waving",
     "acts": [("desk", "Thinking>Writing>Nodding", "Three wins from the jar, three lines for your CV. All true, all yours.",
               "<b>✨ From your wins to your CV</b><span>• Cut the weekly ticket report from 3 hours to 20 minutes with Excel and SQL</span>"
               "<span>• Trained four colleagues on the new support dashboard</span><span>• Brought the first-reply time down to under 2 hours</span>"
               "<span class=\"faint\">An example. Ivy works from your own wins, on your own Claude.</span>", "")]},
    {"id": "end", "plate": "foot", "title": "Take the Glasshouse home", "say": "That's the climb! Take it home: free, for Mac and Windows.", "acts": []},
]
GLASSHOUSE_DECALS = {"label": ("SQL · 12 Dec", False), "skill": ("Excel ★4", False)}


def glasshouse_card(s: dict) -> str:
    if s.get("expert"):
        return expert_card(s)
    if s["id"] == "foot":
        return ('<span class="chip chip-mint">Free · no account · Mac and Windows</span><p class="kicker">Busy Growth</p><h1>Know what you’re worth. Say it well.</h1>'
                '<p>A personal growth tool: what you learn, what you achieve, and how you tell it. For your next review, your next raise and your next job. Climb the Glasshouse to see how.</p>'
                + hero_doors("#get", "../app/growth.html", '<button type="button" class="btn btn-quiet" data-house-do="bell">🔔 Ring the bell</button>', "ivy")
                + '<div class="house-result" data-result hidden></div>')
    if s["id"] == "end":
        return (f'<p class="kicker">The top of the climb</p><h2>Take the Glasshouse home</h2><p>All {len(GROWTH_TOOLS)} tools, free. No account, no subscription, nothing sent to us.</p>'
                f'{app_download("Growth", "Busy Growth")}<p class="faint"><a href="ivy.html">Want a coach alongside you? Meet Ivy →</a></p>')
    return (f'<p class="kicker">{e(s["kicker"])}</p><h2>{e(s["h"])}</h2><p>{e(s["p"])}</p><p class="house-task">👉 {e(s["task"])}</p>'
            f'<div class="house-result" data-result hidden></div>'
            f'<p class="house-try"><a href="../app/apps/{s["tool"]}/index.html">Try it for real →</a></p>')


# The Puzzle Parlour: the Busy Games page as a place (rooms from the Busy Studio's places/parlour.py). A
# kiosk with today's puzzles, then one room per game, with a board on the wall where the page draws a small
# solved puzzle when you tap it.
def _grid(cells, cls):
    """A small square puzzle board: * a star, S a sun, G a grape, a digit a number, . an empty cell."""
    n = int(len(cells) ** 0.5)
    kinds = {"*": "star", "S": "sun", "G": "grape"}
    return (f'<div class="mini {cls}" style="--n:{n}">'
            + "".join(f'<i class="{kinds.get(c, "num" if c.isdigit() else "")}">{c if c.isdigit() else ""}</i>' for c in cells) + "</div>")


PARLOUR_BOARDS = {
    "stars": _grid("*....." "..*..." "....*." ".*...." "...*.." ".....*", "mini-stars"),
    "duo": _grid("SGSGGS" "GSGSSG" "SSGGSG" "GGSSGS" "SGGSGS" "GSSGSG", "mini-duo"),
    "trail": _grid("1..2.." "......" "..3..." "....4." "......" "5....6", "mini-trail"),
    "six": _grid("123456" "456123" "231564" "564231" "312645" "645312", "mini-six"),
}
PARLOUR_DECALS = {"today": ("<b>Today's puzzles</b><span>Stars · Duo · Trail · Six</span>", True), **{k: (v, False) for k, v in PARLOUR_BOARDS.items()}}
PARLOUR_STEPS = [
    {"id": "kiosk", "title": "The puzzle kiosk", "say": "Four new puzzles every day. Pick a door, or tap the board for today's.",
     "acts": [("today", "", "Today's four, the same for everyone. Gentle on Monday, hardest at the weekend.", "", "next")]},
    *[{"id": g["id"], "title": f'{dict(stars="The star room", duo="The café corner", trail="The map room", six="The study")[g["id"]]} · {g["name"]}',
       "game": g, "say": dict(stars="The star room. One star in every row, column and colour patch.", duo="The café corner. Suns and grapes, half and half.",
                              trail="The map room. One line through every cell.", six="The study. Sudoku, on a smaller board.")[g["id"]],
       "acts": [("board", "", "Solved! Every puzzle has exactly one answer.", f'<b>{g["emoji"]} {e(g["name"])} · solved</b><span>{e(g["rules"][0])}</span>'
                 f'<a class="btn btn-primary" href="{g["id"]}.html">Play today\'s {e(g["name"])} →</a>', f'show:{g["id"]}')]} for g in GAMES],
    {"id": "end", "plate": "kiosk", "title": "Take the Parlour home", "say": "That's the Parlour! Take it home: free, for Mac and Windows.", "acts": []},
]


def parlour_card(s: dict) -> str:
    if s["id"] == "kiosk":
        return ('<span class="chip chip-sun">Free · a new puzzle every day</span><h1>Brain breaks 🧩</h1>'
                f'<p>Four free logic puzzles. A new one every day, and {GAME_LEVELS:,} levels each when you want more. Make your coffee break fun again.</p>'
                '<div class="row-flex"><button type="button" class="btn btn-primary" data-house-do="today">🗓️ Today\'s puzzles</button><a class="btn" href="#games">Play now</a></div>'
                '<span class="streak" data-streak></span><div class="house-result" data-result hidden></div>')
    if s["id"] == "end":
        return (f'<p class="kicker">The end of the tour</p><h2>Take the Parlour home</h2><p>All four games and {GAME_LEVELS:,} levels each, free, offline, your streak kept.</p>'
                f'{app_download("Games", "Busy Games")}')
    g = s["game"]
    return (f'<p class="kicker">{e(g["classic"])}</p><h2>{e(g["name"])}</h2><p>{e(g["lead"])}</p><p class="house-task">👉 Tap the board on the wall.</p>'
            f'<div class="house-result" data-result hidden></div>'
            f'<p class="house-try"><a href="{g["id"]}.html">Play {e(g["name"])} →</a></p>')


# Busy Street: the homepage as a place (rooms from the Busy Studio's places/street.py). One evening street with
# every suite as a building; tap one for its close-up, then go in. Upstairs a light is on for each paid expert.
# No guide here: each suite has its own on its own page.
def street_steps() -> list:
    ivy = f'<a class="btn" href="{EXPERT_PAGE["ivy"]}">Meet Ivy →</a>'
    juno = f'<a class="btn" href="{EXPERT_PAGE["juno"]}">Meet Juno →</a>'
    return [
        {"id": "wide", "title": "Busy Street", "say": "",
         "acts": [("shop", "", "The Workshop: Busy Business.", "", "to:shop"), ("glass", "", "The Glasshouse: Busy Growth.", "", "to:glass"),
                  ("house", "", "Tuck's house: Busy Home.", "", "to:house"), ("kiosk", "", "The puzzle kiosk: Busy Games.", "", "to:kiosk"),
                  ("olaf", "", "Someone's working late at the Workshop…",
                   '<img class="expert-shot" src="assets/experts/olaf-card.jpg" alt="Olaf in his study above the Workshop" loading="lazy"><b>💜 Olaf works upstairs</b><span>Your brand consultant · ' + PRODUCTS["olaf"]["price"] + '</span><a class="btn" href="business/olaf.html">Meet Olaf →</a>', ""),
                  ("ivy", "", "A green light at the top of the Glasshouse…",
                   f'<img class="expert-shot" src="assets/experts/ivy-card.jpg" alt="Ivy at the top of the Glasshouse" loading="lazy"><b>🌿 Ivy works at the top</b><span>Your career coach · {PRODUCTS["ivy"]["price"]}</span>{ivy}', ""),
                  ("juno", "", "A light in Tuck's gable…",
                   f'<img class="expert-shot" src="assets/experts/juno-card.jpg" alt="Juno in the gable room of Tuck\'s house" loading="lazy"><b>🧡 Juno works in the attic</b><span>Your household assistant · {PRODUCTS["juno"]["price"]}</span>{juno}', "")]},
        {"id": "shop", "title": "The Workshop · Busy Business", "kicker": "Busy Business", "h": "Be the name people think of first.",
         "p": "Brand management for small businesses, from brand strategy to daily operations: your brand, your marketing, and every quote, invoice and project that carries your name.",
         "task": "Pull up the shutter.", "say": "The Workshop. Somebody's still working…",
         "acts": [("shutter", "", "Open! Come in and walk round the shop.",
                   '<b>🛠️ The Workshop is open</b><span>Follow one job from the workbench to the money in the bank.</span><a class="btn btn-primary" href="business/index.html">Walk round the Workshop →</a>', "enter")]},
        {"id": "glass", "title": "The Glasshouse · Busy Growth", "kicker": "Busy Growth", "h": "Know what you’re worth. Say it well.",
         "p": "For your next review, your next raise and your next job. You do the growing. Busy keeps the record and finds the words.",
         "task": "Tap the ladder.", "say": "The Glasshouse. You climb it one floor at a time.",
         "acts": [("ladder", "", "Up we go: from the roots to the roof garden.",
                   '<b>🌱 Climb the Glasshouse</b><span>From what you know to the job you want, one floor at a time.</span><a class="btn btn-primary" href="growth/index.html">Climb the Glasshouse →</a>', "enter")]},
        {"id": "house", "title": "Tuck's house · Busy Home", "kicker": "Busy Home", "h": "Get your evenings back.",
         "p": "More time with the people you love. Busy Home takes care of the boring part: the contracts, the renewals, the letters and the upkeep.",
         "task": "Knock on the door.", "say": "Tuck's house. Is he in?",
         "acts": [("door", "", "Knock knock! Tuck's home.",
                   '<b>🏡 Tuck opens the door</b><span>Walk through his house: one room for each tool.</span><a class="btn btn-primary" href="home/index.html#door">Step inside →</a>', "enter")]},
        {"id": "kiosk", "title": "The puzzle kiosk · Busy Games", "kicker": "Busy Games", "h": "Free daily brain games",
         "p": f"Stars, Duo, Trail and Six: four new puzzles every day, the same for everyone, and {GAME_LEVELS:,} levels each when you want more.",
         "task": "Tap the board.", "say": "The puzzle kiosk. Today's four are up.",
         "acts": [("board", "", "Today's four. Gentle on Monday, hardest at the weekend.",
                   '<b>🧩 Today\'s puzzles</b><span>Stars · Duo · Trail · Six</span><a class="btn btn-primary" href="games/index.html">Play today\'s puzzles →</a><a class="btn" href="games/tucks-errand.html">✂️ Tuck\'s Errand, our free game</a>', "enter")]},
    ]


STREET_DECALS = {"sign": ("Busy Business", True), "plaque": ("Busy Growth", True), "homesign": ("Busy Home", True),
                 "today": ("<b>Today's puzzles</b><span>Stars · Duo · Trail · Six</span>", True)}


# The days Busy Rentals and Busy Kitchen went live. Their entries in What's new carry the date their page last
# changed, which moves with every edit; for "what is newest" the launch day is the one that counts.
LAUNCH_DAYS = {"rentals-1.0": "2026-11-17", "kitchen-1.0": "2026-11-18"}


def hero_news() -> tuple:
    """The homepage's "New" chip, from the list of releases (site_updates), so the next launch changes it by itself:
    a suite's launch names the suite and opens its page; any other release names the version and opens What's new."""
    ups = site_updates()
    u = max(ups, key=lambda x: (LAUNCH_DAYS.get(x.get("id"), x["date"]), -ups.index(x)))
    for name, page in SECTIONS.values():
        if name == "Busy " + u["version"].split(" ")[0]:
            return f"New: {name}", page
    return f"New: version {u['version']}", f"updates.html#{u.get('id') or 'v' + u['version']}"


def street_card(s: dict) -> str:
    back = '<button type="button" class="btn" data-house-go="wide">← Back to the street</button>'
    if s["id"] == "wide":
        what = (APPS_FOR if GROWTH_LIVE and HOME_LIVE
                else "your brand, and soon your growth and your home")
        news, news_page = hero_news()
        return (f'<span class="chip chip-sun">Free · private · no account</span> <a class="chip chip-grape" href="{news_page}">✨ {e(news)}</a>'
                '<h1>Busy with what matters.</h1>'
                f'<p>{APPS_COUNT.capitalize() if GROWTH_LIVE and HOME_LIVE else "Three"} free apps for {what}. The boring part made easy, or done for you by an expert. Everything stays in your own folder.</p>'
                f'<p class="row-flex"><a class="btn btn-primary" href="#suites">🧰 Explore the apps</a><a class="btn" href="#offer">With an expert, from {FROM_PRICE}</a></p>'
                '<p class="house-task">👉 Tap a building to look inside, or a lit window upstairs.</p>'
                '<div class="house-result" data-result hidden></div>')
    return (f'<p class="kicker">{e(s["kicker"])}</p><h2>{e(s["h"])}</h2><p>{e(s["p"])}</p><p class="house-task">👉 {e(s["task"])}</p>'
            f'<div class="house-result" data-result hidden></div><div class="row-flex">{back}</div>')


def street_html() -> str:
    return place_html("street", street_steps(), street_card, "Busy Street: every Busy suite as a building", next_label="Next door →",
                      decals=STREET_DECALS, root="")


TUCK_FAQ = [
    ("Is it free?", "Yes. You can play all six levels in your browser, or download the game for Mac and Windows. Both are free, with no account and no adverts."),
    ("What is better in the download?", "Every level opens and ends with a film, it plays full screen, and everything is on your computer, so it needs no internet."),
    ("Is there any AI in it?", "No. Everything the figures say was written by hand and is picked by simple rules. What you do in the game isn't sent anywhere."),
    ("What language is it in?", "English, for now. The rest of Busy speaks six languages, and the game will follow."),
    ("Can I play it on a phone?", "Not yet. You need a keyboard, on a Mac or a Windows PC."),
]


def tuck_video(lang: str = "en") -> dict:
    """The trailer, for search engines: on the game's page and in the video sitemap."""
    tr = (lambda t: t) if lang == "en" else (lambda t: I18N.translate_text(t, lang))
    return {"@context": "https://schema.org", "@type": "VideoObject", "name": "Busy Street: Tuck's Errand: trailer",
            "description": tr("A short trailer for the free game Busy Street: Tuck's Errand: six friends, the Red Tape and a stamp that is overdue."),
            "thumbnailUrl": f"{SITE_URL}/games/tucks-errand/assets/pitch/poster.jpg", "uploadDate": "2026-11-06", "duration": "PT33S",
            "contentUrl": f"{SITE_URL}/games/tucks-errand/assets/trailer.mp4", "isFamilyFriendly": True, "inLanguage": "en"}


def tuck_page() -> str:
    """The game's own page: the trailer, the download first, the browser next to it."""
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in TUCK_FAQ)
    ld = jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                 "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in TUCK_FAQ]})
    desc = "A free puzzle adventure on Busy Street. Tuck only went out to get a stamp back. Six levels, six friends to cut loose, for Mac, Windows or your browser."
    game = {"@context": "https://schema.org", "@type": "VideoGame", "name": "Busy Street: Tuck's Errand", "description": desc, "url": f"{SITE_URL}/games/tucks-errand.html",
            "image": f"{SITE_URL}/assets/og-tucks-errand.png", "genre": ["Puzzle", "Adventure", "Platformer"], "gamePlatform": ["Web browser", "macOS", "Windows"],
            "applicationCategory": "GameApplication", "operatingSystem": "macOS 13 or newer, Windows 10 or 11, or a web browser", "playMode": "SinglePlayer",
            "numberOfPlayers": {"@type": "QuantitativeValue", "value": 1}, "inLanguage": "en", "isFamilyFriendly": True, "publisher": {"@type": "Organization", "name": "Busy", "url": f"{SITE_URL}/"},
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "availability": "https://schema.org/InStock"},
            "downloadUrl": [f"{APP_RELEASE}Busy-Tucks-Errand-Beta-Mac.dmg", f"{APP_RELEASE}Busy-Tucks-Errand-Beta-Windows.exe"], "trailer": tuck_video()}
    extra = ld + jsonld(game) + '<link rel="stylesheet" href="../assets/games/games.css">'
    return f"""{head("Busy Street: Tuck's Errand · A free game", desc, "games/tucks-errand.html", "../", extra, image="og-tucks-errand.png")}
<body class="site app-sun">
{nav("../", explore("../"))}
<main id="main">
  <div class="wrap">
  <section class="section"><div class="center">
    <p class="kicker">A free game from Busy</p>
    <h1 class="big">Busy Street: Tuck's Errand</h1>
    <p class="lead">The Red Tape has crept over Busy Street, and everyone it catches turns into a tangled, snarling version of themselves. Tuck only went out to get a stamp back.</p>
    <video data-seen-src="/games/tucks-errand/assets/trailer.mp4" poster="../games/tucks-errand/assets/pitch/poster.jpg" muted loop playsinline preload="none" aria-label="Trailer for the game" style="width:100%;max-width:900px;border-radius:16px;margin:18px auto;display:block"></video>
  </div></section>
  <section class="section" id="get"><div class="center">
    <h2 class="big">Ready to download</h2>
    <p class="lead">The full game, with a film at the start and end of every level. It plays without the internet.</p>
    {app_download("Tucks-Errand", "Tuck's Errand")}
    <p style="margin-top:18px"><a class="btn" href="../games/tucks-errand/index.html">Or play in your browser</a></p>
  </div></section>
  <section class="section"><div class="center"><h2 class="big">What you do</h2></div>
    <ul class="get-list" style="max-width:640px;margin:0 auto">
      <li>Free six friends, one level at a time, and each one joins you</li>
      <li>Swap between two figures on screen, and call in the others when you need them</li>
      <li>Throw pots, keys and each other, climb, swing, roll and walk the tightrope</li>
      <li>Hide from inspectors, and answer the ones you can't hide from</li>
      <li>Work the knots: logic puzzles from Busy's daily games</li>
      <li>Music on every level, and a hint whenever you are stuck: press J</li>
    </ul></section>
  <section class="section"><div class="center"><h2 class="big">Browser or download</h2></div>
    <div class="cmp" style="max-width:640px;margin:0 auto"><table><thead><tr><th></th><th>In your browser</th><th>Free download</th></tr></thead><tbody>
      <tr><td>All six levels</td><td>✓</td><td>✓</td></tr>
      <tr><td>Films</td><td>Level 1</td><td>Every level, start and end</td></tr>
      <tr><td>Plays without the internet</td><td>No</td><td>✓</td></tr>
      <tr><td>Install</td><td>Nothing to install</td><td>A one-time download</td></tr>
    </tbody></table></div></section>
  <section class="section" id="full"><div class="center"><h2 class="big">Six levels are free. The street goes on.</h2>
    <p class="lead">The full game has 15 levels: the street, then nine worlds, from the Hidden Manor to the Passport Office. And the whole street exists in 3D.</p>
    <p class="two-doors">{itch_button("tuck", "The full game", big=True)}{itch_button("street3d", "Busy Street 3D for Mac", big=True, primary=False)}</p></div></section>
  <section class="section" id="faq"><div class="center"><h2 class="big">Questions</h2></div><div class="faq">{faq}</div></section>
  </div>
</main>
{footer("../", json.loads(TOOLS_JSON.read_text()))}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def build_games() -> list:
    out = SITE / "games"
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(games_hub())
    # Tuck's Errand: game/ holds the web edition (busy-game/publish.py writes it)
    if (ROOT / "game").is_dir():
        shutil.rmtree(out / "tucks-errand", ignore_errors=True)
        shutil.copytree(ROOT / "game", out / "tucks-errand")
        (out / "tucks-errand.html").write_text(tuck_page())
    for g in GAMES:
        (out / f'{g["id"]}.html').write_text(game_page(g))
    print(f"website/games: {len(GAMES)} games + hub, {GAME_LEVELS:,} levels each")
    return ["games/index.html"] + (["games/tucks-errand.html"] if (ROOT / "game").is_dir() else []) + [f'games/{g["id"]}.html' for g in GAMES]


def build_pages() -> None:
    tools = json.loads((SITE / "content" / "tools.json").read_text())
    sc = scenes()
    business = SITE / "business"
    business.mkdir(exist_ok=True)
    for t in tools:
        (business / f'{t["id"]}.html').write_text(tool_page(t, tools, sc.get(t["id"], "")))
    (business / "tools.html").write_text(tools_index(tools))
    (business / "olaf.html").write_text(to_business(olaf_page(tools)))
    put_place(business / "index.html", workshop_html())
    business_blocks(business / "index.html")
    put_place(SITE / "index.html", street_html())
    (SITE / "about.html").write_text(about_page(tools))
    (SITE / "pricing.html").write_text(pricing_page(tools))
    put_block(SITE / "index.html", "films", films_block(""))
    put_block(SITE / "index.html", "offer", offer_block(tools, ""))
    put_block(SITE / "index.html", "street", street_block(""))
    sync_home_prices()
    (SITE / "press.html").write_text(press_page(tools))
    (SITE / "updates.html").write_text(updates_page(tools))
    (SITE / "feed.xml").write_text(updates_feed())
    (SITE / "claude-key.html").write_text(claude_key_page(tools))
    (SITE / "growth").mkdir(exist_ok=True)
    (SITE / "growth" / "index.html").write_text(growth_page(tools))
    (SITE / "home").mkdir(exist_ok=True)
    (SITE / "home" / "index.html").write_text(home_page(tools))
    # The experts' own pages (Ivy, Juno; Wren and Sal with their suites below): only while the suite is live.
    expert_rels = []
    for key, live in (("ivy", GROWTH_LIVE), ("juno", HOME_LIVE), ("wren", RENTALS_LIVE), ("sal", KITCHEN_LIVE)):
        f = SITE / expert_pages()[key]["folder"] / EXPERTS[key]["page"]
        if live and key not in ("wren", "sal"):
            f.write_text(expert_page(key, tools))
        elif not live and f.exists():
            f.unlink()
        if live:
            expert_rels.append(f.relative_to(SITE).as_posix())
    # Busy Rentals: its pages only while it is live; turned off again, they go.
    if RENTALS_LIVE:
        (SITE / "rentals").mkdir(exist_ok=True)
        (SITE / "rentals" / "index.html").write_text(rentals_page(tools))
        (SITE / "rentals" / "wren.html").write_text(wren_page(tools))
    elif (SITE / "rentals").exists():
        shutil.rmtree(SITE / "rentals")
    # Busy Kitchen: its page only while it is live; turned off again, it goes.
    if KITCHEN_LIVE:
        (SITE / "kitchen").mkdir(exist_ok=True)
        (SITE / "kitchen" / "index.html").write_text(kitchen_page(tools))
        (SITE / "kitchen" / "sal.html").write_text(expert_page("sal", tools))
    elif (SITE / "kitchen").exists():
        shutil.rmtree(SITE / "kitchen")
    # Busy Rentals' two cards on the homepage: after Busy Home's, and only while it is live (no empty markers before)
    put_switched_block(SITE / "index.html", "rentals-suite", rentals_suite_card() if RENTALS_LIVE else "", before=r'<a class="card suite reveal pop" href="games/"')
    put_switched_block(SITE / "index.html", "kitchen-suite", kitchen_suite_card() if KITCHEN_LIVE else "", before=r'<a class="card suite reveal pop" href="games/"')
    put_switched_block(SITE / "index.html", "rentals-expert", rentals_expert_card() if RENTALS_LIVE else "", after=r'<a class="card expert juno .*?</a>')
    put_switched_block(SITE / "index.html", "kitchen-expert", kitchen_expert_card() if KITCHEN_LIVE else "", after=r'<!-- /rentals-expert -->' if RENTALS_LIVE else r'<a class="card expert juno .*?</a>')
    put_block(SITE / "index.html", "trust", trust_lines(""))
    new_pages = write_new_pages(tools)
    suite_pages = []
    for folder, live in (("home", HOME_LIVE), ("growth", GROWTH_LIVE), ("rentals", RENTALS_LIVE)):
        ts = suite_tools(folder)
        for t in ts:
            f = SITE / folder / f'{t["id"]}.html'
            if live:
                f.write_text(suite_tool_page(t, ts, folder)); suite_pages.append(f'{folder}/{t["id"]}.html')
            elif f.exists():
                f.unlink()
    game_pages = build_games()
    # The addresses from before the suites (October 2026) keep working.
    old = SITE / "tools"
    old.mkdir(exist_ok=True)
    for t in tools:
        (old / f'{t["id"]}.html').write_text(forward_page(f'business/{t["id"]}.html', 1))
    (old / "index.html").write_text(forward_page("business/tools.html", 1))
    (SITE / "olaf.html").write_text(forward_page("business/olaf.html", 0))
    (SITE / "download.html").write_text(forward_page("business/download.html", 0))
    sync_chrome(tools)
    pages = (["", "about.html", "pricing.html", "updates.html", "press.html", "claude-key.html", "privacy.html", "terms.html", "business/index.html", "business/tools.html", "business/download.html", "business/olaf.html"]
             + [f'business/{t["id"]}.html' for t in tools] + game_pages + ["growth/index.html", "home/index.html"] + (["rentals/index.html"] if RENTALS_LIVE else []) + (["kitchen/index.html"] if KITCHEN_LIVE else []) + expert_rels + suite_pages + new_pages)
    today = date.today().isoformat()
    (SITE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{SITE_URL}/{p}</loc><lastmod>{page_date(p)}</lastmod></url>\n" for p in pages) + "</urlset>\n")
    (SITE / "robots.txt").write_text(robots_txt())
    # IndexNow's key file: proves to Bing and the others that the pages we announce are ours (tools/indexnow.py)
    sys.path.insert(0, str(ROOT / "tools"))
    from indexnow import KEY as INDEXNOW_KEY
    (SITE / f"{INDEXNOW_KEY}.txt").write_text(INDEXNOW_KEY)
    write_llms(tools)
    (SITE / "site.webmanifest").write_text(json.dumps({"name": "Busy", "short_name": "Busy", "description": ENTITY, "start_url": "/", "display": "browser",
        "theme_color": "#FFC93C", "background_color": "#16141F", "icons": [{"src": "assets/logo-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, indent=1) + "\n")
    missing = [t["id"] for t in tools if t["id"] not in sc]
    print(f"website/business: {len(tools)} product pages + index; {len(tools) + 3} old addresses forwarded" + (f" (no scene for {missing})" if missing else ""))


# ---------- the buying moments (Olaf's moments report, owner's approval of 16 November 2026) ----------
# People look for help at a moment, not for "an app". Each moment has its own page, linked from every footer.
# Plain words, the free price first, what the tools really do; the paid expert as the second step.
MOMENTS = {
    "growth/your-review.html": {
        "title": "Your review is coming: your year on one page", "suite": "growth", "emoji": "🌱",
        "desc": "A review next month, and you cannot say what you achieved? Busy Growth keeps your wins as they happen and helps you put the year on one page. Free, in your own folder.",
        "kicker": "Busy Growth · review season",
        "h1": "Your review is next month. What did you do this year?",
        "lead": "Most of a year's good work is forgotten by December. Busy Growth keeps it: each win with its result and its proof, ready for the conversation about your next step. Free, no account, everything in your own folder.",
        "steps_h": "Your review in one evening",
        "steps": [("🏆", "Write down every win you remember", "In the Wins Log: what happened, the result, and the proof. Go month by month; one evening is enough."),
                  ("🧭", "Link each win to a skill", "The Skills Map shows what your year proves and where you grew."),
                  ("🗓️", "Read your Fridays back", "If you kept the Weekly Review, the numbers and the hard weeks are already there."),
                  ("🗣️", "Turn the best wins into stories", "The Interview Story Bank shapes them as situation, task, action and result: what you say when your manager asks.")],
        "after": "Next year, log the win the day it happens. Next December's review then takes ten minutes.",
        "expert": "ivy", "expert_line": "Ivy, your career coach, reads your wins and finds the words for your review and for the raise you want to ask for.",
        "get": "growth/index.html#get", "demo": "app/growth.html",
    },
    "business/quiet-month.html": {
        "title": "A quiet month? Five things to do this week", "suite": "business", "emoji": "💼",
        "desc": "Next month's diary is empty. Five things a small business can do in a quiet week to be easier to find, remember and choose, each one in the free Busy Business.",
        "kicker": "Busy Business · a quiet month",
        "h1": "A quiet month, and next month's diary is empty.",
        "lead": "Every small business has them. A quiet week is the best time for the work that brings the next customers: being easy to find, easy to remember and easy to choose. Five things, each done in Busy Business, free.",
        "steps_h": "Five things for this week",
        "steps": [("🧭", "Write down who you are for", "In the Marketing Studio's brand profile: who buys from you, and the moments they think of someone like you."),
                  ("📇", "Call three past clients", "Clients shows who you worked for and when you last spoke. Ask how it went, and whether they know someone who needs you."),
                  ("🎨", "Make everything look like you", "The Brand Kit keeps your colours, your logo and your words in one place, so every post and every quote looks the same."),
                  ("🗓️", "Plan next month on one page", "The year plan in the Marketing Studio: one thing a week, small enough to do in a busy week too."),
                  ("🧾", "Follow up the quotes that are waiting", "Invoices and quotes shows the open ones. A friendly question this week is often the next job.")],
        "after": "Be the name people think of first. A quiet week is where that starts.",
        "expert": "olaf", "expert_line": "Olaf, your brand consultant, looks at your brand, your website and your market, and prepares the month's plan with you.",
        "get": "business/download.html", "demo": "app/index.html",
    },
    "close-the-year.html": {
        "title": "Close the year in an evening: work, business, home", "suite": "", "emoji": "🗓️",
        "desc": "One evening in December: look back at your work year, plan your business year and put the household papers in order. Three free apps from Busy, no account.",
        "kicker": "December and January",
        "h1": "Close the year in an evening.",
        "lead": "Three doors, one evening: your work, your business and your home. Each app is free, and everything stays in your own folder.",
        "doors": [("🌱", "Your work year", "What did this year prove? The Wins Log and the Skills Map put it on one page, ready for your review.", "growth/your-review.html", "Your review →", "growth/index.html#get"),
                  ("💼", "Your business year", "Who are you for, and what will you do each month? The Marketing Studio's brand profile and year plan, on one page.", "business/quiet-month.html", "A quiet month? →", "business/download.html"),
                  ("🏡", "Your home year", "What renews in January, and what expires next year? Contracts & Renewals shows the last day to cancel; the Paper Trail finds the passports and policies.", "home/index.html", "Busy Home →", "home/index.html#get")],
        "after": "Busy with what matters.",
    },
}


EXPERT_HOME = {"olaf": "business/olaf.html", "ivy": "growth/ivy.html", "juno": "home/juno.html", "wren": "rentals/wren.html", "sal": "kitchen/sal.html"}  # each expert's own page, from the root


def moment_page(rel: str, m: dict, tools: list) -> str:
    prefix = "../" * rel.count("/")
    head_title = m["title"] + ({"growth": " · Busy Growth", "business": " · Busy Business"}.get(m["suite"], " · Busy"))
    if m.get("doors"):
        body = "".join(f'<article class="card path reveal pop"><span class="e">{em}</span><h3>{e(h)}</h3><p>{e(p)}</p>'
                       f'<div class="row-flex"><a class="btn btn-primary" href="{prefix}{get}">⬇️ Free</a><a class="btn" href="{prefix}{more}">{e(more_label)}</a></div></article>'
                       for em, h, p, more, more_label, get in m["doors"])
        middle = f'<section class="section"><div class="wrap"><div class="paths">{body}</div></div></section>'
        paid = (f'<section class="section"><div class="wrap center"><p class="lead reveal">Want it done with you? The experts, from {FROM_PRICE} once: '
                f'<a href="{prefix}business/olaf.html">Olaf</a>, <a href="{prefix}growth/ivy.html">Ivy</a> and <a href="{prefix}home/juno.html">Juno</a>.</p>'
                f'<p class="kicker reveal">{e(m["after"])}</p></div></section>')
        ctas = ""
    else:
        steps = "".join(f'<li class="card reveal"><span class="e">{em}</span><div><b>{e(h)}</b><p>{e(p)}</p></div></li>' for em, h, p in m["steps"])
        middle = (f'<section class="section"><div class="wrap"><div class="center reveal"><h2 class="big">{e(m["steps_h"])}</h2></div>'
                  f'<ol class="moment-steps">{steps}</ol><p class="center lead reveal">{e(m["after"])}</p></div></section>')
        x = PRODUCTS[m["expert"]]
        paid = (f'<section class="section"><div class="wrap"><article class="card path featured reveal"><span class="chip chip-grape">AI expert · {x["price"]} once</span>'
                f'<h3>{e(x["name"])}</h3><p>{e(m["expert_line"])}</p>'
                f'<div class="row-flex">{itch_button(m["expert"])}<a class="btn" href="{prefix}{EXPERT_HOME[m["expert"]]}">Meet {x["who"]}</a></div>{claude_line()}</article></div></section>')
        ctas = (f'<div class="row-flex center-flex"><a class="btn btn-primary btn-big" href="{prefix}{m["get"]}">⬇️ Download free</a>'
                f'<a class="btn btn-big" href="{prefix}{m["demo"]}">👀 See the demo</a></div>')
    return f"""{head(head_title, m["desc"], rel, prefix)}
<body class="site app-sun">
{nav(prefix, explore(prefix))}
<main id="main">
  <section class="section"><div class="wrap">
    <div class="center reveal"><p class="kicker">{e(m["kicker"])}</p><h1 class="big">{e(m["h1"])}</h1>
      <p class="lead">{e(m["lead"])}</p>{ctas}<p class="faint">Free · no account · Mac and Windows</p></div>
  </div></section>
  {middle}
  {paid}
</main>
{footer(prefix, tools)}
<script src="{prefix}assets/site.js"></script>
</body>
</html>
"""


# ---------- a watch page per film (Search Console, 16 November 2026: "Video isn't on a watch page") ----------
# On the product pages a film is one part of many; Google shows a film in its video results only from a page that is
# about the film. Our own file plays here (nothing loads until play); the same film is on the Busy YouTube channel.
YOUTUBE = "https://www.youtube.com/@Busy-AI-com"
FILMS = {
    "busy-business": ("Busy Business with Olaf: the film", "The free tools for a small business, and Olaf, the brand consultant upstairs, in 30 seconds.", "sKWE_rWW6zQ", "business/index.html", "Busy Business"),
    "busy-growth": ("Busy Growth with Ivy: the film", "The free tools to grow your career, and Ivy, the career coach at the top of the Glasshouse, in 30 seconds.", "DZX4lbfiyMk", "growth/index.html", "Busy Growth"),
    "busy-home": ("Busy Home with Juno: the film", "The free tools for household paperwork, and Juno, the household assistant in the attic, in 30 seconds.", "6iGmY4yqhPc", "home/index.html", "Busy Home"),
    "busy-games": ("Busy Games: the film", "The four daily brain games in 24 seconds. Free, a new puzzle every day.", "SScuHhGPRLc", "games/index.html", "Busy Games"),
    "tucks-errand": ("Busy Street: Tuck's Errand, the trailer", "Tuck has one overdue stamp and a whole street of red tape. The trailer of the game, in six languages.", "EZPAUpdnXo4", "games/tucks-errand.html", "Tuck's Errand"),
    "busy-street-3d": ("Busy Street 3D: the trailer", "Busy Street in 3D: the street, the worlds and the cities, with the owner's piano music.", "CZWQVzKUeS0", "games/tucks-errand.html", "Busy Street 3D"),
}
# Busy Rentals' film (on YouTube since 17 November 2026, subtitles in six languages): listed only once Rentals is live.
RENTALS_FILM = ("Busy Rentals with Wren: the film", "The free tools for people who let one home or a few, and Wren, the property manager, in 88 seconds.",
                "wiZL3R1jR7c", "rentals/index.html", "Busy Rentals")
if RENTALS_LIVE:
    FILMS["busy-rentals"] = RENTALS_FILM
# Busy Kitchen's film (on YouTube since 18 November 2026): listed only while Kitchen is live and the film is there.
KITCHEN_FILM = ("Busy Kitchen with Sal: the film", "Tell Busy Kitchen what is in your fridge and see what's for dinner: six kitchens, a recipe for every dish and the week planned, in 30 seconds.",
                "OQH3zQPSGy0", "kitchen/index.html", "Busy Kitchen")
if KITCHEN_LIVE and (KITCHEN_SITE / "assets" / "films" / "busy-kitchen.mp4").exists():
    FILMS["busy-kitchen"] = KITCHEN_FILM
# What stands under each film on its own page: the same two doors as the film cards on the homepage. (the product
# whose button goes to itch.io, the free door's words, where it leads)
FILM_DOORS = {"busy-business": ("olaf", "⬇️ Download free", "business/download.html"), "busy-growth": ("ivy", "⬇️ Download free", "growth/index.html#get"),
              "busy-home": ("juno", "⬇️ Download free", "home/index.html#get"), "busy-rentals": ("wren", "⬇️ Download free", "rentals/index.html#get"),
              "busy-kitchen": ("sal", "🍳 Open it in your browser", "app/kitchen.html"), "busy-games": ("", "⬇️ Download free", "games/index.html#get-app"),
              "tucks-errand": ("tuck", "▶ Play six levels free", "games/tucks-errand.html"), "busy-street-3d": ("street3d", "", "")}


# The films' lengths, measured with ffprobe on 16 November 2026 (the online build has no ffprobe); a new film is measured.
FILM_SECONDS = {"busy-business": 31, "busy-growth": 31, "busy-home": 31, "busy-games": 24, "tucks-errand": 67, "busy-street-3d": 57, "busy-rentals": 88, "busy-kitchen": 30}


def film_seconds(name: str) -> int:
    if name in FILM_SECONDS:
        return FILM_SECONDS[name]
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(SITE / "assets" / "films" / f"{name}.mp4")],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        return max(1, round(float(out)))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return 30


def film_watch(name: str, tools: list) -> str:
    title, desc, yt, home, label = FILMS[name]
    rel, prefix, sec = f"films/{name}.html", "../", film_seconds(name)
    when = page_date(f"assets/films/{name}.mp4", [f"website/assets/films/{name}.mp4"])
    ld = jsonld({"@context": "https://schema.org", "@type": "VideoObject", "name": title, "description": desc,
                 "thumbnailUrl": f"{SITE_URL}/assets/films/{name}.jpg", "contentUrl": f"{SITE_URL}/assets/films/{name}.mp4",
                 "uploadDate": when, "duration": f"PT{sec}S", "inLanguage": "en", "url": f"{SITE_URL}/{rel}",
                 "publisher": {"@type": "Organization", "name": "Busy", "url": f"{SITE_URL}/"},
                 "sameAs": f"https://www.youtube.com/watch?v={yt}"})
    # The two doors of the homepage's film cards: the free one, and the paid one on itch.io with its price.
    key, free_label, free = FILM_DOORS.get(name, ("", "", ""))
    paid = itch_button(key, {"tuck": "The full game", "street3d": "Get it"}.get(key, "With " + PRODUCTS[key]["who"]), big=True, primary=not free) if key in PRODUCTS else ""
    doors = (f'<a class="btn btn-primary btn-big" href="{prefix}{free}">{free_label}</a>' if free else "") + paid
    if name == "busy-games":
        doors += f'<a class="btn btn-big" href="{prefix}games/index.html">🧩 Play in your browser</a>'
    return f"""{head(title + " · Busy", desc, rel, prefix, ld)}
<body class="site app-sun">
{nav(prefix, explore(prefix))}
<main id="main">
  <section class="section"><div class="wrap">
    <div class="center"><p class="kicker">A film by Busy</p><h1 class="big">{e(title)}</h1></div>
    <figure class="film watch"><video controls playsinline preload="metadata" poster="{prefix}assets/films/{name}.jpg" src="{prefix}assets/films/{name}.mp4" aria-label="{e(title)}"></video>
      <figcaption class="center lead">{e(desc)}</figcaption></figure>
    <div class="row-flex center-flex">{doors}</div>
    {claude_line("center") if key in EXPERT_HOME else ""}
    <p class="center film-more" style="margin-top:22px"><a href="{prefix}{home}">{e(label)} →</a> <a class="out" href="https://www.youtube.com/watch?v={yt}" target="_blank" rel="noopener">Also on YouTube <span aria-hidden="true">↗</span></a> <a href="{prefix}films/index.html">All films →</a></p>
  </div></section>
</main>
{footer(prefix, tools)}
<script src="{prefix}assets/site.js"></script>
</body>
</html>
"""


def films_index(tools: list) -> str:
    cards = "".join(f'<a class="card film-card reveal" href="{n}.html"><img src="../assets/films/{n}.jpg" alt="" loading="lazy" width="640" height="360"><b>{e(t)}</b><small>{e(d)}</small></a>'
                    for n, (t, d, *_) in FILMS.items())
    apps = sum(1 for n in FILMS if FILM_DOORS.get(n, ("",))[0] in EXPERT_HOME)  # the films of an app with its expert, as shown below
    desc = f"The short films of Busy: the {words(apps)} apps with their experts, the brain games, and the game Busy Street in 2D and 3D."
    return f"""{head("The Busy films: every app and game in a short film", desc, "films/index.html", "../")}
<body class="site app-sun">
{nav("../", explore("../"))}
<main id="main">
  <section class="section"><div class="wrap">
    <div class="center reveal"><p class="kicker">Films</p><h1 class="big">Busy, in short films.</h1><p class="lead">{e(desc)} Also on <a href="{YOUTUBE}" target="_blank" rel="noopener">our YouTube channel ↗</a>.</p></div>
    <div class="film-grid">{cards}</div>
  </div></section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def write_new_pages(tools: list) -> list:
    out = []
    for rel, m in MOMENTS.items():
        (SITE / rel).parent.mkdir(parents=True, exist_ok=True)
        (SITE / rel).write_text(moment_page(rel, m, tools)); out.append(rel)
    (SITE / "films").mkdir(exist_ok=True)
    for name in FILMS:
        (SITE / "films" / f"{name}.html").write_text(film_watch(name, tools)); out.append(f"films/{name}.html")
    if not RENTALS_LIVE and (SITE / "films" / "busy-rentals.html").exists():  # left from a live build: it goes with the switch
        (SITE / "films" / "busy-rentals.html").unlink()
    (SITE / "films" / "index.html").write_text(films_index(tools)); out.append("films/index.html")
    return out


# ---------- honest page dates (health check of 15 November 2026) ----------
# A page's date moves when its own words change, not when the build script changes. Each built page (every language)
# is fingerprinted without its date; a new fingerprint gets today's date. website/content/page-dates.json remembers them.
# Since 17 November 2026 the fingerprint is of the page's own content only: its title, its description and what stands
# in <main>. The top bar and the footer are on every page, so a new link there is not news about each page; before,
# one new footer link gave every page today's date.
DATES_FILE = ROOT / "website" / "content" / "page-dates.json"
DATE_IN_PAGE = re.compile(r'("dateModified":\s*")(\d{4}-\d{2}-\d{2})(")')
DATES_NOTE = ("Each page: [the fingerprint of its title, description and main content, the date that content last changed]. "
              "build.py settle_dates() keeps it; only pages of the last build are listed.")


def page_print(page: str, whole: bool = False) -> str:
    """The words people read on a page, as a fingerprint: the title, the description and the main content, without
    scripts (structured data, the counter), styles and markup. whole=True is the fingerprint used until 17 November
    2026 (everything on the page, bar and footer included), kept to read a record written before then."""
    import hashlib
    words = re.sub(r"<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>", "", page, flags=re.S)
    meta = " ".join(re.findall(r'<title>.*?</title>|<meta name="description" content="[^"]*"', words, flags=re.S))
    if not whole:
        main = re.search(r"<main\b[^>]*>.*</main>", words, flags=re.S)
        # a page without <main>: its body, without the top bar and the footer
        words = main.group(0) if main else re.sub(r'<header class="nav[^"]*">.*?</header>|<footer class="footer[^"]*">.*?</footer>', "",
                                                  (re.search(r"<body\b.*", words, flags=re.S) or re.search(r".*", words, flags=re.S)).group(0), flags=re.S)
    words = meta + re.sub(r"<[^>]+>", " ", words)   # the text people read, not the markup around it
    return hashlib.sha1(re.sub(r"\s+", " ", words).encode()).hexdigest()[:16]


def settle_dates() -> None:
    rec = json.loads(DATES_FILE.read_text()) if DATES_FILE.exists() else {}
    first = not rec                      # no record yet: every page starts with the date its sources gave
    old_prints = "_" not in rec          # a record from before 17 November 2026: fingerprints of the whole page
    rec.pop("_", None)
    today = date.today().isoformat()
    sm = SITE / "sitemap.xml"
    text = sm.read_text()
    seen = {}

    def file_of(loc: str) -> Path:
        p = loc[len(SITE_URL) + 1:]
        return SITE / (p + "index.html" if p == "" or p.endswith("/") else p)

    def fix(m):
        loc = m.group(1)
        f = file_of(loc)
        if not f.exists():
            return m.group(0)
        page = f.read_text()
        key = f.relative_to(SITE).as_posix()
        fp = page_print(page)
        old = rec.get(key)
        same = bool(old) and old[0] == (page_print(page, whole=True) if old_prints else fp)
        # unchanged: its date stays. Changed: today. New to the record: today too (a page that appears, like Busy
        # Rentals' pages on the day its switch goes on, is new that day), except when there was no record at all.
        d = old[1] if same else (m.group(2) if first else today)
        seen[key] = [fp, d]
        new_page = DATE_IN_PAGE.sub(lambda x: x.group(1) + d + x.group(3), page)
        if new_page != page:
            f.write_text(new_page)
        return f"<url><loc>{loc}</loc><lastmod>{d}</lastmod>"

    text = re.sub(r"<url><loc>([^<]*)</loc><lastmod>([^<]*)</lastmod>", fix, text)
    sm.write_text(text)
    # only the real site keeps its record: a trial build (check.py, without the live address) reads it, never writes it.
    # The record lists the pages of this build and no others: a suite behind a switch that is off leaves no trace in it.
    if SITE_URL.startswith("https://busy.com.ai"):
        DATES_FILE.write_text(json.dumps({"_": DATES_NOTE, **{k: seen[k] for k in sorted(seen)}}, indent=0) + "\n")
    print(f"page dates: {len(seen)} pages, {sum(1 for fp, d in seen.values() if d == today)} changed today")



# ---------- who we are, for search engines and AI assistants ----------
# One definition of Busy, used in the structured data, the About page, llms.txt and the web
# manifest, so every place describes the same thing in the same words.
ENTITY = ("Busy makes free, private tools for work and life, in suites: Busy Business (thirteen tools for small businesses and "
          "freelancers to grow and run the business: a marketing studio with a brand profile and a year plan, a brand kit, projects, "
          "invoices and quotes, time, receipts, money, clients, documents, subscriptions, trips and stock), Busy Growth (" + ("free tools to grow your career: a library, skills, wins, a job tracker, a CV and LinkedIn builder and more" if GROWTH_LIVE else "tools to grow your career, coming soon") + "), "
          "Busy Home (" + ("free tools for household paperwork: documents with expiry reminders, contracts with the last day to cancel, upkeep, a home inventory, letters, moving and a Just in Case binder" if HOME_LIVE else "tools for household paperwork, coming soon") + ")"
          + (", Busy Rentals (free rental management for people who let one home or a few: every date, certificate, deposit, rent payment and receipt, with the landlord's year for England, the Netherlands and Germany)" if RENTALS_LIVE else "")
          + (f", Busy Kitchen (a free cultural kitchen: {KITCHEN_DISHES} dishes from the six kitchens of Busy's six languages, matched to what's in your fridge, with a recipe for every dish)" if KITCHEN_LIVE else "") +
          " and Busy Games (free daily brain games). Each suite is a free app for Mac and Windows, or runs in the browser, and keeps everything in the "
          "owner's own folder, with no account and no subscription. Each suite also comes as a paid app with an AI expert inside, bought "
          "once on itch.io: Olaf for business, Ivy for professional growth, Juno for household paperwork" + (", Wren for letting a home" if RENTALS_LIVE else "") + (", Sal for home cooking" if KITCHEN_LIVE else "") + ". Busy also makes the game Busy Street.")
ORG_ID, WEBSITE_ID = "#organization", "#website"
SECTIONS = {"business/": ("Busy Business", "business/index.html"), "games/": ("Busy Games", "games/index.html"), "growth/": ("Busy Growth", "growth/index.html"), "home/": ("Busy Home", "home/index.html"),
            "rentals/": ("Busy Rentals", "rentals/index.html"), "kitchen/": ("Busy Kitchen", "kitchen/index.html")}
# The name is a common word, and another company sells accounting software as BUSY. These tell search
# engines and AI assistants which Busy this is; the old name stays as an alternate for a while.
DESCRIPTOR = "free, private tools for work and life"
ALT_NAMES = ["busy.com.ai", "Busywork"]
DISAMBIGUATION = ("Busy at busy.com.ai: free, private tools for work and life, formerly called Busywork. "
                  "Not related to BUSY accounting software (busy.in).")


def page_date(rel: str, files: list = None) -> str:
    """When a page last changed, from git: its own source file, or for generated pages, what they are made from.
    Honest freshness: the date moves when the content does, not on every build."""
    sources = {"": ["website/index.html"], "business/index.html": ["website/business/index.html"], "business/download.html": ["website/business/download.html"],
               "privacy.html": ["website/privacy.html"], "terms.html": ["website/terms.html"], "about.html": ["build.py", "website/content/tools.json"],
               "claude-key.html": ["build.py", "app/shared/ai.js"],
               "business/olaf.html": ["build.py", "olaf-demo/library.js"], "growth/index.html": ["build.py"]}.get(rel, ["build.py", "website/content/tools.json"])
    if rel.startswith("games/"):
        sources = ["build.py", "website/assets/games/engine.js", "website/assets/games/play.js"]
    if files:
        sources = files
    dates = []
    for src in sources:
        try:
            out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", src], cwd=ROOT, capture_output=True, text=True).stdout.strip()
            if out:
                dates.append(out)
        except OSError:
            pass
    return max(dates) if dates else date.today().isoformat()


def site_graph(rel: str, title: str) -> dict:
    """The structured data every page shares: who publishes the site, the site, and this page."""
    base = SITE_URL + "/"
    url = base + rel
    org = {"@type": "Organization", "@id": base + ORG_ID, "name": "Busy", "alternateName": ALT_NAMES, "url": base, "description": ENTITY,
           "disambiguatingDescription": DISAMBIGUATION, "slogan": "Busy with what matters.",
           "logo": {"@type": "ImageObject", "@id": base + "#logo", "url": base + "assets/logo-512.png", "width": 512, "height": 512, "caption": "Busy logo"},
           "image": {"@id": base + "#logo"}}
    org["sameAs"] = [YOUTUBE, ITCH.rstrip("/")]
    repo = os.environ.get("GITHUB_REPOSITORY")
    if repo:
        org["sameAs"].append(f"https://github.com/{repo}")
    page_type = {"about.html": "AboutPage", "business/index.html": "CollectionPage", "business/tools.html": "CollectionPage",
                 "games/index.html": "CollectionPage"}.get(rel, "WebPage")
    page = {"@type": page_type, "@id": url + "#webpage", "url": url, "name": title, "inLanguage": "en", "isPartOf": {"@id": base + WEBSITE_ID},
            "about": {"@id": base + ORG_ID}, "publisher": {"@id": base + ORG_ID}, "dateModified": page_date(rel)}
    graph = [org, {"@type": "WebSite", "@id": base + WEBSITE_ID, "url": base, "name": "Busy", "alternateName": ALT_NAMES, "description": ENTITY, "inLanguage": "en",
                   "publisher": {"@id": base + ORG_ID}}, page]
    crumbs = [("Busy", base)]
    section = next((s for s in SECTIONS if rel.startswith(s)), None)
    if section:
        name, home = SECTIONS[section]
        crumbs.append((name, base + home))
        if rel != home:
            crumbs.append((re.sub(r"\s*[·:(].*$", "", title), url))
    elif rel:
        crumbs.append((re.sub(r"\s*[·:].*$", "", title), url))
    if len(crumbs) > 1:
        page["breadcrumb"] = {"@id": url + "#breadcrumb"}
        graph.append({"@type": "BreadcrumbList", "@id": url + "#breadcrumb",
                      "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(crumbs)]})
    return {"@context": "https://schema.org", "@graph": graph}


def site_seo() -> None:
    """Every website page, hand-written or generated, gets the same basics: a canonical address,
    share-image alt text, icons crawlers can fetch, and the shared structured data, linked to the
    page's own (a product, its questions). The 404 page is kept out of search."""
    for f in site_pages():
        rel = f.relative_to(SITE).as_posix()
        rel = "" if rel == "index.html" else rel
        prefix = "../" if "/" in rel else ""
        t = f.read_text()
        if rel == "404.html":
            if 'name="robots"' not in t:
                t = t.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">', 1)
            f.write_text(t)
            continue
        title = html.unescape((re.search(r"<title>(.*?)</title>", t, re.S) or [None, "Busy"])[1])
        if 'id="main"' not in t:  # "Skip to content" goes to #main: a page whose <main> has no name gets it here
            t = re.sub(r"<main\b(?![^>]*\sid=)", '<main id="main"', t, count=1)
        if 'rel="canonical"' not in t:
            t = t.replace("</title>", f'</title>\n<link rel="canonical" href="{SITE_URL}/{rel}">', 1)
        image = (re.search(r'og:image" content="[^"]*/assets/([^"/]+)"', t) or [None, "og-busy.png"])[1]
        alt = e(IMAGES.get("assets/" + image, IMAGES["assets/og-busy.png"])[1])
        if "og:image:alt" not in t:
            t, n = re.subn(r'(<meta property="og:image:height" content="630">)', rf'\1<meta property="og:image:alt" content="{alt}">', t, count=1)
            if not n:
                t = re.sub(r'(<meta property="og:image" content="[^"]*">)', rf'\1<meta property="og:image:alt" content="{alt}">', t, count=1)
        if 'property="og:url"' not in t:  # the address a shared link shows: the canonical one
            t = re.sub(r'(<meta property="og:title"[^>]*>)', lambda m: m.group(1) + f'<meta property="og:url" content="{SITE_URL}/{rel}">', t, count=1)
        if "og:locale" not in t:
            t = t.replace('<meta name="theme-color"', '<meta property="og:locale" content="en_GB">\n<meta name="theme-color"', 1)
        if "<noscript><style>.reveal" not in t:  # without scripts nothing would ever get its "shown" class: show it all
            t = t.replace("</head>", "<noscript><style>.reveal, .panel { opacity: 1 !important; transform: none !important; }</style></noscript>\n</head>", 1)
        if "application/rss+xml" not in t:  # What's new, for feed readers
            t = t.replace('<meta name="theme-color"', f'<link rel="alternate" type="application/rss+xml" title="Busy: what\'s new" href="{SITE_URL}/feed.xml">\n<meta name="theme-color"', 1)
        if "og:locale:alternate" not in t:  # the languages a shared link also comes in
            alts = "".join(f'\n<meta property="og:locale:alternate" content="{l}">' for l in ("nl_NL", "de_DE", "es_ES", "it_IT", "pt_BR"))
            t = re.sub(r'(<meta property="og:locale" content="en_GB">)', lambda m: m.group(1) + alts, t, count=1)
        if 'name="twitter:image"' not in t:
            t = t.replace('<meta name="twitter:card" content="summary_large_image">', f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{SITE_URL}/assets/{image}"><meta name="twitter:image:alt" content="{alt}">', 1)
        t = re.sub(r'<link rel="icon"[^>]*>(?:<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>)*', ICONS.replace("{prefix}", prefix), t, count=1)
        # Structured data: drop an old stand-alone Organization, link products to the publisher, add the shared graph.
        def fix(m):
            raw = m.group(1)
            try:
                obj = json.loads(raw)
            except ValueError:
                return m.group(0)
            if obj.get("@type") == "Organization":
                return ""
            if obj.get("@type") == "SoftwareApplication":
                obj.setdefault("url", f"{SITE_URL}/{rel}")  # an app with no address of its own is the one this page is about
                obj["publisher"] = {"@id": SITE_URL + "/" + ORG_ID}
                offer = obj.get("offers") or {}
                if str(offer.get("price")) == "0":
                    obj["isAccessibleForFree"] = True
                    offer["priceCurrency"] = "USD"  # one currency on every page: the paid editions are priced in US dollars
                elif offer:
                    offer["availability"] = "https://schema.org/InStock"
                    name = str(obj.get("name", ""))
                    offer.setdefault("url", SITE_URL + ("/growth/ivy.html#get" if "Ivy" in name else "/home/juno.html#get" if "Juno" in name else "/kitchen/sal.html#get" if "Sal" in name else "/rentals/wren.html#get" if "Wren" in name else "/business/olaf.html#get"))
            return jsonld(obj).rstrip("\n")
        t = re.sub(r'<script type="application/ld\+json">(.*?)</script>\n?', fix, t, flags=re.S)
        t = re.sub(r'<script type="application/ld\+json" id="ld-site">.*?</script>\n?', "", t, flags=re.S)
        graph = '<script type="application/ld+json" id="ld-site">' + json.dumps(site_graph(rel, title), ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
        t = t.replace("</head>", graph + "</head>", 1)
        f.write_text(t)


def robots_txt() -> str:
    agents = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
              "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "Googlebot"]
    # /app/shared/ stays open: the pages' own stylesheet (brand.css), their scripts, the guides' pictures and every
    # Busy Kitchen picture live there, and a crawler that cannot fetch them cannot see the pages as people do.
    rules = "Allow: /\nAllow: /app/shared/\nDisallow: /app/\n\n"
    return ("# Busy welcomes search engines and AI assistants. The tools under /app/ are left out: they are\n"
            "# the website demo, the same app filled with a pretend business. Their shared styles, scripts and\n"
            "# pictures (/app/shared/) are open, because the website's pages use them. llms.txt summarises the site.\n"
            "User-agent: *\n" + rules +
            "# Named, so the choice to be found in AI search and assistants is explicit.\n"
            + "".join(f"User-agent: {a}\n" for a in agents) + rules +
            f"Sitemap: {SITE_URL}/sitemap.xml\n")


# How every expert runs, in the same words wherever llms.txt names one (the pages say it at each buy button).
ON_OWN_CLAUDE = "on the owner's own Claude (the Claude app with a paid plan, or a Claude API key)"


def llms_summary() -> str:
    """llms.txt's opening lines, about 600 characters: what Busy is, what is free, what is paid and for how much. The long
    version (ENTITY) opens llms-full.txt and is the site's description in the structured data."""
    suites = ["Busy Business (thirteen tools for a small business or a freelancer)",
              "Busy Growth (your career)" + ("" if GROWTH_LIVE else ", coming soon"),
              "Busy Home (household paperwork)" + ("" if HOME_LIVE else ", coming soon")]
    experts = [f"Olaf {PRODUCTS['olaf']['price']}"] + ([f"Ivy {PRODUCTS['ivy']['price']}"] if GROWTH_LIVE else []) + ([f"Juno {PRODUCTS['juno']['price']}"] if HOME_LIVE else [])
    if RENTALS_LIVE:
        suites.append("Busy Rentals (letting one home or a few)"); experts.append(f"Wren {WREN['price']}")
    if KITCHEN_LIVE:
        suites.append(f"Busy Kitchen ({KITCHEN_DISHES} dishes from six kitchens)"); experts.append(f"Sal {SAL['price']}")
    suites.append("Busy Games (daily brain games)")
    prices = experts[0] if len(experts) == 1 else f"{', '.join(experts[:-1])} and {experts[-1]}"
    return (f"Busy (busy.com.ai) makes free, private apps for work and life, in suites: {', '.join(suites[:-1])} and {suites[-1]}. "
            "The free apps have no account, no subscription and no AI, and nothing is sent to Busy. "
            f"Each suite except Busy Games also has a paid AI expert, bought once on itch.io: {prices}. "
            "The experts work on the buyer's own Claude: the Claude app with a paid plan, or a Claude API key.")


def write_llms(tools: list) -> None:
    """llms.txt (llmstxt.org): a short, link-rich summary for AI assistants; llms-full.txt: the facts in one file."""
    b = SITE_URL
    olaf_price = OLAF_PRICE.split(' ·')[0]
    wren_price = f", Busy Rentals with Wren {WREN['price']} ({WREN['url']})" if RENTALS_LIVE else ""   # named only while Busy Rentals is live
    sal_price = f", Busy Kitchen with Sal {SAL['price']} ({SAL['url']})" if KITCHEN_LIVE else ""        # and Sal only while Busy Kitchen is
    names = ["Olaf", "Ivy", "Juno"] + (["Wren"] if RENTALS_LIVE else []) + (["Sal"] if KITCHEN_LIVE else [])
    lines = [f"# Busy", "", f"> {llms_summary()}", "",
             f"Busy, {DESCRIPTOR}, lives at {b}. It was called Busywork until October 2026. It is not related to BUSY accounting software (busy.in).", "",
             "Key facts:",
             f"- Price: every suite's tools are free, with no account and no subscription. Each suite also has a paid edition with an AI expert, sold once on itch.io at an introductory price: Busy Business with Olaf {PRODUCTS['olaf']['price']} ({PRODUCTS['olaf']['url']}), Busy Growth with Ivy {PRODUCTS['ivy']['price']} ({PRODUCTS['ivy']['url']}), Busy Home with Juno {PRODUCTS['juno']['price']} ({PRODUCTS['juno']['url']}){wren_price}{sal_price}. Each expert works {ON_OWN_CLAUDE}. The games: Busy Street: Tuck's Errand {PRODUCTS['tuck']['price']} ({PRODUCTS['tuck']['url']}) and Busy Street 3D for Mac {PRODUCTS['street3d']['price']} ({PRODUCTS['street3d']['url']}).",
             "- Data: saved as files in a folder the owner chooses on their own computer (it can sit in Google Drive, Dropbox, OneDrive or iCloud Drive). Nothing is sent to Busy. The games keep progress in the browser.",
             "- Works in: a free app per suite for Mac and Windows (beta), Busy Games included; or, without installing, Chrome and Edge from a downloaded folder (also on ChromeOS and Linux). The games run in any modern browser."
             + (" Busy Kitchen runs in Chrome or Edge, online or from its downloaded folder." if KITCHEN_LIVE else ""),
             f"- AI: none in the free tools. {', '.join(names[:-1])} and {names[-1]} work on the owner's own Claude: as a plugin in their own Claude app, which takes a paid Claude plan and no key, or with their own Claude API key. Nothing goes to Busy.",
             "- Languages: English, Dutch, German, Spanish, Italian and Brazilian Portuguese (the website under /nl/, /de/, /es/, /it/ and /pt-br/; the apps follow the computer's language). Invoices, quotes and letters can be made in any of them.",
             "", "## Busy Business: free tools for small businesses", "",
             f"- [Busy Business]({b}/business/index.html): {len(tools)} free tools for small businesses and freelancers, for three jobs: growing the brand (a marketing studio and a brand kit), delivering projects, and running the money and admin."]
    lines += [f"- [{t['name']}]({b}/business/{t['id']}.html): {t['description']}" for t in tools]
    lines += [f"- [Olaf, the brand consultant]({b}/business/olaf.html): a 90-day marketing plan, project plans, a weekly check-in and the work done with the owner, on proven marketing science. In Busy Business with Olaf, {olaf_price} on itch.io ({PRODUCTS['olaf']['url']}), {ON_OWN_CLAUDE}.",
              f"- [Download Busy Business]({b}/business/download.html): the free Busy Business app for Mac and Windows (beta); no AI, nothing sent anywhere. A zip for the browser is there too.",
              f"- [All business tools]({b}/business/tools.html): what each tool does.",
              "", "## Busy Games: free daily brain games", "",
              f"- [Busy Games]({b}/games/index.html): four free logic puzzles in the browser or as a free app for Mac and Windows (beta), a new one every day and {GAME_LEVELS:,} levels each. No account."]
    lines += [f"- [Busy Street: Tuck's Errand]({b}/games/tucks-errand.html): Busy's free puzzle adventure, in the browser or as a free app for Mac and Windows (beta). Six levels, six friends to cut loose from the Red Tape; the download has a film at the start and end of every level. No AI, no account. In six languages in the browser; the app is in English for now."]
    lines += [f"- [{g['name']}]({b}/games/{g['id']}.html): {g['desc']}" for g in GAMES]
    if GROWTH_LIVE:
        lines += ["", "## Busy Growth: free tools to grow your career", "",
                  f"- [Busy Growth]({b}/growth/index.html): {len(GROWTH_TOOLS)} free tools: a library of what you read and learn, skills, wins, a learning plan, a job tracker, a CV builder, interview stories, contacts and a weekly review. Ivy, an AI career coach, comes with the paid edition.",
                  f"- [Download Busy Growth]({b}/growth/index.html#get): the free Busy Growth app for Mac and Windows (beta), or a zip for the browser."]
        lines += [f"- [{t['name']}]({b}/growth/{t['id']}.html): {t['description']}" for t in suite_tools("growth")]
        lines += [f"- [Ivy, the career coach]({b}/growth/ivy.html): learn it, prove it, land it; never invents experience. In Busy Growth with Ivy, {PRODUCTS['ivy']['price']} once on itch.io ({PRODUCTS['ivy']['url']}), {ON_OWN_CLAUDE}."]
    else:
        lines += ["", "## Busy Growth: free tools to grow your career (coming soon)", "",
                  f"- [Busy Growth]({b}/growth/index.html): a library of what you read and learn, skills, wins, a learning plan, a job tracker and a CV builder, plus Ivy, an AI career coach. Not released yet."]
    lines += (["", "## Busy Home: free tools for household paperwork", "",
               f"- [Busy Home]({b}/home/index.html): {len(HOME_TOOLS)} free tools: documents that warn before they expire, contracts with the last day to cancel, home upkeep, a home inventory with an insurance claim pack, letters, a moving planner and a Just in Case binder. Juno, an AI household assistant, comes with the paid edition.",
               f"- [New in Busy Home 2.1]({b}/home/index.html#new): for a household of any size. " + " ".join(f"{n}: {d}" for _, n, d, _ in HOME_NEW),
               f"- [Download Busy Home]({b}/home/index.html#get): the free Busy Home app for Mac and Windows (beta), or a zip for the browser."]
              + [f"- [{t['name']}]({b}/home/{t['id']}.html): {t['description']}" for t in suite_tools("home")]
              + [f"- [Juno, the household assistant]({b}/home/juno.html): explains letters, writes the replies and keeps the household ahead. In Busy Home with Juno, {PRODUCTS['juno']['price']} once on itch.io ({PRODUCTS['juno']['url']}), {ON_OWN_CLAUDE}."]
              if HOME_LIVE else ["", "## Busy Home: free tools for household paperwork (coming soon)", "",
               f"- [Busy Home]({b}/home/index.html): documents, contracts with the last day to cancel, upkeep, a home inventory, letters, moving and a Just in Case binder. Not released yet."])
    lines += [
              "", "## About", "",
              f"- [About Busy]({b}/about.html): what it is, who it is for, and how it works.",
              f"- [Free and paid: what Busy costs]({b}/pricing.html): the tools are free and stay free; each suite's AI expert is paid once on itch.io.",
              f"- [How the experts connect to Claude]({b}/claude-key.html): the Claude app the owner already has, or their own API key, and what each costs.",
              f"- [What's new in Busy]({b}/updates.html): every release of the free apps and the website, newest first.",
              f"- [Films]({b}/films/index.html): the short films of the apps with their experts, the brain games and the game Busy Street.",
              f"- [Press kit]({b}/press.html): what Busy is in a few lines, with its logos, characters, pictures and films to download.",
              f"- [Privacy]({b}/privacy.html): what happens to data (nothing is sent to us).",
              f"- [Terms]({b}/terms.html)",
              "", "## Optional", "",
              f"- [llms-full.txt]({b}/llms-full.txt): all of the above with every tool's and game's features and questions in one file."]
    if RENTALS_LIVE:
        lines[lines.index("## About") - 1:lines.index("## About") - 1] = rentals_llms(b)
    if KITCHEN_LIVE:
        lines[lines.index("## About") - 1:lines.index("## About") - 1] = kitchen_llms(b)
    (SITE / "llms.txt").write_text("\n".join(lines) + "\n")

    full = [f"# Busy: the full picture", "", ENTITY, "", f"Website: {b}/", "", DISAMBIGUATION, "",
            "# Busy Business: free tools for small businesses", "", f"Page: {b}/business/index.html", "",
            "## How it works", "",
            f"1. Download the free Busy Business app for Mac or Windows (beta) from {b}/business/download.html and install it. Without installing, a zip that runs in Chrome or Edge is there too.",
            "2. Open Busy Business.",
            "3. Every tool saves plain files in its own folder (Documents/Busy/Business, or one you choose); put the folder in Google Drive, Dropbox, OneDrive or iCloud Drive for backups and syncing.",
            "4. Busy also keeps a daily backup in that folder. There is no account and no server: nothing is sent to us.",
            "", "## Editions", "",
            f"- Free app (Mac and Windows, beta) and free download: all {len(tools)} tools, the Marketing Studio included. No AI, no account, no subscription.",
            f"- Busy Business with Olaf ({PRODUCTS['olaf']['price']} once on itch.io, {PRODUCTS['olaf']['url']}): the same tools plus Olaf, the brand consultant, on the owner's own Claude.",
            f"- Website demo: every tool filled with a pretend design studio, at {b}/app/index.html. Nothing is kept after the tab closes.", ""]
    for t in tools:
        full += [f"## {t['name']}", "", f"{t['h1']} {t['lead']}", "", f"Page: {b}/business/{t['id']}.html", "", "What it does:"]
        full += [f"- {f[1]}: {f[2]}" for f in t["features"]]
        full += ["", "Questions:"] + [f"- {q} {a}" for q, a in t["faq"]] + [""]
    full += ["## Olaf, the brand consultant (paid edition of Busy Business)", "",
             f"Page: {b}/business/olaf.html. {OLAF_PRICE}.", "", "Marketing:"]
    full += [f"- {f[1]}: {f[2]}" for f in OLAF_FEATS] + ["", "Projects:"] + [f"- {f[1]}: {f[2]}" for f in OLAF_PROJECT_FEATS]
    full += ["", "Questions:"] + [f"- {q} {a}" for q, a in OLAF_FAQ]
    full += ["", "# Busy Street: Tuck's Errand: a free game", "", f"Page: {b}/games/tucks-errand.html. A puzzle adventure on Busy Street: the Red Tape has crept over the street, and Tuck only went out to get a stamp back. Six levels and six friends to cut loose. You swap between two figures on screen, call in the others, throw pots, keys and each other, climb, swing and roll, hide from inspectors and solve logic puzzles. Free, in the browser or as a download for Mac and Windows (beta); the download has a film at the start and end of every level and plays without the internet. No AI and no account. In six languages in the browser; the app is in English for now."]
    full += ["", "# Busy Games: free daily brain games", "", f"Page: {b}/games/index.html. Four logic puzzles that run in the browser, a new one every day and {GAME_LEVELS:,} levels each. Progress stays in the browser; no account.", ""]
    for g in GAMES:
        full += [f"## {g['name']} ({g['classic']})", "", g["about"], f"Page: {b}/games/{g['id']}.html", "", "Rules:"] + [f"- {r}" for r in g["rules"]] + [""]
    full += ["Questions:"] + [f"- {q} {a}" for q, a in GAMES_FAQ]
    full += (["", "# Busy Growth: free tools to grow your career", "", f"Page: {b}/growth/index.html. Free, as its own app for Mac and Windows ({b}/growth/index.html#get) or a zip for the browser ({b}/downloads/busy-growth.zip), with a demo at {b}/app/growth.html. The tools:", ""]
             if GROWTH_LIVE else ["", "# Busy Growth: free tools to grow your career (coming soon)", "", f"Page: {b}/growth/index.html. Not released yet. Planned tools:", ""])
    full += [f"- {n}: {d}" for _, n, d in GROWTH_TOOLS]
    full += ["", f"Ivy by Busy, the career coach, comes in Busy Growth with Ivy ({PRODUCTS['ivy']['price']} once on itch.io, {PRODUCTS['ivy']['url']}), on the owner's own Claude. Ivy never invents experience: every CV line comes with its proof."]
    full += (["", "# Busy Home: free tools for household paperwork", "", f"Page: {b}/home/index.html. Free, as its own app for Mac and Windows ({b}/home/index.html#get) or a zip for the browser ({b}/downloads/busy-home.zip), with a demo at {b}/app/home.html. The tools:", ""]
             if HOME_LIVE else ["", "# Busy Home: free tools for household paperwork (coming soon)", "", f"Page: {b}/home/index.html. Not released yet. Planned tools:", ""])
    full += [f"- {n}: {d}" for _, n, d in HOME_TOOLS]
    if HOME_LIVE:
        full += ["", "New in Busy Home 2.1, for a household of any size:", ""] + [f"- {n}: {d}" for _, n, d, _ in HOME_NEW]
    full += ["", f"Juno by Busy, the household assistant, comes in Busy Home with Juno ({PRODUCTS['juno']['price']} once on itch.io, {PRODUCTS['juno']['url']}), on the owner's own Claude. It explains letters, reads contracts and policies, writes replies and keeps renewals in view. It never gives legal advice.",
             "", "# Privacy in short", "",
             "The tools never send us anything. Business data stays in the owner's folder; the games keep progress in the browser. The waitlists keep an email address in MailerLite, only to say when Olaf or Busy Growth can be had. What an expert reads goes to Anthropic under the owner's own Claude account or key, never to Busy.",
             f"Full text: {b}/privacy.html", ""]
    if RENTALS_LIVE:
        at = full.index("# Privacy in short") - 1
        full[at:at] = rentals_llms_full(b)
    if KITCHEN_LIVE:
        at = full.index("# Privacy in short") - 1
        full[at:at] = kitchen_llms_full(b)
    (SITE / "llms-full.txt").write_text("\n".join(full))


def ai_models() -> list:
    """The models and list prices Olaf, Ivy and Juno offer, read from shared/ai.js so there is one source."""
    src = (APP / "shared" / "ai.js").read_text()
    rows = re.findall(r"\{ id: '([^']+)', name: '([^']+)', model: '([^']+)', input: ([\d.]+), output: ([\d.]+)", src)
    if not rows:
        raise SystemExit("shared/ai.js: could not read the model list")
    return [{"id": i, "name": n, "model": m, "input": float(a), "output": float(b)} for i, n, m, a, b in rows]


def claude_key_page(tools: list) -> str:
    """How an expert connects to Claude: the person's own Claude app first (the steps the app shows on Connect), then an API key (the same steps as the guide inside them, ai.setup)."""
    def per_chat(m):  # about 30,000 tokens read and 2,000 written, as in ai.perChat
        v = (30000 * m["input"] + 2000 * m["output"]) / 1e6
        return "under $0.01" if v < 0.01 else f"about ${v:.2f}"
    costs = "".join(f"<tr><td><b>{e(m['name'])}</b><br><small>{e(m['model'])}</small></td><td>${m['input']:g} / ${m['output']:g}</td><td>{per_chat(m)}</td></tr>" for m in ai_models())
    steps = [
        ("Make a Claude Console account", "Go to <b>console.anthropic.com</b> and sign up with your email or Google account. Confirm your email. If it asks what you will build, “personal use” is fine."),
        ("Add a little credit", "Open <b>Settings → Billing</b> (it may be called Plans &amp; Billing), add a card and buy credit. The smallest amount, about $5, is enough to start. Leave auto-reload off if you never want to pay more than you put in. Under <b>Settings → Limits</b> you can also set a monthly spend limit."),
        ("Create your API key", "Open <b>Settings → API keys</b> and click <b>Create key</b>. Name it something like “Busy Olaf” or “Busy Ivy”. Copy it straight away: it starts with <code>sk-ant-</code> and is shown only once. Lost it? Delete it and make a new one."),
        ("Paste it into your expert", "The first time you start one, a guide asks for the key, tests it with a tiny request and saves it in that browser. You also set a monthly limit in Busy, and Busy stops sending requests when you reach it."),
    ]
    faq = [("Does my Claude subscription cover this?", "With the easy way, yes: the expert then works inside your own Claude app, within the plan you already pay for. An API key is billed separately by Anthropic, pay-as-you-go."),
           ("What does the expert see?", "Busy writes a short briefing into a folder called Claude inside your Busy folder: where things stand today. Your Claude reads that, and writes its prepared work back into the same folder. It never changes your records: Busy does that, when you say yes."),
           ("Where is my key kept?", "In the browser on your computer only: never in your business or growth folder, never on a Busy server (there is none). It is sent only to Anthropic, with each request."),
           ("What if someone gets my key?", "Delete it in the console under Settings → API keys, make a new one and paste that in. The old one stops working at once."),
           ("Can I use it on two computers?", "Yes. Paste the same key on each, or make one key per computer so you can switch one off on its own."),
           ("How do I see what I spent?", "Busy shows an estimate for this month in AI settings. The exact amount is in the console under Usage and Billing.")]
    desc = "Two ways to connect a Busy expert to Claude: the Claude app with a paid plan, in three steps, or your own API key. What each costs."
    names = [PRODUCTS[k]["who"] for k in experts_live()]
    return f"""{head("How a Busy expert connects to your Claude", desc, "claude-key.html", "")}
<body class="site app-grape">
{nav("", explore(""))}
<main class="page">
  <h1 class="reveal">Connect your expert to Claude</h1>
  <p class="lead reveal">{", ".join(names[:-1])} and {names[-1]} think with Claude, the AI made by Anthropic. There are two ways to connect them. Both keep your work on your own computer, and nothing goes to us.</p>
  <p class="reveal"><b>{CLAUDE_LINE}</b> New to Claude? The free app is complete on its own.</p>
  <p class="reveal"><b>Just bought on itch.io?</b> Download your app from its itch.io page and open it. Press Connect in the left rail: the app shows these same steps.</p>
  <h2>The easy way: the Claude app</h2>
  <p>For anyone with the Claude app and a paid Claude plan. The expert works inside your own Claude: if you already pay for Claude, the expert's price is all you pay.</p>
  <ol><li><b>Add the expert to your Claude</b><br>In Busy, press Connect and save the plugin file. In Claude, open Cowork, choose Customize, then Plugins, and upload the file.</li>
  <li><b>Show Claude your Busy folder</b><br>When Claude asks which folder to work in, choose the folder Busy saves in.</li>
  <li><b>Say hello</b><br>Busy opens Claude with the first sentence typed in. Press Enter.</li></ol>
  <p>From then on the expert prepares the work in Claude, and it shows in Busy under “Needs your yes”. Nothing changes in your records until you say yes.</p>
  <h2>Or with your own API key</h2>
  <p>For anyone who prefers to pay as they go. You pay Anthropic directly for what you use, and your key never leaves your browser except to go to Anthropic. Setting it up takes about five minutes, once.</p>
  <h3>You need</h3>
  <ul><li>An email address</li><li>A payment card</li><li>Five minutes</li></ul>
  <h3>The steps</h3>
  <ol>{"".join(f"<li><b>{e(n)}</b><br>{d}</li>" for n, d in steps)}</ol>
  <p><a class="btn" href="https://console.anthropic.com" rel="noopener" target="_blank">↗ Open console.anthropic.com</a></p>
  <h3>What a key costs</h3>
  <p>Anthropic's list prices, in US dollars per million tokens (about 750,000 words) read / written, and what a typical conversation costs. A conversation here means an expert reading about 30,000 tokens of your files and the chat, and writing about 2,000. Estimates: long documents and web searches cost more.</p>
  <div class="cmp" role="region" aria-label="What each model costs" tabindex="0"><table><thead><tr><th>Model</th><th>Read / write</th><th>A typical conversation</th></tr></thead><tbody>{costs}</tbody></table></div>
  <h2>Questions</h2>
  {"".join(f"<h3>{e(q)}</h3><p>{e(a)}</p>" for q, a in faq)}
  <p class="row-flex" style="margin-top:22px">{"".join(f'<a class="btn{" btn-primary" if k == "olaf" else ""}" href="{EXPERT_PAGE[k]}">Meet {PRODUCTS[k]["who"]} →</a>' for k in experts_live())}</p>
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


def about_page(tools: list) -> str:
    """What Busy is, in plain facts: the page search engines and AI assistants read to describe us."""
    live = experts_live()
    prices = ", ".join(f'{PRODUCTS[k]["name"]} {PRODUCTS[k]["price"]}' for k in live)
    suites = (f"Busy Business: {len(tools)} free tools for small businesses and freelancers. Busy Growth: " + (f"{len(GROWTH_TOOLS)} free tools to grow your career." if GROWTH_LIVE else "free tools to grow your career, coming soon.")
              + (f" Busy Home: {len(HOME_TOOLS)} free tools for household paperwork." if HOME_LIVE else "")
              + (f" Busy Rentals: {len(RENTALS_TOOLS)} free tools for people who let one home or a few." if RENTALS_LIVE else "")
              + (f" Busy Kitchen: {KITCHEN_DISHES} dishes from six kitchens, matched to what's in your fridge." if KITCHEN_LIVE else "")
              + f" Busy Games: four free daily logic puzzles with {GAME_LEVELS:,} levels each.")
    who = ("People who would rather spend their time on what matters: small business owners and freelancers, " + ("" if GROWTH_LIVE else "soon ") + "anyone growing their career"
           + (", households with paperwork to keep" if HOME_LIVE else "") + (", people who let a home" if RENTALS_LIVE else "") + (", home cooks" if KITCHEN_LIVE else "") + ", and anyone who likes a daily puzzle.")
    facts = [("What it is", ENTITY),
             ("The suites", suites),
             ("Who it is for", who),
             ("What it costs", f"Every suite's tools are free. A paid edition of each suite adds its AI expert, bought once on itch.io: {prices}. The experts work on the owner's own Claude: the Claude app with a paid plan, or a Claude API key."),
             ("Where the data lives", "In a folder the owner chooses on their own computer, as plain files. There is no account and no server, so nothing is sent to us. The games keep your streak in your browser."),
             ("What it runs on", "Busy is desktop apps for Mac (macOS 13 or newer) and Windows (10 or 11), each with a demo that runs in the browser." + (" The free Busy Kitchen opens in the browser." if KITCHEN_LIVE else "") + " The games run in any modern browser."),
             ("How the marketing tools work", "Busy Business's Marketing Studio and Olaf are built on proven marketing science: reach more buyers, be the business people think of in the moments they need you, and be easy to find and buy from."),
             ("Languages", "English, Dutch, German, Spanish, Italian and Brazilian Portuguese. Invoices, quotes and letters can be made in any of them."),
             ("The name", f"Busy, {DESCRIPTOR}, at busy.com.ai. Called Busywork until October 2026. Not related to BUSY accounting software.")]
    desc = "What Busy is: free, private tools for work and life, in suites for business, household paperwork, " + ("career growth and brain games" if GROWTH_LIVE else "brain games and soon career growth") + ". Your files stay yours."
    # the suites after Busy Business and Busy Growth: each tool with the words its own page uses (so they are translated already)
    tool_list = lambda folder, rows, links=True: '<ul class="about-tools">' + "".join(
        (f'<li><a href="{folder}/{t["id"]}.html"><span aria-hidden="true">{t["emoji"]}</span> {e(t["name"])}</a><span>{e(t["description"])}</span></li>' if links
         else f'<li><b><span aria-hidden="true">{t[0]}</span> {e(t[1])}</b><span>{e(t[2])}</span></li>') for t in rows) + "</ul>"
    more = ""
    if HOME_LIVE:
        more += (f'<h2>🏡 Busy Home</h2>{tool_list("home", suite_tools("home"))}'
                 f'<p style="margin-top:14px"><a class="btn btn-primary" href="home/index.html#get">⬇️ Download free</a> <a class="btn" href="app/home.html">👀 See the demo</a> <a class="btn" href="{EXPERT_PAGE["juno"]}">Meet Juno →</a></p>')
    if RENTALS_LIVE:
        more += (f'<h2>🔑 Busy Rentals</h2>{tool_list("rentals", suite_tools("rentals"))}'
                 f'<p style="margin-top:14px"><a class="btn btn-primary" href="rentals/index.html#get">⬇️ Download free</a> <a class="btn" href="app/rentals.html">👀 See the demo</a> <a class="btn" href="{EXPERT_PAGE["wren"]}">Meet Wren →</a></p>')
    if KITCHEN_LIVE:
        more += (f'<h2>🍳 Busy Kitchen</h2>{tool_list("kitchen", KITCHEN_TOOLS, links=False)}'
                 f'<p style="margin-top:14px"><a class="btn btn-primary" href="app/kitchen.html">🍳 Open it in your browser</a> <a class="btn" href="{EXPERT_PAGE["sal"]}">Meet Sal →</a></p>')
    return f"""{head("About Busy: free, private tools for work and life", desc, "about.html", "")}
<body class="site app-sun">
{nav("", explore(""))}
<main class="page">
  <h1 class="reveal">About Busy</h1>
  <p class="lead reveal">{APPS_COUNT.capitalize()} free apps for {APPS_FOR}. The boring part made easy, or done for you by an expert. Everything stays in your own folder.</p>
  <dl class="about-facts">{"".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in facts)}</dl>
  <h2>💼 Busy Business</h2>
  <ul>{"".join(f'<li><a href="business/{t["id"]}.html">{t["emoji"]} {e(t["name"])}</a>: {e(t["description"])}</li>' for t in tools)}</ul>
  <p style="margin-top:14px"><a class="btn btn-primary" href="business/download.html">⬇️ Download all {len(tools)} tools</a> <a class="btn" href="app/index.html">👀 See the demo</a> <a class="btn" href="business/olaf.html">🧭 Meet Olaf</a></p>
  <h2>🌱 Busy Growth</h2>
  {'<p><a href="growth/index.html">Free tools to grow your career</a>: ' + ", ".join(e(n).lower().replace("cv ", "CV ").replace("linkedin", "LinkedIn") if i else e(n) for i, (_, n, _) in enumerate(GROWTH_TOOLS)) + '. <a class="btn" href="growth/index.html#get">⬇️ Download Busy Growth</a></p>' if GROWTH_LIVE else '<p>Coming soon: <a href="growth/index.html">free tools to grow your career, and Ivy, an AI coach</a>.</p>'}
  {more}
  <h2>🧩 Busy Games</h2>
  <ul>{"".join(f'<li><a href="games/{g["id"]}.html">{g["emoji"]} {e(g["name"])}</a>: {e(g["lead"])}</li>' for g in GAMES)}</ul>
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


def rentals_update() -> dict:
    """Busy Rentals' entry in What's new. It is here, not in website/content/updates.json, because that file is
    published: the entry appears only while Busy Rentals is live. Its date is the day the switch went on: the date
    the Rentals page has in the record of page dates, and today on the first build with the switch on."""
    rec = json.loads(DATES_FILE.read_text()) if DATES_FILE.exists() else {}
    day = LAUNCH_DAYS.get("rentals-1.0") or (rec.get("rentals/index.html") or [None, date.today().isoformat()])[1]   # the launch day: the page's own date moves with every edit
    return {"version": "Rentals 1.0", "id": "rentals-1.0", "date": day, "title": RENTALS_PROMISE,
            "items": [RENTALS_WHAT, *([n, d] for _, n, d in RENTALS_TOOLS), RENTALS_ANSWERS[2][1], RENTALS_ANSWERS[3][1]]}


def site_updates() -> list:
    """Every release, newest first: website/content/updates.json, and Busy Rentals' own entry while it is live.
    An item is a sentence, or [a name, a sentence] for one new thing."""
    ups = json.loads((SITE / "content" / "updates.json").read_text())["updates"]
    if RENTALS_LIVE:
        ups = sorted([rentals_update()] + ups, key=lambda u: u["date"], reverse=True)   # a stable sort: on one day, Rentals first
    if KITCHEN_LIVE:
        ups = sorted([kitchen_update()] + ups, key=lambda u: u["date"], reverse=True)
    return ups


def updates_page(tools: list) -> str:
    """What's new: every release, newest first (website/content/updates.json), with its RSS feed."""
    ups = site_updates()
    item = lambda i: f"<li>{e(i)}</li>" if isinstance(i, str) else f"<li><b>{e(i[0])}</b> <span>{e(i[1])}</span></li>"
    items = "".join(f'<article class="update" id="{u.get("id") or "v" + u["version"]}"><p class="update-when"><b>Busy {e(u["version"])}</b> · <time datetime="{u["date"]}">{e(u["date"])}</time></p>'
                    f'<h2>{e(u["title"])}</h2><ul>{"".join(item(i) for i in u["items"])}</ul></article>' for u in ups)
    desc = "What's new in Busy: every release of the free apps and the website, newest first."
    return f"""{head("What's new in Busy: every update", desc, "updates.html", "")}
<body class="site app-sun">
{nav("", explore(""))}
<main class="page">
  <h1 class="reveal">What's new</h1>
  <p class="lead reveal">Every release of Busy, newest first.</p>
  <p><a class="btn" href="feed.xml">📡 RSS feed</a> <a class="btn btn-primary" href="index.html#suites">🧰 Explore the apps</a></p>
  {items}
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


def updates_feed() -> str:
    """The RSS feed of What's new, for feed readers and the software directories that follow them."""
    import datetime
    from email.utils import format_datetime
    ups = site_updates()
    when = lambda d: format_datetime(datetime.datetime.fromisoformat(d + "T12:00:00+00:00"))
    x = lambda s: html.escape(s, quote=False)
    line = lambda i: i if isinstance(i, str) else f"{i[0]}: {i[1]}"
    items = "".join(f"<item><title>{x('Busy ' + u['version'] + ': ' + u['title'])}</title><link>{SITE_URL}/updates.html#{u.get('id') or 'v' + u['version']}</link>"
                    f"<guid isPermaLink=\"false\">busy-{u.get('id') or u['version']}</guid><pubDate>{when(u['date'])}</pubDate>"
                    f"<description>{x(' '.join(line(i) for i in u['items']))}</description></item>\n" for u in ups)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n'
            f"<title>Busy: what's new</title><link>{SITE_URL}/updates.html</link><description>Every release of Busy, free, private tools for work and life.</description>"
            f'<language>en</language><atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>'
            f"<lastBuildDate>{when(ups[0]['date'])}</lastBuildDate>\n{items}</channel></rss>\n")


def press_page(tools: list) -> str:
    """For journalists, bloggers and directories: what Busy is in a few lines, and the logos, characters, pictures
    and films to use with it, ready to download."""
    asset = lambda p, label, kind="", poster="": (f'<figure class="press-item"><a href="{p}" download>'
                                       + (f'<img src="{p.replace("-1920.jpg", "-1280.jpg")}" alt="{e(label)}" loading="lazy">' if not p.endswith(".mp4") else
                                          f'<video src="{p}" poster="{poster}" muted loop playsinline preload="none" aria-label="{e(label)}"></video>')
                                       + f'</a><figcaption>{e(label)}{f"<small>{e(kind)}</small>" if kind else ""}</figcaption></figure>')
    logos = [("assets/favicon.svg", "Busy logo", "SVG"), ("assets/logo-512.png", "Busy logo", "PNG, 512 px"),
             ("assets/olaf-mark.svg", "Olaf logo", "SVG"), ("assets/ivy-mark.svg", "Ivy logo", "SVG"), ("assets/juno-mark.svg", "Juno logo", "SVG")]
    people = [("app/shared/places/house/tuck-hello.png", "Tuck, the guide of Busy Home"), ("app/shared/places/workshop/rivet-hello.png", "Rivet, the guide of Busy Business"),
              ("app/shared/places/glasshouse/pim-hello.png", "Pim, the guide of Busy Growth"), ("assets/experts/olaf-hello.png", "Olaf, the AI expert for Busy Business"),
              ("assets/experts/ivy-hello.png", "Ivy, the career coach in Busy Growth"), ("assets/experts/juno-hello.png", "Juno, the household assistant in Busy Home")]
    places = [("assets/street/room-wide-1920.jpg", "Busy Street, every suite as a building")] + [
        (f"assets/{p}/room-{json.loads((SITE / 'assets' / p / 'rooms.json').read_text())['rooms'][0]['id']}-1920.jpg", FILM_TEXT[p][0])
        for p in ("workshop", "glasshouse", "house", "parlour") if (SITE / "assets" / p / "rooms.json").exists()]
    films = [(f"assets/{p}/loop-day.mp4", FILM_TEXT[p][0], "MP4", f"assets/{p}/room-{json.loads((SITE / 'assets' / p / 'rooms.json').read_text())['rooms'][0]['id']}-1280.jpg")
             for p in ("street", "workshop", "glasshouse", "house", "parlour") if (SITE / "assets" / p / "loop-day.mp4").exists()]
    trailers = [(f"assets/films/{x['film']}.mp4", x["name"], "MP4", f"assets/films/{x['film']}.jpg") for x in PRODUCTS.values() if (SITE / "assets" / "films" / f"{x['film']}.mp4").exists()] \
        + [("assets/films/busy-games.mp4", "Busy Games, the brain games", "MP4", "assets/films/busy-games.jpg")]
    sold = "".join(f'<li><a class="out" href="{e(x["url"])}" target="_blank" rel="noopener">{e(x["name"])} · {x["price"]} <span aria-hidden="true">↗</span></a>: {e(x["runs"])}</li>' for x in PRODUCTS.values())
    shares = [(f"assets/{f}", IMAGES["assets/" + f][0]) for f in ("og-busy.png", "og-business.png", "og-games.png", "og-olaf.png", "og-ivy.png", "og-juno.png")]
    short = "Busy makes free, private tools for work and life. Everything stays in your own folder: no account, no subscription."
    grid = lambda items, kind="": '<div class="press-grid">' + "".join(asset(it[0], it[1], it[2] if len(it) > 2 else kind, it[3] if len(it) > 3 else "") for it in items) + "</div>"
    desc = "Press and partners: what Busy is in a few lines, with its logos, characters, pictures and films to download."
    return f"""{head("Press kit: logos, pictures and films · Busy", desc, "press.html", "")}
<body class="site app-sun">
{nav("", explore(""))}
<main class="page">
  <h1 class="reveal">Press and partners</h1>
  <p class="lead reveal">Writing about Busy, or listing it? Everything here is yours to use with that, as it is.</p>
  <h2>Busy in a sentence</h2>
  <p class="press-copy">{e(short)}</p>
  <h2>Busy in a paragraph</h2>
  <p class="press-copy">{e(ENTITY)}</p>
  <p>The name is Busy, written like that, at busy.com.ai. The experts are written {"Olaf by Busy, Ivy by Busy, Juno by Busy, Wren by Busy and Sal by Busy" if RENTALS_LIVE and KITCHEN_LIVE else "Olaf by Busy, Ivy by Busy, Juno by Busy and Wren by Busy" if RENTALS_LIVE else "Olaf by Busy, Ivy by Busy and Juno by Busy"}. More facts: <a href="about.html">About Busy</a>.</p>
  <h2>Logos</h2>{grid(logos)}
  <h2>The characters</h2><p>Rendered in the Busy Studio. Please keep them as they are: no new poses, words or colours.</p>{grid(people, "PNG")}
  <h2>The places</h2>{grid(places, "JPG, 1920 px")}
  <h2>Short films</h2><p>Eight seconds each, made to loop.</p>{grid(films, "MP4")}
  <h2>Product films</h2><p>Half a minute to a minute each: the {APPS_COUNT} apps with their experts, the two Busy Street games and the brain games.</p>{grid(trailers, "MP4")}
  <h2>Where it is sold</h2><p>The tools and the brain games are free on this site. The paid apps and the Busy Street games are sold on itch.io, each on its own page, paid once:</p><ul>{sold}</ul>
  <p>The experts work on the buyer’s own Claude: the Claude app with a paid plan, or a Claude API key.</p>
  <h2>Share images</h2>{grid(shares, "PNG, 1200 × 630")}
</main>
{footer("", tools)}
<script src="assets/site.js"></script>
</body>
</html>
"""


def apply_site_url() -> None:
    """The hand-written pages carry the placeholder address; the published copies carry the real one.
    Locally nothing changes (the placeholder is the default); on GitHub the workflow passes the domain."""
    if SITE_URL == "https://busywork.example":
        return
    for f in site_pages(forwards=True) + [SITE / "assets" / "site.js"]:
        text = f.read_text()
        if "https://busywork.example" in text:
            f.write_text(text.replace("https://busywork.example", SITE_URL))


def site_counter() -> None:
    """Counts visits with Cloudflare Web Analytics when CF_ANALYTICS_TOKEN is set (a GitHub variable; the token is public, it only says which site is counted).
    No cookies, website pages only, never under app/. The numbers are in the owner's Cloudflare account; nothing shows on the site. Without it, nothing is added."""
    privacy = SITE / "privacy.html"
    text = privacy.read_text()
    section = """<h2 id="counting">Counting visits</h2>
  <p>We count visits to this website with Cloudflare Web Analytics, so we can see which pages are useful. It sets no cookies and doesn't follow you to other sites, and we only see totals. It runs on the website's pages, never inside the tools.</p>
  """ if CF_ANALYTICS_TOKEN else ""
    text = re.sub(r"<!-- counting -->.*?<!-- /counting -->", lambda m: f"<!-- counting -->{section}<!-- /counting -->", text, flags=re.S)
    privacy.write_text(text)
    tag = f"""<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "{e(CF_ANALYTICS_TOKEN)}"}}'></script>""" if CF_ANALYTICS_TOKEN else ""
    game = SITE / "games" / "tucks-errand" / "index.html"
    for f in site_pages() + ([game] if game.exists() else []):  # some pages are hand-written and keep what an earlier build added: take the old tag out first
        t = re.sub(r"""<script defer src="https://static\.cloudflareinsights\.com/beacon\.min\.js"[^>]*></script>""", "", f.read_text())
        f.write_text(t.replace("</head>", tag + "</head>", 1) if tag else t)


def site_csp() -> None:
    """A light security policy on every website page: no plugins, no <base> hijacking, and forms post
    only to this site or the waitlist service. Scripts are not restricted here because the ad network
    loads its own; the tools under app/ carry a strict policy of their own (scripts from Busy's
    files only, network to Anthropic only), which is where the owner's API key lives."""
    forms = "'self'"
    for name, url in (("WAITLIST_ENDPOINT", WAITLIST_ENDPOINT), ("GROWTH_WAITLIST_ENDPOINT", GROWTH_WAITLIST_ENDPOINT)):
        if url:
            m = re.match(r"https://[^/]+", url)
            if not m:
                raise SystemExit(f"{name} must be an https:// address")
            if m.group(0) not in forms:
                forms += " " + m.group(0)
    meta = f'<meta http-equiv="Content-Security-Policy" content="object-src \'none\'; base-uri \'self\'; form-action {forms}">'
    for f in site_pages():
        text = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', "", f.read_text())
        text, n = re.subn(r'(<meta charset="[^"]+">\n?)', lambda m: m.group(1) + meta + "\n", text, count=1, flags=re.I)
        if not n:
            raise SystemExit(f"{f.relative_to(ROOT)} has no <meta charset>")
        f.write_text(text)


# ---------- other languages ----------
# Every page also exists in Dutch, German, Spanish, Italian and Brazilian Portuguese, under /<lang>/ (i18n/i18n.py
# translates the finished English page; the words are in i18n/<lang>.json). Each page says which versions exist
# (hreflang), the footer lets people switch, and a first visit to an English page goes to the browser's language
# once, unless the visitor chose a language before (the choice is kept in the browser).
sys.path.insert(0, str(ROOT / "i18n"))
import i18n as I18N  # noqa: E402

LANG_LABEL = {"en": "English", **I18N.LANGS}
# Sends a first visit to the browser's language; never search engines, never after a choice (busy.lang).
LANG_REDIRECT = ("<script>(function(){try{if(/bot|crawl|spider|slurp|preview/i.test(navigator.userAgent))return;var c=localStorage.getItem('busy.lang');"
                 "if(c)return;var l=(navigator.languages||[navigator.language||''])[0].toLowerCase(),k=l.slice(0,2)==='pt'?'pt-br':l.slice(0,2);"
                 "var a=document.querySelector('link[rel=alternate][hreflang=\"'+(k==='pt-br'?'pt-BR':k)+'\"]');if(a&&k!=='en')location.replace(a.href+location.hash);}catch(e){}})();</script>")


HUBS = "business|growth|home|rentals|kitchen|games|films"


def hub_addresses() -> None:
    """A suite's front page has one address, its folder (/business/), not two (/business/index.html as well): in the
    pages' own links, the canonical and sharing addresses, the structured data, the sitemap and llms.txt. Runs
    before the translations are made, so every language gets the same."""
    absolute = re.compile(re.escape(SITE_URL) + rf"/((?:{HUBS})/)index\.html")
    link = re.compile(rf'href="((?:/|(?:\.\./)*)(?:(?:{HUBS})/)?)index\.html(#[^"]*)?"')  # relative, or from the root as on the 404 page
    for f in site_pages():
        t = f.read_text()
        new = absolute.sub(lambda m: f"{SITE_URL}/{m.group(1)}", t)
        new = link.sub(lambda m: f'href="{(m.group(1) or "./") + (m.group(2) or "")}"', new)
        if new != t:
            f.write_text(new)
    for name in ("sitemap.xml", "llms.txt", "llms-full.txt", "feed.xml"):
        f = SITE / name
        if f.exists():
            t = f.read_text()
            new = absolute.sub(lambda m: f"{SITE_URL}/{m.group(1)}", t)
            if new != t:
                f.write_text(new)


def short_description(text: str, limit: int = 160) -> str:
    """A description that fits a search result: whole sentences up to the limit, or whole words and an ellipsis."""
    if len(text) <= limit:
        return text
    cut = text[:limit + 1]
    stops = [m.end() for m in re.finditer(r"[.!?](?= )", cut) if m.end() <= limit]
    if stops and stops[-1] >= 80:
        return text[:stops[-1]]
    return cut[:limit - 1].rsplit(" ", 1)[0].rstrip(",;:") + "…"


SHORT_TITLES = {k: v for k, v in json.loads((ROOT / "i18n" / "short-titles.json").read_text()).items() if k != "_"} \
    if (ROOT / "i18n" / "short-titles.json").exists() else {}


def short_title(text: str, limit: int = 60) -> str:
    """A title that fits a search result. A tool page's title ends with its suite's name; where that makes it too long,
    with Busy alone; still too long, without the name (the address says it); and a translation that is still too long
    takes its shorter version from i18n/short-titles.json."""
    if len(text) <= limit:
        return text
    text = re.sub(r" · Busy (Growth|Home|Rentals)$", " · Busy", text)
    if len(text) > limit:
        text = re.sub(r" · Busy( Business| Growth| Home| Rentals| Games)?$", "", text)
    body = SHORT_TITLES.get(text, text)
    return body + " · Busy" if body != text and len(body) + 7 <= limit else body


def lang_links(rel: str, here: str) -> tuple:
    """(hreflang tags, the footer's language links) for one page, seen from the version in language `here`."""
    rel = rel[:-len("index.html")] if rel.endswith("/index.html") else rel  # a suite's front page is its folder
    url = lambda lang: f"{SITE_URL}/" + ("" if lang == "en" else lang + "/") + ("" if rel == "index.html" else rel)
    tags = "".join(f'<link rel="alternate" hreflang="{"en" if l == "en" else I18N.HTML_LANG[l]}" href="{url(l)}">' for l in LANG_LABEL)
    tags += f'<link rel="alternate" hreflang="x-default" href="{url("en")}">'
    depth = rel.count("/") + (0 if here == "en" else 1)
    up = "../" * depth
    current = ' aria-current="true"'
    page = "" if rel == "index.html" else rel
    links = "".join(f'<a href="{(up + ("" if l == "en" else l + "/") + page) or "./"}" data-lang="{l}" hreflang="{"en" if l == "en" else I18N.HTML_LANG[l]}"{current if l == here else ""}>{LANG_LABEL[l]}</a>'
                    for l in LANG_LABEL)
    return tags, f'<nav class="langs" aria-label="Language">🌐 {links}</nav>'


# Which of a room's two pictures a screen gets: the 1920 one where the screen shows more than 1400 points across (its
# width times its sharpness, counted in steps), the 1280 one on a phone. place.js reads PLATE_WIDE from the page (the
# <source media>), so the page and the script ask for the same file and it is fetched once. PLATE_SMALL is every other screen.
PLATE_WIDE = ("(min-width: 1401px), (min-width: 1121px) and (min-resolution: 1.25dppx), "
              "(min-width: 934px) and (min-resolution: 1.5dppx), (min-width: 701px) and (min-resolution: 2dppx)")
PLATE_SMALL = ("(max-width: 700px), (max-width: 933px) and (max-resolution: 1.99dppx), "
               "(max-width: 1120px) and (max-resolution: 1.49dppx), (max-width: 1400px) and (max-resolution: 1.24dppx)")


def webp_pictures() -> None:
    """Each <img> of a JPEG or PNG that has a WebP copy (tools/webp.py) becomes <picture> with the WebP first; browsers
    without WebP, and anything that reads the old file, still get the original. picture{display:contents} in site.css.
    The first room of a place (the picture people wait for) comes in the size the screen needs and is asked for first.
    A film's poster is not fetched with the page: site.js sets it when the film comes near the screen. The poster stays
    in a <noscript> copy of the film, for browsers without scripts, and site.js reads its address from there."""
    sys.path.insert(0, str(ROOT / "tools"))
    import webp
    webp.main()
    img = re.compile(r'(?<!type="image/webp">)<img(?P<a>[^>]*?) src="(?P<src>[^"#?]+)\.(?P<ext>png|jpe?g)"(?P<b>[^>]*)>')
    # the first room, fetched early: written by PLACE_HEAD (a JPEG), or as an earlier build left it on a hand-made page
    preload = re.compile(r'(?:<link rel="preload" href="[^"]+/room-[^"/]+-(?:1920|1280)\.(?:jpg|webp)" as="image"[^>]*>\n?)+')
    film = re.compile(r'(?<!<noscript>)<video\b(?P<a>[^>]*?) poster="(?P<src>[^"#?]+)\.(?P<ext>png|jpe?g)"(?P<b>[^>]*)></video>')
    n = lazy = 0
    for f in site_pages():
        t = f.read_text()
        has = lambda path: (f.parent / path).exists()

        def wrap(m):
            nonlocal n
            src = m.group("src")
            if src.startswith(("http:", "https:", "data:")) or not has(src + ".webp"):
                return m.group(0)
            n += 1
            if "data-house-plate" in m.group(0) and src.endswith("-1920") and has(src[:-4] + "1280.webp"):
                return (f'<picture><source media="{PLATE_WIDE}" srcset="{src}.webp" type="image/webp">'
                        f'<source srcset="{src[:-4]}1280.webp" type="image/webp">{m.group(0)}</picture>')
            return f'<picture><source srcset="{src}.webp" type="image/webp">{m.group(0)}</picture>'
        new = img.sub(wrap, t)

        def early(m):  # as WebP (type= lets a browser without WebP skip it), and before the other pictures
            stem = re.search(r'href="([^"]+)-(?:1920|1280)\.(?:jpg|webp)"', m.group(0)).group(1)
            if not has(stem + "-1920.webp"):
                return f'<link rel="preload" href="{stem}-1920.jpg" as="image" fetchpriority="high">\n'
            if not has(stem + "-1280.webp"):
                return f'<link rel="preload" href="{stem}-1920.webp" as="image" type="image/webp" fetchpriority="high">\n'
            return (f'<link rel="preload" href="{stem}-1920.webp" as="image" type="image/webp" media="{PLATE_WIDE}" fetchpriority="high">\n'
                    f'<link rel="preload" href="{stem}-1280.webp" as="image" type="image/webp" media="{PLATE_SMALL}" fetchpriority="high">\n')
        new = preload.sub(early, new)

        first = []  # the poster of a film that is the page itself (films/<name>.html): fetched at once, as WebP

        def later(m):
            nonlocal lazy
            src, tag = m.group("src"), m.group(0)
            webp_copy = not src.startswith(("http:", "https:", "data:")) and has(src + ".webp")
            if ' preload="none"' not in tag:
                if ' preload="metadata"' not in tag or not webp_copy:
                    return tag
                first.append(f'<link rel="preload" href="{src}.webp" as="image" type="image/webp" fetchpriority="high">\n')
            lazy += 1
            return f'<noscript>{tag}</noscript><video{m.group("a")} data-lazy-poster="{"webp" if webp_copy else m.group("ext")}"{m.group("b")}></video>'
        new = film.sub(later, new)
        if first and first[0] not in new:
            new = new.replace("</head>", first[0] + "</head>", 1)
        if new != t:
            f.write_text(new)
    print(f"webp: {n} pictures served as WebP first, {lazy} film posters fetched when they come near")


def translate_site() -> None:
    pages = {f.relative_to(SITE).as_posix(): f for f in site_pages()}
    for d in I18N.LANGS:
        if (SITE / d).exists():
            shutil.rmtree(SITE / d)
    english = {}
    for rel, f in pages.items():
        # a hand-written page keeps last build's language tags: take them out before adding them again
        t = re.sub(r'\n?<link rel="alternate" hreflang="[^"]*" href="[^"]*">', "", f.read_text())
        english[rel] = re.sub(r"\n?" + re.escape(LANG_REDIRECT), "", t)
    for rel, text in english.items():
        tags, langs = lang_links(rel, "en")
        en = re.sub(r"<title>(.*?)</title>", lambda m: "<title>" + html.escape(short_title(html.unescape(m.group(1))), quote=False) + "</title>", text.replace("<!--langs-->", langs), count=1, flags=re.S)
        en = re.sub(r'(<meta name="description" content=")([^"]*)(")', lambda m: m.group(1) + html.escape(short_description(html.unescape(m.group(2))), quote=True) + m.group(3), en, count=1)
        if rel != "404.html":
            en = re.sub(r'(<link rel="canonical"[^>]*>)', lambda m: m.group(1) + "\n" + tags + "\n" + LANG_REDIRECT, en, count=1)
        (SITE / rel).write_text(en)
        for lang in I18N.LANGS:
            tags_l, langs_l = lang_links(rel, lang)
            out = I18N.translate_html(text, lang, rel, set(pages), SITE_URL).replace("<!--langs-->", langs_l)
            # the share image in this language (tools/share_images.py), where there is one
            out = re.sub(r"/assets/(street|parlour)/loop-day\.mp4", lambda m: f"/assets/{m.group(1)}/loop-day-{lang}.mp4" if (SITE / "assets" / m.group(1) / f"loop-day-{lang}.mp4").exists() else m.group(0), out)
            out = re.sub(r"/assets/(og-[a-z]+)\.png", lambda m: f"/assets/{m.group(1)}-{lang}.png" if (SITE / "assets" / f"{m.group(1)}-{lang}.png").exists() else m.group(0), out)
            out = re.sub(r'(<meta name="description" content=")([^"]*)(")', lambda m: m.group(1) + html.escape(short_description(html.unescape(m.group(2))), quote=True) + m.group(3), out, count=1)
            out = re.sub(r"<title>(.*?)</title>", lambda m: "<title>" + html.escape(short_title(html.unescape(m.group(1))), quote=False) + "</title>", out, count=1, flags=re.S)
            if rel != "404.html":
                out = re.sub(r'(<link rel="canonical"[^>]*>)', lambda m: m.group(1) + "\n" + tags_l, out, count=1)
            # the moving parts (the guides' lines from scripts, the games) translate in the browser
            up = "../" * (rel.count("/") + 1)
            out = out.replace("</head>", f'<script src="{up}assets/i18n/{lang}.js"></script><script src="{up}app/shared/i18n.js" data-lang="{lang}"></script>\n</head>', 1)
            dst = SITE / lang / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(out)
    for lang in I18N.LANGS:
        (SITE / "assets" / "i18n").mkdir(parents=True, exist_ok=True)
        (SITE / "assets" / "i18n" / f"{lang}.js").write_text(I18N.runtime_js(lang, I18N.site_script_keys()))
    # the sitemap gets every language, and every address names its versions in the other languages (hreflang), so
    # search engines find them together and show each person their own; the places' films go in as videos
    sm = SITE / "sitemap.xml"
    text = sm.read_text()
    hl = {"en": "en", **I18N.HTML_LANG}
    urls = []
    for m in re.finditer(r"  <url><loc>([^<]*)</loc>(<lastmod>[^<]*</lastmod>)?</url>\n", text):
        path, mod = m.group(1)[len(SITE_URL) + 1:], m.group(2) or ""
        at = {"en": f"{SITE_URL}/{path}", **{l: f"{SITE_URL}/{l}/{path}" for l in I18N.LANGS}}
        alts = "".join(f'<xhtml:link rel="alternate" hreflang="{hl[l]}" href="{u}"/>' for l, u in at.items()) \
            + f'<xhtml:link rel="alternate" hreflang="x-default" href="{at["en"]}"/>'
        for l, u in at.items():
            urls.append(f"  <url><loc>{u}</loc>{mod}{alts}{video_sitemap(path, l)}</url>\n")
    sm.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                  'xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n'
                  + "".join(urls) + "</urlset>\n")
    n = sum(len(I18N.load(l)[2]) for l in I18N.LANGS)
    if n and os.environ.get("I18N_MISSING"):
        for l in I18N.LANGS:
            print(f"  {l}: " + " | ".join(sorted(I18N.load(l)[2])))
    print(f"website: {len(pages)} pages in {len(I18N.LANGS)} more languages" + (f"; {n} pieces of text still in English" if n else ""))


def video_sitemap(path: str, lang: str) -> str:
    """A page's film, for the video sitemap (Google's video results): the game's trailer on the game's page, and every
    film on its own page (FILMS: a film that gets a page there is listed here from that day). The rooms' loops are not
    films: see film_ld."""
    v = tuck_video(lang) if path == "games/tucks-errand.html" else None
    name = path[len("films/"):-len(".html")] if path.startswith("films/") and path.endswith(".html") else ""
    if name in FILMS and (SITE / "assets" / "films" / f"{name}.mp4").exists():
        tr = (lambda t: t) if lang == "en" else (lambda t: I18N.translate_text(t, lang))
        v = {"name": tr(FILMS[name][0]), "description": tr(FILMS[name][1]), "thumbnailUrl": f"{SITE_URL}/assets/films/{name}.jpg",
             "contentUrl": f"{SITE_URL}/assets/films/{name}.mp4", "duration": f"PT{film_seconds(name)}S"}
    if not v:
        return ""
    x = lambda s: html.escape(s, quote=True)
    return (f"<video:video><video:thumbnail_loc>{x(v['thumbnailUrl'])}</video:thumbnail_loc><video:title>{x(v['name'])}</video:title>"
            f"<video:description>{x(v['description'])}</video:description><video:content_loc>{x(v['contentUrl'])}</video:content_loc>"
            f"<video:duration>{re.sub(r'[^0-9]', '', v['duration'])}</video:duration><video:family_friendly>yes</video:family_friendly></video:video>")


def main() -> None:
    build_marketing()
    I18N.write_app_words()  # the apps' word lists, from i18n/<lang>.json
    copy_app()
    copy_olaf_demo()
    make_demo()
    make_zip()
    make_growth_zip()
    make_home_zip()
    make_rentals_zip()
    make_kitchen_zip()
    sync_rentals_assets()
    sync_kitchen_assets()
    build_pages()
    sync_growth_launch()
    sync_home_launch()
    sync_rentals_launch()
    sync_kitchen_launch()
    sync_homepage_paths()
    apply_site_url()
    image_metadata()
    site_seo()
    site_counter()
    site_csp()
    hub_addresses()
    webp_pictures()
    translate_site()
    settle_dates()
    leak_check()


if __name__ == "__main__":
    main()
