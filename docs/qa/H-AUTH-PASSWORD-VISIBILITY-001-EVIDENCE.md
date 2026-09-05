# H-AUTH-PASSWORD-VISIBILITY-001

## PRE-CHANGE AUDIT

- Objetivo/autoridad: solicitud expresa del propietario: ojo accesible en login y campos actuales de nueva contraseña/confirmación; prueba focal y publicar, detenerse.
- Alcance: presentación `field`/`AffiliateLoginScreen` en `app/affiliate-auth.js`; `app/bundle.js` regenerado; versiones en `SutiApp.html` y `sw.js`; `scripts/test-password-visibility-browser.js`; este documento de evidencia.
- Fuera de alcance: lógica Auth/login, sesiones, repositories, backend, RLS, datos, legacy, diseño/layout/tamaños/colores y suites globales.
- Datos/tablas/APIs: ninguna escritura nueva. Supabase Auth conserva autoridad de credenciales; el formulario conserva sus valores y callbacks. Los booleanos de visibilidad son estado UI efímero.
- Invariantes: contraseña oculta por defecto, mismo input/valor/autocomplete, foco y selección conservados al tocar, botones no envían formulario, controles independientes.
- Riesgo: interacción touch/teclado. Recovery: revertir únicamente este commit y republicar.
- Navigator: check STALE preexistente (682 changed, 11 added); lookup login y discovery directo de `app/affiliate-auth.js` confirman target. Microinteracción sin cambio de arquitectura; no se regenera Registry.
- Estado de auditoría: PASS. Cambios preexistentes en gobierno, scripts Auth/CSV y preparación de dominio excluidos del commit.

## Contrato visual

Login/activación/recuperación conservan sello, títulos, subtítulos, formulario, email, contraseñas, mensajes, submit, enlaces y pie; navegación/loading/error intactos. Cada contenedor conserva 52 px de altura y sus estilos. Única adición autorizada: botón de ojo de 44 × 44 px a la derecha y espacio interior para evitar superposición del texto.

## Verificación focal

Comando: `PLAYWRIGHT_MODULE=<playwright-core instalado> node scripts/test-password-visibility-browser.js [URL pública]`.

La prueba monta la UI con callbacks aislados sin acceso a backend y compara geometría antes/después contra HEAD. Cubre login, activación y recuperación en WebKit/iPhone 13 y Chrome/Pixel 5: oculto inicialmente, alternancia e icono/aria-label, controles independientes, área táctil, mismo nodo/input, valor, selección/foco, autocomplete, Espacio/Enter y envío con el valor original. La variante pública prueba el ojo sin enviar credenciales.

Durante la prueba WebKit se detectó que cancelar pointerdown bloqueaba el click táctil; se corrigió usando mousedown para impedir solamente la transferencia de foco. No hay cambios de backend ni pruebas con contraseñas reales.

Build: `node scripts/build-bundle.js C:/tmp/babel-standalone-7.28.4.min.js`. Diff del bundle limitado al bloque affiliate-auth. HTML v206 y caché v152 son artefactos de publicación; lógica de sw.js idéntica. Suites globales excluidas por instrucción expresa y alcance UI focal.

## Revisiones

- Source-of-truth: SAFE; autoridad/callbacks existentes sin cambios, sin persistencia/fallback nuevos.
- Supabase security: PASS para el diff; ningún cambio a autorización, sesiones, permisos, RLS o exposición de secretos. Certificación global de backend NOT APPLICABLE.
- Claude UI preservation: PASS sujeto a ejecución focal; secciones e interacciones preservadas, sin rediseño no autorizado.
- Invariantes/legacy/datos: conservados, sin modificaciones.

## Resultado

Estado implementación: PASS. Prueba focal: 6/6 PASS (tres flujos por motor), geometría idéntica, toque/foco/selección/valor/autocomplete/teclado/envío PASS. Build y syntax/diff check PASS. Publicación y comprobación pública pendientes en el momento de este commit.
Archivos inesperados de esta H: ninguno; modificaciones previas excluidas.
Limitación: emulación móvil con motores reales, sin prueba en teléfonos físicos ni gestores nativos de contraseñas.
Siguiente acción autorizada: finalizar prueba focal, publicar, verificar el ojo público y detenerse.

SUTIAPP ARCHITECT REVIEW: APPROVED para el alcance implementado y probado. Inspección del diff confirma cambios exclusivamente UI y versiones de publicación; no se alteraron funciones Auth, submit, autoridades ni legacy. Owner decision: NO. RESPONSE TO CODEX: publica este cambio autorizado, comprueba el ojo en la URL pública, registra el resultado y detente; no avances a otra H.
