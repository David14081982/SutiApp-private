/* assets-registry.jsx — F1.3
   Catálogo declarativo de recursos visuales administrables.
   SIN CONSUMIDORES en F1.3: este archivo solo define window.ASSETS_REGISTRY.
   Nada aquí se ejecuta contra otros globals en tiempo de carga.

   Un recurso (resKey) describe QUÉ se pinta, no CÓMO:
     key    string   identificador estable, namespaced: 'nav.home', 'home.hero'
     kind   'icon'|'image'
     label  string   nombre humano para el panel de admin
     group  string   agrupador del panel ('Navegación', 'Inicio', ...)
     icon   string   nombre en ICON_CATALOG (kind:'icon' o fallback de 'image')
     slot   string   id de <image-slot> que el usuario puede llenar (kind:'image')
     src    string   URL/data-URL por defecto (kind:'image')
     admin  boolean  false = visible en el registro pero no editable por admin
*/
(function () {
  // Entradas por fase. F1.4: navegación inferior + Inicio (accesos rápidos y banner).
  // Helper: declara un recurso de icono con el mismo icono que ya usaba la pantalla.
  const ENTRIES = {};
  function ico(key, label, group, icon) { ENTRIES[key] = { key, kind: 'icon', label, group, icon, admin: true }; }

  const NAV = 'Navegación';
  ico('nav.home', 'Pestaña Inicio', NAV, 'home');
  ico('nav.financiera', 'Pestaña Finanzas', NAV, 'wallet');
  ico('nav.convenios', 'Pestaña Convenios', NAV, 'tag');
  ico('nav.historial', 'Pestaña Historial', NAV, 'receipt');
  ico('nav.credencial', 'Pestaña Credencial', NAV, 'idcard');
  ico('nav.admin', 'Pestaña Admin', NAV, 'shield');

  const QA = 'Inicio · Accesos rápidos';
  ico('home.qa.prestamo', 'Acceso Préstamo', QA, 'cash');
  ico('home.qa.credencial', 'Acceso Credencial', QA, 'idcard');
  ico('home.qa.convenios', 'Acceso Convenios', QA, 'tag');
  ico('home.qa.documentos', 'Acceso Documentos', QA, 'upload');

  ico('home.banner.icon', 'Icono del banner de convenio', 'Inicio', 'flame');

  ENTRIES['home.header.collapsed'] = {
    key: 'home.header.collapsed',
    kind: 'image',
    label: 'Foto del header colapsado (Inicio)',
    group: 'Inicio',
    slot: 'home-header-collapsed',
    src: './assets/branding/home-header-collapsed.webp',
    icon: 'image',
    admin: true,
  };

  // F1.5 · Mi Financiera (recursos fijos de la pantalla)
  const FIN = 'Mi Financiera';
  ico('fin.summary.icon', 'Icono de crédito disponible', FIN, 'cash');
  ico('fin.stat.ahorro', 'Icono de Mi ahorro', FIN, 'piggy');
  ico('fin.stat.nomina', 'Icono de Nómina quincenal', FIN, 'calendar');

  // F1.6 · Convenios (recursos fijos)
  const CONV = 'Convenios';
  ico('convenios.card.fav', 'Icono de favorito', CONV, 'heart');
  ico('convenios.card.pin', 'Icono de ubicación', CONV, 'pin');
  ico('convenios.detail.credencial', 'Icono de credencial en el detalle', CONV, 'idcard');

  // ---- Proveedores dinámicos ----
  // Un namespace cuyas entradas no se pueden enumerar en tiempo de carga
  // (productos que el admin crea/edita) se declara con un proveedor: una
  // función que fabrica la entrada en tiempo de resolución. Se ejecuta
  // perezosamente, así que puede leer stores que aún no existen al cargar.
  const PROVIDERS = [];
  function provide(prefix, fn) {
    if (!prefix || typeof fn !== 'function') return false;
    PROVIDERS.push({ prefix, fn });
    return true;
  }

  // fin.item.<itemId> — productos de Mi Financiera. El icono por defecto sale
  // de finCatStore (autoridad de ejecución, F1.2); el slot permite que el
  // admin suba una imagen propia sin tocar el catálogo.
  provide('fin.item.', function (key) {
    const id = key.slice('fin.item.'.length);
    const fs = window.finCatStore;
    const it = fs && fs.findItem ? fs.findItem(id) : null;
    if (!it) return null;
    return { key, kind: 'icon', label: it.label || id, group: FIN + ' · Productos', icon: it.icon, slot: 'fin-item-' + id, admin: true };
  });

  // ad.<adId> — anuncios patrocinados de Convenios. La imagen la sube el usuario
  // en su <image-slot> (slotId del anuncio); el admin puede sobreescribirla.
  provide('ad.', function (key) {
    const id = key.slice('ad.'.length);
    const as = window.adminStore;
    const a = as && as.getAnuncio ? as.getAnuncio(id) : null;
    if (!a) return null;
    return { key, kind: 'image', label: 'Anuncio: ' + (a.empresa || id), group: CONV + ' · Anuncios', slot: a.slotId, icon: 'image', admin: true };
  });

  // hist.estado.<estado> — iconos de estado de solicitud (DATA.estadoMeta).
  provide('hist.estado.', function (key) {
    const st = key.slice('hist.estado.'.length);
    const meta = ((window.DATA || {}).estadoMeta || {})[st];
    if (!meta) return null;
    return { key, kind: 'icon', label: 'Estado: ' + meta.label, group: 'Mi Historial · Estados', icon: meta.icon, admin: true };
  });

  // F1.7 · Portadas de marketplace, módulos del sindicato y noticias.
  // Todas son imágenes que el USUARIO llena por <image-slot> (slot determinista)
  // y que el admin puede sobreescribir. Se consumen con <ResSlot>.

  // fin.hero.<itemId> — portada del detalle de un producto de Mi Financiera.
  provide('fin.hero.', function (key) {
    const id = key.slice('fin.hero.'.length);
    if (!id) return null;
    const fs = window.finCatStore;
    const it = fs && fs.findItem ? fs.findItem(id) : null;
    return { key, kind: 'image', label: 'Portada: ' + ((it && it.label) || id), group: FIN + ' · Portadas', slot: 'fin_hdr_' + id, icon: (it && it.icon) || 'image', admin: true };
  });

  const SIND = 'Sindicato';
  // sind.hero.<moduleId> — portada del encabezado de un módulo del sindicato.
  provide('sind.hero.', function (key) {
    const id = key.slice('sind.hero.'.length);
    if (!id) return null;
    const migrated = (window.H007_MIGRATED_MODULE_IDS || []).indexOf(id) !== -1;
    const st = window.sindicatoStore;
    const h = migrated ? (window.H007_INSTITUTIONAL_NAV || {})[id] : (st && st.header ? st.header(id) : null);
    return { key, kind: 'image', label: 'Portada: ' + ((h && (h.titulo || h.label)) || id), group: SIND + ' · Módulos', slot: 'sind_hdr_' + id, icon: 'image', admin: !migrated };
  });

  // sind.block.<slotId> — imagen de un bloque de contenido de un módulo.
  // Se indexa por slotId (estable por bloque) porque los bloques viven en
  // varios módulos y no hay índice global por id.
  provide('sind.block.', function (key) {
    const slot = key.slice('sind.block.'.length);
    if (!slot) return null;
    return { key, kind: 'image', label: 'Imagen de bloque', group: SIND + ' · Bloques', slot, icon: 'image', admin: true };
  });

  // news.<newsId> — imagen de una noticia (portada del artículo y su zoom).
  provide('news.', function (key) {
    const id = key.slice('news.'.length);
    const as = window.adminStore;
    const n = as && as.getNews ? as.getNews(id) : null;
    if (!n || !n.slotId) return null;
    return { key, kind: 'image', label: 'Noticia: ' + (n.title || id), group: 'Noticias', slot: n.slotId, icon: 'news', admin: true };
  });

  // F1.8 · Catálogo de productos y pantallas personalizadas.

  // cat.item.<itemId> — imagen de portada de un producto del catálogo. A
  // diferencia del resto, la imagen NO viene de un <image-slot> sino del array
  // `imagenes[]` que administra catalogStore: se expone su primera imagen como
  // `src`. Sin imágenes degrada al icono de la categoría.
  provide('cat.item.', function (key) {
    const id = key.slice('cat.item.'.length);
    if (!id) return null;
    const cs = window.catalogStore;
    const it = cs && cs.get ? cs.get(id) : null;
    const img = it && it.imagenes && it.imagenes[0];
    return {
      key, kind: img ? 'image' : 'icon',
      label: 'Producto: ' + ((it && it.nombre) || id),
      group: 'Catálogo · Productos', src: img || null, icon: 'cart', admin: true,
    };
  });

  // screen.<slotId> — portada de una pantalla personalizada (pop-up tipo Glide).
  // Indexada por slotId: la pantalla vive dentro del pop-up que la define.
  provide('screen.', function (key) {
    const slot = key.slice('screen.'.length);
    if (!slot) return null;
    return { key, kind: 'image', label: 'Portada de pantalla personalizada', group: 'Pantallas personalizadas', slot, icon: 'image', admin: true };
  });

  // Excepciones documentadas a la regla arquitectónica: decorativo o generado,
  // no administrable, por lo tanto NO pasa por el registro.
  const EXEMPT = {
    'gradients': 'Gradientes y sombras neomórficas: estilo, no contenido.',
    'terreno.map-pattern': 'Patrones SVG del mapa de Terrenos: geometría generada, no imagen editable.',
    'credencial.qr': 'QR generado en runtime a partir del folio del socio.',
    'signature.ink': 'Firma dibujada a mano por el usuario en canvas.',
    'image-slot.empty-icon': 'Icono del estado vacío interno de <image-slot> (shadow DOM).',
    'admin.editor-slots': 'Los <image-slot> de los paneles de administración SON el control de edición del recurso, no su consumo: administrarlos con el propio registro sería circular.',
    'catalogo.galeria': 'Galería multi-imagen del detalle de producto: array `imagenes[]` con autoridad en catalogStore. El registro expone solo la portada (cat.item.<id>).',
  };

  function get(key) {
    if (!key) return null;
    if (ENTRIES[key]) return ENTRIES[key];
    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i];
      if (key.indexOf(p.prefix) === 0) {
        let e = null;
        try { e = p.fn(key); } catch (err) { e = null; }
        if (e) return e;
      }
    }
    return null;
  }

  // Diagnóstico, no runtime: valida que cada entrada sea coherente.
  function validate() {
    const cat = window.ICON_CATALOG;
    const problems = [];
    for (const k in ENTRIES) {
      const e = ENTRIES[k];
      if (e.key !== k) problems.push(k + ': key inconsistente ("' + e.key + '")');
      if (e.kind !== 'icon' && e.kind !== 'image') problems.push(k + ': kind inválido');
      if (e.kind === 'icon' && !e.icon) problems.push(k + ': icon requerido');
      if (e.kind === 'image' && !e.slot && !e.src) problems.push(k + ': slot o src requerido');
      if (e.icon && cat && !cat.has(e.icon)) problems.push(k + ': icono inexistente "' + e.icon + '"');
    }
    return problems;
  }

  window.ASSETS_REGISTRY = Object.freeze({
    version: 1,
    keys: () => Object.keys(ENTRIES),
    get,
    provide,
    providers: () => PROVIDERS.map((p) => p.prefix),
    has: (k) => !!get(k),
    byGroup: (g) => Object.keys(ENTRIES).filter((k) => ENTRIES[k].group === g).map((k) => ENTRIES[k]),
    groups: () => Object.keys(ENTRIES).reduce((a, k) => (a.indexOf(ENTRIES[k].group) < 0 ? a.concat(ENTRIES[k].group) : a), []),
    entries: () => Object.keys(ENTRIES).map((k) => Object.assign({}, ENTRIES[k])),
    EXEMPT: Object.freeze(Object.assign({}, EXEMPT)),
    validate,
  });
})();
