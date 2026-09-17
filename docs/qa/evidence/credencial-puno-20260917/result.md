# H-SUTIAPP-CREDENCIAL-PUNO-001 RESULT

Status: PASS

Files changed: app/screens-credencial.jsx (marca con `<Res resKey="credencial.card.mark">`, reverso compacto, mínimo 390 px), app/assets-registry.jsx (recurso `credencial.card.mark`), app/text-size.css (mínimo 390 px, v245), assets/branding/credencial-puno.png (144×144, derivado de `uploads/PUNO-CREDENCIAL.PNG`), scripts/build-pages-site.js (publica la imagen); app/bundle.js (trozos assets-registry.jsx y screens-credencial.jsx; 123 idénticos) y SutiApp.html (bundle `credencial-puno-20260917-001`, CSS v245); scripts de build/verificación; auditoría, AGENT_CHANGELOG, DECISIONS, Architecture Registry y evidencia.

Source-of-truth verdict: PASS — recurso visual registrado en `assets-registry.jsx` (regla F1.8); sin datos ni autoridades nuevas.

Invariant verdict: PASS — QR 176 px sin cambios; frente y reverso conservan el mismo alto para el giro; FistMark de Inicio intacto.

Build: PASS — bundle SHA-256 idéntico en git y https://sutiapp.com; `screens-credencial.jsx` publicado difería de su fuente sólo en espacios (verificado sin espacios antes de recompilar); artefacto de Pages simulado incluye la imagen.

Tests: PASS — app real local y productiva en Pequeño/Normal/Grande/Muy grande: marca 36×36 a 24 px de los bordes con imagen cargada, QR 176 px, contenido dentro del área útil en ambas caras, sin desbordamiento horizontal, `ASSETS_REGISTRY.validate()` limpio, 0 QR emitidos. Regresión global local y productiva PASS (171 recursos, 248 imágenes de catálogo, sello en acceso y recarga, 0 errores, 0 mutaciones).

Security: PASS — sin cambios de RLS, RPC, Storage, Auth ni service worker.

Legacy impact: NOT APPLICABLE.

Unexpected files changed: ninguno. Configuración local, vendor y credenciales de prueba usados temporalmente fuera de git y eliminados.

Known limitations: la precarga offline del service worker sigue listando versiones anteriores (`bundle.js?v=259`, `text-size.css?v=244`), como en las publicaciones previas; con conexión la estrategia red-primero sirve las versiones nuevas.

## Medición (Normal / Grande / Muy grande)

| | Antes | Después |
|---|---|---|
| Alto de la tarjeta | 432 / 469 / 520 px | 398 / 435 / 486 px |
| Hueco encabezado → foto | 128 / 144 / 166 px | 94 / 110 / 132 px |
| QR | 176 px | 176 px |

Evidence: local.json / production.json y capturas frente/reverso por tamaño; global-local.json / global-production.json; build.json; deployment.json (commit 54d3ba8, run https://github.com/David14081982/SutiApp-private/actions/runs/35228208927 SUCCESS).

Recuperación: `git revert 54d3ba8` y push a main (base: tag `restore/pre-credencial-puno-20260917`). Sin cambios de base de datos.
