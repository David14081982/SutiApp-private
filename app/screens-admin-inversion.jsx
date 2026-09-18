/* screens-admin-inversion.jsx — Panel: SUTI INVERSIÓN (textos).
   Edita únicamente el copy editorial de la pantalla Invertir. La calculadora
   (tasa, montos, plazos y fórmula) permanece fija en código por ADR-070/ADR-111
   y no se expone aquí. Exporta window.InversionTextosModule. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;
  const S = () => window.investmentCopyStore;

  const card = { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)' };
  const inputSt = { width: '100%', border: '1px solid var(--hairline)', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface)', outline: 'none', fontFamily: 'inherit' };
  const labelSt = { fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' };

  function CopyField({ item, canEdit, toast }) {
    const stored = S().text(item.id);
    const [draft, setDraft] = useState(stored);
    const [ok, run] = window.useBtnConfirm();
    const seen = React.useRef(stored);
    // La fila adopta un cambio externo del store solo si no hay edición sin guardar.
    useEffect(() => {
      if (seen.current === stored) return;
      setDraft((current) => (current === seen.current ? stored : current));
      seen.current = stored;
    }, [stored]);

    const clean = String(draft == null ? '' : draft).trim();
    const dirty = clean !== String(stored).trim();
    const tooLong = clean.length > 400;
    const valid = clean.length > 0 && !tooLong;
    const advisory = valid ? S().advisory(item.id, clean) : null;

    const save = () => run(() => {
      S().save(item.id, clean).then((saved) => {
        if (toast) toast(saved ? 'Texto actualizado' : 'No fue posible guardar el texto');
      });
    });

    return React.createElement('div', { style: { marginBottom: 14 }, 'data-investment-copy-field': item.id },
      React.createElement('div', { style: labelSt }, item.label),
      item.area
        ? React.createElement('textarea', { value: draft, disabled: !canEdit, onChange: (e) => setDraft(e.target.value), rows: 3, style: Object.assign({}, inputSt, { resize: 'vertical', lineHeight: 1.45 }) })
        : React.createElement('input', { value: draft, disabled: !canEdit, onChange: (e) => setDraft(e.target.value), style: inputSt }),
      advisory && React.createElement('div', { style: { display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 7 } },
        React.createElement(I, { name: 'info', size: 14, stroke: 2, style: { color: 'var(--ink-3)', flexShrink: 0, marginTop: 2 } }),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.45 } }, advisory)),
      tooLong && React.createElement('div', { style: { fontSize: 11.5, color: '#A32921', fontWeight: 700, marginTop: 7 } }, 'Máximo 400 caracteres: van ' + clean.length + '.'),
      !clean.length && dirty && React.createElement('div', { style: { fontSize: 11.5, color: '#A32921', fontWeight: 700, marginTop: 7 } }, 'El texto no puede quedar vacío.'),
      canEdit && dirty && React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 9 } },
        React.createElement(window.Btn, { size: 'sm', icon: 'check', success: ok, disabled: !valid, onClick: save }, 'Guardar'),
        React.createElement(window.Btn, { size: 'sm', variant: 'outline', onClick: () => setDraft(stored) }, 'Deshacer')));
  }

  function InversionTextosModule({ app, onBack, header, canEdit }) {
    const copy = window.useInvestmentCopy();
    const toast = app && app.toast;
    const groups = S().GROUPS;

    let body;
    if (copy.phase === 'error') {
      body = React.createElement(window.EmptyState, {
        icon: 'finance',
        title: 'No pudimos cargar los textos',
        sub: 'La pantalla de inversión conserva lo último publicado. Reintenta para editar.',
        action: React.createElement(window.Btn, { onClick: copy.retry }, 'Reintentar'),
      });
    } else if (copy.phase !== 'loaded') {
      body = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        [0, 1, 2].map((n) => React.createElement(window.Skeleton, { key: n, h: 120, r: 16 })));
    } else {
      body = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        groups.map((g) => React.createElement('div', { key: g.id, style: Object.assign({}, card, { padding: 15 }), 'data-investment-copy-group': g.id },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 } },
            React.createElement('div', { style: { width: 36, height: 36, borderRadius: 12, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } },
              React.createElement(I, { name: g.icon, size: 19, stroke: 2 })),
            React.createElement('div', { style: { fontSize: 15, fontWeight: 900, color: 'var(--ink)' } }, g.label)),
          g.items.map((item) => React.createElement(CopyField, { key: item.id, item, canEdit: canEdit !== false, toast })))));
    }

    return React.createElement('div', null,
      header({ title: 'Suti Inversión', sub: S().KEYS.length + ' textos de la pantalla Invertir', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } },
            'Aquí se edita ', React.createElement('b', null, 'solo el texto'), '. La calculadora de la pantalla —tasa, montos, plazos, gráfica y sus etiquetas— permanece fija en código y no cambia desde el Admin.')),
        body));
  }

  window.InversionTextosModule = InversionTextosModule;
})();
