/* Server-owned private Savings review. No local financial authority. */
(function(){
 'use strict';
 async function rpc(name,args){const {data,error}=await window.SutiSupabase.getClient().rpc(name,args);if(error)throw error;return data;}
 window.SavingsPanelRepository=Object.freeze({
  list:q=>rpc('get_admin_savings_panel',{p_tab:q.tab,p_search:q.search||'',p_filter:q.filter||'todos',p_offset:q.offset||0,p_limit:20}),
  detail:(id,offset=0,limit=6)=>rpc('get_admin_savings_panel_detail',{p_record_id:id,p_history_offset:offset,p_history_limit:limit}),
  affiliate:id=>rpc('get_admin_savings_panel_affiliate',{p_affiliate_id:id}),
  request:id=>rpc('get_admin_savings_panel_request',{p_record_id:id}),
  neighbor:c=>rpc('get_admin_savings_panel_neighbor',{p_record_id:c.id,p_tab:c.tab,p_search:c.search||'',p_filter:c.filter||'todos',p_direction:c.direction}),
  reset:c=>rpc('admin_reset_savings_panel_discount',{p_record_id:c.id,p_version:c.version,p_field:c.field,p_observation:c.observation||null,p_client_action_id:c.key}),
  save:c=>rpc('admin_save_savings_panel',{p_record_id:c.id,p_version:c.version,p_changes:c.changes,p_status:c.status,p_observation:c.observation||null,p_client_action_id:c.key}),
 });
})();
