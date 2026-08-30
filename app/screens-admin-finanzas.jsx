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
  const FINANCIAL_STAGE = Object.freeze({
    pending: { label: 'Validación financiera', tone: 'amber' },
    ready_for_handoff: { label: 'Pendiente de envío', tone: 'blue' },
    in_progress: { label: 'Enviando a gestión', tone: 'blue' },
    handed_off: { label: 'Entregada a gestión', tone: 'green' },
    failed: { label: 'Envío con error', tone: 'red' },
  });
  const PROGRAM_LABELS = Object.freeze({ prestamo: 'Suti Préstamo', caja: 'Caja de ahorro', nomina: 'Financiamiento vía nómina' });
  const TONES = Object.freeze({ amber: ['#FFF4D6', '#8A5A00'], blue: ['#E8F0FF', '#2456C7'], green: ['#E5F7EF', '#087A50'], red: ['#FCE9EE', '#A00027'], gray: ['#EEF0F4', '#596273'] });
  const ADMIN_EVENT_LABELS = Object.freeze({ COMMENT: 'Observación administrativa', MARK_IN_REVIEW: 'Marcada en revisión', REJECT: 'Solicitud rechazada', CANCEL: 'Solicitud cancelada', APPROVE: 'Financiamiento aprobado' });
  const programLabel = (row) => row && row.program_item && row.program_item.name || PROGRAM_LABELS[row && row.program_id] || 'Financiamiento';
  const statusMeta = (status) => REQUEST_STATUS[status] || { label: 'Estado no reconocido', tone: 'gray' };
  const stageMeta = (stage) => FINANCIAL_STAGE[stage] || { label: 'Etapa no disponible', tone: 'gray' };
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
      .finwb-queue{display:flex;flex-direction:column}.finwb-queue-head{display:grid;grid-template-columns:82px minmax(118px,1fr) 100px 112px 48px;gap:6px;padding:10px 9px;border-bottom:1px solid var(--hairline);font-size:9.5px;color:var(--ink-3);font-weight:900;letter-spacing:.03em;text-transform:uppercase}
      .finwb-queue-body{overflow:auto;min-height:0}.finwb-row{width:100%;display:grid;grid-template-columns:82px minmax(118px,1fr) 100px 112px 48px;gap:6px;align-items:center;padding:11px 9px;border:0;border-bottom:1px solid var(--hairline);background:transparent;text-align:left;font-family:inherit;cursor:pointer;color:var(--ink)}.finwb-row>span{display:block;min-width:0}
      .finwb-row[aria-selected=true]{background:#F8EDF1;box-shadow:inset 3px 0 0 var(--guinda)}.finwb-row:focus-visible{outline:2px solid var(--guinda);outline-offset:-2px}.finwb-folio{font:800 10.5px/1.35 var(--mono);color:var(--guinda);overflow-wrap:anywhere}.finwb-person{font-size:12.5px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.finwb-sub{font-size:10.5px;color:var(--ink-3);font-weight:650;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.finwb-amount{font-size:12.5px;font-weight:850}.finwb-age{font:800 11px var(--mono);color:var(--guinda)}
      .finwb-badge{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;font-size:10.5px;font-weight:850;line-height:1.2}.finwb-stage{font-size:10.5px;color:var(--ink-3);font-weight:750;margin-top:4px}
      .finwb-empty{display:grid;place-items:center;align-content:center;gap:8px;min-height:240px;padding:24px;text-align:center;color:var(--ink-3);font-size:12.5px;font-weight:700}
      .finwb-detail{display:flex;flex-direction:column}.finwb-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:13px 14px;border-bottom:1px solid var(--hairline);background:#F8F9FC}.finwb-detail-head strong{font:850 12px var(--mono);overflow-wrap:anywhere}.finwb-detail-scroll{overflow:auto;min-height:0;padding:12px 12px 104px}.finwb-card{border:1px solid #E1E5ED;border-radius:14px;padding:12px;margin-bottom:10px;background:#fff}.finwb-card h3{display:flex;align-items:center;gap:7px;margin:0 0 9px;font-size:13px}.finwb-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.finwb-kv span{display:block;font-size:10px;color:var(--ink-3);font-weight:750}.finwb-kv strong{display:block;margin-top:2px;font-size:12px;color:var(--ink);overflow-wrap:anywhere}.finwb-snapshot-note{padding:9px 10px;border-radius:10px;background:#FFF8E7;color:#71511B;font-size:11px;font-weight:700;line-height:1.45}
      .finwb-doc{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--hairline)}.finwb-doc:first-of-type{border-top:0}.finwb-doc-main{flex:1;min-width:0}.finwb-doc button,.finwb-doc a{border:0;border-radius:9px;padding:8px 10px;background:var(--surface-2);color:var(--guinda);font:800 11px inherit;text-decoration:none;cursor:pointer}.finwb-doc button:disabled{opacity:.55;cursor:default}
      .finwb-timeline{display:flex;flex-direction:column;gap:9px}.finwb-event{display:grid;grid-template-columns:10px 1fr;gap:9px}.finwb-event-dot{width:9px;height:9px;border-radius:50%;margin-top:4px;background:var(--guinda);box-shadow:0 0 0 4px #F8E8EE}.finwb-event strong{font-size:11.5px}.finwb-event p{margin:2px 0 0;font-size:10.5px;color:var(--ink-3);font-weight:650;line-height:1.4}
      .finwb-actionbar{position:absolute;left:0;right:0;bottom:0;padding:11px 12px;background:rgba(248,249,252,.97);border-top:1px solid #DDE2EA;backdrop-filter:blur(10px)}.finwb-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.finwb-note{margin-top:8px;resize:vertical;min-height:52px}.finwb-buttons{display:grid;grid-template-columns:auto auto 1fr;gap:8px;margin-top:8px}.finwb-buttons button{border:0;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:11.5px;font-weight:850;cursor:pointer}.finwb-buttons button:disabled{opacity:.5;cursor:default}.finwb-secondary{background:var(--surface);color:var(--ink-2);box-shadow:var(--neo-sm)}.finwb-primary{background:var(--guinda);color:#fff}.finwb-feedback{margin-top:7px;font-size:11px;font-weight:800}.finwb-feedback[data-tone=saving]{color:#7A5A16}.finwb-feedback[data-tone=success]{color:#087A50}.finwb-feedback[data-tone=error]{color:#A00027}
      @media(max-width:1279px){.finwb-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.finwb-kv{grid-template-columns:1fr}.finwb-grid{grid-template-columns:minmax(285px,.9fr) minmax(330px,1.1fr)}}
      @media(max-width:1359px){.finwb-queue-head,.finwb-row{grid-template-columns:68px minmax(0,1fr) 92px;gap:5px;padding-left:8px;padding-right:8px}.finwb-queue-head>*:nth-child(3),.finwb-row>*:nth-child(3){display:none}.finwb-queue-head>*:nth-child(5),.finwb-row>*:nth-child(5){display:none}.finwb-badge{box-sizing:border-box;max-width:100%;padding:0 6px;font-size:9.5px}}
      @media(min-width:1280px){.finwb-filters{grid-template-columns:minmax(180px,1.5fr) repeat(5,minmax(108px,1fr))}.finwb-grid{grid-template-columns:minmax(470px,1fr) minmax(440px,1fr)}}
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
    adminEvents.forEach((event) => events.push({ at: event.created_at, title: ADMIN_EVENT_LABELS[event.action] || 'Acción administrativa', text: [event.actor_label || 'Personal autorizado', event.comment].filter(Boolean).join(' · ') }));
    const approvedAt = detail.financial_approved_at || detail.financial_approval_snapshot && detail.financial_approval_snapshot.approved_at;
    if (approvedAt && !adminEvents.some((event) => event.action === 'APPROVE')) events.push({ at: approvedAt, title: 'Financiamiento aprobado', text: 'Condiciones aprobadas guardadas en snapshot inmutable.' });
    const exportState = detail.financial_export;
    if (exportState && exportState.updated_at) events.push({ at: exportState.updated_at, title: stageMeta(detail.financial_processing_status).label, text: exportState.export_status === 'failed' ? 'La entrega puede reintentarse sin duplicar la solicitud.' : 'Estado confirmado por el contrato de exportación.' });
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
    return 'No se completó la acción. Puedes reintentar sin duplicar la solicitud.';
  }

  function DesktopFinancialWorkbench({ app, onCount, initialAffiliateId }) {
    const [rows, setRows] = useState([]), [phase, setPhase] = useState('loading'), [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(''), [detail, setDetail] = useState(null), [detailPhase, setDetailPhase] = useState('idle'), [detailNonce, setDetailNonce] = useState(0);
    const [search, setSearch] = useState(''), [statusFilter, setStatusFilter] = useState('all'), [programFilter, setProgramFilter] = useState('all'), [stageFilter, setStageFilter] = useState('all'), [ageFilter, setAgeFilter] = useState('all'), [dateFilter, setDateFilter] = useState(''), [sort, setSort] = useState('newest');
    const [action, setAction] = useState(''), [actionNote, setActionNote] = useState(''), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(null), [rowFeedback, setRowFeedback] = useState({}), [documentViews, setDocumentViews] = useState({});
    const actionAttempts = React.useRef(new Map());
    useEffect(ensureWorkbenchStyles, []);
    const load = React.useCallback(async (quiet) => { try { if (!quiet) setPhase('loading'); const source = await window.ProgramRequestRepository.listFinancialQueue(); const scoped=initialAffiliateId?source.filter((row)=>row.affiliate_id===initialAffiliateId):source; setRows(scoped.slice()); setError(''); setPhase('loaded'); onCount(scoped.length); return scoped; } catch (_) { if (!quiet) setRows([]); setError('No fue posible cargar las solicitudes financieras.'); setPhase('error'); onCount(0); return []; } }, [onCount,initialAffiliateId]);
    useEffect(() => { load(false); }, [load]);
    const programs = React.useMemo(() => Array.from(new Map(rows.map((row) => [row.program_id, programLabel(row)])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'es')), [rows]);
    const visible = React.useMemo(() => { const needle = search.trim().toLocaleLowerCase('es-MX'); const filtered = rows.filter((row) => {
      const text = [row.folio, row.nombre, row.numero_control, programLabel(row)].join(' ').toLocaleLowerCase('es-MX');
      if (needle && !text.includes(needle)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (programFilter !== 'all' && row.program_id !== programFilter) return false;
      if (stageFilter !== 'all' && row.financial_processing_status !== stageFilter) return false;
      const days = ageDays(row.created_at); if (ageFilter === 'today' && days !== 0 || ageFilter === '3d' && days < 3 || ageFilter === '7d' && days < 7 || ageFilter === '30d' && days < 30) return false;
      return !dateFilter || dayKey(row.created_at) === dateFilter;
    }); return filtered.sort((a, b) => sort === 'oldest' ? a.ts - b.ts : sort === 'amount' ? Number(b.requested_amount || 0) - Number(a.requested_amount || 0) : b.ts - a.ts); }, [rows, search, statusFilter, programFilter, stageFilter, ageFilter, dateFilter, sort]);
    useEffect(() => { if (!visible.length) setSelectedId(''); else if (!visible.some((row) => row.id === selectedId)) setSelectedId(visible[0].id); }, [visible, selectedId]);
    useEffect(() => { if (!selectedId) { setDetail(null); setDetailPhase('idle'); return; } let active = true; setDetailPhase('loading'); setFeedback(null); setActionNote(''); setDocumentViews({}); window.ProgramRequestRepository.financialDetail(selectedId).then((value) => { if (active) { setDetail(value); setDetailPhase('loaded'); } }).catch(() => { if (active) { setDetail(null); setDetailPhase('error'); } }); return () => { active = false; }; }, [selectedId, detailNonce]);
    const index = visible.findIndex((row) => row.id === selectedId), selected = index >= 0 ? visible[index] : null;
    const actionOptions = React.useMemo(() => { if (!detail || !app.admin.has('program_requests.write')) return []; const options = [{ id: 'note', label: 'Guardar observación' }]; if (['requires_financial_processing', 'submitted'].includes(detail.status)) options.unshift({ id: 'review', label: 'Marcar en revisión' }); if (['requires_financial_processing', 'submitted', 'in_review'].includes(detail.status)) options.push({ id: 'approve', label: 'Aprobar y enviar a gestión' }, { id: 'reject', label: 'Rechazar solicitud' }, { id: 'cancel', label: 'Cancelar solicitud' }); if (detail.status === 'approved' && ['ready_for_handoff', 'failed'].includes(detail.financial_processing_status)) options.unshift({ id: 'handoff', label: detail.financial_processing_status === 'failed' ? 'Reintentar envío a gestión' : 'Enviar a gestión' }); return options; }, [detail, app]);
    useEffect(() => { if (!actionOptions.some((item) => item.id === action)) setAction(actionOptions[0] && actionOptions[0].id || ''); }, [actionOptions, action]);
    const clearFilters = () => { setSearch(''); setStatusFilter('all'); setProgramFilter('all'); setStageFilter('all'); setAgeFilter('all'); setDateFilter(''); setSort('newest'); };
    const move = (delta) => { if (!visible.length) return; const next = Math.max(0, Math.min(visible.length - 1, (index < 0 ? 0 : index) + delta)); setSelectedId(visible[next].id); };
    const save = async (advance) => { if (!detail || !action || busy) return; if (actionNote.trim().length > 0 && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: 'La observación debe tener al menos 3 caracteres.' }); return; } if (action === 'note' && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: 'Escribe una observación de al menos 3 caracteres.' }); return; } if (['reject', 'cancel'].includes(action) && actionNote.trim().length < 3) { setFeedback({ tone: 'error', text: action === 'reject' ? 'Indica el motivo del rechazo.' : 'Indica el motivo de la cancelación.' }); return; }
      const confirmations = { approve: '¿Aprobar y enviar esta solicitud? Se guardará la autorización en Supabase y el backend intentará entregarla al historial financiero de Google.', handoff: '¿Enviar esta solicitud aprobada a la gestión financiera de Google?', reject: '¿Rechazar esta solicitud financiera?', cancel: '¿Cancelar esta solicitud? Esta acción quedará registrada en la bitácora.' };
      if (confirmations[action] && !window.confirm(confirmations[action])) return;
      const currentId = detail.id, nextId = visible[index + 1] && visible[index + 1].id || visible[index - 1] && visible[index - 1].id || currentId; setBusy(true); setFeedback({ tone: 'saving', text: 'Guardando…' }); setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'saving' }));
      const adminAction = { review: 'MARK_IN_REVIEW', reject: 'REJECT', cancel: 'CANCEL', note: 'COMMENT' }[action], fingerprint = [currentId, action, actionNote.trim()].join('|'); let persistedEvent = null;
      try { if (adminAction) { const actionId = actionAttempts.current.get(fingerprint) || window.ProgramRequestRepository.newIdempotencyKey(); actionAttempts.current.set(fingerprint, actionId); persistedEvent = await window.ProgramRequestRepository.recordAdminAction(currentId, adminAction, actionNote.trim(), actionId); } else if (action === 'approve') await window.FinancialLegacyRepository.approveRequest(currentId, actionNote.trim()); else if (action === 'handoff') await window.FinancialLegacyRepository.handoffRequest(currentId);
        const refreshed = await load(true), verified = refreshed.find((row) => row.id === currentId); let valid = verified && (action === 'review' ? verified.status === 'in_review' : action === 'reject' ? verified.status === 'rejected' : action === 'cancel' ? verified.status === 'cancelled' : action === 'approve' ? verified.status === 'approved' && ['ready_for_handoff', 'in_progress', 'handed_off'].includes(verified.financial_processing_status) : action === 'handoff' ? verified.financial_processing_status === 'handed_off' : true); if (valid && persistedEvent) { const verifiedDetail = await window.ProgramRequestRepository.financialDetail(currentId); valid = verifiedDetail.admin_events_available && verifiedDetail.admin_events.some((event) => event.id === persistedEvent.id); } if (!valid) throw new Error('FINANCIAL_ACTION_READBACK_FAILED');
        actionAttempts.current.delete(fingerprint); setFeedback({ tone: 'success', text: '✓ Actualizado y verificado' }); setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'success' })); setActionNote(''); if (advance && nextId !== currentId) setSelectedId(nextId); else setDetailNonce((value) => value + 1);
      } catch (actionError) { await load(true); setDetailNonce((value) => value + 1); setFeedback({ tone: 'error', text: humanActionError(actionError) + ' · Se verificó el estado persistido; puedes reintentar.' }); setRowFeedback((all) => Object.assign({}, all, { [currentId]: 'error' })); } finally { setBusy(false); }
    };
    const prepareDocument = async (document, viewKey) => { setDocumentViews((all) => Object.assign({}, all, { [viewKey]: { phase: 'loading' } })); try { const preview = await window.DocumentWorkflowRepository.reviewPreview(document.affiliate_document_id || document.id); if (!preview.signedUrl) throw new Error('PREVIEW_UNAVAILABLE'); setDocumentViews((all) => Object.assign({}, all, { [viewKey]: { phase: 'ready', url: preview.signedUrl } })); } catch (_) { setDocumentViews((all) => Object.assign({}, all, { [viewKey]: { phase: 'error' } })); } };
    const onKeyDown = (event) => { if (/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName)) return; if (event.key === 'ArrowDown') { event.preventDefault(); move(1); } else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); } else if (event.key === 'Enter') { event.preventDefault(); const panel = document.querySelector('[data-financial-request-detail]'); if (panel) panel.focus(); } };
    const renderConditions = (title, result, fallback) => h('section', { className: 'finwb-card', 'data-financial-snapshot': title }, h('h3', null, h(I, { name: 'cash', size: 17, stroke: 2 }), title), result || fallback ? h('div', { className: 'finwb-kv' },
      [['Monto solicitado', moneyValue(result && result.amount != null ? result.amount : detail.requested_amount)], ['Fondo / programa', result && result.fund || programLabel(detail)], ['Plazo', (result && result.paymentCount || detail.requested_term || '—') + (result && result.paymentPeriod || detail.requested_term_semantics ? ' · ' + (result && result.paymentPeriod || detail.requested_term_semantics) : '')], ['Tasa aplicada', result && result.rate != null ? result.rate + '%' + (result.ratePeriod ? ' · ' + result.ratePeriod : '') : '—'], ['Pago por periodo', moneyValue(result && result.paymentPerPeriod)], ['Interés', moneyValue(result && result.interest)], ['Gasto administrativo', moneyValue(result && result.administrativeFeeTotal)], ['Total', moneyValue(result && result.total)]].map((item) => h('div', { key: item[0] }, h('span', null, item[0]), h('strong', null, item[1])))) : h('div', { className: 'finwb-snapshot-note' }, 'Snapshot contractual no disponible. No se recalculan valores históricos con reglas actuales.'));
    const renderDocumentRows = (documents, scope) => documents.map((document) => { const viewKey = scope + ':' + document.id, view = documentViews[viewKey] || {}, status = document.status_at_submission || document.status || 'No disponible'; return h('div', { className: 'finwb-doc', key: viewKey }, h(I, { name: 'doc', size: 18, stroke: 2 }), h('div', { className: 'finwb-doc-main' }, h('div', { className: 'finwb-person' }, document.document_type && document.document_type.label || 'Documento'), h('div', { className: 'finwb-sub' }, (scope === 'request' ? 'Estado al enviar: ' : 'Estado vigente: ') + status)), view.phase === 'ready' ? h('a', { href: view.url, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir') : h('button', { type: 'button', disabled: view.phase === 'loading', onClick: () => prepareDocument(document, viewKey) }, view.phase === 'loading' ? 'Autorizando…' : view.phase === 'error' ? 'Reintentar' : 'Preparar vista')); });
    const renderDetail = () => { if (detailPhase === 'loading') return h('div', { className: 'finwb-empty' }, h(I, { name: 'clock', size: 28 }), 'Cargando detalle autorizado…'); if (detailPhase === 'error') return h('div', { className: 'finwb-empty' }, h(I, { name: 'warning', size: 28 }), 'No fue posible cargar el detalle.', h('button', { onClick: () => setDetailNonce((value) => value + 1) }, 'Reintentar')); if (!detail) return h('div', { className: 'finwb-empty' }, 'Selecciona una solicitud para revisar su expediente.'); const submission = snapshotResult(detail, false), approval = snapshotResult(detail, true), events = timelineEvents(detail);
      return h(React.Fragment, null,
        h('div', { className: 'finwb-detail-head' }, h('div', null, h('span', { className: 'finwb-sub' }, 'SOLICITUD FINANCIERA'), h('strong', null, detail.folio), h('div', { className: 'finwb-sub' }, (index + 1) + ' de ' + visible.length + ' · ' + programLabel(detail))), badge(statusMeta(detail.status), 'data-financial-human-status', statusMeta(detail.status).label)),
        h('div', { className: 'finwb-detail-scroll' },
          h('section', { className: 'finwb-card', 'data-financial-detail-person': 'true' }, h('h3', null, h(I, { name: 'user', size: 17, stroke: 2 }), 'Solicitante'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Afiliado'), h('strong', null, detail.nombre)), h('div', null, h('span', null, 'Número de control'), h('strong', null, detail.numero_control)), h('div', null, h('span', null, 'Fecha'), h('strong', null, dateValue(detail.created_at))), h('div', null, h('span', null, 'Contexto'), h('strong', null, detail.impersonation_session_id ? 'Solicitud asistida · actor real preservado' : 'Solicitud propia')))),
          h('section', { className: 'finwb-card' }, h('h3', null, h(I, { name: 'receipt', size: 17, stroke: 2 }), 'Estado y etapa'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Estado'), h('strong', null, statusMeta(detail.status).label)), h('div', null, h('span', null, 'Etapa financiera'), h('strong', null, stageMeta(detail.financial_processing_status).label))), detail.notes && h('div', { className: 'finwb-snapshot-note', style: { marginTop: 10 } }, h('strong', null, 'Nota del solicitante'), h('div', null, detail.notes))),
          renderConditions('Condiciones de la solicitud', submission, detail.requested_amount != null || detail.requested_term != null),
          approval && renderConditions('Condiciones aprobadas', approval, true),
          h('section', { className: 'finwb-card', 'data-financial-documents': 'true' }, h('h3', null, h(I, { name: 'doc', size: 17, stroke: 2 }), 'Documentos enviados con esta solicitud'), !detail.documents_available ? h('div', { className: 'finwb-snapshot-note' }, 'No fue posible consultar la relación documental autorizada.') : !(detail.request_documents || []).length ? h('div', { className: 'finwb-snapshot-note' }, 'Esta solicitud no conserva documentos vinculados. No es posible reconstruir qué archivos fueron enviados usando el expediente actual.') : renderDocumentRows(detail.request_documents, 'request')),
          h('section', { className: 'finwb-card', 'data-financial-current-documents': 'true' }, h('h3', null, h(I, { name: 'doc', size: 17, stroke: 2 }), 'Expediente actual del afiliado'), h('div', { className: 'finwb-sub', style: { whiteSpace: 'normal', lineHeight: 1.45, marginBottom: 8 } }, 'Referencia vigente · no demuestra qué documentos acompañaron esta solicitud.'), !detail.current_documents_available ? h('div', { className: 'finwb-snapshot-note' }, 'No fue posible consultar el expediente actual. Verifica los permisos de documentos.') : !(detail.current_affiliate_documents || []).length ? h('div', { className: 'finwb-sub' }, 'El afiliado no tiene documentos vigentes disponibles.') : renderDocumentRows(detail.current_affiliate_documents, 'affiliate')),
          h('section', { className: 'finwb-card', 'data-financial-terms': 'true' }, h('h3', null, h(I, { name: 'checkCircle', size: 17, stroke: 2 }), 'Términos aceptados'), h('div', { className: 'finwb-kv' }, h('div', null, h('span', null, 'Aceptación'), h('strong', null, detail.terms_accepted ? 'Sí · al enviar la solicitud' : 'No registrada')), h('div', null, h('span', null, 'Versión'), h('strong', null, detail.terms_version ? detail.terms_version.title + ' · versión ' + detail.terms_version.version : detail.terms_available ? 'Sin versión vinculada' : 'No disponible')))),
          h('section', { className: 'finwb-card', 'data-financial-timeline': 'true' }, h('h3', null, h(I, { name: 'clock', size: 17, stroke: 2 }), 'Timeline'), !detail.admin_events_available ? h('div', { className: 'finwb-snapshot-note', style: { marginBottom: 9 } }, 'No fue posible consultar la bitácora administrativa.') : null, h('div', { className: 'finwb-timeline' }, events.map((event, eventIndex) => h('div', { className: 'finwb-event', key: event.title + eventIndex }, h('span', { className: 'finwb-event-dot' }), h('div', null, h('strong', null, event.title), h('p', null, dateValue(event.at) + ' · ' + event.text))))))),
        h('div', { className: 'finwb-actionbar', 'data-financial-safe-action-bar': 'true' }, actionOptions.length ? h(React.Fragment, null, h('div', { className: 'finwb-action-grid' }, h('select', { className: 'finwb-action-select', value: action, disabled: busy, onChange: (event) => { setAction(event.target.value); setActionNote(''); }, 'aria-label': 'Acción financiera permitida' }, actionOptions.map((item) => h('option', { key: item.id, value: item.id }, item.label))), h('div', null, h('span', { className: 'finwb-sub' }, 'Etapa actual'), h('strong', { style: { fontSize: 11.5 } }, stageMeta(detail.financial_processing_status).label))), h('textarea', { className: 'finwb-note', value: actionNote, disabled: busy || action === 'handoff', onChange: (event) => setActionNote(event.target.value), placeholder: action === 'reject' ? 'Motivo obligatorio del rechazo' : action === 'cancel' ? 'Motivo obligatorio de la cancelación' : action === 'approve' ? 'Comentario de autorización (opcional)' : action === 'review' ? 'Comentario de revisión (opcional)' : action === 'handoff' ? 'El envío usa la autorización ya registrada' : 'Observación administrativa obligatoria', 'aria-label': 'Observación de la acción' }), h('div', { className: 'finwb-buttons' }, h('button', { className: 'finwb-secondary', disabled: index <= 0 || busy, onClick: () => move(-1) }, 'Anterior'), h('button', { className: 'finwb-secondary', disabled: index < 0 || index >= visible.length - 1 || busy, onClick: () => move(1) }, 'Siguiente'), h('button', { className: 'finwb-primary', disabled: busy || !action, onClick: () => save(true) }, busy ? 'Guardando…' : 'Guardar y siguiente')), feedback && h('div', { className: 'finwb-feedback', 'data-financial-action-feedback': feedback.tone, 'data-tone': feedback.tone }, feedback.text)) : h('div', { className: 'finwb-sub' }, app.admin.has('program_requests.write') ? 'No hay transiciones disponibles para este estado.' : 'Consulta autorizada; las acciones requieren permiso de escritura.')));
    };
    return h('div', { className: 'finwb-root', tabIndex: 0, onKeyDown, 'data-admin-financial-workbench': 'true' },
      h('div', { className: 'finwb-toolbar', 'data-financial-queue-toolbar': 'true' }, h('div', { className: 'finwb-filters' },
        h('div', { className: 'finwb-field' }, h('label', { htmlFor: 'finwb-search' }, 'Buscar'), h('input', { id: 'finwb-search', value: search, onChange: (event) => setSearch(event.target.value), placeholder: 'Folio, afiliado o programa', 'aria-label': 'Buscar solicitudes financieras' })),
        h('div', { className: 'finwb-field' }, h('label', null, 'Estado'), h('select', { value: statusFilter, onChange: (event) => setStatusFilter(event.target.value), 'aria-label': 'Filtrar por estado financiero' }, h('option', { value: 'all' }, 'Todos'), Object.keys(REQUEST_STATUS).map((value) => h('option', { key: value, value }, REQUEST_STATUS[value].label)))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Programa'), h('select', { value: programFilter, onChange: (event) => setProgramFilter(event.target.value), 'aria-label': 'Filtrar por programa financiero' }, h('option', { value: 'all' }, 'Todos'), programs.map((item) => h('option', { key: item[0], value: item[0] }, item[1])))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Etapa'), h('select', { value: stageFilter, onChange: (event) => setStageFilter(event.target.value), 'aria-label': 'Filtrar por etapa financiera' }, h('option', { value: 'all' }, 'Todas'), Object.keys(FINANCIAL_STAGE).map((value) => h('option', { key: value, value }, FINANCIAL_STAGE[value].label)))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Antigüedad'), h('select', { value: ageFilter, onChange: (event) => setAgeFilter(event.target.value), 'aria-label': 'Filtrar por antigüedad financiera' }, h('option', { value: 'all' }, 'Todas'), h('option', { value: 'today' }, 'Hoy'), h('option', { value: '3d' }, '3 días o más'), h('option', { value: '7d' }, '7 días o más'), h('option', { value: '30d' }, '30 días o más'))),
        h('div', { className: 'finwb-field' }, h('label', null, 'Fecha'), h('input', { type: 'date', value: dateFilter, onChange: (event) => setDateFilter(event.target.value), 'aria-label': 'Filtrar por fecha financiera' })),
        h('div', { className: 'finwb-field' }, h('label', null, 'Orden'), h('select', { value: sort, onChange: (event) => setSort(event.target.value), 'aria-label': 'Ordenar solicitudes financieras' }, h('option', { value: 'newest' }, 'Más recientes'), h('option', { value: 'oldest' }, 'Más antiguas'), h('option', { value: 'amount' }, 'Mayor monto')))),
        h('div', { className: 'finwb-results' }, h('span', null, h('strong', null, visible.length), ' resultados'), h('button', { type: 'button', onClick: clearFilters }, 'Limpiar filtros'))),
      h('div', { className: 'finwb-grid' }, h('section', { className: 'finwb-panel finwb-queue', 'data-financial-queue': 'true' }, h('div', { className: 'finwb-queue-head' }, h('span', null, 'Folio'), h('span', null, 'Afiliado / programa'), h('span', null, 'Monto / plazo'), h('span', null, 'Estado / etapa'), h('span', null, 'Antig.')), h('div', { className: 'finwb-queue-body' }, phase === 'loading' ? h('div', { className: 'finwb-empty' }, 'Cargando solicitudes…') : phase === 'error' ? h('div', { className: 'finwb-empty' }, error, h('button', { onClick: () => load(false) }, 'Reintentar')) : !visible.length ? h('div', { className: 'finwb-empty' }, 'No hay solicitudes con estos filtros.') : visible.map((row) => h('button', { key: row.id, className: 'finwb-row', 'data-financial-queue-row': row.id, 'aria-selected': row.id === selectedId, onClick: () => setSelectedId(row.id) }, h('span', { className: 'finwb-folio' }, row.folio), h('span', null, h('span', { className: 'finwb-person', 'data-financial-queue-person': 'true' }, row.nombre), h('span', { className: 'finwb-sub' }, maskedControl(row.numero_control) + ' · ' + programLabel(row))), h('span', null, h('span', { className: 'finwb-amount' }, moneyValue(row.requested_amount)), h('span', { className: 'finwb-sub' }, row.requested_term ? row.requested_term + ' · ' + (row.requested_term_semantics || 'pagos') : 'Plazo no disponible')), h('span', null, badge(statusMeta(row.status), 'data-financial-human-status', statusMeta(row.status).label), h('span', { className: 'finwb-stage' }, stageMeta(row.financial_processing_status).label), rowFeedback[row.id] && h('span', { className: 'finwb-stage', 'data-financial-inline-feedback': rowFeedback[row.id] }, rowFeedback[row.id] === 'saving' ? 'Guardando…' : rowFeedback[row.id] === 'success' ? '✓ Actualizado' : '! Error')), h('span', { className: 'finwb-age' }, ageLabel(row.created_at)))))),
        h('section', { className: 'finwb-panel finwb-detail', tabIndex: -1, 'data-financial-request-detail': 'true', style: { position: 'relative' } }, renderDetail())));
  }

  function EstadoBadge({ estado }) {
    const e = window.FINANZAS.ESTADO(estado);
    return React.createElement(window.Badge, { tone: e.tone, icon: e.icon }, e.label);
  }

  function FinanzasModule({ app, onBack, header, initialAffiliateId }) {
    const desktop = useDesktop();
    const store = useStore(!desktop);
    const qs = window.useQuoteStore ? window.useQuoteStore() : null;
    const [tab, setTab] = useState('sols');       // 'sols' | 'cots'
    const [openId, setOpenId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [desktopCount, setDesktopCount] = useState(0);

    if (!desktop && openId) { const r = store.get(openId); if (r) return React.createElement(RequestDetail, { app, r, onBack: () => setOpenId(null), header }); }

    const belongsToAffiliate=(row)=>!initialAffiliateId||row.affiliate_id===initialAffiliateId||(row.usuario&&row.usuario.id===initialAffiliateId);
    const all = store.all().filter(belongsToAffiliate);
    const list = store.byEstado(filter).filter(belongsToAffiliate).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const montoTotal = all.reduce((s, r) => s + (r.simulacion.montoSolicitado || 0), 0);
    const chips = [{ id: 'all', label: 'Todas' }].concat(window.FINANZAS.ESTADOS.map((e) => ({ id: e.id, label: e.label })));
    const cotPend = qs ? qs.pendientes() : 0;
    const source=store.state?store.state():{phase:'loaded'};

    const segBtn = (id, label, badge) => React.createElement('button', { key: id, onClick: () => setTab(id), style: { flex: 1, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: tab === id ? 'var(--grad-guinda-soft)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--ink-2)', boxShadow: tab === id ? 'var(--glow-guinda)' : 'var(--neo-sm)' } },
      label, badge ? React.createElement('span', { style: { minWidth: 19, height: 19, borderRadius: 999, background: tab === id ? 'rgba(255,255,255,.25)' : 'var(--guinda)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' } }, badge) : null);

    return React.createElement('div', { 'data-admin-view':'finanzas' },
      header({ title: 'Finanzas · Solicitudes', sub: (desktop ? desktopCount : all.length) + ' solicitud(es) · ' + (qs ? qs.all().length : 0) + ' cotización(es)', onBack }),
      window.ActingBanner && React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: 16, paddingBottom: 28 } },
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 16 } },
          segBtn('sols', 'Financiamientos', desktop ? null : store.pendientes() || null),
          segBtn('cots', 'Cotizaciones', cotPend || null)),
        desktop ? (tab === 'cots' ? React.createElement(CotizacionesAdmin, { qs, app }) : React.createElement(DesktopFinancialWorkbench, { app, onCount: setDesktopCount, initialAffiliateId })) :
        source.phase==='error' ? React.createElement(window.EmptyState,{icon:'warning',title:'No fue posible cargar solicitudes',sub:'La fuente productiva no respondió.',actionLabel:'Reintentar',onAction:()=>store.retry()}) :
        source.phase==='loading' ? React.createElement(window.EmptyState,{icon:'clock',title:'Cargando solicitudes',sub:'Consultando información vigente.'}) :
        tab === 'cots' ? React.createElement(CotizacionesAdmin, { qs, app }) : React.createElement(React.Fragment, null,
        React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 14 } },
          kpi('receipt', all.length, 'Recibidas'),
          kpi('clock', store.pendientes(), 'Pendientes', true),
          kpi('cash', money(montoTotal).replace(/\.00$/, ''), 'Monto solicitado')),
        React.createElement('div', { style: { background: '#EEF3FF', border: '1px solid #D6E2FB', borderRadius: 14, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 } },
          React.createElement(I, { name: 'info', size: 17, stroke: 2, style: { color: '#2456C7', flexShrink: 0, marginTop: 1 } }),
          React.createElement('div', { style: { fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 } }, 'El ', React.createElement('b', null, 'Panel de Finanzas'), ' concentra las solicitudes enviadas desde la app, vinculadas al usuario, empresa, programa y simulación.')),
        React.createElement('div', { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' } },
          chips.map((c) => React.createElement('button', { key: c.id, onClick: () => setFilter(c.id), style: { flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: filter === c.id ? 'var(--guinda)' : 'var(--surface)', color: filter === c.id ? '#fff' : 'var(--ink-2)', boxShadow: filter === c.id ? 'none' : 'var(--neo-sm)' } }, c.label))),
        list.length === 0
          ? React.createElement(window.EmptyState, { icon: 'receipt', title: 'Sin solicitudes', sub: 'Cuando un afiliado envíe una solicitud tras simular, aparecerá aquí.' })
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 11 } },
            list.map((r) => React.createElement('button', {
              key: r.id, onClick: () => setOpenId(r.id),
              style: { display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', background: 'var(--surface)', border: 'none', borderRadius: 16, padding: 14, boxShadow: 'var(--neo-sm)', cursor: 'pointer', fontFamily: 'inherit' },
            },
              React.createElement('div', { style: { width: 46, height: 46, borderRadius: 13, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: r.icon || 'cash', size: 23, stroke: 2 })),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
                  React.createElement('span', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.productoNombre || r.programa || 'Préstamo'),
                  React.createElement('span', { style: { fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0 } }, r.folio)),
                React.createElement('div', { 'data-financial-mobile-person':'true', style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.usuario.nombre + ' · ' + r.usuario.sindicato),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 } },
                  React.createElement('span', { 'data-financial-mobile-amount':'true', style: { fontSize: 15, fontWeight: 800, color: 'var(--guinda)' } }, money(r.simulacion.montoSolicitado)),
                  React.createElement(EstadoBadge, { estado: r.estado }))))))
      )));
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
