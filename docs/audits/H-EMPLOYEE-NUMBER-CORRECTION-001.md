# H-EMPLOYEE-NUMBER-CORRECTION-001

## Estado vigente: publicado y SQL aplicado

Commit funcional `9cf86f64e7363b94411069a83ca530856db7f749`, [PR17](https://github.com/David14081982/SutiApp-private/pull/17), fusionado como `ac0fc3ea04308f4c42cbada5df8d6a1560d70981`. CI del PR PASS. [Pages](https://github.com/David14081982/SutiApp-private/actions/runs/43060286718) terminó SUCCESS el 2026-11-11 a las 16:38:39Z, incluidas las comprobaciones de Auth y envío de solicitudes; el workflow de contrato Membership del commit fusionado también terminó SUCCESS. No se omitieron checks ni se forzó push.

La instalación SQL se bloqueó inicialmente por revisión automática, antes de ejecutarse, por falta de autorización SQL suficientemente específica y de preproducción adicional. El propietario respondió expresamente «Autorizar SQL sin preproducción adicional» para los cuatro cuerpos y la migración 20261111000200. Con esa autorización posterior se aplicó a las 16:40:31Z; la lectura posterior de 16:40:47Z terminó PASS.

Se sustituyeron sólo los cuatro cuerpos aprobados y se insertó una fila técnica en `supabase_migrations.schema_migrations`. Nueve tablas de negocio conservaron sus conteos y huellas dentro de la transacción; firmas/OID/ACL/owner/configuración/bindings/RLS quedaron iguales. Cero escrituras de afiliados, documentos, Auth, solicitudes u objetos Storage. 14262 conserva cinco referencias documentales y 8322 permanece sin alta real. El respaldo legible queda local; el recovery exacto y el procedimiento de instalación se probaron previamente en PostgreSQL sintético. No hubo despliegue en un entorno separado de preproducción, conforme a la excepción expresa del propietario.

Los hashes publicados de HTML, bundle y service worker coinciden con el candidato. Pantalla pública de acceso comprobada en 390 y 1440, sin errores JS, sin iniciar sesión y bloqueando solicitudes distintas de GET/HEAD. Este smoke no certifica una alta real ni sustituye las 24 comprobaciones SQL/Storage y 33 de navegador sintéticas. Se conservan los tres fallos heredados: la publicación focal está verificada, no la salud integral de toda la app.

Evidencia posterior: [SQL aplicado](../qa/evidence/employee-number-correction/production-sql-applied.json), [SQL verificado](../qa/evidence/employee-number-correction/production-sql-verify.json), [frontend publicado](../qa/evidence/employee-number-correction/published-frontend.json), [resumen de publicación](../qa/evidence/employee-number-correction/publication-result.json). El recibo frontend se tomó durante el bloqueo SQL inicial; el resumen posterior acredita que éste se resolvió. Los estados de candidato/BLOCKED de las secciones siguientes son evidencia histórica anterior a estas autorizaciones, no el estado vigente.

Empaquetado: se retiraron únicamente líneas vacías finales de los SQL y dos scripts de prueba, y se regeneró el diff frontend sin líneas de contexto, para pasar `git diff --cached --check`. Ningún cuerpo SQL ni fuente runtime cambió. [publication-manifest.json](../qa/evidence/employee-number-correction/publication-manifest.json) sustituye los hashes de archivo afectados del manifiesto local histórico; los hashes de definición PostgreSQL se conservaron.

## Autorización posterior de publicación

El propietario ordenó: «LA CORRECIÓN QUE REALISASTE EN RAMA AISLADA Y QUE SIGUE LOCAL, HAZ COMMIT PUSH Y PUBLICA», después de recibir la explicación de los tres fallos heredados. Esta instrucción reemplaza la limitación anterior de entrega exclusivamente local para este candidato exacto. No autoriza corregir esos fallos financieros, registrar personas reales ni tocar documentos.

Alcance de publicación: commit/push de los archivos focales y evidencia revisados, PR con CI sin omitir comprobaciones, despliegue Pages y sustitución transaccional de los cuatro cuerpos SQL preparados con registro técnico de migración. Se conservan sus hashes aprobados. Se revalidan el baseline, el respaldo legible y la recuperación; se cotejan huellas de tablas de negocio antes/después dentro de la misma transacción, sin exportar filas personales. Orquestación temporal y respaldo permanecen bajo `.tmp/employee-number-correction/`; sólo se publica evidencia técnica depurada. Se permiten adendas de resultado en este informe, changelog, SOURCE_OF_TRUTH, INVARIANTS y MIGRATION_RULES para reflejar lo efectivamente desplegado. Sin cambios de infraestructura, RLS, permisos, lógica financiera ni datos de usuarios.

El bloqueo global histórico de las secciones siguientes no se transforma en un resultado verde: los tres fallos heredados siguen documentados. El criterio de esta publicación autorizada es el candidato focal aprobado, integridad de sus fuentes y CI de GitHub aprobado. Estado actual de publicación: EN CURSO; el resultado se añadirá con evidencia.

## Pre-change audit

Status: local focal verification PASS; global acceptance BLOCKED by three inherited test failures. Production is unchanged. Local implementation authorized by the owner's latest instruction.

Objective: a mistyped employee number abandoned after correction may be captured for another person when no affiliate currently holds it. Preserve each affiliate UUID and all related records. RH assigns numbers; SutiApp neither generates nor suggests them.

Scope: current-number reservation in the existing guard and control-change preview; consistent trimmed TEXT/80-character capture and duplicate checks; specific creation errors in the existing alert; synthetic database/browser regression and recovery. Current assignments, including archived affiliates, remain unavailable. Existing audit/history is preserved, with no new user-facing record, mandatory reason, or workflow.

Excluded: production writes/deployment, registering real 8322, updating real 14262 or its five files, financial readers/calculations/Google/SICOF, historical search expansion, new screens/styles/dependencies, data cleanup or global uniqueness constraints on legacy rows.

Authority: public.affiliates is the current identity/number authority; affiliate_control_changes remains historical evidence and is not a permanent reservation. Documents, requests and Auth retain their existing UUID relationships. Existing RLS, grants, actor separation and module boundaries remain unchanged. The owner's explicit correction policy supersedes perpetual reservation only; it does not authorize changes to any financial authority.

Planned files:
- app/screens-admin-affiliates.jsx (focal capture/error handling only).
- supabase/migrations/prepared/employee-number-correction/20261111000200_employee_number_correction.sql (not applied to production).
- supabase/recovery/20261111000200_employee_number_correction.sql.
- scripts/test-employee-number-correction.cjs and scripts/test-employee-number-correction-browser.cjs; an isolated PostgreSQL concurrency runner if required.
- scripts/employee-number-document-checks.cjs (synthetic real Storage/RLS checks used by the integration runner).
- scripts/fixtures/employee-number-correction-schema.json (schema/function definitions only, no real business rows or credentials).
- docs/qa/evidence/employee-number-correction/* (synthetic/redacted evidence), this report and final governance changelog entries.
- app/bundle.js and its existing generated version references, only if required by the local build; no hand edits to generated code.
- architecture Registry entries only if an actual architecture dependency changes, not solely implementation details.

Scope clarification before final documentation: add narrow, local-candidate addenda to docs/SOURCE_OF_TRUTH.md and docs/INVARIANTS.md. Their historical perpetual-reservation statements must remain readable but be distinguished from the owner's newly authorized current-assignment rule. These are technical repository documents, not new affiliate records or UI audit requirements. docs/AGENT_CHANGELOG.md records the implementation result.

Screen contract: preserve roster, search, filters, pagination, existing action controls, profile/document/request/access/audit tabs, create/edit/change dialogs, layout, styling, responsive behavior and navigation. Only authorized error copy, input constraints and normalization may change.

Risks: concurrent assignment of the same current number; archived identity conflicts; padded/leading-zero strings; changed RPC grants or signatures; hidden duplicate-validation mismatches; rollback after a real reuse. Preserve financial behavior by source-hash comparison and unchanged existing regression suites. No mutation of any real person is part of verification.

Verification: reproduce historical reservation and generic creation errors before changes; synthetic new account, documents/UUID isolation, correction/reuse, current/archived collision, concurrent writes, limits/whitespace, duplicate CURP/RFC and permissions; existing focal regressions, browser interaction/structure, build and reviewed diff. A read-only before/after comparison for the real 14262 may supplement synthetic tests; it cannot substitute for them.

Recovery: restore exact original function definitions and focal frontend before production reuse. After reuse, stop further reuse and retain all people, documents and history; do not claim that restoring code reverses legitimate identity assignments. Test recovery locally, including owner/signature/grant/search_path preservation. No existing data is deleted to facilitate rollback.

Production: no production changes authorized by this implementation step; deployment and any real account creation remain unperformed.

## Resultado — 2026-11-11

La corrección está implementada en la rama local `fix/employee-number-correction`, basada en `36977c57db14e4cbfd485e80ce194e49fd10a2d4`, dentro de `.tmp/employee-number-correction`. No hay commit, push, PR, despliegue ni migración productiva de esta H.

El caso reproducido es concreto: con 14262 vigente y una fila histórica 8322→14262, la preconsulta devolvía cero coincidencias para 8322 y el guard rechazaba el alta con `AFFILIATE_CONTROL_RESERVED`. Ahora, en el entorno sintético, el alta crea otro UUID para 8322; el expediente anterior mantiene sus cinco documentos y la persona nueva comienza sin documentos heredados. Un número actualmente asignado sigue bloqueado, incluso si su titular está archivado.

RH sigue asignando los números y el administrador los captura. No se calculan números, no se agregan pantallas ni se exige una nueva constancia o motivo. La evidencia histórica que ya existía permanece intacta. Préstamos, capacidad, Google y SICOF conservan sus fuentes y reglas.

Verificación focal: 2 reproducciones SQL previas y 24 comprobaciones posteriores PASS; navegador 33/33 PASS; build PASS. La regresión ampliada NO está completamente verde: tres pruebas fallan también en la versión base. No se encontraron regresiones nuevas en las pruebas ejecutadas; no se declara certificación integral ni autorización de publicación.

La captura productiva de solo lectura de 15:54:04Z coincide con la inicial de 15:24:59Z: una fila de 14262, cinco referencias documentales, mismas huellas de perfil/documentos/activos/historial; cero filas vigentes de 8322. Las cinco funciones cotejadas siguen con sus definiciones productivas originales. No se volvieron a descargar los documentos reales: esta comprobación acredita metadatos y referencias, no una nueva lectura física de esos archivos.

## Cambio exacto y dependencias

| Archivo o función | Cambio mínimo | Impacto y límites |
| --- | --- | --- |
| `app/screens-admin-affiliates.jsx` | Alta: mismo número recortado con regla ASCII equivalente a `btrim` para preconsulta y guardado; máximo 80; mensajes seguros por código conocido, incluido 40001. | Sólo el alta y su espacio de error existente. Conserva layout, estilos, controles, demás campos y handlers. No muestra detalles SQL desconocidos. |
| `affiliate_control_reservation_guard()` | Sustituye la reserva del historial por una comprobación de asignación vigente; bloqueo transaccional por número. RR devuelve 40001 para evitar una decisión con snapshot antiguo. | Afecta escrituras que asignen o cambien el número. Nulos y actualizaciones sin cambio conservan su tratamiento. No limpia duplicados legacy ni impone UNIQUE global. |
| `find_admin_affiliate_duplicates(jsonb,uuid)` | Aplica `btrim` al número entrante en las dos comparaciones. | Admin alta/edición reciben la misma regla que el guardado. RFC, CURP, correo, permisos y resultado JSON permanecen iguales. |
| `preview_admin_affiliate_control(uuid,text)` | Recorta la entrada y elimina únicamente el bloqueo por número encontrado en la bitácora. | Conserva colisiones vigentes, revisión/versionado, vínculo Auth y bloqueos por referencias ajenas. |
| `change_admin_affiliate_control(...)` | Recorta `p_new_control` antes de comparar el reintento idempotente. | Conserva transacción, permisos, auditoría ya existente, UUID y actualizaciones del perfil que ya hacía el RPC. |
| SQL preparado y recuperación | Sustituyen sólo cuatro cuerpos existentes; exigen hashes/metadata/bindings esperados y bloquean escrituras concurrentes durante la sustitución. | Firma, propietario, ACL, `search_path`, volatilidad y seguridad se conservan. Lock timeout 2s y statement timeout 60s; error implica rollback transaccional. No DML de negocio. |
| `app/bundle.js`, `SutiApp.html`, `sw.js` | Build de la pantalla y cuatro referencias de versión `2026111101`. | Sólo cambia un bloque de 177; los otros 176 son idénticos. No cambia la lógica del service worker. |
| Pruebas, fixture y documentos técnicos de esta H | Evidencia sintética, recuperación y adendas de autoridad. | Sin nuevas dependencias runtime ni bitácora funcional para afiliados. |

El script de instalación está en `supabase/migrations/prepared/employee-number-correction/20261111000200_employee_number_correction.sql`; no está en la ruta automática de migraciones aplicadas. `create_admin_affiliate` se verifica como baseline y no se sustituye. No cambian tablas, columnas, rutas, RLS, permisos Storage, repositories compartidos, autenticación global ni lectores financieros. El Registry no cambia: conserva los mismos nodos y dependencias; su estado general STALE no se representa como una certificación nueva.

Diffs revisables: [frontend y referencias de versión](../qa/evidence/employee-number-correction/frontend.diff) y [cuatro cuerpos SQL](../qa/evidence/employee-number-correction/database.diff). El script preparado contiene además las comprobaciones de instalación y el bloqueo transaccional descritos arriba. El [manifiesto final](../qa/evidence/employee-number-correction/final-manifest.json) fija 19 hashes de fuentes y evidencia.

## Evidencia antes y después

Todos los enlaces siguientes son relativos a este informe. Las salidas y screenshots son locales.

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| SQL antes: reserva histórica falsa y preconsulta que ignora espacios | 2 fallos reproducidos como casos esperados | [database-before.json](../qa/evidence/employee-number-correction/database-before.json) |
| SQL después: alta, edición, corrección/reutilización, límites, ceros, acentos, RFC/CURP, permisos y búsqueda Admin | PASS | [database.json](../qa/evidence/employee-number-correction/database.json) |
| Concurrencia READ COMMITTED y SERIALIZABLE | Sólo una asignación confirmada; perdedor rechazado | Mismo informe SQL, con códigos de error |
| REPEATABLE READ | Rechazo 40001 y ninguna fila persistida | Mismo informe SQL |
| Storage real local: cinco anteriores y uno nuevo | Hash/bytes correctos; reintento sin segunda fila/objeto | Mismo informe SQL |
| Perfil propio y documentos entre dos cuentas | Dos identidades distintas; seis GET ajenos denegados; RLS y RPC propios correctos | Mismo informe SQL |
| Recuperación | Funciones originales restauradas exactamente en la ejecución local, sin borrar el nuevo UUID ni su documentación/historial | Mismo informe SQL |
| Navegador antes | Tres fallos del alta reproducidos; el error 40001 se reprodujo adicionalmente antes de su ajuste | [browser-before.json](../qa/evidence/employee-number-correction/browser-before.json), [serialization-error-before.json](../qa/evidence/employee-number-correction/serialization-error-before.json) |
| Navegador después | 33/33, sin errores JS ni solicitudes externas; estructura/interacción a 390 y 1440 | [browser-after.json](../qa/evidence/employee-number-correction/browser-after.json) |
| Build final | 177 bloques; sólo cambia la pantalla de Afiliados | [serialization-error-after.json](../qa/evidence/employee-number-correction/serialization-error-after.json) |
| Préstamos/historial/capacidad offline | 8/10 suites PASS; dos fallos iguales en baseline | [legacy/summary.json](../qa/evidence/employee-number-correction/legacy/summary.json) |
| Fuentes financieras/compartidas | 89 sin cambio de contenido normalizado LF; 4 byte-exact y 85 con diferencias únicamente CRLF/LF propias del checkout | [legacy/source-integrity.json](../qa/evidence/employee-number-correction/legacy/source-integrity.json) |
| 14262 y funciones productivas | Huellas iguales; cero escrituras; 8322 no creado | [read-only-preservation.json](../qa/evidence/employee-number-correction/read-only-preservation.json) |

Comandos focales ejecutados: `node scripts/test-employee-number-correction.cjs`; `node scripts/test-employee-number-correction-browser.cjs --before`; `node scripts/test-employee-number-correction-browser.cjs`; `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`; comprobaciones de sintaxis y `git diff --check`. Para reproducir la integración hacen falta los helpers existentes `scripts/document-lab`, su snapshot schema-only del 2026-11-06, PostgreSQL 18 y los servicios/dependencias locales del laboratorio; no basta un checkout limpio sin esos prerrequisitos. Los 15 cuerpos del fixture actualizan las funciones focales/dependencias capturadas; no se afirma que todo el schema del laboratorio sea idéntico a producción al 11 de noviembre.

Los primeros intentos del laboratorio se detuvieron por falta de espacio/arranque y por errores en las fixtures sintéticas: límite de tamaño del tipo, parámetro UUID ambiguo y uso repetido de un tipo documental con slot único. Se corrigieron sólo las fixtures y se retiraron únicamente los clústeres temporales propios, detenidos y con ruta verificada. No se relajó ningún constraint. La corrida final 15:56–15:57Z terminó PASS y detuvo sus servicios. El fallo intermedio de navegador por un contador llamado `window.closed` se corrigió en el harness; su evidencia se conserva.

## Cómo revertir

1. Actualmente producción no requiere reversión: esta H no se instaló allí.
2. En un entorno donde se hubiera aplicado exactamente este candidato, ejecutar transaccionalmente `supabase/recovery/20261111000200_employee_number_correction.sql`. El script exige los hashes del candidato y la metadata original; si detecta cambios ajenos, aborta. Se probó en PostgreSQL local con las personas y documentos sintéticos ya creados.
3. Para descartar el frontend en esta rama aislada, restaurar sólo `app/screens-admin-affiliates.jsx`, `app/bundle.js`, `SutiApp.html` y `sw.js` desde `36977c57db14e4cbfd485e80ce194e49fd10a2d4`, después de comprobar que no haya trabajo posterior mezclado. No restaurar el workspace principal completo.
4. Restaurar código no deshace asignaciones legítimas ya hechas ni debe borrar personas/documentos. La prueba confirmó que el nuevo UUID permanece tras reinstalar el guard anterior. Las adendas documentales deben marcarse como candidato retirado si se descarta; conservar su evidencia.

## Hallazgos adicionales, sin tocar

- `scripts/test-admin-affiliates.js` falla en `/const belongsToAffiliate=/`, línea 80, sobre una dependencia financiera intacta. Mismo fallo en baseline y candidato. Las aserciones posteriores no se ejecutaron. [Comparación](../qa/evidence/employee-number-correction/build-and-baseline-20261111.json).
- `scripts/test-native-financial-rules.js`: `NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT: get_financial_runtime_rules`, también en baseline.
- `scripts/test-financial-mostrar-override.js`: `available credit includes only eligible shown fund: null !== 10000`, también en baseline.
- El cambio de número conserva `NUMBER_HAS_UNRELATED_RECORDS` y `ACCESS_REPAIR_REQUIRED`. Corregir la reserva histórica no autoriza saltarse esas protecciones ni resolver registros externos. La creación nueva y la corrección existente no son operaciones idénticas.
- No se amplió la búsqueda para interpretar periodos de titularidad. Tampoco se agregó sugerencia/generación de números, según la aclaración de RH.

## Qué sigue sin validar y estado de entrega

No se certifican GoTrue/login real, PostgREST HTTP, Edge/TUS, un flujo navegador→backend completo ni dispositivos móviles físicos. El navegador usa pantalla y repository reales con RPC sintético; SQL/Storage se validan por separado con JWT locales. No hubo solicitudes ni cargas de usuarios reales. Los préstamos y capacidad se verificaron con sus pruebas sintéticas existentes, sin afirmar elegibilidad de ninguna cuenta real ni revisar SICOF/Google.

La regresión global de imágenes contra producción es NOT APPLICABLE en esta H: no cambia ningún componente compartido de los enumerados por AGENTS; bundle y cachebusters son artefactos derivados del módulo focal. No se ejecutó una prueba live que pudiera confundirse con validación de publicación. No hay CI, PR ni despliegue de este candidato.

La [revisión independiente](../qa/evidence/employee-number-correction/independent-review.md) emite APPROVED exclusivamente para el candidato focal local y verifica 19/19 hashes. Mantiene BLOCKED la aceptación global/publicación y no autoriza una alta real. No identifica defectos bloqueantes nuevos dentro del alcance revisado.

```text
H-EMPLOYEE-NUMBER-CORRECTION-001 RESULT
Status: BLOCKED para aceptación global/publicación; corrección focal local PASS.
Files changed: una pantalla focal; cuatro cuerpos SQL preparados y recovery; bundle/cachebusters; pruebas/fixture/evidencia; informe y adendas de gobierno.
Source-of-truth verdict: PASS, affiliates vigente y UUID conservados.
Invariant verdict: PASS focal; excepción de reserva histórica expresamente autorizada.
Build: PASS, 176 de 177 bloques intactos.
Tests: SQL antes2/después24 PASS; navegador33 PASS; 8/10 suites legacy PASS; 3 fallos heredados en total al incluir la prueba estática Admin.
Security: permisos/metadata/RLS conservados; aislamiento local PASS.
Legacy impact: cero cambios de contenido en89fuentes cotejadas; sin acciones Google/SICOF.
Unexpected files changed: ninguno en la rama aislada.
Known limitations: las descritas arriba; no aceptación integral ni producción.
Evidence: docs/qa/evidence/employee-number-correction/.
```
