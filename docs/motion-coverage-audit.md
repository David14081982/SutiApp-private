# Motion Coverage Audit · SutiApp

Diagnóstico previo a la implementación. **No se modificó código.** Complementa
`docs/motion-m1-m4-validation-status.md` (arquitectura); este documento trata de
**cobertura**: cuánta superficie interactiva responde de verdad.

## Método (reproducible, no estimado a ojo)

Conteo sobre los 51 archivos de `app/*.jsx`:

- **Elemento interactivo** = una ocurrencia de `onClick` + cada `input` / `textarea` /
  `select` creado (los controles de formulario responden a `onChange`, no a `onClick`).
- **Con motion real** = el elemento usa `window.Btn` (clase `su-btn` → `:active
  scale(.97)`), `su-press` (`:active scale(.975)`), `window.Toggle` (thumb con spring) o
  `FavHeart`. Cuando un archivo declara más marcadores que elementos, se topa al número
  de elementos (no se infla).
- **Solo estilo** = el elemento cambia color/fondo/sombra sin transform ni transición
  temporal perceptible.
- **Seco** = sin ninguna respuesta visual propia al tap.

El conteo es de ocurrencias en código, no de nodos en pantalla: un `.map()` que pinta
12 filas cuenta 1. **La cobertura real percibida es por tanto PEOR que la que reporta
esta tabla**, porque los elementos secos suelen estar dentro de listas.

---

## 1–5 · Cifras globales

| Métrica | Valor |
|---|---|
| 1 · Elementos interactivos auditados | **582** (477 `onClick` + 105 controles de formulario) |
| 2 · Con motion real hoy | **149** |
| 3 · Solo cambian estilo | ~**60** (chips/segmentados/filas seleccionadas; en toda la app hay solo **43 declaraciones `transition:`**, 4 de ellas el prohibido `transition: all`) |
| 4 · Completamente secos | ~**373** |
| 5 · **Cobertura global** | **26 %** |

Datos de apoyo que explican la sensación de "app seca":

- **105 controles de formulario** y **1 sola** aparición de `onFocus`/`:focus` en todo el
  proyecto → los formularios no responden al foco, ni a error, ni a éxito.
- **158 `<button onClick>` crudos** (filas, celdas, acciones de admin) sin clase de press.
- **~120 icon-buttons** de 32–44 px (atrás, cerrar, editar, borrar, chevrons): ninguno
  tiene respuesta propia.
- **70 acciones destructivas** (eliminar/borrar) sin tensión visual ni confirmación animada.
- **7 estados de carga** en toda la app, ninguno integrado al botón que los dispara.

**Conclusión del diagnóstico: tu percepción es correcta.** Tres de cada cuatro
interacciones no producen ninguna respuesta visual. El motion existente está concentrado
en 6 momentos (nav, TopBar, shared, carruseles, favorito, progreso de Historial), que son
exactamente los que se notan — y por contraste dejan al resto en evidencia.

---

## 6 · Cobertura por pantalla / archivo

Ordenado de peor a mejor. `Int.` = elementos interactivos, `Mot.` = con motion real.

| Archivo / pantalla | Int. | Mot. | Cobertura |
|---|--:|--:|--:|
| `screens-terreno.jsx` · Suti Terrenos | 7 | 0 | **0 %** |
| `tweaks-panel.jsx` | 6 | 0 | 0 % |
| `screens-admin-sindicato.jsx` | 30 | 3 | 10 % |
| `screens-admin-roles.jsx` | 19 | 2 | 11 % |
| `screens-admin-fondos.jsx` | 17 | 2 | 12 % |
| `app.jsx` · shell (notifs, perfil) | 15 | 2 | 13 % |
| `admin-popup-editor.jsx` | 22 | 3 | 14 % |
| `ui.jsx` · biblioteca | 22 | 3 | 14 % |
| `screens-admin-finanzas.jsx` | 13 | 2 | 15 % |
| `screens-admin-convenios.jsx` | 51 | 8 | **16 %** (el archivo más interactivo de la app) |
| `screens-admin-news.jsx` | 22 | 4 | 18 % |
| `screens-company-modules.jsx` | 38 | 7 | 18 % |
| `screens-credencial.jsx` | 10 | 2 | 20 % |
| `signature.jsx` | 5 | 1 | 20 % |
| `screens-admin-fincat.jsx` | 31 | 7 | 23 % |
| `screens-admin-branding.jsx` | 4 | 1 | 25 % |
| `screens-admin-content.jsx` | 20 | 5 | 25 % |
| `screens-admin-planes.jsx` | 27 | 7 | 26 % |
| `screens-admin-catalogo.jsx` | 25 | 7 | 28 % |
| `screens-admin-pantallas.jsx` | 14 | 4 | 29 % |
| `screens-company.jsx` | 10 | 3 | 30 % |
| `screens-admin-flujos.jsx` | 39 | 13 | 33 % |
| `screens-admin-membresias.jsx` | 15 | 5 | 33 % |
| `screens-admin.jsx` | 22 | 8 | 36 % |
| `screens-catalogo.jsx` | 10 | 4 | 40 % |
| `screens-marketplace.jsx` | 27 | 13 | 48 % |
| `custom-screen.jsx` | 2 | 1 | 50 % |
| `screens-financiera.jsx` · Mi Financiera | 10 | 5 | 50 % |
| `screens-convenios.jsx` | 15 | 8 | 53 % |
| `screens-loan.jsx` · Suti Préstamo | 7 | 4 | 57 % |
| `screens-documentos.jsx` | 5 | 3 | 60 % |
| `screens-historial.jsx` | 6 | 4 | 67 % |
| `screens-home-r2.jsx` · Inicio | 8 | 7 | **88 %** |

**Lectura:** Inicio es la única pantalla terminada. El **admin completo vive entre 10 % y
36 %** — es literalmente otra aplicación en términos de feedback. Terrenos está en 0 %.

---

## 7 · Inventario por componente

| Componente | Instancias aprox. | Motion hoy | Clase objetivo | Acción |
|---|--:|---|---|---|
| `Btn` (primary/secondary/outline/ghost/gold/dark) | 90 | `:active scale(.97)` CSS, sin peso ni sombra | **M1 + M2** | Press con compresión y sombra; estados `loading`/`success`/`disabled` reales |
| Icon button (atrás, cerrar, editar, borrar, chevron) | ~120 | **Ninguno** | **M1** | Pressable + shift/rotación del glifo según semántica |
| `<button>` crudo de fila / celda | 158 | **Ninguno** | **M1** | Adoptar `Pressable` (o `su-press`) |
| `Card` (`su-card`) | ~40 | `transition` declarada, sin disparador táctil | **M1 (+M3 si abre detalle)** | Distinguir card clicable de informativa: depth + sombra; shared si navega |
| `IconTile` / `ResTile` | ~35 | Ninguno | **M1** | Pop del icono al presionar la fila contenedora |
| `Pill` / chip | 4 usos del componente + chips locales | `transition: all .2s` (**prohibido**) | **M1 + M2** | Chip único con indicador deslizante; nunca `all` |
| `Toggle` | 31 | Spring + press (correcto) | **M2** ✔ | Sin cambios; es el patrón a imitar |
| `input` / `textarea` / `select` | 105 | **Ninguno** (1 sola referencia a foco en toda la app) | **M1 + M2** | Foco (borde/sombra), error que entra desde su origen, éxito que confirma |
| Radio / checkbox / segmentado | ~25 (dibujados a mano por panel) | Cambio de fondo instantáneo | **M2** | Indicador deslizante compartido, no repintado |
| `Tab` (nav inferior) | 6 | Indicador único + pop (correcto) | **M2/M3** ✔ | Sin cambios |
| `ListItem` / row de admin | ~90 | Ninguno | **M1 + M2** | Press, y M3 en add/remove/reorder |
| `Sheet` | 7 | Curva unificada + drag (correcto) | **M3** ✔ | Falta motion del **contenido** al abrir |
| Modal / lightbox / pop-up | 5 | `su-fadein` | **M2** | Escala de entrada + blur ya resuelto en el pop-up |
| CTA fija inferior | ~6 | Ninguno | **M2/M3** | Debe transformarse entre estados (cotizar → simular), no desaparecer |
| Carousel item | 2 sistemas | Escala/opacidad por scroll (correcto) | **M3** ✔ | Sin cambios |
| FAB | 0 | — | — | No existe |
| Acción destructiva | ~70 | Ninguna | **M2** | Tensión previa: el control se arma antes de confirmar |
| Estado vacío (`EmptyState`) | ~10 | Ninguno | **M1** | Entrada suave del icono, una sola vez |
| Loading | 7 (`su-spin`) | Spinner suelto | **M2** | Integrar al botón que lo dispara |
| Success | 3 (confetti en préstamo) | **M4** ✔ | M4 | Extender el patrón loading → check → resultado |
| Error / validación | 0 | **No existe** | **M2** | Es el hueco más grande de formularios |
| Skeleton | 1 definición, casi sin uso | `su-shimmer` | **M2** | Usar en listas que cargan de store |

**Duplicación detectada (estandarizar):** filas de admin reimplementadas en 12 paneles con
la misma estructura; chips de filtro reimplementados al menos 5 veces (Convenios,
Historial, admin catálogo, planes, flujos); drag-to-reorder copiado en 5 archivos
(`screens-admin`, `-content`, `-convenios`, `-news`, `-sindicato`) con los mismos
listeners y sin ninguna respuesta de movimiento.

---

## 8 · Top 30 oportunidades por impacto

Ordenadas por (elementos afectados × frecuencia de uso).

| # | Oportunidad | Clase | Alcance |
|--:|---|---|--:|
| 1 | `Pressable` global adoptado por todo `<button>` crudo | M1 | ~158 |
| 2 | Icon buttons: press + shift del glifo | M1 | ~120 |
| 3 | Foco de campos de formulario | M1 | 105 |
| 4 | `Btn`: press con peso real (compresión + sombra) | M1 | 90 |
| 5 | Filas de admin: press y estado seleccionado | M1/M2 | ~90 |
| 6 | Error de validación que entra desde su campo | M2 | 105 |
| 7 | Cards clicables ≠ informativas (depth + sombra) | M1 | ~40 |
| 8 | Chips/filtros con indicador deslizante compartido | M2 | ~35 |
| 9 | `IconTile`/`ResTile` con pop al presionar | M1 | ~35 |
| 10 | Botón que se transforma a loading y a check | M2 | 90 |
| 11 | Acciones destructivas con tensión previa | M2 | ~70 |
| 12 | Listas de admin: alta/baja con continuidad (FLIP) | M3 | ~90 filas |
| 13 | Reordenar por arrastre con desplazamiento real de vecinos | M3 | 5 paneles |
| 14 | Chevrons que avanzan 2–3 px al presionar | M1 | ~60 |
| 15 | Contenido del `Sheet` que entra escalonado | M2 | 7 |
| 16 | CTA contextual que se transforma en vez de desaparecer | M2 | ~6 |
| 17 | Terrenos: 0 % → selección de lote, zoom, tarjeta de detalle | M1/M3 | 7 + mapa |
| 18 | Radio/checkbox/segmentado con indicador deslizante | M2 | ~25 |
| 19 | Estados vacíos con entrada única | M1 | ~10 |
| 20 | Skeletons en listas que leen de store | M2 | ~12 |
| 21 | Credencial: QR que se renueva (hoy salta cada 30 s) | M2 | 1 (muy visible) |
| 22 | Documentos: subida → check de confirmación | M2/M4 | 5 |
| 23 | Toast: acción deshacer con barra ya existente | M2 | shell |
| 24 | Notificaciones: entrada escalonada + salida al leer | M1/M3 | 1 pantalla |
| 25 | Perfil: filas y avatar con press | M1 | 10 |
| 26 | Firma (`signature.jsx`): trazo y confirmación | M1/M4 | 5 |
| 27 | Secciones que entran al hacer scroll fuera de Inicio | M1 | 6 pantallas |
| 28 | Badges de estado que cambian de valor con transición | M2 | ~20 |
| 29 | `ProgressBar` / `Stepper` con avance interpolado | M2 | ~8 |
| 30 | Segundo shared element: producto → detalle de catálogo | M3 | 2 rutas |

---

## 9 · Patrones reutilizables propuestos (sin implementar)

Todos consumen tokens existentes de `MOTION`. Cero números nuevos por pantalla.

**P1 · `Pressable`** — primitiva única de presión, en `ui.jsx`.
Soporta `pointerdown` / `pointerup` / `pointercancel` / `lostpointercapture`, activación por
teclado (`Enter`/`Space`), touch y `reduced()`. Respuesta: `scale` según densidad
(`0.985` superficies grandes, `0.97` controles pequeños) + interpolación de sombra.
Sustituye a `su-press`, `su-btn` y los 158 `<button>` crudos. **Reemplaza, no suma.**

**P2 · Button motion system** — variantes sobre P1:
`primary` press con peso (scale + sombra que baja) · `secondary` solo scale ·
`ghost` tint sin escala · `icon` scale + shift/rotación del glifo · `destructive`
arma-antes-de-confirmar · `loading` el botón colapsa a su altura y aparece el spinner
*dentro* · `success` spinner → check dibujado → estado final · `disabled` sin respuesta,
explícitamente inerte.

**P3 · Card motion system** — `Card` gana `interactive`:
press depth + sombra interpolada + chevron que avanza; si abre detalle, expone
`data-shared-key` para reutilizar `shared.*`. Una card informativa **no** recibe nada.

**P4 · Icon motion** — tabla semántica pequeña y cerrada:
chevron +2 px · plus rota 90° al abrir · cerrar rota −90° · check se dibuja
(`stroke-dashoffset`) · corazón spring (ya existe) · filtro comprime · búsqueda expande ·
warning un solo pulse. Nada más.

**P5 · Field motion** — foco (borde/sombra interpolados), label que migra, error que entra
desde el borde del campo con desplazamiento corto, éxito que confirma con check, contador
y helper que aparecen sin empujar el layout (reserva de espacio, no animación de altura).

**P6 · List motion** — entrada escalonada al montar (`useReveal`), y **aquí sí evaluar
`flipCapture`** para alta/baja/filtro/reorden en las listas de admin: es el primer caso
donde FLIP mejora comprensión real (una fila que desaparece debe empujar a las demás, no
teletransportarlas). Si al prototiparlo no aporta claridad, se descarta sin forzarlo.

**P7 · Admin motion** — misma primitiva P1 con amplitud reducida (scale 0.99, sin glow):
sobrio, no seco. Guardar → check. Eliminar → tensión + colapso de la fila.

**P8 · Scroll contextual** — un solo driver por contenedor (`MOTION.onScroll`): secciones
que entran, sticky secundarios, CTA que se compacta. Nada de paralaje decorativo.

---

## 10 · Qué NO animaría (M0 justificados)

- **Texto de contenido, precios y cifras**: leerlos es la tarea; moverlos la entorpece
  (excepción ya aprobada: el contador de Suti Préstamo, donde el número *es* el control).
- **Mapa de Terrenos (paneo/zoom del SVG)**: el arrastre ya es movimiento 1:1; añadir
  curvas lo haría sentir con lag. Sí animar la *selección* del lote y su tarjeta.
- **QR de la credencial (dibujo)**: es un código de lectura, no un gráfico. Sí animar su
  *renovación*.
- **Filas de tablas de datos del admin en scroll**: entrada escalonada al montar sí; nada
  ligado a scroll — se lee, no se contempla.
- **Badges de estado que no cambian** (pintados una vez): sin interacción, sin motion.
- **Iconos decorativos de fondo** (sellos, marcas de agua): son textura.
- **Hover como único feedback**: prohibido — la app es primero móvil. Todo hover debe
  tener equivalente en press.
- **Skeletons en listas locales**: los stores son síncronos sobre `localStorage`; simular
  carga sería mentir. Solo donde haya espera real.

---

## 11 · Tablas por pantalla (clase M0–M4 por elemento)

Columnas: **Interactivo** = nº de elementos de ese tipo en la pantalla.
**Motion actual** = lo que ocurre hoy al tocarlo.

### Inicio (`screens-home-r2.jsx`) — 8 int. · **88 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Accesos rápidos (4 tiles) | 4 | `su-press` + reveal de entrada | M1 ✔ | Añadir pop del icono al presionar |
| Banner de convenio | 1 | `su-press` | M1 ✔ | — |
| Tarjeta de noticia | 1 | `su-press` + escala por scroll + shared | M3 ✔ | — |
| Retícula Ecosistema | 1 | Reveal escalonado | M1 ✔ | Press por celda (hoy lo recibe el contenedor) |
| Fila de marca / instalar | 1 | Ninguno | **M1** | Pressable |
| Sello y textos de pie | — | — | **M0** | Decorativo, no interactivo |

### Mi Financiera (`screens-financiera.jsx`) — 10 int. · **50 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Tarjeta de crédito disponible | 1 | `su-press` | M1 ✔ | Cifra interpolada al cambiar |
| Mini-stats (ahorro, nómina) | 2 | Ninguno | **M1** | Pressable + pop del `ResTile` |
| Recomendado | 1 | `Btn` | M1 | Peso real en el press |
| Productos (`ResTile` por fila) | ~5 | Ninguno | **M1 + M3** | Pressable; shared al detalle |
| Pop-up administrable | 1 | Blur + escala | M2 ✔ | — |

### Convenios (`screens-convenios.jsx`) — 15 int. · **53 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Carrusel de anuncios | 1 | Swipe 1:1 + autoplay | M3 ✔ | — |
| Chips de categoría | ~6 | Centrado suave, cambio de fondo instantáneo | **M2** | Indicador deslizante compartido (requiere chip local, no `Pill`) |
| Tarjeta de convenio | 1 | `su-press` | M1 ✔ | Shared al detalle |
| Corazón de favorito ×2 | 2 | Spring + destello | M4 ✔ | — |
| Buscador | 1 | Ninguno | **M1** | Foco + icono que expande |
| CTA credencial (detalle) | 1 | `su-press` | M1 ✔ | Chevron que avanza |
| Grid de productos | 1 | `su-press` por card | M1 ✔ | Shared al detalle |

### Mi Historial (`screens-historial.jsx`) — 6 int. · **67 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Filtros (4 `Pill`) | 4 | `transition: all .2s` (**prohibido**) | **M2** | Chip con indicador deslizante; sustituir `all` |
| Progreso de solicitud | 1 | Llenado en secuencia | M2 ✔ | — |
| Tarjeta de solicitud | 1 | `su-press` | M1 | Expandir/colapsar el timeline (M3) en vez de saltar |
| `StatusPill` | ~5 | Ninguno | **M2** | Transición al cambiar de estado |

### Credencial (`screens-credencial.jsx`) — 10 int. · **20 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| QR dinámico (renueva 30 s) | 1 | Salta de golpe | **M2** | Cruce suave al renovar; contador interpolado |
| Campos bancarios | 5 | Ninguno | **M1 + M2** | Foco, validación, éxito |
| `Btn` guardar | 1 | `:active scale` | **M2** | loading → check |
| Voltear credencial | 1 | Ninguno | **M3** | Giro 3D (es un momento signature natural) |
| Nota "verificada" | — | — | **M0** | Informativa |

### Documentos (`screens-documentos.jsx`) — 5 int. · **60 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Filas de documento | ~4 | Ninguno | **M1 + M2** | Pressable; cambio de estado con transición |
| Botón subir / icon button | 2 | `Btn` | M1 | Peso |
| Sheet de subida | 1 | Curva unificada | M3 ✔ | Contenido escalonado |
| Dropzone | 1 | Ninguno | **M2** | Estado *drag-over* + check al completar (M4 candidato) |

### Suti Préstamo (`screens-loan.jsx`) — 7 int. · **57 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Slider de monto + contador | 1 | rAF interpolado | M2 ✔ | — |
| Stepper de pasos | 1 | `transition: background .3s` | **M2** | Indicador que avanza, no repintado |
| Selección de destino | ~4 | Ninguno | **M1 + M2** | Pressable + selección deslizante |
| `Btn` continuar / enviar | 4 | `:active scale` | **M2** | loading → check |
| Submitting → confetti | 1 | `su-spin` + confetti | M4 ✔ | Encadenar dentro del botón |

### Suti Terrenos (`screens-terreno.jsx`) — 7 int. · **0 %** ← peor pantalla

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Paneo/zoom del mapa | 1 | Arrastre 1:1 | **M0** | Justificado: añadir curvas daría sensación de lag |
| Lote seleccionable | ~30 nodos | Ninguno | **M1 + M2** | Press + estado seleccionado interpolado |
| Tarjeta de detalle del lote | 1 | Aparece de golpe | **M3** | Entrada desde el lote (shared o slide) |
| Controles de zoom | 2 | Ninguno | **M1** | Icon button pressable |
| Filtros / leyenda | ~3 | Ninguno | **M1** | Pressable |

### Marketplace: producto / módulo / artículo (`screens-marketplace.jsx`) — 27 int. · **48 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Hero + botones circulares | 3 | Ninguno | **M1** | Icon buttons pressables |
| Corazón de favorito | 1 | `I` plano, sin spring | **M1** | Reutilizar `FavHeart` (duplicado) |
| Filas de beneficios | ~3 | Ninguno | **M1** | Reveal al entrar |
| Grid "Disponibles ahora" | 1 | `su-press` | M1 ✔ | Shared al detalle |
| CTA inferior (4 estados) | 4 | Cambia de golpe | **M2** | Transformarse entre estados, no desaparecer |
| Sheets (simulación, cotización) | 2 | Curva unificada | M3 ✔ | Contenido escalonado |
| Bloques de módulo | ~4 | `su-press` parcial | **M1** | Uniformar |
| Artículo: zoom de imagen | 1 | `su-fadein` | **M3** | Shared desde la portada |

### Catálogo (`screens-catalogo.jsx`) — 10 int. · **40 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| `CatalogCard` | 1 | `su-press` | M1 ✔ | Shared al detalle |
| Galería (carrusel) | 1 | `scroll-snap` | M2 | Indicadores interpolados |
| Lightbox + navegación | 3 | `su-fadein` | **M2/M3** | Entrada con escala; cambio de imagen con deslizamiento |
| CTA de solicitud | 1 | `Btn` | **M2** | loading → check |

### Shell (`app.jsx`: nav, TopBar, toast, notifs, perfil) — 15 int. · **13 %**

| Componente | Interactivo | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Nav inferior | 6 | Indicador único + pop | M3 ✔ | — |
| TopBar colapsante | 1 | Driver de scroll | M3 ✔ | — |
| Toast | 1 | Presencia + barra de vida | M2 ✔ | Acción deshacer |
| Chips de saldo | 2 | Ninguno | **M1** | Pressable + cifra interpolada |
| Filas de notificaciones | ~4 | `su-press` parcial | **M1 + M3** | Entrada escalonada; salida al leer |
| Filas de perfil | ~6 | Ninguno | **M1** | Pressable + chevron |
| Avatar / foto | 2 | Ninguno | **M1** | Press + cruce al cambiar foto |

### Admin — 12 paneles, ~250 int. · **10–36 %**

Comparten estructura, así que la tabla es común (aplica a `screens-admin*.jsx`,
`admin-popup-editor.jsx`, `screens-company*.jsx`).

| Componente | Interactivo (aprox.) | Motion actual | Clase objetivo | Acción |
|---|--:|---|---|---|
| Fila de lista (editar) | ~90 | Ninguno | **M1** | Pressable sobrio (scale .99) |
| Asa de reordenar | ~15 | Arrastre sin respuesta de vecinos | **M3** | FLIP: los vecinos se desplazan |
| Toggle de visibilidad | 31 | Spring + press | M2 ✔ | — |
| Botón guardar | ~20 | `:active scale` | **M2** | loading → check |
| Acción destructiva | ~70 | Ninguna | **M2** | Tensión + colapso de la fila |
| Campos de formulario | 105 | Ninguno | **M1 + M2** | Foco, error, éxito |
| Chips de segmentación | ~20 | Fondo instantáneo | **M2** | Indicador deslizante |
| Modal / editor | ~8 | `su-fadein` | **M2** | Escala de entrada |
| Selector de color / picker | ~6 | Ninguno | **M1** | Press + check que se dibuja |
| Tabla de datos | ~10 | Ninguno | **M1 (M0 en scroll)** | Entrada escalonada al montar; nada ligado a scroll |
| `image-slot` de edición | ~20 | Propio del componente | M1 ✔ | — |

---

## Plan de implementación propuesto (para tu aprobación, no ejecutado)

| Bloque | Contenido | Elementos que toca | Riesgo |
|---|---|--:|---|
| **C1** | `Pressable` + migración de `su-press`/`su-btn` | ~280 | Bajo (una primitiva, reemplazo mecánico) |
| **C2** | Button motion system (variantes, loading, success, destructive, disabled) | 90 | Medio (toca estados, no lógica) |
| **C3** | Cards / Tiles / Rows | ~165 | Bajo |
| **C4** | Inputs y controles de formulario | 130 | Medio (foco y error son UX, requieren tu criterio de copy) |
| **C5** | Listas, FLIP y reorden | ~90 | Medio-alto (primer consumidor real de `flipCapture`) |
| **C6** | Admin | ~250 | Bajo |
| **C7** | Scroll contextual fuera de Inicio | 6 pantallas | Bajo |
| **C8** | Momentos signature adicionales (documento subido, firma, segundo shared) | ~5 | Alto por definición |

Cobertura proyectada al cerrar C1–C4: **~85 %** de los 582 elementos con al menos M1.

---

## Estado

**AUDITORÍA COMPLETA · SIN CAMBIOS DE CÓDIGO.** Detenido a la espera de tu confirmación
del diagnóstico y de la aprobación del orden C1 → C8.
