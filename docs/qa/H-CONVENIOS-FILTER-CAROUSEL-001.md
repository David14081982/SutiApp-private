# H-CONVENIOS-FILTER-CAROUSEL-001

PRE-CHANGE AUDIT
Objetivo: Todos fijo; las demás categorías en una sola fila con desplazamiento automático, pausa al tocar/pasar el cursor y desplazamiento manual.
Alcance: componente local de filtros en app/screens-convenios.jsx; app/bundle.js (GENERATED_ARTIFACT focal); SutiApp.html (cachebuster); scripts/test-convenios-filter-carousel.js; este informe; docs/AGENT_CHANGELOG.md; docs/qa/evidence/convenios-filter-carousel-20260911/.
Fuera de alcance: ChipBar compartido, motion compartido, app shell/rutas, datos, APIs, permisos, Supabase, Storage, Google y sw.js.
Datos afectados / Tablas / APIs / Legacy: ninguno.
Fuentes de verdad: categorías derivadas de directory.rows, useConvenios / ConveniosRepository, sin cambios.
Invariantes: mismos valores/categorías y filtro; Todos restaura listado; buscador, panel de filtros, anuncios, favoritos, destacados, tarjetas, detalle y navegación conservados.
Riesgo: interacción UI focal; cuidar pausa táctil y teclado, movimiento reducido, fin de recorrido y cleanup al desmontar.
Tests: Chrome aislado móvil/escritorio, movimiento/pausa/reanudación, arrastre nativo, selección, resize, categorías vacías/cortas y reduced motion; compilación focal y diff contra snapshots anteriores.
Recovery: snapshots locales tmp/convenios-filter-carousel/; revertir únicamente el delta de esta H, preservando cambios previos.
Status: PASS

SOURCE OF TRUTH AUDIT
Domain: presentación de categorías de Convenios.
Authority: misma proyección pública Supabase; este cambio recibe cats existentes.
Readers/Writers: lectores existentes intactos; sólo cambia estado efímero de selección/scroll. Cero escritores de negocio.
Alternative sources / Fallbacks / Caches / Conflicts: ninguno introducido.
Verdict: SAFE.

UI contract: header/campana, espacio publicitario y carrusel, buscador, botón de filtros y sheet, favoritos, destacados, listado y detalle conservados. Única sustitución autorizada: fila de categorías, con Todos fijo y movimiento automático. Respeta MOTION.reduced/frozen y foco de teclado.
Registry: check/lookup solicitados; discovery directo confirma screens-convenios.jsx, ChipBar y MOTION. Cambio de layout/microinteracción, sin nuevas rutas/dependencias/autoridades; sin regeneración estructural.
Regresión global: NOT APPLICABLE; no se modifican helpers/repositorios compartidos, shell, assets ni SW.

H-CONVENIOS-FILTER-CAROUSEL-001 RESULT
Status: PASS — implementación local verificada.
Files changed: app/screens-convenios.jsx; app/bundle.js; SutiApp.html; scripts/test-convenios-filter-carousel.js; docs/qa/H-CONVENIOS-FILTER-CAROUSEL-001.md; docs/AGENT_CHANGELOG.md; docs/qa/evidence/convenios-filter-carousel-20260911/{build.json,browser.json,mobile.png}.
Source-of-truth verdict: PASS — cats, clasificaciones, filtrado y repositorios intactos. Sin fuentes alternativas, caché, fallback o escritores nuevos.
Invariant verdict: PASS — componente local y una invocación son el único delta de fuente contra snapshot; todo el resto de Convenios es idéntico. Bundle focal corresponde a fuente (INV-015).
Build: PASS — Babel Standalone 7.29.0 preset react, sintaxis vm.Script; demás módulos byte-identical; cachebuster v253; node scripts/test-pages-deployment.js PASS.
Tests: PASS — node scripts/test-convenios-filter-carousel.js; 12 comprobaciones Chrome aislado, viewports 320/390/430/1440, cero requests de red y cero pageErrors. Incluye gesto táctil nativo CDP, pausa durante pointercancel, reanudación, drag mouse sin click accidental, categorías, Todos, foco/Enter, extremos, reduced motion, vacío/sin overflow y desmontaje.
Security: NOT APPLICABLE backend; no se modifican permisos, Auth, RLS, secretos, Storage o repositorios. Pruebas aisladas sin datos de negocio.
Legacy impact: NOT APPLICABLE — sin lecturas/escrituras financieras ni Google.
Unexpected files changed: ninguno por esta H; múltiples cambios preexistentes se preservan mediante comparación con snapshots iniciales.
Known limitations: verificado localmente; no se ha publicado este cambio. Captura de harness aislado, no sesión productiva. Con movimiento reducido, el usuario controla manualmente la fila. El panel de filtros conserva ChipBar compartido.
Evidence: build.json, browser.json y mobile.png en el directorio focal; recuperación en tmp/convenios-filter-carousel/.

CLAUDE UI PRESERVATION REVIEW
Screen: Convenios.
Original sections: header/campana, anuncios, buscador/filtro, categorías, favoritos, destacados, listado, sheet y detalle.
Current sections: las mismas; categorías en una fila con Todos fijo.
Missing sections / Added sections: ninguna.
Interactions preserved: selección y filtro conservan valores/callbacks; scroll manual, hover, touch y teclado verificados.
Navigation preserved: destinos y handlers idénticos por comparación exacta de fuente fuera del componente.
Visual structure preserved: una fila autorizada; paleta, píldoras y espaciado basados en ChipBar; 4 anchos sin overflow global.
Unauthorized redesign: NO.
Verdict: PASS.

SUTIAPP ARCHITECT REVIEW
Task: H-CONVENIOS-FILTER-CAROUSEL-001.
Verdict: APPROVED.
Critical findings: scope comprobado contra snapshots; componente privado en pantalla existente, sin export runtime ni cambios a ChipBar/MOTION compartidos. Test export sólo dentro del harness aislado. Cleanup de RAF/listeners/observers al desmontar. No se sustituyen categorías ni se seleccionan automáticamente.
Source of truth: sin cambios.
Architecture: microinteracción local; Registry STALE preexistente y confirmado por lookup dirigido; no cambian rutas, relaciones ni autoridad.
Security / Data / Legacy: sin impacto.
Owner decision: NO.
Next action: entregar el ajuste local y su evidencia. No iniciar otra H.
Response generated for Codex: YES.

RESPONSE TO CODEX
Aprobar y entregar la implementación local de H-CONVENIOS-FILTER-CAROUSEL-001 con los checks registrados; conservar todos los cambios previos. No afirmar despliegue productivo.


PUBLICATION AUDIT — PASS
Owner autoriza publicar/commit/push. Base aislada main 35d7c30; se conserva menú Ahorro y todos los ajustes de texto vigentes. Sólo se inserta el componente y cambia su invocación; fuente restante exacta. El componente usa var(--text-13-5, 13.5px), como ChipBar actual. Sin cambios a CSS/UI compartidos. Mismo alcance de archivos/evidencia; se reutiliza worktree limpio para preservar workspace principal. Volver a ejecutar pruebas sobre esta adaptación antes de publicar.

RELEASE VERIFICATION — PASS
La autorización posterior del usuario amplía el cierre local a commit/push/publicación. Se conserva el alcance focal.
Build y test-pages-deployment PASS. Trece checks aislados PASS, incluidos los cuatro tamaños de texto con CSS publicado. Pantalla completa en build local: autoplay/Todos, hover, filtro real/restauración, móvil/escritorio, pausa/reanudación táctil, secciones conservadas y refresh PASS. pageErrors=0; businessWrites=0.
Evidencia: browser.json, build.json, local-release.json y local-release-row-{390,1440}.png.
CLAUDE UI PRESERVATION REVIEW: PASS — captura real inspeccionada; Todos estático y categorías en fila; resto de fuente intacto.
SUTIAPP ARCHITECT REVIEW: APPROVED — comparación de fuente y bundle contra main 35d7c30 limita el delta a componente local + llamada + cachebuster. Tipografía actual preservada. No hay cambios de datos, seguridad, legacy, SW ni helpers compartidos.
RESPONSE TO CODEX: publicar exclusivamente este delta autorizado y verificar GitHub Pages y la pantalla productiva; no incluir cambios previos del workspace principal.
