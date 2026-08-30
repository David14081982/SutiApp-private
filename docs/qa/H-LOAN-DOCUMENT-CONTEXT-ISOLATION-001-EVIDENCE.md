# H-LOAN-DOCUMENT-CONTEXT-ISOLATION-001 — evidencia

Fecha: 2026-08-30
Estado: `PASS`

## Incidente y causa demostrada

El contrato anterior de `DocumentWorkflowRepository` mezclaba autoservicio y Administración: aceptaba un afiliado opcional, la RLS global de `documents.read` podía ampliar el resultado y el listado generaba URLs firmadas en lote. La pantalla de préstamo consumía esa proyección ambigua. El mensaje posterior de documentos no disponibles era consistente con metadata ajena o con capacidades/objetos ya inválidos.

## Remediación aplicada

- Autoservicio: `list_effective_affiliate_documents(purpose)` deriva el afiliado efectivo en backend; no acepta objetivo y Admin no amplía el resultado.
- Administración: `list_admin_affiliate_documents(target,purpose)` exige `documents.read` y objetivo explícito.
- Vista previa: `document-access` valida JWT y contexto, autoriza un documento, firma por 300 segundos y responde `private, no-store`.
- Listados: cero URLs firmadas y cero rutas Storage; se eliminó `createSignedUrls` del repository.
- Auditoría: `document_access_audit_log` conserva actor real, efectivo, objetivo, documento, propósito, modo, impersonación y fecha; no conserva URL, token ni ruta.
- Histórico: las filas importadas permanecen `VERIFIED`; la UI aclara `Histórico importado` cuando no hay evidencia de revisión humana.
- Gate final: `request_documents_require_available_object` y la validación de solicitud permanecen sin cambios.

## Migración y despliegue

- Forward dry run con `ROLLBACK`: `PASS`.
- Apply: `PASS`.
- Recovery dry run inmediatamente después del apply y antes de eventos: `PASS`; estado desplegado preservado tras rollback.
- Estado final: tabla y cuatro RPC presentes; RLS habilitada/forzada; escritura browser denegada; anónimo sin ejecución.
- Edge `document-access`: versión 1 `ACTIVE`, `verify_jwt=true`; bundle ESZIP remoto verificado con cuatro marcadores obligatorios.
- Conteos protegidos antes/después: 947 afiliados; 3,425 documentos; 0 vínculos `request_documents`; 146 reglas; 35 fondos; 3 programas.
- Al cierre existen 13 eventos de acceso esperados. Desde ese punto el recovery SQL falla cerrado para preservar la bitácora; no borra historia.

## Matriz adversarial viva

`python scripts/test-loan-document-context-isolation-live.py`:

| Caso | Resultado |
|---|---|
| Afiliado normal: listado y vista propia | `PASS` |
| Afiliado normal: documento ajeno | `DENIED` |
| Admin dentro de autoservicio: documento ajeno | `DENIED` |
| Admin explícito con `documents.read` | `PASS` |
| Admin sin afiliado propio, prueba transaccional | `PASS`, `ROLLBACK` |
| Impersonación: efectivo objetivo y actor real preservado | `PASS` |
| Anónimo | `DENIED` |
| Auditoría, cardinalidad y ausencia de secretos | `PASS` |

Resultado: 3 cuentas, 8 casos, 3 firmas individuales, 0 URLs en metadatos, TTL 300 s, 8 eventos focales inspeccionados y 0 secretos impresos.

## Browser y regresión

- `test-loan-document-context-isolation-browser.js`: Chrome `PASS`; 7 documentos, todos del afiliado autenticado, 0 URLs al listar, firma sólo al pulsar `Ver`, URL descargable, acciones de cámara/reemplazo preservadas y procedencia histórica visible.
- `test-loan-document-flow-browser.js`: Chrome `PASS`; 8 requisitos, disponibilidad física, firma fresca, objeto faltante, cámara y reemplazo.
- Suite estática productiva: `61/61 PASS`.
- Contrato focal: `test-loan-document-context-isolation.js PASS`.
- Bundle reproducible desde 92 fuentes; `node --check app/bundle.js PASS`; SHA-256 `7569486F2EBA39CEB530B8BF51835C1E7FD9B50C7965AFB601BDBD9E742CC773`.
- HTML `bundle.js?v=169`; Service Worker `sutiapp-v113`.

## Veredictos

- Fuente de verdad: `PASS` — `affiliate_documents`/`document_types` + `private_assets` + objeto privado permanecen canónicos; la auditoría no es segunda autoridad.
- Invariantes: `PASS` — aislamiento, firma individual, disponibilidad, `VERIFIED` inmutable y snapshot de solicitud preservados.
- Seguridad: `PASS` — JWT, RLS, permiso backend, objetivo Admin explícito, cruce y anónimo denegados, secreto sólo Edge.
- Legacy: `NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE` — Google, Apps Script, Ahorro y lógica financiera no se tocaron.
- UI Claude: `PASS` — componentes, jerarquía, cámara, reemplazo, revisión Admin, navegación y estados se preservaron; sólo cambió contrato de datos, preview, copy de error y procedencia.
- Archivos inesperados: `0`; la evidencia de Admin Afiliados alterada por un arnés fallido fue restaurada exactamente.

## Limitación/decisión del propietario

No se reclasificó masivamente ningún `VERIFIED` histórico. Determinar cuáles deben dejar de considerarse válidos requiere una decisión de negocio y una H independiente con evidencia de revisión; esta remediación sólo hace visible su procedencia y elimina el riesgo de contexto cruzado.
