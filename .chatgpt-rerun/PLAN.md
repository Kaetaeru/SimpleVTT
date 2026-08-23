# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization, Party Stash policy/approval/owner compensation flow, Session UI work, and current approval transport tests. Do not repeat source-complete work or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

This watcher execution started from coordination head `d2c000e4530b375c6610ebc1bb1cb9663bbf1ff0`. It re-read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/campaign-systems.md`, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`.

The stale V1-13 TODO wording in handoff/checklist projections was not replayed. GitHub actual state and current Rerun STATE remain authoritative. Before coordination writes, comparing prior coordination head to `work/v1-composite` showed exactly 12 commits ahead and the changed files were exactly this execution's Party Stash outcome transport/UI/test files, with no divergent concurrent writer.

Latest product/test write commit returned by the GitHub contents write chain: `aaddc83a6435671048b9fab9d2a91866a992676c`.

## Completed in this execution

### Player terminal approval outcome contract

`ITEM-CURRENCY-TRANSFER-FOUNDATION.md` requires connected clients to receive the resulting projection/transaction outcome and private rejection detail addressed to the initiating participant. The existing V1-13 flow only acknowledged that a request had reached the Host queue. This execution therefore treats final approve/reject/cancel feedback as required source behavior, not optional polish.

Implemented without creating any asset mutation route:

- `d218b31185fe9c3944682c6e5fae327036eb156f` — added targeted `campaign-stash-approval-outcome` transport for terminal `committed | rejected | cancelled` states.
- The Host first reaches the authoritative terminal queue state. Notification is best-effort and cannot roll back a committed/rejected/cancelled decision.
- Failed owner transfer remains non-terminal `approved` with error/retry semantics and emits no false terminal outcome.
- `5798ac3d772b2aa01f03a5bbeaddfbf4732e342e` + `392e2a448a3a4ed3875bd598d56f0ce98cf08d90` + `5e0e0be6fe098dd809e144092b7333366e6baffd` — added and mounted a global Player toast bridge for approval, rejection, and cancellation. Because it is global under `AppProvider`, the outcome is not lost merely because the inventory pane is closed.
- Static review found that a single latest-outcome slot could overwrite rapid consecutive DM decisions. `9f0723831f63b1ba37ff9f4f47b6c09403874ac3` and `5d20977e62415c07a7da5623a7c6c623c56aad4a` changed this to a Session-transient FIFO queue drained one notice at a time.

### Source test updates

- `00ccc67b63928f1424ee0d6c7d1ed9949053ad9e` / `322ccb6e56f4b7d7c7d5de8770c8c8e49ee00661` — structure contract covers targeted outcome transport, FIFO storage, bridge consumption, and all three Player-visible terminal labels.
- `34eb2894aba1a27a1695985a9228101c3080986d` / `0af10e2c09f90f5509e8a71873e75d1ee258865a` — connected transport source test covers Player rejection/cancellation outcomes.
- `b14c67c902a49afe6ec6dbae0ebfc9d5e6eeccf3` / `aaddc83a6435671048b9fab9d2a91866a992676c` — owner-transfer E2E source test covers committed outcome, proves an approved owner-transfer failure emits no terminal outcome, then verifies committed outcome after successful retry.

The existing authoritative `transferPartyStash`, remote owner inventory, compensation, and Campaign mutation paths remain unchanged.

## Validation status

**NO GREEN CLAIM.** The current product/test write boundary has no combined GitHub status and no workflow runs. A local checkout retry also failed before execution because this environment could not resolve `github.com`, so no Node test, TypeScript compile, npm regression, UI build, Tauri, Rust, or Windows two-instance result is claimed.

GitHub contents writes and branch/file reconciliation confirm the source is present on `work/v1-composite`; source-authored tests remain non-executable evidence until a runner is available.

## Selective V1-13 re-audit

After closing the approval-feedback source gap, the next genuine V1-13 source gap is the canonical Ration/Party Stash conversion contract:

- `docs/design/campaign-systems.md` requires a compatible Party Stash `ItemInstance` to convert into integer ration units in **one transaction**: ItemInstance decreases and `SupplyLedger` increases atomically.
- Conversion eligibility must come from a provider-declared capability/tag, not from item display-name heuristics such as containing `food`.
- Current `campaignRuntimeAdapter.ts` and `CampaignApplicationService.transferPartyStash` expose normal stash transfer plus manual ration adjustment/consumption, but no atomic stash-item-to-ration conversion command.
- Current `InstalledCampaignRationProfileV1` defines daily units and shortage consequences only; it has no eligibility/tag/conversion declaration for compatible food ItemInstances.

This is a contract/schema/runtime/UI/test slice, not a safe late-watcher one-line patch, so it was deliberately not started in this execution.

## Remaining work

1. Obtain executable exact-head TypeScript/test/build evidence for the authored V1-13 approval flow before calling it green.
2. Implement the next V1-13 source slice: provider-declared compatible Party Stash ItemInstance -> ration units atomic conversion, including eligibility contract, application transaction, runtime API/UI, provenance/idempotency, persistence, and deterministic tests.
3. Re-audit the remaining V1-13 Party Stash/DM Library checklist after that slice rather than trusting stale handoff TODO text.
4. Windows two-instance acceptance remains later release evidence.
5. Keep comprehensive Codex audit deferred until implementation freeze.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` state; preserve this execution's 12 Party Stash outcome commits unless GitHub advanced.
2. If a runner becomes available, first execute the approval runtime/transport/owner-transfer tests and TypeScript/build checks. Fix real failures before green claims.
3. Otherwise begin the ration-conversion slice by defining the minimal data-only eligibility/conversion contract on the ration provider/item definition side. Do not infer food compatibility from names.
4. Implement one authoritative atomic command that validates provider eligibility and performs stash item decrement + ration ledger increment under one Campaign revision/idempotency transaction; then wire DM UI and tests.
5. Re-audit V1-13 after executable evidence/source completion. Comprehensive Codex audit remains deferred.
