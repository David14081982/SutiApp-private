# PRE-CHANGE AUDIT — H06

Status: PASS (autoriza implementar y verificar; no constituye cierre H06).

## AUDIT / AUTHORITY

Solicitud explícita H06 y Protocolo Maestro. H01–H05 tienen `Hxx STATUS: PASS` en sus VERIFICATION.md. Registry FRESH verificado; lookup program-catalog-repository y discovery dirigido de sus consumidores. Supabase es autoridad para program_catalog_items, program_catalog_item_assets, favoritos, private_assets y expediente documental. Storage privado conserva RLS; document-access conserva autorización y auditoría por intención. No Google/Apps Script ni cálculos financieros.

Causas confirmadas: listItems consulta todos los productos y vínculos y firma todos los privados; catalogStore conserva la promesa (no se atribuyen llamadas a cada render); Admin carga galerías antes de seleccionar programa. DocumentRequirementList autoriza miniaturas por referencias requirements/documents, incluso cuando la variante no representa miniaturas. Abrir un documento debe seguir solicitando autorización nueva (INV-122/126/127).

## PLAN / RISK

Separar consulta de catálogo por programa y metadatos de imágenes; resolver imágenes por demanda visible. Deduplicar únicamente solicitudes idénticas en vuelo, aisladas por actor, sesión, afiliado efectivo, impersonación y contexto administrativo. No convertir firmas ni memoria cliente en autoridad. Invalidar respuestas tardías al cambiar contexto. Mantener TTL actuales, errores controlados y renovación tras expiración. No paginar visualmente ni omitir productos; conservar orden, favoritos, cantidades, galerías y controles.

Alcance permitido: app/program-catalog-repository.js, app/catalog-store.jsx, app/program-catalog-admin-store.jsx, app/screens-marketplace.jsx, app/screens-catalogo.jsx, app/screens-admin-program-products.jsx, app/document-workflow-repository.js, app/screens-documentos.jsx; helper focal nuevo app/private-resource-demand.js y su inclusión en scripts/build-bundle.js si necesaria. app/screens-loan.jsx únicamente selector del catálogo, sin cambiar payload, elegibilidad, cálculos ni confirmación financiera. app/screens-admin-documents.jsx sólo si se confirma repetición equivalente. Artefactos generados app/bundle.js, SutiApp.html, sw.js; tests focales scripts/test-catalog-resource-demand*.js; evidencia H06, índice disk-io-remediation/README.md, docs/AGENT_CHANGELOG.md y Registry derivado. Checkout de release aislado desde main H05 para excluir trabajo previo.

Fuera de alcance: H07, SQL/migraciones/índices, cambios Auth/RLS/Edge/TTL/buckets/roles, datos de productos o documentos, saldos/precios/reglas financieras, históricos, limpieza incidental y cambios pendientes ajenos. Si aparece necesidad de ampliar, actualizar primero esta auditoría.

Ampliación auditada antes de editar: app/image-viewer.jsx, únicamente un renderer de imagen opcional para resolver la imagen seleccionada, conservando fuentes URL existentes y todos los controles/gestos/dimensiones. El visor filtra hoy entradas sin URL; por ello no basta entregarle enlaces aún no firmados. Sin este adaptador sería necesario firmar toda la galería para conservar su contador y navegación. Regresión global ya obligatoria; probar adicionalmente contrato default y renderer. Baseline de este archivo capturado antes de editar.

Ampliación de tests tras focal-first.json: scripts/test-program-catalog-cutover.js y scripts/test-program-products-admin-cutover.js contienen aserciones literales que exigen cargar todo el catálogo; actualizar exclusivamente esas aserciones al lector autoritativo acotado. scripts/test-membership-document-thumbnail-viewer.js exige el texto exacto de render anterior; actualizar para exigir además el guard de contexto nuevo. Las restantes reglas originales continúan probándose, más pruebas conductuales H06. No adaptar código productivo para conservar una carga anticipada que H06 pide eliminar.

Build auditado: Git en Windows materializa fuentes sin cambios como CRLF. El builder publicado anterior conserva esos CRLF en comentarios/chunks; regenerar así introduce diferencias mecánicas en 74 módulos. scripts/build-bundle.js del release normalizará entradas CRLF→LF, como ya hace el builder del workspace, para demostrar exactamente diez módulos existentes cambiados y uno añadido. No se publican los otros cambios pendientes del builder (módulos Savings). La normalización no cambia código ejecutado, datos, estilos ni reglas; la equivalencia de artefactos se verifica normalizando saltos de línea, además de compilar y comparar chunks.

Riesgos: respuesta obsoleta entre identidades, firmas vencidas, pérdida de imágenes/orden, enlaces omitidos al guardar Admin, divergencia publicado/workspace. Mitigar con generación/contexto, baseline completo, pruebas de carrera, no reutilizar firmas asentadas entre intenciones, escritores intactos, comparación de catálogo completo y regresión global real.

## Contrato UI

ProductScreen: hero, título, beneficios, acciones, disponibles, tarjetas, estados, CTA y navegación. CatalogCard: mismo diseño/imagen/precio/sold; grid completo y orden. Detalle: galería/snap/dots/contador/lightbox, información y acciones comerciales intactas. Admin: programas/conteos/filtros/productos/imagen/conteo/editor/reordenar/activar y todos sus controles. Documentos: tiles/iconos/estados/observaciones/cámara/reemplazo/viewer; variantes sin miniaturas no necesitan firmas anticipadas. Sin copy, CSS ni rediseño autorizado.

## VERIFY / EVIDENCE / Recovery

Capturar hashes del workspace, fuentes publicadas y backend/grants/RLS; counts/lecturas/firmas/HTTP/RPC/bytes/tiempo antes/después sin secretos, URLs firmadas ni contenido privado. Comparar productos/vínculos/orden/comercialización completos. Probar filtros/favoritos/scroll/galería/navegación/Admin/afiliado, contexto/logout/login/impersonación, denegaciones, rechazados/archivados, expiración y deduplicación. Build y tests focales, scripts/test-global-image-regression-production-live.js local y GitHub Pages, preservación UI, scope/secret scan, Registry y post-change-verification. Revisión arquitectónica al cierre. Rollback frontend a blobs publicados H05; sin rollback de datos porque no se modifican. No emitir PASS sin evidencia completa.
