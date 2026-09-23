(function(){
  'use strict';
  const h=React.createElement;
  const input={minHeight:42,padding:'9px 11px',border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)',color:'var(--ink)',font:'inherit',boxSizing:'border-box',maxWidth:'100%'};
  const date=value=>value?new Intl.DateTimeFormat('es-MX',{timeZone:'America/Hermosillo',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
  function LoginHistoryModule({app,header,onBack}){
    const [draft,setDraft]=React.useState({query:'',from:'',to:''});
    const [filter,setFilter]=React.useState({mode:'users',query:'',from:'',to:'',page:1});
    const [refresh,setRefresh]=React.useState(0),[data,setData]=React.useState(null),[loading,setLoading]=React.useState(true),[error,setError]=React.useState('');
    const allowed=app.admin.has('authorization.read');
    React.useEffect(()=>{
      let active=true;setData(null);setError('');setLoading(true);
      if(!allowed){setLoading(false);setError('No tienes permiso para consultar estos accesos.');return()=>{active=false;};}
      window.LoginHistoryRepository.list(filter).then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError('No fue posible consultar los accesos. Reintenta; si el problema continúa, verifica tus permisos.');}).finally(()=>{if(active)setLoading(false);});
      return()=>{active=false;};
    },[filter,refresh,allowed,app.admin.subjectKey]);
    const apply=e=>{e.preventDefault();if(draft.from&&draft.to&&draft.from>draft.to){setError('La fecha inicial debe ser anterior o igual a la final.');return;}setFilter({...draft,mode:filter.mode,page:1});};
    const field=(key,label,type)=>h('label',{style:{display:'grid',gap:5,fontSize:12,fontWeight:700,flex:key==='query'?'2 1 230px':'1 1 150px'}},label,h('input',{type:type||'text',value:draft[key],maxLength:key==='query'?200:undefined,onChange:e=>setDraft({...draft,[key]:e.target.value}),style:input}));
    const pages=Math.max(1,Math.ceil((data?.total||0)/25));
    const button=(label,props)=>h('button',{type:'button',style:{...input,cursor:'pointer',fontWeight:750},...props},label);
    return h('div',{'data-admin-login-history':true},header({title:'Historial de accesos',sub:'Usuarios y accesos registrados · horario de Sonora',onBack}),
      h('div',{className:'su-app-scroll',style:{padding:18}},
        h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}},
          ...[['users','Usuarios que ya ingresaron'],['history','Historial']].map(([mode,label])=>button(label,{key:mode,'aria-pressed':filter.mode===mode,onClick:()=>setFilter({...filter,mode,page:1})})),
          button('Actualizar',{onClick:()=>setRefresh(x=>x+1),disabled:loading})),
        h('p',{style:{fontSize:12,color:'var(--ink-3)',lineHeight:1.6}},filter.mode==='users'?'Una fila por cuenta con su último inicio de sesión. No indica quién está conectado ahora.':'Cada fila corresponde a un inicio de sesión registrado. Los accesos anteriores a la activación del historial no se pueden reconstruir.',data?.history_available_from?' Primer evento conservado: '+date(data.history_available_from)+'.':''),
        h('form',{onSubmit:apply,style:{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap',marginBottom:16}},field('query','Buscar nombre, control, correo o teléfono'),field('from','Desde','date'),field('to','Hasta','date'),h('button',{type:'submit',style:input},'Buscar'),button('Limpiar',{onClick:()=>{setDraft({query:'',from:'',to:''});setFilter({mode:filter.mode,query:'',from:'',to:'',page:1});}})),
        error&&h('div',{role:'alert',style:{padding:12,color:'#A32921'}},error,button('Reintentar',{onClick:()=>setRefresh(x=>x+1)})),
        loading&&h('p',{role:'status'},'Consultando accesos…'),
        data&&!loading&&h(React.Fragment,null,
          h('p',{role:'status',style:{fontWeight:750,fontSize:13}},data.total_users_signed_in+' cuentas han ingresado · '+data.total+' resultados'+(filter.mode==='history'?' · '+data.users_in_filter+' usuarios en el filtro':'')),
          !data.items.length?h('p',null,'No hay accesos registrados para estos filtros.'):h('div',{role:'region','aria-label':'Resultados de accesos',tabIndex:0,style:{overflowX:'auto',background:'var(--surface)',borderRadius:14,boxShadow:'var(--neo-sm)'}},
            h('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:12,textAlign:'left'}},
              h('thead',null,h('tr',null,...['Usuario','N.º de control','Correo','Teléfono','Fecha y hora'].map(label=>h('th',{key:label,scope:'col',style:{padding:12,whiteSpace:'nowrap',borderBottom:'1px solid var(--line)'}},label)))),
              h('tbody',null,...data.items.map(row=>h('tr',{key:row.id},
                ...[row.full_name||'Cuenta sin afiliado vinculado',row.numero_control||'—',row.email||'Sin correo disponible',
                  h('div',null,h('span',null,row.phone||'Sin teléfono confirmado'),row.historical_phone&&h('small',{style:{display:'block',color:'var(--ink-3)',marginTop:4}},'Histórico: '+row.historical_phone)),date(row.occurred_at)
                ].map((value,i)=>h('td',{key:i,style:{padding:12,borderBottom:'1px solid var(--line)',whiteSpace:i===4?'nowrap':'normal',minWidth:i===3?170:110,overflowWrap:'anywhere'}},value))))))),
          h('nav',{'aria-label':'Paginación de accesos',style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:16}},
            button('Anterior',{disabled:filter.page<=1,onClick:()=>setFilter({...filter,page:filter.page-1})}),
            h('span',null,'Página '+filter.page+' de '+pages),
            button('Siguiente',{disabled:filter.page>=pages,onClick:()=>setFilter({...filter,page:filter.page+1})}))
        )));
  }
  window.LoginHistoryModule=LoginHistoryModule;
})();
