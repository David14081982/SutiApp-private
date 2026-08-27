/* screens-financiera.jsx — SutiApp Financiera super-app dashboard */
(function () {
  const I = window.Icon;
  // Porción del store financiero que consume esta pantalla. Estable por
  // identidad: `status` y `overview` no cambian al recotizar.
  const overviewSlice = (snapshot) => ({ status: snapshot.status, overview: snapshot.overview });

  function SummaryCard({ app }) {
    const financial = window.useFinancialLegacy ? window.useFinancialLegacy(overviewSlice) : { status: 'error', overview: null };
    const overview = financial.overview || {};
    const availableCredit = window.FinancialLegacyRepository && typeof window.FinancialLegacyRepository.availableCreditTotal === 'function' ? window.FinancialLegacyRepository.availableCreditTotal(financial.overview) : null;
    const value = (amount) => typeof amount === 'number' ? window.money(amount) : '—';
    return React.createElement('div', { style: { padding: '4px 16px 0' } },
      React.createElement('div', {
        style: { background: 'var(--surface)', color: 'var(--ink)', borderRadius: 24, padding: 20, boxShadow: 'var(--neo-md)', position: 'relative', overflow: 'hidden' },
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('div', { style: { display: 'flex', gap: 13, alignItems: 'center' } },
            React.createElement(window.ResTile, { resKey: 'fin.summary.icon', size: 50, glow: true }),
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700 } }, 'Crédito disponible'),
              React.createElement('div', { 'data-finance-available-credit': availableCredit===null?'loading':String(availableCredit), style: { fontSize: 32, fontWeight: 800, letterSpacing: '-.025em', marginTop: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--navy)' } }, value(availableCredit)))),
          React.createElement(window.Badge, { tone: overview.status === 'AVAILABLE' ? 'green' : 'amber', icon: overview.status === 'AVAILABLE' ? 'checkCircle' : 'clock' }, financial.status === 'ready' ? (overview.eligibility_label || 'NO DISPONIBLE') : 'CONSULTANDO')),
        React.createElement('div', { style: { height: 1, background: 'var(--hairline)', margin: '16px 0' } }),
        React.createElement('div', { style: { display: 'flex', gap: 18 } },
          miniStat('Mi ahorro', value(overview.savings && overview.savings.balance), 'fin.stat.ahorro'),
          React.createElement('div', { style: { width: 1, background: 'var(--hairline)' } }),
          miniStat('Mi inversión', '—', null, true)),
        React.createElement('div', { 'data-finance-summary-actions': '', style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9, marginTop: 18 } },
          React.createElement(SummaryAction, { label: 'préstamo', ariaLabel: 'Solicitar préstamo', icon: 'cash', primary: true, onClick: () => app.push('loan') }),
          React.createElement(SummaryAction, { label: 'Ahorrar', icon: 'piggy', onClick: () => app.openFinanceItem('ahorro') }),
          React.createElement(SummaryAction, { label: 'Invertir', trend: true, onClick: () => app.push('investment') })),
      ),
    );
  }
  function SummaryAction({ label, ariaLabel, icon, trend, primary, onClick }) {
    return React.createElement('button', {
      type: 'button', onClick, className: 'su-press', 'aria-label': ariaLabel || label,
      style: { minWidth: 0, minHeight: 80, padding: '12px 4px 11px', border: 'none', borderRadius: 16, background: primary ? 'linear-gradient(to bottom right, #E1334A 0%, #991E23 100%)' : '#F6F8FC', color: primary ? '#fff' : 'var(--navy)', boxShadow: primary ? '0 8px 14px rgba(153,30,35,.18), 0 16px 26px rgba(224,192,198,.60), 0 24px 38px rgba(248,240,242,.38)' : 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, textTransform: primary ? 'capitalize' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 },
    },
      React.createElement('span', { style: { width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', background: primary ? 'rgba(255,255,255,.18)' : 'var(--surface)', color: primary ? '#fff' : 'var(--guinda)', boxShadow: primary ? 'none' : 'var(--neo-sm)' } },
        trend
          ? React.createElement('svg', { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
              React.createElement('path', { d: 'M3 17l6-6 4 4 8-8' }),
              React.createElement('path', { d: 'M15 7h6v6' }))
          : React.createElement(I, { name: icon, size: 19, stroke: 2 })),
      label);
  }
  function miniStat(label, val, resKey, investment) {
    return React.createElement('div', { key: label, style: { flex: 1 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 700 } },
        investment
          ? React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { color: 'var(--guinda)', flexShrink: 0 }, 'aria-hidden': 'true' },
              React.createElement('path', { d: 'M3 17l6-6 4 4 8-8' }),
              React.createElement('path', { d: 'M15 7h6v6' }))
          : React.createElement(window.Res, { resKey, size: 13, stroke: 2, style: { color: 'var(--guinda)' } }), label),
      React.createElement('div', { style: { fontSize: 17, fontWeight: 800, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: 'var(--navy)' } }, val));
  }

  function Recommended({ app }) {
    const fs = window.finCatStore;
    const list = fs && fs.recsLive ? fs.recsLive() : [];
    if (!list.length) return null;
    return React.createElement('div', null,
      React.createElement('div', { style: { padding: '0 20px' } }, React.createElement(window.SectionHead, { title: 'Recomendado para ti', icon: 'sparkle' })),
      React.createElement('div', { style: { display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' } },
        list.map((r) => React.createElement('div', {
          key: r.id, onClick: () => app.openFinanceItem(r.itemId), className: 'su-press',
          style: { width: 178, flexShrink: 0, background: 'var(--surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--neo-sm)', cursor: 'pointer' },
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement(window.ResTile, { resKey: 'fin.item.' + r.itemId, size: 44, glow: true }),
            r.reason && React.createElement('span', { style: { fontSize: 10.5, fontWeight: 800, color: 'var(--gold)', background: '#fbf2dd', padding: '4px 8px', borderRadius: 999 } }, r.reason)),
          React.createElement('div', { style: { fontSize: 15, fontWeight: 800, marginTop: 12, color: 'var(--ink)' } }, r.item.label),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--guinda)', fontWeight: 700, fontSize: 13.5 } },
            r.cta || 'Ver', React.createElement(I, { name: 'arrowR', size: 15, stroke: 2.2 })))),
      ),
    );
  }

  function FinanceItem({ it, onClick }) {
    const needsQuote = window.quoteStore && window.quoteStore.requiresQuote(it.id);
    const availability = it.availabilityStatus;
    const stateLabel = { AVAILABLE: 'DISPONIBLE', SCHEDULED: 'PRÓXIMAMENTE', NOT_ELIGIBLE: 'NO ELEGIBLE', UNAVAILABLE: 'NO DISPONIBLE' }[availability];
    return React.createElement('button', {
      onClick, className: 'su-press',
      style: { display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', border: 'none', background: 'var(--surface)', borderRadius: 18, padding: '13px 14px', cursor: 'pointer', boxShadow: 'var(--neo-md)' },
    },
      React.createElement(window.ResTile, { resKey: 'fin.item.' + it.id, size: 50, glow: true }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          React.createElement('span', { style: { fontSize: 15, fontWeight: 800, color: 'var(--ink)' } }, it.label),
          it.hero && React.createElement(window.Badge, { tone: 'gold', solid: true }, 'POPULAR'),
          stateLabel && React.createElement(window.Badge, { tone: availability === 'AVAILABLE' ? 'green' : availability === 'SCHEDULED' ? 'blue' : 'amber' }, stateLabel),
          needsQuote && React.createElement(window.Badge, { tone: 'blue' }, 'SE COTIZA')),
        React.createElement('div', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginTop: 1 } }, it.tagline),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, marginTop: 1 } }, it.meta)),
      React.createElement(I, { name: 'chevR', size: 19, stroke: 2, style: { color: 'var(--ink-3)', flexShrink: 0 } }),
    );
  }

  function Group({ g, app }) {
    const toneColor = { guinda: 'var(--guinda)', green: '#13794A', blue: '#2456C7', amber: '#9A6B16' }[g.tone];
    return React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 12px' } },
        React.createElement('div', { style: { width: 6, height: 24, borderRadius: 999, background: toneColor } }),
        React.createElement('div', null,
          React.createElement('h3', { style: { fontSize: 16.5, fontWeight: 800, margin: 0, letterSpacing: '-.01em', color: 'var(--ink)' } }, g.title),
          React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 } }, g.sub))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        g.items.map((it) => React.createElement(FinanceItem, { key: it.id, it, onClick: () => app.openFinanceItem(it.id) }))),
    );
  }

  // Sheet de filtros: selección múltiple de categorías
  function FilterSheet({ open, onClose, options, cats, setCats }) {
    const toggle = (id) => setCats((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    return React.createElement(window.Sheet, { open, onClose, title: 'Filtrar por categoría' },
      React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, margin: '0 0 14px', lineHeight: 1.45 } }, 'Elige una o varias categorías. Sin selección se muestran todas.'),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 9 } },
        options.map((o) => { const on = cats.includes(o.id); return React.createElement('button', { key: o.id, onClick: () => toggle(o.id), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 15px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)' } }, on && React.createElement(I, { name: 'check', size: 14, stroke: 2.6 }), o.title); })),
      React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 20 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, disabled: !cats.length, onClick: () => setCats([]) }, 'Limpiar'),
        React.createElement(window.Btn, { icon: 'check', style: { flex: 1.4 }, onClick: onClose }, 'Aplicar')));
  }

  function FinancieraScreen({ app, t }) {
    if (window.useQuoteStore) window.useQuoteStore();   // re-render si el admin cambia la config de cotización
    if (window.useFinCatStore) window.useFinCatStore(); // re-render si el admin edita el catálogo
    if (window.useAdminStore) window.useAdminStore();   // re-render si cambia el espectador (segmentación)
    if (window.useMembershipStore) window.useMembershipStore(); // re-render si el admin edita membresías
    const financial = window.useFinancialLegacy ? window.useFinancialLegacy(overviewSlice) : { status: 'error', overview: null };
    React.useEffect(() => { if (window.financialLegacyStore) window.financialLegacyStore.ensureLoanSession(); }, []);
    const [q, setQ] = React.useState('');
    const [fOpen, setFOpen] = React.useState(false);
    const [cats, setCats] = React.useState([]);
    const overview = financial.overview || {};
    const resolvedPrograms = Array.isArray(overview.programs) ? overview.programs : [];
    const liquidityIds = ['prestamo', 'nomina', 'caja'];
    const groups = (window.finCatStore ? window.finCatStore.groupsLive() : []).map((group) => ({ ...group, items: group.items.map((item) => {
      if (!liquidityIds.includes(item.id)) return item;
      const matches = resolvedPrograms.filter((program) => program.program_id === item.id);
      const available = matches.some((program) => program.status === 'AVAILABLE');
      const scheduled = matches.some((program) => program.status === 'SCHEDULED');
      const status = overview.reason === 'INCOMPLETE_FINANCIAL_PROFILE' ? 'UNAVAILABLE' : available ? 'AVAILABLE' : scheduled ? 'SCHEDULED' : overview.status === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : 'UNAVAILABLE';
      const meta = status === 'AVAILABLE' ? (matches.length + (matches.length === 1 ? ' fondo disponible' : ' fondos disponibles')) : status === 'SCHEDULED' ? 'Tienes una opción próxima' : overview.reason === 'INCOMPLETE_FINANCIAL_PROFILE' ? 'Completa categoría y sindicato' : 'Sin opción para tu perfil';
      return { ...item, availabilityStatus: status, meta };
    }) }));
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nq = norm(q.trim());
    const catOk = (id) => !cats.length || cats.includes(id);
    const match = (txt) => !nq || norm(txt).includes(nq);
    const shownGroups = groups.filter((g) => catOk(g.id)).map((g) => Object.assign({}, g, { items: g.items.filter((it) => match(it.label + ' ' + (it.tagline || '') + ' ' + (it.meta || ''))) })).filter((g) => g.items.length);
    const membresias = (window.membershipStore && catOk('membresias')) ? window.membershipStore.active().filter((m) => match(m.empresa + ' ' + m.concepto)) : [];
    const filtering = !!nq || cats.length > 0;
    const total = membresias.length + shownGroups.reduce((s, g) => s + g.items.length, 0);
    const options = [{ id: 'membresias', title: 'Membresías' }].concat(groups.map((g) => ({ id: g.id, title: g.title })));
    return React.createElement('div', { className: 'su-route', style: { paddingBottom: 18 } },
      React.createElement(window.TopBar, { app, variant: 'financiera' }),
      React.createElement('div', { className: 'su-stagger', style: { display: 'flex', flexDirection: 'column', gap: 22 } },
        React.createElement(SummaryCard, { app }),
        React.createElement('div', { style: { padding: '0 16px', position: 'relative' } },
          React.createElement(window.SearchBar, { placeholder: 'Busca un beneficio o servicio…', value: q, onChange: setQ, onFilter: () => setFOpen(true) }),
          cats.length > 0 && React.createElement('div', { style: { position: 'absolute', top: -6, right: 12, minWidth: 20, height: 20, borderRadius: 999, background: 'var(--gold)', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px', pointerEvents: 'none' } }, cats.length)),
        filtering && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', marginTop: -8 } },
          React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700, flex: 1 } }, total + ' resultado(s)' + (cats.length ? ' · ' + cats.length + ' categoría(s)' : '')),
          React.createElement('button', { onClick: () => { setQ(''); setCats([]); }, style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--guinda)', boxShadow: 'var(--neo-inset)' } }, React.createElement(I, { name: 'close', size: 13, stroke: 2.4 }), 'Limpiar')),
        !filtering && React.createElement(Recommended, { app }),
        window.MembresiasSection && React.createElement(window.MembresiasSection, { app, items: membresias }),
        ...shownGroups.map((g) => React.createElement(Group, { key: g.id, g, app })),
        filtering && total === 0 && React.createElement('div', { style: { padding: '0 20px' } },
          React.createElement(window.EmptyState, { icon: 'search', title: 'Sin resultados', sub: 'No encontramos beneficios ni membresías con ese criterio. Ajusta la búsqueda o los filtros.' })),
      ),
      React.createElement(FilterSheet, { open: fOpen, onClose: () => setFOpen(false), options, cats, setCats }),
    );
  }

  window.FinancieraScreen = FinancieraScreen;
})();
