# H-AFFILIATES-OPTIONAL-REASON-001

## PRE-CHANGE AUDIT — 2026-09-24

- Objetivo/autoridad: el propietario solicita motivo opcional en los seis formularios de Afiliados: alta, edición, estado, archivo/restauración, carga/reemplazo documental y asistencia. Esta instrucción sustituye únicamente la obligatoriedad del motivo en esos flujos; no sustituye permisos ni auditoría.
- Alcance: `app/screens-admin-affiliates.jsx`; migración nueva `20260924000400_affiliates_optional_reason.sql` y recovery homónimo; pruebas/fixture `scripts/*affiliates-optional-reason*`; evidencia `docs/qa/evidence/affiliates-optional-reason-20260924/`; este informe, `docs/DECISIONS.md`, `docs/INVARIANTS.md`, `docs/SECURITY_RULES.md`, `docs/MIGRATION_RULES.md`, `docs/AGENT_CHANGELOG.md`; Registry derivado si cambian contratos backend. `app/bundle.js` y cachebusters sólo como GENERATED_ARTIFACT. Archivos temporales/backup técnicos bajo `.tmp/affiliates-optional-reason/`.
- Fuera de alcance: datos históricos, cálculos, reglas financieras, Google, permisos, grants, RLS, rutas, diseño, otros formularios.
- Autoridad: `public.affiliates` padrón; tablas canónicas de expediente y sesiones existentes; auditorías append-only existentes. Ninguna fuente nueva, fallback ni texto automático para simular un motivo escrito.
- Lectores/escritores: pantalla → AdminAffiliatesRepository → RPC existentes; Assistance → AdminRepository → start_affiliate_impersonation. Repositories sin cambios previstos.
- Tablas candidatas: affiliate_admin_events, affiliate_profile_audit_log, affiliates (constraints de archivo), impersonation_sessions; resto del expediente sólo si la inspección demuestra una restricción de motivo que impide este flujo.
- Invariantes: preservar numero_control, IDs, Auth opcional, control de versión, permisos backend, actor real/contexto, TTL, no anidamiento, documentos privados/versionados e historia.
- Riesgo: validaciones repetidas en funciones y CHECKs; start_affiliate_impersonation es compartida. Otros formularios conservarán sus reglas UI, pero la RPC compartida aceptará motivo vacío. Regresión global requerida por alcance de asistencia.
- Recovery: capturar definiciones/constraints instalados; guardas de deriva; revertir sin borrar historia (bloquear recuperación incompatible con motivos opcionales ya registrados).
- Tests: PostgreSQL aislado con fixtures sintéticos, vacío/espacios/corto/largo, permisos/versión/auditoría, forward/recovery, navegador focal, build y regresión global local/Pages cuando accesible.
- Estado: auditoría abierta, inspección dirigida. No DDL ni datos de prueba en producción.
- Baseline ajeno: migration `20260915000100_admin_assisted_context.sql` ya modificada; `docs/audits/H-SAVINGS-SEP15-READONLY-AUDIT-001.md` ya untracked. No tocarlos. Registry STALE por esa migración: verificar definiciones instaladas directamente.

## Contrato visual

Se conservan padrón, filtros, paginación, ficha, seis tabs, formularios, campos, acciones, confirmaciones, loading/error/empty, navegación, scroll y responsive. Sólo cambian obligatoriedad, textos del motivo y guardas relacionadas. Motivo vacío se guarda vacío, nunca como justificación inventada.

## Alcance actualizado antes de editar pruebas

Se actualiza `scripts/test-affiliates-edit-documents-browser.js`: su expectativa antigua exige el bloqueo que el propietario eliminó. Se mantiene la cobertura de errores, permisos, documentos y responsive y se agregan los demás formularios. Su evidencia nueva se dirige a esta H; los resultados históricos permanecen intactos. Captura read-only confirmó siete RPC y cinco CHECKs; constraints del perfil sólo relajan texto de auditoría, sin modificar cálculos, writers financieros, procesos o triggers. Los demás formularios que llaman las RPC compartidas conservan sus validaciones UI. La migración usa guardas exactas contra catálogo instalado; no edita migraciones anteriores.

Se añade `.gitattributes` al alcance técnico: preservar bytes SQL como las tres migraciones anteriores, pues las guardas comparan definiciones exactas. Cachebusters concretos: `SutiApp.html` y constantes/URLs generadas de `sw.js`, sin cambio de lógica. El build se almacena en `.tmp/affiliates-optional-reason/site/` y no copia credenciales privadas.

## Verificación focal completada

- PostgreSQL aislado: 14 grupos PASS. Incluye el sobre transaccional exacto de despliegue, siete RPC con vacío/null/espacios/2/500 caracteres, rechazo 501, permisos/anónimo, versión, sesión/no anidamiento, archivo, auditoría, preservación VERIFIED y recovery antes/después de historia.
- El fixture usa las definiciones/columnas/CHECKs/ACL capturadas; permisos, lector de ficha y búsqueda de duplicados son límites sintéticos. No reproduce triggers externos de clasificación/finanzas/asistencia ni FK a tablas externas. Nada de esta prueba corre en producción.
- Navegador: seis formularios, alta/reemplazo, archivo/restauración, motivo vacío y corto, errores/reintentos, permisos y cinco viewports PASS. Estructura/27 controles preservados.
- Build focal: 1 módulo generado, otros 133 exactamente conservados. Build Pages PASS.
- Prueba estática antigua `test-admin-affiliates.js`: FAIL preexistente por exigir `const belongsToAffiliate=` en Finanzas. Reproducido leyendo todos los archivos desde HEAD; no es una regresión de esta H. No se modifica Finanzas para satisfacer ese contrato obsoleto.
- Architecture Registry: no cambia topología (mismas firmas, tablas, columnas, permisos, rutas, repositories y dependencias); sólo validación/copy. Se conserva el índice derivado sin regeneración global. Lookup STALE ya conocido por migración ajena; contratos afectados verificados contra catálogo instalado. Se intentó suite global del generador, detenida por costo desproporcionado antes de escribir archivos; no se declara PASS de esa suite. Ningún archivo del Registry ni fixture temporal de esa suite quedó modificado.

## Guardian verdicts

- SOURCE OF TRUTH: SAFE. Supabase conserva las mismas autoridades, readers y writers. No mocks/fallback/caché productiva nuevos.
- DATABASE MIGRATION: PASS. Captura de catálogo instalada; guardas exactas; sobre de despliegue probado en PostgreSQL aislado; historial intacto; recovery bloquea toda transacción si las restricciones antiguas invalidarían evidencia nueva.
- SUPABASE SECURITY: PASS para el cambio. Mismos permisos, RLS, grants, owner, OID, JWT/session, TTL, actor/contexto y privacidad/versionado de documentos. Únicamente el texto de motivo deja de tener mínimo.
- LEGACY: SAFE CHANGE de auditoría textual; no Google, fórmulas, cálculos, balances, writers financieros, procesos ni triggers alterados. Pruebas sólo sintéticas y aisladas.
- CLAUDE UI PRESERVATION: PASS. Ninguna sección ausente/agregada, navegación y scroll preservados; etiquetas y guardas modificadas conforme a la solicitud. Sin rediseño no autorizado.
- Regresión global: PASS local con hash del bundle esperado y Pages baseline. El intento inicial usó un origen CORS no autorizado; se corrigió únicamente el origen de prueba a localhost:8080, sin cambiar el backend ni assets.

## Backend aplicado

`apply.json`: transacción repeatable read con lock_timeout 2s / statement_timeout 60s, guardas de definiciones, huellas/conteos antes-después de trece tablas, ACL/owner/OID y seguridad de tablas. Cero cambios de negocio. Migración registrada como 20260924000400. No se crearon afiliados/documentos/sesiones de prueba en producción.

## Revisión de arquitectura de la implementación

Task reviewed: H-AFFILIATES-OPTIONAL-REASON-001.
Verdict: APPROVED para implementación y backend aplicado; publicación frontend aún pendiente en este corte.
Evidencia reconstruida: diff focal UI, siete definiciones contra catálogo, cinco CHECKs, receipt transaccional, pruebas PostgreSQL/navegador/build y regresión global. No se eliminan campos ni auditoría; no se añade autoridad. Los errores de longitud se ajustan a 500; los otros formularios retienen su UI y la RPC compartida acepta vacío.
Owner decision required: NO; la instrucción explícita del propietario cubre las seis acciones.
Recommended next action: publicar exclusivamente los archivos de esta H y verificar bundle/etiquetas/regresión en Pages. No incluir la migración de asistencia previamente modificada ni la auditoría de Ahorro ajena. Esta revisión no autoriza ninguna tarea siguiente de WORK_QUEUE.
