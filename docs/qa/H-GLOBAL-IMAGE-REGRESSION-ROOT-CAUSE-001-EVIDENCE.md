# H-GLOBAL-IMAGE-REGRESSION-ROOT-CAUSE-001 — Evidence

Date: 2026-09-01
Expected production main: `053d49a8ba57436b51c094ea6c1b01e789858a20`

## Verdict

`PASS`: no global image regression is reproducible on the expected main. No image row, Storage object, path, ownership, document, policy or production datum was changed. The reported symptom cannot be attributed to a commit without inventing causality.

## Protected inventory

The same real-browser matrix passed against the local build and GitHub Pages:

| Family / surface | Result | Evidence |
|---|---|---|
| `app_assets` public images | PASS | 147/147 decoded |
| Login institutional seal | PASS | 240×240; raw and transformed responses are PNG |
| Branding projections | PASS | 7/7 |
| Profile photo / signed private asset | PASS | render, fullscreen and refresh |
| Legacy affiliate files | PASS | 29/29 legitimate images |
| Self-service documents | PASS | Expediente, Loan and Membership previews |
| Admin Afiliados | PASS | real profile photo and all rendered document thumbnails |
| Affiliate PDF | PASS | legitimate Admin-authorized document; HTTP 200, `application/pdf`, in-app viewer |
| Program catalog | PASS | 134 items; 248/248 images; real multi-image gallery |
| Marketplace shared assets | PASS | 3/3 |
| Membership logos | PASS | 6/6 |
| Static app shell | PASS | 7/7 resources |
| Service worker/cache | PASS | HTML `bundle.js?v=188`; `sutiapp-v132`; refresh PASS |
| Fresh profile without service worker | PASS | seal, profile and program image decoded; no controller |

The browser emitted zero page errors, printed zero raw/signed URLs and performed zero business-data mutations. Calls to `document-access` produced only the expected append-only access audit associated with authorized reads.

## Logical bisect

| Contract | `0d06e8c` | `dfa9d901` | `8281317` | `053d49a8` |
|---|---:|---:|---:|---:|
| `visual-repositories.js` | `dc982cd09b` | same | same | same |
| `program-catalog-repository.js` | `23ceda0e6d` | same | same | same |
| `marketplace-repository.js` | `d49b8ce99d` | same | same | same |
| `membership-repository.js` | `9f37f0d6a3` | same | same | same |
| `document-workflow-repository.js` | `3efce429c2` | same | same | same |
| `image-viewer.jsx` | `80a4c8ca79` | same | same | same |

`dfa9d901` changed `AffiliateRepository.getCurrentAffiliate()` only to reject archived self-service identities. It did not modify `getProfilePhoto()`, signing, TTL or asset resolution. In Admin it added a canonical call to `listAdminDocuments()`, preserved the prior document shape through `Object.assign`, normalized `mime_type` from `mimeType`, and delegated preview to the unchanged `DocumentWorkflowRepository.adminPreview()`. The migration added archive/upload contracts but did not replace `document-access`, relax Storage, delete objects or alter signed URL policies.

`8281317` has no functional image change. `053d49a8` changes the Auth connection message plus the aligned cache pair `bundle.js?v=188` / `sutiapp-v132`; no mixed current pair exists. The earlier viewer commit `a94e160` already has the exact viewer blob present at `0d06e8c` through `053d49a8`.

Therefore:

- `COMMIT_CAUSANTE`: `NONE_DEMONSTRABLE`
- `ARCHIVO`: none
- `FUNCIÓN`: none
- `CONTRATO_ROTO`: none reproduced
- Last known good: `053d49a8ba57436b51c094ea6c1b01e789858a20` (also no relevant contract delta from `0d06e8c`)

## Cache and delivery checks

The productive client was controlled by `sw.js` with cache `sutiapp-v132`; normal refresh passed. The ephemeral registration was then unregistered, and a fresh browser profile with service workers blocked passed seal, signed profile photo and program image. Hard/fresh execution changed no server state. The current evidence rejects a persistent cache-version regression.

During test development, one public object initially timed out because the audit harness left many response streams open; direct HTTP returned 200/PNG repeatedly and real `<img>` decoding passed. A 9/10 Admin thumbnail sample taken after 1.5 seconds became 10/10 under the protected 30-second render contract. Neither observation was a product defect, and neither was used to alter data or URLs.

## Permanent protection

- `AGENTS.md` now requires this live matrix for every H that changes an image authority, signed URL, Storage policy, bundle/cache or shared viewer.
- `INV-173` makes the protected matrix a repository invariant.
- `scripts/test-protected-image-contract.js` runs in the global static suite and prevents removal or silent narrowing of the live matrix.
- `scripts/test-global-image-regression-production-live.js` is the real-browser, no-PII, zero-business-mutation local/Pages matrix.

## Final result

```text
GLOBAL IMAGE REGRESSION RESULT
Broken surfaces: []
Public assets affected: 0
Private assets affected: 0
Profile photos affected: 0
Program product images affected: 0
Document thumbnails affected: 0
PDF previews affected: 0
Last known good commit: 053d49a8ba57436b51c094ea6c1b01e789858a20
Regression commit: NONE_DEMONSTRABLE
Root cause: no persistent image regression reproduced; retrospective transient symptom has insufficient evidence for commit attribution
Files responsible: []
Data corruption: NO
Storage objects missing: NO
RLS regression: NO
Signed URL regression: NO
Cache/service worker regression: NO
Fix: no product/data patch; protected regression matrix and permanent governance guard added
Image data rewritten: 0
Assets deleted: 0
Documents replaced: 0
Protected image regression suite: PASS
Login/Auth regression: PASS
Final verdict: PASS
```
