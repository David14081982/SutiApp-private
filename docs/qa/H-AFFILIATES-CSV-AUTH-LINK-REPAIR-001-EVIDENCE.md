# H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001 — Evidencia

Fecha: 2026-09-04
Estado: `PASS / APPLIED / VERIFIED`

## Autoridad y alcance

- Fuente owner: `C:\Users\david\Downloads\Usuarios (8).csv`.
- Filas: `947`.
- SHA-256: `3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29`.
- Relación autorizada: email CSV columna C, normalizado sólo con `trim + lowercase`, hacia `numero_control` columna A tratado como texto.
- Autoridades productivas conservadas: `auth.users.id` para el principal; `public.affiliates.id/numero_control/auth_user_id` para afiliación y vínculo.
- Fuera de alcance y sin cambios: email/contraseña Auth, `historical_email_raw`, `historical_email_normalized`, nombre, control, perfil, altas, merges, estructura visual, Storage y legacy Google/financiero.

## Preflight fijado dentro de la transacción

```text
AUTH LINKS CHECKED:             84
CORRECT BEFORE:                 65
WRONG CONTROL LINKS FOUND:      15
DETERMINISTIC REPAIRS:          11
AMBIGUOUS / UNMAPPED SKIPPED:    8
CSV DUPLICATE CONTROL VALUES:   13
CSV DUPLICATE EMAIL VALUES:      7
```

Durante el preflight aparecieron dos activaciones productivas nuevas. El apply no reutilizó los conteos anteriores: volvió a leer bajo `SHARE ROW EXCLUSIVE` sobre `affiliates`, tomó `FOR SHARE` sobre los principals vinculados y validó los conteos actuales antes de escribir.

## Reparaciones aplicadas

Cada fila conserva exactamente el mismo `auth.users.id`; sólo se quitó `auth_user_id` del origen y se asignó al destino indicado.

| Correo Auth confirmado | Control origen | Control destino | Afiliado destino |
|---|---:|---:|---|
| `marthasanchez2366@gmail.com` | 13301 | 13526 | SANCHEZ LOPEZ MARTHA JAZMIN |
| `yanelifrias19@gmail.com` | 12721 | 10861 | FRIAS VALENZUELA YANELI SARAI |
| `marthaeunice8@hotmail.com` | 13437 | 9176 | GARCIA SIQUEIROS MARTHA EUNICE |
| `liiz1091@hotmail.com` | 4697 | 9751 | ESPINOZA CONTRERAS LIZBETH GUADALUPE |
| `borquezveronica12@gmail.com` | 10448 | 12737 | BORQUEZ PESQUEIRA VERONICA LUZBET |
| `azzareth_cabrera@hotmail.com` | 12087 | 13609 | CABRERA TORRES ANNAYR AZZARETH |
| `denisseleon-91@hotmail.com` | 13609 | 9690 | LEON LUGO DENISSE KARINA |
| `lupita_8166@hotmail.com` | 11094 | 7144 | MARTINEZ RIVERA GUADALUPE |
| `eli-ruiz10@hotmail.com` | 8506 | 12394 | RUIZ GALVEZ ELISA ISABEL |
| `aurelioangulo82@gmail.com` | 10735 | 4607 | ANGULO VALENZUELA CARLOS AURELIO |
| `cosaf@hotmail.com` | 224761 | 1536 | PRECIADO RAMIREZ XOCHITL NOHEMI |

Batch productivo: `8ebd3cd8-1f57-5054-953d-c2a7fe12af66`. El snapshot contiene 21 afiliados —la cadena 13609 comparte origen/destino— y la auditoría contiene exactamente 11 reparaciones.

## Casos omitidos sin escritura

| Cuenta/control actual | Mapeo CSV observado | Motivo |
|---|---|---|
| `juanmanuel.valenzuela.77@gmail.com` / 7370 | → 1412 | control actual duplicado en CSV |
| `caroarmentaromero@gmail.com` / 10298 | → 7257 | control actual duplicado en CSV |
| `blanca.vero08@gmail.com` / 6614 | → 13838 | control actual duplicado en CSV |
| `payasitokikinc@gmail.com` / `NULL` | → 7130 | control actual vacío |
| cuatro fixtures `AUTHCERT-*` archivados | sin email en CSV | QA/no mapeables; sin tocar |

Los primeros cuatro explican los cuatro cruces todavía observables al comparar sin excluir ambigüedad. No son casos unívocos y fueron omitidos por regla expresa. En el conjunto unívoco, los cruces restantes son `0`.

## Postflight productivo

```text
AUTH LINKS CHECKED:                         84
CORRECT AFTER:                              76
AMBIGUOUS / UNMAPPED SKIPPED:                8
DETERMINISTIC CROSS-USER LINKS REMAINING:    0
AUTH UUIDS LOST OR CREATED:                   0
RESOLVERS VERIFIED:                          84
REPAIR AUDIT ROWS:                           11
SNAPSHOT ROWS:                               21
public.affiliates rows:                     954
```

Validación obligatoria:

```text
cosaf@hotmail.com
→ auth.users.id 42cf7acd-12c0-4f9e-8713-ff46570a81c3
→ public.affiliates.id d2636f3d-09e6-4fb6-b4d3-47b6c6f05b5f
→ numero_control 1536
→ PRECIADO RAMIREZ XOCHITL NOHEMI
PASS

numero_control 224761
→ auth_user_id NULL
PASS
```

`get_affiliate_activation_status('cosaf@hotmail.com')` devuelve `ALREADY_ACTIVATED`. Para cada uno de los 84 vínculos, una sesión backend focal comprobó `get_current_affiliate_access_state()` y `get_effective_affiliate_id()`; los 80 no archivados resolvieron su fila exacta y los cuatro fixtures archivados conservaron estado cerrado `ARCHIVED`. Los 11 reparados también pasaron `claim_affiliate_identity()` idempotente sin otra escritura.

## Seguridad y recuperación

- Las tres tablas de evidencia tienen RLS habilitada y forzada, sin `SELECT` para `anon` o `authenticated`.
- Apply/recovery son ejecutables sólo por `service_role`; el helper de certificación no es ejecutable por browser.
- La excepción requiere batch `APPLIED`, UUID Auth, email Auth confirmado, afiliado destino y control destino exactos.
- Forward + schema recovery compilaron juntos dentro de `ROLLBACK`.
- El recovery de datos restauró los 11 vínculos desde el snapshot dentro de `ROLLBACK`; los cambios persistentes del recovery fueron `0`.
- Recovery real aborta si cualquiera de las 21 filas dejó de coincidir con el estado/timestamp aplicado.

## Comandos focales

```text
python -m py_compile scripts/apply-affiliate-csv-auth-link-repair.py
PASS

node scripts/test-affiliate-csv-auth-link-repair.js
affiliate csv auth link repair static PASS

python -c "... m.schema_dry_run(...)"
schema+recovery dry-run PASS

python scripts/apply-affiliate-csv-auth-link-repair.py --apply --confirm APPLY-H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001
APPLIED / 84 checked / 11 repaired / 76 correct_after / 0 deterministic_cross_links_after

python scripts/apply-affiliate-csv-auth-link-repair.py
DRY_RUN / 84 checked / 76 correct / 0 repairable / 8 ambiguous / cosaf_correct_present=true
```

Artefacto local de reparaciones: `C:\Users\david\Downloads\H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001-RESULT.csv`, 11 filas, SHA-256 `10C396C906E03E1CB1F35EAD9AD96088C014B2AFF80E01C3869B71A1595CF5F4`.

## Contrato cliente y publicación

El backend certificado autoriza las 11 excepciones estrechas a la comparación con correo histórico. `AffiliateRepository.getCurrentAffiliate()` conserva la comprobación exacta `affiliate.auth_user_id === auth.uid()` y delega la vigencia de UUID+correo confirmado+afiliado+control a `get_current_affiliate_access_state()` y `get_effective_affiliate_id()`; ya no vuelve a invalidar en navegador una reparación que ambos resolvedores aprobaron. La URL cambió a `affiliate-repository.js?v=5` y el app-shell a `sutiapp-v151` para expulsar la copia previa. No cambiaron JSX, layout, copy, navegación ni bundle.

La prueba focal de sesión pasó login, restauración, refresh, logout y fallo cerrado si el RPC no existe. El guardian visual confirmó paridad estructural total. Por tratarse de un repository compartido y del service worker, se intentó además la regresión protegida tanto sobre el build local como sobre GitHub Pages: en ambos orígenes no llegó a ninguna superficie autenticada porque Supabase Auth rechazó el fixture preexistente `H005_TEST` con `400 invalid_credentials`. No se modificó su contraseña ni identidad para forzar el E2E. Esta indisponibilidad QA no alteró el postflight backend, que volvió a comprobar 84 vínculos, 76 correctos y 0 cruces determinísticos.

## Publicación

- Commit funcional: `78a84cbc5a26aab3e916def3d5e025fc002fde78`.
- Workflow Pages `33923747999`: `SUCCESS`.
- Read-back público: HTML `v=5`, repository con validación backend certificada y service worker `sutiapp-v151`.
- Regresión protegida local/publicada: `BLOCKED` exclusivamente en login por `H005_TEST = invalid_credentials`; ninguna superficie ni dato productivo fue mutado por esos intentos.
