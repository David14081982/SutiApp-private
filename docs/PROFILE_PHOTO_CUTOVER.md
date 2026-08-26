# PROFILE PHOTO CUTOVER GLOBAL

## Auditoría y autoridad

- Fuente histórica: `Usuarios SUTIAPP.xlsx`, hoja `Usuarios`, columna semántica `Photo`, columna física `DK`, hash `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591`.
- MASTER ASSET EVACUATION registró 487 referencias privadas `profile_photo` en `affiliate_files`; las 487 conservan registry y objeto Storage, 0 tienen relación ambigua y 0 difieren de `historical_asset_sources`.
- Autoridad runtime: `affiliate_files → private_assets → private-assets`. La URL firmada es temporal/derivada.
- No hubo descarga, migración, SQL ni escritura remota.

## Consumidores auditados

| Consumidor                              | Clasificación antes            | Resultado                                               |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| TopBar / avatar superior                | INITIALS_ONLY                  | CONNECTED_TO_PROFILE_PHOTO                              |
| Perfil                                  | INITIALS_ONLY                  | CONNECTED_TO_PROFILE_PHOTO                              |
| Credencial digital / frente             | INITIALS_ONLY                  | CONNECTED_TO_PROFILE_PHOTO                              |
| Credencial QR / reverso                 | Sin slot de avatar en Claude   | NOT APPLICABLE; estructura preservada                   |
| Admin / Identidad y contexto            | MISSING_BINDING                | CONNECTED_TO_PROFILE_PHOTO con permiso `assets.read`    |
| Impersonación                           | MISSING_BINDING                | CONNECTED por la misma proyección del afiliado efectivo |
| Inicio / saludo                         | Usa el TopBar compartido       | CONNECTED_TO_PROFILE_PHOTO                              |
| Historial y solicitudes propias         | No contienen slot de avatar    | NOT APPLICABLE; no se añadió estructura                 |
| Directorio/Comité y fichas de sindicato | Avatar de otra entidad/dominio | NOT PROFILE PHOTO CONSUMER                              |

No se encontraron consumidores de foto del afiliado actual clasificados `MOCK`, `LOCAL_STORAGE` o `HARDCODED` después del corte.

## Diseño y caché

`Avatar` conserva diámetro, círculo, borde, posición y `object-fit: cover`. Si no existe relación muestra las iniciales originales. Si el navegador no puede decodificar/cargar la imagen, el mismo componente vuelve a iniciales sin consultar otra fuente.

La firma dura 3,600 segundos; la caché dura 50 minutos, está indexada por `auth.uid() + affiliate.id`, solo vive en memoria y se limpia al iniciar/cerrar sesión. Un refresh crea una nueva frontera en memoria y vuelve a resolver Supabase.

## Evidencia

- `node scripts/test-profile-photo.js`: PASS; relación exacta, ambigüedad bloqueada, caché aislada y fuentes prohibidas ausentes.
- `python scripts/test-profile-photo-live.py`: PASS; 487/487, 460 sin foto, 0 ambigüedades, 0 objetos/registry faltantes, RLS normal/admin/anónimo y las tres cuentas con foto.
- `node scripts/test-profile-photo-browser.js`: PASS; tres logins secuenciales en un mismo Chrome, header/Perfil/Credencial/Admin, logout, refresh y cero retención cruzada.
- Bundle Babel 7.29.0: 69 fuentes; `node --check app/bundle.js`: PASS; 4 marcadores de consumidor en bundle.
- Suite estática H-004/H-005/H-006/Phase 1/H-007/H-007.2/H-008/Icon/Phase 2/Program Catalog/Claude UI: PASS.

## PROFILE PHOTO CUTOVER RESULT

```text
PHOTO historical rows discovered: 487
PHOTO assets already in Storage: 487
Affiliate-photo relations: 487
Affiliates with photo: 487
Affiliates without photo: 460
Ambiguous relations: 0
Header consumers connected: 1
Profile consumers connected: 1
Credential consumers connected: 1
Other avatar consumers connected: 1 Admin + impersonation through shared projection
Runtime Glide photo dependencies: 0
localStorage photo authority remaining: 0
Cross-user photo leakage: NO
H005_TEST: PASS
H005_TEST2: PASS
H005_TEST3: PASS
Claude UI preservation: PASS
Final verdict: PASS
```

## H-PROFILE-PHOTO-CUTOVER-GLOBAL RESULT

```text
Status: PASS
Files changed: app/affiliate-repository.js; app/affiliate-auth.js; app/affiliate-view-model.js; app/ui.jsx; app/app.jsx; app/screens-credencial.jsx; app/screens-admin-identity.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-profile-photo.js; scripts/test-profile-photo-live.py; scripts/test-profile-photo-browser.js; scripts/test-h005.js; scripts/test-h006.js; scripts/test-master-phase1.js; scripts/test-h007.js; scripts/test-h0072.js; scripts/test-icon-installation.js; scripts/test-phase2.js; scripts/test-program-catalog-cutover.js; docs/SOURCE_OF_TRUTH.md; docs/ARCHITECTURE.md; docs/INVARIANTS.md; docs/DATA_MAPPING.md; docs/SECURITY_RULES.md; docs/AGENT_CHANGELOG.md; docs/PROFILE_PHOTO_CUTOVER.md
Source-of-truth verdict: PASS — única autoridad runtime affiliate_files/private_assets/private-assets; URL firmada y caché solo derivadas
Invariant verdict: PASS — numero_control TEXT intacto; 487 relaciones exactas; 0 ambiguas; sin segunda autoridad ni fallback productivo
Build: PASS — bundle Babel reproducible, node --check PASS, SHA-256 282681A59E1325B15F6B732225103969BEC04B8C6D5B6D86CBDC0EC5A599DF10
Tests: PASS — suite local acumulada, live Supabase/RLS y Chrome real secuencial H005_TEST/H005_TEST2/H005_TEST3
Security: PASS — bucket privado, firma temporal, owner/Admin autorizados, normal cross-user y anónimo denegados, caché principal+afiliado y limpieza login/logout
Legacy impact: READ ONLY / NO MODIFICATION — se reutilizó catálogo histórico evacuado; Google, Apps Script, Ahorro, Préstamos, fórmulas y triggers no cambiaron
Unexpected files changed: NOT VERIFIABLE por ausencia de metadata Git; el alcance declarado fue inspeccionado y el pyc creado por esta H fue retirado
Known limitations: 460 afiliados no tienen fila Photo y conservan iniciales; QR reverso, Historial y solicitudes no poseen slot Claude de avatar; la firma expira y se re-resuelve desde Supabase
Evidence: 487/487 Storage/relaciones; 0 missing/registry/public/ambiguous/wrong-link; cuatro consumidores marcados en fuente y bundle; tres cuentas PASS; cross_user_photo_leakage=false; refresh_re_resolves_from_supabase=true; tamaños Chrome 44/84/76/40 px, círculo y object-fit cover
```

## Revisión arquitectónica independiente

`APPROVED`. El resultado coincide con la solicitud, la autoridad declarada y las relaciones reales. No introduce migración, writer remoto, fuente paralela, fallback productivo, exposición pública ni autorización basada solo en UI. Los consumidores aplicables comparten el mismo resolver y la misma proyección del afiliado efectivo; los espacios sin avatar permanecen intactos. La ausencia de metadata Git limita únicamente la prueba automática de archivos inesperados y no invalida la evidencia funcional, de datos, RLS, seguridad, legacy o preservación visual.
