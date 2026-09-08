# ARCHITECT REVIEW

Task reviewed: H04 — RLS documental / Storage privado bajo Protocolo Maestro.

Verdict: APPROVED.

Revisión focal realizada en este mismo agente después del cierre, contrastando el SQL definitivo, las definiciones live y sus guards, los 24 resultados de matriz, planes, metadata, regresión global y final-check.json. No se presenta como revisión externa. Las autoridades normativas leídas previamente siguen iguales por hash; el apéndice H03 de AGENT_CHANGELOG se leyó y su prefijo anterior se verificó íntegro. WORK_QUEUE corresponde al plan legacy; falta WORK_QUEUE_HISTORY. No se inventa aprobación de task-orchestrator.

What Codex did correctly: separó las tres existencias del join OR sin suprimir RLS anidada, conservar acceso sólo desde el frontend o añadir permisos. Mantuvo la rama indirecta con affiliate_files visible, sin introducir allí las restricciones adicionales de la rama de foto. Conservó las policies del catálogo y el bypass assets.read. Usó InitPlans sólo con helpers STABLE e independientes de la fila.

Important findings: 3.044→0 documentos examinados y 28.164→757 hits en la consulta reproducida. Las 192 combinaciones antes/candidato y 192 live mantienen cada resultado. Los scans del catálogo y el paging del host no se declaran resueltos. No se crearon índices sin beneficio medido.

Problems detected: se corrigieron errores del harness, SRI por CRLF y guard nulo antes de la entrega; el ensayo definitivo de recuperación/drift pasó. Un assert inicial de hashes detectó actividad concurrente anterior al despliegue, no se ocultó ni se eliminó esa actividad: deltas exactos, timestamps anteriores y dos snapshots posteriores estables justifican la reconciliación. La limpieza de dos carpetas vacías fuera del repo fue rechazada por revisión automática; se conserva como limitación local, sin archivos SQL ni efecto productivo. No constituye un defecto de autorización o funcionamiento de H04.

Architecture implications: cambia exclusivamente USING de una policy existente. Las mismas tablas, funciones, permisos, writers y contratos. Registry derivado actualizado y suite completa PASS en checkout congelado; entrega aislada sin trabajo ajeno.

Source-of-truth implications: SAFE. No duplicidad, fallback ni caché cliente de autoridad. Los fixtures no se publican ni se usan como autoridad; cada transacción se revierte con triggers y auditoría vigentes.

Security implications: PASS. 252 funciones y 227 policies adicionales iguales, RLS/ACL/owner y bucket privado conservados. Admin con/sin permiso, dueño/otro, impersonación vigente/vencida/revocada/sesión incorrecta y anon cubiertos. URL firmada real expirada rechazada antes/después. La ausencia de estado documental EXPIRED se declara NOT APPLICABLE y no se inventa una regla de negocio.

Data implications: H04 no tiene DML productivo. Los hashes de negocio posteriores son estables; cero fixtures persistentes. Los uploads anteriores y sus reclasificaciones se preservan. La regresión usa imágenes y PDF legítimos, con auditoría operativa habitual. No cambios financieros o históricos.

Owner decision required: NO para cerrar H04. No se requiere una decisión de negocio por las carpetas vacías de preparación y no se solicita eludir el bloqueo automático.

Recommended next action: entregar el resultado y evidencia H04, conservar recovery y trabajo ajeno. No iniciar otra H por inferencia.

# RESPONSE TO CODEX

Aprobar H04 con el alcance y límites de VERIFICATION.md. Entregar H04 STATUS: PASS y la evidencia de acceso equivalente y reducción de buffers. Conservar la migración/recovery, la atribución de altas previas y la limitación local del bloqueo automático. No modificar Compute, memoria, pooler, permisos, negocio, UI, finanzas ni históricos. No iniciar otra H sin solicitud concreta del propietario; esta revisión no concede continuidad.

Autocontinuable: NO.

SUTIAPP ARCHITECT REVIEW

Task: H04
Verdict: APPROVED

Critical findings: sin defecto funcional/de seguridad H04; límites de host, baseline concurrente y preparación documentados.

Source of truth: SAFE
Architecture: PASS
Security: PASS
Data: PASS con reconciliación explícita
Legacy: READ ONLY, sin cambios

Owner decision: NO

Next action: entregar H04 y conservar rollback; no iniciar otra H.

Response generated for Codex: YES
