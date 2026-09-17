# H-SUTIAPP-CONVENIOS-ANUNCIOS-001 — Anuncios de Convenios con imagen, segmentación y color

## Solicitud y decisiones del propietario (2026-09-17)

Admin → Convenios y beneficios → Anuncios no guardaba y el «Espacio publicitario» de Convenios seguía vacío. Tras el diagnóstico el propietario eligió implementar de verdad la segmentación y el color de acento (datos en Supabase y carrusel filtrado por perfil) y dejar archivados los 13 anuncios eliminados de Balam y Willys.

## Diagnóstico (verificado en transacciones revertidas)

- El editor usaba un `<image-slot>` local: la imagen nunca subía a Supabase y `banners.image_asset_id` (obligatorio) iba vacío → `23502`.
- Guardaba `placement='convenios'`, prohibido por `banners_placement_check` (sólo `home`/`marketplace`) → `23514`; el carrusel lee `marketplace`.
- El editor se cerraba sin esperar la respuesta: el aviso de error pasaba inadvertido.
- Segmentación y color no tenían columnas: `projectAd` los descartaba y el carrusel no filtraba por perfil.
- Los 13 anuncios `marketplace` (Balam, Willys) fueron archivados el 2026-09-08 23:33 desde Admin; por eso el carrusel mostraba 0/0.

## Implementación

- Migración `20260917000100`: columnas `audience_mode`, `union_codes`, `employment_category_codes`, `gender_codes`, `tag_codes` (modelo de `company_benefits`) y `accent_hue` (0–360) con checks; grants por columna; `banners_public_read` = `enabled AND matches_current_affiliate_audience(...)`; RPC `list_public_banners(placement)` (visibles, no archivados, audiencia del usuario actual, administradores incluidos).
- `BannerRepository.list` usa la RPC (Inicio y Convenios); `visual-content` recarga los banners si cambia la persona autenticada.
- Admin: anuncios = banners `marketplace`; imagen subida con `uploadManagedAsset` (misma vía que Banners) y obligatoria; guardado esperando a Supabase con error dentro del editor; visibilidad sólo `enabled`; eliminar = `archive_admin_banner`; duplicar reutiliza la imagen; imágenes subidas y no usadas se descartan; audiencia convertida a códigos del catálogo. «Cargo en la aplicación» no se ofrece en anuncios: no hay etiquetas de segmento asignadas a afiliados (0 filas) y el anuncio no llegaría a nadie.
- Carrusel: `accent_hue` tiñe el fondo, el punto de «PATROCINADO» y la flecha; sin acento conserva el guinda.

Punto de restauración: tag `restore/pre-anuncios-segmentados-20260917` y esquema privado `ads_restore_private` (24 banners, 20 archivos, políticas y grants).

## Verificación

- SQL (`scripts/test-banners-audience.sql`, ROLLBACK): esquema y grants, validaciones, RPC y RLS por identidad (anónimo, afiliado, administrador), escritura como cliente REST, auditoría y recovery; el control negativo falla como debe.
- Navegador con login real (`scripts/anuncios-convenios-verify.js`): escrituras interceptadas; payload exacto, lista, visibilidad, error visible, archivo, descarte de imagen, RPC real y carrusel con acento.
- Regresión global local PASS. Producción: `docs/qa/evidence/anuncios-convenios-20260917/result.md`.
