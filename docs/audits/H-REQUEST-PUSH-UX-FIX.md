# H-REQUEST-PUSH-UX-FIX

## Publicación autorizada — 2026-11-10

Instrucción posterior del propietario: «haz commit push y despliega». Autoriza empaquetar y publicar exclusivamente esta H. Se prepara un checkout aislado de origin/main y se aplica el delta contra el snapshot previo; no se copia el bundle sucio ni cambios de otras tareas. El commit actualiza sólo las dos fuentes focales, sus chunks compilados, versiones HTML/SW, prueba y evidencia de esta H. La política de logout y el backend permanecen intactos. La comprobación posterior será de entrega y paridad del artefacto público, sin repetir las cuatro pruebas funcionales ya aprobadas ni enviar mensajes reales. Los resultados anteriores de implementación local se conservan como evidencia histórica.

Publicación completada: commit `0801bc84bb2fa8330fc99d88e176e51f528ecf19`, push a main; [GitHub Pages run 42880069168](https://github.com/David14081982/SutiApp-private/actions/runs/42880069168) SUCCESS para ese SHA. Versión pública `2026111003`; HTML de entrada, SutiApp.html, bundle y SW devuelven HTTP 200 y hashes idénticos al paquete aislado. Bundle publicado SHA-256 `ca7f1f309f3b1a608e5eabcf9ee9ff328d0ddc59e6fd8fd105179318c7375f40`. Evidencia: `release-package.json` y `deployment.json`. Módulos ajenos del bundle remoto conservados; App remoto cambia sólo el montaje push. Las cuatro verificaciones funcionales previas no se repitieron; permiso/proveedor/RPC siguen siendo los dobles aislados declarados. Cero mensajes reales y cero escrituras de datos productivos. Status de entrega: PASS.

## Alcance autorizado

La instrucción prioritaria del propietario limita el adjunto a correcciones puntuales de notificaciones y cuatro verificaciones aisladas. Sustituye sus apartados que proponían ampliar el ciclo de logout o baterías de pruebas, y el requisito general de regresión global cuando entra en conflicto con este límite explícito. No autoriza publicación, cambios de Auth, política de logout, SQL, RLS, roles ni datos productivos.

Se reutilizó H-PUSH-BANNER-AUDIT y su inspección del código vigente; no se repitió una auditoría global. Navigator: mismo dominio y dependencias App → RequestPush → RPC existentes; sin rutas, schema, autoridades o servicios nuevos. No se regenera el índice derivado por este cambio interno de montaje/presentación.

## PRE-CHANGE AUDIT

- Objetivo: eliminar el aviso automático de Inicio conservando comprobación/recuperación y gestión desde la campanita.
- Alcance declarado antes de editar: `app/app.jsx` (únicamente montaje push); `app/request-push.js` (ciclo sin UI y estados/presentación); `app/bundle.js`, `SutiApp.html`, `sw.js` (artefacto focal/versiones); `scripts/test-request-push-ux-fix.js` (cuatro verificaciones); este informe, `docs/AGENT_CHANGELOG.md` y `docs/qa/evidence/request-push-ux-fix/` (evidencia).
- Cada fuente es indispensable: retirar sólo el componente visible sin conservar sus listeners eliminaría la recuperación al reabrir/volver a primer plano; el módulo push conserva esos listeners en un componente que devuelve null. El bundle debe incorporar ambas fuentes y las versiones permiten entregar el artefacto actualizado.
- Datos/autoridad: permiso y suscripción nativos; consentimiento remoto en `request_push_subscriptions`; IndexedDB sólo vinculación técnica y preferencia local existentes. No nueva persistencia, tabla ni autoridad.
- APIs: get config/status y register/revoke self existentes, sin modificaciones de contrato.
- Fuera de alcance: Auth, logout, routing, historial/campana/conteos, Farma como módulo, finanzas, Google, envío real y despliegue.
- Invariantes: no permiso sin gesto; no recuperación de revocación sin acción; identidad propia y aislamiento conservados; error no acredita baja ni éxito.
- Riesgo: retirar inadvertidamente la reconciliación junto con el aviso, o confundir disabled/error con repair. Cubierto por las cuatro verificaciones.
- Recovery: snapshot exacto de seis archivos previos en `tmp/request-push-ux-fix/before/`, con SHA-256; preservar cambios ajenos existentes al revertir sólo este delta.
- Status: PASS para implementación focal.

## Corrección

`App` sustituye únicamente la instancia automática por `RequestPushLifecycle`, sin DOM. Éste y `RequestPushInvitation` reutilizan exactamente los listeners mediante un hook privado dentro del mismo archivo. Inicio no monta invitación ni reemplazo visual. Notificaciones mantiene el componente y su historial independiente; Farma conserva su consumidor existente.

El estado activo en Notificaciones presenta una opción discreta desplegable nativa con los controles existentes. No hay modal ni flujo nuevo. La ayuda de permiso distingue Android, iPhone/iPad y escritorio. `enable` no vuelve a llamar requestPermission con denied/granted.

La preferencia disabled deja de presentarse como primera activación y evita recuperación automática incluso si una baja anterior quedó incompleta. Un permiso denied conserva la ayuda para desbloquearlo. Tras awaits se revalida el propietario antes de publicar disabled. Los motivos de repair distinguen vínculo ausente, ajeno y registro remoto no vigente; no se inventa distinción entre revocado/expirado porque la RPC sólo devuelve booleano. Los códigos viven en el resultado de estado, sin logs, claves ni endpoints.

No se modifican `identity`, `retainsOwner`, `clearDevice`, `syncIdentity`, `bind`, `subscribe`, Auth, SQL, Edge ni lógica SW. Cerrar la app conserva la activación; logout sigue revocándola y el siguiente ingreso puede requerir acción desde Notificaciones con el permiso ya concedido. No se introduce una preferencia que anule esa política.

## Verificación

Build focal: sólo recompila request-push.js y app.jsx (Babel existente); verifica paridad con fuentes y preservación byte a byte de otros módulos. HTML/SW sólo cambian versiones. El primer intento detectó que app.jsx del bundle usa Babel y detuvo la escritura; el build final usa el mismo compilador y su evidencia está en `build.json`.

Única ejecución funcional: `node scripts/test-request-push-ux-fix.js`, con cuatro comprobaciones: interface, persistence, recovery, security. Las cuatro pasaron en la primera ejecución, sin repeticiones. Permisos/proveedor/RPC simulados en entorno aislado, IndexedDB real y código de App/Auth/Push/SW del bundle; red externa bloqueada. No prueba de producción ni mensajes reales.

| Verificación | Resultado y evidencia |
| --- | --- |
| Interfaz | PASS, `interface.json`: cabecera antes/después x=0, y=0, ancho=390, alto=251; cero banners; campanita permite restablecer/configurar. Shell/TopBar reales y proveedores ajenos aislados. |
| Persistencia | PASS, `persistence.json`: cerrar página y abrir otra con almacenamiento conservado mantiene binding y active; cero permisos, registros o suscripciones nuevos. Permiso/proveedor restaurados por el entorno aislado. |
| Recuperación | PASS, `recovery.json`: transporte ausente recuperado una vez con vínculo válido; reevaluar no repite registro/suscripción; fallo de red conserva vínculo; baja requiere acción explícita; disabled no se recupera automáticamente. |
| Seguridad | PASS, `security.json`: handler SW aislado ignora binding ajeno, mensajes de cuenta previa y posteriores a logout; logout revoca y elimina vinculación/suscripción. RPC de propiedad simulada; no nueva certificación de RLS productiva. |

Cero errores de navegador. Todos los resultados corresponden a bundle SHA-256 `db2c3b9bfda5ffd5a4dc7d8bbc48ce7ff46d0149cc4c0671977fae4fd5f29578`, versión `2026111002`.

## Guardians y revisión final

Source of truth: SAFE; mismas autoridades y escritores, sin fallback nuevo ni almacenamiento de negocio. UI preservation: PASS en alcance autorizado; delta shell de una línea, TopBar/historial/conteos intactos y posición verificada. Security: PASS para aislamiento frontend/SW comprobado; no se atribuye a la prueba simulada certificación nueva de RLS o de entrega física. Database/legacy: NOT APPLICABLE, sin cambios.

Revisión independiente read-only del delta contra snapshot y cinco JSON: APPROVED. No defectos nuevos encontrados. Instrucción siguiente para Codex: cerrar esta H con resultados y límites; no ampliar alcance, publicar ni repetir verificaciones. Owner decision: NO para entregar corrección local. Response generated for Codex: YES.

## H-REQUEST-PUSH-UX-FIX RESULT

```text
Status: PASS (implementación y cuatro verificaciones aisladas; no desplegada).
Files changed: app/app.jsx; app/request-push.js; app/bundle.js;
  SutiApp.html; sw.js (sólo versiones); scripts/test-request-push-ux-fix.js;
  docs/audits/H-REQUEST-PUSH-UX-FIX.md; docs/AGENT_CHANGELOG.md;
  docs/qa/evidence/request-push-ux-fix/{build,interface,persistence,recovery,security}.json.
Root cause: invitación insertada asíncronamente en flex vertical antes de Inicio;
  distinta situación técnica agrupada en repair y disabled presentado como ready.
Source-of-truth verdict: SAFE, sin cambios de autoridad.
Invariant verdict: PASS en alcance autorizado; misma política de logout y propiedad.
Build: PASS focal; módulos ajenos y lógica SW idénticos, versión 2026111002.
Tests: 4/4 PASS, primera ejecución, sin envíos ni datos productivos.
Security: PASS aislamiento local; Auth/RLS/roles/SQL sin cambios.
Legacy impact: NOT APPLICABLE.
Unexpected files changed: ninguno por esta H; cambios previos preservados.
Known limitations: sin despliegue, dispositivo físico ni certificación RLS live;
  logout sigue revocando y puede requerir activar desde campanita al reingresar.
Evidence: docs/qa/evidence/request-push-ux-fix/ y snapshot local previo.
```
