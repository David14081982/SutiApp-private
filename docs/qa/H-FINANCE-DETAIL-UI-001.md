# H-FINANCE-DETAIL-UI-001

## PRE-CHANGE AUDIT

Status: PASS para implementar el alcance autorizado el 2026-09-09.
Objetivo: mejorar la UI del detalle de Finanzas con fotografía, nombre completo, fondo solicitado, columnas independientes, documentos legibles y acciones adaptables; conservar línea gráfica y funcionalidades.
Alcance: app/screens-admin-finanzas.jsx; app/bundle.js y SutiApp.html exclusivamente como artefactos generados/cachebuster; scripts/test-finance-detail-ui.js, scripts/test-finance-detail-ui-browser.js y scripts/test-finance-detail-ui-live.js; este documento, docs/AGENT_CHANGELOG.md y docs/qa/evidence/finance-detail-ui-20260909/.
Fuera de alcance: callbacks de negocio, repositories compartidos, Auth, permisos, viewer, Storage, lógica de sw.js, SQL, criterios, cálculos, Google, otras pantallas y tokens globales.
Recovery: revertir únicamente el commit focal; no hay migración ni modificación de datos que revertir.
Riesgo: medio por composición responsive y ciclo de foto; validación focal de contenido y handlers contra main 1795be0, variantes aisladas y lecturas reales.

## AUTHORITY / RISK

Identidad: affiliates.full_name, mediante los datos ya autorizados del detalle; fotografía mediante AffiliateRepository.getProfilePhoto y PrivateResourceDemand existentes. Solicitudes, condiciones y fondo: program_requests y snapshots existentes. Evidencia enviada: request_documents; expediente vigente: affiliate_documents. URLs firmadas efímeras, sin persistencia añadida.
Writers y callbacks financieros, transiciones, eliminación y previews: idénticos a la base; sólo cambia composición/presentación. ADR-100 y FINANCE_REQUESTS_FLOW_PROTECTED_CONTRACT preservados. Fuente de verdad: SAFE. Legacy: READ ONLY para snapshots existentes, cero acceso directo o cambios a Google. Seguridad: permisos backend y repositorios existentes sin modificaciones.
Navigator: check/lookup realizados; STALE por evidencia y prueba live de la H anterior. Discovery focal confirmó pantalla, helpers, contratos y consumidores. No cambia arquitectura ni dependencia entre módulos; no se regenera Registry por estilos/composición local.

## CONTRATO VISUAL / FUNCIONAL

Conservar secciones Solicitante, Resumen, Flujo completo, Registro en Google, Producto y plan (cuando aplica), Condiciones solicitadas/aprobadas, Documentos enviados, Expediente vigente, Términos y Timeline. Agrupaciones mantienen campos, títulos y estados explícitos.
Conservar filtros y búsqueda de cola, foto en cola, apertura explícita, navegación Anterior/Siguiente, borrador, cierre X/Escape, foco y bloqueo de scroll, visor, reintentos, permisos y todos los campos/acciones condicionales.
Mantener guinda, superficies, tarjetas, sombras y tipografía de la aplicación. CSS nuevo limitado al modal; Cotizaciones hermana y componentes globales permanecen fuera del cambio.

## PLAN / VERIFY

1. Cambios de presentación en el único archivo de pantalla; ninguna nueva fuente ni writer.
2. Comparación de bloques de callbacks y contenido por sección contra 1795be0; pruebas browser con datos sintéticos aislados de membresía, préstamo, producto, cotización, rechazada, cancelada y consulta.
3. Build, pruebas focales existentes aplicables y build local con lecturas reales; revisar escritorio/móvil, fotos y documentos. No efectuar acciones de negocio en producción.
4. Revisar diff, evidencia, preservación UI y architect-reviewer antes del cierre. Publicación bajo autorización de commit/push de esta conversación, únicamente tras verificar el resultado concreto.

## RESULT

Ampliación de alcance verificada: sw.js sólo para actualizar CACHE y la URL versionada del bundle en CORE. La base publicada tiene bundle 243 frente a precarga 242; esta publicación usa 244. Son cachebusters asociados al artefacto generado, sin cambios de lógica de service worker, listeners, estrategias, Auth ni Storage. Se comprobará igualdad del resto de sw.js y acceso focal con/sin service worker. Se incorpora antes de editar esas dos constantes.

Implementación y verificación local completas. Publicación y comprobación del artefacto remoto pendientes de registrar.

## EVIDENCE / VERIFICACIÓN LOCAL

- `node scripts/test-finance-detail-ui.js`: PASS. Cinco bloques completos de lógica idénticos a 1795be0; las 66 expresiones de handlers son idénticas mediante AST. Cotizaciones hermana, callbacks financieros, preview controller y renderers de condiciones/flujo/plan preservados.
- Bundle compilado con Babel 7.28.4: PASS. 115 módulos; sólo cambia `screens-admin-finanzas.jsx`. HTML sólo cambia la referencia de bundle. Service worker idéntico salvo CACHE y URL de precarga, sincronizados en bundle 244.
- `node scripts/test-finance-detail-ui-browser.js`: 45 comprobaciones PASS; cinco variantes con contenido completo comparado por sección contra 1795be0, documento PDF sintético válido y visor real, imágenes, foco, navegación, borrador, confirmación, rechazo vacío, estados cancelado/rechazado y consulta sin acciones. Incluye el espacio de reflow 640×389 equivalente geométrico a 1280×778 al 200%; no se presenta como automatización del zoom nativo del navegador. La primera prueba encontró poco espacio central en cotización y se corrigió únicamente el espaciado para ventanas de hasta 450 px de alto, conservando campos y controles.
- `node scripts/test-admin-finance-queue-identity.js`: PASS; navegador de cola: seis grupos PASS, recibo copiado a `queue-browser-result.json` sin sobrescribir la evidencia histórica.
- `node scripts/test-financial-request-admin-events.js`: PASS. `node scripts/test-admin-requests-workbench.js`: PASS después de sincronizar cachebusters.
- `node scripts/apply-finance-request-workflow-ux-correction.js --status`: PASS, aplicado/trigger vigentes, 19 solicitudes y 19 proyecciones. Sólo consulta de estado.
- Build del artefacto público: PASS, 24 archivos en directorio temporal, sin secretos privilegiados.
- `scripts/test-finance-detail-ui-live.js`: 9 mediciones escritorio y 12 tablet/móvil PASS. Tres solicitudes reales, nombre/fondo/foto correctos, 37 imágenes decodificadas, caja 64×48 con contain, visor de imagen abre y cierra conservando el modal, controles visibles, cero intentos de writers vigilados y cero errores JavaScript. La prueba exige carga real de todas las imágenes que el detalle declara disponibles; no acepta una lista vacía como PASS.
- El servidor localhost no está en los orígenes permitidos de document-access. La prueba local sirve el código construido mediante interceptación del sitio en el navegador aislado bajo `https://sutiapp.com`, sin cambiar Origin, tokens ni reglas backend. La prueba de publicación no intercepta los artefactos y compara SHA-256.
- Las capturas `isolated-*.png` usan exclusivamente datos sintéticos. La evidencia live contiene medidas, códigos y conteos; no nombres completos, cuentas, documentos ni URLs firmadas.

### Medición antes / después, 1395×777

| Medida | Base publicada | Nuevo build |
|---|---:|---:|
| Cabecera | 106.98 | 99.30 |
| Barra de acciones | 177 | 142.39 |
| Área visible de revisión | 451.02 | 493.31 |
| Alto desplazable membresía 212 | 2597 | 1991 |
| Alto desplazable préstamo 210 | 2489 | 2345 |
| Alto desplazable cancelada 205 | 3156 | 2492 |

La altura de cabecera sigue siendo automática y crece con nombres largos; estas cifras corresponden sólo a la muestra real medida. Se conserva cada campo y cada sección, aunque su composición visual cambia según lo autorizado.

### Fallos históricos identificados

`test-finance-requests-flow-protected-contract.js` se detiene en `test-admin-financial-requests-workbench.js`, por la aserción de copy «Admin y afiliado ya muestran la etapa vigente». Se reprodujo en 1795be0 y en el nuevo build. No se modifica el test histórico ni se declara PASS ese wrapper.

`test-request-workflow-timeline-cutover.js` primero fallaba en la base por bundle HTML 243 / SW 242. Al sincronizar las versiones aparece otra aserción histórica: espera `financial-legacy-repository.js?v=10`, mientras 1795be0 ya usa v11. La referencia y ese repository no cambian en esta H. No se rebaja el cachebuster para satisfacer una expectativa obsoleta.

La matriz productiva histórica exige solicitudes de cotización/beneficio que no aparecen en la cola actual. Esta H verifica las variantes con fixtures aislados y los casos disponibles con el build real. No crea registros productivos para llenar una prueba. El estado rechazado se prueba aislado, porque no existe una fila real accesible en la muestra.

## CLAUDE UI PRESERVATION REVIEW

Screen: Admin > Finanzas > Solicitudes > detalle.
Original sections: todas las secciones y variantes enumeradas en CONTRATO VISUAL / FUNCIONAL.
Current sections: las mismas, con agrupación visual de Solicitante/Resumen y Registro/Términos; condiciones solicitadas/aprobadas y plan siguen separados.
Missing sections: ninguna; comparación por sección contra la publicación anterior.
Added sections: fotografía en cabecera; etiquetas españolas de estados documentales conservando código y momento histórico.
Interactions preserved: callbacks idénticos, visores, foco, borrador, navegación, validaciones y permisos de consulta.
Navigation preserved: PASS; tabla y pestaña hermana conservadas.
Visual structure preserved: misma línea gráfica; cambios de disposición autorizados por el propietario.
Unauthorized redesign: NO.
Verdict: PASS.

## H-FINANCE-DETAIL-UI-001 RESULT

Status: PASS para implementación y validación focal local; los fallos históricos anteriores no se presentan como pruebas aprobadas.
Files changed: pantalla focal; bundle/HTML/cachebusters; tres pruebas, este documento, changelog y evidencia focal.
Source-of-truth verdict: SAFE; no nueva fuente, snapshot reinterpretado ni writer.
Invariant verdict: PASS; lógica protegida idéntica.
Build: PASS.
Tests: recibos focales PASS; límites y fallos previos documentados.
Security: acceso privado existente y backend intactos; cero escrituras de negocio durante pruebas reales.
Legacy impact: ninguno, sólo presentación de lecturas existentes.
Unexpected files changed: ninguno incluido; outputs históricos de pruebas restaurados. Vendor normalizado a bytes Git para SRI en Windows, sin diff semántico ni inclusión en el commit.
Known limitations: no fila real rejected ni cotización/beneficio independiente en la muestra actual; cubiertos mediante datos aislados. No regresión global porque no cambia lógica compartida; sólo un módulo generado y sus cachebusters.
Evidence: docs/qa/evidence/finance-detail-ui-20260909/.

## SUTIAPP ARCHITECT REVIEW

Task: H-FINANCE-DETAIL-UI-001.
Verdict: APPROVED para entrega focal verificada, sujeto a terminar la comprobación de publicación autorizada.
Critical findings: 66 callbacks y cinco bloques idénticos; un solo módulo del bundle cambia; los tests históricos obsoletos están identificados por comparación con base.
Source of truth / Architecture / Security / Data / Legacy: contratos preservados; no ampliación de autoridad.
Owner decision: NO; ejecución y commit/push autorizados por el propietario en esta conversación.
Next action: publicar el commit focal y verificar hash, UI y funcionamiento con/sin service worker en el artefacto servido.
Response generated for Codex: YES.

RESPONSE TO CODEX: entregar sólo el diff focal autorizado, registrar publicación y ejecutar lecturas productivas sin acciones de negocio. No iniciar tareas de WORK_QUEUE ajenas. Esta instrucción no autoriza otra implementación.
