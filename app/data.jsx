/* data.jsx — SutiApp mock content. Exports window.DATA */
(function () {
  const user = {
    name: 'María Elena Robles',
    short: 'María Elena',
    role: 'Afiliada activa',
    num: 'SUT-04821',
    plaza: 'Hospital General ISSSTESON · Hermosillo',
    antiguedad: '12 años, 4 meses',
    seccion: 'Sección 21 · Enfermería',
    curp: 'CURP-DEMO-NO-REAL',
    ahorro: 38450,
    creditoDisp: 62000,
    nominaQuincena: 14280,
    vigencia: '12 / 2027',
    // Información de identificación
    numControl: 'CTRL-04821',
    rfc: 'ROBM850412H23',
    // Información de contacto
    tel: '(662) 123 4567',
    email: 'maria.robles@correo.mx',
    whatsapp: '+52 662 123 4567',
    // Información personal
    fechaNac: '12/04/1985',
    genero: 'Femenino',
    estadoCivil: 'Casada',
    hijos: '2',
    direccion: 'Calle Sonora #145, Col. Centenario',
    ciudad: 'Hermosillo, Sonora',
    // Información laboral
    area: 'Enfermería',
    ocupacion: 'Licenciada en Enfermería',
    puestoIsssteson: 'Enfermera General “A”',
    puestoSuti: 'Delegada de Sección',
    nivel: 'Base',
    unidad: 'Hospital General ISSSTESON · Módulo 3',
    // Información sindical
    afiliacion: 'SUTISSSTESON',
    estatusSindicato: 'Activa',
    estatusAfiliado: 'Vigente',
    // Fechas
    fechaIngreso: '15/01/2014',
    fechaIngresoValidada: 'Sí · 20/01/2014',
    fechaIngresoISO: '2014-01-15',
    fechaIngresoApp: '15 Ene 2014',
    fechaIngresoInstituto: '10/01/2014',
    fechaInscripcion: '18/01/2014',
    fechaCaptura: '22/01/2014',
  };

  // Institutional home modules
  const institucional = window.UNION_SCREEN_REGISTRY;

  // Financiera — SEMILLA ÚNICAMENTE. Autoridad de ejecución: window.finCatStore.
  // F1.2: prohibido leer DATA.finanzasGroups fuera de fincat-store.jsx (la
  // auditoría de F1.8 marca cualquier acceso nuevo como incumplimiento).
  const finanzasGroups = [
    {
      id: 'liquidez', title: 'Liquidez inmediata', sub: 'Dinero cuando lo necesitas', tone: 'guinda',
      items: [
        { id: 'prestamo', label: 'Suti Préstamo', icon: 'cash', tagline: 'Hasta $62,000', meta: 'Tasa 3% · a 24 quincenas', hero: true },
        { id: 'nomina', label: 'Adelanto de nómina', icon: 'calendar', tagline: 'Tu quincena hoy', meta: 'Sujeto a disponibilidad' },
        { id: 'caja', label: 'Caja chica', icon: 'money', tagline: 'Apoyo exprés', meta: 'Aprobación en minutos' },
      ],
    },
    {
      id: 'patrimonio', title: 'Crece tu patrimonio', sub: 'Ahorro e inversión sindical', tone: 'green',
      items: [
        { id: 'ahorro', label: 'Ahorro Voluntario', icon: 'piggy', tagline: 'Semestral', meta: 'Rendimiento preferente' },
        { id: 'inversion', label: 'Portafolio de Inversión', icon: 'chart', tagline: 'Haz crecer tu dinero', meta: 'Desde $1,000' },
      ],
    },
    {
      id: 'bienes', title: 'Bienes y financiamientos', sub: 'Compra a plazos con tu sindicato', tone: 'blue',
      items: [
        { id: 'auto', label: 'Suti Auto', icon: 'car', tagline: 'Auto seminuevo', meta: 'Enganche bajo' },
        { id: 'renta', label: 'Suti Renta', icon: 'key', tagline: 'Renta con opción a compra', meta: 'Sin aval' },
        { id: 'casa', label: 'Suti Casa', icon: 'house', tagline: 'Crédito de vivienda', meta: 'Convenio INFONAVIT' },
        { id: 'terrenos', label: 'Suti Terrenos', icon: 'land', tagline: 'Lotes a meses', meta: 'Plusvalía garantizada' },
        { id: 'solar', label: 'Paneles Solares', icon: 'solar', tagline: 'Ahorra en luz', meta: 'Financiamiento verde' },
        { id: 'aires', label: 'Aires Acondicionados', icon: 'ac', tagline: 'Para el verano', meta: 'A 18 quincenas' },
        { id: 'puertas', label: 'Puertas de Seguridad', icon: 'door', tagline: 'Protege tu hogar', meta: 'Instalación incluida' },
        { id: 'computo', label: 'Equipos de Cómputo', icon: 'laptop', tagline: 'Laptops y PCs', meta: 'Sin intereses' },
      ],
    },
    {
      id: 'bienestar', title: 'Bienestar y experiencias', sub: 'Salud, viajes y más', tone: 'amber',
      items: [
        { id: 'farma', label: 'Suti Farma', icon: 'pharmacy', tagline: 'Medicamentos', meta: 'Hasta 40% desc.' },
        { id: 'cirugias', label: 'Suti Cirugías', icon: 'surgery', tagline: 'Estéticas y mayores', meta: 'A meses' },
        { id: 'tours', label: 'Suti Tours', icon: 'plane', tagline: 'Viajes y paquetes', meta: 'Paga a plazos' },
        { id: 'market', label: 'Suti Market', icon: 'cart', tagline: 'Productos del hogar', meta: 'Marketplace' },
        { id: 'rifas', label: 'Suti Rifas', icon: 'ticket', tagline: 'Boletos activos', meta: 'Gana en grande' },
      ],
    },
  ];

  const recommended = [
    { id: 'prestamo', label: 'Suti Préstamo', icon: 'cash', reason: 'Eres elegible hoy', cta: 'Simular' },
    { id: 'ahorro', label: 'Ahorro Voluntario', icon: 'piggy', reason: 'Termina el semestre', cta: 'Abrir' },
    { id: 'tours', label: 'Suti Tours', icon: 'plane', reason: 'Verano 2026', cta: 'Ver' },
  ];

  // Convenios
  const conveniosCats = [
    { id: 'com', label: 'Comerciales', icon: 'cart', count: 48 },
    { id: 'edu', label: 'Educativos', icon: 'doc', count: 22 },
    { id: 'salud', label: 'Salud', icon: 'pharmacy', count: 31 },
    { id: 'auto', label: 'Automotriz', icon: 'car', count: 12 },
    { id: 'viajes', label: 'Viajes', icon: 'plane', count: 18 },
    { id: 'hogar', label: 'Hogar', icon: 'house', count: 26 },
  ];
  const convenios = [
    { id: 1, name: 'Universidad Kino', cat: 'Educativos', tags: ['Bachillerato', 'Licenciatura', 'Maestría'], disc: 20, addr: 'Calz. Pedro Ramírez Villegas SN, Hermosillo', price: 907, was: 3135, fav: true, featured: true, hue: 36 },
    { id: 2, name: 'Unilíder', cat: 'Comerciales', tags: ['Mayoreo', 'Abarrotes'], disc: 50, addr: 'Blvd. Solidaridad 245, Hermosillo', price: null, fav: false, featured: true, hue: 210 },
    { id: 3, name: 'Farmacias del Ahorro', cat: 'Salud', tags: ['Medicamento', 'Consulta'], disc: 35, addr: '120 sucursales en Sonora', price: null, fav: true, hue: 150 },
    { id: 4, name: 'Óptica Sonora', cat: 'Salud', tags: ['Lentes', 'Examen visual'], disc: 40, addr: 'Centro, Hermosillo', price: null, fav: false, hue: 280 },
    { id: 5, name: 'Hotel Araiza', cat: 'Viajes', tags: ['Hospedaje', 'Eventos'], disc: 25, addr: 'Blvd. Eusebio Kino 353', price: null, fav: false, hue: 24 },
    { id: 6, name: 'Llantera del Pacífico', cat: 'Automotriz', tags: ['Llantas', 'Servicio'], disc: 18, addr: 'Periférico Norte, Hermosillo', price: null, fav: false, hue: 200 },
  ];

  // Historial / solicitudes
  const solicitudes = []; // Runtime request history is resolved only from Supabase snapshots.

  const estadoMeta = {
    revision: { label: 'En revisión', tone: 'amber', icon: 'clock' },
    aprobado: { label: 'Aprobado', tone: 'green', icon: 'checkCircle' },
    depositado: { label: 'Depositado', tone: 'blue', icon: 'check' },
    rechazado: { label: 'No aprobado', tone: 'red', icon: 'close' },
  };

  const notifs = [
    { id: 1, icon: 'clock', tone: 'amber', title: 'Tu préstamo ya está en revisión', body: 'Solicitud ID-2941 · seguimiento disponible', time: 'Hace 2 h', unread: true },
    { id: 2, icon: 'handshake', tone: 'guinda', title: 'Nuevo convenio disponible', body: 'Unilíder: 50% en tu primera compra', time: 'Hoy', unread: true },
    { id: 3, icon: 'doc', tone: 'red', title: 'Te faltan 2 documentos', body: 'Sube tu INE y último talón de pago', time: 'Ayer', unread: true },
    { id: 4, icon: 'checkCircle', tone: 'green', title: 'Tu membresía fue aprobada', body: 'Ya puedes usar todos los beneficios', time: '2 días', unread: false },
    { id: 5, icon: 'piggy', tone: 'green', title: 'Ya puedes solicitar ahorro', body: 'Cierre de semestre el 30 de junio', time: '3 días', unread: false },
  ];

  const noticias = [
    { id: 1, tag: 'Asamblea', title: 'Resultados de la Asamblea General de mayo', date: '24 May 2026', hue: 345, read: '3 min' },
    { id: 2, tag: 'Beneficio', title: 'Nuevo convenio con Universidad Kino: becas 2026', date: '22 May 2026', hue: 36, read: '2 min' },
    { id: 3, tag: 'Salud', title: 'Jornada de salud gratuita para afiliados y familia', date: '19 May 2026', hue: 150, read: '1 min' },
  ];

  const docs = [
    { id: 'ine_front', label: 'INE Frente', icon: 'idcard', status: 'ok', note: 'Verificado' },
    { id: 'ine_back', label: 'INE Reverso', icon: 'idcard', status: 'ok', note: 'Verificado' },
    { id: 'hoja_tribunal', label: 'Hoja Tribunal', icon: 'doc', status: 'pending', note: 'Pendiente' },
    { id: 'hoja_afiliacion', label: 'Hoja de Afiliación', icon: 'doc', status: 'pending', note: 'Pendiente' },
    { id: 'talon_penultima', label: 'Talón Penúltima Quincena', icon: 'doc', status: 'review', note: 'En revisión' },
    { id: 'talon_ultima', label: 'Talón Última Quincena', icon: 'doc', status: 'pending', note: 'Pendiente' },
  ];

  // Publicidad de empresas (pop-up). Edita aquí o desde Tweaks.
  const promos = [
    {
      id: 'promo_unilider',
      empresa: 'Unilíder',
      etiqueta: 'CONVENIO DESTACADO',
      titulo: '50% de descuento en tu primera compra',
      texto: 'Presenta tu credencial SUTISSSTESON en cualquier sucursal Unilíder y obtén 50% en tus mensualidades. Válido hasta el 30 de junio.',
      cta: 'Ver convenio',
      link: '#',
      slotId: 'promo_img_unilider',
      hue: 345,
    },
    {
      id: 'promo_farmacias',
      empresa: 'Farmacias del Bienestar',
      etiqueta: 'SALUD',
      titulo: 'Medicamentos hasta 35% más baratos',
      texto: 'Surte tus recetas con descuento exclusivo para afiliados y sus familias. Envío gratis a domicilio en pedidos mayores a $500.',
      cta: 'Ver farmacia',
      link: '#',
      slotId: 'promo_img_farmacias',
      hue: 150,
    },
    {
      id: 'promo_tours',
      empresa: 'Suti Tours',
      etiqueta: 'VIAJES',
      titulo: 'Semana Santa en Cancún a 12 quincenas',
      texto: 'Paquetes todo incluido para 4 personas con descuento sindical. Aparta con el 10% y difiere el resto vía nómina sin intereses.',
      cta: 'Ver paquetes',
      link: '#',
      slotId: 'promo_img_tours',
      hue: 205,
    },
  ];

  // Anuncios patrocinados (empresas que pagaron publicidad) — carrusel en Convenios
  const anuncios = [
    { id: 'ad_coppel', empresa: 'Coppel', etiqueta: 'Hasta 18 meses sin intereses', slotId: 'ad_img_coppel', link: '#', hue: 215 },
    { id: 'ad_cinepolis', empresa: 'Cinépolis', etiqueta: '2x1 en boletos los martes', slotId: 'ad_img_cinepolis', link: '#', hue: 255 },
    { id: 'ad_lala', empresa: 'Óptica Lux', etiqueta: 'Lentes gratis con tu examen', slotId: 'ad_img_optica', link: '#', hue: 28 },
    { id: 'ad_natura', empresa: 'Hotel Costa del Mar', etiqueta: 'Fin de semana 3x2 para afiliados', slotId: 'ad_img_hotel', link: '#', hue: 188 },
  ];

  // Congelado: la semilla no debe mutarse desde ninguna pantalla (F1.2).
  const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach((k) => deepFreeze(o[k])); } return o; };
  deepFreeze(finanzasGroups); deepFreeze(recommended);

  window.DATA = { user, institucional, finanzasGroups, recommended, conveniosCats, convenios, solicitudes, estadoMeta, notifs, docs, promos, anuncios };
})();
