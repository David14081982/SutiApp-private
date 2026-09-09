/* Supabase-backed adapters for the approved Admin cutover. No localStorage,
   DATA or mock is authoritative for these domains. */
(function(){
  'use strict';
  const repo=window.AdminCutoverRepository, store=window.adminStore;
  if(!repo||!store) throw new Error('ADMIN_CUTOVER_DEPENDENCY_MISSING');
  let roles=[],segments=[],access={},companies=[],companyProfiles=[],companyRules=[],ads=[],acting=null;
  const listeners=new Set();
  const emit=()=>listeners.forEach(fn=>fn());
  const fail=(e)=>{console.error('Admin cutover authority error',e); if(window.__sutiToast) window.__sutiToast('No se pudo guardar en Supabase');};
  const resourcePermission=(id)=>{
    if(id==='roles')return'authorization';
    if(id==='catalogos'||id==='pantallas')return'segmentation';
    if(id==='convenios')return'companies';
    if(id==='sindicato')return'union_content';
    if(id==='fincat'||id==='flujos')return'workflow';
    if(id==='branding')return'assets';
    if(id==='noticias')return'news';
    if(id==='marketplace')return'marketplace';
    if(id==='planes'||id==='membresias')return'memberships';
    if(id==='popups')return'popups'; if(id==='banners')return'banners';
    if(id==='finanzas')return'program_requests';
    if(id==='savings'||id==='savings_approvals'||id==='savings_config'||id==='savings_reports'||id==='savings_identity')return'savings';
    if(id==='fondos')return'financial_criteria.visibility';
    if(id==='secciones'||id==='menus'||id==='formularios'||id.indexOf('scr_')===0)return'content';
    return'content';
  };
  const specialPermissions=Object.freeze({
    savings:{read:'savings.read',write:'savings.write'},
    savings_approvals:{read:'savings.read',write:'savings.approve'},
    savings_config:{read:'savings.read',write:'savings.config'},
    savings_reports:{read:'savings.read',write:'savings.reports'},
    savings_identity:{read:'savings.read',write:'savings.identity_review'},
  });
  function uiPerms(permissionList){
    const out={}; (window.ADMIN.ALL_RESOURCE_IDS||[]).forEach(id=>{
      const base=resourcePermission(id),special=specialPermissions[id],extra=id==='convenios'?'segmentation':null,read=permissionList.includes(special?special.read:base+'.read')&&(!extra||permissionList.includes(extra+'.read')),write=permissionList.includes(special?special.write:base+'.write')&&(!extra||permissionList.includes(extra+'.write'));
      out[id]={ver:read||write,crear:write,editar:write,eliminar:write,reordenar:write};
    }); return out;
  }
  function projectRole(r){const p=(r.admin_role_permissions||[]).map(x=>x.permission);return{id:r.id,name:r.name,desc:r.description,system:r.system_role,all:r.code==='principal_admin',impersonate:p.includes('affiliates.impersonate'),perms:uiPerms(p),_permissions:p};}
  // Cada dominio se resuelve por separado: un fallo aislado no puede dejar el
  // panel completo en blanco (regresión real: un embed inválido vaciaba roles,
  // catálogos, convenios y acceso a pantallas a la vez).
  let failedDomains=[];
  const jobs=[
      ['roles',()=>repo.listRoles()],
      ['segments',()=>repo.listSegments()],
      ['access',()=>repo.listScreenAccess()],
      ['companies',()=>window.AdminRepository.listManaged('companies')],
      ['profiles',()=>repo.listCompanyProfiles()],
      ['rules',()=>repo.listCompanyRules()],
      ['banners',()=>window.AdminRepository.listManaged('banners')]];
  const domainKeys=jobs.map(job=>job[0]),pending=new Set();
  let contentContext=null,securityKey='',generation=0,activeLoad=null,certified={};
  const visible=()=>typeof document==='undefined'||document.visibilityState!=='hidden';
  function clearDomain(key){
    if(key==='roles'){roles=[];acting=null;}
    else if(key==='segments')segments=[];
    else if(key==='access')access={};
    else if(key==='companies')companies=[];
    else if(key==='profiles')companyProfiles=[];
    else if(key==='rules')companyRules=[];
    else if(key==='banners')ads=[];
  }
  function contextSecurity(next){
    const a=next.assignment||{};
    return JSON.stringify([a.fullAccess,a.roleCode,(a.permissions||[]).slice().sort(),(a.sectionActions||[]).map(x=>x.section_key+':'+x.action).sort()]);
  }
  function flush(){
    if(activeLoad)return activeLoad;
    if(!contentContext||contentContext.phase!=='authorized'||!visible()||!pending.size)return Promise.resolve();
    const selected=jobs.filter(job=>pending.has(job[0])),epoch=generation;
    const versions=Object.assign({},contentContext.contentVersions||{});
    selected.forEach(job=>pending.delete(job[0]));
    const current=(async()=>{
      const settled=await Promise.allSettled(selected.map(j=>j[1]()));
      if(epoch!==generation)return;
      settled.forEach((r,i)=>{
        const key=selected[i][0];
        if(versions[key]!==((contentContext&&contentContext.contentVersions)||{})[key]){pending.add(key);return;}
        pending.delete(key);
        if(r.status!=='fulfilled'){if(!failedDomains.includes(key))failedDomains.push(key);console.error('Admin cutover authority error ['+key+']',r.reason);return;}
        failedDomains=failedDomains.filter(domain=>domain!==key);
        certified[key]=versions[key];
        const v=r.value;
        if(key==='roles')roles=v.map(projectRole);
        else if(key==='segments')segments=v;
        else if(key==='access'){access={};v.forEach(x=>access[x.screen_id]=x);}
        else if(key==='companies')companies=v;
        else if(key==='profiles')companyProfiles=v;
        else if(key==='rules')companyRules=v;
        else if(key==='banners')ads=v.filter(x=>x.placement==='marketplace'||x.placement==='convenios');
      });
      if(failedDomains.length&&window.__sutiToast)window.__sutiToast('No se pudo cargar: '+failedDomains.join(', '));
      if(!acting||!roles.some(r=>r.id===acting))acting=(roles[0]||{}).id||null;
      emit();
    })().finally(()=>{if(activeLoad===current){activeLoad=null;if(pending.size)flush();}});
    activeLoad=current;return current;
  }
  function receiveContext(next){
    const previous=contentContext,nextSecurity=contextSecurity(next);
    const subjectChanged=!previous||previous.subjectKey!==next.subjectKey;
    const securityChanged=subjectChanged||nextSecurity!==securityKey||previous.phase!==next.phase;
    if(securityChanged){generation+=1;activeLoad=null;}
    contentContext=next;securityKey=nextSecurity;
    if(next.phase!=='authorized'){
      pending.clear();certified={};failedDomains=[];domainKeys.forEach(clearDomain);emit();return;
    }
    if(subjectChanged){certified={};pending.clear();domainKeys.forEach(clearDomain);}
    for(const key of domainKeys){
      if(!next.contentVersions||!Object.prototype.hasOwnProperty.call(certified,key)||certified[key]!==next.contentVersions[key]){
        pending.add(key);
        // New permission/identity snapshots must never retain a row whose
        // visibility has changed while a replacement request is in flight.
        clearDomain(key);
      }
    }
    if(securityChanged||pending.size)emit();
    flush();
  }
  function load(){
    // Explicit mutations/refresh keep their existing fresh-read contract.
    generation+=1;activeLoad=null;
    domainKeys.forEach(key=>pending.add(key));
    return flush();
  }
  const originalSubscribe=store.subscribe.bind(store);
  store.subscribe=(fn)=>{listeners.add(fn);const off=originalSubscribe(fn);return()=>{listeners.delete(fn);off();};};
  store.roles=()=>roles;
  store.getRole=id=>roles.find(r=>r.id===id);
  store.actingRoleId=()=>acting;
  store.actingRole=()=>roles.find(r=>r.id===acting)||roles[0]||{name:'Sin rol',perms:{}};
  store.setActingRole=id=>{acting=id;emit();};
  store.blankRole=()=>({id:null,name:'',desc:'',system:false,all:false,impersonate:false,perms:uiPerms([])});
  store.roleActionCount=r=>Object.values(r.perms||{}).reduce((n,p)=>n+Object.values(p).filter(Boolean).length,0);
  store.can=(action,resource)=>{const r=store.actingRole(),p=r.perms&&r.perms[resource];return!!(p&&p[action]);};
  function technicalPermissions(role){const out=new Set();Object.keys(role.perms||{}).forEach(id=>{const p=role.perms[id],special=specialPermissions[id];if(special){if(p.ver)out.add(special.read);if(p.crear||p.editar||p.eliminar||p.reordenar){out.add(special.read);out.add(special.write);}return;}const bases=[resourcePermission(id)].concat(id==='convenios'?['segmentation']:[]);bases.forEach(base=>{if(p.ver)out.add(base+'.read');if(p.crear||p.editar||p.eliminar||p.reordenar){out.add(base+'.read');out.add(base+'.write');}});});if(role.impersonate)out.add('affiliates.impersonate');return Array.from(out);}
  store.saveRole=role=>repo.saveRole({id:role.id,name:role.name,desc:role.desc,permissions:technicalPermissions(role)}).then(load).catch(fail);
  store.removeRole=id=>repo.deleteRole(id).then(load).catch(fail);
  store.duplicateRole=id=>{const r=store.getRole(id);if(r)repo.saveRole({id:null,name:r.name+' (copia)',desc:r.desc,permissions:r._permissions||technicalPermissions(r)}).then(load).catch(fail);};

  const typeByKind={sindicatos:'union',categorias:'employment_category',generos:'gender',etiquetas:'tag'};
  const rows=kind=>segments.filter(x=>x.catalog_type===typeByKind[kind]&&x.enabled).sort((a,b)=>a.sort_order-b.sort_order);
  const toCodes=(type,values)=>(values||[]).map(v=>{const x=segments.find(s=>s.catalog_type===type&&(s.code===v||s.label===v));return x?x.code:v;});
  const toLabels=(type,values)=>(values||[]).map(v=>{const x=segments.find(s=>s.catalog_type===type&&(s.code===v||s.label===v));return x?x.label:v;});
  store.catalogs=()=>({sindicatos:rows('sindicatos').map(x=>x.label),categorias:rows('categorias').map(x=>x.label),generos:rows('generos').map(x=>x.label),etiquetas:rows('etiquetas').map(x=>x.label),claves:{}});
  store.catalogClave=(kind,label)=>{const x=rows(kind).find(r=>r.label===label);return x?x.code:'';};
  const code=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
  store.addCatalog=(kind,label,clave)=>{const list=rows(kind);repo.saveSegment({catalog_type:typeByKind[kind],code:code(clave||label),label:String(label).trim(),enabled:true,sort_order:list.length+1}).then(load).catch(fail);};
  store.renameCatalog=(kind,oldLabel,newLabel)=>{const x=rows(kind).find(r=>r.label===oldLabel);if(x)repo.saveSegment(Object.assign({},x,{label:String(newLabel).trim()})).then(load).catch(fail);};
  store.setCatalogClave=()=>{};
  store.removeCatalog=(kind,label)=>{const x=rows(kind).find(r=>r.label===label);if(x)repo.deleteSegment(x.id).then(load).catch(fail);};

  const blank=()=>({mode:'public',sindicatos:[],niveles:[],cargos:[],hideTab:true,mensaje:''});
  const fromRow=r=>r?{mode:r.access_mode,sindicatos:toLabels('union',r.union_codes),niveles:toLabels('employment_category',r.employment_category_codes),cargos:toLabels('tag',r.tag_codes),generos:toLabels('gender',r.gender_codes),hideTab:r.hide_navigation,mensaje:r.message||''}:blank();
  store.screenAccess=id=>fromRow(access[id]);
  store.screenAccessAll=()=>window.ADMIN.SCREENS.map(s=>Object.assign({screen:s.id},store.screenAccess(s.id)));
  store.saveScreenAccess=(id,p)=>{const a=Object.assign(blank(),store.screenAccess(id),p||{});repo.saveScreenAccess({screen_id:id,access_mode:a.mode,union_codes:toCodes('union',a.sindicatos),employment_category_codes:toCodes('employment_category',a.niveles),gender_codes:toCodes('gender',a.generos),tag_codes:toCodes('tag',a.cargos),hide_navigation:a.hideTab!==false,message:a.mensaje||''}).then(load).catch(fail);};
  store.resetScreenAccess=id=>{const jobs=id?[repo.deleteScreenAccess(id)]:Object.keys(access).map(repo.deleteScreenAccess);Promise.all(jobs).then(load).catch(fail);};
  store.screenAllowed=(id,v)=>{const a=store.screenAccess(id),ok=(arr,val)=>!arr.length||arr.includes(val);v=v||store.viewer();if(a.mode==='guest')return!v.registrado;if(a.mode==='registered')return!!v.registrado;if(a.mode==='segment')return!!v.registrado&&ok(a.sindicatos,v.sindicato)&&ok(a.niveles,v.nivel)&&ok(a.cargos,v.cargo);return true;};
  store.tabHidden=(id,v)=>!store.screenAllowed(id,v)&&store.screenAccess(id).hideTab!==false;
  function companyAudience(id){const r=companyRules.find(x=>x.company_id===id)||{};return{mode:r.audience_mode||'all',sindicatos:toLabels('union',r.union_codes),niveles:toLabels('employment_category',r.employment_category_codes),generos:toLabels('gender',r.gender_codes),cargos:toLabels('tag',r.tag_codes)};}
  function benefit(b){return{id:b.id,label:b.label,desc:b.description,visible:b.enabled,order:b.sort_order,audience:{mode:b.audience_mode,sindicatos:toLabels('union',b.union_codes),niveles:toLabels('employment_category',b.employment_category_codes),generos:toLabels('gender',b.gender_codes),cargos:toLabels('tag',b.tag_codes)}};}
  function convenio(c){const p=companyProfiles.find(x=>x.company_id===c.id)||{};return{...c,id:c.id,name:c.display_name,description:c.description||'',agreement_description:p.description||'',conditions:p.conditions||'',cat:p.category_label||c.category_raw||'',disc:p.discount_percent||0,hue:p.accent_hue||210,tags:p.tags||[],addr:p.address||c.address_raw||'',fav:!!p.favorite,featured:!!p.featured,slotId:'company_'+c.id,visible:c.enabled,order:c.sort_order||p.sort_order||0,audience:companyAudience(c.id),beneficios:(p.company_benefits||[]).map(benefit)};}
  store.conveniosAll=()=>companies.filter(c=>!c.is_paid).map(convenio).sort((a,b)=>a.order-b.order);store.getConvenio=id=>store.conveniosAll().find(x=>x.id===id);store.conveniosLive=v=>store.conveniosAll().filter(x=>x.visible&&store.audienceMatch(x,v||store.viewer()));store.convenioVisibleFor=(c,v)=>c.visible&&store.audienceMatch(c,v||store.viewer());
  store.blankConvenio=()=>({id:null,name:'',cat:'',disc:0,hue:210,tags:[],addr:'',fav:false,featured:false,visible:true,order:store.conveniosAll().length+1,audience:{mode:'all',sindicatos:[],niveles:[],generos:[],cargos:[]},beneficios:[]});
  store.saveConvenio=async c=>{const audience=a=>({audience_mode:a.mode||'all',union_codes:toCodes('union',a.sindicatos),employment_category_codes:toCodes('employment_category',a.niveles),gender_codes:toCodes('gender',a.generos),tag_codes:toCodes('tag',a.cargos)});const id=await window.ConveniosRepository.saveAgreement({id:c.id||null,company:{display_name:c.name,description:c.description||'',phone_raw:c.phone_raw||null,whatsapp_raw:c.whatsapp_raw||null,email_raw:c.email_raw||null,website_url:c.website_url||null,enabled:c.visible!==false,sort_order:c.order||1},profile:{category_label:c.cat||'',discount_percent:c.disc||0,accent_hue:c.hue||210,tags:c.tags||[],address:c.addr||'',featured:!!c.featured,sort_order:c.order||1,description:c.agreement_description||'',conditions:c.conditions||''},audience:audience(c.audience||{}),benefits:(c.beneficios||[]).map((b,i)=>({id:b.id||null,label:b.label||'',description:b.desc||'',enabled:b.visible!==false,sort_order:i+1,...audience(b.audience||{})}))});await load();return id;};
  store.toggleConvenio=async id=>{const c=store.getConvenio(id);if(c){try{await window.ConveniosRepository.saveCompany(id,{enabled:!c.visible});await load();}catch(e){fail(e);}}};store.removeConvenio=id=>window.AdminRepository.removeManaged('companies',id).then(load).catch(fail);store.duplicateConvenio=id=>{const c=store.getConvenio(id);if(c){c.id=null;c.name+=' (copia)';c.visible=false;c.beneficios=(c.beneficios||[]).map(b=>Object.assign({},b,{id:null}));store.saveConvenio(c);}};store.reorderConvenios=ids=>Promise.all(ids.map((id,i)=>window.ConveniosRepository.saveCompany(id,{sort_order:i+1}))).then(load).catch(fail);store.convenioBeneficios=id=>(store.getConvenio(id)||{beneficios:[]}).beneficios;store.blankBeneficio=()=>({id:null,label:'',desc:'',visible:true,order:1,audience:{mode:'all',sindicatos:[],niveles:[],generos:[],cargos:[]}});
  const projectAd=a=>({id:a.id,empresa:a.title,etiqueta:a.description||'',link:a.action_url||'#',hue:215,visible:a.enabled,order:a.sort_order,audience:{mode:'all',sindicatos:[],niveles:[],cargos:[]}});
  store.anunciosAll=()=>ads.map(projectAd);store.getAnuncio=id=>store.anunciosAll().find(x=>x.id===id);store.anunciosLive=()=>store.anunciosAll().filter(x=>x.visible);store.anuncioVisibleFor=a=>a.visible;store.blankAnuncio=()=>({id:null,empresa:'',etiqueta:'',link:'#',hue:215,visible:true,order:ads.length+1,audience:{mode:'all',sindicatos:[],niveles:[],cargos:[]}});store.saveAnuncio=a=>window.AdminRepository.saveManaged('banners',{id:a.id||undefined,placement:'convenios',title:a.empresa,description:a.etiqueta,action_url:a.link,enabled:a.visible!==false,sort_order:a.order||0}).then(load).catch(fail);store.toggleAnuncio=id=>{const a=store.getAnuncio(id);a.visible=!a.visible;store.saveAnuncio(a);};store.removeAnuncio=id=>window.AdminRepository.removeManaged('banners',id).then(load).catch(fail);store.duplicateAnuncio=id=>{const a=store.getAnuncio(id);a.id=null;a.empresa+=' (copia)';a.visible=false;store.saveAnuncio(a);};store.reorderAnuncios=ids=>window.AdminRepository.reorderManaged('banners',ids).then(load).catch(fail);
  const structural=()=>{if(window.__sutiToast)window.__sutiToast('La estructura se administra mediante versión de la aplicación');};
  store.saveNode=structural;store.toggleNode=structural;store.removeNode=structural;store.duplicateNode=structural;store.reorderContent=structural;store.resetContent=structural;
  window.AdminCutoverStore=Object.freeze({load,toCodes,toLabels,get segments(){return segments;},get failedDomains(){return failedDomains.slice();}});
  if(window.AdminRepository&&window.AdminRepository.subscribe)window.AdminRepository.subscribe(receiveContext);
})();
