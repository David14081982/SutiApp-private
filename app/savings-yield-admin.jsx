/* Period yield uses reviewed backend results; no financial formulas in the UI. */
(function () {
  'use strict';
  const h = React.createElement;
  const money = value => value == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const statuses = { ELIGIBLE: 'Cumple requisitos', EXCLUDED: 'Sin rendimiento', REVIEW_REQUIRED: 'Revisar', CREDITED: 'Ya acreditado', RATE_PENDING: 'Tasa pendiente' };
  function errorText(error) {
    const text = String(error && error.message || '');
    if (/PREVIEW_CHANGED/.test(text)) return 'Los datos cambiaron. Actualiza el cálculo y vuelve a revisar antes de confirmar.';
    if (/DENIED/.test(text)) return 'Tu cuenta no tiene permiso para esta operación.';
    if (/FROZEN|RATE_MISMATCH/.test(text)) return 'El periodo ya tiene una apertura registrada. Su tasa y fechas deben conservarse.';
    if (/RATE_OR_CUTOFF_PENDING/.test(text)) return 'Falta registrar la tasa en la apertura o todavía no llega la fecha de corte.';
    if (/calendar_check|dates_check/.test(text)) return 'Las fechas deben pertenecer al año y semestre seleccionados.';
    return 'No se completó la operación. Conservamos los datos para que puedas reintentar.';
  }
  function SavingsYieldAdmin({ app, periods, onSaved }) {
    const [periodId, setPeriodId] = React.useState(''), [preview, setPreview] = React.useState(null), [phase, setPhase] = React.useState('idle');
    const [error, setError] = React.useState(''), [notice, setNotice] = React.useState(''), [reason, setReason] = React.useState(''), [review, setReview] = React.useState(false);
    const [form, setForm] = React.useState({ year: String(new Date().getFullYear()), semester: '1', startsOn: '', endsOn: '', rate: '' });
    const sequence = React.useRef(0), key = React.useRef(null), busy = React.useRef(false), mounted = React.useRef(true);
    const canConfigure = app.admin.has('savings.config'), canApprove = app.admin.has('savings.approve');
    React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);
    const load = React.useCallback(async (id) => {
      const generation = ++sequence.current; setPreview(null); setReview(false); setReason(''); key.current = null; setError('');
      if (!id) { setPhase('idle'); return; }
      setPhase('loading');
      try { const value = await window.SavingsRepository.previewPeriodYield(id); if (mounted.current && sequence.current === generation) { setPreview(value); setPhase('ready'); } }
      catch (failure) { if (mounted.current && sequence.current === generation) { setError(errorText(failure)); setPhase('error'); } }
    }, []);
    function selectPeriod(id) { setPeriodId(id); setNotice(''); load(id); }
    function field(label, name, type) { return h('label', { className: 'sava-field', key: name }, label, h('input', { className: 'sava-input', type, value: form[name], step: name === 'rate' ? '0.000001' : undefined, min: name === 'rate' ? 0 : undefined, max: name === 'rate' ? 100 : undefined, required: name !== 'rate', onChange: e => setForm(Object.assign({}, form, { [name]: e.target.value })) })); }
    async function savePeriod(event) {
      event.preventDefault(); if (busy.current) return; busy.current = true; setPhase('saving'); setError(''); setReview(false); setPreview(null); sequence.current++;
      try { await window.SavingsRepository.saveYieldPeriod(Object.assign({}, form, { status: 'DRAFT' })); if (!mounted.current) return; setNotice('Periodo guardado. La tasa se confirma al registrar su apertura de retiros.'); await onSaved(); if (mounted.current) await load(periodId); }
      catch (failure) { if (mounted.current) { setError(errorText(failure)); setPhase('error'); } }
      finally { busy.current = false; }
    }
    async function confirm() {
      if (busy.current || !preview || !review) return;
      busy.current = true; setPhase('saving'); setError('');
      const submitted = { periodId, fingerprint: preview.fingerprint, reason: reason.trim(), clientActionId: key.current };
      try {
        const result = await window.SavingsRepository.confirmPeriodYield(submitted);
        if (!mounted.current) return;
        setNotice('Se registraron ' + result.credited_accounts + ' acreditaciones por ' + money(result.credited_amount) + '. Cuentas pendientes de revisión: ' + result.review_pending + '.');
        setReview(false); key.current = null; await load(submitted.periodId); await onSaved();
      } catch (failure) { if (mounted.current) { setError(errorText(failure)); setPhase('ready'); if (/PREVIEW_CHANGED/.test(String(failure.message || ''))) { setPreview(null); setReview(false); key.current = null; } } }
      finally { busy.current = false; }
    }
    const rows = preview && preview.rows || [], saving = phase === 'saving';
    const canReview = canApprove && preview && preview.state === 'READY' && preview.eligible_count > 0 && reason.trim().length >= 3 && !saving;
    return h('section', { 'data-savings-yield-phase': phase },
      h('div', { className: 'sava-note' }, 'El rendimiento requiere seis meses de permanencia y cumplir el reglamento. Sin tasa registrada en la apertura no se calcula rendimiento. Las aportaciones futuras no forman parte del saldo recibido.'),
      canConfigure && h('form', { className: 'sava-form', onSubmit: savePeriod }, field('Año', 'year', 'number'),
        h('label', { className: 'sava-field' }, 'Semestre', h('select', { className: 'sava-select', value: form.semester, onChange: e => setForm(Object.assign({}, form, { semester: e.target.value })) }, h('option', { value: '1' }, 'Enero a junio'), h('option', { value: '2' }, 'Julio a diciembre'))),
        field('Inicio', 'startsOn', 'date'), field('Cierre', 'endsOn', 'date'), field('Tasa propuesta (%) — opcional', 'rate', 'number'),
        h('div', { className: 'sava-form-actions' }, h('button', { className: 'sava-button', type: 'submit', disabled: saving }, 'Guardar periodo'))),
      h('div', { className: 'sava-toolbar' }, h('label', null, 'Periodo a revisar', h('select', { className: 'sava-select', 'aria-label': 'Periodo a revisar', value: periodId, disabled: saving, onChange: e => selectPeriod(e.target.value) }, h('option', { value: '' }, 'Selecciona un periodo'), (periods || []).map(p => h('option', { key: p.id, value: p.id }, p.period_year + ' · semestre ' + p.semester)))),
        h('button', { className: 'sava-button', disabled: !periodId || saving, onClick: () => load(periodId) }, 'Actualizar cálculo')),
      error && h('p', { className: 'sava-error', role: 'alert' }, error), notice && h('p', { role: 'status' }, notice),
      phase === 'loading' && h('p', { role: 'status' }, 'Revisando cuentas del periodo…'),
      preview && h(React.Fragment, null,
        h('div', { className: 'sava-kpis' }, [['Tasa registrada', preview.rate == null ? 'Pendiente' : preview.rate + '%'], ['Fecha de corte', preview.cutoff_on || 'Pendiente'], ['Ahorradores elegibles', preview.eligible_count], ['Requieren revisión', preview.review_count], ['Por acreditar', preview.state === 'READY' ? money(preview.total_to_credit) : '—']].map(([label, value]) => h('div', { className: 'sava-kpi', key: label }, h('span', null, label), h('b', null, value)))),
        h('div', { style: { overflowX: 'auto' } }, h('table', { className: 'sava-table', 'aria-label': 'Rendimiento por Folio' }, h('thead', null, h('tr', null, ['Folio', 'Nombre', 'Estado', 'Cumple seis meses', 'Capital elegible', 'Rendimiento', 'Motivo'].map(label => h('th', { key: label }, label)))),
          h('tbody', null, rows.map(row => h('tr', { key: row.participant_id }, [row.folio, row.name, statuses[row.status] || row.status, row.eligible_on || '—', money(row.capital_basis), money(row.yield_amount), row.reason || '—'].map((value, index) => h('td', { key: index }, value))))))),
        !rows.length && h('p', null, 'No hay cuentas para este periodo.'),
        canApprove && h('div', { className: 'sava-form' }, h('label', { className: 'sava-field' }, 'Justificación de la acreditación', h('textarea', { className: 'sava-input', value: reason, disabled: review || saving, maxLength: 1000, onChange: e => setReason(e.target.value) })),
          !review && h('button', { className: 'sava-button is-primary', disabled: !canReview, onClick: () => { key.current = window.SavingsRepository.newIdempotencyKey(); setReview(true); } }, 'Revisar acreditación'),
          review && h('div', { role: 'region', 'aria-label': 'Confirmar acreditación' }, h('p', null, 'Se acreditarán ' + money(preview.total_to_credit) + ' a ' + preview.eligible_count + ' ahorradores. Las cuentas pendientes conservarán su saldo sin cambios.'),
            h('button', { className: 'sava-button', disabled: saving, onClick: () => { setReview(false); key.current = null; } }, 'Volver a revisar'),
            h('button', { className: 'sava-button is-primary', disabled: saving, onClick: confirm }, saving ? 'Registrando…' : 'Confirmar acreditación')))),
      !periodId && h('p', null, 'Selecciona un periodo para consultar su tasa y revisar a los ahorradores.'));
  }
  window.SavingsYieldAdmin = SavingsYieldAdmin;
})();
