# H-SUTIAPP-CREDENCIAL-PUNO-001 — Puño en la Credencial y reverso compacto

## Solicitud del propietario (2026-09-17)

1. En el frente de la Credencial, sustituir la marca pequeña de la esquina superior derecha (`FistMark` dibujado en código, 36 px) por la imagen del puño blanco entregada por el propietario (`uploads/PUNO-CREDENCIAL.PNG`, 500×500, fondo transparente), del mismo tamaño.
2. Reducir un poco el espacio vertical vacío entre el encabezado y la foto. Decisión del propietario: compactar los espacios del reverso sin cambiar el tamaño del QR.

## Diagnóstico

Frente y reverso comparten celda para el giro; el alto lo imponía el reverso (contenido ≈ 432 px en tamaño Normal) y dos mínimos de 420 px (`minHeight` del contenedor que gira y `[data-text-size] .su-credential-face` en `text-size.css`). Medido en producción antes del cambio: tarjeta 432/469/520 px y hueco 128/144/166 px (Normal/Grande/Muy grande).

## Implementación

- Recurso visual registrado (regla F1.8): `credencial.card.mark` en `assets-registry.jsx`, `src: ./assets/branding/credencial-puno.png` (derivado del original: margen transparente recortado y ajustado a 144×144 px, 17 KB). Consumido con `<Res>` a 36 px, `fit: contain`, decorativo (`alt=""`), sin encogerse en la fila flexible. `FistMark` sigue en Inicio.
- Reverso: franja superior 44→36 px, margen del título 22→16, del QR 18→12, del texto de renovación 16→12, del número 10→6 y padding inferior 24→18 (−34 px). QR 176 px sin cambios.
- Mínimos de altura 420→390 px (contenedor y `text-size.css`, cachebuster CSS v245).
- `scripts/build-pages-site.js` publica la imagen nueva.

Punto de restauración: tag `restore/pre-credencial-puno-20260917`.

## Verificación

- App real local contra Supabase productivo (`scripts/credencial-puno-verify.js`), cuatro tamaños de texto: marca 36×36 a 24 px de los bordes, imagen del registro cargada, QR 176 px, contenido dentro del área útil en ambas caras, sin desbordamiento horizontal, `ASSETS_REGISTRY.validate()` limpio, sin emitir QR. Normal: tarjeta 398 px y hueco 94 px (−34); Grande y Muy grande también −34 px.
- Trozo publicado de `screens-credencial.jsx` difería de su fuente sólo en espacios (línea `app, key: u.id` unida a mano); el build lo verifica sin espacios antes de recompilar.
- Regresión global local PASS (171 recursos, 248 imágenes de catálogo, sello, recarga, 0 errores, 0 mutaciones).
- Producción: `docs/qa/evidence/credencial-puno-20260917/result.md`.
