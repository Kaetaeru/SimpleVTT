# V1 Evidence Card

Status: **W4-04 PASS — CAMPAIGN CALENDAR, RATIONS, VISIBILITY, AND DECLARATIVE PROVIDERS REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-04
Acceptance criterion: Campaign calendar, rations, player visibility, and declarative provider settings are fixed on the existing production path.
Production entrypoint: CampaignSystemsPanel/AppProvider -> campaignRuntimeAdapter -> CampaignApplicationService; connected Session projection -> connectedCampaignSystemsRuntimeAdapter
Existing implementation files: src/app/campaignRuntimeAdapter.ts; src/app/connectedCampaignSystemsRuntimeAdapter.ts; src/app/campaignProviderProfiles.ts; src/CampaignSystemsPanel.tsx
Existing automated tests: tests/ui/campaignRuntimeAdapter.test.ts; tests/ui/campaignSystems.test.ts; tests/ui/campaignDeclarativeProviderProfile.test.ts; tests/ui/campaignDeclarativeProviderRuntime.test.ts; tests/ui/campaignDeclarativeProviderUiStructure.test.ts
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168 / job 100063331529 = success; step "Verify Campaign lifecycle and declarative providers" = success.
Exact observed result: PASS. campaignRuntimeAdapter stores calendar/ration provider IDs and versions, applies Session defaults, and captures rationsVisibleToPlayers in the immutable Campaign Session snapshot. The same runtime projects ration balances/details to a Client only when the captured visibility policy allows it. connectedCampaignSystemsRuntimeAdapter adds a second transport boundary: safeProjection preserves the DM/Host authoritative Campaign projection but strips ration balance/dailyRequired/shortage and roster ration-unit fields before broadcasting when visibleToPlayers is false. campaignRuntimeAdapter.test.ts exercises Campaign session defaults, calendar/ration providers, calendar advancement, ration state, and Session snapshot capture. campaignDeclarativeProviderProfile/Runtime/UiStructure tests verify installed declarative calendar/ration profiles, exact provider version pinning/options, and provider-backed Campaign UI/runtime ownership.
Inheritance check: GitHub Actions UI run 33570546168 verified the Campaign/declarative-provider owner at product SHA 5bef709f010543859e84c98ef7db8f14e5c06469. The integration history from that SHA through canonical 19ffc83e529e7e986f50377bfded69cb6ca33871 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, and docs/roadmap/V1_EVIDENCE_LEDGER.json; the W4-04 production/runtime/tests are inherited unchanged.
Smallest required change: None. W4-04 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-05.
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
