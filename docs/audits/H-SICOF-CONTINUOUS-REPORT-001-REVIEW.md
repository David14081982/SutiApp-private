# ARCHITECT REVIEW

Estado vigente: **APPROVED ? Edge v4 y descarga productiva verificados**. La adenda final al pie actualiza la revisi?n previa al despliegue; la publicaci?n documental en Git contin?a pendiente.

Task reviewed: H-SICOF-CONTINUOUS-REPORT-001 — candidato de exportación acumulada semestral.

Verdict: **APPROVED — revisión técnica previa al despliegue**.

Fecha: 2026-10-03. Línea base contrastada: `94158a6a7005cd113517e77a30212217414b41c5`, aplicación v312. Esta aprobación no afirma publicación ni descarga productiva del correctivo. Esos gates permanecen a cargo del cierre de la H.

## Alcance e independencia

Revisión de lectura realizada por un agente distinto de los implementadores de este correctivo, conforme a `sutiapp-architect-reviewer`. Autoridad y archivos previstos constan en [la auditoría previa](H-SICOF-CONTINUOUS-REPORT-001.md). Se contrastaron el código publicado, los tres archivos de ejecución modificados, los tres tests nuevos, la adaptación de la prueba de exportaciones existente y los contratos SQL instalados, sin ejecutar SQL ni consultar producción.

El revisor sólo escribió esta revisión, su evidencia sanitizada y notas privadas del manual. No modificó código de producto, movimientos, Google, credenciales, sesiones ni despliegues. `WORK_QUEUE.md` corresponde al plan maestro y no concede una autorización nueva para sus fases; `WORK_QUEUE_HISTORY.md` no existe. Esta H se sustenta en la solicitud específica documentada, no en una continuación inferida de aquella cola.

## What Codex did correctly

- La hoja principal es `Informe acumulado`, primera y activa también en el XML real del XLSX. Conserva A:M como valores históricos, sus estilos y el orden original de personas. La descarga original conserva exactamente sus bytes y `Hoja1` mantiene sus valores, fórmulas y estilos dentro del libro ampliado.
- N2 es `2026 2DO SEMESTRE AHORRO`; O2 es `2026 REND. 2DO SEMESTRE`. P/Q aparecen desde el 1 de enero de 2027; cada pareja posterior requiere que el semestre haya comenzado según la fecha del servidor. El año/semestre elegido conserva su efecto sobre `Informe vigente`, sin truncar la continuidad de la hoja nueva.
- Las aportaciones se acumulan por fecha comprobada de contribución, antes de retiros y después de sus correcciones/reversiones. Sólo créditos reales de rendimiento, netos de reversos, entran por su periodo de origen. Un abono de un semestre anterior no reaparece como rendimiento del semestre de pago ni se suma otra vez al histórico.
- La apertura certificada se mantiene como saldo, nunca como aportación bruta. El historial certificado aporta sólo celdas comprobadas dentro de su corte; `includes_yield`, conflictos, duplicados y solapamientos no se convierten en capital. Los tramos incompletos muestran estado parcial y los desconocidos permanecen sin importe.
- `Retiros y saldo acumulado` separa entregas netas, cobertura, subtotales comprobados, saldo y disponible canónicos. Las retenciones o rendimientos simulados no se insertan en esas cifras reales.
- El handler amplía la lectura desde julio de 2026 hasta hoy mediante el mismo RPC autorizado. Las ventanas cumplen `p_to <= p_from + 1098`, no se superponen y conservan el último ledger completo. Para varias ventanas, vuelve a comprobar contexto, huella y participantes; no mezcla observaciones cambiadas silenciosamente.

## Important findings

Dos defectos encontrados por esta revisión quedaron corregidos y comprobados:

1. **CR-01 — retiros anteriores a la apertura sin evidencia.** Una apertura el 6 de septiembre devolvía cero retirado desde el 1 de julio aunque ese tramo anterior no estuviera demostrado. Ahora el total del intervalo permanece desconocido, la cobertura es parcial y el subtotal efectivamente registrado ocupa campos separados. La hoja real presenta `POR CONCILIAR`, cobertura y subtotales con encabezados distintos.
2. **CR-02 — reversión sin categoría demostrada.** Una reversión sin original, o con ciclo, podía dejar aparentemente completo el total de retiros. Ahora invalida ese neto y conserva revisión explícita. No se asume que la reversión era una aportación ni que los retiros fueron cero.

Se verificó además `composition.as_of_complete === true` y `composition.as_of === today` contra el contrato de `savings_period_private.composition`. La disponibilidad global canónica puede conocerse aunque la asignación histórica por semestre siga incompleta; no se confunden ambos estados.

## Problems detected

No quedan defectos bloqueantes en los archivos del candidato revisado. Persisten límites de evidencia financiera, presentados expresamente: un saldo certificado de septiembre no demuestra todos los aportes, rendimientos o retiros brutos de julio/agosto. Los subtotales parciales no se presentan como semestres completos. Los ceros de rendimiento históricos permanecen intactos y no se les atribuye una causa de exclusión por suposición.

El resumen monetario histórico de A:M conserva el corte del Excel original. El saldo actual se consulta en los respaldos de saldo/disponible; no debe sumarse de nuevo A:M al saldo canónico. El manual debe explicar esa diferencia.

## Architecture implications

El cambio añade una proyección y dos hojas derivadas al exportador. No incorpora tablas, migraciones, writers financieros, repositorios alternativos ni dependencia productiva nueva. `makeReports`, las proyecciones de préstamo y `workspaceView` quedaron byte a byte idénticos al retirar únicamente el helper nuevo.

Se comprobó identidad byte a byte con la línea base de `engine.mjs`, `loan-source.mjs`, `loan-calculation.mjs`, `index.ts`, `app/sicof-admin.jsx`, `app/sicof-repository.js`, `sw.js` y el receptor Google. El `app/bundle.js` del workspace general contiene divergencia previa ajena a esta H; no forma parte del paquete aprobado y no debe publicarse junto con este correctivo. No se requiere regenerar frontend ni service worker. La regresión global visual es `NOT APPLICABLE` al delta focal revisado.

## Source-of-truth implications

Continúan como autoridades el ledger y las proyecciones canónicas de Ahorro en Supabase, más el historial certificado autorizado para su tramo anterior al ledger. El Excel privado es evidencia histórica inmutable, no un segundo abono. Las columnas nuevas son un informe derivado y no una cuenta paralela. No hay fallback de producción a mocks, navegador, JSON público ni importes simulados.

La recuperación de resultados de fórmula histórica que ExcelJS omite cuando valen cero usa el snapshot privado del mismo original validado; no inventa ceros ni cambia la fórmula original. La comprobación real incluye las 214 filas históricas.

## Security implications

Se conserva la autorización backend, el permiso de exportación y el contexto de actor/sesión. Las ventanas adicionales usan el mismo RPC y rechazan cambios de permiso, sesión, plantilla o fuente. No se introduce login alternativo, secreto en frontend ni acceso público al Excel. Las pruebas ejercitan escape de CSV/HTML y conservación de identidad textual; ninguna realizó escrituras externas.

## Data implications and verification

Pruebas ejecutadas independientemente contra los archivos congelados, todas con código de salida 0:

| Comando | Evidencia |
|---|---|
| `node scripts/test-sicof-continuous-report.js` | PASS, 12 grupos: calendario, Folio exacto, aportaciones brutas, orígenes, reversos, apertura parcial, ambigüedad y preservación del informe anterior. |
| `node scripts/test-sicof-continuous-handler.js` | PASS: corte servidor, ventanas hasta 2033, intervalo anterior preservado y rechazo de deriva. |
| `node scripts/test-sicof-continuous-export.js` | PASS, 14 grupos sobre XLSX real, incluido helper→Excel, cobertura de retiros y hoja activa en ZIP. |
| `node scripts/test-sicof-exports.js` | PASS, 20 grupos: CSV, matriz, formulado, acta, liquidez, 214 históricos, bytes originales y rechazo de cambio histórico. |
| `node --check` sobre los tres archivos de ejecución | PASS. |

Las pruebas de exportación se repitieron tras congelarse el último ajuste de presentación para asociar el resultado a los hashes finales, no a un candidato anterior.

| Archivo de ejecución | SHA-256 aprobado |
|---|---|
| `supabase/functions/sicof/projection.mjs` | `d45d01d13f187a1496922e7c606f4f5a36ea3f81e15d247665d1d65371687542` |
| `supabase/functions/sicof/exports.mjs` | `9fbc3b70731860df7a3cdcd1d22a4dfbefef20a778aab42d43b780fa1fcee792` |
| `supabase/functions/sicof/handler.mjs` | `30e4e2af1d065a4b4a9d1cb9b80e573e246139aac8430234c58e8b72f01d1779` |

Hashes de los cuatro tests y resultados sanitizados: [independent-review.json](../qa/evidence/sicof-continuous-report/independent-review.json). Contratos de referencia: `20261001000200_savings_admin_workspace.sql:55`, `20261003000100_savings_period_composition.sql:127` y `20261003000200_sicof_workspace.sql:82`. No se modificó ninguno.

## Owner decision required

**NO.** La corrección mantiene las autoridades y el alcance solicitado. Esta revisión no aprueba una tasa, una excepción individual, una acreditación ni una nueva política de rendimiento.

## Recommended next action

Completar la regresión focal de la raíz y publicar únicamente el candidato backend autorizado. Después, comprobar una descarga autenticada real: hoja inicial, encabezados, continuidad, incertidumbre, saldos y original con hash exacto. Registrar evidencia agregada sin filas personales. Actualizar el manual con el resultado verificado y cerrar la H sólo tras esos gates. No incorporar el bundle general ni otras modificaciones coexistentes.

# RESPONSE TO CODEX

Se aprueba el candidato técnico de H-SICOF-CONTINUOUS-REPORT-001 con los hashes anteriores. Continúa únicamente con la verificación y publicación focal ya autorizadas en su auditoría, sin SQL, Google, nuevas operaciones financieras ni frontend. Mantén explícitos los totales desconocidos y los subtotales parciales. Verifica la descarga productiva y el original privado, incorpora la evidencia y termina el manual solicitado. Esta instrucción de revisión no sustituye la autorización existente ni habilita otras fases de WORK_QUEUE.

# SUTIAPP ARCHITECT REVIEW

Task: H-SICOF-CONTINUOUS-REPORT-001, candidato previo al despliegue.

Verdict: **APPROVED**.

Critical findings: CR-01 y CR-02 corregidos y verificados; ninguno pendiente en el candidato.

Source of truth: conservada. Architecture: proyección/exportación focal. Security: autorización backend preservada. Data: histórico intacto, nuevas cifras trazables y certeza explícita. Legacy: sin cambios de Google ni writers financieros.

Owner decision: **NO**.

Next action: publicación focal autorizada, descarga real, evidencia y manual; no se afirma que hayan ocurrido.

Response generated for Codex: **YES**.

## Adenda independiente de cierre productivo ? 2026-10-03

Verdict: **APPROVED** para el correctivo desplegado de H-SICOF-CONTINUOUS-REPORT-001. Esta adenda no afirma que se haya realizado el push documental en Git, ni acredita o aprueba rendimientos.

Se contrastaron los cuatro registros sanitizados del cierre, el script que los genera y los hashes de los tres archivos de ejecuci?n contra la revisi?n aprobada. La [regresi?n focal](../qa/evidence/sicof-continuous-report/focal-tests.json) registra nueve comandos con salida 0. El [despliegue](../qa/evidence/sicof-continuous-report/edge-deployment.json) y la comprobaci?n posterior confirman Edge SICOF v4, estado ACTIVE y verificaci?n JWT activa. Los hashes corresponden a projection d45d01d1?, exports 9fbc3b70? y handler 30e4e2af?, ?ntegramente identificados en la tabla anterior y en la evidencia JSON.

La [descarga productiva autenticada](../qa/evidence/sicof-continuous-report/production-download.json) se realiz? eligiendo 2026-S1 y abri? en Informe acumulado con N/O de 2026-S2. Esto demuestra que la continuidad llega al d?a del servidor y que Informe vigente conserva el intervalo elegido. Se mantienen Hoja1, Informe vigente, Periodos, Movimientos, Saldos y disponible, Retiros y saldo acumulado, Notas del informe y Fuentes y alcance. La descarga original dio nuevamente SHA-256 e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837.

Este revisor tambi?n abri? localmente, en s?lo lectura, la copia del XLSX realmente descargado y comprob? que su SHA-256 es 6a8fef90ef619087e1aca466c878e3e1af79ad96a07342aa67b62a8ac8a7b651, coincidente con el registro productivo. Confirm? primera hoja y pesta?a activa, N2/O2 exactos, P2 vac?o, 354 personas y los valores A:M completos de los 214 hist?ricos contra el snapshot privado original. Las celdas hist?ricas conservan incluso su tipo escalar original; las identidades nuevas siguen siendo texto. No se imprimieron nombres, folios ni saldos individuales en la evidencia.

Los estados de certeza coinciden con la [lectura real candidata](../qa/evidence/sicof-continuous-report/candidate-live-read.json): 326 celdas de ahorro son subtotales PARTIAL num?ricos en ?mbar y 28 permanecen POR CONCILIAR. Las 354 celdas de rendimiento siguen POR CONCILIAR. No son 354 exclusiones ni rendimientos reales de cero. En 328 filas con cobertura parcial de retiros, el total del intervalo conserva POR CONCILIAR y el subtotal registrado permanece separado. La ampliaci?n de PARTIAL hace visibles hechos comprobados, sin afirmar un semestre completo ni cambiar la elegibilidad de rendimiento.

Se inspeccion? adem?s la comprobaci?n de conservaci?n del release: compara antes/despu?s el conteo y la huella del contenido completo de doce tablas financieras protegidas y falla si existe diferencia. La ejecuci?n registrada pas? esa igualdad, con cero escrituras financieras; no se alteraron reglas, SQL, Google ni datos para hacer pasar la descarga. La revisi?n no ejecut? nuevas consultas productivas ni nuevas sesiones.

No quedan hallazgos t?cnicos bloqueantes en el correctivo desplegado. Las incertidumbres de datos hist?ricos contin?an visibles; no se resolvieron inventando transacciones o saldos. La recepci?n documental en Git y el manual solicitado corresponden a la continuaci?n de la ra?z, sin cambios de runtime adicionales.

# RESPONSE TO CODEX ? cierre

Se aprueba el correctivo t?cnico y su verificaci?n productiva. Conserva los hashes desplegados y la evidencia de incertidumbre; incorpora el recibo documental autorizado y termina el manual, sin volver a desplegar ni alterar datos por este cierre. No declares un push de Git ni la entrega del manual hasta tener sus resultados reales. Esta revisi?n no habilita otras fases ni una aprobaci?n financiera.

# SUTIAPP ARCHITECT REVIEW

Task: H-SICOF-CONTINUOUS-REPORT-001, correctivo de exportaci?n desplegado y comprobado.

Verdict: **APPROVED**.

Critical findings: CR-01 y CR-02 cerrados; incertidumbre de datos correctamente visible.

Source of truth: conservada. Architecture: delta focal. Security: JWT y permisos vigentes. Data: doce tablas protegidas intactas; hist?rico y estados verificados en el XLSX real. Legacy: sin cambios de Google o writers.

Owner decision: **NO**.

Next action: recibo documental de Git y entrega del manual; ambos sin afirmaci?n anticipada.

Response generated for Codex: **YES**.
