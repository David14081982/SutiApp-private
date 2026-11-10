# H-HISTORIAL-ARCHIVE-REMOVAL-001

## PRE-CHANGE AUDIT

- Objetivo y autorización: el propietario solicita quitar toda la sección «Solicitudes archivadas» de Historial.
- Alcance: retirar exclusivamente el montaje de ArchivedDocumentEvidence en HistorialScreen; regenerar sólo su módulo del bundle y actualizar su cachebuster HTML.
- Archivos: app/screens-historial.jsx, app/bundle.js (GENERATED_ARTIFACT), SutiApp.html (cachebuster), este informe, docs/AGENT_CHANGELOG.md y docs/qa/evidence/historial-archive-removal/. Temporales y respaldo en .tmp/historial-archive-removal/.
- Fuera de alcance: componente compartido, Administración, RPC, permisos, SQL, Storage, datos, Google, cálculos, sw.js y publicación externa.
- Autoridad: solicitudes operativas y evidencia documental conservan las autoridades Supabase existentes; el historial financiero conserva su lector vigente. No hay nuevos escritores ni fuentes alternativas.
- Datos afectados: ninguno; se elimina el consumidor visual y su consulta de archivos al abrir Historial, sin borrar registros.
- Invariantes: conservar cabecera, avisos, FarmaHistory, solicitud en curso, filtros, tarjetas, estados de carga/error/vacío, seguimiento y navegación. La autorización backend permanece igual: retirar UI no equivale a revocar acceso técnico.
- Riesgo: bajo, cambio focal reversible. Workspace con cambios previos; conservar bytes de los demás módulos del bundle.
- Navigator: lookup historial STALE; inspección directa de pantalla y dependencia documental. No cambian rutas, contratos de datos ni permisos. El índice previo sigue stale; no regenerar globalmente incorporando cambios ajenos para declarar freshness ficticia.
- Verificación: sintaxis/build focal; diff contra respaldo; pruebas existentes de historial y navegador aislado móvil/escritorio; comprobar ausencia del archivo con integración documental habilitada y preservación de los otros controles.
- Regresión global de imágenes: NOT APPLICABLE, sin cambios de repositorios/helpers compartidos, assets, visor, shell, Auth ni sw.js. Bundle y cachebuster son artefactos focales conforme AGENTS.md.
- Recovery: reponer únicamente la línea retirada, regenerar el módulo y avanzar cachebuster; respaldos locales previos preservados.
- Status: PASS para implementación local. No implica despliegue ni certificación nueva de permisos productivos.

## Ampliación focal de alcance

Se retira una dependencia de pantalla: HistorialScreen deja de montar ArchivedDocumentEvidence. Se actualiza únicamente ese hecho derivado en las particiones del Architecture Registry (SUTIAPP_ARCHITECTURE_REGISTRY.json, registry-code.json, registry-data.json, registry-edges.json, registry-search.json, sólo si cambia su contenido). Se conservan los hashes/hechos previos de todos los demás archivos y el estado STALE. No se ejecuta la regeneración global que absorbería cambios preexistentes ajenos. Se verificará que cualquier diferencia de hechos corresponda exclusivamente a app/screens-historial.jsx.

## Verificación y cierre

- Build: `node docs/qa/evidence/historial-archive-removal/build.cjs C:/tmp/babel-standalone-7.28.4.min.js` PASS. Regenerado únicamente screens-historial.jsx; prefijo/sufijo del bundle intactos. Cachebuster local 2026111003.
- `node scripts/test-loan-history.js`: siete comprobaciones PASS, incluidos permisos/contexto en PostgreSQL aislado; sin llamadas productivas. Evidencia core.json.
- `SUTI_HISTORY_EVIDENCE_DIR=docs/qa/evidence/historial-archive-removal node scripts/test-loan-history-browser.js`: PASS, 320/390/1440 px; filtros, detalle, timeline, regreso, errores, cambio de identidad y ausencia de overflow horizontal.
- `.tmp/historial-archive-removal/verify-compiled.cjs`: PASS usando el módulo real del bundle. Integración documental habilitada durante la comprobación inicial de Historial, cero montajes de ArchivedDocumentEvidence, ausencia del título/sección y orden hero → filtros → tarjetas. Se deshabilita el adaptador sintético para reutilizar las pruebas existentes de detalle, que no incluyen el backend documental. Red bloqueada y datos sintéticos sólo en harness aislado.
- El primer intento del harness adicional no inyectó la comprobación por CRLF; corregido antes de ejecutar. El segundo habilitaba integración documental también en detalles sin sus dependencias, causando timeout del harness. Se limitó esa activación a la comprobación inicial de Historial. La última ejecución completa pasa en las tres anchuras; no se modificó producto para resolver el harness.
- Inspección visual de historial-390.png: seguimiento y filtros recuperan su posición; no existe lista de archivos. Cabecera sintética del harness: no certifica pixel-perfect de toda la app desplegada.
- scope.json demuestra eliminación exacta de una línea frente al respaldo, cambio exclusivo del cachebuster y conservación de los módulos ajenos. Componente compartido y montajes Admin conservados.
- Sin nuevas consultas, mocks productivos, fallbacks, escritores, cambios de permisos, Storage, SQL, Google ni cálculos financieros.
- La suite de core escribe su salida determinística habitual; copia de evidencia en esta H. El estado Git no incorporó rutas inesperadas fuera del alcance declarado.

## CLAUDE UI PRESERVATION REVIEW

Screen: Mi Historial.
Original sections: cabecera, aviso, archivo documental, FarmaHistory, solicitud activa, filtros, nota, estados, tarjetas.
Current sections: mismas, salvo archivo documental retirado por autorización explícita.
Missing sections: únicamente la sección solicitada.
Added sections: ninguna.
Interactions preserved: filtros, tracking, detalle, regreso, retry y manejo de contexto PASS en harness.
Navigation preserved: PASS focal.
Visual structure preserved: PASS, retirada focal autorizada.
Unauthorized redesign: NO.
Verdict: PASS.

## H-HISTORIAL-ARCHIVE-REMOVAL-001 RESULT

Status: PASS local.
Files changed: app/screens-historial.jsx; app/bundle.js; SutiApp.html; índice derivado focal (detalle registry.json); este informe; docs/AGENT_CHANGELOG.md; docs/qa/evidence/historial-archive-removal/.
Source-of-truth verdict: PASS; autoridades y registros intactos, consumidor archivado retirado de Historial.
Invariant verdict: PASS; resto de estructura/interacciones conservado.
Build: PASS focal.
Tests: PASS, core 7 checks y navegador de fuentes/bundle en 320/390/1440 px.
Security: no se monta el lector archivado en Historial; permisos backend sin cambios. No equivale a revocación técnica ni auditoría productiva nueva.
Legacy impact: ninguno; sin acceso/escrituras Google ni cambio financiero.
Unexpected files changed: ninguno detectado fuera del alcance; cambios previos preservados.
Known limitations: NO PUBLICADO. Registry conserva STALE por cambios previos ajenos. Pruebas de UI aisladas; no sesión productiva.
Evidence: ../qa/evidence/historial-archive-removal/{build,scope,core,browser,compiled-browser,registry}.json y capturas.

## SUTIAPP ARCHITECT REVIEW

Task: retirada local de Solicitudes archivadas en Mi Historial.
Verdict: APPROVED para el alcance local implementado.
Critical findings: ninguna regresión focal detectada; la publicación no se ha realizado.
Source of truth: sin cambios; no se elimina el archivo histórico.
Architecture: un montaje menos; componente compartido y Administración intactos; bundle focal con prefijo/sufijo preservados.
Security: se retira este acceso visual/consulta; no se amplían ni se revocan permisos backend.
Data: sin escrituras.
Legacy: sin impacto.
Owner decision: NO para este cambio local ya autorizado.
Next action: conservar este resultado preparado; una publicación debe transportar únicamente el cambio focal y verificar el bundle servido, sin incluir cambios previos ajenos.
Response generated for Codex: YES.

## RESPONSE TO CODEX

Aprobar la retirada local de H-HISTORIAL-ARCHIVE-REMOVAL-001. No presentar el sitio público como corregido antes de publicar y comprobar el artefacto servido. Preservar archivos históricos, permisos, montajes Admin y cambios ajenos del workspace. Este cierre no ejecuta una continuación ni concede autorización adicional.

## Publicación autorizada — 2026-11-10

El propietario respondió «hazlo» a la indicación de que el cambio aún no estaba publicado. Se autoriza completar publicación y verificación en sutiapp.com.

Alcance ampliado: candidato aislado en .tmp/historial-archive-removal/release basado en main remoto, con traslado de la eliminación de un montaje, regeneración exclusiva del módulo screens-historial, cachebuster HTML, índice derivado focal si corresponde, auditoría y evidencias. Commit allowlisted sin force y ejecución del workflow Pages existente. No copiar el workspace completo ni cambios previos ajenos. sw.js, backend, permisos, documentos, datos y Google siguen fuera de alcance.

Verificación: comparar cada archivo contra el main remoto base; build Pages del candidato, pruebas focales del bundle, revisión independiente, workflow SUCCESS y hashes HTTP del HTML/bundle publicado. Recuperación: commit inverso del cambio focal, sin borrados históricos ni reset del repositorio.

## Validación del candidato publicado

Base remota: 4afa77107ad661272d110b21d145e306cd3b1a65. La base ya utilizaba bundle 2026111003; el candidato avanza exclusivamente ese cachebuster a 2026111004. La fuente Historial coincide, normalizando CRLF, con la fuente validada localmente. El diff runtime contra main comprende sólo una línea de montaje retirada y su fragmento compilado; los demás módulos, sw.js y consumidores Admin se conservan.

Build Pages del candidato: PASS, 34 archivos públicos; se usan valores sintéticos únicamente para el ensayo local de empaquetado. El workflow productivo conserva sus secrets existentes. Primer build incompleto por un archivo de evidencia fuera del sparse checkout; se obtuvo ese archivo del mismo commit, sin sustituir el contrato.

La prueba histórica test-loan-history-browser.js de la base conserva un fixture anterior sin sync_state y no completa con el repositorio publicado vigente. No se cambió producto. La verificación del candidato utiliza setup de test-history-snapshot-browser.js (contrato vigente) y el módulo compilado real, con integración documental habilitada para verificar ausencia de archivo, filtros y jerarquía. release-browser.json: PASS, 320/390/1440 px, cero montajes y cero solicitudes externas. La prueba focal de solicitudes nativas se registra por separado.

Revisión independiente: runtime focal correcto; el primer regenerado del índice reconstruía cuatro relaciones ajenas existentes en los hechos históricos. Se corrigieron sólo esas diferencias y backlinks/nota para conservar el baseline remoto y publicar únicamente la dependencia retirada de Historial. No se alteran las fuentes ajenas.

Prueba vigente `scripts/test-history-native-pending-browser.js`: PASS en 320/390/1440 px; solicitudes canónicas, deduplicación, tracking nativo, errores de fuente, cambios de identidad, retorno, scroll y conservación de préstamos/PDF. Evidencia native-pending-browser.json.

Revisión independiente final: APPROVED para commit/push autorizado. Se restauraron las cuatro aristas ajenas, backlinks y health.notes; registry-data vuelve idéntico a HEAD. Sólo tres particiones tienen delta focal; edges 31383 → 31381, nodos/aristas/hechos/hashes ajenos iguales por IDs. Build, navegador compilado, solicitudes nativas, sintaxis y diff checks PASS. Publicación pendiente de workflow y comparación HTTP en este commit.
