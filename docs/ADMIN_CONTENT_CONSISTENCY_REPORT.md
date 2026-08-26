# H-ADMIN-CONTENT-CONSISTENCY-001 — Editor/preview/published consistency

## Alcance y autoridad

- Autoridad canónica de Noticias: `public.news_articles.body`, texto con un subconjunto Markdown compacto y explícito.
- Writer: `NewsEditor.d.body` → `createRemoteStore.save()` → `AdminRepository.saveManaged('news')`.
- Reader: `NewsRepository.list()` → `EditorialContent` → `ArticuloScreen`.
- Renderer compartido: `RichText`, usado por preview y artículo; crea nodos React y nunca inyecta HTML.
- `managed_copy_overrides` conserva su autoridad para copy de interfaz, no para campos estructurados.
- No se cambió schema, RLS, permisos, reglas de publicación, layout ni navegación.

## Reproducción y causa raíz

El texto controlado escrito directamente preservaba su valor exacto y renderizaba `P, P, UL, P`; la lista correspondía a la línea explícita `- Línea gamma...`.

Se reprodujeron tres defectos concretos:

1. `RichTextEditor.wrap/prefix` insertaba palabras plantilla cuando no había selección (`texto destacado`, `texto`, `Título de sección`, `Elemento`, `texto del enlace`). Esas palabras se incorporaban a `d.body`; por eso el preview las mostraba y el writer las publicaba.
2. Las acciones de la barra reconstruían el documento desde el `value` capturado por el último render. Una edición y acción de formato en el mismo turno podía recuperar fragmentos anteriores. La reproducción previa produjo `_texto_FRAGMENTO ANTERIOR` en lugar del valor más reciente.
3. `LiveText.eligible/apply` aceptaba los párrafos del artículo público y podía reemplazar su `textContent` desde `managed_copy_overrides`, creando una proyección distinta del registro autoritativo.

Durante el E2E apareció además un fallo del reader: `ArticuloScreen` invocaba `n.tag.toUpperCase()` aunque `tag` es opcional. Una noticia válida sin etiqueta no podía abrir el artículo. Se corrigió con el mismo guard ya usado por las tarjetas.

## Corrección

- `RichTextEditor` mantiene una referencia inmediata al valor canónico; `onChange` la actualiza antes de notificar a React.
- Las herramientas insertan únicamente sintaxis solicitada. Sin selección, negrita produce `****`, título `## ` y lista `- `; nunca añaden palabras.
- Selección y caret se restauran sobre el valor actualizado.
- `RichText` marca su árbol con `data-structured-content="rich-text"`; `LiveText` excluye esa frontera.
- Preview y artículo siguen usando exactamente `RichText`.
- La etiqueta opcional del artículo se renderiza solo cuando existe.

## Matriz del barrido Admin

| Superficie | Fuente editor | Fuente preview | Serializador | Campo/tabla | Reader frontend | Renderer frontend | Helper compartido | Riesgo de texto inesperado | Estado |
|---|---|---|---|---|---|---|---|---|---|
| Noticias | `NewsEditor.d.body` | `d.body` | identidad | `news_articles.body` | `NewsRepository` | `RichText` | `RichTextEditor/RichText` | Confirmado y corregido | `SAME_BUG_CONFIRMED` / FIXED |
| Educación | `VisualCrud.Editor.form.description` | sin preview | identidad | `educational_resources.description` | `EducationalRepository` | pantalla pública pendiente | ninguno | No comparte la causa | `DIFFERENT_PIPELINE` |
| Tutoriales | `VisualCrud.Editor.form.description` | sin preview | identidad | `educational_resources.description` | `EducationalRepository` | pantalla pública pendiente | ninguno | No comparte la causa | `DIFFERENT_PIPELINE` |
| Documentos/PDF | `VisualCrud.Editor.form.description` | sin preview | identidad | `institutional_documents.description` | `InstitutionalDocumentsRepository` | bloque/documento plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Minutas | `VisualCrud.Editor.form.description` | sin preview | identidad | `minutes.description` | `MinutesRepository` | bloque/documento plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Programas institucionales | `VisualCrud.Editor.form.description` | sin preview | identidad | `institutional_programs.description` | `InstitutionalProgramsRepository` | bloque institucional plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Convenios | `CvEditor.d` | sin preview de contenido | store propio | `adminStore` de presentación | frontend Convenios usa `CompaniesRepository` | texto plain | ninguno | Pipeline/autoridad distinto; no auto-fix | `DIFFERENT_PIPELINE` |
| Empresas | `VisualCrud.Editor.form.description` | sin preview | identidad | `companies.description` | `CompaniesRepository` | `ConvenioDetail` plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Marketplace productos | `ItemEditor.d.desc` | sin preview | mapping explícito | `marketplace_products.description` | `MarketplaceRepository` | párrafos por separación explícita | ninguno | No comparte la causa | `DIFFERENT_PIPELINE` |
| Marketplace categorías | `CategoryEditor.d.description` | sin preview | mapping explícito | `marketplace_categories.description` | `MarketplaceRepository` | texto plain | ninguno | No comparte la causa | `DIFFERENT_PIPELINE` |
| Banners | `VisualCrud.Editor.form.description` | sin preview | identidad | `banners.description` | `BannerRepository` | banner plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Popups productivos | `VisualCrud.Editor.form.body` | sin preview activo | identidad | `popups.body` | `PopupRepository` | `AdminPopup` plain text | `VisualCrud` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Popup/custom legacy | `PopupEditor.d/custom.texto` | `AdminPopup/CustomScreenView` | store local | no es la ruta Admin productiva | no aplica | plain text | `PeText` | Código no enroutado por Admin actual | `NOT_APPLICABLE` |
| Tu Sindicato / `union_content_blocks` | `BlockEditor.d.texto` | sin preview | mapping explícito | `union_content_blocks.body` | repositorio institucional | `renderBlock` plain text | `sindicatoStore` | No comparte la causa | `DIFFERENT_PIPELINE` |
| Membresías | `Editor.d` | sin preview | mapping de campos | `membership_offerings` | `MembershipRepository` | cards tipadas | ninguno | No hay cuerpo rich text | `DIFFERENT_PIPELINE` |
| Suti Farma | editor de producto catalogal | sin preview | mapping de catálogo | `program_catalog_items` / catálogo aplicable | `ProgramCatalogRepository` | detalle catalogal plain text | catálogo compartido | No existe editor rich text propio | `DIFFERENT_PIPELINE` |
| Branding | `form.app_name/description` | mismos campos `form` | identidad | `app_settings` | `BrandingRepository` | Home/shell plain text | `Preview` local | Proyección directa demostrada | `SAFE` |
| Flujos/seguimiento | stores tipados de flujo/etapa | `store.steps()` sobre flujo vivo | modelo tipado | autoridad workflow aplicable | `operationsStore/flowStore` | `Timeline` | `PreviewSheet` | No interpreta rich text | `SAFE` |

El barrido encontró un solo consumidor activo de `RichTextEditor` y dos consumidores del renderer `RichText`: preview de Noticias y artículo público. Por tanto no existían otros módulos donde aplicar automáticamente la misma corrección.

## Evidencia

- `node scripts/test-admin-content-consistency.js`: contrato controlado, última edición, cero palabras plantilla, renderer compartido, XSS seguro y barrido de 18 superficies.
- `node scripts/test-admin-content-consistency-browser.js`: Chrome real + Supabase reversible; captura de payload, read-back, reload, A/B, cancelar, artículo sin etiqueta y override controlado.
- Resultado E2E: Editor→Preview `MATCH`; Editor→Payload `MATCH`; Payload→Supabase `MATCH`; Supabase→Frontend `MATCH`; Preview→Published `MATCH`; 0 contaminación; 0 cancelaciones persistidas; 0 fixtures.

## Resultado consolidado

### NEWS EDITOR CONTENT CONSISTENCY RESULT

- Editor canonical source: `NewsEditor.d.body`.
- Preview source: proyección pura `RichText({ value: d.body })`.
- Stored source: `public.news_articles.body`.
- Published source: `NewsRepository` → `ArticuloScreen` → `RichText`.
- Duplicate editor states: 0.
- Stale-state defects: 1 encontrado, 1 corregido.
- Unexpected content sources: 2 encontradas, 2 bloqueadas (plantillas del toolbar y `LiveText`).
- managed_copy_overrides interference: NO después de la corrección.
- Rich-text pipeline / pure preview / shared renderer / formatting / XSS: PASS.
- Editor→Preview / Payload / Supabase / Frontend / Published: MATCH.
- Cross-news contamination / cancelled edits persisted / unexpected text introduced: 0 / 0 / 0.
- Browser real / RLS / Claude UI preservation: PASS / PASS / PASS.
- Registry updated if architecture changed: NOT_NEEDED.
- Final verdict: PASS.

### ADMIN EDITOR/PREVIEW CONSISTENCY SWEEP RESULT

- Admin surfaces scanned: 18.
- Editors found: 17.
- Preview surfaces: 3.
- Shared renderers / serializers / sanitizers: 1 / 0 / 1.
- SAFE: 2.
- SAME_BUG_CONFIRMED / SAME_BUG_FIXED: 1 / 1.
- SAME_RISK_NOT_REPRODUCED: 0.
- DIFFERENT_PIPELINE: 14.
- NOT_APPLICABLE: 1.
- Cross-record contamination / unexpected text introduced: 0 / 0.
- managed_copy_overrides interference found/fixed: 1 / 1.
- Duplicate-state / serialization / sanitization defects: 1 / 0 / 0.
- Editor→Preview / Editor→Stored / Stored→Frontend: PASS / PASS / PASS para las superficies aplicables verificadas.
- Browser / fixtures remaining / Claude UI preservation: PASS / 0 / PASS.
- Registry updated if architecture changed: NOT_NEEDED.
- Final verdict: PASS.

## H-ADMIN-CONTENT-CONSISTENCY-001 RESULT

- Status: PASS.
- Files changed: `app/rich-text.jsx`, `app/live-text.jsx`, `app/screens-marketplace.jsx`, `app/bundle.js`, `SutiApp.html`, `sw.js`, dos pruebas nuevas, ajuste mecánico del test de versión del odómetro, este reporte y `docs/AGENT_CHANGELOG.md`.
- Source-of-truth verdict: PASS; `news_articles.body` sigue siendo la única autoridad. No hubo escrituras permanentes ni fallback.
- Invariant verdict: PASS (`INV-002`, `003`, `004`, `012`, `015`, `036`, `039`, `041`).
- Build: PASS; bundle reproducible SHA-256 `F7495C9721F6FBE589E168D47BD22B7E997695A3D260B0EEDC0C69E1412EE345`.
- Tests: PASS; contrato, ownership, productización Admin, Admin remaining, Chrome/Supabase y regresión del odómetro.
- Security: PASS; nodos React inertes, enlaces `javascript:` sin `href`, sin secretos nuevos y RLS real conservada.
- Legacy impact: NOT APPLICABLE; no se tocó Google, Apps Script ni cálculo financiero.
- Unexpected files changed: 0. El ajuste al test del odómetro corresponde únicamente al corte `v121/v65`.
- Known limitations: el Registry permanece stale por fingerprint de archivos, pero no cambió arquitectura y no se regeneró por regla del Navigator. Convenios y el PopupEditor legacy se clasificaron como pipelines distintos y no se modificaron.
- Evidence: pruebas y matriz de este documento; fixtures y herramientas temporales restantes: 0.

## Revisión arquitectónica independiente

- Verdict: `APPROVED`.
- Critical/Major findings: 0/0.
- Contrato solicitado: cubierto por reproducción, causa raíz, corrección, payload/read-back, publicación, A/B, cancelar, XSS, RLS y sweep.
- Autoridad/seguridad/legacy/UI: sin cambio no autorizado.
- Evidencia ejecutable: suficiente y reproducible; bundle corresponde a fuentes.
- Instrucción siguiente: cerrar `H-ADMIN-CONTENT-CONSISTENCY-001`; no modificar los pipelines `DIFFERENT_PIPELINE` sin una auditoría de autoridad separada.
