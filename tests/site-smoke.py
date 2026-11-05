"""Check internal static-site links and the Studio's share-preview asset.

Run from the website root with: python tests/site-smoke.py
Uses only the Python standard library.
"""

from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit


ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = "https://erninstitute.com"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.links.append((tag, attr, attrs[attr]))


def main():
    pages = sorted(ROOT.rglob("*.html"))
    broken = []
    checked = 0
    for page in pages:
        if ".git" in page.parts:
            continue
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        base = SITE_ORIGIN + "/" + page.relative_to(ROOT).as_posix()
        for tag, attr, target in parser.links:
            url = urlsplit(urljoin(base, target))
            if url.netloc != "erninstitute.com" or url.scheme not in ("https", "http"):
                continue
            if target.startswith('#') and url.fragment and url.fragment not in parser.ids:
                broken.append((page.name, target, "missing anchor"))
            destination = ROOT / unquote(url.path).lstrip("/")
            if destination.is_dir():
                destination /= "index.html"
            if not destination.is_file():
                broken.append((str(page.relative_to(ROOT)), target, "missing local file"))
            checked += 1

    studio = (ROOT / "tools/meta-analysis-studio/index.html").read_text(encoding="utf-8")
    preview = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', studio)
    if not preview or not preview.group(1).startswith(SITE_ORIGIN + "/images/"):
        broken.append(("Studio", "Open Graph image", "missing metadata"))
    else:
        asset = ROOT / urlsplit(preview.group(1)).path.lstrip("/")
        if not asset.is_file():
            broken.append(("Studio", "share preview", "image file missing"))
        elif asset.read_bytes()[16:24] != b"\x00\x00\x04\xb0\x00\x00\x02\x76":
            broken.append(("Studio", "share preview", "not 1200 × 630 PNG"))

    if broken:
        for filename, target, error in broken:
            print(f"BROKEN {filename}: {target} ({error})")
        raise SystemExit(1)
    print(f"ERN static-site smoke tests passed: {len(pages)} pages, {checked} same-origin references.")


if __name__ == "__main__":
    main()
