# Production Readiness

## AUTH-PROD-ACTIVATION-CERT

Estado: `DEFERRED_UNTIL_ONLINE`  
Bloquea: cierre definitivo de Fase 1.  
No bloquea: trabajo técnico independiente ni Fase 2 read-only.

Prerequisitos obligatorios:

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

Restricciones mientras SutiApp continúe local:

- no enviar correo para esta certificación;
- no crear un usuario Auth de prueba;
- no modificar Site URL ni Redirect URLs;
- no configurar localhost para cerrar el gate.

Criterio de cierre: solo después de `PASS` en esta matriz Fase 1 puede cambiar de `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST` a `CLOSED`.

## APP-ASSETS-ORPHAN-AUDIT

Estado: `PENDING_INDEPENDENT_AUDIT`  
Alcance: cinco objetos del bucket público `app-assets` sin fila registry, identificados por fingerprints en la evidencia de Fase 2.  
No bloquea: Identidad, expediente privado ni cierre de Fase 2.  

Restricciones: no borrar, adoptar, mover ni reasignar sin demostrar origen, consumidores y recuperación. No forman parte de `private-assets` ni del expediente privado del afiliado.
