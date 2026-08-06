# ERN Institute website: Meta-Analysis Studio Version 1.0

This package contains the static ERN Institute website and the public Version 1.0 release of the browser-based ERN Meta-Analysis Studio at `tools.html`.

## Version 1.0 release: August 5, 2026

Version 1.0 organizes the application around the researcher’s actual workflow. The substantive meta-analysis appears immediately after data preparation, while calculated-effect tables, unpooled plots, and validation details remain available in one intelligent expandable review panel.

ERN Meta-Analysis Studio Version 1.0 was released publicly on August 5, 2026.

## Workflow preview update: August 5, 2026

- Added a four-stage visual workflow near the top of the Studio so users can understand the complete process before uploading data.
- The connected cards use the exact same titles as the corresponding Step 1–4 sections in the application.
- Separated automatic data preparation into its own Step 2 so calculated effect sizes, validation checks, and unpooled forest plots are clearly distinguished from the pooled meta-analysis.
- Added a prominent notice explaining that those Step 2 outputs are created immediately when the file loads, without a separate run command.
- The horizontal desktop flow becomes a vertical, arrow-connected sequence on smaller screens.
- Standardized the external spacing and alignment of the workflow, upload, prepared-data, analysis, and reference sections.

## Multi-metric results update: August 5, 2026

- After **Run all different effect-size metrics** is used, Step 4 now displays every eligible metric as a complete stacked result rather than showing one metric at a time.
- Every metric has its own simultaneously visible pooled estimate, forest plot, model details, study weights, reporting text, and metric-specific downloads.
- The publication workbook continues to include all completed metric-specific models.
- Linked the homepage JERN feature directly to the live journal site and removed the former **coming soon** label.
- Added the populated **Open Meta-Analysis Data Repository** under the responsive Tools menu, with five real open datasets, 78 analyzable effects, and coverage of Hedges *g*, Fisher *z*, and log odds ratios.
- Distinguished datasets **Curated from an open source** from future datasets **Submitted by authors**, while keeping them in one clear repository experience.
- Kept repository participation explicitly optional and separate from the Studio: analysis files remain in the browser and are shared only when a researcher deliberately opens and completes the no-registration submission form.
- Added ERN-ready CSV downloads, a provenance catalog, preparation notes, full license documentation, and links to every original dataset source.
- Added a real multi-metric asthma dataset that validates **Run all different effect-size metrics** by producing separate Hedges *g* and log-odds-ratio models.

## Settings-summary clarification: August 5, 2026

- Relabeled the changing summary as **Current settings** so it no longer implies that every user-selected configuration is recommended.
- Added a **Recommended defaults** indicator for the default model and advanced settings.
- The indicator changes to **Customized** whenever the user departs from those defaults and returns automatically when the recommended configuration is restored.

## Homepage editorial update: August 5, 2026

- Added the August 1 *Medical News Today* feature to **Latest from ERN**.
- Labeled the item as independent media coverage and linked directly to the original feature.
- Added a **Media coverage** link to the featured PNAS publication on the Research page.

## Upload feedback update: August 5, 2026

- Added an immediate success confirmation after a CSV, TSV, or text file is read.
- The upload area now shows the selected filename and a completed visual state.
- File size and local-processing details remain visible while calculation and validation messages appear separately below.
- Clarified that upload automatically validates rows, calculates effect sizes, and creates unpooled forest plots, while the pooled meta-analysis runs only after the researcher configures Step 3.
- Renamed **Run example data** to **Try built-in example** and styled it as an optional secondary action. After a user file is processed, it reads **Replace with built-in example**.
- Standardized every expandable panel on the same left-side triangle indicator, including Advanced settings and the prepared-data review.
- Relabeled the analysis actions as **Run selected metric** and **Run all different effect-size metrics**. Each metric still produces its own pooled estimate and different metrics are never combined.
- Moved the automatically prepared-data review directly below the file loader as Step 2 so it is visibly distinct from the pooled model output.
- Replaced ambiguous upload language with **Load study results** and **File loaded successfully**, explicitly confirming that analysis files are processed locally and are not sent to ERN.
- Clearing the workflow resets the upload area to its original state.
- Removed visible product-tier commentary from the analysis workflow.
- Added a clear open/close arrow to Advanced settings.
- Replaced ambiguous **runs locally** language with explicit statements that calculations run entirely in the browser and files are not uploaded to ERN Institute.
- Any future public-repository submission will remain a separate, optional action and will not change the private in-browser analysis workflow.

## Citation framework alignment: August 5, 2026

- Standardized the public metric names as **Citations Per Year (Now)**, **Citations Per Year (Now vs. Lifetime)**, and **Citations Per Year (Now vs. Benchmark)**.
- Updated the manuscript citation to the submitted title: *Transparent Metrics for Article-Level Impact Using Citations Per Year: Now, Now vs. Lifetime, and Now vs. Benchmark*.
- Added **Meta-Analysis Studio** to the primary navigation on every page and made it active on the Studio page.
- Consolidated **Citation Metrics** and **Meta-Analysis Studio** under a responsive **Tools** dropdown to reduce header crowding while keeping both tools equally prominent.
- Enlarged the left-side triangle indicators across expandable controls for clearer affordance and consistent alignment.
- Replaced the remaining visible free-tier labels with functional descriptions.

## Publication update: August 5, 2026

- Added the live DOI for *Experience-driven neural efficiency and reserve in aging: Evidence from bilingual attentional adaptation*: https://doi.org/10.1016/j.arr.2026.103282
- Updated the Research citation to 2026, Article 103282, and linked the homepage announcement directly to the article.

## Guided workflow

1. **Load study results.** Upload an ERN data file or use the built-in example.
2. **Review automatically prepared data.** Inspect the effect sizes, validation checks, and unpooled forest plots created when the file loaded.
3. **Configure and run the meta-analysis.** Choose the compatible effect-size metric and substantive model, then run using recommended defaults or explicit advanced settings.
4. **Review results and export.** Interpret the pooled estimate and forest plot, expand model details as needed, and download the publication workbook and model files.

The prepared-data review panel:

- collapses automatically when all loaded rows are valid;
- opens automatically when errors or warnings require attention;
- contains the calculated-effect table, validation report, and unpooled effect-size plots;
- remains available before and after model fitting without obstructing the primary workflow.

## Model choices and guided defaults

The interface now separates the substantive model from the random-effects variance estimator.

### Visible model choice

- **Random-effects (recommended for most applications)**
- **Common-effect (fixed-effect)**

### Advanced settings

- REML (recommended default)
- Paule–Mandel (sensitivity alternative)
- DerSimonian–Laird (explicitly labeled legacy / reproducibility)
- Recommended automatic inference
- Wald normal inference
- Knapp–Hartung inference
- 90%, 95%, and 99% confidence intervals
- Automatic, requested, or disabled prediction intervals
- Optional common-effect sensitivity analysis

Automatic inference uses Knapp–Hartung when a random-effects model contains more than two effects and the estimated between-study variance (tau-squared) is positive after applying a numerical zero tolerance. This is not a statistical significance test of heterogeneity. Otherwise, the Studio uses Wald inference. The decision and reason are stored in the workbook.

Automatic prediction intervals are shown at five or more effects. Researchers may request them with three or four effects through Advanced settings, with an explicit caution.

## Results presentation

The primary results view contains:

- pooled effect and confidence interval;
- number of effects;
- I-squared;
- prediction interval or a clear explanation of why it was not shown;
- pooled forest plot;
- expandable heterogeneity and model details;
- expandable common-effect sensitivity comparison;
- expandable suggested Methods and Results text;
- expandable study weights and model data.

## Publication workbook

The browser-generated XLSX contains:

1. README
2. Original Input
3. Validation Report
4. Calculated Effects
5. Calculation Audit
6. Forest Plots
7. Meta-Analysis Models
8. Study Weights
9. Data Dictionary

Version 1.0 records primary and sensitivity analyses separately. The model sheet includes the requested and applied inference methods, automatic-decision explanation, prediction-interval policy, and prediction-interval explanation.

## Effect-size preparation currently supported

- Independent-group means, SDs, and sample sizes → Hedges g
- Student independent-groups t and group sizes → Hedges g
- Eligible simple two-group F statistics → Hedges g
- Pearson r and n → Fisher z
- Binary events and totals → log odds ratio

For F conversion, `f_df1` must equal 1, `f_df2` must equal `n1 + n2 - 2`, and `f_direction` must be supplied because F has no sign. Omnibus, adjusted, repeated-measures, multilevel, and mixed-model F statistics are rejected.

## Templates

- Empty template: `downloads/effect-size-template.csv`
- Filled example: `downloads/effect-size-example.csv`
- Validation test: `downloads/effect-size-validation-test.csv`

## Version 1.0 release validation

- JavaScript syntax checks passed for all analysis and export modules.
- Dependency-free statistical engine tests passed, including automatic inference and prediction-interval rules.
- Browser interaction tests passed with no uncaught JavaScript exceptions.
- Clean data collapse the prepared-data review panel automatically.
- Warning-containing data open the review panel automatically.
- Random-effects REML with automatic inference selected Knapp–Hartung correctly for the example data.
- The common-effect sensitivity model was fitted and retained separately.
- The browser-generated publication workbook downloaded successfully.
- The XLSX was imported and inspected successfully with all nine worksheets, two clearly labeled model rows, populated study weights, embedded figures, and no detected formula errors.

To rerun the engine checks from the package root:

```bash
node tests/meta-analysis-engine.test.js
```

## Future development

Planned additions include moderator analysis and dependency-aware methods:

- categorical subgroup analysis;
- continuous and multiple meta-regression;
- interactions and bubble plots;
- repeated-effect detection beyond labels;
- multilevel models and/or robust variance estimation;
- explicit separation between independent and dependent-effect workflows.
