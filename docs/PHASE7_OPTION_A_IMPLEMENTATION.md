# PHASE 7 — Opción A, implementación del adaptador seguro

Status: PAUSED — OWNER PRIORITY SHIFT

## Alcance implementado

- Edge Function `financial-legacy` autenticada, con CORS allowlist y respuesta `no-store`.
- Identidad derivada en backend mediante afiliado efectivo; payloads con cualquier campo ajeno al contrato se rechazan, por lo que `numero_control`, `affiliate_id` y `auth_user_id` enviados por el browser no son aceptados.
- Operaciones read-only `overview` y `quote`; la respuesta debe devolver el mismo `subject_numero_control` para evitar mezcla upstream y el contrato de quote exige tasa, pago, total y periodicidad provenientes de Google. El identificador se elimina antes de responder al browser.
- Repositorio/store frontend solo en memoria, sin caché persistente.
- Simulador de Préstamos conserva el shell/stepper/tarjetas Claude, pero no calcula nada. Solicitudes y CRUD financiero Admin quedan bloqueados.
- Rutas locales `DATA`, `financeStore/localStorage`, `fundsStore`, `FUNDS_SEED` y `finCatStore` dejaron de ser autoridad financiera. Los módulos Admin prototipo de solicitudes, flujos, fondos y catálogo financiero se retiraron del bundle; el menú ya los mantenía bloqueados por falta de permiso/repositorio seguro.

## Configuración operacional pendiente

Secrets server-side requeridos: `FINANCIAL_LEGACY_API_URL`, `FINANCIAL_LEGACY_API_TOKEN`, `ALLOWED_APP_ORIGINS`. El Apps Script debe implementar el contrato documentado y filtrar exactamente por el `numero_control` enviado solo por la Edge Function. No hay endpoint ni credenciales disponibles en el repositorio; no se inventaron.

Antes de activar producción se deben comparar casos reales de distintos sindicatos, categorías, programas, tasas, plazos y montos. Una diferencia bloquea la activación del simulador, no el resto de SutiApp. Las escrituras requieren auditoría separada de writer, triggers, autorización, conciliación y doble escritura.

## Legacy impact

Google fue consultado read-only durante la auditoría. No se modificaron hojas, Apps Script, fórmulas, triggers, tasas, saldos, pagos, amortizaciones ni conciliaciones. No se creó schema financiero Supabase.

## Verificación 2026-08-22

- Bundle reproducible: `PASS`, 66 fuentes, Babel standalone fijado localmente; `node --check app/bundle.js` pasó.
- Regresiones estáticas Phase 1–7: `PASS`.
- Multiusuario remoto existente: `PASS`, 3 sesiones, lecturas aisladas, escrituras normales denegadas, 0 registros inventados.
- Chrome real Phase 7: `PASS`; estado pendiente controlado, cero montos mock, cero tasa local y cero solicitudes directas a dominios Google/Glide.
- Regresión Chrome Phase 6: la primera ejecución detectó una carrera entre bootstrap empresarial y `retry()` Admin que podía dejar la proyección en 0 empresas. Se serializaron ambas cargas sin tocar datos; la repetición pasó con 0 planes y 33 empresas.

## Revisión arquitectónica

Verdict: `NEEDS_FIX` para cierre productivo de Phase 7. La implementación local de la frontera es segura, pero faltan despliegue/configuración del Apps Script, secrets/orígenes de la Edge Function y matriz Google↔SutiApp con casos reales. No existe `OWNER_DECISION_REQUIRED`: Opción A permanece resuelta y no se reabre.

Next instruction: obtener del sistema legacy autorizado el endpoint Apps Script read-only y su secreto; configurar/desplegar `financial-legacy`; ejecutar pruebas A/B de identidad efectiva y comparar casos reales por sindicato, categoría, programa, tasa, plazo y monto. Ante cualquier diferencia, mantener simulación/escritura deshabilitadas y corregir el adaptador sin copiar fórmulas al browser.

## Handoff financiero posterior — ejecución autorizada 2026-08-22

Se añadió la pestaña técnica aislada `SutiApp Financial Handoff` al final de `SutiApp Final`, con 16 columnas mínimas, encabezado congelado y cero fórmulas. Ninguna de las 98 pestañas previas fue objetivo de escritura. El receptor Apps Script versionado valida secreto, contrato, UUID y estado; toma `LockService`, busca coincidencia exacta y escribe una sola fila únicamente si el UUID no existe.

La Edge Function desplegada añade `handoff`: autentica, resuelve afiliado efectivo/`numero_control`, consulta por `request_id + affiliate_id` bajo RLS, rechaza solicitudes inexistentes/ajenas/no financieras, invoca Google server-to-server y actualiza solo `financial_processing_status` y `legacy_reference` después de validar la respuesta. El frontend conserva el CTA y la confirmación Claude; un fallo del handoff no invalida ni duplica la solicitud inicial ya registrada.

Evidencia disponible: prueba unitaria Apps Script `PASS` (primer insert 1, retry 0 filas nuevas, secreto incorrecto denegado, no financiera denegada); Edge desplegada; live Auth `401`, inexistente/ajena `404`, no financiera `409`. El proyecto Apps Script ligado y su deployment final versión 3 ya existen. La solicitud financiera válida continúa sin entrega porque, por pausa explícita del propietario, no se configuraron Script Property ni Edge Secrets y no se ejecutó la matriz end-to-end.

Checkpoint de pausa: conservar sin cambios proyecto Apps Script, deployment, pestaña técnica, Edge Function, RLS y código de handoff. Reanudar exactamente desde la configuración segura del secreto compartido. Phase 8 permanece sin iniciar.

Recovery operacional: deshabilitar el Web App o retirar/rotar los secrets detiene entregas nuevas. Conservar siempre `program_requests` y las filas ya recibidas. Al reanudar, el historial reintenta de forma no bloqueante únicamente filas propias aún `pending`; también puede reenviarse el UUID explícitamente. La búsqueda bajo lock permite completar metadata Supabase sin insertar otra fila Google.
