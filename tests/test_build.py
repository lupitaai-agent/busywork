"""Tests for build.py: the leak check that keeps Olaf's paid text off the website and out of the free
download, and the generated homepage block. Run: python3 -m unittest discover tests"""
import hashlib
import importlib.util
import json
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
            shutil.copy(ROOT / "website" / "index.html", tmp / "index.html")
            build.SITE = tmp
            build.sync_homepage_paths()
            once = (tmp / "index.html").read_text()
            build.sync_homepage_paths()
            self.assertEqual(once, (tmp / "index.html").read_text())
            self.assertIn("paths:start", once)
        finally:
            build.SITE = saved
            shutil.rmtree(tmp)

    def test_missing_marker_is_an_error(self):
        tmp = Path(tempfile.mkdtemp())
        saved = build.SITE
        try:
            (tmp / "index.html").write_text("<html></html>")
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
            (tmp / "tools").mkdir()
            for f in (tmp / "a.html", tmp / "tools" / "b.html"):
                f.write_text('<html><head><meta charset="utf-8">\n<title>x</title></head></html>')
            build.SITE, build.WAITLIST_ENDPOINT = tmp, "https://formspree.io/f/abc"
            build.site_csp()
            build.site_csp()
            for f in (tmp / "a.html", tmp / "tools" / "b.html"):
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
        z = zipfile.ZipFile(ROOT / "website" / "downloads" / "busywork.zip")
        names = z.namelist()
        self.assertNotIn("Busywork/shared/ai.js", names)
        self.assertNotIn("Busywork/shared/examples.js", names)
        self.assertFalse(any("/apps/olaf/" in n for n in names), "Olaf is not in the free download")
        banned = ["x-api-key", "Claude API key", "Connect AI", "AI settings", "Show me with example data", "Just try it out", "examples.load(", "data-key", "demo.js"]
        for n in names:
            if n.endswith((".js", ".html", ".txt")):
                text = z.read(n).decode("utf-8", "ignore")
                for b in banned:
                    self.assertNotIn(b, text, f"{n} mentions {b!r}")
        lib = z.read("Busywork/apps/marketing/library.js").decode()
        self.assertNotIn('"body"', lib, "the Studio ships playbook names only")
        self.assertNotIn('"foundation"', lib, "no AI prompt in the free Studio")

    def test_every_website_tool_page_is_the_demo(self):
        pages = sorted((ROOT / "website" / "app").rglob("index.html"))
        self.assertGreater(len(pages), 10)
        for p in pages:
            html_text = p.read_text()
            demo, core = html_text.find("assets/demo.js"), html_text.find("shared/core.js")
            self.assertTrue(0 < demo < core, f"{p.relative_to(ROOT)} loads demo.js before core.js")

    def test_website_offers_the_demo_not_a_browser_version(self):
        for p in list((ROOT / "website").glob("*.html")) + list((ROOT / "website" / "tools").glob("*.html")):
            t = p.read_text()
            for b in ["Try it in your browser", "Try it online", "Try it now", "Add your own Claude key for AI", "just try it out"]:
                self.assertNotIn(b, t, f"{p.name}: {b}")
        self.assertIn("See the demo", (ROOT / "website" / "index.html").read_text())


if __name__ == "__main__":
    unittest.main()
