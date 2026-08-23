# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T09:39:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order before project work. The records reconciled to the same run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`, and the relevant `docs/design/campaign-systems.md` sections were rechecked. Actual starting branch HEAD was `3f62527e48ab55c506cf6ec3901b4bb41228c7c8`. GitHub returned no combined statuses and no commit-associated workflow runs. V1-12 source-connected Long Rest work was therefore preserved rather than repeated.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest distributed durability and restart recovery source boundary;
- Character durable ownership on the owning Player Client for connected remote Characters;
- Host authority over Session transient state and Campaign-owned state;
- connected Character SessionProjection reconstruction/refresh without Host Character-library ownership;
- existing Campaign Party Stash persistence/local compensation;
- existing connected Player self-service Stash request/Host Campaign commit flow;
- existing Campaign DM Library custom item/NPC/image foundations and local tests;
- comprehensive Codex audit remains deferred until implementation freeze.

## V1-13 audit findings

The release checklist's V1-13 `TODO` state is stale relative to current source.

Existing source already covered substantial V1-13 behavior, including local Party Stash Character/item/GP movement, Campaign persistence, compensation on Campaign failure, connected Player self-service Stash sequencing, catalog-less item templates, and DM Library Character/Stash materialization.

The first concrete ownership gap was Host-originated inventory mutation of a mounted remote Player Character:

- `sessionInventoryRuntimeAdapter.adjustDmInventory()` durably persisted only when the target was the process-local active Character;
- a mounted remote Character is not Host-owned durable Character data and therefore fell through to transient Host/session inventory state;
- Host-side Party Stash transfer, currency adjustment, or Campaign DM Library Character grant could consequently bypass the owner's durable Character library.

## Completed in this dispatch

### 1. Request-scoped inventory compensation

Commits:

- `41ffd09da27d3178e94569a5718304a5338e5a3a` — initial request-scoped undo contract;
- `c282b8a08e2245d3da8ab8746f7d2ef10f3d59bb` — corrected the contract so undo preserves later unrelated changes instead of restoring a whole stale snapshot;
- `9f123cdde3056e253a8584e76ffff36e54624e7c` — implemented request-id keyed before/after records and delta-based compensation.

`sessionInventoryRuntimeAdapter.ts` now exposes `undoDmInventoryAdjustment(requestId)` and retains `undoLastDmInventoryAdjustment()` only as a compatibility convenience over the request-scoped journal.

Delta compensation:

- reverses only the selected GP delta;
- reverses exact item-instance quantity delta;
- can restore an item removed by a prior revoke;
- restores force-unequip state only if later state has not diverged;
- rejects unsafe compensation rather than silently overwriting later Character changes;
- repeated request-scoped undo is idempotent while the process journal exists.

It also exports `refreshSessionCharacterInventoryProjection()` so Host can refresh a remote Character's session-visible inventory without creating Host durable Character ownership.

### 2. Host -> owner Client inventory mutation transport

Commit:

- `706fc1a8a55e2d9b9e6c58a09a3849fa882161a0`

`connectedCampaignSystemsRuntimeAdapter.ts` now adds validated `campaign-owner-inventory` apply/undo and `campaign-owner-inventory-result` messages.

Normal connected path:

1. Host detects that `adjustDmInventory()` targets a currently mounted remote Character.
2. Host routes the exact mutation to that Character's accepted owner peer instead of mutating Host shadow state.
3. Owner Client verifies active Character identity and executes existing `adjustDmInventory()` locally; because it is the owner's active Character, the existing Character-library durable writer owns the write.
4. Owner builds a fresh `CharacterSessionProjectionV1` after the durable apply/undo.
5. Host verifies peer/Character/source/runtime revision identity.
6. Host reconstructs the projection and calls `refreshReconstructedCharacterSessionProjection()`.
7. Host refreshes session-visible remote inventory and accepted peer-manifest Character revision.
8. No remote Character is copied into Host durable Character storage.

The same routing therefore covers the Character half used by Host Party Stash, GP, and Campaign DM Library Character actions.

### 3. Connected Stash compensation precision

The connected Player self-service Stash flow now calls `undoDmInventoryAdjustment(command.requestId)` for Host rejection/timeout instead of a global last-undo call. This prevents an unrelated later local inventory mutation from being selected accidentally during the normal connected rollback path.

The Host wrapper also retains request->owner routing metadata so its compensation can be sent back to the owner Client when the underlying local Campaign transfer path asks for inventory undo.

### 4. Source/wire contracts

- `6dc461630c9df1cb1fc88b56f074e9273441ed0b` — first remote-owner structure contract;
- `9bf0425910f03f37c084c3e283a2d3bca9c7c077` — structure contract aligned to the implemented owner request/refresh path;
- `05eb6790404ed617b8b15702b0372bd6a4bef8ee` — deterministic owner-inventory wire decoder tests for apply, undo, malformed mutation, and accepted-result revision identity.

Exact product-code head before Rerun coordination docs: `05eb6790404ed617b8b15702b0372bd6a4bef8ee`.

## Current V1-13 assessment

V1-13 is **IMPLEMENTATION IN PROGRESS / VALIDATION PENDING**.

The normal connected owner-authoritative write-back gap is source-connected, but cross-process transaction durability is not yet complete.

### Exact remaining durability gap

`sessionInventoryRuntimeAdapter` request IDs and before/after undo records are process memory. Therefore this failure window remains:

1. Host sends owner inventory apply;
2. owner durably commits the Character mutation;
3. owner process dies or the acknowledgement is lost before Host observes success;
4. Host later sends compensation/undo;
5. restarted owner no longer has the exact in-memory undo record and cannot safely know whether/how the original request committed.

A blind inverse is unsafe because the original apply may also have been lost before owner commit. This is analogous to the restart window already solved for connected Long Rest and should be closed with a durable owner-side inventory transaction journal/sidecar rather than guessed from current Character state.

Also, the underlying local `campaignRuntimeAdapter` Character->Stash failure path still calls `undoLastDmInventoryAdjustment()`. The connected wrapper currently makes that reach the most recent remote request in ordinary serialized UI use, but exact request-specific compensation must replace this dependency before concurrency/restart acceptance is considered complete.

## Validation status

**NO GREEN CLAIM.**

Exact product head `05eb679` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed result exists for:

- new `sessionInventoryRuntimeAdapter` request-scoped undo test;
- new `connectedCampaignSystemsStructure` owner-routing assertions;
- new `connectedCampaignOwnerInventoryWire` tests;
- `tsc --noEmit` / `npm run build`;
- Rust/Tauri build;
- Windows two-instance connected Stash/DM Library acceptance.

Source-authored tests are not execution evidence. Do not claim V1-13 cross-store atomicity or release completion yet.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head executable evidence; if still absent, do not repeat V1-12 or the newly source-connected normal owner write-back path.
3. Implement a durable owner inventory transaction journal/sidecar for `campaign-owner-inventory` apply/undo/finalize so exact replay and compensation survive owner process restart and lost acknowledgements.
4. Make Host/Campaign completion explicitly finalize that owner journal only when compensation is no longer needed.
5. Replace the remaining Character->Stash compensation dependency on global `undoLastDmInventoryAdjustment()` with exact request identity/coordinator state.
6. Add deterministic restart/replay contracts for applied-before-ack restart, apply replay, undo after restart, duplicate undo/finalize, and no Character-only/Campaign-only success.
7. Then finish the remaining V1-13 DM Library privacy/isolation/UI acceptance audit; do not start the comprehensive Codex audit early.
