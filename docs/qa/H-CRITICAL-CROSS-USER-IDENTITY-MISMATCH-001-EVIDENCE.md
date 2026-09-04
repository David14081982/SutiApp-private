# H-CRITICAL-CROSS-USER-IDENTITY-MISMATCH-001 — evidencia

Fecha: 2026-09-04

## Alcance y autoridad

- Alcance: `auth.users.id → affiliates.auth_user_id → get_current_affiliate_access_state()/get_effective_affiliate_id() → AffiliateRepository.getCurrentAffiliate() → AffiliateAuth.resolveSessionOnce()`.
- Autoridades preservadas: Supabase Auth para autenticación; `public.affiliates` para afiliación/vínculo; `impersonation_sessions` para la única excepción contextual.
- Datos: cero reasignaciones, merges, deletes, backfills o correcciones de filas. La migración reemplaza sólo tres funciones.
- Fuera de alcance: Google, Apps Script, fórmulas, saldos, cálculos financieros, catálogos, documentos maestros y rediseño UI.

## Auditoría productiva read-only

La auditoría enmascarada inmediatamente anterior/posterior al apply registró:

| Control | Resultado |
|---|---:|
| usuarios Auth | 71 |
| vínculos `affiliates.auth_user_id` | 67 |
| vínculos con email Auth/histórico distinto o Auth no confirmado | 0 |
| `auth_user_id` con múltiples filas | 0 |
| identidades ya vinculadas cuyo email histórico es ambiguo | 0 |
| grupos de email histórico duplicado | 7 |
| impersonaciones activas | 0 |
| claims exitosos auditados | 71 |
| claims que ya no corresponden al vínculo vigente | 0 |
| actores con claims exitosos sobre más de un afiliado | 0 |

Los identificadores de casos afectados reportados no fueron incluidos en la orden. Por ello no es posible atribuir retrospectivamente un `EXPECTED_AFFILIATE_ID` a una persona concreta sin inventar evidencia. El snapshot vigente no contiene vínculos incorrectos que reparar.

## Causa raíz demostrada

1. `claim_affiliate_identity()` contaba únicamente filas `eligible AND NOT is_archived`. En cinco de los siete grupos duplicados productivos existe una sola fila elegible; por tanto el claim podía seleccionar esa fila aunque el correo correspondiera históricamente a más de un afiliado.
2. `get_effective_affiliate_id()` aceptaba cualquier vínculo ya escrito por `auth_user_id` y `get_current_affiliate_access_state()` devolvía `ACTIVE` sin volver a validar email Auth confirmado, coincidencia exacta o unicidad global.
3. Toda lectura self-service deriva del afiliado efectivo. Un vínculo erróneo ya existente podía propagarse coherentemente a perfil, documentos, solicitudes, foto y finanzas; el chequeo cliente previo era tardío y no validaba correo/unicidad.
4. No hubo evidencia de impersonación anómala, múltiples vínculos vigentes ni claims históricos a targets múltiples.

## Corrección

- `20260904000100_cross_user_identity_fail_closed.sql` hace que una sesión normal sólo sea `ACTIVE` y obtenga UUID efectivo con vínculo exacto, email confirmado coincidente y cardinalidad histórica global igual a uno.
- El claim cuenta todas las filas antes de elegibilidad: `count <> 1 → AFFILIATE_IDENTITY_AMBIGUOUS`; no usa primera fila, nombre, ordinal o `numero_control`.
- `AffiliateRepository` repite la aserción principal/fila; en impersonación valida actor y usuario contexto devueltos por backend.
- `AffiliateAuth` cierra/rechaza la sesión con `identity_error` antes de montar `App`. No existe fallback a otro afiliado.
- La impersonación protegida ADR-098 conserva permiso explícito, `session_id`, TTL, actor real, usuario contexto y auditoría.

## Matriz y evidencia ejecutada

| Caso | Evidencia | Resultado |
|---|---|---|
| A–C, tres usuarios → perfil efectivo propio | matriz SQL transaccional sobre tres vínculos reales, IDs no impresos | PASS |
| D, email ambiguo | duplicado transaccional; estado `AMBIGUOUS_IDENTITY`, efectivo `NULL`, claim denegado | PASS |
| E, Auth sin afiliado | vínculo retirado/restaurado dentro de `ROLLBACK`; `UNLINKED` y efectivo `NULL` | PASS |
| F, afiliado sin Auth | mismo escenario transaccional desde la fila; acceso denegado hasta claim válido | PASS |
| G, vínculo incorrecto | email divergente dentro de `ROLLBACK`; `IDENTITY_MISMATCH` y efectivo `NULL` | PASS |
| H, impersonación autorizada | matriz protegida Admin A–H | PASS |
| I, terminar impersonación | matriz protegida; contexto cerrado y actor restaurado | PASS |
| J, login/refresh/logout/login | controlador Auth local existente + evento `TOKEN_REFRESHED`; credencial productiva QA disponible quedó inválida | PASS local / BLOCKED live fixture |
| perfil ajeno | RLS con rol `authenticated` | DENIED |
| profile photo ajena | RLS sobre `affiliate_files` | DENIED |
| documentos ajenos | RLS sobre `affiliate_files` y matriz documental transaccional | DENIED |
| solicitudes ajenas | RLS sobre `program_requests` | DENIED |
| ahorro ajeno | tabla sin privilegio browser / RPC ligada a efectivo | DENIED |

Comandos principales:

```text
node scripts/test-cross-user-identity-guard.js
node scripts/apply-cross-user-identity-guard.js
node scripts/apply-cross-user-identity-guard.js --apply
python scripts/test-admin-access-impersonation-global-permissions-live.py
node scripts/test-h005.js
```

El forward, las comprobaciones, el recovery y el retorno al forward compilaron en transacciones con `ROLLBACK`. El apply informó `affiliate_rows_changed: 0`. `scripts/test-loan-document-context-isolation-live.py` no ejecutó su matriz porque `H005_TEST` falló en login antes de cualquier lectura/escritura; no se cambió la contraseña ni la cuenta para forzar la prueba.

## Cierre

```text
H-CRITICAL-CROSS-USER-IDENTITY-MISMATCH-001 RESULT
Status: PASS (backend productivo); frontend pendiente de publicación/verificación en esta evidencia intermedia
Files changed: identidad/RPC, repository/Auth, cachebusters, pruebas, ADR/invariantes/evidencia y Registry derivado
Source-of-truth verdict: PASS — Auth + affiliates preservados; cero autoridad paralela
Invariant verdict: PASS — INV-207
Build: PASS — bundle reproducible
Tests: PASS focal; fixture login live H005_TEST inválida registrada sin mutación
Security: PASS — fail-closed backend/RLS; anon denegado; impersonación protegida
Legacy impact: NOT APPLICABLE — cero lectura/escritura Google o cálculo financiero
Unexpected files changed: cambios previos del propietario preservados y excluidos
Known limitations: no se recibieron IDs de casos afectados; no es posible reconstruir su expected mapping sin evidencia
Evidence: este documento y salidas JSON enmascaradas de los scripts focales
```
