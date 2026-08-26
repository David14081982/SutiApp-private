begin;

delete from public.companies
where source_snapshot_hash = '41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F'
  and source_sheet = 'Convenios2';

commit;
