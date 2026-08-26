# Motion System · Estado de validación M1 → M4

Documento de estado. Fuente única para saber qué está terminado, validado, pendiente,
provisional o bloqueado en el sistema de movimiento de SutiApp.

- Fecha: 10 ago 2026
- Archivos auditados: `app/motion.jsx`, `app/app.jsx`, y todas las rutas de `ROUTES`.
- Estado final: **READY FOR HUMAN VALIDATION — WITH KNOWN RISKS** (riesgos abiertos en E y H).

## Nota de trazabilidad (importante, no reescribir)

> **M3 y M4 fueron implementados ANTES de completar la validación humana y de
> performance exigidas por el gate M1/M2.** El gate pedía detener el avance hasta
> cerrar reduced-motion probado, FPS en entorno visible y la decisión 480/420.
> Eso no se cumplió en orden: M3 (shell) y M4.1/M4.2 (pantallas, carruseles, chips)
> se construyeron sobre infraestructura todavía pendiente de validación final.

Consecuencia real: el trabajo de M3/M4 **no queda invalidado**, pero **hereda** la
deuda de validación de M1/M2. Si la validación humana obliga a cambiar `dur.spatial`,
la política de reduced-motion o la capa de presencia, los consumidores de M3/M4
deben re-verificarse, no solo los tres prototipos originales.

---

## A · Motion System (piezas)

| Pieza | Implementado | Probado técnicamente | Notas |
|---|---|---|---|
| Tokens `dur` (90/140/220/320/480) | Sí | Sí | `spatial` = 480, sin fijar (ver D) |
| `ease` (standard/emphasized/enter/exit/spatial) | Sí | Sí | Consumidas solo desde `MOTION` |
| `spring` (gentle/snappy/firm) | Sí | Sí | Usadas en nav, toast, FavHeart |
| `dist` (8/14/24), `scale` | Sí | Sí | — |
| `stagger` (35 ms, tope 6) | Sí | Sí | Consumido por `useReveal` |
| `animate` (WAAPI + política reduced) | Sí | Sí | Registra en `live` para poder cancelar en QA |
| `springTo` (rAF) | Sí | Sí | Cleanup verificado (`cancelAnimationFrame`) |
| `onScroll` / `progress` | Sí | Sí | 1 listener pasivo por contenedor; publica `(scrollTop, scrollLeft)` |
| `flipCapture` | Sí | **No** | **Sin consumidores.** No se inventó uno (ver I·6) |
| `reveal` / `useReveal` | Sí | Sí | Red de seguridad por timeout: no puede dejar contenido invisible |
| `shared.captureFrom/claimIn/claimOut/pending/clear` | Sí | Parcial | Probado en noticia→artículo; sin segundo consumidor |
| `frozen()` | Sí | Sí | `document.hidden`; en oculto no se oculta nada para animar después |
| QA overrides (`MOTION.qa`) | Sí | Sí | `mode/setReduced/spatial/setSpatial/fps`; default `system` / 480 |

Reglas duras vigentes: solo `transform`/`opacity` (+`border-radius`); prohibido animar
`top/left/width/height`; ninguna pantalla define curvas o duraciones propias.

---

## B · Reduced Motion

**Cómo funciona.** `reducedFlag` refleja el sistema real (`prefers-reduced-motion`, con
listener de cambio). La resolución efectiva es `override de QA ?? preferencia del sistema`:
`reduced() = qa 'on' ? true : qa 'off' ? false : reducedFlag`. El override **no altera**
la detección real.

**Cómo se fuerza.** Panel de **Tweaks → «QA de movimiento (dev)» → Movimiento**
(`system` / `on` / `off`). El cambio de modo **cancela las animaciones vivas y limpia
capturas compartidas**, de modo que no puede quedar una transición a medias.

**Qué cubre la implementación.** `animate` (salta al estado final), `useReveal`/`reveal`
(pinta en estado final), nav inferior (indicador sin animar), toast (solo opacidad),
sheet (sin drag animado), carruseles de Inicio y Convenios (no se registra driver, sin
autoplay), progreso de Historial (valor final), `FavHeart` (sin spring), capa de presencia
(**no retiene**: la ruta saliente se desmonta en el mismo commit).

**Qué está empíricamente probado.** El recorrido con `reduced = on` se ejecutó sobre los
tres prototipos M1/M2 en preview; no quedaron clones, capturas, transforms residuales ni
contenido invisible, y push/back siguieron funcionando.

**Qué sigue pendiente.** La validación **humana** en dispositivo real, incluidas las
pantallas de M3/M4 que se construyeron después del gate (nav, sheets, toggles, carruseles
de Convenios, chips, Historial). Ninguna de esas se marca como "validada".

---

## C · Performance (harness)

`MOTION.qa.fps(windowMs)` mide una ventana controlada (500–20 000 ms, por defecto 5 s) y
devuelve estadística, no un número suelto:

- `framesEsperados` (ventana / 16.7)
- `framesObservados`
- `fpsMedio`
- `frameMedioMs`
- `peorFrameMs`
- `p95Ms`
- `sobre16_7` (frames > 16.7 ms)
- `sobre33_3` (frames > 33.3 ms)

**Cómo probarlo en tu dispositivo:** abrir SutiApp con la ventana visible y al frente →
Tweaks → «QA de movimiento (dev)» → **Medir frames (5 s)** → ejecutar el escenario durante
la ventana. Escenarios pedidos: A scroll lento con TopBar · B scroll rápido repetido ·
C noticia→artículo · D artículo→back · E back durante la transición · F entrar/salir
repetido · G cambio rápido de tabs · H stagger inicial de Inicio · I interacción mientras
otra animación termina.

**Estado actual: PENDIENTE DE PRUEBA CON DOCUMENTO VISIBLE.** No se declara 60 FPS. En un
preview oculto rAF/WAAPI/timers se estrangulan (timers ~1 s, `currentTime` 0), así que
cualquier medición mía sería inválida — no se inventan métricas.

---

## D · `dur.spatial` 480 vs 420

- **Token actual:** `dur.spatial = 480`. **No modificado.**
- **Override QA:** `qaState.spatial = null` por defecto; Tweaks → «Transición espacial»
  permite 480/420 sin tocar el token. `spatialMs() = qaState.spatial || dur.spatial`.
- **Consumidores reales de `dur.spatial`:** exactamente dos, ambos dentro de
  `motion.jsx` → `shared.claimIn` (entrada, `D = spatialMs()`) y `shared.claimOut`
  (salida, `D = spatialMs() * 0.78`). Ninguna pantalla lo consume directamente.
  El único consumidor de producto es **noticia → artículo**.
- **Qué cambiaría si fijamos 420:** entrada 480→420 ms, salida 374→328 ms, y la ventana
  de retención de la ruta saliente (sección E) baja de ~540 ms a ~388 ms — lo que
  *reduce* todos los riesgos de E.
- **Decisión: PENDIENTE de tu prueba.** No se fija 420.

---

## E · Route Retention Audit

### Mecánica auditada

`popOne()` es el único camino de salida: guarda `{name, params, depth, id}` en `outgoing`
y hace pop del stack. La capa saliente conserva su `key` por profundidad → **no se
re-monta**: mismo DOM, mismo scroll, mismo estado. Un `useLayoutEffect` la anima y programa
`setTimeout(… , ms + 60)` para desmontarla. Ventana real de retención:

- con shared element: `spatialMs()*0.78 + 60` ≈ **434 ms** (480) / **388 ms** (420)
- sin shared: `dur.normal + 60` = **280 ms**
- con `frozen()` o `reduced()`: **0 ms** (desmontaje en el mismo commit)

Cobertura: todas las rutas apiladas — `loan, product, modulo, articulo, convenio,
tracking, catitem, documentos, notifs, perfil, terreno`. **Los tabs no se retienen**
(`setTab` limpia `outgoing`, el stack y las capturas compartidas).

### Hallazgo transversal previo

**No existe Supabase realtime, ni `fetch`, ni promesas de red en el código de pantallas.**
Toda la persistencia es síncrona sobre `localStorage` a través de stores con pub/sub.
El único `fetch` del proyecto es el del sidecar de `<image-slot>`, una sola vez al cargar.
Esto reduce drásticamente la superficie de riesgo de la retención.

### Tabla de auditoría

| # | Ruta / componente | Efecto que permanece activo | Qué ocurre durante la retención | Cleanup correcto | ¿Efecto funcional tras salir? | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|
| 1 | **Shell** · contenedor de capas (`app.jsx`) | El contenedor de rutas mantenía `pointerEvents:'auto'` mientras `layers.length > 0`, aunque la única capa sea la saliente (que sí es `none`) | Al volver de la última ruta a un tab, el tab de fondo queda **no clicable** ~280–434 ms | Sí (se desmonta con la capa) | **Sí** — bloquea input real | ~~Medio~~ **CORREGIDO** | Aplicado: `pointerEvents: layers.some((l) => !l.out) ? 'auto' : 'none'` — el contenedor captura eventos solo si existe una capa entrante viva |
| 2 | **Shell** · pop-up administrable | `setTimeout(setPopupItems, 480)` keyed a `currentScreen`, que cambia al hacer pop (no al terminar la salida) | El pop-up de la pantalla ENTRANTE puede aparecer a 480 ms mientras la saliente aún se desvanece (hasta 434 ms) | Sí | No (cosmético) | **Bajo-Medio · ABIERTO** | **Decisión: no modificar todavía.** Se observa en la validación humana; si se percibe incorrecto se encadenará al fin de `outgoing`. No optimizar anticipadamente |
| 3 | **Shell** · toast (`showToast`) | `setTimeout(…, 2600)` de nivel shell | Un toast disparado justo antes de salir sobrevive a la ruta | Sí (vive en el shell) | No | Bajo | Es el diseño: el toast pertenece al shell, no a la ruta |
| 4 | **Shell** · botón atrás / `popstate` | Listener global con `navRef` | Doble-back durante la retención: `popOne` lee el stack ya actualizado, `setOutgoing` reemplaza el `outgoing` anterior → la capa vieja se desmonta en ese commit y su cleanup corre | Sí | No | Bajo | Sin acción |
| 5 | `product` / `catitem` | `useEffect(() => { if (quoteReady && !quote.visto) qs.markVisto(quote.id) })` — **escribe en `localStorage`** | Las deps no cambian por salir, así que no re-dispara. **Pero** si el store emite durante la ventana (cotización que cambia, evento `storage` de otra pestaña), la pantalla retenida re-renderiza y **puede marcar "visto" después de que el usuario ya salió** | Sí (unsub al desmontar) | **Condicional** | **Medio · OPEN — BUSINESS SEMANTICS REQUIRED** | **Decisión: no modificar.** Sin guards por presencia, `outgoing`, visibilidad ni estado de ruta. Pregunta a resolver antes de tocar: ¿una cotización se considera vista desde que se abrió su detalle, o solo mientras ese detalle sigue siendo la pantalla activa cuando ocurre la actualización? |
| 6 | `product`, `catitem`, `modulo`, `convenio`, `historial` | Suscripciones de store (`useQuoteStore`, `useCatalogStore`, `useSindicatoStore`, `financeStore`) | Siguen suscritas ≤434 ms; una emisión provoca render de una pantalla ya salida (invisible, `pointer-events:none`) | Sí | No (solo render) | Bajo | Sin acción |
| 7 | `loan` · `Submitting` | `setTimeout(done, 2100)` | El envío (`financeStore.submit`) ya ocurrió **síncronamente** al pulsar; el timer solo mueve la UI. La retención (≤434 ms) termina antes y el cleanup lo cancela | Sí | No | Bajo | Sin acción. Nota: salir durante "Submitting" **no** pierde la solicitud (ya persistida) |
| 8 | `loan` · `CountUp` | `requestAnimationFrame` de conteo | Sigue animando durante la ventana (coste de CPU marginal, invisible) | Sí | No | Bajo | Sin acción |
| 9 | `loan` | `useEffect` de clamp de monto y reset de scroll por `step` | Deps no cambian al salir | Sí | No | Bajo | Sin acción |
| 10 | `terreno` | `useEffect` de recentrado (mount y `sel`) | No se re-dispara al salir | Sí | No | Bajo | Sin acción |
| 11 | `convenio` (detalle) / Convenios (tab) | Autoplay del carrusel `setTimeout(4600)` + centrado de chips | Si el timer cae dentro de la ventana, hace `setIdx` sobre una pantalla ya salida: render invisible | Sí | No | Bajo | Sin acción. En el tab no aplica (los tabs no se retienen) |
| 12 | `articulo`, `documentos`, `tracking`, `notifs`, `perfil` | Solo estado local y escrituras en click | Nada pendiente al salir | Sí | No | Bajo | Sin acción |
| 13 | `credencial` | `setInterval(1000)` que rota el token QR | **No aplica**: es un tab, nunca se retiene; al cambiar de tab se desmonta y limpia | Sí | No | Bajo | Sin acción |
| 14 | Cualquier ruta con `<image-slot>` / `<ResSlot>` | El custom element retenido sigue conectado y suscrito a `ImageSlotAPI` | Sigue vivo ≤434 ms; sus listeners de drop son inalcanzables (`pointer-events:none`) | Sí (`disconnectedCallback`) | No | Bajo | Sin acción |
| 15 | `motion.jsx` · animaciones WAAPI | `live` (Set) con drop en `finish`/`cancel` | Si la capa se desmonta a mitad, la animación termina igual y se retira del Set | Sí | No | Bajo | Sin acción |

### Efectos M3/M4 sobre infraestructura de retención

- **M3 · nav inferior**: el indicador se mide en `useLayoutEffect` tras el commit. `setTab`
  limpia `outgoing` y capturas → nunca coexiste con una retención. Sin riesgo.
- **M3 · sheets**: viven dentro de la ruta. Un sheet abierto en la ruta saliente se
  desvanece con ella; su drag usa listeners con cleanup en `pointerup`. Sin riesgo.
- **M3 · toast**: presencia propia en el shell (ver #3).
- **M4.1 · Historial**: la animación de progreso se marca con `data-m-filled` y no se
  repite; no hay timers pendientes.
- **M4.2 · carruseles/chips**: drivers de scroll con un listener pasivo por contenedor,
  desmontados con la pantalla. Sin retención propia.
- **Shared elements adicionales**: **ninguno**. El único par sigue siendo noticia→artículo.

### Conclusión global

> ¿La arquitectura actual puede retener cualquier pantalla durante una transición sin
> riesgo funcional?

# B — Sí, pero con excepciones identificadas.

Las excepciones son exactamente tres, ninguna de datos perdidos. Estado tras las
decisiones del 10 ago 2026:

1. **#1 Bloqueo de input del tab de fondo** — **CORREGIDO** (autorizado): el contenedor
   de capas solo captura eventos cuando existe una capa entrante viva.
2. **#5 `markVisto` de cotizaciones** — **OPEN — BUSINESS SEMANTICS REQUIRED**: se
   conserva el comportamiento actual hasta definir la semántica de negocio de `visto`.
3. **#2 Pop-up administrable** sobre una ruta en salida — **ABIERTO**, cosmético: se
   observa durante la validación humana antes de decidir.

No se encontró ningún caso de red, realtime, promesa pendiente ni escritura de datos
irreversible ligada a la retención.

---

## F · M1 / M2

| Prototipo | GO técnico | Validación visual humana |
|---|---|---|
| Stagger de Inicio (`useReveal`) | **Sí** — entra escalonado, nunca invisible (red de seguridad por timeout, cubre IO que no dispara, reduced y frozen) | **Pendiente** |
| Collapsing TopBar (`useScrollDriver`) | **Sí** — sticky con un solo listener pasivo, legible en reduced-motion sin depender de desplazamientos grandes | **Pendiente** |
| Shared noticia → artículo | **Sí** — `data-shared-key/-inner/-title/-follow`; degrada a fade en reduced; sin clones ni transforms residuales | **Pendiente** (incluye 480 vs 420) |

---

## G · M3 · Shell

**Implementado realmente:**

- **Nav inferior**: un único indicador absoluto en `BottomNav`, medido en `useLayoutEffect`
  y movido con `transform`; icono entrante con pop 1→1.12→1; botones solo interpolan color
  y caja. Primitivas: `animate`, `spring`, medición post-commit.
- **Toast**: presencia real (retiene el mensaje mientras sale), entrada spring, salida
  200 ms, barra de vida del auto-dismiss (2600 ms, `scaleX`).
- **Sheet** (`ui.jsx`): curva unificada `cubic-bezier(.32,.72,0,1)` sin overshoot +
  drag-to-dismiss 1:1, arranque solo con `scrollTop === 0`, decisión por distancia (28 %)
  o velocidad (>0.55 px/ms).
- **Pop-up administrable**: blur del backdrop interpolado en ambas direcciones.
- **Toggles**: 22 implementaciones sueltas unificadas en `window.Toggle` (4 tallas, `glow`,
  press que comprime el thumb, curva y duración únicas); pasaron de animar `left` a
  `transform`.

**Riesgos:** el pop-up puede solaparse con una salida en curso (E·#2). El nav mide
geometría tras el commit: un cambio de tipografía o de tamaño de caja exige re-medir.

**Pruebas realizadas:** recorrido funcional + reduced-motion en preview; no-regresión de
conteos.
**Pruebas pendientes:** FPS en escenario G (cambio rápido de tabs) y validación humana.

---

## H · M4

**M4.1 · Primeras pantallas de usuario**
- `window.FavHeart` (spring 1→1.3→.94→1 + destello que se disipa) en las dos instancias
  de Convenios; apagar no anima.
- Inicio · Ecosistema: retícula 3×N escalonada con `useReveal` (paso 25 ms, 10 px).
- Historial · progreso de la solicitud en curso: segmentos que se llenan en secuencia
  (`scaleX`, 400 ms, 70 ms entre segmentos), una sola vez por solicitud.

**M4.2 · Carruseles y chips**
- `MOTION.onScroll` publica ahora `(scrollTop, scrollLeft)` — única vía permitida para
  movimiento ligado a scroll horizontal.
- Inicio · Noticias: `scroll-snap` x-mandatory, escala .94→1 y opacidad .74→1 por distancia
  al centro; una pasada de lectura y otra de escritura por frame.
- Convenios · carrusel de anuncios: swipe 1:1, decisión por distancia (22 %) o velocidad
  (>0.5 px/ms), `touch-action: pan-y`; autoplay se pausa al tocar y no arranca en reduced.
- Convenios · chips: el activo se centra con `scrollTo({behavior:'smooth'})` — nunca
  `scrollIntoView`.

**Pantallas que ya consumen el sistema:** Inicio, Convenios (lista y detalle), Historial,
Mi Financiera (vía nav/TopBar), artículo, además de todo el shell.

**Shared elements adicionales:** ninguno. **FLIP (`flipCapture`): no se utilizó.**

**Diferencias respecto al plan original:** M4.2 dejó pendiente el **indicador deslizante
compartido entre chips de Convenios** (requiere sustituir `Pill` por un chip local). Y,
sobre todo, M3/M4 se ejecutaron antes de cerrar el gate (ver nota de trazabilidad).

**Pruebas pendientes:** FPS en escenarios A, B, F, H, I; validación humana de la sensación
de los carruseles.

---

## I · Deuda pendiente

1. **Validación visual humana** de M1–M4 (bloqueante del gate).
2. **Decisión 480 vs 420** para `dur.spatial` (token intacto en 480).
3. **FPS en entorno visible**, escenarios A–I, con el harness de la sección C.
4. **Auditoría de ruta saliente**: hecha (sección E). E·#1 **corregido**; E·#5 queda
   **OPEN — BUSINESS SEMANTICS REQUIRED**; E·#2 **abierto**, a observar en la validación.
5. **Retirada futura del QA** (panel de Tweaks + `MOTION.qa` + claves `qaMotion`/`qaSpatial`).
   **NO retirar todavía** — instrucciones de retiro en `CLAUDE.md`.
6. **`flipCapture` sin consumidor**: se mantiene disponible, sin abstracción adicional y
   sin consumidor inventado. Se evalúa en filtros/listas/reordenamiento cuando toque.
7. **Deuda nueva encontrada en esta auditoría**:
   - E·#1 bloqueo de input del tab durante la retención — **corregido**.
   - E·#5 escritura de persistencia condicional en pantalla retenida — **abierto**,
     requiere semántica de negocio.
   - E·#2 pop-up sobre ruta en salida — **abierto**, cosmético.
   - Indicador deslizante de chips de Convenios (pendiente de M4.2).
   - `shared.*` tiene un solo par de consumidores: su API no está probada en un segundo caso.

---

## Matriz final de estado

| Elemento | Implementado | Probado técnicamente | Validado humanamente | Pendiente |
|---|:--:|:--:|:--:|---|
| Tokens y curvas | Sí | Sí | No | Decisión 480/420 |
| `animate` / `springTo` | Sí | Sí | No | FPS visible |
| `onScroll` / `progress` | Sí | Sí | No | FPS escenarios A, B |
| `reveal` / `useReveal` | Sí | Sí | No | Validación humana |
| `shared.*` | Sí | Parcial | No | 2.º consumidor; 480/420 |
| `flipCapture` | Sí | No | No | Sin consumidor (a propósito) |
| `frozen()` safety | Sí | Sí | n/a | — |
| Reduced motion | Sí | Sí (preview) | No | Recorrido humano M3/M4 |
| QA overrides + harness FPS | Sí | Sí | n/a | Retirar tras el cierre |
| Capa de presencia / retención | Sí | Sí (auditada) | No | E·#1 corregido; E·#5 y E·#2 abiertos |
| M1 stagger Inicio | Sí | Sí | No | — |
| M2 collapsing TopBar | Sí | Sí | No | FPS escenario A |
| M2 shared noticia→artículo | Sí | Sí | No | 480 vs 420 |
| M3 nav inferior | Sí | Sí | No | FPS escenario G |
| M3 toast / sheet / toggles | Sí | Sí | No | Validación humana |
| M4.1 FavHeart / Ecosistema / Historial | Sí | Sí | No | FPS escenario H |
| M4.2 carruseles / chips | Sí | Sí | No | Indicador de chips; FPS B, F, I |
| Baseline de no-regresión | Sí | Sí | n/a | Re-medir tras cada fase |

---

## Baseline de no-regresión (confirmación)

Referencia: `docs/F1.0-baseline.json` (18 pantallas, conteo `<svg>` / `<image-slot>` /
`<img>` / `<button>`). Medir **con el pop-up administrable cerrado**.

- Inicio sin pop-up: **36/8/0/23** · con pop-up: 41/9/0/30
- Convenios: **34/5/0/25**
- Historial: **28/1/0/11** (los 4 `svg` extra son las solicitudes de prueba de F1.0)
- Mi Financiera con pop-up cerrado: **59/1/6/28**

Sin regresión atribuible al sistema de movimiento: la capa de presencia no añade nodos
permanentes (la capa saliente existe como máximo 434 ms) y las migraciones F1.7/F1.8
sustituyeron `<image-slot>` por `<ResSlot>`, que renderiza **el mismo nodo** mientras no
haya override de admin.
