# V1 Evidence Card

Status: **W4-03 PASS — CAMPAIGN ROSTER, SESSION SNAPSHOT, HISTORY, AND SUMMARY REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-03
Acceptance criterion: Campaign roster, immutable Session snapshot, durable history, and completed-session summary are fixed on the existing production path.
Production entrypoint: ProductRoot/AppProvider -> Campaign runtime -> production Session lifecycle -> campaignSessionHistoryRuntimeAdapter -> Campaign application/persistence owner
Existing implementation files: src/app/campaignRuntimeAdapter.ts; src/app/campaignApplicationService.ts; src/app/campaignSessionHistoryRuntimeAdapter.ts; src/main.tsx
Existing automated tests: tests/ui/campaignRuntimeAdapter.test.ts; tests/ui/campaignSystems.test.ts; scripts/run-tauri-e2e-w3.mjs
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168 / job 100063331529 = success. Windows verification SHA 53ec501555222b60d9e856b231f4f64395f75b76; V1 Tauri Verification run 33569954938 / job 100061523302 = success; artifact 9824674856, sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034.
Exact observed result: PASS. campaignRuntimeAdapter.test.ts verifies Campaign-owned roster projection and an immutable Session preparation snapshot. campaignSystems.test.ts verifies revisioned roster mutation and appendSessionSummary persistence with a bounded 50-entry history plus lastSessionId. Production main.tsx composes campaignSessionHistoryRuntimeAdapter, which wraps successful Host stop, derives the completed-session summary from the captured Campaign snapshot and live participants/calendar/rations/stash state, persists it through appendCampaignSessionSummary, and then clears the Session snapshot. The Windows W3 journey ends the Session through the rendered UI without directly calling the summary API, exits the process, relaunches with the same data root, and observes one durable Campaign session-history entry.
Inheritance check: Windows SHA 53ec501555222b60d9e856b231f4f64395f75b76 and canonical merge 5bef709f010543859e84c98ef7db8f14e5c06469 share tree 0e6baadda2570b169c35c6b7436ff4e0042dfff0. GitHub compare 5bef709f010543859e84c98ef7db8f14e5c06469...fd14887dd286725d2ec71b48a70d121b6c63d8d6 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, and docs/roadmap/V1_EVIDENCE_LEDGER.json; the W4-03 product and tests are inherited unchanged.
Smallest required change: None. W4-03 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-04.
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
