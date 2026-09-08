# H07 — observación

Ventana UTC 2026-09-08 03:46:11–04:18:07, 1.916,514 segundos. Incluye pruebas, refinamiento del backend, publicación y actividad productiva concurrente. No es una prueba de carga aislada.

12.939 commits, 13 rollbacks, cero deadlocks, cero esperas de lock en ambos extremos. No SQLSTATE40001 registrado ni amplificación patológica. Conexiones55→59: no se cambiaron pools, límites, memoria ni Compute. No se declara resuelto el problema de host de H02.

0 bloques físicos leídos;1.407.400 hits;63 temporales/276.707.882 bytes globales. Estos contadores no permiten atribuir temporales o memoria a H07. La evidencia focal de mejora son llamadas, transferencia y resultados completos en BEFORE_AFTER.md.

Logs: once42501. Siete queries referencian program_requests, cuya denegación anterior permanece idéntica en las pruebas del portal; cuatro referencian las RPC de identidad/contexto probadas como anon por el workflow. log-error-attribution.json sólo conserva esas referencias, no SQL ni mensajes privados. Los dos rollbacks restantes no se atribuyen individualmente por la muestra agregada;13 en32 minutos no constituyen una tormenta. La ingestión puede retrasarse.

Backend final:253 funciones previas y228 policies exactas; sólo una función service-only nueva. Hashes de33 empresas,954 afiliados y135 identidades Auth preservados. No promociones ni memberships productivos actuales; casos no vacíos se probaron con fixtures revertidas. Seis eventos legítimos de auditoría de exportación de las tres comparaciones BEFORE/AFTER/final permanecen intactos.

La publicación 7cecf8a terminó workflow SUCCESS y coincide byte por byte en21 archivos. La regresión global pública no pudo superar login: Auth400 invalid_credentials. Un diagnóstico independiente con las mismas credenciales confirma el rechazo; la cuenta existe, está confirmada, no está eliminada ni bloqueada. No se infiere quién o qué cambió su contraseña. supabase.env no fue modificado por H07. No se restablecen credenciales ni se usa otro mecanismo de acceso para eludir este bloqueo. Se pidió al propietario actualizar el archivo local; no se pidió enviar una contraseña al chat.

Regresión global local PASS previa y comparación completa local de portal/miniaturas disponibles. La regresión pública pendiente impide H07 PASS aunque el artefacto publicado sea idéntico al build probado. H08 no se inicia.
