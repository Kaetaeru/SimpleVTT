# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T11:55:00+09:00`

## Preflight reconciliation

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then re-read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and `docs/design/campaign-systems.md`. Actual branch HEAD at start was exactly prior coordination checkpoint `3d3caa7cbb62e1c6e681ee3ca3d6027de95b3790`; control was the same run/sequence/task with status `continue`. Immediately before product writes and again before checkpointing, branch comparison showed no concurrent writer.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durability and Host/owner recovery/compensation paths;
- Campaign-authoritative Party Stash and the existing durable `transferPartyStash` transaction;
- Party Stash policy selector and connected `dm-approval` Player -> Host request path;
- DM approve/reject/cancel/retry UI and queue state `pending -> approved -> committed`;
- request transport/idempotency/reconnect tests through `2edfcdf16469f71f243aece6efa9e09d9e8f3539`;
- prior approval authority sequencing tests through `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. `connectedSessionRuntimeAdapter` does register the active composed transport listener: `ensureListeners()` is invoked by both connected `hostSession()` and `joinSession()`. The earlier apparent empty file was a truncated fetch artifact, not repository state.
2. Production lifecycle ordering matters for approval tests. In `src/main.tsx`, `productionSessionLifecycleAdapter` exists before `connectedPartyStashApprovalRuntimeAdapter`, so approval wraps a real production `stopSession()` implementation.
3. Authoritative withdrawal order remains Campaign Stash debit -> Character owner mutation; Character mutation failure invokes inverse Campaign compensation before propagating the error.
4. Approval-time `this.transferPartyStash` dynamically reaches the later owner journal and exact-compensation wrappers. No second asset mutation path is needed or permitted.

## Completed in this execution

### Real owner-side connected approval path

- `9b4ba2253f7a169a8a5872dc64e748670065768d` created `tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts`.
- `4527186e600287148b5f53a4f42594c55405b6fb` fixed the remote owner fixture's progression contract/type premise.
- `f5ee5256463638f2daeb453a4fc918471471a52c` aligned the dynamic wrapper imports with production lifecycle order.

The final E2E source now drives a real connected hello/hello-ack owner projection and covers:

- Player approval request -> Host pending queue;
- DM approval -> existing `transferPartyStash` -> remote `campaign-owner-inventory` request/result -> Client currency grant -> refreshed Host owner projection -> committed approval;
- owner mutation fault injection only at the Client inventory seam, never by replacing `transferPartyStash`;
- owner failure leaves Client assets unchanged and restores Campaign Stash through the existing compensation transaction;
- the request remains `approved` with error and is retryable;
- removing the owner fault lets the same request commit exactly once on retry.

### Remaining runtime gaps source-covered

- `b8846555d7dd6e0bf946c71f0cfbd92fd373c994` corrected `connectedPartyStashApprovalTransport.test.ts` to mount the production lifecycle that owns `stopSession()` and changed the Player fixture to a saved non-reference Character so production join is permitted.
- `806e895970449f8bf51d7ad352a2cb62ec56da78` added roster permission downgrade revalidation before approval (`request -> view`), with the request remaining `pending`.
- `db561a2fe5e438fa37741130d212cfa288de9794` changed the Session-stop fixture to contain both one `approved`-but-uncommitted request and one `pending` request, then verifies a successful production lifecycle stop clears both.

Exact product/test head before coordination writes: `db561a2fe5e438fa37741130d212cfa288de9794`.

## Validation status

**NO GREEN CLAIM.** Exact-head combined status lookup returned no statuses and workflow lookup returned no runs for `db561a2fe5e438fa37741130d212cfa288de9794`. The current environment still does not provide a runnable checkout, so no Node test, TypeScript compile, npm regression, UI build, Tauri, Rust, or Windows two-instance execution is claimed.

Static reinspection corrected progression module augmentation and lifecycle-wrapper assumptions. These corrections improve source validity but are not executable evidence.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED APPROVAL SLICE / VALIDATION PENDING**.

Source-covered boundary now includes:

- approval ordering and retry-safe approved failures;
- Player request -> Host queue transport with no request-time mutation;
- duplicate request identity and payload drift rejection;
- same participant/Character reconnect identity;
- policy, roster permission, and connected-owner revalidation before approval;
- reject/cancel application transitions;
- pending and approved-but-uncommitted Session cleanup;
- real connected owner-side transfer/result path;
- failure-time Campaign Stash compensation and later retry.

Remaining evidence/UX gaps:

1. exact-head TypeScript/test/build execution evidence;
2. explicit V1-13 decision on whether Player must receive final approve/reject/cancel status after the current request-accepted acknowledgement;
3. release-checklist re-audit after executable validation or the notification decision;
4. later Windows two-instance acceptance.

## Next Exact Action

1. Reconcile mandatory Rerun docs and actual HEAD; preserve product/test commits through `db561a2fe5e438fa37741130d212cfa288de9794` unless GitHub advanced.
2. If an exact-head runner is available, execute the approval runtime, transport, and owner-transfer tests plus TypeScript/build checks; fix real failures before claiming green.
3. If execution is still unavailable, compare the release checklist and Player UX contract against current behavior and decide whether final approve/reject/cancel notification is a V1-13 requirement. Implement only if required, using established transport only.
4. Re-audit V1-13 after that decision/evidence and continue the next genuinely unblocked V1 slice. Keep comprehensive Codex audit deferred until implementation freeze.
