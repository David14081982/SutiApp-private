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
  function issueKey(issue) { return JSON.stringify([issue.code, issue.message, issue.sheets, issue.months, issue.sourceIds]); }
  function uniqueIssues(issues) { return [...new Map(issues.map(issue => [issueKey(issue), issue])).values()]; }
  function affectedInputs(issue, schema, month, inputs) {
    const periods = Array.isArray(issue.months) && issue.months.length ? issue.months.map(Number) : MONTHS.map((_, i) => i + 1);
    if (periods.some(value => !Number.isInteger(value) || value < 1 || value > 12)) fail('período de incidencia inválido.');
    const candidates = inputs.filter(coord => schema.monthly || periods.includes(Number(coord.slice(1)) - (schema.kind === 'savingsYear' ? 3 : 5)));
    // These scopes come from the report reader's explicit indicator contract.
    // Unknown issue codes conservatively affect every input in their sheet/period.
    if (issue.code === 'REFUND_PERIOD_UNCONFIRMED') {
      if (schema.sheet === 8) return candidates.filter(coord => coord[0] === 'E');
      if (schema.sheet === 3) return candidates.filter(coord => coord[0] === 'D');
      if (schema.sheet === 4) return candidates.filter(coord => ['D7', 'D12'].includes(coord));
    }
    if (issue.code === 'HISTORICAL_TERMINATION_UNMAPPED' && schema.sheet === 8) return candidates.filter(coord => coord[0] === 'G');
    if (['REFUND_PAYROLL_UNRESOLVED', 'REFUND_PAYROLL_PROCESS_UNRESOLVED'].includes(issue.code) && schema.sheet === 4) return candidates.filter(coord => ['D7', 'D12'].includes(coord));
    if (['PAYROLL_CODE_UNMAPPED', 'INSTALLMENT_AMOUNT_INVALID', 'INSTALLMENT_DATE_INVALID', 'SAVINGS_PAYROLL_UNRESOLVED', 'PAYROLL_AMOUNT_NOT_RECORDED', 'PAYROLL_SCHEDULE_UNRESOLVED', 'PAYROLL_PROCESS_UNRESOLVED'].includes(issue.code)) {
      if (schema.sheet === 3) return candidates.filter(coord => ['B', 'C'].includes(coord[0]));
      if (schema.sheet === 4) return candidates.filter(coord => coord[0] === 'C');
    }
    return candidates.filter(coord => schema.kind !== 'loanMonth' || !['B10', 'C10', 'D10'].includes(coord));
  }
  function preparedCells(report, schema, month, provisional) {
    const sheet = report.sheets && report.sheets[schema.name];
    const selected = schema.monthly ? sheet && sheet.months && sheet.months[month] : sheet;
    if (!selected || !selected.cells || typeof selected.cells !== 'object') fail('faltan datos para ' + schema.name + '.');
    const sourceIssues = [report.issues, sheet.issues, selected.issues];
    if (sourceIssues.some(list => list != null && !Array.isArray(list))) fail('lista de incidencias inválida.');
    const allIssues = [].concat(...sourceIssues.map(list => list || []));
    for (const issue of allIssues) if (issue && issue.severity === 'error') {
      if (issue.months != null && (!Array.isArray(issue.months) || issue.months.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 12))) fail('período de incidencia inválido.');
      if (issue.sheets != null && (!Array.isArray(issue.sheets) || issue.sheets.some(name => typeof name !== 'string'))) fail('hojas de incidencia inválidas.');
      if (issue.sourceIds != null && !Array.isArray(issue.sourceIds)) fail('referencias de incidencia inválidas.');
    }
    const issues = uniqueIssues(allIssues.filter(issue => issueBlocks(issue, schema, month)));
    if (!provisional && issues.length) fail('hay incidencias pendientes en ' + schema.name + '.');
    const cells = selected.cells;
    const values = Object.create(null);
    const formulas = derived(schema);
    const inputCoords = coords(schema.inputs);
    // Validate the source payload before applying any mask. A provisional marker
    // must never hide a negative, fractional, absent or otherwise malformed count.
    for (const coord of inputCoords) {
      const value = rawValue(cells[coord]);
      values[coord] = provisional && value === null ? null : count(value, schema.name, coord);
    }
    // The legacy external row remains in the exact template, without duplicating Sutiexpress.
    if (schema.kind === 'loanMonth' && ['B10', 'C10', 'D10'].some(coord => values[coord] !== 0)) fail('Sutiexpress debe contarse una sola vez en la fila 9.');
    const calculate = (coord, active) => {
      if (Object.prototype.hasOwnProperty.call(values, coord)) return values[coord];
      if (!formulas[coord] || active.has(coord)) fail('dependencia inválida en ' + schema.name + '!' + coord + '.');
      active.add(coord);
      const children = coords(formulas[coord]).map(child => calculate(child, active));
      values[coord] = children.includes(null) ? null : count(children.reduce((sum, child) => sum + child, 0), schema.name, coord);
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
    const pending = Object.create(null);
    if (provisional) {
      for (const issue of issues) for (const coord of affectedInputs(issue, schema, month, inputCoords)) (pending[coord] ||= []).push(issue);
      for (const coord of inputCoords) {
        if (values[coord] === null && !pending[coord]) pending[coord] = [{ code: 'COUNT_UNDETERMINED', message: 'La fuente no determina todavía esta cantidad; no equivale a cero.', sourceIds: cells[coord]?.sourceIds || [] }];
        // An issue qualifies the observed count; it does not erase it. Only an
        // actual null from the reader represents an undetermined quantity.
        if (pending[coord]) pending[coord] = uniqueIssues(pending[coord]);
      }
      // Preserve formulas and propagate an Excel error through all dependants.
      // SUM would silently ignore text/blanks, so neither is a safe placeholder.
      const propagate = coord => {
        if (!formulas[coord]) return values[coord];
        const dependencies = coords(formulas[coord]);
        const children = dependencies.map(propagate);
        if (children.includes(null)) values[coord] = null;
        const inherited = dependencies.flatMap(child => pending[child] || []);
        if (inherited.length) pending[coord] = uniqueIssues(inherited);
        return values[coord];
      };
      for (const coord of Object.keys(formulas)) propagate(coord);
    }
    return { values, formulas, labels, pending, issues };
  }
  function setCell(xml, coord, value, stringValue, originalCells) {
    const cell = originalCells[coord];
    let attrs = cell ? cell.attrs.replace(/\s+t="[^"]*"/g, '') : ' r="' + coord + '"';
    // Only a value changes: retain the exact original formula, style and other attributes.
    let body;
    if (stringValue) body = '<is><t xml:space="preserve">' + escapeXml(value) + '</t></is>';
    else {
      const formula = cell && cell.inner.match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/);
      body = (formula ? formula[0] : '') + '<v>' + (value === null ? '#N/A' : value) + '</v>';
    }
    const replacement = '<c' + attrs + (stringValue ? ' t="inlineStr"' : value === null ? ' t="e"' : '') + '>' + body + '</c>';
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
  function patchSheet(xml, sharedStrings, schema, report, year, month, provisional) {
    const original = readCells(xml);
    const prepared = preparedCells(report, schema, month, provisional);
    for (const [coord, value] of Object.entries(prepared.values)) {
      const formula = original[coord] && original[coord].inner.match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
      if (formula && unescapeXml(formula[1]) !== 'SUM(' + prepared.formulas[coord] + ')') fail('fórmula inesperada en la plantilla.');
      xml = setCell(xml, coord, value, false, original);
    }
    for (const [coord, label] of Object.entries(prepared.labels)) if (label) xml = setCell(xml, coord, label, true, original);
    const oldTitle = titleText(original[schema.title], sharedStrings);
    const ending = schema.monthly ? /Octubre 2026$/ : /2026$/;
    if (!ending.test(oldTitle)) fail('el título de la plantilla no coincide.');
    const title = oldTitle.replace(ending, (schema.monthly ? MONTHS[month - 1] + ' ' : '') + year);
    xml = setCell(xml, schema.title, provisional ? 'PROVISIONAL · ' + title + ' · Conteos registrados; consultar notas' : title, true, original);
    if (schema.yearCell) xml = setCell(xml, schema.yearCell, year, false, original);
    return { xml, pending: prepared.pending, values: prepared.values };
  }
  function safeNoteText(value) { return String(value == null ? '' : value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); }
  function noteText(schema, coord, issues, report, month, byId, value) {
    const lines = ['REPORTE PROVISIONAL', schema.name + '!' + coord + ' · ' + report.year + (schema.monthly ? ' · ' + MONTHS[month - 1] : ''), value === null ? '#N/A = cantidad no determinada por la fuente. No equivale a cero.' : 'Cantidad registrada: ' + value + '. Cuenta los registros clasificables de la fuente. Las incidencias siguientes pueden afectar su integridad; no es una cifra definitiva. Cero significa cero casos clasificados, no certifica ausencia de casos pendientes.'];
    const reasons = uniqueIssues(issues);
    for (const issue of reasons) {
      lines.push(safeNoteText(issue.code || 'SOURCE_UNRESOLVED') + ': ' + safeNoteText(issue.message || 'Existe una incidencia en la fuente de este indicador.'));
      if (Array.isArray(issue.months) && issue.months.length) lines.push('Periodos: ' + issue.months.map(value => MONTHS[Number(value) - 1]).join(', ') + '.');
      const references = [...new Set((Array.isArray(issue.sourceIds) ? issue.sourceIds : []).map(id => {
        const record = byId.get(id);
        if (record && typeof record.sheet === 'string' && Number.isSafeInteger(record.row) && record.row > 0) return safeNoteText(record.sheet) + ' · fila ' + record.row;
        const legacy = /^(requests|loans):([1-9]\d*)$/.exec(String(id));
        if (legacy) return (legacy[1] === 'requests' ? 'Historial de solicitudes' : 'HISTORIAL P V2') + ' · fila ' + legacy[2];
        if (record && typeof record.source_table === 'string' && record.source_id != null) return safeNoteText(record.source_table) + ' · registro ' + safeNoteText(record.source_id);
        return 'Referencia de origen: ' + safeNoteText(id);
      }))];
      if (references.length) lines.push(...references.slice(0, 40));
      if (references.length > 40) lines.push('Más referencias disponibles en las incidencias de Reportes JC: ' + (references.length - 40) + '.');
      if (lines.join('\n').length > 26000) { lines.push('Consulte las demás incidencias en Reportes JC.'); break; }
    }
    if (derived(schema)[coord]) lines.push(value === null ? 'Total no determinado: depende de una o más cantidades #N/A. Se conserva la fórmula original cuando existe.' : 'Total de las cantidades registradas, sujeto a las observaciones de sus componentes. Se conserva la fórmula original cuando existe.');
    // Excel legacy notes have a 32,767-character text limit.
    const text = lines.join('\n');
    return text.length <= 30000 ? text : text.slice(0, 29800) + '\nConsulte el detalle completo de las incidencias en Reportes JC.';
  }
  async function addNotes(zip, xml, schema, pending, report, month, values) {
    const addresses = Object.keys(pending);
    if (!addresses.length) return xml;
    if (/<legacyDrawing\b/.test(xml)) fail('la plantilla ya contiene notas incompatibles.');
    const commentsPath = 'xl/comments/reportsJcSheet' + schema.sheet + '.xml';
    const drawingPath = 'xl/drawings/reportsJcSheet' + schema.sheet + '.vml';
    const relsPath = 'xl/worksheets/_rels/sheet' + schema.sheet + '.xml.rels';
    const relsEntry = zip.file(relsPath);
    let rels = relsEntry ? await relsEntry.async('string') : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    if (zip.file(commentsPath) || zip.file(drawingPath) || /rIdJcNotes(?:Vml|Comments)/.test(rels)) fail('las referencias de notas ya existen.');
    const byId = new Map((Array.isArray(report.records) ? report.records : []).map(record => [record.id, record]));
    const comments = addresses.map(coord => '<comment ref="' + coord + '" authorId="0"><text><t xml:space="preserve">' + escapeXml(noteText(schema, coord, pending[coord], report, month, byId, values[coord])) + '</t></text></comment>').join('');
    zip.file(commentsPath, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Reportes JC</author></authors><commentList>' + comments + '</commentList></comments>', { createFolders: false });
    const shapes = addresses.map((coord, index) => {
      const col = coord.charCodeAt(0) - 65, row = Number(coord.slice(1)) - 1;
      return '<v:shape id="_x0000_s' + (1025 + index) + '" type="#_x0000_t202" style="position:absolute;margin-left:59.25pt;margin-top:1.5pt;width:320pt;height:144pt;z-index:1;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>' + [col + 1, 15, row, 2, col + 5, 15, row + 8, 2].join(', ') + '</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>' + row + '</x:Row><x:Column>' + col + '</x:Column></x:ClientData></v:shape>';
    }).join('');
    zip.file(drawingPath, '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' + shapes + '</xml>', { createFolders: false });
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdJcNotesComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments/reportsJcSheet' + schema.sheet + '.xml"/><Relationship Id="rIdJcNotesVml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/reportsJcSheet' + schema.sheet + '.vml"/></Relationships>');
    zip.file(relsPath, rels, { createFolders: false, ...(relsEntry ? { date: relsEntry.date, unixPermissions: relsEntry.unixPermissions, dosPermissions: relsEntry.dosPermissions } : {}) });
    let types = await zip.file('[Content_Types].xml').async('string');
    const vmlType = /<Default\b[^>]*\bExtension="vml"/.test(types) ? '' : '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>';
    types = types.replace('</Types>', vmlType + '<Override PartName="/' + commentsPath + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>');
    const typesEntry = zip.file('[Content_Types].xml');
    zip.file('[Content_Types].xml', types, { createFolders: false, date: typesEntry.date, unixPermissions: typesEntry.unixPermissions, dosPermissions: typesEntry.dosPermissions });
    if (!/\bxmlns:r=/.test(xml)) xml = xml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    return xml.replace('</worksheet>', '<legacyDrawing r:id="rIdJcNotesVml"/></worksheet>');
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
  function exportStatus(report, month, mode) {
    period({ year: report && report.year, month, report });
    if (mode != null && !['month', 'year'].includes(mode)) fail('modo de exportación inválido.');
    const months = mode === 'year' ? MONTHS.map((_, index) => index + 1) : [Number(month)];
    const pending = new Set(), issues = new Set();
    for (const selected of months) for (const schema of SCHEMA) {
      const prepared = preparedCells(report, schema, selected, true);
      for (const coord of Object.keys(prepared.pending)) pending.add(schema.sheet + ':' + (schema.monthly ? selected : 'year') + ':' + coord);
      for (const issue of prepared.issues) issues.add(issueKey(issue));
    }
    return { provisionalNeeded: pending.size > 0, pendingCells: pending.size, issueCount: issues.size };
  }
  async function buildWorkbook(options) {
    const { year, month } = period(options);
    const { zip, sharedStrings } = await openTemplate(options.templateBase64);
    for (const schema of SCHEMA) {
      const path = 'xl/worksheets/sheet' + schema.sheet + '.xml';
      const entry = zip.file(path);
      const xml = await entry.async('string');
      const prepared = patchSheet(xml, sharedStrings, schema, options.report, year, month, options.provisional === true);
      const output = options.provisional === true ? await addNotes(zip, prepared.xml, schema, prepared.pending, options.report, month, prepared.values) : prepared.xml;
      zip.file(path, output, { date: entry.date, createFolders: false, unixPermissions: entry.unixPermissions, dosPermissions: entry.dosPermissions });
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
  async function buildYearZip(options) {
    const Zip = library(), output = new Zip();
    for (let month = 1; month <= 12; month++) {
      const bytes = await buildWorkbook({ ...options, month });
      output.file('Reporte_JC_' + options.year + '-' + String(month).padStart(2, '0') + (options.provisional === true ? '_PROVISIONAL' : '') + '.xlsx', bytes);
    }
    return output.generateAsync({ type: 'uint8array', compression: 'STORE' });
  }
  function download(bytes, filename, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const api = Object.freeze({ buildWorkbook, buildYearZip, exportStatus, download, TEMPLATE_SHA256, SCHEMA });
  root.SutiReportsJcExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
