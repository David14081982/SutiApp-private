# H03 ? Rollback

1. Restaurar primero los seis archivos frontend de la revisión publicada anterior 3029c743871c4a307bc04f0fd655f92690a1dc89 en una entrega aislada: app/admin-repository.js, app/admin-cutover-store.jsx, app/affiliate-auth.js, app/bundle.js, SutiApp.html y sw.js. Usar nuevas versiones de bundle/worker superiores a 221/168 para entregar la recuperación a clientes con caché. No restaurar el bundle previo del workspace, que contiene trabajo ajeno a la versión publicada.
2. Verificar login, autorización, revocación y regresión global. El frontend anterior vuelve al getter original y sus nueve llamadas; no requiere retirar inmediatamente la RPC aditiva. Esperar a que no existan callers de la nueva RPC en clientes abiertos antes de retirarla.
3. Ejecutar supabase/recovery/20260907000300_admin_refresh_context.sql sólo después de retirar esos callers. El guard exige MD5 40c99eff8e19fedb085b205f9406550d y el comentario exacto de H03 antes del DROP. Ante otra definición, detener e inspeccionar.
4. Confirmar getter protegido, owner/grants/search_path y las 48 políticas contra BASELINE.json. No hay filas de negocio que recuperar.

La recuperación SQL se ejecutó realmente dentro de BEGIN/ROLLBACK: guard, DROP, ausencia comprobada, recreación y hash idéntico. La transacción se revirtió y la RPC desplegada permanece. Véase rollback-security-verification.json. No se reiniciaron servicios ni se mataron sesiones.
