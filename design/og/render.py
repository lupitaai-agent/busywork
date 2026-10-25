#!/usr/bin/env python3
"""Renders the share images with headless Chrome: design/og/*.html -> website/assets/*.png (1200 x 630)."""
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent.parent / "website" / "assets"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

for page in sorted(HERE.glob("og-*.html")):
    out = ASSETS / (page.stem + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=1200,630", f"--screenshot={out}", page.as_uri()], check=True, capture_output=True)
    print(out.relative_to(HERE.parent.parent))
