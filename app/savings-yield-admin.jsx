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
    if (/OVERRIDE_PERIOD_FROZEN|OVERRIDE_ALREADY_USED/.test(text)) return 'El periodo ya tiene acreditaciones. Sus excepciones deben conservarse para la auditoría.';
    if (/FROZEN|RATE_MISMATCH/.test(text)) return 'El periodo ya tiene una apertura registrada. Su tasa y fechas deben conservarse.';
    if (/RATE_OR_CUTOFF_PENDING/.test(text)) return 'Falta registrar la tasa en la apertura o todavía no llega la fecha de corte.';
    if (/calendar_check|dates_check/.test(text)) return 'Las fechas deben pertenecer al año y semestre seleccionados.';
    return 'No se completó la operación. Conservamos los datos para que puedas reintentar.';
  }
  function TenureException({periodId, rows, events, disabled, onSaved}) {
    const [open,setOpen]=React.useState(false),[form,setForm]=React.useState({scope:'GLOBAL',participantId:'',reason:'',justification:'',confirmed:false});
    const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[revoke,setRevoke]=React.useState({id:'',reason:''});
    const lock=React.useRef(false),attempt=React.useRef(null),alive=React.useRef(true);
    React.useEffect(()=>()=>{alive.current=false;},[]);
    const blocked=busy||disabled;
    function change(name,value){setForm(old=>({...old,[name]:value,confirmed:name==='confirmed'?value:false}));attempt.current=null;setError('');}
    async function submit(method,payload){
      if(lock.current)return;lock.current=true;setBusy(true);setError('');
      const signature=JSON.stringify({method,payload});if(!attempt.current||attempt.current.signature!==signature)attempt.current={signature,key:window.SavingsRepository.newIdempotencyKey()};
      try{await window.SavingsPanelRepository[method]({...payload,key:attempt.current.key});if(!alive.current)return;attempt.current=null;setOpen(false);setRevoke({id:'',reason:''});await onSaved();}
      catch(e){if(alive.current)setError(errorText(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
    }
    const field=(label,name,multiline=false)=>h('label',{className:'sava-field'},label,h(multiline?'textarea':'input',{className:'sava-input',value:form[name],disabled:blocked,maxLength:multiline?1000:200,onChange:e=>change(name,e.target.value)}));
    return h('div',{'data-tenure-exception':periodId},
      h('button',{className:'sava-button',disabled:blocked,onClick:()=>setOpen(!open)},'Autorizar excepción de permanencia'),
      h('p',{className:'sava-note'},'Permite calcular rendimientos para este periodo sin modificar la fecha real de ingreso de los ahorradores.'),
      open&&h('div',{className:'sava-form',role:'region','aria-label':'Excepción de permanencia'},
        h('label',{className:'sava-field'},'Alcance de la excepción',h('select',{className:'sava-select','aria-label':'Alcance de la excepción',value:form.scope,disabled:blocked,onChange:e=>change('scope',e.target.value)},h('option',{value:'GLOBAL'},'Todos los participantes elegibles de este periodo'),h('option',{value:'INDIVIDUAL'},'Un ahorrador en este periodo'))),
        form.scope==='INDIVIDUAL'&&h('label',{className:'sava-field'},'Ahorrador autorizado',h('select',{className:'sava-select','aria-label':'Ahorrador autorizado',value:form.participantId,disabled:blocked,onChange:e=>change('participantId',e.target.value)},h('option',{value:''},'Selecciona un ahorrador'),rows.map(row=>h('option',{key:row.participant_id,value:row.participant_id},row.folio+' · '+row.name)))),
        field('Motivo de la excepción','reason'),field('Justificación de la excepción','justification',true),
        h('p',{className:'sava-note'},'Sólo se exceptúa el requisito de seis meses para el periodo seleccionado. Los demás requisitos siguen vigentes. La autorización quedará registrada y no acredita dinero por sí misma.'),
        h('label',null,h('input',{type:'checkbox',checked:form.confirmed,disabled:blocked,onChange:e=>change('confirmed',e.target.checked)}),'Confirmo el alcance y el periodo de esta excepción.'),
        h('button',{className:'sava-button is-primary',disabled:blocked||!form.confirmed||form.reason.trim().length<3||form.justification.trim().length<3||(form.scope==='INDIVIDUAL'&&!form.participantId),onClick:()=>submit('authorizeYieldOverride',{periodId,participantId:form.scope==='INDIVIDUAL'?form.participantId:null,reason:form.reason.trim(),justification:form.justification.trim(),confirmed:true})},'Confirmar excepción de permanencia')),
      (events||[]).map(event=>h('div',{className:'sava-note',key:event.id},h('p',null,(event.authorization.scope==='GLOBAL'?'Excepción global del periodo':'Excepción individual del periodo')+' · '+event.reason+' · '+event.created_at),
        h('button',{className:'sava-button',disabled:blocked,onClick:()=>{setRevoke({id:event.id,reason:''});attempt.current=null;}},'Revocar excepción '+event.id))),
      revoke.id&&h('div',{className:'sava-form'},h('label',{className:'sava-field'},'Motivo de revocación de permanencia',h('textarea',{className:'sava-input',disabled:blocked,value:revoke.reason,maxLength:1000,onChange:e=>setRevoke({...revoke,reason:e.target.value})})),h('button',{className:'sava-button',disabled:blocked||revoke.reason.trim().length<3,onClick:()=>submit('revokeException',{eventId:revoke.id,reason:revoke.reason.trim()})},'Confirmar revocación de permanencia')),
      error&&h('p',{role:'alert',className:'sava-error'},error));
  }
  function SavingsYieldAdmin({ app, periods, onSaved }) {
    const [periodId, setPeriodId] = React.useState(''), [preview, setPreview] = React.useState(null), [phase, setPhase] = React.useState('idle');
    const [error, setError] = React.useState(''), [notice, setNotice] = React.useState(''), [reason, setReason] = React.useState(''), [review, setReview] = React.useState(false);
    const [form, setForm] = React.useState({ year: String(new Date().getFullYear()), semester: '1', startsOn: '', endsOn: '', rate: '' });
    const sequence = React.useRef(0), key = React.useRef(null), busy = React.useRef(false), mounted = React.useRef(true);
    const canConfigure = app.admin.has('savings.config'), canApprove = app.admin.has('savings.approve'), canOverride = app.admin.has('savings.yield.override');
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
        canOverride && h(TenureException,{key:periodId,periodId,rows,events:preview.tenure_exceptions,disabled:saving,onSaved:()=>load(periodId)}),
        h('div', { className: 'sava-kpis' }, [['Tasa registrada', preview.rate == null ? 'Pendiente' : preview.rate + '%'], ['Fecha de corte', preview.cutoff_on || 'Pendiente'], ['Ahorradores elegibles', preview.eligible_count], ['Requieren revisión', preview.review_count], ['Por acreditar', preview.state === 'READY' ? money(preview.total_to_credit) : '—']].map(([label, value]) => h('div', { className: 'sava-kpi', key: label }, h('span', null, label), h('b', null, value)))),
        h('div', { style: { overflowX: 'auto' } }, h('table', { className: 'sava-table', 'aria-label': 'Rendimiento por Folio' }, h('thead', null, h('tr', null, ['Folio', 'Nombre', 'Estado', 'Cumple seis meses', 'Capital elegible', 'Rendimiento', 'Motivo'].map(label => h('th', { key: label }, label)))),
          h('tbody', null, rows.map(row => h('tr', { key: row.participant_id }, [row.folio, row.name, statuses[row.status] || row.status, row.eligible_on || '—', money(row.capital_basis), money(row.yield_amount), row.reason || (row.tenure_override&&row.ordinary_tenure_pass===false?'Excepción de permanencia para este periodo':'—')].map((value, index) => h('td', { key: index }, value))))))),
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
