# H-WEB-PUSH-PERSISTENCE-FIX-001

## Candidato autorizado para commit y push ? 2026-09-11 UTC

Preparado sobre origin/main d6bdd8253e0f18dc7b1b203437fd3db538c2f914 en worktree
aislado. Bundle de publicaci?n 249 / cache 195, derivados del main vigente; el build
250/196 descrito abajo corresponde exclusivamente al workspace local antiguo y no
se publica. Tipograf?a productiva preservada; s?lo cambia el m?dulo Push y cachebusters.
Las mismas dos suites lifecycle/security pasan contra este candidato. El harness
normaliza CRLF del checkout Windows para extraer m?dulos, sin cambiar l?gica runtime.
release-scope.json verifica diferencias can?nicas y hash del artefacto a publicar.
La petici?n posterior del owner autoriza commit/push y el despliegue Pages asociado.
M1/M2 manuales siguen pendientes; no se certifica todav?a recepci?n f?sica Android.
El resto de este documento conserva la evidencia cronol?gica de implementaci?n local.

## Ampliación autorizada: commit y push

El propietario pidió «al terminar haz comit push». Autoriza incorporar la corrección
y su evidencia a main; el workflow existente de Pages se ejecuta con ese push.
Se prepara worktree aislado desde origin/main actual, se preserva su tipografía y
se traslada únicamente el delta Push ya probado. No se publica el bundle del workspace
antiguo. Alcance adicional: evidencia release-*.json y preparación dentro del directorio
privado existente; variable opcional del directorio de build en el script focal.
Se repiten las mismas dos suites en el candidato derivado del main vigente; no nuevas
suites ni regresión global. M1/M2 siguen pendientes de participación del propietario.
La autorización posterior sustituye la exclusión inicial de despliegue productivo.

## PRE-CHANGE AUDIT

Objetivo: corregir quirúrgicamente la cancelación Push ante errores transitorios de
Auth, manteniendo privacidad y permiso explícito. Owner autorizó implementación y
dos pruebas automatizadas integrales más dos manuales en su celular.
Alcance: app/request-push.js; artefacto generado app/bundle.js; sólo versiones de
bundle/cache en SutiApp.html y sw.js; scripts/build-request-push-persistence.js;
scripts/test-request-push-persistence.js; este informe; docs/AGENT_CHANGELOG.md;
docs/qa/evidence/request-push-persistence-fix-20260911/* (evidencia, capturas y revisión).
Backup y build aislado: C:/tmp/sutiapp-push-persistence-fix-20260911/.
Fuera de alcance: Auth global, app shell, lógica SW, Edge, SQL/RLS, eventos, destinatarios,
envíos reales sin dispositivo seleccionado, datos financieros/Google y despliegue productivo.
Datos: binding y permiso existentes, sin autoridad nueva. No se modifican datos reales.
Authority: request_push_subscriptions backend; permiso/PushSubscription del navegador;
IndexedDB sólo vincula dispositivo con identidad Auth y suscripción, sin fallback.
Lectores/escritores: RequestPush, SW y RPC self existentes; misma superficie y grants.
Invariantes: INV-221/222, no resucitar revocaciones, no mezclar cuentas ni impersonación.
Plan: conservar binding ante error/loading; invalidar sólo contextos confirmados;
consulta de estado coherente con identidad actual; descartar respuestas UI antiguas;
reintentar lectura cuando vuelve la red. No auto-suscribir ni pedir permiso al cargar.
UI: header/back, tarjeta Push, botón por gesto, estados de error/denegado/incompatible,
lista/eventos/cotizaciones, scroll y navegación conservados. No nuevo diseño.
Riesgo: retener binding no debe permitir suscripción de otra identidad; cubrir carreras.
Pruebas: A1 ciclo de vida/permiso/recuperación/UI; A2 privacidad/estado backend/SW entrega
y deduplicación/click, en harness aislado con código real. M1 Android normal y M2 Android
offline/recuperación requieren propietario y versión corregida en su dispositivo.
Build: reemplazo reproducible del módulo focal, resto de bundle idéntico; cachebusters
son GENERATED_ARTIFACT. Sin modificación real de Auth/app shell/SW compartidos, no se
dispara la regresión global de imágenes (AGENTS.md).
Recovery: backups previos al cambio; restaurar únicamente los archivos de esta H.
Navigator: stale por QA previa; rutas verificadas directamente. Sin arquitectura nueva;
no regenerar Registry por cambios de implementación/evidencia sin mapping nuevo.
Status: PASS para implementar; cierre total condicionado a pruebas manuales reales.

## Implementación local

`syncIdentity` toma el contexto entregado por Auth y sólo cancela la vinculación en
estados confirmados de salida/rechazo o identidad autenticada incompatible. `error`
y `loading` ya no cancelan Push. Capturar el contexto antes de encolar evita perder
un logout rápido al recuperarse Auth antes de la lectura IndexedDB.

`state()` espera la sincronización, captura propietario y vuelve a verificarlo al
resolver las consultas. Auth en error produce estado error, no una invitación falsa
de activación; Auth en carga mantiene loading. No se usa permiso como prueba única
de suscripción activa. No hay registro automático ni rescate de revocaciones backend.

Las consultas UI llevan revisión para descartar respuestas antiguas; online dispara
una lectura nueva. Si focus durante el permiso invalida la lectura de la activación,
su finalización vuelve a consultar el estado vigente. El componente desmontado no
actualiza su estado. Cerrar el diálogo sin decisión conserva ready, distinto de denied.

El markup, estilos y controles de la tarjeta quedan idénticos. No se implementa una
imitación del diálogo Android ni se solicita permiso automáticamente al arrancar.
Una suscripción borrada antes de instalar el arreglo necesita una activación expresa;
este cambio evita el borrado posterior, no recupera metadatos perdidos ni revocados.

## Dos pruebas automatizadas integrales

Ejecutadas contra módulos extraídos del build público local, con código real de Auth,
Push y SW e IndexedDB real en Chrome. RPC, proveedor Push y permiso nativo son dobles
aislados. No se enviaron notificaciones reales ni se escribió backend.

1. `node scripts/test-request-push-persistence.js lifecycle` — PASS.
   Agrupa permiso default/diálogo descartado/denegado/concedido; focus durante alta;
   reapertura sana y con errores de sesión/perfil; refresh de contexto con error;
   RPC offline/online y respuesta antigua tardía. Verifica que se conservan permiso,
   binding y suscripción, con cero unsubscribe y sin volver a pedir permiso tras reabrir.
2. `node scripts/test-request-push-persistence.js security` — PASS.
   Agrupa logout/revocación explícita, cambio de usuario e impersonación; estado backend
   no activo (el RPC booleano representa revocación o expiración); ningún registro
   automático; ocho entregas concurrentes del mismo evento producen un aviso; click
   abre la solicitud correcta; payload de otra suscripción y posterior a revocación
   se ignoran. No sustituye certificación SQL/RLS live ni entrega real de proveedor.

Ambas se ejecutaron sobre un primer build y se repitieron sobre el build final al
incorporar el caso de focus durante suscripción. Son las mismas dos suites, sin
ampliación a una batería global. La primera ejecución pasó; la repetición es necesaria
por el ajuste de integración posterior. Capturas: permission-ready.png,
connection-error.png y active-preserved.png (tarjeta aislada, no pantalla completa).

## Build, alcance y conservación

`node scripts/build-request-push-persistence.js` — PASS. Build final: bundle 250,
worker cache 196, directorio privado `C:/tmp/sutiapp-push-persistence-fix-20260911/site-250`.
Reemplazo de un único módulo compilado; el resto del bundle permanece byte a byte.
SW/HTML sólo cambian versiones. Sintaxis validada antes de escribir; empaquetado mediante
build-pages-site existente, configuración pública por allowlist y evidencia sin secretos.
`build.json` identifica hash y `productionDeployed: false`.

`scope.json` compara hashes del workspace contra 2910 archivos iniciales y verifica
que no hay cambios imprevistos; markup/estilos Push idénticos, Auth y app shell intactos.
Backup de los archivos previos y manifiesto completos fuera del repositorio.
No se modificaron SQL, RLS, Edge, autoridades, identidad de negocio, Google ni cálculos.
Regresión global NOT APPLICABLE: sólo lógica focal y GENERATED_ARTIFACT/cachebusters
según la excepción explícita de AGENTS.md. Registry no cambia: mismas dependencias,
RPC, tablas, lectores y escritores; freshness deriva del código/evidencia modificados.

## Dos pruebas manuales acordadas

M1 — BLOCKED hasta versión corregida disponible en el teléfono y participación owner:
activar una vez si ya estaba borrada, cerrar desde aplicaciones recientes, reabrir;
comprobar estado activo; recibir un aviso técnico expresamente autorizado y abrirlo.

M2 — BLOCKED por las mismas condiciones: abrir sin internet y recuperar conexión;
comprobar que vuelve a activo; recibir un aviso nuevo. No se afirma que los avisos
perdidos antes de la activación se reenvíen, ni se fabrican eventos financieros.

No se han ejecutado ni se califican PASS con simulaciones. El arreglo está preparado
localmente y no se publicó; las dos pruebas reales permanecen pendientes.

## Guardians

SOURCE OF TRUTH: SAFE. Permiso/PushSubscription de navegador y registro privado backend
mantienen sus responsabilidades; binding conservado es vínculo, nunca estado de negocio
ni sustituto de RPC. Fallo visible; cero fallback nuevo, cero alta automática.

SECURITY: PASS para el alcance del cambio frontend, con pruebas de frontera aisladas;
sin certificación backend adicional porque RPC, RLS y grants no se modificaron.
No se altera auth_user_id, numero_control, destinatario ni actor/contexto. Cero secretos
introducidos en código; fixtures sólo en scripts de prueba no incluidos en build.

CLAUDE UI PRESERVATION REVIEW: tarjeta y pantalla existentes; missing/added sections 0;
controles, estructura y estilos idénticos, navegación conservada; mejoras exclusivas
de ciclo de estado. Unauthorized redesign NO. Verdict PASS por diff y capturas focales.

```text
H-WEB-PUSH-PERSISTENCE-FIX-001 RESULT
Status: BLOCKED para cierre integral; implementación y verificación automatizada local PASS.
Files changed: app/request-push.js; GENERATED_ARTIFACT app/bundle.js, SutiApp.html,
  sw.js (sólo cachebusters); dos scripts focales; QA/evidencia y AGENT_CHANGELOG.
Source-of-truth verdict: PASS, mismas autoridades/RPC, sin recuperación automática de revocados.
Invariant verdict: PASS automatizado, privacidad/permiso/deduplicación preservados.
Build: PASS, bundle 250 / cache 196; no publicado.
Tests: 2 suites integrales PASS; M1/M2 manuales BLOCKED por disponibilidad de versión y celular.
Security: PASS alcance frontend; backend sin cambios, no se afirma certificación live nueva.
Legacy impact: NONE.
Unexpected files changed: 0, según scope.json y baseline por hashes.
Known limitations: proveedor/permiso simulados en automatización; Android físico pendiente;
  activación expresa necesaria si el defecto anterior ya había borrado la suscripción.
Evidence: docs/qa/evidence/request-push-persistence-fix-20260911/ y scripts focales.
```
