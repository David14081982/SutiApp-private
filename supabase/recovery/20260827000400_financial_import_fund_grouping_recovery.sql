begin;

-- The v4 grouping fixes an invalid multi-conflict INSERT and is safe to retain
-- during authority recovery. Imported authoritative rows are never deleted.
comment on function public.stage_financial_criteria_import(jsonb,text) is
  'Shadow importer v3 retained with safe deterministic fund grouping.';

commit;
