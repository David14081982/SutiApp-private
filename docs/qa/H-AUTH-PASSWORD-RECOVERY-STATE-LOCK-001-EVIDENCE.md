# H-AUTH-PASSWORD-RECOVERY-STATE-LOCK-001 — evidencia

Fecha: 2026-09-03
Estado: PASS

## Objetivo y causa

El callback de recuperación alcanzaba `password_recovery`, pero eventos posteriores de Supabase Auth (`INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED` o `USER_UPDATED`) podían iniciar o completar la resolución normal de identidad y publicar `authenticated`. `app.jsx` desmontaba entonces el formulario antes de que el usuario guardara la contraseña.

## Alcance aplicado

- `app/affiliate-auth.js`: recovery lock dominante, invalidación de resoluciones en vuelo, descarte de eventos entregados durante recovery, permanencia ante error y liberación sólo después de `updateUser` + logout exitosos.
- `scripts/test-h005.js`: secuencias deterministas de eventos, carrera de resolución, evento encolado, error y éxito.
- `scripts/test-password-recovery-state-lock-live.js`: certificación real sin SMTP mediante `admin/generate_link`; contraseña controlada restaurada en `finally` y comprobada.
- `app/bundle.js`: artefacto generado desde las fuentes.
- `SutiApp.html` / `sw.js`: `bundle.js?v=204` y `sutiapp-v148`.

Fuera de alcance y sin cambios: `public.affiliates`, schema/RLS, SMTP, activación, login normal, Admin, Google/Apps Script, `.env`, datos históricos y UI visual.

## Autoridad, seguridad e invariantes

- Autoridad de contraseña: Supabase Auth exclusivamente.
- El navegador conserva sólo la sesión recovery emitida por Supabase; no existe contraseña, token privilegiado, `service_role`, mock, `DATA`, `localStorage` o fallback productivo nuevo.
- La Secret Key usada por la prueba vive únicamente en `supabase.env` ignorado y se usa desde Node local; no entra al bundle ni se imprime.
- `numero_control`, identidad de negocio, RLS, roles, permisos e impersonación no cambian.
- La prueba live cambia temporalmente sólo la contraseña de H005 controlada y restaura/verifica el valor owner-authorized incluso en `finally`; correo enviado: 0.

## Evidencia ejecutada

| Verificación | Resultado |
|---|---|
| `node scripts/test-h005.js` | PASS |
| `node scripts/test-auth-session-regression.js` | PASS |
| `node scripts/test-auth-prod-activation.js` | PASS |
| `node scripts/test-pages-deployment.js` | PASS |
| `node --check app/affiliate-auth.js` / bundle / test live | PASS |
| Recovery real local, sin SMTP | PASS: espera, refresh token, reload, update, password anterior denegada y original restaurada |
| Artefacto Pages local + login real | PASS: 390/430/1280, Inicio, Admin, refresh, sesión, logout, SW |
| GitHub Actions `33792834799` | PASS: build, backend gates, deploy y verificación productiva |
| Recovery real `https://sutiapp.com/`, sin SMTP | PASS: `smtpEmailsSent=0`, lock, refresh, reload, update, old denied, original restored |
| Login normal `https://sutiapp.com/` | PASS: válido/inválido/servicio caído, 390/430/1280, refresh, sesión, logout |
| Regresión global GitHub Pages posterior al deploy | PASS: Login, sello, perfil, Admin Afiliados, documentos self/Admin, Membership, Préstamo, catálogo/galería, Marketplace, fullscreen, refresh, PDF y con/sin SW; mutaciones 0 |
| Bundle remoto | PASS: contiene `recoveryLockedAtDelivery`; SHA-256 remoto = blob commit `81B6048FDE78D53BAA3B0A6C89CA722DD1228C3D6341021E3B83A88AB66BEF1C` |
| Secret scan contra valores de `supabase.env` | PASS: 0 coincidencias; archivo ignorado/no trackeado |
| UI preservation | PASS: cero cambios de layout, controles, copy principal, navegación, motion o responsive; sólo se añadió mensaje controlado de error |

La regresión global también se ejecutó contra servidor local. Login y Auth avanzaron, pero la firma de preview Admin devolvió `DOCUMENT_PREVIEW_UNAVAILABLE` porque el Edge productivo no autoriza orígenes `127.0.0.1`/`localhost`. La misma versión exacta del bundle comprometido fue publicada y la matriz completa pasó desde el origen Pages autorizado, con y sin service worker. No se relajó seguridad ni se cambió la allowlist para hacer pasar el test.

La suite estática amplia ejecutó 95 pruebas: 83 PASS y 12 fallos históricos fuera del alcance. Entre ellos hay expectativas `bundle.js?v=200`/`sutiapp-v144` y `v194` cuando el baseline de `HEAD` antes de esta H ya era `v203`/`v147`, además de módulos Admin/Ahorro/Inversión no modificados. Las pruebas focales Auth, seguridad, UI Claude y Pages incluidas en esa suite dieron PASS; no se alteraron módulos ajenos para maquillar el agregado.

## Cierre

```text
H-AUTH-PASSWORD-RECOVERY-STATE-LOCK-001 RESULT
Status: PASS
Files changed: app/affiliate-auth.js; app/bundle.js; SutiApp.html; sw.js; scripts/test-h005.js; scripts/test-password-recovery-state-lock-live.js; evidencia/changelog
Source-of-truth verdict: PASS — Supabase Auth continúa como autoridad única; .env es fixture QA y no se sincroniza
Invariant verdict: PASS — recovery domina hasta updateUser+logout; login/identidad/RLS sin cambios
Build: PASS — Pages artifact y workflow 33792834799; bundle remoto coincide con blob comprometido
Tests: PASS focal/local/live/producción/global; 0 correos; suite amplia 83/95 con 12 fallos baseline ajenos documentados
Security: PASS — cero secretos en frontend; Admin API sólo en runner local; credencial QA restaurada y verificada
Legacy impact: NOT APPLICABLE — Google/Apps Script/finanzas reads 0, writes 0
Unexpected files changed: 0 de esta H; cambios preexistentes de domain cutover preservados fuera de los commits
Known limitations: preview privado global no autoriza origen localhost; PASS completo obtenido sobre Pages con el mismo blob
Evidence: docs/qa/H-AUTH-PASSWORD-RECOVERY-STATE-LOCK-001-EVIDENCE.md
```
