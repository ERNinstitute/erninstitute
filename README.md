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
python tests/statistical-crosscheck.py
python tests/site-smoke.py
```

The test suite covers model estimators, boundary tau-squared behavior, prediction intervals, automatic inference, estimator-consistent heterogeneity summaries, Hedges g variance calculations, generic inverse-variance inputs, zero-cell binary handling, CSV validation, direction validation, internal page links, and the share-preview asset.

On November 4, 2026, the six curated CSV datasets (90 effects in total) passed their conversion checks and seven metric-specific model smoke tests. An independently implemented NumPy/SciPy comparison passed 28 common- and random-effects configurations with maximum absolute numerical difference below 0.000001. A separate regression test checks the brain-image dataset against the worked R/`metafor` output printed in the official `metadat` documentation and agrees at the displayed precision. These are test-case comparisons rather than a comprehensive formal audit. Direct interoperability with a running R/`metafor` installation remains untested; do not describe the Studio as comprehensively `metafor`-validated.

## Pre-announcement improvements — November 4, 2026

- Users can load any of the six curated real datasets directly from Step 1 without manually downloading a CSV. Repository cards link back to a preselected example. Loading never automatically initiates a pooled model.
- A separate methods, reproducibility, limitations and software citation page is linked from the Studio.
- Studio social link previews include an ERN-branded 1200×630 image.
- The Tools menu disclosure indicator is larger, and small numeric values in forest-plot labels use ordinary decimal notation.
- Optional usage events record broad interactions (opening examples, starting analyses and clicking exports), without attaching effect sizes, participant data, entered values, study identifiers or filenames to custom event payloads. The existing Google Analytics configuration still applies to site visits.
- The source-controlled regression tests are expanded to cover curated repository examples and an independent numerical implementation.

The public datasets and their provenance remain at `repository.html`. Their open-source licensing and attribution requirements are unchanged.

## Current limits

The raw-data conversion pathways do not directly support paired, repeated-measures, cluster-randomized, multilevel, adjusted-model, omnibus-F, or survival-statistic extraction. Researchers who have already calculated an appropriate effect estimate and sampling variance for such designs can use the generic inverse-variance pathway when the resulting effects can legitimately be treated as independent.

Dependency-aware meta-analysis, moderator analysis, and publication-bias diagnostics are outside the current Version 1.0 scope.
