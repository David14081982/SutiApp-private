# H-SUTIAPP-VOTACIONES-LIVE-002 RESULT

Status: PASS

Files changed: app/screens-voting.jsx, app/voting-repository.js; app/bundle.js (solo trozos voting-repository.js y screens-voting.jsx, 123 trozos idénticos) y cachebuster `voting-live-20260916-001` en SutiApp.html; migración y recovery 20260916000200; scripts voting-live-* y test-voting-live-*; SOURCE_OF_TRUTH, DECISIONS (ADR-112), INVARIANTS (INV-228–231), MIGRATION_RULES, AGENT_CHANGELOG, auditoría, evidencia y Architecture Registry derivado.

Source-of-truth verdict: PASS — `voting_live_state` es la única autoridad de la pregunta al aire; el total de votantes se deriva de `affiliates` según la audiencia; sin localStorage, caché persistente ni fallback.

Invariant verdict: PASS — una pregunta al aire por consulta; voto solo a la activa con lock contra el cambio; voto único/definitivo, identidad derivada, impersonación sin voto y exportación nominal separada intactos.

Build: PASS — compilador reproduce los trozos publicados; bundle SHA-256 360313a717d78aab3dcf0010f3714960fe021adf79b7000e00c92cf530ab1276, idéntico en git y en https://sutiapp.com.

Tests: PASS — matriz SQL de 11 grupos con ROLLBACK (incluye RLS real, módulo de solo lectura y recovery) con control negativo; navegador aislado 24 comprobaciones; integrado local y productivo 7 comprobaciones con login real.

Security: PASS — señal Realtime de solo lectura con RLS por audiencia o lectura Admin; activar exige permiso de publicar; pantalla en vivo exige resultados; afiliado sin resultados ni textos fuera del aire; helpers privados; tablas de negocio sin acceso browser.

Legacy impact: NOT APPLICABLE — sin Google, Apps Script, fórmulas ni dominios financieros.

Unexpected files changed: ninguno. Vendor y configuración local usados solo para pruebas y restaurados antes del commit. Regresión global no aplica: el bundle cambia solo por regeneración de un módulo focal (GENERATED_ARTIFACT).

Known limitations: sin prueba de carga con cientos de dispositivos simultáneos. Si el plan de Supabase rechaza conexiones Realtime por límite, esos dispositivos detectan la pregunta nueva por sondeo en ≤15 s. La consulta productiva existente ya tiene 7 votos del flujo anterior (definitivos); para un ensayo limpio se usa Duplicar. En iPhone no existe la API de pantalla completa: el botón se oculta y la vista igualmente cubre la pantalla. El folio es visible solo en el aviso al votar y en la exportación nominal.

Evidence:

- restore-point.json: tag `restore/pre-votacion-en-vivo-20260916` → b74ddbb; esquema `voting_restore_private` (1 consulta, 3 preguntas, 7 votos, 9 funciones con md5).
- backend.json / applied.json / installed.json: matriz con ROLLBACK, migración aplicada con el mismo SHA, conteos y huella de votos iguales al punto de restauración, nada al aire.
- browser.json + capturas afiliado/admin/pantalla gigante: fixtures aislados, 3 tamaños de texto, 1920/1280/1024/390 px.
- integrated-local.json / production.json: login real, total automático 3, evento Realtime entregado, pantalla gigante sobrevive al cruce a escritorio, Inicio sin resultados. Escritura técnica única: `voting_live_state.changed_at` (estado sin cambios).
- build.json / deployment.json: commit 99d97f9, run https://github.com/David14081982/SutiApp-private/actions/runs/35192422100 SUCCESS.

## Validación solicitada

| Criterio | Resultado |
|---|---|
| Interruptor por pregunta en Admin, solo una activa | PASS |
| Reactivar una pregunta después | PASS (solo la ven quienes no la votaron) |
| Afiliado ve solo la pregunta activa, en tiempo real | PASS (Realtime verificado en producción) |
| Tras votar: «Voto registrado · folio» y la pregunta desaparece | PASS |
| Sin resultados en la vista de usuario | PASS (backend no los envía) |
| Tarjeta abierta con avance N de M (3 de 3) | PASS |
| Total de votantes automático en los 4 modos | PASS (946 / 207 / segmento / correos) |
| Pantalla gigante «Votación en vivo» a pantalla completa | PASS |
| Ya votaron / faltan y gráficas de la pregunta activa en vivo | PASS |
| Punto de restauración previo | PASS (git + base de datos + recovery probado) |
| Commit, push y publicación | PASS |

## Recuperación

1. Base de datos: ejecutar `supabase/recovery/20260916000200_voting_live.sql` (restaura las funciones exactas del punto de restauración; no borra datos).
2. Frontend: `git revert 99d97f9` y push a main (o comparar contra el tag `restore/pre-votacion-en-vivo-20260916`).
