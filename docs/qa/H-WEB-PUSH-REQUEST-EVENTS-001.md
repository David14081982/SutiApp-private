# H-WEB-PUSH-REQUEST-EVENTS-001

Autorización: OWNER DECISION — CONTINUAR, 2026-09-08. UX anterior publicada PASS; Push independiente.

## PRE-CHANGE AUDIT

Status: PASS (alcance autorizado; implementación/verificación pendientes).
Objetivo: Web Push opt-in posterior a eventos confirmados de solicitudes.
Alcance: dispositivo, suscripción, cola, emisor, auditoría, handlers SW y enlace al historial.
Archivos: nuevos `app/request-push.js`, `supabase/functions/request-push/index.ts`,
`supabase/migrations/20260908000700_request_web_push.sql`, recovery homónimo,
`scripts/request-push-tools.js`, `scripts/test-request-push-*.js`,
`scripts/release-request-push.js`; cambios focales en `app/app.jsx`, `sw.js`,
`scripts/build-bundle.js`, artefactos `app/bundle.js`/`SutiApp.html`,
adaptación del harness `scripts/test-request-event-notifications-browser.js` para el nuevo componente,
documentación SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, AGENT_CHANGELOG,
esta QA/evidencia `docs/qa/evidence/request-push-20260908` y Registry derivado.
Fuera de alcance: estados de negocio, writers financieros, Google, cálculos, datos históricos.
Datos: nuevas suscripciones privadas, cola/auditoría de transporte; ningún backfill de avisos antiguos.
Autoridad: `program_request_admin_events` + `program_requests`; identidad mediante
`get_effective_affiliate_id()` y vínculo Auth existente. No autoridad paralela.
Lectores/escritores: RPC self para registrar/revocar; trigger AFTER INSERT en evento;
Edge con privilegio backend para claim/resultado; frontend sólo key pública/propio dispositivo.
Infraestructura: VAPID privada y token worker en secretos Edge/Vault; cron/net ya existentes.
Riesgo: global por SW/routing; privacidad al salir/cambiar usuario; reintentos ambiguos de red.
Invariantes: sin Push por rollback/intento; eventos únicos por dispositivo; RLS forzada;
sin suplantación ni lectura cruzada; sin secreto frontend; sin modificación legacy.
IndexedDB conserva exclusivamente vinculación privada del dispositivo y IDs de deduplicación;
no conserva solicitudes, estados, tokens Auth ni sustituye errores de Supabase.
Tests: SQL transaccional ROLLBACK, emisor y navegador aislados, transporte real si disponible,
regresión global de imágenes local/producción, UI existente, build y comprobación de secretos.
Recovery: desactivar cron y trigger, revocar RPC, conservar auditoría privada y secretos para
recuperación; restaurar frontend/SW anterior mediante commit. No borrar historial de negocio.

## DATABASE / SECURITY / SOURCE-OF-TRUTH AUDIT

Ampliación focal auditada: `20260908000710_request_web_push_device_status.sql` y recovery;
RPC self de vigencia y limpieza periódica de expirados aun sin eventos pendientes.
Motivo: IndexedDB no puede declarar activa una suscripción revocada por el backend.
Sin nuevos estados de negocio ni cambios al registro/identidad; test SQL con ROLLBACK.

Diseño aprobado dentro de autorización expresa. Tablas forzadas RLS sin grants browser;
funciones con search_path vacío y grants mínimos. Endpoint HTTPS acotado a proveedores Push;
destinatario validado al registrar, encolar y reclamar. Impersonación no suscribe otro afiliado.
Lease, unique(event_id, subscription_id), TTL y límite de intentos controlan transporte.
El éxito HTTP del proveedor prueba aceptación, no lectura por el usuario.
El outbox es transaccional: no se comunica con Internet desde la transición financiera.
Los fixtures sólo existen en transacciones revertidas o harnesses aislados.

## Referencias técnicas

[Web Push y VAPID](https://github.com/web-push-libs/web-push),
[cron, pg_net y Vault](https://supabase.com/docs/guides/functions/schedule-functions),
[WebKit: permiso por gesto y PWA instalada en iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Resultado

Implementación y backend desplegados. Candidato frontend bundle 233 / SW 180.
Regresión global local PASS: sello/login, perfil, Admin Afiliados, documentos imagen/PDF,
Membership, préstamo, catálogo/galería, Marketplace, fullscreen, refresh y con/sin SW.
Ninguna mutación de solicitudes, eventos históricos, datos financieros ni Google.

| Validación | Resultado y evidencia |
|---|---|
| Android PWA | FAIL de validación: ningún dispositivo conectado; emulador disponible sin acelerador y sin espacio suficiente para arrancar. No afirma fallo funcional de Android. |
| iPhone PWA compatible | PENDING REAL DEVICE, permitido por el propietario |
| Suscripción | PASS, RPC real + Firefox normal con SW real |
| Revocación | PASS, navegador/proveedor/RPC; endpoints y claves limpiados |
| Autorizada | PASS, SQL en rollback + emisor real, proveedor Mozilla, payload descifrado |
| Rechazada | PASS, emisor real/proveedor Mozilla, payload descifrado |
| Cancelada | PASS, emisor real/proveedor Mozilla, payload descifrado |
| Cambio de etapa | PASS, emisor real/proveedor Mozilla, payload descifrado |
| notificationclick | PASS, handler real en harness; enlace real carga Tracking y rechaza solicitud ajena/inexistente |
| Duplicados | 0 en pruebas SQL, receptor concurrente/reinicio y Firefox Push real |
| Cross-user delivery | 0; validación SQL de propietario/destino + rechazo local de binding distinto |
| Secretos frontend | 0, comparación contra secretos reales en fuentes y artefacto público |

Pruebas de entrega usan mensajes técnicos aislados a receptores controlados. No fabrican
transiciones financieras persistentes para demostrar un aviso. La cola productiva permanece vacía;
su semántica se verifica con SQL transaccional revertido. HTTP 201 significa aceptación del proveedor.
El contrato de deduplicación se refiere a eventos/avisos; un timeout ambiguo puede reintentar transporte.
Firefox pasa con perfil normal. Los primeros intentos en contextos privados y Chrome automatizado
no completaron Push; el último Chrome muestra error recuperable, sin bloquear SutiApp.
La regresión global falló inicialmente en localhost:8083 porque ese origen no está en el CORS
documental existente; localhost:8080 autorizado pasa sin modificar CORS ni backend documental.

CLAUDE UI PRESERVATION REVIEW: Notificaciones conserva header/back, tarjetas/eventos/cotizaciones,
badge, estados, scroll y navegación. Se añade únicamente invitación opt-in. Routing añade UUID de
solicitud hacia el Tracking existente; logout mantiene Auth y cierra primero el dispositivo.
Missing sections: 0. Unauthorized redesign: NO. Verdict: PASS.

Publicado `506634444368088f5ec00eef1a11845ce36f8fda` mediante
[Pages 34303314037 SUCCESS](https://github.com/David14081982/SutiApp-private/actions/runs/34303314037).
SutiApp.com y GitHub Pages coinciden byte a byte con HTML, SW y bundle del commit.
Firefox productivo: suscripción, Push real cifrado, deduplicación, revocación y guard de enlace PASS.
Regresión global GitHub Pages PASS, incluido PDF legítimo; 0 errores browser y 0 mutaciones de negocio.
Registry actualizado para código/schema; su freshness restante corresponde sólo a narrativa/evidencia QA.

```text
H-WEB-PUSH-REQUEST-EVENTS-001 RESULT
Status: BLOCKED — falta evidencia Android PWA en dispositivo utilizable.
Files changed: app/request-push.js, app/app.jsx, sw.js, build recipe/artifacts,
  Edge request-push, migraciones/recovery 20260908000700 y 20260908000710,
  herramientas/tests focales, documentos de gobierno, QA/evidencia y Registry derivado.
Source-of-truth verdict: PASS — eventos/solicitudes e identidad existentes; sólo metadata de transporte nueva.
Invariant verdict: PASS para controles ejecutables; aceptación Android pendiente.
Build: PASS — bundle publicado 233, SW 180, hashes canónicos coincidentes en ambos dominios.
Tests: PASS SQL rollback, emitter, browser, transporte real, Firefox local/productivo,
  notificaciones internas existentes y regresión global local/GitHub Pages.
Security: PASS — RLS forzada, RPC self, worker secreto, 0 secretos frontend y 0 entregas cruzadas probadas.
Legacy impact: NONE — no cambios de Google, cálculos, writers financieros ni históricos.
Unexpected files changed: 0 en release; trabajo local previo del propietario conservado.
Known limitations: Android sin dispositivo (0 ADB); emulador sin acelerador/espacio;
  iPhone PENDING REAL DEVICE permitido; Chrome automatizado no completa suscripción.
  No se produjo una transición financiera artificial para probar Push productivo.
Evidence: docs/qa/evidence/request-push-20260908/*.json y ARCHITECT-REVIEW.md.
```

La H de confirmaciones anterior permanece cerrada PASS. Este bloqueo de validación
no reabre su publicación ni su alcance. Se pidió conectar Android, sin solicitar nuevas
decisiones de arquitectura, permisos de despliegue ni configuración manual de VAPID.
