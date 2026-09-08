# H06 — medición

Baseline real: 135 productos / 268 vínculos. La lectura de afiliado devuelve 134 productos y 267 vínculos, pero antes firmaba los 268 vínculos globales, incluido el producto deshabilitado que no iba a mostrar. Browser con sesión controlada y perfiles nuevos, mismo viewport; no fixtures productivos ni URLs exportadas.

| Muestra | BEFORE | AFTER |
|---|---:|---:|
| Productos recuperados al abrir Autos | 134 | 3 |
| Vínculos recuperados | 268 | 27 |
| Firmas anticipadas de objetos al abrir Autos | 268 | 0 |
| Payload de productos/vínculos/favoritos/firma inicial | 419.918 B | 16.707 B |
| Objetos firmados, Autos → scroll → detalle → fullscreen → siguiente | 268 | 6 |
| HTTP observados en ese recorrido, incluidas imágenes y lecturas auxiliares | 28 | 22 |
| Bytes de respuestas en ese recorrido | 57.003.176 | 9.478.048 |
| Slots de la galería del producto probado | 9 | 9 |
| Fuentes asignadas inicialmente a imágenes de esa galería | 9 | 1 |
| Admin: metadatos del resumen | 135 (dos cargas) | 135 (una carga) |
| Admin: vínculos en resumen | 268 × 2 | 0 |
| Admin: objetos firmados en resumen | 536 | 0 |
| Admin: firma al seleccionar Autos / abrir editor | ya anticipadas | lote de 3 / lote de 9 |
| Miniaturas aisladas: inicial + cuatro renders con arrays nuevos | 40 autorizaciones | 6 |
| Miniaturas aisladas tras scroll completo | todas anticipadas | 8 únicas |
| Variante documental sin miniaturas | 8 autorizaciones innecesarias | 0 |
| Apertura explícita documental | 1 autorización nueva | 1 autorización nueva |

Evidencia: browser-navigation-before.json, browser-local.json, admin-before.json, admin-local.json, tests-workspace.json. Las imágenes del editor son necesarias al abrirlo; se conserva la galería histórica de nueve imágenes, sin reducirla al límite de productos nuevos.

Confirmación publicada: production-equivalence.json y browser-production.json reproducen exactamente 22 HTTP, 9.478.048 bytes, seis objetos firmados y seis consultas en el recorrido. La fase inicial publicada registró dos firmas de imágenes demandadas, frente a cero en la muestra local; la frontera temporal entre fases depende de la observación/visibilidad. No se afirma cero firmas iniciales en toda sesión. Ambas muestras evitan la firma global de 268 objetos. El editor publicado conserva los tres hashes del baseline y lotes de tres/nueve imágenes. Las 541 firmas del resumen bruto del harness publicado incluyen sus dos lecturas completas de compatibilidad solicitadas expresamente por el test; no son la navegación del usuario. Las métricas de esta tabla filtran exclusivamente navigation/scroll/detail/lightbox-auto.

Los bytes son cuerpos de respuesta observados por Chrome; no equivalen a bloques físicos de disco ni a facturación de transferencia. Los objetos solicitados a Storage se registran desde las peticiones de firma; no se presentan como un contador interno de invocaciones SQL de Supabase. El recorrido no ejecuta RPC nuevas de H06; conserva la validación de Ahorro y lectores auxiliares existentes. El número total de firmas HTTP puede diferir del de objetos porque se agrupan por lote. Los tiempos de red varían con el host; no se atribuye a H06 la resolución de swap/H02.

## SQL bajo RLS

EXPLAIN ANALYZE/BUFFERS de formas SQL representativas con un afiliado real, en READ ONLY y ROLLBACK. Incluye joins de metadatos privados; no afirma reproducir cada envoltura interna de PostgREST.

| Consulta | Filas devueltas antes/después | Buffer hits antes/después | Tiempo de muestra antes/después |
|---|---:|---:|---:|
| Productos | 134 / 3 | 51 / 4 | 36,183 / 0,183 ms |
| Vínculos y metadatos | 267 / 27 | 1.026 / 375 | 244,264 / 3,612 ms |

Productos usa program_catalog_items_program_order_idx; vínculos usa program_catalog_item_assets_item_idx. No índices nuevos. Persisten subplanes RLS legítimos (incluidas lecturas globales internas); están desglosados en plans.json y no se ocultan sumando sólo las filas de salida. Las lecturas físicas fueron cero en ambas muestras de caché caliente.

## Equivalencia

Los JSON completos de afiliado/Admin y cada categoría conservan sus hashes de productos, valores comerciales, identidad, orden y vínculos. Las URLs, por ser temporales, se excluyen del hash, pero su accesibilidad real se comprueba en la regresión global (248 assets distintos). Resumen, filas y editor Admin tienen los mismos hashes de texto, valores y controles; nueve imágenes antes/después. No se afirma una igualdad pixel-perfect de estados de carga transitorios.
