# H-ADMIN-FINANCE-QUEUE-IDENTITY-001

## Release sobre main vigente

Candidato de publicación: base 2aa05b90dab2d9f9309033743665bf0238e187b7, bundle v243
reconstruido desde main con el lector incorporado (115 fuentes en total).
Sólo cambian los chunks admin-finance-queue-repository.js y screens-admin-finanzas.jsx;
no se revierten las publicaciones de tipografía, popup o navegación. Ver release-preflight.json.
Build, lector y navegador focal PASS; preflight de Auth y solicitudes productivas PASS.
El build del release se verificó con 19 solicitudes reales, 18 fondos de préstamo,
foto decodificada, diálogo, móvil, refresh/reapertura y denegación anónima; cero writes.
Las dependencias vendor del checkout Windows se leen con los bytes exactos de Git para
respetar SRI, iguales a los que publica Linux; no existe cambio versionado de esos archivos.
El Registry de publicación actualiza únicamente las seis fuentes de esta H y conserva
explícitamente los fingerprints stale preexistentes ajenos, sin certificarlos fresh.
La suite completa del generador es NOT APPLICABLE al release focal; se valida el nodo,
archivo y relaciones del lector. La prueba live admite URL publicada y compara el SHA-256
del bundle antes de abrir la bandeja, sin guardar PII ni realizar writers de negocio.

## Continuación autorizada: commit y push

El propietario ordenó explícitamente commit y push después del cierre local. Esta instrucción
autoriza la publicación automática asociada al push de main y sustituye la limitación de
entrega local indicada en la evidencia anterior. Preparación en worktree aislado sobre
origin/main vigente; conservar publicaciones posteriores de tipografía, popups y navegación.
La pantalla baseline coincide con origin/main; aplicar únicamente el delta de esta H.
Recrear el bundle desde las fuentes remotas actuales y asignar un cachebuster posterior.
Alcance adicional: evidencia de release/producción en la carpeta de esta H, entrada focal
en AGENT_CHANGELOG y prueba live compatible con URL publicada. No modificar runtime compartido,
permisos, backend, Google ni el workspace principal fuera de documentación/evidencia de esta H.
Recovery: revertir el commit focal mediante Git, preservando las publicaciones posteriores.
Verificación: build del release, pruebas focales, preflight de Auth/solicitudes vigente,
diff de chunks, commit/push sin force y estado del workflow Pages; lectura productiva sin writers.
PRE-CHANGE RELEASE AUDIT: PASS. Autoridad, invariantes, seguridad y legacy conservan el veredicto previo.

PRE-CHANGE AUDIT
- Objetivo autorizado: Admin Finanzas / Solicitudes muestra full_name, fondo/programa solicitado y foto entre Folio y Afiliado / programa.
- Alcance: app/screens-admin-finanzas.jsx; nuevo app/admin-finance-queue-repository.js (lector exclusivo de esta bandeja); scripts/build-bundle.js (registro de fuente); app/bundle.js y SutiApp.html (GENERATED_ARTIFACT/cachebuster); scripts/test-admin-finance-queue-identity.js; scripts/test-admin-finance-queue-identity-browser.js; scripts/test-admin-finance-queue-identity-live.js; esta evidencia, docs/qa/evidence/finance-queue-identity-20260909/ y docs/AGENT_CHANGELOG.md. Registry derivado docs/architecture/*.json si aparece nueva dependencia.
- Fuera de alcance: writers, cálculos, SQL/schema, Google, auth, RLS, repositorios/viewer compartidos, lógica SW, deploy y cambios previos del workspace.
- Datos: identidad affiliates.full_name; fondo histórico program_requests.financial_submission_snapshot.financialResult.fund; producto/programa y workflow de la RPC existente; foto affiliate_files(profile_photo, Photo/DK) → AffiliateRepository → Storage privado.
- APIs finales: list_admin_finance_request_flow_queue + list_admin_financial_requests_mobile mediante ProgramRequestRepository existente; getProfilePhoto existente. La segunda RPC devuelve su proyección financiera autorizada, de la que se retiene sólo el fondo por ID; no hay consulta/hidratación documental por fila ni nueva caché. El probe inicial demostró que SELECT directo está denegado y se retiró ese camino antes del cierre. Sin migración ni ampliación de permisos.
- Autoridad: Supabase. Lectores nuevos exclusivamente la bandeja; cero escritores nuevos. Iniciales significan ausencia de foto, nunca otra fuente; errores visibles.
- UI original: toolbar/búsqueda/filtros/orden/contador/recarga; Folio, Afiliado/programa, monto/plazo, estado/etapa, antigüedad; selección y modal/documentos/workflow/acciones; scroll y responsive. Única adición visual autorizada: columna Foto; nombres completos legibles.
- Riesgo: asociación incorrecta del fondo/foto, overflow móvil, consultas masivas o por fila, error silencioso. Mitigación: IDs de solicitud/afiliado, consulta agrupada, carga visible/contexto privado existente, tests focales y prueba autenticada read-only.
- Recovery: restaurar únicamente delta de esta H; baseline/hashes y fuentes anteriores en C:/tmp/sutiapp-finance-queue-identity/. No restaurar todo git: existen cambios previos extensos.
- Navigator: STALE en SutiApp.html, Admin Afiliados y evidencias ajenas; feature inspeccionada directamente en pantalla, repositorios, RPC 20260903000140 y coordinador privado.
- Legacy: READ ONLY de snapshot Supabase; cero Google/Apps Script/cálculos/triggers.
- Security: permisos/RLS existentes; no firma nueva, cambios de TTL global, secrets ni service_role frontend. Prueba focal de acceso real pendiente.
- Tests: build, workbench existente, lector agrupado/fallos/identidad, navegador desktop/móvil/fotos/navegación y lectura live.
- Global image regression: NOT APPLICABLE; consumidor focal nuevo de APIs existentes, sin modificar implementaciones compartidas. Bundle/cachebuster son artefactos generados.
- Status: PASS para implementar; cierre pendiente de evidencia.

## Resultado verificado

```text
H-ADMIN-FINANCE-QUEUE-IDENTITY-001 RESULT
Status: PASS (implementación local; no publicación)
Files changed: pantalla Finanzas, lector exclusivo AdminFinanceQueueRepository, registro del lector en build, bundle generado/cachebuster 239, tres pruebas focales, evidencia/changelog y Registry derivado.
Source-of-truth verdict: SAFE. affiliates.full_name; fondo de financial_submission_snapshot.financialResult.fund; affiliate_files + lector privado vigente para fotos. Mismos writers y autoridades.
Invariant verdict: PASS. IDs de solicitud y afiliado preservados; numero_control raw intacto; cero modificaciones de solicitudes, estados, criterios o historia.
Build: PASS. node scripts/build-bundle.js C:/tmp/babel-standalone-7.29.0.min.js; 117 fuentes. Sólo cambian los chunks admin-finance-queue-repository.js y screens-admin-finanzas.jsx.
Tests: PASS focal: lector (100 préstamos, orden distinto, faltantes/errores, inmutabilidad), navegador (6 grupos de checks; 1440/768/390/320 px), build local con backend real (18 solicitudes).
Security: PASS para el alcance. Lectura administrativa por RPC vigente, consulta anónima denegada. Fotos privadas mediante AffiliateRepository/PrivateResourceDemand existentes. Cero cambios de RLS/grants/Storage/Auth.
Legacy impact: READ ONLY del snapshot Supabase. Cero lecturas/escrituras Google, cero cálculos financieros, cero cambios de triggers.
Unexpected files changed: 0 respecto al baseline privado; no se revierten cambios preexistentes del propietario.
Known limitations: no deploy. La prueba estática histórica test-admin-financial-requests-workbench.js falla por copy obsoleto tanto en el baseline como en el resultado (ver preexisting-test.json); no es una regresión de esta H. Se ejecutó prueba focal equivalente del comportamiento afectado. La RPC financiera existente devuelve su proyección autorizada completa una vez, no únicamente la etiqueta; se conserva sólo el fondo al componer la bandeja. Ambos lectores ya tienen límite 250.
Evidence: docs/qa/evidence/finance-queue-identity-20260909/{browser-result,build-result,live-result,scope-result,preexisting-test}.json y queue-{1440,768,390,320}.png (fixtures aislados).
```

Verificación live: 18/18 nombres coinciden con full_name; fondos coinciden con snapshot de la solicitud; IDs de foto corresponden al afiliado. Foto real decodificada, cero errores de imagen observados, diálogo existente y móvil PASS, recarga + reapertura de Finanzas PASS, acceso anónimo denegado. Cero business writes y cero errores JS. Las capturas versionadas contienen exclusivamente fixtures; no se guardan nombres reales, URLs firmadas ni credenciales.

La primera prueba de build sin Babel no pudo compilar las fuentes JSX preexistentes; el build oficial con Babel 7.29.0 sí pasó. El probe inicial de SELECT directo devolvió 403: el código final usa exclusivamente la RPC administrativa que ya concedía acceso a esa proyección financiera, sin fallback ni nueva autorización. La prueba live cierra el popup promocional existente antes de usar la bandeja y reabre Finanzas después del refresh del shell.

```text
CLAUDE UI PRESERVATION REVIEW
Screen: Admin / Finanzas / Solicitudes
Original sections: toolbar/filtros/contador, bandeja, modal/condiciones/documentos/workflow/acciones, Cotizaciones.
Current sections: mismas, con columna Foto autorizada y nombre/fondo corregidos.
Missing sections: ninguna.
Added sections: Foto entre Folio y Afiliado / programa.
Interactions preserved: búsqueda/filtros/orden, selección, detalle, Escape; bloques de documentos, condiciones y módulo idénticos al baseline.
Navigation preserved: sí.
Visual structure preserved: sí; ajuste proporcional de columnas y salto de línea para full_name.
Unauthorized redesign: NO
Verdict: PASS
```

```text
SUTIAPP ARCHITECT REVIEW
Task: H-ADMIN-FINANCE-QUEUE-IDENTITY-001
Verdict: APPROVED
Critical findings: ninguno en el delta. Fallo estático histórico documentado con el mismo baseline; no se declara PASS de esa prueba. Registry requiere incorporar el nuevo lector derivado.
Source of truth: SAFE, sin fuentes alternativas ni datos persistidos por el nuevo lector.
Architecture: consumidor focal de dos RPC existentes; repositorios/helpers compartidos intactos. Regresión global de imágenes NOT APPLICABLE.
Security: lectura backend permission-gated; anónimo denegado, cero ampliación de permisos.
Data: presentación derivada exclusivamente; cero business writes.
Legacy: intacto.
Owner decision: NO
Next action: conservar la entrega local y evidencia; no iniciar otra H ni publicar desde esta revisión.
Response generated for Codex: YES
```

RESPONSE TO CODEX: Aprobar H-ADMIN-FINANCE-QUEUE-IDENTITY-001 como implementación local verificada. Registrar el lector focal en el Registry derivado, comprobar el alcance final y entregar el resultado al propietario. No cambiar workflows, repositorios compartidos, permisos, datos históricos ni sistemas Google. Una publicación será una acción separada.

Cierre del índice: actualización incremental completada (28 cambios indexados, incluidos cambios anteriores que ya estaban stale); AdminFinanceQueueRepository existe como repository, con archivo y relaciones en el grafo. Verificación focal PASS y generador sin modificaciones. La suite completa del generador se inició y se canceló al comprobar que reconstruye todo el índice repetidamente; no es una verificación requerida para este cambio de consumidor y no se declara PASS de esa suite. Los hashes de documentación/evidencia de cierre pueden quedar stale después de escribir este cierre; las nuevas dependencias runtime sí quedaron indexadas.
