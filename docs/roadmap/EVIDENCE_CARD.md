# V1 Evidence Card

Status: **W5-02 CLOSED — TRUSTED PERSISTED CHARACTER OWNER PROJECTION PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-02
Acceptance criterion: A Host-unknown persisted Character mounts only as a trusted ephemeral owner projection; Host canonical content/source/runtime facts remain authoritative, client-derived presentation mechanics cannot become rules authority, projected-player resolution temporarily activates the owner context and restores Host/local context, and local Host control does not transfer remote Character ownership.
Production entrypoint: connectedSessionRuntimeAdapter hello/projection path -> characterSessionProjection parse/build -> characterSessionProjectionRegistry / characterSessionProjectionMount -> production connected Session runtime.
Existing implementation files: src/app/characterSessionProjection.ts; src/app/characterSessionProjectionRegistry.ts; src/app/characterSessionProjectionMount.ts; src/app/connectedSessionRuntimeAdapter.ts; src/app/productionPlayRuntimeAdapter.ts.
Existing automated tests: tests/ui/characterSessionProjection.test.ts; tests/ui/productionLocalCharacterSwitch.test.ts; tests/ui/productionParticipantLifecycle.test.ts; Phase 14 connected ownership/projection verification already composed into GitHub Actions UI.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; V1 Tauri Verification run 33636100197 / job 100267245684 (tauri-w4-07-spatial) = success; artifact SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7, artifact 9849024415, sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0; focused record docs/roadmap/evidence/W5-02.md merged by PR #257.
Exact observed result: PASS. Projection tests keep AC/presented attacks/client drift out of trusted source authority, reject injected mechanics and impossible HP, and require exact Host canonical identities. Production connected tests reject invalid SessionProjection before ghost state. The local-character-switch regression preserves remote ephemeral projection ownership, temporarily activates projected resolution context, and restores the prior local/Host context without overwriting projection-owned actions/economy.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...761f1d08601f3f4192ec9bc1339d09b64858eafe is ahead-only and changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, docs/roadmap/V1_EVIDENCE_LEDGER.json, and evidence records W4-07/W5-01/W5-02. No production source, connected runtime, projection code, tests, Tauri runner, or workflow implementation changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-02 as PASS in the official ledger/current documents and proceed to W5-03. No product-code modification is authorized.
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