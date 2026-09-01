# V1 Evidence Card

Status: **W3-08 CURRENT-HEAD FAILURE REPRODUCED — DIAGNOSIS REQUIRED BEFORE NEXT PRODUCT CHANGE**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W3-08
Acceptance criterion: Actual Windows Tauri complete local session -> rest -> session end -> process exit -> same-data-root restart in one journey; W3 exits only when one full local session can be played start-to-finish and restarted without requiring network.
Production entrypoint: ProductRoot -> SessionModeRoot -> SessionActorBoards -> AppProvider.selectDmActor -> MockAdapter.selectDmActor -> Session hotbar/current Actor projection
Existing implementation files: src/SessionActorBoards.tsx; src/app/AppProvider.tsx; src/app/mockAdapter.ts; src/app/adapterSnapshotEvents.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedSessionState.ts
Existing automated tests: existing connected-session UI suites; tests/ui/appProviderStopSessionRefresh.test.ts; scripts/run-tauri-e2e-w3.mjs on PR #223
Existing Tauri/Windows evidence: exact head 201fbb472ac54eb87075229f5711b7f156f3352c; GitHub Actions run 33555569123; W3 job 100015431514; artifact 9819341231 SimpleVTT-W3-Tauri-201fbb472ac54eb87075229f5711b7f156f3352c; digest sha256:a4ae20740e359c116e94bfd7ed45b21b8c6624f6f51cdd1a3c8240d6457d05fa. The focused stop-session regression passed and same-SHA W2 Windows Tauri job 100015431351 passed. The W3 journey created a real Sorcerer, opened localhost Host play, instantiated a Goblin, and again failed while switching Host control to the allied Character. The attempted SessionActorBoards post-select refresh on this SHA did not close the failure and was reverted in commit 3e8fd55844db4b858ac4e8c1ba0f2ffb8e6b62f6.
Exact observed failure: In the rendered connected Host session, the allied Sorcerer card is visible while the instantiated Goblin remains the action/hotbar Actor. Clicking the allied Sorcerer through the production SessionActorBoards path still fails the W3 controlled-Actor assertion. Source inspection shows MockAdapter.selectDmActor changes scene.selectedActorId only; scene.currentActorId is a separate field used by turn/action projection. The failed refresh experiment proves that merely re-reading the provider snapshot is insufficient. Before another product repair, the W3 harness must record both the selected-card state and the current/hotbar Actor after the click so the exact ownership boundary is established rather than inferred.
Smallest required change: No further product change is authorized from the failed refresh hypothesis alone. First extend the existing W3 harness diagnostics (not its acceptance) to capture the allied card aria-pressed/class state and the rendered current/hotbar Actor immediately after the production click. Then repair only the proven owner of the mismatch; do not add a new Actor selector, state owner, transport, session subsystem, or E2E framework.
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