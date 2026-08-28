# H-ADMIN-AFFILIATES-MODULE-001 — evidencia

Fecha: 2026-08-27
Estado: `PASS`

## Alcance y autoridad

- Autoridad única: `public.affiliates`; conteo inicial/final 947.
- Auth separada: 3 cuentas antes/después; ninguna creada, vinculada, revocada o eliminada.
- Writers: RPC con `affiliates.write`, motivo, campos allowlisted, validación y versión optimista.
- Auditoría: `affiliate_admin_events` con RLS forzada y sin grants directos de escritura; `affiliate_profile_audit_log` se reutiliza para campos del perfil.
- Exportación: `DataExportRepository → data-exports`; dominio `affiliates`, XLSX allowlisted, `data_exports.read`, `no-store`, auditoría de metadatos.
- Legacy: Google Sheets, Apps Script, Ahorro, Préstamos, fórmulas, saldos, amortización y conciliación: `NO READ / NO WRITE / NO CHANGE`.

## Migración y recuperación

```text
python scripts/test-admin-affiliates-migration-live.py
PASS — forward + checks + recovery compilaron en transacción; persistent_writes=0

python scripts/test-admin-affiliates-migration-live.py --apply
PASS — applied=true; affiliates 947→947; auth_users 3→3; admin_rows=0; business_rows_changed=0
```

`20260827001200_admin_affiliates_workbench_recovery.sql` falla cerrado si existe una alta `ADMIN_AFFILIATES` o auditoría. No se ejecutó recovery productivo después del corte exitoso.

## Build y contratos

```text
node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js
Built app\bundle.js from 93 files.

node scripts/test-admin-affiliates.js
Admin affiliates productive workbench static contract PASS

node scripts/test-static-suite.js
53 PASS / 1 FAIL preexistente ajeno
```

El único fallo es `test-pages-deployment.js`: espera `navigator.serviceWorker.register('sw.js')`, mientras el `SutiApp.html` ya modificado antes de esta H usa comillas dobles. Ese archivo y dos evidencias del workbench financiero fueron preservados y no forman parte del cambio.

## CRUD real sin persistencia

```text
python scripts/test-admin-affiliates-live.py
PASS
server_pagination=true
create=true
duplicate_review=true
update=true
status_change=true
reactivation=true
audit_events=4
persistent_writes=0
affiliates_after=947
```

La matriz fijó el `auth.uid()` del administrador real, ejecutó todos los writers dentro de una única transacción y terminó con `ROLLBACK`. Verificó origen Admin, procedencia histórica nula, read-back, dos eventos de estado y auditoría por campo.

## Navegador real y privacidad

```text
node scripts/test-admin-affiliates-browser.js
PASS — Chrome real
```

Verificado con sesión Admin real: tarjeta/módulo, 25 filas por página, total 947, búsqueda server-side, selección, seis pestañas, dominio exportable autorizado, botón XLSX, denegación usuario normal/anónimo y cero page errors/escrituras inesperadas.

| Viewport | Overflow viewport | Overflow workbench | Resultado |
|---|---:|---:|---|
| 1024×768 | No | No | PASS |
| 1280×900 | No | No | PASS |
| 1440×1000 | No | No | PASS |
| 430×932 | No | No | PASS |

No se capturaron pantallas ni se descargó el XLSX de Afiliados para evitar persistir PII localmente. `playwright-result.json` contiene únicamente métricas agregadas. El motor XLSX se validó con el dominio no sensible `news`, y el GET autorizado confirmó `affiliates` en el allowlist:

```text
python scripts/test-data-exports-live.py
PASS — xlsx=true; audit_log=true; no-store; anonymous/normal/cross-domain denied; cleanup=true; secrets_exposed=0
```

## Preservación Claude UI

`claude-ui-preservation-guardian`: `PASS`. Se preservaron shell, sidebar, headers, breakpoints, Document Workbench, Requests Workbench y Financial Workbench. El nuevo módulo incorpora todos los bloques descritos en la especificación: padrón, toolbar, filtros, perfil, tabs, expediente, solicitudes, acceso, auditoría, modales, estados y acciones. No hay `PENDING`, `DISABLED`, `PLACEHOLDER` ni `NO_CONNECTED` como sustituto funcional. El archivo citado “Afiliados - demo.html” no fue adjuntado ni existe en el repo; por ello no se afirma comparación pixel-perfect contra ese artefacto ausente.

## Architecture Registry

Estado de esta H: `UPDATED`. Se regeneraron los hechos del repository, pantallas, RPC, tabla de auditoría, permisos, pruebas y gobierno. La comprobación local informa exclusivamente `STALE changed=["SutiApp.html"]`; ese drift pertenece al archivo preexistente modificado por otra H y fue preservado. El Registry versionado conserva deliberadamente el fingerprint de `HEAD` para no publicar como propia una modificación ajena; al aplicar este commit sobre `origin/main`, el índice queda coherente.

## Resultado

```text
H-ADMIN-AFFILIATES-MODULE-001 RESULT
Status: PASS
Files changed: app/migration/recovery/tests/docs/evidence declarados
Source-of-truth verdict: PASS
Invariant verdict: PASS
Build: PASS
Tests: PASS del alcance; 1 fallo preexistente ajeno documentado
Security: PASS
Legacy impact: NOT APPLICABLE
Unexpected files changed: 3 preexistentes, preservados y excluidos
Known limitations: demo HTML ausente; QA no persistió PII ni descargó el padrón
Evidence: este documento + playwright-result.json agregado
```
