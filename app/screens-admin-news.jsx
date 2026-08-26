/* screens-admin-news.jsx — Módulo de administración de Noticias del sindicato:
   crear/editar/eliminar/duplicar, reordenar (drag & drop), visibilidad +
   segmentación, y asignación de un Responsable de la sección.
   Exporta window.NewsModule. */
(function () {
  const { useState, useRef, useEffect } = React;
  const I = window.Icon;
  const A = () => window.ADMIN;
  function createRemoteStore(app) {
    let items=[];let settings={responsableNombre:'',responsableCargo:'',responsableRol:''};let assignments=[];let assignmentAudit=[];let phase='loading';const listeners=new Set();
    const emit=()=>listeners.forEach((fn)=>fn());
    const report=()=>app.toast('No fue posible guardar el cambio');
    const load=async()=>{phase='loading';emit();try{const canAdmin=window.AdminRepository.has('authorization.read');const pair=await Promise.all([window.AdminRepository.listManaged('news'),window.AdminRepository.getNewsSettings(),canAdmin?window.AdminRepository.listSectionResponsibilities('news'):Promise.resolve([]),canAdmin?window.AdminRepository.listSectionResponsibilityAudit('news'):Promise.resolve([])]);items=pair[0].map((n)=>Object.assign({},n,{visible:n.published,hue:n.accent_hue,date:n.display_date||'',read:n.reading_minutes?String(n.reading_minutes)+' min':'',audience:{mode:'all',cargos:[],sindicatos:[],niveles:[]}}));settings={responsableNombre:pair[1].responsible_name||'',responsableCargo:pair[1].responsible_title||'',responsableRol:''};assignments=pair[2];assignmentAudit=pair[3];phase='loaded';emit();}catch(_){phase='error';items=[];emit();}};
    const save=async(d)=>{try{const mins=parseInt(String(d.read||''),10);await window.AdminRepository.saveManaged('news',{id:String(d.id||'').startsWith('new-')?null:d.id,title:d.title,tag:d.tag||null,body:d.body||'',image_asset_id:d.image_asset_id||null,accent_hue:Number(d.hue)||345,display_date:d.date||null,reading_minutes:Number.isFinite(mins)?mins:null,published:d.visible!==false,publish_from:d.publish_from||null,publish_until:d.publish_until||null,sort_order:d.sort_order});await load();if(app.editorial&&app.editorial.retry)await app.editorial.retry();app.toast('Noticia guardada');return true;}catch(_){report();return false;}};
    return {
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},load,phase:()=>phase,
      can(action){const map={ver:'news.read',crear:'news.create',editar:'news.update',eliminar:'news.delete',publicar:'news.publish',reordenar:'news.order',assets:'news.assets'};return window.AdminRepository.has(map[action]||action);},viewer:()=>({registrado:true}),roles:()=>[],getRole:()=>null,
      newsAll:()=>items.slice(),getNews:(id)=>items.find((n)=>n.id===id),newsVisibleFor:()=>true,
      blankNews:()=>({id:'new-'+crypto.randomUUID(),title:'',tag:'',body:'',hue:345,date:'',read:'',visible:false,sort_order:items.length+1,image_asset_id:null,image_url:null,audience:{mode:'all',cargos:[],sindicatos:[],niveles:[]}}),
      saveNews:save,removeNews:async(id)=>{try{await window.AdminRepository.removeManaged('news',id);await load();if(app.editorial&&app.editorial.retry)await app.editorial.retry();}catch(_){report();}},
      duplicateNews:async(id)=>{const row=items.find((n)=>n.id===id);if(row)await save(Object.assign({},row,{id:null,title:row.title+' (copia)',visible:false,sort_order:items.length+1}));},
      toggleNews:async(id)=>{const row=items.find((n)=>n.id===id);if(!row)return;try{await window.AdminRepository.setEnabled('news',id,!row.published);await load();if(app.editorial&&app.editorial.retry)await app.editorial.retry();}catch(_){report();}},
      reorderNews:async(ids)=>{try{await window.AdminRepository.reorderManaged('news',ids);await load();if(app.editorial&&app.editorial.retry)await app.editorial.retry();}catch(_){report();}},
      newsSettings:()=>settings,setNewsSettings:(patch)=>{settings=Object.assign({},settings,patch);emit();window.AdminRepository.updateNewsSettings({responsible_name:settings.responsableNombre||null,responsible_title:settings.responsableCargo||null}).catch(report);},
      assignments:()=>assignments.slice(),assignmentAudit:()=>assignmentAudit.slice(),
      resolveResponsibility:(email)=>window.AdminRepository.resolveSectionResponsibility(email),
      setResponsibility:async(email,actions)=>{await window.AdminRepository.setSectionResponsibilities(email,'news',actions);await load();},
      revokeResponsibility:async(authId)=>{await window.AdminRepository.revokeSectionResponsibilities(authId,'news');await load();},
    };
  }
  function useStore(app) { const ref=useRef(null);if(!ref.current)ref.current=createRemoteStore(app);const [, f] = useState(0);useEffect(() => {const off=ref.current.subscribe(() => f((n) => n + 1));ref.current.load();return off;}, []);return ref.current; }
  const inputBase = { width: '100%', border: 'none', outline: 'none', background: 'var(--surface-2)', boxShadow: 'var(--neo-inset)', borderRadius: 13, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', color: 'var(--ink)', boxSizing: 'border-box' };
  const HUES = [345, 36, 150, 205, 275, 188];

  function NewsModule({ app, onBack, header }) {
    const store = useStore(app);
    const [editing, setEditing] = useState(null);
    const [respOpen, setRespOpen] = useState(false);
    const viewer = store.viewer();
    const P = { crear: store.can('crear'), editar: store.can('editar'), eliminar: store.can('eliminar'), publicar:store.can('publicar'), reordenar: store.can('reordenar'),assets:store.can('assets') };
    const items = store.newsAll();

    return React.createElement('div', null,
      header({ title: 'Noticias del sindicato', sub: items.length + ' noticias · ' + items.filter((n) => n.visible !== false).length + ' visibles', onBack }),
      React.createElement(window.ActingBanner, {}),
      React.createElement('div', { className: 'su-app-scroll', style: { padding: '16px 16px 26px' } },
        React.createElement(ResponsableCard, { open: respOpen, setOpen: setRespOpen, store, P }),

        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' } },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: 'var(--ink-3)', letterSpacing: '.06em' } }, 'NOTICIAS'),
          P.crear && React.createElement('button', { onClick: () => setEditing(store.blankNews()), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: 'var(--grad-guinda-soft)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--glow-guinda)' } },
            React.createElement(I, { name: 'plus', size: 17, stroke: 2.6 }), 'Nueva')),

        items.length > 1 && P.reordenar && React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 } }, React.createElement(I, { name: 'grip', size: 13, stroke: 2 }), 'arrastra para reordenar'),

        items.length === 0
          ? React.createElement(window.EmptyState, { icon: 'news', title: 'Sin noticias', sub: 'Publica la primera con “Nueva”.' })
          : React.createElement(NewsDragList, {
            ids: items.map((n) => n.id), canReorder: P.reordenar, store,
            onReorder: (ids) => store.reorderNews(ids),
            renderRow: (id, onGrab, dragging) => React.createElement(NewsRow, { key: id, n: store.getNews(id), store, viewer, P, onGrab, dragging, onEdit: setEditing }),
          }),

        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 7, background: '#FFF4D8', color: '#6B4700', borderRadius: 12, padding: '10px 13px', marginTop: 18, fontSize: 11.5, fontWeight: 700, lineHeight: 1.45 } },
          React.createElement(I, { name: 'checkCircle', size: 15, stroke: 2.2, style: { flexShrink: 0, marginTop: 1 } }), 'Los cambios se reflejan en vivo en la sección “Noticias del sindicato” del Inicio.')),

      editing && React.createElement(NewsEditor, { item: editing, store, P, onClose: () => setEditing(null) }));
  }

  // ── Responsable de la sección ──
  function ResponsableCard({ open, setOpen, store, P }) {
    const s = store.newsSettings();
    const [email,setEmail]=useState('');const[resolved,setResolved]=useState(null);const[busy,setBusy]=useState(false);
    const [actions,setActions]=useState(['read','create','update','publish','order']);
    const canReadAssignments=window.AdminRepository.has('authorization.read');const canWriteAssignments=window.AdminRepository.has('authorization.write');
    const current=store.assignments().filter((x)=>x.enabled);const grouped={};current.forEach((x)=>{const key=x.auth_user_id;(grouped[key]=grouped[key]||{auth_user_id:key,email:x.email,display_name:x.display_name,actions:[]}).actions.push(x.action);});
    const activeUsers=Object.values(grouped);const labels={read:'Ver',create:'Crear',update:'Editar',delete:'Eliminar',publish:'Publicar',order:'Ordenar',assets:'Imágenes'};
    const toggleAction=(action)=>setActions((list)=>list.includes(action)?list.filter((x)=>x!==action):list.concat(action));
    const resolve=async()=>{setBusy(true);try{const user=await store.resolveResponsibility(email);setResolved(user);}catch(_){setResolved(null);}finally{setBusy(false);}};
    const saveAssignment=async()=>{if(!resolved||!actions.length)return;setBusy(true);try{await store.setResponsibility(resolved.email,actions);setEmail('');setResolved(null);}finally{setBusy(false);}};
    const editAssignment=(user)=>{setEmail(user.email);setResolved({auth_user_id:user.auth_user_id,email:user.email,display_name:user.display_name});setActions(user.actions.slice());};
    const revoke=async(user)=>{setBusy(true);try{await store.revokeResponsibility(user.auth_user_id);}finally{setBusy(false);}};
    const field = (label, key, ph) => React.createElement('div', { style: { marginBottom: 12 } },
      React.createElement('label', { style: { fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 6 } }, label),
      React.createElement('input', { value: s[key] || '', placeholder: ph, disabled: !P.editar, onChange: (e) => store.setNewsSettings({ [key]: e.target.value }), style: { ...inputBase, opacity: P.editar ? 1 : .6 } }));
    return React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--neo-sm)', overflow: 'hidden' } },
      React.createElement('button', { onClick: () => setOpen(!open), style: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'none', border: 'none', padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' } },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: 12, background: 'var(--grad-guinda-soft)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: 'var(--glow-guinda)' } }, React.createElement(I, { name: 'user', size: 21, stroke: 2 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' } }, 'Responsable de la sección'),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, (s.responsableNombre || 'Sin asignar') + (s.responsableCargo ? ' · ' + s.responsableCargo : ''))),
        React.createElement(I, { name: open ? 'chevD' : 'chevR', size: 18, stroke: 2.2, style: { color: 'var(--ink-3)' } })),
      open && React.createElement('div', { style: { padding: '6px 15px 15px', borderTop: '1px solid var(--hairline)' } },
        React.createElement('div', { style: { height: 8 } }),
        field('Nombre del responsable', 'responsableNombre', 'Ej. Mtra. Diana Espinoza'),
        field('Cargo', 'responsableCargo', 'Ej. Secretaría de Actas'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)', lineHeight: 1.4 } },
          React.createElement(I, { name: 'shield', size: 14, stroke: 2, style: { color: 'var(--guinda)', flexShrink: 0 } }),
          'Estos datos identifican públicamente quién atiende la sección.'),
        canReadAssignments&&React.createElement('div',{'data-news-responsibility-admin':'',style:{marginTop:16,paddingTop:14,borderTop:'1px solid var(--hairline)'}},
          React.createElement('div',{style:{fontSize:12.5,fontWeight:900,color:'var(--ink)',marginBottom:9}},'Acceso del responsable'),
          activeUsers.length===0&&React.createElement('div',{style:{fontSize:12,color:'var(--ink-3)',marginBottom:10}},'Sin responsable con acceso activo.'),
          activeUsers.map((user)=>React.createElement('div',{key:user.auth_user_id,style:{background:'var(--surface-2)',borderRadius:12,padding:11,marginBottom:8}},
            React.createElement('div',{style:{fontSize:13,fontWeight:850,color:'var(--ink)'}},user.display_name),
            React.createElement('div',{style:{fontSize:11.5,color:'var(--ink-3)',marginTop:2}},user.email),
            React.createElement('div',{style:{fontSize:10.5,fontWeight:750,color:'var(--guinda)',marginTop:6}},user.actions.map((a)=>labels[a]||a).join(' · ')),
            canWriteAssignments&&React.createElement('div',{style:{display:'flex',gap:8,marginTop:9}},
              React.createElement('button',{onClick:()=>editAssignment(user),disabled:busy,style:{border:'none',borderRadius:9,padding:'7px 10px',fontWeight:800,cursor:'pointer'}},'Editar'),
              React.createElement('button',{onClick:()=>revoke(user),disabled:busy,style:{border:'none',borderRadius:9,padding:'7px 10px',fontWeight:800,cursor:'pointer',color:'#C0341D',background:'#FDEAEA'}},'Revocar')))),
          canWriteAssignments&&React.createElement('div',{style:{marginTop:12}},
            React.createElement('label',{style:{fontSize:12,fontWeight:800,color:'var(--ink-2)',display:'block',marginBottom:6}},'Buscar usuario por email'),
            React.createElement('div',{style:{display:'flex',gap:8}},
              React.createElement('input',{type:'email',value:email,onChange:(e)=>{setEmail(e.target.value);setResolved(null);},placeholder:'usuario@dominio.mx',style:inputBase}),
              React.createElement('button',{onClick:resolve,disabled:busy||!email.trim(),style:{border:'none',borderRadius:11,padding:'0 12px',fontWeight:850,cursor:'pointer',background:'var(--surface-2)'}},'Buscar')),
            resolved&&React.createElement('div',{'data-news-resolved-user':resolved.auth_user_id,style:{marginTop:9,fontSize:12,fontWeight:750,color:'var(--ink-2)'}},'Usuario resuelto: ',resolved.display_name,' · ',resolved.email),
            resolved&&React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:7,marginTop:10}},Object.keys(labels).map((action)=>React.createElement('button',{key:action,onClick:()=>toggleAction(action),style:{border:'none',borderRadius:999,padding:'7px 10px',fontSize:11,fontWeight:800,cursor:'pointer',background:actions.includes(action)?'var(--guinda)':'var(--surface-2)',color:actions.includes(action)?'#fff':'var(--ink-2)'}},labels[action]))),
            resolved&&React.createElement(window.Btn,{full:true,size:'sm',disabled:busy||!actions.length,onClick:saveAssignment,style:{marginTop:11}},'Guardar permisos')),
          React.createElement('div',{'data-news-responsibility-audit':'',style:{fontSize:10.5,color:'var(--ink-3)',marginTop:10}},store.assignmentAudit().length+' eventos de asignación auditados'))));
  }

  // ── Fila de noticia ──
  function NewsRow({ n, store, viewer, P, onGrab, dragging, onEdit }) {
    if (!n) return null;
    const aud = n.audience || { mode: 'all' };
    const audLabel = { all: 'Todos', registered: 'Registrados', segment: 'Segmentado' }[aud.mode] || 'Todos';
    const hiddenSeg = n.visible !== false && !store.newsVisibleFor(n, viewer);
    const iconBtn = (icon, onClick, tone) => React.createElement('button', { onClick: (e) => { e.stopPropagation(); onClick(); }, style: { width: 34, height: 34, borderRadius: 10, border: 'none', background: 'var(--surface-2)', color: tone || 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 17, stroke: 2 }));
    return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', background: 'var(--surface)', borderRadius: 14, boxShadow: dragging ? 'var(--shadow-lg)' : 'var(--neo-sm)', overflow: 'hidden', opacity: n.visible === false ? .55 : 1, marginBottom: 8 } },
      onGrab
        ? React.createElement('div', { onPointerDown: onGrab, onTouchStart: onGrab, style: { display: 'grid', placeItems: 'center', width: 30, background: 'var(--surface-2)', color: 'var(--ink-3)', cursor: 'grab', touchAction: 'none', flexShrink: 0 } }, React.createElement(I, { name: 'grip', size: 17, stroke: 2 }))
        : React.createElement('div', { style: { width: 8, flexShrink: 0 } }),
      React.createElement('div', { style: { width: 44, alignSelf: 'stretch', background: `linear-gradient(150deg, hsl(${n.hue || 345},60%,44%), hsl(${n.hue || 345},62%,30%))`, position: 'relative', flexShrink: 0, overflow: 'hidden' } },
        n.image_url && React.createElement('img', { src:n.image_url, alt:'', style: { position: 'absolute', inset: 0, width: '100%', height: '100%',objectFit:'cover' } })),
      React.createElement('button', { onClick: () => (P.editar ? onEdit(n) : null), style: { flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '10px 11px', cursor: P.editar ? 'pointer' : 'default', fontFamily: 'inherit' } },
        React.createElement('div', { style: { fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, n.title || 'Sin título'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 } },
          n.tag && chip(n.tag, 'bookmark'),
          chip(audLabel, aud.mode === 'segment' ? 'filter' : aud.mode === 'registered' ? 'user' : 'globe'),
          n.visible === false && chip('Oculta', 'ban', true),
          hiddenSeg && chip('Oculta en vista', 'eye', true))),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' } },
        P.crear&&P.assets && iconBtn('copy', () => store.duplicateNews(n.id)),
        P.eliminar&&n.record_origin==='ADMIN_PHASE2'&&iconBtn('trash',()=>store.removeNews(n.id),'#C0341D'),
        React.createElement(window.Toggle, { on: n.visible !== false, size: 'md', onClick: (e) => { e.stopPropagation(); if (P.publicar) store.toggleNews(n.id); }, disabled: !P.publicar, 'aria-label': 'Visible', })));
  }
  function chip(label, icon, warn) {
    return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: warn ? '#FDEAEA' : 'var(--surface-2)', color: warn ? '#C0341D' : 'var(--ink-3)' } },
      React.createElement(I, { name: icon, size: 12, stroke: 2.2 }), label);
  }

  // ── Lista con reordenamiento por arrastre ──
  function NewsDragList({ ids, canReorder, store, onReorder, renderRow }) {
    const [order, setOrder] = useState(ids);
    const orderRef = useRef(ids);
    const rowRefs = useRef({});
    const [dragId, setDragId] = useState(null);
    useEffect(() => { const j = ids.join(','); if (j !== orderRef.current.join(',')) { orderRef.current = ids; setOrder(ids); } }, [ids.join(',')]);
    const setBoth = (o) => { orderRef.current = o; setOrder(o); };
    const begin = (e, id) => {
      e.preventDefault(); setDragId(id);
      const move = (ev) => {
        const y = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
        const cur = orderRef.current; const from = cur.indexOf(id); if (from < 0) return;
        let target = cur.length - 1;
        for (let i = 0; i < cur.length; i++) { const el = rowRefs.current[cur[i]]; if (!el) continue; const r = el.getBoundingClientRect(); if (y < r.top + r.height / 2) { target = i; break; } }
        if (target !== from) { const next = cur.filter((x) => x !== id); next.splice(target, 0, id); setBoth(next); }
      };
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
        setDragId(null); onReorder(orderRef.current);
      };
      window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
      window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', up);
    };
    window.useFlipRows(rowRefs, dragId);
    return React.createElement('div', null,
      order.map((id) => {
        const dragging = dragId === id;
        return React.createElement('div', { key: id, ref: (el) => { rowRefs.current[id] = el; }, style: { position: 'relative', zIndex: dragging ? 6 : 1, transform: dragging ? 'scale(1.015)' : 'none', transition: dragging ? 'none' : 'transform .15s' } },
          renderRow(id, canReorder ? (e) => begin(e, id) : null, dragging));
      }));
  }

  // ── Editor de noticia (con vista previa en vivo) ──
  function NewsEditor({ item, store, P, onClose }) {
    const [d, setD] = useState(() => JSON.parse(JSON.stringify(item)));
    const pendingRef=useRef(null);
    const isNew = !store.getNews(item.id);
    const set = (patch) => setD((p) => ({ ...p, ...patch }));
    const setAud = (patch) => setD((p) => ({ ...p, audience: { ...p.audience, ...patch } }));
    const [busy,setBusy]=useState(false);
    const save = async () => { setBusy(true);const ok=await store.saveNews(d);if(ok)pendingRef.current=null;setBusy(false);if(ok)onClose(); };
    const cancel=async()=>{setBusy(true);if(pendingRef.current)await window.AdminRepository.discardAsset(pendingRef.current);pendingRef.current=null;setBusy(false);onClose();};
    const del = () => { store.removeNews(d.id); onClose(); };
    const lbl = { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', display: 'block', marginBottom: 7 };
    const fieldWrap = { marginBottom: 16 };

    return React.createElement('div', { style: { position: 'absolute', inset: 0, zIndex: 72, background: 'var(--bg)', display: 'flex', flexDirection: 'column' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement('button', { onClick: cancel, disabled:busy,style: { width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink)' } }, React.createElement(I, { name: 'close', size: 22, stroke: 2 })),
        React.createElement('span', { style: { flex: 1, fontSize: 16.5, fontWeight: 800 } }, isNew ? 'Nueva noticia' : 'Editar noticia')),

      React.createElement('div', { className: 'su-app-scroll', style: { flex: 1, overflowY: 'auto', padding: 16 } },
        // vista previa (tarjeta como en Inicio)
        React.createElement('div', { style: { ...lbl, marginBottom: 8 } }, 'Vista previa'),
        React.createElement('div', { style: { background: 'var(--surface)', borderRadius: 20, padding: 10, boxShadow: 'var(--neo-md)', marginBottom: 20 } },
          React.createElement('div', { style: { height: 118, borderRadius: 14, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, hsl(${d.hue} 52% 44%), hsl(${d.hue} 58% 30%))` } },
            d.image_url && React.createElement('img', { src:d.image_url,alt:'',style: { position: 'absolute', inset: 0, width: '100%', height: '100%',objectFit:'cover' } }),
            d.tag && React.createElement('div', { style: { position: 'absolute', top: 10, left: 10, zIndex: 2 } }, React.createElement(window.Badge, { tone: 'gold', solid: true }, (d.tag || '').toUpperCase()))),
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, margin: '11px 6px 0', color: 'var(--ink)' } }, d.title || 'Título de la noticia'),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, margin: '5px 6px 8px' } }, (d.date || '') + ' · ' + (d.read || '') + ' lectura')),

        React.createElement('div', { style: fieldWrap },
          React.createElement('label', { style: lbl }, 'Título'),
          React.createElement('input', { value: d.title, placeholder: 'Título de la noticia', onChange: (e) => set({ title: e.target.value }), style: inputBase })),
        React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 16 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('label', { style: lbl }, 'Etiqueta'),
            React.createElement('input', { value: d.tag, placeholder: 'Ej. Asamblea', onChange: (e) => set({ tag: e.target.value }), style: inputBase })),
          React.createElement('div', { style: { width: 120 } },
            React.createElement('label', { style: lbl }, 'Lectura'),
            React.createElement('input', { value: d.read, placeholder: '2 min', onChange: (e) => set({ read: e.target.value }), style: inputBase }))),
        React.createElement('div', { style: fieldWrap },
          React.createElement('label', { style: lbl }, 'Fecha'),
          React.createElement('input', { type:'date',value: d.date, onChange: (e) => set({ date: e.target.value }), style: inputBase })),

        React.createElement('div', { style: fieldWrap },
          React.createElement('label', { style: lbl }, 'Imagen de cabecera'),
          React.createElement('div', { style: { borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--neo-sm)', height: 120, position: 'relative', background: `linear-gradient(150deg, hsl(${d.hue},70%,42%), hsl(${d.hue},65%,26%))` } },
            d.image_url ? React.createElement('img', { src:d.image_url,alt:'',style: { position: 'absolute', inset: 0, width: '100%', height: '100%',objectFit:'cover' } }):React.createElement('div',{style:{display:'grid',placeItems:'center',height:'100%',color:'#fff',fontWeight:800}},'Sin imagen')),
          P.assets&&React.createElement('input',{type:'file',accept:'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',disabled:busy,onChange:async(e)=>{const file=e.target.files&&e.target.files[0];if(!file)return;setBusy(true);try{const asset=await window.AdminRepository.uploadManagedAsset(file,'app-assets','NEWS_IMAGE','news.image');if(pendingRef.current)await window.AdminRepository.discardAsset(pendingRef.current);pendingRef.current=asset;set({image_asset_id:asset.id,image_url:asset.url});}finally{setBusy(false);e.target.value='';}},style:{marginTop:9}})),
        React.createElement('div', { style: fieldWrap },
          React.createElement('label', { style: lbl }, 'Color de acento (fondo sin imagen)'),
          React.createElement('div', { style: { display: 'flex', gap: 10 } },
            HUES.map((h) => React.createElement('button', { key: h, onClick: () => set({ hue: h }), style: { width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', background: `hsl(${h},68%,45%)`, border: d.hue === h ? '3px solid var(--ink)' : '3px solid transparent', boxShadow: 'var(--neo-sm)' } })))),

        React.createElement('div', { style: fieldWrap },
          React.createElement('label', { style: lbl }, 'Contenido del artículo'),
          React.createElement(window.RichTextEditor, { value: d.body||'', onChange: (body) => set({ body }) }),
          d.body&&React.createElement('div',{'data-rich-text-preview':'',style:{marginTop:10,padding:13,borderRadius:13,background:'var(--surface)',fontSize:14,color:'var(--ink-2)',lineHeight:1.55}},React.createElement(window.RichText,{value:d.body}))),

        React.createElement(SectionTitle, { icon: 'power', label: 'Publicación' }),
        React.createElement('button', { onClick: () => P.publicar&&set({ visible: d.visible === false }), disabled:!P.publicar,style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'var(--surface)', border: 'none', boxShadow: 'var(--neo-sm)', borderRadius: 15, padding: '13px 15px', cursor: P.publicar?'pointer':'default',opacity:P.publicar?1:.6,marginBottom: 18 } },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { style: { fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' } }, d.visible === false ? 'No publicada' : 'Publicada'),
            React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 2 } }, d.visible === false ? 'No se muestra en la app' : 'Visible según sus reglas')),
          React.createElement(window.Toggle, { on: d.visible !== false, size: 'xl', })),

        React.createElement(SectionTitle, { icon: 'users', label: 'Visibilidad y segmentación' }),
        React.createElement('div',{style:{background:'#FFF4D8',color:'#6B4700',borderRadius:13,padding:13,fontSize:12,fontWeight:750,marginBottom:18}},'Las noticias publicadas son visibles para todos los usuarios. La segmentación por perfil aún no está disponible.'),

        !isNew && item.record_origin==='ADMIN_PHASE2' && P.eliminar && React.createElement('button', { onClick: del, style: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#FDEAEA', color: '#C0341D', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', marginTop: 4 } },
          React.createElement(I, { name: 'trash', size: 18, stroke: 2 }), 'Eliminar noticia'),
        React.createElement('div', { style: { height: 18 } })),

      React.createElement('div', { style: { display: 'flex', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--hairline)', flexShrink: 0 } },
        React.createElement(window.Btn, { variant: 'outline', style: { flex: 1 }, disabled:busy,onClick: cancel }, 'Cancelar'),
        React.createElement(window.Btn, { variant: 'primary', icon: 'check', style: { flex: 2 }, disabled: busy||!d.title.trim(), onClick: save }, busy?'Guardando…':'Guardar noticia')));
  }

  function Chips(label, options, values, onChange) {
    const list = values || [];
    const toggle = (o) => onChange(list.indexOf(o) !== -1 ? list.filter((x) => x !== o) : [...list, o]);
    return React.createElement('div', { style: { marginBottom: 14 } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', marginBottom: 7 } }, label),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        options.map((o) => {
          const on = list.indexOf(o) !== -1;
          return React.createElement('button', { key: o, onClick: () => toggle(o), style: { display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: on ? 'var(--grad-guinda-soft)' : 'var(--surface-2)', color: on ? '#fff' : 'var(--ink-2)', boxShadow: on ? 'var(--glow-guinda)' : 'var(--neo-inset)' } },
            on && React.createElement(I, { name: 'check', size: 14, stroke: 3 }), o);
        })));
  }
  function SectionTitle({ icon, label }) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px' } },
      React.createElement('div', { style: { width: 26, height: 26, borderRadius: 8, background: 'var(--guinda-50)', color: 'var(--guinda)', display: 'grid', placeItems: 'center', flexShrink: 0 } }, React.createElement(I, { name: icon, size: 16, stroke: 2 })),
      React.createElement('span', { style: { fontSize: 14.5, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-.01em' } }, label),
      React.createElement('div', { style: { flex: 1, height: 1, background: 'var(--hairline)' } }));
  }

  window.NewsModule = NewsModule;
})();
