(() => {
  'use strict';

  const EPSILON = 1e-12;

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function clamp(value, lower, upper) {
    return Math.min(upper, Math.max(lower, value));
  }

  function logGamma(z) {
    const coefficients = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012,
      9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    let x = 0.99999999999980993;
    const adjusted = z - 1;
    for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (adjusted + i + 1);
    const t = adjusted + coefficients.length - 0.5;
    return (0.5 * Math.log(2 * Math.PI)) + ((adjusted + 0.5) * Math.log(t)) - t + Math.log(x);
  }

  function regularizedGammaQ(a, x) {
    if (!(a > 0) || x < 0 || !Number.isFinite(a) || !Number.isFinite(x)) return NaN;
    if (x === 0) return 1;
    const gln = logGamma(a);
    if (x < a + 1) {
      let ap = a;
      let del = 1 / a;
      let series = del;
      for (let n = 1; n <= 200; n += 1) {
        ap += 1;
        del *= x / ap;
        series += del;
        if (Math.abs(del) < Math.abs(series) * 1e-14) break;
      }
      const p = series * Math.exp((-x) + (a * Math.log(x)) - gln);
      return clamp(1 - p, 0, 1);
    }

    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i <= 200; i += 1) {
      const an = -i * (i - a);
      b += 2;
      d = (an * d) + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + (an / c);
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    return clamp(Math.exp((-x) + (a * Math.log(x)) - gln) * h, 0, 1);
  }

  function chiSquareSurvival(value, degreesFreedom) {
    if (value < 0 || degreesFreedom <= 0) return NaN;
    return regularizedGammaQ(degreesFreedom / 2, value / 2);
  }

  function erf(value) {
    const sign = value < 0 ? -1 : 1;
    const x = Math.abs(value);
    const t = 1 / (1 + (0.3275911 * x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x));
    return sign * y;
  }

  function normalCdf(value) {
    return 0.5 * (1 + erf(value / Math.SQRT2));
  }

  // Peter J. Acklam's rational approximation.
  function inverseNormal(probability) {
    const p = clamp(probability, 1e-15, 1 - 1e-15);
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const low = 0.02425;
    const high = 1 - low;
    if (p < low) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= high) {
      const q = p - 0.5;
      const r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  function betaContinuedFraction(a, b, x) {
    const maxIterations = 250;
    const fpMin = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - ((qab * x) / qap);
    if (Math.abs(d) < fpMin) d = fpMin;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIterations; m += 1) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + (aa * d);
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + (aa / c);
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      h *= d * c;
      aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + (aa * d);
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + (aa / c);
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 3e-14) break;
    }
    return h;
  }

  function regularizedBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + (a * Math.log(x)) + (b * Math.log(1 - x)));
    if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
    return 1 - ((front * betaContinuedFraction(b, a, 1 - x)) / b);
  }

  function studentTCdf(value, degreesFreedom) {
    if (!(degreesFreedom > 0)) return NaN;
    if (value === 0) return 0.5;
    const x = degreesFreedom / (degreesFreedom + (value * value));
    const ib = regularizedBeta(x, degreesFreedom / 2, 0.5);
    return value > 0 ? 1 - (0.5 * ib) : 0.5 * ib;
  }

  function inverseStudentT(probability, degreesFreedom) {
    if (!(degreesFreedom > 0)) return NaN;
    const p = clamp(probability, 1e-12, 1 - 1e-12);
    if (p === 0.5) return 0;
    const sign = p < 0.5 ? -1 : 1;
    const target = p < 0.5 ? 1 - p : p;
    let lower = 0;
    let upper = Math.max(1, Math.abs(inverseNormal(target)));
    while (studentTCdf(upper, degreesFreedom) < target && upper < 1e6) upper *= 2;
    for (let i = 0; i < 100; i += 1) {
      const mid = (lower + upper) / 2;
      if (studentTCdf(mid, degreesFreedom) < target) lower = mid;
      else upper = mid;
    }
    return sign * ((lower + upper) / 2);
  }

  function weightedSummary(effects, tau2 = 0) {
    const weights = effects.map((effect) => 1 / (effect.sampling_variance + tau2));
    const sumWeights = sum(weights);
    const estimate = sum(effects.map((effect, index) => weights[index] * effect.effect_size)) / sumWeights;
    const q = sum(effects.map((effect, index) => weights[index] * ((effect.effect_size - estimate) ** 2)));
    return { weights, sumWeights, estimate, q };
  }

  function tauSquaredDL(effects, qFixed) {
    const fixedWeights = effects.map((effect) => 1 / effect.sampling_variance);
    const sumWeights = sum(fixedWeights);
    const denominator = sumWeights - (sum(fixedWeights.map((weight) => weight * weight)) / sumWeights);
    if (denominator <= 0) return 0;
    return Math.max(0, (qFixed - (effects.length - 1)) / denominator);
  }

  function tauSquaredPM(effects) {
    const target = effects.length - 1;
    if (weightedSummary(effects, 0).q <= target) return 0;
    let lower = 0;
    let upper = Math.max(1e-8, Math.max(...effects.map((effect) => effect.effect_size)) - Math.min(...effects.map((effect) => effect.effect_size)));
    upper *= upper;
    if (upper <= 0) upper = 1;
    while (weightedSummary(effects, upper).q > target && upper < 1e8) upper *= 2;
    for (let i = 0; i < 120; i += 1) {
      const mid = (lower + upper) / 2;
      if (weightedSummary(effects, mid).q > target) lower = mid;
      else upper = mid;
    }
    return Math.max(0, (lower + upper) / 2);
  }

  function restrictedLogLikelihood(effects, tau2) {
    const summary = weightedSummary(effects, tau2);
    const logVariance = sum(effects.map((effect) => Math.log(effect.sampling_variance + tau2)));
    return -0.5 * (logVariance + Math.log(summary.sumWeights) + summary.q);
  }

  function tauSquaredREML(effects) {
    const values = effects.map((effect) => effect.effect_size);
    const mean = sum(values) / values.length;
    const sampleVariance = values.length > 1 ? sum(values.map((value) => (value - mean) ** 2)) / (values.length - 1) : 0;
    let upper = Math.max(1e-8, sampleVariance, Math.max(...effects.map((effect) => effect.sampling_variance)));
    let previous = restrictedLogLikelihood(effects, upper / 2);
    let current = restrictedLogLikelihood(effects, upper);
    while (current > previous && upper < 1e8) {
      upper *= 2;
      previous = current;
      current = restrictedLogLikelihood(effects, upper);
    }
    const atZero = restrictedLogLikelihood(effects, 0);
    const nearZero = restrictedLogLikelihood(effects, Math.min(upper, 1e-10));
    if (atZero >= nearZero && atZero >= current) return 0;

    const phi = (Math.sqrt(5) - 1) / 2;
    let lower = 0;
    let x1 = upper * (1 - phi);
    let x2 = upper * phi;
    let f1 = restrictedLogLikelihood(effects, x1);
    let f2 = restrictedLogLikelihood(effects, x2);
    for (let i = 0; i < 140; i += 1) {
      if (f1 < f2) {
        lower = x1;
        x1 = x2;
        f1 = f2;
        x2 = lower + (phi * (upper - lower));
        f2 = restrictedLogLikelihood(effects, x2);
      } else {
        upper = x2;
        x2 = x1;
        f2 = f1;
        x1 = upper - (phi * (upper - lower));
        f1 = restrictedLogLikelihood(effects, x1);
      }
    }
    const estimate = (lower + upper) / 2;
    return restrictedLogLikelihood(effects, 0) >= restrictedLogLikelihood(effects, estimate) ? 0 : Math.max(0, estimate);
  }


  function reportNumber(value, digits = 3) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'not available';
    if (number !== 0 && Math.abs(number) < 0.001) return number.toExponential(2);
    return number.toFixed(digits).replace(/\.?0+$/, '');
  }

  function reportP(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'not available';
    if (number < 0.001) return '< .001';
    return `= ${number.toFixed(3).replace(/^0/, '')}`;
  }

  function transformNatural(metric, value) {
    if (!Number.isFinite(value)) return '';
    if (metric === 'Fisher z') return Math.tanh(value);
    if (metric === 'Log odds ratio') return Math.exp(value);
    return value;
  }

  function naturalMetricName(metric) {
    if (metric === 'Fisher z') return 'Pearson r';
    if (metric === 'Log odds ratio') return 'Odds ratio';
    return metric;
  }

  function analyze(rawEffects, options = {}) {
    const effects = (rawEffects || []).map((effect) => ({
      ...effect,
      effect_size: Number(effect.effect_size),
      sampling_variance: Number(effect.sampling_variance)
    })).filter((effect) => Number.isFinite(effect.effect_size) && Number.isFinite(effect.sampling_variance) && effect.sampling_variance > 0);

    if (effects.length < 2) throw new Error('At least two valid effect sizes on the same metric are required.');
    const metrics = [...new Set(effects.map((effect) => effect.effect_metric))];
    if (metrics.length !== 1) throw new Error('A model can pool only one effect-size metric at a time.');

    const metric = metrics[0];
    const model = options.model === 'fixed' ? 'fixed' : 'random';
    const tauEstimator = String(options.tauEstimator || 'REML').toUpperCase();
    const requestedInference = ['auto', 'wald', 'knha'].includes(options.inference) ? options.inference : 'auto';
    const predictionPolicy = ['auto', 'always', 'off'].includes(options.predictionInterval) ? options.predictionInterval : 'auto';
    const confidenceLevel = Number(options.confidenceLevel || 95);
    const alpha = 1 - (confidenceLevel / 100);
    const zCritical = inverseNormal(1 - (alpha / 2));
    const k = effects.length;

    const fixed = weightedSummary(effects, 0);
    const q = fixed.q;
    const qDf = k - 1;
    const qP = chiSquareSurvival(q, qDf);
    const i2 = q > 0 ? Math.max(0, ((q - qDf) / q) * 100) : 0;
    const h2 = qDf > 0 ? q / qDf : NaN;

    let tau2 = 0;
    if (model === 'random') {
      if (tauEstimator === 'DL') tau2 = tauSquaredDL(effects, q);
      else if (tauEstimator === 'PM') tau2 = tauSquaredPM(effects);
      else tau2 = tauSquaredREML(effects);
    }

    let inference = model === 'fixed' ? 'wald' : requestedInference;
    let inferenceReason = model === 'fixed'
      ? 'Common-effect models use Wald normal inference.'
      : 'Selected manually.';
    if (model === 'random' && requestedInference === 'auto') {
      if (k > 2 && tau2 > EPSILON) {
        inference = 'knha';
        inferenceReason = 'Automatically selected Knapp–Hartung because more than two effects were available and the estimated between-study variance (τ²) was positive.';
      } else {
        inference = 'wald';
        inferenceReason = tau2 <= EPSILON
          ? 'Automatically selected Wald inference because estimated between-study variance was zero.'
          : 'Automatically selected Wald inference because fewer than three effects were available.';
      }
    }

    const pooled = weightedSummary(effects, tau2);
    let standardError = Math.sqrt(1 / pooled.sumWeights);
    let criticalValue = zCritical;
    let inferenceDf = '';
    let scaleFactor = 1;
    if (model === 'random' && inference === 'knha') {
      inferenceDf = k - 1;
      scaleFactor = pooled.q / inferenceDf;
      standardError = Math.sqrt(scaleFactor / pooled.sumWeights);
      criticalValue = inverseStudentT(1 - (alpha / 2), inferenceDf);
    }

    const ciLower = pooled.estimate - (criticalValue * standardError);
    const ciUpper = pooled.estimate + (criticalValue * standardError);
    const statistic = pooled.estimate / standardError;
    const pValue = model === 'random' && inference === 'knha'
      ? 2 * (1 - studentTCdf(Math.abs(statistic), inferenceDf))
      : 2 * (1 - normalCdf(Math.abs(statistic)));

    let predictionLower = '';
    let predictionUpper = '';
    let predictionDf = '';
    let predictionNote = '';
    const predictionEligible = model === 'random' && k >= 3;
    const showPrediction = predictionEligible && predictionPolicy !== 'off' && (predictionPolicy === 'always' || k >= 5);
    if (showPrediction) {
      predictionDf = k - 2;
      const predictionCritical = inverseStudentT(1 - (alpha / 2), predictionDf);
      const predictionSe = Math.sqrt(tau2 + (standardError ** 2));
      predictionLower = pooled.estimate - (predictionCritical * predictionSe);
      predictionUpper = pooled.estimate + (predictionCritical * predictionSe);
      predictionNote = predictionPolicy === 'always' && k < 5
        ? 'Displayed by advanced request with fewer than five effects; interpret cautiously.'
        : 'Displayed automatically because at least five effects were available.';
    } else if (model !== 'random') {
      predictionNote = 'Prediction intervals are not defined for the common-effect model in this workflow.';
    } else if (predictionPolicy === 'off') {
      predictionNote = 'Prediction interval disabled in Advanced settings.';
    } else if (k < 3) {
      predictionNote = 'At least three effects are required to calculate this prediction interval.';
    } else {
      predictionNote = 'Automatic display begins at five effects; Advanced settings can request the interval with three or four effects.';
    }

    const weightRows = effects.map((effect, index) => ({
      source_row: effect.source_row || '',
      study_id: effect.study_id || '',
      effect_id: effect.effect_id || '',
      effect_metric: metric,
      effect_size: effect.effect_size,
      sampling_variance: effect.sampling_variance,
      standard_error: Math.sqrt(effect.sampling_variance),
      ci_lower: effect.effect_size - (zCritical * Math.sqrt(effect.sampling_variance)),
      ci_upper: effect.effect_size + (zCritical * Math.sqrt(effect.sampling_variance)),
      model_weight: pooled.weights[index],
      weight_percent: (pooled.weights[index] / pooled.sumWeights) * 100
    }));

    const estimateNatural = transformNatural(metric, pooled.estimate);
    const ciNaturalLower = transformNatural(metric, ciLower);
    const ciNaturalUpper = transformNatural(metric, ciUpper);
    const piNaturalLower = predictionLower === '' ? '' : transformNatural(metric, predictionLower);
    const piNaturalUpper = predictionUpper === '' ? '' : transformNatural(metric, predictionUpper);

    const modelLabel = model === 'fixed' ? 'Common-effect (fixed-effect) inverse-variance model' : 'Random-effects model';
    const inferenceLabel = model === 'random' && inference === 'knha' ? 'Knapp–Hartung t inference' : 'Wald normal inference';
    const predictionMethodsText = predictionLower === ''
      ? ` No prediction interval was reported (${predictionNote.toLowerCase()})`
      : ` A t-based ${confidenceLevel}% prediction interval was calculated with ${predictionDf} degrees of freedom.`;
    const methodsText = model === 'fixed'
      ? `A common-effect (fixed-effect) inverse-variance meta-analysis was fitted to ${k} independent ${metric} estimates. Statistical inference used a ${confidenceLevel}% Wald confidence interval.`
      : `A random-effects meta-analysis was fitted to ${k} independent ${metric} estimates. Between-study variance was estimated using ${tauEstimator}, and ${inferenceLabel} was used for the pooled effect.${predictionMethodsText}`;

    const estimateText = Number.isFinite(estimateNatural) ? estimateNatural : pooled.estimate;
    const lowerText = Number.isFinite(ciNaturalLower) ? ciNaturalLower : ciLower;
    const upperText = Number.isFinite(ciNaturalUpper) ? ciNaturalUpper : ciUpper;
    const naturalLabel = naturalMetricName(metric);
    const predictionText = predictionLower === '' ? '' : ` The ${confidenceLevel}% prediction interval was [${reportNumber(piNaturalLower)}, ${reportNumber(piNaturalUpper)}] on the ${naturalLabel} scale.`;
    const testLabel = model === 'random' && inference === 'knha' ? `t(${inferenceDf})` : 'z';
    const resultsText = `The pooled ${naturalLabel} was ${reportNumber(estimateText)}, ${confidenceLevel}% CI [${reportNumber(lowerText)}, ${reportNumber(upperText)}], ${testLabel} = ${reportNumber(statistic, 2)}, p ${reportP(pValue)}. Heterogeneity was Q(${qDf}) = ${reportNumber(q, 2)}, p ${reportP(qP)}, I² = ${reportNumber(i2, 1)}%, and τ² = ${reportNumber(tau2)}.${predictionText}`;

    return {
      metric,
      natural_metric: naturalLabel,
      model,
      model_label: modelLabel,
      tau_estimator: model === 'random' ? tauEstimator : 'Not applicable',
      inference,
      requested_inference: requestedInference,
      inference_label: inferenceLabel,
      inference_reason: inferenceReason,
      confidence_level: confidenceLevel,
      k,
      estimate: pooled.estimate,
      standard_error: standardError,
      ci_lower: ciLower,
      ci_upper: ciUpper,
      statistic,
      p_value: clamp(pValue, 0, 1),
      inference_df: inferenceDf,
      tau2,
      tau: Math.sqrt(tau2),
      q,
      q_df: qDf,
      q_p_value: qP,
      i2,
      h2,
      prediction_lower: predictionLower,
      prediction_upper: predictionUpper,
      prediction_df: predictionDf,
      prediction_policy: predictionPolicy,
      prediction_note: predictionNote,
      natural_estimate: estimateNatural,
      natural_ci_lower: ciNaturalLower,
      natural_ci_upper: ciNaturalUpper,
      natural_prediction_lower: piNaturalLower,
      natural_prediction_upper: piNaturalUpper,
      kh_scale_factor: model === 'random' && inference === 'knha' ? scaleFactor : '',
      methods_text: methodsText,
      results_text: resultsText,
      weights: weightRows,
      settings: { model, tauEstimator, inference, requestedInference, confidenceLevel, predictionPolicy }
    };
  }

  globalThis.ERNMetaAnalysisEngine = {
    analyze,
    chiSquareSurvival,
    studentTCdf,
    inverseStudentT,
    inverseNormal,
    tauSquaredDL,
    tauSquaredPM,
    tauSquaredREML
  };
})();
