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
