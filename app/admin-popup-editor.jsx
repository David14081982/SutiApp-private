/* admin-popup-editor.jsx — Editor completo de un pop-up + vista previa en vivo.
   Exporta window.PopupEditor. */
(function () {
  const { useState } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;

  const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', letterSpacing: '.01em', display: 'block', marginBottom: 7 };
  const field = { display: 'block', marginBottom: 18 };
  const inputBase = {
    width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)',
    borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box',
  };

  function PeLabel({ children, hint }) {
    return React.createElement('label', { style: lbl },
      children,
      hint && React.createElement('span', { style: { fontWeight: 600, color: 'var(--ink-3)', marginLeft: 6 } }, hint));
  }
  function PeText({ label, hint, value, onChange, placeholder, area, maxLength }) {
    return React.createElement('div', { style: field },
      React.createElement(PeLabel, { hint }, label),
      React.createElement(area ? 'textarea' : 'input', {
        value: value || '', placeholder, maxLength,
        onChange: (e) => onChange(e.target.value),
        rows: area ? 3 : undefined,
        style: { ...inputBase, resize: area ? 'vertical' : undefined, minHeight: area ? 76 : undefined, lineHeight: area ? 1.5 : undefined },
      }));
  }
  function PeSwitch({ label, sub, value, onChange }) {
    return React.createElement('button', {
      onClick: () => onChange(!value),
      style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '13px 15px', cursor: 'pointer', marginBottom: 18 },
    },
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, label),
        sub && React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, sub)),
      React.createElement(window.Toggle, { on: value, size: 'xl', }));
  }
  function PeChips({ label, hint, options, values, single, onChange }) {
    const list = values || [];
    const toggle = (o) => {
      if (single) { onChange([o]); return; }
      onChange(list.indexOf(o) !== -1 ? list.filter((x) => x !== o) : [...list, o]);
    };
    return React.createElement('div', { style: field },
      React.createElement(PeLabel, { hint }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        options.map((o) => {
          const on = list.indexOf(o) !== -1;
          return React.createElement('button', {
            key: o, onClick: () => toggle(o),
            style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, transition: 'all .18s', background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
          }, on && React.createElement(I, { name: 'check', size: 14, stroke: 3 }), o);
        })));
  }

  const HUES = [345, 205, 150, 275, 28, 188];

  function PopupEditor({ popup, onClose }) {
    const [d, setD] = useState(popup);
    const [preview, setPreview] = useState(false);
    const set = (patch) => setD((p) => ({ ...p, ...patch }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const setCS = (patch) => setD((p) => ({ ...p, custom: { ...(p.custom || {}), ...patch } }));
    const [csPreview, setCsPreview] = useState(false);
    const isNew = !window.adminStore.get(popup.id);

    const save = () => { window.adminStore.save(d); onClose(); };
    const del = () => { window.adminStore.remove(d.id); onClose(); };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 70, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      // header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: onClose, style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nuevo pop-up' : 'Editar pop-up'),
        React.createElement('button', { onClick: () => setPreview(true), style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 13px', borderRadius: 11, border: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-sm)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' } },
          React.createElement(I, { name: 'eye', size: 17, stroke: 2 }), 'Vista previa')),

      // body
      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        React.createElement(PeSwitch, { label: 'Pop-up activo', sub: d.enabled ? 'Se mostrará según sus reglas' : 'Desactivado, no se mostrará', value: d.enabled, onChange: (v) => set({ enabled: v }) }),

        React.createElement('div', { style: field },
          React.createElement(PeLabel, null, 'Pantalla'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('select', { value: d.screen, onChange: (e) => set({ screen: e.target.value }), style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer' } },
              A().SCREENS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label + ' · ' + s.group.replace('Pantallas ', '')))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }))),

        React.createElement(SectionTitle, { icon: 'doc', label: 'Contenido' }),
        React.createElement(PeText, { label: 'Etiqueta de cabecera', hint: '(opcional)', value: d.etiqueta, onChange: (v) => set({ etiqueta: v }), placeholder: 'CONVENIO DESTACADO', maxLength: 28 }),
        React.createElement(PeText, { label: 'Subtítulo', value: d.subtitulo, onChange: (v) => set({ subtitulo: v }), placeholder: 'Nombre de empresa o eyebrow', maxLength: 40 }),
        React.createElement(PeText, { label: 'Título', value: d.titulo, onChange: (v) => set({ titulo: v }), placeholder: 'Título principal del pop-up', maxLength: 70 }),
        React.createElement(PeText, { label: 'Contenido / descripción', value: d.contenido, onChange: (v) => set({ contenido: v }), placeholder: 'Texto descriptivo…', area: true, maxLength: 240 }),

        React.createElement(SectionTitle, { icon: 'image', label: 'Imagen de cabecera' }),
        React.createElement('div', { style: { borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--neo-sm)', marginBottom: 12, height: 150, position: 'relative', background: `linear-gradient(150deg, hsl(${d.hue},70%,42%), hsl(${d.hue},65%,26%))` } },
          React.createElement('image-slot', { id: d.slotId, shape: 'rect', fit: 'cover', placeholder: 'Arrastra una imagen', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
        React.createElement('div', { style: field },
          React.createElement(PeLabel, { hint: '(fondo si no hay imagen)' }, 'Color de acento'),
          React.createElement('div', { style: { display: 'flex', gap: 10 } },
            HUES.map((h) => React.createElement('button', {
              key: h, onClick: () => set({ hue: h }),
              style: { width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', background: `hsl(${h},68%,45%)`, border: d.hue === h ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: 'var(--neo-sm)' },
            })))),

        React.createElement(SectionTitle, { icon: 'tag', label: 'Botón principal' }),
        React.createElement(PeText, { label: 'Texto del botón', value: d.ctaText, onChange: (v) => set({ ctaText: v }), placeholder: 'Ver más', maxLength: 26 }),
        React.createElement('div', { style: field },
          React.createElement(PeLabel, null, 'Acción del botón'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            [
              { v: 'internal', t: 'Abrir pantalla interna', ic: 'grid' },
              { v: 'custom', t: 'Crear pantalla nueva (personalizada)', ic: 'sparkle' },
              { v: 'url', t: 'Abrir enlace externo (URL)', ic: 'link' },
              { v: 'none', t: 'No realizar ninguna acción', ic: 'ban' },
            ].map((o) => {
              const on = d.actionType === o.v;
              return React.createElement('button', {
                key: o.v, onClick: () => set(o.v === 'custom' ? { actionType: 'custom', custom: d.custom || { slotId: 'cs_img_' + Math.random().toString(36).slice(2, 8), etiqueta: '', titulo: '', texto: '', botones: [] } } : { actionType: o.v }),
                style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' },
              },
                React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: o.ic, size: 18, stroke: 2 })),
                React.createElement('span', { style: { flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' } }, o.t),
                on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
            }))),
        d.actionType === 'internal' && React.createElement('div', { style: field },
          React.createElement(PeLabel, null, 'Pantalla destino'),
          React.createElement('div', { style: { position: 'relative' } },
            React.createElement('select', { value: d.actionTarget || '', onChange: (e) => set({ actionTarget: e.target.value }), style: { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40, cursor: 'pointer' } },
              React.createElement('option', { value: '' }, 'Selecciona una pantalla…'),
              A().NAV_TARGETS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
            React.createElement(I, { name: 'chevD', size: 18, stroke: 2.2, style: { position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } }))),
        d.actionType === 'url' && React.createElement(PeText, { label: 'URL de destino', value: d.actionTarget, onChange: (v) => set({ actionTarget: v }), placeholder: 'https://…' }),
        d.actionType === 'custom' && React.createElement(CustomScreenBuilder, { cs: d.custom || {}, hue: d.hue, setCS, onPreview: () => setCsPreview(true) }),

        React.createElement(SectionTitle, { icon: 'users', label: 'Visibilidad y segmentación' }),
        React.createElement('div', { style: field },
          React.createElement(PeLabel, null, '¿A quién se muestra?'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            A().AUDIENCE_MODES.map((m) => {
              const on = (d.audience.mode || 'all') === m.value;
              return React.createElement('button', {
                key: m.value, onClick: () => setAud({ mode: m.value }),
                style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: on ? 'var(--guinda-50)' : 'var(--surface)', border: on ? '1.5px solid var(--guinda)' : '1.5px solid transparent', boxShadow: on ? 'none' : 'var(--neo-sm)', borderRadius: 13, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' },
              },
                React.createElement('div', { style: { width: 34, height: 34, borderRadius: 10, background: on ? 'var(--guinda)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: m.icon, size: 18, stroke: 2 })),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, m.label),
                  React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1 } }, m.desc)),
                on && React.createElement(I, { name: 'checkCircle', size: 20, stroke: 2, style: { color: 'var(--guinda)' } }));
            }))),
        d.audience.mode === 'segment' && React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '16px 15px 2px', boxShadow: 'var(--neo-sm)', marginBottom: 18 } },
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 12, lineHeight: 1.4 } }, 'Deja un grupo vacío para no filtrar por ese criterio.'),
          React.createElement(PeChips, { label: 'Cargo en la aplicación', options: A().CARGOS, values: d.audience.cargos, onChange: (v) => setAud({ cargos: v }) }),
          React.createElement(PeChips, { label: 'Tipo de sindicato', options: A().SINDICATOS, values: d.audience.sindicatos, onChange: (v) => setAud({ sindicatos: v }) }),
          React.createElement(PeChips, { label: 'Nivel de usuario', options: A().NIVELES, values: d.audience.niveles, onChange: (v) => setAud({ niveles: v }) })),

        React.createElement(SectionTitle, { icon: 'calendar', label: 'Programación (opcional)' }),
        React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 18 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement(PeLabel, null, 'Inicio'),
            React.createElement('input', { type: 'date', value: d.startDate || '', onChange: (e) => set({ startDate: e.target.value }), style: { ...inputBase, cursor: 'pointer' } })),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement(PeLabel, null, 'Fin'),
            React.createElement('input', { type: 'date', value: d.endDate || '', onChange: (e) => set({ endDate: e.target.value }), style: { ...inputBase, cursor: 'pointer' } }))),

        React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-end' } },
          React.createElement('div', { style: { width: 120 } },
            React.createElement(PeLabel, { hint: 'menor = primero' }, 'Prioridad'),
            React.createElement('input', { type: 'number', min: 1, value: d.priority || 1, onChange: (e) => set({ priority: Math.max(1, parseInt(e.target.value || '1', 10)) }), style: { ...inputBase } }))),

        !isNew && window.adminStore.can('eliminar', 'popups') && React.createElement('button', { onClick: del, style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', marginTop: 4 } },
          React.createElement(I, { name: 'trash', size: 18, stroke: 2 }), 'Eliminar pop-up'),
        React.createElement('div', { style: { height: 20 } })),

      // footer actions
      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, onClick: onClose }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, onClick: save }, 'Guardar pop-up')),

      // live preview overlay
      preview && React.createElement(window.AdminPopup, { items: [d], preview: true, onClose: () => setPreview(false) }),
      csPreview && window.CustomScreenView && React.createElement(window.CustomScreenView, { screen: d.custom, hue: d.hue, preview: true, onClose: () => setCsPreview(false) }));
  }

  // ── Constructor de pantalla personalizada (tipo Glide) ──
  function CustomScreenBuilder({ cs, hue, setCS, onPreview }) {
    const botones = cs.botones || [];
    const setBtn = (id, patch) => setCS({ botones: botones.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
    const addBtn = () => setCS({ botones: [...botones, { id: 'csb_' + Math.random().toString(36).slice(2, 7), label: '', type: 'url', target: '' }] });
    const delBtn = (id) => setCS({ botones: botones.filter((b) => b.id !== id) });
    const selStyle = { ...inputBase, appearance: 'none', WebkitAppearance: 'none', paddingRight: 34, cursor: 'pointer' };
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, padding: '16px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 18 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
        React.createElement('div', { style: { width: 30, height: 30, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: 'sparkle', size: 16, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, fontSize: 14, fontWeight: 900, color: 'var(--ink)' } }, 'Pantalla personalizada'),
        React.createElement('button', { onClick: onPreview, style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 11px', borderRadius: 10, border: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', color: 'var(--guinda)', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' } }, React.createElement(I, { name: 'eye', size: 14, stroke: 2.2 }), 'Probar')),
      React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, marginBottom: 14 } }, 'Esta pantalla solo se abre desde el botón de este pop-up; no aparece en la navegación de la app.'),
      // imagen de cabecera
      React.createElement(PeLabel, null, 'Imagen de cabecera'),
      React.createElement('div', { style: { borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--neo-inset)', margin: '0 0 16px', height: 120, position: 'relative', background: `linear-gradient(150deg, hsl(${hue || 345},70%,42%), hsl(${hue || 345},65%,26%))` } },
        React.createElement('image-slot', { id: cs.slotId, shape: 'rect', fit: 'cover', placeholder: 'Arrastra una imagen', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } })),
      React.createElement(PeText, { label: 'Etiqueta sobre la imagen', hint: '(opcional)', value: cs.etiqueta, onChange: (v) => setCS({ etiqueta: v }), maxLength: 28, placeholder: 'AVISO IMPORTANTE' }),
      React.createElement(PeText, { label: 'Título de la pantalla', value: cs.titulo, onChange: (v) => setCS({ titulo: v }), maxLength: 80, placeholder: 'Título principal' }),
      React.createElement(PeText, { label: 'Texto', value: cs.texto, onChange: (v) => setCS({ texto: v }), area: true, maxLength: 1200, placeholder: 'Contenido de la pantalla. Puedes usar saltos de línea…' }),
      // botones
      React.createElement(PeLabel, null, 'Botones de la pantalla'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 } },
        botones.map((b, i) => React.createElement('div', { key: b.id, style: { background: 'var(--surface-2)', borderRadius: 13, padding: '11px 12px', boxShadow: 'var(--neo-inset)' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 } },
            React.createElement('span', { style: { fontSize: 11, fontWeight: 900, color: 'var(--guinda)', background: 'var(--guinda-50)', minWidth: 20, height: 20, borderRadius: 6, display: 'inline-grid', placeItems: 'center' } }, i + 1),
            React.createElement('input', { value: b.label, placeholder: 'Texto del botón', maxLength: 30, onChange: (e) => setBtn(b.id, { label: e.target.value }), style: { flex: 1, border: 'none', outline: 'none', background: 'var(--surface)', borderRadius: 9, padding: '9px 11px', fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ink)' } }),
            React.createElement('button', { onClick: () => delBtn(b.id), 'aria-label': 'Eliminar botón', style: { width: 32, height: 32, borderRadius: 9, border: 'none', background: '#FDEAEA', color: '#C0341D', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: 'trash', size: 15, stroke: 2 }))),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('div', { style: { position: 'relative', width: 132, flexShrink: 0 } },
              React.createElement('select', { value: b.type, onChange: (e) => setBtn(b.id, { type: e.target.value, target: '' }), style: { ...selStyle, padding: '9px 30px 9px 11px', fontSize: 12.5, fontWeight: 700, borderRadius: 9, background: 'var(--surface)', boxShadow: 'none' } },
                React.createElement('option', { value: 'url' }, 'Enlace (URL)'),
                React.createElement('option', { value: 'screen' }, 'Pantalla app')),
              React.createElement(I, { name: 'chevD', size: 15, stroke: 2.2, style: { position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })),
            b.type === 'url'
              ? React.createElement('input', { value: b.target, placeholder: 'https://…', onChange: (e) => setBtn(b.id, { target: e.target.value }), style: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'var(--surface)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', color: 'var(--ink)' } })
              : React.createElement('div', { style: { position: 'relative', flex: 1, minWidth: 0 } },
                React.createElement('select', { value: b.target || '', onChange: (e) => setBtn(b.id, { target: e.target.value }), style: { ...selStyle, padding: '9px 30px 9px 11px', fontSize: 12.5, fontWeight: 700, borderRadius: 9, background: 'var(--surface)', boxShadow: 'none', width: '100%' } },
                  React.createElement('option', { value: '' }, 'Selecciona pantalla…'),
                  A().NAV_TARGETS.map((s) => React.createElement('option', { key: s.id, value: s.id }, s.label))),
                React.createElement(I, { name: 'chevD', size: 15, stroke: 2.2, style: { position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' } })))))),
      botones.length < 5 && React.createElement('button', { onClick: addBtn, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 42, borderRadius: 12, border: '1.5px dashed var(--hairline-strong)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: 'var(--guinda)' } }, React.createElement(I, { name: 'plus', size: 16, stroke: 2.6 }), 'Agregar botón'));
  }

  function SectionTitle({ icon, label }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 14px' } },
      React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 16, stroke: 2 })),
      React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, label),
      React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } }));
  }

  window.PopupEditor = PopupEditor;
  window.CustomScreenBuilder = CustomScreenBuilder; // reutilizado por el Panel Empresarial
})();
