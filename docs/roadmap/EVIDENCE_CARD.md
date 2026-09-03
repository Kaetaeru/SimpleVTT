# V1 Evidence Card

Status: **W7-02 CLOSED — RECOVERY AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-02
Classification: REUSE_LOCKED
Acceptance criterion: Reconnect, late join, ordered Host catch-up, and presentation recovery remain Host-authoritative and recover without reroll for MP-H04~H08, including stale cursors, late participants, durable restart/retry, deterministic Ready/Reaction/Concentration lifecycle, and event-gap rejection.
Production entrypoint: Existing participant lifecycle/rebind path, accepted Client replica cursor and ordered Host catch-up, connected resolution presentation replay, durable restart/retry owners, and existing Ready/Reaction/Concentration lifecycle; no second reconnect system, participant lifecycle, catch-up journal, presentation pipeline, prompt state machine, or recovery path is authorized.
Existing automated verification: npx tsx --test tests/ui/productionClientReconnect.test.ts tests/ui/productionParticipantLifecycle.test.ts tests/ui/connectedResolutionPresentation.test.ts tests/ui/connectedTurnProjection.test.ts tests/ui/connectedDurableFailure.test.ts tests/ui/connectedOwnerInventoryRestart.test.ts tests/ui/connectedLongRestHostRestartRecovery.test.ts tests/ui/c9FamilyOReadyConcentrationProduction.test.ts tests/ui/phase09ManualMovementReactionAdapter.test.ts tests/ui/phase09ConcentrationSaveWorkflow.test.ts, followed by npm run build.
Exact observed failure: None on verification head 507459f208457e540beb19295dabb43e81f63b93. The existing production owners satisfy the focused W7-02 acceptance set.
Smallest authorized change: Scoped W7-02 verification workflow and evidence/current records only. No src/ or existing test implementation file changed.
Verification SHA: 507459f208457e540beb19295dabb43e81f63b93 (Actions pull-request checkout f1ca8d203177bb43077259dfa957fb4b5c3109ce; GitHub compare reports zero changed files between verification head and synthetic checkout).
Verification: W7-02 AUTO Verification run 33720461403 / job 100538359322 = success; 34/34 focused tests PASS; production build PASS. Legacy Execution Boundary run 33720461389 and Contract validation run 33720461383 also succeeded.
Artifact: 9880065564, W7-02-AUTO-f1ca8d203177bb43077259dfa957fb4b5c3109ce, sha256:a6e7e64721600ce77c746ae1d6a7e6a3724222a4926ff633caaeca180342bc13.
Closure: W7-02 PASS. Reconcile the official ledger to 77.5/100.0 (58 PASS / 14 PENDING), W7 2/8 PASS, then execute W7-03.
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
