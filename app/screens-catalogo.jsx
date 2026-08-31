/* screens-catalogo.jsx — Marketplace del afiliado: rejilla "Disponibles ahora"
   y pantalla de detalle del producto (galería + lightbox + solicitud).
   La solicitud REUTILIZA el flujo existente (FinanceSimSheet / QuoteRequestSheet).
   Exporta window.CatalogGrid, window.CatalogItemScreen. */
(function () {
  const { useState, useRef } = React;
  const I = window.Icon;

  const precioTxt = (it) => (it.precio != null && !it.cotiza ? window.money(it.precio) : it.catalogSource === 'program' && !it.cotiza ? 'Consulta disponibilidad' : 'Se cotiza');

  // ── Rejilla de productos (usada en Finanzas y en Convenios) ──
  // F1.8: la portada de cada producto se resuelve por el registro
  // (cat.item.<id>); la galería multi-imagen sigue leyendo `imagenes[]`
  // (EXEMPT 'catalogo.galeria', autoridad de catalogStore).
  function CatalogCard({ l, i, hue, icon, onOpen }) {
    const r = window.useAsset ? window.useAsset('cat.item.' + l.id) : null;
    const cover = (l.imagenes&&l.imagenes[0])||(r && r.kind === 'image' && r.url);
    return React.createElement('div', {
      className: 'su-press', onClick: () => onOpen(l),
      style: { background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)', cursor: 'pointer', opacity: 1 },
    },
      React.createElement('div', { style: { height: 92, position: 'relative', background: `linear-gradient(135deg, hsl(${hue + i * 12} 42% 52%), hsl(${hue + i * 12} 48% 36%))` } },
        cover
          ? React.createElement('img', { src: cover, alt: l.nombre, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } })
          : React.createElement('div', { style: { position: 'absolute', right: -6, bottom: -10, opacity: .2 } }, React.createElement(I, { name: icon || (r && r.icon), size: 70, stroke: 1, style: { color: '#fff' } })),
        l.badge && React.createElement('div', { style: { position: 'absolute', top: 8, left: 8 } }, React.createElement(window.Badge, { tone: 'gold', solid: true }, l.badge))),
      React.createElement('div', { style: { padding: '10px 12px 12px' } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 } }, l.nombre),
        l.ficha && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } }, l.ficha),
        React.createElement('div', { style: { fontSize: l.precio != null && !l.cotiza ? 15 : 12.5, fontWeight: 800, color: l.precio != null && !l.cotiza ? 'var(--guinda)' : 'var(--ink-3)', marginTop: 7, letterSpacing: l.cotiza ? '.04em' : 0 } }, precioTxt(l))));
  }

  function CatalogGrid({ items, hue, icon, onOpen }) {
    return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      items.map((l, i) => React.createElement(CatalogCard, { key: l.id, l, i, hue, icon, onOpen })));
  }

  // ── Galería con carrusel + lightbox ──
  function Gallery({ item, hue, icon, onZoom }) {
    const imgs = (item.imagenes || []);
    const [idx, setIdx] = useState(0);
    const ref = useRef(null);
    const onScroll = (e) => { const w = e.target.clientWidth || 1; setIdx(Math.round(e.target.scrollLeft / w)); };
    if (!imgs.length) {
      return React.createElement('div', { style: { height: 260, position: 'relative', background: `linear-gradient(135deg, hsl(${hue} 48% 44%), hsl(${hue} 55% 26%))` } },
        React.createElement('div', { style: { position: 'absolute', right: -24, bottom: -30, opacity: .18 } }, React.createElement(I, { name: icon, size: 210, stroke: 1, style: { color: '#fff' } })));
    }
    return React.createElement('div', { style: { position: 'relative', height: 300, background: '#151013' } },
      React.createElement('div', {
        ref, onScroll, className: 'su-app-scroll',
        style: { position: 'absolute', inset: 0, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' },
      },
        imgs.map((src, i) => React.createElement('div', { key: i, onClick: () => onZoom(i), 'data-press': 'subtle', style: { flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start', cursor: 'zoom-in' } },
          React.createElement('img', { src, alt: item.nombre + ' ' + (i + 1), style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })))),
      imgs.length > 1 && React.createElement('div', { style: { position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', gap: 6, justifyContent: 'center', pointerEvents: 'none' } },
        imgs.map((_, i) => React.createElement('span', { key: i, style: { width: i === idx ? 20 : 7, height: 7, borderRadius: 999, background: i === idx ? '#fff' : 'rgba(255,255,255,.5)', transition: 'width .25s' } }))),
      React.createElement('div', { style: { position: 'absolute', top: 14, right: 12, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,.34)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '7px 11px', borderRadius: 999, pointerEvents: 'none' } },
        React.createElement(I, { name: 'search', size: 14, stroke: 2.4 }), imgs.length > 1 ? (idx + 1) + ' / ' + imgs.length : 'Ampliar'));
  }

  function Lightbox({ imgs, start, onClose }) {
    return React.createElement(window.ImageViewer, { sources: imgs, startIndex: start || 0, alt: 'Imagen del producto', onClose });
  }

  // ── Detalle del producto ──
  // params: { item, ctx } — ctx: { id, label, icon, hue } de la categoría o convenio
  function CatalogItemScreen({ app, params }) {
    const catalog=window.useCatalogStore?window.useCatalogStore():window.catalogStore;
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    const live = window.catalogStore ? window.catalogStore.get(params.item.id) : null;
    const item = live || params.item;
    const ctx = params.ctx || { id: item.scopeId, label: item.nombre, icon: 'cart', hue: 345 };
    const hue = ctx.hue == null ? 345 : ctx.hue;
    const [zoom, setZoom] = useState(null);
    const [sheet, setSheet] = useState(false);
    const [qSheet, setQSheet] = useState(false);
    const [requestSheet,setRequestSheet]=useState(false);
    const [paymentSignal,setPaymentSignal]=useState(0);

    const programItem = item.catalogSource === 'program';
    const cotiza = programItem ? Boolean(item.cotiza) : (item.precio == null || item.cotiza);
    // "it" con la forma que esperan los flujos existentes de simulación y cotización
    const it = { id: item.id, label: item.nombre, icon: ctx.icon || 'cart', tagline: item.ficha || '', meta: ctx.label || '' };
    const quote = !programItem && qs ? qs.latestFor(item.id) : null;
    const quoteReady = quote && quote.estado === 'cotizada';
    React.useEffect(() => { if (quoteReady && !quote.visto) qs.markVisto(quote.id); }, [quoteReady, quote && quote.id]);

    const info = [];
    if (item.ficha) info.push(['Detalle', item.ficha]);
    if (ctx.label) info.push([item.scope === 'convenio' ? 'Convenio' : 'Categoría', ctx.label]);
    if (item.badge) info.push(['Etiqueta', item.badge]);
    if(item.discount_percent!=null)info.push(['Descuento',Number(item.discount_percent)+'%']);
    if(item.stock!=null)info.push(['Stock',String(item.stock)]);
    if(item.quantity_raw)info.push(['Existencia histórica',item.quantity_raw]);
    if(item.presentation_raw)info.push(['Presentación',item.presentation_raw]);
    if(item.category_raw)info.push(['Categoría',item.category_raw]);

    let cta;
    if (programItem && item.requestMode === 'supabase') cta = React.createElement(window.Btn, { full: true, size: 'lg', icon: 'cash', onClick: () => { setPaymentSignal((value)=>value+1);setTimeout(()=>{const node=document.querySelector('[data-program-payment-state]');if(node)node.scrollIntoView({behavior:'smooth',block:'center'});},30); } }, 'VER PLAN DE PAGO');
    else if (programItem) cta = React.createElement('button', { disabled: true, style: { flex: 1, height: 54, borderRadius: 16, border: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', color: 'var(--ink-3)', fontFamily: 'inherit', fontSize: 14, fontWeight: 800 } }, 'NO DISPONIBLE PARA SOLICITAR');
    else if (!cotiza) cta = React.createElement(window.Btn, { full: true, size: 'lg', icon: 'plus', onClick: () => setRequestSheet(true) }, 'SOLICITAR ESTE BENEFICIO');
    else if (!quoteReady) cta = React.createElement(window.Btn, { full: true, size: 'lg', icon: 'doc', onClick: () => setQSheet(true) }, quote && quote.estado === 'solicitada' ? 'SOLICITAR OTRA COTIZACIÓN' : 'SOLICITAR ESTE BENEFICIO');
    else cta = React.createElement(React.Fragment, null,
      React.createElement(window.Btn, { size: 'lg', variant: 'outline', icon: 'plus', style: { flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13 }, onClick: () => setQSheet(true) }, 'Nueva cotización'),
      React.createElement(window.Btn, { size: 'lg', icon: 'cash', style: { flex: 1, minWidth: 0, padding: '0 12px', fontSize: 13 }, onClick: () => setSheet(true) }, 'Simular monto'));

    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto' } },
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement(Gallery, { item, hue, icon: it.icon, onZoom: (i) => setZoom(i) }),
            React.createElement('button', { onClick: app.back, 'aria-label': 'Atrás', style: { position: 'absolute', top: 12, left: 10, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
            React.createElement(window.FavHeart,{on:catalog&&catalog.isFavorite(item.id),onClick:()=>catalog.toggleFavorite(item.id).catch(()=>app.toast&&app.toast('No se pudo actualizar el favorito')),style:{top:58,right:10}})),
          React.createElement('div', { style: { padding: '20px 20px 130px' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' } },
              React.createElement(I, { name: it.icon, size: 15, stroke: 2.2, style: { color: 'var(--guinda)' } }), ctx.label || ''),
            React.createElement('h1', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15, margin: '8px 0 0', textWrap: 'pretty' } }, item.nombre),
            cotiza
              ? React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '9px 14px' } },
                React.createElement(I, { name: 'doc', size: 16, stroke: 2.2, style: { color: 'var(--guinda)' } }),
                React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink-2)' } }, 'Precio a cotizar'))
              : item.precio != null
                ? React.createElement('div', { style: { fontSize: 30, fontWeight: 900, color: 'var(--guinda)', letterSpacing: '-.03em', marginTop: 10 } }, window.money(item.precio))
                : React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink-3)', marginTop: 12 } }, 'Consulta disponibilidad'),
            quote && React.createElement(QuoteBanner, { quote }),
            programItem && item.requestMode === 'supabase' && window.ProgramProductPaymentFlow && React.createElement(window.ProgramProductPaymentFlow,{item,app,onRequestQuote:()=>setRequestSheet(true),openSignal:paymentSignal}),
            item.desc && React.createElement('div', { style: { marginTop: 20 } },
              React.createElement(window.SectionHead, { title: 'Descripción' }),
              React.createElement('div', { style: { fontSize: 15, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.6 } },
                String(item.desc).split(/\n{2,}/).map((p, i) => React.createElement('p', { key: i, style: { margin: i ? '12px 0 0' : 0 } }, p)))),
            info.length > 0 && React.createElement('div', { style: { marginTop: 20 } },
              React.createElement(window.SectionHead, { title: 'Información' }),
              React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '4px 15px', boxShadow: 'var(--neo-sm)' } },
                info.map(([k, v], i) => React.createElement('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: i === info.length - 1 ? 'none' : '1px solid var(--hairline)' } },
                  React.createElement('span', { style: { fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 } }, k),
                  React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', textAlign: 'right' } }, v))))),
            React.createElement('div', { style: { display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--guinda-50)', borderRadius: 15, padding: '13px 14px', marginTop: 20 } },
              React.createElement(I, { name: 'shield', size: 18, stroke: 2, style: { color: 'var(--guinda)', flexShrink: 0, marginTop: 1 } }),
              React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } },
                programItem
                  ? item.requestMode === 'supabase'
                    ? (item.legacyBoundary ? 'Tu solicitud quedará registrada de inmediato. Si después requiere una revisión financiera, el área responsable continuará el proceso sin que tengas que enviarla de nuevo.' : 'Tu solicitud quedará registrada de inmediato y vinculada a tu afiliación.')
                    : 'Este beneficio no está disponible para nuevas solicitudes en este momento.'
                  : cotiza
                    ? 'Este beneficio se cotiza primero. Envía tu solicitud y, cuando el proveedor cargue el presupuesto, podrás simular tu financiamiento vía nómina.'
                    : 'Solicítalo con descuento vía nómina y condiciones preferentes gracias a tu sindicato.')))),
        React.createElement('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(14px + env(safe-area-inset-bottom))', background: 'linear-gradient(transparent, var(--surface) 22%)', display: 'flex', gap: 10 } }, cta)),
      zoom != null && React.createElement(Lightbox, { imgs: item.imagenes || [], start: zoom, onClose: () => setZoom(null) }),
      window.FinanceSimSheet && React.createElement(window.FinanceSimSheet, { open: sheet, onClose: () => setSheet(false), it, hue, app, isListing: true, producto: item, quote: quoteReady ? quote : null }),
      window.QuoteRequestSheet && React.createElement(window.QuoteRequestSheet, { open: qSheet, onClose: () => setQSheet(false), it, app, producto: item }),
      React.createElement(BenefitRequestSheet,{open:requestSheet,onClose:()=>setRequestSheet(false),item,app}));
  }

  function BenefitRequestSheet({ open, onClose, item, app }) {
    const [msg,setMsg]=useState('');
    const [qty,setQty]=useState(1);
    const [firma,setFirma]=useState('');
    const [accept,setAccept]=useState(false);
    const [sent,setSent]=useState(null);
    const [busy,setBusy]=useState(false);
    const [err,setErr]=useState('');
    const [documentGate,setDocumentGate]=useState({phase:'loading',ready:false,documentIds:[],missing:0});
    const sending=React.useRef(false);const idem=React.useRef(null);
    const quoteRequest=item.cotiza===true;
    React.useEffect(()=>{if(open){setMsg('');setQty(1);setFirma('');setAccept(false);setSent(null);setErr('');setDocumentGate({phase:'loading',ready:false,documentIds:[],missing:0});sending.current=false;idem.current=window.ProgramRequestRepository.newIdempotencyKey();}},[open]);
    const send=async()=>{if(sending.current||!documentGate.ready)return;sending.current=true;try{setBusy(true);const repository=item.catalogSource==='program'?window.ProgramCatalogRepository:window.MarketplaceRepository;const created=await repository.createRequest(item.id,qty,msg.trim(),firma,accept,idem.current,documentGate.documentIds);setSent(created);}catch(_){setErr('No se pudo enviar la solicitud. Revisa los documentos e inténtalo de nuevo.');sending.current=false;}finally{setBusy(false);}};
    if(sent)return React.createElement(window.RequestSubmissionSuccess,{app,folio:sent.folio,kind:'benefit',subject:item.nombre,workflowState:sent.workflow_state,onBack:onClose,fullScreen:true,destination:sent.status==='requires_financial_processing'?'Tu solicitud fue enviada al Área de Finanzas del sindicato para su revisión.':'Tu solicitud fue enviada al área responsable para su revisión.'});
    return React.createElement(window.Sheet,{open,onClose,title:quoteRequest?'Solicitar cotización':'Solicitar beneficio'},
      React.createElement('div',{style:{fontSize:15,fontWeight:900}},item.nombre),
      React.createElement('label',{style:{display:'block',fontSize:12,fontWeight:800,marginTop:14}},'Cantidad'),
      React.createElement('input',{type:'number',min:1,max:999,value:qty,onChange:(e)=>setQty(Math.max(1,Number(e.target.value)||1)),style:{width:'100%',padding:12,border:'none',borderRadius:12,background:'var(--surface-2)',marginTop:6}}),
      React.createElement('label',{style:{display:'block',fontSize:12,fontWeight:800,marginTop:14}},'Mensaje (opcional)'),
      React.createElement('textarea',{value:msg,onChange:(e)=>setMsg(e.target.value),rows:3,style:{width:'100%',padding:12,border:'none',borderRadius:12,background:'var(--surface-2)',marginTop:6}}),
      React.createElement('div',{style:{marginTop:18}},React.createElement(window.DocumentRequestGate,{scopeType:item.catalogSource==='program'?'PROGRAM':'PRODUCT',scopeKey:item.id,onState:setDocumentGate})),
      React.createElement(window.SignBlock,{programa:quoteRequest?'cotizacion':'marketplace',subtitulo:(quoteRequest?'Solicitud de cotización · ':'Solicitud comercial · ')+item.nombre,firma,setFirma,accept,setAccept,compact:true}),
      err&&React.createElement('div',{style:{color:'#C0341D',fontWeight:700,marginTop:10}},err),
      React.createElement(window.Btn,{full:true,icon:'check',disabled:busy||!accept||!firma||!documentGate.ready,style:{marginTop:14},onClick:send},busy?'Enviando…':documentGate.phase==='loading'?'Consultando documentos…':documentGate.missing?'Faltan '+documentGate.missing+' documentos':quoteRequest?'Enviar cotización':'Enviar solicitud'));
  }

  function QuoteBanner({ quote }) {
    if (quote.estado === 'solicitada') {
      return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, background: '#FFF3DC', border: '1px solid #F0DFB6', borderRadius: 14, padding: '12px 14px', marginTop: 14 } },
        React.createElement(I, { name: 'clock', size: 17, stroke: 2.2, style: { color: '#9A6B16', flexShrink: 0 } }),
        React.createElement('div', { style: { flex: 1, fontSize: 12.5, fontWeight: 700, color: '#7a5410', lineHeight: 1.45 } }, 'Cotización en proceso · ' + quote.folio + '. Puedes enviar otra solicitud sin detener esta revisión.'));
    }
    if (quote.estado === 'cotizada') {
      const c = quote.cotizacion || {};
      return React.createElement('div', { style: { background: '#E7F6ED', border: '1px solid #C4E8D2', borderRadius: 14, padding: '12px 14px', marginTop: 14 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
          React.createElement(I, { name: 'checkCircle', size: 17, stroke: 2.2, style: { color: '#13794A', flexShrink: 0 } }),
          React.createElement('div', { style: { flex: 1, fontSize: 13, fontWeight: 800, color: '#0b5c37' } }, 'Cotización lista · ' + window.money(c.monto || 0)),
          React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: '#13794A', fontFamily: 'var(--mono)' } }, quote.folio)));
    }
    return null;
  }

  Object.assign(window, { CatalogGrid, CatalogItemScreen });
})();
