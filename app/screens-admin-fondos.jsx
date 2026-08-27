/* Controlled Admin workspace for Supabase-authoritative financial configuration. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const S = () => window.fundsStore;
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };

  function useStore() { const [, force] = useState(0); useEffect(() => S().subscribe(() => force((n) => n + 1)), []); return S(); }
  function dateLabel(value) {
    if (!value) return 'Permanente';
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
  }
  const visibleLabel = (value) => value === 'VISIBLE' ? 'Visible' : 'Oculto';
  const modeLabel = (value) => ({ AUTO: 'Automático', MOSTRAR: 'Mostrar excepcionalmente', OCULTAR: 'Ocultar' }[value] || value);
  const PROGRAM_LABELS = Object.freeze({ prestamo: 'Suti Préstamo', caja: 'Caja de ahorro', nomina: 'Financiamiento vía nómina' });
  const STATUS = Object.freeze({ AVAILABLE: { label: 'Disponible', tone: 'green' }, SCHEDULED: { label: 'Programado', tone: 'blue' }, UNAVAILABLE: { label: 'No disponible', tone: 'gray' } });
  const normalize = (value) => String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-MX');
  const programLabel = (value) => PROGRAM_LABELS[value] || 'Programa no clasificado';
  const moneyLabel = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value)) : '—';
  const rateLabel = (row) => Number.isFinite(Number(row.tasaQuincenal)) ? Number(row.tasaQuincenal).toLocaleString('es-MX', { maximumFractionDigits: 4 }) + '% · ' + (row.periodoPago === 'quincenal' ? 'quincenal' : (row.periodoPago || 'periodo')) : '—';
  const termLabel = (row) => row.plazoLabel || (row.plazoQuincenas ? row.plazoQuincenas + ' pagos' : '—');
  const statusMeta = (value) => STATUS[value] || { label: 'Estado no reconocido', tone: 'gray' };
  const signalMeta = Object.freeze({ duplicate: ['Posible duplicado', '#FFF4D6', '#7A5200'], conflict: ['Posible conflicto', '#FCE9EE', '#9A1737'], condition: ['Condición distinta', '#E8F0FF', '#2456C7'] });

  function useDesktop() {
    const matches = () => !!(window.matchMedia && window.matchMedia('(min-width: 1024px)').matches);
    const [desktop, setDesktop] = useState(matches());
    useEffect(() => { const media = window.matchMedia('(min-width: 1024px)'); const change = () => setDesktop(media.matches); change(); media.addEventListener ? media.addEventListener('change', change) : media.addListener(change); return () => media.removeEventListener ? media.removeEventListener('change', change) : media.removeListener(change); }, []);
    return desktop;
  }

  function ensureMatrixStyles() {
    if (document.getElementById('admin-program-criteria-matrix-css')) return;
    const style = document.createElement('style'); style.id = 'admin-program-criteria-matrix-css';
    style.textContent = `
      .pcmx-root{display:flex;flex-direction:column;gap:12px;min-width:0;outline:none}
      .pcmx-authority{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;border:1px solid #D6E2FB;border-radius:13px;background:#EEF3FF;color:var(--ink-2);font-size:11.5px;font-weight:650;line-height:1.45}.pcmx-authority strong{color:#2456C7}
      .pcmx-toolbar{background:var(--surface);border-radius:16px;padding:12px;box-shadow:var(--neo-sm);min-width:0}.pcmx-filters{display:grid;grid-template-columns:minmax(180px,1.6fr) repeat(3,minmax(118px,1fr));gap:8px}.pcmx-field{display:flex;flex-direction:column;gap:5px;min-width:0}.pcmx-field label{font-size:10px;color:var(--ink-3);font-weight:850}.pcmx-field input,.pcmx-field select{width:100%;box-sizing:border-box;border:1px solid #DCE1EA;background:var(--surface-2);border-radius:10px;padding:8px 9px;color:var(--ink);font-family:inherit;font-size:11.5px;font-weight:650;outline:none}.pcmx-field input:focus,.pcmx-field select:focus{border-color:var(--guinda);box-shadow:0 0 0 2px rgba(138,18,55,.08)}
      .pcmx-toolbar-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;color:var(--ink-3);font-size:11.5px;font-weight:700}.pcmx-toolbar-actions{display:flex;align-items:center;gap:12px}.pcmx-link{border:0;background:transparent;color:var(--guinda);font:800 11.5px inherit;cursor:pointer}.pcmx-check{display:inline-flex;align-items:center;gap:6px;color:var(--ink-2);font-size:11px;font-weight:800;cursor:pointer}.pcmx-check input{accent-color:var(--guinda)}
      .pcmx-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(278px,30%);gap:12px;min-width:0;min-height:560px;max-height:calc(100vh - 292px)}.pcmx-panel{background:var(--surface);border-radius:17px;box-shadow:var(--neo-sm);min-width:0;min-height:0;overflow:hidden}.pcmx-matrix{display:flex;flex-direction:column}.pcmx-table-scroll{overflow:auto;min-width:0;min-height:0;overscroll-behavior:contain}.pcmx-table{width:100%;min-width:1190px;border-collapse:separate;border-spacing:0;font-size:11.5px}.pcmx-table th{position:sticky;top:0;z-index:4;background:#F4F6FA;color:var(--ink-3);padding:9px 8px;border-bottom:1px solid #DDE2EA;text-align:left;font-size:9.5px;font-weight:900;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap}.pcmx-table td{padding:10px 8px;border-bottom:1px solid var(--hairline);vertical-align:middle;color:var(--ink-2);font-weight:650}.pcmx-table tbody tr{cursor:pointer}.pcmx-table tbody tr:hover td{background:#FBF8F9}.pcmx-table tbody tr[aria-selected=true] td{background:#F8EDF1}.pcmx-table tbody tr[aria-selected=true] td:first-of-type{box-shadow:inset 3px 0 0 var(--guinda)}.pcmx-table .pcmx-sticky{position:sticky;left:0;z-index:2;background:var(--surface);min-width:170px;max-width:210px}.pcmx-table th.pcmx-sticky{z-index:6;background:#F4F6FA}.pcmx-table tr[aria-selected=true] .pcmx-sticky{background:#F8EDF1}.pcmx-table strong{display:block;color:var(--ink);font-size:11.8px}.pcmx-table small{display:block;margin-top:3px;color:var(--ink-3);font-size:9.8px;font-weight:650}.pcmx-compare-cell{width:34px;text-align:center}.pcmx-compare-cell input{accent-color:var(--guinda)}.pcmx-group-row td{position:sticky;left:0;padding:7px 10px!important;background:#EEF1F6!important;color:var(--ink)!important;font-size:10.5px!important;font-weight:900!important;letter-spacing:.02em;cursor:default}.pcmx-group-count{color:var(--ink-3);font-weight:700;margin-left:6px}.pcmx-badge{display:inline-flex;align-items:center;min-height:23px;padding:0 7px;border-radius:999px;font-size:9.8px;font-weight:850;line-height:1.15;white-space:nowrap}.pcmx-signals{display:flex;flex-wrap:wrap;gap:4px;max-width:154px}.pcmx-signal{display:inline-flex;padding:3px 6px;border-radius:999px;font-size:8.8px;font-weight:850;white-space:nowrap}
      .pcmx-detail{display:flex;flex-direction:column}.pcmx-detail-head{padding:13px 14px;border-bottom:1px solid var(--hairline);background:#F8F9FC}.pcmx-detail-head h2{margin:0;font-size:15px;line-height:1.3}.pcmx-detail-head p{margin:4px 0 0;color:var(--ink-3);font-size:10.5px;font-weight:700}.pcmx-detail-scroll{overflow:auto;min-height:0;padding:12px}.pcmx-detail-card{border:1px solid #E1E5ED;border-radius:13px;padding:11px;margin-bottom:9px;background:#fff}.pcmx-detail-card h3{margin:0 0 8px;font-size:11.5px;color:var(--ink)}.pcmx-kv{display:grid;grid-template-columns:1fr 1fr;gap:9px 11px}.pcmx-kv span{display:block;color:var(--ink-3);font-size:9.5px;font-weight:750}.pcmx-kv strong{display:block;margin-top:2px;color:var(--ink);font-size:11.5px;overflow-wrap:anywhere}.pcmx-explainer{padding:9px 10px;border-radius:10px;background:#F4F6FA;color:var(--ink-2);font-size:10.5px;font-weight:650;line-height:1.45}.pcmx-tech{margin-top:8px;border-top:1px solid var(--hairline);padding-top:8px}.pcmx-tech summary{cursor:pointer;color:var(--ink-3);font-size:10px;font-weight:800}.pcmx-tech code{display:block;margin-top:7px;color:var(--ink-3);font-size:9px;overflow-wrap:anywhere;white-space:normal}.pcmx-compare{border:1px solid #D8DDEA;border-radius:13px;padding:10px;margin-bottom:9px;background:#F8F9FC}.pcmx-compare-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.pcmx-compare-head strong{font-size:11.5px}.pcmx-compare-grid{display:grid;grid-template-columns:88px repeat(var(--compare-count),minmax(92px,1fr));overflow:auto;font-size:9.5px}.pcmx-compare-grid>*{padding:6px;border-bottom:1px solid #E1E5ED;min-width:0;overflow-wrap:anywhere}.pcmx-compare-grid b{color:var(--ink-3)}
      .pcmx-empty{display:grid;place-items:center;align-content:center;gap:8px;min-height:280px;padding:22px;text-align:center;color:var(--ink-3);font-size:12px;font-weight:700}.pcmx-empty button{border:0;border-radius:10px;background:var(--guinda);color:#fff;padding:9px 13px;font:800 11.5px inherit;cursor:pointer}.pcmx-skeleton{height:42px;margin:8px 10px;border-radius:9px;background:linear-gradient(90deg,#EEF0F4 25%,#F8F9FB 50%,#EEF0F4 75%);background-size:200% 100%;animation:pcmx-pulse 1.2s infinite}@keyframes pcmx-pulse{to{background-position:-200% 0}}
      .pcmx-nav{display:flex;align-items:center;gap:5px;padding:5px;background:var(--surface);border-radius:14px;box-shadow:var(--neo-sm);width:max-content;max-width:100%;overflow:auto}.pcmx-nav button{height:34px;border:0;border-radius:10px;background:transparent;color:var(--ink-3);padding:0 13px;font:800 11.5px inherit;cursor:pointer;white-space:nowrap}.pcmx-nav button[aria-selected=true]{background:var(--guinda-50);color:var(--guinda)}
      .pcmx-catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pcmx-catalog-card{background:var(--surface);border-radius:16px;box-shadow:var(--neo-sm);padding:14px;min-width:0}.pcmx-catalog-card h3{margin:0;color:var(--ink);font-size:14px}.pcmx-catalog-card p{margin:5px 0 0;color:var(--ink-3);font-size:11px;font-weight:650;line-height:1.4}.pcmx-catalog-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.pcmx-catalog-meta span{padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--ink-2);font-size:9.8px;font-weight:800}.pcmx-card-actions{display:flex;justify-content:flex-end;margin-top:11px;padding-top:10px;border-top:1px solid var(--hairline)}
      .pcmx-primary{border:0;border-radius:10px;background:var(--guinda);color:#fff;padding:9px 13px;font:800 11.5px inherit;cursor:pointer}.pcmx-secondary{border:1px solid #DCE1EA;border-radius:10px;background:var(--surface);color:var(--ink-2);padding:8px 12px;font:800 11px inherit;cursor:pointer}
      .pcmx-editor-overlay{position:absolute;inset:0;z-index:86;background:rgba(30,22,25,.2);display:flex;justify-content:flex-end}.pcmx-editor{width:min(460px,100%);height:100%;background:var(--bg);box-shadow:-12px 0 30px rgba(20,15,17,.14);display:flex;flex-direction:column}.pcmx-editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:var(--surface);border-bottom:1px solid var(--hairline)}.pcmx-editor-head h2{margin:0;font-size:16px}.pcmx-editor-body{padding:16px;overflow:auto;display:flex;flex-direction:column;gap:11px}.pcmx-editor-field{display:flex;flex-direction:column;gap:6px}.pcmx-editor-field label{font-size:10.5px;font-weight:850;color:var(--ink-3)}.pcmx-editor-field input,.pcmx-editor-field select,.pcmx-editor-field textarea{box-sizing:border-box;width:100%;border:1px solid #DCE1EA;border-radius:11px;background:var(--surface);padding:10px 11px;color:var(--ink);font:650 12px inherit;outline:none}.pcmx-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pcmx-editor-foot{display:flex;gap:9px;padding:12px 16px;background:var(--surface);border-top:1px solid var(--hairline)}.pcmx-editor-error{padding:9px 10px;border-radius:10px;background:#FCE9EE;color:#9A1737;font-size:11px;font-weight:750}
      @media(max-width:1279px){.pcmx-filters{grid-template-columns:repeat(4,minmax(0,1fr))}.pcmx-workspace{grid-template-columns:minmax(0,1fr) minmax(270px,35%)}.pcmx-kv{grid-template-columns:1fr}.pcmx-table{min-width:1110px}}
      @media(min-width:1280px){.pcmx-filters{grid-template-columns:minmax(190px,1.5fr) repeat(6,minmax(105px,1fr))}.pcmx-workspace{grid-template-columns:minmax(0,1fr) 340px}}
      @media(min-width:1440px){.pcmx-workspace{grid-template-columns:minmax(0,1fr) 380px}.pcmx-detail-scroll{padding:14px}}
      @media(max-width:1100px){.pcmx-catalog{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  const selWrap = (children) => React.createElement('div', { style: { position: 'relative' } }, children,
    React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }));

  function enrichSignals(rows) {
    const grouped = (keyOf) => rows.reduce((map, row) => { const key = keyOf(row); const list = map.get(key) || []; list.push(row); map.set(key, list); return map; }, new Map());
    const exactKey = (row) => [row.programId, row.fondo, row.sindicato, row.categoria, row.montoMax, row.tasaQuincenal, row.plazoQuincenas, row.plazoLabel, row.fecha || '', row.visibilityMode].map(normalize).join('|');
    const contextKey = (row) => [row.programId, row.fondo, row.sindicato, row.categoria, row.fecha || ''].map(normalize).join('|');
    const valueKey = (row) => [row.montoMax, row.tasaQuincenal, row.plazoQuincenas, row.plazoLabel, row.visibilityMode].map(normalize).join('|');
    const fundKey = (row) => [row.programId, row.fondo].map(normalize).join('|');
    const conditionKey = (row) => [row.sindicato, row.categoria, row.fecha || '', row.plazoLabel].map(normalize).join('|');
    const exact = grouped(exactKey), contexts = grouped(contextKey), funds = grouped(fundKey);
    return rows.map((row) => {
      const signals = [];
      if ((exact.get(exactKey(row)) || []).length > 1) signals.push('duplicate');
      if (new Set((contexts.get(contextKey(row)) || []).map(valueKey)).size > 1) signals.push('conflict');
      if (new Set((funds.get(fundKey(row)) || []).map(conditionKey)).size > 1) signals.push('condition');
      return Object.freeze(Object.assign({}, row, { signals: Object.freeze(signals) }));
    });
  }

  function MatrixBadge({ meta, attr, value }) {
    const tones = { green: ['#E5F7EF', '#087A50'], blue: ['#E8F0FF', '#2456C7'], gray: ['#EEF0F4', '#596273'] }; const tone = tones[meta.tone] || tones.gray;
    return React.createElement('span', { className: 'pcmx-badge', style: { background: tone[0], color: tone[1] }, [attr]: value }, meta.label);
  }

  function CriteriaDetail({ row, compared, onClearCompare, canEdit, onEdit }) {
    if (!row) return React.createElement('aside', { className: 'pcmx-panel pcmx-detail', 'data-criteria-detail': 'empty' }, React.createElement('div', { className: 'pcmx-empty' }, 'Selecciona una regla para consultar su detalle.'));
    const kv = (items) => React.createElement('div', { className: 'pcmx-kv' }, items.map(([label, value]) => React.createElement('div', { key: label }, React.createElement('span', null, label), React.createElement('strong', null, value))));
    const comparisonFields = [['Fondo', (item) => item.fondo], ['Sindicato', (item) => item.sindicato], ['Categoría', (item) => item.categoria], ['Monto máximo', (item) => moneyLabel(item.montoMax)], ['Tasa', rateLabel], ['Plazo', termLabel], ['Vigencia', (item) => item.permanent ? 'Permanente' : dateLabel(item.fecha)], ['Estado', (item) => statusMeta(item.status).label]];
    return React.createElement('aside', { className: 'pcmx-panel pcmx-detail', 'data-criteria-detail': row.id },
      React.createElement('div', { className: 'pcmx-detail-head' }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' } }, React.createElement('div', null, React.createElement('h2', null, row.fondo), React.createElement('p', null, programLabel(row.programId), ' · regla seleccionada')), canEdit && row.adminRuleId && React.createElement('button', { type: 'button', className: 'pcmx-secondary', onClick: () => onEdit(row), 'data-financial-rule-edit': row.adminRuleId }, 'Editar regla'))),
      React.createElement('div', { className: 'pcmx-detail-scroll' },
        compared.length >= 2 && React.createElement('section', { className: 'pcmx-compare', 'data-criteria-comparison': compared.length },
          React.createElement('div', { className: 'pcmx-compare-head' }, React.createElement('strong', null, 'Comparación · ', compared.length, ' reglas'), React.createElement('button', { className: 'pcmx-link', type: 'button', onClick: onClearCompare }, 'Limpiar')),
          React.createElement('div', { className: 'pcmx-compare-grid', style: { '--compare-count': compared.length } },
            React.createElement('b', null, 'Campo'), compared.map((item) => React.createElement('b', { key: item.id }, item.fondo)),
            comparisonFields.flatMap(([label, read]) => [React.createElement('b', { key: label }, label)].concat(compared.map((item) => React.createElement('span', { key: label + item.id }, read(item))))))),
        React.createElement('section', { className: 'pcmx-detail-card' }, React.createElement('h3', null, 'Programa y regla'), kv([
          ['Programa', programLabel(row.programId)], ['Fondo', row.fondo], ['Sindicato', row.sindicato], ['Categoría', row.categoria],
        ])),
        React.createElement('section', { className: 'pcmx-detail-card' }, React.createElement('h3', null, 'Condiciones financieras'), kv([
          ['Monto máximo', moneyLabel(row.montoMax)], ['Tasa', rateLabel(row)], ['Plazo', termLabel(row)], ['Periodicidad', row.periodoPago === 'quincenal' ? 'Quincenal' : (row.periodoPago || '—')],
        ])),
        React.createElement('section', { className: 'pcmx-detail-card' }, React.createElement('h3', null, 'Vigencia, visibilidad y estado'), kv([
          ['Vigencia', row.permanent ? 'Permanente' : dateLabel(row.fecha)], ['Modo de visibilidad', modeLabel(row.visibilityMode)], ['Política automática', visibleLabel(row.automaticVisibility)], ['Visibilidad efectiva', visibleLabel(row.effectiveVisibility)], ['Estado', statusMeta(row.status).label], ['Ventana automática', row.permanent ? 'Todo el año' : dateLabel(row.visibilityWindowStart) + ' – ' + dateLabel(row.visibilityWindowEnd)],
        ])),
        React.createElement('div', { className: 'pcmx-explainer' }, React.createElement('strong', null, 'Elegibilidad y visibilidad son distintas. '), 'Sindicato y categoría definen a quién aplica la regla; el modo, la fecha y la política automática determinan si aparece en SutiApp. Esta vista no evalúa a una persona.'),
        row.signals.length > 0 && React.createElement('section', { className: 'pcmx-detail-card', style: { marginTop: 9 } }, React.createElement('h3', null, 'Señales de revisión'), React.createElement('div', { className: 'pcmx-signals' }, row.signals.map((signal) => React.createElement('span', { key: signal, className: 'pcmx-signal', style: { background: signalMeta[signal][1], color: signalMeta[signal][2] } }, signalMeta[signal][0]))), React.createElement('div', { className: 'pcmx-explainer', style: { marginTop: 8 } }, 'Son coincidencias potenciales para inspección; no declaran un error ni modifican la fuente.')),
        React.createElement('details', { className: 'pcmx-tech' }, React.createElement('summary', null, 'Información técnica'), React.createElement('code', null, 'Fila de origen: ', row.sheetRow), React.createElement('code', null, 'Identidad: ', row.id))));
  }

  function DesktopCriteriaMatrix({ store, canEdit, onEdit, onCreate }) {
    const [search, setSearch] = useState(''), [program, setProgram] = useState('all'), [fund, setFund] = useState('all'), [union, setUnion] = useState('all'), [category, setCategory] = useState('all'), [validity, setValidity] = useState('all'), [visibility, setVisibilityFilter] = useState('all'), [status, setStatus] = useState('all'), [sort, setSort] = useState('program');
    const [grouped, setGrouped] = useState(true), [selectedId, setSelectedId] = useState(''), [compareIds, setCompareIds] = useState([]);
    useEffect(ensureMatrixStyles, []);
    const sourceRows = store.all();
    const source = React.useMemo(() => enrichSignals(sourceRows), [store.status(), sourceRows.length]);
    const visible = React.useMemo(() => {
      const needle = normalize(search), statusOrder = { AVAILABLE: 0, SCHEDULED: 1, UNAVAILABLE: 2 };
      const list = source.filter((row) => {
        if (needle && !normalize([programLabel(row.programId), row.fondo, row.sindicato, row.categoria, statusMeta(row.status).label, modeLabel(row.visibilityMode)].join(' ')).includes(needle)) return false;
        return (program === 'all' || row.programId === program) && (fund === 'all' || row.fondo === fund) && (union === 'all' || row.sindicato === union) && (category === 'all' || row.categoria === category) && (validity === 'all' || (validity === 'permanent') === row.permanent) && (visibility === 'all' || row.visibilityMode === visibility) && (status === 'all' || row.status === status);
      });
      const compare = (a, b) => sort === 'amount' ? b.montoMax - a.montoMax : sort === 'rate' ? b.tasaQuincenal - a.tasaQuincenal : sort === 'date' ? String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')) : sort === 'union' ? a.sindicato.localeCompare(b.sindicato, 'es') : sort === 'category' ? a.categoria.localeCompare(b.categoria, 'es') : sort === 'status' ? statusOrder[a.status] - statusOrder[b.status] : (programLabel(a.programId) + a.fondo + a.sindicato + a.categoria).localeCompare(programLabel(b.programId) + b.fondo + b.sindicato + b.categoria, 'es');
      return list.slice().sort(compare);
    }, [source, search, program, fund, union, category, validity, visibility, status, sort]);
    useEffect(() => { if (!visible.length) setSelectedId(''); else if (!visible.some((row) => row.id === selectedId)) setSelectedId(visible[0].id); }, [visible, selectedId]);
    const selected = source.find((row) => row.id === selectedId) || null, compared = compareIds.map((id) => source.find((row) => row.id === id)).filter(Boolean);
    const optionNodes = (values) => values.map((value) => React.createElement('option', { key: value, value }, value));
    const field = (label, value, onChange, choices, aria) => React.createElement('div', { className: 'pcmx-field' }, React.createElement('label', null, label), React.createElement('select', { value, onChange: (event) => onChange(event.target.value), 'aria-label': aria }, choices));
    const reset = () => { setSearch(''); setProgram('all'); setFund('all'); setUnion('all'); setCategory('all'); setValidity('all'); setVisibilityFilter('all'); setStatus('all'); setSort('program'); };
    const toggleCompare = (id) => setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 4 ? current.concat(id) : current);
    const move = (delta) => { const index = visible.findIndex((row) => row.id === selectedId), next = Math.max(0, Math.min(visible.length - 1, (index < 0 ? 0 : index) + delta)); if (visible[next]) setSelectedId(visible[next].id); };
    const onKeyDown = (event) => { if (/INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return; if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); } };
    const signalCells = (row) => React.createElement('div', { className: 'pcmx-signals' }, row.signals.map((signal) => React.createElement('span', { key: signal, className: 'pcmx-signal', style: { background: signalMeta[signal][1], color: signalMeta[signal][2] } }, signalMeta[signal][0])));
    const rowNode = (row) => React.createElement('tr', { key: row.id, 'data-criteria-row': row.id, 'aria-selected': row.id === selectedId, onClick: () => setSelectedId(row.id) },
      React.createElement('td', { className: 'pcmx-compare-cell', onClick: (event) => event.stopPropagation() }, React.createElement('input', { type: 'checkbox', checked: compareIds.includes(row.id), disabled: !compareIds.includes(row.id) && compareIds.length >= 4, onChange: () => toggleCompare(row.id), 'aria-label': 'Comparar ' + row.fondo + ' para ' + row.sindicato + ' y ' + row.categoria })),
      React.createElement('td', { className: 'pcmx-sticky' }, React.createElement('strong', null, row.fondo), React.createElement('small', null, programLabel(row.programId))),
      React.createElement('td', null, programLabel(row.programId)), React.createElement('td', null, row.sindicato), React.createElement('td', null, row.categoria), React.createElement('td', null, React.createElement('strong', null, moneyLabel(row.montoMax))), React.createElement('td', null, rateLabel(row)), React.createElement('td', null, termLabel(row)), React.createElement('td', null, row.permanent ? 'Permanente' : dateLabel(row.fecha)), React.createElement('td', null, modeLabel(row.visibilityMode), React.createElement('small', null, visibleLabel(row.effectiveVisibility))), React.createElement('td', null, React.createElement(MatrixBadge, { meta: statusMeta(row.status), attr: 'data-criteria-human-status', value: statusMeta(row.status).label })), React.createElement('td', null, signalCells(row)));
    const bodyRows = grouped ? Array.from(visible.reduce((map, row) => { const key = row.programId; const list = map.get(key) || []; list.push(row); map.set(key, list); return map; }, new Map())).flatMap(([key, rows]) => [React.createElement('tr', { key: 'group-' + key, className: 'pcmx-group-row', 'data-criteria-group': key }, React.createElement('td', { colSpan: 12 }, programLabel(key), React.createElement('span', { className: 'pcmx-group-count' }, rows.length + ' reglas')))].concat(rows.map(rowNode))) : visible.map(rowNode);
    return React.createElement('div', { className: 'pcmx-root', tabIndex: 0, onKeyDown, 'data-admin-program-criteria-matrix': 'true', 'data-read-only': canEdit ? 'false' : 'true' },
      React.createElement('div', { className: 'pcmx-authority' }, React.createElement(I, { name: 'shield', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0 } }), React.createElement('div', { style: { flex: 1 } }, React.createElement('strong', null, 'Autoridad Supabase. '), 'La matriz conserva lectura, comparación y filtros; los cambios sensibles se realizan con confirmación, versión y auditoría.'), canEdit && React.createElement('button', { type: 'button', className: 'pcmx-primary', onClick: onCreate, 'data-financial-rule-create': 'true' }, 'Nueva regla')),
      React.createElement('div', { className: 'pcmx-toolbar', 'data-criteria-toolbar': 'true' },
        React.createElement('div', { className: 'pcmx-filters' },
          React.createElement('div', { className: 'pcmx-field' }, React.createElement('label', { htmlFor: 'pcmx-search' }, 'Buscar'), React.createElement('input', { id: 'pcmx-search', value: search, onChange: (event) => setSearch(event.target.value), placeholder: 'Programa, fondo, sindicato o categoría', 'aria-label': 'Buscar criterios de programas' })),
          field('Programa', program, setProgram, [React.createElement('option', { key: 'all', value: 'all' }, 'Todos')].concat(store.programas().map((value) => React.createElement('option', { key: value, value }, programLabel(value)))), 'Filtrar por programa'),
          field('Fondo', fund, setFund, [React.createElement('option', { key: 'all', value: 'all' }, 'Todos')].concat(optionNodes(store.fondos())), 'Filtrar por fondo'),
          field('Sindicato', union, setUnion, [React.createElement('option', { key: 'all', value: 'all' }, 'Todos')].concat(optionNodes(store.sindicatos())), 'Filtrar por sindicato'),
          field('Categoría', category, setCategory, [React.createElement('option', { key: 'all', value: 'all' }, 'Todas')].concat(optionNodes(store.categorias())), 'Filtrar por categoría'),
          field('Vigencia', validity, setValidity, [React.createElement('option', { key: 'all', value: 'all' }, 'Todas'), React.createElement('option', { key: 'permanent', value: 'permanent' }, 'Permanente'), React.createElement('option', { key: 'dated', value: 'dated' }, 'Con fecha')], 'Filtrar por vigencia'),
          field('Visibilidad', visibility, setVisibilityFilter, [React.createElement('option', { key: 'all', value: 'all' }, 'Todas'), React.createElement('option', { key: 'AUTO', value: 'AUTO' }, modeLabel('AUTO')), React.createElement('option', { key: 'MOSTRAR', value: 'MOSTRAR' }, modeLabel('MOSTRAR')), React.createElement('option', { key: 'OCULTAR', value: 'OCULTAR' }, modeLabel('OCULTAR'))], 'Filtrar por visibilidad'),
          field('Estado', status, setStatus, [React.createElement('option', { key: 'all', value: 'all' }, 'Todos')].concat(Object.keys(STATUS).map((value) => React.createElement('option', { key: value, value }, STATUS[value].label))), 'Filtrar por estado'),
          field('Orden', sort, setSort, [['program', 'Programa'], ['union', 'Sindicato'], ['category', 'Categoría'], ['amount', 'Mayor monto'], ['rate', 'Mayor tasa'], ['date', 'Fecha'], ['status', 'Estado']].map(([value, label]) => React.createElement('option', { key: value, value }, label)), 'Ordenar criterios')),
        React.createElement('div', { className: 'pcmx-toolbar-foot' }, React.createElement('span', { 'data-criteria-result-count': visible.length }, React.createElement('strong', null, visible.length), ' de ', source.length, ' reglas'), React.createElement('div', { className: 'pcmx-toolbar-actions' }, React.createElement('label', { className: 'pcmx-check' }, React.createElement('input', { type: 'checkbox', checked: grouped, onChange: (event) => setGrouped(event.target.checked) }), 'Agrupar por programa'), React.createElement('span', null, compareIds.length, '/4 para comparar'), React.createElement('button', { className: 'pcmx-link', type: 'button', onClick: reset }, 'Limpiar filtros')))),
      React.createElement('div', { className: 'pcmx-workspace' },
        React.createElement('section', { className: 'pcmx-panel pcmx-matrix', 'data-criteria-matrix-table': 'true' }, React.createElement('div', { className: 'pcmx-table-scroll' }, !visible.length ? React.createElement('div', { className: 'pcmx-empty' }, 'No hay reglas que coincidan con los filtros.') : React.createElement('table', { className: 'pcmx-table' }, React.createElement('thead', null, React.createElement('tr', null, ['Comparar', 'Fondo', 'Programa', 'Sindicato', 'Categoría', 'Monto máximo', 'Tasa', 'Plazo', 'Vigencia', 'Visibilidad', 'Estado', 'Señales'].map((label, index) => React.createElement('th', { key: label, className: index === 0 ? 'pcmx-compare-cell' : index === 1 ? 'pcmx-sticky' : '' }, label)))), React.createElement('tbody', null, bodyRows)))),
        React.createElement(CriteriaDetail, { row: selected, compared, onClearCompare: () => setCompareIds([]), canEdit, onEdit })));
  }

  function EditorShell({ title, saving, error, onClose, onSave, saveLabel, children }) {
    return React.createElement('div', { className: 'pcmx-editor-overlay', 'data-financial-editor': title }, React.createElement('section', { className: 'pcmx-editor', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      React.createElement('div', { className: 'pcmx-editor-head' }, React.createElement('h2', null, title), React.createElement('button', { type: 'button', className: 'pcmx-secondary', disabled: saving, onClick: onClose }, 'Cerrar')),
      React.createElement('div', { className: 'pcmx-editor-body' }, children, error && React.createElement('div', { className: 'pcmx-editor-error', role: 'alert' }, error)),
      React.createElement('div', { className: 'pcmx-editor-foot' }, React.createElement('button', { type: 'button', className: 'pcmx-secondary', disabled: saving, onClick: onClose, style: { flex: 1 } }, 'Cancelar'), React.createElement('button', { type: 'button', className: 'pcmx-primary', disabled: saving, onClick: onSave, style: { flex: 2 } }, saving ? 'Guardando…' : saveLabel))));
  }

  function editorField(label, control) { return React.createElement('div', { className: 'pcmx-editor-field' }, React.createElement('label', null, label), control); }
  const editorInput = (value, onChange, extra) => React.createElement('input', { value: value == null ? '' : value, onChange: (event) => onChange(event.target.value), ...(extra || {}) });
  const editorSelect = (value, onChange, options) => React.createElement('select', { value, onChange: (event) => onChange(event.target.value) }, options.map(([id, label]) => React.createElement('option', { key: id, value: id }, label)));

  function ProgramEditor({ value, store, app, onClose }) {
    const [form, setForm] = useState({ id: value?.id || '', name: value?.name || '', description: value?.description || '', enabled: value ? value.enabled !== false : true, publication: value?.publication_status || 'DRAFT', sort: Number(value?.sort_order || 0), reason: '' });
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const set = (key, next) => setForm((current) => ({ ...current, [key]: next }));
    const save = async () => { if (form.reason.trim().length < 8 || !form.id.trim() || !form.name.trim()) { setError('Completa código, nombre y un motivo de al menos 8 caracteres.'); return; }
      if (!window.confirm('¿Confirmas guardar este programa financiero?')) return; setSaving(true); setError('');
      try { await store.saveProgram({ p_id: form.id.trim(), p_name: form.name.trim(), p_description: form.description.trim(), p_enabled: form.enabled, p_publication_status: form.publication, p_sort_order: Number(form.sort), p_reason: form.reason.trim(), p_confirmation: 'CONFIRMAR' }); app?.toast?.('Programa financiero guardado'); onClose(); }
      catch (failure) { setError(failure?.message || 'No fue posible guardar el programa.'); setSaving(false); } };
    return React.createElement(EditorShell, { title: value ? 'Editar programa' : 'Nuevo programa', saving, error, onClose, onSave: save, saveLabel: 'Guardar programa' },
      editorField('Código estable', editorInput(form.id, (next) => set('id', next), { disabled: !!value, placeholder: 'programa_estable' })),
      editorField('Nombre', editorInput(form.name, (next) => set('name', next))), editorField('Descripción', React.createElement('textarea', { rows: 3, value: form.description, onChange: (event) => set('description', event.target.value) })),
      React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Publicación', editorSelect(form.publication, (next) => set('publication', next), [['DRAFT', 'Borrador'], ['PUBLISHED', 'Publicado'], ['UNPUBLISHED', 'No publicado']])), editorField('Orden', editorInput(form.sort, (next) => set('sort', next), { type: 'number', min: 0, max: 10000 }))),
      editorField('Estado', React.createElement('label', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('input', { type: 'checkbox', checked: form.enabled, onChange: (event) => set('enabled', event.target.checked) }), 'Activo')),
      editorField('Motivo obligatorio', React.createElement('textarea', { rows: 3, value: form.reason, onChange: (event) => set('reason', event.target.value), placeholder: 'Razón administrativa del cambio' })));
  }

  function FundEditor({ value, store, app, onClose }) {
    const programs = store.adminCatalog().programs || [];
    const [form, setForm] = useState({ program: value?.program_id || programs[0]?.id || '', code: value?.code || '', name: value?.name || '', enabled: value ? value.enabled !== false : true, publication: value?.publication_status || 'DRAFT', sort: Number(value?.sort_order || 0), reason: '' });
    const [saving, setSaving] = useState(false), [error, setError] = useState(''); const set = (key, next) => setForm((current) => ({ ...current, [key]: next }));
    const save = async () => { if (form.reason.trim().length < 8 || !form.code.trim() || !form.name.trim()) { setError('Completa código, nombre y un motivo de al menos 8 caracteres.'); return; }
      if (!window.confirm('¿Confirmas guardar este fondo y su asociación al programa?')) return; setSaving(true); setError('');
      try { await store.saveFund({ p_id: value?.id || null, p_program_id: form.program, p_code: form.code.trim(), p_name: form.name.trim(), p_enabled: form.enabled, p_publication_status: form.publication, p_sort_order: Number(form.sort), p_reason: form.reason.trim(), p_confirmation: 'CONFIRMAR' }); app?.toast?.('Fondo financiero guardado'); onClose(); }
      catch (failure) { setError(failure?.message || 'No fue posible guardar el fondo.'); setSaving(false); } };
    return React.createElement(EditorShell, { title: value ? 'Editar fondo' : 'Nuevo fondo', saving, error, onClose, onSave: save, saveLabel: 'Guardar fondo' },
      editorField('Programa', editorSelect(form.program, (next) => set('program', next), programs.map((item) => [item.id, item.name]))),
      React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Código estable', editorInput(form.code, (next) => set('code', next), { disabled: !!value })), editorField('Orden', editorInput(form.sort, (next) => set('sort', next), { type: 'number', min: 0, max: 10000 }))),
      editorField('Nombre', editorInput(form.name, (next) => set('name', next))), editorField('Publicación', editorSelect(form.publication, (next) => set('publication', next), [['DRAFT', 'Borrador'], ['PUBLISHED', 'Publicado'], ['UNPUBLISHED', 'No publicado']])),
      editorField('Estado', React.createElement('label', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('input', { type: 'checkbox', checked: form.enabled, onChange: (event) => set('enabled', event.target.checked) }), 'Activo')),
      editorField('Motivo obligatorio', React.createElement('textarea', { rows: 3, value: form.reason, onChange: (event) => set('reason', event.target.value) })));
  }

  function RuleEditor({ value, store, app, canPublish, onClose }) {
    const config = store.adminCatalog(), raw = value?.adminRuleId ? config.rules.find((item) => item.id === value.adminRuleId) : null;
    const funds = config.funds.filter((item) => item.enabled !== false), unions = [], categories = [];
    for (const row of config.rules) { if (row.financial_union_code && !unions.some((item) => item[0] === row.financial_union_code)) unions.push([row.financial_union_code, row.financial_union_label]); if (row.financial_employee_category_code && !categories.some((item) => item[0] === row.financial_employee_category_code)) categories.push([row.financial_employee_category_code, row.financial_employee_category_label]); }
    const selectedFund = raw?.fund_id || funds.find((item) => item.name === value?.fondo && item.program_id === value?.programId)?.id || funds[0]?.id || '';
    const [form, setForm] = useState({ fund: selectedFund, union: raw?.financial_union_code || value?.unionCode || unions[0]?.[0] || '', category: raw?.financial_employee_category_code || value?.categoryCode || categories[0]?.[0] || '', max: Number(raw?.max_amount || value?.montoMax || 0), rate: Number(raw?.raw_rate ?? value?.tasaQuincenal ?? 0), termLabel: raw?.term_label || value?.plazoLabel || '', payments: Number(raw?.payment_count || value?.plazoQuincenas || 1), maxTerm: Number(raw?.max_term || value?.plazoQuincenas || 1), date: raw?.available_on || value?.fecha || '', visibility: raw?.visibility_mode || value?.visibilityMode || 'AUTO', reason: '', publish: false });
    const [saving, setSaving] = useState(false), [error, setError] = useState(''); const set = (key, next) => setForm((current) => ({ ...current, [key]: next }));
    const save = async () => { if (form.reason.trim().length < 8 || !form.fund || !form.union || !form.category || !(Number(form.max) > 0) || Number(form.rate) < 0 || !(Number(form.payments) > 0)) { setError('Completa todos los campos y un motivo de al menos 8 caracteres.'); return; }
      if (!window.confirm('¿Confirmas crear una nueva versión en borrador? La regla publicada no se sobrescribirá.')) return; setSaving(true); setError('');
      try { const draft = await store.saveRuleDraft({ p_existing_rule_id: value?.adminRuleId || null, p_fund_id: form.fund, p_union_code: form.union, p_category_code: form.category, p_max_amount: Number(form.max), p_raw_rate: Number(form.rate), p_term_label: form.termLabel.trim(), p_payment_count: Number(form.payments), p_max_term: Number(form.maxTerm), p_available_on: form.date || null, p_visibility_mode: form.visibility, p_reason: form.reason.trim(), p_confirmation: 'CONFIRMAR' });
        if (form.publish && canPublish) { if (!window.confirm('¿Publicar esta nueva versión ahora? Cambiará las condiciones vigentes e invalidará simulaciones abiertas.')) { app?.toast?.('Borrador guardado sin publicar'); onClose(); return; } await store.publishRule(draft.id, form.reason.trim()); app?.toast?.('Nueva versión publicada'); } else app?.toast?.('Borrador financiero guardado'); onClose(); }
      catch (failure) { setError(failure?.message || 'No fue posible guardar la regla.'); setSaving(false); } };
    return React.createElement(EditorShell, { title: value ? 'Editar regla financiera' : 'Nueva regla financiera', saving, error, onClose, onSave: save, saveLabel: 'Guardar borrador' },
      editorField('Fondo', editorSelect(form.fund, (next) => set('fund', next), funds.map((item) => [item.id, (programLabel(item.program_id) + ' · ' + item.name)]))),
      React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Sindicato', editorSelect(form.union, (next) => set('union', next), unions)), editorField('Categoría', editorSelect(form.category, (next) => set('category', next), categories))),
      React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Monto máximo', editorInput(form.max, (next) => set('max', next), { type: 'number', min: 1, step: '0.01' })), editorField('Tasa legacy', editorInput(form.rate, (next) => set('rate', next), { type: 'number', min: 0, step: '0.0001' }))),
      editorField('Etiqueta de plazo', editorInput(form.termLabel, (next) => set('termLabel', next))), React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Pagos quincenales', editorInput(form.payments, (next) => set('payments', next), { type: 'number', min: 1 })), editorField('Plazo legacy', editorInput(form.maxTerm, (next) => set('maxTerm', next), { type: 'number', min: 1 }))),
      React.createElement('div', { className: 'pcmx-editor-grid' }, editorField('Fecha / vigencia', editorInput(form.date, (next) => set('date', next), { type: 'date' })), editorField('Visibilidad', editorSelect(form.visibility, (next) => set('visibility', next), [['AUTO', 'Automática'], ['MOSTRAR', 'Mostrar'], ['OCULTAR', 'Ocultar']]))),
      editorField('Motivo obligatorio', React.createElement('textarea', { rows: 3, value: form.reason, onChange: (event) => set('reason', event.target.value) })),
      canPublish && editorField('Publicación', React.createElement('label', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('input', { type: 'checkbox', checked: form.publish, onChange: (event) => set('publish', event.target.checked) }), 'Publicar después de guardar el borrador')));
  }

  function CatalogPanel({ kind, store, canWrite, onEdit, onCreate }) {
    const config = store.adminCatalog(), items = kind === 'programs' ? config.programs : config.funds, rules = config.rules;
    return React.createElement('div', { className: 'pcmx-root', 'data-financial-catalog': kind },
      React.createElement('div', { className: 'pcmx-authority' }, React.createElement(I, { name: 'shield', size: 17, stroke: 2, style: { color: '#2456C7' } }), React.createElement('div', { style: { flex: 1 } }, React.createElement('strong', null, kind === 'programs' ? 'Programas financieros' : 'Fondos por programa'), '. Supabase conserva asociación, estado, publicación, orden, versión y auditoría.'), canWrite && React.createElement('button', { type: 'button', className: 'pcmx-primary', onClick: onCreate }, kind === 'programs' ? 'Nuevo programa' : 'Nuevo fondo')),
      React.createElement('div', { className: 'pcmx-catalog' }, items.map((item) => { const relatedFunds = config.funds.filter((fund) => fund.program_id === item.id); const ruleCount = kind === 'programs' ? rules.filter((rule) => rule.program_id === item.id && rule.lifecycle_status !== 'EXPIRED').length : rules.filter((rule) => rule.fund_id === item.id && rule.lifecycle_status !== 'EXPIRED').length;
        return React.createElement('article', { key: item.id, className: 'pcmx-catalog-card', 'data-financial-catalog-item': item.id }, React.createElement('h3', null, item.name), React.createElement('p', null, kind === 'programs' ? (item.description || 'Sin descripción') : programLabel(item.program_id)), React.createElement('div', { className: 'pcmx-catalog-meta' }, React.createElement('span', null, item.publication_status === 'PUBLISHED' ? 'Publicado' : item.publication_status === 'DRAFT' ? 'Borrador' : 'No publicado'), React.createElement('span', null, item.enabled ? 'Activo' : 'Inactivo'), React.createElement('span', null, 'Orden ' + item.sort_order), kind === 'programs' && React.createElement('span', null, relatedFunds.length + ' fondos'), React.createElement('span', null, ruleCount + ' reglas'), React.createElement('span', null, 'v' + item.version)), canWrite && React.createElement('div', { className: 'pcmx-card-actions' }, React.createElement('button', { type: 'button', className: 'pcmx-secondary', onClick: () => onEdit(item) }, 'Editar'))); })));
  }

  function FondosModule({ app, onBack, header }) {
    const store = useStore();
    const desktop = useDesktop();
    const [editing, setEditing] = useState(null);
    const [section, setSection] = useState('rules');
    const [editor, setEditor] = useState(null);
    const [filters, setFilters] = useState({ fondo: 'all', sindicato: 'all', categoria: 'all', tipo: 'all' });
    const canWrite = !!(app && app.admin && app.admin.has('financial_criteria.visibility.write'));
    const canProgramsWrite = !!(app && app.admin && app.admin.has('financial_programs.write'));
    const canRulesWrite = !!(app && app.admin && app.admin.has('financial_rules.write') && app.admin.has('financial_rates.write'));
    const canPublish = !!(app && app.admin && app.admin.has('financial_rules.publish'));
    useEffect(() => { if (store.status() === 'idle') store.load(false); }, []);
    useEffect(() => { if (desktop) ensureMatrixStyles(); }, [desktop]);
    const rows = store.query(filters).sort((a, b) => (a.fondo + a.sindicato + a.categoria + a.sheetRow).localeCompare(b.fondo + b.sindicato + b.categoria + b.sheetRow));
    const filter = (key, options, allLabel) => selWrap(React.createElement('select', {
      value: filters[key], onChange: (event) => setFilters({ ...filters, [key]: event.target.value }),
      style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', padding: '10px 34px 10px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 },
    }, [React.createElement('option', { key: 'all', value: 'all' }, allLabel)].concat(options.map((value) => React.createElement('option', { key: value, value }, value)))));

    const nav = desktop && React.createElement('div', { className: 'pcmx-nav', role: 'tablist', 'aria-label': 'Configuración financiera' }, [['rules', 'Reglas / criterios'], ['programs', 'Programas'], ['funds', 'Fondos']].map(([id, label]) => React.createElement('button', { key: id, type: 'button', role: 'tab', 'aria-selected': section === id, onClick: () => setSection(id) }, label)));
    const desktopContent = section === 'programs' ? React.createElement(CatalogPanel, { kind: 'programs', store, canWrite: canProgramsWrite, onCreate: () => setEditor({ type: 'program', value: null }), onEdit: (value) => setEditor({ type: 'program', value }) }) : section === 'funds' ? React.createElement(CatalogPanel, { kind: 'funds', store, canWrite: canProgramsWrite, onCreate: () => setEditor({ type: 'fund', value: null }), onEdit: (value) => setEditor({ type: 'fund', value }) }) : React.createElement(DesktopCriteriaMatrix, { store, canEdit: canRulesWrite, onCreate: () => setEditor({ type: 'rule', value: null }), onEdit: (value) => setEditor({ type: 'rule', value }) });
    return React.createElement('div', { 'data-admin-view': 'fondos', 'data-admin-classification': 'PRODUCTIVE_SUPABASE_CONTROLLED' },
      header({ title: desktop ? 'Configuración financiera' : 'Fondos y reglas', sub: store.all().length + (desktop ? ' reglas · autoridad Supabase' : ' criterios · visibilidad SutiApp'), onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        desktop ? React.createElement(React.Fragment, null, nav, React.createElement('div', { style: { height: 12 } }), store.status() === 'loading' ? React.createElement('div', { className: 'pcmx-panel', 'data-criteria-loading': 'true', style: { padding: 8 } }, Array.from({ length: 10 }, (_, index) => React.createElement('div', { key: index, className: 'pcmx-skeleton' }))) :
          store.status() === 'error' ? React.createElement('div', { className: 'pcmx-empty', 'data-criteria-error': 'true' }, React.createElement('strong', null, 'No pudimos consultar la configuración financiera'), React.createElement('span', null, 'Supabase no respondió. No se usó caché, mock ni fuente alternativa.'), React.createElement('button', { type: 'button', onClick: () => store.load(true) }, 'Reintentar')) : desktopContent) : React.createElement(React.Fragment, null,
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } },
            'Aquí sólo se administra ', React.createElement('b', null, 'VISIBILIDAD SUTIAPP'), '. Categoría, sindicato, tasa, monto, plazo, fecha y reglas financieras permanecen bloqueados.')),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 } },
          filter('fondo', store.fondos(), 'Todos los programas'), filter('sindicato', store.sindicatos(), 'Todos los sindicatos'),
          filter('categoria', store.categorias(), 'Todas las categorías'), filter('tipo', ['revolvente', 'evento'], 'Permanentes y fechados')),
        store.status() === 'loading' ? React.createElement(window.EmptyState, { icon: 'clock', title: 'Consultando criterios', sub: 'Obteniendo la configuración vigente.' }) :
          store.status() === 'error' ? React.createElement('div', null,
            React.createElement(window.EmptyState, { icon: 'warning', title: 'No pudimos consultar los criterios', sub: 'No se usó ninguna fuente alternativa.' }),
            React.createElement(window.Btn, { full: true, variant: 'outline', onClick: () => store.load(true) }, 'Reintentar')) :
            !rows.length ? React.createElement(window.EmptyState, { icon: 'finance', title: 'Sin criterios', sub: 'Ajusta los filtros para ampliar la consulta.' }) :
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, rows.map((row) => React.createElement(RuleRow, { key: row.id, row, canWrite, onEdit: () => setEditing(row) }))))),
      !desktop && editing && React.createElement(VisibilityEditor, { row: editing, store, app, onClose: () => setEditing(null) }),
      desktop && editor?.type === 'program' && React.createElement(ProgramEditor, { value: editor.value, store, app, onClose: () => setEditor(null) }),
      desktop && editor?.type === 'fund' && React.createElement(FundEditor, { value: editor.value, store, app, onClose: () => setEditor(null) }),
      desktop && editor?.type === 'rule' && React.createElement(RuleEditor, { value: editor.value, store, app, canPublish, onClose: () => setEditor(null) }));
  }

  function RuleRow({ row, canWrite, onEdit }) {
    const effectiveVisible = row.effectiveVisibility === 'VISIBLE';
    return React.createElement('div', { 'data-criterion-row': row.sheetRow, style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', padding: 13 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10 } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: 11, background: row.permanent ? 'var(--guinda-50)' : '#EEF3FF', color: row.permanent ? 'var(--guinda)' : '#2456C7', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: row.permanent ? 'finance' : 'calendar', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 14, fontWeight: 900, color: 'var(--ink)', lineHeight: 1.3 } }, row.fondo),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)', marginTop: 3 } }, dateLabel(row.fecha), ' · ', row.categoria, ' · ', row.sindicato)),
        React.createElement(window.Badge, { tone: effectiveVisible ? 'green' : 'amber' }, effectiveVisible ? 'VISIBLE' : 'OCULTO')),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 11 } },
        info('Política automática', visibleLabel(row.automaticVisibility)),
        info('Configuración', modeLabel(row.visibilityMode)),
        info('Estado efectivo', effectiveVisible ? 'Visible' : 'Oculto')),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--hairline)' } },
        React.createElement('span', { style: { fontSize: 10.5, fontWeight: 650, color: 'var(--ink-3)' } }, row.permanent ? 'AUTO visible todo el año' : 'Ventana AUTO: ' + dateLabel(row.visibilityWindowStart) + '–' + dateLabel(row.visibilityWindowEnd)),
        canWrite ? React.createElement('button', { type: 'button', onClick: onEdit, 'data-visibility-control': row.id, style: { height: 34, borderRadius: 10, border: 'none', background: 'var(--guinda-50)', color: 'var(--guinda)', padding: '0 12px', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' } }, 'Administrar') :
          React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' } }, 'Solo lectura')));
  }

  function info(label, value) {
    return React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 11, padding: '8px 9px', minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', lineHeight: 1.25 } }, label),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 850, color: 'var(--ink)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis' } }, value));
  }

  function VisibilityEditor({ row, store, app, onClose }) {
    const [mode, setMode] = useState(row.visibilityMode || 'AUTO');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const reasonRequired = mode !== row.visibilityMode;
    const valid = mode !== row.visibilityMode && (!reasonRequired || reason.trim().length >= 8) && !saving;
    const save = async () => {
      if (!valid) return;
      const label = modeLabel(mode);
      if (!window.confirm('¿Confirmas cambiar VISIBILIDAD SUTIAPP a “' + label + '” para este criterio?')) return;
      setSaving(true); setError('');
      try {
        await store.setVisibility(row.id, mode, reason.trim());
        if (app && app.toast) app.toast('Visibilidad actualizada y auditada en Supabase');
        onClose();
      } catch (failure) { setError(failure && failure.message ? failure.message : 'No fue posible actualizar la visibilidad'); setSaving(false); }
    };
    const choices = [
      ['AUTO', 'Automático', 'Aplica permanencia o ventana de cuatro meses calendario.'],
      ['MOSTRAR', 'Mostrar excepcionalmente', 'Hace visible el criterio fuera de la ventana, sin saltar elegibilidad.'],
      ['OCULTAR', 'Ocultar', 'Lo oculta en SutiApp aunque AUTO lo mostraría.'],
    ];
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }, 'data-visibility-editor': '' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, disabled: saving, style: { width: 40, height: 40, border: 'none', borderRadius: 12, background: 'transparent', display: 'grid', placeItems: 'center', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('div', null, React.createElement('div', { style: { fontSize: 16, fontWeight: 850 } }, 'Visibilidad SutiApp'), React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 650 } }, 'Fila protegida ', row.sheetRow))),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, padding: 16 } },
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', padding: 14, marginBottom: 14 } },
          React.createElement('div', { style: { fontSize: 15, fontWeight: 900 } }, row.fondo),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 650, marginTop: 4 } }, dateLabel(row.fecha), ' · ', row.categoria, ' · ', row.sindicato)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } }, choices.map(([value, label, description]) => React.createElement('button', {
          key: value, type: 'button', disabled: saving, onClick: () => setMode(value), style: { textAlign: 'left', borderRadius: 15, border: '1.5px solid ' + (mode === value ? 'var(--guinda)' : 'transparent'), background: mode === value ? 'var(--guinda-50)' : 'var(--surface)', boxShadow: mode === value ? 'none' : 'var(--neo-sm)', padding: 13, fontFamily: 'inherit' },
        }, React.createElement('div', { style: { fontSize: 14, fontWeight: 850, color: mode === value ? 'var(--guinda)' : 'var(--ink)' } }, label), React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4, marginTop: 3 } }, description)))),
        reasonRequired && React.createElement('div', { style: { marginTop: 16 } },
          React.createElement('label', { style: { display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, 'Motivo obligatorio'),
          React.createElement('textarea', { value: reason, maxLength: 500, rows: 4, disabled: saving, placeholder: 'Explica la excepción administrativa…', onChange: (event) => setReason(event.target.value), style: { ...inputBase, resize: 'vertical', lineHeight: 1.45 } }),
          React.createElement('div', { style: { fontSize: 10.5, color: reason.trim().length && reason.trim().length < 8 ? '#C0341D' : 'var(--ink-3)', fontWeight: 650, marginTop: 5 } }, reason.trim().length + '/500 · mínimo 8 caracteres')),
        error && React.createElement('div', { style: { marginTop: 13, padding: 11, borderRadius: 12, background: '#FDEAEA', color: '#C0341D', fontSize: 11.5, fontWeight: 700 } }, error)),
      React.createElement('div', { style: { display: 'flex', gap: 10, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)' } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, disabled: saving, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', style: { flex: 2 }, disabled: !valid, onClick: save }, saving ? 'Confirmando…' : 'Confirmar cambio')));
  }

  window.FondosModule = FondosModule;
})();
