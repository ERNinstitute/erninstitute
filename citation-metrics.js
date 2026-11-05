/* ERN Institute article-level citation metrics. Calculations run entirely in the browser. */
(() => {
  'use strict';

  const asCount = (value, label, errors, optional = false) => {
    if (value === '' || value === null || value === undefined) {
      if (!optional) errors.push(`Enter ${label.toLowerCase()}.`);
      return null;
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) {
      errors.push(`${label} must be a non-negative whole number.`);
      return null;
    }
    return number;
  };

  function interpretRatio(ratio, high, low, equal) {
    if (ratio === null) return 'Not available';
    // Match the interpretation bands used by the original ERN Excel workbook.
    if (ratio > 1.1) return high;
    if (ratio < 0.9) return low;
    return equal;
  }

  function computeCitationMetrics(input, currentYear = new Date().getFullYear()) {
    const errors = [];
    const recentCitations = asCount(input.recentCitations, 'Recent citations', errors);
    const windowMode = input.windowMode === 'calendar' ? 'calendar' : 'duration';
    const startYear = windowMode === 'calendar' ? asCount(input.startYear, 'Window start year', errors) : null;
    const endYear = windowMode === 'calendar' ? asCount(input.endYear, 'Window end year', errors) : null;
    if (windowMode === 'calendar' && startYear !== null && endYear !== null) {
      if (startYear < 1 || startYear > endYear) errors.push('The calendar window must begin on or before its end year.');
      if (endYear > currentYear) errors.push(`The calendar window cannot extend beyond ${currentYear}.`);
    }
    const recentYears = windowMode === 'calendar'
      ? (startYear !== null && endYear !== null && startYear <= endYear ? endYear - startYear + 1 : null)
      : asCount(input.recentYears, 'Recent period (years)', errors);
    if (recentYears === 0) errors.push('Recent period must be at least one year.');

    const publicationYear = asCount(input.publicationYear, 'Publication year', errors, true);
    if (publicationYear !== null && (publicationYear < 1 || publicationYear > currentYear)) {
      errors.push(`Publication year must be between 1 and ${currentYear}.`);
    }
    const totalCitations = asCount(input.totalCitations, 'Total citations', errors, true);
    if (recentCitations !== null && totalCitations !== null && recentCitations > totalCitations) {
      errors.push('Recent citations cannot exceed total citations when both use the same source.');
    }

    let benchmark = null;
    if (input.benchmarkRate !== '' && input.benchmarkRate !== null && input.benchmarkRate !== undefined) {
      benchmark = Number(input.benchmarkRate);
      if (!Number.isFinite(benchmark) || benchmark <= 0) {
        errors.push('Benchmark annual rate must be greater than zero.');
      }
      if (!String(input.benchmarkName || '').trim()) {
        errors.push('Name the benchmark when entering a benchmark rate.');
      }
    }

    if (errors.length) return { errors };

    const now = recentCitations / recentYears;
    // The source workbook uses MAX(1, YEAR(TODAY()) - publication year).
    const articleAge = publicationYear === null ? null : Math.max(1, currentYear - publicationYear);
    const lifetime = totalCitations === null || articleAge === null ? null : totalCitations / articleAge;
    const vsLifetime = lifetime === null || lifetime === 0 ? null : now / lifetime;
    const vsBenchmark = benchmark === null ? null : now / benchmark;
    const warnings = [];
    if (windowMode === 'calendar' && endYear === currentYear) {
      warnings.push(`The ${currentYear} calendar year is not yet complete; counts for this year may be partial.`);
    }
    if (windowMode === 'calendar' && publicationYear !== null && startYear < publicationYear) {
      warnings.push('The selected citation window begins before the paper’s publication year.');
    }
    if (articleAge !== null && recentYears > articleAge) {
      warnings.push(`The recent window (${recentYears} years) exceeds the paper’s age used by the calculator (${articleAge} years). Confirm that this is the period you intend to report.`);
    }
    if (lifetime === 0) warnings.push('Now vs. Lifetime is undefined when the lifetime annual citation rate is zero.');
    if (benchmark === null && String(input.benchmarkName || '').trim()) {
      warnings.push('Enter the annual rate to calculate Now vs. Benchmark.');
    }
    const benchmarkType = String(input.benchmarkType || 'annual');
    const isJournalBenchmark = benchmarkType === 'jif' || /\b(?:journal impact factor|jif|impact factor)\b/i.test(input.benchmarkName || '');
    if (benchmark !== null && isJournalBenchmark) {
      warnings.push('The Journal Impact Factor is a journal-level comparison, not evidence of an individual paper’s research quality or relative scientific importance.');
    }

    return {
      errors: [], warnings, now, lifetime, vsLifetime, vsBenchmark, articleAge,
      recentCitations, recentYears, totalCitations, publicationYear, windowMode, startYear, endYear,
      benchmark, benchmarkName: String(input.benchmarkName || '').trim(),
      benchmarkSource: String(input.benchmarkSource || '').trim(), benchmarkType, isJournalBenchmark,
      paperTitle: String(input.paperTitle || '').trim(),
      doi: String(input.doi || '').trim(),
      citationSource: String(input.citationSource || '').trim(),
      checkedDate: String(input.checkedDate || '').trim(),
      selfCitations: String(input.selfCitations || 'Not specified')
    };
  }

  function formatNumber(number) {
    return Number(number).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function describeCitationResults(result) {
    const windowDescription = result.windowMode === 'calendar'
      ? `from ${result.startYear} through ${result.endYear} (inclusive)`
      : `over ${result.recentYears} ${result.recentYears === 1 ? 'year' : 'years'}`;
    return {
      now: `The paper received ${result.recentCitations} citations ${windowDescription}, averaging ${formatNumber(result.now)} per year.`,
      lifetime: result.lifetime === null
        ? 'Enter the publication year and total citations to compare with the lifetime average.'
        : result.vsLifetime === null
          ? 'The lifetime comparison is undefined because the lifetime annual rate is zero.'
          : `The recent citation rate is ${formatNumber(result.vsLifetime)} times the paper’s lifetime annual average of ${formatNumber(result.lifetime)} citations per year.`,
      benchmark: result.vsBenchmark === null
        ? 'Enter a named annual benchmark and its value to calculate this comparison.'
        : `The recent citation rate is ${formatNumber(result.vsBenchmark)} times the ${result.benchmarkName} benchmark of ${formatNumber(result.benchmark)} citations per year.${result.isJournalBenchmark ? ' This is a journal-level reference, not a measure of the paper’s quality.' : ''}`
    };
  }

  function formatCitationReport(result) {
    if (result.errors.length) return '';
    const title = result.paperTitle || 'Paper';
    const descriptions = describeCitationResults(result);
    const lines = [
      `ERN Institute | Article-level citation metrics`,
      `Paper: ${title}`
    ];
    if (result.doi) lines.push(`DOI: ${result.doi}.`);
    lines.push(`Citations Per Year (Now): ${formatNumber(result.now)}. ${descriptions.now}`);
    if (result.lifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): not calculated; enter publication year and total citations.');
    } else if (result.vsLifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): undefined (lifetime citation rate is zero).');
    } else {
      lines.push(`Citations Per Year (Now vs. Lifetime): ${formatNumber(result.vsLifetime)}. ${descriptions.lifetime}`);
    }
    if (result.vsBenchmark === null) {
      lines.push('Citations Per Year (Now vs. Benchmark): not calculated; add a named annual benchmark and its value.');
    } else {
      lines.push(`Citations Per Year (Now vs. Benchmark): ${formatNumber(result.vsBenchmark)}. ${descriptions.benchmark}`);
      lines.push(`Benchmark source: ${result.benchmarkSource || 'Not specified'}.`);
    }
    lines.push(`Citation source: ${result.citationSource || 'Not specified'}.`);
    lines.push(`Date checked: ${result.checkedDate || 'Not specified'}.`);
    lines.push(`Self-citations: ${result.selfCitations}.`);
    result.warnings.forEach((warning) => lines.push(`Review: ${warning}`));
    lines.push('These descriptive comparisons are not measures of research quality. Interpret with field, age, article type, and database context.');
    return lines.join('\n');
  }

  function normalizeDoi(value) {
    const doi = String(value || '').trim()
      .replace(/^doi:\s*/i, '')
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
    if (!/^10\.\d{4,9}\/\S+$/i.test(doi) || doi.length > 255) {
      throw new Error('Enter a valid DOI, such as 10.1073/pnas.2532470123.');
    }
    return doi;
  }

  async function fetchOpenAlexWork(doi, fetcher = fetch, options = {}) {
    const normalized = normalizeDoi(doi);
    // OpenAlex supports direct, single-work DOI lookup without an API key.
    const doiPath = normalized.split('/').map((part) => encodeURIComponent(part)).join('/');
    const url = `https://api.openalex.org/works/https://doi.org/${doiPath}`;
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: options.signal });
    if (!response.ok) {
      if (response.status === 404) throw new Error('OpenAlex could not find a paper with that DOI. You can enter citations manually.');
      if (response.status === 429) throw new Error('OpenAlex is temporarily rate-limiting requests. Please try later or enter citations manually.');
      throw new Error(`OpenAlex lookup failed (HTTP ${response.status}). You can enter citations manually.`);
    }
    const work = await response.json();
    if (!work || typeof work.display_name !== 'string' || !Number.isSafeInteger(work.cited_by_count) || !Number.isSafeInteger(work.publication_year)) {
      throw new Error('OpenAlex returned incomplete citation metadata for this DOI. Please enter the counts manually.');
    }
    return work;
  }

  function openAlexWindowCounts(work, startYear, endYear, currentYear = new Date().getFullYear()) {
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear || endYear > currentYear) {
      throw new Error('Select a valid calendar-year window before fetching annual citation counts.');
    }
    // OpenAlex exposes only the last ten calendar years for each work.
    if (startYear < currentYear - 9) {
      throw new Error(`OpenAlex publishes annual citation counts for only the last ten years. Choose ${currentYear - 9} or later, or enter the recent count manually.`);
    }
    if (!Array.isArray(work.counts_by_year)) {
      throw new Error('OpenAlex did not supply annual citation counts for this paper. Please enter the recent count manually.');
    }
    const counts = new Map();
    for (const item of work.counts_by_year) {
      if (!Number.isSafeInteger(item.year) || !Number.isSafeInteger(item.cited_by_count) || item.cited_by_count < 0) continue;
      counts.set(item.year, item.cited_by_count);
    }
    let total = 0;
    for (let year = startYear; year <= endYear; year += 1) total += counts.get(year) || 0;
    return total;
  }

  const csvHeaders = [
    'Paper title', 'DOI', 'Publication year', 'Total citations', 'Recent citations',
    'Recent years', 'Window start year', 'Window end year', 'Citations per year now',
    'Lifetime citations per year', 'Now vs lifetime', 'Benchmark type', 'Benchmark name',
    'Benchmark annual rate', 'Now vs benchmark', 'Benchmark source', 'Citation source',
    'Date checked', 'Self-citations'
  ];

  function buildCitationCsv(results) {
    const number = (value) => value === null || value === undefined ? '' : String(Number(value.toFixed(6)));
    const safeCell = (value, isText = false) => {
      let content = String(value ?? '');
      // Avoid spreadsheet formula execution from copied titles, DOIs, or source names.
      if (isText && /^[\s]*[=+\-@]/.test(content)) content = `'${content}`;
      return `"${content.replace(/"/g, '""')}"`;
    };
    const rows = results.map((r) => [
      r.paperTitle, r.doi, r.publicationYear ?? '', r.totalCitations ?? '', r.recentCitations,
      r.recentYears, r.startYear ?? '', r.endYear ?? '', number(r.now),
      number(r.lifetime), number(r.vsLifetime), r.benchmarkType, r.benchmarkName,
      number(r.benchmark), number(r.vsBenchmark), r.benchmarkSource, r.citationSource,
      r.checkedDate, r.selfCitations
    ]);
    return [csvHeaders, ...rows].map((row, rowIndex) => row.map((value, i) => safeCell(value, rowIndex === 0 || [0, 1, 11, 12, 15, 16, 17, 18].includes(i))).join(',')).join('\r\n') + '\r\n';
  }

  const api = {
    computeCitationMetrics, interpretRatio, describeCitationResults, formatCitationReport,
    normalizeDoi, fetchOpenAlexWork, openAlexWindowCounts, buildCitationCsv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ERNCitationMetrics = api;

  if (typeof document === 'undefined') return;
  const form = document.getElementById('citation-metrics-form');
  if (!form) return;

  const fields = Array.from(form.querySelectorAll('[name]'));
  const errorsBox = document.getElementById('citation-metrics-errors');
  const resultsBox = document.getElementById('citation-metrics-results');
  const emptyBox = document.getElementById('citation-metrics-empty');
  const warningBox = document.getElementById('citation-metrics-warnings');
  const reportBox = document.getElementById('citation-metrics-report');
  const copyButton = document.getElementById('citation-metrics-copy');
  const addButton = document.getElementById('citation-metrics-add');
  const lookupButton = document.getElementById('citation-doi-lookup');
  const lookupStatus = document.getElementById('citation-doi-status');
  const comparisonPanel = document.getElementById('citation-comparison');
  const comparisonBody = document.getElementById('citation-comparison-body');
  const exportButton = document.getElementById('citation-comparison-export');
  const durationField = document.getElementById('citation-duration-field');
  const calendarFields = document.getElementById('citation-calendar-fields');
  const windowModeField = form.elements.namedItem('windowMode');
  let calculated = false;
  let latestResult = null;
  let comparisonRows = [];
  let nextComparisonId = 1;
  let editingRowId = null;

  const currentDate = new Date();
  const localDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const dateField = form.elements.namedItem('checkedDate');
  if (dateField) dateField.value = localDate;

  function readInput() {
    return Object.fromEntries(fields.map((field) => [field.name, field.value]));
  }

  function setField(name, value) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? '';
  }

  function updateWindowMode() {
    const calendar = windowModeField.value === 'calendar';
    durationField.hidden = calendar;
    calendarFields.hidden = !calendar;
    form.elements.namedItem('recentYears').required = !calendar;
    form.elements.namedItem('startYear').required = calendar;
    form.elements.namedItem('endYear').required = calendar;
  }

  function setText(name, text) {
    const element = document.querySelector(`[data-citation-output="${name}"]`);
    if (element) element.textContent = text;
  }

  function showErrors(messages) {
    errorsBox.hidden = messages.length === 0;
    errorsBox.replaceChildren();
    if (messages.length) {
      const heading = document.createElement('strong');
      heading.textContent = 'Please review the inputs:';
      const list = document.createElement('ul');
      messages.forEach((message) => {
        const item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      });
      errorsBox.append(heading, list);
    }
  }

  function calculate() {
    const result = computeCitationMetrics(readInput());
    showErrors(result.errors);
    if (result.errors.length) {
      latestResult = null;
      resultsBox.hidden = true;
      emptyBox.hidden = false;
      return null;
    }
    latestResult = result;
    const descriptions = describeCitationResults(result);
    setText('now', formatNumber(result.now));
    setText('now-note', descriptions.now);
    setText('lifetime', result.vsLifetime === null ? 'N/A' : formatNumber(result.vsLifetime));
    setText('lifetime-note', descriptions.lifetime);
    setText('benchmark', result.vsBenchmark === null ? 'N/A' : formatNumber(result.vsBenchmark));
    setText('benchmark-note', descriptions.benchmark);
    warningBox.hidden = result.warnings.length === 0;
    warningBox.textContent = result.warnings.join(' ');
    reportBox.textContent = formatCitationReport(result);
    copyButton.textContent = 'Copy report';
    emptyBox.hidden = true;
    resultsBox.hidden = false;
    return result;
  }

  function formatComparisonCell(value) {
    return value === null || value === undefined ? 'N/A' : formatNumber(value);
  }

  function renderComparison() {
    comparisonPanel.hidden = comparisonRows.length === 0;
    comparisonBody.replaceChildren();
    for (const row of comparisonRows) {
      const tr = document.createElement('tr');
      const result = row.result;
      const cells = [
        result.paperTitle || result.doi || `Paper ${row.id}`,
        result.windowMode === 'calendar' ? `${result.startYear}–${result.endYear}` : `${result.recentYears} years`,
        formatComparisonCell(result.now), formatComparisonCell(result.vsLifetime), formatComparisonCell(result.vsBenchmark)
      ];
      ['Paper', 'Citation window', 'Now', 'vs. Lifetime', 'vs. Benchmark'].forEach((label, i) => {
        const td = document.createElement('td');
        td.dataset.label = label;
        td.textContent = cells[i];
        if (i === 4 && result.benchmarkName) {
          const value = document.createElement('span');
          value.textContent = cells[i];
          const detail = document.createElement('small');
          detail.textContent = result.benchmarkName;
          value.appendChild(detail);
          td.replaceChildren(value);
        }
        tr.appendChild(td);
      });
      const actions = document.createElement('td');
      actions.dataset.label = 'Actions';
      actions.className = 'citation-comparison-actions';
      for (const [action, label] of [['load', 'Load'], ['remove', 'Remove']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'citation-table-button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.id = row.id;
        button.setAttribute('aria-label', `${label} ${cells[0]}`);
        actions.appendChild(button);
      }
      tr.appendChild(actions);
      comparisonBody.appendChild(tr);
    }
  }

  function resetEditing() {
    editingRowId = null;
    addButton.textContent = 'Add paper to comparison';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculated = true;
    calculate();
  });
  form.addEventListener('input', () => { if (calculated) calculate(); });
  form.addEventListener('change', () => {
    updateWindowMode();
    if (calculated) calculate();
  });
  updateWindowMode();

  lookupButton.addEventListener('click', async () => {
    const doi = form.elements.namedItem('doi').value;
    lookupButton.disabled = true;
    lookupButton.textContent = 'Looking up…';
    lookupStatus.textContent = 'Checking OpenAlex for public citation information…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const work = await fetchOpenAlexWork(doi, fetch, { signal: controller.signal });
      const input = readInput();
      const currentYear = new Date().getFullYear();
      const duration = Number(input.recentYears);
      const startYear = input.windowMode === 'calendar' ? Number(input.startYear) : currentYear - duration;
      const endYear = input.windowMode === 'calendar' ? Number(input.endYear) : currentYear - 1;
      const recentCitations = openAlexWindowCounts(work, startYear, endYear, currentYear);
      setField('doi', normalizeDoi(doi));
      setField('paperTitle', work.display_name);
      setField('publicationYear', work.publication_year);
      setField('totalCitations', work.cited_by_count);
      setField('recentCitations', recentCitations);
      setField('windowMode', 'calendar');
      setField('startYear', startYear);
      setField('endYear', endYear);
      setField('recentYears', endYear - startYear + 1);
      setField('citationSource', 'OpenAlex');
      setField('checkedDate', localDate);
      setField('selfCitations', 'Not specified');
      updateWindowMode();
      lookupStatus.textContent = `Retrieved ${work.cited_by_count} lifetime citations and ${recentCitations} citations during ${startYear}–${endYear} from OpenAlex. Review the values and source before reporting.`;
      calculated = true;
      calculate();
    } catch (error) {
      lookupStatus.textContent = error.name === 'AbortError'
        ? 'OpenAlex did not respond within 15 seconds. You can enter citation counts manually.'
        : error.message || 'The DOI lookup is unavailable. You can enter the citation counts manually.';
    } finally {
      clearTimeout(timeout);
      lookupButton.disabled = false;
      lookupButton.textContent = 'Look up DOI';
    }
  });

  addButton.addEventListener('click', () => {
    if (!latestResult) return;
    if (editingRowId !== null) {
      const row = comparisonRows.find((item) => item.id === editingRowId);
      if (row) {
        row.input = readInput();
        row.result = latestResult;
      }
      resetEditing();
    } else if (comparisonRows.length < 50) {
      comparisonRows.push({ id: nextComparisonId++, input: readInput(), result: latestResult });
    } else {
      showErrors(['The comparison table holds up to 50 papers. Remove a row before adding another.']);
      return;
    }
    renderComparison();
    addButton.textContent = 'Added to comparison';
    setTimeout(() => { if (editingRowId === null) addButton.textContent = 'Add paper to comparison'; }, 1300);
  });

  comparisonBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    const row = comparisonRows.find((item) => item.id === id);
    if (!row) return;
    if (button.dataset.action === 'remove') {
      comparisonRows = comparisonRows.filter((item) => item.id !== id);
      if (editingRowId === id) resetEditing();
      renderComparison();
      return;
    }
    fields.forEach((field) => { field.value = row.input[field.name] ?? ''; });
    editingRowId = id;
    addButton.textContent = 'Update comparison row';
    lookupStatus.textContent = 'Loaded this comparison row. Review the citation source and counts before updating it.';
    updateWindowMode();
    calculated = true;
    calculate();
    form.scrollIntoView({ block: 'start' });
  });

  exportButton.addEventListener('click', () => {
    if (!comparisonRows.length) return;
    const csv = buildCitationCsv(comparisonRows.map((row) => row.result));
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ern-citation-metrics-comparison.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('citation-metrics-example').addEventListener('click', () => {
    const example = {
      paperTitle: 'Example paper', publicationYear: '2016', totalCitations: '100',
      recentCitations: '25', recentYears: '5', windowMode: 'duration', benchmarkType: 'jif',
      benchmarkName: '2025 two-year Journal Impact Factor',
      benchmarkRate: '3', benchmarkSource: 'Example benchmark', citationSource: 'Example citation source',
      checkedDate: localDate, selfCitations: 'Included'
    };
    fields.forEach((field) => { field.value = example[field.name] ?? ''; });
    lookupStatus.textContent = 'Example values are illustrative and are not retrieved from a citation database.';
    resetEditing();
    updateWindowMode();
    calculated = true;
    calculate();
  });
  document.getElementById('citation-metrics-clear').addEventListener('click', () => {
    form.reset();
    if (dateField) dateField.value = localDate;
    lookupStatus.textContent = 'OpenAlex can fill in the title, publication year, lifetime citations, and recent annual counts. Review the retrieved values before using them.';
    resetEditing();
    updateWindowMode();
    calculated = false;
    latestResult = null;
    showErrors([]);
    resultsBox.hidden = true;
    emptyBox.hidden = false;
  });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportBox.textContent);
      copyButton.textContent = 'Copied';
    } catch (_error) {
      copyButton.textContent = 'Copy unavailable: select the report text';
    }
  });
})();
