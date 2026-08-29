# H-LOAN-DOCUMENT-FLOW-RECOVERY-001 — evidencia

Fecha: 2026-08-29

## Diagnóstico demostrado

- La pantalla conservaba una signed URL de 300 segundos y `Ver` abría directamente ese valor; al expirar, Storage respondía `InvalidJWT` fuera de SutiApp.
- La resolución de requisitos comprobaba metadata/estado pero no existencia física y podía seleccionar una versión anterior.
- `register_affiliate_document` impedía reemplazar un `VERIFIED` en vez de crear una versión nueva.
- El writer final no repetía la existencia física del objeto al adjuntar documentos a la solicitud.

## Corrección

- `freshPreview` revalida disponibilidad y firma de nuevo en cada clic.
- `list` une su proyección a `private_assets`/Storage y sólo firma objetos disponibles.
- Cámara y archivo/galería tienen controles separados; las imágenes admiten preparación previa con EXIF y compresión.
- Un reemplazo crea una fila enlazada; la anterior verificada permanece inmutable.
- La versión más reciente gobierna UI y backend. La lista de faltantes usa nombres exactos y el retorno a Documentos conserva el estado del préstamo.
- El trigger final falla cerrado con `REQUIRED_DOCUMENTS_MISSING` si la versión no es la más reciente o el objeto no existe.

## Evidencia ejecutable

```text
node scripts/test-static-suite.js
PASS 59/59

node scripts/test-loan-document-flow.js
PASS cases=10

python scripts/test-loan-document-flow-migration-live.py --apply
PASS: forward/recovery, aplicación idempotente, conteos e integridad

python scripts/test-loan-document-replacement-live.py
PASS: carga, galería, verificación, reemplazo, objeto, fresh preview, afiliado cruzado denegado, anónimo denegado, cleanup exacto

node scripts/test-loan-document-flow-browser.js
Prueba Chrome real autenticada, expediente/requisitos live, URL expirada centinela ignorada, fetch firmado 200, cámara environment y recuperación de objeto ausente; persistentWrites=0
```

## Integridad

- Aplicación de migración: afiliados 947; documentos 3,425; adjuntos de solicitud 0; assets 13,048; objetos privados 13,051; auditorías 26; cambios de filas de negocio 0.
- La prueba reversible restaura exactamente documentos, assets, objetos y auditoría.
- Bucket `private-assets` continúa privado; no se agrega `service_role` al frontend.
- Google, Apps Script, tasas, montos, plazos, fórmulas, reglas de elegibilidad, roles y términos legales: cero cambios.
