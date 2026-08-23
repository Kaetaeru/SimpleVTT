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

This watcher execution started from coordination head `745b9509e4cba9484134b4c75edd75697a59d510`. Mandatory README -> control -> STATE -> PLAN reconciliation showed the branch was identical to that checkpoint before new work began.

Current exact product/test head before coordination checkpoint writes: `d8f14a74a8cbfffcbcbd2ac4771308fea412368c`.

## Completed in this execution

- `ae3852fec9b3b734a3b056bc6b324e37b9329d48` — added a user-reachable Campaign Party Stash policy selector.
- `a5908833a7538131391d46793198648d140031db` — added source-level selector/no-mutation UI contracts.
- `a9edaaf565dfed58c86314c88546ea9e30931ec6` — approval queue now exposes active pending/approved records and preserves approved transfer failures for retry/cancel.
- `194f18c27bdc1f8303bce84046330699ebfb68c8` — added connected Player -> Host approval-request transport and Host approval application methods.
- `77e71cb061c3080f0a46c8cbfc06e86e24dcd1c9` — installed the connected approval runtime after existing Host/connected/client policy adapters.
- `5336310c5d4fe8501ba2eb23d4da2a643bd5c81f` — Player `dm-approval` withdrawals now submit approval requests; DM UI exposes approve/reject/cancel and approved transfer retry.
- `b79a4ce0b1de68ab2cbd32de48a5e6a89022be2e` — added source contracts for connected approval UX and commit ordering.
- `b260edbd61a53de74eeee84d420e91364445469b` — approval revalidates current Host/session, policy, roster permission, and connected Character owner before state transition; policy/ownership failure before first approval remains pending, while post-approval transfer failures remain recoverable.
- `3db625d43b9a6e1e017f78253668fd2f587db1f0` — corrected Campaign UI to call the existing `configureCampaignPartyStashPolicy` runtime API and derive the policy type from `CampaignRecordV1`.
- `e0e0d21c34f29d7d09ba62cefc4239fc851e5371` — aligned the Campaign policy UI source test with the actual runtime API.
- `d8f14a74a8cbfffcbcbd2ac4771308fea412368c` — expanded queue tests for active approved records, recoverable transfer failure, cleanup, and error clearing on terminal settlement.

The approval path reuses the existing authoritative `transferPartyStash` transaction. Pending request submission does not mutate assets. DM approval revalidates authority, marks `approved`, calls the existing transfer, and marks `committed` only after that transfer succeeds. Session stop clears transient approval memory.

## Validation status

**NO GREEN CLAIM.** GitHub reports no combined statuses and no workflow runs for the new exact-head commits. The current environment still has no runnable checked-out repository, so authored tests have not been executed locally. No TypeScript build, npm test, Rust/Tauri, or Windows two-instance result is claimed.

Static source inspection caught and corrected one Campaign policy API/type mismatch before checkpoint, but static inspection is not a substitute for compiler/test evidence.

## Remaining V1-13 work

1. Execute exact-head TypeScript/unit/UI regression as soon as a runnable checkout or CI run is available; fix any wrapper/type/import-order failures before calling the slice green.
2. Add deterministic runtime tests, not only source-structure assertions, for connected Player request -> Host queue -> DM approve -> owner-side transfer -> commit.
3. Exercise duplicate request/reconnect behavior against the actual transport wrapper stack. Request identity is queue-idempotent and approval now revalidates the currently connected owner, but this still needs executable proof.
4. Exercise policy/permission/owner changes while pending and approved transfer failures. Pre-approval validation failure must stay pending; post-approval transfer failure must stay approved and retryable/cancellable.
5. Verify Session end clears pending and approved-but-uncommitted requests in the real lifecycle path.
6. Decide/implement Player-facing final approval/rejection status if production UX requires more than the current “request accepted by Host queue” acknowledgement. Asset changes after approval already travel through the existing connected owner path, but explicit rejection feedback is not yet sent back to the Player.
7. Re-audit V1-13 against the release checklist, then continue the next unblocked V1 implementation slice. Comprehensive Codex audit remains deferred until implementation freeze.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD; preserve product/test commits through `d8f14a74a8cbfffcbcbd2ac4771308fea412368c` unless GitHub has advanced.
2. Inspect the connected approval adapter together with existing connected-session test harnesses and add executable deterministic tests for request transport, duplicate/reconnect identity, policy/permission changes, owner reconnect, successful commit, transfer failure retry/cancel, and Session cleanup.
3. Run exact-head TypeScript/tests if an execution path becomes available; do not infer green from authored source tests.
4. Add Player final approve/reject/cancel feedback only through the established connected transport; do not create a second asset mutation channel.
5. Re-audit V1-13 after executable validation, then continue the next V1 implementation slice. Keep the comprehensive Codex audit deferred until implementation freeze.
