# MASTER Phase 2 — Contenido dinámico y PWA

Fecha: 2026-08-21. Estado: **PASS**.

## Autoridad y datos

- Noticias: `news_articles/news_settings`, 0 registros iniciales. `DATA.noticias` y semillas Admin no se importaron.
- Educación/Tutoriales: snapshot Google read-only `B3E940D6508FA0FC571E16097391B69D859AD8F1BA587E536F5A2D312314E1E4`; 28 + 4 filas, todas despublicadas; payload/hoja/ordinal/hash preservados.
- Assets educativos: 12 procedencias, 11 objetos Storage únicos por deduplicación SHA-256, todos verificados.
- Copy administrable: `managed_copy_overrides`, 0 iniciales; proyección in-memory, sin `localStorage` productivo.
- UI estructural: menús, rutas, bottom navigation, secciones y formularios permanecen en código.

## Seguridad y legacy

Las cuatro tablas tienen RLS habilitada y forzada. H005_TEST recibió `news.read/write` y `content.read/write`; H005_TEST2 no pudo escribir, no vio borradores y sí leyó una noticia publicada durante una prueba reversible. No hay Secret Key en frontend. Google no recibió escrituras. Los tutoriales de Ahorro no migran datos, cálculos, solicitudes, fórmulas ni procesos financieros.

## UI/PWA

Inicio conserva carrusel/section, loading, error y empty. Admin Noticias conserva responsable, listado, alta, edición, publicación, imagen y orden; segmentación queda `PENDING BACKEND`. Educación usa el CRUD visual existente. Bundle: 68 fuentes, `v72`; cache PWA: `v17`.

## Evidencia

- `node scripts/test-phase2.js`: PASS.
- `python scripts/apply-phase2.py`: 0 news, 32 education, 0 published, 0 copy, 1 admin, forced RLS.
- `python scripts/test-phase2-live.py`: admin CRUD PASS; normal write DENIED; published read/unpublished hidden; cleanup PASS.
- `python scripts/import-phase2-education.py`: 32/32, 12 procedencias, 11 objetos verificados.
- Chrome headless: Auth, Admin, Noticias, Educación, PWA, Convenios y regresiones H-005–H-009 PASS.
