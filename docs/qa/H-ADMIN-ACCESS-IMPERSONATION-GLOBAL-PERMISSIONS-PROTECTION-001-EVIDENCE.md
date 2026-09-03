# H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-PROTECTION-001 — evidencia

## PRE-CHANGE AUDIT

```text
H: H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-PROTECTION-001
Objetivo: congelar el dominio aprobado como PROTECTED / CLOSED CONTRACT
Alcance: gobierno, contrato documental, metadata del Registry y regression guard focal
Fuera de alcance: UI, runtime, permisos, RLS/RPC, tablas, datos, migraciones funcionales, Supabase productivo, legacy y suites globales
Archivos a tocar: contrato, SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, AGENT_CHANGELOG, evidencia, architecture-overrides, Registry derivado y dos arneses focales
Datos afectados: ninguno
Fuentes de verdad: autoridades Supabase existentes de ADR-097, sin cambio
Tablas/APIs: sólo inspección y pruebas transaccionales con ROLLBACK
Legacy involucrado: no
Riesgo: documentación divergente o guard incapaz de ejecutarse tras actividad legítima
Tests: guard estático, matriz A–H, Chrome local, Registry y verificaciones de diff/secretos
Recovery: revertir el commit documental/técnico; no existe rollback de datos
Status: PASS
```

El alcance se amplió únicamente a `scripts/test-admin-access-impersonation-global-permissions-live.py` cuando su dry run confirmó que el recovery productivo, correctamente, ya se bloquea tras actividad administrativa legítima. El arnés ahora acepta tanto roundtrip previo a actividad como `RECOVERY_BLOCKED_POST_MIGRATION_ACTIVITY`; no se modificaron migraciones ni backend.

## SOURCE OF TRUTH AUDIT

```text
Domain: autorización administrativa, responsabilidades de sección e impersonación
Authority: admin_roles/admin_role_permissions/admin_assignments; admin_section_definitions/admin_section_responsibilities; impersonation_sessions y auditorías Supabase
Readers: AdminCutoverRepository/AdminRepository y RPC autorizadas
Writers: RPC backend de ADR-097 con has_admin_permission/has_section_action y auditoría
Alternative sources: ninguna
Fallbacks: ninguno
Caches: sólo proyección descartable de UI, no autoridad
Conflicts: ninguno
Verdict: SAFE
Evidence: ADR-097, migraciones 00120–00122, pruebas focales y docs/ADMIN_ACCESS_PROTECTED_CONTRACT.md
```

## SUPABASE SECURITY REVIEW

```text
Scope: protección documental/técnica del contrato vigente
Auth/business identity: sin cambio; email resuelve Auth y UUID persiste, numero_control no se sustituye
RLS/grants: sin cambio; matriz focal confirma denegación backend
Roles/privilege escalation: autoridades únicas preservadas; escalamiento implícito denegado
Frontend exposure: sin cambio; ningún secreto o service_role añadido
Cross-user access: usuario normal y anónimo denegados
Impersonation/audit: permiso explícito, actor/contexto, sesión, motivo, TTL, revocación y auditoría preservados
Tests: matriz A–H y Chrome real
Verdict: PASS
```

## Protección instalada

- Contrato canónico: `docs/ADMIN_ACCESS_PROTECTED_CONTRACT.md`.
- Decisión owner: `ADR-098` con estado `PROTECTED / CLOSED CONTRACT`.
- Invariantes: `INV-189`–`INV-198`.
- Registry: dominio `admin-authorization`, frontera protegida, SHA de origen y guard focal.
- Guard: `scripts/test-admin-access-protected-contract.js` verifica SHA aprobado, autoridades, invariantes, hashes de las tres migraciones y cobertura focal permanente.
- SHA protegido de origen: `b8c1f6c0057dabded90804ffadd5bd012fb41a1a`.

## Verificación

- `node scripts/test-admin-access-protected-contract.js`: `PASS`; 3 migraciones, 10 invariantes, contrato y prueba estática focal; suites globales no ejecutadas.
- `python scripts/test-admin-access-impersonation-global-permissions-live.py`: `PASS`; matriz A–H, `persistent_writes=0`, recovery `POST_ACTIVITY_BLOCKED`.
- `node scripts/test-admin-access-impersonation-global-permissions-browser.js`: `PASS`; Chrome real, desktop/móvil, 11 secciones, menú limitado, URL directa y usuario normal denegados, 0 errores.
- Comportamiento funcional: sin cambio.
- Datos productivos: sin cambio.
- Google, Apps Script, Ahorro, Préstamos y cálculos financieros: `NO INTERACTION`.
- Suite global: `NOT APPLICABLE / NOT EXECUTED`.
