# Responsabilidad granular por sección — contrato de seguridad

Estado: `ALL 11 SECTIONS ENFORCED`  
H: `H-MASTER-REM-NEWS-001`

## Autoridad y límites

La autorización técnica vigente continúa exclusivamente en `admin_roles`, `admin_role_permissions`, `admin_assignments` y `has_admin_permission`. La responsabilidad editorial es una autoridad adicional y acotada en `admin_section_definitions` + `admin_section_responsibilities`; nunca se deriva de afiliación, puesto, sindicato, `numero_control`, segmentación ni email persistido.

El email sólo sirve para resolver una vez un principal confirmado y único de Supabase Auth; cero o múltiples coincidencias fallan de forma explícita. La asignación durable usa `auth.users.id`. Un administrador no puede asignarse ni revocarse capacidades a sí mismo. Toda asignación o revocación exige `authorization.write` en backend y deja `actor_real` en `admin_audit_log`.

## Acciones

`read`, `create`, `update`, `delete`, `publish`, `order` y `assets` son capacidades distintas. Ninguna implica otra. La UI puede ocultar controles, pero RLS/RPC/trigger es la barrera real.

## Fronteras compartidas

| Sección | Autoridad de datos | Regla obligatoria de enforcement |
|---|---|---|
| Educación | `educational_resources` | Sólo filas `resource_kind='education'`; cambiar tipo exige autoridad sobre origen y destino. |
| Tutoriales | `educational_resources` | Sólo filas `resource_kind='tutorial'`; nunca hereda Educación. |
| Empresas | `companies + company_assets` | Puede mantener ficha/directorio; no recibe beneficios o audiencia. |
| Convenios | perfiles, beneficios y audiencia de empresa | `companies` es lectura; no puede editar nombre, logo ni estado base. |
| Noticias | `news_articles + news_settings` | `publish`, `order` y `assets` se validan por columnas cambiadas. |

## Activación fail-closed

Toda definición nueva nace `DESIGN_ONLY`. En ese estado, `has_section_action` devuelve `false`, el RPC de asignación responde `SECTION_NOT_ENFORCED` y el contexto Admin no expone la sección. ADR-047 completó el gate reutilizable para Noticias, Educación, Tutoriales, Empresas, Convenios, Banners, Popups, Documentos, Minutas, Programas y Marketplace. Cualquier sección futura debe:

1. sustituir policies amplias por policies separadas por operación;
2. añadir trigger/RPC que compare `OLD/NEW` para distinguir contenido, publicación, orden y assets;
3. preservar `record_origin` y negar borrado histórico;
4. aislar rutas de Storage por sección antes de habilitar `assets`;
5. adaptar `AdminRepository` para consultar `get_admin_access_context` y exigir la acción exacta;
6. probar principal técnico, responsable, segundo usuario normal y anónimo;
7. sólo entonces cambiar esa sección a `ENFORCED` en la misma transacción.

No se autoriza un cambio global a `has_admin_permission`, policies `FOR ALL`, paths genéricos de Storage ni equivalencias `.write → CRUD`.

## Piloto productivo Noticias

`20260823000400` establece la foundation UUID y `20260823000500` activa exclusivamente `news`. Las correcciones estrechas `00501`/`00502` fijan tipos RPC y permiten únicamente el rol verificado `service_role` como frontera backend; no amplían acceso autenticado.

- La asignación se resuelve por email confirmado pero persiste `auth_user_id`; revocación y reasignación quedan auditadas.
- RLS separa `SELECT/INSERT/UPDATE/DELETE` y los triggers comparan `OLD/NEW` para exigir exactamente `create`, `update`, `delete`, `publish`, `order` o `assets`.
- Assets de responsables usan `news/<auth.uid()>/...`; no existe path compartido ni acceso a otros módulos.
- La UI principal administra asignaciones. El responsable ve únicamente Noticias y sólo los controles correspondientes a sus acciones.
- `record_origin` es inmutable y el borrado permanece limitado a contenido administrativo permitido; los históricos no se convierten en fixtures.
- La matriz reversible principal/responsable/normal/anónimo, aislamiento entre dominios, revocación inmediata/nueva sesión, reflexión pública, navegador real, auditoría, cleanup y recovery completo terminó `PASS`.

## Recuperación

La migración base es aditiva y su recovery elimina únicamente sus funciones, policies y tablas. Como no reemplaza policies de contenido ni concede writers, la recuperación no toca contenido, roles técnicos o históricos. Cada futura migración de enforcement debe incluir la restauración textual de todas las policies/grants/triggers que sustituya.

## Clasificación del artefacto anterior

`20260823000200_section_ownership_and_public_reads.sql` es `REJECTED / DO NOT DEPLOY`: mezcla lecturas públicas con ownership, guarda email como clave operativa, agrupa acciones en `.write`, fusiona responsabilidad con `has_admin_permission` y tiene recovery incompleto. `scripts/apply-master-remediation.py` queda como tombstone fail-closed y realiza cero escrituras.
