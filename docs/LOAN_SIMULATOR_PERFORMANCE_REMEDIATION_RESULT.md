# H-LOAN-SIMULATOR-PERFORMANCE-REMEDIATION-001 — Resultado

Remediación de rendimiento y orquestación de Suti Préstamo. Autorización autónoma
explícita del propietario, 2026-08-27. Autoridad financiera, fórmula certificada,
criterios, elegibilidad y composición visual aprobada quedan intactos.

---

## Veredicto

| Métrica | Antes | Después |
|---|---|---|
| Remounts del odómetro por recotización | sí (swap de componente) | **0** |
| Glifos por dígito | 61–70 | **11** |
| Glifos en la tarjeta de resultado | **1 647** | **297** |
| Nodos DOM en la tarjeta de resultado | **1 741** | **377** |
| Interpolación de `filter: blur()` | por dígito, por frame | **estática mientras gira** |
| Duración de asentamiento | 1000 ms | **480 ms** |
| Emisiones globales del store por cotización | **2** | **1** |
| Re-render de pantallas ocultas por cotización | 3 suscriptores × 2 emisiones | **0** (`status`/`overview` estables) |
| Cotización desechada al cambiar de fondo | 1 | **0** |
| Tap de fondo → cotización | 320 ms de debounce | **16 ms** |
| Tap de monto rápido → cotización | 320 ms de debounce | **25 ms** |
| Plazo sugerido → resultado visible | debounce + RPC | **46 ms** (proyectado de `termOptions`) |
| Presupuesto peor caso de reintentos | **32.0 s** | **8.3 s** |
| `ensureLoanSession` concurrentes | 3 sin deduplicar | **1 en vuelo por contexto** |
| Recuperación de `SNAPSHOT_INVALID` | manual («Reintentar») | **1 ciclo silencioso automático** |
| Extensión infinita de TTL | — | **NO** (15 min absolutos; refresco proactivo) |

Latencia real de cotización contra Supabase en vivo (12 muestras):
**mediana 178 ms · p90 250 ms · máximo 364 ms · mínimo 140 ms**.
El servidor nunca fue el cuello de botella.

---

## A · Odómetro

`app/motion.jsx` · `app/screens-loan.jsx`

La pista es **modular**: `slot.cycle + 1` glifos donde el último repite el primero.
Trasladarla a `-cycle em` muestra el mismo glifo que a `0 em`, así que dos keyframes
con el **mismo offset** reinician la vuelta sin salto visible. Con eso `turns`
vueltas se animan sobre 11 nodos en vez de `turns*10+delta`.

- El motor (`SmoothMoney`) **permanece montado** durante una recotización y conserva
  la forma del último importe válido. `LoadingReels` deja de sustituirlo.
- Las ruedas se identifican por **posición decimal** (desde la derecha). Antes se
  indexaban por posición de cadena, así que ganar un dígito re-montaba todas.
- Estilos hoisted a constantes; `OdometerDigit` memoizado.
- El blur ya no se interpola: estático mientras gira, retirado al asentar. Un filtro
  animado se re-rasteriza cada frame; uno estático, una sola vez.
- Los importes en movimiento llevan `data-notext` y `data-noreveal`: los observers
  globales de copy y reveal dejan de recorrer cientos de glifos en cada commit.

**Regla fail-closed intacta.** Mientras gira, el nodo va `aria-hidden` y sin
`aria-label`: no hay importe legible hasta que asienta. Verificado:
`stale_financial_labels_during_recalculation: 0`.

## B · Propagación de estado

`app/financial-legacy-repository.js` · `app/app.jsx` · `app/screens-financiera.jsx`

- La cotización interactiva deja de emitir `status: 'loading'` global. El overview ya
  está cargado; ese emit sólo re-renderizaba TopBar y Financiera, que siguen montadas
  detrás de la ruta apilada.
- `useFinancialLegacy(selector?)` con comparación superficial. Sin selector devuelve
  el snapshot completo: **la API previa no cambia**.
- TopBar y las dos instancias de Financiera consumen `overviewSlice`.

## C · Selección atómica

`deriveSelection(program, previous)` deriva fondo, monto y plazo juntos: `selectionKey`
cambia **una vez** por intención. Se elimina la bandera `immediate` por ref, que se
consumía sobre la selección intermedia. Un plazo personalizado válido para el fondo
nuevo se conserva en vez de reiniciarse a `terms[0]`.

`immediate` viaja **dentro** del estado de selección, así que no puede aplicarse a una
selección que el mismo commit ya invalidó.

## D · Plazos sugeridos instantáneos

`projectTermOption(base, term)` copia el renglón de `termOptions` que Supabase ya
resolvió para ese fondo y ese monto. **Cero aritmética en el navegador**: `interest`,
`administrativeFeeTotal`, `total` y `paymentPerPeriod` se copian verbatim. La
confirmación autoritativa viaja en segundo plano y siempre prevalece.

Verificado: `preset_term_matches_server: true` — discrepancia esperada y observada 0.
La proyección está memoizada; sin eso su identidad cambiaba en cada render y
realimentaba el efecto que publica la simulación al padre (React error #185).

`confirmLoanSession` envía sólo `programId`, `amount` y `term`: una proyección no puede
contaminar el alta.

## E · Sesión y snapshot

- `ensureLoanSession` deduplicada con promesa en vuelo compartida.
- **Un** ciclo de recuperación silenciosa ante `SNAPSHOT_INVALID`, sin bucle.
- **TTL:** los 15 minutos absolutos **no se extienden nunca**. A menos de 60 s del
  vencimiento se abre un snapshot nuevo antes de cotizar. Es la alternativa más simple
  y la única compatible con INV-107 y con `check (expires_at<=created_at+interval '15
  minutes')`, que prohíben que la RPC escriba esa tabla.
- **Lock:** `for share` → `for key share`, **aplicado y verificado** (ver más abajo).

## F · Continuar

Publicación al padre en `useLayoutEffect`: el botón se habilita en el mismo frame
pintado que los importes. Sólo permanece habilitado con cotización válida para la
selección vigente (`quoteMatchesSelection` sobre fondo, monto y plazo).

## G · Reintentos

La ruta usa PostgREST, no Edge Function. Se retiró la clasificación de errores de Edge
(`failed to send a request to the edge function`, `financial_legacy_unavailable`) y se
adoptaron fallos de transporte reales más códigos transitorios de PostgreSQL
(`57014`, `40001`, `40P01`, `55P03`, `08006`, `53300`) y `502/503/504`.
`SNAPSHOT_INVALID` nunca se reintenta aquí: tiene su propia recuperación.

Presupuesto por evidencia: 2 intentos × 4 s + 300 ms ≈ **8.3 s** peor caso.

---

## NOT_APPLICABLE verificados

Dos hallazgos del análisis previo resultaron incorrectos al contrastarlos con el
esquema. **No se añadió código defensivo redundante.**

- **`payrollImpact` READY con `version` nula.** Imposible:
  `version integer not null default 1` con `check (version > 0)`
  (`20260824000100_create_declared_payroll_authority.sql`).
- **División entre cero en `get_current_declared_payroll_impact`.** Imposible:
  `check (gross_pay_per_fortnight > 0)` y
  `check (deductions_per_fortnight >= 0 and deductions_per_fortnight < gross_pay_per_fortnight)`
  garantizan denominadores estrictamente positivos, y ambos operandos son
  `numeric(14,2)`, por lo que su diferencia mínima positiva es 0.01.

## Lock del snapshot — APLICADO Y VERIFICADO

`supabase/migrations/20260827001000_loan_snapshot_quote_key_share_lock.sql`
aplicada a la base productiva el 2026-08-27 bajo autorización explícita del
propietario. Reversible en cualquier momento con
`python scripts/apply-loan-snapshot-key-share-lock.py --recover`.

`key_share_lock: true` · `legacy_share_lock: false`.

**Evidencia de no-impacto.** Se capturó el estado completo antes y después con
dos instrumentos nuevos y se diferenciaron:

- `scripts/capture-financial-security-surface.py` — conteos, digest de las 146
  reglas, fuente de 8 funciones financieras, grants de tabla, ACL de ejecución,
  RLS (`relrowsecurity`/`relforcerowsecurity`), políticas y constraints.
  **Única diferencia en toda la superficie:** el `md5(prosrc)` de
  `resolve_current_loan_snapshot_quote`, la función declarada. Todo lo demás
  byte-idéntico.
- Diff del cuerpo de esa función contra la migración original (historia
  inmutable): **exactamente 2 líneas**, `for share` → `for key share`.
- `scripts/capture-loan-quote-equivalence.js` — matriz determinista de **51
  cotizaciones** (5 fondos × montos fijos × todos los plazos permitidos y el
  mínimo personalizado) a través de la RPC autenticada en navegador real.
  SHA-256 de la matriz **idéntico** antes y después:
  `e35edd06d7a651803384df35e05475b36e2446a47ebb5675ea1b2abe81305cfe`.
  0 errores, 0 excepciones en ambas capturas.

| Verificación | Antes | Después |
|---|---|---|
| Reglas / fondos / programas | 146 / 35 / 3 | **146 / 35 / 3** |
| Reglas `PUBLISHED` · políticas de plazo activas | 146 · 1 | **146 · 1** |
| Digest de las 146 reglas | igual | **igual** |
| RLS y `FORCE RLS` | sin cambio | **sin cambio** |
| Políticas y constraints | sin cambio | **sin cambio** |
| Grants de tabla y ACL de ejecución | sin cambio | **sin cambio** |
| `authenticated` ejecuta la RPC | sí | **sí** |
| `anon` denegado · acceso directo al snapshot denegado | sí | **sí** |
| Fuente del resolver certificado `SUTI_LOAN_QUOTE_V1` | igual | **igual** |
| Matriz de 51 cotizaciones (SHA-256) | igual | **igual** |

Suite estática 51/51 y navegador real (performance, auto-recalc, stale-quote,
result-loading, finance-credit, contratos de snapshot/RPC) PASS después de
aplicar.

---

## Verificación

- **Suite estática:** 50/50 PASS.
- **`test-loan-simulator-performance-browser.js`** (nuevo, Chrome real, 390×844, Supabase en vivo): PASS.
- **`test-loan-auto-recalc-browser.js`:** PASS.
- **`test-loan-stale-quote-browser.js`:** PASS — `stale_financial_labels_during_recalculation: 0`.
- **`test-loan-result-loading-browser.js`:** PASS ×6 consecutivas.
- **`test-frontend-boot-browser.js`:** PASS.
- **`test-finance-credit-consistency-browser.js`:** PASS — `homeCredit === financeCredit === 100000`.
- **`test-admin-desktop-shell-browser.js`, `test-admin-financial-requests-workbench-browser.js`, `test-home-header-collapsed-browser.js`:** PASS.
- Excepciones de navegador: 0. Google calls: 0. Cálculos financieros en frontend: 0.

### Correcciones a la infraestructura de pruebas

Tres tests fijaban el contrato anterior o tenían defectos propios. Ninguna aserción se
debilitó; las estructurales se conservaron y se añadieron nuevas.

1. **`test-loan-simulator-ui-cutover.js` / `test-personalized-financial-session-snapshot.js`** —
   fijaban `duration: 1000`, `maxQuoteAttempts = 5`, `quoteTimeoutMs = 6000`, la bandera
   `immediate` por ref y la clasificación de errores de Edge. Re-anclados al contrato nuevo,
   más aserciones nuevas: pista modular de 11 glifos, sin blur interpolado, sin remount,
   selección atómica, proyección de `termOptions`, deduplicación de sesión y selectores.
2. **`test-loan-result-loading-browser.js`** — la duración de 480 ms redujo a la mitad la
   ventana en que observaba estados transitorios, volviendo carreras varias esperas suyas.
   Se conservaron íntegras las aserciones estructurales y se sustituyó el muestreo único por
   CDP por un muestreo **en página cada 10 ms** que registra el pico de animaciones y blur:
   estrictamente más riguroso que antes. Su fixture de error de transporte se alineó con el
   fallo real de PostgREST.
3. **`test-finance-credit-consistency-browser.js`** — tenía **dos defectos propios
   preexistentes**, ajenos a esta H: navegaba a `127.0.0.1:<puerto aleatorio>`, que la
   allowlist `ALLOWED_APP_ORIGINS` de la Edge Function nunca puede aceptar; y su expresión
   de espera devolvía un nodo DOM con `returnByValue`, que jamás serializa. Corregidos ambos,
   pasa.

### Nota de entorno

`SUTIAPP_INITIAL_QUOTE_LIMIT_MS` (default 200) mide desde `createRoot`, así que incluye el
montaje de React y el arranque en frío de Chrome. En esta máquina el primer montaje toma
196–650 ms según carga —y el **baseline sin tocar medía 224.8 ms**, es decir ya excedía el
umbral: no es regresión. Los montajes en caliente miden 53–95 ms, que es donde el guard
sigue siendo efectivo ante una regresión de debounce. La latencia intención→cotización se
mide ahora directamente en el test nuevo: **16–25 ms**.

---

## Sistema protegido

| | |
|---|---|
| Criterios financieros | 146 — intactos |
| Fondos | 35 — intactos |
| Programas | 3 — intactos |
| Fórmula `SUTI_LOAN_QUOTE_V1` | sin cambios |
| Google en runtime | 0 |
| Cálculos financieros en frontend | 0 (sólo proyección de `termOptions` server-side) |
| Cambios en reglas de negocio | 0 |
| Rediseño de UI | 0 |
