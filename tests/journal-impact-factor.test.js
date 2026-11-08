const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'functions/api/journal-impact-factor.js'), 'utf8');
const server = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('publisher parser distinguishes standard and five-year impact factors', async () => {
  const { parsePublisherJif } = await server;
  const springer = '<html><title>Discover Sustainability | Springer Nature</title><body>' +
    'Journal metrics Journal Impact Factor 5.2 (2025) 5-year Journal Impact Factor 5.1 (2025)' +
    '<p>More journal information</p></body></html>';
  assert.deepEqual(parsePublisherJif(springer, 'Discover Sustainability'), { value: 5.2, year: 2025 });
  const elsevier = '<html><title>Neuropsychologia | ScienceDirect.com by Elsevier</title><body>' +
    '4.3 CiteScore 2.0 Impact Factor Some journal information and article information' +
    '</body></html>';
  assert.deepEqual(parsePublisherJif(elsevier, 'Neuropsychologia'), { value: 2, year: null });
  assert.equal(parsePublisherJif(springer, 'Neuropsychologia'), null);
  assert.equal(parsePublisherJif('<html><title>Neuropsychologia | Elsevier</title><body>' +
    'Journal Impact Factor 2025 is not a valid value without a number.</body></html>', 'Neuropsychologia'), null);
  assert.equal(parsePublisherJif('<html><title>Neuropsychologia | Elsevier</title><body>' +
    '5-year Journal Impact Factor 3.5 (2025), with other information.</body></html>', 'Neuropsychologia'), null);
});

test('only approved publisher journal pages are eligible', async () => {
  const { safePublisherUrl, publisherPage } = await server;
  assert.equal(safePublisherUrl('http://link.springer.com/journal/42'), null);
  assert.equal(safePublisherUrl('https://127.0.0.1/journal/42'), null);
  assert.equal(safePublisherUrl('https://example.com/?target=www.sciencedirect.com'), null);
  assert.equal(safePublisherUrl('https://link.springer.com/journal/42'), 'https://link.springer.com/journal/42');
  assert.equal(publisherPage({
    display_name: 'Neuropsychologia', host_organization_name: 'Elsevier',
    homepage_url: 'https://example.com/fake'
  }), 'https://www.sciencedirect.com/journal/neuropsychologia');
});

test('endpoint verifies journal and uses publisher-reported value only', async () => {
  const { onRequestGet } = await server;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === 'https://api.openalex.org/sources/S123') {
      return new Response(JSON.stringify({
        id: 'https://openalex.org/S123', type: 'journal', display_name: 'Neuropsychologia',
        issn_l: '0028-3932', host_organization_name: 'Elsevier',
        homepage_url: 'https://www.sciencedirect.com/journal/neuropsychologia'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === 'https://www.sciencedirect.com/journal/neuropsychologia') {
      return new Response('<html><title>Neuropsychologia | Elsevier</title><body>' +
        '4.3 CiteScore 2.0 Impact Factor A journal about cognition and neuroscience.</body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } });
    }
    throw Error('Unexpected request: ' + url);
  };
  try {
    const response = await onRequestGet({ request: new Request('https://erninstitute.com/api/journal-impact-factor?source=S123') });
    const data = await response.json();
    assert.equal(data.verified, true);
    assert.equal(data.impactFactor, 2);
    assert.equal(data.impactFactorYear, null);
    assert.equal(data.issn, '0028-3932');
    assert.equal(data.url, 'https://www.sciencedirect.com/journal/neuropsychologia');
    assert.deepEqual(calls, ['https://api.openalex.org/sources/S123','https://www.sciencedirect.com/journal/neuropsychologia']);
  } finally { globalThis.fetch = originalFetch; }
});

test('malformed journal ID is rejected without external requests', async () => {
  const { onRequestGet } = await server;
  const response = await onRequestGet({ request: new Request('https://erninstitute.com/api/journal-impact-factor?source=https://example.com') });
  assert.equal((await response.json()).verified, false);
});

test('calculator retains manuscript names and has DOI-lookup publisher UI', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'metrics.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'citation-metrics.js'), 'utf8');
  assert.match(html, /id="citation-journal-status"/);
  assert.match(html, /id="citation-jif-source-link"/);
  assert.match(js, /lookupPublisherJif\(work, normalizeDoi\(doi\)\)/);
  for (const label of ['Citations Per Year (Now)', 'Citations Per Year (Now vs. Lifetime)',
    'Citations Per Year (Now vs. Benchmark)']) {
    assert.ok(html.includes(label));
  }
});
