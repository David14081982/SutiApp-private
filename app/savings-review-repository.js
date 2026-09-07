(function () {
 'use strict';
 async function rpc(name, values) {
  const result = await window.SutiSupabase.getClient().rpc(name, values);
  if (result.error) throw result.error;
  return result.data;
 }
 window.SavingsReviewRepository = Object.freeze({
  list: () => rpc('get_admin_savings_review', { p_record_id: null }),
  detail: id => rpc('get_admin_savings_review', { p_record_id: id }),
  save: command => rpc('admin_save_savings_review', {
   p_record_id: command.id, p_version: command.version, p_changes: command.changes,
   p_status: command.status, p_observation: command.observation || null, p_client_action_id: command.key,
  }),
 });
})();
