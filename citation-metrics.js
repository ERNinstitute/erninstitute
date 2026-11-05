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
    const recentYears = asCount(input.recentYears, 'Recent period (years)', errors);
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
    if (articleAge !== null && recentYears > articleAge) {
      warnings.push(`The recent window (${recentYears} years) exceeds the paper’s age used by the calculator (${articleAge} years). Confirm that this is the period you intend to report.`);
    }
    if (lifetime === 0) warnings.push('Now vs. Lifetime is undefined when the lifetime annual citation rate is zero.');
    if (benchmark === null && String(input.benchmarkName || '').trim()) {
      warnings.push('Enter the annual rate to calculate Now vs. Benchmark.');
    }

    return {
      errors: [], warnings, now, lifetime, vsLifetime, vsBenchmark, articleAge,
      recentCitations, recentYears, totalCitations, publicationYear,
      benchmark, benchmarkName: String(input.benchmarkName || '').trim(),
      benchmarkSource: String(input.benchmarkSource || '').trim(),
      paperTitle: String(input.paperTitle || '').trim(),
      citationSource: String(input.citationSource || '').trim(),
      checkedDate: String(input.checkedDate || '').trim(),
      selfCitations: String(input.selfCitations || 'Not specified')
    };
  }

  function formatNumber(number) {
    return Number(number).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCitationReport(result) {
    if (result.errors.length) return '';
    const title = result.paperTitle || 'Paper';
    const lines = [
      `ERN Institute | Article-level citation metrics`,
      `Paper: ${title}`,
      `Citations Per Year (Now): ${formatNumber(result.now)} (${result.recentCitations} citations over ${result.recentYears} years).`
    ];
    if (result.lifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): not calculated; enter publication year and total citations.');
    } else if (result.vsLifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): undefined (lifetime citation rate is zero).');
    } else {
      lines.push(`Citations Per Year (Now vs. Lifetime): ${formatNumber(result.vsLifetime)} (lifetime rate ${formatNumber(result.lifetime)} per year; ${interpretRatio(result.vsLifetime, 'faster than', 'slower than', 'about the same as')} the lifetime rate).`);
    }
    if (result.vsBenchmark === null) {
      lines.push('Citations Per Year (Now vs. Benchmark): not calculated; add a named annual benchmark and its value.');
    } else {
      lines.push(`Citations Per Year (Now vs. Benchmark): ${formatNumber(result.vsBenchmark)} (${interpretRatio(result.vsBenchmark, 'above', 'below', 'about the same as')} ${result.benchmarkName}, annual rate ${formatNumber(result.benchmark)}).`);
      lines.push(`Benchmark source: ${result.benchmarkSource || 'Not specified'}.`);
    }
    lines.push(`Citation source: ${result.citationSource || 'Not specified'}.`);
    lines.push(`Date checked: ${result.checkedDate || 'Not specified'}.`);
    lines.push(`Self-citations: ${result.selfCitations}.`);
    result.warnings.forEach((warning) => lines.push(`Review: ${warning}`));
    lines.push('These descriptive comparisons are not measures of research quality. Interpret with field, age, article type, and database context.');
    return lines.join('\n');
  }

  const api = { computeCitationMetrics, interpretRatio, formatCitationReport };
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
  let calculated = false;

  const currentDate = new Date();
  const localDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const dateField = form.elements.namedItem('checkedDate');
  if (dateField) dateField.value = localDate;

  function readInput() {
    return Object.fromEntries(fields.map((field) => [field.name, field.value]));
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
      resultsBox.hidden = true;
      emptyBox.hidden = false;
      return;
    }
    setText('now', formatNumber(result.now));
    setText('now-note', `${result.recentCitations} citations over ${result.recentYears} years`);
    setText('lifetime', result.vsLifetime === null ? 'N/A' : formatNumber(result.vsLifetime));
    setText('lifetime-note', result.lifetime === null ? 'Enter publication year and total citations' :
      result.vsLifetime === null ? 'Undefined with a zero lifetime rate' :
        `${interpretRatio(result.vsLifetime, 'Faster than', 'Slower than', 'About the same as')} the lifetime rate (${formatNumber(result.lifetime)}/year)`);
    setText('benchmark', result.vsBenchmark === null ? 'N/A' : formatNumber(result.vsBenchmark));
    setText('benchmark-note', result.vsBenchmark === null ? 'Add a named annual benchmark to compare' :
      `${interpretRatio(result.vsBenchmark, 'Above', 'Below', 'About the same as')} ${result.benchmarkName} (${formatNumber(result.benchmark)}/year)`);
    warningBox.hidden = result.warnings.length === 0;
    warningBox.textContent = result.warnings.join(' ');
    reportBox.textContent = formatCitationReport(result);
    copyButton.textContent = 'Copy report';
    emptyBox.hidden = true;
    resultsBox.hidden = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculated = true;
    calculate();
  });
  form.addEventListener('input', () => { if (calculated) calculate(); });
  form.addEventListener('change', () => { if (calculated) calculate(); });

  document.getElementById('citation-metrics-example').addEventListener('click', () => {
    const example = {
      paperTitle: 'Example paper', publicationYear: '2016', totalCitations: '100',
      recentCitations: '25', recentYears: '5', benchmarkName: '2025 two-year Journal Impact Factor',
      benchmarkRate: '3', benchmarkSource: 'Example benchmark', citationSource: 'Example citation source',
      checkedDate: localDate, selfCitations: 'Included'
    };
    fields.forEach((field) => { field.value = example[field.name] ?? ''; });
    calculated = true;
    calculate();
  });
  document.getElementById('citation-metrics-clear').addEventListener('click', () => {
    form.reset();
    if (dateField) dateField.value = localDate;
    calculated = false;
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
