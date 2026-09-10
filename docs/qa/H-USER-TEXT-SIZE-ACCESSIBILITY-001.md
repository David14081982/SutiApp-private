# H-USER-TEXT-SIZE-ACCESSIBILITY-001

## PRE-CHANGE AUDIT / AUTHORITY / PLAN / RISK

Status: PASS para implementar; publicación expresamente autorizada por el propietario.
Base productiva: 1a4c76330a29fc20dbd62fd1f5bc3206660a34b7. Checkout aislado C:/tmp/sutiapp-text-size-release; workspace original con cambios previos no se sobrescribe.
Objetivo: Mi Perfil → Configuración → Tamaño de texto: Normal, Grande (115%), Muy grande (135%). Escala central, secundarios ≥14px, contenido/controles ≥16px, títulos ≥18px, wrap, crecimiento vertical, targets ≥48px y zoom nativo.

Archivos autorizados: app/text-size-preferences.js y app/text-size.css (nuevos); app/app.jsx, app/ui.jsx; fuentes de presentación afiliado screens-home-r2, screens-financiera, screens-convenios, screens-historial, screens-credencial, screens-documentos, screens-loan, screens-savings, screens-inversion, screens-marketplace, screens-terreno, screens-catalogo, screens-program-product-payment, screens-membresias, screens-membership-application; custom-screen.jsx, rich-text.jsx, request-submission-success.jsx, request-notifications.js, request-push.js, image-slot.js, signature.jsx, savings-recorded-history.jsx, savings-withdrawal-list.jsx; SutiApp.html; scripts/build-bundle.js, scripts/build-pages-site.js; app/bundle.js GENERATED_ARTIFACT; scripts/test-text-size-*.js; documentación de esta H, docs/AGENT_CHANGELOG.md, docs/SOURCE_OF_TRUTH.md, docs/DECISIONS.md y docs/architecture/* derivados por nuevo mapping de preferencias. Sólo tipografía/layout en fuentes de negocio.

Domain: preferencia visual personal del principal autenticado.
Authority: Supabase Auth user_metadata.sutiapp_text_size, campo nuevo autorizado por la solución mínima solicitada. No existe tabla ni preferencia personal vigente: app_settings es branding global; useTweaks es herramienta de diseño, no autoridad persistente.
Readers/writers: TextSizePreferences mediante auth.getUser/auth.updateUser; shell aplica variables y Configuración permite escritura propia. Valores allowlist normal/large/largest, ausencia = normal. Metadata jamás interviene en permisos o identidad. Actor real conserva su propia preferencia durante asistencia; no se modifica al afiliado contexto.
Caches: sólo estado React de sesión derivado; ninguna persistencia local ni fallback. Lectura fallida/error de guardado visibles, reintento explícito; nunca afirmar guardado sin confirmación remota. Sesión SDK existente sigue siendo transporte Auth, no autoridad de preferencias.
Tables/RPC/schema/RLS/Edge/Storage: sin cambios. No migración.
Legacy: presentación de Ahorro/Préstamos READ ONLY; cero escrituras Google, fórmulas, cálculos, reglas, montos o solicitudes.
Invariants: identidad/numero_control y fuentes de cada dominio intactas; sin nuevas decisiones de negocio; ningún mock productivo.
Risk: textos fijos, cards y headers que cortan al crecer; navegación con cinco/seis tabs; formularios/modales; preferencia entre cuentas/sesiones.
Plan: tokens CSS en scope afiliado con fallback visual original fuera del scope; sustitución mecánica de declaraciones fontSize; ajustes de wrap/altura dirigidos; selector accesible y persistencia remota. Mantener orden y todos los controles existentes, motion, assets y estados.
Tests: matriz real 320/390/430 × normal/large/largest; navegación/cards/estados/montos/nombres largos/formularios/modales, persistencia/error/aislamiento, build y diff. Regresión global de imágenes requerida por app shell/shared UI, local + GitHub Pages, sin datos sintéticos en producción.
Recovery: revert del commit frontend restaura presentación; conservar preferencia remota inocua (normal vía UI si se desea). No borrar ni restaurar datos de negocio. Backup de artefactos previos y hashes en carpeta privada local.
Freshness: registry inicial STALE por última H Afiliados; discovery focal confirma app.jsx/ui.jsx y ausencia de preferencias. Actualizar únicamente dependencias/mapping demostrados.

## Contrato Claude UI

Ampliación previa de alcance: image-viewer.jsx sólo tokens de leyendas del modal compartido; sw.js sólo manifiesto/versiones generadas para entregar CSS y bundle en la PWA, sin cambio de lógica. El checkout Windows convirtió vendor LF a CRLF y rompió SRI local; se restauran bytes exactos de HEAD (sin diferencia Git), sin alterar vendor ni integridades.

Ampliación previa: `app/admin-store.jsx` únicamente `AdminPopup`, compartido por afiliado, para tokens y desplazamiento vertical del popup al crecer. No cambia ningún store, writer, caché ni control administrativo.

Mantener Inicio (marca, saludo, saldo/crédito, categorías, noticias, programas), Finanzas (productos, ahorro, solicitudes), Convenios (publicidad, búsqueda, categorías, destacados, todos, favoritos y detalle), Historial (filtros/listado/tracking), Credencial (giro/QR/datos/banco/expediente), Perfil (datos, cinco acciones y cierre), Notificaciones (avisos, acuses y Push), formularios y sheets completos. Única sección nueva: Configuración con selector de tres opciones. Aumento tipográfico y reflow autorizados; colores/radios/sombras/assets y negocio conservados.

## Implementación y verificación

- `app/text-size.css`: escala central 100/115/135%, secundarios 14–15px, contenido/controles 16px, títulos desde 18px y line-height 1.45. Sin zoom CSS; viewport permite zoom nativo. Tokens con fallback original fuera del scope afiliado.
- Configuración usa radios nativos, preview inmediato, confirmación remota, mensaje de error y reversión al valor anterior si falla la escritura. La cuenta propia es fijada por el JWT de Auth. `user_metadata` sólo expresa una preferencia visual; no autoriza operaciones.
- Reflow conserva secciones y acciones: nav, chips, publicidad, resumen financiero, credencial, detalle de convenio, catálogo y simulador. Los importes animados mantienen sus valores y ruedas; sus contenedores crecen y dejan de cubrir otros controles. El formulario bancario usa el portal de `Sheet` dentro del root afiliado para permanecer visible después de desplazarse; campos y writers intactos.
- `SutiApp.html`, bundle v239, CSS v239 y manifiesto SW v186 entregan el mismo conjunto. SW sólo cambia caché/manifiesto, no su lógica.
- Suite aislada: 126 escenarios con nombres largos, montos, chips, estados, catálogo, lectura de artículos, formulario bancario y modal de beneficiarios. Matriz: 320/390/430 × Normal/Grande/Muy grande. Fixtures sin Auth ni red; nunca se incluyen en el artefacto público.
- Suite sobre build con backend real: 99 pantallas en las nueve combinaciones. Lecturas reales de Inicio, Finanzas, Convenios, Historial, Credencial, Perfil, Configuración, Notificaciones, Ahorro, Préstamo y Documentos. Préstamo se valida con resultado disponible; los dígitos internos del odómetro se auditan como un importe atómico, incluyendo sus límites y superposiciones.
- Persistencia real: selección por UI, readback `getUser`, refresh, nueva sesión en otro browser, contaminación local ignorada, fallo de red y reversión. La preferencia previa de la cuenta de prueba se restaura al terminar. Cero escrituras de negocio, formularios o solicitudes enviados.
- Contratos Auth y solicitudes: probes de despliegue PASS. Repositories financieros, cálculos, Google, SQL, Edge, RLS y Storage sin diferencias. `test-text-size-scope.js` prueba equivalencia mecánica en 20 fuentes y que todos los tokens referenciados existen.
- Regresión global obligatoria: script original sin cambios, local y Pages, assets legítimos, imagen/PDF, Admin Afiliados, Membership, Préstamo, catálogo, Marketplace, fullscreen, refresh y con/sin SW. Evidencia separada; un PDF real adicional cubre la ausencia de PDF en el expediente propio de la cuenta.

## Integridad de la evidencia

El origen inicial `127.0.0.1` no era admitido por las Edge Functions. Se corrigió el servidor de prueba a `http://localhost:8080/`, origen ya autorizado, y se repitieron las comprobaciones; no se cambió backend ni CORS. La inspección visual detectó y corrigió el sheet bancario fuera del viewport y la distribución de importes; las pruebas finales incluyen ambos casos. Capturas reales y logs con identidad quedan exclusivamente en carpeta privada; las capturas versionadas son sintéticas.

El Registry incorpora la ruta `settings`, `SettingsScreen`, su relación con `TextSizePreferences` y la autoridad Auth. Generación y comprobación focal del mapping/secretos PASS. Un intento de suite integral del generador detectó correctamente STALE al coincidir con ediciones activas; no se cuenta como PASS. Se conserva la verificación focal solicitada por el propietario, sin modificar el generador. Los cambios posteriores de CSS, tipografía y evidencia no alteran ese mapping; freshness puede indicar esos archivos, y el Registry sigue siendo derivado.

Comandos reproducibles: `node scripts/test-text-size-preferences.js`; `node scripts/test-text-size-fixtures.js`; `node scripts/test-text-size-browser.js http://localhost:8080/`; `node scripts/test-text-size-live.js http://localhost:8080/`; `node scripts/test-text-size-global.js http://localhost:8080/`; `node scripts/test-text-size-scope.js`; `node scripts/build-bundle.js <babel-standalone>`; `node scripts/build-pages-site.js <salida>`; probes de contratos de despliegue. Los tests live usan únicamente credenciales ignoradas existentes. No se publican secretos ni sesiones.

## Publicación

Publicado en https://sutiapp.com/ mediante commit `36e36eaa2de15097db683b017b5884e5675e956b`.
Workflow [34421713993](https://github.com/David14081982/SutiApp-private/actions/runs/34421713993): SUCCESS, incluidos los contratos backend, build de 24 archivos y verificación de solicitudes después del deploy.
`publication.json` compara por SHA-256 los tres artefactos servidos con sus blobs Git. El checkout Linux normaliza CRLF de Windows a LF, sin diferencias de contenido.
`preferences-production.json` confirma persistencia, nueva sesión, error controlado y restauración de la cuenta de prueba.
`global-production.json` corresponde al nuevo deploy de Pages: PASS con PDF legítimo, cero errores browser, cero mutaciones de datos y comparación con/sin SW.
`production-layout.json` verifica también las nueve combinaciones en Configuración publicada: contenido 16/18.4/21.6px, sin desbordamiento ni incidencias de layout.

```text
H-USER-TEXT-SIZE-ACCESSIBILITY-001 RESULT
Status: PASS
Files changed: 76 archivos en el commit de implementación; fuentes tipográficas, preferencias, reflow, artefactos generados, build allowlist, pruebas y gobierno; manifiesto en review.json.
Source-of-truth verdict: PASS — preferencia propia en Supabase Auth; ninguna autoridad local ni autoridad de negocio nueva.
Invariant verdict: PASS — identidad, permisos, datos, cálculos, reglas y autoridades vigentes preservados.
Build: PASS — 114 fuentes, 24 archivos públicos; bundle239/CSS239/SW186 verificados por hash en producción.
Tests: PASS — 99 escenarios reales +126 aislados; persistencia local/producción, errores, escala, autoridad y regresión global local/Pages.
Security: PASS — writer Auth del titular JWT; metadata visual sin privilegios; probes anónimos denegados; cero secretos en artefactos/evidencia.
Legacy impact: READ ONLY de presentación; cero cambios Google, Apps Script, fórmulas, triggers, históricos o lógica financiera.
Unexpected files changed: 0; vendor idéntico a HEAD; trabajo previo del workspace original conservado.
Known limitations: validación en Chromium con los anchos solicitados; carruseles originales contenidos preservados. Registry derivado puede señalar cambios posteriores de tipografía/evidencia; mapping de la feature verificado directamente. Suite integral del generador no se declara aprobada.
Evidence: docs/qa/evidence/text-size-20260909/; capturas versionadas exclusivamente sintéticas; logs y capturas reales privados.
```

## ARCHITECT REVIEW

Task reviewed: H-USER-TEXT-SIZE-ACCESSIBILITY-001.
Verdict: APPROVED.
What Codex did correctly: contrastó solicitud, diff, normalización de fuentes, tokens, autoridad remota, 225 escenarios, errores de guardado y artefactos publicados. Conservó los componentes Claude y ajustó únicamente su tamaño/distribución y el anclaje del sheet.
Important findings: no SQL, backend funcional, repositorios de negocio, fórmulas ni datos históricos modificados. PDF real y las superficies globales requeridas pasan. `docs/WORK_QUEUE_HISTORY.md` no existe; la autorización de esta H y su publicación proceden de la orden expresa del propietario.
Problems detected: ninguno pendiente en el alcance comprobado. La suite integral del Registry no es evidencia PASS y su freshness no reemplaza el código.
Architecture implications: ruta Settings y servicio visual mínimo; portal de Sheet permanece dentro del scope afiliado. Sin autoridad paralela.
Source-of-truth implications: único campo de preferencia en Auth, allowlist y lectura remota. La metadata no determina identidad ni autorización.
Security implications: sin elevación, secretos frontend ni selector de otra cuenta; sin cambios a RLS/Storage.
Data implications: únicamente preferencia propia de prueba, restaurada; ninguna solicitud enviada ni dato de negocio modificado.
Owner decision required: NO.
Recommended next action: detenerse tras guardar la evidencia de publicación. No iniciar otra H.

```text
SUTIAPP ARCHITECT REVIEW
Task: H-USER-TEXT-SIZE-ACCESSIBILITY-001
Verdict: APPROVED
Critical findings: ninguno pendiente.
Source of truth: PASS — Auth propio, visual exclusivamente.
Architecture: PASS — mapping verificado; Registry derivado.
Security: PASS — JWT propio, cero privilegios nuevos.
Data: PASS — negocio e históricos intactos.
Legacy: READ ONLY de presentación.
Owner decision: NO
Next action: registrar evidencia final y detenerse; ninguna autorización para otra H.
Response generated for Codex: YES
```

## RESPONSE TO CODEX

Aprueba H-USER-TEXT-SIZE-ACCESSIBILITY-001 con la evidencia indicada. Registra este cierre y los resultados de producción en el repositorio, confirma que el deploy de documentación conserva los mismos hashes de la app y detente. No avances a otra H, no cambies datos ni backend y no ejecutes tareas de la cola.

## Corrección focal C1 — indicadores del popup (2026-09-09)

PRE-CHANGE AUDIT — PASS. El propietario identifica en sus capturas de texto Normal los indicadores de AdminPopup agrandados. Causa confirmada: el fondo del button de 8px se pinta sobre el mínimo táctil global de 48px. Contrato: imagen, copy, flechas, selección directa, avance automático, CTA, cierre y estilos restantes intactos. Alcance: únicamente CSS de los botones `aria-label="Pop-up N"` y su grupo; separación de indicador visible y área táctil; wrap de indicadores para evitar colisiones con flechas en anchos estrechos. HTML/CSS cachebuster y manifiesto/versiones SW son GENERATED_ARTIFACT; bundle y código JS permanecen idénticos. Documentación de esta H, changelog y evidencia focal asociados autorizados. No cambia arquitectura; Registry consultado y mapping confirmado directamente por su stale ya documentado.

Datos/tablas/APIs/autoridades/legacy: NOT APPLICABLE; sin cambios ni escrituras. Riesgo: targets superpuestos, cantidad de indicadores o selección incorrectas. Verificación: popup real aislado, 320/390/430 × tres tamaños, varios conteos; puntos de 8px, selección, flechas, targets de 48px separados y ausencia de overflow. Build allowlist y entrega por hash. Regresión global NOT APPLICABLE: ningún helper, viewer, routing, Auth, Storage o lógica SW cambia. Recovery: revert de CSS/cachebusters de C1. La publicación sigue autorizada por la H original y la corrección solicitada.

Ampliación de verificación: `scripts/test-text-size-scope.js` debe comprobar que los cachebusters HTML/SW coinciden, en vez de exigir eternamente v239. Se ajusta sólo esa aserción y se actualiza su evidencia; no cambia código productivo ni la comprobación de equivalencia de negocio.
