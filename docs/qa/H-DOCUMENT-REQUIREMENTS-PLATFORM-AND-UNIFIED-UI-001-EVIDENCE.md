# H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001 — evidencia

Fecha: 2026-08-30
Estado: `PASS`

## Alcance y autoridad

- Se evolucionó la autoridad existente, sin crear una segunda plataforma: `document_types` define catálogo/capacidades; `program_document_requirements` define reglas; `affiliate_documents` conserva versiones; `request_documents` fija el archivo enviado; Storage privado conserva el binario.
- Los contextos válidos son `PROGRAM`, `MEMBERSHIP`, `COMPANY` y `PRODUCT`. `SERVICE` queda fail-closed: no existe entidad productiva demostrable y no se inventó una jerarquía.
- Producto hereda de empresa. Una regla `EXCLUDE` propia prevalece; `RESTORE` elimina la excepción y recupera herencia.
- Cada solicitud nueva recibe `document_requirements_snapshot` en backend. Las cinco solicitudes históricas permanecen con snapshot nulo y jamás se reinterpretan retroactivamente.
- La configuración se escribe exclusivamente por RPC administrativa con `documents.write`, motivo obligatorio e historial append-only. Escrituras directas de browser quedaron revocadas.

## Migración aplicada

- `20260830000200_document_requirements_platform_unified_ui.sql`: catálogo de capacidades, scopes, resolver, herencia, impacto, auditoría, snapshot, wrapper de solicitud y origen de carga.
- `20260830000210_enforce_document_upload_origin.sql`: elimina el overload antiguo de cinco argumentos que PostgREST aún podía ejecutar y obliga `CAMERA`/`FILE`.
- `20260830000220_fix_membership_document_scope.sql`: corrige el nombre real `membership_offerings.concept`; la falla fue reproducida en browser, corregida y recertificada.
- Forward dry-run, apply y recovery dry-run: `PASS`. El recovery integral se valida en orden inverso `00220 → 00210 → 00200`; los recoveries fallan cerrado ante historia que no sea seguro borrar.

## Verificación productiva

`python scripts/test-document-requirements-platform-live.py`:

| Control | Resultado |
|---|---|
| Requisitos Préstamo almacenados/resueltos | `8 / 8` |
| Requisitos Membresía almacenados | `24`; primera oferta habilitada resuelve `4` |
| Tipos documentales | `13` |
| Solicitudes históricas preservadas | `5 / 5` con snapshot nulo |
| Escritura directa catálogo/requisitos | `DENIED` |
| Resolver anónimo | `DENIED` |
| Writer antiguo de solicitudes | `DENIED` |
| RPC de carga de cinco argumentos | `DENIED` por llamada REST real |
| Herencia, exclusión y restauración de producto | `PASS`, fixture autorizada y `ROLLBACK` |
| Snapshot inmutable y vínculo `request_documents` | `PASS`, fixture y solicitud en `ROLLBACK` |
| Reglas/fondos/programas financieros | `146 / 35 / 3`, sin cambio |

La prueba reversible de reemplazo realizó una carga privada real con origen `FILE`: preservó el `VERIFIED` anterior, creó `PENDING_REVIEW`, registró auditoría, generó preview fresco, negó cruce/anónimo y eliminó exactamente la fixture. La matriz previa de aislamiento volvió a confirmar autoservicio propio, Admin explícito, impersonación, TTL 300, cero URLs en metadata y cruce denegado.

## UI única y Admin

- La fase compartida muestra tracker, progreso, chips, mosaicos a dos columnas, estados reales, preview, reemplazo y bloqueo controlado. Nunca toma identidad, estado o disponibilidad desde el HTML de referencia.
- `Tomar foto`: en móvil usa input `image/*` con `capture="environment"`; en desktop usa `getUserMedia`, captura a canvas y sube un `File` real.
- `Adjuntar archivo`: usa picker real, valida tipo/tamaño en frontend y nuevamente en backend, y sube a ruta privada ligada al afiliado efectivo.
- Préstamo, membresía, programa, beneficio, producto y cotización consumen el mismo resolver/gate y pasan IDs documentales al writer transaccional.
- Admin conserva revisión, términos y QR, y agrega catálogo global + reglas por destino, impacto previo, propio/heredado/excluido/restaurar y capacidades cámara/archivo.

Chrome real:

- Fase documental: `390×844`, `430×932`, `768×1024`; 2 columnas, 6 mosaicos, tracker `3/6`, cero overflow, cámara desktop activa y cero PII en evidencia.
- Admin: 174 destinos reales (`136` programa, `5` membresía, `33` empresa, `0` producto, `0` servicio); 13 tipos; desktop 2 columnas, móvil 1 columna, cero overflow y cero escrituras productivas.
- Membresía autenticada: 4 requisitos y controles de carga reales, `PASS`.
- El antiguo arnés integral de workbench desde origen local aleatorio no puede firmar preview por el allowlist CORS endurecido; su fixture quedó limpia. El contrato protegido de revisión pasa en la suite estática y la firma Admin/aislamiento pasa en la matriz viva dedicada.

## Cierre

- Suite estática: `62/62 PASS`.
- Bundle reproducible desde 92 fuentes y sintaxis: `PASS`; SHA-256 `38DA53D6B01A71AE7375E3D06BFB925EB918A7A038EF0EE3819D682A6418AE84`.
- UI Claude: `PASS`; se trasladó jerarquía/estados del HTML de referencia sin copiar `DATA`, `localStorage`, base64 ficticio ni controles simulados.
- Seguridad: `PASS`; JWT/RLS/RPC, afiliado derivado server-side, objetivo Admin explícito, Storage privado, sin secretos frontend y sin autorización sólo UI.
- Legacy: `NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE`; Google, Apps Script, Ahorro, fórmulas, tasas, saldos y elegibilidad financiera no se tocaron.
- Archivos inesperados: `0`. `WORK_QUEUE_HISTORY.md` no existe en el repositorio y no se fabricó.
- Limitación: producto/servicio tienen cero entidades productivas actuales; producto se certificó con fixture transaccional revertida y servicio permanece `N/A` hasta una H de autoridad explícita.

Evidencia visual y JSON: `docs/qa/evidence/document-requirements-platform-20260830/`.
