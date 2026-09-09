# H-ADMIN-APP-SHELL-NAVIGATION-001

## PRE-CHANGE AUDIT

Objetivo: comprobar y cerrar navegación APP → Admin → Ver app → APP sin pérdida de sesión, incluyendo contexto propio e impersonado.
Alcance: `scripts/test-admin-app-shell-navigation.js`, este informe, `docs/qa/evidence/admin-app-shell-navigation-20260908/`, entrada nueva en `docs/AGENT_CHANGELOG.md`.
Fuera de alcance: cambios runtime, Auth, Supabase, RLS/RPC, permisos, datos de negocio, reglas, pantallas y navegación duplicada.
Hallazgo: origin/main 7036856 ya contiene Ver app en headers móvil/desktop y callback al Home normal; pestaña Admin visible por autorización efectiva en contexto propio; impersonación usa banner para volver. Implementado en H-IMPERSONATION-FULL-USER-EXPERIENCE-001, runtime 3eec5a4. No existe evidencia inicial de una brecha adicional.
Authority: AffiliateAuth y AffiliateRepository certifican identidad; AdminRepository conserva permisos backend. Los botones sólo reutilizan commitTab/setTab. Ninguna identidad o sesión nueva.
Readers: prueba de navegador mediante Auth existente y RPC de lectura de identidad. Writers: inicio/fin auditados de impersonación mediante RPC ya existente para el caso requerido; cero modificaciones de datos de negocio.
Invariantes: mismo auth_user_id, mismo session_id JWT, mismos permisos; contexto propio sin impersonación; afiliado efectivo correcto durante impersonación; salida restaura contexto propio.
UI: conservar ambos shells, headers, sidebar, TABS/ROUTES, navegación y todas las pantallas.
Navigator: STALE sólo por cinco documentos/evidencias de cierre anterior; fuentes focales coinciden exactamente con origin/main. Discovery directo confirma callback y controles. No cambia arquitectura; no regenerar Registry por documentación/pruebas.
Risk: bajo; prueba focal real sin acciones de negocio. No modificar implementación si los criterios ya pasan.
Tests: ocho criterios solicitados en Chrome real, 390px/1440px, múltiples ciclos de navegación y comparación de sesión/permisos.
Recovery: revertir sólo documentación/prueba nuevas. Ningún rollback de runtime o datos requerido.
Status: PASS (auditoría previa).

## Guardians

- Source-of-truth-guardian: SAFE; autoridad e identidad existentes, sin caché/fallback añadido.
- Supabase-security-review: READ ONLY sobre contratos existentes; no modifica Auth/RLS/RPC/permisos. La única selección de otro afiliado requiere RPC auditado existente.
- Claude-ui-preservation-guardian: no cambios de UI previstos; comprobar navegación y controles existentes con navegador.
- Legacy Google: NOT APPLICABLE; no operaciones/cálculos financieros ni Google.
- Database migration: NOT APPLICABLE.
- No suites globales, por instrucción específica del propietario.

## Validación productiva

`node scripts/test-admin-app-shell-navigation.js https://sutiapp.com/`: PASS en Chrome real. Tres ciclos completos en 1440px y tres en 390px; misma cuenta, mismo session_id JWT, mismos permisos y afiliado propio antes/después. Una sola autenticación por contraseña en todo el recorrido. El caso impersonado también se comprueba en ambos tamaños y termina mediante el RPC normal.

| Criterio | Resultado |
| --- | --- |
| Admin → Ver app | PASS |
| App → Admin | PASS |
| Sesión preservada | PASS |
| Tabs normales visibles | PASS |
| Sin impersonación → contexto propio | PASS |
| Con impersonación → usuario_contexto | PASS |
| Volver al Admin mantiene impersonación | PASS |
| Salir restaura actor_real | PASS |

Cero errores de página, cero escrituras de negocio detectadas. Inicio, Finanzas, Convenios, Historial, Credencial y Admin visibles en contexto propio. En impersonación se conserva la navegación del afiliado y el banner proporciona el regreso al Admin, conforme al contrato anterior aprobado.

Los tres artefactos públicos (HTML, bundle234 y worker182) coinciden byte a byte con el runtime certificado `3eec5a4`; la base documental de esta H es `7036856`. No hay brecha reproducible que requiera modificar código productivo. La publicación de esta H agrega exclusivamente prueba y evidencia; no duplica navegación ni genera otro bundle.

Evidencia: [production.json](evidence/admin-app-shell-navigation-20260908/production.json), [runtime.json](evidence/admin-app-shell-navigation-20260908/runtime.json), [revisión](evidence/admin-app-shell-navigation-20260908/ARCHITECT-REVIEW.md).

## CLAUDE UI PRESERVATION REVIEW

Screen: App shell y Admin shell.
Original sections / Current sections: idénticas; headers, sidebar, módulos, TABS/ROUTES y banner existentes.
Missing sections: ninguna.
Added sections: ninguna.
Interactions preserved: PASS; ciclos reales en móvil y desktop.
Navigation preserved: PASS; bidireccional, mismos shells y sesión.
Visual structure preserved: PASS; cero cambios de UI/runtime.
Unauthorized redesign: NO.
Verdict: PASS.

## H-ADMIN-APP-SHELL-NAVIGATION-001 RESULT

Status: PASS.
Files changed: scripts/test-admin-app-shell-navigation.js, docs/qa/H-ADMIN-APP-SHELL-NAVIGATION-001.md, docs/qa/evidence/admin-app-shell-navigation-20260908/*, entrada de docs/AGENT_CHANGELOG.md.
Source-of-truth verdict: PASS; autoridades existentes intactas.
Invariant verdict: PASS; una sesión, identidad y permisos preservados; excepción impersonación existente y auditada.
Build: NOT APPLICABLE a esta H sin cambios runtime; artefacto público previamente construido y sus bytes verificados PASS.
Tests: PASS; 8/8 criterios, dos viewports, seis ciclos propios y dos impersonados.
Security: PASS focal; igualdad de actor, session_id y permisos antes/después; ningún cambio Auth/RLS/RPC.
Legacy impact: NOT APPLICABLE; sin lógica, cálculos o Google.
Unexpected files changed: ninguno en release aislado; cambios previos del workspace preservados.
Known limitations: la prueba usa administrador con afiliación propia válida. Una cuenta exclusivamente administrativa sigue sin recibir una afiliación inventada. Registry sin cambios: esta H sólo agrega prueba/documentación y no arquitectura. No suites globales.
Evidence: docs/qa/evidence/admin-app-shell-navigation-20260908/.
