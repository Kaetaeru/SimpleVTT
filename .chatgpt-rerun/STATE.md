# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T11:05:00+09:00`

## Preflight reconciliation

This execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order and then re-read the V1 canonical/product contracts. control, STATE and PLAN reconciled to run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

Actual GitHub state had advanced beyond the previous product/test checkpoint `cbf20abf4870807348443728c6fd6022113ef14c`. The branch head before this execution's edits was `eba92b678e2c095a147699e374281ee8a897f1fc`, so the intervening Party Stash policy runtime/persistence/approval-queue work was preserved rather than repeated.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durability and source-connected owner/Host recovery;
- Campaign-authoritative Party Stash and existing durable `transferPartyStash` transaction path;
- Party Stash policy enforcement for `shared | dm-approval | dm-managed`;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. `SessionPlayerInventoryPane` already displays the active Stash policy, but `dm-approval` withdrawal is simply disabled. No Player request is submitted.
2. `campaignPartyStashPolicyRuntimeAdapter` provides policy persistence/runtime support, but the production `AppProvider`/Campaign UI path does not yet expose it to users.
3. `PartyStashApprovalQueue` existed, but its prior state model allowed `pending -> committed` directly. That could claim an asset commit without proof that the existing authoritative Stash transfer had actually succeeded.
4. Existing `transferPartyStash` is the correct asset authority and must be reused after approval; the approval workflow must not implement a parallel Character/Campaign mutation path.

## Completed in this execution

### Approval state cannot claim commit before approval

- `7716bcd7241fdcaaf6fd66fcbe44714e9721f659` — `src/app/partyStashApprovalQueue.ts`
  - adds explicit `approved` state;
  - `approve(requestId)` performs idempotent `pending -> approved`;
  - `committed` is legal only from `approved`;
  - reject is legal while pending;
  - cancel is legal from pending or approved;
  - conflicting terminal transitions reject.

### Deterministic source contracts updated

- `1d92f18d201fa0242e9203716430c24dd03b516b` — `tests/ui/partyStashApprovalQueue.test.ts`
  - commit-before-approval rejection;
  - idempotent approval;
  - approved -> committed;
  - pending reject;
  - pending/approved cancel;
  - invalid terminal-transition rejection;
  - existing duplicate request/payload-drift/clear contracts retained.

Exact product/test head before coordination checkpoint writes: `1d92f18d201fa0242e9203716430c24dd03b516b`.

## Validation status

**NO GREEN CLAIM.** The source changes and deterministic tests were authored on GitHub, but no executable local/CI result was observed during this execution for these new commits. Do not treat test source as execution evidence.

The environment did not provide a runnable checked-out repository for local npm/TypeScript execution during this checkpoint, so no `npm`, `tsc`, build, Rust/Tauri, or Windows two-instance result is claimed.

## Current V1-13 assessment

V1-13 remains **IMPLEMENTATION IN PROGRESS / VALIDATION PENDING**.

Remaining product gaps:

1. user-reachable Campaign Party Stash policy selector;
2. Player `dm-approval` withdrawal request submission;
3. DM pending-request approve/reject/cancel UI/application path;
4. approval -> existing authoritative `transferPartyStash` -> committed sequencing;
5. transfer-failure behavior after approval without false commit;
6. Session-end pending cleanup plus duplicate/reconnect/policy-change tests;
7. executable exact-head validation and later Windows two-instance acceptance.

## Next Exact Action

1. Reconcile mandatory Rerun docs and actual HEAD; preserve product commits through `1d92f18d201fa0242e9203716430c24dd03b516b` unless GitHub has advanced.
2. Connect `campaignPartyStashPolicyRuntimeAdapter` to production `AppProvider`/Campaign UI and add the authoritative Campaign policy selector.
3. Wire Player `dm-approval` withdrawal into `PartyStashApprovalQueue.submit` instead of direct asset mutation.
4. Add DM approve/reject/cancel controls. `approve` alone must not mutate assets.
5. After approve, call the existing durable `transferPartyStash`; only success may call `settle(requestId,"committed")`.
6. Add Session-end cancellation/clear and deterministic reconnect/idempotency/policy-change/transfer-failure tests.
7. Re-audit V1-13 before advancing to later V1 implementation slices. Keep the comprehensive Codex audit deferred until implementation freeze.
