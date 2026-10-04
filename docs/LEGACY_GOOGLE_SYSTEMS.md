# Sistemas Google legacy

## Lectura por receptor existente — 2026-09-21

La reparación de OAuth conserva `SutiApp Final / HISTORIAL P V2` como única fuente
del guard de préstamos de Ahorro. Apps Script v17 incorpora `read_loan_status`, una
lectura fija de la misma hoja y columnas A:D/G/X, sin límite arbitrario de filas.
El receptor valida secreto antes de abrir el libro; no acepta selectores de hoja,
rangos o usuario. No escribe, no dispara cálculos y no cambia triggers/formulas.
`savings-settlement` v8 mantiene intacto el evaluador financiero y obtiene la lectura
mediante la conexión autenticada existente. Lectura productiva y conector independiente:
14,927 filas, 44 préstamos atrasados. Las diez solicitudes retenidas por el fallo
OAuth quedaron entregadas por la cola original, sin cambiar sus datos de negocio.

## HISTORIAL P V2 — retiro Ahorro — implementación local 2026-09-20

OWNER identifica SutiApp Final / HISTORIAL P V2 (sheetId 1245291756) como autoridad:
D Folio exacto, C ID de préstamo, A fecha amortizada, G fondo, X estado actual uniforme.
El lector preparado consulta todas las filas, agrupa todos los préstamos y bloquea
SALDO ATRASADO. LIQUIDADO, PAGÓ DE MÁS y AL CORRIENTE no bloquean. Estados inconsistentes,
fuente no disponible o identidad no resuelta fallan cerrados. Una excepción de retiro
vive en la bitácora Supabase de esa solicitud; jamás altera el estado de Google.
No se cambian fórmulas, Apps Script, triggers ni hojas. No existe caché alternativo
productivo. Edge y migración aún no desplegados; su OAuth directo se verificará sólo
en un release posterior autorizado. [Evidencia P0](audits/H-SAVINGS-P0-WITHDRAWAL-SETTLEMENT-001.md).

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


## 2026-09-10 — Empresa de membresía en Historial de solicitudes / Z

H-MEMBERSHIP-GOOGLE-COMPANY-Z-001: por instrucción explícita del propietario,
la proyección inicial de nuevas solicitudes `membership` con contrato
`MEMBERSHIP_PAYMENT_V1` coloca `financial_submission_snapshot.offering.company`
en Z (Observaciones). La empresa procede de Membresías y queda capturada al
solicitar; no se relee el catálogo para reconstruir solicitudes. Falta de empresa
en este contrato produce error explícito, sin valor inventado.

Se conserva `initial_row` de envíos existentes y su hash; posteriores estados
actualizan únicamente Y mediante el receptor vigente. No hay backfill ni cambios
a Apps Script, E–I, AH+, fórmulas, montos, intereses, reglas o programas distintos.
Evidencia: `docs/qa/evidence/membership-google-company-z-20260910/`.

## H-SICOF-RELEASE-001 — fixed financial reader

The owner authorized publication of `read_sicof_financial` in the existing
financial-handoff receiver. It reads only workbook
`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`, sheet ID `1245291756`,
`HISTORIAL P V2`. Existing writers and the prior loan-status reader remain
unchanged. No cells, formulas, triggers, amortizations or properties were edited.
Version 19 is active after an equivalent per-request date-format optimization;
the real new Edge BEHAVIOR read passes. Version 18 was previously confirmed by
repeated fresh deployment/content reads; an initial
stale API readback and the recovery attempt are preserved in the release audit.
The previous reader also passes real post-publication verification with the same
row and overdue-loan counts. Unavailable data must be
explicit and must never trigger a second financial source or inferred income.
See `audits/H-SICOF-GOOGLE-RELEASE.md` for the current verified deployment state.

## H-FINANCE-READ-PERFORMANCE-001 — transport only

The current authenticated Apps Script SICOF reader, spreadsheet, formulas, schedules
and shared OAuth credentials are unchanged. A bounded direct Sheets API experiment
received SERVICE_DISABLED on the existing clasp OAuth project; its candidate code
was excluded from the release. No Google deployment or API/scopes configuration was
changed. Compact WORKSPACE affects only the already-read server response, preserving
values, identity, date semantics and source fingerprints. No fallback was added.


## H-SAVINGS-AUTO-CONTRIBUTIONS-001 — 2026-10-03

La nueva decisión operativa de Ahorro aplica únicamente al dominio Supabase canónico: se abona al vencimiento el importe programado vigente o su excepción explícita. No se escriben Google Sheets, Apps Script, fórmulas, triggers, préstamos ni el histórico Excel. Las políticas financieras de rendimiento existentes permanecen. La pantalla no fabrica saldos sumando previsiones. Los datos históricos/cierres protegidos no se alteran para resolver pendientes.

## H-SICOF-RESPONSE-LATENCY-001 — frecuencia de lectura autorizada

El propietario autorizó una copia privada con antigüedad máxima de cinco minutos exclusivamente para la fuente fija `HISTORIAL P V2` de `Sutiapp Final`. El lector autenticado existente conserva contrato, columnas, valores, fechas y huella. No se modifican Google Sheets, Apps Script, fórmulas, triggers, amortizaciones, writers ni credenciales OAuth compartidas.

El candidato programa una lectura global cada cuatro minutos y permite actualización manual mediante la misma lease de 90 segundos y cooldown manual de 60 segundos; cada visita deja de disparar su propia lectura Google. El job periódico no descarta su turno por edad reciente de la copia. Las actualizaciones se validan antes de publicar y los resultados tardíos se rechazan. Si la fuente falla o vence, SICOF lo comunica sin recurrir a otro origen ni seguir calculando con la copia vencida. El intervalo programado no garantiza disponibilidad continua ante fallos o solapamientos. La migración 006 está aplicada; corrección de cadencia 007, configuración y publicación todavía pendientes.


Estado verificado de esta adenda (SICOF latency activation receipt): migraciones 006 y 007 aplicadas, cada una conservando 23 tablas y 182 funciones financieras existentes. Edge SICOF v11 ACTIVE con JWT; copia inicial verificada y job privado único cada cuatro minutos activado. Lectura y XLSX reales usan la copia vigente, sin repetir la consulta a Google; 8.368 s y 7.774 s en las muestras medidas, sin promesa de carga instantánea. Evidencia: `qa/evidence/sicof-response-latency.json`; cierre y límites: `audits/H-SICOF-RESPONSE-LATENCY-001.md`. Este estado sustituye las menciones de activación pendiente anteriores en esta adenda.

## H-SICOF-INSTANT-FILTERS-001 — filtros sin lecturas Google adicionales

Cambiar filtros compatibles trabaja sobre la observación ya autorizada y el contexto canónico recibido; no genera consultas Google ni altera el job compartido de cuatro minutos. El lector, libro, columnas, fórmulas, fechas de amortización y huellas conservan su contrato. El motor financiero permanece idéntico en servidor y simulador local.

La vista previa expira como máximo a los cinco minutos y antes si vence su fuente. Otro inicio o corte histórico requiere contexto canónico suficiente; no se reconstruyen políticas faltantes a partir de los gráficos. Exportar o guardar conserva la comprobación del servidor y falla ante una fuente modificada o vencida. No se introducen writers legacy, polling por filtro ni una segunda autoridad de préstamos.
