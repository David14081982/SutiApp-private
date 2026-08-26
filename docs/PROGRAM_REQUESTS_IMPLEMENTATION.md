# Solicitudes reales en Supabase — ADR-038

## PRE-CHANGE AUDIT

H: MASTER-PROGRAM-REQUESTS
Objetivo: habilitar masivamente los CTA iniciales de catálogos Supabase sin tocar procesamiento financiero.
Alcance: esquema/RLS/RPC/idempotencia; Repository; detalle/hoja de solicitud; Mi Historial; panel Admin; gobierno y pruebas.
Fuera de alcance: tasas, saldos, préstamos, amortizaciones, pagos, descuentos, Google Sheets/Apps Script y handoff financiero.
Datos afectados: nuevas solicitudes posteriores al corte; permisos técnicos Admin; `request_mode` de renglones catalogales habilitados.
Fuentes de verdad: `affiliates` para identidad; catálogos Supabase para destinos; `program_requests` para intención inicial; Google legacy conserva finanzas.
Recovery: revocar RPC nuevas, restaurar el límite anterior de CTA y conservar `program_requests` como archivo read-only sin borrar filas.
Status: PASS

## SOURCE OF TRUTH AUDIT

Domain: solicitudes iniciales de programas, productos y cotizaciones.
Authority: Supabase `program_requests` después del corte; tablas anteriores solo histórico.
Readers: afiliado propio, empresa destino y Admin autorizado bajo RLS.
Writers: RPCs `SECURITY DEFINER` autenticadas; sin insert/update directo del cliente.
Alternative sources/fallbacks/caches: ninguno. Mi Historial usa memoria derivada y no persiste.
Conflicts: ninguno; la solicitud no se replica a Google.
Verdict: SAFE

## DATABASE MIGRATION AUDIT

Schema: UUID/FK, `numero_control TEXT`, destino XOR, estados y tipos con CHECK, timestamps, índices e idempotencia compuesta.
RLS/security: RLS forzada; anon sin grants; self/company/Admin separados; identidad derivada en backend.
Historical data: no se borra, transforma ni copia; las tablas anteriores no reciben nuevas altas y pueden concluir workflows previos.
Backup/recovery: recovery no destructivo; las filas nuevas se conservan.
Verdict: PASS

## LEGACY GOOGLE AUDIT

Systems/domains: Google Sheets, Apps Script y cálculos financieros.
Reads: NO INTERACTION.
Writes: NO INTERACTION.
Calculations/triggers: NO INTERACTION.
Authority: sin cambio; Google conserva procesamiento financiero cuando aplique.
Classification: READ ONLY / NO INTERACTION.

## SUPABASE SECURITY REVIEW

Auth/business identity: `auth.uid()` y afiliado efectivo; `affiliate_id`/`numero_control` no son parámetros del cliente.
RLS/grants: lectura propia, tenant empresarial o permiso técnico; mutación directa revocada. Una migración complementaria limita las columnas browser y excluye firma, idempotencia y contexto interno.
Cross-user access: denegado por RLS.
Impersonation/audit: actor real y afiliado efectivo separados; escritura auditada.
Verdict: PASS sujeto a suite live.

Resultado live: PASS. Anónimo 401; insert directo 403; lectura cruzada 0; payload de identidad ajena 404; identidad/control derivados correctos; Admin autorizado consultable; doble envío devolvió el mismo UUID; escrituras legacy 0; fixtures eliminados.

## UI CONTRACT

SCREEN: Catálogo/detalle, hoja de solicitud, Mi Historial y Panel Admin.
SECTIONS: galerías, información, descripción, aviso, CTA, firma/términos, confirmación/folio, timeline; menú y cards Admin.
CONTROLS: CTA, cantidad, mensaje, firma, aceptación, enviar/cancelar, estados Admin.
INTERACTIONS/NAVIGATION: sin cambios salvo backend real y nuevo acceso Admin autorizado.
EMPTY/LOADING: estructuras existentes; Admin añade loading/error/empty explícitos.
MOTION/SCROLL: sin cambios.

## VERIFICATION EVIDENCE

- Esquema aplicado y reconciliado: `134/134` ítems habilitados en modo Supabase; cero solicitudes residuales de prueba.
- Suite reversible multiusuario: `PASS` para Auth, identidad derivada, RLS, Admin, idempotencia y cero escritura legacy.
- Chrome real: `PASS`; grupos, 50 filas Farma, detalle, imagen, CTA y hoja Claude preservados.
- Bundle regenerado desde 69 fuentes con Babel y validado por `node --check`.
- Regresiones estáticas de corte, Historial y preservación Claude: `PASS`.
- Recovery: revoca RPC, restaura CTA anterior y conserva solicitudes; el recovery complementario restaura únicamente el grant precedente.
- Limitación de evidencia: el workspace no contiene metadata Git, por lo que no existe `git diff`; el alcance se verificó por inventario, contenido y suites reproducibles.

## H-MASTER-PROGRAM-REQUESTS RESULT

Status: PASS
Files changed: frontera SQL/RLS/RPC y recovery; Repository/stores; Catálogo, Marketplace, Historial y Admin; bundle/PWA; pruebas y gobierno listados en esta evidencia.
Source-of-truth verdict: PASS — `program_requests` es la única autoridad posterior al corte; no existe fallback ni doble escritura.
Invariant verdict: PASS — INV-063 a INV-066 verificados.
Build: PASS — bundle v81 desde 69 fuentes, caché v26 y `node --check`.
Tests: PASS — suites estáticas, multiusuario live reversible y Chrome real.
Security: PASS — identidad derivada, RLS forzada, mutación directa 403, cross-user 0, columna sensible 403 y grants mínimos.
Legacy impact: NO INTERACTION — cero lectura/escritura Google y cero cálculo financiero.
Unexpected files changed: ninguno detectado por inventario; Git no está disponible para confirmar diff.
Known limitations: el workflow financiero y su handoff siguen fuera de alcance; el Admin actual cubre consulta y estado, no un workflow integral.
Evidence: `scripts/test-program-requests-live.py`, `scripts/test-program-catalog-browser.js`, reconciliación 134/134 y auditoría estática `PASS / REVIEW REQUIRED` con 273 coincidencias históricas fuera de esta frontera.
