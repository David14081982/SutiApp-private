---
name: pre-change-audit
description: Declarar el alcance verificable antes de modificar cualquier H, código, configuración, documentación o datos de Sutiapp. Usar al inicio de una implementación y actualizar si aparece un archivo, sistema, dato o riesgo no declarado.
---

# Pre-change Audit

Leer `AGENTS.md` y la documentación enlazada que afecte la H. Inspeccionar antes de editar; no inferir autoridad.

```text
PRE-CHANGE AUDIT
H:
Objetivo:
Alcance:
Fuera de alcance:
Archivos a tocar:
Datos afectados:
Fuentes de verdad:
Tablas:
APIs:
Legacy involucrado:
Invariantes:
Riesgo:
Tests:
Recovery:
Status: PASS | BLOCKED | DECISION REQUIRED
```

Bloquear si el objetivo exige tocar legacy no autorizado, si falta una decisión material o si dos fuentes compiten. Antes de tocar un archivo no listado, detener la edición, explicar el motivo y emitir una auditoría actualizada. Mantener el alcance mínimo.
