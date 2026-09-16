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
  window.VotingRepository=Object.freeze({
    list:admin=>rpc('list_voting_consultations',{p_admin:!!admin}),
    vote:(c,q,answer)=>rpc('cast_voting_vote',{p_consultation:c,p_question:q,p_answer:answer}),
    save:c=>rpc('save_voting_consultation',{p_id:c.id||null,p_version:c.version||null,p_value:{title:c.title,closes_on:c.closes_on,electorate:Number(c.electorate),published:c.published,audience:c.audience,questions:c.questions.map(q=>({id:q.id||null,title:q.title,detail:q.detail||''}))}}),
    action:(c,action)=>rpc('voting_consultation_action',{p_id:c.id,p_version:c.version,p_action:action}),download,csv,
  });
})();
