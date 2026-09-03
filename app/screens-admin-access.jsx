/* Focused administration for total admins, enforced screen actions and impersonation. */
(function(){
  'use strict';
  const h=React.createElement,I=window.Icon;
  const card={background:'var(--surface)',borderRadius:18,padding:16,boxShadow:'var(--neo-sm)'};
  const input={width:'100%',boxSizing:'border-box',minHeight:44,border:'1px solid var(--line)',borderRadius:12,padding:'10px 12px',background:'var(--surface)',color:'var(--ink)',fontFamily:'inherit',fontSize:13};
  function page(header,title,sub,onBack,children){return h('div',null,header({title,sub,onBack}),h('div',{className:'su-app-scroll',style:{padding:18}},children));}
  function message(text,tone){return text&&h('div',{role:tone==='error'?'alert':'status',style:{marginTop:11,padding:'10px 12px',borderRadius:11,background:tone==='error'?'#FDEAEA':'#E7F6ED',color:tone==='error'?'#A32921':'#13794A',fontSize:12.5,fontWeight:750}},text);}
  function assignmentCard(row,canWrite,busy,revoke){
    return h('article',{key:row.assignment_id,'data-admin-assignment':row.enabled?'active':'revoked',style:Object.assign({},card,{display:'flex',alignItems:'center',gap:12,marginBottom:9,opacity:row.enabled?1:.62})},
      h('div',{style:{width:38,height:38,borderRadius:11,display:'grid',placeItems:'center',background:row.protected_assignment?'var(--guinda-50)':'var(--surface-2)',color:'var(--guinda)'}},h(I,{name:row.protected_assignment?'shield':'users',size:20})),
      h('div',{style:{flex:1,minWidth:0}},
        h('strong',{style:{display:'block',fontSize:13.5}},row.display_name||row.email),
        h('span',{style:{display:'block',fontSize:11.5,color:'var(--ink-3)',marginTop:2}},row.email,' · ',row.role_name,row.enabled?' · Activo':' · Revocado'),
        h('span',{style:{display:'block',fontSize:10.5,color:'var(--ink-3)',marginTop:3}},'Asignado ',new Date(row.assigned_at).toLocaleDateString(),' por ',row.assigned_by_email||'migración histórica',!row.enabled&&row.revoked_at?' · Revocado '+new Date(row.revoked_at).toLocaleDateString():'')),
      canWrite&&row.enabled&&!row.protected_assignment&&h('button',{disabled:busy,onClick:()=>revoke(row),style:{border:'none',borderRadius:10,padding:'8px 10px',background:'#FDEAEA',color:'#A32921',fontWeight:800,cursor:'pointer'}},'Revocar'));
  }

  function AdministratorsModule({app,onBack,header}){
    const[email,setEmail]=React.useState(''),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(false),[note,setNote]=React.useState(''),[error,setError]=React.useState('');
    const canWrite=app.admin.has('authorization.write'),repo=window.AdminCutoverRepository;
    const load=React.useCallback(async()=>{setError('');try{setRows(await repo.listAdminAssignments());}catch(_){setError('No fue posible consultar las asignaciones administrativas.');}},[]);
    React.useEffect(()=>{load();},[load]);
    const add=async()=>{setBusy(true);setError('');setNote('');try{await repo.addTotalAdmin(email);setEmail('');setNote('Administrador agregado con acceso total.');await load();}catch(e){const t=String(e&&e.message||e);setError(t.includes('SELF_ASSIGNMENT')?'No puedes modificar tu propia asignación.':t.includes('NOT_FOUND')?'No existe una cuenta confirmada con ese correo.':'No fue posible agregar al administrador.');}finally{setBusy(false);}};
    const revoke=async row=>{setBusy(true);setError('');setNote('');try{await repo.revokeAdmin(row.auth_user_id);setNote('Acceso administrativo revocado.');await load();}catch(e){const t=String(e&&e.message||e);setError(t.includes('PROTECTED')?'La cuenta principal protegida no se puede revocar.':t.includes('SELF_ASSIGNMENT')?'No puedes revocar tu propia cuenta.':'No fue posible revocar el acceso.');}finally{setBusy(false);}};
    const form=h('section',{'data-admin-assignment-form':'total',style:card},
      h('strong',{style:{fontSize:15,color:'var(--ink)'}},'Agregar administrador'),
      h('p',{style:{fontSize:12.5,lineHeight:1.5,color:'var(--ink-3)'}},'El correo se usa solamente para localizar una cuenta confirmada. La asignación queda vinculada de forma durable a esa cuenta.'),
      canWrite&&h('div',{style:{display:'flex',gap:8}},h('input',{value:email,onChange:e=>setEmail(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&email.includes('@'))add();},placeholder:'correo@dominio','aria-label':'Correo del nuevo administrador',style:input}),h(window.Btn,{onClick:add,disabled:busy||!email.includes('@')},busy?'Guardando…':'Agregar')),
      message(error,'error'),message(note,'ok'));
    const list=h('section',{style:{marginTop:16}},h('div',{style:{fontSize:12,fontWeight:900,color:'var(--ink-3)',letterSpacing:'.06em',marginBottom:9}},'ASIGNACIONES'),rows.map(row=>assignmentCard(row,canWrite,busy,revoke)),!rows.length&&!error&&h('div',{style:{color:'var(--ink-3)',fontSize:12}},'Sin asignaciones.'));
    return page(header,'Administradores','Acceso total resuelto por cuenta Auth confirmada',onBack,h(React.Fragment,null,form,list));
  }

  function ScreenPermissionsModule({app,onBack,header}){
    const[definitions,setDefinitions]=React.useState([]),[selected,setSelected]=React.useState(''),[error,setError]=React.useState('');
    React.useEffect(()=>{window.AdminRepository.listSectionDefinitions().then(rows=>{setDefinitions(rows);setSelected(current=>current||(rows[0]&&rows[0].section_key)||'');}).catch(()=>setError('No fue posible consultar el registro de pantallas protegido.'));},[]);
    const definition=definitions.find(row=>row.section_key===selected);
    const picker=h('section',{'data-admin-screen-permissions':'backend-registry',style:card},
      h('label',{style:{display:'block',fontSize:12,fontWeight:850,color:'var(--ink-3)',marginBottom:7}},'Pantalla o sección'),
      h('select',{value:selected,onChange:e=>setSelected(e.target.value),style:input},definitions.map(row=>h('option',{key:row.section_key,value:row.section_key},row.display_name))),
      definition&&h('p',{style:{fontSize:11.5,lineHeight:1.45,color:'var(--ink-3)',marginBottom:0}},'Límite de datos: ',definition.data_boundary),message(error,'error'));
    const panel=definition&&h('div',{style:{marginTop:14}},h(window.SectionResponsibilityPanel,{key:definition.section_key,sectionKey:definition.section_key,sectionName:definition.display_name,allowedActions:definition.allowed_actions,expanded:true,app}));
    return page(header,'Permisos por pantalla','Acciones exactas sobre secciones con enforcement backend',onBack,h(React.Fragment,null,picker,panel));
  }

  function affiliateResult(row,selected,setSelected){
    return h('button',{key:row.id,onClick:()=>setSelected(row),'aria-pressed':selected&&selected.id===row.id,style:{display:'flex',gap:10,alignItems:'center',padding:11,border:selected&&selected.id===row.id?'2px solid var(--guinda)':'1px solid var(--line)',borderRadius:12,background:'var(--surface)',textAlign:'left',fontFamily:'inherit',cursor:'pointer'}},
      h(I,{name:'users',size:20}),h('span',null,h('strong',{style:{display:'block'}},row.display_name||row.full_name||'Afiliado'),h('small',{style:{color:'var(--ink-3)'}},'Control ',row.numero_control||'sin dato',row.email?' · '+row.email:'')));
  }
  function ImpersonationModule({app,onBack,header}){
    const[query,setQuery]=React.useState(''),[rows,setRows]=React.useState([]),[selected,setSelected]=React.useState(null),[reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[note,setNote]=React.useState('');
    const search=async()=>{setBusy(true);setError('');try{setRows(await window.AdminRepository.searchAffiliates(query));setSelected(null);}catch(_){setError('No fue posible buscar afiliados con este permiso.');}finally{setBusy(false);}};
    const start=async()=>{setBusy(true);setError('');setNote('');try{await window.AdminRepository.startImpersonation(selected.id,reason);setNote('Tomar control está activo. Usa la navegación principal para ver SutiApp como '+(selected.display_name||selected.full_name||'el afiliado')+'.');setReason('');}catch(e){setError(String(e&&e.message||e).includes('ALREADY_ACTIVE')?'Ya existe una sesión activa. Ciérrala desde el aviso superior.':'No fue posible iniciar la sesión. Verifica el permiso y el motivo.');}finally{setBusy(false);}};
    const results=h('div',{style:{display:'grid',gap:8,marginTop:12}},rows.map(row=>affiliateResult(row,selected,setSelected)));
    const controls=selected&&h(React.Fragment,null,h('textarea',{value:reason,onChange:e=>setReason(e.target.value),maxLength:500,placeholder:'Motivo operativo (mínimo 8 caracteres)',style:Object.assign({},input,{minHeight:82,resize:'vertical',marginTop:13})}),h(window.Btn,{full:true,onClick:start,disabled:busy||reason.trim().length<8,style:{marginTop:9}},busy?'Activando…':'Tomar control'));
    const body=h('section',{'data-admin-impersonation':'explicit-permission',style:card},
      h('p',{style:{fontSize:12.5,lineHeight:1.5,color:'var(--ink-3)'}},'Busca por nombre, número de control o correo. Nunca se solicita ni se cambia la contraseña del afiliado.'),
      h('div',{style:{display:'flex',gap:8}},h('input',{value:query,onChange:e=>setQuery(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&query.trim().length>=2)search();},placeholder:'Nombre, control o correo',style:input}),h(window.Btn,{onClick:search,disabled:busy||query.trim().length<2},'Buscar')),
      results,controls,message(error,'error'),message(note,'ok'));
    return page(header,'Tomar control','Actor real auditado · motivo obligatorio · máximo 30 minutos',onBack,body);
  }
  window.AdministratorsModule=AdministratorsModule;
  window.ScreenPermissionsModule=ScreenPermissionsModule;
  window.ImpersonationModule=ImpersonationModule;
})();
