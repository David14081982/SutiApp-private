# H-MEMBERSHIP-PAYMENT-CONTRACT-001

## PRE-CHANGE AUDIT

Objetivo autorizado: nuevas solicitudes de vales/membresías con fondo exacto
`Vales y membresias`, interés cero, H=I=monto comercial de membership_offerings,
G=installments, $15 administrativos INCLUIDOS por descuento y capital=total-15*n.
Periodicidad desde affiliates.financial_employee_category_code, conservando n pagos.
Owner autorizó implementación quirúrgica; históricos y reportes están excluidos.

Archivos autorizados: app/screens-membership-application.jsx,
app/membership-repository.js (preview propio), app/program-request-repository.js
(exclusivamente createMembership), app/bundle.js y SutiApp.html (generados);
supabase/migrations/20260910000100_membership_payment_contract.sql;
supabase/recovery/20260910000100_membership_payment_contract.sql;
scripts/membership-payment-contract.py; scripts/test-membership-payment-contract.sql;
scripts/test-membership-payment-contract.js;
scripts/test-membership-payment-contract-browser.js;
esta evidencia y docs/qa/evidence/membership-payment-contract-20260910/;
docs/{SOURCE_OF_TRUTH,INVARIANTS,DECISIONS,AGENT_CHANGELOG}.md;
índices derivados docs/architecture/{SUTIAPP_ARCHITECTURE_REGISTRY,registry-code,
registry-data,registry-edges,registry-search}.json.
Backups privados y build/pruebas aislados: C:/tmp/sutiapp-membership-payment-20260910.

Autoridades: catálogo vigente membership_offerings (amount/installments), categoría
en affiliates; condiciones aceptadas inmutables en program_requests; workflow existente
y program_request_admin_events para estados. Google es proyección existente A:AG;
no cambiar GAS, Edge, hojas, fórmulas, AH+, configuración ni históricos financieros.
No crear entradas en financial_programs/funds/rules ni usar su calculador aditivo.

Plan: inspección/backup real de schema y funciones; contrato backend exclusivo de
membresías con preview propio, captura atómica, idempotencia y protección de cambios
de catálogo/perfil; UI existente conserva todas sus secciones y recibe importes del
servidor; aprobar sigue el workflow actual (financial_processing_status=NULL).
El export existente consumirá financial_submission_snapshot.financialResult sin edición.

UI original: hero/logo/empresa/concepto; tres importes; nota nómina; tracker/chips;
UnifiedDocumentPhase y visor; teléfono/RFC/CURP; privacidad/términos; CTA y éxito;
scroll/responsive/back. Sólo varían importes autoritativos, periodicidad y errores de contrato.

Riesgos: doble cargo, plazos/periodicidad confundidos, cambios de catálogo durante envío,
suplantación de afiliado, bypass de writer, trigger compartido, alteración de historia,
transición accidental por writer de préstamos, centavos y categorías no resueltas.
Categorías sin política demostrada fallan explícitamente; no asignar frecuencia por defecto.
No fijar fechas nuevas de cobro: se conserva el proceso posterior a aprobación existente.

Pruebas: matriz SQL con rollback (montos/pagos/categorías/permisos/cambios/idempotencia/
documentos/workflow/snapshot/recovery), export E:I y paridad no-membership aislados,
browser y build, regresión global imágenes local/Pages por repository compartido.
No crear solicitudes persistentes ni registros Google de prueba. Inventario/hashes
de tablas antes/después; comparar delta del workspace preexistente, no contra HEAD solo.

Recovery: objetos aditivos; recuperar únicamente infraestructura vacía y bloquear
retirada cuando existan contratos nuevos. Conservar solicitudes/historia siempre.
Desplegar backend validado antes del frontend. WORK_QUEUE histórico no autoriza nuevas
fases; la autorización concreta de esta H viene del propietario en la conversación.

Status: PASS (alcance/autorización; verificación técnica pendiente).

Ampliación focal de pruebas: scripts/test-membership-request-ui-cutover.js conserva
las pruebas visuales/documentales y actualiza las tres expectativas del cálculo
local reemplazado por importes autoritativos. Ninguna otra pantalla cambia.

Release: scripts/release-membership-payment.py y worktree aislado privado sobre
origin/main. La copia local antecede a ajustes tipográficos publicados: transportar
únicamente los hunks funcionales, conservando CSS publicado byte por byte. Bundle
de release se regenera desde ese árbol, nunca se publica el bundle global del workspace
antiguo. SutiApp.html sólo cambia query de bundle. No modificar sw.js ni configuración
de programas. Toda publicación requiere backend/pruebas exactos antes de push.

Periodicidad comprobada: JUBILADOS_PENSIONADOS mensual (proceso JUB del calendario
vigente); BASE/EVENTUALES/SUPLENTES_FIJOS/SUPLENTES_VARIABLES quincenal.
CONFIANZA quincenal, respaldado por sus siete reglas financieras vigentes y el
mapeo existente de Google a proceso Confianza; no se modifica el calendario de
préstamos. Categoría ausente falla explícitamente. Evidencia:
evidence/membership-payment-contract-20260910/existing-category-periods.json.

Prueba adicional autorizada: scripts/test-membership-payment-contract-live.js,
lectura autenticada de las seis cotizaciones vigentes y denegación anónima, sin
enviar solicitudes. Preparación de release restaura bytes Git exactos de vendor
porque autocrlf de Windows invalidaba SRI en el build local; blobs de vendor y
hashes SRI publicados permanecen sin cambios.

## Resultado funcional y publicación

Implementación publicada en `54290acfc109fa0fc2edeb52f24050845665f5a3`.
GitHub Actions: https://github.com/David14081982/SutiApp-private/actions/runs/34502726723
finalizó success, incluidos los checks de Auth y solicitudes críticas.
El bundle público `v=245` coincide byte por byte con el candidato verificado:
`65f1c61ea967349151b53bea4230f9bdca6bd7a60afa124803b519050f336ba5`.
Se conservaron los otros 112 módulos y el CSS de membresías publicado.

- SQL: 120 combinaciones de seis categorías, cinco importes y cuatro cantidades
  de pagos; suma de descuentos con ajuste de centavos, capital y gastos incluidos.
  Docs requeridos, cotización obsoleta, reintentos antes/después de cambio de
  catálogo, snapshots inmutables, writer anterior de siete argumentos, workflow
  vigente completo, aprobación y cola Google: PASS, todo con ROLLBACK.
- Recuperación exacta de infraestructura sin actividad: PASS; bloquea retirada
  cuando existen contratos nuevos. Funciones previas conservan OID, definición
  y ACL. Inventarios y hashes antes/después de aplicar y verificar: idénticos.
- Mapper real de Google ejecutado aisladamente: E–I =
  `Vales y membresias / 0 / 2 / 200 / 200` para el ejemplo del catálogo.
  También se conserva el puente de préstamos y puertas, la idempotencia y A:AG.
- Browser 390/1440: ocho combinaciones de importes/periodos, recálculo ante
  cambio de catálogo, error explícito y todos los componentes originales: PASS.
- Seis cotizaciones vigentes autenticadas en candidato y producción: PASS.
  Acceso anónimo denegado; ninguna solicitud se envió en esas pruebas.
- Regresión global obligatoria: PASS en candidato local y Pages, con assets
  legítimos, PDF, Admin Afiliados, membresías, préstamos, Marketplace, galería,
  fullscreen, refresh y comparación con/sin service worker; cero errores browser.

El intento local en un puerto no autorizado fue rechazado por CORS al consultar
un PDF. Se repitió íntegramente en el origen existente `http://localhost:8080/`:
PASS, sin ampliar la lista de orígenes ni modificar document-access/Storage.

No se crearon solicitudes ni filas Google persistentes de prueba. La escritura
real a Sheets de una nueva solicitud comercial ocurrirá por el flujo existente;
no se afirma una prueba de append productivo que no se ejecutó. Los históricos
permanecen fuera de alcance. Los reportes separados siguen siendo trabajo futuro.

Evidencia reproducible: `scripts/membership-payment-contract.py verify` (rollback),
`scripts/test-membership-payment-contract.js`,
`scripts/test-membership-payment-contract-browser.js`,
`scripts/test-membership-payment-contract-live.js`,
`scripts/test-global-image-regression-production-live.js` y JSON sanitizados
en `evidence/membership-payment-contract-20260910/`.

## H-MEMBERSHIP-PAYMENT-CONTRACT-001 RESULT

Status: PASS
Files changed: tres fuentes focales de membresías; bundle/HTML generado; migración
  y recovery aditivos; scripts de pruebas/preparación; documentos y evidencia de
  esta H; cinco particiones derivadas del Architecture Registry. El manifiesto
  de publicación está en release-preflight.json. Workspace previo preservado;
  el release se construyó aisladamente sobre origin/main.
Source-of-truth verdict: PASS. Catálogo y afiliado canónicos; snapshot contractual
  inmutable y proyección existente en Admin/Google, sin autoridad paralela.
Invariant verdict: PASS. Cero interés, $15 incluidos por pago, H=I=precio comercial,
  n pagos del catálogo y periodicidad por categoría; historia preservada.
Build: PASS. Babel y Pages; bundle público coincide con el candidato verificado.
Tests: PASS. SQL/recovery, 120 combinaciones, ocho escenarios browser, seis
  cotizaciones reales, puente Google aislado y regresión global local/Pages.
Security: PASS. Contexto efectivo y actor backend, helpers privados, RPC propia,
  denegación anónima, grants previos intactos; sin nuevas policies ni secretos UI.
Legacy impact: Nuevas membresías aportan financialResult al mapper existente;
  sin cambios en Edge, GAS, reglas/fondos/programas, AH+ ni historial anterior.
Unexpected files changed: Ninguno en publicación; sólo alcance declarado.
Known limitations: No append productivo de prueba, ni históricos ni reportes.
  Categoría ausente y monto menor al gasto incluido producen error controlado.
  La evidencia de cierre posterior puede dejar freshness documental stale;
  los hashes de las cuatro fuentes runtime/SQL y las nuevas RPC están verificados.
Evidence: directorio evidence/membership-payment-contract-20260910 y Actions
  34502726723; deployment.json verifica commit, versión y hash públicos.

## ARCHITECT REVIEW

Task reviewed: H-MEMBERSHIP-PAYMENT-CONTRACT-001, cambio publicado y verificado.
Verdict: APPROVED
What Codex did correctly: Autoridad backend, importe comercial variable, gasto
  incluido, captura atómica e inmutable, compatibilidad del writer anterior,
  workflow y exportador conservados, publicación aislada y evidencia real.
Important findings: La configuración de préstamos no sirve para sumar comisiones
  a estos productos. La solución consume el catálogo de Membresías y mantiene
  las condiciones aceptadas aun si el catálogo cambia después.
Problems detected: Ninguno pendiente en el alcance autorizado.
Architecture implications: Cuatro funciones/RPC y un trigger exclusivos de
  nuevas membresías; tres fuentes frontend focales; Registry sólo derivado.
Source-of-truth implications: membership_offerings y affiliates siguen siendo
  maestros; program_requests conserva el contrato histórico, no un catálogo.
Security implications: Actor real y contexto afiliado independientes; selección
  de afiliado no aceptada desde el cliente; validaciones reales en backend.
Data implications: Cero solicitudes/filas Google de prueba persistentes;
  inventarios y hashes idénticos alrededor de aplicación/verificación.
Owner decision required: NO.
Recommended next action: Cerrar esta H. No iniciar reportes, backfill ni otra fase.
Missing references: docs/WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE.md describe
  una fase legacy anterior. Esta H está autorizada expresamente por el propietario
  en la conversación; no concede autorización para un append productivo de prueba.

## RESPONSE TO CODEX

Aprobar y cerrar H-MEMBERSHIP-PAYMENT-CONTRACT-001 con la evidencia indicada.
Conservar datos históricos y configuración de los demás programas. Detenerse
al concluir; no continuar reportes ni otras fases sin una nueva instrucción.

SUTIAPP ARCHITECT REVIEW
Task: H-MEMBERSHIP-PAYMENT-CONTRACT-001
Verdict: APPROVED
Critical findings: Ninguno pendiente.
Source of truth: PASS
Architecture: PASS
Security: PASS
Data: PASS
Legacy: PASS; sin append productivo de prueba.
Owner decision: NO
Next action: Cerrar y detenerse.
Response generated for Codex: YES
