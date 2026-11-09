# ERN Institute website and Meta-Analysis Studio

This package contains the complete static ERN Institute website and ERN Meta-Analysis Studio Version 1.0.

## Permanent URLs

- Research Tools hub: `https://erninstitute.com/tools/`
- Meta-Analysis Studio: `https://erninstitute.com/tools/meta-analysis-studio/`
- Studio methods, validation and citation: `https://erninstitute.com/tools/meta-analysis-studio/methods.html`
- Citation Metrics: `https://erninstitute.com/metrics.html`
- Open Data Repository: `https://erninstitute.com/repository.html`
- Legacy `/tools.html` redirects to the permanent Meta-Analysis Studio URL.

## Version 1.0 release — September 14, 2026

This revision was prepared before external methodological review. It focuses on statistical consistency, transparent safeguards, and a simpler default interface.

### Statistical changes

- Random-effects I² and H² are derived from the selected tau-squared estimator and a typical within-study variance, while Cochran's Q remains a separate descriptive heterogeneity statistic.
- A zero tau-squared estimate is identified as a boundary estimate. Dynamic explanatory text makes clear that a zero point estimate does not establish identical true effects.
- Automatic inference uses Knapp-Hartung when a random-effects model has more than two effects and the estimated tau-squared is positive. Otherwise it uses Wald inference.
- Prediction intervals use the same critical-value framework as the fitted model: t(k-1) with Knapp-Hartung and normal critical values with Wald.
- Forest-plot square area, rather than square side length, represents model weight or precision.
- Hedges g uses the exact gamma-function bias correction and the large-sample sampling-variance convention aligned with the default metafor SMD calculation.
- Binary studies with no comparative information, such as zero events in both groups, are retained in the audit trail but excluded from odds-ratio pooling.
- A 0.5 continuity correction is still disclosed when a binary study has a single zero cell and remains informative.
- Generic inverse-variance input is supported for researchers who already have an analysis-scale effect estimate and sampling variance or standard error.

### Safeguards

- Pooled analysis is blocked while any input row has a validation error. Invalid rows are never silently omitted from a model.
- Repeated study labels, duplicate effect IDs, and missing study IDs trigger dependency review before inverse-variance pooling.
- Changing model settings invalidates previously fitted models so stale results cannot be carried into the publication workbook.
- Duplicate normalized CSV headers are rejected.
- Invalid `reverse_sign` values are rejected instead of being silently interpreted.
- Analysis-scale labels are explicit for log ratios and Fisher z.

### Interface simplification

The default workflow now keeps secondary information out of the way:

1. **Load study results.** Upload an ERN data file or use the built-in example.
2. **Review prepared data.** The calculated-effect table and unpooled forest plots are collapsed by default. The review panel opens automatically only when validation errors require action.
3. **Configure and run the model.** Random-effects is the default, with advanced statistical settings kept in a collapsed panel.
4. **Review the result.** The main view shows the pooled estimate, confidence interval, number of effects, heterogeneity summary, and pooled forest plot. Full statistical details, reporting text, study weights, and secondary downloads remain available on demand.

The publication workbook retains the complete audit trail even when details are collapsed on the webpage.

## Supported inputs

### Raw-data conversion pathways

- Independent means: means, SDs, and group sizes to Hedges g
- Independent Student t plus group sizes to Hedges g
- Simple two-group F(1, df2), group sizes, and direction to Hedges g
- Pearson r plus n to Fisher z
- Binary events and totals to log odds ratio

### Generic inverse variance

Use `calculation_type=generic` with:

- `effect_metric`
- `effect_size`
- either `sampling_variance` or `standard_error`

Known transformed metrics such as Log odds ratio, Log risk ratio, Log hazard ratio, and Fisher z are automatically back-transformed for natural-scale summaries. Ratio measures must be supplied on the log scale because the generic inverse-variance workflow uses a zero null on the analysis scale.

## Current model options

- Random-effects model, default
- Common-effect fixed-effect model
- REML tau-squared estimator, default
- Paule-Mandel sensitivity alternative
- DerSimonian-Laird legacy and reproducibility option
- Automatic, Wald, or Knapp-Hartung inference
- 90%, 95%, or 99% confidence intervals
- Automatic, requested, or disabled prediction intervals
- Optional common-effect sensitivity comparison

## Exports

The publication workbook includes:

- original input
- validation report
- calculated effect sizes
- calculation audit
- forest plots
- fitted meta-analysis models
- study weights
- dynamic methods and results text
- data dictionary

Model CSV and pooled SVG downloads remain available under **More downloads** in the result view.

## Validation tests

Run from the site root:

```bash
node tests/meta-analysis-engine.test.js
node tests/effect-size-converter.test.js
node tests/repository-datasets.test.js
node tests/metafor-published-example.test.js
node tests/export-integrity.test.js
node tests/social-preview.test.js
python tests/statistical-crosscheck.py
python tests/site-smoke.py
```

The test suite covers model estimators, boundary tau-squared behavior, prediction intervals, automatic inference, estimator-consistent heterogeneity summaries, Hedges g variance calculations, generic inverse-variance inputs, zero-cell binary handling, CSV validation, direction validation, internal page links, and the share-preview asset.

On November 4, 2026, 10 curated CSV datasets (256 effect-size records) passed conversion checks and 11 metric-specific model regressions. An independently implemented NumPy/SciPy comparison passed 28 common- and random-effects configurations with maximum absolute numerical difference below 0.000001. The published-`metafor` regression suite compares selected Studio outputs against the R output printed in the official `metadat` documentation for Michael (2013), Bangert-Drowns (2004), and Bourassa (1996). The latter single-level model is a numerical reference only; it does not account for clustered effects. These are test-case comparisons rather than a comprehensive formal audit. Direct interoperability with a running R/`metafor` installation remains untested; do not describe the Studio as comprehensively `metafor`-validated.

## Pre-announcement improvements — November 4, 2026

- Users can load any of the 10 curated real datasets directly from Step 1 without manually downloading a CSV. Repository cards link back to a preselected example. Loading never automatically initiates a pooled model.
- The curated Bourassa (1996) file contains 54 effects from 47 studies, and Bangert-Drowns (2004) has 48 effects under 45 distinct study IDs. All rows remain available for Step 2 review and export, but single-level pooled models are disabled for these curated selections because repeated effects require a dependency-aware model. Their separate core-engine regression tests are arithmetic checks against published `metafor` output, not permission to interpret the single-level pooled estimates scientifically.
- A separate methods, reproducibility, limitations and software citation page is linked from the Studio.
- Studio social link previews include an ERN-branded 1200×630 image.
- The Tools menu disclosure indicator is larger, and small numeric values in forest-plot labels use ordinary decimal notation.
- Optional usage events record broad interactions (opening examples, starting analyses and clicking exports), without attaching effect sizes, participant data, entered values, study identifiers or filenames to custom event payloads. The existing Google Analytics configuration still applies to site visits, and the Methods page now explains this distinction.
- The Methods page provides a fully worked and reproducible brain-image persuasiveness example with 12 independent-study effects, published R reference values, and the exact settings needed to compare outputs. The calculator and model CSV/SVG downloads retain generated object URLs for 60 seconds so browsers have more time to initiate saves; separate CSV and XLSX integrity tests cover serialization and archive structure, but are not substitutes for native browser download verification.
- The source-controlled regression tests are expanded to cover curated repository examples and an independent numerical implementation.

The public datasets and their provenance remain at `repository.html`. Their open-source licensing and attribution requirements are unchanged.

## Current limits

The raw-data conversion pathways do not directly support paired, repeated-measures, cluster-randomized, multilevel, adjusted-model, omnibus-F, or survival-statistic extraction. Researchers who have already calculated an appropriate effect estimate and sampling variance for such designs can use the generic inverse-variance pathway when the resulting effects can legitimately be treated as independent.

Dependency-aware meta-analysis, moderator analysis, and publication-bias diagnostics are outside the current Version 1.0 scope.


## Citation metrics: journal Impact Factor fallback (November 8, 2026)

The Citation Metrics page uses OpenAlex for DOI and article-level annual counts. A journal's Impact Factor is a **separate annual benchmark**, not an OpenAlex citation count. When available, the page tries `/api/journal-impact-factor?source=...` as a server-side publisher lookup. **This endpoint requires Cloudflare Pages Functions or equivalent server support and will not run on static GitHub Pages.** Do not assume the function is live just because the repository contains a `functions/` directory.

The client also reads `/journal-impact-factors.json`, a small conservative registry of source-verified JIF values keyed by OpenAlex journal ID. This works with static hosting and is checked before the server lookup finishes. On November 8, 2026, the registry includes *Cognition* (OpenAlex `S88198767`, ISSN-L `0010-0277`), with the 2025 JIF of **3.1** displayed on Elsevier's journal page and independently cross-checked against 2025 JCR listings. The regression case `10.1016/j.cognition.2017.02.010` computes **8.40 / 3.1 = 2.71** for the benchmark comparison using the cited screen-captured 2021–2025 citation counts.

The cache is intentionally **not** a universal JIF catalogue. Unknown or unreliable journal metrics remain N/A; they must not silently substitute CiteScore or OpenAlex two-year mean citedness. Every cached entry requires a journal ID, exact title, ISSN, source URL, JIF reporting year, value, corroboration, and verification date. JIF updates must be explicitly audited and updated as annual reports change. Publisher extraction can be blocked by robots/access controls; do not work around publisher access restrictions. Before claiming live operation, verify the current deployed `metrics.html`, `citation-metrics.js`, and `journal-impact-factors.json` in a browser.



## Citation calculator usability revision — November 8, 2026

- **First action:** enter a DOI and click **Get citation metrics**. OpenAlex supplies title, dates, annual citation history, and matched-cutoff lifetime counts. A verified journal JIF is added when one is available.
- **Only other visible input:** optional numeric **2-year Journal Impact Factor** field, populated automatically for supported journals. If a publisher value is missing, researchers can type just the number without entering a journal name, year, source, or choosing a benchmark type. The comparison recalculates immediately. Manually overridden values lose automatically attributed publisher provenance and are marked as having an unconfirmed year unless the researcher supplies more details.
- Secondary controls are behind **More options**, containing separate disclosures for manual citation counts (e.g., Google Scholar, Web of Science, ResearchGate), publication dates/window, benchmark metadata, and reporting details. The original three metric titles and formulas remain unchanged; the manuscript and Excel workbook are not revised.
- Result cards have direct functional descriptions. For example, **0.79** means the paper's recent annual citation rate is approximately **21% below** its lifetime average, not proof of a downward year-by-year trend. A benchmark ratio of **2.71** means the recent article rate is **2.71 times** the named benchmark. Methodological context remains in the extended page material rather than dominating the cards. Copyable reporting text uses the same interpretation.
- The built-in example remains explicitly illustrative, never an invented real journal IF. Automatic publisher and source-verified JIF retrieval safeguards, matched citation cutoffs, and comparative CSV data stay intact.
- Relevant changes: `metrics.html`, `citation-metrics.js`, `styles.css`, `tests/citation-metrics.test.js` on `main`, latest implementation commit `f73e4f4122319e57b4df9b55e40b38e01faa2d94`. Cache-busted page references to `citation-metrics.js?v=20261108simple` and `styles.css?v=20261108simple`.
- **Verification:** all 21 `tests/citation-metrics.test.js` cases passed in an executable V8 test harness with Node's assertion interface emulated, including DOI arithmetic, the Cognition regression and simpler user interface. HTML checks found one benchmark-rate input, balanced nested disclosures, and unique IDs. A separate real Node test-runner execution and live deployment/browser rendering have **not** been independently verified this session.


## Citation Metrics recent-window default — November 8, 2026

- **New default:** `Citations Per Year (Now)` uses the **two most recent completed calendar years** from OpenAlex, e.g., 2024–2025 when used in 2026. The browser starts with `recentYears=2`, and **Clear form** restores that two-year default.
- The one-click DOI lookup takes its window length from the form; researchers may select another window inside **More options**, and the selected exact years appear in the results. The interactive **Try an example** now also uses a two-year window (10 recent citations / 2 years), yielding the same illustrative 5.00 annual rate, 0.50 lifetime ratio, and 1.67 benchmark ratio. The separate Excel-manuscript numerical example remains unchanged.
- **Methodological distinction:** A two-year JIF summarizes citations in a designated year to a journal's papers published in the previous two years. A single paper's recent two-year citation rate measures citations it received across the two most recently completed years. Using the same numeral for the window length simplifies the experience but **does not make the two measures temporally or conceptually identical**.
- Updated `metrics.html`, `citation-metrics.js`, and `tests/citation-metrics.test.js`, including cache-busted script reference `citation-metrics.js?v=20261108two`. The original three metric names, formulas, manual alternatives, and source reporting are preserved.
- Verification: 22 citation-metrics regression tests passed in the V8 Node-style assertion harness, and the HTML disclosures/IDs remained valid. Public site deployment has **not** been independently confirmed in this session.


## Two- and five-year publisher JIF support (November 8, 2026)

- The core metric names are unchanged from Grundy & Grundy's unpublished manuscript. **Citations Per Year (Now vs. Benchmark)** intentionally compares a paper's recent citations/year with an external annual benchmark such as either the **2-year or 5-year Journal Impact Factor**. This is a meaningful contextual ratio with distinct source definitions; it does not assert identical underlying observation windows.
- The quick-start citation calculator now has one compact **2-year / 5-year** benchmark selector beside the single numeric Journal Impact Factor field. The default remains the **2-year** benchmark. Switching between them **clears the previous benchmark and publisher attribution**, then looks up the correct value for the active DOI. Switching does **not** silently change the paper's recent citation window, which remains two completed calendar years by default and can be changed under More options.
- Added verified static-host records to `journal-impact-factors.json`, matched on OpenAlex journal ID, normalized journal name and ISSN-L:
  - `S24095051`, *Bilingualism: Language and Cognition* (Cambridge; ISSN-L `1366-7289`): **2025 2-year JIF 2.4**, **5-year JIF 3.7** (the consulted Cambridge metrics page does not explicitly date the 5-year figure, so that reporting year is marked unconfirmed). Publisher sources: `https://www.cambridge.org/core/journals/bilingualism-language-and-cognition` and `https://www.cambridge.org/core/journals/bilingualism-language-and-cognition/information/about-this-journal/journal-metrics`.
  - `S18666220`, *Journal of Experimental Psychology: Learning, Memory, and Cognition* (American Psychological Association; ISSN-L `0278-7393`): **2025 2-year JIF 2.3**, **2025 5-year JIF 2.8**. Publisher source: `https://www.apa.org/pubs/journals/resources/impact-factors`.
  - Existing *Cognition* entry retains **2025 2-year JIF 3.1**. Its five-year JIF has not been verified; selecting 5-year correctly yields no automatic figure instead of reusing 3.1.
- Improved journal-title matching so punctuation variants in OpenAlex titles (e.g., Cambridge BLC without a colon, APA JEP LMC without punctuation) do not cause false negatives; matching still requires the known source ID and, when present, matching ISSN-L.
- The Cloudflare-style publisher endpoint still supports only two-year extraction and remains unverified on the live static hosting; **five-year values come from the source-checked static registry only**. This is a focused correction for these known journals, not a comprehensive global JIF feed. Unknown journals retain manual IF entry.
- The cache asset has a new version (`journal-impact-factors.json?v=20261108factors`), and `metrics.html` now requests `citation-metrics.js?v=20261108jif5`. No manuscript edits were made.
- All **26 citation calculator regression cases** passed in the V8 Node-style assertion harness. The actual production browser's latest asset update, live registry fetch and external web runtime have **not** been independently verified.


## Annual publisher batch and SCImago fallback (November 8, 2026)

### Journal benchmark selection

For a DOI lookup, the calculator prioritizes an officially publisher-reported **2-year or 5-year Journal Impact Factor**. Data are matched by journal identity (OpenAlex ID/ISSN for curated records, or exact normalized name for the publisher snapshot), and labeled with the reporting year and publisher source. Static hosting is supported; a publisher-scraping server endpoint is not required for snapshots.

If **the 2-year JIF is unavailable**, the calculator also supports an annual **SCImago Cites per Doc. (2 years)** snapshot as a Scopus-based, explicitly labeled alternative. This is *not* SCImago Journal Rank (SJR), CiteScore, or an official Clarivate Journal Impact Factor. It uses the unweighted SCImago two-year citations/document column and is not silently relabeled JIF. The five-year JIF selection has **no automatic SCImago equivalent**, because SCImago publishes 2-, 3- and 4-year citations/document measures, not five-year citations/document. The SCImago fallback therefore applies **only when the 2-year window is selected**. The original manuscript metric formula remains recent citations per year / named external annual benchmark.

### Annual ingestion and honest coverage

- `journal-impact-factors-batch.json`: first publisher-sourced 2025 snapshot with **88 records** (APA 80, Springer Nature/Nature Portfolio 7, Wiley 1). The included rows retain publisher source links and per-publisher/per-journal reporting years. This is a partial public-source batch, *not* a complete JCR list.
- `scripts/refresh_publisher_jifs.py`: checks directly available public publisher metric tables and selected publisher journal pages with allowlisted HTTPS hosts, robots checks, date-specific extraction and fail-safe validation. `.github/workflows/annual-publisher-jif-refresh.yml` schedules an annual check each November; failures leave previous verified records untouched.
- `scripts/import_scimago.py`: parses the official semicolon-delimited annual SCImago journal-ranking CSV from the site’s **Download** control. It extracts Sourceid, Title, ISSNs and **Citations / Doc. (2years)** (handling European comma decimals), validates a minimum of 20,000 journal records, checks duplicates/ranges/year, and writes `scimago-cites-per-doc.json` only when a complete, validated source is available. No SJR or CiteScore values are used. `.github/workflows/annual-scimago-snapshot.yml` attempts the official CSV import annually and on relevant workflow/script changes. **Automated downloads can be blocked**; if the official download fails, the prior snapshot is retained and no substitute data are fabricated.
- `citation-metrics.js`: automatically uses the 2-year SCImago fallback only if both verified publisher snapshot sources lack a value. It matches a unique exact normalized journal title and available ISSN, and includes the SCImago source profile URL and metric/reporting year in the calculated report. It does not accept tiny partial lists as a substitute for the full annual snapshot. The public interface changes its benchmark label to **SCImago Cites per Doc. (2 years)** when used, so it is never presented as a JIF.
- Source and citation: `https://www.scimagojr.com/journalrank.php`; SCImago Journal & Country Rank (SCImago), retrieved on the indicated date. SCImago’s FAQ allows reuse with citation to its site. Check the publisher’s and SCImago's current terms annually.
- **Current status (2026-11-08):** the code, scheduled workflows, and importer were committed, but an official 2025 SCImago CSV could **not** be fetched in this session due to direct access restrictions; `scimago-cites-per-doc.json` does not yet exist in the repository. Therefore the broad fallback is implemented and testable but **not yet populated in production**. The existing 88 publisher records and three-journal verified cache remain functional as source data. Do not claim 32,000 journals are installed or that the annual workflow has completed until the generated file is verified.
- Thirty citation calculator regression tests passed in an executable V8 Node-style assertion harness, including sample SCImago matching, source labeling, official-JIF priority, and safeguarding against tiny partial catalogues. Python import tests and a live GitHub Actions run were committed but **not independently executed/verified** during this session.
