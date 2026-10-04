/* SICOF administrative workbench. Inputs are scenario drafts; calculations,
   historical attribution, exports and persistence belong to the repository. */
(function () {
  'use strict';
  function expandWorkspace(response) {
    if (!response?.wire_version) return response;
    if (response.wire_version !== 'SICOF_WORKSPACE_COMPACT_V1' || !Array.isArray(response.report_details) || !response.workspace || !Array.isArray(response.workspace.report?.rows)) throw Error('SICOF_RESPONSE_INVALID');
    const { wire_version, report_details, row_schemas, ...data } = response;
    const schemas = row_schemas === undefined ? [] : row_schemas;
    const validKey = key => typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key);
    if (!Array.isArray(schemas) || schemas.some(keys => !Array.isArray(keys) || keys.some(key => !validKey(key)) || new Set(keys).size !== keys.length) || new Set(schemas.map(keys => JSON.stringify(keys))).size !== schemas.length) throw Error('SICOF_RESPONSE_INVALID');
    function decodeRows(value) {
      if (Array.isArray(value)) {
        if (value.some(row => !row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !validKey(key)))) throw Error('SICOF_RESPONSE_INVALID');
        return value;
      }
      if (!value || value.encoding !== 'SICOF_ROWS_V1' || Object.keys(value).length !== 2 || !Array.isArray(value.rows)) throw Error('SICOF_RESPONSE_INVALID');
      return value.rows.map(row => {
        if (!Array.isArray(row) || !Number.isInteger(row[0]) || row[0] < 0 || row[0] >= schemas.length) throw Error('SICOF_RESPONSE_INVALID');
        const keys = schemas[row[0]];
        if (row.length !== keys.length + 1) throw Error('SICOF_RESPONSE_INVALID');
        return Object.fromEntries(keys.map((key, index) => [key, row[index + 1]]));
      });
    }
    const workspace = { ...data.workspace };
    if (workspace.loans != null) {
      if (!Array.isArray(workspace.loans)) throw Error('SICOF_RESPONSE_INVALID');
      workspace.loans = workspace.loans.map(loan => {
        if (!loan || typeof loan !== 'object' || Array.isArray(loan)) throw Error('SICOF_RESPONSE_INVALID');
        return loan.schedule == null ? loan : { ...loan, schedule: decodeRows(loan.schedule) };
      });
    }
    if (workspace.payments != null) workspace.payments = decodeRows(workspace.payments);
    const loans = workspace.loans || [];
    const detailAt = index => {
      if (!Number.isInteger(index) || index < 0 || index >= report_details.length) throw Error('SICOF_RESPONSE_INVALID');
      const detail = report_details[index];
      if (!detail || Object.keys(detail).some(key => !['movements', 'periods', 'withdrawal_periods'].includes(key) || !Array.isArray(detail[key]))) throw Error('SICOF_RESPONSE_INVALID');
      return detail;
    };
    const report = { ...data.workspace.report, rows: data.workspace.report.rows.map(row => {
      const { detail_index, ...summary } = row;
      return { ...summary, ...detailAt(detail_index) };
    }) };
    const result = data.result ? { ...data.result, rows: data.result.rows.map(row => {
      const { loan_indexes, ...summary } = row;
      if (!Array.isArray(loan_indexes)) throw Error('SICOF_RESPONSE_INVALID');
      return { ...summary, loans: loan_indexes.map(index => {
        if (!Number.isInteger(index) || index < 0 || index >= loans.length || loans[index].folio !== row.f) throw Error('SICOF_RESPONSE_INVALID');
        return loans[index];
      }) };
    }) } : null;
    return { ...data, workspace: { ...workspace, report }, result };
  }
  const h = React.createElement;
  const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'liquidez', label: 'Liquidez' }, { id: 'reparto', label: 'Reparto por ahorrador' }, { id: 'prestamos', label: 'Préstamos y pagos' }, { id: 'atrasos', label: 'Atrasos' }, { id: 'reporte', label: 'Reporte préstamos' }, { id: 'cumplimiento', label: 'Cumplimiento' }, { id: 'ahorro', label: 'Informe final de ahorro' }];
  const TEXTS = {
    title: 'Simulador de Rendimiento', subtitle: 'Compara escenarios, revisa sus reglas y conserva el detalle de cada periodo.',
    executive: 'Resumen ejecutivo', parameters: 'Parámetros de cálculo', distribution: 'Reparto por ahorrador', distributionNote: 'Consulta el rendimiento y el desglose de cada persona; las exclusiones conservan su motivo.',
    liquidity: 'Tablero de liquidez — ¿alcanza si retiran?', liquidityNote: 'Compara la obligación a pagar y el efectivo disponible en distintos escenarios de retiro.',
    loans: 'Comportamiento de los préstamos', loansNote: 'Capital recuperado y pagos registrados por fondo durante el periodo seleccionado.',
    costs: 'Apartados y costos de la dirección', costsNote: 'Los apartados de la bolsa reducen el reparto; los de reserva reducen esa reserva. Los gastos pagados se distinguen de las estimaciones.',
    paymentDetail: 'Detalle de pagos por fondo', arrears: 'Préstamos con saldo atrasado', matrix: 'Reporte de préstamos', compliance: 'Cumplimiento del reglamento',
    savings: 'Informe final de ahorro', savingsNote: 'Ahorro, rendimientos, retiros y saldo restante separados por año y semestre. Los valores históricos conservan su periodo y sus políticas.'
  };
  const CAPTIONS = {
  "caption_af09c35599": "% del inter\u00e9s a repartir: ",
  "caption_7e9bf662fb": "Ahorradores elegibles",
  "caption_126fc503e7": "Alerta de tasa anual (%)",
  "caption_ca8bcab722": "A\u00f1o de origen ",
  "caption_6126dc9bc7": "Base que participa",
  "caption_0d9153d02a": "Bolsa a repartir",
  "caption_7b11e88b28": "Bolsa proyectada neta de costos",
  "caption_946772baa9": "Caja de Ahorro",
  "caption_bf01a8c594": "Capital actual",
  "caption_9c58bf03df": "Capital que participa",
  "caption_796843dbf1": "Cierre / corte",
  "caption_bdc9359ac4": "Cl\u00e1usula 10 \u00b7 Pr\u00e9stamo atrasado",
  "caption_b5e61c8f4b": "Cl\u00e1usula 9 \u00b7 Incumplimiento de descuento",
  "caption_2b118e4951": "Cobertura por escenario de retiro",
  "caption_632ceec2d0": "Comparador de escenarios",
  "caption_43fdfa80da": "Composici\u00f3n del respaldo",
  "caption_fc5069be3c": "Concepto",
  "caption_5c2fc5959f": "Consultado al ",
  "caption_8eb5269dec": "Declarado por",
  "caption_966c7c4cad": "Desde",
  "caption_f276fa8bc7": "Despu\u00e9s de apartados",
  "caption_8e28cd3b5e": "Disponible global actual",
  "caption_ad2a201c5f": "El capital recuperado y el gasto administrativo se distinguen del inter\u00e9s repartible.",
  "caption_7479d76606": "El porcentaje no repartido permanece como reserva.",
  "caption_a2a2c3a48c": "Entregable",
  "caption_87cf2a843e": "Estado",
  "caption_0e1a0e1ca9": "Excluidos",
  "caption_bcc476092d": "Fecha",
  "caption_c08ffd6326": "Fecha de declaraci\u00f3n",
  "caption_f0af28ffa9": "Fuente de la bolsa",
  "caption_ccdaad85ef": "Hasta",
  "caption_3f84b364f5": "Importe de origen ",
  "caption_1df3c7fee7": "Incluye cobros futuros pendientes.",
  "caption_4f70d8c37e": "Inicio",
  "caption_25b72ce1d4": "Inter\u00e9s proyectado pendiente",
  "caption_fdbcc19b2b": "Inter\u00e9s registrado cobrado",
  "caption_bdd83879de": "Meses m\u00ednimos de permanencia",
  "caption_835dcdf0f2": "Monto",
  "caption_d08334255c": "Motivo y evidencia del desglose",
  "caption_6840fc994d": "M\u00e9todo de reparto",
  "caption_5e2a005722": "Pendientes de revisi\u00f3n",
  "caption_aa7bf53fe2": "Periodo del semestre",
  "caption_7c032398bb": "Promedio por d\u00edas",
  "caption_886befac42": "Quincenas consecutivas",
  "caption_8a205feba9": "Recuperaci\u00f3n acumulada en el tiempo",
  "caption_8308ba3744": "Recuperado",
  "caption_8300c9a509": "Recuperado vs. falta por cobrar, por fondo",
  "caption_0219532342": "Reglas de exclusi\u00f3n",
  "caption_d2c4cbec12": "Rendimiento",
  "caption_1843b29991": "Rendimiento acreditado actual",
  "caption_5c88817eee": "Rendimiento sobre rendimientos anteriores",
  "caption_07da12a86c": "Reserva",
  "caption_65c248a991": "Retenido",
  "caption_8e63c12892": "Saldo actual",
  "caption_26b3324926": "Saldo al corte",
  "caption_23039dec1e": "Saldo bancario del fondo de ahorro",
  "caption_6f8c7583dc": "Sale de",
  "caption_a907ff22b0": "Semestre de origen ",
  "caption_87dfb50c03": "Suma de rendimientos",
  "caption_d4d948879d": "S\u00f3lo participa el rendimiento acreditado que a\u00fan permanece en la cuenta. Su origen hist\u00f3rico no cambia.",
  "caption_98fd2e5f11": "Tasa del periodo",
  "caption_252ac39cfb": "Tasa proyectada sobre base confirmada",
  "caption_e4bfd8f1de": "Un mes vencido sin aportaci\u00f3n de jubilado equivale a dos quincenas. Los periodos futuros no son incumplimientos.",
  "caption_48b38a5c8e": "Usa el ahorro confirmado; no garantiza cobro ni acredita rendimiento.",
  "caption_eac6ad6da6": "Ver un ejemplo individual"
};
  Object.assign(TEXTS, CAPTIONS);
  const textOverrides = values => Object.fromEntries(Object.entries(values || {}).filter(([key, value]) => Object.hasOwn(TEXTS, key) && value !== TEXTS[key]));
  function preferenceError(values, tabOrder) {
    const labels = textOverrides(values);
    if (Object.values(labels).some(value => typeof value !== 'string' || JSON.stringify(value).length > 500)) return 'Acorta el texto: cada etiqueta admite hasta 500 caracteres incluidos los caracteres de formato.';
    if (JSON.stringify({ labels, tab_order: tabOrder }, null, 1).length > 20000) return 'Acorta algunos textos: la presentación completa admite hasta 20,000 caracteres.';
    return '';
  }
  const CAPTION_KEYS = Object.fromEntries(Object.entries(CAPTIONS).map(([key, value]) => [value, key]));
  const CaptionContext = React.createContext(value => value);
  function CaptionChart(props) { const caption = React.useContext(CaptionContext); return h(window.SicofChart, Object.assign({}, props, { title: caption(props.title), series: (props.series || []).map(field => Object.assign({}, field, { label: caption(field.label) })) })); }
  const CSS = `
    .sicof{--sc-wine:#96002b;--sc-wine-dark:#790322;--sc-gold:#a47c32;--sc-ink:#18243e;--sc-muted:#768096;--sc-line:#e0e4ed;--sc-paper:#fff;color:var(--sc-ink);font-family:inherit;min-width:0;background:#fafafb}.sicof *{box-sizing:border-box}.sicof-content{padding:22px 24px 42px;max-width:1580px;margin:auto}.sicof-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}.sicof h1{font-size:27px;letter-spacing:-.025em;color:var(--sc-wine);margin:2px 0 7px}.sicof h2{font-size:20px;color:var(--sc-wine);font-weight:700;margin:0 0 10px}.sicof h3{font-size:15px;color:var(--sc-wine);font-weight:750;margin:0 0 12px}.sicof p{line-height:1.6}.sicof-sub{font-size:12.5px;color:var(--sc-muted);margin:0 0 14px}.sicof-source{font-size:11px;color:var(--sc-muted);margin:4px 0}.sicof-tabs{display:flex;gap:4px;overflow:auto;position:sticky;top:0;z-index:4;background:#fafafb;border-bottom:1px solid var(--sc-line);padding:7px 0;margin-bottom:24px}.sicof-tab{flex:none;display:flex;align-items:center;border-radius:10px;background:#f1f2f6}.sicof-tab[data-active=true]{background:var(--sc-wine);color:#fff}.sicof-tab>button:first-child{border:0;padding:12px 13px;background:transparent;color:inherit;white-space:nowrap;font:750 12px inherit;cursor:pointer}.sicof-tab>button:not(:first-child){border:0;background:transparent;color:inherit;padding:5px;font-size:11px;cursor:pointer}.sicof-tab>button:disabled{opacity:.35;cursor:default}.sicof-layout{display:grid;grid-template-columns:minmax(285px,380px) minmax(0,1fr);gap:22px;align-items:start}.sicof-layout>*,.sicof-chart-grid>*{min-width:0}.sicof-panel{min-width:0;border:1px solid var(--sc-line);border-radius:15px;background:var(--sc-paper);box-shadow:0 2px 4px #18243e08;margin-bottom:18px;overflow:hidden}.sicof-panel-head{padding:17px 19px;border-bottom:1px solid var(--sc-line);margin:0!important;font-size:17px!important}.sicof-panel-body{padding:18px 19px}.sicof-control{margin-bottom:18px;padding-bottom:17px;border-bottom:1px solid #eff0f5}.sicof-control:last-child{border:0;margin-bottom:0;padding-bottom:0}.sicof-label{display:block;color:var(--sc-ink);font-size:12px;font-weight:750;margin-bottom:8px}.sicof-help{font-size:11.5px;color:var(--sc-muted);line-height:1.6;margin:7px 0 0}.sicof-segment{display:flex;gap:3px;padding:3px;border-radius:9px;background:#f1f2f6;flex-wrap:wrap}.sicof-segment button{flex:1;border:0;border-radius:7px;padding:8px 9px;font:700 11px inherit;color:#69748a;background:transparent;cursor:pointer}.sicof-segment button[aria-pressed=true]{background:#fff;color:var(--sc-wine);box-shadow:0 1px 4px #0001}.sicof input:not([type=checkbox]):not([type=range]),.sicof select,.sicof textarea{border:1px solid #dce1eb;border-radius:8px;background:#fff;padding:9px 10px;color:var(--sc-ink);font:12px inherit;max-width:100%;min-width:0}.sicof input[type=range]{accent-color:var(--sc-wine);width:100%;margin:7px 0}.sicof input[type=checkbox]{accent-color:var(--sc-wine)}.sicof-check{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.5;margin:9px 0;cursor:pointer}.sicof-check input{margin-top:3px;flex:none}.sicof-field{display:flex;flex-direction:column;gap:6px;min-width:0}.sicof-field>span{color:var(--sc-muted);font-size:11px;font-weight:700}.sicof-date-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}.sicof-btn{border:1px solid var(--sc-wine);background:var(--sc-wine);color:white;border-radius:9px;padding:10px 14px;min-height:38px;font:750 12px inherit;cursor:pointer;white-space:nowrap}.sicof-btn.secondary{background:white;color:var(--sc-wine);border-color:#e0d7dd}.sicof-btn.gold{background:#a6813d;border-color:#a6813d}.sicof-btn:disabled{opacity:.5;cursor:wait}.sicof button:focus-visible,.sicof input:focus-visible,.sicof select:focus-visible{outline:3px solid #b9607a;outline-offset:2px}.sicof-toolbar{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:16px}.sicof-toolbar>.sicof-search{flex:1;min-width:180px}.sicof-toolbar-spacer{flex:1}.sicof-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px;margin-bottom:17px}.sicof-metric{min-width:0;container-type:inline-size;background:white;border:1px solid var(--sc-line);border-radius:13px;padding:15px}.sicof-metric span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--sc-muted);font-weight:700}.sicof-metric strong{display:block;font-size:23px;font-size:clamp(16px,12cqi,23px);line-height:1.25;overflow-wrap:anywhere;color:var(--sc-wine);margin-top:8px;font-variant-numeric:tabular-nums}.sicof-metric small{display:block;font-size:11px;color:var(--sc-muted);line-height:1.5;margin-top:6px}.sicof-metric.primary{background:var(--sc-wine);border-color:var(--sc-wine)}.sicof-metric.primary span,.sicof-metric.primary strong,.sicof-metric.primary small{color:white}.sicof-metric.primary strong{font-size:39px;font-size:clamp(24px,20cqi,39px)}.sicof-wide{grid-column:1/-1}.sicof-status{border:1px solid #ead9bc;background:#fff9ec;color:#856221;padding:12px 14px;border-radius:10px;font-size:12px;line-height:1.6;margin:12px 0}.sicof-status.error{background:#fff1f4;border-color:#f2d6de;color:#9f2542}.sicof-status.success{background:#edf8f1;border-color:#cce9d8;color:#21734a}.sicof-error-line{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.sicof-table-scroll{overflow:auto;max-height:590px}.sicof-table{width:100%;border-collapse:collapse;font-size:12px}.sicof-table th{font-size:9.5px;font-weight:750;letter-spacing:.025em;color:var(--sc-muted);text-align:left;background:#f9fafc;position:sticky;top:0;z-index:1;white-space:nowrap}.sicof-table th button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}.sicof-table td,.sicof-table th{padding:10px 9px;border-bottom:1px solid #e7e9ef;vertical-align:top}.sicof-table td.number,.sicof-table th.number{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.sicof-table tbody tr[data-clickable=true]{cursor:pointer}.sicof-table tbody tr[data-clickable=true]:hover{background:#fff6f9}.sicof-table tfoot{font-weight:800;color:var(--sc-wine)}.sicof-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.sicof-empty{padding:28px;text-align:center;color:var(--sc-muted);font-size:12px}.sicof-executive{margin-bottom:21px}.sicof-executive>summary,.sicof-explanation>summary{cursor:pointer;font-weight:750;color:var(--sc-wine);padding:15px 18px;font-size:16px}.sicof-executive ol{margin:0;padding-left:22px;font-size:12.5px;line-height:1.7}.sicof-executive li{padding:5px 0}.sicof-explanation{border:1px solid var(--sc-line);border-radius:11px;margin-bottom:17px}.sicof-explanation>div{padding:0 18px 18px}.sicof-formula{font-family:monospace;color:var(--sc-wine);background:#f9f2f5;padding:12px;border-radius:8px;font-size:12px}.sicof-multi{position:relative;min-width:190px;border:1px solid var(--sc-line);border-radius:8px;background:#fff}.sicof-multi summary{padding:10px;font-size:12px;cursor:pointer;list-style:none}.sicof-multi-panel{position:absolute;top:100%;left:0;min-width:280px;max-width:85vw;max-height:320px;overflow:auto;padding:11px 14px;border:1px solid var(--sc-line);border-radius:9px;background:white;box-shadow:0 12px 25px #0002;z-index:8}.sicof-multi-panel .sicof-toolbar{margin-bottom:5px}.sicof-multi-panel button{border:0;background:transparent;color:var(--sc-wine);font-size:11px;cursor:pointer;padding:4px}.sicof-cost-grid{display:grid;grid-template-columns:minmax(170px,1.5fr) 110px 140px 130px 125px auto;gap:10px;align-items:end}.sicof-cost-bar{display:flex;justify-content:space-between;gap:12px;background:var(--sc-wine);color:white;border-radius:9px;padding:13px 15px;font-size:12px;font-weight:750;margin-top:13px}.sicof-bank-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:15px}.sicof-actions{display:flex;justify-content:center;margin:18px 0 0}.sicof-row-link{background:transparent;border:0;text-align:left;color:var(--sc-wine);font:750 12px inherit;cursor:pointer;padding:0}.sicof-row-remove{border:0;background:transparent;color:var(--sc-wine);cursor:pointer;padding:4px 8px}.sicof-text-editor{display:grid;gap:14px}.sicof-text-editor textarea{min-height:66px;width:100%;font:13px inherit;padding:10px;border:1px solid #dee2eb;border-radius:8px}.sicof-period-note{padding:11px 12px;border-radius:9px;background:#f4f5f8;color:#6e7890;font-size:12px;margin:10px 0}.sicof-tooltip{font-size:10px;color:var(--sc-muted);display:block;margin-top:4px}.sicof-order-label{font-size:10px;color:var(--sc-muted);white-space:nowrap;padding:9px 0}.sicof-donut{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}.sicof-donut svg{width:160px;height:160px}.sicof-donut ul{list-style:none;padding:0;margin:0;display:grid;gap:10px;font-size:12px}.sicof-donut i{display:inline-block;width:10px;height:10px;margin-right:8px;border-radius:3px}
    @media(max-width:1200px){.sicof-cost-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.sicof-content{padding:18px}}@media(max-width:900px){.sicof-layout,.sicof-chart-grid{grid-template-columns:minmax(0,1fr)}.sicof-bank-grid{grid-template-columns:1fr}.sicof-title-row{flex-wrap:wrap}.sicof h1{font-size:23px}}@media(max-width:600px){.sicof-content{padding:14px 11px 32px}.sicof-panel-body{padding:14px}.sicof-tabs{margin-bottom:17px}.sicof-cost-grid{grid-template-columns:1fr 1fr}.sicof-btn{padding:9px 11px}.sicof-toolbar .sicof-field{flex:1;min-width:125px}}
  `;
  function money(value) { return window.SicofView.money(value); }
  function percent(value) { return value == null || value === '' ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value)) + '%'; }
  function eligibilityLabel(row) { return row.review_required ? 'Por verificar' : row.ok ? 'Sí' : 'No'; }
  function monthsLabel(value) { return value == null ? 'Por verificar' : value; }
  function draftSettings() {
    const now = new Date(), year = now.getFullYear(), first = now.getMonth() < 6;
    return { src: 'caja', selFunds: [], pay: 90, method: 'avg', periodIni: year + (first ? '-01-01' : '-07-01'), periodFin: year + (first ? '-06-30' : '-12-31'), minm: 6, exterm: true, exmin: true, warn: 20, exConsec: false, consecN: 4, loanEffect: 'retiro', retScope: 'todo', anchorOn: false, anchorDate: year + (first ? '-01-01' : '-07-01'), capitalBasis: 'all', yieldMode: 'none', yieldPeriods: [] };
  }
  function errorText(error) {
    const value = String(error && (error.code || error.message) || '');
    if (/DENIED|AUTH|42501/.test(value)) return 'La sesión o los permisos cambiaron. Vuelve a consultar con una cuenta autorizada.';
    if (/STALE|FINGERPRINT|CHANGED|VERSION/.test(value)) return 'Cambió la información del escenario. Actualiza el cálculo antes de continuar.';
    if (/VALIDATION|INVALID|RANGE|DATE/.test(value)) return 'Revisa las fechas y los importes del escenario.';
    return 'No se completó la consulta. Puedes reintentar; no se sustituyen datos por estimaciones.';
  }
  function Metric({ label, value, note, primary }) { const caption = React.useContext(CaptionContext); label = caption(label); note = caption(note); return h('div', { className: 'sicof-metric' + (primary ? ' primary' : '') }, h('span', null, label), h('strong', null, value == null ? '—' : value), note && h('small', null, note)); }
  function Panel({ title, children, className }) { const caption = React.useContext(CaptionContext); title = caption(title); return h('section', { className: 'sicof-panel' + (className ? ' ' + className : '') }, title && h('h3', { className: 'sicof-panel-head' }, title), h('div', { className: 'sicof-panel-body' }, children)); }
  function Button({ children, onClick, busy, secondary, gold, ...props }) { return h('button', Object.assign({ type: 'button', className: 'sicof-btn' + (secondary ? ' secondary' : gold ? ' gold' : ''), onClick, disabled: busy }, props), children); }
  function Field({ label, children }) { const caption = React.useContext(CaptionContext); label = caption(label); return h('label', { className: 'sicof-field' }, h('span', null, label), children); }
  function Control({ label, children, help }) { const caption = React.useContext(CaptionContext); label = caption(label); help = caption(help); return h('div', { className: 'sicof-control' }, label && h('div', { className: 'sicof-label' }, label), children, help && h('p', { className: 'sicof-help' }, help)); }
  function Check({ label, checked, onChange }) { return h('label', { className: 'sicof-check' }, h('input', { type: 'checkbox', checked: Boolean(checked), onChange: event => onChange(event.target.checked) }), label); }
  function Segment({ label, value, options, onChange }) { return h('div', { className: 'sicof-segment', role: 'group', 'aria-label': label }, options.map(([id, text]) => h('button', { type: 'button', key: id, 'aria-pressed': value === id, onClick: () => onChange(id) }, text))); }
  function Multi({ label, options, value, onChange }) {
    const selected = value === null ? options.map(option => option.value) : value;
    return h('details', { className: 'sicof-multi' }, h('summary', { 'aria-label': label }, label + ': ' + (value === null ? 'Todos' : selected.length + ' seleccionados') + ' ▾'), h('div', { className: 'sicof-multi-panel' },
      h('div', { className: 'sicof-toolbar' }, h('button', { type: 'button', onClick: () => onChange(null) }, 'Todos'), h('button', { type: 'button', onClick: () => onChange([]) }, 'Ninguno')),
      options.map(option => h(Check, { key: option.value, label: option.note ? h('span', null, option.label, h('small', { className: 'sicof-tooltip' }, option.note)) : option.label, checked: selected.includes(option.value), onChange: checked => onChange(checked ? [...selected, option.value] : selected.filter(key => key !== option.value)) }))));
  }
  function Table({ columns, rows, onRow, totals, limit, empty }) {
    const [sort, setSort] = React.useState(null);
    const display = React.useMemo(() => { const result = [...(rows || [])]; if (sort) result.sort((a, b) => { const x = a[sort.key], y = b[sort.key]; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), 'es', { numeric: true })) * sort.direction; }); return result; }, [rows, sort]);
    const format = (row, column) => column.render ? column.render(row) : column.format === 'money' ? money(row[column.key]) : column.format === 'percent' ? percent(row[column.key]) : row[column.key] == null ? '—' : typeof row[column.key] === 'boolean' ? row[column.key] ? 'Sí' : 'No' : String(row[column.key]);
    const list = limit ? display.slice(0, limit) : display;
    const head = h('thead', null, h('tr', null, columns.map(column => h('th', { key: column.key, className: ['money', 'percent', 'number'].includes(column.format) ? 'number' : undefined, 'aria-sort': sort && sort.key === column.key ? sort.direction > 0 ? 'ascending' : 'descending' : 'none' }, h('button', { type: 'button', onClick: () => setSort({ key: column.key, direction: sort && sort.key === column.key ? -sort.direction : 1 }) }, column.label, sort && sort.key === column.key ? sort.direction > 0 ? ' ↑' : ' ↓' : ' ↕')))));
    const body = h('tbody', null, list.map((row, index) => h('tr', { key: row.id || row.f || index, 'data-clickable': Boolean(onRow), tabIndex: onRow ? 0 : undefined, onClick: onRow ? () => onRow(row) : undefined, onKeyDown: onRow ? event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onRow(row); } } : undefined }, columns.map(column => h('td', { key: column.key, className: ['money', 'percent', 'number'].includes(column.format) ? 'number' : undefined }, format(row, column))))));
    const foot = totals && h('tfoot', null, h('tr', null, columns.map((column, index) => h('td', { key: column.key, className: ['money', 'percent', 'number'].includes(column.format) ? 'number' : undefined }, index === 0 ? 'Totales' : format(totals, column)))));
    return h(React.Fragment, null, h('div', { className: 'sicof-table-scroll' }, h('table', { className: 'sicof-table' }, head, body, foot)),
      !display.length && h('div', { className: 'sicof-empty' }, empty || 'No hay registros con estos filtros.'),
      limit && display.length > limit && h('p', { className: 'sicof-help' }, 'Se muestran ' + limit + ' de ' + display.length + ' registros. La descarga incluye todos los registros filtrados.'));
  }
  // Presentation totals use only amounts already supplied by the backend snapshot.
  // They do not apportion a payment, calculate yield, or change a canonical balance.
  function sumSnapshot(rows, key) {
    if (rows.some(row => row[key] == null || typeof row[key] !== 'number' || !Number.isFinite(row[key]) || (row.issues || []).includes('AMBIGUOUS_LOAN_DATE_ROWS'))) return null;
    return rows.reduce((sum, row) => sum + Math.round(row[key] * 100), 0) / 100;
  }
  const severityLabel = value => ({ mild: 'Leve', moderate: 'Moderado', severe: 'Grave' })[value] || 'Por revisar';
  function LoanProgress({ value }) { return value == null ? h('span', null, 'Por revisar') : h('span', null, h('progress', { value, max: 100, 'aria-label': 'Avance del préstamo', style: { width: 70, accentColor: '#96002b', marginRight: 6 } }), percent(value)); }
  function match(row, query, fields) { const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX'); const text = normalize(query).trim(); return !text || normalize(fields.map(key => String(row[key] == null ? '' : row[key])).join(' ')).includes(text); }
  function noteList(notes) { return (notes || []).map((note, index) => h('div', { key: index, className: 'sicof-status' + (note.level === 'error' || note.severity === 'error' || note.status === 'FAIL' ? ' error' : '') }, typeof note === 'string' ? note : note.message || note.text || note.label)); }
  function Donut({ values }) {
    const parts = (values || []).filter(part => typeof part.share === 'number' && Number.isFinite(part.share) && part.share >= 0);
    let cursor = 0;
    return h('div', { className: 'sicof-donut' }, h('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': 'Composición del respaldo' }, h('circle', { cx: 60, cy: 60, r: 44, fill: 'none', stroke: '#eef0f5', strokeWidth: 16 }), parts.map((part, index) => { const offset = cursor; cursor += part.share / 100; return h('circle', { key: index, cx: 60, cy: 60, r: 44, fill: 'none', stroke: part.color || ['#97002c', '#a4abbc', '#bd984b'][index % 3], strokeWidth: 16, pathLength: 1, strokeDasharray: part.share / 100 + ' ' + (1 - part.share / 100), strokeDashoffset: -offset, transform: 'rotate(-90 60 60)' }, h('title', null, part.label + ': ' + money(part.amount))); })), h('ul', null, (values || []).map((part, index) => h('li', { key: index }, h('i', { style: { background: part.color || ['#97002c', '#a4abbc', '#bd984b'][index % 3] } }), part.label + ': ' + money(part.amount), part.share == null && h('small', { className: 'sicof-tooltip' }, 'Proporción por conciliar')))));
  }
  function Attribution({ participantId, transactionId, onClose, onSaved }) {
    const identity = window.SicofView.useContext(), [state, setState] = React.useState({ phase: 'loading' }), [revision, setRevision] = React.useState(0);
    const [slices, setSlices] = React.useState([]), [reason, setReason] = React.useState(''), [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [stale, setStale] = React.useState(false);
    const active = React.useRef(true), lock = React.useRef(false), retry = React.useRef(null);
    React.useEffect(() => () => { active.current = false; }, []);
    React.useEffect(() => {
      let current = true; setState({ phase: 'loading' }); setError(''); setStale(false); retry.current = null; setSlices([]); setReason('');
      Promise.resolve().then(() => window.SicofRepository.composition(participantId)).then(data => {
        if (!current || window.SicofView.contextKey() !== identity) return;
        const movement = (data.movements || []).find(row => row.transaction_id === transactionId);
        if (!data.can_attribute || !movement || !movement.can_classify) { setState({ phase: 'denied' }); return; }
        setState({ phase: 'ready', data, movement });
      }, () => { if (current && window.SicofView.contextKey() === identity) setState({ phase: 'error' }); });
      return () => { current = false; };
    }, [participantId, transactionId, revision, identity]);
    const movement = state.movement, opening = movement && movement.type === 'REGULARIZATION', origins = [];
    const cents = value => { const number = Number(value); return value === '' || !Number.isFinite(number) || number <= 0 || Math.abs(number * 100 - Math.round(number * 100)) > 1e-7 ? null : Math.round(number * 100); };
    let valid = state.phase === 'ready' && !stale && reason.trim().length >= 3 && slices.length > 0, sum = 0;
    for (const slice of slices) {
      const origin = slice.unknown ? 'OPENING' : slice.year + (slice.semester ? '-S' + slice.semester : ''), amount = cents(slice.amount);
      const start = slice.year + (slice.semester === '2' ? '-07-01' : '-01-01');
      if (amount == null || (!slice.unknown && (!/^[12][0-9]{3}$/.test(slice.year) || start > movement?.effective_date)) || (slice.unknown && opening) || origins.some(row => row.origin_key === origin)) valid = false;
      if (amount != null) sum += amount;
      origins.push({ origin_key: origin, amount: amount == null ? 0 : amount / 100 });
    }
    valid = valid && sum === cents(movement?.amount);
    const update = (id, key, value) => { setSlices(previous => previous.map(row => row.id === id ? Object.assign({}, row, { [key]: value }) : row)); setError(''); };
    async function submit(event) {
      event.preventDefault(); if (!valid || lock.current || window.SicofView.contextKey() !== identity) return;
      const command = { transaction_id: transactionId, origins, allocation_version: state.data.version, reason: reason.trim() }, fingerprint = JSON.stringify(command);
      if (!retry.current || retry.current.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
      lock.current = true; setBusy(true); setError('');
      try {
        const action = opening ? 'attributeOpening' : 'attributeWithdrawal';
        await window.SicofRepository[action](Object.assign({}, command, { key: retry.current.key }));
        if (active.current && window.SicofView.contextKey() === identity) onSaved();
      } catch (failure) {
        if (active.current && window.SicofView.contextKey() === identity) {
          const changed = /VERSION|CHANGED|ALREADY_CLASSIFIED/.test(String(failure.code || failure.message)); setStale(changed);
          setError(changed ? 'El saldo o su desglose cambi\u00f3. Recarga la composici\u00f3n y revisa los importes antes de confirmar.' : errorText(failure));
        }
      } finally { lock.current = false; if (active.current) setBusy(false); }
    }
    return h(window.SicofModal, { title: 'Identificar periodos de origen', subtitle: 'La clasificaci\u00f3n documenta un movimiento existente; no abona ni retira dinero nuevamente.', onClose: () => { if (!lock.current) onClose(); } }, h('div', { className: 'sicof', 'data-sicof-attribution': transactionId },
      state.phase === 'loading' && h('p', { role: 'status' }, 'Consultando composici\u00f3n actual\u2026'),
      state.phase === 'error' && h('p', { role: 'alert' }, 'No fue posible consultar el saldo.', h(Button, { onClick: () => setRevision(value => value + 1) }, 'Reintentar consulta')),
      state.phase === 'denied' && h('p', { role: 'alert' }, 'Este movimiento ya tiene una clasificaci\u00f3n o tu cuenta no tiene permiso para registrarla.'),
      state.phase === 'ready' && h('form', { onSubmit: submit }, h('div', { className: 'sicof-metrics' }, h(Metric, { label: movement.component === 'YIELD' ? 'Rendimiento registrado' : 'Capital registrado', value: money(movement.amount), note: movement.effective_date })),
        h('p', { className: 'sicof-period-note' }, opening ? 'Confirma s\u00f3lo cuando puedas comprobar el desglose completo. Si falta identificar una parte, cancela: el saldo inicial conserva su origen pendiente y su importe.' : 'Indica los periodos que financiaron este retiro. Puedes utilizar el saldo inicial por identificar sin atribuirle un a\u00f1o.'),
        h('fieldset', { disabled: busy || stale, style: { border: 0, padding: 0, minWidth: 0 } }, slices.map((slice, index) => h('div', { className: 'sicof-panel', key: slice.id, style: { padding: 12 } }, h('b', null, 'Partida ' + (index + 1)),
          !opening && h(Check, { label: 'Usar saldo inicial por identificar', checked: slice.unknown, onChange: value => update(slice.id, 'unknown', value) }),
          h('div', { className: 'sicof-toolbar', style: { marginTop: 10 } }, !slice.unknown && h(Field, { label: 'A\u00f1o de origen ' + (index + 1) }, h('input', { type: 'number', min: 1000, max: movement.effective_date?.slice(0, 4), step: 1, required: true, value: slice.year, onChange: event => update(slice.id, 'year', event.target.value) })),
            !slice.unknown && h(Field, { label: 'Semestre de origen ' + (index + 1) }, h('select', { 'aria-label': 'Semestre de origen ' + (index + 1), value: slice.semester, onChange: event => update(slice.id, 'semester', event.target.value) }, h('option', { value: '' }, 'A\u00f1o completo'), h('option', { value: '1' }, 'Enero a junio'), h('option', { value: '2' }, 'Julio a diciembre'))),
            h(Field, { label: 'Importe de origen ' + (index + 1) }, h('input', { type: 'number', min: '.01', step: '.01', required: true, value: slice.amount, onChange: event => update(slice.id, 'amount', event.target.value) })),
            h(Button, { secondary: true, onClick: () => setSlices(previous => previous.filter(row => row.id !== slice.id)) }, 'Quitar partida ' + (index + 1))))),
          h(Button, { secondary: true, onClick: () => setSlices(previous => previous.concat({ id: crypto.randomUUID(), year: '', semester: '', amount: '', unknown: false })) }, '+ Agregar periodo'),
          h(Field, { label: 'Motivo y evidencia del desglose' }, h('textarea', { required: true, minLength: 3, maxLength: 1000, value: reason, onChange: event => { setReason(event.target.value); setError(''); }, style: { minHeight: 75, marginTop: 12 } }))),
        h('p', { className: 'sicof-help', role: 'status' }, 'Los importes deben sumar exactamente ' + money(movement.amount) + '. No se distribuye ning\u00fan importe autom\u00e1ticamente.'),
        error && h('p', { className: 'sicof-status error', role: 'alert' }, error), stale && h(Button, { secondary: true, busy, onClick: () => setRevision(value => value + 1) }, 'Recargar composici\u00f3n'),
        h('div', { className: 'sicof-actions', style: { gap: 10 } }, h(Button, { secondary: true, busy, onClick: onClose }, 'Cancelar'), h(Button, { type: 'submit', busy: busy || !valid }, busy ? 'Guardando\u2026' : 'Confirmar clasificaci\u00f3n')))));
  }
  function Workbench({ app, onBack, header, identity }) {
    const [settings, setSettings] = React.useState(draftSettings), [costs, setCosts] = React.useState([]), [bank, setBank] = React.useState({ amount: null, declaredBy: '', date: '' });
    const [data, setData] = React.useState(null), [phase, setPhase] = React.useState('loading'), [loadError, setLoadError] = React.useState(''), [revision, setRevision] = React.useState(0);
    const [storedResult, setResult] = React.useState(null), [calculation, setCalculation] = React.useState('idle'), [calculationError, setCalculationError] = React.useState('');
    const [appliedKey, setAppliedKey] = React.useState(null);
    const draftKey = JSON.stringify({ settings, costs, bank });
    const draftPending = appliedKey !== null && draftKey !== appliedKey;
    const result = draftPending ? null : storedResult;
    const [tab, setTab] = React.useState('resumen'), [order, setOrder] = React.useState(TABS.map(item => item.id)), [texts, setTexts] = React.useState({}), [editing, setEditing] = React.useState(null);
    const [busy, setBusy] = React.useState(''), [notice, setNotice] = React.useState(null), [detail, setDetail] = React.useState(null), [loan, setLoan] = React.useState(null), [attribution, setAttribution] = React.useState(null), [search, setSearch] = React.useState('');
    const [paymentFilter, setPaymentFilter] = React.useState({ funds: null, q: '', from: '', to: '' }), [arrearsFilter, setArrearsFilter] = React.useState({ funds: null, q: '', severity: '' }), [matrixFilter, setMatrixFilter] = React.useState({ funds: null, q: '', year: '' }), [reportFilter, setReportFilter] = React.useState({ q: '', year: '', semester: '' });
    const [costDraft, setCostDraft] = React.useState({ concept: '', amount: '', source: 'pool', status: 'estimated', date: '' });
    const live = React.useRef(true), loadSequence = React.useRef(0), initialized = React.useRef(false), drag = React.useRef(null), busyRef = React.useRef(false), requestBusy = React.useRef(false);
    const repo = () => window.SicofRepository;
    const valid = () => live.current && window.SicofView.contextKey() === identity;
    const canConfigure = Boolean(app.admin && app.admin.has('savings.config'));
    const copy = key => texts[key] || TEXTS[key];
    const caption = value => { if (typeof value !== 'string') return value; if (CAPTION_KEYS[value]) return copy(CAPTION_KEYS[value]); const prefix = Object.keys(CAPTION_KEYS).find(text => text.endsWith(' ') && value.startsWith(text)); return prefix ? copy(CAPTION_KEYS[prefix]) + value.slice(prefix.length) : value; };
    React.useEffect(() => () => { live.current = false; loadSequence.current++; }, []);
    function refresh() { if (!requestBusy.current && !busyRef.current) { requestBusy.current = true; setRevision(value => value + 1); } }
    React.useEffect(() => {
      const sequence = ++loadSequence.current; setPhase('loading'); setLoadError(''); setData(null); setResult(null); setDetail(null); setLoan(null);
      requestBusy.current = true; setCalculation('loading'); setCalculationError('');
      const command = { settings, costs, bank }, commandKey = JSON.stringify(command);
      const timer = setTimeout(() => Promise.resolve().then(() => repo().workspace({ ...command, compact: true })).then(expandWorkspace).then(response => {
        if (!valid() || sequence !== loadSequence.current) return;
        const value = response.workspace;
        setData(value); setPhase('ready');
        setAppliedKey(commandKey); setResult(response.result); setCalculation(response.result ? 'ready' : 'error');
        setCalculationError(response.calculation_error ? errorText(Error(response.calculation_error)) : '');
        if (!initialized.current) {
          initialized.current = true;
          const preferences = value.preferences || {}; setTexts(preferences.texts || {});
          if (Array.isArray(preferences.tabOrder)) setOrder([...new Set(preferences.tabOrder.concat(TABS.map(item => item.id)))].filter(id => TABS.some(item => item.id === id)));
        }
      }, error => { if (valid() && sequence === loadSequence.current) { setPhase('error'); setCalculation('idle'); setLoadError(errorText(error)); } }).finally(() => { if (sequence === loadSequence.current) requestBusy.current = false; }), 200);
      return () => { clearTimeout(timer); loadSequence.current++; };
      // Draft edits are intentionally not dependencies: explicit Apply batches them.
    }, [revision, identity]);
    React.useEffect(() => { if (draftPending) setDetail(null); }, [draftKey, draftPending]);
    function change(key, value) { setSettings(previous => Object.assign({}, previous, { [key]: value })); setNotice(null); }
    async function operation(name, action, after) {
      if (busyRef.current) return;
      busyRef.current = true; setBusy(name); setNotice(null);
      try { const response = await action(); if (!valid()) return; if (after) after(response); }
      catch (error) { if (valid()) setNotice({ level: 'error', message: errorText(error) }); }
      finally { busyRef.current = false; if (valid()) setBusy(''); }
    }
    function exportHistorical() { operation('export:historical', () => repo().exportReport('final_ahorro', { filters: { historical: true } }), () => setNotice({ message: 'Informe histórico descargado con sus valores originales.' })); }
    function exportFile(kind, filters) { if (kind === 'final_ahorro') { operation('export:' + kind, () => repo().exportReport(kind, { from: settings.periodIni, to: settings.periodFin, filters: filters || {} }), () => setNotice({ message: 'Informe de ahorro generado.' })); return; } if (!result || calculation !== 'ready') return; operation('export:' + kind, () => repo().exportReport(kind, { settings, costs, bank, filters: filters || {}, fingerprint: result.fingerprint }), () => setNotice({ message: 'Informe generado con el escenario consultado.' })); }
    function saveScenario() { if (!result) return; operation('scenario', () => repo().saveScenario({ settings, costs, bank, fingerprint: result.fingerprint }), () => { setNotice({ message: 'Escenario guardado con sus reglas, costos y fecha de consulta.' }); setRevision(value => value + 1); }); }
    function savePreferences(nextTexts, nextOrder) { const invalid = preferenceError(nextTexts, nextOrder); if (invalid) { setNotice({ level: 'error', message: invalid }); return; } const overrides = textOverrides(nextTexts); operation('preferences', () => repo().savePreferences({ texts: overrides, tabOrder: nextOrder }), () => { setTexts(overrides); setOrder(nextOrder); setEditing(null); setNotice({ message: 'Presentación guardada.' }); }); }
    function moveTab(id, target) { if (busyRef.current || id === target) return; const next = order.filter(item => item !== id); next.splice(next.indexOf(target), 0, id); savePreferences(texts, next); }
    function addCost(event) {
      event.preventDefault(); const amount = Number(costDraft.amount);
      if (!costDraft.concept.trim() || !Number.isFinite(amount) || amount <= 0) { setNotice({ level: 'error', message: 'Captura un concepto y un importe mayor a cero.' }); return; }
      const cost = Object.assign({}, costDraft, { id: crypto.randomUUID(), concept: costDraft.concept.trim(), amount });
      setCosts(previous => previous.concat(cost));
      setCostDraft(previous => Object.assign({}, previous, { concept: '', amount: '' }));
    }
    const fundOptions = (data && data.funds || []).map(fund => typeof fund === 'string' ? { value: fund, label: fund } : { value: fund.id || fund.name, label: fund.name || fund.label || fund.id, note: 'Cobrado: ' + money(fund.collected) + ' · Proyectado pendiente: ' + money(fund.projected) + (fund.unresolved_rows ? ' · ' + fund.unresolved_rows + ' por revisar' : '') });
    const rows = result && result.rows || [], loans = data && data.loans || [], payments = data && data.payments || [], periods = data && data.periods || [], report = data && data.report || {};
    const yieldOptions = periods.map(period => ({ value: period.origin_key || period.period_year + '-S' + period.semester, label: period.label || period.origin_key || period.period_year + ' · semestre ' + period.semester })).filter(period => /^\d{4}(-S[12])?$/.test(period.value) && period.value.slice(0, 4) + (period.value.endsWith('-S1') ? '-06-30' : '-12-31') < settings.periodIni);
    const exportBusy = Boolean(busy) || calculation !== 'ready' || !result;
    const input = (key, type, extra) => h('input', Object.assign({ type: type || 'number', value: settings[key], 'aria-label': key, onChange: event => change(key, type === 'date' || type === 'text' ? event.target.value : event.target.value === '' ? '' : Number(event.target.value)) }, extra));
    const filteredPayments = payments.filter(row => (paymentFilter.funds === null || paymentFilter.funds.includes(row.fund)) && (!row.date || !paymentFilter.from || row.date >= paymentFilter.from) && (!row.date || !paymentFilter.to || row.date <= paymentFilter.to) && match(row, paymentFilter.q, ['name', 'folio', 'loan_id', 'fund']));
    const filteredArrears = loans.filter(row => row.status === 'SALDO ATRASADO' && (arrearsFilter.funds === null || arrearsFilter.funds.includes(row.fund)) && (!arrearsFilter.severity || row.severity === arrearsFilter.severity) && match(row, arrearsFilter.q, ['name', 'folio', 'id', 'fund']));
    const filteredMatrix = loans.filter(row => (matrixFilter.funds === null || matrixFilter.funds.includes(row.fund)) && match(row, matrixFilter.q, ['name', 'folio', 'id', 'fund']) && (!matrixFilter.year || (row.schedule || []).some(item => !item.date || String(item.date).slice(0, 4) === matrixFilter.year)));
    const matrixDates = [...new Set(filteredMatrix.flatMap(row => (row.schedule || []).filter(item => !matrixFilter.year || String(item.date).slice(0, 4) === matrixFilter.year).map(item => item.date).filter(Boolean)))].sort();
    const matrixEntries = filteredMatrix.flatMap(row => (row.schedule || []).filter(item => !matrixFilter.year || !item.date || String(item.date).slice(0, 4) === matrixFilter.year).map(item => Object.assign({}, item, { matrix_identity: row.id + ':' + row.folio })));
    const matrixHasDuplicates = new Set(matrixEntries.map(row => row.matrix_identity + ':' + row.date)).size !== matrixEntries.length;
    const paymentMetrics = [
      { label: 'Pagos mostrados', value: filteredPayments.length }, { label: 'Cuotas registradas', value: sumSnapshot(filteredPayments, 'paid'), format: 'money' },
      { label: 'Capital conciliado', value: sumSnapshot(filteredPayments, 'capital'), format: 'money' }, { label: 'Interés conciliado', value: sumSnapshot(filteredPayments, 'interest'), format: 'money' },
      { label: 'Gasto administrativo', value: sumSnapshot(filteredPayments, 'fee'), format: 'money' }, { label: 'Por revisar', value: filteredPayments.filter(row => row.audit === 'REVIEW_REQUIRED' || (row.issues || []).length).length }
    ];
    const overdueTotal = sumSnapshot(filteredArrears, 'arrears');
    const arrearsMetrics = [{ label: 'Préstamos con atraso', value: filteredArrears.length }, { label: 'Atraso registrado', value: overdueTotal, format: 'money' },
      { label: 'Adeudo promedio', value: overdueTotal == null ? null : filteredArrears.length ? overdueTotal / filteredArrears.length : 0, format: 'money' }, { label: 'Casos graves', value: filteredArrears.filter(row => row.severity === 'severe').length }];
    const matrixMetrics = [{ label: 'Préstamos', value: filteredMatrix.length }, { label: 'Fechas de pago', value: matrixDates.length },
      ...[['paid', 'Cuotas registradas'], ['capital', 'Capital'], ['interest', 'Interés'], ['fee', 'Gasto administrativo']].map(([key, label]) => ({ label, value: matrixHasDuplicates ? null : sumSnapshot(matrixEntries, key), format: 'money' }))];
    const matrixTotals = matrixDates.map(date => { const entries = matrixEntries.filter(row => row.date === date), unique = new Set(entries.map(row => row.matrix_identity)); return { date, ...Object.fromEntries(['paid', 'capital', 'interest', 'fee'].map(key => [key, unique.size < entries.length ? null : sumSnapshot(entries, key)])) }; });
    const reportRows = (report.rows || []).filter(row => match(row, reportFilter.q, ['name', 'folio', 'n', 'f', 'A', 'B']) && (!reportFilter.year || String(row.year || row.period_year) === reportFilter.year) && (!reportFilter.semester || String(row.semester) === reportFilter.semester));
    const paymentColumns = [{ key: 'date', label: 'Fecha' }, { key: 'folio', label: 'Folio' }, { key: 'name', label: 'Nombre' }, { key: 'loan_id', label: 'ID' }, { key: 'fund', label: 'Fondo' }, { key: 'paid', label: 'Cuota', format: 'money' }, { key: 'capital', label: 'Capital', format: 'money' }, { key: 'interest', label: 'Interés', format: 'money' }, { key: 'fee', label: 'Gasto admón.', format: 'money' }, { key: 'audit', label: 'Auditoría' }];
    const loanColumns = [{ key: 'folio', label: 'Folio' }, { key: 'name', label: 'Nombre' }, { key: 'id', label: 'ID' }, { key: 'fund', label: 'Fondo' }, { key: 'capital', label: 'Prestado', format: 'money' }, { key: 'total', label: 'Total contractual', format: 'money' }, { key: 'expected', label: 'Debió pagar', format: 'money' }, { key: 'paid', label: 'Pagado', format: 'money' }, { key: 'arrears', label: 'Atraso', format: 'money' }, { key: 'progress_percent', label: 'Avance', render: row => h(LoanProgress, { value: row.progress_percent }) }, { key: 'severity', label: 'Severidad', render: row => severityLabel(row.severity) }, { key: 'status', label: 'Estado' }];
    function showPayment(row) { const item = loans.find(value => String(value.id) === String(row.loan_id) && String(value.folio) === String(row.folio)); if (item) setLoan(item); else setNotice({ level: 'error', message: 'El préstamo de este pago requiere revisión de identidad en el historial.' }); }
    function displayMetrics(list) { return h('div', { className: 'sicof-metrics' }, (list || []).map((metric, index) => h(Metric, { key: index, label: metric.label, value: metric.format === 'money' ? money(metric.value) : metric.format === 'percent' ? percent(metric.value) : metric.value, note: metric.value == null ? 'Pendiente de conciliación' : metric.note }))); }
    function parameters() { return h(Panel, { title: copy('parameters') },
      h(Control, { label: 'Fuente de la bolsa', help: 'El capital recuperado y el gasto administrativo se distinguen del interés repartible.' }, h(Segment, { label: 'Fuente de la bolsa', value: settings.src, options: [['caja', 'Solo Caja de Ahorro'], ['sel', 'Fondos seleccionados'], ['todos', 'Todos']], onChange: value => change('src', value) }), settings.src === 'sel' && h('div', { style: { marginTop: 10 } }, h(Multi, { label: 'Fondos adicionales', options: fundOptions.filter(fund => fund.label !== 'Caja de Ahorro'), value: settings.selFunds, onChange: value => change('selFunds', value === null ? fundOptions.filter(fund => fund.label !== 'Caja de Ahorro').map(fund => fund.value) : value) }), h('p', { className: 'sicof-help' }, 'Caja de Ahorro siempre se incluye en esta opción.'))),
      h('div', { className: 'sicof-control' }, h(Button, { secondary: true, style: { width: '100%', whiteSpace: 'normal' }, busy: exportBusy || data?.can_export === false, onClick: () => exportFile('base_calculo') }, busy === 'export:base_calculo' ? 'Generando Excel…' : '↓ Descargar base del cálculo (.xlsx)'), h('p', { className: 'sicof-help' }, draftPending ? 'Aplica los cambios para descargar la base del nuevo cálculo.' : 'Descarga HISTORIAL P V2, columnas A–O, de los fondos seleccionados, con todas sus fechas.')),
      h(Control, { label: '% del interés a repartir: ' + settings.pay + '%', help: 'El porcentaje no repartido permanece como reserva.' }, input('pay', 'range', { min: 0, max: 100, step: 1, 'aria-label': 'Porcentaje del interés a repartir' })),
      h(Control, { label: 'Método de reparto' }, h(Segment, { label: 'Método de reparto', value: settings.method, options: [['avg', 'Saldo promedio por días'], ['end', 'Saldo final']], onChange: value => change('method', value) })),
      h(Control, { label: 'Periodo del semestre' }, h('div', { className: 'sicof-date-row' }, h(Field, { label: 'Inicio' }, input('periodIni', 'date', { 'aria-label': 'Inicio del periodo' })), h(Field, { label: 'Cierre / corte' }, input('periodFin', 'date', { 'aria-label': 'Cierre del periodo' })))),
      h(Control, { label: 'Capital que participa' }, h(Segment, { label: 'Capital que participa', value: settings.capitalBasis, options: [['all', 'Capital acumulado'], ['period', 'Aportaciones del semestre']], onChange: value => change('capitalBasis', value) })),
      h(Control, { label: 'Rendimiento sobre rendimientos anteriores', help: 'Sólo participa el rendimiento acreditado que aún permanece en la cuenta. Su origen histórico no cambia.' }, h('select', { 'aria-label': 'Rendimientos anteriores que participan', value: settings.yieldMode, onChange: event => change('yieldMode', event.target.value), style: { width: '100%' } }, h('option', { value: 'none' }, 'No; sólo aportaciones'), h('option', { value: 'previous' }, 'Sí; semestre anterior'), h('option', { value: 'selected' }, 'Sí; periodos seleccionados')), settings.yieldMode === 'selected' && h('div', { style: { marginTop: 10 } }, h(Multi, { label: 'Periodos de rendimiento', options: yieldOptions, value: settings.yieldPeriods, onChange: value => change('yieldPeriods', value === null ? yieldOptions.map(period => period.value) : value) }))),
      h(Control, { label: 'Meses mínimos de permanencia' }, input('minm', 'number', { min: 0, max: 24, step: 1, 'aria-label': 'Meses mínimos' }), h(Check, { label: 'Contar desde una fecha común', checked: settings.anchorOn, onChange: value => change('anchorOn', value) }), settings.anchorOn && input('anchorDate', 'date', { 'aria-label': 'Fecha común de permanencia' })),
      h(Control, { label: 'Reglas de exclusión' }, h(Check, { label: 'Excluir ahorradores con estado Terminado', checked: settings.exterm, onChange: value => change('exterm', value) }), h(Check, { label: 'Excluir a quien no cumple los meses mínimos', checked: settings.exmin, onChange: value => change('exmin', value) })),
      h(Control, { label: 'Cláusula 9 · Incumplimiento de descuento', help: 'Un mes vencido sin aportación de jubilado equivale a dos quincenas. Los periodos futuros no son incumplimientos.' }, h(Check, { label: 'Excluir por descuentos consecutivos faltantes', checked: settings.exConsec, onChange: value => change('exConsec', value) }), h(Field, { label: 'Quincenas consecutivas' }, input('consecN', 'number', { min: 1, max: 12, step: 1, 'aria-label': 'Quincenas consecutivas sin descuento' }))),
      h(Control, { label: 'Cláusula 10 · Préstamo atrasado' }, h(Segment, { label: 'Efecto del préstamo atrasado', value: settings.loanEffect, options: [['retiro', 'Sólo retiene el retiro'], ['rendimiento', 'Pierde rendimiento']], onChange: value => change('loanEffect', value) }), h('div', { style: { marginTop: 10 } }, h(Segment, { label: 'Alcance de retención', value: settings.retScope, options: [['todo', 'Todo el ahorro'], ['adeudo', 'Sólo el adeudo']], onChange: value => change('retScope', value) }))),
      h(Control, { label: 'Alerta de tasa anual (%)' }, input('warn', 'number', { min: 0, step: 1, 'aria-label': 'Umbral de alerta anual' })));
    }
    function scenarios() { const list = data && data.scenarios || []; return h(Panel, { title: 'Comparador de escenarios' }, h('div', { className: 'sicof-toolbar' }, canConfigure && h(Button, { onClick: saveScenario, busy: exportBusy }, '+ Guardar escenario actual'), canConfigure && list.length > 0 && h(Button, { secondary: true, busy: Boolean(busy), onClick: () => operation('clear-scenarios', async () => { for (const scene of list) await repo().deleteScenario(scene.id); }, () => setRevision(value => value + 1)) }, 'Limpiar escenarios guardados')), h(Table, { rows: list.map(scene => Object.assign({}, scene, { name: scene.name || 'Escenario ' + String(scene.created_at || '').slice(0, 10) })), columns: [
      { key: 'name', label: 'Escenario', render: scene => h('button', { type: 'button', className: 'sicof-row-link', onClick: () => { setSettings(Object.assign(draftSettings(), scene.settings)); setCosts(scene.costs || []); setBank(scene.bank || { amount: null, declaredBy: '', date: '' }); } }, scene.name) },
      { key: 'source', label: 'Fuente', render: scene => ({ caja: 'Solo Caja de Ahorro', todos: 'Todos', sel: 'Caja + ' + (scene.settings.selFunds || []).join(', ') })[scene.settings.src] },
      { key: 'pay', label: '% repartir', render: scene => percent(scene.settings.pay) }, { key: 'method', label: 'Método', render: scene => scene.settings.method === 'avg' ? 'Saldo promedio por días' : 'Saldo final' },
      { key: 'period', label: 'Periodo', render: scene => scene.settings.periodIni + ' al ' + scene.settings.periodFin }, { key: 'minm', label: 'Meses mínimos', render: scene => scene.settings.minm },
      { key: 'rate', label: 'Tasa', format: 'percent' }, { key: 'annualRate', label: 'Tasa anual', format: 'percent' }, { key: 'base', label: 'Base', format: 'money' }, { key: 'payTotal', label: 'Reparto', format: 'money' }, { key: 'eligible_count', label: 'Elegibles' }, { key: 'created_at', label: 'Guardado' },
      { key: 'actions', label: 'Acciones', render: scene => canConfigure && h('button', { type: 'button', className: 'sicof-row-remove', disabled: Boolean(busy), onClick: () => operation('delete-scenario', () => repo().deleteScenario(scene.id), () => setRevision(value => value + 1)), 'aria-label': 'Eliminar escenario ' + scene.name }, 'Eliminar') }
    ], empty: 'Aún no has guardado escenarios.' }), h('p', { className: 'sicof-help' }, 'Selecciona un escenario para recuperar todas sus reglas, costos y declaración bancaria. El cálculo actualizado puede cambiar si cambiaron las fuentes.')); }
    function summary() { return h(React.Fragment, null,
      h('details', { className: 'sicof-panel sicof-executive', open: true }, h('summary', null, copy('executive')), h('div', { className: 'sicof-panel-body' }, result && (result.summary || []).length ? h('ol', null, result.summary.map((text, index) => h('li', { key: index }, text))) : h('p', { className: 'sicof-sub' }, 'Selecciona el periodo y revisa la bolsa, sus reglas y el respaldo registrado antes de guardar un escenario.'))),
      h('div', { className: 'sicof-layout' }, parameters(), h('div', null,
        h('div', { className: 'sicof-metrics' }, h(Metric, { primary: true, label: 'Tasa del periodo', value: percent(result && result.rate), note: result && result.annualRate != null ? 'Equivalente anual: ' + percent(result.annualRate) : 'Sobre la base seleccionada' }), h(Metric, { label: 'Bolsa a repartir', value: money(result && result.pool), note: 'Después de apartados' }), h(Metric, { label: 'Interés registrado cobrado', value: money(result && result.collected) }), h(Metric, { label: 'Interés proyectado pendiente', value: money(result && result.projected) }), h(Metric, { label: 'Bolsa proyectada neta de costos', value: money(result && result.projectedNetPool), note: 'Incluye cobros futuros pendientes.' }), h(Metric, { label: 'Tasa proyectada sobre base confirmada', value: percent(result && result.projectedRateOnConfirmedBase), note: 'Usa el ahorro confirmado; no garantiza cobro ni acredita rendimiento.' }), h(Metric, { label: 'Reserva', value: money(result && result.reserve) }), h(Metric, { label: 'Base que participa', value: money(result && result.base) }), h(Metric, { label: 'Ahorradores elegibles', value: result && result.nqual }), h(Metric, { label: 'Excluidos', value: result && result.nexcl }), h(Metric, { label: 'Pendientes de revisión', value: result && result.reviewCount }), h(Metric, { label: 'Suma de rendimientos', value: money(result && result.distributed), note: result && result.reconciliation_label })), noteList(result && result.alerts), scenarios()))); }
    function distribution() { return h(React.Fragment, null, h('h2', null, copy('distribution')), h('p', { className: 'sicof-sub' }, copy('distributionNote')), h(Panel, null,
      h('details', { className: 'sicof-explanation' }, h('summary', null, '¿Cómo se calcula? · Saldo promedio, rendimiento y porcentaje'), h('div', null, h('p', { className: 'sicof-sub' }, 'El promedio pondera los importes confirmados por el tiempo que permanecieron durante el mismo periodo. Cada retiro reduce la partida que le corresponde desde su fecha efectiva.'), h('div', { className: 'sicof-formula' }, h('p', null, '1. Saldo promedio = suma de saldo × días de cada intervalo / días del periodo común.'), h('p', null, '2. Tasa del periodo (%) = rendimiento distribuido / suma de bases elegibles × 100. Rendimiento individual = base individual × tasa (%) / 100, con distribución a centavos.'), h('p', null, '3. % sobre saldo = rendimiento individual / saldo elegible final × 100. Expresa la proporción individual; no sustituye la tasa del periodo.')), h(Field, { label: 'Ver un ejemplo individual' }, h('select', { value: '', 'aria-label': 'Ejemplo de cálculo por ahorrador', onChange: event => { const row = rows.find(item => String(item.f) === event.target.value); if (row) setDetail(row); } }, h('option', { value: '' }, 'Selecciona un ahorrador'), rows.map(row => h('option', { key: row.f, value: row.f }, row.n)))))),
      h('div', { className: 'sicof-toolbar' }, h('input', { className: 'sicof-search', type: 'search', placeholder: 'Buscar nombre o folio…', 'aria-label': 'Buscar ahorrador', value: search, onChange: event => setSearch(event.target.value) }), h(Button, { gold: true, busy: exportBusy, onClick: () => exportFile('reparto_formulado', { q: search }) }, '↓ Excel formulado'), h(Button, { secondary: true, busy: exportBusy, onClick: () => exportFile('csv', { q: search }) }, 'Descargar CSV')),
      h(Table, { rows: rows.filter(row => match(row, search, ['f', 'n'])), onRow: setDetail, columns: [{ key: 'f', label: 'Folio' }, { key: 'n', label: 'Ahorrador' }, { key: 'e', label: 'Estado' }, { key: 'months', label: 'Meses', render: row => monthsLabel(row.months) }, { key: 'endbal', label: 'Saldo al corte', format: 'money' }, { key: 'avgbal', label: 'Saldo prom.', format: 'money' }, { key: 'rend', label: 'Rendimiento', format: 'money' }, { key: 'retenido', label: 'Retenido', format: 'money' }, { key: 'total', label: 'Capital + rendimientos', format: 'money' }, { key: 'entregable', label: 'Total a entregar', format: 'money' }, { key: 'pct', label: '% s/saldo', format: 'percent' }, { key: 'ok', label: 'Califica', render: eligibilityLabel }, { key: 'motivo', label: 'Motivo' }] }))); }
    function liquidity() { const liq = result && result.liquidity || {}; return h(React.Fragment, null,
      h('h2', null, '① Datos que la dirección declara'), h('p', { className: 'sicof-sub' }, 'El saldo declarado conserva responsable y fecha; una declaración no equivale a conciliación bancaria.'),
      h(Panel, null, h('div', { className: 'sicof-bank-grid' }, h(Field, { label: 'Saldo bancario del fondo de ahorro' }, h('input', { type: 'number', min: 0, step: '.01', value: bank.amount == null ? '' : bank.amount, placeholder: 'Sin saldo declarado', onChange: event => setBank(previous => Object.assign({}, previous, { amount: event.target.value === '' ? null : Number(event.target.value) })) })), h(Field, { label: 'Declarado por' }, h('input', { value: bank.declaredBy, placeholder: 'Nombre y cargo', onChange: event => setBank(previous => Object.assign({}, previous, { declaredBy: event.target.value })) })), h(Field, { label: 'Fecha de declaración' }, h('input', { type: 'date', value: bank.date, onChange: event => setBank(previous => Object.assign({}, previous, { date: event.target.value })) })))),
      h('h2', null, '② ' + copy('liquidity')), h('p', { className: 'sicof-sub' }, copy('liquidityNote')), displayMetrics(liq.metrics), noteList(liq.notes),
      h('div', { className: 'sicof-chart-grid' }, h(Panel, { title: 'Cobertura por escenario de retiro' }, h(Table, { rows: liq.scenarios || [], columns: [{ key: 'label', label: 'Escenario' }, { key: 'required', label: 'Requerido', format: 'money' }, { key: 'cash', label: 'Efectivo', format: 'money' }, { key: 'coverage', label: 'Cobertura con efectivo', format: 'percent' }, { key: 'portfolio', label: 'Cartera pendiente', format: 'money' }, { key: 'shortfall', label: 'Faltante', format: 'money' }, { key: 'status_label', label: 'Resultado' }] })), h(Panel, { title: 'Composición del respaldo' }, h(Donut, { values: liq.composition || [] })))); }
    function costSection() { return h(React.Fragment, null, h('h2', null, '④ ' + copy('costs')), h('p', { className: 'sicof-sub' }, copy('costsNote')), h(Panel, null,
      h('form', { className: 'sicof-cost-grid', onSubmit: addCost }, h(Field, { label: 'Concepto' }, h('input', { required: true, maxLength: 250, placeholder: 'Ej. Evento aniversario', value: costDraft.concept, onChange: event => setCostDraft(previous => Object.assign({}, previous, { concept: event.target.value })) })), h(Field, { label: 'Monto' }, h('input', { required: true, type: 'number', min: '.01', step: '.01', value: costDraft.amount, onChange: event => setCostDraft(previous => Object.assign({}, previous, { amount: event.target.value })) })), h(Field, { label: 'Sale de' }, h('select', { value: costDraft.source, onChange: event => setCostDraft(previous => Object.assign({}, previous, { source: event.target.value })) }, h('option', { value: 'pool' }, 'Bolsa a repartir'), h('option', { value: 'reserve' }, 'Reserva'))), h(Field, { label: 'Estado' }, h('select', { value: costDraft.status, onChange: event => setCostDraft(previous => Object.assign({}, previous, { status: event.target.value })) }, h('option', { value: 'estimated' }, 'Estimado'), h('option', { value: 'committed' }, 'Comprometido'), h('option', { value: 'paid' }, 'Pagado'))), h(Field, { label: 'Fecha' }, h('input', { type: 'date', value: costDraft.date, onChange: event => setCostDraft(previous => Object.assign({}, previous, { date: event.target.value })) })), h('button', { className: 'sicof-btn', type: 'submit' }, '+ Agregar')),
      costs.length > 0 && h(Table, { rows: costs, columns: [{ key: 'concept', label: 'Concepto' }, { key: 'amount', label: 'Monto', format: 'money' }, { key: 'source', label: 'Origen', render: row => row.source === 'pool' ? 'Bolsa a repartir' : 'Reserva' }, { key: 'status', label: 'Estado', render: row => ({ estimated: 'Estimado', committed: 'Comprometido', paid: 'Pagado' })[row.status] }, { key: 'date', label: 'Fecha' }, { key: 'remove', label: '', render: row => h('button', { type: 'button', className: 'sicof-row-remove', 'aria-label': 'Quitar costo ' + row.concept, onClick: () => setCosts(previous => previous.filter(item => item.id !== row.id)) }, '×') }] }),
      !costs.length && h('p', { className: 'sicof-help' }, 'Sin apartados, el escenario refleja la bolsa sin costos adicionales.'), h('div', { className: 'sicof-cost-bar' }, h('span', null, 'Total apartado: ' + money(result && result.costsTotal)), h('span', null, result && result.costsEffectLabel || 'El efecto se muestra en la tasa del escenario')),
      h('div', { className: 'sicof-actions' }, h(Button, { busy: exportBusy, onClick: () => exportFile('acta') }, '▤ Exportar escenario (acta imprimible)')), h('p', { className: 'sicof-help', style: { textAlign: 'center' } }, 'Incluye tasa, reglas, reserva, apartados y declaración de liquidez. Exportar no acredita ni entrega rendimientos.'))); }
    function loanPayments() { const charts = result && result.charts || {}; return h(React.Fragment, null,
      h('h2', null, '③ ' + copy('loans')), h('p', { className: 'sicof-sub' }, charts.byFundNote || copy('loansNote')), h('div', { className: 'sicof-chart-grid' }, h(CaptionChart, { title: 'Recuperado vs. falta por cobrar, por fondo', type: 'stacked', rows: charts.byFund || [], series: [{ key: 'paid', label: 'Recuperado', color: '#97002c' }, { key: 'pending', label: 'Por cobrar', color: '#d2d6df' }] }), h(CaptionChart, { title: 'Recuperación acumulada en el tiempo', type: 'line', rows: charts.recovery || [], series: [{ key: 'caja', label: 'Caja de Ahorro', color: '#97002c' }, { key: 'all', label: 'Todos los fondos', color: '#9ca5b7' }] })), costSection(),
      h('h2', null, '④·b ' + copy('paymentDetail')), h(Panel, null,
        h('div', { className: 'sicof-toolbar' }, h(Multi, { label: 'Fondos', options: fundOptions, value: paymentFilter.funds, onChange: value => setPaymentFilter(previous => Object.assign({}, previous, { funds: value })) }), h('input', { className: 'sicof-search', type: 'search', placeholder: 'Buscar nombre, folio o ID…', 'aria-label': 'Buscar pagos', value: paymentFilter.q, onChange: event => setPaymentFilter(previous => Object.assign({}, previous, { q: event.target.value })) }), h(Field, { label: 'Desde' }, h('input', { type: 'date', value: paymentFilter.from, onChange: event => setPaymentFilter(previous => Object.assign({}, previous, { from: event.target.value })) })), h(Field, { label: 'Hasta' }, h('input', { type: 'date', value: paymentFilter.to, onChange: event => setPaymentFilter(previous => Object.assign({}, previous, { to: event.target.value })) })), h(Button, { busy: exportBusy, onClick: () => exportFile('pagos', paymentFilter) }, '↓ Descargar préstamos')),
        h('p', { className: 'sicof-help' }, filteredPayments.length + ' pagos con los filtros seleccionados. Selecciona una fila para revisar el préstamo.'), displayMetrics(data && data.source && data.source.status !== 'UNAVAILABLE' ? paymentMetrics : []), h(Table, { columns: paymentColumns, rows: filteredPayments, limit: 600, onRow: showPayment })));
    }
    function arrears() { return h(React.Fragment, null, h('h2', null, copy('arrears')), h('p', { className: 'sicof-sub' }, 'Se muestran importes vencidos con evidencia; los pagos futuros y las incidencias por revisar se distinguen del incumplimiento.'), h(Panel, null,
      h('div', { className: 'sicof-toolbar' }, h(Multi, { label: 'Fondos', options: fundOptions, value: arrearsFilter.funds, onChange: value => setArrearsFilter(previous => Object.assign({}, previous, { funds: value })) }), h('input', { type: 'search', className: 'sicof-search', placeholder: 'Buscar nombre, folio o ID…', 'aria-label': 'Buscar atrasos', value: arrearsFilter.q, onChange: event => setArrearsFilter(previous => Object.assign({}, previous, { q: event.target.value })) }), h('select', { 'aria-label': 'Severidad del atraso', value: arrearsFilter.severity, onChange: event => setArrearsFilter(previous => Object.assign({}, previous, { severity: event.target.value })) }, h('option', { value: '' }, 'Todas las severidades'), h('option', { value: 'mild' }, 'Leve'), h('option', { value: 'moderate' }, 'Moderado'), h('option', { value: 'severe' }, 'Grave')), h(Button, { busy: exportBusy, onClick: () => exportFile('atrasos', arrearsFilter) }, '↓ Descargar atrasos')),
      displayMetrics(data && data.source && data.source.status !== 'UNAVAILABLE' ? arrearsMetrics : []), h(Table, { rows: filteredArrears, columns: loanColumns, onRow: setLoan })));
    }
    function matrix() { const years = [...new Set(loans.flatMap(item => (item.schedule || []).map(row => String(row.date).slice(0, 4))))].sort().reverse(); return h(React.Fragment, null, h('h2', null, copy('matrix')), h('p', { className: 'sicof-sub' }, 'Matriz consolidada por préstamo y fecha: cuota, capital, interés y gasto administrativo.'), h(Panel, null,
      h('div', { className: 'sicof-toolbar' }, h(Multi, { label: 'Fondos', options: fundOptions, value: matrixFilter.funds, onChange: value => setMatrixFilter(previous => Object.assign({}, previous, { funds: value })) }), h('select', { 'aria-label': 'Año del reporte de préstamos', value: matrixFilter.year, onChange: event => setMatrixFilter(previous => Object.assign({}, previous, { year: event.target.value })) }, h('option', { value: '' }, 'Todos los años'), years.map(year => h('option', { value: year, key: year }, year))), h('input', { type: 'search', className: 'sicof-search', 'aria-label': 'Buscar reporte de préstamos', placeholder: 'Buscar nombre, folio o ID…', value: matrixFilter.q, onChange: event => setMatrixFilter(previous => Object.assign({}, previous, { q: event.target.value })) }), h(Button, { busy: exportBusy, onClick: () => exportFile('matriz', matrixFilter) }, '↓ Descargar Excel'), h(Button, { secondary: true, busy: exportBusy, onClick: () => exportFile('matriz_fondos', matrixFilter) }, '↓ Excel por fondo')),
      displayMetrics(data && data.source && data.source.status !== 'UNAVAILABLE' ? matrixMetrics : []),
      h('div', { className: 'sicof-table-scroll' }, h('table', { className: 'sicof-table' }, h('thead', null, h('tr', null, ['ID', 'Folio', 'Nombre', 'Fondo', 'Proceso', 'Estado', 'Prestado', 'Tasa quincenal', 'Plazo', 'Total', 'Cargos totales registrados', 'Capital + interés contractual', 'Interés total', 'Gasto admón. total', 'Inicio descuento', 'Fin descuento', 'Transferencia', 'Fecha descuento', 'Solicitud'].map(text => h('th', { key: text, rowSpan: 2 }, text)), matrixDates.map(date => h('th', { key: date, colSpan: 4, style: { textAlign: 'center' } }, date))), h('tr', null, matrixDates.flatMap(date => ['Cuota', 'Capital', 'Interés', 'Gasto admón.'].map(label => h('th', { key: date + label, className: 'number' }, label))))), h('tbody', null, filteredMatrix.slice(0, 100).map(item => h('tr', { key: item.id + ':' + item.folio, 'data-clickable': true, tabIndex: 0, onClick: () => setLoan(item), onKeyDown: event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); setLoan(item); } } }, [item.id, item.folio, item.name, item.fund, item.process, item.status, money(item.capital), percent(item.rate_percent), item.term, money(item.total), money(item.loan_charges), money(item.principal_interest_total), money(item.interest_total), money(item.admin_fee_total), item.discount_start, item.discount_end, item.transfer_date, item.discount_date, item.request_date].map((value, index) => h('td', { key: index }, value)), matrixDates.flatMap(date => { const entries = (item.schedule || []).filter(row => row.date === date), entry = entries.length === 1 ? entries[0] : null; return ['paid', 'capital', 'interest', 'fee'].map(key => h('td', { key: date + key, className: 'number' }, entries.length > 1 ? 'Por revisar' : money(entry && entry[key]))); })))), h('tfoot', null, h('tr', null, h('td', { colSpan: 19 }, 'Totales de los filtros seleccionados'), matrixTotals.flatMap(total => ['paid', 'capital', 'interest', 'fee'].map(key => h('td', { key: total.date + key, className: 'number' }, total[key] == null ? 'Por conciliar' : money(total[key]))))))), !filteredMatrix.length && h('div', { className: 'sicof-empty' }, 'No hay préstamos con estos filtros.')),
      h('p', { className: 'sicof-help' }, 'Se muestran hasta 100 préstamos. Ambas descargas respetan los mismos filtros e incluyen todos los registros.')));
    }
    function compliance() { return h(React.Fragment, null, h('h2', null, '⑤ ' + copy('compliance')), h('p', { className: 'sicof-sub' }, 'Cada regla muestra la evidencia revisada y su aplicación en el escenario. La simulación no modifica políticas ni acreditaciones anteriores.'), h(Panel, null, h(Table, { rows: result && result.compliance || [], columns: [{ key: 'rule', label: 'Regla del reglamento' }, { key: 'requirement', label: 'Qué exige' }, { key: 'application', label: 'Cómo se aplica' }, { key: 'status', label: 'Estado' }] })));
    }
    function savingsReport() { const years = [...new Set([settings.periodIni.slice(0, 4), ...(report.periods || periods).map(period => String(period.year || period.period_year)).filter(year => year !== 'undefined')])].sort().reverse(); return h(React.Fragment, null, h('h2', null, copy('savings')), h('p', { className: 'sicof-sub' }, copy('savingsNote')), h(Panel, null,
      h('div', { className: 'sicof-toolbar' }, h('input', { type: 'search', className: 'sicof-search', placeholder: 'Buscar nombre o folio…', 'aria-label': 'Buscar informe de ahorro', value: reportFilter.q, onChange: event => setReportFilter(previous => Object.assign({}, previous, { q: event.target.value })) }), h('select', { value: reportFilter.year, 'aria-label': 'Año del ahorro', onChange: event => setReportFilter(previous => Object.assign({}, previous, { year: event.target.value, semester: event.target.value ? previous.semester : '' })) }, h('option', { value: '' }, 'Todos los años'), years.map(year => h('option', { key: year, value: year }, year))), h('select', { value: reportFilter.semester, 'aria-label': 'Semestre del ahorro', onChange: event => setReportFilter(previous => Object.assign({}, previous, { semester: event.target.value, year: event.target.value ? previous.year || settings.periodIni.slice(0, 4) : previous.year })) }, h('option', { value: '' }, 'Ambos semestres'), h('option', { value: '1' }, 'Enero a junio'), h('option', { value: '2' }, 'Julio a diciembre')), h(Button, { gold: true, busy: Boolean(busy) || phase !== 'ready', onClick: () => exportFile('final_ahorro', reportFilter) }, '↓ Descargar informe final de ahorro')),
      h('div', { className: 'sicof-toolbar' }, h(Button, { secondary: true, busy: Boolean(busy), onClick: exportHistorical }, '↓ Descargar Excel histórico original')), noteList(report.notes), h(Table, { rows: reportRows, columns: report.columns || [{ key: 'folio', label: 'Folio' }, { key: 'name', label: 'Ahorrador' }, { key: 'period_label', label: 'Periodo' }, { key: 'capital', label: 'Aportaciones', format: 'money' }, { key: 'yield', label: 'Rendimiento', format: 'money' }, { key: 'withdrawn_capital', label: 'Capital retirado', format: 'money' }, { key: 'withdrawn_yield', label: 'Rendimiento pagado', format: 'money' }, { key: 'remaining', label: 'Saldo restante', format: 'money' }, { key: 'available', label: 'Disponible', format: 'money' }], onRow: row => setDetail({ reportRow: row, participant_id: row.participant_id, n: row.name || row.n || row.B, f: row.folio || row.f || row.A, movements: row.movements, periods: row.periods }), totals: reportFilter.q || reportFilter.year || reportFilter.semester ? null : report.totals }), h('p', { className: 'sicof-help' }, 'Los retiros se atribuyen a sus partidas de origen. Un total histórico sin desglose se mantiene identificado para conciliación y no duplica el saldo actual.')));
    }
    function saverDetail() {
      if (!detail || attribution) return null;
      const canonical = report.balances && report.balances[detail.participant_id];
      const componentLabel = value => value === 'CAPITAL' ? 'Ahorro' : value === 'YIELD' ? 'Rendimiento' : value || '—';
      const typeLabel = value => ({ CONTRIBUTION: 'Aportación', WITHDRAWAL: 'Retiro', YIELD: 'Rendimiento', YIELD_CREDIT: 'Rendimiento', REGULARIZATION: 'Saldo inicial certificado', ADJUSTMENT: 'Ajuste', REVERSAL: 'Reversión' })[value] || value || '—';
      const movementColumns = [
        { key: 'effective_date', label: 'Fecha', render: row => row.effective_date || row.date || '—' },
        { key: 'type', label: 'Movimiento', render: row => row.label || typeLabel(row.type) },
        { key: 'component', label: 'Componente', render: row => row.component_label || componentLabel(row.component) },
        { key: 'amount', label: 'Importe', format: 'money', render: row => (row.direction === 'DEBIT' ? '−' : '') + money(row.amount) },
        { key: 'origins', label: 'Periodos de origen', render: row => (row.origins || []).length ? row.origins.map(origin => (origin.origin_key === 'OPENING' ? 'Saldo inicial por identificar' : origin.origin_key) + ': ' + money(origin.amount)).join(' · ') : row.period_label || 'Periodo por identificar' }
      ];
      if (app.admin.has('savings.approve') && detail.participant_id) movementColumns.push({ key: 'classify', label: 'Origen', render: row => row.can_classify ? h(Button, { secondary: true, onClick: () => setAttribution({ participantId: detail.participant_id, transactionId: row.transaction_id }) }, 'Identificar periodo') : null });
      return h(window.SicofModal, { title: detail.n || 'Detalle del ahorrador', subtitle: 'Folio ' + detail.f, onClose: () => setDetail(null) }, h('div', { className: 'sicof' },
        !detail.reportRow && h('p', { className: 'sicof-help' }, 'Califica: ' + eligibilityLabel(detail) + ' · Permanencia: ' + monthsLabel(detail.months) + (detail.months == null ? '' : ' meses')),
        canonical && h('div', { className: 'sicof-metrics' }, h(Metric, { label: 'Capital actual', value: money(canonical.capital) }), h(Metric, { label: 'Rendimiento acreditado actual', value: money(canonical.yield_amount) }), h(Metric, { label: 'Saldo actual', value: money(canonical.total) }), h(Metric, { label: 'Disponible global actual', value: money(canonical.available), note: 'Consultado al ' + (canonical.observed_at || canonical.as_of || '—') + '; no se suma por periodo.' })),
        !detail.reportRow && h('div', { className: 'sicof-metrics' }, h(Metric, { label: 'Saldo al corte', value: money(detail.endbal) }), h(Metric, { label: 'Promedio por días', value: money(detail.avgbal) }), h(Metric, { label: 'Rendimiento', value: money(detail.rend), note: detail.motivo }), h(Metric, { label: 'Retenido', value: money(detail.retenido) }), h(Metric, { label: 'Entregable', value: money(detail.entregable) })),
        h('h3', null, 'Movimientos registrados'), h(Table, { columns: movementColumns, rows: detail.movements || [] }),
        (detail.periods || []).length > 0 && h(React.Fragment, null, h('h3', { style: { marginTop: 20 } }, 'Aportaciones, rendimientos y retiros por periodo'), h(Table, { rows: detail.periods, columns: [
          { key: 'origin_key', label: 'Periodo', render: row => row.origin_key === 'OPENING' ? 'Saldo inicial por identificar' : row.origin_key === 'UNALLOCATED_WITHDRAWAL' ? 'Retiro por conciliar' : row.origin_key === 'UNALLOCATED_REVERSAL' ? 'Reversión pendiente de identificar' : row.origin_key === 'UNALLOCATED_ADJUSTMENT' ? 'Ajuste por conciliar' : row.origin_key === 'UNALLOCATED_CREDIT' ? 'Ingreso por identificar' : row.origin_key },
          { key: 'component', label: 'Componente', render: row => componentLabel(row.component) },
          { key: 'recognized', label: 'Reconocido', format: 'money' }, { key: 'withdrawn', label: 'Retirado', format: 'money' }, { key: 'adjustments', label: 'Ajustes', format: 'money' }, { key: 'remaining', label: 'Saldo restante', format: 'money' }
        ] })),
        !detail.reportRow && h(React.Fragment, null, h('h3', { style: { marginTop: 20 } }, 'Desglose del cálculo por días'), h(Table, { rows: detail.calculation_steps || [], empty: 'El desglose por días requiere fechas e importes comprobados para el periodo.', columns: [
          { key: 'date', label: 'Fecha' }, { key: 'amount', label: 'Movimiento', format: 'money' }, { key: 'balance', label: 'Saldo elegible', format: 'money' }, { key: 'days', label: 'Permanencia (días)' }, { key: 'balance_days', label: 'Saldo × días', format: 'money' }
        ] })),
        detail.calculation_explanation && h('p', { className: 'sicof-formula' }, detail.calculation_explanation),
        (detail.loans || []).length > 0 && h('div', { style: { marginTop: 20 } }, h('h3', null, 'Préstamos e historial de pagos'), detail.loans.map(item => h('details', { key: item.id + ':' + item.folio, className: 'sicof-explanation' }, h('summary', null, item.fund + ' · ' + item.id + ' · ' + item.status), h('div', null, h(window.SicofLoanContent, { loan: item })))))));
    }
    const panes = { resumen: summary, liquidez: liquidity, reparto: distribution, prestamos: loanPayments, atrasos: arrears, reporte: matrix, cumplimiento: compliance, ahorro: savingsReport };
    return h(CaptionContext.Provider, { value: caption }, h('div', { className: 'sicof', 'data-admin-view': 'sicof', 'data-sicof-phase': phase }, h('style', null, CSS), header && header({ title: 'Sicof', sub: 'Rendimientos y seguimiento por periodo', onBack }),
      h('div', { className: 'su-app-scroll sicof-content' },
        h('div', { className: 'sicof-title-row' }, h('div', null, h('h1', null, copy('title')), h('p', { className: 'sicof-sub' }, copy('subtitle')), data && data.source && h('p', { className: 'sicof-source' }, 'Información consultada: ' + (data.source.observed_at ? new Date(data.source.observed_at).toLocaleString('es-MX') : 'Fecha no informada'))), h('div', { className: 'sicof-toolbar' }, h(Button, { secondary: true, busy: Boolean(busy) || phase === 'loading', onClick: refresh }, 'Actualizar'), h(Button, { busy: Boolean(busy) || phase === 'loading' || !draftPending, onClick: refresh }, 'Aplicar y calcular'), canConfigure && h(Button, { secondary: true, busy: Boolean(busy), onClick: () => setEditing(Object.assign({}, TEXTS, texts)) }, 'Editar textos'))),
        h('div', { className: 'sicof-tabs', role: 'tablist', 'aria-label': 'Secciones de Sicof' }, order.map((id, index) => h('div', { key: id, className: 'sicof-tab', 'data-active': tab === id, draggable: canConfigure && !busy, onDragStart: () => { drag.current = id; }, onDragOver: event => event.preventDefault(), onDrop: event => { event.preventDefault(); if (canConfigure && drag.current) moveTab(drag.current, id); drag.current = null; } }, h('button', { type: 'button', role: 'tab', id: 'sicof-tab-' + id, 'aria-controls': 'sicof-pane-' + id, 'aria-selected': tab === id, onClick: () => setTab(id) }, TABS.find(item => item.id === id).label), canConfigure && h('button', { type: 'button', disabled: index === 0 || Boolean(busy), 'aria-label': 'Mover ' + TABS.find(item => item.id === id).label + ' a la izquierda', onClick: () => moveTab(id, order[index - 1]) }, '‹')))),
        data && data.source && data.source.status === 'UNAVAILABLE' && h('div', { className: 'sicof-status error', role: 'alert' }, data.source.error || 'No fue posible consultar los préstamos. El informe de ahorro conserva su fuente disponible.'),
        phase === 'loading' && h('div', { className: 'sicof-status', role: 'status' }, 'Consultando ahorro y pagos registrados…'),
        phase === 'error' && h('div', { className: 'sicof-status error sicof-error-line', role: 'alert' }, loadError, h(Button, { secondary: true, onClick: refresh }, 'Reintentar')),
        calculation === 'loading' && h('div', { className: 'sicof-source', role: 'status' }, 'Actualizando cálculo del escenario…'),
        calculation === 'error' && h('div', { className: 'sicof-status error sicof-error-line', role: 'alert' }, calculationError, h(Button, { secondary: true, onClick: refresh }, 'Reintentar cálculo')),
        draftPending && h('div', { className: 'sicof-status', role: 'status' }, 'Hay cambios sin aplicar. Pulsa Aplicar y calcular para consultar las fuentes una sola vez con todos los par\u00e1metros. Los datos de las otras secciones corresponden a la \u00faltima consulta.'),
        notice && h('div', { className: 'sicof-status' + (notice.level === 'error' ? ' error' : ' success'), role: notice.level === 'error' ? 'alert' : 'status' }, notice.message),
        h('section', { id: 'sicof-pane-' + tab, role: 'tabpanel', 'aria-labelledby': 'sicof-tab-' + tab, 'aria-busy': phase === 'loading' || calculation === 'loading' }, panes[tab]())),
      saverDetail(), attribution && h(Attribution, { key: attribution.transactionId, ...attribution, onClose: () => setAttribution(null), onSaved: () => { setAttribution(null); setDetail(null); setNotice({ message: 'Clasificación registrada sin modificar el saldo.' }); setRevision(value => value + 1); } }), loan && h(window.SicofLoanDetail, { loan, onClose: () => setLoan(null) }),
      editing && h(window.SicofModal, { title: 'Editar textos de Sicof', subtitle: 'La presentación no modifica importes ni reglas del cálculo.', onClose: () => setEditing(null) }, h('div', { className: 'sicof sicof-text-editor' }, Object.keys(TEXTS).map(key => h(Field, { key, label: TEXTS[key] }, h('textarea', { maxLength: 480, 'aria-label': TEXTS[key], value: editing[key], onChange: event => setEditing(previous => Object.assign({}, previous, { [key]: event.target.value })) }))), preferenceError(editing, order) && h('div', { className: 'sicof-status error', role: 'alert' }, preferenceError(editing, order)), h(Button, { busy: Boolean(busy) || Boolean(preferenceError(editing, order)), onClick: () => savePreferences(editing, order) }, 'Guardar textos')))));
  }
  function SicofAdmin({ app, onBack, header }) {
    const identity = window.SicofView.useContext();
    if (!identity || !app.admin || app.admin.phase !== 'authorized') return h('div', { role: 'alert' }, 'Acceso administrativo requerido.');
    return h(Workbench, { key: identity, app, onBack, header, identity });
  }
  window.SicofAttribution = Attribution;
  window.SicofAdmin = SicofAdmin;
  window.SicofAdminModule = SicofAdmin;
})();
