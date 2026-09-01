# V1 Evidence Card

Status: **W3-08 CURRENT-HEAD FAILURE REPRODUCED — MINIMAL PRODUCT REPAIR AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W3-08
Acceptance criterion: Actual Windows Tauri complete local session -> rest -> session end -> process exit -> same-data-root restart in one journey; W3 exits only when one full local session can be played start-to-finish and restarted without requiring network.
Production entrypoint: ProductRoot -> SessionModeRoot -> SessionActorBoards -> AppProvider.selectDmActor -> MockAdapter.selectDmActor
Existing implementation files: src/SessionActorBoards.tsx; src/app/AppProvider.tsx; src/app/mockAdapter.ts; src/app/adapterSnapshotEvents.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedSessionState.ts
Existing automated tests: existing connected-session UI suites; tests/ui/appProviderStopSessionRefresh.test.ts; scripts/run-tauri-e2e-w3.mjs on PR #223
Existing Tauri/Windows evidence: exact head 968ecc0a7bce62bd7f2bba93d5ef05bdc46f58e7; GitHub Actions run 33554380474; W3 job 100011482733; artifact 9818867734 SimpleVTT-W3-Tauri-968ecc0a7bce62bd7f2bba93d5ef05bdc46f58e7; digest sha256:147084548eaffe72c9e9b2be9846336b7cbf8a4e0feba337891fff717defcbe8. The focused stop-session regression passed and same-SHA W2 Windows Tauri job 100011483038 passed. The W3 journey created a real Sorcerer, opened localhost Host play, instantiated a Goblin, and then reproduced the actor-selection failure before combat execution.
Exact observed failure: In the rendered connected Host session, the allied Sorcerer card is visible and the instantiated Goblin is the current controlled Actor. Clicking the allied Sorcerer through the production SessionActorBoards control does not make that card `aria-pressed=true` / `controlled`; the Goblin remains selected and its hotbar remains active. The W3 harness was already corrected to assert the production card contract rather than a nonexistent selector. MockAdapter.selectDmActor directly updates scene.selectedActorId/currentActorId, while AppProvider publishes adapter operation results through an operation sequence that connected external snapshots can advance; the rendered provider state can therefore remain on a newer transient snapshot instead of the final selected-Actor snapshot.
Smallest required change: Keep the existing SessionActorBoards selection owner, AppProvider, adapter, and connected-session system. After the existing DM selectDmActor call completes, refresh the authoritative provider snapshot once so the final selectedActorId wins over transient connected external publications. Do not add a new Actor selector, state owner, transport, or session subsystem, and do not change the W3 acceptance journey.
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