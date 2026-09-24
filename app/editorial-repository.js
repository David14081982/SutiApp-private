/* Editorial authority: Supabase RPCs. Memory only, cleared at every identity change. */
(function(){
 'use strict';
 const listeners=new Set(),states=new Map(),pending=new Map();let epoch=0,catalog=null;
 const key=(screen,admin)=>screen+':'+(admin?'admin':'live');
 const emit=()=>listeners.forEach(fn=>fn());
 async function rpc(name,args){const out=await window.SutiSupabase.getClient().rpc(name,args);if(out.error)throw out.error;return out.data;}
 const snapshot=(screen,admin)=>states.get(key(screen,admin))||{phase:'idle',nodes:[],version:null,editableTypes:[]};
 async function load(screen,admin=false,force=false){
  const k=key(screen,admin);if(pending.has(k))return pending.get(k);
  if(!force&&snapshot(screen,admin).phase==='ready')return snapshot(screen,admin);
  const e=epoch;states.set(k,{...snapshot(screen,admin),phase:'loading',error:null});emit();
  const request=(async()=>{
   try{const data=await rpc('get_app_editorial',{p_screen:screen,p_admin:admin});if(e!==epoch)return;const next={...data,phase:'ready',error:null};states.set(k,next);emit();return next;}
   catch(error){if(e===epoch){states.set(k,{phase:'error',nodes:[],version:null,editableTypes:[],error});emit();}throw error;}
   finally{if(e===epoch)pending.delete(k);}
  })();pending.set(k,request);return request;
 }
 async function save(screen,version,nodes){
  const e=epoch;const data=await rpc('save_app_editorial',{p_screen:screen,p_expected_version:version,p_nodes:nodes});
  if(e!==epoch)throw new Error('EDITORIAL_IDENTITY_CHANGED');
  states.set(key(screen,true),{...data,phase:'ready',error:null});states.delete(key(screen,false));emit();return data;
 }
 function clear(){epoch++;states.clear();pending.clear();catalog=null;emit();}
 let identity='';
 function refreshIdentity(){
  const auth=window.AffiliateAuth&&window.AffiliateAuth.getState()||{},admin=window.AdminRepository&&window.AdminRepository.getState()||{};
  const next=JSON.stringify([auth.session&&auth.session.user&&auth.session.user.id,auth.impersonation&&auth.impersonation.id,admin.subjectKey,admin.assignment]);
  if(next!==identity){identity=next;clear();}
 }
 // AffiliateAuth is defined later in the same bundle. Subscribe after bundle setup.
 queueMicrotask(()=>{if(window.AffiliateAuth&&window.AffiliateAuth.subscribe)window.AffiliateAuth.subscribe(refreshIdentity);});
 if(window.AdminRepository&&window.AdminRepository.subscribe)window.AdminRepository.subscribe(refreshIdentity);
 window.addEventListener('focus',()=>{for(const [k,s] of states)if(s.phase==='ready')states.set(k,{...s,phase:'idle'});emit();});
 window.EditorialRepository=Object.freeze({snapshot,load,save,clear,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  async catalog(){if(!catalog)catalog=await rpc('list_app_editorial_screens',{});return catalog;},
  segments:()=>rpc('list_app_editorial_segments',{}),
  submit:(screen,version,nodeId,answers,id)=>rpc('submit_app_editorial_form',{p_id:id,p_screen:screen,p_version:version,p_node_id:nodeId,p_answers:answers}),
  async responses(screen,nodeId){const out=await window.SutiSupabase.getClient().from('app_editorial_submissions').select('id,screen_id,version,node_id,answers,created_at').eq('screen_id',screen).eq('node_id',nodeId).order('created_at',{ascending:false}).limit(100);if(out.error)throw out.error;return out.data;}
 });
})();
