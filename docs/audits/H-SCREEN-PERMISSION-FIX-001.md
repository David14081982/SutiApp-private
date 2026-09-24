# H-SCREEN-PERMISSION-FIX-001

## Release autorizado — 2026-09-24

Backend APPLIED / VERIFIED: 002 y 003 instaladas juntas en transacción con tracking
exacto, conservación de huellas de 17 tablas existentes, 52 definiciones verificadas,
RLS forzada en cinco tablas nuevas/recovery, DML browser denegado y ocho asignaciones
habilitadas. Evidencia release-applied.json y release-backend-verified.json. Los
estados NOT DEPLOYED inferiores describen la preparación histórica. No se ejecutó
recovery ni revocación de usuarios reales. Frontend v285 pasa a publicación autorizada.

OWNER: «si haz push commit y publica». Autoriza aplicar 002/003, commit, push y
Pages del paquete v285 ya probado. PRE-CHANGE AUDIT: ampliar a
scripts/apply-editorial-release.js, evidencia de aplicación/publicación y estados
de esta H/changelog/autoridad. Supabase sigue como autoridad, sin escritores de
cuentas, expediente, historial financiero ni permisos existentes. Aplicar SQL
exacto probado y tracking en una transacción repeatable read con huellas de datos
antes/después; fallo revierte ambas migraciones. Verificar backend antes del push,
publicación del hash exacto y regresión global real después. Recovery conserva sus
límites después del uso; no revocar usuarios reales para verificar. Rama origin/main
coincide con HEAD al preflight, ocho asignaciones vigentes. Status: PASS para release.

## PRE-CHANGE AUDIT — 2026-09-24

Objetivo OWNER: corregir los hallazgos de cobertura sin retirar permisos de pantallas
ya concedidos ni interferir con la aplicación publicada. Aclaración vinculante:
las empresas conservan su login y portal propio; la administración global de empresas
corresponde a administradores autorizados. OWNER también solicita explícitamente
edición real desde Secciones, Menús y Formularios (respuesta a aclaración).

Autoridad: tablas/RPC Supabase existentes para permisos y empresas; estructura de
render y cálculos continúan siendo código. La nueva configuración editorial se
implementará con una autoridad Supabase explícita y sin fallback localStorage.
La solicitud posterior exceptúa la decisión de estructura exclusivamente versionada
solo para esa configuración editorial. No autoriza editar cálculos/validaciones
financieras, contratos de Auth o identidad de negocio desde el panel.

Invariantes: asignaciones actuales y responsabilidades independientes preservadas;
principal protegida; company membership y login conservados; operaciones de cada
empresa limitadas a su empresa; lectores públicos conservan audiencia; ninguna
alteración de saldos, fórmulas, documentos, cuentas o historial.

Alcance inicial / archivos:
- Este documento, scripts/admin-permission-fix-readonly.js y evidencia en
  docs/qa/evidence/screen-permission-fix-20260924/.
- Scripts focales de preparación/tests y migraciones/recovery aditivas numeradas
  después de leer versiones instaladas, para visibilidad y frontera de empresas.
- Se ampliará el alcance con tablas/archivos exactos del editor tras discovery dirigido.

Riesgo: endurecer permisos compartidos de forma que impida operaciones legítimas;
confundir el portal empresarial con el panel global; habilitar edición sobre nodos
sin renderer; introducir configuración que cambie la UI al instalarla.
Plan: leer estado instalado, reproducir brechas, corregir fronteras conservando
contratos, probar en PostgreSQL/Chrome aislados, comparar hashes de permisos y UI,
ejecutar regresión global local+Pages, preparar release concreto.
Tests: autorización backend; asignaciones antes/después; RLS entre empresas;
edición/guardado/recarga/concurrencia/error; usuarios no admin; sesión previa;
comparación visual y activos legítimos del build local y versión publicada.
Recovery: respaldo exacto de funciones/policies afectadas y configuración inicial;
guardas de deriva/uso, sin restaurar grants ni borrar historia automáticamente.
Legacy: READ ONLY para discovery; no escritores/cálculos Google.
Status: PASS para investigación e implementación aislada; no desplegado.

Navigator: FRESH al inicio; discovery sensible ampliado pese a índice vigente.
UI guardian: conservar layout, editor overlay, drag/drop, filtros, audiencia,
acciones de filas, errores visibles y navegación; datos reales vía Repository.

## Alcance confirmado después de la lectura

Producción no tiene tablas de estructura/menús/formularios: la implementación será
aditiva. Hay siete asignaciones administrativas habilitadas y cero memberships
empresariales habilitadas al capturar; se preserva igualmente el contrato de login
empresarial y se probará con dos empresas sintéticas, sin crear cuentas productivas.

Convenios filtra `!is_paid` en el frontend; el backend debe aplicar esa frontera a
escrituras y assets. Se permite operar empresas pagadas a empresas sobre su propia
ficha por membership, y a administradores con Empresas; no a módulos no seleccionados.
No se eliminan capacidades/grants existentes ni se modifican filas de asignaciones.

Ampliación: scripts/prepare-admin-permission-fix.js, scripts/admin-permission-test-db.js,
scripts/test-admin-permission-fix.js; migración/recovery
20260924000200_admin_screen_permission_boundaries.sql. Funciones objetivo:
module_visible, can_manage_company_ficha, enforce_company_ficha_action,
enforce_company_ficha_asset_action. Guard aditivo para relaciones de beneficios y
audiencia de companies. Consulta de memberships restringida a propia cuenta o módulo
administrativo autorizado. No se modifica is_marketplace_company_member ni Auth.

Editor (diseño): configuración de componentes conocidos y contenido editorial nuevo;
renderer seguro sin HTML/código ejecutable; formularios editoriales con validación y
respuestas propias; formularios financieros y campos obligatorios de identidad no
se sustituyen ni alteran por configuración. Semilla idéntica a la estructura actual,
con versiones/historial y control de concurrencia. Las rutas y controles críticos
conservan implementación compilada; los paneles controlan configuración autorizada.

## Ampliación de implementación editorial

Autoridad nueva autorizada por OWNER: `app_editorial_screens` para nodos por ruta,
`app_editorial_revisions` para versiones inmutables y `app_editorial_submissions`
para respuestas autenticadas. Código sigue siendo autoridad de componentes,
rutas admitidas, identidad, validaciones y operaciones financieras existentes.
No se agregará `content.write` a asignaciones ni se ampliarán permisos técnicos:
los escritores nuevos comprobarán el módulo específico y acción `update`, o el
permiso técnico existente limitado por `admin_module_boundary`.

Archivos adicionales: migración/recovery 20260924000300_app_editorial_panels.sql;
app/editorial-repository.js, app/editorial-content.jsx, app/screens-admin-content.jsx,
app/admin-cutover-store.jsx, app/screens-home-r2.jsx, app/app.jsx, scripts/build-bundle.js,
scripts/test-editorial-panels.js y pruebas browser focales; documentos de autoridad,
decisiones, changelog, evidencia y registry al cierre. Bundle/HTML/cachebusters solo
al producir build verificado. La integración compartida exige regresión global.

Contrato de instalación: Inicio conserva sus cuatro bloques en el orden publicado;
las demás rutas comienzan sin contenido editorial adicional. La configuración no
puede ejecutar HTML/JS, introducir rutas arbitrarias, reemplazar componentes
financieros ni cambiar el login empresarial. Edición/eliminación son versiones,
nunca borrado de respuestas. Recovery automático solo antes de cualquier edición
o envío y con huellas exactas; después conserva datos y requiere recuperación hacia
adelante. Errores de carga/guardado visibles; no fallback de contenido ficticio.

Ampliación focal: app/admin-store.jsx, retirar únicamente el seed y escritores
en memoria de estructura editorial, reemplazados por el Repository autorizado.

Verificación global ampliada: scripts/build-editorial-preview.js y
scripts/editorial-global-test-bridge.js. Hook opcional exclusivo del test
scripts/test-global-image-regression-production-live.js para responder únicamente
los RPC editoriales nuevos con PostgreSQL aislado mientras los assets y lectores
existentes usan producción real. No se interceptan activos ni datos existentes;
escritores editoriales rechazados por el puente. Se declara esa topología en evidencia.

Servidor local de prueba: scripts/serve-editorial-preview.js sirve exclusivamente
el directorio público generado, enlazado a 127.0.0.1, sin acceso al repositorio.

Prueba focal obsoleta: scripts/test-admin-user-modules.js esperaba 33 módulos,
pero el catálogo actual tiene 37. Actualizar la expectativa a todos los IDs del
menú vigente, conservar las pruebas de aislamiento y emitir evidencia nueva sin
sobrescribir el resultado histórico de septiembre 14.

Actualizar scripts/screen-permission-contract.js y screen-permission-surfaces.json:
las nuevas regiones editoriales son adicionales a los formularios de negocio.
Bloquear una ruta nueva si falta su registro editorial; no publicar una pantalla
que invoque un lector sin registro. La generación automática de permisos Admin
conserva la declaración de frontera backend y no otorga accesos a cuentas limitadas.

Hallazgo de integración local: Windows materializa vendors con CRLF, mientras
los SRI del HTML corresponden a LF (confirmado por SHA-384). Ampliar
scripts/build-pages-site.js para normalizar únicamente vendors JS en el directorio
generado y comprobar su SRI antes de escribirlos. No modificar vendors fuente ni
retirar integridad. El módulo nuevo exporta AppScreenLayout para conservar intacto
el EditorialContent existente de Noticias.

Empaquetado final: scripts/prepare-editorial-release.js toma el build canónico,
reemplaza solo cinco chunks focales e inserta los dos nuevos. Comprueba equivalencia
semántica de cada chunk ajeno y lo conserva byte por byte. Actualiza únicamente
cachebusters de bundle/worker; no publica ni ejecuta SQL.

scripts/test-editorial-repository-session.js verifica la suscripción tardía a Auth
(se define después en el bundle), respuestas en vuelo, cambio de cuenta, revocación
y fallo visible sin restaurar caché. Fixtures exclusivos del test.

## Verificación final y entrega preparada

La última revisión extendió la guarda de beneficios, perfiles y audiencias a
responsabilidades independientes de Convenios, incluso sin `module_admin`.
Conserva los checks de acción/publicación existentes: crear no concede publicar.
La prueba reproduce creación de beneficio no publicado en convenio gratuito y
rechaza el mismo intento en empresa de pago con COMPANY_MODULE_BOUNDARY_DENIED.
No modifica las filas de permisos ni el login empresarial.

Lectura productiva final: 2026-09-24T17:56:30.074Z. El conteo pasó de siete a ocho
asignaciones habilitadas durante el trabajo. La auditoría registra un UPSERT de
admin_assignments y un SET de admin_user_modules a las 17:19:08.288389Z. No se
atribuye actor. Funciones/ACLs siguen iguales, cero memberships empresariales
habilitadas y las nuevas migraciones NO están instaladas. La migración 002 toma
huellas del estado vigente al instalar: nunca restaura las siete asignaciones
del snapshot inicial. Evidencia: production-verification.json.

H-SCREEN-PERMISSION-FIX-001 RESULT
Status: PASS — implementación y validación aislada; NO DESPLEGADO.
Files changed: archivos focales y generados enumerados arriba; release.json identifica los siete chunks afectados y hashes SQL.
Source-of-truth verdict: PASS. Supabase editorial es autoridad nueva autorizada; componentes de negocio conservan su autoridad actual. Sin fallback local ni segunda autoridad.
Invariant verdict: PASS en pruebas aisladas; principal protegida, cuentas e historial conservados, grants sin cambios al instalar, login empresarial independiente preservado.
Build: PASS. v285, worker v219; 127 chunks ajenos conservados byte por byte; hash 8b77420b8fbfb614c8f7ea7028f29736c2634a535f4d036243bdee72dca7173e comprobado por navegador.
Tests: PASS. Empresas 10; editorial backend 12; navegador editorial 6; sesiones 6; módulos frontend 9; registro automático 20; contrato protegido 10 invariantes/3 migraciones. Regresión global local final y publicada PASS.
Security: PASS en alcance probado. RLS/RPC reales en PostgreSQL aislado, aislamiento de módulos y empresas, revocación con sesión previa, formularios versionados e idempotentes. Sin credenciales frontend nuevas.
Legacy impact: NOT APPLICABLE para escrituras; no cambios a cálculos ni escritores financieros/Google. Regresión de lectores/assets existentes PASS.
Unexpected files changed: ninguno atribuible a esta implementación fuera del alcance ampliado. Se conservan cambios previos de revocación, auditoría de cobertura y auditoría financiera ajena.
Known limitations: todavía no aplicado. Empresa con login se prueba con cuentas sintéticas porque producción no tiene memberships habilitadas. El global local usa PostgreSQL aislado SOLO para lectores editoriales nuevos; los assets y lectores previos son reales. Los primeros dos globales publicados fallaron por timeouts; se conservan sus evidencias y la tercera ejecución completa PASS. No garantiza ausencia absoluta de defectos futuros.
Evidence: ../qa/evidence/screen-permission-fix-20260924/ (release.json, isolated.json, editorial-isolated.json, editorial-browser.json, editorial-session.json, registration-isolated.json, admin-user-modules-frontend.json, global-local-final.json, global-published-third-run.json).

### Límites funcionales y recuperación

Los permisos individuales corresponden a los 37 módulos del menú administrativo;
las subvistas existentes conservan su módulo, no crean automáticamente un permiso
por cada componente visual. La integración editorial cubre las 20 rutas afiliadas
registradas y añade contenido: no sustituye formularios financieros o de identidad.
El registro de un nuevo módulo genera su incorporación al catálogo y exige frontera
backend/pruebas antes de publicar. Lo hace asignable, no lo concede a usuarios.

Recovery 002 comprueba datos/autorizaciones, definición y ACL de funciones, policy
y triggers; restaura definiciones capturadas en la instalación, respetando bytes
originales. Recovery 003 rechaza ediciones, respuestas y deriva de schema/seguridad.
Ambos pasan recuperación sin uso y rechazo después del uso probado. Lecturas sin
cambio de estado no se detectan. Después de guardar/recibir respuestas, conservar
datos y corregir hacia adelante: no ejecutar un rollback que borre historial.

Orden propuesto de aplicación: releer baseline productivo; aplicar 002 y después
003; verificar schema/grants y publicar exactamente v285. No repetir 001 ya
instalada. No revocar usuarios reales para probar. Si falla SQL, detener publicación;
si hubo uso, mantener datos y corregir hacia adelante. Esta entrega no ejecuta
esa aplicación ni publicación, conforme a la solicitud de probar antes de proponer.

### ARCHITECT REVIEW

Task reviewed: H-SCREEN-PERMISSION-FIX-001, entrega preparada.
Verdict: APPROVED para el alcance aislado y paquete revisable; no certifica despliegue.
What Codex did correctly: separó login propio de administración global, preservó grants, eliminó escritores editoriales ficticios y probó backend y UI.
Important findings: cierre de brecha Convenios independiente; conflicto de nombre News corregido; suscripción Auth tardía probada; SRI Windows corregido sin quitar integridad.
Problems detected: sin defecto pendiente identificado dentro del alcance probado. WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE.md corresponde al trabajo financiero detenido y no autoriza ese trabajo desde esta H.
Architecture implications: Repository editorial único, regiones aditivas, registro de rutas y módulos comprobado al construir.
Source-of-truth implications: configuración y versiones en Supabase; código conserva componentes y reglas de negocio.
Security implications: autorización backend; pruebas de sesiones abiertas, tenant cruzado y escrituras de módulo ajeno.
Data implications: ninguna escritura empresarial/editorial productiva durante esta H; cambios concurrentes de permisos se conservan.
Owner decision required: no nueva decisión de negocio para la implementación; aplicación/publicación pendiente de aprobar el paquete concreto.
Recommended next action: presentar migraciones 002/003 y release v285; no ejecutar trabajo financiero ni alterar historial.

SUTIAPP ARCHITECT REVIEW
Task: H-SCREEN-PERMISSION-FIX-001
Verdict: APPROVED (preparación aislada).
Critical findings: resueltos en código/pruebas; riesgos de despliegue declarados.
Source of truth: PASS.
Architecture: PASS en alcance; actualizar y comprobar Registry antes de entregar.
Security: PASS en alcance probado.
Data: preservación comprobada en aislamiento; producción leída, no migrada.
Legacy: sin escritores modificados.
Owner decision: NO para aceptar la implementación aislada.
Next action: presentar paquete preparado; aplicación no autocontinuable desde el reviewer.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar la H como implementación aislada preparada. Completar actualización y
freshness del Registry, cerrar servidor de prueba y presentar el paquete v285 con
002/003 para aplicación. No declarar producción corregida antes de aplicar y
verificar; conservar las ocho asignaciones vigentes y cualquier cambio posterior.
