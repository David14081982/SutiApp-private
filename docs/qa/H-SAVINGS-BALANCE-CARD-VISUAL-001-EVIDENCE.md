# H-SAVINGS-BALANCE-CARD-VISUAL-001 — evidencia

Fecha: 2026-09-02

## Solicitud y alcance

La tarjeta superior de la pantalla `Ahorrar` debe mostrar únicamente `Saldo actual` y su monto, con el contenido centrado y el importe más grande. Se preservan sin cambios el detalle anual, acciones, inscripción, navegación, drawers, estados y fuente financiera.

Archivos declarados:

- `app/screens-savings.jsx`
- `app/bundle.js`
- `SutiApp.html`
- `sw.js`
- `scripts/test-savings-shadow-foundation.js`
- `scripts/test-savings-ui-browser.js`
- `scripts/test-savings-user-ui-live-browser.js`
- esta evidencia y `docs/AGENT_CHANGELOG.md`

Fuera de alcance: `SavingsRepository`, `SavingsStore`, RPC, Supabase schema/RLS, Google Sheets, Apps Script, saldos, fórmulas, rendimientos, conciliación y writers.

## Autoridad y legacy

`SOURCE OF TRUTH AUDIT`: `SAFE`. La autoridad continúa siendo Google legacy y la pantalla sigue consumiendo exclusivamente `SavingsRepository -> get_self_savings_live_readonly()` mediante el espejo certificado. El saldo superior conserva `balances.total`, equivalente a `legacy_reported_balance_Q`. No se añadieron fuentes, cachés, mocks ni fallbacks.

`LEGACY GOOGLE AUDIT`: `SAFE CHANGE / NO INTERACTION`. Lecturas Google 0, escrituras Google 0, cálculos/triggers modificados 0, writers modificados 0. `node scripts/test-savings-current-baseline.js` confirmó el manifest/capture vigente, sin import ni cutover.

## Implementación

- Se retiró únicamente `sav-split` de la tarjeta superior, incluidos sus consumidores `data-savings-capital` y `data-savings-yield`.
- Se añadió `sav-balance-summary`: centrado horizontal/vertical, altura mínima de 132 px y monto responsivo `clamp(36px, 10vw, 42px)`.
- `Ahorro` y `Rendimiento` permanecen en `Detalle por año` mediante `data-savings-year-capital` y `data-savings-year-yield`.
- Bundle regenerado desde 99 fuentes; `SutiApp.html` avanzó a `bundle.js?v=195` y el service worker a `sutiapp-v139`.

Hashes SHA-256:

- `app/screens-savings.jsx`: `44A7A5C698964D2D5AF3B9618AECB9BAA6C78126E526580A894385107D48B075`
- `app/bundle.js`: `2178C6EB7081F93AE233AE148BD87D5551390EE925B8439125F38223E2937244`
- `SutiApp.html`: `1E68281BB634A32CB60ECC97EBB7E6C737144D8ABEDF0F380B6EBB8B0E1211CF`
- `sw.js`: `D2AA7D9852D268ECABA89787E1B8E86048AFFE439A575A300D34DFC78F35F489`

## Verificación

- `node scripts/build-bundle.js C:\tmp\sutiapp-babel-7.29.0.min.js`: `PASS`, 99 fuentes.
- `node scripts/test-savings-shadow-foundation.js`: `PASS`.
- `node scripts/test-savings-current-baseline.js`: `PASS`; Google writes 0, Supabase writes 0, import/cutover false.
- `node scripts/test-savings-user-ui-live-readonly.js`: `PASS`; autoridad `GOOGLE_LEGACY_AUTHORITY`, proyección `SHADOW_MIRROR`, Q mostrado exactamente, 17 tablas sin cambios, anónimo/cross-user denegados, Google reads/writes 0.
- `node scripts/test-savings-user-ui-live-browser.js`: `PASS`; Chrome real, bundle local, saldo superior único/centrado y tamaño >= 38 px, 390x844, 430x932, 768x1024 y 1366x900, refresh/back/empty/details preservados, overflow 0, errores browser 0, escrituras 0.
- Inspección visual manual de `active-390x844.png` y `active-1366x900.png`: `PASS`.
- `node scripts/test-protected-image-contract.js`: `PASS`, INV-173, 14 contratos.
- `node scripts/test-global-document-image-ux-consistency.js`: `PASS`.
- `node scripts/test-global-image-regression-production-live.js` contra GitHub Pages: `PASS`; 147 app assets, perfil, 29 legacy files, documentos self/admin, 248 imágenes de catálogo, Marketplace, Membership, fullscreen, refresh, service worker/no-service-worker y PDF legítimo; mutaciones 0.
- La misma matriz contra el build local: `FAIL` repetido con `DOCUMENT_PREVIEW_UNAVAILABLE` al invocar `document-access`, tanto en `127.0.0.1` como en `localhost`. La pantalla local de Ahorro y su saldo sí pasan; no se modificó la frontera documental para eludir el gate.
- `git diff --check`: `PASS` (sólo avisos de normalización LF/CRLF).

## Claude UI preservation

```text
CLAUDE UI PRESERVATION REVIEW

Screen: Ahorrar
Original sections: Header; resumen; detalle por año; acciones; Tu ahorro; Más detalles; sheets y estados
Current sections: Las mismas; el resumen aplica la simplificación solicitada por el propietario
Missing sections: Ninguna
Added sections: Ninguna
Interactions preserved: Refresh, información, acciones, historial, retiros y beneficiarios
Navigation preserved: Sí
Visual structure preserved: Sí, salvo el contenido retirado expresamente de la card
Unauthorized redesign: NO

Verdict: PASS
```

## Resultado

```text
H-SAVINGS-BALANCE-CARD-VISUAL-001 RESULT
Status: BLOCKED
Files changed: pantalla Ahorro, bundle/cache-buster, pruebas focales y evidencia
Source-of-truth verdict: PASS — autoridad, lector y valor del saldo intactos
Invariant verdict: PASS focal — INV-015, INV-174, INV-183, INV-184 e INV-185 preservadas
Build: PASS — bundle reproducible desde 99 fuentes
Tests: PASS focal; BLOCKED global por DOCUMENT_PREVIEW_UNAVAILABLE sólo en la matriz local
Security: NOT APPLICABLE al cambio; Auth/self/cross-user read-only PASS
Legacy impact: NO INTERACTION — Google read 0 / write 0 / calculation change 0
Unexpected files changed: 0
Known limitations: el gate INV-173 del build local no puede declararse PASS; GitHub Pages sí pasa completo
Evidence: este documento, comandos, diff y capturas temporales de Chrome
```

Recovery: revertir los siete archivos funcionales/pruebas declarados, regenerar `app/bundle.js` y restaurar `bundle.js?v=194` / `sutiapp-v138`. No hay recuperación de datos porque no hubo mutaciones.

## Revisión arquitectónica independiente

```text
# ARCHITECT REVIEW

Task reviewed: H-SAVINGS-BALANCE-CARD-VISUAL-001
Verdict: BLOCKED
What Codex did correctly: Cumplió el cambio visual exacto, mantuvo el saldo autoritativo, preservó el resto de la pantalla, regeneró el bundle y probó fuente/bundle con Chrome y datos reales.
Important findings: La matriz global de GitHub Pages pasa y las pruebas focales locales de Ahorro pasan; la matriz global local falla de forma repetible fuera de Ahorro en document-access.
Problems detected: INV-173 exige PASS local y Pages; DOCUMENT_PREVIEW_UNAVAILABLE impide cerrar PASS.
Architecture implications: No cambió ruta, repository, RPC, tabla, permiso ni mapping de autoridad; no corresponde regenerar el Registry por un cambio exclusivo de presentación.
Source-of-truth implications: Ninguna; Google legacy y get_self_savings_live_readonly permanecen como autoridad/proyección vigentes.
Security implications: Ninguna modificación; el fallo documental no autoriza relajar firma, RLS ni Edge.
Data implications: Cero mutaciones, importaciones, cutover o cálculo.
Owner decision required: NO
Recommended next action: Diagnosticar por separado DOCUMENT_PREVIEW_UNAVAILABLE del build local y repetir la matriz global; no ampliar esta H a seguridad documental sin una auditoría de alcance nueva.

# RESPONSE TO CODEX

No cierres H-SAVINGS-BALANCE-CARD-VISUAL-001 como PASS. Conserva el cambio visual ya verificado y registra el bloqueo exacto de INV-173. La siguiente acción técnica debe aislar document-access en el origen local, demostrar que no exige debilitar seguridad y repetir scripts/test-global-image-regression-production-live.js contra build local y GitHub Pages. No avances a otra H.

SUTIAPP ARCHITECT REVIEW

Task: H-SAVINGS-BALANCE-CARD-VISUAL-001
Verdict: BLOCKED

Critical findings: Implementación solicitada correcta; gate global local no satisfecho por DOCUMENT_PREVIEW_UNAVAILABLE.

Source of truth: PASS
Architecture: PASS focal; Registry sin cambio estructural
Security: Sin cambios; gate documental no dispensable
Data: Cero mutaciones
Legacy: NO INTERACTION

Owner decision: NO

Next action: Diagnóstico separado y read-only de document-access local; repetir matriz global.

Response generated for Codex: YES
```
