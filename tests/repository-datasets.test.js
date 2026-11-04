'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../effect-size-converter.js');
require('../meta-analysis-engine.js');

const converter = globalThis.ERNEffectSizeConverterCore;
const engine = globalThis.ERNMetaAnalysisEngine;
const expected = {
  'ern-ready-colditz1994-bcg.csv': 13,
  'ern-ready-normand1999-stroke-stay.csv': 9,
  'ern-ready-cohen1981-instructor-ratings.csv': 20,
  'ern-ready-molloy2014-medication-adherence.csv': 16,
  'ern-ready-gibson2002-asthma-multimetric.csv': 20,
  'ern-ready-michael2013-brain-image-persuasiveness.csv': 12
};

let checkedModels = 0;
for (const [filename, count] of Object.entries(expected)) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'downloads', 'open-data', filename), 'utf8');
  const parsed = converter.parseDelimited(source);
  assert.strictEqual(parsed.records.length, count, `Unexpected record count for ${filename}`);
  const results = [];
  for (const record of parsed.records) {
    const outcome = converter.calculateRecord(record);
    assert.ok(outcome.result && Number.isFinite(outcome.result.sampling_variance), `${filename} has an invalid effect`);
    results.push(outcome.result);
  }
  assert.strictEqual(results.length, count);
  const groups = new Map();
  results.forEach((effect) => {
    if (!groups.has(effect.effect_metric)) groups.set(effect.effect_metric, []);
    groups.get(effect.effect_metric).push(effect);
  });
  groups.forEach((effects) => {
    if (effects.length < 2) return;
    const fit = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'auto' });
    assert.ok(Number.isFinite(fit.estimate) && Number.isFinite(fit.standard_error), `${filename} model did not complete`);
    assert.ok(fit.ci_lower <= fit.estimate && fit.estimate <= fit.ci_upper);
    assert.ok(Math.abs(fit.weights.reduce((total, row) => total + row.weight_percent, 0) - 100) < 1e-8);
    checkedModels += 1;
  });
}

assert.ok(checkedModels >= 7);
console.log(`ERN repository tests passed: ${Object.keys(expected).length} datasets, ${checkedModels} metric-specific models.`);
