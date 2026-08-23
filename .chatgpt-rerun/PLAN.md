# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization, Party Stash policy/approval flow, Session UI work, request transport coverage, and approval authority sequencing. Do not repeat source-complete work, route to `main`, or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

This watcher execution started from coordination head `3d3caa7cbb62e1c6e681ee3ca3d6027de95b3790`. Mandatory `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` reconciliation, canonical handoff/checklist reads, Campaign design reread, and branch comparison showed `work/v1-composite` identical to that checkpoint before new work began. A second pre-write reconciliation also found no concurrent writer.

Current exact product/test head before coordination checkpoint writes: `db561a2fe5e438fa37741130d212cfa288de9794`.

## Completed in this execution

- Confirmed the actual connected Session lifecycle rather than relying on the earlier truncated fetch: `connectedSessionRuntimeAdapter.ensureListeners()` registers the current composed `tauriSessionTransport.onMessage` chain from both `hostSession()` and `joinSession()`.
- Reconfirmed authoritative withdrawal transaction order in `campaignRuntimeAdapter`: Campaign Stash debit -> owner Character mutation; owner mutation failure -> inverse Campaign compensation. Approval continues to call the existing `this.transferPartyStash` path rather than a parallel mutation route.
- Confirmed later production wrappers remain reachable dynamically: Party Stash approval is installed before `connectedOwnerInventoryJournalAdapter` and `connectedOwnerInventoryExactCompensationAdapter`, so approval-time `this.transferPartyStash` reaches the real owner journal/remote inventory path.

### Real connected owner-transfer E2E source

- `9b4ba2253f7a169a8a5872dc64e748670065768d` created `tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts`.
- `4527186e600287148b5f53a4f42594c55405b6fb` added the required progression contract augmentation and cleaned the remote owner fixture.
- `f5ee5256463638f2daeb453a4fc918471471a52c` aligned the test with production lifecycle ordering by installing `productionSessionLifecycleAdapter` before Party Stash approval.
- The test uses a real connected hello/hello-ack owner projection and Host Campaign projection, then proves source-level intent for:
  1. Player approval request -> Host pending queue;
  2. DM approval -> existing `transferPartyStash` -> remote `campaign-owner-inventory` request/result -> owner Character currency grant -> Host owner projection refresh -> committed queue;
  3. remote owner mutation failure without replacing `transferPartyStash`;
  4. failure-time Campaign Stash compensation and unchanged Player currency;
  5. request remains `approved` with error and can retry;
  6. same approved request later succeeds exactly once after the owner mutation fault is removed.

### Existing transport/runtime coverage hardened

- Static inspection found that the previous transport test called `stopSession()` without mounting the production lifecycle adapter that Party Stash approval wraps in `src/main.tsx`.
- `b8846555d7dd6e0bf946c71f0cfbd92fd373c994` aligned `connectedPartyStashApprovalTransport.test.ts` with the production lifecycle and uses a saved non-reference Player Character fixture.
- `806e895970449f8bf51d7ad352a2cb62ec56da78` extended `connectedPartyStashApprovalRuntime.test.ts` so roster permission downgrade (`request -> view`) is revalidated before approval and leaves the request pending.
- `db561a2fe5e438fa37741130d212cfa288de9794` extended the connected transport lifecycle fixture so Session stop clears both one `approved`-but-uncommitted request and one `pending` request after a successful production-lifecycle stop.

No production asset mutation implementation was replaced or duplicated in this execution; changes are deterministic test-source coverage and lifecycle alignment only.

## Validation status

**NO GREEN CLAIM.** Exact-head `db561a2fe5e438fa37741130d212cfa288de9794` has no combined statuses and no workflow runs. This environment still has no runnable checked-out repository, so no Node test, TypeScript compile, npm regression, UI build, Tauri, Rust, or Windows two-instance result is claimed.

Static review caught and corrected two execution-premise risks before checkpoint: progression type augmentation for the remote fixture, and production `stopSession` lifecycle ordering in the transport tests. Source inspection is not executable evidence.

## Remaining V1-13 work

1. Run exact-head TypeScript/unit/UI regression as soon as a runnable checkout or CI path exists; fix any dynamic-import, wrapper-order, async listener, or type errors before calling V1-13 green.
2. Decide whether Player-facing final approval/rejection/cancellation status is required beyond the current Host queue acknowledgement. If required, use only the established connected transport; do not create another asset mutation route.
3. Re-audit V1-13 against the release checklist after executable validation. The source coverage now includes request transport, duplicate/reconnect identity, policy/permission/owner revalidation, reject/cancel, pending/approved cleanup, real owner transfer, compensation, and retry.
4. Continue the next unblocked V1 implementation slice once V1-13 executable evidence is available or if another source-only prerequisite is explicitly identified. Windows two-instance acceptance remains later release evidence.
5. Keep the comprehensive Codex audit deferred until implementation freeze.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD; preserve product/test commits through `db561a2fe5e438fa37741130d212cfa288de9794` unless GitHub advanced.
2. Prefer executable validation of `connectedPartyStashApprovalRuntime.test.ts`, `connectedPartyStashApprovalTransport.test.ts`, and `connectedPartyStashApprovalOwnerTransfer.test.ts` if an exact-head runner becomes available. Do not infer green from authored source.
3. If execution remains unavailable, inspect the release checklist and current Player UX contract to make an explicit decision on final approval/reject/cancel notification; implement only if it is a V1-13 requirement rather than optional polish.
4. Re-audit V1-13 after that decision/evidence and record any genuinely remaining source gap. Comprehensive Codex audit remains deferred until implementation freeze.
