/* Loan debt-reduction exceptions. Backend owns permissions, versions and audit. */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useRef, useEffect } = React;
  function assertResponse(data) {
    const version = (value) => Number.isInteger(value) && value >= 0;
    if (!data || !data.policy || typeof data.policy.allow_full !== 'boolean' || !version(data.policy.version) ||
        typeof data.can_configure !== 'boolean' || typeof data.can_authorize !== 'boolean' ||
        !Array.isArray(data.funds) || !Array.isArray(data.history) ||
        (data.person && (!data.person.id || typeof data.person.numero_control !== 'string' || typeof data.person.name !== 'string')) ||
        !data.funds.every((fund) => fund && typeof fund.id === 'string' && typeof fund.label === 'string' &&
          typeof fund.allow_full === 'boolean' && version(fund.version))) throw Error('LOAN_CAPACITY_INVALID_RESPONSE');
    return data;
  }
  async function rpc(name, args) {
    const client = window.SutiSupabase && window.SutiSupabase.getClient();
    if (!client) throw Error('SUPABASE_NOT_CONFIGURED');
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return assertResponse(data);
  }
  const repository = Object.freeze({
    read: (control) => rpc('get_admin_loan_capacity', { p_numero_control: control || null }),
    setGlobal: (value) => rpc('set_admin_loan_capacity_policy', {
      p_allow_full: value.allowFull, p_expected_version: value.version,
      p_reason: value.reason, p_client_action_id: value.key,
    }),
    setIndividual: (value) => rpc('set_admin_loan_capacity_override', {
      p_affiliate_id: value.affiliate, p_fund_id: value.fund, p_allow_full: value.allowFull,
      p_expected_version: value.version, p_reason: value.reason, p_client_action_id: value.key,
    }),
  });
  window.LoanAvailabilityRepository = repository;
  function errorLabel(error) {
    const code = String(error && error.message || '');
    if (/CONTROL_NOT_UNIQUE_OR_MISSING/.test(code)) return 'No se encontró un afiliado activo único con ese número de control.';
    if (/STALE/.test(code)) return 'La configuración cambió mientras la editabas. Actualiza la consulta antes de guardar.';
    if (/DENIED|42501/.test(code)) return 'No tienes permiso para realizar esta acción.';
    if (/REASON/.test(code)) return 'Escribe el motivo de esta autorización o revocación.';
    return 'No se pudo confirmar la operación. Actualiza la consulta o reintenta; no se ha supuesto ningún cambio.';
  }
  const panel = { background: 'var(--surface)', borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: 'var(--neo-sm)' };
  const field = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid var(--hairline)', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit', marginTop: 5 };
  const button = { border: 0, borderRadius: 10, padding: '10px 14px', background: 'var(--guinda)', color: '#fff', font: 'inherit', fontWeight: 750, cursor: 'pointer', marginTop: 10 };
  const note = { fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 };
  const label = (text, node) => h('label', { style: { display: 'block', fontSize: 13, fontWeight: 700, marginTop: 10 } }, text, node);
  function LoanAvailabilityAdmin({ app }) {
    const canRead = !!(app && app.admin && (app.admin.has('financial_rules.read') || app.admin.has('financial_rules.write')));
    const [open, setOpen] = useState(false), [data, setData] = useState(null), [busy, setBusy] = useState(false);
    const [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [globalFull, setGlobalFull] = useState(false), [globalReason, setGlobalReason] = useState('');
    const [control, setControl] = useState(''), [fundId, setFundId] = useState('');
    const [individualFull, setIndividualFull] = useState(false), [individualReason, setIndividualReason] = useState('');
    const sequence = useRef(0), pending = useRef(null), mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; sequence.current++; }, []);
    const selectedFund = data && data.funds.find((fund) => fund.id === fundId);
    function accept(result, preferredFund) {
      setData(result); setGlobalFull(result.policy.allow_full);
      const fund = result.funds.find((item) => item.id === preferredFund) || result.funds[0];
      setFundId(fund ? fund.id : ''); setIndividualFull(fund ? fund.allow_full : false);
    }
    async function load(target) {
      const token = ++sequence.current;
      setBusy(true); setError(''); setData(null);
      try {
        const result = await repository.read(target);
        if (mounted.current && token === sequence.current) accept(result, fundId);
      } catch (failure) { if (mounted.current && token === sequence.current) setError(errorLabel(failure)); }
      finally { if (mounted.current && token === sequence.current) setBusy(false); }
    }
    async function save(kind, command) {
      if (busy) return;
      const fingerprint = JSON.stringify({ kind, command });
      if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true); setError(''); setNotice('');
      try {
        const result = await repository[kind]({ ...command, key: pending.current.key });
        pending.current = null;
        window.dispatchEvent(new Event('suti:loan-capacity-changed'));
        if (!mounted.current) return;
        accept(result, command.fund); setGlobalReason(''); setIndividualReason('');
        setNotice(kind === 'setGlobal' ? (command.allowFull ? 'Límite completo habilitado para todos.' : 'Cálculo por saldo pendiente restablecido. Las autorizaciones individuales se conservan.') : (command.allowFull ? 'Autorización individual registrada.' : 'Autorización individual desactivada.'));
      } catch (failure) { if (mounted.current) setError(errorLabel(failure)); }
      finally { if (mounted.current) setBusy(false); }
    }
    if (!canRead) return null;
    const globalChanged = !!data && globalFull !== data.policy.allow_full;
    const individualChanged = !!selectedFund && individualFull !== selectedFund.allow_full;
    const toggleRow = (text, value, onClick, disabled, marker) => h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 12 } },
      h('span', { style: { fontWeight: 750, fontSize: 13 } }, text),
      h(window.Toggle, { on: value, onClick, disabled, size: 'md', glow: false, role: 'switch', 'aria-checked': value, 'aria-label': text, 'data-loan-capacity-switch': marker }));
    return h('section', { style: panel, 'data-loan-capacity-admin': 'true' },
      h('button', { type: 'button', 'aria-expanded': open, onClick: () => { setOpen(!open); if (!open) { setNotice(''); load(null); } }, style: { border: 0, padding: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontWeight: 850, cursor: 'pointer' } }, 'Préstamos · saldo disponible y autorizaciones ', open ? '▴' : '▾'),
      open && h('div', null,
        h('p', { style: note }, 'El saldo disponible descuenta las cuotas pendientes de cada fondo. Estas autorizaciones permiten solicitar el límite completo del perfil, sin descontar esa deuda. Los demás requisitos siguen vigentes.'),
        busy && h('p', { role: 'status' }, 'Consultando…'),
        error && h('div', { role: 'alert', style: { color: '#9A1737' } }, error, h('button', { type: 'button', disabled: busy, onClick: () => load(control.trim() || null), style: button }, 'Actualizar consulta')),
        notice && h('p', { role: 'status', style: { color: '#087A50' } }, notice),
        data && h('div', null,
          h('h3', { style: { fontSize: 15 } }, 'Autorización general'),
          h('form', { onSubmit: (event) => { event.preventDefault(); if (data.can_configure && globalChanged && globalReason.trim().length >= 8) save('setGlobal', { allowFull: globalFull, version: data.policy.version, reason: globalReason.trim() }); } },
            toggleRow('Permitir solicitar el límite completo a todos', globalFull, () => setGlobalFull(!globalFull), busy || !data.can_configure, 'global'),
            h('p', { style: note }, data.policy.allow_full ? 'Actualmente activo: todos pueden solicitar su límite completo. Al desactivarlo se conservan las autorizaciones individuales.' : 'Actualmente desactivado: se descuenta la deuda pendiente, salvo autorizaciones individuales.'),
            globalChanged && h('p', { role: 'status', style: note }, 'Cambio pendiente de guardar.'),
            data.can_configure && h(React.Fragment, null,
              label('Motivo del cambio general', h('textarea', { value: globalReason, minLength: 8, maxLength: 1000, disabled: busy, onChange: (event) => setGlobalReason(event.target.value), style: field })),
              h('button', { type: 'submit', disabled: busy || !globalChanged || globalReason.trim().length < 8, style: button }, 'Guardar autorización general'))),
          h('h3', { style: { fontSize: 15, marginTop: 22 } }, 'Autorización por persona y fondo'),
          h('form', { onSubmit: (event) => { event.preventDefault(); setNotice(''); setIndividualReason(''); load(control.trim()); } },
            label('Número de control exacto', h('input', { value: control, required: true, disabled: busy, onChange: (event) => { setControl(event.target.value); setData((current) => current ? { ...current, person: null, funds: [], history: [] } : current); setIndividualReason(''); }, style: field })),
            h('button', { type: 'submit', disabled: busy || !control.trim(), style: button }, 'Consultar persona')),
          data.person && h('div', { 'data-loan-capacity-person': data.person.id, style: { borderTop: '1px solid var(--hairline)', marginTop: 14, paddingTop: 10 } },
            h('strong', null, data.person.name, ' · Control ', data.person.numero_control),
            !data.funds.length ? h('p', { style: note }, 'No hay fondos configurados para este perfil.') : h(React.Fragment, null,
              label('Fondo', h('select', { value: fundId, disabled: busy, onChange: (event) => { const fund = data.funds.find((item) => item.id === event.target.value); setFundId(event.target.value); setIndividualFull(!!fund && fund.allow_full); setIndividualReason(''); }, style: field }, data.funds.map((fund) => h('option', { key: fund.id, value: fund.id }, fund.label)))),
              selectedFund && h('form', { onSubmit: (event) => { event.preventDefault(); if (data.can_authorize && individualChanged && individualReason.trim().length >= 8) save('setIndividual', { affiliate: data.person.id, fund: selectedFund.id, allowFull: individualFull, version: selectedFund.version, reason: individualReason.trim() }); } },
                toggleRow('Permitir el límite completo en este fondo', individualFull, () => setIndividualFull(!individualFull), busy || !data.can_authorize, 'individual'),
                h('p', { style: note }, selectedFund.allow_full ? 'Autorización individual activa hasta que se desactive.' : 'Sin autorización individual en este fondo.'),
                data.policy.allow_full && h('p', { style: note }, 'La autorización general está activa. Esta configuración individual se conserva para cuando se desactive la general.'),
                individualChanged && h('p', { role: 'status', style: note }, 'Cambio pendiente de guardar.'),
                data.can_authorize && h(React.Fragment, null,
                  label('Motivo de la autorización o revocación', h('textarea', { value: individualReason, minLength: 8, maxLength: 1000, disabled: busy, onChange: (event) => setIndividualReason(event.target.value), style: field })),
                  h('button', { type: 'submit', disabled: busy || !individualChanged || individualReason.trim().length < 8, style: button }, 'Guardar autorización individual'))))),
          h('h3', { style: { fontSize: 15, marginTop: 22 } }, 'Registro de decisiones'),
          !data.history.length ? h('p', { style: note }, 'Sin decisiones registradas para esta consulta.') : h('ol', { style: { paddingLeft: 20, fontSize: 12 } }, data.history.map((event, index) => h('li', { key: index, style: { marginBottom: 12, overflowWrap: 'anywhere' } },
            h('strong', null, ({ POLICY: 'Cambio general', GRANT: 'Autorización individual', REVOKE: 'Revocación individual', OVERRIDE: 'Cambio individual' })[event.action] || 'Cambio de autorización'),
            event.fund_label && h('div', null, event.fund_label),
            h('div', null, new Date(event.created_at).toLocaleString('es-MX'), ' · Responsable: ', event.actor_label),
            h('div', null, event.reason)))))));
  }
  window.LoanAvailabilityAdmin = LoanAvailabilityAdmin;
})();
