# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T12:10:00+09:00`

## Preflight reconciliation

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/campaign-systems.md`, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`. Actual branch state at start matched prior coordination checkpoint `d2c000e4530b375c6610ebc1bb1cb9663bbf1ff0`; run/sequence/task/status were unchanged and valid.

The handoff/checklist V1-13 selector/queue TODO wording is stale relative to current GitHub source and this Rerun state. It was not replayed. Immediately before coordination writes, comparing prior coordination head to the branch showed exactly 12 commits ahead, matching exactly the 12 Party Stash outcome source/test writes from this execution and their changed files; no divergent concurrent writer was observed.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned Character durability and Host/owner recovery/compensation paths;
- Campaign-authoritative Party Stash and the existing durable `transferPartyStash` transaction;
- Party Stash policy selector and connected `dm-approval` Player -> Host request path;
- DM approve/reject/cancel/retry UI and queue state `pending -> approved -> committed`;
- request transport/idempotency/reconnect tests;
- policy/permission/current-owner approval revalidation;
- real remote owner transfer/compensation/retry source tests;
- pending and approved-but-uncommitted Session cleanup;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md` makes initiating-participant result visibility part of the connected transfer contract: final projection/transaction outcome plus private rejection detail. The previous queue-accepted-only Player UX was therefore a V1-13 source gap rather than optional polish.
2. Terminal outcome transport can be added without touching the asset mutation path. Authoritative queue/asset state is finalized first; Player notification is targeted and best-effort afterward.
3. A single latest-notice slot would lose earlier results if multiple DM decisions arrived rapidly, so outcome delivery must be queued FIFO on the Client.
4. After closing that gap, selective canonical-spec re-audit found the next genuine V1-13 source gap: Party Stash compatible ItemInstance -> ration ledger atomic conversion.
5. The canonical ration spec explicitly requires provider-declared capability/tag eligibility and prohibits name-based `food` inference. Current `InstalledCampaignRationProfileV1` has no such declaration, and current Campaign runtime/application service has no atomic conversion API.

## Completed in this execution

### Player terminal Party Stash approval outcomes

Latest product/test write commit returned by the GitHub contents write chain: `aaddc83a6435671048b9fab9d2a91866a992676c`.

Source changes:

- `d218b31185fe9c3944682c6e5fae327036eb156f` — `connectedPartyStashApprovalRuntimeAdapter.ts` gained targeted `campaign-stash-approval-outcome` transport for `committed`, `rejected`, and `cancelled`.
- A successful DM approval still runs the existing authoritative `transferPartyStash` first. Only after successful asset mutation does the queue become `committed` and a Player terminal outcome become eligible.
- Owner-transfer failure still records an `approved` recoverable error and emits no terminal Player result; later successful retry emits `committed` once.
- Rejection/cancellation first settle the Host queue, then send a targeted private Player result. Notification failure cannot undo Host authority.
- `5798ac3d772b2aa01f03a5bbeaddfbf4732e342e` / `392e2a448a3a4ed3875bd598d56f0ce98cf08d90` / `5e0e0be6fe098dd809e144092b7333366e6baffd` — global Player toast bridge/CSS/main mount added under `AppProvider`, so final result can surface even if the inventory pane was closed.
- `9f0723831f63b1ba37ff9f4f47b6c09403874ac3` / `5d20977e62415c07a7da5623a7c6c623c56aad4a` — Client terminal outcomes changed to Session-transient FIFO queue and one-at-a-time UI drain so rapid DM decisions are not overwritten.

Test-source changes:

- `00ccc67b63928f1424ee0d6c7d1ed9949053ad9e` / `322ccb6e56f4b7d7c7d5de8770c8c8e49ee00661` — structure/UI contract covers targeted terminal wire, FIFO outcome store, bridge mount, and approval/reject/cancel labels.
- `34eb2894aba1a27a1695985a9228101c3080986d` / `0af10e2c09f90f5509e8a71873e75d1ee258865a` — transport source test consumes targeted rejection/cancellation outcomes.
- `b14c67c902a49afe6ec6dbae0ebfc9d5e6eeccf3` / `aaddc83a6435671048b9fab9d2a91866a992676c` — real owner-transfer source test consumes successful committed outcomes, asserts owner-transfer failure emits no false terminal result, and consumes committed after successful retry.

No second Party Stash/Character asset mutation route was introduced.

## Validation status

**NO GREEN CLAIM.** Combined status lookup and workflow lookup for the current product/test write boundary returned no statuses/runs. A local exact-branch checkout attempt also failed before any test execution because this environment could not resolve `github.com`.

Therefore no Node, npm, TypeScript, UI build, Tauri, Rust, or Windows two-instance result is claimed. Static/source test coverage and GitHub contents reconciliation are not executable evidence.

One connector inconsistency was observed: contents writes returned product commit identifiers while commit-fetch/compare-by-that-new identifier was not immediately resolvable, but branch comparison from prior coordination head showed exactly the expected 12 source/test commits and expected changed files. Treat branch/file state as authoritative and re-reconcile next dispatch.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED / VALIDATION PENDING**, not DONE.

Approval-related source boundary now includes:

- policy selector and Player request path;
- no mutation while pending;
- approval/reject/cancel/retry;
- `pending -> approved -> committed` authority ordering;
- duplicate/payload drift/reconnect identity;
- policy/permission/current-owner revalidation;
- real owner-side transfer and failure compensation;
- pending/approved Session cleanup;
- targeted Player terminal committed/rejected/cancelled feedback with FIFO transient delivery.

Known limitation: terminal outcome is Session-transient and targeted to the currently mapped peer. A Player disconnected exactly at terminal decision time is not guaranteed replay of that notification after reconnect. Do not claim offline/reconnect replay unless a later contract requires and implements it.

### Next genuine source gap

Canonical `docs/design/campaign-systems.md` requires:

- compatible Party Stash ItemInstance -> integer ration units conversion;
- item decrement and SupplyLedger increment atomically in one Campaign transaction;
- provider-declared capability/tag eligibility, never name heuristics.

Current source has manual ration adjust/consume and normal Party Stash transfer, but no atomic stash-item-to-ration command. `InstalledCampaignRationProfileV1` currently defines daily consumption and shortage consequences only, so eligibility/conversion metadata also needs a minimal data-only contract extension.

This is the next implementation slice; it was not partially hacked into this watcher checkpoint.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve this execution's Party Stash terminal-outcome source unless GitHub advanced.
2. Prefer exact-head execution first if a runner exists: approval runtime/transport/owner-transfer tests plus TypeScript/build. Fix real failures before any green claim.
3. If execution remains unavailable, implement the ration-conversion slice starting with a minimal data-only provider/item eligibility contract. Do not use display-name heuristics.
4. Add one authoritative idempotent Campaign command that validates eligibility and atomically decrements Party Stash item quantity while incrementing ration balance/history under the same Campaign revision.
5. Wire the DM-facing conversion action/preview and deterministic persistence/idempotency/eligibility tests; then re-audit remaining V1-13 Party Stash/DM Library checklist items.
6. Keep Windows two-instance acceptance and comprehensive Codex audit for their later release gates.
