# H06 — guardians

## SOURCE OF TRUTH AUDIT

Domain: catálogo de programas, vínculos/media, favoritos y expediente.
Authority: tablas/RPC Supabase y Storage privado existentes; documentos vía document-access.
Readers: repositories y consumidores declarados en PRE_CHANGE.md.
Writers: mismos RPC/funciones; sin escritura financiera, documental ni histórica H06.
Alternative sources / fallbacks: ninguna añadida. Estados de carga/error no sustituyen datos.
Caches: proyecciones efímeras existentes por contexto y firma dentro de una instancia montada hasta su deadline. Promesas compartidas sólo en vuelo. Sin persistencia de nuevas autoridades privadas.
Verdict: SAFE.

## SUPABASE SECURITY REVIEW

Auth/business identity: actor, sesión/token, afiliado efectivo, impersonación y asignación Admin en contexto de deduplicación; no se cambia identidad.
RLS/grants: 253 funciones/228 policies/ACL/owners iguales; Storage privado y JWT del Edge conservados.
Frontend exposure: sin secretos ni service role; token sólo comparado en closure existente del cliente.
Cross-user access: respuestas tardías rechazadas; logout real elimina proyecciones; 192 resultados RLS idénticos, pruebas aisladas de cambios de usuario/sesión/permiso/propósito/target.
Audit: listados y aperturas conservan backend; open documental siempre pide autorización nueva. Un único trabajo en vuelo equivale a una intención simultánea, no a eludir auditoría.
Verdict local: PASS. Publicado se confirma en VERIFICATION.md.

## LEGACY GOOGLE AUDIT

Systems/domains: programa Préstamo y presentación de productos.
Reads: selector de metadatos del programa prestamo, acotado al mismo programa antes filtrado en cliente.
Writes/calculations/triggers: ninguno modificado; find, payload, elegibilidad, precios/modalidades y RPC financieras conservados.
Authority: las mismas autoridades declaradas; Google/Apps Script no se consultan ni modifican.
Equivalence: JSON completo comercial, writers intactos, suites comerciales/Préstamo/globales.
Classification: SAFE CHANGE del lector no financiero; sin cambio legacy.

## DATABASE MIGRATION AUDIT

Schema/SQL mutation: NOT APPLICABLE. Sólo catálogo/EXPLAIN read-only y fixtures de seguridad nuevos con ROLLBACK. No índice, migration, policy, function, trigger, grant ni owner cambiado. Hashes de datos preservados.

## CLAUDE UI PRESERVATION REVIEW

Screen: ProductScreen, CatalogItemScreen, ProgramProductsModule/editor, DocumentRequirementList y visor compartido.
Original sections / current sections: las mismas; hero, beneficios, disponibles, tarjetas, estados, CTA; galería/snap/dots/contador/fullscreen/info; programas/conteos/filas/editor/medios/controles; documentos/estados/cámara/reemplazo/viewer.
Missing sections: ninguna.
Added sections: ninguna.
Interactions preserved: scroll, siguiente/anterior, zoom/cierre, abrir/cerrar editor, filtros de programa, favoritos (prueba aislada), acciones comerciales y documentales.
Navigation preserved: sí, navegación real y logout/login verificados.
Visual structure preserved: sí; mismos hashes de texto, campos y controles Admin, nueve slots e imágenes del editor; sin cambios CSS/copy de negocio.
Unauthorized redesign: NO.
Verdict local: PASS; regresión publicada requerida para el cierre.
