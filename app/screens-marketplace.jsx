/* screens-marketplace.jsx — ProductScreen (finance category), ModuloScreen, ArticuloScreen */
(function () {
  const { useState } = React;
  const I = window.Icon;

  // F1.2 — Autoridad única: finCatStore. DATA.finanzasGroups solo actúa como
  // arranque controlado si el store aún no está disponible.
  function finGroups() {
    const fs = window.finCatStore;
    return (fs && fs.groups ? fs.groups() : []);
  }
  function findItem(id) {
    for (const g of finGroups()) { const it = g.items.find((x) => x.id === id); if (it) return { it, g }; }
    return null;
  }

  // generic full-screen shell with image hero
  function HeroShell({ app, item, hue, children, fav, onFav }) {
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto' } },
        // hero
        React.createElement('div', { style: { position: 'relative', height: 188, background: `linear-gradient(135deg, hsl(${hue} 48% 42%), hsl(${hue} 55% 26%))`, overflow: 'hidden' } },
          React.createElement(window.ResSlot, { resKey: 'fin.hero.' + item.id, shape: 'rect', fit: 'cover', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } }),
          React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(20,8,12,.42), rgba(20,8,12,.08))', pointerEvents: 'none' } }),
          React.createElement('div', { style: { position: 'absolute', right: -20, bottom: -30, opacity: .16 } }, React.createElement(I, { name: item.icon, size: 220, stroke: 1, style: { color: '#fff' } })),
          React.createElement('div', { style: { position: 'absolute', top: 10, left: 8, right: 8, display: 'flex', justifyContent: 'space-between' } },
            circBtn('arrowL', app.back),
            onFav && React.createElement('button', { onClick: onFav, style: { width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' } },
              React.createElement(I, { name: 'heart', size: 21, stroke: 2, style: { fill: fav ? '#fff' : 'none' } })))),
        children,
      ),
    );
  }
  function circBtn(icon, onClick) {
    return React.createElement('button', { onClick, style: { width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' } },
      React.createElement(I, { name: icon, size: 22, stroke: 2 }));
  }

  const LISTING_CATS = ['auto', 'renta', 'casa', 'terrenos', 'solar', 'aires', 'puertas', 'computo', 'market', 'tours', 'farma', 'cirugias', 'rifas', 'donativos'];

  function ProductScreen({ app, params }) {
    const found = findItem(params.id);
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    const cs = window.useCatalogStore ? window.useCatalogStore() : null;
    if (!found) return null;
    const { it } = found;
    const hue = { guinda: 345, green: 150, blue: 210, amber: 36 }[found.g.tone];
    const [fav, setFav] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [qSheet, setQSheet] = useState(false);
    const prods = cs ? cs.live('fin', it.id) : [];
    const catalogState = cs ? cs.state() : { phase: 'loading', error: null };
    const isListing = prods.length > 0 || LISTING_CATS.includes(it.id);
    const benefits = benefitsFor(it.id);

    // ── Cotización previa: estado del flujo para este servicio ──
    const needsQuote = qs && qs.requiresQuote(it.id);
    const quote = needsQuote ? qs.latestFor(it.id) : null;
    const quoteReady = quote && quote.estado === 'cotizada';
    React.useEffect(() => { if (quoteReady && !quote.visto) qs.markVisto(quote.id); }, [quoteReady, quote && quote.id]);

    return React.createElement(React.Fragment, null,
      React.createElement(HeroShell, { app, item: it, hue, fav, onFav: () => setFav(!fav) },
        React.createElement('div', { style: { padding: '18px 20px 120px' } },
          // title block
          React.createElement('div', { style: { display: 'flex', gap: 13, alignItems: 'flex-start' } },
            React.createElement('div', { style: { marginTop: -46, flexShrink: 0, width: 64, height: 64, borderRadius: 18, background: 'var(--surface)', boxShadow: 'var(--neo-md)', display: 'grid', placeItems: 'center', color: 'var(--guinda)' } },
              React.createElement(I, { name: it.icon, size: 32, stroke: 1.8 })),
            React.createElement('div', { style: { flex: 1, paddingTop: 2 } },
              React.createElement('h1', { style: { fontSize: 23, fontWeight: 800, letterSpacing: '-.02em', margin: 0 } }, it.label),
              React.createElement('div', { style: { fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } },
                React.createElement('span', { style: { color: 'var(--guinda)' } }, 'SutiApp'), ' / ' + it.label))),
          React.createElement('p', { style: { fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55, margin: '16px 0 0' } }, descFor(it)),
          needsQuote && React.createElement(QuoteStatusCard, { quote, it }),
          // quick actions
          React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 18 } },
            actionPill('phone', 'Llamar'), actionPill('message', 'WhatsApp'), actionPill('star', 'Guardar', () => setFav(!fav))),
          // benefits
          React.createElement('div', { style: { marginTop: 22 } },
            React.createElement(window.SectionHead, { title: 'Por qué te conviene', icon: 'sparkle' }),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
              benefits.map((b) => React.createElement('div', { key: b.t, style: { display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', borderRadius: 14, padding: '13px 14px', boxShadow: 'var(--neo-sm)' } },
                React.createElement('div', { style: { width: 38, height: 38, borderRadius: 11, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', color: 'var(--guinda)', flexShrink: 0 } }, React.createElement(I, { name: b.icon, size: 20, stroke: 2 })),
                React.createElement('div', null, React.createElement('div', { style: { fontSize: 14, fontWeight: 700 } }, b.t), React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 } }, b.s)))))),
          // listings (administrables desde el módulo Marketplace)
          isListing && React.createElement('div', { style: { marginTop: 24 } },
            React.createElement(window.SectionHead, { title: 'Disponibles ahora' }),
            catalogState.phase === 'loading'
              ? React.createElement(window.EmptyState, { icon: 'clock', title: 'Cargando disponibles', sub: 'Consultando el catálogo productivo…' })
              : catalogState.phase === 'error'
                ? React.createElement('div', null, React.createElement(window.EmptyState, { icon: 'warning', title: 'No pudimos cargar el catálogo', sub: 'Revisa tu conexión e inténtalo de nuevo.' }), React.createElement(window.Btn, { full: true, variant: 'outline', onClick: () => cs.retry() }, 'Reintentar'))
                : prods.length
                  ? React.createElement(window.CatalogGrid, { items: prods, hue, icon: it.icon, onOpen: (p) => app.push('catitem', { item: p, ctx: { id: it.id, label: it.label, icon: it.icon, hue } }) })
                  : React.createElement(window.EmptyState, { icon: it.icon, title: 'Catálogo pendiente', sub: 'Esta sección conserva su lugar mientras se reconcilian los datos productivos.' })),
        ),
      ),
      // sticky CTA (si requiere cotización, el simulador solo se habilita con cotización lista)
      React.createElement('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(14px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent, var(--surface) 22%)', display: 'flex', gap: 10 } },
        !needsQuote
          ? React.createElement(window.Btn, { full: true, size: 'lg', icon: isListing ? 'plus' : 'cash', onClick: () => isListing ? app.toast('Selecciona un producto en “Disponibles ahora”') : setSheet(true) }, isListing ? 'Solicitar este beneficio' : 'Solicitar ahora')
          : !quoteReady
            ? React.createElement(window.Btn, { full: true, size: 'lg', icon: 'doc', onClick: () => setQSheet(true) }, quote && quote.estado === 'solicitada' ? 'Solicitar otra cotización' : 'Solicitar cotización')
            : React.createElement(React.Fragment, null,
              React.createElement(window.Btn, { size: 'lg', variant: 'outline', icon: 'plus', style: { flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13 }, onClick: () => setQSheet(true) }, 'Nueva cotización'),
              React.createElement(window.Btn, { size: 'lg', icon: 'cash', style: { flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13 }, onClick: () => setSheet(true) }, 'Simular monto'))),
      // confirm sheet → simulador de financiamiento (descuento vía nómina)
      React.createElement(FinanceSimSheet, { open: sheet, onClose: () => setSheet(false), it, hue, app, isListing, quote: quoteReady ? quote : null }),
      needsQuote && React.createElement(QuoteRequestSheet, { open: qSheet, onClose: () => setQSheet(false), it, app }),
    );
  }

  // ── Tarjeta de estado del flujo de cotización previa ──
  function QuoteStatusCard({ quote, it }) {
    const money = window.money;
    if (!quote || quote.estado === 'vencida') {
      return React.createElement('div', { style: { display: 'flex', gap: 11, alignItems: 'flex-start', background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 15, padding: '13px 14px', marginTop: 16 } },
        React.createElement(I, { name: 'info', size: 18, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
        React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } },
          React.createElement('b', null, 'Este servicio se cotiza primero. '),
          'El precio depende de disponibilidad, temporada u otras variables. Envía tu solicitud de interés; cuando el proveedor cargue la cotización, se habilitará el simulador de financiamiento.'));
    }
    if (quote.estado === 'solicitada') {
      return React.createElement('div', { style: { background: '#FFF3DC', border: '1px solid #F0DFB6', borderRadius: 15, padding: '13px 14px', marginTop: 16 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
          React.createElement(I, { name: 'clock', size: 18, stroke: 2.2, style: { color: '#9A6B16', flexShrink: 0 } }),
          React.createElement('div', { style: { flex: 1, fontSize: 13.5, fontWeight: 800, color: '#7a5410' } }, 'Cotización en proceso'),
          React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: '#9A6B16', fontFamily: 'var(--mono)' } }, quote.folio)),
        React.createElement('div', { style: { fontSize: 12, color: '#7a5410', fontWeight: 600, marginTop: 5, lineHeight: 1.45 } },
          (quote.empresaNombre ? quote.empresaNombre : 'El Área de Finanzas') + ' recibió tu solicitud el ' + quote.fechaHora + '. Esta revisión continúa y no impide enviar otra solicitud.'));
    }
    const c = quote.cotizacion || {};
    return React.createElement('div', { style: { background: '#E7F6ED', border: '1px solid #C4E8D2', borderRadius: 15, padding: '13px 14px', marginTop: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
        React.createElement(I, { name: 'checkCircle', size: 18, stroke: 2.2, style: { color: '#13794A', flexShrink: 0 } }),
        React.createElement('div', { style: { flex: 1, fontSize: 13.5, fontWeight: 800, color: '#0b5c37' } }, 'Tu cotización está lista'),
        React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: '#13794A', fontFamily: 'var(--mono)' } }, quote.folio)),
      React.createElement('div', { style: { fontSize: 24, fontWeight: 900, color: '#0b5c37', letterSpacing: '-.02em', marginTop: 6 } }, money(c.monto)),
      React.createElement('div', { style: { fontSize: 12, color: '#13794A', fontWeight: 600, marginTop: 3, lineHeight: 1.45 } },
        'Cotizado por ' + (c.actor || quote.empresaNombre || 'el proveedor') + ' · Vigencia ' + (c.vigencia || '15 días') + (c.nota ? ' · ' + c.nota : '') + '. Ya puedes simular tu financiamiento con este monto.'));
  }

  // ── Sheet: solicitud de interés / cotización ──
  function QuoteRequestSheet({ open, onClose, it, app, producto }) {
    const [msg, setMsg] = React.useState('');
    const [sent, setSent] = React.useState(null);
    const [firma, setFirma] = React.useState('');
    const [accept, setAccept] = React.useState(false);
    const [error,setError]=React.useState('');
    const [documentGate,setDocumentGate]=React.useState({phase:producto?'loading':'ready',ready:!producto,documentIds:[],missing:0});
    const sending=React.useRef(false);const idem=React.useRef(null);
    React.useEffect(() => { if (open) { setSent(null); setMsg(''); setFirma(''); setAccept(false); setError(''); setDocumentGate({phase:producto?'loading':'ready',ready:!producto,documentIds:[],missing:0});sending.current=false;idem.current=window.ProgramRequestRepository.newIdempotencyKey(); } }, [open,producto&&producto.id]);
    const provider = window.quoteStore ? window.quoteStore.providerFor(it.id) : null;
    const [okCot, runCot] = window.useBtnConfirm();
    const enviar = async () => {
      if(sending.current||!documentGate.ready)return;sending.current=true;
      try{let rec;if(producto&&producto.catalogSource==='program')rec=await window.ProgramCatalogRepository.createRequest(producto.id,1,msg.trim(),firma,true,idem.current,documentGate.documentIds);else if(producto)rec=await window.MarketplaceRepository.createQuote(producto.id,msg.trim(),firma,true,idem.current,documentGate.documentIds);else rec=await window.quoteStore.solicitar({
        productoId: it.id, productoNombre: it.label, icon: it.icon, mensaje: msg.trim(),documentIds:documentGate.documentIds,
        firma, idempotencyKey:idem.current, terminos: { aceptado: true, programa: 'cotizacion', fecha: new Date().toISOString() },
      });setSent(rec);}catch(_){setError('No se pudo enviar la solicitud. Revisa los documentos e inténtalo de nuevo.');sending.current=false;}
    };
    if (sent) return React.createElement(window.RequestSubmissionSuccess,{app,folio:sent.folio,kind:'quote',subject:it.label,workflowState:sent.workflow_state,onBack:onClose,fullScreen:true,destination:(sent.empresaNombre||'El Área de Finanzas')+' recibió tu solicitud y preparará el presupuesto para su revisión.'});
    return React.createElement(window.Sheet, { open, onClose, title: 'Solicitar cotización' },
      React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface-2)', borderRadius: 15, padding: '13px 14px' } },
        React.createElement('div', { style: { width: 44, height: 44, borderRadius: 12, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: it.icon, size: 23, stroke: 2 })),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, it.label),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } }, 'Atiende: ' + (provider ? provider.name : 'Área de Finanzas del sindicato')))),
      React.createElement('p', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.55, margin: '14px 0 0' } }, 'Enviaremos tu interés en este servicio. El proveedor preparará una cotización con el monto real y recibirás una notificación para simular tu financiamiento.'),
      React.createElement('div', { style: { marginTop: 14 } },
        React.createElement('label', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 } }, '¿Qué te interesa? (opcional)'),
        React.createElement('textarea', { value: msg, rows: 3, placeholder: 'Ej. Viaje a Cancún para 2 personas en agosto…', onChange: (e) => setMsg(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 } })),
      producto&&React.createElement('div',{style:{marginTop:18}},React.createElement(window.DocumentRequestGate,{scopeType:producto.catalogSource==='program'?'PROGRAM':'PRODUCT',scopeKey:producto.id,onState:setDocumentGate})),
      React.createElement(window.SignBlock, { programa: 'cotizacion', subtitulo: 'Solicitud de cotización · ' + it.label, firma, setFirma, accept, setAccept, compact: true }),
      error&&React.createElement('div',{style:{color:'#C0341D',fontSize:12.5,fontWeight:700,marginTop:10}},error),
      React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 16 } },
        React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { full: true, icon: 'doc', success: okCot, disabled: !accept || !firma || !documentGate.ready, onClick: () => runCot(enviar) }, documentGate.phase==='loading'?'Consultando documentos…':documentGate.missing?'Faltan '+documentGate.missing+' documentos':'Enviar solicitud')));
  }

  function actionPill(icon, label, onClick) {
    return React.createElement('button', { onClick, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'var(--guinda-50)', border: '1px solid var(--guinda-100)', borderRadius: 14, padding: '11px 0', cursor: 'pointer', color: 'var(--guinda)' } },
      React.createElement(I, { name: icon, size: 21, stroke: 2 }), React.createElement('span', { style: { fontSize: 12, fontWeight: 700 } }, label));
  }

  function descFor(it) {
    const m = {
      ahorro: 'Aparta una parte de tu quincena de forma automática y recíbela con rendimiento preferente al cierre del semestre. Sin comisiones.',
      inversion: 'Haz crecer tu dinero con el portafolio sindical, diseñado para afiliados. Empieza desde $1,000 y consulta tu rendimiento en tiempo real.',
      solar: 'Los paneles solares requieren poco mantenimiento, reducen tu recibo de luz y aumentan el valor de tu propiedad. Financiamiento verde a meses sin intereses.',
      farma: 'Consulta medicamentos y presentaciones disponibles del catálogo histórico de Suti Farma.',
      tours: 'Explora viajes, alojamientos y experiencias disponibles en el catálogo de Suti Tours.',
      auto: 'Consulta los vehículos disponibles. Las condiciones de financiamiento se revisan después de registrar tu solicitud.',
      renta: 'Consulta los vehículos disponibles para renta y registra tu solicitud desde aquí.',
      casa: 'Explora propiedades publicadas en el catálogo histórico de Suti Casa.',
      terrenos: 'Consulta los terrenos publicados. El cálculo de financiamiento se realiza durante la revisión.',
      aires: 'Consulta equipos de aire acondicionado disponibles y su precio de contado histórico.',
      puertas: 'Consulta modelos de puertas de seguridad disponibles.',
      computo: 'Consulta equipos de cómputo disponibles.',
      donativos: 'Consulta las organizaciones y causas publicadas para donativos.',
    };
    return m[it.id] || (it.tagline + '. ' + it.meta + '. Solicítalo con las mejores condiciones gracias a tu sindicato, con descuento cómodo vía nómina y sin letras chiquitas.');
  }
  function benefitsFor(id) {
    if (LISTING_CATS.includes(id) || id === 'donativos') return [
      { icon: 'checkCircle', t: 'Catálogo verificado', s: 'Filas históricas reconciliadas sin productos simulados' },
      { icon: 'image', t: 'Información disponible', s: 'Imágenes y datos vigentes de cada opción' },
      { icon: 'shield', t: 'Proceso protegido', s: 'Tu solicitud se registra antes de cualquier revisión financiera' },
    ];
    const base = [
      { icon: 'percent', t: 'Tasa preferente sindical', s: 'Mejores condiciones que el mercado' },
      { icon: 'calendar', t: 'Descuento vía nómina', s: 'Pagos cómodos cada quincena' },
      { icon: 'shield', t: 'Sin aval ni penalización', s: 'Trámite 100% para afiliados' },
    ];
    if (id === 'ahorro' || id === 'inversion') return [
      { icon: 'trending', t: 'Rendimiento preferente', s: 'Por encima de la inflación' },
      { icon: 'refresh', t: 'Aportación automática', s: 'Se aparta de tu quincena' },
      { icon: 'lock', t: 'Tu dinero, protegido', s: 'Respaldo del sindicato' },
    ];
    return base;
  }
  // ---------- MODULO (institutional) — contenido administrable ----------
  function ModuloScreen({ app, params }) {
    const m = params.m;
    if (m.frontend_route && m.frontend_route.type === 'tab') {
      app.setTab(m.frontend_route.target);
      return null;
    }
    const migrated = (window.H007_MIGRATED_MODULE_IDS || []).indexOf(m.id) !== -1;
    return migrated
      ? React.createElement(MigratedModuloScreen, { app, params })
      : React.createElement(LegacyModuloScreen, { app, params });
  }

  function MigratedModuloScreen({ app, params }) {
    const m = params.m;
    const content = app.institutional.moduleFor(m.id);
    return renderModulo(app, m, content.title, content.description, content.blocks, content.phase, content.retry);
  }

  function LegacyModuloScreen({ app, params }) {
    const m = params.m;
    if (window.useSindicatoStore) window.useSindicatoStore();   // re-render al editar en el panel
    const store = window.sindicatoStore;
    const hdr = store ? store.header(m.id) : null;
    const blocks = store ? store.blocksLive(m.id) : null;
    const titulo = (hdr && hdr.titulo) || m.label;
    const desc = (hdr && hdr.desc) || m.desc;
    return renderModulo(app, m, titulo, desc, blocks, 'loaded', null);
  }

  function renderModulo(app, m, titulo, desc, blocks, phase, retry) {
    const migrated = (window.H007_MIGRATED_MODULE_IDS || []).indexOf(m.id) !== -1;
    return React.createElement('div', { 'data-h007-module': m.id, style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: app.back, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 16.5, fontWeight: 800 } }, titulo)),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: 20 } },
        React.createElement('div', { style: { position: 'relative', display: 'flex', gap: 14, alignItems: 'center', background: 'linear-gradient(135deg,var(--guinda),var(--guinda-700))', borderRadius: 20, padding: 18, color: '#fff', overflow: 'hidden', minHeight: 88, boxSizing: 'border-box' } },
          !migrated && contentHeaderImage(m.id) && React.createElement('img', { src: contentHeaderImage(m.id), alt: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' } }),
          React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(50,0,12,.5), rgba(50,0,12,.15))', pointerEvents: 'none' } }),
          React.createElement('div', { style: { position: 'relative', width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flexShrink: 0, backdropFilter: 'blur(4px)' } }, React.createElement(I, { name: m.icon, size: 28, stroke: 1.8 })),
          React.createElement('div', { style: { position: 'relative' } }, React.createElement('div', { style: { fontSize: 18, fontWeight: 800, textShadow: '0 1px 8px rgba(0,0,0,.3)' } }, titulo), desc && React.createElement('div', { style: { fontSize: 13, opacity: .88, fontWeight: 500, textShadow: '0 1px 8px rgba(0,0,0,.3)' } }, desc))),
        React.createElement('div', { style: { marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 } },
          phase === 'loading'
            ? React.createElement('div', { 'data-h007-module-state': 'loading', style: { textAlign: 'center', color: 'var(--ink-3)', fontWeight: 700, padding: 30 } }, 'Cargando contenido...')
            : phase === 'error'
              ? React.createElement('div', { 'data-h007-module-state': 'error', style: { textAlign: 'center', padding: 30 } },
                React.createElement('div', { style: { color: 'var(--ink-2)', fontWeight: 700 } }, 'No pudimos cargar esta sección.'),
                React.createElement('button', { onClick: retry, style: { marginTop: 10 } }, 'Reintentar'))
              : (blocks && blocks.length)
                ? blocks.map((b) => React.createElement('div', { key: b.id, 'data-h007-content-block': '' }, React.createElement(ModuloBlock, { b, app })))
                : React.createElement('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, fontWeight: 600, padding: '30px 10px', lineHeight: 1.5 } }, 'No hay contenido disponible para tu perfil en esta sección.')),
      ),
    );
  }

  function contentHeaderImage(id) {
    const store = window.sindicatoStore;
    const header = store && store.header(id);
    return header && header.imageUrl;
  }

  function ModuloBlock({ b, app }) {
    const openUrl = (url) => { if (url) window.open(url, '_blank', 'noopener'); else app.toast && app.toast('Enlace no configurado'); };
    const downloadFile = () => {
      if (b.imageUrl) openUrl(b.imageUrl);
      else if (b.url) openUrl(b.url);
      else app.toast && app.toast('Archivo no disponible');
    };
    if (b.kind === 'texto') {
      const paras = String(b.texto || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
      if (b.foto) {
        // Ficha de persona (directorio): foto + nombre + cargo
        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', borderRadius: 16, padding: '13px 15px', boxShadow: 'var(--neo-sm)' } },
          React.createElement(window.Avatar, { name: b.titulo || '', src: b.foto, size: 54 }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            b.titulo && React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25 } }, b.titulo),
            paras.length ? React.createElement('div', { style: { fontSize: 12.5, color: 'var(--guinda)', fontWeight: 700, marginTop: 3, lineHeight: 1.35 } }, paras.join(' ')) : null));
      }
      return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '15px 16px', boxShadow: 'var(--neo-sm)' } },
        b.titulo && React.createElement('div', { style: { fontSize: 15.5, fontWeight: 800, color: 'var(--ink)', marginBottom: paras.length ? 7 : 0 } }, b.titulo),
        paras.map((p, i) => React.createElement('p', { key: i, style: { fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.6, margin: i ? '10px 0 0' : 0 } }, p)),
        b.url && React.createElement('button', { onClick: () => openUrl(b.url), style: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'none', border: 'none', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', padding: 0 } }, React.createElement(I, { name: 'link', size: 16, stroke: 2.2 }), 'Abrir enlace'));
    }
    if (b.kind === 'imagen') {
      const clickable = !!b.url;
      return React.createElement('div', {
        onClick: clickable ? () => openUrl(b.url) : undefined, className: clickable ? 'su-press' : '',
        style: { background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)', cursor: clickable ? 'pointer' : 'default' },
      },
        React.createElement('div', { style: { position: 'relative', height: 170, background: 'linear-gradient(150deg, hsl(345,55%,44%), hsl(345,55%,28%))' } },
          b.imageUrl && React.createElement('img', { src: b.imageUrl, alt: b.titulo || '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } })),
        (b.titulo || b.texto) && React.createElement('div', { style: { padding: '12px 15px' } },
          b.titulo && React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, b.titulo),
          b.texto && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500, marginTop: 3, lineHeight: 1.45 } }, b.texto)));
    }
    if (b.kind === 'documento') {
      return React.createElement('button', { onClick: downloadFile, className: 'su-press', style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: '14px 15px', boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: 11, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', color: 'var(--guinda)', flexShrink: 0 } }, React.createElement(I, { name: 'doc', size: 21, stroke: 1.9 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, b.titulo || 'Documento'),
          b.texto && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, marginTop: 2 } }, b.texto)),
        React.createElement(I, { name: b.imageUrl ? 'download' : b.url ? 'link' : 'download', size: 19, stroke: 2, style: { color: 'var(--ink-3)', flexShrink: 0 } }));
    }
    // enlace
    return React.createElement('button', { onClick: () => openUrl(b.url), className: 'su-press', style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: '14px 15px', boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: 11, background: 'var(--grad-guinda-soft)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, boxShadow: 'var(--glow-guinda)' } }, React.createElement(I, { name: 'link', size: 20, stroke: 2 })),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, b.titulo || 'Abrir enlace'),
        b.texto && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 500, marginTop: 2 } }, b.texto)),
      React.createElement(I, { name: 'chevR', size: 19, stroke: 2.2, style: { color: 'var(--ink-3)', flexShrink: 0 } }));
  }

  // ---------- ARTICULO ----------
  function ArticuloScreen({ app, params }) {
    const n = params.n;
    const [zoom, setZoom] = useState(false);
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--surface)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto' } },
        React.createElement('div', { onClick: () => n.image_url && setZoom(true), 'data-shared-key': 'news:' + n.id, style: { position: 'relative', height: 220, cursor: n.image_url ? 'zoom-in' : 'default', overflow: 'hidden', background: `linear-gradient(135deg, hsl(${n.hue} 52% 44%), hsl(${n.hue} 58% 28%))` } },
          n.image_url && React.createElement('img', { src: n.image_url, alt: '', 'data-shared-inner': '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }),
          React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 45%,rgba(0,0,0,.5))' } }),
          React.createElement('div', { style: { position: 'absolute', right: -16, bottom: -20, opacity: .16 } }, React.createElement(window.SutiSeal, { size: 160 })),
          React.createElement('button', { onClick: (e) => { e.stopPropagation(); app.back(); }, style: { position: 'absolute', top: 12, left: 10, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
          React.createElement('div', { style: { position: 'absolute', top: 14, right: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '7px 11px', borderRadius: 999, pointerEvents: 'none' } }, React.createElement(I, { name: 'search', size: 14, stroke: 2.4 }), 'Ampliar'),
          n.tag && React.createElement('div', { style: { position: 'absolute', left: 20, bottom: 16, right: 20 } }, React.createElement(window.Badge, { tone: 'gold', solid: true }, n.tag.toUpperCase()))),
        React.createElement('div', { 'data-shared-follow': '', style: { padding: 20 } },
          React.createElement('h1', { 'data-shared-title': '', style: { fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.02em', margin: 0, textWrap: 'pretty' } }, n.title),
          React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8, display: 'flex', gap: 10 } }, n.date, '· ' + n.read + ' de lectura'),
          React.createElement('div', { style: { marginTop: 16, fontSize: 15.5, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.65 } },
            React.createElement(window.RichText,{value:n.body||''})),
      )),
      zoom && n.image_url && React.createElement(window.ImageViewer, { sources: [n.image_url], alt: n.title, onClose: () => setZoom(false) }),
    );
  }

  function FinanceSimSheet({ open, onClose, it, quote, initialAmount }) {
    const financial = window.useFinancialLegacy ? window.useFinancialLegacy() : { status: 'error', overview: null, quote: null };
    const overview = financial.overview || {};
    const programKey = ['prestamo', 'nomina', 'caja'].includes(it && it.id) ? it.id : 'prestamo';
    const programs = (Array.isArray(overview.programs) ? overview.programs : []).filter((item) => item.status === 'AVAILABLE' && item.program_id === programKey);
    const [programId, setProgramId] = React.useState('');
    const program = programs.find((item) => item.id === programId) || programs[0] || null;
    const [amount, setAmount] = React.useState(0);
    const [term, setTerm] = React.useState(0);
    React.useEffect(() => { if (open && window.financialLegacyStore) window.financialLegacyStore.loadOverview(); }, [open]);
    React.useEffect(() => {
      if (!program) return;
      setProgramId(program.id);
      const quoted = quote && quote.cotizacion ? Number(quote.cotizacion.monto) : Number(initialAmount || 0);
      setAmount(quoted > 0 ? Math.min(quoted, Number(program.max_amount)) : Number(program.suggested_amount || 1));
      setTerm(Number((program.allowed_terms || [])[0] || 0));
      window.financialLegacyStore.clearQuote();
    }, [program && program.id, quote && quote.id, initialAmount]);
    const result = financial.quote;
    const canSimulate = !!(program && amount > 0 && amount <= Number(program.max_amount) && term > 0 && financial.status !== 'loading');
    const fieldStyle = { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--ink)' };
    return React.createElement(window.Sheet, { open, onClose, title: 'Simula tu financiamiento' },
      financial.status === 'error' && React.createElement(window.EmptyState, { icon: 'warning', title: 'No pudimos consultar tus condiciones', sub: 'Intenta nuevamente.' }),
      financial.status !== 'error' && !program && React.createElement(window.EmptyState, { icon: 'info', title: overview.reason === 'INCOMPLETE_FINANCIAL_PROFILE' ? 'Completa tu perfil financiero' : 'Sin financiamiento disponible', sub: overview.reason === 'INCOMPLETE_FINANCIAL_PROFILE' ? 'Se necesita tu categoría laboral y sindicato.' : 'No hay un fondo aplicable a este beneficio para tu perfil.' }),
      program && React.createElement(React.Fragment, null,
        programs.length > 1 && React.createElement('div', { style: { marginBottom: 12 } }, React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 6 } }, 'Fondo'), React.createElement('select', { value: program.id, onChange: (event) => setProgramId(event.target.value), style: fieldStyle }, programs.map((item) => React.createElement('option', { key: item.id, value: item.id }, item.label)))),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
          React.createElement('div', null, React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 6 } }, 'Monto'), React.createElement('input', { type: 'number', min: 1, max: program.max_amount, value: amount, onChange: (event) => { setAmount(Number(event.target.value)); window.financialLegacyStore.clearQuote(); }, style: fieldStyle })),
          React.createElement('div', null, React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 6 } }, 'Plazo'), React.createElement('select', { value: term, onChange: (event) => { setTerm(Number(event.target.value)); window.financialLegacyStore.clearQuote(); }, style: fieldStyle }, (program.allowed_terms || []).map((value) => React.createElement('option', { key: value, value }, program.term_label || (value + ' quincenas')))))),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 8 } }, 'Monto máximo: ' + window.money(Number(program.max_amount))),
        result && React.createElement('div', { style: { marginTop: 14, borderRadius: 17, background: 'var(--guinda-50)', padding: 14 } },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' } }, 'Pago por quincena'),
          React.createElement('div', { style: { fontSize: 28, fontWeight: 900, color: 'var(--guinda)', marginTop: 2 } }, window.money(result.paymentPerPeriod)),
          React.createElement('div', { style: { fontSize: 12, fontWeight: 650, color: 'var(--ink-2)', marginTop: 5 } }, result.paymentCount + ' pagos · Total ' + window.money(result.total) + ' · Incluye ' + window.money(result.administrativeFeeTotal) + ' de gasto administrativo')),
        React.createElement('div', { style: { marginTop: 16 } }, React.createElement(window.Btn, { full: true, loading: financial.status === 'loading', disabled: !canSimulate, onClick: () => window.financialLegacyStore.requestQuote(program.id, amount, term) }, result ? 'Actualizar simulación' : 'Calcular'))),
      React.createElement('div', { style: { marginTop: 10 } }, React.createElement(window.Btn, { full: true, variant: 'outline', onClick: onClose }, 'Cerrar')));
  }
  Object.assign(window, { ProductScreen, ModuloScreen, ArticuloScreen, FinanceSimSheet, QuoteRequestSheet });
})();
