# H-AUTH-PROD-ACTIVATION-CERT-001 — evidencia

Fecha: 2026-09-03
Estado: **PASS — Custom SMTP Resend activo y certificación productiva completa**

## Resultado solicitado

```text
AUTH-PROD-ACTIVATION-CERT

Activation error observability: PASS
Supabase Site URL: PASS
Redirect URLs: PASS
SMTP/provider: PASS
Real activation email received: PASS
Activation callback: PASS
Password setup: PASS
affiliates.auth_user_id linkage: PASS
Login after activation: PASS
Double activation: PASS
Password recovery real email: PASS
Admin creates affiliate: PASS
New affiliate activation: PASS
Production certification: PASS
```

La ejecución final usó un afiliado QA creado desde Admin y un buzón externo controlado. El correo de activación y el de recuperación fueron recibidos realmente; ambos callbacks abrieron GitHub Pages, permitieron definir contraseña y concluyeron con login y afiliado correcto.

## Causa raíz demostrada

1. `affiliate-auth.js` atrapaba cualquier error de `signUp` y publicaba un resultado equivalente a éxito. Esta era la causa directa de “no sucede nada/no recibí correo” sin error visible.
2. Auth productivo tenía `site_url=http://localhost:3000` y allowlist de redirects vacía.
3. Antes del cierre no existía SMTP propio. El proveedor era `SUPABASE_DEFAULT_EMAIL`, `rate_limit_email_sent=2` por hora y frecuencia mínima de 60 segundos. El proveedor entregó dos mensajes reales, pero Supabase rechazó elevar el límite porque exigía SMTP host/port/user/pass/remitente.
4. El redirect no conservó de forma fiable `auth_flow`. La corrección usa además `user_metadata.sutiapp_activation=true`, emitida por Auth, y la limpia al definir la contraseña. Producción alcanzó realmente `activation_password` con esa señal.

## Cierre SMTP productivo

- Dominio de envío: `auth.sutiapp.com`; DKIM y SPF respondieron correctamente en DNS público y Resend reportó `Sending: ENABLED`.
- Proveedor: Resend mediante `smtp.resend.com:465`, usuario SMTP restringido a envío y autenticación comprobada sobre TLS 1.3.
- Remitente Auth: `SutiApp <no-reply@auth.sutiapp.com>`.
- Supabase: `CUSTOM_SMTP`, autoconfirm desactivado, intervalo por dirección de 60 segundos y `rate_limit_email_sent=100`.
- Capacidad Resend aceptada por el propietario: plan Free, 100 correos diarios y 3,000 mensuales. El límite representa correos Auth totales; reintentos y recuperaciones consumen la misma cuota.
- Los enlaces recibidos conservaron directamente `/auth/v1/verify`; no hubo reescritura de Click Tracking. Open Tracking no es consultable por API con la credencial SMTP de mínimo privilegio y queda fuera de la matriz final de esta certificación.
- La API key reside exclusivamente en `supabase.env`, ignorado por Git. La auditoría de archivos versionados encontró cero apariciones del secreto.

## Cambios aplicados

- Activación: preflight público mínimo y fail-closed → `signInWithOtp` → correo → callback → password → claim → verificación del vínculo → logout.
- Estados visibles distintos: enviado, ya activado, no registrado, no elegible, ambiguo, rate limit, configuración y proveedor temporal.
- Recuperación dejó de ocultar errores de Supabase.
- `get_affiliate_activation_status(text)` sólo devuelve un código; usa `historical_email_normalized`, exige una fila única, elegible, no archivada y sin vínculo. No devuelve PII ni escribe datos.
- El gate de Pages comprueba el nuevo RPC antes de desplegar.
- Site URL: `https://david14081982.github.io/SutiApp-private/`.
- Redirects: base, `?auth_flow=activation` y `?auth_flow=recovery`.

## Evidencia ejecutada

- Migración/recovery dry-run: PASS, 0 filas alteradas.
- Apply/status productivo: RPC presente; Site URL y tres redirects PASS; conteos de afiliados/vínculos invariantes durante apply.
- `node scripts/test-auth-prod-activation.js`: PASS.
- `node scripts/test-h005.js`: PASS.
- `node scripts/test-master-phase1.js`: PASS.
- `node scripts/test-auth-session-regression.js`: PASS.
- `node scripts/test-auth-deployment-contract.js`: PASS.
- Probe backend live: cuatro RPC protegidos `401`; preflight público mínimo `200/INVALID_EMAIL`: PASS.
- GitHub Pages runs `33760674019` y `33761392688`: PASS.
- Buzón externo controlado: dos correos de activación recibidos realmente.
- Callback real: Auth confirmado, página productiva abierta y fase `activation_password` alcanzada.
- Rate limit real: tercera solicitud devolvió `ACTIVATION_RATE_LIMIT` y `role=alert` visible; no devolvió éxito.
- `node scripts/configure-auth-custom-smtp.js --check`: credencial SMTP válida, TLS 1.3 y cero secretos impresos.
- `node scripts/configure-auth-custom-smtp.js --apply --rate 100`: Custom SMTP y límite 100/h aplicados y releídos desde Management API.
- `node scripts/certify-auth-prod-activation-live.js`: PASS en activación, callback, password, vínculo, login, doble activación, recovery, Admin y cleanup.

No se ejecutaron suites globales por restricción expresa de la H. No hubo interacción con Google, Apps Script, Ahorro, Préstamos ni cálculos financieros.

## Fixtures y recuperación

Se crearon cuatro filas `ADMIN_AFFILIATES` controladas durante la depuración; las cuatro quedaron archivadas mediante el RPC oficial. Un Auth QA vinculado se conserva porque `identity_audit_log` es append-only y las FK impiden borrarlo sin destruir auditoría; un Auth QA sin vínculo ni auditoría fue eliminado. No se borró historia.

El primer arnés tomó por error el afiliado preseleccionado por Admin y archivó una fila histórica durante segundos. Se restauró inmediatamente con `restore_admin_affiliate`; la verificación final devolvió los mismos tres históricos archivados previos y sólo fixtures QA adicionales archivados. El evento ARCHIVE/RESTORE permanece auditado.

La ejecución SMTP final agregó un único afiliado `ADMIN_AFFILIATES` controlado y lo archivó mediante el RPC oficial. Su Auth y auditoría se preservaron por integridad referencial. Reconciliación final: 952 afiliados técnicos y 5 vínculos Auth; los afiliados productivos históricos no se alteraron.

Hashes finales:

```text
app/affiliate-auth.js 5CE80BD5108BD6D1EA6B6A10769F2960936A61BD553F48CB07819719FC865D9A
app/bundle.js DE874E550F9E27B9661171D840D6D842089B25893ECA22B912E2D0C5BCFE9574
supabase/migrations/20260903000150_auth_prod_activation_preflight.sql 56F0E3661244A85C5F477786DEC37415A24A1C5A2CAD9A0DEDB8984A16A4A711
```

## Resultado

El bloqueo por proveedor predeterminado quedó resuelto con Resend Custom SMTP. `AUTH-PROD-ACTIVATION-CERT` queda `PASS`. La capacidad operativa aceptada es de hasta 100 correos Auth por día; no equivale a 100 usuarios garantizados si existen reintentos o recuperaciones.
