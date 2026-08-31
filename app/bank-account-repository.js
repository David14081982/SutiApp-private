/* Private affiliate banking accounts. No historical Excel fallback. */
(function () {
  'use strict';
  const db = () => window.SutiSupabase.getClient();
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const project = (row) => Object.freeze(Object.assign({}, row, {
    maskedClabe: row.clabe ? '•••• •••• •••• ••' + row.clabe.slice(-4) : '',
    maskedAccount: row.account_number ? '•••• ' + row.account_number.slice(-4) : '',
    maskedCard: row.card_number ? '•••• ' + row.card_number.slice(-4) : '',
  }));

  async function list() {
    const result = await db().from('affiliate_bank_accounts')
      .select('id,affiliate_id,account_holder,bank_name,clabe,account_number,card_number,is_primary,data_status,incomplete_fields,source_kind,created_at,updated_at')
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true });
    if (result.error) throw result.error;
    return Object.freeze((result.data || []).map(project));
  }

  async function listDeposit() {
    const result = await db().rpc('list_current_deposit_accounts');
    if (result.error) throw result.error;
    return Object.freeze((result.data || []).map(project));
  }

  async function save(row) {
    const result = await db().rpc('save_affiliate_bank_account', {
      p_id: row.id || null,
      p_holder: String(row.account_holder || '').trim(),
      p_bank: String(row.bank_name || '').trim(),
      p_clabe: digits(row.clabe) || null,
      p_account: digits(row.account_number),
      p_primary: false,
    });
    if (result.error) throw result.error;
    return project(result.data);
  }

  async function saveDeposit(row) {
    const result = await db().rpc('save_affiliate_deposit_account', {
      p_id: row.id || null,
      p_bank: String(row.bank_name || '').trim(),
      p_card: digits(row.card_number),
      p_clabe: digits(row.clabe),
    });
    if (result.error) throw result.error;
    return project(result.data);
  }

  async function getNotificationPhone() {
    const result = await db().rpc('get_current_notification_phone');
    if (result.error) throw result.error;
    return Object.freeze(result.data || { notification_phone: '', source: 'NONE' });
  }

  async function saveNotificationPhone(phone) {
    const result = await db().rpc('save_current_notification_phone', { p_phone: digits(phone) });
    if (result.error) throw result.error;
    return result.data;
  }

  async function setPrimary(id) {
    const result = await db().rpc('set_primary_affiliate_bank_account', { p_id: id });
    if (result.error) throw result.error;
    return project(result.data);
  }

  async function remove(id) {
    const result = await db().rpc('delete_affiliate_bank_account', { p_id: id });
    if (result.error) throw result.error;
    return result.data;
  }

  window.BankAccountRepository = Object.freeze({
    list, listDeposit, save, saveDeposit, getNotificationPhone, saveNotificationPhone, setPrimary, remove,
  });
})();
