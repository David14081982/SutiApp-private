# Auditoría de transferencia y lecturas de Ahorro — 2026-10-02

La auditoría está terminada. **Hay mejoras instaladas, pero no está demostrada una reducción del egress mensual actual.** La reducción histórica de transferencia del afiliado no se puede trasladar al flujo publicado actual. Se confirmó además una exposición anónima de información administrativa, que requiere corrección prioritaria.

## PRE-CHANGE AUDIT

- H: H-SAVINGS-EGRESS-READONLY-AUDIT-001.
- Objetivo: recordar el incidente, verificar las optimizaciones vigentes y distinguir transferencia, trabajo SQL y consumo de plataforma.
- Alcance: lectura de código/evidencia, catálogo SQL, estadísticas agregadas, métricas de plataforma, artefacto público y comprobación focal del acceso anónimo descubierto.
- Archivos: este informe; `docs/qa/evidence/savings-egress-audit-20261002/*.json`; apéndice de `docs/AGENT_CHANGELOG.md`; colectores temporales en `.tmp/savings-egress-audit-20261002/`.
- Fuera de alcance: modificar aplicación, funciones, permisos, schema, datos, Google, finanzas o despliegues.
- Datos afectados: ninguna escritura de negocio. Evidencia derivada sin nombres, UUID de personas, folios, saldos individuales, tokens ni claves.
- Autoridad: Supabase canónico publicado para Ahorro, conforme a la decisión del 21 de septiembre en SOURCE_OF_TRUTH; Google es evidencia histórica, no fallback vigente. Telemetría no es autoridad financiera.
- APIs: Management API, PostgREST, descarga pública de Sutiapp. SQL limitado mediante BEGIN READ ONLY, timeout de 15 s y lock timeout de 2 s.
- Riesgo: consumo acotado de las lecturas; no pruebas de carga ni fixtures productivos. El probe anónimo conserva solamente tamaño, conteo y nombres de campos.
- Tests: suite aislada del lector condicional; inspección del runtime publicado y funciones instaladas; comprobación focal real de seguridad.
- Recovery: no cambio productivo que revertir.
- Status del alcance: PASS.

Navigator: check/lookup devolvieron STALE por documentación y evidencia de otra H (finance-request-process), no por los archivos Savings examinados. Se verificaron fuentes, funciones live y bundle público directamente. No hubo cambio arquitectónico ni regeneración del Registry.

## Qué problema había

1. **Ahorro del afiliado, H05 del 7 de septiembre:** lecturas repetidas descargaban de nuevo la proyección completa. Un índice acotó la búsqueda de historia/futuro desde 42.229 filas examinadas a 93 en la muestra. Se agregó validación de versión para reutilizar memoria únicamente cuando el backend lo permitía.
2. **Panel administrativo, 18 de septiembre:** una carga calculaba tres veces la proyección de personas. El resumen generaba calendarios hasta 1.098 días hacia adelante; al alcanzar 310 cuentas certificadas superaba el timeout de 8 s.
3. **Presión general del servidor, H02:** se documentaron poca RAM disponible y swap activo. Eso es Disk I/O; no equivale a transferencia facturada hacia el navegador.

| Evidencia histórica | Antes | Después | Límite |
|---|---:|---:|---|
| Finanzas → Ahorro → Finanzas, participante real | 32.100 B | 16.751 B | 47,8% menos bytes decodificados; dos RPC en ambos casos; medición histórica |
| Proyecciones completas en ese recorrido | 2 | 1 | La segunda RPC validaba versión |
| Panel, eliminar proyección triple | 4.950 ms | 2.070 ms | Muestras documentadas en migración, no benchmark repetido hoy |
| Resumen, acotar calendario a 30 días futuros | 7.741 ms | 2.324 ms | Muestras documentadas en migración; no sumar porcentajes de ambas mejoras |

Fuentes: [H05 BEFORE_AFTER](../qa/evidence/disk-io-remediation/H05/BEFORE_AFTER.md), [H05 cierre](../qa/evidence/disk-io-remediation/H05/VERIFICATION.md), [H02 diagnóstico](../qa/evidence/disk-io-remediation/H04/preconditions/H02-VERIFICATION.md), migraciones `20260918000100_savings_panel_single_projection.sql` y `20260918000200_savings_summary_short_horizon.sql`.

Supabase distingue [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), datos enviados a clientes, de [Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io), actividad del disco del servidor.

## Estado instalado comprobado hoy

Capturas: 2026-10-02, aproximadamente 23:47–23:51 UTC (16:47–16:51 Hermosillo).

- Producción sirve bundle `v310`, SHA-256 `65de47766b3aa10b5ae4ae82bae2bcd44ce7ef07bbd7257041144dc0771f5a23`. Contiene los tres nuevos lectores workspace y el lector condicional del afiliado. Esto prueba presencia del código, no una ejecución E2E autenticada.
- El índice `savings_legacy_evidence_participant_type_source_idx` sigue instalado.
- `get_admin_savings_panel` calcula la proyección de personas una sola vez y la comparte; `savings_admin_current_summary` conserva el horizonte futuro de 30 días.
- Los lectores `get_admin_savings_workspace_people/person/summary` están instalados. La lista pagina antes de construir el detalle por persona. La UI pide 20 personas por página, inicialmente 10 movimientos al abrir una persona y otros 20 al solicitar más.
- El detalle tiene memoria temporal de 30 s, máximo ocho personas, con separación de contexto e invalidación local. El resumen y la lista no tienen esa caché persistente. Las consultas de UI con AbortSignal tampoco usan la deduplicación reservada a solicitudes sin señal.
- **Cambio decisivo:** `savings_publication_state` está en `PUBLISHED`, versión 2. En ese modo, el `get_self_savings_if_changed` instalado responde siempre `modified=true`, `cacheable=false`, `version=null` y genera el payload completo. La rama condicional antigua se conserva para modo PRIVATE. Por tanto, **el 47,8% histórico no demuestra ahorro actual en las visitas secuenciales del afiliado**. Es una decisión explícita de frescura al publicar saldos, no evidencia de una nueva corrupción financiera.

### Trabajo SQL observado

| Familia de consulta | Llamadas acumuladas | Promedio acumulado |
|---|---:|---:|
| Nuevo resumen administrativo | 41 | 2.564,36 ms |
| Nueva lista de ahorradores | 39 | 152,31 ms |
| Nuevo detalle individual | 19 | 39,36 ms |
| Panel anterior/general | 677 | 2.863,50 ms |
| Lector condicional del afiliado | 14.615 | 151,11 ms |

Estos son grupos de `pg_stat_statements`, no latencias de navegador ni percentiles. Pueden mezclar pruebas y tráfico real, tamaños de página y contextos; no sirven como comparación causal antes/después. El reset global reporta 2026-08-21 y hubo 28 desalojos de entradas. **El resumen sigue concentrando el coste entre los lectores nuevos**: delega en el panel general y calcula agregados globales, aunque entregue una respuesta reducida.

La muestra actual del host muestra aproximadamente 3,01 GB de memoria disponible sobre 4,01 GB totales, swap libre igual al total y contadores pswpin/pswpout en cero. No reproduce en esa captura la presión de swap histórica. No demuestra ausencia de picos, atribución a estas optimizaciones ni resolución del presupuesto Disk I/O.

### Transferencia mensual: evidencia insuficiente

La API de conteos devolvió datos y el endpoint de métricas respondió HTTP 200. Los contadores del host son acumulados y no equivalen al egress facturado por Ahorro. No hay una serie comparable de bytes facturados antes/después ni instrumentación actual de un recorrido autenticado completo.

Los endpoints inicialmente probados `usage.api-egress` y `/metrics` devolvieron 404; al consultar el OpenAPI oficial se localizó y usó el endpoint correcto `/analytics/endpoints/metrics`. La consulta agregada a logs respondió HTTP 200 **con error lógico** `Table "edge_logs" does not exist`; no se considera una consulta exitosa de tráfico. Se conserva el error. No se atribuyen bytes mensuales ni ahorros de factura a partir de estos resultados.

## Hallazgo prioritario de seguridad — FAIL

`public.savings_admin_current_summary(jsonb)` está instalado como SECURITY DEFINER, sin comprobación interna de usuario o permiso y con EXECUTE para PUBLIC/anon/authenticated.

La prueba real usó exclusivamente la clave pública ya publicada en `app/supabase-config.js`, **sin Authorization ni sesión de usuario**. PostgREST devolvió:

- HTTP **200**.
- **354 filas**.
- **399.232 bytes** de cuerpo JSON decodificado.
- Campos que incluyen `nombre`, `folio`, `saldo`, capital y rendimiento, además de identificadores y estado.

Se conservaron solo conteo, tamaño y nombres de campos; ningún valor personal. Una prueba SQL previa con `SET LOCAL ROLE anon` confirmó la misma accesibilidad. Las 49 tablas Savings inspeccionadas tienen RLS habilitado y forzado; eso no impide este acceso mediante la función SECURITY DEFINER.

Esto demuestra exposición anónima; **no demuestra que terceros la hayan explotado ni explica por sí solo el consumo histórico**. Cada invocación puede ejecutar el resumen completo y entregar aproximadamente 399 KB. Se requiere una corrección focal de autorización/EXECUTE con pruebas de regresión de los consumidores legítimos. Esta auditoría no modifica permisos.

## Verificación y cierre

`node scripts/test-savings-read-work.js`: **19/19 PASS**, VM aislada, sin red ni escrituras financieras. Prueba lógica cliente de validación/invalidación; no demuestra que el servidor publicado permita reutilizar caché actualmente.

H-SAVINGS-EGRESS-READONLY-AUDIT-001 RESULT

```text
Status: FAIL — hallazgo real de seguridad; investigación terminada, remediación no aplicada
Files changed: informe, JSON sanitizados de evidencia y apéndice AGENT_CHANGELOG; temporales locales
Source-of-truth verdict: PASS para el alcance; autoridad publicada comprobada, sin fuente nueva
Invariant verdict: FAIL en autorización del resumen auxiliar; ninguna regla financiera alterada por la auditoría
Build: NOT APPLICABLE; no código modificado. Bundle público inspeccionado, no reconstruido
Tests: PASS 19/19 aislados; probe de seguridad FAIL por HTTP 200 anónimo; logs no disponibles
Security: FAIL — resumen administrativo accesible sin sesión; no secretos ni PII persistidos
Legacy impact: READ ONLY; cero acceso/escritura Google, saldos, ledger, fórmulas o triggers
Unexpected files changed: ninguno por las operaciones de esta auditoría; workspace con cambios previos preservado
Known limitations: sin serie comparable de egress facturado, sin E2E autenticado nuevo ni benchmark causal
Evidence: docs/qa/evidence/savings-egress-audit-20261002/; referencias históricas y funciones inspeccionadas
```

## SUTIAPP ARCHITECT REVIEW

Task: H-SAVINGS-EGRESS-READONLY-AUDIT-001.
Verdict: NEEDS_FIX para el sistema auditado; no aprobar seguridad ni reducción mensual global.
Critical findings: exposición anónima reproducida; ahorro H05 supersedido en modo publicado; resumen administrativo aún costoso.
Source of truth: Supabase PUBLISHED v2; historia Google sin modificar.
Architecture: las mejoras de paginación y horizonte siguen presentes; no se cambió estructura.
Security: requiere reparar el helper SECURITY DEFINER y comprobar consumidores autorizados.
Data: no DML ni persistencia de valores personales.
Legacy: READ ONLY.
Owner decision: NO para identificar el defecto técnico; esta revisión no autoriza ejecutar una migración.
Next action: preparar corrección focal de autorización y medición reproducible del recorrido administrativo; obtener serie de egress comparable antes de afirmar reducción mensual.
Response generated for Codex: YES.

### RESPONSE TO CODEX

No cierres H-SAVINGS-EGRESS-READONLY-AUDIT-001 como PASS del sistema. Conserva el diagnóstico y la evidencia del acceso anónimo. Para una continuación autorizada, audita dependencias, prepara recuperación y corrige únicamente la exposición de `savings_admin_current_summary`, verificando anon/afiliado/admin y los lectores anidados legítimos, sin cambiar saldos, fórmulas, historia ni UI. Mide después un recorrido equivalente con bytes, requests y latencia, distinguiendo ahorro del cliente de egress facturado. No avances a otra H.
