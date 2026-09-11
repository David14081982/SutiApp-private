# H-WEB-PUSH-PERSISTENCE-AUDIT-001

## PRE-CHANGE AUDIT

Objetivo: auditar pérdida de activación Push al cerrar la app desde el celular y
reabrirla, sin pulsar Cerrar sesión; explicar el permiso nativo de la segunda imagen.
Autorización: auditoría y diagnóstico solicitados por el propietario.
Alcance: lectura de request-push.js, affiliate-auth.js, app.jsx, sw.js, configuración
del cliente, bundle público, migraciones Push, Edge y pruebas existentes.
Archivos a tocar: este informe; scripts/test-request-push-persistence-audit.js;
docs/qa/evidence/request-push-persistence-20260910/reproduction.json;
docs/qa/evidence/request-push-persistence-20260910/production-parity.json;
docs/qa/evidence/request-push-persistence-20260910/ARCHITECT-REVIEW.md.
Fuera de alcance: cambios runtime, despliegue, migraciones, datos productivos,
envíos de avisos, credenciales, Google, cálculos y modificación de suscripciones reales.
Datos afectados: fixtures en navegador aislado; evidencia técnica sin PII.
Fuentes de verdad: permiso y PushSubscription del navegador; metadata privada de
request_push_subscriptions; Auth y afiliados existentes; IndexedDB es vínculo local.
APIs/tablas: inspección del contrato de RPC Push/Auth; ninguna mutación real.
Legacy involucrado: ninguno; no se inspeccionan cálculos ni sistemas Google.
Invariantes: INV-221/222; permisos por gesto, privacidad por dispositivo, identidad
y destinatarios existentes. Cerrar app no equivale a cerrar sesión.
Riesgo: confundir una reproducción causal con confirmación del incidente físico;
se distinguirán evidencia automatizada, código publicado y observación del teléfono.
Tests: arranque sano, arranque con errores de sesión/afiliado, recuperación,
renovación de contexto, logout y permiso; JS real con IndexedDB real y transportes simulados.
Recovery: sólo archivos nuevos de evidencia; no se requiere rollback productivo.
Navigator: STALE exclusivamente por QA/evidencia de apertura de programas;
discovery dirigido confirma frontend Push, Auth y SW fuera del lookup inicial.
Registry: no se regenera; no cambia arquitectura.
Estado previo: numerosos archivos modificados/no versionados; se conservan íntegros.
Status: PASS para ejecutar auditoría aislada.

## Diagnóstico y evidencia

Defecto reproducido, presente en la lógica publicada: un error transitorio de Auth
se interpreta como pérdida de identidad y cancela una suscripción previamente activa.
No se ha capturado la ejecución del teléfono del propietario: está demostrada la
ruta causal, pero no que ese error concreto haya ocurrido en cada reapertura reportada.

1. `app/affiliate-auth.js:214` publica `phase: 'error'` cuando falla la resolución
   de afiliado/acceso. `:304` hace lo mismo si falla `getSession()` al arrancar.
   `publish` reinicia el afiliado a null; no implica que el usuario haya revocado Push.
2. `app/request-push.js:10` sólo devuelve identidad en fase authenticated, con
   afiliado propio. En error devuelve null, aunque exista sesión del mismo usuario.
3. `:23-25` incluye error entre las fases que revisa `syncIdentity`; compara el dueño
   persistido con null y llama `clearDevice(false)`.
4. `:16-20` borra `binding` de IndexedDB y ejecuta `PushSubscription.unsubscribe()`.
   `false` evita la revocación RPC; NO evita la cancelación local.
5. Al recuperar Auth, `:31-32` necesita suscripción + binding + permiso + estado backend
   para declarar active. Ya faltan los dos primeros; retorna ready y `:69` muestra
   «Activar notificaciones». No hay reconstrucción automática en `state()`.

El permiso continúa granted en todas las reproducciones. La pérdida no es sólo
cosmética: se ejecuta unsubscribe. Cambiar únicamente el texto del botón ocultaría
el problema. Además puede quedar metadata backend marcada activa hasta su limpieza;
no se consultaron ni se cuantificaron registros reales del propietario.

### Prueba controlada

Comando: `node scripts/test-request-push-persistence-audit.js` — exit 0.
Chrome real, código actual de Auth y Push e IndexedDB real. RPC, permiso y proveedor
Push son fixtures aislados; no usa perfil del propietario ni envía notificaciones.
La reapertura es un documento nuevo en el mismo origen; la persistencia del proveedor
Push se simula. No equivale a cerrar/reabrir físicamente Android.

| Escenario | Permiso | Binding/suscripción | Estado posterior |
|---|---|---|---|
| Reapertura sana, misma sesión | granted | Conservados, 0 unsubscribe | active |
| Fallo de consulta del afiliado al reabrir | granted | Borrados, 1 unsubscribe | ready tras recuperar Auth |
| Fallo al leer sesión al reabrir | granted | Borrados, 1 unsubscribe | ready tras recuperar Auth |
| Fallo al refrescar contexto del mismo usuario | granted | Borrados, 1 unsubscribe | ready tras recuperar Auth |
| Cerrar sesión explícitamente | granted | Borrados y revocación RPC | unavailable |

La última fila es el comportamiento documentado por INV-222 y no corresponde a la
acción descrita por el propietario. No hay handler de cierre de app que directamente
borre Push; el borrado demostrado ocurre al procesar el estado Auth.
La actualización de caches en `sw.js:85-90` no borra IndexedDB ni cancela suscripciones.

Las pruebas previas `scripts/test-request-push-browser.js:13` sustituían AffiliateAuth
por una implementación ya autenticada. Su reload (`:37-44`) verifica deduplicación del
worker, sin volver a arrancar Auth y RequestPush juntos. Ese test no cubría este defecto.

### Versión publicada

Comando: `node scripts/test-request-push-persistence-audit.js --production-parity` — exit 0.
Consultado mediante GET público: `https://sutiapp.com/app/bundle.js?v=248`.
La URL documentada GitHub Pages `/SutiApp-private/SutiApp.html` redirige a ese dominio;
no se presenta como dos despliegues independientes. Sintaxis del bundle: PASS.
Auth coincide íntegramente. Push sólo difiere en fontSize (token CSS); toda la lógica
de suscripción/limpieza coincide. Hashes y URLs en production-parity.json.
Una primera comparación estricta detectó esa diferencia tipográfica; la prueba final
la informa expresamente, sin afirmar igualdad byte a byte de ese módulo.
Un intento previo usó `/SutiApp/` y recibió 404; se corrigió a la ruta documentada.

## Segunda imagen y comportamiento esperado

La imagen muestra el diálogo nativo del sistema/navegador; no es un modal de SutiApp.
El código ya llama `Notification.requestPermission()` al pulsar Activar, si no existe
permiso granted. No puede garantizarse la misma apariencia en todos los dispositivos.

- Nunca consultado (`default`): presentar una invitación contextual y pedir permiso
  desde una acción explícita. El navegador decide cómo muestra su diálogo.
- Permitido (`granted`) y suscripción válida: conservar active al reabrir, sin volver
  a pedir permiso.
- Permitido pero suscripción ausente/inválida: distinguir recuperación de suscripción
  de petición de permiso; no fingir active ni resucitar una revocación backend.
- Denegado (`denied`): explicar cómo permitirlo en ajustes; no prometer que se pueda
  forzar nuevamente el diálogo desde la app.
- No compatible: mostrar estado específico. iOS requiere condiciones adicionales
  de web app instalada y gesto del usuario.

Referencias oficiales consultadas:
[MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
y [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
INV-222 ya exige gesto explícito. Solicitar el diálogo automáticamente a todos al
arrancar no es una garantía compatible con estas restricciones.

## Corrección recomendada, no implementada en esta auditoría

Separar error temporal/identidad aún no resuelta de logout confirmado/cambio de cuenta.
Conservar la suscripción propia durante fallos recuperables; mantener los controles
de privacidad en logout, cambio real de usuario e impersonación. Reconsultar el estado
autoritativo al recuperarse la sesión. Definir estados diferenciados para permiso,
suscripción y error; no usar permiso granted por sí solo para declarar Push activo.
No registrar automáticamente una suscripción revocada por el backend. No cambiar
Auth global, RLS, SW o tablas si la corrección focal puede resolver el defecto.

Criterios de aceptación futuros: cerrar/reabrir y refresh con usuario idéntico,
errores transitorios/offline y recuperación sin unsubscribe ni nuevo permiso;
logout/cambio de cuenta/impersonación con privacidad intacta; default/denied/granted,
backend revocado/expirado y errores de RPC diferenciados; prueba física en Android.
La regresión global sólo aplica si se modifica lógica compartida descrita en AGENTS;
la presente auditoría no modifica runtime y no la dispara.

## Guardians y cierre

SOURCE OF TRUTH AUDIT: dominio transporte Push. Autoridades existentes sin cambios;
request_push_subscriptions gobierna registro/revocación backend y el navegador su
permiso/suscripción. IndexedDB es vinculación local, no autoridad de negocio. Lectores
RequestPush y SW; escritores RPC self y emisor de transporte. Sin fallback productivo
nuevo. SAFE respecto al alcance de auditoría; defecto de invalidación local confirmado.

SUPABASE SECURITY REVIEW: inspección estática de migraciones 20260908000700/710 y
Edge. Tablas con RLS forzada y sin acceso directo browser; RPC self y grants explícitos;
VAPID privado y service_role quedan backend. No se ejecutó certificación RLS live ni
se afirma seguridad integral de producción. Ninguna exposición o mutación introducida.

CLAUDE UI PRESERVATION REVIEW: pantalla Notificaciones intacta (header/back, invitación,
estados de lista, eventos/cotizaciones y scroll). Added/missing sections: 0.
Interacciones y navegación no modificadas. Unauthorized redesign: NO. Verdict: PASS
por inspección de alcance; no se implementó el cambio de experiencia solicitado.

```text
H-WEB-PUSH-PERSISTENCE-AUDIT-001 RESULT
Status: PASS — auditoría completada; funcionalidad auditada FAIL en error transitorio.
Files changed: informe, script de reproducción y tres archivos de evidencia/revisión declarados.
Source-of-truth verdict: PASS para auditoría, sin cambios de autoridad.
Invariant verdict: defecto de persistencia documentado; INV-221/222 no modificados.
Build: NOT APPLICABLE regeneración; sintaxis del bundle publicado PASS.
Tests: PASS reproducción de cinco escenarios y cotejo de lógica publicada.
Security: revisión estática; certificación backend live NOT APPLICABLE a cambios de evidencia.
Legacy impact: NONE.
Unexpected files changed: ninguna escritura de esta auditoría fuera del alcance; workspace previo sucio.
Known limitations: incidente físico sin traza; proveedor/RPC simulados; corrección y nueva UX no implementadas.
Evidence: evidence/request-push-persistence-20260910/{reproduction,production-parity}.json,
  ARCHITECT-REVIEW.md; scripts/test-request-push-persistence-audit.js.
```

La comparación global inicial de git status -uall quedó truncada por el volumen de
trabajo previo; no se usa para afirmar integridad byte a byte de todo el workspace.
Las escrituras ejecutadas sólo crearon los cinco archivos declarados. No se hizo
build, commit, deploy, envío, SQL ni modificación de los archivos de aplicación.
