# SUTIAPP — CORRECCIÓN Y MEJORA DEL REPORTE FLUJO DE EFECTIVO

## PRE-CHANGE AUDIT

- H: H-CASH-FLOW-FIXES-20261113.
- Objetivo: continuar la auditoría de Fable y corregir el lector/proyector y Excel, conservando fuentes originales.
- Autorización: instrucción adjunta del propietario, secciones 2–6; cambios ordinarios del reporte autorizados; publicación y cambios financieros productivos excluidos.
- Alcance: `supabase/functions/reports-jc/cash-flow-{loans,consolidated,savings,source-bases}.mjs`, `cash-flow.mjs`; `app/cash-flow-{export.js,report.jsx,projection-worker.js}`, bundle y cachebusters exclusivamente generados/focales; pruebas `scripts/test-cash-flow-*`; migración/recovery preparados `20261113000100_reports_jc_cash_flow_withdrawal_types.sql`; evidencia en `docs/qa/evidence/cash-flow-fixes-20261113/`; este informe y `docs/AGENT_CHANGELOG.md`; Registry derivado si cambia una dependencia.
- Fuera de alcance: escrituras Google/Supabase, IDs/históricos, reglas de amortización, otros módulos, despliegues, commits.
- Authority: cuotas y capital original PV2 (A/B/C/G/J/Z/AB/AC/AD), fecha de solicitud J y aprobación Y de Solicitudes; Ahorro e Inversores en Supabase. No usar S/AE para validar identidad o colocación. Capital original otorgado J prevalece sobre monto solicitado H cuando J es único y la identidad no está en conflicto; H se conserva como evidencia. Sin calendario, se mantiene el tratamiento vigente de solicitud aprobada.
- Readers: proyector compartido, worker local, Excel. Writers: ninguno nuevo; titulares originales conservados.
- Riesgos: ID duplicado no permite recuperar un segundo crédito por inferencia; fecha inválida no puede sustituirse por autorización; saldo parcial no equivale a saldo total; los otros descuentos no acreditan componentes de un préstamo.
- Tests: unitarios de identidad, texto numérico, fechas, todos los programas, saldos desconocidos, exportación, worker y UI; SQL aislado con recovery; matriz de Fable como referencia, diferenciando reproducciones sintéticas de fuentes originales disponibles.
- Recovery: copia exacta previa de archivos en `.tmp/cash-flow-fixes-20261113/before`; SQL reversible sin DML de negocio.
- Status: PASS para implementación local. Producción no autorizada.

## Guardians / contrato preservado

- Navigator: STALE únicamente por adición del informe de Fable; sin cambio previo en archivos indexados. Lookup insuficiente; discovery dirigido a los archivos citados y sus consumidores.
- Source of truth: SAFE; fuentes anteriores conservadas. Snapshots de pruebas y CSV son evidencia, nunca fallback runtime.
- Legacy: READ ONLY externo; SAFE CHANGE condicionado a pruebas locales. No editar hojas, fórmulas, triggers, cuotas ni IDs.
- Supabase: mismo contexto administrativo, JWT/RLS/grants. Migración preparada sólo modifica clasificación de lectura; sin nuevos permisos.
- UI: conservar selector de período, consulta, descarga, orden de Inversores/Caja, tabla mensual, detalle paginado, observaciones, registros sin mes, estados loading/error, navegación y estilos. Cambios visibles limitados a programas omitidos y distinción de saldos calculables/pendientes expresamente solicitados.
- Ahorro: no cambiar importes aceptados, clasificar enero por estimación ni trasladar diferencias de base a fechas inventadas.

## Resultado

**PASS como candidato local verificado. No publicado.** No equivale a conciliación completa del corte del 13 de noviembre ni a reparación de datos financieros.

Ampliación focal antes del build: `SutiApp.html` cambia exclusivamente la versión de `app/bundle.js`; `sw.js` no cambia. Bundle regenerado sólo en `cash-flow-report.jsx` y `cash-flow-export.js`, con comparación exacta de todos los demás módulos. Scripts y copias temporales quedan bajo `.tmp/cash-flow-fixes-20261113/`.

## Hallazgos confirmados y tratamiento

| Hallazgo | Antes | Después / estado |
|---|---|---|
| Importes de 3073 / 3078 en texto | Capital no determinado | **CORREGIDO:** texto decimal estricto aceptado; casos del informe reproducidos por $154,675.30. `REVISAR`, vacíos, formatos ambiguos y valores inseguros siguen desconocidos. Se conserva incidencia de tipo original. |
| H distinto de PV2 J, IDs 289 / 389 | Se anulaba capital | **CORREGIDO:** $6,000 y $10,000 de capital otorgado PV2 J, una vez por C; H queda en Base Solicitudes y la divergencia se informa. No se fuerza coincidencia con el recálculo de Fable basado en H ($1,069.60 / $6,000). |
| ID 2696 duplicado | Capital ambiguo; 2697 se colocaba por U | **PENDIENTE POR DATOS DE ORIGEN:** conservar dos solicitudes referenciadas, un ID, sin sumar dos colocaciones ni cambiar 2696 a 2697. El 2697 conserva capital/cuotas y queda sin mes de colocación cuando falta fecha de solicitud. |
| 27 huérfanos fechados por U | Autorización presentada como solicitud | **CORREGIDO:** U no sustituye fecha de solicitud. Se conservan contratos, cuotas, referencias e importes fuera de distribución; AG sólo sirve cuando contiene fecha original única documentada. No se borran los préstamos. |
| Fecha vacía del 202 / fecha 2029 del 2981 | Incidencia poco visible; saldo excluido antes de 2029 | **PENDIENTE POR DATOS DE ORIGEN:** advertencia con ID/referencias; cuotas conservadas. Si ya hay cuotas anteriores a la supuesta colocación, su saldo es desconocido, no cero. No inferir fecha correcta. |
| Ocho programas omitidos | Sin filas ni entrada en flujo | **CORREGIDO:** cada programa tiene descuentos operativos y futuros propios, incluidos en entradas consolidadas. No se inventa capital/interés/administración de préstamo para seguro, membresía u otros descuentos. Totales de préstamos nombran sus cuatro programas. Base PV2 conserva todas las filas no vacías. |
| Capital pendiente decreciente por AD ausente | Subtotal variable presentado en fila de saldo | **CORREGIDO en representación:** saldo total dice **Por conciliar** si algún préstamo es desconocido. Filas separadas para saldo calculable y capital original con saldo por conciliar, con referencias por ID. No sumar esas filas como si fueran saldo total. El capital original no se fecha antes de su primera evidencia. **PENDIENTE POR DATOS DE ORIGEN** para determinar saldos completos. |
| Salto de Ahorro $40,620 | Suma histórica parcial comparada con saldo canónico | **CORREGIDO en representación:** total histórico incompleto dice Por conciliar; fuentes, subtotal de base y puente explicativo se conservan. **PENDIENTE POR DATOS DE ORIGEN** para una serie histórica completa. No reubicar $40,620 en julio/febrero por inferencia ni cambiar saldo canónico. |
| 228 retiros sin tipo | RPC asignaba siempre `withdrawal_unspecified` | **CORREGIDO en migración preparada:** `Completo` → total; `Parcial` → parcial; cualquier otro valor sigue sin clasificación. Sin inferencia por monto/saldo. Instalación productiva pendiente. |
| Diferencias Ahorro Supabase/Google | Fuentes distintas | **NO CORRESPONDE A UN ERROR:** Supabase conserva autoridad, valores y fechas. No forzar $22,188.20 ni importes programados a coincidir con Google. |
| Enero 2026 | Aportaciones registradas; posible arrastre estimado | **PENDIENTE POR DECISIÓN FINANCIERA** sólo si se desea cambiar la clasificación: requiere respaldo del origen, nunca la regla aproximada de 1.5 cuotas. No se pide reconfirmar importes de Supabase ni se reabre la instrucción permanente. |
| Fechas Excel y conceptos repetidos | Fechas de bases como texto; concepto sin programa | **CORREGIDO:** fechas válidas como serial Excel con formato de fecha; fechas no interpretables y IDs/control permanecen texto. Base Cálculo identifica programa + concepto. Importes sin nueva agregación exclusiva de Excel. |

No se adopta la propuesta de Fable de colocar cada fila del ID duplicado: contradice la identidad única solicitada. Tampoco se adopta distribuir ajustes de Ahorro a meses hipotéticos: la fecha de inicio de un saldo histórico negativo no prueba la fecha ni naturaleza del capital faltante.

## Errores adicionales

El bundle local inicial contenía `cash-flow-report.jsx` pero no `cash-flow-export.js`, aunque la pantalla invocaba `SutiCashFlowExport.download`. Se incorporó el exportador real al bundle y se verificó el botón mediante descarga de un XLSX. Esto es un hallazgo del **workspace local**, no una afirmación sobre el bundle actualmente publicado. Se conservaron exactamente los otros **169 módulos**.

## Archivos y funciones

- `cash-flow-loans.mjs`: lectura monetaria, `deriveCashFlowLoans`, capital por ID, fechas, incidencias, saldo determinado y capital original pendiente.
- `cash-flow-consolidated.mjs`: `consolidateCashFlow`, descuentos de otros programas, totales con alcance explícito, estados Por conciliar y notas del criterio operativo (no comprobante bancario).
- `cash-flow-savings.mjs`: `reconcileSavingsCashFlow`, distinción entre total histórico incompleto y saldo canónico, conservando el puente y toda su aritmética.
- `cash-flow-source-bases.mjs`: `buildCashFlowSourceBases`, inclusión íntegra de cuotas originales en Base PV2.
- `app/cash-flow-export.js`: `dateCell`, `prepare`, `baseSheets`, estilos de fecha, concepto con programa y texto Por conciliar.
- `app/cash-flow-report.jsx`: texto Por conciliar, explicación de bases y versión del worker. Sin cambios de CSS, navegación, controles ni estructura de pantalla.
- `app/cash-flow-projection-worker.js`, `app/bundle.js`, versión de bundle en `SutiApp.html`: artefactos focales; `sw.js` intacto.
- Migración/recovery `20261113000100_reports_jc_cash_flow_withdrawal_types.sql`: dos sustituciones guardadas en el lector existente; sin tablas, datos, grants ni RLS nuevos.
- Tests: nuevos `test-cash-flow-reconciliation-fixes.mjs`, `test-cash-flow-withdrawal-types-sql.js`, `test-cash-flow-reconciliation-browser.js`; actualización de expectativas antiguas en `test-cash-flow-pv2-source.mjs` y `test-cash-flow-savings-sources-sql.js`.
- Evidencia, changelog y cinco JSON del Registry derivado. `cash-flow.mjs` permanece intacto: Ahorro sigue recibiendo los números tipados del RPC; no se introduce una segunda fuente ni cálculo de Excel.

## Comparación de fuentes y cifras

La matriz original de Fable existe: **502 filas**. Se conserva además como `fable-matrix-reference.json`, con SHA-256 del CSV, para evitar que `*.csv` impida compartir la evidencia. No es fixture ni fuente runtime.

No se encontraron las filas privadas completas de la consulta de Fable del 13-nov. Sí existe una copia de Google del **4-nov-2026 16:31:40Z**, con **20,281 cuotas**. Se reutilizó en modo de sólo lectura: mismo hash antes/después. Sobre esos registros se comprobó para los 48 meses de 2025–2028:

1. Suma directa de B por fecha A de **todos** los programas = cuotas incluidas en el candidato, tanto importes como cantidad de filas.
2. Suma de B de los cuatro programas de préstamo antes = después, al centavo.
3. Cada valor numérico mensual del Excel = valor del mismo objeto que consume el panel, sin diferencias.

| Año | Otros descuentos incorporados, copia 4-nov | Celdas mensuales panel/Excel |
|---|---:|---:|
| 2025 | $526,746.98 | 1,800 |
| 2026 | $1,317,829.23 | 1,800 |
| 2027 | $151,338.16 | 1,800 |
| 2028 | $0.00 | 1,800 |

**No confundir estos importes con los $2,023,200.39 de Fable**, que corresponden a otro corte e incluyen 2022–2024. La comparación explícita contra su matriz encuentra 26 meses coincidentes y 22 distintos entre las dos copias; se conservan los deltas en `fable-reference-comparison.json`. No se declara que las diferencias de dos snapshots distintos sean una conciliación final ni que estén explicadas fila a fila. Para esa verificación exacta hacen falta las cuotas/solicitudes originales del 13-nov y su snapshot autorizado de Ahorro/Inversores, o una nueva lectura simultánea de todas las fuentes y nuevo corte.

Los casos 3073/3078 y anomalías del informe se reproducen con fixtures sintéticos explícitos basados en los valores reportados, sin presentarlos como una nueva consulta productiva. El antes/después mensual de colocaciones **sobre la misma copia 4-nov** está en `real-source-regression.json`; no se extrapola su total al 13-nov.

## Verificación y recuperación

- **85 pruebas JS PASS**: proyección, identidad, texto numérico, fechas, AD desconocido, cuotas 2025–2028, fuentes, worker y Excel.
- **20 verificaciones SQL PASS** en PGlite aislado: tipos históricos, importes/fechas/balances iguales, guardas de deriva, owner/OID/ACL/search_path/timeout, denegaciones backend y recovery exacto. Cero conexiones productivas.
- **6 comprobaciones de navegador/worker PASS**: toda celda visible, exportación del mismo objeto, cambio de período/contexto, navegación, versión inválida y fallo del worker sin fallback.
- **Descarga real local PASS**: módulos del bundle, worker real, JSZip real, botón, XLSX leído, programa omitido incorporado y detalle de conciliación. Cero solicitudes externas. Capturas `report.png` / `detail.png` revisadas.
- **Regresión de copia original PASS**: 48 meses, 7,200 posiciones mensuales, todos los números exportados comparados; compilación y cálculo local de la copia grande entre aproximadamente 1.2 y 2.3 s por año en esta ejecución. Los XLSX de esa prueba alcanzan aproximadamente 5.7–10.8 MB; no es una medición de rendimiento productivo.
- Worker determinista verificado por su prueba de compilación y SHA-256. Build focal conserva 169 módulos ajenos por bytes.
- Registry actualizado y `python scripts/generate-architecture-registry.py check` = **FRESH**. La suite global `test-architecture-registry.py` se interrumpió por duración/alcance transversal; no se cuenta como PASS. No cambió el generador, y su fixture temporal no quedó presente. El gate focal es freshness y verificación de las dependencias modificadas.
- Recovery frontend: archivos exactos previos en `.tmp/cash-flow-fixes-20261113/before`. No restaurar todo el repositorio ni usar HEAD como baseline: había cambios previos extensos.
- Regresión global de imágenes: **NOT APPLICABLE**, según AGENTS: no se cambiaron repositorios compartidos, Auth, Storage, visor, routing ni lógica de SW. Bundle/cachebuster son GENERATED_ARTIFACT focales.

## Guardian reviews

**SOURCE OF TRUTH AUDIT — SAFE.** Cuotas/capital PV2, solicitud/estado Google, Ahorro/Inversores Supabase. Proyector y Excel son derivados; no nuevos writers, caches, fallback ni fuentes runtime. Los artefactos de evidencia no se importan en runtime.

**DATABASE MIGRATION AUDIT — PASS local / preparada.** Función existente, cuerpo previo fijado por MD5, ACL/owner/volatility/search_path/timeout verificados, reversión exacta probada. No PK/FK/tablas/datos/grants nuevos. Cualquier deriva productiva detiene la instalación; no se ha intentado instalarla.

**SUPABASE SECURITY REVIEW — PASS local.** Contexto administrativo, Auth/identidad y políticas conservados. Tests de denegación del lector y de no exposición del worker. Sin secretos frontend ni APIs de red/almacenamiento en el worker. No se afirma un despliegue ni una nueva verificación RLS productiva.

**CLAUDE UI PRESERVATION REVIEW — PASS.** Se conservan controles, tabla, detalle, observaciones, registros sin mes, navegación, scroll y estados. Se añaden únicamente programas y distinción de saldos solicitados; no hay rediseño ni secciones ajenas. Capturas del candidato y comparación de fuentes/estructura respaldan el resultado; no se realizó comparación pixel-perfect con producción.

## Pendientes para producción

El propietario excluyó el despliegue en este encargo. Quedan preparados frontend, worker y migración/recovery. Una activación posterior requiere autorización, preparar un paquete focal sobre el estado publicado (no subir todo este workspace), comprobar el hash del RPC vigente y ejecutar el readback de pantalla/Excel con fuentes simultáneas. Las reparaciones de IDs, fechas y registros históricos corresponden a sus responsables, con evidencia y autorización propia.

```text
H-CASH-FLOW-FIXES-20261113 RESULT
Status: PASS — candidato local y SQL preparado; conciliación financiera integral pendiente de datos de origen.
Files changed: fuentes, artefactos focales, migración/recovery, tests y evidencia enumerados arriba; Registry derivado y AGENT_CHANGELOG.
Source-of-truth verdict: SAFE; fuentes preservadas, sin autoridad paralela.
Invariant verdict: PASS local; C único, sin S/AE para identidad/colocación, B íntegro, desconocido distinto de cero, corte Hermosillo.
Build: PASS — worker determinista y bundle focal; 169 módulos ajenos intactos.
Tests: 85 JS + 20 SQL + 6 worker/UI + descarga real local + 48 meses de copia Google / 4 Excel.
Security: PASS aislado; sin ampliación de permisos, secretos ni conexiones productivas.
Legacy impact: ninguna escritura; sólo interpretación local autorizada y probada.
Unexpected files changed: ninguno detectado fuera del alcance; workspace previo preservado.
Known limitations: corte original de Fable no disponible completo; saldos incompletos no reparados; SQL no instalado; no publicado.
Evidence: docs/qa/evidence/cash-flow-fixes-20261113/
```

## SUTIAPP ARCHITECT REVIEW

Task: H-CASH-FLOW-FIXES-20261113 — candidato local, revisado contra fuentes/diff, manifest de build, SQL/recovery y pruebas.

Verdict: **APPROVED para el alcance local entregado**. No constituye aprobación de conciliación completa ni autorización productiva. La revisión se realiza en esta misma sesión como fase separada de inspección; no hubo un segundo agente independiente.

Critical findings: propuestas de sumar filas duplicadas o retrofechar ajustes se rechazaron; el exportador ausente en el bundle local se corrigió; diferencia entre cortes 4-nov y 13-nov declarada. Estado fuente de ID/fechas y saldos incompletos conserva pendientes.

Source of truth: preservada. Architecture: mismo pipeline; sólo dependencia focal de fechas/clasificación y artefactos derivados. Security: lector protegido y recovery exacto. Data: cero escrituras financieras. Legacy: intacto.

Owner decision: **NO para aceptar este candidato local**. Cualquier publicación o reclasificación financiera posterior mantiene su autorización separada. `WORK_QUEUE.md` existe para el master plan, no autoriza autocontinuar esta publicación; `WORK_QUEUE_HISTORY.md` no existe. No se invoca una autoridad de task-orchestrator inexistente en este alcance.

Next action: entregar candidato y pendientes. Response generated for Codex: **YES**.

### RESPONSE TO CODEX

Aprobar H-CASH-FLOW-FIXES-20261113 como preparación local verificada. Entregar este informe y la evidencia; conservar las anomalías originales. No publicar, aplicar SQL, cambiar Google/Supabase ni iniciar otra H con esta aprobación. Ante futura autorización de activación, reconstruir sólo el paquete focal sobre la versión publicada y verificar fuentes del mismo corte y readback de descarga.


## Activacion autorizada por el propietario (13-nov-2026)
La instruccion posterior "al terminar los cambios haz commit push y publica" sustituye la limitacion inicial de publicacion. Se autoriza commit/push y activacion del paquete focal; no escritura de registros financieros.

PRE-CHANGE AUDIT extension: checkout aislado sobre main 3bad1875f970f58e622af672d6daa487f208065f; fuentes focales coinciden con el baseline auditado. Se reconstruyen solo dos modulos del bundle publicado, preservando otros 177 modulos. SutiApp.html y sw.js cambian exclusivamente cachebusters a 2026111303, sin cambios de logica. Se agregan atributos para conservar bytes SQL, verificador browser focal, evidencia productiva, changelog y Registry derivado del checkout. Los helpers privados de empaquetado/despliegue quedan en .tmp. No se copia el Registry ni el bundle ajeno del workspace.

Backend: index.ts vigente solicita sourceSnapshot:true; el calculo modificado se ejecuta en el worker. No se necesita redeploy Edge para esta ruta. El RPC de retiros se respalda y valida por PostgreSQL directo; la API de gestion respondio 401 y no se cambiaron credenciales. Fuente, permisos, importes y fechas se preservan. Recuperacion: SQL inverso probado y commit anterior para artefactos.

Gates de activacion: build publico, tests focales, permisos estructurales, paridad del candidato en navegador contra fuentes reales, descarga Excel; despues push/Pages y readback productivo. El cachebuster es GENERATED_ARTIFACT focal: regresion global de imagenes NOT APPLICABLE segun la instruccion AGENTS vigente del propietario. Status: PASS para preparar; publicacion pendiente hasta obtener evidencia.

El candidato real detecto y corrigio registeredAmount ausente en otros descuentos: mismos importes, detalle y Excel trazables. Regresion dedicada agregada; total esperado 86 tests JS.


### Gates productivos antes del push
Build PASS. 86 tests JS PASS en checkout aislado y 20 checks SQL PASS. Navegador autenticado con fuentes reales: 1,800 posiciones mensuales panel/Excel y 124,347 registros de detalle coinciden; 12,232 cuotas originales verificadas, cero mocks financieros/escrituras/errores JS. RPC instalado con guarda de hash: 40919970206e49e46616e5b3af842842 -> c62e10f905af84e0db2efa076b53eff8. Owner, OID, ACL, search_path y timeout conservados. No se necesita redeploy Edge: index.ts retorna sourceSnapshot:true y el worker ejecuta la proyeccion.
Registry del checkout tenia desfase heredado de publicaciones documentales anteriores. Se actualiza el indice derivado desde archivos reales, sin editar esos archivos ni incorporar cambios ajenos del workspace. No cambia el generador; prueba global del Registry NOT APPLICABLE para este ajuste focal; se verifica freshness.
SUTIAPP ARCHITECT REVIEW: APPROVED para activacion autorizada, como fase separada de revision en esta sesion. Evidencia nueva: publication-preflight.json, browser-live-candidate.json, reader-applied.json, release-unit-tests.txt y release-sql-tests.txt. Permisos y autoridades conservados; datos historicos intactos. Owner decision: NO. RESPONSE TO CODEX: hacer commit/push del paquete permitido, esperar Pages y verificar hash, pantalla y descarga productivos; no ampliar alcance ni modificar datos financieros.


## Cierre de publicacion y readback productivo
La seccion presente sustituye los estados locales/preparados anteriores. Commit implementacion: `00d766dea1f4cd4f31d1398c63ec78c00380beca`, push a main completado. Pages run `43490198472` SUCCESS, incluyendo Auth, contrato de solicitudes, build y verificacion productiva. Version publica `2026111303` en https://sutiapp.com/.

Readback real sin overlay ni mocks: bundle/worker/SW coinciden por SHA-256. Panel y descarga Excel coinciden en 1,800 celdas mensuales y 124,347 registros de detalle; 20,851 fechas PV2 son fechas numericas Excel; 68 celdas conservan texto Por conciliar. El lector devuelve los 228 retiros historicos: 195 totales, 31 parciales y 2 sin tipo acreditado. No se infiere tipo para esos dos registros.

```text
H-CASH-FLOW-FIXES-20261113 RESULT
Status: PASS - implementado, commit/push y publicado; lectura productiva verificada.
Files changed: 47 archivos del commit focal; cierre adicional de evidencia/verificador y Registry derivado.
Source-of-truth verdict: SAFE; Google PV2/solicitudes, Supabase Ahorro/Inversores preservados.
Invariant verdict: PASS; trazabilidad, identidad C, desconocido distinto de cero, sin escrituras financieras.
Build: PASS; 177 modulos ajenos preservados, artefactos productivos coincidentes.
Tests: 86 JS, 20 SQL, navegador candidato y produccion, descarga Excel real.
Security: PASS; Auth/backend, ACL/OID/owner/config del lector conservados, cero secretos publicados.
Legacy impact: ninguna escritura a fuentes; lectura/interpretacion autorizada.
Unexpected files changed: ninguno en el paquete publicado; workspace previo conservado.
Known limitations: anomalias originales de ID/fecha/componentes permanecen; dos retiros sin tipo; no se afirma conciliacion historica integral.
Evidence: publication-result.json, browser-live-production.json, http-production.json y release-files.json en docs/qa/evidence/cash-flow-fixes-20261113/.
```

SUTIAPP ARCHITECT REVIEW: APPROVED tras contrastar diff permitido, pruebas, hashes y readback productivo. Revision separada en esta misma sesion, sin segundo agente. Source of truth, Architecture, Security, Data y Legacy: PASS dentro del alcance; datos originales intactos. Owner decision: NO. Next action: cerrar esta H sin iniciar otra ni reparar registros de origen. Response generated for Codex: YES. RESPONSE TO CODEX: entregar commit, URL publicada y limitaciones originales; conservar evidencia y no modificar datos financieros.
