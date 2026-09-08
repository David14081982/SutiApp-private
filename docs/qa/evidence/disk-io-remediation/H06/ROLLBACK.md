# H06 — rollback

No cambios backend ni datos que revertir. H01–H05 permanecen activos.

Base de recuperación: c047eec42ca66d5fab105feca662a9657aac83b0 (H05). Conservar los blobs previos de las fuentes H06 en before/published y el bundle/HTML/worker de ese commit. La equivalencia y navegación baseline se ejecutaron contra esa versión pública; sus controles siguen siendo compatibles con el backend actual.

Para recuperar en un checkout aislado del main vigente: restaurar únicamente las fuentes H06 y scripts/build-bundle.js desde c047eec, retirar app/private-resource-demand.js del build y regenerar el bundle con Babel Standalone 7.28.4. No restaurar el checkout completo ni los cambios de otras H. Publicar con números de bundle/worker mayores que los vigentes (por ejemplo 224/171 si continúa publicado 223/170), para que clientes y service worker reciban realmente la reversión. Conservar rutas y allowlist de build-pages-site.js; excluir supabase.env.

Ejecutar build, suites focales relevantes y scripts/test-global-image-regression-production-live.js local y publicado. Verificar 21 archivos públicos contra blobs/config del commit de recuperación y documentar workflow/hash. No ejecutar SQL, borrar documentos/assets/favoritos, cambiar bucket/RLS/TTL, revertir las migraciones H01–H05 ni publicar trabajo Savings pendiente. El coste anticipado anterior volvería temporalmente; la autorización permanece protegida.

Recovery preparado y verificable por hashes de los blobs baseline y por las pruebas actuales del frontend publicado H05; no se ensaya una reversión sobre producción sin una regresión que la requiera.
