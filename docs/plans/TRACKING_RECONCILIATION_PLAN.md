# TRACKING_RECONCILIATION_PLAN

Status: PREPARED_ONLY / OWNER_APPROVAL_REQUIRED. No executable repair SQL is supplied or run.
Source task: H-SUTIAPP-PRODUCTION-SOURCE-REINTEGRATION-001.

## Certified discrepancy

Production tracks 20260918000100 with name savings_beneficiaries.
The canonical repository uses 20260918000100 for savings_panel_single_projection.
Restored beneficiary source is 20260918120000_savings_beneficiaries.sql.
The existing beneficiary tracking statements have 114 characters and MD5
14ce52f73fcab3f71c1b3bba420817c2 (metadata fingerprint, not a DDL-equivalence proof).
The beneficiary schema was independently certified. Never replay its DDL or import to fix tracking.

Aval 20260909000300 and Disk IO 20260907000200 have installed changes without their exact tracking rows.
Restoring these files does not silently authorize recording them as new executions.
The separate 20260917000100 banners_audience record must never be reassigned to the unapplied counterpart proposal.

## Proposed future procedure, subject to independent approval

1. Freeze the approved source revision and recheck the target project, migration records and exact
   installed signatures/definitions. Inspect the panel implementation independently: a filename is not
   proof its migration ran. Preserve the later Aval versions of the four shared Disk IO functions.
2. Back up the affected migration metadata, column structure, original statement arrays and hashes
   privately, without changing or exporting business rows. Define a narrowly scoped recovery that
   restores only touched tracking records. Verify that recovery on an isolated copy.
3. Obtain owner approval for a concrete metadata-only transaction and its exact expected-before values.
   Abort on an occupied 20260918120000, changed beneficiary source row, unexpected name/hash,
   duplicates or schema drift. Preserve all original metadata not explicitly approved for change.
4. Move only the proven beneficiary tracking record to 20260918120000, retaining provenance and
   original statements. Do not claim that the 114-character entry is the complete migration SQL.
5. Independently reconcile savings_panel_single_projection at 20260918000100 only if its installed
   definition is proven. If it is not proven installed, leave it unresolved for a separate decision;
   do not apply DDL as part of tracking reconciliation.
6. Consider explicit metadata-only registration for Aval and Disk IO only after approval and schema
   certification. Document partial textual supersession of Disk IO by Aval; do not execute either SQL.
7. Re-read metadata, assert uniqueness/expected names, compare backend definition hashes before/after,
   verify zero business-data/DDL changes and record the approved recovery evidence.

No supabase db push, migration up, reset, automatic migration repair or CI migration runner is authorized
against production before this plan is approved and completed. The new source files are historical
reconciliation material, not pending instructions to execute on an already-installed backend.

No business, Storage, Auth, beneficiary or financial data may be changed by the future metadata repair.
