# H-UNIVERSAL-PROGRAM-PRODUCT-PAYMENT-SIMULATOR-001 — resultado y evidencia

Fecha: 2026-08-31

Precondición: `H-SUTIAPP-PROGRAM-PRODUCTS-ADMIN-CUTOVER-001` PASS en `ceec42d90a873fc5f47bec28bce3fa8f2208c1cf`
Estado: `PASS_WITH_OWNER_DECISION`

## Alcance implementado

- Simulador universal dentro del detalle de productos propios, sin alterar Marketplace ni Panel Empresarial.
- Precio autorizado desde `program_catalog_items.price_cash` o desde la última cotización propia aprobada y vigente.
- Enganche, monto financiado, plazo, desglose, calendario, documentos, firma, términos, confirmación, éxito e Historial.
- Cálculo con el criterio activo de Caja Chica, política vigente de plazo y resolver certificado Supabase.
- Solicitud atómica `PROGRAM_PRODUCT_PAYMENT_V1` y aprobación Admin Supabase-only.
- Calendario único server-side: proceso 1/3 quincenal; JUB mensual el día 5.

## Evidencia productiva

### Migración, deploy y recuperación

- `20260831000500_universal_program_product_payment_simulator.sql` aplicado en producción.
- `20260831000501_universal_program_product_payment_admin_projection.sql` aplicado en producción.
- `financial-legacy` versión productiva 31, JWT habilitado, estado ACTIVE y SHA compilado `5721fe29ff4d82a88dd97afe6bd2098dbd07498a64249a375b84eea6a99edf1f`.
- Forward/recovery dry-run antes de actividad legítima: PASS, 0 escrituras persistentes.
- No se ejecutó recovery real. Después del alta administrativa legítima, la guarda `RECOVERY_BLOCKED_PROGRAM_PRODUCT_PAYMENT_HISTORY_EXISTS` debe conservar esa historia.

### Catálogo y precios

- 65/65 productos fijos permanecen con `requires_quote=false` y precio idéntico al corte aprobado.
- Grupos verificados: Aires 16, Autos 3, Casa 35, Cómputo 1, Puertas 3, Renta 1, Terrenos 3 y Tours 3.
- `marketplace_products`: 0 filas modificadas.
- Hash del catálogo verificado: `c8e07114a89bf73956a60759cccb585e`.

### Calendario

- Proceso 1: 12 descuentos, primero `2026-09-30` para ancla productiva de prueba.
- JUB: 12 descuentos mensuales, primero `2026-10-05`, último `2027-09-05`, todos en día 5.
- Máximo de plazo + 1: denegado por backend con 422.
- La función reconcilia el total y ajusta sólo el último pago por redondeo.

### Flujo real afiliado → Supabase → Admin

- Producto QA controlado: Aires, precio fijo autorizado `$4,292`, plazo 12.
- El afiliado recorrió detalle, simulación, calendario, documentos vigentes, firma, términos y confirmación reales.
- Doble clic en enviar creó exactamente una solicitud y un folio real.
- La solicitud conserva snapshot financiero/calendario, vínculos documentales y una auditoría de confirmación.
- Admin principal leyó la proyección sanitizada y aprobó dos veces con el mismo `client_action_id`: una transición y un evento, demostrando idempotencia.
- Estado final: `approved`; procesamiento: `completed`; exportaciones: 0; auditorías sensibles confirmación+aprobación: 2; escrituras Google: 0.
- La solicitud QA controlada permanece como historia legítima y no fue borrada.

### UI, seguridad y regresiones

- Diseño de referencia preservado en móvil y escritorio: tarjeta colapsable, hero guinda, precio, enganche, plazo, desglose, calendario y CTA.
- Admin workbench real: 1024/1280/1440 y móvil 430 sin overflow; filtros, búsqueda, teclado, detalle, documentos, términos, snapshot y timeline PASS.
- Anónimo, cross-user, Admin normal y lectura directa de columnas financieras: DENIED.
- Snapshots service-only; actor real, afiliado efectivo e impersonación auditada verificados.
- Documentos: 8 requisitos actuales, 11 documentos disponibles, objetos físicos completos, URL privada fresca, expiración y visor PASS; pruebas estáticas de cámara/archivo/reemplazo/historia PASS.
- Regresiones: membresía móvil/tablet PASS, préstamo personalizado/live PASS, Historial self PASS, Admin catálogo PASS y suite estática universal PASS.

## DEFERRED_PRODUCTIVE_E2E

1. `DEFERRED_PRODUCTIVE_E2E_QUOTED_AMOUNT`: recorrido posterior a `quoted_amount` con una cotización productiva real, propia, aprobada y vigente. El gate y rechazo backend están verificados; no se inventará precio, vigencia ni cotización.
2. `DEFERRED_PRODUCTIVE_E2E_DOCUMENT_REPLACEMENT`: reemplazo con archivo legítimo expresamente autorizado. No se sustituirá evidencia real ni se creará un faltante artificial para certificar la prueba.

Ambas pruebas se ejecutarán posteriormente sólo cuando existan insumos legítimos. La evidencia no destructiva actual fue aceptada expresamente por el propietario para cerrar esta H como `PASS_WITH_OWNER_DECISION`.

## Cierre

## Revisión arquitectónica independiente

Veredicto final: `APPROVED` bajo cierre `PASS_WITH_OWNER_DECISION` autorizado por el propietario.

La implementación, la ruta de precio fijo, JUB, seguridad, Admin y regresiones están demostradas. Los casos C y D permanecen explícitamente diferidos y no se presentan como pruebas ejecutadas:

- Caso C necesita una cotización económica real, propia, aprobada y vigente. No existe ninguna; crear importe/vigencia sólo para QA violaría la prohibición de datos sintéticos.
- Caso D exige reemplazar un documento. Las cuentas controladas no tienen un tipo requerido faltante y no se recibió un archivo real autorizado; sustituir evidencia vigente por una imagen ficticia sería destructivo y falso.

El propietario aceptó la evidencia no destructiva y prohibió crear cotizaciones o reemplazar documentos reales sólo para certificar. No existe `docs/WORK_QUEUE_HISTORY.md`; esta ausencia queda registrada sin impedir reconstruir la autorización explícita. No se ejecuta otra H ni se avanza la cola.

```text
H-UNIVERSAL-PROGRAM-PRODUCT-PAYMENT-SIMULATOR-001 RESULT
Status: PASS_WITH_OWNER_DECISION
Files changed: frontend, repositories, Admin, Edge, migrations/recoveries, tests, evidencia y gobierno
Source-of-truth verdict: PASS
Invariant verdict: PASS
Build: PASS
Tests: PASS_WITH_OWNER_DECISION — dos `DEFERRED_PRODUCTIVE_E2E` aceptados por owner, sin datos sintéticos
Security: PASS
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: `DEFERRED_PRODUCTIVE_E2E_QUOTED_AMOUNT`; `DEFERRED_PRODUCTIVE_E2E_DOCUMENT_REPLACEMENT`
Evidence: comandos y resultados descritos en este documento y artefactos `docs/qa/evidence/`
```
