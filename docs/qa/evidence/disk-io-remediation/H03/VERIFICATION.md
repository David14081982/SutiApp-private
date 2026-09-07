# H03 — Verificación final

H03 RESULT

Status: PASS.

Preconditions: H01 y H02 PASS comprobados antes de iniciar; protocolo maestro aplicado. No se inicia otra H.

Files changed: app/admin-repository.js, app/admin-cutover-store.jsx y app/affiliate-auth.js; app/bundle.js generado; referencias de versión en SutiApp.html y sw.js; migración/recovery 20260907000300_admin_refresh_context.sql; dos pruebas H03 y mantenimiento focal del test de versiones; Registry derivado, evidencia H03, índice y apéndice AGENT_CHANGELOG. La publicación aislada excluye los cambios ajenos del workspace.

Source-of-truth verdict: SAFE. Getter protegido y tablas/RLS existentes conservan autoridad. Las siete huellas son derivados efímeros de filas visibles bajo INVOKER, sin writer nuevo ni autorización persistida en cliente.

Invariant verdict: PASS. Permisos, actor Auth, sesión, afiliado efectivo, impersonación, numero_control, documentos, lógica financiera e históricos intactos. Las 48 políticas y las definiciones/grants/owner/search_path de los getters protegidos coinciden con baseline.

Build: PASS. Entrega aislada desde 3029c743871c4a307bc04f0fd655f92690a1dc89, 108 fuentes; sólo los tres chunks indicados cambian. Commit funcional dff40995684f35ab00dceb72a1ec97edfeb18c35, workflow34165667477 SUCCESS. El bundle servido en GitHub Pages coincide por SHA256 con el candidato. Bundle221 / worker168.

Tests: PASS en 16 casos aislados, 12 casos Chrome locales y 12 publicados; matriz SQL A–H, probe de normal/anon, cambios de datos revertidos e invalidación focal. Contrato Admin protegido, Admin decisions, H009 y Pages PASS. Regresión global completa local y publicada PASS: assets legítimos, sello/Login, perfil, Admin Afiliados, documentos imagen/PDF, Membership, Préstamo documental, catálogo/galería, Marketplace, fullscreen, refresh y SW/noSW. Cero errores JS en ambas suites. Registry PASS en generación, freshness, stale, lookup, relaciones, permisos, incremental, secretos y determinismo.

Security: PASS. Cada ciclo publica la revalidación de autorización. Pérdida de permiso/error/logout retira acceso y datos; ganancia de permiso reaparece; respuestas antiguas no restauran un contexto retirado. Fingerprints iguales no evitan publicar seguridad. El intervalo existente continúa con pestaña oculta; focus/visibility comparten solicitud y no se añaden timers. Matriz backend con transacciones revertidas; simulaciones de respuesta UI limitadas al navegador aislado y descritas como tales.

Legacy impact: READ ONLY. Sin cambios Google, fórmulas, saldos, criterios, snapshots ni registros históricos. Login y previews legítimos pueden generar auditoría operativa habitual; no se desactiva trazabilidad.

Unexpected files changed: ninguno respecto a los 1.508 archivos del baseline fuera del alcance autorizado. Los únicos archivos nuevos fuera de evidencia son las dos pruebas y la migración/recovery H03. Comparaciones en workspace-preservation.json y new-files-check.json; todo trabajo ajeno conservado.

Before/after: Chrome real sobre versión anterior y candidato, tres ciclos cada uno: 9→1 llamadas, 8→0 lecturas adicionales y 45.016→1.713 bytes decodificados por ciclo. Proyecciones visibles idénticas por hash y todas las respuestas HTTP200. La versión publicada vuelve a confirmar tres ciclos de una llamada y el intervalo real sin recargas adicionales.

Rollback: disponible y probado. Restaurar primero frontend del commit anterior con cachebusters nuevos; conservar la RPC mientras existan clientes abiertos que la llamen. Después, recovery SQL con guard de hash/comentario. DROP, ausencia, recreación y hash comprobados dentro de ROLLBACK. Cero filas de los probes de banners permanecen.

Known limitations:

- Una carga inicial, primer contexto sin huellas, edición explícita o cambio real necesita lecturas adicionales. La métrica de una llamada corresponde a ciclos estables certificados.
- La RPC hace trabajo SQL para calcular huellas. No se afirma que desaparezcan ocho scans, ni que H03 resuelva memoria/swap o el presupuesto de disco del host. EXPLAIN y límites de latencia están en BEFORE_AFTER.md.
- El test ampliado histórico test-admin-affiliates.js falla una assertion de Finanzas también contra git HEAD anterior. No es una regresión H03 ni se presenta como PASS. Se preserva ese dominio; la regresión funcional Admin Afiliados local/publicada sí pasa.
- Los primeros intentos locales usaron un origen no autorizado por CORS. La causa se confirmó con preflight403 y el mismo PDF exitoso en producción. La prueba definitiva usa localhost:8080 ya autorizado, sin cambiar CORS/Edge Functions. También se conservan los fallos de preparación del harness.
- WORK_QUEUE_HISTORY.md falta; WORK_QUEUE pertenece a otro plan legacy. La autorización de H03 procede de la solicitud explícita. No se atribuye aprobación a un orquestador no disponible.

Evidence: [medición](http-before-after.json), [tests](TESTS.md), [backend](backend-final.json), [seguridad y rollback](rollback-security-verification.json), [Chrome publicado](browser-production.json), [regresión global local](global-local.json), [regresión global publicada](global-production.json), [deployment](deployment.json), [guardians](GUARDIAN_REVIEWS.md), [recuperación](ROLLBACK.md), [revisión arquitectónica](ARCHITECT_REVIEW.md).

H03 STATUS: PASS

STATUS: PASS
