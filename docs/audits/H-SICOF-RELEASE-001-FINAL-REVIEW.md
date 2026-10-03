# H-SICOF-RELEASE-001 — revisión independiente de cierre

## PRE-CHANGE AUDIT

H: H-SICOF-RELEASE-001.

Objetivo: revisar la publicación comprobada, la evidencia real de UI/seguridad/datos y la interpretación de una tasa todavía sin resolver. Esta revisión no implementa ni publica correcciones.

Alcance de escritura: únicamente este documento. Inspección local de archivos, código, evidencia y Git; reproducción sintética en memoria, sin login, cambios runtime ni operaciones externas.

Fuera de alcance: autocertificar el backend Google/los exportadores en los que participó este agente. La evaluación independiente de la corrección 003 y el memo Google procede de `H-SICOF-RELEASE-001-ARCHITECT-REVIEW.md`; el frontend cuenta con la revisión independiente separada `H-SICOF-FRONTEND-INDEPENDENT-REVIEW.md`.

Fuentes: transacciones canónicas de Ahorro para saldos; `HISTORIAL P V2` para pagos/estado de préstamo; Excel privado original como evidencia histórica inmutable; escenario SICOF como derivado sin acreditación. Ninguna tabla o dato financiero se modifica durante esta revisión.

Invariantes: no convertir falta de evidencia en incumplimiento; no presentar `rate:null` como 0% o tasa aprobada; no sustituir fuente fallida; preservar datos/privacidad/autoridad; exigir evidencia real para los gates de producción.

Riesgo: bajo para la revisión; material para la comunicación financiera si un estado pendiente se etiqueta como exclusión definitiva. Recovery de la revisión: retirar el documento; no hay efectos runtime.

Tests: contraste de hashes/commits/evidencia; comparación de saldos y filas protegidas de las pruebas existentes; reproducción local de inscripción desconocida; revisión del estado real de los gates.

Status del alcance de revisión: PASS.

## ARCHITECT REVIEW

Task reviewed: cierre de H-SICOF-RELEASE-001 publicado en `b1e562a83e85eabe5e271b0117bc705312a242aa`, frontend v311.

Verdict: **NEEDS_FIX**. La publicación, las pantallas principales y la regresión global de v311 están comprobadas. Se detectó una ambigüedad concreta entre inscripción desconocida e incumplimiento de antigüedad. La corrección requiere revisión focal y evidencia de la nueva versión publicada; no se debe cerrar el release como totalmente aprobado antes de esos gates.

Skills aplicadas: architecture navigator, architect reviewer, source-of-truth, legacy Google, Supabase security y pre/post-change verification. Se usó discovery dirigido porque el Registry raíz refleja cambios concurrentes de evidencias; la aceptación completa del Registry del commit aislado publicado sí cuenta con evidencia propia PASS. `WORK_QUEUE_HISTORY.md` no existe; la cola histórica no se usa para otorgar autorización o avance automático. La activación procede de la autorización explícita del propietario documentada en la H.

### Publicación y comprobaciones realizadas correctamente

`docs/qa/evidence/sicof-release/frontend-publication.json` identifica el commit `b1e562a83e85eabe5e271b0117bc705312a242aa`, workflow completado con éxito y bundle v311 en ambos hosts: `https://sutiapp.com/SutiApp.html` y GitHub Pages. Ambos sirven SHA-256 `6ab062c6a110588bf33073fe6c5f4707d80bfa320db5980572cc9ca2242af2ea`, el mismo artefacto revisado independientemente. El checkout aislado confirma ese HEAD.

La revisión previa del paquete comprobó cuatro fragmentos focales sustituidos, cuatro añadidos y 141 fragmentos previos conservados literalmente, incluidos RH. El artefacto público contiene exactamente 28 archivos y no incluye Excel, backups, SQL o secretos. SW conserva lógica y cambia versiones solamente.

`ui-live-production.json` combina de forma explícita los seis pasos administrativos reales que pasaron con la repetición independiente de navegación al ahorro propio. No se oculta el intento original FAIL: queda en `ui-live-production-admin.json`. La repetición `ui-live-production-self.json`, a las 21:05:29 UTC del 2026-10-03, confirma el mismo bundle, sesión real, disponibilidad canónica y estado vacío del componente de periodos. La corrección fue de navegación del verificador (`Ver app` y esperar el contexto), sin cambiar producto.

La UI administradora mostró ocho pestañas, controles de reportes habilitados, detalle real del ahorro, préstamo y comparación esperado/pagado, además del indicador de comportamiento en Finanzas/Solicitudes. LOAD, CALCULATE y BEHAVIOR devolvieron HTTP 200. Fuente READY observada a las 21:00:17 UTC, 2,373 préstamos, 5,656 pagos del intervalo, 354 participantes y 836 renglones de reporte. Son conteos de objetos distintos; no deben compararse como si fueran el mismo universo.

`global-production.json`, a las 21:07:43 UTC, confirma PASS en GitHub Pages con el SHA-256 exacto de v311. Se verificaron 194 assets de app, 226 de catálogo, Login, perfil, Admin, documentos, Membership, Préstamo, Marketplace, fullscreen, PDF legítimo, refresh y comparación con/sin SW. Cero errores browser, mutaciones de datos productivos o URLs privadas registradas. Esta evidencia corresponde a v311; no sustituye la verificación de una versión posterior corregida.

Limitación real de self: la cuenta existente utilizada tiene cero filas de periodos y cero referencias anuales. El saldo disponible y el estado vacío sí se comprobaron en producción. No se afirma demostración browser de una cuenta real con varios periodos; esa cobertura adicional procede de equivalencia SQL sobre 354 participantes y pruebas UI aisladas. No se crearon cuentas, movimientos ni impersonaciones para obtenerla.

`registry-acceptance.json` documenta `python scripts/test-architecture-registry.py` con exit 0 sobre el checkout aislado congelado en b1e562; incluye freshness, lookup, reverse lookup, permisos, incremental, secretos y determinismo. El estado stale del workspace raíz con evidencia en curso no se presenta como fallo de ese commit.

### Fuente de verdad, conservación y seguridad

`docs/qa/evidence/sicof/live-post.json` contiene diez comprobaciones reales read-only: acceso admin, self, aislamiento privado/RLS/grants, contexto, composición coincidente admin/self, Excel original y Edge. Los conteos y fingerprints antes/después coinciden en las siete tablas canónicas verificadas, incluidas 844 transacciones y 354 participantes. Se preservó cada campo anterior del DTO self. Nueve tablas privadas mantienen su cierre API y los escritores permanecen restringidos.

El Excel histórico conserva 214 filas y SHA-256 `e9dc173869188990e23d71694a99af008d2b9190a301d1d71c90ff2764d18837`; no representa un nuevo abono. La tasa simulada no modifica los ceros históricos de rendimiento ni recalcula 2025.

Cobertura de permisos: anonimato denegado y sesión administradora reales; cinco aserciones de denegación con rol `authenticated` y sujeto ordinario mediante SQL read-only. `ordinaryAuthenticatedCoverage:false` es una limitación explícita: no hubo login browser/API con credenciales de un usuario ordinario. No se transforma esa ausencia en una prueba realizada. No se crearon ni cambiaron contraseñas.

Para la migración 003 y el lector Google se consulta la revisión independiente ya existente: preserva contratos, ACL/owners, lecturas dobles, columnas, formatos, escritores y autoridades. Este reviewer no se atribuye independencia sobre esas implementaciones propias. El intento de recovery Google previamente fallido sigue conservado como FAIL, sin presentarlo como rollback aprobado.

### Qué significa `rateResolved:false`

El escenario observado es el segundo semestre de 2026, con saldo promedio diario y corte al cierre del semestre. Devuelve **354 pendientes de revisión, 0 elegibles confirmados y 0 excluidos definitivos**. `rate` es `null`: no es una tasa de 0%, una tasa aprobada ni una prueba de incumplimiento generalizado. Los importes a distribuir de las filas pendientes también quedan sin determinar.

Los principales motivos son evidencia incompleta para reconstruir la base y verificar las políticas:

| Motivo observado | Cuentas con esa marca | Interpretación |
| --- | ---: | --- |
| `HISTORICAL_EXPECTATION_UNVERIFIED` | 328 | La historia certificada no acredita el descuento esperado de cada fecha. |
| `HISTORICAL_DAILY_BALANCE_UNPROVEN` | 297 | El saldo certificado posterior al inicio del semestre no demuestra el saldo de cada día anterior. |
| `CONTRIBUTION_EVIDENCE_INCOMPLETE` | 294 | Faltan filas completas/conciliadas para contrastar todo el calendario exigible. |
| Préstamos por conciliar | 272 | Hay estado o datos de préstamo que requieren revisión. No equivale automáticamente a mora. |
| `ENROLLMENT_UNVERIFIED` | 29 | No existe inscripción canónica verificable al corte consultado. |
| Saldo canónico no disponible | 26 | No hay saldo utilizable para esa cuenta en el contexto. No debe sustituirse por cero. |
| `SOURCE_REVIEW_REQUIRED` | 2 | La fuente necesita aceptación/conciliación del cambio detectado. |

Las marcas **se solapan**: una persona puede tener varias; no se suman como poblaciones independientes. Otros motivos aparecen 75 veces para antigüedad, 18 para inscripción inactiva, 18 para baja y cinco para descuentos insuficientes. Todas esas filas permanecen en revisión; no se deben presentar los conteos como 75/18/18/5 exclusiones definitivas. El motivo de antigüedad presenta además el defecto específico descrito abajo.

`rate-basis-facts.json` confirma 328 certificaciones con corte 2026-09-06, y 297 aperturas certificadas posteriores al inicio 2026-07-01. `basisFor` no atribuye retroactivamente ese saldo a todos los días del semestre. Cambiar la simulación de promedio a saldo final puede eliminar ese motivo particular, pero no completa la historia de aportaciones, las expectativas ni los préstamos por conciliar. Por ello no se puede prometer que cambiar un selector resolverá la tasa.

Las alertas DATE_SEMANTICS, UNALLOCATED_PAYMENTS, FUTURE_CUTOFF, POLICY_SCENARIO, SAVINGS_REVIEW y NO_VERIFIED_BASIS son coherentes con esas limitaciones. La fecha de amortización de Google no acredita la fecha real de recepción ni la puntualidad; cuotas, capital, interés, gasto administrativo y proyección se mantienen separados. El motor conserva `status:SIMULATION`, `can_post:false` y `can_certify_cash_income:false`. No hay tasa aprobada ni rendimientos acreditados por esta activación.

### Hallazgo que impide afirmar ausencia de confusión

Los agregados del motor distinguen revisión y exclusión correctamente, pero hay dos detalles de representación:

1. `engine.mjs` calcula `completedMonths` como 0 cuando falta la fecha de inicio y después añade `No cumple 6 meses`. Con inscripción desconocida la antigüedad no está demostrada; no es una antigüedad demostrada de cero meses.
2. En `app/sicof-admin.jsx`, la columna `Califica` usa el booleano `ok` y el formato genérico `Sí/No`. Una fila `review_required:true, ok:false` aparece como `No`, sin una distinción explícita en esa celda frente a una exclusión confirmada.

Reproducción local en memoria, sin fuentes productivas: participante sintético con capital conocido, `enrollment:null`, `eligibility.complete:false` y único motivo fuente `ENROLLMENT_UNVERIFIED`. El resultado fue:

```json
{
  "nqual": 0,
  "nexcl": 0,
  "review": 1,
  "rate": null,
  "row": {
    "months": 0,
    "ok": false,
    "review_required": true,
    "motivo": "No cumple 6 meses; ENROLLMENT_UNVERIFIED",
    "rend": null
  },
  "can_post": false
}
```

El dinero no se acreditó ni la cuenta pasó al agregado de excluidos. Sin embargo, el texto expresa una certeza que la fuente no acredita. Corregir ese texto/estado no requiere cambiar políticas ni inventar historia. Este hallazgo describe v311 y se conserva como evidencia histórica.

### Revisión independiente de la corrección, previa al despliegue

Los deltas de motor/exportadores fueron implementados por `savings_contract`; los de UI por `sicof_ui_contract`. Este reviewer no escribió esa corrección y contrastó cada diff contra b1e562.

Resultado focal previo al despliegue: **APPROVED**. Se completaron la revisión del código y las suites finales de motor, exportación, Edge, sintaxis y UI. El gate técnico de esta corrección queda satisfecho; no equivale todavía a APPROVED del cierre de la H.

- Motor V2: una fecha ausente devuelve `months:null`; si la permanencia está activa, la fila pasa a revisión con `Fecha de inicio del ahorro pendiente de verificar`. Una fecha existente y corta conserva `No cumple 6 meses`; el anclaje no inventa una fecha ausente. Desactivar el mínimo conserva la regla anterior y no elimina otros motivos fuente pendientes.
- CSV, XLSX simple, Desglose y Reparto formulado usan `Por verificar / No / Sí`. Los literales de IF y SUMIF cambian juntos a `Sí`, manteniendo coherencia con las celdas y los resultados monetarios. La ruta de descarga de los bytes históricos originales no cambia.
- Tabla y modal UI distinguen elegibilidad pendiente; meses desconocidos muestran `Por verificar` y cero meses comprobados sigue siendo cero. No se alteran selección de base, reglas, llamadas API ni importes.
- Aserción propia contra el motor b1e562 importado en memoria: **24 escenarios con fecha conocida devuelven DTO completos idénticos**, salvo la versión del motor. Incluye saldo promedio/final, mínimo activado/desactivado y anclaje. Con fecha ausente y mínimo desactivado, todos los campos financieros son idénticos; con mínimo activo hay revisión y no exclusión inventada.
- Aserción propia del bundle candidato v312: 149 fragmentos, **148 idénticos** a v311; únicamente cambia `sicof-admin.jsx`. HTML/SW sólo cambian versiones a bundle312/SW244; sintaxis válida.
- Se contrastó `eligibility-ui-browser.json`: 26 comprobaciones PASS, red bloqueada, cero escrituras productivas, con los tres estados y el modal comprobados.

Hashes del delta revisado:

| Archivo | SHA-256 |
| --- | --- |
| `supabase/functions/sicof/engine.mjs` | `ccf1a5693ed12c6ddcae651f559db3017cd7ed795ca300d2d84a32fda76090a5` |
| `supabase/functions/sicof/exports.mjs` | `654752790adf4e2920103d0f091c07e9cc3cbf3b403e7963beea784ffb054fc2` |
| `app/sicof-admin.jsx` | `3d9aa781b5507f75498dfc75658cbd82bb24cc792a21eb4f691e1c40be3d2a09` |
| Bundle candidato aislado v312 | `de642fb5b24c986c0b1c116c0dce8c8b12f2383fb086d68681ee47ef65b31d6a` |

Suites finalizadas por los implementadores y contrastadas con los archivos revisados: `node scripts/test-sicof-engine.js` PASS; `node scripts/test-sicof-exports.js` PASS, 20 grupos, incluyendo los tres estados en CSV/XLSX/formulado y las 214 filas/bytes históricos intactos; `node scripts/test-sicof-edge.js` PASS; sintaxis/diff PASS. UI: `node scripts/test-sicof-ui-browser.js`, 26 comprobaciones PASS. Las aserciones independientes propias del reviewer son la equivalencia de 24 escenarios, estado desconocido y conservación del bundle descritas arriba; no se presenta la ejecución de las suites por otro agente como propia.

El agente principal confirmó estos hashes y resultados antes de sellar y desplegar la corrección. Quedan las comprobaciones reales del nuevo despliegue antes del dictamen final. La evidencia v311 no se atribuye retroactivamente a v312.

### Gates de cierre

| Gate | Estado observado |
| --- | --- |
| Commit/workflow/bundle publicado en ambos hosts | PASS, b1e562 / v311 / SHA exacto. |
| UI administradora real | PASS, seis pasos reales y fuente READY. |
| UI self publicada | PASS con límite de estado vacío, evidencia específica del mismo bundle. |
| Regresión global local del artefacto | PASS, evidencia de la revisión frontend previa. |
| Regresión global posterior a publicación v311 | PASS, `global-production.json` con SHA exacto. Una corrección publicada posterior requiere su propia evidencia. |
| Interpretación de datos pendientes en fila | NEEDS_FIX: antigüedad desconocida y columna Califica. |
| Tasa aprobada / acreditación de rendimiento | No corresponde a esta activación; ninguna ejecutada o afirmada. |

Owner decision required: **NO** para las correcciones técnicas y la comprobación pendiente. No se propone una nueva regla de ahorro ni reclasificar históricos.

## RESPONSE TO CODEX

No cierres H-SICOF-RELEASE-001. Conserva los resultados reales publicados y los intentos fallidos previos. Corrige de manera focal la antigüedad desconocida para que no genere una declaración de incumplimiento, y presenta las filas pendientes como `Por revisar` en la columna de elegibilidad, diferenciadas de exclusiones comprobadas. No cambies aportaciones, fechas históricas, saldos, políticas ni habilites una acreditación automática. Añade una prueba que contraste fecha ausente, antigüedad demostrada insuficiente y elegibilidad verificable. Ejecuta la regresión global requerida sobre el bundle final publicado, con assets legítimos, PDF, refresh y comparación con/sin SW, y guarda su SHA. Repite los checks focales afectados por cualquier corrección y solicita la revisión de cierre con evidencia de esos gates. Explica al propietario que la tasa está pendiente de conciliar datos, no que todos los ahorradores incumplieron. No avances a otra H.

## H-SICOF-RELEASE-001-FINAL-REVIEW RESULT

Status: FAIL por defecto corregible de semántica; global v311 PASS y verificación de la corrección posterior pendiente.

Files changed: únicamente este documento.

Source-of-truth verdict: PASS en las autoridades y conservación contrastadas; falta de evidencia permanece explícita.

Invariant verdict: pendiente corregir texto de antigüedad desconocida; no se observó escritura financiera ni tasa inventada.

Build: bundle publicado coincide con el artefacto previamente revisado y workflow success.

Tests: UI real administradora/self y global producción v311 PASS con límites; reproducción sintética demuestra el defecto; verificación de la corrección posterior pendiente.

Security: evidencia backend/SQL y privada revisada con límite explícito de ausencia de credenciales ordinarias.

Legacy impact: ninguno durante esta revisión; evaluación del cambio Google procede de reviewer independiente anterior.

Unexpected files changed: ninguno por este reviewer.

Known limitations: antigüedad/columna de elegibilidad, tasa sin base verificable, self real vacío y gates propios de la corrección posterior.

Evidence: archivos y reproducción indicados arriba.

## SUTIAPP ARCHITECT REVIEW

Task: cierre publicado de H-SICOF-RELEASE-001.

Verdict: NEEDS_FIX.

Critical findings: certeza incorrecta de antigüedad cuando falta inscripción; filas pendientes muestran Califica No. UI/global v311 ya PASS; falta cerrar la corrección posterior con evidencia propia.

Source of truth: autoridades preservadas; no sustituir evidencia faltante por cero o incumplimiento.

Architecture: publicación focal preservada; Registry aislado aceptado.

Security: backend real y SQL revisados, sin afirmar login ordinario no ejecutado.

Data: tasa sin resolver, sin cambios financieros; motivos solapados.

Legacy: sin escrituras por el reviewer.

Owner decision: NO.

Next action: corrección focal de semántica y cierre de gates con evidencia real.

Response generated for Codex: YES.
