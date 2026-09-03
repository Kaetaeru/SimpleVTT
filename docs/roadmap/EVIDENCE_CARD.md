# V1 Evidence Card

Status: **W5-09 CURRENT-HEAD FAILURE REPRODUCED — TEST FIXTURE REPAIR VERIFIED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-09
Classification: REUSE_LOCKED
Acceptance criterion: automated UI-facing Host/P1/P2 parity evidence covers MP-J01 through MP-J08 across public Scene state, Session/turn/economy state, selected Character actions, owner inventory/GP/items, active Resolution presentation, and public Activity changes. Protocol-only or persistence-only assertions are insufficient; rendered Windows parity remains a later V1 release requirement.
Production entrypoint: existing connected Host/Client projection, Party Stash owner-transfer/approval, authoritative Scene topology, remote Character projection handshake, three-peer action/presentation, turn projection, and Undo compensation paths.
Existing implementation files: src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedActionRoutingAdapter.ts; src/app/connectedResolutionPresentation.ts; src/app/connectedTurnRoutingAdapter.ts; src/app/connectedSessionProtocol.ts; src/app/connectedCharacterProjectionHandshake.ts; src/app/productionSessionEmptyEncounterAdapter.ts; src/app/campaignPartyStashPolicyRuntimeAdapter.ts.
Existing automated tests: tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts; tests/ui/connectedSceneTopologyProjection.test.ts; tests/ui/connectedSceneTopologyHostMutation.test.ts; tests/ui/productionHostRemoteFixtureIdentityProjection.test.ts; tests/ui/connectedThreePeerActionMatrix.test.ts; tests/ui/connectedThreePeerPresentation.test.ts; tests/ui/connectedTurnProjection.test.ts; tests/ui/connectedUndoCompensation.test.ts.
Existing exact-SHA evidence: canonical SHA 5f7bb4bdbc20da3ff437809e3d7f3f024e159f1d, W5-09 AUTO run 33698750944 / job 100473212192 = 17/18 PASS, 1 FAIL; failure artifact 9872730067 (W5-09-AUTO-5f7bb4bdbc20da3ff437809e3d7f3f024e159f1d), sha256:fc157bfecb250a2fdf719b0d9d516bf9d8340ed504ab1c292312d7b621b4d3da.
Exact observed failure: productionHostRemoteFixtureIdentityProjection rejected the remote fixture Character because its test-only projection referenced content:dnd.srd-5.2.1@2024#dnd.srd521.background.soldier while the production-composed Host catalog uses the current generated 0.1-draft identities.
Root cause: stale automated test fixture. The test manually injected a three-entry @2024 catalog, then production snapshot composition materialized the real 509-entry @0.1-draft catalog before the Host handshake. Product handshake/runtime behavior was not the defect.
Smallest required change: test-only. Build the fixture Character projection from the production snapshot catalog instead of a hard-coded three-entry @2024 catalog. No src/ product/runtime file changed.
Repair verification: SHA 8cfba705da716d1fd5fd145a7870a774363f460b, W5-09 AUTO run 33699271386 / job 100474814937 = 18/18 PASS; artifact 9872911463 (W5-09-AUTO-8cfba705da716d1fd5fd145a7870a774363f460b), sha256:a79b395d266e6084dc419ce898a63307affa44966b96c1a93442300d867f46bc.
Required next verification: merge the test-only repair and re-run W5-09 AUTO on the canonical work/v1-composite merge SHA. Record that exact-SHA result before closing W5-09 in the official ledger.
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