# Sutiapp — constitución del repositorio

Este archivo gobierna todo cambio. Los detalles normativos están en [`docs/`](docs/); ante contradicción, detenerse y registrar `DECISION REQUIRED`.

## Protocolo obligatorio

Toda H pasa por `AUDIT → AUTHORITY → PLAN → RISK → IMPLEMENT → VERIFY → EVIDENCE`. Antes de cambiar, usar `pre-change-audit`; para datos, `source-of-truth-guardian`; después, `post-change-verification`. Usar además los guardians de migración, Google legacy o Supabase cuando apliquen.

Para toda implementación, corrección, auditoría o modificación, activar automáticamente `sutiapp-architecture-navigator` antes de los guardians: interpretar feature → consultar `docs/architecture/SUTIAPP_ARCHITECTURE_REGISTRY.json` mediante el lookup → verificar freshness → inspeccionar código/schema dirigido → aplicar guardians → implementar/verificar → actualizar el Registry solo si cambió arquitectura. El propietario no necesita pedir el Navigator. Si la feature falta, está stale, carece de evidencia o contradice el repo, hacer discovery técnico dirigido sin solicitar permiso rutinario e incorporar únicamente hallazgos demostrados. El Registry es un índice derivado y jamás prevalece sobre código, schema, RLS o autoridades documentadas. Mantener este trabajo interno sin burocracia visible salvo riesgo, contradicción o decisión relevante.

Toda H que toque una pantalla existente debe usar `claude-ui-preservation-guardian` antes del cierre. Migrar datos no autoriza simplificar, eliminar ni rediseñar la experiencia Claude Design; los datos aún no conectados conservan su componente mediante estados explícitos.

Toda H que modifique `AssetRepository`, `DocumentWorkflowRepository`, `app_assets`, `private_assets`, políticas Storage, URLs firmadas, `app/bundle.js`, `sw.js` o el viewer compartido debe ejecutar `scripts/test-global-image-regression-production-live.js` contra el build local y GitHub Pages. No puede declarar `PASS` si sello/Login, foto de perfil, Admin Afiliados, documentos imagen/PDF, Membership, Préstamo, catálogo de programas/galería, Marketplace, fullscreen, refresh o la comparación con/sin service worker no quedan `PASS` con assets legítimos y sin reescritura de datos.

Cuando el propietario ordena reproducir completo un diseño Claude aprobado, ese diseño define el resultado visual y funcional: todos sus componentes deben existir y funcionar. Preservar arquitectura no prohíbe crear la infraestructura mínima faltante cuando sea necesaria, segura y no duplique autoridad. No se declara `PASS` con componentes `PENDING`, `DISABLED`, `PLACEHOLDER` o `NO_CONNECTED` salvo decisión explícita del propietario.

Después de cerrar una H, usar `sutiapp-architect-reviewer` para contrastar el resultado con evidencia real y generar la instrucción siguiente; la Skill no sustituye la autorización de `task-orchestrator`.

Estados oficiales: `PASS`, `FAIL`, `BLOCKED`, `DECISION REQUIRED`, `NOT APPLICABLE`.

## Reglas no negociables

1. Existe una sola fuente autoritativa por dominio; no inventar otra ni cambiarla sin decisión documentada.
2. Prohibidos los fallbacks productivos no autorizados. Un fallo debe ser visible y controlado, nunca sustituido silenciosamente con mock, `DATA`, JSON, caché o almacenamiento del navegador.
3. Mocks y fixtures son exclusivos de entornos aislados y nunca autoridad productiva.
4. Ahorro, Préstamos, Google Sheets, Apps Script, fórmulas, triggers, conciliaciones y cálculos financieros son legacy protegido; no tocarlos sin auditoría y autorización.
5. No eliminar ni alterar datos históricos para resolver inconsistencias.
6. No modificar archivos fuera del alcance declarado; ampliar primero la auditoría.
7. Toda modificación de datos identifica dominio, autoridad, lectores y escritores.
8. Toda migración es reversible o declara backup y recuperación verificables.
9. Una hoja no equivale automáticamente a una tabla; un dato calculado no equivale a un dato maestro.
10. Seguridad real se valida en backend/RLS; la UI no es seguridad. Nunca exponer secretos ni `service_role` en frontend.
11. `numero_control` es el identificador histórico de negocio; email no lo sustituye y un usuario puede existir sin Auth.
12. La futura impersonación separa siempre `actor_real` de `usuario_contexto`, sin contraseña del afiliado.
13. Toda H deja evidencia verificable de build, tests, invariantes, autoridad, seguridad, legacy y archivos inesperados.

## Mapa normativo

- Arquitectura y adaptadores: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Autoridades: [`docs/SOURCE_OF_TRUTH.md`](docs/SOURCE_OF_TRUTH.md)
- Invariantes: [`docs/INVARIANTS.md`](docs/INVARIANTS.md)
- Gobierno de datos y borrado: [`docs/DATA_GOVERNANCE.md`](docs/DATA_GOVERNANCE.md)
- Migraciones: [`docs/MIGRATION_RULES.md`](docs/MIGRATION_RULES.md)
- Google legacy: [`docs/LEGACY_GOOGLE_SYSTEMS.md`](docs/LEGACY_GOOGLE_SYSTEMS.md)
- Seguridad: [`docs/SECURITY_RULES.md`](docs/SECURITY_RULES.md)
- Decisiones: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Auditoría inicial: [`docs/INITIAL_REPOSITORY_AUDIT.md`](docs/INITIAL_REPOSITORY_AUDIT.md)
- Evidencia de agentes: [`docs/AGENT_CHANGELOG.md`](docs/AGENT_CHANGELOG.md)

## Cierre de cada H

```text
H-XXX RESULT
Status:
Files changed:
Source-of-truth verdict:
Invariant verdict:
Build:
Tests:
Security:
Legacy impact:
Unexpected files changed:
Known limitations:
Evidence:
```
