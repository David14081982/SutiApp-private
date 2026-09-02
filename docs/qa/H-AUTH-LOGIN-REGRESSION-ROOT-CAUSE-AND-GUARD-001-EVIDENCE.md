# H-AUTH-LOGIN-REGRESSION-ROOT-CAUSE-AND-GUARD-001 — Evidencia

Fecha: 2026-09-01
Estado: `PASS / DEPLOYED / VERIFIED`

## Alcance

Corregir el tratamiento visible de una indisponibilidad de Auth, identificar exactamente la regresión posterior a la última certificación, agregar la prueba que faltaba y bloquear permanentemente un despliegue frontend incompatible con Supabase. No hubo DDL, DML, migración, escritura de negocio ni interacción con Google/Apps Script.

## Última certificación y último smoke anterior

- Certificación dedicada H-005/Phase 1: `docs/AUTH_AFFILIATE_PHASE1_CERTIFICATION.md`, incorporada en `1b1fd9082e7019025bd3529e744fd1b53dff24a9`. Certificó login válido, rechazo inválido, refresh, sesión y logout con navegador y RLS reales.
- Último flujo productivo posterior que atravesó login antes de la regresión: `4a6eb56fd2ad219dca8f12fd7e23ac50836eaaaf`, 2026-08-30, E2E de solicitud de préstamo.

## Commit, archivo y línea causantes

- Commit: `dfa9d9016531f2175c78a15b26e2e6925a0135cc` — `feat(admin): add affiliate archive lifecycle`.
- Archivo: `app/affiliate-repository.js`.
- Líneas introducidas: llamada obligatoria a `client.rpc('get_current_affiliate_access_state')` y validación `ACTIVE|ARCHIVED` al inicio de `getCurrentAffiliate`.
- Demostración: `git log -S "get_current_affiliate_access_state" -- app/affiliate-repository.js` devuelve únicamente `dfa9d901…`; `git blame` atribuye las líneas 73–80 al mismo commit.

`app/affiliate-auth.js` no originó la incompatibilidad backend: recibió el `SOURCE_ERROR` del repository y lo publicó como `phase=error/errorCode=CONNECTION_ERROR`, que produjo el mensaje observado.

## Contrato roto

La cadena afectada fue:

```text
Supabase Auth válido
→ AffiliateAuth.resolveSession
→ AffiliateRepository.getCurrentAffiliate
→ get_current_affiliate_access_state [nuevo y obligatorio]
→ get_effective_affiliate_id
→ public.affiliates
→ shell autenticado
```

El commit se publicó mientras su propia evidencia declaraba `MIGRATION_PREPARED_NOT_APPLIED` y `Production authorization required: YES`. El workflow `.github/workflows/deploy-pages.yml` despliega cada push a `main` y, en ese momento, no verificaba dependencias backend. Pages recibió el cliente nuevo antes de que producción recibiera `20260901000200`; PostgREST respondió función ausente (`404/PGRST202`) y toda credencial válida falló durante la resolución de identidad.

La aplicación posterior y verificación de `20260901000200` restauraron el login sin cambiar credenciales ni datos: esto confirma causalidad de orden de despliegue, no contraseña incorrecta ni caída general de Supabase.

## Por qué una H de Archivo tocó Login

El archivo lógico debía impedir que un afiliado archivado iniciara nuevas operaciones. Esa regla pertenece correctamente al límite compartido de identidad efectiva, que se ejecuta al resolver cualquier sesión. Por eso H-ADMIN-AFFILIATE-ARCHIVE-AND-DIGITAL-FILE-001 modificó Login indirectamente. El error no fue ubicar allí la validación, sino desplegar el consumidor obligatorio antes que su proveedor productivo sin gate de compatibilidad.

## Test faltante

`scripts/test-h005.js` sustituía por completo `window.AffiliateRepository.getCurrentAffiliate`. Probaba el controlador Auth, incluida una excepción artificial, pero no cargaba `app/affiliate-repository.js` ni podía descubrir un RPC nuevo o ausente. La H de Archivo probó migración y lifecycle dentro de `ROLLBACK`; no ejecutó antes del push un E2E de Auth contra el frontend desplegable y el schema productivo aún vigente.

## Protección permanente

1. `scripts/test-auth-session-regression.js` carga el repository real y verifica los cuatro RPC de la ruta Auth, login válido, inválido, función ausente controlada, sesión restaurada, refresh y logout.
2. `scripts/verify-auth-deployment-contract-live.js` prueba antes del build que `get_current_affiliate_access_state`, `get_effective_affiliate_id`, `get_impersonation_context` y `get_admin_access_context` existen y niegan ejecución anónima.
3. `.github/workflows/deploy-pages.yml` ejecuta ese gate antes de build/upload/deploy. `PGRST202/404`, respuesta inesperada o `2xx` anónimo bloquean Pages.
4. `scripts/test-auth-deployment-contract.js` prueba el gate, su orden en el workflow y los casos función ausente/exposición anónima.
5. `app/affiliate-auth.js` muestra el error institucional también cuando un fallo de red ocurre durante `signIn` y mantiene visible “Intentar nuevamente”.
6. `scripts/test-affiliate-login-production-live.js` ejecuta la matriz completa sin escribir datos de negocio y sin revelar credenciales o identidad.

## Evidencia ejecutada

### Contrato productivo anónimo

```json
{"status":"PASS","contract":"AUTH_BACKEND_COMPATIBLE_AND_ANON_DENIED","rpcs":[{"rpc":"get_current_affiliate_access_state","status":401,"verdict":"PRESENT_DENIED"},{"rpc":"get_effective_affiliate_id","status":401,"verdict":"PRESENT_DENIED"},{"rpc":"get_impersonation_context","status":401,"verdict":"PRESENT_DENIED"},{"rpc":"get_admin_access_context","status":401,"verdict":"PRESENT_DENIED"}]}
```

### Integración con repository real

```json
{"status":"PASS","repository":"ACTUAL_AFFILIATE_REPOSITORY","validLogin":true,"invalidCredentials":true,"missingRpcControlled":true,"restoredSession":true,"refresh":true,"logout":true}
```

### Chrome: build corregido + Auth productivo

```json
{"status":"PASS","target":"LOCAL_BUILD_WITH_PRODUCTION_AUTH","validLogin":true,"invalidCredentials":{"errorCode":"INVALID_CREDENTIALS","controlledMessage":true},"unavailableService":{"errorCode":"CONNECTION_ERROR","controlledMessage":true,"retryVisible":true},"refresh":true,"session":true,"logout":true,"viewports":[{"width":390,"validLogin":true,"layout":true,"refresh":true,"session":true,"logout":true,"pageErrors":0},{"width":430,"validLogin":true,"layout":true,"refresh":null,"session":null,"logout":null,"pageErrors":0},{"width":1280,"validLogin":true,"layout":true,"refresh":null,"session":null,"logout":null,"pageErrors":0}]}
```

La prueba de servicio no disponible abortó exclusivamente el request `auth/v1/token` dentro del navegador. La prueba inválida usó la cuenta controlada con una contraseña deliberadamente incorrecta. Ninguna prueba creó, editó, archivó, restauró o eliminó una fila.

### Suite, build y arquitectura

```text
Built app\bundle.js from 95 files.
{"status":"PASS","total":80,"failures":[]}
FRESH
PASS generation freshness stale lookup screen table column reverse admin permissions tests fallback incremental secrets determinism
```

`test-claude-ui-preservation.js` pasó dentro de la suite. La única modificación visible conserva estructura, estilos y copy existentes; amplía el mismo mensaje de conexión y el control de reintento al fallo ocurrido durante submit.

### Secret / PII preflight

```text
ADDED_CONTENT_PREFLIGHT secret_value_hits=0 non_test_email_hits=0
supabase.env ignored=true tracked=false
```

Los runners leen credenciales controladas únicamente desde `supabase.env` ignorado, nunca las imprimen y no incluyen nombre, UUID, número de control ni email en su salida. El gate de Pages recibe sólo URL y publishable key mediante secrets ya existentes del workflow.

## Matriz requerida

| Caso | Release candidate local contra Auth productivo | GitHub Pages público |
|---|---:|---:|
| Login válido | PASS | PASS |
| Credenciales inválidas / copy correcto | PASS | PASS |
| Servicio no disponible / error controlado | PASS | PASS |
| Refresh | PASS | PASS |
| Sesión persistente | PASS | PASS |
| Logout + reload | PASS | PASS |
| 390 / 430 / desktop | PASS | PASS |

### GitHub Pages productivo

- Commit local y remoto: `053d49a8ba57436b51c094ea6c1b01e789858a20`.
- Workflow: `33584782213`, conclusión `success`.
- Los pasos `Verify Auth backend compatibility`, build, upload y deploy finalizaron `success` en ese SHA.

```json
{"status":"PASS","target":"GITHUB_PAGES_PRODUCTION","validLogin":true,"invalidCredentials":{"errorCode":"INVALID_CREDENTIALS","controlledMessage":true},"unavailableService":{"errorCode":"CONNECTION_ERROR","controlledMessage":true,"retryVisible":true},"refresh":true,"session":true,"logout":true,"viewports":[{"width":390,"validLogin":true,"layout":true,"refresh":true,"session":true,"logout":true,"pageErrors":0},{"width":430,"validLogin":true,"layout":true,"refresh":null,"session":null,"logout":null,"pageErrors":0},{"width":1280,"validLogin":true,"layout":true,"refresh":null,"session":null,"logout":null,"pageErrors":0}]}
```

## Cierre

```text
H-AUTH-LOGIN-REGRESSION-ROOT-CAUSE-AND-GUARD-001 RESULT
Status: PASS
Files changed: Auth UI state, bundle/cache, deployment gate, regression/live tests, architecture/governance evidence
Source-of-truth verdict: PASS — Supabase Auth + public.affiliates remain authoritative; no fallback
Invariant verdict: PASS — deployment-order invariant enforced before Pages
Build: PASS — GitHub Pages workflow 33584782213 on 053d49a8
Tests: PASS — 80/80 static; repository integration; backend contract; public E2E full matrix
Security: PASS — required RPCs present and anon denied; no privileged secret in gate/frontend
Legacy impact: NO INTERACTION
Unexpected files changed: 0
Known limitations: none for the requested Login/Auth matrix
Evidence: this file
```
