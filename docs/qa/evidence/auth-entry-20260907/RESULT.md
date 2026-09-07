# H-AUTH-ENTRY-001

**Actualización:** el bloqueo inicial fue resuelto en la continuación autorizada. El estado más reciente está en [DELIVERY.md](DELIVERY.md). Lo siguiente conserva la evidencia histórica de la primera etapa.

La corrección está implementada localmente. **No publicada.** La cuenta configurada H005_TEST devuelve INVALID_CREDENTIALS también con el frontend productivo anterior; no permite cerrar la regresión global obligatoria. No se cambió ni restableció ninguna contraseña real.

## Resultado y alcance demostrado

- Reproducción aislada con código HEAD: una sesión con `sutiapp_activation=true` abre `activation_password` sin enlace. Mismo escenario con la corrección: `authenticated`, sin pedir otra contraseña; entrada sin sesión: email y contraseña.
- La metadata histórica ya no selecciona el formulario. El enlace explícito conserva activación; recuperación conserva sus callbacks actuales y el callback implícito histórico.
- PASSWORD_RECOVERY de otra pestaña ya no selecciona el formulario de esta pestaña. Supabase vendorizado difunde eventos mediante BroadcastChannel.
- SIGNED_IN repetido para exactamente el mismo token/principal ya resuelto evita repetir consultas. TOKEN_REFRESHED y refreshContext mantienen revalidación backend.
- Cancelación de definición de contraseña termina la sesión local, limpia el contexto de URL y vuelve al login sin cambiar password. Eventos diferidos anteriores a salida/finalización no reabren el flujo.
- Shell y service worker sólo cambian cachebusters: bundle 219→220, caché 166→167. Lógica de caché y diseño existentes preservados.

## Verificaciones

| Evidencia | Resultado |
|---|---|
| `node scripts/build-bundle.js C:/tmp/sutiapp-babel-7.28.4.min.js` | PASS; 111 fuentes, sintaxis validada |
| `node scripts/build-pages-site.js <directorio temporal>/site` con configuración pública | PASS; 22 archivos; servidor limitado al artefacto público |
| test-h005.js | PASS; metadata antigua, eventos repetidos, token nuevo, URLs anteriores, cancelación, recuperación, carreras y errores |
| test-auth-session-regression.js | PASS con AffiliateRepository real en arnés aislado |
| test-auth-prod-activation.js | PASS; contrato activación sin metadata como selector autónomo |
| test-auth-deployment-contract.js | PASS; comprobación aislada de gates de RPC |
| test-master-phase1.js | PASS; revisión estática, no nueva certificación de RLS real |
| test-pages-deployment.js | PASS; manifiesto de artefacto y exclusión de archivos privados |
| test-auth-entry-browser.js | PASS WebKit/iPhone 13 y Chromium/Pixel 5 emulados; regresión original reproducida; login con geometría idéntica; 50 eventos repetidos por motor; enlaces, refresh, cancelación, login; cero escrituras de password |
| Smoke público de build local y sutiapp.com | PASS 8/8: dos motores × dos targets × con/sin service worker; login visible, refresh, cero errores JS/crash observado, cero overflow, sin bucle de navegación |
| test-global-image-regression-production-live.js, local y GitHub Pages | BLOCKED; ambos procesos terminaron FAIL por timeout esperando authenticated; diagnóstico separado demuestra INVALID_CREDENTIALS |
| git diff --check | PASS |
| hashes.json | PASS; fuente Auth incluida exactamente en bundle |

Prueba pública nueva con caché permitido: `sutiapp-v167`, bundle 220 local; `sutiapp-v166`, bundle 219 productivo. GitHub Pages redirige al dominio sutiapp.com. Los tiempos initialMs incluyen una espera deliberada de 2 segundos y **no** constituyen una medición de rendimiento de acceso autenticado.

El build sin Babel falló antes de escribir, por JSX existente; se usó después el compilador Babel disponible. El primer arnés WebKit necesitó charset UTF-8 explícito en el HTML aislado; no era un defecto del producto.

## Autoridad, seguridad y preservación

Supabase Auth conserva autoridad sobre sesiones/password. public.affiliates conserva principal de negocio y numero_control. No se alteran tablas, RLS, grants, RPC, vínculos, passwords, emails, historial ni datos financieros. No se añade fallback ni caché de identidad. La selección de formulario no concede permisos; la resolución existente sigue comprobando backend.

CLAUDE UI PRESERVATION REVIEW: login normal con geometría idéntica en ambos motores; todos los controles de email, password, visibilidad, recuperación y activación sobreviven. Se agrega solamente volver al inicio desde los dos formularios de password, con la misma presentación del botón existente. Capturas `*-activation.png`/`*-recovery.png` son arnés aislado de componentes; `*-local-*.png`/`*-production-*.png` son shell real. Verdict: PASS para alcance UI probado, sin rediseño.

El worktree ya contenía cambios extensos de Ahorro, afiliados, normativa, builder y bundle. Se preservaron. La única edición propia de test-auth-prod-activation.js es la aserción del selector; sus otras diferencias son anteriores. El bundle se regeneró desde el worktree vigente, por lo que su diff global incluye trabajo previo: **no publicar ese conjunto ajeno como parte de esta H**; preparar entrega focal desde base revisada antes de publicar. El Registry era STALE antes de iniciar; no cambia ruta/dependencia/schema/autoridad y no se regeneró.

La entrega focal ya quedó preparada en el directorio temporal indicado por `release-candidate.json`: se verificó que el bundle HEAD coincide exactamente con el productivo, y se sustituyó exclusivamente el bloque affiliate-auth, preservando íntegros todos los bytes anteriores/posteriores al módulo y actualizando cachebusters. `candidate-checks.json` confirma login/refresh WebKit y Chromium PASS en ese candidato; la regresión global del candidato conserva el bloqueo de credenciales. No se publicó ni se creó commit/push. Una primera sonda ad hoc de refresh inmediato terminó sin diagnóstico suficiente; la comprobación registrada espera estabilización del arranque antes de refresh y pasó en ambos motores. No se atribuye esa sonda al cierre físico reportado.

## H-AUTH-ENTRY-001 RESULT

```text
Status: BLOCKED — cierre/entrega productiva; implementación y pruebas focales PASS
Files changed: app/affiliate-auth.js; scripts/test-h005.js; scripts/test-auth-prod-activation.js (una aserción); scripts/test-auth-entry-browser.js; app/bundle.js (GENERATED_ARTIFACT); SutiApp.html y sw.js (cachebusters); docs/audits/H-AUTH-ENTRY-001.md; docs/qa/evidence/auth-entry-20260907/*; entrada aditiva docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — autoridades existentes intactas
Invariant verdict: PASS para diff y pruebas focales; aceptación global pendiente
Build: PASS con Babel 7.28.4; artefacto público PASS
Tests: seis suites PASS + WebKit/Chromium aislados PASS + smoke público 8/8 PASS; global local/Pages BLOCKED por credenciales
Security: sin cambios backend/secretos; checks aislados PASS; pruebas autenticadas reales pendientes
Legacy impact: NOT APPLICABLE para modificación; cero cambios de datos/Google/cálculos
Unexpected files changed: ninguno atribuido a esta H; worktree previo preservado
Known limitations: no publicado; cuenta de prueba inválida; cierre físico de app móvil no reproducido; no acceso al dispositivo afectado; regresión de assets privados no completada
Evidence: checks.json, browser-result.json, public-smoke.json, global-regression.json, live-login-diagnostic.json, hashes.json y capturas
```

## SUTIAPP ARCHITECT REVIEW

Task: H-AUTH-ENTRY-001

Verdict: BLOCKED

Critical findings: el resultado funcional está demostrado en controladores y dos motores, pero no puede certificarse la autenticación real ni las superficies protegidas con INVALID_CREDENTIALS. Producción continúa en bundle 219. Ninguna prueba permite atribuir el cierre físico del teléfono a esta causa concreta.

Source of truth: preservada. Architecture: misma frontera Auth y APIs; sin nueva dependencia/autoridad. Security: no cambios de RLS ni passwords reales. Data: cero mutaciones de negocio. Legacy: intacto.

Revisión read-only del diff, hashes y reportes después de implementar. WORK_QUEUE existente corresponde al plan financiero protegido, no autoriza avanzar de fase. WORK_QUEUE_HISTORY y task-orchestrator no están disponibles en las rutas convencionales; no se afirma aprobación de orquestador ni auditoría integral de toda normativa histórica.

Owner decision: NO para corregir o verificar esta H; se necesita acceso funcional a la cuenta controlada, no una decisión de autoridad/negocio. No se solicita relajación del gate de seguridad.

Next action: restaurar mediante el canal privado habitual las credenciales de la cuenta controlada, ejecutar regresión global completa sobre la entrega focal ya preparada y verificar la versión publicada; reproducir cierres en el dispositivo informado.

Response generated for Codex: YES

### RESPONSE TO CODEX

No cierres H-AUTH-ENTRY-001 como PASS. Con credenciales controladas vigentes, ejecuta scripts/test-global-image-regression-production-live.js contra el candidato local y GitHub Pages, con assets legítimos, sin modificar datos ni passwords reales. Usa exclusivamente el candidato Auth/cachebusters demostrado en release-candidate.json, preservando los cambios previos del worktree. Completa verificación productiva y documenta dispositivo/contexto de cualquier cierre. No avances a otra H.

La skill post-change-verification exige: “Emitir PASS solo si todas las verificaciones requeridas pasan o están justificadamente NOT APPLICABLE.” AGENTS.md hace obligatoria la regresión global para autenticación global; por ello el fallo de acceso de QA no se reclasifica PASS.
