# H-MEMBERSHIP-ENABLED-CUTOVER-001 — Evidencia

## Hallazgo y corrección

`membership_offerings.enabled` ya era la autoridad única de visibilidad. La proyección frontend conservaba simultáneamente `enabled` y su alias `activo`: después de apagar una membresía, el switch cambiaba `activo=true`, pero `save()` combinaba ese valor con el `enabled=false` obsoleto y persistía nuevamente `false`.

La corrección es quirúrgica:

- `MembershipRepository.setEnabled(id, enabled)` escribe exclusivamente la columna `enabled` y verifica la representación persistida;
- `membershipStore.toggle()` usa ese writer dedicado;
- el editor prioriza el valor UI `activo` cuando está presente;
- Admin → Membresías inicializa el mismo store al entrar directamente, sin exigir una visita previa a Finanzas.

No se creó tabla, RPC, caché, fallback ni autoridad adicional. No cambiaron la card, navegación, solicitudes de membresía, documentos, catálogo financiero, cálculos, Google ni Apps Script.

## Autoridad y seguridad

```text
Admin switch
→ membershipStore.toggle
→ MembershipRepository.setEnabled
→ public.membership_offerings.enabled
→ RLS memberships.write
→ membershipStore.load
→ Finanzas / Membresías filtra activo=true
```

- Admin autorizado: activar/desactivar `PASS`.
- Usuario normal: escritura `DENIED`; lectura sólo de filas activas `PASS`.
- Anónimo: escritura `DENIED`.
- Fila histórica `Bud Tv Ultra`: procedencia y protección contra borrado preservadas.
- Estado final productivo: `Bud Tv Ultra enabled=true`.

## Verificación

```text
node scripts/test-static-suite.js
PASS 70/70

python scripts/test-membership-enabled-cutover-live.py
PASS — enable/disable real, filtro de lectura, normal DENIED, anon DENIED, estado final true

python scripts/test-phase4-live.py
PASS — 6/6 históricas, assets 6, CRUD Admin, historial protegido, normal DENIED

node scripts/test-membership-enabled-cutover-browser.js
PASS — switch real, persistencia tras refresh, card en Finanzas, desktop y 390x844
```

- UI Claude: estructura y estilos sin cambios; inspección visual desktop/móvil `PASS`.
- Bundle: 92 fuentes, SHA-256 `687412036B4592E615E981D948A0A2EA555B11842B1A67FBBE5CCB408EBEBE76`.
- Cache: `bundle.js?v=178`, `sutiapp-v122`.
- Registry: `FRESH`.
- Legacy: Google read/write `0/0`; Apps Script changes `0`; cálculos financieros modificados `0`.
- Secret/PII: ningún secreto ni dato personal agregado; las pruebas leen credenciales sólo desde `supabase.env` ignorado.
