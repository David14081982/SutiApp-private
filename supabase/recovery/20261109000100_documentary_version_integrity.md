# Recuperación de la publicación documental

La migración `20261109000100_documentary_version_integrity.sql` se ejecuta en una
transacción única. Su aplicación exige `document.release_authorized=DOCUMENT_V1`.
Un error de DDL, backfill, integridad o concurrencia revierte la transacción
completa; no desactivar RLS ni eliminar referencias para evitar el error.

Antes de aplicar se verifican el respaldo PostgreSQL restaurado, los hashes de
los bytes de Storage respaldados, muestras restauradas en Storage aislado y las
referencias protegidas. La evidencia conserva hashes y conteos; los archivos de
respaldo y sus rutas de objetos quedan fuera de Git.

La publicación agrega contextos, operaciones y selección documental sin borrar
assets, documentos, asociaciones aisladas ni snapshots archivados. Las siete
colecciones protegidas se comparan dentro de la misma transacción; en
`request_documents` se excluye únicamente la nueva columna `evidence_set_id`.

Si falla la aplicación frontend o Edge después del commit SQL, conservar las
estructuras y operaciones nuevas y corregir el consumidor. Puede desactivarse
temporalmente la interfaz de nuevas operaciones mientras se corrige, pero no
revertir la evidencia creada después de la activación mediante DROP, cascadas,
restauración destructiva de producción o reapertura de escrituras antiguas.

Para recuperación de desastre: restaurar primero el dump en una instancia
aislada, comprobar propietarios, funciones, permisos, RLS y hashes de filas;
restaurar los bytes en Storage aislado usando el manifiesto y comprobar cada
SHA-256. Reconciliar las operaciones posteriores al punto de respaldo antes de
cualquier reemplazo de la instancia productiva. Nunca sobrescribir documentos
históricos o eliminar respaldos para completar una recuperación.

Los cuerpos y metadatos de las funciones Edge anteriores se conservaron antes
del despliegue. Sus permisos de gateway deben mantenerse, incluido
`document-generation` con `verify_jwt=false` y autenticación propia del worker.
No cambiar su clave ni publicar secretos para restaurar el servicio.

La purga física permanece desactivada. Los errores de bytes o integridad no se
convierten en operaciones completas ni se corrigen apuntando a la versión actual.
