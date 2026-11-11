# ARCHITECT REVIEW

Task reviewed: H-EMPLOYEE-NUMBER-CORRECTION-001, candidato local basado en `36977c57db14e4cbfd485e80ce194e49fd10a2d4`.

Verdict: **APPROVED exclusivamente para la entrega focal local.** La aceptación global y la publicación permanecen **BLOCKED**. Este veredicto no autoriza una migración, un despliegue ni el alta de una persona real.

La revisión final fue de lectura y contraste de fuentes, SQL, diffs, evidencia y capturas. El revisor no implementó los cambios runtime; previamente preparó el fixture de catálogo y ejecutó las regresiones legacy. Por tanto, la revisión es independiente de la implementación runtime, no de la autoría de todos los artefactos de prueba. No se ejecutaron nuevas pruebas ni consultas productivas para esta revisión.

What Codex did correctly:

- La regla nueva usa el número actualmente ocupado en `public.affiliates`, incluidos los afiliados archivados. El historial deja de reservar por sí solo el número. La identidad permanece en el UUID; no se generan números ni se convierten a valores numéricos.
- Sólo cambian cuatro cuerpos SQL existentes. `create_admin_affiliate` sigue siendo una guarda de baseline sin sustitución. Los scripts comparan definiciones, metadata de funciones y bindings del trigger, y ejecutan la sustitución dentro de una transacción con bloqueo de escritores de Afiliados.
- El alta usa el mismo recorte ASCII que `btrim` en preconsulta y escritura, conserva ceros iniciales y presenta mensajes seguros en el espacio de error existente. No agrega secciones, botones, motivos obligatorios ni nuevos registros funcionales de bitácora. La auditoría que ya escribían las RPC sigue intacta.
- La recuperación restaura los cuatro cuerpos capturados. El cotejo independiente de los cuatro literales, normalizando CRLF, coincide con el fixture; la prueba PostgreSQL verifica las definiciones y metadata restauradas. Recuperar código no borra personas, documentos ni asignaciones legítimas realizadas después.

Important findings:

- [database.json](database.json): dos reproducciones previas y 24 comprobaciones posteriores PASS; ejecución final 15:56:00–15:57:31Z del 11 de noviembre de 2026, servicios locales detenidos. READ COMMITTED admite un solo ganador; SERIALIZABLE rechaza al competidor con 40001; REPEATABLE READ rechaza el alta y no persiste una fila. Este último resultado no demuestra progreso mediante reintentos bajo el mismo nivel de aislamiento.
- La integración local verifica cinco objetos anteriores y uno nuevo, bytes/hashes, registro idempotente, RLS y seis lecturas Storage ajenas denegadas entre dos identidades sintéticas. No se transfieren documentos por reutilizar el texto del número.
- [browser-after.json](browser-after.json): 33/33 PASS con pantalla y repository reales, React real y RPC sintéticos. Comparación estructural a 390 y 1440; las capturas móviles también se inspeccionaron visualmente. Estilos y handlers ajenos al alta permanecen iguales.
- [serialization-error-after.json](serialization-error-after.json) es el recibo del build final: 177 bloques, únicamente `screens-admin-affiliates.jsx` cambia, 176 intactos. El recibo anterior se conserva como histórico. Bundle y cachebusters no cambian la lógica del service worker ni activan por sí solos una regresión global de imágenes.
- Se verificaron nuevamente los **19/19 hashes** de [final-manifest.json](final-manifest.json). SHA-256 del manifiesto: `915fe50a267040aa17a97229bd9627e28d0d2965bd6c1550224a9072ea5d3434`.

| Artefacto revisado | SHA-256 abreviado |
| --- | --- |
| Migración preparada | `c16301f865516dbb…7f4bdcc841981834b` |
| Recuperación | `cda83de27330f3e8…71979b1af900ede07` |
| Pantalla | `95b573963595ba79…dd3480e14891f87` |
| Bundle final | `92b124b27cb9fcad…abd70c1c7923d50d7` |
| Resultado SQL final | `bf0b93092a9b65f8…ff7581205818ab0` |

Los hashes completos de archivos constan en el manifiesto. `git diff --check` final terminó correctamente.

Problems detected:

No queda un defecto bloqueante nuevo demostrado en el candidato focal revisado. La regresión ampliada no es completamente verde; se mantienen tres fallos que también ocurren en la base:

1. `test-admin-affiliates.js`: aserción `/const belongsToAffiliate=/`, línea 80. Las aserciones posteriores no se ejecutaron.
2. `test-native-financial-rules.js`: `NATIVE_FINANCIAL_RULES_SCHEMA_DRIFT: get_financial_runtime_rules`.
3. `test-financial-mostrar-override.js`: `available credit includes only eligible shown fund: null !== 10000`.

No se modificaron esas aserciones ni fuentes financieras para obtener PASS. Ocho de diez suites legacy pasaron. Esta evidencia permite distinguir los fallos heredados, no certificar la salud integral de la app.

Architecture implications:

No se agregan tablas, columnas, RPC, grants, dependencias runtime ni autoridades paralelas. El Registry está STALE y se utilizó como índice seguido de inspección focal. Su contenido estructurado no declara una norma de reserva histórica que requiera enmienda; el nombre existente `affiliate_control_reservation_guard` sigue siendo válido. No procede regenerar globalmente el Registry por este cambio de cuerpos.

Source-of-truth implications:

Las adendas de `SOURCE_OF_TRUTH.md` e `INVARIANTS.md` distinguen expresamente el candidato autorizado de la conducta productiva anterior y conservan las decisiones históricas. `public.affiliates` mantiene el número vigente; `affiliate_control_changes` mantiene evidencia inmutable. Los bloqueos existentes `NUMBER_HAS_UNRELATED_RECORDS` y `ACCESS_REPAIR_REQUIRED` no se eluden: alta nueva y corrección de una identidad existente conservan sus contratos distintos.

Security implications:

Permisos reales siguen en las RPC/RLS. La matriz local deniega alta a lector administrativo, afiliado ordinario y anónimo; comprueba aislamiento documental por UUID. Forward/recovery conservan owner, ACL, firma, OID, configuración, volatilidad, seguridad y bindings mediante postcondiciones. Los errores desconocidos no muestran detalles SQL. Ningún secreto o fixture se conecta al frontend productivo.

Data implications:

Instalar o recuperar las funciones no contiene DML de negocio. Las pruebas preservan la identidad y expediente sintéticos anteriores; la recuperación conserva el nuevo afiliado. La comparación productiva de solo lectura existente demuestra metadata/referencias/huellas iguales en sus dos capturas; no descarga nuevamente los cinco archivos reales ni acredita una operación real de alta. El candidato no se aplicó a producción.

Legacy:

[source-integrity.json](legacy/source-integrity.json) verifica 89 fuentes sin diferencias de contenido tras normalizar LF: cuatro idénticas en bytes y 85 con diferencias sólo CRLF/LF. El diff focal no introduce cambios en SICOF, Google ni cálculos financieros. No se ejecutaron acciones Google/SICOF ni se certificó elegibilidad de una cuenta real.

Owner decision required: **NO** para entregar el candidato local ya autorizado. La autorización actual excluye producción; esta revisión no habilita continuar hacia ella.

Recommended next action: incorporar el enlace a esta revisión y el cierre documental, conservar los tres fallos heredados y entregar el resultado local. No iniciar otra H ni una publicación por este veredicto.

Limitaciones: PostgreSQL/Storage local usa identidades y JWT sintéticos; no GoTrue, PostgREST HTTP ni flujo completo navegador→Edge/TUS. El schema-only base es del 6 de noviembre, con los cuerpos focales capturados incorporados; no representa una copia completa actual de producción. `WORK_QUEUE_HISTORY.md` no existe y `WORK_QUEUE.md` no concede continuación automática para esta H. La revisión contrasta las autoridades pertinentes de Afiliados y no es una auditoría nueva de todos los dominios del repositorio.

# RESPONSE TO CODEX

Acepta exclusivamente el candidato local de H-EMPLOYEE-NUMBER-CORRECTION-001 y completa su entrega documental. Conserva el estado global BLOCKED, los tres fallos heredados, las limitaciones de integración y los hashes exactos revisados. No modifiques fuentes financieras, SICOF, Google, datos reales ni componentes ajenos. No apliques la migración, no publiques y no registres personas reales. Esta instrucción no autoriza avanzar a otra H.

SUTIAPP ARCHITECT REVIEW

Task: H-EMPLOYEE-NUMBER-CORRECTION-001.
Verdict: APPROVED para candidato focal local; global/publicación BLOCKED.

Critical findings: ningún defecto bloqueante nuevo demostrado; tres fallos heredados conservados y límites E2E explícitos.

Source of truth: PASS focal, autoridad y UUID conservados.
Architecture: PASS focal, sin nueva infraestructura ni dependencia runtime.
Security: PASS dentro de la matriz local ejecutada; sin certificación productiva.
Data: históricos preservados; producción sin cambios.
Legacy: fuentes intactas; suites ampliadas no completamente verdes.

Owner decision: NO para cierre local.

Next action: entregar candidato y evidencia; detenerse antes de cualquier publicación.

Response generated for Codex: YES.
