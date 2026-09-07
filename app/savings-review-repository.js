(function () {
 'use strict';
 async function rpc(name, values) {
  const result = await window.SutiSupabase.getClient().rpc(name, values);
  if (result.error) throw result.error;
  return result.data;
 }
 window.SavingsReviewRepository = Object.freeze({
  access: () => rpc('get_savings_admin_access', {}),
  setAccessMode: command => rpc('set_savings_admin_access_mode', { p_mode: command.mode, p_version: command.version, p_client_action_id: command.key }),
  authorizeEmail: (email, edit) => rpc('set_section_responsibilities', { p_email: email.trim(), p_section_key: 'savings', p_actions: edit ? ['read', 'update'] : ['read'] }),
  revokeAccess: id => rpc('revoke_section_responsibilities', { p_auth_user_id: id, p_section_key: 'savings' }),
  list: () => rpc('get_admin_savings_review', { p_record_id: null }),
  detail: id => rpc('get_admin_savings_review', { p_record_id: id }),
  withdrawals: recordId => rpc('get_admin_savings_review_withdrawals', { p_record_id: recordId }),
  recordedHistory: participantId => rpc('get_admin_savings_recorded_history', { p_participant_id: participantId }),
  save: command => rpc('admin_save_savings_review', {
   p_record_id: command.id, p_version: command.version, p_changes: command.changes,
   p_status: command.status, p_observation: command.observation || null, p_client_action_id: command.key,
  }),
 });
})();
