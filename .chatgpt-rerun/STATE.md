# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T03:32:00+09:00`

## Run continuity

This is the existing active Rerun run. **Do not create a new run_id, reset sequence, or replace the task_id.** Sequence 0 / `phase13-closeout-ui-dice-regression` remains completed and its historical validation evidence is preserved.

Preserved verified Phase 13 implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved exact-head workflow evidence:

- Contract validation `31955742556` — success
- Rules Domain `31955742577` — success
- Persistence `31955742563` — success
- UI `31955742530` — success
- Phase 11 Playable `31955742560` — success
- Phase 12 Connected Session `31955742539` — success
- Phase 13 SessionProjection `31955742524` — success

Preserved Phase 13 artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

## Current product contract

The active sequence is the V1-completion umbrella on `work/v1-composite`.

- Finish all intended V1 functionality through real production paths.
- Preserve the current visible UI structure/style as the V1 baseline.
- Do not perform broad redesign while filling implementation gaps.
- Do not run a comprehensive Codex audit after every slice.
- After all pre-release implementation is present, freeze one exact canonical SHA and run the comprehensive Codex audit once at the V1 boundary.

## Completed in this execution

Selected implementation gap: `V1-11 Campaign product UI` lifecycle/error/destructive behavior.

### Campaign archive confirmation

- Added deterministic structure coverage in `tests/ui/campaignProductUiStructure.test.ts`.
- `CampaignScreen` no longer calls `archiveCampaign()` directly from the card secondary action.
- `archiveTarget` opens a confirmation overlay using the existing `campaign-session-setup` visual pattern.
- Confirmation explicitly states that archive does not delete Character files, installed content, or Campaign continuity data.
- Cancel/close performs no mutation.
- Confirm performs the existing authoritative archive command.
- No broad layout/style/navigation change was made.

Commits:

- `66ca74d` — require destructive archive confirmation in structure test
- `36eecfc` — confirm archive before mutation

### Campaign startup hydration blockers

- Added `campaignHydrationIssueAdapter.ts` around the Campaign runtime snapshot boundary.
- It classifies only canonical Campaign persistence blockers:
  - `CampaignMigrationRequiredError`
  - `CampaignSchemaError`
  - `CampaignCorruptError`
- It never auto-deletes, resets, clears generations, or writes replacement data.
- It rethrows the original error after publishing an explicit UI issue.
- Added `CampaignStartupRecoveryBridge.tsx`, rendered inside the existing AppProvider shell.
- The bridge reuses existing `loading-screen` and `campaign-empty` UI language and offers `다시 시도` via `refresh()` only.
- `main.tsx` installs the guard before AppProvider module evaluation; the guard imports `campaignRuntimeAdapter` first so it wraps the Campaign snapshot boundary rather than the base MockAdapter method.
- React subscription cleanup is explicitly void-safe.

Commits:

- `b8c5eab` — startup recovery structure contract
- `ba40608` — hydration blocker classification guard
- `25a435f` — explicit startup recovery bridge
- `a1d50d6` — production entry integration
- `b2ec43f` — void cleanup fix

### Documentation checkpoint

- `.agents/V1_CURRENT_HANDOFF.md` updated at `a4b6012` with the exact current implementation and next action.

## Validation evidence available in this execution

- Deterministic structure tests were authored alongside the feature changes.
- GitHub combined status for `36eecfc` returned no status/check entries; **do not record this slice as CI green**.
- Comprehensive Codex audit was intentionally not started because the user requires it only after all V1 implementation is complete.
- No previously verified work was rerun.

## Current known functional gap

`docs/design/campaign-systems.md` defines Campaign lifecycle DM operations including create/open/**duplicate/archive/restore/delete**. Production Campaign UI currently exposes create/open/archive/restore but still lacks duplicate/delete user paths.

V1-11 therefore remains functionally incomplete even though archive/error states improved.

## Next Exact Action

Implement **Campaign duplicate + explicit delete lifecycle** without redesigning the Campaign screen.

1. Re-read lifecycle sections in `docs/design/campaign-runtime.md` and `docs/design/campaign-systems.md`.
2. Follow existing Campaign command flow through `CampaignApplicationService`, persistence contracts/repository, `campaignRuntimeAdapter`, AppProvider and `CampaignScreen`.
3. Add duplicate semantics that do not copy player-owned Character files or installed content ownership.
4. Add explicit delete command that removes only the Campaign-owned record and leaves external Character/content stores untouched.
5. Reconcile `activeCampaignId` safely when the active Campaign is archived/deleted.
6. Use existing Campaign card/overlay visual language for confirmation and duplicate options; no broad UI redesign.
7. Add deterministic focused tests as part of implementation; do not start the final Codex audit.
