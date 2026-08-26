# Reglas de migración

No ejecutar una migración por intuición. El protocolo obligatorio es:

```text
AUDIT → SOURCE OF TRUTH → DEPENDENCIAS → PLAN → RIESGOS
→ BACKUP/RECOVERY → IMPLEMENTACIÓN → TEST → POST-AUDIT
```

## Gate previo

1. Identificar dominio, autoridad actual/futura, lectores, escritores y propietarios.
2. Inventariar PK, FK, `UNIQUE`, índices, nullability, RLS, triggers, functions y views.
3. Distinguir datos maestros, derivados, calculados e históricos.
4. Medir duplicados, nulos, formatos, volúmenes y compatibilidad.
5. Auditar dependencias de UI, APIs, procesos, Sheets, Apps Script, fórmulas y conciliaciones.
6. Definir backup, rollback o recuperación, reconciliación y criterios de abortar.
7. Diseñar transición sin dos escritores maestros. Cualquier doble escritura requiere decisión explícita y reconciliación demostrable.

## Implementación y cierre

Aplicar cambios pequeños, idempotentes cuando sea posible y observables. Probar permisos/RLS, integridad, reintentos, fallos parciales, reversión y lectores antiguos. La post-auditoría compara conteos, invariantes y autoridad; conserva evidencia.

Sin recuperación verificable, autoridad resuelta o equivalencia legacy: `BLOCKED — DECISIÓN REQUERIDA`.

## 20260825000400 — snapshot financiero personalizado

La migración crea sólo infraestructura derivada vacía, no importa reglas ni modifica históricos. Antes/después conserva conteos de afiliados, solicitudes financieras y documentos. `financial_session_snapshots` exige TTL máximo 15m, RLS forzada, cero grants browser y service-only CRUD. La RPC de confirmación es service-only y el trigger retira el alta escalonada antigua de préstamo.

Recovery: `supabase/recovery/20260825000400_personalized_financial_session_snapshots_recovery.sql` puede retirar tabla/RPC/trigger y restaurar el writer anterior únicamente mientras no exista `financial_submission_snapshot` contractual. Si existe historia confirmada, aborta antes de borrar columna o datos. La prueba de migración y la prueba de creación atómica se ejecutan dentro de transacciones con `ROLLBACK` antes de cualquier activación.
