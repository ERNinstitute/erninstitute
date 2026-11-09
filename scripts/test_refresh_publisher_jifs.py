"""Offline regression checks for annual publisher-metrics refresh logic."""

import unittest

from refresh_publisher_jifs import parse_apa, parse_journal_metrics, text_only


class AnnualPublisherMetricsTests(unittest.TestCase):
    def test_apa_official_table_identifies_both_metrics_and_year(self):
        header = "<tr><th>Journal Title</th><th>2025 JIF</th><th>2025 5-Year JIF</th><th>Category</th></tr>"
        rows = "".join(
            f"<tr><td><a href='/journal/{i}'>Journal {i}</a></td>"
            f"<td>{i % 10 + 0.5}</td><td>{i % 13 + 0.7}</td><td>Psychology</td></tr>"
            for i in range(80)
        )
        year, found = parse_apa(f"<html><table>{header}{rows}</table></html>")
        self.assertEqual(year, 2025)
        self.assertEqual(len(found), 80)
        self.assertEqual(found[0], ["Journal 0", 0.5, 0.7])

    def test_bad_or_incomplete_apa_does_not_replace_previous_catalog(self):
        fragment = "<table><tr><th>Journal Title</th><th>2025 JIF</th><th>2025 5-Year JIF</th></tr>"
        fragment += "<tr><td>Only Journal</td><td>2.1</td><td>3.2</td></tr></table>"
        with self.assertRaisesRegex(ValueError, "too small"):
            parse_apa(fragment)
        with self.assertRaisesRegex(ValueError, "not found"):
            parse_apa("<table><tr><th>Journal</th><th>Impact</th></tr></table>")

    def test_nature_page_keeps_2_and_5_year_factors_distinct(self):
        page = """<html><title>Nature Methods | Journal metrics</title>
            <h2>Citation Impact</h2>
            <li>Journal Impact Factor: 28.2 (2025)</li>
            <li>5-year Journal Impact Factor: 52.4 (2025)</li>
            <li>Immediacy Index: 5.5 (2025)</li>
            </html>"""
        self.assertEqual(parse_journal_metrics(page), (2025, 28.2, 52.4))

    def test_wiley_overview_has_year_before_both_factors(self):
        page = """<html><h2>Journal overview</h2>
        <p>2025 Impact Factor: 4.1*</p>
        <p>2025 5-year Impact Factor: 4.1*</p>
        </html>"""
        self.assertEqual(parse_journal_metrics(page), (2025, 4.1, 4.1))

    def test_missing_five_year_factor_rejected(self):
        page = "<p>Journal Impact Factor: 2.3 (2025)</p>"
        with self.assertRaisesRegex(ValueError, "Both dated"):
            parse_journal_metrics(page)

    def test_script_tags_not_mistaken_for_visible_journal_metrics(self):
        page = """<script>Journal Impact Factor: 88.8 (2025)</script>
        <p>Journal Impact Factor: 2.4 (2025)</p>
        <p>5-year Journal Impact Factor: 3.7 (2025)</p>"""
        self.assertNotIn("88.8", text_only(page))
        self.assertEqual(parse_journal_metrics(page), (2025, 2.4, 3.7))


if __name__ == "__main__":
    unittest.main()
