"""Translating in batches. `python3 i18n/work.py keys` numbers every piece of text in strings.json
(i18n/work/keys.tsv); `show <from> <count>` prints a batch; translations go in i18n/work/<lang>/<from>.tsv
as "number<TAB>translation" lines ("=" keeps the English, for names); `merge` checks them (the same
{0} placeholders, nothing empty) and writes i18n/<lang>.json; `todo` says what is still missing."""
import json, os, re, sys
from pathlib import Path

# I18N_DIR points it at another word list with the same layout (the experts' one in the private repo)
HERE = Path(os.environ.get("I18N_DIR") or Path(__file__).resolve().parent).resolve()
WORK = HERE / "work"
LANGS = ["nl", "de", "es", "it", "pt-br"]


def keys():
    return [l.split("\t", 1)[1] for l in (WORK / "keys.tsv").read_text().splitlines()]


def number():
    WORK.mkdir(exist_ok=True)
    strings = json.loads((HERE / "strings.json").read_text())
    old = keys() if (WORK / "keys.tsv").exists() else []
    # numbers never change: new text is added at the end
    seen = set(old)
    order = old + [k for k in strings if k not in seen]
    (WORK / "keys.tsv").write_text("".join(f"{i}\t{k}\n" for i, k in enumerate(order)))
    print(f"{len(order)} pieces ({len(order) - len(old)} new)")


def done(lang):
    out = {}
    for f in sorted((WORK / lang).glob("*.tsv")) if (WORK / lang).exists() else []:
        for line in f.read_text().splitlines():
            if "\t" in line:
                i, t = line.split("\t", 1)
                if i.strip().isdigit():
                    out[int(i)] = t
    return out


def merge():
    ks = keys()
    strings = json.loads((HERE / "strings.json").read_text())
    for lang in LANGS:
        d, bad, words = done(lang), [], {}
        for i, t in d.items():
            k = ks[i]
            t = k if t.strip() == "=" else t.strip()
            # a translation may leave out a placeholder (an English plural "s"), never add one
            if not set(re.findall(r"\{\d+\}", t)) <= set(re.findall(r"\{\d+\}", k)) or not t:
                bad.append((i, k, t))
                continue
            words[k] = t
        missing = [i for i, k in enumerate(ks) if k in strings and k not in words]
        (HERE / f"{lang}.json").write_text(json.dumps(dict(sorted(words.items())), ensure_ascii=False, indent=0) + "\n")
        print(f"{lang}: {len(words)} translated, {len(missing)} missing, {len(bad)} with wrong placeholders")
        for b in bad[:10]:
            print("   ", b)


def show(start, count):
    ks = keys()
    for i in range(start, min(start + count, len(ks))):
        print(f"{i}\t{ks[i]}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if cmd == "keys": number()
    elif cmd == "show": show(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "merge": merge()
    else:
        ks = keys()
        for lang in LANGS:
            d = done(lang); print(lang, len(d), "of", len(ks), "first missing:", next((i for i in range(len(ks)) if i not in d), None))
