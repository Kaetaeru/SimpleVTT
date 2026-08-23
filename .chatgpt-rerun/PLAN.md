# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization, Party Stash policy enforcement, and Session UI work. Do not route to `main`, repeat validated source work, or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

The previous coordination checkpoint named `cbf20abf4870807348443728c6fd6022113ef14c`, but actual `work/v1-composite` had already advanced through Party Stash policy persistence and approval-queue source work before this execution. GitHub actual state is authoritative.

This execution further added:

- `7716bcd7241fdcaaf6fd66fcbe44714e9721f659` — Party Stash approval state now separates `approved` from `committed`; a request cannot claim `committed` directly from `pending`.
- `1d92f18d201fa0242e9203716430c24dd03b516b` — deterministic queue contracts require approval before commit and cover rejection, cancellation, idempotent approval, and invalid terminal transitions.

Current exact product/test head before coordination checkpoint writes: `1d92f18d201fa0242e9203716430c24dd03b516b`.

## Validation status

**NO GREEN CLAIM.** Source-authored tests exist, but no executable CI/local evidence was observed for the new approval-state changes during this execution. Do not convert authored tests into execution evidence.

## Remaining V1-13 work

1. Production runtime still does not expose a user-reachable Campaign Party Stash policy selector even though `shared | dm-approval | dm-managed` persistence/runtime support exists.
2. Player Session Stash UI currently disables `dm-approval` withdrawals instead of submitting a pending withdrawal request.
3. The approval queue is still an isolated Session-memory object. It is not yet wired to Player request submission, DM approve/reject/cancel controls, Session cleanup, or the connected Host authority path.
4. On DM approval, the implementation must call the existing authoritative `transferPartyStash` transaction and mark the queue `committed` only after that transfer succeeds. Do not create a second asset mutation path.
5. Pending requests must not mutate assets. Session end should cancel/clear pending or approved-but-uncommitted requests according to the V1 Session-transient contract.
6. Reconnect/duplicate request semantics must preserve request identity and avoid duplicate transfers.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD; preserve commits through `1d92f18d201fa0242e9203716430c24dd03b516b` unless GitHub has advanced.
2. Wire `campaignPartyStashPolicyRuntimeAdapter` into the production Campaign application/UI path and expose a Campaign selector for `shared | dm-approval | dm-managed`.
3. Change Player `dm-approval` withdraw controls from disabled direct transfer to pending request submission without asset mutation.
4. Expose pending requests to the DM with approve/reject/cancel actions.
5. Approval must call the existing durable `transferPartyStash` path; only successful authoritative transfer may transition `approved -> committed`. Transfer failure must remain non-committed and surface recoverably.
6. Add Session-end cleanup and deterministic tests for duplicate/reconnect, policy changes while pending, transfer failure after approval, reject/cancel, and successful commit.
7. Re-audit the V1-13 checklist after the full approval slice, then continue the next unblocked V1 implementation slice.
8. Keep the comprehensive Codex audit deferred until implementation freeze; exact-head regression and Windows two-instance acceptance remain release evidence requirements.
