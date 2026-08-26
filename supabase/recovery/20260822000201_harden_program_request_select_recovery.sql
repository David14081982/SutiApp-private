begin;

-- Restore the immediately preceding grant shape without changing any request.
revoke select on public.program_requests from authenticated;
grant select on public.program_requests to authenticated;

notify pgrst, 'reload schema';
commit;
