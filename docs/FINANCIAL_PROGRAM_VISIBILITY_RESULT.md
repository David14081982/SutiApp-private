# SutiApp financial program visibility result

Fecha: 2026-08-24  
H: `H-FINANCIAL-VISIBILITY-001`

## Resultado

Estado global: `PASS`.

La identidad técnica dedicada `soporte.sutiapp@gmail.com` autorizó exclusivamente `drive.file` mediante Google Picker sobre el workbook exacto `SutiApp Final` (`1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80`). El OAuth client pertenece al proyecto aislado `expanded-talon-506522-r7`. Client secret y refresh token existen únicamente como Supabase Edge Secrets; no aparecen en frontend, repositorio ni logs.

La ruta productiva es Admin JWT → permiso `financial_criteria.visibility.write` → Edge `financial-criteria-admin` → Google Sheets API. La Edge fija internamente workbook, pestaña y columna P; el navegador sólo envía identidad de criterio, modo y motivo. Antes de escribir valida el fingerprint autoritativo de A:O, protege fórmulas, captura A:O, escribe una celda P, hace read-back y revierte P si A:O cambia. No existe un override paralelo en Supabase.

## Autoridad e integridad

- Autoridad del modo: `Criterios de fondos!P`, encabezado exacto `VISIBILIDAD SUTIAPP`.
- Modos: vacío/`AUTO`, `MOSTRAR`, `OCULTAR`.
- A:O, incluida M `MOSTRAR PROGRAMA`: intactas.
- Supabase conserva autorización y auditoría, no el modo.
- `financial-legacy` mantiene A:O y los cálculos en la ruta Google legacy; obtiene P por Sheets API para lectura inmediata y falla cerrado si falta autenticación o encabezado.
- La identidad técnica no tiene acceso general a Drive: `drive.file` quedó ligado al workbook seleccionado con Picker.

## Evidencia ejecutada

- Política estática: `PASS` — Hermosillo, cruces de año, AUTO/MOSTRAR/OCULTAR, sin fechas productivas hardcodeadas.
- Catálogo live: `PASS` — 146 criterios; 57 disponibles, 42 programados y 47 ocultos.
- Seguridad live: `PASS` — usuario ordinario y anónimo denegados; fingerprint inválido denegado con 409; cero escrituras en la suite negativa.
- Inicialización P: `PASS` — P1=`VISIBILIDAD SUTIAPP`, idempotente; M intacta; ninguna otra columna inicializada.
- Prueba reversible productiva: `PASS` — criterio fila 104, `15/03/2027 — Bono anual`, secuencia `AUTO → MOSTRAR → OCULTAR → AUTO`; tres operaciones y tres auditorías `CONFIRMED`; A:O modificadas=0; M modificada=false; estado final `SCHEDULED` y modo final `AUTO`.
- Browser UI: `PASS` — Chrome real mostró 146 criterios, 146 controles, permisos read/write, tres modos y motivo obligatorio; cero escrituras. Evidencia: `screenshots/sutiapp-admin-funds-visibility.png`.
- Edge deployments: `financial-criteria-admin` v6 y `financial-legacy` v15, ambas `ACTIVE` y `verify_jwt=true`.
- Escaneo de secretos frontend/repo: `PASS` — cero refresh tokens, access tokens, private keys o API keys persistidas; el OAuth JSON descargado y la API key temporal de Picker fueron eliminados.

## Recuperación

La migración conserva auditoría y su recovery revoca permisos sin borrar historia. Existen respaldos pre-cambio de ambas Edge Functions. Revocar el permiso y restaurar las funciones desactiva el writer; P puede ignorarse sin tocar A:O.
