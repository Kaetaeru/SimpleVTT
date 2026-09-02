# V1 Evidence Card

Status: **W4-01 PASS — CAMPAIGN LIFECYCLE AND NAMESPACE ISOLATION REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-01
Acceptance criterion: Campaign create/read/update/archive/restore/duplicate/delete and namespace isolation are fixed on the existing production path.
Production entrypoint: ProductRoot -> Campaign -> Campaign application/runtime adapter -> durable Campaign library
Existing implementation files: src/app/campaignPersistence.ts; src/app/campaignApplicationService.ts; src/app/campaignRuntimeAdapter.ts; src/CampaignScreen.tsx
Existing automated tests: tests/ui/campaignPersistence.test.ts; tests/ui/campaignRuntimeAdapter.test.ts; tests/ui/campaignProductUiStructure.test.ts; tests/ui/campaignStartupRecoveryStructure.test.ts; tests/ui/campaignLifecycleRuntime.test.ts; tests/ui/campaignLifecycleUiStructure.test.ts
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168; job 100063331529 = success; step "Verify Campaign lifecycle and declarative providers" = success.
Exact observed result: PASS. campaignPersistence.test.ts exercises durable create/read/update/archive/restore/duplicate/delete and reload, including idempotent mutation requests and stale-revision rejection. campaignLifecycleRuntime.test.ts proves duplication receives independent campaign.copy.stash and campaign.copy.dm-library namespaces and deletion removes only the target Campaign. campaignPersistence.ts derives Campaign-owned Party Stash, DM Library, and content-loadout identifiers from campaignId.
Inheritance check: GitHub compare 5bef709f010543859e84c98ef7db8f14e5c06469...b917e20b27d6c80a3bcc5783c20c9b0fd0042894 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, and docs/roadmap/V1_EVIDENCE_LEDGER.json. The verified Campaign implementation, tests, and UI workflow are unchanged on canonical HEAD.
Smallest required change: None. W4-01 is closed as REUSE_LOCKED. Do not modify the Campaign lifecycle owner for this Gate without a new current-HEAD failure; proceed to W4-02.
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
