'use strict';

const fs = require('fs');
const path = require('path');
require('../effect-size-converter.js');
require('../meta-analysis-engine.js');

const converter = globalThis.ERNEffectSizeConverterCore;
const engine = globalThis.ERNMetaAnalysisEngine;
const files = [
  'ern-ready-colditz1994-bcg.csv',
  'ern-ready-normand1999-stroke-stay.csv',
  'ern-ready-cohen1981-instructor-ratings.csv',
  'ern-ready-molloy2014-medication-adherence.csv',
  'ern-ready-gibson2002-asthma-multimetric.csv',
  'ern-ready-michael2013-brain-image-persuasiveness.csv'
];

const vectors = [];
for (const file of files) {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'downloads', 'open-data', file), 'utf8');
  const effects = converter.parseDelimited(csv).records.map((record) => converter.calculateRecord(record).result);
  const grouped = new Map();
  effects.forEach((effect) => {
    const metric = effect.effect_metric;
    if (!grouped.has(metric)) grouped.set(metric, []);
    grouped.get(metric).push(effect);
  });
  for (const [metric, group] of grouped) {
    if (group.length < 2) continue;
    for (const model of ['fixed', 'random']) {
      for (const estimator of model === 'fixed' ? ['REML'] : ['DL', 'PM', 'REML']) {
        const result = engine.analyze(group, { model, tauEstimator: estimator, inference: 'auto', predictionInterval: 'always' });
        vectors.push({ file, metric, model, estimator, effects: group.map((e) => ({ y: e.effect_size, v: e.sampling_variance })),
          actual: { estimate: result.estimate, standard_error: result.standard_error, ci_lower: result.ci_lower,
            ci_upper: result.ci_upper, tau2: result.tau2, q: result.q, i2: result.i2,
            inference: result.inference, prediction_lower: result.prediction_lower, prediction_upper: result.prediction_upper } });
      }
    }
  }
}

process.stdout.write(JSON.stringify(vectors));
