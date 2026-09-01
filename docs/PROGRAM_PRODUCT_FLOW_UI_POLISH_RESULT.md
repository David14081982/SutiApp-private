# H-PROGRAM-PRODUCT-FLOW-UI-POLISH-001 — resultado y evidencia

Fecha: 2026-08-31
Estado: `PASS`

## Decisión de alcance vigente

El propietario excluyó expresamente `Terrenos` durante la ejecución porque conserva una experiencia propia (`TerrenoScreen`) distinta del catálogo compartido. Su ruta y pantalla permanecen intactas. Para conservar seis programas en la matriz visual, se verificó `Solar` en su lugar.

## Cambios UI

- Las categorías con catálogo ya no muestran el footer `Solicitar este beneficio`; el contenido termina sin hueco reservado y la acción comienza en un producto concreto.
- El detalle de un producto propio conserva una sola acción: la card accesible `Simula tu plan de pago`. Se retiró el footer duplicado `VER PLAN DE PAGO`.
- El shell compartido eleva el ícono de categoría sobre la transición hero/contenido, mantiene sus `64 × 64 px`, sombra y separación del título.
- La fase Documentos crea un contexto de apilamiento aislado, limita overflow al viewport, asigna `z-index: 10` al footer y reserva `144 px + safe-area` al final del scroll.
- No se modificaron cálculos, reglas Caja Chica, JUB/Proceso, repositories, Edge Functions, Supabase, documentos, replacement, firma, términos, solicitudes, Historial, Admin, RLS o RPC.

## Evidencia browser productiva no destructiva

Comando:

```text
node scripts/test-program-product-flow-ui-polish-browser.js
```

Resultado:

```json
{"status":"PASS","categories":["Puertas de Seguridad","Suti Auto","Suti Casa","Equipos de Cómputo","Paneles Solares","Aires Acondicionados"],"responsive":["390","430","desktop"],"product":"DuVENTUS Nova Classic, 1 ton (110V)","requestSubmitted":false}
```

La prueba usó el afiliado QA vigente y el origen local certificado `127.0.0.1:8080`. Abrió una sesión de simulación real y reutilizó el expediente existente, pero no firmó, no reemplazó documentos y no envió una solicitud. Las miniaturas privadas se evaluaron en el DOM real y se redactaron visualmente antes de capturar, por lo que los artefactos versionados no contienen PII documental.

### Categorías

En Aires, Puertas, Autos, Casa, Cómputo y Solar:

- ícono `64 × 64`, completamente visible;
- cero colisión con título;
- cero `Solicitar este beneficio`;
- cero overflow horizontal;
- screenshot 430 px por programa.

### Detalle

- card principal: 1;
- `VER PLAN DE PAGO`: 0;
- nombre accesible: `Abrir simulador de plan de pago`;
- simulador real: `READY`;
- producto fijo QA: `DuVENTUS Nova Classic, 1 ton (110V)`.

### Documentos y responsive

| Viewport | Footer z-index | Fin del scroll | Footer domina hit-test | Último documento completo | Bottom padding | Overflow horizontal |
|---|---:|---|---|---|---:|---|
| 390 | 10 | PASS | PASS | PASS | 144 px | 0 |
| 430 | 10 | PASS | PASS | PASS | 144 px | 0 |
| Desktop 1366 × 900 | 10 | PASS | PASS | PASS | 144 px | 0 |

Resumen/firma abrió en 430 px, conservó el CTA inferior y no presentó errores runtime. Success no se volvió a producir porque esta H no autorizó crear otra solicitud; su recorrido real, folio, confeti e Historial permanecen cubiertos por `docs/UNIVERSAL_PROGRAM_PRODUCT_PAYMENT_SIMULATOR_RESULT.md`, y los componentes funcionales correspondientes no cambiaron.

Artefactos: `docs/qa/evidence/program-product-flow-ui-polish-20260831/`.

## Regresión mínima

```text
node scripts/test-program-products-admin-cutover.js
PASS — priced 65; Aires 16; Puertas 3; marketplaceTouched 0

node scripts/test-program-catalog-cutover.js
PASS — 134 items; distribución completa preservada

node scripts/test-universal-program-product-payment-simulator.js
PASS — JUB mensual día 5 después de 30 días; autoridades y bundle válidos

node --check scripts/test-program-product-flow-ui-polish-browser.js
PASS

node --check scripts/test-universal-program-product-payment-simulator-browser.js
PASS

vm.Script(app/bundle.js)
PASS
```

## Cierre

```text
H-PROGRAM-PRODUCT-FLOW-UI-POLISH-001 RESULT
Status: PASS
Files changed: shell de categoría; detalle de catálogo; contenedor del flujo de pago; bundle/cache; pruebas y evidencia
Source-of-truth verdict: PASS — program_catalog_items y autoridades financieras/documentales permanecen sin cambios
Invariant verdict: PASS — INV-015, INV-036, INV-059–062 e INV-146–153 preservadas
Build: PASS — bundle reproducible desde 95 fuentes; sintaxis válida
Tests: PASS — browser seis programas; 390/430/desktop; regresiones de catálogo, cutover y simulador
Security: PASS — cero secretos en frontend; evidencia documental redactada; ninguna escritura ni cambio RLS/RPC
Legacy impact: NO INTERACTION — Google read 0 / write 0 / Apps Script change 0 / calculations changed 0
Unexpected files changed: 0
Known limitations: Terrenos NOT APPLICABLE por decisión explícita del propietario; Success no se regeneró para evitar otra solicitud productiva
Evidence: docs/PROGRAM_PRODUCT_FLOW_UI_POLISH_RESULT.md y docs/qa/evidence/program-product-flow-ui-polish-20260831/
```
