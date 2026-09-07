# Panel de Ahorro: entrega de revisión privada

Esta entrega conecta el diseño adjunto con la información importada en Supabase y con las correcciones privadas del encargado. **No equivale a terminar la operación financiera ni a publicar saldos nuevos a los ahorradores.**

## Qué puede revisar el encargado

- Las cuatro pestañas: Cobranza, Ahorradores, Retiros y cambios, Revisión.
- Búsqueda por nombre o Folio, filtros y páginas de 20 personas. El expediente conserva el contexto al volver; Anterior y Siguiente también funcionan entre páginas.
- Saldo reconocido en la copia original, aportación, primera fecha de descuento, inicio del plan y descuentos por fecha. Se muestran seis fechas inicialmente y se pueden consultar las restantes.
- Una lista de retiros por persona. La fecha procede de D y el importe de G de «Solicitud de retiro». El Folio 11402 conserva el retiro de $6,768.64 del 1 de julio de 2026.
- Correcciones de datos y descuentos, restauración del descuento original, revisión y reapertura del expediente. **Las observaciones son opcionales**, incluso vacías; se guardan responsable, fecha y valores anteriores/nuevos.
- Administración de accesos y consulta de los datos anteriores. Los campos calculados del archivo no se editan desde este panel.

Las correcciones se guardan como propuestas privadas, separadas del original. Corregir el importe de un retiro antiguo no vuelve a pagarlo. Cambiar un Folio no reasigna movimientos automáticamente.

## Información real encontrada

La copia tiene corte del **6 de septiembre de 2026**; no es una consulta en vivo de Google Sheets. Contiene 366 filas de Ahorro y 354 solicitudes históricas: 228 retiros y 126 cambios de monto. Los 228 retiros aparecen como completados; nueve cambios no tienen confirmación clara de aplicación. Los nombres se buscan por el Folio original exacto en el padrón: 359 coincidencias únicas, cinco duplicadas y dos sin coincidencia. Estos últimos registros permanecen visibles.

La suma de Q de las 366 filas es **$1,996,873.50**. La cifra reproduce el saldo reconocido del archivo; no sustituye la revisión del encargado. Los datos publicados previamente a los afiliados conservan su lector actual.

## Qué todavía no está incluido como operación terminada

1. **Autorizar y pagar retiros nuevos, rechazar solicitudes nuevas y aplicar cambios a la nómina.** Esta pantalla permite revisar los registros importados. No convierte solicitudes históricas completadas en pagos nuevos. La base operativa consultada aún tiene cero movimientos, cero solicitudes operativas y cero cuentas certificadas; falta concluir y activar ese circuito sobre saldos revisados.
2. **El importe que debía descontarse en cada fecha, porcentaje cobrado y periodos consecutivos faltantes.** La copia contiene importes por fecha, pero no un historial certificado de la aportación vigente en cada una. Un cero tampoco prueba por sí solo un descuento omitido. Se muestra el importe registrado y se señala lo que falta confirmar.
3. **Rehacer automáticamente las proyecciones al corregir aportación, estado o fecha de inicio.** La próxima previsión corresponde a las columnas futuras de la copia. No se presenta una proyección nueva como si ya estuviera calculada. Las correcciones de descuentos históricos muestran por separado su efecto sobre Q cuando pertenecen al plan original.
4. **Separar y certificar capital y rendimiento remanentes de todos los años.** AR ya incluye el rendimiento DT. Se conservan los totales anuales y el registro combinado, sin volver a abonarlos. La lista completa de retiros puede abarcar periodos anteriores; su total no se resta otra vez de Q.
5. **Capturar tasas nuevas, abrir retiros, excepciones, altas nuevas, transiciones a jubilación y bloqueo de pago por préstamos dentro de esta nueva pantalla.** Las reglas acordadas permanecen como requisitos de la operación pendiente. No se simulan decisiones basadas en una copia antigua de préstamos.
6. **PDF de autorizaciones y beneficiarios.** No forman parte de esta entrega de revisión.
7. **Prueba con una sesión real del encargado y dispositivos físicos Safari/iPhone o Android.** Se probó Chromium en tamaños móviles y escritorio. No se afirma haber realizado una prueba física ni de acceso autenticado en producción.

No hay que pedir al programador que decida cuánto corresponde a cada persona: el encargado puede revisar los datos importados, corregirlos con observación opcional y dejar constancia de su revisión. Marcar «Revisado» no certifica automáticamente una apertura financiera.

## Mapeo definitivo

| Elemento | Fuente / campo | Tratamiento |
|---|---|---|
| Nombre y Folio | `savings_review_records.source_folio` → `affiliates.numero_control` | Coincidencia textual exacta; DUPLICADO / SIN REGISTRO visibles |
| Saldo reconocido y suma filtrada | Ahorro Q | Original inmutable, agregado en servidor |
| Saldo tras corregir descuentos | Q + diferencias entre importes originales y propuestas en fechas históricas del plan original | Separado del original; futuro excluido por metadatos del corte |
| Aportación, estado, primera fecha, inicio del plan | R, W, F, X | R/W/F admiten propuesta; X se consulta |
| Descuentos por fecha | AA:DO + `field_defs` | Históricos paginados; ceros y vacíos distintos; AR incluye DT |
| Capital y rendimiento del plan | G − DT y DT | Solo cuando el plan original incluye AR y su importe permite la separación; de otro modo, por confirmar |
| Retiros descontados en el saldo del plan | H + I + J | Se conservan para reconstruir Q; no se sustituyen por el total histórico |
| Total histórico de retiros registrados | «Solicitud de retiro», Folio exacto, H = Completado, suma G | Lectura original; importe desconocido o copias múltiples no producen una suma aparentemente válida |
| Cada retiro | D fecha, E tipo, F continúa, G importe, H estado | Una fila por solicitud; propuesta privada separada |
| Cambios de monto | «Solicitud Cambio ahorro»: B fecha, C anterior, D nuevo, E realizado | Estado original separado de revisión administrativa |
| Totales anuales | DP/DQ/DR, DS/DT/DU, DV/DW | Consulta histórica, no nuevos abonos |
| Próxima previsión | Primera fecha positiva marcada futura en la captura | No promoción por reloj ni recálculo con aportación actual |
| Cobranza | Valores originales de la última fecha histórica capturada | Esperado y porcentaje desconocidos hasta conciliar |
| Revisiones y bitácora | `savings_review_records.proposed_data/status`, `savings_review_events` | Versión, idempotencia, actor autenticado, fecha, observación opcional |
| Acceso | Permisos `savings.read`, revisión/identidad y configuración administrativa existentes | Verificados también en funciones de servidor |

La fórmula contrastada para el plan original es `Q = G + O − H − I − J`. O se conserva únicamente como antecedente, sin habilitar «Saldo manual». El rendimiento de DT ya está contenido en AR y, por tanto, en el acumulado correspondiente.

## Verificación y límites

`sql-result.json`: pruebas con datos reales dentro de una transacción revertida: conteos y sumas, búsquedas, filtros, páginas, navegación, retiro 11402, seis fechas, corrección sin observación, idempotencia, versión obsoleta, saldo calculado no editable, importes negativos, restauración de original incluso vacío/texto, marcar/reabrir, permisos y recuperación. Se comparan también huellas de registros de revisión, eventos y participantes.

`browser-result.json`: interacciones aisladas con red bloqueada y datos de prueba exclusivos del test, anchos 320/375/390/430/1440, estados vacío/error/reintento, navegación, conservación del foco, solicitudes y correcciones. Las capturas son de pruebas; no contienen saldos reales de afiliados.

`five-record-reconciliation.json`: cinco expedientes reales cuadran aritméticamente dentro del plan importado. La evidencia individual se conserva fuera del repositorio por contener datos personales. **No acredita recibos bancarios ni la distribución del saldo remanente entre capital y rendimiento.**

| Pruebas solicitadas | Resultado y alcance |
|---|---|
| 1–6: carga, nombre, Folio, filtros, páginas, indicadores | PASS sobre la copia real; los indicadores sin base suficiente se muestran por confirmar |
| 7: cobranza | Parcial: importe registrado comprobado; esperado/porcentaje no certificados |
| 8: registrar descuento sin duplicación | PASS como corrección privada idempotente; pendiente como abono financiero operativo |
| 9–13: autorizar retiro parcial/total/cambio, rechazo y motivo | Pendientes de circuito operativo; no se declaran probadas por editar una solicitud histórica |
| 14–18: corregir, restaurar, revisar, reabrir, bitácora | PASS para revisión privada; observación opcional por instrucción posterior del propietario |
| 19: permisos | PASS en servidor para lectura/escritura privadas; no equivale a validar operaciones financieras nuevas |
| 20: carga, error, vacío | PASS en navegador aislado |

## Archivos y recuperación

Fuentes nuevas: `app/savings-panel-reference.jsx`, `app/savings-panel-admin.jsx`, `app/savings-panel-repository.js`. Integración focal en el export de `screens-admin-savings.jsx`, orden del constructor del bundle, prop de solo lectura de `savings-review-admin.jsx` y resultado explícito con comprobación de expediente en `savings-withdrawal-list.jsx`.

Migración `20260906001000_savings_reference_panel.sql`: funciones adicionales de consulta y revisión privada. No modifica datos históricos, no publica saldos y no activa las migraciones operativas pendientes 001–004. Recuperación: primero restaurar el frontend anterior y después ejecutar su archivo de recuperación; se conservan propuestas y bitácora.

No se copió el store demostrativo, seeds, tasa del 6%, iframe, localStorage ni una fuente alternativa al fallar Supabase. El diseño se recompuso con componentes reales. Las diferencias funcionales enumeradas arriba impiden declarar equivalencia completa con el contrato operativo del adjunto.

```text
H-SAVINGS-REFERENCE-PANEL-001 RESULT
Status: BLOCKED for full financial production acceptance; private review implementation verified.
Files changed: focal files listed above, tests, audit/evidence, generated bundle/cache identifiers and derived architecture index.
Source-of-truth verdict: PASS for private imported review; full financial cutover not performed.
Invariant verdict: exact original Folio; immutable source/history; no double yield or withdrawal posting.
Build: see delivery evidence.
Tests: live rollback and isolated browser PASS within explicit scope.
Security: server permissions and helper grants verified; no frontend credentials.
Legacy impact: no Google/formula/script writes; member reader unchanged.
Unexpected files changed: unrelated workspace changes preserved; delivery stages only declared files.
Known limitations: numbered list and test matrix above.
Evidence: this directory, audit, SQL/recovery, test scripts and delivery record.
```
