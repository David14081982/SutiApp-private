# H-ADMIN-ACCESS-IMPERSONATION-GLOBAL-PERMISSIONS-001 — evidencia

## Alcance y autoridad

Implementación focal sobre las autoridades existentes `admin_roles`, `admin_role_permissions`, `admin_assignments`, `admin_section_definitions`, `admin_section_responsibilities`, `impersonation_sessions`, `admin_audit_log` e `identity_audit_log`. No se añadieron tablas paralelas de negocio, emails privilegiados hardcodeados, mocks, `DATA`, `localStorage`, Google ni fórmulas financieras.

Las migraciones `20260903000120`–`20260903000122` son aditivas, conservan las definiciones previas de RPC para recuperación y hacen fail-closed si hay actividad legítima posterior. `00121` conserva fecha/asignador originales al revocar y `00122` liga también el cierre manual al permiso explícito y a la misma sesión Auth. El despliegue productivo fue reconciliado con una asignación principal protegida, 11 secciones `ENFORCED` y cero ejecución anónima de las RPC críticas.

## Auditoría de superficies Admin

| Estado | Pantallas |
|---|---|
| `ENFORCED` por permiso técnico + RPC/RLS | Administradores, Roles y permisos, Permisos por pantalla, Tomar control, Afiliados, Datos y respaldos, Solicitudes, Finanzas · Solicitudes, Caja de Ahorro, Fondos y reglas, Catálogo de Finanzas, Programas · Productos, Etapas y seguimiento, Aprobación de Pop-ups, Planes de empresas, Membresías, Tu Sindicato, Catálogos de segmentación, Acceso a pantallas, Secciones y componentes, Menús y botones, Formularios, Ícono e instalación |
| `ENFORCED` por acción exacta de sección + backend | Noticias, Educación/Tutoriales, Convenios, Empresas, Banners, Pop-ups, Documentos, Minutas, Programas institucionales, Marketplace |
| `PARTIAL` | Ninguna dentro del alcance registrado actual |
| `NOT_REGISTERED` | Ninguna de las tarjetas actuales del Panel Admin |
| `NOT_APPLICABLE` | Módulos internos abiertos desde otra superficie que no tienen tarjeta raíz independiente |

El menú móvil, el sidebar de escritorio y el cambio interno de vista eliminan módulos no autorizados. Una vista retenida en memoria se vuelve a validar antes de renderizar. El backend permanece como barrera efectiva; la ocultación no concede seguridad.

## Compatibilidad de identidad durante “Tomar control”

| Clasificación | Superficies | Resultado |
|---|---|---|
| `ALREADY_IMPERSONATION_COMPATIBLE` | Inicio, Perfil, Credencial, Documentos de autoservicio, Historial, solicitudes y rutas que consumen `affiliateView`, `get_effective_affiliate_id` o `get_impersonation_context` | Conservadas; el banner global muestra el afiliado contexto y permite salir |
| `NEEDS_NARROW_ADAPTATION` | Búsqueda global Admin, alta/cierre de sesión, banner y revocación de capacidad | Adaptadas en repository/UI/RPC sin cambiar autoridades de dominio |
| `UNSAFE_TO_ADAPT_NOW` | Favoritos Marketplace ligados directamente al Auth real y cualquier writer de Ahorro/Préstamo no cubierto por su contrato ya auditado | Sin cambio; no se fingió compatibilidad ni se amplió autoridad financiera |

## Matriz focal A–H

| Caso | Evidencia |
|---|---|
| A | Alta por email confirmado crea/reutiliza asignación UUID con rol principal y acceso total |
| B | Usuario sin permiso recibe `42501` al intentar impersonar |
| C | Usuario autorizado inicia una sola sesión ligada a `session_id`, con TTL máximo 30 min |
| D | Auditoría conserva actor real, afiliado contexto, session UUID y motivo |
| E | Salida manual cierra la sesión y restaura identidad efectiva |
| F | Responsable recibe sólo la acción exacta asignada |
| G | Una acción no asignada no escala por UI ni `has_section_action` |
| H | Revocación de capacidad cierra la sesión activa; revocación total retira rol y sección, preserva metadata de asignación y la cuenta principal protegida permanece |

## Verificación

- `python scripts/test-admin-access-impersonation-global-permissions-live.py` antes del apply: `PASS`; forward + recovery compilan, matriz A–H dentro de `ROLLBACK`, persistencia 0.
- `python scripts/test-admin-access-impersonation-global-permissions-live.py --apply`: `PASS`; migración productiva aplicada y reconciliada.
- `node scripts/build-bundle.js C:\tmp\babel-standalone-7.29.0.min.js`: `PASS`; 100 fuentes.
- `node --check app/bundle.js` y sintaxis focal de fuentes: `PASS`.
- `node scripts/test-admin-access-impersonation-global-permissions.js`: `PASS`, 38 contratos focales.
- `node scripts/test-admin-access-impersonation-global-permissions-browser.js`: `PASS` en Chrome real desktop/móvil; tres módulos visibles al principal, 11 definiciones backend, menú limitado a una sección con acción exacta, vista retenida no autorizada cerrada, cero errores de página y usuario normal denegado en ambas RPC sensibles.
- Suite global de imágenes: `NOT APPLICABLE`; no cambian repositories de assets/documentos, Storage, viewer, service worker lógico, routing compartido ni autenticación global. `bundle.js` y cachebusters son artefactos generados.
- Legacy: `NO INTERACTION`; lecturas Google 0, escrituras Google 0, Apps Script 0, fórmulas/tasas/saldos/amortización 0.
