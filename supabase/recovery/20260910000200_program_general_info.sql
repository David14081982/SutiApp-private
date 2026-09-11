begin;
-- Runtime rollback preserves all metadata and assets. Restore previous frontend;
-- disable the new writer, retain additive columns and validated business content.
revoke execute on function public.save_program_general_info(text,timestamptz,jsonb) from authenticated;
revoke execute on function public.register_program_general_cover(text,text,bigint,text) from authenticated;
drop policy program_general_cover_insert on storage.objects;
notify pgrst,'reload schema';
commit;
