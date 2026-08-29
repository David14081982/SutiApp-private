/* Supabase-backed adapters for the approved Admin cutover. No localStorage,
   DATA or mock is authoritative for these domains. */
(function(){
  'use strict';
  const repo=window.AdminCutoverRepository, store=window.adminStore;
  if(!repo||!store) throw new Error('ADMIN_CUTOVER_DEPENDENCY_MISSING');
  let roles=[],segments=[],access={},companies=[],companyProfiles=[],companyRules=[],ads=[],acting=null,loading=false;
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
    if(id==='fondos')return'financial_criteria.visibility';
    if(id==='secciones'||id==='menus'||id==='formularios'||id.indexOf('scr_')===0)return'content';
    return'content';
  };
  function uiPerms(permissionList){
    const out={}; (window.ADMIN.ALL_RESOURCE_IDS||[]).forEach(id=>{
      const base=resourcePermission(id),extra=id==='convenios'?'segmentation':null,read=permissionList.includes(base+'.read')&&(!extra||permissionList.includes(extra+'.read')),write=permissionList.includes(base+'.write')&&(!extra||permissionList.includes(extra+'.write'));
      out[id]={ver:read||write,crear:write,editar:write,eliminar:write,reordenar:write};
    }); return out;
  }
  function projectRole(r){const p=(r.admin_role_permissions||[]).map(x=>x.permission);return{id:r.id,name:r.name,desc:r.description,system:r.system_role,all:false,perms:uiPerms(p),_permissions:p};}
  // Cada dominio se resuelve por separado: un fallo aislado no puede dejar el
  // panel completo en blanco (regresión real: un embed inválido vaciaba roles,
  // catálogos, convenios y acceso a pantallas a la vez).
  let failedDomains=[];
  async function load(){
    if(loading)return;loading=true;
    const jobs=[
      ['roles',()=>repo.listRoles()],
      ['segments',()=>repo.listSegments()],
      ['access',()=>repo.listScreenAccess()],
      ['companies',()=>window.AdminRepository.listManaged('companies')],
      ['profiles',()=>repo.listCompanyProfiles()],
      ['rules',()=>repo.listCompanyRules()],
      ['banners',()=>window.AdminRepository.listManaged('banners')]];
    try{
      const settled=await Promise.allSettled(jobs.map(j=>j[1]()));
      const failed=[];
      settled.forEach((r,i)=>{
        const key=jobs[i][0];
        if(r.status!=='fulfilled'){failed.push(key);console.error('Admin cutover authority error ['+key+']',r.reason);return;}
        const v=r.value;
        if(key==='roles')roles=v.map(projectRole);
        else if(key==='segments')segments=v;
        else if(key==='access'){access={};v.forEach(x=>access[x.screen_id]=x);}
        else if(key==='companies')companies=v;
        else if(key==='profiles')companyProfiles=v;
        else if(key==='rules')companyRules=v;
        else if(key==='banners')ads=v.filter(x=>x.placement==='marketplace'||x.placement==='convenios');
      });
      failedDomains=failed;
      if(failed.length&&window.__sutiToast)window.__sutiToast('No se pudo cargar: '+failed.join(', '));
      if(!acting||!roles.some(r=>r.id===acting))acting=(roles[0]||{}).id||null;
      emit();
    }finally{loading=false;}
  }
  const originalSubscribe=store.subscribe.bind(store);
  store.subscribe=(fn)=>{listeners.add(fn);const off=originalSubscribe(fn);return()=>{listeners.delete(fn);off();};};
  store.roles=()=>roles;
  store.getRole=id=>roles.find(r=>r.id===id);
  store.actingRoleId=()=>acting;
  store.actingRole=()=>roles.find(r=>r.id===acting)||roles[0]||{name:'Sin rol',perms:{}};
  store.setActingRole=id=>{acting=id;emit();};
  store.blankRole=()=>({id:null,name:'',desc:'',system:false,perms:uiPerms([])});
  store.roleActionCount=r=>Object.values(r.perms||{}).reduce((n,p)=>n+Object.values(p).filter(Boolean).length,0);
  store.can=(action,resource)=>{const r=store.actingRole(),p=r.perms&&r.perms[resource];return!!(p&&p[action]);};
  function technicalPermissions(role){const out=new Set();Object.keys(role.perms||{}).forEach(id=>{const p=role.perms[id],bases=[resourcePermission(id)].concat(id==='convenios'?['segmentation']:[]);bases.forEach(base=>{if(p.ver)out.add(base+'.read');if(p.crear||p.editar||p.eliminar||p.reordenar){out.add(base+'.read');out.add(base+'.write');}});});return Array.from(out);}
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
  function convenio(c){const p=companyProfiles.find(x=>x.company_id===c.id)||{};return{id:c.id,name:c.display_name,cat:p.category_label||'',disc:p.discount_percent||0,hue:p.accent_hue||210,tags:p.tags||[],addr:p.address||'',fav:!!p.favorite,featured:!!p.featured,slotId:'company_'+c.id,visible:c.enabled,order:p.sort_order||c.sort_order||0,audience:companyAudience(c.id),beneficios:(p.company_benefits||[]).map(benefit)};}
  store.conveniosAll=()=>companies.map(convenio).sort((a,b)=>a.order-b.order);store.getConvenio=id=>store.conveniosAll().find(x=>x.id===id);store.conveniosLive=v=>store.conveniosAll().filter(x=>x.visible&&store.audienceMatch(x,v||store.viewer()));store.convenioVisibleFor=(c,v)=>c.visible&&store.audienceMatch(c,v||store.viewer());
  store.blankConvenio=()=>({id:null,name:'',cat:'',disc:0,hue:210,tags:[],addr:'',fav:false,featured:false,visible:true,order:store.conveniosAll().length+1,audience:{mode:'all',sindicatos:[],niveles:[],generos:[],cargos:[]},beneficios:[]});
  store.saveConvenio=async c=>{try{if(!c.id&&!window.AdminRepository.has('companies.create'))throw new Error('COMPANY_CREATE_DENIED');const saved=c.id&&!window.AdminRepository.has('companies.update')?{id:c.id}:await window.AdminRepository.saveManaged('companies',{id:c.id||undefined,display_name:c.name,description:c.addr||'',enabled:c.visible!==false,sort_order:c.order||0});const id=c.id||saved.id,a=c.audience||{},old=companyProfiles.find(x=>x.company_id===id),kept=new Set((c.beneficios||[]).map(b=>b.id).filter(Boolean));await Promise.all([repo.saveCompanyProfile({company_id:id,category_label:c.cat||'',discount_percent:c.disc||0,accent_hue:c.hue||210,tags:c.tags||[],address:c.addr||'',favorite:!!c.fav,featured:!!c.featured,sort_order:c.order||0}),repo.saveCompanyRule({company_id:id,audience_mode:a.mode||'all',union_codes:toCodes('union',a.sindicatos),employment_category_codes:toCodes('employment_category',a.niveles),gender_codes:toCodes('gender',a.generos),tag_codes:toCodes('tag',a.cargos)}),...((old&&old.company_benefits)||[]).filter(b=>!kept.has(b.id)).map(b=>repo.deleteCompanyBenefit(b.id))]);for(const b of c.beneficios||[]){const ba=b.audience||{};await repo.saveCompanyBenefit({id:b.id||undefined,company_id:id,label:b.label||'',description:b.desc||'',enabled:b.visible!==false,sort_order:b.order||0,audience_mode:ba.mode||'all',union_codes:toCodes('union',ba.sindicatos),employment_category_codes:toCodes('employment_category',ba.niveles),gender_codes:toCodes('gender',ba.generos),tag_codes:toCodes('tag',ba.cargos)});}await load();}catch(e){fail(e);}};
  store.toggleConvenio=id=>{const c=store.getConvenio(id);if(c){c.visible=!c.visible;store.saveConvenio(c);}};store.removeConvenio=id=>window.AdminRepository.removeManaged('companies',id).then(load).catch(fail);store.duplicateConvenio=id=>{const c=store.getConvenio(id);if(c){c.id=null;c.name+=' (copia)';c.visible=false;c.beneficios=(c.beneficios||[]).map(b=>Object.assign({},b,{id:null}));store.saveConvenio(c);}};store.reorderConvenios=ids=>Promise.all(ids.map((id,i)=>{const c=store.getConvenio(id);c.order=i+1;return store.saveConvenio(c);})).then(load).catch(fail);store.convenioBeneficios=id=>(store.getConvenio(id)||{beneficios:[]}).beneficios;store.blankBeneficio=()=>({id:null,label:'',desc:'',visible:true,order:1,audience:{mode:'all',sindicatos:[],niveles:[],generos:[],cargos:[]}});
  const projectAd=a=>({id:a.id,empresa:a.title,etiqueta:a.description||'',link:a.action_url||'#',hue:215,visible:a.enabled,order:a.sort_order,audience:{mode:'all',sindicatos:[],niveles:[],cargos:[]}});
  store.anunciosAll=()=>ads.map(projectAd);store.getAnuncio=id=>store.anunciosAll().find(x=>x.id===id);store.anunciosLive=()=>store.anunciosAll().filter(x=>x.visible);store.anuncioVisibleFor=a=>a.visible;store.blankAnuncio=()=>({id:null,empresa:'',etiqueta:'',link:'#',hue:215,visible:true,order:ads.length+1,audience:{mode:'all',sindicatos:[],niveles:[],cargos:[]}});store.saveAnuncio=a=>window.AdminRepository.saveManaged('banners',{id:a.id||undefined,placement:'convenios',title:a.empresa,description:a.etiqueta,action_url:a.link,enabled:a.visible!==false,sort_order:a.order||0}).then(load).catch(fail);store.toggleAnuncio=id=>{const a=store.getAnuncio(id);a.visible=!a.visible;store.saveAnuncio(a);};store.removeAnuncio=id=>window.AdminRepository.removeManaged('banners',id).then(load).catch(fail);store.duplicateAnuncio=id=>{const a=store.getAnuncio(id);a.id=null;a.empresa+=' (copia)';a.visible=false;store.saveAnuncio(a);};store.reorderAnuncios=ids=>window.AdminRepository.reorderManaged('banners',ids).then(load).catch(fail);
  const structural=()=>{if(window.__sutiToast)window.__sutiToast('La estructura se administra mediante versión de la aplicación');};
  store.saveNode=structural;store.toggleNode=structural;store.removeNode=structural;store.duplicateNode=structural;store.reorderContent=structural;store.resetContent=structural;
  window.AdminCutoverStore=Object.freeze({load,toCodes,toLabels,get segments(){return segments;},get failedDomains(){return failedDomains.slice();}});
  if(window.AdminRepository&&window.AdminRepository.subscribe)window.AdminRepository.subscribe(s=>{if(s.phase==='authorized')load();});
})();
