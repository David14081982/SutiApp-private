# H-009 — CRUD administrativo visual y empresarial

## Resultado

H-009 conecta el panel autenticado de H-008 con las autoridades Supabase de branding, banners, popups, empresas y documentos. H005_TEST es el único writer autorizado; H005_TEST2/H005_TEST3 conservan la aplicación normal y no pueden escribir.

## Contrato de datos

- Histórico: `record_origin=HISTORICAL_IMPORT` y coordenadas originales obligatorias.
- Creación Admin: `record_origin=ADMIN_H009`, sin hoja, ordinal o snapshot inventados.
- Desactivación: `enabled=false`; la fila permanece en la autoridad y desaparece de lectores públicos.
- Assets: MIME/tamaño por bucket, SHA-256, path seguro, `app_assets`, `asset_sources` y limpieza de fallos.
- PWA: los cambios runtime son inmediatos; manifest/favicon estático requiere sync y deploy.

## Seguridad

RLS está habilitada y forzada en las siete tablas verificadas. Las policies usan los permisos H-008 y los grants de contenido están acotados por columna, por lo que Admin no puede reescribir procedencia histórica desde el navegador. `asset_sources` permanece privado. Secret Key, Access Token y contraseñas no están en frontend, bundle, logs ni documentación.

## Evidencia

La migración reconcilió 67 filas históricas: 33 empresas, 23 banners, 3 popups y 8 documentos; una sola asignación admin y RLS forzada. La prueba reversible creó, editó, reemplazó, activó/desactivó y limpió los cuatro dominios; dos clientes observaron los cambios, dos usuarios normales y Storage normal fueron denegados, y cinco recursos dejaron auditoría. Los conteos finales volvieron exactamente a 33/23/3/8.

Chrome headless confirmó branding, los cuatro módulos CRUD, un popup creado/editado/activado/desactivado desde la UI y cleanup, refresh y logout para H005_TEST. H005_TEST2/H005_TEST3 conservaron login/app normal y Admin denegado.

## Límites

No se habilitaron Marketplace, productos, planes, usuarios/Auth empresariales, documentos privados del afiliado, roles/copy generales ni impersonación. Ahorro, Préstamos y Google financiero tuvieron `NO INTERACTION`.

## Revisión arquitectónica

`sutiapp-architect-reviewer`: **APPROVED**. El objetivo H-009 está implementado y evidenciado sin autoridad paralela, elevación por UI, pérdida histórica ni dependencia del legacy financiero. `WORK_QUEUE.md` y `WORK_QUEUE_HISTORY.md` no existen, por lo que el cierre no autoriza ni inicia otra H.
