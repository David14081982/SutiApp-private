# Auditoría inicial del repositorio — H-000

Fecha: 2026-08-20. Alcance: todos los archivos visibles del directorio, excluyendo inspección del contenido binario de imágenes. No se modificó código funcional.

## Resumen ejecutivo

**Veredicto:** `DECISION REQUIRED` antes de tratar el frontend actual como conectado a datos productivos.

La aplicación es un prototipo PWA estático que puede desplegarse tal como está. En ese despliegue, mocks, constantes, semillas, `localStorage`, un sidecar JSON y CacheStorage sí participan en ejecución. Hay autoridades locales declaradas por comentarios, pero no son autoridades productivas verificadas. Se encontraron fuentes paralelas y fallbacks capaces de conservar o reconstruir información.

## Inventario técnico

| Área | Resultado |
|---|---|
| Framework | React/ReactDOM 18.3.1 UMD, cargados desde unpkg. JSX precompilado. |
| Entrada ejecutable | `SutiApp.html` → `app/bundle.js?v=61`; los `.jsx` no se cargan directamente. |
| Build | Proceso externo/manual documentado en `CLAUDE.md`; no hay script reproducible local ni manifiesto de dependencias. |
| Rutas | Router propio en `app/app.jsx`; 6 tabs y 11 rutas apiladas. |
| Componentes | Archivos `screens-*`, `ui.jsx`, `brand.jsx`, motion, press, assets y editores admin. |
| Stores/contextos | 13 stores globales principales: admin, assets, catálogo, empresa, copy, finanzas, catálogo financiero, flujos, fondos, membresías, cotizaciones, sindicato e imágenes. No se hallaron React Contexts. |
| Hooks | Hooks React locales y hooks de suscripción `use*Store`; sin capa remota. |
| Servicios/APIs | No hay APIs de negocio. Solo CDN, Google Fonts, fetch del sidecar y fetch de red del service worker. |
| Persistencia | `localStorage`, `.image-slots.state.json`, CacheStorage del service worker y código/semillas. Sin `sessionStorage`, IndexedDB ni DB remota. |
| Autenticación | Simulada en cliente para admin y empresas. |
| Permisos | Matriz y gates de UI en `adminStore`, controlados por `localStorage`. |
| JSON | `.image-slots.state.json` participa en runtime; `docs/F1.0-baseline.json` es fixture de QA/documentación. |
| Datos hardcodeados | Extensos en `data.jsx`, `funds-seed.js`, stores y algunas pantallas. |

## Fuentes paralelas clasificadas

| Archivo/fuente | Entidad | Entorno | ¿Ejecutable en producción estática? | Persistente | ¿Fallback? | Riesgo |
|---|---|---|---|---|---|---|
| `app/data.jsx` / `window.DATA` | Usuario, ahorro, finanzas, convenios, solicitudes, noticias, comité, docs, promos, anuncios | Runtime/prototipo | Sí, dentro del bundle | Código | Sí, varios stores/pantallas | **CRÍTICO**: mock con datos personales/financieros aparentes y múltiples dominios. |
| `app/admin-store.jsx` | Auth admin, viewer, roles, contenido, noticias, accesos, convenios, anuncios, log | Runtime/prototipo | Sí | `localStorage` | Semillas si falta/está corrupto | **CRÍTICO**: auth/permisos y datos enteramente controlados por cliente. |
| `app/company-store.jsx` | Empresas, planes, solicitudes, auth empresa, productos/promos | Runtime/prototipo | Sí | `localStorage` | Semillas hardcodeadas | **CRÍTICO**: login acepta cualquier contraseña de 3+ caracteres; duplicación con catálogos/solicitudes. |
| `app/finance-store.jsx` | Solicitudes de financiamiento y folios | Runtime/prototipo | Sí | `localStorage` | Vacío/folio default; usuario desde `DATA` + viewer | **CRÍTICO**: aparenta repositorio canónico, pero solo local y mezcla dos contextos de usuario. |
| `app/fincat-store.jsx` | Catálogo financiero/recomendados | Runtime/prototipo | Sí | `localStorage` | `DATA.finanzasGroups/recommended` | **ALTO**: autoridad local declarada con fallback activo a otra fuente. |
| `app/screens-admin-finanzas.jsx`, `flow-store.jsx` | Productos financieros | Runtime/prototipo | Sí | Indirecta | Acceso directo a `DATA` si store no carga | **ALTO**: camino paralelo explícito. |
| `app/catalog-store.jsx` | Marketplace | Runtime/prototipo | Sí | `localStorage` | Seed de código + productos de `companyStore` | **ALTO**: copias relacionadas con empresa y catálogo financiero. |
| `app/membership-store.jsx` | Membresías | Runtime/prototipo | Sí | `localStorage` | `SEED` de código, escrito al iniciar | **ALTO**: eliminación local puede reaparecer tras reset/borrado de storage. |
| `app/funds-seed.js` + `funds-store.jsx` | Reglas de fondos financieros | Runtime/prototipo | Sí | `localStorage` | Seed global | **ALTO** y legacy-sensitive por contenido financiero. |
| `app/flow-store.jsx` | Flujos y seguimiento | Runtime/prototipo | Sí | `localStorage` | Seeds y catálogos alternativos | **ALTO**: referencias financieras y futura autoridad sin definir. |
| `app/quotes-store.jsx` | Cotizaciones y secuencia | Runtime/prototipo | Sí | `localStorage` | Defaults vacíos/folio | **MEDIO-ALTO**. |
| `app/sindicato-store.jsx` | Contenido sindical | Runtime/prototipo | Sí | `localStorage` | Seed desde `DATA`/código | **ALTO**. |
| `app/copy-store.jsx` | Overrides de textos y editores | Runtime/prototipo | Sí | `localStorage` | Texto DOM/código | **MEDIO-ALTO**: contenido puede diferir por navegador. |
| `app/assets-store.jsx`, branding, foto/banco | Assets, branding, foto y cuenta bancaria | Runtime/prototipo | Sí | `localStorage` | Registro/defaults | **ALTO** para datos bancarios y de usuario; medio para presentación. |
| `.image-slots.state.json` + `app/image-slot.js` | Imágenes administrables | Runtime/prototipo | Sí | Archivo y `localStorage` | Mezcla explícita; local gana | **ALTO**: dos escritores/candidatos y riesgo de resurrección. |
| `sw.js` CacheStorage | App-shell y respuestas GET | Runtime/PWA | Sí | CacheStorage | Offline tras fallo de red | **MEDIO**: caché legítima, pero requiere invalidación por dominio para futuras APIs. |
| `app/bundle.js` | Copia ejecutable de todas las fuentes | Runtime | Sí, es lo único ejecutado | Archivo | No, es artefacto | **ALTO operacional**: puede divergir de `.jsx` por build manual. |
| `docs/F1.0-baseline.json` | Baseline visual | QA/documentación | No | Archivo | No | **BAJO**, fixture aislado. |
| `app/comite-photos.js` | Imágenes embebidas | Runtime | Sí | Código | Fallback visual | **BAJO-MEDIO**, no es autoridad de identidad. |

No se hallaron archivos llamados `mocks/`, `fixtures/`, `users.json`, `sessionStorage` ni IndexedDB. La ausencia de esos nombres no reduce el riesgo porque `data.jsx` se declara explícitamente “mock content”.

## Conflictos y duplicaciones

1. **Identidad:** `DATA.user`, `adminStore.viewer` y snapshots dentro de solicitudes; `num`, `numControl` y el futuro `numero_control` requieren mapeo formal.
2. **Ahorro/préstamos:** valores y simulaciones locales conviven con la autoridad Google legacy declarada por el propietario.
3. **Catálogo financiero:** `finCatStore` se proclama autoridad de ejecución, pero `DATA` sigue siendo fallback en consumidores.
4. **Convenios/productos:** `DATA`, `adminStore`, `companyStore` y `catalogStore` contienen representaciones relacionadas.
5. **Solicitudes:** `DATA.solicitudes`, `financeStore`, `companyStore.solicitudes` y cotizaciones se agregan/derivan con límites no formalizados.
6. **Imágenes:** sidecar, `localStorage`, registry y assets overrides tienen precedencias propias.
7. **Código ejecutable:** `.jsx` y `bundle.js` son dos representaciones con sincronización manual.

## Seguridad

- Admin: `adminStore.login()` solo marca `suti_admin_auth_v1=1`; la pantalla acepta cualquier contraseña con mínimo 3 caracteres.
- Empresas: login valida empresa existente y longitud de contraseña, no credencial.
- Roles, identidad actuante y accesos viven en `localStorage`; pueden alterarse desde DevTools.
- Los gates son UI/cliente, sin backend ni RLS.
- El audit log también vive en `localStorage`, por lo que no es íntegro ni central.
- No se detectaron claves de Supabase, `service_role` ni tokens API en código funcional.

**Veredicto de seguridad productiva:** `FAIL`. **Impacto H-000:** documentación solamente; no se amplió el riesgo.

## Política de adaptadores

La evolución a repositorios por dominio es viable porque ya existen stores, pero no debe renombrarse un store local como autoridad productiva. Primero se resuelve cada fila de `SOURCE_OF_TRUTH.md`; después se inserta un adaptador y se eliminan lectores directos/fallbacks mediante una H separada y reversible.

## Límites de la auditoría

- No se accedió a Google Sheets, Apps Script ni la app Glide; sus lectores/escritores reales siguen sin inventariar.
- No se ejecutó una aplicación en navegador ni QA visual.
- No hay Git metadata en este directorio, así que no existe baseline de `git diff`.
- No hay build/test local reproducible. La validación de H-000 se limita a integridad estática, hashes y ausencia de cambios funcionales.

## Comandos de auditoría estática

El repositorio no tiene `package.json`, por lo que H-000 no introdujo npm ni dependencias. Los equivalentes seguros son:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check sources      # audit:sources
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check mocks        # audit:mocks
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check architecture # audit:architecture
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check legacy       # audit:legacy
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\audit.ps1 -Check security     # audit:security
```

`-Check all` ejecuta las cinco. El script excluye `app/bundle.js` para no duplicar cada hallazgo de las fuentes. `AUDIT STATUS: PASS` confirma que el escaneo terminó; `VERDICT: REVIEW REQUIRED` exige clasificación humana y no implica que la arquitectura sea segura.
