# H-SICOF-CONTINUOUS-REPORT-001 — continuación semestral del Excel

## PRE-CHANGE AUDIT

Autorización: el propietario pide continuar el orden del Excel mostrado, con N2 «2026 2DO SEMESTRE AHORRO», O2 «2026 REND. 2DO SEMESTRE», P/Q para 2027-S1 y pares sucesivos sólo cuando haya comenzado el periodo. Confirmó aportaciones acumuladas antes de retiros, con retiros y saldo separados. El manual solicitado sigue pendiente y debe describir la exportación corregida.

Baseline: publicación `94158a6a7005cd113517e77a30212217414b41c5`, aplicación v312. Navigator: STALE únicamente por la nueva auditoría documental del manual; no hay deriva de fuentes de código. Discovery dirigido sobre projection.mjs, exports.mjs, handler.mjs y los lectores de composición/periodo ya instalados.

Alcance: `supabase/functions/sicof/projection.mjs`, `exports.mjs`, `handler.mjs`; pruebas nuevas `scripts/test-sicof-continuous-report.js`, `scripts/test-sicof-continuous-export.js`, `scripts/test-sicof-continuous-handler.js` y adaptación focal de suites existentes si su contrato requiere datos nuevos; esta auditoría, revisión independiente `H-SICOF-CONTINUOUS-REPORT-001-REVIEW.md`, evidencia sanitizada `docs/qa/evidence/sicof-continuous-report/`, entrada focal de AGENT_CHANGELOG y aclaraciones SICOF de SOURCE_OF_TRUTH; auxiliares privados en `.tmp/sicof/continuous-report/`. Los documentos del manual ya declarados se actualizarán al resultado.

Resultado previsto: hoja principal «Informe acumulado» siguiendo A:M históricos de la plantilla, con pares N/O en adelante. Mantener todos los valores y estilos históricos, orden de personas existentes y Folio exacto; agregar personas nuevas identificadas. Conservar Hoja1 histórica, Informe vigente por el intervalo elegido y todas las hojas de respaldo. Abrir el libro directamente en Informe acumulado. El original descargable permanece byte a byte idéntico. A:M de la nueva hoja son referencia histórica; retiros y saldo actual continúan separados y expresamente identificados en los respaldos, nunca se vuelve a sumar el histórico al saldo canónico.

Fuentes/autoridad: historial de aportaciones comprobadas y ledger de Ahorro en Supabase; sólo movimientos efectivos hasta la fecha actual del servidor, zona America/Hermosillo. Aportaciones por fecha de contribución comprobada; rendimientos realmente acreditados por origen de periodo comprobado. Reversiones y correcciones siguen el movimiento original. Los retiros no reducen el acumulado de aportaciones/rendimientos acreditados de las nuevas columnas. Un saldo de apertura no demuestra aportaciones brutas y no se reclasifica como tal. Si se necesita complementar el tramo anterior al ledger, se usará únicamente el historial certificado ya autorizado del lector actual, con trazabilidad, corte y exclusión de doble conteo; se verificará primero su contrato. Ausencia de evidencia no se convierte en cero, y los subtotales confirmados no se presentan como un semestre completo cuando falta un tramo.

Plan: cerrar el DTO de acumulados; resolver periodo y corte del reporte en servidor; construir hoja ampliada sin alterar el original; verificar límites 2026-S2/2027-S1, personas, aportaciones, acreditaciones, retiros, reversiones, incertidumbre, filtros y orden; revisión independiente; despliegue focal de Edge autorizado por la corrección solicitada; descarga real autenticada con evidencia agregada sin filas personales; completar manual PDF/Word.

Seguridad: mismos roles/RLS/JWT/RPC; sin tablas nuevas, migraciones, préstamos, Auth global ni cambios de Google. No se escriben movimientos financieros. Nunca se usa rendimiento simulado en la columna de acreditado. No se expone el archivo original ni datos personales en el sitio público o evidencias.

Riesgos: mezclar origen con fecha de entrega; duplicar apertura/histórico/recibo; sumar retiros como aportaciones negativas; tratar una falta de datos como cero; agregar periodos futuros; dejar activa Hoja1 y aparentar que el reporte sigue sin cambios. Los casos anteriores se verifican expresamente.

Recuperación: conservar fuente Edge v3, plantilla original y release base; restaurar archivos focales/versión Edge anterior si fuera necesario. Ninguna migración ni recuperación de dinero. Frontend, bundle y SW no requieren cambios con el alcance actual; regresión global visual NOT APPLICABLE mientras permanezcan intactos.

Status: PASS para implementar el alcance documental/exportador declarado y verificar fuentes antes de derivar acumulados.

Ampliación focal de evidencia: se actualizarán los cinco índices derivados `docs/architecture/{SUTIAPP_ARCHITECTURE_REGISTRY,registry-code,registry-data,registry-edges,registry-search}.json` desde el checkout de publicación aislado después de incorporar los helpers/contratos nuevos. La publicación Git conservará byte a byte los 28 artefactos web públicos; el único runtime desplegado es Edge SICOF. Los documentos del manual pueden acompañar el commit privado sin añadirse a la lista pública de Pages.

Precisión del acumulado registrado: un recibo pendiente no anula otras aportaciones comprobadas. Si las únicas incertidumbres son un tramo anterior al ledger y/o recibos pendientes y existe evidencia de importes, se muestra su subtotal como PARTIAL con advertencia visible; no se afirma un total cerrado, no se supone que pendientes valgan cero y no se modifica la elegibilidad para rendimientos. Identidad, fuente cambiada, conflicto o ausencia total de evidencia mantienen el importe sin determinar.

## H-SICOF-CONTINUOUS-REPORT-001 RESULT

Status: PASS — Edge SICOF v4 ACTIVE, JWT verificado, descarga productiva contrastada el 2026-10-03.

Files changed: tres fuentes Edge declaradas; tres pruebas nuevas; fixture focal de test-sicof-exports; auditoría/revisión; evidencia agregada; documentación de autoridad y changelog. Índice derivado se regenera en el checkout aislado de publicación. Ningún archivo frontend, GAS, SQL, SW, Auth o RLS modificado.

Source-of-truth verdict: PASS. Ledger y proyección certificada de Ahorro mantienen autoridad; Excel inmutable aporta referencias históricas. Subtotales incompletos se identifican, sin crear dinero ni interpretar apertura como aportación.

Invariant verdict: PASS. Conservación A:M de 214 históricos; Folio exacto; origen anual/semestral separado; aportaciones antes de retiros; correcciones y reversos ligados; futuros ausentes; original SHA-256 intacto. La lectura real encontró 354 personas, 326 acumulados de capital PARTIAL y 28 por revisar; los 354 rendimientos siguen pendientes de evidencia suficiente para un acumulado completo, nunca inventados como cero o como pagos simulados.

Build: PASS empaquetado/despliegue Edge. La entrega web pública permanece en v312; el build de publicación debe comparar sus 28 archivos byte a byte contra el anterior.

Tests: PASS nueve suites focales, incluyendo 12 grupos del acumulado, 14 de XLSX continuo, 20 de exportaciones, ventanas hasta 2033, reversiones, motor, Edge y préstamos. Lectura real de candidato + descarga del Edge instalado, incluso seleccionando 2026-S1, produce N/O de 2026-S2 al día actual.

Security: PASS. JWT y los mismos controles administrativos/capacidades. Histórico descargable privado; ningún dato personal ni secreto en evidencia pública. Exportación sin escritor financiero.

Legacy impact: sin cambios en Google/Apps Script, fórmulas, préstamos, políticas de rendimiento ni operaciones de Ahorro. Doce tablas financieras idénticas antes/después. Regresión global de imágenes NOT APPLICABLE: sin delta en superficies/shared runtime/frontend.

Unexpected files changed: ninguno en el paquete aislado declarado. El workspace raíz contiene trabajo previo ajeno, expresamente excluido, incluido un bundle distinto del publicado.

Known limitations: la certificación de apertura no acredita la historia bruta previa. PARTIAL significa registros confirmados con tramo/recibos pendientes; POR CONCILIAR conserva la incertidumbre. La nueva vista no repara ni modifica esos antecedentes. Saldo y disponible actuales permanecen canónicos; la liquidación y acreditación continúan en sus procesos autorizados.

Evidence: `docs/qa/evidence/sicof-continuous-report/{focal-tests,independent-review,candidate-live-read,edge-deployment,production-download}.json`; `H-SICOF-CONTINUOUS-REPORT-001-REVIEW.md`. Copias XLSX/contexto/backup v3 conservadas sólo en `.tmp/sicof/continuous-report/` privado.
