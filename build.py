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

START_HERE = """Busy - make your paperwork fun again.

1. Move this Busy folder somewhere you will find it again, like Documents.
2. Double-click index.html. It opens in your browser. Use Chrome or Edge: they can
   save your business as files in a folder (Safari and Firefox cannot).
3. Pick a folder for your business files. Put it inside Google Drive, Dropbox,
   OneDrive or iCloud Drive if you want backups and syncing.

Your data stays on your computer and is never sent to us. The free tools have no
AI and no account. Updating later? Replace this Busy folder with the new one.
Your business folder is separate, so nothing is lost.

Want more done for you? Olaf, the AI expert for marketing and projects, is the
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
GROWTH_FILES = {"growth.html", "growth-home.js", "shared/growth.js", "shared/growth.css", "shared/filetext.js", "shared/growth-examples.js"}


def growth_part(rel: str) -> bool:
    return rel in GROWTH_FILES or any(rel == f"apps/{a}" or rel.startswith(f"apps/{a}/") for a in GROWTH_APPS)


def copy_app() -> None:
    target = SITE / "app"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(APP, target, ignore=lambda d, names: [n for n in names if n.startswith(".") or (not GROWTH_LIVE and growth_part((Path(d) / n).relative_to(APP).as_posix()))])
    core = target / "shared" / "core.js"
    core.write_text(site_core(core.read_text()))
    print(f"website/app: {sum(1 for _ in target.rglob('*') if _.is_file())} files")


# The free download has no AI and no pretend business: the AI client is Olaf's (paid), and the example
# studio lives only in the website demo.
NOT_IN_DOWNLOAD = {"shared/ai.js", "shared/examples.js", "shared/growth-examples.js"}


def make_zip() -> None:
    downloads = SITE / "downloads"
    downloads.mkdir(exist_ok=True)
    out = downloads / "busy.zip"
    files = sorted(p for p in APP.rglob("*") if p.is_file() and not any(skip(part) for part in p.relative_to(APP).parents if part.name) and not skip(p)
                   and p.relative_to(APP).as_posix() not in NOT_IN_DOWNLOAD and not growth_part(p.relative_to(APP).as_posix()))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("Busy/START HERE.txt", START_HERE)
        for p in files:
            if p == APP / "shared" / "core.js":
                z.writestr("Busy/shared/core.js", site_core(p.read_text()))
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


def growth_zip_files() -> list:
    """What Busy Growth needs: the shared files and its own tools, none of the business tools."""
    out = []
    for p in sorted(APP.rglob("*")):
        rel = p.relative_to(APP).as_posix()
        if not p.is_file() or any(skip(part) for part in p.relative_to(APP).parents if part.name) or skip(p) or rel in NOT_IN_DOWNLOAD:
            continue
        if growth_part(rel) or rel.startswith("shared/"):
            out.append(p)
    return out


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
            if p == APP / "shared" / "core.js":
                z.writestr(name, site_core(p.read_text()))
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


def make_demo() -> None:
    """The website's copy of the tools is a demo: every page loads assets/demo.js before core.js, which
    fills the tools with the pretend studio for as long as the tab is open (see that file)."""
    pages = sorted((SITE / "app").rglob("index.html")) + [p for p in [SITE / "app" / "growth.html"] if p.exists()]
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
    src = (SITE / "business" / "index.html").read_text()
    found = re.findall(r'(<div class="scene" data-scene="(\w+)">.*?</div>)(?=\s*<div class="scene"|\s*</div>\s*</div>\s*</div>)', src, re.S)
    return {sid: block.replace('class="scene"', 'class="scene on"', 1) for block, sid in found}


OLAF_PRICE = "€149 once · checkout opens soon"
# Where "Get Olaf" goes once a payment provider is set up (it delivers the paid download and the
# licence key). Empty until then: the page shows the waitlist instead.
OLAF_CHECKOUT_URL = os.environ.get("OLAF_CHECKOUT_URL", "")
# The Olaf waitlist. The site has no server, so the form posts to a form service (Formspree or any
# service that accepts a normal form POST and answers JSON). Set both in the GitHub repository:
# Settings → Secrets and variables → Actions → Variables.
WAITLIST_ENDPOINT = os.environ.get("WAITLIST_ENDPOINT", "")
WAITLIST_PROVIDER = os.environ.get("WAITLIST_PROVIDER") or "MailerLite"
# Busy Growth has its own list (a second MailerLite form), so Olaf's list stays Olaf's.
GROWTH_WAITLIST_ENDPOINT = os.environ.get("GROWTH_WAITLIST_ENDPOINT", "")  # an empty GitHub variable means the default


def waitlist_form(where: str, endpoint: str = None, consent: str = None, button: str = "🧭 Put me on the list", who: str = None) -> str:
    """The sign-up form for people who want to buy Olaf when checkout opens. MailerLite (the default)
    takes its own field names: fields[email], and the business in fields[name] (the form's "Company"
    box is MailerLite's Name field). It confirms each address by email
    (double opt-in, set in MailerLite); Formspree takes plain names and a hidden spam trap."""
    endpoint = WAITLIST_ENDPOINT if endpoint is None else endpoint
    consent = consent or "Email me when Olaf can be bought, at the early-access price. Nothing else, and I can unsubscribe any time."
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


def paths_block(prefix: str) -> str:
    """The choice between the free toolbox and Olaf, shared by the homepage, the Studio page and the Olaf page."""
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
          <p class="price"><b>€0</b> <small>forever</small></p>
          <a class="btn btn-big" href="{prefix}business/download.html">⬇️ Download free</a>
        </article>
        <article class="card path featured reveal pop" style="transition-delay:.1s">
          <span class="chip chip-sun">Most help</span>
          <span class="e">🧭</span>
          <h3>Guided by Olaf, your AI expert for marketing and projects</h3>
          <p class="path-sub">A marketing coach and a project lead in one, inside Busy</p>
          <ul>
            <li><b>Looks at your business</b> and tells you where you stand</li>
            <li><b>A 90-day marketing plan</b>, then a ten-minute check-in each week with one to three steps that fit your hours</li>
            <li><b>Does the work with you</b>: writes the posts, review requests, newsletter and plan, fixes your listing text</li>
            <li><b>Runs your projects</b>: writes the plan, checks in every week, re-plans when something slips, drafts the update for your client</li>
            <li><b>One plan for both</b>: every marketing action is a task on your team's Project Board</li>
            <li><b>Remembers everything</b>, researches the web and reads your sales numbers for a monthly review</li>
          </ul>
          <p class="price"><b>€149</b> <small>once, plus your own Claude usage · checkout opens soon</small></p>
          <div class="row-flex"><a class="btn btn-big btn-primary" href="{prefix}business/olaf.html#get">🧭 Get on the list</a><a class="btn btn-big" href="{prefix}business/olaf.html">Meet Olaf</a><a class="btn btn-big" href="{prefix}app/apps/olaf/index.html">Try the demo</a></div>
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
            <tr><td>AI</td><td>None: you do the work</td><td>Claude, on your own key</td></tr>
            <tr><td>Who decides what to do next</td><td>You</td><td>Olaf suggests, you approve</td></tr>
            <tr><td>Weekly check-ins and a 90-day plan</td><td>You plan it yourself</td><td>✓</td></tr>
            <tr><td>Does the work (reads your files, researches, writes it all)</td><td>You do it yourself</td><td>✓</td></tr>
            <tr><td>Remembers past work and results</td><td>Your brand profile</td><td>Profile, plans, journey and every output</td></tr>
            <tr><td>Reads your sales numbers</td><td>New customers on the Monitor tab</td><td>✓ Uses them in every monthly review</td></tr>
            <tr><td>Project planning</td><td>Project Planner: timeline, workload, updates you send</td><td>Olaf writes the plan, checks in weekly, re-plans and drafts updates</td></tr>
            <tr><td>Marketing actions as tasks on your Project Board</td><td>✓</td><td>✓</td></tr>
            <tr><td>Your data</td><td>Your folder, never sent to us</td><td>Your folder, never sent to us</td></tr>
            <tr><td>Price</td><td>€0</td><td>€149 once, plus Claude usage</td></tr>
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
    <div><b>Want more customers, and projects that run on time?</b><p>Olaf, our AI expert for marketing and projects, looks at your business, plans what comes next and checks in every week to do the work with you.</p></div>
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
    for d in ("business", "games", "growth"):
        pages += list((SITE / d).glob("*.html"))
    return [p for p in pages if forwards or FORWARD not in p.read_text()]


# The hand-written homepage says "soon" about Busy Growth until it launches. Each pair is (soon, live);
# the build writes whichever matches the switch, so turning it off again puts the old words back.
HOMEPAGE_GROWTH = [
    ("daily brain games and soon career growth", "career growth and daily brain games"),
    ("and soon Busy Growth for your career", "and Busy Growth for your career"),
    ("Busy Growth is coming soon.", "Start with Busy Growth."),
    ('<li>Job tracker, CV builder, interview stories</li>', '<li>Job tracker, CVs, stories and contacts</li>'),
    ('<span class="chip chip-grey">Coming soon</span><span class="expert-chip ivy">', f'<span class="chip chip-mint">Live · {len(GROWTH_APPS)} tools</span><span class="expert-chip ivy">'),
]


def sync_growth_launch() -> None:
    page = SITE / "index.html"
    text = page.read_text()
    for soon, live in HOMEPAGE_GROWTH:
        old, new = (soon, live) if GROWTH_LIVE else (live, soon)
        text = text.replace(old, new)
        if new not in text:
            raise SystemExit(f"website/index.html lost the Busy Growth words: {new!r}")
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
    return ("🧰 Explore free tools", f"{prefix}index.html#suites")


def nav_header(prefix: str, cta: tuple = None) -> str:
    """The top bar: Busy, the suites, and one button (inside Busy Business: the free download)."""
    label, href = cta or ("⬇️ Download free", f"{prefix}business/download.html")
    return f"""<header class="nav"><div class="wrap">
  <a class="brandmark" href="{prefix}index.html"><span class="blob">✦</span><span class="word">Busy</span></a>
  <nav class="links" aria-label="Main"><a href="{prefix}business/index.html">💼 Business</a><a href="{prefix}growth/index.html">🌱 Growth</a><a href="{prefix}games/index.html">🧩 Games</a><a href="{prefix}about.html">About</a><a href="{prefix}privacy.html">Privacy</a></nav>
  <a class="btn btn-primary" href="{href}">{label}</a>
</div></header>"""


def nav(prefix: str, cta: tuple = None) -> str:
    return f"""<div class="progress" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
{nav_header(prefix, cta)}"""


def footer(prefix: str, tools: list) -> str:
    links = "".join(f'<li><a href="{prefix}business/{t["id"]}.html">{t["emoji"]} {e(t["name"])}</a></li>' for t in tools)
    games = "".join(f'<li><a href="{prefix}games/{g["id"]}.html">{g["emoji"]} {e(g["name"])}</a></li>' for g in GAMES)
    return f"""<footer class="footer sitemap"><div class="wrap">
  <div><span class="brandmark"><span class="blob">✦</span>Busy</span><p class="faint">Make your paperwork fun again.<br>Free, private tools for work and life.</p>
    <ul><li><a href="{prefix}about.html">About Busy</a></li><li><a href="{prefix}privacy.html">Privacy</a></li><li><a href="{prefix}terms.html">Terms</a></li></ul></div>
  <div><b>💼 Busy Business</b><ul>{links}<li><a href="{prefix}business/tools.html">All tools</a></li><li><a href="{prefix}business/download.html">Download free</a></li><li><a href="{prefix}app/index.html">See the demo</a></li><li><a href="{prefix}business/olaf.html">🧭 Olaf by Busy</a></li></ul></div>
  <div><b>🧩 Busy Games</b><ul>{games}<li><a href="{prefix}games/index.html">All games</a></li></ul>
    <p style="margin-top:22px"><b>🌱 Busy Growth</b></p><ul><li><a href="{prefix}growth/index.html">{"Free tools" if GROWTH_LIVE else "Coming soon"}</a></li><li><a href="{prefix}growth/index.html#ivy">🌿 Ivy by Busy</a></li></ul></div>
</div></footer>"""


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
    "assets/og-olaf.png": ("Olaf by Busy: AI expert for marketing and projects",
                           "Olaf share image: the AI expert for marketing and projects in the paid edition of Busy."),
    "assets/logo-512.png": ("Busy logo", "The Busy logo: a sun-yellow rounded tile with a dark sparkle."),
    "apple-touch-icon.png": ("Busy icon", "The Busy app icon: a sun-yellow rounded tile with a dark sparkle."),
    "assets/favicon.svg": ("Busy logo", "The Busy logo: a sun-yellow rounded tile with a dark sparkle."),
    "assets/olaf-mark.svg": ("Olaf logo", "The Olaf logo: a purple compass pointing up and to the right."),
    "assets/og-business.png": ("Busy Business: free tools for small businesses",
                               "Busy Business share image: free, private business tools for invoices, time, receipts, money, projects and marketing."),
    "assets/og-ivy.png": ("Ivy by Busy: AI coach for professional growth",
                          "Ivy share image: the AI coach for professional growth in Busy Growth, coming soon."),
    "assets/ivy-mark.svg": ("Ivy logo", "The Ivy logo: a green ivy leaf on a short stem, leaning up and to the right."),
}


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
                 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}}) + jsonld({
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
        <p class="note">Free download · Works in Chrome and Edge · Nothing is sent to us · Replaces {e(t["replaces"])}</p>
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
<script src="../app/shared/core.js"></script>
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
<script src="../app/shared/core.js"></script>
<script src="../assets/site.js"></script>
</body>
</html>
"""


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
OLAF_FAQ = [("Is Olaf a person?", "No. Olaf is an AI expert for marketing and projects, running on Claude, Anthropic's AI. It follows proven marketing science, explains its reasoning in plain words, checks its writing, and never invents facts, reviews or numbers. You approve everything before it goes out."),
       ("What does it cost?", "Olaf is €149 once for your business; checkout opens soon, and the waitlist on this page gets the early-access price. On top of that you pay Anthropic directly for the AI you use, with your own Claude key. You see the cost of every conversation, and you set a monthly limit and a limit per conversation."),
       ("What does the AI cost to run?", "You pay Anthropic directly, on your own Claude key, for what Olaf uses. In our own tests with Claude Sonnet: a weekly check-in cost about $0.10 to $0.15, making a full plan about $0.25 to $0.30, and writing a month of posts about $0.15. You see the cost of every conversation and set a monthly limit."),
       ("Do I need the Marketing Studio first?", "No. If you have filled in the Studio's brand profile, Olaf starts from it. If not, Olaf's onboarding asks the questions itself, one at a time."),
       ("Where is my data?", "In your own business folder. Your Claude key stays in your browser and is only sent to Anthropic. Web pages are fetched by Anthropic's own tools, never through us. We have no server that sees your business."),
       ("Does Olaf post for me?", "No. Olaf writes and prepares; you post, send and publish. That keeps you in control of what goes out under your name."),
       ("Which computers does it work on?", "Any computer with Chrome or Edge, Mac or Windows. Busy keeps your business as files in a folder, and Safari and Firefox cannot save to folders yet."),
       ("Is Olaf in the free download?", "No. The free download has every Busy tool and the Marketing Studio. Olaf comes in its own download when you buy it, with Busy included. The demo on this site shows what it looks like with an example business.")]


def olaf_page(tools: list) -> str:
    """Olaf's product page, with its skill list built from the library itself."""
    lib = olaf_lib()
    by_id = {s["id"]: s for s in lib["skills"]}
    def blurb(d):
        d = re.sub(r"^(Olaf as the owner's |When (the|an?) (user|owner) wants to )", "", d).strip()
        first = re.split(r"(?<=\.)\s", d)[0]
        out = first if len(first) < 170 else d[:160].rsplit(" ", 1)[0] + "…"
        return out[:1].upper() + out[1:]
    def name(i):
        n = " ".join(w.capitalize() for w in i.split("-"))
        for a, b in (("Icp", "ICP"), ("Seo", "SEO"), ("Geo", "GEO"), ("Pr ", "PR "), ("Ab ", "A/B ")):
            n = n.replace(a, b)
        return n
    groups = "".join(
        f'<details class="card sk-group reveal"{" open" if k == 0 else ""}><summary><b>{e(label)}</b><small>{len(ids)} skills</small></summary><ul>'
        + "".join(f"<li><b>{e(name(i))}</b><span>{e(blurb(by_id[i]['description']))}</span></li>" for i in ids) + "</ul></details>"
        for k, (label, ids) in enumerate(lib["groups"]))
    stages = ["Know how you grow", "Be easy to find and buy", "Own your moments and assets", "Plan always-on reach", "Show up every month", "Measure and learn"]
    stage_why = ["Who buys, the moments they need you, what they know you by, your budget and hours.",
                 "Google profile, opening hours, prices, reviews, booking: often the cheapest growth there is.",
                 "Link your name to the common buying moments, and use the same colours and signs everywhere.",
                 "A small, steady presence every month beats one big burst. Reach new buyers, not only regulars.",
                 "Posts, newsletter, press and offers, written with you and checked before they go out.",
                 "New customers per month from your invoices, a brand survey now and then, and what to change."]
    feats, project_feats, faq = OLAF_FEATS, OLAF_PROJECT_FEATS, OLAF_FAQ
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Olaf by Busy", "applicationCategory": "BusinessApplication",
                 "operatingSystem": "Windows, macOS, ChromeOS (in Chrome or Edge)", "url": f"{SITE_URL}/olaf.html",
                 "description": "An AI expert for marketing and projects for small businesses: a 90-day marketing plan, project plans, a weekly check-in and the work done with you, built on proven marketing science.",
                 "offers": {"@type": "Offer", "price": "149", "priceCurrency": "EUR"}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
    return f"""{head("Olaf: an AI expert for marketing and projects · Busy", "Olaf plans your marketing and your projects, checks in every week and does the work with you. Built on proven marketing science. Runs on your own Claude key.", "business/olaf.html", "", ld, image="og-olaf.png")}
<body class="site app-grape">
{nav("")}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--grape);right:-140px;top:-120px"></div>
    <div class="wrap tool-hero-grid">
      <div class="reveal from-left">
        <img class="olaf-hero-mark" src="assets/olaf-mark.svg" alt="" width="96" height="96">
        <p class="kicker">Olaf · your AI expert for marketing and projects · by Busy</p>
        <h1>A marketing expert in your corner, every week.</h1>
        <p class="lead">Olaf works out where your business stands, plans your next 90 days and checks in every week. Then it does the work with you: the posts, the review requests, the newsletter, the plan. Everything rests on decades of marketing science about how people really buy.</p>
        <div class="ctas"><a class="btn btn-primary btn-big" href="#get">🧭 Get Olaf</a><a class="btn btn-big" href="app/apps/olaf/index.html">👀 Try the demo</a></div>
        <p class="note">{OLAF_PRICE} · Your own Claude key · Nothing is sent to us</p>
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
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">What Olaf does</h2><p class="lead">The free Marketing Studio gives you the playbooks. Olaf runs them with you, week after week.</p></div>
    <div class="feats">{"".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(feats))}</div>
  </div></section>
  <section class="section tint" style="--c:var(--grape)"><div class="wrap">
    <div class="center reveal"><h2 class="big">Six stages, in the order that grows a business</h2><p class="lead">Olaf works out where you are and starts there. Most businesses keep cycling through the last two.</p></div>
    <div class="steps six">{"".join(f'<div class="card step reveal" style="--c:var(--grape);transition-delay:{i * .06:.2f}s"><span class="num">{i + 1}</span><h3>{e(s)}</h3><p>{e(stage_why[i])}</p></div>' for i, s in enumerate(stages))}</div>
  </div></section>
{paths_block("")}
  <section class="section" id="projects"><div class="wrap">
    <div class="center reveal"><h2 class="big">Your projects, run with you</h2><p class="lead">The free Project Planner holds the plan. Olaf keeps it honest: it writes the plan with you, checks in every week and does the paperwork.</p></div>
    <div class="feats">{"".join(f'<div class="card feat reveal pop" style="transition-delay:{i * .06:.2f}s"><span class="fe">{f[0]}</span><h3>{e(f[1])}</h3><p>{e(f[2])}</p></div>' for i, f in enumerate(project_feats))}</div>
  </div></section>
  <section class="section" id="skills"><div class="wrap">
    <div class="center reveal"><h2 class="big">{len(lib["skills"])} skills behind the coach</h2><p class="lead">Olaf picks the right one for each step. You can also run any of them yourself.</p></div>
    <div class="sk-groups">{groups}</div>
  </div></section>
  <section class="section" id="why"><div class="wrap">
    <div class="center reveal"><h2 class="big">An expert, not another tool</h2><p class="lead">What changes when Olaf runs your marketing with you.</p></div>
    <div class="cmp vs reveal" role="region" aria-label="Olaf compared with doing it alone or hiring an agency" tabindex="0"><table>
      <thead><tr><th></th><th>Olaf</th><th>An AI chat on your own</th><th>A marketing agency</th></tr></thead>
      <tbody>
        <tr><td>Built on proven marketing science</td><td>✓ In every answer</td><td>Only if you know what to ask</td><td>Depends on the agency</td></tr>
        <tr><td>Knows your business and remembers results</td><td>✓ Your profile, plan, numbers and every piece of work</td><td>Starts over unless you set it up</td><td>✓</td></tr>
        <tr><td>Tells you what to do next</td><td>✓ A 90-day plan and a weekly check-in</td><td>You decide, and you prompt</td><td>Usually a monthly meeting</td></tr>
        <tr><td>Does the work</td><td>✓ Drafts it all; you approve</td><td>You copy, paste and fix</td><td>✓</td></tr>
        <tr><td>Reads your real sales numbers</td><td>✓ From your Busy invoices</td><td>Only what you paste</td><td>Only what you share</td></tr>
        <tr><td>Your data</td><td>Stays on your computer</td><td>In a chat history</td><td>With the agency</td></tr>
        <tr><td>Cost</td><td>€149 once, plus a few cents of AI per session</td><td>A monthly subscription, plus your time</td><td>A monthly retainer</td></tr>
      </tbody></table></div>
  </div></section>
  <section class="section" id="get"><div class="wrap">
    <div class="card get-olaf reveal">
      <span class="e">🧭</span>
      <div><h2>Get Olaf</h2>
        <p>Olaf is a one-time purchase: <b>€149</b> for your business, plus your own Claude usage.</p>
        <ul class="get-list"><li>Olaf: the growth coach, setup, dashboard, insights and content calendar</li><li>52 marketing skills, all built on proven marketing science</li><li>The full Busy toolbox in the same download</li><li>Every update, no subscription</li></ul>
        {f'<a class="btn btn-big btn-primary" href="{e(OLAF_CHECKOUT_URL)}">Buy Olaf · €149</a>' if OLAF_CHECKOUT_URL else '<p><b>Checkout opens soon.</b> Leave your email and you are first in line, at the early-access price.</p>' + waitlist_form("olaf-page")}
        <p class="faint" style="font-size:.88rem;margin-top:8px">The free Busy download never contains Olaf. The demo shows an example business; Olaf's work and the AI run only in the paid version.</p></div>
    </div>
  </div></section>
  <section class="section" id="faq"><div class="wrap">
    <div class="center reveal"><h2 class="big">Questions</h2></div>
    <div class="faq reveal">{"".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faq)}</div>
  </div></section>
  <section class="final">
    <h2 class="reveal pop">Your marketing and your projects, with an expert.</h2>
    <p class="lead reveal" style="margin-top:14px;color:var(--ink-2);font-size:1.2rem">Start your journey in the browser, or download Busy and keep it all in your own folder.</p>
    <div class="row-flex" style="justify-content:center;margin-top:10px"><a class="btn btn-big" href="#get">🧭 Get Olaf</a><a class="btn btn-big ghost-light" href="app/apps/olaf/index.html">👀 Try the demo</a></div>
  </section>
</main>
{footer("", tools)}
<script src="app/shared/core.js"></script>
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
GAMES_FAQ = [
    ("Is it free?", "Yes. Every puzzle and every level is free to play in your browser, with no account and nothing to download."),
    ("How many levels are there?", f"{GAME_LEVELS:,} per game, from gentle small boards to expert ones, plus a new daily puzzle. Every puzzle has exactly one answer, so it can always be solved by reasoning."),
    ("Is there a new puzzle every day?", "Yes: one per game, the same for everyone, gentle on Monday and hardest at the weekend. Solve it to keep your streak going."),
    ("Where is my progress kept?", "In this browser only: your streak, solved levels and an unfinished puzzle. Nothing is sent to us, and there is no account. Another browser or a private window starts fresh."),
]


def games_hub() -> str:
    cards = "".join(f'<a class="card game-card reveal pop" href="{g["id"]}.html" style="--c:var(--{g["color"]})"><span class="em">{g["emoji"]}</span><h2>{e(g["name"])}</h2>'
                    f'<p>{e(g["lead"])}</p><p class="status" data-status="{g["id"]}">🗓️ Today\'s puzzle is waiting<br>🏁 {GAME_LEVELS:,} levels to play</p><span class="go">Play {e(g["name"])} →</span></a>' for g in GAMES)
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in GAMES_FAQ)
    ld = jsonld({"@context": "https://schema.org", "@type": "FAQPage",
                 "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in GAMES_FAQ]})
    desc = f"Free daily brain games from Busy: Stars, Duo, Trail and Six. A new logic puzzle every day and {GAME_LEVELS:,} levels each. No account, nothing to install."
    return f"""{head("Free brain games: a new puzzle every day · Busy", desc, "games/index.html", "../", ld + '<link rel="stylesheet" href="../assets/games/games.css">')}
<body class="site app-sun" data-hub>
{nav("../", explore("../"))}
<main id="main" class="wrap">
  <section class="games-hero">
    <h1 class="reveal">Brain breaks 🧩</h1>
    <p class="lead reveal">Four free logic puzzles. A new one every day, and {GAME_LEVELS:,} levels each when you want more. Make your coffee break fun again.</p>
    <span class="streak" data-streak></span>
  </section>
  <div class="game-cards">{cards}</div>
  <section class="section" id="faq"><div class="center reveal"><h2 class="big">Questions</h2></div><div class="faq reveal">{faq}</div></section>
</main>
{footer("../", json.loads(TOOLS_JSON.read_text()))}
<script src="../assets/games/engine.js"></script>
<script src="../assets/games/play.js"></script>
<script src="../assets/site.js"></script>
</body>
</html>
"""


def game_page(g: dict) -> str:
    faq_items = [(f"What is {g['name']}?", g["about"])] + GAMES_FAQ
    ld = jsonld({"@context": "https://schema.org", "@type": "SoftwareApplication", "name": f'Busy {g["name"]}', "applicationCategory": "GameApplication",
                 "operatingSystem": "Any modern browser", "description": g["desc"], "url": f'{SITE_URL}/games/{g["id"]}.html',
                 "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}}) + jsonld({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq_items]})
    rules = "".join(f"<li>{e(r)}</li>" for r in g["rules"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faq_items)
    others = "".join(f'<a class="card rel" href="{o["id"]}.html" style="--c:var(--{o["color"]})"><span class="em">{o["emoji"]}</span><b>{e(o["name"])}</b><small>{e(o["lead"])}</small></a>' for o in GAMES if o["id"] != g["id"])
    return f"""{head(g["title"], g["desc"], f'games/{g["id"]}.html', "../", ld + '<link rel="stylesheet" href="../assets/games/games.css">')}
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
<script src="../assets/site.js"></script>
</body>
</html>
"""


GROWTH_TOOLS = [("📚", "Library", "Files, links and notes from everything you read and learn, tagged and searchable."),
                ("🗓️", "Learning planner", "Courses, books and projects with goals, dates and hours a week."),
                ("🧠", "Skills map", "What you can do, how well, and the proof behind it."),
                ("🏆", "Wins log", "Achievements as they happen, ready for your CV and your next review."),
                ("🗂️", "Job tracker", "Every application on a board, with follow-ups that don't slip."),
                ("📄", "CV and letter builder", "CVs and cover letters built from your real skills and wins."),
                ("🎤", "Interview story bank", "Your best stories, linked to the skills they prove."),
                ("🤝", "Contacts", "The people in your corner, with a reminder when it's time to catch up."),
                ("🪞", "Weekly review", "Ten minutes on Friday: what moved, what was hard, what's next.")]


def growth_page(tools: list) -> str:
    feats = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in GROWTH_TOOLS)
    if GROWTH_WAITLIST_ENDPOINT:
        signup = waitlist_form("growth", GROWTH_WAITLIST_ENDPOINT, "Email me when Ivy is ready. Nothing else, and I can unsubscribe any time." if GROWTH_LIVE
                               else "Email me when Busy Growth and Ivy are ready. Nothing else, and I can unsubscribe any time.",
                               "🌿 Tell me when Ivy is ready" if GROWTH_LIVE else "🌱 Tell me when it's ready", who="")
    else:
        signup = '<p class="lead">The list opens soon. Meanwhile, keep your brain busy with <a href="../games/index.html">today\'s puzzles</a>.</p>'
    ivy = """<section class="section" id="ivy"><div class="wrap">
    <div class="card ivy-card reveal"><img src="../assets/ivy-mark.svg" alt="" width="96" height="96">
      <div><p class="kicker">Ivy by Busy · €30 once · coming soon</p><h2>Your AI coach for professional growth</h2>
      <p>Ivy turns what you learn into skills and wins, those into a stronger CV, and helps with every application and interview. Learn it, prove it, land it. Ivy never invents experience: every line comes with its proof.</p></div></div>
  </div></section>"""
    if not GROWTH_LIVE:
        desc = "Busy Growth, coming soon: free tools to grow your career. A library of what you learn, skills, wins, job tracker and CV builder, plus Ivy, an AI coach."
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
    desc = f"Busy Growth: {len(GROWTH_TOOLS)} free tools to grow your career. A library of what you learn, skills, wins, a job tracker, CVs, interview stories and contacts. No account."
    steps = [("⬇️", "Download and unzip", "One small zip file. Move the Busy Growth folder somewhere you will find it again."),
             ("🖱️", "Open growth.html", "It opens in Chrome or Edge. Nothing is installed, and it works offline."),
             ("📁", "Pick a folder", "Your library, skills, wins and CVs are saved there as plain files. Put it in Google Drive or Dropbox to sync it.")]
    how = "".join(f'<div class="card feat reveal pop"><span class="fe">{em}</span><h3>{e(n)}</h3><p>{e(d)}</p></div>' for em, n, d in steps)
    return f"""{head("Busy Growth: free tools to grow your career", desc, "growth/index.html", "../", image="og-ivy.png")}
<body class="site app-mint">
{nav("../", ("⬇️ Download free", "#get"))}
<main id="main">
  <section class="tool-hero">
    <div class="blob" style="width:460px;height:460px;background:var(--mint);right:-140px;top:-120px"></div>
    <div class="wrap center" style="padding:70px 16px 30px;display:block;text-align:center">
      <span class="chip chip-mint">Free · no account</span>
      <h1 class="reveal" style="margin-top:12px">Busy Growth 🌱</h1>
      <p class="lead reveal" style="max-width:680px;margin:0 auto">Free tools to grow your career: learn something, prove it, show it and land the next role. Everything in your own folder, no account, like the rest of Busy.</p>
      <div class="row-flex reveal" style="justify-content:center;margin-top:22px"><a class="btn btn-primary btn-big" href="../downloads/busy-growth.zip" download data-download>⬇️ Download free</a><a class="btn btn-big" href="../app/growth.html">👀 See the demo</a></div>
    </div>
  </section>
  <section class="section"><div class="wrap">
    <div class="center reveal"><h2 class="big">{len(GROWTH_TOOLS)} tools that work together</h2><p class="lead">A gap in your skills becomes a plan, the plan becomes a win, the win becomes a CV line and an interview story.</p></div>
    <div class="feats">{feats}</div>
  </div></section>
  <section class="section" id="get"><div class="wrap">
    <div class="center reveal"><h2 class="big">Get Busy Growth</h2><p class="lead">Free, the whole set. No account, no subscription, nothing sent to us.</p></div>
    <div class="feats">{how}</div>
    <div class="center" style="margin-top:22px"><a class="btn btn-primary btn-big" href="../downloads/busy-growth.zip" download data-download>⬇️ Download Busy Growth (zip)</a>
      <p class="faint" style="margin-top:14px">Works offline · Chrome or Edge recommended · Mac and Windows</p></div>
  </div></section>
  {ivy}
  <section class="section"><div class="wrap center">
    <h2 class="big">Want to know when Ivy is ready?</h2>
    {signup}
  </div></section>
</main>
{footer("../", tools)}
<script src="../assets/site.js"></script>
</body>
</html>
"""


def build_games() -> list:
    out = SITE / "games"
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(games_hub())
    for g in GAMES:
        (out / f'{g["id"]}.html').write_text(game_page(g))
    print(f"website/games: {len(GAMES)} games + hub, {GAME_LEVELS:,} levels each")
    return ["games/index.html"] + [f'games/{g["id"]}.html' for g in GAMES]


def build_pages() -> None:
    tools = json.loads((SITE / "content" / "tools.json").read_text())
    sc = scenes()
    business = SITE / "business"
    business.mkdir(exist_ok=True)
    for t in tools:
        (business / f'{t["id"]}.html').write_text(tool_page(t, tools, sc.get(t["id"], "")))
    (business / "tools.html").write_text(tools_index(tools))
    (business / "olaf.html").write_text(to_business(olaf_page(tools)))
    (SITE / "about.html").write_text(about_page(tools))
    (SITE / "growth").mkdir(exist_ok=True)
    (SITE / "growth" / "index.html").write_text(growth_page(tools))
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
    pages = (["", "about.html", "privacy.html", "terms.html", "business/index.html", "business/tools.html", "business/download.html", "business/olaf.html"]
             + [f'business/{t["id"]}.html' for t in tools] + game_pages + ["growth/index.html"])
    today = date.today().isoformat()
    (SITE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{SITE_URL}/{p}</loc><lastmod>{page_date(p)}</lastmod></url>\n" for p in pages) + "</urlset>\n")
    (SITE / "robots.txt").write_text(robots_txt())
    write_llms(tools)
    (SITE / "site.webmanifest").write_text(json.dumps({"name": "Busy", "short_name": "Busy", "description": ENTITY, "start_url": "/", "display": "browser",
        "theme_color": "#FFC93C", "background_color": "#16141F", "icons": [{"src": "assets/logo-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, indent=1) + "\n")
    missing = [t["id"] for t in tools if t["id"] not in sc]
    print(f"website/business: {len(tools)} product pages + index; {len(tools) + 3} old addresses forwarded" + (f" (no scene for {missing})" if missing else ""))


# ---------- who we are, for search engines and AI assistants ----------
# One definition of Busy, used in the structured data, the About page, llms.txt and the web
# manifest, so every place describes the same thing in the same words.
ENTITY = ("Busy makes free, private tools for work and life, in suites: Busy Business (thirteen tools for small businesses and "
          "freelancers: invoices and quotes, time, receipts, money, clients, projects, documents, a brand kit, subscriptions, trips, stock "
          "and a marketing studio), Busy Games (free daily brain games) and Busy Growth (" + ("free tools to grow your career: a library, skills, wins, a job tracker, CVs and more" if GROWTH_LIVE else "tools to grow your career, coming soon") + "). The tools "
          "run in the browser and keep everything in the owner's own folder, with no account and no subscription. Each suite can have a "
          "paid AI expert: Olaf for business, Ivy for professional growth.")
ORG_ID, WEBSITE_ID = "#organization", "#website"
SECTIONS = {"business/": ("Busy Business", "business/index.html"), "games/": ("Busy Games", "games/index.html"), "growth/": ("Busy Growth", "growth/index.html")}
# The name is a common word, and another company sells accounting software as BUSY. These tell search
# engines and AI assistants which Busy this is; the old name stays as an alternate for a while.
DESCRIPTOR = "free, private tools for work and life"
ALT_NAMES = ["busy.com.ai", "Busywork"]
DISAMBIGUATION = ("Busy at busy.com.ai: free, private tools for work and life, formerly called Busywork. "
                  "Not related to BUSY accounting software (busy.in).")


def page_date(rel: str) -> str:
    """When a page last changed, from git: its own source file, or for generated pages, what they are made from.
    Honest freshness: the date moves when the content does, not on every build."""
    sources = {"": ["website/index.html"], "business/index.html": ["website/business/index.html"], "business/download.html": ["website/business/download.html"],
               "privacy.html": ["website/privacy.html"], "terms.html": ["website/terms.html"], "about.html": ["build.py", "website/content/tools.json"],
               "business/olaf.html": ["build.py", "olaf-demo/library.js"], "growth/index.html": ["build.py"]}.get(rel, ["build.py", "website/content/tools.json"])
    if rel.startswith("games/"):
        sources = ["build.py", "website/assets/games/engine.js", "website/assets/games/play.js"]
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
           "disambiguatingDescription": DISAMBIGUATION, "slogan": "Make your paperwork fun again.",
           "logo": {"@type": "ImageObject", "@id": base + "#logo", "url": base + "assets/logo-512.png", "width": 512, "height": 512, "caption": "Busy logo"},
           "image": {"@id": base + "#logo"}}
    repo = os.environ.get("GITHUB_REPOSITORY")
    if repo:
        org["sameAs"] = [f"https://github.com/{repo}"]
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
        if 'rel="canonical"' not in t:
            t = t.replace("</title>", f'</title>\n<link rel="canonical" href="{SITE_URL}/{rel}">', 1)
        image = (re.search(r'og:image" content="[^"]*/assets/([^"/]+)"', t) or [None, "og-busy.png"])[1]
        alt = e(IMAGES.get("assets/" + image, IMAGES["assets/og-busy.png"])[1])
        if "og:image:alt" not in t:
            t, n = re.subn(r'(<meta property="og:image:height" content="630">)', rf'\1<meta property="og:image:alt" content="{alt}">', t, count=1)
            if not n:
                t = re.sub(r'(<meta property="og:image" content="[^"]*">)', rf'\1<meta property="og:image:alt" content="{alt}">', t, count=1)
        if "og:locale" not in t:
            t = t.replace('<meta name="theme-color"', '<meta property="og:locale" content="en_GB">\n<meta name="theme-color"', 1)
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
                obj["publisher"] = {"@id": SITE_URL + "/" + ORG_ID}
                offer = obj.get("offers") or {}
                if str(offer.get("price")) == "0":
                    obj["isAccessibleForFree"] = True
                elif offer:
                    offer["availability"] = "https://schema.org/InStock" if OLAF_CHECKOUT_URL else "https://schema.org/PreOrder"
                    offer.setdefault("url", SITE_URL + "/olaf.html#get")
            return jsonld(obj).rstrip("\n")
        t = re.sub(r'<script type="application/ld\+json">(.*?)</script>\n?', fix, t, flags=re.S)
        t = re.sub(r'<script type="application/ld\+json" id="ld-site">.*?</script>\n?', "", t, flags=re.S)
        graph = '<script type="application/ld+json" id="ld-site">' + json.dumps(site_graph(rel, title), ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
        t = t.replace("</head>", graph + "</head>", 1)
        f.write_text(t)


def robots_txt() -> str:
    agents = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
              "Google-Extended", "Applebot-Extended", "CCBot", "Bingbot", "Googlebot"]
    return ("# Busy welcomes search engines and AI assistants. The tools under /app/ are left out: they are\n"
            "# the website demo, the same app filled with a pretend business. llms.txt summarises the site.\n"
            "User-agent: *\nAllow: /\nDisallow: /app/\n\n"
            "# Named, so the choice to be found in AI search and assistants is explicit.\n"
            + "".join(f"User-agent: {a}\n" for a in agents) + "Allow: /\nDisallow: /app/\n\n"
            f"Sitemap: {SITE_URL}/sitemap.xml\n")


def write_llms(tools: list) -> None:
    """llms.txt (llmstxt.org): a short, link-rich summary for AI assistants; llms-full.txt: the facts in one file."""
    b = SITE_URL
    olaf_price = OLAF_PRICE.split(' ·')[0]
    lines = [f"# Busy", "", f"> {ENTITY}", "",
             f"Busy, {DESCRIPTOR}, lives at {b}. It was called Busywork until October 2026. It is not related to BUSY accounting software (busy.in).", "",
             "Key facts:",
             f"- Price: every suite's tools are free, with no account and no subscription. Olaf (Busy Business) is {olaf_price} for one business; Ivy (Busy Growth, coming soon) is €30 once. Both run on the owner's own Claude usage.",
             "- Data: saved as files in a folder the owner chooses on their own computer (it can sit in Google Drive, Dropbox, OneDrive or iCloud Drive). Nothing is sent to Busy. The games keep progress in the browser.",
             "- Works in: the business tools run in Chrome and Edge on Windows, macOS and ChromeOS, from a downloaded folder. The games run in any modern browser.",
             "- AI: none in the free tools. Olaf and Ivy run on Claude with the owner's own API key; requests go from the browser to Anthropic only.",
             "- Language: English. Invoices, quotes and documents can be made in English or Dutch.",
             "", "## Busy Business: free tools for small businesses", "",
             f"- [Busy Business]({b}/business/index.html): {len(tools)} free tools for small businesses and freelancers, and how they work together."]
    lines += [f"- [{t['name']}]({b}/business/{t['id']}.html): {t['description']}" for t in tools]
    lines += [f"- [Olaf, the AI expert for marketing and projects]({b}/business/olaf.html): a 90-day marketing plan, project plans, a weekly check-in and the work done with the owner, on proven marketing science. {olaf_price}.",
              f"- [Download Busy Business]({b}/business/download.html): one zip file with every tool; unzip, open index.html, choose a folder.",
              f"- [All business tools]({b}/business/tools.html): what each tool does.",
              "", "## Busy Games: free daily brain games", "",
              f"- [Busy Games]({b}/games/index.html): four free logic puzzles in the browser, a new one every day and {GAME_LEVELS:,} levels each. No account."]
    lines += [f"- [{g['name']}]({b}/games/{g['id']}.html): {g['desc']}" for g in GAMES]
    if GROWTH_LIVE:
        lines += ["", "## Busy Growth: free tools to grow your career", "",
                  f"- [Busy Growth]({b}/growth/index.html): {len(GROWTH_TOOLS)} free tools: a library of what you read and learn, skills, wins, a learning plan, a job tracker, a CV builder, interview stories, contacts and a weekly review. Ivy, an AI coach for professional growth (€30 once), is coming soon.",
                  f"- [Download Busy Growth]({b}/downloads/busy-growth.zip): one zip file; unzip, open growth.html, choose a folder."]
    else:
        lines += ["", "## Busy Growth: free tools to grow your career (coming soon)", "",
                  f"- [Busy Growth]({b}/growth/index.html): a library of what you read and learn, skills, wins, a learning plan, a job tracker and a CV builder, plus Ivy, an AI coach for professional growth (€30 once). Not released yet."]
    lines += [
              "", "## About", "",
              f"- [About Busy]({b}/about.html): what it is, who it is for, and how it works.",
              f"- [Privacy]({b}/privacy.html): what happens to data (nothing is sent to us).",
              f"- [Terms]({b}/terms.html)",
              "", "## Optional", "",
              f"- [llms-full.txt]({b}/llms-full.txt): all of the above with every tool's and game's features and questions in one file."]
    (SITE / "llms.txt").write_text("\n".join(lines) + "\n")

    full = [f"# Busy: the full picture", "", ENTITY, "", f"Website: {b}/", "", DISAMBIGUATION, "",
            "# Busy Business: free tools for small businesses", "", f"Page: {b}/business/index.html", "",
            "## How it works", "",
            "1. Download Busy Business (one zip file) and unzip it somewhere you will find it again.",
            "2. Double-click index.html. It opens in Chrome or Edge. Nothing is installed.",
            "3. Choose a folder for your business. Every tool saves plain files there; put the folder in Google Drive, Dropbox, OneDrive or iCloud Drive for backups and syncing.",
            "4. Busy also keeps a daily backup in that folder. There is no account and no server: nothing is sent to us.",
            "", "## Editions", "",
            f"- Free download: all {len(tools)} tools, the Marketing Studio included. No AI, no account, no subscription.",
            f"- Paid edition: the same tools plus Olaf, the AI expert for marketing and projects. {OLAF_PRICE}.",
            f"- Website demo: every tool filled with a pretend design studio, at {b}/app/index.html. Nothing is kept after the tab closes.", ""]
    for t in tools:
        full += [f"## {t['name']}", "", f"{t['h1']} {t['lead']}", "", f"Page: {b}/business/{t['id']}.html", "", "What it does:"]
        full += [f"- {f[1]}: {f[2]}" for f in t["features"]]
        full += ["", "Questions:"] + [f"- {q} {a}" for q, a in t["faq"]] + [""]
    full += ["## Olaf, the AI expert for marketing and projects (paid edition of Busy Business)", "",
             f"Page: {b}/business/olaf.html. Price: {OLAF_PRICE}.", "", "Marketing:"]
    full += [f"- {f[1]}: {f[2]}" for f in OLAF_FEATS] + ["", "Projects:"] + [f"- {f[1]}: {f[2]}" for f in OLAF_PROJECT_FEATS]
    full += ["", "Questions:"] + [f"- {q} {a}" for q, a in OLAF_FAQ]
    full += ["", "# Busy Games: free daily brain games", "", f"Page: {b}/games/index.html. Four logic puzzles that run in the browser, a new one every day and {GAME_LEVELS:,} levels each. Progress stays in the browser; no account.", ""]
    for g in GAMES:
        full += [f"## {g['name']} ({g['classic']})", "", g["about"], f"Page: {b}/games/{g['id']}.html", "", "Rules:"] + [f"- {r}" for r in g["rules"]] + [""]
    full += ["Questions:"] + [f"- {q} {a}" for q, a in GAMES_FAQ]
    full += (["", "# Busy Growth: free tools to grow your career", "", f"Page: {b}/growth/index.html. Free, in its own download ({b}/downloads/busy-growth.zip), with a demo at {b}/app/growth.html. The tools:", ""]
             if GROWTH_LIVE else ["", "# Busy Growth: free tools to grow your career (coming soon)", "", f"Page: {b}/growth/index.html. Not released yet. Planned tools:", ""])
    full += [f"- {n}: {d}" for _, n, d in GROWTH_TOOLS]
    full += ["", "Ivy by Busy, the AI coach for professional growth, will be the paid part: €30 once, on the owner's own Claude usage. Ivy never invents experience: every CV line comes with its proof.",
             "", "# Privacy in short", "",
             "The tools never send us anything. Business data stays in the owner's folder; the games keep progress in the browser. The waitlists keep an email address in MailerLite, only to say when Olaf or Busy Growth can be had. Olaf's requests go from the owner's browser to Anthropic with the owner's own key.",
             f"Full text: {b}/privacy.html", ""]
    (SITE / "llms-full.txt").write_text("\n".join(full))


def about_page(tools: list) -> str:
    """What Busy is, in plain facts: the page search engines and AI assistants read to describe us."""
    olaf_price = OLAF_PRICE.split(' ·')[0]
    facts = [("What it is", ENTITY),
             ("The suites", f"Busy Business: {len(tools)} free tools for small businesses and freelancers. Busy Games: four free daily logic puzzles with {GAME_LEVELS:,} levels each. Busy Growth: " + (f"{len(GROWTH_TOOLS)} free tools to grow your career." if GROWTH_LIVE else "free tools to grow your career, coming soon.")),
             ("Who it is for", "People who would rather spend their time on what matters: small business owners and freelancers, anyone who likes a daily puzzle, and " + ("" if GROWTH_LIVE else "soon ") + "anyone growing their career."),
             ("What it costs", f"Every suite's tools are free. The AI experts are paid once: Olaf for Busy Business is {olaf_price}, Ivy for Busy Growth will be €30. Both run on the owner's own Claude usage."),
             ("Where the data lives", "In a folder the owner chooses on their own computer, as plain files. There is no account and no server, so nothing is sent to us. The games keep your streak in your browser."),
             ("What it runs on", "The business tools run in Chrome and Edge on Windows, macOS and ChromeOS, from a downloaded folder; nothing is installed. The games run in any modern browser."),
             ("How the marketing tools work", "Busy Business's Marketing Studio and Olaf are built on proven marketing science: reach more buyers, be the business people think of in the moments they need you, and be easy to find and buy from."),
             ("Languages", "English. Invoices, quotes and documents can be made in English or Dutch."),
             ("The name", f"Busy, {DESCRIPTOR}, at busy.com.ai. Called Busywork until October 2026. Not related to BUSY accounting software.")]
    desc = "What Busy is: free, private tools for work and life, in suites for business, " + ("career growth and brain games" if GROWTH_LIVE else "brain games and soon career growth") + ". Your files stay yours."
    return f"""{head("About Busy: free, private tools for work and life", desc, "about.html", "")}
<body class="site app-sun">
{nav("", explore(""))}
<main class="page">
  <h1 class="reveal">About Busy</h1>
  <p class="lead reveal">{e(ENTITY)}</p>
  <dl class="about-facts">{"".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in facts)}</dl>
  <h2>💼 Busy Business</h2>
  <ul>{"".join(f'<li><a href="business/{t["id"]}.html">{t["emoji"]} {e(t["name"])}</a>: {e(t["description"])}</li>' for t in tools)}</ul>
  <p style="margin-top:14px"><a class="btn btn-primary" href="business/download.html">⬇️ Download all {len(tools)} tools</a> <a class="btn" href="app/index.html">👀 See the demo</a> <a class="btn" href="business/olaf.html">🧭 Meet Olaf</a></p>
  <h2>🧩 Busy Games</h2>
  <ul>{"".join(f'<li><a href="games/{g["id"]}.html">{g["emoji"]} {e(g["name"])}</a>: {e(g["lead"])}</li>' for g in GAMES)}</ul>
  <h2>🌱 Busy Growth</h2>
  {'<p><a href="growth/index.html">Free tools to grow your career</a>: ' + ", ".join(e(n).lower() if i else e(n) for i, (_, n, _) in enumerate(GROWTH_TOOLS)) + '. <a class="btn" href="growth/index.html#get">⬇️ Download Busy Growth</a></p>' if GROWTH_LIVE else '<p>Coming soon: <a href="growth/index.html">free tools to grow your career, and Ivy, an AI coach</a>.</p>'}
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


def main() -> None:
    build_marketing()
    copy_app()
    copy_olaf_demo()
    make_demo()
    make_zip()
    make_growth_zip()
    build_pages()
    sync_growth_launch()
    sync_homepage_paths()
    apply_site_url()
    image_metadata()
    site_seo()
    site_csp()
    leak_check()


if __name__ == "__main__":
    main()
