# H03 — PRE-CHANGE AUDIT

Status: PASS para preparar e implementar el alcance autorizado.

Precondiciones: H01/VERIFICATION.md y H02/VERIFICATION.md contienen sus respectivos STATUS: PASS. Navigator ejecutado; Registry STALE preexistente (15 changed,241 added), confirmado con discovery dirigido.

Objetivo: una revalidación de seguridad por ciclo estable y cero recargas de dominios aún válidos, conservando cambios externos, permisos, actor/sesión, impersonación y UI. El contexto live get_admin_access_context delega actualmente en savings_context_before_20260906 y aplica la frontera Ahorro: no sustituirlo por la migración histórica ni modificar su autoridad.

Diseño declarado: RPC aditiva get_admin_refresh_context que delega en el contexto vigente y añade huellas efímeras de las filas visibles de cada dominio bajo RLS/invoker. No nuevas tablas, triggers, caché autoritativa ni escritores. Las huellas incluyen vínculos/activos visibles de las proyecciones y detectan INSERT/UPDATE/DELETE y cambios de visibilidad. Compararlas no sustituye ninguna decisión de autorización. Medir coste SQL para evitar una reducción de HTTP ficticia.

Archivos previstos: app/admin-repository.js; app/admin-cutover-store.jsx; app/affiliate-auth.js (orden de descarte de resolución stale y propagación de identidad al contexto); app/app.jsx sólo si la coordinación de eventos lo requiere; app/bundle.js generado; SutiApp.html y sw.js únicamente referencias de versión. Nueva migración/recovery 20260907000300_admin_refresh_context.sql; pruebas focales scripts/test-admin-refresh.js y scripts/test-admin-refresh-browser.js; mantenimiento de assertions obsoletas de versiones en scripts/test-admin-access-impersonation-global-permissions.js si se confirma. Evidencia H03/**, índice disk-io-remediation/README.md y apéndice AGENT_CHANGELOG. Registry derivado y su markdown acompañante sólo por nueva dependencia/RPC demostrada. Publicación aislada de archivos autorizados si procede, preservando todo trabajo ajeno.

Autoridades: las tablas productivas y RLS existentes de roles, segmentación, acceso, companies/profiles/benefits/rules, banners y assets. Lectores: AdminCutoverRepository/Store y superficies Admin existentes. Writers: los actuales, sin cambios. Fingerprints y proyecciones cliente son derivados ligados al contexto y descartables; no se persisten en almacenamiento del navegador.

Seguridad: revalidación interval30s permanece también oculta; focus/visibilitychange comparten solicitud en vuelo; revocación/error/logout invalidan respuestas antiguas y proyecciones; contenido oculto se difiere hasta revalidación visible. Sin nuevo permiso ni lógica de decisión en UI. RPC invoker para conservar visibilidad exacta; no otorgar lectura nueva de tablas.

UI: conservar todas las secciones, controles, filtros, navegación, scroll, copy, responsive y movimientos actuales. Cambian exclusivamente coordinación y carga de datos. Contrato Admin Access ADR-098 explícitamente preservado; cambios de backend son aditivos.

Legacy: sólo delegación en el getter vigente y lecturas autorizadas; no fórmulas, saldos, Google, solicitudes financieras ni datos históricos modificados. Migración reversible por retirada de la nueva función tras recuperar frontend anterior, sin cambiar getter original.

Riesgos: respuestas en vuelo después de logout/revocación; colisiones de carga; contexto idéntico con datos cambiados por otro actor; fingerprints baratos que no reflejen RLS; coste adicional de comprobación; error parcial de dominio; eventos duplicados y pestaña oculta. Verificar estos casos con transporte aislado y navegador, SQL real transaccional/rollback y lecturas live.

Tests: baseline de llamadas con fuentes previas; múltiples ciclos, permisos perdidos/ganados, rol, sesión, actor, impersonación, regreso visible y navegación; datos externos e invalidación focal; carreras y errores. Build reproducible; contratos Admin focales; regresión global de imágenes obligatoria contra candidato local y GitHub Pages por cambios compartidos reales. No atribuir las suites históricas a esta H.

Artefactos locales de verificación añadidos al alcance antes de generarlos: build público allowlist en `C:/tmp/sutiapp-h03-20260907-site` y checkout de entrega aislado `C:/tmp/sutiapp-h03-release-20260907`. No contienen secretos y no son otra autoridad runtime. El servidor de pruebas sirve sólo ese artefacto público en loopback.

Guardians: pre-change-audit, source-of-truth SAFE (única autoridad por dominio), supabase-security-review, database-migration-guardian, legacy-google-guardian READ ONLY, claude-ui-preservation-guardian y post-change-verification. Revisión de architect al cierre. Ampliar este documento antes de escribir fuera del alcance.
