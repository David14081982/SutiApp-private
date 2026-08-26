# FINANCIAL FUNDS ELIGIBILITY ROOT CAUSE RESULT

Fecha de evaluación: 2026-08-24. Alcance: auditoría read-only de `Criterios de fondos`, resolver `financial-legacy`, perfil real, contrato Repository y pantalla Suti Préstamo. No se modificaron Google Sheets ni Apps Script.

## Resultado ejecutivo

Para el perfil real `Categoría=Base`, `Sindicato=SUTISSSTESON` existen ocho eventos 2026 configurados y los ocho cumplen categoría, sindicato y plazo de un pago. No se pierden por duplicado, parser, zona horaria o perfil.

Al 2026-08-24 la autoridad Google los clasifica así:

- 3 `AVAILABLE`: `MOSTRAR PROGRAMA` es booleano `true`.
- 2 `UNAVAILABLE`: flag nulo y fecha ya transcurrida.
- 3 `SCHEDULED`: flag nulo y fecha futura.

El backend devuelve seis programas objetivo —tres disponibles y tres programados— y la sección `Fondos disponibles` muestra correctamente sólo los tres disponibles. La pantalla contiene además Caja de Ahorro y Caja Chica, por lo que muestra cinco tarjetas disponibles totales.

## Perfil y autoridades auditadas

| Campo | Valor real | Interviene |
|---|---|---|
| Categoría | Base | Sí |
| Sindicato | SUTISSSTESON | Sí |
| Tipo de empleado | null | No; categoría es el criterio equivalente vigente |
| Estatus de afiliación | null | No |
| Estatus laboral | null | No |
| Versión de perfil | 7 | Control de concurrencia, no elegibilidad |

Autoridad de criterios: Google `Criterios de fondos!A2:O151`. Autoridad del perfil: `public.affiliates`. Supabase `loan_term_policy` define sugerencias y mínimo personalizado; no replica tasas ni reglas Google. El navegador consume el resultado de la Edge y no calcula elegibilidad ni importes.

## Matriz exacta de los ocho eventos

Todos los renglones primarios tienen `H=null`, fecha efectiva en `N`, año repetido en `O=2026`, `Plazos=1 QNA`, coincidencia de categoría y sindicato, y fecha parseada como `DD/MM/YYYY` en UTC sin desplazamiento.

| Fila | Evento | M: MOSTRAR PROGRAMA | Estado 2026-08-24 | En backend | Visible disponible | Motivo si no aparece |
|---:|---|---|---|---|---|---|
| 79 (también 103; anomalía descrita abajo) | 15/01/2026 — Incentivos trimestrales | `true` booleano en fila primaria | AVAILABLE | Sí | Sí | — |
| 80 | 15/03/2026 — Bono anual | `true` booleano | AVAILABLE | Sí | Sí | — |
| 81 | 30/03/2026 — Incentivos anuales | `true` booleano | AVAILABLE | Sí | Sí | — |
| 82 | 15/04/2026 — Incentivos trimestrales | `null` | UNAVAILABLE | No | No | El flag no habilita y la fecha ya pasó |
| 83 | 15/07/2026 — Incentivos trimestrales | `null` | UNAVAILABLE | No | No | El flag no habilita y la fecha ya pasó |
| 84 | 15/10/2026 — Incentivos trimestrales | `null` | SCHEDULED | Sí | No | La UI de disponibles excluye correctamente los programados |
| 85 | 30/11/2026 — Aguinaldos | `null` | SCHEDULED | Sí | No | La UI de disponibles excluye correctamente los programados |
| 86 | 15/12/2026 — 2da. Parte de aguinaldos | `null` | SCHEDULED | Sí | No | La UI de disponibles excluye correctamente los programados |

La columna `N` tiene precedencia sobre `H`; si ambas faltan, el resolver intenta la fecha incluida en el nombre. `O` y el concatenado `G` no gobiernan el estado. La comparación usa instantes UTC y no intercambia día/mes.

## Hallazgo de calidad de fuente

La fila 103 repite `15/01/2026 — Incentivos trimestrales` para Base/SUTISSSTESON. `N` y `O` están vacíos, mientras `G` menciona 2027. El resolver ignora `G`, extrae 2026 del nombre y actualmente la clasifica `UNAVAILABLE`. Es una inconsistencia real de la hoja, pero no explica las tres tarjetas visibles y no fue corregida porque Google es la autoridad protegida.

## Prueba multifecha de los ocho renglones primarios

| Fecha evaluada | AVAILABLE | SCHEDULED | UNAVAILABLE |
|---|---:|---:|---:|
| 2026-01-01 | 3 | 5 | 0 |
| 2026-03-01 | 3 | 5 | 0 |
| 2026-04-01 | 3 | 5 | 0 |
| 2026-07-01 | 3 | 4 | 1 |
| 2026-10-01 | 3 | 3 | 2 |
| 2026-11-01 | 3 | 2 | 3 |
| 2026-12-01 | 3 | 1 | 4 |

Esto demuestra que la fecha efectiva cambia el estado general sin reglas especiales por nombre, usuario o evento.

## Causas raíz técnicas y corrección

1. El resolver usaba la lista sugerida 6/12/18/24 como puerta de elegibilidad. Para un fondo con máximo de un pago, la intersección de sugerencias era vacía y el fondo quedaba eliminado aunque el rango personalizado autorizado fuera 1–1. Se corrigió el filtro general a `payment_count >= customMinTerm`. Las sugerencias siguen siendo sólo atajos de UI.
2. El contrato frontend exigía que `termOptions` tuviera al menos un elemento. Una cotización válida de un pago devuelve `termOptions: []` y `customTerm={min:1,max:1,step:1}`, por lo que el Repository la rechazaba. Se corrigió la validación general para aceptar un arreglo vacío válido y exigir el rango personalizado.

Ambas fallas podían afectar cualquier fondo y perfil cuyo máximo válido estuviera por debajo de la primera sugerencia; no se agregaron excepciones por fondo, fecha, categoría, sindicato o usuario.

## Reconciliación backend/frontend

| Nivel | Conteo objetivo | Explicación |
|---|---:|---|
| Eventos 2026 configurados únicos | 8 | Ocho nombres/fechas solicitados |
| Aplicables por categoría, sindicato y plazo | 8 | Todos permiten 1 pago |
| Programas objetivo devueltos por Edge | 6 | 3 AVAILABLE + 3 SCHEDULED |
| Eventos objetivo en `Fondos disponibles` | 3 | Sólo AVAILABLE |
| Total de cards disponibles en pantalla | 5 | Los 3 eventos + Caja de Ahorro + Caja Chica |

La diferencia entre ocho aplicables y tres visibles no son fondos perdidos: dos tienen estado autoritativo `UNAVAILABLE` y tres `SCHEDULED`. La prueba en navegador confirmó cinco tarjetas totales, selección real de un evento de un pago, tarjeta `Otro` activa, rango 1–1 y cotización backend con `maxTerm=1`.

## Prueba multiperfil live

| Perfil real | Programas | Disponibles | Programados | Reglas de un pago |
|---|---:|---:|---:|---:|
| Base / SUTISSSTESON | 22 | 5 | 17 | 20 |
| Base / SUEISSSTESON | 23 | 6 | 17 | 21 |
| Base / SITISSSTESON | 22 | 5 | 17 | 20 |
| Confianza / EMPLEADOS DE CONFIANZA | 2 | 2 | 0 | 0 |
| Jubilados y Pens. / SUEISSSTESON | 2 | 2 | 0 | 0 |
| Eventuales / SUTISSSTESON | 3 | 2 | 1 | 1 |

Las sesiones de impersonación QA conservaron `actor_real` separado de `usuario_contexto` y terminaron cerradas. No se creó ninguna solicitud financiera.

## Evidencia y veredicto

- `scripts/audit-financial-funds-root-cause.js`: ocho eventos, campos H/N/O/M, parser, duplicados, multifecha y clasificación.
- `scripts/test-financial-funds-multiprofile-live.js`: perfiles reales, resolver live, impersonación auditada y reconciliación.
- `scripts/test-one-payment-funds-live.js`: cotizaciones reales con `term=1` para los tres eventos disponibles.
- `scripts/test-assisted-loan-browser.js`: Chrome real, cinco fondos disponibles y flujo 1–1 funcional.
- Edge activa: `financial-legacy` v12, JWT requerido.
- Google writes: 0. Apps Script writes: 0. Mocks/fallbacks productivos añadidos: 0.

Estado final: **PASS**. Visual completo para los estados disponibles, conexiones reales, regla general de un pago corregida, seguridad preservada y prueba browser real aprobada.
