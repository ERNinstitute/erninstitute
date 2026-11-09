#!/usr/bin/env python3
"""Build a strictly sourced SCImago 2-year citations-per-document fallback.

Read the annual CSV distributed through SCImago's own Journal Rankings Download
control. No journal values are inferred from SJR, CiteScore, or OpenAlex.

Usage:
  python3 scripts/import_scimago.py --input "scimagojr 2025.csv" --year 2025
  python3 scripts/import_scimago.py --download --year 2025

Prefer SCImago's official CSV export; if blocked, use two independent GitHub
copies only when their full 2025 CSV bytes match. Preserve previous verified data.
"""
import argparse
import csv
import hashlib
from datetime import date
import io
import json
from pathlib import Path
import re
import sys
from urllib import request
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "scimago-cites-per-doc.json"
OFFICIAL = "https://www.scimagojr.com/journalrank.php?year={year}&type=all&out=xls"
MIN_JOURNALS = 20000
CITE_LIMIT = 1000
MIRROR_URLS = (
    "https://raw.githubusercontent.com/bastianaravenaulagos/DATOS_SCIMAGO_REVISTAS/main/scimagojr%20{year}.csv",
    "https://raw.githubusercontent.com/P-M-Ferreira/ranking/main/scimagojr%20{year}.csv",
    "https://raw.githubusercontent.com/barais/hal-irisa-scripts/main/data/scimagojr_{year}.csv",
    "https://raw.githubusercontent.com/flonat/flonat-research/main/.context/resources/venue-rankings/scimagojr-{year}.csv",
)
# Confirmed identical by Git SHA across four independently hosted 2025 CSV files.
EXPECTED_2025_GIT_SHA = "6a4e1ea4868698dedf7aabb11c8bb87bedc65ac0"


def normalized_issns(raw):
    parts = re.split(r"[,;]", str(raw or ""))
    valid = []
    for p in parts:
        v = re.sub(r"[^0-9Xx]", "", p).upper()
        if len(v) == 8 and v not in valid:
            valid.append(v)
    return valid


def parse_decimal(raw):
    text = str(raw or "").strip().replace(" ", "")
    if not text or text == "-":
        return None
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    try:
        value = float(text)
    except ValueError:
        return None
    if value < 0 or value > CITE_LIMIT or not (value < float("inf")):
        return None
    return round(value, 4)


def parse_rankings(csv_source, year):
    """Return a compact catalogue (source ID, name, ISSNs, 2-year rate)."""
    if not 1999 <= year <= date.today().year:
        raise ValueError("Invalid ranking year")
    src = io.StringIO(csv_source.lstrip("\ufeff"))
    reader = csv.DictReader(src, delimiter=";", quotechar='"')
    fields = reader.fieldnames or []
    needed = {"Sourceid", "Title", "Type", "Issn", "Citations / Doc. (2years)"}
    if not needed.issubset(fields):
        raise ValueError(f"Not an official SCImago ranking CSV; missing {sorted(needed - set(fields))}")
    by_source = {}
    for raw in reader:
        if (raw.get("Type") or "").strip().lower() != "journal":
            continue
        source_id = (raw.get("Sourceid") or "").strip()
        title = " ".join((raw.get("Title") or "").split())
        issns = normalized_issns(raw.get("Issn"))
        cites = parse_decimal(raw.get("Citations / Doc. (2years)"))
        if not re.fullmatch(r"\d{4,15}", source_id) or not title or not issns or cites is None:
            continue
        record = [source_id, title, issns, cites]
        if source_id in by_source and by_source[source_id] != record:
            raise ValueError(f"Conflicting SCImago source ID {source_id}")
        by_source[source_id] = record
    if len(by_source) < MIN_JOURNALS:
        raise ValueError(f"SCImago catalogue looks truncated: {len(by_source)} eligible journals")
    rows = sorted(by_source.values(), key=lambda x: x[0])
    return {
        "schema_version": 1,
        "indicator": "SCImago Cites per Doc. (2 years)",
        "metric_year": year,
        "retrieved_date": date.today().isoformat(),
        "source": "https://www.scimagojr.com/journalrank.php",
        "source_data_url": OFFICIAL.format(year=year),
        "citation": "SCImago (n.d.). SJR — SCImago Journal & Country Rank. Retrieved from https://www.scimagojr.com/",
        "records": rows
    }


def download_csv(year):
    url = OFFICIAL.format(year=year)
    if urlparse(url).hostname != "www.scimagojr.com":
        raise ValueError("Unexpected download domain")
    req = request.Request(url, headers={
        "User-Agent": "ERNInstituteMetrics/1.0 (https://erninstitute.com/metrics.html)",
        "Accept": "text/csv,application/octet-stream,*/*"
    })
    with request.urlopen(req, timeout=40) as response:
        if urlparse(response.geturl()).hostname != "www.scimagojr.com":
            raise ValueError("SCImago export redirected to untrusted domain")
        if response.status != 200:
            raise ValueError(f"SCImago export HTTP {response.status}")
        raw = response.read(25_000_001)
    if len(raw) > 25_000_000:
        raise ValueError("SCImago file exceeded maximum 25 MB")
    return raw.decode("utf-8-sig", errors="replace")



def download_verified_mirrors(year, opener=None):
    """Use a mirror only when two repositories distribute identical CSV bytes."""
    open_url = opener or request.urlopen
    by_digest = {}
    errors = []
    for template in MIRROR_URLS:
        url = template.format(year=year)
        if urlparse(url).hostname != "raw.githubusercontent.com":
            raise ValueError("Unapproved mirror domain")
        try:
            req = request.Request(url, headers={
                "User-Agent": "ERNInstituteMetrics/1.0 (https://erninstitute.com/metrics.html)",
                "Accept": "text/csv,application/octet-stream,*/*"
            })
            with open_url(req, timeout=25) as response:
                if urlparse(response.geturl()).hostname != "raw.githubusercontent.com":
                    raise ValueError("Unapproved redirect")
                raw = response.read(25_000_001)
            if not 3_000_000 <= len(raw) <= 25_000_000:
                raise ValueError("Truncated or oversized CSV")
            digest = hashlib.sha256(raw).hexdigest()
            if year == 2025:
                git_sha = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
                if git_sha != EXPECTED_2025_GIT_SHA:
                    raise ValueError("Different from independently verified 2025 source CSV")
            by_digest.setdefault(digest, {"raw": raw, "urls": []})["urls"].append(url)
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    agreeing = sorted(by_digest.items(), key=lambda item: len(item[1]["urls"]), reverse=True)
    if not agreeing or len(agreeing[0][1]["urls"]) < 2:
        raise RuntimeError("Need two independent identical CSV mirrors. "
                           + "; ".join(errors[:2]))
    digest, entry = agreeing[0]
    text = entry["raw"].decode("utf-8-sig", "replace")
    if f"Total Docs. ({year})" not in text.split("\n", 1)[0]:
        raise ValueError("Wrong SCImago edition year")
    return text, {
        "method": "cross_verified_github_mirrors",
        "sha256": digest,
        "mirrors": entry["urls"],
        "official_download_blocked": True
    }


def write_snapshot(result, target=DESTINATION):
    if target.exists():
        old = json.loads(target.read_text(encoding="utf-8"))
        if int(old.get("metric_year") or 0) > result["metric_year"]:
            raise ValueError("Refusing to replace newer SCImago snapshot with older data")
        if old.get("metric_year") == result["metric_year"] and len(result["records"]) < len(old.get("records", [])) * .90:
            raise ValueError("Refusing unexpected loss of over 10% of journals in a same-year update")
    target.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser()
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path)
    source.add_argument("--download", action="store_true")
    p.add_argument("--year", type=int, default=date.today().year - 1)
    p.add_argument("--output", type=Path, default=DESTINATION)
    args = p.parse_args()
    verification = {"method": "supplied_official_csv"}
    if args.download:
        try:
            raw = download_csv(args.year)
            verification = {"method": "direct_official_scimago"}
        except Exception as exc:
            print(f"Official SCImago download unavailable: {exc}", file=sys.stderr)
            raw, verification = download_verified_mirrors(args.year)
    else:
        raw = args.input.read_text(encoding="utf-8-sig")
    snapshot = parse_rankings(raw, args.year)
    snapshot["source_verification"] = verification
    write_snapshot(snapshot, args.output)
    print(f"VERIFIED: {len(snapshot['records'])} SCImago journal records, "
          f"2-year cites/document, reporting year {args.year}. "
          f"Written to {args.output}")


if __name__ == "__main__":
    main()
