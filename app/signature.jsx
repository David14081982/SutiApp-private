/* signature.jsx — Firma electrónica + aceptación de términos reutilizable.
   Exporta: SignaturePad, TermsScreen, SignBlock, termsFor  */
(() => {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;

  // ── Términos por programa ─────────────────────────────────────────────
  const COMUN = [
    ['Uso de la información', 'Los datos que proporcionas se utilizan únicamente para evaluar, tramitar y dar seguimiento a esta solicitud dentro del sindicato y, en su caso, con el proveedor asignado.'],
    ['Veracidad', 'Declaras bajo protesta de decir verdad que la información y los documentos entregados son auténticos y corresponden a tu persona. La falsedad de datos cancela el trámite.'],
    ['Firma electrónica', 'La firma trazada en la aplicación tiene la misma validez que tu firma autógrafa para efectos de este trámite y queda asociada a tu número de afiliado, fecha y hora de envío.'],
    ['Protección de datos', 'Tus datos personales se tratan conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y al aviso de privacidad del sindicato.'],
    ['Vigencia', 'La aceptación de estos términos aplica exclusivamente a la solicitud enviada y no genera obligación de otorgamiento por parte del sindicato.'],
  ];

  const TERMS = {
    prestamo: {
      title: 'Términos y Condiciones · Suti Préstamo',
      intro: 'Crédito sindical con descuento vía nómina para afiliados activos. Lee con atención antes de firmar y enviar tu solicitud.',
      secs: [
        ['Autorización de descuento', 'Autorizas de forma expresa e irrevocable al sindicato y a la dependencia pagadora a descontar de tu nómina el pago quincenal pactado hasta la liquidación total del crédito.'],
        ['Condiciones del crédito', 'El monto, plazo, tasa y pago quincenal mostrados en el resumen son la simulación de tu solicitud. El monto final queda sujeto a la autorización del comité de crédito y a tu capacidad de pago.'],
        ['Resolución', 'El comité resuelve en un máximo de 24 horas hábiles. El sindicato se reserva el derecho de autorizar un monto menor al solicitado o de negar la solicitud.'],
        ['Incumplimiento', 'La falta de pago faculta al sindicato a suspender beneficios y a iniciar la recuperación del adeudo conforme al reglamento interno.'],
        ...COMUN,
      ],
    },
    cotizacion: {
      title: 'Términos y Condiciones · Solicitud de cotización',
      intro: 'Solicitud de presupuesto a un proveedor con convenio sindical. No representa contratación ni compromiso de compra.',
      secs: [
        ['Alcance', 'Al enviar esta solicitud autorizas que el Área de Finanzas comparta tu nombre, sindicato y el detalle de tu interés con el proveedor asignado, con el único fin de elaborar una cotización.'],
        ['Sin compromiso', 'Recibir la cotización no te obliga a contratar. Podrás aceptarla, simular su financiamiento o descartarla sin costo alguno.'],
        ['Vigencia del presupuesto', 'Los montos cotizados tienen la vigencia que indique el proveedor. Vencida esa fecha deberás solicitar una nueva cotización.'],
        ...COMUN,
      ],
    },
    financiamiento: {
      title: 'Términos y Condiciones · Financiamiento de productos y servicios',
      intro: 'Financiamiento sindical con descuento vía nómina para productos y servicios de proveedores con convenio.',
      secs: [
        ['Autorización de descuento', 'Autorizas al sindicato y a la dependencia pagadora a descontar de tu nómina el pago quincenal indicado en la simulación, hasta cubrir el total del financiamiento.'],
        ['Producto o servicio', 'El sindicato gestiona el financiamiento; la entrega, garantía y calidad del producto o servicio son responsabilidad del proveedor conforme al convenio vigente.'],
        ['Capacidad de pago', 'La solicitud puede ser negada o ajustada si el descuento quincenal compromete más del porcentaje permitido de tu percepción.'],
        ...COMUN,
      ],
    },
    general: {
      title: 'Términos y Condiciones del programa',
      intro: 'Lee con atención antes de firmar y enviar tu solicitud.',
      secs: COMUN,
    },
  };

  const termsFor = (key) => TERMS[key] || TERMS.general;

  // ── Pantalla de Términos y Condiciones ────────────────────────────────
  function TermsScreen({ open, onClose, programa, subtitulo, termsVersion }) {
    if (!open) return null;
    const t = termsVersion ? { title: termsVersion.title, intro: 'Versión '+termsVersion.version+' · publicada para este programa.', secs: String(termsVersion.body||'').split(/\n\s*\n/).filter(Boolean).map((body,index)=>['Cláusula '+(index+1),body]) } : termsFor(programa);
    return React.createElement('div', {
      style: { position: 'absolute', inset: 0, zIndex: 90, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'su-fadein .18s ease' },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(10px + env(safe-area-inset-top)) 16px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onClose, 'aria-label': 'Cerrar', style: { width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: 'none', background: 'var(--surface-2)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer' } },
          React.createElement(I, { name: 'arrowL', size: 20, stroke: 2.2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 15.5, fontWeight: 900, letterSpacing: '-.01em', lineHeight: 1.25 } }, 'Términos y Condiciones'),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, subtitulo || t.title.split('· ')[1] || 'Programa sindical'))),
      React.createElement('div', { className: 'su-app-scroll su-route', style: { flex: 1, overflowY: 'auto', padding: '16px 18px calc(20px + env(safe-area-inset-bottom))' } },
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: '18px 18px 6px', boxShadow: 'var(--neo-sm)' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } },
            React.createElement('div', { style: { width: 38, height: 38, borderRadius: 12, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } },
              React.createElement(I, { name: 'shield', size: 20, stroke: 2 })),
            React.createElement('div', { style: { fontSize: 15, fontWeight: 900, lineHeight: 1.3 } }, t.title)),
          React.createElement('p', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.55, margin: '0 0 16px' } }, t.intro),
          t.secs.map((s, i) => React.createElement('div', { key: i, style: { padding: '13px 0', borderTop: '1px solid var(--hairline)' } },
            React.createElement('div', { style: { display: 'flex', gap: 9, alignItems: 'baseline' } },
              React.createElement('span', { style: { fontSize: 11.5, fontWeight: 800, color: 'var(--guinda)', fontFamily: 'var(--mono)', flexShrink: 0 } }, String(i + 1).padStart(2, '0')),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, s[0]),
                React.createElement('p', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, lineHeight: 1.6, margin: '4px 0 0', textWrap: 'pretty' } }, s[1])))))),
        React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 11.5, fontWeight: 700, margin: '14px 0 4px' } },
          React.createElement(I, { name: 'lock', size: 14, stroke: 2 }), 'SUTISSSTESON · Documento informativo'),
        React.createElement(window.Btn, { full: true, size: 'lg', style: { marginTop: 12 }, onClick: onClose }, 'Entendido')));
  }

  // ── Lienzo de firma ───────────────────────────────────────────────────
  function SignaturePad({ value, onChange, label }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const last = useRef(null);

    // Escala el lienzo al ancho real del contenedor (retina-aware)
    useEffect(() => {
      const c = canvasRef.current, wrap = wrapRef.current;
      if (!c || !wrap) return;
      const setup = () => {
        const w = wrap.clientWidth, h = 150;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (c.width === Math.round(w * dpr)) return;
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.style.width = w + 'px'; c.style.height = h + 'px';
        const ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14213d';
      };
      setup();
      const ro = new ResizeObserver(setup);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, []);

    const pos = (e) => {
      const r = canvasRef.current.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e) => {
      e.preventDefault();
      drawing.current = true; last.current = pos(e);
      try { canvasRef.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(last.current.x + .01, last.current.y); ctx.stroke();
      dirty.current = true;
    };
    const move = (e) => {
      if (!drawing.current) return;
      e.preventDefault();
      const p = pos(e), ctx = canvasRef.current.getContext('2d');
      ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last.current = p;
    };
    const end = (e) => {
      if (!drawing.current) return;
      drawing.current = false;
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (dirty.current) onChange(canvasRef.current.toDataURL('image/png'));
    };
    const clear = () => {
      const c = canvasRef.current, ctx = c.getContext('2d');
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore();
      dirty.current = false; onChange('');
    };

    return React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          React.createElement(I, { name: 'sign', size: 16, stroke: 2.2, style: { color: 'var(--guinda)' } }),
          React.createElement('span', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' } }, label || 'Firma electrónica')),
        value ? React.createElement('button', { onClick: clear, style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: 'var(--guinda)' } }, 'Borrar') : null),
      React.createElement('div', { ref: wrapRef, style: { position: 'relative', borderRadius: 16, background: 'var(--surface)', border: '1.5px dashed ' + (value ? 'var(--guinda-100)' : 'var(--hairline-strong)'), overflow: 'hidden' } },
        React.createElement('canvas', {
          ref: canvasRef, onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onPointerLeave: end,
          style: { display: 'block', width: '100%', height: 150, touchAction: 'none', cursor: 'crosshair', position: 'relative', zIndex: 2 },
        }),
        !value && React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, pointerEvents: 'none', zIndex: 1 } },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' } }, 'Firma aquí con tu dedo'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', opacity: .8 } }, 'Traza tu firma dentro del recuadro')),
        React.createElement('div', { style: { position: 'absolute', left: 22, right: 22, bottom: 26, height: 1, background: 'var(--hairline)', zIndex: 0 } })),
      value
        ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5, fontWeight: 700, color: '#13794A' } },
          React.createElement(I, { name: 'checkCircle', size: 14, stroke: 2.2 }), 'Firma capturada')
        : React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 6 } }, 'Obligatoria para enviar la solicitud'));
  }

  // ── Bloque completo: firma + términos ─────────────────────────────────
  function SignBlock({ programa, subtitulo, firma, setFirma, accept, setAccept, texto, compact, termsVersion }) {
    const [terms, setTerms] = useState(false);
    return React.createElement('div', { style: { marginTop: compact ? 14 : 18 } },
      React.createElement('div', { style: { height: 1, background: 'var(--hairline)', marginBottom: 14 } }),
      React.createElement(SignaturePad, { value: firma, onChange: setFirma }),
      React.createElement('button', {
        onClick: () => setAccept(!accept),
        style: { display: 'flex', gap: 11, alignItems: 'flex-start', marginTop: 14, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, width: '100%' },
      },
        React.createElement('div', { style: { width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, border: accept ? 'none' : '2px solid var(--hairline-strong)', background: accept ? 'var(--guinda)' : 'transparent', display: 'grid', placeItems: 'center', color: '#fff' } },
          accept && React.createElement(I, { name: 'check', size: 15, stroke: 3 })),
        React.createElement('span', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } },
          texto || 'He leído y acepto los ',
          React.createElement('span', {
            onClick: (e) => { e.stopPropagation(); setTerms(true); },
            style: { color: 'var(--guinda)', fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 2 },
          }, 'Términos y Condiciones'),
          ' de este programa.')),
      React.createElement(TermsScreen, { open: terms, onClose: () => setTerms(false), programa, subtitulo, termsVersion }));
  }

  Object.assign(window, { SignaturePad, TermsScreen, SignBlock, termsFor });
})();
