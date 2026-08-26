# H-002 — Perfilado read-only de la fuente histórica de afiliados

Fecha: 2026-08-21. Estado: **PASS**.

## Resultado ejecutivo

La fuente histórica autoritativa del dominio **Afiliados** quedó resuelta por decisión expresa del propietario:

```text
Archivo: C:\Users\david\Downloads\Usuarios SUTIAPP.xlsx
Hoja: Usuarios
SHA-256: F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591
Filas: 1 encabezado + 947 registros
Columnas: 187
Orden autoritativo: orden físico actual del Excel
```

`SutiApp Final`, CSVs anteriores, `DATA.user`, mocks, viewer, snapshots y `localStorage` son **NO AUTORITATIVOS** para el padrón. H-002 leyó el Excel sin modificarlo, no creó copias con PII y no inició Supabase, schema, SQL, Auth ni migraciones.

El perfil pudo completarse, pero encontró anomalías que H-003 deberá reconciliar antes de imponer unicidad o importar: nueve controles vacíos, trece grupos de controles duplicados y tres controles no numéricos.

## Método reproducible y minimización

- Lectura de `.xlsx` con `openpyxl` en modo `read_only=True` y `data_only=False`.
- Selección explícita de la hoja `Usuarios`; no se recorrieron otras fuentes.
- El registro ordinal 1 corresponde a la fila Excel 2; `fila_excel = ordinal + 1`.
- El orden no se alteró ni se aplicaron sorts, filtros o deduplicación.
- Los grupos se documentan con SHA-256 truncado del valor normalizado y ordinales, nunca con emails, nombres o números de control reales.
- Se verificaron 0 filas completamente vacías y 0 celdas de fórmula. Las 187 columnas contienen valores exportados; un valor derivado no adquiere autoridad maestra por estar materializado.

### Regla de normalización/validación usada solo para el perfil

Email normalizado: `NFC(trim(email)).casefold()`, con dominio convertido a IDNA. Para clasificar como válido se exigió:

- exactamente un `@`;
- local-part de 1–64 caracteres ASCII del conjunto común permitido;
- sin punto inicial/final ni puntos consecutivos;
- dominio con al menos un punto, labels válidos y límites de longitud estándar.

Esta regla no modifica `Email` y no constituye todavía el validador productivo de Auth. Es deliberadamente conservadora; H-003 deberá fijar y probar el contrato final.

## 1–4. Registros y `numero_control`

| Métrica | Resultado |
|---|---:|
| Registros exactos | **947** |
| Columna exacta | `Número de control`, posición 1 / columna A |
| No vacíos | 938 |
| Vacíos | **9** |
| Valores únicos no vacíos | 923 |
| Grupos duplicados | **13** |
| Filas involucradas en duplicados | 28 |
| Registros excedentes por duplicación | **15** |
| No numéricos | **3** |
| Con espacios externos | 0 |
| Con cero inicial detectado | 0 |

Todos los valores no vacíos están almacenados como texto. `Número de control` no satisface todavía una restricción única/no nula.

Ordinales con control vacío: `57, 418, 441, 586, 815, 816, 830, 854, 855`.

Ordinales con control no numérico: `748, 749, 796`. Se conservarán raw; no se corregirán ni convertirán automáticamente.

### Grupos seudónimos de `numero_control` duplicado

| Grupo | Ordinales de registro | Tamaño |
|---|---|---:|
| `controldup_4a514c08dad2` | 88, 657 | 2 |
| `controldup_f37e1491f36c` | 92, 893 | 2 |
| `controldup_082346ef1b95` | 118, 789 | 2 |
| `controldup_07aa2015d482` | 281, 536 | 2 |
| `controldup_69389e3240c9` | 314, 675 | 2 |
| `controldup_5feceb66ffc8` | 482, 656, 670, 837 | 4 |
| `controldup_dc7beace3fc1` | 550, 836 | 2 |
| `controldup_000b07fd81c1` | 578, 647 | 2 |
| `controldup_6f80b5cfb37b` | 587, 892 | 2 |
| `controldup_7c877ba13c7b` | 655, 725 | 2 |
| `controldup_9a89fd0c94aa` | 708, 914 | 2 |
| `controldup_3539e8afcacc` | 802, 876 | 2 |
| `controldup_ab7001df69d2` | 929, 947 | 2 |

Los IDs seudónimos son evidencia de agrupación, no claves futuras. La decisión sobre filas con control vacío/duplicado pertenece a H-003. Ninguna fila puede eliminarse ni recibir un control inventado.

## 5–11. Clasificación de email

La columna exacta es `Email`, posición 5 / columna E.

| Clasificación | Filas | Consecuencia conceptual |
|---|---:|---|
| Válido | **909** | Candidato según duplicados |
| Vacío | **28** | Afiliado existe; sin Auth |
| Inválido — sintaxis | **9** | Afiliado existe; sin Auth |
| Inválido — local-part | **1** | Afiliado existe; sin Auth |
| Inválidos totales | **10** | Afiliado existe; sin Auth |
| Grupos válidos duplicados | **5** | Primero elegible; posteriores no |
| Filas en grupos válidos duplicados | 10 | 5 ganadoras + 5 posteriores |
| Posteriores inelegibles por duplicado | **5** | Conservan email histórico |
| Candidatos Auth resultantes | **904** | 909 válidos menos 5 posteriores |

Los 947 registros quedan reconciliados: `904 elegibles + 28 sin email + 10 inválidos + 5 duplicados posteriores = 947`.

Se detectaron 445 emails cuyo valor normalizado cambia por mayúsculas/minúsculas; ninguno tiene espacios externos y ninguno requirió cambio Unicode NFC. El raw permanece intacto.

Ordinales sin email: `4, 15, 36, 57, 74, 90, 92, 114, 115, 169, 198, 222, 228, 265, 269, 293, 304, 305, 338, 370, 388, 391, 527, 586, 944, 945, 946, 947`.

Ordinales con email inválido por sintaxis: `20, 77, 128, 148, 189, 210, 230, 319, 358`.

Ordinal con local-part inválido: `283`.

### Grupos válidos duplicados y ganador por orden Excel

| Grupo | Ordinales | Ganador | Posterior inelegible |
|---|---|---:|---|
| `emaildup_5c0b1c94efe1` | 118, 789 | 118 | 789 |
| `emaildup_cd2314a94137` | 281, 536 | 281 | 536 |
| `emaildup_91e70c9dd364` | 512, 807 | 512 | 807 |
| `emaildup_1bda4c843fb2` | 670, 748 | 670 | 748 |
| `emaildup_6d0a925444cd` | 802, 872 | 802 | 872 |

También existen dos grupos de valores inválidos repetidos: `invaliddup_a49bfcfb08c6` en ordinales `20, 77, 319` e `invaliddup_96c8e08d0144` en `128, 148, 230`. Ninguno es candidato Auth.

Política aprobada: el primer registro válido de cada grupo conserva elegibilidad; los posteriores permanecen como afiliados, conservan `historical_email_raw` y quedan inelegibles mientras el conflicto exista. El Excel nunca se reordena antes de calcular esta clasificación.

## 12. Campos disponibles para la futura entidad `affiliate`

El libro mezcla identidad, PII, documentos, finanzas, columnas derivadas y helpers de Glide. No deben copiarse las 187 columnas a una tabla monolítica.

### Núcleo candidato

| Pos. | Campo Excel | No vacíos | Uso conceptual / riesgo |
|---:|---|---:|---|
| 1 | `Número de control` | 938 | `numero_control`; anomalías bloquean unicidad directa |
| 2 | `Estatus` | 947 | estado general; reconciliar con posición 29 |
| 3 | `NOMBRE` | 943 | nombre histórico raw |
| 4 | `Nombre` | 943 | posible nombre mostrado/derivado; colisión case-insensitive |
| 5 | `Email` | 919 | `historical_email_raw`; normalizado derivado aparte |
| 9 | `TELÉFONO` | 888 | contacto PII |
| 11 | `UNIDAD MODULO` | 843 | adscripción laboral |
| 12 | `CIUDAD` | 862 | localidad |
| 13 | `PUESTO EN ISSSTESON` | 779 | puesto de negocio, no permiso técnico |
| 14 | `FECHA INGRESO` | 703 | fecha raw; requiere perfilado de formato |
| 18 | `OCUPACION PROFESION` | 767 | ocupación |
| 19 | `F .INGRESO DEL INSTITUTO` | 588 | fecha raw; semántica por confirmar |
| 20 | `FECHA INSCRIPCION` | 710 | fecha raw |
| 21 | `FECHA CAPTURA` | 713 | procedencia/cronología candidata |
| 22 | `AFILIACION` | 692 | no confundir con `numero_control` |
| 23 | `FECHA DE NACIMIENTO` | 736 | PII sensible |
| 24 | `GENERO` | 865 | atributo histórico |
| 25 | `AREA` | 788 | adscripción |
| 26 | `DIRECCION` | 683 | PII sensible |
| 27–28 | `ESTADO CIVIL`, `NO. HIJOS` | 755 cada uno | PII; justificar necesidad |
| 29 | `Estatus Afiliados` | 545 | estado específico; reconciliar con `Estatus` |
| 30 | `PUESTO SUTI` | 411 | cargo de negocio; no permiso técnico |
| 31 | `RFC` | 438 | identificador fiscal sensible |
| 32 | `NIVEL` | 358 | categoría/segmentación; no permiso técnico |
| 142 | `fecha de baja` | 12 | estado histórico; conservar raw |
| 144 | `CURP` | 131 | identificador personal altamente sensible |
| 148 | `SUBDIRECCIÓN` | 24 | organización |
| 149 | `Cargo en app` | 25 | no autoridad de autorización técnica |
| 150 | `Etiquetas` | 2 | segmentación; semántica pendiente |

### Datos que exigen separación

- Documentos/URLs: `Hoja Tribunal`, `Hoja de Afiliación`, INE, talones, comprobante, `Photo`, `Imagen de perfil`.
- Bancarios: `Clabe interbancaria`, `Número de cuenta bancario`, `Banco`; nunca en payload general de perfil.
- Ahorro/préstamos: posiciones 36–141 y campos posteriores relacionados; son legacy protegido, derivados o snapshots y requieren H propia.
- Helpers de Glide/UI: checks, HTML, mensajes, rollups, choices, B1–B10, T1–T10 y booleanos de simulador; no son automáticamente columnas de `affiliate`.
- Organizacionales/comerciales: empresa, giros, logotipo y cargos; requieren modelado separado si representan otra entidad.

Anomalías de encabezado case-insensitive: `NOMBRE`/`Nombre` (3/4), dos variantes de `Ahorro-Desc. Quincenal o mens Total Rollup` (48/120) y dos variantes de `SValue Estado del ahorro` (130/133). H-003 debe mapear por posición y semántica, nunca solo por header normalizado.

## 13. Correspondencia preliminar con el frontend

| Consumo actual | Evidencia frontend | Fuente Excel candidata | Estado |
|---|---|---|---|
| `u.num`, `u.numControl` | `app/data.jsx:7,17`; `finance-store.jsx:38-40` | `Número de control` | Debe converger a `numero_control`; 24 registros requieren reconciliación por vacío/duplicado/no numérico |
| `u.name` | `app/data.jsx:3`; Perfil/Inicio/Credencial | `NOMBRE` o `Nombre` | Decidir semántica entre columnas 3 y 4 |
| `u.email` | `app/data.jsx:21` | `Email` | Raw + normalizado; email Auth separado |
| teléfono | `app/data.jsx:20` | `TELÉFONO` | Mapeo directo candidato |
| puesto/área/unidad | `app/data.jsx:32-40` | posiciones 11, 13, 18, 25, 30, 32 | Atributos de negocio, no roles técnicos |
| estado del afiliado | `app/data.jsx:38-40`; viewer | `Estatus`, `Estatus Afiliados`, `fecha de baja` | Reconciliación requerida |
| foto | `app/app.jsx:6-31` | `Photo`, `Imagen de perfil` y documentos relacionados | Seleccionar autoridad y almacenamiento seguro |
| banco | `app/screens-credencial.jsx:24-30,95-101` | posiciones 126–128 | Dominio sensible separado; retirar autoridad local futura |
| ahorro/préstamos | `app/data.jsx`, finance/loan stores | numerosas columnas derivadas del Excel | No mapear en `affiliate`; legacy protegido |

## 14. Riesgos de migración

1. **Crítico — clave no apta:** nueve vacíos, trece grupos duplicados y tres no numéricos impiden una restricción `numero_control UNIQUE NOT NULL` sin reconciliación.
2. **Crítico — pérdida de filas:** la regla de importar los 947 registros exige staging/quarantine o estrategia equivalente; deduplicar por control violaría el mandato.
3. **Alto — orden:** el ganador de email depende del ordinal; un sort o una exportación posterior puede cambiar el resultado. Debe persistirse `source_ordinal` junto con hash de origen.
4. **Alto — sensibilidad:** RFC, CURP, domicilio, nacimiento, INE, talones, banco y finanzas exigen minimización, cifrado/Storage, RLS y auditoría por dominio.
5. **Alto — mezcla de autoridades:** las 187 columnas combinan maestros, derivados y legacy financiero. Copiarlas todas haría de `affiliate` una segunda autoridad de Ahorro/Préstamos.
6. **Alto — encabezados ambiguos:** nombres duplicados por casing y variantes impiden mapeo automático por etiqueta.
7. **Medio — fechas como texto:** fechas históricas tienen columnas paralelas y requieren validación de formato sin sobrescribir raw.
8. **Medio — email:** el perfil usa una regla conservadora; el validador productivo y el proceso de cambio de credencial aún deben aprobarse.
9. **Medio — mutabilidad del archivo:** cualquier nueva versión requiere nuevo hash y re-perfilado; no se puede sustituir silenciosamente el maestro auditado.
10. **Integración legacy:** Google deberá relacionarse por `numero_control` cuando corresponda, pero los 24 registros anómalos no son enlazables de forma segura hasta conciliación.

## 15. Reconciliación con `INVARIANTS.md`

| Invariante | Resultado |
|---|---|
| INV-001 | Autoridad y columna confirmadas; calidad `numero_control` requiere H-003 |
| INV-002–004 | Alternativas declaradas no autoritativas; cero fallbacks propuestos |
| INV-005–006 | 43 registros quedan sin candidatura Auth por ausencia/invalidez/duplicado posterior, pero siguen siendo afiliados |
| INV-007–008, 016 | Ahorro/Préstamos no se migran ni reclasifican; columnas financieras siguen legacy protegido |
| INV-009, 013 | Auth/impersonación no implementados; diseño aprobado permanece intacto |
| INV-010 | Cero limpiezas, correcciones, eliminaciones o escrituras |
| INV-011 | Autoridad y lector H-002 identificados; escritor actual es el proceso propietario del maestro; detalle operacional se documentará antes de automatizar |
| INV-012, 014 | No se diseñaron fallbacks ni cachés |
| INV-015 | Aplicación y bundle no cambiaron |

## Source-of-truth guardian

```text
SOURCE OF TRUTH AUDIT
Domain: Afiliados
Authority: Usuarios SUTIAPP.xlsx / hoja Usuarios / SHA-256 fijado
Readers: perfilador H-002 read-only; futuros lectores aún no implementados
Writers: proceso propietario que genera el maestro; H-002 ninguno
Alternative sources: SutiApp Final, CSVs, DATA.user, viewer, snapshots, mocks, localStorage
Fallbacks: ninguno autorizado
Caches: ninguna creada por H-002
Conflicts: RESOLVED por decisión expresa del propietario
Verdict: SAFE para perfilado; migración condicionada a H-003
Evidence: hash, hoja, 947 registros, 187 columnas y métricas agregadas
```

## Legacy guardian

```text
LEGACY GOOGLE AUDIT
Systems/domains: columnas de Ahorro/Préstamos/banco embebidas en el Excel de afiliados
Reads: headers, presencia/ausencia y tipo de celdas; no se interpretaron importes ni reglas
Writes: ninguna
Calculations/triggers: 0 fórmulas dentro del Excel; Google/Apps Script no inspeccionados en esta reanudación
Authority: Excel solo para Afiliados; no se designó autoridad financiera
Equivalence: NOT APPLICABLE — no hubo migración ni cálculo
Recovery: NOT APPLICABLE — cero escrituras
Classification: READ ONLY para el perfil; REQUIRES AUDIT antes de mapear columnas financieras
Decision: PASS para H-002; Ahorro y Préstamos permanecen legacy protegido
Evidence: rangos de columnas clasificados, hash intacto e INV-007/008/016
```

## Decisiones para H-003

H-002 no necesita una decisión adicional para ser válida. Antes de importar deben resolverse:

1. representación temporal de nueve afiliados sin `numero_control`, sin inventarlo;
2. reconciliación de trece grupos duplicados conservando las 28 filas;
3. semántica de los tres controles no numéricos y confirmación de que el tipo futuro será texto;
4. selección canónica entre headers ambiguos y separación de las 187 columnas por dominio/sensibilidad;
5. algoritmo productivo exacto de normalización/validación de email.

## H-002 RESULT

Verificación de cierre conforme al protocolo del repositorio:

```text
Files changed: DECISIONS, SOURCE_OF_TRUTH, H001, H002, DATA_MAPPING y AGENT_CHANGELOG
Source-of-truth verdict: SAFE / RESOLVED para perfilado; migración aún no autorizada
Invariant verdict: PASS para H-002; anomalías explícitas se transfieren a H-003
Build: NOT APPLICABLE — sin cambio funcional
Tests: perfil reproducible y reconciliación 904+28+10+5=947; audit.ps1 PASS / REVIEW REQUIRED
Security: PASS — solo métricas/ordinales/grupos seudónimos; cero PII raw persistida
Legacy impact: READ ONLY; Ahorro/Préstamos no reinterpretados ni modificados
Unexpected files changed: ninguno
Known limitations: cinco decisiones de reconciliación antes de importar
Evidence: hash Excel intacto, hashes runtime intactos y auditoría estática exit 0
```

```text
Status: PASS
Authoritative source: Usuarios SUTIAPP.xlsx / hoja Usuarios / SHA-256 F4BA18ABE82B148ED65737DB16074303627F96D37FA6F9F025E0A10649BD9591
Row count: 947
numero_control status: columna Número de control (A); 938 no vacíos, 9 vacíos, 923 únicos, 13 grupos duplicados, 3 no numéricos
Email classification: 909 válidos, 28 vacíos, 10 inválidos; 904 candidatos Auth y 5 posteriores inelegibles por duplicado
Duplicate-email policy: primer registro por orden físico del Excel gana; posteriores permanecen como afiliados y conservan raw
Data modified: NO
Supabase created: NO
Source-of-truth status: RESOLVED — Excel maestro proporcionado por el propietario
Decisions required: 0 para cerrar H-002; 5 antes de importar en H-003
Recommended H-003: conciliación read-only de anomalías y diseño verificable del contrato/mapeo de importación de affiliate; NO ejecutada
```
