# H-IMPERSONATION-FULL-USER-EXPERIENCE-001

## PRE-CHANGE AUDIT

- Objetivo: abrir Inicio al iniciar impersonación y reutilizar la navegación normal con banner persistente, regreso al Admin, Ver app y salida segura.
- Alcance: `app/app.jsx`, `app/screens-admin.jsx`; artefactos generados `app/bundle.js`, cachebusters en `SutiApp.html` y `sw.js`; prueba focal `scripts/test-impersonation-full-experience.js`; este informe, evidencia en `docs/qa/evidence/impersonation-full-20260908/`, `docs/AGENT_CHANGELOG.md` e índice derivado `docs/architecture/` si cambia el mapping.
- Fuera de alcance: Auth, repositories, RLS/RPC, schema, permisos, datos de negocio, reglas financieras, Google y otras pantallas.
- Autoridad: Supabase Auth conserva actor real; `get_effective_affiliate_id` y `get_impersonation_context` certifican usuario contexto; AffiliateRepository/AffiliateAuth ya validan correspondencia. No habrá otra autoridad ni persistencia local de identidad.
- Escritores: únicamente RPC existentes de inicio/fin de impersonación durante pruebas autorizadas; cero escrituras de negocio. Lectores: shell y pantallas normales, mediante repositorios existentes.
- Invariantes: sesión auditada ligada al actor/Auth session, TTL backend 30 minutos, control histórico sin transformar, ninguna identidad alternativa, estado UI anterior descartado al cambiar contexto.
- UI: conservar panel, módulos, headers desktop/móvil, rutas, transiciones, scroll, bottom nav y pantallas. Cambios solicitados: banner con nombre/control y dos acciones; Ver app en encabezado; transición a Inicio al cambiar contexto.
- Riesgos: retención de rutas/estado entre identidades; expiración mientras una pantalla está abierta; cierre fallido; Admin sin afiliación propia.
- Tests: navegador real local/producción, Inicio y navegación por varias superficies, identidad efectiva, regreso sin cerrar, reapertura, salida, refresh, separación entre dos usuarios y expiración. Simulaciones sólo en browser aislado cuando se necesite controlar reloj/fallos.
- Recovery: revertir únicamente el commit focal, regenerar bundle/cachebusters; no recuperación de datos necesaria.
- Workspace inicial: cambios previos extensos conservados; archivos fuente focales coinciden con origin/main 0d2a954. Publicación desde worktree aislado basado en origin/main.
- Navigator: registry STALE por archivos de otras H; discovery dirigido confirma shell, repositorios y RPC citados. Índice nunca autoridad runtime.
- Validación global: instrucción específica del propietario «No suites globales» prevalece sobre el default de AGENTS para shell compartido. Sólo validación focal y dependencias directas.
- Status: PASS (alcance autorizado por solicitud original).

## Guardians previos

- Source of truth: SAFE; identidad única certificada por backend; no mock, fallback ni almacenamiento de identidad añadidos.
- Supabase security: backend intacto; revisión focal de actor, sesión, permiso, TTL y correspondencia del afiliado. Pruebas pendientes.
- Legacy Google: READ ONLY por navegación financiera existente; cero cambios de lógica, cálculos, fuentes, triggers o datos.
- Migración: NOT APPLICABLE.

## Implementación y evidencia local

`Root` remonta el shell únicamente al cambiar actor/afiliado/sesión de impersonación certificados. El inicio abre Home y descarta rutas, diálogos y estado de componentes anteriores; al terminar vuelve a Admin. Refresh de la misma identidad conserva el comportamiento existente. No se modificó AffiliateAuth ni se creó otra identidad.

Banner persistente fuera del scroll y de las capas de rutas: nombre y control autoritativos; Volver al Admin conserva la sesión; Salir usa el RPC existente y muestra error recuperable si falla. Ver app aparece en los encabezados móvil/desktop; abre Home del contexto efectivo. Una cuenta exclusivamente administrativa permanece en su contexto válido y recibe una explicación para seleccionar un afiliado, sin inventar una afiliación propia.

El TTL se toma de `expires_at` backend. Al vencer se retira el contenido antes de refrescar, también sin red; únicamente una resolución autoritativa permite volver a mostrar la app. No se modifica el plazo ni las reglas de sesión.

| Validación solicitada | Local / producci?n |
| --- | --- |
| Tomar control abre Inicio correcto | PASS / PASS |
| Tab bar normal visible | PASS / PASS |
| Recorrido de varias pantallas | PASS / PASS |
| Datos de usuario_contexto | PASS / PASS |
| Volver al Admin conserva impersonación | PASS / PASS |
| Ver app vuelve al mismo usuario | PASS / PASS |
| Salir restaura actor_real | PASS / PASS |
| Ningún dato cruzado en casos comprobados | PASS / PASS |
| Refresh conserva contexto seguro | PASS / PASS |
| Expiración de 30 minutos | PASS / PASS |

Recorridas: Inicio, Finanzas, Convenios, Historial, Credencial, Notificaciones, Perfil, Documentos, Tu Sindicato, Programas, Membresía y Ahorro. Documentos e historial se cotejan contra el afiliado efectivo. Se comprueba una segunda identidad real, cierre fallido sin perder contexto y View app del administrador.

Prueba TTL: inicio real devuelve vencimiento a 30 minutos; lectura de las cuatro funciones productivas confirma predicado temporal, actor, permiso y vínculo de sesión. Reloj adelantado sólo en navegador aislado verifica retiro de contenido y recuperación. No se esperaron 30 minutos de tiempo real ni se modificó el reloj/filas backend. No hay credenciales vigentes de un segundo login normal: la paridad de tabs se contrasta con el mismo TABS/filtro productivo; las dos identidades se recorren mediante impersonación real autorizada.

- `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`: PASS; release 112 módulos, sólo `screens-admin.jsx` y `app.jsx` cambian, otros 110 idénticos.
- `node scripts/build-pages-site.js`: PASS; 23 archivos públicos. El entorno Windows de pruebas restaura los tres vendors desde blobs Git para conservar SRI exacto (CRLF de checkout no pertenece al deploy Linux).
- `node scripts/test-admin-access-impersonation-global-permissions.js`: PASS; 38 contratos focales, no suite global.
- `node scripts/test-impersonation-full-experience.js`: PASS; navegador Chrome real, 16 comprobaciones, 12 superficies, cero errores de página y cero writes de negocio detectados.
- Evidencia: [local.json](evidence/impersonation-full-20260908/local.json), [scope.json](evidence/impersonation-full-20260908/scope.json), [backend-contract.json](evidence/impersonation-full-20260908/backend-contract.json). Captura móvil privada, inspeccionada, fuera del repo por datos personales.

## CLAUDE UI PRESERVATION REVIEW

Screen: shell + Admin headers.
Original sections: panel/módulos/headers/sidebar, Home y rutas, bottom nav, banner.
Current sections: todas conservadas; banner y Ver app modificados según mandato.
Missing sections: ninguna salvo CTA aislado de préstamo sustituido por las acciones solicitadas; préstamo sigue en Finanzas.
Added sections: Ver app en header; estado de expiración controlado.
Interactions preserved: navegación normal y retroceso, scroll, accesos, carga de datos; comprobación real de 12 superficies.
Navigation preserved: mismos TABS/ROUTES y pantallas; Admin separado por banner durante impersonación.
Visual structure preserved: PASS.
Unauthorized redesign: NO.
Verdict: PASS.

## H-IMPERSONATION-FULL-USER-EXPERIENCE-001 RESULT

Status: PASS local; publicación y verificación productiva en curso.
Files changed: app/app.jsx, app/screens-admin.jsx, app/bundle.js, SutiApp.html, sw.js (versiones solamente), prueba focal y evidencia/documentación declaradas, índice derivado.
Source-of-truth verdict: PASS; misma autoridad backend.
Invariant verdict: PASS; actores separados, identidad efectiva validada, TTL intacto, sin fallback.
Build: PASS.
Tests: PASS local; producción pendiente.
Security: PASS focal; cuatro funciones productivas intactas; sin cambio Auth/RLS/RPC/permisos/repositorios.
Legacy impact: READ ONLY; lógica y datos de negocio intactos.
Unexpected files changed: ninguno en release; trabajo previo del workspace conservado.
Known limitations: validación TTL compuesta descrita arriba; Admin sin afiliación propia no recibe identidad inventada; no suites globales por mandato expreso.
Evidence: docs/qa/evidence/impersonation-full-20260908/.

## Publicaci?n y cierre productivo

Commit runtime `3eec5a4f4c1ed8c6c355c049b1c003e2aac6daac`, GitHub Pages workflow `34315864822`: SUCCESS. `https://sutiapp.com/` entrega HTML, bundle234 y worker182 con bytes exactos del commit. `node scripts/test-impersonation-full-experience.js https://sutiapp.com/`: PASS, 16 checks/12 superficies, 0 errores de p?gina, 0 writes de negocio. Ambas sesiones controladas terminadas mediante RPC normal. Evidencia: [production.json](evidence/impersonation-full-20260908/production.json), [publication.json](evidence/impersonation-full-20260908/publication.json).

Registry del release: FRESH antes de publicar; nodos de ImpersonationBanner/ViewAppButton y referencias de grafo validados focalmente. El cierre posterior s?lo agrega evidencia/documentaci?n y puede marcar freshness documental stale; no cambia arquitectura ni exige regenerar el ?ndice productivo. No se declara una suite global PASS.

Architect review final: APPROVED. No acci?n adicional autorizada/pendiente en esta H. Detener.
