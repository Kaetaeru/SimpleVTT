# V1 Evidence Card

Status: **W7-04 IN PROGRESS — CURRENT-HEAD RECONNECT FAILURE REPRODUCED; MINIMAL REPAIR AUTHORIZED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-04
Classification: REUSE_LOCKED
Acceptance criterion: Real Windows Tauri evidence must cover MP-B08 and MP-H09~H12: disconnected owner write-back settles exactly once on reconnect; Character owner write failure is explicit and never reports false shared success; failed Host Campaign write does not publish candidate shared state and exposes explicit recovery; asset/VFX/SFX load failure does not block authoritative mechanics/text completion; a slow P2 does not block H/P1 and later drains in order.
Production entrypoint: Existing Character library and Campaign library generation stores, Character/Campaign compound recovery, connected owner write-back/retry owners, production TCP session transport/outbound peer queues, existing presentation/VFX owners, and the existing scripts/run-tauri-e2e.mjs + tauri-e2e Tauri/WebDriver binary. No second persistence, retry, transport, reconnect, presentation, or E2E system is authorized.
Existing automated verification: .github/workflows/w7-04-auto.yml focused recovery owners plus src-tauri library tests cover prerequisite AUTO behavior. Existing scripts/run-tauri-e2e.mjs launches isolated real Windows Tauri Host+Client instances with separate data roots/WebDriver ports and remains the required owner path for the missing WIN observations.
Existing Tauri/Windows evidence: PR #313 verified a debug_assertions + tauri-e2e-only one-shot generation-store fault marker on windows-latest, then ran the unchanged Rust library suite and built the release Windows application successfully. PR #310 was refreshed onto canonical 37784e4040f074e273deb37034990c85599a384b as verification-only head a2e3bd0bd773c42d0d812f9859bf26c7ac16e689 before the current behavior failure was reproduced.
Exact observed failure: On current-canonical-derived PR #310 head a2e3bd0bd773c42d0d812f9859bf26c7ac16e689, GitHub Actions run 33811875390 / windows-multi-instance-recovery job 100835310388 reproduced MP-B08 reconnect failure in the real Windows Tauri H+P1+P2 path. After the runner terminated P1, Host-side session work still targeted the disconnected peer 127.0.0.1:53899 and WebDriver observed `session transport peer is not connected: 127.0.0.1:53899`; the relaunched P1 then failed to reach `클라이언트 · 플레이어` during join. This establishes a current-HEAD production reconnect/ownership defect rather than only a harness reachability gap.
Smallest authorized change: Repair only the existing connected-session reconnect/roster path so a physically disconnected stale peer cannot block the same owned Character from rejoining, while preserving the existing transport, owner write-back, retry, duplicate suppression, and authority owners. Do not add a second reconnect/transport system. Then rerun the W7-04 real Windows observations. For H09/H10 deterministic write failure, reuse the already-verified one-shot persistence marker; keep W7-04 orchestration on the existing Tauri/WebDriver E2E owner path and add P2 only where MP-H12 requires it.
Verification SHA: Current behavior failure reproduced from PR #310 head a2e3bd0bd773c42d0d812f9859bf26c7ac16e689 against canonical base 37784e4040f074e273deb37034990c85599a384b; Actions PR merge checkout c89fba10cef8e7eda849a4d1d6e1045f9cdb5e01. Earlier seam verification SHA 3a8a95975d0186f7208854083092873667739fcc was integrated as merge 890498c8d16eed871af0fc849d4d6f4db0190e9a.
Verification: GitHub Actions W7-04 Recovery Prerequisite Verification run 33811875390: auto-recovery job 100835310217 PASS; current-head one-shot fault seam PASS inside windows-storage-package; windows-multi-instance-recovery job 100835310388 FAIL at MP-B08 P1 reconnect as recorded above. The earlier prerequisite run 33807621573 remains valid for the integrated test-only seam.
Artifact: Current-head failure artifact 9915236457, W7-04-WIN-c89fba10cef8e7eda849a4d1d6e1045f9cdb5e01, sha256:209a66f39f3a99fc74bf2d00f4781efe5f79a0cd92347e41e357718a6a7ce14e. Earlier AUTO prerequisite artifact 9913583602, W7-04-AUTO-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:b05778ff73f8da7d5a4161791f1c5f49bcabcc72e608bfa644774c51090133fa. Earlier Windows prerequisite artifact 9913926913, W7-04-WINDOWS-PREREQ-0d9ebf69ae10b51ccbe3f2ed55c91776cba47b3b, sha256:f5c2dc92b5375520988e883abfede2c00a16409b9af9a719751bfbda6fa5880e.
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