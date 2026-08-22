# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T04:29:00+09:00`

## Run continuity

This is the existing active Rerun run. Do not create a new run_id, reset sequence, or replace task_id. Preserve prior exact-head Phase 13 evidence, Ready/connected work, V1-11 Campaign lifecycle history, and the V1-12 declarative provider implementation. Comprehensive Codex audit remains deferred until all V1 pre-release implementation is complete.

## Preflight for this dispatch

- Mandatory Rerun order read: README -> control -> STATE -> PLAN.
- Reconciled `continue`, sequence `1`, task `phase14-production-play-session-ux`.
- Confirmed `work/v1-composite` remains canonical.
- Re-read current V1 handoff, release checklist, Campaign Rest contract, existing rest/domain/runtime/persistence sources.
- Did not repeat the completed provider core/UI work.

## Preserved prior checkpoint — declarative providers

Calendar/Ration declarative provider core/runtime/UI is code-connected. Provider exact-head validation is still pending because direct-push Actions results are not exposed by the current connector. Do not reopen that implementation merely to obtain validation.

## Completed in this dispatch — Long Rest compound prerequisites

### Existing authority reconciliation

Source inspection established that there is no generic production Long Rest command today. Existing `configureWizardLongRest`, `configurePactTomeRest`, and `configureCircleLandRest` are class-specific rest configuration commands, not Rest resolution.

The canonical domain authority **does** already exist and must be reused:

- `resolveLongRest()` in `src/domain/rest.ts` handles HP/Temporary HP, life/death-save reset, Hit Dice, declarative long-rest resources, rest-expired effects, and one Exhaustion level.
- `resolutionRestOps.ts` already exposes canonical `kind:"long-rest"` resolution behavior and state changes.
- `resources.ts` already owns `recovery.longRest`, recovery lockout, and temporary maximum semantics.

No duplicate Campaign/UI rest arithmetic should be introduced.

### Durable Character projection

- `98b2de9` — added `characterLongRestProjection.test.ts` contract.
- `aeb65c1` — added `characterLongRestProjection.ts`, a pure application projection over domain `resolveLongRest()`.
- It updates only Character-owned durable HP/Temporary HP/life flags/resources plus optional Session effects output.
- It intentionally does not change Campaign time/rations.
- A dead/0-HP Character is rejected rather than resurrected.

### Cross-store compound staging foundation

Existing Character and Campaign repositories each commit independent immutable generations. Sequential repository commits cannot satisfy the V1 no-partial-success requirement.

Added a staging layer without changing existing repository `commit()` semantics:

- `a7aa126` / `5c7ebbe` — `characterCampaignCompoundPersistence.test.ts` contracts preparation, participant-failure atomicity, and successful dual generation visibility.
- `55b70c7` — `characterCampaignCompoundPersistence.ts`:
  - `prepareCharacterLibraryGeneration()` builds the next Character generation payload without writing.
  - `prepareCampaignLibraryGeneration()` builds the next Campaign generation payload without writing.
  - both use the actual physical generation head, so recovery from an older valid generation does not accidentally reuse a generation number.
  - defines the `CharacterCampaignCompoundWriter` contract.
  - provides `MemoryCharacterCampaignCompoundWriter` for deterministic test/development atomicity.
- `b0f5095` — Memory Character store now separates all failure/stale checks into `preflightCompoundWrite()` and has a non-failing apply step; normal single writes use the same path.
- `b4056e5` — Memory Campaign store uses the same preflight/apply structure.

Memory/test atomicity is now structurally possible: both participants are preflighted before either generation is applied.

## Validation status

- New focused tests were authored but their execution result was not observed in this dispatch.
- No GitHub Actions green claim is made.
- No comprehensive Codex audit was started.
- Current work is a prerequisite foundation, not V1-12 DONE.

## Current functional boundary

The remaining blocker before production Long Rest UI/runtime can be safely wired is **Windows/Tauri cross-store atomic generation persistence**. Existing Tauri Character/Campaign generation commands are independently atomic only within their own store.

## Next Exact Action

Implement the production `CharacterCampaignCompoundWriter` on Tauri, then wire the Long Rest compound user path.

1. Extend the Tauri generation-store layer with a Character+Campaign compound transaction.
2. Preflight both expected/next generations before any visible commit.
3. Durably stage/fsync both payloads before creating a transaction commit point.
4. Add startup/read recovery for a committed-but-not-fully-materialized transaction so one store is never exposed as the successful final state while the other remains old.
5. Add Rust deterministic tests for pre-commit failure and committed interruption recovery.
6. Expose `write_character_campaign_compound` through `src-tauri/src/lib.rs` and a TS platform writer.
7. Then add production Long Rest coordinator: domain Rest projection + optional Calendar advance + optional Ration consume -> prepare both generations -> one compound write -> rehydrate/project only after success.
8. Add only minimal preview/options/action to the existing Rest surface; do not redesign UI.
9. Calendar/Rations OFF or missing provider disable only those optional side effects; they must not block Rest itself.
