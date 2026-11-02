"""Busy in other languages: the words of the website and the apps, and their translations.

How it works
- English is the source. `python3 i18n/i18n.py extract` collects every piece of text people see: from the
  built website (text, alt texts, labels, page titles and descriptions, the guides' lines, structured data)
  and from the apps' and the website's scripts (string and template literals, split where HTML tags or
  ${…} values sit; a value becomes {0}, {1}, …). The result is i18n/strings.json: one key per piece of text.
- i18n/<lang>.json holds the translations: {"English text": "translation"}. A key with {0} is a pattern:
  "{0} open invoices" matches "3 open invoices", and the value keeps the {0}.
- The website build (build.py) writes a translated copy of every page under /<lang>/ with translate_html();
  the apps (and the website's moving parts) translate in the browser with app/shared/i18n.js and the same
  words (app/shared/i18n/<lang>.js, written by `python3 i18n/i18n.py apps`).
- check.py fails when a language misses a key, so nothing ships half translated.

Languages: Dutch, German, Spanish, Italian and Brazilian Portuguese."""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
LANGS = {"nl": "Nederlands", "de": "Deutsch", "es": "Español", "it": "Italiano", "pt-br": "Português (Brasil)"}
HTML_LANG = {"nl": "nl", "de": "de", "es": "es", "it": "it", "pt-br": "pt-BR"}
# Attributes whose value people read (or hear, with a screen reader).
TEXT_ATTRS = {"alt", "title", "aria-label", "placeholder", "data-say", "data-title", "data-next-label", "data-label", "label"}
META_TEXT = {"description", "og:title", "og:description", "og:image:alt", "twitter:image:alt", "twitter:title", "twitter:description"}
LD_TEXT = {"name", "description", "text", "headline", "slogan", "caption", "disambiguatingDescription"}
SKIP_TAGS = {"script", "style", "code", "pre", "kbd"}
LETTERS = re.compile(r"[A-Za-z]{2}")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def is_text(s: str) -> bool:
    """Worth translating: has words, and isn't a URL, a file name, a number or code."""
    s = s.strip()
    if not LETTERS.search(s) or len(s) < 2:
        return False
    if re.fullmatch(r"[\w.\-/]+\.(html|js|css|json|png|jpg|svg|glb|pdf|zip|dmg|exe|md|txt|csv|ics)", s) or re.match(r"^(https?:|mailto:|#|\.\./|\./|data:)", s):
        return False
    if re.fullmatch(r"[a-z0-9_\-:.]+", s) and ("-" in s or "_" in s or ":" in s or "." in s):  # ids, keys, classes
        return False
    if re.fullmatch(r"#[0-9A-Fa-f]{3,8}", s) or re.fullmatch(r"[\d\s.,:%€$£+\-–/()]+", s):
        return False
    return True


# ---------- the website's text ----------
class _Collect(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.ld = [], 0, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP_TAGS:
            self.skip += 1
            self.ld = tag == "script" and a.get("type") == "application/ld+json"
        for k, v in attrs:
            if v and (k in TEXT_ATTRS) and is_text(v):
                self.out.append(norm(v))
            if k == "data-swap" and v:
                try:
                    self.out += [norm(x) for x in json.loads(v) if is_text(x)]
                except ValueError:
                    pass
        if tag == "meta" and (a.get("name") in META_TEXT or a.get("property") in META_TEXT) and a.get("content") and is_text(a["content"]):
            self.out.append(norm(a["content"]))

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self.skip:
            self.skip -= 1
            self.ld = False

    def handle_data(self, data):
        if self.ld:
            try:
                self.out += ld_strings(json.loads(data))
            except ValueError:
                pass
            return
        if self.skip:
            return
        t = norm(data)
        if is_text(t):
            self.out.append(t)


def ld_strings(obj) -> list:
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in LD_TEXT and isinstance(v, str) and is_text(v):
                out.append(norm(v))
            elif isinstance(v, (dict, list)):
                out += ld_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            out += ld_strings(v)
    return out


def page_strings(text: str) -> list:
    c = _Collect()
    c.feed(text)
    return c.out


# ---------- the scripts' text ----------
LIT = re.compile(r"`(?:\\.|\$\{(?:[^{}]|\{[^{}]*\})*\}|[^`\\])*`|'(?:\\.|[^'\\\n])*'|\"(?:\\.|[^\"\\\n])*\"", re.S)


def _unescape_js(s: str) -> str:
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\n", "\n").replace("\\`", "`").replace("\\\\", "\\")


def literal_segments(lit: str) -> list:
    """The pieces of text in one JS literal: split at HTML tags; ${…} values become {0}, {1}, …
    A template comes from js_literals with its ${…} already swapped for \x00n\x01 marks."""
    body = _unescape_js(lit[1:-1])
    parts = re.split(r"<[^>]*>", body)
    out = []
    for p in parts:
        t = norm(html.unescape(p))
        if "\x00" in t:
            # renumber the placeholders of this piece from 0
            k = [0]

            def re_ph(m):
                k[0] += 1
                return "{" + str(k[0] - 1) + "}"
            t = re.sub(r"\x00\d+\x01", re_ph, t)
        if is_text(re.sub(r"\{\d+\}", "", t)) and not looks_like_code(t) and ui_text(t):
            out.append(t)
    return out


REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^") 


def js_literals(src: str, i: int = 0, stop: str = "") -> tuple:
    """Every string and template literal in a piece of JS, also those inside ${…} of a template, at any depth.
    Skips comments and regular expressions. Returns (literals, end); a template's ${…} become \x00n\x01."""
    out, n, depth, prev = [], len(src), 0, "("
    while i < n:
        c = src[i]
        if stop and c == "}" and depth == 0:
            return out, i
        if c == "/" and src.startswith("//", i):
            j = src.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and src.startswith("/*", i):
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c == "/" and (prev in REGEX_BEFORE or re.search(r"\b(return|typeof|case|in|of)\s*$", src[max(0, i - 8):i])):
            j, cls = i + 1, False
            while j < n and src[j] != "\n":
                if src[j] == "\\": j += 2; continue
                if src[j] == "[": cls = True
                elif src[j] == "]": cls = False
                elif src[j] == "/" and not cls: break
                j += 1
            i, prev = j + 1, "a"; continue
        if c in "'\"":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1]); i, prev = j + 1, "a"; continue
        if c == "`":
            j, body, k = i + 1, [], 0
            while j < n and src[j] != "`":
                if src[j] == "\\":
                    body.append(src[j:j + 2]); j += 2; continue
                if src.startswith("${", j):
                    inner, e = js_literals(src, j + 2, "}")
                    out += inner
                    body.append("\x00%d\x01" % k); k += 1; j = e + 1; continue
                body.append(src[j]); j += 1
            out.append("`" + "".join(body) + "`"); i, prev = j + 1, "a"; continue
        if c == "{": depth += 1
        elif c == "}": depth -= 1
        if not c.isspace():
            prev = c if not (c.isalnum() or c in "_$") else "a"
        i += 1
    return out, i


def looks_like_code(t: str) -> bool:
    return bool(re.search(r"=\s|;\s*($|[a-z_$][\w$.]*\s*[=(])|=>|\bfunction\b|\breturn\b|\bconst\b|\bvar\b|\.(js|css)\b|^\s*[.#][a-z][\w-]*\s*\{|^[a-z]+\([^)]*\)$|^\w+\.\w+\(|\bBW\.|document\.|window\.", t)) \
        or bool(re.fullmatch(r"[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+", t)) or bool(re.fullmatch(r"[\w-]+(\s[\w-]+)*", t) and t == t.lower() and ("-" in t or "_" in t))


def ui_text(t: str) -> bool:
    """Text from a script that people see: words with a space, or a capitalised word; never selectors,
    ids, file formats or code fragments, and not the long instructions sent to the AI."""
    bare = re.sub(r"\{\d+\}", "", t).strip()
    if len(t) > 360 or re.search(r"[\[\]{}]|\$\{|\)\.\w|=>|\|\||&&|^[A-Z]+:[A-Z]|^END:|^BEGIN:", re.sub(r"\{\d+\}", "", t)):
        return False
    if re.match(r"^(PRODID|\*\*|\*Last|- |\(display-mode|\(prefers-|translate\(|/)", bare) or re.search(r"\d(px|deg)\b|^\w+/\{|\.html\b", t):
        return False  # calendar codes, notes written for the AI, CSS, folder paths
    if re.fullmatch(r"[.#][\w-]+(:[\w()-.]+)?([\s,>]+[.#]?[\w-]+(:[\w().-]+)?)*", bare):
        return False  # CSS selectors
    if " " not in bare:
        return bool(re.match(r"^[^a-z]", bare)) and not re.fullmatch(r"[A-Z0-9_]+", bare) and not re.fullmatch(r"[A-Z][a-z]+[A-Z]\w*", bare)
    return True


def script_strings(text: str) -> list:
    # text written in a document's own language (marked "// i18n: skip" … "// i18n: end") is not screen text
    text = re.sub(r"// i18n: skip.*?// i18n: end", "", text, flags=re.S)
    out = []
    for lit in js_literals(text)[0]:
        out += literal_segments(lit)
    return out


# Script files people never see text from (data, engines, libraries) and the pretend demo data.
# the demo businesses (examples.js and co.) are translated too, so a visitor sees the demo in their language
SKIP_SCRIPTS = {"vendor", "three-busy.js", "scene.js", "schema.js", "pdf.js", "filetext.js", "qr.js", ".glb.js"}


def app_scripts() -> list:
    files = [p for p in (ROOT / "app").rglob("*.js") if not any(s in str(p) for s in SKIP_SCRIPTS) and "/i18n/" not in str(p)]
    files += [ROOT / "website" / "assets" / f for f in ("place.js", "site.js", "demo.js")]
    files += sorted((ROOT / "website" / "assets" / "games").glob("*.js"))
    files += [p for p in (ROOT / "app").rglob("*.html")]
    return files


def site_pages() -> list:
    site = ROOT / "website"
    pages = []
    for p in sorted(site.rglob("*.html")):
        rel = p.relative_to(site).as_posix()
        if rel.split("/")[0] in ("app", "content", "_archive", "tools") or rel.split("/")[0] in LANGS:
            continue
        t = p.read_text()
        if 'http-equiv="refresh"' in t:
            continue
        pages.append(p)
    return pages


# Words a script asks for with BW.t() that the extractor would take for code (one lowercase word).
EXTRA_KEYS = ["now"]


def extract(report: bool = False) -> dict:
    keys, per = {}, {}
    for k in EXTRA_KEYS:
        keys[k] = "app"
    for p in site_pages():
        for s in page_strings(p.read_text()):
            keys.setdefault(s, "site")
    for p in app_scripts():
        text = p.read_text(errors="ignore")
        for s in (page_strings(text) if p.suffix == ".html" else script_strings(text)):
            if s not in keys:
                per[p.name] = per.get(p.name, 0) + len(s.split())
            keys.setdefault(s, "app")
    if report:
        for name, w in sorted(per.items(), key=lambda x: -x[1])[:25]:
            print(f"  {name}: {w} words")
    return keys


# ---------- translating ----------
_cache = {}


def load(lang: str) -> tuple:
    """(exact, patterns, missing): exact {text: translation}; patterns [(regex, translation, n)] for keys with {0}."""
    if lang in _cache:
        return _cache[lang]
    f = HERE / f"{lang}.json"
    words = json.loads(f.read_text()) if f.exists() else {}
    exact, patterns = {}, []
    for k, v in words.items():
        if not v:
            continue
        if re.search(r"\{\d+\}", k):
            if re.sub(r"\{\d+\}", "", k).strip():
                rx = "^" + re.sub(r"\\\{(\d+)\\\}", r"(?P<p\1>.+?)", re.escape(k)) + "$"
                patterns.append((re.compile(rx, re.S), v))
        else:
            exact[k] = v
    patterns.sort(key=lambda p: -len(p[0].pattern))  # the most specific first
    _cache[lang] = (exact, patterns, set())
    return _cache[lang]


def translate_text(s: str, lang: str) -> str:
    """One piece of text (whitespace around it kept). English stays when there's no translation."""
    if not s or not s.strip():
        return s
    lead, core, trail = re.match(r"^(\s*)(.*?)(\s*)$", s, re.S).groups()
    key = norm(core)
    exact, patterns, missing = load(lang)
    if key in exact:
        return lead + exact[key] + trail
    for rx, v in patterns:
        m = rx.match(key)
        if m:
            out = v
            for name, val in m.groupdict().items():
                out = out.replace("{" + name[1:] + "}", exact.get(norm(val), val))
            return lead + out + trail
    if is_text(key) and not re.fullmatch(r"[\w./-]+/", key):  # a folder path stays as it is
        missing.add(key)
    return s


PATH_ATTRS = {"href", "src", "poster", "action", "data-house-rooms", "data-house-plates", "data-tuck-model", "data-expert-model",
              "data-extra-rooms", "data-extra-plates"}
TAG = re.compile(r"<!--.*?-->|<(script|style)\b[^>]*>.*?</\1>|<(?:[^>\"']|\"[^\"]*\"|'[^']*')+>", re.S | re.I)
ATTR = re.compile(r'([\w:-]+)(\s*=\s*)("([^"]*)"|\'([^\']*)\')')


def translate_html(text: str, lang: str, rel: str, pages: set, site_url: str) -> str:
    """A website page in another language: its words translated, its links one folder deeper (/<lang>/), the
    links between pages kept inside that language, canonical and structured data pointing at this version."""
    import posixpath
    here = posixpath.dirname(rel)

    def new_url(u: str) -> str:
        if not u or re.match(r"^(#|mailto:|tel:|data:|javascript:|blob:)", u):
            return u
        if u.startswith(site_url + "/"):
            path = u[len(site_url) + 1:]
            p = path.split("#")[0].split("?")[0]
            return f"{site_url}/{lang}/{path}" if (p in pages or p == "" or p.endswith("/") and p + "index.html" in pages) else u
        if re.match(r"^[a-z]+:", u):
            return u
        if u.startswith("/"):
            p = u[1:].split("#")[0].split("?")[0]
            return f"/{lang}{u}" if (p in pages or p == "" or p + "index.html" in pages) else u
        target = posixpath.normpath(posixpath.join(here, u.split("#")[0].split("?")[0])) if u.split("#")[0] else rel
        if target in pages or target + "/index.html" in pages or (u.split("#")[0] == "" ):
            return u  # a page: the same page in this language, one folder down as well
        return "../" + u

    def ld(obj):
        if isinstance(obj, dict):
            out = {}
            for k, v in obj.items():
                if k in LD_TEXT and isinstance(v, str):
                    out[k] = translate_text(v, lang)
                elif k in ("url", "@id", "item") and isinstance(v, str):
                    out[k] = new_url(v)
                elif k == "inLanguage":
                    out[k] = HTML_LANG[lang]
                else:
                    out[k] = ld(v)
            return out
        if isinstance(obj, list):
            return [ld(v) for v in obj]
        return obj

    def tag(m):
        t = m.group(0)
        if t.startswith("<!--"):
            return t
        low = t[:30].lower()
        if low.startswith("<script"):
            if 'application/ld+json' in t[:80]:
                head, body = t.split(">", 1)
                body = body[: -len("</script>")]
                try:
                    return head + ">" + json.dumps(ld(json.loads(body)), ensure_ascii=False).replace("</", "<\\/") + "</script>"
                except ValueError:
                    return t
            if 'type="importmap"' in t[:60]:
                head, body = t.split(">", 1)
                return head + ">" + re.sub(r'"(\.\./[^"]+)"', lambda mm: '"../' + mm.group(1) + '"', body)
            head, rest = t.split(">", 1)  # a script file: its address is one folder further up
            return re.sub(r'(\ssrc=)(["\'])([^"\']*)\2', lambda mm: mm.group(1) + mm.group(2) + new_url(mm.group(3)) + mm.group(2), head) + ">" + rest
        if low.startswith("<style"):
            return t
        if t.startswith("</"):
            return t
        name = re.match(r"<([\w-]+)", t)
        name = name.group(1).lower() if name else ""
        meta_text = name == "meta" and re.search(r'(name|property)="(%s)"' % "|".join(re.escape(x) for x in META_TEXT), t)

        def attr(a):
            k, eq, _, v1, v2 = a.groups()
            v = v1 if v1 is not None else v2
            q = '"' if v1 is not None else "'"
            kl = k.lower()
            esc = lambda x: html.escape(x, quote=True) if q == '"' else html.escape(x, quote=False).replace("'", "&#39;")
            if kl in TEXT_ATTRS:
                v = esc(translate_text(html.unescape(v), lang))
            elif kl == "data-swap":
                try:
                    v = esc(json.dumps([translate_text(x, lang) for x in json.loads(html.unescape(v))], ensure_ascii=False))
                except ValueError:
                    pass
            elif kl in PATH_ATTRS:
                v = new_url(html.unescape(v)).replace('"', "&quot;")
            elif kl == "content" and meta_text:
                v = html.escape(translate_text(html.unescape(v), lang), quote=True)
            elif kl == "content" and name == "meta" and 'property="og:url"' in t:
                v = new_url(v)
            elif kl == "style" and "url(" in v:
                v = re.sub(r"url\((['\"]?)([^'\")]+)\1\)", lambda mm: f"url({mm.group(1)}{new_url(mm.group(2))}{mm.group(1)})", v)
            elif kl == "srcset":
                v = ", ".join(" ".join([new_url(p.strip().split(" ")[0])] + p.strip().split(" ")[1:]) for p in v.split(","))
            return f"{k}{eq}{q}{v}{q}"
        t = ATTR.sub(attr, t)
        if name == "html":
            t = re.sub(r'lang="[^"]*"', f'lang="{HTML_LANG[lang]}"', t)
        return t

    out, last = [], 0
    for m in TAG.finditer(text):
        chunk = text[last:m.start()]
        out.append(html.escape(translate_text(html.unescape(chunk), lang), quote=False) if chunk.strip() else chunk)
        out.append(tag(m))
        last = m.end()
    out.append(text[last:])
    return "".join(out)


# ---------- the words for the browser ----------
def site_script_keys() -> set:
    """What the website's own scripts show (the places, the downloads, the games)."""
    files = [ROOT / "website" / "assets" / f for f in ("place.js", "site.js")] + sorted((ROOT / "website" / "assets" / "games").glob("*.js"))
    return {s for f in files for s in script_strings(f.read_text(errors="ignore"))}


def app_keys() -> set:
    out = set()
    for p in app_scripts():
        text = p.read_text(errors="ignore")
        out |= set(page_strings(text) if p.suffix == ".html" else script_strings(text))
    return out


def runtime_js(lang: str, keys: set) -> str:
    words = json.loads((HERE / f"{lang}.json").read_text()) if (HERE / f"{lang}.json").exists() else {}
    picked = {k: words[k] for k in sorted(keys) if words.get(k)}
    return (f"/* Busy in {LANGS[lang]}: the words for shared/i18n.js, made by i18n/i18n.py from i18n/{lang}.json. Do not edit by hand. */\n"
            f"window.BUSY_I18N = {{ lang: {json.dumps(lang)}, words: {json.dumps(picked, ensure_ascii=False, separators=(',', ':'))} }};\n")


def words_js(lang: str, paths) -> str:
    """A word list with only the words these files show: a download carries nothing of what it leaves out
    (no AI settings in the free tools, no demo businesses)."""
    keys = set(EXTRA_KEYS)
    for p in paths:
        p = Path(p)
        if p.suffix in (".js", ".html") and "/i18n/" not in p.as_posix():
            text = p.read_text(errors="ignore")
            keys |= set(page_strings(text) if p.suffix == ".html" else script_strings(text))
    return runtime_js(lang, keys)


def write_app_words() -> None:
    out = ROOT / "app" / "shared" / "i18n"
    out.mkdir(exist_ok=True)
    keys = app_keys() | site_script_keys()
    for lang in LANGS:
        (out / f"{lang}.js").write_text(runtime_js(lang, keys))
    print(f"app/shared/i18n: {len(keys)} pieces of text for {len(LANGS)} languages")


def coverage() -> None:
    """How much of each language is done."""
    k = json.loads((HERE / "strings.json").read_text())
    for lang in LANGS:
        words = json.loads((HERE / f"{lang}.json").read_text()) if (HERE / f"{lang}.json").exists() else {}
        done = sum(1 for x in k if words.get(x))
        print(f"{lang}: {done}/{len(k)}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "extract"
    if cmd == "extract":
        k = extract(report=True)
        (HERE / "strings.json").write_text(json.dumps(k, ensure_ascii=False, indent=0, sort_keys=True))
        words = sum(len(x.split()) for x in k)
        print(f"i18n/strings.json: {len(k)} pieces of text, {words} words "
              f"({sum(1 for v in k.values() if v == 'site')} from the website, {sum(1 for v in k.values() if v == 'app')} from the scripts)")
    elif cmd == "apps":
        write_app_words()
    elif cmd == "coverage":
        coverage()
