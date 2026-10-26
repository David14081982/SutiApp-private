-- Revert rental UI/repository first. Preserve metadata and audit history for forward recovery.
-- This removes only the new write entry point; old catalog writers continue to operate.
drop function public.save_renta_car_catalog_item(uuid,jsonb,jsonb,jsonb,timestamptz);
-- Intentionally retain rental_specs, its read grant and scope constraint: never discard Admin data.
notify pgrst,'reload schema';
