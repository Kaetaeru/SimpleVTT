# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- Canonical baseline / active product branch: `work/v1-composite`
- Rerun control path: `.chatgpt-rerun/control.json`
- Existing run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Existing sequence: `1`
- Existing task_id: `phase14-production-play-session-ux`
- Canonical V1 routing authority: `CANONICAL_ROOT.md`
- Current V1 execution router: `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`
- Current implementation checkpoint: `.agents/V1_CURRENT_HANDOFF.md`

## Run continuity

This is the same active Rerun run. Do not create a new run_id, reset sequence/task identity, discard the preserved Phase 13 exact-head evidence, or route V1 implementation back to `main`.

The current sequence is the durable V1-completion umbrella: implement every remaining intended V1 function through the real production path while preserving the established UI, then perform one comprehensive Codex audit only at the frozen pre-release boundary.

## Primary V1 contract

### Functional completion, not checkbox completion

A file, test, adapter, or checklist mark is not sufficient by itself. V1 requires the intended behavior to be reachable from the production UI and to preserve authority, persistence, session/transient boundaries, error handling, reconnect semantics, and cross-system consistency.

Do not add unrelated post-V1 features. Do not treat fixture-only/debug-only behavior as production completion.

### Preserve the current UI baseline

The current SimpleVTT screen structure, navigation, panel placement, hierarchy, spacing/style language, and existing controls are the V1 visual baseline.

- Prefer domain/application/persistence/network fixes behind the current UI.
- Do not redesign, reshuffle, rename, restyle, or replace existing major UI merely to simplify implementation.
- Missing intended V1 behavior may add the smallest compatible control/state presentation required to expose it.
- Empty/loading/error/disabled states are allowed when functionally required.
- Final acceptance includes UI-structure preservation as well as behavior.

## Preserved completed work — Task 0

**task_id:** `phase13-closeout-ui-dice-regression`  
**status:** COMPLETE

Preserve the existing Phase 13 arbitrary Character SessionProjection, connected host authority, reconnect/write-back, creation/level-up UX convergence, shared visual dice, and exact-head evidence.

Preserved implementation checkpoint: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

## Task 1 — sequence 1 V1 completion umbrella

**task_id:** `phase14-production-play-session-ux`  
**status:** ACTIVE / CONTINUE AUTHORIZED

Historical Phase 14 intent remains preserved, but current implementation priority comes from the canonical V1 handoff/checklist, not the old Phase 14 branch text.

### Preserved implementation state

Do not reimplement the following merely to obtain new validation:

- Ready/connected lifecycle, reconnect/reset cleanup, `ready-action-v1`, isolated acceptance-pair tooling;
- V1-11 Campaign lifecycle production paths;
- declarative Calendar/Ration provider schema/parser/catalog/runtime/UI paths;
- canonical Character Long Rest domain projection;
- Character/Campaign prepared immutable-generation foundation;
- Memory two-participant compound preflight/apply;
- Tauri cross-store durable staging + single commit marker + committed-interruption recovery;
- Tauri Character/Campaign shared persistence mutex/recovery fence and TS compound writer.

## Current checkpoint — local authoritative Long Rest user path

The previously missing local production coordinator/UI has now been source-connected.

### Authority and preview

- `longRestCompoundCoordinator.ts` owns the compound preview/commit orchestration.
- Character recovery is delegated to `projectCharacterLongRest` / canonical `resolveLongRest`.
- Campaign Calendar/Ration candidates are calculated through an isolated `CampaignApplicationService`; React does not own rule arithmetic.
- Calendar advance and Ration consumption are independent opt-in effects.
- effective Session OFF state or unavailable custom provider skips only that optional effect and returns a warning; Rest itself remains valid.
- master `transactionId` is stamped into Campaign `recentRequestIds` so a retried compound Rest is a no-write duplicate before Character Rest can be applied twice.
- `previewLongRestCompound` and commit use the same candidate calculation.

### Production runtime bridge

- `longRestCompoundRuntimeAdapter.ts` prepares both stores outside the existing single-store mutation methods.
- Tauri uses `TauriCharacterCampaignCompoundWriter`; volatile development/test mode seeds paired memory stores and uses `MemoryCharacterCampaignCompoundWriter`.
- Runtime Character/Campaign persistence contexts are replaced/re-hydrated only after the compound writer succeeds.
- the post-commit Character hydrate refreshes the existing Scene entity HP/life projection; no UI/Scene state is mutated before successful compound persistence.
- exact pinned installed Calendar/Ration profiles are resolved from the existing Catalog helper.

### Existing UI integration

The current `SessionCampaignPane` structure is preserved. A single DM Long Rest block was inserted without moving the existing Party/Calendar/Ration surfaces.

It provides:

- authoritative HP/Temporary HP preview;
- optional `+8시간` Campaign time checkbox, default OFF;
- optional daily Ration consumption checkbox, default OFF;
- authoritative resulting Calendar/Ration preview when selected;
- disabled optional controls when that Session capability is OFF;
- warnings from unavailable provider/capability projection;
- one `장기 휴식 적용` action.

### Deterministic contracts authored

Focused source tests now cover:

- Character canonical Long Rest projection;
- prepared generation no-write behavior and Memory two-participant atomicity;
- Rest-only compound success;
- Calendar-only and Ration-only selection;
- both optional effects;
- effective Session disabled behavior;
- missing custom providers;
- master request idempotency / no-write duplicate;
- compound writer rejection leaving both production stores unchanged;
- preview no-write behavior and preview/commit candidate parity;
- production volatile runtime rehydrate including Scene HP projection;
- production Rest defaulting to no Campaign side effects.

`npm run test:campaign-rest` now contains this focused set and `npm run build` invokes it after TypeScript/rules/creation suites.

## Validation status

No TypeScript, focused test, Rust test, build, or Windows execution result for the new Long Rest head was observed in this dispatch.

- direct commit combined status returned no statuses;
- commit-associated workflow run lookup returned no runs;
- the connector did not expose a usable direct-push Actions-run listing endpoint.

Therefore the local Long Rest path is **SOURCE-CONNECTED / VALIDATION PENDING**, not green/DONE.

Comprehensive Codex audit remains deferred until all pre-release implementation gaps are closed.

## Remaining behavioral questions before V1-12 can be called functionally complete

The new UI/coordinator operates on the currently active persisted Character in the local/host runtime. Before marking V1-12 DONE, reconcile the Campaign Rest contract against connected play:

- determine whether V1 requires one DM Rest command to include remote/host-unknown connected Character owners in the same compound decision/preview;
- if yes, reuse existing connected Character projection/write-back and host authority rather than copying a remote Character into the host durable Character library;
- preserve `DM/각 소유자` decision/ownership semantics from `docs/design/campaign-systems.md`;
- Session-only effect expiry output from canonical Rest must remain transient; do not invent new durable Scene effect storage merely for this slice.

Do not weaken these questions into a local-only assumption without checking the current connected/session contracts.

## Execution strategy until pre-release

1. Mandatory reconciliation order remains README -> control -> STATE -> PLAN.
2. Confirm `work/v1-composite` and current exact head before edits.
3. Re-read canonical handoff/checklist and reconcile stale checklist statuses against actual source.
4. Do not reimplement source-connected slices solely because validation evidence is unavailable.
5. Complete the next real production functionality gap in dependency order while preserving UI/authority boundaries.
6. Add focused deterministic tests with each implementation slice.
7. Keep STATE/handoff/checklist current enough for no-rediscovery resume.
8. Reach a single pre-release exact SHA.
9. Only then run the comprehensive Codex/full-regression/Windows/release audit.

## Current Next Exact Action contract

On the next Rerun dispatch:

1. Reconcile the same run/sequence/task and `work/v1-composite` head.
2. Check whether actual validation evidence has become observable for the current Long Rest head. Preferred focused evidence is `npm run test:campaign-rest`, `tsc --noEmit`/`npm run build`, and Rust tests covering `character_campaign_compound`. If results are not observable, record that fact and continue implementation rather than redoing the slice.
3. Audit the existing connected Session Character authority/reconnect/write-back path against the Campaign Long Rest contract, specifically remote/host-unknown Character participation and owner decision semantics.
4. If connected Long Rest is required for V1-12, implement it through existing connected projection/host authority and the compound transaction boundary. Do not persist a remote Character as a host-owned Character merely to reuse the local coordinator.
5. If current contracts establish local/active-Character Rest as sufficient for V1-12, record that determination with source evidence and reconcile V1-12 status rather than adding scope.
6. Then reconcile V1-13 Party Stash / Campaign DM Library before writing code: the release checklist still labels it TODO/PARTIAL, but current `campaignRuntimeAdapter`, `SessionCampaignPane`, inventory transfer paths, and DM Library methods already contain substantial implementation. Identify the real missing production behavior first and do not duplicate existing work.
7. Preserve the existing UI baseline and do not start the final Codex audit.
8. Before the next checkpoint, durably record implementation/validation evidence, remaining gaps, and the next exact action.
