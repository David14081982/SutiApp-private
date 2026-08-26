# H-007.3 — Empresas reales + Popups

Fecha: 2026-08-21  
Estado: `PASS`

## Alcance y autoridad

La lectura Google fue estrictamente `READ ONLY` y acotada. `Convenios2!A1:I46` contiene 33 filas significativas en orden físico; `Convenios Suti` sólo contiene encabezados y `Empresas Suticompras` una fila de prueba incompleta. Por ello, `Convenios2` queda designada como procedencia histórica autoritativa exclusivamente para el directorio público de empresas/convenios. No se extiende esta decisión a Marketplace, productos, planes, Auth empresarial, catálogos ni CRUD administrativo.

El snapshot inmutable es `data/h0073-companies-source.json`, SHA-256 `41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F`. Conserva orden, celdas raw y coordenadas de assets; no parsea nombres compuestos, descuentos, categorías o beneficios.

## Importación y assets

- Fuente: 33 filas.
- Destino: 33 empresas reconciliadas.
- Relaciones: 35/35 (`33 cover`, `2 gallery`).
- Archivos nuevos: 0; se reutilizaron exclusivamente objetos H-007.2 de `company-assets`.
- Logos inferidos: 0. El encabezado histórico `Imagen` se representa como portada, no como logo.
- Registros rechazados o perdidos: 0.

El primer intento insertó idempotentemente las 33 empresas y fue rechazado al crear relaciones por usar `id` en una tabla con clave compuesta. Se corrigió el importador para usar `(company_id, asset_id, role)` y la reconciliación final confirmó 33/33 y 35/35. El recovery versionado elimina sólo esta proyección por hash y hoja; el borrado en cascada cubre sus relaciones sin tocar assets compartidos.

## Runtime

`CompaniesRepository` consulta Supabase y resuelve las relaciones a URLs públicas de Storage. `ConveniosScreen` y `ConvenioDetail` consumen la proyección en memoria, con estados loading/error/loaded. La pantalla migrada no lee `DATA`, `adminStore`, `companyStore`, `catalogStore`, `localStorage`, Google ni URLs Glide. Marketplace completo permanece intacto y fuera del alcance.

## Popups

`Promociones!A1:E88` tiene tres filas con imagen únicamente. No hay título, cuerpo, acción, audiencia, vigencia, propietario ni estado de publicación. Resultado: 3 candidatos preservados, 0 activos, 0 devueltos por RLS pública. No se inventaron reglas.

## Seguridad, legacy y pruebas

RLS está habilitada y forzada en `companies`, `company_assets` y `popups`; clientes no tienen grants de escritura. La prueba remota confirmó 33 empresas públicas, 35 vínculos, 0 popups públicos y 3 cuentas Auth sin cambios. Chrome headless confirmó 33 tarjetas, imágenes servidas únicamente desde `/storage/v1/object/public/company-assets/`, detalle real, sesión y logout. Build, sintaxis y pruebas H-007.2/H-007.3 pasaron.

Google quedó sin escrituras. Ahorro, Préstamos, fórmulas, Apps Script y legacy financiero no fueron tocados. No se inició otra H.
