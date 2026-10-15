begin;
set local lock_timeout='2s';
-- Disable the feature while retaining every audit record and number reservation.
-- Deliberately does not undo user decisions or delete immutable history.
drop function public.change_admin_affiliate_control(uuid,text,timestamptz,text,text,uuid);
drop function public.preview_admin_affiliate_control(uuid,text);
drop function public.list_admin_affiliate_control_changes(uuid);
drop function public.affiliate_control_inventory(uuid,text,text);
drop function public.affiliate_control_relation(oid,integer,oid[]);
drop function public.affiliate_control_authorize();
commit;
