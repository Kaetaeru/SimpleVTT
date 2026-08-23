# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization, Party Stash policy/approval flow, and Session UI work. Do not repeat validated source work, route to `main`, or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

This watcher execution started from coordination head `3ae07a7865ccb08f2c2c9b3c09d9d006ddf640ac`. Mandatory `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` reconciliation and a branch compare showed `work/v1-composite` was identical to that checkpoint before new work began.

Current exact product/test head before coordination checkpoint writes: `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`.

## Completed in this execution

- Located the established connected-session test pattern in `tests/ui/connectedProjectedCharacterResolution.test.ts` via commit `615b3a329a19ad6a458a83eb65a0d53b3f12becc`: tests directly configure `connectedStateFor`, mount projected Characters, and replace transport methods when exercising authoritative connected flows.
- `9bc8af2f48eb1cc1c235d3225531dad473fbc4f7` added `tests/ui/connectedPartyStashApprovalRuntime.test.ts` for runtime-level Party Stash approval authority sequencing.
- Static type reinspection found that the first test draft read progression-augmented Character fields without importing the augmentation. `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f` corrected the test to stay on the base `CharacterSheet` contract using explicit test manifest revisions.
- The new runtime test source covers:
  1. Host approval delegates to the existing `transferPartyStash` method before the queue may become `committed`;
  2. an authoritative transfer failure leaves the request `approved` with the error, visible and retryable, and a later successful retry may commit it;
  3. Party Stash policy change before approval is revalidated and leaves the request `pending`;
  4. connected participant/Character ownership change before approval is revalidated and leaves the request `pending`.
- No production asset mutation path was added or replaced. The approval runtime still reuses the existing authoritative `transferPartyStash` transaction.

## Validation status

**NO GREEN CLAIM.** `get_commit_combined_status` returned no statuses and exact-head workflow lookup returned no workflow runs for `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`. The environment still does not provide a runnable checked-out repository, so the new Node/TypeScript test source has not been executed. No `npm`, TypeScript, build, Tauri, or Windows two-instance result is claimed.

The test was statically checked against `SessionCompatibilityManifest`, `CharacterSheet`, connected state, and projection-registry contracts; this is not executable evidence.

## Remaining V1-13 work

1. Exercise the actual Player request transport wrapper: Player `dm-approval` request -> Host queue acknowledgement, including duplicate request identity and reconnect behavior.
2. Extend deterministic runtime coverage for roster permission changes, reject/cancel application methods, and real Session lifecycle cleanup of pending and approved-but-uncommitted requests.
3. Add an end-to-end connected harness case where DM approval traverses the existing owner-side transfer/compensation stack rather than substituting a test `transferPartyStash` method.
4. Run exact-head TypeScript/unit/UI regression as soon as a runnable checkout or CI path is available and fix any wrapper/import-order/type failures before calling V1-13 green.
5. Decide whether Player-facing final approve/reject/cancel status is required beyond current Host-queue acknowledgement; if added, use only the established connected transport and never a second asset mutation path.
6. Re-audit V1-13 against the release checklist, then continue the next unblocked V1 implementation slice. Windows two-instance acceptance and comprehensive Codex audit remain later release evidence.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD; preserve product/test commits through `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f` unless GitHub advanced.
2. Reuse the existing connected-session test harness pattern to exercise the approval request transport itself: establish test Host/Client listener state, send a `dm-approval` withdrawal request, assert one Host pending record and no asset mutation, and prove duplicate/reconnect identity behavior.
3. Add real lifecycle tests for permission/policy/owner changes, reject/cancel, and Session stop cleanup; retain the new runtime authority-sequencing tests rather than duplicating them.
4. Run exact-head TypeScript/tests if an execution path becomes available; authored test source alone is not green evidence.
5. Re-audit V1-13 after executable validation. Keep the comprehensive Codex audit deferred until implementation freeze.
