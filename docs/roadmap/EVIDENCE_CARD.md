# V1 Evidence Card

Status: **W4-08 CLOSED — EXACT-SHA WINDOWS CAMPAIGN REOPEN JOURNEY PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W4-08
Acceptance criterion: Actual Tauri Campaign preparation -> Session start/end -> process exit -> same-data-root Campaign reopen is proven through the production UI path.
Production entrypoint: ProductRoot -> Campaign UI -> ProductionSessionWorkspaceBridge -> local Host Session -> production Session stop -> app process exit/restart -> Campaign dashboard reopen.
Existing implementation files: scripts/run-tauri-e2e-w3.mjs; src/ProductionSessionWorkspaceBridge.tsx; src/app/campaignRuntimeAdapter.ts; src/app/campaignSessionHistoryRuntimeAdapter.ts; src/main.tsx.
Existing automated tests: tests/ui/appProviderStopSessionRefresh.test.ts plus the existing Windows Tauri W3 complete-session harness invoked by npm run test:e2e:tauri -- --w3.
Existing exact-SHA evidence: product verification SHA 2ac28651312f1fdbe82edb74fd13f342a8f910f7; GitHub Actions V1 Tauri Verification run 33636100197 / job 100267245439 (tauri-w3) = success; stop-session regression 2/2 PASS; artifact SimpleVTT-W3-Tauri-2ac28651312f1fdbe82edb74fd13f342a8f910f7, artifact 9849024676, sha256:40fd32b55ec3f6d92f47c29b6acff20d599e64b3b7f757ddf5c9b73e270860e3.
Exact observed result: PASS. The real Windows Tauri journey prepares a Character/Campaign through production UI, materializes the DM-owned PC preset, starts a local Host Session, performs play and Long Rest (+8h), ends through the production Session pane, exits the process, relaunches on the same data root, reopens the Campaign, and asserts absolute time 480 minutes plus one completed session-history entry.
Inheritance check: the Actions synthetic merge f05147605e4dce56a0552b69fa361f28d4c5cf60 has no file differences from verification head 2ac28651312f1fdbe82edb74fd13f342a8f910f7. GitHub compare 2ac28651312f1fdbe82edb74fd13f342a8f910f7...ceaf3ebf786ffa13d934d68c0fcebcc58cb00ae8 changes only canonical evidence/current documents plus the W4-07 evidence record, so the verified W4-08 product/runtime/harness path is inherited unchanged.
Exact observed failure: None.
Smallest required change: None. Record the exact-SHA Windows evidence, close W4-08 and W4, and proceed to W5-01. No product-code modification is authorized.
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
