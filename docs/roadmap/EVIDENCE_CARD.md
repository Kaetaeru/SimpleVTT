# V1 Evidence Card

Status: **W4-06 PASS — DM LIBRARY ORGANIZATION / IMPORT / PRIVATE NOTE / PROVENANCE REUSED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-06
Acceptance criterion: DM Library organization, JSON import, Host-private notes, and provenance are fixed on the existing Campaign-owned production path.
Production entrypoint: CampaignSystemsPanel -> CampaignDmLibraryOrganizationPanel -> campaignDmLibraryOrganizationRuntimeAdapter / campaignDmLibraryImport -> Campaign persistence owners
Existing implementation files: src/CampaignSystemsPanel.tsx; src/CampaignDmLibraryOrganizationPanel.tsx; src/app/campaignDmLibraryOrganizationContracts.ts; src/app/campaignDmLibraryOrganizationRuntimeAdapter.ts; src/app/campaignDmLibraryImport.ts; src/app/campaignPersistenceContracts.ts
Existing automated tests: tests/ui/campaignDmLibraryOrganizationRuntime.test.ts; tests/ui/campaignDmLibraryOrganizationStructure.test.ts; tests/ui/campaignDmLibraryImport.test.ts; tests/ui/campaignDmLibraryNoteStructure.test.ts; tests/ui/campaignDmLibraryStructure.test.ts; tests/ui/campaignDmLibraryDeleteProvenance.test.ts
Existing exact-SHA evidence: product SHA 5bef709f010543859e84c98ef7db8f14e5c06469; GitHub Actions UI run 33570546168 / job 100063331529 = success; Run UI tests = success; docs/roadmap/evidence/W4-06.md records the focused acceptance mapping.
Exact observed result: PASS. Organization tests cover private-note validation/persistence/update/organization/delete plus folder create/rename/delete and persisted folder/favorite placement. Import tests preserve feature-rich custom/magic item runtime fields and provenance, import arrays/NPC definitions, and reject invalid charge/attunement contracts. Note structure tests verify Campaign Session projection exposes neither dmLibrary nor noteText and production structure keeps the Library Host-only. Delete/provenance tests verify Character grants become independent copies that retain provenance after the source Library definition is deleted.
Inheritance check: GitHub Actions UI run 33570546168 verified the DM Library owner at product SHA 5bef709f010543859e84c98ef7db8f14e5c06469. GitHub compare 5bef709f010543859e84c98ef7db8f14e5c06469...083ce354fc2c1fcfd1e1346f976f920a30ccd2c1 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, docs/roadmap/V1_EVIDENCE_LEDGER.json, and docs/roadmap/evidence/W4-06.md; the W4-06 production/runtime/tests are inherited unchanged.
Smallest required change: None. W4-06 is closed as REUSE_LOCKED. No current-HEAD failure authorizes product-code modification; proceed to W4-07.
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
