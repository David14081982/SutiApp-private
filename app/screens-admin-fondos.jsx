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
  const selWrap = (children) => React.createElement('div', { style: { position: 'relative' } }, children,
    React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }));

  function FondosModule({ app, onBack, header }) {
    const store = useStore();
    const [editing, setEditing] = useState(null);
    const [filters, setFilters] = useState({ fondo: 'all', sindicato: 'all', categoria: 'all', tipo: 'all' });
    const canWrite = !!(app && app.admin && app.admin.has('financial_criteria.visibility.write'));
    useEffect(() => { if (store.status() === 'idle') store.load(false); }, []);
    const rows = store.query(filters).sort((a, b) => (a.fondo + a.sindicato + a.categoria + a.sheetRow).localeCompare(b.fondo + b.sindicato + b.categoria + b.sheetRow));
    const filter = (key, options, allLabel) => selWrap(React.createElement('select', {
      value: filters[key], onChange: (event) => setFilters({ ...filters, [key]: event.target.value }),
      style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', padding: '10px 34px 10px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 },
    }, [React.createElement('option', { key: 'all', value: 'all' }, allLabel)].concat(options.map((value) => React.createElement('option', { key: value, value }, value)))));

    return React.createElement('div', { 'data-admin-view': 'fondos', 'data-admin-classification': 'PRODUCTIVE_GOOGLE_CONTROLLED' },
      header({ title: 'Fondos y reglas', sub: store.all().length + ' criterios · visibilidad SutiApp', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
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
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, rows.map((row) => React.createElement(RuleRow, { key: row.id, row, canWrite, onEdit: () => setEditing(row) })))),
      editing && React.createElement(VisibilityEditor, { row: editing, store, app, onClose: () => setEditing(null) }));
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
