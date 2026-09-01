# H-GLOBAL-DOCUMENT-IMAGE-UX-CONSISTENCY-001 — Evidence

Fecha: 2026-08-31

## Mapa de consumidores

| Consumer | Component | Repository/action | Viewer |
|---|---|---|---|
| Mis Documentos | `DocumentRequirementList` | `upload` / `selfPreview` | `DocumentViewer` |
| Suti Préstamo | `UnifiedDocumentPhase` | `upload` / `selfPreview(SELF_SERVICE_LOAN)` | `DocumentViewer` |
| Membresías | `UnifiedDocumentPhase` | `upload` / `selfPreview(SELF_SERVICE_MEMBERSHIP)` | `DocumentViewer` |
| Program Product Payment | `UnifiedDocumentPhase` | contrato documental de Préstamo | `DocumentViewer` |
| Product/Marketplace request gates | `DocumentRequestGate → UnifiedDocumentPhase` | expediente efectivo | `DocumentViewer` |
| Admin Documents móvil | workbench de revisión | `adminPreview` | `DocumentViewer` interno |
| Admin Identity | `DocumentInspector` | lectura/revisión Admin | comportamiento `useMediaViewerDialog` |
| Admin Finance | preview inline de evidencia | `adminPreview` | inline; sin reemplazo |
| Home, Convenios, Marketplace, catálogo y Admin productos | consumidor de imagen | autoridad propia del dominio | `ImageViewer` global |

Admin Documents, Admin Identity y Admin Finance no permiten reemplazo porque son contextos de lectura/revisión; esta H no amplía `documents.write` ni agrega un uploader administrativo.

## Evidencia ejecutable

```text
node scripts/test-global-document-image-ux-consistency.js
PASS — contrato único, capacidades, safe-area, overlay, scroll/foco, sin URL cruda

node scripts/test-global-document-image-ux-consistency-browser.js
PASS — Chrome 390×844, 430×932 y 1280×900; X visible; imagen no cierra; overlay/Escape/X cierran; overflow/foco restaurados; cámara/archivo; fallo conserva documento; thumbnail actualizada; supabaseWrites=0

node scripts/test-loan-document-flow.js
PASS — 10 casos; versión enlazada, cámara, archivo, fresh signing y objeto físico

node scripts/test-loan-document-context-isolation.js
PASS — autoservicio/Admin separados y contexto backend

node scripts/test-membership-document-thumbnail-viewer.js
PASS — miniatura y viewer interno compartido

node scripts/test-static-suite.js
PASS — 76/76

node scripts/deploy-document-access.js status / verify
PASS — v1 ACTIVE; verify_jwt=true; bundle compilado con 4/4 marcadores
```

La prueba productiva de Membresías no se repitió porque el puerto local allowlisted `8080` estaba ocupado. El intento en un puerto aleatorio fue correctamente rechazado por CORS y no prueba un defecto productivo. No se detuvo el proceso externo ni se amplió `ALLOWED_APP_ORIGINS`. La evidencia live vigente de `H-LOAN-DOCUMENT-CONTEXT-ISOLATION-001` certifica tres cuentas, cross-user/anónimo denegados, TTL 300, tres firmas y cero secretos; el backend no cambió en esta H.

No se creó un reemplazo documental productivo sintético. El fallo y la actualización de miniatura se probaron en un harness browser aislado; el contrato persistente previo permanece documentado y no fue modificado.

## Safe area

Chrome headless no expuso `Emulation.setSafeAreaInsetsOverride`; por ello `safeAreaEmulated=false`. Se certificaron `viewport-fit=cover`, uso literal de `env(safe-area-inset-top/left/right/bottom)`, `position: fixed`, botón 48×48 dentro del viewport y layouts 390/430. Safari/iPhone físico queda como limitación explícita, no como afirmación inventada.

## Guardians

- Source of truth: SAFE — sin autoridad nueva, cache o fallback.
- Supabase security: PASS — sin cambio de RPC/RLS/Storage/Edge; previews conservan JWT, propósito, actor/contexto y firma temporal.
- Legacy Google: NOT APPLICABLE — cero lectura/escritura/cálculo.
- Claude UI preservation: PASS — secciones, cards, estados, cámara, archivo, zoom, pinch, navegación y controles Admin preservados; sólo se unificó la acción y el comportamiento modal.
- Recovery: NOT APPLICABLE — no migration ni mutación de datos; revert del commit frontend.

## Revisión arquitectónica independiente

`APPROVED`. La solicitud, el diff, los consumidores reales, las autoridades documentales, las pruebas estáticas/browser y la evidencia live vigente coinciden. No se detectó uploader o fuente paralela, navegación documental cruda, ampliación de permisos, pérdida de datos ni cambio financiero/Google. `docs/WORK_QUEUE_HISTORY.md` no existe; la ausencia no impide aceptar esta H y no autoriza avanzar otra tarea. La falta de Safari/iPhone físico permanece declarada como limitación permitida por el alcance.
