(() => {
  'use strict';

  const encoder = new TextEncoder();

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function utf8(value) {
    return encoder.encode(String(value ?? ''));
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function uint16(value) {
    const out = new Uint8Array(2);
    const view = new DataView(out.buffer);
    view.setUint16(0, value, true);
    return out;
  }

  function uint32(value) {
    const out = new Uint8Array(4);
    const view = new DataView(out.buffer);
    view.setUint32(0, value >>> 0, true);
    return out;
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1F);
    const dosDate = (((year - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0x0F) << 5) | (date.getDate() & 0x1F);
    return { dosTime, dosDate };
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const { dosTime, dosDate } = dosDateTime();

    files.forEach((file) => {
      const name = utf8(file.name);
      const data = file.data instanceof Uint8Array ? file.data : utf8(file.data);
      const crc = crc32(data);
      const flags = 0x0800;
      const localHeader = concatBytes([
        uint32(0x04034B50), uint16(20), uint16(flags), uint16(0), uint16(dosTime), uint16(dosDate),
        uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), name
      ]);
      localParts.push(localHeader, data);

      const centralHeader = concatBytes([
        uint32(0x02014B50), uint16(20), uint16(20), uint16(flags), uint16(0), uint16(dosTime), uint16(dosDate),
        uint32(crc), uint32(data.length), uint32(data.length), uint16(name.length), uint16(0), uint16(0),
        uint16(0), uint16(0), uint32(0), uint32(offset), name
      ]);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    });

    const central = concatBytes(centralParts);
    const local = concatBytes(localParts);
    const eocd = concatBytes([
      uint32(0x06054B50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
      uint32(central.length), uint32(local.length), uint16(0)
    ]);
    return concatBytes([local, central, eocd]);
  }

  function colName(index) {
    let n = index + 1;
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function cellRef(row, col) {
    return `${colName(col)}${row + 1}`;
  }

  function cellXml(value, row, col, style = 3) {
    if (value === null || value === undefined || value === '') return '';
    const ref = cellRef(row, col);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    }
    if (typeof value === 'boolean') {
      return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
    }
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }

  function worksheetXml({ rows, styles = [], widths = [], rowHeights = [], freezeRows = 1, autoFilter = '', merges = [], drawingRel = '' }) {
    const maxCols = Math.max(1, ...rows.map((row) => row.length));
    const maxRows = Math.max(1, rows.length);
    const dimension = `A1:${cellRef(maxRows - 1, maxCols - 1)}`;
    const cols = widths.length
      ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const pane = freezeRows > 0
      ? `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';
    const sheetRows = rows.map((row, rowIndex) => {
      const cells = row.map((value, colIndex) => cellXml(value, rowIndex, colIndex, styles[rowIndex]?.[colIndex] ?? (rowIndex === 0 ? 2 : 3))).join('');
      const height = rowHeights[rowIndex] ? ` ht="${rowHeights[rowIndex]}" customHeight="1"` : '';
      return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
    }).join('');
    const mergeXml = merges.length ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : '';
    const filterXml = autoFilter ? `<autoFilter ref="${autoFilter}"/>` : '';
    const drawingXml = drawingRel ? `<drawing r:id="${drawingRel}"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>${pane}<sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${sheetRows}</sheetData>${filterXml}${mergeXml}${drawingXml}</worksheet>`;
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00000"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="15"/><name val="Aptos Display"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font>
<font><b/><color rgb="FF1D3557"/><sz val="11"/><name val="Aptos"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1D3557"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE9F2FA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6DF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF3F7FB"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7E0EB"/></left><right style="thin"><color rgb="FFD7E0EB"/></right><top style="thin"><color rgb="FFD7E0EB"/></top><bottom style="thin"><color rgb="FFD7E0EB"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function pngBytesFromDataUrl(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function svgDimensions(svg) {
    const match = String(svg).match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
    if (!match) return { width: 1120, height: 600 };
    return { width: Number(match[3]) || 1120, height: Number(match[4]) || 600 };
  }

  async function svgToPng(svg) {
    const dimensions = svgDimensions(svg);
    const maxWidth = 1500;
    const scale = Math.min(1.5, maxWidth / dimensions.width);
    const width = Math.max(1, Math.round(dimensions.width * scale));
    const height = Math.max(1, Math.round(dimensions.height * scale));
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'async';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('A forest plot could not be rendered for the workbook.'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return { bytes: pngBytesFromDataUrl(canvas.toDataURL('image/png')), width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function drawingXml(images) {
    const anchors = images.map((image, index) => {
      const row = image.anchorRow;
      const cx = Math.round(image.displayWidth * 9525);
      const cy = Math.round(image.displayHeight * 9525);
      return `<xdr:oneCellAnchor>
<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:ext cx="${cx}" cy="${cy}"/>
<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="Forest plot ${index + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr>
<xdr:blipFill><a:blip r:embed="rId${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/>
</xdr:oneCellAnchor>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
  }

  function drawingRelsXml(images) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${images.map((image, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.png"/>`).join('')}</Relationships>`;
  }

  function sheetRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
  }

  function contentTypesXml(sheetCount, imageCount) {
    const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const drawing = imageCount ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '';
    const png = imageCount ? '<Default Extension="png" ContentType="image/png"/>' : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${png}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}${drawing}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  }

  function workbookXml(sheetNames) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="15000"/></bookViews><sheets>${sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets><calcPr calcId="191029"/></workbook>`;
  }

  function workbookRelsXml(sheetCount) {
    const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  }

  function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  }

  function corePropsXml(now) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>ERN Meta-Analysis Studio publication workbook</dc:title><dc:creator>ERN Institute</dc:creator><cp:lastModifiedBy>ERN Institute</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:modified></cp:coreProperties>`;
  }

  function appPropsXml(sheetNames) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ERN Meta-Analysis Studio</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="lpstr">${sheetNames.map((name) => `<vt:lpstr>${xmlEscape(name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts><Company>ERN Institute</Company><AppVersion>1.0</AppVersion></Properties>`;
  }

  function styleRows(rows, headerRow = 0, numericCols = []) {
    return rows.map((row, rowIndex) => row.map((_, colIndex) => {
      if (rowIndex === headerRow) return 2;
      return numericCols.includes(colIndex) ? 4 : 3;
    }));
  }

  function normalizeIssue(issue) {
    return {
      row: issue.row ?? '',
      study_id: issue.study_id || '',
      effect_id: issue.effect_id || '',
      severity: issue.severity || 'error',
      column: issue.column || '',
      entered_value: issue.entered_value ?? '',
      code: issue.code || '',
      message: issue.message || '',
      fix: issue.fix || ''
    };
  }

  const dataDictionary = [
    ['Column', 'Purpose', 'Used by'],
    ['study_id', 'Study citation or short label.', 'All rows'],
    ['effect_id', 'Unique identifier for one effect-size record.', 'All rows'],
    ['calculation_type', 'One of independent_means, independent_t, independent_f, correlation, or binary.', 'All rows'],
    ['mean1, sd1, n1', 'Group 1 mean, standard deviation, and sample size.', 'Independent means'],
    ['mean2, sd2, n2', 'Group 2 mean, standard deviation, and sample size.', 'Independent means; n1/n2 also used by t and F'],
    ['t_value', 'Signed Student independent-groups t statistic.', 'Independent t'],
    ['f_value', 'F statistic from a simple two-group between-subjects test.', 'Independent F'],
    ['f_df1', 'Numerator degrees of freedom; must equal 1.', 'Independent F'],
    ['f_df2', 'Denominator degrees of freedom; must equal n1 + n2 − 2.', 'Independent F'],
    ['f_direction', 'group1_higher or group2_higher because F has no sign.', 'Independent F'],
    ['r_value, n', 'Pearson correlation and sample size.', 'Correlation'],
    ['events1, total1', 'Event count and group total for group 1.', 'Binary outcome'],
    ['events2, total2', 'Event count and group total for group 2.', 'Binary outcome'],
    ['reverse_sign', 'yes reverses the calculated direction for harmonization.', 'All rows'],
    ['notes', 'Free-text provenance, outcome, or extraction notes.', 'All rows']
  ];

  async function buildPublicationWorkbook(payload) {
    const now = new Date();
    const records = payload.records || [];
    const headers = payload.headers || [];
    const results = payload.results || [];
    const issues = (payload.validationItems || []).map(normalizeIssue);
    const sourceName = payload.sourceName || 'uploaded data';
    const forests = payload.forests || [];
    const metaAnalyses = payload.metaAnalyses || [];

    const renderedImages = [];
    let anchorRow = 4;
    for (let i = 0; i < forests.length; i += 1) {
      const rendered = await svgToPng(forests[i].svg);
      const displayWidth = Math.min(980, rendered.width);
      const displayHeight = Math.round(rendered.height * (displayWidth / rendered.width));
      renderedImages.push({ ...rendered, metric: forests[i].metric, anchorRow, displayWidth, displayHeight });
      anchorRow += Math.ceil(displayHeight / 20) + 5;
    }

    const errorCount = issues.filter((item) => item.severity === 'error').length;
    const warningCount = issues.filter((item) => item.severity === 'warning').length;
    const infoCount = issues.filter((item) => item.severity === 'information').length;

    const readmeRows = [
      ['ERN Meta-Analysis Studio: Publication Workbook'],
      ['Generated locally in the browser; the uploaded data were not transmitted to ERN Institute.'],
      [],
      ['Source file', sourceName],
      ['Generated', now.toLocaleString()],
      ['Valid effect sizes', results.length],
      ['Meta-analysis models', metaAnalyses.length],
      ['Validation errors', errorCount],
      ['Warnings / assumptions', warningCount],
      ['Informational notices', infoCount],
      [],
      ['Workbook contents', 'Purpose'],
      ['Original Input', 'All uploaded rows exactly as parsed, including rows that could not be calculated.'],
      ['Validation Report', 'Row-, column-, and value-level explanations with recommended corrections.'],
      ['Calculated Effects', 'Analysis-ready effect sizes, sampling variances, standard errors, and confidence intervals.'],
      ['Calculation Audit', 'Calculation pathway, direction handling, assumptions, and notes for each valid effect.'],
      ['Forest Plots', 'Individual-effect and pooled forest plots embedded in the workbook; separate SVG files remain available on the webpage.'],
      ['Meta-Analysis Models', 'Model settings, pooled estimates, heterogeneity statistics, prediction intervals, and reporting text.'],
      ['Study Weights', 'Effect-level inverse-variance weights for each fitted model.'],
      ['Data Dictionary', 'Definitions for the supported input columns.'],
      [],
      ['Interpretation note', 'Classical models currently assume independent effect estimates. Repeated effects from the same study require explicit confirmation and should ultimately be analyzed with dependency-aware methods.']
    ];
    const contentsHeaderIndex = readmeRows.findIndex((row) => row[0] === 'Workbook contents');
    const readmeStyles = readmeRows.map((row, index) => row.map(() => (index === 0 ? 1 : (index === contentsHeaderIndex ? 2 : (index > contentsHeaderIndex && index < readmeRows.length - 2 ? 3 : 9)))));

    const inputRows = [['source_row', ...headers], ...records.map((record) => [record.__row, ...headers.map((header) => record[header] ?? '')])];
    const inputStyles = styleRows(inputRows);

    const validationRows = [['source_row', 'study_id', 'effect_id', 'severity', 'column', 'entered_value', 'issue_code', 'explanation', 'how_to_fix'], ...issues.map((item) => [item.row, item.study_id, item.effect_id, item.severity, item.column, item.entered_value, item.code, item.message, item.fix])];
    const validationStyles = validationRows.map((row, rowIndex) => row.map(() => {
      if (rowIndex === 0) return 2;
      if (String(row[3]).toLowerCase() === 'error') return 5;
      if (String(row[3]).toLowerCase() === 'warning') return 6;
      return 7;
    }));

    const resultHeaders = ['source_row', 'study_id', 'effect_id', 'calculation_type', 'effect_metric', 'effect_size', 'sampling_variance', 'standard_error', 'ci_lower', 'ci_upper', 'natural_metric', 'natural_effect', 'natural_ci_lower', 'natural_ci_upper', 'n_total', 'reverse_sign', 'warning', 'notes'];
    const resultRows = [resultHeaders, ...results.map((result) => resultHeaders.map((header) => result[header] ?? ''))];
    const resultStyles = styleRows(resultRows, 0, [5, 6, 7, 8, 9, 11, 12, 13, 14]);

    const auditHeaders = ['source_row', 'study_id', 'effect_id', 'calculation_type', 'effect_metric', 'formula', 'reverse_sign', 'warning', 'notes'];
    const auditRows = [auditHeaders, ...results.map((result) => auditHeaders.map((header) => result[header] ?? ''))];
    const auditStyles = styleRows(auditRows);

    const forestRows = [['Forest plots'], ['Individual estimates and pooled model figures. All plots are on their analysis scale; transformations are reported in the model sheets.']];
    renderedImages.forEach((image) => forestRows.push([], [`${image.metric} forest plot`]));
    const forestStyles = forestRows.map((row, index) => row.map(() => (index === 0 ? 1 : (index === 1 ? 9 : 8))));

    const metaHeaders = ['analysis_role', 'metric', 'natural_metric', 'model', 'model_label', 'tau_estimator', 'requested_inference', 'inference', 'inference_label', 'inference_reason', 'confidence_level', 'k', 'estimate', 'standard_error', 'ci_lower', 'ci_upper', 'natural_estimate', 'natural_ci_lower', 'natural_ci_upper', 'statistic', 'p_value', 'q', 'q_df', 'q_p_value', 'i2', 'h2', 'tau2', 'tau', 'prediction_lower', 'prediction_upper', 'prediction_df', 'prediction_policy', 'prediction_note', 'natural_prediction_lower', 'natural_prediction_upper', 'kh_scale_factor', 'methods_text', 'results_text'];
    const metaRows = [metaHeaders, ...metaAnalyses.map((analysis) => metaHeaders.map((header) => analysis[header] ?? ''))];
    const metaNumeric = metaHeaders.map((header, index) => ['confidence_level', 'k', 'estimate', 'standard_error', 'ci_lower', 'ci_upper', 'natural_estimate', 'natural_ci_lower', 'natural_ci_upper', 'statistic', 'p_value', 'q', 'q_df', 'q_p_value', 'i2', 'h2', 'tau2', 'tau', 'prediction_lower', 'prediction_upper', 'prediction_df', 'natural_prediction_lower', 'natural_prediction_upper', 'kh_scale_factor'].includes(header) ? index : -1).filter((index) => index >= 0);
    const metaStyles = styleRows(metaRows, 0, metaNumeric);

    const weightHeaders = ['analysis_role', 'metric', 'model', 'tau_estimator', 'inference', 'source_row', 'study_id', 'effect_id', 'effect_size', 'sampling_variance', 'standard_error', 'ci_lower', 'ci_upper', 'model_weight', 'weight_percent'];
    const weightRows = [weightHeaders];
    metaAnalyses.forEach((analysis) => (analysis.weights || []).forEach((weight) => {
      const combined = { analysis_role: analysis.analysis_role || 'primary', metric: analysis.metric, model: analysis.model, tau_estimator: analysis.tau_estimator, inference: analysis.inference, ...weight };
      weightRows.push(weightHeaders.map((header) => combined[header] ?? ''));
    }));
    const weightNumeric = weightHeaders.map((header, index) => ['source_row', 'effect_size', 'sampling_variance', 'standard_error', 'ci_lower', 'ci_upper', 'model_weight', 'weight_percent'].includes(header) ? index : -1).filter((index) => index >= 0);
    const weightStyles = styleRows(weightRows, 0, weightNumeric);

    const sheetNames = ['README', 'Original Input', 'Validation Report', 'Calculated Effects', 'Calculation Audit', 'Forest Plots', 'Meta-Analysis Models', 'Study Weights', 'Data Dictionary'];
    const sheets = [
      worksheetXml({ rows: readmeRows, styles: readmeStyles, widths: [30, 95], rowHeights: [30, 34], freezeRows: 0 }),
      worksheetXml({ rows: inputRows, styles: inputStyles, widths: [12, ...headers.map((header) => ['notes'].includes(header) ? 40 : 16)], freezeRows: 1, autoFilter: `A1:${cellRef(0, inputRows[0].length - 1)}` }),
      worksheetXml({ rows: validationRows, styles: validationStyles, widths: [12, 22, 16, 13, 18, 20, 26, 60, 60], freezeRows: 1, autoFilter: `A1:I${Math.max(1, validationRows.length)}` }),
      worksheetXml({ rows: resultRows, styles: resultStyles, widths: [12, 22, 16, 18, 18, 14, 18, 15, 15, 15, 18, 16, 16, 16, 12, 13, 42, 42], freezeRows: 1, autoFilter: `A1:R${Math.max(1, resultRows.length)}` }),
      worksheetXml({ rows: auditRows, styles: auditStyles, widths: [12, 22, 16, 18, 18, 62, 14, 48, 48], freezeRows: 1, autoFilter: `A1:I${Math.max(1, auditRows.length)}` }),
      worksheetXml({ rows: forestRows, styles: forestStyles, widths: [120], rowHeights: [30, 34], freezeRows: 0, drawingRel: renderedImages.length ? 'rId1' : '' }),
      worksheetXml({ rows: metaRows, styles: metaStyles, widths: metaHeaders.map((header) => ['methods_text', 'results_text'].includes(header) ? 72 : (['model_label', 'inference_label'].includes(header) ? 30 : 16)), freezeRows: 1, autoFilter: `A1:${cellRef(Math.max(0, metaRows.length - 1), metaHeaders.length - 1)}` }),
      worksheetXml({ rows: weightRows, styles: weightStyles, widths: weightHeaders.map((header) => ['study_id'].includes(header) ? 24 : (['analysis_role', 'metric', 'model', 'tau_estimator', 'inference'].includes(header) ? 18 : 16)), freezeRows: 1, autoFilter: `A1:${cellRef(Math.max(0, weightRows.length - 1), weightHeaders.length - 1)}` }),
      worksheetXml({ rows: dataDictionary, styles: styleRows(dataDictionary), widths: [24, 70, 28], freezeRows: 1, autoFilter: `A1:C${dataDictionary.length}` })
    ];

    const files = [
      { name: '[Content_Types].xml', data: contentTypesXml(sheetNames.length, renderedImages.length) },
      { name: '_rels/.rels', data: rootRelsXml() },
      { name: 'docProps/core.xml', data: corePropsXml(now) },
      { name: 'docProps/app.xml', data: appPropsXml(sheetNames) },
      { name: 'xl/workbook.xml', data: workbookXml(sheetNames) },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml(sheetNames.length) },
      { name: 'xl/styles.xml', data: stylesXml() }
    ];
    sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheet }));

    if (renderedImages.length) {
      files.push({ name: 'xl/worksheets/_rels/sheet6.xml.rels', data: sheetRelsXml() });
      files.push({ name: 'xl/drawings/drawing1.xml', data: drawingXml(renderedImages) });
      files.push({ name: 'xl/drawings/_rels/drawing1.xml.rels', data: drawingRelsXml(renderedImages) });
      renderedImages.forEach((image, index) => files.push({ name: `xl/media/image${index + 1}.png`, data: image.bytes }));
    }

    return new Blob([zipStore(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  window.ERNWorkbookExporter = { buildPublicationWorkbook };
})();
