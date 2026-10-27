"""Tests for build.py: the leak check that keeps Olaf's paid text off the website and out of the free
download, and the generated homepage block. Run: python3 -m unittest discover tests"""
import hashlib
import html
import importlib.util
import json
import os
import re
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build", ROOT / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def h(s):
    return hashlib.sha256(s.encode()).hexdigest()[:20]


SECRET = "Always open with the buying situation the owner named in onboarding, then the proof."


class Sentences(unittest.TestCase):
    def test_finds_text_wherever_it_sits(self):
        want = SECRET.lower()
        for text in (SECRET, f"<p>{SECRET}</p>", f"- {SECRET}", f"1. {SECRET}", "const x = \"" + SECRET.replace(" the proof", "\\nthe proof") + "\";",
                     f"<li><b>Always open</b> with the buying situation the owner named in onboarding, then the proof.</li>",
                     "Always open with the buying situation\nthe owner named in onboarding, then the proof."):
            with self.subTest(text=text[:40]):
                self.assertIn(want, list(build.sentences(text)))

    def test_skips_short_and_code_like_lines(self):
        self.assertEqual(list(build.sentences("Short line.\n\n{a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10}")), [])

    def test_blocks_do_not_run_together(self):
        out = list(build.sentences("# A heading that is long enough to count as one\nThis paragraph is a different sentence of its own."))
        self.assertEqual(len(out), 2)


class LeakCheck(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "site").mkdir()
        (self.tmp / "app").mkdir()
        (self.tmp / "site" / "index.html").write_text("<p>Free tools for small businesses, private by design and made with care.</p>")
        self.fp = self.tmp / "fp.json"
        self.fp.write_text(json.dumps({"hashes": [h(SECRET.lower())]}))
        self.saved = (build.SITE, build.APP, build.FINGERPRINTS, build.ROOT)
        build.SITE, build.APP, build.FINGERPRINTS, build.ROOT = self.tmp / "site", self.tmp / "app", self.fp, self.tmp

    def tearDown(self):
        build.SITE, build.APP, build.FINGERPRINTS, build.ROOT = self.saved
        shutil.rmtree(self.tmp)

    def test_clean_site_passes(self):
        build.leak_check()

    def test_paid_text_in_a_page_stops_the_build(self):
        (self.tmp / "site" / "olaf.html").write_text(f"<section><p>{SECRET}</p></section>")
        with self.assertRaises(SystemExit) as e:
            build.leak_check()
        self.assertIn("olaf.html", str(e.exception))

    def test_paid_text_in_a_script_stops_the_build(self):
        (self.tmp / "app" / "x.js").write_text("const t = `" + SECRET + "`;")
        with self.assertRaises(SystemExit):
            build.leak_check()

    def test_olaf_inside_the_free_app_stops_the_build(self):
        (self.tmp / "app" / "apps" / "olaf").mkdir(parents=True)
        with self.assertRaises(SystemExit):
            build.leak_check()


class Homepage(unittest.TestCase):
    def test_paths_block_sync_is_stable(self):
        tmp = Path(tempfile.mkdtemp())
        saved = build.SITE
        try:
            (tmp / "business").mkdir()
            shutil.copy(ROOT / "website" / "business" / "index.html", tmp / "business" / "index.html")
            build.SITE = tmp
            build.sync_homepage_paths()
            once = (tmp / "business" / "index.html").read_text()
            build.sync_homepage_paths()
            self.assertEqual(once, (tmp / "business" / "index.html").read_text())
            self.assertIn("paths:start", once)
        finally:
            build.SITE = saved
            shutil.rmtree(tmp)

    def test_missing_marker_is_an_error(self):
        tmp = Path(tempfile.mkdtemp())
        saved = build.SITE
        try:
            (tmp / "business").mkdir()
            (tmp / "business" / "index.html").write_text("<html></html>")
            build.SITE = tmp
            with self.assertRaises(SystemExit):
                build.sync_homepage_paths()
        finally:
            build.SITE = saved
            shutil.rmtree(tmp)


class WebsitePolicy(unittest.TestCase):
    def test_every_page_gets_one_policy_with_the_waitlist(self):
        tmp = Path(tempfile.mkdtemp())
        saved = (build.SITE, build.WAITLIST_ENDPOINT)
        try:
            (tmp / "business").mkdir()
            for f in (tmp / "a.html", tmp / "business" / "b.html"):
                f.write_text('<html><head><meta charset="utf-8">\n<title>x</title></head></html>')
            build.SITE, build.WAITLIST_ENDPOINT = tmp, "https://formspree.io/f/abc"
            build.site_csp()
            build.site_csp()
            for f in (tmp / "a.html", tmp / "business" / "b.html"):
                t = f.read_text()
                self.assertEqual(t.count("Content-Security-Policy"), 1)
                self.assertIn("form-action 'self' https://formspree.io", t)
                self.assertIn("object-src 'none'", t)
            build.WAITLIST_ENDPOINT = "http://insecure.example/f"
            with self.assertRaises(SystemExit):
                build.site_csp()
        finally:
            build.SITE, build.WAITLIST_ENDPOINT = saved
            shutil.rmtree(tmp)



class Editions(unittest.TestCase):
    """The free download has no AI and no pretend business; the website's tools are the demo."""

    def test_free_download_has_no_ai_and_no_example_business(self):
        import zipfile
        z = zipfile.ZipFile(ROOT / "website" / "downloads" / "busy.zip")
        names = z.namelist()
        self.assertNotIn("Busy/shared/ai.js", names)
        self.assertNotIn("Busy/shared/examples.js", names)
        self.assertFalse(any("/apps/olaf/" in n for n in names), "Olaf is not in the free download")
        banned = ["x-api-key", "Claude API key", "Connect AI", "AI settings", "Show me with example data", "Just try it out", "examples.load(", "data-key", "demo.js"]
        for n in names:
            if n.endswith((".js", ".html", ".txt")):
                text = z.read(n).decode("utf-8", "ignore")
                for b in banned:
                    self.assertNotIn(b, text, f"{n} mentions {b!r}")
        lib = z.read("Busy/apps/marketing/library.js").decode()
        self.assertNotIn('"body"', lib, "the Studio ships playbook names only")
        self.assertNotIn('"foundation"', lib, "no AI prompt in the free Studio")

    def test_busy_growth_stays_out_of_the_demo_and_the_download_until_it_launches(self):
        import zipfile
        names = zipfile.ZipFile(ROOT / "website" / "downloads" / "busy.zip").namelist()
        self.assertFalse([n for n in names if build.growth_part(n[len("Busy/"):])], "no Busy Growth in the Busy Business download")
        if build.GROWTH_LIVE:
            self.skipTest("Busy Growth is live in this build")
        site = ROOT / "website" / "app"
        self.assertFalse((site / "growth.html").exists())
        self.assertFalse((ROOT / "website" / "downloads" / "busy-growth.zip").exists())
        for a in build.GROWTH_APPS:
            self.assertFalse((site / "apps" / a).exists(), f"{a} is not in the website demo yet")
            self.assertTrue((ROOT / "app" / "apps" / a / "index.html").is_file(), f"{a} is built in app/")


class GrowthLaunch(unittest.TestCase):
    """GROWTH_LIVE=1: Busy Growth's own download, its demo and the site's words. Built into a temp folder."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.saved = (build.SITE, build.GROWTH_LIVE)
        build.SITE, build.GROWTH_LIVE = self.tmp, True

    def tearDown(self):
        build.SITE, build.GROWTH_LIVE = self.saved
        shutil.rmtree(self.tmp)

    def test_the_growth_download_has_its_tools_and_nothing_of_business_or_ai(self):
        import zipfile
        build.make_growth_zip()
        z = zipfile.ZipFile(self.tmp / "downloads" / "busy-growth.zip")
        names = z.namelist()
        self.assertIn("Busy Growth/START HERE.txt", names)
        self.assertIn("Busy Growth/growth.html", names)
        for a in build.GROWTH_APPS:
            self.assertIn(f"Busy Growth/apps/{a}/index.html", names)
        for n in ("index.html", "home.js", "apps/invoices/index.html", "apps/olaf/index.html", "shared/ai.js", "shared/examples.js", "shared/growth-examples.js"):
            self.assertNotIn(f"Busy Growth/{n}", names)
        self.assertFalse([n for n in names if n.startswith("Busy Growth/apps/") and n.split("/")[2] not in build.GROWTH_APPS], "only growth tools")
        for n in names:
            if n.endswith((".js", ".html")):
                text = z.read(n).decode("utf-8", "ignore")
                for word in ("x-api-key", "Claude API key", "examples.load(", "demo.js"):
                    self.assertNotIn(word, text, f"{n} mentions {word!r}")
        # every script a page loads is in the zip
        for n in names:
            if n.endswith(".html"):
                for src in re.findall(r'<script src="([^"]+)"', z.read(n).decode()):
                    self.assertIn(os.path.normpath(os.path.join(os.path.dirname(n), src)), names, f"{n} loads {src}")
        build.GROWTH_LIVE = False
        build.make_growth_zip()
        self.assertFalse((self.tmp / "downloads" / "busy-growth.zip").exists(), "switched off, the download goes")

    def test_the_homepage_words_switch_both_ways(self):
        home = (ROOT / "website" / "index.html").read_text()
        (self.tmp / "index.html").write_text(home)
        build.sync_growth_launch()
        live = (self.tmp / "index.html").read_text()
        self.assertNotIn("soon career growth", live)
        self.assertNotIn("Busy Growth is coming soon", live)
        self.assertIn("Live · 9 tools", live)
        build.GROWTH_LIVE = False
        build.sync_growth_launch()
        self.assertEqual((self.tmp / "index.html").read_text(), home, "and back again, word for word")

    def test_the_growth_page_offers_the_download_and_the_demo(self):
        tools = json.loads((ROOT / "website" / "content" / "tools.json").read_text())
        page = build.growth_page(tools)
        self.assertIn('href="../downloads/busy-growth.zip"', page)
        self.assertIn('href="../app/growth.html"', page)
        self.assertNotIn("(soon)", page)
        self.assertEqual(page.split("<main")[1].split("</main>")[0].lower().count("coming soon"), 1, "only Ivy is still coming")
        self.assertEqual(len(build.GROWTH_TOOLS), len(build.GROWTH_APPS), "one line on the page for every tool")

    def test_every_website_tool_page_is_the_demo(self):
        pages = sorted((ROOT / "website" / "app").rglob("index.html"))
        self.assertGreater(len(pages), 10)
        for p in pages:
            html_text = p.read_text()
            demo, core = html_text.find("assets/demo.js"), html_text.find("shared/core.js")
            self.assertTrue(0 < demo < core, f"{p.relative_to(ROOT)} loads demo.js before core.js")

    def test_website_offers_the_demo_not_a_browser_version(self):
        for p in build.site_pages():
            t = p.read_text()
            for b in ["Try it in your browser", "Try it online", "Try it now", "Add your own Claude key for AI", "just try it out"]:
                self.assertNotIn(b, t, f"{p.name}: {b}")
        self.assertIn("See the demo", (ROOT / "website" / "business" / "index.html").read_text())



class HomeLaunch(unittest.TestCase):
    """HOME_LIVE=1: Busy Home's own download, its page and the homepage words. Built into a temp folder."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.saved = (build.SITE, build.HOME_LIVE)
        build.SITE, build.HOME_LIVE = self.tmp, True

    def tearDown(self):
        build.SITE, build.HOME_LIVE = self.saved
        shutil.rmtree(self.tmp)

    def test_the_home_download_has_its_tools_and_nothing_of_another_suite_or_ai(self):
        import zipfile
        build.make_home_zip()
        z = zipfile.ZipFile(self.tmp / "downloads" / "busy-home.zip")
        names = z.namelist()
        self.assertIn("Busy Home/START HERE.txt", names)
        self.assertIn("Busy Home/home.html", names)
        for a in build.HOUSE_APPS:
            self.assertIn(f"Busy Home/apps/{a}/index.html", names)
        for n in ("index.html", "growth.html", "apps/invoices/index.html", "apps/library/index.html", "shared/growth.js", "shared/ai.js", "shared/house-examples.js"):
            self.assertNotIn(f"Busy Home/{n}", names)
        self.assertIn("Busy Home/shared/filetext.js", names, "the PDF reader is shared with Growth")
        self.assertFalse([n for n in names if n.startswith("Busy Home/apps/") and n.split("/")[2] not in build.HOUSE_APPS], "only household tools")
        for n in names:
            if n.endswith((".js", ".html")):
                text = z.read(n).decode("utf-8", "ignore")
                for word in ("x-api-key", "Claude API key", "examples.load(", "demo.js"):
                    self.assertNotIn(word, text, f"{n} mentions {word!r}")
            if n.endswith(".html"):
                for src in re.findall(r'<script src="([^"]+)"', z.read(n).decode()):
                    self.assertIn(os.path.normpath(os.path.join(os.path.dirname(n), src)), names, f"{n} loads {src}")
        build.HOME_LIVE = False
        build.make_home_zip()
        self.assertFalse((self.tmp / "downloads" / "busy-home.zip").exists(), "switched off, the download goes")

    def test_the_homepage_words_switch_both_ways(self):
        home = (ROOT / "website" / "index.html").read_text()
        (self.tmp / "index.html").write_text(home)
        build.sync_home_launch()
        live = (self.tmp / "index.html").read_text()
        self.assertIn(f"Live · {len(build.HOUSE_APPS)} tools", live)
        self.assertNotIn("Busy Home is on its way", live)
        build.HOME_LIVE = False
        build.sync_home_launch()
        self.assertEqual((self.tmp / "index.html").read_text(), home, "and back again, word for word")

    def test_the_home_page_offers_the_download_and_the_demo_only_when_live(self):
        tools = json.loads((ROOT / "website" / "content" / "tools.json").read_text())
        page = build.home_page(tools)
        self.assertIn('href="../downloads/busy-home.zip"', page)
        self.assertIn('href="../app/home.html"', page)
        self.assertEqual(len(build.HOME_TOOLS), len(build.HOUSE_APPS), "one line on the page for every tool")
        build.HOME_LIVE = False
        soon = build.home_page(tools)
        self.assertNotIn("busy-home.zip", soon)
        self.assertIn("(soon)", soon)

    def test_home_stays_out_of_the_website_demo_until_it_launches(self):
        build.HOME_LIVE = False
        self.assertFalse(build.on_site("apps/papers/index.html"))
        self.assertFalse(build.on_site("home.html"))
        self.assertEqual(build.on_site("shared/filetext.js"), build.GROWTH_LIVE, "shared with Growth: there when either is live")
        build.HOME_LIVE = True
        self.assertTrue(build.on_site("apps/papers/index.html"))
        self.assertTrue(build.on_site("shared/filetext.js"))


class Waitlist(unittest.TestCase):
    def test_mailerlite_form_uses_its_field_names_and_an_empty_setting_keeps_the_default(self):
        saved = build.WAITLIST_PROVIDER
        try:
            build.WAITLIST_PROVIDER = "MailerLite"
            f = build.waitlist_form("test")
            for part in ['name="fields[email]"', 'name="fields[name]"', 'name="ml-submit" value="1"', 'name="anticsrf" value="true"', 'data-provider="mailerlite"']:
                self.assertIn(part, f)
            self.assertNotIn("_gotcha", f)
        finally:
            build.WAITLIST_PROVIDER = saved
        import subprocess, sys
        out = subprocess.run([sys.executable, "-c", "import importlib.util as u;s=u.spec_from_file_location('b','build.py');b=u.module_from_spec(s);s.loader.exec_module(b);print(b.WAITLIST_PROVIDER)"],
                             cwd=ROOT, env={"WAITLIST_PROVIDER": "", "PATH": "/usr/bin:/bin"}, capture_output=True, text=True)
        self.assertEqual(out.stdout.strip(), "MailerLite")



class Visibility(unittest.TestCase):
    """What search engines and AI assistants read: built by build.py's site_seo, write_llms and friends."""
    SITE = ROOT / "website"

    def pages(self):
        return [p for p in build.site_pages() if p.name != "404.html"]

    def test_every_page_has_title_description_canonical_alt_and_the_shared_graph(self):
        for p in self.pages():
            t = p.read_text()
            title = re.search(r"<title>(.*?)</title>", t).group(1)
            desc = re.search(r'<meta name="description" content="([^"]*)"', t).group(1)
            self.assertLessEqual(len(html.unescape(title)), 60, f"{p.name} title")
            self.assertLessEqual(len(html.unescape(desc)), 160, f"{p.name} description")
            self.assertIn('rel="canonical"', t, p.name)
            self.assertIn("og:image:alt", t, p.name)
            self.assertNotIn("/app/shared/icons/", t, f"{p.name} points crawlers at icons robots.txt blocks")
            ids = set()
            for raw in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', t, re.S):
                obj = json.loads(raw)
                for g in obj.get("@graph", [obj]):
                    if g.get("@type") == "Organization":
                        ids.add(g["@id"])
                        self.assertTrue(g["logo"]["url"].endswith("/assets/logo-512.png"))
                    if g.get("@type") == "SoftwareApplication":
                        self.assertIn("publisher", g, p.name)
            self.assertEqual(len(ids), 1, f"{p.name}: one Organization, one @id")

    def test_llms_txt_follows_the_format_and_links_to_real_pages(self):
        t = (self.SITE / "llms.txt").read_text()
        self.assertTrue(t.startswith("# Busy\n\n> "), "H1, then a blockquote summary")
        for url in re.findall(r"\]\((https?://[^)]+)\)", t):
            path = re.sub(r"^https?://[^/]+/", "", url)
            self.assertTrue((self.SITE / path).is_file(), f"llms.txt links to missing {path}")
        full = (self.SITE / "llms-full.txt").read_text()
        for tool in json.loads((self.SITE / "content" / "tools.json").read_text()):
            self.assertIn(f"## {tool['name']}", full)
        self.assertIn("## Olaf", full)

    def test_robots_welcomes_ai_crawlers_and_keeps_the_demo_out(self):
        r = (self.SITE / "robots.txt").read_text()
        for bot in ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot", "Google-Extended"]:
            self.assertIn(f"User-agent: {bot}", r)
        self.assertNotIn("Disallow: /\n", r)
        self.assertIn("Disallow: /app/", r)
        self.assertIn("/sitemap.xml", r)
        sm = (self.SITE / "sitemap.xml").read_text()
        self.assertIn("about.html", sm)
        self.assertNotIn("404", sm)

    def test_images_carry_their_metadata(self):
        for rel, (title, _) in build.IMAGES.items():
            data = (self.SITE / rel).read_bytes()
            self.assertIn(title.encode(), data, rel)
        for f in ["favicon.ico", "apple-touch-icon.png", "site.webmanifest", "assets/logo-512.png"]:
            self.assertTrue((self.SITE / f).is_file(), f)
        self.assertIn('name="robots" content="noindex"', (self.SITE / "404.html").read_text())

    def test_brain_games_are_free_findable_pages(self):
        """The games hub and one page per game: in the sitemap, in llms.txt, linked from every page's nav,
        loading the puzzle engine, with a free product in the structured data and no ad slots."""
        sm = (self.SITE / "sitemap.xml").read_text()
        llms = (self.SITE / "llms.txt").read_text()
        for g in ["index"] + [x["id"] for x in build.GAMES]:
            page = self.SITE / "games" / f"{g}.html"
            t = page.read_text()
            self.assertIn(f"/games/{g}.html", sm)
            self.assertIn(f"/games/{g}.html", llms)
            self.assertIn("../assets/games/engine.js", t)
            self.assertIn("../assets/games/play.js", t)
            self.assertNotIn("data-ad=", t, "no ads inside the games")
            if g != "index":
                self.assertIn('"applicationCategory": "GameApplication"', t)
                self.assertIn('"isAccessibleForFree": true', t)
                self.assertIn(f'data-game="{g}"', t)
        home = (self.SITE / "index.html").read_text()
        self.assertIn('id="games-today"', home, "the homepage has a brain games section")
        for g in ["index"] + [x["id"] for x in build.GAMES]:
            self.assertIn(f'href="games/{g}.html"', home)
        for p in build.site_pages():
            self.assertRegex(p.read_text(), r'href="(\.\./|/)?games/index\.html">🧩 Games</a>', f"{p.name} links to the games")

    def test_suites_old_addresses_forward_and_the_sitemap_lists_only_real_pages(self):
        """Busy is one brand with suites. The business pages moved to /business/ in October 2026;
        every old address still lands on its new page, and only real pages are in the sitemap."""
        tools = json.loads((self.SITE / "content" / "tools.json").read_text())
        old = {"olaf.html": "business/olaf.html", "download.html": "business/download.html", "tools/index.html": "business/tools.html"}
        old.update({f'tools/{t["id"]}.html': f'business/{t["id"]}.html' for t in tools})
        for rel, new in old.items():
            t = (self.SITE / rel).read_text()
            self.assertIn(build.FORWARD, t, rel)
            self.assertIn(f'rel="canonical" href="{build.SITE_URL}/{new}"', t, rel)
            self.assertIn("location.hash", t, f"{rel} keeps #get and other anchors")
            self.assertTrue((self.SITE / new).is_file(), f"{rel} forwards to {new}, which exists")
        sm = (self.SITE / "sitemap.xml").read_text()
        for rel in old:
            self.assertNotIn(f"<loc>{build.SITE_URL}/{rel}<", sm, f"the sitemap lists the forward {rel}")
        for rel in ["business/index.html", "business/tools.html", "business/olaf.html", "business/download.html", "growth/index.html", "games/index.html"]:
            self.assertIn(f"/{rel}<", sm)
        home = (self.SITE / "index.html").read_text()
        self.assertIn('id="suites"', home)
        for rel in ["business/index.html", "games/index.html", "growth/index.html", "business/olaf.html"]:
            self.assertIn(f'href="{rel}"', home)
        for p in build.site_pages():
            t = p.read_text()
            for label in ["💼 Business", "🌱 Growth", "🧩 Games"]:
                self.assertIn(f">{label}</a>", t, f"{p.name}: the nav shows every suite")

    def test_busy_is_described_as_suites_everywhere_machines_read(self):
        for word in ["Busy Business", "Busy Games", "Busy Growth", "Olaf", "Ivy"]:
            self.assertIn(word, build.ENTITY)
        self.assertEqual(build.DESCRIPTOR, "free, private tools for work and life")
        llms = (self.SITE / "llms.txt").read_text()
        for h in ["## Busy Business", "## Busy Games", "## Busy Growth"]:
            self.assertIn(h, llms)
        about = (self.SITE / "about.html").read_text()
        self.assertIn("The suites", about)
        growth = (self.SITE / "growth" / "index.html").read_text()
        self.assertNotIn("Email me when Olaf", growth, "Busy Growth never signs people up for Olaf's list")
        self.assertIn('id="ivy"', growth)

    def test_a_root_page_moved_into_business_keeps_its_links(self):
        moved = build.to_business('<a href="tools/invoices.html">x</a><a href="tools/index.html#top">x</a><a href="olaf.html#get">x</a>'
                                  '<a href="business/download.html">x</a><img src="assets/a.svg"><a href="privacy.html">x</a>'
                                  '<a href="#faq">x</a><a href="https://x.example/">x</a><a href="../games/index.html">x</a>')
        for want in ['href="invoices.html"', 'href="tools.html#top"', 'href="olaf.html#get"', 'href="download.html"', 'src="../assets/a.svg"',
                     'href="../privacy.html"', 'href="#faq"', 'href="https://x.example/"', 'href="../games/index.html"']:
            self.assertIn(want, moved)

    def test_the_name_is_busy_with_the_old_name_and_the_namesake_explained(self):
        """Busy is a common word and another company's name; every machine-readable place says which Busy."""
        for p in self.pages():
            t = p.read_text()
            self.assertNotIn("Busywork ·", t, p.name)
            self.assertNotIn(">Busywork<", t, p.name)
            for raw in re.findall(r'<script type="application/ld\+json" id="ld-site">(.*?)</script>', t, re.S):
                org = next(g for g in json.loads(raw)["@graph"] if g["@type"] == "Organization")
                self.assertEqual(org["name"], "Busy", p.name)
                self.assertIn("Busywork", org["alternateName"], p.name)
                self.assertIn("busy.in", org["disambiguatingDescription"], p.name)
        for f in ["llms.txt", "llms-full.txt", "about.html"]:
            t = (self.SITE / f).read_text()
            self.assertIn("Busywork", t, f"{f} names the old name")
            self.assertIn("BUSY accounting software", t, f"{f} tells the namesake apart")
        self.assertIn("og-busy.png", (self.SITE / "index.html").read_text())
        self.assertFalse((self.SITE / "assets" / "og-busywork.png").exists())


if __name__ == "__main__":
    unittest.main()
