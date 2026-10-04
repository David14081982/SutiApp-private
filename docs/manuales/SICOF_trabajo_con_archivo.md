# SICOF: trabajo con un archivo de préstamos

Adenda operativa de H-SICOF-FILE-WORKFLOW-001. Complementa el [manual PDF](Manual_de_uso_SICOF.pdf) y el [manual Word](Manual_de_uso_SICOF.docx); sustituye sus instrucciones de carga inicial y consultas por cada cambio de parámetros. La publicación y sus verificaciones se registran en la [auditoría del cambio](../audits/H-SICOF-FILE-WORKFLOW-001.md).

## Preparar la información

1. Abre SICOF y elige las fechas y la fuente de la bolsa. La apertura no solicita el workspace financiero ni inicia lecturas de ahorro o préstamos; conserva la validación habitual de acceso. «Caja de Ahorro» usa ese fondo; «Fondos seleccionados» incluye Caja de Ahorro y los fondos adicionales elegidos; «Todos» incluye todos los fondos. Consultar la lista de fondos adicionales es una acción explícita.
2. Descarga la base. El XLSX contiene una sola hoja, **HISTORIAL P V2**, con las quince columnas originales **A:O**, sus tipos de valor y todas las filas del fondo y periodo elegidos, incluidas ambas fechas límite. Se conserva el orden de origen, incluso las filas repetidas o con incidencias. La fecha de amortización determina el periodo; no equivale a una fecha comprobada de recepción bancaria. Descargar no calcula el reparto.
3. Carga ese archivo para preparar el escenario. Debe conservar los encabezados, el orden y los valores originales. SICOF contrasta todas sus filas con la observación vigente de Google y rechaza diferencias, filas faltantes, otras hojas, fórmulas, enlaces externos o archivos que excedan el límite admitido. Si la fuente cambió, descarga de nuevo y vuelve a preparar el escenario.

La preparación consulta una vez el contexto autorizado de ahorro en Supabase y utiliza una observación autorizada de los préstamos. A:O no contiene todos los gastos administrativos, estados actuales y antecedentes necesarios: SICOF incorpora esos datos desde esa misma observación canónica. No supone que un gasto ausente sea cero. Los pagos y totales de la bolsa quedan limitados al archivo; el historial completo de préstamos se conserva aparte para determinar comportamiento y retenciones.

## Cambiar parámetros y consultar resultados

Después de preparar el archivo, los parámetros compatibles se calculan en memoria con el mismo motor financiero, sin consultar otra vez las fuentes. Se mantienen las ocho secciones y las políticas vigentes. El porcentaje de reparto, los costos y las reglas no acreditan ni entregan dinero.

La simulación conserva el inicio y el corte efectivo de ahorro (`as_of`) con los que se preparó. Puede acortar un cierre futuro dentro del intervalo del archivo si mantiene ese corte efectivo; un periodo histórico conserva su corte original. Los fondos elegidos deben estar contenidos en el archivo. Para cambiar el inicio, usar otro corte histórico o ampliar fechas o fondos, prepara explícitamente otro archivo y su contexto. Cuando una política exige semestre completo, esa exigencia continúa aplicándose.

El archivo preparado es una **fotografía fechada para simular**. Puede seguir consultándose aunque venza la copia Google de cinco minutos; esto no significa que sus datos sigan actualizados. Se muestran el nombre del archivo, las fechas de observación de préstamos y ahorro y la fecha de preparación. Internamente, la huella de contenido valida los valores A:O y la huella de los bytes identifica el archivo recibido. Cambiar de archivo, sesión o contexto elimina la preparación anterior. No se guarda en localStorage, sessionStorage ni IndexedDB y no se actualiza mediante consultas periódicas del navegador.

## Descargar resultados y guardar escenarios

La descarga local de la base conserva una sola hoja A:O y aplica las fechas y fondos compatibles al archivo preparado. Representa esa fotografía, no una consulta nueva a Google.

Guardar un escenario y exportar reportes que requieren validación del servidor vuelven a comprobar permisos, contexto actual, fuente, contenido del archivo y huellas del cálculo. El servidor reconstruye y calcula los resultados; no confía en importes enviados por el navegador. Si el cierre guardado cambió, obtiene además el contexto canónico de ese periodo exacto. Un cambio o vencimiento de fuente puede impedir la operación y exigir una nueva preparación, aunque la simulación anterior siga visible.

Google conserva la autoridad de préstamos y Supabase la de ahorro, rendimientos acreditados y retiros. Este flujo no modifica el histórico ni crea otra contabilidad. Guardar un escenario registra una simulación; los movimientos de dinero mantienen sus procesos y autorizaciones existentes.
