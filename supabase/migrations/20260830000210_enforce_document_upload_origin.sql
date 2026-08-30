begin;

-- ACL revocation is insufficient while PostgREST can still resolve the old overload.
-- Remove the overload so CAMERA/FILE capability checks cannot be bypassed.
drop function public.register_affiliate_document(uuid,text,text,bigint,text);

commit;
