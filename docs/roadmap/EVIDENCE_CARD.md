# V1 Evidence Card

Status: **W5-05 CLOSED — ORDERED REMOTE PRESENTATION QUEUE PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-05
Acceptance criterion: remote Resolution presentation preserves Host causal order with duplicate suppression, reconnect/catch-up continuity, and no Client reroll or duplicate presentation of an already accepted Host result.
Production entrypoint: connectedActionRoutingAdapter Host live/catch-up publication -> connectedSessionRuntimeAdapter applyConnectedResolutionPresentation / enqueueOrInstallConnectedPresentation / applyConfirmedPayload -> ClientSessionReplica ordered event apply.
Existing implementation files: src/app/connectedActionRoutingAdapter.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/connectedSessionProtocol.ts; src/app/connectedSessionState.ts.
Existing automated tests: tests/ui/connectedResolutionPresentation.test.ts; tests/ui/productionClientReconnect.test.ts; connected Session/presentation regression coverage composed into GitHub Actions UI; GitHub issues #111 and #114 implementation checkpoints.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; focused record docs/roadmap/evidence/W5-05.md merged by PR #263; GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...be061030081a3ba9f570a1a9a7696283d2512f36 is ahead-only and changes only canonical evidence/current docs plus evidence W4-07/W5-01/W5-02/W5-03/W5-04, while PR #263 adds only W5-05 focused evidence.
Exact observed result: PASS. Live presentation accepts only strictly newer presentationSequence values; duplicate/non-monotonic live envelopes are ignored. Non-dice stages queue FIFO, while a newer authoritative dice signal replaces the active replay and clears stale queued stages. Terminal catch-up is carried in the committed Host resolution event and applied without invoking mechanics resolution. ClientSessionReplica rejects duplicate event IDs, conflicting history, and sequence gaps, and reconnect resumes from the accepted replica cursor so replayed catch-up is not applied twice.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...be061030081a3ba9f570a1a9a7696283d2512f36 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, docs/roadmap/V1_EVIDENCE_LEDGER.json, and evidence records W4-07/W5-01/W5-02/W5-03/W5-04. PR #263 adds only docs/roadmap/evidence/W5-05.md. No production source, connected runtime, presentation/reconnect tests, Tauri runner, or workflow implementation changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-05 as PASS in the official ledger/current documents and proceed to W5-06. No product-code modification is authorized.
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