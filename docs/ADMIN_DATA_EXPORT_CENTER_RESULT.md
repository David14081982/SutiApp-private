# ADMIN DATA EXPORT CENTER RESULT

Fecha: 2026-08-23  
H: `H-ADMIN-DATA-EXPORT-001`

## Alcance implementado

- 17 dominios server-side: afiliados, solicitudes, empresas, convenios, noticias, educación, tutoriales, banners, pop-ups, documentos, minutas, programas, membresías, marketplace, Suti Farma/programas, auditoría de exportaciones y auditoría administrativa.
- XLSX principal mediante ExcelJS fijado a `4.4.0`; CSV UTF-8 con BOM.
- Filtros exactos permitidos por dominio y conteo sólo después de autorización.
- `data_exports.read` global y acción granular `export` por sección.
- Descarga directa privada, sin bucket ni URL pública; `Cache-Control: private, no-store`.
- Auditoría con `export_id`, `actor_id`, `domain`, `filters`, `row_count`, `format`, `status`, `column_set`, `created_at`.
- Recovery aditivo: elimina grants `export`, permiso técnico y tabla de auditoría; restaura constraints y función de roles.

## Límites de seguridad

No se aceptan tablas/columnas aportadas por UI. Se excluyen Auth, firmas, `source_payload`, claves de idempotencia, secretos, tokens, hashes/rutas Storage y binarios. Afiliados muestra advertencia PII. XLSX/CSV neutralizan prefijos de fórmula. Máximo 20,000 filas; exceder falla cerrado.

## Verificación local

- Bundle reproducible desde 81 fuentes con Babel Standalone local: `PASS`.
- `node --check app/bundle.js`: `PASS`.
- `scripts/test-data-exports.js`: `PASS`.
- Revisión de borde: exactamente 20,000 filas se permiten y la fila 20,001 falla cerrado; contrato estático y matriz live posteriores al redespliegue: `PASS`.
- preservación Claude, ownership masivo y auditoría de seguridad: `PASS/REVIEW REQUIRED` según contrato del auditor.

## Estado productivo

La Edge Function y `20260823000700` están desplegadas. Los dry-runs pre-apply, migration+recovery y recovery→reapply post-deploy pasaron con `ROLLBACK`. La matriz live usó una responsabilidad temporal de Noticias, restauró exactamente el estado previo y dejó cero grants `export` automáticos o residuales. Las descargas exitosas controladas permanecen registradas como auditoría real metadata-only.

```text
ADMIN DATA EXPORT CENTER RESULT

Exportable domains: 17 (local registry)
XLSX: PASS
CSV: PASS
Affiliate export: PASS — disponible al Super Admin
Requests export: PASS — disponible al Super Admin
Permissions: PASS
PII controls: PASS
Audit log: PASS
Temporary secure downloads: PASS
Secrets exposed: 0
Direct unrestricted database export: NO
Technical backup separated: PASS
Claude UI preservation: PASS static
Final verdict: PASS
```

## Revisión arquitectónica

`APPROVED`. La revisión independiente contrastó autorización del propietario, autoridad, invariantes, migración/recovery, RLS, Edge Function, UI, pruebas estáticas y matriz viva. No detectó autoridad paralela, ampliación legacy, secreto expuesto, grant automático ni acceso cruzado pendiente.

## Corrección CORS del frontend

La Edge Function ahora reutiliza el secreto productivo `ALLOWED_APP_ORIGINS`, igual que la frontera financiera. Se verificó preflight y matriz autenticada desde `http://localhost:8080`: `browser_cors=true`, permisos, aislamiento, revocación, XLSX, CSV, auditoría y cleanup `PASS`.

La operación local quedó fijada al origen permitido `http://localhost:8080/SutiApp.html`; se inició un servidor HTTP local y se verificó frontend `v97` con respuesta `200`. XLSX se entrega como `application/octet-stream` para que `supabase-js` preserve los bytes ZIP; la matriz live confirmó firma `PK`, descarga segura y auditoría `PASS`.
