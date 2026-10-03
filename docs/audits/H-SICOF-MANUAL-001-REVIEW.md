# H-SICOF-MANUAL-001 — revisión documental independiente

## ARCHITECT REVIEW

Task reviewed: manual de uso y procedencia de SICOF, edición 1.0.

Verdict: **APPROVED**, exclusivamente para el contenido y los archivos documentales identificados abajo.

Fecha: 2026-10-03. Skill aplicada: `.agents/skills/sutiapp-architect-reviewer/SKILL.md`.

La revisión es independiente de la redacción y generación del PDF/Word. Este revisor participó en la implementación de la exportación; esta aprobación documental no sustituye la revisión independiente del código de H-SICOF-CONTINUOUS-REPORT-001 ni acredita su despliegue. La publicación y descarga real de esa corrección corresponden a su auditoría y evidencia propias.

### Solicitud, alcance y autoridad

Se solicitó un manual en español que explique el uso del módulo y de dónde proviene cada dato. La posterior corrección autorizada del Excel continuo debe quedar descrita en la misma edición. Se cotejó la interfaz publicada v312 del checkout `94158a6a7005cd113517e77a30212217414b41c5`, sus lectores y motor V2, con el contrato final de la exportación continua y las pruebas de lectura/escritura ExcelJS.

El manual es documentación, no autoridad monetaria. No hubo login, modificación de cuentas, preferencias, escenarios, Google, Supabase ni despliegue como parte de esta revisión. La escritura se limita a este informe; las imágenes y notas auxiliares son locales.

Se contrastaron AGENTS, la auditoría de la H, las autoridades e invariantes aplicables de Ahorro/SICOF, el gobierno de históricos, seguridad y legacy, y los documentos y evidencias indicados. `WORK_QUEUE_HISTORY.md` no existe; `WORK_QUEUE.md` corresponde al plan maestro financiero y no autoriza un avance nuevo de esta H. La petición expresa y la asignación del coordinador sustentan esta revisión; no se infiere autorización para otras tareas.

### What Codex did correctly

- Explica las ocho pestañas, controles de periodo/fuente/base, participación de rendimientos anteriores, reglas, costos, liquidez, filtros, detalle individual, comparación de pagos, escenarios, descargas y clasificación de origen.
- Separa interés de capital y gasto administrativo; cobro registrado de proyección; simulación de acreditación; saldo canónico de disponible; cero comprobado de información pendiente.
- Conserva 2025 como evidencia histórica. No atribuye una política específica a un rendimiento cero, no acredita otra vez sus importes ni deduce una fecha o identidad por nombre.
- Explica A:M histórico, encabezados literales N/O de 2026-S2, P/Q de 2027-S1 únicamente cuando comienza el semestre, corte del servidor y aportaciones acumuladas antes de retiros.
- Distingue el acumulado principal del reporte vigente por intervalo y de los respaldos. Documenta el estado parcial, los comentarios ámbar, retiros con cobertura incompleta y subtotales registrados separados del total desconocido.
- Precisa que descargar ahorro sin Google sigue requiriendo red, sesión, permisos y Supabase. No promete funcionamiento offline.
- Explica qué acciones persisten y cuáles sólo consultan o simulan, incluida la clasificación de origen que sí guarda información real sin modificar el importe del movimiento.

### Important findings / Problems detected

Los hallazgos documentales detectados durante la revisión quedaron corregidos y verificados en los archivos finales:

| Hallazgo | Resolución comprobada |
| --- | --- |
| La sección 1 afirmaba que podían renombrarse las pestañas. | Aclara que las ocho etiquetas quedan fijas; se personalizan textos interiores y orden. Coincide con `app/sicof-admin.jsx:6` y `:393` del baseline. |
| Entrega simulada se describía como suma sólo de casos conocidos. | La sección 10 aclara que una entrega individual desconocida deja el total pendiente. Coincide con `engine.mjs:192`. |
| Faltaba explicar cómo editar/guardar textos y distinguir la tabla visible del Excel horizontal. | Secciones 11 y 16 incluyen el procedimiento, cierre sin guardar y columnas reales de la tabla, con apertura del detalle y disponible global. |
| La incertidumbre de retiros anteriores al registro podía confundirse con cero. | Secciones 17 y 19 explican Cobertura de retiros, subtotales separados y POR CONCILIAR. |
| PARTIAL puede deberse también a recibos pendientes y no sólo a historia anterior incompleta. | Sección 17 coincide con `projection.mjs:266` y con el comentario de `exports.mjs:294`: sólo suma registros comprobados, sin presumir el pendiente como pagado. |

No quedan defectos documentales abiertos en el alcance revisado. La frase fija de la UI sobre `% s/saldo` tiene una imprecisión ya identificada; el manual la advierte y explica la fórmula efectiva según el método, sin afirmar que la pantalla fue modificada.

### Evidencia de contraste

- Interfaz y repositorio: `app/sicof-admin.jsx`, `app/sicof-repository.js`, `app/sicof-payment-behavior.jsx` del checkout publicado. Se cotejaron etiquetas, persistencia, controles, errores, detalles, selección de escenarios y descargas.
- Motor: `supabase/functions/sicof/engine.mjs`, especialmente elegibilidad triestado, reparto, desconocidos, costos y liquidez. Los ejemplos aritméticos del manual se recalcularon: bolsa 8,300; promedio 13,342.54; reparto 800/1,200; saldo tras retiro 700.
- Informe: `projection.mjs:76` y `:121`, `exports.mjs:242`, `handler.mjs:68`; origen de los importes, corte Hermosillo, estados, hojas, encabezados y filtros.
- `node scripts/test-sicof-continuous-export.js`: PASS, 14 grupos, ExcelJS real y helper real; hoja primera/activa, A:M, estilos, ceros, futuras columnas ausentes, retiros separados, PARTIAL, recibos pendientes y reversión incierta.
- `node scripts/test-sicof-exports.js`: PASS, 20 grupos; 214 filas originales preservadas y descarga histórica byte idéntica. No hubo escrituras financieras ni Google. La antigua etiqueta del test «offline» describe independencia del cálculo/Google; el manual aclara correctamente que una nueva descarga requiere conexión.
- Lectura propia del ZIP/XML del DOCX: 24 títulos de sección y todos los encabezados N/O/P/Q exactos presentes; 22 tablas. El texto extraído del PDF contiene los mismos 24 títulos y encabezados.
- Verificación propia SHA-256 y tamaño de ambos archivos contra `docs/qa/evidence/sicof-manual/document-generation.json`: PASS. PDF de 25 páginas.
- Inspección visual directa de portada, cierre y páginas 17–20 del PDF: texto legible, tablas completas, sin recorte ni solapamiento; las páginas 17–20 corresponden a las secciones 16–19. El índice remite a secciones, y su numeración coincide.

| Archivo final | Bytes | SHA-256 |
| --- | ---: | --- |
| `docs/manuales/Manual_de_uso_SICOF.pdf` | 137491 | `62a962deea7e6e51963d6ef96e89303a549386f91d98319d27c445400aeca955` |
| `docs/manuales/Manual_de_uso_SICOF.docx` | 56556 | `05245fe9c40191e0018b0dedc384ab4b70347b43c6d57cb03e088a828f8fce96` |

### Implicaciones y límites

Architecture implications: no modifica producto, dependencias, rutas ni contrato visual.

Source-of-truth implications: el manual identifica el ahorro canónico, la hoja Google fija, el Excel privado inmutable y los supuestos declarados; no crea autoridad alternativa.

Security implications: distingue permisos de consultar, configurar, descargar y clasificar; no incorpora credenciales, datos individuales ni direcciones privadas. Mantiene acceso administrativo y ausencia de contraseña adicional.

Data implications: ejemplos explícitamente ficticios; no se reconstruyen saldos, causas de exclusión o periodos sin evidencia. Las discrepancias de conciliación permanecen visibles.

Owner decision required: **NO**.

Build y regresión de aplicación: **NOT APPLICABLE** a esta revisión documental. Las pruebas focales de exportación se citan para contrastar el manual y pertenecen a la H de corrección. No se atribuye a esta revisión una nueva prueba de producción.

Recommended next action: conservar estos archivos exactos, completar el cierre independiente de la corrección continua con su evidencia de publicación/descarga, y entregar los enlaces de PDF y Word. Si cambia el comportamiento antes de la entrega, actualizar sólo los pasajes afectados y repetir el contraste documental.

## RESPONSE TO CODEX

Aprobado el contenido documental de H-SICOF-MANUAL-001 con los hashes indicados. No cambies código, saldos, políticas ni fuentes como consecuencia de esta revisión. Mantén separada la evidencia de publicación del informe continuo. Tras cerrar esa H con sus verificaciones propias, entrega el manual PDF y el Word editable y registra la evidencia documental final. Esta instrucción no autoriza otra fase del plan maestro ni una escritura financiera.

## SUTIAPP ARCHITECT REVIEW

Task: H-SICOF-MANUAL-001.

Verdict: **APPROVED** documental.

Critical findings: ninguno abierto; correcciones descritas arriba comprobadas.

Source of truth: PASS. Architecture: PASS. Security: PASS. Data: PASS. Legacy: sin modificación.

Owner decision: **NO**.

Next action: entrega documental tras cierre de la corrección del informe continuo; sin nueva autorización de datos ni producto.

Response generated for Codex: **YES**.
