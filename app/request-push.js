/* Device transport only. Requests and identity remain authoritative in Supabase. */
(function () {
  'use strict';
  const h=React.createElement;let serial=Promise.resolve();
  const queue=task=>{const next=serial.catch(()=>{}).then(task);serial=next;return next;};
  const changed=()=>window.dispatchEvent(new Event('suti:request-push-changed'));
  function device(op) {return new Promise((resolve,reject)=>{
    const open=indexedDB.open('sutiapp-request-push-v1',1);
    open.onupgradeneeded=()=>{open.result.createObjectStore('device');open.result.createObjectStore('events');};open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('device','readwrite');let value;const r=op(tx.objectStore('device'));if(r)r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{db.close();reject(tx.error);};};
  });}
  function identity(){const s=window.AffiliateAuth.getState();return s.phase==='authenticated'&&s.session&&s.affiliate&&!s.affiliate._impersonation&&!s.impersonation&&s.affiliate.auth_user_id===s.session.user.id?s.session.user.id:null;}
  // Cleanup guard only: a same-user revalidation failure is not a logout.
  // Never use this to authorize an RPC or report notifications as active.
  function retainsOwner(owner){
    if(identity()===owner)return true;
    const s=window.AffiliateAuth.getState();
    return ['loading','error'].includes(s.phase)&&s.session&&s.session.user.id===owner&&!s.impersonation&&(!s.affiliate||(!s.affiliate._impersonation&&s.affiliate.auth_user_id===owner));
  }
  const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  async function rpc(name,args){
    const controller=new AbortController(),query=window.SutiSupabase.getClient().rpc(name,args);let timer;
    try{const {data,error}=await Promise.race([typeof query.abortSignal==='function'?query.abortSignal(controller.signal):query,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('PUSH_NETWORK_TIMEOUT'));},20000);})]);if(error)throw error;return data;}finally{clearTimeout(timer);}
  }
  async function registration(){let timer;try{return await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PUSH_WORKER_TIMEOUT')),20000);})]);}finally{clearTimeout(timer);}}
  async function clearDeviceInternal(revoke=true){
    if(!supported())return;
    const binding=await device(s=>s.get('binding'));await device(s=>s.delete('binding'));
    const reg=await navigator.serviceWorker.getRegistration();let failure;
    if(reg)(await reg.getNotifications()).filter(n=>n.tag.startsWith('request-event-')).forEach(n=>n.close());
    if(binding&&revoke){try{await rpc('revoke_self_request_push',{p_subscription_id:binding.subscription_id});}catch(e){failure=e;}}
    if(reg){const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
    if(failure)throw failure;
  }
  function clearDevice(revoke=true){return queue(()=>clearDeviceInternal(revoke)).finally(changed);}
  function syncIdentity(){if(!supported())return;
    // Capture the delivered context: loading/network errors are not a logout.
    const context=window.AffiliateAuth.getState(),owner=identity();
    if(!['authenticated','unauthenticated','signing_out','archived','unlinked','identity_error','ineligible'].includes(context.phase))return;
    queue(async()=>{const binding=await device(s=>s.get('binding'));if(binding&&binding.user_id!==owner)await clearDeviceInternal(false);}).catch(()=>{});
  }
  function unavailableState(){const phase=window.AffiliateAuth.getState().phase;return {phase:phase==='error'?'error':phase==='loading'?'loading':'unavailable',reason:'AUTH_TRANSITION'};}
  async function fingerprint(sub){const json=sub.toJSON(),bytes=new TextEncoder().encode(JSON.stringify([json.endpoint,json.keys,json.expirationTime||null]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
  async function subscribe(reg,config){
    const b64=config.public_key.replace(/-/g,'+').replace(/_/g,'/');let expired=false,timer;
    const pending=reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(b64+'='.repeat((4-b64.length%4)%4)),c=>c.charCodeAt(0))});
    pending.then(value=>{if(expired)value.unsubscribe().catch(()=>{});}).catch(()=>{});
    try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('PUSH_SUBSCRIPTION_TIMEOUT'));},20000);})]);}finally{clearTimeout(timer);}
  }
  async function bind(sub,owner){
    if(identity()!==owner)throw Error('PUSH_CONTEXT_CHANGED');
    const json=sub.toJSON(),transport=await fingerprint(sub);
    if(identity()!==owner)throw Error('PUSH_CONTEXT_CHANGED');
    const id=await rpc('register_self_request_push',{p_endpoint:json.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth,p_expiration_at:json.expirationTime?new Date(json.expirationTime).toISOString():null});
    if(identity()!==owner&&!retainsOwner(owner)){await sub.unsubscribe();throw Error('PUSH_CONTEXT_CHANGED');}
    await device(s=>s.put({user_id:owner,subscription_id:id,transport},'binding'));
    if(identity()!==owner){if(!retainsOwner(owner))await clearDeviceInternal(false);throw Error('PUSH_CONTEXT_CHANGED');}
  }
  async function readState(){
    const owner=identity();if(!owner)return unavailableState();
    if(!supported())return {phase:'unsupported',owner,reason:'DEVICE_UNSUPPORTED'};
    const prompt=await device(s=>s.get('prompt:'+owner));
    const config=await rpc('get_self_request_push_config');if(!config.enabled||!config.public_key)return {phase:'unavailable'};
    if(identity()!==owner)return unavailableState();
    // Explicit opt-out wins even if a previous teardown could not finish.
    if(prompt&&prompt.disabled&&Notification.permission!=='denied')return {phase:'disabled',config,owner,prompt,reason:'USER_DISABLED'};
    const reg=await registration();let sub=await reg.pushManager.getSubscription();const binding=await device(s=>s.get('binding'));
    let phase=Notification.permission==='denied'?'denied':Notification.permission==='granted'?'repair':'ready';
    let reason=phase==='repair'?(!binding?'LOCAL_BINDING_MISSING':binding.user_id!==owner?'BINDING_OWNER_MISMATCH':'REMOTE_SUBSCRIPTION_INACTIVE'):null;
    if(Notification.permission==='granted'&&binding&&binding.user_id===owner&&await rpc('get_self_request_push_status',{p_subscription_id:binding.subscription_id})){
      if(identity()!==owner)return unavailableState();
      // A valid server binding plus native permission proves prior opt-in. A false
      // status can mean explicit revocation: never silently register it again.
      if(!sub)sub=await subscribe(reg,config);
      if(!binding.transport||binding.transport!==await fingerprint(sub))await bind(sub,owner);
      phase='active';reason=null;
    }
    if(identity()!==owner)return unavailableState();
    return {phase,config,owner,prompt,reason};
  }
  function state(){return queue(async()=>{try{return await readState();}catch(e){const owner=identity();if(!owner)return unavailableState();return {phase:'error',owner,reason:'CHECK_FAILED',prompt:await device(s=>s.get('prompt:'+owner)).catch(()=>null)};}});}
  // Permission is requested synchronously within the user's click (including Safari).
  function enable(config){
    const owner=identity();if(!owner||!config||!config.public_key)return Promise.reject(Error('PUSH_UNAVAILABLE'));
    const permission=Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
    return permission.then(granted=>queue(async()=>{
      if(identity()!==owner)throw Error('PUSH_CONTEXT_CHANGED');
      if(granted!=='granted')return {phase:granted==='denied'?'denied':'ready',config,owner};
      const reg=await registration();let sub=await reg.pushManager.getSubscription();const binding=await device(s=>s.get('binding'));
      if(sub&&(!binding||binding.user_id!==owner||!await rpc('get_self_request_push_status',{p_subscription_id:binding.subscription_id}))){await sub.unsubscribe();sub=null;}
      if(!sub)sub=await subscribe(reg,config);
      // A network error leaves this same-owner transport retryable. Only an
      // identity transition requires immediate privacy teardown.
      try{await bind(sub,owner);await device(s=>s.delete('prompt:'+owner));return {phase:'active',config,owner};}
      catch(e){if(!retainsOwner(owner))await sub.unsubscribe();throw e;}
    })).finally(changed);
  }
  function disable(){const owner=identity();return queue(async()=>{
    if(!owner||identity()!==owner)throw Error('PUSH_CONTEXT_CHANGED');
    await device(s=>s.put({disabled:true},'prompt:'+owner));await clearDeviceInternal();return readState();
  }).finally(changed);}
  function usePushState(){
    const [current,setCurrent]=React.useState({phase:'loading'});
    const revision=React.useRef(0),mounted=React.useRef(false);
    const refresh=()=>{const request=++revision.current;return state().then(s=>{if(request===revision.current)setCurrent(s);}).catch(()=>{if(request===revision.current)setCurrent({phase:'error',owner:identity()});});};
    React.useEffect(()=>{
      mounted.current=true;refresh();const unbind=window.AffiliateAuth.subscribe(refresh),resume=()=>{if(document.visibilityState==='visible')refresh();},message=e=>{if(e.data&&e.data.type==='SUTIAPP_PUSH_CHANGED')refresh();};
      const events=['focus','online','pageshow','suti:request-push-changed'];events.forEach(name=>window.addEventListener(name,refresh));document.addEventListener('visibilitychange',resume);
      if(navigator.serviceWorker){navigator.serviceWorker.addEventListener('controllerchange',refresh);navigator.serviceWorker.addEventListener('message',message);}
      return()=>{mounted.current=false;revision.current++;unbind();events.forEach(name=>window.removeEventListener(name,refresh));document.removeEventListener('visibilitychange',resume);if(navigator.serviceWorker){navigator.serviceWorker.removeEventListener('controllerchange',refresh);navigator.serviceWorker.removeEventListener('message',message);}};
    },[]);
    return {current,setCurrent,refresh,revision,mounted};
  }
  // Preserve foreground reconciliation without rendering an invitation in Home.
  function RequestPushLifecycle(){usePushState();return null;}
  function RequestPushInvitation({startup=false,visible=true,farma=false}={}){
    const {current,setCurrent,refresh,revision,mounted}=usePushState();
    const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[dismissed,setDismissed]=React.useState(null),[help,setHelp]=React.useState(false);
    if(['loading','unavailable'].includes(current.phase))return null;
    if(startup&&(!visible||!current.owner||current.owner!==identity()||current.phase==='active'||current.phase==='unsupported'||dismissed===current.owner||(current.prompt&&(current.prompt.disabled||current.prompt.until>Date.now()))))return null;
    const run=task=>{const request=++revision.current;setBusy(true);setError('');task.then(s=>{if(!mounted.current)return;if(request===revision.current)setCurrent(s);else refresh();}).catch(()=>{if(mounted.current)setError('No pudimos actualizar las notificaciones. Intenta de nuevo.');}).finally(()=>{if(mounted.current)setBusy(false);});};
    const postpone=()=>{const owner=current.owner;setDismissed(owner);device(s=>s.put({until:Date.now()+86400000},'prompt:'+owner)).catch(()=>{});};
    const style={minHeight:44,border:0,borderRadius:12,padding:'10px 15px',background:'var(--guinda)',color:'#fff',fontWeight:800,cursor:'pointer'};
    const permissionHelp=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
      ?'En iPhone o iPad, abre Ajustes → Notificaciones → SutiApp y permite los avisos. Abre SutiApp desde su icono en la pantalla de inicio y vuelve aquí para comprobar el permiso.'
      :/Android/.test(navigator.userAgent)?'En Android, abre Ajustes → Aplicaciones → SutiApp → Notificaciones y permite los avisos. Si SutiApp no aparece, revisa Chrome → Configuración → Configuración de sitios → Notificaciones y permite el sitio de SutiApp. Vuelve a la app para comprobar el permiso.'
      :'Abre los permisos de este sitio en tu navegador y permite las notificaciones. Comprueba también los ajustes de notificaciones del sistema y vuelve a SutiApp.';
    const repairMessage=current.reason==='LOCAL_BINDING_MISSING'?'El permiso está concedido, pero falta vincular este dispositivo a tu cuenta.':current.reason==='BINDING_OWNER_MISMATCH'?'La vinculación de este dispositivo no corresponde a tu sesión.':'El registro de notificaciones de este dispositivo ya no está vigente.';
    const content=h(React.Fragment,null,
      h('strong',null,current.phase==='active'?'Notificaciones activas en este dispositivo':current.phase==='repair'?'Restablece tus notificaciones':current.phase==='denied'?'Notificaciones bloqueadas':current.phase==='disabled'?'Notificaciones desactivadas por ti':(farma?'Avisos de solicitudes Suti Farma':'Avisos de tus solicitudes')),
      h('p',{style:{fontSize:'var(--text-13, 13px)',color:'var(--ink-2)',lineHeight:1.5}},current.phase==='active'?'Recibirás avisos cuando tus solicitudes avancen.':current.phase==='unsupported'?'En iPhone, agrega SutiApp a la pantalla de inicio y ábrela desde ahí para activar los avisos. En otros dispositivos, usa un navegador compatible.':current.phase==='denied'?'El permiso está bloqueado. Revisa los ajustes para recibir avisos de tus solicitudes.':current.phase==='disabled'?'Puedes volver a activarlas cuando quieras. Tus avisos dentro de SutiApp siguen disponibles.':current.phase==='repair'?repairMessage:current.phase==='error'?'No pudimos verificar tus notificaciones. Revisa tu conexión e intenta nuevamente.':(farma?'Recibe un aviso cuando llegue una nueva solicitud de medicamento.':'Recibe un aviso cuando tu solicitud sea autorizada, rechazada, cancelada o cambie de etapa.')),
      ['ready','repair','disabled'].includes(current.phase)&&h('button',{type:'button',disabled:busy,style,onClick:()=>run(enable(current.config))},busy?'Activando…':current.phase==='repair'?'Restablecer notificaciones':'Activar notificaciones'),
      current.phase==='active'&&h('button',{type:'button',disabled:busy,style,onClick:()=>run(disable())},busy?'Desactivando…':'Desactivar en este dispositivo'),
      current.phase==='denied'&&h('button',{type:'button',style,'aria-expanded':help,onClick:()=>setHelp(!help)},'Cómo activarlas'),
      current.phase==='denied'&&help&&h('p',{style:{fontSize:'var(--text-13, 13px)',lineHeight:1.5}},permissionHelp),
      current.phase==='error'&&h('button',{type:'button',disabled:busy,style,onClick:refresh},'Reintentar'),
      startup&&h('button',{type:'button',disabled:busy,style:{...style,background:'transparent',color:'var(--ink-2)',marginLeft:8},onClick:postpone},'Ahora no'),
      error&&h('p',{role:'alert'},error));
    return h('section',{'data-request-push':current.phase,'data-request-push-startup':startup||undefined,'aria-label':startup?'Activar avisos de solicitudes':undefined,style:{background:'var(--surface)',borderRadius:16,padding:16,margin:startup?'8px 16px':undefined,marginBottom:14,boxShadow:'var(--neo-sm)',flexShrink:0,maxHeight:startup?'45vh':undefined,overflowY:startup?'auto':undefined}},
      current.phase==='active'&&!farma?h('details',null,h('summary',{style:{cursor:'pointer',fontWeight:700,color:'var(--ink-2)'}},'Notificaciones activas · Configurar'),content):content);
  }
  window.AffiliateAuth.subscribe(syncIdentity);syncIdentity();
  window.RequestPush={state,enable,clearDevice,syncIdentity};window.RequestPushInvitation=RequestPushInvitation;window.RequestPushLifecycle=RequestPushLifecycle;
})();
