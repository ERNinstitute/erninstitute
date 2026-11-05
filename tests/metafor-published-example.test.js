'use strict';

// Published R/metafor comparisons, not live executions of the R package.
// https://wviechtb.github.io/metadat/reference/dat.michael2013.html
// https://wviechtb.github.io/metadat/reference/dat.bangertdrowns2004.html
// https://wviechtb.github.io/metadat/reference/dat.bourassa1996.html
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../effect-size-converter.js');
require('../meta-analysis-engine.js');

const converter = globalThis.ERNEffectSizeConverterCore;
const engine = globalThis.ERNMetaAnalysisEngine;
function fitDataset(filename) {
  const text = fs.readFileSync(path.join(__dirname, '../downloads/open-data', filename), 'utf8');
  const effects = converter.parseDelimited(text).records.map(record => converter.calculateRecord(record).result);
  return engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'wald', confidenceLevel: 95 });
}

const near = (actual, target, tolerance, label) =>
  assert.ok(Math.abs(actual - target) <= tolerance, `${label}: ${actual} differs from published ${target}`);

const michael = fitDataset('ern-ready-michael2013-brain-image-persuasiveness.csv');
assert.strictEqual(michael.k, 12);
near(michael.estimate, 0.07, 0.005, 'Michael: pooled raw mean difference');
near(michael.standard_error, 0.03, 0.005, 'Michael: standard error');
near(michael.q, 15.73, 0.005, 'Michael: Cochran Q');
near(michael.i2, 28.92, 0.05, 'Michael: I squared (source values are rounded)');
near(michael.ci_lower, 0.00, 0.005, 'Michael: 95% CI lower');
near(michael.ci_upper, 0.14, 0.005, 'Michael: 95% CI upper');

const bangert = fitDataset('ern-ready-bangertdrowns2004-writing-to-learn.csv');
assert.strictEqual(bangert.k, 48);
near(bangert.estimate, 0.2219, 0.00005, 'Bangert-Drowns: pooled Hedges g');
near(bangert.standard_error, 0.0460, 0.00005, 'Bangert-Drowns: standard error');
near(bangert.ci_lower, 0.1317, 0.00005, 'Bangert-Drowns: 95% CI lower');
near(bangert.ci_upper, 0.3122, 0.00005, 'Bangert-Drowns: 95% CI upper');
near(bangert.tau2, 0.0499, 0.00005, 'Bangert-Drowns: tau squared');
near(bangert.q, 107.1061, 0.00005, 'Bangert-Drowns: Q');
near(bangert.i2, 58.37, 0.01, 'Bangert-Drowns: I squared');

// The published Bourassa example also supplies a multilevel fit. The single-level
// model here checks arithmetic only: it is NOT adequate for its repeated studies,
// and the curated Studio UI deliberately prevents users from pooling this dataset.
const bourassa = fitDataset('ern-ready-bourassa1996-handedness-eye-dominance.csv');
assert.strictEqual(bourassa.k, 54);
near(bourassa.estimate, 1.3135, 0.00005, 'Bourassa single-level regression: log odds ratio');
near(bourassa.standard_error, 0.1098, 0.00005, 'Bourassa single-level regression: standard error');
near(bourassa.ci_lower, 1.0982, 0.00005, 'Bourassa single-level regression: 95% CI lower');
near(bourassa.ci_upper, 1.5287, 0.00005, 'Bourassa single-level regression: 95% CI upper');
near(bourassa.tau2, 0.4340, 0.00005, 'Bourassa single-level regression: tau squared');
near(bourassa.q, 355.7748, 0.00005, 'Bourassa single-level regression: Q');
near(bourassa.i2, 89.08, 0.01, 'Bourassa single-level regression: I squared');

console.log('ERN three published metafor-example regressions passed (reported rounding precision).');
