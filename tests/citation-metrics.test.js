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
  buildCitationCsv,
  matchCuratedJournalJif,
  fetchCuratedJournalJif,
  matchPublisherBatchJif,
  fetchPublisherBatchJif,
  matchSCImagoCitesPerDoc,
  fetchSCImagoCitesPerDoc
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
  assert.match(report, /ARTICLE DETAILS[\s\S]*RECENT CITATION RATE[\s\S]*LIFETIME COMPARISON[\s\S]*JOURNAL BENCHMARK[\s\S]*REPORTING INFORMATION/);
  assert.match(report, /Citation source: Example database/);
  assert.match(report, /Self-citations: Included/);
});

test('self-citations default to Included unless explicitly excluded', () => {
  const unspecified = computeCitationMetrics({ recentCitations: '12', recentYears: '2' }, 2026);
  const legacy = computeCitationMetrics({ recentCitations: '12', recentYears: '2', selfCitations: 'Not specified' }, 2026);
  const excluded = computeCitationMetrics({ recentCitations: '12', recentYears: '2', selfCitations: 'Excluded' }, 2026);
  assert.equal(unspecified.selfCitations, 'Included');
  assert.equal(legacy.selfCitations, 'Included');
  assert.equal(excluded.selfCitations, 'Excluded');
  assert.match(formatCitationReport(unspecified), /Self-citations: Included\./);
  assert.match(formatCitationReport(excluded), /Self-citations: Excluded\./);
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  assert.match(html, /<option value="Included" selected>Included \(default\)<\/option>/);
  assert.match(html, /<option value="Excluded">Excluded<\/option>/);
  assert.doesNotMatch(html, /<option value="Not specified">/);
  assert.match(js, /setField\('selfCitations', 'Included'\)/);
  assert.match(js, /form\.reset\(\)/);
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
  assert.equal(computeCitationMetrics({ recentCitations: '4', recentYears: '2', benchmarkRate: '3' }, 2026).vsBenchmark, 2 / 3);
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
  assert.match(describeCitationResults(result).now, /During 2024–2025/);
  assert.ok(computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2026', endYear: '2025' }, 2026).errors.length);
  assert.ok(computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2026', endYear: '2027' }, 2026).errors.length);
  const partial = computeCitationMetrics({ recentCitations: '3', windowMode: 'calendar', startYear: '2025', endYear: '2026' }, 2026);
  assert.ok(partial.warnings.some((message) => message.includes('not yet complete')));
});

test('journal-level benchmark has a concise functional interpretation', () => {
  const result = computeCitationMetrics({
    recentCitations: '89', recentYears: '2', benchmarkName: '2025 Journal Impact Factor',
    benchmarkType: 'jif', benchmarkRate: '3'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.match(describeCitationResults(result).benchmark, /1383% above the 2025 Journal Impact Factor \(3\.00 citations per year\)/);
  assert.equal(result.isJournalBenchmark, true);
  assert.ok(!result.warnings.some(message => message.includes('research quality')));
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
  assert.match(describeCitationResults(result).lifetime, /During 2024–2025/);
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
  assert.match(descriptions.now, /During the selected 2-year period, this paper received 89 citations, averaging 44\.50 citations per year/);
  assert.match(descriptions.lifetime, /200% above its lifetime average \(14\.82 citations per year\)/);
  assert.match(descriptions.lifetime, /attracting citations faster recently/);
  assert.match(descriptions.benchmark, /compares citation activity with a journal-level or other external benchmark/);
  assert.doesNotMatch(descriptions.benchmark, /times as high as/);
  assert.match(descriptions.benchmark, /1383% above the IF 2-year \(3\.00 citations per year\)/);
  assert.match(formatCitationReport(result), /200% above its lifetime average/);
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
  assert.ok(html.includes('<script src="citation-metrics.js?v=20261111simplified"></script>'));
  assert.match(html, /class="citation-report-content"/);
  assert.match(html, /class="citation-result-note"/);
  assert.doesNotMatch(html, /<pre id="citation-metrics-report"/);
  assert.ok(html.includes('href="styles.css?v=20261111simplified"'));
  assert.ok(html.indexOf('id="citation-doi"') < html.indexOf('id="citation-paper-title"'), 'DOI should be the first input');
  assert.match(html, /<details class="citation-manual-details" id="citation-manual-details">/, 'Manual entry should start collapsed');
  assert.ok(html.includes('id="citation-benchmark-details"'), 'Optional benchmark metadata should remain available');
  assert.ok(html.includes('id="citation-reporting-details"'), 'Optional reporting fields should remain available');
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

test('DOI-first form has two disclosures and recalculates manual counts automatically', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  const form = html.slice(html.indexOf('<form id="citation-metrics-form"'), html.indexOf('</form>') + '</form>'.length);
  assert.equal((form.match(/<details\b/g) || []).length, 2);
  assert.equal((form.match(/<summary>/g) || []).length, 2);
  assert.match(form, /<summary>Manual citation data/);
  assert.match(form, /<summary>Advanced settings/);
  assert.doesNotMatch(form, />Calculate metrics<\/button>/);
  assert.ok(form.indexOf('id="citation-doi"') < form.indexOf('id="citation-manual-details"'));
  assert.ok(form.indexOf('id="citation-manual-details"') < form.indexOf('id="citation-advanced-details"'));
  assert.ok(form.indexOf('id="citation-advanced-details"') < form.indexOf('id="citation-benchmark-rate"'));
  assert.match(js, /const manualCountsPresent = String\(form\.elements\.namedItem\('recentCitations'\)\.value\)\.trim\(\) !== '';/);
  assert.match(js, /if \(calculated \|\| \(event\.target\.name !== 'doi' && manualCountsPresent\)\)/);
  assert.match(js, /selected === 'Excluded' && lastDoiWindow !== null/);
  assert.match(js, /setField\('selfCitations', 'Included'\)/);
  assert.doesNotMatch(js, /datesDetails\.open|benchmarkDetails\.open|reportingDetails\.open/);
});

test('publisher-listed JIF with an unconfirmed reporting year is clearly provisional', () => {
  const result = computeCitationMetrics({
    recentCitations: '37', recentYears: '5',
    benchmarkName: 'Test Journal publisher-listed Journal Impact Factor (year unstated; checked 2026-11-08)',
    benchmarkType: 'jif-unverified', benchmarkRate: '2.75',
    benchmarkSource: 'https://www.sciencedirect.com/journal/test-journal',
    citationSource: 'OpenAlex', checkedDate: '2026-11-08'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 7.4);
  assert.ok(Math.abs(result.vsBenchmark - 7.4 / 2.75) < 1e-12);
  assert.match(describeCitationResults(result).benchmark, /Reporting year not supplied/);
  assert.match(formatCitationReport(result), /Verify the exact JIF year before formal reporting/);
});

test('benchmark controls remain optional under advanced settings and outside the manual citation panel', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  const manual = html.indexOf('id="citation-manual-details"');
  const report = html.indexOf('id="citation-reporting-details"');
  const benchmark = html.indexOf('id="citation-benchmark-details"');
  const example = html.indexOf('id="citation-metrics-example"');
  const advanced = html.indexOf('id="citation-advanced-details"');
  const rate = html.indexOf('id="citation-benchmark-rate"');
  assert.ok(manual < advanced && advanced < rate && rate < benchmark && benchmark < report && report < example);
  assert.equal((html.match(/name="benchmarkRate"/g) || []).length, 1, 'Only one Impact Factor input should exist');
  assert.match(html, /<summary>Advanced settings/);
  assert.ok(html.includes('id="citation-benchmark-change"'));
  assert.match(js, /lookupJournalBenchmark\(work, normalizeDoi\(doi\)\)/);
  assert.match(js, /Illustrative annual benchmark \(not a real journal factor\)/);
});

test('publisher-verified Cognition JIF is available without a server endpoint', async () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const journal = matchCuratedJournalJif(registry, 'S88198767', 'Cognition', '0010-0277');
  assert.ok(journal, 'Cognition must be found by OpenAlex source ID and canonical ISSN');
  assert.equal(journal.rate, 3.1);
  assert.equal(journal.year, 2025);
  assert.equal(journal.source, 'https://www.sciencedirect.com/journal/cognition');
  assert.equal(journal.name, 'Cognition 2025 2-year Journal Impact Factor');
  assert.equal(matchCuratedJournalJif(registry, 'S88198767', 'Different Journal', '0010-0277'), null);
  assert.equal(matchCuratedJournalJif(registry, 'S88198767', 'Cognition', '1234-5678'), null);
  assert.equal(matchCuratedJournalJif(registry, 'S999999999', 'Cognition', '0010-0277'), null);
  const remote = await fetchCuratedJournalJif('S88198767', 'Cognition', '0010-0277', async (url) => {
    assert.equal(url, '/journal-impact-factors.json?v=20261108factors');
    return { ok: true, json: async () => registry };
  });
  assert.deepEqual(remote, journal);
});

test('Cognition DOI screenshot case produces 2.71 Now vs. Benchmark from 3.1 JIF', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const journal = matchCuratedJournalJif(registry, 'S88198767', 'Cognition', '0010-0277');
  const result = computeCitationMetrics({
    paperTitle: 'Sequential congruency effects reveal differences in disengagement of attention for monolingual and bilingual young adults',
    doi: '10.1016/j.cognition.2017.02.010',
    windowMode: 'calendar', startYear: '2021', endYear: '2025',
    recentCitations: '42', publicationYear: '2017', publicationDate: '2017-03-06',
    totalCitations: '94', lifetimeThroughYear: '2025',
    benchmarkType: journal.type, benchmarkName: journal.name,
    benchmarkRate: String(journal.rate), benchmarkSource: journal.source,
    citationSource: 'OpenAlex', checkedDate: '2026-11-08'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 8.4);
  assert.equal(Number(result.vsBenchmark.toFixed(2)), 2.71);
  assert.match(formatCitationReport(result), /Cognition 2025 2-year Journal Impact Factor/);
  assert.match(formatCitationReport(result), /sciencedirect.com\/journal\/cognition/);
});

test('one manual Impact Factor number calculates the comparison without name or source', () => {
  const result = computeCitationMetrics({
    recentCitations: '42', recentYears: '5', benchmarkRate: '3.1',
    benchmarkType: 'jif-unverified', citationSource: 'OpenAlex'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 8.4);
  assert.equal(result.benchmarkName, '2-year Journal Impact Factor');
  assert.equal(Number(result.vsBenchmark.toFixed(2)), 2.71);
  assert.match(describeCitationResults(result).benchmark, /171% above the 2-year Journal Impact Factor \(3\.10 citations per year\)/);
  assert.match(formatCitationReport(result), /Verify the exact JIF year before formal reporting/);
});

test('a 0.79 lifetime ratio is described as 21 percent below the lifetime rate', () => {
  const result = computeCitationMetrics({
    recentCitations: '42', recentYears: '5',
    publicationYear: '2017', totalCitations: '96'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.ok(result.vsLifetime > 0.78 && result.vsLifetime < 0.80);
  assert.match(describeCitationResults(result).lifetime, /21% below its lifetime average/);
  assert.doesNotMatch(describeCitationResults(result).lifetime, /not a year-by-year|has declined over time/);
});

test('DOI calculator defaults to the last two completed calendar years', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  assert.match(html, /name="recentYears"[^>]*value="2" required/);
  assert.match(html, /last two completed calendar years/);
  assert.ok(html.includes('citation-metrics.js?v=20261111simplified'));
  assert.match(html, /name="jifWindow"[^>]*aria-label="Journal Impact Factor time window"/);
  assert.match(js, /const startYear = quickMode === 'current' \? currentYear - 1/);
  assert.match(js, /const endYear = quickMode === 'current' \? currentYear/);
  assert.match(js, /recentCitations: '10', recentYears: '2', windowMode: 'duration'/);
  assert.match(js, /form.reset\(\)/);
  assert.match(js, /default is the last two completed calendar years/);
  const result = computeCitationMetrics({
    recentCitations: '10', recentYears: '2', publicationYear: '2016',
    totalCitations: '100', benchmarkName: 'Illustrative annual benchmark',
    benchmarkRate: '3'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.now, 5);
  assert.equal(result.vsLifetime, 0.5);
  assert.ok(Math.abs(result.vsBenchmark - 5 / 3) < 1e-12);
});

test('Cambridge BLC official two-year and five-year JIFs match OpenAlex journal title and ISSN', async () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const two = matchCuratedJournalJif(registry, 'S24095051', 'Bilingualism Language and Cognition', '1366-7289', '2');
  const five = matchCuratedJournalJif(registry, 'S24095051', 'Bilingualism Language and Cognition', '1366-7289', '5');
  assert.equal(two.rate, 2.4);
  assert.equal(two.year, 2025);
  assert.equal(two.type, 'jif');
  assert.equal(five.rate, 3.7);
  assert.equal(five.year, null, 'Publisher page does not specify five-year reporting year');
  assert.equal(five.type, 'jif-unverified');
  assert.match(five.name, /5-year Journal Impact Factor/);
  assert.equal(two.source, 'https://www.cambridge.org/core/journals/bilingualism-language-and-cognition/information/about-this-journal/journal-metrics');
  assert.equal(matchCuratedJournalJif(registry, 'S24095051', 'Language and Cognition', '1366-7289', '5'), null);
  assert.equal(matchCuratedJournalJif(registry, 'S24095051', 'Bilingualism Language and Cognition', '0000-0000', '5'), null);
  const fetched = await fetchCuratedJournalJif('S24095051', 'Bilingualism Language and Cognition',
    '1366-7289', async () => ({ ok: true, json: async () => registry }), { jifWindow: '5' });
  assert.deepEqual(fetched, five);
});

test('APA JEP LMC publisher two-year and five-year JIFs are distinct and dated', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const title = 'Journal of Experimental Psychology Learning Memory and Cognition';
  const two = matchCuratedJournalJif(registry, 'S18666220', title, '0278-7393', '2');
  const five = matchCuratedJournalJif(registry, 'S18666220', title, '0278-7393', '5');
  assert.equal(two.rate, 2.3);
  assert.equal(five.rate, 2.8);
  assert.equal(two.year, 2025);
  assert.equal(five.year, 2025);
  assert.match(five.name, /2025 5-year Journal Impact Factor/);
  assert.match(five.source, /apa\.org\/pubs\/journals\/resources\/impact-factors/);
  assert.equal(matchCuratedJournalJif(registry, 'S18666220', title, '1366-7289', '5'), null);
});

test('five-year JIF selection never reuses a two-year factor or mislabeled generic values', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const unavailable = matchCuratedJournalJif(registry, 'S88198767', 'Cognition', '0010-0277', '5');
  assert.equal(unavailable, null, 'Missing five-year figure must remain unavailable');
  const five = matchCuratedJournalJif(registry, 'S18666220',
    'Journal of Experimental Psychology Learning Memory and Cognition', '0278-7393', '5');
  const result = computeCitationMetrics({
    recentCitations: '20', recentYears: '2', jifWindow: '5',
    benchmarkRate: String(five.rate), benchmarkName: five.name,
    benchmarkType: five.type, benchmarkSource: five.source
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.jifWindow, '5');
  assert.equal(Number(result.vsBenchmark.toFixed(2)), 3.57);
  assert.match(describeCitationResults(result).benchmark, /5-year Journal Impact Factor/);
  const manual = computeCitationMetrics({
    recentCitations: '20', recentYears: '2', jifWindow: '5',
    benchmarkRate: '3.7', benchmarkType: 'jif-unverified'
  }, 2026);
  assert.equal(manual.benchmarkName, '5-year Journal Impact Factor');
  assert.equal(Number(manual.vsBenchmark.toFixed(2)), 2.70);
  const code = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  assert.match(code, /event.target.name === 'jifWindow'/);
  assert.match(code, /selectedWindow === '2'/);
  assert.match(code, /resetPublisherLookup\(true\);/);
});

test('live JEP LMC DOI regression uses APA JIF instead of reporting unavailable', () => {
  // DOI appeared in a live ERN calculator session with 57 OpenAlex citations in 2024–2025.
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors.json'), 'utf8'));
  const name = 'Journal of Experimental Psychology Learning Memory and Cognition';
  const two = matchCuratedJournalJif(registry, 'S18666220', name, '0278-7393', '2');
  const five = matchCuratedJournalJif(registry, 'S18666220', name, '0278-7393', '5');
  assert.equal(two.rate, 2.3);
  assert.equal(five.rate, 2.8);
  const input = {
    doi: '10.1037/a0014981', recentCitations: '57',
    windowMode: 'calendar', startYear: '2024', endYear: '2025',
    publicationYear: '2009', totalCitations: '500',
    lifetimeThroughYear: '2025', checkedDate: '2026-11-08'
  };
  const result2 = computeCitationMetrics({
    ...input, jifWindow: '2', benchmarkType: two.type,
    benchmarkName: two.name, benchmarkRate: String(two.rate), benchmarkSource: two.source
  }, 2026);
  const result5 = computeCitationMetrics({
    ...input, jifWindow: '5', benchmarkType: five.type,
    benchmarkName: five.name, benchmarkRate: String(five.rate), benchmarkSource: five.source
  }, 2026);
  assert.deepEqual(result2.errors, []);
  assert.deepEqual(result5.errors, []);
  assert.equal(result2.now, 28.5);
  assert.equal(Number(result2.vsBenchmark.toFixed(2)), 12.39);
  assert.equal(Number(result5.vsBenchmark.toFixed(2)), 10.18);
  assert.match(describeCitationResults(result2).benchmark, /2-year Journal Impact Factor/);
  assert.match(describeCitationResults(result5).benchmark, /5-year Journal Impact Factor/);
});

test('publisher-wide 2025 snapshot covers APA, Nature and Wiley with both JIF windows', async () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors-batch-2025.json'), 'utf8'));
  assert.equal(snapshot.schema_version, 1);
  assert.equal(snapshot.metric_year, 2025);
  const coverage = snapshot.collections.map(x => [x.publisher, x.rows.length]);
  assert.deepEqual(coverage, [
    ['American Psychological Association', 80],
    ['Springer Nature (Nature Portfolio)', 7],
    ['Wiley', 1]
  ]);
  assert.equal(coverage.reduce((n, row) => n + row[1], 0), 88);

  const review = matchPublisherBatchJif(snapshot, 'Psychological Review', '2');
  const reviewFive = matchPublisherBatchJif(snapshot, 'Psychological Review', '5');
  assert.equal(review.rate, 5.7);
  assert.equal(reviewFive.rate, 7.4);
  assert.match(review.source, /apa\.org\/pubs\/journals\/resources\/impact-factors/);
  assert.equal(review.year, 2025);

  const methods = matchPublisherBatchJif(snapshot, 'Nature Methods', '5');
  assert.equal(methods.rate, 52.4);
  assert.equal(methods.year, 2025);
  assert.equal(methods.source, 'https://www.nature.com/nmeth/journal-impact');

  const wiley = matchPublisherBatchJif(snapshot, 'The Journal of Pathology: Clinical Research', '2');
  assert.equal(wiley.rate, 4.1);
  assert.match(wiley.source, /wiley\.com/);

  assert.equal(matchPublisherBatchJif(snapshot, 'Journal We Did Not Verify', '2'), null);
  assert.equal(matchPublisherBatchJif(snapshot, '', '2'), null);
  const duplicate = JSON.parse(JSON.stringify(snapshot));
  duplicate.collections[1].rows.push(['Psychological Review', 9, 10, 'https://www.nature.com/nature/journal-impact', 2025]);
  assert.equal(matchPublisherBatchJif(duplicate, 'Psychological Review', '2'), null);
  const retrieved = await fetchPublisherBatchJif('Psychological Review', '5',
    async (url) => {
      assert.equal(url, '/journal-impact-factors-batch.json');
      return { ok: true, json: async () => snapshot };
    });
  assert.equal(retrieved.rate, 7.4);
});

test('publisher snapshot preserves each source reporting year during later releases', () => {
  const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'journal-impact-factors-batch.json'), 'utf8'));
  const revised = JSON.parse(JSON.stringify(snapshot));
  const previous = revised.collections[0].metric_year;
  const natureYear = matchPublisherBatchJif(revised, 'Nature', '2').year;
  revised.collections[0].metric_year = previous + 1;
  revised.metric_year = previous + 1;
  const nature = matchPublisherBatchJif(revised, 'Nature', '2');
  assert.equal(nature.year, natureYear, 'Nature must retain its independently sourced reporting year');
  const apa = matchPublisherBatchJif(revised, 'Psychological Review', '2');
  assert.equal(apa.year, previous + 1);
});


test('SCImago 2-year citations per document is a clearly named alternative benchmark', async () => {
  const data = {
    schema_version: 1,
    indicator: 'SCImago Cites per Doc. (2 years)',
    metric_year: 2025,
    retrieved_date: '2026-11-08',
    records: [
      ['12345678901','Neuropsychologia',['00283932','18733517'],2.5],
      ['77777777777','Another Journal',['00000001'],3.1]
    ]
  };
  const value = matchSCImagoCitesPerDoc(data, 'Neuropsychologia', '0028-3932');
  assert.equal(value.rate, 2.5);
  assert.equal(value.type, 'scimago-cpd2');
  assert.equal(value.year, 2025);
  assert.equal(value.source, 'https://www.scimagojr.com/journalsearch.php?q=12345678901&tip=sid');
  assert.match(value.name, /SCImago Cites per Doc\. \(2 years\)/);
  assert.doesNotMatch(value.name, /Journal Impact Factor/);
  assert.equal(matchSCImagoCitesPerDoc(data, 'Neuropsychologia', '1234-5678'), null);
  // OpenAlex's ISSN-L can be the print identifier while SCImago lists only the e-ISSN.
  const culturalJournal = {
    ...data,
    records: [['21101041530', 'Journal of Cultural Cognitive Science', ['25201018'], 2.20]]
  };
  assert.equal(matchSCImagoCitesPerDoc(
    culturalJournal, 'Journal of Cultural Cognitive Science', '2520-100X'), null);
  const alternateIssns = ['2520-100X', '2520-1018'];
  const culturalValue = matchSCImagoCitesPerDoc(
    culturalJournal, 'Journal of Cultural Cognitive Science', alternateIssns);
  assert.equal(culturalValue.rate, 2.20);
  assert.equal(culturalValue.type, 'scimago-cpd2');
  assert.equal(matchSCImagoCitesPerDoc(
    culturalJournal, 'Journal of Cultural Cognitive Science', ['2520-100X', '1111-1111']), null);
  const culturalMetric = computeCitationMetrics({
    recentCitations: '81', recentYears: '2', benchmarkRate: String(culturalValue.rate),
    benchmarkName: culturalValue.name, benchmarkSource: culturalValue.source,
    benchmarkType: culturalValue.type, citationSource: 'OpenAlex'
  }, 2026);
  assert.equal(Number(culturalMetric.vsBenchmark.toFixed(2)), 18.41);
  assert.equal(matchSCImagoCitesPerDoc(data, 'Unknown Journal', '0028-3932'), null);
  const duplicate = { ...data, records: [...data.records, ['11111111111', 'Neuropsychologia', ['00283932'], 9.0]] };
  assert.equal(matchSCImagoCitesPerDoc(duplicate, 'Neuropsychologia', '0028-3932'), null);
  const valueByName = matchSCImagoCitesPerDoc(data, 'Neuropsychologia');
  assert.equal(valueByName.rate, 2.5);
  const result = computeCitationMetrics({
    recentCitations: '10', recentYears: '2', benchmarkRate: String(value.rate),
    benchmarkName: value.name, benchmarkSource: value.source,
    benchmarkType: value.type, jifWindow: '2'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.vsBenchmark, 2);
  assert.match(describeCitationResults(result).benchmark, /100% above/);
  assert.match(formatCitationReport(result), /SCImago Cites per Doc/);
  assert.doesNotMatch(formatCitationReport(result), /Verify the exact JIF year/);
  assert.equal(result.benchmarkType, 'scimago-cpd2');
});

test('SCImago fetched fallback demands full official annual snapshot', async () => {
  const data = {
    schema_version: 1, metric_year: 2025,
    indicator: 'SCImago Cites per Doc. (2 years)',
    records: Array.from({ length: 20000 }, (_, i) => [
      String(20000000000 + i), i === 0 ? 'Target Journal' : 'Journal ' + i,
      [i === 0 ? '12345678' : '00000001'], i === 0 ? 1.75 : 2
    ])
  };
  const fetcher = async (url) => {
    assert.equal(url, '/scimago-cites-per-doc.json');
    return { ok: true, json: async () => data };
  };
  const metric = await fetchSCImagoCitesPerDoc('Target Journal', '1234-5678', fetcher);
  assert.equal(metric.rate, 1.75);
  const partial = { ...data, records: data.records.slice(0, 3) };
  assert.equal(await fetchSCImagoCitesPerDoc('Target Journal', '1234-5678',
    async () => ({ ok: true, json: async () => partial })), null);
  const code = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  assert.match(code, /selectedWindow === '2'\s*\?\s*fetchSCImagoCitesPerDoc/);
  assert.match(code, /const cached = known \|\| bulk;/);
  assert.match(code, /!cached && scimago && applyAutomaticBenchmark\(scimago\)/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  assert.match(html, /value="scimago-cpd2">SCImago Cites per Doc/);
  assert.match(html, /citation-metrics\.js\?v=20261111simplified/);
});

test('current-year citation window annualizes elapsed time and labels YTD', () => {
  const result = computeCitationMetrics({
    recentCitations: '12', totalCitations: '50', publicationYear: '2020',
    windowMode: 'calendar', startYear: '2025', endYear: '2026',
    lifetimeThroughYear: '2026', checkedDate: '2026-11-09', benchmarkRate: '3'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.currentYearPartial, true);
  assert.ok(result.observationYears > 1.8 && result.observationYears < 1.9);
  assert.ok(result.now > 6 && result.now < 7);
  assert.ok(result.vsLifetime > 0);
  assert.match(describeCitationResults(result).now, /2025–2026 \(current year to date\)/);
  assert.ok(result.warnings.some(message => message.includes('annualized over elapsed time')));
});

test('completed-year window remains a full two-year window', () => {
  const result = computeCitationMetrics({
    recentCitations: '12', totalCitations: '40', publicationYear: '2020',
    windowMode: 'calendar', startYear: '2024', endYear: '2025',
    lifetimeThroughYear: '2025', checkedDate: '2026-11-09'
  }, 2026);
  assert.deepEqual(result.errors, []);
  assert.equal(result.currentYearPartial, false);
  assert.equal(result.observationYears, 2);
  assert.equal(result.now, 6);
});
