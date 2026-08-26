# H-008 — Auth administrativa real y permisos visuales

## Alcance y autoridad

Supabase Auth autentica al principal. `public.admin_assignments`, `has_admin_permission()` y RLS autorizan las escrituras. El propietario designó exclusivamente a H005_TEST; H005_TEST2 y H005_TEST3 siguen como usuarios normales. Ningún `cargo`, sindicato, puesto o `numero_control` participa en permisos.

## Implementación

- Modelo mínimo: una asignación por `auth_user_id`, rol `visual_admin`, estado y diez permisos explícitos.
- RLS de denegación por defecto para tablas de contenido visual y los buckets `app-assets`, `company-assets` y `documents`.
- Auditoría trigger de escrituras con actor Auth, recurso, acción, target, timestamp y resultado.
- Gate Admin conectado a sesión/asignación real; el gate de contraseña y la autoridad `localStorage` fueron retirados.
- Edición segura de textos, icono, sello, favicon/PWA e imágenes de instalación 1–3 desde `AdminRepository`.
- Los demás módulos muestran su permiso pero permanecen bloqueados hasta tener CRUD Supabase propio; no reviven stores locales.

## Validación real

La prueba reversible inició sesión con los tres alias sin imprimir credenciales. H005_TEST leyó su asignación, modificó/restauró `app_name`, subió un asset temporal, lo relacionó con la posición de instalación 1, verificó dos clientes adicionales y restauró/eliminó el estado temporal. H005_TEST2, H005_TEST3 y anónimo recibieron denegación de escritura. El audit log registró la operación autorizada.

Chrome headless confirmó login normal de los tres alias, Admin habilitado y escritura UI reversible solo para H005_TEST, Admin denegado para H005_TEST2/3, refresh, sesión, identidad normal y logout.

## Límites

La UI avanzada de banners, popups, empresas y documentos no se construyó; H-008 deja su patrón de permisos/RLS listo. Los cambios runtime de branding se propagan por Supabase; manifest y copias PWA estáticas requieren el sincronizador reproducible y un deploy. No se implementó impersonación.

Ahorro, Préstamos, Google Sheets/Apps Script financiero, credenciales de prueba y los 904 candidatos Auth restantes no fueron modificados.

## Revisión arquitectónica

`sutiapp-architect-reviewer`: **APPROVED**. La autoridad, RLS, mínimo privilegio, auditoría, separación Auth/afiliado, continuidad futura de `actor_real`/`usuario_contexto`, recuperación, ausencia de secretos y aislamiento legacy tienen evidencia. No existen `WORK_QUEUE.md` ni `WORK_QUEUE_HISTORY.md`; por tanto, el reviewer no autoriza ni inicia una tarea posterior.
