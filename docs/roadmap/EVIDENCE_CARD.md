# V1 Evidence Card

Status: **W7-04 IN PROGRESS — WINDOWS FAULT SEAM VERIFIED; MULTI-INSTANCE WIN OBSERVATION NEXT**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-04
Classification: REUSE_LOCKED
Acceptance criterion: Real Windows Tauri evidence must cover MP-B08 and MP-H09~H12: disconnected owner write-back settles exactly once on reconnect; Character owner write failure is explicit and never reports false shared success; failed Host Campaign write does not publish candidate shared state and exposes explicit recovery; asset/VFX/SFX load failure does not block authoritative mechanics/text completion; a slow P2 does not block H/P1 and later drains in order.
Production entrypoint: Existing Character library and Campaign library generation stores, Character/Campaign compound recovery, connected owner write-back/retry owners, production TCP session transport/outbound peer queues, existing presentation/VFX owners, and the existing scripts/run-tauri-e2e.mjs + tauri-e2e Tauri/WebDriver binary. No second persistence, retry, transport, reconnect, presentation, or E2E system is authorized.
Existing automated verification: .github/workflows/w7-04-auto.yml focused recovery owners plus src-tauri library tests cover prerequisite AUTO behavior. Existing scripts/run-tauri-e2e.mjs launches isolated real Windows Tauri Host+Client instances with separate data roots/WebDriver ports and remains the required owner path for the missing WIN observations.
Existing Tauri/Windows evidence: PR #313 verified a debug_assertions + tauri-e2e-only one-shot generation-store fault marker on windows-latest, then ran the unchanged Rust library suite and built the release Windows application successfully. The workflow still explicitly does not claim MP-B08/MP-H09~H12 multi-instance WIN closure.
Exact observed failure: No product behavior failure is established. The real-Tauri harness had a production testability/reachability gap: after a valid Host/Client session is established, there was no deterministic control that could selectively force the next Character-library or Campaign-library durable write to fail while leaving the rest of the process/session usable. SIMPLEVTT_LOCAL_DATA_ROOT only relocates the store. PR #313 closed only this testability gap with a one-shot marker compiled under debug_assertions + tauri-e2e; it did not add replacement product behavior.
Smallest authorized change: Reuse the now-verified one-shot persistence marker and extend scripts/run-tauri-e2e.mjs with --w704 plus scripts/run-tauri-e2e.ps1 with -W704; wire .github/workflows/w7-04-auto.yml so windows-latest launches real Tauri instances, exercises MP-B08 and MP-H09~H12, records exact-SHA scenario results/logs/captures, and fails if any required WIN observation is absent. Add a third peer only where MP-H12 requires it. No second owner/store/retry/recovery/transport/presentation/E2E path is authorized.
Verification SHA: 3a8a95975d0186f7208854083092873667739fcc (PR #313 head), integrated as merge 890498c8d16eed871af0fc849d4d6f4db0190e9a; Actions PR checkout/artifact SHA 0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b.
Verification: GitHub Actions W7-04 Recovery Prerequisite Verification run 33807621573 succeeded. auto-recovery job 100821749246 passed the focused W7-04 owners and production build. windows-storage-package job 100821749471 passed the one-shot tauri-e2e fault-seam test, the existing Rust persistence/transport library tests, and the release Windows application build.
Artifact: AUTO prerequisite artifact 9913583602, W7-04-AUTO-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:b05778ff73f8da7d5a4161791f1c5f49bcabcc72e608bfa644774c51090133fa. Windows prerequisite artifact 9913926913, W7-04-WINDOWS-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:f5c2dc92b5375520988e883abfede2c00a16409b9af9a719751bfbda6fa5880e.
Closure: W7-04 remains PENDING. Do not mark it PASS until actual real-Tauri multi-instance WIN observations for MP-B08 and MP-H09~H12 succeed and their exact-SHA evidence is recorded in the ledger.
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
