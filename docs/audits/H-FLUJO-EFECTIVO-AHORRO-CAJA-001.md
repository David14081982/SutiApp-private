# H-FLUJO-EFECTIVO-AHORRO-CAJA-001

## Alcance y autoridad

Autorizado: consulta mensual de Ahorro Voluntario y préstamos Caja de Ahorro en Admin → Reportes JC → Reporte Flujo de efectivo, doce meses como columnas. Publicación tras pruebas focalizadas. Fuera de alcance: Inversores/consolidado, otros programas, cambios de datos financieros, fórmulas, Apps Script o activadores. Motor PV2 pendiente permanece desactivado.

Se reutiliza la investigación ya concluida. Supabase canónico es autoridad de Ahorro; HISTORIAL P V2 es autoridad de préstamos, con A≤hoy Hermosillo/B corroborado y A>hoy/B programado. C/D identifica contrato y C/D/S cuota; J se cuenta una vez, AE acredita fecha de transferencia registrada cuando es coherente. No usar aprobación/primera cuota como desembolso ni AB/AC/AD legacy como recuperación. Importes sin desglose acreditado se identifican como desconocidos. AR histórico de Ahorro mezcla aportación/rendimiento y se presenta por separado. No reabrir validez de importes de Ahorro ratificados por propietario.

## Plan y archivos permitidos

- Consulta backend complementaria en supabase/functions/reports-jc/cash-flow.mjs y cash-flow-google.mjs, integración mínima de action CASH_FLOW en index.ts; LOAD/TEMPLATE existentes intactos.
- RPC nueva STABLE de consulta get_admin_reports_jc_cash_flow, migration/recovery 20261030000100; sólo SELECT, guard get_admin_reports_jc_context, authenticated. No modificar otras RPC, tablas, datos, RLS ni roles.
- Vista aislada app/cash-flow-report.jsx; enlace mínimo en reports-jc-admin.jsx y método cashFlow en su repository. Mantener ocho reportes y exportaciones originales.
- Build/publicación focal desde main productivo, conservando módulos ajenos y sus bytes; scripts/build-bundle.js sólo lista de fuente nueva. Artefactos bundle/cachebuster derivados no disparan suites globales.
- Pruebas cash-flow de cálculo/seguridad/SQL/navegador, verificación productiva de consulta y evidencia de esta H. Registry sólo mapping de nueva consulta y vista.

Invariantes: cero escrituras financieras, no autoridad paralela/caché productivo, no sumar versiones ni cuotas duplicadas, futuros nunca cobros, desconocido no es cero. Riesgos: cobertura histórica parcial y semántica legacy; se exponen explícitamente sin inventar desgloses. Recovery: retirar nueva vista/acción/RPC, restaurar sólo artefactos de esta publicación sin tocar datos. Skills aplicadas: navigator, pre-change-audit, source-of-truth-guardian, legacy-google-guardian, database-migration-guardian, supabase-security-review, claude-ui-preservation-guardian y post-change-verification.

Estado inicial: investigación focal completada antes del bloqueo de disco; retomada tras propietario liberar espacio. No repetir auditorías históricas ni suites globales.

## Implementación y evidencia

Vista complementaria de 17 conceptos por 12 meses; conserva los ocho reportes existentes. Consulta CASH_FLOW con los mismos permisos y control de contexto de Reportes JC. La RPC nueva es STABLE, SECURITY DEFINER con search_path vacío, accesible sólo a authenticated después del guard existente. No hay DML financiero ni nueva autoridad o captura.

- `node --test scripts/test-cash-flow-core.mjs`: 29 pruebas PASS, fixtures aislados, sin red. Fechas Hermosillo, C/D/S, fondos separados, capital una vez, cuotas duplicadas protegidas, B corregida como sustitución, cifras desconocidas explícitas, autenticación y Google sólo lectura.
- `node scripts/test-cash-flow-savings-sql.js`: 8 verificaciones PASS en PGlite. Reversión preserva tablas y funciones originales. Verificación adicional de equivalencia SELECT/RPC para ambos horizontes: PASS. Sólo se repiten casos cuyo código haya cambiado.
- `node scripts/test-cash-flow-browser.js`: PASS desktop/móvil, doce columnas, ocho reportes originales, detalle y teclado, sesión/contexto, respuestas obsoletas y fallos visibles. Ajustes finales de etiquetas: `--labels-only`, PASS.
- `node scripts/prepare-cash-flow-release.js`: PASS. Candidato aislado desde main `71404ef7fb3c3d1a8da2f825dc7b1a5bf7766b6d`; 171 módulos anteriores conservados byte por byte, dos bloques autorizados modificados y un bloque nuevo. Build Pages y guard de permisos PASS. HTML/service worker cambian únicamente versión de caché. No ejecutar el builder del workspace sucio para publicar.
- Consulta de fuentes reales mediante SELECT equivalente al RPC (conexión read-only) y lector Google: PASS. 20,106 filas consultadas; 499 contratos Caja identificados. No se persistieron filas ni importes individuales en evidencia. Esta comprobación no equivale a despliegue ni prueba de autorización HTTP productiva.

Evidencia: `docs/qa/evidence/cash-flow/` y artefactos privados `.tmp/cash-flow/`. Build, capturas y resultados previos se conservan; no suites globales.

La lectura real identificó 35 inscripciones futuras sin movimientos: su saldo cero válido no debe invalidar el total vigente. Se corrigió únicamente la RPC nueva para tomar el mes actual de `savings_participant_balance`, el mismo lector usado por Ahorro. Dos verificaciones focales adicionales PASS (saldo cero y equivalencia SELECT/RPC); comparación real exacta contra autoridad vigente PASS, unknown_count=0. Los meses futuros no se presentan como saldo recuperado y los cierres históricos incompletos siguen explícitos. Evidencia vigente: `current-balance-focused.json` y `live-current-balance-readonly.json`; esta última sustituye el diagnóstico de saldo actual del primer ensayo, sin repetir el resto.

## Bloqueo previo de publicación — resuelto

La instrucción posterior del propietario autoriza publicar si pasan las comprobaciones. La API de gestión Supabase devuelve HTTP 401 `Invalid access token`; no hay token alternativo en entorno ni sesión CLI. No se aplicó migración, no se desplegó Edge y no se publicó frontend con una consulta ausente. No se cambiaron activadores ni motor PV2.

Para continuar: renovar sólo la credencial local SUPABASE_ACCESS_TOKEN con acceso Edge Functions Read-write limitado al proyecto SutiApp. No transmitirla por conversación. Verificar acceso, respaldar la función existente, compilar Edge, aplicar exclusivamente la migración aditiva, desplegar reports-jc, verificar consulta autenticada/denegaciones y publicar únicamente el candidato aislado. Reversión: restaurar función y artefactos anteriores; eliminar sólo la RPC nueva mediante el archivo recovery. No reejecutar investigaciones o suites ya aprobadas.

## Limpieza temporal autorizada

El propietario pidió eliminar temporales sin uso y continuar en el mismo punto. Se verificaron rutas bajo `.tmp`, ausencia de procesos de tareas y de enlaces/junctions. Eliminados diez cachés npm/sitios estáticos generados y dos clones independientes antiguos limpios, sin commits exclusivos respecto de sus remotos: `push-reopen-release-20261002` y `savings-surgical-release-20261002`. Liberados aproximadamente 413 MiB; 485 MiB libres inmediatamente después. Manifest privado `.tmp/cash-flow/temp-cleanup-20261030.json`.

Preservados originales, respaldos, evidencias únicas, credenciales, dependencias PGlite/pg, trabajo cash-flow y automatización PV2 pendiente. Se excluyó un clon con commit local no publicado. La limpieza no modificó módulos ni datos productivos.

## H-FLUJO-EFECTIVO-AHORRO-CAJA-001 RESULT

Status: PASS en implementación, backend productivo y candidato visual; publicación frontend en curso.
Files changed: vista/consulta complementarias, dos integraciones mínimas en Reportes JC, nueva RPC/recovery, pruebas y evidencia focal; candidato generado aislado. Limpieza temporal separada autorizada.
Source-of-truth verdict: PASS; Ahorro Supabase y préstamos HISTORIAL P V2 conservados, sin fallback ni autoridad paralela.
Invariant verdict: PASS en verificaciones focalizadas; registros futuros, desconocidos y duplicados no se convierten en cobros.
Build: PASS; 171 módulos ajenos preservados byte por byte; no cambios de lógica compartida.
Tests: PASS local/SQL/navegador/lectura real; no suites globales.
Security: PASS aislado y HTTP productivo: administrador autorizado, solicitudes anónimas y token inválido rechazados, esquema inválido rechazado. Usuario ordinario productivo no probado por ausencia de credenciales existentes; guard y permisos originales preservados.
Legacy impact: cero escrituras Google/Supabase financieras, cero Apps Script/triggers, motor amortizaciones desactivado.
Unexpected files changed: NONE en candidato aislado. Workspace conserva cambios previos ajenos sin publicarlos.
Known limitations: desgloses de recuperación de préstamos no acreditados por el legacy permanecen sin determinar; historial Ahorro mixto y fechas incompletas se señalan. Backend desplegado; publicación frontend pendiente de concluir.
Evidence: docs/qa/evidence/cash-flow; .tmp/cash-flow/release-manifest.json y temp-cleanup-20261030.json.

Cierre de limpieza adicional: 18 directorios verificados eliminados; 1505 MiB liberados en total y 1182 MiB disponibles al cierre. Se conservaron clones con cambios no publicados o archivos privados ?nicos. No se ejecutaron nuevas pruebas por la limpieza.

## Continuaci?n autorizada y despliegue backend

El acceso de gesti?n fue restablecido. El bloqueo HTTP 401 anterior queda resuelto; se conserva su evidencia como antecedente. Se respald? la funci?n reports-jc v2 antes de desplegar v3 (JWT obligatorio). Se aplic? exclusivamente la RPC de consulta 20261030000100. Sus cinco dependencias directas conservan definiciones y permisos id?nticos. Sin DML financiero ni cambios de Apps Script/activadores.

Verificaci?n HTTP productiva PASS: dos horizontes de 12 meses, 17 conceptos, saldo actual exactamente igual a Ahorro, 499 contratos Caja identificados; LOAD conserva los ocho reportes y TEMPLATE responde correctamente. RPC administrador 200, solicitudes an?nimas/token inv?lido 401 y esquemas inv?lidos 400. No se dispone de credenciales de usuario ordinario para repetir ese caso en producci?n; la comprobaci?n aislada y el guard existente se conservan.

Candidato visual con backend real PASS: escritorio y m?vil 390 px, 12 columnas, 17 conceptos, valores/estados iguales a la respuesta real y detalle de origen. S?lo los archivos est?ticos del candidato se sirven sobre el origen autorizado para esta comprobaci?n; cero mocks financieros, escrituras o errores de navegador. No se modific? CORS ni la navegaci?n compartida. La publicaci?n final se acredita por separado al concluir GitHub Pages y su comprobaci?n sin overlay.

Evidencia: backend-access.json, preflight.json, edge-compile.json, database-deployed.json, edge-deployed.json, backend-preservation.json, production-http.json y browser-live-candidate.json. Respaldo privado Edge v2 y recovery aditivo disponibles.
