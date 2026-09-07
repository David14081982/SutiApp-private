# H-AUTH-ENTRY-001

## PRE-CHANGE AUDIT

- Objetivo: abrir el acceso normal sin que metadata histórica de activación lo convierta en definición de contraseña; investigar interrupciones de sesión.
- Alcance: `app/affiliate-auth.js`, `scripts/test-h005.js`, `scripts/test-auth-prod-activation.js`, nuevo `scripts/test-auth-entry-browser.js`, artefacto generado `app/bundle.js`, cachebusters de `SutiApp.html` y `sw.js`, este documento, `docs/qa/evidence/auth-entry-20260907/`, entrada aditiva en `docs/AGENT_CHANGELOG.md`.
- Fuera de alcance: cambios preexistentes en Ahorro/afiliados/build/normativa; datos productivos, passwords reales, schema/RLS, SMTP, Google y cálculos financieros.
- Datos afectados: estado efímero de navegación Auth. Supabase Auth conserva sesiones/credenciales; `public.affiliates` conserva identidad de negocio y `numero_control`. Sin autoridad nueva.
- Lectores: AffiliateAuth, AffiliateLoginScreen y shell existente. Escritores: APIs Auth existentes, exclusivamente por acción del usuario; pruebas controladas sin cambios de contraseña ni correo real.
- Invariantes: validación backend de afiliación/roles intacta, sin fallback productivo, conservación de recuperación y activación explícitas, sin reescritura histórica ni secretos frontend.
- Evidencia inicial: navegador nuevo en sutiapp.com muestra login, sin errores JS; `isActivationSession` acepta metadata persistente sin enlace; SIGNED_IN repetido puede desmontar la app al tomar esa rama. El cierre del proceso móvil todavía no se ha reproducido.
- Navigator: Registry STALE por cambios anteriores de Ahorro y artefactos. Discovery dirigido a affiliate-auth, supabase-client, test-h005, pruebas de sesión/recuperación y shell confirma alcance. No cambia route, repository, schema, dependencia ni autoridad: no regenerar índice global ajeno.
- Contrato UI: sello, título, email/password, mostrar/ocultar, activación, recuperación, confirmación, avisos, loading/error y scroll responsive sobreviven. Se agrega salida explícita desde definición de contraseña al login.
- Plan: reproducir metadata antigua y eventos; corregir selección/estabilidad de flujo; verificar controladores, navegador y build; ejecutar regresión global obligatoria local y GitHub Pages.
- Riesgo: autenticación global; carrera de eventos diferidos, recuperación legítima y token refresh. No se atribuyen cierres móviles sin evidencia.
- Recovery: revertir únicamente el diff de esta H y regenerar artefacto, preservando todos los cambios previos; no hay migración ni recuperación de datos.
- Status: PASS (auditoría y autorización de corrección por solicitud del propietario; cierre sujeto a pruebas).

## Guardians

- Source of truth: SAFE; Supabase Auth + public.affiliates mantienen dominios separados, sin fuentes alternativas.
- Supabase security: backend/RLS/identidad sin modificación; metadata y URL seleccionan sólo el formulario, nunca conceden permiso.
- Legacy: READ ONLY para regresión de superficies existente; cero cambios en Google, fórmulas, saldos o datos financieros.
- UI preservation y post-change-verification: pendientes de evidencia final.

## VERIFY / EVIDENCE

Implementación y pruebas focales terminadas; cierre global BLOCKED. Resultado, limitaciones, comandos y revisión en [RESULT](../qa/evidence/auth-entry-20260907/RESULT.md).

Entrega revisable: generar además un candidato temporal desde el bundle publicado/HEAD, sustituyendo únicamente el módulo affiliate-auth y los dos cachebusters. Esto evita incorporar cambios preexistentes de Ahorro. Sus hashes/manifiesto quedan en el directorio de evidencia ya declarado; no se modifica Git ni se publica.

La evidencia posterior añadió dos casos dentro del mismo alcance Auth: PASSWORD_RECOVERY difundido por Supabase a otra pestaña no debe cambiar su formulario; eventos diferidos anteriores a logout/finalización no deben reabrir el flujo. SDK vendorizado confirma `broadcastChannel.postMessage({event, session})`. La rotación real de token conserva revalidación backend, mientras SIGNED_IN del mismo token ya resuelto evita lecturas duplicadas.

## Ampliación autorizada — continuación 2026-09-07

El propietario respondió «corrige lo que tengas que corregir» al bloqueo documentado de credenciales/pruebas/publicación. Continúa la misma H hasta corregir el acceso de QA, verificar y publicar el candidato focal.

- Alcance adicional: restablecer exclusivamente la contraseña de la cuenta controlada designada por H005_TEST_EMAIL a la credencial ya guardada en supabase.env (ignorado). No cambiar correo, UUID, metadata, afiliación, roles, RLS ni ningún otro usuario. Auth Admin API es el único escritor; el secreto jamás se imprime ni versiona. Inspección previa: un principal exacto, email confirmado, una afiliación y una asignación administrativa; metadata de activación false.
- Recuperación: la credencial local previa permanece intacta; si el reset falla no se modifican archivos ni se continúa con otros usuarios. La contraseña anterior del backend no es recuperable en texto; no se afirma rollback de esa contraseña desconocida. El alcance se limita a la cuenta ya designada para pruebas.
- Entrega: worktree temporal limpio desde HEAD/producción; commit focal y push normal a main después de controles. Conservar el worktree original y su trabajo ajeno. Pueden actualizarse el arnés global de imágenes y un nuevo scripts/test-auth-entry-production-live.js si su diagnóstico demuestra defectos de prueba; evidencia dentro del directorio ya declarado.
- Pruebas: login real, estabilidad, regresión global local/Pages, build/contratos y comparación de versión publicada. No escribir datos financieros/documentales para conseguir PASS.
- Status: PASS para alcance/autorización; los resultados finales siguen sujetos a evidencia.
