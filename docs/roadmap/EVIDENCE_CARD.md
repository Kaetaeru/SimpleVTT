# V1 Evidence Card

Status: **W6-04 CLOSED — MP-E12 AND MP-E13 PERSISTENCE / RECOVERY AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-04
Classification: REUSE_LOCKED
Acceptance criterion: Consolidate the existing inventory-core undetected persistence-failure exchange and Host-fallback recovery proof for exactly MP-E12 and MP-E13 into one exact-HEAD automated evidence map.
Production entrypoint: Existing connected inventory durable-write/journal/compensation path plus Host-owned Party Stash recovery coordinator and Tauri persistence seam; no second inventory model, transaction owner, or fallback store is authorized.
Existing automated tests: tests/ui/connectedDurableFailure.test.ts; tests/ui/connectedOwnerInventoryRestart.test.ts; tests/ui/connectedPartyStashHostRecovery.test.ts; tests/ui/connectedPartyStashHostRecoveryStructure.test.ts; tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts.
Exact observed failure: None on canonical exact SHA 39bcd0356ca7b9a242684538253204ae17916eb1. Canonical push verification passed the focused persistence/recovery suite and production build.
Smallest authorized change: No product/runtime or test-implementation change. Add the focused workflow and record exact-SHA evidence only.
Verification SHA: 39bcd0356ca7b9a242684538253204ae17916eb1
Verification: W6-04 AUTO Verification run 33709116187 / job 100504620599 = success; 17/17 focused tests PASS; production build PASS.
Artifact: 9876316867, W6-04-AUTO-39bcd0356ca7b9a242684538253204ae17916eb1, sha256:f200803affd1a791b49ea02d4aad3f5d6395d31636a8a18d6ab3a63c9f5512bd.
Closure: W6-04 PASS. Reconcile the official ledger to 70.0/100.0 (52 PASS / 20 PENDING), then open W6-05 under the same evidence-first rule. Real H + P1 + P2 Windows rendered acceptance remains later.
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
