# Corrección quirúrgica del flujo documental

Estado: correcciones implementadas y publicadas; comprobaciones locales y globales descritas en verde. Certificación PDF en Safari físico pendiente. Autorización: instrucción del propietario fd1824d7 (implementación y publicación, sin rediseño). No se declara resolución universal de errores ni elegibilidad financiera de cuentas reales.

Base: origin/main actualizado a f6cfae303ce32c6d2102fce5a664f4292f596118; worktree separado fix/document-flow-surgical. La raíz y el candidato anterior permanecen intactos. HTML/bundle/SW y fuentes Edge productivas contrastados con main; document-operation 12, document-access 28, financial-legacy 76.

Ampliación de verificación autorizada: `scripts/test-membership-payment-contract.js` y `scripts/test-program-request-finance-block-contract.js`, sólo pruebas. Se reproduce un fallo previo en f6cfae3: el comparador esperaba el transporte RPC anterior a DocumentIntegration. Se fija el hash LF del repository completo aprobado y se actualiza únicamente el selector de la mutación, conservando las pruebas de bloqueos, payloads, idempotencia, proyección financiera y Google. Ninguna regla ni fuente financiera runtime cambia.

Alcance previo: coordinación de sesión (`private-resource-demand.js`); transferencia/registro (`document-integration.js`, `document-transfer-source.mjs`, `document-workflow-repository.js`); estados y selección en documentos, membresía, préstamo y Admin Afiliados; fotografía de perfil (`affiliate-repository.js`, handler correspondiente en `app.jsx`, Auth sólo si el diagnóstico lo exige); clasificación segura en `financial-legacy`. Artefactos derivados: bundle, transferencia si cambia, versiones de caché existentes. Pruebas focales y evidencia en esta carpeta. SQL sólo si una discrepancia vigente se reproduce, con definición original, reversión y revisión previa.

Autoridades conservadas: Auth/afiliado efectivo; affiliate_documents/private_assets/Storage privado; request_documents para evidencia histórica; affiliate_files para fotografía. La respuesta confirmada del servidor puede actualizar la proyección de pantalla; ningún fallo autoriza un fallback de datos. Sin cambios en reglas financieras, RLS, permisos, diseño, navegación, datos reales, purgas ni recuperación masiva.

Orden: (1) fiabilidad y proyección de éxito confirmado, (2) solicitudes/reutilización/diagnóstico e idempotencia, (3) rendimiento sólo con garantías demostradas. No importar todos los candidatos anteriores. Los fallos históricos ya corregidos en producción se reproducen como regresión, no justifican otro parche.

Verificación: nueve recorridos solicitados con datos sintéticos; cambios de identidad y aislamiento; V1/V2 e historial; errores de lectura frente a vacío real; pérdida de respuesta/reintento; vista móvil y perfil. Comparar estructura/controles antes/después. No certificar dispositivos físicos mediante mera emulación. Publicación sólo de componentes probados, con reversión por commit/artefacto y readback.

Riesgos: respuestas tardías tras cambio de contexto, registro exitoso seguido de recarga fallida, versiones sustituidas concurrentemente y alteración administrativa de bytes. No retirar verificación física sin demostrar inmutabilidad en todas las rutas autorizadas. Riesgo visual controlado: conservar nodos, estilos, navegación y botones existentes; sólo estados/progreso/mensajes autorizados.

Recuperación: commits separados por prioridad; revertir fuentes y regenerar artefactos, o restaurar artefacto Edge previo verificado. No revertir datos documentales ni referencias históricas.

Dependencias directas incluidas en el alcance autorizado: `app/renta-car.jsx` y `app/screens-program-product-payment.jsx` consumen los mismos recibos documentales y requieren las mismas barreras de contexto/error; `supabase/functions/_shared/document-integration.mjs` aporta únicamente la fase segura de error a `financial-legacy`. No se cambian reglas de esos productos ni se despliegan otras Edge Functions. La revisión independiente confirmó que estos tres nombres faltaban en esta declaración, no en el alcance funcional autorizado.

Validación focal: contexto 4/4; confirmación 10/10; recuperación 4/4; miniatura 3/3; consumidores 50/50; diagnóstico financiero 18/18; Admin 9/9; perfil 24/24 y navegador perfil 6/6; SQL sintético 8/8. Navegador móvil sintético: Chromium 7/7; WebKit 6 PASS y 1 BLOCKED por render PDF nativo en Windows (mismo límite en baseline); URL, MIME y bytes del PDF verificados. No equivale a Safari/iPhone físico.

Las cuentas ACCOUNT_A, ACCOUNT_B y ACCOUNT_C se verificaron únicamente en lectura: vínculo Auth/afiliado activo confirmado, respectivamente 9, 6 y 6 documentos actuales, sin anomalías de referencia/estado/tamaño/hash en metadatos. No se usaron sus credenciales, se descargaron sus bytes ni se enviaron solicitudes. Esta comprobación no certifica elegibilidad financiera ni el recorrido real de esos usuarios.

Límites conservados: no se elimina la verificación física de bytes porque la inmutabilidad de todas las rutas administrativas no está demostrada; los agregados de Admin conservan la última consulta hasta su actualización normal. La prueba estática histórica `test-admin-affiliates.js` falla en una expresión regular sobre Finanzas que también falla en la base oficial; ese archivo no se modifica. La suite global y el readback publicados constan al final.

Incidencia del entorno: el disco local quedó sin espacio al copiar el sitio. Se retiraron exclusivamente directorios `pgdata` sintéticos creados por esta tarea, con rutas verificadas dentro del worktree y sin `postmaster.pid`; se conservaron scripts, resultados y logs. El paquete público se reconstruyó correctamente con 34 archivos. Ninguna base ni archivo de producción se tocó.

Regresión CI: el test histórico de Membership esperaba la llamada RPC anterior a DOCUMENT_V1 y fallaba también en f6cfae3, antes de esta corrección. Se ajustaron exclusivamente `test-membership-payment-contract.js` y el selector de mutación de `test-program-request-finance-block-contract.js`: ahora se exige el SHA íntegro del repository aprobado, sin omitir escritores, y se conservan 14 comprobaciones de comportamiento y 5 mutaciones. No se cambia el repository, el workflow CI, Google ni reglas financieras.

Registro cronológico de preparación y publicación:

- 2026-11-11 01:30–01:34 UTC: SQL sintético 8/8 y build de 177 fuentes, hash bundle `5fa7f080018bc4941eb890140f5a54cd5bd1c9fcc79f9f2080c17b011c43781e`.
- Regresión global oficial contra producción anterior: PASS, incluido PDF legítimo, foto, Admin, catálogo, préstamo, Membership, fullscreen, refresh y con/sin service worker. El campo estático `productionDataMutations:0` del harness no es medición de escrituras; se inspeccionó el recorrido para excluir cargas y solicitudes, permitiendo actividad Auth/auditoría de acceso normal.
- Prueba local inicial: FAIL por OPTIONS 403/CORS del puerto 4187; no es fallo de timeout. Se comprobó que `http://localhost:8080` ya está autorizado y se repite allí sin cambiar infraestructura.
- 01:56:34 UTC: compilación remota `bundleOnly` de financial-legacy PASS; versión 76 y ESZIP originales intactos. La primera revisión automática había omitido la autorización de publicación del adjunto; tras aportar citas y demostrar el mismo proyecto/destino, aprobó la misma operación. No hubo despliegue en ese paso.
- Revisión de evidencia: 53 archivos sin JWT, enlaces firmados ni identificadores de las cuentas reales solicitadas. Originales y correspondencia de aliases permanecen locales en carpeta ignorada.

Commits reversibles de fuentes: `e5677f9` fiabilidad; `4e77cbd` diagnóstico/recuperación de solicitudes; `245c297` expiración de miniaturas; `626a3c5` artefactos/pruebas; `19393df` reparación de pruebas CI históricas. Para revertir una prioridad, revertir su commit de fuentes y regenerar bundle/transferencia con las mismas dependencias existentes, incrementando el cachebuster; no restaurar datos. Para volver íntegramente al cliente anterior, restaurar los artefactos de f6cfae3 mediante un commit de reversión normal. Edge dispone de ESZIP original verificado y helper de restauración con guardas de versión/hash; no ejecutar migraciones.

- 01:59:26 UTC: global oficial del candidato PASS en `localhost:8080`, mismo bundle y caché `sutiapp-v2026111005`; foto, Admin, PDF legítimo, préstamo, Membership, catálogo, Marketplace, fullscreen, refresh y con/sin SW pasan. Origen previamente permitido, sin interceptar producción, alterar assertions ni modificar CORS. Evidencia `global-local-authorized.json`.
- PR de publicación: https://github.com/David14081982/SutiApp-private/pull/12; fusionado sin omitir checks ni forzar push. Evidencia final a continuación.

Diagnóstico de referencias históricas: `94F44E7F` es un error 42501, con evento `DOCUMENT_NOT_CURRENT` temporalmente correlacionado; no hay un identificador común suficiente para demostrar qué rama exacta lo causó. Se conserva la validación de versión/dueño/asset y se corrige su clasificación y recuperación de UI. `51B6192A` y `07AD634A` son errores P0001 temporalmente correlacionados con `PHYSICAL_ASSET_NOT_VERIFIED`; la llamada SQL prematura ya estaba corregida en la versión publicada del 9 de noviembre, confirmada nuevamente mediante catálogo de solo lectura. No se duplicó esa migración. Ninguna de estas referencias es un folio.

Hallazgos adicionales, sin tocar: falta certificar inmutabilidad de todas las rutas administrativas para sustituir comprobaciones físicas; PDF en Safari físico no validado; prueba estática Admin histórica pendiente de adecuación fuera de este cambio. No se purgan objetos, no se recuperan operaciones históricas y no se modifican expedientes reales. Los harness SQL/navegador requieren las dependencias locales documentadas, no se presentan como portables a un runner limpio sin preparación.

## Resultado publicado

PR12 fusionado en `53eaca73d0f7fada6b9886bb40e48e6cee01a050`, con CI del head `3ddfbc9` aprobado (run 42943267347). Pages run 42943407158 y contrato Membership del merge 42943406998: SUCCESS. `financial-legacy` v77 publicado a las 02:04:33 UTC del 11/11 (19:04:33 de Hermosillo del 10/11); verificación a las 02:04:35. ESZIP `2a6d875476edc7695fecdbe4e2187928a8a5e1bccb683c4011a8d83e06813a62`, diez fuentes y configuración conservadas. Document-operation sigue v12 y document-access v28; todas ACTIVE y verify_jwt=true. No se publicaron migraciones ni cambios de flags/infraestructura.

Readback público: 10/10 PASS en GitHub Pages y sutiapp.com, con bytes exactos de HTML, bundle, SW y repository de perfil frente a Git; configuración DOCUMENT_V1 conservada. Regresión global después de publicar: PASS con bundle `5fa7f080018bc4941eb890140f5a54cd5bd1c9fcc79f9f2080c17b011c43781e` y caché `sutiapp-v2026111005`; PDF legítimo, perfil, Admin, préstamo, Membership, catálogo, Marketplace, fullscreen, refresh y con/sin SW pasan. Evidencia: `production-readback.json`, `global-production-after.json`, `github-release.json`, `financial-edge-deploy.json`, `financial-edge-verify.json`, `deployment-components.json`.

Los nueve recorridos pedidos están cubiertos por la combinación explícita siguiente, sin presentar simulaciones como acciones reales:

| Recorrido | Evidencia | Entorno |
|---|---|---|
| Afiliado carga y aparece inmediatamente | confirmation, browser-green | UI/código real, datos sintéticos |
| Admin carga y afiliado reutiliza | synthetic-sql, admin-after | PostgreSQL local y UI sintética |
| Afiliado carga y Admin lo consulta | synthetic-sql | PostgreSQL local, permisos reales |
| Renovación de sesión durante carga | context-green, browser-green | JWT sintéticos, código real |
| Reintento sin duplicados | recovery-green, synthetic-sql, browser-green | Transferencia simulada y escritor SQL real local |
| Expediente completo en nueva solicitud | consumer-confirmation-green, browser-green | UI sintética; lectura publicada con cuenta controlada |
| Préstamo con folio y documentos reutilizados | synthetic-sql | Escritor SQL real local; respuesta de confirmación perdida recupera la misma solicitud |
| V2 actual, V1 histórica intacta | synthetic-sql | PostgreSQL local, integridad y aislamiento comprobados |
| Perfil guardado y mostrado | profile-after, profile-browser-after, global-production-after | Escritura sintética; lectura real de foto legítima publicada |

No se ejecutaron cargas ni solicitudes reales para probar, ni recuperación de las 65/82 operaciones ni purga de los 232 objetos. Las consultas de las tres cuentas solicitadas validan vínculos y metadatos, no garantizan préstamos aprobables ni ausencia de cualquier error futuro. No se midió p95 de cargas productivas; no se afirma una mejora porcentual de velocidad. Se eliminó la segunda consulta obligatoria después de la confirmación y se preservaron las verificaciones físicas necesarias. No hubo reversión.

```text
H-DOCUMENT-FLOW-SURGICAL RESULT
Status: BLOCKED (sólo certificación integral de PDF en Safari físico); implementación y publicación verificadas.
Files changed: PR12; fuentes de fiabilidad, errores de solicitudes, miniaturas, artefactos, pruebas y evidencia, separados por commit.
Source-of-truth verdict: PASS; mismas autoridades PostgreSQL/Auth/Storage; recibos confirmados sólo proyectan la UI.
Invariant verdict: PASS; idempotencia, versiones históricas, hash, disponibilidad y aislamiento conservados en pruebas.
Build: PASS; 177 fuentes; paquete público y hashes desplegados comprobados.
Tests: PASS focal/conjunta/SQL/CI/global antes y después; WebKit 6 PASS + 1 BLOCKED por PDF nativo Windows.
Security: PASS en alcance; sin cambios RLS/Auth/grants; backend conserva autorización e integridad.
Legacy impact: sin cambios de reglas financieras, Google ni datos históricos.
Unexpected files changed: ninguno publicado fuera del alcance declarado; artefactos temporales locales excluidos.
Known limitations: Safari físico; ausencia de cargas/préstamos reales de afiliados; harness locales requieren dependencias existentes; prueba estática Admin previa sin tocar.
Evidence: docs/qa/evidence/document-flow-surgical/ y document-flow-surgical-20261110/.
```
