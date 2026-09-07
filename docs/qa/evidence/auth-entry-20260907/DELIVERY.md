# H-AUTH-ENTRY-001 — continuación y entrega

Este documento actualiza el bloqueo histórico de RESULT.md. El propietario autorizó corregir lo necesario y luego continuar la misma H.

## Preparación verificada

La credencial de la cuenta controlada H005_TEST se restableció al valor privado existente: login real PASS, mismo UUID/email/metadata/afiliación/permisos; ninguna otra cuenta ni dato de negocio cambió. Evidencia: qa-access-repaired.json. No se modificó ni se versionó supabase.env.

El candidato parte del bundle HEAD que coincidía con producción: sólo cambia affiliate-auth y cachebusters 220/167. Trabajo anterior de Ahorro preservado fuera del commit. Worktree separado, sin secretos. Las diferencias del arnés global sólo agregan diagnóstico sanitizado; no relajan cobertura ni resultados.

El puerto inicialmente elegido 8766 no estaba autorizado por ALLOWED_APP_ORIGINS de las Edge Functions. Las pruebas definitivas usan el origen existente http://localhost:8080; sutiapp.com también pasó preflight. No se amplió CORS ni se modificó ninguna función financiera/documental. Un episodio ERR_NETWORK_IO_SUSPENDED se registró como fallo de ejecución, no como prueba de defecto de Auth. Se repitió el control y pasó.

## Evidencia previa a publicación

- Build focal validado; fuente Auth coincide con el módulo compilado. Seis suites focales y contratos estáticos PASS.
- Contratos live de Auth/backend y solicitudes: PASS; cuatro RPC privadas denegadas a anon, preflight mínimo público y writer contractual existente disponible.
- global-production-baseline-pass.json: regresión completa en GitHub Pages/producción anterior PASS.
- global-local-pass.json: mismo control sobre candidato 220/167 PASS; 156/156 assets públicos, 248/248 imágenes de programas, 29/29 archivos del afiliado, 10/10 thumbnails Admin, PDF real, perfil, Membership, Préstamo, Marketplace, galería, fullscreen, refresh y con/sin service worker.
- live-lifecycle-local.json: WebKit/iPhone13 y Chromium/Pixel5 emulados, backend real, PASS; 12 ciclos de foco por motor, renovación de token conserva el mismo nodo de pantalla Admin, recarga, nueva pestaña, recuperación explícita y cancelación, segundo login. Tres navegaciones documentales previstas, cero errores JS/crashes observados. Login observado 0.8–1.9 s; no constituye garantía de latencia móvil.
- El arnés móvil cierra la promoción real con «Ahora no» antes de abrir Admin; cuenta solicitudes documentales para distinguir reload de pushState del botón Atrás. No modifica UI ni deshabilita componentes.

## Revisión de arquitectura previa a entrega

Verdict: APPROVED para entrega focal autorizada, con comprobación productiva posterior obligatoria.

Auth y public.affiliates mantienen autoridad; ninguna nueva tabla, permiso, writer de negocio o fallback. Sin migraciones ni cálculos/Google alterados. La única mutación adicional es la contraseña de la cuenta de pruebas autorizada. UI preservada con salida aditiva a login. El Registry era STALE y no cambia arquitectura; no se regeneró trabajo ajeno. No se avanza el plan financiero ni otra H.

Publicación y comprobación posterior: completadas; resultado vigente al final de este documento.

## Actualización de entrega y caché

`a1ca52f` fue publicado por Actions 34153550157 con todos sus pasos PASS; el SHA-256 del bundle público coincide con el candidato. La comprobación posterior detectó que Cloudflare retenía `/sw.js` v166 como HIT con max-age=14400, mientras la URL con query devolvía v167. El shell ahora registra `./sw.js?v=167` (mismo scope), y test-pages-deployment verifica que esa versión coincida con CACHE. No se cambió configuración Cloudflare ni CORS.

`test-cache-upgrade.js` reprodujo el formulario incorrecto usando código/cache v166 y metadata obsoleta exclusivamente en el navegador aislado. Tras servir la actualización, la misma sesión pasó a authenticated, el worker quedó `/sw.js?v=167`, el caché viejo desapareció y hubo cero campos de nueva contraseña, sin borrar caché manualmente ni modificar metadata en servidor. Evidencia: cache-upgrade-live.json.

## Resultado final publicado

Release runtime: `843c4ea35fde81f94e2b292282553864fbb7e7b4`. [Actions 34153881776](https://github.com/David14081982/SutiApp-private/actions/runs/34153881776) terminó success. `deployment-final.json` acredita HTTP 200 y hashes exactos del HTML, bundle 220 y worker versionado 167 contra el release aislado.

`global-local-versioned-worker.json` y `global-production-versioned-worker.json`: PASS de la regresión global obligatoria con caché 167, assets legítimos y cero mutaciones de negocio. Incluye PDF real de Admin; el caso PDF del afiliado QA no aplica a sus archivos actuales. La ejecución final productiva terminó exit 0; reemplaza un intento interrumpido sin reporte, que no se contó como PASS.

`live-lifecycle-production.json`: PASS en WebKit/iPhone 13 y Chromium/Pixel 5 emulados contra https://sutiapp.com/. Login observado 0.805–2.679 s; 12 ciclos de foco por motor, refresh de token, pantalla Admin estable, recarga, segunda pestaña, recuperación explícita/cancelación y segundo login. Cero errores JS/crashes, cero definición de contraseña inesperada y tres navegaciones documentales previstas. El arnés usa un locator handler que cierra «Ahora no» mediante la UI cuando la promoción asincrónica intercepta la navegación. No oculta ni fuerza clicks sobre componentes. Requests de logout abortadas al cambiar/cerrar contexto se conservaron como diagnóstico; los estados finales y aserciones pasaron.

```text
H-AUTH-ENTRY-001 RESULT
Status: PASS
Files changed: runtime focal: app/affiliate-auth.js, app/bundle.js, SutiApp.html, sw.js; tests focales/global (diagnóstico), auditoría, evidencia y entrada de changelog.
Source-of-truth verdict: PASS — Supabase Auth y public.affiliates, sin autoridad alternativa.
Invariant verdict: PASS — identidad, roles y validación backend preservados; recuperación/activación explícitas conservadas.
Build: PASS — candidato aislado; únicamente módulo Auth sustituido en bundle publicado, resto preservado; build/deploy Actions success.
Tests: PASS — seis suites, navegador aislado, backend contractual live, ciclo móvil local/producción, caché antigua y regresión global local/Pages.
Security: PASS — sin secretos frontend, cambios RLS ni permisos nuevos; URL/metadata sólo seleccionan UI.
Legacy impact: NOT APPLICABLE para escrituras — sólo lectura en regresión; sin Google/cálculos/datos financieros modificados.
Unexpected files changed: ninguno en release; trabajo preexistente de Ahorro/documentación preservado mediante hashes (worktree-preservation.json).
Known limitations: pruebas móviles emuladas, no teléfono físico del propietario; no se afirma diagnóstico del cierre del proceso de su dispositivo. Se restableció exclusivamente la contraseña QA autorizada, sin cambiar identidad ni permisos.
Evidence: checks.json, browser-result.json, cache-upgrade-live.json, deployment-final.json, global-local-versioned-worker.json, global-production-versioned-worker.json, live-lifecycle-local.json, live-lifecycle-production.json, qa-access-repaired.json, worktree-preservation.json.
```

## SUTIAPP ARCHITECT REVIEW

Task: H-AUTH-ENTRY-001.
Verdict: APPROVED.
Critical findings: diff publicado y hashes confirman alcance focal; cierre global y móvil sustentado por reportes finales PASS. Los fallos históricos no sustituyen los controles finales.
Source of truth: Auth/affiliates intactos; ningún dato puede reaparecer desde mock/caché como autoridad de negocio.
Architecture: mismo shell, rutas, repositories y scope del worker; Registry derivado preexistente stale no regenerado sin cambio estructural.
Security: revalidación backend en sesiones/tokens; eventos duplicados sólo se omiten para la sesión ya validada con mismo usuario/token. Sin migraciones, grants ni elevación.
Data: única escritura excepcional fue reset de credencial QA autorizado; sin históricos alterados.
Legacy: preservado y comprobado read-only.
Owner decision: NO.
Next action: entregar la corrección publicada y cerrar esta H. No avanzar otra tarea ni intervenir datos.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar H-AUTH-ENTRY-001 con la evidencia final referenciada. Comunicar publicación, corrección del flujo y alcance de pruebas; conservar cambios ajenos. No iniciar otra H. Esta revisión no autoriza continuación financiera ni sustituye task-orchestrator.
