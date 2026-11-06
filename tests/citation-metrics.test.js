const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  computeCitationMetrics,
  interpretRatio,
  describeCitationResults,
  formatCitationReport,
  normalizeDoi,
  fetchOpenAlexWork,
  openAlexWindowCounts,
  openAlexLifetimeThrough,
  buildCitationCsv
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
  assert.match(formatCitationReport(result), /not calculated; enter cumulative citations and citable age/);
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

test('exact inclusive calendar-year windows determine the denominator and reporting period', () => {
  const result = computeCitationMetrics({
    recentCitations: '89', windowMode: 'calendar', startYear: '2024', endYear: '2025',
    recentYears: '5', publicationYear: '2009', totalCitations: '252'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.recentYears, 2);
  assert.equal(result.now, 44.5);
  assert.match(describeCitationResults(result).now, /from 2024 through 2025 \(inclusive\)/);
  assert.ok(computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2026', endYear: '2025' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2026', endYear: '2027' }, 2026).errors.length);
  const partial = computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2025', endYear: '2026' }, 2026);
  assert.ok(partial.warnings.some((message) => message.includes('not yet complete')));
});

test('journal-level benchmark is labeled and qualified', () => {
  const result = computeCitationMetrics({
    recentCitations: '89', recentYears: '2', benchmarkName: '2025 Journal Impact Factor',
    benchmarkType: 'jif', benchmarkRate: '3'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.match(describeCitationResults(result).benchmark, /not a measure of the paper’s quality/);
  assert.ok(result.warnings.some((message) => message.includes('journal-level')));
});

test('normalizes DOIs and retrieves OpenAlex records without private credentials', async () => {
  assert.equal(normalizeDoi('https://doi.org/10.1073/pnas.2532470123'), '10.1073/pnas.2532470123');
  assert.equal(normalizeDoi('doi:10.1073/pnas.2532470123'), '10.1073/pnas.2532470123');
  assert.throws(() => normalizeDoi('not-a-doi'), /valid DOI/);
  let requestedUrl;
  const work = await fetchOpenAlexWork('10.1073/pnas.2532470123', async (url, options) => {
    requestedUrl = url;
    assert.equal(options.headers.Accept, 'application/json');
    return { ok: true, json: async () => ({
      display_name: 'Example article', publication_year: 2016, cited_by_count: 100,
      counts_by_year: [{ year: 2025, cited_by_count: 20 }, { year: 2024, cited_by_count: 5 }]
    }) };
  });
  assert.equal(requestedUrl, 'https://api.openalex.org/works/https://doi.org/10.1073/pnas.2532470123');
  assert.equal(work.display_name, 'Example article');
  assert.equal(openAlexWindowCounts(work, 2024, 2025, 2026), 25);
  assert.equal(openAlexWindowCounts(work, 2023, 2025, 2026), 25, 'Omitted years within coverage count as zero');
  assert.equal(openAlexLifetimeThrough(work, 2025, 2026), 100, 'Older papers use current lifetime total less citations after the cutoff');
  assert.throws(() => openAlexWindowCounts(work, 2015, 2025, 2026), /last ten years/);
  await assert.rejects(fetchOpenAlexWork('10.1073/pnas.2532470123', async () => ({ ok: false, status: 429 })), /rate-limiting/);
});

test('DOI data aligns the lifetime total with the end of the recent complete-year window', () => {
  const work = {
    publication_year: 2023, publication_date: '2023-09-01', cited_by_count: 66,
    counts_by_year: [
      { year: 2023, cited_by_count: 3 }, { year: 2024, cited_by_count: 10 },
      { year: 2025, cited_by_count: 23 }, { year: 2026, cited_by_count: 30 }
    ]
  };
  const cumulative = openAlexLifetimeThrough(work, 2025, 2026);
  assert.equal(cumulative, 36, '2026 citations must not enter the cumulative 2025 denominator');
  const result = computeCitationMetrics({
    publicationYear: '2023', publicationDate: work.publication_date,
    totalCitations: String(cumulative), lifetimeThroughYear: '2025',
    recentCitations: '33', windowMode: 'calendar', startYear: '2024', endYear: '2025',
    checkedDate: '2026-11-05'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 16.5);
  assert.ok(result.articleAge > 2.3 && result.articleAge < 2.4);
  assert.ok(result.vsLifetime > 1 && result.vsLifetime < 1.1);
  assert.match(describeCitationResults(result).lifetime, /through 2025/);
  assert.ok(!result.warnings.some(message => message.includes('unavailable')));

  const mismatched = computeCitationMetrics({
    publicationYear: '2023', totalCitations: '66', lifetimeThroughYear: '2026',
    recentCitations: '33', windowMode: 'calendar', startYear: '2024', endYear: '2025'
  }, 2026);
  assert.equal(mismatched.now, 16.5);
  assert.equal(mismatched.vsLifetime, null, 'Mismatched cutoffs must not produce a misleading 0.75');
  assert.ok(mismatched.warnings.some(message => message.includes('unavailable')));
  assert.equal(openAlexLifetimeThrough(work, 2026, 2026), 66);
  assert.throws(() => openAlexLifetimeThrough(work, 2015, 2026), /cannot reconstruct/);
});

test('partial-year windows and exact publication dates use elapsed exposure time', () => {
  const result = computeCitationMetrics({
    recentCitations: '53', windowMode: 'calendar', startYear: '2025', endYear: '2026',
    publicationDate: '2023-09-01', publicationYear: '2023', totalCitations: '66',
    lifetimeThroughYear: '2026', checkedDate: '2026-11-05'
  }, 2026);
  assert.ok(result.observationYears > 1.8 && result.observationYears < 1.9);
  assert.ok(result.articleAge > 3.1 && result.articleAge < 3.3);
  assert.ok(result.warnings.some(message => message.includes('not yet complete')));
  assert.ok(result.now > 28, 'The partial current year must not be treated as a completed year');
});

test('CSV comparison preserves sources, windows, and safe spreadsheet text', () => {
  const result = computeCitationMetrics({
    paperTitle: '=SUM(1,2)', doi: '10.1000/example', windowMode: 'calendar',
    startYear: '2024', endYear: '2025', recentCitations: '25',
    publicationYear: '2016', totalCitations: '100', lifetimeThroughYear: '2025',
    benchmarkType: 'jif', benchmarkName: '2025 JIF', benchmarkRate: '3',
    citationSource: 'OpenAlex', checkedDate: '2026-11-05'
  }, 2026);
  const csv = buildCitationCsv([result]);
  assert.match(csv, /"'=SUM\(1,2\)"/);
  assert.match(csv, /"2024","2025","12.5"/);
  assert.match(csv, /"100","2025","25"/);
  assert.match(csv, /"OpenAlex"/);
  assert.match(csv, /"2026-11-05"/);
  assert.equal(csv.split('\r\n').filter(Boolean).length, 2);
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
    'citationSource', 'checkedDate', 'selfCitations', 'doi', 'windowMode',
    'startYear', 'endYear', 'benchmarkType', 'publicationDate', 'lifetimeThroughYear'
  ]) assert.ok(html.includes(`name="${name}"`), `Missing calculator field ${name}`);
  for (const key of ['now', 'now-note', 'lifetime', 'lifetime-note', 'benchmark', 'benchmark-note']) {
    assert.ok(html.includes(`data-citation-output="${key}"`), `Missing output ${key}`);
  }
  assert.ok(html.includes('<script src="citation-metrics.js?v=20261106b"></script>'));
  assert.ok(html.includes('href="styles.css?v=20261106b"'));
  assert.ok(html.indexOf('id="citation-doi"') < html.indexOf('id="citation-paper-title"'), 'DOI should be the first input');
  assert.match(html, /<details class="citation-manual-details" id="citation-manual-details">/, 'Manual entry should start collapsed');
  assert.ok(html.includes('id="citation-benchmark-details"'), 'Optional benchmark should have its own disclosure');
  assert.ok(html.includes('id="citation-reporting-details"'), 'Optional reporting fields should have their own disclosure');
  assert.ok(html.includes('<option value="Google Scholar">') && html.includes('<option value="Web of Science">') && html.includes('<option value="ResearchGate">'), 'Manual citation sources must be offered');
  assert.ok(html.includes('id="citation-results-source"'), 'Calculated results should identify the citation database');
  assert.ok(html.includes('Citations Per Year (Now vs. Lifetime)</span>'));
  assert.ok(html.includes('Citations Per Year (Now vs. Benchmark)</span>'));
  assert.ok(!html.includes('(under review)'), 'A rejected manuscript must not be identified as under review');
  for (const id of ['citation-doi-lookup', 'citation-doi-status', 'citation-metrics-add', 'citation-comparison-body', 'citation-comparison-export']) {
    assert.ok(ids.includes(id), `Missing ${id}`);
  }
  assert.ok(ids.includes('citation-annual-trend-bars'));
});
