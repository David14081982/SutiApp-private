/* Private affiliate banking accounts. No historical Excel fallback. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient();
  const project=(r)=>Object.freeze(Object.assign({},r,{maskedClabe:r.clabe?'•••• •••• •••• ••'+r.clabe.slice(-4):'',maskedAccount:r.account_number?'•••• '+r.account_number.slice(-4):''}));
  async function list(){const r=await db().from('affiliate_bank_accounts').select('id,affiliate_id,account_holder,bank_name,clabe,account_number,is_primary,data_status,incomplete_fields,source_kind,created_at,updated_at').order('is_primary',{ascending:false}).order('created_at',{ascending:true});if(r.error)throw r.error;return Object.freeze((r.data||[]).map(project));}
  async function save(row){const r=await db().rpc('save_affiliate_bank_account',{p_id:row.id||null,p_holder:String(row.account_holder||'').trim(),p_bank:String(row.bank_name||'').trim(),p_clabe:String(row.clabe||'').trim()||null,p_account:String(row.account_number||'').trim(),p_primary:false});if(r.error)throw r.error;return project(r.data);}
  async function setPrimary(id){const r=await db().rpc('set_primary_affiliate_bank_account',{p_id:id});if(r.error)throw r.error;return project(r.data);}
  async function remove(id){const r=await db().rpc('delete_affiliate_bank_account',{p_id:id});if(r.error)throw r.error;return r.data;}
  window.BankAccountRepository=Object.freeze({list,save,setPrimary,remove});
})();
