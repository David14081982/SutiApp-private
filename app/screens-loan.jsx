/* screens-loan.jsx — StepSimulatorV2 visual cutover over the Phase 7 read-only contract. */
(function () {
  const I = window.Icon;
  const dash = '—';
  const moneyOrDash = (value) => typeof value === 'number' && Number.isFinite(value) ? window.money(value) : dash;
  const exactMoneyOrDash = (value) => typeof value === 'number' && Number.isFinite(value) ? window.money(value, { dec: 2 }) : dash;
  const textOrDash = (value) => typeof value === 'string' && value.trim() ? value.trim() : dash;

  // Pista MODULAR: `cycle + 1` glifos donde el último repite el primero. Las
  // vueltas las produce `MOTION.spinSlot` reiniciando el traslado sobre esa
  // repetición, así que un dígito cuesta 11 nodos y no ~65. Los estilos son
  // constantes hoisted: cero objetos nuevos por render.
  const ODOMETER_CYCLE = 10;
  const digitBoxStyle = { position: 'relative', display: 'inline-block', width: '.62em', height: '1em', overflow: 'hidden', verticalAlign: '-.08em' };
  const digitTrackStyle = { position: 'absolute', inset: '0 auto auto 0', display: 'flex', flexDirection: 'column', width: '100%', lineHeight: '1em', willChange: 'transform', transform: 'translateY(0)' };
  const digitGlyphStyle = { display: 'block', flex: '0 0 1em', height: '1em', lineHeight: '1em', textAlign: 'center' };
  const currencyGlyphStyle = { display: 'inline-block', transform: 'translateY(-.20em)' };
  const odometerBaseStyle = { display: 'inline-flex', alignItems: 'baseline', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const cellMoneyStyle = { whiteSpace: 'nowrap', letterSpacing: '-.02em' };
  const trackGlyphs = (start) => {
    const glyphs = [];
    for (let offset = 0; offset <= ODOMETER_CYCLE; offset += 1) glyphs.push(String((start + offset) % 10));
    return glyphs;
  };

  const OdometerDigit = React.memo(function OdometerDigit({ target, previous, index, loading, motionEpoch, cycleKey }) {
    const track = React.useRef(null);
    const completedFor = React.useRef(null);
    const start = /^[0-9]$/.test(previous || '') ? Number(previous) : ((index * 3) + 7) % 10;
    const end = /^[0-9]$/.test(target || '') ? Number(target) : start;
    const delta = (end - start + ODOMETER_CYCLE) % ODOMETER_CYCLE;
    const glyphs = trackGlyphs(start);
    React.useLayoutEffect(() => {
      const completionKey = String(cycleKey || '') + ':' + target;
      const animation = window.MOTION && window.MOTION.spinSlot
        ? window.MOTION.spinSlot(track.current, { delta, index, loading, immediate: !loading && completedFor.current === completionKey })
        : null;
      const markComplete = () => { if (!loading) completedFor.current = completionKey; };
      if (animation) animation.addEventListener('finish', markComplete, { once: true }); else markComplete();
      return () => { if (animation) { animation.removeEventListener('finish', markComplete); animation.cancel(); } };
    }, [target, previous, index, loading, motionEpoch, cycleKey, delta]);
    return React.createElement('span', { className: 'su-odometer-digit', 'data-odometer-digit': '', style: digitBoxStyle },
      React.createElement('span', { ref: track, className: 'su-odometer-track', 'data-odometer-track': loading ? 'loading' : 'settling', style: digitTrackStyle },
        glyphs.map((digit, offset) => React.createElement('span', { key: offset, style: digitGlyphStyle }, digit))));
  });

  function OdometerText({ text, previousText, loading, style, ariaLabel, cycleKey }) {
    const [motionEpoch, setMotionEpoch] = React.useState(0);
    React.useEffect(() => {
      const refresh = () => setMotionEpoch((value) => value + 1);
      document.addEventListener('visibilitychange', refresh);
      const offReduced = window.MOTION && window.MOTION.onReduced ? window.MOTION.onReduced(refresh) : null;
      return () => { document.removeEventListener('visibilitychange', refresh); if (offReduced) offReduced(); };
    }, []);
    let digitIndex = -1;
    const previousDigits = String(previousText || '').replace(/[^0-9]/g, '');
    // Las ruedas se identifican por POSICIÓN DECIMAL (desde la derecha), no por
    // posición en la cadena. Si el importe gana o pierde un dígito, las unidades
    // siguen siendo las unidades: sólo se agrega o quita una rueda en el extremo
    // y ninguna de las existentes se re-monta ni gira de más.
    const digitCount = String(text).replace(/[^0-9]/g, '').length;
    return React.createElement('span', {
      className: 'su-odometer',
      'data-odometer-state': loading ? 'spinning' : 'settling',
      // Importes en movimiento: no son copy editable ni tarjeta revelable. Sin
      // esto los observers globales recorren cada glifo en cada commit.
      'data-notext': '',
      'data-noreveal': '',
      role: loading ? undefined : 'img',
      'aria-label': loading ? undefined : ariaLabel,
      'aria-hidden': loading ? 'true' : undefined,
      style: style ? { ...odometerBaseStyle, ...style } : odometerBaseStyle,
    }, Array.from(text).map((char, characterIndex) => {
      if (!/^[0-9]$/.test(char)) return React.createElement('span', {
        key: characterIndex,
        'aria-hidden': 'true',
        'data-odometer-currency': char === '$' ? '' : undefined,
        style: char === '$' ? currencyGlyphStyle : undefined,
      }, char);
      digitIndex += 1;
      const place = digitCount - 1 - digitIndex;
      return React.createElement(OdometerDigit, { key: 'p' + place, target: char, previous: previousDigits[previousDigits.length - 1 - place], index: digitIndex, loading, motionEpoch, cycleKey });
    }));
  }

  // NO REMOUNT: mientras se recotiza, el motor del odómetro se queda montado y
  // conserva la FORMA del último importe válido (mismo número de glifos), así
  // que las ruedas giran sobre la misma pista en vez de destruirse y volver a
  // crearse. El valor anterior nunca se presenta como vigente: mientras
  // `loading` está activo el nodo va `aria-hidden` y sin `aria-label`, y los
  // dígitos están girando — no hay importe legible hasta que asienta.
  function SmoothMoney({ value, loading = false, compact = false, style, cycleKey }) {
    const valid = typeof value === 'number' && Number.isFinite(value);
    const label = valid ? exactMoneyOrDash(value) : null;
    const previous = React.useRef(null);
    const previousLabel = previous.current;
    React.useEffect(() => { if (label) previous.current = label; }, [label]);
    const placeholder = compact ? '$8888' : '$8,888.88';
    return React.createElement(OdometerText, {
      text: valid ? label : (previousLabel || placeholder),
      previousText: previousLabel,
      loading: loading || !valid,
      ariaLabel: label,
      cycleKey,
      style,
    });
  }

  function LoadingReels({ columns = 2, cycleKey }) {
    return React.createElement(OdometerText, { text: '8'.repeat(columns), previousText: '', loading: true, cycleKey });
  }

  function Shell({ app, children, onBack, title }) {
    return React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' } },
        React.createElement('button', { onClick: onBack || app.back, 'aria-label': 'Volver', 'data-press': 'subtle', style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'arrowL', size: 22, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 16.5, fontWeight: 800, color: 'var(--ink)' } }, title || 'Suti Préstamo')),
      children);
  }

  function eligibilityDenied(value) {
    if (value === false) return true;
    if (typeof value === 'string') return ['NOT_ELIGIBLE', 'NO_ELEGIBLE', 'DENIED'].includes(value.toUpperCase());
    return !!(value && typeof value === 'object' && (value.eligible === false || value.status === 'NOT_ELIGIBLE'));
  }

  function StatusNotice({ state, onRetry }) {
    const notices = {
      LOADING: ['clock', 'Estamos consultando tus condiciones', 'Esto puede tomar unos segundos.'],
      NOT_ELIGIBLE: ['info', 'Este programa no está disponible para tu perfil', 'Puedes revisar otros programas o volver más tarde.'],
      SCHEDULED: ['calendar', 'Tienes un programa próximo', 'Podrás simularlo cuando llegue su fecha de disponibilidad.'],
      INCOMPLETE: ['info', 'Completa tu perfil financiero', 'Se necesita tu categoría laboral y sindicato para consultar tus opciones.'],
      ERROR: ['info', 'No pudimos calcular la simulación.', 'Intenta nuevamente. Si continúa, solicita apoyo.'],
      UNAVAILABLE: ['clock', 'Simulador no disponible por el momento', 'Tus pasos y datos permanecen sin cambios.'],
    };
    const item = notices[state];
    if (!item) return null;
    return React.createElement('div', { role: state === 'ERROR' ? 'alert' : 'status', 'data-simulator-state': state, style: { display: 'flex', gap: 11, alignItems: 'flex-start', padding: '13px 14px', borderRadius: 16, background: 'var(--surface)', boxShadow: 'var(--neo-sm)' } },
      React.createElement(window.IconTile, { icon: item[0], size: 38 }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, item[1]),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginTop: 2 } }, item[2])),
      (state === 'ERROR' || state === 'UNAVAILABLE') && React.createElement('button', { onClick: onRetry, style: { border: 'none', background: 'transparent', color: 'var(--guinda)', font: '700 12px var(--font)', cursor: 'pointer', padding: '3px 0' } }, 'Reintentar'));
  }

  function FundPicker({ programs, selected, setSelected, disabled, onSelect }) {
    if (!programs.length) return null;
    return React.createElement('div', { 'data-loan-funds': '' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' } }, programs.length > 1 ? 'Fondos disponibles' : 'Fondo aplicable'),
        programs.length > 1 && React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' } }, programs.length + ' opciones')),
      React.createElement('div', { style: { display: 'flex', gap: 9, overflowX: 'auto', padding: '2px 20px 6px', margin: '0 -20px', scrollbarWidth: 'none' } },
        programs.map((item) => {
          const rate = Number(item.rate);
          const ratePeriod = textOrDash(item.rate_period);
          const rateLabel = Number.isFinite(rate) && ratePeriod !== dash
            ? rate.toLocaleString('es-MX', { maximumFractionDigits: 4 }) + '% ' + ratePeriod
            : 'Tasa no disponible';
          return React.createElement('button', { key: item.id, disabled, onClick: () => setSelected(item.id), 'data-on': selected === item.id ? '1' : '0', 'data-press': 'subtle', style: { minWidth: 145, flexShrink: 0, borderRadius: 16, border: selected === item.id ? '1.5px solid var(--guinda)' : '1.5px solid transparent', background: selected === item.id ? 'var(--guinda-50)' : 'var(--surface)', boxShadow: selected === item.id ? 'none' : 'var(--neo-sm)', color: selected === item.id ? 'var(--guinda)' : 'var(--ink)', padding: '11px 12px', textAlign: 'left', fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', transition: 'border-color .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            React.createElement(I, { name: 'wallet', size: 15, stroke: 2.2, style: { color: selected === item.id ? 'var(--guinda)' : 'var(--ink-3)' } }),
            React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800 } }, item.label || item.fund)),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: selected === item.id ? 'rgba(145,0,34,.68)' : 'var(--ink-3)', marginTop: 5 } }, 'Hasta ' + moneyOrDash(Number(item.max_amount))),
          React.createElement('div', { 'data-fund-rate': '', style: { fontSize: 11, fontWeight: 600, color: selected === item.id ? 'rgba(145,0,34,.68)' : 'var(--ink-3)', marginTop: 2 } }, rateLabel));
        })));
  }

  function ResultCard({ result, periodLabel, initialLoading, updating, failed, animationCycle, loadingCycle }) {
    const cells = [
      ['Recibes', result && result.amount],
      ['Interés', result && Math.round(result.interest)],
      ['Gto. admin.', result && Math.round(result.administrativeFeeTotal)],
      ['Total', result && Math.round(result.total)],
    ];
    const loadingMotion = initialLoading || updating;
    const placeholderCycle = loadingCycle + ':' + (failed ? 'error' : loadingMotion ? 'loading' : 'idle');
    const resultState = initialLoading ? 'initial-loading' : failed ? 'error' : updating ? 'recalculating' : 'ready';
    return React.createElement('div', { style: { position: 'sticky', top: -8, zIndex: 3, margin: '0 -20px', padding: '0 20px 10px', background: 'linear-gradient(var(--bg) 78%, transparent)' } },
      React.createElement('div', { 'data-simulator-result': resultState, 'aria-busy': initialLoading || updating ? 'true' : 'false', 'aria-label': 'Resultado de la simulación', style: { minHeight: 159, boxSizing: 'border-box', background: 'var(--grad-guinda)', color: '#fff', borderRadius: 24, padding: '18px 18px 16px', boxShadow: 'var(--glow-guinda)', position: 'relative', overflow: 'hidden' } },
        React.createElement('div', { 'aria-hidden': 'true', style: { position: 'absolute', width: 150, height: 150, borderRadius: '50%', right: -60, top: -82, background: 'rgba(255,255,255,.10)' } }),
        React.createElement('div', { style: { opacity: updating ? .66 : 1 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 12, opacity: .8, fontWeight: 700, letterSpacing: '.02em' } }, 'Cada pago será de'),
            React.createElement('div', { style: { minWidth: 150, minHeight: 45, borderRadius: 9, fontSize: 40, fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.05, marginTop: 1, whiteSpace: 'nowrap' } },
              React.createElement(SmoothMoney, { value: result ? result.paymentPerPeriod : null, loading: loadingMotion || !result, cycleKey: (loadingMotion || !result) ? placeholderCycle : animationCycle }))),
          React.createElement('div', { style: { textAlign: 'right', fontSize: 11.5, fontWeight: 700, opacity: .85, lineHeight: 1.45, paddingBottom: 5 } },
            updating && React.createElement('div', { role: 'status', 'aria-live': 'polite', style: { display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 2, padding: '3px 7px', borderRadius: 999, background: 'rgba(255,255,255,.14)', fontSize: 10.5 } },
              React.createElement('span', { className: 'su-spinner', 'aria-hidden': 'true', style: { width: 10, height: 10 } }), 'Actualizando…'),
            React.createElement('div', { style: { minHeight: '1.45em' } }, !result
              ? React.createElement(LoadingReels, { columns: 2, cycleKey: placeholderCycle })
              : result.paymentCount + ' ' + result.paymentPeriod),
            React.createElement('div', { style: { minHeight: '1.45em' } }, !result
              ? React.createElement(LoadingReels, { columns: 3, cycleKey: placeholderCycle })
              : result.rate + '% ' + result.ratePeriod))),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 13, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,.18)' } }, cells.map((cell) => React.createElement('div', { key: cell[0], style: { minWidth: 0 } },
          React.createElement('div', { style: { opacity: .72, fontWeight: 600, fontSize: 10.5, whiteSpace: 'nowrap' } }, cell[0]),
          React.createElement('div', { style: { minHeight: '1.2em', fontWeight: 800, marginTop: 2, fontSize: 13, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
            React.createElement(SmoothMoney, { value: result ? cell[1] : null, loading: loadingMotion || !result, compact: true, cycleKey: (loadingMotion || !result) ? placeholderCycle : animationCycle, style: cellMoneyStyle }))))))));
  }

  function AmountField({ amount, setAmount, commitAmount, min, max, disabled }) {
    const bounded = typeof min === 'number' && typeof max === 'number' && max >= min;
    const settle = commitAmount || setAmount;
    // Arrastre y tecleo: valor continuo, entra al debounce.
    const change = (value) => {
      setAmount(Number(value));
    };
    // Fin de gesto o de edición: intención discreta, cotiza de inmediato.
    const commit = (value) => {
      const next = Number(value);
      if (!Number.isFinite(next) || !bounded) return;
      settle(Math.min(max, Math.max(min, next)));
    };
    const showNumericMinimum = bounded && min !== 1;
    const quickValues = bounded ? Array.from(new Set([
      showNumericMinimum ? min : null,
      Math.round((min + ((max - min) * .33)) / 100) * 100,
      Math.round((min + ((max - min) * .66)) / 100) * 100,
      max,
    ].filter((value) => value != null).map((value) => Math.min(max, Math.max(min, value))))) : [];
    const percent = bounded && max > min ? ((Math.min(max, Math.max(min, amount || min)) - min) / (max - min)) * 100 : 0;
    return React.createElement('div', { className: 'su-card', 'data-loan-amount-card': '', style: { background: 'var(--surface)', boxShadow: 'var(--neo-sm)', borderRadius: 20, padding: '16px 16px 14px', opacity: disabled ? .62 : 1 } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '.01em' } }, '¿Cuánto necesitas?'),
      React.createElement('input', { type: 'number', inputMode: 'numeric', value: amount || '', min: bounded ? min : undefined, max: bounded ? max : undefined, disabled: disabled || !bounded, onChange: (event) => change(event.target.value), onBlur: (event) => commit(event.target.value), 'aria-label': 'Monto solicitado', style: { width: '100%', border: 'none', borderBottom: '2px solid var(--guinda)', background: 'transparent', outline: 'none', fontSize: 34, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--guinda)', fontFamily: 'inherit', padding: '4px 0 2px', margin: '2px 0 6px' } }),
      bounded && React.createElement('div', { style: { position: 'relative', height: 30, display: 'flex', alignItems: 'center' } },
        React.createElement('div', { style: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 999, background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)' } }),
        React.createElement('div', { style: { position: 'absolute', left: 0, width: percent + '%', height: 8, borderRadius: 999, background: 'var(--grad-guinda-soft)' } }),
        React.createElement('input', { className: 'su-range', type: 'range', min, max, step: 1, value: Math.min(max, Math.max(min, amount || min)), disabled, onChange: (event) => change(event.target.value), onPointerUp: (event) => commit(event.target.value), onKeyUp: (event) => commit(event.target.value), style: { position: 'absolute', width: '100%', appearance: 'none', background: 'transparent', margin: 0, height: 30, cursor: disabled ? 'default' : 'pointer' } })),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 6 } },
        React.createElement('span', { 'data-loan-min-label': '' }, bounded ? (showNumericMinimum ? moneyOrDash(min) : 'Mínimo') : dash),
        React.createElement('span', null, 'Máximo ', bounded ? moneyOrDash(max) : dash)),
      bounded && React.createElement('div', { 'data-loan-quick-amounts': '', style: { display: 'flex', gap: 7, marginTop: 11, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' } }, quickValues.map((value, index) => {
        const active = amount === value;
        return React.createElement('button', { key: value, type: 'button', disabled, onClick: () => settle(value), 'data-loan-quick-amount': value, 'data-press': 'subtle', style: { flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', border: '1px solid ' + (active ? 'var(--guinda)' : 'var(--hairline)'), background: active ? 'var(--guinda-50)' : 'var(--surface)', color: active ? 'var(--guinda)' : 'var(--ink-2)', fontSize: 12, fontWeight: 700 } }, index === quickValues.length - 1 ? 'Máximo' : moneyOrDash(value));
      })));
  }

  function TermPicker({ terms, selected, setSelected, disabled, result, customTerm }) {
    const min = Number(customTerm && customTerm.min), max = Number(customTerm && customTerm.max);
    const stepSize = Number(customTerm && customTerm.step) || 1;
    const hasCustomRange = Number.isFinite(min) && Number.isFinite(max) && max >= min;
    const [free, setFree] = React.useState(!terms.includes(selected));
    const [draft, setDraft] = React.useState(String(selected || ''));
    React.useEffect(() => {
      setDraft(String(selected || ''));
      if (!terms.includes(selected)) setFree(true);
    }, [selected, terms.join('|')]);
    const quotes = result && Array.isArray(result.termOptions) ? result.termOptions : [];
    const paymentFor = (value) => {
      if (result && result.paymentCount === value) return result.paymentPerPeriod;
      const option = quotes.find((item) => item.term === value);
      return option && option.paymentPerPeriod;
    };
    const clamp = (value) => Math.max(min, Math.min(max, value));
    const commit = (raw) => {
      const parsed = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(parsed)) { setDraft(String(selected)); return; }
      const value = clamp(parsed); setDraft(String(value)); setSelected(value);
    };
    const choosePreset = (value) => { setFree(false); setSelected(value); };
    const chooseFree = () => { setFree(true); if (!selected) setSelected(min); };
    const selectedIsPreset = terms.includes(selected);
    const monthLabel = selected ? ((selected % 2 ? (selected / 2).toFixed(1) : selected / 2) + ' meses') : dash;
    return React.createElement('div', { 'data-loan-terms': '', style: { opacity: disabled ? .62 : 1 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 9px' } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' } }, 'Plazo'),
        React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' } }, monthLabel)),
      React.createElement('div', { style: { display: 'flex', gap: 9, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 20px 6px', margin: '0 -20px' } },
        terms.length || hasCustomRange ? terms.map((value) => {
          const active = value === selected && !free, payment = paymentFor(value);
          return React.createElement('button', { key: value, disabled, onClick: () => choosePreset(value), 'data-term-card': value, 'data-on': active ? '1' : '0', 'data-press': 'subtle', style: { flexShrink: 0, width: 96, padding: '11px 10px 10px', borderRadius: 16, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', border: '1.5px solid ' + (active ? 'var(--guinda)' : 'transparent'), background: active ? 'var(--guinda-50)' : 'var(--surface)', boxShadow: active ? 'none' : 'var(--neo-sm)', transition: 'border-color .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease' } },
            React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: active ? 'var(--guinda)' : 'var(--ink)' } }, value + ' pagos'),
            React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: active ? 'var(--guinda)' : 'var(--ink-3)', marginTop: 3, fontVariantNumeric: 'tabular-nums' } }, payment ? exactMoneyOrDash(payment) : 'Cotizando…'),
            React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: active ? 'rgba(145,0,34,.65)' : 'var(--ink-3)', marginTop: 1 } }, 'por quincena'));
        }).concat(React.createElement('button', { key: 'other', type: 'button', disabled, onClick: chooseFree, 'data-term-card': 'other', 'data-on': free ? '1' : '0', 'data-press': 'subtle', style: { flexShrink: 0, width: 96, padding: '11px 10px 10px', borderRadius: 16, cursor: disabled ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', border: '1.5px ' + (free ? 'solid var(--guinda)' : 'dashed var(--ink-3)'), background: free ? 'var(--guinda-50)' : 'transparent', boxShadow: 'none' } },
          React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: free ? 'var(--guinda)' : 'var(--ink)' } }, free ? selected + (selected === 1 ? ' pago' : ' pagos') : 'Otro'),
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: free ? 'var(--guinda)' : 'var(--ink-3)', marginTop: 3 } }, free && paymentFor(selected) ? exactMoneyOrDash(paymentFor(selected)) : (free ? 'Cotizando…' : 'a tu medida')),
          React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: free ? 'rgba(145,0,34,.65)' : 'var(--ink-3)', marginTop: 1 } }, free ? 'por quincena' : 'elige quincenas'))) : React.createElement('div', { style: { width: '100%', padding: 14, borderRadius: 16, background: 'var(--surface)', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 600 } }, 'Los plazos aparecerán al consultar tus condiciones.')),
      free && Number.isFinite(min) && Number.isFinite(max) && React.createElement('div', { 'data-custom-term-editor': '', style: { marginTop: 4, padding: 12, borderRadius: 16, background: 'var(--surface)', boxShadow: 'var(--neo-sm)' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          React.createElement('button', { type: 'button', disabled: disabled || selected <= min, onClick: () => commit(selected - stepSize), 'aria-label': 'Reducir plazo', style: { width: 40, height: 40, border: 'none', borderRadius: 13, background: 'var(--guinda-50)', color: 'var(--guinda)', fontSize: 20, fontWeight: 800 } }, '−'),
          React.createElement('div', { style: { flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 } },
            React.createElement('input', { value: draft, inputMode: 'numeric', disabled, 'aria-label': 'Plazo en quincenas', onChange: (event) => setDraft(event.target.value.replace(/[^0-9]/g, '').slice(0, 3)), onBlur: (event) => commit(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') { commit(event.target.value); event.target.blur(); } }, style: { width: 62, border: 'none', background: 'transparent', textAlign: 'right', outline: 'none', fontFamily: 'inherit', fontSize: 26, fontWeight: 800, color: 'var(--ink)' } }),
            React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' } }, selected === 1 ? 'quincena' : 'quincenas')),
          React.createElement('button', { type: 'button', disabled: disabled || selected >= max, onClick: () => commit(selected + stepSize), 'aria-label': 'Aumentar plazo', style: { width: 40, height: 40, border: 'none', borderRadius: 13, background: 'var(--guinda-50)', color: 'var(--guinda)', fontSize: 20, fontWeight: 800 } }, '+')),
        React.createElement('div', { style: { marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' } },
          React.createElement('span', null, 'Entre ' + min + ' y ' + max + ' quincenas'),
          terms.length > 0 && React.createElement('button', { type: 'button', onClick: () => { setFree(false); if (!selectedIsPreset) setSelected(terms.reduce((a, b) => Math.abs(b - selected) < Math.abs(a - selected) ? b : a)); }, style: { border: 'none', background: 'transparent', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700 } }, 'Usar plazos sugeridos'))));
  }

  function Breakdown({ result }) {
    const [open, setOpen] = React.useState(false);
    if (!result) return null;
    const adminDetail = moneyOrDash(result.administrativeFeePerPayment) + ' por ' + result.paymentPeriod;
    const rows = [
      ['Recibes', moneyOrDash(result.amount), null],
      ['Tasa', result.rate + '% ' + result.ratePeriod, null],
      ['Interés total', moneyOrDash(result.interest), null],
      ['Gasto administrativo', moneyOrDash(result.administrativeFeeTotal), adminDetail],
      ['Pagos', result.paymentCount + ' ' + result.paymentPeriod, null],
    ];
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), 'aria-expanded': open, 'data-press': 'subtle', style: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 'none', background: 'transparent', padding: '15px 16px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', textAlign: 'left' } },
        React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800 } }, open ? 'Desglose del préstamo' : 'Ver desglose completo'),
        React.createElement('span', { style: { width: 26, height: 26, borderRadius: 9, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .22s cubic-bezier(.32,.72,0,1)' } }, React.createElement(I, { name: 'chevR', size: 15, stroke: 2.4 }))),
      open && React.createElement('div', { style: { padding: '0 16px 14px' } },
        rows.map((row) => React.createElement('div', { key: row[0], style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderTop: '1px solid var(--hairline)' } },
          React.createElement('span', { style: { fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 } }, row[0]),
          React.createElement('span', { style: { textAlign: 'right' } },
            React.createElement('span', { style: { display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, row[1]),
            row[2] && React.createElement('span', { style: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, row[2])))),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, padding: '13px 15px', borderRadius: 15, background: 'var(--guinda-50)' } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 800 } }, 'Total a pagar'),
          React.createElement('span', { style: { fontSize: 20, fontWeight: 800, color: 'var(--guinda)', fontVariantNumeric: 'tabular-nums' } }, moneyOrDash(result.total)))));
  }

  function quoteMatchesSelection(result, program, amount, term) {
    if (!result || !program || result.amount !== amount || result.paymentCount !== term) return false;
    return result.program === program.program_id || result.program === program.id || result.fund === program.fund;
  }

  // La cotización interactiva viaja por `client.rpc` (PostgREST), no por Edge
  // Function: se clasifican fallos de transporte del navegador y códigos
  // transitorios reales de PostgREST/PostgreSQL. SNAPSHOT_INVALID queda fuera a
  // propósito — tiene su propia recuperación silenciosa en el repositorio.
  const RETRYABLE_TRANSPORT = [
    'failed to fetch', 'network request failed', 'networkerror', 'load failed',
    'connection closed', 'socket hang up', 'err_network', 'err_connection',
  ];
  // 57014 statement_timeout · 40001 serialization_failure · 40p01 deadlock
  // 55p03 lock_not_available · 08006 connection_failure · 53300 too_many_connections
  const RETRYABLE_POSTGRES = ['57014', '40001', '40p01', '55p03', '08006', '53300'];
  const RETRYABLE_GATEWAY = ['502', '503', '504', 'bad gateway', 'service unavailable', 'gateway timeout'];
  function isRetryableQuoteTransportError(error) {
    const message = String(error || '').toLowerCase();
    if (!message || message.includes('snapshot_invalid')) return false;
    return RETRYABLE_TRANSPORT.some((token) => message.includes(token)) ||
      RETRYABLE_POSTGRES.some((code) => message.includes(code)) ||
      RETRYABLE_GATEWAY.some((token) => message.includes(token));
  }

  const allowedTermsOf = (program) => (program && Array.isArray(program.allowed_terms)
    ? program.allowed_terms.filter((value) => typeof value === 'number' && value > 0) : []);

  function customTermAccepts(program, term) {
    const custom = (program && program.custom_term) || {};
    const min = Number(custom.min), max = Number(custom.max), step = Number(custom.step);
    return Number.isInteger(term) && Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) &&
      step > 0 && term >= min && term <= max && (term - min) % step === 0;
  }

  // SELECCIÓN ATÓMICA: fondo, monto y plazo se derivan juntos, así `selectionKey`
  // cambia UNA sola vez al tocar una card. Antes el fondo se aplicaba en un
  // render y el ajuste de monto/plazo en el siguiente: ese estado intermedio
  // disparaba una cotización que se desechaba y empujaba la real al debounce.
  function deriveSelection(program, previous) {
    if (!program) return { programId: '', amount: 0, term: 0 };
    const terms = allowedTermsOf(program);
    const min = Number(program.min_amount), max = Number(program.max_amount);
    const suggested = Number(program.suggested_amount || program.min_amount);
    const previousAmount = previous && Number(previous.amount);
    const amount = Number.isFinite(previousAmount) && previousAmount > 0 && Number.isFinite(min) && Number.isFinite(max)
      ? Math.min(max, Math.max(min, previousAmount))
      : suggested;
    const previousTerm = previous && previous.term;
    // Un plazo personalizado válido para el fondo nuevo se conserva: reiniciarlo
    // a `terms[0]` cambiaba la selección a espaldas del afiliado.
    const term = terms.includes(previousTerm) || customTermAccepts(program, previousTerm)
      ? previousTerm
      : (terms[0] || Number(program.custom_term && program.custom_term.min) || 0);
    return { programId: program.id, amount, term };
  }

  const sameSelection = (a, b) => !!a && !!b && a.programId === b.programId && a.amount === b.amount && a.term === b.term;

  // Proyección de un plazo sugerido a partir de `termOptions`, que el servidor
  // ya calculó para ESTE fondo y ESTE monto en la respuesta vigente. No hay
  // aritmética en el navegador: cada importe se copia tal cual del servidor.
  function projectTermOption(base, term) {
    if (!base || !Array.isArray(base.termOptions)) return null;
    const option = base.termOptions.find((item) => item && item.term === term);
    if (!option) return null;
    return Object.freeze({ ...base,
      paymentCount: option.paymentCount,
      interest: option.interest,
      administrativeFeePerPayment: option.administrativeFeePerPayment,
      administrativeFeeTotal: option.administrativeFeeTotal,
      total: option.total,
      paymentPerPeriod: option.paymentPerPeriod,
      projectedFromTermOptions: true });
  }

  function StepSimulatorV2({ financial, onSimulationChange }) {
    const overview = financial.overview || {};
    const programs = Array.isArray(overview.programs) ? overview.programs.filter((item) => item.status === 'AVAILABLE') : [];
    // Estado compuesto: una sola transición por intención del afiliado.
    // `immediate` viaja DENTRO de la selección para que no pueda consumirse
    // sobre una selección intermedia que el mismo commit ya invalidó.
    const [selection, setSelection] = React.useState(() => ({ ...deriveSelection(programs[0] || null, null), immediate: true }));
    const program = programs.find((item) => item.id === selection.programId) || programs[0] || null;
    const terms = allowedTermsOf(program);
    const amount = selection.amount;
    const term = selection.term;
    const [confirmed, setConfirmed] = React.useState({ key: '', quote: null, revision: 0 });
    const [requestError, setRequestError] = React.useState(null);
    const timer = React.useRef(null);
    const queued = React.useRef(null);
    const running = React.useRef(false);
    const activeRequest = React.useRef(null);
    const mounted = React.useRef(true);
    const latestSelection = React.useRef('');
    const quoteRevision = React.useRef(0);
    // Presupuesto acotado por evidencia. Latencia medida contra Supabase en
    // vivo (12 muestras): mediana 178 ms, p90 250 ms, máximo 364 ms. El corte a
    // 4 s deja ~11× de holgura sobre el máximo observado y acota el peor caso a
    // 2 × 4 s + 300 ms ≈ 8.3 s. Un servicio caído se reporta pronto, no tras
    // medio minuto.
    const quoteTimeoutMs = 4000;
    const maxQuoteAttempts = 2;
    const quoteRetryDelayMs = 300;

    // Reconciliación con el overview autoritativo: si el fondo vigente
    // desaparece o sus límites cambian, la selección se re-deriva ENTERA.
    React.useEffect(() => {
      if (!program) return;
      setSelection((current) => {
        const next = deriveSelection(program, current);
        return sameSelection(current, next) ? current : { ...next, immediate: true };
      });
    }, [program && program.id, program && program.max_amount, program && program.min_amount]);

    React.useEffect(() => () => {
      mounted.current = false;
      clearTimeout(timer.current);
      queued.current = null;
      if (activeRequest.current) {
        activeRequest.current.reason = 'unmounted';
        activeRequest.current.controller.abort();
      }
    }, []);

    const minAmount = program && Number(program.min_amount);
    const maxAmount = program && Number(program.max_amount);
    const customTerm = program && program.custom_term || {};
    const customMin = Number(customTerm.min), customMax = Number(customTerm.max), customStep = Number(customTerm.step);
    const validTerm = Number.isInteger(term) && Number.isFinite(customMin) && Number.isFinite(customMax) && Number.isFinite(customStep) &&
      term >= customMin && term <= customMax && (term - customMin) % customStep === 0;
    const validSelection = !!(program && Number.isFinite(amount) && amount > 0 &&
      Number.isFinite(minAmount) && Number.isFinite(maxAmount) && amount >= minAmount && amount <= maxAmount && validTerm);
    const selectionKey = validSelection ? [program.id, amount, term].join('|') : '';
    latestSelection.current = selectionKey;

    const drainQueue = async () => {
      if (running.current) return;
      running.current = true;
      try {
        while (mounted.current && queued.current) {
          const request = queued.current;
          queued.current = null;
          let snapshot = null;
          for (let attempt = 0; attempt < maxQuoteAttempts && mounted.current && latestSelection.current === request.key; attempt += 1) {
            const active = { controller: new AbortController(), reason: '', key: request.key };
            activeRequest.current = active;
            const timeoutId = setTimeout(() => {
              active.reason = 'timeout';
              active.controller.abort();
            }, quoteTimeoutMs);
            try {
              snapshot = await window.financialLegacyStore.requestLoanSessionQuote(
                request.programId, request.amount, request.term, { signal: active.controller.signal });
              if (snapshot && snapshot.status === 'error' && isRetryableQuoteTransportError(snapshot.error) &&
                attempt < maxQuoteAttempts - 1 && latestSelection.current === request.key) {
                snapshot = null;
                await new Promise((resolve) => setTimeout(resolve, quoteRetryDelayMs));
                continue;
              }
              break;
            } catch (error) {
              if (active.controller.signal.aborted && active.reason !== 'timeout') break;
              if (active.reason === 'timeout' && attempt < maxQuoteAttempts - 1 && latestSelection.current === request.key) {
                await new Promise((resolve) => setTimeout(resolve, quoteRetryDelayMs));
                continue;
              }
              snapshot = { status: 'error', error: active.reason === 'timeout'
                ? 'SIMULATION_TIMEOUT'
                : error && (error.code || error.message) || 'SIMULATION_UNAVAILABLE' };
            } finally {
              clearTimeout(timeoutId);
              if (activeRequest.current === active) activeRequest.current = null;
            }
          }
          if (!snapshot) continue;
          if (!mounted.current) break;
          if (latestSelection.current === request.key && snapshot.status === 'ready' &&
            quoteMatchesSelection(snapshot.quote, request.program, request.amount, request.term)) {
            quoteRevision.current += 1;
            setConfirmed({ key: request.key, quote: snapshot.quote, revision: quoteRevision.current });
            setRequestError(null);
          } else if (latestSelection.current === request.key && snapshot.status === 'ready') {
            setRequestError('SIMULATION_RESPONSE_MISMATCH');
          } else if (latestSelection.current === request.key && snapshot.status === 'error') {
            setRequestError(snapshot.error || 'SIMULATION_UNAVAILABLE');
          }
        }
      } finally {
        running.current = false;
        if (mounted.current && queued.current) drainQueue();
      }
    };

    const enqueueCurrent = (delay) => {
      clearTimeout(timer.current);
      if (activeRequest.current) {
        activeRequest.current.reason = 'superseded';
        activeRequest.current.controller.abort();
      }
      if (!validSelection) return;
      setRequestError(null);
      const request = { key: selectionKey, programId: program.id, program, amount, term };
      if (delay === 0) {
        queued.current = request;
        drainQueue();
        return;
      }
      timer.current = setTimeout(() => {
        queued.current = request;
        drainQueue();
      }, delay);
    };

    React.useEffect(() => {
      if (!validSelection) { clearTimeout(timer.current); return undefined; }
      if (confirmed.key === selectionKey && quoteMatchesSelection(confirmed.quote, program, amount, term)) {
        return undefined;
      }
      // `immediate` pertenece a la selección que acaba de comprometerse, así
      // que un toque discreto (fondo, plazo, monto rápido) cotiza sin espera y
      // sólo el arrastre/tecleo continuo entra al debounce de 320 ms.
      const delay = selection.immediate ? 0 : 320;
      enqueueCurrent(delay);
      return () => clearTimeout(timer.current);
    }, [selectionKey, selection.immediate]);

    // A context/token refresh may re-render this route after the repository has
    // already accepted the server quote. Reuse it only when it matches the exact
    // current selection; financial values are never recomputed in the browser.
    const storedQuote = financial && financial.quote;
    const authoritative = confirmed.key === selectionKey && quoteMatchesSelection(confirmed.quote, program, amount, term)
      ? confirmed.quote
      : quoteMatchesSelection(storedQuote, program, amount, term) ? storedQuote : null;
    // PLAZO SUGERIDO INSTANTÁNEO: la respuesta vigente para este fondo y este
    // monto ya trae `termOptions` con los importes de cada plazo estándar
    // resueltos por Supabase. Al tocar un plazo se proyecta ese renglón de
    // inmediato mientras la confirmación autoritativa viaja en segundo plano.
    const projectionBase = !authoritative && validSelection && confirmed.quote &&
      confirmed.quote.amount === amount &&
      (confirmed.quote.program === program.program_id || confirmed.quote.program === program.id || confirmed.quote.fund === program.fund)
      ? confirmed.quote : null;
    // Memoizado a propósito: `projectTermOption` fabrica un objeto nuevo, y el
    // efecto que publica la simulación al padre depende de la IDENTIDAD de
    // `result`. Sin esto cada commit produce un `result` distinto y el par
    // efecto → setState del padre → render se realimenta sin fin.
    const projected = React.useMemo(
      () => (projectionBase ? projectTermOption(projectionBase, term) : null),
      [projectionBase, term]);
    const result = authoritative || projected;
    const overviewLoading = !financial.overview && (financial.status === 'idle' || financial.status === 'loading');
    const effectiveError = validSelection ? requestError : financial.error;
    const unavailableError = /NOT_CONFIGURED|UNAVAILABLE|REJECTED|INVALID_RESPONSE|CONTRACT_MISMATCH/.test(effectiveError || '');
    const initialLoading = !result && !confirmed.quote && !effectiveError && (overviewLoading || !!program);
    const updating = validSelection && !!confirmed.quote && !result && !effectiveError && !overviewLoading;
    const displayedResult = result;
    const state = initialLoading ? 'LOADING'
      : requestError ? 'ERROR'
      : effectiveError ? (unavailableError ? 'UNAVAILABLE' : 'ERROR')
      : result && eligibilityDenied(result.eligibility) ? 'NOT_ELIGIBLE'
      : overview.reason === 'INCOMPLETE_FINANCIAL_PROFILE' ? 'INCOMPLETE'
      : overview.status === 'SCHEDULED' ? 'SCHEDULED'
      : overview.status === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE'
      : !program ? 'UNAVAILABLE' : 'READY';
    const paymentPeriod = result ? result.paymentPeriod : textOrDash(program && program.payment_period) === dash ? 'periodo' : program.payment_period;
    const retry = () => {
      if (!validSelection) return window.financialLegacyStore.openLoanSession();
      if (requestError === 'SNAPSHOT_INVALID') {
        setRequestError(null);
        return window.financialLegacyStore.openLoanSession(true).then((next) => {
          if (next.status === 'ready' && next.loanSession) enqueueCurrent(0);
        });
      }
      return enqueueCurrent(0);
    };
    // Toque discreto sobre una card = una transición atómica y cotización
    // inmediata. Sólo el arrastre del slider y el tecleo del monto piden
    // debounce, y lo piden explícitamente.
    const selectProgram = (value) => setSelection((current) => {
      const next = deriveSelection(programs.find((item) => item.id === value) || program, current);
      return { ...next, immediate: true };
    });
    const selectTerm = (value) => setSelection((current) => (current.term === value && current.immediate
      ? current : { ...current, term: value, immediate: true }));
    const selectAmount = (value) => setSelection((current) => (current.amount === value && !current.immediate
      ? current : { ...current, amount: value, immediate: false }));
    // Fin del arrastre / monto rápido / salida del campo: la intención ya es
    // discreta, así que se cotiza sin esperar el debounce.
    const commitAmount = (value) => setSelection((current) => (current.amount === value && current.immediate
      ? current : { ...current, amount: value, immediate: true }));

    // useLayoutEffect: el padre deriva `canContinue` de esta simulación. Con un
    // efecto normal el botón se habilitaba un frame DESPUÉS de que los importes
    // ya eran visibles; aquí el commit del padre ocurre antes de pintar.
    React.useLayoutEffect(() => {
      if (!onSimulationChange) return;
      onSimulationChange({
        key: selectionKey,
        program,
        amount,
        term,
        result,
        // Nunca continuar con una cotización de otra selección: `result` sólo
        // existe si coincide con el fondo, monto y plazo vigentes.
        current: state === 'READY' && !!result && !updating && quoteMatchesSelection(result, program, amount, term),
      });
    }, [selectionKey, result, updating, state]);

    return React.createElement('div', { 'data-step-simulator-v2': '', 'data-state': state, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement(ResultCard, { result: displayedResult, periodLabel: paymentPeriod, initialLoading, updating, failed: state === 'ERROR' || state === 'UNAVAILABLE', animationCycle: confirmed.revision, loadingCycle: selectionKey }),
      state !== 'READY' && React.createElement(StatusNotice, { state, onRetry: retry }),
      React.createElement(FundPicker, { programs, selected: program && program.id, setSelected: selectProgram, disabled: overviewLoading }),
      React.createElement(AmountField, { amount, setAmount: selectAmount, commitAmount, min: minAmount, max: maxAmount, disabled: !program || overviewLoading }),
      React.createElement(TermPicker, { terms, selected: term, setSelected: selectTerm, disabled: !program || overviewLoading, result, customTerm: program && program.custom_term }),
      React.createElement(Breakdown, { result }),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--ink-3)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, padding: '0 2px' } },
        React.createElement(I, { name: 'info', size: 14, stroke: 2, style: { flexShrink: 0, marginTop: 1 } }),
        React.createElement('span', null, result ? ('Programa: ' + result.program + ' · Fondo: ' + result.fund) : 'El programa y fondo aplicables aparecerán con el resultado.')));
  }

  function StepDestination({ value, onChange }) {
    return React.createElement('div', { className: 'su-route', style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, padding: '17px 16px', boxShadow: 'var(--neo-sm)' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
          React.createElement(window.IconTile, { icon: 'cash', size: 40 }),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 14, fontWeight: 800 } }, 'Cuéntanos el destino'),
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, 'Una descripción breve es suficiente.'))),
        React.createElement('textarea', { value, onChange: (event) => onChange(event.target.value.slice(0, 500)), rows: 5, placeholder: 'Ej. gastos del hogar, salud o proyecto personal', 'aria-label': 'Destino del préstamo', style: { width: '100%', resize: 'none', border: '1.5px solid var(--hairline)', borderRadius: 15, background: 'var(--surface-2)', color: 'var(--ink)', padding: 14, font: '600 14px/1.5 var(--font)', outline: 'none' } }),
        React.createElement('div', { style: { textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginTop: 6 } }, value.length + '/500')));
  }

  function MissingDocumentsNotice({ missing, onCorrect }) {
    if (!missing || !missing.length) return null;
    return React.createElement('div', { role: 'alert', 'data-loan-missing-documents': '', style: { padding: 13, borderRadius: 14, background: '#FCE9EE', color: '#9B1C31', fontSize: 12, fontWeight: 700, lineHeight: 1.45 } },
      React.createElement('div', { style: { fontWeight: 850 } }, 'Necesitamos actualizar algunos documentos antes de continuar.'),
      React.createElement('div', { style: { marginTop: 7 } }, 'Faltan:'),
      React.createElement('ul', { style: { margin: '4px 0 0', paddingLeft: 19 } }, missing.map((entry) => React.createElement('li', { key: entry.requirement.document_type_id }, entry.requirement.document_type && entry.requirement.document_type.label || 'Documento requerido'))),
      onCorrect && React.createElement('button', { type: 'button', onClick: onCorrect, style: { marginTop: 10, minHeight: 38, border: 0, borderRadius: 10, padding: '0 13px', background: 'var(--guinda)', color: '#fff', fontSize: 12, fontWeight: 850 } }, 'Corregir documentos'));
  }

  function StepDocuments({ requirements, documents, onChanged, phase, missing }) {
    return React.createElement('div', { className: 'su-route', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      React.createElement(window.UnifiedDocumentPhase,{requirements,documents,onChanged,phase,error:'No fue posible consultar los requisitos autorizados.',onRetry:onChanged,accessPurpose:'SELF_SERVICE_LOAN',title:'Verifica tus documentos'}),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--ink-3)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, padding: '5px 2px 0' } },
        React.createElement(I, { name: 'info', size: 14, stroke: 2, style: { flexShrink: 0, marginTop: 1 } }),
        React.createElement('span', null, 'La disponibilidad final se confirma durante la revisión de la solicitud.')));
  }

  function StepSummary({ simulation, destination, signature, setSignature, accepted, setAccepted, terms, missingDocuments, onCorrectDocuments }) {
    const result = simulation && simulation.result;
    if (!result) return React.createElement(StatusNotice, { state: 'UNAVAILABLE' });
    const rows = [
      ['Fondo', result.fund],
      ['Monto solicitado', moneyOrDash(result.amount)],
      ['Plazo', result.paymentCount + ' ' + result.paymentPeriod],
      ['Pago por ' + result.paymentPeriod, moneyOrDash(result.paymentPerPeriod)],
      ['Interés', moneyOrDash(result.interest)],
      ['Gasto administrativo', moneyOrDash(result.administrativeFeeTotal)],
    ];
    return React.createElement('div', { className: 'su-route' },
      React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, padding: '5px 16px 15px', boxShadow: 'var(--neo-sm)' } },
        rows.map((row) => React.createElement('div', { key: row[0], style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--hairline)' } },
          React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' } }, row[0]),
          React.createElement('span', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', textAlign: 'right' } }, row[1]))),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '14px 15px', marginTop: 12, borderRadius: 15, background: 'var(--guinda-50)' } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 800 } }, 'Total a pagar'),
          React.createElement('span', { style: { fontSize: 20, fontWeight: 900, color: 'var(--guinda)' } }, moneyOrDash(result.total))),
        React.createElement('div', { style: { marginTop: 13, padding: '12px 13px', borderRadius: 14, background: 'var(--surface-2)' } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' } }, 'Destino'),
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.45, marginTop: 3 } }, destination))),
      !terms&&React.createElement('div',{role:'alert',style:{marginTop:14,padding:13,borderRadius:13,background:'#FFF4D9',color:'#805100',fontSize:12,fontWeight:700}},'El programa aún no tiene términos publicados. No es posible confirmar hasta que Admin publique una versión.'),
      React.createElement(MissingDocumentsNotice,{missing:missingDocuments,onCorrect:onCorrectDocuments}),
      React.createElement(window.SignBlock, { programa: 'prestamo', subtitulo: 'Suti Préstamo', firma: signature, setFirma: setSignature, accept: accepted, setAccept: setAccepted, termsVersion: terms, texto: 'Autorizo el trámite de esta solicitud y acepto los ' }));
  }

  function Success({ app, folio, amount }) {
    return React.createElement(window.RequestSubmissionSuccess, {
      app, folio, amount, kind: 'loan',
      destination: 'Tu solicitud fue enviada al Área de Finanzas del sindicato para su revisión.',
    });
  }

  const ACCEPTED_LOAN_DOCUMENT_STATUSES = new Set(['PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED']);
  function newestLoanDocument(documents, documentTypeId) {
    return (documents || []).filter((document) => document.document_type_id === documentTypeId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || String(b.id).localeCompare(String(a.id)))[0] || null;
  }
  function resolveLoanDocuments(requirements, documents) {
    const required = (requirements || []).filter((requirement) => requirement.required !== false);
    const resolved = (requirements || []).map((requirement) => {
      const document = newestLoanDocument(documents, requirement.document_type_id);
      const physicallyAvailable = !!(document && document.available === true && document.availability === 'AVAILABLE');
      return { requirement, document, valid: !!(document && ACCEPTED_LOAN_DOCUMENT_STATUSES.has(document.status) && physicallyAvailable) };
    });
    const selected = resolved.filter((entry) => entry.valid).map((entry) => entry.document);
    const missing = resolved.filter((entry) => entry.requirement.required !== false && !entry.valid);
    return { selected, missing };
  }
  function missingLoanDocumentsMessage(requirements) {
    const labels = (requirements || []).map((entry) => { const requirement=entry.requirement||entry; return requirement.document_type && requirement.document_type.label || 'documento requerido'; });
    if (!labels.length) return 'Te faltan documentos obligatorios para continuar. Revisa tu expediente y completa los pendientes.';
    return 'Te faltan documentos obligatorios para continuar. Pendientes: ' + labels.join(', ') + '.';
  }

  function LoanScreen({ app }) {
    const financial = window.useFinancialLegacy ? window.useFinancialLegacy() : { status: 'error', overview: null, quote: null, error: 'UNAVAILABLE' };
    const [step, setStep] = React.useState(0);
    const [simulation, setSimulation] = React.useState(null);
    const [destination, setDestination] = React.useState('');
    const [signature, setSignature] = React.useState('');
    const [accepted, setAccepted] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState('');
    const [documentRecovery,setDocumentRecovery]=React.useState([]);
    const [submission, setSubmission] = React.useState(null);
    const [documentState,setDocumentState]=React.useState({requirements:[],documents:[],terms:null,phase:'loading'});
    const idempotencyKey = React.useRef(window.ProgramRequestRepository && window.ProgramRequestRepository.newIdempotencyKey());
    const scroller = React.useRef(null);
    React.useEffect(() => { if (window.financialLegacyStore) window.financialLegacyStore.ensureLoanSession(); }, []);
    const loadDocuments=React.useCallback(async()=>{setDocumentState((s)=>Object.assign({},s,{phase:'loading'}));try{const r=await window.DocumentWorkflowRepository.requirements('prestamo');const[dResult,tResult]=await Promise.allSettled([window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_LOAN'),window.ProgramTermsRepository.current('prestamo')]);if(dResult.status!=='fulfilled')throw dResult.reason||new Error('DOCUMENTS_UNAVAILABLE');const next={requirements:r.slice(),documents:dResult.value.slice(),terms:tResult.status==='fulfilled'?tResult.value:null,phase:'ready'};setDocumentState(next);if(resolveLoanDocuments(next.requirements,next.documents).missing.length===0)setDocumentRecovery([]);return next;}catch(_){const failed={requirements:[],documents:[],terms:null,phase:'error'};setDocumentState(failed);return null;}},[]);
    React.useEffect(()=>{loadDocuments();},[loadDocuments]);
    React.useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [step]);
    const steps = ['Monto', 'Destino', 'Documentos', 'Resumen'];
    const titles = ['Simula tu préstamo', '¿Para qué lo necesitas?', 'Verifica tus documentos', 'Confirma tu solicitud'];
    const loanDocumentSelection=resolveLoanDocuments(documentState.requirements,documentState.documents);
    const documentsReady=documentState.phase==='ready'&&loanDocumentSelection.missing.length===0;
    const canContinue = step === 0 ? !!(simulation && simulation.current)
      : step === 1 ? !!destination.trim()
      : step === 2 ? documentsReady
      : !!(simulation && simulation.current && signature && accepted && documentState.terms && documentsReady && !documentRecovery.length && !submitting);
    const goBack = () => step ? setStep(step - 1) : app.back();
    const submit = async () => {
      if (!canContinue || !window.ProgramCatalogRepository || !window.ProgramRequestRepository || !window.financialLegacyStore) return;
      setSubmitting(true); setSubmitError('');
      try {
        const freshDocumentState=await loadDocuments();
        if(!freshDocumentState){setStep(2);setSubmitError('No fue posible verificar tu expediente. Intenta consultar los documentos nuevamente.');return;}
        const freshDocuments=resolveLoanDocuments(freshDocumentState.requirements,freshDocumentState.documents);
        if(freshDocuments.missing.length){setDocumentRecovery(freshDocuments.missing);setSubmitError('');return;}
        if(!freshDocumentState.terms){setStep(3);setSubmitError('Los términos vigentes no están disponibles. Intenta nuevamente más tarde.');return;}
        const items = await window.ProgramCatalogRepository.listItems();
        const item = items.find((value) => value.program_key === 'prestamo' && value.requestMode === 'supabase');
        if (!item) throw new Error('PROGRAM_NOT_REQUESTABLE');
        const result = simulation.result;
        const request = await window.financialLegacyStore.confirmLoanSession({
          programItemId: item.id,
          programId: simulation.program.id,
          notes: destination.trim(),
          signature,
          terms: accepted,
          idempotencyKey: idempotencyKey.current,
          amount: result.amount,
          term: result.paymentCount,
          termsVersionId: freshDocumentState.terms.id,
          documentIds: freshDocuments.selected.map((document) => document.id),
        });
        setSubmission({folio:request.folio||request.request_id,amount:result.amount});
      } catch (error) {
        const code = error && (error.code || error.message);
        if (code === 'CONDITIONS_CHANGED' || code === 'SNAPSHOT_INVALID') {
          setStep(0); setSimulation(null);
          setSubmitError('Las condiciones de tu simulación cambiaron. Revisa los valores actualizados antes de continuar.');
        } else if (code === 'REQUIRED_DOCUMENTS_MISSING') {
          const refreshed=await loadDocuments();
          const missing=refreshed?resolveLoanDocuments(refreshed.requirements,refreshed.documents).missing:[];
          setDocumentRecovery(missing);
          setSubmitError(missingLoanDocumentsMessage(missing));
        } else {
          setSubmitError('No pudimos enviar tu solicitud. Revisa la información e intenta nuevamente.');
        }
      } finally { setSubmitting(false); }
    };
    if (submission) return React.createElement(Shell, { app, title: 'Listo', onBack: app.back }, React.createElement(Success, { app, folio:submission.folio, amount:submission.amount }));
    return React.createElement(Shell, { app, onBack: goBack },
      React.createElement('div', { 'data-loan-flow-step': step, style: { padding: '4px 20px 12px' } }, React.createElement(window.Stepper, { step, total: 4 }),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 8 } }, steps.map((label, index) => React.createElement('span', { key: label, style: { fontSize: 10.5, fontWeight: 700, color: index <= step ? 'var(--guinda)' : 'var(--ink-3)' } }, label)))),
      React.createElement('div', { ref: scroller, className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: '8px 20px 18px' } },
        React.createElement('h2', { className: 'su-route', style: { fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 14px' } }, titles[step]),
        step === 0 && React.createElement(StepSimulatorV2, { financial, onSimulationChange: setSimulation }),
        step === 1 && React.createElement(StepDestination, { value: destination, onChange: setDestination }),
        step === 2 && React.createElement(StepDocuments,{requirements:documentState.requirements,documents:documentState.documents,onChanged:loadDocuments,phase:documentState.phase,missing:loanDocumentSelection.missing}),
        step === 3 && React.createElement(StepSummary, { simulation, destination, signature, setSignature, accepted, setAccepted,terms:documentState.terms,missingDocuments:documentRecovery,onCorrectDocuments:()=>{setStep(2);setSubmitError('');} })),
      React.createElement('div', { 'data-loan-flow-footer': '', style: { padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--hairline)', background: 'var(--surface)', boxShadow: '0 -8px 24px rgba(20,33,61,.05)' } },
        submitError && React.createElement('div', { role: 'alert', className: 'su-err', 'data-loan-submission-error': '', style: { fontSize: 12, fontWeight: 700, color: '#C0341D', lineHeight: 1.4, marginBottom: 9 } }, submitError),
        React.createElement(window.Btn, { full: true, size: 'lg', loading: submitting, disabled: !canContinue, iconRight: step === 3 ? 'shield' : 'arrowR', onClick: () => step === 3 ? submit() : setStep(step + 1) }, step === 3 ? 'Confirmar solicitud' : (step === 0 && simulation && !simulation.current ? 'Actualizando…' : 'Continuar'))));
  }

  window.StepSimulatorV2 = StepSimulatorV2;
  window.LoanScreen = LoanScreen;
})();
