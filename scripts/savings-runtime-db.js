'use strict';
const {query,body}=require('./savings-admin-review-db');
const chain=['20260906000100_savings_operations','20260906000200_savings_retirement_transition','20260913000000_savings_identity_compatibility','20260906000400_savings_period_yield','20260907000100_savings_balance_certification','20260913000100_savings_runtime_completion'];
const forward=()=>chain.map(f=>body('supabase/migrations/'+f+'.sql')).join('\n');
const recovery=()=>chain.slice().reverse().map(f=>body('supabase/recovery/'+f+'_recovery.sql')).join('\n');
module.exports={query,body,chain,forward,recovery};
