# Sistemas Google legacy

## Reparación de referencias autorizada — ADR-107, 2026-09-08

SAFE CHANGE aplicada en el mismo receptor GAS15 y mismo deployment. Tres referencias del registry
SutiApp Financial Handoff!L quedaron alineadas con las filas verificadas de Historial de solicitudes.
Nueve registros técnicos de pruebas ausentes quedaron K=failed, O=REQUEST_SYNC_TARGET_MISSING y P con
motivo; el dropdown K permite received/processing/processed/failed y se conservó su validación.
La corrección puntual no escribió ninguna celda de Historial de solicitudes, ni AH+, fórmulas, cálculos
o triggers. El reintento real de SR-2026-000121 conservó toda la fila y Y=Iniciado, sin duplicados.
Backup exacto y plan inverso privados; readback CellData comprueba únicamente 30 celdas técnicas cambiadas.

## Aclaración posterior expresa — presentación A/J/Y, 2026-09-08

H-REQUESTS-GOOGLE-REGISTER-FORMAT-001 sustituye sólo la presentación del contrato siguiente:
A=folio SR, J=fecha nativa `dd/MM/yyyy` con día original, aprobación Y=`Aprobado`. UUID y hash
permanecen internos. Se autoriza corrección exacta de A/J de filas verificadas y formato de J;
Y sólo cambia mayúsculas exactas, preservando Iniciado u otros estados posteriores. Registro técnico
conserva folio derivado. No se tocan AH+, fórmulas, cálculos, triggers, estados ni hojas financieras
ajenas. Filas ausentes no se recrean; referencias desplazadas se mantienen como conflicto visible.

## Excepción posterior expresa — solicitudes A:AG, ADR-106

H-REQUESTS-WORKFLOW-HISTORY-GOOGLE-SYNC-001 autoriza registrar todas las solicitudes después del commit
Supabase en `SutiApp Final / Historial de solicitudes`: UUID en A y Y inicial `PENDIENTE`; aprobación
actualiza únicamente Y a `APROBADO`, rechazo/cancelación a `Rechazado`. Mismo UUID, misma fila.
El propietario excluyó AH y las columnas siguientes: el nuevo writer toca sólo A:AG al crear y Y después.

Este contrato reemplaza el append-only posterior a aprobación, A vacío e `Iniciado` descritos en el corte
V1 de abajo. Conserva el mismo Apps Script/deployment/registry y su autenticación. No crea triggers Google,
no ejecuta procesamiento financiero posterior y no cambia criterios, fórmulas, saldos, pagos, Ahorro ni
otras hojas. La cola/cron Supabase es transporte recuperable, nunca una nueva autoridad financiera.

Google Sheets y Apps Script actuales son sistemas externos productivos, no tecnología descartable.

```text
AHORRO = LEGACY PROTECTED
PRÉSTAMOS = LEGACY PROTECTED
```

También quedan protegidos fórmulas, triggers, cálculos financieros, conciliaciones, amortizaciones, saldos y procesos administrativos relacionados.

## Gate obligatorio

Toda H que lea o escriba estos sistemas se clasifica mediante `legacy-google-guardian` como `READ ONLY`, `SAFE CHANGE`, `REQUIRES AUDIT` o `BLOCKED`. Antes de modificar: inventariar hojas/rangos, Apps Scripts, triggers, fórmulas, dependencias, propietarios, lectores/escritores, frecuencia, IDs, cálculos, conciliación, errores y recuperación.

No asumir que una hoja equivale a una tabla ni que una celda calculada es un dato maestro. No modificar Google Sheets durante las primeras fases. Si no se demuestra equivalencia financiera y operacional: `BLOCKED — DECISIÓN REQUERIDA`.

La arquitectura híbrida es válida si cada dominio conserva una única autoridad declarada.

## Criterios financieros — corte Supabase ADR-065

Google `Criterios de fondos` dejó de ser autoridad productiva de elegibilidad, fondos, tasas, máximos, plazos, fechas y visibilidad. Supabase es la única autoridad mediante `financial_programs`, `financial_funds`, `financial_rules` y el marcador explícito `financial_criteria_authority=SUPABASE`. Google queda intacto como histórico/procedencia: cero escrituras y cero cambios Apps Script durante el corte.

La importación certificada consumió exclusivamente A/B/C/D/E/F/H/N/P. G/I/J/K/L/M/O quedaron excluidas; L `Plazo para calculo AD. NÓMINA` es `OUT OF SCOPE / AUXILIARY LEGACY CALCULATION` y el código productivo no la consume. `financial_session_snapshots` sigue como caché personalizado TTL 15m, derivado del batch Supabase activo. Apertura, cambios de monto/fondo/plazo y confirmación consultan cero veces Google; un fallo no activa dual-read ni fallback. La única escritura Google restante del dominio préstamos es el append posterior a aprobación descrito abajo, que no cambia criterios.

## Phase 7 — export después de aprobación

La solicitud inicial se guarda únicamente en Supabase `program_requests`. Envío, Historial, refresh y retry del afiliado no escriben Google. Una aprobación administrativa backend explícita puede autorizar una única fila nueva en `Historial de solicitudes`; ninguna otra hoja de `SutiApp Final` es escribible.

El writer desplegado se autentica server-to-server, toma `LockService`, verifica `program_request_id` en el registro técnico, valida los 38 encabezados exactos, determina la fila append dentro del lock, escribe el payload completo, confirma y registra fila/hash/timestamp/resultado antes de liberar el lock. Un UUID ya exportado devuelve la misma fila sin escribir otra.

D Proceso, M afiliación, Y=`Iniciado`, plazo y los cinco documentos O:S están codificados fail-closed desde fuentes/snapshots autoritativos. Proceso 3 se rechaza mientras no exista set autoritativo T:W de aval. Se prohíbe escribir una fila parcial o inferir valores. Después del append termina la automatización: no se ejecutan amortización, scripts financieros posteriores, estados, pagos, saldos o conciliación. La validación productiva del append permanece pendiente porque no se autoriza contaminar el histórico con una fila inventada.

Recovery: retirar o rotar el secret o deshabilitar el deployment detiene exports nuevos. Supabase conserva siempre la solicitud. Ante fallo o timeout queda reintentable; antes de repetir el append se consulta el UUID bajo lock para recuperar una escritura Google que sí ocurrió pero cuya confirmación no llegó.

## Explicit request deletion - ADR-108

The owner authorizes removing the selected request from Historial de solicitudes. The existing receiver
adds authenticated delete_request inspect/apply under ScriptLock. It validates UUID/folio, control, date,
initial hash, uniqueness, formulas and backup fingerprint. Only matched A:AG content is cleared; row
positions, AH+ and adjacent records remain intact. The technical handoff registry retains a deletion
tombstone, rejecting delayed sync_request and handoff. Supabase stores the private backup before clear.
No financial calculations, triggers, payments, balances or reconciliation are invoked. Unsupported or
ambiguous legacy identity fails visibly. See H-ADMIN-REQUEST-DELETE-001 and its focused GAS evidence.
