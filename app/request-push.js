/* Device transport only. Requests and identity remain authoritative in Supabase. */
(function () {
  'use strict';
  const h=React.createElement;let serial=Promise.resolve();
  function device(op) {return new Promise((resolve,reject)=>{
    const open=indexedDB.open('sutiapp-request-push-v1',1);
    open.onupgradeneeded=()=>{open.result.createObjectStore('device');open.result.createObjectStore('events');};open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('device','readwrite');let value;const r=op(tx.objectStore('device'));if(r)r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{db.close();reject(tx.error);};};
  });}
  function identity(){const s=window.AffiliateAuth.getState();return s.phase==='authenticated'&&s.session&&s.affiliate&&!s.affiliate._impersonation&&!s.impersonation&&s.affiliate.auth_user_id===s.session.user.id?s.session.user.id:null;}
  const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  async function rpc(name,args){const {data,error}=await window.SutiSupabase.getClient().rpc(name,args);if(error)throw error;return data;}
  async function registration(){let timer;try{return await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PUSH_WORKER_TIMEOUT')),20000);})]);}finally{clearTimeout(timer);}}
  async function clearDevice(revoke=true){
    if(!supported())return;
    const binding=await device(s=>s.get('binding'));await device(s=>s.delete('binding'));
    const reg=await navigator.serviceWorker.getRegistration();let failure;
    if(reg)(await reg.getNotifications()).filter(n=>n.tag.startsWith('request-event-')).forEach(n=>n.close());
    if(binding&&revoke){try{await rpc('revoke_self_request_push',{p_subscription_id:binding.subscription_id});}catch(e){failure=e;}}
    if(reg){const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
    if(failure)throw failure;
  }
  function syncIdentity(){if(!supported())return;serial=serial.catch(()=>{}).then(async()=>{
    const phase=window.AffiliateAuth.getState().phase;if(!['authenticated','unauthenticated','signing_out','error'].includes(phase))return;
    const binding=await device(s=>s.get('binding'));if(binding&&binding.user_id!==identity())await clearDevice(false);
  });serial.catch(()=>{});}
  async function state(){
    if(!supported())return {phase:'unsupported'};if(!identity())return {phase:'unavailable'};
    await serial;const config=await rpc('get_self_request_push_config');if(!config.enabled||!config.public_key)return {phase:'unavailable'};
    const reg=await registration(),sub=await reg.pushManager.getSubscription(),binding=await device(s=>s.get('binding'));
    const active=sub&&binding&&binding.user_id===identity()&&Notification.permission==='granted'&&await rpc('get_self_request_push_status',{p_subscription_id:binding.subscription_id});
    return {phase:active?'active':Notification.permission==='denied'?'denied':'ready',config};
  }
  // Permission is requested synchronously within the user's click (including Safari).
  function enable(config){
    const owner=identity();if(!owner||!config||!config.public_key)return Promise.reject(Error('PUSH_UNAVAILABLE'));
    const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
    return permission.then(async granted=>{
      if(granted!=='granted')return {phase:'denied',config};await serial;if(identity()!==owner)throw Error('PUSH_CONTEXT_CHANGED');
      const reg=await registration();let sub=await reg.pushManager.getSubscription();const binding=await device(s=>s.get('binding'));
      if(sub&&(!binding||binding.user_id!==owner||!await rpc('get_self_request_push_status',{p_subscription_id:binding.subscription_id}))){await sub.unsubscribe();sub=null;}
      const b64=config.public_key.replace(/-/g,'+').replace(/_/g,'/');
      if(!sub){
        let expired=false,timer;
        const pending=reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0))});
        pending.then(value=>{if(expired)value.unsubscribe().catch(()=>{});}).catch(()=>{});
        try{sub=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('PUSH_SUBSCRIPTION_TIMEOUT'));},20000);})]);}
        finally{clearTimeout(timer);}
      }
      try{
        const json=sub.toJSON(),id=await rpc('register_self_request_push',{p_endpoint:json.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth,p_expiration_at:json.expirationTime?new Date(json.expirationTime).toISOString():null});
        if(identity()!==owner){await sub.unsubscribe();throw Error('PUSH_CONTEXT_CHANGED');}
        await device(s=>s.put({user_id:owner,subscription_id:id},'binding'));
        if(identity()!==owner){await clearDevice(false);throw Error('PUSH_CONTEXT_CHANGED');}
        return {phase:'active',config};
      }catch(e){await sub.unsubscribe();throw e;}
    });
  }
  function RequestPushInvitation(){
    const [current,setCurrent]=React.useState({phase:'loading'}),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
    const refresh=()=>state().then(setCurrent).catch(()=>setCurrent({phase:'error'}));
    React.useEffect(()=>{let active=true;const load=()=>state().then(s=>{if(active)setCurrent(s);}).catch(()=>{if(active)setCurrent({phase:'error'});});load();const unbind=window.AffiliateAuth.subscribe(load);window.addEventListener('focus',load);if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('controllerchange',load);return()=>{active=false;unbind();window.removeEventListener('focus',load);if(navigator.serviceWorker)navigator.serviceWorker.removeEventListener('controllerchange',load);};},[]);
    if(['loading','unavailable'].includes(current.phase))return null;
    const run=task=>{setBusy(true);setError('');task.then(setCurrent).catch(()=>setError('No pudimos actualizar las notificaciones. Intenta de nuevo.')).finally(()=>setBusy(false));};
    const style={minHeight:44,border:0,borderRadius:12,padding:'10px 15px',background:'var(--guinda)',color:'#fff',fontWeight:800,cursor:'pointer'};
    return h('section',{'data-request-push':current.phase,style:{background:'var(--surface)',borderRadius:16,padding:16,marginBottom:14,boxShadow:'var(--neo-sm)'}},
      h('strong',null,current.phase==='active'?'Notificaciones activas en este dispositivo':'Avisos de tus solicitudes'),
      h('p',{style:{fontSize:13,color:'var(--ink-2)',lineHeight:1.5}},current.phase==='active'?'Recibirás avisos cuando tus solicitudes avancen.':current.phase==='unsupported'?'En iPhone, agrega SutiApp a la pantalla de inicio y ábrela desde ahí para activar los avisos. En otros dispositivos, usa un navegador compatible.':current.phase==='denied'?'Puedes permitir las notificaciones desde los ajustes de tu navegador. Tus solicitudes siguen disponibles en SutiApp.':'Recibe un aviso cuando tu solicitud sea autorizada, rechazada, cancelada o cambie de etapa.'),
      current.phase==='ready'&&h('button',{type:'button',disabled:busy,style,onClick:()=>run(enable(current.config))},busy?'Activando…':'Activar notificaciones'),
      current.phase==='active'&&h('button',{type:'button',disabled:busy,style,onClick:()=>run(clearDevice().then(state))},busy?'Desactivando…':'Desactivar en este dispositivo'),
      current.phase==='error'&&h('p',{role:'status'},'No pudimos consultar la configuración de avisos.'),current.phase==='error'&&h('button',{type:'button',style,onClick:refresh},'Reintentar'),error&&h('p',{role:'alert'},error));
  }
  window.AffiliateAuth.subscribe(syncIdentity);syncIdentity();
  window.RequestPush={state,enable,clearDevice,syncIdentity};window.RequestPushInvitation=RequestPushInvitation;
})();
