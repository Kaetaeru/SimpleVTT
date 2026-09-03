# V1 Evidence Card

Status: **W6-02 OPEN — PRODUCTION REACHABILITY GAP REPRODUCED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-02
Classification: REUSE_LOCKED
Acceptance criterion: DM can grant exact XP to one or multiple Campaign roster members and grant immediate level-up credit without a reason field; the durable Campaign advancement owner projects the updated values in Session, and a credited Character can complete canonical level-up with the credit consumed and resulting level persisted (MP-E04/E05).
Production entrypoint: CampaignApplicationService.grantAdvancement/consumeLevelUpCredit -> campaignRuntimeAdapter grantCampaignAdvancement/consumeCampaignLevelUpCredit -> connectedCampaignSystemsRuntimeAdapter broadcastAfter + campaign-level-up-complete request -> AppProvider grantCampaignAdvancement/consumeCampaignLevelUpCredit.
Existing automated tests: tests/ui/campaignSystems.test.ts proves multi-member exact XP, no reason field, immediate level-up credit, credit consumption, roster level update, missing-member rejection, and durable Campaign repository ownership. Existing canonical Character level-up tests remain the owner for Character progression commit/persistence.
Exact observed failure: Current production UI reachability is missing. AppProvider exposes grantCampaignAdvancement, and connectedCampaignSystemsRuntimeAdapter broadcasts Host advancement changes, but current CampaignScreen/CampaignSystemsPanel/ProductionSessionWorkspaceBridge contain no production control that invokes grantCampaignAdvancement. Therefore a DM cannot perform MP-E04/E05 through the real product UI despite the owner/runtime implementation existing.
Smallest required change: Add one minimal Host/live advancement control to the existing ProductionSessionWorkspaceBridge that selects existing Campaign roster members, chooses XP or one level-up credit, and calls the existing AppProvider grantCampaignAdvancement path. Do not add a new store, advancement engine, transport message, or Character write path. Preserve the existing campaign-level-up-complete credit-consumption path for Player completion.
Canonical W6-01 reconciliation: official score is 66.3/100.0, 49 PASS / 23 PENDING. The earlier W6-01 card prediction of 66.5 was arithmetic rounding error and is superseded by the official ledger.
Next action: merge the W6-01 reconciliation/current routing, then implement only the W6-02 production reachability repair above and verify existing campaign advancement + connected projection/level-up owners on one exact SHA before closing W6-02.
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
