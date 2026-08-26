# Phase 7 — resolución de bloqueos del Approved Loan Export

Fecha de auditoría: 2026-08-22  
Estado: `PARTIAL — WRITER DISABLED`

## Frontera preservada

- El alta del usuario continúa escribiendo únicamente `public.program_requests`.
- La aprobación administrativa es el único evento futuro autorizado para iniciar el export.
- `SutiApp Final` permaneció completamente `READ ONLY` durante esta H.
- No se implementó ni activó append, `LockService`, Apps Script, amortización, estados posteriores, pagos, saldos o conciliación.

## Contratos demostrados

### D — Proceso

La hoja live `Categoría de empleados!A1:E7` declara la relación directa:

| Categoría | Proceso |
|---|---:|
| Suplentes Variables | `3` |
| Suplentes Fijos | `1` |
| Eventuales | `1` |
| Base | `1` |
| Jubilados y Pens. | `JUB` |
| Confianza | `Confianza` |

Las primeras cinco relaciones coinciden con el historial. `Confianza` no: el único registro histórico con esa categoría usa `1`, mientras el catálogo declara `Confianza`. El campo queda `OWNER_DECISION_REQUIRED` exclusivamente para esa categoría; no se normaliza por frecuencia.

### M — Afiliado / no afiliado

`Sindicatos!A1:D6` demuestra la regla de negocio y el historial demuestra su representación en el destino:

- `SUTISSSTESON` → `AFILIADO`;
- `SUEISSSTESON`, `SITISSSTESON` y `EMPLEADOS DE CONFIANZA` → `NO AFILIADO`.

La semántica de M queda `RESOLVED` cuando L existe. No autoriza inventar L: la elección de sindicato por afiliado no está materializada en `public.affiliates` ni en `program_requests`.

### Plazo y “6 meses”

`Criterios de fondos` expresa `1 Qnas`, `12 Qnas`, `13 Qnas`, `24 Qnas` y `6 meses`. Para `6 meses`, la semántica demostrada requiere dos magnitudes distintas:

- duración del producto: `6`, periodo `meses`;
- `FinancialSimulationResult.paymentCount`: `12`, periodo `quincenal`.

Los doce son pagos, no meses. Para los valores `n Qnas`, `paymentCount=n` y el periodo es quincenal. El significado de `6 meses` queda resuelto, pero el encoding exacto del nuevo G permanece `PARTIAL`: el historial de jubilados contiene tanto G=`6` como G=`12` y no existe una regla declarativa que indique si el destino nuevo guarda duración o número de pagos. `program_requests` tampoco persiste valor, periodo y número de pagos por separado.

### Autoridad financiera

Google legacy sigue siendo la única autoridad para monto, tasa, total, fondo, máximo y elegibilidad. El contrato `FinancialSimulationResult` exige explícitamente `amount`, `paymentCount`, `paymentPeriod`, `rate`, `ratePeriod`, `interest`, gastos administrativos, `total`, pago por periodo, fondo, programa, máximos y elegibilidad.

La auditoría de 2,229 filas numéricas demostró:

- el encabezado legacy define `Interes Quincenal`;
- 874 filas conservan simultáneamente `interés = monto × tasa`, `intereses = interés × plazo` y `capital + interés = monto + intereses`;
- 534 filas conservan exactamente `total = monto + monto × tasa × pagos + 15 × pagos`;
- ADR-042 confirma `$15` por pago para solicitudes nuevas.

Esto demuestra la semántica, no convierte a SutiApp en calculadora. El productor Google de `FinancialSimulationResult` no está configurado/demostrado end-to-end y `program_requests` solo conserva `quoted_amount`; no persiste el resultado completo aprobado. Veredicto: `PARTIAL`.

## Bloqueos que no pueden cerrarse por inferencia

### Y — estado inicial

Los últimos 200 registros contienen 150 `Iniciado`, 49 `Rechazado` y 1 `Pendiente`. Es evidencia de ciclo de vida, no una regla declarativa de alta. Se requiere confirmar el valor inicial; hasta entonces Y queda `OWNER_DECISION_REQUIRED`.

### O:W — documentos

La combinación dominante demuestra el modelo operativo candidato:

- O:S: rostro, INE frente/reverso y dos talones;
- T:W: aval y sus documentos, usados principalmente por Proceso `3`.

Sin embargo, el historial contiene faltantes, estados posteriores y excepciones; no existe una matriz declarativa autoritativa disponible que convierta presencia histórica en obligatoriedad. Resultado: `PARTIAL`. Tampoco `program_requests` conserva referencias Storage para O:W.

## Auditoría de `public.affiliates`

Consulta administrativa de solo lectura, sin PII en evidencia:

| Evidencia | Resultado |
|---|---:|
| filas | 947 |
| ordinales | 1–947 |
| hash fuente | `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591` |
| `numero_control` presente | 938 |
| `affiliation_raw` presente / vacío | 692 / 255 |
| `employment_level_raw` presente / vacío | 358 / 589 |
| `union_position_raw` presente / vacío | 411 / 536 |

`affiliation_raw` es el número raw de `AFILIACION`; no equivale a `AFILIADO/NO AFILIADO`. `employment_level_raw` es `NIVEL` y `union_position_raw` es `PUESTO SUTI`; ninguno equivale a `CHOICE Categoría de Empleado` o `CHOICE SINDICATO`. Las columnas históricas 57–60 están clasificadas como calculadas y no fueron importadas como maestros.

Consecuencia: categoría financiera Supabase `FAIL`, sindicato financiero Supabase `FAIL`, afiliación financiera `PARTIAL`. No se preparó ni aplicó migración porque no existe una copia 1:1 demostrable; derivarla habría creado una segunda autoridad.

## Cobertura del payload inicial A:AL

Contrato fuente listo hoy: B `numero_control`, C nombre, J fecha de solicitud, X términos y AF firma. A, Z:AE y AH:AL tienen conducta conocida de no llenarse en el append inicial. Son 17/38 columnas con conducta cerrada; 21/38 todavía dependen de valor no persistido, semántica no aprobada o productor no demostrado. Esta métrica no autoriza escribir una fila parcial.

Bloqueos técnicos adicionales, sin decisión de negocio: persistir el `FinancialSimulationResult` aprobado; persistir G con valor/periodo/paymentCount; persistir K/L; almacenar referencias Storage O:W; definir la semántica exacta de AG; y construir después el writer idempotente bajo lock. Ninguno fue implementado en esta H.

## Decisiones de negocio genuinamente restantes

1. Para categoría `Confianza`, elegir el valor D entre el catálogo (`Confianza`) y el único precedente del destino (`1`).
2. Confirmar el estado inicial Y, con `Iniciado` como candidato observado pero no adoptado automáticamente.
3. Aprobar o corregir la matriz candidata: O:S para todo préstamo y T:W adicional únicamente cuando D=`3`.
4. Designar una fuente maestra por afiliado para `CHOICE Categoría de Empleado` y `CHOICE SINDICATO` —por ejemplo, autorizar expresamente las columnas calculadas 58/60 del Excel fijo— antes de cualquier copia 1:1 a Supabase.

## Veredicto

`PARTIAL`. El append final no puede implementarse todavía. Google writes: `0`; `SutiApp Final` modified: `NO`; Apps Script modified: `NO`.
