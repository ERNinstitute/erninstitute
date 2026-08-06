'use strict';

const assert = require('assert');
require('../meta-analysis-engine.js');

const engine = globalThis.ERNMetaAnalysisEngine;
const effects = [
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'A' },
  { effect_metric: 'Hedges g', effect_size: 0.5, sampling_variance: 0.05, study_id: 'B' },
  { effect_metric: 'Hedges g', effect_size: 0.1, sampling_variance: 0.03, study_id: 'C' },
  { effect_metric: 'Hedges g', effect_size: 0.7, sampling_variance: 0.06, study_id: 'D' }
];

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

const fixed = engine.analyze(effects, { model: 'fixed', confidenceLevel: 95 });
close(fixed.estimate, 0.3157894736842105);
close(fixed.standard_error, 0.1025978352085154);
close(fixed.q, 5.026315789473685);

const dl = engine.analyze(effects, { model: 'random', tauEstimator: 'DL', inference: 'wald' });
close(dl.tau2, 0.029117647058823533);
close(dl.estimate, 0.33957778945381467);

const pm = engine.analyze(effects, { model: 'random', tauEstimator: 'PM', inference: 'wald' });
close(pm.tau2, 0.03, 1e-8);
close(pm.estimate, 0.34, 1e-8);

const reml = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'wald' });
close(reml.tau2, 0.0288721280399959, 1e-8);
close(reml.weights.reduce((total, row) => total + row.weight_percent, 0), 100, 1e-8);

close(engine.inverseStudentT(0.975, 3), 3.182446305284, 1e-9);
console.log('ERN Meta-Analysis Engine tests passed.');

const automatic = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'auto', predictionInterval: 'auto' });
assert.strictEqual(automatic.inference, 'knha');
assert.ok(automatic.inference_reason.includes('between-study variance (τ²) was positive'));
assert.strictEqual(automatic.requested_inference, 'auto');
assert.strictEqual(automatic.prediction_lower, '');
assert.ok(automatic.prediction_note.includes('Automatic display begins at five effects'));

const forcedPrediction = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'auto', predictionInterval: 'always' });
assert.ok(Number.isFinite(forcedPrediction.prediction_lower));
assert.ok(forcedPrediction.prediction_note.includes('interpret cautiously'));

const homogeneousEffects = [
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'A' },
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'B' },
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'C' }
];
const autoWald = engine.analyze(homogeneousEffects, { model: 'random', tauEstimator: 'REML', inference: 'auto' });
assert.strictEqual(autoWald.inference, 'wald');
assert.ok(autoWald.inference_reason.includes('between-study variance was zero'));
assert.ok(fixed.model_label.includes('Common-effect'));
