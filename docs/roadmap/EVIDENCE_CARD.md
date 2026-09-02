# V1 Evidence Card

Status: **W5-01 CLOSED — EXACT-SHA CONNECTED TOPOLOGY / PARTICIPANT LIFECYCLE PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-01
Acceptance criterion: Existing production connected-session path fixes H/P1/P2 topology plus P3 late-join/reconnect lifecycle with Host authority, ordered catch-up, compatibility rejection, replacement-peer reconnect, and exactly-once replay.
Production entrypoint: ProductionSessionWorkspaceBridge -> connectedSessionRuntimeAdapter / productionSessionLifecycleAdapter -> tauriSessionTransport -> Host/Player desktop instances.
Existing implementation files: src/app/connectedSessionRuntimeAdapter.ts; src/app/productionSessionLifecycleAdapter.ts; src/app/connectedSessionState.ts; src/app/tauriSessionTransport.ts; scripts/run-tauri-e2e-handout.mjs.
Existing automated tests: tests/ui/productionParticipantLifecycle.test.ts; tests/ui/productionClientReconnect.test.ts; Phase 12/14 connected lifecycle, participant lifecycle, reconnect, hello replay, Session end, wire/protocol, and shared-runtime suites already composed into GitHub Actions UI.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; V1 Tauri Verification run 33636100197 / job 100267245684 (tauri-w4-07-spatial) = success; artifact SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7, artifact 9849024415, sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0; focused record docs/roadmap/evidence/W5-01.md merged by PR #255.
Exact observed result: PASS. Automated production regressions cover valid live late join, incompatible/invalid rejection without ghost state, participant replacement reconnect, ordered Host-authoritative catch-up, reconnect from accepted replica cursor, and exactly-once hello-ack replay. The same exact product SHA passed real Windows Tauri H+P1+P2 connected topology and replacement reconnect behavior.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...8a4d279d0144abdabeb8c1402cf86c5f55defe64 changes only canonical evidence/current documents plus the W4-07 evidence record. PR #255 adds only docs/roadmap/evidence/W5-01.md. No production source, connected transport/runtime, tests, or Tauri runner changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-01 as PASS in the official ledger/current documents and proceed to W5-02. No product-code modification is authorized.
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