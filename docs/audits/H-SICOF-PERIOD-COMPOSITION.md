# H-SICOF-PERIOD-COMPOSITION — alcance local

PRE-CHANGE AUDIT — 2026-10-03

Status: PASS para preparar y verificar un candidato local; no aplicación productiva.

Objetivo: atribuir los movimientos canónicos de Ahorro a su periodo de origen sin crear otra autoridad de saldo. El informe SICOF y la proyección propia compartirán el mismo desglose. Las retiradas conservan sus escritores, permisos, verificación de préstamos y auditoría actuales.

Autoridad: `savings_transactions` y `savings_participant_balance`; las nuevas atribuciones son metadata administrativa explícita de movimientos existentes. El Excel 2025 no acredita dinero ni prueba por sí solo el importe histórico aún disponible. Aportaciones fechadas y asignaciones de rendimiento conservan sus periodos comprobables. Aperturas sin evidencia se identifican como OPENING; retiros sin desglose no se reparten por FIFO ni otra política inventada.

Archivos autorizados: este documento; `supabase/migrations/20261003000100_savings_period_composition.sql`; `supabase/recovery/20261003000100_savings_period_composition.sql`; `scripts/test-savings-period-composition.js`; `scripts/fixtures/savings-period-composition-schema.json` (metadata de schema y funciones sin filas de negocio). Evidencia privada temporal de pruebas bajo `.tmp/sicof/`.

Interfaces: nuevo lector Admin con `savings.read`; escritores de clasificación con `savings.approve`, versión e idempotencia. Wrapper aditivo de `admin_save_savings_operation` para desglose opcional de SETTLE; wrapper aditivo del lector canónico propio. No se cambian fórmulas de rendimiento, Google, permisos globales, saldos, importes ni estados de solicitudes existentes.

Datos: journal privado, RLS forzada, sin permisos browser, referencias tipadas a transacciones y participantes, historial inmutable y actor/contexto. Sólo una clasificación inicial por movimiento. No DML sobre movimientos anteriores. La disponibilidad por componente sigue descontando las retenciones existentes sin inventar una distribución de holds entre periodos.

Riesgo: financiero, concurrencia e integración del cierre. La entrega y su atribución deben ser atómicas. Las llamadas previas siguen válidas; su ausencia de desglose queda visible. La identidad usa Folio exacto y afiliado resuelto. Cualquier dato no canónico o saldo incompatible falla explícitamente.

Pruebas: PostgreSQL aislado con schema/funciones reales y fixtures sintéticos, derechos API, clasificación de apertura sin dinero nuevo, aportaciones por fecha, capital/rendimiento separados, retiros multiorigen, exceso/falta de desglose, versión obsoleta, retry, contexto, historial 2025 y reader propio preservados, recovery y deriva. No fixtures en producción.

Recovery: restaurar definiciones exactas sólo ante wrappers sin deriva, revocar writers nuevos y retener journal; nunca eliminar historia financiera. La migración conserva backups privados de definiciones y ACL.

## Ampliación declarada — workspace SICOF

Por delegación de la H principal se añade el backend de lectura de SICOF y persistencia privada de escenarios de simulación, preferencias de presentación y evidencia Excel histórica. Archivos adicionales: `supabase/migrations/20261003000200_sicof_workspace.sql`, su recovery, `scripts/test-sicof-workspace.js` y `scripts/fixtures/sicof-workspace-schema.json` sin datos productivos. Se registra sólo el módulo `sicof` en el catálogo vigente con savings.read/reports/config; no se asignan personas ni se crean roles paralelos. El contexto reutiliza participantes, ledger, historia canónica/aceptada y periodos existentes. Las simulaciones no acreditan rendimiento ni liquidan retiros. Guardado calculado sólo service backend con sesión/actor revalidados; preferencias no cambian políticas financieras. La lectura de comportamiento desde Finanzas autoriza únicamente identidad exacta de solicitantes visibles, nunca saldos de ahorro. La plantilla Excel permanece privada y sólo se devuelve para exportación autorizada. Recovery revoca capacidades nuevas y conserva escenarios, preferencias e historia.

## Verificación local completada

El cierre incorpora guardas anteriores a toda captura/escritura de instalación. Se verifican los hashes exactos de definiciones auditadas, ACL y owner por nombre de los dos wrappers originales (001) y de module_visible y los dos helpers públicos de autorización (002). La evidencia se capturó en lectura el 2026-10-03; los OIDs sólo se comparan antes/después dentro de la misma base de prueba. Se añaden pruebas que alteran definición, ACL y owner y demuestran aborto previo a crear schema o catálogo. Los fixtures contienen cuerpos reales sin datos de negocio; las dependencias privadas de autorización siguen aisladas.

Reapertura focal por revisión independiente: se corrige la detección de débitos sin origen para que un crédito no identificado no compense su incertidumbre. El contexto SICOF conserva además `enrollment_id` en los movimientos para demostrar que un ajuste corresponde a la misma aportación/inscripción. Alcance: migrations 001/002 y sus tests ya declarados; sin nuevos writers, tablas ni operaciones productivas. La prueba de integración pasa el DTO SQL al proyector real de exportación.

La misma revisión amplía el lector interno de orígenes para seguir vínculos de reversión: una reversión completa conserva exactamente todos los orígenes; una parcial sólo asigna automáticamente cuando existe un único origen comprobado. Una parcial multiorigen queda incierta, sin distribución proporcional inventada. Se comprueban componente, participante, dirección, fechas, ciclos y exceso de reversión. Un ajuste fechado exige la aportación original de la misma inscripción. Este cambio añade únicamente un helper privado dentro de la migración 001, sin writer nuevo ni mutación de historial.

La migración 001 captura y envuelve las definiciones productivas sin cambiar sus OIDs, owners ni ACL. La entrega conserva la comprobación real de préstamos y el writer financiero anterior; la atribución añadida falla o confirma en la misma transacción. Una llamada anterior sin desglose sigue válida y deja la incertidumbre explícita. La RPC posterior clasifica ese débito sin volver a retirarlo. Una clasificación histórica tampoco puede consumir dinero recibido después del pago. Un corte anterior a la apertura comprobada devuelve saldo histórico desconocido, nunca cero supuesto.

Los orígenes comprobados se derivan del ledger por fecha de aportación y de la asignación de rendimiento. El periodo 2025 puede conservar año sin semestre; el saldo OPENING no recibe un año por inferencia. La clasificación de una apertura debe abarcar todo el movimiento con evidencia; su metadata queda inmutable y una apertura usada por un retiro no se reinterpreta después. Esta implementación no incluye edición/reclasificación de atribuciones previas: una corrección requiere diseño posterior que conserve su historia.

La migración 002 agrega sólo el tuple de SICOF al mapping privado `module_visible`, conservando íntegra la definición restante y su seguridad. La función exacta inspeccionada el 2026-10-03 está en el fixture sin filas de negocio. El contexto diferencia evidencia incompleta de exclusiones de la política vigente. El Excel sólo se guarda como evidencia histórica privada, con plantilla y SHA-256; no modifica el ledger ni regulariza una apertura. Guardar un escenario es exclusivamente una simulación backend.

Comandos ejecutados:

- `node scripts/test-savings-period-composition.js`: PASS, 17 grupos de pruebas PostgreSQL aisladas; incluye instalación ante deriva de definición/ACL/owner, guard de préstamo atrasado sin bypass, retiros mixtos, retry, rollback, holds, asignación YIELD, corte sin evidencia, historia propia intacta, reversiones completas/parciales, incertidumbre no compensable y recovery ante deriva.
- `node scripts/test-sicof-workspace.js`: PASS, 10 grupos de pruebas PostgreSQL aisladas; incluye instalación ante deriva de los tres contratos de permisos, módulo/roles, servicio y sesión, fingerprint, archivo durable, preferencias, lectura financiera sólo de solicitantes autorizados, evidencia histórica/políticas, DTO SQL con enrollment_id al proyector real del reporte, plantilla privada y recovery ante deriva.
- `node --check scripts/test-savings-period-composition.js` y `node --check scripts/test-sicof-workspace.js`: PASS.
- `git diff --check` focal: sin errores. Los archivos de esta H son nuevos; no se tocaron archivos previos fuera del alcance delegado.

Las pruebas utilizan schema y cuerpos reales capturados y filas sintéticas. Auth y las dependencias privadas de permisos son contratos aislados; los wrappers públicos has_admin_permission/admin_module_boundary y module_visible son las definiciones exactas verificadas. La prueba de source-review aporta un flag simulado al lector financiero existente, mientras el lector de historia de ahorro es el real. Estas pruebas no acreditan un deployment ni sustituyen la matriz global de permisos/impersonación de la H principal.

```text
H-SICOF-PERIOD-COMPOSITION RESULT
Status: PASS — candidato backend local y pruebas aisladas; no aplicado.
Files changed: dos migrations, dos recoveries, dos scripts, dos fixtures de schema y esta auditoría.
Source-of-truth verdict: ledger canónico único; atribuciones y simulaciones no crean dinero.
Invariant verdict: identidad, componentes, idempotencia, historia y writers anteriores preservados en aislado.
Build: NOT APPLICABLE — cambios SQL y scripts; ambas migrations compiladas en PostgreSQL aislado.
Tests: 17 grupos origen + 10 grupos workspace PASS; sintaxis JS PASS.
Security: schemas privados con RLS forzada y sin grants directos; permisos backend y service/session verificados en aislado.
Legacy impact: READ ONLY; ninguna lectura o escritura Google ejecutada por este subtrabajo.
Unexpected files changed: Ninguno por este subtrabajo.
Known limitations: no deployment/import; no corrección de atribuciones ya selladas; UI/build/regresión global y revisión independiente pertenecen al cierre principal.
Evidence: scripts de prueba y fixtures reproducibles, migrations/recovery y comandos anteriores.
```
