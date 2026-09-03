# Production Readiness

## AUTH-PROD-ACTIVATION-CERT

Estado: `BLOCKED_CUSTOM_SMTP / PRODUCTIVE_FIX_DEPLOYED`
Bloquea: cierre definitivo de Fase 1.  
No bloquea: trabajo técnico independiente ni Fase 2 read-only.

Estado verificado 2026-09-03:

- URL, Site URL, redirects, entrega real y entrada al callback productivo: `PASS`;
- observabilidad de error y rate limit visible: `PASS`;
- proveedor: Supabase default, sin SMTP propio, máximo 2 correos/hora;
- password + vínculo + login + recovery en un único ciclo certificado: `FAIL / BLOCKED`.

Prerequisito restante:

- configurar SMTP productivo (host, port, user, pass y remitente) y repetir `scripts/certify-auth-prod-activation-live.js`.

Prerequisitos históricos ya resueltos:

- Production URL y dominio final;
- Supabase Site URL definitiva;
- Redirect URLs definitivas;
- callback Auth de producción;
- flujo real de entrega de correo.

Matriz requerida:

```text
affiliate elegible sin Auth
→ activación real
→ correo real
→ callback producción
→ password/setup
→ Auth ↔ affiliate
→ login
→ refresh
→ logout/login
→ identity verification
```

Restricciones vigentes:

- no elevar falsamente el límite sin SMTP;
- no usar afiliados reales para completar la matriz;
- no borrar auditoría ni Auth vinculado sólo para limpiar fixtures.

Criterio de cierre: solo después de `PASS` en esta matriz Fase 1 puede cambiar de `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST` a `CLOSED`.

## APP-ASSETS-ORPHAN-AUDIT

Estado: `PENDING_INDEPENDENT_AUDIT`  
Alcance: cinco objetos del bucket público `app-assets` sin fila registry, identificados por fingerprints en la evidencia de Fase 2.  
No bloquea: Identidad, expediente privado ni cierre de Fase 2.  

Restricciones: no borrar, adoptar, mover ni reasignar sin demostrar origen, consumidores y recuperación. No forman parte de `private-assets` ni del expediente privado del afiliado.
