# V1 Evidence Card

Status: **W3-08 CURRENT-HEAD FAILURE REPRODUCED — DIAGNOSIS CONFIRMED AT HOST ACTOR-OWNERSHIP BOUNDARY**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W3-08
Acceptance criterion: Actual Windows Tauri complete local session -> rest -> session end -> process exit -> same-data-root restart in one journey; W3 exits only when one full local session can be played start-to-finish and restarted without requiring network.
Production entrypoint: ProductRoot -> SessionModeRoot -> SessionActorBoards -> AppProvider.selectDmActor -> MockAdapter.selectDmActor -> Session hotbar/current Actor projection
Existing implementation files: src/SessionActorBoards.tsx; src/app/AppProvider.tsx; src/app/mockAdapter.ts; src/app/adapterSnapshotEvents.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedSessionState.ts; src/app/productionSessionEmptyEncounterAdapter.ts; src/SessionDmLibraryPane.tsx; src/app/campaignPersistenceContracts.ts
Existing automated tests: existing connected-session UI suites; tests/ui/appProviderStopSessionRefresh.test.ts; scripts/run-tauri-e2e-w3.mjs on PR #223, including immediate post-click Actor-selection diagnostics
Existing Tauri/Windows evidence: exact head b5e6ac809ecfa57afbaada2df85334355ef04fc0; GitHub Actions run 33558660355; W3 job 100025593493; artifact 9820526473 SimpleVTT-W3-Tauri-b5e6ac809ecfa57afbaada2df85334355ef04fc0; digest sha256:b11a48bddf2ede34b93cf11016eea3b5cabc689775a61b0235484f8b2a9b03b3. The focused stop-session regression passed and same-SHA W2 Windows Tauri job 100025593225 passed. W3 uploaded w3-08-selection-diagnostic.json after the production click.
Exact observed failure: The diagnostic proves the allied projected Character selection does not stick. Immediately after clicking W3 Local Sorcerer 5-246Z, its card remained aria-pressed=false with class "session-actor-card allied"; the controlled card remained combatant.goblin.instance-1 with aria-pressed=true/class "session-actor-card hostile controlled"; the rendered hotbar Actor remained 고블린 1. This is not a stale hotbar-only routing failure. The selection is rejected before publication because MockAdapter.selectDmActor accepts only IDs present in its internal scene, while the connected Host pipeline intentionally excludes the local Player Character projection from that Host-owned scene and later projection can make the Character visible again. Directly relaxing that validation would let Host control a Player-owned Character and would contradict the multiplayer ownership contract.
Smallest required change: Do not make the local Player Character directly Host-controlled. Reuse the existing DM-owned Actor path. First verify the existing campaign DM Library pc-preset materialization path can carry the W3 combat/spell/resource state; if it can, change only the W3 journey to create/spawn and control that DM-owned preset. If that existing path is missing only the required Character combat state, repair that materialization path minimally rather than adding a new selector, state owner, transport, session subsystem, DM Library, or E2E framework.
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
