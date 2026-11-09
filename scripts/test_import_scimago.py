"""Offline tests for the official annual SCImago CSV importer."""
import importlib.util
import io
from pathlib import Path
import hashlib
from unittest.mock import patch
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "import_scimago",
    Path(__file__).parent / "import_scimago.py"
)
scimago = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scimago)


def fake_csv(count):
    header = ('Rank;Sourceid;Title;Type;Issn;Publisher;SJR;'
              'Citations / Doc. (2years)\n')
    rows = [
        f'{i + 1};{1000000000 + i};"Journal {i}";journal;'
        f'"1234567X, 9876543X";"Test Publisher";1,111;{i % 10 + 1},25\n'
        for i in range(count)
    ]
    return header + ''.join(rows)


class ScimagoImportTests(unittest.TestCase):
    def test_header_and_decimal_format(self):
        d = scimago.parse_rankings(fake_csv(20001), 2025)
        self.assertEqual(len(d['records']), 20001)
        self.assertEqual(d['metric_year'], 2025)
        self.assertEqual(d['indicator'], 'SCImago Cites per Doc. (2 years)')
        self.assertEqual(d['records'][0][3], 1.25)
        self.assertEqual(d['records'][0][2], ['1234567X', '9876543X'])

    def test_reject_truncated_or_wrong_csv(self):
        with self.assertRaisesRegex(ValueError, 'truncated'):
            scimago.parse_rankings(fake_csv(10), 2025)
        with self.assertRaisesRegex(ValueError, 'missing'):
            scimago.parse_rankings('Title;Metric\nTest;3\n', 2025)

    def test_source_year_and_duplicates_are_validated(self):
        with self.assertRaisesRegex(ValueError, 'Invalid ranking year'):
            scimago.parse_rankings(fake_csv(20001), 2099)
        duplicate = fake_csv(20001) + (
            '99999;1000000000;"Wrong duplicate title";journal;'
            '"1234567X";"Test Publisher";1,222;6,66\n'
        )
        with self.assertRaisesRegex(ValueError, 'Conflicting SCImago'):
            scimago.parse_rankings(duplicate, 2025)

    def test_protect_newer_snapshot(self):
        d = scimago.parse_rankings(fake_csv(20001), 2025)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'scimago.json'
            scimago.write_snapshot(d, output)
            from json import loads
            self.assertEqual(loads(output.read_text())['metric_year'], 2025)
            older = dict(d)
            older['metric_year'] = 2024
            with self.assertRaisesRegex(ValueError, 'newer'):
                scimago.write_snapshot(older, output)


    def test_cross_verified_github_mirrors_accept_two_identical_files(self):
        payload = (b"Total Docs. (2025);Rank\n" + b"A" * 3_000_000)

        class Response:
            def __init__(self, url):
                self.url = url
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def geturl(self):
                return self.url
            def read(self, size):
                return payload[:size]

        def fake_opener(req, timeout):
            return Response(req.full_url)

        git_sha = hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()
        with patch.object(scimago, "EXPECTED_2025_GIT_SHA", git_sha):
            text, meta = scimago.download_verified_mirrors(2025, fake_opener)
        self.assertEqual(text.encode(), payload)
        self.assertEqual(meta["method"], "cross_verified_github_mirrors")
        self.assertGreaterEqual(len(meta["mirrors"]), 2)
        self.assertEqual(meta["sha256"], hashlib.sha256(payload).hexdigest())

    def test_cross_verified_github_mirrors_reject_disagreeing_files(self):
        payload = b"Total Docs. (2026);Rank\n" + b"A" * 3_000_000
        copies = iter(range(4))

        class Response:
            def __init__(self, url, number):
                self.url, self.number = url, number
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def geturl(self):
                return self.url
            def read(self, size):
                return payload + bytes([self.number])

        def fake_opener(req, timeout):
            return Response(req.full_url, next(copies))

        with self.assertRaisesRegex(RuntimeError, "two independent identical"):
            scimago.download_verified_mirrors(2026, fake_opener)


if __name__ == '__main__':
    unittest.main()
