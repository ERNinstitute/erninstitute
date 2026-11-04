'use strict';

// Published comparison, not a live execution of the R/metafor package.
// The reference output is printed at:
// https://wviechtb.github.io/metadat/reference/dat.michael2013.html
// Michael et al. (2013), DOI: 10.3758/s13423-013-0391-6.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../effect-size-converter.js');
require('../meta-analysis-engine.js');

const text = fs.readFileSync(path.join(__dirname, '../downloads/open-data/ern-ready-michael2013-brain-image-persuasiveness.csv'), 'utf8');
const converter = globalThis.ERNEffectSizeConverterCore;
const effects = converter.parseDelimited(text).records.map((record) => converter.calculateRecord(record).result);
const result = globalThis.ERNMetaAnalysisEngine.analyze(effects, {
  model: 'random', tauEstimator: 'REML', inference: 'wald', confidenceLevel: 95
});

const near = (actual, target, tolerance, label) =>
  assert.ok(Math.abs(actual - target) <= tolerance, `${label}: ${actual} differs from published ${target}`);

assert.strictEqual(result.k, 12);
near(result.estimate, 0.07, 0.005, 'Pooled raw mean difference');
near(result.standard_error, 0.03, 0.005, 'Standard error');
near(result.q, 15.73, 0.005, 'Cochran Q');
near(result.i2, 28.92, 0.05, 'I squared (source values are rounded)');
near(result.ci_lower, 0.00, 0.005, '95% CI lower');
near(result.ci_upper, 0.14, 0.005, '95% CI upper');

console.log('ERN published metafor-example regression test passed (reported rounding precision).');
