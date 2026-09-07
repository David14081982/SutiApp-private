# H03 — Guardians

SOURCE OF TRUTH REVIEW

Authority: mismas tablas/RLS productivas y getter protegido vigente. Las huellas y proyecciones son derivados efímeros, ligados a actor/sesión/contexto, sin persistencia de autorización. Un registro eliminado o retirado por RLS invalida su dominio en la siguiente revalidación; no reaparece desde mock, Google o almacenamiento del navegador.
Readers/writers: lectores administrativos existentes; ningún writer nuevo.
Verdict: SAFE.

DATABASE MIGRATION AUDIT

Domain: contexto administrativo y frescura de siete dominios.
Authority before/after: sin sustitución; nueva RPC delegante.
Schema checks: sólo función aditiva sin argumentos, retorno jsonb, STABLE INVOKER, search_path vacío, owner postgres. PK/FK, tablas, índices, triggers y datos históricos intactos.
RLS/security: authenticated/service_role EXECUTE; PUBLIC/anon revocados. Las 48 políticas y los getters protegidos coinciden exactamente con baseline.
Compatibility: frontend anterior sigue funcionando; backend se desplegó primero. Aplicación controlada rechaza una función ya existente para no sobrescribir otra definición. No se ejecutó un db push masivo ni se reaplicaron migraciones históricas.
Recovery: guard de hash/comentario; DROP y recreación probados dentro de ROLLBACK. Restaurar frontend antes de retirar callers de la RPC nueva.
Verdict: PASS.

SUPABASE SECURITY REVIEW

Scope: AdminRepository, primer AffiliateAuth y get_admin_refresh_context.
Auth/business identity: actor Auth, sesión, afiliado efectivo e impersonación separados en la clave de invalidación. Sin modificar numero_control ni exigir Auth para existencia de afiliado.
RLS/grants: matriz backend A–H y normal/anon; igualdad de getter completo salvo campos derivados nuevos. Sin cambios de permisos efectivos.
Roles/privilege escalation: la respuesta de seguridad se publica siempre, incluso con huellas iguales; denegación/error limpia datos y rechaza respuestas antiguas. Backend sigue aplicando cada permiso.
Cross-user access: INVOKER limita las huellas a filas visibles; entrada/salida de impersonación y carreras de sesión probadas con transporte aislado y matriz SQL real revertida.
Frontend exposure: sólo cliente publishable habitual; la sesión JWT sólo aporta una clave de descarte, nunca autorización nueva. No se imprime ni persiste token en evidencia.
Impersonation/audit: funciones, trazabilidad y actor real intactos; no se desactiva auditoría para reducir carga.
Verdict: PASS.

CLAUDE UI PRESERVATION REVIEW

Screen: panel administrativo y consumidores de AdminCutoverStore.
Original sections: menú vigente de 33 módulos para principal, agrupaciones/sidebar, superficies administrativas originales.
Current sections: mismas; igualdad de lista y nodo de menú tras ciclos estables en Chrome, desktop y mobile.
Missing sections: ninguna introducida por H03.
Added sections: ninguna.
Interactions preserved: navegación por controles existentes, formularios, filtros, lecturas y mutaciones explícitas; no se modifica markup ni estilos de pantallas.
Navigation preserved: sí; App y sus listeners/timer originales no cambian.
Visual structure preserved: sólo tres chunks de coordinación cambian respecto al bundle publicado. La regresión global local incluye assets legítimos, documentos/PDF, fullscreen, refresh y SW/noSW; el resultado publicado se registra por separado.
Unauthorized redesign: NO.
Verdict: PASS.

Legacy: READ ONLY sobre la delegación vigente de contexto. No acceso Google, fórmulas, saldos, préstamos, snapshots ni cambios de historial. El fallo estático heredado en Finanzas se documenta, sin alterar ese dominio para satisfacerlo.
