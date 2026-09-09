# SUTIAPP ARCHITECT REVIEW

Task: H-FINANCE-REQUESTS-CONFIRMATION-NOTIFICATIONS-UX-001.
Verdict: OWNER_DECISION_REQUIRED. No aprobación de la H completa.

Revisión local por inspección de fuentes/diffs contra respaldo, SQL, pruebas y artefactos; no se presenta como revisión de un segundo agente.

## Hallazgos

- UX contextual preserva seis bloques sensibles, writers financieros y el workflow. El lock síncrono protege envío; éxito requiere readback. Rechazo y cancelación usan advertencia y no ejecutan confeti.
- El historial sigue usando operationsStore y resolución Supabase. Prueba de pantalla/store/timeline real con RPC aislado confirma cambio de etapa/estado y fecha/hora.
- La notificación deriva del UUID de evento existente. El acuse atómico con PK evita repetición entre pestañas/dispositivos. Marketplace conserva su autoridad previa para aprobación de cotizaciones.
- RPCs self-only, grants explícitos, tabla con RLS forzada y sin acceso directo browser. SQL forward/recovery y seguridad se probaron con rollback, sin modificar solicitudes ni bitácora.
- No se ha aplicado la migración: los avisos nuevos y el confeti del afiliado están probados como candidato, no como función activa en producción.
- Pruebas de imágenes sobre local y GitHub Pages PASS, incluidas fotos/documentos/PDF/SW; GitHub Pages es la base anterior. No constituyen evidencia de publicación nueva.
- Test textual `test-admin-financial-requests-workbench.js` FAIL preexistente confirmado contra el respaldo previo. No se alteró para simular PASS.
- `WORK_QUEUE_HISTORY.md` no existe. `WORK_QUEUE.md` es el plan MASTER histórico; no autoriza escrituras financieras de prueba. Esta H usa la solicitud explícita del propietario y cero mutaciones productivas de negocio.

Source of truth: SAFE para candidato; Supabase, sin DATA/storage/fallback.
Architecture: adición mínima para acuse durable; sin nuevo workflow ni reglas.
Security: PASS transaccional; despliegue pendiente.
Data: eventos inmutables; recovery conserva acuses; sin backfill.
Legacy: writers/cálculos/Google intactos.

# OWNER DECISION REQUIRED

Decision: habilitar infraestructura Web Push o dejarla fuera mediante decisión explícita.
Why it matters: faltan suscripciones, VAPID y emisor backend; no es posible certificar Push con infraestructura inexistente.
Option A: integrar Web Push en la PWA, configurar claves VAPID/contacto backend y verificar entrega real después del commit con deduplicación.
Consequence: amplía service worker/backend y requiere prueba de suscripción/dispositivo antes de publicar.
Option B: aceptar publicar la UX y notificaciones internas, dejando Push pendiente.
Consequence: modifica explícitamente la aceptación original; no se puede inferir por silencio.
Recommendation: resolver A/B; conservar el candidato y su recuperación. No publicar ni marcar todo PASS antes de resolver.

Owner decision: YES.
Next action: recibir decisión Push; completar únicamente esa rama, aplicar migración tras los gates, regenerar cachebusters y verificar publicación cuando proceda.
Response generated for Codex: NO (falta decisión del propietario).
