/* screens-admin-finanzas.jsx — Panel de Finanzas (base). Concentra TODAS las
   solicitudes de financiamiento enviadas por los usuarios tras simular un
   producto/servicio con descuento vía nómina. Vincula por ID usuario, empresa,
   programa/convenio, producto y simulación. Visualizar, administrar y dar
   seguimiento. Exporta window.FinanzasModule. */
(function () {
  const { useState, useEffect } = React;
  const h = React.createElement;
  const I = window.Icon;
  const F = () => window.financeStore;
  const money = (n) => (window.money ? window.money(n) : '$' + n);

  const REQUEST_STATUS = Object.freeze({
    submitted: { label: 'Enviada', tone: 'amber' },
    requires_financial_processing: { label: 'Pendiente de revisión', tone: 'amber' },
    in_review: { label: 'En revisión', tone: 'blue' },
    approved: { label: 'Aprobada', tone: 'green' },
    rejected: { label: 'Rechazada', tone: 'red' },
    cancelled: { label: 'Cancelada', tone: 'gray' },
  });
  const FINANCIAL_PROCESSING = Object.freeze({
    pending: { label: 'Validación financiera', tone: 'amber' },
    ready_for_handoff: { label: 'Pendiente de envío', tone: 'blue' },
    in_progress: { label: 'Enviando a gestión', tone: 'blue' },
    handed_off: { label: 'Entregada a gestión', tone: 'green' },
    completed: { label: 'Aprobada en Supabase', tone: 'green' },
    failed: { label: 'Envío con error', tone: 'red' },
  });
  const PROGRAM_LABELS = Object.freeze({ prestamo: 'Suti Préstamo', caja: 'Caja de ahorro', nomina: 'Financiamiento vía nómina' });
  const TONES = Object.freeze({ amber: ['#FFF4D6', '#8A5A00'], blue: ['#E8F0FF', '#2456C7'], green: ['#E5F7EF', '#087A50'], red: ['#FCE9EE', '#A00027'], gray: ['#EEF0F4', '#596273'] });
  const ADMIN_EVENT_LABELS = Object.freeze({ COMMENT: 'Observación administrativa', MARK_IN_REVIEW: 'Revisión iniciada', REJECT: 'Etapa rechazada', CANCEL: 'Solicitud cancelada', APPROVE: 'Etapa aprobada', ADVANCE_STAGE: 'Avance de etapa' });
  const programLabel = (row) => row && row.program_item && row.program_item.name || row && row.product && row.product.name || row && row.membership && [row.membership.company_raw, row.membership.concept].filter(Boolean).join(' · ') || row && row.company && row.company.display_name || PROGRAM_LABELS[row && row.program_id] || row && row.program_id || 'Solicitud';
  const requestTypeLabel = (row) => row && row.program_id === 'prestamo' ? 'Préstamo' : row && row.membership_offering_id ? 'Membresía' : row && row.request_type === 'quote' ? 'Cotización' : 'Programa / producto';
  const queueProgramLabel = (row) => row.program_id === 'prestamo' ? row.requested_fund || 'Fondo no registrado' : programLabel(row);
  const statusMeta = (status) => REQUEST_STATUS[status] || { label: 'Estado no reconocido', tone: 'gray' };
  const processingMeta = (stage) => FINANCIAL_PROCESSING[stage] || { label: 'Sin procesamiento financiero', tone: 'gray' };
  const workflowOf = (row) => row && row.workflow_state || {};
  const currentStage = (row) => workflowOf(row).current_stage || null;
  const nextStage = (row) => (workflowOf(row).stages || []).find((stage) => stage.state === 'upcoming') || null;
  const stageLabel = (row) => currentStage(row) && currentStage(row).label || 'Seguimiento no disponible';
  const numberValue = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const moneyValue = (value) => numberValue(value) == null ? '—' : money(Number(value)).replace(/\.00$/, '');
  const dateValue = (value) => value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const dayKey = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
  const ageDays = (value) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  const ageLabel = (value) => { const days = ageDays(value); if (!days) { const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' h'; } return days + ' d'; };
  const maskedControl = (value) => { const text = String(value || ''); return text ? '••••' + text.slice(-4) : 'Sin control'; };
  const snapshotResult = (detail, approved) => { const snapshot = approved ? detail && detail.financial_approval_snapshot : detail && detail.financial_submission_snapshot; return snapshot && snapshot.financialResult || null; };
  const badge = (meta, attr, value) => { const tone = TONES[meta.tone] || TONES.gray; return h('span', { className: 'finwb-badge', style: { background: tone[0], color: tone[1] }, [attr]: value }, meta.label); };

  function ensureWorkbenchStyles() {
    if (document.getElementById('admin-financial-workbench-css')) return;
    const style = document.createElement('style'); style.id = 'admin-financial-workbench-css';
    style.textContent = `
      .finwb-root{display:flex;flex-direction:column;min-height:0;gap:12px;outline:none}
      .finwb-toolbar{background:var(--surface);border-radius:16px;padding:12px;box-shadow:var(--neo-sm)}
      .finwb-filters{display:grid;grid-template-columns:minmax(150px,1.5fr) repeat(3,minmax(118px,1fr));gap:9px}
      .finwb-field{display:flex;flex-direction:column;gap:5px;min-width:0}.finwb-field label{font-size:10.5px;color:var(--ink-3);font-weight:800}
      .finwb-field input,.finwb-field select,.finwb-action-select,.finwb-note{width:100%;box-sizing:border-box;border:1px solid #DCE1EA;background:var(--surface-2);border-radius:11px;padding:9px 10px;color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:650;outline:none}
      .finwb-results{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;font-size:11.5px;color:var(--ink-3);font-weight:700}.finwb-results button{border:0;background:transparent;color:var(--guinda);font:inherit;cursor:pointer}
      .finwb-grid{display:grid;grid-template-columns:minmax(315px,.95fr) minmax(350px,1.05fr);gap:12px;min-height:560px;max-height:calc(100vh - 286px)}
      .finwb-panel{background:var(--surface);border-radius:17px;box-shadow:var(--neo-sm);min-width:0;min-height:0;overflow:hidden}
      .finwb-queue{display:flex;flex-direction:column}.finwb-queue-head{display:grid;grid-template-columns:82px 40px minmax(118px,1fr) 100px 112px 48px;gap:6px;padding:10px 9px;border-bottom:1px solid var(--hairline);font-size:9.5px;color:var(--ink-3);font-weight:900;letter-spacing:.03em;text-transform:uppercase}
      .finwb-queue-body{overflow:auto;min-height:0}.finwb-row{width:100%;display:grid;grid-template-columns:82px 40px minmax(118px,1fr) 100px 112px 48px;gap:6px;align-items:center;padding:11px 9px;border:0;border-bottom:1px solid var(--hairline);background:transparent;text-align:left;font-family:inherit;cursor:pointer;color:var(--ink)}.finwb-row>span{display:block;min-width:0}
      .finwb-row[aria-selected=true]{background:#F8EDF1;box-shadow:inset 3px 0 0 var(--guinda)}.finwb-row:focus-visible{outline:2px solid var(--guinda);outline-offset:-2px}.finwb-folio{font:800 10.5px/1.35 var(--mono);color:var(--guinda);overflow-wrap:anywhere}.finwb-person{font-size:12.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.finwb-sub{font-size:10.5px;color:var(--ink-3);font-weight:650;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.finwb-row .finwb-sub{display:block;max-width:100%}.finwb-amount{font-size:12.5px;font-weight:850}.finwb-age{font:800 11px var(--mono);color:var(--guinda)}
      .finwb-badge{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:10.5px;font-weight:850;line-height:1.2}.finwb-stage{font-size:10.5px;color:var(--ink-3);font-weight:750;margin-top:4px}
      .finwb-empty{display:grid;place-items:center;align-content:center;gap:8px;min-height:240px;padding:24px;text-align:center;color:var(--ink-3);font-size:12.5px;font-weight:700}
      .finwb-detail{display:flex;flex-direction:column}.finwb-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid var(--hairline);background:#F8F9FC}.finwb-detail-head strong{display:block;margin-top:2px;font:850 12px var(--mono);overflow-wrap:anywhere}.finwb-detail-scroll{overflow:auto;min-height:0;padding:12px 12px 104px}.finwb-card{border:1px solid #E1E5ED;border-radius:14px;padding:12px;margin-bottom:10px;background:#fff}.finwb-card h3{display:flex;align-items:center;gap:7px;margin:0 0 9px;font-size:13px}.finwb-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.finwb-kv span{display:block;font-size:10px;color:var(--ink-3);font-weight:750}.finwb-kv strong{display:block;margin-top:2px;font-size:12px;color:var(--ink);overflow-wrap:anywhere}.finwb-snapshot-note{padding:9px 10px;border-radius:10px;background:#FFF8E7;color:#71511B;font-size:11px;font-weight:700;line-height:1.45}
      .finwb-doc{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--hairline)}.finwb-doc:first-of-type{border-top:0}.finwb-doc-main{min-width:0}.finwb-doc-preview{width:72px;height:58px;border:0;border-radius:10px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;color:var(--ink-3);padding:0;cursor:pointer}.finwb-doc-preview img,.finwb-doc-preview iframe{width:100%;height:100%;border:0;object-fit:cover;pointer-events:none}.finwb-doc button,.finwb-doc a{border:0;border-radius:9px;padding:8px 10px;background:var(--surface-2);color:var(--guinda);font:800 11px inherit;text-decoration:none;cursor:pointer}.finwb-doc button:disabled{opacity:.55;cursor:default}
      .finwb-flow-summary{border:1px solid #E4D3D9;background:linear-gradient(135deg,#FFF8FA,#fff);border-radius:13px;padding:11px;margin-bottom:10px}.finwb-flow-current{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start}.finwb-flow-current strong{font-size:15px}.finwb-flow-current p{margin:4px 0 0;font-size:11px;color:var(--ink-3);font-weight:650;line-height:1.45}.finwb-responsible{padding:6px 8px;border-radius:999px;background:#F4E8ED;color:var(--guinda);font-size:10px;font-weight:850;white-space:nowrap}.finwb-steps{display:flex;flex-direction:column;gap:0}.finwb-step{display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;position:relative;padding:7px 0}.finwb-step:not(:last-child):before{content:'';position:absolute;left:11px;top:30px;bottom:-5px;width:2px;background:#E0E4EA}.finwb-step-dot{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#EEF0F4;color:#687080;font-size:10px;font-weight:900;z-index:1}.finwb-step[data-state=done] .finwb-step-dot{background:#DDF4E8;color:#087A50}.finwb-step[data-state=current] .finwb-step-dot{background:var(--guinda);color:#fff;box-shadow:0 0 0 4px #F6E8ED}.finwb-step strong{font-size:11.5px}.finwb-step p{margin:2px 0 0;font-size:10.5px;color:var(--ink-3);font-weight:650;line-height:1.4}.finwb-next-action{margin-top:9px;padding:9px 10px;border-radius:10px;background:#EEF3FF;color:#244F9E;font-size:11px;font-weight:750;line-height:1.45}
      .finwb-timeline{display:flex;flex-direction:column;gap:9px}.finwb-event{display:grid;grid-template-columns:10px 1fr;gap:9px}.finwb-event-dot{width:9px;height:9px;border-radius:50%;margin-top:4px;background:var(--guinda);box-shadow:0 0 0 4px #F8E8EE}.finwb-event strong{font-size:11.5px}.finwb-event p{margin:2px 0 0;font-size:10.5px;color:var(--ink-3);font-weight:650;line-height:1.4}
      .finwb-actionbar{position:absolute;left:0;right:0;bottom:0;padding:11px 12px;background:rgba(248,249,252,.97);border-top:1px solid #DDE2EA;backdrop-filter:blur(10px)}.finwb-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.finwb-note{margin-top:8px;resize:vertical;min-height:52px}.finwb-buttons{display:grid;grid-template-columns:auto auto 1fr;gap:8px;margin-top:8px}.finwb-buttons button{border:0;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:11.5px;font-weight:850;cursor:pointer}.finwb-buttons button:disabled{opacity:.5;cursor:default}.finwb-secondary{background:var(--surface);color:var(--ink-2);box-shadow:var(--neo-sm)}.finwb-primary{background:var(--guinda);color:#fff}.finwb-feedback{margin-top:7px;font-size:11px;font-weight:800}.finwb-feedback[data-tone=saving]{color:#7A5A16}.finwb-feedback[data-tone=success]{color:#087A50}.finwb-feedback[data-tone=error]{color:#A00027}
      @media(max-width:1279px){.finwb-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.finwb-kv{grid-template-columns:1fr}.finwb-grid{grid-template-columns:minmax(285px,.9fr) minmax(330px,1.1fr)}}
      @media(max-width:1359px){.finwb-queue-head,.finwb-row{grid-template-columns:58px 36px minmax(0,1fr) 72px;gap:5px;padding-left:8px;padding-right:8px}.finwb-queue-head>*:nth-child(4),.finwb-row>*:nth-child(4){display:none}.finwb-queue-head>*:nth-child(6),.finwb-row>*:nth-child(6){display:none}.finwb-badge{box-sizing:border-box;max-width:100%;padding:0 6px;font-size:9.5px}}
      @media(min-width:1280px){.finwb-filters{grid-template-columns:minmax(180px,1.5fr) repeat(6,minmax(96px,1fr))}.finwb-grid{grid-template-columns:minmax(470px,1fr) minmax(440px,1fr)}}
      @media(max-width:1023px){.finwb-filters{grid-template-columns:1fr 1fr}.finwb-grid{grid-template-columns:1fr;max-height:none;min-height:0}.finwb-queue{max-height:390px}.finwb-detail{min-height:680px}.finwb-detail-scroll{overflow:visible}.finwb-actionbar{position:sticky}.finwb-doc{grid-template-columns:58px minmax(0,1fr) auto}.finwb-doc-preview{width:58px;height:50px}}
      .finwb-grid{display:block;min-height:0;max-height:none}.finwb-queue{max-height:calc(100dvh - 285px);min-height:240px}
      .finwb-row .finwb-person{display:block;white-space:normal;overflow-wrap:anywhere;line-height:1.4}.finwb-row .finwb-sub{white-space:normal;overflow-wrap:anywhere;line-height:1.4}
      .finwb-row .finwb-profile-photo{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;overflow:hidden;background:#F8EDF1;color:var(--guinda);font-size:12px;font-weight:800;border:1px solid var(--hairline)}.finwb-profile-photo img{width:100%;height:100%;object-fit:cover}.finwb-profile-photo[data-photo-state=error]{border-style:dashed}
      .finwb-modal{box-sizing:border-box;width:88vw;max-width:1600px;height:calc(100dvh - 40px);max-height:calc(100dvh - 40px);min-height:0;margin:auto;padding:0;border:1px solid #DCE1EA;border-radius:22px;background:#F3F5F9;color:var(--ink);font-family:inherit;overflow:hidden;box-shadow:0 24px 100px #14203855}
      .finwb-modal[open]{display:flex;flex-direction:column}.finwb-modal::backdrop{background:rgba(15,23,42,.58)}
      .finwb-modal .finwb-detail-head{flex:none;align-items:center;padding:18px 24px;gap:16px;background:#fff}.finwb-modal-heading{min-width:0;flex:1}.finwb-modal .finwb-detail-head strong{font-size:13px;color:var(--guinda)}.finwb-modal-heading h2{font-size:21px;line-height:1.2;margin:5px 0;color:var(--ink);overflow-wrap:anywhere}.finwb-modal .finwb-detail-head .finwb-sub{white-space:normal;font-size:12px;line-height:1.4}
      .finwb-modal-close{flex:none;align-self:flex-start;display:grid;place-items:center;width:44px;height:44px;border:1px solid #DCE1EA;border-radius:12px;background:#F3F5F9;color:var(--ink);font-size:26px;cursor:pointer}.finwb-modal :focus-visible{outline:3px solid var(--guinda);outline-offset:2px}.finwb-modal .finwb-badge{font-size:12px;min-height:28px}
      .finwb-modal .finwb-detail-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:20px 24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;align-items:start;gap:16px;scrollbar-gutter:stable}.finwb-modal .finwb-card{min-width:0;margin:0;padding:18px}.finwb-modal .finwb-card h3{font-size:15px;margin-bottom:14px}.finwb-modal .finwb-kv{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.finwb-modal .finwb-kv span{font-size:11px}.finwb-modal .finwb-kv strong{font-size:13px;line-height:1.45}.finwb-modal .finwb-doc .finwb-person,.finwb-modal .finwb-doc .finwb-sub{white-space:normal;overflow-wrap:anywhere}.finwb-modal .finwb-flow-current .finwb-sub{display:block;margin-bottom:4px}.finwb-modal .finwb-flow-current{grid-template-columns:minmax(0,1fr)}.finwb-modal .finwb-responsible{justify-self:start;white-space:normal}.finwb-modal .finwb-step strong{font-size:13px}.finwb-modal .finwb-step p,.finwb-modal .finwb-event p{font-size:12px;overflow-wrap:anywhere}.finwb-modal .finwb-event strong{font-size:13px}
      .finwb-modal .finwb-actionbar{position:static;flex:none;padding:14px 24px;background:#fff;box-shadow:0 -6px 20px #14203808;backdrop-filter:none}.finwb-modal .finwb-action-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}.finwb-modal .finwb-action-grid .finwb-sub{display:block;white-space:normal}.finwb-modal .finwb-note{min-height:44px;height:44px;resize:none;margin-top:8px}.finwb-modal .finwb-buttons{grid-template-columns:auto auto minmax(0,1fr)}.finwb-modal .finwb-buttons button{min-height:44px;font-size:13px}.finwb-modal .finwb-next-action{margin-top:6px;padding:6px 10px}.finwb-modal .finwb-empty{flex:1;min-height:0;overflow:auto}.finwb-modal .finwb-feedback{overflow-wrap:anywhere}
      .finwb-modal .finwb-buttons:has(.finwb-delete){grid-template-columns:auto auto minmax(0,1fr) auto}.finwb-delete{background:#fff1f3;color:#a00027;box-shadow:inset 0 0 0 1px #edb7c2}.finwb-delete:focus-visible{outline:3px solid #a00027;outline-offset:2px}
      @media(min-width:768px){.finwb-queue-head,.finwb-row{grid-template-columns:100px 40px minmax(0,1fr) 140px 180px 64px;gap:12px;padding:14px 16px}.finwb-queue-head>*:nth-child(4),.finwb-row>*:nth-child(4),.finwb-queue-head>*:nth-child(6),.finwb-row>*:nth-child(6){display:block}}
      @media(max-width:1023px){.finwb-modal{width:calc(100vw - 16px);height:calc(100dvh - 16px);max-height:calc(100dvh - 16px);border-radius:16px}.finwb-modal .finwb-detail-head{padding:14px 18px}.finwb-modal .finwb-detail-scroll{padding:16px;gap:12px}.finwb-modal .finwb-card{padding:14px}.finwb-modal .finwb-actionbar{padding:12px 18px}}
      @media(max-width:600px){.finwb-modal{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0}.finwb-modal .finwb-detail-head{padding:12px;gap:8px;flex-wrap:wrap}.finwb-modal-heading h2{font-size:17px}.finwb-modal .finwb-detail-head .finwb-badge{max-width:100%;font-size:11px;min-height:24px}.finwb-modal .finwb-detail-head .finwb-sub{font-size:11px}.finwb-modal .finwb-detail-scroll{grid-template-columns:minmax(0,1fr);padding:12px;gap:12px}.finwb-modal .finwb-card{padding:14px}.finwb-modal .finwb-actionbar{padding:10px 12px max(10px,env(safe-area-inset-bottom))}.finwb-modal .finwb-action-grid{gap:8px}.finwb-modal .finwb-action-select{font-size:12px;min-width:0;padding:8px}.finwb-modal .finwb-buttons{grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.finwb-modal .finwb-primary{grid-column:1/-1}.finwb-modal .finwb-buttons button{padding:8px;font-size:12px}.finwb-modal .finwb-next-action{font-size:10px;line-height:1.3}.finwb-modal .finwb-note{margin-top:6px}.finwb-modal .finwb-feedback{font-size:10px;margin-top:4px}}
      @media(max-width:600px){.finwb-modal .finwb-buttons:has(.finwb-delete){grid-template-columns:1fr 1fr}.finwb-modal .finwb-buttons:has(.finwb-delete) .finwb-primary{grid-column:auto}}
      @media(max-height:600px){.finwb-modal .finwb-detail-head{padding:8px 12px}.finwb-modal-heading h2{font-size:16px;margin:2px 0}.finwb-modal .finwb-actionbar{padding:8px 12px}.finwb-modal .finwb-note{height:36px;min-height:36px}.finwb-modal .finwb-buttons{grid-template-columns:auto auto minmax(0,1fr)}.finwb-modal .finwb-primary{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function useDesktop() {
    const query = () => window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
    const [desktop, setDesktop] = useState(query());
    useEffect(() => { const media = window.matchMedia('(min-width: 1024px)'); const change = () => setDesktop(media.matches); change(); media.addEventListener ? media.addEventListener('change', change) : media.addListener(change); return () => media.removeEventListener ? media.removeEventListener('change', change) : media.removeListener(change); }, []);
    return desktop;
  }

  function useStore(enabled) {
    const [, force] = useState(0);
    useEffect(() => F().subscribe(() => force((n) => n + 1)), []);
    useEffect(() => { if (enabled) F().bootstrap(); }, [enabled]);
    return F();
  }

  function timelineEvents(detail) {
    if (!detail) return [];
    const events = [{ at: detail.created_at, title: 'Solicitud registrada', text: 'Alta confirmada en la bandeja financiera.' }];
    const confirmed = detail.financial_submission_snapshot && detail.financial_submission_snapshot.confirmed_at;
    if (confirmed) events.push({ at: confirmed, title: 'Condiciones confirmadas', text: 'Snapshot contractual de la solicitud guardado.' });
    (detail.request_documents || []).forEach((document) => events.push({ at: document.created_at, title: 'Documento incorporado', text: document.document_type && document.document_type.label || 'Documento del expediente' }));
    const adminEvents = detail.admin_events || [];
    adminEvents.forEach((event) => events.push({ at: event.created_at, title: ADMIN_EVENT_LABELS[event.action] || 'Acción administrativa', text: [event.from_stage_label && event.to_stage_label ? event.from_stage_label + ' → ' + event.to_stage_label : '', event.actor_label || 'Personal autorizado', event.comment].filter(Boolean).join(' · ') }));
    const approvedAt = detail.financial_approved_at || detail.financial_approval_snapshot && detail.financial_approval_snapshot.approved_at;
    if (approvedAt && !adminEvents.some((event) => event.action === 'APPROVE')) events.push({ at: approvedAt, title: 'Financiamiento aprobado', text: 'Condiciones aprobadas guardadas en snapshot inmutable.' });
    const exportState = detail.financial_export;
    if (exportState && exportState.updated_at) events.push({ at: exportState.updated_at, title: processingMeta(detail.financial_processing_status).label, text: exportState.export_status === 'failed' ? 'La entrega puede reintentarse sin duplicar la solicitud.' : 'Estado confirmado por el contrato de exportación.' });
    return events.filter((event) => event.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  function humanActionError(error) {
    const code = String(error && (error.code || error.message) || '');
    if (/ADMIN_APPROVAL_REQUIRED|REQUEST_DENIED|PROGRAM_REQUEST_(?:READ|WRITE)_DENIED|42501/.test(code)) return 'No tienes permiso para realizar esta acción.';
    if (/PROGRAM_REQUEST_COMMENT_(?:REQUIRED|INVALID)/.test(code)) return 'La observación debe tener entre 3 y 2,000 caracteres.';
    if (/FINANCIAL_REQUEST_TRANSITION_INVALID/.test(code)) return 'El estado de la solicitud cambió y esa acción ya no está permitida.';
    if (/SIGNATURE_AND_TERMS_REQUIRED/.test(code)) return 'La solicitud no tiene firma y términos válidos.';
    if (/REQUESTED_AMOUNT_TERM_CONTRACT_REQUIRED|FINANCIAL_SUBMISSION/.test(code)) return 'Faltan condiciones contractuales de la solicitud.';
    if (/REQUIRED_DOCUMENTS_MISSING/.test(code)) return 'Faltan documentos obligatorios para continuar.';
    if (/CONDITIONS_CHANGED/.test(code)) return 'Las condiciones cambiaron; revisa nuevamente antes de aprobar.';
    if (/APPROVED_FINANCIAL_REQUEST_STATUS_IMMUTABLE/.test(code)) return 'La solicitud aprobada ya no admite ese cambio de estado.';
    if (/QUOTE_AMOUNT_REQUIRED/.test(code)) return 'Captura un monto válido para aprobar la cotización.';
    if (/FINANCIAL_PROGRAM_NOT_ELIGIBLE/.test(code)) return 'El fondo o sus condiciones cambiaron; revisa las condiciones de esta solicitud antes de autorizar.';
    if (/REQUIRED_PRIVATE_DOCUMENT_MISSING|GUARANTOR_DOCUMENTS_NOT_AVAILABLE/.test(code)) return 'Faltan documentos vinculados a esta solicitud para autorizarla.';
    if (/REQUEST_WORKFLOW_ALREADY_COMPLETE/.test(code)) return 'El flujo ya se encuentra en su última etapa.';
    if (/REQUEST_WORKFLOW_|TRACKING_/.test(code)) return 'El flujo cambió o no está disponible. Se recargó la etapa vigente.';
    if (/SPECIALIZED_FINANCIAL_APPROVAL_REQUIRED/.test(code)) return 'Esta aprobación requiere el proceso financiero autorizado.';
    return 'No se completó la acción. Puedes reintentar sin duplicar la solicitud.';
  }

  // Local preview lifecycle. The repository remains the only authorizer/signer.
  function useFinancialDocumentPreviews(detail, enabled, onOpen) {
    const epoch = window.PrivateResourceDemand.useContext();
    const documents = [];
    [['request', detail && detail.request_documents || []], ['affiliate', detail && detail.current_affiliate_documents || []]].forEach(([scope, rows]) => rows.forEach((row) => documents.push({
      id: row.affiliate_document_id || row.id, key: scope + ':' + row.id,
      mime: String(row.mimeType || '').toLowerCase(), version: row.updated_at || row.created_at || '',
      title: row.document_type && row.document_type.label || 'Documento'
    })));
    const identity = JSON.stringify([epoch, enabled, detail && detail.id, detail && detail.affiliate_id, documents]);
    const current = React.useRef(identity), controller = React.useRef(null), opener = React.useRef(onOpen);
    current.current = identity; opener.current = onOpen;
    const [state, setState] = useState({ identity: '', views: {} });
    useEffect(() => {
      if (!enabled || epoch === null || !detail) return;
      const abort = new AbortController(), groups = new Map(), queue = [];
      let running = 0;
      const valid = () => !abort.signal.aborted && current.current === identity && window.PrivateResourceDemand.context() === epoch;
      documents.forEach((row) => {
        if (!groups.has(row.id)) groups.set(row.id, { ...row, keys: [], view: { phase: 'loading' }, retries: 0 });
        groups.get(row.id).keys.push(row.key);
      });
      const publish = (entry, view) => {
        if (!valid()) return;
        entry.view = view;
        setState((previous) => {
          const views = previous.identity === identity ? { ...previous.views } : {};
          entry.keys.forEach((key) => { views[key] = view; });
          return { identity, views };
        });
      };
      // Each wait is bounded and detached on navigation. A late backend response cannot change the new selection.
      const bounded = (start, milliseconds, imageLoad) => new Promise((resolve, reject) => {
        let cancel = () => {}, finished = false;
        const finish = (error, value) => {
          if (finished) return; finished = true; clearTimeout(timer); abort.signal.removeEventListener('abort', stopped); cancel();
          if (error) reject(error); else resolve(value);
        };
        const stopped = () => finish(new Error('PREVIEW_CONTEXT_CHANGED'));
        const timer = setTimeout(() => finish(Object.assign(new Error('PREVIEW_TIMEOUT'), { imageLoad })), milliseconds);
        abort.signal.addEventListener('abort', stopped, { once: true });
        if (!valid()) { stopped(); return; }
        cancel = start((value) => finish(null, value), (error) => finish(error)) || cancel;
      });
      const imageReady = (url) => bounded((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth > 0 ? resolve() : reject(Object.assign(new Error('IMAGE_EMPTY'), { imageLoad: true }));
        image.onerror = () => reject(Object.assign(new Error('IMAGE_DOWNLOAD_FAILED'), { imageLoad: true }));
        image.src = url;
        return () => { image.onload = null; image.onerror = null; image.removeAttribute('src'); };
      }, 20000, true);
      const pump = () => {
        while (valid() && running < 3 && queue.length) {
          const job = queue.shift(); running++;
          job().finally(() => { running--; pump(); });
        }
      };
      const request = (entry, force) => {
        if (!valid()) return Promise.resolve(null);
        if (entry.pending) return entry.pending;
        if (!force && entry.view.phase === 'ready' && entry.view.expiresAt > Date.now()) return Promise.resolve(entry.view);
        clearTimeout(entry.renew);
        publish(entry, entry.view.phase === 'ready' && entry.view.expiresAt > Date.now() ? { ...entry.view, busy: true } : { phase: 'loading', busy: true });
        entry.pending = new Promise((resolve) => queue.push(async () => {
          let result = null;
          try {
            for (;;) {
              if (!valid()) break;
              const started = Date.now();
              const preview = await bounded((done, fail) => {
                window.DocumentWorkflowRepository.adminPreview(entry.id, detail.affiliate_id, 'ADMIN_FINANCIAL_REQUEST').then(done, fail);
              }, 25000, false);
              const expiresAt = started + Math.min(300, Number(preview.expiresIn) || 300) * 1000;
              if (!preview.signedUrl || expiresAt <= Date.now()) throw new Error('PREVIEW_EXPIRED');
              try { if (entry.mime.startsWith('image/')) await imageReady(preview.signedUrl); }
              catch (error) {
                if (!error.imageLoad || entry.retries >= 1 || !valid()) throw error;
                entry.retries++;
                await bounded((done) => { const timer = setTimeout(done, 1200); return () => clearTimeout(timer); }, 2000, false);
                continue;
              }
              if (!valid() || expiresAt <= Date.now()) throw new Error('PREVIEW_EXPIRED');
              clearTimeout(entry.expire);
              result = { phase: 'ready', url: preview.signedUrl, expiresAt };
              publish(entry, result);
              const remaining = expiresAt - Date.now();
              entry.renew = setTimeout(() => { if (!document.hidden) request(entry, true); }, Math.max(1000, remaining - Math.min(30000, remaining / 5)));
              entry.expire = setTimeout(() => {
                if (!valid() || entry.view.expiresAt !== expiresAt) return;
                publish(entry, { phase: 'loading' });
                if (!document.hidden) request(entry, true);
              }, remaining);
              break;
            }
          } catch (_) { publish(entry, { phase: 'error' }); }
          finally { entry.pending = null; resolve(valid() ? result : null); }
        }));
        pump(); return entry.pending;
      };
      const find = (key) => [...groups.values()].find((entry) => entry.keys.includes(key));
      controller.current = {
        identity,
        retry(key) { const entry = find(key); if (entry) { entry.retries = 0; request(entry, true); } },
        failed(key, url) {
          const entry = find(key);
          if (!entry || entry.pending || entry.view.url !== url) return;
          clearTimeout(entry.renew); clearTimeout(entry.expire);
          publish(entry, { phase: 'error' });
          if (entry.retries < 1) { entry.retries++; request(entry, true); }
        },
        async open(key) {
          const entry = find(key); if (!entry) return;
          const result = await request(entry, true);
          if (result && valid()) opener.current({ source: result.url, mimeType: entry.mime, title: entry.title, context: identity });
        }
      };
      groups.forEach((entry) => request(entry, false));
      const foreground = () => {
        if (document.hidden) return;
        groups.forEach((entry) => { if (entry.view.phase !== 'error' && (!entry.view.expiresAt || entry.view.expiresAt <= Date.now() + 30000)) request(entry, true); });
      };
      document.addEventListener('visibilitychange', foreground);
      return () => {
        abort.abort(); queue.length = 0;
        groups.forEach((entry) => { clearTimeout(entry.renew); clearTimeout(entry.expire); });
        document.removeEventListener('visibilitychange', foreground);
      };
    }, [identity]);
    const act = (name, ...args) => { if (controller.current && controller.current.identity === identity) return controller.current[name](...args); };
    return { identity, views: state.identity === identity ? state.views : {}, retry: (key) => act('retry', key), open: (key) => act('open', key), failed: (key, url) => act('failed', key, url) };
  }

  function RequestBankReference({ reference }) {
    const available = reference && reference.status === 'available';
    const messages = { forbidden: 'Requiere permiso para consultar datos bancarios.', not_selected: 'La solicitud se envió sin seleccionar una cuenta bancaria.', not_recorded: 'Esta solicitud no conserva una cuenta bancaria registrada.' };
    const fields = available ? [['Banco', reference.bank_name], ['Titular', reference.account_holder], ['Tarjeta', reference.card_number], ['CLABE', reference.clabe]].filter((item) => item[1]) : [];
    return h('div', { 'data-financial-bank-reference': reference && reference.status || 'unavailable', style: { borderTop: '1px solid var(--hairline)', marginTop: 12, paddingTop: 12 } },
      h('h4', { style: { margin: '0 0 8px', fontSize: 12, color: 'var(--ink)' } }, 'Cuenta elegida al enviar'),
      available ? h('div', { className: 'finwb-kv' }, fields.map(([label, value]) => h('div', { key: label }, h('span', null, label), h('strong', { style: label === 'Tarjeta' || label === 'CLABE' ? { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums', userSelect: 'text', overflowWrap: 'anywhere' } : null }, value)))) :
        h('p', { style: { margin: 0, color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.5 } }, messages[reference && reference.status] || 'No fue posible consultar la referencia bancaria.'));
  }

  // Presentation only: native modal focus containment and a reversible page scroll lock.
  function FinancialRequestDetailModal({ header, children, onClose, onEscape, titleId }) {
    const dialogRef = React.useRef(null), closeRef = React.useRef(null);
    useEffect(() => {
      const dialog = dialogRef.current, opener = document.activeElement;
      const bodyOverflow = document.body.style.overflow, htmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
      dialog.showModal(); closeRef.current.focus({ preventScroll: true });
      return () => {
        dialog.close(); document.body.style.overflow = bodyOverflow; document.documentElement.style.overflow = htmlOverflow;
        if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      };
    }, []);
    return h('dialog', { ref: dialogRef, className: 'finwb-modal', 'data-financial-request-detail': 'true', 'aria-modal': 'true', 'aria-labelledby': titleId,
      onCancel: (event) => { event.preventDefault(); onEscape(); },
      onKeyDown: (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onEscape(); }
        if (event.key === 'Tab') {
          const root = dialogRef.current.querySelector('[data-image-viewer],[data-document-viewer]') || dialogRef.current;
          const controls = Array.from(root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter((node) => node.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (first && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        }
      }
    }, h('header', { className: 'finwb-detail-head' }, header,
      h('button', { ref: closeRef, type: 'button', className: 'finwb-modal-close', onClick: onClose, 'aria-label': 'Cerrar detalle de solicitud' }, '×')), children);
  }

  function FinancialActionDialog({ model, busy, error, onConfirm, onClose }) {
    const ref = React.useRef(null), titleId = React.useId();
    useEffect(() => {
      const opener = document.activeElement, dialog = ref.current;
      dialog.showModal();
      return () => { dialog.close(); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); };
    }, []);
    return h('dialog', { ref, className: 'finwb-action-dialog', 'data-financial-confirmation': model.action, 'aria-labelledby': titleId, 'aria-modal': 'true', 'aria-busy': busy,
      onCancel: event => { event.preventDefault(); if (!busy) onClose(); },
      onKeyDown: event => {
        event.stopPropagation();
        if (event.key === 'Tab') {
          const controls = Array.from(ref.current.querySelectorAll('button:not(:disabled)'));
          const first = controls[0], last = controls[controls.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
        }
      },
      style: { width: 'min(520px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', border: '1px solid var(--hairline)', borderRadius: 22, padding: 24, background: 'var(--surface)', color: 'var(--ink)', boxShadow: '0 24px 80px #0005' } },
      h('style', null, '.finwb-action-dialog::backdrop{background:#17203366}.finwb-action-dialog button{min-height:44px;border:0;border-radius:12px;padding:10px 18px;font:750 14px var(--font, sans-serif);cursor:pointer}.finwb-action-dialog button:disabled{opacity:.55;cursor:wait}.finwb-action-dialog button:focus-visible{outline:3px solid var(--guinda);outline-offset:3px}'),
      h('h2', { id: titleId, style: { margin: '0 0 18px', fontSize: 23 } }, model.title),
      h('dl', { className: 'finwb-kv' }, model.fields.map(([label, value]) => h('div', { key: label, style: { overflowWrap: 'anywhere' } }, h('dt', { style: { color: 'var(--ink-3)', fontSize: 12 } }, label), h('dd', { style: { margin: '4px 0 12px', fontWeight: 750 } }, value)))),
      h('p', { style: { padding: 14, borderRadius: 14, background: model.warning ? '#FFF3DC' : 'var(--surface-2)', lineHeight: 1.5 } }, model.message),
      error && h('p', { role: 'alert', style: { color: '#A32921', lineHeight: 1.5 } }, error),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 20 } },
        h('button', { type: 'button', className: 'finwb-secondary', autoFocus: true, disabled: busy, onClick: onClose }, 'Volver'),
        h('button', { type: 'button', className: 'finwb-primary', disabled: busy, onClick: onConfirm, style: model.warning ? { background: '#A32921' } : undefined }, busy ? 'Procesando…' : model.label)));
  }

  function FinancialAuthorizationResult({ result, onClose }) {
    const ref = React.useRef(null);
    const titleId = React.useId();
    useEffect(() => {
      const dialog = ref.current, opener = document.activeElement;
      dialog.showModal();
      return () => { dialog.close(); if (opener && opener.isConnected) opener.focus({ preventScroll: true }); };
    }, []);
    useEffect(() => {
      if (!result.celebrate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.MOTION && (window.MOTION.reduced() || window.MOTION.frozen())) return;
      const animations = Array.from(ref.current.querySelectorAll('i')).map((piece, i) => piece.animate([
        { transform: 'translateY(-20px) rotate(0)', opacity: 0 }, { opacity: 1, offset: .1 },
        { transform: 'translateY(230px) rotate(420deg)', opacity: 0 }
      ], { duration: 1300, delay: i * 17, fill: 'both' }));
      return () => animations.forEach(animation => animation.cancel());
    }, [result]);
    return h('dialog', { ref, 'aria-labelledby': titleId, 'aria-modal': 'true', onCancel: event => { event.preventDefault(); onClose(); }, onKeyDown: event => { event.stopPropagation(); if (event.key === 'Tab') { event.preventDefault(); ref.current.querySelector('button').focus(); } }, 'data-financial-result': result.kind, style: { width: 'min(480px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', padding: 24, border: 0, borderRadius: 20, background: result.warning ? '#FFF3DC' : '#E7F6ED', color: result.warning ? '#704D13' : '#13794A' } },
      result.celebrate && h('div', { 'aria-hidden': 'true', 'data-authorization-confetti': 'true', style: { position: 'absolute', inset: 0, pointerEvents: 'none' } }, Array.from({ length: 24 }, (_, i) => h('i', { key: i, style: { position: 'absolute', opacity: 0, top: 0, left: ((i * 37) % 100) + '%', width: 6, height: 10, background: ['#901040', '#D9A441', '#13794A'][i % 3] } }))),
      h('h2', { id: titleId, style: { display: 'block', fontSize: 21, margin: 0 } }, result.title),
      h('p', { style: { margin: '8px 0', overflowWrap: 'anywhere' } }, result.folio + ' · ' + result.name),
      result.next && h('p', null, 'Ahora continúa: ' + result.next),
      h('button', { className: 'finwb-secondary', onClick: onClose, style: { minHeight: 44, padding: '10px 18px', border: 0, borderRadius: 12, font: '750 14px var(--font, sans-serif)', cursor: 'pointer' } }, 'Entendido'));
  }

  function FinanceQueuePhoto({ row }) {
    const ref = React.useRef(null), demand = window.PrivateResourceDemand;
    const visible = demand.useVisible(ref);
    const source = demand.useSource('finance-queue-photo:' + row.affiliate_id, () =>
      demand.run('finance-queue-photo:' + row.affiliate_id, async () => {
        const photo = await window.AffiliateRepository.getProfilePhoto(row.affiliate_id);
        return photo ? { signedUrl: photo.signedUrl, expiresIn: Math.max(1, (photo.expiresAt - Date.now()) / 1000) } : { signedUrl: '' };
      }), visible, 240);
    const initials = row.nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const label = source.error ? 'Foto no disponible' : source.url ? 'Foto de ' + row.nombre : 'Sin foto de perfil';
    return h('span', { ref, className: 'finwb-profile-photo', 'data-financial-queue-photo': row.affiliate_id, 'data-photo-state': source.error ? 'error' : source.url ? 'photo' : 'initials', title: label, 'aria-label': label },
      source.url ? h('img', { src: source.url, alt: '', loading: 'lazy', decoding: 'async', onError: source.onError }) : initials);
  }

  function DesktopFinancialWorkbench({ app, onCount, initialAffiliateId }) {
    const [deleting, setDeleting] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false), modalTitleId = React.useId();
    const [rows, setRows] = useState([]), [phase, setPhase] = useState('loading'), [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(''), [detail, setDetail] = useState(null), [detailPhase, setDetailPhase] = useState('idle'), [detailNonce, setDetailNonce] = useState(0);
    const [search, setSearch] = useState(''), [statusFilter, setStatusFilter] = useState('all'), [programFilter, setProgramFilter] = useState('all'), [stageFilter, setStageFilter] = useState('all'), [ageFilter, setAgeFilter] = useState('all'), [dateFilter, setDateFilter] = useState(''), [sort, setSort] = useState('newest');
    const [action, setAction] = useState(''), [actionNote, setActionNote] = useState(''), [quoteAmount, setQuoteAmount] = useState(''), [quoteValidUntil, setQuoteValidUntil] = useState(''), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(null), [rowFeedback, setRowFeedback] = useState({}), [viewer, setViewer] = useState(null);
    const actionAttempts = React.useRef(new Map()), actionLock = React.useRef(false);
    const [confirmation, setConfirmation] = useState(null), [actionResult, setActionResult] = useState(null);
    useEffect(ensureWorkbenchStyles, []);
    const load = React.useCallback(async (quiet) => { try { if (!quiet) setPhase('loading'); const source = await window.AdminFinanceQueueRepository.enrich(await window.ProgramRequestRepository.listAdminFlowQueue()); const scoped=initialAffiliateId?source.filter((row)=>row.affiliate_id===initialAffiliateId):source; setRows(scoped.slice()); setError(''); setPhase('loaded'); onCount(scoped.length); return scoped; } catch (_) { if (!quiet) setRows([]); setError('No fue posible cargar las solicitudes.'); setPhase('error'); onCount(0); return []; } }, [onCount,initialAffiliateId]);
    useEffect(() => { load(false); }, [load]);
    const programs = React.useMemo(() => Array.from(new Map(rows.map((row) => [row.program_id + ':' + (row.request_type || ''), programLabel(row)])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'es')), [rows]);
    const stages = React.useMemo(() => Array.from(new Map(rows.map((row) => [currentStage(row) && currentStage(row).id, stageLabel(row)]).filter((item) => item[0])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'es')), [rows]);
    const visible = React.useMemo(() => { const needle = search.trim().toLocaleLowerCase('es-MX'); const filtered = rows.filter((row) => {
      const text = [row.folio, row.nombre, row.numero_control, queueProgramLabel(row)].join(' ').toLocaleLowerCase('es-MX');
      if (needle && !text.includes(needle)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (programFilter !== 'all' && row.program_id + ':' + (row.request_type || '') !== programFilter) return false;
      if (stageFilter !== 'all' && (!currentStage(row) || currentStage(row).id !== stageFilter)) return false;
      const days = ageDays(row.created_at); if (ageFilter === 'today' && days !== 0 || ageFilter === '3d' && days < 3 || ageFilter === '7d' && days < 7 || ageFilter === '30d' && days < 30) return false;
      return !dateFilter || dayKey(row.created_at) === dateFilter;
    }); return filtered.sort((a, b) => sort === 'oldest' ? a.ts - b.ts : sort === 'amount' ? Number(b.requested_amount || 0) - Number(a.requested_amount || 0) : b.ts - a.ts); }, [rows, search, statusFilter, programFilter, stageFilter, ageFilter, dateFilter, sort]);
    useEffect(() => { if (!visible.length) setSelectedId(''); else if (!visible.some((row) => row.id === selectedId)) setSelectedId(visible[0].id); }, [visible, selectedId]);
    useEffect(() => { if (!selectedId) { setDetail(null); setDetailPhase('idle'); return; } let active = true; setDetailPhase('loading'); setFeedback(null); setActionNote(''); setQuoteAmount(''); setQuoteValidUntil(''); setViewer(null); window.ProgramRequestRepository.adminFlowDetail(selectedId).then((value) => { if (active) { setDetail(value); setDetailPhase('loaded'); } }).catch(() => { if (active) { setDetail(null); setDetailPhase('error'); } }); return () => { active = false; }; }, [selectedId, detailNonce]);
    const index = visible.findIndex((row) => row.id === selectedId), selected = index >= 0 ? visible[index] : null;
    const actionOptions = React.useMemo(() => { if (!detail || !app.admin.has('program_requests.write')) return []; const target=nextStage(detail),snapshot=detail.financial_submission_snapshot||{},productPayment=snapshot.contract_version==='PROGRAM_PRODUCT_PAYMENT_V1',statusRefs=target&&target.status_references||[],options=[]; if (['requires_financial_processing','submitted'].includes(detail.status)) options.push({ id:'review',label:'Iniciar revisión' }); if (target) { if (statusRefs.includes('approved') && detail.request_type==='quote' && (workflowOf(detail).can_quote===true||detail.financial_processing_status==null)) options.push({id:'quoteAdvance',label:'Guardar cotización y aprobar etapa'}); else if (statusRefs.includes('approved') && detail.financial_processing_status!=null) options.push({id:productPayment?'approveProduct':'approveLoan',label:productPayment?'Aprobar etapa en Supabase':'Aprobar etapa y autorizar préstamo'}); else options.push({id:'advance',label:statusRefs.includes('approved')?'Aprobar etapa':'Avanzar a siguiente etapa'}); } if (!['approved','rejected','cancelled'].includes(detail.status) && (workflowOf(detail).can_reject===true||(workflowOf(detail).stages||[]).some((stage)=>stage.outcome==='failure'))) options.push({id:'reject',label:'Rechazar etapa'}); if (!['approved','rejected','cancelled'].includes(detail.status)) options.push({id:'cancel',label:'Cancelar solicitud'}); if (detail.program_id==='prestamo' && detail.status==='approved' && ['ready_for_handoff','failed'].includes(detail.financial_processing_status)) options.push({id:'handoff',label:detail.financial_processing_status==='failed'?'Reintentar envío a gestión':'Enviar a gestión'}); options.push({id:'note',label:'Guardar observación'}); return options; }, [detail, app]);
    useEffect(() => { if (!actionOptions.some((item) => item.id === action)) setAction(actionOptions[0] && actionOptions[0].id || ''); }, [actionOptions, action]);
    const clearFilters = () => { setSearch(''); setStatusFilter('all'); setProgramFilter('all'); setStageFilter('all'); setAgeFilter('all'); setDateFilter(''); setSort('newest'); };
    const move = (delta) => { if (!visible.length) return; const next = Math.max(0, Math.min(visible.length - 1, (index < 0 ? 0 : index) + delta)); setSelectedId(visible[next].id); };
    const save = async (advance, confirmed = false) => { if (!detail || !action || busy || actionLock.current) return; const targetBefore=nextStage(detail),currentBefore=currentStage(detail); if (actionNote.trim().length > 0 && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: 'La observación debe tener al menos 3 caracteres.' }); return; } if (action === 'note' && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: 'Escribe una observación de al menos 3 caracteres.' }); return; } if (['reject', 'cancel'].includes(action) && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: action === 'reject' ? 'Indica el motivo del rechazo.' : 'Indica el motivo de la cancelación.' }); return; } if (action==='quoteAdvance' && numberValue(quoteAmount)==null) { setFeedback({tone:'error',text:'Captura el monto de la cotización antes de aprobar la etapa.'}); return; }
      const finalApproval = ['advance','quoteAdvance','approveProduct','approveLoan'].includes(action) && targetBefore && (targetBefore.status_references || []).includes('approved');
      if (!confirmed && action !== 'note') {
        const warning = ['reject','cancel'].includes(action);
        const label = action === 'reject' ? 'Rechazar solicitud' : action === 'cancel' ? 'Cancelar solicitud' : finalApproval ? 'Autorizar solicitud' : action === 'review' ? 'Iniciar revisión' : action === 'handoff' ? 'Enviar a gestión' : 'Aprobar etapa';
        const destination = action === 'reject' ? 'Rechazada' : action === 'cancel' ? 'Cancelada' : action === 'review' ? 'En revisión' : targetBefore && targetBefore.label || stageLabel(detail);
        setFeedback(null);
        setConfirmation({ action, advance, warning, label, title: label === 'Aprobar etapa' ? '¿Aprobar esta etapa?' : '¿' + label + '?',
          fields: [['Solicitud', detail.folio], ['Afiliado', detail.nombre], ['Programa', programLabel(detail)],
            ...(detail.requested_amount != null ? [['Monto', moneyValue(detail.requested_amount)]] : []),
            ...(detail.requested_term ? [['Plazo', detail.requested_term + ' ' + (detail.requested_term_semantics || 'pagos')]] : []),
            ...(action === 'quoteAdvance' ? [['Cotización', moneyValue(quoteAmount)]] : []),
            ['Etapa actual', stageLabel(detail)], ['Estado / etapa resultante', destination],
            ...(actionNote.trim() ? [['Comentario', actionNote.trim()]] : [])],
          message: action === 'handoff' ? 'Se enviará la solicitud con la autorización ya registrada. El resultado de la gestión se mostrará al terminar.' : warning ? 'Al confirmar, la solicitud quedará ' + destination.toLowerCase() + '. El afiliado podrá consultar el resultado y el motivo en su historial.' : 'Al confirmar, la solicitud avanzará a ' + destination + ' y el afiliado verá la nueva etapa en su historial.' });
        return;
      }
      actionLock.current = true;
      const currentId = detail.id, nextId = visible[index + 1] && visible[index + 1].id || visible[index - 1] && visible[index - 1].id || currentId; setBusy(true); setFeedback({ tone: 'saving', text: 'Procesando…' }); setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'saving' }));
      const adminAction = { review: 'MARK_IN_REVIEW', cancel: 'CANCEL', note: 'COMMENT' }[action], fingerprint = [currentId, action, actionNote.trim(), quoteAmount, quoteValidUntil].join('|'); let persistedEvent = null;
      try { const actionId = actionAttempts.current.get(fingerprint) || window.ProgramRequestRepository.newIdempotencyKey(); actionAttempts.current.set(fingerprint, actionId); if (adminAction) persistedEvent = await window.ProgramRequestRepository.recordAdminAction(currentId, adminAction, actionNote.trim(), actionId); else if (action === 'advance' || action === 'reject' || action === 'quoteAdvance') { const result=await window.ProgramRequestRepository.transitionWorkflow(currentId,action==='reject'?'REJECT':'ADVANCE',actionNote.trim(),actionId,action==='quoteAdvance'?{amount:quoteAmount,validUntil:quoteValidUntil}:null);persistedEvent=result.event; } else if (action === 'approveProduct') await window.ProgramRequestRepository.approveProductPayment(currentId,actionNote.trim(),actionId); else if (action === 'approveLoan') await window.FinancialLegacyRepository.approveRequest(currentId, actionNote.trim()); else if (action === 'handoff') await window.FinancialLegacyRepository.handoffRequest(currentId);
        const refreshed = await load(true), verified = refreshed.find((row) => row.id === currentId), verifiedDetail=await window.ProgramRequestRepository.adminFlowDetail(currentId), verifiedCurrent=currentStage(verifiedDetail); let valid = Boolean(verified); if (action === 'review') valid=valid&&verified.status==='in_review'; else if (action === 'reject') valid=valid&&verified.status==='rejected'&&verifiedCurrent&&verifiedCurrent.outcome==='failure'; else if (action === 'cancel') valid=valid&&verified.status==='cancelled'; else if (['advance','quoteAdvance','approveProduct','approveLoan'].includes(action)) valid=valid&&targetBefore&&verifiedCurrent&&verifiedCurrent.id===targetBefore.id; else if (action === 'handoff') valid=valid&&verified.status==='approved'&&(verified.financial_processing_status==='handed_off'||verifiedDetail.google_sync&&['pending','processing','error'].includes(verifiedDetail.google_sync.phase)); if (valid && persistedEvent) valid=verifiedDetail.admin_events_available&&verifiedDetail.admin_events.some((event)=>event.id===persistedEvent.id); if (!valid) throw new Error('FINANCIAL_ACTION_READBACK_FAILED');
        actionAttempts.current.delete(fingerprint); setDetail(verifiedDetail); setConfirmation(null);
        const authorized = finalApproval && verifiedDetail.status === 'approved' && detail.status !== 'approved';
        const title = action === 'reject' ? 'Solicitud rechazada' : action === 'cancel' ? 'Solicitud cancelada' : authorized ? '✓ Solicitud autorizada' : action === 'review' ? 'Revisión iniciada' : action === 'note' ? 'Observación guardada' : action === 'handoff' ? 'Gestión actualizada' : '✓ Etapa aprobada';
        setActionResult({ title, kind: authorized ? 'authorized' : action, warning: ['reject','cancel'].includes(action), celebrate: authorized, folio: detail.folio, name: detail.nombre, next: ['advance','quoteAdvance','approveProduct','approveLoan'].includes(action) && verifiedCurrent && verifiedCurrent.label });
        setFeedback({ tone: ['reject','cancel'].includes(action) ? 'warning' : 'success', text: title });
        window.dispatchEvent(new CustomEvent('suti:request-changed'));
 setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'success' })); setActionNote(''); setQuoteAmount(''); if (advance && nextId !== currentId) setSelectedId(nextId);
      } catch (actionError) { setFeedback({ tone: 'error', text: humanActionError(actionError) + ' No se confirmó el cambio; puedes reintentar.' }); setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'error' })); } finally { actionLock.current = false; setBusy(false); }
    };
    const previews = useFinancialDocumentPreviews(detail, detailPhase === 'loaded' && detail && detail.id === selectedId && app.admin.has('documents.read'), setViewer);
    const closeDetail = () => { if (busy || confirmation) return; setViewer(null); setDetailOpen(false); };
    const deleteRequest = async () => {
      if (!detail || busy || !app.admin.has('program_requests.write')) return;
      const id=detail.id;setBusy(true);setDeleting(true);setFeedback(null);
      try {
        const preview=await window.AdminRequestDeletionRepository.preview(id);
        if(preview.phase!=='completed'&&!window.confirm('¿Eliminar la solicitud '+preview.folio+' y sus '+preview.documents_count+' documentos enviados? También se retirará su registro de Google. El expediente del afiliado y sus imágenes se conservarán.')) return;
        await window.AdminRequestDeletionRepository.remove(preview,actionNote.trim().length>=3?actionNote.trim():'Eliminación confirmada desde Admin Solicitudes');
        setViewer(null);setDetailOpen(false);setDetail(null);setSelectedId('');await load(true);
      } catch (failure) {
        const code=String(failure?.message||''),messages={REQUEST_DELETE_DENIED:'No tienes permiso para eliminar solicitudes.',REQUEST_DELETE_SYNC_BUSY:'La solicitud se está sincronizando. Espera unos segundos y reintenta.',REQUEST_DELETE_CHANGED:'La solicitud cambió. Actualiza el detalle y vuelve a confirmar.',REQUEST_DELETE_DEPENDENT_REQUEST:'Otra solicitud utiliza esta cotización; debe conservarse su referencia.',REQUEST_DELETE_LEGACY_REVIEW_REQUIRED:'No se pudo verificar el registro histórico de Google. La eliminación requiere revisar esa referencia.',REQUEST_DELETE_IN_PROGRESS:'Hay una eliminación pendiente. Usa Eliminar solicitud para reintentar.'};
        setFeedback({tone:'error',text:messages[code]||'No se completó la eliminación. Reintenta con Eliminar solicitud; el expediente del afiliado se conserva.'});
      } finally { setBusy(false);setDeleting(false); }
    };
    const onKeyDown = (event) => { if (detailOpen || /INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName)) return; if (event.key === 'ArrowDown') { event.preventDefault(); move(1); } else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); } else if (event.key === 'Enter' && selectedId) { event.preventDefault(); setDetailOpen(true); } };
    const renderConditions = (title, result, fallback) => h('section', { className: 'finwb-card', 'data-financial-snapshot': title }, h('h3', null, h(I, { name: 'cash', size: 17, stroke: 2 }), title), result || fallback ? h('div', { className: 'finwb-kv' },
      [['Monto solicitado', moneyValue(result && result.amount != null ? result.amount : detail.requested_amount)], ['Fondo / programa', result && result.fund || programLabel(detail)], ['Plazo', (result && result.paymentCount || detail.requested_term || '—') + (result && result.paymentPeriod || detail.requested_term_semantics ? ' · ' + (result && result.paymentPeriod || detail.requested_term_semantics) : '')], ['Tasa aplicada', result && result.rate != null ? result.rate + '%' + (result.ratePeriod ? ' · ' + result.ratePeriod : '') : '—'], ['Pago por periodo', moneyValue(result && result.paymentPerPeriod)], ['Interés', moneyValue(result && result.interest)], ['Gasto administrativo', moneyValue(result && result.administrativeFeeTotal)], ['Total', moneyValue(result && result.total)]].map((item) => h('div', { key: item[0] }, h('span', null, item[0]), h('strong', null, item[1])))) : h('div', { className: 'finwb-snapshot-note' }, 'Snapshot contractual no disponible. No se recalculan valores históricos con reglas actuales.'));
    const renderProductPayment = (snapshot) => { if (!snapshot || snapshot.contract_version !== 'PROGRAM_PRODUCT_PAYMENT_V1') return null; const product = snapshot.product || {}, schedule = snapshot.payment_schedule || {}, rows = Array.isArray(schedule.rows) ? schedule.rows : []; return h('section', { className: 'finwb-card', 'data-financial-product-payment': 'true' },
      h('h3', null, h(I, { name: 'receipt', size: 17, stroke: 2 }), 'Producto y plan aceptado'),
      h('div', { className: 'finwb-kv' }, [['Producto', product.name || programLabel(detail)], ['Programa', product.program_key || detail.program_id], ['Origen del precio', snapshot.price_source === 'PRICE_CASH' ? 'Precio publicado' : 'Cotización autorizada'], ['Precio autorizado', moneyValue(snapshot.authorized_price)], ['Enganche', moneyValue(snapshot.down_payment)], ['Monto financiado', moneyValue(snapshot.financed_amount)], ['Plazo', (snapshot.term || detail.requested_term || '—') + ' pagos'], ['Calendario', rows.length ? (schedule.first_payment_date + ' → ' + schedule.last_payment_date) : 'No disponible']].map((item) => h('div', { key: item[0] }, h('span', null, item[0]), h('strong', null, item[1])))),
      rows.length ? h('details', { style: { marginTop: 11 } }, h('summary', { style: { cursor: 'pointer', color: 'var(--guinda)', fontSize: 11.5, fontWeight: 850 } }, 'Ver calendario de ' + rows.length + ' descuentos'), h('div', { style: { marginTop: 7, maxHeight: 220, overflow: 'auto' } }, rows.map((row) => h('div', { key: row.number, style: { display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 8, padding: '6px 4px', borderTop: '1px solid var(--hairline)', fontSize: 11.5 } }, h('strong', null, row.number), h('span', null, row.date), h('strong', null, moneyValue(row.payment)))))) : null);
    };
    const renderWorkflow = () => {
      const workflow=workflowOf(detail),current=currentStage(detail),next=nextStage(detail),steps=workflow.stages||[];
      if(!workflow.available)return h('section',{className:'finwb-card','data-financial-workflow':'true'},h('h3',null,h(I,{name:'clock',size:17,stroke:2}),'Flujo completo de la solicitud'),h('div',{className:'finwb-snapshot-note'},workflow.message||'Seguimiento no disponible.'));
      return h('section',{className:'finwb-card','data-financial-workflow':'true'},
        h('h3',null,h(I,{name:'clock',size:17,stroke:2}),'Flujo completo de la solicitud'),
        h('div',{className:'finwb-flow-summary'},
          h('div',{className:'finwb-sub'},(workflow.workflow_name||'Flujo aplicado')+(workflow.workflow_version?' · versión '+workflow.workflow_version:'')),
          h('div',{className:'finwb-flow-current'},h('div',null,h('span',{className:'finwb-sub'},'ETAPA ACTUAL'),h('strong',null,current&&current.label||'No disponible'),current&&current.description&&h('p',null,current.description)),current&&h('span',{className:'finwb-responsible'},current.responsible||'Área responsable')),
          h('div',{className:'finwb-next-action'},next?'Siguiente acción: '+next.label+' · Responsable: '+(next.responsible||'Área responsable'):'Flujo completado · no hay otra etapa pendiente')),
        h('div',{className:'finwb-steps'},steps.map((stage,stageIndex)=>
          h('div',{className:'finwb-step','data-state':stage.state,key:stage.id},
            h('span',{className:'finwb-step-dot'},stage.state==='done'?'✓':stageIndex+1),
            h('div',null,h('strong',null,stage.label),h('p',null,(stage.state==='done'?'Completada':stage.state==='current'?'Actual':'Pendiente')+' · '+(stage.responsible||'Sin responsable')+(stage.date?' · '+dateValue(stage.date):'')),stage.description&&h('p',null,stage.description))))));
    };
    const renderDocumentRows = (documents, scope) => documents.map((document) => {
      const viewKey = scope + ':' + document.id, view = previews.views[viewKey] || {}, status = document.status_at_submission || document.status || 'No disponible';
      const mime = String(document.mimeType || '').toLowerCase(), title = document.document_type && document.document_type.label || 'Documento';
      const ready = view.phase === 'ready' && view.url && view.expiresAt > Date.now(), failed = view.phase === 'error';
      const open = () => previews.open(viewKey), mediaError = () => previews.failed(viewKey, view.url);
      const preview = ready ? (mime.startsWith('image/') || mime === 'application/pdf' ? h('button', {
        type: 'button', className: 'finwb-doc-preview', onClick: open, disabled: !!view.busy, 'aria-label': (mime.startsWith('image/') ? 'Ampliar ' : 'Abrir ') + title
      }, mime.startsWith('image/') ? h('img', { src: view.url, alt: 'Vista previa de ' + title, onError: mediaError }) : h('iframe', { src: view.url + '#toolbar=0&navpanes=0', title: 'Vista previa de ' + title, tabIndex: -1, onError: mediaError })) : h('span', { className: 'finwb-doc-preview' }, h(I, { name: 'doc', size: 24, stroke: 1.8 })))
        : h('span', { className: 'finwb-doc-preview', role: 'status' }, h(I, { name: failed ? 'warning' : 'clock', size: 22 }));
      const openAction = ready ? (mime.startsWith('image/') || mime === 'application/pdf' ? h('button', { type: 'button', onClick: open, disabled: !!view.busy }, view.busy ? 'Cargando…' : mime === 'application/pdf' ? 'Ver PDF' : 'Ampliar') : h('a', { href: view.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir'))
        : failed ? h('button', { type: 'button', onClick: () => previews.retry(viewKey) }, 'Reintentar') : null;
      return h('div', { className: 'finwb-doc', key: viewKey }, preview,
        h('div', { className: 'finwb-doc-main' }, h('div', { className: 'finwb-person' }, title),
          h('div', { className: 'finwb-sub' }, (scope === 'request' ? 'Estado al enviar: ' : 'Estado vigente: ') + status),
          h('div', { className: 'finwb-sub' }, failed ? 'Vista no disponible · el archivo sigue privado' : !ready ? 'Preparando vista segura…' : mime === 'application/pdf' ? 'PDF listo para revisar' : mime.startsWith('image/') ? 'Imagen lista para revisar' : 'Documento listo para abrir')), openAction);
    });
    const renderNavigation = () => h('div', { className: 'finwb-buttons' },
      h('button', { className: 'finwb-secondary', disabled: index <= 0 || busy, onClick: () => move(-1) }, 'Anterior'),
      h('button', { className: 'finwb-secondary', disabled: index < 0 || index >= visible.length - 1 || busy, onClick: () => move(1) }, 'Siguiente solicitud'));
    const renderDetail = () => { if (detailPhase === 'loading') return h('div', { className: 'finwb-empty' }, h(I, { name: 'clock', size: 28 }), 'Cargando detalle autorizado…'); if (detailPhase === 'error') return h('div', { className: 'finwb-empty' }, h(I, { name: 'warning', size: 28 }), 'No fue posible cargar el detalle.', h('button', { onClick: () => setDetailNonce((value) => value + 1) }, 'Reintentar')); if (!detail) return h('div', { className: 'finwb-empty' }, 'Selecciona una solicitud para revisar su expediente.'); const submission = snapshotResult(detail, false), approval = snapshotResult(detail, true), productPayment = detail.financial_submission_snapshot && detail.financial_submission_snapshot.contract_version === 'PROGRAM_PRODUCT_PAYMENT_V1' ? detail.financial_submission_snapshot : null, events = timelineEvents(detail);
      return h(React.Fragment, null,
        h('div', { className: 'finwb-detail-scroll' },
          h('section', { className: 'finwb-card', 'data-financial-detail-person': 'true' }, h('h3', null, h(I, { name: 'user', size: 17, stroke: 2 }), 'Solicitante'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Afiliado'), h('strong', null, detail.nombre)), h('div', null, h('span', null, 'Número de control'), h('strong', null, detail.numero_control)), h('div', null, h('span', null, 'Fecha'), h('strong', null, dateValue(detail.created_at))), h('div', null, h('span', null, 'Contexto'), h('strong', null, detail.impersonation_session_id ? 'Solicitud asistida · actor real preservado' : 'Solicitud propia'))), h(RequestBankReference, { reference: detail.deposit_reference })),
          h('section', { className: 'finwb-card' }, h('h3', null, h(I, { name: 'receipt', size: 17, stroke: 2 }), 'Resumen'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Resultado'), h('strong', null, statusMeta(detail.status).label)), h('div', null, h('span', null, 'Tipo'), h('strong', null, requestTypeLabel(detail))),detail.financial_processing_status!=null&&h('div',null,h('span',null,'Procesamiento financiero'),h('strong',null,processingMeta(detail.financial_processing_status).label)),detail.quoted_amount!=null&&h('div',null,h('span',null,'Monto cotizado'),h('strong',null,moneyValue(detail.quoted_amount)))), detail.notes && h('div', { className: 'finwb-snapshot-note', style: { marginTop: 10 } }, h('strong', null, 'Nota del solicitante'), h('div', null, detail.notes))),
          renderWorkflow(),
          h('section', { className: 'finwb-card', 'data-request-google-sync': detail.google_sync && detail.google_sync.phase || 'unavailable' }, h('h3', null, 'Registro en Google'), h('div', { className: 'finwb-snapshot-note' }, detail.google_sync && detail.google_sync.phase === 'synced' ? 'Historial de solicitudes actualizado · fila ' + detail.google_sync.google_row : detail.google_sync && detail.google_sync.phase === 'not_requested' ? 'Solicitud anterior a la sincronización automática; se registrará con la siguiente acción.' : 'El registro en Google está pendiente. Supabase conserva la solicitud; el backend reintentará sin duplicarla.')),
          renderProductPayment(productPayment),
          renderConditions('Condiciones de la solicitud', submission, detail.requested_amount != null || detail.requested_term != null),
          approval && renderConditions('Condiciones aprobadas', approval, true),
          h('section', { className: 'finwb-card', 'data-financial-documents': 'true' }, h('h3', null, h(I, { name: 'doc', size: 17, stroke: 2 }), 'Documentos enviados con esta solicitud'), !detail.documents_available ? h('div', { className: 'finwb-snapshot-note' }, 'No fue posible consultar la relación documental autorizada.') : !(detail.request_documents || []).length ? h('div', { className: 'finwb-snapshot-note' }, 'Esta solicitud no conserva documentos vinculados. No es posible reconstruir qué archivos fueron enviados usando el expediente actual.') : renderDocumentRows(detail.request_documents, 'request')),
          h('section', { className: 'finwb-card', 'data-financial-current-documents': 'true' }, h('h3', null, h(I, { name: 'doc', size: 17, stroke: 2 }), 'Expediente actual del afiliado'), h('div', { className: 'finwb-sub', style: { whiteSpace: 'normal', lineHeight: 1.45, marginBottom: 8 } }, 'Referencia vigente · no demuestra qué documentos acompañaron esta solicitud.'), !detail.current_documents_available ? h('div', { className: 'finwb-snapshot-note' }, 'No fue posible consultar el expediente actual. Verifica los permisos de documentos.') : !(detail.current_affiliate_documents || []).length ? h('div', { className: 'finwb-sub' }, 'El afiliado no tiene documentos vigentes disponibles.') : renderDocumentRows(detail.current_affiliate_documents, 'affiliate')),
          h('section', { className: 'finwb-card', 'data-financial-terms': 'true' }, h('h3', null, h(I, { name: 'checkCircle', size: 17, stroke: 2 }), 'Términos aceptados'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Aceptación'), h('strong', null, detail.terms_accepted ? 'Sí · al enviar la solicitud' : 'No registrada')), h('div', null, h('span', null, 'Versión'), h('strong', null, detail.terms_version ? detail.terms_version.title + ' · versión ' + detail.terms_version.version : detail.terms_available ? 'Sin versión vinculada' : 'No disponible')))),
          h('section', { className: 'finwb-card', 'data-financial-timeline': 'true' }, h('h3', null, h(I, { name: 'clock', size: 17, stroke: 2 }), 'Timeline'), !detail.admin_events_available ? h('div', { className: 'finwb-snapshot-note', style: { marginBottom: 9 } }, 'No fue posible consultar la bitácora administrativa.') : null, h('div', { className: 'finwb-timeline' }, events.map((event, eventIndex) => h('div', { className: 'finwb-event', key: event.title + eventIndex }, h('span', { className: 'finwb-event-dot' }), h('div', null, h('strong', null, event.title), h('p', null, dateValue(event.at) + ' · ' + event.text))))))),
        h('div', { className: 'finwb-actionbar', 'data-financial-safe-action-bar': 'true' }, actionOptions.length ? h(React.Fragment, null, h('div', { className: 'finwb-action-grid' }, h('select', { className: 'finwb-action-select', value: action, disabled: busy, onChange: (event) => { setAction(event.target.value); setActionNote(''); }, 'aria-label': 'Acción permitida para la etapa' }, actionOptions.map((item) => h('option', { key: item.id, value: item.id }, item.label))), h('div', null, h('span', { className: 'finwb-sub' }, 'Etapa actual'), h('strong', { style: { fontSize: 11.5 } }, stageLabel(detail)))), action==='quoteAdvance'&&h('div',{className:'finwb-action-grid',style:{marginTop:8}},h('input',{className:'finwb-action-select',type:'number',min:'0.01',step:'0.01',value:quoteAmount,onChange:(event)=>setQuoteAmount(event.target.value),placeholder:'Monto cotizado (MXN)','aria-label':'Monto de la cotización'}),h('input',{className:'finwb-action-select',type:'date',value:quoteValidUntil,onChange:(event)=>setQuoteValidUntil(event.target.value),'aria-label':'Vigencia de la cotización'})), h('textarea', { className: 'finwb-note', value: actionNote, disabled: busy || action === 'handoff', onChange: (event) => setActionNote(event.target.value), placeholder: action === 'reject' ? 'Motivo obligatorio del rechazo' : action === 'cancel' ? 'Motivo obligatorio de la cancelación' : action === 'note' ? 'Observación administrativa obligatoria' : action === 'handoff' ? 'El envío usa la autorización ya registrada' : 'Comentario para la bitácora (opcional)', 'aria-label': 'Observación de la acción' }), nextStage(detail)&&['advance','quoteAdvance','approveProduct','approveLoan'].includes(action)&&h('div',{className:'finwb-next-action','data-financial-next-action':'true'},'Confirmar moverá la solicitud de “'+stageLabel(detail)+'” a “'+nextStage(detail).label+'”. Responsable siguiente: '+(nextStage(detail).responsible||'Área responsable')+'.'), h('div', { className: 'finwb-buttons' }, h('button', { className: 'finwb-secondary', disabled: index <= 0 || busy, onClick: () => move(-1) }, 'Anterior'), h('button', { className: 'finwb-secondary', disabled: index < 0 || index >= visible.length - 1 || busy, onClick: () => move(1) }, 'Siguiente solicitud'), h('button', { className: 'finwb-primary', disabled: busy || !action, onClick: () => save(false) }, busy ? 'Procesando…' : (actionOptions.find((item)=>item.id===action)||{label:'Confirmar acción'}).label), h('button', { type:'button', className:'finwb-delete', disabled:busy, onClick:deleteRequest, 'data-request-delete':'true' }, deleting?'Eliminando…':'Eliminar solicitud')), feedback && h('div', { className: 'finwb-feedback', 'data-financial-action-feedback': feedback.tone, 'data-tone': feedback.tone }, feedback.text)) : h(React.Fragment, null, renderNavigation(), h('div', { className: 'finwb-sub' }, app.admin.has('program_requests.write') ? 'No hay transiciones disponibles para este estado.' : 'Consulta autorizada; las acciones requieren permiso de escritura.'))),
        viewer&&viewer.context===previews.identity&&window.DocumentViewer&&h(window.DocumentViewer,{source:viewer.source,mimeType:viewer.mimeType,title:viewer.title,onClose:()=>setViewer(null)}));
    };
    return h('div', { className: 'finwb-root', tabIndex: 0, onKeyDown, 'data-admin-financial-workbench': 'true' },
      h('div', { className: 'finwb-toolbar', 'data-financial-queue-toolbar': 'true' }, h('div', { className: 'finwb-filters' },
        h('div', { className: 'finwb-field' }, h('label', { htmlFor: 'finwb-search' }, 'Buscar'), h('input', { id: 'finwb-search', value: search, onChange: (event) => setSearch(event.target.value), placeholder: 'Folio, afiliado o programa', 'aria-label': 'Buscar solicitudes financieras' })),
        h('div', { className: 'finwb-field' }, h('label', null, 'Estado'), h('select', { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), 'aria-label': 'Filtrar por estado financiero' }, h('option', { value: 'all' }, 'Todos'), Object.keys(REQUEST_STATUS).map((value) => h('option', { key: value, value }, REQUEST_STATUS[value].label)))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Programa'), h('select', { value: programFilter, onChange: (event) => setProgramFilter(event.target.value), 'aria-label': 'Filtrar por programa financiero' }, h('option', { value: 'all' }, 'Todos'), programs.map((item) => h('option', { key: item[0], value: item[0] }, item[1])))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Etapa actual'), h('select', { value: stageFilter, onChange: (event) => setStageFilter(event.target.value), 'aria-label': 'Filtrar por etapa real de la solicitud' }, h('option', { value: 'all' }, 'Todas'), stages.map((item) => h('option', { key: item[0], value:item[0] }, item[1])))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Antigüedad'), h('select', { value: ageFilter, onChange: (event) => setAgeFilter(event.target.value), 'aria-label': 'Filtrar por antigüedad financiera' }, h('option', { value: 'all' }, 'Todas'), h('option', { value: 'today' }, 'Hoy'), h('option', { value: '3d' }, '3 días o más'), h('option', { value: '7d' }, '7 días o más'), h('option', { value: '30d' }, '30 días o más'))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Fecha'), h('input', { type: 'date', value: dateFilter, onChange: (event) => setDateFilter(event.target.value), 'aria-label': 'Filtrar por fecha financiera' })),
        h('div', { className: 'finwb-field' }, h('label', null, 'Orden'), h('select', { value: sort, onChange: (event) => setSort(event.target.value), 'aria-label': 'Ordenar solicitudes financieras' }, h('option', { value: 'newest' }, 'Más recientes'), h('option', { value: 'oldest' }, 'Más antiguas'), h('option', { value: 'amount' }, 'Mayor monto')))),
        h('div', { className: 'finwb-results' }, h('span', null, h('strong', null, visible.length), ' resultados'), h('button', { type: 'button', onClick: clearFilters }, 'Limpiar filtros'))),
      h('div', { className: 'finwb-grid' }, h('section', { className: 'finwb-panel finwb-queue', 'data-financial-queue': 'true' }, h('div', { className: 'finwb-queue-head' }, h('span', null, 'Folio'), h('span', null, 'Foto'), h('span', null, 'Afiliado / programa'), h('span', null, 'Monto / plazo'), h('span', null, 'Estado / etapa'), h('span', null, 'Antig.')), h('div', { className: 'finwb-queue-body' }, phase === 'loading' ? h('div', { className: 'finwb-empty' }, 'Cargando solicitudes…') : phase === 'error' ? h('div', { className: 'finwb-empty' }, error, h('button', { onClick: () => load(false) }, 'Reintentar')) : !visible.length ? h('div', { className: 'finwb-empty' }, 'No hay solicitudes con estos filtros.') : visible.map((row) => h('button', { key: row.id, className: 'finwb-row', 'data-financial-queue-row': row.id, 'aria-selected': row.id === selectedId, 'aria-haspopup': 'dialog', onClick: () => { setSelectedId(row.id); setDetailOpen(true); } }, h('span', { className: 'finwb-folio' }, row.folio), h(FinanceQueuePhoto, { row }), h('span', null, h('span', { className: 'finwb-person', 'data-financial-queue-person': 'true' }, row.nombre), h('span', { className: 'finwb-sub' }, maskedControl(row.numero_control) + ' · ' + queueProgramLabel(row))), h('span', null, h('span', { className: 'finwb-amount' }, moneyValue(row.requested_amount!=null?row.requested_amount:row.quoted_amount)), h('span', { className: 'finwb-sub' }, row.requested_term ? row.requested_term + ' · ' + (row.requested_term_semantics || 'pagos') : row.request_type==='quote'?'Cotización':'Sin plazo financiero')), h('span', null, badge(statusMeta(row.status), 'data-financial-human-status', statusMeta(row.status).label), h('span', { className: 'finwb-stage' }, stageLabel(row)), rowFeedback[row.id] && h('span', { className: 'finwb-stage', 'data-financial-inline-feedback': rowFeedback[row.id] }, rowFeedback[row.id] === 'saving' ? 'Guardando…' : rowFeedback[row.id] === 'success' ? '✓ Actualizado' : '! Error')), h('span', { className: 'finwb-age' }, ageLabel(row.created_at)))))),
        detailOpen && h(FinancialRequestDetailModal, { titleId: modalTitleId, onClose: closeDetail, onEscape: () => viewer ? setViewer(null) : closeDetail(),
          header: h(React.Fragment, null, h('div', { className: 'finwb-modal-heading' },
            h('strong', null, (detailPhase === 'loaded' && detail && detail.id === selectedId ? detail : selected || {}).folio),
            h('h2', { id: modalTitleId }, (detailPhase === 'loaded' && detail && detail.id === selectedId ? detail : selected || {}).nombre),
            h('div', { className: 'finwb-sub' }, requestTypeLabel(selected) + ' \u00b7 ' + programLabel(selected) + ' \u00b7 ' + (index + 1) + ' de ' + visible.length)),
            badge(statusMeta((detailPhase === 'loaded' && detail && detail.id === selectedId ? detail : selected || {}).status), 'data-financial-human-status', statusMeta((detailPhase === 'loaded' && detail && detail.id === selectedId ? detail : selected || {}).status).label))
        }, actionResult && h(FinancialAuthorizationResult, { result: actionResult, onClose: () => setActionResult(null) }), confirmation && h(FinancialActionDialog, { model: confirmation, busy, error: feedback && feedback.tone === 'error' ? feedback.text : null, onClose: () => { if (!actionLock.current) setConfirmation(null); }, onConfirm: () => save(confirmation.advance, true) }), renderDetail(), detailPhase !== 'loaded' && h('footer', { className: 'finwb-actionbar', 'data-financial-safe-action-bar': 'true' }, renderNavigation()))));
  }

  function EstadoBadge({ estado }) {
    const e = window.FINANZAS.ESTADO(estado);
    return React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label);
  }

  function FinanzasModule({ app, onBack, header, initialAffiliateId }) {
    const desktop = useDesktop();
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    const [tab, setTab] = useState('sols');       // 'sols' | 'cots'
    const [desktopCount, setDesktopCount] = useState(0);
    const cotPend = qs ? qs.pendientes() : 0;

    const segBtn = (id, label, badge) => React.createElement('button', { key: id, onClick: () => setTab(id), style: { flex: 1, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: tab === id ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--ink-2)', boxShadow: tab === id ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      label, badge ? React.createElement('span', { style: { minWidth: 19, height: 19, borderRadius: 999, background: tab === id ? 'rgba(255,255,255,.25)' : 'var(--guinda)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' } }, badge) : null);

    return React.createElement('div', { 'data-admin-view':'finanzas' },
      header({ title: 'Finanzas · Solicitudes', sub: desktopCount + ' solicitud(es) · flujo real por programa', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 16 } },
          segBtn('sols', 'Solicitudes', null),
          segBtn('cots', 'Cotizaciones', cotPend || null)),
        tab === 'cots' ? React.createElement(CotizacionesAdmin, { qs, app }) : React.createElement(DesktopFinancialWorkbench, { app, onCount: setDesktopCount, initialAffiliateId, compact: !desktop })));
  }

  // ── Cotizaciones: solicitudes de interés + configuración de servicios ──
  function CotizacionesAdmin({ qs, app }) {
    const [open, setOpen] = useState(null);
    const [monto, setMonto] = useState('');
    const [nota, setNota] = useState('');
    const list = qs.all().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const items = [];
    // F1.2 — autoridad finCatStore; DATA.finanzasGroups solo como arranque controlado.
    ((window.finCatStore && window.finCatStore.allItems) ? window.finCatStore.allItems()
      : ((window.DATA && window.DATA.finanzasGroups) || []).reduce((a, g) => a.concat(g.items || []), [])
    ).forEach((it) => items.push(it));
    const r = open ? qs.get(open) : null;

    const cargar = async () => { const m = parseFloat(monto); if (!r || !m || m <= 0) return; try{await qs.cotizar(r.id, { monto: m, nota: nota.trim() }, 'Área de Finanzas');setOpen(null);setMonto('');setNota('');app.toast&&app.toast('Cotización cargada y notificada');}catch(_){app.toast&&app.toast('No se pudo guardar la cotización');} };

    return React.createElement('div', null,
      React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
        React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'Servicios con ', React.createElement('b', null, 'cotización previa'), ': el afiliado solicita, el proveedor (o Finanzas) cotiza, y solo entonces se habilita el simulador con el monto real.')),

      // Config: switch por servicio del catálogo
      React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '13px 15px', boxShadow: 'var(--neo-sm)', marginBottom: 16 } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 } }, 'Requieren cotización previa'),
        React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10, lineHeight: 1.45 } }, 'Actívalo para servicios sin precio fijo. Con el switch apagado, el afiliado simula de inmediato.'),
        items.map((it) => React.createElement('div', { key: it.id, style: { display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: '1px solid var(--hairline)' } },
          React.createElement('div', { style: { width: 32, height: 32, borderRadius: 9, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: it.icon, size: 17, stroke: 2 })),
          React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' } }, it.label),
          React.createElement(window.Toggle, { on: qs.requiresQuote(it.id), size: 'md', disabled:true, 'aria-label': 'Configuración de catálogo en solo lectura', glow: false, })))),

      // Listado de solicitudes de cotización
      React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em', margin: '0 0 10px' } }, 'SOLICITUDES DE COTIZACIÓN'),
      list.length === 0
        ? React.createElement(window.EmptyState, { icon: 'doc', title: 'Sin solicitudes', sub: 'Cuando un afiliado pida cotización, aparecerá aquí.' })
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
          list.map((c) => { const e = window.COTIZA.ESTADO(c.estado); return React.createElement('button', { key: c.id, onClick: () => { setOpen(c.id); setMonto(''); setNota(''); }, style: { textAlign: 'left', background: 'var(--surface)', borderRadius: 14, padding: 13, boxShadow: 'var(--neo-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--ink)' } }, c.productoNombre),
              React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label)),
            React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, marginTop: 4 } }, c.usuario.nombre + ' · ' + (c.empresaNombre ? 'Atiende: ' + c.empresaNombre : 'Atiende: Finanzas') + (c.cotizacion ? ' · ' + money(c.cotizacion.monto) : '')),
            React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, c.folio + ' · ' + c.fechaHora)); })),

      // Detalle / captura de cotización
      r && React.createElement('div', { onClick: () => setOpen(null), style: { position: 'fixed', inset: 0, zIndex: 76, background: 'rgba(16,12,14,.5)', display: 'flex', alignItems: 'flex-end' } },
        React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { width: '100%', background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom))', maxHeight: '88%', overflowY: 'auto' } },
          React.createElement('div', { style: { width: 40, height: 4.5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '4px auto 14px' } }),
          React.createElement('div', { style: { fontSize: 18, fontWeight: 900, marginBottom: 12 } }, 'Cotización ' + r.folio),
          [['Afiliado', r.usuario.nombre], ['Servicio', r.productoNombre], ['Proveedor asignado', r.empresaNombre || 'Área de Finanzas'], ['Fecha', r.fechaHora]].map((x) => React.createElement('div', { key: x[0], style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--hairline)' } },
            React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 } }, x[0]),
            React.createElement('span', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 700, textAlign: 'right' } }, x[1]))),
          r.mensaje && React.createElement('div', { style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px', fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginTop: 10, lineHeight: 1.45 } }, '“' + r.mensaje + '”'),
          r.estado === 'cotizada'
            ? React.createElement('div', { style: { background: '#E7F6ED', borderRadius: 13, padding: '12px 14px', marginTop: 14 } },
              React.createElement('div', { style: { fontSize: 12, fontWeight: 800, color: '#0b5c37' } }, 'COTIZACIÓN CARGADA'),
              React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: '#0b5c37', marginTop: 3 } }, money((r.cotizacion || {}).monto || 0)),
              React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#13794A', marginTop: 2 } }, 'Por ' + ((r.cotizacion || {}).actor || '') + ' · ' + ((r.cotizacion || {}).fechaHora || '')))
            : React.createElement('div', { style: { marginTop: 14 } },
              r.empresaNombre && React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10, lineHeight: 1.45 } }, 'Normalmente ' + r.empresaNombre + ' carga la cotización desde su Panel Empresarial; Finanzas puede capturarla en su nombre.'),
              React.createElement('input', { type: 'number', value: monto, placeholder: 'Monto cotizado (MXN)', onChange: (e) => setMonto(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 10 } }),
              React.createElement('input', { value: nota, placeholder: 'Nota (opcional)', onChange: (e) => setNota(e.target.value), style: { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 12 } }),
              React.createElement(window.Btn, { full: true, icon: 'upload', disabled: !parseFloat(monto), onClick: cargar }, 'Cargar cotización y notificar')))));
  }
  function kpi(icon, n, label, accent) {
    return React.createElement('div', { style: { flex: 1, background: accent ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: accent ? '#fff' : 'var(--ink)', borderRadius: 15, padding: '12px 13px', boxShadow: accent ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      React.createElement(I, { name: icon, size: 18, stroke: 2, style: { opacity: accent ? .9 : .5 } }),
      React.createElement('div', { style: { fontSize: 19, fontWeight: 900, marginTop: 5, letterSpacing: '-.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, n),
      React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, opacity: accent ? .9 : .6, marginTop: 1 } }, label));
  }

  // ── Detalle completo: toda la información capturada + seguimiento ──
  function RequestDetail({ app, r, onBack, header }) {
    const store = useStore(true);
    const [obs, setObs] = useState('');
    useEffect(() => { store.loadDetail(r.id).catch(() => {}); }, [r.id]);
    const sim = r.simulacion;
    const fld = (label, value, mono) => React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--hairline)' } },
      React.createElement('span', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 } }, label),
      React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--ink)', textAlign: 'right', fontFamily: mono ? 'var(--mono)' : 'inherit' } }, value == null || value === '' ? '—' : value));
    const card = (title, icon, rows) => React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: '4px 15px 8px', boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 6px' } },
        React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center' } }, React.createElement(I, { name: icon, size: 15, stroke: 2 })),
        React.createElement('span', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)' } }, title)),
      rows);

    return React.createElement('div', null,
      header({ title: 'Solicitud ' + r.folio, sub: r.fechaHora, onBack }),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 18, fontWeight: 800, color: 'var(--ink)' } }, r.productoNombre || r.programa || 'Suti Préstamo'),
            React.createElement('div', { style: { fontSize: 20, fontWeight: 900, color: 'var(--guinda)', marginTop: 2 } }, money(sim.montoSolicitado))),
          React.createElement(EstadoBadge, { estado: r.estado })),

        card('Solicitante', 'user', React.createElement('div', null,
          fld('Usuario', r.usuario.nombre),
          fld('No. de afiliado', r.usuario.numAfiliado, true),
          fld('Tipo de sindicato', r.usuario.sindicato),
          fld('Tipo de empleado', r.usuario.tipoEmpleado),
          fld('Categoría laboral', r.usuario.categoria))),

        card('Origen del financiamiento', 'grid', React.createElement('div', null,
          fld('Empresa / proveedor', r.empresaNombre),
          fld('Programa / convenio', r.programa),
          fld('Producto / servicio', r.productoNombre),
          fld('Tipo', r.productoTipo),
          r.cotizacion && fld('Cotización previa', r.cotizacion.folio + ' · ' + money(r.cotizacion.monto)),
          r.destino && fld('Destino', r.destino),
          fld('ID convenio', r.convenioId, true),
          fld('ID producto', r.productoId, true))),

        card('Simulación (descuento vía nómina)', 'cash', React.createElement('div', null,
          fld('Monto solicitado', moneyValue(sim.montoSolicitado)),
          fld('Monto autorizado (perfil)', moneyValue(sim.montoAutorizado)),
          fld('Plazo', sim.plazoQuincenas != null ? sim.plazoQuincenas + (sim.paymentPeriod ? ' · ' + sim.paymentPeriod : ' pagos') : '—'),
          fld('Tasa aplicada', sim.tasa != null ? sim.tasa + '%' + (sim.ratePeriod ? ' · ' + sim.ratePeriod : '') : '—'),
          fld('Pago por periodo', moneyValue(sim.pagoQuincenal)),
          fld('Interés total', moneyValue(sim.interesTotal)),
          fld('Gasto administrativo', moneyValue(sim.gastoAdministrativo)),
          fld('Total a pagar', moneyValue(sim.totalPagar)),
          sim.ratioNomina != null && fld('% de la quincena', sim.ratioNomina + '%'))),

        // Seguimiento: cambio de estado
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 15, boxShadow: 'var(--neo-sm)', marginBottom: 14 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 11 } }, 'Estado de la solicitud'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
            window.FINANZAS.ESTADOS.map((e) => { const transitionAllowed = e.id==='revision'&&['submitted','requires_financial_processing'].includes(r.status)||['aprobada','rechazada','cancelada'].includes(e.id)&&['submitted','requires_financial_processing','in_review'].includes(r.status); return React.createElement('button', {
              key: e.id, disabled:!transitionAllowed||!app.admin.has('program_requests.write'), title:e.id==='depositada'?'La confirmación del depósito se realiza por separado':e.id==='pendiente'?'El estado pendiente no se restablece manualmente':'', onClick: async () => {let reason='';if(['rechazada','cancelada'].includes(e.id)){reason=String(window.prompt(e.id==='rechazada'?'Motivo del rechazo':'Motivo de la cancelación')||'').trim();if(reason.length<3){app.toast&&app.toast('Escribe un motivo de al menos 3 caracteres');return;}}if(e.id==='aprobada'&&!window.confirm('¿Aprobar y enviar esta solicitud? Se guardará la autorización en Supabase y se intentará la entrega a Google.'))return;try{await store.setEstado(r.id,e.id,reason);app.toast&&app.toast('Estado actualizado');}catch(_){app.toast&&app.toast(e.id==='depositada'?'El depósito se confirma en el sistema financiero':'No se pudo actualizar');}},
              style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: r.estado === e.id ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: r.estado === e.id ? '#fff' : 'var(--ink-2)', boxShadow: r.estado === e.id ? 'var(--glow-guinda)' : 'var(--neo-inset)' },
            }, React.createElement(I, { name: e.icon, size: 14, stroke: 2.2 }), e.label); }))),

        // Observaciones y documentación
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, padding: 15, boxShadow: 'var(--neo-sm)' } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 900, color: 'var(--ink)', marginBottom: 11 } }, 'Observaciones y documentación'),
          (r.comentarios && r.comentarios.length)
            ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 } },
              r.comentarios.map((c, i) => React.createElement('div', { key: i, style: { background: 'var(--surface-2)', borderRadius: 11, padding: '9px 12px' } },
                React.createElement('div', { style: { fontSize: 13, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.45 } }, c.texto),
                React.createElement('div', { style: { fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 } }, (c.actor || 'Finanzas')))))
            : React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 12 } }, 'Sin observaciones registradas.'),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('input', { value: obs, disabled:!app.admin.has('program_requests.write'), placeholder: 'Agregar observación…', onChange: (e) => setObs(e.target.value), onKeyDown: async(e) => { if (e.key === 'Enter' && obs.trim()) { try{await store.addObs(r.id,obs.trim());setObs('');}catch(_){app.toast&&app.toast('No se pudo guardar la observación');} } }, style: { flex: 1, border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 11, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)' } }),
            React.createElement('button', { disabled:!app.admin.has('program_requests.write'), onClick: async() => { if(obs.trim()){try{await store.addObs(r.id,obs.trim());setObs('');}catch(_){app.toast&&app.toast('No se pudo guardar la observación');}} }, style: { width: 44, borderRadius: 11, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } }, React.createElement(I, { name: 'plus', size: 19, stroke: 2.4 }))))));
  }

  window.FinanzasModule = FinanzasModule;
})();
