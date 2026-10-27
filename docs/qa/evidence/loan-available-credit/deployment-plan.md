# H-LOAN-AVAILABLE-CREDIT-001 — paquete local para publicación

Estado actualizado: el propietario autorizó «al terminar haz commit, push y
publicalo». Migración, Edge, frontend y verificación final completados con PASS.
Este plan conserva la secuencia aprobada para la versión
`2026102609` en el Supabase existente y `David14081982/SutiApp-private`/GitHub Pages.

## Contenido exacto

- Migración `supabase/migrations/20261027000100_loan_available_credit.sql`:
  disponibilidad, reservas, controles en cotización/envío, permisos y auditoría.
- Edge `financial-legacy`: `index.ts`, nuevo `loan-capacity.mjs` y dependencias
  existentes sin cambios `visibility-policy.js`, `request-google-sync.js`,
  `savings-eligibility.ts`, `../loan-history/history.mjs`; `verify_jwt=true`.
- Frontend `2026102609`; bundle SHA-256
  `d22be38a3bf4992922450a856eff30c87579fcc4c9f9b2b4c65720d3307f40ab`.
- Política global inicial apagada; ninguna autorización individual precargada.

Se conserva la publicación de Historial diaria a las 15:00 Hermosillo y su
actualización manual. No hay modificaciones a Google Sheets, Apps Script,
tasas, amortización, datos históricos ni solicitudes de prueba en producción.

## Secuencia una vez autorizada

1. Verificar hashes del paquete y respaldo. Releer sólo metadatos de producción:
   main/Pages en `dad2cdfbc3c6bd86806faebd1a6c3f09b503b7ba`, Edge actual v64,
   cotizador MD5 `caa656046218f8956bf40f93c6d8a688`, objetos nuevos ausentes y
   solicitudes pendientes válidas. Ante cambios, reconciliar el candidato sin
   sobrescribir trabajo ajeno.
2. Compilar el paquete Edge en Supabase con `bundleOnly=true` y verificar que
   la versión instalada sigue intacta. Esta comprobación cloud está pendiente;
   el test local sólo transpila/parsea y ejecuta handlers con dependencias aisladas.
3. Aplicar la migración transaccional y registrar su versión usando el canal de
   migraciones establecido. Verificar funciones, grants/RLS, política OFF y ACL/OID
   preservados. Desplegar inmediatamente el Edge preparado con JWT obligatorio.
   Durante esta transición las sesiones antiguas sin saldo válido pueden exigir
   reabrir el simulador; no se permite omitir el control de cupo por compatibilidad.
4. Publicar el diff revisado desde el checkout aislado mediante GitHub y el workflow
   `deploy-pages.yml`; verificar artefacto/hash y versión efectiva. No usar reset
   forzado ni copiar el workspace antiguo sobre main.
5. Comprobar lectura de cupo/cotización con identidad autorizada, controles Admin,
   caché y las cuatro superficies. Ejecutar la regresión global de imágenes contra
   Pages después de publicar; la ejecución actual de producción es sólo baseline.
   No crear solicitudes ni cambiar autorizaciones reales como prueba.
6. Registrar resultado real y revisión independiente. No declarar PASS productivo
   sin la evidencia posterior al despliegue.

## Recuperación

Respaldo privado previo: `.tmp/loan-available-credit/restore-20261026-223210-0700`
y `.tmp/loan-available-credit/external-before`. La restauración local se realiza
primero en otra carpeta siguiendo `RESTORE.txt`; nunca se borra el workspace.

Si el despliegue exige reversión, comprobar que no hay cambios posteriores ajenos;
restaurar Edge v64 desde fuentes/flags capturados y Pages desde su artefacto/base
capturada. Ejecutar el recovery SQL de esta H, que restaura la definición exacta
del cotizador y desactiva los nuevos controles conservando solicitudes, decisiones,
eventos, tablas privadas y evidencia histórica. Si detecta drift, detener la
reversión automática y comparar las definiciones; no destruir datos intervenidos.
Verificar nuevamente las superficies con y sin service worker.

## Motivo de autorización pendiente

La revisión automática rechazó el envío del paquete financiero al endpoint de
compilación de Supabase: consideró insuficiente la autorización explícita para
ese payload/destino y posibles efectos remotos de `bundleOnly`. No se eludió el
rechazo. Las pruebas locales y lecturas autorizadas continuaron sin mutaciones
productivas; la aprobación solicitada debe cubrir migración, Edge y publicación.

Autorización recibida y ejecutada: commit `9d743d3`, Pages run `40460349576`,
migración `20261027000100`, Edge v65/JWT y versión frontend `2026102609`.
La compilación cloud, lectura de fuentes instaladas, SQL productivo, comprobación
focal publicada, artefacto CI y regresión global posterior resultaron PASS.
El bloqueo descrito arriba se conserva únicamente como antecedente histórico.
