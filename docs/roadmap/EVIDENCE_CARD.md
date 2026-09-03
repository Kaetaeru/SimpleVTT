# V1 Evidence Card

Status: **W7-04 IN PROGRESS — WINDOWS TESTABILITY GAP AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-04
Classification: REUSE_LOCKED
Acceptance criterion: Real Windows Tauri evidence must cover MP-B08 and MP-H09~H12: disconnected owner write-back settles exactly once on reconnect; Character owner write failure is explicit and never reports false shared success; failed Host Campaign write does not publish candidate shared state and exposes explicit recovery; asset/VFX/SFX load failure does not block authoritative mechanics/text completion; a slow P2 does not block H/P1 and later drains in order.
Production entrypoint: Existing Character library and Campaign library generation stores, Character/Campaign compound recovery, connected owner write-back/retry owners, production TCP session transport/outbound peer queues, existing presentation/VFX owners, and the existing scripts/run-tauri-e2e.mjs + tauri-e2e Tauri/WebDriver binary. No second persistence, retry, transport, reconnect, presentation, or E2E system is authorized.
Existing automated verification: .github/workflows/w7-04-auto.yml focused recovery owners plus src-tauri library tests already cover prerequisite AUTO behavior, but the workflow explicitly records win_obs=not claimed. Existing scripts/run-tauri-e2e.mjs launches isolated real Windows Tauri Host+Client instances with separate data roots/WebDriver ports, and can be extended rather than replaced.
Existing Tauri/Windows evidence: W7-04 release executable/digest prerequisite was captured before current HEAD; current workflow states that Host crash/write-failure/rejoin/slow-peer multi-instance observation is still required.
Exact observed failure: No product behavior failure is established. The current real-Tauri harness has a production testability/reachability gap: after a valid Host/Client session is established, there is no deterministic existing control that can selectively force the next Character-library or Campaign-library durable write to fail while leaving the rest of the process/session usable. SIMPLEVTT_LOCAL_DATA_ROOT only relocates the store and does not provide selective failure injection. Therefore MP-H09/H10 cannot be reproduced deterministically in Windows CI through the existing runner without a test-only seam.
Smallest authorized change: Add only debug_assertions + tauri-e2e-gated one-shot persistence fault markers to the existing Tauri write command path, controlled through files under each isolated E2E data root; extend scripts/run-tauri-e2e.mjs with --w704 and scripts/run-tauri-e2e.ps1 with -W704; wire .github/workflows/w7-04-auto.yml to run the existing Tauri/WebDriver harness on windows-latest and upload exact-SHA scenario artifacts. The seam must be absent from release builds and must not create a second owner/store/retry/recovery path.
Verification SHA: pending branch verification from integration HEAD 02ac2d865fe4cd576bc44bbb2b579022143f24e2.
Verification: pending Windows PR workflow.
Artifact: pending Windows PR workflow.
Closure: Do not mark W7-04 PASS until actual Windows multi-instance observations succeed and exact-SHA evidence is recorded in the ledger.
```

## Change gate

Product code may change only when at least one of the following is true on the current exact integration-derived working branch:

1. a reproducible current-HEAD failure exists;
2. the acceptance criterion has no production entrypoint;
3. implementation exists but is not reachable through the real Tauri product path;
4. persistence, reconnect, ownership, authority, privacy, or recovery behavior contradicts the canonical contract.

For `REUSE_LOCKED` and `VERIFY_ONLY` gates, an empty `Exact observed failure` means **no product-code change is authorized**. Reuse the existing implementation and record evidence instead. A documented production testability/reachability gap may authorize only the smallest test-only seam needed to observe the existing owner path; it does not authorize replacement product behavior.

## Evidence rules

- Record exact SHA(s), commands, deterministic pass/fail counts, and artifact references in `V1_EVIDENCE_LEDGER.json`.
- Structural/source-only checks cannot close rendered Windows behavior.
- Older SHA evidence may be inherited only when the relevant implementation path is unchanged and the ledger records the provenance explicitly.
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores or observes the existing production path.
