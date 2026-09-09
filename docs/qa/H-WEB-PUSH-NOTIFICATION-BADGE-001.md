# H-WEB-PUSH-NOTIFICATION-BADGE-001

## PRE-CHANGE AUDIT

Objetivo: corregir el cuadro blanco del badge Android usando el puño transparente adjunto
por el propietario. Autorización: pidió solucionar el defecto y entregó el asset solicitado.
Alcance: badge de notificaciones, distribución del archivo y cachebuster del service worker.
Archivos a tocar: icon-notification-badge.png, sw.js, SutiApp.html,
scripts/build-pages-site.js, scripts/test-request-push-badge.js,
este documento, evidence/request-push-badge-20260908/* y docs/AGENT_CHANGELOG.md.
Fuera de alcance: logo a color, bundle, pantallas, suscripciones, payloads, envío, SQL/Edge,
Auth, identidad, solicitudes, eventos, datos financieros y Google legacy.
Datos afectados: sólo asset gráfico proporcionado por el propietario; copia exacta sin redibujo.
Fuentes de verdad: asset versionado para badge; solicitudes/eventos/afiliados sin cambios.
Lectores: showNotification.badge y cache del SW. Escritores: despliegue del asset aprobado.
Tablas/APIs: ninguna modificación. Legacy involucrado: ninguno.
Invariantes: icon a color intacto; identidad, permiso opt-in, dedup y enlaces intactos.
Riesgo: SW compartido requiere regresión global local/Pages; asset debe existir en build.
Tests: transparencia y silueta, handler real y URLs icon/badge, deduplicación/click,
build público, regresión global local/Pages y hashes de publicación.
Recovery: restaurar badge previo y retirar nuevo precache mediante commit con versión SW
superior; no modificar suscripciones ni borrar datos. El logo original sigue disponible.
Navigator: stale sólo QA/bitácora/tests de cierre previo; SW y build inspeccionados directamente.
Registry: sin cambio de arquitectura; asset gráfico y referencia de presentación existentes.
Status: PASS.

## SOURCE OF TRUTH AUDIT

Domain: identidad gráfica del badge. Authority: archivo adjunto aprobado, copia versionada.
Readers: SW/notificaciones Android. Writers: publicación GitHub Pages.
Alternative sources/Fallbacks: ninguno. Cache: precache versionado del mismo archivo.
Conflicts: ninguno. Verdict: SAFE. No cambios en autoridades de negocio.

## Verificación

Asset del propietario copiado sin alteraciones: PNG 500×500, 147808 píxeles completamente
transparentes de 250000; cuatro esquinas alpha 0. SHA256:
`cbd41b39c7cef9ea64b8fa0a3b6c80d9a556aab003e8e7e41abb3a771754e70d`.
Android utiliza su máscara alpha; el sombreado RGB del original no añade un fondo opaco.
El badge ahora usa icon-notification-badge.png y el icon conserva icon-192.png.
El asset se incluye en la allowlist del build público y precache; SW 181, bundle 233 intacto.

Build público PASS, 23 archivos. Handler real en contrato browser aislado PASS: asset descargado
y decodificado en canvas, transparencia, URLs separadas, deduplicación y notificationclick.
Comparación del SW contra b104a8c demuestra que sólo cambian badge, precache y versión;
manifest equivalente salvo saltos de línea de checkout; bundle y logo a color idénticos.
Secretos frontend: 0, contra valores privados reales; ninguna modificación backend o financiera.

CLAUDE UI PRESERVATION REVIEW: pantalla de notificación del sistema; título, cuerpo,
icon a color, navegación, dedup y permiso conservados. Sólo se reemplaza el badge defectuoso
autorizado. Pantallas internas sin cambios. Missing sections: 0. Unauthorized redesign: NO.
Verdict: PASS.

Regresiones globales local y GitHub Pages PASS: login/sello, perfil, Admin Afiliados,
documentos imagen/PDF legítimos, Membership, Préstamo, catálogo/galería, Marketplace,
fullscreen, refresh y comparación con/sin service worker. Cero errores browser y cero
mutaciones de datos de producción. Ver global-local.json y global-production.json.

Publicado e3fdf3630af5060ae1f3f4f38809470b7215d8cd mediante
[Pages 34307875429 SUCCESS](https://github.com/David14081982/SutiApp-private/actions/runs/34307875429).
HTML, SW, badge, logo a color y bundle de ambos dominios coinciden con el commit.
El test del badge publicado pasa descarga/alpha, handler real, deduplicación y enlace.

La apariencia nativa de una nueva notificación Android tras este ajuste no se observó
físicamente: los tests comprueban el asset transparente y la configuración entregada.
La recepción Android de la infraestructura está documentada en la H previa. Esta H no
envió avisos adicionales ni cambió suscripciones. Los avisos ya mostrados conservan su icono;
el cambio se aplica a nuevos avisos cuando la PWA actualice al SW 181.

H-WEB-PUSH-NOTIFICATION-BADGE-001 RESULT
Status: PASS.
Files changed: icon-notification-badge.png, sw.js, SutiApp.html, scripts/build-pages-site.js,
  scripts/test-request-push-badge.js, QA/evidencia y docs/AGENT_CHANGELOG.md.
Source-of-truth verdict: PASS — asset aprobado versionado; autoridad de negocio intacta.
Invariant verdict: PASS — icon a color, bundle, Auth, dedup y navegación preservados.
Build: PASS — artefacto público 23 archivos, SW 181 y bundle 233 intacto.
Tests: PASS — badge local/producción, regresión global local/Pages y hashes en ambos dominios.
Security: PASS — 0 secretos frontend; sin cambios RLS, Edge, Auth o destinatarios.
Legacy impact: NONE — sin cambios de datos, cálculos, Google ni writers financieros.
Unexpected files changed: 0 en release; trabajo local previo preservado.
Known limitations: apariencia nativa del nuevo badge no observada en dispositivo físico;
  imagen y handler verificados automáticamente. Avisos anteriores no se redibujan.
Evidence: docs/qa/evidence/request-push-badge-20260908/*.json y ARCHITECT-REVIEW.md.
