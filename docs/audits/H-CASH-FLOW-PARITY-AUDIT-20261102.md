# Auditoria de pantalla y Excel de Flujo de efectivo

Fecha: 2026-11-02, America/Hermosillo.

## Alcance previo

Solicitud del propietario: auditar antes de escribir codigo. Aclaracion: la paridad requerida es entre Panel administrativo / Reporte Flujo de efectivo / Consulta financiera mensual - doce meses y su Excel Flujo mensual. Revisar fuentes, diferencias respecto a conteos JC, orden Inversores/Ahorro, rotulo de Caja de Ahorro, recuperacion futura, bases exportables y eliminacion de la fila 3.

Solo lectura de codigo, Google mediante conector y consultas autenticadas H005_TEST existentes. Cero cambios de runtime, migraciones, despliegues, datos financieros, Google, plantilla o permisos. Archivos de evidencia permitidos: esta auditoria y resumenes privados sin identidades en .tmp/reports-jc/flow-audit-20261102. El verificador focal existente puede generar una descarga privada temporal y su evidencia habitual; conservar copia anterior, trasladar la evidencia nueva al directorio de auditoria y restaurar la anterior. No modificar el verificador. No se autoriza una correccion por el hecho de encontrarla durante esta auditoria.

Navigator: STALE; discovery directo de cash-flow.mjs, cash-flow-consolidated.mjs, cash-flow-contracts.mjs, cash-flow-google.mjs, cash-flow-investors.mjs, reports-jc/report.mjs, reports-jc-repository.js, reports-jc-admin.jsx, cash-flow-report.jsx, cash-flow-export.js y RPC de lectura. El Registry no se toma como fuente runtime ni se regenera en esta auditoria.

Guardians: legacy Google READ ONLY, fuente de verdad Google para solicitudes/cuotas y Supabase para Ahorro/Inversores, seguridad conservando los RPC/Admin existentes. Revision UI limitada a diagnostico y propuesta; no se cambia la experiencia. Sin nueva tabla, cache ni autoridad. Escritura de documento de auditoria y resumenes exclusivamente.

## Resultado de la auditoria

Auditoria terminada; no se implemento ninguna correccion. La paridad numerica pantalla/Excel pasa, pero la conciliacion del flujo futuro con B registrado en Google falla. Esta distincion impide considerar correcto el reporte solamente porque sus dos presentaciones coinciden.

### 1. Pantalla y Excel

Prueba real en sutiapp.com, H005_TEST, 2026-11-02 18:50 Hermosillo: PASS para 103 conceptos por doce meses = 1,236 celdas. El boton Exportar Excel descargo el archivo real; sus cifras, componentes y porcentajes corresponden a la respuesta que usa la pantalla. Cero errores de pagina, mocks o intentos de escritura financiera. Descarga temporal eliminada por el verificador existente.

La pantalla usa state.data y el exportador recibe exactamente ese objeto; no consulta otra base para los valores de Flujo mensual. Ambos seleccionan knownAmount cuando el estado es PARTIAL y amount en los demas casos. La pantalla muestra No aplica / Sin determinar; el Excel convierte ambos a blanco. En la prueba hubo 349 celdas No aplica, 137 Sin determinar y 463 subtotales parciales: 486 blancos no significan 486 faltantes en Google.

Codigo: app/cash-flow-report.jsx:17,49,50,68; app/cash-flow-export.js:47,53,75. Backend: supabase/functions/reports-jc/cash-flow.mjs loadCashFlow. La consulta devuelve doce meses desde el mes inicial, no necesariamente enero-diciembre. Consultas independientes pueden tener cortes distintos; la paridad debe exigirse contra la misma respuesta consultada.

### 2. Error confirmado en cuotas futuras

Lectura independiente del conector Google: SutiApp Final, spreadsheet 1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80, HISTORIAL P V2 sheetId 1245291756. Rangos A1:B20187 y F1:G20187, valores sin formato, agrupacion por fecha A y fondo G, sin deduplicar filas ni eliminar B=0.

| Caja de Ahorro | Filas Google | Suma B Google | Flujo publicado | Diferencia flujo menos Google |
| --- | ---: | ---: | ---: | ---: |
| Noviembre 2026 | 411 | 637,399.67 | 610,260.93 | -27,138.74 |
| Diciembre 2026 | 403 | 522,260.96 | 512,996.52 | -9,264.44 |

Causa: cash-flow-contracts.mjs:179-182 sustituye B futuro con propuestas del motor antes de distribuirlo; cash-flow-consolidated.mjs:98 usa breakdown.B en vez de B registrado para el total. En los cuatro fondos y la ventana 2026 hay 140 registros futuros cuyos importes mostrados difieren de B (441,066.11 registrados frente a 408,408.76 mostrados en esos registros). Esto es un derivado de consulta; no ha modificado Google. El indicador derivedForecastRows=573 es de un alcance mayor y no equivale a los 140 registros incluidos en esta ventana.

La regla vigente del propietario acepta B futuro como monto programado correcto. Por tanto la correccion propuesta conserva ese B como total futuro y separa cualquier simulacion de redistribucion contractual. No requiere alterar pagos, saldos, cuotas ni el motor legacy compartido.

### 3. Blancos de recuperacion programada

Con corte 2026-11-02, enero-octubre son NOT_APPLICABLE para recuperacion futura: esas fechas pertenecen al bloque recuperado. No se puede reconstruir lo que se planeaba al cierre de cada mes pasado a partir de una unica consulta actual; requeriria una fuente historica fechada. No inventar esos cortes.

Noviembre/diciembre SI tienen recuperacion futura y componentes parciales en la respuesta publicada. Ejemplo de noviembre, calculo actual antes de corregir B: capital identificado 379,448.87, intereses 92,093.64, administracion 5,070.00. No son un desglose completo del total y se deben recalcular contra B original tras la correccion. El sistema deja parciales por numero de cuota ambiguo, calendario incompleto o condiciones registradas incompatibles. Actualmente logra distribuir 1,087 de 1,678 prestamos; 591 quedan protegidos para el desglose. No atribuir todos los blancos a una falta de datos ni suplirlos con cero.

Los encabezados oficiales tambien importan: Z=Gasto Admon, AA=TGA, AB=Total Intereses a Pagar, AC=Monto capital + Interes, AD=Capital. AB contiene valores de contrato repetidos, no necesariamente intereses de esa cuota. En Z7433:AG7435 se repiten Z=10, AA=240, AB=7200, AC=22200, AD=625, mientras B de esas filas es 935, 1430.35 y 935. Sumar AB por fila no seria una solucion valida. La lectura actual reconstruye componentes desde condiciones; exportar las bases debe distinguir dato registrado de componente calculado.

### 4. Ahorro Voluntario, Caja de Ahorro e Inversores

No se encontro suma de aportaciones voluntarias dentro de loan_recovered: ese bloque toma cuotas del fondo Caja de Ahorro. Ahorro Voluntario proviene de la RPC get_admin_reports_jc_cash_flow, con historial/recibos y movimientos oficiales de Supabase; los prestamos provienen de HISTORIAL P V2. Inversores usa get_admin_reports_jc_cash_flow_investors, contratos, terminos, movimientos y obligaciones de investors_private. Las condiciones originales de nuevas solicitudes pueden provenir de program_requests.financial_approval_snapshot por el lector contractual existente.

El rotulo es erroneo y confuso: cash-flow-consolidated.mjs:46 asigna literalmente Ahorro Voluntario y Caja de Ahorro al bloque loanSavings. Debe cambiar a Caja de Ahorro · Recurso de ahorradores, conforme a la instruccion expresa. Esto no supone identificar una cuenta bancaria por prestamo ni usar el saldo ahorrado como efectivo disponible.

Orden vigente comprobado: Ahorro Voluntario fila 6; Caja de Ahorro 18, subtitulo 19; Sutiexpress 33; Caja Chica 48; Adelantos 63; Inversores 78, subtitulo repetido 79. El orden deriva del orden de insercion de las filas del servidor. Pantalla y Excel consumen ese orden.

Orden propuesto para ambos: Inversores, Caja de Ahorro, Sutiexpress, Caja Chica, Adelantos de nomina, Ahorro Voluntario; conservar despues los demas bloques existentes. Mover secciones completas mediante identificadores, no indices de fila. Eliminar del Excel la fila 3 solicitada, recalculando posiciones, combinaciones, referencias y paneles congelados. Las filas finales variaran; no convertir 6/78 en referencias de negocio. Usar Sutiexpress como nombre ya indicado por el propietario.

### 5. Relacion con los conteos JC anteriores

Control secundario: los tres reportes de membresias conservan 177 atenciones y se verificaron 24 comparaciones mensuales sin discrepancias. Caja Chica octubre conserva 478 filas Google, dos JUB y 21 cuotas cero.

No son magnitudes intercambiables: JC cuenta filas de descuento o solicitudes por fecha J; el flujo suma cuotas B por A y cuenta prestamos colocados por fecha AE y contrato C/D. Ejemplo enero: JC tiene 11 solicitudes aprobadas de Caja de Ahorro; el flujo muestra nueve prestamos con transferencia identificada (subtotal parcial). El segundo no puede presentarse como total de solicitudes ni forzarse a once cambiando la fecha del dinero. El flujo actual incluye cuatro fondos de prestamo y no incorpora Vales y membresias como flujo; 177 solicitudes, incluidas pendientes, no equivalen a efectivo. La aclaracion posterior del propietario enfoca esta H en paridad pantalla-flujo/Excel-flujo, sin ampliar silenciosamente programas monetarios.

### 6. Sustituir Detalle y Notas por bases de origen

Los 67,316 registros de Detalle son derivados, componentes y cortes repetidos para trazabilidad. No equivalen a 67,316 movimientos originales. No basta renombrar esa pestaña.

Propuesta de exportacion, bajo el mismo permiso Admin y la misma consulta:

- Flujo mensual: cifras del mismo resultado visible; sin fila 3.
- Base PV2: filas originales necesarias, columnas leidas con sus nombres originales, libro/hoja/fila, ID/folio como texto, fechas y B registrados, fondo/proceso y condiciones utilizadas. Incluye antecedentes necesarios para los saldos, aunque sean de otro año.
- Base Solicitudes: filas efectivamente usadas para identificar contratos y fechas, conservando estado/proveedor si se usan para conciliacion con JC. No ampliar a columnas bancarias o documentos ajenos al calculo.
- Base Ahorro: recibos, movimientos, importados oficiales, planes y referencias necesarias para reproducir aportaciones, retiros, programacion y saldos; mantener separados los originales de las proyecciones.
- Base Inversores: contratos/condiciones, movimientos vigentes y obligaciones que sustentan los importes; identificacion de correcciones sin duplicar el movimiento sustituido.
- Base Contratos y calculo: condiciones y distribuciones efectivamente utilizadas, marcadas como calculadas, enlazadas a los registros de origen; ningun derivado presentado como una fila cruda de Google.

Cada base debe incluir procedencia, fecha de consulta/corte, identificador, valor original, valor calculado cuando aplique, periodo, concepto/celda destino, inclusion/exclusion y motivo. Una relacion de contribuciones permite rastrear subtotales sin duplicar la fila cruda cuando sirve a varias celdas. Las incidencias deben conservarse en campos de las bases y comentarios de celda, sin mantener una pestaña Notas ni el texto eliminado de fila 3. Usar escritura como texto para literales que parezcan formulas. No exportar una copia completa e indiscriminada de Supabase: solo las bases y antecedentes de este reporte.

Hoy el backend descarta parte de las entradas originales al formar el resultado; para materializar esta propuesta sera necesario ampliar el contrato de lectura y el exportador, manteniendo proteccion Admin y minimizacion. No se hizo en esta auditoria. Las bases deben pertenecer a la misma consulta que la matriz; descargarlas de una segunda consulta permitiria diferencias por cambios concurrentes.

## Plan de correccion posterior y aceptacion

1. Conservar B/A/G originales para cobrado/programado, incluidas filas con cero; limitar la modificacion al adaptador de este reporte. Derivar componentes sin reemplazar el monto registrado y explicitar cualquier parte no distribuible.
2. Aplicar orden y etiquetas una sola vez para pantalla y Excel; preservar filtros, doce meses, detalle, navegacion y acceso.
3. Transportar las bases originales usadas y sus relaciones dentro de la respuesta autorizada, sin cache alterna ni nuevo escritor financiero.
4. Sustituir Detalle/Notas y eliminar fila 3; conservar estados y trazabilidad en las bases y comentarios.
5. Verificar todos los fondos/meses: conteos frente a filas, montos frente a suma B, recuperado/programado por fecha, componentes mas parte sin distribuir igual al total, y ninguna duplicidad entre fuentes. Exigir diferencias de cero al centavo entre Google registrado, resultado, pantalla y Excel para magnitudes equivalentes.
6. Repetir prueba real de pantalla/descarga; comprobar que ordenar o quitar una fila no cambia importes. Mantener intacto el libro JC original de 17 pestañas: el cambio de pestañas corresponde solamente al archivo de flujo.

Alcance probable: cash-flow-consolidated.mjs, adaptador cash-flow-contracts.mjs, cash-flow.mjs/cash-flow-google.mjs para preservar entradas; cash-flow-report.jsx y cash-flow-export.js; pruebas focales. Un lector SQL adicional o ampliado solo si se demuestra necesario para exponer bases; auditarlo por separado antes de producir una migracion. No modificar motor PV2, tablas financieras, Google ni workflows. Esta lista es un plan, no cambios ejecutados.

## Evidencia y cierre

H-CASH-FLOW-PARITY-AUDIT-20261102 RESULT

- Status: PASS para auditoria completada; FAIL de conciliacion futura del producto documentado, pendiente de correccion.
- Files changed: este documento, resumenes privados y evidencia del verificador existente docs/qa/evidence/cash-flow-criteria/browser-live-production.json (no existia archivo previo en esta ruta). Cero archivos de implementacion modificados.
- Source-of-truth verdict: Google/Supabase siguen siendo autoridades; hallada sustitucion derivada de B futuro dentro del reporte.
- Invariant verdict: paridad pantalla/Excel PASS; montos futuros frente a Google FAIL. Datos originales intactos.
- Build: NOT APPLICABLE, no implementacion. Diez hashes locales coinciden con manifiesto desplegado reports-jc v10; bundle publico comprobado 96813e4a7a5c6a83920abee667d9f5c0e5c92177e02359338ad4278479591e9b.
- Tests: prueba focal real de navegador y descarga PASS, 1,236 celdas, 103 conceptos, doce meses; sumas independientes Google y lectura HTTP autenticada.
- Security: cero escrituras financieras/intentos bloqueados, cero datos personales o tokens en evidencia, sin cambios de permisos. Las consultas HTTP directas cerraron su propia sesion; el verificador existente cerro su navegador aislado.
- Legacy impact: READ ONLY. No activacion de motor, Google, formulas, triggers ni Apps Script.
- Unexpected files changed: ninguno del runtime. No habia evidencia previa de navegador en la ruta esperada; el intento de copia devolvio archivo ausente y no altero otro archivo.
- Known limitations: no se dispone de un historico de planes por cada cierre mensual; no se ha implementado el transporte de bases originales ni solucionado cada contrato sin desglose. La auditoria no declara esas correcciones terminadas.
- Evidence: .tmp/reports-jc/flow-audit-20261102/live-summary.json, google-summary.json, browser-live.json; lectura puntual A1:AI2 y Z7433:AG7435 por conector. Prueba: scripts/verify-cash-flow-criteria-browser-live.js production, con hash publicado esperado.

## SUTIAPP ARCHITECT REVIEW

Task: auditoria previa, no implementacion.
Verdict: APPROVED como auditoria; no aprobacion del calculo defectuoso.
Critical findings: recalc B futuro, blancos de dos estados diferentes, rotulo incorrecto y ausencia de bases originales en el contrato exportable.
Source of truth: preservar A/B Google y movimientos Supabase; derivados etiquetados.
Architecture: una respuesta consultada para pantalla, matriz exportada y bases.
Security: mismo Admin, sin acceso generico a tablas ni datos ajenos.
Data: no deduplicar cuotas ni mezclar solicitudes/cantidades con importes; no inventar componentes ni cortes.
Legacy: intacto.
Owner decision: NO para concluir y entregar esta auditoria. No reabrir la regla vigente de B programado.
Next action: presentar hallazgos y propuesta al propietario; ninguna implementacion automatica dentro de la auditoria solicitada.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Cerrar la auditoria con los resultados comprobados y la propuesta. Informar expresamente la paridad lograda y la diferencia real con Google. No declarar corregido el flujo ni escribir codigo productivo en esta fase.
