# Fase 1 - Auth / Affiliate Certification

Fecha: 2026-08-24  
Estado: **PASS**
La certificación productiva del 2026-09-03 quedó cerrada con Resend Custom SMTP: correo real, callback, password, vínculo, login, doble activación, recuperación y alta desde Admin dieron PASS. Ver `docs/qa/H-AUTH-PROD-ACTIVATION-CERT-001-EVIDENCE.md`.

## Binding exacto

```text
Auth identifier: auth.users.id / auth.uid() UUID
Affiliate binding field: public.affiliates.auth_user_id UUID nullable
Affiliate PK: public.affiliates.id UUID
Historical identity: public.affiliates.numero_control TEXT raw, nullable, no unique
Credential field: auth.users.email + password de Supabase Auth
Binding writer: claim_affiliate_identity(); proceso administrativo autorizado
Binding reader: get_effective_affiliate_id() -> AffiliateRepository.getCurrentAffiliate()
Binding validation: FK Auth, indice unico parcial auth_user_id, email confirmado + un affiliate eligible exacto
RLS: affiliates_select_effective + RPC backend; cliente sin escritura directa
```

Ruta comprobada: `Supabase Auth -> auth.uid() -> get_effective_affiliate_id() -> affiliates.auth_user_id -> AffiliateRepository -> affiliate-view-model -> UI/solicitudes`.

`numero_control` no autentica ni selecciona filas. Email es credencial/contacto y no identidad historica.

## Censo productivo live

| Metrica | Resultado |
|---|---:|
| Affiliates | 947 |
| Auth users | 3 |
| Affiliates linked to Auth | 3 |
| Auth linked to affiliate | 3 |
| Affiliates without Auth | 944 |
| Auth without affiliate | 0 |
| Multiple Auth -> affiliate | 0 |
| Multiple affiliates -> Auth | 0 |
| Dangling Auth FK | 0 |
| Duplicate `numero_control` | 13 grupos / 28 filas |
| Duplicate normalized email | 7 grupos / 16 filas |
| Duplicate email entre `eligible` | 0 |
| Wrong bindings | 0 |
| Ambiguous active bindings | 0 |

No se modificaron duplicados ni huerfanos. Todos los `numero_control` no nulos llegaron por REST como strings; se preservan 3 valores no numericos. El censo no contiene valores con cero inicial, por lo que no se invento un fixture.

## Matriz live y navegador

| Caso | Resultado |
|---|---|
| Login valido A/B/Admin | PASS |
| Password incorrecta / usuario inexistente | DENIED controlado |
| Refresh; logout; refresh revocado | PASS |
| A lee A / B lee B | PASS |
| A/B read/write por UUID directo | DENIED bilateral |
| A/B relaciones privadas con fixtures reales | DENIED bilateral |
| Anonimo read/write | DENIED |
| Admin lookup A/B | PASS segun permiso |
| Normal user -> Admin lookup/impersonation | DENIED |
| Admin impersonation | PASS |
| `actor_real` permanece Admin Auth | PASS |
| `usuario_contexto` cambia solo affiliate efectivo | PASS |
| Refresh y salida de impersonacion | PASS; contexto real restaurado |
| Caller-selected affiliate en claim | DENIED; RPC no acepta selector |

Chrome real confirmo A -> reload -> logout -> reload -> B sin contexto residual; Perfil y Credencial conservaron el mismo `numero_control`; `stale_identity_keys=0`.

Recovery real PASS: token Supabase -> callback `PASSWORD_RECOVERY` -> password update -> nueva sesion -> restauracion inmediata de la credencial original -> login original. La respuesta para cuenta inexistente no expone existencia.

Defecto corregido: un `SIGNED_OUT` tardio borraba el aviso y dejaba la pantalla atrapada en modo reset. `AffiliateAuth` ahora conserva el aviso y vuelve a login cuando queda `unauthenticated`. No cambio layout, copy, estilos ni controles.

## Activación — certificación productiva cerrada

Código vigente: preflight mínimo usa el email histórico normalizado, falla ante cero/múltiples/no elegible/vinculado y `signInWithOtp` usa Supabase Auth. El callback define password y sólo concluye después de `claim_affiliate_identity` y una lectura que comprueba el UUID vinculado.

Producción usa Resend Custom SMTP con `auth.sutiapp.com`, remitente `no-reply@auth.sutiapp.com`, TLS 1.3, autoconfirm desactivado, frecuencia mínima de 60 segundos y límite Supabase de 100 correos por hora. El plan Resend Free limita la capacidad real a 100 correos diarios. La matriz completa recibió activación y recuperación reales, completó password, vínculo, login, doble activación controlada y alta Admin. Resultado: **PASS**.

## Guardians

```text
SOURCE OF TRUTH: SAFE
Authority: Supabase Auth + public.affiliates, cada uno en su frontera
Alternative productive identity sources: 0
Fallbacks Auth/perfil/credencial/solicitudes: 0

SUPABASE SECURITY: PASS para rutas ejecutadas
RLS live: A/B/Admin/normal/anonymous
Privilege escalation: DENIED
Frontend secrets: 0
Cross-user: DENIED bilateral
Impersonation/audit: PASS

CLAUDE UI PRESERVATION: PASS
Missing/added sections: 0 / 0
Interactions/navigation/visual structure preserved: YES
Unauthorized redesign: NO
```

## Resultado final

```text
Binding architecture: PASS
numero_control authority: PASS
Email credential model: PASS
Login: PASS
Activation architecture: VERIFIED
Positive real activation: PASS
Recovery: PASS
Session refresh: PASS
Logout/login context reset: PASS
Impersonation identity safety: PASS
RLS live: PASS
Cross-user isolation: PASS
Anonymous denied: PASS
Normal user Admin denied: PASS
Local productive identity authority: 0
Stale identity leaks: 0
Secrets exposed: 0
Browser: PASS para activacion y recuperacion productivas completas
Transient fixtures remaining: 0
Known security defect: NO
Production activation certification pending: NO
Final verdict: PASS
```

## H-FASE-1 RESULT

```text
Status: PASS
Files changed: app/affiliate-auth.js; app/bundle.js; scripts/certify-auth-affiliate-phase1.py; scripts/test-auth-affiliate-phase1-browser.js; scripts/configure-auth-custom-smtp.js; este reporte; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE
Invariant verdict: PASS; INV-037 certificado en producción con Custom SMTP
Build: PASS - bundle de 83 fuentes; node --check PASS
Tests: 34/34 static; H-005 unit; census/RLS live; Chrome Auth/recovery PASS
Security: PASS para Auth/RLS/aislamiento/Admin/impersonacion
Legacy impact: NOT APPLICABLE / NO INTERACTION
Unexpected files changed: no detectados; no existe metadata Git para diff
Known limitations: Resend Free limita el dominio a 100 correos Auth diarios; reintentos y recovery consumen la misma cuota
```

Hashes SHA-256:

```text
app/affiliate-auth.js FE88FE3C5358A68F9B193F64614945FB5C469613DF7FF5705C819F9B9F11C2A5
app/bundle.js AAA764D37DCD90FDFF36BFECB3AF6CFDE51836CFB0998F3E92D7D0EBFF4D731A
scripts/certify-auth-affiliate-phase1.py 3B9046FFCEC230FC9D0F809BD2D5F2AF7C4138DA16479E61971001F0E7F8FA91
scripts/test-auth-affiliate-phase1-browser.js 768DF7B2984074309007DC19A6CB8AE2C4045639835FA714DC5A1BA3782AAA8C
```

Continuidad autorizada: **Fase 2 DRY RUN ONLY**. Fase 1 todavía no está `CLOSED`.
