# H-CONVENIOS-DETAIL-LATENCY-001

## PRE-CHANGE AUDIT

- Objetivo: eliminar la relectura bloqueante al abrir una ficha ya cargada y la superposición transparente; objetivo de contenido utilizable <200 ms, imagen medida aparte.
- Autoridad: petición explícita del propietario del 2026-09-10. Exactamente tres escenarios de rendimiento (normal, lento, repetido), con comparación antes/después por escenario, seguidos por las seis comprobaciones funcionales solicitadas. No ejecutar baterías adicionales.
- Alcance: lector de Convenios, listado/detalle y evidencia aislada de navegador. No rediseñar componentes ni cambiar escrituras de negocio.
- Archivos a tocar: `app/convenios-repository.js`, `app/screens-convenios.jsx`; `app/bundle.js` y el cachebuster de `SutiApp.html` como GENERATED_ARTIFACT; `scripts/test-convenios-detail-latency.js`; este documento; `docs/qa/evidence/convenios-detail-latency-20260910/*`; apéndice de `docs/AGENT_CHANGELOG.md`. Registry derivado sólo si aparece un cambio de mapping arquitectónico demostrado.
- Fuera de alcance: publicación, Auth global, routing, AssetRepository, viewer, service worker, schema, RLS, Storage, migraciones, Google, finanzas y datos productivos.
- Datos: proyección pública de convenios y favoritos educativos de la sesión. Supabase sigue como autoridad única: `list_public_convenios`, `app_assets`, `educational_resource_favorites`. Payloads y permisos de escritores existentes preservados.
- Lectores: `ConveniosScreen` y `ConvenioDetail`; escritores: RPC administrativas vigentes y favorito autenticado existente.
- Memoria: derivada, compartida únicamente mientras existan consumidores montados; invalidación al guardar, recuperar foco, cambiar contexto y desmontar el último consumidor. Sin almacenamiento persistente ni fallback en error. Respuestas de contexto anterior descartadas.
- Invariantes: UUID/source_kind originales, RLS/backend como autorización; sin resucitar filas retiradas ni contenido de otra sesión. Errores de contenido eliminan la proyección y permiten reintentar; favoritos no bloquean el contenido.
- Riesgo: carreras entre relecturas, guardado y cambio de identidad. Control: identidad del estado y de cada solicitud; listener único; prueba funcional de respuestas antiguas.
- Tests: tres casos de rendimiento pareados, una ejecución por variante antes/después; seis comprobaciones funcionales posteriores. Fixtures sólo aislados, tráfico productivo bloqueado. Build/syntax/diff y paridad de módulos como comprobaciones del artefacto, sin otra batería funcional.
- Recovery: copias de bytes iniciales en `C:/tmp/sutiapp-convenios-latency-20260910-before`; restaurar sólo los archivos/deltas de esta H, nunca revertir modificaciones previas del propietario.
- Status: PASS para implementación focal local.

## Architecture / source of truth / security

Navigator: `check` y `lookup convenios --compact` ejecutados. Registry inicialmente STALE (16 changed / 44 added), archivos primarios del lector y pantalla presentes y verificados directamente. Los cambios stale corresponden mayormente a trabajos anteriores; HTML/build inspeccionados directamente. Registry no se utiliza como autoridad runtime.

SOURCE OF TRUTH verdict: SAFE. ADR-111 autoriza memoria derivada invalidable; no se agrega autoridad, persistencia o fallback. No cambios a permisos/backend, credenciales, firmas o identidad de negocio. Pruebas de aislamiento de sesión incluidas; no se afirmará certificación RLS productiva nueva.

## Contrato visual antes del cambio

Listado: header/subtítulo/campana, anuncios con carrusel/posición/PATROCINADO, búsqueda/filtro/chips, Destacados, Todas las tarjetas, favoritos, scroll y navegación inferior. Detalle: portada/zoom, volver/favorito/descuento, título/dirección/categoría, descripción, beneficios/condiciones, promociones, educación, información comercial/contacto, productos, galería, credencial y botones Llamar/Mensaje. Preservar orden y estilos del contenido cargado y motion del shell.

Defecto comprobado antes: cada montaje del detalle crea un `useConvenios` independiente y repite directorio/favoritos/assets. `Promise.all` bloquea el contenido por favoritos. El estado de carga reutiliza cinco skeletons del listado sin fondo opaco; el listado sigue montado debajo. Focus produce dos consultas de directorio cuando ambos consumidores están montados.

## Resultado y evidencia

Implementación local terminada. Dos módulos focales modificados; los otros 116 módulos compilados del bundle son idénticos a los bytes iniciales. El build se regeneró sólo para `convenios-repository.js` y `screens-convenios.jsx`, con validación sintáctica del bundle completo. Cachebuster local 240 → 241. No publicación.

`useConvenios` comparte una proyección mediante `useSyncExternalStore`. Los consumidores nuevos leen inmediatamente el estado vigente. Contenido y favoritos tienen peticiones/errores independientes; una sola suscripción de foco coordina ambos consumidores. Guardar invalida incluso una petición anterior en vuelo; favorito educativo relee sólo favoritos. El último desmontaje y el cambio de contexto descartan la proyección; cada respuesta comprueba contexto y solicitud vigentes. Los estados loading/error/empty del detalle cubren el fondo y permiten volver.

### Tres escenarios de rendimiento

Comando: `node scripts/test-convenios-detail-latency.js`.

Entorno: Chrome headless, viewport 390×844, React 18.3.1 productivo, módulos compilados reales de listado/detalle, UI, Root/App, motion, catálogo y PrivateResourceDemand. Autoridad HTTP local con fixtures explícitos; hooks de dominios ajenos aislados. Peticiones externas bloqueadas; cero tráfico o escrituras productivas.

Una medición antes y una después dentro de cada uno de los tres escenarios. No mediana/p95 ni generalización estadística con esta muestra. La apertura repetida incluye preparación de abrir/volver sin contabilizarla como otra muestra.

| Escenario | Contenido antes | Contenido después | Portada disponible antes | Portada disponible después | Consultas directorio/favoritos/assets al abrir después |
|---|---:|---:|---:|---:|---|
| Normal | 225.5 ms | 64.7 ms | 225.5 ms | 64.7 ms | 0 / 0 / 0 |
| Lento | 1337.7 ms | 85.9 ms | 1337.8 ms | 85.9 ms | 0 / 0 / 0 |
| Repetido | 287.7 ms | 18.2 ms | 287.8 ms | 18.2 ms | 0 / 0 / 0 |

Contenido: desde el evento click capturado hasta un frame con título, detalle y botón Volver alcanzable por hit-testing real. Portada: medición independiente hasta `complete && naturalWidth > 0` en la imagen del detalle. La portada se puede reutilizar desde la tarjeta ya cargada: estos tiempos NO son una medición de descarga fría desde Supabase. Normal: respuestas directorio/assets/favoritos 60/40/80 ms; lento: 600/300/1200 ms. Latencia de endpoint de imagen 100/900 ms; el browser puede reutilizar la imagen ya decodificada. No se simula CPU móvil ni ancho de banda.

Resultado de aceptación <200 ms para datos ya cargados: PASS en los tres escenarios.

### Seis comprobaciones funcionales posteriores

1. **Volver conserva scroll — PASS:** mismo nodo de scroll del shell real y posición 767 → 767 px.
2. **Favoritos — PASS:** empresa y Educación, reflejo en listado/detalle, persistencia en autoridad aislada y rollback del favorito comercial ante error. Favorito educativo no recarga directorio.
3. **Recuperar foco sin duplicados — PASS:** listado y detalle montados; exactamente una llamada a directorio, favoritos educativos y assets por evento de foco con contexto estable.
4. **Actualizaciones — PASS:** writer `saveCompany` existente, ambos consumidores actualizados y respuesta previa descartada; retirar una fila de la autoridad aislada no la reconstruye desde `params.company`.
5. **Errores visibles y reintento — PASS:** error de contenido retira datos, fondo opaco `rgb(242, 243, 245)`, carga propia de tres skeletons con Volver; retry recupera. Error de favoritos no bloquea ficha; su retry no consulta directorio.
6. **Cambio de sesión — PASS:** A → logout → B con lecturas A pendientes; Root real limpia rutas, proyección y favoritos anteriores. Respuestas antiguas no reaparecen. Desmontar el último consumidor también obliga a nueva lectura al volver al módulo.

Inicialización del harness: un primer arranque detectó falta de `brand.jsx` en el entorno aislado (React #130), antes de completar ninguna medición. Se incorporó el módulo real al harness; ejecución final completa PASS, sin errores de página. No hubo cambio runtime por este fallo de preparación ni otra batería de pruebas.

### CLAUDE UI PRESERVATION REVIEW

Screen: Convenios y detalle.
Original sections / Current sections: todas las enumeradas en el contrato anterior, mismo orden y markup cargado.
Missing sections: ninguna.
Added sections: aviso contextual de carga/error de favoritos y estado propio de carga/error/empty del detalle.
Interactions preserved: búsqueda, filtros, favoritos, zoom/galería, contactos, productos y credencial conservan handlers; favoritos y navegación comprobados en navegador. Los handlers no afectados restantes se verificaron en diff, sin ampliar las seis comprobaciones.
Navigation preserved: sí; App/Root y motion byte-idénticos.
Visual structure preserved: sí; capturas antes/después revisadas, sin cambios a tamaños/colores/layout del contenido cargado. Las capturas tomadas durante la animación conservada pueden mostrar un pequeño desplazamiento vertical transitorio.
Unauthorized redesign: NO.
Verdict: PASS dentro del alcance focal.

### H-CONVENIOS-DETAIL-LATENCY-001 RESULT

Status: PASS — implementación y verificación local; no desplegado.
Files changed: dos fuentes, bundle y cachebuster derivados, script focal, informe, evidencia y apéndice de changelog.
Source-of-truth verdict: PASS — Supabase conserva autoridad; memoria sólo derivada y montada, sin persistencia ni fallback.
Invariant verdict: PASS — invalidación, eliminación, sesión y respuesta obsoleta comprobadas; payloads originales de escritores y UUID/source_kind preservados.
Build: PASS — sólo dos módulos modificados, 116 idénticos, sintaxis completa válida; `build.json`.
Tests: PASS — tres escenarios pareados y seis comprobaciones funcionales; `browser.json`.
Security: PASS para aislamiento de memoria/contexto y alcance; backend/RLS sin cambios, nueva certificación productiva NOT APPLICABLE.
Legacy impact: NOT APPLICABLE — cero cambios/lecturas operacionales Google o financieros.
Unexpected files changed: comprobación final por hashes contra baseline, registrada en `verification.json`.
Known limitations: mediciones aisladas en escritorio, una muestra por variante; imágenes reutilizables; sin medición en teléfono/producción ni certificación de descarga fría. Regresión global no ejecutada por el límite explícito del propietario y porque no cambian servicios globales de assets/viewer/routing/Auth; los cambios de lectura se limitan a Convenios.
Evidence: `docs/qa/evidence/convenios-detail-latency-20260910/` y backup local inicial.

Registry: no se cambian rutas, repositories expuestos, RPC, tablas, permisos, Storage, dependencias entre módulos ni autoridad. Cambia únicamente la coordinación interna del lector existente y sus estados. No se regenera el Registry global para absorber trabajo ajeno; permanece STALE, expresamente sin declaración de freshness. El nuevo script focal queda enlazado desde esta evidencia.

## ARCHITECT REVIEW

Task reviewed: H-CONVENIOS-DETAIL-LATENCY-001, implementación local y verificación limitada por el propietario.
Verdict: APPROVED para el alcance local terminado.
What Codex did correctly: quitó la dependencia de red de la apertura con datos vigentes; preservó fuente/identidad y diseño; midió tres escenarios y seis comprobaciones; aisló todas las escrituras de prueba.
Important findings: la apertura es ahora lectura síncrona de la proyección montada; el identificador de petición impide aceptar respuestas invalidadas; la comprobación de epoch y el último unsubscribe evitan persistencia entre contextos. Error de contenido borra filas; error de favoritos se muestra por separado.
Problems detected: no defecto pendiente en el alcance verificado. Un fallo inicial de montaje del harness se corrigió antes de obtener mediciones. Las capturas son del fixture y no certifican tiempos productivos.
Architecture implications: mismo contrato de repositorio, dos consumidores existentes, coordinación interna. Diff focal contrastado con copia anterior, no con HEAD del workspace previamente modificado. 116 módulos ajenos idénticos. Registry STALE conocido.
Source-of-truth implications: Supabase única autoridad, lectura viva compartida sólo durante montaje. Sin mock, almacenamiento persistente ni fallback en runtime. La retirada de una fila no utiliza los parámetros de navegación como respaldo.
Security implications: comparación de contexto antes/después de lecturas y antes del writer educativo. Payload/grants/RLS y helpers globales intactos. La policy `education_favorite_self` conserva `auth.uid()`; no se declara nueva prueba de RLS productiva.
Data implications: cero cambios productivos; fixtures no incluidos en bundle. Hashes de fuentes y alcance disponibles en `verification.json`.
Legacy implications: sin cambio a Google, finanzas o identidad histórica.
Governance: `WORK_QUEUE.md` existe y gobierna otro plan financiero, no autoriza su continuación desde esta H. `WORK_QUEUE_HISTORY.md` no existe. La autorización de este trabajo procede de la petición actual del propietario; no se atribuye aprobación a task-orchestrator.
Owner decision required: NO para aceptar este resultado local.
Recommended next action: entregar resultados y artefacto local; publicación fuera del alcance ejecutado.

### RESPONSE TO CODEX

Aprobar H-CONVENIOS-DETAIL-LATENCY-001 para implementación local. Entregar la tabla de tres comparaciones, las seis comprobaciones PASS y el vínculo a la evidencia, indicando que no está publicado y que los tiempos proceden de simulación aislada. Conservar los cambios previos del workspace. No iniciar otra H.

### SUTIAPP ARCHITECT REVIEW

Task: H-CONVENIOS-DETAIL-LATENCY-001.
Verdict: APPROVED (local).
Critical findings: ninguno pendiente; límites de medición y despliegue declarados.
Source of truth: PASS.
Architecture: PASS focal; Registry global STALE documentado.
Security: PASS en coordinación de sesión; backend sin modificación.
Data: cero escrituras productivas.
Legacy: NOT APPLICABLE.
Owner decision: NO.
Next action: entregar resultado local verificado.
Response generated for Codex: YES.


## Release audit - owner COMMIT Y PUSH

Owner explicitly authorized commit and push. Prepare isolated worktree from origin/main 7f2d382; preserve all preexisting workspace changes. Release scope adds only generated version tokens in sw.js (CACHE and CORE bundle reference) and HTML worker/bundle URLs. No service-worker logic change. Port focal changes onto the published screen, preserving existing typography CSS variables/classes and current shell. Only the two declared bundle modules may differ from origin/main. Carry existing three paired scenarios/six functional checks; verify syntax, exact delta and remote artifact without rerunning benchmark suites. Append release evidence and push fast-forward to main, then monitor the automatic Pages workflow.


## Release review - 2026-09-10

Prepared on origin/main 7f2d382. Repository bytes identical to tested implementation; screen identical after normalizing only preexisting published typography tokens and the three existing CSS classes (su-ad-slide, su-ad-copy, su-convenio-actions), all retained. Published App/Root/Auth/asset helpers preserved. The test harness adds only an isolated hook for the published shell text-size preference; no benchmark scenario or assertion changed. Prior measurements remain local evidence, not a new production benchmark.

Release bundle changes exactly two modules and preserves 114 other modules. HTML bundle247/worker193 and sw.js CACHE193/CORE bundle247 synchronized; no worker logic change. Syntax/diff/parity PASS. Reviewer APPROVED for the explicitly authorized commit/push. Automatic deployment and artifact readback follow; no additional benchmark suites.
