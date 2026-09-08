# H04 — Guardians

AUDIT → AUTHORITY → PLAN → RISK: PASS para la implementación autorizada. Navigator y discovery live identifican el predicado y todas las policies permisivas relacionadas. Autoridad explícita: solicitud H04 del propietario; H01/H02/H03 PASS.

SOURCE OF TRUTH: SAFE. Supabase conserva la autoridad de documentos, assets, relaciones, identidad y permisos. Los lectores y escritores productivos no cambian. No caché, mocks, fuente paralela ni fallback productivo.

DATABASE MIGRATION AUDIT: PASS previo al despliegue. Un ALTER POLICY USING, sin datos ni schema estructural. PK/FK/UNIQUE/nullability/defaults/índices permanecen. Matriz de equivalencia 192 casos y recuperación exacta ensayada; guards de drift y timeouts. Los triggers de fixtures continúan activos y sus efectos se revierten. Evidencia: policy-definitions.json, matrix-*.json, recovery-rehearsal.json.

SUPABASE SECURITY: PASS previo al despliegue. SELECT authenticated y RLS anidada, owner/permisos, rechazo cruzado, Admin con/sin assets.read, documents.read independiente, catálogo e impersonación se conservan. No service_role frontend, bucket público, URL pública ni omisión de auditoría. STABLE por statement no constituye autoridad cliente. Las firmas expiradas siguen rechazadas.

LEGACY: READ ONLY en dependencias existentes. No Google, fórmulas, finanzas, saldos, numero_control ni cambios históricos. El delegado histórico de permisos se conserva íntegro.

UI PRESERVATION: no se modifica ninguna fuente/pantalla/bundle/worker. El build de prueba parte del commit publicado 4be7986b62f77c893150c710f98b362ba01e2e41 en checkout aislado. La regresión global local/publicada es requisito de cierre por modificar Storage privado; su resultado se registrará en VERIFICATION.md.

POST CHANGE: despliegue realizado. Backend-equivalence.json confirma 252 funciones, 227 policies adicionales, RLS/owners/ACL, columnas, constraints e índices iguales; sólo cambia USING del target. Las altas concurrentes son anteriores al despliegue y se documentan sin atribuirlas a H04. Dos snapshots posteriores tienen hashes de negocio iguales; cero fixtures persistentes.

UI/REGRESIÓN FINAL: global-local.json y global-production.json PASS, cero errores JavaScript. Incluyen sello/Login, foto, Admin Afiliados, documentos imagen y PDF legítimo, Membership, Préstamo documental, catálogo/galería, Marketplace, fullscreen, refresh y SW/noSW. Sin cambio frontend, rediseño o sustitución de componentes.

SECURITY FINAL: 192 comparaciones live contra la baseline PASS, incluidas expiración y revocación de impersonación; URL firmada real expirada rechazada antes/después. Bucket privado, sin permisos nuevos. Observación de 89,134 s sin rollbacks/deadlocks ni ERROR devueltos; temporales globales documentados. Registry completo PASS. Verificación final: PASS con las limitaciones explícitas de VERIFICATION.md.
