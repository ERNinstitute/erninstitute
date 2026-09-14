'use strict';

const assert = require('assert');
require('../meta-analysis-engine.js');

const engine = globalThis.ERNMetaAnalysisEngine;

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

const effects = [
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'A' },
  { effect_metric: 'Hedges g', effect_size: 0.5, sampling_variance: 0.05, study_id: 'B' },
  { effect_metric: 'Hedges g', effect_size: 0.1, sampling_variance: 0.03, study_id: 'C' },
  { effect_metric: 'Hedges g', effect_size: 0.7, sampling_variance: 0.06, study_id: 'D' }
];

const fixed = engine.analyze(effects, { model: 'fixed', confidenceLevel: 95 });
close(fixed.estimate, 0.3157894736842105);
close(fixed.standard_error, 0.1025978352085154);
close(fixed.q, 5.026315789473685);
assert.ok(Number.isFinite(fixed.q_i2));

const dl = engine.analyze(effects, { model: 'random', tauEstimator: 'DL', inference: 'wald' });
close(dl.tau2, 0.029117647058823533);
close(dl.estimate, 0.33957778945381467);
assert.ok(dl.i2 > 0 && dl.i2 < 100);

const pm = engine.analyze(effects, { model: 'random', tauEstimator: 'PM', inference: 'wald' });
close(pm.tau2, 0.03, 1e-8);
close(pm.estimate, 0.34, 1e-8);

const reml = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'wald' });
close(reml.tau2, 0.0288721280399959, 1e-8);
close(reml.weights.reduce((total, row) => total + row.weight_percent, 0), 100, 1e-8);
assert.ok(reml.heterogeneity_note.includes('REML estimated positive between-study variance'));

close(engine.inverseStudentT(0.975, 3), 3.182446305284, 1e-9);

const automatic = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'auto', predictionInterval: 'auto' });
assert.strictEqual(automatic.inference, 'knha');
assert.ok(automatic.inference_reason.includes('between-study variance (τ²) was positive'));
assert.strictEqual(automatic.requested_inference, 'auto');
assert.strictEqual(automatic.prediction_lower, '');
assert.ok(automatic.prediction_note.includes('Automatic display begins at five effects'));

const forcedPrediction = engine.analyze(effects, { model: 'random', tauEstimator: 'REML', inference: 'auto', predictionInterval: 'always' });
assert.ok(Number.isFinite(forcedPrediction.prediction_lower));
assert.ok(forcedPrediction.prediction_note.includes('interpret cautiously'));
assert.strictEqual(forcedPrediction.prediction_df, forcedPrediction.inference_df);

const homogeneousEffects = [
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'A' },
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'B' },
  { effect_metric: 'Hedges g', effect_size: 0.2, sampling_variance: 0.04, study_id: 'C' }
];
const autoWald = engine.analyze(homogeneousEffects, { model: 'random', tauEstimator: 'REML', inference: 'auto' });
assert.strictEqual(autoWald.inference, 'wald');
assert.ok(autoWald.inference_reason.includes('zero boundary'));
assert.strictEqual(autoWald.tau_boundary, true);
close(autoWald.i2, 0);
close(autoWald.h2, 1);
assert.ok(autoWald.heterogeneity_note.includes('does not imply that all true effects are identical'));
assert.ok(autoWald.heterogeneity_brief.includes('does not establish that the true effects are identical'));
assert.ok(autoWald.heterogeneity_brief.includes('only 3 effects'));
assert.ok(fixed.model_label.includes('Common-effect'));

// Regression case from the built-in odds-ratio example. REML reaches the
// boundary even though Q-based I² is positive; displayed I² must stay
// consistent with the selected REML tau² estimate.
function logOr(events1, total1, events2, total2) {
  let a = events1, b = total1 - events1, c = events2, d = total2 - events2;
  if ([a,b,c,d].some((cell) => cell === 0)) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }
  return {
    effect_metric: 'Log odds ratio',
    effect_size: Math.log((a*d)/(b*c)),
    sampling_variance: (1/a)+(1/b)+(1/c)+(1/d)
  };
}
const demoOr = [
  { ...logOr(18,60,9,58), study_id:'Demo Study L' },
  { ...logOr(27,90,19,88), study_id:'Demo Study M' },
  { ...logOr(0,42,6,44), study_id:'Demo Study N' }
];
const demoReml = engine.analyze(demoOr, { model:'random', tauEstimator:'REML', inference:'auto' });
close(demoReml.tau2, 0, 1e-12);
close(demoReml.i2, 0, 1e-12);
close(demoReml.h2, 1, 1e-12);
assert.ok(demoReml.q_i2 > 50);
assert.ok(demoReml.heterogeneity_note.includes('zero boundary'));
assert.ok(demoReml.heterogeneity_note.includes('only 3 effects'));

// When tau² = 0 and a PI is requested, using the fitted model's critical
// value makes the PI coincide with the CI, matching metafor/RevMan logic.
const homogeneousFive = [1,2,3,4,5].map((i) => ({
  effect_metric:'Hedges g', effect_size:0.2, sampling_variance:0.04, study_id:`H${i}`
}));
const homogeneousPi = engine.analyze(homogeneousFive, { model:'random', tauEstimator:'REML', inference:'auto', predictionInterval:'auto' });
close(homogeneousPi.tau2, 0, 1e-12);
close(homogeneousPi.prediction_lower, homogeneousPi.ci_lower, 1e-12);
close(homogeneousPi.prediction_upper, homogeneousPi.ci_upper, 1e-12);


const threeHeterogeneous = [
  { effect_metric:'Hedges g', effect_size:-0.4, sampling_variance:0.03, study_id:'T1' },
  { effect_metric:'Hedges g', effect_size:0.3, sampling_variance:0.04, study_id:'T2' },
  { effect_metric:'Hedges g', effect_size:0.9, sampling_variance:0.05, study_id:'T3' }
];
const threeAuto = engine.analyze(threeHeterogeneous, { model:'random', tauEstimator:'REML', inference:'auto' });
assert.strictEqual(threeAuto.inference, 'knha');
assert.ok(threeAuto.heterogeneity_brief.includes('compare HKSJ and Wald'));
const threeManualWald = engine.analyze(threeHeterogeneous, { model:'random', tauEstimator:'REML', inference:'wald' });
assert.ok(threeManualWald.inference_reason.includes('does not account for uncertainty'));

console.log('ERN Meta-Analysis Engine tests passed.');
