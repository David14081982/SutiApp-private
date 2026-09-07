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

Publicación y comprobación posterior: pendientes de registrar con commit y ejecución GitHub Actions.

## Actualización de entrega y caché

`a1ca52f` fue publicado por Actions 34153550157 con todos sus pasos PASS; el SHA-256 del bundle público coincide con el candidato. La comprobación posterior detectó que Cloudflare retenía `/sw.js` v166 como HIT con max-age=14400, mientras la URL con query devolvía v167. El shell ahora registra `./sw.js?v=167` (mismo scope), y test-pages-deployment verifica que esa versión coincida con CACHE. No se cambió configuración Cloudflare ni CORS.

`test-cache-upgrade.js` reprodujo el formulario incorrecto usando código/cache v166 y metadata obsoleta exclusivamente en el navegador aislado. Tras servir la actualización, la misma sesión pasó a authenticated, el worker quedó `/sw.js?v=167`, el caché viejo desapareció y hubo cero campos de nueva contraseña, sin borrar caché manualmente ni modificar metadata en servidor. Evidencia: cache-upgrade-live.json.
