# V1 Evidence Card

Status: **W6-07 CLOSED — MP-G01~G09 DM LIBRARY / HANDOUT / SPATIAL AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-07
Classification: REUSE_LOCKED
Acceptance criterion: Freeze the existing connected DM Library materialization, image-handout projection, and Host-authoritative Scene/spatial capability paths as the automated owner set for MP-G01~G09, including reveal/withdraw/privacy/reconnect continuity and compatible/mismatched spatial behavior.
Production entrypoint: Existing Campaign DM Library definitions/materialization/provenance, Session image-handout runtime adapter, connected Scene topology projection and Host mutation owners, remote fixture identity projection, Host authority, reconnect, and privacy paths; no second DM Library, handout system, Scene model, spatial transport, or presentation pipeline is authorized.
Existing automated tests: tests/ui/campaignDmLibraryImport.test.ts; tests/ui/campaignDmLibraryGrantDurability.test.ts; tests/ui/sessionImageHandoutRuntimeAdapter.test.ts; tests/ui/connectedSceneTopologyProjection.test.ts; tests/ui/connectedSceneTopologyHostMutation.test.ts; tests/ui/productionHostRemoteFixtureIdentityProjection.test.ts.
Exact observed failure: None on verification head 63f6943b6c015ed24dfd405087d3d18b3d6415cd. GitHub Actions pull-request checkout 888fe416e7653d49e93c71a6165304e3fd05a9ff and the verification head share tree e7009e28b279b7d1a63f291bbffde5c0a33f7746; focused verification and production build passed.
Smallest authorized change: No product/runtime or test-implementation change. Add the focused workflow and record exact-tree evidence only.
Verification SHA: 63f6943b6c015ed24dfd405087d3d18b3d6415cd (Actions checkout 888fe416e7653d49e93c71a6165304e3fd05a9ff; shared tree e7009e28b279b7d1a63f291bbffde5c0a33f7746)
Verification: W6-07 AUTO Verification run 33713348784 / job 100517304162 = success; 9/9 focused tests PASS; production build PASS.
Artifact: 9877676750, W6-07-AUTO-888fe416e7653d49e93c71a6165304e3fd05a9ff, sha256:1c9bffe62e50a4bf24f0ed94b9fe16327f3ec7053043f60d89edc9030a3cd094.
Closure: W6-07 PASS. Reconcile the official ledger to 73.8/100.0 (55 PASS / 17 PENDING), then open W6-08 under the same evidence-first rule. Existing W4-07 rendered Windows H + P1 + P2 MP-G01~G09 evidence remains authoritative for rendered acceptance.
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
