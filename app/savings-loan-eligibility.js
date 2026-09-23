/* Caja de Ahorro access: one backend policy, audited one-request exceptions. */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useRef, useEffect } = React;
  async function rpc(name, args) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    if (!data || typeof data !== 'object') throw Error('INVALID_RESPONSE');
    return data;
  }
  const repository = Object.freeze({
    read: async (control) => {
      const data = await rpc('get_admin_savings_loan_access', { p_numero_control: control || null });
      if (!data.policy || !Array.isArray(data.history) || typeof data.can_configure !== 'boolean' || typeof data.can_authorize !== 'boolean' ||
          (data.person && (!data.eligibility || typeof data.eligibility.eligible !== 'boolean'))) throw Error('INVALID_RESPONSE');
      return data;
    },
    policy: (c) => rpc('set_admin_savings_loan_policy', { p_months: c.months, p_starts_from: c.basis, p_expected_version: c.version, p_reason: c.reason, p_client_action_id: c.key }),
    authorize: (c) => rpc('set_admin_savings_loan_authorization', { p_affiliate_id: c.affiliate, p_action: c.action, p_authorization_id: c.authorization || null, p_reason: c.reason, p_client_action_id: c.key }),
  });
  window.SavingsLoanEligibilityRepository = repository;
  const reasons = {
    NOT_ACTIVE_SAVER: 'No tiene una inscripción de ahorro activa.',
    NO_ACTUAL_DEDUCTION: 'Todavía no tiene un descuento de ahorro registrado.',
    POLICY_NOT_CONFIGURED: 'Falta configurar la antigüedad mínima.',
    MINIMUM_TENURE: 'Todavía no cumple la antigüedad mínima.',
    ELIGIBLE: 'Cumple la regla general de ahorro.',
  };
  function errorLabel(error) {
    const code = String(error && error.message || '');
    if (code.includes('CONTROL_NOT_UNIQUE_OR_MISSING')) return 'No se encontró un afiliado activo único con ese número de control.';
    if (code.includes('POLICY_STALE')) return 'La regla cambió mientras la editabas. Actualiza y vuelve a revisar.';
    if (code.includes('NOT_ACTIVE') || code.includes('23505') || code.includes('one_open_authorization')) return 'La autorización cambió o ya existe una vigente. Actualiza la consulta.';
    if (code.includes('DENIED') || code.includes('42501')) return 'No tienes permiso para realizar esta acción.';
    return 'No se pudo confirmar la operación. Consulta de nuevo o reintenta; no se ha supuesto ningún resultado.';
  }
  const panel = { background: 'var(--surface)', borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: 'var(--neo-sm)' };
  const field = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit', marginTop: 5 };
  const button = { border: 0, borderRadius: 10, padding: '10px 14px', background: 'var(--guinda)', color: '#fff', font: 'inherit', fontWeight: 750, cursor: 'pointer', marginTop: 10 };
  function SavingsLoanAccessAdmin({ app }) {
    const canRead = !!(app && app.admin && (app.admin.has('financial_rules.read') || app.admin.has('financial_rules.write') || (app.admin.has('program_requests.write') && app.admin.has('workflow.write'))));
    const [open, setOpen] = useState(false), [data, setData] = useState(null), [busy, setBusy] = useState(false);
    const [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [months, setMonths] = useState(''), [basis, setBasis] = useState(''), [policyReason, setPolicyReason] = useState('');
    const [control, setControl] = useState(''), [reason, setReason] = useState('');
    const request = useRef(0), pending = useRef(null), mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; request.current++; }, []);
    async function load(target) {
      const token = ++request.current;
      setBusy(true); setError(''); setData(null);
      try {
        const result = await repository.read(target);
        if (!mounted.current || token !== request.current) return;
        setData(result); setMonths(result.policy.minimum_months == null ? '' : String(result.policy.minimum_months)); setBasis(result.policy.starts_from || '');
      } catch (e) { if (mounted.current && token === request.current) setError(errorLabel(e)); }
      finally { if (mounted.current && token === request.current) setBusy(false); }
    }
    async function save(kind, command) {
      if (busy) return;
      const fingerprint = JSON.stringify({ kind, command });
      if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true); setError(''); setNotice('');
      try {
        await repository[kind]({ ...command, key: pending.current.key });
        pending.current = null;
        if (!mounted.current) return;
        setPolicyReason(''); setReason('');
        await load(data && data.person ? data.person.numero_control : null);
        setNotice(kind === 'policy' ? 'Regla guardada y registrada.' : command.action === 'GRANT' ? 'Autorización registrada para una sola solicitud.' : 'Autorización revocada.');
      } catch (e) { if (mounted.current) { setError(errorLabel(e)); setBusy(false); } }
    }
    if (!canRead) return null;
    const eligibility = data && data.eligibility;
    const validMonths = /^\d+$/.test(months) && Number.isSafeInteger(Number(months)) && Number(months) <= 2147483647;
    const label = (text, node) => h('label', { style: { display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 } }, text, node);
    return h('section', { style: panel, 'data-savings-loan-admin': 'true' },
      h('button', { type: 'button', 'aria-expanded': open, onClick: () => { setOpen(!open); if (!open) { setNotice(''); load(null); } }, style: { border: 0, padding: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontWeight: 850, cursor: 'pointer' } }, 'Caja de Ahorro · requisitos y autorizaciones ', open ? '▴' : '▾'),
      open && h('div', null,
        h('p', { style: { fontSize: 12, color: 'var(--ink-3)' } }, 'El fondo sólo se suma al préstamo disponible cuando la persona cumple la regla o tiene una autorización especial vigente. Los demás requisitos del préstamo siguen aplicando.'),
        busy && h('p', { role: 'status' }, 'Consultando…'),
        error && h('div', { role: 'alert', style: { color: '#9A1737' } }, error, h('button', { type: 'button', disabled: busy, onClick: () => load(control.trim() || null), style: button }, 'Actualizar consulta')),
        notice && h('p', { role: 'status', style: { color: '#087A50' } }, notice),
        data && h('div', null,
          h('h3', { style: { fontSize: 15 } }, 'Regla general'),
          data.policy.minimum_months == null && h('p', { role: 'status' }, 'Sin configurar: Caja de Ahorro requiere una autorización especial hasta guardar la regla.'),
          h('form', { onSubmit: (e) => { e.preventDefault(); if (validMonths && basis && policyReason.trim().length >= 8) save('policy', { months: Number(months), basis, version: data.policy.version, reason: policyReason.trim() }); } },
            label('Meses mínimos ahorrando', h('input', { type: 'number', min: 0, step: 1, required: true, value: months, disabled: busy || !data.can_configure, onChange: (e) => setMonths(e.target.value), style: field })),
            label('Contar desde', h('select', { required: true, value: basis, disabled: busy || !data.can_configure, onChange: (e) => setBasis(e.target.value), style: field }, h('option', { value: '', disabled: true }, 'Selecciona el inicio'), h('option', { value: 'ENROLLMENT' }, 'Fecha de inscripción al ahorro'), h('option', { value: 'FIRST_DEDUCTION' }, 'Primer descuento registrado'))),
            h('p', { style: { fontSize: 12 } }, 'Meses calendario completos. Con cero meses desde la inscripción, basta tener el ingreso aprobado y el ahorro activo; no se exige un primer descuento. Si cuentas desde el primer descuento, debe estar registrado.'),
            data.can_configure && h(React.Fragment, null, label('Motivo del cambio de regla', h('textarea', { value: policyReason, minLength: 8, maxLength: 1000, required: true, disabled: busy, onChange: (e) => setPolicyReason(e.target.value), style: field })), h('button', { type: 'submit', disabled: busy || !validMonths || !basis || policyReason.trim().length < 8, style: button }, 'Guardar regla'))),
          h('h3', { style: { fontSize: 15, marginTop: 22 } }, 'Autorización especial para una persona'),
          h('form', { onSubmit: (e) => { e.preventDefault(); setNotice(''); setReason(''); load(control.trim()); } },
            label('Número de control exacto', h('input', { value: control, required: true, disabled: busy, onChange: (e) => { setControl(e.target.value); setData((v) => v ? { ...v, person: null, eligibility: null, history: [] } : v); setReason(''); }, style: field })),
            h('button', { type: 'submit', disabled: busy || !control.trim(), style: button }, 'Consultar persona')),
          data.person && h('div', { 'data-savings-loan-person': data.person.id, style: { borderTop: '1px solid var(--hairline)', marginTop: 14, paddingTop: 10 } },
            h('strong', null, data.person.name, ' · Control ', data.person.numero_control),
            h('p', null, reasons[eligibility.reason] || 'Estado no reconocido.'),
            h('p', null, 'Inscripción: ', eligibility.enrollment_date || 'Sin registro', ' · Primer descuento: ', eligibility.first_deduction_date || 'Sin registro'),
            eligibility.eligible_on && h('p', null, 'Cumple la antigüedad el ', eligibility.eligible_on),
            eligibility.active_authorization_id && h('p', { style: { color: '#087A50' } }, 'Tiene autorización especial para una solicitud; todavía no se ha utilizado.'),
            data.can_authorize && h('form', { onSubmit: (e) => { e.preventDefault(); if (reason.trim().length >= 8) save('authorize', { affiliate: data.person.id, action: eligibility.active_authorization_id ? 'REVOKE' : 'GRANT', authorization: eligibility.active_authorization_id, reason: reason.trim() }); } },
              h('p', { style: { fontSize: 12 } }, 'La excepción permite solicitar sin ahorro activo, sin descuentos o sin antigüedad suficiente. Se consume al enviar una solicitud y puede revocarse antes de su uso.'),
              label('Motivo de la autorización o revocación', h('textarea', { required: true, minLength: 8, maxLength: 1000, value: reason, disabled: busy, onChange: (e) => setReason(e.target.value), style: field })),
              h('button', { type: 'submit', disabled: busy || reason.trim().length < 8 || (eligibility.ordinary_eligible && !eligibility.active_authorization_id), style: button }, eligibility.active_authorization_id ? 'Revocar autorización' : 'Autorizar una solicitud'))),
          h('h3', { style: { fontSize: 15, marginTop: 22 } }, 'Registro de decisiones'),
          !data.history.length ? h('p', null, 'Sin decisiones registradas para esta consulta.') : h('ol', { style: { paddingLeft: 20, fontSize: 12 } }, data.history.map((event, index) => h('li', { key: index, style: { marginBottom: 12, overflowWrap: 'anywhere' } },
            h('strong', null, ({ POLICY: 'Cambio de regla', GRANT: 'Autorización', REVOKE: 'Revocación', USE: 'Uso en solicitud' })[event.action]),
            h('div', null, new Date(event.created_at).toLocaleString('es-MX'), ' · Responsable: ', event.actor_label),
            h('div', null, event.reason), event.request_id && h('div', null, 'Solicitud: ', event.request_id)))))));
  }
  window.SavingsLoanAccessAdmin = SavingsLoanAccessAdmin;
})();
