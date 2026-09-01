# V1 Evidence Card

Status: **W3-08 PASS — EXACT-SHA WINDOWS TAURI COMPLETE LOCAL SESSION VERIFIED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W3-08
Acceptance criterion: Actual Windows Tauri complete local session -> rest -> session end -> process exit -> same-data-root restart in one journey; W3 exits only when one full local session can be played start-to-finish and restarted without requiring network.
Production entrypoint: ProductRoot -> Character -> Campaign -> local Host Session -> DM Library PC preset -> Combat/Spell -> Long Rest -> Session end -> same-data-root restart
Existing implementation files: src/SessionActorBoards.tsx; src/app/AppProvider.tsx; src/SessionDmLibraryPane.tsx; src/CampaignDmLibraryOrganizationPanel.tsx; src/app/campaignDmLibraryOrganizationContracts.ts; src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts; src/app/campaignPersistenceContracts.ts
Existing automated tests: tests/ui/appProviderStopSessionRefresh.test.ts; tests/ui/campaignDmLibraryPcPresetRuntime.test.ts; scripts/run-tauri-e2e-w3.mjs
Existing Tauri/Windows evidence: verification SHA 53ec501555222b60d9e856b231f4f64395f75b76; GitHub Actions V1 Tauri Verification run 33569954938; W3 job 100061523302 = success; artifact 9824674856 SimpleVTT-W3-Tauri-53ec501555222b60d9e856b231f4f64395f75b76; digest sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034. Canonical merge 5bef709f010543859e84c98ef7db8f14e5c06469 shares tree 0e6baadda2570b169c35c6b7436ff4e0042dfff0 with the verified head.
Exact observed result: PASS. The real Windows Tauri journey creates a Character, saves a Campaign DM-owned PC preset, starts a local Host session on 127.0.0.1, materializes and controls the preset through the production DM Library drop path, executes a weapon attack and a damage spell, applies Long Rest with +8h Campaign time, ends the session through production UI, exits the process, restarts on the same Host data root, and verifies Campaign absolute time 480 minutes plus one completed session-history entry. w3-08.json records status PASS; drop and Actor-selection diagnostics plus rendered screenshots/text are included in the artifact.
Repair history: Current-HEAD failures were reproduced before product changes. The final path preserves multiplayer ownership by using the existing DM-owned PC preset path rather than making a Player-owned Character Host-controlled. The Tauri harness was then corrected to drive the production pointer lifecycle and to recognize the actual Home surface after session stop.
Smallest required change: None. W3-08 is closed. Do not reopen or reimplement this Gate unless a new current-HEAD regression is reproduced; proceed to W4-01.
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
