/* screens-admin-planes.jsx — Panel Administrativo · Planes de empresas.
   CRUD de planes (beneficios, precios mensual/anual, límites) y asignación
   de plan + ciclo de pago a cada empresa. Exporta window.PlanesModule. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const S = () => window.companyStore;
  function useStore() { const [, f] = useState(0); useEffect(() => S().subscribe(() => f((n) => n + 1)), []); useEffect(() => { S().retry(); }, []); return S(); }
  const money = (n) => (window.money ? window.money(n) : '$' + n);
  const planesLbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };
  const planesInput = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const fmtD = (s) => { try { return new Date(s + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return s || '—'; } };

  function chip(icon, label, on) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 999, background: on === false ? 'var(--surface-2)' : 'var(--guinda-50)', color: on === false ? 'var(--ink-3)' : 'var(--guinda)' } },
      React.createElement(I, { name: icon, size: 13, stroke: 2.2 }), label);
  }
  function Toggle({ on, onClick, disabled }) {
    return React.createElement('button', { onClick: (e) => { e.stopPropagation(); if (!disabled) onClick(); }, disabled, 'aria-label': 'Activo', style: { width: 44, height: 26, borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: on ? 'var(--grad-guinda-soft)' : 'var(--hairline-strong)', position: 'relative', flexShrink: 0, boxShadow: on ? 'var(--glow-guinda)' : 'none', opacity: disabled ? .5 : 1 } },
      React.createElement('div', { style: { position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 2px 4px rgba(0,0,0,.25)' } }));
  }

  function PlanesModule({ app, onBack, header }) {
    const store = useStore();
    const [editing, setEditing] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const canWrite = app.admin.has('company_portal.write');
    const P = { crear: canWrite, editar: canWrite, eliminar: canWrite };
    const plans = store.plans();
    const cos = store.companies();
    const state = store.state();

    return React.createElement('div', null,
      header({ title: 'Planes de empresas', sub: plans.length + ' plan(es) · ' + cos.length + ' empresas', onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 28px' } },
        state.phase === 'loading' && React.createElement('div', { 'data-company-plans-state': 'loading', style: { padding: 14, textAlign: 'center', fontWeight: 700, color: 'var(--ink-3)' } }, 'Cargando planes y empresas…'),
        state.phase === 'error' && React.createElement(window.EmptyState, { icon: 'alert', title: 'No pudimos cargar los planes', sub: 'Comprueba tu conexión e inténtalo de nuevo.', action: React.createElement(window.Btn, { onClick: store.retry }, 'Reintentar') }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
          React.createElement('div', { style: { flex: 1, fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em' } }, 'PLANES DISPONIBLES'),
          P.crear && React.createElement('button', { onClick: () => setEditing(store.blankPlan()), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 15px', borderRadius: 13, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
            React.createElement(I, { name: 'plus', size: 18, stroke: 2.6 }), 'Nuevo plan')),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
          plans.map((p) => React.createElement(PlanCard, { key: p.id, p, store, P, app, uso: store.planUsage(p.id), onEdit: () => setEditing(JSON.parse(JSON.stringify(p))) }))),

        React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '24px 0 12px' } }, 'EMPRESAS Y SU PLAN'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          cos.map((c) => {
            const pl = window.COMPANY.PLAN(c.plan);
            const ss = store.subStatus(c);
            const tone = ss === 'activo' ? ['#1B7F4D', '#E7F6EC'] : ss === 'porVencer' ? ['#9A6B16', '#FFF3DC'] : ['#C0341D', '#FDEAEA'];
            return React.createElement('div', { key: c.id, style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 15, padding: '12px 13px', boxShadow: 'var(--neo-sm)' } },
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, c.name),
                React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 } },
                  chip('tag', 'Plan ' + pl.name),
                  chip('calendar', (c.billing === 'mensual' ? 'Mensual' : 'Anual'), false),
                  React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 999, background: tone[1], color: tone[0] } },
                    React.createElement(I, { name: 'clock', size: 13, stroke: 2.2 }), 'Vence ' + fmtD(c.subEnd)))),
              P.editar && React.createElement('button', { onClick: () => setAssigning(c), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 13px', borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', flexShrink: 0 } },
                React.createElement(I, { name: 'swap', size: 15, stroke: 2.2 }), 'Cambiar'));
          })),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', marginTop: 20, lineHeight: 1.5, padding: '0 10px' } }, 'Los cambios se reflejan de inmediato en el Panel Empresarial: límites de productos, pop-ups, historial y la tarjeta de suscripción.')),
      editing && React.createElement(PlanEditor, { plan: editing, store, P, app, onClose: () => setEditing(null) }),
      assigning && React.createElement(AssignSheet, { co: assigning, store, app, onClose: () => setAssigning(null) }));
  }

  function PlanCard({ p, store, P, app, uso, onEdit }) {
    const ahorro = p.precioMensual > 0 && p.precioAnual > 0 ? Math.max(0, Math.round((1 - p.precioAnual / (p.precioMensual * 12)) * 100)) : 0;
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, boxShadow: 'var(--neo-sm)', overflow: 'hidden', opacity: p.activo === false ? .6 : 1 } },
      React.createElement('div', { style: { padding: '14px 15px 0', display: 'flex', alignItems: 'flex-start', gap: 10 } },
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('span', { style: { fontSize: 17, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, p.name || 'Sin nombre'),
            p.activo === false && React.createElement('span', { style: { fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#FDEAEA', color: '#C0341D' } }, 'INACTIVO')),
          p.desc && React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.35 } }, p.desc)),
        React.createElement(Toggle, { on: p.activo !== false, disabled: !P.editar, onClick: async() => { try { await store.togglePlan(p.id); app.toast('Estado actualizado'); } catch (_) { app.toast('No se pudo actualizar el plan'); } } })),
      // precios mensual / anual
      React.createElement('div', { style: { display: 'flex', gap: 10, padding: '12px 15px 0' } },
        [['Pago mensual', p.precioMensual, '/mes', null], ['Pago anual', p.precioAnual, '/año', ahorro > 0 ? 'Ahorra ' + ahorro + '%' : null]].map((b, i) =>
          React.createElement('div', { key: i, style: { flex: 1, background: 'var(--surface-2)', borderRadius: 13, padding: '10px 12px', boxShadow: 'var(--neo-inset)', position: 'relative' } },
            React.createElement('div', { style: { fontSize: 10, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' } }, b[0]),
            React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginTop: 2 } }, money(b[1] || 0), React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' } }, ' ' + b[2])),
            b[3] && React.createElement('div', { style: { position: 'absolute', top: 8, right: 10, fontSize: 9.5, fontWeight: 900, padding: '3px 7px', borderRadius: 999, background: '#E7F6EC', color: '#1B7F4D' } }, b[3])))),
      // qué desbloquea
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '11px 15px 0' } },
        chip('cart', p.maxProductos >= 999 ? 'Productos ilimitados' : 'Hasta ' + p.maxProductos + ' productos'),
        chip('message', p.popups ? 'Pop-ups en la app' : 'Sin pop-ups', p.popups),
        chip('clock', p.statsHistory ? 'Historial mensual' : 'Sin historial', p.statsHistory)),
      (p.beneficios || []).length > 0 && React.createElement('div', { style: { padding: '11px 15px 0', display: 'flex', flexDirection: 'column', gap: 5 } },
        (p.beneficios || []).map((b, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4 } },
          React.createElement(I, { name: 'checkCircle', size: 15, stroke: 2.2, style: { color: 'var(--guinda)', flexShrink: 0, marginTop: 1 } }), b))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 15px 13px', marginTop: 2, borderTop: '1px solid var(--hairline)' } },
        React.createElement('span', { style: { flex: 1, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' } }, uso + ' empresa(s) con este plan'),
        P.editar && React.createElement(window.Btn, { variant: 'outline', size: 'sm', icon: 'doc', onClick: onEdit }, 'Editar'),
        P.crear && React.createElement('button', { onClick: async() => { try { await store.duplicatePlan(p.id); app.toast('Plan duplicado'); } catch (_) { app.toast('No se pudo duplicar el plan'); } }, 'aria-label': 'Duplicar', style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' } }, React.createElement(I, { name: 'copy', size: 17, stroke: 2 })),
        P.eliminar && React.createElement('button', { onClick: async() => { if (uso > 0) return app.toast('No se puede eliminar: hay empresas con este plan.'); try { await store.removePlan(p.id); app.toast('Plan eliminado'); } catch (_) { app.toast('No se pudo eliminar el plan'); } }, 'aria-label': 'Eliminar', style: { width: 36, height: 36, borderRadius: 11, border: 'none', background: uso > 0 ? 'var(--surface-2)' : '#FDEAEA', color: uso > 0 ? 'var(--ink-3)' : '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: uso > 0 ? .6 : 1 } }, React.createElement(I, { name: 'trash', size: 17, stroke: 2 }))));
  }

  // ── Editor de plan (pantalla completa, mismo patrón que FondosModule) ──
  function PlanEditor({ plan, store, P, app, onClose }) {
    const [d, setD] = useState(plan);
    const [busy, setBusy] = useState(false);
    const isNew = !store.plans().some((x) => x.id === plan.id);
    const set = (patch) => setD((prev) => Object.assign({}, prev, patch));
    const field = (label, node) => React.createElement('div', { style: { marginBottom: 16 } }, React.createElement('label', { style: planesLbl }, label), node);
    const num = (v) => Math.max(0, parseFloat(v || '0') || 0);
    const toggleRow = (key, title, sub) => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', boxShadow: 'var(--neo-sm)', borderRadius: 14, padding: '13px 15px', marginBottom: 12 } },
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, title),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, sub)),
      React.createElement(Toggle, { on: !!d[key], onClick: () => set({ [key]: !d[key] }) }));
    const bens = d.beneficios || [];
    const setBen = (i, v) => set({ beneficios: bens.map((b, j) => (j === i ? v : b)) });

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 74, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16, fontWeight: 800 } }, isNew ? 'Nuevo plan' : 'Editar plan')),
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        field('Nombre del plan', React.createElement('input', { value: d.name || '', placeholder: 'Básico, Pro, Premium…', onChange: (e) => set({ name: e.target.value }), style: planesInput })),
        field('Descripción corta', React.createElement('input', { value: d.desc || '', placeholder: 'Para quién es este plan', onChange: (e) => set({ desc: e.target.value }), style: planesInput })),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
          field('Precio mensual (MXN)', React.createElement('input', { type: 'number', min: 0, step: 50, value: d.precioMensual, onChange: (e) => set({ precioMensual: num(e.target.value) }), style: planesInput })),
          field('Precio anual (MXN)', React.createElement('input', { type: 'number', min: 0, step: 500, value: d.precioAnual, onChange: (e) => set({ precioAnual: num(e.target.value) }), style: planesInput }))),
        d.precioMensual > 0 && d.precioAnual > 0 && d.precioAnual < d.precioMensual * 12 && React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: '#1B7F4D', background: '#E7F6EC', borderRadius: 11, padding: '9px 12px', marginTop: -6, marginBottom: 16 } }, 'El pago anual ahorra ' + Math.round((1 - d.precioAnual / (d.precioMensual * 12)) * 100) + '% frente a 12 pagos mensuales.'),
        field('Máximo de productos / servicios', React.createElement('input', { type: 'number', min: 1, step: 5, value: d.maxProductos, onChange: (e) => set({ maxProductos: Math.max(1, parseInt(e.target.value || '1', 10)) }), style: planesInput })),
        React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: -10, marginBottom: 16 } }, 'Usa 999 para productos ilimitados.'),
        toggleRow('popups', 'Pop-ups en la app', 'La empresa puede proponer pop-ups (con aprobación del sindicato)'),
        toggleRow('statsHistory', 'Historial mensual de actividad', 'Desbloquea el historial en el módulo de Estadísticas'),
        toggleRow('activo', 'Plan activo', d.activo ? 'Disponible para asignar a empresas' : 'Oculto para nuevas asignaciones'),

        React.createElement('label', { style: Object.assign({}, planesLbl, { marginTop: 4 }) }, 'Beneficios mostrados a la empresa'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 } },
          bens.map((b, i) => React.createElement('div', { key: i, style: { display: 'flex', gap: 8 } },
            React.createElement('input', { value: b, placeholder: 'Beneficio ' + (i + 1), onChange: (e) => setBen(i, e.target.value), style: Object.assign({}, planesInput, { flex: 1, width: 'auto' }) }),
            React.createElement('button', { onClick: () => set({ beneficios: bens.filter((_, j) => j !== i) }), 'aria-label': 'Quitar', style: { width: 44, height: 44, borderRadius: 12, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: 'trash', size: 17, stroke: 2 }))))),
        React.createElement('button', { onClick: () => set({ beneficios: [...bens, ''] }), style: { display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 15px', borderRadius: 12, border: '1.5px dashed var(--hairline-strong)', background: 'transparent', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', marginBottom: 18 } },
          React.createElement(I, { name: 'plus', size: 16, stroke: 2.4 }), 'Agregar beneficio'),
        React.createElement('div', { style: { height: 10 } })),
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, disabled: busy, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: busy, onClick: async() => { if (!(d.name || '').trim()) return app.toast('Ponle nombre al plan.'); setBusy(true); try { await store.savePlan(Object.assign({}, d, { beneficios: bens.map((b) => b.trim()).filter(Boolean) })); app.toast(isNew ? 'Plan creado' : 'Plan actualizado'); onClose(); } catch (_) { app.toast('No se pudo guardar el plan'); } finally { setBusy(false); } } }, busy ? 'Guardando…' : 'Guardar plan')));
  }

  // ── Asignar plan + ciclo a una empresa ──
  function AssignSheet({ co, store, app, onClose }) {
    const [planId, setPlanId] = useState(co.plan);
    const [ciclo, setCiclo] = useState(co.billing === 'mensual' ? 'mensual' : 'anual');
    const [busy, setBusy] = useState(false);
    const plans = store.plans().filter((p) => p.activo !== false || p.id === co.plan);
    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 76, background: 'rgba(10,14,22,.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }, onClick: onClose },
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { background: 'var(--bg)', borderRadius: '22px 22px 0 0', padding: '18px 16px calc(16px + env(safe-area-inset-bottom))', maxHeight: '86%', overflowY: 'auto' } },
        React.createElement('div', { style: { width: 42, height: 5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '0 auto 14px' } }),
        React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, co.name),
        React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 3, marginBottom: 14 } }, 'Elige el plan y el ciclo de pago. La vigencia se reinicia a partir de hoy.'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 } },
          plans.map((p) => {
            const on = planId === p.id;
            return React.createElement('button', { key: p.id, onClick: () => setPlanId(p.id), style: { display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' } },
              React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: on ? '6px solid var(--guinda)' : '2px solid var(--hairline-strong)', background: '#fff', boxSizing: 'border-box', flexShrink: 0 } }),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, p.name),
                React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, (p.maxProductos >= 999 ? 'Productos ilimitados' : p.maxProductos + ' productos') + (p.popups ? ' · pop-ups' : '') + (p.statsHistory ? ' · historial' : ''))),
              React.createElement('div', { style: { textAlign: 'right', flexShrink: 0 } },
                React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--guinda)' } }, (window.money ? window.money(ciclo === 'mensual' ? p.precioMensual || 0 : p.precioAnual || 0) : '')),
                React.createElement('div', { style: { fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' } }, ciclo === 'mensual' ? 'al mes' : 'al año')));
          })),
        React.createElement('label', { style: planesLbl }, 'Ciclo de pago'),
        React.createElement('div', { style: { display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 13, padding: 4, boxShadow: 'var(--neo-inset)', marginBottom: 18 } },
          [['mensual', 'Mensual · vence en 1 mes'], ['anual', 'Anual · vence en 1 año']].map(([v, l]) =>
            React.createElement('button', { key: v, onClick: () => setCiclo(v), style: { flex: 1, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, background: ciclo === v ? 'var(--surface)' : 'transparent', color: ciclo === v ? 'var(--guinda)' : 'var(--ink-3)', boxShadow: ciclo === v ? 'var(--neo-sm)' : 'none' } }, l))),
        React.createElement('div', { style: { display: 'flex', gap: 12 } },
          React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, disabled: busy, onClick: onClose }, 'Cancelar'),
          React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: busy || !planId || planId === 'pending', onClick: async() => { setBusy(true); try { await store.setCompanyPlan(co.id, planId, ciclo); app.toast('Plan actualizado para ' + co.name); onClose(); } catch (_) { app.toast('No se pudo actualizar el plan de la empresa'); } finally { setBusy(false); } } }, busy ? 'Guardando…' : 'Guardar cambio'))));
  }

  window.PlanesModule = PlanesModule;
})();
