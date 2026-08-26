/* screens-home.jsx — Inicio SUTISSSTESON (institutional). 3 hero variants. */
(function () {
  const { useEffect, useRef, useState } = React;
  const I = window.Icon, D = () => window.DATA;

  // ---------- HERO VARIANTS ----------
  function HeroAurora({ app, t }) {
    const u = app.user;
    return React.createElement('div', {
      style: {
        position: 'relative', overflow: 'hidden', color: '#fff',
        background: 'radial-gradient(120% 90% at 85% -10%, #b71436 0%, var(--guinda) 42%, var(--guinda-700) 100%)',
        padding: '18px 20px 22px', borderRadius: '0 0 28px 28px',
      },
    },
      React.createElement('div', { style: { position: 'absolute', right: -36, top: -28, opacity: .12 } },
        React.createElement(window.SutiSeal, { size: 180 })),
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(60,0,15,.28))' } }),
      React.createElement('div', { style: { position: 'relative' } },
        React.createElement('div', { style: { fontSize: 14.5, opacity: .82, fontWeight: 500 } }, saludo() + ','),
        React.createElement('div', { style: { fontSize: 25, fontWeight: 800, letterSpacing: '-.02em', marginTop: 1 } }, u.short),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 } },
          React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.16)', padding: '5px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, backdropFilter: 'blur(4px)' } },
            React.createElement(I, { name: 'shield', size: 13, stroke: 2.2 }), u.status),
          React.createElement('span', { style: { fontSize: 12.5, opacity: .8, fontWeight: 600 } }, u.numeroControl)),
        // balance peek
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 16 } },
          balanceChip('Afiliación', u.affiliation, 'shield'),
          balanceChip('Estatus', u.status, 'checkCircle')),
      ),
    );
  }
  function balanceChip(label, val, icon) {
    return React.createElement('div', { key: label, style: { flex: 1, background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 16, padding: '12px 13px', backdropFilter: 'blur(6px)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, opacity: .85, fontWeight: 600 } },
        React.createElement(I, { name: icon, size: 14, stroke: 2 }), label),
      React.createElement('div', { style: { fontSize: 20, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums' } }, val),
    );
  }

  function HeroWallet({ app, t }) {
    const u = app.user;
    return React.createElement('div', { style: { padding: '14px 16px 4px' } },
      React.createElement('div', {
        onClick: () => app.setTab('credencial'),
        className: 'su-press',
        style: {
          position: 'relative', overflow: 'hidden', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--guinda) 0%, #6a001b 70%, #4a0013 100%)',
          borderRadius: 24, padding: 18, color: '#fff', boxShadow: '0 18px 40px -16px rgba(145,0,34,.6)',
        },
      },
        React.createElement('div', { style: { position: 'absolute', right: -30, bottom: -40, opacity: .1 } }, React.createElement(window.SutiSeal, { size: 200 })),
        React.createElement('div', { style: { position: 'absolute', right: 16, top: 16, opacity: .9 } }, React.createElement(window.FistMark, { size: 30, color: '#fff' })),
        React.createElement('div', { style: { fontSize: 11.5, letterSpacing: '.14em', fontWeight: 700, opacity: .82 } }, 'CREDENCIAL DIGITAL'),
        React.createElement('div', { style: { fontSize: 21, fontWeight: 800, marginTop: 22, letterSpacing: '-.01em' } }, u.name),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 10.5, opacity: .7, fontWeight: 600, letterSpacing: '.08em' } }, 'No. AFILIADO'),
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', marginTop: 2 } }, u.numeroControl)),
          React.createElement('div', { style: { textAlign: 'right' } },
            React.createElement('div', { style: { fontSize: 10.5, opacity: .7, fontWeight: 600, letterSpacing: '.08em' } }, 'ESTATUS'),
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', marginTop: 2 } }, u.status)),
          React.createElement('div', { style: { width: 46, height: 46, background: '#fff', borderRadius: 10, display: 'grid', placeItems: 'center', color: 'var(--guinda)' } },
            React.createElement(I, { name: 'qr', size: 32, stroke: 1.6 }))),
      ),
      React.createElement('div', { style: { textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, padding: '10px 0 4px' } }, 'Toca tu credencial para ver el QR de acceso'),
    );
  }

  function HeroEditorial({ app, t }) {
    const u = app.user;
    const source = app.editorial || { phase: 'loading', news: [] };
    const n = source.phase === 'loaded' ? source.news[0] : null;
    return React.createElement('div', { style: { padding: '8px 20px 6px' } },
      React.createElement('div', { style: { fontSize: 14, color: 'var(--ink-3)', fontWeight: 600 } }, saludo() + ', ' + u.short),
      React.createElement('h1', { style: { fontSize: 28, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-.025em', margin: '4px 0 0', color: 'var(--ink)' } },
        'Tu sindicato, ', React.createElement('span', { style: { color: 'var(--guinda)' } }, 'en una sola app.')),
      React.createElement('div', {
        onClick: n ? () => app.push('articulo', { n }) : source.phase === 'error' ? source.retry : undefined,
        className: n ? 'su-press' : '', 'data-phase2-news-hero': source.phase === 'loaded' ? (n ? 'loaded' : 'empty') : source.phase,
        style: { marginTop: 16, borderRadius: 20, overflow: 'hidden', position: 'relative', height: 150, cursor: n || source.phase === 'error' ? 'pointer' : 'default', background: `linear-gradient(135deg, hsl(${n ? n.hue : 345} 55% 42%), hsl(${n ? n.hue : 345} 60% 28%))`, boxShadow: 'var(--neo-md)' },
      },
        n && n.image_url && React.createElement('img', { src: n.image_url, alt: '', 'data-shared-inner': '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }),
        React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 30%,rgba(0,0,0,.55))' } }),
        React.createElement('div', { style: { position: 'absolute', right: -10, top: -10, opacity: .16 } }, React.createElement(window.SutiSeal, { size: 130, mono: false })),
        React.createElement('div', { style: { position: 'absolute', left: 16, bottom: 14, right: 16, color: '#fff' } },
          n && n.tag && React.createElement(window.Badge, { tone: 'gold', solid: true, style: { marginBottom: 8 } }, n.tag.toUpperCase()),
          React.createElement('div', { style: { fontSize: 17, fontWeight: 800, lineHeight: 1.2, textWrap: 'pretty' } }, n ? n.title : source.phase === 'error' ? 'No pudimos cargar las noticias. Toca para reintentar.' : source.phase === 'loading' ? 'Cargando noticias…' : 'Noticias próximamente')),
      ),
    );
  }

  function saludo() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  // ---------- QUICK ACTIONS (orden y visibilidad administrables) ----------
  function QuickActions({ app }) {
    const map = {
      qa_prestamo: { res: 'home.qa.prestamo', label: 'Préstamo', go: () => app.push('loan') },
      qa_credencial: { res: 'home.qa.credencial', label: 'Credencial', go: () => app.setTab('credencial') },
      qa_convenios: { res: 'home.qa.convenios', label: 'Convenios', go: () => app.setTab('convenios') },
      qa_documentos: { res: 'home.qa.documentos', label: 'Documentos', go: () => app.push('documentos') },
    };
    const acts = Object.keys(map).map((id) => map[id]);
    return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + Math.min(acts.length, 4) + ',1fr)', gap: 10, padding: '0 20px' } },
      acts.map((a) => React.createElement('button', {
        key: a.label, onClick: a.go, className: 'su-press',
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
      },
        React.createElement('div', { style: { width: 58, height: 58, borderRadius: 18, background: 'var(--surface)', boxShadow: 'var(--neo-sm)', display: 'grid', placeItems: 'center', color: '#E43135' } },
          React.createElement(window.Res, { resKey: a.res, size: 25, stroke: 1.85 })),
        React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' } }, a.label))),
    );
  }

  // ---------- DYNAMIC BANNER ----------
  function Banner({ app }) {
    const visual = app.visual;
    const banners = visual && visual.homeBanners || [];
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [viewer, setViewer] = useState(false);
    const drag = useRef(null);
    useEffect(() => { if (index >= banners.length && banners.length) setIndex(0); }, [index, banners.length]);
    useEffect(() => {
      if (paused || viewer || banners.length < 2) return;
      const timer = setTimeout(() => setIndex((current) => (current + 1) % banners.length), 4600);
      return () => clearTimeout(timer);
    }, [index, paused, viewer, banners.length]);
    if (!visual || visual.phase === 'loading') {
      return React.createElement('div', { style: { padding: '0 20px' } },
        React.createElement('div', { className: 'su-skeleton', 'data-h0072-banner-state': 'loading', style: { height: 122, borderRadius: 20 } }));
    }
    if (visual.phase === 'error') {
      return React.createElement('div', { style: { padding: '0 20px' } },
        React.createElement('button', { onClick: visual.retry, 'data-h0072-banner-state': 'error', style: { width: '100%', minHeight: 72, border: 'none', borderRadius: 20, background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 700, boxShadow: 'var(--neo-sm)' } }, 'No pudimos cargar el anuncio. Reintentar'));
    }
    const banner = banners[index];
    if (!banner || !banner.image_url) return null;
    const begin = (event) => { drag.current = { id: event.pointerId, x: event.clientX }; setPaused(true); };
    const end = (event) => {
      const start = drag.current; drag.current = null; setPaused(false);
      if (!start || start.id !== event.pointerId || banners.length < 2) return;
      const distance = event.clientX - start.x;
      if (Math.abs(distance) > 45) setIndex((current) => (current + (distance < 0 ? 1 : banners.length - 1)) % banners.length);
    };
    const activate = () => { if (banner.action_url) { if (!window.openSafeContentUrl(banner.action_url)) app.toast && app.toast('El enlace configurado no es válido'); } else setViewer(true); };
    return React.createElement('div', { style: { padding: '0 20px' }, onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) },
      React.createElement('div', {
        'data-h0072-banner-state': 'loaded',
        'data-home-banner-index': index, onPointerDown: begin, onPointerUp: end, onPointerCancel: () => { drag.current = null; setPaused(false); },
        style: { position: 'relative', overflow: 'hidden', borderRadius: 20, height: 122, background: 'var(--surface)', boxShadow: 'var(--neo-sm)', touchAction: 'pan-y' },
      },
        React.createElement('button', { onClick: activate, 'aria-label': banner.action_url ? 'Abrir ' + (banner.title || 'anuncio') : 'Ampliar ' + (banner.title || 'anuncio'), style: { position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' } },
          React.createElement('img', { src: banner.image_url, alt: banner.title || 'Anuncio SutiApp', draggable: false, style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })),
        React.createElement('button', { onClick: (event) => { event.stopPropagation(); setViewer(true); }, 'aria-label': 'Ampliar imagen', style: { position: 'absolute', top: 9, right: 9, width: 34, height: 34, border: 'none', borderRadius: 11, background: 'rgba(0,0,0,.38)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'zoom-in' } }, React.createElement(I, { name: 'search', size: 17, stroke: 2.3 })),
        banner.action_label && React.createElement('span', { style: { position: 'absolute', left: 11, bottom: 9, padding: '5px 9px', borderRadius: 999, background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 10.5, fontWeight: 800, pointerEvents: 'none' } }, banner.action_label),
      ),
      banners.length > 1 && React.createElement('div', { 'data-home-banner-dots': '', style: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 9 } }, banners.map((item, itemIndex) => React.createElement('button', { key: item.id, onClick: () => setIndex(itemIndex), 'aria-label': 'Banner ' + (itemIndex + 1), style: { width: itemIndex === index ? 22 : 7, height: 7, border: 'none', borderRadius: 999, padding: 0, background: itemIndex === index ? 'var(--guinda)' : 'var(--hairline-strong)', transition: 'width .25s ease' } }))),
      viewer && window.ReactDOM.createPortal(
        React.createElement(window.ImageViewer, { sources: [banner.image_url], alt: banner.title || 'Anuncio SutiApp', onClose: () => setViewer(false) }),
        document.getElementById('root')),
    );
  }

  // ---------- NOTICIAS (administrables desde el panel) ----------
  function Noticias({ app }) {
    const source = app.editorial || { phase: 'loading', news: [] };
    const list = source.news || [];
    const railRef = React.useRef(null);
    // Escala y opacidad ligadas a la posición de scroll: la tarjeta centrada pesa
    // más que las laterales. Una lectura de rects por frame, escritura después.
    React.useEffect(() => {
      const el = railRef.current, M = window.MOTION;
      if (!el || !M || M.reduced() || M.frozen()) return;
      const paint = () => {
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, half = (r.width / 2) || 1;
        const kids = Array.prototype.slice.call(el.children);
        const ks = kids.map((c) => { const b = c.getBoundingClientRect(); return Math.max(0, 1 - Math.abs((b.left + b.width / 2) - cx) / half); });
        // El press del nodo se compone aquí: dos fuentes nunca escriben `transform`
        // sobre el mismo nodo por separado (el inline siempre ganaría al press).
        kids.forEach((c, i) => { c.style.transform = 'scale(calc(' + (0.94 + 0.06 * ks[i]).toFixed(3) + ' * var(--press-s, 1)))'; c.style.opacity = (0.74 + 0.26 * ks[i]).toFixed(3); });
      };
      return M.onScroll(el, paint);
    }, [list && list.length]);
    return React.createElement('div', null,
      React.createElement('div', { style: { padding: '0 20px' } }, React.createElement(window.SectionHead, { title: 'Noticias del sindicato', action: 'Ver todas', onAction: () => {}, icon: 'news' })),
      source.phase === 'loading' && React.createElement('div', { 'data-phase2-news-state': 'loading', className: 'su-skeleton', style: { height: 184, margin: '4px 20px 8px', borderRadius: 22 } }),
      source.phase === 'error' && React.createElement('button', { onClick: source.retry, 'data-phase2-news-state': 'error', style: { display: 'block', width: 'calc(100% - 40px)', minHeight: 92, margin: '4px 20px 8px', border: 'none', borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--neo-sm)', color: 'var(--ink-2)', fontWeight: 700 } }, 'No pudimos cargar las noticias. Reintentar'),
      source.phase === 'loaded' && list.length === 0 && React.createElement('div', { 'data-phase2-news-state': 'empty', style: { minHeight: 92, margin: '4px 20px 8px', borderRadius: 22, background: 'var(--surface)', boxShadow: 'var(--neo-sm)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700 } }, 'Aún no hay noticias publicadas.'),
      source.phase === 'loaded' && list.length > 0 && React.createElement('div', { ref: railRef, 'data-phase2-news-state': 'loaded', style: { display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 20px 8px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' } },
        list.map((n) => React.createElement('div', {
          key: n.id,
          onClick: (e) => { if (window.MOTION) window.MOTION.shared.captureFrom(e.currentTarget); app.push('articulo', { n }); },
          className: 'su-press',
          style: { width: 232, flexShrink: 0, cursor: 'pointer', background: 'var(--surface)', borderRadius: 22, padding: 10, boxShadow: 'var(--neo-md)', scrollSnapAlign: 'center', transformOrigin: 'center center' },
        },
          React.createElement('div', { 'data-shared-key': 'news:' + n.id, style: { height: 118, borderRadius: 16, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, hsl(${n.hue} 52% 44%), hsl(${n.hue} 58% 30%))` } },
            n.image_url && React.createElement('img', { src: n.image_url, alt: '', 'data-shared-inner': '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }),
            React.createElement('div', { style: { position: 'absolute', right: -8, bottom: -16, opacity: .14 } }, React.createElement(window.FistMark, { size: 78, color: '#fff' })),
            n.tag && React.createElement('div', { style: { position: 'absolute', top: 10, left: 10, zIndex: 2 } }, React.createElement(window.Badge, { tone: 'gold', solid: true }, n.tag.toUpperCase()))),
          React.createElement('div', { 'data-shared-title': '', style: { fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, margin: '11px 6px 0', color: 'var(--ink)', textWrap: 'pretty' } }, n.title),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, margin: '5px 6px 8px', display: 'flex', gap: 8 } }, n.date, React.createElement('span', null, '· ' + n.read + ' lectura')))),
      ),
    );
  }

  // ---------- ECOSISTEMA (institutional modules) ----------
  function Ecosistema({ app }) {
    const gridRef = React.useRef(null);
    window.useReveal(gridRef, { key: 'home:eco', step: 25, distance: 10 });
    const modules = window.UNION_SCREEN_REGISTRY;
    const open = (m) => m.frontend_route.type === 'tab'
      ? app.setTab(m.frontend_route.target)
      : app.push('modulo', { m });
    return React.createElement('div', { style: { padding: '0 20px' } },
      React.createElement(window.SectionHead, { title: 'Tu sindicato', icon: 'grid' }),
      React.createElement('div', { ref: gridRef, style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 } },
        modules.map((m) => React.createElement('button', {
          key: m.screen_key, 'data-h007-nav': m.screen_key, 'data-union-authority': m.authority_resource, onClick: () => open(m), className: 'su-press',
          style: { background: 'var(--surface)', border: 'none', outline: 'none', borderRadius: 20, padding: '16px 10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, cursor: 'pointer', boxShadow: 'var(--neo-md)', textAlign: 'center', minHeight: 116, justifyContent: 'center' },
        },
          React.createElement(window.IconTile, { icon: m.icon, size: 48, glow: true }),
          React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' } }, m.label))),
      ),
    );
  }

  // ---------- COMITÉ ----------
  function Comite({ app }) {
    const source = app.institutional;
    if (!source || source.phase === 'loading') return React.createElement('div', { 'data-h007-directory-state': 'loading', style: { padding: 20, color: 'var(--ink-3)', fontWeight: 700 } }, 'Cargando directorio...');
    if (source.phase === 'error') return React.createElement('div', { 'data-h007-directory-state': 'error', style: { padding: 20 } },
      React.createElement('div', { style: { color: 'var(--ink-2)', fontWeight: 700 } }, 'No pudimos cargar el directorio.'),
      React.createElement('button', { onClick: source.retry, style: { marginTop: 10 } }, 'Reintentar'));
    return React.createElement('div', null,
      React.createElement('div', { style: { padding: '0 20px' } }, React.createElement(window.SectionHead, { title: 'Comité Ejecutivo Estatal', icon: 'fist' })),
      React.createElement('div', { style: { display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' } },
        source.directory.map((c) => React.createElement('div', { key: c.id, 'data-h007-directory-member': '', style: { width: 132, flexShrink: 0, background: 'var(--surface)', borderRadius: 18, padding: 14, textAlign: 'center', boxShadow: 'var(--neo-sm)' } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'center', margin: '0 0 9px' } }, React.createElement(window.Avatar, { name: c.name || '', src: c.image_url || undefined, size: 50 })),
          React.createElement('div', { style: { fontSize: 13, fontWeight: 800, lineHeight: 1.2, color: 'var(--ink)' } }, c.name),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--guinda)', fontWeight: 600, marginTop: 3, lineHeight: 1.2 } }, c.role))),
      ),
    );
  }

  // ---------- BOTÓN INSTALAR PWA ----------
  function InstallButton({ app }) {
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    const [installed, setInstalled] = React.useState(isStandalone);
    const [hasPrompt, setHasPrompt] = React.useState(!!window.__sutiInstallPrompt);
    const visual = app.visual || { phase: 'loading', branding: null };
    const brand = visual.phase === 'loaded' ? visual.branding : null;
    React.useEffect(() => {
      const onBip = () => setHasPrompt(true);
      const onInst = () => { setInstalled(true); setHasPrompt(false); };
      window.addEventListener('sutibip', onBip);
      window.addEventListener('sutiinstalled', onInst);
      return () => { window.removeEventListener('sutibip', onBip); window.removeEventListener('sutiinstalled', onInst); };
    }, []);

    if (installed) {
      return React.createElement('div', {
        style: { margin: '16px auto 0', width: 'fit-content', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999, background: '#E7F6ED', color: '#13794A', fontSize: 13, fontWeight: 800 },
      },
        React.createElement(I, { name: 'checkCircle', size: 17, stroke: 2.2 }), 'App instalada');
    }

    const onClick = async () => {
      const p = window.__sutiInstallPrompt;
      if (p && p.prompt) {
        p.prompt();
        try { await p.userChoice; } catch (e) {}
        window.__sutiInstallPrompt = null; setHasPrompt(false);
        return;
      }
      const ua = navigator.userAgent || '';
      const isiOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isiOS) {
        app.toast('En iPhone/iPad: toca el botón Compartir y elige “Agregar a pantalla de inicio”.');
      } else if (/android/i.test(ua)) {
        app.toast('En Android: abre el menú ⋮ del navegador y elige “Instalar app” o “Agregar a pantalla de inicio”.');
      } else {
        app.toast('Abre el menú del navegador y elige “Instalar app” / “Agregar a pantalla de inicio”.');
      }
    };

    if (!brand) return React.createElement('div', {
      'data-install-branding-state': visual.phase,
      style: { margin: '18px 24px 0', padding: 12, borderRadius: 13, background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: 12, fontWeight: 700, textAlign: 'center' },
    }, visual.phase === 'error' ? 'No se pudo cargar la información de instalación.' : 'Cargando información de instalación…');

    return React.createElement('div', { 'data-install-branding-state': 'loaded', style: { marginTop: 18, padding: '0 24px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: 13, overflow: 'hidden', position: 'relative', background: 'var(--grad-guinda)', flexShrink: 0, boxShadow: 'var(--neo-sm)', pointerEvents: 'none' } },
          React.createElement('img', { src: brand.app_icon_url, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })),
        React.createElement('div', { style: { flex: 1, minWidth: 0, textAlign: 'left' } },
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, brand.app_name),
          React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, brand.description))),
      React.createElement('button', {
        onClick, className: 'su-press',
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 52, borderRadius: 15, border: 'none', cursor: 'pointer', background: 'var(--grad-guinda-soft)', color: '#fff', fontSize: 15.5, fontWeight: 800, fontFamily: 'inherit', boxShadow: 'var(--glow-guinda)' },
      },
        React.createElement(I, { name: 'download', size: 20, stroke: 2.2 }), 'Instalar app'),
      React.createElement('div', { style: { textAlign: 'center', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, marginTop: 8, lineHeight: 1.4 } },
        'Tenla en tu pantalla de inicio y úsala sin conexión'));
  }

  // ---------- FOOTER ----------
  function FooterInst({ app }) {
    return React.createElement('div', { style: { textAlign: 'center', padding: '12px 24px 8px' } },
      React.createElement('div', { style: { margin: '0 auto 10px', width: 'fit-content' } }, React.createElement(window.SutiSeal, { size: 58, mono: true })),
      React.createElement('div', { style: { fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: '.02em' } }, 'SUTISSSTESON'),
      React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500, marginTop: 3, lineHeight: 1.5 } }, 'Sindicato Único de Trabajadores del ISSSTESON'),
      React.createElement('div', { style: { fontSize: 11, color: 'var(--ink-3)', marginTop: 8 } }, 'Hermosillo, Sonora · v3.0'),
      React.createElement(InstallButton, { app }),
    );
  }

  // ---------- HOME SCREEN (orden y visibilidad de secciones administrables) ----------
  function HomeScreen({ app, t }) {
    const blocks = {
      quick_actions: () => React.createElement(QuickActions, { app }),
      banner_convenio: () => React.createElement(Banner, { app }),
      noticias: () => React.createElement(Noticias, { app }),
      ecosistema: () => React.createElement(Ecosistema, { app }),
      comite: () => React.createElement(Comite, { app }),
    };
    const defOrder = ['quick_actions', 'banner_convenio', 'noticias', 'ecosistema', 'comite'];
    const orderIds = defOrder;
    // M2.1 · coreografía real: cada bloque entra al entrar en viewport, una sola
    // vez por sesión (los re-render del panel admin no la repiten).
    const revealRef = React.useRef(null);
    if (window.useReveal) window.useReveal(revealRef, { key: 'home' });
    const wrap = (id, node) => React.createElement('div', { key: id, 'data-reveal-key': id }, node);
    return React.createElement('div', { className: 'su-route', style: { paddingBottom: 18 } },
      React.createElement(window.TopBar, { app, variant: 'home' }),
      React.createElement('div', { ref: revealRef, style: { display: 'flex', flexDirection: 'column', gap: 22, marginTop: 8 } },
        orderIds.map((id) => wrap(id, blocks[id]())),
        wrap('footer', React.createElement(FooterInst, { app })),
      ),
    );
  }

  window.HomeScreen = HomeScreen;
})();
