/* Exact-template Reportes JC exports. All report inputs come from the authorized backend. */
(function (root) {
  'use strict';
  const TEMPLATE_SHA256 = 'da8c9785b4f4a62bc087403a06492766cf8dae59e2d239589396a31f842e32eb';
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const SCHEMA = [
    { name: 'Préstamos Concentrado', sheet: 1, inputs: 'B6:D17', kind: 'loanYear', title: 'A2', yearCell: 'A5' },
    { name: 'Préstamos Mes', sheet: 2, inputs: 'B6:D10', kind: 'loanMonth', title: 'A2', monthly: true },
    { name: 'DtosViaNomina Concentrado', sheet: 3, inputs: 'B6:D17', kind: 'loanYear', title: 'A2', yearCell: 'A5' },
    { name: 'DtosViaNomina Mes', sheet: 4, inputs: 'C6:D20', kind: 'rhMonth', title: 'A2', monthly: true },
    { name: 'ValesyMembresias Concentrado', sheet: 5, inputs: 'B6:D17', kind: 'membershipYear', title: 'A2', yearCell: 'A5' },
    { name: 'ValesyMembresias Mes', sheet: 6, inputs: 'B6:D17', kind: 'membershipMonth', title: 'A2', monthly: true, labels: 'A12:A17' },
    { name: 'Financiamientos Concentrado', sheet: 7, inputs: 'B6:D17', kind: 'membershipYear', title: 'A2', yearCell: 'A5' },
    { name: 'Caja de Ahorro Voluntario', sheet: 8, inputs: 'B4:G15', kind: 'savingsYear', title: 'A1', yearCell: 'A3' }
  ];
  const CELL = /<c\b([^>]*?\br="([A-Z]+[1-9]\d*)"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  function fail(message) { throw new Error('Reportes JC: ' + message); }
  function library() {
    if (root.JSZip) return root.JSZip;
    if (typeof module !== 'undefined' && module.exports) return require('./vendor/jszip-3.10.1/jszip.min.js');
    return fail('no está disponible el componente de exportación.');
  }
  function escapeXml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
  function unescapeXml(value) { return String(value).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
  function coords(range) {
    const match = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(range);
    if (!match) fail('rango de plantilla inválido.');
    const result = [];
    for (let row = Number(match[2]); row <= Number(match[4]); row++) for (let col = match[1].charCodeAt(0); col <= match[3].charCodeAt(0); col++) result.push(String.fromCharCode(col) + row);
    return result;
  }
  function rawValue(entry) { return entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry; }
  function count(value, name, coord) {
    if (!Number.isSafeInteger(value) || value < 0) fail('conteo ausente o inválido en ' + name + '!' + coord + '.');
    return value;
  }
  function derived(schema) {
    const out = {};
    const rows = (col, first, last, left, right) => { for (let r = first; r <= last; r++) out[col + r] = left + r + ':' + right + r; };
    const totals = (firstCol, lastCol, row, first, last) => { for (let c = firstCol.charCodeAt(0); c <= lastCol.charCodeAt(0); c++) { const col = String.fromCharCode(c); out[col + row] = col + first + ':' + col + last; } };
    if (schema.kind === 'loanYear') { rows('E', 6, 17, 'B', 'D'); totals('B', 'D', 18, 6, 17); out.E18 = 'B18:D18'; }
    if (schema.kind === 'loanMonth') { rows('E', 6, 10, 'B', 'D'); totals('B', 'D', 11, 6, 10); out.E11 = 'B11:D11'; }
    if (schema.kind === 'membershipYear') { rows('E', 6, 17, 'B', 'C'); totals('B', 'D', 18, 6, 17); out.E18 = 'B18:C18'; }
    if (schema.kind === 'membershipMonth') { rows('E', 6, 17, 'B', 'C'); totals('B', 'D', 18, 6, 17); out.E18 = 'B18:C18'; }
    if (schema.kind === 'rhMonth') { rows('E', 6, 20, 'C', 'D'); totals('C', 'E', 21, 6, 20); }
    if (schema.kind === 'savingsYear') { rows('H', 4, 15, 'B', 'G'); totals('B', 'H', 16, 4, 15); }
    return out;
  }
  function readCells(xml) {
    const cells = Object.create(null);
    for (const match of xml.matchAll(CELL)) cells[match[2]] = { attrs: match[1], inner: match[3] || '', full: match[0] };
    return cells;
  }
  function issueBlocks(issue, schema, month) {
    if (!issue || issue.severity !== 'error') return false;
    const sheets = Array.isArray(issue.sheets) ? issue.sheets : [];
    if (sheets.length && !sheets.includes(schema.name)) return false;
    return !schema.monthly || !Array.isArray(issue.months) || !issue.months.length || issue.months.map(Number).includes(month);
  }
  function preparedCells(report, schema, month) {
    const sheet = report.sheets && report.sheets[schema.name];
    const selected = schema.monthly ? sheet && sheet.months && sheet.months[month] : sheet;
    if (!selected || !selected.cells || typeof selected.cells !== 'object') fail('faltan datos para ' + schema.name + '.');
    const issues = [].concat(report.issues || [], sheet.issues || [], selected.issues || []);
    if (issues.some(issue => issueBlocks(issue, schema, month))) fail('hay incidencias pendientes en ' + schema.name + '.');
    const cells = selected.cells;
    const values = Object.create(null);
    const formulas = derived(schema);
    const inputCoords = coords(schema.inputs);
    for (const coord of inputCoords) values[coord] = count(rawValue(cells[coord]), schema.name, coord);
    // The legacy external row remains in the exact template, without duplicating Sutiexpress.
    if (schema.kind === 'loanMonth' && ['B10', 'C10', 'D10'].some(coord => values[coord] !== 0)) fail('Sutiexpress debe contarse una sola vez en la fila 9.');
    const calculate = (coord, active) => {
      if (Object.prototype.hasOwnProperty.call(values, coord)) return values[coord];
      if (!formulas[coord] || active.has(coord)) fail('dependencia inválida en ' + schema.name + '!' + coord + '.');
      active.add(coord);
      values[coord] = count(coords(formulas[coord]).reduce((sum, child) => sum + calculate(child, active), 0), schema.name, coord);
      active.delete(coord);
      return values[coord];
    };
    for (const coord of Object.keys(formulas)) calculate(coord, new Set());
    const labelCoords = schema.labels ? coords(schema.labels) : [];
    const labels = Object.create(null);
    for (const coord of labelCoords) {
      const label = rawValue(cells[coord]);
      if (label == null || label === '') {
        const row = coord.slice(1);
        if (['B', 'C', 'D'].some(col => values[col + row] > 0)) fail('faltan nombres de proveedores con actividad.');
        labels[coord] = ''; continue;
      }
      if (typeof label !== 'string' || label.length > 120 || /[\x00-\x1f]/.test(label)) fail('nombre de proveedor inválido.');
      labels[coord] = label;
    }
    for (const coord of Object.keys(cells)) {
      if (Object.prototype.hasOwnProperty.call(values, coord)) {
        if (Object.prototype.hasOwnProperty.call(formulas, coord) && rawValue(cells[coord]) !== values[coord]) fail('total incompatible en ' + schema.name + '!' + coord + '.');
      } else if (!labelCoords.includes(coord)) fail('celda fuera de alcance en ' + schema.name + '!' + coord + '.');
    }
    return { values, formulas, labels };
  }
  function setCell(xml, coord, value, stringValue, originalCells) {
    const cell = originalCells[coord];
    let attrs = cell ? cell.attrs.replace(/\s+t="[^"]*"/g, '') : ' r="' + coord + '"';
    // Only a value changes: retain the exact original formula, style and other attributes.
    let body;
    if (stringValue) body = '<is><t xml:space="preserve">' + escapeXml(value) + '</t></is>';
    else {
      const formula = cell && cell.inner.match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/);
      body = (formula ? formula[0] : '') + '<v>' + value + '</v>';
    }
    const replacement = '<c' + attrs + (stringValue ? ' t="inlineStr"' : '') + '>' + body + '</c>';
    if (cell) return xml.replace(cell.full, replacement);
    const rowNumber = Number(coord.match(/\d+$/)[0]);
    let found = false;
    xml = xml.replace(/<row\b([^>]*\br="(\d+)"[^>]*)>([\s\S]*?)<\/row>/g, (whole, rowAttrs, number, content) => {
      if (Number(number) !== rowNumber) return whole;
      found = true;
      let inserted = false;
      const next = content.replace(CELL, (full, unused, other) => {
        if (!inserted && other.replace(/\d+$/, '') > coord.replace(/\d+$/, '')) { inserted = true; return replacement + full; }
        return full;
      });
      return '<row' + rowAttrs + '>' + next + (inserted ? '' : replacement) + '</row>';
    });
    if (!found) fail('falta la fila de la celda ' + coord + ' en la plantilla autorizada.');
    return xml;
  }
  function titleText(cell, sharedStrings) {
    if (!cell) fail('falta el título de una hoja.');
    const value = cell.inner.match(/<v>([\s\S]*?)<\/v>/);
    if (/\bt="s"/.test(cell.attrs) && value) return sharedStrings[Number(value[1])];
    return (cell.inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => unescapeXml(t.replace(/^<t\b[^>]*>|<\/t>$/g, ''))).join('');
  }
  function patchSheet(xml, sharedStrings, schema, report, year, month) {
    const original = readCells(xml);
    const prepared = preparedCells(report, schema, month);
    for (const [coord, value] of Object.entries(prepared.values)) {
      const formula = original[coord] && original[coord].inner.match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
      if (formula && unescapeXml(formula[1]) !== 'SUM(' + prepared.formulas[coord] + ')') fail('fórmula inesperada en la plantilla.');
      xml = setCell(xml, coord, value, false, original);
    }
    for (const [coord, label] of Object.entries(prepared.labels)) if (label) xml = setCell(xml, coord, label, true, original);
    const oldTitle = titleText(original[schema.title], sharedStrings);
    const ending = schema.monthly ? /Octubre 2026$/ : /2026$/;
    if (!ending.test(oldTitle)) fail('el título de la plantilla no coincide.');
    xml = setCell(xml, schema.title, oldTitle.replace(ending, (schema.monthly ? MONTHS[month - 1] + ' ' : '') + year), true, original);
    if (schema.yearCell) xml = setCell(xml, schema.yearCell, year, false, original);
    return xml;
  }
  async function openTemplate(base64) {
    if (typeof base64 !== 'string' || base64.length > 200000) fail('plantilla inválida.');
    let bytes;
    try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); } catch (_) { return fail('plantilla inválida.'); }
    if (!root.crypto || !root.crypto.subtle) fail('el navegador no permite verificar la plantilla.');
    const hash = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    if (hash !== TEMPLATE_SHA256) fail('la plantilla no coincide con el original autorizado.');
    const Zip = library();
    const zip = await Zip.loadAsync(bytes, { checkCRC32: true });
    const stringsXml = await zip.file('xl/sharedStrings.xml').async('string');
    const sharedStrings = Array.from(stringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), match => Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), t => unescapeXml(t[1])).join(''));
    return { zip, sharedStrings };
  }
  function period(options) {
    const year = Number(options.year), month = Number(options.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) fail('período inválido.');
    if (!options.report || Number(options.report.year) !== year) fail('el año del reporte no coincide.');
    return { year, month };
  }
  async function buildWorkbook(options) {
    const { year, month } = period(options);
    const { zip, sharedStrings } = await openTemplate(options.templateBase64);
    for (const schema of SCHEMA) {
      const path = 'xl/worksheets/sheet' + schema.sheet + '.xml';
      const entry = zip.file(path);
      const xml = await entry.async('string');
      zip.file(path, patchSheet(xml, sharedStrings, schema, options.report, year, month), { date: entry.date, createFolders: false, unixPermissions: entry.unixPermissions, dosPermissions: entry.dosPermissions });
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
  async function buildYearZip(options) {
    const Zip = library(), output = new Zip();
    for (let month = 1; month <= 12; month++) {
      const bytes = await buildWorkbook({ ...options, month });
      output.file('Reporte_JC_' + options.year + '-' + String(month).padStart(2, '0') + '.xlsx', bytes);
    }
    return output.generateAsync({ type: 'uint8array', compression: 'STORE' });
  }
  function download(bytes, filename, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const api = Object.freeze({ buildWorkbook, buildYearZip, download, TEMPLATE_SHA256, SCHEMA });
  root.SutiReportsJcExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
