# H03 ? Implementation

La autoridad sigue siendo get_admin_access_context(), incluidas su delegación savings_context_before_20260906, grants y RLS vigentes. La RPC aditiva get_admin_refresh_context() es STABLE SECURITY INVOKER y agrega siete fingerprints efímeros de versiones MVCC visibles. No agrega tablas, triggers ni escritores y anon no puede ejecutarla.

AdminRepository publica cada respuesta de seguridad; comparte la RPC en vuelo y descarta respuestas de identidades o generaciones anteriores. La identidad incluye actor Auth, sesión, afiliado efectivo e impersonación. AffiliateAuth sólo prima la autorización después del guard existente de resolución stale, pasando la identidad resuelta.

AdminCutoverStore conserva proyecciones sólo mientras la huella visible del dominio siga certificada. Cambios externos, dependencias de assets y pérdida de visibilidad invalidan el dominio afectado; logout, error de autoridad y cambio de sujeto borran las proyecciones pertinentes. Una respuesta de datos anterior no puede repoblarlas. Los errores parciales esperan otra revalidación; no hay loop interno.

El efecto existente de app.jsx permanece byte a byte: intervalo de 30 segundos también en pestaña oculta; focus y visibilitychange revalidan. No se agrega timer/listener. El contenido pendiente se difiere mientras la pestaña está oculta. Las mutaciones y recargas explícitas conservan su contrato de lectura fresca.

La primera carga y un contexto primado sin huellas siguen leyendo contenido. El ahorro 9→1 corresponde a ciclos estables ya certificados; no se promete una sola llamada para login, navegación que carga otro módulo o una edición explícita.

Publicación aislada desde 3029c743871c4a307bc04f0fd655f92690a1dc89: ?nicamente tres chunks funcionales cambian respecto al bundle live. El bundle del workspace contiene además trabajo previo no publicado y se preserva como tal. HTML bundle221 / worker168 sólo cambia referencias, sin lógica de service worker ni markup.

No cambia fuente de verdad, negocio, finanzas, historial, permisos efectivos, RLS, assets, Edge Functions ni pantalla. Las huellas son derivados descartables; no se guardan como autorización permanente ni sustituyen controles backend.
