# Authenticated loan snapshot RPC result

Fecha: 2026-08-26
H: `H-LOAN-AUTHENTICATED-SNAPSHOT-RPC-013`
Estado: `PASS`

## Alcance y autoridad

El propietario autorizó exclusivamente sacar la cotización interactiva monto/fondo/plazo de la ruta Edge inestable. Google `Criterios de fondos` conserva elegibilidad, fondo, tasa, máximo y plazo; Supabase conserva perfil y política; `financial_session_snapshots` sigue siendo una copia `DERIVED`, personalizada y expirable a 15 minutos. No se modificó Google Sheets, Apps Script, una regla financiera, datos históricos ni el diseño Claude.

Flujo final:

```text
OPEN    browser → financial-legacy Edge → Google → personalized snapshot
QUOTE   browser → authenticated RPC → validated snapshot → certified resolver
CONFIRM browser → financial-legacy Edge → current profile/Google/policy
        → same certified resolver → atomic request creation
```

## Contrato matemático certificado

El contrato existente auditado quedó centralizado en `resolve_suti_loan_quote_contract`:

- `interest = round(amount × rate_factor × term, 2)`;
- `administrativeFeePerPayment = 15`;
- `administrativeFeeTotal = round(15 × term, 2)`;
- `total = round(amount + interest + administrativeFeeTotal, 2)`;
- `paymentPerPeriod = round(total ÷ term, 2)`;
- monto positivo y no mayor al máximo Google;
- fondo disponible y perteneciente al perfil efectivo;
- plazo entre mínimo Supabase y máximo Google, alineado al paso autorizado;
- `numeric` PostgreSQL, redondeo de moneda a centavos;
- `termOptions` y resultado principal producidos por el mismo resolver.

Edge dejó de calcular esas salidas en TypeScript. Cotización RPC, confirmación, aprobación y rutas legacy delegan al mismo resolver `SUTI_LOAN_QUOTE_V1`; frontend calcula cero valores financieros.

## Migración, seguridad y recovery

- Forward: `20260826000100_authenticated_loan_snapshot_quote_rpc.sql` — `PASS` en dry run y aplicada sin modificar filas protegidas.
- Recovery: `20260826000100_authenticated_loan_snapshot_quote_rpc_recovery.sql` — `PASS` antes y después de aplicar, siempre dentro de `ROLLBACK`.
- Backup Edge anterior: 597,978 bytes; SHA-256 `942f5b09961b24d563a50613365dbda6a04e7102041fc9ddfd5d87255f36a5d7` en almacenamiento temporal local de recuperación.
- Edge activa: `financial-legacy` v20, JWT verificado, bundle hash `7cfe83ef80b4cb37244a35ca8d684f02fa7d604c3e2886543de66104f6ce649c`.
- RPC pública a PostgREST: sólo `authenticated`; cuatro parámetros.
- Resolver interno: ejecución directa sólo `service_role`.
- Tabla snapshot: RLS forzada, policies browser 0, lectura directa 0, escritura directa 0.
- Inputs de tasa/máximo adicionales: rechazados por firma.
- Cross-user A→B y B→A, anonymous, expirado, profile mismatch e impersonation mismatch: `DENIED`.
- No se exponen secretos, `service_role`, perfil, tasa, máximo o elegibilidad desde frontend.

Recovery operativo: revertir primero frontend/Edge al commit anterior y después ejecutar la migración recovery. Las funciones se retiran sin tocar snapshots, solicitudes, afiliados o históricos.

## Equivalencia y legacy

Matriz live antes y después de Edge v20:

- usuarios: 2;
- perfiles sindicato/categoría distintos: 2;
- casos financieros: 54;
- casos inválidos: 8;
- fondos, mínimos, máximos, decimales y plazos distintos: cubiertos;
- diferencias financieras: 0;
- diferencias de validación: 0;
- diferencias de redondeo: 0;
- Google interactive calls: 0;
- Google writes: 0;
- Apps Script changes: 0.

RPC tras snapshot READY: mediana 142 ms, máximo 178 ms en la retest final controlada. La ruta Edge de equivalencia fue más lenta y ya no forma parte del camino interactivo del navegador.

La prueba de confirmación volvió a leer Google (`confirm_google_calls: 1`), detectó condiciones cambiadas, creó 0 solicitudes y dejó `failed_confirmation_persisted_requests: 0`. La frontera atómica final permanece intacta.

## Frontend, PWA y publicación

Bundle reproducible desde 90 fuentes con Babel Standalone 7.29.0; `bundle.js?v=147`, repository v5, PWA cache v91. La composición, SmoothMoney, odómetro, latest-intent-wins, resultado anterior visible y estados controlados no cambiaron.

GitHub Pages workflow `32987656026`: `PASS`, 47 s. URL probada:

https://david14081982.github.io/SutiApp-private/

Chrome público escritorio:

- login/PWA/READY: `PASS`;
- amount/fund/term: `PASS`;
- 10 cambios rápidos: `PASS`;
- RPC interactivas: 4;
- Edge interactivas: 0;
- Google interactivas: 0;
- ciclos de odómetro: 4;
- frames vacíos: 0;
- stale renders: 0.

Chrome público móvil equivalente 390×844 con touch:

- login/PWA/READY: `PASS`;
- amount/fund/term: `PASS`;
- 10 cambios rápidos: `PASS`;
- RPC interactivas: 4;
- Edge interactivas: 0;
- Google interactivas: 0;
- ciclos de odómetro: 4;
- frames vacíos: 0;
- stale renders: 0.

## Cierre

```text
H-LOAN-AUTHENTICATED-SNAPSHOT-RPC-013 RESULT
Status: PASS
Files changed: migration/recovery; financial Edge; FinancialLegacyRepository; retry control; PWA bundle/version; tests; normative docs; Architecture Registry
Source-of-truth verdict: PASS — Google authority preserved; snapshot/RPC remain derived and non-authoritative
Invariant verdict: PASS — INV-088/INV-107 narrowly updated under owner authorization
Build: PASS — 90-source reproducible bundle; v147/repository v5/PWA v91
Tests: PASS — static 44/44; live equivalence/security; local Chrome; public desktop/mobile
Security: PASS — Auth-only RPC; full actor/context/TTL/profile/policy validation; direct table access 0
Legacy impact: READ ONLY — open/confirm Google preserved; interactive Google 0; Sheets writes 0; Apps Script changes 0
Unexpected files changed: none
Known limitations: no successful production-like loan was persisted during QA; final Google fail-closed path and zero-persistence invariant were verified without contaminating history
Evidence: 54 financial + 8 invalid cases; mismatches 0; public RPC 4/Edge 0/Google 0 per viewport; blank 0; stale 0
```
