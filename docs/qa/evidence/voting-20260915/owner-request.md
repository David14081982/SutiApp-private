H-SUTIAPP-VOTACIONES-PRODUCTION-001

Implementa el módulo productivo de VOTACIONES en SutiApp.

IMPORTANTE:
Después de estas instrucciones te proporcionaré el documento completo con los dos HTML de diseño:

- Pantalla A: Votaciones para el afiliado.
- Pantalla B: Votaciones para el Administrador.

LOS DOS HTML SON EL CONTRATO VISUAL.

Quiero que conserves fielmente:
- diseño;
- colores;
- gradientes;
- tarjetas;
- acordeón;
- botones;
- iconos;
- bottom sheets;
- barras de resultados;
- chips;
- editor Admin;
- animaciones;
- jerarquía;
- responsive;
- línea gráfica.

NO rediseñarlos.

Pero NO copies la arquitectura demo de almacenamiento de esos HTML.

────────────────────────
UBICACIÓN EN INICIO
────────────────────────

La sección Votaciones debe aparecer exactamente:

Banners/carrusel
↓
VOTACIONES
↓
Tu sindicato

Es decir, inmediatamente ARRIBA de “Tu sindicato”.

Si el afiliado no tiene ninguna votación autorizada:
no mostrar la sección ni dejar espacio vacío.

────────────────────────
SUPABASE = AUTORIDAD
────────────────────────

El HTML utiliza localStorage únicamente como DEMOSTRACIÓN.

NO utilizar localStorage como autoridad productiva.

Supabase debe ser la única autoridad para:

- consultas;
- preguntas;
- audiencia;
- votos;
- folios;
- fechas;
- publicación;
- bitácora.

Si se utiliza votoStore, debe ser únicamente una capa reactiva conectada a Supabase.

Antes de crear nuevas tablas/RPC:
audita y reutiliza la arquitectura existente de SutiApp.

NO crear autoridades paralelas.

────────────────────────
IDENTIDAD
────────────────────────

El votante debe resolverse mediante la identidad autenticada real:

Supabase Auth
→ get_effective_affiliate_id()
→ affiliates

No confiar en nombre/correo/control enviados libremente por frontend.

────────────────────────
VOTO ÚNICO
────────────────────────

Cada afiliado puede votar UNA SOLA VEZ por pregunta.

Debe garantizarse en BACKEND.

Conceptualmente:

UNIQUE(
 affiliate_id,
 consulta_id,
 pregunta_id
)

No importa si:

- cambia de teléfono;
- usa otro navegador;
- borra caché;
- reinstala la PWA;
- cierra sesión y vuelve a entrar.

No puede volver a votar esa pregunta.

────────────────────────
VOTO DEFINITIVO
────────────────────────

Después de confirmar el voto:

NO puede cambiarlo.

El backend debe impedir sustituir o sobrescribir el voto existente.

────────────────────────
“VOTO SECRETO”
────────────────────────

DEFINICIÓN DEL OWNER:

“Tu voto es secreto” significa:

OTROS AFILIADOS NO pueden conocer cómo votó esa persona.

Los afiliados sólo pueden ver resultados agregados:

Sí
No
Abstención
Total
Porcentajes
Participación.

SIN EMBARGO:

Los administradores que tengan el permiso correspondiente SÍ pueden conocer y exportar:

- nombre;
- número de control;
- correo;
- sindicato;
- nivel/tipo de empleado;
- consulta;
- pregunta;
- respuesta;
- fecha;
- hora;
- folio.

Por tanto:

NO anonimizar irreversiblemente los votos.

No afirmar en UI que los administradores desconocen el voto.

────────────────────────
RESULTADOS
────────────────────────

ANTES de votar una pregunta:

NO mostrar resultados de esa pregunta.

DESPUÉS de votar:

mostrar:

- su voto;
- folio;
- Sí;
- No;
- Abstención;
- porcentajes;
- participación;

siguiendo exactamente el diseño proporcionado.

Los porcentajes NO se almacenan como autoridad.

Se calculan desde los votos reales.

────────────────────────
FOLIO
────────────────────────

Generar el folio de voto en backend.

NO utilizar Date.now() del HTML demo como autoridad productiva.

────────────────────────
SEGMENTACIÓN
────────────────────────

Conservar los cuatro modos diseñados:

1. Todos
2. Solo registrados
3. Segmentado
4. Solo estas personas

Reutilizar el motor REAL de segmentación existente en SutiApp.

Segmentado:

- cargo;
- sindicato;
- nivel/tipo de empleado.

Solo estas personas:

lista de correos autorizados.

Normalizar:
trim + lowercase.

────────────────────────
ADMIN → VOTACIONES
────────────────────────

Integrar la Pantalla B en el Panel Administrativo real.

Debe permitir:

- crear consulta;
- editar;
- publicar/ocultar;
- fecha de cierre;
- padrón;
- agregar preguntas;
- editar preguntas;
- reordenar;
- eliminar preguntas;
- configurar audiencia;
- duplicar consulta;
- consultar resultados;
- exportar resultados;
- exportar votos identificados.

Reutilizar el sistema existente de permisos por pantalla/acción.

Contemplar permisos equivalentes a:

votaciones.read
votaciones.create
votaciones.update
votaciones.delete
votaciones.publish
votaciones.results
votaciones.export_identified_votes

IMPORTANTE:

El permiso para administrar Votaciones NO implica automáticamente poder conocer quién votó qué.

La exportación nominal requiere permiso específico.

Backend debe hacerlo cumplir.

────────────────────────
EXPORTAR A EXCEL
────────────────────────

EXPORTACIÓN RESULTADOS:

Consulta
Pregunta
Sí
No
Abstención
Total
Participación %

EXPORTACIÓN VOTOS EMITIDOS:

Folio
Fecha
Hora
Consulta
Pregunta
Respuesta
Número de control
Nombre
Correo
Sindicato
Nivel/tipo de empleado

Formato:

CSV UTF-8 BOM
sep=;

────────────────────────
BITÁCORA
────────────────────────

Registrar:

- creación;
- edición;
- publicación;
- eliminación;
- exportaciones;
- voto emitido;
- actor;
- timestamp.

Usar la arquitectura de auditoría existente.

────────────────────────
IMPERSONACIÓN
────────────────────────

Un administrador utilizando “Tomar control” NO debe poder votar en nombre del afiliado.

La impersonación puede permitir visualizar la pantalla como el usuario,
pero NO emitir votos.

────────────────────────
CONCURRENCIA
────────────────────────

Debe soportar muchos afiliados votando simultáneamente.

Si llegan dos solicitudes simultáneas del MISMO afiliado para la MISMA pregunta:

sólo una debe persistir.

Cero votos duplicados.

────────────────────────
ACCESIBILIDAD
────────────────────────

Debe funcionar con los tamaños de texto actuales:

Normal
Grande
Muy grande

Mantener:

- targets táctiles ≥44 px;
- responsive;
- sin clipping;
- sin overflow;
- sin textos superpuestos;
- prefers-reduced-motion.

────────────────────────
DATOS DEL HTML DEMO
────────────────────────

NO cargar en producción los datos demostrativos del HTML:

- Asamblea General Extraordinaria;
- preguntas de ejemplo;
- 3,184 afiliados;
- conteos simulados;
- votos simulados.

Son únicamente ejemplos visuales.

Las votaciones reales se crean desde Admin.

────────────────────────
REGLA PRINCIPAL
────────────────────────

HTML proporcionado
=
CONTRATO VISUAL Y DE INTERACCIÓN.

Supabase + arquitectura existente SutiApp
=
CONTRATO DE DATOS Y SEGURIDAD.

NO sacrificar el diseño proporcionado.

NO trasladar localStorage del demo a producción.

────────────────────────
IMPLEMENTACIÓN
────────────────────────

No quiero únicamente una auditoría.

Ejecutar:

Architecture discovery
→ pre-change audit
→ identificar/reutilizar autoridades existentes
→ migración aditiva si es necesaria
→ RLS/RPC
→ repository/store
→ Pantalla afiliado
→ Pantalla Admin
→ permisos
→ exportaciones
→ pruebas focalizadas
→ publicación
→ verificación productiva.

Usar las skills correspondientes del proyecto.

Sólo detenerse ante una decisión REAL de negocio que no pueda determinarse técnicamente.

────────────────────────
VALIDACIÓN FINAL
────────────────────────

Ubicación arriba de “Tu sindicato”: PASS/FAIL
Diseño HTML preservado: PASS/FAIL
Supabase authority: PASS/FAIL
Crear consulta: PASS/FAIL
Publicar: PASS/FAIL
Segmentación: PASS/FAIL
Lista nominal: PASS/FAIL
Sí/No/Abstención: PASS/FAIL
Voto persistido: PASS/FAIL
Voto definitivo: PASS/FAIL
Segundo voto: DENIED/PASS
Segundo dispositivo: DENIED/PASS
Race condition: DENIED/PASS
Resultados ocultos antes: PASS/FAIL
Resultados después: PASS/FAIL
Privacidad entre afiliados: PASS/FAIL
Trazabilidad Admin autorizada: PASS/FAIL
Export resultados: PASS/FAIL
Export nominal: PASS/FAIL
Permisos backend: PASS/FAIL
Bitácora: PASS/FAIL
Normal/Grande/Muy grande: PASS/FAIL

CERO:
- votos duplicados;
- votos productivos en localStorage;
- autoridades paralelas;
- escalación de permisos.

Si todo PASS:
publica,
verifica producción
y detente.

A CONTINUACIÓN ESTÁ EL DOCUMENTO CON LOS DOS HTML.
UTILÍZALOS ÍNTEGRAMENTE COMO CONTRATO VISUAL: