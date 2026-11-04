ERN Institute Open Meta-Analysis Data Repository
Curated launch collection: August 6, 2026; neuroscience-focused expansion: November 4, 2026

PURPOSE
These files are ERN-ready versions of openly distributed meta-analysis datasets. They use the column structure required by ERN Meta-Analysis Studio and can be loaded directly in Step 1 at https://erninstitute.com/tools/meta-analysis-studio/.

PROVENANCE AND LICENSE
The source datasets are distributed with the metadat R package (version 1.7-2), licensed under the GNU General Public License version 2 or later:
https://wviechtb.github.io/metadat/
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

The ERN-ready files are redistributed under the same GPL-2.0-or-later terms. Cite both the metadat package and the original publication identified on each source page. ERN Institute does not claim authorship or ownership of the original observations.

ERN PREPARATION
ERN Institute retained the source values and renamed variables to match the Studio upload schema, created stable effect identifiers, calculated binary-group totals from event and non-event counts, and added explanatory notes and direction-of-effect guidance.

FILES
1. ern-ready-colditz1994-bcg.csv: 13 binary effects; BCG vaccination and tuberculosis.
2. ern-ready-normand1999-stroke-stay.csv: 9 standardized-mean-difference effects; stroke-unit hospital stay.
3. ern-ready-cohen1981-instructor-ratings.csv: 20 correlation effects; instructor ratings and student achievement.
4. ern-ready-molloy2014-medication-adherence.csv: 16 correlation effects; conscientiousness and medication adherence.
5. ern-ready-gibson2002-asthma-multimetric.csv: 20 analyzable effects across Hedges g and log odds ratios; asthma self-management.
6. ern-ready-michael2013-brain-image-persuasiveness.csv: 12 raw mean differences (brain-image minus no-image condition) and their reported sampling variances, loaded through generic inverse-variance input. This example concerns the persuasive effects of an fMRI brain image. The two McCabe and Castel (2008) experiment-3 rows represent distinct randomized critique strata, not two effects on the same participants. The original analysis should be consulted for the factorial design and any dependence considerations.
   Original meta-analysis: Michael, R. B., Newman, E. J., Vuorre, M., Cumming, G., & Garry, M. (2013). On the (non)persuasive power of a brain image. Psychonomic Bulletin & Review, 20(4), 720–725. https://doi.org/10.3758/s13423-013-0391-6
   Source page: https://wviechtb.github.io/metadat/reference/dat.michael2013.html
