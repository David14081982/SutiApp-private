# SutiApp Architecture Registry

El Registry es un índice técnico derivado del repositorio. No participa en runtime, no escribe Supabase/Storage/Google/Auth y no sustituye código, migrations, RLS, repositories ni documentos normativos. Una contradicción siempre se resuelve inspeccionando la autoridad real.

## Artefactos

- `SUTIAPP_ARCHITECTURE_REGISTRY.json`: manifiesto, hashes, estadísticas, dominios y particiones.
- `registry-code.json`: hechos de archivos, pantallas, componentes, handlers, hooks y repositories.
- `registry-data.json`: tablas, columnas, FK, views, RPC, policies y buckets.
- `registry-edges.json`: grafo Observatory-ready con `nodes` y `edges`.
- `registry-search.json`: índice compacto de aliases y nombres técnicos.
- `architecture-overrides.json`: metadata semántica mínima no deducible con seguridad.

Cada relación automática conserva archivo, línea y método de extracción. Las relaciones semánticas declaradas quedan marcadas `DECLARED`; no deben usarse a ciegas si el código o schema cambió.

## Comandos

```powershell
python scripts/generate-architecture-registry.py generate
python scripts/generate-architecture-registry.py check
python scripts/generate-architecture-registry.py lookup "Credencial" --compact
python scripts/generate-architecture-registry.py incremental app/screens-credencial.jsx
python scripts/test-architecture-registry.py
```

`check` devuelve exit code `0` cuando está `FRESH` y `2` cuando está `STALE` o falta. El modo incremental exige declarar exactamente todos los archivos cambiados desde la última generación; si falta uno, falla cerrado. Para migrations, schema o cambios amplios puede usarse generación completa.

## Uso por Codex

La skill `sutiapp-architecture-navigator` se activa por defecto en este repositorio antes de los guardians. Ejecuta lookup, freshness e inspección focalizada. Si una feature no aparece, está stale, carece de evidencia o contradice el repo, hace discovery dirigido y actualiza el Registry después de confirmar la arquitectura.

No se regenera por cambios exclusivos de copy/CSS/spacing/color sin dependencias nuevas. Sí se actualiza ante cambios de pantalla, route, repository, RPC, Edge Function, tabla, columna, permiso, Storage, dependencia o fuente de verdad.

## Overrides

Agregar solo aliases humanos, límites legacy, autoridad semántica o relaciones demostradas que el análisis sintáctico no pueda resolver. No copiar allí el mapa completo. Nunca guardar valores de filas, correos, nombres personales, documentos, tokens, contraseñas o claves.

## Modelo y límites

El grafo normalizado puede alimentar un futuro Observatory sin otra migración de modelo. La detección usa statements SQL estructurados y llamadas literales seguras; código dinámico o relaciones indirectas pueden quedar incompletos. `Registry-first` significa punto de partida, no autoridad ni sustituto de inspección.
