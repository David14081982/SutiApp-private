# H-SUTIFARMA-INVENTORY-ADMIN-001

## PRE-CHANGE AUDIT — 2026-09-28

Objetivo: hacer inequívoca y operable la administración del inventario de Suti Farma desde el panel asignado a la encargada, conservando el UI existente y haciendo que todo medicamento activo aparezca en el catálogo de usuarios sin publicar cantidades.

Alcance: renombrar y priorizar la pestaña administrativa como Inventario; mostrar resumen privado de productos y existencias; conservar alta, edición, activación/desactivación, orden, imagen, presentación, cantidad y archivo lógico; reforzar la prueba de que los productos activos se proyectan al catálogo público y los inactivos no.

Fuera de alcance: solicitudes ya registradas, contacto de afiliados, notificaciones, cálculos financieros, Google/Apps Script, exposición pública de cantidades, eliminación física o cambios de autoridad.

Archivos a tocar: `app/screens-farma.jsx`, `app/screens-admin-program-products.jsx`, `scripts/test-sutifarma-browser.js`, `scripts/test-sutifarma.js`, `scripts/sutifarma-build.js` sólo si el build focal lo requiere, `app/bundle.js` y cachebusters como artefactos generados, esta auditoría, evidencia focal y Registry derivado para mantener freshness de los archivos/pruebas tocados.

Datos afectados: ninguno durante implementación/pruebas de navegador. Las operaciones productivas siguen escribiendo mediante `farma_command`; las pruebas SQL permanecen aisladas.

Fuentes de verdad: `program_catalog_items` para producto/visibilidad; `farma_private.inventory` para existencias; `program_catalog_item_assets` para imágenes. No se agrega fuente, caché ni fallback.

Tablas/APIs: sin cambio de schema. Se reutilizan `farma_command(INVENTORY|SAVE_PRODUCT|ARCHIVE)` y los lectores públicos del catálogo.

Legacy involucrado: NOT APPLICABLE; no se toca Ahorro, Préstamos, Google ni finanzas.

Invariantes: cantidades únicamente administrativas; un producto `enabled=true` aparece a usuarios y `enabled=false` no; el archivo conserva historia; Mariana permanece limitada al módulo Farma; seguridad backend prevalece sobre UI.

Riesgo: regresión de navegación/tabs, ocultamiento accidental de productos, confundir cero existencias con producto inactivo. Mitigación: conservar componentes, probar móvil/escritorio, catálogo público y flujo aislado de producto.

Tests: build focal, `test-sutifarma.js`, `test-sutifarma-browser.js`, contrato de permisos y arquitectura; comparación de UI existente. La regresión global no aplica porque no cambian repositories compartidos, Storage, shell, auth, viewer ni service worker; `bundle.js` es artefacto generado focal.

Recovery: revertir el commit frontend; no hay migración ni datos que recuperar.

Status: PASS

## SOURCE OF TRUTH AUDIT

Domain: productos e inventario de Suti Farma.
Authority: `program_catalog_items` y `farma_private.inventory`, con responsabilidades separadas.
Readers: `ProgramCatalogRepository.listItems`, `FarmaRepository.inventory`, pantallas pública y administrativa.
Writers: `farma_command(SAVE_PRODUCT|ARCHIVE)`; entrega descuenta inventario en `TRANSITION`.
Alternative sources: fixtures sólo en PGlite aislado.
Fallbacks/Caches/Conflicts: ninguno productivo; store React descartable.
Verdict: SAFE

## SUPABASE SECURITY / MIGRATION REVIEW

No se modifica schema, RLS, grants, funciones, roles ni migraciones. El frontend no recibe acceso nuevo y continúa usando los permisos backend existentes. Mariana conserva sólo `farma`; cantidades se leen únicamente por RPC administrativo autorizado. Migración: NOT APPLICABLE. Seguridad: PASS para el alcance frontend.

## CLAUDE UI CONTRACT

Screen: Admin → Suti Farma y Catálogo de Finanzas → Suti Farma.
Sections: encabezado, tabs, solicitudes, lista de productos, editor, información general en la entrada de catálogo.
Controls: agregar, editar, imágenes, presentación, existencia, unidad, orden, activo, eliminar, guardar/cancelar.
Interactions/navigation: se conservan; “Medicamentos” pasa a “Inventario” y se abre primero para hacer visible la facultad solicitada.
Public contract: tarjetas, galería, favoritos, detalle y solicitud se conservan; cantidades siguen ocultas.

## Implementation and verification

- `Admin → Suti Farma` y la entrada de Catálogo de Finanzas abren en **Inventario**. La pestaña Solicitudes permanece disponible y los enlaces push siguen abriendo directamente la solicitud correspondiente.
- El panel privado muestra medicamentos activos y existencias registradas, lista cada cantidad/unidad y conserva agregar, editar, imágenes, orden, activar/desactivar, guardar y eliminar con archivo lógico.
- El editor identifica **Visible para los usuarios**: activo se publica mediante la autoridad existente; inactivo se excluye del lector público. La cantidad continúa ausente de tarjetas y detalle públicos.
- No se creó migration, tabla, RPC, permiso, caché ni fuente alternativa. No hubo escritura productiva ni solicitud sintética persistida.
- Build focal PASS: bundle SHA256 `aa00f47c3ae902a958167dc33294dc35c54cb4a284578b02eea7762ef4302429`; 130 chunks ajenos preservados.
- PostgreSQL aislado PASS: 12 escenarios, incluidos alta de medicamento, cantidades, presentación, archivo, versión obsoleta, frontera pública/administrativa y recovery.
- Chrome real PASS en 1280×900 y 390×844: Inventario, resumen, alta, editor, copy de visibilidad, cantidades privadas, solicitud/confeti, historial y transiciones. Cero errores y cero escrituras productivas.
- Push focal, contrato de permisos y Architecture Registry PASS/FRESH.

## Post-change result

```text
H-SUTIFARMA-INVENTORY-ADMIN-001 RESULT
Status: PASS — implementación candidata; publicación remota pendiente
Files changed: pantallas Farma/productos, test focal, bundle generado, evidencia, Registry derivado y esta auditoría
Source-of-truth verdict: PASS — producto/visibilidad en program_catalog_items; cantidades en farma_private.inventory
Invariant verdict: PASS — cantidades privadas, historial conservado, activo controla catálogo público
Build: PASS — focal, 130 chunks ajenos preservados
Tests: PASS — PostgreSQL aislado, Chrome desktop/mobile, push, permisos y Registry
Security: PASS — sin permisos nuevos; backend/RLS existentes siguen siendo frontera
Legacy impact: NOT APPLICABLE
Unexpected files changed: none in isolated worktree
Known limitations: la versión pública permanece en el commit anterior hasta autorizar/publicar este candidato
Evidence: docs/qa/evidence/sutifarma-20260928/{build,browser,database-tests,push-tests}.json
```

## Architect review

Task reviewed: H-SUTIFARMA-INVENTORY-ADMIN-001.
Verdict: APPROVED como candidato focal.
What Codex did correctly: hizo visible la capacidad existente, conservó el UI y confirmó la proyección pública sin exponer inventario.
Important findings: el backend ya soportaba alta/edición/archivo; el defecto era de descubribilidad y prioridad de navegación.
Problems detected: ninguno pendiente en el candidato.
Architecture implications: ninguna frontera nueva; Registry actualizado sólo por archivos/pruebas tocados.
Source-of-truth implications: sin cambio ni duplicidad.
Security implications: sin concesión nueva; cuenta limitada conserva permisos `farma` efectivos.
Data implications: cero escrituras productivas de prueba.
Owner decision required: YES, únicamente para publicar el nuevo commit en `main`.
Recommended next action: preparar el commit exacto y solicitar autorización de publicación; después verificar bytes y ruta pública.

SUTIAPP ARCHITECT REVIEW

Task: H-SUTIFARMA-INVENTORY-ADMIN-001
Verdict: APPROVED candidate / publication pending
Critical findings: inventario administrativo visible y operable; público recibe productos activos, nunca cantidades
Source of truth: PASS
Architecture: PASS
Security: PASS
Data: PASS
Legacy: NOT APPLICABLE
Owner decision: YES — remote publication only
Next action: publish exact reviewed commit after explicit authorization and verify deployed UI
Response generated for Codex: NO — external publication authorization required

## Corrective continuation — limited Farma account

The owner supplied production evidence after publication: the Farma shell and scoped access loaded, but Inventario displayed `No pudimos cargar los productos`. Root cause: `useProgramCatalogAdminStore` started an unscoped all-program administrative read in parallel with the scoped Farma read. A module administrator limited to `farma` must never query the complete program catalog; the failing broad read could overwrite the successful scoped state. The same broad refresh also ran after a product save, and the generic retry repeated it.

Corrective scope: `app/program-catalog-admin-store.jsx`, `app/screens-admin-program-products.jsx`, focal browser test, generated focal bundle/evidence/Registry and this audit. No database, permission, catalog row or source-of-truth change. The scoped screen must load, retry and refresh only `program_key='farma'`; the unrestricted Programas · Productos screen keeps its existing complete read.

Risk: accidentally narrowing the total administrator screen or leaving a broad read after save. Tests must hold a simulated `module_admin` context with only `farma` throughout the real inventory render, then verify 50 products, add control, editor and public view. Recovery: revert the corrective frontend commit. Status: PASS to implement.

### Corrective verification

- The scoped hook now loads only `loadProgram('farma')` on initial access and context changes. It never launches the complete administrative catalog read.
- Scoped retry repeats only the Farma read. Post-save refresh reloads the selected program; the unrestricted Programas · Productos surface retains its complete refresh.
- Real Chrome at 1280×900 and 390×844 held a `module_admin` context limited to `farma`. Every `program_catalog_items` request after that context included `program_key=eq.farma`; 50 rows, summary, add control and editor loaded with zero browser errors and zero production writes.
- Read-only production transaction under Mariana's actual Auth identity confirmed `program_catalog.read/write`, Farma update module, 50 catalog rows and 50 inventory rows. Writes: 0.
- Isolated PostgreSQL twelve-scenario suite and focal build PASS. Final candidate bundle SHA256 `f3ad32c8ef689521b404079413800dc839beefa79cc51384504aeced290b56f0`.

Corrective result: PASS. Source of truth, quantities, requests, permissions, schema and legacy remain unchanged. UI preservation: PASS; the existing Inventory/Solicitudes structure and all controls remain, while the erroneous fail-safe state is replaced by the authorized scoped data.

Scope update before final corrective publication: `SutiApp.html` bundle query and `sw.js` cache/Core query are bumped together so already-installed clients cannot retain the defective same-URL bundle. This changes version identifiers only, not service-worker routing or cache policy. Required verification adds artifact build, SW registration/refresh and exact deployed bundle hash. Recovery is the preceding published artifact.
