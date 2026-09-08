# H07 — comparación

| Caso | BEFORE | AFTER | Equivalencia |
|---|---:|---:|---|
| Store portal válido, 33 empresas, fixture aislada | 39 llamadas | 7 | JSON completo idéntico, cada promoción en su empresa |
| Store válido, 101 empresas | 107 | 8 | Completo idéntico, dos lotes |
| Lector real empresas/promociones, 33 empresas sin promociones | 34 | 2 | Hash1513fc19… idéntico |
| Tiempo del lote de promociones real | 6.693,9 ms | 239,3 ms local | Mismos33 grupos vacíos; muestra finita |
| Cuerpos de respuesta del lector real | 22.120 B | 24.197 B | El embed añade IDs/envolturas; se elimina el coste de32 peticiones. No confundir cuerpos JSON con transferencia HTTP total |
| Transferencia HTTP instrumentada del lector, segunda muestra | 87.405 B /34 peticiones | 10.609 B /2 peticiones | Suma de los cuatro tamaños request.sizes() de Playwright; mismo hash completo. Estimación del navegador, no captura de paquetes TLS |
| Export real, 954 afiliados/123 Auth vinculados | 1 página +123 getUserById | 1 página +1 RPC batch | CSV byte por byte y todas las celdas XLSX idénticos |
| CSV real | 409.408 B;7.202 ms | 409.408 B;2.423 ms | Hash55e13720… igual |
| XLSX real | 954 filas;3.120 ms | 954 filas;2.040 ms | Hash canónico d13d405f… igual; mismos headers/formatos |
| Export aislado límite20.000,16.000 vínculos | 21 páginas +16.000 Auth | 21 páginas +16 lotes | Todas las filas/celdas CSV iguales;21ª página conserva detección de exceso |
| Export aislado20.001 | Rechazo413 antes de Auth | Mismo rechazo antes del batch | No archivo ni auditoría de éxito |
| Admin miniaturas aisladas,8 tarjetas/viewport360alto | 8 firmas iniciales | 3 | Mismos textos/tarjetas; al recorrerlas:8 en ambos |
| Miniaturas Admin, cuatro renders con arrays nuevos | 8 acumuladas | 3 acumuladas | No repetición por referencia |
| Admin real,10 tarjetas viewport1440×900 | 10 iniciales/10 recorridas | 10 iniciales/10 recorridas | Todas son visibles en esta geometría; mismo hash de texto |
| Apertura explícita Admin tras miniatura | Reutilizaba firma local sin nuevo audit | 1 autorización nueva | Acceso vigente/auditoría preservados; no caché indefinida |

0 empresas:6→6;1 empresa:7→7. No se reclama mejora de N+1 cuando N≤1. Documentos distintos autorizados individualmente siguen requiriendo N verificaciones; sólo se elimina trabajo anticipado/repetido. Reordenamientos no equivalentes quedan intactos por la condición expresa del propietario, no como optimización pendiente omitida.

Portal actual: companyStore devuelve42501 en program_requests antes de llegar a promociones, también en baseline H06. El resultado completo de ese error se compara real antes/local/publicado; la mejora34→2 pertenece al lector autorizado directo. Los casos con promociones reales de fixture y permisos se comparan en transacciones revertidas. No se presenta el portal como reparado ni se amplían permisos para superar esa denegación.

Fuentes: portal-before/local.json, export-before/final.json, tests-scoped-*.json, portal-security.json, previews-*.json, admin-previews-before/local.json, rpc-http.json y backend-integrity.json. Los tiempos son muestras con host/red variables, sin promesa de rendimiento futuro ni de resolver swap/H02. XLSX se compara por celdas y encabezados, sin exigir igualdad de timestamps internos del ZIP.
