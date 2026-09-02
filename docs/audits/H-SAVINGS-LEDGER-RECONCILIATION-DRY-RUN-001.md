# H-SAVINGS-LEDGER-RECONCILIATION-DRY-RUN-001

Fecha: 2026-09-02
Estado: `PASS`
Modo: `READ ONLY / DRY RUN`

## AUDIT / AUTHORITY

La autorización se limitó a reconstruir un ledger candidato sobre la evidencia SHADOW ya importada en Supabase, sin consultar Google salvo inconsistencia demostrada y sin escribir en ningún sistema. No apareció una inconsistencia que exigiera volver al workbook.

- Batch fuente: `9b20b0cc-456b-4ad7-8058-c8ebe551dc31`.
- Manifest certificado: `3552A321C0864460A9B202AB0783750166935078C604BFF88DD90B9D9D9275B1`.
- Doble captura SHADOW estable: `E378B0F41C0D4C20D2EF88E5A69B94A4A5291B97461A66716DCA8C3981335C49`.
- Resultado de reconciliación: `1B6A3F3D2BC9F31CDDB18C5EF9CC662D8E357BCCBCD6E82778F51828B3F14BE0`.
- Autoridad antes/después: Google Sheets + Apps Script continúa como sistema legacy productivo; Supabase permanece `SHADOW_ONLY`.
- Lectores: capturador backend local mediante HTTP `GET`; reconciliador local sobre archivos privados.
- Escritores: ninguno. Las 17 tablas `savings_*` conservaron exactamente sus conteos antes/después.
- Los Folios y detalles financieros de los 20 desajustes se guardaron solamente en `tmp/savings-ledger-reconciliation-20260902/reconciliation.json`, ignorado por Git. La evidencia versionada publica sólo conteos y hashes.

## PLAN / RISK

1. Capturar dos veces el batch exacto, validar hash/estado y medir las 17 tablas antes/después.
2. Reconstruir por `legacy_folio` identidad, fecha inicial, PROCESS, AA:DO, retiros, cambios de monto, DP:DW, reportes y Q.
3. Separar evidencia programada, contraste y ledger canónico; no interpretar Reporte Ahorro como autoridad automática.
4. Reproducir los 20 desajustes actuales y conservar sus detalles sólo en evidencia privada.
5. Probar determinismo, cero escrituras, cero transacciones, cero créditos y ausencia de cutover.

Riesgos y controles:

- AA:DO expresa programación histórica esperada. Sólo una coincidencia exacta Folio/fecha/monto con Reporte Ahorro genera `CONTRIBUTION_CANDIDATE`, todavía `MEDIUM` y no materializable.
- Reporte Ahorro se usa para contraste y para reproducir la aritmética histórica frente a Q; no se promueve a ledger.
- La nueva regla expected/actual no se aplicó retroactivamente: el valor legacy observado se conservó sin reescritura.
- DP:DW sólo genera candidato cuando el periodo es explícito, el rendimiento es no cero y `capital + rendimiento = subtotal` dentro de un centavo. El acumulado se excluye para evitar doble conteo.
- El campo manual O no está individualizado en la evidencia SHADOW y `Saldo manual` no contiene un registro atribuible; se registra `MISSING_UNATTRIBUTABLE` y no se inventa valor. El cero usado en el contraste no se certifica como dato maestro.
- Identidad y conciliación financiera permanecen ortogonales: `AMBIGUOUS/ORPHAN` no se auto-resuelven aunque la aritmética coincida.

## IMPLEMENT / RESULTADOS

Población:

| Concepto | Resultado |
|---|---:|
| Folios evaluados | 363 |
| INVALID_TEST excluidos financieramente | 1 |
| Identidad RESOLVED / AMBIGUOUS / ORPHAN | 356 / 5 / 2 |
| PROCESS JUB / PROCESS_1 / PROCESS_3 | 13 / 287 / 51 |
| PROCESS CONFLICT / INVALID / UNKNOWN | 7 / 5 / 0 |
| Fecha inicial CERTIFIED / INFERRED / MISSING / CONFLICT | 329 / 0 / 34 / 0 |

Evidencia y candidatos:

| Grupo | Analizado | Candidato demostrable | Pendiente/excluido |
|---|---:|---:|---:|
| AA:DO | 33,852 | 4,049 coincidencias exactas con Reporte | 93 celdas del INVALID_TEST; 0 programaciones positivas pasadas sin contraste |
| Solicitud de retiro | 228 | 226 | 2 |
| Segmentos de plan (344 iniciales + 126 cambios) | 470 | 419 | 51 |
| DP:DW | 1,092 | 393 rendimientos explícitos consistentes | 2 no cero inconsistentes; 364 acumulados excluidos |
| Reporte Ahorro | 4,049 filas / 317 Folios | Contraste únicamente | Ledger automático: 0 |
| Reporte RH | 320 filas / 320 Folios | Contraste únicamente | Ledger automático: 0 |

AA:DO conserva 26,546 celdas `FORMULA`, 6,543 `MANUAL` y 763 `EMPTY`, con Folio, fecha, valor, hash de fila y hash de evidencia. DP:DW conserva periodo, capital, rendimiento, subtotal, clases de celda y hashes. Reporte Ahorro y RH conservan sus conjuntos exactos de Folios y hashes por fila en el resultado privado; sus hashes de conjunto versionables son:

- Reporte Ahorro Folios: `2D4042041483E44F13FDE80C1E3A9C9CD1FACB7C09B18348D87C0D1DE247275F`.
- Reporte Ahorro filas: `6C7D8A26984FB4A887587BE8AF0C3EEE2BB66DAD62951A8ACA210AB9381B1640`.
- Reporte RH Folios: `B48EAA30705A27D28DE64ACBADEA9C3710CE3278A0646F9CF7CE2659A0536802`.
- Reporte RH filas: `5D4FFADB6AA19E044BE99DD018E9A17DC57A7ED2E7EE61259482EB319E3C379F`.

Conciliación frente a Q:

| Clasificación | Folios |
|---|---:|
| `EXACT_MATCH` | 343 |
| `ROUNDING_MATCH` | 0 |
| `MISMATCH` | 20 |
| `INSUFFICIENT_EVIDENCE` | 0 |
| Identidad no resuelta pero aritméticamente reconciliable | 7 |

| Total | Monto |
|---|---:|
| Q legacy | $1,986,073.50 |
| Capital candidato desde contraste Reporte Ahorro | $4,531,170.96 |
| Rendimiento candidato, excluido de la comparación con Q | $381,366.72 |
| Retiros candidatos | $2,572,847.46 |
| Total candidato (`capital - retiros`, ajuste manual no atribuible = 0) | $1,958,323.50 |
| Diferencia total (`candidate_total - Q`) | -$27,750.00 |

Confianza y revisión:

- `HIGH`: 0; `MEDIUM`: 343; `LOW`: 20.
- `CERTIFIABLE_NOW`: 0; `PENDING_REVIEW`: 343; `BLOCKED`: 20.
- Los 20 casos exactos se reprodujeron. Hash del conjunto privado de Folios: `6C9CD2B29A1D5C15E52A6566FC2313B98D9FFA670BF0129406D05CD16C4B24EA`.
- Agrupación probable: 16 `LEGACY_PROJECTION_OR_WITHDRAWAL_RECONSTRUCTION`; 4 `LEGACY_Q_VS_REPORTE_AHORRO_CONTRAST`.
- Explicación causal concluyente: 0; no resueltos: 20. No se corrigió ningún valor.

## VERIFY / EVIDENCE

- Dos capturas productivas `GET` idénticas: 363 participantes, 42,229 evidencias y SHA estable.
- Conteos de las 17 tablas idénticos antes/después: batch 1, participantes 363, evidencia 42,229, auditoría 1, trece tablas restantes 0.
- Reconciliador determinista: `PASS`, reproduce 343/0/20/0 y todos los totales.
- Prueba automatizada: `scripts/test-savings-ledger-reconciliation-dry-run.js`, `PASS`.
- Google reads/writes: `0/0`; Supabase writes: `0`; transacciones canónicas: `0`; yield credits: `0`; cutover: `NO`.
- Build frontend: `NOT APPLICABLE`; esta H no modifica runtime/UI.
- Commit: `NONE`; push: `NO`.

## RESULTADO OBLIGATORIO

```text
SAVINGS LEDGER RECONCILIATION DRY RUN RESULT
Folios evaluated: 363
Invalid excluded: 1
Exact match: 343
Rounding match: 0
Mismatch: 20
Insufficient evidence: 0
Identity unresolved but financially reconcilable: 7
Confidence HIGH / MEDIUM / LOW: 0 / 343 / 20
CERTIFIABLE_NOW / PENDING_REVIEW / BLOCKED: 0 / 343 / 20
Candidate contributions: 4049
Candidate withdrawals: 226
Candidate yields: 393
Candidate plan segments: 419
Total Q: 1986073.50
Total candidate capital: 4531170.96
Total candidate yield (excluded from Q comparison): 381366.72
Total candidate withdrawals: 2572847.46
Total candidate: 1958323.50
Total difference candidate minus Q: -27750.00
20 mismatches reproduced: YES
20 mismatches conclusively explained: 0
20 mismatches unresolved: 20
Google writes: 0
Supabase RAW writes: 0
Canonical transactions: 0
Yield credits: 0
Cutover: NO
SAFE_TO_MATERIALIZE_HIGH_CONFIDENCE_LEDGER: NO
SAFE_TO_MAKE_SUPABASE_AUTHORITATIVE: NO
NEXT STEP: H-SAVINGS-MISMATCH-EVIDENCE-RESOLUTION-001, confirmar semántica de movimientos de Reporte Ahorro y resolver los 20 casos privados sin escrituras antes de proponer materialización.
Commit: NONE
Push: NO
```

## CIERRE

```text
H-SAVINGS-LEDGER-RECONCILIATION-DRY-RUN-001 RESULT
Status: PASS
Files changed: capturador/reconciliador/test read-only; auditoría y changelog; artefactos PII sólo en tmp ignorado
Source-of-truth verdict: PASS - Google legacy permanece autoritativo; Supabase y los JSON son SHADOW/derivados
Invariant verdict: PASS - no se inventó historia ni se promovieron Q/reportes/candidatos a ledger
Build: NOT APPLICABLE - frontend/runtime sin cambios
Tests: PASS - doble captura estable y prueba determinista de conteos, hashes, totales, 20 desajustes y cero escrituras
Security: PASS - credencial backend sólo para GET; secretos/PII no versionados; RLS y tablas sin cambios
Legacy impact: NO GOOGLE ACCESS; fórmulas, triggers y Apps Script intactos
Unexpected files changed: 0 atribuibles a esta H fuera del alcance declarado; dirty tree previo preservado
Known limitations: 0 HIGH; 20 desajustes causales sin resolver; Reporte Ahorro no confirmado como ledger; ajuste manual O no atribuible
Evidence: docs/audits/H-SAVINGS-LEDGER-RECONCILIATION-DRY-RUN-001.md y tmp/savings-ledger-reconciliation-20260902/
```
