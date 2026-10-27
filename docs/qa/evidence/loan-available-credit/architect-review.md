# ARCHITECT REVIEW

Task reviewed: H-LOAN-AVAILABLE-CREDIT-001, **candidato local** sobre
`dad2cdfbc3c6bd86806faebd1a6c3f09b503b7ba`, versión frontend `2026102609`.

Verdict: **APPROVED** para el candidato local revisado. No equivale a publicación,
autorización de despliegue ni PASS integral de la H. La activación productiva sigue
BLOCKED por la autorización externa pendiente registrada en la auditoría.

What Codex did correctly:

- Conservó el workspace anterior y preparó el cambio en un checkout de la versión
  publicada. El respaldo previo contiene 4,134 archivos, Git bundle e instrucciones
  de recuperación; la comparación posterior conserva todos los archivos baseline.
  También se verificaron hashes/CRC de fuentes y configuraciones Edge, receptor
  Google, repositorio y artefacto Pages. No hubo escrituras de negocio o Google.
- Reutilizó `projectHistory` y `paidThrough` existentes para calcular cada deuda
  como `max(0, K - paidThrough(A/B, hoy Hermosillo))`. Los cargos incluidos en K
  consumen cupo; B=0 no libera saldo. No cambió el cálculo de Amortización.
- Restó por fondo la deuda acumulada y el principal de solicitudes nativas aún
  no representadas por una amortización identificada exactamente. El reemplazo
  de reserva por deuda evita contabilizar dos veces la misma solicitud.
- Conservó límites por perfil, elegibilidad y flujos existentes. Las excepciones
  individual/global omiten exclusivamente la reducción por deuda/reservas; no
  modifican límites, documentos, aprobación, tasas, plazos ni deudas históricas.
- Protegió cotización autenticada y alta transaccional, además de la interfaz.
  Las pruebas nativas verificaron carreras reales con conexiones independientes.
- Actualizó tarjetas y sumas de Inicio/Finanzas con el mismo saldo del servidor,
  con centavos y estados explícitos para saldo cero o fuente no disponible.
  Conservó las secciones y navegación; agregó el panel administrativo solicitado.

Important findings:

1. Los defectos detectados durante la revisión quedaron corregidos: un estado
   LIQUIDADO no omite una deuda positiva; una solicitud con identidad canónica no
   recurre silenciosamente al nombre del fondo; la representación duplicada de
   una solicitud se rechaza; cuotas de filas distintas con fecha/número iguales
   se suman y sólo se rechaza la duplicación de `source_row`; una amortización con
   saldo cero no bloquea por un nombre histórico de fondo no mapeable.
2. El permiso modular utiliza la acción real `update`, junto con
   `financial_rules.write`. Se contrastó con `has_admin_module` y
   `module_effective_permissions`; el fixture ya rechaza acciones inexistentes.
   SQL y las seis carreras se repitieron después de esta corrección.
3. La fuente es la publicación diaria/manual existente, mediante
   `get_self_loan_history_snapshot`; no se agregó una lectura Google por usuario.
   El UUID/fecha de publicación se revalidan bajo bloqueo. El TTL de quince
   minutos pertenece al cálculo derivado, no introduce vencimiento de la
   publicación diaria por su antigüedad.
4. El primer intento global local falló en PDF por un origen fuera de la lista
   CORS. Se conservó esa evidencia. El mismo bundle en `localhost:8080` pasó la
   suite oficial completa sin cambiar producto, políticas ni documentos.

Problems detected:

No hay defectos focales abiertos en el candidato inspeccionado. Permanecen estas
limitaciones de verificación y entrega, explícitamente fuera de una aprobación
productiva:

- La prueba Edge local elimina tipos, parsea y ejecuta handlers con dependencias
  aisladas. No constituye typecheck semántico Deno ni compilación cloud. La
  revisión automática rechazó el envío al endpoint de compilación de Supabase
  por falta de autorización explícita del payload/destino y posibles efectos
  remotos de `bundleOnly`; no se eludió ese rechazo.
- El frontend nuevo se probó con el backend productivo anterior en la regresión
  de assets. El backend nuevo se verificó localmente. La integración completa
  SQL/Edge/Pages instalada debe comprobarse después de su autorización y despliegue.
- El PASS de Pages es baseline `2026102608`; no demuestra que el candidato esté
  publicado. No se crearon solicitudes reales para probar el nuevo control.
- El Registry debe refrescarse y verificarse después de incorporar este documento
  y los últimos recibos, como paso mecánico final de empaquetado. La inspección
  dirigida de fuentes/schema/diffs se completó sin depender de ese índice.

Architecture implications:

La frontera se mantiene: UI → Repository → Edge/RPC → autoridades existentes.
La nueva proyección importa el módulo de Historial sin modificarlo. El cotizador
existente recibe un guard limitado, protegido por hash de definición y conservación
de firma/OID/owner/ACL. El trigger de alta serializa por afiliado; la política y
publicación comparten bloqueos con sus cambios. No se reemplazaron writers ni
procesos de aprobación, sincronización, Ahorro o SICOF. `sw.js` cambia únicamente
literales de versión; no cambia su lógica. El bundle sólo cambia cinco módulos
focales, según el build y comparación de bloques.

Source-of-truth implications:

Google HISTORIAL P V2 conserva las cuotas; su publicación existente es la vía de
lectura derivada. Supabase conserva criterios, afiliados y solicitudes canónicas.
Las tablas nuevas son autoridad únicamente de excepciones y su auditoría. El saldo
es una derivación validada, no un maestro paralelo. Una fuente desconocida falla
visiblemente y nunca se sustituye por cero deuda, un máximo, mock o almacenamiento
del navegador. Las señales de UI invalidan el estado; no calculan deuda.

Security implications:

Identidad por `numero_control` TEXT exacto y afiliado; controles ambiguos se
rechazan. Se preservan afiliados sin Auth y la separación actor/contexto durante
impersonación. RPC administrativas requieren permisos/frontera de Finanzas,
motivo, versión esperada e idempotencia. Las tablas nuevas no admiten acceso
directo del navegador; se verificaron RLS/grants y denegaciones. Las validaciones
de cotización/envío permanecen activas con revocaciones concurrentes. No hay
credenciales de servicio expuestas en frontend o evidencia pública.

Data implications:

No hay reescritura histórica ni cambio de cuotas/importes. Los saldos se limitan
a cero y respetan centavos; sobrepago no concede crédito adicional. La recuperación
restaura exactamente el cotizador anterior sólo si definición/OID/owner/ACL siguen
coincidiendo, retira guard/entradas nuevas y conserva solicitudes, decisiones,
eventos y evidencia derivada. Los fixtures son sintéticos y aislados; no son
fallbacks productivos.

Owner decision required:

**NO** nueva decisión de negocio, autoridad o datos para aceptar este candidato
local. **Sí permanece pendiente autorización explícita para la operación externa
siguiente** descrita en `deployment-plan.md`; este reviewer no la concede.

Recommended next action:

Congelar el paquete y refrescar/verificar Registry. Entregar al propietario el
resultado local, punto de restauración y plan concreto de migración, compilación/
despliegue Edge y publicación Pages. Solicitar autorización para ese payload y
esos destinos, explicando el rechazo automático. No publicar ni declarar PASS
productivo con esta revisión. La autorización no debe implicar solicitudes de
prueba, cambios de excepciones reales ni escrituras Google.

## Evidencia contrastada

Se leyeron los archivos normativos requeridos por `sutiapp-architect-reviewer`,
la solicitud, auditoría, diffs contra HEAD, fuentes nuevas, SQL/recovery y evidencia.
Se aplicaron Navigator y guardians de fuente, migración, Google, seguridad,
preservación UI y verificación. `docs/WORK_QUEUE.md` existe y conserva restricciones
históricas de Phase 7; `docs/WORK_QUEUE_HISTORY.md` no existe. No hay
`task-orchestrator` ni `h-gate-supervisor` disponible que autorice autocontinuación.

| Evidencia | Resultado y alcance |
| --- | --- |
| `projection.json` | PASS, ocho grupos con el proyector real; K/A/B, cargos, ceros, fechas, identidad, duplicados y centavos. |
| `sql.json` | PASS, PGlite: permisos/RLS, reservas, representación, excepciones/revocación, cotización y recovery exacto. |
| `concurrency.json` | PASS, PostgreSQL 18 nativo: seis carreras, dos conexiones y espera real de locks; sobrecupo, solicitudes válidas, revocaciones y publicación. Reejecutado por el reviewer con la migración final. |
| `edge-local.json` | PASS, cinco grupos offline; snapshot propio, contexto, regla/monto y cambios de sesión. Limitación Deno/cloud indicada arriba. |
| `isolated-ui-browser.json`, capturas y `ui-preservation.md` | PASS de estructura/componentes en Chrome, 18 casos, cero errores y solicitudes externas; controles existentes conservados. |
| Suites UI focales y de monto/plazo/total | PASS según evidencia y fuentes contrastadas; incluyen invalidación, respuestas obsoletas e identidad. |
| `build.json` | PASS, versión `2026102609`, cinco bloques focales, cero diferencias compiladas ajenas. |
| `global-images-local.json` | PASS suite oficial completa sobre bundle exacto: assets, perfil, Admin, documentos, PDF legítimo, Membership, Préstamo, catálogo/galería, Marketplace, fullscreen, refresh y con/sin service worker; cero errores/escrituras de negocio. |
| `global-images-production-baseline.json` | PASS Pages anterior; sólo baseline. |
| `restore-external.json`, `workspace-preservation.json`, auditoría | Respaldo y preservación comprobados; recuperación no destructiva documentada. |
| `git diff --check` | PASS; sólo avisos normales de normalización LF/CRLF. |

Identidad del candidato revisado (SHA-256):

| Archivo | SHA-256 |
| --- | --- |
| `app/bundle.js` | `d22be38a3bf4992922450a856eff30c87579fcc4c9f9b2b4c65720d3307f40ab` |
| `supabase/functions/financial-legacy/index.ts` | `6f0c9bf6b8d0b9a56ff535647b1b7a049b1091d42c4c8dedfe8c57955680b309` |
| `supabase/functions/financial-legacy/loan-capacity.mjs` | `c95ce354f7686e90ef67e48a0e00c33cf95e9d17555b0c82d39d5f3d3f0c484c` |
| Migración `20261027000100_loan_available_credit.sql` | `203826dd3e9a703785495dced45bcfb86a6a5294a5e07ae0478014ebf84c60ff` |
| Recovery `20261027000100_loan_available_credit.sql` | `eba1297c093ef6b7ec4688607747eb7538bf2c1c628fefee4c861424daff237b` |
| `concurrency.json` | `253271115e4241635f5692c29c27751968d3ce9d5cfc4047a9bd1df63796abdb` |
| `global-images-local.json` | `efcf7b281a7647243e4b27d25aa6af41cbe9b24d1b457cc372d489aae0d2661f` |

# RESPONSE TO CODEX

Apruebo únicamente el candidato local de H-LOAN-AVAILABLE-CREDIT-001 identificado
arriba. Finaliza el Registry y manifiesto sin cambios de producto; conserva la
raíz dirty, respaldo y evidencias. Entrega el paquete concreto y solicita la
autorización externa pendiente conforme a `deployment-plan.md`. Mantén la H
productiva BLOCKED y no ejecutes compilación cloud, migración, despliegue, push o
publicación hasta contar con esa autorización. Después de una autorización
aplicable, revalida drift y cumple los controles de ese plan antes de afirmar
PASS productivo. No alteres datos históricos ni generes solicitudes reales de QA.
Esta instrucción no es autocontinuable para operaciones externas y no autoriza
otra H.

SUTIAPP ARCHITECT REVIEW

Task: H-LOAN-AVAILABLE-CREDIT-001 — candidato local `2026102609`.
Verdict: APPROVED.

Critical findings: Ninguno abierto en el candidato; compilación cloud e integración
productiva pendientes de autorización/verificación externa.

Source of truth: PASS local; autoridades y publicación existentes preservadas.
Architecture: PASS local; extensión focal y Registry por congelar con evidencias.
Security: PASS local; controles servidor, identidad/permisos, revocación y carreras.
Data: PASS local; sin escrituras de negocio, recuperación conserva historia.
Legacy: PASS; sin cambios Google, fórmulas, amortización ni sincronización.

Owner decision: NO nueva decisión de negocio; autorización externa pendiente.

Next action: Congelar el paquete, presentar resultados y solicitar autorización
concreta. No confundir esta revisión con autorización o publicación.

Response generated for Codex: YES.
