# SutiApp — notas de build

## Bundle precompilado (IMPORTANTE)
`SutiApp.html` NO carga los `.jsx` ni Babel: carga `app/bundle.js`, un bundle precompilado (Babel preset "react", cada archivo envuelto en IIFE, en el orden original de los script tags).

**Después de editar cualquier archivo en `app/`, regenera `app/bundle.js`** con run_script: cargar Babel standalone 7.29.0 via script tag en el sandbox, transpilar cada `.jsx` (los `.js` van verbatim), concatenar en este orden y subir `?v=` en SutiApp.html:

assets-registry.jsx, assets-store.jsx, assets-resolver.jsx, motion.jsx, icons.jsx, brand.jsx, ui.jsx, press.jsx, reveal-cards.jsx, data.jsx, institutional-repositories.js, institutional-content.js, tweaks-panel.jsx, signature.jsx, screens-home-r2.jsx, screens-financiera.jsx, screens-loan.jsx, screens-marketplace.jsx, screens-terreno.jsx, screens-convenios.jsx, screens-historial.jsx, screens-credencial.jsx, image-slot.js, screens-documentos.jsx, admin-store.jsx, custom-screen.jsx, sindicato-store.jsx, finance-store.jsx, quotes-store.jsx, flow-store.jsx, funds-seed.js, funds-store.jsx, admin-popup-editor.jsx, screens-admin-roles.jsx, screens-admin-content.jsx, screens-admin-news.jsx, screens-admin-convenios.jsx, screens-admin-sindicato.jsx, screens-admin-finanzas.jsx, screens-admin-flujos.jsx, screens-admin-fondos.jsx, fincat-store.jsx, screens-admin-fincat.jsx, screens-admin-branding.jsx, screens-admin-pantallas.jsx, screens-admin.jsx, company-store.jsx, catalog-store.jsx, screens-catalogo.jsx, screens-admin-catalogo.jsx, screens-admin-planes.jsx, membership-store.jsx, screens-membresias.jsx, screens-admin-membresias.jsx, screens-company-modules.jsx, screens-company.jsx, copy-store.jsx, live-text.jsx, affiliate-view-model.js, affiliate-auth.js, app.jsx

(Transpilar en 5-6 tandas: una sola excede el timeout de 30s. Guardar parciales en `app/.bN.js`, concatenar y borrarlos.)

React va en production.min. Eliminados por muertos: android-frame.jsx, screens-promo.jsx.

---

## Motion System (M1 · cerrado)

`app/motion.jsx` es la **única** fuente de movimiento. Va cuarto en el bundle (tras los tres de assets, antes de `icons.jsx`) y no depende de ningún otro global al cargar.

- Tokens: `dur` (90/140/220/320/480), `ease` (standard/emphasized/enter/exit/spatial), `spring` (gentle/snappy/firm), `dist` (8/14/24), `scale`, `stagger` (35 ms, tope 6).
- Primitivas: `animate` (WAAPI con política de reduced-motion), `springTo` (rAF), `onScroll`/`progress` (**B**: un listener pasivo por contenedor, una lectura de `scrollTop` por frame), `flipCapture` (**C**), `reveal` + `useReveal`, `shared.captureFrom/claimIn/claimOut/pending/clear` (**A**).
- **Reglas duras**: solo `transform`/`opacity` (+`border-radius`); prohibido animar `top/left/width/height`; ninguna pantalla define curvas ni duraciones propias — se consumen de `MOTION`.
- `MOTION.frozen()` = `document.hidden`. En documento oculto **no se oculta nada para animarlo después** (el reloj de animación está congelado y el contenido quedaría invisible). `reveal()` además tiene red de seguridad por timeout: un bloque no puede quedarse invisible aunque el `IntersectionObserver` no dispare.
- Capa de presencia (`app.jsx`): `popOne()` es el único camino de salida de una ruta; la pantalla que sale conserva su `key` por profundidad, así que **no se re-monta** (mantiene DOM, scroll y estado). `push`/`back`/`setTab` no cambiaron de firma.
- Consumidores M2: Inicio (`useReveal`), `TopBar` (collapsing sticky con `useScrollDriver`), noticia→artículo (`data-shared-key` / `-inner` / `-title` / `-follow`).
- **Al medir en un preview oculto**: cada `setTimeout` se estrangula (~1 s, y hasta ~1/min tras varios minutos oculto) y las animaciones WAAPI no avanzan (`currentTime` 0). No confundirlo con un cuelgue: limitar los scripts de prueba a 2-3 esperas y preferir llamadas separadas.
- **Regla de retención**: si no hay animación posible (`frozen()` o `reduced()`), la ruta saliente **no se retiene**: se desmonta en el mismo commit. Sin esto la capa saliente se quedaba montada indefinidamente en documento oculto (bug real detectado en QA).

### M3 · Shell (nav, toast, sheets, toggles)
- **Nav inferior**: el fondo guinda ya no vive en cada botón — hay **un solo indicador** absoluto en `BottomNav` que se mide tras el commit (`useLayoutEffect`) y viaja con `transform`; el icono entrante hace pop 1→1.12→1. Con `reduced()`/`frozen()` salta sin animar. Los botones solo interpolan color y tamaño de caja.
- **Toast**: presencia real (retiene el mensaje mientras sale), entrada spring desde abajo, salida a 200 ms y **barra de vida** del auto-dismiss (2600 ms, `scaleX`). Con reduced-motion solo cruza opacidad.
- **Sheet** (`ui.jsx`): curva unificada `cubic-bezier(.32,.72,0,1)` (sin overshoot: un sheet anclado abajo no debe rebasar 0) + **drag-to-dismiss** con seguimiento 1:1; solo arranca con `scrollTop === 0`, decide por distancia (28 % del alto) o velocidad (>0.55 px/ms).
- **Pop-up administrable**: el blur del backdrop se interpola en ambas direcciones (`blur(0px)`↔`blur(3px)`), ya no salta al cerrar.
- **Toggles**: los 22 thumbs duplicados pasaron de animar `left` (layout) a `transform: translateX(...)` y luego se **unificaron en `window.Toggle`** (`ui.jsx`): 4 tallas (`sm` 40×24 · `md` 42×25 · `lg` 44×26 · `xl` 46×28), `glow` opcional, press que comprime el thumb (`scaleX(1.14)`), curva y duración únicas (`.22s cubic-bezier(.34,1.56,.64,1)`). Sin `onClick` renderiza un `div` (la fila padre recibe el clic); con `onClick` renderiza un `button` con `disabled`/`aria-label`. Cero implementaciones sueltas: si aparece un toggle nuevo en un panel, usar este componente.

### M4.1 · Primeras pantallas de usuario
- **`window.FavHeart`** (`ui.jsx`): corazón de favorito con spring 1→1.3→.94→1 y destello radial que se disipa (300 ms). Consumido en las dos instancias de Convenios (tarjeta y detalle); sigue leyendo `convenios.card.fav` del registro de assets. Apagar no anima: solo cambia el relleno.
- **Inicio · Ecosistema**: la retícula 3×N entra escalonada al aparecer (`useReveal`, paso 25 ms, 10 px).
- **Historial · progreso de la solicitud en curso**: los segmentos se llenan en secuencia (`scaleX` 0→1, 400 ms, 70 ms entre segmentos, `fill: backwards`) una sola vez por solicitud. Con `reduced()`/`frozen()` se pintan en su valor final.

### M4.2 · Carruseles y chips
- `MOTION.onScroll` publica ahora **dos** lecturas por frame: `fn(scrollTop, scrollLeft)`. Compatible hacia atrás (los suscriptores viejos ignoran el segundo argumento). Es la única vía permitida para movimiento ligado a scroll horizontal.
- **Inicio · Noticias**: `scroll-snap` x-mandatory con `scrollSnapAlign: center`; escala (.94→1) y opacidad (.74→1) ligadas a la distancia al centro. Una pasada de lectura de rects y otra de escritura por frame — nunca intercaladas. Con `reduced()`/`frozen()` no se registra el driver y las tarjetas quedan en su estado natural.
- **Convenios · carrusel de anuncios**: swipe con seguimiento 1:1, decisión por distancia (22 % del ancho) o velocidad (>0.5 px/ms); `touch-action: pan-y` para no robar el scroll vertical. El autoplay se pausa al tocar y **no arranca** con reduced-motion.
- **Convenios · chips de categoría**: el chip activo se centra con `scrollTo({behavior:'smooth'})` — nunca `scrollIntoView`. Pendiente del mapa: el indicador deslizante compartido entre chips (requiere sustituir `Pill` por un chip local).

### Estado de validación (gate M1/M2)
`docs/motion-m1-m4-validation-status.md` es la **fuente única** de qué está terminado,
validado, pendiente o bloqueado en motion. Incluye la auditoría completa de la ruta
saliente retenida (conclusión **B: segura con excepciones identificadas**) y la nota de
trazabilidad de que M3/M4 se construyeron antes de cerrar el gate. **No retirar el QA**
hasta cerrar validación humana, FPS y 480/420.

### QA de movimiento (DEV ONLY · retirable)
- `MOTION.qa`: `mode()`, `setReduced('system'|'on'|'off')`, `spatial()`, `setSpatial(ms)`, `fps(ms)`. Resolución = **override de QA ?? preferencia del sistema**; `reducedFlag` sigue reflejando el sistema real. Por defecto `system` / `spatial` nulo (= token 480).
- Superficie de usuario: panel de **Tweaks → «QA de movimiento (dev)»** (radio Movimiento, radio Transición espacial 480/420, botón «Medir frames (5 s)»).
- Cambiar de modo **cancela las animaciones vivas y limpia capturas**: nunca deja una transición a medias.
- **Para retirarlo**: borrar `qaState`/`live`/`spatialMs` y el objeto `MOTION.qa` en `motion.jsx`, el `useEffect` de QA y la sección de Tweaks en `app.jsx`, y las claves `qaMotion`/`qaSpatial` de `TWEAK_DEFAULTS`.

---

## Microinteraction System (C1–C4 · cerrado, gate antes de C5)

`app/press.jsx` es la **única** fuente de feedback táctil. Funciona por **delegación**
(8 listeners pasivos en `document` para toda la app): marca `data-pressed` y el
movimiento lo hace CSS. Cubre automáticamente todo `<button>` no deshabilitado, `.su-press`
y `[data-press]`; se excluye con `data-press="none"`.

- Intensidades (tokens, nunca valores por pantalla): `subtle` .988 (cards, filas) ·
  `standard` .975 (botones) · `strong` .955 (icon buttons, detectados solos: botón
  compacto sin texto).
- `.su-press:active` y `.su-btn:active` **ya no existen**: son alias del mismo motor.
  Prohibido añadir una tercera capa de press.
- El press se libera en pointerup/cancel/lostpointercapture/movimiento >10 px/scroll/blur/
  visibilitychange y por timeout de 700 ms. **Nada puede quedarse escalado.**
- Solo `reduced()` lo apaga. **`frozen()` NO**: es CSS puro y apagarlo en documento oculto
  dejaba la app sin feedback (regresión real detectada en QA).
- `Btn` soporta `loading` / `success` / `disabled` / `variant="danger"`: los estados viven
  **dentro del mismo botón**, no lo sustituyen por otro componente. La capacidad existe;
  su adopción por pantalla requiere autorización (toca flujos).
- Prohibido `transition: all`. **Un solo escritor de `transform` por nodo**: si un driver
  ya escribe `transform` inline (carruseles de Inicio y Convenios), debe componer el press
  con `scale(calc(<escala> * var(--press-s, 1)))` — el inline siempre gana a la hoja de
  estilo, así que sin esto el press existe en el DOM pero no se ve.
- Formularios: foco global por `:focus-visible`, hooks
  `aria-invalid` y `.su-err` disponibles — **no inventar estados de validación** que el
  producto no tenga, ni loaders/skeletons falsos (los stores son síncronos).
- Cobertura: **26 % → 86 %**. Detalle y baseline en
  `docs/motion-coverage-audit.md` y `docs/motion-coverage-report-C1-C4.md`.

### C5.1 · Reordenamiento con FLIP (`window.useFlipRows`)
Vive en `motion.jsx`. FLIP **sin captura previa**: mide en cada commit y anima el delta
contra la medición anterior (`translateY` → `none`, `dur.normal`, `ease.standard`,
`fill:'none'`). Sirve igual para arrastre (el orden ya cambió en `pointermove`) que para
botones subir/bajar.
- Firma: `useFlipRows(ref, skip, opts)`. `ref` es `{current:{id:el}}` (mapa de filas) o
  `{current: contenedor}` + `opts.selector` (por defecto `[data-flip-key]`).
- `skip` = la fila arrastrada: **no se anima**, así sigue al dedo sin lag y se respeta la
  regla de un solo escritor de `transform` por nodo (esa fila lleva `scale` inline).
- Con `reduced()`/`frozen()` no anima: el reordenamiento salta.
- Adoptado en las 5 listas de arrastre (`screens-admin.jsx` pop-ups, `-news`, `-convenios`,
  `-content`, `-sindicato`) y en el catálogo (`screens-admin-catalogo.jsx`, botones
  subir/bajar, vía contenedor + `data-flip-key`).
- Prohibido reimplementar FLIP por pantalla: `flipCapture` queda para casos donde sí se
  puede capturar antes del cambio; para listas, este hook.

### C5.2 · Chips con indicador deslizante (`window.ChipBar`)
Vive en `ui.jsx`. Sustituye a las filas de `Pill` con estado activo: **un solo**
indicador absoluto por fila, medido tras el commit y animado con
`translateX + scaleX` contra el chip más ancho (el radio horizontal se compensa
`19/s px / 19px`, así la píldora no se deforma) — nunca `width`/`left`.
Duración `dur.emphasized`, curva `ease.emphasized`; con `reduced()`/`frozen()` salta.
Centra el chip activo con `scrollTo` (nunca `scrollIntoView`).
- Adoptado en **Convenios** (categorías) e **Historial** (filtros). `Pill` sigue existiendo
  para etiquetas estáticas (tags del detalle); **prohibido** volver a construir una fila de
  chips seleccionables con `Pill active`.
- Firma: `ChipBar({ items, value, onChange, style })`; `items` = strings o `{id,label,icon}`.

### C6 · Estados dentro del botón (`window.useBtnConfirm`)
Vive en `ui.jsx`. `const [ok, run] = useBtnConfirm(ms)` → `success: ok` +
`onClick: () => run(accion)`: la palomita ocupa el mismo botón ~480 ms y luego se ejecuta
la acción real (cerrar hoja, navegar, toast). **No finge carga**: los stores son síncronos
y el guardado ya ocurrió; con `reduced()`/`frozen()` ejecuta de inmediato (sin esperar un
`setTimeout` estrangulado).
- Adoptado en: Marketplace «Enviar solicitud» ×2 (cotización y financiamiento), Branding,
  Flujos, Membresías y Mi Empresa (guardar).
- `loading` queda sin adoptar a propósito: no hay operación asíncrona real que reportar.

### M4.3 · Membresías (Finanzas)
La retícula 2×N entra **desde los laterales**: la columna izquierda desde la izquierda y
la derecha desde la derecha (50 px), encontrándose en el centro al entrar en pantalla —
`dur.spatial` + `ease.spatial`, escalonado **por fila** (90 ms), una sola vez por sesión
(`key: 'membresias'`, `data-reveal-key` = id). La retícula se sangra a ancho completo con
`overflow: hidden` para que el desplazamiento lateral no genere scroll horizontal.
El contenedor lleva `data-noreveal` para que `reveal-cards.jsx` no las revele otra vez.
- Para esto `reveal()` gana dos opciones (compatibles hacia atrás): `offset(el,i) → {x,y}`
  (desplazamiento inicial por elemento; sin ella sigue siendo `{x:0,y:distance}`),
  `indexOf(el,i)` (índice de escalonado, p. ej. fila en vez de posición) y
  `duration`/`easing` explícitos.
- Sombra: la retícula lleva colchón inferior (`padding-bottom: 34`) compensado con
  `margin-bottom: -24` para que `overflow: hidden` no seccione la sombra de la última fila.

### Repetición de los reveals (decisión de producto, 11 ago 2026)
Los efectos de entrada **se repiten en cada visita**, no una vez por sesión:
- `reveal()` cambia su default a `once: false` y **re-arma** cada elemento cuando sale por
  completo de la vista (`intersectionRatio === 0`): vuelve a su estado oculto y su red de
  seguridad por timeout se re-arma con él. `once: true` sigue disponible por opción.
- `reveal-cards.jsx` deja de hacer `unobserve` al revelar: observa con `threshold: [0, .08]`
  y re-arma al salir. No re-arma nodos con `transform` inline (los gobierna un driver).
- Sigue vigente la regla dura: con `reduced()`/`frozen()` no se oculta nada, ni al entrar
  ni al re-armar.

### Reveal de tarjetas al desplazar (`app/reveal-cards.jsx`)
Una sola instancia global: un `IntersectionObserver` + un `MutationObserver` (para las
tarjetas que aparecen al navegar). Revela `.su-card`, `.su-press` y `[data-reveal]` **una
vez** cada una: `opacity 0→1` + `translateY(10→0)`, `dur.emphasized`, `ease.enter`, con
`MOTION.stagger` por lote. Marca `data-m-revealed`, la misma convención que `reveal()`.
- **No revela**: nodos con `transform` inline (los gobierna un driver de scroll), nodos con
  `opacity:0` inline (los gobierna `reveal()`), `[data-noreveal]` y sus descendientes, y
  nodos de menos de 24 px de alto.
- El contenido se hace visible **antes** de animar, así que el ciclo de vida de la
  animación no puede dejar nada invisible; además cada inscripción tiene red de seguridad
  por timeout (1400 ms). Con `reduced()`/`frozen()` no se oculta nada.
- Para excluir una zona nueva: `data-noreveal` en su contenedor.

---

## Recursos visuales (migración F1 — en curso)

### Reglas vigentes desde F1.1
- `Icon` **nunca devuelve un hueco**: un `name` inexistente degrada a `grid` y se registra en `window.ICON_CATALOG.missing()`. Un `name` vacío/`null` sigue devolviendo `null` (no se pinta nada).
- `window.ICON_CATALOG` (congelado) es la superficie de solo lectura del set de iconos: `names`, `fallback`, `has()`, `missing()`.
- `window.ImageSlotAPI` (congelado) es la **única** API pública de `image-slot`: `get(id)`, `set(id, url)`, `subscribe(fn)`. Prohibido leer `_userUrl`, el objeto `slots` o cualquier interno del componente.
- `brand.jsx` no hace polling: reacciona por suscripción a `ImageSlotAPI`.

### Reglas vigentes desde F1.2
- **`window.finCatStore` es la autoridad de ejecución** de los productos de Mi Financiera.
- `DATA.finanzasGroups` y `DATA.recommended` están **congelados** y son **solo semilla / arranque controlado**. Prohibido leerlos fuera de `fincat-store.jsx` salvo como fallback `|| DATA.finanzasGroups` inmediato.
- Consumidores migrados: `screens-financiera.jsx`, `screens-marketplace.jsx` (`findItem`), `flow-store.jsx` (`servicesCatalog`), `screens-admin-finanzas.jsx`, `catalog-store.jsx`.

### Regla arquitectónica (ACTIVA desde F1.8)
> Ningún icono, imagen, GIF, SVG, logo o recurso visual administrable se agrega directamente a una pantalla. Se registra primero en `assets-registry.jsx` y se consume vía `<Res resKey>` o `IconTile resKey`. Excepciones válidas y documentadas: elementos decorativos no administrables (gradientes, patrones SVG del mapa de Terrenos, QR generado, firma dibujada a mano); se declaran en `assets-registry.EXEMPT` con su motivo.

### Reglas vigentes desde F1.3
- Existen `assets-registry.jsx` (catálogo + `EXEMPT` + `validate()`), `assets-store.jsx` (`window.assetsStore`: overrides en `localStorage` `suti.assets.v1`) y `assets-resolver.jsx` (`window.AssetsResolver.resolve`, componentes `<Res>` / `<ResTile>`, hook `useAsset`). **Cero consumidores todavía**; el registro arranca vacío.
- Los tres archivos van al **inicio** del bundle y no dependen de otros globals en tiempo de carga (la suscripción a `ImageSlotAPI` es perezosa).
- Precedencia de resolución: override del admin → `<image-slot>` → `src` del registro → icono del registro → fallback de `ICON_CATALOG`. `resolve('')` → `null`; resKey desconocido → icono fallback (nunca hueco).

### Reglas vigentes desde F1.4
- Primeros consumidores migrados: **nav inferior** (`app.jsx` → `<Res resKey="nav.<tabId>">`) e **Inicio** (`screens-home-r2.jsx`: accesos rápidos usan `res:` en vez de `icon:`, banner usa `home.banner.icon`).
- 11 resKeys registrados: `nav.*` (6), `home.qa.*` (4), `home.banner.icon`. `validate()` limpio.
- Un override (`assetsStore.set('nav.home',{icon:'flame'})`) cambia el icono sin alterar el conteo de nodos; `reset` restaura el registro. Probado end-to-end.
- No-regresión vs baseline: Inicio 41/9/0/30, Finanzas 64/2/6/35, Convenios 39/6/0/32 — idénticos.

### Reglas vigentes desde F1.5
- **Namespaces dinámicos**: `ASSETS_REGISTRY.provide(prefix, fn)` declara un proveedor que fabrica la entrada en tiempo de resolución (puede leer stores que aún no existen al cargar). Primer proveedor: `fin.item.<itemId>` → lee `finCatStore.findItem` (autoridad F1.2) y expone `slot: 'fin-item-<id>'` para imagen propia.
- Recursos fijos nuevos: `fin.summary.icon`, `fin.stat.ahorro`, `fin.stat.nomina` (14 resKeys en total).
- Consumidores migrados en `screens-financiera.jsx`: tarjeta de resumen, mini-stats, Recomendado y cada producto (`ResTile resKey="fin.item.<id>"`).
- **Medición**: el conteo canónico se toma con el pop-up administrable CERRADO — su contenido varía por sesión (3–7 botones), así que comparar con pop-up abierto produce falsos negativos. Finanzas con pop-up cerrado = **59/1/6/28** (equivale al baseline 64/2/6/35 menos el pop-up).
- **Ojo con `bundle.js`**: no splicear bloques buscando `\n/* ` — los comentarios internos de cada archivo rompen el corte. Los marcadores del bundle ahora son `/* @@file <archivo> */`.

### Reglas vigentes desde F1.6
- Nuevo primitivo **`<ResSlot resKey>`**: recursos de imagen que llena el USUARIO. Mientras no haya override del admin renderiza el `<image-slot>` real (misma UX de arrastre, mismo nodo); con override pinta un `<img>`. Es la forma correcta de administrar un slot sin quitarle el drop al usuario.
- Proveedores nuevos: `ad.<adId>` (anuncios patrocinados → `adminStore.getAnuncio`, slot del anuncio) y `hist.estado.<estado>` (iconos de `DATA.estadoMeta`). 3 resKeys fijos de Convenios (`convenios.card.fav`, `convenios.card.pin`, `convenios.detail.credencial`) → 17 en total.
- Consumidores migrados: `screens-convenios.jsx` (carrusel de anuncios, corazón de favorito ×2, pin ×2, credencial del detalle) y `screens-historial.jsx` (`StatusPill`).
- Pendiente consciente: el `IconTile` de las tarjetas de Historial sigue leyendo `s.icon` de la solicitud — el dato no trae `itemId`, así que colgarlo de `fin.item.*` requiere tocar `finance-store.asHistorial` (fase posterior).
- Conteos con pop-up cerrado: Inicio 41/9/0/30, Convenios **34/5/0/25**, Historial **28/1/0/11** (los 4 svg extra de Historial son las solicitudes de prueba creadas en F1.0, ya documentadas).

### Reglas vigentes desde F1.7
- Cuatro proveedores nuevos, todos de **imagen que llena el usuario** (`<ResSlot>`), con slot determinista salvo Noticias:
  `fin.hero.<itemId>` (slot `fin_hdr_<id>`), `sind.hero.<moduleId>` (slot `sind_hdr_<id>`), `sind.block.<slotId>` (indexado por slotId: los bloques viven en varios módulos y no hay índice global por id) y `news.<newsId>` (slot leído de `adminStore.getNews`).
- Consumidores migrados en `screens-marketplace.jsx`: portada del detalle de producto (`HeroShell`), encabezado de módulo del sindicato (`ModuloScreen`), bloque de imagen (`ModuloBlock`) y las dos instancias de la imagen de noticia en `ArticuloScreen` (portada con `data-shared-inner` + lightbox). Cero `<image-slot>` sueltos quedan en ese archivo.
- `ResSlot` devuelve `null` si el proveedor no fabrica entrada: por eso `news.` conserva el guard `n.slotId &&` en el consumidor.
- Pendiente para F1.8: `screens-catalogo.jsx` (imágenes de producto vienen como `imagenes[]` del catálogo, no de slots — requiere decidir si el array pasa por el registro), y la auditoría final que activa la regla arquitectónica.

### Reglas vigentes desde F1.8 (cierre de F1)
- Dos proveedores nuevos: `cat.item.<itemId>` (único caso cuya imagen **no** viene de un `<image-slot>` sino del array `imagenes[]` de `catalogStore`: se expone `imagenes[0]` como `src` y, sin imágenes, degrada a icono) y `screen.<slotId>` (portada de pantalla personalizada del pop-up).
- `CatalogGrid` se partió en `CatalogCard` para poder usar `useAsset` por tarjeta (un hook no puede vivir dentro de un `.map`). La galería multi-imagen del detalle sigue leyendo `imagenes[]`.
- Consumidores migrados: Inicio · tarjeta de noticia, `custom-screen.jsx`, `screens-catalogo.jsx` (portada).
- **Cuatro excepciones nuevas en `EXEMPT`**: `admin.editor-slots` (los `<image-slot>` de los paneles de admin SON el control de edición, administrarlos sería circular), `brand.app-icon` (los administra Branding vía `ImageSlotAPI`), `catalogo.galeria` (array del catálogo; el registro expone solo la portada) e `image-slot.empty-icon` (ya existía).
- Con esto la **regla arquitectónica queda activa**: fuera de `EXEMPT`, ninguna pantalla de usuario pinta un recurso visual administrable sin pasar por el registro.

### Baseline de no-regresión
**Conteo de Inicio, aclarado (QA M2):** Inicio sin pop-up = **36/8/0/23**; con pop-up = **41/9/0/30**. Las cifras «41/9/0/30 con pop-up cerrado» de F1.4-F1.6 se tomaron en realidad con el pop-up ABIERTO. Convenios 34/5/0/25 e Historial 28/1/0/11 sí son sin pop-up.
`docs/F1.0-baseline.json` — 18 pantallas con conteo de `<svg>` / `<image-slot>` / `<img>` / `<button>`, ruta de acceso y anomalías previas. Comparar contra él después de cada fase. **Al medir, cerrar antes el pop-up administrable** (suma ~5 svg, ~7 btn y 1 slot al conteo global).

## Edición de textos en vivo (Roles y permisos)

`app/copy-store.jsx` (`window.copyStore`, clave `suti.copy.v1`) es la autoridad de los
textos editados del frontend: overrides (`ámbito § texto original → texto nuevo`), lista de
personas autorizadas y el interruptor del modo edición. `app/live-text.jsx` es el **único**
motor: aplica los overrides sobre el DOM y, en modo edición, vuelve editable el nodo tocado.
Ambos van **antes de `app.jsx`** en el bundle (después de `fincat-store` no importa: no
dependen de otros globals al cargar).

- Permiso base: recurso **`textos`** en la matriz de roles (`can('editar','textos')`), con
  **fallback a `secciones`** para roles guardados antes de que existiera. Alternativa: la
  persona está en `copyStore.editors()` con `enabled`.
- Elegibilidad de un nodo: hijo único de texto, 1–400 caracteres, con al menos una letra,
  fuera de `[data-notext]` y `[data-lt-ui]`. Para excluir una zona: `data-notext`.
- Ámbito = pantalla actual; `app.jsx` lo publica con `LiveText.setScope(currentScreen)`.
  En `admin` el motor no aplica ni marca nada.
- **Regla dura**: `schedule()` nunca puede quedar latcheado. El rAF lleva red de seguridad
  por `setTimeout(120)` y `setScope` / la suscripción a `copyStore` aplican de inmediato —
  en documento oculto el rAF no dispara y los textos se quedarían sin aplicar.
- Un solo MutationObserver sobre `#root` y tres listeners delegados en captura
  (`pointerdown`/`mousedown`/`click`). En modo edición el clic sobre un texto elegible
  **no navega**: edita.
