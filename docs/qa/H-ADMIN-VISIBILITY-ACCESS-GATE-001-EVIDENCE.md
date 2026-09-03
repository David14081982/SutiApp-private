# H-ADMIN-VISIBILITY-ACCESS-GATE-001 — evidencia

## Resultado

`PASS`. La entrada y la navegación hacia Admin ahora derivan exclusivamente del contexto protegido de Supabase. Un usuario queda autorizado si `get_admin_access_context()` devuelve una asignación activa (`role_code` o `full_access`) o al menos una responsabilidad efectiva en `section_actions`. En cualquier otro estado, incluido error o contexto todavía no resuelto, Admin permanece oculto y denegado.

## Alcance y autoridad

- Autoridad preservada: `admin_roles`, `admin_role_permissions`, `admin_assignments` y `admin_section_responsibilities`.
- Proyección y enforcement preservados: `get_admin_access_context`, `has_admin_permission`, `has_section_action`, RPC/RLS y grants vigentes.
- No se crearon tablas, funciones, policies, roles, hardcodes, mocks, `DATA`, `localStorage` ni fallbacks de autorización.
- No se modificaron migraciones, schema, datos productivos, Supabase productivo, Google, Apps Script ni dominios financieros.
- Las migraciones protegidas `20260903000120`–`20260903000122` conservaron sus hashes y el SHA contractual de ADR-098 sigue siendo `b8c1f6c0057dabded90804ffadd5bd012fb41a1a`.

## Integración

- `AdminRepository` reconoce tanto la asignación activa como las responsabilidades efectivas, descarta cargas obsoletas y permite revalidar el mismo RPC protegido.
- El shell elimina la entrada Admin para quien no tenga contexto autorizado. El cambio interno a `admin` vuelve a validar la autoridad antes de navegar y falla cerrado.
- Una revocación se recoge al recuperar foco/visibilidad, al intentar entrar a Admin y por revalidación periódica de 30 segundos. Si el usuario está dentro, sale de la pantalla; una sesión exclusivamente administrativa vuelve a autenticación.
- El Panel existente conserva sus componentes y filtra a responsables por sus acciones de sección ya autorizadas. No hubo rediseño ni simplificación del Admin autorizado.

## Matriz focal

| Principal | Resultado comprobado |
|---|---|
| Super Admin | Admin visible; acceso total |
| Admin con asignación activa | Admin visible; acceso total según su rol |
| Responsable de una sección | Admin visible; exactamente la sección `convenios` en el caso focal; módulos ajenos ocultos/denegados |
| Usuario normal | Admin oculto; navegación interna y `#/admin` denegadas |
| Anónimo | RPC protegidas y acceso Admin denegados |
| Permiso revocado | contexto invalidado/revalidado; entrada desaparece y la vista Admin se cierra |

## Seguridad y fuente de verdad

La UI consume una proyección descartable en memoria; no constituye otra autoridad. Cada resolución procede de `get_admin_access_context()` ligada a `auth.uid()`. Las acciones continúan protegidas individualmente por `has_admin_permission`, `has_section_action`, RPC/RLS y grants backend. La prueba live confirmó que `anon` no puede ejecutar ninguna de las tres RPC protegidas. No hay `service_role`, secretos ni autorización basada sólo en UI en el cambio.

Veredictos:

- Source of truth: `PASS / SAFE`.
- Invariantes INV-189–198 y contrato ADR-098: `PASS`.
- Supabase security review: `PASS`.
- Claude UI preservation: `PASS`; misma estructura, módulos e interacciones para usuarios autorizados.
- Legacy Google/financiero: `NO INTERACTION`.
- Suite global: `NOT APPLICABLE` por orden del propietario y alcance focal; `bundle.js`/cachebusters son artefactos generados.

## Evidencia ejecutable

- `node scripts/test-admin-visibility-access-gate.js`: `PASS`, seis casos focales y contrato backend protegido.
- `node scripts/test-admin-access-protected-contract.js`: `PASS`, SHA, 3 migraciones y 10 invariantes.
- `node scripts/test-admin-access-impersonation-global-permissions.js`: `PASS`, 38 contratos.
- `python scripts/test-admin-access-impersonation-global-permissions-live.py`: `PASS`, matriz A–H, denegación anónima, cero escrituras persistentes y cero credenciales expuestas.
- `node scripts/test-admin-access-impersonation-global-permissions-browser.js`: `PASS` local y producción; Super Admin, asignación activa, responsable exacto, usuario normal, URL directa y revocación.
- `node scripts/test-h008.js`, `node scripts/test-auth-session-regression.js`, `node scripts/test-admin-decisions-cutover.js` y `node scripts/test-admin-desktop-shell-browser.js`: `PASS`.
- `node scripts/test-frontend-boot-browser.js` con servidor local: `PASS`, bundle v200, sin excepciones ni fallos de red.
- `node scripts/test-pages-deployment.js`: `PASS`, PWA válida y cero archivos prohibidos.
- Bundle reproducible desde 100 fuentes; SHA-256 estable `AE38568A347DEC621C2FA76B9B485B576E710F1E2A36ED204D0D32CC39C2634A`; `node --check app/bundle.js`, `node --check sw.js` y `git diff --check`: `PASS`.

`scripts/test-admin-productization.js` no se usa como gate: falla por una expectativa histórica de 16 tarjetas frente a las 19 ya existentes en `screens-admin.jsx`, archivo no modificado por esta H. Se registra como prueba no focal desactualizada, sin ocultar el resultado.

## Publicación

- Commit runtime: `00f28249dd18657420d42165e6f73acdcadb21f7` (`fix(admin): enforce access visibility gate`).
- Push: `origin/main`.
- GitHub Pages Actions: ejecución `33741942899`, `success`, mismo head SHA.
- Producción: `https://david14081982.github.io/SutiApp-private/SutiApp.html`.
- Verificación estática publicada: HTML v200, service worker v144, bundle v200 y las tres defensas (`gate`, `nav deny`, `revalidation`) presentes.
- Chrome real en producción: matriz focal completa `PASS`, cero errores de página.

## Archivos y límites

Runtime focal: `app/admin-repository.js`, `app/affiliate-auth.js`, `app/app.jsx`. Artefactos: `app/bundle.js`, `SutiApp.html`, `sw.js`. Pruebas: los cuatro scripts Admin indicados arriba. Gobierno: este documento y `docs/AGENT_CHANGELOG.md`.

Los tres archivos modificados preexistentes de `docs/architecture/` fueron preservados y excluidos de los commits. El Registry continúa reportando `STALE`; no se actualiza porque esta H no cambió nodos, rutas, RPC, repositories ni dependencias arquitectónicas.

## Revisión arquitectónica independiente

Veredicto: `APPROVED`. La implementación cumple el objetivo, preserva la autoridad protegida y su backend, no amplía alcance ni altera la experiencia autorizada. `WORK_QUEUE_HISTORY.md` no existe y `WORK_QUEUE.md` no contiene una continuación autorizada para esta H; corresponde detenerse después de la publicación y su verificación.
