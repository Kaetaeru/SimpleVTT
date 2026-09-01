# V1 Evidence Card

Status: **W3-08 CURRENT-HEAD FAILURE REPRODUCED — MINIMAL PRODUCT REPAIR AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W3-08
Acceptance criterion: Actual Windows Tauri complete local session -> rest -> session end -> process exit -> same-data-root restart in one journey; W3 exits only when one full local session can be played start-to-finish and restarted without requiring network.
Production entrypoint: ProductRoot -> SessionModeRoot -> SessionSharePane / ProductionSessionLifecycleBridge -> AppProvider.stopSession -> MockAdapter.stopSession (productionSessionLifecycleAdapter)
Existing implementation files: src/app/AppProvider.tsx; src/SessionDmTools.tsx; src/ProductionSessionLifecycleBridge.tsx; src/app/productionSessionLifecycleAdapter.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedSessionState.ts
Existing automated tests: existing production session lifecycle / connected-session UI suites plus scripts/run-tauri-e2e-w3.mjs on PR #223
Existing Tauri/Windows evidence: exact head 77f7f78df39b481fb6f4476e5aa34752be9f42b8; GitHub Actions run 33541335885; W3 job 99968038061; artifact 9813867828 SimpleVTT-W3-Tauri-77f7f78df39b481fb6f4476e5aa34752be9f42b8; digest sha256:548ebaa70f16540e3c201a410b04816a88e8f8a0db23311d3102d5d683975a60. The journey reached a real saved Character, localhost Host play, and DM Long Rest with campaign time +8h before failing at session exit. Same-SHA W2 Windows regression job 99968038088 passed.
Exact observed failure: Clicking the production `세션 종료` control runs stopSession far enough for the transport state to publish `disconnected`, but the rendered app remains on `호스트 · DM` live SessionModeRoot instead of returning offline. productionSessionLifecycleAdapter.stopSession is specified to reset connected transient state and set lifecycle `offline`; connectedSessionRuntimeAdapter publishes transport-state snapshots asynchronously during transport.stop(); AppProvider treats those external snapshots as newer operations and can suppress the final offline snapshot returned by the in-flight stopSession apply. The Windows artifact shows the resulting stale rendered state: connection `연결 끊김` while the Host live session surface remains mounted.
Smallest required change: Keep the existing lifecycle owner, transport, and UI. Make the AppProvider stopSession path explicitly refresh from the adapter after stopSession completes so the final authoritative offline snapshot wins over transient transport-state publications; add a focused regression proving an external snapshot during stop cannot leave the provider on stale live state. Do not add a new session subsystem or change the W3 acceptance journey.
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