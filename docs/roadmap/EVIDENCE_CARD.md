# V1 Evidence Card

Status: **W5-10 CLOSED — MP-01 THROUGH MP-04 AUTO SCENARIO MAP PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-10
Classification: REUSE_LOCKED
Acceptance criterion: consolidate the existing production-adapter three-peer action, presentation, turn, reconnect, reaction/Ready, and Undo automated evidence for MP-01 through MP-04 into one exact-HEAD scenario map. This AUTO Gate does not replace later real Windows H+P1+P2 rendered acceptance.
Production entrypoint: connectedSessionRuntimeAdapter + connectedActionRoutingAdapter + connectedResolutionPresentation + connectedTurnRoutingAdapter + connectedSessionProtocol + resolutionEventUndo and their existing production composition.
Existing automated tests: connectedResolutionPresentation.test.ts; productionClientReconnect.test.ts; granular connectedThreePeerRemote* action acceptance tests; connectedThreePeerActionMatrix.test.ts; connectedThreePeerPresentation.test.ts; phase09ManualMovementReactionAdapter.test.ts; c9FamilyOReadyConcentrationProduction.test.ts; connectedTurnProjection.test.ts; connectedUndoCompensation.test.ts.
Exact observed failure: None.
Smallest required change: None to product/runtime/test implementation. Add one focused workflow to execute the existing owner tests as a single exact-SHA W5-10 acceptance set.
Canonical closure evidence: SHA 786566303fbb6c8bac1dff6b392f65a866a1947c; W5-10 AUTO run 33700245046 / job 100477769745 = 45/45 PASS, 0 FAIL; artifact 9873251248 (W5-10-AUTO-786566303fbb6c8bac1dff6b392f65a866a1947c), sha256:189a99528d2cf6556a7c5430f3073145c91c537e1b3c354fc44e089234d3b927.
Exact observed result: PASS. MP-01 shared presentation envelope, MP-02 remote presentation/reconnect exactly-once behavior, MP-03 H+P1+P2 action matrix, and MP-04 Initiative/reaction/Ready/correction automated owners pass together on the canonical exact SHA.
Remaining release limitation: MP-01 through MP-04 issue-level WIN criteria and the scenario catalog's rendered Windows acceptance remain later V1 work. Do not close those issues solely from W5-10 AUTO evidence.
Next action: record W5-10 PASS in the official ledger, mark W5 10/10 complete, and route to W6-01.
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
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
