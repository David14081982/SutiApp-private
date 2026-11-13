(function () {
  'use strict';
  const h = React.createElement;
  const money = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }) : 'No verificado';
  const date = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'Periodo no verificado';
  const labels = { PASS: 'Cumple', FAIL: 'No cumple', MANUAL: 'Requiere revisión manual' };
  function styles() {
    if (document.getElementById('financial-review-queue-styles')) return;
    const node = document.createElement('style'); node.id = 'financial-review-queue-styles';
    node.textContent = `
    .finwb-root .finwb-queue .finwb-queue-head,.finwb-root .finwb-queue .finwb-row{grid-template-columns:82px 36px minmax(130px,1.2fr) minmax(110px,.8fr) minmax(165px,1fr) minmax(180px,1.1fr) minmax(155px,.9fr) 42px;gap:12px;padding:15px 14px}
    .finwb-root .finwb-queue .finwb-row>span,.finwb-root .finwb-queue .finwb-queue-head>span{display:block;min-width:0}
    .finwb-root .finwb-queue .finwb-row>.finwb-profile-photo{display:grid}
    .finreview-payroll,.finreview-evaluation{display:flex!important;flex-direction:column;gap:4px;font-size:12px;line-height:1.4}
    .finreview-payroll>strong{font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
    .finreview-payroll small,.finreview-evaluation small{font-size:11px;color:var(--ink-2)}
    .finreview-extras{display:flex;flex-wrap:wrap;gap:4px}.finreview-extra{padding:3px 6px;border-radius:6px;background:#fff2dd;color:#795018;font-size:10.5px}
    .finreview-verdict{font-size:11px;font-weight:850;padding:4px 7px;border-radius:8px;width:fit-content}.finreview-verdict.pass{background:#e7f6ed;color:#12613d}.finreview-verdict.fail{background:#fdeaea;color:#a52323}.finreview-verdict.manual{background:#fff2dd;color:#795018}
    .finreview-observation{font-size:11px;color:var(--ink-2)}.finreview-evaluation summary{font-size:11px;color:var(--guinda);cursor:pointer}.finreview-evaluation ul{padding-left:16px;margin:5px 0;font-size:11px}
    .finreview-installment{display:block;margin-top:7px;font-size:14px;font-weight:850;font-variant-numeric:tabular-nums}.finreview-installment small{display:block;font-size:10px;color:var(--ink-2);font-weight:650}
    .finreview-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.finreview-actions button{border:1px solid var(--hairline);border-radius:8px;padding:6px 8px;background:var(--surface);color:var(--guinda);font:800 11px inherit;cursor:pointer}.finreview-actions button:last-child{background:var(--guinda);color:white}.finreview-actions button:disabled{opacity:.5}
    @media(min-width:768px) and (max-width:1150px){.finwb-root .finwb-queue{overflow:auto}.finwb-root .finwb-queue .finwb-row,.finwb-root .finwb-queue .finwb-queue-head{min-width:1100px}}
    @media(max-width:767px){.finwb-root .finwb-queue .finwb-queue-head{display:none}.finwb-root .finwb-queue .finwb-row{grid-template-columns:36px minmax(0,1fr) minmax(0,1fr);gap:10px;padding:14px 10px}.finwb-root .finwb-queue .finwb-row>span:nth-child(1){grid-column:2/4;grid-row:1}.finwb-root .finwb-queue .finwb-row>span:nth-child(2){grid-column:1;grid-row:1/3}.finwb-root .finwb-queue .finwb-row>span:nth-child(3){grid-column:2/4;grid-row:2}.finwb-root .finwb-queue .finwb-row>span:nth-child(4){grid-column:2;grid-row:3}.finwb-root .finwb-queue .finwb-row>span:nth-child(5){grid-column:3;grid-row:3}.finwb-root .finwb-queue .finwb-row>span:nth-child(6){grid-column:2/4;grid-row:4}.finwb-root .finwb-queue .finwb-row>span:nth-child(7){grid-column:2/4;grid-row:5}.finwb-root .finwb-queue .finwb-row>span:nth-child(8){grid-column:1;grid-row:3;font-size:10px}.finreview-payroll>strong{font-size:15px}}
    `;
    document.head.appendChild(node);
  }
  function PayrollCell({ review }) {
    const result = review?.phase === 'COMPLETE' ? review.result : null, payroll = result?.payroll, latest = payroll?.latest;
    if (!payroll) return h('span', { className: 'finreview-payroll' }, h('strong', null, 'Neto no verificado'), h('small', null, review?.phase === 'CLOSED' ? 'Sin evaluaci?n registrada' : review?.phase === 'ERROR' ? 'Lectura no disponible' : review?.phase === 'NOT_CONFIGURED' ? 'Evaluación automática no activada' : 'Pendiente de evaluación'));
    return h('span', { className: 'finreview-payroll' }, h('strong', null, money(latest?.net)),
      h('small', null, 'Neto del último recibo'), h('small', null, latest ? date(latest.period_start) + ' – ' + date(latest.period_end) : 'Recibo más reciente sin determinar'),
      h('small', null, payroll.average != null ? 'Promedio de dos: ' + money(payroll.average) : payroll.receipts.length === 1 ? 'Sólo un talón disponible' : 'Promedio no verificable'),
      h('span', { className: 'finreview-extras' }, payroll.receipts.flatMap(receipt => (receipt.extras || []).map((extra, i) => h('span', { key: receipt.document_id + ':' + i, className: 'finreview-extra', title: extra.label },
        (extra.kind === 'BONUS' ? 'Bono' : extra.kind === 'OVERTIME' ? 'Horas extras' : extra.label) + ': ' + (extra.amount == null ? 'importe no legible' : money(extra.amount)) + ' · ' + date(receipt.period_end))))));
  }
  function EvaluationCell({ review }) {
    const result = review?.phase === 'COMPLETE' ? review.result : null;
    if (!result) {
      const text = review?.phase === 'CLOSED' ? 'Sin evaluaci?n registrada' : review?.phase === 'PROCESSING' ? 'Evaluando documentos…' : review?.phase === 'STALE' ? 'Documento cambiado · reevaluación pendiente' : review?.phase === 'ERROR' ? 'Requiere revisión manual' : review?.phase === 'NOT_CONFIGURED' ? 'Evaluación automática no activada' : 'Pendiente de evaluación';
      return h('span', { className: 'finreview-evaluation' }, h('span', { className: 'finreview-verdict manual' }, text), review?.phase === 'ERROR' && h('small', null, 'No fue posible completar la evaluación automática.'));
    }
    const observations = result.observations || [];
    return h('span', { className: 'finreview-evaluation' }, h('span', { className: 'finreview-verdict ' + result.status.toLowerCase() }, labels[result.status]),
      h('small', null, result.passed_count + ' de ' + result.check_count + ' comprobaciones documentales'),
      observations.length > 0 && h('span', { className: 'finreview-observation' }, observations[0].message),
      observations.length > 1 && h('details', { onClick: e => e.stopPropagation(), onKeyDown: e => e.stopPropagation() },
        h('summary', null, 'Ver ' + (observations.length - 1) + ' observaciones más'),
        h('ul', null, observations.slice(1).map(o => h('li', { key: o.key }, o.message)))));
  }
  function Corrections({ requestId }) {
    const [review, setReview] = React.useState(null), [busy, setBusy] = React.useState(''), [notice, setNotice] = React.useState('');
    const jobs = React.useRef(new Map()), mounted = React.useRef(true), generation = React.useRef(0);
    const refresh = React.useCallback(async () => {
      const version = generation.current;
      try { const r = await window.FinancialDocumentReviewRepository.self(requestId); if (mounted.current && version === generation.current) setReview(r); }
      catch (_) { if (mounted.current && version === generation.current) setReview(null); }
    }, [requestId]);
    React.useEffect(() => { mounted.current = true; generation.current++; setReview(null); setBusy(''); setNotice(''); jobs.current.clear(); refresh(); const timer = setInterval(refresh, 15000); return () => { mounted.current = false; generation.current++; clearInterval(timer); }; }, [refresh]);
    const replace = async (document, file) => {
      if (!file || busy) return; setBusy(document.id); setNotice('Preparando documento…');
      const version = generation.current, active = () => mounted.current && version === generation.current;
      // In-memory idempotency: no private document or model result in browser storage.
      let job = jobs.current.get(document.id);
      if (!job || job.file !== file) { job = { id: crypto.randomUUID(), file }; jobs.current.set(document.id, job); }
      try {
        await window.FinancialDocumentReviewRepository.replace(review, document, file, job.id, phase => { if (active()) setNotice(phase === 'uploading' ? 'Subiendo documento…' : 'Verificando sustitución…'); });
        if (active()) { setNotice('Documento sustituido. Reevaluación pendiente.'); jobs.current.delete(document.id); await refresh(); }
      } catch (error) { if (active()) setNotice(window.FinancialDocumentReviewRepository.message(error)); }
      finally { if (active()) setBusy(''); }
    };
    if (!review?.can_correct || !review.result?.observations?.length && !notice) return null;
    return h('div', { 'data-document-corrections': requestId, style: { marginTop: 16, padding: 16, background: 'var(--surface)', borderRadius: 16 } },
      h('strong', null, 'Observaciones de tus documentos'),
      h('ul', null, (review.result?.observations || []).map(o => h('li', { key: o.key, style: { marginTop: 6, fontSize: 13 } }, o.message))),
      (review.documents || []).map(document => h('label', { key: document.id, style: { display: 'block', marginTop: 12, fontSize: 13 } }, document.label + ' · Sustituir documento observado',
        h('input', { type: 'file', accept: document.accepted_mime_types.join(','), disabled: !!busy || document.file_upload_allowed === false, onChange: e => replace(document, e.target.files[0]), style: { display: 'block', marginTop: 6, maxWidth: '100%' } }))),
      notice && h('p', { role: 'status', style: { fontSize: 13 } }, notice));
  }
  window.FinancialReviewPayrollCell = PayrollCell;
  window.FinancialReviewEvaluationCell = EvaluationCell;
  window.FinancialDocumentCorrections = Corrections;
  window.ensureFinancialReviewQueueStyles = styles;
})();
