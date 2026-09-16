-- Non-destructive kill switch. Preserve every consultation, question, vote and audit entry.
begin;
revoke execute on function public.list_voting_consultations(boolean),public.cast_voting_vote(uuid,uuid,text),public.save_voting_consultation(uuid,integer,jsonb),public.voting_consultation_action(uuid,integer,text),public.export_voting_consultation(uuid,boolean) from authenticated;
-- Restore the previous frontend deployment. Re-enable RPC grants only after repair and verification.
commit;
