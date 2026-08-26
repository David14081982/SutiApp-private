# EXPEDIENT DOCUMENT HYGIENE RESULT

Scope: live Supabase classification/RLS, Admin historical audit, gallery viewer and read-only safe-delete audit. No physical or logical deletion was performed.

```text
Visible required documents: 7 verified of 8 required
Historical non-documents hidden: 21 for the certified affiliate / 8,567 global
Historical valid documents preserved: 6 for the certified affiliate / 913 global
Duplicate hash groups: 9
Duplicate relations safe to remove: 0
Shared objects: 9 groups
Safe physical deletes: 0
Unknown: 3 Storage objects outside the registry; preserved
Storage objects deleted: 0
DB relations removed: 0
Protected historical objects deleted: 0
User-facing unclassified technical files: 0
Admin historical audit: PASS
Gallery UX: PASS
Internal viewer: PASS
Image viewer: PASS
PDF viewer: PASS
Next/previous navigation: PASS
Filters: PASS
Approval: PASS
Request reupload: PASS
Browser: PASS
RLS: PASS
Recovery manifest: PASS
Final verdict: PASS
```

Evidence: live post-migration invariants preserved 12,901 `affiliate_files`, 25,358 provenance rows, 13,048 private assets and 13,051 private Storage objects. Chrome authenticated as Admin and affiliate certified 13 catalog types, 8 required, 27 historical Admin cards (21 technical + 6 valid), 33 thumbnails, image/PDF internal viewers, filters and zero historical rows readable by the affiliate. Approval/rejection/reupload controls call the audited document workflow; contract tests cover every status without mutating a real expediente.
