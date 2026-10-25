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
"""
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


def main():
    scripts = [str(p) for p in sorted((ROOT / "app").rglob("*.js")) if p.name not in GENERATED]
    scripts += [str(p) for p in sorted((ROOT / "website" / "assets").glob("*.js"))]
    for s in scripts:
        r = subprocess.run(["node", "--check", s], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"check: {s} does not parse\n{r.stderr}")
    print(f"== {len(scripts)} scripts parse")
    run("build", [sys.executable, "build.py"])
    run("logic tests", ["node", "--test", *sorted(str(p) for p in (ROOT / "tests").glob("*.test.js"))])
    run("build tests", [sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"])
    print("\ncheck: all good")


if __name__ == "__main__":
    main()
