/* app.jsx — SutiApp shell: router, TopBar, bottom nav, notifications, tweaks */
(function () {
  const { useState, useCallback, useEffect } = React;
  const I = window.Icon, D = () => window.DATA;
  // Porción del store financiero que consume esta pantalla. Estable por
  // identidad: `status` y `overview` no cambian al recotizar.
  const overviewSlice = (snapshot) => ({ status: snapshot.status, overview: snapshot.overview });

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "heroVariant": "aurora",
    "primary": "#910022",
    "a11y": false,
    "showBalance": true,
    "showPromo": true,
    "qaMotion": "system",
    "qaSpatial": "420"
  }/*EDITMODE-END*/;

  // ---------- TOP BAR (gradient header + white sheet lip) ----------
  function frostBtn(icon, onClick, badge) {
    return React.createElement('button', { onClick, style: { position: 'relative', width: 44, height: 44, borderRadius: 15, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' } },
      React.createElement(I, { name: icon, size: 22, stroke: 2 }),
      badge > 0 && React.createElement('span', { style: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: '#fff', color: 'var(--guinda)', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.2)' } }, badge));
  }

  // the white sheet lip with a subtle centered notch (fluid form)
  function sheetLip() {
    return React.createElement('div', { style: { position: 'relative', height: 26, background: 'var(--bg)', borderRadius: '28px 28px 0 0', marginTop: 18 } },
      React.createElement('div', { style: { position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 40, height: 5, borderRadius: 999, background: 'var(--hairline-strong)' } }));
  }

  function TopBar({ app, variant }) {
    const u = app.user;
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    // Selector: el TopBar sólo depende de status/overview. Una cotización
    // nueva no debe re-renderizar el encabezado ni sus drivers de scroll.
    const financial = window.useFinancialLegacy ? window.useFinancialLegacy(overviewSlice) : { status: 'error', overview: null };
    const [homeFinancialUser, setHomeFinancialUser] = React.useState(null);
    React.useEffect(() => {
      if (variant !== 'home' || !window.financialLegacyStore) return undefined;
      let active = true;
      setHomeFinancialUser(null);
      window.financialLegacyStore.ensureLoanSession().then(() => { if (active) setHomeFinancialUser(u.id); });
      return () => { active = false; };
    }, [variant, u.id]);
    const availableCredit = homeFinancialUser === u.id && financial.status === 'ready' && window.FinancialLegacyRepository &&
      typeof window.FinancialLegacyRepository.availableCreditTotal === 'function'
      ? window.FinancialLegacyRepository.availableCreditTotal(financial.overview) : null;
    const availableCreditReady = availableCredit !== null;
    const unread = D().notifs.filter((n) => n.unread).length + (qs ? qs.readyUnseen().length : 0);
    const titles = { financiera: 'Mi Financiera', convenios: 'Convenios', historial: 'Mi Historial', credencial: 'Mi Credencial' };
    const subtitles = { financiera: 'Tu dinero, tu sindicato', convenios: 'Descuentos para afiliados', historial: 'Seguimiento de solicitudes', credencial: 'Identidad sindical digital' };

    // M2.2 · Collapsing header ligado al scroll (Motion System · B).
    // El header es sticky y se traslada hacia arriba; la fila superior se
    // contra-traslada para quedar fija, y el saludo/los chips se contraen.
    // Todo con transform/opacity: cero layout durante el scroll. Reversible
    // porque el progreso lo dicta la posición, no un breakpoint.
    const barRef = React.useRef(null);
    const riseRef = React.useRef(null);   // fila superior (marca + acciones)
    const fadeRef = React.useRef(null);   // saludo / subtítulo
    const chipsRef = React.useRef(null);  // chips de balance
    const sealRef = React.useRef(null);   // sello decorativo (parallax)
    const imageRef = React.useRef(null);  // foto administrable revelada al colapsar
    const collapsedHeader = window.useAsset('home.header.collapsed');
    const TRAVEL = variant === 'home' ? 92 : 34;
    if (window.useScrollDriver) window.useScrollDriver(barRef, (y) => {
      const M = window.MOTION;
      const p = M.progress(y, TRAVEL + 40);
      const up = -TRAVEL * p;
      if (barRef.current) barRef.current.style.transform = 'translate3d(0,' + up + 'px,0)';
      if (riseRef.current) riseRef.current.style.transform = 'translate3d(0,' + (-up) + 'px,0)';
      if (fadeRef.current) {
        fadeRef.current.style.opacity = String(1 - Math.min(1, p * 1.35));
        fadeRef.current.style.transform = 'translate3d(0,' + (-10 * p) + 'px,0) scale(' + (1 - 0.1 * p) + ')';
      }
      if (chipsRef.current) {
        chipsRef.current.style.opacity = String(1 - Math.min(1, p * 1.6));
        chipsRef.current.style.transform = 'translate3d(0,' + (-14 * p) + 'px,0) scale(' + (1 - 0.06 * p) + ')';
      }
      if (imageRef.current) {
        const reveal = Math.max(0, Math.min(1, (p - .35) / .65));
        imageRef.current.style.opacity = String(reveal);
        imageRef.current.style.transform = 'translate3d(0,' + (TRAVEL * .55 * p) + 'px,0) scale(' + (1.08 - .08 * p) + ')';
      }
      if (sealRef.current) sealRef.current.style.transform = 'translate3d(0,' + (14 * p) + 'px,0)';
    }, [variant]);
    const stick = { position: 'sticky', top: 0, zIndex: 6, willChange: 'transform' };

    if (variant === 'home') {
      return React.createElement('div', { ref: barRef, style: Object.assign({ background: 'var(--header-bg, var(--grad-guinda))', color: '#fff', padding: '4px 18px 0', position: 'relative', overflow: 'hidden' }, stick) },
        collapsedHeader&&collapsedHeader.kind==='image'
          ? React.createElement('img', { ref:imageRef,src:collapsedHeader.url,alt:'','aria-hidden':'true','data-home-header-resource':'home.header.collapsed',style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'50% 32%',display:'block',pointerEvents:'none',opacity:0,transform:'translate3d(0,0,0) scale(1.08)',transformOrigin:'50% 32%',willChange:'transform, opacity',zIndex:0} })
          : React.createElement('div', { ref:imageRef,'aria-hidden':'true','data-home-header-resource':'home.header.collapsed','data-home-header-fallback':'icon',style:{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none',opacity:0,transform:'translate3d(0,0,0) scale(1.08)',transformOrigin:'50% 32%',willChange:'transform, opacity',zIndex:0} },React.createElement(I,{name:(collapsedHeader&&collapsedHeader.icon)||'image',size:58})),
        React.createElement('div', { ref: sealRef, style: { position: 'absolute', right: -50, top: -40, opacity: .14, zIndex:1 } }, React.createElement(window.SutiSeal, { size: 200 })),
        // controls row
        React.createElement('div', { ref: riseRef, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', willChange: 'transform', zIndex:2 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11 } },
            React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 16px -6px rgba(0,0,0,.4)' } }, React.createElement(window.SutiSeal, { size: 40 })),
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 16, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.05 } }, 'SUTISSSTESON'),
              React.createElement('div', { style: { fontSize: 11.5, opacity: .82, fontWeight: 600, marginTop: 2 } }, 'SutiApp · Súper app sindical'))),
          React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
            frostBtn('bell', () => app.push('notifs'), unread),
            React.createElement('button', { onClick: () => app.push('perfil'), style: { border: '2px solid rgba(255,255,255,.45)', borderRadius: '50%', background: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 } }, React.createElement(window.Avatar, { name: u.name, src: u.photoUrl || undefined, size: 44, tone: 'var(--guinda)', 'data-profile-photo-consumer': 'header' })))),
        // greeting + balance
        React.createElement('div', { style: { position: 'relative', marginTop: 18, zIndex:2 } },
          React.createElement('div', { ref: fadeRef, style: { willChange: 'transform, opacity', transformOrigin: '0 50%' } },
            React.createElement('div', { style: { fontSize: 14.5, opacity: .85, fontWeight: 600 } }, saludoHome() + ','),
            React.createElement('div', { 'data-affiliate-field': 'topbar-name', style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', marginTop: 1 } }, u.short)),
          React.createElement('div', { ref: chipsRef, 'data-home-financial-chips': 'partial', 'data-home-credit-state': availableCreditReady ? 'ready' : financial.status === 'error' ? 'error' : 'loading', 'data-home-savings-state': 'pending-source', style: { display: 'flex', gap: 11, marginTop: 16, willChange: 'transform, opacity', transformOrigin: '50% 0' } },
            balChip('Crédito disponible', availableCreditReady ? window.money(availableCredit) : '—', 'cash'),
            balChip('Mi ahorro', '—', 'piggy'))),
        sheetLip());
    }

    // other tabs: gradient header with title + bell + sheet lip
    return React.createElement('div', { ref: barRef, style: Object.assign({ background: 'var(--header-bg, var(--grad-guinda))', color: '#fff', padding: '6px 18px 0', position: 'relative', overflow: 'hidden' }, stick) },
      React.createElement('div', { ref: sealRef, style: { position: 'absolute', right: -46, top: -46, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 180 })),
      React.createElement('div', { ref: riseRef, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', willChange: 'transform' } },
        React.createElement('div', null,
          React.createElement('h1', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', margin: 0 } }, titles[variant]),
          React.createElement('div', { ref: fadeRef, style: { fontSize: 13, opacity: .82, fontWeight: 600, marginTop: 3, willChange: 'transform, opacity', transformOrigin: '0 50%' } }, subtitles[variant])),
        frostBtn('bell', () => app.push('notifs'), unread)),
      sheetLip());
  }
  function balChip(label, val, icon) {
    return React.createElement('div', { key: label, style: { flex: 1, minWidth: 0, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 18, padding: '12px 14px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 'clamp(10.5px, 3vw, 11.5px)', opacity: .9, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
        React.createElement(I, { name: icon, size: 14, stroke: 2, style: { flexShrink: 0 } }), label),
      React.createElement('div', { style: { fontSize: 'clamp(17px, 5.4vw, 21px)', fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em', whiteSpace: 'nowrap' } }, val));
  }
  function saludoHome() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }
  window.TopBar = TopBar;

  // ---------- BOTTOM NAV ----------
  const TABS = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'financiera', label: 'Finanzas', icon: 'wallet' },
    { id: 'convenios', label: 'Convenios', icon: 'tag' },
    { id: 'historial', label: 'Historial', icon: 'receipt' },
    { id: 'credencial', label: 'Credencial', icon: 'idcard' },
    { id: 'admin', label: 'Admin', icon: 'shield' },
  ];
  // Indicador único que VIAJA entre pestañas (M3 · shell). El fondo guinda ya no
  // vive en cada botón: es un solo objeto medido tras el commit y desplazado con
  // transform. Los botones solo interpolan color.
  function BottomNav({ tab, setTab, adminOnly }) {
    const as = window.adminStore;
    const tabs = adminOnly ? TABS.filter((t) => t.id === 'admin') : (as ? TABS.filter((t) => t.id === 'admin' || !as.tabHidden(t.id)) : TABS);
    const wrapRef = React.useRef(null);
    const boxes = React.useRef({});
    const indRef = React.useRef(null);
    const firstRef = React.useRef(true);
    React.useLayoutEffect(() => {
      const wrap = wrapRef.current, ind = indRef.current, box = boxes.current[tab];
      if (!wrap || !ind) return;
      if (!box) { ind.style.opacity = '0'; return; }
      const w = wrap.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (!b.width) return;
      const to = 'translate(' + Math.round(b.left - w.left) + 'px,' + Math.round(b.top - w.top) + 'px)';
      const from = ind.style.transform;
      ind.style.opacity = '1';
      ind.style.width = Math.round(b.width) + 'px';
      ind.style.height = Math.round(b.height) + 'px';
      ind.style.transform = to;
      const M = window.MOTION;
      if (firstRef.current || !from || !M || M.reduced() || M.frozen()) { firstRef.current = false; return; }
      M.animate(ind, [{ transform: from }, { transform: to }], { duration: M.dur.emphasized, easing: M.ease.emphasized, fill: 'none' });
      const icon = box.firstChild;
      if (icon) M.animate(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: M.dur.emphasized, easing: M.ease.standard, fill: 'none' });
    }, [tab, tabs.length]);
    return React.createElement('div', { ref: wrapRef, 'data-app-bottom-nav':'true', style: { flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', background: 'var(--surface)', padding: '10px 8px calc(10px + env(safe-area-inset-bottom))', borderRadius: '26px 26px 0 0', boxShadow: '0 -10px 30px -12px rgba(20,33,61,.18)' } },
      React.createElement('div', { ref: indRef, 'aria-hidden': 'true', style: { position: 'absolute', left: 0, top: 0, width: 46, height: 46, borderRadius: 16, background: 'var(--grad-guinda-soft)', boxShadow: 'var(--glow-guinda)', border: '3px solid var(--surface)', opacity: 0, pointerEvents: 'none', zIndex: 0, willChange: 'transform' } }),
      tabs.map((t) => {
        const active = tab === t.id;
        return React.createElement('button', { key: t.id, onClick: () => setTab(t.id), style: { position: 'relative', zIndex: 1, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 } },
          React.createElement('div', { ref: (el) => { boxes.current[t.id] = el; }, style: {
            display: 'grid', placeItems: 'center', width: active ? 46 : 40, height: active ? 46 : 40,
            borderRadius: active ? 16 : 14,
            marginTop: active ? -22 : 0,
            color: active ? '#fff' : 'var(--ink-3)',
            transition: 'color .18s linear',
          } },
            React.createElement(window.Res, { resKey: 'nav.' + t.id, size: active ? 24 : 23, stroke: active ? 2.2 : 1.9 })),
          React.createElement('span', { style: { maxWidth: '100%', fontSize: 'clamp(8.5px, 2.8vw, 10.5px)', fontWeight: active ? 700 : 500, color: active ? 'var(--guinda)' : 'var(--ink-3)', transition: 'color .2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.label));
      }));
  }

  // ---------- NOTIFICATIONS ----------
  function NotifsScreen({ app }) {
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    // Notificaciones derivadas del flujo de cotización previa
    const quoteNotifs = (qs ? qs.mine() : []).map((r) => (r.estado === 'cotizada'
      ? { id: 'q_' + r.id, icon: 'cash', tone: 'green', title: 'Tu cotización está lista', body: r.productoNombre + ' · ' + window.money((r.cotizacion || {}).monto || 0) + ' · ' + r.folio + '. Ya puedes simular tu financiamiento.', time: (r.cotizacion || {}).fechaHora || r.fechaHora, unread: !r.visto, go: () => { qs.markVisto(r.id); app.push('product', { id: r.productoId }); } }
      : { id: 'q_' + r.id, icon: 'clock', tone: 'amber', title: 'Cotización en proceso', body: r.productoNombre + ' · ' + r.folio + ' · ' + (r.empresaNombre || 'Área de Finanzas'), time: r.fechaHora, unread: false }));
    const items = [...quoteNotifs, ...D().notifs];
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: app.back, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 16.5, fontWeight: 800 } }, 'Notificaciones')),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
          items.map((n) => {
            const tones = { guinda: ['var(--guinda-50)', 'var(--guinda)'], green: ['#E7F6ED', '#13794A'], amber: ['#FFF3DC', '#9A6B16'], blue: ['#E8F0FE', '#2456C7'], red: ['#FDEAEA', '#C0341D'] }[n.tone];
            return React.createElement('div', { key: n.id, onClick: n.go, className: n.go ? 'su-press' : '', style: { display: 'flex', gap: 13, background: 'var(--surface)', borderRadius: 16, padding: 14, boxShadow: 'var(--neo-sm)', position: 'relative', cursor: n.go ? 'pointer' : 'default' } },
              React.createElement('div', { style: { width: 44, height: 44, borderRadius: 13, background: tones[0], color: tones[1], display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: n.icon, size: 23, stroke: 2 })),
              React.createElement('div', { style: { flex: 1 } },
                React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, color: 'var(--ink)' } }, n.title),
                React.createElement('div', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 3, lineHeight: 1.4 } }, n.body),
                React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 6 } }, n.time)),
              n.unread && React.createElement('div', { style: { position: 'absolute', top: 14, right: 14, width: 9, height: 9, borderRadius: '50%', background: 'var(--guinda)' } }));
          }))),
    );
  }

  // ---------- PERFIL ----------
  function PerfilScreen({ app }) {
    const u = app.user;
    const rows = [
      { icon: 'idcard', label: 'Mi credencial digital', go: () => { app.back(); app.setTab('credencial'); } },
      { icon: 'upload', label: 'Mis documentos', go: () => { app.back(); app.push('documentos'); } },
      { icon: 'receipt', label: 'Mis solicitudes', go: () => { app.back(); app.setTab('historial'); } },
      { icon: 'headset', label: 'Ayuda y soporte', go: () => app.toast('Conectando con soporte…') },
      { icon: 'settings', label: 'Configuración', go: () => app.toast('Próximamente') },
    ];
    const facts = [
      ['Correo histórico', u.email], ['Teléfono', u.phone], ['Ciudad', u.city],
      ['Unidad', u.unit], ['Puesto', u.position], ['Categoría', u.category],
      ['Afiliación', u.affiliation], ['Estatus', u.status],
    ];
    return React.createElement('div', { 'data-affiliate-id': u.id, style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { 'data-h006': 'profile-back', onClick: app.back, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 16.5, fontWeight: 800 } }, 'Mi Perfil')),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: 20 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' } },
          React.createElement('div', { style: { position: 'relative', borderRadius: '50%' } },
            React.createElement(window.Avatar, { name: u.name, src: u.photoUrl || undefined, size: 84, 'data-profile-photo-consumer': 'profile' })),
          React.createElement('div', { 'data-affiliate-field': 'profile-name', style: { fontSize: 21, fontWeight: 800, marginTop: 12 } }, u.name),
          React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } }, u.seccion),
          React.createElement('div', { 'data-affiliate-field': 'profile-control', style: { marginTop: 10 } }, React.createElement(window.Badge, { tone: 'green', icon: 'checkCircle' }, u.status + ' · ' + u.numeroControl))),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 } },
          facts.map((f) => React.createElement('div', { key: f[0], style: { background: 'var(--surface)', borderRadius: 14, padding: 12, boxShadow: 'var(--neo-sm)', minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 } }, f[0]),
            React.createElement('div', { 'data-affiliate-field': f[0] === 'Correo histórico' ? 'profile-email' : undefined, style: { fontSize: 13, color: 'var(--ink)', fontWeight: 700, marginTop: 4, overflowWrap: 'anywhere' } }, f[1])))),
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, marginTop: 22, overflow: 'hidden', boxShadow: 'var(--neo-sm)' } },
          rows.map((r, i) => React.createElement('button', { key: r.label, onClick: r.go, style: { display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '15px 16px', background: 'none', border: 'none', borderBottom: i < rows.length - 1 ? '1px solid var(--hairline)' : 'none', cursor: 'pointer', textAlign: 'left' } },
            React.createElement('div', { style: { width: 38, height: 38, borderRadius: 11, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', color: 'var(--guinda)' } }, React.createElement(I, { name: r.icon, size: 20, stroke: 2 })),
            React.createElement('span', { style: { flex: 1, fontSize: 15, fontWeight: 700 } }, r.label),
            React.createElement(I, { name: 'chevR', size: 19, stroke: 2, style: { color: 'var(--ink-3)' } })))),
        React.createElement(window.Btn, { full: true, variant: 'outline', icon: 'logout', style: { marginTop: 18 }, onClick: app.logout }, 'Cerrar sesión')),
    );
  }

  // ---------- TOAST ----------
  // Toast con presencia real (M3): entrada spring desde abajo, barra de vida del
  // auto-dismiss y salida hacia abajo. El mensaje se retiene mientras sale.
  function Toast({ msg }) {
    const [shown, setShown] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      if (msg) {
        setShown(msg);
        const r = requestAnimationFrame(() => setOpen(true));
        return () => cancelAnimationFrame(r);
      }
      setOpen(false);
      const t = setTimeout(() => setShown(null), 200);
      return () => clearTimeout(t);
    }, [msg]);
    if (!shown) return null;
    const M = window.MOTION;
    const red = !!(M && M.reduced());
    return React.createElement('div', { style: { position: 'absolute', left: 20, right: 20, bottom: 92, zIndex: 80, display: 'flex', justifyContent: 'center', pointerEvents: 'none' } },
      React.createElement('div', { style: {
        position: 'relative', overflow: 'hidden', background: 'var(--ink)', color: '#fff', padding: '13px 18px 15px', borderRadius: 14, fontSize: 14, fontWeight: 700,
        boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 9, maxWidth: '100%',
        opacity: open ? 1 : 0,
        transform: red ? 'none' : (open ? 'translateY(0) scale(1)' : 'translateY(16px) scale(.96)'),
        transition: red ? 'opacity 140ms linear' : 'transform 320ms cubic-bezier(.34,1.56,.64,1), opacity 160ms linear',
        willChange: 'transform',
      } },
        React.createElement(I, { name: 'checkCircle', size: 19, stroke: 2.2, style: { color: '#6fe0a0', flexShrink: 0 } }),
        React.createElement('span', null, shown),
        React.createElement('div', { 'aria-hidden': 'true', style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,.28)', transformOrigin: 'left center', transform: 'scaleX(' + (open ? 0 : 1) + ')', transition: open ? 'transform 2600ms linear' : 'none' } })));
  }

  // ---------- ROOT APP ----------
  function ImpersonationBanner({ auth, onLoan }) {
    const context=auth.impersonation;
    const [busy,setBusy]=useState(false);
    if(!context)return null;
    const stop=async()=>{setBusy(true);try{await window.AdminRepository.stopImpersonation();}finally{setBusy(false);}};
    return React.createElement('div',{'data-impersonation-active':'true',role:'status',style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 13px',background:'#FFF4D8',color:'#6B4700',borderBottom:'1px solid #E7C96B',fontSize:12,fontWeight:800,zIndex:60}},
      React.createElement('span',null,'Contexto de afiliado activo · actor real auditado'),
      React.createElement('div',{style:{display:'flex',gap:6,alignItems:'center'}},
        React.createElement('button',{type:'button',onClick:onLoan,disabled:busy,'data-assisted-loan-cta':'',style:{border:'none',borderRadius:9,padding:'7px 10px',background:'var(--guinda)',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:850,cursor:'pointer'}},'Solicitar préstamo'),
        React.createElement('button',{type:'button',onClick:stop,disabled:busy,style:{border:'none',borderRadius:9,padding:'7px 10px',background:'#6B4700',color:'#fff',fontFamily:'inherit',fontSize:11,fontWeight:850,cursor:'pointer'}},busy?'Cerrando…':'Salir')));
  }

  function App({ auth }) {
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const institutional = window.useInstitutionalContent();
    const visual = window.useVisualContent();
    const editorial = window.useEditorialContent();
    const admin = window.useAdminAuth();
    if (window.useAdminStore) window.useAdminStore();   // re-render al cambiar accesos de pantalla
    const [tab, setTabState] = useState(auth.affiliateView ? 'home' : 'admin');
    const [stack, setStack] = useState([]); // [{name, params}]
    const [toast, setToast] = useState(null);
    const [popupItems, setPopupItems] = useState(null);   // pop-ups administrables mostrándose
    const [outgoing, setOutgoing] = useState(null);       // ruta saliendo (capa de presencia · A)
    const outIdRef = React.useRef(0);
    const shownRef = React.useRef(new Set());             // pantallas ya mostradas esta sesión

    useEffect(() => {
      const el = document.documentElement;
      const p = t.primary;
      const mix = (pct, c) => `color-mix(in srgb, ${p} ${pct}%, ${c})`;
      el.style.setProperty('--guinda', p);
      el.style.setProperty('--grad-guinda', `linear-gradient(150deg, ${mix(60, '#ffffff')} 0%, ${p} 52%, ${mix(80, '#000000')} 100%)`);
      el.style.setProperty('--grad-guinda-soft', `linear-gradient(145deg, ${mix(80, '#ffffff')}, ${p})`);
      el.style.setProperty('--glow-guinda', `0 10px 26px -6px ${mix(55, 'transparent')}, 0 4px 10px -2px ${mix(42, 'transparent')}`);
      // header style
      const headers = {
        aurora: `linear-gradient(150deg, ${mix(58, '#ffffff')} 0%, ${p} 50%, ${mix(82, '#000000')} 100%)`,
        solid: `linear-gradient(180deg, ${mix(90, '#ffffff')}, ${p})`,
        coral: `linear-gradient(150deg, ${mix(45, '#ffffff')} 0%, ${p} 60%, ${mix(85, '#000000')} 100%)`,
      };
      el.style.setProperty('--header-bg', headers[t.heroVariant] || headers.aurora);
    }, [t.primary, t.heroVariant]);

    // ---- Capa de presencia de rutas (Motion System · A) ----
    // popOne() es el ÚNICO camino de salida de una ruta apilada: retiene la
    // pantalla saliente el tiempo de su animación y luego la desmonta. La API
    // pública (push/back/setTab) no cambia de firma ni de semántica.
    const navRef = React.useRef(null);
    const popOne = useCallback(() => {
      const st = (navRef.current && navRef.current.stack) || [];
      if (!st.length) return;
      const leaving = st[st.length - 1];
      setOutgoing({ name: leaving.name, params: leaving.params, depth: st.length, id: ++outIdRef.current });
      setStack((s) => s.slice(0, -1));
    }, []);
    // QA / DEV ONLY · override de movimiento y duración espacial (por defecto
    // 'system' / 480 = comportamiento real). Se retira borrando este efecto y
    // la sección «QA de movimiento» del panel de Tweaks.
    useEffect(() => {
      if (!window.MOTION) return;
      window.MOTION.qa.setReduced(t.qaMotion);
      window.MOTION.qa.setSpatial(Number(t.qaSpatial) || 420);
    }, [t.qaMotion, t.qaSpatial]);

    const push = useCallback((name, params = {}) => { setOutgoing(null); setStack((s) => [...s, { name, params }]); }, []);
    const back = useCallback(() => popOne(), [popOne]);
    const setTab = useCallback((id) => { setOutgoing(null); if (window.MOTION) window.MOTION.shared.clear(); setStack([]); setTabState(id); }, []);
    const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); }, []);
  const openFinanceItem = useCallback((id) => { if (id === 'prestamo') return push('loan'); if (id === 'terrenos') return push('terreno'); push('product', { id }); }, [push]);

    const app = { push, back, setTab, toast: showToast, openFinanceItem, logout: auth.signOut, affiliate: auth.affiliate, user: auth.affiliateView, institutional, visual, editorial, admin };

    // ---- Botón Atrás del dispositivo (Android/PWA) ----
    // Modelo: se mantiene siempre una entrada "trampa" en el historial. Al presionar
    // Atrás se consume esa entrada; si hay a dónde retroceder dentro de la app
    // (pop-up → pantalla apilada → tab ≠ home) se retrocede y se re-arma la trampa.
    // Sólo en Inicio, con la pila vacía, se deja salir (cierra la app).
    navRef.current = { stack, tab, popupItems, defaultTab: auth.affiliateView ? 'home' : 'admin' };
    useEffect(() => {
      history.pushState({ sut: 1 }, '');
      const onPop = () => {
        const { stack, tab, popupItems, defaultTab } = navRef.current;
        if (popupItems) {
          setPopupItems(null);
          history.pushState({ sut: 1 }, '');
        } else if (stack.length > 0) {
          popOne();
          history.pushState({ sut: 1 }, '');
        } else if (tab !== defaultTab) {
          setTabState(defaultTab);
          history.pushState({ sut: 1 }, '');
        } else {
          history.back(); // Pantalla principal: permitir salir de la app
        }
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, [popOne]);

    // ---- Pop-ups productivos H-007.2 (globales; sin segmentación inventada) ----
    const top0 = stack[stack.length - 1];
    const currentScreen = top0 ? top0.name : tab;
    useEffect(() => { if (window.LiveText) window.LiveText.setScope(currentScreen); }, [currentScreen]);
    useEffect(() => {
      if (!t.showPromo || tab === 'admin') return;
      // E·#2: el pop-up pertenece a la pantalla ENTRANTE. Mientras una ruta siga
      // saliendo no se programa ni se marca como mostrada; el efecto se repite al
      // terminar la salida. Sin transición saliente no añade latencia alguna.
      if (outgoing) return;
      if (currentScreen !== 'home' || visual.phase !== 'loaded') return;
      if (shownRef.current.has(currentScreen)) return;
      const list = visual.popups || [];
      if (!list.length) return;
      shownRef.current.add(currentScreen);
      const tm = setTimeout(() => setPopupItems(list), currentScreen === 'home' ? 1100 : 480);
      return () => clearTimeout(tm);
    }, [currentScreen, t.showPromo, outgoing && outgoing.id, visual.phase, visual.popups]);

    // tab screen (bloqueo de pantalla completa desde el panel)
    const gate = (id) => (window.adminStore ? window.adminStore.screenAllowed(id) : true);
    const tabAllowed = tab === 'admin' || gate(tab);
    const tabScreen = {
      home: window.HomeScreen, financiera: window.FinancieraScreen, convenios: window.ConveniosScreen,
      historial: window.HistorialScreen, credencial: window.CredencialScreen, admin: window.AdminScreen,
    }[tab];

    // pushed screen
    const top = stack[stack.length - 1];
    const ROUTES = {
      loan: window.LoanScreen, product: window.ProductScreen, modulo: window.ModuloScreen,
      articulo: window.ArticuloScreen, convenio: window.ConvenioDetail, tracking: window.TrackingScreen,
      catitem: window.CatalogItemScreen,
      documentos: window.DocumentosScreen, membership: window.MembershipApplicationScreen, notifs: NotifsScreen, perfil: PerfilScreen, terreno: window.TerrenoScreen,
    };
    const PushedScreen = top ? ROUTES[top.name] : null;
    const pushAllowed = !top || gate(top.name) || (top.name === 'loan' && !!auth.impersonation);

    // Capas de ruta: la vigente y, mientras dure su salida, la que se va.
    // Cada capa conserva su key por profundidad, así que la que sale NO se
    // vuelve a montar: es el mismo DOM (mantiene scroll y estado interno).
    const inNode = React.useRef(null);
    const outNode = React.useRef(null);
    const layers = [];
    if (PushedScreen) layers.push({ key: 'r' + stack.length, depth: stack.length, Comp: PushedScreen, params: top.params, name: top.name, out: false });
    if (outgoing && outgoing.depth !== stack.length && ROUTES[outgoing.name]) {
      layers.push({ key: 'r' + outgoing.depth, depth: outgoing.depth, Comp: ROUTES[outgoing.name], params: outgoing.params, name: outgoing.name, out: true });
    }
    layers.sort((a, b) => a.depth - b.depth);

    // Entrada: si hay un shared element capturado, el héroe conduce el viaje y
    // se omite el rise genérico para que no compitan dos transforms.
    const sharedPending = !!(window.MOTION && window.MOTION.shared.pending());
    React.useLayoutEffect(() => {
      if (!window.MOTION || !inNode.current) return;
      window.MOTION.shared.claimIn(inNode.current);
    }, [stack.length, top && top.name]);

    // Salida: el héroe regresa a la geometría de origen; si no hay shared, la
    // capa se atenúa. Al terminar (o si otra navegación la reemplaza) se limpia.
    React.useLayoutEffect(() => {
      if (!outgoing) return;
      const M = window.MOTION;
      const node = outNode.current;
      // Sin animación posible (documento congelado, movimiento reducido o sin
      // Motion System) no hay nada que retener: se desmonta de inmediato. Así
      // una transición nunca puede quedar pendiente ni dejar una capa fantasma.
      if (!M || !node || M.frozen() || M.reduced()) { setOutgoing(null); return; }
      let ms = M.shared.claimOut(node);
      if (!ms) { M.animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: M.dur.normal, easing: M.ease.exit }); ms = M.dur.normal; }
      const id = outgoing.id;
      const tm = setTimeout(() => setOutgoing((o) => (o && o.id === id ? null : o)), ms + 60);
      return () => clearTimeout(tm);
    }, [outgoing && outgoing.id]);

    return React.createElement(React.Fragment, null,
      React.createElement('div', { 'data-a11y': t.a11y ? 'on' : 'off', style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--header-bg, var(--grad-guinda))', overflow: 'hidden', fontSize: t.a11y ? 17 : 16, paddingTop: 'env(safe-area-inset-top)' } },
      React.createElement(ImpersonationBanner,{auth,onLoan:()=>push('loan')}),
      React.createElement('div', { style: { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' } },
        // scrollable tab content
        React.createElement('div', { key: tab, className: 'su-app-scroll', 'data-app-tab-scroll':tab, style: { flex: 1, overflowY: 'auto', overflowX: 'hidden' } },
          tabAllowed || !window.ScreenLocked
            ? React.createElement(tabScreen, { app, t })
            : React.createElement(window.ScreenLocked, { screen: tab })),
        // bottom nav
        React.createElement(BottomNav, { tab, setTab, adminOnly: !auth.affiliateView }),
        // pushed full-screen routes (capa de presencia · entrada + salida)
        // E·#1: el contenedor captura eventos SOLO si hay una capa entrante viva.
        // Mientras únicamente queda la capa saliente (pointer-events:none), el
        // contenedor debe dejar pasar el toque al tab de fondo: retener no puede
        // costar 280-434 ms de latencia percibida.
        React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 40, display: layers.length ? 'block' : 'none', pointerEvents: layers.some((l) => !l.out) ? 'auto' : 'none' } },
          layers.map((l) => React.createElement('div', {
            key: l.key,
            ref: (el) => { if (l.out) outNode.current = el; else inNode.current = el; },
            className: l.out || sharedPending ? undefined : 'su-route',
            style: { position: 'absolute', inset: 0, zIndex: l.depth, pointerEvents: l.out ? 'none' : 'auto', willChange: l.out ? 'opacity' : undefined },
          },
            (l.out ? true : pushAllowed) || !window.ScreenLocked
              ? React.createElement(l.Comp, { app, params: l.params })
              : React.createElement(window.ScreenLocked, { screen: l.name, onBack: back })))),
        // toast
        React.createElement(Toast, { msg: toast }),
        // barra de edición de textos en vivo (solo con permiso)
        window.TextEditBar && React.createElement(window.TextEditBar, null),
        // pop-ups administrables por pantalla (mismo diseño que el de inicio)
        popupItems && React.createElement(window.AdminPopup, { items: popupItems, app, onClose: () => setPopupItems(null) }),
      )),
      // Tweaks panel
      React.createElement(window.TweaksPanel, { title: 'Tweaks' },
        React.createElement(window.TweakSection, { label: 'Encabezado' }),
        React.createElement(window.TweakRadio, { label: 'Estilo de encabezado', value: t.heroVariant, options: [{ value: 'aurora', label: 'Aurora' }, { value: 'solid', label: 'Sólido' }, { value: 'coral', label: 'Coral' }], onChange: (v) => setTweak('heroVariant', v) }),
        React.createElement(window.TweakSection, { label: 'Marca' }),
        React.createElement(window.TweakColor, { label: 'Color institucional', value: t.primary, options: ['#910022', '#0F5C4C', '#1E3A8A', '#5B2A86', '#B3122E'], onChange: (v) => setTweak('primary', v) }),
        React.createElement(window.TweakSection, { label: 'Pop-ups' }),
        React.createElement(window.TweakToggle, { label: 'Mostrar pop-ups administrables', value: t.showPromo, onChange: (v) => setTweak('showPromo', v) }),
        React.createElement(window.TweakButton, { label: 'Ver pop-up productivo', onClick: () => { const l = visual.popups || []; if (l.length) setPopupItems(l); else showToast('No hay pop-up productivo activo'); } }),
        React.createElement(window.TweakButton, { label: 'Ir al Panel Administrativo', onClick: () => setTab('admin') }),
        React.createElement(window.TweakSection, { label: 'Accesibilidad' }),
        React.createElement(window.TweakToggle, { label: 'Modo accesible (texto grande)', value: t.a11y, onChange: (v) => setTweak('a11y', v) }),
        React.createElement(window.TweakSection, { label: 'QA de movimiento (dev)' }),
        React.createElement(window.TweakRadio, { label: 'Movimiento', value: t.qaMotion, options: [{ value: 'system', label: 'Sistema' }, { value: 'on', label: 'Reducido' }, { value: 'off', label: 'Completo' }], onChange: (v) => setTweak('qaMotion', v) }),
        React.createElement(window.TweakRadio, { label: 'Transición espacial', value: t.qaSpatial, options: [{ value: '420', label: '420 ms' }, { value: '480', label: '480 ms' }], onChange: (v) => setTweak('qaSpatial', v) }),
        React.createElement(window.TweakButton, { label: 'Medir frames (5 s)', onClick: () => { showToast('Midiendo 5 s… desplaza o navega'); window.MOTION.qa.fps(5000).then((r) => { console.table ? console.table(r) : console.log(r); showToast(r.fpsMedio + ' fps · p95 ' + r.p95Ms + ' ms · ' + r.sobre33_3 + ' frames >33 ms'); }); } }),
      ),
    );
  }

  function Root() {
    const auth = window.useAffiliateAuth();
    return auth.phase === 'authenticated'
      ? React.createElement(App, { auth })
      : React.createElement(window.AffiliateLoginScreen, { auth });
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));
})();
