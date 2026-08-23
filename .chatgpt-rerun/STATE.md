# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T11:19:00+09:00`

## Preflight reconciliation

This execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then re-read the canonical V1 handoff/checklist and Campaign systems contract. At start, actual branch HEAD was exactly the prior coordination checkpoint `745b9509e4cba9484134b4c75edd75697a59d510`; control was the same run/sequence/task with status `continue`. No concurrent writer was observed during the product-write reconciliations.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durability and existing Host/owner recovery/compensation path;
- Campaign-authoritative Party Stash and the existing durable `transferPartyStash` transaction;
- Party Stash policies `shared | dm-approval | dm-managed`;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Completed in this execution

### Campaign policy is user reachable

- `ae3852fec9b3b734a3b056bc6b324e37b9329d48` added the Campaign Party Stash selector.
- Static reinspection found that the first UI draft referenced a nonexistent `setCampaignPartyStashPolicy` method and a nonexistent exported policy type.
- `3db625d43b9a6e1e017f78253668fd2f587db1f0` corrected that before checkpoint: UI now calls the existing `mockAdapter.configureCampaignPartyStashPolicy(...)`, derives the policy type from `CampaignRecordV1["partyStash"]["policy"]`, and refreshes the provider snapshot.
- `a5908833a7538131391d46793198648d140031db` / `e0e0d21c34f29d7d09ba62cefc4239fc851e5371` provide the corresponding source UI contract and corrected runtime API assertion.

### Approval queue supports recoverable authoritative commit

- Preserved prior `pending -> approved -> committed` separation from `7716bcd7241fdcaaf6fd66fcbe44714e9721f659`.
- `a9edaaf565dfed58c86314c88546ea9e30931ec6` adds `active()` and `recordApprovedFailure()`: failed transfers remain `approved`, visible, retryable, and cancellable; successful terminal settlement clears stale error text.
- `d8f14a74a8cbfffcbcbd2ac4771308fea412368c` expands deterministic queue test source for active records, recoverable failure, cleanup, and terminal error clearing.

### Connected Player -> Host approval request path

- `194f18c27bdc1f8303bce84046330699ebfb68c8` adds `connectedPartyStashApprovalRuntimeAdapter.ts`.
- `77e71cb061c3080f0a46c8cbfc06e86e24dcd1c9` installs it after existing Host policy, connected Campaign systems, and client policy adapters.
- Connected Player `dm-approval` stash-to-character calls now send a transient `campaign-stash-approval-request`; Host validates session, peer Character ownership, Campaign/policy, and roster permission before queue submission. The queue acknowledgement does not mutate assets.
- DM methods expose active requests plus approve/reject/cancel. Approval calls the existing `transferPartyStash` path and settles `committed` only after that authoritative transfer succeeds.
- `b260edbd61a53de74eeee84d420e91364445469b` moves authority revalidation before first approval and additionally confirms the request participant currently maps to the same connected Character owner. A pre-approval policy/permission/owner validation failure remains pending; a failure after approval remains approved with an error for retry/cancel.
- Session start/stop clears transient approval memory; client pending queue-ack waits are rejected on reconnect/stop.

### Player and DM Session UX

- `5336310c5d4fe8501ba2eb23d4da2a643bd5c81f` changes Player `dm-approval` withdrawal controls from disabled direct-transfer UX to an approval-request action with accurate acknowledgement copy.
- The DM inventory pane lists pending/approved requests and exposes approve, reject, cancel, and approved-transfer retry controls. Direct DM Stash management remains separate and unchanged.
- `b79a4ce0b1de68ab2cbd32de48a5e6a89022be2e` adds source-structure contracts for the Player/DM UX, installed runtime, and `approve -> existing transfer -> committed` ordering.

Exact product/test head before coordination writes: `d8f14a74a8cbfffcbcbd2ac4771308fea412368c`.

## Validation status

**NO GREEN CLAIM.** `get_commit_combined_status` and exact-head workflow lookup returned no statuses/runs for the new commits. The current environment still has no runnable checked-out repository, so no npm, TypeScript, UI test, build, Tauri, or Windows two-instance execution is claimed. Authored tests are source only until executed.

Static source review did catch and correct the Campaign policy API/type mismatch before checkpoint, but the connected wrapper stack still requires compiler/runtime evidence.

## Current V1-13 assessment

V1-13 is now **SOURCE-CONNECTED APPROVAL SLICE / VALIDATION PENDING**, not release-green.

Implemented source path:

1. Campaign `shared | dm-approval | dm-managed` selector;
2. Player `dm-approval` withdrawal request submission without asset mutation;
3. Host transient request queue;
4. DM approve/reject/cancel and approved retry UI/application path;
5. approval revalidation -> existing authoritative `transferPartyStash` -> `committed` only on transfer success;
6. approved transfer failure remains non-committed/recoverable;
7. Session stop clears transient request memory;
8. requestId payload identity remains queue-idempotent and approval revalidates the current connected owner.

Remaining evidence/UX gaps:

1. executable connected runtime tests for request transport, duplicate/reconnect, policy/permission/owner changes, transfer failure retry/cancel, successful commit, and Session cleanup;
2. exact-head TypeScript/test/build evidence;
3. optional/likely Player-facing final approval/rejection/cancellation notification — current Player UX confirms Host queue acceptance, while approved asset changes arrive through the existing owner path but rejection is not explicitly pushed back;
4. V1-13 checklist re-audit and later Windows two-instance acceptance.

## Next Exact Action

1. Reconcile mandatory Rerun docs and actual HEAD; preserve product/test commits through `d8f14a74a8cbfffcbcbd2ac4771308fea412368c` unless GitHub advanced.
2. Locate the existing connected-session transport test harness and add executable deterministic tests for Player request -> Host queue -> DM approval -> owner-side asset transfer -> commit, plus duplicate/reconnect, policy/permission/owner change, transfer-failure retry/cancel, and Session cleanup.
3. Run exact-head TypeScript/tests if an execution path is available. Do not treat source assertions as green evidence.
4. If required by production UX, add explicit Player approve/reject/cancel final status over the established connected transport only; do not create another asset mutation path.
5. Re-audit V1-13 after executable validation, then continue the next unblocked V1 implementation slice. Keep comprehensive Codex audit deferred until implementation freeze.
