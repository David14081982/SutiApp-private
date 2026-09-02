# H-SAVINGS-SHADOW-FOUNDATION-USER-UI-AND-ADMIN-001

## PRE-CHANGE AUDIT

- **Objetivo:** implementar la experiencia completa de Ahorro para afiliado y administración sobre una fundación Supabase separada, conservando la jerarquía visual de los adjuntos Claude Design.
- **Clasificación:** `SHADOW + NEW FOUNDATION`; no es cutover productivo del legacy.
- **Autoridad visual:** `C:\Users\david\Downloads\Ahorro por año.html` y la captura entregada por el propietario. Son autoridad de jerarquía, componentes, navegación y estilo; sus cifras, fórmulas y datos de demostración no son autoridad financiera.
- **Autoridad funcional:** solicitud del propietario incluida en `pasted-text.txt`, subordinada a la constitución y a las autoridades documentadas del repositorio.
- **Autoridad histórica/productiva de Ahorro:** Google Sheets + Apps Script, exclusivamente de lectura en esta H. Permanece vigente hasta un cutover posterior expresamente autorizado.
- **Nueva autoridad permitida:** tablas `public.savings_*` para datos importados con clasificación explícita, nuevas solicitudes shadow, auditoría y fundación futura. Ningún dato se promueve a `CANONICAL` sin evidencia certificada.
- **Identificador histórico:** `numero_control`/folio. El correo no se usa como reemplazo de identidad.
- **Escritores previstos:** RPCs `SECURITY DEFINER` con permiso técnico específico; importador fuera del navegador con `service_role`; ninguna escritura directa desde UI.
- **Lectores previstos:** RPCs de autoservicio limitados al afiliado efectivo y RPCs administrativas protegidas por permisos `savings.*`.
- **Fuentes prohibidas en runtime:** HTML adjunto, valores hardcodeados, mocks, fixtures, `DATA`, JSON de respaldo, localStorage y cualquier fallback silencioso.

## Evidencia de arquitectura y legacy

- Registry verificado `FRESH` mediante `scripts/generate-architecture-registry.py check`.
- Los alias `ahorro`/`savings` no describen aún una feature productiva; se hizo discovery dirigido sobre Finanzas, router, administración, permisos, repositorios, migraciones y auditoría legacy.
- Auditoría base: `docs/audits/H-SAVINGS-LEGACY-SYSTEM-FORENSIC-AUDIT-001.md`.
- Inventario legacy documentado, no importado: 363 folios de Ahorro, de los cuales 357 son candidatos resueltos, 5 ambiguos y 1 huérfano; 21 diferencias Q requieren revisión.
- En esta H no se consulta ni modifica Google. El importador sólo acepta un snapshot externo certificado, con hash y procedencia, y opera en dry-run salvo confirmación explícita.

## Contrato visual a preservar

1. Encabezado financiero borgoña y tarjeta principal superpuesta.
2. Saldo total, separación visible entre capital y rendimiento y, cuando aplique, disponible/retenido.
3. Detalle anual en tarjetas con capital, rendimiento y subtotal.
4. Datos de inscripción, próximos descuentos separados del historial real y etiquetas de estado.
5. Acciones `Unirme`, `Modificar monto`, `Retirar`, `Baja/continuar`, beneficiarios e historial, visibles sólo según disponibilidad resuelta por backend.
6. Flujos móviles en hojas/modales, confirmaciones y folio; comportamiento equivalente en 390 px, 430 px y escritorio.
7. Administración completa por secciones, sin simplificar módulos solicitados ni esconder estados `LEGACY`, `SHADOW` o `PENDING_REVIEW`.

## Alcance de archivos declarado

### Nuevos

- `supabase/migrations/20260902000100_savings_shadow_foundation.sql`
- `supabase/recovery/20260902000100_savings_shadow_foundation_recovery.sql`
- `app/savings-repository.js`
- `app/savings-store.jsx`
- `app/screens-savings.jsx`
- `app/screens-admin-savings.jsx`
- `scripts/import-savings-shadow.js`
- `scripts/test-savings-shadow-foundation.js`
- `scripts/test-savings-ui-browser.js`
- `scripts/verify-savings-shadow-foundation-live.js`
- `scripts/test-admin-productization.js` (actualizaciÃ³n del conteo contractual al incorporar Ahorro SHADOW)
- `scripts/test-universal-program-product-payment-simulator.js` (versiones de bundle/cache esperadas tras el rebuild)
- este documento de auditoría/evidencia

### Modificados

- `app/app.jsx`
- `app/screens-financiera.jsx`
- `app/admin-store.jsx`
- `app/admin-cutover-store.jsx`
- `app/screens-admin.jsx`
- `app/screens-admin-affiliates.jsx` sólo si la integración dirigida confirma un punto seguro para enlazar el contexto de Ahorro
- `scripts/build-bundle.js`
- `app/bundle.js` generado
- `SutiApp.html`
- `sw.js`
- documentación normativa estrictamente necesaria: `docs/SOURCE_OF_TRUTH.md`, `docs/INVARIANTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MAPPING.md`, `docs/MIGRATION_RULES.md`, `docs/SECURITY_RULES.md`, `docs/DECISIONS.md`, `docs/AGENT_CHANGELOG.md`
- archivos generados de `docs/architecture/` sólo porque cambia la arquitectura
- `docs/architecture/architecture-overrides.json` para aliases y fronteras semánticas demostradas de Ahorro

Los cambios preexistentes observados antes de iniciar esta H se preservan y se distinguirán en la evidencia final.

## RISK

| Riesgo | Control previo a implementar |
|---|---|
| Convertir shadow en una segunda autoridad productiva | clasificación visible, ninguna sincronización automática con Google y ausencia de cutover |
| Alterar cálculos legacy | no copiar fórmulas; calendario nuevo parametrizado y primera fecha exigida explícitamente |
| Inventar reglas JUB | capacidad de omisiones incluida, regla de cuatro faltas deshabilitada para JUB hasta decisión |
| Usar Q como saldo | Q sólo se conserva como `LEGACY_REPORTED_BALANCE` y se concilia contra ledger |
| Sobrescribir historia | ledger y evidencia append-only; correcciones con ajuste/reversión e idempotencia |
| Acceso cruzado o elevación UI | RLS, RPCs por usuario efectivo, permisos técnicos y pruebas negativas |
| Exponer `service_role` | importador Node separado; cliente y bundle nunca reciben la llave |
| Simplificar Claude Design | matriz de componentes, pruebas responsive y guardian visual antes del cierre |
| Migración irreversible | SQL aditivo; recovery bloquea si existe historia legítima y sólo revierte una instalación vacía |
| Regresión global de imágenes | build y regresión obligatoria local/GitHub Pages al tocar `bundle.js`/`sw.js` |

## Decisiones conservadoras de implementación

- La primera fecha esperada no se infiere: la inscripción no puede activarse sin `first_expected_contribution_date` explícita.
- JUB usa capacidad de calendario mensual día 5; PROCESS_1/PROCESS_3 usan días 15 y cierre contractual 28/29/30. Esto no autoriza reconstruir periodos históricos.
- El rendimiento semestral queda modelado y aprobable, pero `productive_enabled = false`; no se acreditará automáticamente.
- Una ausencia genera `MISSING` o `PARTIAL`, nunca deuda automática.
- Un cambio de PROCESS genera `SAVINGS_PROCESS_CHANGE_REVIEW_REQUIRED`; no modifica planes pasados ni futuros sin revisión administrativa.
- Identidades ambiguas/huérfanas conservan `affiliate_id = NULL`. Resolver identidad sólo enlaza el afiliado y no muta movimientos ni procedencia.

## Gates antes de implementar

- `pre-change-audit`: **PASS**.
- `source-of-truth-guardian`: **PASS CONDICIONAL** a mantener Google como autoridad vigente y shadow explícito.
- `legacy-google-guardian`: **SAFE CHANGE** para código/migración local; escritura Google prohibida.
- `database-migration-guardian`: **PASS / PREPARED_NOT_APPLIED**; forward, matriz funcional y recovery verificados juntos con `ROLLBACK`, sin persistencia.
- `supabase-security-review`: **PASS**; RLS forzada, tablas sin DML browser, grants mínimos, aislamiento self y lectura Admin probados.
- `claude-ui-preservation-guardian`: **PASS**; jerarquía borgoña/blanco, saldo por componentes, tarjetas anuales, flujos, 17 módulos Admin y responsive comparados en captura.

## Estado de implementación

## Evidencia de cierre

- Build reproducible: `node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js` → 99 fuentes; `node --check` en bundle, repository, importador y pruebas → `PASS`.
- SHA-256 bundle: `7927349EC241A850592CB68C49B1803A022FFFCD64821315AD449B732FA797EF`.
- Suite estática: `node scripts/test-static-suite.js` → `82/82 PASS`.
- Ahorro estático/modelo: `node scripts/test-savings-shadow-foundation.js` → schema/recovery, identidad, calendario, ledger, acciones, RLS/RPC y UI `PASS`.
- SQL vivo no persistente: `node scripts/verify-savings-shadow-foundation-live.js` → `DRY_RUN_FORWARD_RECOVERY PASS`, 17 tablas y 12 contratos funcionales —incluidos expected/actual 500→500, 500→350, 500→0 e idempotencia—, `dataRowsChanged=0`, `productionApplied=false`.
- Chrome: `node scripts/test-savings-ui-browser.js` → self 390×844, 430×932 y 1366×900; saldo 48,315.20 separado en 43,000.00/5,315.20, retenido 500.00, dos años, calendario/historia separados, tres acciones habilitadas, cambio de monto, retiro total de capital disponible, beneficiarios 100 %, back y cero writers reales. Admin: 17 secciones, 10 KPI, autoridad Google visible e identidad pendiente mínima con coincidencias exactas/expediente financiero y sin nombre legacy.
- Capturas: `docs/qa/evidence/savings-shadow-20260902/`; inspección visual final `PASS`, sin clipping, secciones perdidas, placeholder productivo ni rediseño ajeno a la autoridad.
- Regresión global protegida: build local/cache `sutiapp-v133` y GitHub Pages/cache `sutiapp-v132` → `PASS`; 147 assets públicos, 29 legacy, expediente/préstamo/membresía, Admin, 248 assets de catálogo, Marketplace, logos, fullscreen, refresh, PDF y sin service worker; mutaciones productivas 0.
- Registry: generate/incremental + check → `FRESH`; lookup `ahorro` → dominio `finance`, sin fallback global.
- `git diff --check` → sin errores; sólo avisos de normalización LF/CRLF ya configurada.

```text
H-SAVINGS-SHADOW-FOUNDATION-USER-UI-AND-ADMIN-001 RESULT
Status: PASS — implementación completa preparada; activación productiva no ejecutada
Files changed: UI/Repository/Store self y Admin; SQL/recovery; importador; bundle/cache; pruebas; gobierno/Registry/evidencia
Source-of-truth verdict: PASS — Google Ahorro permanece productivo; public.savings_* es SHADOW explícito; fallback 0
Invariant verdict: PASS — INV-174..182 y contrato visual preservados
Build: PASS — 99 fuentes; SHA-256 7927349EC241A850592CB68C49B1803A022FFFCD64821315AD449B732FA797EF
Tests: PASS — 82/82 static; SQL forward/functional/recovery; Chrome self/Admin; global images local/Pages
Security: PASS preparado — RLS/RPC/grants/aislamiento/idempotencia; service_role fuera del frontend
Legacy impact: NO INTERACTION — Google read 0 / write 0 / Apps Script change 0 / formulas changed 0
Unexpected files changed: 0 por esta H; se preservaron cambios preexistentes listados abajo
Known limitations: migration/import/cutover no aplicados; rendimiento productivo y cuatro omisiones JUB requieren decisión owner
Evidence: este documento + docs/qa/evidence/savings-shadow-20260902/
```

## Inventario y decisiones operativas

- Importados esperados del inventario forense: 357 resueltos, 5 ambiguos, 1 huérfano; importados reales en esta H: **0**.
- Migración `20260902000100`: **PREPARED_NOT_APPLIED**. Aplicación productiva requerida para activar: **sí, con autorización separada**.
- Importador: dry-run por defecto; `--apply` exige manifest certificado, `service_role` fuera del browser y confirmación `SHADOW_ONLY_NO_CUTOVER`.
- Decisiones owner aún abiertas: regla definitiva de primera aportación por escenario, automatización de cuatro faltas JUB y contrato de rendimiento semestral. La implementación falla cerrada sin ellas.
- No se realizó commit, push, deploy, importación, cutover ni escritura financiera/Google.

## Cambios preexistentes preservados

Antes de iniciar ya estaban modificados `AGENTS.md`, `docs/AGENT_CHANGELOG.md`, `docs/INVARIANTS.md` y los JSON generados del Registry; además ya existían sin seguimiento `docs/qa/H-GLOBAL-IMAGE-REGRESSION-ROOT-CAUSE-001-EVIDENCE.md`, `scripts/test-global-image-regression-production-live.js` y `scripts/test-protected-image-contract.js`. Esta H sólo agregó contenido dirigido en los documentos compartidos/regenerados y no alteró los tres archivos preexistentes sin seguimiento.
