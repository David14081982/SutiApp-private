/* Administrative restrictions: Supabase is the only authority. No persistent cache. */
(function () {
  const client = () => { const db = window.SutiSupabase?.getClient(); if (!db) throw new Error('SUPABASE_NOT_CONFIGURED'); return db; };
  const context = () => JSON.stringify([window.AffiliateAuth?.getState().session?.user?.id, window.AffiliateAuth?.getState().affiliate?.id, window.AdminRepository?.getState?.().assignment]);
  async function rpc(name, args) {
    const before = context(), result = await client().rpc(name, args || {});
    if (before !== context()) throw new Error('FINANCE_BLOCK_CONTEXT_CHANGED');
    if (result.error) throw result.error;
    return result.data;
  }
  async function assertAllowed() {
    const result = await rpc('get_self_finance_block');
    if (!result || typeof result.blocked !== 'boolean') throw new Error('FINANCE_BLOCK_CHECK_UNAVAILABLE');
    if (result.blocked) {
      window.FinanceBlocksUI.show(result.block);
      const error = new Error('FINANCE_REQUEST_BLOCKED'); error.code = 'FINANCE_REQUEST_BLOCKED'; throw error;
    }
  }
  async function handle(error) {
    if ([error?.message,error?.code,error?.details].some(value => String(value || '').includes('FINANCE_REQUEST_BLOCKED'))) await assertAllowed();
    throw error;
  }
  window.FinanceBlocksRepository = Object.freeze({
    context, assertAllowed, handle,
    list: (affiliateId) => rpc('list_admin_finance_blocks', { p_affiliate_id: affiliateId || null }),
    save: (values) => rpc('save_admin_finance_block', values),
    revoke: (id, version, reason) => rpc('revoke_admin_finance_block', { p_id:id, p_version:version, p_reason:reason }),
  });
})();
