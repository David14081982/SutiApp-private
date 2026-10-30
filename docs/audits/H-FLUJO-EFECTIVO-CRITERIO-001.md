# H-FLUJO-EFECTIVO-CRITERIO-001

PRE-CHANGE AUDIT

Status: PASS para corrección focal autorizada por decisión expresa del propietario.

Objetivo: aceptar los valores registrados en fuentes oficiales para el Reporte Flujo de efectivo, eliminando exigencias de certificación documental adicional. La conciliación posterior corresponde a cada área. Sin determinar queda limitado a datos realmente ausentes o cálculos imposibles; una observación histórica no anula un importe disponible.

Alcance: lectores y derivaciones exclusivos del reporte. Supabase mantiene Ahorro, Inversores y condiciones aprobadas; HISTORIAL P V2 mantiene A/B y condiciones registradas. El motor puro y sus reglas proporcionales se reutilizan sin modificación ni activación. La identidad C/D/S, tarifas históricas, períodos administrativos de adelantos, centavos y distinción registrado/calculado/programado se conservan.

Archivos: supabase/functions/reports-jc/cash-flow-contracts.mjs, cash-flow-google.mjs, cash-flow-investors.mjs, cash-flow-consolidated.mjs y cash-flow.mjs únicamente si su integración lo requiere. Consultas RPC exclusivas del reporte podrán ajustarse mediante migración/recovery focal nueva para exponer importes/componentes existentes, sin alterar sus tablas ni funciones de negocio. Pruebas scripts/test-cash-flow-* y nuevos scripts/verify/release-cash-flow-criteria-*; documentación de esta H, apéndice de decisión del propietario y Registry focal sólo si cambia una dependencia. app/cash-flow-report.jsx y cash-flow-export.js únicamente si el contrato de datos requiere mostrar la distinción calculado/registrado; conservar íntegros diseño, controles y navegación. Artefactos generados sólo si cambia su fuente.

Fuera de alcance: datos, contratos, saldos, Ahorro e Inversores como módulos, scripts originales, HISTORIAL P V2, otras pantallas, activación del motor y auditorías históricas. No modificar ni reproducir suites globales.

Riesgos y tratamiento: quitar bloqueos documentales no equivale a inventar fechas, tarifas o pagos. Montos existentes permanecen visibles; componentes calculables se derivan de las condiciones oficiales. Duplicados se identifican por identidad vigente, correcciones sustituyen valores. Movimientos realizados y obligaciones futuras nunca se suman como un mismo cobro. Las condiciones históricas no se sustituyen por tasas actuales cuando existan términos fechados.

Validación: casos focales de registros importados/review con datos suficientes, tarifas 0/10/15 y adelantos, parcial/extraordinario, conciliación de componentes y totales, ausencia real de datos, y paridad pantalla/Excel contra respuesta productiva. Usar capturas ya disponibles para desarrollo, una consulta vigente para verificación final; no repetir investigaciones históricas.

Recovery: respaldo reports-jc v5, funciones de consulta y fuentes exactas previas; restauración limitada al reporte sin tocar datos financieros. Publicación parte del commit 183177cdb7b46668c70090cc737fc8cb75ad569c, aislada de cambios ajenos del workspace.

Skills: sutiapp-architecture-navigator, pre-change-audit, source-of-truth-guardian, legacy-google-guardian, supabase-security-review, database-migration-guardian si se ajustan lectores SQL, claude-ui-preservation-guardian, post-change-verification y revisión independiente al cierre.

Decisión del propietario vigente: no exigir segunda certificación documental ni bloquear importes oficiales por history_complete/review o por ausencia de PDF/snapshot adicional. Esta decisión sustituye el criterio documental anterior únicamente para la construcción del reporte; no cambia autoridades ni datos originales.

Ampliación focal de implementación: la RPC autenticada detectó el límite existente de ocho segundos. Se restauraron las dos consultas y el paquete original del reporte antes de continuar. La migración 006 optimiza exclusivamente la consulta de Ahorro: agrega por cuenta/mes e invoca por lote el lector existente savings_workspace_receipts. Conserva los resultados de 005, los permisos y los límites productivos. No se modifica ningún helper financiero ni dato. Las migraciones 004/005 y su historial permanecen intactos; 006 tiene recuperación exacta a 005. Se exige comprobación HTTP autenticada antes de publicar el frontend.
