# Independent architect review — H-FINANCIAL-VISIBILITY-001

Fecha: 2026-08-24  
Veredicto: `BLOCKED`

## Contraste solicitado vs. evidencia

- Resultado visual Admin: `APPROVED`. La pantalla muestra los criterios reales, política automática, configuración, estado efectivo y editor AUTO/MOSTRAR/OCULTAR. Chrome real validó 146 filas y 146 controles.
- Autoridad: `APPROVED`. Google A:O conserva los criterios financieros; P es el único modo de visibilidad previsto; Supabase no duplica el override.
- Seguridad: `APPROVED / FAIL-CLOSED`. Permiso específico, JWT, RLS forzada, auditoría, payload limitado, fingerprint A:O, lock y read-back. Usuario ordinario y anónimo denegados. Ningún secreto está en frontend.
- Legacy: `APPROVED`. M permanece fuera de la política; el writer sólo puede apuntar a P y el intento bloqueado no ejecutó Google.
- Build/browser: `APPROVED`. Bundle de 83 fuentes, HTML v112, PWA v56 y browser focalizado PASS.
- Función productiva de escritura: `BLOCKED`. Google devuelve HTTP 403 antes de ejecutar Apps Script sin OAuth, aunque el deployment efectivo declara acceso anónimo. No existe evidencia end-to-end de inicialización/escritura/read-back.

## Decisión del revisor

No se permite declarar `PASS`, ni presentar el control como operativamente escribible, hasta resolver la política de acceso Google y ejecutar una prueba reversible `AUTO → MOSTRAR/OCULTAR → AUTO` con auditoría, read-back y A:O intacto.

No se permite resolverlo con refresh token humano de `clasp`, escritura directa Sheets API, secreto frontend, bypass de Apps Script, segunda columna, Supabase override o relajación de elegibilidad.

## Instrucción exacta siguiente para Codex

```text
CONTINÚA H-FINANCIAL-VISIBILITY-001 DESPUÉS DE HABILITAR EL WEB APP GOOGLE.
Verifica primero GET/POST server-to-server sin OAuth contra el deployment aprobado.
Si responde sin 403: inicializa exclusivamente P1 como VISIBILIDAD SUTIAPP; demuestra A:O byte/valor-equivalente antes/después; ejecuta con un criterio futuro y elegible MOSTRAR, OCULTAR y AUTO; confirma P read-back, estado efectivo, auditoría actor/fecha/motivo, denegación normal/anónima y navegador real; deja el criterio finalmente en AUTO. No modifiques M ni otra celda.
```
