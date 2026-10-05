# H-FINANCE-BLOCKS-001 — restricciones temporales por afiliado

## Activación autorizada — 2026-10-04

El propietario confirmó las exclusiones de Ahorro y solicitudes previas, y ordenó
«haz comit push y publicalo». Se autoriza aplicar el candidato, commit, push y Pages.
Se conserva el alcance funcional, sin bloquear afiliados reales ni crear solicitudes de prueba.
Ampliación de archivos: scripts/release-finance-blocks.js, scripts/package-finance-blocks.js,
scripts/verify-finance-blocks-live.js y evidencia release-* bajo la carpeta focal.
Preparación en checkout aislado .tmp/finance-blocks/release sobre origin/main actualizado;
trasladar solo deltas propios contra .tmp/finance-blocks/before, sin publicar trabajo ajeno.
Verificar esquema/versiones antes del DDL; aplicar una transacción con huellas de authorities,
preservar definiciones/ACL existentes y comprobar nuevas tablas vacías. Recovery ya ensayado.
Backend antes de frontend. Verificación autenticada de lectores y denegaciones, sin escrituras
de negocio; regresión de imágenes del candidato y publicación, y comprobación de commit/hash.

Revisión independiente de release: `loanSessionOpen` se usa desde Home/Finanzas como lectura.
Se retira el preflight de ambas aperturas (loan/programPayment), manteniéndolo en confirmaciones,
creación de programas/membresías y trigger canónico. Se añade prueba focal
scripts/test-finance-blocks-read-boundary.js. Así las consultas/simulaciones no disparan un
modal de bloqueo ni se degradan a error; el intento de envío sigue mostrando fechas y motivo.

## AUDIT → AUTHORITY → PLAN → RISK

Estado: implementación autorizada por solicitud del propietario; sin publicación autorizada en esta H.

Objetivo: bloquear desde el detalle de Finanzas Solicitudes, con inicio/fin inclusivos (America/Hermosillo), explicación visible y bitácora debajo de Solicitudes y encima de SICOF. Editar y levantar sin eliminar historia. Identidad: FK al afiliado canónico y numero_control TEXT exacto, jamás email/Auth como identidad de negocio.

Autoridad propuesta y autorizada por alcance: restricciones administrativas en Supabase, separadas de saldos y criterios financieros. Lectores: afiliado propio y administradores autorizados de Finanzas. Escritores: RPC administrativa autenticada y auditada. El servidor comprueba restricciones al insertar solicitudes; la UI muestra motivo y vigencia. No modificar solicitudes previas, pagos, saldos, ledger, Google o cálculos. Alcance de nuevas solicitudes: préstamos y financiamientos; aclaración solicitada sobre Ahorro.

Archivos declarados: este documento; nueva migración/recovery de finance_blocks (numeración tras consulta del catálogo); app/finance-blocks-repository.js; app/finance-blocks.jsx; app/screens-admin-finanzas.jsx; app/screens-admin.jsx; app/financial-legacy-repository.js; app/program-request-repository.js; scripts/build-bundle.js; app/bundle.js (generado); scripts/inspect-finance-blocks.js; scripts/test-finance-blocks*.js; evidencia focal docs/qa/evidence/finance-blocks/; docs/SOURCE_OF_TRUTH.md; docs/DECISIONS.md; docs/INVARIANTS.md; docs/AGENT_CHANGELOG.md; índices derivados docs/architecture/ si cambia arquitectura. Baselines técnicos en .tmp/finance-blocks/.

Baseline: árbol con numerosas modificaciones previas; no revertirlas ni atribuirlas a esta H. Registry FRESH; lookup solicitudes insuficiente, discovery dirigido confirma screens-admin-finanzas, program-request-repository, financial-legacy y navegación administrativa.

Riesgos: bypass mediante RPC/Edge, sesiones ya abiertas, carrera bloqueo/envío, timezone, exposición cruzada, administrador sin permiso, solicitudes no financieras. Mitigación: trigger en writer canónico y bloqueo transaccional por afiliado; intervalo validado; permisos backend y tablas privadas; pruebas aisladas de matriz de accesos, límites de fechas, edición/revocación, recuperación y no impacto histórico. No bloquear consultas/pagos ni rechazar retroactivamente solicitudes existentes.

UI a preservar: filtros/cola, selección y modal de detalle, identidad/foto, comportamiento de pagos SICOF, documentos/viewer, workflow, acciones/aprobación, anterior/siguiente y responsive. Adiciones: control de restricción en detalle y módulo Bitácora de bloqueos.

Recovery: retirar escritores/trigger nuevos de forma explícita, conservar restricciones y eventos como evidencia privada, restaurar registro/navegación. Probar en PostgreSQL aislado. Ninguna prueba sintética productiva.

Guardians: pre-change-audit, source-of-truth-guardian, database-migration-guardian, legacy-google-guardian (READ ONLY, cero escrituras Google), supabase-security-review, claude-ui-preservation-guardian, post-change-verification. Revisiones de cierre pendientes.

Verificación: SQL aislado con RLS/ACL y casos negativos; navegador aislado; build; regresión global obligatoria por cambios en repositories compartidos y navegación; revisión de diff contra baseline. No declarar PASS productivo por pruebas aisladas.

## Ampliación de alcance — control de publicación

Se añade scripts/screen-permission-contract.js y prueba focal de permisos: la bitácora es una subvista del módulo finanzas y debe demostrar vínculo a ese módulo backend, sin otro permiso/rol/asignación. El guard validará un padre registrado y ENFORCED, sin aliases encadenados ni padres inexistentes. Se añaden SutiApp.html y sw.js exclusivamente para cachebusters de bundle/repository generado; no se modifica lógica de service worker. Se añade scripts/build-finance-blocks.js para empaquetado focal y verificación de chunks. La publicación sigue pendiente y backend debe desplegarse antes de frontend.

## Implementación verificada

- Catálogo productivo consultado solo lectura: última migración 20261004000200, candidato aditivo 20261004000300. Baseline en .tmp/finance-blocks/catalog.json; cero filas de negocio leídas/escritas por esta inspección.
- Autoridad única: finance_blocks; evidencia histórica: finance_block_events. FK al afiliado y número de control TEXT exacto; ni otro padrón ni unicidad nueva sobre numero_control. Cambiar el control o Auth no evita la restricción porque la FK canónica persiste.
- Revisión del borrado existente: la FK de source_request_id usa ON DELETE SET NULL. Una eliminación autorizada de solicitud conserva el bloqueo por affiliate_id y su referencia original en los eventos; no se modifica el writer de borrado. Caso agregado a prueba SQL y verificado.
- RPC administrativas comprueban program_requests.read/write y admin_module_boundary de finanzas con acción read/write. Autoservicio no acepta selector de afiliado, usa identidad efectiva. RLS forzada; tablas sin grants browser/service_role; trigger protege todo writer de nuevas solicitudes. Bloqueo/envío toman el mismo lock de afiliado bajo el aislamiento normal de los writers. No se ejecutó ensayo multi-conexión de concurrencia.
- Cobertura de inserción: prestamo, program_item_id, membership_offering_id o financial_processing_status. Marketplace ordinario, Farma/donaciones y las solicitudes separadas de Ahorro quedan fuera. No cambia aprobaciones ni estados de solicitudes anteriores.
- UI: alta desde modal compartido de Solicitudes (desktop/mobile), bitácora ordenada después de Solicitudes y antes de SICOF en menú y grupo, fechas inclusivas, explicación visible, búsqueda, edición con versión, revocación con motivo e historial. Nota renderizada como texto, sin HTML. Cambio de identidad limpia registros. Error de lectura falla cerrado. Mensajes de error administrativos controlados.
- El nuevo panel es subvista de finanzas; no crea otra asignación/rol/capacidad. El build prueba que accessModule apunta a un módulo backend real/enforced, sin alias desconocido, propio o encadenado ni permiso diferente.

## VERIFY / EVIDENCE

- node scripts/test-finance-blocks.js — PASS: PostgreSQL aislado (PGlite), fechas, motivo, permisos, boundary, RLS/grants, identidad, cuatro tipos financieros, rechazo atómico de inserción, otro afiliado, Marketplace ordinario, edición, revocación, recovery que conserva historia. No es test financiero productivo.
- node scripts/test-finance-blocks-browser.js — PASS: React/Chrome aislado, alta/edición/desbloqueo, explicación escapada, búsqueda, vista read-only, mobile y cambio de identidad.
- node scripts/test-finance-blocks-integration.js — PASS, 6 casos: workbench original, fotos, filtros, modal, responsive, navegación y error/reintento; cero conexiones backend.
- node scripts/test-finance-blocks-permissions.js — PASS: vínculo al módulo finanzas y casos negativos de alias/permisos.
- node scripts/build-finance-blocks.js — PASS: build completo y comparación por chunks contra baseline; solo dos nuevos módulos y program-request-repository/screens-admin-finanzas/screens-admin cambiaron. Cero chunks perdidos. financial-legacy-repository es script externo ya incluido en HTML/site. Cachebusters superan la versión observada en Pages; lógica SW idéntica.
- python scripts/test-architecture-registry.py — PASS completo (freshness, lookup, relaciones, permisos, tests, incremental, secretos y determinismo). Una primera ejecución coincidió con actualización del documento de auditoría y detectó STALE correctamente; repetición secuencial completa PASS. Actualización focal posterior: FK source_request_id/ensayo SQL y esta evidencia, sin cambiar generador.
- git diff --check focal — PASS. Check global detecta whitespace anterior en supabase/migrations/20260915000100_admin_assisted_context.sql, fuera de alcance; no se modifica.
- Regresión global GitHub Pages — PASS en repetición serial: 194 app assets, 226 imágenes de catálogo, documentos propios/loan/membership, PDF legítimo, fotos, Admin Afiliados, Marketplace, fullscreen, refresh y con/sin SW. Primera ejecución paralela tuvo timeout de imagen; se conserva registro.
- Regresión local inicial desde 8094 falló en DOCUMENT_PREVIEW_UNAVAILABLE. Se detectó origen no autorizado por servicio documental (evidencia previa confirma localhost:8080). Se repite final en localhost:8080 con hash de bundle; no se alteraron CORS ni permisos.

Evidencia: docs/qa/evidence/finance-blocks/; los fixtures/snapshots de navegador contienen exclusivamente identidades sintéticas. No se creó ningún bloqueo real, préstamo, solicitud, operación financiera o fila Google.

## Límite de entrega

La migración y el frontend están preparados localmente. El cambio NO está activo en producción. La secuencia de activación es backend primero, verificar RPC/ACL con lectura y denegaciones, publicar únicamente el candidato revisado, comprobar el flujo publicado sin solicitudes/bloqueos sintéticos de negocio. La aplicación debe preservar estas restricciones/eventos al recuperar; recovery elimina API/trigger y deja historia privada.

## Resultado del candidato local

Regresión global local final: PASS, localhost:8080, bundle b32906cbe1a6fa9ecf15c51eeb41d29e022a58cdeb9e26f4ffe59f120e257fc6 verificado, PDF legítimo y comparación con/sin service worker PASS. Cero mutaciones de negocio. Evidencia: global-local-final.txt. La prueba Pages acredita la base publicada, no publicación de esta funcionalidad.

```text
H-FINANCE-BLOCKS-001 RESULT
Status: PASS — candidato local; activación productiva no realizada
Files changed: alcance declarado y ampliación de publicación; Registry derivado actualizado
Source-of-truth verdict: PASS — autoridad nueva focal, privada; sin duplicar afiliados ni finanzas
Invariant verdict: PASS — históricos y dominios financieros protegidos intactos
Build: PASS — bundle y cachebusters reproducibles; chunks ajenos y lógica SW idénticos
Tests: PASS — SQL, browser, workbench, permisos, regresión global local y Pages
Security: PASS aislado — RLS/ACL, permisos/boundary, identidad, denegación cross-user y guard de inserción
Legacy impact: NOT APPLICABLE para escritura; cero Google/ledger/cálculos modificados
Unexpected files changed: ninguno por esta H; árbol inicial sucio preservado
Known limitations: migración sin aplicar; frontend sin publicar; no prueba multi-conexión de concurrencia
Evidence: docs/qa/evidence/finance-blocks; .tmp/finance-blocks/catalog.json; baseline/chunks
```

## CLAUDE UI PRESERVATION REVIEW

Screen: Finanzas Solicitudes y menú administrativo.
Original sections/current sections: cola, filtros, identidad/fotos, documentos, PDF, workflow, acciones, navegación y responsive conservados.
Missing sections: ninguna detectada por inspección/diff y seis pruebas de workbench.
Added sections: restricción en detalle, bitácora y explicación propia de bloqueo.
Interactions preserved: PASS. Navigation preserved: PASS; posición nueva solicitada aplicada.
Visual structure preserved: PASS focal. Unauthorized redesign: NO.
Verdict: PASS.

## SUTIAPP ARCHITECT REVIEW

Task: candidato local H-FINANCE-BLOCKS-001.
Verdict: APPROVED para revisión/activación separada; no certifica funcionalidad publicada.
Critical findings: backend y frontend nuevos no desplegados; WORK_QUEUE_HISTORY.md no existe. WORK_QUEUE.md histórico no autoriza otras fases; esta H deriva de la instrucción actual del propietario.
Source of truth: una restricción canónica por afiliado, eventos conservados.
Architecture: subvista del módulo Finanzas; guard de build valida padre backend, sin nuevo sistema de permisos.
Security: controles backend y casos negativos aislados, tablas privadas, contexto efectivo y actor real separado.
Data: nuevas tablas vacías al aplicar; ninguna modificación de filas históricas en el candidato.
Legacy: cero modificaciones financieras/Google.
Owner decision: NO para el candidato; despliegue fuera de esta entrega local.
Next action: preparar activación backend→frontend con revisión del estado productivo y comprobar no deriva; sin contaminar datos con fixtures.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar el candidato local. No presentar la función como activa ni crear bloqueos de prueba reales.
En la activación, revalidar versión/esquema y preservar cambios previos del propietario; aplicar únicamente
20261004000300 después de verificar recovery, desplegar frontend revisado y comprobar permisos y UI publicada.
No alterar solicitudes previas, saldos, Ahorro, Google, ni autorizar otras H/fases desde este informe.

## H-FINANCE-BLOCKS-001 — activación autorizada del backend

El propietario confirmó conservar Ahorro y solicitudes previas, y autorizó commit, push y publicación. La migración 20261004000300 está aplicada con RLS/ACL verificadas: 8 tablas de autoridad y 484 funciones existentes conservadas; 0 bloqueos, 0 eventos y 0 escrituras de negocio. finance_blocks es la autoridad privada instalada; el frontend se prepara en checkout aislado sobre origin/main y su publicación se verifica por separado. Consultas/simulaciones existentes permanecen disponibles; únicamente la confirmación/envío financiero consulta el bloqueo. Evidencia: docs/qa/evidence/finance-blocks/release-apply.json y release-package.json.


## Release final candidate

Paquete aislado sobre 4f01f0a3795412a9d41d3341289ef639855dbb66, con bundle SHA256 4b9fd3501bd8b2c4ce092d2c7c7f696f2cbb6281af7c03da3f356eb226f9951d y cachebuster 2026100407. Conserva 151 chunks publicados sin cambios; modifica tres focales y añade dos. Lecturas/aperturas financieras permanecen disponibles y el encabezado de la bitácora conserva Volver.

La evidencia actual es docs/qa/evidence/finance-blocks/release-package.json, release-integration.json, release-live-candidate.json, release-apply.json y release-backend.json; sustituye para este candidato los hashes/resultados históricos de build.json y global-* del candidato inicial. La UI autenticada local, con/sin service worker y refresh, y la verificación backend admin/self/anon/ACL son PASS. El test aislado de navegador incluye navegación de retorno; integración conserva seis casos.

La migración está aplicada sin bloqueos/eventos reales ni cambios de negocio; el frontend todavía requiere publicación y comprobación productiva. Las pruebas de afiliado normal en vivo están NOT_RUN_NO_CONTROLLED_CREDENTIALS porque no existen credenciales controladas disponibles; su matriz de permisos está verificada en PostgreSQL aislado. No se ejecutó una prueba real de carrera multiconexión. Ningún resultado aislado se presenta como prueba productiva equivalente.


## Publicación verificada antes del cierre global

Commit bccb935a3ca11926906e76b531545eddf167a6da publicado por GitHub Pages run 37262338502 (SUCCESS). https://sutiapp.com/SutiApp.html y https://david14081982.github.io/SutiApp-private/SutiApp.html sirven el bundle 4b9fd3501bd8b2c4ce092d2c7c7f696f2cbb6281af7c03da3f356eb226f9951d, versión 2026100407. Evidencia: release-published.json.

Verificación focal productiva PASS: navegación, bitácora, fechas/motivo, apertura/cancelación, con/sin service worker y refresh; backend admin/self/anon y tablas privadas. Cero mutaciones de negocio. Evidencia: release-live-production.json. La regresión global productiva continúa pendiente al registrar esta sección. Persisten las limitaciones de credenciales normales controladas no disponibles y ausencia de ensayo multiconexión.

release-live-candidate-preflight-available.json se conserva como intento histórico previo y no sustituye los resultados finales PASS.


## H-FINANCE-BLOCKS-001 RESULT FINAL

```text
H-FINANCE-BLOCKS-001 RESULT
Status: PASS - publicado y verificado
Files changed: fuentes focales de bloqueos/Finanzas; migracion/recovery; tests/build focal; bundle/cachebusters generados; documentacion H y Registry derivado. Runtime publicado en bccb935a3ca11926906e76b531545eddf167a6da.
Source-of-truth verdict: PASS - finance_blocks autoritativo privado, finance_block_events conserva historia; FK afiliado y numero_control; sin autoridad alternativa.
Invariant verdict: PASS - 8 tablas de autoridad y 484 funciones existentes conservadas; solicitudes anteriores, Ahorro, saldos y calculos intactos.
Build: PASS - Pages run 37262338502 SUCCESS; ambos dominios hash 4b9fd3501bd8b2c4ce092d2c7c7f696f2cbb6281af7c03da3f356eb226f9951d, version 2026100407; 151 chunks ajenos preservados.
Tests: PASS - SQL aislado; navegador 5 controles; integracion 6 casos; permisos y read-boundary; focal local/productivo con/sin SW+refresh; regresion global local y productiva final.
Security: PASS - backend admin/self/anon y ACL privadas; permisos, identidad y bloqueo evaluados en servidor. Matriz afiliado normal en PostgreSQL aislado.
Legacy impact: NOT APPLICABLE para escritura - cero modificaciones Google, saldos, formulas, solicitudes previas o datos de negocio.
Unexpected files changed: ninguno en los commits focales; cambios previos del workspace preservados y previews excluidos.
Known limitations: afiliado normal en vivo NOT_RUN_NO_CONTROLLED_CREDENTIALS; no ensayo real multiconexion de carrera. Ningun bloqueo/solicitud sinteticos en produccion.
Evidence: docs/qa/evidence/finance-blocks/release-{package,integration,apply,backend,published,live-candidate,live-production}.json; release-global-{local,production}.txt; browser.json; sql.json.
```

Regresión global productiva final: PASS para 194 app assets y 226 imágenes de catálogo; sello/Login, perfil, Admin Afiliados, documentos imagen/PDF legítimo, Membership, Préstamo, Marketplace, fullscreen, refresh y comparación con/sin service worker. Cero errores de navegador y cero mutaciones productivas. Esta evidencia final sustituye las ejecuciones históricas de candidatos anteriores.

## SUTIAPP ARCHITECT REVIEW FINAL

Verdict: APPROVED. Revisión independiente confirmó el hash exacto publicado, conservación de 151 chunks, controles de autoridad/seguridad, evidencia focal y todos los gates productivos. Sin fases adicionales ni nueva decisión owner. Instrucción siguiente: registrar el cierre documental/evidencia con [skip ci], conservando congelado el runtime ya publicado; no ejecutar otras H.
