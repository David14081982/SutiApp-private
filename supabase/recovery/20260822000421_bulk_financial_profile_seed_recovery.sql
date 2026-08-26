-- Execute only with the batch UUID printed by the seed. The RPC refuses recovery
-- after any later Admin edit and restores the exact 947-row pre-seed snapshot.
select public.recover_affiliate_financial_profile_seed('<BATCH_UUID>'::uuid);
