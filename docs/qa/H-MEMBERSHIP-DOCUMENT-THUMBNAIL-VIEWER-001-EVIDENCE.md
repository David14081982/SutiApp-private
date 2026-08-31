# H-MEMBERSHIP-DOCUMENT-THUMBNAIL-VIEWER-001 — Evidencia

Fecha: 2026-08-31
Estado: `PASS`

## Alcance y autoridad

- Pantalla: Solicitud de Membresía → Documentos → Documentos del expediente.
- Autoridad preservada: `affiliate_documents` + `affiliate_files` + `private_assets` / bucket privado `private-assets`.
- Lectura de metadatos: `list_effective_affiliate_documents('SELF_SERVICE_MEMBERSHIP')`; continúa devolviendo cero URL y cero path de Storage.
- Visualización: `DocumentWorkflowRepository.selfPreview()` → Edge `document-access` → `authorize_self_document_preview` → signed URL de 300 segundos, `private, no-store` y auditoría `SIGN_PREVIEW`.
- Escritura/reemplazo: writer existente `register_affiliate_document`; no se creó tabla, caché, base64, fallback ni copia local productiva.
- Schema, RLS, Edge, datos documentales y cálculos financieros modificados: `0`.

## Implementación verificada

- Cada imagen vigente solicita una firma temporal en memoria y ocupa el recuadro completo con `object-fit: cover` y el radio existente.
- La tarjeta llena ya no usa negro como representación principal; mientras no existe preview renderizable muestra un estado documental neutro.
- Tap en tarjeta o acción `Ver` solicita siempre una firma nueva y abre `ImageViewer` dentro de SutiApp. PDF usa `DocumentViewer` interno; otros formatos muestran un estado controlado sin URL cruda ni navegación externa.
- Nombre, estado, `Ver` y `Reemplazar` permanecen visibles; cámara/archivo y upload writer no cambiaron.
- Un error de carga regenera la firma una vez; un archivo dañado no entra en ciclo infinito.
- Al completar upload, el `await onChanged()` existente relee Supabase; el cambio de `documents` invalida la miniatura anterior y firma la versión nueva.

## Evidencia ejecutada

### Build y estática

```text
node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js
Built app\bundle.js from 92 files.
SHA-256: D5CBC4CC294790F806D96B080D2755ED6867A15750A7EEDA4FEA2297C1617CC9

node scripts/test-membership-document-thumbnail-viewer.js
PASS

node scripts/test-static-suite.js
PASS — 71/71; failures: 0

git diff --check
PASS
```

### Chrome real + Supabase actual

`node scripts/test-membership-document-thumbnail-viewer-browser.js`

```text
PASS
Account: H005_TEST2
Real image documents: 4
Mobile 390x844: 4/4 natural image, cover, full-card, non-black
Desktop 1280x900: PASS; horizontal overflow: 0
Name/state/Ver/Reemplazar: 4/4
Fresh signature on open: PASS
In-app ImageViewer: PASS
Invalid/expired thumbnail regeneration: PASS
Refresh from Supabase: PASS
Replacement reactivity (isolated, no production write): PASS
Supabase document writes: 0
Raw signed URLs logged: 0
```

La prueba aislada de reemplazo cambia el documento efectivo de `old-thumb-doc` a `new-thumb-doc` y demuestra que el `src` y la miniatura se actualizan sin refresh. El enlace con el writer real queda cubierto por el contrato estático `upload → await onChanged() → documents nuevos`; no se creó una versión artificial en el expediente productivo de la cuenta QA.

### Seguridad viva

`python scripts/test-loan-document-context-isolation-live.py`

```text
PASS — 8 casos / 3 cuentas
Self owner isolation: PASS
Cross-user preview: DENIED
Anonymous: DENIED
Admin explicit target: PASS
Impersonation actor/context: PASS
Signed URL TTL: 300 seconds
Metadata signed URLs: 0
Secrets logged: 0
```

## Preservación visual y funcional

- Se conservan hero, tracker, grid de dos columnas, privacidad, datos, footer, navegación exacta de regreso y sheets de cámara/archivo.
- No se eliminaron acciones ni estados existentes.
- No se persistieron capturas de los documentos QA para evitar PII local; la evidencia de navegador conserva únicamente métricas y booleanos agregados.
- Suti Préstamo, Historial, documentos compartidos y workflows conservaron sus contratos; la suite completa pasó.

```text
H-MEMBERSHIP-DOCUMENT-THUMBNAIL-VIEWER-001 RESULT
Status: PASS
Files changed: viewer compartido; consumidor documental; CSS de Solicitud de Membresía; bundle/cache; tests; evidencia; Registry
Source-of-truth verdict: PASS — expediente y Storage privado preservados; signed URL temporal sólo en memoria
Invariant verdict: PASS — INV-036, INV-049, INV-050, INV-097, INV-122, INV-125, INV-126, INV-127 e INV-132 preservadas
Build: PASS — 92 fuentes; SHA-256 D5CBC4CC294790F806D96B080D2755ED6867A15750A7EEDA4FEA2297C1617CC9
Tests: PASS — 71/71 static; Chrome real 4 documentos móvil/desktop; refresh/expiry/replacement reactivo
Security: PASS — self-only; cross-user/anon DENIED; TTL 300; listado sin URL/path; cero secretos
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0 / financial calculations changed 0
Unexpected files changed: 0
Known limitations: formatos no renderizables muestran estado documental controlado; no se efectuó un reemplazo persistente en la cuenta QA
Evidence: este documento
```
