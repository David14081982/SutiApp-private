/* screens-credencial.jsx — Credencial Digital + private banking/documents. */
(function () {
  const { useState, useEffect } = React;
  const I = window.Icon;

  function QRCode({ size = 200, fg = '#1c1518', value = '' }) {
    if (!value || typeof window.qrcode !== 'function') return React.createElement('div', { role: 'status', style: { width: size, height: size, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 12 } }, 'Generando código…');
    const qr = window.qrcode(0, 'M');
    qr.addData(value, 'Byte');
    qr.make();
    const count = qr.getModuleCount(), quiet = 4, total = count + quiet * 2, cell = size / total, cells = [];
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) cells.push(React.createElement('rect', { key: row + '-' + col, x: (col + quiet) * cell, y: (row + quiet) * cell, width: cell + .08, height: cell + .08, fill: fg }));
    return React.createElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': 'QR dinámico de credencial' }, React.createElement('rect', { width: size, height: size, fill: '#fff' }), cells);
  }

  function CredencialScreen({ app }) {
    const u = app.user;
    const [flipped, setFlipped] = useState(false);
    const [qr, setQr] = useState({ phase: 'loading', token: '', expiresAt: 0 });
    const [secs, setSecs] = useState(0);
    const issueQr = React.useCallback(async () => {
      try { const row = await window.CredentialQrRepository.issue(); setQr({ phase: 'ready', token: row.token, destination: row.destination_path, expiresAt: new Date(row.expires_at).getTime() }); }
      catch (error) { setQr({ phase: 'error', token: '', expiresAt: 0, error }); }
    }, []);
    useEffect(() => { if (flipped) issueQr(); }, [flipped, issueQr]);
    useEffect(() => { const t = setInterval(() => { if (!flipped || qr.phase !== 'ready') return; const left = Math.max(0, Math.ceil((qr.expiresAt-Date.now())/1000)); setSecs(left); if (!left) issueQr(); }, 1000); return () => clearInterval(t); }, [flipped, qr.phase, qr.expiresAt, issueQr]);
    const qrUrl = React.useMemo(() => { if (!qr.token || !qr.destination) return ''; try { const url = new URL(qr.destination, window.location.origin); url.searchParams.set('credential_token', qr.token); return url.toString(); } catch (_) { return ''; } }, [qr.token, qr.destination]);

    const sections = [
      { g: 'Información de identificación', rows: [['Número de control', u.numeroControl], ['Nombre', u.name], ['RFC', u.rfc]] },
      { g: 'Información de contacto', rows: [['Teléfono', u.phone], ['Correo histórico', u.email]] },
      { g: 'Información personal', rows: [['Fecha de nacimiento', u.birthDate], ['Género', u.gender], ['Estado civil', u.maritalStatus], ['No. hijos', u.childrenCount], ['Dirección', u.address], ['Ciudad', u.city]] },
      { g: 'Información laboral', rows: [['Área', u.area], ['Ocupación / Profesión', u.occupation], ['Puesto en ISSSTESON', u.position], ['Puesto SUTI', u.unionPosition], ['Categoría', u.category], ['Unidad / Módulo', u.unit]] },
      { g: 'Información sindical', rows: [['Afiliación', u.affiliation], ['Estatus histórico', u.historicalStatus], ['Estatus del afiliado', u.affiliateStatus]] },
      { g: 'Fechas', rows: [['Fecha de ingreso', u.employmentEntryDate], ['Ingreso al Instituto', u.instituteEntryDate], ['Inscripción sindical', u.unionEnrollmentDate], ['Fecha de captura', u.captureDate]] },
    ];

    return React.createElement('div', { className: 'su-route', 'data-affiliate-id': u.id, style: { paddingBottom: 18 } },
      React.createElement(window.TopBar, { app, variant: 'credencial' }),
      React.createElement('div', { style: { padding: '8px 20px 0', textAlign: 'center' } },
        React.createElement('p', { style: { fontSize: 14, color: 'var(--ink-3)', fontWeight: 600, margin: 0 } }, 'Toca la credencial para girarla')),
      React.createElement('div', { 'data-press': 'subtle', style: { padding: '16px 20px 0', perspective: 1400 } },
        React.createElement('div', { onClick: () => setFlipped(!flipped), style: { position: 'relative', height: 420, cursor: 'pointer', transformStyle: 'preserve-3d', transition: 'transform .7s cubic-bezier(.4,0,.2,1)', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' } },
          React.createElement('div', { style: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } }, React.createElement(CardFront, { u })),
          React.createElement('div', { style: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' } }, React.createElement(CardBack, { u, qrUrl, secs, qr, retry: issueQr })))),
      React.createElement('div', { style: { display: 'flex', padding: '18px 20px 0' } },
        React.createElement(window.Btn, { full: true, icon: 'qr', onClick: () => setFlipped(true) }, 'Mostrar QR')),
      React.createElement('div', { style: { padding: '22px 20px 0' } },
        React.createElement(window.SectionHead, { title: 'Datos del afiliado', icon: 'idcard' }),
        sections.map((sec) => React.createElement('div', { key: sec.g, style: { marginTop: 16 } },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 900, color: 'var(--guinda)', letterSpacing: '.04em', textTransform: 'uppercase', margin: '0 4px 8px' } }, sec.g),
          React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, padding: 6, boxShadow: 'var(--neo-sm)' } },
            sec.rows.map((r, i, arr) => React.createElement('div', { key: r[0], style: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px', borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none' } },
              React.createElement('span', { style: { fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 } }, r[0]),
              React.createElement('span', { style: { fontSize: 13, fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' } }, r[1]))))))),
      React.createElement(BankAccounts, { app }),
      React.createElement('div', { style: { padding: '22px 20px 0' } },
        React.createElement(window.SectionHead, { title: 'Actualiza tus documentos', icon: 'folder' }),
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 18, padding: 15, boxShadow: 'var(--neo-sm)', display: 'flex', alignItems: 'center', gap: 12 } },
          React.createElement(window.IconTile, { icon: 'upload', size: 44 }),
          React.createElement('div', { style: { flex: 1 } }, React.createElement('div', { style: { fontSize: 14, fontWeight: 800 } }, 'Expediente digital'), React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 } }, 'Adjunta o toma una foto; los verificados permanecen protegidos.')),
          React.createElement('button', { onClick: () => app.push('documentos'), style: { border: 'none', borderRadius: 11, background: 'var(--guinda)', color: '#fff', padding: '10px 13px', fontWeight: 800 } }, 'Abrir'))),
      React.createElement('div', { style: { padding: '16px 20px 0', display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-3)' } },
        React.createElement(I, { name: 'shield', size: 18, stroke: 2, style: { color: '#13794A' } }),
        React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600 } }, 'Identidad cargada desde Supabase')));
  }

  function CardFront({ u }) {
    return React.createElement('div', { style: { width: '100%', height: '100%', borderRadius: 26, overflow: 'hidden', position: 'relative', background: 'linear-gradient(150deg, var(--guinda) 0%, #6a001b 60%, #45000f 100%)', color: '#fff', boxShadow: '0 24px 60px -18px rgba(145,0,34,.65)', padding: 24, display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { position: 'absolute', right: -40, bottom: -50, opacity: .12 } }, React.createElement(window.SutiSeal, { size: 260 })),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 11, letterSpacing: '.18em', fontWeight: 700, opacity: .8 } }, 'CREDENCIAL DIGITAL'),
          React.createElement('div', { style: { fontSize: 15, fontWeight: 800, marginTop: 2 } }, 'SUTISSSTESON')),
        React.createElement(window.FistMark, { size: 36, color: '#fff' })),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 'auto' } },
        React.createElement(window.Avatar, { name: u.name, src: u.photoUrl || undefined, size: 76, tone: '#fff', 'data-profile-photo-consumer': 'credential' }),
        React.createElement('div', { style: { width: 40, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#e9c97a,#b8902f)', opacity: .9 } })),
      React.createElement('div', { style: { marginTop: 16 } },
        React.createElement('div', { 'data-affiliate-field': 'credential-name', style: { fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' } }, u.name),
        React.createElement('div', { style: { fontSize: 13, opacity: .82, fontWeight: 600, marginTop: 2 } }, u.status + ' · ' + u.affiliation)),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 10, opacity: .7, fontWeight: 600, letterSpacing: '.08em' } }, 'No. AFILIADO'),
          React.createElement('div', { 'data-affiliate-field': 'credential-control', style: { fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)' } }, u.numeroControl)),
        React.createElement('div', { style: { textAlign: 'right' } },
          React.createElement('div', { style: { fontSize: 10, opacity: .7, fontWeight: 600, letterSpacing: '.08em' } }, 'ESTATUS'),
          React.createElement('div', { 'data-affiliate-field': 'credential-status', style: { fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)' } }, u.status))));
  }

  function CardBack({ u, qrUrl, secs, qr, retry }) {
    return React.createElement('div', { style: { width: '100%', height: '100%', borderRadius: 26, overflow: 'hidden', position: 'relative', background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      React.createElement('div', { style: { height: 44, background: 'var(--ink)', margin: '-24px -24px 0', width: 'calc(100% + 48px)' } }),
      React.createElement('div', { style: { fontSize: 13, fontWeight: 800, color: 'var(--guinda)', marginTop: 22, letterSpacing: '.04em' } }, 'ACCESO Y BENEFICIOS'),
      React.createElement('div', { style: { fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 4, textAlign: 'center' } }, qr.phase === 'error' ? 'No se pudo emitir el código' : 'Escanea para validar tu identidad sindical'),
      React.createElement('div', { style: { marginTop: 18, padding: 16, background: '#fff', borderRadius: 18, boxShadow: 'var(--neo-sm)' } }, React.createElement(QRCode, { size: 176, fg: 'var(--guinda)', value: qrUrl })),
      qr.phase === 'error' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); retry(); }, style: { marginTop: 12, border: 'none', borderRadius: 10, padding: '8px 12px', fontWeight: 800, color: 'var(--guinda)' } }, 'Reintentar'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, color: 'var(--ink-3)' } },
        React.createElement(I, { name: 'refresh', size: 15, stroke: 2.2 }),
        React.createElement('span', { style: { fontSize: 12.5, fontWeight: 700 } }, 'Código visual · se renueva en ' + secs + 's')),
      React.createElement('div', { style: { fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-2)', marginTop: 10, fontWeight: 600 } }, u.numeroControl));
  }

  function BankAccounts({ app }) {
    const [rows,setRows]=useState([]),[phase,setPhase]=useState('loading'),[editing,setEditing]=useState(null),[error,setError]=useState('');
    const load=React.useCallback(async()=>{try{setPhase('loading');setRows((await window.BankAccountRepository.list()).slice());setError('');setPhase('ready');}catch(_){setRows([]);setError('No fue posible consultar tus datos bancarios.');setPhase('error');}},[]);
    useEffect(()=>{load();},[load]);
    return React.createElement('div',{'data-banking-authority':'supabase','data-banking-phase':phase,style:{padding:'22px 20px 0'}},
      React.createElement(window.SectionHead,{title:'Datos bancarios',icon:'card'}),
      phase==='error'&&React.createElement('div',{role:'alert',style:{color:'#A32921',fontSize:12,fontWeight:700}},error,' ',React.createElement('button',{onClick:load},'Reintentar')),
      phase==='ready'&&React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:10}},
        rows.map((r)=>React.createElement('div',{key:r.id,'data-bank-account-id':r.id,'data-bank-status':r.data_status,style:{background:'var(--surface)',borderRadius:16,padding:14,boxShadow:'var(--neo-sm)',color:'var(--ink)'}},
          React.createElement('button',{onClick:()=>setEditing(Object.assign({},r)),style:{width:'100%',border:'none',padding:0,textAlign:'left',background:'transparent',color:'inherit'}},
            React.createElement('div',{style:{display:'flex',justifyContent:'space-between',gap:10}},React.createElement('b',null,r.bank_name||'Banco pendiente'),r.is_primary&&React.createElement('span',{style:{fontSize:10,color:'var(--guinda)',fontWeight:900}},'PRINCIPAL')),
            React.createElement('div',{'data-bank-masked':'true',style:{fontFamily:'var(--mono)',fontSize:12,color:'var(--ink-2)',marginTop:5}},r.maskedClabe||r.maskedAccount||'Datos pendientes'),
            React.createElement('div',r.data_status==='INCOMPLETE_HISTORICAL_DATA'?{'data-bank-incomplete':'true',style:{fontSize:11.5,color:'var(--guinda)',fontWeight:800,marginTop:3}}:{style:{fontSize:11.5,color:'var(--ink-3)',fontWeight:600,marginTop:3}},r.data_status==='INCOMPLETE_HISTORICAL_DATA'?'Completa tus datos bancarios':r.account_holder)),
          !r.is_primary&&r.data_status==='COMPLETE'&&React.createElement('button',{onClick:async()=>{try{await window.BankAccountRepository.setPrimary(r.id);await load();}catch(_){app.toast&&app.toast('No se pudo marcar como principal');}},style:{marginTop:10,border:'none',background:'transparent',color:'var(--guinda)',fontWeight:800,padding:0}},'Hacer principal'))),
        React.createElement(window.Btn,{full:true,variant:'secondary',icon:'plus',onClick:()=>setEditing({account_holder:'',bank_name:'',clabe:'',account_number:'',is_primary:false}),style:{marginTop:2}},rows.length?'Agregar otra cuenta':'Agregar datos bancarios')),
      React.createElement(window.Sheet,{open:!!editing,onClose:()=>setEditing(null),title:editing&&editing.id?'Editar datos bancarios':'Datos bancarios'},editing&&React.createElement(BankEditor,{value:editing,onSaved:async()=>{setEditing(null);await load();},app})));
  }

  function BankEditor({value,onSaved,app}) {
    const[d,setD]=useState(value),[busy,setBusy]=useState(false),set=(k,v)=>setD((x)=>Object.assign({},x,{[k]:v}));
    const valid=String(d.account_holder||'').trim().length>1&&String(d.bank_name||'').trim().length>1&&/^[0-9]{4,20}$/.test(String(d.account_number||'').trim())&&(!String(d.clabe||'').trim()||/^[0-9]{18}$/.test(String(d.clabe).trim()));
    const input={width:'100%',border:'none',background:'var(--surface-2)',boxShadow:'var(--neo-inset)',borderRadius:12,padding:'12px 13px',font:'600 14px var(--font)',marginTop:6};
    const save=async()=>{setBusy(true);try{await window.BankAccountRepository.save(d);await onSaved();}catch(_){app.toast&&app.toast('No se pudo guardar');}finally{setBusy(false);}};
    return React.createElement('div',null,
      ['account_holder','bank_name','clabe','account_number'].map((k)=>React.createElement('label',{key:k,style:{display:'block',fontSize:12,fontWeight:800,marginTop:12}},({account_holder:'Titular de la cuenta',bank_name:'Banco',clabe:'CLABE interbancaria',account_number:'Número de cuenta'})[k],React.createElement('input',{value:d[k]||'',inputMode:['clabe','account_number'].includes(k)?'numeric':undefined,onChange:(e)=>set(k,e.target.value),style:input}))),
      React.createElement('div',{style:{fontSize:11.5,color:'var(--ink-3)',marginTop:12}},'Usa solo dígitos. La CLABE es opcional y debe tener 18 dígitos; no se acepta notación científica.'),
      React.createElement(window.Btn,{full:true,disabled:!valid||busy,onClick:save,style:{marginTop:18}},busy?'Guardando…':'Guardar datos bancarios'),
      d.id&&React.createElement(window.Btn,{full:true,variant:'secondary',onClick:async()=>{if(confirm('¿Eliminar esta cuenta?')){await window.BankAccountRepository.remove(d.id);await onSaved();}},style:{marginTop:9}},'Eliminar cuenta'));
  }

  window.CredencialScreen = CredencialScreen;
})();
