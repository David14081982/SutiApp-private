# H-REQUEST-PUSH-ACTIVATION-FIX-001

## AUDIT / AUTHORITY / PLAN / RISK

Autorización: después de la auditoría y de explicar la recuperación, el aviso
inicial y la corrección de entrega, el propietario indicó «hazlo de forma quirurgica».
La restricción anterior «no hagas código» correspondía a explicar la propuesta;
esta instrucción posterior autoriza implementarla.

Alcance declarado antes de editar runtime: app/request-push.js, app/app.jsx
(montaje de invitación), sw.js (deduplicación y aviso de cambio de transporte),
app/bundle.js y SutiApp.html (artefacto/versiones),
scripts/test-request-push-persistence.js (pruebas focales reutilizables), este
informe, informe de auditoría precedente y docs/AGENT_CHANGELOG.md. Registry:
únicamente evidencia/dependencias de esta feature si el nuevo consumidor lo exige;
preservar modificaciones preexistentes ajenas.

Navigator: lookup request push; código y migraciones contrastados en la auditoría
precedente. Registry derivado con cambios ajenos: no usarlo como autoridad.
Guardians: pre-change-audit, source-of-truth-guardian,
supabase-security-review, claude-ui-preservation-guardian y post-change-verification.
Supabase sigue siendo autoridad de identidad, consentimiento registrado y eventos;
IndexedDB contiene sólo vinculación de dispositivo, deduplicación y preferencias
de presentación. Ningún permiso se solicita sin clic. Recuperación automática sólo
para el mismo usuario, permiso granted y registro backend vigente. Un estado false
no distingue caducidad de baja: exige restauración explícita.

Plan: conciliar transporte al abrir/volver, conservar transporte ante error de
red, distinguir estados y ofrecer invitación inicial posponible; conservar baja,
logout, cambio de cuenta e impersonación; reservar deduplicación antes de mostrar
y finalizarla después del éxito. Pruebas focales de permisos/concurrencia/privacidad,
build y regresión global de imágenes local/productiva obligatoria por shell/sw.

Riesgos: carreras de identidad y activación; duplicados/fallos del worker; invitación
repetitiva; regresión del shell. Mitigaciones: serialización, validación de propietario,
reserva con vencimiento, pausa de 24 horas, baja explícita recordada para no insistir.
Sin migración, cambios legacy, envío de mensajes reales ni autorización de solicitudes.
No es posible demostrar una prueba nocturna física de Android desde este entorno.

## VERIFY / EVIDENCE

Implementado: conciliación serializada de permiso/suscripción/vínculo backend;
fingerprint técnico del transporte para detectar rotación sin registrar en cada
lectura; recuperación automática sólo con registro vigente del mismo propietario;
error explícito y timeout de red de 20 s. Recuperar no acusa eventos de solicitudes.
Logout, cambio de cuenta e impersonación eliminan el vínculo de dispositivo.

La tarjeta original conserva título, descripción, radio, sombra y CTA. Inicio
reutiliza el mismo componente cuando no hay una ruta/popup superpuesto; «Ahora no»
pospone 24 h por usuario/dispositivo. La baja explícita suprime futuras invitaciones
hasta una activación manual en Configuración. Permiso bloqueado ofrece ayuda;
granted sin registro vigente ofrece Restablecer; error de red ofrece Reintentar.
Se actualiza al volver visible, pageshow, focus, online, controllerchange y aviso
del worker. No se solicita permiso desde login ni desde esos eventos.

El worker reserva evento por 60 s, termina deduplicación después de showNotification,
reintenta una vez el fallo de visualización y libera la reserva al fallar. Revalida
el vínculo antes de cada intento. Los IDs completados anteriores siguen válidos.
Un worker interrumpido deja una reserva recuperable; no se promete redelivery del
proveedor. pushsubscriptionchange sólo avisa al frontend autenticado; sin JWT en SW.

Pruebas, evidencia en `%TEMP%/suti-push-activation-fix/` (sin datos reales):

- `node scripts/test-request-push-persistence.js lifecycle`: PASS, 14 escenarios
  agrupados, permisos/errores/reapertura/rotación/recuperación/invitación/baja.
- `node scripts/test-request-push-persistence.js security`: PASS, 9 escenarios
  agrupados; incluye cambio de cuenta durante subscribe pendiente, revocación,
  impersonación y ocho entregas concurrentes por evento.
- `SUTIAPP_TEST_BUNDLE=app/bundle.js SUTIAPP_TEST_MOBILE=1 node
  scripts/test-request-event-notifications-browser.js`: PASS; celebración existente,
  carreras de contexto/propietario, 21 combinaciones responsive y navegación.
- `node scripts/test-pages-deployment.js`: PASS; PWA y cero archivos prohibidos.
- `node --check app/bundle.js`, `node --check sw.js` y diff --check focal: PASS.
- Build Pages aislado: PASS. Bundle 289 / worker 223. Sólo dos chunks modificados
  (request-push.js y app.jsx); 132 chunks ajenos idénticos a HEAD. SHA-256 LF:
  `8b67435c130c8ae923abfe0d7edb4338ece13ab71ccbe8f1a5048e3ed7adba2f`.
- Capturas aisladas: startup-invitation.png, permission-ready.png,
  active-preserved.png, connection-error.png; tarjeta móvil inspeccionada.

Regresión global obligatoria: primer intento restringido falló por
ERR_NETWORK_ACCESS_DENIED. Con red, los puertos locales 8789/8790 fallaron con
DOCUMENT_PREVIEW_UNAVAILABLE. Causa identificada: CORS de document-access rechaza
esos orígenes. La evidencia preexistente
`docs/qa/evidence/screen-permission-fix-20260924/local-environment-corrections.json`
documenta localhost:8080 como origen de pruebas autorizado. Se repite allí, sin
alterar políticas ni backend. Pages vigente v288 pasó todas las familias y PDF:
194 assets, 29 documentos imagen, 226 imágenes de programas, Admin, visor,
refresh y sin SW; cero errores de navegador. Evidencia:
global-production-baseline.json. No es todavía evidencia de v289 publicado.

Build final en `http://localhost:8080/SutiApp.html`: PASS en todas las familias,
incluido PDF real HTTP 200 / application/pdf / visor abierto, Admin Afiliados,
galería, fullscreen, refresh y comparación con/sin SW. Cero errores de navegador
y cero mutaciones de negocio. SHA ejecutado coincide con build.json. Evidencia:
global-local-authorized-origin.json. El intento desde un origen no permitido fue
un error de configuración de la prueba, corregido sin alterar el producto.

Autoridades/RLS/grants: sin cambio; get_self_request_push_status verifica auth.uid,
afiliado efectivo, revocación y vencimiento. Register/revoke siguen siendo self-only.
Sin acceso directo browser a las tablas push, sin claves privilegiadas frontend.
Pruebas aisladas no sustituyen una prueba física nocturna en Android instalado.

Registry: App ya dependía de RequestPushInvitation en NotifsScreen. El montaje
adicional no crea route, export, repository, RPC, tabla, permiso o dependencia entre
módulos nueva. El índice sigue STALE por hashes y cambios preexistentes; se conserva
intacto y se usa evidencia directa del código, sin declararlo falsamente FRESH.

CLAUDE UI PRESERVATION REVIEW: sección Notificaciones y shell. Secciones originales
conservadas; invitación de Inicio autorizada añadida; navegación, scroll y controles
originales conservados. Sin rediseño ajeno. Regresión de assets pendiente del gate.

## Revisión del candidato antes de publicación

SUPABASE SECURITY REVIEW: PASS para el delta frontend/SW; backend sin cambios.
SOURCE OF TRUTH / INVARIANTS: PASS; no autoridad paralela ni fallback productivo.
CLAUDE UI PRESERVATION REVIEW: PASS; regresión global local completa.
SUTIAPP ARCHITECT REVIEW: APPROVED para publicar el candidato verificado y repetir
la regresión contra el hash publicado. No cerrar todavía como producción PASS.
La revisión contrasta diff y pruebas, no implica un segundo agente. WORK_QUEUE
corresponde a otra fase legacy; esta H tiene instrucción directa del propietario.
No autocontinuar a tareas de esa cola. WORK_QUEUE_HISTORY.md no está presente.

RESPONSE TO CODEX: publicar exclusivamente los archivos declarados de esta H;
preservar cambios ajenos. Verificar Pages, paridad y regresión global del candidato
publicado; registrar resultado y detenerse. No instalar migraciones ni enviar push
reales para las pruebas. Mantener explícita la limitación de Android físico.
