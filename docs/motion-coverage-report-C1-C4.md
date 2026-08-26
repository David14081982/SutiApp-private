## D0 (11 ago 2026) · Cierre de decisiones previo a C5

**1 · `dur.spatial` = 420 ms.** Fijado en `motion.jsx`. Consumidores verificados contra el
código actual: **solo dos**, ambos internos — `shared.claimIn` (`D = spatialMs()` → 420 ms)
y `shared.claimOut` (`× .78` → **328 ms**, proporción conservada; no había razón técnica
para cambiarla). Ninguna pantalla consume el token directamente. El override de QA cambia
su default a 420 y conserva 480 como comparación (`qaSpatial`). Verificado en vivo:
`MOTION.dur.spatial = 420`, `qa.spatial() = 420`, salida calculada 328.

**2 · Pop-up administrable (E·#2) — corregido.** El efecto que lo programa ahora sale
temprano mientras exista una ruta saliente (`if (outgoing) return;`) y **no** marca la
pantalla como mostrada, así que se reprograma al terminar la salida (`outgoing.id` entra en
las dependencias). Sin transición saliente el comportamiento es idéntico al anterior:
**cero latencia añadida**. Sigue respetando reduced-motion (ahí `outgoing` es siempre
`null`, la retención no existe), navegación rápida, cambio de tab y cancelación.

**3 · `markVisto` — NO SE CAMBIÓ NADA.** Semántica decidida: *vista cuando el usuario abre
efectivamente su detalle*. El comportamiento actual ya la cumple: el efecto vive **dentro**
de `ProductScreen` / `CatalogItemScreen`, así que solo puede ejecutarse si esa pantalla de
detalle se montó, es decir si el usuario la abrió. El caso que la auditoría marcó como
riesgo (el store emite durante los 328 ms de retención y la pantalla ya salida marca visto)
**no viola la nueva definición**: esa cotización sí fue abierta por el usuario. No existe
ninguna ruta por la que una cotización nunca abierta termine marcada como vista, así que
**no se añadió ningún guard de motion** — la semántica de negocio no la decide la capa de
presencia. Riesgo E·#5 **cerrado por definición, sin cambio de código.**

**Estado de validación:** `HUMAN MOTION VALIDATION: PASS` (C1–C4 aprobados por el usuario) ·
`VISIBLE FPS VALIDATION: PENDING`. No se declara ningún resultado de 60 FPS.

**Pendiente de esta autorización, no iniciado:** C5.1 (FLIP en reorder de admin, con su
veredicto GO/NO-GO), C5.2 (indicador de chips), C6 (stateful action feedback).

---

# Motion Coverage Report — BEFORE / AFTER (C1 → C4)

Fases ejecutadas: **C1 Pressable global · C2 Buttons · C3 Cards/Tiles/Rows · C4 Forms**.
**C5–C8 no iniciados** (gate).

## A · Cobertura global

| | Elementos interactivos | Con respuesta real | Cobertura |
|---|--:|--:|--:|
| **BEFORE** | 582 | 149 | **26 %** |
| **AFTER** | 593 | 511 | **86 %** |

Misma metodología de conteo que la auditoría original (ocurrencias en código, no nodos
en pantalla). La población sube de 582 a 593 porque el recuento AFTER también reconoce
sintaxis JSX (`<button>`, `<input>`), que la primera pasada no contaba —
`screens-terreno.jsx` y `tweaks-panel.jsx` estaban escritos así y aparecían como 0 %.
Con el criterio antiguo el AFTER es 84 %; con el nuevo, 86 %. **El BEFORE con el criterio
nuevo sigue siendo 26 %** (los archivos JSX no tenían ninguna cobertura).

**Regla de "respuesta real" (no inflable):** el elemento produce un `transform` o un ring
de foco perceptible al interactuar. Un `transition: color` u `opacity` en hover **no**
cuenta. Todo lo contado aquí es verificable en el DOM: `[data-pressed]` produce
`matrix(0.955|0.975|0.988)` medido, no declarado.

## B · Cobertura por pantalla

| Pantalla / archivo | Int. | Cubiertos | BEFORE | AFTER |
|---|--:|--:|--:|--:|
| `screens-home-r2` · Inicio | 8 | 8 | 88 % | **100 %** |
| `screens-terreno` · Terrenos | 7 | 7 | 0 % | **100 %** |
| `screens-documentos` | 5 | 5 | 60 % | 100 % |
| `screens-company` | 10 | 10 | 30 % | 100 % |
| `screens-admin-content` | 20 | 20 | 25 % | 100 % |
| `screens-admin-fondos` | 17 | 17 | 12 % | 100 % |
| `screens-admin-pantallas` | 14 | 14 | 29 % | 100 % |
| `screens-admin-branding` | 4 | 4 | 25 % | 100 % |
| `admin-popup-editor` | 22 | 22 | 14 % | 100 % |
| `custom-screen` | 2 | 2 | 50 % | 100 % |
| `screens-admin` | 22 | 21 | 36 % | 95 % |
| `screens-admin-news` | 22 | 21 | 18 % | 95 % |
| `screens-admin-convenios` | 51 | 48 | 16 % | 94 % |
| `tweaks-panel` (dev) | 14 | 13 | 0 % | 93 % |
| `screens-marketplace` | 27 | 25 | 48 % | 93 % |
| `screens-admin-catalogo` | 25 | 23 | 28 % | 92 % |
| `screens-financiera` | 10 | 9 | 50 % | 90 % |
| `screens-credencial` | 10 | 9 | 20 % | 90 % |
| `screens-admin-sindicato` | 30 | 26 | 10 % | 87 % |
| `screens-admin-fincat` | 31 | 27 | 23 % | 87 % |
| `screens-loan` | 7 | 6 | 57 % | 86 % |
| `screens-admin-planes` | 27 | 23 | 26 % | 85 % |
| `screens-admin-finanzas` | 13 | 11 | 15 % | 85 % |
| `screens-admin-roles` | 19 | 16 | 11 % | 84 % |
| `screens-historial` | 6 | 5 | 67 % | 83 % |
| `screens-catalogo` | 10 | 8 | 40 % | 80 % |
| `screens-admin-membresias` | 15 | 12 | 33 % | 80 % |
| `signature` | 5 | 4 | 20 % | 80 % |
| `screens-company-modules` | 38 | 29 | 18 % | 76 % |
| `screens-admin-flujos` | 39 | 29 | 33 % | 74 % |
| `app.jsx` · shell | 15 | 11 | 13 % | 73 % |
| `screens-convenios` | 15 | 10 | 53 % | 67 % |
| `admin-store` (pop-up) | 8 | 5 | 13 % | 63 % |
| `ui.jsx` · biblioteca | 25 | 11 | 14 % | 44 % |

**El admin dejó de ser otra aplicación:** pasó de 10–36 % a 63–100 %.

## C · Migrado por patrón

| Patrón | Mecanismo | Elementos alcanzados |
|---|---|--:|
| **Pressable** (C1) | Delegación en `document`: 1 juego de listeners para toda la app | **todos** los `<button>` no deshabilitados + `.su-press` + `[data-press]` ≈ 320 |
| Icon buttons | Detección automática (botón compacto sin texto → intensidad `strong` .955) | ~120 |
| **Buttons** (C2) | `Btn` con intensidad por variante + `loading`/`success`/`disabled`/`danger` | 90 |
| Chevrons de fila | `button[data-pressed] > svg:last-child:not(:first-child)` → +2.5 px | ~60 |
| **Cards** (C3) | `Card` con `onClick` → `data-press="subtle"` + sombra interpolada | ~40 |
| Tiles | `IconTile`/`ResTile` → contra-press .955 dentro de la fila presionada | ~35 |
| Rows | Cubiertas por Pressable, sin tocar cada implementación | ~158 |
| **Inputs** (C4) | Foco global (`:focus-visible` ring) + transición en `input/textarea/select` | **105** |
| SearchBar | `:focus-within` eleva el campo y el icono responde | 5 |
| Slider | Thumb con `scale(1.18)` al arrastrar | 4 |
| Toggle / FavHeart | Ya existían (M2/M4) | 36 |

**Reducción de duplicación:** `su-press` y `su-btn` dejaron de ser dos sistemas
independientes con `:active` propio; ahora son alias del mismo motor. No se añadió una
tercera capa.

**Coste:** un `pointerdown`/`pointermove`/`pointerup` delegados y pasivos, más una
medición de ancho por press. **Cero** rAF, observers, WAAPI permanentes o listeners por
elemento. Todo el movimiento es CSS (`transform`/`opacity`/`box-shadow`).

## D · M0 justificados (sin motion, a propósito)

- **Paneo/arrastre del mapa de Terrenos**: gesto directo 1:1; añadir easing daría lag.
- **Tablas informativas ligadas a scroll**: se leen, no se contemplan.
- **Skeletons falsos**: los stores son síncronos sobre `localStorage`; no hay latencia
  que representar. **No se añadió ningún loader artificial.**
- **Cifras y texto de contenido**: no se animan por decoración.
- **Dibujo del QR**: es un código de lectura.
- **Iconografía decorativa** (sellos, marcas de agua).
- **`Badge`, `Timeline`, `EmptyState`, `Avatar`, `Skeleton`** (parte del 44 % restante de
  `ui.jsx`): no son interactivos.

## E · Elementos que siguen secos y por qué

**Censo cerrado (post-verificación).** Se recorrieron TODOS los clicables que no son
`<button>` en los 51 archivos: **31 en total**. De ellos:

- **13 son backdrops de modal/sheet** (`onClick: onClose`) → **M0 justificado**: escalar un
  fondo de 100 % de la pantalla al tocarlo sería un defecto, no feedback.
- **12 son contenedores con `stopPropagation`** → no son interactivos: solo impiden que el
  clic llegue al backdrop.
- **6 eran clicables reales sin respuesta.** Se cerraron 4 en esta pasada:
  fila editable de membresías, imagen de galería del catálogo, tarjeta de promoción de
  empresa y **la credencial que se voltea** (press compuesto con su `rotateY`, según la
  regla nueva de un solo escritor de `transform`).
- **2 quedan M0 a propósito:** los `span` de texto de las filas con `Toggle` (el control
  es el toggle) y la portada de noticia con `data-shared-key` (su respuesta al tap **es**
  la transición compartida al artículo; añadir press metería un segundo escritor de
  `transform` en el nodo héroe).

Corrección al inventario original: la credencial **ya tenía** el volteo 3D (M3); la
auditoría lo había listado como ausente.

Lo que sigue pendiente **no es cobertura de press**, es estado:

| Dónde | Qué | Por qué |
|---|---|---|
| `screens-convenios` | Chips de categoría | Ya reciben press; falta el **indicador deslizante compartido** (C5): requiere sustituir `Pill` por un chip local |
| `app.jsx` | Chips de saldo del TopBar | Son `div` informativos con datos, no controles: press solo si se vuelven navegables |
| Global | `loading`/`success` de botón | La **capacidad** está en `Btn`; adoptarla toca flujos concretos y requiere tu visto bueno caso por caso |
| Global | Validación de formularios | No existe validación funcional en el producto. Quedan los **hooks** CSS (`aria-invalid`, `.su-err`) sin inventar estados |

## F · Regresiones encontradas y corregidas

1. **Press muerto en documento oculto.** La primera versión apagaba el press con
   `MOTION.frozen()`. El press es CSS puro y no depende del reloj de animación:
   se corrigió para que **solo** `reduced()` lo apague. Sin esto, la app no habría tenido
   feedback en pestañas en segundo plano ni en previews.
2. **`transition: all` en Terrenos** (2 ocurrencias, chips y segmentado 3D/Plano):
   sustituidas por propiedades explícitas. Quedan 2 fuera del scope migrado
   (`admin-popup-editor`, `ui.Pill` ya corregido) — no se hizo limpieza global.
3. **Fuga de variable en icon buttons**: la intensidad automática (`--press-s`) se
   escribía inline; se añadió `data-press-auto` para retirarla siempre al soltar.
   Verificado: cero elementos con la variable pegada.
4. **Press invisible en nodos gobernados por un driver de scroll** (detectado en
   verificación): las tarjetas de noticia de Inicio y el carrusel de anuncios de Convenios
   escriben `transform` **inline** por frame, y el estilo inline siempre gana a la regla de
   hoja de estilo del press — `data-pressed` se ponía y se quitaba bien, pero no se veía.
   **Causa raíz:** dos fuentes escribiendo `transform` sobre el mismo nodo sin componerse.
   **Corregido por composición**, sin tocar la lógica de los drivers: el press define
   `--press-s` y el driver multiplica —
   `scale(calc(<escala del driver> * var(--press-s, 1)))`. Medido en vivo: la tarjeta
   inactiva del carrusel pasa de `0.94` a `0.9287` al presionar (×0.988) y vuelve a `0.94`;
   cero estados pegados. Archivos: `SutiApp.html`, `app/screens-home-r2.jsx`,
   `app/screens-convenios.jsx`.
5. **Press de la credencial con la duración del volteo** (detectado en verificación): al
   adoptar el press en el mismo nodo del volteo 3D, heredó su `transition: transform .7s`
   — 4× el token del sistema. Una sola declaración no puede dar dos duraciones a la misma
   propiedad. **Corregido** moviendo el press al wrapper con `perspective` (sin `transform`
   propio) y dejando el `rotateY` y su .7 s en el nodo interior. Medido: wrapper 0.16 s,
   volteo 0.7 s, **ningún** nodo con press por encima de 0.3 s.

**Regla nueva (obligatoria):** si un nodo ya recibe `transform` inline de un driver, ese
transform debe incluir `* var(--press-s, 1)`. Nunca dos escritores de `transform` por nodo.

## G · Performance

Sin medición de FPS (sigue pendiente en entorno visible, sección C del documento de
validación). Lo que sí es verificable estructuralmente:

- Listeners añadidos: **8 en total, todos delegados y pasivos** (para ~320 elementos).
- Trabajo por press: 1 `closest()`, 1 lectura de `offsetWidth` (solo en botones sin texto)
  y 2 mutaciones de atributo. Ningún reflow forzado en bucle.
- Todo el movimiento es `transform`/`opacity`/`box-shadow`. **Ninguna animación de layout.**
- Sin `will-change` persistente.

## H · Reduced Motion

- `Pressable` no marca nada con `reduced()` → sin escalas.
- CSS: `@media (prefers-reduced-motion: reduce)` anula `transform` de press, el shift de
  chevrones, el contra-press de tiles, la transición de campos y la entrada de errores;
  el check no se dibuja (aparece completo) y el spinner gira más lento.
- Verificado con `MOTION.qa.setReduced('on')`: el press deja de marcar y no queda ningún
  elemento con estado.

## I · Baseline de no-regresión

Inicio con pop-up cerrado, medido tras C4: **41 svg / 9 image-slot / 0 img / 30 button** —
idéntico al baseline documentado. Ningún patrón añadió nodos: todo se resolvió con
atributos y CSS.

## J · Recomendación para C5–C8

1. **C5 (FLIP)** — un solo candidato real: **reordenar filas de admin por arrastre**
   (5 paneles, mismo código duplicado). Hoy los vecinos saltan a su nueva posición. Es el
   único caso donde el usuario pierde continuidad de verdad. Prototipar ahí y decidir
   GO/NO-GO; el filtrado de listas **no** lo necesita.
2. **C3 tardío** — **cerrado en esta pasada**: el censo demostró que de los ~30 `div
   onClick` supuestamente secos, 25 eran backdrops o contenedores no interactivos y solo
   quedaban 6 reales, de los que se cerraron 4. No hace falta una fase para esto.
3. **C2 tardío** — decidir contigo dónde adoptar `loading`/`success` de botón: candidatos
   naturales son enviar solicitud de préstamo, guardar en admin y subir documento.
4. **C6 (admin)** — con 63–100 % ya alcanzado por herencia, la segunda pasada debería
   limitarse a guardar → check y eliminar → colapso de fila.
5. **C7/C8** — mi recomendación es **posponerlos**. Tu hipótesis era correcta: al subir la
   cobertura transversal, la necesidad de momentos signature adicionales baja.

## Archivos modificados en C1–C4

- **Nuevo:** `app/press.jsx` (motor de Pressable, delegado).
- `app/ui.jsx` — `Btn` (variantes, estados, `danger`), `Card` interactiva, `IconTile`
  (`su-tile`), `SearchBar` (`:focus-within`), `Pill` sin `transition: all`.
- `app/screens-terreno.jsx` — `transition: all` × 2 sustituidas.
- `SutiApp.html` — bloque CSS del sistema de microinteracción; `?v=42`.
- `app/bundle.js` — regenerado con `press.jsx` insertado tras `ui.jsx`.

## Estado

**C1–C4 COMPLETADOS · GATE ACTIVO.** C5–C8 no iniciados. Pendiente tu validación humana.
