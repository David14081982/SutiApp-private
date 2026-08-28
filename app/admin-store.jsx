/* admin-store.jsx — Panel Administrativo: datos, persistencia y pop-up en vivo.
   Fuente única de verdad de los pop-ups administrables por pantalla.
   Exporta a window: ADMIN (registros), adminStore, useAdminStore, AdminPopup. */
(function () {
  const { useState, useEffect, useRef } = React;
  const I = window.Icon;

  // ─────────────────────────────────────────────────────────────
  // Registros (escalables: agrega entradas sin tocar la arquitectura)
  // ─────────────────────────────────────────────────────────────
  const SCREENS = [
    { id: 'home', label: 'Inicio', icon: 'home', group: 'Pantallas principales', nav: 'tab' },
    { id: 'financiera', label: 'Mi Financiera', icon: 'wallet', group: 'Pantallas principales', nav: 'tab' },
    { id: 'convenios', label: 'Convenios', icon: 'tag', group: 'Pantallas principales', nav: 'tab' },
    { id: 'historial', label: 'Mi Historial', icon: 'receipt', group: 'Pantallas principales', nav: 'tab' },
    { id: 'credencial', label: 'Mi Credencial', icon: 'idcard', group: 'Pantallas principales', nav: 'tab' },
    { id: 'documentos', label: 'Mis Documentos', icon: 'upload', group: 'Pantallas internas', nav: 'push' },
    { id: 'perfil', label: 'Mi Perfil', icon: 'user', group: 'Pantallas internas', nav: 'push' },
    { id: 'terreno', label: 'Suti Terrenos', icon: 'land', group: 'Pantallas internas', nav: 'push' },
    { id: 'notifs', label: 'Notificaciones', icon: 'bell', group: 'Pantallas internas', nav: 'push' },
    { id: 'loan', label: 'Solicitud de préstamo', icon: 'cash', group: 'Pantallas internas', nav: 'push' },
    { id: 'product', label: 'Detalle de producto', icon: 'grid', group: 'Pantallas internas', nav: 'push' },
    { id: 'convenio', label: 'Detalle de convenio', icon: 'gift', group: 'Pantallas internas', nav: 'push' },
    { id: 'tracking', label: 'Seguimiento de solicitud', icon: 'pin', group: 'Pantallas internas', nav: 'push' },
  ];
  const SCREEN = (id) => SCREENS.find((s) => s.id === id) || { id, label: id, icon: 'grid', nav: 'tab' };

  // Destinos válidos para "Abrir pantalla interna" (navegables sin parámetros)
  const NAV_TARGET_IDS = ['home', 'financiera', 'convenios', 'historial', 'credencial', 'documentos', 'perfil', 'terreno', 'notifs'];
  const NAV_TARGETS = SCREENS.filter((s) => NAV_TARGET_IDS.includes(s.id));

  // Segmentación (mismas reglas del sistema de permisos)
  const CARGOS = ['Afiliado', 'Delegado', 'Secretario', 'Comité Ejecutivo'];
  const SINDICATOS = ['SUTISSSTESON', 'SUEISSSTESON', 'SITISSSTESON', 'EMPLEADOS DE CONFIANZA'];
  const NIVELES = ['Suplentes Variables', 'Suplentes Fijos', 'Eventuales', 'Base', 'Confianza', 'Jubilados y Pens.'];
  const AUDIENCE_MODES = [
    { value: 'all', label: 'Todos', icon: 'globe', desc: 'Cualquier persona que abra la app' },
    { value: 'registered', label: 'Solo registrados', icon: 'user', desc: 'Usuarios con sesión iniciada' },
    { value: 'segment', label: 'Segmentado', icon: 'filter', desc: 'Por cargo, sindicato y nivel' },
  ];

  // Modos de acceso a PANTALLA COMPLETA (bloqueo de pantalla)
  const SCREEN_MODES = [
    { value: 'public', label: 'Público general', icon: 'globe', desc: 'Abierta a cualquiera, aunque no sea agremiado ni tenga sesión' },
    { value: 'guest', label: 'Solo no agremiados', icon: 'user', desc: 'Solo visitantes sin afiliación (invitación, campañas de alta)' },
    { value: 'registered', label: 'Solo agremiados', icon: 'idcard', desc: 'Afiliados con sesión iniciada, sin importar su sindicato' },
    { value: 'segment', label: 'Por sindicato / categoría', icon: 'filter', desc: 'Solo los perfiles de sindicato, categoría o cargo que elijas' },
  ];

  const ADMIN = { SCREENS, SCREEN, NAV_TARGETS, CARGOS, SINDICATOS, NIVELES, AUDIENCE_MODES, SCREEN_MODES };

  // ── Roles y permisos ──
  const ACTIONS = [
    { id: 'ver', label: 'Ver', icon: 'eye' },
    { id: 'crear', label: 'Crear', icon: 'plus' },
    { id: 'editar', label: 'Editar', icon: 'settings' },
    { id: 'eliminar', label: 'Eliminar', icon: 'trash' },
    { id: 'reordenar', label: 'Reordenar', icon: 'grip' },
  ];
  const MODULE_RESOURCES = [
    { id: 'popups', label: 'Pop-ups por pantalla', icon: 'message' },
    { id: 'sindicato', label: 'Tu Sindicato (9 pantallas)', icon: 'fist' },
    { id: 'finanzas', label: 'Finanzas · Solicitudes', icon: 'finance' },
    { id: 'fondos', label: 'Fondos y reglas de financiamiento', icon: 'finance' },
    { id: 'fincat', label: 'Catálogo de Finanzas', icon: 'wallet' },
    { id: 'flujos', label: 'Etapas y seguimiento', icon: 'clock' },
    { id: 'marketplace', label: 'Marketplace de productos', icon: 'cart' },
    { id: 'noticias', label: 'Noticias del sindicato', icon: 'news' },
    { id: 'convenios', label: 'Convenios y beneficios', icon: 'tag' },
    { id: 'catalogos', label: 'Catálogos de segmentación', icon: 'filter' },
    { id: 'secciones', label: 'Secciones y contenedores', icon: 'grid' },
    { id: 'pantallas', label: 'Acceso a pantallas', icon: 'lock' },
    { id: 'roles', label: 'Roles y permisos', icon: 'users' },
    { id: 'banners', label: 'Banners', icon: 'image' },
    { id: 'menus', label: 'Menús y botones', icon: 'menu' },
    { id: 'formularios', label: 'Formularios', icon: 'doc' },
    { id: 'branding', label: 'Ícono e instalación', icon: 'sparkle' },
    { id: 'planes', label: 'Planes de empresas', icon: 'handshake' },
  ];
  const SCREEN_RESOURCES = SCREENS.map((s) => ({ id: 'scr_' + s.id, label: s.label, icon: s.icon }));
  const RESOURCE_GROUPS = [
    { group: 'Módulos del panel', items: MODULE_RESOURCES },
    { group: 'Pantallas del frontend', items: SCREEN_RESOURCES },
  ];
  const ALL_RESOURCE_IDS = [].concat(MODULE_RESOURCES.map((m) => m.id), SCREEN_RESOURCES.map((s) => s.id));
  ADMIN.ACTIONS = ACTIONS;
  ADMIN.MODULE_RESOURCES = MODULE_RESOURCES;
  ADMIN.RESOURCE_GROUPS = RESOURCE_GROUPS;
  ADMIN.ALL_RESOURCE_IDS = ALL_RESOURCE_IDS;
  window.ADMIN = ADMIN;

  // ─────────────────────────────────────────────────────────────
  // Semillas (contenido inicial + preserva el pop-up de bienvenida)
  // ─────────────────────────────────────────────────────────────
  const seed = () => ([
    {
      id: 'pp_bienvenida', screen: 'home', enabled: true, priority: 1,
      etiqueta: 'BIENVENIDA', subtitulo: 'Tu súper app sindical',
      titulo: '¡Hola! Bienvenida a SutiApp',
      contenido: 'Consulta tu crédito, credencial digital, convenios y trámites en un solo lugar. Todo tu sindicato, en tu bolsillo.',
      slotId: 'pp_img_bienvenida', hue: 345,
      ctaText: 'Explorar la app', actionType: 'internal', actionTarget: 'financiera',
      startDate: '', endDate: '',
      audience: { mode: 'all', cargos: [], sindicatos: [], niveles: [] },
    },
    {
      id: 'pp_unilider', screen: 'home', enabled: true, priority: 2,
      etiqueta: 'CONVENIO DESTACADO', subtitulo: 'Unilíder',
      titulo: '50% de descuento en tu primera compra',
      contenido: 'Presenta tu credencial SUTISSSTESON en cualquier sucursal Unilíder y obtén 50% en tus mensualidades. Válido este mes.',
      slotId: 'promo_img_unilider', hue: 205,
      ctaText: 'Ver convenio', actionType: 'internal', actionTarget: 'convenios',
      startDate: '', endDate: '',
      audience: { mode: 'all', cargos: [], sindicatos: [], niveles: [] },
    },
    {
      id: 'pp_prestamo', screen: 'financiera', enabled: true, priority: 1,
      etiqueta: 'PRÉSTAMO EXPRÉS', subtitulo: 'Preaprobado para ti',
      titulo: 'Tienes un crédito preaprobado',
      contenido: 'Solicita hasta $80,000 a pagar vía nómina, sin aval y con respuesta en minutos. Oferta exclusiva para afiliados activos.',
      slotId: 'pp_img_prestamo', hue: 150,
      ctaText: 'Solicitar ahora', actionType: 'internal', actionTarget: 'financiera',
      startDate: '', endDate: '',
      audience: { mode: 'segment', cargos: [], sindicatos: ['SUTISSSTESON', 'SUEISSSTESON'], niveles: [] },
    },
    {
      id: 'pp_credencial', screen: 'credencial', enabled: false, priority: 1,
      etiqueta: 'AVISO', subtitulo: 'Renovación anual',
      titulo: 'Actualiza tu credencial digital',
      contenido: 'Mantén tus datos al día para seguir accediendo a todos los beneficios sindicales sin interrupciones.',
      slotId: 'pp_img_credencial', hue: 275,
      ctaText: 'Entendido', actionType: 'none', actionTarget: '',
      startDate: '', endDate: '',
      audience: { mode: 'registered', cargos: [], sindicatos: [], niveles: [] },
    },
  ]);

  // ─────────────────────────────────────────────────────────────
  // Persistencia + pub/sub
  // ─────────────────────────────────────────────────────────────
  const KEY = 'suti_admin_popups_v1';
  const VKEY = 'suti_admin_viewer_v1';
  const listeners = new Set();

  function safeParse(raw, fb) { try { const v = JSON.parse(raw); return v == null ? fb : v; } catch (e) { return fb; } }

  let popups = (function () {
    const raw = localStorage.getItem(KEY);
    return raw ? safeParse(raw, seed()) : seed();
  })();
  let viewer = safeParse(localStorage.getItem(VKEY), { cargo: 'Afiliado', sindicato: 'SUTISSSTESON', nivel: 'Base', registrado: true });

  // ── Roles: persistencia + semillas ──
  const RKEY = 'suti_admin_roles_v1';
  const ARKEY = 'suti_admin_acting_v1';
  function grant(actIds, resIds) {
    const p = {};
    resIds.forEach((rid) => { p[rid] = {}; ACTIONS.forEach((a) => { p[rid][a.id] = actIds.indexOf(a.id) !== -1; }); });
    return p;
  }
  function seedRoles() {
    const full = ['ver', 'crear', 'editar', 'eliminar', 'reordenar'];
    const editorPerms = grant(['ver', 'crear', 'editar', 'reordenar'], ALL_RESOURCE_IDS);
    editorPerms['roles'] = grant([], ['roles'])['roles'];   // Editor no administra roles
    const consultaPerms = grant(['ver'], ALL_RESOURCE_IDS);
    consultaPerms['roles'] = grant([], ['roles'])['roles'];
    return [
      { id: 'superadmin', name: 'Super Administrador', desc: 'Control total del sistema. No editable.', all: true, system: true, perms: {} },
      { id: 'admin', name: 'Administrador', desc: 'Gestiona todo el contenido y comportamiento.', system: false, perms: grant(full, ALL_RESOURCE_IDS) },
      { id: 'editor', name: 'Editor', desc: 'Crea, edita y reordena. Sin eliminar ni roles.', system: false, perms: editorPerms },
      { id: 'consulta', name: 'Consulta', desc: 'Solo lectura del contenido.', system: false, perms: consultaPerms },
    ];
  }
  let roles = safeParse(localStorage.getItem(RKEY), null) || seedRoles();
  let actingRoleId = localStorage.getItem(ARKEY) || 'superadmin';
  const persistRoles = () => { localStorage.setItem(RKEY, JSON.stringify(roles)); listeners.forEach((l) => l()); };
  const ruid = () => 'role_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const emit = () => { localStorage.setItem(KEY, JSON.stringify(popups)); listeners.forEach((l) => l()); };
  const uid = () => 'pp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function nextPriority(screen) {
    const p = popups.filter((x) => x.screen === screen).map((x) => x.priority || 0);
    return (p.length ? Math.max.apply(null, p) : 0) + 1;
  }

  const adminStore = {
    all: () => popups,
    forScreen: (id) => popups.filter((p) => p.screen === id).sort((a, b) => (a.priority || 0) - (b.priority || 0)),
    get: (id) => popups.find((p) => p.id === id),
    blank: (screen = 'home') => ({
      id: uid(), screen, enabled: true, priority: nextPriority(screen),
      etiqueta: '', subtitulo: '', titulo: '', contenido: '',
      slotId: 'pp_slot_' + Math.random().toString(36).slice(2, 8), hue: 345,
      ctaText: 'Ver más', actionType: 'none', actionTarget: '',
      startDate: '', endDate: '',
      audience: { mode: 'all', cargos: [], sindicatos: [], niveles: [] },
    }),
    save: (p) => {
      const i = popups.findIndex((x) => x.id === p.id);
      if (i >= 0) popups = popups.map((x) => (x.id === p.id ? p : x));
      else popups = [...popups, p];
      emit();
    },
    toggle: (id) => { popups = popups.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)); emit(); },
    remove: (id) => { popups = popups.filter((p) => p.id !== id); emit(); },
    duplicate: (id) => {
      const src = popups.find((p) => p.id === id);
      if (!src) return;
      const copy = { ...src, id: uid(), titulo: src.titulo + ' (copia)', enabled: false, priority: nextPriority(src.screen), slotId: 'pp_slot_' + Math.random().toString(36).slice(2, 8) };
      popups = [...popups, copy];
      emit();
    },
    reorder: (screen, orderedIds) => {
      const rank = {}; orderedIds.forEach((id, i) => { rank[id] = i + 1; });
      popups = popups.map((p) => (p.screen === screen && rank[p.id] != null ? { ...p, priority: rank[p.id] } : p));
      emit();
    },
    resetAll: () => { popups = seed(); emit(); },
    // viewer (previsualizar como)
    viewer: () => viewer,
    setViewer: (patch) => { viewer = { ...viewer, ...patch }; localStorage.setItem(VKEY, JSON.stringify(viewer)); listeners.forEach((l) => l()); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
  window.adminStore = adminStore;

  // ── Roles y permisos: API del store ──
  adminStore.roles = () => roles;
  adminStore.getRole = (id) => roles.find((r) => r.id === id);
  adminStore.actingRoleId = () => actingRoleId;
  adminStore.actingRole = () => roles.find((r) => r.id === actingRoleId) || roles.find((r) => r.id === 'superadmin');
  adminStore.setActingRole = (id) => { actingRoleId = id; localStorage.setItem(ARKEY, id); listeners.forEach((l) => l()); };
  adminStore.blankRole = () => ({ id: ruid(), name: '', desc: '', system: false, perms: grant([], ALL_RESOURCE_IDS) });
  adminStore.saveRole = (role) => {
    if (role.id === 'superadmin') return;
    const i = roles.findIndex((r) => r.id === role.id);
    if (i >= 0) roles = roles.map((r) => (r.id === role.id ? role : r));
    else roles = [...roles, role];
    persistRoles();
  };
  adminStore.duplicateRole = (id) => {
    const src = roles.find((r) => r.id === id); if (!src) return;
    roles = [...roles, { id: ruid(), name: src.name + ' (copia)', desc: src.desc, system: false, perms: src.all ? grant(['ver', 'crear', 'editar', 'eliminar', 'reordenar'], ALL_RESOURCE_IDS) : JSON.parse(JSON.stringify(src.perms)) }];
    persistRoles();
  };
  adminStore.removeRole = (id) => {
    const r = roles.find((x) => x.id === id); if (!r || r.system) return;
    roles = roles.filter((x) => x.id !== id);
    if (actingRoleId === id) { actingRoleId = 'superadmin'; localStorage.setItem(ARKEY, 'superadmin'); }
    persistRoles();
  };
  adminStore.roleActionCount = (role) => {
    if (role.all) return Infinity;
    let n = 0; Object.keys(role.perms || {}).forEach((rid) => ACTIONS.forEach((a) => { if (role.perms[rid][a.id]) n++; }));
    return n;
  };
  // ¿El rol activo puede <action> sobre <resource>?
  adminStore.can = (action, resource) => {
    const r = adminStore.actingRole();
    if (!r) return false;
    if (r.all) return true;
    // roles guardados antes de existir el módulo Planes heredan el permiso de Convenios
    // roles guardados antes de existir un módulo heredan el permiso del más cercano
    const rp = r.perms && (r.perms[resource] || (resource === 'planes' || resource === 'membresias' ? r.perms['convenios'] : (resource === 'pantallas' ? r.perms['secciones'] : null)));
    return !!(rp && rp[action]);
  };

  // ─────────────────────────────────────────────────────────────
  // Gestor de contenido del frontend (secciones, contenedores,
  // botones, menús, componentes, banners, formularios…)
  // ─────────────────────────────────────────────────────────────
  const CONTENT_TYPES = [
    { id: 'section', label: 'Sección', icon: 'grid' },
    { id: 'container', label: 'Contenedor', icon: 'grid' },
    { id: 'button', label: 'Botón', icon: 'tag' },
    { id: 'menu', label: 'Menú', icon: 'menu' },
    { id: 'component', label: 'Componente', icon: 'sparkle' },
    { id: 'banner', label: 'Banner', icon: 'image' },
    { id: 'form', label: 'Formulario', icon: 'doc' },
  ];
  ADMIN.CONTENT_TYPES = CONTENT_TYPES;
  const CTYPE = (id) => CONTENT_TYPES.find((c) => c.id === id) || CONTENT_TYPES[0];
  ADMIN.CTYPE = CTYPE;

  const CKEY = 'suti_admin_content_v1';
  const openAud = () => ({ mode: 'all', cargos: [], sindicatos: [], niveles: [] });
  function seedContent() {
    const N = (screen, id, parentId, type, label, order, locked) => ({ id, screen, parentId, type, label, visible: true, locked: !!locked, order, audience: openAud() });
    return [
      // ── Inicio (conectado en vivo) ──
      N('home', 'quick_actions', null, 'section', 'Accesos rápidos', 1),
      N('home', 'qa_prestamo', 'quick_actions', 'button', 'Préstamo', 1),
      N('home', 'qa_credencial', 'quick_actions', 'button', 'Credencial', 2),
      N('home', 'qa_convenios', 'quick_actions', 'button', 'Convenios', 3),
      N('home', 'qa_documentos', 'quick_actions', 'button', 'Documentos', 4),
      N('home', 'banner_convenio', null, 'banner', 'Banner: Convenio Unilíder', 2),
      N('home', 'noticias', null, 'section', 'Noticias del sindicato', 3),
      N('home', 'ecosistema', null, 'section', 'Tu sindicato (módulos)', 4),
      N('home', 'comite', null, 'section', 'Comité Ejecutivo', 5),
      // ── Mi Financiera ──
      N('financiera', 'fin_saldo', null, 'component', 'Resumen de saldo', 1),
      N('financiera', 'fin_productos', null, 'section', 'Productos financieros', 2),
      N('financiera', 'fin_recomendados', null, 'section', 'Recomendados para ti', 3),
      // ── Convenios ──
      N('convenios', 'conv_buscador', null, 'component', 'Buscador de convenios', 1),
      N('convenios', 'conv_categorias', null, 'section', 'Categorías', 2),
      N('convenios', 'conv_anuncios', null, 'banner', 'Anuncios patrocinados', 3),
      // ── Mi Credencial ──
      N('credencial', 'cred_tarjeta', null, 'component', 'Tarjeta de credencial', 1),
      N('credencial', 'cred_qr', null, 'button', 'Botón mostrar QR', 2),
    ];
  }
  // Approved owner decision: frontend structure is versioned code, never browser storage.
  let content = seedContent();
  const persistContent = () => { listeners.forEach((l) => l()); };
  const cuid = () => 'node_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const norm = (v) => v || null;

  adminStore.contentAll = () => content;
  adminStore.contentChildren = (screen, parentId) => content.filter((n) => n.screen === screen && norm(n.parentId) === norm(parentId)).sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.getNode = (id) => content.find((n) => n.id === id);
  adminStore.nodeVisible = (node, v) => node.visible !== false && audienceMatch(node, v || viewer);
  // Nodos visibles para el frontend en vivo. null = no hay nodos definidos (usar orden por defecto)
  adminStore.liveNodes = (screen, parentId, v) => {
    const all = content.filter((n) => n.screen === screen && norm(n.parentId) === norm(parentId));
    if (!all.length) return null;
    return all.filter((n) => adminStore.nodeVisible(n, v)).sort((a, b) => (a.order || 0) - (b.order || 0));
  };
  adminStore.blankNode = (screen, parentId, type) => ({ id: cuid(), screen, parentId: norm(parentId), type: type || 'component', label: '', visible: true, locked: false, order: (adminStore.contentChildren(screen, parentId).slice(-1)[0] || { order: 0 }).order + 1, audience: openAud() });
  adminStore.saveNode = (node) => {
    const i = content.findIndex((n) => n.id === node.id);
    if (i >= 0) content = content.map((n) => (n.id === node.id ? node : n));
    else content = [...content, node];
    persistContent();
  };
  adminStore.toggleNode = (id) => { content = content.map((n) => (n.id === id ? { ...n, visible: n.visible === false } : n)); persistContent(); };
  adminStore.removeNode = (id) => { content = content.filter((n) => n.id !== id && n.parentId !== id); persistContent(); };
  adminStore.duplicateNode = (id) => {
    const s = content.find((n) => n.id === id); if (!s) return;
    content = [...content, { ...s, id: cuid(), label: s.label + ' (copia)', visible: false, locked: false, order: (adminStore.contentChildren(s.screen, s.parentId).slice(-1)[0] || { order: 0 }).order + 1 }];
    persistContent();
  };
  adminStore.reorderContent = (screen, parentId, orderedIds) => {
    const rank = {}; orderedIds.forEach((id, i) => { rank[id] = i + 1; });
    content = content.map((n) => (n.screen === screen && norm(n.parentId) === norm(parentId) && rank[n.id] != null ? { ...n, order: rank[n.id] } : n));
    persistContent();
  };
  adminStore.resetContent = () => { content = seedContent(); persistContent(); };

  // ─────────────────────────────────────────────────────────────
  // Noticias del sindicato (contenido + orden + visibilidad + responsable)
  // ─────────────────────────────────────────────────────────────
  const NKEY = 'suti_admin_news_v1';
  const NSKEY = 'suti_admin_news_settings_v1';
  const NEWS_BODY = 'La dirigencia del SUTISSSTESON informa a todos los afiliados los puntos más relevantes acordados, en el marco de nuestros principios de justicia, transparencia y unidad.\n\nSe reafirma el compromiso de fortalecer los programas de beneficios, ampliar los convenios disponibles y mantener canales de comunicación abiertos con cada sección.\n\nInvitamos a los agremiados a consultar los formatos y reglamentos actualizados directamente desde SutiApp, así como a dar seguimiento a sus solicitudes en la sección Mi Historial.';
  function seedNews() {
    return [
      { id: 'news_1', tag: 'Asamblea', title: 'Resultados de la Asamblea General de mayo', date: '24 May 2026', read: '3 min', hue: 345, slotId: 'news_img_1', body: NEWS_BODY, visible: true, order: 1, audience: openAud() },
      { id: 'news_2', tag: 'Beneficio', title: 'Nuevo convenio con Universidad Kino: becas 2026', date: '22 May 2026', read: '2 min', hue: 36, slotId: 'news_img_2', body: NEWS_BODY, visible: true, order: 2, audience: openAud() },
      { id: 'news_3', tag: 'Salud', title: 'Jornada de salud gratuita para afiliados y familia', date: '19 May 2026', read: '1 min', hue: 150, slotId: 'news_img_3', body: NEWS_BODY, visible: true, order: 3, audience: openAud() },
    ];
  }
  // Phase 2 cutover: retained API surface is inert; Supabase repositories own this domain.
  let news = [];
  let newsSettings = { responsableNombre: '', responsableCargo: '', responsableRol: '' };
  const persistNews = () => { listeners.forEach((l) => l()); };
  const nuid = () => 'news_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nextNewsOrder = () => (news.length ? Math.max.apply(null, news.map((n) => n.order || 0)) : 0) + 1;

  adminStore.newsAll = () => news.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.getNews = (id) => news.find((n) => n.id === id);
  adminStore.newsLive = (v) => news.filter((n) => n.visible !== false && audienceMatch(n, v || viewer)).sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.newsVisibleFor = (n, v) => n.visible !== false && audienceMatch(n, v || viewer);
  adminStore.blankNews = () => ({ id: nuid(), tag: '', title: '', date: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }), read: '2 min', hue: 345, slotId: 'news_img_' + Math.random().toString(36).slice(2, 8), body: '', visible: true, order: nextNewsOrder(), audience: openAud() });
  adminStore.saveNews = (n) => { const i = news.findIndex((x) => x.id === n.id); if (i >= 0) news = news.map((x) => (x.id === n.id ? n : x)); else news = [...news, n]; persistNews(); };
  adminStore.toggleNews = (id) => { news = news.map((n) => (n.id === id ? { ...n, visible: n.visible === false } : n)); persistNews(); };
  adminStore.removeNews = (id) => { news = news.filter((n) => n.id !== id); persistNews(); };
  adminStore.duplicateNews = (id) => { const s = news.find((n) => n.id === id); if (!s) return; news = [...news, { ...s, id: nuid(), title: s.title + ' (copia)', visible: false, order: nextNewsOrder(), slotId: 'news_img_' + Math.random().toString(36).slice(2, 8) }]; persistNews(); };
  adminStore.reorderNews = (orderedIds) => { const rank = {}; orderedIds.forEach((id, i) => { rank[id] = i + 1; }); news = news.map((n) => (rank[n.id] != null ? { ...n, order: rank[n.id] } : n)); persistNews(); };
  adminStore.resetNews = () => { news = []; persistNews(); };
  adminStore.newsSettings = () => newsSettings;
  adminStore.setNewsSettings = (patch) => { newsSettings = { ...newsSettings, ...patch }; listeners.forEach((l) => l()); };

  // ─────────────────────────────────────────────────────────────
  // Acceso por PANTALLA COMPLETA (bloqueo por sindicato / categoría,
  // apertura a público general y a no agremiados). Por defecto todas
  // las pantallas quedan como 'public' → el frontend no cambia.
  // ─────────────────────────────────────────────────────────────
  const SAKEY = 'suti_admin_screen_access_v1';
  const blankAccess = () => ({ mode: 'public', sindicatos: [], niveles: [], cargos: [], hideTab: true, mensaje: '' });
  let screenAccess = safeParse(localStorage.getItem(SAKEY), null) || {};
  const persistAccess = () => { localStorage.setItem(SAKEY, JSON.stringify(screenAccess)); listeners.forEach((l) => l()); };

  adminStore.screenAccess = (id) => Object.assign(blankAccess(), screenAccess[id] || {});
  adminStore.screenAccessAll = () => SCREENS.map((s) => Object.assign({ screen: s.id }, adminStore.screenAccess(s.id)));
  adminStore.saveScreenAccess = (id, patch) => {
    screenAccess[id] = Object.assign(adminStore.screenAccess(id), patch || {});
    persistAccess();
    const m = (SCREEN_MODES.find((x) => x.value === screenAccess[id].mode) || {}).label;
    adminStore.log('Panel', 'Cambió el acceso de pantalla', SCREEN(id).label + ' → ' + m);
  };
  adminStore.resetScreenAccess = (id) => { if (id) delete screenAccess[id]; else screenAccess = {}; persistAccess(); };
  // ¿El espectador puede entrar a esta pantalla?
  adminStore.screenAllowed = (id, v) => {
    const a = adminStore.screenAccess(id);
    v = v || viewer;
    const ok = (arr, val) => !arr || arr.length === 0 || arr.indexOf(val) !== -1;
    if (a.mode === 'guest') return !v.registrado;
    if (a.mode === 'registered') return !!v.registrado;
    if (a.mode === 'segment') return !!v.registrado && ok(a.sindicatos, v.sindicato) && ok(a.niveles, v.nivel) && ok(a.cargos, v.cargo);
    return true;   // public
  };
  // Motivo del bloqueo, para el mensaje que ve el usuario
  adminStore.screenBlockReason = (id, v) => {
    const a = adminStore.screenAccess(id);
    v = v || viewer;
    if (a.mensaje) return a.mensaje;
    if (a.mode === 'guest') return 'Esta sección es para visitantes que aún no están afiliados.';
    if (!v.registrado) return 'Necesitas iniciar sesión como afiliado para ver esta sección.';
    return 'Esta sección está disponible solo para ciertos sindicatos o categorías de empleo.';
  };
  // ¿Se oculta su pestaña en el menú inferior?
  adminStore.tabHidden = (id, v) => !adminStore.screenAllowed(id, v) && adminStore.screenAccess(id).hideTab !== false;

  // ─────────────────────────────────────────────────────────────
  // Catálogos dinámicos: Sindicatos y Categorías de empleado
  // (agregar/editar/eliminar sin tocar código). Alimentan el motor
  // único de segmentación (audienceMatch) en toda la app.
  // ─────────────────────────────────────────────────────────────
  const CATKEY = 'suti_admin_catalogs_v1';
  let catalogs = safeParse(localStorage.getItem(CATKEY), { sindicatos: SINDICATOS.slice(), categorias: NIVELES.slice() });
  if (!catalogs.sindicatos) catalogs.sindicatos = SINDICATOS.slice();
  if (!catalogs.categorias) catalogs.categorias = NIVELES.slice();
  // Claves opcionales por entrada de catálogo (p. ej. Base → 1, Jubilados y Pens. → JUB)
  if (!catalogs.claves) catalogs.claves = { sindicatos: {}, categorias: { 'Suplentes Variables': '3', 'Suplentes Fijos': '1', 'Eventuales': '1', 'Base': '1', 'Jubilados y Pens.': 'JUB' } };
  if (!catalogs.claves.sindicatos) catalogs.claves.sindicatos = {};
  if (!catalogs.claves.categorias) catalogs.claves.categorias = {};
  const applyCatalogs = () => { ADMIN.SINDICATOS = catalogs.sindicatos; ADMIN.NIVELES = catalogs.categorias; };
  applyCatalogs();
  const persistCat = () => { localStorage.setItem(CATKEY, JSON.stringify(catalogs)); applyCatalogs(); listeners.forEach((l) => l()); };
  adminStore.catalogs = () => catalogs;
  adminStore.catalogClave = (kind, name) => (catalogs.claves[kind] || {})[name] || '';
  adminStore.setCatalogClave = (kind, name, clave) => { const m = { ...catalogs.claves[kind] }; clave = (clave || '').trim(); if (clave) m[name] = clave; else delete m[name]; catalogs = { ...catalogs, claves: { ...catalogs.claves, [kind]: m } }; persistCat(); };
  adminStore.addCatalog = (kind, val, clave) => { val = (val || '').trim(); if (!val || catalogs[kind].indexOf(val) !== -1) return; catalogs = { ...catalogs, [kind]: [...catalogs[kind], val] }; if ((clave || '').trim()) catalogs.claves = { ...catalogs.claves, [kind]: { ...catalogs.claves[kind], [val]: clave.trim() } }; persistCat(); };
  adminStore.renameCatalog = (kind, oldV, val) => { val = (val || '').trim(); if (!val) return; const m = { ...catalogs.claves[kind] }; if (m[oldV] != null && oldV !== val) { m[val] = m[oldV]; delete m[oldV]; } catalogs = { ...catalogs, [kind]: catalogs[kind].map((x) => (x === oldV ? val : x)), claves: { ...catalogs.claves, [kind]: m } }; persistCat(); };
  adminStore.removeCatalog = (kind, val) => { const m = { ...catalogs.claves[kind] }; delete m[val]; catalogs = { ...catalogs, [kind]: catalogs[kind].filter((x) => x !== val), claves: { ...catalogs.claves, [kind]: m } }; persistCat(); };

  // ─────────────────────────────────────────────────────────────
  // Convenios y beneficios (empresa/convenio + segmentación por
  // sindicato y categoría). Reutiliza audienceMatch como motor único.
  // ─────────────────────────────────────────────────────────────
  const CVKEY = 'suti_admin_convenios_v1';
  function seedConvenios() {
    const src = (window.DATA && window.DATA.convenios) || [];
    return src.map((c, i) => ({
      id: 'cv_' + c.id, name: c.name, cat: c.cat, disc: c.disc, hue: c.hue,
      tags: c.tags || [], addr: c.addr || '', price: c.price != null ? c.price : null, was: c.was != null ? c.was : null,
      fav: !!c.fav, featured: !!c.featured, slotId: 'cv_img_' + c.id,
      visible: true, order: i + 1, audience: openAud(),
      beneficios: (c.tags || []).slice(0, 3).map((tg, j) => ({ id: 'ben_' + c.id + '_' + j, label: tg, desc: tg + ' con descuento preferente para afiliados.', visible: true, order: j + 1, audience: openAud() })),
    }));
  }
  let convenios = safeParse(localStorage.getItem(CVKEY), null) || seedConvenios();
  const persistCv = () => { localStorage.setItem(CVKEY, JSON.stringify(convenios)); listeners.forEach((l) => l()); };
  const cvuid = () => 'cv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nextCvOrder = () => (convenios.length ? Math.max.apply(null, convenios.map((c) => c.order || 0)) : 0) + 1;

  adminStore.conveniosAll = () => convenios.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.getConvenio = (id) => convenios.find((c) => c.id === id);
  adminStore.conveniosLive = (v) => convenios.filter((c) => c.visible !== false && audienceMatch(c, v || viewer)).sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.convenioVisibleFor = (c, v) => c.visible !== false && audienceMatch(c, v || viewer);
  adminStore.blankConvenio = () => ({ id: cvuid(), name: '', cat: (window.DATA && window.DATA.conveniosCats && window.DATA.conveniosCats[0] && window.DATA.conveniosCats[0].label) || 'Comerciales', disc: 10, hue: 210, tags: [], addr: '', price: null, was: null, fav: false, featured: false, slotId: 'cv_img_' + Math.random().toString(36).slice(2, 8), visible: true, order: nextCvOrder(), audience: openAud(), beneficios: [] });
  adminStore.saveConvenio = (c) => { const i = convenios.findIndex((x) => x.id === c.id); if (i >= 0) convenios = convenios.map((x) => (x.id === c.id ? c : x)); else convenios = [...convenios, c]; persistCv(); };
  adminStore.toggleConvenio = (id) => { convenios = convenios.map((c) => (c.id === id ? { ...c, visible: c.visible === false } : c)); persistCv(); };
  adminStore.removeConvenio = (id) => { convenios = convenios.filter((c) => c.id !== id); persistCv(); };
  adminStore.duplicateConvenio = (id) => { const s = convenios.find((c) => c.id === id); if (!s) return; convenios = [...convenios, { ...s, id: cvuid(), name: s.name + ' (copia)', visible: false, order: nextCvOrder(), slotId: 'cv_img_' + Math.random().toString(36).slice(2, 8) }]; persistCv(); };
  adminStore.reorderConvenios = (orderedIds) => { const rank = {}; orderedIds.forEach((id, i) => { rank[id] = i + 1; }); convenios = convenios.map((c) => (rank[c.id] != null ? { ...c, order: rank[c.id] } : c)); persistCv(); };
  adminStore.resetConvenios = () => { convenios = seedConvenios(); persistCv(); };

  // Beneficios por convenio (planes/servicios segmentables dentro del detalle)
  adminStore.convenioBeneficios = (id) => { const c = convenios.find((x) => x.id === id); return (c && c.beneficios) || []; };
  adminStore.convenioBeneficiosLive = (id, v) => adminStore.convenioBeneficios(id).filter((b) => b.visible !== false && audienceMatch(b, v || viewer)).sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.blankBeneficio = (convId) => ({ id: 'ben_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), label: '', desc: '', visible: true, order: (adminStore.convenioBeneficios(convId).slice(-1)[0] || { order: 0 }).order + 1, audience: openAud() });

  // ─────────────────────────────────────────────────────────────
  // Anuncios patrocinados / campañas publicitarias (segmentables)
  // ─────────────────────────────────────────────────────────────
  const ADKEY = 'suti_admin_anuncios_v1';
  function seedAnuncios() {
    const src = (window.DATA && window.DATA.anuncios) || [];
    return src.map((a, i) => ({ id: 'ad_' + (a.id || i), empresa: a.empresa, etiqueta: a.etiqueta, slotId: a.slotId, link: a.link || '#', hue: a.hue, visible: true, order: i + 1, audience: openAud() }));
  }
  let anuncios = safeParse(localStorage.getItem(ADKEY), null) || seedAnuncios();
  const persistAd = () => { localStorage.setItem(ADKEY, JSON.stringify(anuncios)); listeners.forEach((l) => l()); };
  const aduid = () => 'ad_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const nextAdOrder = () => (anuncios.length ? Math.max.apply(null, anuncios.map((a) => a.order || 0)) : 0) + 1;
  adminStore.anunciosAll = () => anuncios.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.getAnuncio = (id) => anuncios.find((a) => a.id === id);
  adminStore.anunciosLive = (v) => anuncios.filter((a) => a.visible !== false && audienceMatch(a, v || viewer)).sort((a, b) => (a.order || 0) - (b.order || 0));
  adminStore.anuncioVisibleFor = (a, v) => a.visible !== false && audienceMatch(a, v || viewer);
  adminStore.blankAnuncio = () => ({ id: aduid(), empresa: '', etiqueta: '', slotId: 'ad_img_' + Math.random().toString(36).slice(2, 8), link: '#', hue: 215, visible: true, order: nextAdOrder(), audience: openAud() });
  adminStore.saveAnuncio = (a) => { const i = anuncios.findIndex((x) => x.id === a.id); if (i >= 0) anuncios = anuncios.map((x) => (x.id === a.id ? a : x)); else anuncios = [...anuncios, a]; persistAd(); };
  adminStore.toggleAnuncio = (id) => { anuncios = anuncios.map((a) => (a.id === id ? { ...a, visible: a.visible === false } : a)); persistAd(); };
  adminStore.removeAnuncio = (id) => { anuncios = anuncios.filter((a) => a.id !== id); persistAd(); };
  adminStore.duplicateAnuncio = (id) => { const s = anuncios.find((a) => a.id === id); if (!s) return; anuncios = [...anuncios, { ...s, id: aduid(), empresa: s.empresa + ' (copia)', visible: false, order: nextAdOrder(), slotId: 'ad_img_' + Math.random().toString(36).slice(2, 8) }]; persistAd(); };
  adminStore.reorderAnuncios = (orderedIds) => { const rank = {}; orderedIds.forEach((id, i) => { rank[id] = i + 1; }); anuncios = anuncios.map((a) => (rank[a.id] != null ? { ...a, order: rank[a.id] } : a)); persistAd(); };
  adminStore.resetAnuncios = () => { anuncios = seedAnuncios(); persistAd(); };

  // ── Flujo de aprobación de Pop-ups (empresas crean → admin aprueba) ──
  adminStore.pendingPopups = () => popups.filter((p) => p.status === 'pending');
  adminStore.submitPopup = (p, companyId) => { const np = { ...p, status: 'pending', ownerCompany: companyId || null, enabled: false }; adminStore.save(np); adminStore.log('Empresa · ' + (companyId || '—'), 'Pop-up enviado a aprobación', np.titulo || ''); return np.id; };
  adminStore.approvePopup = (id) => { popups = popups.map((p) => (p.id === id ? { ...p, status: 'approved', enabled: true, rejectReason: '' } : p)); emit(); adminStore.log('Administrador', 'Pop-up aprobado', id); };
  adminStore.rejectPopup = (id, reason) => { popups = popups.map((p) => (p.id === id ? { ...p, status: 'rejected', enabled: false, rejectReason: reason || '' } : p)); emit(); adminStore.log('Administrador', 'Pop-up rechazado', (reason || '')); };

  // ── Bitácora de auditoría ──
  const LOGKEY = 'suti_admin_audit_v1';
  let auditLog = safeParse(localStorage.getItem(LOGKEY), []);
  adminStore.log = (actor, action, detail) => { auditLog = [{ ts: Date.now(), actor: actor || 'Sistema', action: action || '', detail: detail || '' }, ...auditLog].slice(0, 300); localStorage.setItem(LOGKEY, JSON.stringify(auditLog)); listeners.forEach((l) => l()); };
  adminStore.auditLog = (filter) => (filter ? auditLog.filter((e) => (e.actor + e.action + e.detail).toLowerCase().indexOf(filter.toLowerCase()) !== -1) : auditLog);

  function useAdminStore() {
    const [, force] = useState(0);
    useEffect(() => adminStore.subscribe(() => force((n) => n + 1)), []);
    return adminStore;
  }
  window.useAdminStore = useAdminStore;

  // ─────────────────────────────────────────────────────────────
  // Reglas de visibilidad (fecha + segmentación)
  // ─────────────────────────────────────────────────────────────
  function dateActive(p, now) {
    now = now || new Date();
    if (p.startDate) { const s = new Date(p.startDate + 'T00:00:00'); if (s > now) return false; }
    if (p.endDate) { const e = new Date(p.endDate + 'T23:59:59'); if (e < now) return false; }
    return true;
  }
  function audienceMatch(p, v) {
    const a = p.audience || { mode: 'all' };
    if (a.mode === 'all') return true;
    if (a.mode === 'registered') return !!v.registrado;
    if (a.mode === 'segment') {
      const ok = (arr, val) => !arr || arr.length === 0 || arr.indexOf(val) !== -1;
      return ok(a.cargos, v.cargo) && ok(a.sindicatos, v.sindicato) && ok(a.niveles, v.nivel);
    }
    return true;
  }
  function activeForScreen(screenId, v) {
    v = v || viewer;
    return adminStore.forScreen(screenId).filter((p) => p.enabled && (p.status ? p.status === 'approved' : true) && dateActive(p) && audienceMatch(p, v));
  }
  adminStore.activeForScreen = activeForScreen;
  adminStore.audienceMatch = audienceMatch;
  adminStore.dateActive = dateActive;

  function navTo(app, id) {
    const s = SCREEN(id);
    if (!app || !s) return;
    if (s.nav === 'tab') app.setTab(id);
    else { app.setTab('home'); setTimeout(() => app.push(id), 30); }
  }
  adminStore.navTo = navTo;

  // ─────────────────────────────────────────────────────────────
  // AdminPopup — mismo diseño y comportamiento del pop-up de inicio.
  // Presentacional: recibe `items` ya resueltos. `preview` desactiva
  // navegación real (para la vista previa del panel).
  // ─────────────────────────────────────────────────────────────
  function AdminPopup({ items, app, onClose, preview = false }) {
    const list = (Array.isArray(items) ? items : [items]).filter(Boolean);
    const [show, setShow] = useState(false);
    const [idx, setIdx] = useState(0);
    const [dir, setDir] = useState(1);
    const [paused, setPaused] = useState(false);
    const [customOf, setCustomOf] = useState(null); // promo cuya pantalla personalizada está abierta
    const safeIdx = Math.min(idx, Math.max(0, list.length - 1));
    const promo = list[safeIdx];

    useEffect(() => { const t = setTimeout(() => setShow(true), 30); return () => clearTimeout(t); }, []);
    useEffect(() => {
      if (paused || list.length < 2) return;
      const t = setTimeout(() => go(1), 5200);
      return () => clearTimeout(t);
    }, [idx, paused, list.length]);

    if (!promo) return null;
    const go = (d) => { setDir(d); setIdx((i) => (i + d + list.length) % list.length); };
    const close = () => { setShow(false); setTimeout(() => onClose && onClose(), 240); };
    const act = () => {
      if (promo.actionType === 'custom' && promo.custom) { setCustomOf(promo); return; }
      if (preview) { close(); return; }
      if (promo.actionType === 'url' && promo.actionTarget) window.open(promo.actionTarget, '_blank', 'noopener');
      else if (promo.actionType === 'internal' && promo.actionTarget) navTo(app, promo.actionTarget);
      close();
    };

    return React.createElement('div', {
      onClick: close,
      style: {
        position: 'absolute', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 22, background: show ? 'rgba(16,12,14,.55)' : 'rgba(16,12,14,0)',
        backdropFilter: 'blur(' + (show ? 3 : 0) + 'px)', WebkitBackdropFilter: 'blur(' + (show ? 3 : 0) + 'px)',
        transition: 'background .26s ease, backdrop-filter .26s ease, -webkit-backdrop-filter .26s ease',
      },
    },
      React.createElement('div', {
        onClick: (e) => e.stopPropagation(),
        onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false),
        style: {
          width: '100%', maxWidth: 340, background: 'var(--surface)', borderRadius: 26, overflow: 'hidden',
          boxShadow: '0 30px 70px -20px rgba(16,12,14,.6)', position: 'relative',
          transform: show ? 'translateY(0) scale(1)' : 'translateY(24px) scale(.94)',
          opacity: show ? 1 : 0, transition: 'transform .3s cubic-bezier(.34,1.56,.64,1), opacity .26s ease',
        },
      },
        React.createElement('button', {
          onClick: close, 'aria-label': 'Cerrar',
          style: { position: 'absolute', top: 12, right: 12, zIndex: 4, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)', boxShadow: '0 4px 12px -4px rgba(0,0,0,.3)' },
        }, React.createElement(I, { name: 'close', size: 19, stroke: 2.4 })),

        React.createElement('div', { key: promo.id + safeIdx, className: dir > 0 ? 'su-promo-next' : 'su-promo-prev' },
          React.createElement('div', { style: { position: 'relative', height: 184, background: `linear-gradient(150deg, hsl(${promo.hue || 345},70%,42%), hsl(${promo.hue || 345},65%,26%))` } },
            promo.image_url
              ? React.createElement('img', { src: promo.image_url, alt: promo.titulo || '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })
              : React.createElement('image-slot', {
                  id: promo.slotId, shape: 'rect', fit: 'cover',
                  placeholder: 'Imagen de cabecera',
                  style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
                }),
            promo.etiqueta && React.createElement('div', { style: { position: 'absolute', left: 16, top: 16, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.92)', color: 'var(--guinda)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', padding: '6px 11px', borderRadius: 999, boxShadow: '0 4px 12px -4px rgba(0,0,0,.3)' } },
              React.createElement(I, { name: 'flame', size: 13, stroke: 2.4 }), promo.etiqueta)),
          React.createElement('div', { style: { padding: '20px 22px 8px' } },
            promo.subtitulo && React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--guinda)', letterSpacing: '.02em' } }, promo.subtitulo),
            React.createElement('h3', { style: { fontSize: 21, fontWeight: 800, color: 'var(--ink)', margin: '4px 0 0', lineHeight: 1.15, letterSpacing: '-.01em' } }, promo.titulo || 'Título del pop-up'),
            promo.contenido && React.createElement('p', { style: { fontSize: 13.5, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.5, margin: '10px 0 0', minHeight: 44 } }, promo.contenido))),

        React.createElement('div', { style: { padding: '0 22px 22px' } },
          list.length > 1 && React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px' } },
            navBtn('arrowL', () => go(-1)),
            React.createElement('div', { style: { display: 'flex', gap: 7 } },
              list.map((_, i) => React.createElement('button', {
                key: i, onClick: () => { setDir(i > safeIdx ? 1 : -1); setIdx(i); }, 'aria-label': 'Pop-up ' + (i + 1),
                style: { width: i === safeIdx ? 22 : 8, height: 8, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0, background: i === safeIdx ? 'var(--grad-guinda-soft)' : 'var(--hairline-strong)', transition: 'width .25s ease' },
              }))),
            navBtn('arrowR', () => go(1))),
          React.createElement(window.Btn, { full: true, size: 'md', iconRight: promo.actionType === 'none' ? undefined : 'arrowR', onClick: act }, promo.ctaText || 'Continuar'),
          React.createElement('button', { onClick: close, style: { display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } }, 'Ahora no')),
      ),
      customOf && window.CustomScreenView && React.createElement(window.CustomScreenView, { screen: customOf.custom, app, hue: customOf.hue, preview, onClose: () => { setCustomOf(null); if (!preview) close(); } }),
    );
  }
  function navBtn(icon, onClick) {
    return React.createElement('button', {
      onClick, 'aria-label': icon === 'arrowL' ? 'Anterior' : 'Siguiente',
      style: { width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--surface)', boxShadow: 'var(--neo-sm)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--guinda)', flexShrink: 0 },
    }, React.createElement(I, { name: icon, size: 19, stroke: 2.2 }));
  }
  window.AdminPopup = AdminPopup;
})();
