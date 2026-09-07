# H03 ? Tests

- node scripts/test-admin-refresh.js: PASS,16 casos con fuentes reales y transporte aislado. Baseline9, steady1; rol/permisos, logout/login, identidad/sesión, impersonación, respuestas invertidas, error de autoridad, dominio fallido, visibilidad, intervalo y cleanup sin duplicados. También PASS desde checkout de entrega.
- node scripts/test-admin-refresh-browser.js: PASS,12 casos Chrome sobre candidato aislado; tres ciclos1, intervalo real,33 módulos preservados, navegación, hidden/focus/visibility, permiso perdido/ganado, mobile, logout/login real. Las respuestas controladas afectan sólo el navegador aislado; permisos reales no se modificaron.
- node scripts/test-admin-access-protected-contract.js: PASS,3 migraciones históricas inmutables,10 invariantes, contrato estático focal. Assertion de bundle histórica sustituida por coherencia de versiones, sin debilitar autorización.
- database.cjs probe/security/apply: equivalencia SQL contra getter vigente, siete huellas estables bajo authenticated INVOKER; usuario normal sin privilegios ni huellas; anon sin EXECUTE; INSERT/UPDATE/DELETE rollback-only invalida sólo banners. Matriz backend A-H real en transacción revertida: autorización, revocación, permisos por sección, protección de principal, impersonación y auditoría. Ver database-probe.json y security-matrix.json.
- Recovery ejecutado con guard/DROP/recreación/hash dentro de ROLLBACK. Getter protegido y48 políticas idénticos: rollback-security-verification.json.
- Build aislado:108 fuentes, sólo3 chunks funcionales distintos del bundle publicado. Build del workspace preserva cambios ajenos previos. Ver release-build.json.
- Regresión global local completa: PASS en localhost:8080 contra backend productivo:156 assets,248 imágenes catálogo,29 archivos históricos, documentos de tres propósitos, foto/seal, Admin Afiliados, Marketplace, Membership, PDF legítimo200, fullscreen, refresh, SW/noSW. Cero errores JS. Evidencia global-local.json.
- Comparación de navegador antes/después:3×9 frente3×1 llamadas,45,016 frente1,713 bytes, proyecciones iguales y todos HTTP200. Ver http-before-after.json.

Los intentos de preparación fallidos se conservan en test-maintenance.json y archivos de fallo. El origen55473 no estaba autorizado por CORS; preflight403 y comparación del mismo PDF en producción confirmaron la causa. La suite completa definitiva usa el origen8080 ya autorizado. No se cambió CORS, Edge Functions, datos ni UI para obtener PASS.

Verificación posterior de publicación y Registry se registrarán en VERIFICATION.md y sus JSON finales; este archivo no declara por sí solo cerrado H03.

Control adicional: Admin decisions cutover, H009 y Pages deployment PASS. La suite ampliada test-admin-affiliates.js falla una assertion histórica de screens-admin-finanzas.jsx (const belongsToAffiliate=); se reprodujo exactamente contra lecturas de git HEAD3029c74. Ese archivo/test no cambia en la entrega H03; no se modifica lógica financiera para corregir un test ajeno. La regresión funcional Admin Afiliados sí pasa en la suite global. Ver affiliates-baseline-test.json y focal-static.json.
