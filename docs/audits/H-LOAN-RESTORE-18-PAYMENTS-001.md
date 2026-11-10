# H-LOAN-RESTORE-18-PAYMENTS-001

## Publicación autorizada — 2026-11-09
OWNER: «publicalo, haz push commit y despliega».
Amplía alcance a commit/push main y despliegue GitHub Pages. Preparar checkout
aislado `.tmp/loan-terms-release` sobre origin/main actualizado: el workspace
original diverge y contiene trabajo ajeno que no debe publicarse ni resetearse.
Archivos adicionales: SutiApp.html y sw.js únicamente cachebusters generados;
metadatos y pruebas de publicación en el directorio de evidencia de esta H.
Plan: aplicar diff focal a fuente y bundle remoto, preservar módulos ajenos,
actualizar versiones de cache, build y tests focales, commit allowlisted, push
fast-forward, verificar Actions y bytes servidos. No lógica SW/backend/SQL.
Riesgo: publicar módulo desactualizado; comparar contra el remoto antes de editar
y regenerar sólo ese módulo. Recovery: revert del commit focal y nuevo deploy.
La excepción GENERATED_ARTIFACT de AGENTS aplica; sin regresión global adicional.
Status pre-change: PASS. Esta autorización sustituye el límite local anterior.

## Ampliación autorizada antes de implementar
El propietario pide «también recupera el de 24 pagos». El alcance ahora incluye
6/12/18/24, exclusivamente por intersección con allowed_terms. Mismos archivos,
riesgos y autoridades; pruebas de selección/cotización para los cuatro plazos.
No se recupera el editor Otro. Status: PASS.

## PRE-CHANGE AUDIT — 2026-11-09
H: H-LOAN-RESTORE-18-PAYMENTS-001.
Objetivo: recuperar 18 pagos junto a 6 y 12 en Caja Chica, Caja de Ahorro y
Sutiexpress, con la cotización y continuidad existentes. La petición actual del
propietario enmienda la restricción visual de H-LOAN-AMOUNT-TERM-UI-001.
Alcance/archivos: app/screens-loan.jsx; app/bundle.js (GENERATED_ARTIFACT focal);
scripts/test-loan-amount-term-ui.js; scripts/test-loan-stale-quote-browser.js;
este audit; docs/AGENT_CHANGELOG.md; docs/qa/evidence/loan-restore-18-payments/.
Fuera de alcance: publicación, backend/SQL, criterios, tasas, fórmulas, Google,
históricos, documentos, otros módulos y lógica service worker.
Datos afectados: selección efímera de plazo; ninguna escritura externa.
Fuentes de verdad: Supabase financial_programs/funds/rules y loan_term_policy;
allowed_terms y termOptions del servidor; React sólo selecciona/proyecta.
Lectores: LoanScreen/StepSimulatorV2 y flujo existente de solicitud.
Escritores: ninguno nuevo. APIs existentes de sesión/cotización/confirmación intactas.
Invariantes: intersección con allowed_terms; cálculo exclusivamente backend;
no fallback; resultados obsoletos bloquean continuar; no alterar límites por perfil.
Riesgo: conservar selección inválida al cambiar fondo o mostrar cuota obsoleta.
Plan/tests: ampliar filtro a 6/12/18; verificar selección y ausencia de 18 si no
autorizado; navegador en los tres fondos, recotización y desglose; build focal;
contratos del simulador, depósito y confirmación.
Recovery: revertir sólo este diff y regenerar módulo focal; conservar cambios previos.
Status: PASS.

## Navigator / guardians
Registry STALE (5 changed, 236 added previos). screens-loan.jsx no está entre
los cinco cambios; discovery directo confirma filtro allowedTermsOf en línea 389,
TermPicker, projectTermOption y deriveSelection. Sin cambio de arquitectura:
no actualizar Registry. Revisados precedentes H-LOAN-AMOUNT-TERM-UI-001/002.
SOURCE OF TRUTH: SAFE. Sólo se deja de ocultar un plazo recibido del servidor.
No se fabrica disponibilidad ni importe, no se añade fuente/caché ni writer.
LEGACY: SAFE CHANGE presentacional autorizado. Cero lecturas/escrituras Google;
equivalencia: mismo term numérico y mismo resultado autoritativo en solicitud.
SECURITY: sin modificación Auth/RLS/grants/Storage/identidad. Servidor conserva
validación de criterios, máximo, perfil y confirmación. No secretos nuevos.

## Contrato visual
SCREEN: Finanza / Pagos / Suti Préstamo.
SECTIONS: header, pasos, resultado, fondos, monto, plazo, desglose, metadata, footer.
CONTROLS: conservar edición de monto, fondos, 6/12, desglose, continuar/volver;
añadir únicamente tarjeta 18 del componente existente cuando esté autorizada.
INTERACTIONS: misma selección, recotización, motion y navegación de cuatro pasos.
EMPTY/LOADING/ERROR: mismos estados controlados. SCROLL: carrusel horizontal existente.
ADMIN: NOT APPLICABLE. No cambio de estilos, dimensiones ni jerarquía.

## VERIFY / EVIDENCE
Implementación final: una línea del filtro de presentación permite 6/12/18/24.
El máximo sigue gobernado por allowed_terms del servidor. Se preserva el editor
Otro oculto para estos tres fondos y el comportamiento de los demás fondos.

Evidencia en `../qa/evidence/loan-restore-18-payments/`:
- `baseline.json` y `status-before.txt`: estado previo de workspace ya modificado.
- `build.cjs` / `build.json`: Babel 7.28.4, módulo screens-loan.jsx regenerado;
  prefix/suffix del bundle idénticos byte por byte. Sintaxis bundle validada.
- `tests.json`: cuatro comandos PASS: test-loan-amount-term-ui.js,
  test-loan-simulator-ui-cutover.js, test-loan-deposit-step.js y
  test-loan-submission-success.js. Selección rechaza 18/24 ausentes en autoridad,
  conserva adelanto de un pago y copia importes de termOptions sin recalcular.
- `browser.json` / `loan-390.png`: Chrome real, fixtures sólo aisladas; tres fondos,
  cuatro tarjetas, 12/18/24/6 seleccionables y exactamente una cotización por
  selección, confirmación posterior a proyección inmediata, meses y desglose
  correspondientes, 24 accesible por scroll; monto, clamp, 390/430/768,
  error por cotización incompatible y recuperación. Captura inspeccionada.
- `git diff --check` focal PASS; diff runtime de una línea confirmado.

Intento inicial de Chrome dentro del sandbox interrumpido por falta de respuesta;
ejecución local con permisos ampliados PASS. El harness se ajustó para esperar
confirmación y no confundir la proyección inmediata con la cotización concluida.
No se modificó el comportamiento productivo para acomodar pruebas.

CLAUDE UI PRESERVATION REVIEW
Screen: Suti Préstamo. Original/current sections: mismos componentes y orden.
Missing sections: ninguna. Added sections: tarjetas 18/24 autorizadas.
Interactions preserved: PASS selección, cuota, desglose, error/reintento, carrusel.
Navigation preserved: PASS contrato estático de cuatro pasos, flujo no editado.
Visual structure preserved: PASS. Unauthorized redesign: NO. Verdict: PASS.

H-LOAN-RESTORE-18-PAYMENTS-001 RESULT
Status: PASS (local).
Files changed: screens-loan.jsx, bundle.js (GENERATED_ARTIFACT), dos tests focales,
este audit, AGENT_CHANGELOG.md y directorio de evidencia declarado.
Source-of-truth verdict: SAFE; Supabase único; selección efímera sin persistencia.
Invariant verdict: PASS; sin cálculo financiero frontend nuevo ni fallback.
Build: PASS focal con preservación de otros módulos.
Tests: PASS; tests.json, browser.json y comandos anteriores.
Security: backend, permisos e identidad sin cambios; nueva prueba RLS NOT APPLICABLE.
Legacy impact: ninguno; no Google, migraciones, fórmulas ni históricos modificados.
Unexpected files changed: ninguno identificado en el diff de esta H; workspace
previo conservado. Comparación de status sólo añade pantalla y dos tests focales.
Known limitations: no deploy, no certificación de condiciones de cada afiliado
en producción ni envío real. Confirmación conserva term: result.paymentCount
en el writer original; no se creó una solicitud de prueba.
Evidence: docs/qa/evidence/loan-restore-18-payments/.
Global image regression: NOT APPLICABLE; sólo filtro focal y artefacto generado,
sin helpers globales, SW, routing, assets, viewer ni repositorios modificados.

## ARCHITECT REVIEW
Task reviewed: H-LOAN-RESTORE-18-PAYMENTS-001, incluida ampliación a 24.
Verdict: APPROVED para alcance local.
What Codex did correctly: recuperación por intersección con fuente autoritativa;
misma tarjeta y mismo flujo financiero; regresión de límites y cuotas probada.
Important findings: la restricción anterior era UI; backend ya ofrece términos
estándar y filtra por payment_count. No requiere migración ni criterio nuevo.
Problems detected: ninguno en alcance final. WORK_QUEUE_HISTORY.md ausente;
WORK_QUEUE.md no autoriza publicación automática ni solicitudes reales de prueba.
Architecture implications: sin nuevas dependencias; Registry derivado sigue stale
por cambios previos, no se marca fresh ni se regeneran módulos ajenos.
Source-of-truth implications: ninguna; sin autoridad paralela.
Security/data/legacy implications: sin cambios de reglas, permisos o datos.
Owner decision required: NO para esta implementación.
Recommended next action: entregar cambio local indicando publicación pendiente.

RESPONSE TO CODEX
Aprobar H-LOAN-RESTORE-18-PAYMENTS-001 local. Comunicar 6/12/18/24 sujetos a
condiciones del servidor y que aún no está publicado. No iniciar otra H ni
crear solicitudes reales. Mantener intactos cambios previos del workspace.

SUTIAPP ARCHITECT REVIEW
Task: H-LOAN-RESTORE-18-PAYMENTS-001. Verdict: APPROVED.
Critical findings: ninguno. Source of truth: SAFE. Architecture: focal.
Security: intacta. Data: sin escrituras. Legacy: intacto.
Owner decision: NO. Next action: entrega local.
Response generated for Codex: YES.

## Ajuste de verificaci?n para remoto vigente
El remoto incorpora available_amount y anula resultado ante effectiveError.
Se preservan ambos controles; adaptar fixtures de pruebas a available_amount y
a?adir scripts/test-loan-simulator-ui-cutover.js al alcance s?lo para actualizar
su aserci?n textual obsoleta, conservando prioridad autoritativa y fail-closed.
Sin cambio de runtime adicional. Status: PASS.

## Candidato de publicaci?n verificado
Base remota 0ea1b6d; versi?n HTML/bundle/SW 2026110904.
Fuente y bundle cambian exactamente una l?nea funcional. El build focal conserva
el resto del bundle remoto byte a byte. Seis suites PASS, incluido cr?dito
disponible y build Pages. Chrome aislado PASS con cuotas, desglose y cuatro plazos.
Reviewer de publicaci?n: APPROVED para commit/push del allowlist y despliegue
autorizado. No se publica el bundle del workspace original ni se modifican datos.
Siguiente acci?n: push fast-forward, comprobar Actions y hashes HTTP publicados;
si fallan, corregir esta misma H antes de declarar publicaci?n PASS.
