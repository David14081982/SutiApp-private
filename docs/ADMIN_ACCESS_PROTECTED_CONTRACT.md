# Admin Access / Impersonation / Global Permissions — PROTECTED / CLOSED CONTRACT

## Estado protegido

- H de origen: `H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-001`
- SHA aprobado en producción: `b8c1f6c0057dabded90804ffadd5bd012fb41a1a`
- Decisión: `ADR-098`
- Estado: `PROTECTED / CLOSED CONTRACT`
- Alcance: administradores, permisos por pantalla, responsables de sección, contexto de acceso e impersonación.

Este documento congela el comportamiento aprobado. No crea autoridad runtime, permiso, dato ni fallback. Las autoridades Supabase enumeradas abajo siguen decidiendo el estado productivo.

## Contrato funcional cerrado

### Administradores

- El email sólo resuelve una cuenta Auth confirmada y única.
- La asignación durable se persiste por `auth_user_id`.
- El Administrador total obtiene acceso completo conforme al rol principal existente.
- Alta y revocación conservan asignador, fechas y auditoría.
- El Super Admin protegido y el último administrador válido no pueden quedar revocados por accidente.

### Permisos por pantalla

- Las 33 superficies Admin inventariadas se protegen mediante permiso técnico o acción exacta.
- Las 11 secciones backend permanecen `ENFORCED`.
- Una sección admite múltiples responsables y acciones granulares independientes.
- Menú y navegación interna reflejan el contexto, pero RPC/RLS/backend son la barrera efectiva.
- Una responsabilidad nunca concede otra sección ni otra acción.

### Impersonation / Tomar control

- Requiere la capacidad independiente `affiliates.impersonate`.
- Permite buscar e iniciar asistencia sin contraseña ni aprobación del afiliado.
- Conserva `actor_real_auth_user_id`, `usuario_contexto_affiliate_id`, `session_id` Auth y motivo.
- Muestra banner global, permite salida explícita, no admite anidamiento y expira en un máximo de 30 minutos.
- Revocar asignación o capacidad termina la sesión activa y deja auditoría.
- Un administrador sin la capacidad específica, un usuario normal y anónimo quedan denegados.

## Autoridades únicas

- `admin_roles`
- `admin_role_permissions`
- `admin_assignments`
- `has_admin_permission`
- `admin_section_definitions`
- `admin_section_responsibilities`
- `has_section_action`
- `get_admin_access_context`
- `impersonation_sessions`
- `start_affiliate_impersonation`
- `get_impersonation_context`
- `get_effective_affiliate_id`
- `identity_audit_log`
- `admin_audit_log`

No se permite una segunda tabla de administradores, sistema de roles, registro de responsables, flujo de impersonación, catálogo frontend autoritativo ni privilegio hardcodeado por email.

## Migraciones protegidas

| Migración | SHA-256 protegido |
|---|---|
| `20260903000120_admin_access_impersonation_global_permissions.sql` | `16A57C29F39F2CBD4E508E9A99E267381E984E1DAE6C668B846282E88A96FDDC` |
| `20260903000121_admin_assignment_revocation_metadata_fix.sql` | `E48333BE97AAD8C8C7C1A728BED37035D36D5C4513C7DA62B1A5C84D7DDCD56E` |
| `20260903000122_impersonation_stop_permission_binding.sql` | `5FF3833D903AA4DEC373CFC3853D9EFCB3D941085BDD6FEAF94D8855BFABC07F` |

No deben reescribirse ni reemplazarse como autoridad. Un cambio futuro legítimo debe ser aditivo, explicar razón e impacto, preservar los invariantes y aportar recovery y prueba focalizada.

## Gate para futuras H

Toda H que toque roles, administradores, permisos, responsables de sección, impersonación, `get_admin_access_context` o RLS/RPC de autorización debe:

1. Ejecutar `sutiapp-architecture-navigator`, `source-of-truth-guardian` y `pre-change-audit`.
2. Declarar explícitamente el impacto sobre este contrato.
3. Justificar la razón del cambio y demostrar que no introduce autoridad paralela.
4. Ejecutar pruebas focales y `post-change-verification`.
5. No modificar este dominio si la H puede resolverse fuera de él.

## Regression guard focal

```powershell
node scripts/test-admin-access-protected-contract.js
node scripts/test-admin-access-impersonation-global-permissions.js
python scripts/test-admin-access-impersonation-global-permissions-live.py
node scripts/test-admin-access-impersonation-global-permissions-browser.js
```

Las suites globales no se ejecutan por defecto. Sólo aplican si una H futura modifica además una frontera global indicada por `AGENTS.md`.
