# BANKING HISTORICAL SEED RESULT

Fecha: 2026-08-25  
Estado: `PASS`

```text
Rows with banking evidence: 513
Imported exact/partial safe records: 504
Skipped ambiguous: 8
Skipped unrecoverable: 1
CLABE reconstructed: 0
Account numbers reconstructed: 0
Heuristic matches: 0
Existing current records overwritten: 0
User self-management: PASS
Multiple accounts: PASS
Supabase authority: PASS
RLS: PASS
Cross-user isolation: PASS
Banking data masking: PASS
Incomplete-data UX: PASS
Audit: PASS
Excel runtime authority: 0
Final verdict: PASS
```

## Evidencia

- Fuente fijada: `Usuarios SUTIAPP.xlsx`, hoja `Usuarios`, SHA-256 `36E61B82F1BAB496B08E70BF3E1A14911A7A4E612EC3DE9F8A0669B8F2011CD3`.
- Match: 505 exactos/únicos por `numero_control`; 8 ambiguos; 0 por nombre, email o similitud.
- Apply: migración `20260825000200_user_maintained_historical_banking.sql`; 504 inserts, 0 updates/conflicts/overwrites.
- Los 504 registros históricos quedan incompletos porque `account_holder` no se inventó; 499 además tienen al menos otro campo pendiente. Los valores con pérdida de precisión no se almacenaron.
- Supabase reconciliado en 504 filas históricas, 504 con procedencia válida, 0 titulares reconstruidos.
- Suite estática: 38/38 PASS. Live: ADD/EDIT/DELETE/SET PRIMARY, dos cuentas, notación científica denegada, A/B/Anonymous/Admin, auditoría y cleanup PASS.
- Chrome real, afiliado no Admin: una sola cuenta propia, estado incompleto, lista enmascarada, entrada a edición y cero error técnico PASS.
- Google financiero y Apps Script: `NO READ / NO WRITE / NO CHANGE`.
