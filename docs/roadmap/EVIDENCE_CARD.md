# V1 Evidence Card

Status: **W4-05 PASS — PARTY STASH POLICY MODES REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-05
Acceptance criterion: Party Stash shared / approval / DM-managed modes are fixed on the existing production path.
Production entrypoint: CampaignSystemsPanel/AppProvider -> campaignPartyStashPolicyRuntimeAdapter -> CampaignApplicationService -> existing Party Stash transfer owner
Existing implementation files: src/app/campaignPersistenceContracts.ts; src/app/campaignPartyStashPolicyRuntimeAdapter.ts; src/app/campaignRuntimeAdapter.ts; src/CampaignSystemsPanel.tsx
Existing automated tests: tests/ui/campaignSystems.test.ts; GitHub Actions UI step "Verify Party Stash sequential transfer routing"
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168 / job 100063331529 = success; step "Verify Party Stash sequential transfer routing" = success.
Exact observed result: PASS. campaignPersistenceContracts defines exactly shared, dm-approval, and dm-managed policies and new Campaigns default to shared. campaignPartyStashPolicyRuntimeAdapter keeps deposits on the existing transfer path, allows shared withdrawals, queues non-DM withdrawals under dm-approval until explicit DM approve/reject, rejects non-DM withdrawals under dm-managed, and allows DM withdrawals in both restricted policies. CampaignSystemsPanel exposes the three policy choices and the pending approve/reject controls through the production Campaign UI. campaignSystems.test.ts fixes durable Party Stash wallet/item transfer, request idempotency, failed-transfer isolation, and Campaign-owned stash namespace behavior; the trusted UI workflow separately passed its Party Stash sequential-transfer routing step.
Inheritance check: GitHub Actions UI run 33570546168 verified the Party Stash owner at product SHA 5bef709f010543859e84c98ef7db8f14e5c06469. GitHub compare 5bef709f010543859e84c98ef7db8f14e5c06469...cf712116381ff8493c8eeebfad7ed8ada95b78ee changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, and docs/roadmap/V1_EVIDENCE_LEDGER.json; the W4-05 production/runtime/tests are inherited unchanged.
Smallest required change: None. W4-05 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-06.
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
