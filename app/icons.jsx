/* icons.jsx — SutiApp icon system. Clean 24px line icons, currentColor stroke.
   Duotone variant fills the secondary shape at low opacity. */
(function () {
  const P = {
    // ---- bottom nav / core ----
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 9h18"/><path d="M16 13.5h2.5"/><path d="M3 6.5 15 3.2a1.5 1.5 0 0 1 1.9 1.4V6"/>',
    tag: '<path d="M3.5 11.2V5a1.5 1.5 0 0 1 1.5-1.5h6.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z"/><circle cx="8" cy="8" r="1.4"/>',
    receipt: '<path d="M5 3h14v18l-2.5-1.6L14 21l-2.5-1.6L9 21l-2.5-1.6L4 21V4a1 1 0 0 1 1-1Z"/><path d="M8.5 8.5h7"/><path d="M8.5 12.5h7"/>',
    idcard: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8" cy="11" r="2.2"/><path d="M5 16c.6-1.6 2-2.4 3-2.4s2.4.8 3 2.4"/><path d="M14 10h4.5"/><path d="M14 13.5h3"/>',
    // ---- institutional ----
    fist: '<path d="M7 11V6.5a1.3 1.3 0 0 1 2.6 0V10"/><path d="M9.6 9.5V5.2a1.3 1.3 0 0 1 2.6 0V10"/><path d="M12.2 9.7V6a1.3 1.3 0 0 1 2.6 0v4.3"/><path d="M14.8 10.4V8a1.3 1.3 0 0 1 2.5 0v6.5a6 6 0 0 1-6 6.5h-1a6 6 0 0 1-5.3-3.2L3.2 15a1.4 1.4 0 0 1 2.3-1.6L7 15.2"/>',
    scale: '<path d="M12 4v16"/><path d="M7 20h10"/><path d="M5 7h14"/><path d="m5 7-2.5 5.5a3 3 0 0 0 5 0L5 7Z"/><path d="m19 7-2.5 5.5a3 3 0 0 0 5 0L19 7Z"/><circle cx="12" cy="4.5" r="1.3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    finance: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14 3-3.5 3 2 4-5.5"/><circle cx="7.5" cy="14" r="1"/><circle cx="17.5" cy="7" r="1"/>',
    handshake: '<path d="m11 18 5.5-1.5L21 12l-4-7-3 1.2a3 3 0 0 1-2.2 0L9 5 3 8l3 8 2.5-1"/><path d="m8.5 15 2.2 2a1.6 1.6 0 0 0 2.3-.2"/><path d="m6.5 13 2 1.8"/>',
    download: '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M4 19h16"/>',
    swap: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
    seniority: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    retiree: '<circle cx="12" cy="7" r="3.2"/><path d="M5 21c.5-4.2 3.4-6.5 7-6.5s6.5 2.3 7 6.5"/><path d="M16.5 11.5 19 9"/>',
    emergency: '<path d="M12 3 3 7v5c0 5 3.8 8.3 9 9.5 5.2-1.2 9-4.5 9-9.5V7l-9-4Z"/><path d="M12 8.5v4"/><circle cx="12" cy="15.4" r="0.6" fill="currentColor" stroke="none"/>',
    news: '<rect x="3" y="4" width="14" height="16" rx="2"/><path d="M17 8h3a1 1 0 0 1 1 1v8.5a2.5 2.5 0 0 1-5 0V4"/><path d="M6.5 8h7"/><path d="M6.5 12h7"/><path d="M6.5 16h4"/>',
    // ---- financiera modules ----
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5"/><path d="M18 9.5v5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M7.5 13.5h3"/>',
    piggy: '<path d="M16 7.5c2.8.7 4.8 3 4.8 5.8 0 1.6-.7 3-1.8 4v2.2h-2.6l-.6-1.4a8 8 0 0 1-3.6 0L11.5 19.5H9V18a6.4 6.4 0 0 1-2.7-4.4H4.5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1.4A6.3 6.3 0 0 1 11.5 6h2.3"/><path d="M14 6.2C14 4.5 12.6 4 11.6 4.4"/><circle cx="16.5" cy="11.5" r="0.7" fill="currentColor" stroke="none"/>',
    chart: '<path d="M4 4v15a1 1 0 0 0 1 1h15"/><rect x="7.5" y="11" width="2.6" height="6" rx="0.6"/><rect x="12" y="7.5" width="2.6" height="9.5" rx="0.6"/><rect x="16.5" y="13" width="2.6" height="4" rx="0.6"/>',
    car: '<path d="M3 13.5 4.8 8a2 2 0 0 1 1.9-1.3h10.6A2 2 0 0 1 19.2 8L21 13.5"/><path d="M3 13.5h18V18a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4.5Z"/><circle cx="7" cy="15.8" r="0.7" fill="currentColor" stroke="none"/><circle cx="17" cy="15.8" r="0.7" fill="currentColor" stroke="none"/>',
    key: '<circle cx="8" cy="8" r="4"/><path d="m10.8 10.8 7 7"/><path d="m15 14 2-2"/><path d="m17.5 16.5 2-2"/>',
    cart: '<path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L20 8H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
    house: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><rect x="10" y="14" width="4" height="6"/>',
    land: '<path d="m12 3 9 6-9 4-9-4 9-6Z"/><path d="m3 15 9 4 9-4"/><circle cx="12" cy="8" r="1.4"/>',
    plane: '<path d="M21 5.5a1.6 1.6 0 0 0-2.3-2.2l-3.5 3.4-6.8-1.9-1.7 1.7 5 2.9-2.6 2.6-2.8-.5-1.3 1.3 3 1.8 1.8 3 1.3-1.3-.5-2.8 2.6-2.6 2.9 5 1.7-1.7-1.9-6.8L21 5.5Z"/>',
    pharmacy: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>',
    surgery: '<path d="m12 3 1.6 3.6L17.5 8l-2.6 2.8.5 4-3.4-1.9L8.6 14.8l.5-4L6.5 8l3.9-1.4L12 3Z"/><path d="M12 17v4"/><path d="M9.5 20h5"/>',
    solar: '<rect x="3" y="4" width="18" height="9" rx="1.5"/><path d="M3 7.5h18"/><path d="M3 10.5h18"/><path d="M9 4v9"/><path d="M15 4v9"/><path d="M12 13v8"/><path d="M8.5 21h7"/>',
    ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z"/><path d="M14 6.5v11" stroke-dasharray="1.5 2"/>',
    ac: '<rect x="3" y="5" width="18" height="7" rx="2"/><path d="M6 9h8"/><path d="M7 15c0 1.5-1 2-1 3.5"/><path d="M12 15c0 1.5-1 2-1 3.5"/><path d="M17 15c0 1.5-1 2-1 3.5"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M3.5 21h15"/><circle cx="13" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
    laptop: '<rect x="4" y="5" width="16" height="10" rx="1.5"/><path d="M2.5 19h19l-1-2.5H3.5L2.5 19Z"/>',
    // ---- utility ----
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2.2H4.5L6 16Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>',
    heart: '<path d="M12 20s-7-4.3-9.2-8.5C1.3 8.6 2.8 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.2 0 4.7 3.1 3.2 6C19 15.7 12 20 12 20Z"/>',
    chevR: '<path d="m9 5 7 7-7 7"/>',
    chevL: '<path d="m15 5-7 7 7 7"/>',
    chevD: '<path d="m5 9 7 7 7-7"/>',
    chevU: '<path d="m5 15 7-7 7 7"/>',
    arrowR: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    arrowL: '<path d="M20 12H5"/><path d="m11 6-6 6 6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    sign: '<path d="M3 19c3.5 0 4.5-13 7.5-13 2 0 1.6 4.5.4 7.2-.9 2-.4 3.3 1.1 3.3 1.8 0 2.6-2 4-2 1 0 1.3 1 2.2 1H21"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16 9.5"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.8 7.5 9 4.4-1.2 7.5-4.4 7.5-9V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h3v3"/><path d="M20.5 14.5v6"/><path d="M14.5 20.5h3"/>',
    camera: '<path d="M4 8a2 2 0 0 1 2-2h1.5L9 4h6l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="12.5" r="3.2"/>',
    upload: '<path d="M12 16V5"/><path d="m7.5 9 4.5-4.5L16.5 9"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    phone: '<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V23"/><path d="M5 4c0 9.4 5.6 15 14 15"/>',
    message: '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>',
    star: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8L12 3Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-4 3.6-6 7-6s6.3 2 7 6"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14c2 .5 3.4 2.1 3.9 4.5"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
    sparkle: '<path d="M12 3.5c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5Z"/><path d="M18.5 13.5c.2 1.6.7 2.1 2.3 2.3-1.6.2-2.1.7-2.3 2.3-.2-1.6-.7-2.1-2.3-2.3 1.6-.2 2.1-.7 2.3-2.3Z"/>',
    trending: '<path d="m4 16 5-5 3.5 3.5L20 7.5"/><path d="M15 7.5h5v5"/>',
    doc: '<path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7"/><path d="M8.5 16.5h5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    headset: '<path d="M5 13v-1a7 7 0 0 1 14 0v1"/><rect x="3.5" y="13" width="3.5" height="6" rx="1.5"/><rect x="17" y="13" width="3.5" height="6" rx="1.5"/><path d="M19 19v.5a3 3 0 0 1-3 3h-2"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5"/><path d="M12 8.5V21"/><path d="M12 8.5C12 6 10.5 4.5 8.8 4.5A2.3 2.3 0 0 0 12 8.5Z"/><path d="M12 8.5C12 6 13.5 4.5 15.2 4.5A2.3 2.3 0 0 1 12 8.5Z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    pencil: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
    logout: '<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M17 8l4 4-4 4"/><path d="M10 12h11"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"/>',
    flame: '<path d="M12 3s4 3.5 4 8a4 4 0 0 1-8 0c0-1 .3-2 .8-2.6C8.5 9.5 8 11 7 11 5.5 11 5 9 5 12a7 7 0 0 0 14 0c0-5-3-7-7-9Z"/>',
    percent: '<path d="m6 18 12-12"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
    bookmark: '<path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5Z" fill="currentColor"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/>',
    // ---- admin ----
    trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    grip: '<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
    power: '<path d="M12 3v9"/><path d="M6.5 7a8 8 0 1 0 11 0"/>',
    link: '<path d="M10 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/>',
  };

  // Fallback obligatorio (F1.1). Regla: si no se pide recurso (name vacio/null)
  // se sigue devolviendo null — el DOM no cambia. Solo un nombre REAL pero
  // inexistente degrada al icono generico, y se avisa una vez por nombre.
  const FALLBACK = 'grid';
  const warned = new Set();
  function resolveGlyph(name) {
    if (name == null || name === '') return null;          // nada que pintar
    const d = P[name];
    if (d) return d;
    if (!warned.has(name)) {
      warned.add(name);
      (window.__ICON_MISSING || (window.__ICON_MISSING = [])).push(name);
      try { console.warn('[icons] recurso inexistente: "' + name + '" → fallback "' + FALLBACK + '"'); } catch (e) {}
    }
    return P[FALLBACK];
  }

  function Icon({ name, size = 24, stroke = 1.8, duotone = false, fill = 'currentColor', style, ...rest }) {
    const d = resolveGlyph(name);
    if (!d) return null;
    return React.createElement('svg', {
      width: size, height: size, viewBox: '0 0 24 24',
      ...rest,
      fill: 'none',
      stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
      strokeLinejoin: 'round', style, 'aria-hidden': true,
      dangerouslySetInnerHTML: { __html: d },
    });
  }

  window.Icon = Icon;
  window.ICON_NAMES = Object.keys(P);
  // Superficie de solo lectura para el registro de recursos visuales (F1.3+).
  window.ICON_CATALOG = Object.freeze({
    names: Object.freeze(Object.keys(P)),
    fallback: FALLBACK,
    has: (n) => Object.prototype.hasOwnProperty.call(P, n),
    missing: () => (window.__ICON_MISSING || []).slice(),
  });
})();
