# H05 — Guardians

- Navigator: Registry/lookup previos y discovery dirigido confirmaron el getter live, consumidores y autoridades; el nuevo RPC/dependencia requiere refrescar el índice derivado.
- Pre-change: alcance y ampliaciones antes de SQL, fuentes, tests y fixtures en PRE_CHANGE.md. Autorización explícita H05; no continuidad H06.
- Source of truth / legacy: GOOGLE_LEGACY_AUTHORITY, SHADOW_MIRROR y NOT_CUTOVER permanecen. Getter/helper exactos y 24 tablas completas idénticas. Memoria del cliente derivada, efímera y validada por backend en cada lectura; sin alternativa productiva.
- Migration: un índice útil medido y un endpoint delegante adicional. Guards y recovery ensayados; no schema financiero, DML histórico ni RLS existente alterados.
- Supabase security: actor/effective affiliate/impersonación derivan de backend; sin selector de objetivo, anon denegado, matriz live equivalente. Sin secretos browser, URLs públicas ni service role frontend.
- Post-change: release focal y global local PASS; entrega publicada, Registry y revisión de cierre se completan antes de emitir VERIFICATION PASS.

## CLAUDE UI PRESERVATION REVIEW

Screen: Inicio, Finanzas, Ahorro y sus detalles.

Original sections: Inicio conserva saldo; Finanzas conserva resumen/acciones; Ahorro conserva hero, saldo, detalle anual, plan, próximas aportaciones, acciones y detalles de historial/retiros/beneficiarios; estado sin participante y estados de carga/error.

Current sections: mismas fuentes de pantalla que 19eb53d. Payload completo, HTML y controles coinciden en navegador en ambos casos disponibles.

Missing sections: ninguna. Added sections: ninguna.

Interactions preserved: navegación, volver, abrir/cerrar tres detalles, refresh explícito, error controlado y retry; selección de saldo nulo/cero/positivo conserva el selector original.

Navigation preserved: YES. Visual structure preserved: YES.

Unauthorized redesign: NO.

Verdict: PASS. `browser-equivalence.json` y `release-build.json`; no simplificación ni publicación de las pantallas pendientes del workspace.
