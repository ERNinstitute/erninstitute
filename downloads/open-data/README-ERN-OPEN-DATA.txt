ERN Institute Open Meta-Analysis Data Repository
Curated launch collection: August 6, 2026

PURPOSE
These files are ERN-ready versions of openly distributed meta-analysis datasets. They use the exact column structure required by ERN Meta-Analysis Studio and can be uploaded directly at https://erninstitute.com/tools.html.

PROVENANCE AND LICENSE
The source datasets are distributed with the metadat R package (version 1.7-2), licensed under the GNU General Public License version 2 or later:
https://wviechtb.github.io/metadat/
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

The ERN-ready files are redistributed under the same GPL-2.0-or-later terms. Cite both the metadat package and the original publication identified on each source page. ERN Institute does not claim authorship or ownership of the original observations.

ERN PREPARATION
ERN Institute retained the source values and:
- renamed variables to match the Studio upload schema;
- created stable effect identifiers;
- calculated binary-group totals from event and non-event counts;
- added plain-language notes and direction-of-effect guidance;
- split or combined source fields only where necessary for Studio compatibility.

The Studio computes Hedges g, Fisher z, or log odds ratios from these raw summaries. Results can differ from a source publication when that publication used a different effect-size measure, model, continuity correction, estimator, or inference method.

FILES
1. ern-ready-colditz1994-bcg.csv
   13 binary effects; BCG vaccination and tuberculosis.
   Source: https://wviechtb.github.io/metadat/reference/dat.colditz1994.html

2. ern-ready-normand1999-stroke-stay.csv
   9 standardized-mean-difference effects; stroke-unit hospital stay.
   Source: https://wviechtb.github.io/metadat/reference/dat.normand1999.html

3. ern-ready-cohen1981-instructor-ratings.csv
   20 correlation effects; instructor ratings and student achievement.
   Source: https://wviechtb.github.io/metadat/reference/dat.cohen1981.html

4. ern-ready-molloy2014-medication-adherence.csv
   16 correlation effects; conscientiousness and medication adherence.
   Source: https://wviechtb.github.io/metadat/reference/dat.molloy2014.html

5. ern-ready-gibson2002-asthma-multimetric.csv
   20 analyzable effects across Hedges g and log odds ratios; asthma self-management.
   Source: https://wviechtb.github.io/metadat/reference/dat.gibson2002.html

QUALITY CHECKS
Each CSV was loaded through the ERN calculation engine. All rows calculate successfully. The multi-metric Gibson file should produce two distinct models when “Run all different effect-size metrics” is selected.
