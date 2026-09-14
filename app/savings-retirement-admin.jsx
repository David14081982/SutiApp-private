/* Audited category/calendar transition. Amounts and preview come from the RPC. */
(function () {
  'use strict';
  const h = React.createElement;
  const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const date = value => value ? new Date(value.length === 10 ? value + 'T12:00:00-07:00' : value).toLocaleDateString('es-MX', { timeZone: 'America/Hermosillo', dateStyle: 'medium' }) : '—';
  const processLabel = value => ({ JUB: 'Jubilados y pensionados · JUB', PROCESS_1: 'Base, eventuales y suplentes fijos · 1', PROCESS_3: 'Suplentes variables · 3' }[value] || value || 'Por confirmar');
  const frequency = value => value === 'MONTHLY' ? 'mensuales' : 'quincenales';
  function errorMessage(error) {
    const raw = String(error && error.message || '');
    for (const [code, message] of [
      ['SAVINGS_PREVIEW_STALE', 'El plan cambió después de la revisión. Vuelve a revisar los importes antes de confirmar.'],
      ['SAVINGS_FUTURE_PLAN_REVIEW_REQUIRED', 'Existe un plan futuro ya aceptado. Debe conciliarse con el cambio de categoría; no se cancelará automáticamente.'],
      ['SAVINGS_DATE_HAS_RECORDED_MOVEMENTS', 'La fecha afectaría descuentos ya registrados. Esos movimientos deben conservarse.'],
      ['SAVINGS_ACCOUNT_CERTIFICATION_REQUIRED', 'La cuenta necesita certificación antes de aplicar cambios operativos.'],
      ['SAVINGS_ACTIVE_CERTIFIED_ENROLLMENT_REQUIRED', 'Falta una inscripción activa y certificada para aplicar este cambio.'],
      ['SAVINGS_PROCESS_FUTURE_DATE_REQUIRED', 'Selecciona una fecha de vigencia futura.'],
      ['SAVINGS_PROCESS_ALREADY_EFFECTIVE', 'El plan ya utiliza esa modalidad. Revisa la categoría seleccionada.'],
      ['SAVINGS_REVERSE_FREQUENCY_RULE_REQUIRED', 'El cambio de mensual a quincenal requiere definir su regla de conversión.'],
      ['SAVINGS_IDEMPOTENCY_CONFLICT', 'Esta confirmación ya se registró con otros datos. Actualiza la consulta.'],
    ]) if (raw.includes(code)) return message;
    if (/42501|DENIED/.test(raw)) return 'No tienes permiso para realizar esta operación.';
    return 'No se pudo completar la operación. Los datos siguen disponibles para revisar y reintentar.';
  }
  const CSS = '.savrt-note{padding:12px 14px;border-radius:12px;background:#fff6df;font-size:12px;line-height:1.5;margin-bottom:14px}.savrt-overlay{position:fixed;inset:0;z-index:155;background:#17202d66;display:grid;place-items:center;padding:16px}.savrt-dialog{background:#fff;color:var(--ink,#17171c);border-radius:20px;padding:24px;width:min(580px,100%);max-height:90vh;overflow:auto;box-sizing:border-box}.savrt-dialog h2{font-size:20px;margin:0}.savrt-dialog p{font-size:13px;line-height:1.5}.savrt-fields{display:grid;gap:12px;margin:18px 0}.savrt-fields label{display:grid;gap:6px;font-size:12px;font-weight:700}.savrt-fields input,.savrt-fields textarea{box-sizing:border-box;width:100%;border:1px solid #d9dde3;border-radius:10px;padding:11px;font:inherit}.savrt-fields textarea{min-height:80px}.savrt-review{padding:15px;border-radius:12px;background:#f6f7fa;font-size:13px;line-height:1.6}.savrt-review dt{color:#777}.savrt-review dd{margin:0 0 10px;font-weight:700}.savrt-dialog :focus-visible{outline:3px solid #98143f;outline-offset:2px}@media(max-width:600px){.savrt-dialog{padding:18px}}';
  function Modal({ busy, onClose, children }) {
    const element = React.useRef(null), opener = React.useRef(document.activeElement);
    React.useEffect(() => { element.current.querySelector('button').focus(); return () => { if (opener.current && opener.current.isConnected) opener.current.focus(); }; }, []);
    function keyboard(event) {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const nodes = Array.from(element.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)'));
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    }
    return h('div', { className: 'savrt-overlay' }, h('section', { ref: element, role: 'dialog', 'aria-modal': true, 'aria-label': 'Cambio de categoría y descuentos', className: 'savrt-dialog', onKeyDown: keyboard },
      h('div', { className: 'sava-panel-head' }, h('h2', null, 'Cambio de categoría y descuentos'), h('button', { type: 'button', className: 'sava-button', disabled: busy, onClick: onClose, 'aria-label': 'Cerrar' }, 'Cerrar')), children));
  }
  function SavingsRetirementAdmin({ app, selected, rows, onSaved }) {
    const [process, setProcess] = React.useState('JUB'), [recordReason, setRecordReason] = React.useState('');
    const [target, setTarget] = React.useState(null), [decision, setDecision] = React.useState('APPLY');
    const [effective, setEffective] = React.useState(''), [reason, setReason] = React.useState(''), [preview, setPreview] = React.useState(null);
    const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [notice, setNotice] = React.useState('');
    const key = React.useRef(null), sending = React.useRef(false);
    async function perform(task, message) {
      if (sending.current) return; sending.current = true; setBusy(true); setError('');
      try { await task(); setTarget(null); setNotice(message); if (onSaved) await onSaved(); }
      catch (failure) { setError(errorMessage(failure)); }
      finally { sending.current = false; setBusy(false); }
    }
    function open(row, action) { setTarget(row); setDecision(action); setEffective(''); setReason(''); setPreview(null); setError(''); setNotice(''); key.current = window.SavingsRepository.newIdempotencyKey(); }
    async function review(event) {
      event.preventDefault(); setError('');
      if (reason.trim().length < 3) return;
      if (decision === 'DISMISS') { setPreview({ dismissed: true }); return; }
      setBusy(true);
      try { setPreview(await window.SavingsRepository.previewProcessTransition(target.id, effective)); }
      catch (failure) { setError(errorMessage(failure)); }
      finally { setBusy(false); }
    }
    function confirm() {
      return perform(() => decision === 'DISMISS' ? window.SavingsRepository.reviewProcessChange({ eventId: target.id, decision, reason: reason.trim() }) :
        window.SavingsRepository.confirmProcessTransition({ eventId: target.id, effectiveFrom: effective, reason: reason.trim(), planFingerprint: preview.plan_fingerprint, clientActionId: key.current }),
      decision === 'DISMISS' ? 'Revisión registrada; el plan conserva su calendario.' : 'Cambio registrado con importe, fecha de vigencia y primer descuento.');
    }
    return h('section', { 'data-savings-retirement-admin': '' }, h('style', null, CSS),
      h('div', { className: 'savrt-note' }, 'Al pasar de quincenal a jubilado, dos aportaciones se integran en una mensual: $500 + $500 = $1,000 el día 5. La fecha de vigencia conserva el calendario anterior y determina el primer descuento mensual.'),
      !target && error && h('div', { role: 'alert', className: 'sava-error' }, error), notice && h('div', { role: 'status', className: 'sava-success' }, notice),
      selected && app.admin.has('savings.write') && app.admin.has('affiliates.write') && h('form', { className: 'sava-form', onSubmit: event => { event.preventDefault(); perform(() => window.SavingsRepository.recordProcessChange(selected.id, process, recordReason.trim()), 'Cambio registrado para revisión. El calendario aún no se modifica.'); } },
        h('label', { className: 'sava-field' }, 'Nueva categoría de descuento', h('select', { className: 'sava-select', value: process, onChange: e => setProcess(e.target.value), disabled: busy }, ['JUB','PROCESS_1','PROCESS_3'].map(value => h('option', { value, key: value }, processLabel(value))))),
        h('label', { className: 'sava-field' }, 'Motivo del cambio', h('input', { className: 'sava-input', value: recordReason, onChange: e => setRecordReason(e.target.value), required: true, minLength: 3, maxLength: 1000, disabled: busy })),
        h('button', { type: 'submit', className: 'sava-button is-primary', disabled: busy || recordReason.trim().length < 3 }, 'Registrar para revisión')),
      (rows || []).length ? h('div', { style: { overflowX: 'auto' } }, h('table', { className: 'sava-table' },
        h('thead', null, h('tr', null, ['Folio','Cambio','Importes aprobados','Vigencia / primer descuento','Estado','Motivo','Revisión'].map(label => h('th', { key: label }, label)))),
        h('tbody', null, rows.map(row => h('tr', { key: row.id }, h('td', null, row.legacy_folio), h('td', null, processLabel(row.old_process), ' → ', processLabel(row.new_process)),
          h('td', null, row.conversion_snapshot && row.status === 'APPLIED' ? money(row.conversion_snapshot.previous_amount) + ' ' + frequency(row.conversion_snapshot.previous_frequency) + ' → ' + money(row.conversion_snapshot.new_amount) + ' ' + frequency(row.conversion_snapshot.new_frequency) : 'Pendiente de revisión'),
          h('td', null, date(row.effective_from), h('br'), date(row.conversion_snapshot && row.conversion_snapshot.first_discount_on)),
          h('td', null, ({ APPLIED: 'Aplicado', DISMISSED: 'Descartado', NO_ACTIVE_ENROLLMENT: 'Sin inscripción activa', SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED: 'Por revisar' })[row.status] || row.status),
          h('td', null, row.reason, row.conversion_snapshot && h('p', null, row.conversion_snapshot.review_reason)),
          h('td', null, row.status === 'SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED' && app.admin.has('savings.approve') ? h('div', { className: 'sava-actions' },
            h('button', { className: 'sava-button is-primary', disabled: busy, onClick: () => open(row, 'APPLY') }, 'Revisar y aplicar'),
            h('button', { className: 'sava-button', disabled: busy, onClick: () => open(row, 'DISMISS') }, 'Descartar')) : date(row.reviewed_at))))))) : h('p', { className: 'sav-empty-copy' }, 'Aún no hay cambios de categoría para revisar.'),
      target && h(Modal, { busy, onClose: () => setTarget(null) }, h('p', null, 'Folio ', target.legacy_folio, ' · ', processLabel(target.old_process), ' → ', processLabel(target.new_process)),
        error && h('div', { role: 'alert', className: 'sava-error' }, error),
        preview ? h(React.Fragment, null, h('dl', { className: 'savrt-review' }, preview.dismissed ? h(React.Fragment, null, h('dt', null, 'Decisión'), h('dd', null, 'Descartar el impacto sobre el plan')) : h(React.Fragment, null,
          h('dt', null, 'Aportación anterior'), h('dd', null, money(preview.previous_amount), ' ', frequency(preview.previous_frequency)),
          h('dt', null, 'Nueva aportación'), h('dd', null, money(preview.new_amount), ' ', frequency(preview.new_frequency)),
          h('dt', null, 'Cambio vigente desde'), h('dd', null, date(preview.effective_from)),
          h('dt', null, 'Último descuento previsto con el calendario anterior'), h('dd', null, date(preview.last_previous_discount_on)),
          h('dt', null, 'Primer descuento con el nuevo calendario'), h('dd', null, date(preview.first_discount_on))),
          h('dt', null, 'Justificación'), h('dd', null, reason)),
          h('div', { className: 'sava-actions' }, h('button', { className: 'sava-button', disabled: busy, onClick: () => { setPreview(null); setError(''); key.current = window.SavingsRepository.newIdempotencyKey(); } }, 'Corregir'),
            h('button', { className: 'sava-button is-primary', disabled: busy, onClick: confirm }, busy ? 'Registrando…' : 'Confirmar cambio')))
          : h('form', { onSubmit: review }, h('div', { className: 'savrt-fields' }, decision === 'APPLY' && h('label', null, 'Fecha de vigencia', h('input', { type: 'date', value: effective, onChange: e => setEffective(e.target.value), required: true, disabled: busy })),
            h('label', null, 'Justificación de la revisión', h('textarea', { value: reason, onChange: e => setReason(e.target.value), required: true, minLength: 3, maxLength: 1000, disabled: busy }))),
            h('div', { className: 'sava-actions' }, h('button', { className: 'sava-button is-primary', type: 'submit', disabled: busy }, busy ? 'Consultando…' : 'Revisar decisión')))));
  }
  window.SavingsRetirementAdmin = SavingsRetirementAdmin;
})();
