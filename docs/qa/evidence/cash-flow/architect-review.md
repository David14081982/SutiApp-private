# ARCHITECT REVIEW

Task reviewed: H-FLUJO-EFECTIVO-AHORRO-CAJA-001.

Verdict: **APPROVED** — implementación, backend productivo y candidato preparados para la publicación frontend ya autorizada. El frontend productivo todavía no está publicado en este corte de revisión.

## Scope and evidence

Revisión dirigida al nuevo lector, su RPC, vista y tres integraciones directas. La restricción expresa del propietario excluye auditoría general, investigación histórica repetida y suites globales. No se revisan ni modifican funcionalidades ajenas. No se autoriza continuación automática por una cola u orquestador no verificado.

Fuentes inspeccionadas: `cash-flow.mjs`, `cash-flow-google.mjs`, acción CASH_FLOW en `reports-jc/index.ts`, migración y recovery `20261030000100_reports_jc_cash_flow.sql`, `cash-flow-report.jsx`, integración en `reports-jc-admin.jsx` y `reports-jc-repository.js`, preparación del candidato y pruebas focales. Se contrastó la UI contra el baseline productivo privado; el diff global del workspace incluye trabajo previo y no es el paquete autorizado para publicar.

## What Codex did correctly

- Mantiene Supabase canónico como autoridad de Ahorro y Google HISTORIAL P V2 como autoridad de préstamos. No añade captura, caché persistente, fallback financiero ni escrituras sobre sus fuentes.
- Usa C/D para contrato y C/D/S para cuota. Filtra Caja de Ahorro, protege identidades/cuotas ambiguas, cuenta J una vez y exige fecha AE verificable para colocación mensual. No sustituye AE por aprobación o primera cuota.
- Aplica A/B con calendario Hermosillo; una corrección de B sustituye su importe. La programación futura no se contabiliza como recuperación. No interpreta Z/AB/AC/AD legacy como desglose recuperado.
- Conserva por separado retiros, aportaciones, rendimientos, ajustes, saldos y obligaciones. Históricos mixtos o insuficientes permanecen identificados, sin fabricar desgloses ni convertir desconocidos en cero.
- Deduplica recibos e historia canónica, conserva correcciones netas y evita sumar apertura/regularización como aportación o rendimiento nuevo.
- Presenta 17 conceptos y 12 meses, detalle de procedencia, subtotales parciales y registros sin distribución mensual. Conserva los ocho reportes y controles existentes.

## Important findings

La revisión focal del saldo actual detectó que 35 inscripciones futuras con ledger vacío y saldo canónico cero se clasificaban indebidamente como desconocidas. Se corrigió únicamente el lector nuevo: el mes vigente usa `savings_participant_balance`, la misma autoridad del panel. Los límites históricos y los saldos futuros desconocidos se conservan. La corrección pasó sus dos verificaciones focales y la comparación real de 384 cuentas, sin cambios de datos.

El cálculo de capital/intereses/administración recuperados y capital pendiente sigue explícitamente sin determinar donde las fuentes no acreditan el desglose. Esta limitación es compatible con el alcance autorizado: no se activó el motor PV2 pendiente ni se inventaron tarifas o distribuciones.

## Problems detected

No queda un defecto técnico demostrado en el candidato revisado. El bloqueo anterior HTTP 401 de Supabase Management se resolvió. Se instaló exclusivamente la migración aditiva, con el hash aprobado, y se desplegó reports-jc v3 con JWT activo. La consulta HTTP administrativa real devuelve los 17 conceptos y doce meses; LOAD y TEMPLATE originales siguen operativos. El navegador del candidato consulta esas fuentes productivas sin mocks financieros y coincide con ellas. Sigue pendiente publicar y verificar el frontend público; no confundir la prueba del candidato con la disponibilidad pública.

## Architecture implications

Verificación independiente del bundle: 173 módulos originales, 174 en el candidato; únicamente cambian `reports-jc-repository.js` y `reports-jc-admin.jsx`, se incorpora `cash-flow-report.jsx` y los otros **171 módulos permanecen idénticos byte por byte**. El builder del candidato conserva la lista productiva y sólo añade la vista nueva. No utilizar el builder del workspace sucio para publicar.

SHA-256 del bundle candidato: `2e20294dbafa3ab16cc74183ac6a7dd71df6e67462e81e52097297a290bccf7b`.

## Source-of-truth implications

Autoridades preservadas. El reporte es una proyección transitoria de consulta, con procedencia y limitaciones visibles. Los importes válidos de Ahorro no se someten a una nueva autorización del propietario.

## Security implications

RPC aditiva STABLE, SECURITY DEFINER, search_path vacío, guard existente de Reportes JC y EXECUTE restringido a authenticated. Edge comprueba identidad y contexto antes y después de consultar; la cuenta Google y su alcance spreadsheets.readonly son los existentes. Sin secretos frontend, nuevos roles, alteraciones RLS o escrituras de ledger. HTTP productivo: Admin 200; ausencia de autorización, sesión inválida y RPC anónimo 401; esquemas inválidos 400. Usuario ordinario productivo: NOT TESTED por ausencia de credenciales existentes explícitas; su denegación se comprobó aisladamente contra el guard existente. No se crearon identidades ni se alteraron permisos para probar.

## Data implications

Consulta real focal: 20,106 filas PV2, 499 contratos Caja de Ahorro identificados. El mes actual de Ahorro coincide con la autoridad canónica; los once meses futuros no se presentan como saldo acumulado. Filas fuente privadas no se publican en evidencia. No hubo DML financiero, cambio de fórmulas, Apps Script, activadores ni motor de amortizaciones.

## Verification references

- `scripts/test-cash-flow-core.mjs`: 29 PASS, fixtures sintéticos y fetch simulado; ejecución presenciada durante esta H.
- `scripts/test-cash-flow-savings-sql.js`: ocho comprobaciones iniciales documentadas en la auditoría; sólo se repitieron los casos afectados por correcciones.
- [Corrección focal del saldo vigente](current-balance-focused.json): dos comprobaciones PASS y hash de la migración final `ed4ac5d61c3f9da08357e487d597430331b25e10509c4dd5d3f604655eca9a04`.
- [Consulta real previa al despliegue](live-current-balance-readonly.json): PASS, saldo actual conocido y coincidente con la autoridad, cero escrituras.
- [Navegador](browser.json) y [etiquetas finales](browser-labels.json): PASS, incluyendo preservación de controles, teclado, móvil, contexto y errores visibles.
- [Candidato aislado](release-candidate.json): PASS, build Pages y guard de permisos, módulos ajenos preservados, `deployed:false`.
- [Migración instalada](database-deployed.json) y [Edge desplegado](edge-deployed.json): PASS, mismo hash de SQL revisado, versión 3, JWT activo, cero escrituras financieras.
- [Preservación backend](backend-preservation.json): cinco dependencias directas originales sin cambios; permisos y volatilidad de la nueva RPC verificados.
- [HTTP productivo](production-http.json): PASS en ambos horizontes, control de actor, saldo actual, denegaciones indicadas, LOAD y TEMPLATE originales.
- [Navegador del candidato con fuentes productivas](browser-live-candidate.json): PASS, hash del bundle revisado, 17 × 12, ocho reportes conservados, igualdad con fuente real, sin mocks financieros, errores de página ni escrituras.
- [Bloqueo anterior](publication-blocked.json): evidencia histórica del impedimento ya resuelto, no describe el estado vigente.

Owner decision required: **NO**. La autorización de publicación sigue vigente y el acceso técnico fue restaurado.

Recommended next action: publicar únicamente el candidato aislado, verificar en Pages su hash y la consulta autenticada real, registrar evidencia final y detenerse. No repetir investigación histórica, pruebas ya aprobadas ni suites globales. Conservar el recovery de la RPC y el backup de los artefactos previos.

# RESPONSE TO CODEX

Aprueba la implementación revisada, el backend productivo verificado y el candidato frontend. Completa únicamente su publicación autorizada y la comprobación focal del sitio público; hasta entonces no declares publicado el frontend. No cambies fórmulas, saldos, Apps Script, activadores, reglas financieras ni otros módulos. Registra la evidencia final y detente, sin avanzar a otra H.

# SUTIAPP ARCHITECT REVIEW

Task: H-FLUJO-EFECTIVO-AHORRO-CAJA-001.

Verdict: **APPROVED** — backend productivo y candidato frontend; publicación frontend pendiente.

Critical findings: bloqueo técnico resuelto; saldo vigente y HTTP productivo verificados. Candidato con fuentes reales PASS; falta únicamente publicación y verificación del sitio público.

Source of truth: PASS. Architecture: PASS focal. Security: PASS en alcance comprobado; usuario ordinario HTTP productivo no probado, denegación aislada PASS. Data: PASS consulta real sin escrituras. Legacy: preservado; motor PV2 no activado.

Owner decision: **NO**.

Next action: completar únicamente publicación frontend y verificación focal autorizadas; registrar evidencia y detenerse.

Response generated for Codex: **YES**.
