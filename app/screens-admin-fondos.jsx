/* Admin visibility control for authoritative Google financial criteria. */
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
      @media(max-width:1279px){.pcmx-filters{grid-template-columns:repeat(4,minmax(0,1fr))}.pcmx-workspace{grid-template-columns:minmax(0,1fr) minmax(270px,35%)}.pcmx-kv{grid-template-columns:1fr}.pcmx-table{min-width:1110px}}
      @media(min-width:1280px){.pcmx-filters{grid-template-columns:minmax(190px,1.5fr) repeat(6,minmax(105px,1fr))}.pcmx-workspace{grid-template-columns:minmax(0,1fr) 340px}}
      @media(min-width:1440px){.pcmx-workspace{grid-template-columns:minmax(0,1fr) 380px}.pcmx-detail-scroll{padding:14px}}
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

  function CriteriaDetail({ row, compared, onClearCompare }) {
    if (!row) return React.createElement('aside', { className: 'pcmx-panel pcmx-detail', 'data-criteria-detail': 'empty' }, React.createElement('div', { className: 'pcmx-empty' }, 'Selecciona una regla para consultar su detalle.'));
    const kv = (items) => React.createElement('div', { className: 'pcmx-kv' }, items.map(([label, value]) => React.createElement('div', { key: label }, React.createElement('span', null, label), React.createElement('strong', null, value))));
    const comparisonFields = [['Fondo', (item) => item.fondo], ['Sindicato', (item) => item.sindicato], ['Categoría', (item) => item.categoria], ['Monto máximo', (item) => moneyLabel(item.montoMax)], ['Tasa', rateLabel], ['Plazo', termLabel], ['Vigencia', (item) => item.permanent ? 'Permanente' : dateLabel(item.fecha)], ['Estado', (item) => statusMeta(item.status).label]];
    return React.createElement('aside', { className: 'pcmx-panel pcmx-detail', 'data-criteria-detail': row.id },
      React.createElement('div', { className: 'pcmx-detail-head' }, React.createElement('h2', null, row.fondo), React.createElement('p', null, programLabel(row.programId), ' · regla seleccionada')),
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

  function DesktopCriteriaMatrix({ store }) {
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
    return React.createElement('div', { className: 'pcmx-root', tabIndex: 0, onKeyDown, 'data-admin-program-criteria-matrix': 'true', 'data-read-only': 'true' },
      React.createElement('div', { className: 'pcmx-authority' }, React.createElement(I, { name: 'shield', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0 } }), React.createElement('div', null, React.createElement('strong', null, 'Solo lectura · autoridad Google. '), 'La matriz presenta criterios vigentes sin editar tasas, montos, plazos, reglas, fechas ni visibilidad.')),
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
        React.createElement(CriteriaDetail, { row: selected, compared, onClearCompare: () => setCompareIds([]) })));
  }

  function FondosModule({ app, onBack, header }) {
    const store = useStore();
    const desktop = useDesktop();
    const [editing, setEditing] = useState(null);
    const [filters, setFilters] = useState({ fondo: 'all', sindicato: 'all', categoria: 'all', tipo: 'all' });
    const canWrite = !!(app && app.admin && app.admin.has('financial_criteria.visibility.write'));
    useEffect(() => { if (store.status() === 'idle') store.load(false); }, []);
    useEffect(() => { if (desktop) ensureMatrixStyles(); }, [desktop]);
    const rows = store.query(filters).sort((a, b) => (a.fondo + a.sindicato + a.categoria + a.sheetRow).localeCompare(b.fondo + b.sindicato + b.categoria + b.sheetRow));
    const filter = (key, options, allLabel) => selWrap(React.createElement('select', {
      value: filters[key], onChange: (event) => setFilters({ ...filters, [key]: event.target.value }),
      style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', padding: '10px 34px 10px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 },
    }, [React.createElement('option', { key: 'all', value: 'all' }, allLabel)].concat(options.map((value) => React.createElement('option', { key: value, value }, value)))));

    return React.createElement('div', { 'data-admin-view': 'fondos', 'data-admin-classification': 'PRODUCTIVE_GOOGLE_CONTROLLED' },
      header({ title: desktop ? 'Criterios de programas' : 'Fondos y reglas', sub: store.all().length + (desktop ? ' reglas · matriz de solo lectura' : ' criterios · visibilidad SutiApp'), onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        desktop ? (store.status() === 'loading' ? React.createElement('div', { className: 'pcmx-panel', 'data-criteria-loading': 'true', style: { padding: 8 } }, Array.from({ length: 10 }, (_, index) => React.createElement('div', { key: index, className: 'pcmx-skeleton' }))) :
          store.status() === 'error' ? React.createElement('div', { className: 'pcmx-empty', 'data-criteria-error': 'true' }, React.createElement('strong', null, 'No pudimos consultar los criterios'), React.createElement('span', null, 'Google no respondió. No se usó caché, mock ni fuente alternativa.'), React.createElement('button', { type: 'button', onClick: () => store.load(true) }, 'Reintentar')) : React.createElement(DesktopCriteriaMatrix, { store })) : React.createElement(React.Fragment, null,
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
      !desktop && editing && React.createElement(VisibilityEditor, { row: editing, store, app, onClose: () => setEditing(null) }));
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
    const reasonRequired = mode !== 'AUTO';
    const valid = mode !== row.visibilityMode && (!reasonRequired || reason.trim().length >= 8) && !saving;
    const save = async () => {
      if (!valid) return;
      const label = modeLabel(mode);
      if (!window.confirm('¿Confirmas cambiar VISIBILIDAD SUTIAPP a “' + label + '” para este criterio?')) return;
      setSaving(true); setError('');
      try {
        await store.setVisibility(row.id, mode, reason.trim());
        if (app && app.toast) app.toast('Visibilidad actualizada y confirmada en Google');
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
