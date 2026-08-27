# Sistemas Google legacy

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
