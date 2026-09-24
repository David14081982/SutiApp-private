# H-SCREEN-PERMISSION-COVERAGE-001

## PRE-CHANGE AUDIT — 2026-09-24

Objetivo: auditar cobertura de pantallas de afiliados, administración y empresas,
delegación individual y registro seguro de nuevas pantallas.
Autoridad OWNER: solicitud explícita de auditoría y mecanismo automático del 2026-09-24.
Alcance inicial: lectura dirigida de rutas, catálogos, RPC/RLS y metadata productiva;
inventario reproducible, controles de cobertura y pruebas aisladas. Antes de modificar
runtime o SQL se ampliará este documento con archivos y fronteras concretas.
Archivos iniciales: este documento; scripts/audit-screen-permission-coverage.js;
docs/qa/evidence/screen-permissions-20260924/*.
Fuentes de verdad: Supabase admin_section_definitions y responsabilidades/asignaciones
para delegación; políticas de audiencia para acceso de afiliados; membresía Auth por
empresa para portal. Las rutas frontend son consumidores, nunca autoridad de permisos.
Datos afectados: metadata de esquema y catálogo; ninguna cuenta, asignación o fila de negocio.
Legacy: inspección de fronteras de acceso, READ ONLY; no cálculos ni escrituras Google.
Invariantes: principal protegida, denegación backend, aislamiento entre empresas,
actor/contexto asistido, conservación de cuenta/expediente/historial y permisos existentes.
Riesgo: confundir audiencia con administración o conceder privilegios por descubrimiento
automático. Nueva pantalla debe ser registrable/seleccionable sin asignaciones automáticas.
Tests: cruce rutas/catálogo/backend; permisos de un módulo sin acceso a otro; nuevos
módulos; controles empresa; build y UI según archivos finalmente modificados.
Recovery: lecturas no mutan producción; cambios locales revisables y reversibles por diff.
Status: PASS para investigación; implementación pendiente de hallazgos.

## Ampliación de alcance

Se autorizan dentro de esta H herramientas de desarrollo: scripts/screen-permission-contract.js,
scripts/screen-permission-surfaces.json, scripts/register-admin-screen.js,
scripts/test-screen-permission-contract.js y gate en scripts/build-pages-site.js.
No se cambia el runtime ni la delegación de cuentas existentes. El mecanismo generará
registro SQL y recovery para una pantalla nueva declarada con frontera y prueba backend;
el build bloqueará pantallas sin registro. La aplicación de ese SQL forma parte del
despliegue revisado de la pantalla, nunca de una visita del navegador.
El defecto de module_visible se documentará y reproducirá: no se cambia una función
compartida fuera de un release con regresión global y recovery verificados.
Las 37 pantallas administrativas actuales están registradas. Nueve vistas empresariales
usan membership por empresa y no el selector Admin. Se pidió delimitar esa ampliación;
mientras tanto se auditan ambas y se conserva la separación de autoridades.

Navigator: índice STALE únicamente por evidencia/documentación del despliegue anterior
y scripts/apply-admin-revocation-release.js; se usa discovery dirigido sobre código real.

## Resultado de la auditoría

**No equivale a permisos independientes para cada subpantalla y cada operación.**
Sí están en producción las 37 entradas del menú Admin. El catálogo tiene 39 entradas:
las 37 anteriores más dos capacidades excepcionales de Ahorro. Se comprobaron por lectura
las definiciones reales, 35 funciones y 84 políticas; no se ejecutaron escritores productivos.

| Superficie | Cobertura observada | Límite demostrado |
|---|---|---|
| Menú Admin | 37/37 presentes en admin_section_definitions, ENFORCED | Tener casilla no demuestra separación de todos los escritores |
| Selector por cuenta | 35 entradas delegables de 39, incluidas dos capacidades de Ahorro | Administradores, Permisos, Roles e Historial se reservan a Total en este selector |
| Afiliados | 21 rutas clasificadas con sus controladores o preferencias propias | Ruta de usuario no significa permiso administrativo nuevo |
| Tu Sindicato | 9 experiencias y sus editores identificados | Comité depende de Sindicato; categoría, antigüedad y jubilados comparten ese módulo; documentos/minutas/programas tienen editores comunes |
| Empresas | Empresas, Convenios, Marketplace, Planes, Aprobación de Pop-ups y Membresías están en catálogo | Administración global y membresía empresarial son autoridades distintas |
| Portal empresarial | 9 vistas: empresa, productos, promociones, pop-ups, solicitudes, cotizaciones, estadísticas, notificaciones y bitácora | No existen casillas individuales por empleado/vista; membership decide por company_id y rol |
| Audiencia de afiliados | Otro panel: Acceso a pantallas, por sindicato/categoría/etc. | No es el selector individual de administradores |

Inventario reproducible de rutas y controladores: `scripts/screen-permission-surfaces.json`.
La clasificación declara quién controla cada dominio; no inventa un editor para preferencias
personales ni promete que todos los textos/elementos se puedan editar desde Admin.
Los permisos compartidos de contenido y dominio se conservan tal como están instalados.

### Hallazgos que impiden afirmar aislamiento completo

1. **Tomar control usa una lista obsoleta de 33 módulos.** La función instalada
   `admin_support_private.module_visible(uuid,text)` no contempla `login_history`,
   `votaciones`, `votaciones_nominal` ni `inversion`. Reproducido con las funciones
   capturadas en PostgreSQL aislado: un principal recibe false para esas cuatro rutas.
   No afecta a su aparición ordinaria en el selector. Se generó y probó una corrección
   específica, sin aplicarla. El candidato actual no agrega filas ni asignaciones.
2. **Permisos técnicos compartidos entre pantallas.** Convenios y Empresas comparten
   `companies.write`; Sindicato también lo recibe. Prueba real aislada: un usuario
   asignado solo a Convenios tiene `has_admin_module('companies_admin')=false` y
   `has_admin_permission('companies.write')=true`. Las políticas de companies y
   `can_manage_company_ficha` aceptan esa capacidad. No se demuestra aislamiento
   exclusivo de operaciones por ocultar Empresas del menú. Planes usa otra capacidad,
   `company_portal.write`, y no se concede en esa prueba.
3. **Edición estructural no habilitada.** Secciones, Menús y Formularios tienen
   `module_write_permissions=[]`. Además, sus escritores de nodos llaman a `structural`,
   que informa que la estructura se administra por versión. Su casilla concede lectura;
   no puede ofrecerse como edición funcional completa.
4. **Granularidad agrupada.** Sindicato agrupa nueve experiencias y Ahorro agrupa
   operaciones internas. Solo las dos excepciones de Ahorro tienen entradas especiales.
   No se han creado permisos por cada tab, modal, campo o registro.
5. **Portal de empresas sin delegación por vista.** La función instalada
   `is_marketplace_company_member` resuelve company_id + auth.uid + enabled + role;
   admite owner/editor y quotes. La prueba aislada confirma denegación entre dos
   empresas y que quotes no obtiene write. Eso no sustituye una matriz exhaustiva de
   todas las RPC y Storage. Se consultó al propietario sobre ampliar a empleados del
   portal; sin respuesta se implementó el alcance administrativo de su captura y se
dejó documentado el portal, sin cambiar su modelo de autoridad.
6. **Audiencia no cubre cada ruta individual.** El selector `ADMIN.SCREENS` contiene
   14 rutas; no enumera admin, modulo, articulo, catitem, membership, settings ni investment.
   Hay rutas paramétricas y preferencias que no deberían equipararse automáticamente a
   un editor administrativo. `can_access_app_screen` permite por defecto un screen_id
   sin política. Esto es distinto de Auth/RLS de los datos, que sigue siendo necesario.

### Automatización implementada

`scripts/build-pages-site.js` ejecuta `screen-permission-contract.check()` antes de
crear el artefacto que publica el workflow existente. El guard descubre el menú,
despacho de vistas Admin, rutas principales/internas, registro Sindicato y vistas
empresariales desde las fuentes. Rechaza una pantalla sin clasificación/controlador,
sin permiso de menú, sin grupo lateral o sin registro ENFORCED en la evidencia backend.
También bloquea un módulo nuevo ausente en visibilidad asistida aunque ya tenga fila
en catálogo. Las cuatro omisiones históricas anteriores están enumeradas como deuda
conocida, nunca como excepción abierta para futuras pantallas.

Al agregar un módulo nuevo se declara su metadata `registration` en la misma entrada
de `MODULES`: version, readPermissions, writePermissions, sections, totalOnly, boundary,
backendEvidence y isolatedTest. El build prepara automáticamente forward.sql y recovery.sql
en `tmp/screen-permission-registration/<version>/`, y bloquea la publicación hasta que
el backend se haya registrado y la captura de solo lectura se actualice. No hay que
editar una segunda lista de casillas: la pantalla existente lee `list_admin_module_catalog`.

Ejemplo del contrato de una entrada nueva (los archivos SQL/test deben ser reales y
probar su frontera; este ejemplo no autoriza agregar una pantalla ficticia):

```js
registration: {
  version: 'YYYYMMDDHHMMSS',
  readPermissions: ['permiso_existente.read'],
  writePermissions: ['permiso_existente.write'],
  sections: [], totalOnly: false,
  boundary: 'Descripción precisa de los datos y operaciones autorizadas',
  backendEvidence: 'supabase/migrations/<frontera_de_la_pantalla>.sql',
  isolatedTest: 'scripts/test-<pantalla>-isolated.js'
}
```

Los permisos técnicos deben existir en el CHECK instalado y en el rol principal;
los nombres de secciones deben existir y estar ENFORCED. Crear una capacidad técnica
nueva requiere su migración explícita. El generador no inventa RLS ni da privilegios
a usuarios por detectar un componente. Exige evidencia backend y archivo de prueba;
esa comprobación de archivos es un gate estructural, no certificación de sus resultados.
Hay que ejecutar y revisar esa prueba antes de desplegar.

El SQL generado mantiene la tabla autoritativa existente y recompila la lista de
visibilidad asistida desde el menú, evitando omisiones manuales. Guarda la definición
anterior con RLS forzada y sin grants API. Rechaza deriva de función/CHECK; recovery
rechaza cambios de catálogo o de asignaciones, responsabilidades, roles, permisos y
auditoría. No revoca/recrea usuarios ni borra historia. Una lectura sin auditoría no
es detectable por recovery: no se promete deshacer efectos de operaciones futuras.
Después de uso se requiere corrección hacia adelante, no borrar el historial.

La evidencia de producción es una captura fechada, no una consulta live durante CI.
Debe refrescarse con `node scripts/audit-screen-permission-coverage.js` después del
registro backend. No es un fallback runtime ni una autoridad de acceso.

### Verificación y límites

- `node scripts/test-screen-permission-contract.js`: pruebas con PGlite, funciones
  PostgreSQL capturadas, RLS/grants y cuentas sintéticas; sin red. Incluye generación
  automática desde un build copiado, alta individual, todas las entradas delegables,
  rechazo Total-only, permisos compartidos, sesión previa, revocación, cuenta principal,
  helper de empresa, candidato actual y recovery antes/después de uso.
- Fallos iniciales del harness: faltaba la dependencia de metadata
  `savings_admin_access_mode` y faltaba RESET ROLE antes de preparar la fixture de
  empresas. Se corrigieron en el entorno aislado sin sustituir funciones de permisos.
- `node scripts/build-pages-site.js <tmp>`: artefacto de 25 archivos generado con
  configuración publicable sintética, exclusivamente build; no publicado.
- UI: cero archivos frontend modificados por esta H; layout, orden, interacciones y
  estados del selector permanecen intactos. No se regeneró bundle ni cachebuster.
- No se implementó ni aplicó una modificación de helper compartido productivo. Por
  eso no corresponde declarar regresión global de imágenes PASS para este candidato;
  su eventual release necesita esa regresión y revisión completa de permisos.
- No se ejecutaron escritores de negocio para probar todos los módulos. La suite
  certifica registro/asignación y los límites descritos; no la totalidad del producto.

## H-SCREEN-PERMISSION-COVERAGE-001 RESULT

Status: PASS — auditoría y mecanismo de registro/gate; cobertura estricta de todas las
subpantallas: FAIL por hallazgos explícitos, no ocultado por el PASS del inventario.
Files changed: herramientas nuevas, build-pages-site.js, auditoría/evidencia, changelog
y actualización derivada del Registry. No cambios runtime de esta H.
Source-of-truth verdict: SAFE; Supabase conserva autoridad, snapshots solo build/test.
Invariant verdict: PASS en alcance probado; cuentas y principal protegida conservadas.
Build: PASS, artefacto aislado.
Tests: 20 pruebas PASS; detalle en isolated.json.
Security: sin privilegios nuevos en producción; no certifica aislamiento universal.
Legacy impact: READ ONLY de contratos; cero escrituras/cálculos Google.
Unexpected files changed: ninguno de esta H; dirty previo conservado.
Known limitations: agrupación, capacidades compartidas, portal sin permisos por vista,
editor estructural de lectura, cuatro módulos ausentes en visibilidad asistida productiva.
Evidence: docs/qa/evidence/screen-permissions-20260924/{production-metadata,isolated,build}.json.

Ampliación documental de cierre: docs/AGENT_CHANGELOG.md y los cinco JSON derivados
de docs/architecture/ entran al alcance para registrar el nuevo gate de build.

## Revisión arquitectónica posterior

APPROVED para la auditoría y herramientas de registro, con los límites anteriores.
No es aprobación de despliegue del SQL generado ni certificación de separación por
cada subpantalla. Instrucción siguiente: antes de publicar una nueva pantalla, ejecutar
su prueba backend real, revisar forward/recovery, registrar backend, recapturar metadata
y superar el gate. Resolver separadamente la granularidad requerida para empleados
de empresas y las capacidades compartidas antes de prometer aislamiento por operación.
