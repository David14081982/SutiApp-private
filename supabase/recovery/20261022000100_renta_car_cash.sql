-- Non-destructive recovery: stop new rentals; retain bookings, events, documents,
-- snapshots and cancellation ability. Never restore obsolete loan behavior for Renta Car.
begin;
set local lock_timeout='3s';
update renta_private.settings set enabled=false where id;
revoke execute on function public.renta_car_submit(uuid,date,date,numeric,text,boolean,uuid[],uuid) from authenticated;
-- Exact prior definitions remain in renta_private.definitions for an audited forward repair.
-- A schema-only preflight/test is recovered with transaction ROLLBACK.
commit;
