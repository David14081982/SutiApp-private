---
name: legacy-google-guardian
description: Detectar y clasificar trabajo de Sutiapp relacionado con Google Sheets, Apps Script, Ahorro, Préstamos, fórmulas, triggers, amortización, saldos, cálculos financieros o conciliaciones. Usar incluso para lecturas; bloquear modificaciones financieras o legacy sin auditoría y equivalencia autorizadas.
---

# Legacy Google Guardian

Leer `AGENTS.md`, `docs/LEGACY_GOOGLE_SYSTEMS.md`, `docs/SOURCE_OF_TRUTH.md` e `docs/INVARIANTS.md`.

Inventariar sistema, hoja/rango, Apps Script, trigger, fórmula, cálculo, propietario, lectores, escritores, frecuencia, IDs, efectos administrativos, conciliación, errores y recuperación. No asumir hoja=tabla ni calculado=maestro. No modificar el sistema externo salvo autorización expresa.

Clasificar `READ ONLY`, `SAFE CHANGE`, `REQUIRES AUDIT` o `BLOCKED`. `SAFE CHANGE` exige equivalencia demostrada, alcance autorizado, recuperación y tests. Impacto financiero no demostrado: `BLOCKED — DECISIÓN REQUERIDA`.

```text
LEGACY GOOGLE AUDIT
Systems/domains:
Reads:
Writes:
Calculations/triggers:
Authority:
Equivalence:
Recovery:
Classification:
Decision:
Evidence:
```
