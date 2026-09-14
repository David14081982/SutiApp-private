/* Admin Savings controls: backend authority, independent windows, audited dates.
   Does not read or replace the affiliate's historical balance projection. */
(function () {
  'use strict';
  const h = React.createElement;
  const money = (value) => value == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const date = (value) => value ? new Date(String(value).length === 10 ? value + 'T12:00:00-07:00' : value).toLocaleString('es-MX', { timeZone: 'America/Hermosillo', dateStyle: 'medium', ...(String(value).length === 10 ? {} : { timeStyle: 'short' }) }) : 'Sin fecha de cierre';
  const labels = { JOIN: 'Nuevos ingresos', WITHDRAW: 'Retiros', CHANGE_AMOUNT: 'Cambios de monto', TERMINATE: 'Bajas', GLOBAL: 'Todos los ahorradores', PARTICIPANT: 'Un ahorrador', EARLY: 'Anticipada', ORDINARY: 'Ordinaria', EXCEPTION: 'Individual especial' };
  function errorMessage(error) {
    const raw = String(error && error.message || '');
    const cases = [
      ['SAVINGS_LOAN_VERIFICATION_UNAVAILABLE', 'No se puede autorizar el pago: falta la consulta de adeudos de préstamos.'],
      ['SAVINGS_ACCOUNT_CERTIFICATION_REQUIRED', 'La cuenta requiere certificar su identidad y saldo antes de operar.'],
      ['SAVINGS_EARLY_OPENING_REASON_REQUIRED', 'Fuera de enero y julio, selecciona apertura anticipada o individual especial y explica el motivo.'],
      ['SAVINGS_EXCEPTION_PARTICIPANT_REQUIRED', 'Una apertura individual especial debe se?alar a un solo ahorrador.'],
      ['SAVINGS_PERIOD_RATE_FROZEN', 'Este periodo ya tiene una tasa registrada. No puede cambiarse desde otra apertura.'],
      ['SAVINGS_PERIOD_RATE_MISMATCH', 'La tasa debe coincidir con la registrada para este periodo.'],
      ['SAVINGS_PERIOD_CUTOFF_FROZEN', 'Este periodo ya tiene una fecha de corte registrada.'],
      ['SAVINGS_YIELD_CUTOFF_OUTSIDE_PERIOD', 'La fecha de corte debe estar dentro del periodo seleccionado.'],
      ['SAVINGS_EXTRAORDINARY_NO_YIELD', 'El retiro individual extraordinario no genera rendimiento nuevo.'],
      ['SAVINGS_DATE_HAS_RECORDED_MOVEMENTS', 'Esa fecha afectaría movimientos registrados. Requiere una corrección financiera independiente.'],
      ['SAVINGS_DATE_CONFLICTS_WITH_PLAN', 'Hay otro plan programado en las fechas afectadas. Revisa el calendario antes de continuar.'],
      ['SAVINGS_APPROVED_CATEGORY_DATE_PROTECTED', 'Esta fecha pertenece a un cambio de categoría ya aprobado. No puede modificarse mediante una excepción de fecha de solicitud.'],
      ['SAVINGS_AUTHORIZED_DATE_INVALID', 'Elige una fecha futura de descuento: día 5 para jubilados; 15, 28 de febrero o 30 para activos.'],
      ['SAVINGS_WINDOW_INVALID', 'Revisa las fechas de apertura y cierre. El cierre debe ser posterior al inicio y al momento actual.'],
      ['SAVINGS_CUTOFF_AFTER_OPENING', 'El corte del ahorro no puede ser posterior a la apertura.'],
      ['SAVINGS_IDEMPOTENCY_CONFLICT', 'Esta operación ya se registró con otros datos. Actualiza antes de volver a enviarla.'],
    ];
    for (const [code, text] of cases) if (raw.includes(code)) return text;
    if (/42501|DENIED/.test(raw)) return 'Tu cuenta no tiene autorización para realizar esta operación.';
    return 'No se completó la operación. Revisa los datos y vuelve a intentar; no se mostrará como guardada sin confirmación.';
  }
  const CSS = `
    .savo{margin-bottom:16px}.savo-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 0 12px}.savo-head h2{margin:0;font-size:18px}.savo-head p{margin:5px 0 0;color:var(--ink-3);font-size:12px}.savo-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.savo-control{padding:18px;border:1px solid var(--hairline);border-radius:16px;background:#fff;display:flex;flex-direction:column;align-items:flex-start;gap:10px}.savo-control h3{margin:0;font-size:14px}.savo-control p{margin:0;color:var(--ink-3);font-size:12px;line-height:1.5;flex:1}.savo-state{padding:4px 9px;border-radius:20px;background:#f2f3f5;font-size:11px;font-weight:750}.savo-state[data-open=true]{background:#e5f7ef;color:#087a50}.savo-context{padding:12px 14px;background:#fff6df;border:1px solid #efd39a;border-radius:12px;font-size:12px;line-height:1.5;margin-bottom:12px}.savo-table-wrap{overflow:auto;margin-top:16px}.savo-table-wrap h3{font-size:14px}.savo-overlay{position:fixed;inset:0;z-index:150;background:#17202d66;display:grid;place-items:center;padding:16px}.savo-dialog{background:#fff;border-radius:20px;padding:24px;width:min(600px,100%);max-height:90vh;overflow:auto;box-sizing:border-box;color:var(--ink);box-shadow:0 24px 80px #0003}.savo-dialog h2{margin:0 0 8px;font-size:21px}.savo-dialog p{font-size:12px;color:var(--ink-3);line-height:1.5}.savo-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.savo-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700}.savo-field.wide{grid-column:1/-1}.savo-field input,.savo-field select,.savo-field textarea{width:100%;box-sizing:border-box;border:1px solid #d9dde3;border-radius:10px;padding:11px;font:inherit;background:#fff;color:var(--ink)}.savo-field textarea{min-height:85px;resize:vertical}.savo-buttons{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.savo-review{background:#f7f8fa;border-radius:12px;padding:14px;font-size:13px;line-height:1.7;overflow-wrap:anywhere}.savo-review dl{margin:0}.savo-review dt{color:var(--ink-3)}.savo-review dd{margin:0 0 9px;font-weight:700}.savo-control button{min-height:40px}.savo-dialog :focus-visible{outline:3px solid #ad1b52;outline-offset:2px}@media(max-width:900px){.savo-controls{grid-template-columns:1fr}.savo-fields{grid-template-columns:1fr}.savo-dialog{padding:18px}}`;

  function Dialog({ title, children, onClose, busy }) {
    const ref = React.useRef(null), opener = React.useRef(document.activeElement);
    React.useEffect(() => {
      const first = ref.current.querySelector('input,select,textarea,button'); if (first) first.focus();
      return () => { if (opener.current && opener.current.isConnected) opener.current.focus(); };
    }, []);
    function keys(event) {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const nodes = Array.from(ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'));
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    }
    return h('div', { className: 'savo-overlay' }, h('section', { ref, className: 'savo-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': title, onKeyDown: keys }, h('div', { className: 'savo-head' }, h('h2', null, title), h('button', { className: 'sava-button', type: 'button', disabled: busy, onClick: onClose, 'aria-label': 'Cerrar' }, 'Cerrar')), children));
  }

  function SavingsOperationsAdmin({ app, participantId, participants, periods, onSaved }) {
    const [data, setData] = React.useState(null), [phase, setPhase] = React.useState('loading');
    const [modal, setModal] = React.useState(null), [form, setForm] = React.useState({}), [review, setReview] = React.useState(null);
    const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [notice, setNotice] = React.useState('');
    const sequence = React.useRef(0), idempotency = React.useRef(null), submitting = React.useRef(false);
    const load = React.useCallback(async () => {
      const request = ++sequence.current; setData(null); setPhase('loading');
      try { const value = await window.SavingsRepository.getOperations(participantId); if (request === sequence.current) { setData(value); setPhase('ready'); } }
      catch (failure) { if (request === sequence.current) { setError(errorMessage(failure)); setPhase('error'); } }
    }, [participantId]);
    React.useEffect(() => { load(); return () => { sequence.current++; }; }, [load]);
    const canConfig = app.admin.has('savings.config'), canApprove = app.admin.has('savings.approve');
    const selected = (participants || []).find((p) => p.id === participantId);
    function open(kind, action, enabled) {
      setError(''); setNotice(''); setReview(null); idempotency.current = window.SavingsRepository.newIdempotencyKey();
      setForm({ kind, action, enabled, scope: 'GLOBAL', participant_id: participantId || '', mode: data.entry_mode,
        starts_at: '', ends_at: '', cutoff_on: '', percentage: '', opening_kind: 'ORDINARY', yield_period_id: '', reason: '', plan_id: '', authorized_date: '' });
      setModal(kind);
    }
    function edit(name, value) { setForm((current) => Object.assign({}, current, { [name]: value }, name === 'opening_kind' ? { percentage: value === 'EXCEPTION' ? '0' : '', ...(value === 'EXCEPTION' ? { scope: 'PARTICIPANT' } : {}) } : {})); setError(''); }
    function field(label, name, type, options) {
      const props = { name, value: form[name] == null ? '' : form[name], onChange: (e) => edit(name, e.target.value), required: !['starts_at','ends_at'].includes(name), disabled: name === 'percentage' && form.opening_kind === 'EXCEPTION' };
      return h('label', { className: 'savo-field' + (type === 'textarea' ? ' wide' : ''), key: name }, label,
        type === 'select' ? h('select', props, options.map(([value, text]) => h('option', { key: value, value }, text))) :
          type === 'textarea' ? h('textarea', Object.assign({ minLength: 3, maxLength: 1000 }, props)) :
            h('input', Object.assign({ type, ...(type === 'number' ? { min: 0, max: 100, step: '0.000001' } : {}) }, props)));
    }
    function prepare(event) {
      event.preventDefault(); setError('');
      try {
        const command = { kind: form.kind, reason: form.reason.trim() };
        if (command.reason.length < 3) throw Error('Motivo requerido');
        if (modal === 'ENTRY_MODE') command.mode = form.mode;
        else if (modal === 'DATE') Object.assign(command, { plan_id: form.plan_id, authorized_date: form.authorized_date });
        else {
          Object.assign(command, { scope: form.scope, participant_id: form.scope === 'PARTICIPANT' ? form.participant_id : null,
            starts_at: form.starts_at ? new Date(form.starts_at + ':00-07:00').toISOString() : null,
            ends_at: form.ends_at ? new Date(form.ends_at + ':00-07:00').toISOString() : null });
          if (form.scope === 'PARTICIPANT' && !form.participant_id) throw Error('Selecciona un ahorrador');
          if (modal === 'OPEN_WITHDRAWALS') {
            if (!form.ends_at || !form.cutoff_on || !form.yield_period_id || form.percentage === '') { setError('Indica cierre, fecha de corte, periodo y porcentaje.'); return; }
            Object.assign(command, { cutoff_on: form.cutoff_on, percentage: Number(form.percentage), opening_kind: form.opening_kind, yield_period_id: form.yield_period_id });
          } else Object.assign(command, { action: form.action, enabled: form.enabled });
        }
        setReview(command);
      } catch (failure) { setError('Revisa los campos obligatorios y las fechas.'); }
    }
    async function save() {
      if (submitting.current) return; submitting.current = true; setBusy(true); setError('');
      try {
        if (modal === 'DATE') await window.SavingsRepository.authorizeDate(review.plan_id, review.authorized_date, review.reason, idempotency.current);
        else await window.SavingsRepository.configureOperation(review, idempotency.current);
        setModal(null); setReview(null); setNotice('Operación registrada con responsable, fecha, hora y justificación.');
        await load(); if (onSaved) await onSaved();
      } catch (failure) { setError(errorMessage(failure)); }
      finally { submitting.current = false; setBusy(false); }
    }
    function table(title, columns, rows) {
      return h('section', { className: 'savo-table-wrap' }, h('h3', null, title), rows.length ? h('table', { className: 'sava-table' }, h('thead', null, h('tr', null, columns.map(([key, text]) => h('th', { key }, text)))), h('tbody', null, rows.map((row, i) => h('tr', { key: row.id || row.request_id || i }, columns.map(([key, text, render]) => h('td', { key }, render ? render(row[key], row) : String(row[key] == null ? '—' : row[key]))))))) : h('p', { className: 'sav-empty-copy' }, 'Aún no hay registros.'));
    }
    if (phase !== 'ready') return h('section', { className: 'savo', 'data-savings-operations-phase': phase }, h('style', null, CSS), phase === 'error' ? h('div', { className: 'sava-error', role: 'alert' }, error, h('button', { className: 'sava-button', onClick: load }, 'Reintentar')) : h('p', { role: 'status' }, 'Consultando controles de Ahorro…'));
    const title = modal === 'ENTRY_MODE' ? 'Disponibilidad de nuevos ingresos' : modal === 'DATE' ? 'Autorizar otra fecha' : modal === 'OPEN_WITHDRAWALS' ? 'Abrir retiros de ahorro' : (form.enabled ? 'Habilitar ' : 'Cerrar ') + (labels[form.action] || '').toLowerCase();
    return h('section', { className: 'savo', 'data-savings-operations-phase': 'ready' }, h('style', null, CSS),
      h('div', { className: 'savo-head' }, h('div', null, h('h2', null, 'Control del programa'), h('p', null, selected ? 'Disponibilidad efectiva para Folio ' + selected.legacy_folio + '. Los cambios generales se eligen expresamente.' : 'Disponibilidad general y excepciones por ahorrador.')), h('button', { className: 'sava-button', onClick: load }, 'Actualizar controles')),
      h('div', { className: 'savo-context' }, 'Las aperturas y las fechas se registran en Supabase. ', data.historical_certification_pending, ' cuentas requieren certificación financiera. Los retiros no pueden pagarse hasta conectar y verificar los adeudos de préstamos. Configurar una apertura no acredita rendimientos ni certifica saldos.'),
      notice && h('div', { className: 'sava-success', role: 'status' }, notice),
      h('div', { className: 'savo-controls' }, ['JOIN','WITHDRAW','CHANGE_AMOUNT','TERMINATE'].map((action) => h('article', { className: 'savo-control', key: action }, h('h3', null, labels[action]), h('span', { className: 'savo-state', 'data-open': data.effective[action] }, data.effective[action] ? 'Habilitado' : 'Cerrado'), h('p', null, action === 'JOIN' ? (data.entry_mode === 'ALL_YEAR' ? 'Ingreso permitido durante todo el año, sujeto a las excepciones registradas.' : 'Ingreso únicamente en las ventanas autorizadas.') : action === 'WITHDRAW' ? 'Aperturas ordinarias, anticipadas o individuales. Cada apertura conserva corte, porcentaje y motivo.' : action === 'TERMINATE' ? 'Disponibilidad para solicitar dejar de aportar. La baja y la entrega del dinero requieren resoluciones separadas.' : 'Permisos generales o individuales. Los cambios aceptados conservan su fecha aunque se cierre esta opción.'), canConfig && h('div', { className: 'sava-actions' }, action === 'JOIN' && h('button', { className: 'sava-button', onClick: () => open('ENTRY_MODE') }, 'Cambiar modalidad'), h('button', { className: 'sava-button is-primary', onClick: () => open(action === 'WITHDRAW' ? 'OPEN_WITHDRAWALS' : 'AVAILABILITY', action, true) }, action === 'WITHDRAW' ? 'Abrir retiros' : 'Habilitar ventana'), h('button', { className: 'sava-button', onClick: () => open('AVAILABILITY', action, false) }, 'Cerrar opción'))))),
      selected && canApprove && h('div', { className: 'savo-head', style: { marginTop: 16 } }, h('p', null, 'Las excepciones de fecha actualizan el calendario futuro y conservan la fecha calculada.'), h('button', { className: 'sava-button', disabled: !(data.plans || []).length, onClick: () => open('DATE') }, 'Autorizar otra fecha')),
      table('Aperturas registradas', [['opening_kind','Tipo', (v) => labels[v]],['starts_at','Inicio',date],['ends_at','Cierre',date],['cutoff_on','Corte',date],['percentage','Rendimiento', (v) => v + '%'],['reason','Justificación'],['created_at','Registrada',date],['actor_real_auth_user_id','Responsable']], data.openings || []),
      table('Excepciones de fecha', [['calculated_date','Calculada',date],['previous_date','Anterior',date],['authorized_date','Autorizada',date],['reason','Justificación'],['created_at','Registrada',date],['actor_real_auth_user_id','Responsable']], data.date_authorizations || []),
      table('Capital y rendimiento entregados', [['legacy_folio','Folio'],['paid_at','Pago',date],['capital_paid','Capital',money],['yield_paid','Rendimiento',money],['total_paid','Total',money]], data.payments || []),
      modal && h(Dialog, { title, busy, onClose: () => setModal(null) },
        error && h('div', { className: 'sava-error', role: 'alert' }, error),
        review ? h(React.Fragment, null, h('p', null, 'Revisa el alcance antes de confirmar. Las horas corresponden a Hermosillo.'), h('div', { className: 'savo-review' }, h('dl', null,
          h('dt', null, 'Alcance'), h('dd', null, review.kind === 'ENTRY_MODE' ? 'Todos los nuevos ingresos' : review.kind === 'DATE' ? 'Plan del ahorrador seleccionado' : review.scope === 'GLOBAL' ? 'Todos los ahorradores' : 'Folio ' + ((participants || []).find((p) => p.id === review.participant_id) || {}).legacy_folio),
          review.mode && h(React.Fragment, null, h('dt', null, 'Modalidad'), h('dd', null, review.mode === 'ALL_YEAR' ? 'Todo el año' : 'Sólo ventanas')),
          review.authorized_date && h(React.Fragment, null, h('dt', null, 'Fecha autorizada'), h('dd', null, date(review.authorized_date))),
          review.kind !== 'ENTRY_MODE' && review.kind !== 'DATE' && h(React.Fragment, null, h('dt', null, 'Vigencia'), h('dd', null, (review.starts_at ? date(review.starts_at) : 'Desde la confirmación') + ' → ' + date(review.ends_at))),
          review.percentage != null && h(React.Fragment, null, h('dt', null, 'Rendimiento y corte'), h('dd', null, review.percentage + '% · ' + date(review.cutoff_on))),
          h('dt', null, 'Justificación'), h('dd', null, review.reason))), h('div', { className: 'savo-buttons' }, h('button', { className: 'sava-button', disabled: busy, onClick: () => { idempotency.current = window.SavingsRepository.newIdempotencyKey(); setReview(null); } }, 'Corregir'), h('button', { className: 'sava-button is-primary', disabled: busy, onClick: save }, busy ? 'Registrando…' : 'Confirmar y registrar')))
        : h('form', { onSubmit: prepare }, h('p', null, modal === 'DATE' ? 'Una excepción requiere fecha futura válida y motivo. No modifica movimientos ya registrados.' : 'Esta decisión no cancela solicitudes ya aceptadas. Selecciona expresamente a quién aplica.'), h('div', { className: 'savo-fields' },
          modal === 'ENTRY_MODE' ? field('Modalidad de ingreso', 'mode', 'select', [['ALL_YEAR','Todo el año'],['WINDOWS','Sólo en fechas establecidas']]) : modal === 'DATE' ? h(React.Fragment, null, field('Plan a modificar','plan_id','select',[['','Selecciona un plan']].concat((data.plans || []).map((p) => [p.id,money(p.amount) + ' desde ' + date(p.effective_from)]))), field('Fecha autorizada','authorized_date','date')) : h(React.Fragment, null,
            field('Aplicar a','scope','select',[['GLOBAL','Todos los ahorradores'],['PARTICIPANT','Sólo un ahorrador']]),
            form.scope === 'PARTICIPANT' && field('Ahorrador','participant_id','select',[['','Selecciona un ahorrador']].concat((participants || []).map((p) => [p.id,(p.legacy_folio || 'Sin folio') + ' · ' + (p.display_name || p.identity_status)]))),
            field('Inicio · vacío = ahora','starts_at','datetime-local'),field('Cierre · hora Hermosillo','ends_at','datetime-local'),
            modal === 'OPEN_WITHDRAWALS' && h(React.Fragment, null, field('Tipo de apertura','opening_kind','select',[['ORDINARY','Ordinaria'],['EARLY','Anticipada con justificación'],['EXCEPTION','Individual especial']]),field('Periodo','yield_period_id','select',[['','Selecciona un periodo']].concat((periods || []).map((p) => [p.id,p.period_year + ' · semestre ' + p.semester]))),field('Ahorro acumulado al','cutoff_on','date'),field('Rendimiento ganado (%)','percentage','number'))),
          field('Justificación obligatoria','reason','textarea')), h('div', { className: 'savo-buttons' }, h('button', { className: 'sava-button', type: 'button', onClick: () => setModal(null) }, 'Cancelar'), h('button', { className: 'sava-button is-primary', type: 'submit' }, 'Revisar decisión')))));
  }
  window.SavingsOperationsAdmin = SavingsOperationsAdmin;
  window.SavingsOperationError = errorMessage;
})();
