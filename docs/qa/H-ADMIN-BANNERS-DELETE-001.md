# H-ADMIN-BANNERS-DELETE-001

## PRE-CHANGE AUDIT

Status: PASS (implementation authorized by owner's request, including publication).
Objective: delete active/inactive banners through confirmation, preserve history and audit, exact existing delete permissions, immediate truthful UI update.
Scope: app/screens-admin-visual-crud.jsx (banner branch only); new banner archive migration/recovery; scripts/test-admin-banners-delete* and scripts/release-admin-banners-delete.js; this report/evidence; append-only governance/changelog entries; derived architecture registry; generated app/bundle.js and version tokens in SutiApp.html/sw.js.
Excluded: creation, activation, ordering, other screens, shared repositories/helpers, assets/Storage, Auth/permission assignments, financial/Google legacy, global suites.
Base: isolated worktree from origin/main 91069eb. Existing dirty workspace preserved.
Authority: public.banners remains master including historical source coordinates. New private banner_deletions is lifecycle metadata keyed 1:1 to the original row, never a content copy/fallback. No original row or asset deleted or rewritten.
Readers: AdminRepository.listManaged, BannerRepository, company/Marketplace banner consumers all read public.banners under RLS. Restrictive policies exclude archived rows for browser roles without expanding existing permissions.
Writer: archive_admin_banner(uuid) checks the current technical banners.write OR exact section banners/delete, matching AdminRepository.has. Actor auth.uid() and timestamp come from backend. PK + parent row lock make retries idempotent; existing admin_audit_log records BANNERS_DELETE atomically.
Finding: historical rows hide the existing hard-delete button; no banner archive mechanism exists. Reuse repository's history-preserving archive pattern through minimal banner-specific lifecycle metadata; do not repurpose enabled or historical provenance. Existing UI and existing shared functions remain unchanged outside banner deletion.
UI contract: header/sidebar, create CTA, ordered cards, thumbnail/title/status, activate/up/down/edit, scroll/loading/error/empty states retained. Add trash button and accessible confirmation overlay only for Banners.
Risks: restrictive RLS must cover both Admin and public plus update/delete; recovery must never resurrect archived content silently; failed RPC must retain card/modal; ref lock must close double-click race before rerender.
Tests: backend SQL active/inactive/historical, exact permission denied/allowed, audit actor/time, duplicate retry, no original mutations, RLS public/Admin exclusions, recovery transaction; isolated real browser modal/cancel/error/double-click/permissions/mobile; published authenticated smoke and bytes.
Recovery: schema recovery allowed only with empty archive history, before any legitimate deletions; after use preserve metadata/history and repair forward. No installation-time business changes. Transaction tests roll back all banner/audit/permission changes.
Navigator: stale only in unrelated documentation/tests; directed code and migration inspection confirms boundary. Registry to be regenerated for the new banner lifecycle dependency.
Guardians: source-of-truth SAFE; Supabase and database migration review required on actual SQL; Claude preservation and post-change verification required before close. Legacy NOT APPLICABLE. No global suites per owner.

Scope refinement: include 20260908000801_banner_archive_service_grants.sql and matching recovery. Live ACL inspection found Supabase default grants gave service_role DML on the new metadata table. Limit this new table to service SELECT and RPC-owned writes; existing user permission rules remain identical. ACL dry-run/recovery and apply preserve all rows.

## Validación y evidencia

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Eliminar inactivo / activo / histórico | PASS | sql-live.json: RPC real dentro de transacción revertida |
| Desaparece de Admin y App pública | PASS | RLS authenticated/anon; browser.json confirma actualización de lista y refresco público |
| Sin permiso delete | DENIED | Usuario normal y responsable read/update denegados; delete exacto permitido sin publish/update |
| Auditoría de quién/cuándo | PASS | Actor Auth, timestamp y BANNERS_DELETE; 2 operaciones = 2 auditorías |
| Error backend | PASS | Fallo de auditoría revierte metadata; fallo RPC simulado mantiene tarjeta/modal/error controlado |
| Doble clic / reintento | PASS | Ref síncrono en UI; RPC idempotente con PK y lock; una sola auditoría |
| Modal y cancelación | PASS | Navegador real, teclado/Escape/foco, 390px/1440px, miniatura legítima en local.json |
| Conservación de historia/assets | PASS | 23 banners y hash íntegro; 176 assets y 13,377 objetos antes/después |
| Seguridad metadata | PASS | RLS forzada, browser sin grants; service_role sólo SELECT tras 00801 |

Comandos ejecutados: build-bundle.js con Babel 7.28.4; build-pages-site.js; test-admin-banners-delete-browser.js; release-admin-banners-delete.js test/apply/verify; test-admin-banners-delete-live.js contra build local; test-admin-banners-delete-scope.js; test-home-banner-expansion.js. La matriz destructiva usa backend real con ROLLBACK: no se eliminó ningún banner del propietario para certificar esta H. El navegador aislado prueba respuestas de error/doble clic y el navegador autenticado comprueba UI/miniatura/RPC sin confirmar una eliminación real.

La primera prueba local detectó CRLF en vendors producido por checkout Windows que rompía SRI. Se restauraron los bytes originales de Git en el artefacto local; no existe diff versionado de vendors. El ajuste responsive reduce exclusivamente el espacio entre controles de Banners a 6px bajo 480px para acomodar el botón añadido sin solapar título/estado.

Índice de arquitectura: se actualiza para banner_deletions, archive_admin_banner e is_banner_archived. El test general test-architecture-registry.py falla en su regex de email por una URL adversarial ficticia heredada de scripts/test-request-push-sql.js:19; ese archivo no tiene cambios en esta H. No es PII real ni secreto ni defecto de Banners. Se clasifica NOT APPLICABLE a la aceptación focal solicitada; se conserva el diagnóstico, sin reparar pruebas de otras tareas. Freshness/lookup focal se verifica por separado. No se ejecutan suites globales funcionales.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin → Contenido → Banners.
Original/current sections: header/sidebar, crear, tarjetas ordenadas, miniatura/título/estado, activar, subir/bajar, editar, scroll, loading/error/empty.
Missing sections: ninguna.
Added sections: botón eliminar y modal con confirmación explícita.
Interactions/navigation preserved: PASS; diff confirma editor, load, toggle, move y acciones de otros recursos idénticos.
Visual structure preserved: PASS; ver local-1440.png y local-390.png.
Unauthorized redesign: NO.
Verdict: PASS.

## H-ADMIN-BANNERS-DELETE-001 RESULT

Status: PASS — implementación y validación focal; la publicación se acredita en production.json y publication.json al completar el despliegue.
Files changed: módulo visual focal; dos migraciones y dos recovery; cinco scripts focales; informe/evidencias; anexos de gobierno/changelog; Registry derivado; bundle y tokens HTML/worker.
Source-of-truth verdict: PASS; banners original + metadata de ciclo de vida, sin copia de contenido/fallback.
Invariant verdict: PASS; históricos, imágenes, ordenamiento, creación y activación preservados.
Build: PASS; 112 módulos, sólo screens-admin-visual-crud.jsx difiere dentro del bundle.
Tests: PASS focal; matriz SQL + Chrome aislado y autenticado + contrato Home + scope.
Security: PASS; permiso exacto backend, anónimo/normal/update-only denegados, actor y fecha auditados, metadata privada.
Legacy impact: NOT APPLICABLE; cero cambios Google/financieros.
Unexpected files changed: ninguno en release aislado; vendors sin diff, workspace previo preservado.
Known limitations: no confirmaciones destructivas persistentes sobre banners reales durante QA; no interfaz nueva de restauración (fuera de alcance); diagnóstico heredado del validador general del Registry explicado arriba.
Evidence: docs/qa/evidence/admin-banners-delete-20260908/.
