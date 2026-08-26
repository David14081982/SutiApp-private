# PHASE 7 — Auditoría de Ahorro, Préstamos y legacy financiero

## Resultado

`OWNER_DECISION_REQUIRED`

Phase 7 se limitó a auditoría read-only. No se modificó Google Sheets, Apps Script, fórmulas, datos, Supabase ni frontend financiero. La evidencia vigente no permite migrar ni conectar el prototipo como si fuera equivalente al sistema productivo.

## Fuente examinada

- Archivo productivo declarado: `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`).
- Metadata observada: 98 pestañas; actualización visible del archivo el 2026-08-22.
- Se observaron solo metadata y rangos acotados de encabezados/fórmulas. No se escribió ni se persistió una copia de filas personales.
- Drive contiene varias copias históricas con nombres similares; no se promovió ninguna como autoridad alternativa.
- La búsqueda accesible no encontró un proyecto Apps Script independiente vinculable. Esto no demuestra que no exista: su propietario, triggers, despliegue, endpoints y writers siguen `UNKNOWN`.

## Inventario mínimo

### Ahorro

Nueve hojas interdependientes: `Ingreso ahorro`, `Solicitud de Ahorro`, `Ahorro`, `Solicitud Cambio ahorro`, `Solicitud de retiro`, `Saldo manual`, `Reporte Ahorro`, `Reporte - RH` y `Conciliacion`.

La hoja `Ahorro` tiene 362 filas y 127 columnas. Sus fórmulas enlazan solicitudes, retiros parciales/completos, saldos manuales, calendario quincenal, reportes de RH y conciliación. Los saldos son derivados; ninguna de esas hojas equivale por sí sola a un ledger maestro.

### Préstamos

Incluye al menos `Historial de solicitudes` (2,237 × 38), `HISTORIAL P V2` (13,913 × 35), `HISTORIAL DE PRESTAMOS` (1,573 × 18), `Amortización V2` oculta (966 × 26), `Query fondos` (12,600 × 24), `Criterios Simuladores`, `Criterios de fondos`, `Fondos Configuracion`, `Fondos para prestamos`, reportes y conciliaciones.

Los datos combinan solicitudes, PII/documentos, autorización, fondos, tasas, plazos, pagos, amortización, estados, transferencias y reportes. `numero_control` aparece como puente de negocio, pero no autoriza normalizarlo ni volverlo único.

## Equivalencia

`FAIL`

- Google etiqueta la tasa histórica como `tasa Qnal %` y los totales observados son consistentes con interés simple por quincena: `capital × (1 + tasa_quincenal × plazo_quincenas)`.
- `app/screens-loan.jsx` etiqueta la misma semántica como `% mensual`, calcula `months = quincenas / 2` y aplica `capital × (1 + tasa / 100 × months)`.
- `funds-seed.js` y `funds-store.jsx` convierten valores como 2/3/5 a `tasaMensual`; son seed/localStorage de prototipo, no autoridad.
- Para una regla de 3% y 12 quincenas, el legacy calcula 36% simple sobre capital; la UI calcula 18%. No son equivalentes.
- `financeStore/localStorage`, `DATA.user.ahorro`, el fallback de crédito y los documentos mock no pueden leer ni escribir productivamente el legacy.

## LEGACY GOOGLE AUDIT

```text
Systems/domains: Ahorro, Préstamos, fondos, amortizaciones, reportes, queries y conciliaciones
Reads: metadata + rangos acotados de encabezados/fórmulas; ninguna lectura runtime nueva
Writes: NONE
Calculations/triggers: fórmulas quincenales y dependencias cruzadas demostradas; Apps Script/triggers/writers UNKNOWN
Authority: Google legacy actual; frontend local es prototipo no autoritativo
Equivalence: FAIL — periodicidad y cálculo de tasa no coinciden
Recovery: NOT APPLICABLE para auditoría; cualquier migración futura exige snapshot/hash, backup y rollback
Classification: BLOCKED — OWNER_DECISION_REQUIRED
Decision: elegir estrategia de autoridad/operación antes de implementar
Evidence: metadata Google, fórmulas acotadas, DATA_MAPPING, SOURCE_OF_TRUTH y código frontend citado
```

## Decisión del propietario requerida

### Opción A — Conservar Google como autoridad operacional (recomendada)

Construir después un adaptador seguro que lea resultados autorizados y envíe comandos al proceso legacy, sin duplicar cálculos en navegador. Requiere que el propietario identifique responsables, Apps Script/endpoints, triggers, writers, reglas de cierre y conciliación.

**Consecuencia:** menor riesgo inmediato y transición híbrida; Google continúa operando hasta demostrar paridad mediante shadow run y reconciliación.

### Opción B — Autorizar migración gradual a Supabase

Diseñar ledger/eventos, solicitudes, pagos, amortización y conciliación en backend; ejecutar snapshot/backup, doble lectura controlada o shadow run, comparación por `numero_control`, corte de escritores y rollback antes del cutover.

**Consecuencia:** mayor trabajo y riesgo; no puede iniciar schema ni copiar datos hasta fijar reglas, propietario operacional, historial, cálculos y estrategia de transición.

### Recomendación

Elegir **Opción A** como siguiente etapa: mantener Google autoritativo y autorizar una H separada de contrato de integración/equivalencia. No exponer el simulador local como cálculo productivo mientras no coincida con la tasa quincenal vigente.

## Cierre H-PHASE7-AUDIT

```text
H-PHASE7-AUDIT RESULT
Status: DECISION REQUIRED
Files changed: documentación de auditoría y cola; ningún código/dato financiero
Source-of-truth verdict: Google legacy actual; futuro UNRESOLVED
Invariant verdict: PASS — no cutover, no doble autoridad, numero_control intacto
Build: NOT APPLICABLE
Tests: equivalencia estática FAIL; Google read-only PASS
Security: PII no copiada; writers/Apps Script/triggers UNKNOWN
Legacy impact: READ ONLY
Unexpected files changed: none detected
Known limitations: connector no expone Apps Script, triggers, propietario operacional ni historial de escritores
Evidence: metadata de 98 pestañas, rangos/fórmulas acotados y código frontend
```
