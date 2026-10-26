# H-HISTORY-TYPOGRAPHY-001

PRE-CHANGE AUDIT - 2026-10-26

Objective: improve mobile readability exclusively within Amortizacion de pagos through a proportional type scale. Preserve the existing components, colors, borders, radii, margins, card alignment/separation, navigation, data and behavior. Owner authorizes only necessary internal spacing/wrapping adjustments for larger text; no zoom or uniform scaling.

Baseline: isolated worktree from current published main abc07239910eb47f669a5f2ccf77ecf3f80236c2, bundle2026102603. Other root and prior-release changes remain separate. Navigator lookup identifies app/history-loans.jsx and its existing dependencies. Registry checks report prior-release checksum staleness; directed inspection of the actual current detail, text-size.css, UI helpers and focal browser harness confirms scope. The Registry is not used as runtime authority and this style-only task does not change architecture.

Declared files: app/history-loans.jsx (presentation style declarations only); generated app/bundle.js, SutiApp.html/sw.js version references; this audit, append-only docs/AGENT_CHANGELOG.md and sanitized evidence under docs/qa/evidence/history-typography. Private visual verification runner, fonts and screenshots remain under .tmp/history-typography. No new repository testing infrastructure or runtime dependencies. No other production files may change.

UI contract: retain header/back/download; summary with existing fund/reference/term, principal/status/total, monetary progress and balances; approval clock/source timestamp/errors; Historial label; three-column quota cards (number, title/date/closure, amount/status); support. Keep all original controls, data attributes, component ordering and state handling. Colors, borders, radii, shadows, outer margins, quota padding/gaps/alignment and grid/flex structure remain fixed. Text may wrap naturally within its existing column; only required min-width/max-width/line-height/internal-fit style adjustments are in scope.

Type scale: normal preference approximately14px secondary labels/dates/statuses/ordinal badges,16px body/row titles,18px installment amounts,16-18px responsive balances,20px page title,34px principal. Reuse existing inherited typography variables so user preferences continue to work. Existing shared HistorySourceState/ApprovalClock must retain their appearance outside the detail; any scoped variable override needs an unchanged fallback and comparison outside the screen. No edits to global text-size.css, shared UI, Auth, shell or repositories. LoanHistoryDetail also renders the existing Solicitud variant; its shared detail styles inherit this scale, so verify that direct dependency and do not claim its typography is unchanged. The separate Historial list and its helpers retain their appearance.

Authority/data: Google financial values, private Supabase observation, own-context identity, date/zero-state rules, ordinal numbering and local PDF remain unchanged. This task changes no financial calculation, source reader/writer, API, database, migration, synchronization or cache. Legacy classification: SAFE CHANGE confined to presentation. Source-of-truth verdict: SAFE; existing readers/writers unchanged. Database migration/security infrastructure reviews: NOT APPLICABLE to unchanged services; verify source diff rather than run production data probes.

Risk: clipped labels, squeezed dates, long amounts, header/button collisions, inconsistent quota alignment, and styles leaking to Historial. Verify with real page CSS including app/text-size.css, data-text-size context and Nunito; the older fixture harness omits these and cannot alone certify typography. Visual checks cover widths320/360/375/390/414/430, all quota states, long values, missing dates, closure/support and small/largest text preferences at extremes. Compare before/after structure, colors, borders, radii, margins, quota gaps/alignment and outside-detail helpers. Inspect screenshots and measured text/element bounds. Confirm style-stripped logic equivalence and focal bundle parity, then Pages/PWA build.

Recovery: restore the original focal styles and regenerate/version the bundle. No data rollback. Generated artifacts do not expand this to global infrastructure; global image regression is NOT APPLICABLE because no shared Auth/routing/assets/viewer/Storage/service-worker logic changes. No structural Registry regeneration is required for presentation-only changes; retain explicit checksum-staleness limitations.

Status: PASS for audited scope; implementation and visual verification follow.

Visual iteration: at320px normal, the initial18px balance split the final digit of the synthetic stress amount. The two progress amounts now use calc(clamp(16px,5vw,18px)*var(--text-scale,1)); equal columns, margins and gaps are unchanged. A further320px/largest check found that ordinal210 at16px*1.35 wrapped outside the fixed34x38px badge. The14px secondary scale also narrowly overflowed at largest: Nunito800 measured34.03125px at18.9px. The final ordinal uses min(var(--text-12,14px),18px), with a measured32.40625px width for210 at18px; normal14px and small12.25px are retained. Only this number has a fit cap; row titles, amounts and other text retain the complete preference scale. Badge geometry and card alignments remain unchanged. No sequence, amount, date or state was changed. Final targeted checks must supersede these preliminary failures.

VERIFICATION - 2026-10-26

Private Chrome checks use real Nunito, the actual page/text-size CSS and isolated synthetic inputs, with external runtime traffic blocked. Visual coverage includes320/360/375/390/414/430px normal, small/largest preferences at320/430, long reference/fund/amounts and the existing quota states. Initial10-case comparisons and the subsequent320px balance rechecks are retained separately with their source hashes. At widths>=360, the responsive balance resolves to the same18px as the earlier candidate. The final ordinal change only reduces glyph size within the unchanged fixed badge; final targeted210-row renders at320/430 normal/largest verify a single line and containment. Final loading, empty error, retained error and preparing states at320, plus the Solicitud variant at320/430, also pass. No earlier render is represented as a render of the final source.

Measured results: zero horizontal overflow, clipped text or text collisions in the covered cases; structure, colors, borders, radii, margins, quota padding/gaps/alignment and outside-detail helper appearance preserved. Larger accessibility preferences can wrap long dates, amounts and labels inside their existing columns. Root visually inspected320 normal summary/quotas,320 largest quotas and final210 badge, and430 normal closure/support. No authenticated production browser or backend session was used.

Static style-stripped AST is identical to baseline: texts, calculations, data expressions, conditions, handlers and element tree unchanged. Final source LF SHA256:92b7d164d629652911c355a999a7bfde9d44e7d39c859861bee20c104c346be7. Build regenerates163 modules; only history-loans.jsx differs, with162 byte-identical modules. Exact Babel7.28.4 source/bundle parity and syntax pass. Version2026102604; bundle SHA256:31dfb36744976cfeb3f5755413b2b3e20507af98c8f48eeace4b0152810c45bf. HTML/SW changes are version references only. Pages/PWA check PASS, forbiddenFiles0. No new runtime dependency or permanent test infrastructure.

CLAUDE UI PRESERVATION REVIEW
Screen: LoanHistoryDetail - Amortizacion de pagos and its existing Solicitud variant.
Original sections / Current sections: Header/back/download, loan summary/progress/balances, approval/source states, Historial/quota list, closure and support; unchanged.
Missing sections: None.
Added sections: None.
Interactions preserved: PASS by identical callbacks/conditions and isolated state checks; no authenticated backend claim.
Navigation preserved: PASS by unchanged callbacks and element structure.
Visual structure preserved: PASS; only typography and required text-fit properties changed.
Unauthorized redesign: NO.
Verdict: PASS.

H-HISTORY-TYPOGRAPHY-001 RESULT
Status: PASS - local implementation and verification; publication is a separate step.
Files changed: app/history-loans.jsx; generated app/bundle.js and version references in SutiApp.html/sw.js; this audit; docs/AGENT_CHANGELOG.md; sanitized docs/qa/evidence/history-typography.
Source-of-truth verdict: PASS - existing Google authority, private observation and readers/writers unchanged.
Invariant verdict: PASS - style-stripped AST identical; zero calculation/date/state/ordinal/PDF/identity changes.
Build: PASS -163 modules, exact focal Babel parity, valid syntax, Pages/PWA packaging.
Tests: PASS - isolated visual coverage and targeted final correction checks described above; static style/structure and generated artifact comparisons.
Security: PASS for bounded diff - no Auth/RLS/API/role/token changes or real-user data. Production security retest NOT APPLICABLE.
Legacy impact: None; no Sheets, Apps Script, synchronization, data or financial writes.
Unexpected files changed: None in isolated worktree; unrelated root and previous release work left intact.
Known limitations: Isolated synthetic browser checks, not authenticated production testing or real-device testing. Registry retains pre-existing checksum staleness; no architecture changes. Large preference text may wrap naturally. Generated-only SW version change does not claim testing the service-worker update lifecycle.
Evidence: docs/qa/evidence/history-typography/{style-audit,bundle-audit,pages-pwa,visual-summary}.json; full private measurements, runner, fonts and screenshots under .tmp/history-typography.

Independent sutiapp-architect-reviewer: APPROVED for this local candidate. Reviewed final files/hashes, style-only AST, visual correction210, shared Solicitud/states, build/parity and declared limitations. No remaining critical finding or owner decision to accept the local implementation. Next action: complete only the publication process authorized for this package; local approval is not production verification.
