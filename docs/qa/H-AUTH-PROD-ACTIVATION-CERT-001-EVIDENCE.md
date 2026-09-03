# H-AUTH-PROD-ACTIVATION-CERT-001 — evidencia

Fecha: 2026-09-03  
Estado: **BLOCKED — corrección productiva publicada; certificación completa FAIL**

## Resultado solicitado

```text
AUTH-PROD-ACTIVATION-CERT

Activation error observability: PASS
Supabase Site URL: PASS
Redirect URLs: PASS
SMTP/provider: FAIL
Real activation email received: PASS
Activation callback: PASS
Password setup: FAIL
affiliates.auth_user_id linkage: FAIL
Login after activation: FAIL
Double activation: FAIL
Password recovery real email: FAIL
Admin creates affiliate: PASS
New affiliate activation: FAIL
Production certification: FAIL
```

`affiliates.auth_user_id linkage` se marca FAIL para la matriz completa: una ejecución anterior sí confirmó vínculo real, pero no completó password + login con el flujo corregido. No se convierte evidencia parcial en PASS.

## Causa raíz demostrada

1. `affiliate-auth.js` atrapaba cualquier error de `signUp` y publicaba un resultado equivalente a éxito. Esta era la causa directa de “no sucede nada/no recibí correo” sin error visible.
2. Auth productivo tenía `site_url=http://localhost:3000` y allowlist de redirects vacía.
3. No existe SMTP propio. El proveedor real es `SUPABASE_DEFAULT_EMAIL`, `rate_limit_email_sent=2` por hora y frecuencia mínima de 60 segundos. El proveedor entregó dos mensajes reales, pero Supabase rechazó elevar el límite: exige SMTP host/port/user/pass/remitente.
4. El redirect no conservó de forma fiable `auth_flow`. La corrección usa además `user_metadata.sutiapp_activation=true`, emitida por Auth, y la limpia al definir la contraseña. Producción alcanzó realmente `activation_password` con esa señal.

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

No se ejecutaron suites globales por restricción expresa de la H. No hubo interacción con Google, Apps Script, Ahorro, Préstamos ni cálculos financieros.

## Fixtures y recuperación

Se crearon cuatro filas `ADMIN_AFFILIATES` controladas durante la depuración; las cuatro quedaron archivadas mediante el RPC oficial. Un Auth QA vinculado se conserva porque `identity_audit_log` es append-only y las FK impiden borrarlo sin destruir auditoría; un Auth QA sin vínculo ni auditoría fue eliminado. No se borró historia.

El primer arnés tomó por error el afiliado preseleccionado por Admin y archivó una fila histórica durante segundos. Se restauró inmediatamente con `restore_admin_affiliate`; la verificación final devolvió los mismos tres históricos archivados previos y sólo fixtures QA adicionales archivados. El evento ARCHIVE/RESTORE permanece auditado.

Reconciliación final: 947 filas históricas intactas, 3 históricas archivadas, 4 filas QA y 4/4 QA archivadas; una QA conserva vínculo Auth auditado. Total técnico actual: 951 afiliados y 4 vínculos Auth.

Hashes finales:

```text
app/affiliate-auth.js 5CE80BD5108BD6D1EA6B6A10769F2960936A61BD553F48CB07819719FC865D9A
app/bundle.js DE874E550F9E27B9661171D840D6D842089B25893ECA22B912E2D0C5BCFE9574
supabase/migrations/20260903000150_auth_prod_activation_preflight.sql 56F0E3661244A85C5F477786DEC37415A24A1C5A2CAD9A0DEDB8984A16A4A711
```

## Bloqueo exacto

Para completar password, vínculo, login, doble activación y recovery con correo real se necesita esperar la ventana del proveedor o, para una configuración productiva razonable, proporcionar SMTP propio. Supabase no permite aumentar `rate_limit_email_sent` sin esos cinco parámetros. Hasta entonces no se cierra Fase 1 ni se declara producción certificada.
