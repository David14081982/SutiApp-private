/* Versioned, program-scoped terms. */
(function(){
  'use strict';const db=()=>window.SutiSupabase.getClient();
  async function current(programId,membershipId){let q=db().from('program_terms_versions').select('id,program_id,membership_offering_id,version,title,body,private_asset_id,published,published_at').eq('program_id',programId).eq('published',true);q=membershipId?q.eq('membership_offering_id',membershipId):q.is('membership_offering_id',null);const r=await q.maybeSingle();if(r.error)throw r.error;return r.data||null;}
  async function list(programId){let q=db().from('program_terms_versions').select('*').order('version',{ascending:false});if(programId)q=q.eq('program_id',programId);const r=await q;if(r.error)throw r.error;return Object.freeze(r.data||[]);}
  async function save(row){const value={program_id:row.program_id,membership_offering_id:row.membership_offering_id||null,version:Number(row.version),title:String(row.title||'').trim(),body:row.body?String(row.body):null,private_asset_id:row.private_asset_id||null,published:!!row.published,published_at:row.published?new Date().toISOString():null};const r=await db().from('program_terms_versions').insert(value).select().single();if(r.error)throw r.error;return r.data;}
  async function publish(programId,membershipId,title,body){const r=await db().rpc('publish_program_terms',{p_program_id:programId,p_membership_offering_id:membershipId||null,p_title:title,p_body:body});if(r.error)throw r.error;return r.data;}
  window.ProgramTermsRepository=Object.freeze({current,list,save,publish});
})();
