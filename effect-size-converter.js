(() => {
  'use strict';

  const getElement = (id) => typeof document !== 'undefined' ? document.getElementById(id) : null;

  const fileInput = getElement('effect-file');
  const dropZone = getElement('drop-zone');
  const exampleButton = getElement('load-example');
  const clearButton = getElement('clear-converter');
  const statusBox = getElement('converter-status');
  const uploadConfirmation = getElement('upload-confirmation');
  const uploadConfirmationDetail = getElement('upload-confirmation-detail');
  const dropZoneTitle = getElement('drop-zone-title');
  const dropZoneHint = getElement('drop-zone-hint');
  const resultsSection = getElement('converter-results');
  const issuesSection = getElement('converter-issues');
  const issuesList = getElement('issues-list');
  const resultsBody = getElement('results-body');
  const resultSummary = getElement('result-summary');
  const downloadButton = getElement('download-results');
  const workbookButton = getElement('download-workbook');
  const validationSummary = getElement('validation-summary');
  const forestSection = getElement('converter-forest');
  const forestPlots = getElement('forest-plots');
  const reviewStatus = getElement('review-status');


  let latestResults = [];
  let latestForestSvgs = [];
  let latestRecords = [];
  let latestHeaders = [];
  let latestValidationItems = [];
  let latestSourceName = '';

  const exampleCsv = `study_id,effect_id,calculation_type,mean1,sd1,n1,mean2,sd2,n2,t_value,f_value,f_df1,f_df2,f_direction,r_value,n,events1,total1,events2,total2,reverse_sign,notes
Demo Study A (2018),SMD-01,independent_means,54.2,9.1,48,49.6,8.7,50,,,,,,,,,,,,no,Attention composite
Demo Study B (2019),SMD-02,independent_means,31.4,5.8,36,28.1,6.2,38,,,,,,,,,,,,no,Working-memory accuracy
Demo Study C (2020),SMD-03,independent_t,,,44,,,46,2.18,,,,,,,,,,,no,Student independent-groups t statistic
Demo Study D (2021),SMD-04,independent_t,,,57,,,55,1.62,,,,,,,,,,,no,Student independent-groups t statistic
Demo Study E (2022),SMD-F01,independent_f,,,50,,,52,,3.61,1,100,group1_higher,,,,,,,no,Two-group between-subjects F statistic
Demo Study F (2023),SMD-F02,independent_f,,,45,,,47,,2.25,1,90,group2_higher,,,,,,,no,Two-group between-subjects F statistic
Demo Study G (2024),SMD-05,independent_means,67.8,10.2,64,62.9,9.7,61,,,,,,,,,,,,no,Executive-function composite
Demo Study H (2025),SMD-06,independent_means,14.8,3.9,30,16.2,4.1,32,,,,,,,,,,,,yes,Lower scores indicate better performance
Demo Study I (2019),R-01,correlation,,,,,,,,,,,,0.21,82,,,,,no,Experience and cognitive flexibility
Demo Study J (2021),R-02,correlation,,,,,,,,,,,,0.34,116,,,,,no,Training dose and transfer
Demo Study K (2024),R-03,correlation,,,,,,,,,,,,-0.18,74,,,,,yes,Direction reversed for consistency
Demo Study L (2020),OR-01,binary,,,,,,,,,,,,,,18,60,9,58,no,Improvement event by group
Demo Study M (2022),OR-02,binary,,,,,,,,,,,,,,27,90,19,88,no,Improvement event by group
Demo Study N (2024),OR-03,binary,,,,,,,,,,,,,,15,70,10,72,no,Improvement event by group`;

  class ValidationError extends Error {
    constructor({ code, column, enteredValue, message, fix, severity = 'error' }) {
      super(message);
      this.name = 'ValidationError';
      this.code = code || 'VALIDATION_ERROR';
      this.column = column || '';
      this.enteredValue = enteredValue ?? '';
      this.fix = fix || '';
      this.severity = severity;
    }
  }

  function validationError(record, details) {
    const column = details.column || '';
    const enteredValue = details.enteredValue !== undefined ? details.enteredValue : (column ? (record[column] ?? '') : '');
    throw new ValidationError({ ...details, column, enteredValue });
  }

  function issueFromError(record, error) {
    const structured = error instanceof ValidationError;
    return {
      row: record.__row,
      study_id: record.study_id || '',
      effect_id: record.effect_id || '',
      severity: structured ? error.severity : 'error',
      column: structured ? error.column : '',
      entered_value: structured ? error.enteredValue : '',
      code: structured ? error.code : 'CALCULATION_ERROR',
      message: error.message || 'The row could not be calculated.',
      fix: structured ? error.fix : 'Review the row against the ERN template and calculation definitions.'
    };
  }

  function setStatus(message, type = 'neutral') {
    statusBox.textContent = message;
    statusBox.className = `converter-status converter-status--${type}`;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resetUploadConfirmation() {
    dropZone.classList.remove('is-uploaded');
    if (dropZoneTitle) dropZoneTitle.textContent = 'Choose a CSV or drop it here';
    if (dropZoneHint) dropZoneHint.textContent = 'Maximum file size: 5 MB';
    if (exampleButton) exampleButton.textContent = 'Try built-in example';
    if (uploadConfirmation) uploadConfirmation.hidden = true;
    if (uploadConfirmationDetail) uploadConfirmationDetail.textContent = '';
  }

  function showUploadConfirmation(file) {
    dropZone.classList.add('is-uploaded');
    if (dropZoneTitle) dropZoneTitle.textContent = `${file.name} is ready`;
    if (dropZoneHint) dropZoneHint.textContent = 'Choose another file or drop it here to replace this one';
    if (exampleButton) exampleButton.textContent = 'Replace with built-in example';
    if (uploadConfirmationDetail) {
      uploadConfirmationDetail.textContent = `${file.name} (${formatFileSize(file.size)}) was loaded and processed locally in your browser. No data were sent to ERN. Step 2 now contains the automatically calculated effect sizes, validation report, and unpooled forest plots; review them before configuring Step 3.`;
    }
    if (uploadConfirmation) uploadConfirmation.hidden = false;
  }

  function normalizeHeader(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const tabs = (firstLine.match(/\t/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
  }

  function parseDelimited(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i += 1;
        row.push(field);
        if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    row.push(field);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);

    if (quoted) throw new Error('The file contains an unclosed quoted field.');
    if (rows.length < 2) throw new Error('The file must include a header row and at least one data row.');

    const headers = rows[0].map(normalizeHeader);
    const nonEmptyHeaders = headers.filter(Boolean);
    const duplicates = [...new Set(nonEmptyHeaders.filter((header, index) => nonEmptyHeaders.indexOf(header) !== index))];
    if (duplicates.length) {
      throw new Error(`Duplicate column name${duplicates.length === 1 ? '' : 's'} after normalization: ${duplicates.join(', ')}. Rename duplicate columns before loading the file.`);
    }
    if (!headers.includes('calculation_type')) {
      throw new Error('Missing required column: calculation_type. Start with the ERN template.');
    }

    rows.slice(1).forEach((cells, index) => {
      const rowNumber = index + 2;
      const extraValues = cells.slice(headers.length).filter((cell) => String(cell ?? '').trim() !== '');
      if (extraValues.length) {
        throw new Error(`Row ${rowNumber} contains more populated fields than the header row. Check for an extra delimiter or a missing column name.`);
      }
      const unnamedColumns = headers
        .map((header, columnIndex) => (!header && String(cells[columnIndex] ?? '').trim() !== '' ? columnIndex + 1 : null))
        .filter((columnIndex) => columnIndex !== null);
      if (unnamedColumns.length) {
        throw new Error(`Row ${rowNumber} contains data in unnamed column${unnamedColumns.length === 1 ? '' : 's'} ${unnamedColumns.join(', ')}. Add a column name or remove the stray value before loading the file.`);
      }
    });

    const records = rows.slice(1).map((cells, index) => {
      const record = { __row: index + 2 };
      headers.forEach((header, columnIndex) => {
        if (header) record[header] = String(cells[columnIndex] ?? '').trim();
      });
      return record;
    });
    return { records, headers };
  }

  function numberValue(record, key, label, options = {}) {
    const raw = record[key];
    const type = normalizeType(record.calculation_type || 'this calculation');
    if (raw === undefined || raw === '') {
      validationError(record, {
        code: 'MISSING_REQUIRED_VALUE', column: key,
        message: `${label} is required for ${type}.`,
        fix: `Enter the required ${label} value, or change calculation_type if this row uses a different design.`
      });
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      validationError(record, { code: 'NON_NUMERIC_VALUE', column: key, message: `${label} must be numeric; “${raw}” cannot be interpreted as a number.`, fix: `Replace the value in ${key} with a number and do not include units or symbols.` });
    }
    if (options.integer && !Number.isInteger(value)) {
      validationError(record, { code: 'WHOLE_NUMBER_REQUIRED', column: key, message: `${label} must be a whole number; ${raw} is not valid.`, fix: `Enter an integer in ${key}.` });
    }
    if (options.minExclusive !== undefined && value <= options.minExclusive) {
      validationError(record, { code: 'VALUE_BELOW_ALLOWED_RANGE', column: key, message: `${label} must be greater than ${options.minExclusive}; the entered value is ${raw}.`, fix: `Correct ${key} or verify that the selected calculation_type is appropriate.` });
    }
    if (options.minInclusive !== undefined && value < options.minInclusive) {
      validationError(record, { code: 'VALUE_BELOW_ALLOWED_RANGE', column: key, message: `${label} must be at least ${options.minInclusive}; the entered value is ${raw}.`, fix: `Correct ${key} or verify that the selected calculation_type is appropriate.` });
    }
    if (options.maxInclusive !== undefined && value > options.maxInclusive) {
      validationError(record, { code: 'VALUE_ABOVE_ALLOWED_RANGE', column: key, message: `${label} must be no greater than ${options.maxInclusive}; the entered value is ${raw}.`, fix: `Correct ${key} or verify that the selected calculation_type is appropriate.` });
    }
    return value;
  }

  function shouldReverse(value) {
    return ['yes', 'y', 'true', '1', 'reverse'].includes(String(value || '').trim().toLowerCase());
  }

  function validateReverseSign(record) {
    const raw = String(record.reverse_sign || '').trim().toLowerCase();
    if (!raw) return;
    const valid = new Set(['yes', 'y', 'true', '1', 'reverse', 'no', 'n', 'false', '0', 'keep']);
    if (!valid.has(raw)) {
      validationError(record, {
        code: 'INVALID_REVERSE_SIGN', column: 'reverse_sign', enteredValue: record.reverse_sign,
        message: `reverse_sign must clearly indicate yes or no; “${record.reverse_sign}” is not recognized.`,
        fix: 'Use yes/no (or y/n, true/false, 1/0). The Studio will not guess a direction.'
      });
    }
  }

  function normalizeMetricName(value) {
    const raw = String(value || '').trim();
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const aliases = {
      'hedges g': 'Hedges g',
      'smd': 'Hedges g',
      'fisher z': 'Fisher z',
      'zcor': 'Fisher z',
      'log odds ratio': 'Log odds ratio',
      'lor': 'Log odds ratio',
      'log risk ratio': 'Log risk ratio',
      'log rr': 'Log risk ratio',
      'log relative risk': 'Log risk ratio',
      'log hazard ratio': 'Log hazard ratio',
      'log hr': 'Log hazard ratio',
      'log rate ratio': 'Log rate ratio',
      'log irr': 'Log rate ratio'
    };
    return aliases[key] || raw;
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

  function correctionJ(df) {
    // Exact Hedges bias correction, matching metafor's default correction.
    return Math.exp(logGamma(df / 2) - (0.5 * Math.log(df / 2)) - logGamma((df - 1) / 2));
  }

  function baseResult(record, metric, effect, variance, naturalMetric = '', naturalEffect = '') {
    const se = Math.sqrt(variance);
    return {
      source_row: record.__row || '',
      study_id: record.study_id || '',
      effect_id: record.effect_id || '',
      calculation_type: normalizeType(record.calculation_type),
      effect_metric: metric,
      effect_size: effect,
      sampling_variance: variance,
      standard_error: se,
      ci_lower: effect - (1.96 * se),
      ci_upper: effect + (1.96 * se),
      natural_metric: naturalMetric,
      natural_effect: naturalEffect,
      natural_ci_lower: '',
      natural_ci_upper: '',
      n_total: '',
      reverse_sign: shouldReverse(record.reverse_sign) ? 'yes' : 'no',
      formula: '',
      warning: '',
      notes: record.notes || ''
    };
  }

  function normalizeType(value) {
    const type = normalizeHeader(value);
    const aliases = {
      smd: 'independent_means',
      means: 'independent_means',
      independent_groups: 'independent_means',
      independent_t_test: 'independent_t',
      t: 'independent_t',
      independent_f_test: 'independent_f',
      two_group_f: 'independent_f',
      f: 'independent_f',
      pearson_r: 'correlation',
      r: 'correlation',
      odds_ratio: 'binary',
      binary_counts: 'binary',
      generic_iv: 'generic',
      inverse_variance: 'generic',
      yi_vi: 'generic'
    };
    return aliases[type] || type;
  }

  function calculateIndependentMeans(record) {
    const mean1 = numberValue(record, 'mean1', 'mean1');
    const sd1 = numberValue(record, 'sd1', 'sd1', { minExclusive: 0 });
    const n1 = numberValue(record, 'n1', 'n1', { integer: true, minExclusive: 1 });
    const mean2 = numberValue(record, 'mean2', 'mean2');
    const sd2 = numberValue(record, 'sd2', 'sd2', { minExclusive: 0 });
    const n2 = numberValue(record, 'n2', 'n2', { integer: true, minExclusive: 1 });
    const df = n1 + n2 - 2;
    const pooledSd = Math.sqrt((((n1 - 1) * sd1 ** 2) + ((n2 - 1) * sd2 ** 2)) / df);
    if (!Number.isFinite(pooledSd) || pooledSd === 0) validationError(record, { code: 'POOLED_SD_UNDEFINED', column: 'sd1, sd2', enteredValue: `${record.sd1 || ''}, ${record.sd2 || ''}`, message: 'The pooled standard deviation is zero or undefined, so a standardized mean difference cannot be calculated.', fix: 'Verify both SD values. A row with no outcome variability cannot be converted through the independent-means pathway.' });
    let d = (mean1 - mean2) / pooledSd;
    if (shouldReverse(record.reverse_sign)) d *= -1;
    const j = correctionJ(df);
    const g = j * d;
    const variance = (1 / n1) + (1 / n2) + ((g ** 2) / (2 * (n1 + n2)));
    const result = baseResult(record, 'Hedges g', g, variance, 'Cohen d', d);
    result.n_total = n1 + n2;
    result.formula = 'Pooled-SD standardized mean difference with the exact Hedges small-sample correction.';
    return result;
  }

  function calculateIndependentT(record) {
    const t = numberValue(record, 't_value', 't_value');
    const n1 = numberValue(record, 'n1', 'n1', { integer: true, minExclusive: 1 });
    const n2 = numberValue(record, 'n2', 'n2', { integer: true, minExclusive: 1 });
    const df = n1 + n2 - 2;
    let d = t * Math.sqrt((1 / n1) + (1 / n2));
    if (shouldReverse(record.reverse_sign)) d *= -1;
    const j = correctionJ(df);
    const g = j * d;
    const variance = (1 / n1) + (1 / n2) + ((g ** 2) / (2 * (n1 + n2)));
    const result = baseResult(record, 'Hedges g', g, variance, 'Cohen d', d);
    result.n_total = n1 + n2;
    result.formula = 'Student independent-groups t converted to Cohen d, then corrected with the exact Hedges factor.';
    return result;
  }

  function fDirectionSign(record) {
    const value = record.f_direction;
    const direction = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const group1 = ['group1_higher', 'group_1_higher', 'group1', 'first_group_higher', 'positive', '1'];
    const group2 = ['group2_higher', 'group_2_higher', 'group2', 'second_group_higher', 'negative', '-1'];
    if (!direction) {
      validationError(record, { code: 'F_DIRECTION_REQUIRED', column: 'f_direction', message: 'f_direction is required because an F statistic contains no sign.', fix: 'Enter group1_higher or group2_higher after checking the group means or the direction reported in the article.' });
    }
    if (group1.includes(direction)) return 1;
    if (group2.includes(direction)) return -1;
    validationError(record, { code: 'INVALID_F_DIRECTION', column: 'f_direction', message: `“${value}” is not a recognized F direction.`, fix: 'Use exactly group1_higher or group2_higher.' });
  }

  function calculateIndependentF(record) {
    const f = numberValue(record, 'f_value', 'f_value', { minInclusive: 0 });
    const df1 = numberValue(record, 'f_df1', 'f_df1', { integer: true, minExclusive: 0 });
    const df2 = numberValue(record, 'f_df2', 'f_df2', { integer: true, minExclusive: 0 });
    const n1 = numberValue(record, 'n1', 'n1', { integer: true, minExclusive: 1 });
    const n2 = numberValue(record, 'n2', 'n2', { integer: true, minExclusive: 1 });
    if (df1 !== 1) {
      validationError(record, { code: 'UNSUPPORTED_F_NUMERATOR_DF', column: 'f_df1', enteredValue: record.f_df1, message: `The entered F has numerator df = ${df1}. This converter supports only F tests with numerator df = 1.`, fix: 'Use a specific one-degree-of-freedom contrast, or extract another convertible statistic. Do not enter an omnibus F here.' });
    }
    const expectedDf2 = n1 + n2 - 2;
    if (df2 !== expectedDf2) {
      validationError(record, { code: 'F_DENOMINATOR_DF_MISMATCH', column: 'f_df2', enteredValue: record.f_df2, message: `f_df2 is ${df2}, but n1 + n2 − 2 equals ${expectedDf2}. The statistic is therefore not the supported simple two-group between-subjects F test.`, fix: `Verify n1, n2, and f_df2. If the reported F came from ANCOVA, repeated measures, a mixed model, or another adjusted analysis, do not use this conversion pathway.` });
    }
    let t = Math.sqrt(f) * fDirectionSign(record);
    if (shouldReverse(record.reverse_sign)) t *= -1;
    const d = t * Math.sqrt((1 / n1) + (1 / n2));
    const j = correctionJ(df2);
    const g = j * d;
    const variance = (1 / n1) + (1 / n2) + ((g ** 2) / (2 * (n1 + n2)));
    const result = baseResult(record, 'Hedges g', g, variance, 'Cohen d', d);
    result.n_total = n1 + n2;
    result.formula = 'Two-group F(1, df2) converted using signed t = sqrt(F), then to Cohen d and Hedges g using the exact correction factor.';
    return result;
  }

  function calculateCorrelation(record) {
    let r = numberValue(record, 'r_value', 'r_value');
    const n = numberValue(record, 'n', 'n', { integer: true, minExclusive: 3 });
    if (r <= -1 || r >= 1) validationError(record, { code: 'CORRELATION_OUT_OF_RANGE', column: 'r_value', enteredValue: record.r_value, message: `r_value must be greater than −1 and less than 1; the entered value is ${record.r_value}.`, fix: 'Enter a valid Pearson correlation coefficient.' });
    if (shouldReverse(record.reverse_sign)) r *= -1;
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const variance = 1 / (n - 3);
    const result = baseResult(record, 'Fisher z', z, variance, 'Pearson r', r);
    result.n_total = n;
    result.natural_ci_lower = Math.tanh(result.ci_lower);
    result.natural_ci_upper = Math.tanh(result.ci_upper);
    result.formula = 'Fisher r-to-z transformation; variance = 1/(n-3).';
    return result;
  }

  function calculateGeneric(record) {
    const metric = normalizeMetricName(record.effect_metric);
    if (!metric) {
      validationError(record, {
        code: 'MISSING_EFFECT_METRIC', column: 'effect_metric',
        message: 'effect_metric is required for generic inverse-variance input.',
        fix: 'Name the analysis scale, for example Hedges g, Fisher z, Log odds ratio, Log risk ratio, or another clearly defined effect-size metric.'
      });
    }

    const naturalRatioNames = new Set(['odds ratio', 'risk ratio', 'hazard ratio', 'rate ratio']);
    if (naturalRatioNames.has(metric.toLowerCase())) {
      validationError(record, {
        code: 'GENERIC_RATIO_REQUIRES_LOG_SCALE', column: 'effect_metric', enteredValue: record.effect_metric,
        message: `${metric} has a null value of 1 and should not be pooled directly with this zero-null generic pathway.`,
        fix: `Enter the estimate on its log scale (for example Log ${metric.toLowerCase()}) with the corresponding log-scale sampling variance or standard error.`
      });
    }

    let effect = numberValue(record, 'effect_size', 'effect_size');
    const hasVariance = record.sampling_variance !== undefined && record.sampling_variance !== '';
    const hasSe = record.standard_error !== undefined && record.standard_error !== '';
    if (!hasVariance && !hasSe) {
      validationError(record, {
        code: 'MISSING_VARIANCE_OR_SE', column: 'sampling_variance, standard_error',
        message: 'Generic inverse-variance input requires sampling_variance or standard_error.',
        fix: 'Enter a positive sampling variance, or enter a positive standard error and leave sampling_variance blank.'
      });
    }

    let variance;
    let warning = '';
    if (hasVariance) {
      variance = numberValue(record, 'sampling_variance', 'sampling_variance', { minExclusive: 0 });
      if (hasSe) {
        const se = numberValue(record, 'standard_error', 'standard_error', { minExclusive: 0 });
        const fromSe = se ** 2;
        const relativeDifference = Math.abs(variance - fromSe) / Math.max(variance, fromSe);
        if (relativeDifference > 1e-6) {
          warning = 'Both sampling_variance and standard_error were supplied but they are not numerically equivalent; sampling_variance was used.';
        }
      }
    } else {
      const se = numberValue(record, 'standard_error', 'standard_error', { minExclusive: 0 });
      variance = se ** 2;
    }

    if (shouldReverse(record.reverse_sign)) effect *= -1;

    let naturalMetric = metric;
    let naturalEffect = effect;
    if (metric === 'Log odds ratio' || metric === 'Log risk ratio' || metric === 'Log hazard ratio' || metric === 'Log rate ratio') {
      naturalMetric = metric.replace(/^Log /, '');
      naturalMetric = naturalMetric.charAt(0).toUpperCase() + naturalMetric.slice(1);
      naturalEffect = Math.exp(effect);
    } else if (metric === 'Fisher z') {
      naturalMetric = 'Pearson r';
      naturalEffect = Math.tanh(effect);
    }

    const result = baseResult(record, metric, effect, variance, naturalMetric, naturalEffect);
    if (metric === 'Log odds ratio' || metric === 'Log risk ratio' || metric === 'Log hazard ratio' || metric === 'Log rate ratio') {
      result.natural_ci_lower = Math.exp(result.ci_lower);
      result.natural_ci_upper = Math.exp(result.ci_upper);
    } else if (metric === 'Fisher z') {
      result.natural_ci_lower = Math.tanh(result.ci_lower);
      result.natural_ci_upper = Math.tanh(result.ci_upper);
    }
    result.formula = hasVariance
      ? 'Generic inverse-variance input using the supplied effect size and sampling variance.'
      : 'Generic inverse-variance input using the supplied effect size and squared standard error.';
    result.warning = warning;
    return result;
  }

  function calculateBinary(record) {
    const events1 = numberValue(record, 'events1', 'events1', { integer: true, minInclusive: 0 });
    const total1 = numberValue(record, 'total1', 'total1', { integer: true, minExclusive: 0 });
    const events2 = numberValue(record, 'events2', 'events2', { integer: true, minInclusive: 0 });
    const total2 = numberValue(record, 'total2', 'total2', { integer: true, minExclusive: 0 });
    if (events1 > total1) validationError(record, { code: 'EVENTS_EXCEED_TOTAL', column: 'events1', enteredValue: record.events1, message: `events1 (${events1}) exceeds total1 (${total1}).`, fix: 'Correct the event count or group total; events must be between 0 and the corresponding total.' });
    if (events2 > total2) validationError(record, { code: 'EVENTS_EXCEED_TOTAL', column: 'events2', enteredValue: record.events2, message: `events2 (${events2}) exceeds total2 (${total2}).`, fix: 'Correct the event count or group total; events must be between 0 and the corresponding total.' });

    const noEventsInEitherGroup = events1 === 0 && events2 === 0;
    const allEventsInBothGroups = events1 === total1 && events2 === total2;
    if (noEventsInEitherGroup || allEventsInBothGroups) {
      validationError(record, {
        code: 'NONINFORMATIVE_BINARY_STUDY',
        column: 'events1, total1, events2, total2',
        enteredValue: `${events1}/${total1}; ${events2}/${total2}`,
        severity: 'warning',
        message: noEventsInEitherGroup
          ? 'No events occurred in either group. This study contains no comparative information for an odds ratio and was excluded from the pooled odds-ratio analysis.'
          : 'All participants had the event in both groups. This study contains no comparative information for an odds ratio and was excluded from the pooled odds-ratio analysis.',
        fix: 'No correction is required unless the extracted counts are wrong. Keep the row for the audit trail; the Studio excludes it from the odds-ratio model.'
      });
    }

    let a = events1;
    let b = total1 - events1;
    let c = events2;
    let d = total2 - events2;
    const corrected = [a, b, c, d].some((cell) => cell === 0);
    if (corrected) {
      a += 0.5;
      b += 0.5;
      c += 0.5;
      d += 0.5;
    }

    let logOr = Math.log((a * d) / (b * c));
    if (shouldReverse(record.reverse_sign)) logOr *= -1;
    const variance = (1 / a) + (1 / b) + (1 / c) + (1 / d);
    const oddsRatio = Math.exp(logOr);
    const result = baseResult(record, 'Log odds ratio', logOr, variance, 'Odds ratio', oddsRatio);
    result.n_total = total1 + total2;
    result.natural_ci_lower = Math.exp(result.ci_lower);
    result.natural_ci_upper = Math.exp(result.ci_upper);
    result.formula = 'Natural log of the cross-product odds ratio.';
    if (corrected) result.warning = 'A 0.5 continuity correction was added to all four cells because at least one cell was zero.';
    return result;
  }

  const commonInputColumns = new Set(['study_id', 'effect_id', 'calculation_type', 'reverse_sign', 'notes']);
  const usedColumnsByType = {
    independent_means: new Set(['mean1', 'sd1', 'n1', 'mean2', 'sd2', 'n2']),
    independent_t: new Set(['t_value', 'n1', 'n2']),
    independent_f: new Set(['f_value', 'f_df1', 'f_df2', 'f_direction', 'n1', 'n2']),
    correlation: new Set(['r_value', 'n']),
    binary: new Set(['events1', 'total1', 'events2', 'total2']),
    generic: new Set(['effect_metric', 'effect_size', 'sampling_variance', 'standard_error'])
  };

  function unexpectedInputNotices(record, type) {
    const used = usedColumnsByType[type];
    if (!used) return [];
    return Object.keys(record).filter((key) => key !== '__row' && !commonInputColumns.has(key) && !used.has(key) && String(record[key] || '').trim() !== '').map((key) => ({
      row: record.__row, study_id: record.study_id || '', effect_id: record.effect_id || '', severity: 'information',
      column: key, entered_value: record[key], code: 'INPUT_NOT_USED',
      message: `${key} is populated but is not used by calculation_type ${type}.`,
      fix: `Remove the value if it was entered accidentally. If it is essential to the design, choose the correct calculation_type rather than forcing the row into ${type}.`
    }));
  }

  function identifierNotices(record) {
    const notices = [];
    if (!String(record.study_id || '').trim()) {
      notices.push({
        row: record.__row, study_id: '', effect_id: record.effect_id || '', severity: 'warning',
        column: 'study_id', entered_value: '', code: 'MISSING_STUDY_ID',
        message: 'study_id is blank. The effect can be calculated, but the Studio cannot reliably detect multiple dependent effects from the same study.',
        fix: 'Add a stable study label or citation before pooling whenever possible.'
      });
    }
    if (!String(record.effect_id || '').trim()) {
      notices.push({
        row: record.__row, study_id: record.study_id || '', effect_id: '', severity: 'information',
        column: 'effect_id', entered_value: '', code: 'MISSING_EFFECT_ID',
        message: 'effect_id is blank. The calculation can proceed, but a unique effect identifier improves the audit trail.',
        fix: 'Add a unique effect_id if the study contributes more than one estimate or if you need stable row-level tracking.'
      });
    }
    return notices;
  }

  function calculationNotices(record, result) {
    if (!result.warning) return [];
    let column = '';
    let code = 'CALCULATION_ASSUMPTION';
    if (result.calculation_type === 'independent_f') { column = 'f_direction'; code = 'F_DIRECTION_ASSIGNED'; }
    if (result.calculation_type === 'binary' && result.warning.includes('continuity correction')) { column = 'events1, total1, events2, total2'; code = 'CONTINUITY_CORRECTION_APPLIED'; }
    return [{ row: record.__row, study_id: record.study_id || '', effect_id: record.effect_id || '', severity: 'warning', column, entered_value: column && !column.includes(',') ? (record[column] || '') : '', code, message: result.warning, fix: 'Review and report this assumption or correction in the analysis documentation.' }];
  }

  function calculateRecord(record) {
    validateReverseSign(record);
    const type = normalizeType(record.calculation_type);
    let result;
    if (type === 'independent_means') result = calculateIndependentMeans(record);
    else if (type === 'independent_t') result = calculateIndependentT(record);
    else if (type === 'independent_f') result = calculateIndependentF(record);
    else if (type === 'correlation') result = calculateCorrelation(record);
    else if (type === 'binary') result = calculateBinary(record);
    else if (type === 'generic') result = calculateGeneric(record);
    else validationError(record, { code: 'UNSUPPORTED_CALCULATION_TYPE', column: 'calculation_type', enteredValue: record.calculation_type || '', message: `Unsupported calculation_type “${record.calculation_type || ''}”.`, fix: 'Use independent_means, independent_t, independent_f, correlation, binary, or generic.' });
    return { result, notices: [...identifierNotices(record), ...unexpectedInputNotices(record, type), ...calculationNotices(record, result)] };
  }

  globalThis.ERNEffectSizeConverterCore = {
    parseDelimited,
    calculateRecord,
    calculateIndependentMeans,
    calculateIndependentT,
    calculateIndependentF,
    calculateCorrelation,
    calculateBinary,
    calculateGeneric
  };

  if (!fileInput || !dropZone) return;

  function formatNumber(value) {
    if (value === '' || value === null || value === undefined) return 'N/A';
    const number = Number(value);
    if (!Number.isFinite(number)) return 'N/A';
    if (Math.abs(number) >= 1000 || (Math.abs(number) > 0 && Math.abs(number) < 0.0001)) {
      return number.toExponential(4);
    }
    return number.toFixed(5).replace(/\.?0+$/, '');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  function forestNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    const abs = Math.abs(number);
    if (abs >= 100 || (abs > 0 && abs < 0.01)) return number.toExponential(2);
    return number.toFixed(abs < 1 ? 2 : 1).replace(/\.0$/, '');
  }

  function niceTickStep(span, targetTicks = 6) {
    if (!Number.isFinite(span) || span <= 0) return 1;
    const raw = span / targetTicks;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    let niceFraction = 1;
    if (fraction >= 5) niceFraction = 5;
    else if (fraction >= 2) niceFraction = 2;
    return niceFraction * power;
  }

  function shortForestLabel(result) {
    const base = [result.study_id, result.effect_id].filter(Boolean).join(' · ') || 'Unnamed effect';
    return base.length > 43 ? `${base.slice(0, 40)}…` : base;
  }

  function safeFilename(value) {
    return String(value || 'effect-size')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'effect-size';
  }

  function buildForestSvg(metric, items) {
    const width = 1120;
    const plotLeft = 355;
    const plotRight = 825;
    const valueLeft = 855;
    const top = 60;
    const rowHeight = 44;
    const bottom = 70;
    const axisY = top + (items.length * rowHeight) + 8;
    const height = axisY + bottom;

    let domainMin = Math.min(0, ...items.map((item) => Number(item.ci_lower)));
    let domainMax = Math.max(0, ...items.map((item) => Number(item.ci_upper)));
    if (!Number.isFinite(domainMin) || !Number.isFinite(domainMax)) return '';
    if (domainMin === domainMax) {
      domainMin -= 1;
      domainMax += 1;
    }
    const initialSpan = domainMax - domainMin;
    domainMin -= initialSpan * 0.08;
    domainMax += initialSpan * 0.08;
    const span = domainMax - domainMin;
    const xScale = (value) => plotLeft + (((value - domainMin) / span) * (plotRight - plotLeft));

    const tickStep = niceTickStep(span);
    const firstTick = Math.ceil(domainMin / tickStep) * tickStep;
    const ticks = [];
    for (let value = firstTick; value <= domainMax + (tickStep * 0.001); value += tickStep) {
      ticks.push(Number(value.toFixed(10)));
      if (ticks.length > 20) break;
    }

    const precisions = items.map((item) => 1 / Number(item.sampling_variance));
    const minPrecision = Math.min(...precisions);
    const maxPrecision = Math.max(...precisions);
    const squareSize = (precision) => {
      if (!Number.isFinite(precision) || maxPrecision === minPrecision) return 12;
      const scaled = (Math.sqrt(precision) - Math.sqrt(minPrecision)) / (Math.sqrt(maxPrecision) - Math.sqrt(minPrecision));
      return 8 + (10 * scaled);
    };

    const grid = ticks.map((tick) => {
      const x = xScale(tick);
      return `<line x1="${x.toFixed(2)}" y1="42" x2="${x.toFixed(2)}" y2="${axisY}" stroke="#d9e1ec" stroke-width="1"/>`;
    }).join('');

    const nullX = xScale(0);
    const rows = items.map((item, index) => {
      const y = top + (index * rowHeight);
      const estimateX = xScale(Number(item.effect_size));
      const lowX = xScale(Number(item.ci_lower));
      const highX = xScale(Number(item.ci_upper));
      const size = squareSize(precisions[index]);
      const label = escapeHtml(shortForestLabel(item));
      const value = `${forestNumber(item.effect_size)} [${forestNumber(item.ci_lower)}, ${forestNumber(item.ci_upper)}]`;
      return `
        <text x="18" y="${y + 5}" font-family="Arial, sans-serif" font-size="14" fill="#26364c">${label}</text>
        <line x1="${lowX.toFixed(2)}" y1="${y}" x2="${highX.toFixed(2)}" y2="${y}" stroke="#274f82" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="${lowX.toFixed(2)}" y1="${y - 5}" x2="${lowX.toFixed(2)}" y2="${y + 5}" stroke="#274f82" stroke-width="1.5"/>
        <line x1="${highX.toFixed(2)}" y1="${y - 5}" x2="${highX.toFixed(2)}" y2="${y + 5}" stroke="#274f82" stroke-width="1.5"/>
        <rect x="${(estimateX - (size / 2)).toFixed(2)}" y="${(y - (size / 2)).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" rx="1.5" fill="#1d3557"/>
        <text x="${valueLeft}" y="${y + 5}" font-family="Arial, sans-serif" font-size="13" fill="#40516a">${escapeHtml(value)}</text>`;
    }).join('');

    const tickLabels = ticks.map((tick) => {
      const x = xScale(tick);
      return `
        <line x1="${x.toFixed(2)}" y1="${axisY}" x2="${x.toFixed(2)}" y2="${axisY + 6}" stroke="#51647d" stroke-width="1"/>
        <text x="${x.toFixed(2)}" y="${axisY + 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#51647d">${escapeHtml(forestNumber(tick))}</text>`;
    }).join('');

    return `<svg class="forest-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Forest plot for ${escapeHtml(metric)}">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="18" y="28" font-family="Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.1" fill="#274f82">STUDY / EFFECT</text>
      <text x="${valueLeft}" y="28" font-family="Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.1" fill="#274f82">ESTIMATE [95% CI]</text>
      ${grid}
      <line x1="${nullX.toFixed(2)}" y1="42" x2="${nullX.toFixed(2)}" y2="${axisY}" stroke="#8292a7" stroke-width="2" stroke-dasharray="5 5"/>
      ${rows}
      <line x1="${plotLeft}" y1="${axisY}" x2="${plotRight}" y2="${axisY}" stroke="#51647d" stroke-width="1.5"/>
      ${tickLabels}
      <text x="${((plotLeft + plotRight) / 2).toFixed(2)}" y="${axisY + 52}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#26364c">${escapeHtml(metric)} (null = 0)</text>
    </svg>`;
  }

  function downloadForestSvg(index) {
    const forest = latestForestSvgs[index];
    if (!forest) return;
    const blob = new Blob([forest.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ern-forest-plot-${safeFilename(forest.metric)}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function renderForestPlots(results) {
    if (!forestSection || !forestPlots) return;
    latestForestSvgs = [];
    if (!results.length) {
      forestPlots.innerHTML = '';
      forestSection.hidden = true;
      return;
    }

    const groups = new Map();
    results.forEach((result) => {
      const metric = result.effect_metric || 'Effect size';
      if (!groups.has(metric)) groups.set(metric, []);
      groups.get(metric).push(result);
    });

    const cards = [];
    groups.forEach((items, metric) => {
      const svg = buildForestSvg(metric, items);
      if (!svg) return;
      const index = latestForestSvgs.length;
      latestForestSvgs.push({ metric, svg });
      cards.push(`
        <article class="forest-card">
          <div class="forest-card-head">
            <div>
              <h3>${escapeHtml(metric)}</h3>
              <p class="muted">${items.length} effect${items.length === 1 ? '' : 's'} · square size reflects inverse-variance precision · no pooled estimate</p>
            </div>
            <button class="btn btn-outline btn-sm download-forest" type="button" data-forest-index="${index}">Download SVG</button>
          </div>
          <div class="forest-svg-wrap">${svg}</div>
        </article>`);
    });

    forestPlots.innerHTML = cards.join('');
    forestSection.hidden = cards.length === 0;
    forestPlots.querySelectorAll('.download-forest').forEach((button) => {
      button.addEventListener('click', () => downloadForestSvg(Number(button.dataset.forestIndex)));
    });
  }

  function renderValidation(validationItems) {
    if (!validationItems.length) {
      issuesList.innerHTML = '';
      if (validationSummary) validationSummary.textContent = '';
      issuesSection.hidden = true;
      return;
    }
    const errors = validationItems.filter((item) => item.severity === 'error').length;
    const warnings = validationItems.filter((item) => item.severity === 'warning').length;
    const information = validationItems.filter((item) => item.severity === 'information').length;
    if (validationSummary) validationSummary.textContent = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}, and ${information} informational notice${information === 1 ? '' : 's'}. The publication workbook preserves every item.`;
    issuesList.innerHTML = validationItems.map((item) => `
      <article class="validation-item validation-item--${escapeHtml(item.severity)}">
        <div class="validation-item-head">
          <span class="validation-badge">${escapeHtml(item.severity)}</span>
          <strong>Row ${escapeHtml(item.row)}${item.effect_id ? ` · ${escapeHtml(item.effect_id)}` : ''}</strong>
          ${item.column ? `<code>${escapeHtml(item.column)}</code>` : ''}
        </div>
        <p>${escapeHtml(item.message)}</p>
        ${item.entered_value !== '' ? `<p class="validation-value"><strong>Entered value:</strong> ${escapeHtml(item.entered_value)}</p>` : ''}
        ${item.fix ? `<p class="validation-fix"><strong>How to fix or review:</strong> ${escapeHtml(item.fix)}</p>` : ''}
        <span class="validation-code">${escapeHtml(item.code)}</span>
      </article>`).join('');
    issuesSection.hidden = false;
  }

  function renderResults(results, validationItems, sourceName, records, headers) {
    latestResults = results;
    latestRecords = records;
    latestHeaders = headers;
    latestValidationItems = validationItems;
    latestSourceName = sourceName;
    resultsBody.innerHTML = results.map((result) => `
      <tr>
        <td>${escapeHtml(result.study_id || 'N/A')}</td>
        <td>${escapeHtml(result.effect_id || 'N/A')}</td>
        <td>${escapeHtml(result.effect_metric)}</td>
        <td class="numeric">${formatNumber(result.effect_size)}</td>
        <td class="numeric">${formatNumber(result.sampling_variance)}</td>
        <td class="numeric">${formatNumber(result.standard_error)}</td>
        <td class="numeric">${formatNumber(result.ci_lower)}</td>
        <td class="numeric">${formatNumber(result.ci_upper)}</td>
        <td>${escapeHtml(result.natural_metric || 'N/A')}</td>
        <td class="numeric">${formatNumber(result.natural_effect)}</td>
        <td>${escapeHtml(result.warning || '')}</td>
      </tr>`).join('');

    resultsSection.hidden = records.length === 0;
    downloadButton.disabled = results.length === 0;
    if (workbookButton) workbookButton.disabled = records.length === 0;
    const forestCount = new Set(results.map((result) => result.effect_metric).filter(Boolean)).size;
    resultSummary.textContent = results.length
      ? `${results.length} effect size${results.length === 1 ? '' : 's'} and ${forestCount} unpooled forest plot${forestCount === 1 ? '' : 's'} created automatically from ${sourceName}.`
      : `No effect sizes were calculated from ${sourceName}; download the publication workbook for the complete validation report.`;
    renderForestPlots(results);
    renderValidation(validationItems);
    window.dispatchEvent(new CustomEvent('ern:effect-results', { detail: { results, validationItems, sourceName, records, headers } }));

    const errors = validationItems.filter((item) => item.severity === 'error').length;
    const excludedRows = new Set(validationItems.filter((item) => item.code === 'NONINFORMATIVE_BINARY_STUDY').map((item) => item.row)).size;
    const warningRows = new Set(validationItems.filter((item) => item.severity !== 'error').map((item) => item.row)).size;
    if (resultsSection && resultsSection.tagName === 'DETAILS') {
      resultsSection.open = errors > 0 || excludedRows > 0 || results.length === 0;
    }
    if (reviewStatus) {
      if (errors) reviewStatus.textContent = `${errors} error${errors === 1 ? '' : 's'}: review required`;
      else if (excludedRows) reviewStatus.textContent = `${excludedRows} excluded row${excludedRows === 1 ? '' : 's'}: review required`;
      else if (warningRows) reviewStatus.textContent = `${warningRows} review row${warningRows === 1 ? '' : 's'}: details available`;
      else reviewStatus.textContent = `${results.length} effect${results.length === 1 ? '' : 's'} ready`;
    }
    if (results.length && errors) {
      setStatus(`${results.length} effect size${results.length === 1 ? '' : 's'} calculated; ${errors} error${errors === 1 ? '' : 's'} require correction. Review them below before running the meta-analysis.`, 'warning');
    } else if (results.length && warningRows) {
      setStatus(`${results.length} effect size${results.length === 1 ? '' : 's'} and ${forestCount} unpooled forest plot${forestCount === 1 ? '' : 's'} created automatically; ${warningRows} row${warningRows === 1 ? '' : 's'} contain warnings or unused inputs. Review Step 2, then configure Step 3.`, 'warning');
    } else if (results.length) {
      setStatus(`${results.length} effect size${results.length === 1 ? '' : 's'} and ${forestCount} unpooled forest plot${forestCount === 1 ? '' : 's'} created automatically. Review Step 2, then configure and run the meta-analysis in Step 3.`, 'success');
    } else {
      setStatus('No valid rows were calculated. Review the validation report below.', 'error');
    }
  }

  function processText(text, sourceName) {
    try {
      const parsed = parseDelimited(text);
      const results = [];
      const validationItems = [];
      parsed.records.forEach((record) => {
        try {
          const outcome = calculateRecord(record);
          results.push(outcome.result);
          validationItems.push(...outcome.notices);
        } catch (error) {
          validationItems.push(issueFromError(record, error));
        }
      });
      renderResults(results, validationItems, sourceName, parsed.records, parsed.headers);
    } catch (error) {
      latestResults = [];
      latestRecords = [];
      latestHeaders = [];
      latestValidationItems = [];
      resultsSection.hidden = true;
      issuesSection.hidden = true;
      downloadButton.disabled = true;
      if (workbookButton) workbookButton.disabled = true;
      renderForestPlots([]);
      setStatus(error.message, 'error');
    }
  }

  function handleFile(file) {
    if (!file) return;
    resetUploadConfirmation();
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.tsv') && !lowerName.endsWith('.txt')) {
      setStatus('Use a CSV or tab-delimited text file. Download the template to begin.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus('The file is larger than 5 MB. Split it into smaller batches.', 'error');
      return;
    }
    setStatus(`Reading ${file.name}…`, 'neutral');
    const reader = new FileReader();
    reader.onload = () => {
      showUploadConfirmation(file);
      processText(String(reader.result || ''), file.name);
    };
    reader.onerror = () => {
      resetUploadConfirmation();
      setStatus('The file could not be read in this browser.', 'error');
    };
    reader.readAsText(file);
  }

  function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadResults() {
    if (!latestResults.length) return;
    const headers = [
      'study_id', 'effect_id', 'calculation_type', 'effect_metric', 'effect_size',
      'sampling_variance', 'standard_error', 'ci_lower', 'ci_upper', 'natural_metric',
      'natural_effect', 'natural_ci_lower', 'natural_ci_upper', 'n_total', 'reverse_sign',
      'formula', 'warning', 'notes'
    ];
    const lines = [headers.join(',')];
    latestResults.forEach((result) => {
      lines.push(headers.map((header) => csvEscape(result[header])).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ern-effect-sizes.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPublicationWorkbook() {
    if (!latestRecords.length || !window.ERNWorkbookExporter) return;
    const originalText = workbookButton.textContent;
    workbookButton.disabled = true;
    workbookButton.textContent = 'Building workbook…';
    try {
      const metaState = window.ERNMetaAnalysisState || { analyses: [], pooledForests: [] };
      const blob = await window.ERNWorkbookExporter.buildPublicationWorkbook({
        records: latestRecords, headers: latestHeaders, results: latestResults,
        validationItems: latestValidationItems,
        forests: [...latestForestSvgs, ...(metaState.pooledForests || [])],
        metaAnalyses: metaState.analyses || [],
        sourceName: latestSourceName
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ern-meta-analysis-publication-workbook.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus(`Publication workbook created with the original input, validation report, calculated effects, audit trail, embedded figures, and ${(metaState.analyses || []).length} fitted meta-analysis model${(metaState.analyses || []).length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      setStatus(`The publication workbook could not be created: ${error.message}`, 'error');
    } finally {
      workbookButton.textContent = originalText;
      workbookButton.disabled = latestRecords.length === 0;
    }
  }

  function clearAll() {
    fileInput.value = '';
    resetUploadConfirmation();
    latestResults = [];
    latestRecords = [];
    latestHeaders = [];
    latestValidationItems = [];
    latestSourceName = '';
    resultsBody.innerHTML = '';
    issuesList.innerHTML = '';
    resultsSection.hidden = true;
    if (resultsSection && resultsSection.tagName === 'DETAILS') resultsSection.open = false;
    if (reviewStatus) reviewStatus.textContent = 'Open review';
    issuesSection.hidden = true;
    downloadButton.disabled = true;
    if (workbookButton) workbookButton.disabled = true;
    renderForestPlots([]);
    window.dispatchEvent(new CustomEvent('ern:effect-results', { detail: { results: [], validationItems: [], sourceName: '', records: [], headers: [] } }));
    setStatus('Load your CSV or try the built-in example. The Studio will create the Step 2 effect sizes, validation report, and unpooled forest plots automatically.', 'neutral');
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  exampleButton.addEventListener('click', () => {
    resetUploadConfirmation();
    fileInput.value = '';
    processText(exampleCsv, 'the example dataset');
  });
  clearButton.addEventListener('click', clearAll);
  downloadButton.addEventListener('click', downloadResults);
  if (workbookButton) workbookButton.addEventListener('click', downloadPublicationWorkbook);

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    handleFile(file);
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
})();
