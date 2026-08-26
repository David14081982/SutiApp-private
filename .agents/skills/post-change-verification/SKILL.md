---
name: post-change-verification
description: Cerrar cada H de Sutiapp con evidencia después de cualquier cambio. Usar para verificar build, tests, invariantes, fuentes de verdad, mocks, fallbacks, legacy, seguridad, archivos imprevistos y regresiones; no aceptar afirmaciones sin comando, diff o inspección verificable.
---

# Post-change Verification

Leer `AGENTS.md`, el pre-change audit y los documentos/guardians aplicables. Comparar alcance declarado contra archivos realmente cambiados. Ejecutar verificaciones disponibles y marcar explícitamente lo no comprobable.

Comprobar build, tests, auditorías estáticas, invariantes, autoridad, lectores/escritores, mocks, fallbacks, caches, borrado, legacy, seguridad, secretos, recuperación, regresiones y archivos inesperados. `funciona` no es evidencia. No convertir `NOT APPLICABLE` en `PASS`.

```text
H-XXX RESULT
Status: PASS | FAIL | BLOCKED | DECISION REQUIRED
Files changed:
Source-of-truth verdict:
Invariant verdict:
Build:
Tests:
Security:
Legacy impact:
Unexpected files changed:
Known limitations:
Evidence:
```

Emitir `PASS` solo si todas las verificaciones requeridas pasan o están justificadamente `NOT APPLICABLE`. Cualquier regresión, archivo imprevisto o conflicto produce `FAIL` o `BLOCKED`.
