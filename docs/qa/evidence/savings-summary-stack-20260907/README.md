# Corrección del resumen de Ahorro

El resumen completo queda **arriba de Cobranza, Ahorradores, Retiros y cambios y Revisión**, tanto en móvil como en escritorio. Se conservan las tarjetas, sus importes y las acciones existentes.

La causa era una regla que usaba el ancho de la ventana, aunque la aplicación estuviera dentro de un marco de teléfono de 430px. Activaba una columna fija de 340px y dejaba solo 18px para las pestañas y el contenido. La prueba anterior al cambio reprodujo ese problema y midió 72px de desbordamiento horizontal.

Ahora el resumen y el contenido siguen una sola columna. Las reglas de tamaño de expedientes y hojas de corrección utilizan el ancho real de Ahorro. En el mismo marco de 430px, resumen y pestañas disponen de 398px y el desbordamiento es cero. El resumen termina antes de que empiecen las cápsulas.

## Evidencia

- `before-result.json`, `before-geometry-frame-430.json`, `before-summary-frame-430.png`: reproducción del fallo anterior.
- `browser-result.json`, `geometry-*.json`, `summary-*.png`, `correction-*.png`: diez escenarios, incluidos marcos de 320/375/390/430 dentro de una ventana de 1440px y vistas completas de 320/375/390/430/900/1440px. Redimensionamiento 430 → 320 → 900 → 430 sin recargar. Resumen antes de las cuatro pestañas, ancho disponible, expediente y hoja de corrección comprobados.
- `interactions-result.json`: regresión de búsqueda, filtros, páginas, navegación, descuentos, retiros, correcciones con observación vacía, marcar/reabrir y estados de error/reintento.
- `local-startup.json`: build de entrega de 108 módulos y arranque sin errores con y sin service worker. Contiene la corrección y corresponde a versión 219 / caché 166. Esta prueba de arranque es anónima; no se presenta como aceptación de sesión administrativa real.

Las capturas emplean datos aislados de prueba. No se añadieron datos demostrativos a producción. Se probó Chromium; no se afirma una prueba física de Safari/iPhone.

## Alcance e integridad

El único cambio de producto está dentro del texto CSS de `app/savings-panel-admin.jsx`. La comparación del archivo antes/después excluyendo ese texto es idéntica. No cambiaron componentes, cálculos, consultas, permisos, Folios, observaciones ni guardados. Se actualizó el modo de prueba visual en `scripts/test-savings-reference-panel-browser.js` y se regeneraron bundle e identificadores de caché. No hubo migraciones, escrituras de datos ni acceso a Google Sheets.

El Registry de entrega estaba FRESH en la base 370b9c5. No se regeneró: son cambios de CSS y pruebas, sin nueva arquitectura, ruta, RPC, dependencia ni autoridad. Sus hashes pueden quedar stale para estos archivos conforme al Navigator. El Registry local anterior y los demás cambios pendientes se preservan.

La recuperación consiste en restablecer el CSS anterior y regenerar los archivos de entrega. No requiere recuperación de datos. Esta corrección no declara terminada la operación financiera pendiente de la entrega anterior.

```text
H-SAVINGS-SUMMARY-STACK-001 RESULT
Status: PASS for the requested layout correction.
Files changed: app/savings-panel-admin.jsx (CSS only), scripts/test-savings-reference-panel-browser.js, audit/evidence, generated bundle and SutiApp.html/sw.js cache identifiers.
Source-of-truth verdict: unchanged; no data/repository change.
Invariant verdict: PASS; identical non-CSS product source.
Build: PASS, isolated delivery 108 modules.
Tests: reproduced original failure; 10 layout scenarios + 5 full interaction viewports PASS; local startup PASS.
Security: existing server authorization untouched; no credentials added.
Legacy impact: none; no financial or Google writes.
Unexpected files changed: none in release; unrelated working changes preserved.
Known limitations: physical Safari and authenticated production session not claimed; prior financial scope unchanged.
Evidence: this directory and docs/audits/H-SAVINGS-SUMMARY-STACK-001.md.
```

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin Ahorro.
Original sections: summary cards, four tabs, records, detail, history and correction sheets.
Current sections: identical sections; summary now above tabs at every size as requested.
Missing sections: none.
Added sections: none.
Interactions preserved: verified by the existing interaction suite.
Navigation preserved: tabs, filters, individual record navigation and return unchanged.
Visual structure preserved: card content/style retained; sidebar removal explicitly authorized by owner.
Unauthorized redesign: NO.
Verdict: PASS for this correction.

## ARCHITECT REVIEW

Task reviewed: H-SAVINGS-SUMMARY-STACK-001.
Verdict: APPROVED for this bounded visual correction.
Evidence contrast: failing baseline gives 18px content/72px overflow; corrected frame gives 398px content/0px overflow with summary above tabs. Wider and narrower frames plus container resizing pass. Non-CSS product source is identical. Git diff limits executable change to this module's CSS and generated artifacts.
Source of truth / security / data / legacy: unchanged. No backend or financial equivalence claim is needed for CSS. Global image regression NOT APPLICABLE under AGENTS.md: no shared shell, Auth, Storage, shared repository or service-worker logic changed.
Owner decision required: NO. The three screenshots explicitly authorize this layout.
Next action: deliver this verified fix; do not expand into unresolved financial operation merely to close a visual task.

### RESPONSE TO CODEX

Aprueba la corrección visual H-SAVINGS-SUMMARY-STACK-001 dentro de su alcance. Verifica los archivos publicados y conserva íntegros los cambios locales ajenos. No presentes este cambio visual como cierre de la migración financiera completa.

SUTIAPP ARCHITECT REVIEW
Task: H-SAVINGS-SUMMARY-STACK-001
Verdict: APPROVED
Critical findings: original responsive failure reproduced and corrected.
Source of truth: unchanged.
Architecture: CSS-only; registry structural regeneration not required.
Security: unchanged.
Data: unchanged.
Legacy: no impact.
Owner decision: NO
Next action: publish and verify this scoped release.
Response generated for Codex: YES
