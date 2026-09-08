/* screens-company.jsx — Panel Empresarial (independiente del admin).
   Login por empresa, dashboard, Mi Empresa, Productos/Servicios, Promociones,
   Pop-ups (con flujo de aprobación), Solicitudes vía nómina, Estadísticas,
   Notificaciones y Bitácora. Exporta window.CompanyScreen y window.CompanyGate. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const CS = () => window.companyStore;
  const CO = () => window.COMPANY;
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 };
  function useStore() { const [, f] = useState(0); React.useEffect(() => CS().subscribe(() => f((n) => n + 1)), []); return CS(); }

  // ── Gate de acceso empresa ──
  function CompanyGate({ app }) {
    const store = useStore();
    const [id, setId] = useState((store.companies()[0] || {}).id || '');
    const [pass, setPass] = useState('');
    const [err, setErr] = useState(false);
    React.useEffect(()=>{if(!id&&store.companies()[0])setId(store.companies()[0].id);},[store.state().phase,id]);
    const enter = async () => { if (!(await store.login(id))) setErr(true); };
    return React.createElement('div', { style: { minHeight: '100%', background: 'linear-gradient(160deg,#14213d,#0b1226)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 24px', position: 'relative', overflow: 'hidden' } },
      React.createElement('div', { style: { position: 'relative', textAlign: 'center', color: '#fff', marginBottom: 24 } },
        React.createElement('div', { style: { width: 74, height: 74, borderRadius: 22, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' } }, React.createElement(I, { name: 'handshake', size: 38, stroke: 1.8 })),
        React.createElement('h1', { style: { fontSize: 23, fontWeight: 900, margin: 0, letterSpacing: '-.02em' } }, 'Panel Empresarial'),
        React.createElement('p', { style: { fontSize: 13, fontWeight: 600, opacity: .8, margin: '8px 0 0', lineHeight: 1.5 } }, 'Acceso para empresas con convenio vigente.')),
      React.createElement('div', { style: { position: 'relative', background: 'var(--surface)', borderRadius: 22, padding: 20, boxShadow: 'var(--shadow-lg)' } },
        React.createElement('label', { style: lbl }, 'Empresa'),
        React.createElement('div', { style: { position: 'relative', marginBottom: 14 } },
          React.createElement('select', { value: id, onChange: (e) => { setId(e.target.value); setErr(false); }, style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer' } },
            store.companies().map((c) => React.createElement('option', { key: c.id, value: c.id }, c.name))),
          React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
        React.createElement('label', { style: lbl }, 'Contraseña'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '11px 14px', border: err ? '1.5px solid #C0341D' : '1.5px solid transparent' } },
          React.createElement(I, { name: 'lock', size: 18, stroke: 2, style: { color: 'var(--ink-3)' } }),
          React.createElement('input', { type: 'password', value: pass, disabled:true, placeholder: 'Sesión Supabase activa', onChange: (e) => { setPass(e.target.value); setErr(false); }, style: { flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)' } })),
        err && React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: '#C0341D', marginTop: 8 } }, 'Tu sesión no tiene acceso a esa empresa.'),
        React.createElement(window.Btn, { full: true, size: 'lg', icon: 'handshake', variant: 'dark', disabled:!id,style: { marginTop: 18 }, onClick: enter }, 'Ingresar'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 14 } }, store.state().phase==='loading'?'Validando membresía…':'Acceso protegido por Supabase Auth y RLS')));
  }
  window.CompanyGate = CompanyGate;

  // ── Header ──
  function CoHeader({ title, sub, onBack, co }) {
    return React.createElement('div', { style: { background: 'linear-gradient(150deg,#1b2c52,#14213d)', color: '#fff', padding: '10px 14px 16px', position: 'relative' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        onBack && React.createElement('button', { onClick: onBack, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        !onBack && React.createElement('div', { style: { width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' } }, React.createElement('image-slot', { id: co && co.slotLogo, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }), React.createElement(I, { name: 'handshake', size: 22, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 18, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, title),
          sub && React.createElement('div', { style: { fontSize: 12, fontWeight: 600, opacity: .8, marginTop: 2 } }, sub)),
        React.createElement('button', { onClick: () => CS().logout(), 'aria-label': 'Salir', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'logout', size: 20, stroke: 2 }))));
  }

  // ── Root ──
  function CompanyScreen({ app }) {
    const store = useStore();
    const [view, setView] = useState('home');
    if (!store.isAuth()) return React.createElement(CompanyGate, { app });
    const co = store.current();
    const props = { app, co, store, onBack: () => setView('home') };
    const M = {
      empresa: window.CoEmpresa, productos: window.CoProductos, promos: window.CoPromos,
      popups: window.CoPopups, solicitudes: window.CoSolicitudes, cotizaciones: window.CoCotizaciones, stats: window.CoStats,
      notifs: window.CoNotifs, bitacora: window.CoBitacora,
    };
    const View = M[view];
    return React.createElement('div', { style: { minHeight: '100%', background: 'var(--bg)' } },
      view === 'home' ? React.createElement(CoDashboard, { app, co, store, onOpen: setView }) : React.createElement(View, props));
  }

  // ── Dashboard ──
  const fmtDate = (s) => { if(!s)return 'Pendiente';try { return new Date(s + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s; } };
  function CoDashboard({ app, co, store, onOpen }) {
    const plan = CO().PLAN(co.plan);
    const ss = store.subStatus(co);
    const sols = store.solicitudes(co.id);
    const by = (e) => sols.filter((s) => s.estado === e).length;
    const pops = store.myPopups(co.id);
    const st = co.stats || {};
    const prods = window.catalogStore ? window.catalogStore.byCompany(co.id).length : (co.products || []).length;
    const promosOn = (co.promos || []).filter((p) => p.active).length;
    const popsPend = pops.filter((p) => p.status === 'pending').length;
    const popsOn = pops.filter((p) => p.status === 'approved').length;

    // vigencia
    const hasDates=Boolean(co.subStart&&co.subEnd);const start=hasDates?new Date(co.subStart+'T00:00'):null,end=hasDates?new Date(co.subEnd+'T23:59'):null,now=new Date();
    const pct=hasDates?Math.max(0,Math.min(1,(now-start)/(end-start))):0;
    const daysLeft=hasDates?Math.max(0,Math.ceil((end-now)/86400000)):0;
    const ssMap = { activo: ['Activa', '#6fe0a0', 'rgba(111,224,160,.18)'], porVencer: ['Por vencer', '#f0c674', 'rgba(200,146,47,.22)'], vencido: ['Vencida', '#ff9aa8', 'rgba(232,54,79,.22)'] }[ss];

    // indicadores factibles (medibles en la app) con contexto
    const perf = [
      { icon: 'cart', val: prods, label: 'Productos publicados', sub: 'Catálogo real en Marketplace' },
      { icon: 'flame', val: promosOn, label: 'Promociones activas', sub: 'Aprobadas y visibles hoy' },
      { icon: 'receipt', val: st.solicitudes || 0, label: 'Solicitudes recibidas', sub: 'Operaciones registradas en Supabase' },
      { icon: 'doc', val: st.cotizaciones || 0, label: 'Cotizaciones', sub: 'Solicitudes de presupuesto reales' },
    ];

    // pendientes accionables
    const attn = [];
    if (by('pendiente')) attn.push({ icon: 'receipt', tone: '#9A6B16', bg: '#FFF3DC', t: by('pendiente') + ' solicitud(es) por responder', s: 'Afiliados esperan tu respuesta', go: 'solicitudes' });
    if (popsPend) attn.push({ icon: 'message', tone: '#2456C7', bg: '#E8F0FE', t: popsPend + ' pop-up(s) en revisión', s: 'Pendientes de aprobación del sindicato', go: 'popups' });
    if (ss !== 'activo') attn.push({ icon: ss === 'vencido' ? 'emergency' : 'clock', tone: '#C0341D', bg: '#FDEAEA', t: ss === 'vencido' ? 'Tu suscripción venció' : 'Tu suscripción vence en ' + daysLeft + ' días', s: 'Renueva para no perder visibilidad', go: 'empresa' });

    const modules = [
      { id: 'empresa', label: 'Mi Empresa', icon: 'handshake' },
      { id: 'productos', label: 'Productos y Servicios', icon: 'cart', n: prods },
      { id: 'promos', label: 'Promociones', icon: 'flame', n: promosOn },
      { id: 'popups', label: 'Pop-ups', icon: 'message', n: popsOn },
      { id: 'solicitudes', label: 'Solicitudes', icon: 'receipt', n: by('pendiente'), hot: by('pendiente') > 0 },
      { id: 'cotizaciones', label: 'Cotizaciones', icon: 'doc' },
      { id: 'stats', label: 'Estadísticas', icon: 'chart' },
      { id: 'notifs', label: 'Notificaciones', icon: 'bell' },
      { id: 'bitacora', label: 'Bitácora', icon: 'doc' },
    ];
    const secTitle = (t) => React.createElement('div', { style: { fontSize: 12.5, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.07em', margin: '2px 0 11px' } }, t);

    return React.createElement('div', null,
      CoHeader({ title: co.name, sub: 'Plan ' + plan.name + ' · Convenio ' + co.convenioStatus, co }),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 16 } },

        // ── suscripción: la tarjeta que da confianza al pagar ──
        React.createElement('div', { style: { background: 'linear-gradient(145deg,#1b2c52,#14213d)', color: '#fff', borderRadius: 20, padding: '18px 18px 16px', marginBottom: 18, position: 'relative', overflow: 'hidden' } },
          React.createElement('div', { style: { position: 'absolute', right: -34, top: -34, opacity: .08 } }, React.createElement(window.SutiSeal, { size: 160 })),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' } },
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 11, opacity: .65, fontWeight: 800, letterSpacing: '.1em' } }, 'PLAN CONTRATADO'),
              React.createElement('div', { style: { fontSize: 24, fontWeight: 900, marginTop: 3, letterSpacing: '-.02em' } }, plan.name),
              (plan.precioMensual || plan.precioAnual) ? React.createElement('div', { style: { fontSize: 12, fontWeight: 700, opacity: .8, marginTop: 4 } }, (co.billing === 'mensual' ? window.money(plan.precioMensual || 0) + ' al mes · ciclo mensual' : window.money(plan.precioAnual || 0) + ' al año · ciclo anual')) : null),
            React.createElement('span', { style: { fontSize: 11.5, fontWeight: 800, padding: '6px 13px', borderRadius: 999, background: ssMap[2], color: ssMap[1], border: '1px solid ' + ssMap[2] } }, ssMap[0])),
          // vigencia con barra de progreso
          React.createElement('div', { style: { marginTop: 16, position: 'relative' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 700, opacity: .75, marginBottom: 6 } },
              React.createElement('span', null, fmtDate(co.subStart)),
              React.createElement('span', { style: { color: ssMap[1], opacity: 1 } }, !hasDates?'Vigencia pendiente':daysLeft > 0 ? daysLeft + ' días restantes' : 'Vencida'),
              React.createElement('span', null, fmtDate(co.subEnd))),
            React.createElement('div', { style: { height: 7, borderRadius: 999, background: 'rgba(255,255,255,.14)', overflow: 'hidden' } },
              React.createElement('div', { style: { height: '100%', width: (pct * 100).toFixed(1) + '%', borderRadius: 999, background: 'linear-gradient(90deg,' + ssMap[1] + 'bb,' + ssMap[1] + ')' } }))),
          // qué incluye tu plan (uso real, no promesas)
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 15, position: 'relative' } },
            [['cart', prods + ' de ' + plan.maxProductos, 'productos publicados'], ['message', plan.popups ? popsOn + ' activo(s)' : 'No incluido', 'pop-ups en la app'], ['shield', 'Vigente', 'convenio sindical']].map((f, i) =>
              React.createElement('div', { key: i, style: { flex: 1, background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 13, padding: '9px 10px' } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800 } }, React.createElement(I, { name: f[0], size: 14, stroke: 2.2 }), f[1]),
                React.createElement('div', { style: { fontSize: 10, fontWeight: 600, opacity: .65, marginTop: 2, lineHeight: 1.25 } }, f[2])))),
          ss !== 'activo' && React.createElement('button', { onClick: () => app.toast('Un asesor del sindicato te contactará para renovar.'), style: { position: 'relative', marginTop: 14, width: '100%', height: 44, borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: '#fff', color: '#14213d' } }, 'Renovar suscripción')),

        // ── requieren tu atención ──
        attn.length > 0 && React.createElement('div', { style: { marginBottom: 18 } },
          secTitle('REQUIEREN TU ATENCIÓN'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 9 } },
            attn.map((a, i) => React.createElement('button', { key: i, onClick: () => onOpen(a.go), className: 'su-press', style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: 'none', borderRadius: 15, padding: '12px 13px', boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
              React.createElement('div', { style: { width: 38, height: 38, borderRadius: 11, background: a.bg, color: a.tone, display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: a.icon, size: 19, stroke: 2 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 } }, a.t),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, a.s)),
              React.createElement(I, { name: 'chevR', size: 17, stroke: 2.2, style: { color: 'var(--ink-3)', flexShrink: 0 } })))),
        ),

        // ── rendimiento: 4 indicadores medibles, con contexto ──
        secTitle('RENDIMIENTO DE TU CONVENIO'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 } },
          perf.map((k, i) => React.createElement('div', { key: i, style: { background: 'var(--surface)', borderRadius: 17, padding: '14px 15px', boxShadow: 'var(--neo-sm)' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
              React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: k.icon, size: 16, stroke: 2 })),
              React.createElement('span', { style: { fontSize: 26, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' } }, k.val)),
            React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.2 } }, k.label),
            React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.3 } }, k.sub)))),
        React.createElement('button', { onClick: () => onOpen('stats'), style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, color: 'var(--guinda)', padding: '8px 0', marginBottom: 12 } }, 'Ver estadísticas completas', React.createElement(I, { name: 'arrowR', size: 15, stroke: 2.4 })),

        // ── solicitudes: resumen operativo en una sola tarjeta ──
        secTitle('SOLICITUDES VÍA NÓMINA'),
        React.createElement('button', { onClick: () => onOpen('solicitudes'), className: 'su-press', style: { display: 'block', width: '100%', background: 'var(--surface)', border: 'none', borderRadius: 17, padding: '14px 15px', boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 18 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
            React.createElement('span', { style: { fontSize: 26, fontWeight: 900, letterSpacing: '-.03em', color: 'var(--ink)' } }, sols.length),
            React.createElement('span', { style: { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' } }, 'recibidas en total'),
            React.createElement(I, { name: 'chevR', size: 17, stroke: 2.2, style: { color: 'var(--ink-3)', marginLeft: 'auto' } })),
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 11 } },
            [['Pendientes', by('pendiente'), '#9A6B16', '#FFF3DC'], ['Aprobadas', by('aprobada'), '#13794A', '#E7F6ED'], ['Rechazadas', by('rechazada'), '#C0341D', '#FDEAEA']].map((s) =>
              React.createElement('div', { key: s[0], style: { flex: 1, background: s[3], borderRadius: 11, padding: '8px 10px' } },
                React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: s[2] } }, s[1]),
                React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: s[2], opacity: .85 } }, s[0])))),
        ),

        // ── módulos ──
        secTitle('GESTIÓN'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
          modules.map((m) => React.createElement('button', { key: m.id, onClick: () => onOpen(m.id), style: { position: 'relative', display: 'flex', alignItems: 'center', gap: 11, background: 'var(--surface)', border: 'none', borderRadius: 16, padding: '14px 14px', boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
            React.createElement('div', { style: { width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(145deg,#1b2c52,#14213d)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 20, stroke: 2 })),
            React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.15 } }, m.label),
            m.n > 0 && React.createElement('span', { style: { position: 'absolute', top: 9, right: 9, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, display: 'inline-grid', placeItems: 'center', fontSize: 10.5, fontWeight: 900, background: m.hot ? '#FFF3DC' : 'var(--surface-2)', color: m.hot ? '#9A6B16' : 'var(--ink-3)' } }, m.n)))),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 20, lineHeight: 1.5 } },
          React.createElement(I, { name: 'lock', size: 13, stroke: 2 }), 'Solo ves información de tu empresa. Todas las acciones quedan registradas en la bitácora.')));
  }

  window.CompanyScreen = CompanyScreen;
  window.CoHeaderEl = CoHeader; // reutilizado por los módulos
})();
