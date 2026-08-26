/* Supabase-backed managed copy projection. Structural UI text remains code-owned. */
(function () {
  'use strict';
  const listeners=new Set();
  let rows=[];let phase='loading';let live=false;let promise=null;
  const emit=()=>listeners.forEach((fn)=>fn());
  const keyOf=(scope,from)=>String(scope)+'\u0000'+String(from);
  const project=(row)=>({key:keyOf(row.scope,row.source_text),scope:row.scope,from:row.source_text,to:row.replacement_text,enabled:row.enabled!==false,by:'Supabase Admin'});
  async function load(){phase='loading';emit();try{rows=(await window.ManagedCopyRepository.list()).map(project);phase='loaded';}catch(_){rows=[];phase='error';}emit();return rows;}
  function bootstrap(){if(!promise)promise=load();return promise;}
  function retry(){promise=null;return bootstrap();}
  const store={
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},bootstrap,retry,phase:()=>phase,
    overrides:()=>rows.slice(),count:()=>rows.length,
    lookupFrom:(scope,from)=>rows.find((o)=>o.enabled&&o.scope===scope&&o.from===from)||null,
    lookupTo:(scope,to)=>rows.find((o)=>o.enabled&&o.scope===scope&&o.to===to)||null,
    set(scope,from,to){
      if(!store.canEdit())return;const next={key:keyOf(scope,from),scope,from,to,enabled:true,by:'Supabase Admin'};
      rows=rows.filter((o)=>o.key!==next.key).concat(next);emit();
      window.AdminRepository.saveCopy(scope,from,to).then(retry).catch(retry);
    },
    clear(key){if(!store.canEdit())return;const row=rows.find((o)=>o.key===key);if(!row)return;rows=rows.filter((o)=>o.key!==key);emit();window.AdminRepository.removeCopy(row.scope,row.from).then(retry).catch(retry);},
    resetAll(){if(!store.canEdit())return;rows.slice().forEach((row)=>store.clear(row.key));},
    canEdit:()=>!!(window.AdminRepository&&window.AdminRepository.has('content.write')),
    live:()=>live&&store.canEdit(),setLive(value){live=!!value&&store.canEdit();emit();},
    meName:()=>window.AdminRepository&&window.AdminRepository.getState().assignment?window.AdminRepository.getState().assignment.role:'Administrador',
    editors:()=>[],getEditor:()=>null,toggleEditor:()=>{},removeEditor:()=>{},me:()=>null,setMe:()=>{},
  };
  window.copyStore=store;
  Promise.resolve().then(bootstrap);
})();
