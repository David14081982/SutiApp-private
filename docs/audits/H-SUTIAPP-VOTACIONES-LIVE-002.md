# H-SUTIAPP-VOTACIONES-LIVE-002 — Votación en vivo

## Solicitud del propietario (2026-09-16)

- Las preguntas se muestran una por una y en tiempo real. En Admin → Votaciones → Preguntas, cada pregunta tiene un botón para activarla; **solo una activa a la vez**. Se puede volver a activar una pregunta después; no hay límite de tiempo.
- El afiliado ve solo la pregunta activa. Al confirmar su voto aparece «Voto registrado · folio …» y la pregunta desaparece solo para él. Ya no ve su voto, barras, porcentajes ni participación.
- La tarjeta de Votaciones permanece visible con el avance «N de M» (3 de 3 = terminó). Queda abierta y, cuando se activa otra pregunta, aparece sola.
- Total de votantes automático en todos los modos: Todos = afiliados del padrón (con o sin cuenta); Solo registrados = afiliados con cuenta; Segmentado = afiliados del padrón que cumplan el filtro (con o sin cuenta); Solo estas personas = número de correos de la lista.
- Pantalla gigante a pantalla completa desde Admin → Votaciones con el botón «Votación en vivo»: pregunta activa, cuántos ya votaron y cuántos faltan, gráficas y conteos, en tiempo real. Sin diseño previo: misma línea gráfica del módulo en tamaño grande.
- Punto de restauración antes de iniciar; al terminar commit, push y publicación.

## Pre-change audit

- Autoridad: Supabase `voting_*` (H-SUTIAPP-VOTACIONES-PRODUCTION-001). Sin nueva autoridad de negocio: la pregunta activa es estado operativo nuevo en `voting_live_state`, una fila por consulta; el total de votantes deja de ser captura y se deriva de `affiliates` según la audiencia.
- Lectores: afiliado efectivo (`list_voting_consultations(false)`), Admin (`list_voting_consultations(true)`, `get_voting_live`, `count_voting_electorate`), navegador suscrito a `voting_live_state` (ids y timestamp, RLS por audiencia). Escritores: `set_voting_active_question` (permiso publicar), `save_voting_consultation`, `voting_consultation_action`, `cast_voting_vote`.
- Invariantes conservados: voto único y definitivo (UNIQUE inmediato + trigger), identidad derivada, impersonación sin voto, exportación nominal con permiso separado, archivo lógico, bitácora existente.
- Riesgos: votos durante el cambio de pregunta (resuelto con lock exclusivo contra locks compartidos de votantes); reconexión masiva al activar (jitter 0–2 s + sondeo acotado); tiempo real rechazado o caído (sondeo 15 s en primer plano); Admin remontado al cruzar 1024 px al entrar a pantalla completa (sesión del módulo recuperable).
- Fuera de alcance: shell/rutas Admin compartidos, Auth, Storage, service worker, dominios financieros y Google.
- Producción al iniciar: 1 consulta, 3 preguntas, 7 votos; 946 afiliados activos, 207 con cuenta.

## Punto de restauración

- Git: tag anotado `restore/pre-votacion-en-vivo-20260916` → `b74ddbb` (producción publicada), publicado en GitHub.
- Base de datos: esquema privado `voting_restore_private` (sin grants, RLS forzada) con copia de consultas, preguntas y votos, las 9 funciones de votaciones (definición, ACL, md5) y manifiesto con conteos y huellas. Evidencia sin datos personales: `docs/qa/evidence/voting-live-20260916/restore-point.json`.
- Recovery versionado: `supabase/recovery/20260916000200_voting_live.sql`, generado desde las definiciones exactas del punto de restauración. Probado junto con la migración dentro de `ROLLBACK`.

## Diseño implementado

- `voting_live_state(consultation_id PK, active_question_id, last_question_id, changed_at)` con FK compuestas a `voting_questions`: una sola pregunta activa por construcción. `last_question_id` conserva la última activa para la pantalla gigante entre preguntas.
- `cast_voting_vote` exige que la pregunta sea la activa (`QUESTION_NOT_ACTIVE`) y ya no devuelve resultados. `set_voting_active_question` toma `FOR UPDATE` sobre la consulta: espera a los votos en curso (`FOR SHARE`), por lo que ningún voto entra después de que la pregunta sale del aire.
- `list_voting_consultations(false)` no incluye resultados y solo la pregunta activa lleva texto; las demás llevan id, orden y marca de voto propio para el avance.
- `voting_electorate(audience)` calcula el total en lectura; `save`/`duplicate` guardan el valor calculado en la columna heredada (constraint relajada a `>= 0`); la participación no divide entre cero.
- Tiempo real: `voting_live_state` en `supabase_realtime`, SELECT para `authenticated` filtrado por `voting_live_visible` (audiencia o permiso de lectura Admin). El navegador recarga por RPC al recibir el evento. Pantalla gigante: sondeo de 2 s mientras está visible.
- Frontend: `VotingHome` (pregunta activa, espera, 3 de 3, cierre automático de la confirmación si la pregunta sale del aire), `VotingAdmin` (interruptor por pregunta, total automático, botón «Votación en vivo»), `VotingLive` (portal a pantalla completa). CSS nuevo encapsulado en el módulo; el CSS del contrato del propietario queda intacto.

## Verificación

- SQL (`scripts/test-voting-live.sql` vía `scripts/voting-live-backend.js test`): 11 grupos en transacción con `ROLLBACK`, incluidas RLS real con `set role authenticated`, módulo Admin de solo lectura y recovery. Control negativo: una comprobación falsa inyectada falla con `CHECK_FAILED`.
- Navegador aislado (`scripts/test-voting-live-browser.js`): 24 comprobaciones con fixtures, 3 tamaños de texto, 1920/1280/1024/390 px, remontaje del Admin, sin errores de consola.
- Integrado (`scripts/test-voting-live-integrated.js`): build local contra Supabase productivo con login real; evento Realtime entregado al navegador; pantalla gigante sobrevive al cruce a escritorio; Inicio sin resultados. Única escritura técnica: `changed_at` de la fila en vivo.
- Resultado final y verificación productiva: `docs/qa/evidence/voting-live-20260916/result.md`.

## Ajuste 2026-09-17 — Sello institucional en la pantalla gigante

- Solicitud: sustituir el círculo decorativo superior derecho de «Votación en vivo» por el Sello institucional de Admin → Ícono e instalación → Íconos e identidad visual.
- Implementación: `window.SutiSeal` (misma autoridad `app_settings.institutional_seal_asset` que el pie de Inicio), sin copia local ni fallback: si el sello no carga, no se pinta decoración. Filtro `brightness(0) invert(1)` y opacidad .12 para conservar la marca de agua blanca del diseño; el PNG publicado tiene fondo transparente.
- Verificación: prueba aislada con la imagen real del sello (`VOTING_SEAL_PREVIEW`), bundle solo con los trozos de votaciones y verificación productiva de que el sello cargado aparece en la pantalla gigante (`production-sello.json`).
