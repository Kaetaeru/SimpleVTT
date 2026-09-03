# V1 Evidence Card

Status: **W6-03 CLOSED — PARTY STASH POLICY LIFECYCLE VERIFIED**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-03
Classification: REUSE_LOCKED
Acceptance criterion: Stash shared/approval/DM-managed request lifecycle remains on the existing Campaign/Party Stash production owner for MP-E06~E11, including connected owner projection and failure/retry behavior.
Production entrypoint: Existing Campaign Party Stash policy/runtime adapters and connected approval/Host policy path; no replacement store, transaction owner, transport, or protocol-only replica is authorized.
Existing automated tests: tests/ui/campaignSystems.test.ts and tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts.
Exact observed failure: None on canonical exact SHA b1f54abefd7dffb2f865ccaccde31649b8080a01. Canonical push verification passed the focused Party Stash/Campaign suite and production build.
Smallest authorized change: No product-code change. Record exact-SHA evidence only.
Verification SHA: b1f54abefd7dffb2f865ccaccde31649b8080a01
Verification: W6-03 AUTO Verification run 33705306657 / job 100493052616 = success; 13/13 focused tests PASS; production build PASS.
Artifact: 9875022681, W6-03-AUTO-b1f54abefd7dffb2f865ccaccde31649b8080a01, sha256:8f5ef938566269b624ae4eeb33c95603eee501c514f6353945e9767899058deb.
Closure: W6-03 PASS. Reconcile the official ledger, then open W6-04 under the same evidence-first rule.
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
