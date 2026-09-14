# H-SAVINGS-CONTROL-ACCESS-001

AUDIT ? AUTHORITY ? PLAN ? RISK ? IMPLEMENT ? VERIFY ? EVIDENCE

Owner cannot locate period yield and global/individual withdrawal controls. Existing controls are in Revision after its list, inside collapsed Settings. Expose a visible Retiros y rendimientos button beside existing administrative tools, opening the existing Modal with existing Settings expanded. Preserve four tabs, layout, all data and permissions. Show plain-language headings and guidance; configuration alone must not post yield or open windows.

Files: app/savings-panel-admin.jsx, app/savings-runtime-admin.jsx; focal browser test; build-savings-release.js baseline, generated bundle, HTML/SW versions only; this audit/evidence/guide/changelog. No schema, RPC, role, Google, financial calculation, publication or other-program change.

Source authority and existing backend permission guards unchanged. Settings reuses getAdminDashboard, SavingsOperationsAdmin and SavingsYieldAdmin; no new data reader/writer, routing, dependency or authority. UI-only reuse of existing Modal/RuntimeAdmin edges does not require structural Registry regeneration. Any freshness differences must be documented as scoped presentation changes rather than falsely labeled FRESH.

Tests: direct entry visible without scrolling the row list; expanded settings; existing rates and per-user/all scope selectors; no calls that save on mount; read-only visibility, close/reopen, 320/430/1440; existing runtime suite; build and unrelated module parity.

Recovery: revert focal frontend commit/cache versions. Business state is never modified by delivery. Existing balance publication remains PRIVATE; no rate or withdrawal is activated by this work.

Scope extension: browser reproduction showed Escape closed both nested withdrawal form and parent native dialog. Include savings-operations-admin.jsx to prevent the default outer cancellation and stop Escape propagation; retain busy guard. No change to commands or permissions.

Scoped form layout in the new settings wrapper restores readable stacked labels/inputs and wrapping actions on mobile. Existing screens outside this wrapper retain their styles.
