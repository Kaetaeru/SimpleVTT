# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization, Party Stash policy/approval flow, Session UI work, and prior approval authority-sequencing tests. Do not repeat validated source work, route to `main`, or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

This watcher execution started from coordination head `17f404ec20e5cf034d237eea97512a7b1e805cfc`. Mandatory `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` reconciliation, canonical handoff/checklist reads, and a branch compare showed `work/v1-composite` was identical to that checkpoint before new work began.

Current exact product/test head before coordination checkpoint writes: `2edfcdf16469f71f243aece6efa9e09d9e8f3539`.

## Completed in this execution

- Recovered the exact production wrapper order from `src/main.tsx`: connected Session runtime -> `connectedPartyStashHostPolicyAdapter` -> `connectedCampaignSystemsRuntimeAdapter` -> `connectedPartyStashClientPolicyAdapter` -> `connectedPartyStashApprovalRuntimeAdapter`.
- Confirmed the approval adapter captures the current transport listener when imported. The deterministic transport harness therefore installs test transport methods first and dynamically imports the connected wrappers in production order, rather than bypassing their message listeners.
- `ac5528c0feb48ee85f50aa2dad100a53cae20173` created `tests/ui/connectedPartyStashApprovalTransport.test.ts`.
- Static review found that connected Clients intentionally hide their local Campaign state and consume only the Host `campaign-systems-projection`. `2edfcdf16469f71f243aece6efa9e09d9e8f3539` corrected the test to hydrate the Client through the established connected Campaign listener path before submitting approval requests.
- The final transport test source now covers:
  1. Player `dm-approval` withdrawal traverses the connected listener stack and creates one Host `pending` approval record;
  2. request acknowledgement alone does not mutate Host Party Stash, Host Character, Player Party Stash projection, or Player Character assets;
  3. identical duplicate `requestId` reuses one Host queue record while same-id payload drift is rejected;
  4. rebinding the same participant/Character to a new peer preserves request identity across reconnect;
  5. transported requests can be rejected or cancelled through the DM application methods;
  6. Host Session stop clears the remaining pending approval state.
- No second asset mutation route was added. This test exercises the existing transport wrappers and queue/application methods only.

## Validation status

**NO GREEN CLAIM.** `get_commit_combined_status` returned no statuses and exact-head workflow lookup returned no workflow runs for `2edfcdf16469f71f243aece6efa9e09d9e8f3539`. The environment still does not provide a runnable checked-out repository, so the new Node/TypeScript test source has not been executed. No `npm`, TypeScript, build, Tauri, Rust, or Windows two-instance result is claimed.

Static inspection caught and corrected one important false test premise: a connected Client cannot rely on its pre-join local Campaign projection. The corrected test feeds the real Host projection through the connected Campaign message listener before exercising approval transport. Static inspection remains non-executable evidence.

## Remaining V1-13 work

1. Run exact-head TypeScript/unit/UI regression as soon as a runnable checkout or CI path is available; fix any dynamic-import, wrapper-order, type, or async timing issue before calling the slice green.
2. Add one end-to-end connected approval case where DM approval traverses the existing Host Party Stash transaction and remote owner-side `campaign-owner-inventory` transfer/compensation path, proving real assets commit only after owner mutation succeeds.
3. Add runtime coverage for roster permission change before approval and Session stop while a request is already `approved` but not yet committed; both must preserve the documented authority/cleanup semantics.
4. Decide whether Player-facing final approve/reject/cancel status is required beyond current Host-queue acknowledgement. If added, use only the established connected transport and never create another asset mutation path.
5. Re-audit V1-13 against the release checklist after executable validation, then continue the next unblocked V1 implementation slice. Windows two-instance acceptance and comprehensive Codex audit remain later release evidence.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD; preserve product/test commits through `2edfcdf16469f71f243aece6efa9e09d9e8f3539` unless GitHub advanced.
2. Execute the authored Party Stash approval tests if an exact-head execution path becomes available; do not infer green from source inspection.
3. Extend the connected transport harness through real DM approval -> existing `transferPartyStash` -> remote owner inventory request/result -> Host commit, including owner-side failure/compensation behavior. Do not substitute the instance transfer method in that E2E case.
4. Add the remaining permission-change and approved-but-uncommitted Session cleanup runtime cases without duplicating already covered pending/reconnect/reject/cancel behavior.
5. Re-audit V1-13 only after executable evidence. Keep the comprehensive Codex audit deferred until implementation freeze.
