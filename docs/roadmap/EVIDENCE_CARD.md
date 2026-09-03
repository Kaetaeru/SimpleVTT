# V1 Evidence Card

Status: **W6-01 CLOSED — DM INVENTORY / GP / OWNER PROJECTION AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-01
Classification: REUSE_LOCKED
Acceptance criterion: freeze the existing DM item/GP grant-revoke and Character-owner projection refresh paths for MP-E01/E02/E03 and owner inventory/GP parity. Catalog/custom item grants and revokes must converge on the durable owner state; equipped-item revoke policy must be explicit; GP mutation must be exact with overdraft rejection; accepted connected owner mutations must carry fresh Character revision identity and refresh through the existing projection path.
Production entrypoint: sessionInventoryRuntimeAdapter + connectedCampaignSystemsRuntimeAdapter + characterSessionProjection/reconstruction + connectedCharacterProjectionHandshake + characterSessionProjectionMount + campaignDmLibraryMaterializationAdapter.
Existing automated tests: sessionInventoryRuntimeAdapter.test.ts; campaignDmLibraryGrantDurability.test.ts; connectedCampaignOwnerInventoryWire.test.ts; connectedCharacterInventoryProjectionRefresh.test.ts; connectedCustomItemProjection.test.ts.
Exact observed failure: None.
Smallest required change: None to product/runtime/test implementation. PR #291 added only one focused workflow to execute the existing owner tests together on one exact SHA.
Canonical closure evidence: SHA 30606e6b056027a3e10ddbae70f38f428b2714b6; W6-01 AUTO run 33701452879 / job 100481432959 = 13/13 PASS, 0 FAIL; artifact 9873659413 (W6-01-AUTO-30606e6b056027a3e10ddbae70f38f428b2714b6), sha256:bb6031112dd14fedf00aa90485e7583332cdaefd1befe4f223d710e4939e2204.
Exact observed result: PASS. Existing DM catalog/custom item grant/revoke, explicit forceUnequip revoke policy, GP grant/Undo/overdraft, durable DM Library grant, connected owner revision identity, inventory refresh, and custom-item projection safety all pass together on the canonical exact SHA.
Remaining release limitation: W6-01 AUTO evidence does not close later Windows/rendered multiplayer acceptance or the whole MP-05/#116 issue. Those remain governed by their own repository-native criteria.
Next action: reconcile W6-01 PASS into V1_EVIDENCE_LEDGER.json, advance the official score from 65.0 to 66.5 with 49 PASS / 23 PENDING, then route to W6-02.
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
