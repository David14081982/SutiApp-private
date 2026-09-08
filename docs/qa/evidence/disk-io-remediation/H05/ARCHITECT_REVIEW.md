# ARCHITECT REVIEW

Task reviewed: H05 — optimización de Ahorro bajo Protocolo Maestro.

Verdict: APPROVED.

Revisión separada del cierre, basada en solicitud, baseline, diffs del release 19eb53d→099a40f, definiciones live, hashes, planes, pruebas y artefacto publicado. No se acepta el resumen como sustituto de evidencia. Normativa sin cambios desde H04 comprobada por hashes; changelog posterior leído. WORK_QUEUE_HISTORY.md no existe y task-orchestrator no está disponible; no se infiere autorización para otra fase.

What Codex did correctly: eligió un único índice tras comparar ambos; conservó getter/helper y todos los datos financieros; resolvió repetición mediante validación backend en el mismo snapshot; probó sujeto/sesión/impersonación y descartes tardíos; publicó sólo dos módulos y verificó la regresión global exigida.

Important findings:

1. El índice por fecha reduce más filas en las dos ramas temporales, pero ocupa 2,5 veces más y no cubre el orden de las cuatro lecturas por hoja/fila. B es una elección mínima defendible con medición y equivalencia, no una creación automática de ambos índices.
2. El cache no se autoriza mediante TTL: datos completos, contexto y decisiones temporales entran en la versión; un grafo financiero desconocido obliga a leer el getter original. No hay segunda autoridad ni saldo derivado nuevo.
3. La mejora HTTP correcta es dos proyecciones → una proyección más una validación; las RPC totales siguen siendo dos en esta navegación. El estado vacío aumenta marginalmente bytes; está documentado.
4. Recuperación conserva un endpoint fresco para clientes abiertos. Eliminarlo inmediatamente habría roto esos clientes; el recovery ensayado evita ese problema.
5. El root contiene cambios anteriores de Admin/operaciones; los hashes los preservan y el release no los incluye. La aserción estática del getter se actualiza para comprobar delegación, sin retirar controles de privacidad.

Problems detected: ninguno atribuible a H05 pendiente de corrección. Las limitaciones de host, población real sin Q nulo, fallo estático del workspace no publicado y denegación Requests sin caller atribuido están explícitas; no se presentan como verificaciones superadas de un alcance que no se ejecutó.

Architecture implications: una RPC condicional y una dependencia nueva; Registry actualizado y suite completa PASS. No nuevas autoridades, tablas de cache, timers ni cambios de pantalla.

Source-of-truth implications: ninguna; GOOGLE_LEGACY_AUTHORITY / SHADOW_MIRROR / NOT_CUTOVER conservados.

Security implications: 252 funciones y 228 policies existentes idénticas, matriz backend live y regresión global PASS. El cliente no elige afiliado, concede permisos ni almacena finanzas persistentemente.

Data implications: diez comparaciones completas y 24 tablas con hashes/conteos idénticos; ningún histórico financiero alterado. Identidad de prueba se cerró por el mecanismo auditado existente.

Owner decision required: NO.

Recommended next action: conservar H05 PASS y completar únicamente el registro/publicación de evidencia de cierre. No ejecutar H06 en esta tarea.

# RESPONSE TO CODEX

Aprobar H05. Publicar la evidencia final sin cambiar los dos módulos, SQL ni build ya verificados; comprobar workflow y bytes públicos del commit de evidencia, confirmar Registry FRESH y workspace preservado. Entregar VERIFICATION.md y H05 STATUS: PASS. No avances a otra H.

SUTIAPP ARCHITECT REVIEW

Task: H05
Verdict: APPROVED
Critical findings: ninguno pendiente en H05.
Source of truth: PASS
Architecture: PASS
Security: PASS
Data: PASS
Legacy: intacto
Owner decision: NO
Next action: cierre documental y comprobación de entrega; no H06.
Response generated for Codex: YES
