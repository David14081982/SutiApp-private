/* Supabase authority for the editorial copy of the Suti Inversion screen. */
(function(){
  'use strict';const db=()=>window.SutiSupabase.getClient();
  async function list(){const r=await db().from('investment_screen_copy').select('id,value,sort_order').order('sort_order',{ascending:true});if(r.error)throw r.error;return Object.freeze(r.data||[]);}
  async function save(id,value){const r=await db().from('investment_screen_copy').update({value:String(value)}).eq('id',id).select('id,value,sort_order').single();if(r.error)throw r.error;return r.data;}
  window.InvestmentCopyRepository=Object.freeze({list,save});
})();
