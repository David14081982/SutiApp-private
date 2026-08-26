# BANKING HISTORICAL SEED DRY RUN

Fecha: 2026-08-25  
Estado: `SUPERSEDED BY OWNER PARTIAL-FIELD DECISION / APPLIED`  
Writes: `0`

## Autoridades resueltas

- Fuente histórica: `C:\Users\david\Downloads\Usuarios SUTIAPP.xlsx`, exclusivamente `SEED ONLY`.
- Hoja: `Usuarios`.
- Autoridad productiva posterior: Supabase `public.affiliate_bank_accounts`.
- Matching: `numero_control` exacto y único → `public.affiliates`.
- Prohibido: nombre, similitud, email, reconstrucción de notación científica o overwrite de datos actuales.

## Columnas demostradas

| Columna física | Encabezado exacto |
|---:|---|
| 1 / A | `Número de control` |
| 126 / DV | `Clabe interbancaria` |
| 127 / DW | `Número de cuenta bancario` |
| 128 / DX | `Banco` |

El workbook contiene 187 columnas y 947 filas de datos. Su SHA-256 actual es `36E61B82F1BAB496B08E70BF3E1A14911A7A4E612EC3DE9F8A0669B8F2011CD3`; no coincide con el snapshot H-003 certificado `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591`. El dry run fija y reporta la diferencia; no la oculta ni modifica el archivo.

## Resultado obligatorio

```text
BANKING HISTORICAL SEED DRY RUN

Rows scanned:
947

Rows with banking data:
513

Exact affiliate matches:
505

Ambiguous:
8

No match:
0

Duplicate banking rows:
0

Affiliates with multiple historical accounts:
3

Existing Supabase banking records:
0

Potential inserts under final field-level rule:
504

Potential updates:
0

Conflicts:
0

Writes:
0
```

## Desglose de la fuente

- Filas con CLABE: 477.
- Filas con número de cuenta: 435.
- Filas con banco: 512.
- Filas con los tres campos: 403.
- Filas con notación científica en CLABE o cuenta: 416.
- Filas donde todos los campos presentes conservan formato estricto compatible: 9; el corte inicial de fila completa producía 8 candidatos.
- La decisión posterior del propietario autorizó conservar cada campo demostrable de forma independiente: 504 matches exactos contienen al menos un campo seguro, 499 quedan `INCOMPLETE_HISTORICAL_DATA` y 1 match exacto no contiene ningún campo recuperable.
- Grupos de filas exactamente duplicadas, incluyendo control y los tres valores: 0.
- Existen 50 credenciales bancarias repetidas en 206 filas de controles distintos. No se clasifican automáticamente como duplicado ni se fusionan: podrían ser datos compartidos reales o degradación histórica.
- Los 3 controles con más de una cuenta histórica pertenecen a grupos de `numero_control` duplicado y quedan `AMBIGUOUS`.

La notación científica se conserva como evidencia textual. Eliminar `E+…`, completar ceros o recuperar dígitos sería heurístico y está prohibido.

## Matching y conflicto

El cruce se realizó en memoria con valores TEXT exactos. El digest SHA-256 de las 505 correspondencias `(ordinal, numero_control, affiliate_id)` es:

`3A389141AF0FCF28E112376F95F34935FE8AF2FD956D93BCF619C2EA21043E79`

El digest de los 8 candidatos `(ordinal, numero_control)` es:

`52E3E59D8B229A17D5695FE4D9D8D6FF88454D35BAF7DCE3A4F4EF15CB0AD6D4`

No se publican CLABE, cuenta, UUID o número de control completos en el reporte. El script demuestra el matching exacto y emite únicamente muestras enmascaradas.

Como Supabase contiene 0 cuentas bancarias, en este corte `EXISTING_CURRENT_DATA=0`, `NO OP=0`, `CONFLICT=0` y `Potential updates=0`. El algoritmo ya clasifica esas ramas y nunca actualiza.

## Cierre del gate

El propietario autorizó después el seed parcial seguro. Se fijó el hash actual, `account_holder` histórico permanece NULL, cada campo corrupto se omite y se marca pendiente, y el apply se documenta en `BANKING_HISTORICAL_SEED_RESULT.md`.

Google financiero y Apps Script: `NO READ / NO WRITE / NO CHANGE`.
