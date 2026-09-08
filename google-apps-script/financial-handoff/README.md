# SutiApp Financial Handoff

## Contrato vigente de presentación — 2026-09-08

La corrección expresa H-REQUESTS-GOOGLE-REGISTER-FORMAT-001 sustituye la presentación A/J/Y:
A muestra `program_requests.folio` (`SR-2026-000121`); J es fecha nativa `dd/MM/yyyy`, conservando
el día del timestamp original; aprobación escribe `Aprobado`. UUID, ISO, hash inicial y estado
interno `APROBADO` permanecen inmutables. Edge envía `REQUEST_REGISTER_V2` + `request_folio`.
El receptor acepta V1 en tránsito, mantiene folio en el registry existente y localiza por UUID
o folio sin duplicar. La corrección de presentación permite A/J sobre identidad verificada;
transiciones siguen cambiando Y. Igual revisión conserva estados legacy posteriores como Iniciado.
AH+ queda excluido. No cambian cálculos, triggers ni workflows.

## Referencias verificadas — ADR-107, 2026-09-08

GAS15 localiza una fila movida por UUID/folio único y verifica control, fecha y hash inicial antes de
reparar su referencia técnica. Supabase confirma la nueva posición sólo con lease válido de la revisión
vigente; registra procedencia en program_request_google_reference_audit, privada y append-only.
Un registro confirmado ausente falla REQUEST_SYNC_TARGET_MISSING; no se recrea ni usa otra identidad.
Reintentar igual revisión libera el lease sin regresar Y ni cambiar negocio. La reparación puntual
alineó tres localizadores y conservó nueve ausencias como error explícito. AH+ sigue excluido.

## Corte anterior — ADR-106 (presentación sustituida por la instrucción anterior)

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

## Admin request deletion

REQUEST_DELETE_V1 adds delete_request inspect/apply to the same authenticated deployment. Inspect is
read-only and returns private backup/fingerprint to the Edge. Apply clears only matching A:AG, retaining
row positions and AH+. The technical registry tombstone prevents delayed sync/handoff resurrection.
Request deletion completes in Supabase only after verified Google acknowledgement. See ADR-108.
