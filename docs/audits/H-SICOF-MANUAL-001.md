# H-SICOF-MANUAL-001 — manual de uso y procedencia de información

## PRE-CHANGE AUDIT

Objetivo: entregar al propietario un manual operativo en español que explique cada sección, control, dato, cálculo, descarga y limitación del SICOF publicado.

Autorización: petición expresa de un manual de uso y del origen de cada dato. Clasificación: READ ONLY sobre producto y fuentes; escritura documental local.

Baseline: checkout aislado `.tmp/sicof/release`, commit `94158a6a7005cd113517e77a30212217414b41c5`, aplicación v312, motor SICOF V2. Navigator FRESH y lookup SICOF verificados antes de inspección dirigida. Código, migraciones y evidencias publicadas prevalecen sobre etiquetas o índices derivados.

Archivos a crear o modificar: este documento; `docs/manuales/Manual_de_uso_SICOF.pdf`; `docs/manuales/Manual_de_uso_SICOF.docx`; evidencia documental `docs/qa/evidence/sicof-manual/`; revisión independiente `docs/audits/H-SICOF-MANUAL-001-REVIEW.md`; una entrada focal de `docs/AGENT_CHANGELOG.md`. Notas y generadores de documentos aislados en `.tmp/sicof/manual/`. No se modifica código productivo, configuración, modelos de datos, fuentes, permisos, autoridades ni arquitectura; no se publica un nuevo release.

Fuentes de verdad: Ahorro canónico en Supabase; préstamos de la hoja fija HISTORIAL P V2 de SutiApp Final; Excel 2025 privado como referencia inmutable; parámetros y costos declarados como entradas de simulación. El manual es documentación, nunca una fuente monetaria.

Plan: inventariar interfaz y operaciones; trazar columnas/lectores/cálculos; redactar instrucciones con ejemplos inventados claramente identificados; producir PDF y Word editables; verificar legibilidad, paginación, cobertura y referencias; revisión independiente.

Riesgos y controles: no confundir cuotas con interés, proyección con ingreso bancario, simulación con pago, reserva con saldo disponible ni dato desconocido con cero/incumplimiento. No incluir nombres, folios, saldos individuales, claves, tokens o URLs privadas. Los conteos de la activación se fecharán expresamente; no se presentarán como consulta actual en vivo.

Tests/verificación: contraste contra código publicado y evidencia; ejemplos aritméticos; apertura y extracción de DOCX/PDF; inspección visual de páginas; comprobación de fuentes runtime sin modificaciones. Build/tests de aplicación y regresión global: NOT APPLICABLE por ser una entrega exclusivamente documental. No se vuelve a autenticar ni a leer producción.

Recuperación: retirar o corregir los documentos generados; ningún efecto sobre información financiera. Registry sin cambio estructural: nuevos documentos pueden marcar freshness documental y se declarará ese alcance sin alterar arquitectura.

Status: PASS para elaboración documental.

## H-SICOF-MANUAL-001 RESULT

Status: PASS.
Files changed: manual PDF (25 páginas), Word editable (24 secciones, 22 tablas), esta auditoría, revisión independiente y evidencia documental; entrada focal de changelog. La corrección de exportación solicitada durante la elaboración tiene su propia H-SICOF-CONTINUOUS-REPORT-001 y se describe en las secciones 16–19.
Source-of-truth verdict: PASS; fuentes y fórmulas contrastadas con código, esquema y contratos. Manual explicativo, sin autoridad financiera.
Invariant verdict: PASS; distingue simulación/acreditación, capital/rendimiento, origen/fecha efectiva, saldo/disponible y ausencia/cero. Se corrigieron durante revisión las descripciones de base elegible, ajustes de salida, liquidez indeterminada y edición de textos.
Build: NOT APPLICABLE al runtime por el documento; PDF y DOCX generados y abiertos correctamente.
Tests: PASS títulos de 24 secciones, encabezados semestrales exactos en ambos formatos, 25 páginas sin texto fuera de límites ni páginas vacías/escasas, exclusión de nombres del histórico y verificación de ejemplos. Inspección visual de portada, cierre y páginas de Excel 17–20.
Security: PASS, sin datos personales de cuentas, credenciales o archivos de producción dentro del manual.
Legacy impact: ninguno; ningún cálculo, configuración o dato se modifica por el manual.
Unexpected files changed: ninguno fuera del alcance documental. El runtime pertenece a la H independiente indicada.
Known limitations: documenta la versión v312/Edge v4 y sus fuentes al 2026-10-03; cambios posteriores requieren actualizar el manual. Se explican límites de historia/cobertura y el indicador cualitativo de comportamiento, que no es score numérico.
Evidence: `docs/qa/evidence/sicof-manual/{document-generation,document-verification}.json`; revisión independiente `H-SICOF-MANUAL-001-REVIEW.md`. PDF SHA-256 `62a962deea7e6e51963d6ef96e89303a549386f91d98319d27c445400aeca955`; DOCX `05245fe9c40191e0018b0dedc384ab4b70347b43c6d57cb03e088a828f8fce96`.
