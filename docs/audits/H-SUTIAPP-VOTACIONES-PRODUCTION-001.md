# H-SUTIAPP-VOTACIONES-PRODUCTION-001

## PRE-CHANGE AUDIT

- Objetivo: módulo productivo completo con los dos HTML owner como contrato visual.
- Autoridad autorizada: Supabase, sin semillas demo ni almacenamiento browser productivo.
- Navigator: STALE; votaciones ausente. Discovery focal confirma Home en screens-home-r2.jsx, Admin en screens-admin.jsx, identidad get_effective_affiliate_id, segmentación matches_current_affiliate_audience, permisos admin_section_definitions/responsibilities y admin_roles, auditoría admin_audit_log.
- Alcance: nuevos app/voting-repository.js, app/screens-voting.jsx y estilos encapsulados derivados de ambos HTML; conexiones en app/screens-home-r2.jsx, app/screens-admin.jsx; scripts/build-bundle.js; bundle y cachebuster HTML generados; migración y recovery 20260915000200_voting; scripts/voting-* y scripts/test-voting-*; documentación SOURCE_OF_TRUTH, AGENT_CHANGELOG, evidencia docs/qa/evidence/voting-20260915; Architecture Registry derivado.
- Datos: consultas, preguntas, audiencia, votos y folios nuevos; permisos del nuevo módulo; eventos en auditoría existente. Sin modificación de afiliados, Auth, assets ni dominios financieros.
- Lectores: afiliado efectivo autorizado; Admin por acción. Escritores: RPC autenticadas, identidad derivada, permiso y auditoría backend.
- Invariantes: un voto definitivo por pregunta/afiliado; concurrencia protegida con UNIQUE; cero resultados antes de votar; nominal separado; impersonación no vota; histórico preservado por archivo lógico; cierre backend America/Hermosillo; errores visibles.
- UI: tarjeta/acordeón guinda, progreso, Sí/No/Abstención, confirmación sheet, resultados/folio; Admin lista/editor, preguntas reordenables, audiencia, chips, exportaciones y archivo. Tokens owner, texto ampliado, targets 44px, reduced motion.
- Fuera de alcance: legacy Google/Ahorro/Préstamos, datos demo, cambios anteriores del workspace, shared Auth/Storage/viewer/service-worker logic.
- Riesgo: autorización nominal, carreras, mutación de preguntas con votos, publicación accidental de cambios anteriores.
- Recovery: retirar permisos de ejecución del módulo preservando tablas/histórico; migración transaccional; publicación aislada sobre origin/main.
- Verificación: build; una matriz SQL transaccional con ROLLBACK de fixtures; navegador focal con fixtures aislados para estados/controles/tamaños; lectura productiva. Repetir sólo ante fallo/corrección. Revisar regresión global si se cambia lógica compartida.
- Status: PASS para preparación. Aplicación condicionada a evidencia SQL y revisión de seguridad.

## SOURCE OF TRUTH AUDIT

Domain: votaciones. Authority: nuevas tablas Supabase voting_* (autorización explícita owner). Readers/writers: VotingRepository → RPC. Alternative sources/fallbacks/persistent caches: ninguno. Verdict: SAFE para diseño.

## DATABASE / SECURITY

Migración aditiva, FK restrict, UNIQUE, RLS forzada, DML browser revocado; RPC con search_path vacío. Folio UUID backend. Votos inmutables y eliminación lógica. Permiso nominal independiente sin grants implícitos a administradores limitados. Backend por verificar antes de aplicar.

## Scope refinement

- app/voting-design.js y scripts/voting-prepare-design.py extraen CSS/SVG de los HTML suministrados; sin reinterpretar paleta.
- Admin registra entradas focales Votaciones y Votos identificados, con catálogo backend separado. No cambia algoritmo compartido de permisos ni shell/Auth. Por prudencia se ejecutará una regresión global por target al añadir entradas Admin.
- Roles existentes: sólo principal_admin recibe explícitamente los siete permisos nuevos; administradores limitados requieren asignación por catálogo existente. Sin actualización de cuentas ni permisos de otros dominios.

## VERIFY / EVIDENCE

- Migración aplicada 20260915000200; backend.json PASS, misma SHA aplicada. Matriz SQL con ROLLBACK: altas, publicación, voto, duplicado, inmutabilidad, privacidad entre usuarios, permisos, exportaciones, archivo y auditoría. Cero fixtures persistidos.
- security-extra.json: impersonación real iniciada/cerrada dentro de ROLLBACK, voto denegado, tres tablas con RLS forzada. UNIQUE inmediato verifica la garantía contra carreras; no se ejecutó prueba de carga ni carrera productiva.
- browser.json: controles afiliado/Admin, normalización nominal, export CSV segura y tres tamaños. integrated-local.json: login real, RPC nuevas, navegación, ausencia de sección vacía, posición, padding y sheet.
- global-local.json: PASS con assets legítimos, sin escrituras. Primeros intentos se bloquearon por CRLF/SRI del checkout y CORS del puerto aleatorio; corregido entorno usando bytes Git originales y localhost:8080 ya permitido. No se cambió código compartido ni configuración productiva para resolverlos.
- installed.json: migración registrada, cero consultas/preguntas/votos demo.
- Estilos finales permiten reflujo de opciones en Muy grande para evitar partir “Abstención”; cambio CSS exclusivo del módulo, sin invalidar regresión global previa.
- Legacy guardian: atributos canónicos de affiliates sólo para segmentación/identidad. Cero Google, Apps Script, fórmulas, amortizaciones o escrituras financieras. NOT APPLICABLE.
- Publicación: worktree tmp/voting-release sobre origin/main. Fuentes compartidas sólo agregan entradas del nuevo módulo; 120 chunks previos idénticos. Cambios anteriores del workspace excluidos.
- Recovery: revocación de cinco RPC + revert del frontend, conservando schema e histórico. Sin destructivos.
- La revisión final y el resultado productivo se registran en docs/qa/evidence/voting-20260915/result.md.
