# H-MEMBERSHIP-GOOGLE-COMPANY-Z-001

## PRE-CHANGE AUDIT

Objetivo autorizado: columna Z (Observaciones) de nuevas solicitudes de membresías
en SutiApp Final / Historial de solicitudes = empresa de la membresía solicitada.
Fuente: program_requests.financial_submission_snapshot.offering.company, capturado
desde membership_offerings al solicitar. Nunca consultar el precio/nombre actuales
para reconstruir una solicitud anterior.

Alcance: supabase/functions/financial-legacy/request-google-sync.js, exclusivamente
la proyección de Z para program_id=membership y contrato MEMBERSHIP_PAYMENT_V1;
scripts/test-membership-google-company-z.js; scripts/deploy-membership-google-company-z.js;
este documento, docs/qa/evidence/membership-google-company-z-20260910/ y notas focales
en docs/LEGACY_GOOGLE_SYSTEMS.md, docs/AGENT_CHANGELOG.md.
Backups/compilación/release aislados en C:/tmp/sutiapp-membership-company-z-20260910.

Fuera de alcance: solicitudes ya exportadas y initial_row existentes, backfill,
E–I, cálculos, reglas/fondos/programas, SQL/schema, GAS, fórmulas, AH+, workflow,
frontend, imágenes, configuración JWT, secretos y cron.

Plan: respaldo y cotejo del Edge activo; elegir nombre desde snapshot inmutable;
probar toda la fila y transporte/reintentos con receptor GAS aislado; compilar
sin desplegar, publicar exclusivamente el módulo auditado y verificar readback.
Recovery: redesplegar el bundle completo anterior respaldado, preservando JWT;
ninguna reversión debe modificar solicitudes o filas Google existentes.

LEGACY GOOGLE AUDIT: SAFE CHANGE condicionado a pruebas. Reader Supabase existente;
writer Edge/GAS existente registra A:AG y actualiza sólo Y después. Única diferencia
autorizada: Z de la fila inicial de nuevas membresías con contrato financiero.
Resto de las 32 celdas idéntico; otros programas e históricos conservan notas.
Sin cálculos, triggers o acciones de aprobación nuevos.

SOURCE OF TRUTH AUDIT: SAFE. Misma solicitud/snapshot como autoridad contractual;
Z es proyección sin escritura maestra. No se introduce lectura de catálogo,
fallback, caché o persistencia paralela. Snapshot nuevo sin empresa falla explícitamente.

SUPABASE SECURITY REVIEW: conservar handler, validaciones, identidad, grants/RLS,
JWT y todos los módulos no modificados del Edge. No nuevos endpoints o permisos.

Architecture: no cambio de topología/dependencias/RPC/tabla/permiso; se proyecta
otro campo del mismo snapshot que ya consume el mapper. Registry puede permanecer
stale por contenido/evidencia; inspección focal confirma dependencias vigentes.
Global image regression: NOT APPLICABLE, módulo exclusivamente de transporte a
Google, sin consumo frontend ni modificación de repositorios/visores compartidos.

Tests: empresas múltiples, renombre del catálogo, E–I y todas las demás columnas,
programas no membership, solicitudes antiguas, error de snapshot inválido,
creación/aprobación/retry GAS aislado, initial_row inmutable y compilación/readback.
No crear solicitudes/filas Google productivas de prueba.

Status: PASS (auditoría y autorización; resultado verificado abajo).

Dependencia de pruebas: actualizar scripts/test-membership-payment-contract.js
para incluir la empresa en su fixture V1 y sustituir el guard antiguo de igualdad
completa del mapper por paridad de todas las columnas excepto Z. La prueba nueva
comprueba Z y la igualdad completa de los demás programas. No cambia código UI.
Release reutiliza el worktree privado limpio del cierre anterior, base 9f880bf,
transportando sólo este mapper y las pruebas/documentos declarados.

Ampliación autorizada por «asegúrate que estas fallas no vuelvan a pasar»:
añadir .github/workflows/membership-google-contract.yml para ejecutar las dos
pruebas aisladas en push/PR. No modifica el workflow de publicación existente,
no utiliza secretos ni ejecuta acciones de negocio. Las comparaciones de pruebas
usan el commit publicado 9f880bf como baseline reproducible y normalizan CRLF/LF.

## H-MEMBERSHIP-GOOGLE-COMPANY-Z-001 RESULT

Status: PASS
Files changed: mapper focal; dos pruebas; helper de despliegue; workflow de
regresión aislada; este informe/evidencia; notas en LEGACY_GOOGLE_SYSTEMS y AGENT_CHANGELOG.
Source-of-truth verdict: PASS; misma empresa capturada en snapshot contractual.
Invariant verdict: PASS; otras 32 columnas, otros programas e initial_row conservados.
Build: PASS; compilación Edge del candidato y hash publicado coincidentes.
Tests: PASS; node scripts/test-membership-google-company-z.js y
scripts/test-membership-payment-contract.js en release aislado.
Security: PASS; verify_jwt=true, acceso anónimo HTTP 401; handler/policy idénticos.
Legacy impact: sólo Z en alta inicial de membership V1; GAS/SQL/fórmulas intactos.
Unexpected files changed: ninguno en release; cambios previos del workspace excluidos.
Known limitations: pruebas de filas en receptor real GAS ejecutado en memoria;
no se insertó una solicitud o fila productiva de prueba. Sin backfill.
Evidence: docs/qa/evidence/membership-google-company-z-20260910/*.json.

Edge activo verificado: financial-legacy v44 (antes v43), hash
81c7e317c430e5c9b41bd40da445bc1508f82dfab39ab073920a883e75b384d6.
Readback: único módulo de código cambiado = request-google-sync.js; 23 entradas
restantes idénticas. Metadata de runtime cambia únicamente de versión 43 a 44.
La comprobación inicial detectó esa diferencia esperada de metadata; se refinó
el comparador a la versión exacta y se repitió sólo lectura, sin otro despliegue.
El test heredado tenía baseline privado y sensibilidad CRLF; se hizo reproducible
contra el commit publicado y pasó en el release, sin modificar archivos UI.

## SUTIAPP ARCHITECT REVIEW

Task: H-MEMBERSHIP-GOOGLE-COMPANY-Z-001
Verdict: APPROVED
Critical findings: diff runtime limitado a selección de empresa y celda 25;
fuentes activas cotejadas, compilación/readback, fila completa y retries probados.
Source of truth: PASS; snapshot inmutable ya existente, sin catálogo alternativo.
Architecture: PASS; mismas dependencias y transporte; Registry sin cambio estructural.
Security: PASS; autorización, JWT, permisos e identidad sin cambio.
Data: PASS; ninguna escritura de prueba ni reparación histórica.
Legacy: PASS; única diferencia autorizada en Z; finanzas y receptor preservados.
Owner decision: NO.
Next action: commit/push del alcance y comprobar los checks de publicación y regresión.
Response generated for Codex: YES.
WORK_QUEUE_HISTORY.md no existe; WORK_QUEUE limita append productivo y Phase 8;
esta H no ejecuta ninguno. No hay continuación automática a otra H.

## RESPONSE TO CODEX

Aprobar H-MEMBERSHIP-GOOGLE-COMPANY-Z-001. Publicar únicamente el alcance auditado,
verificar los checks del commit y detenerse. No alterar históricos ni otros programas.
