ERN Institute Open Meta-Analysis Data Repository
Curated launch collection: August 6, 2026; expanded November 4–5, 2026

PURPOSE
These files are ERN-ready versions of openly distributed meta-analysis datasets. They use the column structure required by ERN Meta-Analysis Studio and can be loaded directly in Step 1 at https://erninstitute.com/tools/meta-analysis-studio/.

PROVENANCE AND LICENSE
The source datasets are distributed with the metadat R package (version 1.7-2), licensed under the GNU General Public License version 2 or later:
https://wviechtb.github.io/metadat/
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

The ERN-ready files are redistributed under the same GPL-2.0-or-later terms. Cite both the metadat package and the original publication identified on each source page. ERN Institute does not claim authorship or ownership of the original observations.

ERN PREPARATION
ERN Institute retained source observations or source-reported effect estimates, mapped variables to the Studio schema, assigned stable effect identifiers, and added interpretation notes. Binary-group totals and specific effect-size transformations are documented below. Two datasets are intentionally reduced to one effect per study; those results must not be presented as replications of the complete source meta-analyses.

CURRENT COLLECTION
10 datasets; 256 effect-size records; four metric families (Hedges g, Fisher z, log odds ratio, raw mean difference). All records were validated with the Studio converter and their metric-specific models were tested.

FILES
1. ern-ready-colditz1994-bcg.csv: 13 binary effects; BCG vaccination and tuberculosis.
2. ern-ready-normand1999-stroke-stay.csv: 9 standardized-mean-difference effects; stroke-unit hospital stay.
3. ern-ready-cohen1981-instructor-ratings.csv: 20 correlation effects; instructor ratings and student achievement.
4. ern-ready-molloy2014-medication-adherence.csv: 16 correlation effects; conscientiousness and medication adherence.
5. ern-ready-gibson2002-asthma-multimetric.csv: 20 analyzable effects across Hedges g and log odds ratios; asthma self-management.
6. ern-ready-michael2013-brain-image-persuasiveness.csv: 12 raw mean differences (brain-image minus no-image condition) and their reported sampling variances, loaded through generic inverse-variance input. This example concerns the persuasive effects of an fMRI brain image. The two McCabe and Castel (2008) experiment-3 rows represent distinct randomized critique strata, not two effects on the same participants. The original analysis should be consulted for the factorial design and any dependence considerations.
   Original meta-analysis: Michael, R. B., Newman, E. J., Vuorre, M., Cumming, G., & Garry, M. (2013). On the (non)persuasive power of a brain image. Psychonomic Bulletin & Review, 20(4), 720–725. https://doi.org/10.3758/s13423-013-0391-6
   Source page: https://wviechtb.github.io/metadat/reference/dat.michael2013.html
7. ern-ready-bangertdrowns2004-writing-to-learn.csv: 48 Hedges g effects; writing-to-learn interventions and student achievement. The source reports standardized differences (di), sample sizes (ni), corrected g values (yi), and sampling variances (vi). The ERN file uses the source's published yi and vi rather than recalculating a variance from group sizes. The original source assumes equal treatment and comparison group sizes in its sampling-variance formula. All 48 studies are retained.
   Original publication: Bangert-Drowns, R. L., Hurley, M. M., & Wilkinson, B. (2004). The effects of school-based writing-to-learn interventions on academic achievement: A meta-analysis. Review of Educational Research, 74(1), 29–58. https://doi.org/10.3102/00346543074001029
   Source page: https://wviechtb.github.io/metadat/reference/dat.bangertdrowns2004.html
8. ern-ready-bourassa1996-handedness-eye-dominance.csv: 54 combined-sex samples from 47 studies, log odds ratios of handedness and eye dominance. Separate male and female subgroup rows were excluded to avoid double-counting participants already represented in the combined rows. For each 2-by-2 table, ERN uses the source's continuity correction (+0.5 to every cell) and computes log OR=ln((a*d)/(b*c)) and sampling variance=1/a+1/b+1/c+1/d from the corrected cells. Some studies contribute more than one independent sample: the Studio's single-level model treats samples as independent and does not model shared study membership; the source also documents multilevel alternatives.
   Original publication: Bourassa, D. C., McManus, I. C., & Bryden, M. P. (1996). Handedness and eye-dominance: A meta-analysis of their relationship. Laterality, 1(1), 5–34. https://doi.org/10.1080/713754206
   Source page: https://wviechtb.github.io/metadat/reference/dat.bourassa1996.html
9. ern-ready-craft2003-cognitive-anxiety-performance.csv: 10 Fisher z correlations between cognitive anxiety (acog) and sporting performance (perf). Only the cognitive-anxiety/performance correlation is selected from each study; the original source contains multiple correlated anxiety measures. The Studio converts each reported correlation via z=atanh(r), sampling variance=1/(n-3). This subset must not be described as the complete multivariate source analysis.
   Original publication: Craft, L. L., Magyar, T. M., Becker, B. J., & Feltz, D. L. (2003). The relationship between the Competitive State Anxiety Inventory-2 and sport performance: A meta-analysis. Journal of Sport and Exercise Psychology, 25(1), 44–65. https://doi.org/10.1123/jsep.25.1.44
   Source page: https://wviechtb.github.io/metadat/reference/dat.craft2003.html
10. ern-ready-crede2010-attendance-grades.csv: 54 Fisher z correlations of class attendance and course grades, drawn from the complete 97-correlation, 68-study source. ERN retains grade-outcome (rather than GPA-outcome) correlations and selects the largest eligible grade-reporting sample per study ID, yielding 54 studies. The Studio uses z=atanh(r) and variance=1/(n-3). This deliberately selected dataset has a different pooled estimate from the original complete model.
   Original publication: Credé, M., Roch, S. G., & Kieszczynka, U. M. (2010). Class attendance in college: A meta-analytic review of the relationship of class attendance with grades and student characteristics. Review of Educational Research, 80(2), 272–295. https://doi.org/10.3102/0034654310362998
   Source page: https://wviechtb.github.io/metadat/reference/dat.crede2010.html

REPRODUCIBILITY
The Studio's single-level REML random-effects calculation returns approximately g=0.2219 for Bangert-Drowns (48 effects) and log OR=1.3135 for Bourassa (54 samples), matching the source's published single-level examples. This does not validate every possible model or design assumption. Inspect the individual source documentation for moderators, overlapping effects, dependence, and interpretation before using pooled estimates in research.
