# H-SUTIAPP-BRANDING-SEAL-PHASE-001 — Sello institucional visible tras la carga completa

## Hallazgo

Durante H-SUTIAPP-VOTACIONES-LIVE-002 se verificó en producción que las tres instancias de `SutiSeal` de Inicio quedaban en `data-branding-seal-state="error"` sin imagen, con `VisualContent.getState()` en `phase: loaded`, `brandingPhase: error` y la identidad visual cargada.

Causa (desde 3a1b5ff, 2026-08-29): `publish()` completa con valores por defecto de error. En `bootstrap()`, las publicaciones de carga, éxito y falla del contenido visual no incluían `brandingPhase` (y las de carga/falla tampoco `branding`), así que la carga completa reiniciaba la fase de la identidad visual a `error`, y una falla de banners, pop-ups o empresas borraba el sello ya cargado. `SutiSeal` sólo pinta con `loaded`.

## Autorización y alcance

El propietario autorizó la corrección el 2026-09-17. Módulo compartido `app/visual-content.js` (trozo del bundle) → regresión global obligatoria en build local y GitHub Pages. También se actualiza el comentario de `LiveSeal` en `app/screens-voting.jsx` (sin cambio de comportamiento). Sin cambios de autoridad, datos, Supabase, Storage, service worker ni Auth.

Punto de restauración: tag `restore/pre-sello-inicio-20260917`.

## Corrección

`bootstrap()` conserva `branding`/`brandingPhase` en las publicaciones de carga y falla, y publica `brandingPhase: 'loaded'` junto con la identidad visual resuelta. `bootstrapBranding()` sigue siendo el único escritor de la fase ante éxito o error propio; `retry()` conserva su reinicio explícito.

## Verificación

- Diferencial (`scripts/test-branding-seal-phase.js`): versión publicada y corregida en 6 escenarios; fases de contenido, listas y autoridad de la cabecera de Inicio idénticas; sólo cambia la fase/identidad visual. La versión publicada reproduce el defecto.
- App real local contra Supabase productivo (`scripts/branding-seal-verify.js home`): 3 sellos `loaded` con imagen.
- Regresión global local (`scripts/branding-seal-verify.js global`): PASS.
- Producción: `docs/qa/evidence/branding-seal-20260917/result.md`.
