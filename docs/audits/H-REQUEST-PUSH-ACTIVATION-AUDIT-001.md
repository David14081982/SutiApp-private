# H-REQUEST-PUSH-ACTIVATION-AUDIT-001

Fecha: 2026-09-25. Solicitud: auditar pérdida de activación de notificaciones,
especialmente en Android instalado, y ausencia de invitación al iniciar la app.

**Auditoría: PASS. Estado funcional de la sección: NEEDS_FIX.**
Se identifican mecanismos reproducibles; no se atribuye sin prueba una causa única
a cada desactivación reportada ni se afirma haber observado el celular del propietario.

## PRE-CHANGE AUDIT

- Alcance: lectura focal de UI, Auth, transporte push, service worker y backend;
  pruebas aisladas y consultas SELECT agregadas. Sin implementación ni publicación.
- Archivos a cambiar: este informe y `docs/AGENT_CHANGELOG.md` exclusivamente.
- Autoridades: permiso nativo del navegador; PushSubscription del dispositivo;
  registro self-only `request_push_subscriptions`; eventos de solicitudes existentes.
  IndexedDB conserva vínculo técnico/dispositivo y deduplicación, no solicitudes.
- Lectores: `RequestPush.state`, `RequestPushInvitation`, worker y dispatcher.
- Escritores inspeccionados, NO ejecutados en producción: `enable`, `clearDevice`,
  RPC register/revoke y worker backend. Sin nueva autoridad o caché de negocio.
- Fuera de alcance: modificar permisos del celular, enviar notificaciones, activar/
  revocar suscripciones, ejecutar cron, tocar solicitudes/finanzas/Google/schema.
- Riesgo: confundir permiso concedido con transporte activo, romper privacidad
  al reparar automáticamente una revocación deliberada o un cambio de cuenta.
- Recovery: revertir sólo los dos documentos; no hay cambios de datos que recuperar.
- Estado: PASS. Registry STALE por cambios ya conocidos; discovery focal confirmó
  código vigente. Sin cambio arquitectónico ni actualización del índice derivado.

## Evidencia productiva de sólo lectura

Comprobación: 2026-09-25T07:00:29Z. Agregados, sin endpoints, claves, tokens o PII.

| Medida | Resultado |
|---|---:|
| Push global habilitado | Sí |
| Suscripciones registradas | 58 |
| Suscripciones no revocadas | 37, de 36 propietarios |
| Suscripciones revocadas | 21 |
| Revocadas con rechazo del proveedor HTTP 410 | 14 |
| Revocadas sin evidencia de 404/410 ni fecha vencida | 7 |
| Suscripciones con `expiration_at` informado | 0 |
| Scheduler de entrega | Activo, cada minuto |
| Ejecuciones scheduler últimas 24 horas | 1,440 exitosas |
| Intentos últimos 30 días | 115 aceptados HTTP 201; 14 HTTP 410 |
| Filas de entrega últimos 30 días | 101 accepted; 12 suppressed |
| RLS forzada en suscripciones/entregas/intentos | Sí |
| SELECT/INSERT directo de authenticated en esas tablas | No |
| RPC de estado ejecutable por anon | No |

Las cifras de intentos y entregas no son intercambiables. HTTP 201 es aceptación
del transporte, no prueba de que Android haya mostrado el aviso. HTTP 410 prueba
un destino inválido/caducado; no demuestra si lo causó el navegador, una baja de
la propia app o el usuario. Las otras 7 revocaciones no tienen motivo explícito
auditable en la fila de suscripción: no clasificarlas automáticamente como errores.

Paridad con `https://sutiapp.com`: bundle 288; `request-push.js`, `affiliate-auth.js`
y `sw.js` coinciden con lo inspeccionado. Push SHA256:
`aa2e685491a1d86029b0a8d745e2a05af4e524bb0bb0c604c008a015190135d1`.
Auth SHA256: `8262edbb45c01f6ecfdc1e1f89b6d392acebc171c9e23eeeb4ac730cb395030a`.

## Hallazgos

### F1 — Alta: la invitación no existe en el inicio

`RequestPushInvitation` sólo se monta en `NotifsScreen`, `app/app.jsx:290`.
No está en Inicio ni en el flujo posterior al login. No existe recordatorio inicial,
posponer, ni un acceso guiado desde el arranque. No es un fallo del permiso nativo:
ese componente no se renderiza allí. Confirma la segunda observación del propietario.

### F2 — Alta: varias causas distintas terminan en «Activar notificaciones»

`app/request-push.js:32` exige permiso granted + suscripción local + vínculo
IndexedDB propio + registro backend válido. Si falta cualquiera, presenta `ready`
(salvo permiso denied), sin explicar qué se perdió.
Reproducido: perder la suscripción o el vínculo local mantiene permiso granted,
pero exige activación manual. Consultar/abrir la pantalla no restablece el transporte.
Backend inválido/revocado/caducado tampoco se registra otra vez automáticamente.

No hay temporizador frontend que desactive al día siguiente. El TTL de 86,400 s de
`supabase/functions/request-push/index.ts` y el límite de 24 h de jobs pendientes
son vigencia de mensajes, no de suscripciones. Actualmente ninguna fila tiene fecha
de expiración explícita. Los 410 sí demuestran bajas de transporte en producción.

### F3 — Media: cerrar sesión/cambiar cuenta/tomar control destruye el vínculo local

`app/app.jsx:546` llama a `clearDevice()` al salir: revoca backend y desuscribe el
dispositivo. `syncIdentity`, `app/request-push.js:23`, también desuscribe si cambia
el propietario efectivo o hay impersonación; esta última hace que `identity()`
retorne null. Volver al mismo usuario no restaura la activación.
Reproducido: active -> tomar control -> volver -> ready, permiso granted,
binding ausente, suscripción ausente. No demuestra que el propietario haya usado
impersonación en el incidente: es una ruta causal independiente y verificable.

La limpieza protege privacidad; no debe quitarse sin un contrato seguro. El problema
UX es la pérdida no explicada y la falta de recuperación guiada al regresar.
`clearDevice(false)` no revoca la fila remota: puede quedar temporalmente registrada
hasta recibir un 410, por lo que «activa en backend» tampoco prueba salud local.

### F4 — Media: el estado puede quedar desactualizado al volver al primer plano

`RequestPushInvitation`, `app/request-push.js:70`, escucha Auth, focus, online y
controllerchange; no visibilitychange ni pageshow. Reproducido: suscripción perdida
en segundo plano + visibilitychange -> UI sigue active; consulta real devuelve ready.
Un focus posterior sí actualiza. No se afirma que todos los Android omitan focus;
se demuestra que el flujo que sólo entrega visibilitychange queda sin cubrir.

### F5 — Alta: una suscripción renovada puede figurar activa sin sincronizar destino

El chequeo de estado consulta sólo UUID del vínculo backend. No compara el endpoint
ni claves vigentes del PushSubscription con el destino registrado; tampoco hay
handler pushsubscriptionchange en `sw.js` ni conciliación al abrir para ese caso.
Reproducido: sustituir endpoint/claves del transporte aislado mantiene active y no
vuelve a registrar el destino. Esto puede dejar el servidor enviando al destino viejo.
La prueba confirma la falta de conciliación, no la frecuencia de rotación en móviles.

### F6 — Alta: fallo de visualización queda consumido por la deduplicación del worker

`sw.js:34` registra el ID en IndexedDB antes de `showNotification`, `sw.js:52`.
Si showNotification falla, no libera ni distingue esa marca. Reproducido: dos
entregas del mismo evento, primer intento falla, segundo no vuelve a mostrar;
resultado: 1 intento de visualización, 0 notificaciones mostradas.
No hubo mensajes reales enviados. No explica por sí solo la desactivación, pero
sí otra vía para «aceptado por el proveedor, nunca visible».

### F7 — Media: permiso bloqueado sólo ofrece texto genérico

En denied se muestra «desde los ajustes de tu navegador», sin guía específica para
Android instalado ni control que abra una ayuda. No hay botón universal probado
para llevar una PWA a ajustes nativos; no prometer ese comportamiento.

## Lo que sí pasó y no debe romperse

Pruebas existentes reutilizadas con fuentes actuales y evidencia redirigida a TEMP:
`scripts/test-request-push-persistence.js` suites lifecycle/security.
El script de auditoría histórico de 2026-09-10 describe un defecto anterior y tiene
aserciones de aquella versión; no se usa como prueba de que ese defecto siga vigente.

- 7 grupos lifecycle PASS: permiso default/cancelado/denegado/concedido, reapertura,
  errores temporales Auth/perfil, recuperación de contexto, offline/online y respuestas viejas.
- 6 grupos security PASS: logout, cambio de cuenta, impersonación, backend revocado,
  backend caducado, deduplicación/deep-link/binding ajeno/baja explícita.
- 5 pruebas adicionales de auditoría confirman F2/F3/F4/F5/F6; assertions PASS porque
  verifican la reproducción del defecto, no porque aprueben su conducta productiva.
- 0 errores JS en suites. 0 datos QA productivos. 0 notificaciones de prueba reales.
- La reapertura sana y errores transitorios no destruyeron la activación en el código
  vigente. No atribuirles automáticamente la pérdida reportada.

Runner temporal: `%TEMP%/suti-push-audit-runner.cjs lifecycle` y `... audit`.
Evidencia: `%TEMP%/suti-push-activation-audit/`:
`lifecycle.json`, `extended-audit.json`, `backend.json`, `parity.json`, `build.json`.
Sin screenshots, fixtures o scripts QA nuevos permanentes.

## Corrección recomendada, no ejecutada

1. Invitación propia visible después del login y al volver a primer plano, sólo
   cuando corresponda. Activar / Ahora no; recordatorio acotado, sin modal repetitivo.
2. Separar permiso bloqueado, no solicitado, transporte perdido, desactivación
   deliberada y error de conexión. No llamarlos indistintamente «desactivadas».
3. Conciliar transporte al entrar/volver a la app y tratar cambios de suscripción.
   Recuperar sólo con consentimiento previo y propietario demostrables; nunca
   reactivar a ciegas una revocación, otro usuario o una sesión impersonada.
4. Mantener privacidad al cerrar sesión/cambiar cuenta y ofrecer restauración
   clara al regresar. Definir explícitamente qué debe pasar tras «tomar control».
5. Deduplicación que distinga visualización pendiente/fallida/completada y permita
   recuperación de fallo sin duplicar notificaciones en entregas concurrentes.
6. Ayuda contextual para Android instalado cuando el permiso esté bloqueado.

Un aviso propio puede aparecer al iniciar. El diálogo de permiso del navegador
debe invocarse desde el toque del usuario, no dispararse automáticamente al login.
Fuentes primarias: [MDN Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API),
[MDN pushsubscriptionchange](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event),
[W3C Push API](https://www.w3.org/TR/push-api/).
pushsubscriptionchange tiene compatibilidad limitada; no debe ser el único mecanismo
de recuperación. Las fuentes describen posibilidades del navegador, no prueban
que una concreta haya sucedido en el dispositivo del propietario.

Aceptación futura: reapertura con/sin red, token refresh, primer plano sin focus,
rotación/ausencia de destino, baja explícita, logout/login, cambio de cuenta,
impersonación ida/vuelta, permiso denied/default/granted, fallo showNotification,
deduplicación concurrente y Android instalado real. No crear solicitudes reales.
Si se cambia lógica de sw.js o shell compartido, aplicar la regresión global de
imágenes requerida por AGENTS.md. Esta auditoría no la dispara: no cambia runtime.

## H-REQUEST-PUSH-ACTIVATION-AUDIT-001 RESULT

Status: PASS (auditoría completada); sección auditada: NEEDS_FIX.
Files changed: este informe; docs/AGENT_CHANGELOG.md.
Source-of-truth verdict: SAFE; no nuevas autoridades ni escrituras productivas.
Invariant verdict: PASS para el alcance read-only.
Build: NOT APPLICABLE; runtime sin modificaciones, paridad productiva PASS.
Tests: 7 lifecycle + 6 security + 5 reproducciones; ver distinción arriba.
Security: RLS/grants inspeccionados live; aislamiento funcional en entorno simulado.
Legacy impact: NONE.
Unexpected files changed: 0 propios; cambios previos ajenos preservados.
Known limitations: sin inspección física de Android ni prueba real nocturna; no
se conoce la causa individual de cada baja ni de las 7 revocaciones sin motivo.
Evidence: fuentes/lineas, comandos y agregados consignados arriba.

## SUTIAPP ARCHITECT REVIEW

Task: auditoría de activación/persistencia/invitación push.
Verdict: APPROVED para la auditoría, no aprobación funcional del sistema.
Critical findings: F1/F2/F5/F6; recuperabilidad y estado visible necesitan corrección.
Source of truth: sin cambios. Architecture: sin cambios. Security: fronteras conservadas.
Data: sólo agregados read-only. Legacy: no tocado. Owner decision: NO para cerrar auditoría.
Next action: entregar hallazgos; no implementar ni publicar como parte de esta auditoría.
Response generated for Codex: YES.

RESPONSE TO CODEX: aprobar el informe de auditoría. Entregar el diagnóstico y el
alcance concreto de corrección recomendado. No declarar arregladas las notificaciones,
no reactivar suscripciones y no ampliar automáticamente a implementación.
