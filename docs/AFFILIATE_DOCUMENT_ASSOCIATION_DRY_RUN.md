# Fase 2 — Affiliate Document Association Dry Run

Fecha: 2026-08-24  
Estado final: **PASS / CLOSED**  
Mutaciones: base de datos 0; Storage 0; Auth 0; Google 0.

## Autoridad y entradas

- Afiliados: `public.affiliates` — 947.
- Relaciones existentes: `public.affiliate_files` — 12,901.
- Registry privado: `public.private_assets` — 13,047.
- Procedencia: `public.historical_asset_sources` — 25,358.
- Inventario privado original: 25,358 referencias; SHA-256 `E86AE34B4552D18059A754F44074B4AE142E2E7A860591BBCDCE10E99137DC34`.
- Storage enumerado: `app-assets` 112; `private-assets` 13,047; `public-assets` 3.

Matching permitido y aplicado:

1. `affiliate UUID` existente;
2. `numero_control` TEXT exacto y único;
3. coordenada histórica única `source_file_hash + row + column + url_order` con control exacto.

Nombre utilizado: 0. Email utilizado: 0. Heurísticas/fusiones: 0.

## Clasificación

| Clasificación | Resultado |
|---|---:|
| `ALREADY_CORRECTLY_LINKED` | 12,901 |
| `EXACT_MATCH` | 0 |
| `AMBIGUOUS_MATCH` | 0 |
| `NO_MATCH` | 0 |
| `WRONG_EXISTING_LINK` | 0 |
| `ORPHAN_ASSET` | 0 |
| `ORPHAN_STORAGE_OBJECT` | 5 (`app-assets`) |

Las 12,901 relaciones ya existían antes del dry run. Cada una coincide en UUID, control raw, procedencia, asset registry, hash, tamaño, bucket, ruta y presencia del objeto. No existe una cola `EXACT_MATCH` por aplicar.

## Duplicados

- `numero_control`: 13 grupos / 28 afiliados.
- email normalizado: 7 grupos / 16 afiliados.
- Documentos ligados a controles duplicados: 367.
- Resolución de esos 367: exclusivamente `EXISTING_AFFILIATE_UUID` más procedencia histórica; control ambiguo solo = 0.
- Reasignaciones, fusiones y borrados: 0.

## Integridad física

- `private-assets`: 13,047 registry / 13,047 objetos; huérfanos 0.
- `public-assets`: objetos sin registry 0.
- `app-assets`: 5 objetos sin fila `app_assets`; clasificados `ORPHAN_STORAGE_OBJECT`, no borrados ni adoptados.

Fingerprints SHA-256 de `bucket:path` de los cinco objetos, sin revelar rutas:

```text
4E3BCCFB5CAB90A4D9CF91F3D6CB986EA68249002908A6E9DA7DF5E0D0B77674
5EDEF19FB77C0E27A1E9FEFFBB2D49355021D4ECD37F244BFC8C954E3FA58153
6359B26A820239A628CD90DBBEC0EB12FE9C01E1B9369C0BAA23F14E504EE2A0
6A3358AE04CB5255C0998B4692FC580880B12C11E943F0F9C133EE7D8AFEFB45
F307EDE1D24320661CE3DE01768227FE6B24EF043C116514DB1A3731D63044B8
```

No se propone borrarlos: su origen y consumidores deben auditarse antes de cualquier decisión.

## Controles adicionales

- Autoridad runtime de foto: Photo/DK = 487 filas / 487 afiliados / 0 múltiples.
- Diez filas adicionales comparten `file_key=profile_photo` fuera de Photo/DK y no forman parte del selector runtime.
- Referencias privadas no afiliado/legacy protegidas: 12,279; excluidas de asociación.
- Estados históricos: `LINKED` 13,324; `PENDING_DOMAIN_LINK` 12,031; `FAILED` 3.
- Los 3 `FAILED` corresponden a recuperación histórica ya gobernada; no se reintentaron.

## Guardians

```text
SOURCE OF TRUTH: SAFE
Authority: affiliates + affiliate_files/private_assets/app_assets + Storage
Fallbacks: 0
Conflicts: 0 en asociaciones de afiliado

SUPABASE SECURITY: PASS / READ ONLY
Secret solo en herramienta local; no se imprimió ni incorporó a frontend.
RLS no fue modificada.

LEGACY GOOGLE: READ ONLY / NO INTERACTION
No se consultó ni modificó Google, fórmulas, triggers o cálculos.
Las referencias legacy permanecen PENDING_DOMAIN_LINK.
```

## H-FASE-2-DRY-RUN RESULT

```text
Status: PASS
Files changed: script de dry run y documentación/gobierno
Source-of-truth verdict: SAFE
Invariant verdict: PASS — UUID/control TEXT/procedencia; cero heurística
Build: NOT APPLICABLE — sin cambio frontend/runtime
Tests: dry run live completo PASS; suite estática 34/34 PASS; py_compile PASS
Security: PASS — agregados sin PII, secretos o URLs
Legacy impact: READ ONLY / NO INTERACTION
Unexpected files changed: no detectados; metadata Git ausente
Known limitations: 5 ORPHAN_STORAGE_OBJECT requieren auditoría separada; no autorizada mutación
Evidence: `scripts/dry-run-affiliate-document-association.py`
```

Revisión arquitectónica independiente: `APPROVED`. La evidencia satisface el alcance documental; no existe cola automática por aplicar. Por decisión posterior del propietario, Fase 2 queda `PASS / CLOSED`: integridad `PASS`, writes deterministas pendientes 0, relaciones ambiguas 0, relaciones incorrectas 0 y riesgo huérfano en `private-assets` 0. No reabrir salvo regresión demostrable.

Los cinco objetos huérfanos de `app-assets` no pertenecen al expediente privado. Permanecen inmóviles bajo `APP-ASSETS-ORPHAN-AUDIT` y no bloquean Identidad/Expediente.
