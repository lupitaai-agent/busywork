"""Tells Bing and the other IndexNow search engines (Yandex, Seznam, Naver; Bing shares with Yahoo and DuckDuckGo)
about the pages that changed, the moment the site is published, instead of waiting for them to come by.

    python3 tools/indexnow.py urls indexnow.txt     the pages changed in the last two days (from website/sitemap.xml)
    python3 tools/indexnow.py send indexnow.txt     tells IndexNow about them (pages.yml, after publishing)

The key is not a secret: IndexNow checks it against the file build.py publishes at /<key>.txt, which proves the
site is ours. Bing Webmaster Tools lists what it received under IndexNow."""
import datetime
import json
import re
import sys
import urllib.request
from pathlib import Path

KEY = "56c5232f8cb130ff20676ca297bd8f8c"
ROOT = Path(__file__).resolve().parent.parent


def urls(out: str) -> None:
    text = (ROOT / "website" / "sitemap.xml").read_text()
    since = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()
    found = [loc for loc, mod in re.findall(r"<url><loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", text) if mod >= since]
    Path(out).write_text("\n".join(found[:10000]) + ("\n" if found else ""))
    print(f"{len(found)} changed pages for IndexNow")


def send(src: str) -> None:
    found = [u for u in Path(src).read_text().split() if u]
    if not found:
        return print("IndexNow: nothing changed")
    host = re.match(r"https?://([^/]+)", found[0]).group(1)
    body = json.dumps({"host": host, "key": KEY, "keyLocation": f"https://{host}/{KEY}.txt", "urlList": found}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"IndexNow: {len(found)} pages sent, answer {r.status}")
    except Exception as e:  # never fail a publish over this
        print(f"IndexNow: not sent ({e})")


if __name__ == "__main__":
    {"urls": urls, "send": send}[sys.argv[1]](sys.argv[2])
