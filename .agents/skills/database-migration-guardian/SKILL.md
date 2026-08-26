---
name: database-migration-guardian
description: Revisar cualquier propuesta o ejecución futura de migración, schema, SQL, tabla, view, function, trigger, constraint, índice o movimiento de datos de Sutiapp, incluido Supabase. Usar antes de generar o aplicar migraciones y bloquear sin autoridad, integridad o recuperación demostrables.
---

# Database Migration Guardian

Leer `AGENTS.md`, `docs/MIGRATION_RULES.md`, `docs/SOURCE_OF_TRUTH.md` e `docs/INVARIANTS.md`. Ejecutar primero `source-of-truth-guardian`.

Comprobar PK, FK, `UNIQUE`, índices, nullability, tipos, defaults, RLS, grants, triggers, functions, views, duplicados, datos históricos, volúmenes, compatibilidad de lectores/escritores, idempotencia, orden de despliegue, backup y rollback/recovery. Verificar que `numero_control` se preserve y que Auth no sea requisito de existencia del usuario.

No aplicar una migración si la tarea solo pide diseño o auditoría. Bloquear cuando falten autoridad resuelta, recuperación, integridad, seguridad o equivalencia legacy.

```text
DATABASE MIGRATION AUDIT
Domain:
Authority before/after:
Schema checks:
RLS/security:
Historical data:
Compatibility:
Backup/recovery:
Tests/reconciliation:
Verdict: PASS | BLOCKED | DECISION REQUIRED
Evidence:
```
