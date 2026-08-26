/* screens-admin.jsx — Panel Administrativo: gate de acceso, menú de módulos
   y módulo de Pop-ups (listado + switch + duplicar + reordenar drag & drop).
   Exporta window.AdminScreen. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  const S = () => window.adminStore;

  // ─────────────────────────────────────────────────────────────
  // Gate de acceso (Super Administrador)
  // ─────────────────────────────────────────────────────────────
  function AdminGate({ app }) {
    const admin = app.admin;
    return React.createElement('div', { style: { minHeight: '100%', background: 'var(--grad-guinda)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '30px 24px', position: 'relative', overflow: 'hidden' } },
      React.createElement('div', { style: { position: 'absolute', right: -60, top: -50, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 240 })),
      React.createElement('div', { style: { position: 'relative', textAlign: 'center', color: '#fff', marginBottom: 26 } },
        React.createElement('div', { style: { width: 76, height: 76, borderRadius: 24, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.25)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', backdropFilter: 'blur(6px)' } }, React.createElement(I, { name: 'shield', size: 40, stroke: 1.8 })),
        React.createElement('h1', { style: { fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: '-.02em' } }, 'Panel Administrativo'),
        React.createElement('p', { style: { fontSize: 13.5, fontWeight: 600, opacity: .85, margin: '8px 0 0', lineHeight: 1.5 } }, 'Acceso protegido y verificado para esta cuenta.')),
      React.createElement('div', { style: { position: 'relative', background: 'var(--surface)', borderRadius: 22, padding: 20, boxShadow: 'var(--shadow-lg)' } },
        React.createElement('div', { 'data-h008-admin-access': admin.phase, style: { fontSize: 14, fontWeight: 800, color: admin.phase === 'denied' ? '#A32921' : 'var(--ink)', textAlign: 'center' } }, admin.phase === 'loading' ? 'Verificando permisos…' : admin.phase === 'error' ? 'No fue posible verificar tus permisos.' : 'Tu cuenta no tiene una asignación administrativa habilitada.'),
        admin.phase === 'error' && React.createElement(window.Btn, { full: true, size: 'lg', style: { marginTop: 16 }, onClick: admin.retry }, 'Reintentar'),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 14, lineHeight: 1.4 } }, 'Cargo, sindicato, puesto y número de control no conceden permisos.')));
  }

  // ─────────────────────────────────────────────────────────────
  // Menú de módulos
  // ─────────────────────────────────────────────────────────────
  const MODULES = [
    { id: 'identity_access', label: 'Identidad y expediente', icon: 'users', desc: 'Perfil editable e impersonación auditada', ready: true },
    { id: 'data_exports', label: 'Datos y respaldos', icon: 'download', desc: 'XLSX y CSV por dominio autorizado', ready: true },
    { id: 'popups', label: 'Pop-ups por pantalla', icon: 'message', desc: 'Anuncios y avisos configurables', ready: true },
    { id: 'sindicato', label: 'Tu Sindicato', icon: 'fist', desc: 'Contenido de las 9 pantallas', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'requests', label: 'Solicitudes', icon: 'receipt', desc: 'Trámites de programas y productos', ready: true },
    { id: 'finanzas', label: 'Finanzas · Solicitudes', icon: 'finance', desc: 'Solicitudes de financiamiento', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'fondos', label: 'Fondos y reglas', icon: 'finance', desc: 'Visibilidad SutiApp por criterio', classification: 'PRODUCTIVE_GOOGLE_CONTROLLED' },
    { id: 'fincat', label: 'Catálogo de Finanzas', icon: 'wallet', desc: 'Secciones y productos de Finanzas', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'flujos', label: 'Etapas y seguimiento', icon: 'clock', desc: 'Etapas por servicio y fechas reales', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'marketplace', label: 'Marketplace', icon: 'cart', desc: 'Productos, imágenes y precios por servicio', ready: true },
    { id: 'aprobaciones', label: 'Aprobación de Pop-ups', icon: 'checkCircle', desc: 'Pop-ups de empresas por revisar', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'planes', label: 'Planes de empresas', icon: 'handshake', desc: 'Beneficios, precios y ciclos de pago', ready: true },
    { id: 'membresias', label: 'Membresías', icon: 'card', desc: 'Empresas, conceptos, montos y pagos', ready: true },
    { id: 'noticias', label: 'Noticias del sindicato', icon: 'news', desc: 'Publicaciones y responsable', ready: true },
    { id: 'education', label: 'Educación y tutoriales', icon: 'book', desc: 'Recursos, enlaces e imágenes', ready: true },
    { id: 'convenios', label: 'Convenios y beneficios', icon: 'tag', desc: 'Segmentación y catálogos', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'catalogos', label: 'Catálogos de segmentación', icon: 'filter', desc: 'Sindicatos y categorías de empleado', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'roles', label: 'Roles y permisos', icon: 'users', desc: 'Ver, crear, editar, eliminar', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'pantallas', label: 'Acceso a pantallas', icon: 'lock', desc: 'Bloqueo por sindicato y categoría', classification: 'PRODUCTIVE_SUPABASE' },
    { id: 'secciones', label: 'Secciones y componentes', icon: 'grid', desc: 'Contenido y orden del frontend', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'banners', label: 'Banners', icon: 'image', desc: 'Publicidad y campañas', ready: true },
    { id: 'companies_admin', label: 'Empresas', icon: 'tag', desc: 'Directorio, logos y portadas', ready: true },
    { id: 'documents_admin', label: 'Documentos y PDF', icon: 'doc', desc: 'Descargas, formatos y normas', ready: true },
    { id: 'minutes_admin', label: 'Minutas', icon: 'doc', desc: 'Minutas y archivos institucionales', ready: true },
    { id: 'programs_admin', label: 'Programas institucionales', icon: 'fist', desc: 'Contenido y enlaces institucionales', ready: true },
    { id: 'menus', label: 'Menús y botones', icon: 'menu', desc: 'Navegación de la app', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'formularios', label: 'Formularios', icon: 'doc', desc: 'Campos y validaciones', classification: 'PRODUCTIVE_HYBRID' },
    { id: 'branding', label: 'Ícono e instalación', icon: 'sparkle', desc: 'Ícono e imágenes al instalar', ready: true },
  ];

  function AdminMenu({ app, onOpen }) {
    const assignment=app.admin.assignment||{permissions:[],sectionActions:[]};
    const sectionOnly=assignment.permissions.length===0&&assignment.sectionActions.length>0;
    const sectionModule={noticias:'news',education:['education','tutorials'],convenios:'agreements',companies_admin:'companies',banners:'banners',popups:'popups',documents_admin:'documents',minutes_admin:'minutes',programs_admin:'programs',marketplace:'marketplace'};
    const visibleModules=sectionOnly?MODULES.filter((m)=>m.id==='data_exports'?(assignment.sectionActions||[]).some((x)=>x.action==='export'):[].concat(sectionModule[m.id]||[]).some(key=>app.admin.has(key+'.read'))):MODULES;
    return React.createElement('div', null,
      React.createElement(AdminHeader, { title: 'Panel Administrativo', sub: 'Cuenta administrativa autorizada' }),
      React.createElement('div', { className: 'su-app-scroll su-stagger', style: { padding: 18 } },
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--neo-sm)', marginBottom: 18, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' } },
          'Cada herramienta muestra su fuente productiva o el bloqueo específico que impide activarla.'),
        React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '4px 0 12px' } }, 'MÓDULOS'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
          visibleModules.map((m) => {
            const permission = { identity_access:'affiliates.read',data_exports:'data_exports.read',branding:'assets.read',banners:'banners.read',popups:'popups.read',companies_admin:'companies.read',documents_admin:'documents.read',minutes_admin:'minutes.read',programs_admin:'programs.read',noticias:'news.read',education:sectionOnly?(app.admin.has('education.read')?'education.read':'tutorials.read'):'content.read',marketplace:'marketplace.read',membresias:'memberships.read',planes:'company_portal.read',requests:'program_requests.read',finanzas:'program_requests.read',fondos:'financial_criteria.visibility.read',aprobaciones:'popups.read',sindicato:'union_content.read',fincat:'workflow.read',flujos:'workflow.read',convenios:sectionOnly?'agreements.read':'companies.read',catalogos:'segmentation.read',roles:'authorization.read',pantallas:'segmentation.read',secciones:'content.read',menus:'content.read',formularios:'content.read'}[m.id];
            const sectionExport = m.id==='data_exports' && (assignment.sectionActions||[]).some((x)=>x.action==='export');
            const productive = m.ready || String(m.classification||'').startsWith('PRODUCTIVE_');
            const canView = m.id==='identity_access' || sectionExport || (permission ? app.admin.has(permission) : productive);
            const usable = productive && canView;
            const openable = usable || Boolean(m.classification);
            const badge = {PRODUCTIVE_SUPABASE:'ACTIVO',PRODUCTIVE_GOOGLE_CONTROLLED:'ACTIVO',PRODUCTIVE_GOOGLE_READONLY:'SOLO LECTURA',PRODUCTIVE_HYBRID:'ACTIVO',BLOCKED_FINANCIAL_LEGACY:'NO DISPONIBLE',BLOCKED_EXTERNAL_SOURCE:'FUENTE EXTERNA',OWNER_DECISION_REQUIRED:'DECISIÓN REQUERIDA'}[m.classification];
            return React.createElement('button', {
              key: m.id, 'data-admin-module': m.id, 'data-admin-status': m.classification|| (usable?'PRODUCTIVE_SUPABASE':'DENIED'), 'aria-disabled': !openable,
              onClick: () => { if (!openable) return app.toast('Tu cuenta no tiene acceso a esta herramienta'); onOpen(m.id); },
              style: { position: 'relative', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 18, padding: 15, boxShadow: 'var(--neo-sm)', cursor: openable?'pointer':'default', opacity: openable ? 1 : .55, fontFamily: 'inherit' },
            },
              React.createElement('div', { style: { width: 44, height: 44, borderRadius: 13, background: usable ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: usable ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', boxShadow: usable ? 'var(--glow-guinda)' : 'none' } }, React.createElement(I, { name: m.icon, size: 23, stroke: 2 })),
              React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginTop: 12, lineHeight: 1.2 } }, m.label),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.35 } }, m.desc),
              badge
                ? React.createElement('div', { style: { position: 'absolute', top: 13, right: 13, display: 'inline-flex', alignItems: 'center', gap: 4, background: usable?'#E7F6ED':'var(--surface-2)', color: usable?'#13794A':'var(--ink-3)', fontSize: 8.5, fontWeight: 800, letterSpacing: '.03em', padding: '4px 7px', borderRadius: 999, maxWidth: 102 } }, React.createElement(I, { name: usable?'checkCircle':'lock', size: 10, stroke: 2.4 }), badge)
                : (!canView && React.createElement('div', { style: { position: 'absolute', top: 13, right: 13, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FDEAEA', color: '#C0341D', fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', padding: '4px 8px', borderRadius: 999 } }, React.createElement(I, { name: 'ban', size: 11, stroke: 2.4 }), 'SIN ACCESO')));
          })),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 22, lineHeight: 1.5, padding: '0 10px' } }, 'Los cambios disponibles se guardan de forma segura y quedan registrados.')));
  }
  function statCard(icon, n, label, accent) {
    return React.createElement('div', { style: { flex: 1, background: accent ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: accent ? '#fff' : 'var(--ink)', borderRadius: 16, padding: '14px 16px', boxShadow: accent ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      React.createElement(I, { name: icon, size: 20, stroke: 2, style: { opacity: accent ? .9 : .5 } }),
      React.createElement('div', { style: { fontSize: 26, fontWeight: 900, marginTop: 6, letterSpacing: '-.02em' } }, n),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, opacity: accent ? .9 : .6, marginTop: 1 } }, label));
  }

  function AdminHeader({ title, sub, onBack }) {
    return React.createElement('div', { style: { background: 'var(--header-bg, var(--grad-guinda))', color: '#fff', padding: '10px 14px 16px', position: 'relative', overflow: 'hidden' } },
      React.createElement('div', { style: { position: 'absolute', right: -40, top: -40, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 150 })),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, position: 'relative' } },
        onBack && React.createElement('button', { onClick: onBack, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        !onBack && React.createElement('div', { style: { width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'shield', size: 24, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 19, fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.1 } }, title),
          sub && React.createElement('div', { style: { fontSize: 12, fontWeight: 600, opacity: .82, marginTop: 2 } }, sub)),
        React.createElement('button', { onClick: () => window.AffiliateAuth.signOut(), 'aria-label': 'Cerrar sesión', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 } }, React.createElement(I, { name: 'logout', size: 20, stroke: 2 }))));
  }

  // ─────────────────────────────────────────────────────────────
  // Módulo Pop-ups
  // ─────────────────────────────────────────────────────────────
  function PopupsModule({ app, onBack, onEdit }) {
    const store = useAdminStoreLocal();
    const [screenFilter, setScreenFilter] = useState('all');
    const [viewerOpen, setViewerOpen] = useState(false);
    const [previewItems, setPreviewItems] = useState(null);
    const viewer = store.viewer();
    const P = { crear: store.can('crear', 'popups'), editar: store.can('editar', 'popups'), eliminar: store.can('eliminar', 'popups'), reordenar: store.can('reordenar', 'popups') };

    const groups = A().SCREENS
      .filter((s) => screenFilter === 'all' || s.id === screenFilter)
      .map((s) => ({ screen: s, items: store.forScreen(s.id) }))
      .filter((g) => g.items.length > 0);

    return React.createElement('div', null,
      React.createElement(AdminHeader, { title: 'Pop-ups por pantalla', sub: store.all().length + ' pop-ups configurados', onBack }),
      React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 24px' } },
        // barra: filtro pantalla + nuevo
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1, position: 'relative' } },
            React.createElement('select', { value: screenFilter, onChange: (e) => setScreenFilter(e.target.value), style: { width: '100%', appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none', background: 'var(--surface)', boxShadow: 'var(--neo-sm)', borderRadius: 14, padding: '13px 40px 13px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer' } },
              React.createElement('option', { value: 'all' }, 'Todas las pantallas'),
              A().SCREENS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
          P.crear && React.createElement('button', { onClick: () => onEdit(store.blank(screenFilter === 'all' ? 'home' : screenFilter)), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 48, padding: '0 16px', borderRadius: 14, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)', flexShrink: 0 } },
            React.createElement(I, { name: 'plus', size: 19, stroke: 2.6 }), 'Nuevo')),

        // previsualizar como
        React.createElement(ViewerBar, { open: viewerOpen, setOpen: setViewerOpen, viewer, store }),

        // grupos
        groups.length === 0
          ? React.createElement(window.EmptyState, { icon: 'message', title: 'Sin pop-ups', sub: 'Crea el primero con el botón “Nuevo”.', action: P.crear && React.createElement(window.Btn, { variant: 'primary', icon: 'plus', onClick: () => onEdit(store.blank('home')) }, 'Nuevo pop-up') })
          : groups.map((g) => React.createElement('div', { key: g.screen.id, style: { marginTop: 18 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 } },
              React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: g.screen.icon, size: 17, stroke: 2 })),
              React.createElement('span', { style: { fontSize: 15, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, g.screen.label),
              React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 } }, g.items.length),
              g.items.length > 1 && P.reordenar && React.createElement('span', { style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' } }, React.createElement(I, { name: 'grip', size: 13, stroke: 2 }), 'arrastra para ordenar')),
            React.createElement(DragList, {
              ids: g.items.map((i) => i.id), screen: g.screen.id, store, viewer, perms: P,
              onEdit, onPreview: (p) => setPreviewItems([p]),
            }))),
      ),
      previewItems && React.createElement(window.AdminPopup, { items: previewItems, preview: true, onClose: () => setPreviewItems(null) }));
  }

  function ViewerBar({ open, setOpen, viewer, store }) {
    const seg = (label, value, options, key) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
        options.map((o) => React.createElement('button', {
          key: o, onClick: () => store.setViewer({ [key]: o }),
          style: { height: 32, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: value === o ? 'var(--guinda)' : 'var(--surface-2)', color: value === o ? '#fff' : 'var(--ink-2)', boxShadow: value === o ? 'none' : 'var(--neo-inset)' },
        }, o))));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: 'eye', size: 18, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Previsualizar como'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, viewer.cargo + ' · ' + viewer.sindicato + ' · ' + viewer.nivel + (viewer.registrado ? '' : ' · sin sesión'))),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '2px 15px 14px', borderTop: '1px solid var(--hairline)' } },
        React.createElement('div', { style: { height: 12 } }),
        seg('Cargo', viewer.cargo, A().CARGOS, 'cargo'),
        seg('Tipo de sindicato', viewer.sindicato, A().SINDICATOS, 'sindicato'),
        seg('Nivel', viewer.nivel, A().NIVELES, 'nivel'),
        React.createElement('button', { onClick: () => store.setViewer({ registrado: !viewer.registrado }), style: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: 'none', borderRadius: 11, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--neo-inset)' } },
          React.createElement(window.Toggle, { on: viewer.registrado, size: 'sm', glow: false, }),
          React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)' } }, viewer.registrado ? 'Usuario con sesión iniciada' : 'Usuario sin sesión'))));
  }

  // ── Lista con reordenamiento por arrastre (pointer, funciona en táctil) ──
  function DragList({ ids, screen, store, viewer, perms, onEdit, onPreview }) {
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };

    const begin = (e, id) => {
      e.preventDefault();
      setDragId(id);
      const move = (ev) => {
        const y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
        const cur = orderRef.current;
        const from = cur.indexOf(id);
        if (from < 0) return;
        let target = cur.length - 1;
        for (let i = 0; i < cur.length; i++) {
          const el = rowRefs.current[cur[i]];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (y < r.top + r.height / 2) { target = i; break; }
        }
        if (target !== from) {
          const next = cur.filter((x) => x !== id);
          next.splice(target, 0, id);
          setBoth(next);
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        setDragId(null);
        store.reorder(screen, orderRef.current);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', up);
    };

    window.useFlipRows(rowRefs, dragId);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      order.map((id, i) => {
        const p = store.get(id);
        if (!p) return null;
        const dragging = dragId === id;
        const hidden = p.enabled && !(store.dateActive(p) && store.audienceMatch(p, viewer));
        return React.createElement('div', {
          key: id, ref: (el) => { rowRefs.current[id] = el; },
          style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.02)' : 'none', transition: dragging ? 'none' : 'transform .16s', boxShadow: dragging ? 'var(--shadow-lg)' : 'none', borderRadius: 16 },
        }, React.createElement(PopupRow, { p, order: i + 1, dragging, hidden, perms, onGrab: perms.reordenar ? (e) => begin(e, id) : null, onEdit, onPreview, store }));
      }));
  }

  function PopupRow({ p, order, dragging, hidden, perms, onGrab, onEdit, onPreview, store }) {
    const aud = p.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    const iconBtn = (icon, onClick, tone) => React.createElement('button', {
      onClick: (e) => { e.stopPropagation(); onClick(); },
      style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 },
    }, React.createElement(I, { name: icon, size: 18, stroke: 2 }));

    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', gap: 0, background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden', opacity: p.enabled ? 1 : .6 } },
      // grip (solo si puede reordenar)
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 34, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 18, stroke: 2 }))
        : React.createElement('div', { style: { width: 10, flexShrink: 0 } }),
      // body (tap = editar, si tiene permiso)
      React.createElement('button', { onClick: () => (perms.editar ? onEdit(p) : onPreview(p)), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '12px 12px', cursor: 'pointer', fontFamily: 'inherit' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 11, fontWeight: 900, color: 'var(--guinda)', background: 'var(--guinda-50)', minWidth: 20, height: 20, padding: '0 5px', borderRadius: 6, display: 'inline-grid', placeItems: 'center' } }, order),
          React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 } }, p.titulo || 'Sin título')),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
          tagChip((aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'), audLabel),
          (p.startDate || p.endDate) && tagChip('calendar', 'Programado'),
          hidden && tagChip('ban', 'Oculto en vista', true),
          !p.enabled && tagChip('power', 'Inactivo'))),
      // actions
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 10px', justifyContent: 'center' } },
        iconBtn('eye', () => onPreview(p), 'var(--guinda)'),
        perms.crear && iconBtn('copy', () => store.duplicate(p.id))),
      // switch (activar/desactivar = editar)
      React.createElement('div', { style: { display: 'grid', placeItems: 'center', padding: '0 12px 0 2px' } },
        React.createElement(window.Toggle, { on: p.enabled, size: 'lg', onClick: (e) => { e.stopPropagation(); if (perms.editar) store.toggle(p.id); }, disabled: !perms.editar, 'aria-label': 'Activar', })));
  }
  function tagChip(icon, label, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  // hook local (evita depender del orden de carga de window.useAdminStore)
  function useAdminStoreLocal() {
    const [, force] = useState(0);
    useEffect(() => S().subscribe(() => force((n) => n + 1)), []);
    return S();
  }

  function ClassifiedModule({ module, onBack, header }) {
    const reasons={fondos:'Las reglas financieras se consultan desde el sistema autorizado.'};
    const labels={BLOCKED_FINANCIAL_LEGACY:'No disponible',BLOCKED_EXTERNAL_SOURCE:'Fuente no disponible',OWNER_DECISION_REQUIRED:'Decisión del propietario requerida'};
    return React.createElement('div',{'data-admin-view':module.id,'data-admin-classification':module.classification},
      header({title:module.label,sub:labels[module.classification]||module.classification,onBack}),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16}},
        React.createElement('div',{style:{background:'var(--surface)',borderRadius:18,padding:18,boxShadow:'var(--neo-sm)'}},
          React.createElement('div',{style:{width:48,height:48,borderRadius:14,display:'grid',placeItems:'center',background:'var(--surface-2)',color:'var(--guinda)',marginBottom:14}},React.createElement(I,{name:module.icon,size:24,stroke:2})),
          React.createElement('div',{style:{fontSize:16,fontWeight:900,color:'var(--ink)',marginBottom:8}},labels[module.classification]),
          React.createElement('div',{style:{fontSize:13,color:'var(--ink-2)',fontWeight:600,lineHeight:1.55}},reasons[module.id]),
          React.createElement('div',{style:{marginTop:14,padding:'10px 12px',borderRadius:12,background:'#FFF3DC',color:'#7A5410',fontSize:11.5,fontWeight:700,lineHeight:1.45}},'No se usa localStorage, DATA ni mocks como sustituto productivo. La interfaz Claude original permanece en el repositorio para reactivarse cuando exista autoridad aprobada.'))));
  }

  // ─────────────────────────────────────────────────────────────
  // Screen raíz del tab Admin
  // ─────────────────────────────────────────────────────────────
  function AdminScreen({ app }) {
    const [view, setView] = useState('menu');       // 'menu' | 'popups' | 'roles' | ...
    const [viewContext, setViewContext] = useState(null);
    const company=window.useCompanyStore?window.useCompanyStore():null;

    if (!app.admin || app.admin.phase !== 'authorized') {
      if(company&&company.state().phase==='loaded'&&company.companies().length)return React.createElement(window.CompanyScreen,{app});
      return React.createElement(AdminGate, { app });
    }

    const allowedViews = ['menu'].concat(MODULES.map((m)=>m.id)).concat(['directory_admin']);
    if (!allowedViews.includes(view)) { setView('menu'); return null; }

    const headerFn = (props) => React.createElement(AdminHeader, props);
    const backFromEditor = () => setView(viewContext ? 'sindicato' : 'menu');
    let body;
    if (view === 'identity_access') body = React.createElement(window.IdentityAccessModule, { app, onBack: () => setView('menu'), header: headerFn });
    else if (view === 'data_exports') body = React.createElement(window.DataExportsModule, { app, onBack: () => setView('menu'), header: headerFn });
    else if (view === 'branding') body = React.createElement(window.BrandingModule, { app, onBack: () => setView('menu'), header: headerFn, canEdit: app.admin.has('assets.write') });
    else if (view === 'noticias') body = React.createElement(window.NewsModule, { app, onBack: () => setView('menu'), header: headerFn });
    else if(view==='marketplace')body=React.createElement(window.MarketplaceModule,{app,onBack:()=>setView('menu'),header:headerFn,canEdit:app.admin.has('marketplace.create')||app.admin.has('marketplace.update')});
    else if(view==='membresias')body=React.createElement(window.MembresiasModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='documents_admin')body=React.createElement(window.DocumentsAdminModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='planes')body=React.createElement(window.PlanesModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='requests')body=React.createElement(window.RequestsModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='finanzas')body=React.createElement(window.FinanzasModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='fondos')body=React.createElement(window.FondosModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='aprobaciones')body=React.createElement(ApprovalsModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='sindicato')body=React.createElement(window.SindicatoModule,{app,onBack:()=>setView('menu'),header:headerFn,onOpenEditor:(id,context)=>{setViewContext(context||null);setView(id);}});
    else if(view==='fincat')body=React.createElement(window.FinCatModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='flujos')body=React.createElement(window.FlujosModule,{app,onBack:()=>setView('menu'),header:headerFn,canEdit:app.admin.has('workflow.write')});
    else if(view==='convenios')body=React.createElement(window.ConveniosModule,{app,onBack:backFromEditor,header:headerFn});
    else if(view==='catalogos')body=React.createElement(window.CatalogosModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='roles')body=React.createElement(window.RolesModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='pantallas')body=React.createElement(window.PantallasModule,{app,onBack:()=>setView('menu'),header:headerFn});
    else if(view==='secciones')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'secciones'});
    else if(view==='menus')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'menus',typeFilter:'menu',title:'Menús y botones'});
    else if(view==='formularios')body=React.createElement(window.ContentModule,{app,onBack:()=>setView('menu'),header:headerFn,resourceId:'formularios',typeFilter:'form',title:'Formularios'});
    else if((MODULES.find((m)=>m.id===view)||{}).classification&&!String((MODULES.find((m)=>m.id===view)||{}).classification).startsWith('PRODUCTIVE_'))body=React.createElement(ClassifiedModule,{module:MODULES.find((m)=>m.id===view),onBack:()=>setView('menu'),header:headerFn});
    else if (view !== 'menu') body = React.createElement(window.VisualCrudModule, { kind: view === 'companies_admin' ? 'companies' : view === 'documents_admin' ? 'documents' : view === 'minutes_admin' ? 'minutes' : view === 'programs_admin' ? 'programs' : view === 'directory_admin' ? 'directory' : view, app, onBack: backFromEditor, header: headerFn, filterKinds:viewContext&&viewContext.kinds, title:viewContext&&viewContext.title });
    else body = React.createElement(AdminMenu, { app, onOpen: (id) => { setViewContext(null); setView(id); } });

    return React.createElement('div', { style: { minHeight: '100%', background: 'var(--bg)' } }, body);
  }

  window.AdminScreen = AdminScreen;

  // ── Selector de acceso: Administrador o Empresa ──
  function AccessGate({ app }) {
    const [mode, setMode] = useState('admin');
    const seg = (id, label, icon) => React.createElement('button', { onClick: () => setMode(id), style: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: mode === id ? 'var(--surface)' : 'transparent', color: mode === id ? 'var(--guinda)' : 'rgba(255,255,255,.85)', boxShadow: mode === id ? 'var(--neo-sm)' : 'none' } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }), label);
    return React.createElement('div', { style: { minHeight: '100%', position: 'relative' } },
      React.createElement('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, padding: '14px 16px 0' } },
        React.createElement('div', { style: { display: 'flex', gap: 4, background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: 4 } },
          seg('admin', 'Administrador', 'shield'), seg('empresa', 'Empresa', 'handshake'))),
      React.createElement('div', { style: { paddingTop: 4 } }, mode === 'admin' ? React.createElement(AdminGate, { app }) : React.createElement(window.CompanyGate, { app })));
  }

  // ── Cola de aprobación de Pop-ups de empresas ──
  function ApprovalsModule({ app, onBack, header }) {
    const [rej, setRej] = useState(null);
    const [reason, setReason] = useState('');
    const [rows,setRows]=useState([]);
    const [phase,setPhase]=useState('loading');
    const load=async()=>{setPhase('loading');try{setRows((await window.PopupProposalRepository.list()).slice());setPhase('loaded');}catch(_){setRows([]);setPhase('error');}};
    useEffect(()=>{load();},[]);
    const pend = rows.filter((p)=>p.status==='pending');
    const recent = rows.filter((p)=>p.status==='approved'||p.status==='rejected').slice(0,20);
    const coName = (id,p) => p.empresaNombre || ((window.companyStore&&window.companyStore.get(id)||{}).name) || id || '—';
    const approve=async(id)=>{try{await window.PopupProposalRepository.review(id,true,'');await load();app.toast&&app.toast('Pop-up aprobado como borrador');}catch(_){app.toast&&app.toast('No se pudo aprobar');}};
    const reject=async(id)=>{try{await window.PopupProposalRepository.review(id,false,reason);setRej(null);setReason('');await load();app.toast&&app.toast('Pop-up rechazado');}catch(_){app.toast&&app.toast('No se pudo rechazar');}};
    return React.createElement('div', { 'data-admin-view':'aprobaciones' },
      header({ title: 'Aprobación de Pop-ups', sub: pend.length + ' pendiente(s)', onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16 } },
        phase==='error' ? React.createElement(window.EmptyState,{icon:'warning',title:'No fue posible cargar',sub:'Reintenta la consulta de propuestas.',actionLabel:'Reintentar',onAction:load}) :
        phase==='loading' ? React.createElement(window.EmptyState,{icon:'clock',title:'Cargando propuestas',sub:'Consultando la fuente productiva.'}) :
        pend.length === 0 ? React.createElement(window.EmptyState, { icon: 'checkCircle', title: 'Todo al día', sub: 'No hay pop-ups de empresas por revisar.' }) :
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
            pend.map((p) => React.createElement('div', { key: p.id, style: { background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)' } },
              React.createElement('div', { style: { height: 120, position: 'relative', background: `linear-gradient(150deg, hsl(${p.hue || 345},70%,42%), hsl(${p.hue || 345},65%,26%))` } },
                React.createElement('image-slot', { id: p.slotId, shape: 'rect', fit: 'cover', placeholder: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } }),
                React.createElement('div', { style: { position: 'absolute', top: 10, left: 10 } }, React.createElement(window.Badge, { tone: 'amber', icon: 'clock' }, 'PENDIENTE'))),
              React.createElement('div', { style: { padding: 14 } },
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--guinda)' } }, coName(p.ownerCompany,p)),
                React.createElement('div', { style: { fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 2 } }, p.titulo || 'Sin título'),
                p.contenido && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, marginTop: 5, lineHeight: 1.45 } }, p.contenido),
                rej === p.id
                  ? React.createElement('div', { style: { marginTop: 12 } },
                    React.createElement('input', { value: reason, autoFocus: true, placeholder: 'Motivo del rechazo…', onChange: (e) => setReason(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 } }),
                    React.createElement('div', { style: { display: 'flex', gap: 10 } },
                      React.createElement(window.Btn, { variant: 'outline', size: 'sm', style: { flex: 1 }, onClick: () => { setRej(null); setReason(''); } }, 'Cancelar'),
                      React.createElement(window.Btn, { size: 'sm', style: { flex: 1, background: '#C0341D', color: '#fff', boxShadow: 'none' }, disabled: !reason.trim(), onClick: () => reject(p.id) }, 'Confirmar rechazo')))
                  : React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 12 } },
                    React.createElement(window.Btn, { variant: 'outline', size: 'sm', icon: 'close', style: { flex: 1 }, onClick: () => { setRej(p.id); setReason(''); } }, 'Rechazar'),
                    React.createElement(window.Btn, { size: 'sm', icon: 'check', style: { flex: 1 }, onClick: () => approve(p.id) }, 'Aprobar')))))),
        recent.length > 0 && React.createElement('div', { style: { marginTop: 20 } },
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.05em', marginBottom: 10 } }, 'REVISADOS'),
          recent.map((p) => React.createElement('div', { key: p.id, style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 12, padding: '10px 13px', boxShadow: 'var(--neo-sm)', marginBottom: 8 } },
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.titulo),
            React.createElement(window.Badge, { tone: p.status === 'approved' ? 'green' : 'red', icon: p.status === 'approved' ? 'checkCircle' : 'close' }, p.status === 'approved' ? 'Aprobado' : 'Rechazado')))) ));
  }
})();
