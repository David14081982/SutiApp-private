# H-REQUEST-PUSH-REOPEN-001

## PRE-CHANGE AUDIT

- Objetivo: corregir pérdida de activación al cerrar/abrir la app sin cerrar sesión, reportada por personas que ya aceptaron push.
- Alcance: ciclo de recuperación/registro del transporte push ante errores transitorios de Auth; pruebas aisladas del módulo y sus consumidores existentes.
- Fuera de alcance: logout, opt-out, permisos nativos, autoridad del consentimiento, SQL/Edge, finanzas, Google, envíos reales y despliegue.
- Archivos a tocar: `app/request-push.js`; `scripts/test-request-push-persistence.js`; nuevo `scripts/build-request-push-reopen.js`; `app/bundle.js`, `SutiApp.html`, `sw.js` sólo artefacto/cachebusters; este informe; append en `docs/AGENT_CHANGELOG.md`; `docs/qa/evidence/request-push-reopen-20261001/`.
- Datos afectados: únicamente vínculo técnico de dispositivo durante operación previamente autorizada; no datos de negocio ni cambios de esquema.
- Fuentes de verdad: permiso nativo en navegador; consentimiento en `request_push_subscriptions`; IndexedDB sólo vínculo técnico existente. Error nunca acredita consentimiento.
- Tablas/APIs: RPC existentes get config/status, register/revoke self. Sin modificación del contrato o acceso directo a tablas.
- Legacy involucrado: ninguno; no ejecutar suites que escriben Supabase o Google.
- Invariantes: INV-221/222; permiso sólo por gesto; no resucitar revocación; cuenta/impersonación/logout eliminan transporte; error temporal no equivale a logout.
- Riesgo: confundir un error temporal con cambio real de identidad. Cubrir explícitamente interrupciones en subscribe/register, registro reemplazado, recuperación, revocación y cambio de cuenta.
- Tests: suites lifecycle/security de Chrome con IndexedDB real y transporte/RPC aislados; build focal y comparación de bytes ajenos. Regresión global local/Pages si se modifica helper compartido; no ampliar a cambios fuera del alcance para resolver defectos previos.
- Recovery: snapshot previo de archivos propios en `tmp/push-reopen-20261001/before/`; restaurar únicamente delta propio, preservando cambios previos. Sin migraciones.
- Status: PASS para implementación focal tras reproducción.

## Contexto y autoridad

Navigator: `check` FRESH; lookup push identifica esquema pero no ciclo frontend, por lo que se siguió discovery dirigido. Fuente publicada `https://sutiapp.com/app/bundle.js?v=308` coincide exactamente con `app/request-push.js` local antes de esta H (SHA-256 `4f17032026b257f097948055ceb60459367a78f3eae11baef8ec8928f0d2d595`). GitHub Pages redirige al mismo dominio. Comprobación pública de lectura, sin credenciales.

Dominio: transporte Web Push por usuario/dispositivo. Lectores: RequestPush, RequestPushInvitation (inicio, Mi Historial y Farma), worker existente. Escritores: register/revoke self RPC; IndexedDB técnico por RequestPush. Backend/RLS determina dueño y consentimiento. Cero mocks/fallbacks productivos; fixtures sólo Chrome aislado. SOURCE OF TRUTH AUDIT: SAFE.

UI existente: invitación de inicio y panel persistente en Historial/Farma; título, explicación, activar/restablecer, desactivar, ayuda, reintentar y Ahora no; estados loading/ready/active/repair/denied/error/unsupported. Se preservan componentes, orden, estilos, scroll, navegación y copy. No rediseño.

## Hallazgos previos

Reapertura sana ya recupera transporte con permiso granted, vínculo propio y consentimiento backend vigente. Cerrar sesión revoca por diseño y no es el caso reportado. Las 24 horas pertenecen sólo a Ahora no; no explican la pérdida de activación. Hipótesis en reproducción: `bind` trata `identity() === null` durante error Auth igual que cambio de usuario, cancelando una suscripción que el backend acaba de registrar y perdiendo su nuevo identificador.

No se puede atribuir la causa individual de todos los dispositivos sin inspeccionarlos. La aceptación exige reproducir el defecto concreto y demostrar su corrección, sin afirmar verificación física Android/iOS.

## Implementación y evidencia

La reproducción aislada confirmó el defecto en la ventana posterior al `put(binding)` y anterior a completar la transacción IndexedDB: Auth falla, el permiso sigue granted, `bind` borra el vínculo y cancela el transporte; después de `AffiliateAuth.retry()` el estado queda `repair`. Durante `register` también se cancelaba indebidamente el transporte. Ver `reproduction-before.json`; su SHA incluye el salto final de la fuente (la paridad pública usa fuente normalizada sin ese salto).

La corrección añade `retainsOwner` exclusivamente para decidir limpieza: sólo conserva transporte del mismo `session.user.id` en `loading/error`, sin impersonación ni afiliado contradictorio. `identity` estricta continúa autorizando RPC y estado activo. Un RPC ya completado puede guardar su ID propio mientras Auth se revalida; su resultado no se anuncia activo hasta revalidación. Logout, cambio de usuario, impersonación e inelegibilidad siguen eliminando vinculación. No se interpreta granted como consentimiento backend ni se recrea una suscripción revocada.

Límite de recuperación: un dispositivo cuyo vínculo ya fue eliminado antes de instalar la corrección puede necesitar una acción manual de Restablecer notificaciones. Se previene la pérdida reproducida; no se inventa prueba de propiedad para un vínculo inexistente ni se reactivan bajas previas.

Build focal: `node scripts/build-request-push-reopen.js` → PASS; bundle 309, worker URL/cachebuster 240, SHA-256 `86135327ac447203f079e1692e0f7e6a84105711c7f72dc4f9707654cd21f9d0`. Comparación contra snapshot del workspace, no contra HEAD: otros módulos del bundle idénticos; HTML y SW sólo cachebusters. No se publicó.

Pruebas reproducibles:

```powershell
$env:SUTIAPP_PUSH_EVIDENCE='docs/qa/evidence/request-push-reopen-20261001'
node scripts/test-request-push-persistence.js lifecycle
node scripts/test-request-push-persistence.js security
```

Resultado: lifecycle 20 escenarios agrupados PASS; security 12 PASS; cero pageerrors. Nuevas ventanas: recuperación y activación × subscribe/register/fin de escritura IndexedDB; ID de suscripción real del fixture por endpoint/usuario; posterior recarga conserva ID y permiso; logout/cambio/impersonación durante register no vinculan al usuario equivocado. Alta inicial interrumpida antes de register requiere acción explícita de restablecer y no solicita nuevamente permiso concedido. Transporte y RPC son fixtures aislados; Auth, React y IndexedDB son reales.

`verification.json` demuestra sintaxis, correspondencia fuente/build/pruebas, UI byte a byte idéntica, módulos ajenos idénticos y ausencia de lógica nueva en SW. No se modificó ningún dato de negocio ni se enviaron notificaciones reales.

Regresión global requerida por el helper compartido: script canónico `scripts/test-global-image-regression-production-live.js`, tanto build local como Pages, assets legítimos y sin bridge/fixtures de backend. Un primer intento de lectura de red fue denegado por el sandbox; se reejecutó con escalación aprobada. Esto no fue un rechazo de aprobación automática.

El primer origen local `http://127.0.0.1:8776` produjo `DOCUMENT_PREVIEW_UNAVAILABLE`: document-access restringe CORS a orígenes configurados. La evidencia histórica `docs/qa/evidence/auth-entry-20260907/DELIVERY.md` identifica `http://localhost:8080` como origen ya permitido. Se corrigió exclusivamente el comando/servidor de prueba para usar ese origen; no se alteró CORS, backend ni protección documental.

Registry: check inicial FRESH; final STALE por hash de `request-push.js`, prueba focal, cachebuster HTML y nuevos archivos de evidencia/build. Discovery dirigido confirmó que no cambió ruta, dependencia, repository, RPC, tabla, permiso ni autoridad. No se regeneró el índice derivado sólo para ocultar freshness; se conserva el diagnóstico STALE explícito.

## Guardians

SOURCE OF TRUTH AUDIT: SAFE. Consentimiento Supabase, permiso nativo y vínculo técnico conservan sus papeles; `retainsOwner` no autoriza lecturas/escrituras ni acredita consentimiento.

SUPABASE SECURITY REVIEW: PASS para delta frontend; identidad estricta en registro/lectura y pruebas de aislamiento, sin cambios a Auth global/RLS/grants/Edge ni secretos. No se afirma nueva certificación live de políticas no modificadas.

CLAUDE UI PRESERVATION REVIEW: PASS. Inicio, Mi Historial y Farma conservan todos sus controles, estados, copy, estilos, orden, scroll y navegación; cuerpo del componente idéntico al snapshot previo. Missing sections: ninguna. Added sections: ninguna. Unauthorized redesign: NO.

Legacy impact: NOT APPLICABLE. Database migration: NOT APPLICABLE. No se inspeccionó ni modificó lógica financiera/Google.

## H-REQUEST-PUSH-REOPEN-001 RESULT

```text
Status: PASS (corrección local verificada; no desplegada).
Files changed: app/request-push.js; scripts/test-request-push-persistence.js;
  scripts/build-request-push-reopen.js; app/bundle.js; SutiApp.html; sw.js;
  docs/audits/H-REQUEST-PUSH-REOPEN-001.md; docs/AGENT_CHANGELOG.md;
  docs/qa/evidence/request-push-reopen-20261001/.
Source-of-truth verdict: SAFE; no cambio de autoridad/consentimiento.
Invariant verdict: PASS; INV-221/222, identidad estricta, bajas respetadas.
Build: PASS; focal, módulos ajenos idénticos; SHA registrado en build.json.
Tests: PASS; 20 lifecycle + 12 security, global local y Pages PASS.
Security: PASS para delta; cero datos de negocio modificados/notificaciones enviadas.
Legacy impact: NOT APPLICABLE; sin cambios legacy/financieros.
Unexpected files changed: 0 propios; cambios previos del workspace preservados.
Known limitations: sin despliegue ni dispositivos físicos Android/iOS; causa
  reproducida no equivale a diagnóstico individual de todas las personas.
  Vínculos ya perdidos pueden requerir restablecer manualmente una vez.
  Registry STALE documentado por hashes/evidencia, sin cambios arquitectónicos.
Evidence: docs/qa/evidence/request-push-reopen-20261001/:
  reproduction-before.json, published-before.json, build.json,
  lifecycle.json, security.json, verification.json,
  global-local.json, global-pages.json, scope.json.
```

La regresión local verificó exactamente el SHA del bundle candidato. En ambos entornos pasaron 194 assets, 29 documentos imagen, 226 imágenes de programas, Login/sello, foto de perfil, Admin Afiliados, Membership/Préstamo, Marketplace, galería/fullscreen, refresh y comparación con/sin service worker; PDF legítimo abierto con HTTP 200. Cero browser errors. La prueba de Pages corresponde a la versión publicada disponible en ese momento y no demuestra publicación del candidato; su hash no fue fijado por el script. Paridad pública previa y build local son evidencias distintas.

## ARCHITECT REVIEW

Task reviewed: H-REQUEST-PUSH-REOPEN-001.
Verdict: APPROVED — corrección local verificada, sin despliegue.
What Codex did correctly: reprodujo la carrera y corrigió sólo limpieza indebida; retainsOwner no autoriza RPC ni estado activo.
Important findings: hashes/build/UI/módulos contrastados independientemente; 20 lifecycle, 12 security y global local/Pages PASS. La prueba local fija el bundle candidato.
Problems detected: ninguno en el delta; WORK_QUEUE_HISTORY.md ausente y orquestadores citados no disponibles, sin autorización de autocontinuación.
Architecture implications: sin cambio estructural; Registry STALE explicado con discovery dirigido.
Source-of-truth implications: consentimiento backend, permiso nativo y vínculo técnico conservan sus funciones; no registro automático tras revocación.
Security implications: identidad estricta y limpieza de logout/cuenta/impersonación preservadas incluso durante registro pendiente.
Data implications: sin cambios de negocio/migraciones/envíos reales.
Owner decision required: NO para cierre local.
Recommended next action: entregar resultado y límites; no publicado, sin certificación física Android/iOS, vínculos ya perdidos pueden requerir restablecer.

### RESPONSE TO CODEX

Apruebo H-REQUEST-PUSH-REOPEN-001 en su alcance local. Incorporar revisión y actualizar hash del informe en scope.json; entregar al propietario distinguiendo candidato local de versión disponible en Pages. No autoriza despliegue ni otra H.

```text
SUTIAPP ARCHITECT REVIEW
Task: H-REQUEST-PUSH-REOPEN-001
Verdict: APPROVED
Critical findings: ninguno
Source of truth: SAFE
Architecture: preservada
Security: PASS para delta
Data: sin cambios de negocio
Legacy: NOT APPLICABLE
Owner decision: NO
Next action: cierre y comunicación local; sin autocontinuación
Response generated for Codex: YES
```

## Publicación autorizada — 2026-10-02

Owner: «Publicala». Autoriza publicar la corrección revisada y verificar su entrega.

PRE-CHANGE AUDIT (ampliación de entrega): preparar checkout aislado `.tmp/push-reopen-release-20261002` desde `origin/main`; comparar fuente push vigente con baseline auditada; aplicar exclusivamente delta push y prueba focal; regenerar sólo chunk push sobre bundle remoto actual y actualizar cachebusters. Incluir este informe, append propio de changelog y evidencia de esta H. No incluir cambios locales ajenos ni usar el bundle local anterior como sustituto de la versión remota vigente. No modificar backend, datos, permisos o lógica del worker.

Archivos de entrega: `app/request-push.js`, `scripts/test-request-push-persistence.js`, `app/bundle.js`, `SutiApp.html`, `sw.js` sólo cachebusters; `docs/audits/H-REQUEST-PUSH-REOPEN-001.md`, append `docs/AGENT_CHANGELOG.md`, `docs/qa/evidence/request-push-reopen-20261001/`. Preparación privada reproducible y logs en `.tmp/push-reopen-20261002/`. Recovery: revertir únicamente commit focal de publicación, conservando historia y sin modificar datos. Verificación: pruebas focales sobre paquete final, controles de build/deployment CI, paridad fuente/bundle publicada y regresión global local/Pages con SHA esperado. Status: PASS para preparar/publicar dentro de autorización owner; resultado final por registrar.


### Paquete final de entrega

Base remota `509a891ebe200927df49c0a3967ee164edeea6cc`; bundle 309 / worker 241. SHA-256 bundle `3ff40ca532537a37524dc486a20244a1a9e57523b1ceab50db0f12bfe17bb82b`. Fuente push identica a la correccion revisada; todos los otros chunks publicados preservados. Build publico PASS, lifecycle 20 PASS, security 12 PASS y regresion global local PASS sobre SHA exacto con assets legitimos y PDF. Evidencia release-package.json, release-lifecycle.json, release-security.json, release-global-local.json. Listo para commit/push autorizado; entrega remota se verificara despues del workflow.
