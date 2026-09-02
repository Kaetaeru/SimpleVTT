# V1 Evidence Card

Status: **W4-02 PASS — CAMPAIGN DASHBOARD, SESSION BINDING, AND REQUIRED HOST CAMPAIGN REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-02
Acceptance criterion: Campaign dashboard, Session binding, and Campaign-required Host start are fixed on the existing production path.
Production entrypoint: ProductRoot -> ProductionSessionWorkspaceBridge -> selected Campaign -> prepareCampaignSessionSnapshot(campaignId) -> Host
Existing implementation files: src/ProductionSessionWorkspaceBridge.tsx; src/CampaignScreen.tsx; src/app/campaignRuntimeAdapter.ts; src/app/AppProvider.tsx; src/app/productionSessionLifecycleAdapter.ts
Existing automated tests: tests/ui/campaignProductUiStructure.test.ts; tests/ui/campaignRuntimeAdapter.test.ts
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168; job 100063331529 = success; step "Verify Campaign lifecycle and declarative providers" = success.
Exact observed result: PASS. campaignProductUiStructure.test.ts fixes Campaign as a first-class product route and verifies Host start requires a selected Campaign through the prepared snapshot path. ProductionSessionWorkspaceBridge disables offline/disconnected Host when no active Campaign exists and calls prepareCampaignSessionSnapshot(activeCampaign.campaignId) before app.hostSession(). campaignRuntimeAdapter rejects a missing Campaign and binds campaignId, Campaign revision, content-loadout revision, and an immutable settings snapshot into AppSnapshot/Session before Host lifecycle begins. The lower productionSessionLifecycleAdapter owns transport/session lifecycle and intentionally does not duplicate Campaign ownership policy.
Inheritance check: GitHub compare 5bef709f010543859e84c98ef7db8f14e5c06469...c005f32e7e4f564d479771013192291d7992dff0 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, and docs/roadmap/V1_EVIDENCE_LEDGER.json. The verified W4-02 production bridge, Campaign runtime, and tests are unchanged on canonical HEAD.
Smallest required change: None. W4-02 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-03.
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
