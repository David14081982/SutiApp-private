/* SICOF: presentation of authorized backend loan evidence. No scoring or
   financial allocation is calculated in the browser. */
(function () {
  'use strict';
  const h = React.createElement;
  const money = value => value == null || value === '' ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(value));
  const CSS = `
    .sicof-overlay{position:fixed;inset:0;z-index:180;background:rgba(17,20,30,.57);display:flex;align-items:center;justify-content:center;padding:20px}.sicof-dialog{background:#fff;border-radius:19px;width:min(920px,100%);max-height:90dvh;display:flex;flex-direction:column;box-shadow:0 24px 72px #0004;color:#172039;font-family:inherit}.sicof-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:21px 24px;border-bottom:1px solid #e2e5ed}.sicof-dialog-head h2{margin:0;font-size:20px;color:#96052b}.sicof-dialog-head p{margin:7px 0 0;color:#737d91;font-size:12px;line-height:1.55}.sicof-dialog-close{border:0;border-radius:10px;background:#f3f3f6;min-width:36px;height:36px;cursor:pointer;color:#303442;font-size:20px}.sicof-dialog-body{padding:20px 24px;overflow:auto;min-height:0}.sicof-view-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}.sicof-view-tabs button,.sicof-detail-loan{border:1px solid #e0e4ed;background:#f5f5f8;border-radius:9px;color:#626d82;padding:10px 14px;cursor:pointer;font:700 12px inherit}.sicof-view-tabs button[aria-selected=true]{color:white;background:#920027;border-color:#920027}.sicof-chart-card{border:1px solid #e0e4ed;background:#fff;border-radius:14px;padding:16px;margin-bottom:16px}.sicof-chart-title{font-weight:750;color:#940028;font-size:13px;margin-bottom:10px}.sicof-chart-legend{display:flex;flex-wrap:wrap;gap:12px;color:#758096;font-size:10.5px;margin-bottom:7px}.sicof-chart-legend span{display:inline-flex;align-items:center;gap:5px}.sicof-chart-legend i{width:10px;height:10px;border-radius:3px}.sicof-chart-scroll{overflow:auto}.sicof-chart-svg{display:block;width:100%;min-width:300px;height:auto}.sicof-detail-table{width:100%;border-collapse:collapse;font-size:12px}.sicof-detail-table th{text-align:left;color:#788397;font-size:10px;letter-spacing:.03em;background:#fafafb}.sicof-detail-table td,.sicof-detail-table th{padding:10px 8px;border-bottom:1px solid #e6e8ef;white-space:nowrap}.sicof-detail-table .is-number{text-align:right;font-variant-numeric:tabular-nums}.sicof-detail-note{color:#737d91;font-size:12px;line-height:1.6}.sicof-detail-stats{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sicof-detail-stats span{padding:6px 10px;border-radius:999px;background:#f6f1f4;color:#860d32;font-size:11px;font-weight:750}.sicof-behavior{display:inline-flex;align-items:center;gap:5px;border:1px solid #dee6e9;border-radius:999px;padding:3px 8px;background:#eff8f3;color:#237351;font:700 10px inherit;cursor:pointer;margin-top:5px}.sicof-behavior[data-state=ARREARS]{background:#fff3e5;color:#965918;border-color:#f1dabb}.sicof-behavior[data-state=REVIEW],.sicof-behavior[data-state=error]{background:#fff0f1;color:#9b2139;border-color:#f0d2d9}.sicof-behavior[data-state=NO_HISTORY],.sicof-behavior[data-state=loading]{background:#f4f5f8;color:#727d90}.sicof-detail-loans{display:grid;gap:10px}.sicof-detail-loan{text-align:left;background:#fff;display:flex;justify-content:space-between;gap:14px}.sicof-detail-loan small{display:block;margin-top:5px;color:#737d91}.sicof-detail-error{padding:14px;border:1px solid #f1d2db;border-radius:10px;background:#fff4f6;color:#9b2340;font-size:12px}.sicof-dialog button:focus-visible{outline:3px solid #b9607a;outline-offset:2px}@media(max-width:600px){.sicof-overlay{padding:10px}.sicof-dialog{max-height:94dvh}.sicof-dialog-head,.sicof-dialog-body{padding:16px}.sicof-dialog-head h2{font-size:17px}}
  `;
  function contextKey() {
    const state = window.AffiliateAuth && window.AffiliateAuth.getState();
    if (!state || state.phase !== 'authenticated') return '';
    return [state.session && state.session.user && state.session.user.id, state.affiliate && state.affiliate.id, state.impersonation && (state.impersonation.id || state.impersonation.session_id)].join(':');
  }
  function useContext() {
    const [key, setKey] = React.useState(contextKey);
    React.useEffect(() => window.AffiliateAuth ? window.AffiliateAuth.subscribe(() => setKey(contextKey())) : undefined, []);
    return key;
  }
  function Modal({ title, subtitle, children, onClose }) {
    const ref = React.useRef(null), closing = React.useRef(onClose);
    closing.current = onClose;
    React.useEffect(() => {
      const previous = document.activeElement, element = ref.current;
      const candidates = () => [...element.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')].filter(node => node.getClientRects().length);
      element.focus();
      function keyboard(event) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closing.current(); }
        if (event.key === 'Tab') {
          const nodes = candidates(), first = nodes[0], last = nodes[nodes.length - 1];
          if (!nodes.length) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus(); }
        }
      }
      element.addEventListener('keydown', keyboard);
      return () => { element.removeEventListener('keydown', keyboard); if (previous && previous.isConnected) previous.focus(); };
    }, []);
    return h('div', { className: 'sicof-overlay', onMouseDown: event => { if (event.target === event.currentTarget) onClose(); } }, h('style', null, CSS),
      h('section', { className: 'sicof-dialog', ref, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabIndex: -1 },
        h('header', { className: 'sicof-dialog-head' }, h('div', null, h('h2', null, title), subtitle && h('p', null, subtitle)), h('button', { type: 'button', className: 'sicof-dialog-close', onClick: onClose, 'aria-label': 'Cerrar detalle' }, '×')),
        h('div', { className: 'sicof-dialog-body' }, children)));
  }
  // Scaling is visual only. Every displayed monetary point is supplied by backend.
  function Chart({ title, rows, series, type, areaBetween }) {
    const list = Array.isArray(rows) ? rows : [], fields = Array.isArray(series) ? series : [];
    if (!list.length) return h('div', { className: 'sicof-chart-card' }, h('div', { className: 'sicof-chart-title' }, title), h('p', { className: 'sicof-detail-note' }, 'No hay movimientos para este periodo.'));
    const width = Math.max(560, Math.min(1800, list.length * 48)), height = 248, left = 64, bottom = 52, top = 16, area = height - bottom - top;
    const values = list.flatMap(row => type === 'stacked' ? [fields.reduce((height, field) => height + (Number(row[field.key]) || 0), 0)] : fields.map(field => Number(row[field.key]))).filter(Number.isFinite), max = Math.max(1, ...values.map(Math.abs));
    const segments = keys => { const groups = []; let points = []; list.forEach((row, index) => { if (keys.every(key => row[key] != null && Number.isFinite(Number(row[key])))) points.push({ row, index }); else if (points.length) { groups.push(points); points = []; } }); if (points.length) groups.push(points); return groups; };
    const colors = { complete: '#97002c', partial: '#ec791e', extra: '#21805b', unpaid: '#cf123a', future: '#c6cbd5', review: '#b48a3d' };
    const y = value => top + area - Number(value) / max * area, x = index => left + (index + .5) * (width - left - 18) / list.length;
    const tick = value => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    return h('section', { className: 'sicof-chart-card', 'aria-label': title }, h('div', { className: 'sicof-chart-title' }, title),
      h('div', { className: 'sicof-chart-legend' }, fields.map(field => h('span', { key: field.key }, h('i', { style: { background: field.color } }), field.label)), fields.some(field => field.byStatus) && h('span', null, h('i', { style: { background: colors.partial } }), 'Pago parcial'), fields.some(field => field.byStatus) && h('span', null, h('i', { style: { background: colors.unpaid } }), 'Sin pago'), areaBetween && h('span', null, h('i', { style: { background: '#ffe5ea' } }), 'Diferencia acumulada')),
      h('div', { className: 'sicof-chart-scroll' }, h('svg', { className: 'sicof-chart-svg', viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': title },
        [0, .5, 1].map(ratio => h('g', { key: ratio }, h('line', { x1: left, y1: y(max * ratio), x2: width - 12, y2: y(max * ratio), stroke: '#e3e6ef', strokeDasharray: '3 4' }), h('text', { x: left - 8, y: y(max * ratio) + 4, textAnchor: 'end', fill: '#778298', fontSize: 10 }, tick(max * ratio)))),
        areaBetween && segments(areaBetween).map((group, index) => h('polygon', { key: 'area' + index, points: group.map(point => x(point.index) + ',' + y(point.row[areaBetween[0]])).concat([...group].reverse().map(point => x(point.index) + ',' + y(point.row[areaBetween[1]]))).join(' '), fill: '#ffe5ea', opacity: .85 })),
        fields.map((field, column) => type === 'line'
          ? h('g', { key: field.key }, segments([field.key]).map((group, index) => h('polyline', { key: index, points: group.map(point => x(point.index) + ',' + y(point.row[field.key])).join(' '), fill: 'none', stroke: field.color, strokeWidth: 2.5 })))
          : h('g', { key: field.key }, list.map((row, index) => { const value = row[field.key]; if (value == null || !Number.isFinite(Number(value))) return null; const size = Math.max(4, Math.min(22, (width - left - 18) / list.length / (fields.length + 1))), offset = type === 'stacked' ? fields.slice(0, column).reduce((height, prior) => height + (Number(row[prior.key]) || 0), 0) : 0; return h('rect', { key: index, x: type === 'stacked' ? x(index) - size / 2 : x(index) + (column - fields.length / 2) * size, y: y(Number(value) + offset), width: size - 2, height: Math.max(0, Number(value) / max * area), fill: field.byStatus ? colors[row.comparison_state] || field.color : field.color, rx: 2 }, h('title', null, String(row.label || row.date || index + 1) + ': ' + field.label + ' ' + money(value))); }))),
        list.map((row, index) => h('text', { key: index, x: x(index), y: height - bottom + 18, fill: '#778298', fontSize: 9, textAnchor: 'middle', transform: list.length > 12 ? 'rotate(-35 ' + x(index) + ' ' + (height - bottom + 18) + ')' : undefined }, String(row.label || row.date || index + 1).slice(0, 22))))));
  }
  function Table({ columns, rows }) {
    return h('div', { style: { overflow: 'auto' } }, h('table', { className: 'sicof-detail-table' }, h('thead', null, h('tr', null, columns.map(column => h('th', { key: column.key, className: column.money ? 'is-number' : undefined }, column.label)))), h('tbody', null, rows.map((row, index) => h('tr', { key: row.id || index }, columns.map(column => h('td', { key: column.key, className: column.money ? 'is-number' : undefined }, column.key === '_index' ? index + 1 : column.money ? money(row[column.key]) : row[column.key] == null ? '—' : String(row[column.key]))))))));
  }
  function LoanSummary({ loan }) {
    const pct = value => value == null ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value) + '%';
    const values = [['Monto prestado', money(loan.capital)], ['Total a pagar', money(loan.total)], ['Tasa quincenal', pct(loan.rate_percent)], ['Plazo', loan.term == null ? '—' : loan.term + ' pagos'], ['Pagado registrado', money(loan.paid)], ['Falta por pagar', money(loan.remaining_contractual)]];
    return h('div', { className: 'sicof-chart-card', 'data-sicof-loan-summary': loan.id }, h('div', { className: 'sicof-chart-title' }, loan.fund + ' · ' + (loan.status || 'Estado por revisar')),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 14 } }, values.map(([label, value]) => h('div', { key: label }, h('span', { className: 'sicof-detail-note', style: { display: 'block', fontSize: 11 } }, label), h('b', null, value)))),
      h('div', { style: { marginTop: 14 } }, loan.progress_percent != null && h('progress', { value: loan.progress_percent, max: 100, 'aria-label': 'Avance del préstamo', style: { width: '100%', accentColor: '#96002b' } }), h('p', { className: 'sicof-detail-note' }, 'Avance: ' + pct(loan.progress_percent) + ' · Atraso: ' + money(loan.arrears) + ' · ' + (loan.discount_start || '—') + ' → ' + (loan.discount_end || '—'))));
  }
  function LoanContent({ loan }) {
    const [view, setView] = React.useState('history');
    const schedule = loan.schedule || [];
    return h(React.Fragment, null, h(LoanSummary, { loan }),
      h('div', { className: 'sicof-view-tabs', role: 'tablist', 'aria-label': 'Detalle del préstamo' }, [['history', 'A · Historial real de pagos'], ['compare', 'B · Comparación esperado vs. pagado']].map(([key, label]) => h('button', { key, type: 'button', role: 'tab', 'aria-selected': view === key, onClick: () => setView(key) }, label))),
      view === 'history'
        ? h(Table, { rows: schedule, columns: [{ key: '_index', label: '#' }, { key: 'date', label: 'Fecha' }, { key: 'paid', label: 'Pagado', money: true }, { key: 'capital', label: 'Capital', money: true }, { key: 'interest', label: 'Interés', money: true }, { key: 'fee', label: 'Gasto admón.', money: true }, { key: 'cumulative_paid', label: 'Acumulado', money: true }] })
        : h(React.Fragment, null,
          h(Chart, { title: 'Esperado vs. pagado por cuota', rows: schedule, series: [{ key: 'expected', label: 'Esperado', color: '#d9dce4' }, { key: 'paid', label: 'Pagado registrado', color: '#97002c', byStatus: true }] }),
          h(Chart, { title: 'Acumulado: lo que debió pagar vs. lo que pagó', type: 'line', areaBetween: ['cumulative_expected', 'cumulative_paid'], rows: schedule, series: [{ key: 'cumulative_expected', label: 'Debió pagar', color: '#9ca5b7' }, { key: 'cumulative_paid', label: 'Pagó registrado', color: '#97002c' }] }),
          h('div', { className: 'sicof-detail-stats' }, (loan.comparison_summary || []).map((item, index) => h('span', { key: index }, item.label + ': ' + item.value))),
          h(Table, { rows: schedule, columns: [{ key: '_index', label: '#' }, { key: 'date', label: 'Fecha' }, { key: 'expected', label: 'Esperado', money: true }, { key: 'paid', label: 'Pagado', money: true }, { key: 'difference', label: 'Diferencia', money: true }, { key: 'comparison_label', label: 'Estado' }] })),
      !schedule.length && h('p', { className: 'sicof-detail-note' }, 'No hay cuotas registradas para este préstamo.'),
      h('p', { className: 'sicof-detail-note' }, loan.evidence_note || 'Los importes se presentan según el historial registrado. La puntualidad requiere evidencia de vencimiento y fecha efectiva de pago; una cuota futura no equivale a incumplimiento.'));
  }
  function LoanDetail({ loan, onClose }) {
    return h(Modal, { title: loan.name || 'Detalle del préstamo', subtitle: ['Folio ' + loan.folio, 'ID ' + loan.id, loan.fund, 'Prestado ' + money(loan.capital), 'Atraso ' + money(loan.arrears)].filter(Boolean).join(' · '), onClose }, h(LoanContent, { key: loan.id + ':' + loan.folio, loan }));
  }
  function BehaviorInner({ affiliateId, identity }) {
    const [state, setState] = React.useState({ phase: 'loading', data: null }), [open, setOpen] = React.useState(false), [loan, setLoan] = React.useState(null), [revision, setRevision] = React.useState(0);
    React.useEffect(() => {
      let live = true; setState({ phase: 'loading', data: null }); setOpen(false); setLoan(null);
      Promise.resolve().then(() => window.SicofRepository.getBehavior(affiliateId)).then(data => { if (live && contextKey() === identity) setState({ phase: 'ready', data }); }, () => { if (live && contextKey() === identity) setState({ phase: 'error', data: null }); });
      return () => { live = false; };
    }, [affiliateId, identity, revision]);
    const data = state.data, status = data ? data.status : state.phase;
    const labels = { CURRENT: 'Al corriente', ARREARS: 'Con atraso', NO_HISTORY: 'Sin historial', REVIEW: 'Información por revisar' };
    return h(React.Fragment, null, h('style', null, CSS),
      h('button', { type: 'button', className: 'sicof-behavior', 'data-state': status, 'data-sicof-behavior': affiliateId, 'aria-haspopup': 'dialog', onKeyDown: event => event.stopPropagation(), onClick: event => { event.stopPropagation(); if (state.phase === 'error') setRevision(v => v + 1); else if (state.phase === 'ready') setOpen(true); } }, state.phase === 'loading' ? 'Consultando cumplimiento…' : state.phase === 'error' ? 'Reintentar cumplimiento' : data.label || labels[data.status] || 'Información por revisar'),
      open && data && !loan && h(Modal, { title: 'Comportamiento de pagos', subtitle: data.observed_at ? 'Actualizado: ' + new Date(data.observed_at).toLocaleString('es-MX') : null, onClose: () => setOpen(false) },
        h('p', { className: 'sicof-detail-note' }, data.label || labels[data.status]),
        h('div', { className: 'sicof-detail-stats' }, (data.summary || []).map((item, index) => h('span', { key: index }, item.label + ': ' + item.value))),
        h('div', { className: 'sicof-detail-loans' }, (data.loans || []).map(item => h('button', { key: item.id + ':' + item.folio, type: 'button', className: 'sicof-detail-loan', onClick: () => setLoan(item) }, h('span', null, item.fund + ' · ' + item.id, h('small', null, item.status)), h('span', null, money(item.paid), h('small', null, 'Pagado registrado'))))),
        !(data.loans || []).length && h('p', { className: 'sicof-detail-note' }, 'No hay préstamos registrados para esta persona.'),
        h('p', { className: 'sicof-detail-note' }, 'Este indicador apoya la revisión y no aprueba ni rechaza solicitudes automáticamente.')),
      loan && h(LoanDetail, { loan, onClose: () => setLoan(null) }));
  }
  function Behavior({ affiliateId }) {
    const key = useContext();
    if (!affiliateId || !key) return null;
    return h(BehaviorInner, { key: key + ':' + affiliateId, affiliateId, identity: key });
  }
  window.SicofPaymentBehavior = Behavior;
  window.SicofLoanDetail = LoanDetail;
  window.SicofLoanContent = LoanContent;
  window.SicofChart = Chart;
  window.SicofModal = Modal;
  window.SicofView = Object.freeze({ money, Table, contextKey, useContext });
})();
