"""Read the text in pictures, for the OCR test of the hero element (§ 11.6). Free, local.

tesseract when it is installed (brew install tesseract); otherwise, on macOS, the Vision
framework through scripts/character/ocr.swift. read() returns None when neither exists:
the test is then reported as not run, never as passed.
"""
import difflib, os, re, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))


def engine():
    if shutil.which("tesseract"):
        return "tesseract"
    if shutil.which("swift") and os.path.exists(os.path.join(HERE, "ocr.swift")):
        return "vision"
    return None


def read(paths):
    """{path: text} for every picture, or None when no OCR engine exists."""
    e = engine()
    if e is None:
        return None
    out = {}
    if e == "tesseract":
        for p in paths:
            r = subprocess.run(["tesseract", p, "-", "--psm", "6"], capture_output=True, text=True)
            out[p] = " | ".join(l for l in r.stdout.splitlines() if l.strip())
        return out
    r = subprocess.run(["swift", os.path.join(HERE, "ocr.swift"), *paths],
                       capture_output=True, text=True, timeout=300)
    for line in r.stdout.splitlines():
        if "\t" in line:
            p, t = line.split("\t", 1)
            out[p] = t
    for p in paths:
        out.setdefault(p, "")
    return out


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w%$€£.,:'/-]+", " ", (s or "").lower())).strip()


def matches(hero, text, ratio=0.9):
    """The hero string is read when it appears in the text, or a window of the text is at
    least `ratio` similar to it (one wrong letter in a long string)."""
    h, t = norm(hero), norm(text.replace("|", " "))
    if not h:
        return False, 0.0
    if h in t:
        return True, 1.0
    words, n = t.split(), len(h.split())
    best = 0.0
    for k in range(max(1, n - 1), n + 2):
        for i in range(0, max(1, len(words) - k + 1)):
            best = max(best, difflib.SequenceMatcher(None, h, " ".join(words[i:i + k])).ratio())
    return best >= ratio, round(best, 3)
