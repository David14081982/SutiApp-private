/* Phase 4 membership state. Supabase remains the sole authority. */
(function(){
  const{useState,useEffect}=React;const listeners=new Set();let items=[],phase='idle',error=null,promise=null;const emit=()=>listeners.forEach((fn)=>fn());
  async function load(force){if(promise&&!force)return promise;phase='loading';emit();promise=(async()=>{try{items=(await window.MembershipRepository.list()).slice();phase='loaded';error=null;}catch(e){items=[];phase='error';error=e;}emit();return store;})();return promise;}
  const store={
    state:()=>({phase,error}),load,retry:()=>load(true),all:()=>items.slice(),active:()=>items.filter((m)=>m.activo),get:(id)=>items.find((m)=>m.id===id)||null,
    blank:()=>({empresa:'',concepto:'',logo:'',logo_asset_id:null,monto:0,pagos:2,activo:true,sort_order:items.length+1,_new:true}),
    save:async(m)=>{await window.MembershipRepository.save(m);await load(true);},
    toggle:async(id)=>{const m=items.find((x)=>x.id===id);if(!m)throw new Error('MEMBERSHIP_NOT_FOUND');await window.MembershipRepository.save(Object.assign({},m,{activo:!m.activo}));await load(true);},
    remove:async(id)=>{await window.MembershipRepository.remove(id);await load(true);},
    uploadLogo:(file)=>window.MembershipRepository.uploadLogo(file),resetAll:()=>Promise.reject(new Error('NO_PRODUCTIVE_MEMBERSHIP_RESET')),
    subscribe:(fn)=>{listeners.add(fn);return()=>listeners.delete(fn)}
  };
  window.membershipStore=store;window.useMembershipStore=function(){const[,force]=useState(0);useEffect(()=>store.subscribe(()=>force((n)=>n+1)),[]);useEffect(()=>{if(store.state().phase==='idle')store.load(false);},[]);return store;};
})();
