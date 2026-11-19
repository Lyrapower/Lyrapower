"""Run every code card in src/cards.js with real Python and check it prints the stated answer.

    pip install numpy pandas
    python3 test/check_cards.py

A card whose answer is an exception name (TypeError, KeyError, ...) must raise exactly that.
A card answered "正常运行" (runs fine) must print nothing and raise nothing.
Output that ends with spaces from print(..., end=' ') is compared without the trailing spaces.
"""
import contextlib, io, json, pathlib, re, sys

src = (pathlib.Path(__file__).resolve().parent.parent / "src" / "cards.js").read_text(encoding="utf-8")
cards = json.loads(re.search(r"const CARDS\s*=\s*(\[.*?\]);\s*\n", src, re.S).group(1))


def run(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "<card>", "exec"), {"__name__": "__main__"})
        err = None
    except Exception as e:  # the card may be about an exception
        err = type(e).__name__
    out = buf.getvalue().rstrip("\n").rstrip(" ")
    lines = [l.rstrip(" ") for l in out.split("\n")] if out else []
    return " ⏎ ".join(lines + ([err] if err else []))


bad = []
for c in cards:
    got, want = run(c["c"]), c["a"]
    if want == "正常运行":
        want = ""
    if got != want:
        bad.append((c["id"], want, got))
    if want in c["d"]:
        bad.append((c["id"], "answer also listed as a wrong option", want))

for b in bad:
    print("FAIL", *b, sep=" | ")
print(f"{len(cards) - len(bad)}/{len(cards)} cards print what they say")
sys.exit(1 if bad else 0)
