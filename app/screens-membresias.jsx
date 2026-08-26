/* screens-membresias.jsx — Sección "Membresías" en la página de Finanzas.
   Tarjetas de membresías ACTIVAS consumidas dinámicamente del panel admin
   (window.membershipStore). Exporta window.MembresiasSection. */
(function () {
  const I = window.Icon;
  const money = (n) => (window.money ? window.money(n) : '$' + n);

  function MembershipLogo({ src, empresa }) {
    const [err, setErr] = React.useState(false);
    if (!src || err) return React.createElement('div', { style: { width: 54, height: 54, borderRadius: 15, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'card', size: 24, stroke: 2 }));
    return React.createElement('div', { style: { width: 54, height: 54, borderRadius: 15, background: '#fff', boxShadow: 'var(--neo-inset)', display: 'grid', placeItems: 'center', overflow: 'hidden' } },
      React.createElement('img', { src, alt: empresa, onError: () => setErr(true), style: { width: '86%', height: '86%', objectFit: 'contain' } }));
  }

  function MembresiasSection({ app, items }) {
    const store = window.useMembershipStore ? window.useMembershipStore() : window.membershipStore;
    const list = items || store.active();
    // M4 · entrada lateral escalonada de la retícula (una sola vez por sesión).
    const gridRef = React.useRef(null);
    // Entran desde los laterales y se encuentran en el centro, al entrar en
    // pantalla (una sola vez por sesión). Columna izquierda desde la izquierda,
    // derecha desde la derecha; el escalonado va por filas.
    window.useReveal(gridRef, {
      key: 'membresias', step: 70, max: 12, failsafe: 2600,
      indexOf: (el, i) => Math.floor(i / 2),
      duration: (window.MOTION ? window.MOTION.dur.spatial : 420),
      easing: (window.MOTION ? window.MOTION.ease.enter : undefined),
      offset: (el, i) => ({ x: (i % 2 === 0 ? -1 : 1) * (window.MOTION ? window.MOTION.dist.md : 24), y: 0 }),
    });
    const state=store.state?store.state():{phase:'loaded'};
    if(state.phase==='loading'||state.phase==='error')return React.createElement('div',{style:{padding:'0 20px'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:9,margin:'0 0 12px'}},React.createElement('div',{style:{width:6,height:24,borderRadius:999,background:'var(--guinda)'}}),React.createElement('h3',{style:{fontSize:16.5,fontWeight:800,margin:0,color:'var(--ink)'}},'Membresías')),
      React.createElement('div',{'data-memberships-state':state.phase,style:{background:'var(--surface)',borderRadius:16,padding:18,textAlign:'center',boxShadow:'var(--neo-sm)',fontSize:13,fontWeight:700,color:state.phase==='error'?'#A32921':'var(--ink-3)'}},state.phase==='loading'?'Cargando membresías…':React.createElement(React.Fragment,null,'No pudimos cargar el catálogo. ',React.createElement('button',{onClick:store.retry},'Reintentar'))));
    if (!list.length) return null;
    return React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 12px' } },
        React.createElement('div', { style: { width: 6, height: 24, borderRadius: 999, background: 'var(--guinda)' } }),
        React.createElement('div', null,
          React.createElement('h3', { style: { fontSize: 16.5, fontWeight: 800, margin: 0, letterSpacing: '-.01em', color: 'var(--ink)' } }, 'Membresías'),
          React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 } }, 'Paga en parcialidades vía nómina'))),
      React.createElement('div', { ref: gridRef, 'data-noreveal': '', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '0 -20px -24px', padding: '6px 20px 34px', overflow: 'hidden' } },
        list.map((m) => React.createElement('button', { type:'button', onClick:()=>app.push('membership',{id:m.id}), key: m.id, 'data-reveal-key': m.id, className: 'su-press', style: { border:'none',textAlign:'left',fontFamily:'inherit',color:'inherit',background: 'var(--surface)', borderRadius: 18, padding: 14, boxShadow: 'var(--neo-md)', display: 'flex', flexDirection: 'column' } },
          React.createElement(MembershipLogo, { src: m.logo, empresa: m.empresa }),
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginTop: 11, lineHeight: 1.2 } }, m.empresa),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3, lineHeight: 1.35 } }, m.concepto),
          React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 10 } },
            React.createElement('span', { style: { fontSize: 16, fontWeight: 800, color: 'var(--guinda)', fontVariantNumeric: 'tabular-nums' } }, money(m.monto)),
            React.createElement('span', { style: { fontSize: 10.5, fontWeight: 800, color: 'var(--ink-2)', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap' } }, m.pagos + ' PAGOS'))))));
  }

  window.MembresiasSection = MembresiasSection;
})();
