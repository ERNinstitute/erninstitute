#!/usr/bin/env python3
"""Refresh the ERN annual publisher JIF snapshot from directly published pages.

Only publisher-hosted, public journal metrics are used; this is not a Clarivate
data export. A source is skipped when access, parsing, dates, or robots rules fail.
Existing verified records are retained with their ORIGINAL year and check date.
Default mode is validation/dry-run. --write saves an updated candidate file.
"""

import argparse
from datetime import date
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
from urllib import request, error, robotparser
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "journal-impact-factors-batch.json"
AGENT = "ERNInstituteMetrics/1.0 (+https://erninstitute.com/metrics.html)"
ALLOWED_HOSTS = {
    "www.apa.org", "www.nature.com",
    "pathsocjournals.onlinelibrary.wiley.com",
}
ROBOTS = {}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.depth = 0
        self.rows = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            if self.depth == 0:
                self.rows = []
            self.depth += 1
        if not self.depth:
            return
        if tag == "tr":
            self.row = []
        elif tag in {"th", "td"} and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if not self.depth:
            return
        if tag in {"th", "td"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join(" ".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
        elif tag == "table":
            self.depth -= 1
            if self.depth == 0 and self.rows is not None:
                self.tables.append(self.rows)
                self.rows = None


def parse_apa(document):
    """Extract publisher's full official JIF table, not other narrative figures."""
    parser = TableParser()
    parser.feed(document)
    for rows in parser.tables:
        if not rows:
            continue
        header = " ".join(rows[0]).lower()
        if not all(x in header for x in ("journal", "jif", "5-year")):
            continue
        year = re.search(r"\b(20\d{2})\s*JIF\b", " ".join(rows[0]), flags=re.I)
        if year is None:
            raise ValueError("APA JIF year is not explicitly identified")
        parsed = []
        for row in rows[1:]:
            if len(row) < 3:
                continue
            title = row[0].strip()
            values = [x.strip().replace(",", "") for x in row[1:3]]
            if not title or not all(re.fullmatch(r"\d+(?:\.\d+)?", n) for n in values):
                continue
            parsed.append([title, *[float(v) for v in values]])
        if len(parsed) < 70:
            raise ValueError(f"APA table too small: {len(parsed)} journal rows")
        if len(parsed) != len({name.lower() for name, *_ in parsed}):
            raise ValueError("Duplicate APA titles detected")
        return int(year.group(1)), parsed
    raise ValueError("Official APA two-year and five-year JIF table not found")


def text_only(document):
    document = re.sub(r"<(?:script|style)\b[^>]*>[\s\S]*?</(?:script|style)>",
                      " ", document, flags=re.I)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", document)).split())


def parse_journal_metrics(document):
    """Read dated 2-year/5-year JIFs, excluding other journal-level metrics."""
    text = text_only(document)
    five = re.search(r"\b5[-\s]year\s+(?:Journal\s+)?Impact\s+Factor\s*:\s*"
                     r"(\d+(?:\.\d+)?)\s*\((20\d{2})\)", text, re.I)
    ordinary = None
    for match in re.finditer(r"(?:Journal\s+)?Impact\s+Factor\s*:\s*"
                             r"(\d+(?:\.\d+)?)\s*\((20\d{2})\)", text, re.I):
        if not re.search(r"5[-\s]year\s*$", text[max(0, match.start()-16):match.start()], re.I):
            ordinary = match
            break
    if ordinary and five and ordinary.group(2) == five.group(2):
        return int(ordinary.group(2)), float(ordinary.group(1)), float(five.group(1))

    # Wiley overview pages give the year BEFORE the metric's name.
    two_wiley = re.search(r"\b(20\d{2})\s+Impact\s+Factor\s*:\s*(\d+(?:\.\d+)?)", text, re.I)
    five_wiley = re.search(r"\b(20\d{2})\s+5[-\s]year\s+Impact\s+Factor\s*:\s*(\d+(?:\.\d+)?)", text, re.I)
    if two_wiley and five_wiley and two_wiley.group(1) == five_wiley.group(1):
        return int(two_wiley.group(1)), float(two_wiley.group(2)), float(five_wiley.group(2))
    raise ValueError("Both dated 2-year and 5-year JIFs were not found")


def robots_allowed(url):
    parts = urlparse(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        raise ValueError("Unapproved source URL: " + url)
    if parts.hostname not in ROBOTS:
        robots_url = f"https://{parts.hostname}/robots.txt"
        try:
            with request.urlopen(request.Request(robots_url, headers={"User-Agent": AGENT}),
                                 timeout=12) as response:
                rules = response.read(1024 * 1024).decode("utf-8", "replace")
            parser = robotparser.RobotFileParser()
            parser.parse(rules.splitlines())
            ROBOTS[parts.hostname] = parser
        except error.HTTPError as exc:
            if exc.code == 404:
                ROBOTS[parts.hostname] = None
            else:
                raise RuntimeError(f"robots.txt access blocked ({exc.code})") from exc
        except Exception as exc:
            raise RuntimeError("robots.txt could not be checked") from exc
    parser = ROBOTS[parts.hostname]
    if parser is not None and not parser.can_fetch(AGENT, url):
        raise RuntimeError("robots.txt disallows automated retrieval")


def fetch_page(url):
    robots_allowed(url)
    with request.urlopen(request.Request(url, headers={
        "User-Agent": AGENT, "Accept": "text/html",
    }), timeout=15) as response:
        if urlparse(response.geturl()).hostname not in ALLOWED_HOSTS:
            raise RuntimeError("Publisher redirected outside allowed hosts")
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        html_bytes = response.read(2_000_001)
        if len(html_bytes) > 2_000_000:
            raise RuntimeError("Publisher page exceeds 2 MB")
        return html_bytes.decode("utf-8", "replace")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--write", action="store_true", help="Save only verified source updates")
    p.add_argument("--offline-check", action="store_true", help="Validate existing snapshot without networking")
    args = p.parse_args()
    original = CATALOG.read_text(encoding="utf-8")
    data = json.loads(original)
    assert data["schema_version"] == 1
    results = []
    all_titles = set()
    for col in data["collections"]:
        for row in col["rows"]:
            key = re.sub(r"[^a-z0-9]+", "", row[0].lower())
            if key in all_titles:
                raise ValueError("Duplicate journal title: " + row[0])
            all_titles.add(key)
            if len(row) < 3 or not all(isinstance(x, (int, float)) and 0 < x < 1000 for x in row[1:3]):
                raise ValueError("Invalid benchmark values: " + str(row))
    if args.offline_check:
        print(f"VALID: {len(all_titles)} distinct journals across {len(data['collections'])} publishers")
        return

    for col in data["collections"]:
        if col["type"] == "official_publisher_table":
            try:
                document = fetch_page(col["source"])
                year, rows = parse_apa(document)
                if year < int(col["metric_year"]):
                    raise ValueError("Publisher's current data are older than the catalog")
                if year > int(col["metric_year"]):
                    if len(rows) < int(len(col["rows"]) * 0.9):
                        raise ValueError("Potential major coverage loss; review manually")
                    col["rows"] = rows
                    col["metric_year"] = year
                    col["checked_date"] = date.today().isoformat()
                    results.append(f"UPDATED {col['publisher']}: {len(rows)} titles ({year})")
                else:
                    results.append(f"UNCHANGED {col['publisher']}: {len(rows)} titles ({year})")
            except Exception as exc:
                results.append(f"SKIPPED {col['publisher']}: {exc}")
        elif col["type"] == "verified_publisher_pages":
            updates = 0
            for row in col["rows"]:
                if len(row) < 5:
                    results.append(f"SKIPPED malformed entry: {row[0]}")
                    continue
                try:
                    document = fetch_page(row[3])
                    year, two, five = parse_journal_metrics(document)
                    if year >= int(row[4]) and (year, two, five) != (row[4], row[1], row[2]):
                        row[1:3] = [two, five]
                        row[4] = year
                        if len(row) > 5:
                            row[5] = date.today().isoformat()
                        else:
                            row.append(date.today().isoformat())
                        updates += 1
                except Exception as exc:
                    results.append(f"SKIPPED {row[0]}: {exc}")
                time.sleep(1.0)
            if updates:
                col["checked_date"] = date.today().isoformat()
            results.append(f"{col['publisher']}: {updates} verified journal updates")
    data["metric_year"] = max(int(c["metric_year"]) for c in data["collections"])
    if args.write:
        latest = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        if latest != original:
            CATALOG.write_text(latest, encoding="utf-8")
            print("WROTE validated publisher metrics snapshot")
        else:
            print("NO VERIFIED DATA CHANGES")
    print("\n".join(results))


if __name__ == "__main__":
    main()
