const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  computeCitationMetrics,
  interpretRatio,
  describeCitationResults,
  formatCitationReport
} = require('../citation-metrics.js');

test('matches the existing Excel workbook example', () => {
  const result = computeCitationMetrics({
    paperTitle: 'Example paper',
    publicationYear: '2016',
    totalCitations: '100',
    recentCitations: '25',
    recentYears: '5',
    benchmarkName: '2025 two-year Journal Impact Factor',
    benchmarkRate: '3',
    benchmarkSource: 'Example source',
    citationSource: 'Example database',
    selfCitations: 'Included',
    checkedDate: '2026-11-05'
  }, 2026);

  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 5);
  assert.equal(result.lifetime, 10);
  assert.equal(result.vsLifetime, 0.5);
  assert.ok(Math.abs(result.vsBenchmark - 5 / 3) < 1e-12);
  const report = formatCitationReport(result);
  assert.match(report, /Citations Per Year \(Now\): 5\.00/);
  assert.match(report, /Now vs\. Lifetime\): 0\.50/);
  assert.match(report, /Now vs\. Benchmark\): 1\.67/);
  assert.match(report, /Citation source: Example database/);
  assert.match(report, /Self-citations: Included/);
});

test('recent rate works without lifetime or benchmark fields', () => {
  const result = computeCitationMetrics({ recentCitations: '0', recentYears: '2' }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 0);
  assert.equal(result.vsLifetime, null);
  assert.equal(result.vsBenchmark, null);
  assert.match(formatCitationReport(result), /not calculated; enter publication year and total citations/);
});

test('lifetime comparison follows the workbook minimum age of one year', () => {
  const result = computeCitationMetrics({ recentCitations: '4', recentYears: '1', publicationYear: '2026', totalCitations: '4' }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.articleAge, 1);
  assert.equal(result.vsLifetime, 1);
});

test('undefined lifetime comparison is reported rather than dividing by zero', () => {
  const result = computeCitationMetrics({ recentCitations: '0', recentYears: '2', publicationYear: '2020', totalCitations: '0' }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.vsLifetime, null);
  assert.ok(result.warnings.some((message) => message.includes('undefined')));
});

test('validates missing, negative, fractional, and inconsistent inputs', () => {
  assert.ok(computeCitationMetrics({ recentCitations: '', recentYears: '2' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '-1', recentYears: '2' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '3.5', recentYears: '2' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '2', recentYears: '0' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '4', recentYears: '2', totalCitations: '3' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '4', recentYears: '2', publicationYear: '2027' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '4', recentYears: '2', benchmarkRate: '3' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '4', recentYears: '2', benchmarkName: 'Journal', benchmarkRate: '0' }, 2026).errors.length);
});

test('interpretation thresholds match Excel workbook bands', () => {
  assert.equal(interpretRatio(1.1, 'Faster', 'Slower', 'Similar'), 'Similar');
  assert.equal(interpretRatio(1.11, 'Faster', 'Slower', 'Similar'), 'Faster');
  assert.equal(interpretRatio(0.9, 'Faster', 'Slower', 'Similar'), 'Similar');
  assert.equal(interpretRatio(0.89, 'Faster', 'Slower', 'Similar'), 'Slower');
});

test('warns about recent periods longer than paper age', () => {
  const result = computeCitationMetrics({ recentCitations: '3', recentYears: '5', publicationYear: '2025', totalCitations: '3' }, 2026);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((message) => message.includes('exceeds the paper')));
});

test('describes the displayed rates and ratios in plain language', () => {
  const result = computeCitationMetrics({
    publicationYear: '2009', totalCitations: '252', recentCitations: '89',
    recentYears: '2', benchmarkName: 'IF 2-year', benchmarkRate: '3'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 44.5);
  const descriptions = describeCitationResults(result);
  assert.match(descriptions.now, /89 citations over 2 years, averaging 44\.50 per year/);
  assert.match(descriptions.lifetime, /3\.00 times the paper’s lifetime annual average of 14\.82 citations per year/);
  assert.match(descriptions.benchmark, /14\.83 times the IF 2-year benchmark of 3\.00 citations per year/);
  assert.match(formatCitationReport(result), /The recent citation rate is 3\.00 times/);
});

test('browser calculator includes all form fields and result targets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  assert.ok(html.indexOf('What the three metrics tell you') < html.indexOf('id="calculator"'), 'Explanations should precede the calculator');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Page element IDs should be unique');
  for (const id of [
    'citation-metrics-form', 'citation-metrics-errors', 'citation-metrics-results',
    'citation-metrics-empty', 'citation-metrics-warnings', 'citation-metrics-report',
    'citation-metrics-copy', 'citation-metrics-example', 'citation-metrics-clear'
  ]) assert.ok(ids.includes(id), `Missing calculator element ${id}`);
  for (const name of [
    'paperTitle', 'publicationYear', 'totalCitations', 'recentCitations',
    'recentYears', 'benchmarkName', 'benchmarkRate', 'benchmarkSource',
    'citationSource', 'checkedDate', 'selfCitations'
  ]) assert.ok(html.includes(`name="${name}"`), `Missing calculator field ${name}`);
  for (const key of ['now', 'now-note', 'lifetime', 'lifetime-note', 'benchmark', 'benchmark-note']) {
    assert.ok(html.includes(`data-citation-output="${key}"`), `Missing output ${key}`);
  }
  assert.ok(html.includes('<script src="citation-metrics.js"></script>'));
});
