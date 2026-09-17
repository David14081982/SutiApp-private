/* Voting authority: Supabase RPC only. No persistent voting cache. */
(function(){
  'use strict';
  async function rpc(name,args){const r=await window.SutiSupabase.getClient().rpc(name,args);if(r.error)throw r.error;return r.data;}
  const resultHeaders=['Consulta','Pregunta','Sí','No','Abstención','Total','Participación %'];
  const identifiedHeaders=['Folio','Fecha','Hora','Consulta','Pregunta','Respuesta','Número de control','Nombre','Correo','Sindicato','Nivel/tipo de empleado'];
  function csv(rows,identified){
    const headers=identified?identifiedHeaders:resultHeaders;
    const escape=value=>{let s=String(value==null?'':value);if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFFsep=;\r\n'+[headers.map(escape).join(';'),...rows.map(row=>headers.map(k=>escape(row[k])).join(';'))].join('\r\n');
  }
  async function download(id,identified){
    const rows=await rpc('export_voting_consultation',{p_id:id,p_identified:!!identified});
    const url=URL.createObjectURL(new Blob([csv(rows,identified)],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download='votaciones-'+(identified?'votos':'resultados')+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  // voting_live_state only carries ids and a timestamp (RLS by audience): any change means "reload from the RPC".
  let channels=0;
  function watch(onChange){
    let status='CLOSED',closed=false,joined=false,client=null,channel=null;
    try{
      client=window.SutiSupabase.getClient();
      channel=client.channel('voting-live-'+(++channels)+'-'+Date.now().toString(36))
        .on('postgres_changes',{event:'*',schema:'public',table:'voting_live_state'},()=>{if(!closed)onChange();})
        .subscribe(s=>{status=s;if(s==='SUBSCRIBED'){if(joined&&!closed)onChange();joined=true;}});
    }catch(_){channel=null;}
    return Object.freeze({connected:()=>!closed&&status==='SUBSCRIBED',stop:()=>{if(closed)return;closed=true;if(channel)client.removeChannel(channel);}});
  }
  window.VotingRepository=Object.freeze({
    list:admin=>rpc('list_voting_consultations',{p_admin:!!admin}),
    vote:(c,q,answer)=>rpc('cast_voting_vote',{p_consultation:c,p_question:q,p_answer:answer}),
    save:c=>rpc('save_voting_consultation',{p_id:c.id||null,p_version:c.version||null,p_value:{title:c.title,closes_on:c.closes_on,published:c.published,audience:c.audience,questions:c.questions.map(q=>({id:q.id||null,title:q.title,detail:q.detail||''}))}}),
    action:(c,action)=>rpc('voting_consultation_action',{p_id:c.id,p_version:c.version,p_action:action}),
    activate:(consultation,question)=>rpc('set_voting_active_question',{p_consultation:consultation,p_question:question||null}),
    live:consultation=>rpc('get_voting_live',{p_consultation:consultation}),
    electorate:audience=>rpc('count_voting_electorate',{p_audience:audience}),
    votes:consultation=>rpc('list_voting_votes',{p_consultation:consultation}),
    removeVotes:(consultation,{vote,affiliate})=>rpc('delete_voting_votes',{p_consultation:consultation,p_vote:vote||null,p_affiliate:affiliate||null}),
    watch,download,csv,
  });
})();
