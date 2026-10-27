# Pruebas aisladas de disponibilidad de préstamos

Estos fixtures contienen una definición de función previa, esquema reducido y
personas sintéticas. No contienen filas, credenciales ni identificadores de clientes.
Nunca se importan desde el código productivo.

Desde la raíz del repositorio, instalar la dependencia de pruebas fijada:

```powershell
npm install --prefix scripts/fixtures/loan-available-credit --ignore-scripts
node scripts/test-loan-available-credit-sql.js
```

La suite usa PGlite 0.5.8 y prueba permisos, RLS, límites, reservas, publicación de
Historial, overrides, cotización autenticada y recovery. La evidencia sanitizada
se escribe en `docs/qa/evidence/loan-available-credit/sql.json`.

También puede reutilizarse una instalación existente mediante la variable
`LOAN_CAPACITY_PGLITE_MODULE`, cuyo valor es la ruta al paquete
`@electric-sql/pglite`. El test no descarga dependencias automáticamente.

`quote-before.sql` reproduce únicamente la definición previa del cotizador
autenticado. Su hash PostgreSQL esperado es
`caa656046218f8956bf40f93c6d8a688`; la migración debe conservar exactamente su
contrato, OID y permisos al incorporar el guard y al recuperarlo.

Para las carreras transaccionales con conexiones independientes se utiliza
`scripts/test-loan-available-credit-concurrency.js`. Requiere PostgreSQL nativo;
`LOAN_CAPACITY_PG_BIN` permite indicar su directorio de binarios. Todos los
clusters y los datos de prueba son locales y sintéticos.
