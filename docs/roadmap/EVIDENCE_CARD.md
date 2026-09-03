# V1 Evidence Card

Status: **W7-04 REPAIR — RECONNECT STALE-PEER FAILURE REPRODUCED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W7-04
Classification: REUSE_LOCKED -> REPAIR after reproduced failure
Acceptance criterion: owner writeback, Host Campaign write, and partial persistence recovery remain correct for MP-B08 and MP-H09~H12, including Player process loss/rejoin without sending recovery projections to a disconnected transport peer.
Production entrypoint: Existing connected Session transport + connected Campaign systems projection + owner inventory writeback/recovery owners. No second transport, Campaign write path, persistence journal, retry coordinator, reconnect system, or owner store is authorized.
Existing automated verification: W7-04 Recovery Prerequisite Verification plus the existing focused owner/recovery suite and actual Windows H+P1+P2 Tauri harness (`scripts/run-tauri-e2e.ps1 -W704`).
Exact observed failure: GitHub Actions run 33762474036 / job 100671938437, V1_VERIFICATION_SHA d3e06a9e57376c0a3844eadf5df1dcd9b2f648cc, PR synthetic merge checkout 8592f2e85e0ec7d3e1f105eff87afe1cd62410aa onto integration base 886662ebc6f4d2a99b671974cd6d3309d187893a. Actual Windows Tauri H+P1+P2 recovery fails after P1 process termination/rejoin with `session transport peer is not connected: 127.0.0.1:60285`, then the client never reaches `클라이언트 · 플레이어`. Current integration-derived source still broadcasts Campaign systems projection to every `peerParticipants` key without checking whether that peer is still transport-connected.
Smallest authorized change: Repair the existing `connectedCampaignSystemsRuntimeAdapter.ts` broadcast path so Campaign systems projection excludes stale disconnected participant peers, and add/adjust the nearest existing regression test only as needed. Do not alter unrelated reconnect, transport, persistence, or Campaign authority paths.
Verification SHA: pending on `agent/w7-04-windows-recovery-f2272bb5` from integration base 886662ebc6f4d2a99b671974cd6d3309d187893a.
Verification: Pending focused regression/build and W7-04 Windows H+P1+P2 acceptance rerun.
Artifact: Failure evidence artifact 9896259132 (`W7-04-WIN-8592f2e85e0ec7d3e1f105eff87afe1cd62410aa`), zip sha256:35f64794caceb039c27e9975ebe0bf9c1b92a86926da8856c08a31762450cc7b.
Closure: Pending repair verification. Do not mark W7-04 PASS until the Windows multi-instance recovery acceptance succeeds and the exact-SHA evidence is recorded.
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
- Do not create a second shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework to satisfy an existing gate.
- Prefer the smallest repair that restores the existing production path.
