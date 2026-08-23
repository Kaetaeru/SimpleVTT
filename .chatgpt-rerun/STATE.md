# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T11:40:00+09:00`

## Preflight reconciliation

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then re-read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and `docs/design/campaign-systems.md`. At start, actual branch HEAD was exactly prior coordination checkpoint `17f404ec20e5cf034d237eea97512a7b1e805cfc`; control was the same run/sequence/task with status `continue`. A second pre-write reconciliation also found no concurrent writer before the product/test commits.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durability and existing Host/owner recovery/compensation path;
- Campaign-authoritative Party Stash and the existing durable `transferPartyStash` transaction;
- Party Stash policy selector and connected `dm-approval` Player -> Host request path;
- DM approve/reject/cancel/retry UI and queue state `pending -> approved -> committed`;
- prior runtime approval authority-sequencing tests through `918b0f5e43d2c57caaab441eb4de811c3cc2ae6f`;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. Current `src/main.tsx` installs the relevant production wrappers in this order: connected Session runtime -> Host Party Stash policy -> connected Campaign systems -> Client Party Stash policy -> Party Stash approval runtime.
2. The approval runtime captures the current `tauriSessionTransport.onMessage` implementation at module initialization. A deterministic transport test must therefore install the fake base transport first and dynamically import the connected wrappers in production order; static-importing approval first would test the wrong listener chain.
3. `connectedCampaignSystemsRuntimeAdapter` replaces Client `campaignSessionSystems` with the Host remote projection whenever the Session role is `client`. A Client test cannot rely on Campaign state created locally before join.
4. Exact-head GitHub CI remains absent, and this environment still has no runnable checkout.

## Completed in this execution

### Connected approval request transport test source

- `ac5528c0feb48ee85f50aa2dad100a53cae20173` created `tests/ui/connectedPartyStashApprovalTransport.test.ts` using the established singleton transport replacement pattern.
- Static inspection found the initial test incorrectly assumed Client local Campaign state survived connected join.
- `2edfcdf16469f71f243aece6efa9e09d9e8f3539` corrected that premise by sending the actual Host `campaignSessionSystems` projection through the registered connected Client listener before the approval request.

The final source-authored test now covers:

1. **Actual request wrapper path** — Player `dm-approval` withdrawal travels through the connected listener chain and creates exactly one Host `pending` record.
2. **No request-time mutation** — Host Party Stash/Character and Player Party Stash projection/Character remain unchanged after Host queue acknowledgement.
3. **Duplicate identity** — identical same-`requestId` retry reuses one Host record; payload drift with that id is rejected.
4. **Reconnect identity** — after peer mapping and Character projection are rebound to a new peer for the same participant/Character, the identical request still resolves to the existing record.
5. **DM reject/cancel** — separately transported requests reach terminal `rejected` and `cancelled` states through the application methods.
6. **Session cleanup** — Host `stopSession()` clears the remaining active pending request.

No production asset path was changed by this execution. The new file is test source only.

Exact product/test head before coordination writes: `2edfcdf16469f71f243aece6efa9e09d9e8f3539`.

## Validation status

**NO GREEN CLAIM.** `get_commit_combined_status` returned no statuses and exact-head workflow lookup returned no workflow runs for `2edfcdf16469f71f243aece6efa9e09d9e8f3539`. There is no runnable checked-out repository in this environment, so no Node test, npm test, TypeScript compile, UI build, Tauri, Rust, or Windows two-instance execution is claimed.

Static source inspection caught and corrected the Client remote-Campaign projection premise before checkpoint. The transport test still requires compiler/runtime execution to prove its dynamic-import and async listener assumptions.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED APPROVAL SLICE / VALIDATION PENDING**.

Source-covered validation now includes:

- approval authority ordering and retry-safe approved failure from the prior runtime test;
- Player request -> Host pending queue through the connected listener chain;
- request-time no-mutation assertions;
- duplicate/payload-drift identity;
- same owner reconnect peer rebinding;
- reject/cancel application transitions;
- pending request cleanup on Host Session stop.

Remaining evidence/UX gaps:

1. exact-head TypeScript/test/build execution evidence;
2. connected DM approval through the real owner-side inventory request/result and Party Stash compensation stack rather than an observation stub;
3. roster permission change before approval;
4. Session stop while a request is already `approved` but not yet committed;
5. optional Player-facing final approval/rejection/cancellation notification;
6. V1-13 checklist re-audit and later Windows two-instance acceptance.

## Next Exact Action

1. Reconcile mandatory Rerun docs and actual HEAD; preserve product/test commits through `2edfcdf16469f71f243aece6efa9e09d9e8f3539` unless GitHub advanced.
2. Run the authored approval runtime/transport tests if exact-head execution becomes available. Do not infer green from authored source.
3. Extend the connected harness through real DM approval -> existing `transferPartyStash` -> remote owner `campaign-owner-inventory` request/result -> Host commit, including owner failure/compensation semantics. Do not replace the transfer method in that E2E case.
4. Add focused runtime cases for roster permission change and `approved`-but-uncommitted Session stop cleanup. Do not repeat pending/reconnect/reject/cancel coverage already authored.
5. Re-audit V1-13 only after executable evidence, then continue the next unblocked V1 slice. Comprehensive Codex audit remains deferred until implementation freeze.
