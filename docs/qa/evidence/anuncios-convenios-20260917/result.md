# H-SUTIAPP-CONVENIOS-ANUNCIOS-001 RESULT

Status: PASS

Files changed: supabase/migrations y recovery 20260917000100_banners_audience.sql; app/visual-repositories.js (lector por RPC), app/visual-content.js (recarga de banners al cambiar la sesión), app/admin-repository.js (campos de audiencia y acento), app/admin-cutover-store.jsx (anuncios = banners marketplace, guardado, visibilidad, archivo, duplicado, previsualización por audiencia), app/screens-admin-convenios.jsx (subida de imagen, errores en el editor, segmentación sin cargo), app/screens-convenios.jsx (color de acento); app/bundle.js (6 trozos; 119 idénticos) y SutiApp.html (`anuncios-convenios-20260917-001`); scripts de restauración, matriz SQL, backend y verificación; auditoría, AGENT_CHANGELOG, DECISIONS, INVARIANTS (INV-233/234), MIGRATION_RULES, SOURCE_OF_TRUTH, Architecture Registry y evidencia.

Source-of-truth verdict: PASS — `public.banners` es la única autoridad de anuncios, audiencia y acento; imágenes en `app-assets`/`app_assets`; el almacén local `admin-store.jsx` deja de participar.

Invariant verdict: PASS — INV-233 (audiencia evaluada en backend por RPC y RLS) e INV-234 (eliminar archiva); los 13 anuncios archivados de Balam y Willys y los 20 archivos totales siguen intactos.

Build: PASS — bundle SHA-256 967577aa15db698643bf2f0ea6cc88e6b429d83b1dfc7770f01e0a1a31b9a035 idéntico en git y https://sutiapp.com.

Tests: PASS — matriz SQL con ROLLBACK (esquema, grants, validación, RPC y RLS para anónimo, afiliado y administrador, escritura REST, auditoría, recovery) con control negativo; navegador con login real local y productivo (8 comprobaciones, escrituras interceptadas); regresión global local y productiva PASS.

Security: PASS — la audiencia se aplica en backend (RPC `security definer` y política RLS); grants de escritura sólo por columna para `authenticated`; guardias de sección y auditoría existentes sin cambios.

Legacy impact: NOT APPLICABLE.

Unexpected files changed: ninguno. Configuración local, vendor y credenciales de prueba usados temporalmente fuera de git y eliminados.

Known limitations: la verificación no creó anuncios reales (todas las escrituras del navegador se interceptaron); el primer anuncio real lo crea el propietario desde Admin. «Cargo en la aplicación» no se ofrece en anuncios mientras no existan etiquetas de segmento asignadas a afiliados. La audiencia usa la cuenta autenticada: durante «Tomar control» el carrusel sigue el perfil del administrador, igual que los beneficios de Convenios.

Evidence: restore-point.json; backend.json, applied.json, installed.json; local-browser.json y production-browser.json con capturas (editor, lista, error, carrusel); global-local.json y global-production.json; build.json; deployment.json (commit 0aab1d9, run https://github.com/David14081982/SutiApp-private/actions/runs/35234161740 SUCCESS).

Recuperación: ejecutar `supabase/recovery/20260917000100_banners_audience.sql` (elimina la RPC y restaura la política anterior sin borrar datos) junto con `git revert 0aab1d9` y push a main (base: tag `restore/pre-anuncios-segmentados-20260917`).
