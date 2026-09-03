# V1 Evidence Card

Status: **W6-08 CLOSED — WINDOWS H+P1 JOURNEY J5 PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-08
Classification: VERIFY_ONLY
Acceptance criterion: Verify the existing Windows Tauri H+P1 representative DM live-operation flow for Journey J5 / MP-E~G: Character GP grant/revoke, Party Stash, connected image handout reveal/withdraw, and distributed Character+Campaign Long Rest. Final P2 observer parity remains W9-02 only.
Production entrypoint: Existing Windows Tauri/WebDriver harness over the production Session shell, durable Character inventory owner, Campaign Party Stash transaction path, connected image-handout projection, Campaign calendar, and distributed Character+Campaign Long Rest coordinator; no alternate Session shell, inventory/Stash transaction path, rest coordinator, handout system, or E2E framework is authorized.
Existing automated/rendered verification: scripts/run-tauri-e2e-w6-08-v2.mjs through npm run test:e2e:tauri -- --w608, followed by npm run build.
Exact observed failure: No product/runtime failure on verification head 36a9848a025f078f60b956e05f3432cbf5b14da4. Earlier failures while constructing the new evidence were harness-only: saved-Character setup, controlled numeric input replacement, zero-GP assumption, Campaign-calendar setup, and XPath passed to document.querySelector.
Smallest authorized change: Harness-only corrections plus the scoped W6-08 workflow/evidence. No src/ product/runtime file changed.
Verification SHA: 36a9848a025f078f60b956e05f3432cbf5b14da4 (Actions pull-request checkout db4d81f521cf15774dcff13d3249186f0c19dde1; GitHub compare reports zero changed files between verification head and synthetic checkout).
Verification: W6-08 Tauri Verification run 33716559390 / job 100526862083 = success; real Windows Tauri H+P1 Journey J5 PASS; production build PASS.
Artifact: 9878842089, SimpleVTT-W6-08-Tauri-36a9848a025f078f60b956e05f3432cbf5b14da4, sha256:b44dfe4f486409522630c632819665cee4eccdab72077857838876a33ac747b9.
Closure: W6-08 PASS. Reconcile the official ledger to 75.0/100.0 (56 PASS / 16 PENDING), W6 8/8 PASS, then execute W7-01. Final P2 observer-parity acceptance is not claimed here and remains W9-02.
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
