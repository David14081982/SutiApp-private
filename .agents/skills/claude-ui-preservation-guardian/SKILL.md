---
name: claude-ui-preservation-guardian
description: Proteger el contrato visual, funcional e interactivo original de pantallas diseñadas en Claude Design. Usar automáticamente cuando una H conecte, migre o sustituya DATA, mocks, localStorage, Google Sheets u otra fuente por Supabase, Repository o API; cuando se modifique una pantalla existente; y antes de cerrar cualquier cambio frontend de Sutiapp para detectar simplificaciones, secciones perdidas o rediseños no autorizados.
---

# Claude UI Preservation Guardian

Aplicar la regla: **migrar datos no autoriza rediseñar UI**. Tratar el frontend Claude Design como contrato visual y funcional salvo autorización expresa del propietario.

## Auditar antes de cambiar

Reconstruir el contrato de cada pantalla desde la implementación original, artefactos verificables, capturas y documentación. Registrar de forma breve:

```text
SCREEN:
SECTIONS:
CONTROLS:
INTERACTIONS:
NAVIGATION:
DATA CONSUMERS:
EMPTY STATES:
LOADING STATES:
ADMIN CONTROLS:
MOTION:
SCROLL BEHAVIOR:
```

No modificar la pantalla hasta identificar qué debe sobrevivir.

## Preservar el contrato

- Mantener secciones, tarjetas, carruseles, filtros, tabs, chips, botones, jerarquía, navegación, orden, layout, copy, motion, microinteracciones, estados y componentes.
- Mantener búsqueda, filtros, ordenamiento, favoritos, carruseles, drawers, modales, sheets, accordions, scroll, selección, CTA y herramientas administrativas que ya respondan a interacción.
- Conectar la capa como `UI existente → Repository → autoridad`; adaptar el Repository al contrato UI cuando sea razonable.
- Retirar mocks o fallbacks cuando exista autoridad productiva sin sustituir la pantalla por una versión simplificada.
- Conservar copy, iconos, tamaños, colores, radios, sombras, márgenes, padding, tipografía, spacing, alturas, orden y responsive salvo autorización expresa.

No justificar eliminaciones con limpieza, optimización, consolidación o simplificación.

## Resolver datos faltantes

No eliminar un componente porque su nueva fuente aún no exista. Mantenerlo con un estado explícito `LOADING`, `EMPTY`, `PENDING` o `DISABLED`, según corresponda. No inventar datos, copy de negocio ni una autoridad alternativa.

Conservar controles administrativos sin backend como `DISABLED / PENDING BACKEND`; no reactivar stores locales ni autorización simulada.

Si preservar el contrato es técnicamente imposible, emitir `OWNER_DECISION_REQUIRED` antes de rediseñar.

## Verificar después de cambiar

Comparar antes y después preferentemente con navegador real y el mismo viewport. Exigir paridad estructural, no igualdad pixel-perfect cuando el contenido real cambia dimensiones inevitables.

Comprobar:

- presencia y orden de todas las secciones;
- controles, estados, scroll y navegación;
- interacciones relevantes de cada componente;
- loading, error, empty y pending sin desaparición estructural;
- ausencia de `DATA`, mocks, localStorage o Google como fallback en el dominio migrado;
- correspondencia entre fuente frontend y bundle ejecutable.

Para Convenios verificar al menos: header/subtítulo/campana, espacio y carrusel publicitario, posición, indicador y `PATROCINADO`, buscador y filtro, chips, Destacados, tarjetas y descuentos, Todos los convenios, favoritos, detalle, control administrativo según permiso, scroll y bottom navigation.

Clasificar como `UI REGRESSION — FAIL` una migración que reduzca Convenios a header, buscador y lista aunque los datos funcionen.

## Corregir o escalar

- Si falta un elemento recuperable, emitir `NEEDS_FIX`, restaurarlo dentro de la misma H, repetir la verificación y no avanzar.
- Si la corrección requiere decidir un rediseño, eliminación o cambio de experiencia, emitir `OWNER_DECISION_REQUIRED`.
- Si no hay regresiones, emitir `PASS`.

## Respuesta

Devolver únicamente:

```text
CLAUDE UI PRESERVATION REVIEW

Screen:
Original sections:
Current sections:
Missing sections:
Added sections:
Interactions preserved:
Navigation preserved:
Visual structure preserved:
Unauthorized redesign:
YES / NO

Verdict:
PASS | NEEDS_FIX | OWNER_DECISION_REQUIRED
```
