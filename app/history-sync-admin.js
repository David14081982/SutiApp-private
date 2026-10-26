/* Finance-only refresh control. Permission and coalescing live in backend RPCs. */
(function(){
 'use strict';const h=React.createElement;
 const date=value=>value?new Date(value).toLocaleString('es-MX',{timeZone:'America/Hermosillo',dateStyle:'medium',timeStyle:'short'}):'Aún no se ha completado una actualización';
 const running=value=>['QUEUED','RUNNING'].includes(value?.sync_state?.status);
 function HistorySyncAdmin(){
  const context=window.PrivateResourceDemand.useContext();
  const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
  const generation=React.useRef(0),readRevision=React.useRef(0),lock=React.useRef(false),timer=React.useRef(null),alive=React.useRef(false);
  const valid=token=>alive.current&&token===generation.current&&context===window.PrivateResourceDemand.context();
  function stop(){if(timer.current){clearTimeout(timer.current);timer.current=null;}}
  async function rpc(name){const result=await window.SutiSupabase.getClient().rpc(name);if(result.error)throw result.error;return result.data;}
  async function load(token,delay=5000){
   stop();const request=++readRevision.current,current=()=>valid(token)&&request===readRevision.current;
   try{
    const value=await rpc('get_admin_loan_history_sync_status');if(!current())return;
    setData(value);setError('');
    // Only this mounted admin control checks an active job. No user polling or
    // idle schedule; a hidden tab pauses until it becomes visible again.
    stop();if(running(value)&&!document.hidden)timer.current=setTimeout(()=>load(token,Math.min(30000,delay*2)),delay);
   }catch(error){if(current()){if(error?.code==='42501'||error?.status===401||error?.status===403)setData(null);setError('No pudimos consultar la actualización. Vuelve a consultar el estado.');}}
  }
  React.useEffect(()=>{
   alive.current=true;const token=++generation.current;setData(null);setError('');setBusy(false);lock.current=false;load(token);
   const visibility=()=>{if(document.hidden)stop();else load(token);};
   document.addEventListener('visibilitychange',visibility);
   return()=>{alive.current=false;generation.current++;stop();document.removeEventListener('visibilitychange',visibility);};
  },[context]);
  async function refresh(){
   if(lock.current||!data?.enabled||!data.can_sync||running(data))return;
   lock.current=true;readRevision.current++;stop();setBusy(true);setError('');const token=generation.current;
   try{
    const result=await rpc('request_admin_loan_history_sync');if(!valid(token))return;
    setData(previous=>({...previous,...result}));await load(token);
   }catch(_){if(valid(token))setError('No pudimos confirmar la actualización. Consulta el estado antes de volver a intentarlo.');}
   finally{if(valid(token)){lock.current=false;setBusy(false);}}
  }
  const working=busy||running(data),failed=data?.sync_state?.status==='FAILED';
  return h('section',{'data-history-sync':'admin',style:{border:'1px solid var(--hairline,#e2e5ec)',borderRadius:16,padding:16,marginBottom:16,background:'var(--surface,#fff)'}},
   h('div',{style:{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}},
    h('div',null,h('h2',{style:{fontSize:15,margin:'0 0 5px'}},'Historial y amortizaciones'),
     h('p',{style:{fontSize:12,color:'var(--ink-3,#677185)',margin:0}},'Actualización diaria a las 3:00 p. m. · Hora de Hermosillo')),
    data?.can_sync&&h('button',{type:'button',onClick:refresh,disabled:!data.enabled||working,'data-history-sync-action':'refresh',style:{border:0,borderRadius:11,padding:'11px 14px',background:'var(--guinda,#ad0030)',color:'white',fontFamily:'inherit',fontWeight:800,cursor:working?'wait':'pointer',opacity:(working||!data.enabled)?0.6:1}},working?'Actualizando…':'Actualizar desde Google Sheets')),
   h('p',{style:{fontSize:12,margin:'10px 0 0'},'data-history-sync-last':'timestamp'},data?'Última actualización: '+date(data.source_updated_at):'Consultando estado…'),
   working&&h('p',{role:'status',style:{fontSize:12,margin:'8px 0 0'}},'Actualizando solicitudes y cuotas. Los usuarios pueden seguir consultando la información anterior mientras termina.'),
   data&&!data.enabled&&h('p',{role:'status',style:{fontSize:12,color:'#805800'}},'La actualización está deshabilitada.'),
   failed&&h('p',{role:'alert',style:{fontSize:12,color:'#ac0030'}},'La última actualización no se completó. Se conserva la información de la fecha indicada.'),
   data?.source_metadata?.unaddressable_owner_rows>0&&h('p',{style:{fontSize:12,color:'#805800'}},data.source_metadata.unaddressable_owner_rows+' registros tienen un folio por revisar en el origen y no se asignan a usuarios.'),
   error&&h('p',{role:'alert',style:{fontSize:12,color:'#ac0030'}},error),
   (error||failed)&&h('button',{type:'button',onClick:()=>load(generation.current),style:{border:0,background:'transparent',padding:'5px 0',color:'var(--guinda,#ad0030)',fontFamily:'inherit',fontWeight:700}},'Consultar estado'));
 }
 window.HistorySyncAdmin=HistorySyncAdmin;
})();
