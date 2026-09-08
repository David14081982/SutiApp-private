# H04 — Pruebas

Matriz SQL: 12 perfiles × 16 casos = 192 resultados antes/después del candidato; otros 192 resultados comparados con la baseline sobre la policy ya desplegada. PASS. Archivos matrix-*.json y matrix-live-*.json; ejecución reproducible en matrix.cjs/matrix-setup.sql. SET LOCAL ROLE authenticated/anon y RLS real; no bypass para las lecturas de autorización. Roles/asignaciones, filas documentales e impersonación del harness son transaccionales y se revierten.

Perfiles: dueño, otro afiliado, principal, Admin sin permiso documental/assets, assets.read, documents.read, program_catalog.read, impersonación activa, vencida, revocada, sesión distinta y anon. Casos: foto vigente, INE directo, documento indirecto, rechazado, rechazado con otra relación válida, archivo histórico, documento directo con archivo histórico, asset deshabilitado, archivo deshabilitado con documento, documento antiguo, programa habilitado/deshabilitado, enlace deshabilitado, asset de programa deshabilitado, objeto huérfano y archivo de otro propietario. Se compara cada booleano y el contexto/permisos; no basta comparar totales.

Algunas autorizaciones existentes son deliberadamente no intuitivas: assets.read permite el bypass original; otra policy del catálogo puede permitir un asset DISABLED enlazado a un programa habilitado; el rechazo documental no elimina una relación de foto válida; documents.read por sí solo no concede assets.read. H04 conserva esos resultados y no redefine permisos.

El estado documental EXPIRED no existe: NOT APPLICABLE como estado de affiliate_documents. Se cubren mecanismos reales de expiración: impersonación vencida y URL firmada legítima con TTL de 2 s, acceso inicial 200 y posterior rechazo 400/InvalidJWT. Un documento VERIFIED antiguo conserva su acceso.

Recuperación e idempotencia: PASS, recovery-rehearsal.json. Se ejecutaron los archivos reales de migración y recovery, verificando el hash después de cada operación, todo finalmente revertido antes del despliegue.

Preparación y fallos corregidos, sin ocultarlos:

- El primer fixture reutilizaba un hash y chocó con private_assets_hash_unique. Se asignó un hash único por UUID; una errata de paréntesis posterior también abortó y se corrigió.
- El trigger documental vigente reclasifica expedientes. Se normalizan únicamente los affiliate_files recién creados del harness después de todos los inserts; triggers y cambios inducidos se revierten. Las etiquetas de casos son ahora deterministas.
- Un ensayo DDL concurrente con la matriz agotó lock_timeout de 2 s. Abortó sin aplicar cambios; se repitió secuencialmente.
- El primer probe anon intentó llamar un helper que anon no puede ejecutar. Se cambió el harness para consultar Storage directamente sin conceder permisos al helper; los 16 accesos anon quedan rechazados.
- Storage devuelve InvalidJWT al vencer la firma; el primer assert sólo reconocía la palabra expired. Se corrigió para reconocer el código real, manteniendo la exigencia de acceso inicial 200 y rechazo posterior.
- Un cálculo erróneo de la raíz generó dos archivos SQL fuera del repo. Se corrigió la raíz y se retiraron esos dos archivos exactos tras comparar hashes con los correctos; no se ejecutó el SQL desde esa ubicación ni se borraron otros archivos.
- La revisión automática rechazó la limpieza posterior de los directorios vacíos de preparación, con el mensaje genérico blocked by policy. Se comprobó que Documentos/supabase/migrations y Documentos/supabase/recovery tienen cero entradas y se dejaron intactos; no se intentó eludir el bloqueo. Limitación local sin efecto productivo.
- La primera regresión local no arrancó: core.autocrlf había convertido vendors y roto SRI. Se restauraron en el artefacto público los bytes exactos del commit publicado; no se cambió la aplicación. global-local-failure.json conserva el fallo; public-build.json identifica la corrección.
- Una captura amplia de metadata agotó statement_timeout mientras corrían pruebas SQL. Se conserva como fallo de observación; la reconciliación definitiva se ejecuta secuencialmente y se exige PASS antes de cerrar.
- El primer assert de hashes de negocio falló por actividad anterior al despliegue durante una captura no atómica: tres assets/documentos nuevos y seis actualizaciones de clasificación de archivos. Se conservaron los registros y la evidencia; sus últimas fechas son 00:02:49 UTC, anteriores a la aplicación H04 de 00:03:15 UTC. La reconciliación exige metadata intacta, deltas exactos, ninguna fecha de escritura posterior, programas idénticos y hashes iguales entre dos capturas posteriores. No se afirma igualdad con una baseline tomada mientras había escrituras concurrentes.

La regresión global y los resultados finales de metadata/performance constan en VERIFICATION.md y sus JSON asociados. Ningún fallo de preparación se presenta como éxito productivo.

Entrega reproducible: los helpers H04 cargan supabase.env local sin copiarlo ni depender del collector de auditoría no publicado. Probe read-only del helper autónomo PASS. Las verificaciones H01/H02/H03 se conservan como snapshots con SHA256 en preconditions/ para revisar el gate histórico; no conceden autorización para otras tareas. Los archivos definitivos de recuperación e idempotencia también se reensayaron tras endurecer el guard ante un hash nulo.
