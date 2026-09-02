# V1 Evidence Card

Status: **W5-04 CLOSED — RESOLUTION PRESENTATION ENVELOPE PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W5-04
Acceptance criterion: Host-authored immutable Resolution Presentation Envelope preserves deterministic resolution identity, structured authoritative dice including selected/discarded faces, outcome/timeline semantics, privacy/redaction, and Activity linkage across live and catch-up delivery; connected Clients render the Host result without rerunning mechanics.
Production entrypoint: connectedActionRoutingAdapter publishConnectedResolutionPresentation/publishCommittedResolution -> connectedResolutionPresentation -> connectedSessionRuntimeAdapter wire fan-out / Client apply -> shared VisualDiceBridge + CombatVfxBridge.
Existing implementation files: src/app/connectedResolutionPresentation.ts; src/app/connectedActionRoutingAdapter.ts; src/app/connectedSessionRuntimeAdapter.ts.
Existing automated tests: connected Session/presentation regression coverage composed into GitHub Actions UI; GitHub issue #111 implementation checkpoint records connected regression 187/187 plus TypeScript and Vite production build success.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions UI run 33636100212 / job 100267245818 = success; focused record docs/roadmap/evidence/W5-04.md merged by PR #261; GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...1ca6e911087a09dced61cf6a4c7e60df29e64db0 is ahead-only and changes only canonical evidence/current docs plus evidence W4-07/W5-01/W5-02/W5-03/W5-04.
Exact observed result: PASS. connectedResolutionPresentation fixes schema/version identity, resolutionId and presentationSequence, authoritative faces with selected/discarded indices and totals, actor/target/action/outcome semantics, cumulative timeline, public redaction, and Activity linkage. connectedActionRoutingAdapter publishes live stages and commits the same presentation into ordered Host event history for catch-up without a Client mechanics rerun; private interrupt/concentration input remains in owner-targeted prompts rather than the public envelope. GitHub issue #111 records the same frozen boundary, including shared VisualDiceBridge + CombatVfxBridge rendering and terminal catch-up without reroll.
Inheritance check: GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...1ca6e911087a09dced61cf6a4c7e60df29e64db0 changes only docs/CURRENT.md, docs/roadmap/CURRENT.md, docs/roadmap/EVIDENCE_CARD.md, docs/roadmap/V1_EVIDENCE_LEDGER.json, and evidence records W4-07/W5-01/W5-02/W5-03/W5-04. No production source, connected runtime, tests, Tauri runner, or workflow implementation changed across the inherited path.
Exact observed failure: None.
Smallest required change: None. Record W5-04 as PASS in the official ledger/current documents and proceed to W5-05. No product-code modification is authorized.
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