# H-HOME-HEADER-001 — Foto administrable del header colapsado

Fecha: 2026-08-24

## Resultado

Inicio consume exclusivamente `home.header.collapsed`. La imagen permanece invisible con el header expandido y aparece entre 35 % y 100 % del recorrido de colapso. El mismo progreso aplica parallax de 55 % y escala 1.08 → 1.00 con `object-fit: cover` y `object-position: 50% 32%`; no existe velo, transición de layout ni captura de eventos.

La resolución verificada es:

```text
app_assets/Storage override Admin
  → image-slot de usuario
  → assets/branding/home-header-collapsed.webp
  → icono image
```

`BrandingRepository` carga el override por `asset_key`; `VisualContent` lo proyecta en memoria mediante `assetsStore.setAuthoritative`, que notifica a `useAsset` sin recarga ni polling. El upload usa la frontera H-008/H-009 y `assets.write`; restaurar cambia el registro a `DISABLED` y conserva su procedencia.

## Evidencia

- Default local: WebP 825 × 343, 83,070 bytes; SHA-256 `1DEE759148B7D510D201C418FCC9918F14039F6248810A8EC5E21EFB1EDE4CC9`.
- Build: 83 fuentes con Babel Standalone 7.29.0; `node --check app/bundle.js` y `node --check sw.js` PASS.
- Cache busting: HTML `bundle.js?v=113`; PWA `sutiapp-v57`; asset incluido en `CORE`.
- Prueba unitaria/estática: `node scripts/test-home-header-collapsed.js` PASS, incluida precedencia y dos notificaciones reactivas.
- Chrome real autenticado: expandido `opacity=0`; colapsado `opacity=1`, `translateY(50.6px) scale(1)`; regreso `opacity=0`; saludo/chips 1 → 0 → 1; sin scroll horizontal.
- Admin real: preview `cover / 50% 32%`, botones “Subir / reemplazar” y “Restaurar la original”, recomendación 1200 × 500 visible.
- Regresión: icon-installation, H-007, H-007.2, H-009, Claude UI preservation, loan simulator, MASTER Phase 1 y program catalog PASS.

```text
H-HOME-HEADER-001 RESULT
Status: PASS
Files changed: app/assets-registry.jsx; app/assets-store.jsx; app/visual-repositories.js; app/visual-content.js; app/admin-repository.js; app/screens-admin-branding.jsx; app/app.jsx; app/bundle.js; assets/branding/home-header-collapsed.webp; SutiApp.html; sw.js; scripts/test-home-header-collapsed.js; scripts/test-home-header-collapsed-browser.js; cache-version assertions; docs/SOURCE_OF_TRUTH.md; docs/INVARIANTS.md; docs/DECISIONS.md; docs/HOME_HEADER_COLLAPSED_RESULT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — app_assets/Storage es el override Admin; slot/default/icon son capas inferiores expresamente autorizadas por ADR-054
Invariant verdict: PASS — una sola clave consumida, proyección Supabase descartable y localStorage bloqueado para este recurso
Build: PASS — 83 fuentes, bundle/sw syntax, HTML v113, PWA v57
Tests: PASS — unidad/estática, regresión y Chrome real
Security: PASS — assets.write + RLS/Storage existentes; sin secreto ni service_role frontend
Legacy impact: NOT APPLICABLE — Google, Ahorro, Préstamos y sistemas financieros no se leyeron ni modificaron
Unexpected files changed: no evaluable por ausencia de metadata Git; inventario explícito registrado
Known limitations: no se ejecutó una mutación productiva de upload durante QA; se verificaron la frontera existente, el control UI y la propagación reactiva en memoria
Evidence: este documento y salida de las suites indicadas
```
