# Bitácora de agentes

## 2026-08-31 — H-NOTIFICATIONS-AUTHORITY-CUTOVER-001

- Se retiraron los cinco avisos de `DATA.notifs` y las tres fuentes mock del badge. Pantalla y campana derivan sólo cotizaciones reales en `program_requests`.
- `seen_at`, el writer `mark_marketplace_quote_seen` y el lector self-only allowlisted hacen durable el acuse sin reabrir `SELECT` directo ni crear tabla de notificaciones.
- Workflow, documentos, membresías, solicitudes generales y eventos Admin fueron inventariados pero no emiten avisos porque aún no tienen contrato durable de visto; no se inventó ningún evento.
- Migración/recovery, live multiusuario y Chrome real pasaron; badge 1→0, refresh conservó visto, mobile/desktop sin overflow y fixtures temporales en cero filas. Carga, error backend con reintento y vacío son estados visibles, no avisos.

```text
H-NOTIFICATIONS-AUTHORITY-CUTOVER-001 RESULT
Status: PASS
Files changed: frontend/repositories; bundle/cache; SQL/recovery; apply/tests; ADR/SOT/mapping/evidence; Registry
Source-of-truth verdict: PASS — program_requests vigente; histórico aislado; DATA.notifs eliminado
Invariant verdict: PASS — cero avisos inventados; acuse durable; dominios no certificados no se simulan
Build: PASS — 92 fuentes; SHA-256 DA8AAEAAAC619F5B1C90E45D804DC54D18D15939EEED8CF8E63A23A947308133
Tests: PASS — static; migration/recovery; live; Chrome 390×844 y 1280×900
Security: PASS — self-only; direct select revocado; cross-user/anonymous denied; RLS forzada
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: sólo cotizaciones poseen hoy evento/visto durable
Evidence: docs/qa/H-NOTIFICATIONS-AUTHORITY-CUTOVER-001-EVIDENCE.md
```

## 2026-08-30 — H-LOAN-DEPOSIT-STEP-001

- Suti Préstamo reemplazó el paso libre “Destino” por `Depósito`, conectado a cuentas Supabase reales, captura validada de banco/tarjeta/CLABE, celular actual separado del teléfono histórico, selección enmascarada y corrección desde Resumen.
- La confirmación Edge v29 revalida la cuenta propia y congela un snapshot privado e inmutable dentro de la misma transacción que crea la solicitud; la proyección browser y auditoría conservan sólo máscaras/últimos cuatro.
- `list_current_deposit_accounts()` separa el autoservicio del lector Admin global: incluso un actor con `bank_accounts.read` sólo ve el afiliado efectivo dentro de Depósito.
- Migración/recovery, RLS/RPC multiusuario, anónimo denegado, build, estáticos y Chrome real 390/430/768/1280 pasaron. La fixture E2E se eliminó por alcance exacto; Google y Apps Script tuvieron 0 lecturas/escrituras.

```text
H-LOAN-DEPOSIT-STEP-001 RESULT
Status: PASS
Files changed: SQL/recovery; Edge/deploy; banking repository; Loan UI; bundle/cache; tests; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — cuenta/celular Supabase únicos; snapshot de solicitud privado y derivado, sin fallback
Invariant verdict: PASS — semántica account/card separada; cuenta propia; transacción atómica; historia inmutable
Build: PASS — 92 fuentes; node --check; bundle SHA-256 78353B76769B24CD8BB5084AF63AAB60E5F1BF36F67800D45A86401DF9F9D5C9
Tests: PASS — static focal; migration/recovery; live security; E2E real 390×844, 430×932, 768×1024 y 1280×900
Security: PASS — JWT; RLS/RPC; normal cross-user/anonymous denied; snapshot privado; máscaras; sin secretos browser
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: el HTML standalone citado no estuvo adjunto; fidelidad verificada contra el contrato funcional y la UI vigente, no por comparación pixel-perfect con ese archivo ausente
Evidence: docs/qa/H-LOAN-DEPOSIT-STEP-001-EVIDENCE.md
```

## 2026-08-30 — H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001

- Catálogo, requisitos, herencia, snapshots y vinculación por solicitud convergen en la autoridad documental existente; no se creó una segunda fuente ni se reinterpretó historia.
- La fase documental es compartida por préstamo, membresía, programas y marketplace, con captura móvil/desktop real, adjunto de archivo, preview, reemplazo y gate backend.
- Admin configura catálogo y reglas por programa, membresía, empresa y producto mediante RPC auditada; Servicio permanece fail-closed porque no existe entidad productiva autorizada.

```text
H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001 RESULT
Status: PASS
Files changed: plataforma SQL/recovery; repositories y pantallas; Admin; bundle; pruebas; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — document_types + program_document_requirements + affiliate_documents/request_documents + Storage privado, sin autoridad paralela
Invariant verdict: PASS — INV-128–132 y contratos históricos, de privacidad y snapshot preservados
Build: PASS — bundle reproducible; sintaxis válida
Tests: PASS — 62/62 estáticas; dry-run/apply/recovery; live con rollback; reemplazo real; Chrome responsive/Admin/membresía
Security: PASS — RLS/RPC, objetivos derivados o explícitos, writer antiguo denegado, bucket privado, cero secretos frontend
Legacy impact: NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE — finanzas 146/35/3 intactas; Google y Apps Script sin interacción
Unexpected files changed: ninguno; evidencia histórica alterada por un arnés fallido fue restaurada sin cambio de contenido
Known limitations: Servicio N/A; 0 productos productivos, herencia certificada con fixture transaccional revertida; snapshots históricos permanecen nulos por diseño
Evidence: docs/qa/H-DOCUMENT-REQUIREMENTS-PLATFORM-AND-UNIFIED-UI-001-EVIDENCE.md
```

## 2026-08-29 — H-ADMIN-FINANCIAL-REQUEST-DECISIONS-001

- Admin Finanzas ahora separa los documentos enviados (`request_documents`) del expediente actual del afiliado; una solicitud antigua sin vínculos declara que no puede reconstruirse, en lugar de presentar archivos actuales como evidencia histórica.
- Comentario, revisión, rechazo y cancelación se escriben en la bitácora inmutable `program_request_admin_events`; la nota del solicitante permanece intacta. La aprobación conserva Edge/Google y registra su evento dentro de la transacción contractual existente.
- Desktop y móvil comparten los writers autorizados, validan motivos/transiciones, verifican el readback y muestran la bitácora. Cancelar sólo opera antes de aprobación.

```text
H-ADMIN-FINANCIAL-REQUEST-DECISIONS-001 RESULT
Status: PASS
Files changed: Admin Finanzas desktop/móvil; repositories/Edge; migración/recovery/harness; bundle/cache; pruebas; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — program_requests conserva solicitud/estado; eventos Admin y documentos históricos/vigentes tienen fronteras explícitas
Invariant verdict: PASS — INV-063–068, INV-097, INV-109, INV-120, INV-122–124 preservadas
Build: PASS — bundle reproducible desde 92 fuentes; sintaxis válida
Tests: PASS — 60/60 estáticas; dry-run/recovery/matriz autenticada; Chrome real read-only en 430/1024/1280/1440
Security: PASS — RLS forzada, cero grants directos browser, permisos backend, actor derivado, secretos frontend 0
Legacy impact: NO TEST WRITE — Edge v26 activo; Google 0 lecturas/escrituras de QA y Apps Script 0 cambios
Unexpected files changed: ninguno fuera del alcance declarado
Known limitations: solicitudes antiguas sin request_documents no pueden demostrar retroactivamente qué archivos se enviaron
Evidence: docs/qa/H-ADMIN-FINANCIAL-REQUEST-DECISIONS-001-EVIDENCE.md y docs/qa/evidence/admin-financial-requests-workbench-20260826/
```

## 2026-08-29 — H-LOAN-DOCUMENT-FLOW-RECOVERY-001

- Se corrigió la causa de `InvalidJWT`: `Ver` ya no reutiliza una URL firmada expirada; revalida el objeto privado y firma por 300 segundos en cada clic. Un fallo queda dentro de SutiApp con recuperación, no en el JSON de Storage.
- El expediente distingue metadata de existencia física. La versión más reciente por tipo gobierna el requisito y el trigger backend impide adjuntar una fila huérfana o antigua a una solicitud.
- El afiliado puede tomar foto, elegir archivo/galería o reemplazar. Un `VERIFIED` anterior permanece inmutable y el reemplazo crea otra fila `PENDING_REVIEW` enlazada/auditada; no hay overwrite, DELETE histórico ni fallback.
- El préstamo enumera los nombres exactos faltantes y vuelve a Documentos sin perder simulación, destino, firma ni términos. Cálculos, elegibilidad, reglas, roles, legales, Google y Apps Script quedaron intactos.

```text
H-LOAN-DOCUMENT-FLOW-RECOVERY-001 RESULT
Status: PASS
Files changed: repository/pantallas de documentos y préstamo; migración/recovery; bundle/cache; pruebas; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — affiliate_documents/document_types + private_assets/objeto privado único; signed URL sólo derivada
Invariant verdict: PASS — INV-097–099, INV-108, INV-120–122 preservadas
Build: PASS — bundle reproducible desde 92 fuentes; sintaxis válida
Tests: PASS — 59/59 estáticas; 10 casos focalizados; migración live; reemplazo reversible; Chrome real autenticado
Security: PASS — bucket privado, Auth/RLS, cross-user 0, anónimo denegado, secretos frontend 0, validación backend
Legacy impact: NO INTERACTION — Google/Apps Script/finanzas legacy 0 lecturas, 0 escrituras y 0 cambios
Unexpected files changed: ninguno fuera del alcance declarado
Known limitations: el arnés browser integral anterior se detenía en el simulador financiero; la ruta documental se cubrió con un arnés Chrome directo y autenticado
Evidence: docs/qa/H-LOAN-DOCUMENT-FLOW-RECOVERY-001-EVIDENCE.md y scripts/test-loan-document-flow*.{js,py}
```

## 2026-08-29 — H-SUPABASE-PERFORMANCE-001

- Se midió el recorrido real Supabase antes de cambiar código y se corrigieron las causas dominantes: bootstrap global de cuatro stores, store visual completo en login, resolución Auth duplicada, consultas secuenciales, firma privada N+1, originales de varios MB y recarga de imágenes públicas sin caché efectiva.
- Usuario autenticado bajó de 3,855 a 1,641 ms; shell de Inicio de 3,891 a 1,728 ms; estabilización inicial de 5,049 a 2,787 ms. Arranque previo al login bajó de 32 a 4 requests, login de 30 a 14 y carga inicial de 5,738,532 a 165,982 bytes.
- Documentos firma siete rutas en una sola llamada batch. Imágenes públicas usan transforms según su tamaño de uso y caché PWA exclusivamente para rutas públicas content-addressed; `private-assets`, signed URLs, REST, RPC, Auth y Edge nunca se cachean.
- No se agregaron índices ni migraciones: los payloads de tablas fueron pequeños y no se demostró un plan SQL lento. Supabase/RLS permanecen como autoridad, sin cambios en reglas, permisos, datos, diseño o legacy financiero.

```text
H-SUPABASE-PERFORMANCE-001 RESULT
Status: PASS
Files changed: stores/repositorios/auth/visuales; Home/UI; bundle/cache; harness/pruebas/reporte; Registry y esta bitácora
Source-of-truth verdict: SAFE — Supabase único; caché sólo de imágenes públicas SHA, nunca datos ni assets privados
Invariant verdict: PASS — autoridades, flujos, contratos visuales, documentos privados y reglas financieras preservados
Build: PASS — bundle reproducible desde 92 fuentes; node --check app/bundle.js
Tests: PASS — suite estática 58/58; prueba focalizada; Chrome real móvil; medición baseline/after completa
Security: PASS — RLS/roles/grants/RPC/secrets sin cambios; signed URLs y private-assets fuera de CacheStorage
Legacy impact: READ ONLY — verificación de pantalla financiera existente; Google/Apps Script/fórmulas/tasas/saldos 0 cambios
Unexpected files changed: se preservaron cambios preexistentes no relacionados y no se atribuyen a esta H
Known limitations: select('*') administrativo y fan-out institucional quedan fuera del arranque; revalidación Edge financiera exige auditoría legacy separada
Evidence: docs/qa/SUPABASE_PERFORMANCE_AUDIT_20260829.md; docs/qa/evidence/supabase-performance-20260829/baseline.json; after.json; scripts/test-supabase-performance-optimizations.js
```

## 2026-08-29 — H-LOAN-SUBMISSION-DOCUMENT-PREFLIGHT-001

- Se diagnosticó el rechazo mostrado como `No pudimos enviar tu solicitud`: no proviene de otra solicitud pendiente. La inspección productiva de solo lectura confirmó un destino Préstamo habilitado, términos publicados, ocho requisitos obligatorios, una sesión financiera vigente y cero altas nuevas; el expediente del perfil observado cubría cuatro de esos requisitos.
- `LoanScreen` vuelve a consultar requisitos, expediente y términos justo antes de confirmar. Si un requisito ya no está cubierto, conserva monto/destino/firma, regresa a `Documentos` y enumera los documentos faltantes; si Edge responde `REQUIRED_DOCUMENTS_MISSING`, aplica el mismo estado controlado en vez del mensaje genérico.
- La reutilización vigente no cambió: `PENDING_REVIEW`, `UNDER_REVIEW` y `VERIFIED` siguen siendo aceptados. Tampoco cambió la regla de solicitudes concurrentes, la idempotencia, los requisitos configurados por Administración, Supabase, RPC/RLS, cálculos financieros, Google ni Apps Script.
- La pantalla de éxito aprobada permanece completa. Chrome real `430×900` verificó monto, folio, cuatro etapas, Historial/Inicio, cero overflow y 42 piezas de confeti. Bundle `v165`, caché PWA `v109`; suite estática global 57/57 `PASS`.

```text
H-LOAN-SUBMISSION-DOCUMENT-PREFLIGHT-001 RESULT
Status: PASS
Files changed: pantalla Préstamo; bundle/cache; pruebas de preflight/cache; Registry y esta bitácora
Source-of-truth verdict: SAFE — requisitos, documentos y términos continúan únicamente en Supabase; la UI sólo vuelve a leer antes del writer
Invariant verdict: PASS — INV-012, INV-015, INV-063–066, INV-097–099, INV-108, INV-120 e INV-121 preservadas
Build: PASS — bundle reproducible desde 92 fuentes con Babel Standalone 7.29.0; node --check app/bundle.js y sw.js
Tests: PASS — 57/57 suite estática; pruebas focalizadas de solicitud repetida/documentos/snapshot/Phase 7; Chrome real de confirmación y solicitudes repetidas
Security: PASS — sin nuevos permisos, secretos, grants, RPC ni confianza en UI; backend conserva el rechazo autoritativo
Legacy impact: READ ONLY / NO INTERACTION — diagnóstico Supabase de solo lectura; Google/Apps Script 0 lecturas, 0 escrituras y 0 cambios
Unexpected files changed: se preservaron todos los cambios preexistentes; no quedó el script diagnóstico temporal
Known limitations: no se creó una solicitud financiera productiva de prueba; los documentos actualmente configurados como obligatorios no fueron modificados
Evidence: scripts/test-loan-submission-success.js; scripts/test-static-suite.js; scripts/test-repeat-program-requests-browser.js; docs/qa/evidence/loan-submission-success-20260829/loan-success-430x900.png
```

## 2026-08-29 — H-REQUEST-SUBMISSION-SUCCESS-001

- Se restauró la confirmación posterior al envío como pantalla completa: check de éxito, folio real, resumen, `¿Qué sigue?`, timeline, `Seguir mi solicitud`, `Volver al inicio` y confeti no bloqueante de tres pasadas. En préstamo conserva además el monto confirmado y las etapas aprobadas de revisión documental, autorización y depósito vía nómina.
- El patrón quedó compartido por préstamo, solicitudes de beneficios, solicitudes de cotización y membresías; cada flujo presenta etapas coherentes con su proceso existente. Ahorro Voluntario y Portafolio de Inversión continúan excluidos porque no crean solicitudes productivas.
- La pantalla sólo proyecta el resultado ya creado. No escribe estados, no calcula importes, no cambia idempotencia, Supabase, RLS, RPC, documentos, Google, Apps Script ni reglas financieras. La preferencia de movimiento reduce únicamente la celebración, nunca oculta la confirmación.
- Chrome real `430×900`: monto `$20,000`, folio `SF-2947`, cuatro etapas, 42 piezas de confeti, cero overflow y navegación a Historial/Inicio `PASS`; las variantes beneficio/cotización/membresía también montaron su pantalla y timeline compartidos.

```text
H-REQUEST-SUBMISSION-SUCCESS-001 RESULT
Status: PASS
Files changed: componente de confirmación compartido; integraciones préstamo/catálogo/marketplace/membresía; builder/bundle/cache; pruebas y evidencia; Registry e INV-121
Source-of-truth verdict: SAFE — sólo proyección efímera del registro recién creado; program_requests y autoridades existentes sin cambios
Invariant verdict: PASS — INV-015, INV-063–066, INV-097–099, INV-120 e INV-121 preservadas
Build: PASS — bundle reproducible desde 92 fuentes con Babel Standalone 7.29.0; node --check app/bundle.js y sw.js
Tests: PASS focalizadas/Claude/browser; suite estática global 56/57 con la única falla preexistente de comillas en test-pages-deployment.js
Security: PASS — sin nueva lectura/escritura, permiso, secreto, rol ni decisión de autorización frontend
Legacy impact: NO INTERACTION — Google/Apps Script/cálculos/tasas/saldos/fórmulas 0 lecturas, 0 escrituras y 0 cambios
Unexpected files changed: SutiApp.html reformateado y dos evidencias Admin Financial Requests eran cambios preexistentes; sólo la línea cachebuster de SutiApp.html pertenece a este cierre
Known limitations: no se creó una solicitud productiva de prueba; el componente se validó en navegador aislado con datos sintéticos y los writers existentes permanecieron cubiertos por sus contratos
Evidence: scripts/test-loan-submission-success.js; scripts/test-loan-submission-success-browser.js; docs/qa/evidence/loan-submission-success-20260829/loan-success-430x900.png
```

## 2026-08-29 — H-REPEAT-PROGRAM-REQUESTS-001

- Se retiraron los dos bloqueos visuales que sustituían el CTA por `Esperando cotización`. Una solicitud pendiente ahora conserva su folio/estado informativo y ofrece `Solicitar otra cotización`; una cotización lista conserva tanto `Nueva cotización` como `Simular monto`.
- `program_requests` continúa como autoridad única. No cambiaron schema, RPC, RLS, grants ni writers: una clave repetida deduplica el mismo envío y una clave nueva crea una intención distinta. Membresía y préstamo ya aceptan documentos `PENDING_REVIEW`, `UNDER_REVIEW` o `VERIFIED` y no consultan solicitudes activas para bloquear otra.
- Ahorro Voluntario y Portafolio de Inversión permanecen fuera de esta habilitación: no recibieron writer, persistencia ni cambio funcional. Google, Apps Script, fórmulas, criterios, tasas, saldos y cálculos financieros tuvieron cero lecturas/escrituras/cambios.
- Browser real aislado: `PASS` para CTA pendiente habilitado, copy informativo y dos acciones cuando la cotización está lista. Supabase reversible: `PASS` para dos filas distintas del mismo programa/objetivo con claves nuevas, idempotencia con la misma clave, RLS cross-user 0, insert directo 403, columna sensible 403, identidad falsa 404 y cleanup. El catálogo live tiene 135 destinos solicitables, pero sólo un `program_key` no financiero; por eso el cruce live entre dos programas no financieros no fue ejecutable sin crear catálogo productivo artificial.

```text
H-REPEAT-PROGRAM-REQUESTS-001 RESULT
Status: PASS
Files changed: dos pantallas de catálogo/cotización; bundle/cachebuster/PWA; pruebas focalizadas/live/browser; ADR-074, INV-120 y esta bitácora
Source-of-truth verdict: SAFE — program_requests único; sin fallback, store paralelo o nueva autoridad
Invariant verdict: PASS — INV-063–066, INV-073, INV-097–099, INV-108 e INV-120 preservadas
Build: PASS — bundle reproducible desde 91 fuentes; node --check app/bundle.js
Tests: PASS — focalizada estática, browser real y Supabase reversible; suite global 55/56 con una falla preexistente de comillas en SutiApp.html/test-pages-deployment.js
Security: PASS — Auth/identidad derivada, RLS, grants y RPC sin cambios; cross-user 0; secretos frontend 0
Legacy impact: NO INTERACTION — Google/Apps Script/finanzas legacy 0 lecturas, 0 escrituras y 0 cambios
Unexpected files changed: SutiApp.html y dos evidencias Admin Financial Requests eran cambios preexistentes; esta H sólo actualizó una línea cachebuster dentro de SutiApp.html
Known limitations: producción sólo expone un program_key no financiero para la matriz live; el cruce entre programas queda cubierto por ausencia de unicidad/gate global y por flujos UI independientes, sin fabricar fixtures catalogales
Evidence: scripts/test-repeat-program-requests.js; scripts/test-repeat-program-requests-browser.js; scripts/test-program-requests-live.py; C:\\tmp\\sutiapp-repeat-program-requests.png
```

## 2026-08-27 — ADMIN AFILIADOS / ACCIONES EN ENCABEZADO

- `Editar información`, `Cambiar estado / reactivar` y `Eliminar usuario` se movieron del pie del perfil al encabezado superior solicitado. Conservan los mismos callbacks, permisos `affiliates.write`, baja reversible y confirmaciones; no se duplicaron acciones ni se modificó Supabase.
- El encabezado distribuye y envuelve los controles dentro de su propia área. En móvil ocupa una fila superior completa y permanece sticky; la fecha de actualización se conserva junto a la identidad.
- Bundle `v161` y caché PWA `v105`. Chrome real verificó los tres controles dentro del encabezado, sin overflow, en 1024×768, 1280×900, 1440×1000 y 430×932; edición, baja reversible y carga documental siguen operativas.

```text
ADMIN AFILIADOS / ACCIONES EN ENCABEZADO RESULT
Status: PASS
Files changed: pantalla Afiliados; bundle/cache; pruebas/evidencia; esta bitácora
Source-of-truth verdict: NOT APPLICABLE — layout únicamente; public.affiliates y repositories sin cambios
Invariant verdict: PASS — ADR-071/073 y baja reversible preservadas
Build: PASS — bundle reproducible desde 91 fuentes; node --check PASS
Tests: PASS — contratos focalizados y Chrome real en cuatro viewports
Security: PASS — permisos/callbacks existentes sin cambios; normal/anónimo denegados por la matriz real
Legacy impact: NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE
Unexpected files changed: SutiApp.html reformateado y dos evidencias Financial Requests eran cambios preexistentes; sólo se añadió el cachebuster v161 al HTML
Known limitations: el Registry permanece STALE por cambios amplios del repositorio; este ajuste CSS no requiere actualización estructural
Evidence: docs/qa/evidence/admin-affiliates-20260827/playwright-result.json
```

## 2026-08-27 — H-ADMIN-AFFILIATES-MODULE-001

- Se sustituyó la tarjeta básica “Identidad y expediente” por el módulo productivo Admin “Afiliados”: padrón server-side, búsqueda/filtros/orden/paginación, perfil por pestañas, alta, edición, baja/reactivación, duplicados, auditoría, relación Auth y asistencia autorizada.
- `public.affiliates` sigue siendo el único maestro. La migración aplicada preservó 947 históricos y 3 cuentas Auth; las altas Admin usan procedencia explícita sin coordenadas fabricadas. Expediente y solicitudes enlazan a los workbenches existentes, sin duplicarlos ni tocar Google/Apps Script/finanzas legacy.
- “Exportar Excel” reutiliza el Edge `data-exports`, permiso `data_exports.read`, allowlist, `no-store` y auditoría. El motor XLSX pasó su matriz live; por privacidad, la prueba de Afiliados no descargó ni guardó PII localmente.
- Suite estática: módulo y 52 regresiones PASS; `test-pages-deployment.js` continúa FAIL únicamente por el `SutiApp.html` preexistente modificado fuera de esta H (comillas del registro del service worker). CRUD transaccional PASS con rollback y escrituras persistentes 0. Chrome real PASS en 1024/1280/1440/430, sin overflow ni escrituras inesperadas.
- El archivo de referencia “Afiliados - demo.html” citado en la especificación no estaba adjunto ni existe en el repo; se preservó el shell Admin Claude y todos los componentes funcionales exigidos por el texto entregado.

```text
H-ADMIN-AFFILIATES-MODULE-001 RESULT
Status: PASS
Files changed: módulo/repository Admin Afiliados; integración Admin/Documentos/Solicitudes/Finanzas; bundle/builder; migración/recovery; tests; gobierno y evidencia
Source-of-truth verdict: PASS — public.affiliates único; XLSX derivado
Invariant verdict: PASS — INV-116..119
Build: PASS — 93 fuentes
Tests: PASS módulo/static/SQL rollback/Chrome/XLSX; 1 FAIL preexistente ajeno en pages deployment
Security: PASS — permisos backend, RLS, normal/anónimo denegados, secretos expuestos 0
Legacy impact: NOT APPLICABLE — Google/Apps Script/finanzas legacy 0 cambios
Unexpected files changed: SutiApp.html y dos evidencias financieras preexistentes, preservados y no incluidos
Known limitations: demo HTML citado no disponible; export Afiliados no descargado durante QA para no persistir PII
Evidence: docs/qa/H-ADMIN-AFFILIATES-MODULE-001-EVIDENCE.md
```

## 2026-08-27 — H-MEMBERSHIP-REQUEST-UI-CUTOVER-001

- `Solicitud de membresía` adoptó el HTML aprobado: héroe guinda compacto, sello y logo administrados, cifras reales, tracker sobrepuesto, segmentos/chips dinámicos, documentos en cuadrícula 2×N, datos del afiliado, privacidad y CTA inferior fijo. La variante visual de teselas es opt-in; Mis Documentos y Suti Préstamo conservan su lista anterior.
- La funcionalidad productiva no cambió: `membership_offerings`, requisitos configurables, expediente/Storage privado, URLs firmadas, estados/reemplazo autorizado, términos, RPC idempotente `create_membership_request`, snapshot documental, Admin e Historial permanecen en sus repositorios y RLS actuales. El tracker cuenta solo requisitos `required` y cada campo realmente válido; CURP se precarga desde `affiliates.curp_raw`.
- Chrome real con H005_TEST2/H005_TEST3 verificó datos Admin exactos, 4 requisitos dinámicos, 4 previews privados existentes, estados 7/7 y 6/7, chip CURP y chip Teléfono generado, validación visible, Atrás, footer fijo, grid de dos columnas y cero overflow en 390×844, 430×932 y 768×1024. Las 12 capturas versionadas ocultan por completo previews y valores personales.
- Las seis membresías productivas tienen cero versiones de términos publicadas. El CTA permanece correctamente cerrado y el arnés ejecutó cero escrituras; no se inventó contenido legal ni una solicitud de prueba. Por esa configuración preexistente no fue posible certificar un submit live, aunque la RPC, idempotencia, documentos y navegación a Historial quedaron preservados por contrato y regresión estática.
- Google Sheets, Apps Script, solicitudes históricas, nómina, fórmulas, cálculos y conciliaciones: `NO READ / NO WRITE / NO CHANGE`.

```text
H-MEMBERSHIP-REQUEST-UI-CUTOVER-001 RESULT
Status: PASS
Files changed: Membership application UI; opt-in document tiles; generated bundle; focused static/browser tests; redacted QA evidence; Architecture Registry; changelog
Source-of-truth verdict: SAFE — membership, requirements, expediente, profile snapshot, terms and request authorities unchanged; no demo/local persistence
Invariant verdict: PASS — INV-015, INV-045, INV-050, INV-063–066 and INV-097–099 preserved
Build: PASS — bundle reproducible from 91 source files
Tests: PASS — focused/static regressions; Chrome real with two controlled users at 390/430/768
Security: PASS — private previews remain signed; RLS/RPC/identity unchanged; evidence contains no PII; Supabase writes 0
Legacy impact: READ ONLY BOUNDARY / NO READ / NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable to this H; two pre-existing admin-financial evidence modifications excluded
Known limitations: all 6 membership offerings lack published terms, so live submit/Admin/History creation remains fail-closed and was not executed
Evidence: scripts/test-membership-request-ui-cutover*.js; scripts/test-required-document-uploads-browser.js; docs/qa/evidence/membership-request-ui-cutover-20260827/*
```

## 2026-08-27 — H-SUTI-INVERSION-SCREEN-001

- `Mi Financiera → Invertir` abre la nueva ruta full-screen `investment` y Atrás usa el stack vigente para volver a Mi Financiera. El HTML aprobado se convirtió a `InvestmentScreen` conservando hero guinda, sello institucional, tarjeta de tasa, facts, calculadora, monto editable, slider, seis presets, cuatro plazos, resultado navy, barras variables, secciones informativas, disclaimer y footer fijo.
- El cálculo ilustrativo es simple y exacto: `amount × 0.025`, multiplicado por meses, sin interés compuesto. Vive sólo en estado React; no usa `localStorage`, Google, Supabase, Edge, RPC, Financial Resolver ni writer. El CTA permanece informativo y no abre WhatsApp ni crea una inversión.
- ADR-070/INV-115 registran la excepción presentacional autorizada sin cambiar la autoridad legacy de inversión. Suti Préstamo, Admin y las 146 reglas/35 fondos/3 programas permanecen intactos.
- Suite estática completa `52/52 PASS`. La automatización Chrome alcanzó y capturó 390×844, 430×932 y 768×1024 después de validar defaults, los tres casos matemáticos, slider, edición directa, presets y 6/12/18/24; las capturas no muestran overflow horizontal. La ejecución fue interrumpida después de las capturas, por lo que CTA/Atrás conservan evidencia estática, no un resultado final de consola del arnés.

```text
H-SUTI-INVERSION-SCREEN-001 RESULT
Status: PASS
Files changed: Investment screen; Mi Financiera action; router; reproducible bundle/PWA; focused tests; ADR/invariant/authority/architecture/changelog/Registry; three browser captures
Source-of-truth verdict: SAFE — operational investment remains protected legacy; simulator is ephemeral presentation-only with no fallback or persistence
Invariant verdict: PASS — ADR-070/INV-115; Suti Préstamo invariants and resolver untouched
Build: PASS — bundle reproducible from 91 source files, identical SHA-256 B756CCB835313A08EEE681DD83C1A006BB8809A0BC1695435A7C8421E7075DDC
Tests: PASS — static suite 52/52; Chrome assertions and captures through 390/430/768; final harness log interrupted after captures
Security: PASS — no secrets, backend authorization surface, external navigation or productive writer added
Legacy impact: NO READ / NO WRITE / NO CHANGE
Unexpected files changed: 0; two pre-existing admin-financial evidence modifications excluded from this H
Known limitations: CTA and Atrás were verified statically; the interrupted Chrome run did not emit its final console result after producing all three captures
Evidence: scripts/test-suti-investment-screen.js; scripts/test-suti-investment-screen-browser.js; docs/qa/evidence/suti-investment-screen-20260827/*.png; static suite output 52/52
```

## 2026-08-27 — H-HOME-NEWS-AFTER-COMMITTEE-001

- Se reordenó exclusivamente la composición de Inicio a `Banner → Tu sindicato → Comité Ejecutivo Estatal → Noticias`. El bloque completo de Noticias —encabezado, acción “Ver todas”, estados y carrusel— queda después de las tarjetas del Comité.
- No cambiaron los componentes internos, contenido, rutas, navegación, repositories ni autoridades Supabase de Noticias o Comité.
- Chrome real certificó el orden completo en 390×844 y 430×932, con overflow horizontal 0. Suite estática 50/50.

```text
H-HOME-NEWS-AFTER-COMMITTEE-001 RESULT
Status: PASS
Files changed: Home block order; generated bundle/cache; focused tests; changelog/Registry
Source-of-truth verdict: PASS — news and directory Supabase authorities unchanged
Invariant verdict: PASS — owner-authorized order only; all sections and interactions preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — static 50/50; Chrome real 390×844 and 430×932
Security: NOT APPLICABLE — no Auth, permission, RLS, backend or data change
Legacy impact: NO INTERACTION
Unexpected files changed: 0
Known limitations: none
Evidence: scripts/test-home-banner-expansion.js; scripts/test-home-banner-expansion-browser.js; scripts/test-static-suite.js
```

## 2026-08-27 — H-HOME-BANNER-EXPANSION-001

- En Inicio se eliminó exclusivamente la franja superior de cuatro accesos rápidos: Préstamo, Credencial, Convenios y Documentos. Sus pantallas, rutas, navegación inferior y las tarjetas de “Tu sindicato” permanecen intactas.
- El carrusel de banners pasó de 122 a 224 px y ahora ocupa primero el espacio liberado. La misma altura aplica a estados loading/error/loaded; se preservaron recorte `cover`, swipe, rotación, indicadores, ampliación y enlaces seguros.
- La autoridad sigue siendo Supabase mediante `BannerRepository → public.banners/app_assets/Storage`; no hubo cambios de datos, Repository, RLS, Admin, finanzas, Google ni Apps Script.
- Chrome real certificó 390×844 y 430×932 con overflow horizontal 0, banner 224 px, franja rápida ausente e indicadores funcionales. Suite estática 50/50.

```text
H-HOME-BANNER-EXPANSION-001 RESULT
Status: PASS
Files changed: Home screen; generated bundle/cache; focused static/browser tests; changelog/Registry
Source-of-truth verdict: PASS — Supabase banner authority preserved without fallback or duplicate store
Invariant verdict: PASS — only the four owner-authorized Home shortcuts were removed; target routes remain intact
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — static 50/50; Chrome real 390×844 and 430×932
Security: NOT APPLICABLE — no Auth, permission, RLS, backend or data write change
Legacy impact: NO INTERACTION / GOOGLE CALLS 0 / GOOGLE WRITES 0 / APPS SCRIPT CHANGES 0
Unexpected files changed: 0
Known limitations: banner images retain intentional `cover` cropping at the taller aspect ratio
Evidence: scripts/test-home-banner-expansion.js; scripts/test-home-banner-expansion-browser.js; scripts/test-static-suite.js
```

## 2026-08-27 — H-LOAN-QUOTE-STATE-GUARD-001

- Se reprodujo en Suti Préstamo la mezcla semántica de la captura: al cambiar el monto de `$5,000` a `$3,300`, la tarjeta conservaba importes exactos del quote anterior mientras mostraba `Actualizando…`.
- `StepSimulatorV2` ahora proyecta exclusivamente un resultado que coincide con fondo, monto y plazo actuales. Durante recálculo/error mantiene la estructura y feedback, pero no expone importes anteriores; el CTA permanece no vigente hasta confirmar el nuevo quote.
- Una respuesta `READY` cuyo monto, plazo o programa no coincide ya no cae entre ramas ni deja un spinner huérfano: falla cerrado como `SIMULATION_RESPONSE_MISMATCH` y ofrece reintento. No cambiaron Repository, RPC, Supabase, resolver, tasas, reglas, Google ni Apps Script.
- Chrome real 390×844 certificó `$5,000 → $3,300`, labels stale 0, latest quote only y mismatch `ERROR + Reintentar`; el flujo real Supabase pasó con máximo una petición concurrente y llamadas Google 0. Suite estática 49/49.

```text
H-LOAN-QUOTE-STATE-GUARD-001 RESULT
Status: PASS
Files changed: LoanScreen state projection; bundle/cache; focused browser/static tests; changelog/Registry
Source-of-truth verdict: PASS — Supabase criteria/snapshot/RPC preserved; no fallback or calculation frontend
Invariant verdict: PASS — only the exact current server quote is actionable or visible as a result
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — static 49/49; focused Chrome mobile; live Supabase auto-recalculation flow
Security: NOT APPLICABLE — no auth, permission, RLS or backend change
Legacy impact: READ ONLY / GOOGLE CALLS 0 / GOOGLE WRITES 0 / APPS SCRIPT CHANGES 0
Unexpected files changed: 0
Known limitations: the broad loading harness retains a pre-existing host-sensitive 200 ms scheduling gate; focused and live browser contracts pass
Evidence: scripts/test-loan-stale-quote-browser.js; scripts/test-loan-auto-recalc-browser.js; scripts/test-static-suite.js
```

## 2026-08-27 — H-FINANCIAL-SUPABASE-CUTOVER-AUTONOMOUS-001

- Se resolvió el FAIL previo mediante un canary shadow que ejercitó el bundle Edge exacto antes de cambiar autoridad, con diagnóstico sanitizado y gate de readiness. El canary A/B pasó para 146 reglas, dos perfiles distintos y cuatro cotizaciones, sin diferencias de elegibilidad, programa, fondo, tasa, monto, plazo, fecha o visibilidad.
- El retry atómico activó Supabase como autoridad única con 3 programas, 35 fondos, 146 reglas, 2 grupos duplicados, 1 conflicto y hash `174F940E195DE5DAE595AAF798CC1B49976AA899E76D6CF141FB9D711A6E9C8A`. A/B/C/D/E/F/H/N/P fueron equivalentes; G/I/J/K/L/M/O quedaron fuera y L se clasificó como cálculo auxiliar legacy no consumido.
- `financial-legacy` v25 y `financial-criteria-admin` v10 están activos con JWT. El canary Edge y su RPC shadow se eliminaron después del PASS. Apertura, interacción y confirmación financiera reportan 0 lecturas Google; frontend math 0; Google writes 0; Apps Script changes 0.
- Admin Programas/Fondos/Reglas quedó funcional con permisos granulares, versiones, publicación, auditoría y prueba CRUD transaccional con rollback total. Responsable no autorizado, usuario normal y anónimo quedaron denegados.
- Suti Préstamo pasó RPC live, perfiles, seguridad, Chrome desktop/móvil, cuatro recálculos, odómetro continuo, blank frames 0 y stale renders 0. Las cinco regresiones Admin protegidas pasaron en Chrome real; suite estática 49/49.

```text
H-FINANCIAL-SUPABASE-CUTOVER-AUTONOMOUS-001 RESULT
Status: PASS
Files changed: financial migrations/recoveries; Edge runtime/Admin; repository/Admin financial UI; tests; governance/evidence/Registry
Source-of-truth verdict: PASS — Supabase is the single productive financial-criteria authority; Google is historical provenance only
Invariant verdict: PASS — exact imported contract; no dual authority, fallback, frontend math or historical rewrite
Build: PASS — reproducible bundle from 90 source files; both Edge bundles compiled
Tests: PASS — 49/49 static; live equivalence/security/snapshot/CRUD; public and protected Admin Chrome regressions
Security: PASS — forced RLS; service-only runtime; granular Admin RPC; unauthorized/normal/anonymous denied; secrets/PII 0
Legacy impact: READ-ONLY SOURCE SNAPSHOT / GOOGLE WRITES 0 / APPS SCRIPT CHANGES 0
Unexpected files changed: 0 after restoring regenerated evidence from protected H tasks
Known limitations: productive append after approval remains an independent owner-controlled Phase 7 validation
Evidence: docs/FINANCIAL_SUPABASE_CUTOVER_RESULT.md
```

## H-ADMIN-FINANCIAL-REQUESTS-WORKBENCH-001 — 2026-08-26

- Se cerró, sólo para desktop, la bandeja `Admin → Finanzas → Solicitudes`: cola comparativa, filtros reales, detalle lazy persistente, snapshots contractuales almacenados, documentos privados bajo demanda, términos, timeline factual, navegación continua, teclado y feedback inline. A 1024/1280 usa cola compacta; a 1440 muestra la comparativa completa; móvil conserva su flujo secuencial.
- El workbench conserva `program_requests` y sus snapshots como única autoridad. No recalcula valores históricos, no crea responsables/bulk y no consulta Google al abrir cola o detalle. Las acciones existentes permanecen conectadas, pero esta certificación read-only no mutó solicitudes.
- Con autorización explícita del owner se aplicó `20260826000200`: dry-run PASS, recovery dry-run PASS, apply/status PASS, tres RPC read-only activos, conteos protegidos sin cambio y acceso directo a importe/snapshots todavía denegado al browser.
- Chrome real pasó 430/1024/1280/1440, seguridad Super Admin/capability/normal/anónimo/cross-user, lazy loading y refresh con writes 0. Suite estática 47/47 y regresión del shell Admin PASS; Google/Apps Script/fórmulas/reglas: 0 cambios.

```text
H-ADMIN-FINANCIAL-REQUESTS-WORKBENCH-001 RESULT
Status: PASS
Files changed: finance Admin/repository/store; applied migration/recovery/apply harness; generated bundle/cache; static/browser tests; evidence/governance/Registry
Source-of-truth verdict: PASS — same program_requests/snapshots and Google legacy authorities; no duplicate store or fallback
Invariant verdict: PASS — immutable snapshots only; legacy rows without snapshot remain visibly unavailable
Build: PASS — reproducible bundle from 90 source files
Tests: static 47/47 PASS; real Chrome financial workbench and Admin shell PASS
Security: PASS — live RPC/capability/RLS matrix; direct financial columns and anonymous denied
Legacy impact: NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable outside declared scope
Known limitations: no separate financial-responsible authority and no controlled owner row with stored snapshot; neither was invented
Evidence: docs/qa/H-ADMIN-FINANCIAL-REQUESTS-WORKBENCH-001-EVIDENCE.md; docs/qa/evidence/admin-financial-requests-workbench-20260826/
```

## 2026-08-27 — H-FINANCIAL-SUPABASE-CUTOVER-001

- Modelo Supabase y shadow import aplicados: 3 programas, 35 fondos y 146/146 reglas; equivalencia A/B/C/D/E/F/H/N/P PASS; G/I/J/K/L/M/O excluidos; duplicados 2 y conflicto 1 preservados.
- El primer canary posterior al cutover devolvió `502 FINANCIAL_CRITERIA_UNAVAILABLE`. Se aplicó fail-closed inmediatamente: authority `GOOGLE_SHADOW`, motores SQL legacy y ambas Edge Functions pre-cutover restaurados; runtime Google 146 reglas/seis perfiles PASS.
- Google writes 0, Apps Script changes 0, snapshots históricos preservados. Suite estática 49/49 y regresiones protegidas PASS, pero el canary de cutover obliga a `FAIL` global.
- No hubo commit ni push. Evidencia: `docs/FINANCIAL_SUPABASE_CUTOVER_RESULT.md`.

```text
H-FINANCIAL-SUPABASE-CUTOVER-001 RESULT
Status: FAIL
Files changed: shadow migration/recovery; financial Edge/frontend/Admin foundation; tests; derived Registry; failure evidence
Source-of-truth verdict: PASS fail-closed — Google restored as sole productive authority; Supabase remains shadow only
Invariant verdict: FAIL for requested cutover; recovery and historical preservation PASS
Build: PASS — reproducible bundle from 90 sources
Tests: FAIL overall — static 49/49 and protected regressions PASS; post-cutover Edge canary FAIL
Security: PASS — forced RLS; browser table access denied; service boundary verified
Legacy impact: READ ONLY / GOOGLE WRITES 0 / APPS SCRIPT CHANGES 0
Unexpected files changed: 0 after restoring generated evidence of closed H tasks
Known limitations: exact Edge integration cause remains unresolved; reactivation prohibited until shadow canary passes
Evidence: docs/FINANCIAL_SUPABASE_CUTOVER_RESULT.md
```

## H-ADMIN-REQUESTS-WORKBENCH-001 — 2026-08-26

- `Admin → Solicitudes` incorpora sólo en desktop una bandeja operativa de tabla + detalle persistente: búsqueda/filtros reales, tracking autoritativo lazy con fallback factual, documentos lazy, feedback inline, navegación continua y teclado seguro.
- `program_requests` y `ProgramRequestRepository` siguen siendo la única autoridad. La actualización usa la RPC existente, exige readback antes del éxito y se refleja en el Historial desde la misma fila; `DATA_MAPPING.md` quedó alineado con ADR-038 y no hay store, mock, `DATA`, localStorage, fallback ni solicitudes duplicadas.
- El modelo no ofrece responsable/asignación por solicitud, observación administrativa separada ni batch atómico; se reportan respectivamente `N/A`, `N/A` y `BULK_NOT_AUTHORIZED`, sin inventar UI o estados.
- Chrome/Supabase real pasó 430/1024/1280/1440, filtros, selección, detalle/timeline, Guardar y siguiente, refresh, Historial y denegaciones normal/anónima/cruzada. El entorno no tenía workflow `request` enlazable (`N/A_NO_TRACKING_FIXTURE`), por lo que no se inventó una etapa. La única write browser observada fue `update_program_request` sobre fixture reversible y el cleanup final quedó en cero.
- Móvil conserva cards, acciones y bottom navigation. Finanzas, Google, Apps Script, cálculos, snapshot, Document Workbench y shell Admin permanecen sin cambios funcionales.

```text
H-ADMIN-REQUESTS-WORKBENCH-001 RESULT
Status: PASS
Files changed: request repository/workbench; History consumer/mapping; generated bundle/cache; task/static/browser tests; evidence/changelog; derived Architecture Registry
Source-of-truth verdict: PASS — program_requests remains the single authority; no duplicated authority or fallback
Invariant verdict: PASS — authorization, identity, historical integrity, mobile contract and cross-domain boundaries preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — task/static suite; Registry; real Chrome/Supabase responsive/action/security matrix
Security: PASS — program_requests.write UI projection plus backend RPC/RLS; normal, anonymous and cross-user denied
Legacy impact: NOT APPLICABLE / NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable to this H
Known limitations: responsible/assignment and independent admin observation are N/A; safe bulk NOT_AUTHORIZED; unavailable browser projections are explicit
Evidence: docs/qa/H-ADMIN-REQUESTS-WORKBENCH-001-EVIDENCE.md; docs/qa/evidence/admin-requests-workbench-20260826/
```

## H-ADMIN-DOCUMENT-WORKBENCH-001 — 2026-08-26

- `Admin → Documentos y credencial` incorpora exclusivamente en desktop una bandeja operativa de dos columnas a `1024px` y tres a `1280/1440`: cola filtrable, preview persistente bajo demanda, decisión contextual y navegación continua.
- Operación quedó separada de Catálogo/Requisitos/Términos/QR. El catálogo usa labels humanos, código técnico secundario y orden drag/drop/numérico con la persistencia canónica existente.
- La consulta inicial sólo trae metadata; la signed URL privada de 300 segundos se solicita para el documento seleccionado. Autoridades, Auth, RLS, Storage y capabilities existentes permanecen sin cambios; no hay store, mock, `DATA` ni fallback nuevo.
- Chrome/Supabase real pasó 1024/1280/1440 y preservación móvil 430, approve/reupload, refresh, filtros, preview, orden y denegación normal/anónima/cruzada. Todos los fixtures y objetos privados se restauraron/eliminaron con verificación final limpia.
- Bundle reproducido desde 90 fuentes; suite estática 45/45, shell regression, auditorías y Registry en `PASS`. Cache publicado como bundle `v149` y PWA `sutiapp-v93`.
- “100% del expediente” conserva la semántica actual sin invención y queda `OWNER_CLARIFICATION_REQUIRED` para definir su significado/label definitivo.

```text
H-ADMIN-DOCUMENT-WORKBENCH-001 RESULT
Status: PASS
Files changed: document repository/workbench source; generated bundle/cache versions; task tests; evidence/changelog; derived Architecture Registry
Source-of-truth verdict: PASS — same Supabase document/catalog authorities; 0 duplicate stores, caches or fallbacks
Invariant verdict: PASS — private assets, RLS, historical integrity, mobile contract and cross-domain boundaries preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — task/static suite 45/45; Registry; shell regression; real Chrome/Supabase matrix
Security: PASS — signed selected-only preview; UI capability plus backend/RLS denials verified
Legacy impact: NOT APPLICABLE / NO WRITE / NO CHANGE
Unexpected files changed: 0 attributable to this H; pre-existing dirty Admin artifacts preserved
Known limitations: OWNER_CLARIFICATION_REQUIRED for “100% del expediente”; no semantic invention
Evidence: docs/qa/H-ADMIN-DOCUMENT-WORKBENCH-001-EVIDENCE.md; docs/qa/evidence/admin-document-workbench-20260826/
```

## H-ADMIN-DESKTOP-SHELL-001 — 2026-08-26

- Se implementó un shell Admin exclusivo de desktop desde `1024px`, tomando `Panel administrativo.dc.html` sólo como referencia visual: sidebar oscuro agrupado, header, workspace fluido, panel contextual opcional y foundations accesibles de drawer/modal.
- El Admin móvil existente se conserva en 430×932 y 768×900. Desktop elimina únicamente en Admin el marco de 430px y la bottom nav; el resto de SutiApp no cambia de layout.
- Sidebar y menú comparten el catálogo actual de módulos y el contexto real `AdminRepository -> permissions/sectionActions`. Mobile y desktop reutilizan el mismo `view`, componentes, repositories y backend; no se copió dato o lógica demo ni se creó ruta/autoridad paralela.
- Playwright real pasó 430/768/1024/1280/1440, 12 módulos desktop con regreso, cuatro módulos móviles, proyección técnica/section ownership, drawer/modal con ARIA/foco/ESC y `productiveWrites=0`.
- Bundle reproducido desde 90 fuentes; suite estática canónica 44/44, Registry, auditoría y sintaxis fuente/bundle en `PASS`. HTML usa bundle `v148` y PWA `sutiapp-v92`.

```text
H-ADMIN-DESKTOP-SHELL-001 RESULT
Status: PASS
Files changed: SutiApp.html; app/app.jsx; app/screens-admin.jsx; app/bundle.js; sw.js; five compatible static assertions; browser harness; evidence; changelog; derived Architecture Registry
Source-of-truth verdict: PASS — same AdminRepository/Supabase authorities; 0 duplicate authorities, fallbacks or caches
Invariant verdict: PASS — INV-002/003/012/013/015/036/041 preserved
Build: PASS — bundle reproducible from 90 source files
Tests: PASS — canonical static suite 44/44; Registry suite; audit; source/bundle syntax; Playwright responsive/navigation/permissions/accessibility
Security: PASS — backend/RLS remains authoritative; desktop hides unauthorized modules; productive writes 0
Legacy impact: NOT APPLICABLE / NO INTERACTION
Unexpected files changed: 0 produced by this H; prior untracked Admin audit evidence preserved
Known limitations: module-level desktop workbenches remain separate future work; context panel/drawer/modal are foundations only
Evidence: docs/qa/H-ADMIN-DESKTOP-SHELL-001-EVIDENCE.md; docs/qa/evidence/admin-desktop-shell-20260826/
```

## H-LOAN-AUTHENTICATED-SNAPSHOT-RPC-013 — 2026-08-26

- La decisión explícita del propietario autorizó una RPC Auth únicamente para monto/fondo/plazo sobre el snapshot personalizado de 15 minutos. Google conserva autoridad y apertura/confirmación Edge; no existe fallback RPC→Edge→Google.
- `SUTI_LOAN_QUOTE_V1` quedó centralizado en un resolver SQL `numeric` usado tanto por la RPC como por Edge. La matriz live cubrió 54 casos financieros y 8 inválidos sobre dos perfiles distintos con 0 diferencias financieras, de validación o redondeo.
- Seguridad negó cross-user bidireccional, anonymous, expirado, profile mismatch, impersonation mismatch e inputs tasa/máximo; la tabla mantiene 0 lectura/escritura browser. Forward y recovery pasaron dentro de `ROLLBACK`; la migración cambió 0 filas protegidas.
- GitHub Pages público pasó en escritorio y móvil 390×844: login/PWA/READY, monto, fondo, plazo y 10 cambios rápidos; RPC 4, Edge 0, Google 0, blank frames 0 y stale renders 0 en cada viewport.

```text
H-LOAN-AUTHENTICATED-SNAPSHOT-RPC-013 RESULT
Status: PASS
Files changed: migration/recovery; Edge; repository; loan retry; bundle/PWA; tests; authority/security/migration docs; Architecture Registry
Source-of-truth verdict: PASS — Google authority preserved; snapshot/RPC remain derived
Invariant verdict: PASS — INV-088/INV-107 updated only within owner-authorized exception
Build: PASS — bundle reproducible from 90 sources; v147/repository v5/PWA v91
Tests: PASS — static 44/44; 54 financial + 8 invalid live; local Chrome; public desktop/mobile
Security: PASS — Auth-only RPC; cross-user/anonymous/expired/profile/impersonation denied; direct snapshot access 0
Legacy impact: READ ONLY — open/confirm Google preserved; interactive Google 0; Google writes 0; Apps Script changes 0
Unexpected files changed: none
Known limitations: QA did not persist a successful loan; final Google fail-closed/atomic zero-persistence path was verified without contaminating history
Evidence: docs/AUTHENTICATED_LOAN_SNAPSHOT_RPC_RESULT.md; workflow 32987656026; RPC median 142 ms/max 178 ms; public blank/stale 0
```

## H-LOAN-EXPLICIT-TRANSPORT-RETRY-012 — 2026-08-26

- La validación pública de v145 probó que el cambio de fondo podía terminar, pero el cambio de importe agotaba expiraciones o recibía `Failed to send a request to the Edge Function`. La prueba de control con QUIC desactivado reprodujo el segundo fallo, por lo que HTTP/3 no era la única causa. En ambos casos el resultado anterior permaneció visible y `googleResolutionCount` fue 0.
- El coordinador ahora clasifica únicamente mensajes inequívocos de red/transporte como reintentables. Tanto una expiración como ese error explícito repiten `loanSessionQuote` contra el mismo `snapshot_id`, con el límite existente de cinco intentos; no abren sesión, no releen Google y no alteran fórmulas. Errores financieros, de autorización o de snapshot no se convierten en fallback.
- HTML/PWA avanzan a bundle v146 y cache v90. La prueba Chrome aislada verifica por separado recuperación tras timeout (6.7 s) y tras error explícito (0.95 s), en ambos casos con `loanSessionOpen = 0`, Google = 0 y odómetros visibles.

```text
H-LOAN-EXPLICIT-TRANSPORT-RETRY-012 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-personalized-financial-session-snapshot.js; docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — mismo snapshot Supabase de 15 minutos y mismo motor Edge; sin cálculo, caché o autoridad frontend
Invariant verdict: PASS — latest intent cancela; sólo la selección vigente renderiza; máximo cinco intentos acotados
Build: PASS — bundle reproducible desde 90 fuentes con Babel Standalone 7.29.0; HTML v146 y PWA v90
Tests: PASS — suite estática 43/43; contrato snapshot; Chrome real aislado para timeout y error explícito
Security: PASS — JWT y snapshot intactos; sin headers, secretos, service_role, schema, RLS ni permisos nuevos
Legacy impact: READ ONLY — Google inicial sin cambios; cotizaciones interactivas Google 0; fórmulas y writes 0
Unexpected files changed: ninguno; auxiliares temporales ignorados y eliminados antes del commit
Known limitations: si los cinco intentos fallan, queda error controlado con el resultado anterior y Reintentar; no se inventa un cálculo local
Evidence: test-static-suite.js 43/43; test-personalized-financial-session-snapshot.js; test-loan-result-loading-browser.js (`loanSessionOpen: 0`, `google_calls: 0`)
```

## H-LOAN-BROWSER-TRANSPORT-RECOVERY-011 — 2026-08-26

- La secuencia pública posterior a H-010 confirmó que dos intentos no bastaban. La comparación controlada aisló la frontera: desde Node/HTTP 1.1, 8/8 cotizaciones alternadas respondieron 200 en 669–1,483 ms; desde Chrome/HTTP 3 algunas solicitudes se cancelaron sin aparecer en `function_edge_logs`. Las que sí alcanzaron Supabase terminaron 200 en 0.5–3.9 s. Por tanto, el bloqueo ocurre antes del gateway Edge y no en Google, snapshot, política, nómina, cálculo ni Function.
- Sin cambiar dominio, DNS, CORS, Supabase, datos o fórmulas, cada intento de transporte queda limitado a 6 s y la última selección puede usar como máximo cinco intentos con 500 ms entre ellos. Todos repiten `loanSessionQuote` con el mismo snapshot; `loanSessionOpen` y Google permanecen en 0. Cualquier cambio de fondo/monto/plazo cancela de inmediato la secuencia anterior.
- El odómetro sigue reiniciando en cada selección y conserva dígitos durante toda la recuperación. HTML/PWA avanzan a bundle v145 y cache v89.

```text
H-LOAN-BROWSER-TRANSPORT-RECOVERY-011 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-personalized-financial-session-snapshot.js; docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — mismo snapshot Supabase de 15 minutos, mismo endpoint y resultado Edge; sin caché o cálculo paralelo
Invariant verdict: PASS — latest intent cancela; sólo la selección vigente puede renderizar; duración total acotada
Build: PASS — bundle reproducible desde 90 fuentes; HTML v145 y PWA v89
Tests: PASS — Chrome aislado timeout/recovery; suite estática 43/43; matriz directa Supabase 8/8
Security: PASS — JWT, actor/contexto y snapshot intactos; no se agregaron headers, secretos ni selectores
Legacy impact: READ ONLY — Google inicial 1; cotizaciones interactivas Google 0; writes 0
Unexpected files changed: ninguno; diagnósticos temporales ignorados y eliminados al cierre
Known limitations: si los cinco transportes fallan (~32 s), queda error controlado con resultado previo y Reintentar; resolver el origen HTTP/3 exigiría intervención de proveedor o dominio alterno
Evidence: function_edge_logs; matriz HTTP 1.1/HTTP 3; test-loan-result-loading-browser.js; googleResolutionCount 0
```

## H-LOAN-SNAPSHOT-TIMEOUT-RETRY-010 — 2026-08-26

- La validación Pages posterior a H-009 reprodujo el fallo intermitente real: varias cotizaciones `loanSessionQuote` respondieron en 0.6–3.1 s, pero una llamada idéntica quedó pendiente hasta que el cliente la abortó a los 10 s. La cotización previa seguía íntegra y no hubo respuesta financiera incorrecta; faltaba recuperación automática de transporte.
- Por corrección expresa del propietario, el timeout repite una sola vez la misma selección mediante `requestLoanSessionQuote` y el mismo snapshot personalizado vigente. No ejecuta `loanSessionOpen`, no renueva el TTL, no relee Google, no cambia reglas y no acepta respuestas obsoletas. Un cambio posterior continúa abortando el intento anterior; un error no-timeout o segundo timeout conserva resultado, aviso y `Reintentar`.
- La prueba Chrome instrumenta `openLoanSession` y exige `0` aperturas/`0` Google durante la recuperación. HTML/PWA avanzan a bundle v144 y cache v88.

```text
H-LOAN-SNAPSHOT-TIMEOUT-RETRY-010 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — mismo snapshot Supabase de 15 minutos y mismo motor Edge; cero autoridad o cálculo frontend
Invariant verdict: PASS — latest intent, máximo un request activo y descarte de respuesta obsoleta preservados
Build: PASS — bundle reproducible desde 90 fuentes con Babel Standalone 7.29.0; HTML v144 y PWA v88
Tests: PASS — Chrome timeout→mismo snapshot→resultado; loanSessionOpen 0; Google 0; suite estática 43/43
Security: PASS — mismo JWT/contexto/snapshot; sin selector de identidad, secreto o cambio RLS
Legacy impact: READ ONLY — apertura inicial existente; recuperación interactiva Google 0 y writes 0
Unexpected files changed: ninguno; arnés temporal ignorado y eliminado al cierre
Known limitations: la prueba Pages posterior mostró que dos intentos pueden no alcanzar el gateway; H-LOAN-BROWSER-TRANSPORT-RECOVERY-011 amplía la tolerancia sin abrir sesión ni leer Google
Evidence: test-loan-result-loading-browser.js; test-personalized-financial-session-snapshot.js; Chrome Pages instrumentado; googleResolutionCount 0
```

## H-LOAN-ODOMETER-RECOVERY-009 — 2026-08-26

- La captura del propietario demostró una regresión real: si una cotización automática fallaba, `ResultCard` reemplazaba todos los carretes por espacios vacíos, contradiciendo ADR-055. La reproducción pública exacta con la cuenta QA, `Caja Chica`, `$5,000` y `6 quincenas` respondió correctamente (`$998.33`, sin respuestas HTTP fallidas ni excepciones), por lo que no se modificó lógica financiera.
- Cada cambio válido de fondo, importe o plazo reinicia ahora los cinco odómetros inmediatamente usando el último resultado confirmado como destino visual mientras espera. La nueva cotización autoritativa conserva su ciclo propio al llegar. Un error mantiene ese resultado previo y `Reintentar`; si aún no existía resultado, los siete carretes de carga quedan visibles y detenidos después de un segundo en vez de desaparecer.
- Se actualizó ADR-055 y la cobertura Chrome para recálculo, fallo posterior a un resultado, fallo inicial, espera larga, reintento, cambios de fondo, cancelación latest-intent, timeout, reduced motion y documento oculto. HTML/PWA avanzaron a bundle v143 y cache v87.

```text
H-LOAN-ODOMETER-RECOVERY-009 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — el frontend sigue presentando exclusivamente FinancialSimulationResult; no calcula ni inventa importes
Invariant verdict: PASS — cada selección válida reinicia el odómetro, latest-intent permanece serializado y nunca hay tarjeta sin dígitos
Build: PASS — bundle reproducible desde 90 fuentes con Babel Standalone 7.29.0; node --check; HTML v143 y PWA v87
Tests: PASS — suite estática 43/43; Chrome aislado cubrió recálculo/error/reintento/no-gap; Pages reprodujo Caja Chica + $5,000 + 6 quincenas sin fallo HTTP
Security: PASS — sin cambios Auth, RLS, grants, secretos, claves, CORS o autoridad frontend
Legacy impact: READ ONLY — una sesión QA de simulación, cero Google writes y cero cambios Apps Script/Sheets/fórmulas
Unexpected files changed: ninguno; arnés temporal eliminado
Known limitations: una secuencia Pages posterior reprodujo un timeout de transporte aislado; su recuperación automática se corrige en H-LOAN-SNAPSHOT-TIMEOUT-RETRY-010
Evidence: test-loan-result-loading-browser.js; test-static-suite.js; Chrome Pages Caja Chica/$5,000/6; diff/check; Architecture Registry check
```

## H-GITHUB-PAGES-LOAN-CORS-003 — 2026-08-26

- Se reprodujo el fallo del simulador publicado: el preflight desde `https://david14081982.github.io` devolvía `403 ORIGIN_NOT_ALLOWED`, mientras los orígenes locales autorizados devolvían `204`.
- Se actualizó únicamente el Edge Secret productivo `ALLOWED_APP_ORIGINS`, conservando `http://localhost:8080` y `http://127.0.0.1:8080` y añadiendo el origen exacto de GitHub Pages. El valor no se imprimió ni se versionó.
- Chrome real sobre la URL pública confirmó login QA, overview con cinco fondos disponibles, simulación inicial, recálculo por monto, cinco respuestas CORS/Edge `204/200`, cero fallos de red, cero excepciones y logout.
- Un origen desconocido continúa en `403`; `financial-legacy`, `financial-criteria-admin` y `data-exports` continúan rechazando llamadas anónimas con `401`. No cambiaron frontend, Edge code, tasas, fondos, fórmulas, Google, RLS, permisos, datos ni Redirect URLs.

```text
H-GITHUB-PAGES-LOAN-CORS-003 RESULT
Status: PASS
Files changed: docs/AGENT_CHANGELOG.md; Supabase Edge Secret ALLOWED_APP_ORIGINS
Source-of-truth verdict: SAFE — Google/Supabase conservan sus autoridades; solo se habilitó el transporte desde el origen público exacto
Invariant verdict: PASS — cálculo server-side, JWT, RLS, actor/contexto, snapshot y cero fallback permanecen intactos
Build: NOT APPLICABLE — sin cambios de código ejecutable
Tests: PASS — CORS 204 para tres orígenes autorizados; simulación y recálculo live desde Pages; origen desconocido 403; anónimo 401
Security: PASS — allowlist exacta sin wildcard; secretos no impresos/versionados; backend sigue autenticando y autorizando
Legacy impact: READ ONLY — simulación QA autorizada, cero Google writes y cero cambios Apps Script/Sheets
Unexpected files changed: ninguno; arnés temporal eliminado
Known limitations: activación y recuperación por correo siguen fuera de esta corrección
Evidence: preflight 403 antes/204 después; Chrome Pages login→Finanzas→Préstamo→simulación→recálculo→logout
Recovery: restaurar ALLOWED_APP_ORIGINS a los dos orígenes locales previos revierte exclusivamente el acceso Pages
```

## H-GITHUB-PAGES-PUBLIC-DEPLOYMENT-002 — 2026-08-26

- Tras el bloqueo de GitHub Free para Pages en repositorios privados, el propietario autorizó expresamente hacer público `David14081982/SutiApp-private`.
- GitHub Pages se habilitó con HTTPS y workflow desde `main`; el artefacto usa una lista blanca y genera `app/supabase-config.js` durante Actions con la URL y clave publicable, sin incluir archivos locales, secretos administrativos, PII, docs, exports o backups.
- La URL productiva es `https://david14081982.github.io/SutiApp-private/`. No se modificaron dominio, DNS, Supabase Site URL, Auth redirect URLs, schema, RLS, Storage, Edge Functions, Google legacy ni código funcional.
- Chrome remoto confirmó pantalla de login, manifest y service worker `activated` con scope del proyecto. Un login QA real resolvió exactamente la fila propia por RLS y cerró sesión; HTML, bundle, configuración pública, repositories, manifest, service worker, iconos y branding respondieron HTTP 200.

```text
H-GITHUB-PAGES-PUBLIC-DEPLOYMENT-002 RESULT
Status: PASS
Files changed: .github/workflows/deploy-pages.yml; .gitignore; scripts/build-pages-site.js; scripts/test-pages-deployment.js; README.md; docs/AGENT_CHANGELOG.md; GitHub repository visibility/Pages settings/Actions secrets
Source-of-truth verdict: SAFE — Pages es entrega estática derivada; Supabase/Google y sus repositories conservan autoridad runtime
Invariant verdict: PASS — sin cambios de datos, Auth, RLS, permisos, cálculos, pantallas o navegación
Build: PASS — artefacto público reproducible mediante lista blanca
Tests: PASS — suite estática 43/43; Chrome live login UI + service worker activated; login QA + RLS own-row + logout; recursos principales HTTP 200
Security: PASS — cero secretos y cero PII reales versionados/desplegados; solo URL y publishable browser key de Supabase en runtime
Legacy impact: NOT APPLICABLE — cero lecturas/escrituras Google durante deployment
Unexpected files changed: ninguno; script temporal de Chrome eliminado
Known limitations: activación y recuperación por correo no se ejercieron; no se cambiaron Redirect URLs de Supabase
Evidence: gh repo view/pages/run; commit 8f88bfeb74cefdede7d71eafbad083618630bbd2; GitHub Actions run 32975307498; HTTPS resource matrix; Chrome service worker scope; Supabase QA login/RLS/logout
```

## H-GITHUB-PRIVATE-BASELINE-001 — 2026-08-25

- Se inicializó Git en `main` y se preparó el baseline privado sin modificar código funcional, datos, Supabase, Google legacy, hosting, dominio ni producción.
- El nombre `David14081982/SUTIAPP` ya existía con visibilidad pública y no fue tocado. Para evitar sobrescritura o publicación accidental se creó `David14081982/SutiApp-private` con visibilidad `PRIVATE`.
- `.gitignore` excluye credenciales y configuración runtime local, perfiles de navegador, uploads, capturas, logs, temporales, backups, Excel/CSV productivos y `docs/H003_AFFILIATE_RECONCILIATION.md`, que contiene PII real a nivel fila.
- `.env.example` contiene únicamente nombres requeridos y valores ficticios; `README.md` documenta configuración y ejecución local sin secretos.
- Antes del push, el detector encontró un CURP-like en el mock local y su bundle. Con autorización explícita del propietario se sustituyó por `CURP-DEMO-NO-REAL`, se regeneró el bundle y se avanzaron sus versiones de entrega sin cambiar estructura o comportamiento de pantalla.

```text
H-GITHUB-PRIVATE-BASELINE-001 RESULT
Status: PASS
Files changed: .gitignore; .env.example; README.md; app/data.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; docs/AGENT_CHANGELOG.md; metadata Git
Source-of-truth verdict: SAFE — GitHub es copia privada versionada; no sustituye autoridades runtime ni legacy
Invariant verdict: PASS — sin cambios funcionales, datos, Auth, RLS, Storage, Google o cálculos
Build: NOT APPLICABLE — código funcional intacto
Tests: PASS — Registry preflight FRESH; stale posterior limitado a copy/fixture y documentación sin cambio arquitectónico; exclusiones críticas verificadas; bundle reproducible; secret/PII scan sobre candidatos e índice staged
Security: PASS — cero secretos y cero PII real incluidos; repositorio remoto PRIVATE
Legacy impact: NOT APPLICABLE — cero lecturas/escrituras Google o financieras
Unexpected files changed: ninguno fuera del alcance declarado
Known limitations: el repositorio público preexistente David14081982/SUTIAPP permanece fuera de alcance e intacto; producción no desplegada
Evidence: gh auth status; gh repo view; git check-ignore; git status; git diff --cached --stat; staged secret/PII scan; push y validación remota
```

## H-LOAN-LATEST-INTENT-CANCELLATION-008 — 2026-08-25

- La queja live reveló una brecha no cubierta por el cierre anterior: `latest intent wins` descartaba el render obsoleto, pero la cola seguía esperando la petición anterior. Una llamada detenida podía bloquear monto, fondo y plazo durante el timeout de infraestructura.
- Cada nueva selección ahora aborta la cotización Edge anterior mediante `AbortSignal`; fondo y plazo siguen inmediatos, monto conserva exclusivamente su debounce de 320 ms y sólo la última selección puede actualizar el resultado.
- Cada cotización interactiva queda limitada a 10 segundos. Al vencer muestra el error controlado existente con `Reintentar`; no cae silenciosamente a Google, no calcula en frontend y conserva el valor anterior del odómetro mientras actualiza. Abortar al cambiar de pantalla restaura el store a `ready`, evitando dejar Home/Finanzas atrapados en `loading`.
- HTML/PWA avanzaron a bundle v141, Repository v4 y cache v85. El origen local activo entrega esas versiones.

```text
H-LOAN-LATEST-INTENT-CANCELLATION-008 RESULT
Status: PASS
Files changed: app/financial-legacy-repository.js; app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-personalized-financial-session-snapshot.js; scripts/test-home-header-collapsed.js; docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md; docs/AGENT_CHANGELOG.md; docs/architecture/*
Source-of-truth verdict: SAFE — Google continúa como autoridad y Edge usa el snapshot personalizado; cero cálculo/fallback financiero frontend
Invariant verdict: PASS — debounce de monto 320 ms, fondo/plazo inmediatos, valor anterior visible, latest intent real y error/retry preservados
Build: PASS — bundle reproducible desde 90 fuentes con Babel Standalone 7.29.0; node --check; HTML v141, Repository v4, PWA v85
Tests: PASS — suite estática 42/42; prueba Repository confirmó AbortSignal y restauración `ready`; Chrome aislado canceló una respuesta artificial de 120 s y mostró el último fondo en 296 ms; timeout controlado en 10,035 ms; Chrome live Supabase validó monto/fondo/plazo y 0 Google interactivo
Security: PASS — se conserva JWT/Auth/Edge, no se agregan secretos ni autoridad UI; AbortSignal sólo cancela el fetch del mismo actor
Legacy impact: READ ONLY / 0 GOOGLE INTERACTIVE / 0 GOOGLE WRITES / 0 APPS SCRIPT CHANGES
Unexpected files changed: ninguno dentro del alcance escrito; metadata Git ausente
Known limitations: la primera apertura continúa haciendo la única lectura Google autorizada; una pestaña que ya ejecutaba v140 requiere una recarga para cargar v141
Evidence: test-loan-result-loading-browser.js; test-loan-auto-recalc-browser.js; test-static-suite.js; HTTP localhost v141/v4; Architecture Registry check
```

## H-LOAN-ODOMETER-NO-GAP-006 — 2026-08-25

- Se eliminó el intervalo visual sin dígitos entre el carrete de carga y el odómetro del resultado. Tras sus seis vueltas y máximo de un segundo, los glifos de carga quedan visibles, enfocados y estáticos hasta recibir la cotización.
- El resultado confirmado conserva su propio ciclo del odómetro. No cambiaron fondo, monto, plazo, tasa, cálculos, Repository, Edge, Google, Supabase, Auth, RLS ni flujo de solicitud.
- ADR-055 registra la continuidad visible aprobada por el propietario. HTML/PWA avanzaron a bundle v139 y cache v83.

```text
H-LOAN-ODOMETER-NO-GAP-006 RESULT
Status: PASS
Files changed: app/motion.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — cambio exclusivamente visual; FinancialSimulationResult y autoridades financieras permanecen intactas
Invariant verdict: PASS — INV-055/057/087/088 y ADR-042/051 preservados; ADR-055 actualizado por decisión explícita del propietario
Build: PASS WITH LIMITATION — motion fuente/bundle sincronizado, node --check PASS, bundle v139 y PWA v83; Babel Standalone local continúa ausente
Tests: PASS — Chrome aislado en 100/1000/3000 ms; a 1150 ms de una espera de 3000 ms todos los tracks estaban detenidos, sin blur y visibles; suite estática completa PASS
Security: NOT APPLICABLE — sin cambios Auth/RLS/grants/RPC/secretos
Legacy impact: READ ONLY / NO GOOGLE INTERACTION / 0 WRITES
Unexpected files changed: ninguno fuera del alcance declarado; Registry ya estaba STALE por H-LOAN-INITIAL-ODOMETER-005
Known limitations: prueba de latencia con fixture local; no se consultó producción
Evidence: test-loan-result-loading-browser.js; test-loan-simulator-ui-cutover.js; node --check; Architecture Registry lookup
```

## H-LOAN-INITIAL-ODOMETER-005 — 2026-08-25

- `StepSimulatorV2` inicializa en el primer render el primer fondo `AVAILABLE`, su `suggested_amount` y el primer plazo permitido (o el mínimo personalizado) recibidos del overview autoritativo; no se agregaron montos, fondos, tasas, plazos ni cálculos locales.
- La primera selección y los cambios de fondo/plazo cotizan sin debounce. Los cambios de monto conservan 320 ms, cola serializada, descarte de respuestas obsoletas y un nuevo ciclo completo del odómetro por resultado confirmado.
- La consulta inmediata se inicia antes de construir los carretes de carga. En Chrome aislado comenzó en 14.2–122.7 ms; respuestas de 100 ms pasaron directo al odómetro real y esperas de 1–3 s conservaron carretes, error/reintento, reduced-motion, accesibilidad y cero salto de layout.

```text
H-LOAN-INITIAL-ODOMETER-005 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-loan-result-loading-browser.js; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — Google Criterios de fondos y Supabase loan_term_policy permanecen autoritativos; frontend sólo selecciona defaults recibidos y presenta FinancialSimulationResult
Invariant verdict: PASS — INV-055/057/087/088 y ADR-042/051/055 preservados; sin cálculo, mock, caché o fallback local
Build: PASS WITH LIMITATION — fuente/bundle exactos, node --check PASS, HTML bundle v138 y PWA v82; build-bundle abortó antes de escribir porque Babel Standalone no está instalado
Tests: PASS — test-static-suite 41/41; loan simulator, flexible assistance y declared payroll estáticos; Chrome aislado PASS en latencias 100/1000/3000 ms y primera llamada <200 ms
Security: NOT APPLICABLE — sin cambios Auth, RLS, grants, RPC, Edge, secretos o identidad
Legacy impact: READ ONLY / NO GOOGLE INTERACTION / 0 WRITES
Unexpected files changed: ninguno; Registry estaba FRESH al inicio y reportó sólo los cinco archivos tracked esperados antes de agregar esta evidencia; sw.js es cache shell fuera de esa lista
Known limitations: no se midió latencia productiva; los tiempos son de un fixture Chrome aislado. Registry queda STALE por hashes de esta microinteracción y no se regenera porque no cambiaron rutas, repositories, RPC, tablas, permisos, dependencias ni mappings de autoridad
Evidence: test-static-suite.js; test-loan-result-loading-browser.js; test-loan-simulator-ui-cutover.js; SOURCE_BUNDLE_EXACT_MATCH; Architecture Registry lookup
```

## H-LOAN-UX-CARDS-004 — 2026-08-25

- Se retiraron de `StepSimulatorV2` las cards “Impacto en tu quincena” y “Tu talón de pago”, junto con el editor que abría esta última. Resultado, fondos, monto, plazo, desglose, programa/fondo, CTA y pasos posteriores permanecen.
- La decisión del propietario quedó registrada en ADR-063. `affiliate_payroll_declarations`, Repository, RPC, RLS, auditoría, Edge, Google financiero y cálculos no cambiaron; las pruebas de navegador dejaron de escribir/restaurar declaraciones de nómina.
- El bundle ejecutable se actualizó sólo en el bloque delimitado `screens-loan.jsx`, se validó completo con `vm.Script`, y HTML/PWA avanzaron a `v137`/`v81`.

```text
H-LOAN-UX-CARDS-004 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-declared-payroll.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-phase7.js; scripts/test-phase7-browser.js; scripts/test-loan-auto-recalc-browser.js; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md; docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json; docs/architecture/registry-code.json; docs/architecture/registry-data.json; docs/architecture/registry-edges.json; docs/architecture/registry-search.json
Source-of-truth verdict: SAFE — se retiró un consumidor UI; autoridades Google/Supabase y writers permanecen sin cambios
Invariant verdict: PASS — INV-083/084/085/086 y fronteras financieras permanecen; no hay cálculo ni fallback local
Build: PASS — bloque fuente/bundle sincronizado, bundle completo con sintaxis válida, HTML v137 y PWA v81
Tests: PASS — 41/41 estáticas; Chrome real con cards ausentes, simulación automática, debounce, serialización, fondos/plazos y navegación inicial; Registry FRESH y suite PASS
Security: NOT APPLICABLE — sin cambio Auth/RLS/grants/RPC/secretos; writer UI retirado
Legacy impact: READ ONLY / NO GOOGLE INTERACTION / 0 WRITES
Unexpected files changed: ninguno dentro del conjunto escrito; metadata Git ausente
Known limitations: el constructor completo requiere Babel Standalone no instalado; se usó reemplazo reproducible por marcador para el único módulo sin JSX y validación integral del bundle
Evidence: test-static-suite.js; test-loan-auto-recalc-browser.js; test-architecture-registry.py; búsquedas negativas en fuente y bundle
```

## H-ADMIN-EXPEDIENTE-VISUAL-AUDIT-001 — 2026-08-25

- La auditoría live read-only reconcilió 12,901/12,901 `affiliate_files`: vínculos correctos 12,901, ambiguos 0, incorrectos 0 y escrituras 0. El inventario contiene documentos reales y columnas históricas no documentales (`html_general` 6,629; `codigo_popup_sutiapp` 947; `condicional_popup` 947), por lo que no se autorizó borrado masivo.
- En el caso exacto reportado, los 27 se desglosan en siete `html_general`, diez `b1..b10`, dos credenciales y ocho relaciones aisladas (`address_proof`, popup, imagen principal, logotipo, talón, foto y CSV de ahorro); 16 relaciones pertenecen a ocho grupos de hash repetido. La consulta no expone rutas, URLs, contenido ni identidad.
- `Identidad y expediente` sustituyó la lista lineal por una galería responsive con miniaturas firmadas, estados, filtros de imágenes/PDF, candidatos de mismo hash, archivo histórico plegable y visor modal para imagen/PDF con acceso al original.
- La autoridad no cambió: `affiliate_files` + `private_assets` + Storage privado; el frontend sólo recibe proyección, SHA-256 y procedencia ya autorizada. No se agregó persistencia, fallback, URL pública, SQL, migración, RPC ni permiso.
- Chrome real confirmó el caso reportado: catálogo 13, obligatorios 8, avance 7/8, históricos preservados 27, tarjetas históricas 27, miniaturas 33 y `galleryReady=true`.

```text
H-ADMIN-EXPEDIENTE-VISUAL-AUDIT-001 RESULT
Status: PASS — UI y auditoría read-only; OWNER DECISION REQUIRED antes de cualquier borrado histórico
Files changed: app/affiliate-repository.js; app/screens-admin-identity.jsx; app/bundle.js; scripts/audit-unclassified-affiliate-files.py; scripts/test-affiliate-expediente.js; scripts/test-completion-queue.js; scripts/test-document-catalog-identity-browser.js; SutiApp.html; sw.js; docs/architecture/*; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — misma autoridad Supabase/Storage; cero writes y cero fallback
Invariant verdict: PASS — INV-048/049/050/051/097/098 preservadas
Build: PASS — bundle reproducido desde 90 fuentes con Babel 7.29.0; HTML v128/PWA v72; sintaxis válida
Tests: PASS — expediente, completion queue, profile photo, master phase 1, Phase 2, H-008, Registry y Chrome live
Security: PASS — URLs privadas firmadas 300 s; RLS y grants intactos; sin secretos frontend
Legacy impact: READ ONLY / NO GOOGLE INTERACTION / NO FINANCIAL WRITE
Unexpected files changed: ninguno; dependencia temporal Babel eliminada después del build; metadata Git ausente
Known limitations: falta política de retención/clasificación autorizada para depurar físicamente históricos
Evidence: dry-run live DRY_RUN_PASS; scripts/audit-unclassified-affiliate-files.py; scripts/test-document-catalog-identity-browser.js
```

## H-LOAN-ODOMETER-MAX-1S-001 — 2026-08-25

- El efecto de odómetro de `StepSimulatorV2` termina todos sus carretes de carga y revelado en 1000 ms como máximo; se retiraron el incremento de 90 ms por columna y la repetición indefinida durante esperas largas.
- Se conservaron seis vueltas, blur exclusivo de glifos, carga/recálculo, resultado confirmado, error/reintento, accesibilidad, reduced motion, documento oculto, estructura y cero cambio de layout.
- No cambiaron importes, fórmulas, `FinancialSimulationResult`, Repository, Edge, Supabase, Google, Apps Script, solicitudes ni seguridad.
- Bundle reproducido desde 83 fuentes con Babel Standalone 7.29.0; HTML `v120`, PWA `v64`. Verificación estática, Phase 7, sincronía PWA y Chrome real aislado: `PASS`.

```text
H-LOAN-ODOMETER-MAX-1S-001 RESULT
Status: PASS
Files changed: app/motion.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-result-loading-browser.js; scripts/test-loan-simulator-ui-cutover.js; docs/DECISIONS.md; docs/LOAN_RESULT_LOADING_UX_REPORT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: NOT APPLICABLE — solo duración de motion; autoridad financiera intacta
Invariant verdict: PASS — INV-008/015/036/055/057 preservadas
Build: PASS — 83 fuentes; bundle y service worker con sintaxis válida; v120/v64 sincronizados
Tests: PASS — loan static, Phase 7 y Chrome real; max_duration_ms=1000, loading_capped=true, layoutShift=0
Security: NOT APPLICABLE — Auth, RLS, RPC y secretos sin cambios
Legacy impact: SAFE CHANGE / NO READ / NO WRITE
Unexpected files changed: ninguno dentro del inventario verificable; metadata Git ausente
Known limitations: ninguna dentro del alcance solicitado
Evidence: scripts/test-loan-result-loading-browser.js; docs/LOAN_RESULT_LOADING_UX_REPORT.md
```

## H-FINANCIAL-VISIBILITY-001 Google Auth — 2026-08-24

- **Cierre vigente:** `PASS`. Proyecto aislado `expanded-talon-506522-r7`; Picker concedió a `soporte.sutiapp@gmail.com` sólo `drive.file` sobre `SutiApp Final`. OAuth JSON y API key temporal eliminados; tres secretos almacenados exclusivamente en Supabase Edge Secrets.
- `financial-criteria-admin` v6 escribe exclusivamente P por Sheets API y `financial-legacy` v15 lee P por la misma identidad mínima; ambas están `ACTIVE` con JWT obligatorio.
- P1 fue inicializada como `VISIBILIDAD SUTIAPP`. La prueba fila 104 pasó `AUTO → MOSTRAR → OCULTAR → AUTO`, con tres auditorías confirmadas, A:O modificadas=0, M=false y estado final `SCHEDULED/AUTO`.
- Chrome real confirmó 146 criterios, 146 controles, tres modos y motivo obligatorio. Suite negativa: usuario común/anónimo/fingerprint inválido denegados y Google writes=0.
- Las notas de bloqueo HTTP 403 que siguen documentan intentos anteriores y quedan supersedidas por este cierre.

- Apps Script API identificó inequívocamente el deployment v8 de visibilidad; no se enviaron credenciales a deployments ambiguos.
- GET con la cuenta de servicio `bot-sheets@whatsapp-bot-sutiapp.iam.gserviceaccount.com` y sólo `userinfo.email`: HTTP 403. GET humano con sólo identidad: HTTP 403.
- El mínimo probado que devuelve HTTP 200 es `drive.file` + `script.webapp.deploy`; scopes de identidad no son suficientes y no se conservará el refresh token amplio del propietario.
- `financial-criteria-admin` quedó preparado para renovar OAuth exclusivamente en backend mediante tres Edge Secrets y enviar Bearer al writer; ausencia/rechazo de credencial falla cerrada.
- Consentimiento real de `soporte.sutiapp@gmail.com` con los dos scopes exactos: Web App v8/v9 HTTP 403 y Sheets API A1:P1 HTTP 403. Tokens descartados en memoria; Edge Secrets OAuth 0; Google writes 0.
- El deployment se restringió de `ANYONE_ANONYMOUS` a `ANYONE` en v9, conservando URL, `USER_DEPLOYING` y Code.gs SHA-256 `9451e3ed315daa38e6f8759d8037ec5f7adf77c99b26b8ebe1ae5fea39eb9c32`.
- Cierre `OWNER_ACTION_REQUIRED`: falta consentimiento OAuth único de una identidad técnica dedicada. Google writes 0; P, M y A:O sin cambios; secretos almacenados 0.

## H-LOAN-PAYROLL-IMPACT-003 — 2026-08-24

- El propietario autorizó Supabase como autoridad exclusiva de percepciones/deducciones quincenales declaradas y el 30% sólo como referencia informativa. ADR-050 e INV-083–086 separan este dato de Google financiero, nómina oficial, elegibilidad y aprobación.
- Se añadió `affiliate_payroll_declarations` con PK/FK, constraints, RLS forzada, cero grants directos, RPC de lectura/escritura/impacto, control optimista de versión, auditoría del actor real y denegación de escritura durante impersonación.
- Suti Préstamo sustituye los placeholders por el contrato Claude completo: barra segmentada, proporción, descuento Google, remanente, tarjeta de talón y editor accesible; estados `EMPTY/READY/ERROR/LOADING` permanecen visibles sin `DATA`, `nominaStore` o almacenamiento local.
- `financial-legacy` conserva intactas sus fórmulas y adjunta la proyección Supabase sólo después de resolver `paymentPerPeriod`. Cloud v9 `ACTIVE` con `verify_jwt=true`; bundle v103/PWA v47.
- Evidencia final: migración/RLS/grants `PASS`, owner/cross-user/anónimo/direct-table `PASS`, recovery DDL con `ROLLBACK` `PASS`, Chrome real editor+impact+flujo `PASS`, 0 declaraciones/0 fixture QA al cierre y Google writes `0`.

## H-FINAL-APPROVED-LOAN-EXPORT-WRITER — 2026-08-23

- Aplicadas migraciones `20260823000100/00101` con `financial_request_export_audit`, RLS forzada, RPC service-only endurecida por hash/estado, snapshot A:AL inmutable y estados `ready_for_handoff/in_progress/handed_off/failed`; 947 afiliados, 0 solicitudes y 0 referencias legacy preservados.
- `financial-legacy` quedó ACTIVE v8 con JWT y coincide byte/SHA-256 con repo (32,735 bytes). Secrets del writer se sincronizaron sin exposición. Apps Script aislado quedó deployment v6 con LockService, 38 headers, registry UUID/hash/fila y read-back exacto.
- A–J aislada PASS: doble clic/retry/concurrencia 0 duplicados; timeout después del append se recupera. Live negativa PASS: 401 anónimo, 403 normal, 404 Admin para UUID inexistente, RLS audit vacía.
- Admin conserva Claude UI y añade estados/error de negocio/retry; bundle v91/PWA v36. Browser financiero real PASS sin mock, cálculo local ni Google directo.
- No se inventó E2E: Supabase tiene 0 solicitudes financieras. `Historial de solicitudes` sigue terminando en fila 2237 y registry tiene 0 datos; Google rows written 0, Criterios 0, amortización/pagos 0. Cierre `OWNER_DECISION_REQUIRED` para autorizar una solicitud TEST que pueda permanecer en el histórico.

## H-FINANCIAL-EDGE-DEPLOY-UNBLOCK — 2026-08-23

- Se diagnosticó el 403 sin modificar datos: project ref/link correctos (`jsucdyothkuptosvskqf`), proyecto `SUTIAPP` saludable y token local autorizado disponible pero no exportado al proceso; el CLI había caído en una sesión global antigua.
- Se cargó la credencial únicamente en memoria, sin imprimirla ni guardarla en Git. No fue necesario logout/login, relink ni nuevo PAT.
- Se configuraron exclusivamente los secretos read-only de criterios y `ALLOWED_APP_ORIGINS` con orígenes exactos; `FINANCIAL_LEGACY_API_URL/TOKEN` siguen ausentes y el writer de Historial permanece deshabilitado.
- `financial-legacy` se desplegó desde el código actual y quedó `ACTIVE` en cloud v6 con `verify_jwt=true`. La descarga API post-deploy coincidió por SHA-256 y tamaño (25,172 bytes) con el source local; CORS respondió 204 y el overview autenticado 200 desde el origen local oficial.
- La matriz productiva A–I pasó 9/9, incluido cambio temporal de sindicato/categoría, refresh inmediato, múltiples fondos, perfiles NULL y sin fondo; el dato temporal quedó restaurado. RLS denegó anónimo/normal y autorizó Admin según contrato.
- Google writes `0`; `Criterios de fondos`, `SutiApp Final`, Apps Script y lógica financiera no fueron modificados.

## H-FINANCIAL-FRONTEND-FULL-CUTOVER — 2026-08-23

- Se implementó el resolver read-only `Auth → affiliate efectivo → categoría+sindicato → Criterios de fondos → FinancialSimulationResult`, con matching conjunto, estados de disponibilidad, múltiples fondos, semántica de meses/quincenas, límites backend y `$15 por pago` server-side.
- Dashboard, Suti Préstamo, bottom sheets, productos financiables, Terrenos, Historial, Admin Solicitudes/Finanzas y Admin Fondos quedaron conectados o proyectados desde su autoridad real; se retiró copy técnico/placeholder y se preservó la estructura Claude.
- Evidencia local: bundle 76 fuentes `v90`/PWA `v35`, Deno `PASS`, tres suites estáticas `PASS`, lectura real de 146 reglas y muestra de cálculo exacta; Google writes `0`.
- Supabase rechazó configurar secrets y desplegar Function con 403 por privilegios. La Edge cloud v3 no cambió; pruebas A–I, refresh real y RLS post-deploy quedan `NOT EXECUTED`. Ver `docs/FINANCIAL_FRONTEND_FULL_CUTOVER_REPORT.md`.

## H-PHASE7-LOAN-EXPORT-BLOCKERS — 2026-08-22

- Auditoría read-only live: D quedó demostrado por categoría salvo la contradicción `Confianza`; M quedó demostrado desde sindicato; `6 meses` significa duración de seis meses y 12 pagos quincenales, pero el encoding nuevo de G sigue parcial.
- `FinancialSimulationResult` conserva autoridad Google y semántica completa, pero su productor no está demostrado/configurado end-to-end ni el resultado aprobado se persiste en `program_requests`.
- Supabase conserva 947/947 afiliados y el hash fijo; no contiene las elecciones financieras calculadas de categoría/sindicato. No se aplicó migración por ausencia de copia 1:1.
- Y y la obligatoriedad O:W permanecen sin regla declarativa. Writer deshabilitado; Google writes `0`; `SutiApp Final` y Apps Script sin modificación.
- Evidencia: `docs/LOAN_EXPORT_BLOCKER_RESOLUTION_REPORT.md`.

## H-LOAN-SIMULATOR-UI-CUTOVER — 2026-08-22

- El paso Monto de Suti Préstamo adoptó el contrato visual `StepSimulatorV2`: tarjeta guinda, pago por periodo, monto/slider, plazo, resumen de cuatro métricas, desglose, fondo/programa, talón e impacto preservados.
- `FinancialSimulationResult` se valida completo en navegador y Edge Function. No se calcula ni completa tasa, interés, pago, total, gasto, límites, plazo, fondo o elegibilidad; error/incompletitud produce estado controlado.
- La presentación soporta `$15 × número de pagos` únicamente desde el resultado recibido. Talón e impacto están visibles y desactivados, sin `localStorage` ni decisión local de elegibilidad.
- Destino, Documentos, Resumen y Phase 7 permanecen intactos. Google Sheets y Apps Script: `NO MODIFICATION`; migraciones/RLS: `NOT APPLICABLE`.
- Bundle `v87`/PWA `v32`. Suite estática completa y Chrome real `PASS`; cero mock, tasa local o request Google directo. Evidencia: ADR-042 y `docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md`.

## H-ADMIN-DECISIONS-CUTOVER — 2026-08-22

- Se ejecutaron las cuatro recomendaciones aprobadas como un solo bloque: segmentación, roles técnicos, frontera financiera híbrida y Sindicato/estructura Claude.
- Diez módulos quedaron desbloqueados: cinco `PRODUCTIVE_SUPABASE` y cinco `PRODUCTIVE_HYBRID`; `OWNER_DECISION_REQUIRED=0`. Fondos conserva `BLOCKED_FINANCIAL_LEGACY`.
- Migraciones `20260822000400`/`00410` y hardening `00411` aplicadas: roles/RPC, 20 segmentos, acceso a pantallas, audiencias de empresas, presentación financiera no monetaria, workflows/tracking, cuatro pantallas Sindicato, perfiles y beneficios de Convenios. RLS forzada, visibilidad padre-hijo y recovery condicionado.
- H005_TEST sigue como único principal; TEST2/3 continúan normales. Prueba reversible de CRUD/denegación/cleanup y Chrome real `PASS`.
- `localStorage`, `DATA` y mocks dejaron de ser autoridad en las rutas productivas. Navegación, menús, formularios y estructura Claude permanecen en código; su writer local quedó neutralizado.
- Bundle `v86`/PWA `v31`, 76 fuentes. Google financiero y Apps Script: `NO MODIFICATION`.
- Evidencia: ADR-041 y `docs/ADMIN_REMAINING_MODULES_REPORT.md`.

## H-ADMIN-REMAINING-MODULES — 2026-08-22

- Se eliminaron los 13 estados genéricos: 1 `PRODUCTIVE_SUPABASE`, 1 `PRODUCTIVE_HYBRID`, 1 `BLOCKED_FINANCIAL_LEGACY` y 10 `OWNER_DECISION_REQUIRED` con causa verificable.
- La cola empresarial de pop-ups usa `company_popup_proposals`, RLS forzada, validación tenant/plan/asset, revisión RPC y borrador deshabilitado al aprobar; Repository/store/UI no conservan autoridad local.
- Finanzas Admin proyecta `program_requests` y espera escrituras remotas; depósito, tasas, saldos, amortizaciones y reglas permanecen aislados en Google Phase 7.
- Se preservaron las 25 tarjetas y las UI fuente Claude. Una regresión demostrada del CRUD visual —dos inputs React podían perder el primer cambio— se corrigió con actualización funcional de estado.
- Bundle `v85`/PWA `v30`, 74 fuentes, migración live, suites estáticas, navegador completo y flujo profundo reversible `PASS`. Legacy financiero: `NO MODIFICATION`.
- Evidencia y decisiones: `docs/ADMIN_REMAINING_MODULES_REPORT.md`, ADR-040.

## H-ADMIN-FULL-PRODUCTIZATION — 2026-08-22

- Se preservaron las 25 tarjetas Claude del panel; 12 módulos con autoridad/permisos backend permanecen operativos y 13 prototipos quedaron identificados como `EN PREPARACIÓN`, sin abrir writers `adminStore/localStorage`.
- Planes dejó de usar permisos locales: `company_portal.write` controla la UI y todas las mutaciones esperan el resultado remoto antes de confirmar o cerrar; carga y error tienen estados explícitos.
- Se retiró copy técnico visible de Admin, Branding, contenido visual, Noticias, Marketplace y Membresías, sin cambiar estructura, navegación o interacción.
- Bundle `v84`/PWA `v29`: 69 fuentes; suite estática completa 22/22, auditoría, protección Claude y navegador real con H005_TEST `PASS`. Sin migraciones, datos, secretos o interacción con Google financiero; temporales del navegador eliminados.
- Evidencia: `docs/ADMIN_FULL_PRODUCTIZATION_REPORT.md`.

## H-PROFILE-PHOTO-CUTOVER-GLOBAL — 2026-08-22

- Reutilizada la relación MASTER ASSET EVACUATION `affiliate_files(profile_photo, Photo/DK)` para 487 fotos privadas; 0 descargas, 0 migraciones y 0 escrituras remotas.
- `AffiliateRepository.getProfilePhoto()` concentra validación de relación, firma Storage, caché en memoria por principal y bloqueo de ambigüedad; Auth limpia caché en login/logout.
- Header, Perfil, Credencial, Admin e impersonación consumen la misma proyección; `Avatar` conserva geometría Claude y vuelve a iniciales ante ausencia/error visual.
- Reconciliación live y Chrome multiusuario: 487 con foto, 460 sin foto, 0 ambiguas, tres cuentas PASS, anónimo/cross-user denegados y Admin autorizado.

## FRONTEND BOOT RECOVERY — 2026-08-22

- Se reprodujo el shell vacío en Chrome real sobre `http://localhost:8080/SutiApp.html`: el primer error fue `SyntaxError: Unexpected token '<'` en `app/bundle.js`, causado por JSX crudo concatenado desde `app/tweaks-panel.jsx` cuando el generador se ejecutó sin Babel.
- `scripts/build-bundle.js` ahora valida sintaxis antes de escribir y aborta sin sobrescribir el bundle si falta la transformación requerida. Se reconstruyó de forma determinista desde 67 fuentes con Babel Standalone local verificado; `node --check` y la prueba de no sobrescritura pasan.
- Se publicó `bundle.js?v=79` y cache PWA `sutiapp-v24`. No se cambió ninguna pantalla fuente, dato, migración, RLS, configuración de Supabase ni Google legacy; tampoco se añadió mock, `DATA`, `localStorage` o fallback.
- Chrome real confirmó login `H005_TEST`, Home, navegación inferior, Perfil, Convenios, Finanzas, Admin, refresh, logout y regreso al login. Auth, DB y Storage alcanzaron Supabase cloud; Finanzas conservó el adaptador cloud autorizado y su estado controlado pendiente de configuración Phase 7, sin autoridad financiera local.
- Regresión estática acumulada: 17 suites `PASS`; auditoría del repositorio `PASS`; preservación Claude UI `PASS`; seguridad y fuente de verdad `PASS`. El MASTER PLAN no se reanudó durante esta recuperación.

## H-000 — 2026-08-20

**Objetivo:** establecer gobierno del repositorio antes de cualquier integración con Supabase.

**Alcance:** auditoría de solo lectura; creación de `AGENTS.md`, documentación, Skills locales y auditoría estática no destructiva. Sin cambios en `app/`, `SutiApp.html`, `sw.js`, datos, UI, APIs, Google Sheets, Apps Script o Supabase.

**Hallazgos principales:** frontend estático basado en globals; bundle precompilado; mocks ejecutables; persistencia extensa en `localStorage`; auth/permisos simulados; JSON lateral y almacenamiento local mezclados para imágenes; service worker con caché offline; varios conflictos de autoridad.

**Decisiones:** solo ADR-001 a ADR-010 aportadas por el propietario. Autoridades desconocidas permanecen `UNRESOLVED` o `SOURCE OF TRUTH CONFLICT`.

**Evidencia:** `docs/INITIAL_REPOSITORY_AUDIT.md`, `docs/SOURCE_OF_TRUTH.md` y salida de `scripts/audit.ps1`.

**Validación:** las seis Skills pasan validación estática de nombre/frontmatter, archivo `agents/openai.yaml` e invocación `$skill-name`. El validador oficial `quick_validate.py` quedó `BLOCKED` porque el entorno no incluye `PyYAML` y H-000 no autoriza instalar dependencias. `audit.ps1 -Check all` terminó `PASS` con `REVIEW REQUIRED`: sources 168, mocks 30, architecture 275, legacy 172 y security 180 coincidencias para clasificación.

**Comportamiento funcional:** `NOT APPLICABLE` para build/tests porque no se cambió ningún archivo funcional y el repositorio no contiene sistema de build/test reproducible. Se verificaron fecha, tamaño y SHA-256 de entradas funcionales clave; quedan como baseline posterior a H-000.

## H-001 — 2026-08-21

**Objetivo:** auditar identidad, usuarios, Auth, roles, permisos e impersonación antes de Supabase.

**Alcance:** lectura completa y trazabilidad del frontend; diseño conceptual documentado en `H001_IDENTITY_AUTH_AUDIT.md`; actualización de estados propuestos en `SOURCE_OF_TRUTH.md`. Sin cambios en `app/`, bundle, Supabase, dependencias, SQL, datos ni sistemas Google.

**Hallazgos:** afiliado `DATA.user`, viewer de segmentación y sesiones admin/empresa son representaciones distintas; `financeStore.userContext()` mezcla fuentes; Auth/roles/permisos actuales dependen de `localStorage`; no existe sesión de afiliado real; foto y banco carecen de asociación a identidad.

**Propuesta:** una entidad conceptual de afiliado, sin `profiles` separado inicialmente, y vínculo opcional a Supabase Auth; administradores/empresas con asignaciones técnicas aparte; impersonación autorizada en backend con actor y contexto preservados. Todo permanece `PROPOSED — DECISION REQUIRED`.

**Validación:** `scripts/audit.ps1 -Check all` terminó con exit code `0`, `AUDIT STATUS: PASS` y `VERDICT: REVIEW REQUIRED`; las coincidencias estáticas fueron clasificadas en la auditoría H-001. Los SHA-256 de ocho entradas funcionales (`SutiApp.html`, `sw.js`, bundle y stores críticos) coinciden con el baseline previo: comportamiento funcional sin cambios. No se añadieron `.env`, SQL ni archivos de implementación Supabase.

**Resultado:** H-001 `PASS` como auditoría/diseño. La seguridad actual es `FAIL`; la integración, migración, RLS e impersonación quedan `BLOCKED` hasta aprobar las cinco decisiones enumeradas y ejecutar las H posteriores.

## H-002 — 2026-08-21

**Objetivo:** perfilar en modo read-only la fuente histórica real de afiliados antes de diseñar schema o Supabase.

**Decisiones recibidas en ese momento:** H-001 aprobada; ADR-011 a ADR-016 registraron la autoridad entonces declarada, entidad `affiliate`, semántica de email, separación de autorización técnica, impersonación de 30 minutos y obligación de `DATA_MAPPING.md`. La autoridad fue sustituida después por decisión expresa del propietario; véase la reanudación al final de esta entrada.

**Investigación externa:** Google Drive identificó `SutiApp Final` como workbook vigente y actualizado el mismo día. La metadata de 98 pestañas y lecturas centinela no expusieron una tabla maestra de afiliados ni `numero_control`; `App: Logins` solo registra tiempo/email/aceptación. Dos hojas antiguas con columna `CONTROL` fueron clasificadas como candidatas no autoritativas.

**Cambios:** se crearon `H002_AFFILIATE_SOURCE_PROFILE.md` y el roadmap `DATA_MAPPING.md`; se actualizaron decisiones, fuente de verdad y estado de H-001. Cero cambios funcionales y cero escrituras en Google.

**Resultado intermedio, posteriormente sustituido:** `BLOCKED — SOURCE OF TRUTH UNRESOLVED`. No se continuó a schema, SQL, Supabase, importación o Auth. La reanudación con el Excel autorizado reemplaza este estado, no su evidencia histórica.

**Validación:** `scripts/audit.ps1 -Check all` terminó con exit code `0`, `AUDIT STATUS: PASS` y `VERDICT: REVIEW REQUIRED`. Los hashes de siete entradas funcionales coinciden con el baseline H-001; no aparecieron `.env`, SQL ni archivos Supabase. Los únicos seis archivos modificados son los documentales declarados y no contienen valores de las filas personales inspeccionadas.

### H-002 reanudada — fuente sustituida por decisión del propietario

El propietario sustituyó la designación anterior y declaró `Usuarios SUTIAPP.xlsx` como única autoridad del padrón. Se descartaron `SutiApp Final` y cualquier CSV como fuentes de afiliados. La hoja `Usuarios`, fijada por SHA-256 `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591`, fue perfilada read-only respetando sus 947 ordinales.

**Resultado final:** H-002 `PASS`. Se documentaron 947 registros, calidad de `Número de control`, clasificación completa de email, grupos seudónimos, ganadores por orden, 187 columnas, mapping preliminar, riesgos e invariantes. El Excel no se modificó; no se creó Supabase, SQL, schema, Auth ni migración. H-003 solo se recomienda.

**Validación final:** SHA-256 del Excel intacto; 7/7 archivos runtime sin cambio; `scripts/audit.ps1 -Check all` terminó con exit code `0`, `AUDIT STATUS: PASS` y `VERDICT: REVIEW REQUIRED`; cero emails raw en los documentos H-002; cero `.env`, SQL o archivos Supabase. Las columnas financieras quedaron `READ ONLY / REQUIRES AUDIT`, sin interpretar cifras ni alterar el legacy.

## H-003 — 2026-08-21

**Objetivo:** reconciliar read-only las anomalías de identidad de H-002 y preparar contratos conceptuales de importación, frontend y `AffiliateRepository`.

**Decisión recibida:** `numero_control` se almacena como `TEXT / STRING` preservando el raw; la unicidad no queda aprobada. Se registró como ADR-017 e INV-017.

**Resultado:** `PASS` como auditoría/diseño. Los 13 grupos duplicados se clasificaron en 12 `SAME_PERSON_LIKELY` y 1 `DIFFERENT_PERSON_LIKELY`; las nueve filas vacías quedaron `UNRESOLVED` sin matches fuertes; los tres valores textuales se clasificaron `LIKELY_EXPORT_FORMATTING`. Se mantuvieron 904 candidatos Auth y se catalogaron 187/187 columnas.

**Contratos:** se documentaron importación conceptual con UUID/trazabilidad, mapeo completo de consumidores del frontend, interfaz conceptual `AffiliateRepository` y opciones de staging/unicidad. Ningún contrato es schema o autorización de migración.

**Legacy/seguridad:** Ahorro y Préstamos permanecen `READ ONLY / REQUIRES AUDIT`; no se interpretaron importes ni reglas. La evidencia nominal solicitada se limita a filas anómalas y el informe H-003 queda marcado como documentación restringida.

**Cambios:** solo `H003_AFFILIATE_RECONCILIATION.md` y gobierno documental. Cero cambios en app, bundle, Excel, Google, Supabase, Auth, SQL, `.env`, migraciones o dependencias.

**Validación final:** hash del Excel intacto; recomputación `PASS` para 947 filas, 187 columnas, 13 grupos/28 filas duplicadas, nueve vacíos, tres textuales, 13 clasificaciones y 10 filas de los cinco grupos de email. La tabla contiene 187/187 posiciones secuenciales y solo categorías permitidas. Los siete hashes runtime coinciden con H-002; no aparecieron `.env`, SQL ni artefactos Supabase. `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check all` terminó con exit code `0`, `AUDIT STATUS: PASS` y `VERDICT: REVIEW REQUIRED` por hallazgos estáticos preexistentes ya clasificados.

## H-004 — 2026-08-21

**Objetivo:** conectar Supabase, crear la entidad autoritativa `public.affiliates`, importar los 947 afiliados y dejar la base segura para Auth sin crear cuentas.

**Implementación:** cliente Supabase con configuración pública generada/ignorada, `AffiliateRepository` único, migración versionada, RLS deny-by-default e importador administrativo reproducible. El service worker dejó de cachear respuestas cross-origin o configuración Supabase.

**Datos:** Excel con hash aprobado → 947 procesadas → 947 insertadas → 947 destino; 0 rechazadas, 0 perdidas y fingerprint completo coincidente. Se preservaron 9 controles vacíos, 13 grupos/28 filas con control duplicado y 904 elegibles Auth.

**Seguridad:** `numero_control` es `text`, nullable y no unique; RLS habilitada/forzada; `anon` sin SELECT; policy autenticada por `auth.uid() = auth_user_id`; 0 cuentas Auth y 0 vínculos. Secret Key, token y contraseña quedaron solo en `supabase.env` ignorado y memoria de procesos administrativos.

**Legacy/UI:** cero cambios en Google, Ahorro, Préstamos o cálculos. Ninguna pantalla se migró y no se introdujo fallback Supabase→`DATA`/`localStorage`.

**Cierre final:** H-004 `PASS`. La verificación remota read-only confirmó `public.affiliates`, 947 filas, `numero_control` `text`, 9 controles vacíos, 13 grupos/28 filas duplicadas, RLS habilitada y forzada, y elegibilidad Auth `904 eligible / 28 missing_email / 10 invalid_email / 5 duplicate_email`. Permanecen 0 cuentas Auth y 0 vínculos `auth_user_id`.

**Revisión arquitectónica:** `APPROVED`. `AffiliateRepository` consulta Supabase sin fallback productivo a `DATA`, mocks o almacenamiento del navegador; el escaneo de valores secretos fuera de los archivos ignorados dio 0; Google legacy quedó `READ ONLY / NO INTERACTION`. `scripts/test-h004.js` y `scripts/audit.ps1 -Check all` terminaron con exit code 0. H-005 no fue iniciada.

## H-005 — 2026-08-21

**Objetivo:** reemplazar la autenticación simulada del afiliado con login real de Supabase Auth, sesión persistente, vínculo inequívoco y logout real, sin rediseñar ni migrar otros dominios.

**Implementación:** `AffiliateAuth` controla bootstrap, login, restauración, errores y logout; el shell se monta solo después de resolver `AffiliateRepository.getCurrentAffiliate()` por `auth.uid()` → `auth_user_id`. La pantalla conserva el diseño general e incluye email, contraseña y recuperación deshabilitada/preparada. El botón anterior de Perfil ahora ejecuta logout Supabase.

**Cuenta controlada:** el propietario autorizó una única fila elegible. Se creó exactamente 1 cuenta Auth confirmada y se vinculó por UUID exacto; no se generaron cuentas masivas, contraseñas inventadas ni emails adicionales. Los otros 946 afiliados permanecen intactos y los usuarios sin Auth continúan existiendo.

**Validación:** pruebas remotas reales confirmaron contraseña incorrecta rechazada, login, refresh, logout y revocación del refresh; RLS permitió la fila propia, filtró una fila ajena y denegó anónimo. Chrome headless confirmó login UI, contexto por sesión, persistencia después de recarga, botón de logout y permanencia fuera tras recargar. Pruebas unitarias cubren sin vínculo, inelegibilidad y error de conexión.

**Alcance pendiente:** Perfil, TopBar, Credencial y demás consumidores visuales aún pueden leer `DATA.user`, pero no autentican ni abren el shell. Recuperación de contraseña, activación gradual de candidatos, administración e impersonación quedan fuera de H-005. Google legacy no fue leído ni modificado.

**Resultado final:** H-005 `PASS`. La reconciliación remota final conserva 947 afiliados y confirma exactamente 1 cuenta Auth y 1 vínculo. El `sutiapp-architect-reviewer` emitió `APPROVED`; no hay bloqueos ni se inició la siguiente H.

## H-006 — 2026-08-21

**Objetivo:** mostrar en la demo la misma fila real del afiliado autenticado en TopBar, Inicio, Perfil y Credencial, conservando el diseño y sin ampliar a dominios financieros o Google.

**Implementación:** `AffiliateAuth` construye una sola proyección in-memory después de `AffiliateRepository.getCurrentAffiliate()`. Las cuatro áreas prioritarias consumen esa proyección, preservan `numero_control` como texto raw y muestran `historical_email_raw` sólo como contacto. Valores ausentes usan `—`; sin foto autoritativa permanece el avatar placeholder. Se retiraron de estas áreas foto/banco de `localStorage` y montos mock del encabezado.

**Validación:** bundle regenerado; caché PWA incrementada; pruebas locales H-005/H-006 `PASS`. Chrome headless con la única cuenta H-005 confirmó contraseña incorrecta, login real, mismo `affiliate.id` y misma proyección nombre/control en Inicio, Perfil y Credencial, refresh, logout y permanencia fuera tras recargar. No se imprimieron valores personales ni secretos.

**Alcance pendiente:** lectores mock en `finance-store.jsx`, `screens-financiera.jsx`, `screens-loan.jsx` y `screens-marketplace.jsx` son `PENDING H-LATER`. Ahorro, Préstamos, banco, foto autoritativa, recuperación de contraseña, Admin y activación masiva no se implementaron. Google legacy quedó `NO INTERACTION`.

**Cierre:** H-006 `PASS`. El `sutiapp-architect-reviewer` emitió `APPROVED`: 0 lectores de identidad `DATA.user` y 0 stores locales de foto/banco en las pantallas migradas; fuente y bundle corresponden; RLS, sesión y control de acceso real volvieron a pasar. No existe `WORK_QUEUE.md`, por lo que no se inicia otra H automáticamente.
## H-007 — 2026-08-21

**Objetivo:** crear e importar los dominios independientes `SUPABASE_NOW`, conectarlos a la UI y retirar sus lectores mock, sin intervenir Google financiero.

**Perfilado read-only:** se inspeccionaron rangos bounded de `SutiApp Final`. Se fijó un snapshot SHA-256 `80910E831B93C324B55B3E10A225999B122EB6FBC1826F83FD8BA49A8D4ED915` con 60 entidades significativas: Directorio 30, Minutas 5, Descargas/Normas 8 y Finanzas informativa 17. Doce filas físicas vacías fueron clasificadas, no eliminadas como entidades existentes. No se descargaron archivos ni se escribió Google.

**Implementación:** migración/recovery versionados, cuatro tablas con RLS público read-only, importador administrativo idempotente y cuatro repositorios Supabase. Inicio y los cinco módulos visuales consumen una capa in-memory sin fallback; `DATA.comite` salió del runtime y `sindicatoStore` excluye los módulos migrados. Bundle y caché PWA fueron regenerados.

**Reconciliación:** 60 fuente, 60 procesadas, 60 insertadas, 0 rechazadas, 60 destino, 0 perdidas y fingerprints coincidentes. Lectura pública remota confirmó 30/5/8/17. Chrome headless confirmó exactamente 30 integrantes y bloques `comite=30`, `normas=2`, `minuta=5`, `finanzas=17`, `formatos=6`, manteniendo H-005/H-006.

**Legacy y bloqueo individual:** `Secretaría de finanzas!T:V` quedó fuera del snapshot/schema. No se tocaron Ahorro, Préstamos, nómina, amortizaciones, fondos, reconciliaciones, queries, Apps Script ni fórmulas. Catálogos quedó `BLOCKED` porque `Choice` e `Íconos` mezclan segmentación, comercio y estados financieros; no se creó una autoridad parcial.

**Resultado:** cuatro dominios `PASS`; Catálogos `BLOCKED` individualmente. H-008 no fue iniciada.
## H-007.1 — 2026-08-21

**Objetivo:** resolver el bloqueo agregado de Catálogos separando fuentes y valores por semántica, autoridad, consumidor, escritor y dependencia legacy.

**Google read-only:** metadata vigente de 98 hojas y 19 rangos bounded catalogales/configuración. Se inspeccionaron únicamente valores no personales; cero escrituras, transacciones, fórmulas, Apps Script, reportes o conciliaciones.

**Resultado:** 27 subdominios: 4 `AFFILIATE_SEGMENTATION`, 2 `APP_CONFIGURATION`, 1 `CONTENT_CONFIGURATION`, 10 `MARKETPLACE_CATALOG`, 1 `PROGRAM_CATALOG`, 4 `FINANCIAL_LEGACY`, 1 `GLIDE_HELPER` y 4 `UNRESOLVED`. `Choice`, `Íconos` y `Choice Suticompras` fueron separados; no se creó tabla genérica.

**Gate de migración:** 0/27 candidatos. Los escritores Google son desconocidos; Segmentación tiene writer local y consumidores en fondos/finanzas protegidos; Marketplace conserva múltiples stores/writers locales. Se crearon 0 tablas, 0 migraciones, 0 repositories, 0 cambios UI y se migraron 0 filas.

**Legacy/seguridad:** inversión, pago/cobro, elecciones de rifa y plazos permanecen Google legacy. `Cargos en App` no se promovió a permisos técnicos. Auth, `affiliate`, impersonación y H-008 quedaron intactos.

## H-007.2 — 2026-08-21

**Objetivo:** migrar empresas y contenido visual independiente a un registro central y Supabase Storage sin convertir los 27 catálogos bloqueados de H-007.1 en una dependencia agregada.

**Perfilado read-only:** se reutilizó H-DATA/H-007 y se leyeron solo cinco rangos acotados de Google. El snapshot inmutable `A677797640D181E42770204A5E1249D77CE6270989AEFCD8FC25644188ED56D3` contiene 138 referencias: banners de Inicio y Marketplace, candidatos de popup, imágenes institucionales, documentos, branding local e imágenes independientes de Convenios. Google no fue modificado.

**Implementación:** se crearon registro de assets/procedencia, empresas, relaciones, banners y popups; tres buckets públicos separados por finalidad; migración/recovery versionados; importador idempotente; y repositorios sin fallback productivo. Las categorías históricas se preservan como `category_raw TEXT`, sin crear autoridad catalogal. Inicio y los módulos institucionales migrados resuelven sus medios desde Storage; el popup productivo usa el repositorio y permanece vacío porque los tres candidatos carecen de semántica de publicación autorizada.

**Reconciliación:** 138 referencias descargadas y validadas, 128 objetos únicos subidos/verificados, 10 deduplicados y 0 fallidos. Destino: `app-assets` 82, `company-assets` 34 y `documents` 12; 23 banners preservados (10 de Inicio activos y 13 de Marketplace deshabilitados), 3 popups deshabilitados, 53 imágenes institucionales únicas y 13 referencias PDF/12 objetos únicos.

**Bloqueos aislados:** `Empresas Suticompras` solo contiene una fila de prueba incompleta, por lo que `companies` conserva 0 filas y no se inventaron empresas, logos ni categorías. La activación de popups y el cutover de Marketplace/Convenios quedan bloqueados por autoridad o semántica, sin bloquear los assets ya preservados.

**Seguridad/legacy:** RLS está habilitada y forzada en seis tablas; los clientes no tienen grants ni policies de escritura; `asset_sources` no es legible desde el navegador. No se tocaron Ahorro, Préstamos, fórmulas, Apps Script ni otro Google financiero. La Secret Key permaneció solo en el proceso administrativo local.

**Validación:** pruebas estáticas, remotas read-only y Chrome headless confirmaron conteos, hashes de 128/128 objetos, buckets, relaciones, ausencia de fallbacks en áreas conectadas, banner real en Inicio, favicon/iconos PWA y continuidad de login, sesión, logout e identidad H-005/H-006. `scripts/audit.ps1 -Check all` terminó `PASS`; el escaneo de valores administrativos dio 0 coincidencias fuera del archivo local ignorado. El repositorio no contiene metadata Git y no existen `WORK_QUEUE.md`/`WORK_QUEUE_HISTORY.md`, limitaciones registradas para inventario y continuidad. H-008 no fue iniciada.

**Revisión arquitectónica:** `APPROVED`. Los hallazgos de Empresas, publicación de popups y cutover de Marketplace/Convenios están correctamente aislados y no invalidan la migración reconciliada. No se requiere una nueva decisión para aceptar H-007.2; cualquier continuación necesita una fuente empresarial autoritativa o semántica de publicación provista por el propietario.

## Aprovisionamiento adicional H-005 — 2026-08-21

**Autorización:** el propietario declaró localmente `H005_TEST2` y `H005_TEST3`, corrigió sus referencias a UUID exactos y autorizó exclusivamente esas dos cuentas adicionales. La cuenta base y los demás afiliados quedaron fuera de alcance.

**Prechecks:** cada UUID resolvió exactamente una fila `eligible`; el email local coincidió con el histórico normalizado; no existían cuentas Auth ni vínculos incompatibles. No se mostraron emails, contraseñas, UUIDs o claves administrativas en evidencia persistente.

**Resultado:** se crearon exactamente 2 cuentas Auth confirmadas y se actualizaron exactamente 2 vínculos `auth_user_id`. La reconciliación mantuvo 947 afiliados y dejó 3 cuentas/vínculos controlados en total; ningún afiliado no objetivo cambió.

**Validación:** ambos alias pasaron login API, resolución RLS equivalente a `AffiliateRepository.getCurrentAffiliate()`, logout y revocación de refresh. Chrome headless confirmó en ambos la pantalla normal, identidad correcta en Inicio/Perfil/Credencial, sesión persistente y logout durable. No hubo cambios de schema, frontend productivo, email histórico, `numero_control`, Google o legacy financiero.

## H-007.3 — 2026-08-21

**Objetivo:** migrar el directorio empresarial real y conectar su UI usando H-007.2, manteniendo Marketplace, catálogos y legacy financiero fuera del alcance.

**Resultado:** lectura Google acotada y read-only; snapshot SHA-256 `41871AE58415B5654F37058BF361350E598B93DD8AFF9EF3BA07BC94ECA4718F`; 33 empresas importadas y reconciliadas con 35 vínculos a assets existentes (`33 cover`, `2 gallery`, 0 uploads). `CompaniesRepository`, Convenios y detalle consumen Supabase/Storage sin fallback.

**Popups y límites:** los 3 candidatos permanecen deshabilitados por ausencia de reglas históricas completas. Marketplace, productos, planes, Auth empresarial, Ahorro, Préstamos y legacy financiero no cambiaron. Auth conserva exactamente tres cuentas controladas.

**Validación:** build y sintaxis `PASS`; pruebas estáticas H-007.2/H-007.3 `PASS`; prueba remota confirmó RLS forzada, 33/35, 0 popups públicos y 0 grants cliente de escritura; Chrome headless confirmó 33 tarjetas, URLs exclusivas de `company-assets`, detalle, sesión y logout.

## Ícono e instalación — 2026-08-21

**Auditoría inicial:** textos en `localStorage`, cinco controles `image-slot`, sello embebido y manifest/HTML hardcodeados constituían autoridades paralelas. H-007.2 ya aportaba cuatro assets PWA registrados.

**Implementación:** se añadió el singleton `app_settings`, se reutilizaron los cuatro keys H-007.2, se registró el sello institucional, se conectó `BrandingRepository`/`VisualContent`, y Admin/Home/SutiSeal dejaron de leer fuentes locales. Manifest, HTML, favicon y PWA se sincronizan desde Supabase por un proceso reproducible. Bundle `v67` y caché `v12` generados.

**Seguridad:** RLS forzada, lectura pública exclusiva, cero escritura cliente; el panel es read-only porque Admin sigue simulado. El sincronizador server-side usa la Secret Key local ignorada. No se crearon cuentas Auth ni se tocó Google/legacy financiero.

**Validación:** prueba reversible de seis relaciones, Storage/app_assets, dos lecturas públicas, restauración y limpieza `PASS`; reconciliación remota, hashes, estáticos, pruebas H-007/H-007.2/H-007.3 y Chrome headless `PASS`. Las tres imágenes de instalación permanecen NULL/no configuradas.

**Revisión arquitectónica:** `APPROVED` para la migración segura de lectura y el writer server-side probado. La UI administrativa de escritura permanece `BLOCKED BY ADMIN AUTH`; no se abrió escritura pública ni se inició otra H. No hay metadata Git ni `WORK_QUEUE`, limitaciones declaradas para diff/continuidad.

## H-008 — 2026-08-21

**Objetivo:** reemplazar el Admin simulado por Supabase Auth y autorización backend/RLS, promoviendo únicamente H005_TEST y habilitando escritura visual segura.

**Implementación:** migración/recovery de `admin_assignments`, función de permiso, policies de tablas/Storage y `admin_audit_log`; aprovisionador limitado al alias autorizado; `AdminRepository`; gate real; editor Supabase de icono, sello, textos e instalación 1–3. H005_TEST2/3 no recibieron asignación ni cambio de credenciales. Bundle regenerado desde 64 fuentes.

**Validación:** prueba remota reversible `PASS` para escritura de settings, Storage, instalación, auditoría, dos clientes y restauración; normal/anónimo `DENIED`. Chrome headless: H005_TEST Admin y escritura UI `PASS`; H005_TEST2/3 Admin `DENIED`; los tres conservaron app normal, sesión y logout. Pruebas estáticas H-007/H-007.2/H-007.3, icono/H-008 y sintaxis del bundle `PASS`.

**Seguridad y legacy:** permisos derivados solo de `auth_user_id`; ningún cliente puede promoverse; sin clave administrativa en bundle/logs/docs. Ahorro, Préstamos y Google financiero tuvieron `NO INTERACTION`. No existe metadata Git ni `WORK_QUEUE`; no se inicia otra H.

**Revisión arquitectónica:** `APPROVED`. El reviewer contrastó solicitud, SQL/recovery, lectores/escritores, bundle, pruebas remotas/browser, gobierno, secretos y legacy. No detectó un defecto que impida cerrar H-008 ni una decisión nueva del propietario.

## H-009 — 2026-08-21

**Objetivo:** habilitar CRUD administrativo real de branding, banners, popups, empresas/assets y documentos PDF mediante la Auth/RLS H-008, sin fuentes locales ni legacy financiero.

**Implementación:** migración/recovery H-009, origen histórico/administrativo explícito, desactivación de empresas/documentos, grants por columna, policies de lectura admin/pública, reemplazo empresarial atómico, `AdminRepository` CRUD/upload/cleanup y `VisualCrudModule`. Bundle de 65 fuentes, `v69`, cache PWA `v14`.

**Validación:** 67 filas históricas preservadas, una asignación admin y RLS forzada. Prueba reversible de cuatro dominios, reemplazos, dos clientes, denegaciones normales, Storage, auditoría y cleanup `PASS`; conteos finales 33/23/3/8. Chrome: cuatro módulos y ciclo UI popup `PASS` para H005_TEST; H005_TEST2/3 `DENIED`; regresiones H-005–H-008 y H-007.2/.3 `PASS`.

**Legacy/seguridad:** cero fallback `DATA`/Glide/`localStorage` en writers migrados; cero secretos browser; Ahorro, Préstamos y Google financiero `NO INTERACTION`. No existe metadata Git ni `WORK_QUEUE`; no se inicia otra H.

**Revisión arquitectónica:** `APPROVED`. El reviewer contrastó la solicitud con migración/recovery, RLS y grants, repositorios/UI, pruebas estáticas, remotas y browser, reconciliación, auditoría, secretos y fronteras legacy. No detectó defecto ni decisión nueva que impida cerrar H-009. No se inicia otra H.

## Claude UI Preservation Guardian / Convenios — 2026-08-21

**Objetivo:** crear `claude-ui-preservation-guardian` y aplicarla inmediatamente a Convenios para restaurar el contrato Claude Design sin abandonar la autoridad Supabase H-007.3/H-009.

**Hallazgo y corrección:** la versión H-007.3 había reducido Convenios a TopBar, buscador y lista. Se restauraron espacio/carrusel publicitario, posición e indicadores, estado `PATROCINADO`, filtro y chips, Destacados con estado pendiente no inventado, favoritos con motion, badges de descuento pendiente, lista completa, detalle, beneficios pendientes, credencial, acciones y control admin deshabilitado hasta backend. Categorías, ubicación y contacto provienen de `CompaniesRepository`; publicidad activa proviene de `BannerRepository('marketplace')`.

**Autoridad:** cero `DATA`, `adminStore`, `companyStore`, `catalogStore`, Glide o `localStorage` en Convenios. Los estados destacados/descuento/beneficios no inventan negocio y permanecen `PENDING`. No hubo schema, migración ni escritura remota.

**Validación:** Skill y metadata creadas; validación estática propia `PASS`. El validador oficial `quick_validate.py` no pudo ejecutarse por ausencia preexistente de `PyYAML`. Bundle de 65 fuentes y regresiones H-007/H-007.2/H-007.3/H-008/H-009 `PASS`. Chrome headless con H005_TEST2 confirmó 33 empresas, estructura, filtro, favorito, detalle, sesión, refresh y logout. Ahorro, Préstamos y Google financiero tuvieron `NO INTERACTION`; no se inicia otra H.

## MASTER Phase 1 — 2026-08-21

**Capacidad:** onboarding verificado, recuperación nativa, permisos técnicos de identidad, impersonación administrativa segura, actor real/contexto, multiusuario y regresión Auth/RLS.

**Implementación:** migraciones `20260821000700/701`, recovery, auditoría de identidad, sesión con motivo/TTL, RLS de afiliado efectivo, RPC de claim/búsqueda/inicio/cierre; `AffiliateRepository`, `AffiliateAuth`, `AdminRepository`, módulo de identidad y banner persistente. Bundle de 66 fuentes, `v71`, cache PWA `v16`.

**Validación:** reconciliación remota 947 afiliados/3 Auth/1 admin/0 promociones inesperadas; suite live con tres usuarios, normales denegados, contexto no anidado, actor/contexto y restauración `PASS`; H-005/H-008/H-009, protección Claude UI y Chrome integral `PASS`. No se crearon cuentas, no se expusieron secretos y Google/Ahorro/Préstamos tuvieron `NO INTERACTION`.

## MASTER Phase 2 — 2026-08-21

**Decisión:** Supabase es autoridad de contenido dinámico; Claude Design permanece contrato; Noticias inicia vacía; Educación/Tutoriales puede usar su fuente histórica; menús/rutas/formularios no se vuelven database-driven.

**Implementación:** `news_articles`, `news_settings`, `educational_resources`, `managed_copy_overrides`, permisos/RLS/auditoría/recovery; repositories y estados sin fallback; Admin Noticias/Educación y copy Supabase. Snapshot educativo 32 filas, 12 procedencias, 11 objetos Storage; todo despublicado. Bundle `v72`, PWA `v17`.

**Validación:** estáticos acumulados PASS; reconciliación live 0/32/0, forced RLS y un admin; CRUD/RLS multiusuario reversible PASS; Chrome confirmó Noticias, Educación, Auth, PWA, Convenios y H-005–H-009. Google fue `READ ONLY`; Ahorro/Préstamos/lógica financiera `NO INTERACTION`.

## MASTER Phase 3 — 2026-08-21

**Auditoría/autoridad:** lectura Google comercial acotada y read-only. Tres categorías inequívocas se fijaron en snapshot; hojas sin registros y filas empresariales/presupuestos ambiguas no se importaron. Supabase quedó como única autoridad productiva del comercio.

**Implementación:** migraciones/recovery `20260821000900/901/902`, nueve tablas con RLS, membresía tenant, RPCs, assets de categoría, `MarketplaceRepository`, stores sin persistencia local y conexión de la UI Claude en Marketplace, Convenios, Admin y Panel Empresarial. `00902` retiró mutaciones directas de cotizaciones/solicitudes y exige firma/términos en backend. Bundle `v73`, PWA `v18`.

**Validación:** estática, live reversible y Chrome real `PASS`; aislamiento usuario/empresa, denegación cross-tenant, bandeja/cotización y cleanup confirmados. Reconciliación final 3 categorías/0 productos/0 solicitudes/0 membresías. Legacy financiero `NO INTERACTION`.

**Guardians/reviewer:** Claude UI `APPROVED`. El reviewer detectó y exigió cerrar un bypass de mutación directa; tras `00902`, repetición multiusuario/RLS, navegador y reconciliación, emitió `APPROVED`. La cola avanzó automáticamente a Phase 4.

## MASTER Phase 4 — 2026-08-21

**Auditoría/autoridad:** Google read-only confirmó seis filas completas en `Membresias`. `Solicitudes membresía` contiene 467 transacciones con PII/documentos/nómina y quedó aislada como legacy; no se leyó masivamente, copió ni escribió. Programas se descompuso por autoridad y no recibió tabla genérica.

**Implementación:** migraciones/recovery `20260821001000/1001`, `membership_offerings`, seis logos Storage, RLS/grants por columna, procedencia histórica inmutable, `MembershipRepository`, store en memoria y UI Claude pública/Admin. Bundle `v74`, PWA `v19`.

**Validación:** regresión acumulada, live reversible y Chrome real `PASS`; 6/6 catálogo/assets, writer normal denegado, CRUD Admin, histórico no borrable y cleanup confirmado. Legacy financiero/PII `NO MIGRATION / NO WRITE`.

**Guardians/reviewer:** Claude UI y reviewer arquitectónico `APPROVED` después de restringir grants por columna y bloquear borrado histórico. La cola avanzó automáticamente a Phase 5.

## MASTER Phase 5 — 2026-08-21

**Resultado:** `operationsStore` proyecta solicitudes/cotizaciones comerciales Supabase en Mi Historial y Tracking Claude. Se retiraron `DATA.solicitudes`, `financeStore` y `flowStore/localStorage` del camino productivo; historial financiero queda `PENDING LEGACY` visible.

**Validación:** regresión acumulada `PASS`; Chrome con solicitud comercial efímera confirmó lista, ausencia de `ID-2941`, detalle y timeline. Cleanup/reconciliación regresó Phase 3 a 3 categorías y cero productos/solicitudes/cotizaciones/membresías. Guardians/reviewer `APPROVED`.
# 2026-08-21 — Phase 6 Portal Empresarial (BLOCKED en aplicación remota)

- Se implementó localmente el esquema aditivo/reversible de planes y suscripciones empresariales, sin semillas inventadas.
- Se conectó el CRUD Claude de Planes y se eliminaron métricas demostrativas del Panel Empresarial.
- Bundle y regresiones estáticas pasan; la aplicación productiva fue rechazada por el control externo de aprobación, por lo que Phase 6 no se declara terminada.
- Evidencia: `docs/PHASE6_COMPANY_PORTAL_REPORT.md`.

# 2026-08-22 — Phase 6 Portal Empresarial (aplicación autorizada)

- El propietario autorizó `python scripts/apply-phase6.py` con aborto estricto, cero registros inventados y protección de afiliados, Auth, empresas, históricos y legacy.
- Se reforzó el aplicador para validar colisiones/dependencias antes de escribir y el catálogo completo después; la primera ejecución abortó sin cambios por una firma de preflight incorrecta, se corrigió a `is_marketplace_company_member(uuid,text)` y la migración aplicó en transacción.
- Reconciliación remota: 2 tablas vacías, 4 policies del portal, 3 policies administrativas de membresía, 4 triggers, 2 índices, RLS forzada; 947 afiliados, 3 Auth, 33 empresas, 0 membresías, 0 planes y 0 suscripciones.
- La suite multiusuario de tres sesiones pasó sin persistir fixtures. Chrome real detectó y permitió corregir una carrera de carga del store Admin; después confirmó 0 planes, 33 empresas, estado pendiente y contrato Claude preservado.
- Bundle `v76`, cache PWA `v21`, regresión estática acumulada, auditoría, Auth live read-only, contenido institucional live y reconciliación final: `PASS`. Ahorro, Préstamos y Google legacy: `NO INTERACTION`.
- Evidencia: `docs/PHASE6_COMPANY_PORTAL_REPORT.md`.

# 2026-08-22 — Phase 7 legacy financiero (auditoría read-only)

- Tras `APPROVED` de Phase 6, la cola avanzó a Phase 7 en modo auditoría; Google Sheets se consultó únicamente para metadata y rangos acotados, sin escrituras.
- El archivo vigente tiene 98 pestañas. Ahorro depende de 9 hojas y una matriz de 127 columnas; Préstamos combina historiales, amortización oculta, queries, fondos, criterios, reportes y conciliaciones.
- Equivalencia `FAIL`: Google define/cacula tasa quincenal, mientras el prototipo la etiqueta mensual y divide las quincenas entre dos. `financeStore`, seeds y `localStorage` continúan no autoritativos.
- Apps Script, triggers, writers y propietario operacional no fueron accesibles/demostrados. No se modificó Ahorro, Préstamos, Google, Supabase ni frontend financiero.
- Resultado: `OWNER_DECISION_REQUIRED` entre mantener Google con adaptador seguro (recomendado) o autorizar una migración gradual con shadow reconciliation, backup y cutover de writers.
- Evidencia: `docs/PHASE7_FINANCIAL_LEGACY_AUDIT.md`.

# 2026-08-22 — MASTER ASSET EVACUATION (bloqueo por pérdida real)

- Se inventariaron 163 columnas y 25,358 referencias en el Excel maestro y las 98 hojas de SutiApp Final; el catálogo versionado no contiene URLs privadas.
- Se validaron 14,477/14,480 URLs únicas, se registraron 13,195 objetos físicos, se subieron 13,047 privados y 3 públicos nuevos, y no quedaron objetos faltantes o huérfanos.
- Las 12,901 referencias de Usuarios quedaron asociadas a los 947 `affiliate.id` UUID por fila/`numero_control` exactos; cero ambigüedades. 12,299 referencias de dominios pendientes no recibieron cutover.
- RLS multiusuario, Storage, hashes, reconciliación y regresión estática pasaron. Chrome pasó Phase 3–5; dos tests integrales antiguos revelaron un selector obsoleto y un bootstrap Phase 6 que muestra cero empresas pese a conservarse 33 en Supabase. No se amplió frontend por el bloqueo real de fuente.
- Se eliminó un único popup residual `ADMIN_H009` de prueba, se restauró la relación aprobada del sello institucional y se sincronizó `icon-512.png` desde Supabase; no se alteraron filas históricas/productivas.
- `RUNTIME_GLIDE_FILE_DEPENDENCIES=0` y `UNMAPPED_FILE_COLUMNS=0`.
- Tres íconos (`Íconos!B2:B4`) no son recuperables desde Firebase (HTTP 402), Google Storage alterno (403), el archivo vigente ni cuatro respaldos aprobados. Resultado: `BLOCKED — REAL_SOURCE_FILE_LOSS`; se requieren los originales o restaurar el proyecto Firebase. No se inventaron sustitutos.

# 2026-08-22 — Aceptación operativa de MASTER ASSET EVACUATION

- El propietario aceptó `OPERATIONALLY COMPLETE / HISTORICAL RECOVERY PENDING` y autorizó continuar el MASTER PLAN con `HISTORICAL_ASSET_RECOVERY_PENDING=3`.
- `Íconos!B2:B4` permanece registrado como no recuperado; no recibe sustituto, fallback ni reintento normal. El checkpoint solo los reabre con `--retry-failed` explícito.
- Esta aceptación no cambia la autoridad ni resuelve la decisión financiera Phase 7, que permanece independiente como `OWNER_DECISION_REQUIRED`.

# 2026-08-22 — Phase 7 Opción A autorizada

- El propietario resolvió Opción A: Google Sheets + Apps Script permanecen autoridad operacional y no se autoriza migración financiera a Supabase.
- Se implementó una Edge Function read-only que deriva identidad/`numero_control` desde Auth y afiliado efectivo, rechaza selectores del browser y llama al legacy con secreto server-side.
- Se retiraron cálculos y persistencias financieras locales del camino productivo; Préstamos/Marketplace muestran estado controlado y no habilitan escrituras.
- La conexión real queda pendiente de endpoint/secretos Apps Script y comparación multi-caso; no se inventaron credenciales, fórmulas ni resultados.
- La regresión Chrome detectó y permitió corregir una carrera de cargas empresariales concurrentes; después Phase 6 volvió a proyectar 33 empresas y Phase 7 conservó estado pendiente, cero cifras mock/tasas locales y cero acceso browser a Google.

# 2026-08-22 — H-DATA-CUTOVER-001

- Se leyó `SutiApp Final` en modo read-only y se reconciliaron 37 dominios / 20 superficies Finanzas; `8 Suti Farma` fue el control verificable.
- Se creó una migración aditiva y recovery para catálogos por programa, assets relacionales y solicitudes Farma con actor real/afiliado efectivo bajo RLS.
- Se importaron `134/134` filas y enlazaron `268/268` referencias a objetos ya evacuados; cero descarga/copia física. Farma quedó `50/50` y `1/1` asset.
- La navegación Claude y `Disponibles ahora` se restauraron desde estructura en código + Repository. Se eliminó el helper de listings mock; loading/error/empty conservan secciones.
- Live RLS multiusuario: anon 401, escritura directa 403, payload interno 403, cross-user request/favorite 0, RPC legacy 400; fixtures eliminados. La consulta Repository devolvió 268 joins y la firma Storage autenticada individual/por lote pasó tras calificar explícitamente `storage.objects.name` en la policy. El Repository firma por lote y evita rondas secuenciales por producto.
- Browser visual: BLOCKED por timeout CDP antes de navegación en Chrome y Edge; la suite Phase 4 de control falla igual, por lo que no se atribuye regresión a esta H.
- El primer review arquitectónico detectó que `money()` dejaba en `NULL` los precios proyectados. Se corrigió el parser, se regeneró el snapshot canónico y se reaplicó el upsert: `65/65` precios de contado/lista tipados, conservando sus valores raw y sin proyectar precio financiero.

# 2026-08-22 — MASTER solicitudes reales en Supabase

- El propietario aprobó ADR-038: la intención inicial usa Supabase y el procesamiento financiero posterior conserva Google legacy cuando aplique.
- Se añadió `program_requests` como frontera única posterior al corte, con identidad derivada, snapshot `numero_control TEXT`, RLS self/company/Admin, estados claros e idempotencia backend.
- Todos los renglones habilitados de `program_catalog_items` pasan a permitir solicitud inicial; `legacy_boundary` solo marca revisión financiera posterior y no bloquea el alta.
- Los CTA, detalle, sheet, firma, confirmación, folio y navegación Claude permanecen; se retiró copy técnico visible y se añadió estado en Mi Historial y bandeja Admin.
- Las tablas anteriores conservan el histórico y dejan de recibir altas nuevas, sin copiar ni borrar solicitudes; no hubo interacción con Google, cálculos ni doble escritura.
- Una migración complementaria restringió las columnas legibles desde browser: firma, clave idempotente y contexto interno quedan fuera de los grants. La suite live multiusuario y Chrome real se repitieron después del endurecimiento con resultado `PASS` y limpieza total de fixtures.

# 2026-08-22 — Phase 7 handoff técnico autorizado

- Se creó únicamente `SutiApp Financial Handoff` como pestaña 99 de `SutiApp Final`, sin modificar las 98 pestañas financieras/legacy existentes, fórmulas o triggers.
- Se versionó un Apps Script receptor idempotente por `program_request_id`, protegido por secreto en Script Properties y `LockService`; no escribe fuera de la pestaña técnica.
- Se desplegó `financial-legacy` con validación Auth→afiliado efectivo→`numero_control`→solicitud propia y actualización limitada a metadata posterior al acuse Google.
- Pruebas locales: idempotencia/secreto/no financiera `PASS`; bundle reproducido y Chrome real Phase 7 `PASS`, sin cálculos locales ni acceso Google desde browser. Pruebas remotas: anónimo 401, ajena/inexistente 404, no financiera 409; válida permanece 503 hasta configurar el Web App y sus secrets.
- No se conectó la cola a ningún cálculo/writer. OAuth Apps Script, deployment y prueba end-to-end permanecen pendientes; Phase 7 no avanza a Phase 8.

# 2026-08-22 — Phase 7 pausada por prioridad del propietario

- OAuth y Apps Script API quedaron habilitados; se creó el proyecto ligado `SutiApp Financial Handoff`, se subió el receptor auditado y el deployment final quedó en versión 3.
- La Edge Function final fue redesplegada usando los nombres server-side `FINANCIAL_LEGACY_API_URL/TOKEN`; no se creó ningún secret parcial.
- El intento de transferencia por portapapeles fue bloqueado antes de ejecutarse; no se generó ni expuso un secreto.
- Por instrucción expresa del propietario, Phase 7 queda `PAUSED — OWNER PRIORITY SHIFT` exactamente antes de configurar el secreto compartido. No se revierte código, pestaña, proyecto, deployment, Edge Function, RLS o seguridad; Google financiero permanece intacto y Phase 8 no inicia.
# 2026-08-22 — Corrección de frontera de export aprobado

- El propietario corrigió ADR-039: el alta del usuario permanece exclusivamente en `program_requests`; solo una aprobación Admin backend podrá autorizar un append en `Historial de solicitudes`.
- Se retiraron los dos disparos prematuros existentes: el envío desde Catálogo y el retry automático al cargar/actualizar Mi Historial. No cambió estructura, copy, navegación ni componentes Claude.
- La auditoría live read-only confirmó `Historial de solicitudes` como hoja `2237 × 38` y detectó contratos no resueltos para D Proceso, M afiliación, Y estado inicial, documentos O:W y plazo. `program_requests` tampoco conserva todavía todo el payload inicial requerido.
- El writer final queda `BLOCKED` y fail-closed; no se modificó Google, Apps Script, pestaña técnica, fórmulas, triggers, filas, otras hojas ni datos Supabase.
- Evidencia: `docs/APPROVED_LOAN_EXPORT_CONTRACT.md` y `scripts/test-phase7.js`.

# 2026-08-22 — Expediente financiero mutable y snapshot histórico

- El propietario autorizó las columnas 58/60 del Excel exacto sólo como seed inicial; `public.affiliates` queda como autoridad actual de sindicato/categoría/tipo/estatus laborales después del corte.
- Se extendió la pantalla Claude existente `Identidad y contexto` con un expediente editable, sin crear una segunda UI. La escritura exige `affiliates.write`, RPC backend, versión optimista, motivo y auditoría durable por campo/actor.
- Fondo, tasa, plazo/monto máximos y resultado no se guardan como identidad. La Edge Function consulta el perfil Supabase vigente y lo envía al adaptador Google read-only; un perfil incompleto falla visiblemente.
- Las solicitudes financieras capturan perfil al solicitar y una aprobación común queda bloqueada hasta que el backend persiste un snapshot completo e inmutable con contexto, resultado y regla/versión administrativa.
- Se añadió seed exact-hash y recovery que revoca writers sin borrar datos. El dry-run sobre la copia exacta pasó con 947 filas: 16 categorías nulas (un `#N/A`) y 177 sindicatos nulos, preservados sin inferencia. La ejecución bulk fue detenida por la barrera de aprobación externa y requiere confirmación separada; no se modificó Google, `Criterios de fondos`, `SutiApp Final` ni Apps Script.

# 2026-08-22 — BULK_INITIAL_FINANCIAL_PROFILE_SEED aplicado

- El propietario autorizó expresamente el seed masivo de categoría y sindicato para los 947 afiliados, con `public.affiliates` como autoridad productiva posterior y cero escrituras Google.
- El workbook exacto SHA-256 `F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591` validó 947 filas, columnas 58/60, 16 categorías NULL, 177 sindicatos NULL y un `#N/A` conservado como NULL.
- La RPC transaccional devolvió el batch idempotente `82179501-f85b-50c3-b7ae-7f6998852163`: 947 afiliados, 931 categorías, 770 sindicatos, 0 mappings inválidos, 947 snapshots de recovery y 1,701 eventos `BULK_INITIAL_FINANCIAL_PROFILE_SEED` (931 categoría + 770 sindicato).
- La prueba reversible confirmó edición Admin, refresco del contexto de elegibilidad y restauración; dos usuarios normales fueron denegados, la escritura directa fue denegada y la auditoría durable pasó.
- `financial-legacy` fue desplegada como versión 3 `ACTIVE` con JWT habilitado. La prueba post-deploy confirmó anónimo 401, usuario normal 403 y `Google writes: 0`.
- `Criterios de fondos`, `SutiApp Final`, `Historial de solicitudes` y Apps Script no fueron modificados.

# 2026-08-23 — H-MASTER-REM-001, primer corte transversal

- Se auditó la solicitud maestra y el PDF contra las 25 herramientas Admin y los contratos de autoridad, seguridad, legacy y preservación Claude; el inventario y la matriz de observaciones quedaron en `MASTER_FUNCTIONAL_AUDIT_2026-08-23.md`.
- Home dejó de fijar `homeBanners[0]`: rota la colección Supabase, conserva swipe/dots, abre acciones HTTP(S) seguras y permite ampliar imágenes.
- Se incorporó un visor global reutilizable con pinch, pan, rueda, reset y teclado en Home, Convenios, artículos y catálogo, preservando la estructura Claude.
- Admin Visual CRUD expone borrado confirmado sólo para contenido no histórico. Se detectó que H-009 había omitido el grant SQL `DELETE`; `20260823000300` prepara policies restringidas a `ADMIN_H009` y recovery exacto sin DML.
- La aplicación remota quedó `BLOCKED`: el acceso Supabase Management respondió `403`. No se aplicaron migraciones, no se modificaron filas y no hubo interacción con Google financiero.
- Verificación estática acumulada y bundle: `PASS`; auditoría general: exit `0`, 309 coincidencias clasificables, `REVIEW REQUIRED`.
- Segundo corte: Noticias incorporó formato seguro y vista previa sobre `news_articles.body`; el artículo reutiliza el renderer sin `dangerouslySetInnerHTML` ni nueva autoridad.
- Educación y Tutoriales quedaron separados por pestañas sobre `resource_kind`, y los CRUD visuales extendieron ordenamiento a todos sus recursos.
- Bundle reproducido desde 78 fuentes y PWA avanzado a `v93`/`v38`; regresión Phase 2, Admin, H-007.2, Phase 3, Phase 7 y preservación Claude: `PASS`.

# 2026-08-23 — H-MASTER-REM-SEC-001/002, corte de seguridad live

- Se recuperó el acceso Supabase Management usando el contexto local ya autorizado; el proyecto vinculado respondió `ACTIVE_HEALTHY` y no se solicitó ni expuso otro secreto.
- Se auditaron live RLS, policies, grants, funciones, roles, auditoría y conteos. La migración rechazada `20260823000200` y sus objetos no estaban desplegados.
- Se ejecutó exclusivamente `20260823000300`: cuatro DELETE policies quedaron limitadas a `ADMIN_H009`, cuatro grants fueron reconciliados y las tres policies amplias desaparecieron. SHA-256 `A4E5D4E9811E9AE266D0FF882A41CF660FA4389B453E4FD7D8F085FD30915197`.
- La matriz reversible pasó para Admin, dos usuarios normales y anónimo; 67 filas históricas permanecieron, el fixture Admin fue borrado, auditado y limpiado. La UI Chrome confirmó el borrado.
- El recovery de `00300` pasó en dry-run transaccional. No se aplicó persistentemente.
- `apply-master-remediation.py` fue clasificado `FORBIDDEN_AS_IS` y neutralizado fail-closed para impedir que instrucciones antiguas desplieguen `00200`.
- Se creó una foundation local, aditiva y no desplegada para capacidades UUID por sección/acción. Todas las secciones quedan `DESIGN_ONLY`; autoasignación, grants directos y herencia `.write` están bloqueados. Migration + recovery compilaron contra live y terminaron en `ROLLBACK`, sin residuos.
- No hubo interacción ni modificación de Google, fórmulas, triggers, conciliaciones o datos financieros. No se modificó frontend en este corte de seguridad.

```text
H-MASTER-REM-SEC-001/002 RESULT
Status: PASS (master general IN_PROGRESS)
Files changed: scripts/apply-master-remediation.py; scripts/test-master-delete-live.py; scripts/test-granular-section-foundation-live.py; supabase/migrations/20260823000400_granular_section_capability_foundation.sql; supabase/recovery/20260823000400_granular_section_capability_foundation_recovery.sql; docs/GRANULAR_SECTION_RESPONSIBILITY_DESIGN.md; docs/MASTER_FUNCTIONAL_AUDIT_2026-08-23.md; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — autoridad live sin cambio; foundation local no desplegada
Invariant verdict: PASS — históricos preservados; sin fallback ni autoridad múltiple
Build: NOT APPLICABLE — sin cambios frontend/bundle
Tests: PASS — py_compile, tombstone, delete live, migration+recovery rollback
Security: PASS para 00300 live; 00400 DESIGN_ONLY/NOT DEPLOYED; 00200 REJECTED
Legacy impact: NOT APPLICABLE / NO INTERACTION
Unexpected files changed: none; tres .pyc de verificación eliminados
Known limitations: ownership no es productivo; requiere enforcement completo por sección
Evidence: MASTER_FUNCTIONAL_AUDIT_2026-08-23.md + GRANULAR_SECTION_RESPONSIBILITY_DESIGN.md
```

# 2026-08-23 — H-MASTER-REM-NEWS-001, piloto ownership Noticias

- Se desplegó la foundation UUID y el enforcement exclusivo de Noticias. Acciones `read/create/update/delete/publish/order/assets` son independientes; otras nueve secciones permanecen `DESIGN_ONLY`.
- H005_TEST administra responsabilidades por email confirmado resuelto a UUID. Autoasignación se deniega, asignación/revocación se audita y el responsable no recibe roles técnicos ni acceso cruzado.
- RLS por operación, triggers `OLD/NEW` y rutas Storage `news/<auth.uid()>/` hacen cumplir las capacidades en backend. `record_origin` permanece inmutable y el borrado histórico no se abrió.
- Admin preserva la estructura Claude: gestión de responsables sólo para principal, menú aislado para responsable y controles exactos por acción. Bundle reproducido desde 78 fuentes; HTML `v94`, PWA `v39`.
- Matriz viva reversible y Chrome real: `PASS`; revocación inmediata/nueva sesión, reflexión pública, auditoría, aislamiento, normal/anónimo y cleanup confirmados. Cero fixtures residuales y cero históricos tocados.
- Recovery completa `00502 → 00501 → 00500 → 00400`: `PASS` transaccional con `ROLLBACK` y cero escrituras persistentes. Google/finanzas: `NO INTERACTION`.

```text
H-MASTER-REM-NEWS-001 RESULT
Status: PASS
Files changed: migrations/recoveries 00400, 00500, 00501, 00502; AdminRepository/AffiliateAuth/Admin Noticias/Admin root; bundle/PWA; pruebas y documentación de evidencia
Source-of-truth verdict: PASS — contenido Supabase intacto; responsabilidad UUID es autoridad de autorización separada
Invariant verdict: PASS — sin fallback, autoescalación, acceso cruzado ni borrado histórico
Build: PASS — 78 fuentes; bundle syntax PASS; v94/v39
Tests: PASS — estáticas, regresiones, matriz live, Chrome real, cleanup y recovery completa
Security: PASS — backend/RLS/trigger/Storage; revocación y auditoría verificadas
Legacy impact: NOT APPLICABLE / NO INTERACTION
Unexpected files changed: none
Known limitations: sólo Noticias está ENFORCED; nueve secciones continúan DESIGN_ONLY
Evidence: MASTER_FUNCTIONAL_AUDIT_2026-08-23.md + GRANULAR_SECTION_RESPONSIBILITY_DESIGN.md
```
## 2026-08-23 — H-MASTER-REM-OWNERSHIP-ALL-001

**Resultado:** `PASS`. Las nueve definiciones inicialmente `DESIGN_ONLY` y la frontera omitida `minutes` replicaron el patrón Noticias; live termina con 11 `ENFORCED` y cero `DESIGN_ONLY`.

**Implementación:** migraciones/recovery `00600/00601`, acciones exactas por `OLD/NEW`, RLS, auditoría, paths Storage por sección+UUID, protección de origen en filas y relaciones, panel reutilizable “Responsable de la sección”, rutas Admin aisladas, Minutas/Programas administrables y reflexión pública por `enabled`.

**Evidencia:** migración+recovery y hardening+recovery compilaron con `ROLLBACK`; apply live `PASS`; matriz reversible de diez dominios `PASS` para UUID, CRUD, publish/order/assets aplicables, aislamiento, normal/anónimo, self-escalation, revocación y sesión nueva; 11/11 `ENFORCED`, seis relaciones con origen y cero fixtures/asignaciones residuales. Bundle con Babel y `node --check` `PASS`; caché avanzado a HTML `v95`/PWA `v40`; tests mass/Claude/H-009/Phase2/Phase3/Noticias `PASS`. Google/finanzas: `NO INTERACTION`.

## 2026-08-23 — H-ADMIN-DATA-EXPORT-001

- Se añadió localmente `Admin → Datos y respaldos` con 17 dominios operativos, XLSX principal, CSV, filtros allowlisted, conteo autorizado y advertencia PII.
- La frontera es `DataExportRepository → data-exports Edge → Supabase`; no existen lecturas directas de tablas desde el módulo UI ni nombres de tabla/columna aportados por el navegador.
- `data_exports.read` queda reservado al permiso técnico global y la acción independiente `export` habilita sólo la sección de un responsable. Leer/editar/publicar no implica exportar.
- `data_export_audit_log` conserva únicamente actor, dominio, filtros, conteo, formato y fecha. Archivos directos `no-store`, sin Storage público; Auth, firmas, payloads internos, rutas/hashes y secretos quedan excluidos.
- Bundle reproducido desde 81 fuentes, HTML `v96`; contrato nuevo, sintaxis de bundle, ownership y preservación Claude estática: `PASS`.
- Tras autorización explícita del propietario se añadieron `status` y `column_set`, se repitieron dry-runs y se desplegaron Edge+migración. Matriz live completa `PASS`: global, default deny, `news.export`, cross-domain, normal/anónimo, revocación, XLSX/CSV, filtros, conteo, auditoría y cleanup; cero grants automáticos. Recovery→reapply post-deploy pasó con `ROLLBACK`.
- La revisión arquitectónica detectó y corrigió el único borde: 20,000 filas exactas ahora se permiten y la 20,001 dispara `EXPORT_ROW_LIMIT_EXCEEDED`. Edge redesplegada y matriz live repetida `PASS`; veredicto final `APPROVED`.
- Corrección post-activación: el frontend era bloqueado porque `data-exports` buscaba `ALLOWED_ORIGINS`, inexistente, mientras producción define `ALLOWED_APP_ORIGINS`. Se unificó el nombre, se redesplegó y la matriz con `Origin: http://localhost:8080` pasó `browser_cors=true` sin cambiar grants, datos ni UI.
- Cierre operativo asistido: se preservó el diagnóstico sanitizado/frontend v97 de Fable, se sirvió la app en `http://localhost:8080` ya allowlisted y se abrió esa URL. XLSX cambió únicamente su MIME a `application/octet-stream` para preservar el ZIP en `supabase-js`; Edge redesplegada y matriz autenticada completa `PASS` con bytes `PK`, CSV, CORS, permisos, auditoría, revocación y cleanup.
- Google, Apps Script, fórmulas, triggers, amortización, saldos, cálculos y conciliaciones: `NO INTERACTION`.

# 2026-08-23 — TU SINDICATO CANONICAL CUTOVER (active)

- Se creó un único registry de nueve pantallas y se conectó a Home/Admin; Convenios navega a la pantalla real y los cinco módulos institucionales reutilizan sus editores autoritativos con filtros.
- Se incorporó CRUD de Comité sobre `directory_members` y se retiró del dominio `union_*` toda dependencia productiva de `image-slot`, `FileReader.dataUrl` y almacenamiento del navegador.
- Tras autorización explícita del propietario, `20260823000800` se aplicó en live. La matriz reversible confirmó Admin, normal/anónimo denegados, histórico no eliminable, alta/edición/orden/publicación, procedencia, Storage y relación de cabecera; cleanup exacto y 30/30 miembros históricos preservados.
- La primera matriz detectó que `source_sheet` conservaba su default legacy. Se corrigió idempotentemente dentro de la misma migración retirando sólo ese default, sin modificar filas; la repetición completa quedó `PASS`.
- Chrome headless real confirmó 9/9 tarjetas en Home y Admin, Convenios directo, Comité 30/30, editor con uploads gestionados, cero `image-slot`/data URL y cero excepciones runtime. Bundle de 82 fuentes y suites estáticas pasaron.
- Google financiero, Apps Script, criterios de fondos, fórmulas, históricos y cálculos: `NO INTERACTION`.

# 2026-08-24 — H-LOAN-UI-AUTORECALC-001

- Se aplicó el rediseño visual autorizado de Suti Préstamo sobre el contenedor productivo existente, sin sustituir `FinancialLegacyRepository`, `useFinancialLegacy`, `loadOverview`, `requestQuote` ni `FinancialSimulationResult`.
- Fondo, monto y plazo disparan consulta autoritativa automática; monto usa debounce de 320 ms. La cola runtime limita a una solicitud simultánea y el resultado solo se confirma si corresponde a la selección vigente.
- Se retiró `Actualizar simulación`; error conserva `Reintentar`. Tarjeta, fondos, slider, plazo, desglose, impacto/talón `DISABLED/PENDING`, estados y scroll permanecen. Motion respeta reduced-motion.
- Bundle reproducido desde 82 fuentes, HTML `v101`, PWA `v45`. Pruebas estáticas financieras/visuales y Chrome real pasaron; browser confirmó fondo, monto, debounce, `max_in_flight=1`, ausencia del botón y cero excepciones. La sesión real solo ofreció un plazo.
- Google, Apps Script, Edge `financial-legacy`, Repository, Supabase, RLS, reglas, tasas, perfiles, solicitudes y datos: `NO CHANGE / NO WRITE`.

```text
H-LOAN-UI-AUTORECALC-001 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-loan-auto-recalc-browser.js; scripts/test-h007.js; scripts/test-h0072.js; docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — autoridad financiera y contrato sin cambios; cero fallback local
Invariant verdict: PASS — INV-008/012/015/016/036/055/056/057/058 preservadas
Build: PASS — 82 fuentes, Babel 7.29.0, bundle/sw syntax
Tests: PASS — loan cutover, Phase 7, H-007, H-007.2 y Chrome real
Security: PASS — sesión/backend existentes; ningún secreto o selector de identidad nuevo
Legacy impact: READ ONLY / NO CHANGE
Unexpected files changed: none; no metadata Git disponible
Known limitations: plazo live no ejercitable por existir una opción; baseline no contiene CTA productivo Destino
Evidence: docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md
```

# 2026-08-24 — H-LOAN-ASSISTED-051

- Se fabricaron y conectaron las tarjetas 6/12/18/24/“Otro”; todas las cifras provienen de `financial-legacy`, sin cálculo financiero frontend.
- Se creó `loan_term_policy` como autoridad mínima de UX y se intersecta con el máximo Google. Reglas legacy sin plazo válido se omiten.
- Cualquier administrador activo puede iniciar asistencia con motivo/TTL; solicitudes y nómina capturan actor real, afiliado contexto, sesión y motivo.
- Se añadió el destino catalogal `prestamo` para el alta real en `program_requests`, sin duplicar tasas o reglas Google.
- Migraciones y Edge desplegadas; recoveries probados con rollback; live/browser/reconciliación en PASS.

```text
H-LOAN-ASSISTED-051 RESULT
Status: PASS
Files changed: frontend loan/admin/auth/repositories/bundle/cache; Edge financial-legacy; migrations/recoveries 20260824000200/210; tests y gobierno ADR-051
Source-of-truth verdict: PASS — Google financiero + política UX Supabase sin superposición
Invariant verdict: PASS — actor/contexto auditados, cálculo backend, diseño completo
Build: PASS — 83 fuentes; bundle SHA-256 8DB713337EAEE03C554CE23F3D29A0E20FC371A204D1C89EB6B9E60E0564416F
Tests: PASS — static, live, recoveries y Chrome real
Security: PASS — RLS/RPC, anónimo 401, usuario normal denegado, TTL/no anidamiento
Legacy impact: READ ONLY para criterios; writer Google sin cambio
Unexpected files changed: no evaluable por ausencia de metadata Git; listado explícito en reporte
Known limitations: none dentro del alcance aprobado
Evidence: docs/FLEXIBLE_LOAN_ASSISTANCE_REPORT.md
```

# 2026-08-24 — H-LOAN-RESULT-COPY-001

- Se sustituyó exclusivamente `Pagarías por {periodicidad}` por `Cada pago será de` en la tarjeta de resultado.
- No cambiaron importes, cálculos, Edge, Supabase, Google, selección, navegación ni seguridad.
- Bundle de 83 fuentes, HTML `v106`, PWA `v50`; suites estáticas y Chrome real `PASS`.

```text
H-LOAN-RESULT-COPY-001 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; tests de loan/cache/browser; docs de evidencia
Source-of-truth verdict: NOT APPLICABLE — sólo copy
Invariant verdict: PASS — correspondencia fuente/bundle y UI preservada
Build: PASS — SHA-256 829778682CE2BB2EC8254EBE85210116E763403CF7761431A31BD4E7C9742313
Tests: PASS — static + Chrome real
Security: NOT APPLICABLE
Legacy impact: NO INTERACTION
Unexpected files changed: no evaluable por ausencia de metadata Git
Known limitations: ninguna
Evidence: docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md
```

# 2026-08-24 — H-LOAN-FUND-RATE-CARDS-001

- Las CARD de fondos muestran la tasa y periodicidad reales del overview (`rate` + `rate_period`) debajo del monto máximo.
- No se modificaron Edge, Supabase, Google, reglas, cálculos, solicitudes ni seguridad; el cambio es exclusivamente de presentación read-only.
- Bundle reproducido desde 83 fuentes, HTML `v105`, PWA `v49`. Chrome verificó `2% quincenal` y `3% quincenal` contra el overview y mantuvo selección, recálculo, nómina, cuatro pasos y navegación.

```text
H-LOAN-FUND-RATE-CARDS-001 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-loan-auto-recalc-browser.js; tests de cache; docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — Google/Edge siguen siendo autoridad de tasa y periodicidad
Invariant verdict: PASS — INV-015/036/055/057 preservadas
Build: PASS — 83 fuentes, bundle syntax, v105/v49
Tests: PASS — static + Chrome real; tasas coinciden exactamente con overview
Security: NOT APPLICABLE — sin cambio de Auth, RLS, RPC o secretos
Legacy impact: READ ONLY / NO WRITE
Unexpected files changed: no evaluable por ausencia de metadata Git
Known limitations: ninguna dentro del alcance
Evidence: docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md
```

# 2026-08-24 — H-LOAN-UI-VISUAL-FIDELITY-FIX-002

- La validación visual del propietario detectó que el corte anterior era insuficiente. Se corrigió la composición con gradiente/glow, tarjeta elevada de monto, slider, importes rápidos derivados del rango real, fondos, plazos comparables y footer fijo.
- Se restauró el flujo autorizado `Monto → Destino → Documentos → Resumen`, con bloqueo ante cotización stale, firma/términos y writer existente `ProgramRequestRepository.createFinancial`.
- `FinancialLegacyRepository`, `useFinancialLegacy`, `loadOverview`, `requestQuote`, `FinancialSimulationResult`, Edge, Google, Apps Script, reglas y datos permanecen sin cambios. Impacto y talón siguen `DISABLED/PENDING`.
- Se retiró del frontend la presentación especial hardcodeada de `$15 × pagos`; todo importe se obtiene del resultado autoritativo.
- Bundle 82 fuentes, HTML `v102`, PWA `v46`; suites estáticas y Chrome real `PASS`. Browser confirmó `visual_fidelity`, cuatro pasos, regreso, debounce, una consulta simultánea y cero excepciones.

```text
H-LOAN-UI-VISUAL-FIDELITY-FIX-002 RESULT
Status: PASS
Files changed: app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; scripts/test-loan-auto-recalc-browser.js; scripts/test-h007.js; scripts/test-h0072.js; docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — una autoridad financiera backend, cero fallback local
Invariant verdict: PASS — flujo vigente, resultado confirmado y writer productivo preservados
Build: PASS — 82 fuentes, bundle/sw syntax, v102/v46
Tests: PASS — loan cutover, Phase 7, H-007, H-007.2 y Chrome real
Security: PASS — repositorios y autorización backend existentes; cero secretos nuevos
Legacy impact: READ ONLY / NO CHANGE
Unexpected files changed: none; no metadata Git disponible
Known limitations: cambio de plazo live NOT APPLICABLE por perfil con una sola opción
Evidence: docs/LOAN_SIMULATOR_UI_CUTOVER_REPORT.md
```

# 2026-08-24 — H-LOAN-CUSTOM-MIN-ONE-001

- Por decisión expresa del propietario, el plazo personalizado “Otro” acepta desde 1 pago; las tarjetas sugeridas 6/12/18/24 y la leyenda “por quincena” permanecen sin cambio.
- Supabase `loan_term_policy` conserva la autoridad exclusiva de selección de plazo; Google conserva tasas, montos, máximos y reglas financieras. La Edge calcula la cotización de un pago.
- La migración guardada y aplicada exige el estado anterior exacto. Su recovery impide restaurar el mínimo 6 si ya existen solicitudes entre 1 y 5 pagos.

```text
H-LOAN-CUSTOM-MIN-ONE-001 RESULT
Status: PASS
Files changed: migración/recovery 20260824000220; screens-loan, bundle, HTML/PWA; scripts de aplicación, prueba estática/live/browser/cache; SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, DATA_MAPPING, reporte y changelog
Source-of-truth verdict: PASS — Supabase define rango UX; Google permanece autoridad financiera
Invariant verdict: PASS — sugerencias 6/12/18/24 intactas, personalizado mínimo 1, máximo Google
Build: PASS — 83 fuentes, bundle/sw syntax, HTML v108, PWA v52, SHA-256 27A8AECC8016E5D93CFA51C11BFFF06A756D3B476DB141FFEB2AC9241C30A162
Tests: PASS — static, live term=1, recovery transaccional y Chrome real term=1
Security: PASS — RLS/grants sin cambio, tabla directa y RPC anónima denegadas
Legacy impact: READ ONLY — tasas, reglas, máximos y cálculo Google sin cambio
Unexpected files changed: no evaluable por ausencia de metadata Git; inspección limitada al alcance declarado
Known limitations: ninguna dentro del alcance aprobado
Evidence: docs/FLEXIBLE_LOAN_ASSISTANCE_REPORT.md
```

# 2026-08-24 — H-LOAN-FUNDS-ROOT-CAUSE-001

- Se auditó read-only la hoja autoritativa `Criterios de fondos`, el perfil real, la Edge, el contrato Repository y Chrome real para explicar los ocho eventos 2026 de un pago.
- Los ocho eventos coinciden por categoría, sindicato y plazo. Al 2026-08-24, Google clasifica 3 `AVAILABLE`, 2 `UNAVAILABLE` y 3 `SCHEDULED`; por ello el backend incluye seis programas objetivo y la UI muestra tres eventos disponibles.
- Se corrigieron dos defectos generales: las sugerencias 6/12/18/24 dejaron de ser una puerta de elegibilidad, y el Repository acepta `termOptions: []` cuando existe un rango personalizado válido 1–1.
- No se añadieron excepciones por usuario/fondo/fecha, no se tocaron Google ni Apps Script y no se creó ninguna solicitud financiera.

```text
H-LOAN-FUNDS-ROOT-CAUSE-001 RESULT
Status: PASS
Files changed: supabase/functions/financial-legacy/index.ts; app/financial-legacy-repository.js; app/screens-loan.jsx; app/bundle.js; SutiApp.html; sw.js; scripts/test-loan-simulator-ui-cutover.js; scripts/audit-financial-funds-root-cause.js; scripts/test-financial-funds-multiprofile-live.js; scripts/test-one-payment-funds-live.js; scripts/test-assisted-loan-browser.js; docs/INVARIANTS.md; docs/FINANCIAL_FUNDS_ELIGIBILITY_ROOT_CAUSE_RESULT.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — criterios/tasas/fechas permanecen Google; perfil Supabase; política de plazo Supabase; cero autoridad duplicada
Invariant verdict: PASS — sugerencias no filtran elegibilidad y el rango personalizado 1–1 es cotizable
Build: PASS — 83 fuentes, bundle/sw syntax, HTML v111, PWA v55, bundle SHA-256 FE4425ABEF1016708A859C862AE5E7C354F4780008C415BC365AB8BD917BADCB
Tests: PASS — auditoría 8/8, multiperfil live, term=1 live, suites estáticas y Chrome real
Security: PASS — Edge JWT requerida; actor real/contexto separados; sesiones QA cerradas; ningún secreto frontend
Legacy impact: READ ONLY — Google writes 0; Apps Script writes 0
Unexpected files changed: no evaluable por ausencia de metadata Git; inventario explícito del alcance registrado
Known limitations: inconsistencia autoritativa fila 103 documentada y no modificada
Evidence: docs/FINANCIAL_FUNDS_ELIGIBILITY_ROOT_CAUSE_RESULT.md
```

# 2026-08-24 — H-FINANCIAL-VISIBILITY-001

- Se reservó exclusivamente `Criterios de fondos!P` como `VISIBILIDAD SUTIAPP`; A:O y M quedaron intactas.
- Se implementaron AUTO/MOSTRAR/OCULTAR, ventana de cuatro meses calendario, permanentes, permiso específico, auditoría, fingerprint fail-closed, writer P-only por Sheets API y panel Admin productivo.
- Catálogo, matriz multiperfil, seguridad, navegador e intercambio reversible live pasan. No se introdujo bypass, segunda autoridad ni credencial personal productiva.

```text
H-FINANCIAL-VISIBILITY-001 RESULT
Status: PASS
Files changed: migraciones/recovery 20260824000230 y 20260824000231; financial-legacy + visibility-policy; financial-criteria-admin; manifiesto Apps Script; repositories/stores/Admin UI; bundle; HTML/PWA; pruebas y scripts OAuth/deploy; SOURCE_OF_TRUTH, INVARIANTS, DECISIONS, reporte y changelog
Source-of-truth verdict: PASS — Google P es autoridad única del modo; Supabase sólo autoriza/audita
Invariant verdict: PASS — A:O/M preservadas; elegibilidad precede override; sin cálculo frontend
Build: PASS — 83 fuentes, bundle syntax, HTML v112, PWA v56
Tests: PASS — política, catálogo live, seguridad, multiperfil, browser UI, inicialización P y AUTO→MOSTRAR→OCULTAR→AUTO
Security: PASS/FAIL-CLOSED — usuario común/anónimo/fingerprint inválido denegados; OAuth mínimo sólo en Edge Secrets; sin bypass
Legacy impact: SAFE CHANGE — únicamente P/P1; A:O y M sin cambios; resultado final AUTO
Unexpected files changed: no evaluable por ausencia de metadata Git; alcance inventariado explícitamente
Known limitations: no hay metadata Git para producir diff autoritativo; los respaldos pre-cambio se conservan en C:\tmp para recuperación
Evidence: docs/FINANCIAL_PROGRAM_VISIBILITY_RESULT.md
```

# 2026-08-24 — H-HOME-HEADER-001

- Se añadió `home.header.collapsed` al registro declarativo, con la foto aprobada incluida offline y sin referencias directas desde Inicio o Admin.
- La cabecera revela la foto del 35 % al 100 % del colapso, con parallax 55 %, escala 1.08 → 1.00, recorte 50% 32%, sin velo y usando sólo transform/opacity.
- Branding administra el override Supabase mediante la frontera `assets.write`; `VisualContent` lo proyecta al store en memoria y `useAsset` actualiza Inicio sin recarga ni polling.
- Chrome real confirmó scroll abajo/arriba reversible, ausencia de overflow horizontal y la tarjeta Admin completa.

```text
H-HOME-HEADER-001 RESULT
Status: PASS
Files changed: registro/store/resolver visual; repositorios; Inicio; Branding; bundle; asset offline; HTML/PWA; pruebas y gobierno
Source-of-truth verdict: PASS — precedencia explícita ADR-054, override Supabase y proyección en memoria
Invariant verdict: PASS — consumo exclusivo por home.header.collapsed
Build: PASS — 83 fuentes, bundle/sw syntax, HTML v113, PWA v57
Tests: PASS — pruebas estáticas/regresión y Chrome real autenticado
Security: PASS — assets.write/RLS; sin secretos nuevos
Legacy impact: NOT APPLICABLE
Unexpected files changed: no evaluable por ausencia de metadata Git
Known limitations: QA no mutó el asset productivo
Evidence: docs/HOME_HEADER_COLLAPSED_RESULT.md
```
# 2026-08-24 — H-LOAN-RESULT-LOADING-UX-001

- La tarjeta de resultado separa `INITIAL_LOADING`, `RECALCULATING`, `READY` y error sin cifras falsas, cálculo local ni resultado stale de otra selección.
- Siete odómetros reemplazan por completo las franjas opacas y conservan estructura/altura. Cada track recorre seis vueltas en 1 s, se detiene con 90 ms por columna y usa blur proporcional exclusivamente en sus glifos internos según ADR-055.
- Los cinco importes usan `SmoothMoney` accesible; reduced/frozen motion saltan al valor final sin giro ni blur.
- Durante recálculo se conserva únicamente el último resultado confirmado de la sesión visual, atenuado con `Actualizando…`; el resultado vigente sigue siendo el único que habilita el flujo.
- Bundle 83 fuentes, HTML `v116`, PWA `v60`. Chrome real aislado pasó 100/1000/3000 ms con 27 tracks, `layoutShift=0`, 0 barras opacas, error/retry, recálculo y accesibilidad.
- Google, Apps Script, Edge, Repository, contrato, Supabase, reglas y cálculos: `NO CHANGE / NO WRITE`.
- Evidencia: `docs/LOAN_RESULT_LOADING_UX_REPORT.md`.

## 2026-08-24 - H-LOAN-RESULT-LOADING-UX-001 / fondo de un pago

- Se corrigio el disparador del odometro para asociarlo a cada cotizacion aceptada y no unicamente a la cifra final.
- Chrome real confirmo Fondo A -> Fondo B -> Fondo A con plazo 1, importes identicos y reinicio de 27 tracks en ambas transiciones.
- No cambiaron datos, calculos financieros, Repository, Edge, Google ni Apps Script. Bundle `v117`; PWA `v61`.

## 2026-08-24 - H-LOAN-RESULT-PRESENTATION-001

- Se alineo verticalmente el glifo `$` del odometro mediante transform estatico, sin escribir sobre el track animado.
- Cuando el minimo autoritativo es 1, la UI conserva el rango pero presenta `Minimo` y omite el acceso rapido `$1`; no inventa otro importe.
- Chrome real verifico geometria, ausencia del quick amount 1 y toda la matriz del odometro. Bundle `v118`; PWA `v62`.

## 2026-08-24 - H-CLEANUP-VERIFY-001

- Se reparó la puerta de verificación sin modificar código productivo: versiones PWA se validan por sincronía real, los contratos estáticos reflejan RPC/clasificaciones vigentes y existe una suite local canónica que excluye pruebas live/browser y las dos integraciones Google parametrizadas.
- El smoke Chrome dejó de admitir falsos positivos por promesas CDP abandonadas, usa timeouts/cierre verificable y cubre Login, Inicio, Perfil, Credencial, las nueve entradas de Tu Sindicato con apertura real de una pantalla, Convenios, Finanzas, Préstamo y Admin.
- Suite estática 34/34, sintaxis 15/15, bundle reproducible SHA-256 `8120441B3FFC051BE40EB1EFB4B5E10DF8ADCECC3EF46303620740997563A348`, auditoría general PASS y Chrome real PASS con 19/19 estados, cero excepciones y fondos 146/146.
- Los 401/403 de recursos Supabase protegidos continúan visibles en el reporte y se clasifican como autorización esperada; no activaron fallback. Google/Apps Script/datos/cálculos financieros: `READ ONLY / NO WRITE`.

```text
H-CLEANUP-VERIFY-001 RESULT
Status: PASS
Files changed: 15 archivos de verificación bajo scripts/; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — ninguna autoridad productiva modificada ni duplicada
Invariant verdict: PASS — cálculo y writer financiero intactos; UI productiva sin cambios
Build: PASS — bundle reproducible byte a byte, SHA-256 8120441B3FFC051BE40EB1EFB4B5E10DF8ADCECC3EF46303620740997563A348
Tests: PASS — 34/34 static; 15/15 syntax; Chrome 19/19 estados; audit:all PASS
Security: PASS — Auth/RLS reales; 401/403 esperados conservados como evidencia; cero secretos nuevos
Legacy impact: READ ONLY / NO WRITE
Unexpected files changed: ninguno dentro del inventario verificable; metadata Git ausente

```

## Fase 1 Auth / Affiliate Certification - 2026-08-24

- Live: 947 affiliates, 3 Auth, 3 bindings, 944 sin Auth, 0 Auth huerfanos y 0 wrong/ambiguous bindings; duplicados historicos intactos.
- Matriz A/B/Admin/anonimo PASS para Auth, RLS, aislamiento privado, permisos e impersonacion actor/contexto.
- Recovery real PASS y credencial original restaurada. Corregida carrera `SIGNED_OUT` que dejaba reset sin cierre; bundle regenerado desde 83 fuentes.
- 34/34 static y Chrome focalizado PASS; 0 secretos frontend, 0 autoridad local productiva y 0 fixtures transitorios.
- Resultado actualizado por ADR-056: `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST`; `AUTH-PROD-ACTIVATION-CERT` queda para release online.
- Evidencia: `docs/AUTH_AFFILIATE_PHASE1_CERTIFICATION.md`.

```text
Known limitations: dos integraciones Google parametrizadas son NOT APPLICABLE en la suite local sin argumentos autorizados
Evidence: salida de test-static-suite, reproducción aislada del bundle, smoke Chrome --full --summary y audit.ps1 -Check all
```

## Fase 2 Affiliate Document Association DRY RUN — 2026-08-24

- Dry run live read-only: 12,901 `affiliate_files`, 13,047 `private_assets`, 25,358 referencias históricas y tres buckets reconciliados; escrituras DB/Storage/Auth/Google = 0.
- Clasificación: 12,901 `ALREADY_CORRECTLY_LINKED`; `EXACT_MATCH=0`, `AMBIGUOUS_MATCH=0`, `NO_MATCH=0`, `WRONG_EXISTING_LINK=0`, `ORPHAN_ASSET=0`.
- Duplicados respetados: 367 documentos de controles duplicados se sostienen por UUID existente y procedencia; nombre/email/heurística usados = 0.
- Storage: `private-assets` y `public-assets` sin huérfanos; cinco objetos `app-assets` sin registry quedan `ORPHAN_STORAGE_OBJECT`, identificados por fingerprints y sin modificación.
- Verificación final: `py_compile` PASS, suite estática 34/34 PASS, búsqueda de secretos 0 coincidencias; revisión arquitectónica `APPROVED` con instrucción de detenerse antes de mutaciones/Fase 3.
- Photo/DK: 487/487 y cero autoridades múltiples. Legacy: 12,279 referencias privadas no afiliado permanecen protegidas; cero reintentos de los tres fallos históricos.
- Resultado: `DRY_RUN_PASS`. No se aplicaron relaciones y no se avanzó a Fase 3.
- Evidencia: `docs/AFFILIATE_DOCUMENT_ASSOCIATION_DRY_RUN.md` y `scripts/dry-run-affiliate-document-association.py`.

## Fase 3 Expediente End-to-End — 2026-08-24

- El propietario cerró Fase 2 como `PASS / CLOSED`; writes documentales pendientes, relaciones ambiguas/incorrectas y huérfanos `private-assets` = 0. Los cinco huérfanos públicos quedan separados bajo `APP-ASSETS-ORPHAN-AUDIT`.
- Se retiró `DATA().docs` como autoridad productiva. `DocumentosScreen` consume exclusivamente `AffiliateRepository.getDocuments()` → Supabase/RLS/Storage, con URLs privadas firmadas por 300 s y estados loading/empty/error/retry sin fallback.
- Chrome real: A 34 documentos, B 19; perfil/foto/credencial/control correctos; refresh regenera capacidades; switch A→B conserva cero URLs/documentos/identidad stale.
- RLS live: A↔B denegado para affiliate UUID, relaciones y rutas privadas exclusivas; Anonymous denegado. Admin `assets.read` abre A/B; usuario normal Admin denegado.
- Impersonación Admin→B conserva `auth.uid()` real, proyecta Perfil/Credencial/Foto/Expediente B, restaura Admin y deja cero contexto stale tras logout.
- Suite estática 35/35 y Chrome completo PASS. Writes en `affiliate_files`, `private_assets`, Storage, Auth y Google = 0; solo start/stop auditado de la sesión de impersonación solicitada.
- Resultado: Fase 3 `PASS`; dominio `PASS_WITH_DEFERRED_PRODUCTION_ACTIVATION_TEST`, no `CLOSED` hasta `AUTH-PROD-ACTIVATION-CERT` online.
- Evidencia: `docs/AFFILIATE_EXPEDIENTE_PHASE3_CERTIFICATION.md`.

## 2026-08-25 — H-ARCH-REGISTRY-NAVIGATOR

- Se creó un Registry derivado particionado, generador completo/incremental, freshness fail-closed, lookup por aliases, grafo de impacto y formato Observatory-ready; no se construyó UI.
- Cobertura inicial: 12 dominios, 15 screens, 20 admin screens, 11 routes, 373 components, 16 handlers, 14 hooks, 27 repositories, 9 services, 102 tables, 901 columns, 107 FK, 99 RPC, 3 Edge Functions, 4 buckets, 75 permissions, 228 RLS policies y 94 tests.
- La skill interna `sutiapp-architecture-navigator` quedó con invocación implícita y `AGENTS.md` la hace obligatoria antes de guardians para toda tarea futura; fallback discovery es automático y el trabajo rutinario permanece interno.
- Suite offline PASS: generación, fresh/stale, feature/screen/table/column lookup, dominio focal separado de impacto cross-domain, reverse dependencies, Admin↔frontend, permissions, tests, fallback, incremental add/remove, secretos/PII y determinismo byte a byte.
- Comparación reproducible Perfil/Credencial, Convenios y Suti Préstamo: 177 archivos candidatos por búsquedas amplias frente a 30 archivos primarios por tres lookups; no se estimaron tokens.
- Supabase, Storage, Auth, Google, Apps Script, datos, reglas financieras, business logic y runtime: `NO CHANGE / 0 WRITES`.

```text
H-ARCH-REGISTRY-NAVIGATOR RESULT
Status: PASS
Files changed: AGENTS.md; scripts/generate-architecture-registry.py; scripts/test-architecture-registry.py; scripts/compare-architecture-navigation.py; docs/architecture/**; .agents/skills/sutiapp-architecture-navigator/**; docs/ARCHITECTURE.md; docs/SOURCE_OF_TRUTH.md; docs/DECISIONS.md; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: PASS — índice derivado, una sola autoridad de origen y cero autoridad runtime nueva
Invariant verdict: PASS — no modifica datos, frontend, bundle, schema, RLS ni legacy
Build: NOT APPLICABLE — runtime productivo intacto
Tests: PASS — suite específica completa; skill validator PASS; comparison 177→30
Security: PASS — 0 secretos, 0 PII, exclusión de archivos sensibles y 0 llamadas externas
Legacy impact: NOT APPLICABLE / NO READ EXTERNAL / NO WRITE
Unexpected files changed: no detectables mediante inventario; metadata Git ausente
Known limitations: análisis dinámico requiere discovery dirigido; no existe Observatory visual todavía
Evidence: docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json; docs/architecture/HISTORICAL_TASK_COMPARISON.md; salida de scripts/test-architecture-registry.py
```
# 2026-08-25 — H-ADMIN-CONTENT-CONSISTENCY-001

**Objetivo:** corregir quirúrgicamente la consistencia Editor → Preview → Supabase → artículo de Noticias y barrer el mismo patrón en Admin.

**Implementación:** `RichTextEditor` dejó de insertar copy plantilla y usa el valor más reciente en acciones rápidas; `RichText` define una frontera estructurada excluida de `LiveText`; el artículo tolera `tag` opcional. Preview y público conservan un único renderer React seguro. Bundle `v121`, PWA `v65`.

**Verificación:** contrato estático `PASS`; Chrome/Supabase reversible `PASS` con payload capturado, read-back, A/B, Cancelar, reload, publicación y override; 18 superficies clasificadas, un mismo bug confirmado/corregido, cero fixtures. Sin schema, migración, cambio de autoridad, secretos o rediseño. Evidencia detallada en `docs/ADMIN_CONTENT_CONSISTENCY_REPORT.md`.

## 2026-08-25 — H-MASTER-FUNCTIONAL-COMPLETION-001

- Se creó la arquitectura canónica de catálogo/expediente/requisitos/snapshots, banco autoservicio, términos versionados, solicitudes de membresía y QR efímero; migración live reconciliada con 947 afiliados, 12,901 archivos históricos intactos, 3,421 relaciones documentales, 12 tipos, 29 requisitos, 0 cuentas bancarias y 0 términos inventados.
- Documentos, Credencial, flujo de Préstamo, membresías e Historial/Admin consumen Supabase sin `localStorage`, base64 o autoridad paralela. Admin dispone de CRUD, orden drag/drop + alternativo accesible, filtros, preview firmado y revisión auditada.
- QR estándar se genera localmente con `qrcode-generator` 1.4.4 MIT, ruta allowlisted y token efímero; no usa servicio externo ni PII.
- Build reproducible desde 90 fuentes; bundle `v123`, PWA `v67`. Contratos estáticos, expediente, préstamo y Chrome multiusuario A/B/C pasan; matriz RLS live read-only pasa sin fixtures.
- Google/Ahorro/Préstamos legacy: `NO WRITE / NO CHANGE`. Los datos bancarios históricos siguen `UNRESOLVED` y los primeros términos legales requieren decisión del propietario.
- Evidencia: `docs/MASTER_FUNCTIONAL_COMPLETION_REPORT.md`.

## 2026-08-25 — BANKING HISTORICAL SEED DRY RUN

- El propietario resolvió términos y banca: Supabase productivo; `Usuarios SUTIAPP.xlsx` seed-only; matching exclusivo por `numero_control` exacto y único.
- Dry run read-only: 947 filas, 513 con banca, 505 matches exactos, 8 ambiguos, 0 sin match, 0 cuentas Supabase, 8 inserts estrictamente potenciales, 0 updates, 0 conflictos y 0 writes.
- Integridad: el archivo actual SHA-256 `36E61B82F1BAB496B08E70BF3E1A14911A7A4E612EC3DE9F8A0669B8F2011CD3` difiere del snapshot certificado previo; 416 filas contienen notación científica y 504/513 no preservan íntegros todos los campos presentes. No se reconstruyó ningún dígito.
- No se modificaron Supabase, Google financiero, Apps Script, Excel, Auth, Storage ni datos. Se detuvo antes de importar como ordenó el propietario.
- Evidencia: `docs/BANKING_HISTORICAL_SEED_DRY_RUN.md`; script reproducible `scripts/dry-run-banking-historical-seed.py`.

## 2026-08-25 — BANKING USER-MAINTAINED APPLY

- Migración productiva aplicada para procedencia histórica parcial, estado incompleto, `account_holder` no inferido, capability `bank_accounts.read` y RPC auditadas ADD/EDIT/DELETE/SET PRIMARY.
- Seed: 513 evidencias, 505 matches exactos, 504 imports seguros, 8 ambiguos y 1 irrecuperable omitidos; reconstrucciones/heurísticas/overwrites = 0.
- Credencial preserva estructura Claude, enmascara lista, muestra “Completa tus datos bancarios”, permite edición y separa “Hacer principal”. Bundle `v124`, PWA `v68`.
- Verificación: 38/38 estáticos, CRUD reversible, RLS A/B/Anonymous/Admin, cuatro eventos de auditoría y Chrome real no Admin PASS; fixtures eliminados y total final 504.
- Google financiero y Apps Script: `NO READ / NO WRITE / NO CHANGE`. Evidencia: `docs/BANKING_HISTORICAL_SEED_RESULT.md`.

## 2026-08-25 — H-REQUIRED-DOCUMENT-UPLOAD-RESILIENCE

- Membresía y Suti Préstamo cargan primero los requisitos canónicos de `program_document_requirements`; una falla secundaria al consultar documentos existentes, firmar una vista previa o consultar términos ya no oculta los requisitos ni los controles de carga.
- `DocumentWorkflowRepository.list()` conserva la fila documental cuando una URL firmada no está disponible y marca únicamente su preview como no disponible.
- Bundle `v127`, PWA `v71`. Contrato específico PASS, suite estática 40/40 PASS y Chrome real PASS: Membresía 4 requisitos con “Subir”; Préstamo 8 requisitos con “Subir”.
- Autoridad documental: Supabase, sin fallback ni nueva fuente. Google financiero y Apps Script: `NO WRITE / NO CHANGE`.

## 2026-08-25 — H-EXPEDIENT-DOCUMENT-HYGIENE-001

- Clasificación live no destructiva: 3,421 actuales, 901 versiones históricas, 5 legacy, 7 no concluyentes y 8,567 técnicos ocultos. RLS cierra relación, activo privado y Storage al afiliado; Admin `assets.read` conserva auditoría.
- Caso certificado: 7/8 requeridos, 27 históricos preservados = 21 técnicos ocultos + 6 documentos históricos. Chrome real PASS para RLS, galerías, 33 miniaturas, filtros, imagen, PDF y navegación.
- Safe-delete audit: 9 grupos de hash/objeto compartido, 0 relaciones seguras, 0 objetos seguros, 3 objetos Storage desconocidos preservados. Eliminaciones DB/Storage: 0/0.
- Bundle `v129`, PWA `v73`. Google/Ahorro/Préstamos/Apps Script: `NO WRITE / NO CHANGE`.
- Evidencia: `docs/EXPEDIENT_DOCUMENT_HYGIENE_RESULT.md`; `data/expediente-safe-delete-recovery-manifest.json`.

```text
H-EXPEDIENT-DOCUMENT-HYGIENE-001 RESULT
Status: PASS
Files changed: migration/recovery; AffiliateRepository; Admin Identidad/Expediente; bundle/cache; auditorías/tests; gobierno/Registry
Source-of-truth verdict: PASS — autoridad canónica preservada; clasificación derivada y sincronizada
Invariant verdict: PASS — ocultamiento sin pérdida de relación, procedencia, hash u objeto
Build: PASS — bundle reproducible desde 90 fuentes
Tests: PASS — contratos estáticos y Chrome/Supabase real
Security: PASS — afiliado sólo CURRENT_DOCUMENT en relación, activo y Storage; Admin por assets.read
Legacy impact: NOT APPLICABLE / NO WRITE / NO CHANGE
Unexpected files changed: ninguno detectable; metadata Git ausente
Known limitations: 3 objetos Storage no registrados permanecen UNKNOWN y no se borran
Evidence: docs/EXPEDIENT_DOCUMENT_HYGIENE_RESULT.md
```

## 2026-08-25 — H-LOAN-PERSONALIZED-SNAPSHOT-007

- Se aplicó la excepción autorizada ADR-043: snapshot financiero derivado, temporal, personalizado por afiliado/actor/impersonación, TTL duro 15 minutos, RLS forzada y cero grants browser. No existe catálogo global.
- `financial-legacy` v18 personaliza después de perfil Supabase + Google, reutiliza `resolveQuote()`/`quoteForTerm()` desde snapshot para monto/fondo/plazo con cero Google, valida contexto sin Google y reconsulta Google al confirmar.
- La confirmación antigua de tres llamadas browser fue retirada. La nueva frontera service-only valida perfil/reglas/términos/documentos, crea solicitud y vínculos en una transacción, conserva `financial_submission_snapshot` inmutable y responde `409 CONDITIONS_CHANGED` sin insertar.
- Migración live preservó 947 afiliados, 3 solicitudes, 3 solicitudes financieras y 0 vínculos de solicitud; tabla temporal inició vacía. Dry run de migración, recovery y creación atómica/idempotente terminaron en `ROLLBACK`, cambios persistentes 0.
- Live multiusuario/perfiles/TTL/impersonación PASS; OPEN Google 1, diez cambios/monto/fondo/plazo Google 0, CONFIRM Google 1; mediana Edge final 678 ms, máximo 736 ms. Chrome automático, asistido y odómetro PASS; blank frame 0, latest-intent PASS, max in-flight 1.
- Bundle `v140`, repositorio financiero `v3`, PWA `v84`; suite estática 42/42, Deno check, sesión Chrome completa login/refresh/logout y Registry FRESH. El reviewer corrigió el mapping/queue obsoletos sin cambiar runtime. Google Sheets, Apps Script, fórmulas y reglas financieras: `NO WRITE / NO CHANGE`.
- Limitación preexistente: cero términos de préstamo publicados; UI continúa fail-closed. No se inventó solicitud productiva ni contenido legal. Evidencia: `docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md`.

```text
H-LOAN-PERSONALIZED-SNAPSHOT-007 RESULT
Status: PASS
Files changed: migration/recovery; financial-legacy Edge; financial repository; Loan/Finance/Home; bundle/cache; tests; ADR/SOT/security/governance/legacy/Registry
Source-of-truth verdict: PASS — Google sigue autoridad; snapshot sólo derivado, personalizado y expirable
Invariant verdict: PASS — sin catálogo global, cálculo frontend, fallback o dependencia histórica del caché
Build: PASS — bundle reproducible desde 90 fuentes; Deno type-check PASS
Tests: PASS — 42/42 static; live multiuser/perfiles/TTL/conditions; Chrome automático/asistido/odómetro
Security: PASS — RLS forced; browser read/write 0; A↔B/Anonymous denied; actor/affiliate/impersonation/version bound
Legacy impact: READ ONLY / SAFE CHANGE — Google calls redistribuidas; 0 writes; fórmulas/reglas intactas
Unexpected files changed: ninguno detectable; metadata Git ausente
Known limitations: términos publicados 0; confirmación real permanece fail-closed hasta contenido legal del propietario
Evidence: docs/PERSONALIZED_FINANCIAL_SESSION_SNAPSHOT_IMPLEMENTATION.md
```

## 2026-08-26 — H-ADMIN-PROGRAM-CRITERIA-MATRIX-001

- `Admin → Fondos y reglas` usa en Desktop una matriz profesional de solo lectura con búsqueda, siete filtros de negocio, orden, agrupación por programa, detalle persistente, señales conservadoras y comparación de 2–4 reglas; móvil conserva íntegro su flujo anterior.
- Google `Criterios de fondos` sigue como autoridad mediante el read model `financial-legacy`; backend, writers, RLS, Apps Script, fórmulas, tasas, montos, plazos, fechas, elegibilidad y visibilidad no cambiaron.
- Lectura viva: 146 criterios, 3 programas, 35 fondos, 4 sindicatos, 6 categorías; 57 disponibles, 42 programados y 47 no disponibles; 2 grupos potencialmente duplicados y 1 potencial conflicto.
- Siete encabezados no expuestos por el read model quedan `OWNER_CLARIFICATION_REQUIRED`; no fueron interpretados ni mostrados.
- Chrome real 430/1024/1280/1440, error/reintento, refresh y cero escrituras PASS; shell Admin PASS; suite estática 48/48; Registry actualizado y FRESH.
- Evidencia: `docs/qa/H-ADMIN-PROGRAM-CRITERIA-MATRIX-001-EVIDENCE.md`.

```text
H-ADMIN-PROGRAM-CRITERIA-MATRIX-001 RESULT
Status: PASS_WITH_CLARIFICATIONS
Files changed: Desktop criteria UI/projection; bundle/cache; tests/evidence; derived Architecture Registry
Source-of-truth verdict: PASS — Google preserved; no fallback or duplicate authority
Invariant verdict: PASS — eligibility, visibility and financial values unchanged
Build: PASS — bundle reproducible from 90 sources
Tests: PASS — static 48/48; live read/security; Chrome matrix and Admin shell
Security: PASS — capability enforced at backend; unauthorized/normal/anonymous denied; writers 0
Legacy impact: READ ONLY / GOOGLE WRITES 0 / APPS SCRIPT WRITES 0
Unexpected files changed: 0
Known limitations: 7 source headers require owner clarification and remain excluded
Evidence: docs/qa/H-ADMIN-PROGRAM-CRITERIA-MATRIX-001-EVIDENCE.md
```

## 2026-08-27 — H-BRANDING-UPLOAD-001

- Se corrigió el fallo parcial de Admin → Ícono e instalación: el navegador ya no intenta `UPSERT` sobre `asset_sources`, cuyo `UPDATE` está correctamente revocado. La nueva RPC `register_branding_assets(jsonb)` registra asset, procedencia y vínculo de `app_settings` en una sola transacción, con allowlist, validación de ruta/tipo/tamaño/hash, permiso backend `assets.write` y ejecución denegada a anónimo.
- El Ícono de la app genera PNG exactos de 512, PWA 192, Apple Touch 180 y maskable 512; las cuatro relaciones Supabase y sus copias estáticas reproducibles quedaron sincronizadas por hash y dimensiones. Los objetos anteriores se conservaron en el manifest de recuperación.
- Los errores de los ocho campos de imágenes se presentan ahora dentro del control con `role=alert`; se retiró el alert genérico de esos controles. Se preservaron Sello institucional, cinco controles de identidad, tres imágenes de instalación, preview, navegación y estructura visual Claude.
- Migración/recovery dry run: `PASS`, escrituras persistentes 0. Prueba live reversible: enlace/procedencia/cross-client `PASS`, usuario normal/anónimo `DENIED`, fixture restaurado. Chrome 1440×900: ocho controles, tres posiciones, sin overflow, mensaje inline y cero alerts/escrituras ante archivo inválido.
- Google Sheets, Apps Script, Ahorro, Préstamos, fórmulas y cálculos financieros: `NO READ / NO WRITE / NO CHANGE`.

```text
H-BRANDING-UPLOAD-001 RESULT
Status: PASS
Files changed: AdminRepository; pantalla Ícono e instalación; bundle; migración/recovery y pruebas de branding; sincronizador/prueba PWA; cuatro PNG PWA; DATA_MAPPING; Architecture Registry derivado; este changelog
Source-of-truth verdict: PASS — app_settings + app_assets + app-assets permanecen como autoridad única; sin fallback
Invariant verdict: PASS — INV-015, INV-027–030, INV-032, INV-035 e INV-036 preservadas
Build: PASS — bundle reproducible desde 90 fuentes; artefactos PWA válidos
Tests: PASS — estáticas H-008/H-009/branding/PWA/pages; dry run forward/recovery; live reversible; Chrome real
Security: PASS — assets.write backend; SECURITY DEFINER con search_path vacío; authenticated-only; normal/anónimo denegados
Legacy impact: NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE
Unexpected files changed: ninguno atribuible a esta H; se preservaron modificaciones preexistentes del árbol
Known limitations: las tres imágenes de instalación siguen sin configurar; assets parciales no vinculados se preservan hasta que el propietario cargue los archivos correctos
Evidence: salidas de scripts/test-branding-upload-*.{js,py}; scripts/sync-icon-installation.py --verify --verify-static; scripts/test-icon-installation.js
```

## 2026-08-27 — H-LIVE-TEXT-REMOVAL-001

- Por instrucción del propietario se retiraron el botón flotante `Editar textos`, el motor global que convertía nodos en editables, su panel de Roles y el control pendiente homónimo de Convenios.
- `ManagedCopyRepository`, `copyStore`, `LiveText`, `saveCopy` y `removeCopy` dejaron de formar parte del runtime. ADR-072 registra que `public.managed_copy_overrides` y sus filas se preservan sin lectores ni writers frontend para recuperación histórica; no se ejecutó SQL ni borrado de datos.
- Los editores administrativos específicos de Noticias, Tu Sindicato, Branding y demás dominios permanecen intactos. Bundle `v159`, caché PWA `v103`; build reproducible desde 91 fuentes con SHA-256 `2167587D3BF3F6BBA46B7B9CD01B8609EF2601976D0CE9B4BBC2F6AE31BEAD39`.
- Contratos focalizados, preservación Claude, sintaxis y Registry `FRESH`: `PASS`. Suite estática global: 54/55; el único fallo (`test-pages-deployment.js`) es preexistente y exige literalmente comillas simples, mientras el `SutiApp.html` ajeno ya estaba reformateado con comillas dobles equivalentes.

```text
H-LIVE-TEXT-REMOVAL-001 RESULT
Status: PASS
Files changed: shell/runtime de copy; Roles; Convenios; repositorios; bundle/cache; pruebas; SOURCE_OF_TRUTH; Registry derivado; este changelog
Source-of-truth verdict: PASS — managed_copy_overrides queda histórico e inactivo; copy estructural vuelve a código; sin fallback
Invariant verdict: PASS — sin autoridad paralela, borrado histórico ni cambio en editores de dominio
Build: PASS — bundle reproducible desde 91 fuentes; node --check PASS
Tests: PASS focalizado — retiro, Phase 2, consistencia editorial, preservación Claude y consumidores; suite global 54/55 por fallo preexistente de comillas
Security: PASS — se eliminó la superficie frontend de lectura/escritura de overrides; Supabase/RLS no cambiaron
Legacy impact: NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE
Unexpected files changed: SutiApp.html y dos evidencias de Admin Financial Requests ya estaban modificados; sólo se añadió el cachebuster v159 al HTML
Known limitations: test-pages-deployment.js conserva una aserción literal incompatible con el reformateo preexistente del HTML
Evidence: node scripts/test-live-text-removal.js; node scripts/test-static-suite.js; node --check app/bundle.js; build reproducible por SHA-256; Architecture Registry FRESH
```

## 2026-08-27 — H-ADMIN-AFFILIATES-CRUD-DOCUMENTS-001

- Se mantuvo el editor auditado de perfiles y se hizo explícita la acción `Eliminar usuario` como baja administrativa reversible. Usa los RPC ADR-071 existentes, conserva Auth/documentos/solicitudes/historia y permite reactivación; no existe borrado físico del padrón.
- El perfil de Afiliados ahora carga documentos al expediente seleccionado. `AdminAffiliatesRepository` valida archivo y SHA-256, sube a `private-assets` y llama `register_admin_affiliate_document`; backend revalida `documents.write`, UUID/tipo/ruta/owner/MIME/tamaño/hash/motivo, crea `PENDING_REVIEW` y audita.
- `20260827001300–01320` y recovery pasaron rollback y fueron aplicadas. Los guards booleanos Storage evitan conceder lectura directa de afiliados y hacen la comprobación de referencias independiente de RLS. Aplicación: 947 afiliados, 3,425 documentos, 13,048 assets y 13,051 objetos preservados, business rows changed 0.
- Prueba live reversible: admin `PASS`; normal/anónimo y borrado de objeto referenciado `DENIED`; documento/asset/objeto/auditoría persistieron y el cleanup restauró conteos exactos. Chrome real 1024/1280/1440/430 abrió edición, baja y carga sin overflow, errores o escrituras inesperadas.
- Bundle `v160`, cache PWA `v104`, 91 fuentes, SHA-256 `A1010C695638FC24CDA942996F04EA5B2F32FD2DD41CEBC1A838F139B67B572D`. Registry `FRESH` y suite propia `PASS`; suite global 54/55 conserva únicamente el fallo preexistente de comillas en `test-pages-deployment.js`.

```text
H-ADMIN-AFFILIATES-CRUD-DOCUMENTS-001 RESULT
Status: PASS
Files changed: Afiliados UI/repository; SQL/recovery; tests; bundle/cache; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — public.affiliates + affiliate_documents/private_assets/private-assets canónicos
Invariant verdict: PASS — INV-097, INV-103, INV-104 e INV-116 preservadas
Build: PASS — bundle reproducible desde 91 fuentes; node --check PASS
Tests: PASS focalizados, migration rollback/apply, live reversible, Chrome y Registry; global 54/55 preexistente
Security: PASS — backend/RLS/Storage; normal/anónimo denied; secretos frontend 0
Legacy impact: NOT APPLICABLE / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: SutiApp.html reformateado y dos evidencias Financial Requests preexistentes, preservados
Known limitations: eliminación física prohibida; baja reversible es la operación de eliminación administrativa
Evidence: docs/qa/H-ADMIN-AFFILIATES-MODULE-001-EVIDENCE.md y scripts relacionados
```

## 2026-08-29 — H-TOPBAR-SEAL-ALIGNMENT-001

- El sello institucional decorativo del fondo de `TopBar` quedó centrado verticalmente y alineado al borde derecho tanto en Inicio como en las cabeceras internas. Tamaño, opacidad, parallax, controles, navegación, tarjetas, scroll y autoridad Supabase del asset permanecen intactos.
- Bundle reproducido desde 91 fuentes; HTML `v162`, caché PWA `v106`, SHA-256 `B62008CAAFB9874ECC190D607A856FE7110F746253EB6395A49A55959C825C4C` y reproducción determinista `PASS`.
- Contrato focalizado del encabezado, preservación Claude, sintaxis y sincronía de cachebusters `PASS`. Suite estática global 54/55; el único fallo es el preexistente de comillas literales en `test-pages-deployment.js`. El arnés browser CDP no produjo evidencia verificable en este entorno y no se contabilizó como `PASS`.
- Supabase, Auth, Storage, RLS, datos, Google, Ahorro, Préstamos y cálculos financieros: `NO READ / NO WRITE / NO CHANGE`.

```text
H-TOPBAR-SEAL-ALIGNMENT-001 RESULT
Status: PASS
Files changed: app/app.jsx; app/bundle.js; SutiApp.html; sw.js; contratos de caché/TopBar; este changelog
Source-of-truth verdict: NOT APPLICABLE — posición visual únicamente; la autoridad del sello no cambió
Invariant verdict: PASS — INV-015, INV-027 e INV-036 preservadas
Build: PASS — 91 fuentes, bundle determinista y sintaxis válida
Tests: PASS focalizados; suite global 54/55 por fallo preexistente no relacionado
Security: NOT APPLICABLE — sin cambios de Auth, RLS, permisos o secretos
Legacy impact: NOT APPLICABLE / NO READ / NO WRITE / NO CHANGE
Unexpected files changed: SutiApp.html reformateado y dos evidencias Financial Requests preexistentes, preservados
Known limitations: validación browser no acreditada porque el arnés CDP terminó sin salida verificable
Evidence: node scripts/test-home-header-collapsed.js; node scripts/test-claude-ui-preservation.js; node scripts/test-static-suite.js; node --check app/bundle.js; build reproducible por SHA-256
```

## 2026-08-30 — H-LOAN-DOCUMENT-CONTEXT-ISOLATION-001

- Se separaron de forma irreversible en código los contratos documentales de autoservicio y Administración. Autoservicio deriva el afiliado efectivo server-side y no acepta objetivo; Admin exige `documents.read` y afiliado objetivo explícito.
- Los listados ya no firman objetos ni exponen rutas. `document-access` autoriza y firma exactamente un documento por clic durante 300 segundos, con JWT, `no-store`, bucket privado y auditoría obligatoria antes de responder.
- `document_access_audit_log` conserva actor real, efectivo, objetivo, documento, propósito, modo e impersonación sin URL/token/path. RLS forzada, escritura browser revocada y lectura Admin limitada.
- Se preservaron todos los `VERIFIED`; los importados sin revisión humana se muestran como `Histórico importado`. No se cambió el gate backend final ni Google, Apps Script, Ahorro o reglas/cálculos financieros.
- Migración dry-run/apply/recovery-dry-run, Edge v1 activa, matriz viva 8/8, Chrome focal y de flujo, bundle reproducible y suite estática 61/61: `PASS`.

```text
H-LOAN-DOCUMENT-CONTEXT-ISOLATION-001 RESULT
Status: PASS
Files changed: RPC/auditoría/recovery; Edge document-access; repository y consumidores documentales; bundle/cache; pruebas; ADR/invariantes/seguridad/SOT/evidencia; Registry
Source-of-truth verdict: PASS — expediente canónico preservado; auditoría derivada sin autoridad paralela
Invariant verdict: PASS — aislamiento por afiliado efectivo, Admin explícito, firma individual, VERIFIED y gate final preservados
Build: PASS — 92 fuentes; node --check; SHA-256 7569486F2EBA39CEB530B8BF51835C1E7FD9B50C7965AFB601BDBD9E742CC773
Tests: PASS — estáticas 61/61; live 8/8; Chrome focal y flujo documental
Security: PASS — RLS forzada; JWT; normal/foreign/anonymous denied; Admin explícito; auditoría sin secretos
Legacy impact: NOT APPLICABLE / Google read 0 / write 0 / Apps Script change 0 / financial rows changed 0
Unexpected files changed: 0
Known limitations: reclasificación histórica de VERIFIED requiere decisión del propietario y otra H
Evidence: docs/qa/H-LOAN-DOCUMENT-CONTEXT-ISOLATION-001-EVIDENCE.md
```
## 2026-08-30 — H-REQUEST-SUBMISSION-E2E-REMEDIATION-001

- Se demostró la causa del 409: el trigger de snapshot documental exigía `auth.uid()` al escritor financiero service-only. La migración `20260830000300` permite exclusivamente `service_role` o usuario autenticado y mantiene anónimo denegado; no modificó filas.
- Mi Historial dejó de depender del `SELECT` directo incompleto y usa `list_self_program_request_history()`, ligado al afiliado efectivo sin selector cliente ni exposición de identidad, firma, términos, snapshots o idempotencia. `Seguir mi solicitud` invalida la proyección en memoria y relee Supabase.
- `financial-legacy` v27 devuelve contrato explícito y correlación; los 409 conocidos son accionables y los fallos de servidor ya no culpan al usuario ni exponen detalles PostgreSQL. La pantalla compartida, folio, monto, timeline y política de confeti permanecen intactos.
- E2E real completo pasó en 390×844, 430×932/reduced y 1280×900 desktop; tres fixtures se eliminaron por alcance exacto. Seguridad normal/cross-user/anon/admin/impersonación, 409 reversible, build y suite estática 63/63 pasaron. Google/App Script: 0 lecturas, 0 escrituras, 0 cambios.

```text
H-REQUEST-SUBMISSION-E2E-REMEDIATION-001 RESULT
Status: PASS
Files changed: SQL/recovery; Edge; request/history wiring; error copy; bundle/cache; tests; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — program_requests y request_documents preservados; sin fallback ni caché autoritativa
Invariant verdict: PASS — cálculos/146 reglas/35 fondos/3 programas, snapshot documental, folio real y UI aprobada preservados
Build: PASS — 92 fuentes; bundle SHA-256 522019A0E7F6C8ED6EFBB54441061BD6A4DC070AF4B9BDB32F9F9DE781D9194C
Tests: PASS — 63/63 static; migration/recovery; live security/error; E2E 390×844, 430×932 reduced y desktop 1280×900
Security: PASS — service-role restringido; anonymous/cross-user denied; proyección self mínima; correlación sanitizada
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: append Google posterior a aprobación sigue separado y requiere acción autorizada del propietario
Evidence: docs/qa/H-REQUEST-SUBMISSION-E2E-REMEDIATION-001-EVIDENCE.md
```

## 2026-08-30 — H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001

- Se eliminó la doble autoridad que mantenía el editor Admin desconectado y timelines hardcodeados. Admin → Finanzas → Etapas y seguimiento gobierna ahora los cuatro flujos reales de préstamo, membresía, cotización y beneficio.
- Cada alta congela un `workflow_snapshot` versionado e inmutable; editar textos, orden, responsable, SLA o retirar etapas sólo afecta solicitudes futuras. Éxito, Mi Historial y detalles Admin usan el mismo resolver central y muestran fallo controlado si la proyección no está disponible.
- La UI Admin realizó una edición y restauración reales; una solicitud de préstamo creada durante el cambio conservó el texto original después de restaurar, demostrando historia inmutable. Folio, monto, pantalla WOW, confeti y CTA a Historial permanecen activos.
- Migración/recovery, RLS, auditoría actor real, live matrix, Chrome 390/430/768/1280, cardinalidad 3/4/6/8/10 y suite estática 64/64: `PASS`. Fixtures exactas eliminadas; Google reads 0/writes 0 y documentos permanecieron 8.

```text
H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001 RESULT
Status: PASS
Files changed: workflow SQL/recovery; repositories/stores/screens; bundle/cache; E2E/tests; gobierno/evidencia; Registry
Source-of-truth verdict: PASS — definición Supabase única, snapshot inmutable por solicitud y resolver central
Invariant verdict: PASS — resolución única, historia preservada, tracking validado y cero fallback local
Build: PASS — 92 fuentes; node --check; SHA-256 21BB789599B6CCAE14C09FC019F64916E42EFF5DAC563BF0B866DE8C08D3C47A
Tests: PASS — 64/64 static; migration/recovery; live; E2E 390×844, 430×932 reduced, 768×1024 y 1280×900
Security: PASS — RLS/RPC; self derivado; Admin workflow.read/write; anónimo/normal denied; auditoría durable
Legacy impact: NO INTERACTION / Google read 0 / write 0 / Apps Script change 0
Unexpected files changed: 0
Known limitations: procesamiento financiero posterior a aprobación conserva su frontera legacy protegida
Evidence: docs/qa/H-REQUEST-WORKFLOW-TIMELINE-CUTOVER-001-EVIDENCE.md
```
