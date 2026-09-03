/* Reusable UUID-backed section responsibility controls. Email is resolution input only. */
(function(){
  'use strict';
  const labels={read:'Leer',create:'Crear',update:'Editar',delete:'Eliminar',publish:'Publicar',order:'Ordenar',assets:'Archivos',export:'Exportar'};
  function SectionResponsibilityPanel({sectionKey,sectionName,allowedActions,app,expanded}){
    const effectiveActions=[...new Set((allowedActions||[]).concat('export'))];
    const A=window.AdminRepository,canRead=A.has('authorization.read'),canWrite=A.has('authorization.write');
    const[email,setEmail]=React.useState('');const[resolved,setResolved]=React.useState(null);const[actions,setActions]=React.useState(['read']);const[rows,setRows]=React.useState([]);const[audit,setAudit]=React.useState([]);const[busy,setBusy]=React.useState(false);const[open,setOpen]=React.useState(Boolean(expanded));
    const load=async()=>{if(!canRead)return;const pair=await Promise.all([A.listSectionResponsibilities(sectionKey),A.listSectionResponsibilityAudit(sectionKey)]);setRows(pair[0]);setAudit(pair[1]);};
    React.useEffect(()=>{load().catch(()=>{});},[sectionKey,canRead]);
    if(!canRead)return null;
    const resolve=async()=>{setBusy(true);try{const row=await A.resolveSectionResponsibility(email);setResolved(row);const found=rows.find(x=>x.auth_user_id===row.auth_user_id);setActions(found?found.actions:['read']);}catch(_){setResolved(null);app.toast('No se encontró una cuenta confirmada');}finally{setBusy(false);}};
    const save=async()=>{setBusy(true);try{await A.setSectionResponsibilities(email,sectionKey,actions);await load();setResolved(null);setEmail('');app.toast('Responsabilidad guardada');}catch(_){app.toast('No fue posible asignar la responsabilidad');}finally{setBusy(false);}};
    const revoke=async(id)=>{setBusy(true);try{await A.revokeSectionResponsibilities(id,sectionKey);await load();app.toast('Responsabilidad revocada');}catch(_){app.toast('No fue posible revocar la responsabilidad');}finally{setBusy(false);}};
    return React.createElement('section',{'data-section-responsibility-admin':sectionKey,style:{background:'var(--surface)',borderRadius:16,padding:14,boxShadow:'var(--neo-sm)',marginBottom:14}},
      React.createElement('button',{type:'button',onClick:()=>setOpen(!open),style:{width:'100%',border:0,background:'transparent',textAlign:'left',fontWeight:900,color:'var(--ink)',cursor:'pointer'}},'Responsables · ',sectionName||sectionKey),
      open&&React.createElement('div',{style:{marginTop:12}},
        canWrite&&React.createElement(React.Fragment,null,
          React.createElement('div',{style:{display:'flex',gap:7}},React.createElement('input',{value:email,onChange:e=>setEmail(e.target.value),placeholder:'correo@dominio',style:{flex:1,padding:10,borderRadius:10,border:'1px solid var(--line)'}}),React.createElement('button',{disabled:busy||!email.includes('@'),onClick:resolve},'Buscar')),
          resolved&&React.createElement('div',{'data-resolved-account':resolved.auth_user_id,style:{marginTop:10,fontSize:12}},React.createElement('b',null,resolved.email),React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:7,marginTop:9}},effectiveActions.map(action=>React.createElement('label',{key:action,style:{display:'inline-flex',gap:4,alignItems:'center'}},React.createElement('input',{type:'checkbox',checked:actions.includes(action),onChange:e=>setActions(e.target.checked?[...new Set(actions.concat(action))]:actions.filter(x=>x!==action))}),labels[action]||action)),React.createElement('button',{disabled:busy||!actions.length,onClick:save},'Guardar acciones')))),
        React.createElement('div',{style:{marginTop:12}},rows.map(row=>React.createElement('div',{key:row.auth_user_id,style:{display:'flex',gap:8,alignItems:'center',padding:'9px 0',fontSize:12,borderTop:'1px solid var(--line)'}},React.createElement('span',{style:{flex:1}},React.createElement('b',null,row.display_name||row.email),React.createElement('div',{style:{color:'var(--ink-3)',marginTop:2}},row.email,' · ',(row.actions||[]).map(a=>labels[a]||a).join(', ')),React.createElement('div',{style:{color:'var(--ink-3)',marginTop:2}},'Asignado ',new Date(row.assigned_at).toLocaleDateString(),' por ',row.assigned_by_email||'migración histórica')),canWrite&&React.createElement('button',{disabled:busy,onClick:()=>revoke(row.auth_user_id)},'Revocar'))),!rows.length&&React.createElement('div',{style:{fontSize:12,color:'var(--ink-3)'}},'Sin responsable asignado')),
        React.createElement('details',{style:{marginTop:9,fontSize:11}},React.createElement('summary',null,'Ver auditoría (',audit.length,')'),audit.slice(0,20).map((row,i)=>React.createElement('div',{key:i},row.action,' · ',row.result)))));
  }
  window.SectionResponsibilityPanel=SectionResponsibilityPanel;
})();
