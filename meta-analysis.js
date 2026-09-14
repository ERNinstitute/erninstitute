(() => {
  'use strict';

  const section = document.getElementById('meta-analysis-section');
  const metricSelect = document.getElementById('meta-metric');
  const modelSelect = document.getElementById('meta-model');
  const tauSelect = document.getElementById('meta-tau');
  const inferenceSelect = document.getElementById('meta-inference');
  const confidenceSelect = document.getElementById('meta-confidence');
  const predictionSelect = document.getElementById('meta-prediction');
  const sensitivityCheckbox = document.getElementById('include-common-sensitivity');
  const settingsCard = document.getElementById('meta-settings-card');
  const settingsState = document.getElementById('meta-settings-state');
  const settingsSummary = document.getElementById('meta-settings-summary');
  const settingsNote = document.getElementById('meta-settings-note');
  const runButton = document.getElementById('run-meta-analysis');
  const runAllButton = document.getElementById('run-all-meta-analyses');
  const status = document.getElementById('meta-status');
  const independenceBox = document.getElementById('meta-independence-box');
  const independenceCheckbox = document.getElementById('confirm-independent-effects');
  const independenceText = document.getElementById('meta-independence-text');
  const output = document.getElementById('meta-output');
  const allResultsContainer = document.getElementById('meta-all-results');
  const singleResultContainer = document.getElementById('meta-single-result');
  const summaryGrid = document.getElementById('meta-summary-grid');
  const resultNote = document.getElementById('meta-result-note');
  const modelDescription = document.getElementById('meta-model-description');
  const weightsBody = document.getElementById('meta-weights-body');
  const forestContainer = document.getElementById('meta-forest-container');
  const methodsText = document.getElementById('meta-methods-text');
  const resultsText = document.getElementById('meta-results-text');
  const downloadForestButton = document.getElementById('download-pooled-forest');
  const downloadModelButton = document.getElementById('download-meta-results');
  const copyMethodsButton = document.getElementById('copy-meta-methods');
  const copyResultsButton = document.getElementById('copy-meta-results');
  const sensitivityDetails = document.getElementById('meta-sensitivity-details');
  const sensitivityBody = document.getElementById('meta-sensitivity-body');
  const detailGrid = document.getElementById('meta-detail-grid');
  const workbookResultsButton = document.getElementById('download-workbook-results');

  if (!section || !metricSelect || !globalThis.ERNMetaAnalysisEngine) return;

  let allEffects = [];
  let sourceName = '';
  let currentAnalysis = null;
  let currentForest = null;
  let validationErrorCount = 0;
  let independenceConfirmedByUser = false;

  const publicState = {
    analyses: [],
    pooledForests: [],
    sourceName: ''
  };
  globalThis.ERNMetaAnalysisState = publicState;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(value, digits = 3) {
    if (value === '' || value === null || value === undefined) return 'Not available';
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Not available';
    if (number !== 0 && Math.abs(number) < 0.001) return number.toExponential(2);
    return number.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatP(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Not available';
    if (number < 0.001) return '< .001';
    return `= ${number.toFixed(3).replace(/^0/, '')}`;
  }

  function safeFilename(value) {
    return String(value || 'meta-analysis')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'meta-analysis';
  }

  function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function setStatus(message, type = 'neutral') {
    status.textContent = message;
    status.className = `converter-status converter-status--${type}`;
  }

  function resetRenderedResults() {
    if (allResultsContainer) {
      allResultsContainer.innerHTML = '';
      allResultsContainer.hidden = true;
    }
    if (singleResultContainer) singleResultContainer.hidden = false;
  }

  function invalidateStoredAnalyses() {
    publicState.analyses = [];
    publicState.pooledForests = [];
    currentAnalysis = null;
    currentForest = null;
  }

  function groupByMetric(effects) {
    const groups = new Map();
    effects.forEach((effect) => {
      const metric = effect.effect_metric || 'Effect size';
      if (!groups.has(metric)) groups.set(metric, []);
      groups.get(metric).push(effect);
    });
    return groups;
  }

  function updateSettingsSummary() {
    const random = modelSelect.value === 'random';
    if (random) {
      const tauLabel = tauSelect.options[tauSelect.selectedIndex]?.textContent || 'REML';
      const inferenceLabel = inferenceSelect.value === 'auto' ? 'automatic inference' : inferenceSelect.options[inferenceSelect.selectedIndex]?.textContent;
      settingsSummary.textContent = `${tauLabel.split(' (')[0]} · ${inferenceLabel} · ${confidenceSelect.value}% confidence interval`;
      settingsNote.textContent = predictionSelect.value === 'auto'
        ? 'A prediction interval is shown automatically when at least five effects are available.'
        : predictionSelect.value === 'always'
          ? 'A prediction interval will be requested whenever at least three effects permit it; interpret estimates from fewer than five effects cautiously.'
          : 'Prediction intervals are disabled for this analysis.';
    } else {
      settingsSummary.textContent = `Common-effect inverse-variance model · Wald inference · ${confidenceSelect.value}% confidence interval`;
      settingsNote.textContent = 'Between-study variance estimation and prediction intervals do not apply to the common-effect model.';
    }

    const recommendedDefaults = random
      && tauSelect.value === 'REML'
      && inferenceSelect.value === 'auto'
      && confidenceSelect.value === '95'
      && predictionSelect.value === 'auto'
      && (!sensitivityCheckbox || !sensitivityCheckbox.checked);

    if (settingsState) {
      settingsState.textContent = recommendedDefaults ? 'Default settings' : 'Customized';
      settingsState.className = `meta-settings-state meta-settings-state--${recommendedDefaults ? 'recommended' : 'customized'}`;
    }
    if (settingsCard) settingsCard.classList.toggle('is-customized', !recommendedDefaults);
  }

  function updateModelControls() {
    const random = modelSelect.value === 'random';
    tauSelect.disabled = !random;
    inferenceSelect.disabled = !random;
    predictionSelect.disabled = !random;
    if (!random) {
      inferenceSelect.dataset.previousValue = inferenceSelect.value;
      inferenceSelect.value = 'wald';
    } else if (inferenceSelect.dataset.previousValue && inferenceSelect.value === 'wald') {
      inferenceSelect.value = inferenceSelect.dataset.previousValue;
      delete inferenceSelect.dataset.previousValue;
    }
    if (sensitivityCheckbox) sensitivityCheckbox.disabled = !random;
    updateSettingsSummary();
  }

  function effectsForMetric(metric = metricSelect.value) {
    return allEffects.filter((effect) => effect.effect_metric === metric);
  }

  function duplicateStudyLabels(effects) {
    const counts = new Map();
    effects.forEach((effect) => {
      const label = String(effect.study_id || '').trim();
      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([label, count]) => `${label} (${count})`);
  }

  function duplicateEffectIds(effects) {
    const counts = new Map();
    effects.forEach((effect) => {
      const id = String(effect.effect_id || '').trim();
      if (!id) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id, count]) => `${id} (${count})`);
  }

  function dependencyIssues(effects) {
    return {
      repeatedStudies: duplicateStudyLabels(effects),
      duplicateEffects: duplicateEffectIds(effects),
      blankStudyIds: effects.filter((effect) => !String(effect.study_id || '').trim()).length
    };
  }

  function hasDependencyIssues(issues) {
    return issues.repeatedStudies.length > 0 || issues.duplicateEffects.length > 0 || issues.blankStudyIds > 0;
  }

  function dependencyMessage(issues, prefix = '') {
    const parts = [];
    if (issues.repeatedStudies.length) parts.push(`repeated study labels: ${issues.repeatedStudies.join(', ')}`);
    if (issues.duplicateEffects.length) parts.push(`duplicate effect IDs: ${issues.duplicateEffects.join(', ')}`);
    if (issues.blankStudyIds) parts.push(`${issues.blankStudyIds} effect${issues.blankStudyIds === 1 ? '' : 's'} with a blank study_id`);
    return `${prefix}${parts.join('; ')}. Confirm independence only if the included estimates can genuinely be treated as independent.`;
  }

  function showIndependenceWarning(issues, prefix = '') {
    independenceBox.hidden = false;
    independenceCheckbox.checked = independenceConfirmedByUser;
    independenceText.textContent = dependencyMessage(issues, prefix);
  }

  function updateIndependenceWarning() {
    const issues = dependencyIssues(effectsForMetric());
    independenceConfirmedByUser = false;
    independenceCheckbox.checked = false;
    if (hasDependencyIssues(issues)) {
      showIndependenceWarning(issues);
    } else {
      independenceBox.hidden = true;
      independenceText.textContent = '';
    }
  }

  function populateMetrics() {
    const groups = groupByMetric(allEffects);
    const eligible = [...groups.entries()].filter(([, effects]) => effects.length >= 2);
    metricSelect.innerHTML = eligible.map(([metric, effects]) => `<option value="${escapeHtml(metric)}">${escapeHtml(metric)} (${effects.length} effects)</option>`).join('');
    if (!eligible.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    output.hidden = true;
    currentAnalysis = null;
    currentForest = null;
    resetRenderedResults();
    runButton.disabled = validationErrorCount > 0;
    runAllButton.disabled = validationErrorCount > 0;
    if (validationErrorCount > 0) {
      setStatus(`Fix ${validationErrorCount} validation error${validationErrorCount === 1 ? '' : 's'} in Step 2 before pooling. The Studio will not silently omit invalid rows.`, 'warning');
    } else {
      setStatus('Ready to run. Effects on different scales are analyzed separately.', 'neutral');
    }
    if (sensitivityDetails) sensitivityDetails.hidden = true;
    updateIndependenceWarning();
    updateModelControls();
  }

  function naturalSummary(analysis) {
    return {
      estimate: analysis.natural_estimate,
      lower: analysis.natural_ci_lower,
      upper: analysis.natural_ci_upper,
      predictionLower: analysis.natural_prediction_lower,
      predictionUpper: analysis.natural_prediction_upper
    };
  }

  function summaryGridMarkup(analysis) {
    const natural = naturalSummary(analysis);
    const heterogeneityCard = analysis.model === 'random'
      ? `<div class="meta-stat"><span>Heterogeneity (I²)</span><strong>${formatNumber(analysis.i2, 1)}%</strong></div>`
      : '';
    const predictionCard = analysis.prediction_lower === ''
      ? ''
      : `<div class="meta-stat meta-stat--wide"><span>${analysis.confidence_level}% prediction interval</span><strong>${formatNumber(natural.predictionLower)} to ${formatNumber(natural.predictionUpper)}</strong></div>`;
    return `
      <div class="meta-stat meta-stat--primary"><span>Pooled ${escapeHtml(analysis.natural_metric)}</span><strong>${formatNumber(natural.estimate)}</strong></div>
      <div class="meta-stat"><span>${analysis.confidence_level}% confidence interval</span><strong>${formatNumber(natural.lower)} to ${formatNumber(natural.upper)}</strong></div>
      <div class="meta-stat"><span>Effects</span><strong>${analysis.k}</strong></div>
      ${heterogeneityCard}
      ${predictionCard}`;
  }

  function resultBriefMarkup(analysis) {
    const note = String(analysis.heterogeneity_brief || '').trim();
    return note ? `<p class="meta-result-note">${escapeHtml(note)}</p>` : '';
  }

  function modelDescriptionMarkup(analysis) {
    const tauText = analysis.model === 'random' ? ` · ${escapeHtml(analysis.tau_estimator)}` : '';
    return `<strong>${escapeHtml(analysis.model_label)}</strong>${tauText} · ${escapeHtml(analysis.inference_label)}`;
  }

  function weightsRowsMarkup(analysis) {
    return analysis.weights.map((row) => `
      <tr>
        <td>${escapeHtml(row.study_id || 'N/A')}</td>
        <td>${escapeHtml(row.effect_id || 'N/A')}</td>
        <td class="numeric">${formatNumber(row.effect_size)}</td>
        <td class="numeric">${formatNumber(row.ci_lower)}</td>
        <td class="numeric">${formatNumber(row.ci_upper)}</td>
        <td class="numeric">${formatNumber(row.weight_percent, 1)}%</td>
      </tr>`).join('');
  }

  function detailGridMarkup(analysis) {
    const tauLabel = analysis.model === 'random'
      ? `Estimated between-study variance (${escapeHtml(analysis.tau_estimator)})`
      : 'Between-study variance';
    const tauValue = analysis.model === 'random'
      ? `τ² = ${formatNumber(analysis.tau2)}; τ = ${formatNumber(analysis.tau)}`
      : 'Not estimated in the common-effect model';
    const i2Value = analysis.model === 'random'
      ? `${formatNumber(analysis.i2, 1)}%`
      : `${formatNumber(analysis.q_i2, 1)}% (Q-based descriptive value)`;
    return `
      <div><span>${tauLabel}</span><strong>${tauValue}</strong></div>
      <div><span>I²</span><strong>${i2Value}</strong></div>
      <div><span>Cochran's Q</span><strong>Q(${analysis.q_df}) = ${formatNumber(analysis.q, 2)}, p ${escapeHtml(formatP(analysis.q_p_value))}</strong></div>
      <div class="meta-detail-wide meta-detail-explanation"><span>What this means</span><strong>${escapeHtml(analysis.heterogeneity_note || '')}</strong></div>
      <div class="meta-detail-wide"><span>Analysis decisions</span><strong>${escapeHtml(analysis.inference_reason || analysis.inference_label)} ${escapeHtml(analysis.prediction_note || '')}</strong></div>`;
  }

  function sensitivityMarkup(primary, sensitivity) {
    if (!sensitivity || primary.model !== 'random') return '';
    const primaryNatural = naturalSummary(primary);
    const sensitivityNatural = naturalSummary(sensitivity);
    return `
      <details class="result-detail">
        <summary>Common-effect sensitivity comparison</summary>
        <div class="result-detail-body">
          <div class="sensitivity-comparison">
            <div><span>Primary random-effects estimate</span><strong>${formatNumber(primaryNatural.estimate)} [${formatNumber(primaryNatural.lower)}, ${formatNumber(primaryNatural.upper)}]</strong></div>
            <div><span>Common-effect estimate</span><strong>${formatNumber(sensitivityNatural.estimate)} [${formatNumber(sensitivityNatural.lower)}, ${formatNumber(sensitivityNatural.upper)}]</strong></div>
          </div>
          <p class="muted">This is a sensitivity comparison, not a model-selection test. Interpret differences in light of the research question and the assumptions of each model.</p>
        </div>
      </details>`;
  }

  function completeResultMarkup(view, index, total) {
    const analysis = view.primary;
    return `
      <article class="meta-complete-result" aria-labelledby="meta-complete-result-${index}">
        <div class="meta-complete-result-heading">
          <div>
            <p class="eyebrow">Metric-specific result ${index + 1} of ${total}</p>
            <h4 id="meta-complete-result-${index}">${escapeHtml(analysis.metric)} meta-analysis</h4>
            <p class="muted">${modelDescriptionMarkup(analysis)}</p>
          </div>
        </div>

        <div class="meta-summary-grid">${summaryGridMarkup(analysis)}</div>
        ${resultBriefMarkup(analysis)}

        <article class="forest-card meta-pooled-forest">
          <div class="forest-card-head">
            <div>
              <h3>${escapeHtml(analysis.metric)} pooled forest plot</h3>
              <p class="muted">Study weights reflect this metric-specific model. The diamond shows the pooled confidence interval; a prediction interval is shown when requested and supported.</p>
            </div>
          </div>
          <div class="forest-svg-wrap">${view.svg}</div>
        </article>

        <div class="meta-result-details">
          ${sensitivityMarkup(analysis, view.sensitivity)}
          <details class="result-detail">
            <summary>Statistical details</summary>
            <div class="result-detail-body">
              <div class="meta-detail-grid">${detailGridMarkup(analysis)}</div>
              <div class="meta-weight-table meta-weight-table--nested">
                <h3>Study weights and model data</h3>
                <p class="muted">Weights sum to 100% within this metric-specific model.</p>
                <div class="table-wrap" tabindex="0" aria-label="${escapeHtml(analysis.metric)} meta-analysis study weights">
                  <table class="results-table">
                    <thead><tr><th>Study</th><th>Effect ID</th><th>Effect</th><th>CI low</th><th>CI high</th><th>Weight</th></tr></thead>
                    <tbody>${weightsRowsMarkup(analysis)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
          <details class="result-detail">
            <summary>Suggested reporting text</summary>
            <div class="result-detail-body meta-reporting-grid">
              <article class="meta-report-card">
                <div class="meta-report-head"><h3>Suggested methods text</h3><button class="btn btn-quiet btn-sm meta-all-copy-methods" data-result-index="${index}" type="button">Copy</button></div>
                <p>${escapeHtml(analysis.methods_text)}</p>
              </article>
              <article class="meta-report-card">
                <div class="meta-report-head"><h3>Suggested results text</h3><button class="btn btn-quiet btn-sm meta-all-copy-results" data-result-index="${index}" type="button">Copy</button></div>
                <p>${escapeHtml(analysis.results_text)}</p>
              </article>
            </div>
          </details>
          <details class="result-detail">
            <summary>More downloads</summary>
            <div class="result-detail-body converter-export-actions">
              <button class="btn btn-outline btn-sm meta-all-download-model" data-result-index="${index}" type="button">Download model CSV</button>
              <button class="btn btn-outline btn-sm meta-all-download-forest" data-result-index="${index}" type="button">Download pooled SVG</button>
            </div>
          </details>
        </div>
      </article>`;
  }

  function renderAllAnalyses(results, selectedMetric) {
    if (!allResultsContainer) return;
    if (singleResultContainer) singleResultContainer.hidden = true;
    allResultsContainer.hidden = false;
    allResultsContainer.innerHTML = `
      <div class="meta-output-heading meta-all-results-heading">
        <div>
          <p class="eyebrow">Step 4</p>
          <h3>Review all metric-specific results</h3>
          <p class="muted">All ${results.length} completed models are shown below. Open the detail sections only when you need the underlying statistics or additional downloads.</p>
        </div>
        <div class="converter-export-actions">
          <button class="btn btn-primary btn-sm meta-all-download-workbook" type="button">Download full workbook</button>
        </div>
      </div>
      <div class="meta-all-results-list">
        ${results.map((view, index) => completeResultMarkup(view, index, results.length)).join('')}
      </div>`;

    const selected = results.find((view) => view.primary.metric === selectedMetric) || results[0];
    currentAnalysis = selected.primary;
    currentForest = { metric: `${selected.primary.metric} pooled`, svg: selected.svg, kind: 'pooled' };
    metricSelect.value = selected.primary.metric;
    output.hidden = false;

    allResultsContainer.querySelectorAll('.meta-all-download-workbook').forEach((button) => {
      button.addEventListener('click', () => document.getElementById('download-workbook')?.click());
    });
    allResultsContainer.querySelectorAll('.meta-all-download-model').forEach((button) => {
      button.addEventListener('click', () => downloadModelResultsFor(results[Number(button.dataset.resultIndex)].primary));
    });
    allResultsContainer.querySelectorAll('.meta-all-download-forest').forEach((button) => {
      button.addEventListener('click', () => {
        const view = results[Number(button.dataset.resultIndex)];
        downloadForestFor(view.primary, view.svg);
      });
    });
    allResultsContainer.querySelectorAll('.meta-all-copy-methods').forEach((button) => {
      button.addEventListener('click', () => copyText(results[Number(button.dataset.resultIndex)].primary.methods_text, button));
    });
    allResultsContainer.querySelectorAll('.meta-all-copy-results').forEach((button) => {
      button.addEventListener('click', () => copyText(results[Number(button.dataset.resultIndex)].primary.results_text, button));
    });
  }

  function niceTickStep(span, targetTicks = 6) {
    if (!Number.isFinite(span) || span <= 0) return 1;
    const raw = span / targetTicks;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    let nice = 1;
    if (fraction >= 5) nice = 5;
    else if (fraction >= 2) nice = 2;
    return nice * power;
  }

  function plotNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    if (Math.abs(number) >= 100 || (Math.abs(number) > 0 && Math.abs(number) < 0.01)) return number.toExponential(2);
    return number.toFixed(Math.abs(number) < 1 ? 2 : 1).replace(/\.0$/, '');
  }

  function shortLabel(row) {
    const label = [row.study_id, row.effect_id].filter(Boolean).join(' · ') || 'Unnamed effect';
    return label.length > 47 ? `${label.slice(0, 44)}…` : label;
  }

  function analysisScaleLabel(metric) {
    if (/^Log .+ ratio$/i.test(metric)) return `${metric} (analysis scale; null = 0)`;
    if (metric === 'Fisher z') return 'Fisher z (analysis scale; null = 0)';
    return `${metric} (null = 0)`;
  }

  function buildPooledForestSvg(analysis) {
    const rows = analysis.weights;
    const width = 1240;
    const plotLeft = 370;
    const plotRight = 835;
    const weightX = 875;
    const valueX = 970;
    const top = 75;
    const rowHeight = 42;
    const pooledY = top + (rows.length * rowHeight) + 20;
    const predictionY = pooledY + 40;
    const axisY = predictionY + (analysis.prediction_lower === '' ? 10 : 35);
    const height = axisY + 80;

    const limits = rows.flatMap((row) => [row.ci_lower, row.ci_upper]);
    limits.push(analysis.ci_lower, analysis.ci_upper, 0);
    if (analysis.prediction_lower !== '') limits.push(analysis.prediction_lower, analysis.prediction_upper);
    let domainMin = Math.min(...limits);
    let domainMax = Math.max(...limits);
    if (domainMin === domainMax) { domainMin -= 1; domainMax += 1; }
    const originalSpan = domainMax - domainMin;
    domainMin -= originalSpan * 0.08;
    domainMax += originalSpan * 0.08;
    const span = domainMax - domainMin;
    const xScale = (value) => plotLeft + (((value - domainMin) / span) * (plotRight - plotLeft));

    const tickStep = niceTickStep(span);
    const firstTick = Math.ceil(domainMin / tickStep) * tickStep;
    const ticks = [];
    for (let tick = firstTick; tick <= domainMax + (tickStep * 0.001); tick += tickStep) {
      ticks.push(Number(tick.toFixed(10)));
      if (ticks.length > 20) break;
    }

    const maxWeight = Math.max(...rows.map((row) => row.weight_percent));
    const minWeight = Math.min(...rows.map((row) => row.weight_percent));
    const squareSize = (weight) => {
      if (maxWeight === minWeight) return 12;
      const scaled = (Math.sqrt(weight) - Math.sqrt(minWeight)) / (Math.sqrt(maxWeight) - Math.sqrt(minWeight));
      return 8 + (12 * scaled);
    };

    const grid = ticks.map((tick) => `<line x1="${xScale(tick).toFixed(2)}" y1="52" x2="${xScale(tick).toFixed(2)}" y2="${axisY}" stroke="#d9e1ec" stroke-width="1"/>`).join('');
    const studyRows = rows.map((row, index) => {
      const y = top + (index * rowHeight);
      const low = xScale(row.ci_lower);
      const high = xScale(row.ci_upper);
      const estimate = xScale(row.effect_size);
      const size = squareSize(row.weight_percent);
      return `
        <text x="18" y="${y + 5}" font-family="Arial, sans-serif" font-size="14" fill="#26364c">${escapeHtml(shortLabel(row))}</text>
        <line x1="${low.toFixed(2)}" y1="${y}" x2="${high.toFixed(2)}" y2="${y}" stroke="#2b5d8f" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="${low.toFixed(2)}" y1="${y - 5}" x2="${low.toFixed(2)}" y2="${y + 5}" stroke="#2b5d8f" stroke-width="1.3"/>
        <line x1="${high.toFixed(2)}" y1="${y - 5}" x2="${high.toFixed(2)}" y2="${y + 5}" stroke="#2b5d8f" stroke-width="1.3"/>
        <rect x="${(estimate - (size / 2)).toFixed(2)}" y="${(y - (size / 2)).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" rx="1.5" fill="#1d3557"/>
        <text x="${weightX}" y="${y + 5}" font-family="Arial, sans-serif" font-size="13" fill="#40516a">${formatNumber(row.weight_percent, 1)}%</text>
        <text x="${valueX}" y="${y + 5}" font-family="Arial, sans-serif" font-size="13" fill="#40516a">${plotNumber(row.effect_size)} [${plotNumber(row.ci_lower)}, ${plotNumber(row.ci_upper)}]</text>`;
    }).join('');

    const center = xScale(analysis.estimate);
    const pooledLow = xScale(analysis.ci_lower);
    const pooledHigh = xScale(analysis.ci_upper);
    const diamondHeight = 12;
    const diamond = `<polygon points="${pooledLow.toFixed(2)},${pooledY} ${center.toFixed(2)},${pooledY - diamondHeight} ${pooledHigh.toFixed(2)},${pooledY} ${center.toFixed(2)},${pooledY + diamondHeight}" fill="#00a7c7" stroke="#14617a" stroke-width="1.5"/>`;
    const prediction = analysis.prediction_lower === '' ? '' : `
      <text x="18" y="${predictionY + 5}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#40516a">${analysis.confidence_level}% prediction interval</text>
      <line x1="${xScale(analysis.prediction_lower).toFixed(2)}" y1="${predictionY}" x2="${xScale(analysis.prediction_upper).toFixed(2)}" y2="${predictionY}" stroke="#00a7c7" stroke-width="4" stroke-linecap="round"/>
      <line x1="${xScale(analysis.prediction_lower).toFixed(2)}" y1="${predictionY - 6}" x2="${xScale(analysis.prediction_lower).toFixed(2)}" y2="${predictionY + 6}" stroke="#14617a" stroke-width="2"/>
      <line x1="${xScale(analysis.prediction_upper).toFixed(2)}" y1="${predictionY - 6}" x2="${xScale(analysis.prediction_upper).toFixed(2)}" y2="${predictionY + 6}" stroke="#14617a" stroke-width="2"/>
      <text x="${valueX}" y="${predictionY + 5}" font-family="Arial, sans-serif" font-size="13" fill="#40516a">[${plotNumber(analysis.prediction_lower)}, ${plotNumber(analysis.prediction_upper)}]</text>`;

    const tickLabels = ticks.map((tick) => `<line x1="${xScale(tick).toFixed(2)}" y1="${axisY}" x2="${xScale(tick).toFixed(2)}" y2="${axisY + 6}" stroke="#51647d"/><text x="${xScale(tick).toFixed(2)}" y="${axisY + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#51647d">${escapeHtml(plotNumber(tick))}</text>`).join('');

    return `<svg class="forest-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pooled forest plot for ${escapeHtml(analysis.metric)}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="18" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#1d3557">${escapeHtml(analysis.metric)}: ${escapeHtml(analysis.model_label)}</text>
      <text x="18" y="46" font-family="Arial, sans-serif" font-size="12" fill="#596a80">${escapeHtml(analysis.inference_label)} · ${analysis.confidence_level}% intervals</text>
      <text x="${weightX}" y="46" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#274f82">WEIGHT</text>
      <text x="${valueX}" y="46" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#274f82">ESTIMATE [CI]</text>
      ${grid}
      <line x1="${xScale(0).toFixed(2)}" y1="52" x2="${xScale(0).toFixed(2)}" y2="${axisY}" stroke="#8292a7" stroke-width="2" stroke-dasharray="5 5"/>
      ${studyRows}
      <line x1="18" y1="${pooledY - 22}" x2="${width - 20}" y2="${pooledY - 22}" stroke="#d7e0eb"/>
      <text x="18" y="${pooledY + 5}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#1d3557">Pooled effect</text>
      ${diamond}
      <text x="${weightX}" y="${pooledY + 5}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1d3557">100%</text>
      <text x="${valueX}" y="${pooledY + 5}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1d3557">${plotNumber(analysis.estimate)} [${plotNumber(analysis.ci_lower)}, ${plotNumber(analysis.ci_upper)}]</text>
      ${prediction}
      <line x1="${plotLeft}" y1="${axisY}" x2="${plotRight}" y2="${axisY}" stroke="#51647d" stroke-width="1.5"/>
      ${tickLabels}
      <text x="${((plotLeft + plotRight) / 2).toFixed(2)}" y="${axisY + 53}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#26364c">${escapeHtml(analysisScaleLabel(analysis.metric))}</text>
    </svg>`;
  }

  function storeAnalysis(analysis, svg) {
    const role = analysis.analysis_role || 'primary';
    const key = `${analysis.metric}::${role}`;
    publicState.analyses = publicState.analyses.filter((item) => `${item.metric}::${item.analysis_role || 'primary'}` !== key);
    publicState.analyses.push(analysis);
    publicState.pooledForests = publicState.pooledForests.filter((item) => item.key !== key);
    publicState.pooledForests.push({ key, metric: `${analysis.metric} pooled${role === 'sensitivity' ? ' : common-effect sensitivity' : ''}`, svg, kind: role === 'sensitivity' ? 'sensitivity' : 'pooled' });
  }

  function renderSensitivity(primary, sensitivity) {
    if (!sensitivityDetails || !sensitivityBody) return;
    if (!sensitivity || primary.model !== 'random') {
      sensitivityDetails.hidden = true;
      sensitivityBody.innerHTML = '';
      return;
    }
    const primaryNatural = naturalSummary(primary);
    const sensitivityNatural = naturalSummary(sensitivity);
    sensitivityBody.innerHTML = `
      <div class="sensitivity-comparison">
        <div><span>Primary random-effects estimate</span><strong>${formatNumber(primaryNatural.estimate)} [${formatNumber(primaryNatural.lower)}, ${formatNumber(primaryNatural.upper)}]</strong></div>
        <div><span>Common-effect estimate</span><strong>${formatNumber(sensitivityNatural.estimate)} [${formatNumber(sensitivityNatural.lower)}, ${formatNumber(sensitivityNatural.upper)}]</strong></div>
      </div>
      <p class="muted">This is a sensitivity comparison, not a model-selection test. Interpret differences in light of the research question and the assumptions of each model.</p>`;
    sensitivityDetails.hidden = false;
  }

  function renderAnalysis(analysis, svg, sensitivity = null) {
    if (allResultsContainer) allResultsContainer.hidden = true;
    if (singleResultContainer) singleResultContainer.hidden = false;
    summaryGrid.innerHTML = summaryGridMarkup(analysis);
    if (resultNote) {
      const brief = String(analysis.heterogeneity_brief || '').trim();
      resultNote.textContent = brief;
      resultNote.hidden = !brief;
    }
    modelDescription.innerHTML = modelDescriptionMarkup(analysis);
    weightsBody.innerHTML = weightsRowsMarkup(analysis);
    forestContainer.innerHTML = svg;
    methodsText.textContent = analysis.methods_text;
    resultsText.textContent = analysis.results_text;
    if (detailGrid) detailGrid.innerHTML = detailGridMarkup(analysis);
    renderSensitivity(analysis, sensitivity);
    output.hidden = false;
    currentAnalysis = analysis;
    currentForest = { metric: `${analysis.metric} pooled`, svg, kind: 'pooled' };
    storeAnalysis(analysis, svg);
  }

  function runMetric(metric, render = true) {
    if (validationErrorCount > 0) {
      throw new Error(`Fix ${validationErrorCount} validation error${validationErrorCount === 1 ? '' : 's'} before pooling. Invalid rows are never silently omitted.`);
    }
    const effects = effectsForMetric(metric);
    const issues = dependencyIssues(effects);
    if (hasDependencyIssues(issues) && !independenceConfirmedByUser) {
      showIndependenceWarning(issues);
      throw new Error('Review the dependency warning and confirm independence before fitting this inverse-variance model.');
    }
    const options = {
      model: modelSelect.value,
      tauEstimator: tauSelect.value,
      inference: inferenceSelect.value,
      confidenceLevel: Number(confidenceSelect.value),
      predictionInterval: predictionSelect.value
    };
    const analysis = globalThis.ERNMetaAnalysisEngine.analyze(effects, options);
    analysis.analysis_role = 'primary';
    const svg = buildPooledForestSvg(analysis);

    let sensitivity = null;
    let sensitivitySvg = null;
    if (analysis.model === 'random' && sensitivityCheckbox && sensitivityCheckbox.checked) {
      sensitivity = globalThis.ERNMetaAnalysisEngine.analyze(effects, {
        model: 'fixed', tauEstimator: 'REML', inference: 'wald',
        confidenceLevel: Number(confidenceSelect.value), predictionInterval: 'off'
      });
      sensitivity.analysis_role = 'sensitivity';
      sensitivity.sensitivity_for = analysis.metric;
      sensitivitySvg = buildPooledForestSvg(sensitivity);
      storeAnalysis(sensitivity, sensitivitySvg);
    }

    if (render) renderAnalysis(analysis, svg, sensitivity);
    else storeAnalysis(analysis, svg);
    return { primary: analysis, sensitivity, svg, sensitivitySvg };
  }

  function runSelected() {
    try {
      setStatus('Running inverse-variance model…', 'neutral');
      const result = runMetric(metricSelect.value, true);
      const analysis = result.primary;
      const autoLabel = analysis.requested_inference === 'auto' ? `; ${analysis.inference_label} selected automatically` : '';
      setStatus(`${analysis.model_label}${analysis.model === 'random' ? ` (${analysis.tau_estimator})` : ''} completed for ${analysis.metric}${autoLabel}.`, 'success');
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function runAll() {
    try {
      if (validationErrorCount > 0) {
        throw new Error(`Fix ${validationErrorCount} validation error${validationErrorCount === 1 ? '' : 's'} before pooling. Invalid rows are never silently omitted.`);
      }
      const groups = groupByMetric(allEffects);
      const eligible = [...groups.entries()].filter(([, effects]) => effects.length >= 2);
      if (!eligible.length) throw new Error('No metric has at least two valid effects.');
      const issueGroups = eligible.map(([metric, effects]) => [metric, dependencyIssues(effects)]).filter(([, issues]) => hasDependencyIssues(issues));
      if (issueGroups.length && !independenceConfirmedByUser) {
        const combined = {
          repeatedStudies: issueGroups.flatMap(([metric, issues]) => issues.repeatedStudies.map((item) => `${metric}: ${item}`)),
          duplicateEffects: issueGroups.flatMap(([metric, issues]) => issues.duplicateEffects.map((item) => `${metric}: ${item}`)),
          blankStudyIds: issueGroups.reduce((total, [, issues]) => total + issues.blankStudyIds, 0)
        };
        showIndependenceWarning(combined, 'Across the models to be run, the Studio detected ');
        throw new Error('Review the dependency warning and confirm independence before running all models.');
      }
      setStatus(`Running ${eligible.length} metric-specific model${eligible.length === 1 ? '' : 's'}…`, 'neutral');
      const completedResults = eligible.map(([metric]) => runMetric(metric, false));
      renderAllAnalyses(completedResults, metricSelect.value);
      setStatus(`${eligible.length} metric-specific model${eligible.length === 1 ? '' : 's'} completed. Results are ready in Step 4 and in the publication workbook.`, 'success');
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  function downloadTextFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function downloadForestFor(analysis, svg) {
    if (!analysis || !svg) return;
    downloadTextFile(svg, `ern-pooled-forest-${safeFilename(analysis.metric)}.svg`, 'image/svg+xml;charset=utf-8');
  }

  function downloadForest() {
    if (!currentAnalysis || !currentForest) return;
    downloadForestFor(currentAnalysis, currentForest.svg);
  }

  function downloadModelResultsFor(analysis) {
    if (!analysis) return;
    const modelHeaders = ['metric', 'model', 'tau_estimator', 'inference', 'confidence_level', 'k', 'estimate', 'standard_error', 'ci_lower', 'ci_upper', 'p_value', 'q', 'q_df', 'q_p_value', 'q_i2', 'q_h2', 'i2', 'h2', 'tau2', 'tau_boundary', 'typical_within_variance', 'heterogeneity_note', 'prediction_lower', 'prediction_upper', 'prediction_note'];
    const lines = [modelHeaders.join(','), modelHeaders.map((header) => csvEscape(analysis[header])).join(','), '', 'study_id,effect_id,effect_size,sampling_variance,ci_lower,ci_upper,model_weight,weight_percent'];
    analysis.weights.forEach((row) => lines.push(['study_id', 'effect_id', 'effect_size', 'sampling_variance', 'ci_lower', 'ci_upper', 'model_weight', 'weight_percent'].map((header) => csvEscape(row[header])).join(',')));
    downloadTextFile(lines.join('\r\n'), `ern-meta-analysis-${safeFilename(analysis.metric)}.csv`, 'text/csv;charset=utf-8');
  }

  function downloadModelResults() {
    downloadModelResultsFor(currentAnalysis);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = original; }, 1300);
    } catch (error) {
      setStatus('The browser could not copy the text automatically. Select and copy it manually.', 'warning');
    }
  }

  window.addEventListener('ern:effect-results', (event) => {
    allEffects = event.detail?.results || [];
    sourceName = event.detail?.sourceName || '';
    validationErrorCount = (event.detail?.validationItems || []).filter((item) => item.severity === 'error').length;
    independenceConfirmedByUser = false;
    independenceCheckbox.checked = false;
    publicState.sourceName = sourceName;
    invalidateStoredAnalyses();
    populateMetrics();
  });

  independenceCheckbox.addEventListener('change', () => {
    independenceConfirmedByUser = !independenceBox.hidden && independenceCheckbox.checked;
  });

  modelSelect.addEventListener('change', () => {
    invalidateStoredAnalyses();
    updateModelControls();
    output.hidden = true;
    resetRenderedResults();
    setStatus('Model updated. Run the analysis to refresh results.', 'neutral');
  });
  [tauSelect, inferenceSelect, confidenceSelect, predictionSelect, sensitivityCheckbox].filter(Boolean).forEach((control) => {
    control.addEventListener('change', () => {
      invalidateStoredAnalyses();
      updateSettingsSummary();
      output.hidden = true;
      resetRenderedResults();
      setStatus('Advanced settings updated. Previous fitted models were cleared; run the analysis again.', 'neutral');
    });
  });
  metricSelect.addEventListener('change', () => {
    updateIndependenceWarning();
    output.hidden = true;
    resetRenderedResults();
    if (sensitivityDetails) sensitivityDetails.hidden = true;
    setStatus('Metric updated. Run the analysis to calculate the model.', 'neutral');
  });
  runButton.addEventListener('click', runSelected);
  runAllButton.addEventListener('click', runAll);
  downloadForestButton.addEventListener('click', downloadForest);
  downloadModelButton.addEventListener('click', downloadModelResults);
  if (workbookResultsButton) {
    workbookResultsButton.addEventListener('click', () => document.getElementById('download-workbook')?.click());
  }
  copyMethodsButton.addEventListener('click', () => copyText(methodsText.textContent, copyMethodsButton));
  copyResultsButton.addEventListener('click', () => copyText(resultsText.textContent, copyResultsButton));
  updateModelControls();
})();
