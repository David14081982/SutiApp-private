# H-SICOF-EVIDENCE-INTEGRATION-001

## PRE-CHANGE AUDIT — 2026-10-04

Autorización: el propietario eligió la opción 1: corregir integración con evidencia existente, sin cambiar reglas financieras. Incluye la presentación de pendientes propuesta; no autoriza inventar historia, acreditar rendimientos ni modificar Google.

Objetivo: conectar evidencia canónica de importes esperados cuando su vigencia esté demostrada; separar calidad de desglose de pagos de la evidencia del estado/adeudo; mostrar pendientes y procedencia en los KPI.

Alcance de escritura declarado:
- Este informe, `docs/AGENT_CHANGELOG.md`, evidencia agregada en `docs/qa/evidence/sicof-evidence-integration/` y respaldos locales en `.tmp/sicof-evidence-integration/`.
- `supabase/functions/sicof/engine.mjs`, `loan-calculation.mjs`, `projection.mjs` si se requiere conservar nuevos campos en el transporte compacto.
- Migración/recovery nuevos `20261004000100_sicof_evidence_integration.sql`, exclusivamente lector privado de SICOF y backup de definición; numeración a comprobar antes de publicación.
- `scripts/test-sicof-evidence-integration.js`, `scripts/test-sicof-evidence-context.js`, `scripts/test-sicof-evidence-ui.js`, `scripts/build-sicof-evidence.js`, `scripts/inspect-sicof-evidence.js`; fixture de definiciones sin datos `scripts/fixtures/sicof-evidence-schema.json`.
- `scripts/test-sicof-engine.js`: actualizar la versión esperada del motor al cambiar su interpretación de evidencia; conservar las pruebas previas.
- `scripts/test-sicof-exports.js`: permitir ruta explícita del Excel histórico auténtico para verificar sus bytes desde la copia privada existente; no sustituirlo por un fixture.
- `app/sicof-admin.jsx`; artefactos generados `app/sicof-simulation-worker.js`, `app/bundle.js`, versiones asociadas de `SutiApp.html`, `sw.js` y `app/sicof-simulation-client.js` únicamente si son necesarias para invalidar el worker generado.
- Registry derivado y overrides sólo para dependencias nuevas demostradas.
- Cierre/publicación focal: `scripts/release-sicof-evidence.js`, `scripts/verify-sicof-evidence-live.js` y fixture sin datos `scripts/fixtures/sicof-loan-calculation-before-evidence.mjs`. El checkout limpio `.tmp/sicof/release` coincide con fuentes originales y bundle v322; recibirá únicamente este delta, su documentación, pruebas y Registry derivado. No copiar documentación previa modificada completa: sólo anexar el cierre de esta H.
- Verificación de la superficie publicada: `scripts/verify-sicof-evidence-ui-live.js`; login existente, descarga/relectura del mismo archivo y cálculo de escenario, sin guardar escenarios, modificar preferencias ni ejecutar writers financieros. Archivos reales descargados sólo en `.tmp`, sin screenshots ni PII en evidencia pública.

Fuera de alcance: tablas financieras, saldos, pagos, acreditaciones, Google/Apps Script, cambios de reglas, autenticación, Storage, fuentes alternativas, reconstrucción de saldo diario con evidencia incompleta. No desplegar un cambio incompleto ni publicar archivos ajenos del workspace.

Autoridades/lectores: ahorro `savings_transactions`, inscripciones/planes canónicos, certificaciones e historia aceptada; préstamos `HISTORIAL P V2`. Contexto privado SICOF, analizador y motor compartido son derivados; no se crea otra autoridad. La copia temporal de préstamos conserva su vigencia y permisos.

Invariantes: histórico recibido no demuestra importe esperado; plan actual no demuestra vigencia pasada; un saldo certificado no demuestra saldo diario anterior. Desglose ambiguo sigue excluido de ingresos aunque un estado de préstamo tenga evidencia independiente suficiente. Sin evidencia, null/pendiente explícito.

Riesgos: relajar accidentalmente elegibilidad, duplicar aportaciones al reconstruir historia, confundir suma vacía con rendimiento nulo confirmado, diferencias entre servidor/worker. Se probarán casos adversos y equivalencia de importes/pagos no afectados.

Recovery: copias exactas/hash antes de editar; migración con guardas de definición/ACL/owner, backup privado y recovery que restaure la función y retire sólo el helper nuevo. Cero DML financiero.

Navigator: STALE en la feature; discovery dirigido en motor, migraciones, contexto instalado y transporte. No se usa Registry como evidencia financiera.

UI preservada: ocho pestañas y secciones, doce tarjetas en su orden, parámetros/filtros, tabla/desglose, modales, escenarios, exportaciones, navegación y estructura responsive. Sólo texto/estado y explicación de evidencia; sin quitar componentes.

Status: PASS para implementación local y pruebas; aplicación/publicación sólo con candidato y recuperación verificados dentro de la autorización vigente.

## Hallazgos previos

Build: el bundle raíz está en v312 y no contiene el worker/flujo de archivo vigente; producción está en v322. El build focal se prepara en `.tmp/sicof-evidence-integration/candidate/` desde el artefacto público v322 comprobado, sustituyendo exclusivamente los dos chunks SICOF cambiados y su worker. Los artefactos antiguos del workspace raíz se conservan; no se publican sus cambios ajenos ni se usa el builder histórico que reconstruye v312.

Consultas productivas exclusivamente `BEGIN READ ONLY`, sin PII en resultados:
- 1,298 filas `CERTIFIED_HISTORY` desde julio, 328 cuentas: **cero** filas cubiertas por un plan canónico vigente en la fecha. No es válido proyectar retrospectivamente el plan actual.
- Las 26 proyecciones con saldo nulo tienen identidad/certificación pero cero movimientos y `ENROLLMENT_UNVERIFIED`; no es un nombre de campo equivocado.
- Los préstamos revisados tienen estado y agregados actuales uniformes en muchos casos; el analizador mezcla errores de desglose de cuotas con la capacidad de conocer un atraso. Se corregirá únicamente cuando identidad, estado y agregados requeridos estén demostrados y sean coherentes.
- El promedio diario anterior al corte certificado permanece sin prueba. Esta H no promete que toda cuenta se vuelva elegible ni que la tasa quede resuelta.

## Guardians

SOURCE OF TRUTH: SAFE para conexión de evidencia autoritativa, sin fallback ni ledger paralelo. Legacy: READ ONLY externo; SAFE CHANGE del lector/derivado sujeto a pruebas. Seguridad: helper privado sin EXECUTE para anon/authenticated/service_role; contexto conserva sus permisos públicos existentes. Migración: sin alteración de filas financieras y recuperación de definiciones. La revisión final y evidencia se agregarán al completar verificaciones.

Regresión global: aunque todos los campos previos del analizador de préstamos permanecen idénticos y los cambios de bundle/SW son generados, el analizador también alimenta la lectura de comportamiento de Finanzas. Por la regla de helpers compartidos se ejecutará `scripts/test-global-image-regression-production-live.js` contra el artefacto local y GitHub Pages, con el hash final exacto. El helper SQL nuevo es exclusivo de SICOF; no se modificó `savings_workspace_history` compartido.

## Implementación verificada

1. `sicof_private.evidence_history` conserva las filas e importes de la historia compartida. Sólo completa expected cuando un único plan cubre exactamente la fecha, pertenece a la inscripción certificada, ambos son canónicos y coinciden proceso, calendario, inicio/baja y corte. Historia mixta, conflicto, falta de monto o plan ambiguo permanecen pendientes. La procedencia indica SOURCE_HISTORY, CANONICAL_PLAN_AT_DATE o UNRESOLVED; nunca se cambia el histórico recibido.
2. El analizador agrega prueba de estado/adeudo actual independiente del desglose de interés. Exige identidad/fondo exactos, agregados uniformes no negativos, estado coherente con atraso y ausencia de duplicados ambiguos. Todos los campos previos de pagos, comportamiento, cartera y conciliación permanecen idénticos, comparados contra el analizador anterior congelado como fixture de código sin datos.
3. Motor V3 consume esa prueba sólo del día observado; ausencia o expiración conserva el control estricto. Mantiene las reglas de retención y exclusión por atraso. No altera intereses o capital. Expone basisPending y conteos de motivos solapados; las cuentas incompletas siguen sin rendimiento individual.
4. UI mantiene 12 tarjetas y 8 tabs, parámetros, exportaciones, escenarios y diseño. Tasa, tasa proyectada, base y suma de rendimientos dicen Pendiente sólo cuando base cero coincide con revisión; un cero comprobado sigue numérico. Explica subtotal de hoja, cuotas futuras y reserva del escenario, y agrega disclosure de motivos.

## Evidencia

- SQL aislado: seis grupos PASS, incluyendo planes exactos versus actuales, ambigüedad, fechas, datos mixtos, permisos privados, drift y recovery exacto de definición/OID/ACL.
- Motor focal: nueve grupos PASS; se conservan íntegros los campos anteriores del analizador, importes, hold y exclusiones; nuevas pruebas pendientes, prueba vieja y ruta preparada.
- Suites previas PASS: motor, préstamos, proyección de préstamos, simulación (17 casos), handler de simulación, Edge, exportación A:O y exportaciones formuladas/históricas.
- La suite de exportaciones inicialmente no encontró la ruta externa original. Se habilitó variable de ruta, usando los bytes auténticos de la copia privada existente, SHA-256 `e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837`. Resultado completo PASS, 214 registros históricos intactos. No se agregó el Excel al paquete.
- UI focal PASS: 12 KPI, 8 tabs, cero conocido/pending, disclosure, 1440/430/320 sin overflow. Suite completa de UI previa PASS con controles, navegación, modalidades, descargas, errores, vigencia y autenticación conservados.
- Build Pages real PASS: 31 archivos públicos. Candidato sobre v322 conserva exactamente 150 chunks ajenos. SHA-256 de bundle: `813c606d88591df084b18cb95a93982b0bc6e408b015641cc3f0efe9796d3226`.
- Migración `20261004000100` aplicada: 13 tablas financieras y de evidencia con conteos/huellas idénticos antes/después; no se cambió ninguna fila de negocio. Recovery probado localmente antes de instalar.
- Edge v14 respaldado privado (ESZIP/hash); candidato compilado sin activar y luego Edge v15 ACTIVE con JWT conservado. Hashes de fuentes sellados entre compilación y activación.
- Contexto real instalado: 1,298 filas con expected UNRESOLVED y 585 SOURCE_HISTORY. No hay evidencia para rellenar retrospectivamente las primeras.
- Comparación real julio–30 octubre: motivos de préstamos 272 → 16 cuentas; 354 permanecen en revisión por los motivos históricos solapados. Collected=148426, projected=3175.53, pool=120225.06, reserve=28200.94, projectedNetPool=122797.24 idénticos. Tasa null; no se promete una tasa resuelta.
- Navegador real del candidato PASS: login existente, descarga Google original y carga del mismo archivo, FILE_WORKSPACE HTTP 200 con motor V3, 12 KPI/8 tabs, motivos y recálculo en worker. Sin fixture financiero, sin screenshots de PII, sin escritores de negocio. La primera captura CDP perdió el payload grande; se corrigió la observación de fetch en memoria, sin cambiar respuestas.

Evidencia agregada: `docs/qa/evidence/sicof-evidence-integration/`. Backups, Excel real y artefactos privados: `.tmp/sicof-evidence-integration/`, fuera del paquete público.

- Regresión global local PASS: assets, fotos, documentos, PDF legítimo, visor, recarga y comparación con/sin SW. Hash exacto verificado, 0 errores de navegador y 0 mutaciones de negocio. Evidencia: global-local.json.

## Revisión arquitectónica previa a publicación web

Verdict: APPROVED para el cambio focal verificado; no equivale a tasa resuelta. Fuente de verdad y fórmulas conservadas. Helper privado, sin permisos nuevos para clientes; la historia compartida de Ahorro no cambia. No hay cambio de política ni decisión pendiente del propietario para esta integración. No se afirma revisión por otro agente: se contrastó el delta, pruebas, lectura instalada y artefacto, sin delegación.

RESPONSE TO CODEX: Completa las verificaciones globales y de la publicación exacta. Mantén explícita la falta de historia autoritativa: no desactives verificaciones, no acredites rendimientos y no inicies una conciliación ni otro tipo de tasa. WORK_QUEUE no autoriza una nueva fase; la autorización de esta H proviene de la instrucción directa del propietario.

## H-SICOF-EVIDENCE-INTEGRATION-001 RESULT

Status: backend y candidato verificados; publicación web/verificación global en curso. Determinación de tasa BLOCKED por historia faltante.
Files changed: delta focal declarado; árbol de publicación aislado y artefactos generados.
Source-of-truth verdict: SAFE; una autoridad por dominio, evidencia faltante explícita.
Invariant verdict: PASS de conservación financiera y reglas.
Build: PASS, artefacto Pages de 31 archivos; 150 chunks ajenos idénticos.
Tests: suites focales y UI real candidata PASS; global pendiente de cierre.
Security: permisos privados y drift/recovery verificados; JWT conservado; sin secretos ni PII en artefactos públicos.
Legacy impact: lectura; cero escrituras Google y cero movimientos financieros.
Unexpected files changed: ninguno incluido en el paquete focal; modificaciones previas del workspace preservadas.
Known limitations: 328 cuentas sin importe histórico esperado, 297 sin saldo diario demostrable; otros motivos solapados, incluyendo 16 estados/adeudos de préstamo aún pendientes. Las 354 cuentas siguen en revisión.
Evidence: archivos agregados, scripts reproducibles y auditoría anterior H-SICOF-KPI-AUDIT-001.

## Vigencia posterior — publicación completada 2026-10-04

El propietario autorizó explícitamente publicar y hacer commit/push. La activación y verificación quedaron completadas en H-SICOF-SAVINGS-AUTHORITY-RELEASE-001: main b408415, Edge16/V4, 12 KPI verificados y regresión global local/producción PASS. Los estados pendientes de publicación anteriores describen el momento de este informe; quedan cerrados por la evidencia posterior. Las tasas parciales siguen identificadas como provisionales, sin cambiar datos ni inventar fechas. Véase [cierre productivo](H-SICOF-SAVINGS-AUTHORITY-RELEASE-001.md).
