# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T11:29:00+09:00`

## Preflight reconciliation

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then re-read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and the Campaign systems design contract. At start, actual branch HEAD was exactly the prior coordination checkpoint `3ae07a7865ccb08f2c2c9b3c09d9d006ddf640ac`; control was the same run/sequence/task with status `continue`. No concurrent writer was observed before the product/test writes.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durability and existing Host/owner recovery/compensation path;
- Campaign-authoritative Party Stash and the existing durable `transferPartyStash` transaction;
- Party Stash policy selector and connected `dm-approval` Player -> Host request path;
- DM approve/reject/cancel/retry UI and queue state `pending -> approved -> committed`;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. Existing Phase 12/13 connected tests already expose a deterministic harness pattern: configure `connectedStateFor`, mount a projected Character, and replace singleton transport methods when testing authoritative connected behavior. The clearest recovered example is `tests/ui/connectedProjectedCharacterResolution.test.ts` from commit `615b3a329a19ad6a458a83eb65a0d53b3f12becc`.
2. `characterSessionProjectionRegistry` exposes `mountCharacterSessionProjection`/`unmountAllCharacterSessionProjections`, which is sufficient to satisfy approval-time connected-owner revalidation without inventing a new ownership seam.
3. Exact-head GitHub CI remains absent. There is still no executable local checkout in this environment.

## Completed in this execution

### Runtime approval authority sequencing test source

- `9bc8af2f48eb1cc1c235d3225531dad473fbc4f7` created `tests/ui/connectedPartyStashApprovalRuntime.test.ts`.
- Static review found the initial draft referenced progression-augmented `CharacterSheet` fields while only the base contract was imported.
- `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f` corrected the test to use explicit manifest revision values and remain on the base sheet contract.

The final test source now covers:

1. **Successful approval sequencing** — after current Host/session/policy/permission/owner validation, `approvePartyStashApproval` delegates the exact original command to the existing `transferPartyStash`; only after that promise succeeds does the queue become `committed` and disappear from active requests.
2. **Transfer failure recovery** — a thrown authoritative transfer leaves the request `approved`, records the failure, remains visible, and a later successful retry can commit the same request without a false prior commit.
3. **Policy change revalidation** — changing `dm-approval -> shared` before first approval causes approval rejection while the request remains `pending`.
4. **Connected owner change revalidation** — changing the peer-to-participant mapping before first approval causes approval rejection while the request remains `pending`.

The test deliberately substitutes the instance `transferPartyStash` method only to observe delegation and failure sequencing; it does not introduce or test a parallel asset mutation path. A later connected harness case must still prove the real owner transfer/compensation stack end-to-end.

Exact product/test head before coordination writes: `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`.

## Validation status

**NO GREEN CLAIM.** `get_commit_combined_status` returned no statuses and exact-head workflow lookup returned no workflow runs for `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`. The current environment still has no runnable checked-out repository, so no Node test, npm test, TypeScript compile, UI build, Tauri, Rust, or Windows two-instance result is claimed.

The new test was statically rechecked against the current `SessionCompatibilityManifest`, base `CharacterSheet`, connected state, and projection registry contracts. Source review is not execution evidence.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED APPROVAL SLICE / VALIDATION PENDING**.

Newly source-covered validation boundary:

- approval delegates to existing transfer before commit;
- failed transfer remains approved/retryable;
- pre-approval policy change remains pending;
- pre-approval connected-owner change remains pending.

Remaining evidence/UX gaps:

1. actual Player request transport -> Host queue acknowledgement test, including proof that request submission alone does not mutate assets;
2. duplicate/reconnect identity behavior through the actual transport wrapper stack;
3. roster permission change, reject/cancel, and real Session stop cleanup runtime tests;
4. connected approval through the real owner-side transfer/compensation stack rather than an observation stub;
5. exact-head TypeScript/test/build execution evidence;
6. optional Player-facing final approval/rejection/cancellation notification;
7. V1-13 checklist re-audit and later Windows two-instance acceptance.

## Next Exact Action

1. Reconcile mandatory Rerun docs and actual HEAD; preserve product/test commits through `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f` unless GitHub advanced.
2. Reuse the recovered connected-session test harness pattern to test the approval request transport itself: establish test Host/Client listener state, submit a Player `dm-approval` withdrawal, verify exactly one Host pending request and no asset mutation, then exercise duplicate/reconnect identity.
3. Add real runtime coverage for permission changes, reject/cancel, and Session stop cleanup. Do not duplicate the authority-sequencing tests added here.
4. Extend one connected case through the existing owner-side `transferPartyStash`/compensation stack so successful DM approval is proven end-to-end.
5. Run exact-head TypeScript/tests when an execution path is available. Do not infer green from source-authored tests.
6. Re-audit V1-13 after executable validation. Keep comprehensive Codex audit deferred until implementation freeze.
