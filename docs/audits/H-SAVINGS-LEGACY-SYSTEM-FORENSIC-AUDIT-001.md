# H-SAVINGS-LEGACY-SYSTEM-FORENSIC-AUDIT-001

Fecha de corte: 2026-09-01

Clasificación legacy: `READ ONLY`

Libro productivo: `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`)

Resultado: `PARTIAL_EVIDENCE`

## A. Executive summary

La autoridad operacional vigente de Ahorro continúa en el conjunto Google legacy. La auditoría live confirmó nueve pestañas interdependientes, 363 Folios únicos en `Ahorro`, 4,047 filas en `Reporte Ahorro`, 320 filas en `Reporte - RH`, 33,061 fórmulas en `Ahorro` y una matriz de proyección de 93 columnas (`AA:DO`) con tope físico en 2028-07-30.

No existe evidencia de un ledger transaccional autoritativo. `Saldo (HOY)` se calcula como proyección esperada hasta hoy + ajuste manual - retiros; no se calcula desde aportaciones confirmadas de `Reporte Ahorro` ni desde `Conciliacion`. En 21 de 363 Folios ese saldo reconstruido no coincide con la suma observada de `Reporte Ahorro` ajustada por retiros/manual. Los 18 casos `Terminado` de la muestra global quedan en cero calculado aunque conservan aportaciones en el reporte histórico.

La identidad tampoco es segura para un cutover: cinco Folios de la hoja `Ahorro` coinciden con más de una fila `public.affiliates.numero_control`, un Folio de Ahorro no tiene coincidencia y el universo de nueve hojas contiene seis Folios que caen en grupos duplicados de afiliados. No se fusionó ni corrigió ningún registro.

La regla JUB declarada por OWNER no está implementada en los datos actuales: de 14 solicitudes JUB enlazables, 13 empiezan el día 15, una el día 5 y las 14 inician antes de 30 días desde la solicitud. Además existen `JUB` y `jub`; la fórmula es sensible a mayúsculas, por lo que dos filas `jub` se procesan como no JUB.

Se recomienda como destino `MIGRATE_TRANSACTIONAL_AUTHORITY_TO_SUPABASE`, pero no iniciar schema, backfill ni cutover. Antes se deben resolver identidad, saldo autoritativo, reglas de confirmación, configuración Glide/Make, writers/triggers y equivalencia por shadow reconciliation. Google debe permanecer autoritativo hasta un corte explícito y comprobado, sin doble escritura. ADR-036 permanece vigente: esta recomendación no autoriza la migración financiera y requerirá una decisión expresa del propietario, el ADR correspondiente y una H independiente.

## B. Source of truth map

| Dominio | Autoridad observada hoy | Tipo | Lectores observados | Writers observados/demostrados | Veredicto |
|---|---|---|---|---|---|
| Alta/ingreso | `Ingreso ahorro` | transacción materializada | Glide/Google, no inspeccionable por completo | Glide/automatización `UNRESOLVED` | `PARTIAL` |
| Solicitud/periodo | `Solicitud de Ahorro` | transacción + tres fórmulas aisladas | `Ahorro`, Glide | Glide/automatización/manual `UNRESOLVED` | `PARTIAL` |
| Estado y saldo presentado | `Ahorro` | cálculo multi-source | Glide y consumidores legacy | fórmulas + valores manuales/automatizados | autoridad de saldo `UNRESOLVED` |
| Cambios de monto | `Solicitud Cambio ahorro` | transacción materializada | `Ahorro`, Glide | Glide/Admin `UNRESOLVED` | `PARTIAL` |
| Retiros | `Solicitud de retiro` | transacción materializada | `Ahorro`, Glide | Glide/Admin `UNRESOLVED` | `PARTIAL` |
| Ajuste manual | `Saldo manual` | corrección manual | `Ahorro!O` | Admin `UNRESOLVED` | sin fila utilizable actual |
| Aportaciones registradas | `Reporte Ahorro` | reporte/registro materializado | reporting; no lo consume `Saldo (HOY)` | automatización/manual `UNRESOLVED` | candidato transaccional, no autoridad confirmada |
| Reporte RH | `Reporte - RH` | export materializado | RH y `Conciliacion` | automatización/manual `UNRESOLVED` | derivado |
| Conciliación | `Conciliacion` | import + fórmula de comparación | Admin | Make/Glide indicado por OWNER, no inspeccionado | vacío al corte; `PARTIAL` |
| Identidad de afiliado | Supabase `public.affiliates.numero_control` | maestro de afiliado | backend/RLS | writers Supabase autorizados | no sustituye Folio sin resolución 1:1 |

No hay una segunda autoridad productiva creada por esta H. Copias de Drive, respaldos XLSX, datos frontend, mocks y `localStorage` no se consideran autoridad.

## C. Data lineage completo

```text
Glide / operación administrativa
  ├─> Ingreso ahorro ───────────────┐
  ├─> Solicitud de Ahorro ──────────┼─> Ahorro (fórmulas + valores materializados)
  ├─> Solicitud Cambio ahorro ──────┤       ├─> saldos G/P/Q
  ├─> Solicitud de retiro ──────────┤       └─> proyección AA:DO
  └─> Saldo manual ─────────────────┘

Reporte - RH ──> archivo/proceso RH ──> Conciliacion
                                         └─> comparación Clave+Número+Importe

Reporte Ahorro ──> aportaciones materializadas
                   (sin referencia desde las fórmulas de saldo Ahorro G/P/Q)
```

La metadata `App: Metadata` mostró un refresh automático iniciado el 2026-09-01T17:07:28.978Z, evidencia de sincronización Glide, pero no expone acciones, condiciones ni writers.

## D. Identidad / Folio

OWNER declara `Folio = número de empleado = numero_control`. La evidencia confirma que todas las columnas Folio inspeccionadas están almacenadas como números, sin ceros a la izquierda visibles y sin mezcla texto/número en esos rangos. Eso no hace el vínculo único.

| Superficie | Filas con Folio | Folios distintos | Grupos duplicados | Filas extra duplicadas | No presentes en `Ahorro` |
|---|---:|---:|---:|---:|---:|
| `Ingreso ahorro` | 393 | 389 | 4 | 4 | 38 |
| `Solicitud de Ahorro` | 341 | 338 | 3 | 3 | 11 |
| `Ahorro` | 363 | 363 | 0 | 0 | — |
| `Solicitud Cambio ahorro` | 123 | 112 | 10 | 11 | 4 |
| `Solicitud de retiro` | 228 | 220 | 7 | 8 | 0 |
| `Reporte Ahorro` | 4,047 | 317 | 311 | 3,730 | 0 |
| `Reporte - RH` | 320 | 320 | 0 | 0 | 0 |
| `Conciliacion` | 0 | 0 | 0 | 0 | 0 |

Comparación agregada read-only contra Supabase:

- `public.affiliates`: 938 filas con `numero_control`, 923 valores distintos, 13 grupos duplicados y 9 filas sin número.
- Universo Ahorro: 401 Folios distintos.
- Folios del universo sin afiliado: 1.
- Folios del universo con más de un afiliado candidato: 6.
- Folios de `Ahorro` con más de un afiliado candidato: 5.
- Folios de `Ahorro` sin afiliado: 1.

Veredicto: `SOURCE OF TRUTH CONFLICT` para cualquier join automático Folio→affiliate. Se prohíbe usar nombre, email, teléfono o posición de fila para desempatar.

## E. Hoja por hoja

| Hoja | Grid live | Contenido observado | Clave/input | Fórmulas | Consumidores/outputs |
|---|---:|---|---|---:|---|
| `Ingreso ahorro` | 397×3 | 396 filas de datos; 393 con Folio; todos los estados `Aprobado` | Folio; Proceso; Estado | 0 | Glide y flujo de ingreso, no demostrados |
| `Solicitud de Ahorro` | 343×10 | 342 filas; 341 con Folio; 323 `Ahorrando`, 19 `Terminado` | Folio + fecha solicitud | 3 | `Ahorro` toma el registro más reciente por fecha |
| `Ahorro` | 365×127 | 363 Folios + una fila sin Folio con proceso | Folio | 33,061 | saldo, retiros, plan, proyección y rendimientos |
| `Solicitud Cambio ahorro` | 127×7 | 123 filas con Folio; 117 `TRUE`; 108 PDF | Folio + fecha cambio | 0 | `Ahorro!S:T:U` |
| `Solicitud de retiro` | 229×12 | 228 filas; 195 completos, 31 parciales, 2 placeholders | Folio + fecha + categoría + monto | 0 | `Ahorro!H:N` |
| `Saldo manual` | 2×7 | una fila materializada sin Folio; estado `Agregado` | Folio esperado | 0 | `Ahorro!O` mediante `SUMIFS` |
| `Reporte Ahorro` | 4,048×4 | 4,047 movimientos, todos `Monto ahorrado` | Folio + fecha + monto | 0 | reporte; no alimenta G/P/Q |
| `Reporte - RH` | 321×7 | 320 Folios únicos | Clave + Proceso + Folio | 0 | RH y `Conciliacion` |
| `Conciliacion` | 253×9 | cero filas input al corte; una `ARRAYFORMULA` en I2 | Clave + Número + Importe | 1 | marca `Si/No`, no persiste saldo |

Hallazgos estructurales:

- `Ingreso ahorro` contiene tres filas sin Folio y `Ahorro` contiene una fila sin Folio; esta última conserva proceso y seis fórmulas con `#REF!`, ocultas por `IFERROR`.
- `Solicitud de Ahorro!H` contiene sólo dos `VLOOKUP` aislados y `J60` una `ARRAYFORMULA`; no existe un cálculo homogéneo fila a fila para H:I:J.
- Se detectaron cuatro duplicados exactos en `Ingreso ahorro` y uno en `Solicitud de Ahorro`. No existen IDs técnicos ni idempotency keys en los encabezados de estas nueve hojas.
- No se detectaron duplicados exactos de la clave de negocio observada en cambios, retiros o `Reporte Ahorro`, pero la ausencia de ID impide garantizar deduplicación ante retry/concurrencia.

## F. Scripts y triggers

El único proyecto Apps Script ligado e identificable por evidencia local/live es `SutiApp Financial Handoff` (`1cw2bLuw...`). Una lectura `projects.getContent`, sin ejecución, devolvió:

- 2 archivos: manifest y `Code`;
- 23 funciones;
- entradas `doPost` y `doGet`;
- 0 funciones simples `onEdit`/`onChange`;
- 0 funciones con nombre o contrato de Ahorro;
- código correspondiente al handoff de préstamos/visibilidad, no al sistema de Ahorro.

Los triggers instalables no son enumerables con el acceso disponible. No se encontraron proyectos Apps Script independientes mediante Drive search, pero eso no demuestra que no existan. Por tanto:

```text
Savings Apps Script functions identified: 0
Bound non-savings functions identified: 23
Simple triggers identified: 0
Installable/time triggers: UNKNOWN
Functions executed: 0
```

## G. Glide actions

Estado: `PARTIAL`.

| Acción solicitada | Evidencia observable | Límite |
|---|---|---|
| Alta/autorizar/ingresar | `Ingreso ahorro` tiene Folio, Proceso y `Aprobado`; no hay timestamp ni campo de ventana | no se pudo demostrar quién aprueba ni la ventana de 30 minutos |
| Solicitud | campos materializados en `Solicitud de Ahorro` | acción/validación Glide no accesible |
| Saldo/historial | `Ahorro` y `Reporte Ahorro` | no se demostró qué campo muestra cada pantalla |
| Cambio | 123 solicitudes y 108 PDFs Glide | botón Admin, habilitación y plantilla no accesibles |
| Retiro | 228 solicitudes y 228 referencias PDF Glide | acción y prevención de doble click no accesibles |
| Conciliación | hoja preparada y declaración OWNER de upload | configuración Glide/Make no accesible |
| Reportes | hojas materializadas | acciones de generación/descarga no accesibles |

Drive contiene dos paquetes tutoriales Camtasia (`Retirar ahorro` y `Activar ahorro y seguir ahorrando`), pero faltan los MP4/XML referenciados en el índice accesible. No se usaron como demostración del flujo actual.

## H. Make / external automations

Estado: `EXTERNAL_AUTOMATION_NOT_FULLY_AUDITED`.

- OWNER indica Glide upload → Make → `Conciliacion`; no hubo acceso read-only a la configuración del escenario, payload, retry ni deduplicación.
- Drive demuestra una automatización de respaldo: 30 XLSX `Sutifinanzas_Respaldo_*` entre 2026-08-26 y 2026-09-01, con ejecuciones 00:36, 00:39, 06:36, 12:36 y 18:36. No se demostró qué herramienta los produce ni que constituyan recovery transaccional.
- `App: Metadata` demuestra refresh Glide automático, pero no su writer.

External automations count: `1 observed backup cadence + Glide refresh observed + Make reconciliation UNKNOWN`.

## I. Saldo reconstruction

Campos y ecuaciones live:

```text
G Ahorrado al día de hoy
  = si W="Ahorrando", SUM(proyección AA:GV entre X y TODAY), si no 0

H Retiros parciales
  = SUM(Solicitud de retiro.G donde Folio, Parcial y fecha>=X), sólo si W="Ahorrando"

I Retiro completo + NO continúa
  = SUM(retiros completos NO), sólo si W="Ahorrando"

J Retiro completo + SÍ continúa
  = SUM(retiros completos SI), sólo si W="Ahorrando"

O SALDO AL DIA DE HOY MANUAL
  = SUMIFS(Saldo manual.Total, Folio, Estado="Agregado")

P SALDO DIA DE HOY CON RETIROS
  = G - H - I - J

Q Saldo (HOY)
  = G + O - H - I - J
```

Clasificación:

| Campo | Naturaleza | ¿Incluye retiros? | ¿Usa aportación confirmada? | Autoridad demostrada |
|---|---|---:|---:|---|
| G | proyección esperada acumulada | No | No | No |
| O | corrección manual | indirectamente, según carga manual desconocida | No | No; sin Folio utilizable actual |
| P | cálculo G menos retiros | Sí | No | No |
| Q | cálculo G+O menos retiros | Sí | No | `UNRESOLVED` |
| `Reporte Ahorro` | movimientos materializados | no se deduce de su esquema | candidato | no confirmado |

Reconciliación agregada sin PII:

- Ecuación P: 363/363 consistente.
- Ecuación Q: 363/363 consistente.
- Folios con movimientos en `Reporte Ahorro`: 317; sin movimientos: 46.
- G coincide con suma de `Reporte Ahorro`: 342/363.
- Q coincide con `Reporte Ahorro + O - retiros`: 342/363.
- Diferencias: 21/363.

Muestra enmascarada:

| Caso | P/Q algebra | Reporte vs proyección/saldo | Resultado |
|---|---|---|---|
| JUB activo | PASS | diferencia | `RISK` |
| no JUB activo sin retiros | PASS | coincide | `PASS_SAMPLE` |
| activo con retiro parcial | PASS | coincide | `PASS_SAMPLE` |
| terminado | PASS algebraica | reporte conserva aportes; saldo calculado queda 0 | `RISK` |
| cambio de monto | PASS algebraica | muestra coincide, pero fórmula ignora vigencia | `RISK` |
| saldo manual | no existe caso con O distinto de cero | no ejecutable | `PARTIAL` |
| conciliación | hoja sin filas input al corte | no ejecutable | `PARTIAL` |

Conclusión: el saldo vigente autoritativo no puede certificarse desde la evidencia actual.

## J. Projection engine legacy

`AA:DO` contiene 93 fechas: 5, 15 y 30 de cada mes, con 28 para febrero, desde 2026-01-05 hasta 2028-07-30.

```text
por celda:
si fecha_columna está entre F (primer descuento) y Z (fecha final):
  si D == "JUB": monto S sólo si día == 5
  si no: monto S si día == 15, día == 30 o febrero día == 28
si no: 0
```

Cobertura:

- 26,625 celdas fórmula en AA:DO.
- 6,557 celdas numéricas materializadas; 3,116 son no cero.
- 670 celdas vacías.
- AA:AP no contiene fórmulas; son 5,695 valores materializados y 129 vacíos.
- AQ:DO mezcla 26,625 fórmulas, 862 valores materializados y 541 vacíos.
- Desde AZ:DO la cobertura es 357 fórmulas por columna; AQ:AY conserva mezclas/overrides y AT no contiene fórmulas.
- La fórmula de G y el conteo E referencian AA:GV/AA:XI, rangos más amplios que el grid visible actual; no existe calendario visible después de DO.

La matriz no referencia retiros, estado ni fecha efectiva del cambio. El saldo G sí apaga todo cuando W deja de ser `Ahorrando`.

## K. Withdrawals

| Tipo | Filas | Continúa SI | Continúa NO | Efecto observado |
|---|---:|---:|---:|---|
| Parcial | 31 | según fila | según fila | se suma en H y se resta de P/Q |
| Completo | 195 | mayoría | 18 totales NO en la hoja | se suma en I o J mientras W=`Ahorrando` |
| Placeholder `-` | 2 | — | — | semántica no declarada |

Las 228 filas están `Completado` y poseen PDF. No existe ID técnico ni idempotency key. Los cálculos H/I/J suman todas las coincidencias por Folio posteriores al inicio; un retry duplicado sería financieramente acumulativo. No se detectaron duplicados exactos actuales, pero la protección no está demostrada.

Para un retiro total que termina Ahorro, W=`Terminado` hace G=0 y también impide calcular I/J; Q queda cero por estado, no por reconstrucción de aportes/retiro. La historia sobrevive en las hojas fuente, pero no en el saldo calculado.

## L. Change amount

`Ahorro!S` toma el cambio más reciente sólo cuando U=`TRUE`; T y U también toman el cambio más reciente por fecha. La proyección usa S en todas las fechas entre F y Z y no evalúa T.

- Cambios realizados: 107.
- Con monto realmente distinto: 88.
- Fecha de cambio posterior al primer descuento: 95.
- Casos con monto distinto y riesgo de reescritura retroactiva: 87.
- Grupos de Folio con varias solicitudes de cambio: 10; uno alcanza tres filas.

La hoja fuente conserva historia, pero el resultado calculado no segmenta por vigencia. `Ahorro!S` sustituye el monto completo de la proyección.

## M. Reconciliation

La fórmula live de `Conciliacion!I2` compara:

```text
Conciliacion.(Clave + Número + Importe)
contra
Reporte - RH.(Clave + Folio + Monto)
```

Si encuentra coincidencia exacta marca `Si`; si no, `No`. Por tanto:

- `Número` funciona como componente Folio, pero la identidad efectiva de la comparación es compuesta, no Folio solo.
- No hay filas de conciliación al corte.
- La fórmula prueba si una fila importada aparece en el reporte esperado; no demuestra una comparación inversa que enumere a todos los esperados no descontados.
- No hay evidencia de que el resultado escriba `Reporte Ahorro` o modifique G/P/Q.
- Retry, duplicate protection, archivo origen, parsing y Make permanecen `UNKNOWN`.

Reconciliation identity key: `Clave + Número/Folio + Importe`.
Duplicate protection: `UNKNOWN / RISK`.

## N. Reports

### Reporte Ahorro

- 4,047 filas, 317 Folios, hasta 16 movimientos por Folio.
- Columnas: Folio, Fecha, Monto, Estatus.
- Todos los estados actuales: `Monto ahorrado`.
- Cero fórmulas y cero IDs técnicos.
- Consumidor financiero de saldo no demostrado.

### Reporte - RH

- 320 filas y Folios únicos; todos existen en `Ahorro`.
- Labels: 281 `proceso 1`, 39 `proceso 3`.
- Monto coincide con S en 317/320 y con R en 232/320.
- Incluye dos filas cuyo proceso en `Ahorro` es `jub` minúscula; la etiqueta RH no conserva JUB.
- Inicio/Final están materializados como enteros opacos (ejemplos de patrón `YYYYPPP` y sentinel); no son seriales de fecha Google equivalentes a X/Z. Su semántica requiere writer/configuración.
- Diez ahorradores activos no aparecen: nueve JUB y uno proceso 1.

No puede certificarse todavía que ambos reportes se reproduzcan desde Supabase con idéntico resultado.

## O. Risks P0–P3

### P0

1. **Identidad ambigua:** cinco Folios `Ahorro` coinciden con múltiples afiliados; uno no coincide con ninguno. Impacto: saldo/movimiento asociado a otra persona.
2. **Saldo sin ledger confirmado:** Q usa proyección, no aportaciones confirmadas; 21 casos difieren del reporte materializado. Impacto: saldo mostrado incorrecto.
3. **Calendario JUB incompatible:** 14/14 inician antes de 30 días, 13/14 el día 15; `jub` minúscula cae en rama quincenal. Impacto: número/fecha de descuentos y saldo esperados incorrectos.
4. **Cambio retroactivo:** 87 filas con monto distinto pueden aplicar S antes de T. Impacto: reescritura del ahorro esperado/histórico calculado.

### P1

1. Sin IDs/idempotencia en altas, solicitudes, retiros o reportes; existen duplicados exactos en ingreso/solicitud.
2. Conciliación es unidireccional, vacía al corte y sin evidencia de aplicación al saldo.
3. AA:DO mezcla fórmulas y 3,116 valores manuales no cero sin provenance por celda.
4. 336 referencias PDF únicas están en rutas `storage.googleapis.com/glide-prod.appspot.com/.../pub`; los nombres de archivo contienen PII. Requieren inventario privado y evacuación separada, no modificación en esta H.
5. Writers, triggers instalables, configuración Glide y escenario Make no están disponibles; no puede demostrarse prevención de doble escritura.
6. 30 respaldos XLSX en seis días multiplican PII financiera; owner, retención, cifrado y restore no están demostrados.

### P2

1. Proyección con fecha tope 2028-07-30 y referencias ocultas hasta GV/XI.
2. 33,061 fórmulas con cobertura irregular; seis `#REF!` suprimidos en una fila sin Folio.
3. Reportes materializados sin fórmula, lineage técnico o esquema de versión.
4. Paquetes tutoriales incompletos y acciones Glide no auditables desde la evidencia disponible.

### P3

1. Labels `Quincenal` se usan también para JUB.
2. Valores `JUB`, `jub` y `xxxx` conviven sin validación declarada.
3. Inicio/Final de RH usan códigos opacos bajo nombres de fecha.

## P. Sheets vs Supabase decision matrix

| Criterio | Mantener Sheets como autoridad | Migrar autoridad transaccional a Supabase |
|---|---|---|
| Integridad/FK | débil; joins por Folio y fórmulas | fuerte después de resolver identidad y FKs |
| Concurrencia | edición de celdas/automatizaciones no transaccional | transacciones, locks e idempotencia backend |
| Auditoría | historial de archivo/celdas, writer no atribuido | ledger append-only + actor/tiempo/origen |
| RLS/seguridad | acceso amplio y PDFs Glide `pub` | RLS por afiliado/rol, Storage privado |
| Historial | filas fuente conservadas, cálculo reinterpreta pasado | eventos inmutables y planes por vigencia |
| Ledger | no existe demostrado | entidad transaccional explícita |
| Proyección | 93 columnas, tope 2028 | generación dinámica sin límite físico |
| Idempotencia | no demostrada | claves por operación/import/retry |
| Conciliación | fórmula unidireccional y Make desconocido | batch + líneas + estados + hash + excepciones |
| Reporting | materializado/opaco | views/export versionado tras paridad |
| Rollback | copias frecuentes, restore no probado | migraciones + backups + cutover reversible |
| Dependencia Glide | alta | reducible después de equivalencia |
| Mantenibilidad | 33k fórmulas y overrides | reglas versionadas/testeables |
| Riesgo inmediato | menor si no se cambia nada | alto si se intenta antes de resolver blockers |
| Destino sostenible | no recomendado | recomendado después de prerequisitos |

Decisión técnica: `MIGRATE_TRANSACTIONAL_AUTHORITY_TO_SUPABASE` como destino, con Google vigente hasta cutover certificado. No se recomienda dual-write productivo.

## Q. Recommended target architecture

Propuesta conceptual, no implementada:

```text
affiliates (authority existing)
  └─ savings_accounts
       ├─ savings_enrollments
       │    └─ savings_contribution_plans
       │          └─ savings_plan_changes (effective_at, old/new snapshot)
       ├─ savings_transactions (append-only ledger)
       ├─ savings_withdrawals (idempotency + lifecycle)
       └─ savings_reconciliations
             ├─ reconciliation_imports (file hash, period, source)
             └─ reconciliation_lines (matched/unmatched/exception)

views/report exports
  ├─ current balance = posted credits - posted debits
  ├─ expected schedule (derived, never ledger)
  ├─ Reporte Ahorro equivalent
  └─ Reporte RH equivalent
```

Principios mínimos:

- `affiliate_id` como FK técnica y snapshot inmutable de `numero_control`; ningún join por email/nombre.
- Ledger append-only; correcciones como movimiento inverso/ajuste auditado, nunca UPDATE destructivo.
- `client_action_id`/hash de import/clave de negocio para idempotencia.
- Separar `EXPECTED` de `POSTED`; una proyección nunca suma como aportación confirmada.
- Planes segmentados por `effective_at`; cambios no reescriben periodos previos.
- Retiros con estado y transacción única enlazada.
- Conciliación bidireccional: esperado sin descuento, descuento sin esperado, mismatch de importe e identidad ambigua.
- PDFs/documentos en Storage privado con relación, hash, clasificación y política; URL Glide sólo provenance.
- RLS y funciones backend; ningún cálculo o writer financiero en browser.

## R. Migration prerequisites

1. Resolver los cinco Folios ambiguos, el Folio huérfano y los grupos duplicados del universo sin fusión automática.
2. Declarar cuál evidencia confirma una aportación y cuál campo es saldo autoritativo.
3. Export read-only de configuración Glide: acciones, condiciones, roles, computed columns y writers.
4. Export read-only de Make: escenario, payload, mapping, retries y deduplicación.
5. Inventario completo de Apps Script standalone e installable/time triggers.
6. Contrato exacto JUB y procesos 1/3, incluidos primer descuento, fin de mes, plazo y terminación.
7. Contrato de cambio efectivo, retiro total/parcial y continuidad.
8. Snapshot cifrado/hash del workbook y anexos; catálogo de backups y prueba de restore sin producción.
9. Shadow import/reconciliation por Folio resuelto, con diferencias cero o decisiones firmadas.
10. Cutover de writer único, rollback y ventana operacional autorizada.

Safe to implement migration now: `NO`.

## S. Open owner decisions

1. Resolver identidad para los cinco Folios ambiguos y uno huérfano.
2. Elegir autoridad del saldo actual: `Reporte Ahorro`/ledger real, Q, conciliación u otra fuente aún no expuesta.
3. Confirmar si una fila de `Reporte Ahorro` es descuento confirmado y quién la escribe.
4. Resolver las 14 solicitudes JUB incompatibles y el valor minúsculo `jub` sin alterar historia.
5. Definir semántica exacta de plazo 120 en JUB y no JUB.
6. Definir fecha efectiva de cambio y tratamiento de periodos anteriores.
7. Definir cierre de retiro total, Fecha de finalización y saldo final reconstruible.
8. Proporcionar acceso/export read-only de Glide, Make y scripts/triggers faltantes.
9. Definir retención/propietario/recovery de respaldos XLSX y PDFs Glide con PII.
10. Mantener Rendimientos fuera de alcance hasta Phase 2.

## T. Phase 2 Rendimientos boundary

Se mapearon únicamente las columnas `DP:DW`:

- `AHORRO 2025`;
- `RENDIMIENTO 2025`;
- `SUBTOTAL 2025 Y ANTERIORES`;
- `2026 AHORRO 30 EN A 30 JUN`;
- `2026 RENDIMIENTO`;
- `2026 SUBTOTAL`;
- `2025 + 2026 AHORRO`;
- `2025 + 2026 RENDIMIENTO`.

No contienen fórmulas en las filas inspeccionadas y no se modelaron ni validaron. Estado: `PHASE 2 — RETURNS/YIELD`.

## Projection unlimited — evaluación conceptual

La sustitución futura de AA:DO debe generar eventos esperados dinámicos, no columnas:

- JUB: primer día 5 `>= fecha_autorización + 30 días`; luego un evento mensual; N pagos = N meses.
- Otros: primera fecha válida `>= fecha_autorización + 30 días`; días 15 y cierre contractual de mes; N pagos = N descuentos.
- Cada cambio crea otro segmento desde `effective_at`.
- Terminación corta sólo eventos futuros; no borra eventos posted.
- La proyección se deriva on demand o se materializa con versión/invalidación; nunca decide el saldo posted.

Esta propuesta no replica la fórmula actual hasta que OWNER resuelva las diferencias demostradas.

## Resultado obligatorio

```text
SAVINGS LEGACY FORENSIC AUDIT RESULT

Google workbook:
SutiApp Final

Sheets audited:
9 core + App: Metadata/supporting Drive evidence

Savings users:
363 unique Folios in Ahorro / 401 unique across audited savings surfaces

Canonical identity:
Folio = numero_control (OWNER rule); exact 1:1 resolution NOT satisfied

Duplicate Folios:
0 in Ahorro; duplicates exist in intake/history; 5 Ahorro Folios match duplicate affiliate rows

Orphan Folios:
1 savings Folio without public.affiliates match

Ingreso ahorro:
PARTIAL

Solicitud de Ahorro:
MAPPED

Ahorro:
MAPPED

Solicitud Cambio ahorro:
MAPPED

Solicitud retiro:
MAPPED

Conciliación:
PARTIAL

Reporte Ahorro:
MAPPED

Reporte RH:
MAPPED

Apps Script functions:
23 identified in the bound handoff project / 0 savings functions identified / other projects unknown

Triggers:
0 simple triggers identified / installable and time triggers UNKNOWN

External automations:
1 backup cadence observed + Glide refresh observed / Make scenario unknown

Balance authorities found:
G Ahorrado al día de hoy; O manual; P con retiros; Q Saldo (HOY); Reporte Ahorro

Authoritative current balance:
UNRESOLVED

Projection AA:DO:
MAPPED_WITH_MIXED_MANUAL_OVERRIDES

JUB schedule:
formula branch is case-sensitive D="JUB", pays day 5, end uses X + V*30 then day 5; live requests contradict OWNER rule

Other schedule:
days 15 and 30, February 28; end derives from X - 15 + V*15

Partial withdrawal:
MAPPED

Full withdrawal:
MAPPED_WITH_RECONSTRUCTION_RISK

Continue-saving-after-withdrawal:
MAPPED

Amount change:
MAPPED_WITH_RETROACTIVE_RISK

PDF generation:
PARTIAL — 336 Glide PDF references observed; generator/template not audited

Reconciliation identity key:
Clave + Número/Folio + Importe

Reconciliation duplicate protection:
UNKNOWN / RISK

P0 risks:
4

P1 risks:
6

Rows/data modified:
0

Google writes:
0

Supabase writes:
0

Scripts executed with writes:
0

Recommendation:
MIGRATE_TRANSACTIONAL_AUTHORITY_TO_SUPABASE

Reason:
identity ambiguity, no confirmed ledger, projected balance, schedule divergence, retroactive plan logic and incomplete reconciliation

Safe to implement migration:
NO

Blocking owner decisions:
identity; authoritative balance/contribution; JUB/term rules; effective changes; withdrawal close; Glide/Make/trigger inventory; backup/document governance

Rendimientos:
DEFERRED_TO_PHASE_2

Final verdict:
PARTIAL_EVIDENCE
```

## Safety and evidence ledger

```text
Google metadata/range/cell reads: READ ONLY
Drive search/folder/file text reads: READ ONLY
Apps Script projects.getContent: READ ONLY
Supabase query: SELECT numero_control only
Google writes: 0
Supabase writes: 0
Glide writes: 0
Make writes: 0
Triggers invoked: 0
Conciliations executed: 0
Financial rows modified: 0
WRITE_TEST_DEFERRED: all mutation-dependent E2E
```

Evidencia reproducible: metadata y rangos live del workbook; fórmulas live `Ahorro`, `Solicitud de Ahorro` y `Conciliacion`; lectura agregada `public.affiliates.numero_control`; Apps Script `projects.getContent`; Drive metadata de respaldos/tutoriales/PDF; `docs/SOURCE_OF_TRUTH.md`, `docs/INVARIANTS.md`, `docs/LEGACY_GOOGLE_SYSTEMS.md` y `docs/DATA_GOVERNANCE.md`.
