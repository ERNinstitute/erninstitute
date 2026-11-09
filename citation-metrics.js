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

  function parseCalendarDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }

  const yearsBetween = (start, end) => (end.getTime() - start.getTime()) / (365.2425 * 86400000);

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

    let publicationYear = asCount(input.publicationYear, 'Publication year', errors, true);
    if (publicationYear !== null && (publicationYear < 1 || publicationYear > currentYear)) {
      errors.push(`Publication year must be between 1 and ${currentYear}.`);
    }
    const totalCitations = asCount(input.totalCitations, 'Total citations', errors, true);
    const publicationDateText = String(input.publicationDate || '').trim();
    const publicationDate = publicationDateText ? parseCalendarDate(publicationDateText) : null;
    if (publicationDateText && !publicationDate) errors.push('Enter a valid publication date.');
    if (publicationDate && publicationYear !== null && publicationDate.getUTCFullYear() !== publicationYear) {
      errors.push('Publication date and publication year must agree.');
    }
    if (publicationDate && publicationYear === null) publicationYear = publicationDate.getUTCFullYear();
    const lifetimeThroughYear = asCount(input.lifetimeThroughYear, 'Lifetime count through year', errors, true);
    if (lifetimeThroughYear !== null && (lifetimeThroughYear < 1 || lifetimeThroughYear > currentYear)) {
      errors.push(`Lifetime count through year must be between 1 and ${currentYear}.`);
    }
    if (recentCitations !== null && totalCitations !== null && recentCitations > totalCitations) {
      errors.push('Recent citations cannot exceed total citations when both use the same source.');
    }

    const benchmarkType = String(input.benchmarkType || 'jif-unverified');
    const jifWindow = String(input.jifWindow || '2') === '5' ? '5' : '2';
    let benchmarkName = String(input.benchmarkName || '').trim();
    let benchmark = null;
    if (input.benchmarkRate !== '' && input.benchmarkRate !== null && input.benchmarkRate !== undefined) {
      benchmark = Number(input.benchmarkRate);
      if (!Number.isFinite(benchmark) || benchmark <= 0) {
        errors.push('Benchmark annual rate must be greater than zero.');
      }
      if (!benchmarkName) benchmarkName = benchmarkType === 'annual' ? 'annual citation benchmark' : `${jifWindow}-year Journal Impact Factor`;
    }

    if (errors.length) return { errors };

    let observationYears = recentYears;
    let articleAge = publicationYear === null ? null : Math.max(1, currentYear - publicationYear);
    let comparisonAligned = true;
    const warnings = [];
    if (windowMode === 'calendar') {
      const today = parseCalendarDate(String(input.checkedDate || '')) || parseCalendarDate(new Date().toISOString().slice(0, 10));
      const endExclusive = endYear === currentYear
        ? new Date(today.getTime() + 86400000)
        : new Date(Date.UTC(endYear + 1, 0, 1));
      const windowStart = new Date(Date.UTC(startYear, 0, 1));
      if (endYear === currentYear && today.getUTCFullYear() !== currentYear) {
        errors.push('For a current-year window, use a date checked in the current year.');
      }
      if (publicationDate && publicationDate >= endExclusive) {
        errors.push('The paper was published after the selected citation window.');
      }
      if (publicationDate && publicationDate > windowStart) {
        observationYears = yearsBetween(publicationDate, endExclusive);
        warnings.push('The recent window was shortened to the paper’s actual citable age; prepublication time was excluded.');
      } else if (publicationYear !== null && publicationYear > startYear && !publicationDate) {
        observationYears = endYear === currentYear
          ? yearsBetween(new Date(Date.UTC(publicationYear, 0, 1)), endExclusive)
          : endYear - publicationYear + 1;
        warnings.push('Years before publication were excluded. Add the exact publication date to account for a partial first year.');
      } else if (endYear === currentYear) {
        observationYears = yearsBetween(windowStart, endExclusive);
      }
      if (!publicationDate && publicationYear !== null) {
        articleAge = endYear === currentYear
          ? yearsBetween(new Date(Date.UTC(publicationYear, 0, 1)), endExclusive)
          : endYear - publicationYear + 1;
        warnings.push('Lifetime age uses the publication year as an approximation. Enter the publication date for an exact citable age.');
      } else if (publicationDate) {
        articleAge = yearsBetween(publicationDate, endExclusive);
      }
      // The manuscript compares the recent window with the lifetime rate at the SAME endpoint.
      // Do not mix a 2024–2025 numerator with a lifetime total that includes 2026.
      comparisonAligned = totalCitations === null || lifetimeThroughYear === endYear;
      if (!comparisonAligned) {
        warnings.push(`Citations Per Year (Now vs. Lifetime) is unavailable: the cumulative count must cover citations through ${endYear}, the end of the selected window. Enter that year and its corresponding citation total or look up the DOI again.`);
      }
    } else if (lifetimeThroughYear !== null && lifetimeThroughYear !== currentYear) {
      comparisonAligned = false;
      warnings.push(`Citations Per Year (Now vs. Lifetime) is unavailable: the lifetime count ends in ${lifetimeThroughYear}, but the recent duration is assumed to end in ${currentYear}. Use exact calendar years or matching counts.`);
    }
    if (errors.length || observationYears <= 0 || (articleAge !== null && articleAge <= 0)) {
      return { errors: errors.length ? errors : ['The citation window must include time after publication.'] };
    }
    const now = recentCitations / observationYears;
    const lifetime = totalCitations === null || articleAge === null || !comparisonAligned ? null : totalCitations / articleAge;
    const vsLifetime = lifetime === null || lifetime === 0 ? null : now / lifetime;
    const vsBenchmark = benchmark === null ? null : now / benchmark;
    if (windowMode === 'calendar' && endYear === currentYear) {
      warnings.push(`The ${currentYear} calendar year is not yet complete; counts for this year may be partial.`);
    }
    if (windowMode !== 'calendar' && articleAge !== null && recentYears > articleAge) {
      warnings.push(`The recent window (${recentYears} years) exceeds the paper’s age used by the calculator (${articleAge} years). Confirm that this is the period you intend to report.`);
    }
    if (lifetime === 0) warnings.push('Now vs. Lifetime is undefined when the lifetime annual citation rate is zero.');
    if (benchmark === null && benchmarkName) {
      warnings.push('Enter a benchmark value to calculate Now vs. Benchmark.');
    }
    const isJournalBenchmark = benchmarkType === 'jif' || benchmarkType === 'jif-unverified' || /\b(?:journal impact factor|jif|impact factor)\b/i.test(input.benchmarkName || '');
    if (benchmark !== null && benchmarkType === 'jif-unverified') {
      warnings.push('The Journal Impact Factor reporting year is unconfirmed. Verify the exact JIF year before formal reporting.');
    }

    return {
      errors: [], warnings, now, lifetime, vsLifetime, vsBenchmark, articleAge,
      recentCitations, recentYears, observationYears, totalCitations, publicationYear,
      publicationDate: publicationDateText, lifetimeThroughYear, comparisonAligned, windowMode, startYear, endYear,
      benchmark, benchmarkName,
      benchmarkSource: String(input.benchmarkSource || '').trim(), benchmarkType, jifWindow, isJournalBenchmark,
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
      ? `${result.startYear}–${result.endYear}`
      : `the selected ${result.recentYears}-year period`;
    let lifetimeDescription;
    if (result.lifetime === null) {
      lifetimeDescription = result.comparisonAligned
        ? 'Add the publication year and lifetime citation count to see this comparison.'
        : 'Use lifetime citations from the same cutoff year as the recent citation period.';
    } else if (result.vsLifetime === null) {
      lifetimeDescription = 'The lifetime annual citation rate is zero, so a ratio cannot be calculated.';
    } else {
      const percentDifference = Math.round(Math.abs(result.vsLifetime - 1) * 100);
      const relationship = percentDifference < 1
        ? 'approximately the same as'
        : result.vsLifetime < 1
          ? `${percentDifference}% below`
          : `${percentDifference}% above`;
      lifetimeDescription = `During ${windowDescription}, this paper's citation rate was ${relationship} its lifetime average (${formatNumber(result.lifetime)} per year).`;
    }
    let benchmarkDescription;
    if (result.vsBenchmark === null) {
      benchmarkDescription = 'Enter the journal’s 2-year Impact Factor above to calculate this comparison.';
    } else {
      benchmarkDescription = `The paper's recent citation rate was ${formatNumber(result.vsBenchmark)} times as high as the ${result.benchmarkName} (${formatNumber(result.benchmark)}).`;
      if (result.benchmarkType === 'jif-unverified') {
        benchmarkDescription += ' Reporting year not supplied.';
      }
    }
    return {
      now: `${result.recentCitations} citations during ${windowDescription}, averaging ${formatNumber(result.now)} per year.`,
      lifetime: lifetimeDescription,
      benchmark: benchmarkDescription
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
    if (result.publicationDate) lines.push(`Publication date: ${result.publicationDate}.`);
    lines.push(`Citations Per Year (Now): ${formatNumber(result.now)}. ${descriptions.now}`);
    if (result.lifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): not calculated; enter cumulative citations and citable age with a matching time cutoff.');
    } else if (result.vsLifetime === null) {
      lines.push('Citations Per Year (Now vs. Lifetime): undefined (lifetime citation rate is zero).');
    } else {
      lines.push(`Citations Per Year (Now vs. Lifetime): ${formatNumber(result.vsLifetime)}. ${descriptions.lifetime}`);
      lines.push(`Lifetime calculation: ${result.totalCitations} citations / ${formatNumber(result.articleAge)} citable years${result.lifetimeThroughYear !== null ? `, through ${result.lifetimeThroughYear}` : ''}.`);
    }
    if (result.vsBenchmark === null) {
      lines.push('Citations Per Year (Now vs. Benchmark): not calculated; no journal Impact Factor entered or retrieved.');
    } else {
      lines.push(`Citations Per Year (Now vs. Benchmark): ${formatNumber(result.vsBenchmark)}. ${descriptions.benchmark}`);
      lines.push(`Benchmark source: ${result.benchmarkSource || 'Not specified'}.`);
    }
    lines.push(`Citation source: ${result.citationSource || 'Not specified'}.`);
    lines.push(`Date checked: ${result.checkedDate || 'Not specified'}.`);
    lines.push(`Self-citations: ${result.selfCitations}.`);
    result.warnings.forEach((warning) => lines.push(`Review: ${warning}`));
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

  function openAlexLifetimeThrough(work, endYear, currentYear = new Date().getFullYear()) {
    if (!Number.isInteger(endYear) || endYear > currentYear || endYear < 1) {
      throw new Error('Select a valid cumulative citation cutoff year.');
    }
    if (endYear === currentYear) return work.cited_by_count;
    const oldest = currentYear - 9;
    if (endYear < oldest - 1) {
      throw new Error(`OpenAlex cannot reconstruct lifetime citations through ${endYear} from its ten-year annual history. Enter an independently verified cumulative count for that year.`);
    }
    if (!Array.isArray(work.counts_by_year)) {
      throw new Error('OpenAlex did not supply annual citation counts needed to align the lifetime comparison.');
    }
    // For recent papers, annual counts provide the clearest same-cutoff cumulative baseline.
    if (Number.isInteger(work.publication_year) && work.publication_year >= oldest) {
      return openAlexWindowCounts(work, work.publication_year, endYear, currentYear);
    }
    const laterCitations = openAlexWindowCounts(work, endYear + 1, currentYear, currentYear);
    const throughYear = work.cited_by_count - laterCitations;
    if (throughYear < 0) throw new Error('OpenAlex totals and annual counts do not reconcile; enter a verified cumulative count manually.');
    return throughYear;
  }

  function matchCuratedJournalJif(data, sourceId, journalName, journalIssn = '', jifWindow = '2') {
    if (!/^S\d{3,15}$/.test(String(sourceId || ''))) return null;
    const entry = data?.journals?.[sourceId];
    if (!entry || typeof entry !== 'object') return null;
    const normalize = value => String(value || '').normalize('NFKD')
      .toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalize(journalName) || normalize(entry.journal) !== normalize(journalName)) return null;
    if (journalIssn && entry.issn_l && journalIssn !== entry.issn_l) return null;
    const window = String(jifWindow) === '5' ? '5' : '2';
    const rate = entry[window === '5' ? 'impact_factor_5yr' : 'impact_factor'];
    const yearRaw = entry[window === '5' ? 'impact_factor_5yr_year' : 'impact_factor_year'];
    if (!(Number.isFinite(rate) && rate > 0 && rate < 100)) return null;
    const year = yearRaw === null || yearRaw === undefined ? null : Number(yearRaw);
    if (year !== null && (!Number.isSafeInteger(year) || year < 2000 || year > new Date().getFullYear())) return null;
    const page = String(entry.metrics_page || entry.publisher_page || '');
    if (!/^https:\/\//i.test(page)) return null;
    const period = `${window}-year `;
    return {
      type: year === null ? 'jif-unverified' : 'jif',
      name: year === null
        ? `${entry.journal} ${window}-year Journal Impact Factor (year unconfirmed)`
        : `${entry.journal} ${year} ${period}Journal Impact Factor`,
      rate, source: page, year, window,
      checkedDate: String(entry.checked_date || ''),
      yearSource: String(entry.year_corrob || ''),
      journal: entry.journal
    };
  }

  async function fetchCuratedJournalJif(sourceId, journalName, journalIssn = '', fetcher = fetch, options = {}) {
    if (!/^S\d{3,15}$/.test(String(sourceId || ''))) return null;
    const response = await fetcher('/journal-impact-factors.json?v=20261108factors',
      { headers: { Accept: 'application/json' }, signal: options.signal });
    if (!response.ok) return null;
    const registry = await response.json();
    if (registry?.schema_version !== 1) return null;
    return matchCuratedJournalJif(registry, sourceId, journalName, journalIssn, options.jifWindow);
  }

  function matchPublisherBatchJif(data, journalName, jifWindow = '2') {
    if (data?.schema_version !== 1 || !Array.isArray(data.collections)) return null;
    const norm = value => String(value || '').normalize('NFKD')
      .toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const target = norm(journalName);
    if (!target || target.length < 4) return null;
    const matches = [];
    for (const collection of data.collections) {
      if (!Array.isArray(collection.rows)) continue;
      for (const row of collection.rows) {
        if (!Array.isArray(row) || !row.length || norm(row[0]) !== target) continue;
        matches.push({ row, collection });
      }
    }
    // No guessing between identically titled journals from different publishers.
    if (matches.length !== 1) return null;
    const { row, collection } = matches[0];
    const window = String(jifWindow) === '5' ? '5' : '2';
    const value = Number(row[window === '5' ? 2 : 1]);
    const year = Number(row[4] || collection.metric_year || data.metric_year);
    const source = row[3] || collection.source;
    if (!(value > 0 && Number.isFinite(value) && value < 1000) ||
        !Number.isInteger(year) || year < 2010 || year > new Date().getFullYear() ||
        typeof source !== 'string' || !/^https:\/\//.test(source)) return null;
    return {
      type: 'jif',
      name: `${row[0]} ${year} ${window}-year Journal Impact Factor`,
      rate: value,
      source,
      year,
      window,
      checkedDate: String(row[5] || collection.checked_date || data.checked_date || ''),
      journal: String(row[0]),
      publisher: String(collection.publisher || '')
    };
  }

  async function fetchPublisherBatchJif(journalName, jifWindow = '2', fetcher = fetch, options = {}) {
    const response = await fetcher('/journal-impact-factors-batch.json',
      { headers: { Accept: 'application/json' }, cache: 'no-store', signal: options.signal });
    if (!response.ok) return null;
    return matchPublisherBatchJif(await response.json(), journalName, jifWindow);
  }

  function matchSCImagoCitesPerDoc(catalogue, journalName, journalIssn = '') {
    if (catalogue?.schema_version !== 1 ||
        catalogue.indicator !== 'SCImago Cites per Doc. (2 years)' ||
        !Array.isArray(catalogue.records)) return null;
    const year = Number(catalogue.metric_year);
    if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) return null;
    const normalizeTitle = text => String(text || '').normalize('NFKD')
      .toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizeIssn = text => String(text || '').toUpperCase().replace(/[^0-9X]/g, '');
    const title = normalizeTitle(journalName);
    const issn = normalizeIssn(journalIssn);
    if (!title) return null;
    const matches = catalogue.records.filter(row => {
      if (!Array.isArray(row) || row.length < 4 ||
          normalizeTitle(row[1]) !== title) return false;
      return !issn || (Array.isArray(row[2]) && row[2].some(value => normalizeIssn(value) === issn));
    });
    // Never guess when multiple Scopus records have an identical normalized title.
    if (matches.length !== 1) return null;
    const [scopusId, matchedTitle, issns, rate] = matches[0];
    if (!/^\d{4,15}$/.test(String(scopusId)) || !Array.isArray(issns) ||
        !Number.isFinite(rate) || rate <= 0 || rate > 1000) return null;
    return {
      type: 'scimago-cpd2',
      name: `${matchedTitle} ${year} SCImago Cites per Doc. (2 years)`,
      rate,
      source: `https://www.scimagojr.com/journalsearch.php?q=${scopusId}&tip=sid`,
      year,
      window: '2',
      journal: matchedTitle,
      checkedDate: String(catalogue.retrieved_date || ''),
      provider: 'SCImago',
      sourceMetric: 'Cites per Doc. (2 years)'
    };
  }

  async function fetchSCImagoCitesPerDoc(journalName, journalIssn = '', fetcher = fetch, options = {}) {
    const response = await fetcher('/scimago-cites-per-doc.json',
      { headers: { Accept: 'application/json' }, cache: 'no-store', signal: options.signal });
    if (!response.ok) return null;
    const data = await response.json();
    // A tiny, hand-curated exception list is not the intended broad fallback.
    if (!Array.isArray(data?.records) || data.records.length < 20000) return null;
    return matchSCImagoCitesPerDoc(data, journalName, journalIssn);
  }

  const csvHeaders = [
    'Paper title', 'DOI', 'Publication year', 'Publication date', 'Cumulative citations', 'Lifetime through year', 'Recent citations',
    'Recent years', 'Window start year', 'Window end year', 'Citations per year now',
    'Lifetime citations per year', 'Now vs lifetime', 'Benchmark type', 'Benchmark name',
    'Benchmark annual rate', 'Now vs benchmark', 'Benchmark source', 'Citation source',
    'Date checked', 'Self-citations', 'Citable age (years)', 'Observed recent years'
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
      r.paperTitle, r.doi, r.publicationYear ?? '', r.publicationDate, r.totalCitations ?? '', r.lifetimeThroughYear ?? '', r.recentCitations,
      r.recentYears, r.startYear ?? '', r.endYear ?? '', number(r.now),
      number(r.lifetime), number(r.vsLifetime), r.benchmarkType, r.benchmarkName,
      number(r.benchmark), number(r.vsBenchmark), r.benchmarkSource, r.citationSource,
      r.checkedDate, r.selfCitations, number(r.articleAge), number(r.observationYears)
    ]);
    return [csvHeaders, ...rows].map((row, rowIndex) => row.map((value, i) => safeCell(value, rowIndex === 0 || [0, 1, 13, 14, 17, 18, 19, 20].includes(i))).join(',')).join('\r\n') + '\r\n';
  }

  const api = {
    computeCitationMetrics, interpretRatio, describeCitationResults, formatCitationReport,
    normalizeDoi, fetchOpenAlexWork, matchCuratedJournalJif, fetchCuratedJournalJif, matchPublisherBatchJif, fetchPublisherBatchJif, matchSCImagoCitesPerDoc, fetchSCImagoCitesPerDoc, openAlexWindowCounts, openAlexLifetimeThrough, buildCitationCsv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ERNCitationMetrics = api;

  if (typeof document === 'undefined') return;
  const form = document.getElementById('citation-metrics-form');
  if (!form) return;

  const fields = Array.from(form.querySelectorAll('[name]'));
  const errorsBox = document.getElementById('citation-metrics-errors');
  const resultsBox = document.getElementById('citation-metrics-results');
  const resultsSource = document.getElementById('citation-results-source');
  const emptyBox = document.getElementById('citation-metrics-empty');
  const warningBox = document.getElementById('citation-metrics-warnings');
  const reportBox = document.getElementById('citation-metrics-report');
  const copyButton = document.getElementById('citation-metrics-copy');
  const addButton = document.getElementById('citation-metrics-add');
  const lookupButton = document.getElementById('citation-doi-lookup');
  const lookupInput = document.getElementById('citation-doi');
  const lookupStatus = document.getElementById('citation-doi-status');
  const lookupPaper = document.getElementById('citation-doi-paper');
  const journalStatus = document.getElementById('citation-journal-status');
  const jifSourceLink = document.getElementById('citation-jif-source-link');
  const changeBenchmarkButton = document.getElementById('citation-benchmark-change');
  const benchmarkFieldLabel = document.getElementById('citation-benchmark-label');
  const advancedDetails = document.getElementById('citation-advanced-details');
  const manualDetails = document.getElementById('citation-manual-details');
  const datesDetails = document.getElementById('citation-dates-details');
  const benchmarkDetails = document.getElementById('citation-benchmark-details');
  const reportingDetails = document.getElementById('citation-reporting-details');
  const comparisonPanel = document.getElementById('citation-comparison');
  const comparisonBody = document.getElementById('citation-comparison-body');
  const exportButton = document.getElementById('citation-comparison-export');
  const annualTrend = document.getElementById('citation-annual-trend');
  const annualTrendNote = document.getElementById('citation-annual-trend-note');
  const annualTrendBars = document.getElementById('citation-annual-trend-bars');
  const durationField = document.getElementById('citation-duration-field');
  const calendarFields = document.getElementById('citation-calendar-fields');
  const windowModeField = form.elements.namedItem('windowMode');
  let calculated = false;
  let latestResult = null;
  let comparisonRows = [];
  let nextComparisonId = 1;
  let editingRowId = null;
  let lastDoiWindow = null;
  let publisherLookupSequence = 0;
  let autoBenchmarkSource = null;
  let manualBenchmark = false;
  let lastLookedUpDoi = null;
  let lastJournalName = '';
  let lastLookedUpWork = null;

  function resetPublisherLookup(clearAuto = false) {
    publisherLookupSequence++;
    journalStatus.hidden = true;
    jifSourceLink.hidden = true;
    jifSourceLink.removeAttribute('href');
    changeBenchmarkButton.hidden = true;
    if (clearAuto && autoBenchmarkSource &&
        form.elements.namedItem('benchmarkSource').value === autoBenchmarkSource) {
      setField('benchmarkType', 'jif-unverified');
      setField('benchmarkName', '');
      setField('benchmarkRate', '');
      setField('benchmarkSource', '');
    }
    autoBenchmarkSource = null;
    if (benchmarkFieldLabel) benchmarkFieldLabel.textContent = 'Journal Impact Factor (optional)';
  }

  function showBenchmarkSource(url, label) {
    if (typeof url !== 'string' || !/^https:\/\//.test(url)) return;
    jifSourceLink.href = url;
    jifSourceLink.textContent = label;
    jifSourceLink.hidden = false;
  }

  function applyAutomaticBenchmark(data) {
    if (!data || !(data.rate > 0) || !Number.isFinite(data.rate) || manualBenchmark) return false;
    if (form.elements.namedItem('benchmarkRate').value && !autoBenchmarkSource) return false;
    setField('benchmarkType', data.type);
    if (benchmarkFieldLabel) benchmarkFieldLabel.textContent = data.type === 'scimago-cpd2'
      ? 'SCImago Cites per Doc. (2 years)'
      : 'Journal Impact Factor (optional)';
    setField('benchmarkName', data.name);
    setField('benchmarkRate', data.rate);
    setField('benchmarkSource', data.source);
    autoBenchmarkSource = data.source;
    changeBenchmarkButton.hidden = false;
    if (calculated) calculate();
    return true;
  }

  function findJournal(work) {
    if (work.primary_location?.source?.type === 'journal') return work.primary_location.source;
    return Array.isArray(work.locations)
      ? work.locations.map(x => x?.source).find(x => x?.type === 'journal') || null
      : null;
  }

  async function lookupJournalBenchmark(work, doi) {
    const journal = findJournal(work);
    const name = String(journal?.display_name || '');
    lastJournalName = name;
    const sourceId = String(journal?.id || '').match(/\/S\d{3,15}$/)?.[0]?.slice(1);
    const selectedWindow = form.elements.namedItem('jifWindow').value === '5' ? '5' : '2';
    const sequence = ++publisherLookupSequence;
    journalStatus.hidden = false;
    if (!name || !sourceId) {
      journalStatus.textContent = name
        ? `Journal: ${name}. The journal benchmark is optional.`
        : 'No journal was identified. The journal benchmark is optional.';
      return;
    }
    journalStatus.textContent = `Journal: ${name}. Checking the ${selectedWindow}-year Journal Impact Factor…`;
    // Try both public, source-documented annual snapshots. Both work on static hosting.
    // Server-side publisher extraction is an optional last resort for missing titles.
    const [known, bulk, scimago] = await Promise.all([
      fetchCuratedJournalJif(sourceId, name, String(journal?.issn_l || ''), fetch,
        { signal: AbortSignal.timeout(6500), jifWindow: selectedWindow }).catch(() => null),
      fetchPublisherBatchJif(name, selectedWindow, fetch,
        { signal: AbortSignal.timeout(6500) }).catch(() => null),
      selectedWindow === '2'
        ? fetchSCImagoCitesPerDoc(name, String(journal?.issn_l || ''), fetch,
          { signal: AbortSignal.timeout(6500) }).catch(() => null)
        : Promise.resolve(null)
    ]);
    const cached = known || bulk;
    let publisher = Promise.resolve(null);
    if (!cached && selectedWindow === '2') {
      publisher = fetch(`/api/journal-impact-factor?source=${encodeURIComponent(sourceId)}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
        .then(async response => response.ok ? response.json() : null).catch(() => null);
    }
    if (sequence !== publisherLookupSequence ||
        normalizeDoi(form.elements.namedItem('doi').value) !== doi) return;

    if (cached && applyAutomaticBenchmark(cached)) {
      journalStatus.textContent = cached.year
        ? `Journal: ${name}. ${cached.year} ${selectedWindow}-year Impact Factor: ${cached.rate.toFixed(2)} (publisher-listed; checked ${cached.checkedDate}).`
        : `Journal: ${name}. ${selectedWindow}-year Impact Factor: ${cached.rate.toFixed(2)} (publisher-listed; reporting year unconfirmed).`;
      showBenchmarkSource(cached.source, 'View journal’s publisher page');
    } else if (!cached && scimago && applyAutomaticBenchmark(scimago)) {
      journalStatus.textContent = `Journal: ${name}. SCImago ${scimago.year} Cites per Doc. (2 years): ${scimago.rate.toFixed(2)}. Scopus-based alternative, not the official Journal Impact Factor.`;
      showBenchmarkSource(scimago.source, 'View SCImago journal profile');
    }

    const data = await publisher;
    if (sequence !== publisherLookupSequence ||
        normalizeDoi(form.elements.namedItem('doi').value) !== doi) return;
    if (selectedWindow === '2' && data?.verified && Number.isFinite(data.impactFactor) && data.impactFactor > 0) {
      const label = String(data.journal || name);
      const year = Number.isInteger(data.impactFactorYear) ? data.impactFactorYear : null;
      // A dated source-documented benchmark takes precedence over undated or older HTML.
      if (!cached || (year && year >= cached.year)) {
        const chosen = applyAutomaticBenchmark({
          type: year ? 'jif' : 'jif-unverified',
          name: year ? `${label} ${year} 2-year Journal Impact Factor`
            : `${label} publisher-listed 2-year Journal Impact Factor (year unstated; checked ${localDate})`,
          rate: data.impactFactor,
          source: data.url
        });
        if (chosen) {
          journalStatus.textContent = year
            ? `Journal: ${label}. Publisher-reported ${year} Journal Impact Factor: ${data.impactFactor.toFixed(2)}.`
            : `Journal: ${label}. Publisher reports an Impact Factor of ${data.impactFactor.toFixed(2)}, but its year is not stated. Provisional until the year is verified.`;
          showBenchmarkSource(data.url, 'View publisher Impact Factor source');
        }
      }
    } else if (!cached && !scimago) {
      journalStatus.textContent = `Journal: ${name}. No verified ${selectedWindow}-year journal metric was retrieved. Enter a benchmark value manually if desired.`;
      if (typeof data?.url === 'string') showBenchmarkSource(data.url, 'View publisher journal page');
    }
  }

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

  function citationWindowSignature() {
    const input = readInput();
    return [input.doi, input.windowMode, input.recentYears, input.startYear, input.endYear].join('|');
  }

  function renderAnnualTrend(work, endYear, currentYear) {
    annualTrendBars.replaceChildren();
    if (!Array.isArray(work.counts_by_year)) {
      annualTrend.hidden = true;
      return;
    }
    const counts = new Map(work.counts_by_year.map(({ year, cited_by_count }) => [year, cited_by_count]));
    const firstYear = Math.max(work.publication_year, currentYear - 9);
    const values = [];
    for (let year = firstYear; year <= currentYear; year += 1) {
      values.push({ year, count: counts.get(year) || 0 });
    }
    const max = Math.max(1, ...values.map((entry) => entry.count));
    for (const item of values) {
      const row = document.createElement('div');
      row.className = 'citation-trend-row';
      row.setAttribute('role', 'listitem');
      const label = document.createElement('span');
      label.className = 'citation-trend-year';
      label.textContent = `${item.year}${item.year === currentYear ? ' YTD' : ''}`;
      const track = document.createElement('span');
      track.className = 'citation-trend-track';
      const bar = document.createElement('span');
      bar.className = 'citation-trend-bar';
      if (item.year === currentYear) bar.classList.add('citation-trend-bar-partial');
      bar.style.width = `${100 * item.count / max}%`;
      track.appendChild(bar);
      const count = document.createElement('strong');
      count.className = 'citation-trend-count';
      count.textContent = item.count.toLocaleString('en');
      row.append(label, track, count);
      annualTrendBars.appendChild(row);
    }
    annualTrendNote.textContent = `The ${currentYear} count is year to date, not a completed year. The selected recent rate uses ${endYear === currentYear ? 'a partial current-year window' : `completed years through ${endYear}`}. These annual counts are from OpenAlex, which may differ from Google Scholar.`;
    annualTrend.hidden = false;
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
    resultsSource.textContent = `Citation source: ${result.citationSource || 'Not specified'}`;
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
        if (i === 0 && result.citationSource) {
          const source = document.createElement('small');
          source.textContent = `Source: ${result.citationSource}`;
          td.appendChild(source);
        }
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
  form.addEventListener('input', (event) => {
    if (event.target.name === 'doi') {
      resetPublisherLookup(true);
      lastJournalName = '';
      lastLookedUpWork = null;
    }
    if (event.target.name === 'benchmarkRate') {
      // A manual value must never inherit the previous publisher's source or year.
      if (autoBenchmarkSource) {
        setField('benchmarkName', '');
        setField('benchmarkSource', '');
      }
      if (lastJournalName && !form.elements.namedItem('benchmarkName').value) {
        setField('benchmarkName', `${lastJournalName} ${form.elements.namedItem('jifWindow').value}-year Journal Impact Factor (year not entered)`);
      }
      setField('benchmarkType', 'jif-unverified');
      if (benchmarkFieldLabel) benchmarkFieldLabel.textContent = 'Journal Impact Factor (optional)';
      manualBenchmark = true;
      autoBenchmarkSource = null;
      changeBenchmarkButton.hidden = false;
    } else if (['benchmarkType', 'benchmarkName', 'benchmarkSource'].includes(event.target.name)) {
      manualBenchmark = true;
      autoBenchmarkSource = null;
    }
    if (event.target.name === 'citationSource' && lastDoiWindow !== null
        && String(event.target.value).trim().toLowerCase() !== 'openalex') {
      // Counts retrieved from OpenAlex must never be relabeled as a different database.
      setField('recentCitations', '');
      setField('totalCitations', '');
      setField('lifetimeThroughYear', '');
      annualTrend.hidden = true;
      lastDoiWindow = null;
      lookupStatus.textContent = 'OpenAlex counts have been cleared. Enter recent and cumulative counts from your selected citation database, using the same cutoff.';
    }
    if (event.target.name === 'totalCitations' && event.target.value && windowModeField.value === 'calendar'
        && !form.elements.namedItem('lifetimeThroughYear').value) {
      datesDetails.open = true;
    }
    if (lastDoiWindow !== null && ['doi', 'windowMode', 'recentYears', 'startYear', 'endYear'].includes(event.target.name)
        && citationWindowSignature() !== lastDoiWindow) {
      setField('recentCitations', '');
      setField('totalCitations', '');
      setField('lifetimeThroughYear', '');
      annualTrend.hidden = true;
      if (event.target.name === 'doi') lookupPaper.hidden = true;
      lastDoiWindow = null;
      lookupStatus.textContent = 'The citation window changed. Look up the DOI again to retrieve matching counts, or enter verified counts manually.';
    }
    if (calculated) calculate();
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'jifWindow') {
      // Never reuse the other window's publisher or manually entered figure.
      resetPublisherLookup(true);
      ['benchmarkRate', 'benchmarkName', 'benchmarkSource'].forEach(name => setField(name, ''));
      setField('benchmarkType', 'jif-unverified');
      manualBenchmark = false;
      if (lastLookedUpWork) {
        void lookupJournalBenchmark(lastLookedUpWork, normalizeDoi(form.elements.namedItem('doi').value));
      } else if (lastJournalName) {
        journalStatus.hidden = false;
        journalStatus.textContent = `Enter the selected ${event.target.value}-year Impact Factor for ${lastJournalName}.`;
      }
    }
    updateWindowMode();
    if (lastDoiWindow !== null && citationWindowSignature() !== lastDoiWindow) {
      setField('recentCitations', '');
      setField('totalCitations', '');
      setField('lifetimeThroughYear', '');
      annualTrend.hidden = true;
      lastDoiWindow = null;
      lookupStatus.textContent = 'The citation window changed. Look up the DOI again to retrieve matching counts, or enter verified counts manually.';
    }
    if (calculated) calculate();
  });
  updateWindowMode();

  lookupInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!lookupButton.disabled) lookupButton.click();
    }
  });

  lookupButton.addEventListener('click', async () => {
    const doi = form.elements.namedItem('doi').value;
    resetPublisherLookup(true);
    try {
      const normalized = normalizeDoi(doi);
      if (lastLookedUpDoi && lastLookedUpDoi !== normalized) {
        ['benchmarkName', 'benchmarkRate', 'benchmarkSource'].forEach(name => setField(name, ''));
        setField('benchmarkType', 'jif-unverified');
        manualBenchmark = false;
      }
      lastLookedUpDoi = normalized;
    } catch { /* The lookup below reports an invalid DOI. */ }
    lookupPaper.hidden = true;
    lookupButton.disabled = true;
    lookupButton.textContent = 'Looking up…';
    lookupStatus.textContent = 'Checking OpenAlex for public citation information…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const work = await fetchOpenAlexWork(doi, fetch, { signal: controller.signal });
      lastLookedUpWork = work;
      const input = readInput();
      const currentYear = new Date().getFullYear();
      const duration = Number(input.recentYears);
      const startYear = input.windowMode === 'calendar' ? Number(input.startYear) : currentYear - duration;
      const endYear = input.windowMode === 'calendar' ? Number(input.endYear) : currentYear - 1;
      const recentCitations = openAlexWindowCounts(work, startYear, endYear, currentYear);
      let cumulativeCitations = null;
      let cumulativeWarning = '';
      try {
        cumulativeCitations = openAlexLifetimeThrough(work, endYear, currentYear);
      } catch (error) {
        cumulativeWarning = error.message;
      }
      setField('doi', normalizeDoi(doi));
      setField('paperTitle', work.display_name);
      setField('publicationYear', work.publication_year);
      setField('publicationDate', work.publication_date || '');
      setField('totalCitations', cumulativeCitations);
      setField('lifetimeThroughYear', cumulativeCitations === null ? '' : endYear);
      setField('recentCitations', recentCitations);
      setField('windowMode', 'calendar');
      setField('startYear', startYear);
      setField('endYear', endYear);
      setField('recentYears', endYear - startYear + 1);
      setField('citationSource', 'OpenAlex');
      setField('checkedDate', localDate);
      if (manualBenchmark && form.elements.namedItem('benchmarkRate').value &&
          !form.elements.namedItem('benchmarkName').value) {
        const name = findJournal(work)?.display_name || 'Journal';
        setField('benchmarkName', `${name} ${form.elements.namedItem('jifWindow').value}-year Journal Impact Factor (year not entered)`);
      }
      setField('selfCitations', 'Not specified');
      updateWindowMode();
      lastDoiWindow = citationWindowSignature();
      lookupPaper.textContent = `${work.display_name} (${work.publication_year})`;
      lookupPaper.hidden = false;
      lookupStatus.textContent = cumulativeCitations === null
        ? `OpenAlex: ${recentCitations} citations in ${startYear}–${endYear}. ${cumulativeWarning} Its current total of ${work.cited_by_count} cannot be used for a historical cutoff.`
        : `OpenAlex: ${recentCitations} citations in ${startYear}–${endYear}, ${cumulativeCitations} cumulative citations through ${endYear} (${work.cited_by_count} in total as of this lookup). Later citations are excluded from the comparison.`;
      renderAnnualTrend(work, endYear, currentYear);
      calculated = true;
      calculate();
      // Publisher fetching must not block the primary citation results.
      void lookupJournalBenchmark(work, normalizeDoi(doi));
    } catch (error) {
      lookupStatus.textContent = error.name === 'AbortError'
        ? 'OpenAlex did not respond within 15 seconds. You can enter citation counts manually.'
        : error.message || 'The DOI lookup is unavailable. You can enter the citation counts manually.';
    } finally {
      clearTimeout(timeout);
      lookupButton.disabled = false;
      lookupButton.textContent = 'Get citation metrics';
    }
  });

  changeBenchmarkButton.addEventListener('click', () => {
    advancedDetails.open = true;
    benchmarkDetails.open = true;
    benchmarkDetails.scrollIntoView({ block: 'nearest' });
    form.elements.namedItem('benchmarkName').focus();
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
    advancedDetails.open = true;
    manualDetails.open = true;
    datesDetails.open = !!row.input.lifetimeThroughYear || !!row.input.publicationDate;
    benchmarkDetails.open = !!row.input.benchmarkRate || !!row.input.benchmarkName;
    reportingDetails.open = !!row.input.selfCitations && row.input.selfCitations !== 'Not specified';
    lookupPaper.hidden = true;
    resetPublisherLookup(false);
    manualBenchmark = true;
    lastLookedUpDoi = null;
    lastJournalName = '';
    lastLookedUpWork = null;
    lastDoiWindow = null;
    annualTrend.hidden = true;
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
      recentCitations: '10', recentYears: '2', windowMode: 'duration', benchmarkType: 'annual',
      benchmarkName: 'Illustrative annual benchmark (not a real journal factor)',
      benchmarkRate: '3', benchmarkSource: 'Illustrative example only', citationSource: 'Illustrative example',
      checkedDate: localDate, selfCitations: 'Included'
    };
    fields.forEach((field) => { field.value = example[field.name] ?? ''; });
    advancedDetails.open = true;
    manualDetails.open = true;
    datesDetails.open = false;
    benchmarkDetails.open = false;
    reportingDetails.open = false;
    lookupPaper.hidden = true;
    resetPublisherLookup(false);
    manualBenchmark = true;
    lastLookedUpDoi = null;
    lastJournalName = '';
    lastLookedUpWork = null;
    lastDoiWindow = null;
    annualTrend.hidden = true;
    lookupStatus.textContent = 'Example values are illustrative and are not retrieved from a citation database.';
    resetEditing();
    updateWindowMode();
    calculated = true;
    calculate();
  });
  document.getElementById('citation-metrics-clear').addEventListener('click', () => {
    form.reset();
    advancedDetails.open = false;
    manualDetails.open = false;
    datesDetails.open = false;
    benchmarkDetails.open = false;
    reportingDetails.open = false;
    lookupPaper.hidden = true;
    resetPublisherLookup(false);
    manualBenchmark = false;
    lastLookedUpDoi = null;
    lastJournalName = '';
    lastLookedUpWork = null;
    lastDoiWindow = null;
    annualTrend.hidden = true;
    if (dateField) dateField.value = localDate;
    lookupStatus.textContent = 'Using OpenAlex. The default is the last two completed calendar years; change the window under More options.';
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
