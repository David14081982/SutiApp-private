# H05 — Implementación

Se conserva exactamente `get_self_savings_live_readonly()` (MD5 `74f504337e4f336e6b12da3ab32f30a6`) y `savings_effective_action(text,uuid)` (MD5 `407fefd589bc4f840a0fc36d988e831b`). Google legacy sigue siendo autoridad; Supabase continúa como espejo certificado SHADOW. No cutover, recálculo, DML financiero ni cambios a históricos, RLS, triggers o permisos existentes.

## Índice seleccionado

Único índice nuevo: `savings_legacy_evidence_participant_type_source_idx (participant_id, record_type, source_sheet, source_row DESC)`.

Las cuatro búsquedas del último registro de participante, inscripción, plan y saldo Q utilizan igualdad en las tres primeras columnas y orden por fila. El mismo prefijo acota AA:DO, DP:DW, retiros y cambios de aportación al participante/tipo. No se reescribió ningún predicado ni ordenamiento financiero.

Se ensayaron ambos candidatos con DDL dentro de transacciones revertidas. El índice por fecha examina menos filas en historia/futuro (25/68 frente a 93/93 en la muestra), pero ocupa 1.925.120 bytes frente a 770.048 bytes y no cubre directamente el orden de las cuatro búsquedas por hoja/fila. Se elige la estructura menor con mejora demostrada en todos los predicados examinados. No se crean ambos. El tamaño observado es propio de estos datos y su deduplicación B-tree, no una garantía universal.

Referencias técnicas: [índices multicolumna PostgreSQL](https://www.postgresql.org/docs/current/indexes-multicolumn.html), [snapshot de funciones STABLE](https://www.postgresql.org/docs/current/xfunc-volatility.html).

## Reutilización validada

Nueva RPC `get_self_savings_if_changed(text)` sin parámetro de afiliado. Deriva actor y afiliado efectivo desde las funciones de identidad existentes; vuelve a comprobar impersonación y contexto administrativo. SECURITY DEFINER, owner postgres, search_path vacío, STABLE, sin EXECUTE para anon. El parámetro sólo es una versión conocida; nunca selecciona un participante.

La versión comprende:

| Dependencia | Validación por statement |
|---|---|
| Actor, afiliado efectivo, sesión Auth, impersonación | Contexto derivado y validado por backend |
| Permisos y contexto administrativo | `get_admin_access_context()` vigente |
| Participante e importación certificada | Hash de filas completas seleccionadas con los predicados originales |
| Evidencia legacy del participante | Hash ordenado de todas sus filas completas |
| Versiones de beneficiarios y beneficiarios | Hash de filas completas vinculadas |
| Disponibilidad de acciones | Filas globales/del participante más las cuatro decisiones efectivas actuales |
| Cambio de día y zona horaria | `current_date`, TimeZone |
| Grafo financiero conocido | Definiciones exactas del getter y su helper de acciones |

Una definición financiera desconocida desactiva la reutilización y delega cada lectura al getter original. No usa un resultado alternativo. La versión y la proyección se leen bajo el mismo snapshot STABLE; no son dos RPC con una ventana entre comprobación y lectura.

Si la versión coincide, devuelve `modified:false` sin datos financieros y sin ejecutar el getter completo. Si cambia, devuelve el payload completo original. No TTL, tablas de versión adicionales ni triggers nuevos.

SavingsRepository mantiene una única proyección inmutable en memoria. Cada nueva lectura valida con backend; llamadas simultáneas se unifican. La clave incluye actor, afiliado, sesión, impersonación y asignación/contexto Admin; excluye versiones de contenido ajeno a Ahorro. Las escrituras Savings invalidan antes y después, incluso si fallan con resultado incierto. Logout, cambio de sujeto/contexto, refresh explícito o error retiran la copia. Las generaciones descartan respuestas tardías de otra sesión. Sin localStorage, sessionStorage ni persistencia financiera.

## Alcance del frontend

El release aislado parte de `19eb53d`; sólo cambian los chunks `savings-repository.js` y `savings-store.jsx` entre 108 módulos. Bundle 222 / service worker 169 son regeneración/versionado, sin cambio de lógica del service worker. Inicio, Finanzas, Ahorro y Admin conservan sus fuentes publicadas. Los cambios operativos de Ahorro pendientes en el workspace no se publican.

La protección de identidad de self/admin en SavingsStore es necesaria para que logout/cambio de sujeto no reponga una respuesta antigua. No cambia el lector administrativo ni sus autorizaciones. Una aserción estática del test foundation se actualiza para verificar la nueva delegación al mismo lector certificado Q.

## Límites medidos

El recorrido real Finanzas → Ahorro → Finanzas realiza dos RPC: la pantalla Finanzas sigue montada al volver y ya no emitía una tercera. H05 reduce dos proyecciones completas a una completa y una validación; no se declara una sola RPC total. El estado sin participante tiene payload pequeño: su envoltura incrementa 51 bytes en ese recorrido, aunque evita una proyección completa repetida. No se atribuye a H05 una resolución total del paging/host documentado en H02.
