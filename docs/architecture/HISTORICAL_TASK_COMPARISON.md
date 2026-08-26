# Architecture Navigator — comparación de tareas históricas

Medición reproducible sobre el mismo corte del repositorio. `WITHOUT REGISTRY` ejecuta una búsqueda global por cada alias técnico/humano y cuenta la unión de archivos candidatos; `WITH REGISTRY` ejecuta un lookup y cuenta únicamente `primary_files`. No se estiman tokens.

| Tarea | Searches sin Registry | Archivos candidatos sin Registry | Lookups con Registry | Archivos primarios con Registry | Fallback searches |
|---|---:|---:|---:|---:|---:|
| Perfil / Credencial | 3 | 60 | 1 | 10 | 0 |
| Convenios | 3 | 79 | 1 | 10 | 0 |
| Suti Préstamo | 3 | 38 | 1 | 10 | 0 |

Resultado observable: los candidatos a inspección bajaron de **177** a **30** archivos en las tres tareas. La medida representa reducción de exploración, no ahorro exacto de tokens ni garantía de que todo archivo primario deba editarse.
