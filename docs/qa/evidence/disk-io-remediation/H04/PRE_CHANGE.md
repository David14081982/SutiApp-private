# H04 — Pre-change audit

Precondiciones: H01/H02/H03 STATUS: PASS comprobados. Navigator FRESH; lookup de master_private_storage_authorized_read y discovery dirigido contra catálogo live. Autoridad: solicitud explícita H04 y Protocolo Maestro.

Objetivo: mismo acceso documental/fotos/activos privados y mucha menos evaluación RLS. No cambiar permisos, identidad, auditoría, clasificación, estados, writers, URLs ni buckets.

Alcance inicial: policy master_private_storage_authorized_read, joins storage.objects/private_assets/affiliate_files/affiliate_documents, índices existentes y posibles índices de las dos referencias documentales. Analizar también RLS de esas tablas y sus dependencias de identidad, permisos, impersonación y catálogo privado. Leer catálogo de funciones/policies/grants para demostrar ausencia de cambios colaterales. No editar getters ni otras policies sin ampliar primero esta auditoría con evidencia concreta.

Archivos previstos: evidencia H04/**, nueva migración y recovery 20260907000400_private_storage_rls_work.sql, pruebas focales scripts/test-private-storage-rls-work.js si conviene; Registry derivado sólo por cambio real de policy/índice/dependencia, índice de remediación y apéndice AGENT_CHANGELOG. No fuentes frontend, bundle ni worker. Se permite checkout de entrega aislado C:/tmp/sutiapp-h04-release-20260907 y build público allowlist C:/tmp/sutiapp-h04-20260907-site para verificación global; no servir el repositorio ni secretos. Ampliar alcance antes de editar otros archivos.

Datos y autoridad: Supabase conserva tablas, relaciones y RLS. No otra autoridad, fallback ni caché de autorización. Las consultas de prueba usan authenticated y claims controlados; privilegios administrativos se reservan para catálogo, preparación y transacciones de prueba con rollback. No service_role en browser. No publicar Storage, omitir auditoría ni alterar históricos.

Plan: capturar definiciones/firma/owner/grants/search_path, RLS/ACL/índices y baseline fresh; EXPLAIN de la consulta real como authenticated antes de crear índices; comparar ramas indexables, índice(s) sólo si el plan los justifica, y contexto por statement sólo donde sea semánticamente constante. Probar candidatos en transacciones revertidas o entorno aislado antes del despliegue mínimo. No crear los dos índices por rutina.

Matriz antes/después: dueño, otro afiliado, Admin autorizado/no autorizado, impersonación; documento activo/archivado/rechazado/expirado, foto, INE/documento y activos privados de programas. Comparar autorización completa, incluyendo las otras policies permisivas. Usar identificadores sólo en memoria/SQL; evidencia sin rutas privadas, URLs firmadas ni PII. Las combinaciones sin datos reales pueden usar fixtures estrictamente transaccionales y revertidos, identificadas como tales.

Performance: filas y loops por nodo, buffers, scans, tiempo y multiplicación de funciones RLS; distinguir nodo/suma y muestras del host. Sin reset de estadísticas, reinicios ni sesiones eliminadas. El orden de joins y el OR requieren prueba de equivalencia, no sólo una intuición de velocidad.

Recovery: definición live completa y guards de drift; restituir exactamente policy/índices de esta H. Probar rollback antes de cerrar. Sin cambios de datos que recuperar.

Precisión del harness tras inspección de schema: fixtures sólo dentro de transacciones revertidas en private_assets, affiliate_files, affiliate_documents, storage.objects y catálogo privado; reutilizar identidades reales existentes sin modificar Auth/afiliados. Para perfiles administrativos e impersonación, crear rol/asignación temporal en admin_roles/admin_role_permissions/admin_assignments para una identidad sin asignación, y usar la función vigente de impersonación con su auditoría dentro del mismo rollback. No insertar blobs ni tocar bucket/configuración. Las ventanas que alteren la policy candidata se mantienen breves, después de medir la baseline; timeouts y rollback automático ante fallo. El catálogo no tiene estado documental EXPIRED ni fecha de expiración: no inventar una regla; comprobar documento antiguo, expiración de impersonación y URL firmada como mecanismos reales, documentando esta distinción.

Guardians aplicados: pre-change-audit, source-of-truth-guardian, database-migration-guardian, supabase-security-review, legacy-google-guardian READ ONLY en dependencias, post-change-verification. Regresión global local/GitHub Pages obligatoria si se modifica Storage privado; UI preservation al cierre aun sin editar pantallas. Architect reviewer después del cierre. No iniciar otra H.

Status: PASS para investigar y preparar candidatos dentro del alcance; H04 todavía no está cerrada.
