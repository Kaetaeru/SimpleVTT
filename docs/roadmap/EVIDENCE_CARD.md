# V1 Evidence Card

Status: **W6-02 CLOSED — REACHABILITY REPAIR VERIFIED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-02
Classification: REUSE_LOCKED
Acceptance criterion: DM can grant exact XP to one or multiple Campaign roster members and grant immediate level-up credit without a reason field; the durable Campaign advancement owner projects the updated values in Session, and a credited Character can complete canonical level-up with the credit consumed and resulting level persisted (MP-E04/E05).
Production entrypoint: CampaignApplicationService.grantAdvancement/consumeLevelUpCredit -> campaignRuntimeAdapter grantCampaignAdvancement/consumeCampaignLevelUpCredit -> connectedCampaignSystemsRuntimeAdapter broadcastAfter + campaign-level-up-complete request -> AppProvider grantCampaignAdvancement/consumeCampaignLevelUpCredit.
Existing automated tests: tests/ui/campaignSystems.test.ts proves multi-member exact XP, no reason field, immediate level-up credit, credit consumption, roster level update, missing-member rejection, and durable Campaign repository ownership. Existing canonical Character level-up tests remain the owner for Character progression commit/persistence.
Exact observed failure: Current production UI reachability was missing. AppProvider exposed grantCampaignAdvancement, and connectedCampaignSystemsRuntimeAdapter broadcast Host advancement changes, but CampaignScreen/CampaignSystemsPanel/ProductionSessionWorkspaceBridge contained no production control that invoked grantCampaignAdvancement. Therefore a DM could not perform MP-E04/E05 through the real product UI despite the owner/runtime implementation existing.
Smallest authorized change: Add one minimal Host/live advancement control to the existing ProductionSessionWorkspaceBridge that selects existing Campaign roster members, chooses XP or one level-up credit, and calls the existing AppProvider grantCampaignAdvancement path. Do not add a new store, advancement engine, transport message, or Character write path. Preserve the existing campaign-level-up-complete credit-consumption path for Player completion.
Implemented repair: PR #294 added ProductionSessionAdvancementPanel and mounted it in ProductionSessionWorkspaceBridge; no parallel progression owner was added.
Verification SHA: a72387016fec255674b8132b1f8b80b08d99da25
Verification: W6-02 AUTO Verification run 33703181522 / job 100486658419 = success; 13/13 focused tests PASS; production build PASS.
Artifact: 9874278799, W6-02-AUTO-9a07c28309ffe781d4ed1e4cea33f7e8f0706577, sha256:abc109aca9d519e96aec8e03d442a2e071151c659e658a27b99207607f93fc0c. Artifact name uses the pull-request synthetic merge SHA; run head_sha is the authoritative product verification SHA above.
Canonical integration: PR #294 merged as b11f5267121c2c4dfb11176ef6ff12841f3c877b.
Closure: W6-02 PASS. Open a new Evidence Card for W6-03 only if its current exact-head verification reproduces a failure or production reachability/contract gap before changing product code.
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
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
