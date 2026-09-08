# ARCHITECT REVIEW

Task reviewed: H07, N+1, bajo PROTOCOL.md y solicitud específica del propietario.

Verdict: BLOCKED.

What Codex did correctly: batch de promociones por FK/RLS conserva empresa y proyección; helper Auth service-only acotado conserva vínculo UUID/instancia y exportaciones completas. Miniaturas conservan UI y backend, usan demanda/validez/contexto y reautorizan apertura. Los reordenamientos con commits parciales permanecen intactos conforme a la condición expresa de equivalencia. Hay recovery ensayado y fuente Edge anterior recuperable.

Important findings: revisión read-only reconstruida desde solicitud, PRE_CHANGE, inventario, diff a0159d7→7cecf8a, SQL final, fuentes, pruebas y hashes. Normativa leída íntegramente en la sesión y contrastada con governance-review.json; WORK_QUEUE_HISTORY.md no existe. WORK_QUEUE no autoriza la fase financiera pendiente ni H08. No se presume un task-orchestrator disponible.

Problems detected: la regresión obligatoria en GitHub Pages no supera login. Auth devuelve400 invalid_credentials también en diagnóstico independiente. Los21 archivos públicos son exactos al commit y la regresión local pasó, pero eso no sustituye el gate público exigido. No existe evidencia para aprobar H07 mientras falte ese recorrido. Portal/miniaturas públicos posteriores también pendientes. No se modifica Auth ni se elude la autenticación para fabricar un PASS.

Architecture implications: una RPC interna aditiva y un reader batch; sin autoridad duplicada ni cambio de frontera cliente/backend. Registry actualizado y suite completa PASS; fallo posterior del wrapper se debe a tratar outputs regenerados como fuentes, está explicado y su exclusión se corrigió. Cinco chunks entre109; DocumentCard publicado excluye cambios financieros previos del workspace.

Source-of-truth implications: companies/promotions/documentos siguen Supabase; Auth email se lee por UUID exacto y no resuelve identidades históricas. Export no persiste datos privados como autoridad. No nuevos mocks/fallbacks productivos ni datos eliminados que reaparezcan desde caché. Memoria de miniaturas H06 es efímera y se invalida por contexto/expiración.

Security implications:253 funciones anteriores/228 policies iguales; RPC nueva ownerpostgres/search_path vacío/STABLE/SECURITY DEFINER, sólo service_role. Edge mantiene permiso/allowlist/auditoría y JWT.16 casos RLS portal y13 checks backend, más comparación real de export y aislamiento de contexto, sin ampliación de acceso. La revisión distingue las pruebas ejecutadas del gate público pendiente.

Data implications:33 empresas,954 afiliados,135 identidades conservan hashes.123 correos Auth vinculados y61 distintos al histórico conservados en CSV/XLSX completos. Campos/headers/semántica exactos. Los seis eventos legítimos de auditoría no se borran. No cambios financieros ni legacy. La ausencia de promociones reales se cubre con fixtures transaccionales revertidas; no se afirma prueba productiva de datos inexistentes.

Owner decision required: NO sobre negocio/seguridad/arquitectura. Se requiere restablecer disponibilidad de credenciales válidas en el archivo local por el propietario; no autorización para cambiar contraseñas, roles o contratos.

Recommended next action: mantener H07 BLOCKED, completar exclusivamente sus verificaciones cuando la cuenta controlada vuelva a autenticar. No iniciar H08.

# RESPONSE TO CODEX

No apruebes H07 todavía. Cuando el propietario confirme credenciales locales válidas, ejecuta scripts/test-global-image-regression-production-live.js contra GitHub Pages, portal-live.cjs y admin-previews-live.cjs con labelproduction. No cambies el harness para evitar login ni sustituyas datos/activos legítimos. Si pasan, actualiza observación, integridad y evidencia, repite esta revisión y reevalúa H07. Preserva la publicación aislada, recovery y trabajo ajeno del workspace. No avances a otra H.

SUTIAPP ARCHITECT REVIEW

Task: H07.
Verdict: BLOCKED.

Critical findings: gate público no ejecutado por Auth invalid_credentials. Ninguna afirmación de equivalencia pública funcional sustituye esa evidencia faltante.

Source of truth: PASS en alcance revisado.
Architecture: PASS.
Security: backend y pruebas ejecutadas PASS; regresión pública pendiente.
Data: PASS en comparaciones completas ejecutadas.
Legacy: sin cambio.

Owner decision: NO.

Next action: recibir credenciales locales válidas y completar el gate H07. H08 no autorizado por este reviewer.

Response generated for Codex: YES.
