/* screens-inversion.jsx — H-SUTI-INVERSION-SCREEN-001
   Simulador ilustrativo local aprobado por el propietario. No consulta ni
   escribe autoridades financieras y no crea solicitudes de inversión. */
(function () {
  'use strict';

  const h = React.createElement;
  const I = window.Icon;
  const RATE = 0.025;
  const MIN = 50000;
  const MAX = 2000000;
  const STEP = 10000;
  const PRESETS = [50000, 100000, 250000, 500000, 1000000, 2000000];
  const TERMS = [6, 12, 18, 24];

  const CSS = `
    .su-investment{--inv-guinda:#910022;--inv-guinda-700:#6a001b;--inv-guinda-50:#fbeef1;--inv-coral:#e8364f;--inv-ink:#14213d;--inv-ink-2:#5a6378;--inv-ink-3:#97a0b3;--inv-navy:#14213d;--inv-ok:#13794a;--inv-surface:#fff;--inv-surface-2:#eef1f6;--inv-bg:#f2f3f5;--inv-hairline:#e6eaf1;--inv-shadow-lg:0 24px 56px -18px rgba(20,33,61,.26);--inv-neo-sm:0 6px 16px -8px rgba(20,33,61,.16),0 2px 5px rgba(20,33,61,.05);--inv-neo-md:0 14px 30px -12px rgba(20,33,61,.2),0 4px 10px -2px rgba(20,33,61,.06);--inv-inset:inset 2px 2px 5px rgba(170,182,204,.3),inset -2px -2px 5px rgba(255,255,255,.9);position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:var(--inv-bg);color:var(--inv-ink);font-family:Nunito,system-ui,-apple-system,sans-serif}
    .su-investment *{box-sizing:border-box}
    .su-inv-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;overscroll-behavior:contain}
    .su-inv-scroll::-webkit-scrollbar{width:0;height:0}
    .su-inv-hero{position:relative;overflow:hidden;background:linear-gradient(158deg,var(--inv-guinda) 0%,#6a001b 58%,#3d000d 100%);color:#fff;padding:calc(8px + env(safe-area-inset-top)) 20px 40px}
    .su-inv-seal{position:absolute;right:-60px;bottom:-74px;opacity:.1;pointer-events:none;filter:brightness(0) invert(1)}
    .su-inv-eyebrow{display:flex;align-items:center;gap:4px;position:relative}
    .su-inv-eyebrow>span{font-size:11.5px;font-weight:800;letter-spacing:.11em;opacity:.82}
    .su-inv-back{width:44px;height:44px;margin-left:-10px;border:0;background:transparent;color:#fff;display:grid;place-items:center;border-radius:13px;cursor:pointer}
    .su-inv-hero h1{position:relative;font-size:30px;font-weight:900;letter-spacing:-.032em;line-height:1.08;margin:16px 0 0;text-wrap:pretty}
    .su-inv-lede{position:relative;font-size:13.5px;font-weight:600;opacity:.88;line-height:1.5;margin:9px 0 0;max-width:300px}
    .su-inv-lede strong{font-size:15px}
    .su-inv-rate{position:relative;display:flex;align-items:center;gap:16px;margin-top:22px;padding:16px 18px;border-radius:20px;background:rgba(255,255,255,.13)}
    .su-inv-rate-big{display:flex;align-items:baseline;gap:2px}
    .su-inv-rate-big b{font-size:44px;font-weight:900;letter-spacing:-.04em;line-height:.9;font-variant-numeric:tabular-nums}
    .su-inv-rate-big i{font-style:normal;font-size:22px;font-weight:900;letter-spacing:-.03em}
    .su-inv-rate-label{font-size:10.5px;font-weight:800;letter-spacing:.1em;opacity:.82;margin-top:4px;white-space:nowrap}
    .su-inv-rate-divider{width:1px;align-self:stretch;background:rgba(255,255,255,.24)}
    .su-inv-annual{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:900;letter-spacing:-.01em}
    .su-inv-rate-note{font-size:11.5px;font-weight:600;opacity:.84;line-height:1.4;margin-top:3px}
    .su-inv-facts{position:relative;display:flex;gap:14px;margin-top:16px;flex-wrap:wrap}
    .su-inv-facts span{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;opacity:.9}
    .su-inv-body{padding:0 20px 26px;margin-top:-22px;position:relative}
    .su-inv-card{background:var(--inv-surface);border-radius:22px;padding:16px 16px 18px;box-shadow:var(--inv-shadow-lg)}
    .su-inv-card-head,.su-inv-subhead{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
    .su-inv-card-head b{font-size:15px;font-weight:900;letter-spacing:-.01em}
    .su-inv-card-head span,.su-inv-subhead span{font-size:11.5px;font-weight:800;color:var(--inv-ink-3);letter-spacing:.05em}
    .su-inv-amount,.su-inv-amount-input{display:block;border:0;background:transparent;padding:0;margin:4px 0 8px;font-size:34px;font-weight:900;letter-spacing:-.03em;color:var(--inv-guinda);font-variant-numeric:tabular-nums;width:100%;min-width:0;text-align:left}
    .su-inv-amount{cursor:text}
    .su-inv-amount-input{outline:0;border-bottom:2px solid var(--inv-guinda)}
    .su-inv-slider{position:relative;height:34px;display:flex;align-items:center}
    .su-inv-track,.su-inv-fill{position:absolute;left:0;right:0;height:7px;border-radius:999px;pointer-events:none}
    .su-inv-track{background:var(--inv-surface-2);box-shadow:var(--inv-inset)}
    .su-inv-fill{right:auto;background:linear-gradient(90deg,var(--inv-guinda),var(--inv-coral))}
    .su-inv-range{position:relative;width:100%;height:34px;appearance:none;-webkit-appearance:none;background:transparent;margin:0;cursor:pointer}
    .su-inv-range::-webkit-slider-runnable-track{height:7px;background:transparent}
    .su-inv-range::-moz-range-track{height:7px;background:transparent}
    .su-inv-range::-webkit-slider-thumb{-webkit-appearance:none;width:25px;height:25px;border-radius:50%;background:#fff;border:7px solid var(--inv-guinda);box-shadow:0 4px 12px rgba(20,33,61,.25);margin-top:-9px}
    .su-inv-range::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:7px solid var(--inv-guinda);box-shadow:0 4px 12px rgba(20,33,61,.25)}
    .su-inv-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:5px}
    .su-inv-presets button{min-width:0;border:0;border-radius:11px;padding:7px 2px;background:var(--inv-surface-2);color:var(--inv-ink-2);font-size:11.5px;font-weight:800;cursor:pointer;box-shadow:var(--inv-inset);font-variant-numeric:tabular-nums}
    .su-inv-presets button[aria-pressed=true]{background:var(--inv-guinda-50);color:var(--inv-guinda);box-shadow:inset 0 0 0 1px #f3d6de}
    .su-inv-subhead{margin:20px 0 9px}
    .su-inv-subhead b{font-size:11.5px;font-weight:800;color:var(--inv-ink-2);letter-spacing:.05em;text-transform:uppercase}
    .su-inv-terms{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .su-inv-terms button{padding:9px 0 10px;border-radius:14px;border:0;cursor:pointer;background:var(--inv-surface-2);color:var(--inv-ink-2);box-shadow:var(--inv-inset)}
    .su-inv-terms button[aria-pressed=true]{background:var(--inv-navy);color:#fff;box-shadow:var(--inv-neo-md)}
    .su-inv-terms b{display:block;font-size:16px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
    .su-inv-terms i{display:block;font-style:normal;font-size:10.5px;font-weight:700;opacity:.78;margin-top:1px}
    .su-inv-result{margin-top:18px;border-radius:18px;background:var(--inv-navy);color:#fff;padding:16px 17px 18px;overflow:hidden}
    .su-inv-result-top{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
    .su-inv-k{font-size:10.5px;font-weight:800;letter-spacing:.09em;opacity:.74}
    .su-inv-monthly{font-size:30px;font-weight:900;letter-spacing:-.032em;margin-top:2px;font-variant-numeric:tabular-nums}
    .su-inv-chip{flex-shrink:1;display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:5px 9px;border-radius:999px;background:rgba(28,157,107,.22);color:#5fe0a8;font-size:clamp(10px,2.8vw,12.5px);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
    .su-inv-acum{font-size:10.5px;font-weight:800;letter-spacing:.07em;opacity:.6;margin-top:14px}
    .su-inv-chart{position:relative;overflow:hidden;border-radius:8px;margin-top:14px}
    .su-inv-bars{display:flex;align-items:flex-end;height:82px}
    .su-inv-bar{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;min-width:0}
    .su-inv-bar>i{width:100%;height:100%;border-radius:5px;transform-origin:bottom;background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,.12))}
    .su-inv-bar-last>i{background:linear-gradient(180deg,#ff4d68,#c41230)}
    .su-inv-halo{position:absolute;left:-3px;right:-3px;bottom:0;border-radius:8px;background:radial-gradient(60% 50% at 50% 90%,rgba(232,54,79,.75),rgba(232,54,79,0) 70%);pointer-events:none;transform-origin:bottom}
    .su-inv-sheen{position:absolute;top:0;bottom:0;left:0;width:38%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.22),rgba(255,255,255,0));pointer-events:none}
    .su-inv-axis{display:flex;justify-content:space-between;font-size:10.5px;font-weight:700;opacity:.6;margin-top:6px}
    .su-inv-split{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px;padding-top:13px;border-top:1px solid rgba(255,255,255,.16)}
    .su-inv-split>div{min-width:0;padding-right:8px}
    .su-inv-split>div+div{padding-left:10px;border-left:1px solid rgba(255,255,255,.16)}
    .su-inv-split .su-inv-k{font-size:9.5px;letter-spacing:.04em;text-transform:uppercase}
    .su-inv-v2{font-size:clamp(11px,3.25vw,14.5px);font-weight:900;margin-top:3px;font-variant-numeric:tabular-nums;white-space:nowrap}
    .su-inv-fine{font-size:11px;font-weight:600;color:var(--inv-ink-3);line-height:1.5;margin:11px 0 0}
    .su-inv-section{margin-top:26px}
    .su-inv-section-head{display:flex;align-items:center;gap:9px;margin:0 0 11px;color:var(--inv-guinda)}
    .su-inv-section-head b{font-size:16px;font-weight:900;letter-spacing:-.015em;color:var(--inv-ink)}
    .su-inv-panel{background:var(--inv-surface);border-radius:20px;box-shadow:var(--inv-neo-sm);overflow:hidden}
    .su-inv-steps{padding:17px 17px 18px;display:flex;flex-direction:column;gap:15px}
    .su-inv-step{display:flex;gap:13px;align-items:flex-start}
    .su-inv-step>span{width:30px;height:30px;border-radius:10px;flex-shrink:0;background:var(--inv-guinda-50);color:var(--inv-guinda);display:grid;place-items:center;font-size:14px;font-weight:900;font-family:var(--mono)}
    .su-inv-step b,.su-inv-guarantee b{display:block;font-size:14.5px;font-weight:800}
    .su-inv-step p,.su-inv-guarantee p{font-size:12.5px;font-weight:600;color:var(--inv-ink-2);line-height:1.5;margin:2px 0 0}
    .su-inv-guarantee{display:flex;gap:12px;align-items:flex-start;padding:14px 15px;border-bottom:1px solid var(--inv-hairline)}
    .su-inv-guarantee:last-child{border-bottom:0}
    .su-inv-guarantee>span{width:34px;height:34px;border-radius:11px;flex-shrink:0;background:var(--inv-surface-2);color:var(--inv-guinda);display:grid;place-items:center;box-shadow:var(--inv-inset)}
    .su-inv-legal{display:flex;gap:9px;align-items:flex-start;margin-top:20px;color:var(--inv-ink-2)}
    .su-inv-legal svg{flex-shrink:0;margin-top:1px}
    .su-inv-legal p{font-size:12px;font-weight:600;line-height:1.55;margin:0}
    .su-inv-footer{flex-shrink:0;padding:12px 20px calc(12px + env(safe-area-inset-bottom));background:var(--inv-surface);border-top:1px solid var(--inv-hairline);box-shadow:0 -8px 24px rgba(20,33,61,.06)}
    .su-inv-footer-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}
    .su-inv-footer-row span{font-size:12.5px;font-weight:700;color:var(--inv-ink-2)}
    .su-inv-footer-row b{font-size:13.5px;font-weight:900;color:var(--inv-ok);font-variant-numeric:tabular-nums}
    .su-inv-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;height:56px;border:0;border-radius:18px;cursor:pointer;background:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);color:#fff;font-size:16.5px;font-weight:900;letter-spacing:-.01em;box-shadow:0 10px 26px -6px rgba(209,31,58,.55),0 4px 10px -2px rgba(145,0,34,.4)}
    .su-investment button:focus-visible,.su-investment input:focus-visible{outline:2px solid var(--inv-guinda);outline-offset:2px}
    @media(max-width:400px){.su-inv-hero{padding-left:16px;padding-right:16px}.su-inv-body,.su-inv-footer{padding-left:16px;padding-right:16px}.su-inv-rate{gap:12px;padding-left:14px;padding-right:14px}.su-inv-chip svg{display:none}.su-inv-split>div+div{padding-left:7px}.su-inv-split>div{padding-right:5px}}
  `;

  function money(value) {
    return '$' + Math.round(value).toLocaleString('en-US');
  }

  function icon(name, size) {
    return h(I, { name, size: size || 18, stroke: 2, 'aria-hidden': 'true' });
  }

  function InvestmentScreen({ app }) {
    const [amount, setAmount] = React.useState(250000);
    const [months, setMonths] = React.useState(12);
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState('250000');
    const barsRef = React.useRef([]);
    const haloRef = React.useRef(null);
    const sheenRef = React.useRef(null);
    const inputRef = React.useRef(null);
    const monthlyReturn = amount * RATE;
    const totalReturn = monthlyReturn * months;
    const fill = ((amount - MIN) / (MAX - MIN)) * 100;

    React.useEffect(() => {
      if (!editing || !inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.select();
    }, [editing]);

    React.useEffect(() => {
      const M = window.MOTION;
      const animations = [];
      barsRef.current.slice(0, months).forEach((bar, index) => {
        if (!bar) return;
        const scale = months === 1 ? 1 : 0.28 + (0.72 * index / (months - 1));
        bar.style.transform = 'scaleY(' + scale.toFixed(4) + ')';
        if (M && !M.reduced() && !M.frozen()) {
          const animation = M.animate(bar, [{ transform: 'scaleY(0)' }, { transform: bar.style.transform }], { duration: M.dur.emphasized, easing: M.ease.enter, fill: 'both', delay: Math.min(index, M.stagger.max) * M.stagger.step });
          if (animation) animations.push(animation);
        }
      });
      if (M && !M.reduced() && !M.frozen()) {
        const halo = M.animate(haloRef.current, [{ transform: 'scale(1)', opacity: .45 }, { transform: 'scale(1.14)', opacity: .95 }, { transform: 'scale(1)', opacity: .45 }], { duration: M.dur.spatial * 5, easing: M.ease.standard, iterations: Infinity });
        const sheen = M.animate(sheenRef.current, [{ transform: 'translateX(-120%)' }, { transform: 'translateX(330%)' }], { duration: M.dur.spatial * 7.5, easing: M.ease.standard, iterations: Infinity });
        if (halo) animations.push(halo);
        if (sheen) animations.push(sheen);
      } else {
        if (haloRef.current) { haloRef.current.style.transform = 'scale(1)'; haloRef.current.style.opacity = '.65'; }
        if (sheenRef.current) sheenRef.current.style.opacity = '0';
      }
      return () => animations.forEach((animation) => { try { animation.cancel(); } catch (_) {} });
    }, [amount, months]);

    function finishEditing() {
      const raw = Number(String(draft).replace(/[^\d]/g, ''));
      if (raw) {
        const rounded = Math.round(raw / STEP) * STEP;
        const next = Math.min(MAX, Math.max(MIN, rounded));
        setAmount(next);
        setDraft(String(next));
      } else {
        setDraft(String(amount));
      }
      setEditing(false);
    }

    function changeDraft(event) {
      const raw = event.target.value.replace(/[^\d]/g, '');
      setDraft(raw);
      const value = Number(raw);
      if (value >= MIN && value <= MAX) setAmount(value);
    }

    function chooseAmount(value) {
      setAmount(value);
      setDraft(String(value));
    }

    const barGap = months > 14 ? 3 : 5;
    const bars = Array.from({ length: months }, (_, index) => {
      const scale = months === 1 ? 1 : 0.28 + (0.72 * index / (months - 1));
      const last = index === months - 1;
      return h('div', { className: 'su-inv-bar' + (last ? ' su-inv-bar-last' : ''), key: index },
        last && h('div', { ref: haloRef, className: 'su-inv-halo', style: { height: (scale * 100).toFixed(2) + '%' } }),
        h('i', { ref: (node) => { barsRef.current[index] = node; }, style: { transform: 'scaleY(' + scale.toFixed(4) + ')' } }));
    });

    const steps = [
      ['Eliges monto y plazo', 'Desde $50,000, a 6, 12, 18 o 24 meses. Firmas el contrato con tu firma digital.'],
      ['El fondo lo presta a afiliados', 'Tu dinero financia préstamos de nómina del propio sindicato, con descuento garantizado.'],
      ['Cobras el 2.5% cada mes', 'Se deposita en tu cuenta bancaria registrada el día 5 de cada mes, todos los meses del plazo.'],
    ];
    const guarantees = [
      ['shield', 'Respaldado por el patrimonio del SUTI', 'El fondo responde con reservas propias; no se invierte en bolsa ni en instrumentos de riesgo.'],
      ['users', 'Auditado por el Comité de Vigilancia', 'Revisión mensual y asamblea informativa cada semestre, abierta a todos los afiliados.'],
      ['doc', 'Tu capital regresa completo', 'Los rendimientos ya se te pagaron mes a mes: al cerrar el plazo (mínimo 6 meses) recibes íntegro el capital, o lo renuevas.'],
    ];

    return h('div', { className: 'su-investment', 'data-investment-screen': '', 'data-investment-authority': 'presentation-only' },
      h('style', null, CSS),
      h('div', { className: 'su-inv-scroll', 'data-investment-scroll': '' },
        h('header', { className: 'su-inv-hero' },
          h('div', { className: 'su-inv-seal', 'aria-hidden': 'true' }, window.SutiSeal && h(window.SutiSeal, { size: 250, mono: true })),
          h('div', { className: 'su-inv-eyebrow' },
            h('button', { type: 'button', className: 'su-inv-back', onClick: app.back, 'aria-label': 'Atrás', 'data-investment-back': '' }, icon('arrowL', 22)),
            h('span', null, 'SUTI INVERSIÓN')),
          h('h1', null, 'Tu dinero rinde 2.5% mensual'),
          h('p', { className: 'su-inv-lede' }, h('strong', null, 'Haz que tu dinero trabaje para ti.'), h('br'), 'Tu inversión ayuda a financiar préstamos para otros afiliados, mientras tú recibes rendimientos.'),
          h('div', { className: 'su-inv-rate' },
            h('div', null, h('div', { className: 'su-inv-rate-big' }, h('b', null, '2.5'), h('i', null, '%')), h('div', { className: 'su-inv-rate-label' }, 'MENSUAL FIJO')),
            h('div', { className: 'su-inv-rate-divider' }),
            h('div', null, h('div', { className: 'su-inv-annual' }, icon('finance', 17), '30% anual'), h('div', { className: 'su-inv-rate-note' }, 'Tasa fija: 2.5% del capital cada mes, sin interés compuesto'))),
          h('div', { className: 'su-inv-facts' },
            h('span', null, icon('cash', 15), 'Desde $50,000'),
            h('span', null, icon('refresh', 15), 'Plazo mínimo 6 meses'),
            h('span', null, icon('ban', 15), 'Cero comisiones'))),
        h('main', { className: 'su-inv-body' },
          h('section', { className: 'su-inv-card', 'aria-labelledby': 'investment-calculator-title' },
            h('div', { className: 'su-inv-card-head' }, h('b', { id: 'investment-calculator-title' }, 'Calcula tu rendimiento'), h('span', null, 'MONTO')),
            editing
              ? h('input', { ref: inputRef, className: 'su-inv-amount-input', value: draft, inputMode: 'numeric', 'aria-label': 'Monto a invertir', onChange: changeDraft, onBlur: finishEditing, onKeyDown: (event) => { if (event.key === 'Enter') finishEditing(); if (event.key === 'Escape') { setDraft(String(amount)); setEditing(false); } } })
              : h('button', { type: 'button', className: 'su-inv-amount', onClick: () => { setDraft(String(amount)); setEditing(true); }, 'aria-label': 'Editar monto', 'data-investment-amount': String(amount) }, money(amount)),
            h('div', { className: 'su-inv-slider' },
              h('div', { className: 'su-inv-track' }),
              h('div', { className: 'su-inv-fill', style: { width: fill + '%' } }),
              h('input', { className: 'su-inv-range', type: 'range', min: MIN, max: MAX, step: STEP, value: amount, 'aria-label': 'Monto a invertir', onChange: (event) => chooseAmount(Number(event.target.value)), 'data-investment-slider': '' })),
            h('div', { className: 'su-inv-presets', 'data-investment-presets': '' }, PRESETS.map((value) => h('button', { type: 'button', key: value, 'aria-pressed': amount === value, onClick: () => chooseAmount(value), 'data-amount': String(value) }, money(value)))),
            h('div', { className: 'su-inv-subhead' }, h('b', null, 'Plazo'), h('span', null, 'Mínimo 6 meses · renovable')),
            h('div', { className: 'su-inv-terms', 'data-investment-terms': '' }, TERMS.map((term) => h('button', { type: 'button', key: term, 'aria-pressed': months === term, onClick: () => setMonths(term), 'data-months': String(term) }, h('b', null, term), h('i', null, 'meses')))),
            h('div', { className: 'su-inv-result' },
              h('div', { className: 'su-inv-result-top' },
                h('div', null, h('div', { className: 'su-inv-k' }, 'RECIBES CADA MES'), h('div', { className: 'su-inv-monthly', 'data-investment-monthly': String(monthlyReturn) }, money(monthlyReturn))),
                h('span', { className: 'su-inv-chip' }, icon('finance', 14), '+' + money(totalReturn) + ' en ' + months + ' meses')),
              h('div', { className: 'su-inv-acum' }, 'RENDIMIENTO ACUMULADO'),
              h('div', { className: 'su-inv-chart', 'aria-label': 'Rendimiento acumulado durante ' + months + ' meses', role: 'img', 'data-investment-chart-bars': String(months) }, h('div', { className: 'su-inv-bars', style: { gap: barGap } }, bars), h('div', { ref: sheenRef, className: 'su-inv-sheen' })),
              h('div', { className: 'su-inv-axis' }, h('span', null, 'mes 1'), h('span', null, 'mes ' + months)),
              h('div', { className: 'su-inv-split' },
                h('div', null, h('div', { className: 'su-inv-k' }, 'Inviertes'), h('div', { className: 'su-inv-v2', 'data-investment-principal': String(amount) }, money(amount))),
                h('div', null, h('div', { className: 'su-inv-k' }, 'Rendimiento total'), h('div', { className: 'su-inv-v2', 'data-investment-total': String(totalReturn) }, money(totalReturn))),
                h('div', null, h('div', { className: 'su-inv-k' }, 'Capital al final'), h('div', { className: 'su-inv-v2', 'data-investment-final': String(amount) }, money(amount)))),
            h('p', { className: 'su-inv-fine' }, 'El 2.5% es fijo sobre tu capital: no hay interés compuesto. Cada mes se te deposita el rendimiento y al terminar el plazo recibes tu capital completo.'))),
          h('section', { className: 'su-inv-section' },
            h('div', { className: 'su-inv-section-head' }, icon('info', 18), h('b', null, 'Cómo funciona')),
            h('div', { className: 'su-inv-panel su-inv-steps' }, steps.map((step, index) => h('div', { className: 'su-inv-step', key: step[0] }, h('span', null, index + 1), h('div', null, h('b', null, step[0]), h('p', null, step[1])))))),
          h('section', { className: 'su-inv-section' },
            h('div', { className: 'su-inv-section-head' }, icon('shield', 18), h('b', null, 'Tu respaldo')),
            h('div', { className: 'su-inv-panel' }, guarantees.map((item) => h('div', { className: 'su-inv-guarantee', key: item[1] }, h('span', null, icon(item[0], 18)), h('div', null, h('b', null, item[1]), h('p', null, item[2])))))),
          h('div', { className: 'su-inv-legal' }, icon('info', 16), h('p', null, 'Producto exclusivo para afiliados con antigüedad mínima de un año. Los rendimientos pasados no garantizan rendimientos futuros.')))),
      h('footer', { className: 'su-inv-footer' },
        h('div', { className: 'su-inv-footer-row' }, h('span', null, months + ' meses · 2.5% mensual fijo'), h('b', { 'data-investment-footer-return': String(totalReturn) }, '+' + money(totalReturn))),
        h('button', { type: 'button', className: 'su-inv-cta', onClick: () => app.toast && app.toast('Simulación informativa · inversión no enviada'), 'data-investment-cta': '', 'aria-label': 'Invertir ' + money(amount) + ', simulación informativa' }, icon('finance', 21), h('span', null, 'Invertir ' + money(amount)))));
  }

  window.InvestmentScreen = InvestmentScreen;
  window.SUTI_INVESTMENT_SIMULATION = Object.freeze({ RATE, MIN, MAX, STEP, PRESETS: PRESETS.slice(), TERMS: TERMS.slice(), calculate: (amount, months) => ({ monthlyReturn: amount * RATE, totalReturn: amount * RATE * months, finalCapital: amount }) });
})();
