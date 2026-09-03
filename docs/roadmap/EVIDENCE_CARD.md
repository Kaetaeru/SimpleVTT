# V1 Evidence Card

Status: **W7-03 CLOSED — SESSION CLEANUP AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-03
Classification: REUSE_LOCKED
Acceptance criterion: Host restart and explicit Session end leave transient Session state dead rather than resurrecting it for MP-A08~A09, while durable Character state survives and the next Host Session starts with fresh Session identity and runtime authority.
Production entrypoint: Existing production Session-end cleanup, AppProvider stop-session refresh, Session/participant lifecycle, turn projection, connected presentation, Party Stash approval ownership, and Ready/Concentration owners; no second Session lifecycle, restart journal, transient-state store, cleanup path, prompt owner, or presentation queue is authorized.
Existing automated verification: npx tsx --test tests/ui/productionSessionEnd.test.ts tests/ui/appProviderStopSessionRefresh.test.ts tests/ui/productionSessionLifecycleAdapter.test.ts tests/ui/productionParticipantLifecycle.test.ts tests/ui/connectedTurnProjection.test.ts tests/ui/connectedResolutionPresentation.test.ts tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts tests/ui/c9FamilyOReadyConcentrationProduction.test.ts, followed by npm run build.
Exact observed failure: None on verification head 4986833eb20590ec486721ef6f45b86c2b3cb021. The existing production owners satisfy the focused W7-03 acceptance set.
Smallest authorized change: Scoped W7-03 verification workflow and evidence/current records only. No src/ or existing test implementation file changed.
Verification SHA: 4986833eb20590ec486721ef6f45b86c2b3cb021 (Actions pull-request checkout 9ae9615e5cf1c0377193e90e1918a9d728dadc1f).
Verification: W7-03 AUTO Verification run 33740111205 / job 100599791508 = success; 29/29 focused tests PASS; production build PASS. Legacy Execution Boundary run 33740111146 and Contract validation run 33740110937 also succeeded.
Artifact: 9887399132, W7-03-AUTO-9ae9615e5cf1c0377193e90e1918a9d728dadc1f, sha256:a1edb9d24fd85deb525830ae142f562aae29722bdf58a4ef89e1281b08694ea2.
Closure: W7-03 PASS. Reconcile the official ledger to 78.8/100.0 (59 PASS / 13 PENDING), W7 3/8 PASS, then execute W7-04 / MP-B08 and MP-H09~H12.
```

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
