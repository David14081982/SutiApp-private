# H04 — Baseline

Precondiciones comprobadas en VERIFICATION.md de H01, H02 y H03: PASS. Metadata live completa en BASELINE.json; captura inmediatamente anterior al despliegue en backend-before-deploy.json. Incluyen 228 policies, 252 funciones con definición/firma/owner/ACL/SECURITY/search_path/volatility, RLS y ACL de tablas, columnas, constraints e índices. Inventario: 3.518 documentos, 12.901 affiliate_files, 13.131 private_assets y 13.150 objetos privados. Bucket público: false.

Se reprodujo la consulta exacta y el selector de afiliado de la auditoría, bajo authenticated y claims del afiliado, sin bypass de RLS: 3.044 documentos examinados, 28.164 shared buffer hits, cero shared reads y 2.035,627 ms en esta muestra fresca. El valor histórico fue aproximadamente 8,21 s; las condiciones del host y caché varían. Otra muestra con un afiliado escogido por ORDER BY termina antes: 1.632 hits y 127,608 ms. Ambas se conservan, sin confundir selectores.

La captura de pg_stat_xact_user_functions usa SET LOCAL track_functions='all', que se revierte al terminar. La foto exacta requiere 6.172 llamadas a has_admin_permission, 6.172 a su delegado y 3.113 a get_effective_affiliate_id antes de la corrección. No sumar tiempos inclusivos de funciones anidadas.

Callers: Storage privado para foto/documentos mediante AssetRepository, AffiliateRepository y DocumentWorkflowRepository; documento self/admin conserva sus RPC de autorización y Edge Function document-access con auditoría. Las policies enlazan private_assets, affiliate_files, affiliate_documents e identidad/permisos; el catálogo tiene otra policy permisiva independiente. Sus definiciones live constan en BASELINE.json.

El schema documental no tiene estado EXPIRED ni fecha de vencimiento. No se inventa esa regla: la matriz cubre un documento VERIFIED antiguo, impersonación vencida y una URL firmada real que primero devuelve 200 y tras su TTL queda rechazada. Archivado corresponde a HISTORICAL_DOCUMENT_VERSION en affiliate_files, sin confundirlo con un estado inexistente de affiliate_documents.
