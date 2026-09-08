# SutiApp Financial Handoff

Proyecto Apps Script ligado exclusivamente a `SutiApp Final`. ADR-106 añade `sync_request`: después de
confirmar cualquier solicitud en Supabase, reserva idempotencia en `SutiApp Financial Handoff` y registra
su UUID en A de `Historial de solicitudes`. El alta escribe exclusivamente A:AG, con Y=`PENDIENTE`;
aprobación/rechazo/cancelación actualizan sólo Y de esa fila a `APROBADO`/`Rechazado`. AH y siguientes
quedan excluidas por instrucción del propietario. Los encabezados A:AG se validan antes de escribir.
El contrato V1 anterior permanece identificable para recuperación histórica; el nuevo Edge utiliza
`REQUEST_REGISTER_V1`, hash inicial y revisión monotónica. No se convierte un registro V1 histórico
sin UUID en una fila nueva ni se adivina su identidad.

También conserva el writer independiente de `Criterios de fondos!P` (`VISIBILIDAD SUTIAPP`), sin cambios
en esta H: valida identidad/fingerprint y nunca acepta hoja, rango o columna desde el cliente.

Configuración cloud obligatoria, nunca versionada:

- Script Property `FINANCIAL_HANDOFF_SECRET`.
- Web App ejecutada por el propietario del workbook.
- URL del deployment en el secret Supabase `FINANCIAL_LEGACY_API_URL`.
- El mismo valor secreto en Supabase `FINANCIAL_LEGACY_API_TOKEN`.
- OAuth server-side mediante las credenciales `GOOGLE_VISIBILITY_OAUTH_*` existentes; deployment `ANYONE`
  autenticado, `USER_DEPLOYING`. El propietario debe completar la autorización Google del script.
- El worker Supabase sólo entrega filas confirmadas desde su outbox; cron/Vault recupera interrupciones.

Los contratos read-only `overview/quote` usan nombres separados `FINANCIAL_LEGACY_READ_API_URL/TOKEN`; no deben apuntarse a este receptor de handoff.

No crear triggers Apps Script ni ejecutar amortización, pagos o procesos financieros posteriores. Para
`sync_request`, después del alta A:AG sólo Y puede cambiar; el resto de la fila y otras hojas financieras
permanecen intactos. El registry técnico conserva UUID/hash/revisión/fila/estado para recuperación.
