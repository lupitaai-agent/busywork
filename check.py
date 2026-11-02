#!/usr/bin/env python3
"""Every check before anything is published, in one command: python3 check.py
The same command runs on GitHub before each deploy (.github/workflows/pages.yml), so what passes
here passes there. Needs only Node 22+ and Python 3.9+; no packages.

1. every script parses        node --check
2. a real build               build.py, which ends with the leak check on the finished site; it
                              also makes the generated files the tests need (a fresh checkout,
                              like GitHub's, has none)
3. the logic works            node --test tests/*.test.js
4. the build is safe          python3 -m unittest discover tests (leak check, homepage block)
5. every language             each word list covers the English text and keeps its {0} gaps; missing
                              text is a warning (it shows in English), a broken gap fails
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GENERATED = {"library.js"}  # built from marketing/, checked by building


def run(title, cmd):
    print(f"\n== {title}", flush=True)
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode:
        raise SystemExit(f"check: {title} failed")


def languages():
    print("\n== languages", flush=True)
    sys.path.insert(0, str(ROOT / "i18n"))
    import i18n
    english = json.loads((ROOT / "i18n" / "strings.json").read_text())
    gaps = lambda t: set(re.findall(r"\{\d+\}", t))
    for lang in i18n.LANGS:
        words = json.loads((ROOT / "i18n" / f"{lang}.json").read_text())
        missing = [k for k in english if not words.get(k)]
        broken = [k for k, v in words.items() if v and not gaps(v) <= gaps(k)]
        if broken:
            raise SystemExit(f"check: {lang} has gaps that are not in the English: " + " | ".join(broken[:5]))
        print(f"{lang}: {len(english) - len(missing)} of {len(english)}" + (f", still in English: {' | '.join(missing[:5])}" if missing else ""))


def main():
    scripts = [str(p) for p in sorted((ROOT / "app").rglob("*.js")) if p.name not in GENERATED]
    scripts += [str(p) for p in sorted((ROOT / "website" / "assets").rglob("*.js"))]
    for s in scripts:
        r = subprocess.run(["node", "--check", s], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"check: {s} does not parse\n{r.stderr}")
    print(f"== {len(scripts)} scripts parse")
    run("build", [sys.executable, "build.py"])
    run("logic tests", ["node", "--test", *sorted(str(p) for p in (ROOT / "tests").glob("*.test.js"))])
    run("build tests", [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"])
    languages()
    print("\ncheck: all good")


if __name__ == "__main__":
    main()
