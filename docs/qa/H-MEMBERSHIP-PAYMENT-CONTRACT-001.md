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
