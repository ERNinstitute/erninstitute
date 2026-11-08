// Publisher-sourced Journal Impact Factor lookup for Cloudflare Pages.
// Source metadata comes from OpenAlex; the only remote HTML targets are approved publisher hosts.
const PUBLISHER_HOSTS = new Set([
  'www.sciencedirect.com', 'sciencedirect.com', 'www.elsevier.com', 'journals.elsevier.com',
  'link.springer.com', 'www.springer.com', 'springer.com',
  'onlinelibrary.wiley.com', 'journals.sagepub.com',
  'www.tandfonline.com', 'tandfonline.com', 'academic.oup.com',
  'www.cambridge.org', 'www.nature.com', 'nature.com',
  'www.apa.org', 'journals.plos.org', 'www.mdpi.com', 'www.frontiersin.org'
]);

function safePublisherUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !PUBLISHER_HOSTS.has(url.hostname) ||
        url.username || url.password || url.port || url.search.length > 180) return null;
    return url.href;
  } catch { return null; }
}

function journalSlug(title) {
  return String(title || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function publisherPage(source) {
  const name = String(source.display_name || '');
  const home = safePublisherUrl(source.homepage_url);
  const org = String(source.host_organization_name || '').toLowerCase();
  // ScienceDirect's canonical journal landing pages are stable and display journal metrics.
  if (/elsevier/i.test(org) || /(?:sciencedirect|elsevier)\.com$/i.test(String(source.homepage_url || '').split('/')[2] || '')) {
    return `https://www.sciencedirect.com/journal/${journalSlug(name)}`;
  }
  return home;
}

function plainText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(?:ndash|mdash);/gi, '-').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return plainText(String(value || '')).toLowerCase().replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function parsePublisherJif(html, journalName) {
  if (typeof html !== 'string' || html.length < 90) return null;
  const heading = [...html.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/gi)]
    .map(m => normalizeName(m[1]));
  const expected = normalizeName(journalName);
  // Never attribute another journal's metrics to this journal.
  if (!expected || !heading.some(h => h === expected || h.startsWith(expected + ' ') ||
    h.includes(' ' + expected + ' ') || h.endsWith(' ' + expected))) return null;
  const text = plainText(html);
  const patterns = [
    /(?:Journal\s+)?Impact\s+Factor\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,3})?)(?![\d.\-])(?:\s*\((20\d{2})\))?/gi,
    /(\d{1,2}(?:\.\d{1,3})?)(?![\d.\-])\s+(?:Journal\s+)?Impact\s+Factor(?:\s*\((20\d{2})\))?/gi
  ];
  const candidates = [];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const value = Number(m[1]);
      if (!(value > 0 && value <= 99)) continue;
      const preceding = text.slice(Math.max(0, m.index - 25), m.index);
      // The next metric on the page may be a 5-year JIF. Exclude only if THIS match is 5-year.
      if (/(?:5|five)[- ]year\s*$/i.test(preceding)) continue;
      const yearBefore = preceding.match(/\b(20\d{2})\s*(?:[-:])?\s*$/);
      const year = m[2] ? Number(m[2]) : yearBefore ? Number(yearBefore[1]) : null;
      if (year && (year < 2000 || year > new Date().getUTCFullYear())) continue;
      candidates.push({ value, year, index: m.index });
    }
  }
  if (!candidates.length) return null;
  const distinct = [...new Set(candidates.map(c => c.value))];
  // Conflicting two-year values on one page mean we cannot safely select the current JIF.
  if (distinct.length > 1) return null;
  const withYear = candidates.find(c => c.year);
  return { value: distinct[0], year: withYear ? withYear.year : null };
}

async function fetchLimited(url, fetcher, timeoutMs = 7500) {
  let target = safePublisherUrl(url);
  if (!target) throw new Error('Publisher URL is not supported');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(target, { redirect: 'manual',
      headers: { Accept: 'text/html', 'User-Agent': 'ERN-Institute-Journal-Metrics/1.0 (+https://erninstitute.com/metrics.html)' },
      signal: AbortSignal.timeout(timeoutMs) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      target = safePublisherUrl(new URL(location || '', target).href);
      if (!target) throw new Error('Publisher redirected to an unsupported location');
      continue;
    }
    if (!response.ok) throw new Error('Publisher page not available');
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 1000000) throw new Error('Publisher page exceeds inspection limit');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No publisher HTML available');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1000000) { await reader.cancel(); throw new Error('Publisher page exceeds inspection limit'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    return { html: new TextDecoder().decode(bytes), url: target };
  }
  throw new Error('Too many publisher redirects');
}

function reply(body, ttl = 900) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttl}`, 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('source') || '';
  if (!/^S\d{3,15}$/.test(id)) return reply({ verified: false, reason: 'Invalid journal identifier.' }, 60);
  const cached = typeof caches !== 'undefined' ? await caches.default.match(request) : null;
  if (cached) return cached;
  let result;
  let ttl = 900;
  try {
    const sourceResponse = await fetch(`https://api.openalex.org/sources/${id}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!sourceResponse.ok) throw new Error('Journal metadata unavailable');
    const source = await sourceResponse.json();
    if (source.type !== 'journal' || !String(source.id || '').endsWith('/' + id)) {
      throw new Error('The record is not a recognized journal');
    }
    const page = publisherPage(source);
    result = { verified: false, journal: source.display_name, issn: source.issn_l || null,
      url: page || null, reason: 'Publisher Impact Factor could not be verified automatically.' };
    if (page) {
      try {
        const htmlPage = await fetchLimited(page, fetch);
        result.url = htmlPage.url;
        const factor = parsePublisherJif(htmlPage.html, source.display_name);
        if (factor) {
          result = { ...result, verified: true, impactFactor: factor.value,
            impactFactorYear: factor.year, reason: null, publisher: String(source.host_organization_name || 'Publisher') };
          ttl = 86400;
        }
      } catch { /* Expected for publishers blocking automated requests; manual option remains. */ }
    }
  } catch {
    result = { verified: false, reason: 'Journal lookup unavailable. Enter a benchmark manually.' };
  }
  const response = reply(result, ttl);
  if (typeof caches !== 'undefined') {
    try { await caches.default.put(request, response.clone()); } catch { /* Cache is optional. */ }
  }
  return response;
}

export { safePublisherUrl, publisherPage, parsePublisherJif };
