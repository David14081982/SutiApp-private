# H-CREDENTIAL-BANK-ISOLATION-001

## Publicación autorizada — 2026-09-11

El propietario solicitó explícitamente publicar, hacer commit y push a main.
Alcance de release: trasladar únicamente las dos líneas de Credencial a un checkout
aislado de origin/main; regenerar sólo ese módulo del bundle y los cachebusters;
añadir prueba/evidencia focal y una entrada focal del changelog. No incorporar archivos
completos modificados de otras H. Verificar diff, pruebas del candidato, gates Pages,
push fast-forward y artefacto servido. Recovery: revert del commit focal, sin datos.
Registry revisado: STALE previo; discovery directo confirma lector/RPC existentes.
Auditoría de release: PASS para proceder con la publicación solicitada.

## PRE-CHANGE AUDIT — 2026-09-11

- Objetivo autorizado: Credencial muestra exclusivamente las cuentas del afiliado efectivo, también cuando el actor tiene permisos administrativos.
- Alcance: `app/screens-credencial.jsx`; `app/bundle.js`, `SutiApp.html` y versiones de `sw.js` como GENERATED_ARTIFACT; prueba focal `scripts/test-credential-bank-isolation.js`; esta evidencia, `docs/qa/evidence/credential-bank-isolation-20260911/`, entrada en `docs/AGENT_CHANGELOG.md` e índices derivados `docs/architecture/` mediante actualización incremental.
- Fuera de alcance: repositories compartidos, Auth, permisos administrativos, SQL/migraciones, Storage, lógica del service worker, datos históricos, escritores bancarios, Google, cálculos y pantallas financieras.
- Authority: `public.affiliate_bank_accounts`; lector existente `BankAccountRepository.listDeposit()` → `list_current_deposit_accounts()`; identidad derivada en backend por `get_effective_affiliate_id()`.
- Causa: `BankAccountRepository.list()` hace SELECT sin scope de afiliado; RLS permite legítimamente a `bank_accounts.read` leer el padrón bancario. Esa consulta administrativa amplia es incorrecta para Mi Credencial.
- Plan: sustituir sólo el lector en Credencial por la RPC self existente y reiniciar el componente bancario al cambiar el UUID del afiliado. Preservar todo el marcado y los writers.
- Riesgo: exposición cruzada con actor admin; datos residuales al cambiar usuario; fallo de fuente. Pruebas con admin, dos usuarios, anónimo, datos incompletos, vacío, error y cambio de contexto.
- Recovery: restaurar exclusivamente el diff de esta H desde baseline privado; no restaurar archivos completos de otros cambios ni modificar filas.
- Status: PASS para implementación focal autorizada.

## TASK ARCHITECTURE CONTEXT / SOURCE OF TRUTH

Navigator: check + lookup `credencial` STALE por cambios previos ajenos al lector bancario. Se verificaron directamente pantalla, repository, migraciones `20260825000200` y `20260830000510`, build y pruebas bancarias existentes.

Dominio: maestro de cuentas bancarias del afiliado. Sin nueva tabla, copia, cache persistente, fallback ni escritor. `save_affiliate_bank_account`, `set_primary_affiliate_bank_account` y `delete_affiliate_bank_account` derivan afiliado efectivo y limitan filas por UUID. Se conserva `numero_control` y la separación actor/contexto. Verdict: SAFE.

Backend: RPC SECURITY DEFINER con search_path vacío; exige Auth y afiliado efectivo; filtra `account.affiliate_id=v_affiliate` incluso para admin; revoca PUBLIC/anon y permite authenticated. La policy administrativa amplia sigue siendo válida para superficies administrativas. Prueba live pendiente antes del cierre.

Legacy guardian: READ ONLY sobre contratos locales relacionados con el lector compartido de Depósito. Cero consulta o escritura Google, préstamos, ahorro, fórmulas o triggers. Sin migración ni cambio de autoridad.

## UI contract

Credencial conserva header, giro de tarjeta/QR, todos los grupos de datos, Datos bancarios, tarjetas enmascaradas, indicador principal, estado incompleto, agregar/editar/eliminar/principal, Sheet, errores/reintento, expediente digital, navegación y scroll. Sólo cambia el conjunto de cuentas leído. La key por UUID descarta filas/editor al cambiar de afiliado.

## Verification / result

- `node scripts/test-credential-bank-isolation.js --build`: PASS. Build Pages local; bundle v251, SW v197. Reemplazo reproducible sólo del módulo Credencial, resto del bundle idéntico byte a byte; HTML/SW sólo versiones, sin cambio de lógica.
- `node scripts/test-credential-bank-isolation.js`: PASS. Chrome 390×844 con módulos compilados reales y fixtures aislados: cuentas propias, máscaras, incompletos, editor, cambio de UUID, vacío, error/reintento y respuesta tardía del contexto anterior. Cero errores de página. La captura es fixture aislado, no evidencia visual de usuarios reales ni comparación pixel-perfect.
- `node scripts/test-credential-bank-isolation.js --live`: PASS. Login administrativo real reproduce SELECT amplio; RPC devuelve 1 cuenta propia y cero ajenas. Dos identidades normales distintas bajo rol authenticated/JWT en backend productivo, transacciones READ ONLY/ROLLBACK: 1 propia cada una, cero ajenas por RPC y SELECT/RLS. Anónimo denegado. Cero escrituras bancarias, de permisos o identidad.
- La contraseña secundaria `H005_TEST2` resultó inválida (HTTP 400). No se reseteó ni alteró Auth: los dos casos normales se probaron como rol/JWT en PostgreSQL, no como logins HTTP. El login administrativo sí fue HTTP real. El primer intento de red sandbox falló; la ejecución con acceso de red autorizado completó las pruebas.
- `node scripts/test-banking-user-maintained.js`: PASS.
- `node scripts/test-loan-deposit-step.js`: PASS; dependencia directa del lector existente, sin tocar finanzas.
- Verificación exacta contra baseline privado: únicamente dos líneas de fuente; marcado UI, estilos, controles, QR, navegación y writers idénticos. `scope.json`: PASS.
- Registry: el intento incremental acotado fue rechazado sin escritura por cambios previos ajenos. No se regeneró: continúan las mismas dependencias pantalla → BankAccountRepository → RPC ya indexada, sin nuevo nodo, ruta, autoridad, permiso ni infraestructura. Se documenta STALE previo y se usa evidencia directa, sin afirmar freshness.
- Regresión global de imágenes: NOT APPLICABLE conforme AGENTS.md; sólo módulo focal y GENERATED_ARTIFACT, sin cambios de repositorios/helpers compartidos, Auth, viewer, Storage, shell o lógica SW.

## DATABASE MIGRATION AUDIT

Domain: lectura privada de cuentas. Authority before/after: affiliate_bank_accounts.
SQL de prueba exclusivamente SELECT, SET LOCAL ROLE/JWT dentro de BEGIN READ ONLY/ROLLBACK. Sin DDL/DML, nuevos constraints, cambios históricos ni migraciones; recovery de datos NOT APPLICABLE. Verdict: PASS para verificación read-only.

## CLAUDE UI PRESERVATION REVIEW

Screen: Credencial.
Original sections / Current sections: credencial/QR; datos del afiliado; Datos bancarios; expediente digital; pie de identidad.
Missing sections: ninguna. Added sections: ninguna.
Interactions preserved: sí, marcado y handlers idénticos excepto ciclo de carga acotado al afiliado.
Navigation preserved: sí. Visual structure preserved: sí por diff exacto; navegador aislado confirma orden/controles.
Unauthorized redesign: NO.
Verdict: PASS.

```text
H-CREDENTIAL-BANK-ISOLATION-001 RESULT
Status: PASS (implementación y build local; no publicado)
Files changed: app/screens-credencial.jsx; app/bundle.js; SutiApp.html; sw.js (sólo versiones); scripts/test-credential-bank-isolation.js; esta evidencia y su directorio; docs/AGENT_CHANGELOG.md
Source-of-truth verdict: SAFE — affiliate_bank_accounts, RPC self existente
Invariant verdict: PASS — UUID efectivo, actor/contexto, datos históricos intactos
Build: PASS — Pages local, bundle v251 / SW v197
Tests: PASS — navegador focal, RLS/RPC live, contratos bancarios y Depósito
Security: PASS — admin self-only, dos afiliados aislados en backend, anon denegado
Legacy impact: ninguno; cero writes o consultas Google
Unexpected files changed: ninguno atribuible a esta H; cambios previos conservados
Known limitations: no publicado; usuarios normales probados con rol/JWT SQL, no password login; Registry stale previo
Evidence: docs/qa/evidence/credential-bank-isolation-20260911/{build,browser,security-live,scope}.json
```

## SUTIAPP ARCHITECT REVIEW

Task: H-CREDENTIAL-BANK-ISOLATION-001.
Verdict: APPROVED para corrección local verificada.

Critical findings: el SELECT amplio era legítimo para Admin pero incorrecto en Credencial. La RPC self ya instalada impone aislamiento en servidor. El diff conserva la experiencia y descarta el editor/estado del afiliado anterior; no concede privilegios ni realiza cambios de datos. El nuevo lector devuelve el mismo tipo completo de fila bancaria y conserva las cuentas incompletas.

Source of truth: conservada. Architecture: reutiliza dependencia/RPC existentes. Security: matriz live PASS con límite de login QA declarado. Data: cero mutaciones de negocio. Legacy: intacto. Se revisaron contratos de autoridad, identidad, permisos, banca y evidencia contra el diff y las pruebas; no se avanzó la cola histórica.

Owner decision: NO para este fix.
Next action: entregar corrección local y evidencia; publicación pendiente, sin ejecutar una H distinta ni publicar los cambios previos del workspace.
Response generated for Codex: YES.

### RESPONSE TO CODEX

Aprobar H-CREDENTIAL-BANK-ISOLATION-001 como corrección local verificada. Entregar el resultado y aclarar que no está publicado. Una eventual publicación debe preparar un diff focal sobre main vigente, conservar cambios ajenos y verificar el despliegue; esta revisión no autoriza ese despliegue ni la continuación de otra H.

## Candidato de publicaci?n verificado

Base remota 57a93f45dc4ff77436cc82e25828aa248c5e3061. Bundle v251 / SW v197.
Build Pages y pruebas del candidato (Chrome aislado, banca y Dep?sito): PASS.
SHA-256 del bundle de release: 9d8e7e2b5a0c2390ae18575e1df3b403ff8eb49f754f7d9ae689d7bd86cb62b0.
Los hashes de build local anteriores corresponden al workspace; release-preparation.json
es la evidencia del candidato sobre main. El diff de fuente y de m?dulo compilado
contiene s?lo el lector self y key de afiliado. Cero cambios a l?gica SW, backend o datos.
Incluye scripts/test-credential-bank-production.js para verificar hash publicado,
login administrativo, cuentas propias, cero lectura bancaria amplia y refresh.
Revisi?n de release: APPROVED. Owner ya autoriz? commit/push/publicaci?n a main.
