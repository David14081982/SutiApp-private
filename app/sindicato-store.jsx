/* Four approved union screens. Supabase starts empty; no invented content. */
(function(){
  const repo=window.AdminCutoverRepository,listeners=new Set();let headers={},blocks=[];
  const KINDS=[{id:'texto',label:'Texto',icon:'doc',desc:'Título y párrafo editable'},{id:'imagen',label:'Imagen',icon:'image',desc:'Sube, reemplaza o elimina una imagen'},{id:'documento',label:'Documento / archivo',icon:'download',desc:'PDF, formato u otro archivo descargable'},{id:'enlace',label:'Enlace (URL)',icon:'link',desc:'Botón a web, formulario o recurso externo'}];
  const KIND=id=>KINDS.find(x=>x.id===id)||KINDS[0];
  const ids=()=>window.UNION_SCREEN_REGISTRY.filter(x=>x.admin_editor.view==='union');
  const emit=()=>listeners.forEach(fn=>fn()),fail=e=>{console.error(e);if(window.__sutiToast)window.__sutiToast('No se pudo guardar en Supabase');};
  async function load(){try{const out=await repo.listUnion();headers={};out[0].forEach(x=>headers[x.screen_key]=x);blocks=out[1];emit();}catch(e){fail(e);}}
  const labels=(t,v)=>window.AdminCutoverStore?window.AdminCutoverStore.toLabels(t,v):v||[];
  const codes=(t,v)=>window.AdminCutoverStore?window.AdminCutoverStore.toCodes(t,v):v||[];
  const aud=a=>({mode:a.audience_mode||'all',sindicatos:labels('union',a.union_codes),niveles:labels('employment_category',a.employment_category_codes),cargos:labels('tag',a.tag_codes),generos:labels('gender',a.gender_codes)});
  const assetUrl=a=>window.AssetRepository.publicUrl(a);
  const project=b=>({id:b.id,kind:{text:'texto',image:'imagen',document:'documento',link:'enlace'}[b.block_type]||'texto',titulo:b.title,texto:b.body,url:b.external_url||'',assetId:b.asset_id,imageUrl:assetUrl(b.asset),visible:b.published,order:b.sort_order,audience:aud(b)});
  const audienceMatch=(node,v)=>window.adminStore.audienceMatch(node,v);
  const ensure=id=>headers[id]||{screen_key:id,title:'',description:'',published:false,header_asset_id:null,header_asset:null};
  const store={KINDS,KIND,viewer:()=>window.adminStore.viewer(),audienceMatch,
    modules:()=>ids(),header:id=>({titulo:ensure(id).title,desc:ensure(id).description,assetId:ensure(id).header_asset_id,imageUrl:assetUrl(ensure(id).header_asset)}),
    saveHeader:async(id,p)=>{try{await repo.saveUnionScreen({screen_key:id,title:p.titulo==null?ensure(id).title:p.titulo,description:p.desc==null?ensure(id).description:p.desc,header_asset_id:p.assetId===undefined?ensure(id).header_asset_id:p.assetId,published:true});await load();return true;}catch(e){fail(e);return false;}},
    blocks:id=>blocks.filter(x=>x.screen_key===id).map(project),blocksLive:(id,v)=>store.blocks(id).filter(x=>x.visible&&audienceMatch(x,v||store.viewer())),
    getBlock:(id,bid)=>store.blocks(id).find(x=>x.id===bid),visibleCount:(id,v)=>store.blocksLive(id,v).length,blockVisibleFor:(b,v)=>b.visible&&audienceMatch(b,v||store.viewer()),
    blank:(id,kind)=>({id:null,kind:kind||'texto',titulo:'',texto:'',url:'',assetId:null,imageUrl:null,visible:true,order:store.blocks(id).length+1,audience:{mode:'all',sindicatos:[],niveles:[],cargos:[],generos:[]}}),
    saveBlock:async(id,b)=>{const a=b.audience||{};try{await repo.saveUnionBlock({id:b.id||undefined,screen_key:id,block_type:{texto:'text',imagen:'image',documento:'document',enlace:'link'}[b.kind],title:b.titulo||'',body:b.texto||'',external_url:b.url||null,asset_id:b.assetId||null,published:b.visible!==false,sort_order:b.order||0,audience_mode:a.mode||'all',union_codes:codes('union',a.sindicatos),employment_category_codes:codes('employment_category',a.niveles),gender_codes:codes('gender',a.generos),tag_codes:codes('tag',a.cargos)});await load();return true;}catch(e){fail(e);return false;}},
    toggleBlock:(id,bid)=>{const b=store.getBlock(id,bid);if(b){b.visible=!b.visible;store.saveBlock(id,b);}},removeBlock:(id,bid)=>repo.deleteUnionBlock(bid).then(load).catch(fail),
    duplicateBlock:(id,bid)=>{const b=store.getBlock(id,bid);if(b){b.id=null;b.titulo+=' (copia)';b.visible=false;b.order=store.blocks(id).length+1;store.saveBlock(id,b);}},
    reorder:(id,ordered)=>Promise.all(ordered.map((bid,i)=>{const b=store.getBlock(id,bid);b.order=i+1;return store.saveBlock(id,b);})).then(load).catch(fail),
    resetModule:id=>Promise.all(store.blocks(id).map(b=>repo.deleteUnionBlock(b.id))).then(()=>repo.saveUnionScreen({screen_key:id,title:'',description:'',header_asset_id:null,published:false})).then(load).catch(fail),resetAll:()=>Promise.all(ids().map(x=>store.resetModule(x.screen_key))),
    subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},can:(a,r)=>window.adminStore.can(a,r)};
  window.SIND_KINDS=KINDS;window.sindicatoStore=store;window.useSindicatoStore=function(){const[,f]=React.useState(0);React.useEffect(()=>store.subscribe(()=>f(n=>n+1)),[]);return store;};setTimeout(load,0);
})();
