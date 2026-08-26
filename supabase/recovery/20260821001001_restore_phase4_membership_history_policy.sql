begin;
drop policy membership_offerings_admin_insert on public.membership_offerings;
drop policy membership_offerings_admin_update on public.membership_offerings;
drop policy membership_offerings_admin_delete on public.membership_offerings;
revoke insert(company_raw,concept,amount,installments,logo_asset_id,enabled,sort_order,record_origin) on public.membership_offerings from authenticated;
revoke update(company_raw,concept,amount,installments,logo_asset_id,enabled,sort_order,updated_at) on public.membership_offerings from authenticated;
grant insert,update on public.membership_offerings to authenticated;
create policy membership_offerings_admin_write on public.membership_offerings for all to authenticated using(public.has_admin_permission('memberships.write')) with check(public.has_admin_permission('memberships.write'));
commit;
