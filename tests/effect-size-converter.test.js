'use strict';

const assert = require('assert');
require('../effect-size-converter.js');
const core = globalThis.ERNEffectSizeConverterCore;

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

// Hedges g uses the large-sample sampling-variance approximation that matches
// metafor's default vtype="LS": 1/n1 + 1/n2 + g^2/(2*(n1+n2)).
const means = core.calculateRecord({
  __row: 2, study_id:'A', effect_id:'S1', calculation_type:'independent_means',
  mean1:'54.2', sd1:'9.1', n1:'48', mean2:'49.6', sd2:'8.7', n2:'50', reverse_sign:'no'
}).result;
close(means.effect_size, 0.5129143352443787, 1e-12); // exact Hedges correction
const expectedVar = (1/48) + (1/50) + ((means.effect_size ** 2) / (2*(48+50)));
close(means.sampling_variance, expectedVar, 1e-12);

const genericVar = core.calculateRecord({
  __row:2, study_id:'G1', effect_id:'E1', calculation_type:'generic', effect_metric:'Log risk ratio',
  effect_size:'-0.2', sampling_variance:'0.04', standard_error:'', reverse_sign:'no'
}).result;
close(genericVar.effect_size, -0.2);
close(genericVar.sampling_variance, 0.04);
assert.strictEqual(genericVar.effect_metric, 'Log risk ratio');

const genericSe = core.calculateRecord({
  __row:3, study_id:'G2', effect_id:'E2', calculation_type:'generic', effect_metric:'Hedges g',
  effect_size:'0.35', sampling_variance:'', standard_error:'0.2', reverse_sign:'yes'
}).result;
close(genericSe.effect_size, -0.35);
close(genericSe.sampling_variance, 0.04);

const genericOr = core.calculateRecord({
  __row:4, study_id:'G3', effect_id:'E3', calculation_type:'generic', effect_metric:'Log odds ratio',
  effect_size:'0.5', sampling_variance:'0.09', standard_error:'', reverse_sign:'no'
}).result;
close(genericOr.natural_effect, Math.exp(0.5));

let doubleZero;
try {
  core.calculateRecord({
    __row:5, study_id:'DZ', effect_id:'O1', calculation_type:'binary',
    events1:'0', total1:'40', events2:'0', total2:'45', reverse_sign:'no'
  });
} catch (error) {
  doubleZero = error;
}
assert.ok(doubleZero, 'double-zero study should be excluded');
assert.strictEqual(doubleZero.code, 'NONINFORMATIVE_BINARY_STUDY');
assert.strictEqual(doubleZero.severity, 'warning');

const singleZero = core.calculateRecord({
  __row:6, study_id:'SZ', effect_id:'O2', calculation_type:'binary',
  events1:'0', total1:'42', events2:'6', total2:'44', reverse_sign:'no'
});
assert.ok(Number.isFinite(singleZero.result.effect_size));
assert.ok(singleZero.result.warning.includes('0.5 continuity correction'));

const missingStudy = core.calculateRecord({
  __row:7, study_id:'', effect_id:'R1', calculation_type:'correlation', r_value:'0.25', n:'50', reverse_sign:'no'
});
assert.ok(missingStudy.notices.some((x) => x.code === 'MISSING_STUDY_ID' && x.severity === 'warning'));

const parsed = core.parseDelimited('study_id,effect_id,calculation_type,effect_metric,effect_size,standard_error\nA,E1,generic,Hedges g,0.2,0.1\nB,E2,generic,Hedges g,0.3,0.2');
assert.strictEqual(parsed.records.length, 2);
assert.strictEqual(parsed.records[0].effect_metric, 'Hedges g');


const genericRr = core.calculateRecord({
  __row:8, study_id:'G4', effect_id:'E4', calculation_type:'generic', effect_metric:'log_rr',
  effect_size:'-0.25', sampling_variance:'0.05', standard_error:'', reverse_sign:'no'
}).result;
assert.strictEqual(genericRr.effect_metric, 'Log risk ratio');
assert.strictEqual(genericRr.natural_metric, 'Risk ratio');
close(genericRr.natural_effect, Math.exp(-0.25));

let rawRatioError;
try {
  core.calculateRecord({
    __row:9, study_id:'G5', effect_id:'E5', calculation_type:'generic', effect_metric:'Risk ratio',
    effect_size:'0.8', sampling_variance:'0.02', reverse_sign:'no'
  });
} catch (error) { rawRatioError = error; }
assert.strictEqual(rawRatioError.code, 'GENERIC_RATIO_REQUIRES_LOG_SCALE');

let reverseError;
try {
  core.calculateRecord({
    __row:10, study_id:'R', effect_id:'R1', calculation_type:'correlation', r_value:'0.2', n:'40', reverse_sign:'maybe'
  });
} catch (error) { reverseError = error; }
assert.strictEqual(reverseError.code, 'INVALID_REVERSE_SIGN');

let duplicateHeaderError;
try {
  core.parseDelimited('study_id,effect_id,calculation_type,Effect Size,effect-size\nA,E1,generic,0.2,0.04');
} catch (error) { duplicateHeaderError = error; }
assert.ok(duplicateHeaderError && duplicateHeaderError.message.includes('Duplicate column name'));


// The public built-in/downloadable example must be a clean, poolable dataset,
// not a collection of developer edge cases.
const fs = require('fs');
const exampleText = fs.readFileSync(require('path').join(__dirname, '..', 'downloads', 'effect-size-example.csv'), 'utf8');
const exampleParsed = core.parseDelimited(exampleText);
let exampleNotices = [];
let exampleResults = [];
for (const record of exampleParsed.records) {
  const outcome = core.calculateRecord(record);
  exampleResults.push(outcome.result);
  exampleNotices.push(...outcome.notices);
}
assert.strictEqual(exampleResults.length, 14);
assert.strictEqual(exampleNotices.length, 0, `Built-in example should load cleanly; got ${JSON.stringify(exampleNotices)}`);
assert.strictEqual(new Set(exampleResults.map((x) => x.effect_metric)).size, 3);

console.log('ERN Effect-Size Converter tests passed.');
