# SutiApp Financial Handoff

Proyecto Apps Script ligado exclusivamente a `SutiApp Final`. Tras aprobación Admin backend, reserva idempotencia en `SutiApp Financial Handoff` y agrega exactamente una fila verificada en `Historial de solicitudes`. También expone el writer independiente y ultralimitado de `Criterios de fondos!P` (`VISIBILIDAD SUTIAPP`): valida identidad/fingerprint y nunca acepta hoja, rango o columna desde el cliente.

Configuración cloud obligatoria, nunca versionada:

- Script Property `FINANCIAL_HANDOFF_SECRET`.
- Web App ejecutada por el propietario del workbook.
- URL del deployment en el secret Supabase `FINANCIAL_LEGACY_API_URL`.
- El mismo valor secreto en Supabase `FINANCIAL_LEGACY_API_TOKEN`.

Los contratos read-only `overview/quote` usan nombres separados `FINANCIAL_LEGACY_READ_API_URL/TOKEN`; no deben apuntarse a este receptor de handoff.

No crear triggers. No ejecutar amortización, pagos o estados posteriores. Los únicos writes permitidos son el append confirmado en `Historial de solicitudes` y, por decisión expresa del propietario, el encabezado/valor de `Criterios de fondos!P`. A:O —incluida M— permanecen inmutables. El registry técnico solo conserva UUID/hash/fila/estado para recuperación.
