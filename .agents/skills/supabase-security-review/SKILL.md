---
name: supabase-security-review
description: Revisar todo trabajo futuro de Sutiapp con Supabase, Auth, RLS, roles, policies, Edge Functions, APIs, service_role, Storage o impersonación. Usar en diseño, código y migraciones; bloquear exposición frontend, autorización solo UI, acceso cruzado o elevación de privilegios.
---

# Supabase Security Review

Leer `AGENTS.md`, `docs/SECURITY_RULES.md`, `docs/SOURCE_OF_TRUTH.md` e `docs/INVARIANTS.md`.

Revisar Auth separado de identidad de negocio, RLS habilitado y probado, grants, roles, claims, APIs/Functions, Storage, acceso entre usuarios/organizaciones, elevación de privilegios, secretos, `service_role`, audit logs y mínimo privilegio. Confirmar `numero_control`, usuarios sin Auth y `actor_real`/`usuario_contexto`.

Bloquear secretos o `service_role` en frontend, policies permisivas sin justificación, seguridad solo UI, rol editable por usuario, acceso cruzado no probado o auditoría de impersonación ausente.

```text
SUPABASE SECURITY REVIEW
Scope:
Auth/business identity:
RLS/grants:
Roles/privilege escalation:
Frontend exposure:
Cross-user access:
Impersonation/audit:
Tests:
Verdict: PASS | FAIL | BLOCKED | NOT APPLICABLE
Evidence:
```
