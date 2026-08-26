---
name: sutiapp-architecture-navigator
description: Localizar automáticamente el alcance e impacto de toda implementación, corrección, auditoría o modificación en SutiApp mediante el Architecture Registry, freshness, lookup por aliases y discovery dirigido. Usar antes de los guardians y de inspecciones globales para tareas de código, pantallas, repositories, Supabase, Storage, permisos, tests o arquitectura; actualizar el Registry solo si cambió arquitectura.
---

# SutiApp Architecture Navigator

Usar el Registry como GPS derivado para comenzar por evidencia focalizada. Nunca tratarlo como autoridad runtime ni como sustituto de código, migrations, RLS o documentación normativa vigente.

## Workflow obligatorio

1. Interpretar la intención y formar 1–4 términos humanos/técnicos de feature.
2. Ejecutar `python scripts/generate-architecture-registry.py check`.
3. Ejecutar `python scripts/generate-architecture-registry.py lookup <feature> --compact`.
4. Formar internamente el contrato de `references/context-contract.md`: archivos primarios, autoridad, backend, datos, permisos, tests e impacto.
5. Inspeccionar primero 3–10 archivos de mayor evidencia. Confirmar siempre el target contra código/schema actual.
6. Invocar después los guardians requeridos por `AGENTS.md`; esta skill localiza, no autoriza.
7. Implementar y ejecutar tests relacionados del lookup más controles globales proporcionales al riesgo.
8. Actualizar el Registry únicamente si cambió route, screen, repository, RPC, Edge Function, tabla, columna, permiso, Storage, dependencia o mapping de autoridad.

## Freshness y fallback

- `FRESH` + evidencia suficiente: usar lookup y verificación focalizada.
- `STALE`: revisar la lista exacta de cambios. Si son ajenos a la feature, validar sus hashes/impacto; si afectan la ruta, regenerar o actualizar incrementalmente antes de confiar.
- Feature ausente, evidencia débil o contradicción: ejecutar discovery dirigido con `rg` sobre nombres/aliases y luego seguir dependencias concretas. No pedir permiso para búsquedas técnicas read-only normales.
- Área sensible (Auth, RLS, Storage privado, permisos, impersonación, datos o legacy): ampliar inspección aunque esté fresh y aplicar el guardian correspondiente.
- Incorporar al Registry solo información demostrada; usar `architecture-overrides.json` únicamente para semántica no deducible.

## Actualización

Para un conjunto exacto de archivos modificados:

```powershell
python scripts/generate-architecture-registry.py incremental app/file-a.jsx scripts/test-file-a.js
```

Si el conjunto es amplio, cambió el generador/overrides o hay duda:

```powershell
python scripts/generate-architecture-registry.py generate
python scripts/test-architecture-registry.py
```

Cambios exclusivos de copy/CSS/spacing/color/microinteracción sin dependencia nueva no requieren regeneración estructural. El check puede quedar stale por esos cambios; documentar que son irrelevantes a la feature y no publicar un Registry falsamente fresh hasta la siguiente regeneración segura.

## Límites

- El Registry es `DERIVED_TECHNICAL_INDEX`, nunca runtime ni fuente productiva.
- No inferir `TESTED` por nombre; exigir referencia literal/evidencia.
- No guardar secretos, PII, valores de filas ni contenido documental.
- No tocar Supabase, Storage, Auth, Google o producción para navegar.
- No narrar rutinariamente el lookup al usuario. Informar solo gaps, stale relevante, conflicto, riesgo o decisión; respetar cualquier obligación superior de transparencia de skills.
