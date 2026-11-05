'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

require('../effect-size-converter.js');
global.window = global;
require('../publication-workbook.js');

const core = global.ERNEffectSizeConverterCore;
const dataPath = path.join(__dirname, '..', 'downloads', 'open-data', 'ern-ready-crede2010-attendance-grades.csv');
const { records, headers } = core.parseDelimited(fs.readFileSync(dataPath, 'utf8'));
const results = records.map((record) => core.calculateRecord(record).result);

assert.equal(records.length, 54, 'real attendance dataset should have 54 input rows');
assert.equal(results.length, 54);
assert.ok(results.every((result) => Number.isFinite(result.effect_size)));

const csv = core.buildResultsCsv(results);
const parsed = core.parseDelimited(csv);
assert.equal(parsed.records.length, 54, 'results CSV should preserve all effect sizes');
assert.equal(parsed.headers.length, 18, 'results CSV should retain its 18 columns');
assert.equal(parsed.records[0].effect_id, results[0].effect_id);
assert.equal(Number(parsed.records[0].effect_size), results[0].effect_size);
assert.equal(Number(parsed.records[53].sampling_variance), results[53].sampling_variance);

const complex = [{ ...results[0], notes: 'Comma, quote " and\nnewline', formula: 'A, "B"' }];
const escaped = core.parseDelimited(core.buildResultsCsv(complex));
assert.equal(escaped.records[0].notes, complex[0].notes);
assert.equal(escaped.records[0].formula, complex[0].formula);

(async () => {
  const workbook = await global.ERNWorkbookExporter.buildPublicationWorkbook({
    records, headers, results, validationItems: [], forests: [], metaAnalyses: [],
    sourceName: 'Class attendance and grades'
  });
  assert.equal(workbook.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const bytes = Buffer.from(await workbook.arrayBuffer());
  assert.ok(bytes.length > 10000, 'publication workbook should contain the populated sheets');

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ern-export-test-'));
  const filename = path.join(directory, 'publication-workbook.xlsx');
  try {
    fs.writeFileSync(filename, bytes);
    const archiveCheck = execFileSync('unzip', ['-t', filename], { encoding: 'utf8' });
    assert.match(archiveCheck, /No errors detected in compressed data/);
    const xml = execFileSync('unzip', ['-p', filename, 'xl/workbook.xml'], { encoding: 'utf8' });
    for (const sheet of ['Original Input', 'Calculated Effects', 'Calculation Audit', 'Forest Plots', 'Meta-Analysis Models', 'Study Weights']) {
      assert.ok(xml.includes(`name="${sheet}"`), `missing sheet ${sheet}`);
    }
    const effects = execFileSync('unzip', ['-p', filename, 'xl/worksheets/sheet4.xml'], { encoding: 'utf8' });
    assert.match(effects, /<row r="55"/);
    assert.ok(effects.includes(results[0].effect_id));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log('Export integrity passed: 54-row CSV round trip, escaping, and nine-sheet XLSX archive.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
