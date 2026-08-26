# Gobierno de datos

## Clasificaciones

- **Fuente autoritativa:** sistema oficialmente autorizado para decidir el valor vigente de un dominio.
- **Fuente derivada:** transformación reproducible de una autoridad; no decide el dato maestro.
- **Caché:** copia temporal con origen, caducidad e invalidación explícitos. `cache != fuente de verdad`.
- **Mock:** dato ficticio para desarrollo, preview o QA aislado.
- **Fixture:** conjunto estable para pruebas reproducibles.
- **Legacy:** sistema productivo existente que conserva obligaciones y compatibilidad.
- **View:** consulta derivada sin autoridad de escritura propia.
- **Dato calculado:** resultado de reglas/fórmulas reproducible desde entradas autorizadas. `dato derivado != fuente de verdad`.
- **Dato histórico:** registro cuyo contexto temporal y trazabilidad deben preservarse.

## Copias permitidas

Una copia requiere propósito, origen, entorno, propietario, lectores, caducidad/invalidación, prohibición de escritura maestra y conducta ante error documentados. Mocks y fixtures deben estar separados del camino productivo.

Una copia se convierte en segunda fuente de verdad cuando puede aceptar escrituras independientes, sobrevivir a la eliminación en la autoridad, ser elegida por fallback, o no puede reconciliarse determinísticamente con su origen. En ese caso: `SOURCE OF TRUTH CONFLICT`.

## Borrado

Eliminar en la autoridad obliga a invalidar copias. Está prohibido reconstruir el dato desde `localStorage`, CacheStorage, `DATA`, mock, fixture, JSON o legacy no autorizado. Los borrados históricos requieren decisión, auditoría y recuperación; no se usan como reparación rápida.

## Errores

Ante fallo de autoridad: estado de carga, error controlado, reintento seguro u offline explícito. Mostrar `ERROR DE FUENTE AUTORITATIVA` es preferible a información falsa. Un respaldo solo puede operar si está diseñado, autorizado y etiquetado semánticamente; nunca mediante fallback silencioso.

## Cambio de datos

Toda H declara dominio, autoridad, lectores, escritores, copias, cachés, datos derivados, retención, borrado, recuperación e invariantes. Si algo es desconocido, usar `UNRESOLVED`; si compiten fuentes, usar `SOURCE OF TRUTH CONFLICT`.

## Nómina declarada para simulación

`affiliate_payroll_declarations` es una autoridad de declaración del usuario, no una copia de nómina oficial ni de un talón. Conserva el valor vigente y una auditoría de cambios; no tiene fallback ni caché persistente. El afiliado puede actualizar su declaración, pero la eliminación no está expuesta en UI y cualquier recuperación destructiva exige preservar filas existentes. Las proyecciones de neto, remanente, barras y 30% son derivados informativos y nunca datos maestros financieros.

## Snapshot financiero personalizado de sesión

`financial_session_snapshots` es la excepción temporal autorizada por ADR-043/064. Origen: Google `Criterios de fondos` después de aplicar el perfil autoritativo Supabase y `loan_term_policy`. Propietario/escritor: Edge `financial-legacy` con service role. Lectores: Edge service-only y, únicamente para una cotización interactiva propia, la función `SECURITY DEFINER` autenticada que valida el contexto completo antes de leer internamente; el browser conserva cero acceso directo. Retención lógica: máximo 15 minutos; `expires_at` vencido siempre es inválido aunque cleanup aún no borre la fila.

No admite escrituras independientes, catálogo global, fallback, uso cruzado ni PII innecesaria. Cambiar perfil, versión, actor, afiliado, impersonación, política o contrato invalida. El fingerprint de fuente incluye todos los campos Google que afectan elegibilidad y visibilidad. La solicitud confirmada conserva una evidencia contractual separada e inmutable; por ello el caché puede eliminarse sin afectar historia.
