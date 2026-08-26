# Phase 2 education asset recovery

Run `python scripts/recover-phase2-education.py` first. It is read-only by default and must reconcile exactly 32 historical rows while proving that every linked asset has no reference outside that set. Only then may an authorized operator run it with `--apply`; afterward apply `20260821000800_complete_phase2_content_recovery.sql` if the whole Phase 2 schema must be removed.

The recovery deletes only rows and Storage objects tied to snapshot `B3E940D6508FA0FC571E16097391B69D859AD8F1BA587E536F5A2D312314E1E4`. The versioned JSON snapshot is the backup for re-import; Google remains read-only provenance.
