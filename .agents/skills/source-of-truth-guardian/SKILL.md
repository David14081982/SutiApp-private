---
name: source-of-truth-guardian
description: Auditar cualquier cambio de Sutiapp que lea, escriba, copie, cachee, derive, elimine o migre datos. Usar ante stores, APIs, repositorios, localStorage, JSON, mocks, fallbacks, seeds, cachés o cambios a SOURCE_OF_TRUTH.md; bloquear autoridades múltiples o desconocidas.
---

# Source of Truth Guardian

Leer `AGENTS.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/INVARIANTS.md` y `docs/DATA_GOVERNANCE.md` antes de analizar.

1. Nombrar el dominio con precisión; no usar “datos” como dominio.
2. Identificar autoridad declarada, lectores y escritores con archivo/sistema concreto.
3. Buscar mocks, seeds, `DATA`, JSON, hardcode, `localStorage`, `sessionStorage`, IndexedDB, cachés, snapshots y fuentes legacy.
4. Trazar fallos, borrado e invalidación. Verificar que ninguna alternativa resucite un dato.
5. Distinguir autoridad, derivado, caché, mock y fixture.
6. Marcar `UNRESOLVED` si falta evidencia y `SOURCE OF TRUTH CONFLICT` si compiten fuentes. No elegir una.
7. Emitir `SAFE` solo con una autoridad, escritores controlados y alternativas no autoritativas. En otro caso, `BLOCKED`.

```text
SOURCE OF TRUTH AUDIT
Domain:
Authority:
Readers:
Writers:
Alternative sources:
Fallbacks:
Caches:
Conflicts:
Verdict: SAFE | BLOCKED
Evidence:
```
