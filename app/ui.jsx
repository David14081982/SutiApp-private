/* ui.jsx — SutiApp shared UI primitives. Exports to window.
   Tokens live as CSS vars in the host HTML (:root). */
(function () {
  const Icon = window.Icon;

  // ---------- Card ----------
  // C3 · una card CLICABLE es un objeto manipulable: recibe press sutil y su
  // sombra se interpola. Una card informativa no recibe nada.
  function Card({ children, style, className = '', pad = 18, onClick, elevated = false, ...rest }) {
    return React.createElement('div', {
      onClick, className: 'su-card ' + (onClick ? 'su-card-i ' : '') + className,
      'data-press': onClick ? 'subtle' : undefined,
      style: {
        background: 'var(--surface)', borderRadius: 'var(--r-card)', padding: pad,
        boxShadow: elevated ? 'var(--neo-md)' : 'var(--neo-sm)',
        ...(onClick ? { cursor: 'pointer' } : {}), ...style,
      }, ...rest,
    }, children);
  }

  // ---------- Button ----------
  // C2 · Button motion system. El press lo aporta Pressable (delegación global);
  // aquí solo se declara la INTENSIDAD por variante y los estados propios del
  // botón (loading / success / disabled), que viven dentro del mismo objeto
  // visual en vez de sustituirlo por otro componente.
  const BTN_PRESS = { primary: 'standard', gold: 'standard', dark: 'standard', danger: 'standard', secondary: 'subtle', outline: 'subtle', ghost: 'subtle' };
  function Btn({ children, variant = 'primary', size = 'md', icon, iconRight, full, style, onClick, disabled, loading, success, ...rest }) {
    const sizes = {
      sm: { h: 38, px: 14, fs: 14, gap: 7, r: 12 },
      md: { h: 50, px: 18, fs: 15.5, gap: 9, r: 15 },
      lg: { h: 58, px: 22, fs: 17, gap: 10, r: 17 },
    }[size];
    const variants = {
      primary: { background: 'var(--grad-guinda-soft)', color: '#fff', border: 'none', boxShadow: 'var(--glow-guinda)' },
      gold: { background: 'linear-gradient(135deg,#C8922F,#9A6B16)', color: '#fff', border: 'none', boxShadow: '0 10px 24px -8px rgba(154,107,22,.55)' },
      secondary: { background: 'var(--surface)', color: 'var(--guinda)', border: 'none', boxShadow: 'var(--neo-sm)' },
      outline: { background: 'var(--surface)', color: 'var(--ink)', border: 'none', boxShadow: 'var(--neo-sm)' },
      ghost: { background: 'transparent', color: 'var(--guinda)', border: 'none' },
      dark: { background: 'var(--navy)', color: '#fff', border: 'none', boxShadow: '0 10px 24px -8px rgba(20,33,61,.5)' },
      danger: { background: 'linear-gradient(135deg,#C0341D,#8E2415)', color: '#fff', border: 'none', boxShadow: '0 10px 24px -8px rgba(192,52,29,.5)' },
    }[variant];
    const busy = !!loading || !!success;
    const inert = !!disabled;
    return React.createElement('button', {
      onClick: busy ? undefined : onClick, disabled: inert || busy, className: 'su-btn',
      'data-press': inert || busy ? 'none' : (BTN_PRESS[variant] || 'standard'),
      'aria-busy': loading ? 'true' : undefined,
      style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: sizes.r,
        fontSize: sizes.fs, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.01em',
        width: full ? '100%' : 'auto', cursor: inert ? 'not-allowed' : busy ? 'progress' : 'pointer',
        opacity: inert ? 0.45 : 1, filter: inert ? 'saturate(.55)' : 'none',
        transition: 'transform .16s cubic-bezier(.2,.7,.3,1), box-shadow .2s, filter .2s, opacity .2s',
        whiteSpace: 'nowrap', position: 'relative', overflow: 'hidden',
        ...variants, ...(inert ? { boxShadow: 'none' } : null), ...style,
      }, ...rest,
    },
      // loading / success ocupan el mismo objeto: el botón no desaparece.
      busy && React.createElement('span', { className: 'su-btn-state', style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' } },
        success
          ? React.createElement(Icon, { name: 'check', size: sizes.fs + 5, stroke: 2.6, className: 'su-check' })
          : React.createElement('span', { className: 'su-btn-spin', style: { width: sizes.fs + 2, height: sizes.fs + 2, borderRadius: '50%', border: '2.5px solid currentColor', borderTopColor: 'transparent', display: 'block' } })),
      React.createElement(React.Fragment, null,
        icon && React.createElement(Icon, { name: icon, size: sizes.fs + 4, stroke: 2, className: 'su-btn-ico' }),
        React.createElement('span', { style: { opacity: busy ? 0 : 1, transition: 'opacity .16s' } }, children),
        iconRight && React.createElement(Icon, { name: iconRight, size: sizes.fs + 3, stroke: 2, className: 'su-btn-ico-r' })),
    );
  }

  // ---------- Pill / Chip ----------
  // C2 · sin `transition: all` (prohibido): propiedades explícitas.
  function Pill({ children, tone = 'neutral', icon, active, onClick, style }) {
    const tones = {
      neutral: { bg: 'var(--surface)', fg: 'var(--ink-2)', sh: 'var(--neo-sm)' },
      guinda: { bg: 'var(--guinda-50)', fg: 'var(--guinda)', sh: 'none' },
      green: { bg: '#E7F6ED', fg: '#13794A', sh: 'none' },
      amber: { bg: '#FFF3DC', fg: '#9A6B16', sh: 'none' },
      blue: { bg: '#E8F0FE', fg: '#2456C7', sh: 'none' },
      red: { bg: '#FDEAEA', fg: '#C0341D', sh: 'none' },
    }[tone];
    const a = active ? { bg: 'var(--grad-guinda-soft)', fg: '#fff', sh: 'var(--glow-guinda)' } : tones;
    return React.createElement('button', {
      onClick, style: {
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px',
        borderRadius: 999, background: a.bg, color: a.fg, border: 'none', boxShadow: a.sh,
        fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap', transition: 'background .22s cubic-bezier(.2,.7,.3,1), color .22s, box-shadow .22s', ...style,
      },
    }, icon && React.createElement(Icon, { name: icon, size: 15, stroke: 2 }), children);
  }

  // ---------- useBtnConfirm (C6) ----------
  // Confirmación dentro del MISMO botón: palomita ~480 ms y luego la acción
  // real (cerrar, navegar). Los stores son síncronos: esto NO finge carga, solo
  // acusa recibo. Con reduced()/frozen() ejecuta de inmediato.
  function useBtnConfirm(ms) {
    const [success, setSuccess] = React.useState(false);
    const t = React.useRef(null);
    React.useEffect(() => () => clearTimeout(t.current), []);
    const run = (fn) => {
      const M = window.MOTION;
      if (!M || M.reduced() || M.frozen()) { if (fn) fn(); return; }
      setSuccess(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => { setSuccess(false); if (fn) fn(); }, ms || 480);
    };
    return [success, run];
  }

  // ---------- ChipBar (C5.2) ----------
  // Un SOLO indicador deslizante para toda la fila de chips: se mide tras el
  // commit y viaja con transform (translateX + scaleX contra el chip más ancho,
  // con radio horizontal compensado para que la píldora no se deforme). Los
  // chips solo interpolan color. Centra el chip activo con scrollTo (nunca
  // scrollIntoView). Con reduced()/frozen() salta sin animar.
  function ChipBar({ items, value, onChange, style }) {
    const list = (items || []).map((it) => (typeof it === 'string' ? { id: it, label: it } : it));
    const scRef = React.useRef(null);
    const rowRef = React.useRef(null);
    const indRef = React.useRef(null);
    const chipRefs = React.useRef({});
    const prev = React.useRef(null);
    React.useLayoutEffect(() => {
      const ind = indRef.current, row = rowRef.current, el = chipRefs.current[value];
      if (!ind || !row || !el) return;
      const M = window.MOTION;
      let base = 0;
      Object.keys(chipRefs.current).forEach((k) => { const c = chipRefs.current[k]; if (c) base = Math.max(base, c.offsetWidth); });
      if (!base) return;
      ind.style.width = base + 'px';
      const s = el.offsetWidth / base;
      const to = { transform: `translateX(${el.offsetLeft}px) scaleX(${s})`, borderRadius: `${19 / s}px / 19px` };
      const from = prev.current;
      prev.current = to;
      ind.style.opacity = '1';
      if (!from || !M || M.reduced() || M.frozen()) { ind.style.transform = to.transform; ind.style.borderRadius = to.borderRadius; return; }
      ind.style.transform = to.transform; ind.style.borderRadius = to.borderRadius;
      M.animate(ind, [from, to], { duration: M.dur.emphasized, easing: M.ease.emphasized, fill: 'none' });
    }, [value, list.map((i) => i.id).join(',')]);
    React.useEffect(() => {
      const sc = scRef.current, el = chipRefs.current[value];
      if (!sc || !el) return;
      const M = window.MOTION;
      sc.scrollTo({ left: Math.max(0, el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2), behavior: (M && (M.reduced() || M.frozen())) ? 'auto' : 'smooth' });
    }, [value]);
    return React.createElement('div', { ref: scRef, style: { overflowX: 'auto', scrollbarWidth: 'none', ...style } },
      React.createElement('div', { ref: rowRef, style: { position: 'relative', display: 'inline-flex', gap: 9 } },
        React.createElement('div', { ref: indRef, 'aria-hidden': 'true', style: { position: 'absolute', left: 0, top: 0, height: 38, width: 1, opacity: 0, transformOrigin: 'left center', borderRadius: 999, background: 'var(--grad-guinda-soft)', boxShadow: 'var(--glow-guinda)', pointerEvents: 'none' } }),
        list.map((it) => {
          const on = it.id === value;
          return React.createElement('button', {
            key: it.id, ref: (el) => { chipRefs.current[it.id] = el; },
            onClick: () => onChange && onChange(it.id),
            style: {
              position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px',
              borderRadius: 999, border: 'none', background: on ? 'transparent' : 'var(--surface)', boxShadow: on ? 'none' : 'var(--neo-sm)',
              color: on ? '#fff' : 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s',
            },
          }, it.icon && React.createElement(Icon, { name: it.icon, size: 15, stroke: 2 }), it.label);
        })));
  }

  // ---------- Badge (small status) ----------
  function Badge({ children, tone = 'guinda', solid, icon, style }) {
    const map = {
      guinda: ['var(--guinda)', 'var(--guinda-50)', 'var(--guinda)'],
      green: ['#13794A', '#E7F6ED', '#13794A'],
      amber: ['#9A6B16', '#FFF3DC', '#9A6B16'],
      blue: ['#2456C7', '#E8F0FE', '#2456C7'],
      red: ['#C0341D', '#FDEAEA', '#C0341D'],
      gold: ['linear-gradient(135deg,#C8922F,#9A6B16)', '#fbf2dd', '#9A6B16'],
    }[tone];
    return React.createElement('span', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
        fontSize: 11.5, fontWeight: 800, letterSpacing: '.02em', lineHeight: 1,
        background: solid ? map[0] : map[1], color: solid ? '#fff' : map[2], ...style,
      },
    }, icon && React.createElement(Icon, { name: icon, size: 12, stroke: 2.4 }), children);
  }

  // ---------- IconTile (category square) ----------
  function IconTile({ icon, color = 'var(--guinda)', bg, size = 52, radius, soft = true, glow = false, className = '' }) {
    const r = radius != null ? radius : Math.round(size * 0.32);
    if (glow) {
      return React.createElement('div', {
        className: ('su-tile ' + className).trim(),
        style: {
          width: size, height: size, borderRadius: r, flexShrink: 0,
          display: 'grid', placeItems: 'center', position: 'relative',
          background: 'var(--grad-icon, linear-gradient(145deg, #ef5054, #E43135 55%, #c21f29))', color: '#fff',
          boxShadow: 'var(--glow-icon, 0 10px 26px -6px rgba(228,49,53,.55), 0 4px 10px -2px rgba(228,49,53,.4))',
        },
      },
        React.createElement('div', { style: { position: 'absolute', inset: 0, borderRadius: r, background: 'linear-gradient(150deg,rgba(255,255,255,.32),transparent 55%)' } }),
        React.createElement(Icon, { name: icon, size: size * 0.46, stroke: 2, style: { position: 'relative' } }),
      );
    }
    return React.createElement('div', {
      className: ('su-tile ' + className).trim(),
      style: {
        width: size, height: size, borderRadius: r, flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: bg || (soft ? 'var(--surface)' : color),
        color: soft ? color : '#fff',
        boxShadow: soft && !bg ? 'var(--neo-sm)' : 'none',
      },
    }, React.createElement(Icon, { name: icon, size: size * 0.46, stroke: 1.9 }));
  }
  function colorTint(c) {
    // map known vars to tints
    const m = {
      'var(--guinda)': 'var(--guinda-50)',
    };
    if (m[c]) return m[c];
    if (c.startsWith('#')) return c + '1f';
    return 'var(--surface-2)';
  }

  // ---------- SectionHead ----------
  function SectionHead({ title, action, onAction, icon, style }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px', ...style } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        icon && React.createElement(Icon, { name: icon, size: 18, stroke: 2, style: { color: 'var(--guinda)' } }),
        React.createElement('h3', { style: { fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--ink)', margin: 0 } }, title),
      ),
      action && React.createElement('button', { onClick: onAction, style: { display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--guinda)', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' } },
        action, React.createElement(Icon, { name: 'chevR', size: 15, stroke: 2.4 })),
    );
  }

  // ---------- ProgressBar ----------
  function ProgressBar({ value, max = 100, height = 8, tone = 'var(--guinda)', track = 'var(--surface-2)' }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return React.createElement('div', { style: { height, background: track, borderRadius: 999, overflow: 'hidden' } },
      React.createElement('div', { style: { width: pct + '%', height: '100%', background: tone, borderRadius: 999, transition: 'width .6s cubic-bezier(.4,0,.2,1)' } }),
    );
  }

  // ---------- Stepper (dots) ----------
  function Stepper({ step, total, labels }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
      Array.from({ length: total }).map((_, i) =>
        React.createElement('div', {
          key: i, style: {
            flex: 1, height: 5, borderRadius: 999,
            background: i <= step ? 'var(--guinda)' : 'var(--surface-2)',
            transition: 'background .3s',
          },
        })),
    );
  }

  // ---------- Timeline (vertical, card-wrapped) ----------
  function Timeline({ steps, activeNote, card = true }) {
    const inner = React.createElement('div', {
      style: card ? { position: 'relative', background: 'var(--surface)', borderRadius: 20, padding: '20px 18px 6px', boxShadow: 'var(--neo-md)' } : { position: 'relative', paddingLeft: 2 },
    }, steps.map((st, i) => {
      const last = i === steps.length - 1;
      return React.createElement('div', { key: i, style: { display: 'flex', gap: 15, position: 'relative', paddingBottom: last ? 14 : 24 } },
        !last && React.createElement('div', { style: { position: 'absolute', left: 15, top: 32, bottom: 4, width: 3, borderRadius: 999, background: st.done ? 'var(--grad-guinda-soft)' : 'var(--hairline)' } }),
        React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: st.done ? 'var(--grad-guinda-soft)' : st.active ? 'var(--surface)' : 'var(--surface-2)', color: st.done ? '#fff' : st.active ? 'var(--guinda)' : 'var(--ink-3)', boxShadow: st.done ? 'var(--glow-guinda)' : st.active ? '0 0 0 4px var(--guinda-50), var(--neo-sm)' : 'none', border: st.active ? '2px solid var(--guinda)' : 'none', zIndex: 1 } },
          st.done ? React.createElement(Icon, { name: 'check', size: 17, stroke: 3 }) : st.active ? React.createElement('div', { style: { width: 9, height: 9, borderRadius: '50%', background: 'var(--guinda)' } }) : React.createElement('div', { style: { width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-3)' } })),
        React.createElement('div', { style: { flex: 1, paddingTop: 4 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('span', { style: { fontSize: 14.5, fontWeight: st.done || st.active ? 800 : 600, color: st.done || st.active ? 'var(--ink)' : 'var(--ink-3)' } }, st.label),
            st.active && React.createElement('span', { style: { fontSize: 10, fontWeight: 800, letterSpacing: '.04em', color: 'var(--guinda)', background: 'var(--guinda-50)', padding: '3px 8px', borderRadius: 999 } }, 'EN CURSO')),
          st.desc && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.45, marginTop: 3, textWrap: 'pretty' } }, st.desc),
          (st.date || st.responsable) && React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 4 } }, [st.date, st.responsable && ('Responsable: ' + st.responsable)].filter(Boolean).join(' · ')),
          st.active && activeNote && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 9, background: 'var(--surface-2)', borderRadius: 13, padding: '11px 13px', lineHeight: 1.5, boxShadow: 'var(--neo-inset)' } }, activeNote)));
    }));
    return inner;
  }

  // ---------- SearchBar ----------
  // C4 · el buscador se comporta como un modo: al enfocar se eleva y el icono
  // responde. Sin cambiar su estructura ni su UX funcional.
  function SearchBar({ placeholder = 'Buscar', value, onChange, onFilter, style }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, ...style } },
      React.createElement('div', {
        className: 'su-search',
        style: { flex: 1, display: 'flex', alignItems: 'center', gap: 11, height: 52, padding: '0 18px', background: 'var(--surface-2)', borderRadius: 16, boxShadow: 'var(--neo-inset)' },
      },
        React.createElement(Icon, { name: 'search', size: 20, stroke: 2.1, className: 'su-search-ico', style: { color: 'var(--guinda)' } }),
        React.createElement('input', {
          value, onChange: onChange ? (e) => onChange(e.target.value) : undefined, placeholder,
          style: { flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)' },
        }),
      ),
      onFilter && React.createElement('button', { onClick: onFilter, style: { width: 52, height: 52, borderRadius: 16, background: 'var(--grad-guinda-soft)', border: 'none', display: 'grid', placeItems: 'center', color: '#fff', cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
        React.createElement(Icon, { name: 'filter', size: 20, stroke: 2 })),
    );
  }

  // ---------- Sheet (bottom modal) ----------
  function Sheet({ open, onClose, children, title, height = 'auto' }) {
    const [mounted, setMounted] = React.useState(open);
    React.useEffect(() => { if (open) setMounted(true); }, [open]);
    // Drag-to-dismiss (M3): seguimiento 1:1 del dedo, decisión por distancia o
    // velocidad. Solo arranca con el panel arriba del todo, para no robarle el
    // scroll al contenido.
    const panelRef = React.useRef(null);
    const drag = React.useRef(null);
    const onDown = (e) => {
      const p = panelRef.current;
      if (!p || p.scrollTop > 0 || e.button === 2) return;
      drag.current = { id: e.pointerId, y: e.clientY, dy: 0, t: Date.now(), active: false };
    };
    const onMove = (e) => {
      const d = drag.current, p = panelRef.current;
      if (!d || !p || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y;
      if (!d.active) {
        if (dy < 6) return;
        d.active = true;
        p.style.transition = 'none';
        try { p.setPointerCapture(d.id); } catch (err) { /* no-op */ }
      }
      d.dy = Math.max(0, dy);
      p.style.transform = 'translateY(' + d.dy + 'px)';
    };
    const onUp = () => {
      const d = drag.current, p = panelRef.current;
      drag.current = null;
      if (!d || !p || !d.active) return;
      p.style.transition = '';
      p.style.transform = '';
      const v = d.dy / Math.max(1, Date.now() - d.t);
      if (d.dy > p.offsetHeight * 0.28 || v > 0.55) onClose && onClose();
    };
    if (!mounted && !open) return null;
    return React.createElement('div', {
      onClick: onClose,
      style: {
        position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
        background: open ? 'rgba(20,8,12,.42)' : 'rgba(20,8,12,0)', transition: 'background .28s',
        backdropFilter: 'blur(2px)',
      },
      onTransitionEnd: () => { if (!open) setMounted(false); },
    },
      React.createElement('div', {
        ref: panelRef,
        onClick: (e) => e.stopPropagation(),
        onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
        style: {
          width: '100%', background: 'var(--surface)', borderRadius: '26px 26px 0 0',
          padding: '10px 20px calc(20px + env(safe-area-inset-bottom))', maxHeight: '88%', overflowY: 'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .32s cubic-bezier(.32,.72,0,1)',
          boxShadow: '0 -16px 48px -12px rgba(20,8,12,.3)', touchAction: 'pan-y', willChange: 'transform',
        },
      },
        React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '6px auto 14px' } }),
        title && React.createElement('h3', { style: { fontSize: 19, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-.01em' } }, title),
        children,
      ),
    );
  }

  // ---------- EmptyState ----------
  function EmptyState({ icon = 'receipt', title, sub, action }) {
    return React.createElement('div', { style: { textAlign: 'center', padding: '40px 24px' } },
      React.createElement('div', { style: { width: 72, height: 72, borderRadius: 22, background: 'var(--guinda-50)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'var(--guinda)' } },
        React.createElement(Icon, { name: icon, size: 32, stroke: 1.7 })),
      React.createElement('div', { style: { fontWeight: 800, fontSize: 17, color: 'var(--ink)' } }, title),
      sub && React.createElement('div', { style: { fontSize: 14, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 } }, sub),
      action && React.createElement('div', { style: { marginTop: 18 } }, action),
    );
  }

  // ---------- Avatar ----------
  function Avatar({ name = '', size = 44, src, tone = 'var(--guinda)', loading, ...rest }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);
    const initials = name.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    const showPhoto = Boolean(src && !failed);
    return React.createElement('div', {
      ...rest,
      'data-avatar-photo-state': showPhoto ? 'photo' : 'initials',
      style: {
        width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        backgroundColor: 'var(--guinda-50)',
        position: 'relative',
        color: tone, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.36,
        border: '1px solid var(--hairline)',
      },
    },
    showPhoto && React.createElement('img', {
      src, alt: '', loading, decoding: 'async', onError: () => setFailed(true),
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' },
    }),
    !showPhoto && initials);
  }

  // ---------- Toggle (único del sistema · M5) ----------
  // Sustituye las 22 copias duplicadas de los paneles. El thumb viaja con
  // transform (nunca con `left`), la curva y la duración son únicas y el press
  // comprime el thumb. Sin onClick renderiza un div (la fila padre es la que
  // recibe el clic).
  const TOGGLE_SIZES = { sm: [40, 24, 18, '0 1px 3px rgba(0,0,0,.3)'], md: [42, 25, 19, '0 2px 4px rgba(0,0,0,.25)'], lg: [44, 26, 20, '0 2px 4px rgba(0,0,0,.25)'], xl: [46, 28, 22, '0 2px 5px rgba(0,0,0,.25)'] };
  function Toggle({ on, onClick, disabled, size = 'md', glow = true, style, ...rest }) {
    const [w, h, th, sh] = TOGGLE_SIZES[size] || TOGGLE_SIZES.md;
    const [press, setPress] = React.useState(false);
    const tag = onClick ? 'button' : 'div';
    const props = Object.assign({}, rest, {
      style: {
        width: w, height: h, borderRadius: 999, border: 'none', padding: 0, flexShrink: 0, position: 'relative',
        cursor: onClick ? (disabled ? 'not-allowed' : 'pointer') : 'default',
        background: on ? 'var(--grad-guinda-soft)' : 'var(--hairline-strong)',
        boxShadow: (glow && on) ? 'var(--glow-guinda)' : 'none',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .2s, box-shadow .2s, opacity .2s',
        ...style,
      },
    });
    if (onClick) {
      props.type = 'button';
      props.onClick = onClick;
      props.disabled = !!disabled;
      if (!disabled) {
        const off = () => setPress(false);
        props.onPointerDown = () => setPress(true);
        props.onPointerUp = off; props.onPointerLeave = off; props.onPointerCancel = off;
      }
    }
    return React.createElement(tag, props,
      React.createElement('div', { style: {
        position: 'absolute', top: 3, left: 3, width: th, height: th, borderRadius: '50%', background: '#fff', boxShadow: sh,
        transformOrigin: on ? 'right center' : 'left center',
        transform: 'translateX(' + (on ? w - th - 6 : 0) + 'px)' + (press ? ' scaleX(1.14)' : ''),
        transition: 'transform .22s cubic-bezier(.34,1.56,.64,1)',
      } }));
  }

  // ---------- FavHeart (microinteracción firmada · M4) ----------
  // Corazón de favorito: al encender, el icono hace spring 1→1.3→1 y un destello
  // radial se disipa. Al apagar, solo cambia el relleno.
  function FavHeart({ on, onClick, size = 38, iconSize = 20, resKey = 'convenios.card.fav', style }) {
    const iconRef = React.useRef(null), flashRef = React.useRef(null), first = React.useRef(true);
    React.useEffect(() => {
      if (first.current) { first.current = false; return; }
      const M = window.MOTION;
      if (!on || !M || M.reduced() || M.frozen()) return;
      M.animate(iconRef.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 420, easing: M.ease.standard, fill: 'none' });
      M.animate(flashRef.current, [{ transform: 'scale(.35)', opacity: 0.6 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 300, easing: M.ease.exit, fill: 'none' });
    }, [on]);
    return React.createElement('button', {
      onClick, 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'Favorito',
      style: { position: 'absolute', width: size, height: size, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.22)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff', padding: 0, ...style },
    },
      React.createElement('div', { ref: flashRef, 'aria-hidden': 'true', style: { position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,0) 70%)', opacity: 0, pointerEvents: 'none' } }),
      React.createElement('div', { ref: iconRef, style: { display: 'grid', placeItems: 'center' } },
        React.createElement(window.Res, { resKey, size: iconSize, stroke: 2, style: { fill: on ? '#fff' : 'none', transition: 'fill .18s linear' } })));
  }

  // ---------- Skeleton ----------
  function Skeleton({ w = '100%', h = 16, r = 8, style }) {
    return React.createElement('div', { className: 'su-skeleton', style: { width: w, height: h, borderRadius: r, ...style } });
  }

  // money formatter
  function money(n, opts = {}) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: opts.dec ?? 0, maximumFractionDigits: opts.dec ?? 0 }).format(n);
  }

  Object.assign(window, { Card, Btn, Pill, Badge, IconTile, SectionHead, ProgressBar, Stepper, Timeline, SearchBar, Sheet, EmptyState, Avatar, Skeleton, Toggle, FavHeart, ChipBar, useBtnConfirm, money });
})();
