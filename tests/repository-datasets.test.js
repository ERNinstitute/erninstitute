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
  'ern-ready-michael2013-brain-image-persuasiveness.csv': 12,
  'ern-ready-bangertdrowns2004-writing-to-learn.csv': 48,
  'ern-ready-bourassa1996-handedness-eye-dominance.csv': 54,
  'ern-ready-craft2003-cognitive-anxiety-performance.csv': 10,
  'ern-ready-crede2010-attendance-grades.csv': 54
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

assert.ok(checkedModels >= 11);

function parsedResults(filename) {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'downloads', 'open-data', filename), 'utf8');
  const parsed = converter.parseDelimited(raw);
  return { records: parsed.records, effects: parsed.records.map(record => converter.calculateRecord(record).result) };
}

const bangert = parsedResults('ern-ready-bangertdrowns2004-writing-to-learn.csv');
const bangertFit = engine.analyze(bangert.effects, { model: 'random', tauEstimator: 'REML', inference: 'wald' });
assert.ok(Math.abs(bangertFit.estimate - 0.2219) < .0001, 'Writing-to-learn result should reproduce the published example');

const bourassa = parsedResults('ern-ready-bourassa1996-handedness-eye-dominance.csv');
const bourassaFit = engine.analyze(bourassa.effects, { model: 'random', tauEstimator: 'REML', inference: 'wald' });
assert.ok(Math.abs(bourassaFit.estimate - 1.3135) < .0001, 'Handedness result should reproduce the published single-level example');

for (const filename of [
  'ern-ready-craft2003-cognitive-anxiety-performance.csv',
  'ern-ready-crede2010-attendance-grades.csv'
]) {
  const { records } = parsedResults(filename);
  const ids = records.map(row => row.study_id);
  assert.strictEqual(new Set(ids).size, ids.length, `${filename} must have one effect per study`);
}

const site = fs.readFileSync(path.join(__dirname, '..', 'repository.html'), 'utf8');
const studio = fs.readFileSync(path.join(__dirname, '..', 'tools', 'meta-analysis-studio', 'index.html'), 'utf8');
const converterSource = fs.readFileSync(path.join(__dirname, '..', 'effect-size-converter.js'), 'utf8');
for (const filename of Object.keys(expected)) assert.ok(site.includes(`downloads/open-data/${filename}`), `Repository card missing for ${filename}`);
for (const key of ['bangertdrowns2004', 'bourassa1996', 'craft2003', 'crede2010']) {
  assert.ok(studio.includes(`value="${key}"`), `Studio selector missing ${key}`);
  assert.ok(converterSource.includes(`${key}:`), `Public dataset allowlist missing ${key}`);
}
assert.ok(site.includes('<strong>256</strong>'), 'Published effect count should be 256');
console.log(`ERN repository tests passed: ${Object.keys(expected).length} datasets, ${checkedModels} metric-specific models.`);
