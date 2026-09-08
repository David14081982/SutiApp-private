# H07 RESULT

Status: BLOCKED — falta completar la regresión global pública con credenciales válidas de la cuenta controlada. No se concede PASS parcial ni se inicia H08.

Files changed: app/company-store.jsx, app/marketplace-repository.js, app/screens-admin-affiliates.jsx exclusivamente DocumentCard, app/private-resource-demand.js y app/screens-documentos.jsx exclusivamente umbral de visibilidad; supabase/functions/data-exports/index.ts; migración/recovery20260907000600; tres tests focales; bundle/HTML/SW generados; Registry y evidencia H07. Diff productivo aislado en7cecf8ae5839ba1b2f42c34569bad18a165d5256. Los cambios previos ajenos del workspace permanecen fuera de esa publicación.

Source-of-truth verdict: PASS. Companies/promotions y documentos continúan autorizados por Supabase/RLS; Auth email por UUID/instancia exactos, histórico y numero_control intactos. Ningún fallback, nueva autoridad ni persistencia financiera. Writers de negocio sin cambios.

Invariant verdict: PASS en comparaciones ejecutadas. CSV completo idéntico byte por byte y XLSX campo por campo,954 afiliados/123 vínculos Auth; hashes de datos maestros y135 identidades iguales. Portal aislado y matriz RLS real: proyección, grupos, límites, permisos y denegaciones idénticos. Reordenamientos no se agrupan porque cambiaría atomicidad/error/orden/auditoría.

Build: PASS. Bundle224/SW171;109 chunks, exactamente cinco modificados. Build local desde checkout aislado, trabajo financiero pendiente preservado. GitHub Pages workflow34186311189 SUCCESS;21 archivos públicos iguales a blobs del commit. Edgev13 JWTtrue, AST exacto y SDK2.115.0 igual al baseline efectivo.

Tests:17 suites focales PASS en workspace y release; suite completa Registry PASS. Backend13 checks de grants/límites/recovery,16 casos RLS portal, rechazo HTTP anon/authenticated a RPC interna. Regresión global local PASS con assets legítimos, PDF, Admin, Membership, Préstamo, Marketplace, fullscreen, refresh y con/sin SW. Regresión global pública BLOCKED en login Auth400 invalid_credentials; no se presenta como ejecutada. Portal/miniaturas reales públicos posteriores pendientes por la misma condición.

Security: PASS en backend y pruebas ejecutadas; gate de regresión pública pendiente. Se conservan253 funciones anteriores/228 policies, no permisos ni buckets ampliados. RPC nueva sólo service_role en backend; mismo permiso Edge y auditoría. Cero valores secretos encontrados en cambios. Contexto/expiración/logout/denegaciones de miniaturas comprobados aisladamente y apertura real local reautoriza.

Legacy impact: ninguno; no Google, fórmulas, cálculos, saldos, históricos ni cambios financieros. La exportación conserva campos/headers/significado exactos.

Unexpected files changed: ninguno en comprobación contra1.894 archivos del baseline; ver workspace-preservation y build-proof. Fuentes pendientes ajenas conservadas. No modificación de credenciales.

Known limitations: el portal completo ya fallaba con42501 program_requests antes del bucle; H07 conserva esa denegación. 39→7 llamadas es store válido aislado; el lector real autorizado pasa34→2. El test amplio test-admin-affiliates.js contiene una aserción de Finanzas que falla idéntica en baseline publicado y release H07; no se publica trabajo financiero ajeno para ocultarla. La suite focal y regresión local de DocumentCard pasan. Los contadores globales de temporales/conexiones no demuestran resolución de host. Sin acceso válido de prueba no se puede completar la regresión pública requerida por AGENTS.md.

Evidence: PRE_CHANGE.md, INVENTORY.md, BASELINE.json, GUARDIAN_REVIEWS.md, IMPLEMENTATION.md, BEFORE_AFTER.md, TESTS.md, OBSERVATION.md, ROLLBACK.md y recibos JSON/TXT de los comandos. Publicación runtime7cecf8a; Edgev13; backend-final.json. La primera ejecución pública fallida se conserva junto a auth-diagnostic.json y auth-account-state.json sin credenciales/IDs/email.

Acción necesaria: actualizar H005_TEST_EMAIL/H005_TEST_PASSWORD válidos en supabase.env local. Después ejecutar el script original de regresión global contra GitHub Pages, portal-live y admin-previews-live con labelproduction, verificar observación/integridad, emitir revisión final y sólo entonces reevaluar PASS. No restablecer Auth ni usar magic links/service-role en navegador para sustituir esta prueba.

H07 STATUS: BLOCKED

STATUS: BLOCKED
