# SutiApp — Admin UX/UI Product Design Review

Fecha: 2026-08-26
Modo: auditoría y propuesta; **0 cambios de UI, 0 escrituras productivas y 0 cambios de datos**.
Base: [auditoría funcional](ADMIN_EXHAUSTIVE_FUNCTIONAL_AUDIT.md), [auditoría semántica](ADMIN_SEMANTIC_CLARITY_AUDIT.md) y [evidencia Playwright](evidence/admin-playwright-20260826.json).

## Decisión ejecutiva

El Admin tiene un lenguaje visual móvil coherente y varias pantallas correctas para trabajo ocasional de baja escala. No está diseñado todavía como una herramienta administrativa de escritorio ni para volumen operativo real. La causa principal no es cosmética: a 1,440 px la aplicación conserva un marco fijo de **430 px**, por lo que listas, colas, reglas, preview y acciones compiten en una sola columna. En consecuencia, revisar 50 documentos, solicitudes o reglas exige repetir aperturas, cierres y desplazamientos que un workspace de escritorio debería evitar.

La calidad global es **NEEDS_ATTENTION**. No se clasifica `POOR` porque Marketplace, Acceso a pantallas y varios CRUD editoriales muestran buena jerarquía, estados vacíos explícitos y un patrón móvil consistente. Sí exige rediseño de producto antes de considerar el Admin apto para operación intensiva.

## Alcance y criterio de elegibilidad

Se revisaron **28 pantallas `PURPOSE_CONFIRMED`**: 22 módulos primarios y seis pantallas internas de Tu Sindicato. El menú Admin se evaluó como shell transversal, pero no se suma como pantalla operativa. No hubo superficies `PURPOSE_INFERRED` de alta confianza adicionales que justificaran ampliar el denominador.

Módulos primarios incluidos: Identidad y expediente, Datos y respaldos, Pop-ups, Tu Sindicato, Solicitudes, Finanzas · Solicitudes, Fondos y reglas, Etapas y seguimiento, Marketplace, Aprobación de Pop-ups, Planes, Membresías, Noticias, Educación, Catálogos de segmentación, Acceso a pantallas, Banners, Empresas, Documentos y credencial, Minutas, Programas institucionales e Ícono e instalación. Pantallas internas incluidas: Comité, Normas y reglamentos, Descarga de formatos, Información por categoría, Información por antigüedad e Información para jubilados.

Excluidos por `PURPOSE_CONFLICT`: Catálogo de Finanzas, Convenios y beneficios, Roles y permisos, Secciones y componentes, Menús y botones y Formularios. Excluidos por `PURPOSE_UNKNOWN`: la pantalla interna “Quién puede editar textos” y la acción sindical “Restaurar contenido original”. Ninguna propuesta de este informe debe usarse para implementar esas superficies antes de resolver su intención.

### Método

- Los flujos y estados se contrastaron con los dos informes base, los 2,268 controles runtime y las 46 superficies de la evidencia existente.
- Se ejecutó un recorrido Playwright adicional, solo lectura, en `430 × 932` y `1440 × 1000`.
- Se capturaron 11 imágenes de superficies sin datos personales. Un guard bloqueó texto con forma de correo y la revisión visual manual no encontró PII.
- Las capturas de Exportaciones y Fondos muestran el estado de error del origen local por CORS. Sirven para evaluar el diseño del error; **no** demuestran indisponibilidad del origen productivo.
- Los clics son una estimación desde que el operador ya está dentro del módulo. No incluyen login ni entrada al Admin.

## Resultado cuantitativo

Los conteos siguientes usan **hallazgos únicos**, no ocurrencias por pantalla. Un hallazgo transversal puede afectar varios módulos; las etiquetas de `UXD-001` a `UXD-018` permiten recomputarlos.

```text
ADMIN UX/UI PRODUCT DESIGN RESULT

Screens reviewed: 28 (22 módulos + 6 internas; menú Admin como shell transversal)

Operational UX problems: 8
Navigation inconsistencies: 4
Semantic clarity problems: 6
Poor component-pattern choices: 7
High-click workflows: 7
Missing bulk workflows: 6
Status clarity issues: 6
Feedback issues: 9
Mobile issues: 9
Desktop Admin issues: 10

P1: 4
P2: 10
P3: 4
P4: 0

Final UI quality: NEEDS_ATTENTION
```

## Revisión visual sobre capturas reales

| Superficie | Evidencia visual | Evaluación de producto |
|---|---|---|
| Menú Admin | [desktop](evidence/admin-ux-ui-20260826/01-admin-menu-desktop-1440x1000.png) · [móvil](evidence/admin-ux-ui-20260826/02-admin-menu-mobile-430x932.png) | Las cards identifican bien cada módulo, pero 28 entradas en una cuadrícula de dos columnas producen una portada muy larga. En escritorio el 70% del ancho queda sin uso y no aparece navegación lateral, búsqueda ni agrupación persistente. |
| Marketplace | [desktop](evidence/admin-ux-ui-20260826/03-marketplace-desktop-1440x1000.png) · [móvil](evidence/admin-ux-ui-20260826/04-marketplace-mobile-430x932.png) | Buena jerarquía: contexto, responsabilidad, CTA único, agrupación y estado “Sin productos”. Es una de las mejores pantallas actuales para bajo volumen. El límite sigue siendo el shell de teléfono en desktop. |
| Catálogo documental | [desktop](evidence/admin-ux-ui-20260826/05-documents-catalog-desktop-1440x1000.png) · [móvil](evidence/admin-ux-ui-20260826/06-documents-catalog-mobile-430x932.png) | Los códigos `ine_back`, `tribunal_form` y `payroll_latest` aparecen como label principal y se superponen visualmente con el input de orden. El número domina más que el nombre del documento; “100% del expediente” se repite sin explicar la regla. La pestaña QR queda al borde del viewport. |
| Datos y respaldos | [desktop](evidence/admin-ux-ui-20260826/07-data-exports-desktop-1440x1000.png) | El mensaje humano es útil, pero el código `CORS_OR_NETWORK_BLOCKED` ocupa el segundo nivel y “Reintentar” cae a un botón nativo sin el patrón visual del producto. Falta explicar alcance, causa probable y alternativa segura. |
| Fondos y reglas | [desktop](evidence/admin-ux-ui-20260826/08-fondos-desktop-1440x1000.png) · [móvil](evidence/admin-ux-ui-20260826/09-fondos-mobile-430x932.png) | El error falla cerrado y declara que no usó otra fuente, lo cual es correcto. Sin embargo, cuatro filtros y hasta 150 criterios no caben operacionalmente en cards de una columna; el error tampoco preserva contexto de última consulta ni ayuda diagnóstica secundaria. |
| Etapas y seguimiento | [desktop](evidence/admin-ux-ui-20260826/10-flujos-desktop-1440x1000.png) | Con 0 flujos la pantalla deja un vacío grande y presenta “Nuevo” y “Restaurar” casi con el mismo peso. No enseña qué debe existir, qué pasará al crear ni si restaurar reemplaza o combina. |
| Acceso a pantallas | [desktop](evidence/admin-ux-ui-20260826/11-pantallas-desktop-1440x1000.png) | Buena jerarquía, resumen global y estados con icono + texto, no solo color. Es una base reutilizable. En volumen, editar trece políticas una por una y ofrecer un reset global al final limita seguridad y eficiencia. |

## Evaluación por pantalla

Leyenda: `OK` = adecuado; `M` = mixto; `P` = pobre; `N/A` = no corresponde. `OP` identifica `OPERATIONAL_UX_PROBLEM`.

### Tarea, jerarquía y eficiencia

| Pantalla | Primary task | Secondary tasks | Information hierarchy | Action hierarchy | Clics estimados | Scannability |
|---|---|---|---|---|---:|---|
| Identidad y expediente | localizar afiliado y operar su expediente | editar perfil, documentos e impersonación | M: búsqueda clara; expediente largo después de seleccionar | M: acciones sensibles compiten en el mismo flujo | 2–6 por persona/documento | M |
| Datos y respaldos | exportar un dominio autorizado | configurar filtros y formato | M: dominio primero; schema y error técnico irrumpen | M: exportar/reintentar sin resumen previo de alcance | 2–4 | M |
| Pop-ups | crear, publicar y ordenar avisos | segmentar, duplicar, preview y assets | OK a bajo volumen | OK; repetitiva con muchas piezas | 2–5 por aviso | M |
| Tu Sindicato | elegir una de nueve experiencias y editar contenido | audiencia, assets, publicación y orden | M: directorio claro, IDs de autoridad visibles | M: demasiados niveles para cambios repetidos | 2–6 por bloque | M · OP |
| Comité | mantener el directorio del comité | foto, cargo, contacto, estado y orden | M: cards comprensibles; comparación limitada | M: acciones repetidas por integrante | 2–5 por integrante | M · OP |
| Normas y reglamentos | administrar la colección normativa | archivo, metadata, publicación y orden | OK al volumen actual | M: edición serial por documento | 2–5 por norma | M |
| Descarga de formatos | administrar formatos descargables | archivo, descripción, publicación y orden | OK al volumen actual | M: edición serial por formato | 2–5 por formato | M |
| Información por categoría | editar contenido por bloques | assets, audiencia, publicación y orden | M: bloques claros dentro del destino | M: navegación profunda y repetitiva | 2–6 por bloque | M · OP |
| Información por antigüedad | editar contenido por bloques | assets, audiencia, publicación y orden | M: bloques claros dentro del destino | M: navegación profunda y repetitiva | 2–6 por bloque | M · OP |
| Información para jubilados | editar contenido por bloques | assets, audiencia, publicación y orden | M: bloques claros dentro del destino | M: navegación profunda y repetitiva | 2–6 por bloque | M · OP |
| Solicitudes | priorizar y resolver trámites | filtrar, abrir detalle y cambiar estado | P: card-first oculta comparación entre casos | P: sin siguiente caso ni selección | 2–4 por caso, repetidos | P · OP |
| Finanzas · Solicitudes | operar solicitudes financieras | filtrar por tipo/estado y revisar detalle | M: tabs y estados ayudan | P: cola sin lote ni workbench | 2–4 por caso, repetidos | M · OP |
| Fondos y reglas | administrar visibilidad por criterio | filtrar, justificar override y reintentar | P a 150 criterios | P: toggle/card no escala y obliga repetición | 1–3 por criterio | P · OP |
| Etapas y seguimiento | definir flujo y etapas por servicio | revisar seguimiento y fechas | M: modelo explicado; vacío no orienta | P: editor largo y restaurar demasiado prominente | 2–6 por flujo/etapa | P · OP |
| Marketplace | administrar categorías y productos | assets, precio, publicación y orden | OK: progresión categoría → producto | OK a bajo volumen | 2–5 | OK |
| Aprobación de Pop-ups | revisar propuestas empresariales | aprobar, rechazar y ver empresa | M: intención clara; cards limitan comparación | M: sin siguiente ni lote seguro | 1–3 por propuesta | M · OP |
| Planes de empresas | administrar planes y beneficios | ciclos, empresas asociadas y activación | OK a bajo volumen | OK | 2–5 | OK |
| Membresías | administrar ofertas | conceptos, montos, pagos y activación | OK a bajo volumen | OK | 2–5 | OK |
| Noticias | administrar publicaciones | responsable, audiencia, assets y visibilidad | OK | OK | 2–5 | OK |
| Educación y tutoriales | administrar recursos | separar educación/tutoriales, assets y orden | P con 32 recursos y 124 controles visibles | M: mismas acciones repetidas por card | 2–5 por recurso | P · OP |
| Catálogos de segmentación | mantener sindicatos y categorías | agregar clave y reordenar | M: nombre y clave compiten | M: edición inline sin confirmación de lote | 1–3 por valor | M |
| Acceso a pantallas | definir audiencia por pantalla | previsualizar y restablecer | OK: resumen + grupos + estados | M: edición individual y reset global | 2–4 por pantalla | OK · OP |
| Banners | administrar campañas | assets, fechas, CTA, publicar y ordenar | P con 102 controles y scroll largo | M: card adecuada visualmente, no operacionalmente | 2–5 por banner | P · OP |
| Empresas | mantener directorio y presencia visual | logo, portada, enlaces, convenio y orden | P con 152 controles y 4,596 px de lista observada | P: cards para un catálogo administrativo extenso | 2–5 por empresa | P · OP |
| Documentos y credencial | revisar expediente y configurar reglas documentales | catálogo, requisitos, términos y QR | P: cinco trabajos distintos en tabs del mismo móvil | P: sin workbench ni siguiente caso | 2–6 por documento | P · OP |
| Minutas | administrar publicaciones de minutas | archivo, fecha, estado y orden | OK a volumen actual | OK | 2–5 | OK |
| Programas institucionales | administrar programas | categoría, contacto, redes, assets y orden | M con 78 controles/scroll largo | M: repetición de cards | 2–5 por programa | M · OP |
| Ícono e instalación | administrar identidad PWA y assets | textos, reemplazos y restauración | M: mezcla branding editable y artefactos de build | M: varios CTA de upload/reemplazo próximos | 1–4 por asset | M |

### Estados, bulk y responsive

| Pantalla | Status clarity | Error feedback | Empty state | Loading state | Bulk support | Mobile | Desktop Admin |
|---|---|---|---|---|---|---|---|
| Identidad y expediente | M: estados repartidos | M: error/retry existe | OK: búsqueda sin selección | M: busy local | **No** para cola documental | M: formulario denso | P: no usa ancho ni split view |
| Datos y respaldos | P: scope final poco visible | P: raw code + botón nativo | N/A | M | N/A por archivo; sin multi-dominio | M | P |
| Pop-ups | M: toggle/acción, poca síntesis | M: genérico | OK | OK: skeleton | No | OK | P |
| Tu Sindicato | M: conteos visibles, autoridad cruda | M | OK por destino | M | No | M | P |
| Comité | M: activo/orden por card | M | OK | OK | **No** | M/P a volumen | P |
| Normas y reglamentos | M | M | OK | OK | No | OK | P |
| Descarga de formatos | M | M | OK | OK | No | OK | P |
| Información por categoría | M: bloque/publicación dispersos | M | OK | M | No | M | P |
| Información por antigüedad | M: bloque/publicación dispersos | M | OK | M | No | M | P |
| Información para jubilados | M: bloque/publicación dispersos | M | OK | M | No | M | P |
| Solicitudes | M: chips, sin SLA/prioridad consistente | M | OK | M | **No** | M | P |
| Finanzas · Solicitudes | OK en vocabulario principal | M | OK | M | **No** | M | P |
| Fondos y reglas | M: modo requiere contexto | OK: sin fallback; poca causa | OK | M | **No** | P a volumen | P |
| Etapas y seguimiento | P: vacío no explica estado | M | P: gran vacío sin guía | M | N/A | P: editor largo | P |
| Marketplace | OK | OK: retry explícito | OK: “Sin productos” | OK: skeleton | No, pero bajo volumen actual | OK | P |
| Aprobación de Pop-ups | M: pendiente implícito | M | OK | M | **No** | M | P |
| Planes de empresas | OK | OK: retry | OK | OK | No | OK | P |
| Membresías | OK | M | OK | OK | No | OK | P |
| Noticias | OK | M | OK | OK | No | OK | P |
| Educación y tutoriales | M | M | OK | OK | **No** | P a volumen | P |
| Catálogos de segmentación | M: activo/clave sin resumen | P: guardado poco visible | M | M | No | M | P |
| Acceso a pantallas | OK: icono + texto | M | N/A | M | **No** | OK | P |
| Banners | M | M | OK | OK | **No** | P a volumen | P |
| Empresas | M | M | OK | OK | **No** | P a volumen | P |
| Documentos y credencial | P: reglas y revisión se mezclan | M: prompts/toast no bastan | M | M | **No** | P | P |
| Minutas | OK | M | OK | OK | No | OK | P |
| Programas institucionales | M | M | OK | OK | **No** | M/P a volumen | P |
| Ícono e instalación | M: relación asset/build poco visible | M | N/A | M | N/A | M | P |

## Hallazgos P1

### UXD-001 — El Admin de escritorio sigue siendo un teléfono de 430 px

**Etiquetas:** `DESKTOP_ADMIN_ISSUE`
**Pantallas:** menú y las 28 pantallas revisadas.

- **CURRENT DESIGN:** a partir de 760 px, `#root` conserva 430 px de ancho y hasta 932 px de alto, centrado como dispositivo. La bottom navigation móvil permanece visible.
- **PROBLEM:** no existe layout administrativo de escritorio; no caben tabla + detalle, preview + decisión, filtros persistentes ni comparación de registros.
- **WHY IT HURTS THE ADMIN:** obliga a scroll y navegación serial incluso cuando el operador dispone de monitor, teclado y mouse. El espacio vacío no produce información ni productividad.
- **PROPOSED DESIGN:** mantener intacto el layout actual en móvil y añadir un shell desktop adaptativo a partir de un breakpoint autorizado. Navegación lateral, header operativo, área central fluida y panel contextual opcional.
- **COMPONENT STRUCTURE:** `AdminShell > NavRail + WorkspaceHeader + MainRegion + ContextPanel`; cada módulo decide si `MainRegion` usa table, gallery, builder o form.
- **EXPECTED BENEFIT:** habilita todos los rediseños de volumen sin degradar el contrato móvil y reduce cambios de contexto.

```text
┌ NAV RAIL ┐ ┌ HEADER: módulo | buscar | filtros | estado de sesión ─────────┐
│ Inicio   │ ├───────────────────────────────────────────┬────────────────────┤
│ Colas    │ │ MAIN: lista / tabla / builder            │ CONTEXT: detalle   │
│ Contenido│ │                                           │ preview / acciones │
│ Seguridad│ │                                           │                    │
└──────────┘ └───────────────────────────────────────────┴────────────────────┘
MÓVIL: conservar navegación y composición actual de una columna.
```

### UXD-002 — Documentos necesita un workbench de revisión, no cards y tabs aisladas

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `HIGH_CLICK`, `MISSING_BULK`, `STATUS`, `FEEDBACK`, `DESKTOP_ADMIN_ISSUE`
**Pantalla:** Documentos y credencial.

- **CURRENT DESIGN:** cinco tabs mezclan revisión, catálogo, requisitos, términos y QR. La revisión expone cards con Ver/Aprobar/Pedir carga; el catálogo usa cards con códigos, orden inline, checkbox y toggle.
- **PROBLEM:** el operador pierde la lista al inspeccionar, no tiene preview persistente, no ve el siguiente caso y no puede seleccionar acciones seguras en lote. La configuración estructural compite con la operación diaria.
- **WHY IT HURTS THE ADMIN:** revisar 50 expedientes repite abrir → decidir → cerrar → reubicar. Aumenta tiempo, omisiones y decisiones sobre el afiliado equivocado.
- **PROPOSED DESIGN:** separar “Bandeja de revisión” de “Configuración documental”. En desktop, workbench de tres paneles; en móvil, flujo secuencial con CTA “Guardar y siguiente”. Lote solo para acciones autorizadas, homogéneas y auditables.
- **COMPONENT STRUCTURE:** `ReviewQueue + DocumentPreview + DecisionPanel + QueueNavigator`; configuración bajo una ruta secundaria propia.
- **EXPECTED BENEFIT:** comparación y decisión sin perder contexto; menor tiempo por documento y mejor trazabilidad.

```text
HEADER  [Buscar] [Filtros] [Pendientes 4] [Seleccionados 0]
LEFT    Cola: afiliado · tipo · antigüedad · estado
CENTER  Preview del archivo + metadatos + historial
RIGHT   Estado actual | observación | [Aprobar] [Pedir carga]
BOTTOM  [Anterior]  12 de 50  [Guardar y siguiente]
```

### UXD-003 — Solicitudes, Finanzas y Aprobaciones carecen de una cola operacional común

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `HIGH_CLICK`, `MISSING_BULK`, `STATUS`, `FEEDBACK`, `DESKTOP_ADMIN_ISSUE`
**Pantallas:** Solicitudes, Finanzas · Solicitudes y Aprobación de Pop-ups.

- **CURRENT DESIGN:** filtros/chips y cards por registro; detalle y decisión se abren de forma serial. No hay selección, filtros guardados, SLA, responsable ni “siguiente”.
- **PROBLEM:** cards sirven para consulta puntual, no para triage de decenas de casos.
- **WHY IT HURTS THE ADMIN:** el operador no puede ordenar por urgencia, comparar casos, conservar una vista de trabajo ni cerrar un bloque homogéneo de tareas.
- **PROPOSED DESIGN:** patrón de bandeja compartido con columnas configuradas por dominio, vista detalle lateral y acciones masivas limitadas por estado/permisos. Toda decisión muestra impacto y auditoría antes de confirmar.
- **COMPONENT STRUCTURE:** `QueueToolbar + DataTable/List + SavedView + DetailDrawer + SafeBatchBar`.
- **EXPECTED BENEFIT:** más casos por sesión, menos relectura y menor riesgo de saltar solicitudes.

```text
[Buscar] [Estado] [Tipo] [Antigüedad] [Responsable] [Guardar vista]
☐ FOLIO   PERSONA/EMPRESA   TRÁMITE   ESTADO   EDAD   RESPONSABLE
☐ 1042    Nombre resuelto   Programa  EN REV.  2 d    Sin asignar
───────────────────────────────────────────────┬──────────────────
LISTA                                          │ DETALLE + timeline
[2 seleccionados] [Asignar] [Cambiar estado…] │ acción individual
```

### UXD-004 — Fondos y reglas requiere una matriz, no una lista móvil de criterios

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `HIGH_CLICK`, `MISSING_BULK`, `MOBILE_ISSUE`, `DESKTOP_ADMIN_ISSUE`
**Pantalla:** Fondos y reglas.

- **CURRENT DESIGN:** cuatro filtros y una card/control por criterio; la auditoría funcional identificó hasta 150 criterios. El estado de error ocupa toda la pantalla cuando el origen no responde.
- **PROBLEM:** el patrón no permite comparar fondo, sindicato, categoría, vigencia y modo en filas contiguas ni detectar excepciones.
- **WHY IT HURTS THE ADMIN:** una revisión global exige scroll largo y memoria manual; aplicar la misma visibilidad a un grupo repite la acción y el motivo.
- **PROPOSED DESIGN:** grid de reglas con columnas sticky, agrupación, filtros combinables, contador de resultados y panel de cambio. Cualquier lote futuro debe respetar el writer Google controlado, validar cada fila, pedir motivo y mostrar preview de impacto; este informe no autoriza implementarlo.
- **COMPONENT STRUCTURE:** `RulesToolbar + VirtualizedGrid + RuleDetailPanel + AuditedChangePreview`.
- **EXPECTED BENEFIT:** auditoría rápida de excepciones y menos errores en cambios repetidos.

```text
HEADER [Fondo] [Sindicato] [Categoría] [Vigencia] [Modo]  146 resultados
☐ PROGRAMA      SINDICATO   CATEGORÍA   VIGENCIA       MODO      CAMBIO
☐ Préstamo A    Todos       Base        Permanente     AUTO      Editar
☐ Préstamo B    SUTI...     Confianza   01–30 Sep      OCULTAR   Editar
RIGHT: regla seleccionada + fuente + motivo + auditoría
BATCH: solo selección compatible → preview → confirmación backend
```

## Hallazgos P2

### UXD-005 — Identidad y expediente mezcla búsqueda, perfil, documentos e impersonación

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `HIGH_CLICK`, `MISSING_BULK`, `STATUS`, `FEEDBACK`, `MOBILE_ISSUE`, `DESKTOP_ADMIN_ISSUE`

- **CURRENT DESIGN:** búsqueda por nombre/control, selección de afiliado y después un flujo largo con perfil, documentos e impersonación.
- **PROBLEM:** tareas de distinta sensibilidad comparten el mismo eje vertical y el contexto activo puede perder visibilidad al hacer scroll.
- **WHY IT HURTS THE ADMIN:** aumenta la posibilidad de editar o revisar al afiliado equivocado y dificulta pasar por varios documentos pendientes.
- **PROPOSED DESIGN:** workspace con identidad fija, tabs funcionales y bandeja documental propia; acciones sensibles en panel contextual con actor/contexto siempre visibles.
- **COMPONENT STRUCTURE:** `PeopleSearch + IdentitySummary + ProfileTabs + DocumentQueue + ImpersonationPanel`.
- **EXPECTED BENEFIT:** contexto persistente, menos navegación y menor riesgo operativo.

```text
LEFT   [Buscar] resultados de personas
TOP    Afiliado activo · número de control · estado · actor real/contexto
CENTER [Perfil] [Expediente] [Acceso]
RIGHT  acción sensible + motivo + confirmación
```

### UXD-006 — Los CRUD visuales de alto volumen usan cards sin búsqueda ni modo tabla

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `HIGH_CLICK`, `MISSING_BULK`, `MOBILE_ISSUE`, `DESKTOP_ADMIN_ISSUE`
**Pantallas:** Empresas, Educación, Banners y Programas institucionales.

- **CURRENT DESIGN:** una card por registro con Desactivar/Subir/Bajar/Editar. Evidencia: Empresas 152 controles y 4,596 px; Educación 124/2,690; Banners 102/2,269; Programas 78/1,714.
- **PROBLEM:** un patrón visual apropiado para pocas piezas se usa como catálogo administrativo extenso.
- **WHY IT HURTS THE ADMIN:** localizar, comparar, publicar o desactivar varios elementos demanda scroll y acciones repetidas; el orden global es difícil de percibir.
- **PROPOSED DESIGN:** switch Tabla/Galería. Tabla para operación y orden; galería para revisar assets. Búsqueda, filtros, selección y acciones masivas seguras; editor lateral en desktop y full-screen en móvil.
- **COMPONENT STRUCTURE:** `CollectionToolbar + Table/GalleryView + SelectionBar + EditDrawer`.
- **EXPECTED BENEFIT:** velocidad sin perder preview visual.

```text
[Buscar] [Estado] [Tipo] [Responsable]  [Tabla | Galería]  [+ Nuevo]
☐ NOMBRE        TIPO       ESTADO       ORDEN   ACTUALIZADO   ⋯
☐ Empresa A     Convenio   PUBLICADO    04      Hoy           ⋯
[3 seleccionados] [Publicar] [Desactivar] [Reordenar]
```

### UXD-007 — Exportaciones expone schema y error técnico antes que decisiones de negocio

**Etiquetas:** `POOR_COMPONENT_PATTERN`, `SEMANTIC_CLARITY`, `FEEDBACK`, `MOBILE_ISSUE`, `DESKTOP_ADMIN_ISSUE`

- **CURRENT DESIGN:** tarjetas por dominio, filtros raw y error con código `CORS_OR_NETWORK_BLOCKED`; el retry observado usa un botón nativo.
- **PROBLEM:** el operador debe conocer columnas/tablas y no recibe un resumen verificable de qué exportará.
- **WHY IT HURTS THE ADMIN:** aumenta exportaciones incorrectas, prueba y error y escalaciones técnicas innecesarias.
- **PROPOSED DESIGN:** asistente por pasos: dominio → filtros con labels de negocio → columnas/formato → resumen/estimación → exportar. Detalles técnicos plegados para soporte.
- **COMPONENT STRUCTURE:** `ExportDomainPicker + BusinessFilterBuilder + ScopeSummary + ExportJobState`.
- **EXPECTED BENEFIT:** exportación autónoma y menos exposición de nomenclatura interna.

```text
1 DOMINIO  [Afiliados]
2 FILTROS  Sindicato [Todos]  Estado [Activo]  Fecha [Desde — Hasta]
3 CONTENIDO [✓ Perfil] [✓ Contacto] [ ] Metadatos técnicos
RESUMEN “2 filtros · XLSX · máximo 20,000 filas”
[Exportar]  Error humano | Reintentar | Detalles técnicos ▸
```

### UXD-008 — El constructor de flujos no representa el modelo como sistema

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `POOR_COMPONENT_PATTERN`, `NAVIGATION`, `FEEDBACK`, `MOBILE_ISSUE`, `DESKTOP_ADMIN_ISSUE`

- **CURRENT DESIGN:** tabs Flujos/Seguimiento, un formulario largo para flujo y etapas, y un restore de alto peso. Con 0 flujos queda una superficie casi vacía.
- **PROBLEM:** servicio, etapas, orden, estado actual y fechas se editan como campos aislados; no se ve la secuencia ni el impacto downstream.
- **WHY IT HURTS THE ADMIN:** es difícil detectar etapas duplicadas, saltos, orden incorrecto o qué solicitudes usan el flujo.
- **PROPOSED DESIGN:** listado de flujos a la izquierda, canvas secuencial en centro, propiedades de etapa a la derecha y simulación/preview. Restore debe vivir en danger zone y explicar alcance solo cuando su propósito funcional esté demostrado.
- **COMPONENT STRUCTURE:** `FlowList + StageCanvas + StageInspector + UsageSummary`.
- **EXPECTED BENEFIT:** comprensión antes de guardar y menos errores estructurales.

```text
LEFT: Flujos                  CENTER: Servicio X
• Préstamo                    [Recibida] → [Revisión] → [Aprobada]
• Membresía                                     ↑ agregar etapa
                              RIGHT: etapa seleccionada
                              nombre | estado | fecha | reglas | uso
BOTTOM: [Vista previa] [Guardar cambios]
```

### UXD-009 — Estado no tiene un contrato visual y textual único

**Etiquetas:** `SEMANTIC_CLARITY`, `STATUS`, `FEEDBACK`

- **CURRENT DESIGN:** el estado aparece como toggle, botón “Activar/Desactivar”, chip, contador o texto según módulo.
- **PROBLEM:** la misma condición no siempre se expresa igual y algunas superficies obligan a inferir el estado por la acción disponible.
- **WHY IT HURTS THE ADMIN:** el operador puede leer “Desactivar” como estado, no como acción, y no distingue borrador, publicado, desactivado o pendiente sin abrir.
- **PROPOSED DESIGN:** vocabulario canónico y componente `StatusBadge` con icono + texto; la acción usa verbo separado. Añadir timestamp/actor cuando una decisión lo requiere.
- **COMPONENT STRUCTURE:** `StatusBadge + StateReason + StateAction + StateHistory`.
- **EXPECTED BENEFIT:** lectura rápida y accesible sin depender del color.

```text
ESTADO ACTUAL:  ● PUBLICADO   “Visible para afiliados”
Último cambio: 26 ago · Administrador
ACCIÓN: [Desactivar…]   (no usar “Desactivar” como sustituto del estado)
```

### UXD-010 — Guardar/publicar/aprobar no muestra siempre el ciclo completo de feedback

**Etiquetas:** `FEEDBACK`

- **CURRENT DESIGN:** busy local y toast genérico en varias acciones; la fila o card no siempre conserva error, resultado o posibilidad de reintento/undo.
- **PROBLEM:** el toast desaparece y no demuestra qué registro cambió ni si la lista refleja el estado confirmado.
- **WHY IT HURTS THE ADMIN:** induce doble clic, repetición y dudas sobre persistencia.
- **PROPOSED DESIGN:** estado por acción y por registro: idle → validating → saving → confirmed/error. Mostrar resultado junto al objeto, retry idempotente y undo solo donde el backend lo soporte.
- **COMPONENT STRUCTURE:** `ActionButton + RowPendingState + OutcomeBanner + Retry/Undo`.
- **EXPECTED BENEFIT:** menos duplicados y mejor confianza operacional.

```text
CARD/ROW “Banner regreso a clases”
[Guardando…] controles bloqueados localmente
✓ Publicado y confirmado · hace 3 s   [Ver en contexto]
o
! No se guardó · tus cambios siguen aquí   [Reintentar]
```

### UXD-011 — Volver, cerrar, cancelar, salir y bottom navigation compiten

**Etiquetas:** `NAVIGATION`, `HIGH_CLICK`, `MOBILE_ISSUE`

- **CURRENT DESIGN:** flecha de header sin nombre accesible en Admin, “Salir” en banner de vista previa, cerrar sesión en el header, Cancelar/Cerrar en editores y bottom navigation global dentro de todos los módulos.
- **PROBLEM:** destinos y efectos no están diferenciados; en desktop la navegación de aplicación ocupa el lugar de una navegación administrativa.
- **WHY IT HURTS THE ADMIN:** el usuario duda si saldrá del modo de vista previa, del módulo, del editor o de la sesión; la navegación añade acciones y espacio sin ayudar al trabajo actual.
- **PROPOSED DESIGN:** contrato: Atrás = jerarquía; Cancelar = descartar edición; Cerrar = panel no editable; Salir de vista previa = contexto; Cerrar sesión = cuenta. Breadcrumb desktop y label accesible en todo icon-only.
- **COMPONENT STRUCTURE:** `AdminBreadcrumb + BackButton + EditorClose/Cancel + ContextExit + AccountMenu`.
- **EXPECTED BENEFIT:** navegación predecible y accesible.

```text
DESKTOP: Admin / Contenido / Marketplace / Electrónica
         [← Categorías]                         [Cuenta ▾]
EDITOR:  [Cancelar]                              [Guardar]
MÓVIL:   flecha “Volver a Marketplace”; bottom nav solo para cambiar de área.
```

### UXD-012 — El catálogo documental prioriza códigos y números sobre significado

**Etiquetas:** `SEMANTIC_CLARITY`, `MOBILE_ISSUE`

- **CURRENT DESIGN:** cards con `ine_back`, `tribunal_form`, `payroll_latest`, input de orden y checkbox “100% del expediente”. En screenshot los labels técnicos se superponen con el campo.
- **PROBLEM:** el dato de negocio no es la primera unidad escaneable y la regla obligatoria sigue ambigua.
- **WHY IT HURTS THE ADMIN:** obliga a memorizar nomenclatura, dificulta reordenar y aumenta cambios sobre el tipo incorrecto.
- **PROPOSED DESIGN:** nombre humano como título; código interno en detalles; orden mediante drag y número accesible; regla expresada con el término de negocio que decida el propietario.
- **COMPONENT STRUCTURE:** `DocumentTypeRow + BusinessLabel + TechnicalDetails + OrderControl + RequirementRule`.
- **EXPECTED BENEFIT:** catálogo legible y menos error de configuración.

```text
☰  INE — Reverso
   Código interno: ine_back ▸
   Orden [3]   Estado [ACTIVO]
   [✓] Requerido para completar expediente  (copy pendiente de decisión)
```

### UXD-013 — Tu Sindicato expone infraestructura y exige navegación profunda

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `NAVIGATION`, `HIGH_CLICK`, `MOBILE_ISSUE`

- **CURRENT DESIGN:** nueve cards de destino; algunas muestran IDs como `directory_members` o `institutional_documents:regulation`. El operador entra a un destino y después a bloques/editor.
- **PROBLEM:** la autoridad técnica ocupa el lugar de estado operativo y falta una vista resumen de contenido, publicación y responsable.
- **WHY IT HURTS THE ADMIN:** para revisar las nueve experiencias hay que entrar/salir repetidamente y memorizar qué ya fue inspeccionado.
- **PROPOSED DESIGN:** dashboard de experiencias con nombre, estado, número de bloques, última actualización y responsable; detalle con lista persistente de destinos en desktop. La acción de restore desconocida queda fuera.
- **COMPONENT STRUCTURE:** `UnionExperienceIndex + ExperienceSummary + BlockEditor + PublishState`.
- **EXPECTED BENEFIT:** revisión transversal y menos navegación.

```text
LEFT: 9 EXPERIENCIAS          CENTER: Cambio de Categoría
✓ Comité Ejecutivo            0 bloques · SIN PUBLICAR
! Cambio de Categoría         [+ Agregar bloque]
✓ Minutas                     Lista de bloques / orden / estado
RIGHT: preview + audiencia + última publicación
```

### UXD-014 — Acceso a pantallas es claro, pero no permite aplicar políticas con seguridad a escala

**Etiquetas:** `OPERATIONAL_UX_PROBLEM`, `MISSING_BULK`, `STATUS`, `FEEDBACK`, `DESKTOP_ADMIN_ISSUE`

- **CURRENT DESIGN:** resumen 13/13, preview y cards por pantalla con chip “Público general”; edición individual. Un reset global aparece al final.
- **PROBLEM:** aplicar una misma regla a varias pantallas repite trabajo y el reset total concentra demasiado impacto en una acción única.
- **WHY IT HURTS THE ADMIN:** las políticas pueden quedar inconsistentes entre pantallas y un cambio global es difícil de verificar antes de confirmar.
- **PROPOSED DESIGN:** matriz pantalla × audiencia con selección múltiple, preview de impacto, diferencias resaltadas y danger zone separada. Toda autorización sigue siendo backend/RLS; la UI solo administra configuración.
- **COMPONENT STRUCTURE:** `PolicySummary + ScreenPolicyTable + AudienceInspector + ChangePreview + DangerZone`.
- **EXPECTED BENEFIT:** consistencia y menor riesgo sin sacrificar la claridad actual.

```text
[Previsualizar como…] [Solo diferencias] [Buscar pantalla]
☐ PANTALLA          AUDIENCIA ACTUAL      REGLA
☐ Inicio            Público general       —
☐ Mis documentos    Afiliados             Sindicato + categoría
[2 seleccionadas] [Aplicar audiencia…] → preview → confirmar
DANGER ZONE (colapsada): Restablecer todas…
```

## Hallazgos P3

| ID | Hallazgo | Etiquetas | Propuesta |
|---|---|---|---|
| UXD-015 | Guardado inline por blur/orden/clave no conserva evidencia suficiente de qué fila se confirmó. | `SEMANTIC_CLARITY`, `FEEDBACK` | estado “Guardando/Guardado/Error” por fila, versión visible y retry local; no usar toast como única prueba. |
| UXD-016 | Cinco tabs documentales rozan/recortan QR en 430 px y la pestaña activa puede salir del contexto visible. | `NAVIGATION`, `MOBILE_ISSUE` | tabs scrollables con affordance, label completo y restauración de posición; preferir rutas secundarias para tareas estructurales. |
| UXD-017 | Iconos ausentes o botones icon-only sin nombre degradan significado y estado. | `SEMANTIC_CLARITY`, `STATUS` | fallback textual, `aria-label` obligatorio y test de registry; nunca depender solo del pictograma/color. |
| UXD-018 | Códigos, UUID, tablas, plataforma y errores técnicos aparecen al mismo nivel que el mensaje operativo. | `SEMANTIC_CLARITY`, `DESKTOP_ADMIN_ISSUE` | mensaje humano primero; “Detalles técnicos” expandible y copiable para soporte. |

## Patrones correctos que deben conservarse

- Marketplace: progresión de categoría a producto, CTA primario único, responsabilidad visible y estados vacíos específicos.
- Acceso a pantallas: resumen global, agrupación por tipo y chip con icono + texto.
- Estados de error que fallan cerrado y declaran ausencia de fallback, como Fondos.
- Header consistente y editores full-screen en móvil.
- Separación visual de responsabilidad de sección en módulos editoriales.
- Estados vacíos que explican qué aparecerá cuando se cree el primer registro.

## Top 10 oportunidades de rediseño

1. Crear un shell Admin desktop adaptativo sin alterar el contrato móvil.
2. Convertir revisión documental en workbench de tres paneles.
3. Unificar Solicitudes, Finanzas y Aprobaciones bajo un patrón de cola operativa.
4. Convertir Fondos y reglas en grid auditable con comparación de criterios.
5. Separar Identidad, Expediente e Impersonación en un workspace con contexto fijo.
6. Añadir Tabla/Galería, búsqueda y selección a CRUD visuales de alto volumen.
7. Reemplazar filtros raw de exportación por un constructor con labels de negocio y resumen.
8. Representar Flujos como secuencia visual con inspector y preview.
9. Adoptar contrato único de estado, feedback y acciones por registro.
10. Convertir Acceso a pantallas en editor de políticas con preview de impacto y danger zone.

## Mejores y peores pantallas actuales

### Best current Admin screens

1. **Marketplace** — jerarquía y empty state claros; buen patrón para bajo volumen.
2. **Acceso a pantallas** — resumen, agrupación y estado legible sin depender solo de color.
3. **Noticias del sindicato** — lenguaje de negocio y acción primaria claros.
4. **Planes de empresas** — estructura y conceptos alineados con la tarea.
5. **Minutas** — CRUD directo y escaneable en el volumen observado.

### Worst current Admin screens

1. **Documentos y credencial** — mezcla operación y configuración, semántica técnica y revisión serial.
2. **Fondos y reglas** — patrón de una columna incompatible con hasta 150 criterios.
3. **Solicitudes** — cards sin workbench, selección, “siguiente” ni vistas guardadas.
4. **Empresas** — 152 controles y 4,596 px de lista en un shell de 430 px.
5. **Educación y tutoriales** — 124 controles y operación repetitiva sin búsqueda/bulk.

“Mejor” y “peor” son relativos a las 28 pantallas con propósito confirmado; no sustituyen el estado funcional de la auditoría base.

## Orden de diseño recomendado, sin implementar

1. Definir primero el shell desktop y los contratos de navegación/estado; sin ellos, cada módulo recreará patrones incompatibles.
2. Diseñar prototipos de Documentos, Cola operacional y Fondos con datos sintéticos de volumen.
3. Validar con escenarios de 50 documentos, 100 solicitudes, 150 criterios y 100 empresas.
4. Resolver labels de negocio y decisiones pendientes antes de diseñar Catálogo documental en alta fidelidad.
5. Solo después, adaptar CRUD editoriales y políticas de pantallas al sistema aprobado.

Este orden **no autoriza implementación**. Cada rediseño deberá tener H propia, authority map, preservación Claude, revisión de permisos y pruebas con backend/RLS real.

## Claude UI preservation review

```text
CLAUDE UI PRESERVATION REVIEW

Screen: 28 pantallas Admin con propósito confirmado
Original sections: inspeccionadas en código, runtime y capturas
Current sections: sin cambios
Missing sections: ninguna
Added sections: ninguna
Interactions preserved: YES
Navigation preserved: YES
Visual structure preserved: YES
Unauthorized redesign: NO

Verdict: PASS
```

## Evidencia y límites

- Evidencia runtime base: [admin-playwright-20260826.json](evidence/admin-playwright-20260826.json).
- Evidencia visual nueva: [admin-ux-ui-20260826](evidence/admin-ux-ui-20260826/).
- Capturas: 11/11 generadas con Playwright; `writes: 0`; guard PII `PASS`.
- No se capturaron Identidad, Solicitudes ni preview documental con datos personales.
- No se ejecutaron Guardar, Publicar, Aprobar, Rechazar, Eliminar, Restaurar, upload, reorder ni acciones batch.
- El reporte propone estructuras de componentes, no copy final, schema, permisos ni writers.
- Registry: `STALE` por artefactos documentales de esta cadena y un resultado ajeno; no cambió arquitectura y no corresponde regenerarlo.

## Cierre

```text
H-ADMIN-UX-UI-REVIEW-20260826 RESULT
Status: PASS
Files changed: docs/qa/ADMIN_UX_UI_PRODUCT_DESIGN_REVIEW.md + 11 PNG de evidencia
Source-of-truth verdict: NOT APPLICABLE — no se cambió autoridad ni dato
Invariant verdict: PASS — propuesta documental; INV-036 preservado, sin rediseño implementado
Build: NOT APPLICABLE — no cambió código/bundle
Tests: Playwright screenshot review PASS, 11 captures, 0 writes, PII guard PASS
Security: PASS — superficies no personales; no secretos; no acciones productivas
Legacy impact: NOT APPLICABLE — Fondos solo lectura, sin llamada de escritura Google
Unexpected files changed: NONE
Known limitations: estados productivos de Exportaciones/Fondos no renderizaron en origen local por CORS; se evaluó su error state
Evidence: informes base, JSON runtime y docs/qa/evidence/admin-ux-ui-20260826/
```
