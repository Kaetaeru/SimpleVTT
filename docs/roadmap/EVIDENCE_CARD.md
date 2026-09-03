# V1 Evidence Card

Status: **W6-06 CLOSED — MP-F07~F09 DISTRIBUTED LONG REST / RECOVERY AUTO PASS**

Use one card per Release Gate or coherent repair. The purpose is to stop duplicate implementation and force current-HEAD evidence before modifying an existing system.

```text
Gate ID: W6-06
Classification: REUSE_LOCKED
Acceptance criterion: Freeze the existing distributed Character + Campaign Long Rest path for MP-F07~F09 so Character recovery plus optional Campaign time/rations commit through the existing compound owners, rejected/preflight failure cannot partially advance either owner, and disconnect/restart recovery settles or aborts exactly once.
Production entrypoint: Existing Character Long Rest projection, Character+Campaign compound coordinator/writer, connected Long Rest preflight/transaction state, owner preparation/persistence, Campaign participant persistence, runtime/wire path, and Host restart recovery; no second rest coordinator, Character persistence path, Campaign clock/ration store, or recovery journal is authorized.
Existing automated tests: npm run test:campaign-rest (17 focused owner files; 93 tests covering Character/Campaign compound persistence, connected preflight/transaction state, owner preparation/persistence, Campaign persistence, wire/runtime/UI reachability, and Host restart recovery).
Exact observed failure: None on integration-derived verification head cf531f34a2c2cf85174fabafdc9092022fb0c46b. GitHub Actions pull-request checkout 96f9e6715e32b95d6644f67fb461204661ab107c and the verification head share tree b3607dd639fee00d42bc51f8ea88d5c6bf466cba; focused verification and production build passed.
Smallest authorized change: No product/runtime or test-implementation change. Add the focused workflow and record exact-tree evidence only.
Verification SHA: cf531f34a2c2cf85174fabafdc9092022fb0c46b (Actions checkout 96f9e6715e32b95d6644f67fb461204661ab107c; shared tree b3607dd639fee00d42bc51f8ea88d5c6bf466cba)
Verification: W6-06 AUTO Verification run 33712312082 / job 100514236959 = success; 93/93 focused tests PASS; production build PASS.
Artifact: 9877347283, W6-06-AUTO-96f9e6715e32b95d6644f67fb461204661ab107c, sha256:45d257223dcb90dfefc79ab33ed51bcd6fabff0737d9e7039833c7860b5f4eb0.
Closure: W6-06 PASS. Reconcile the official ledger to 72.5/100.0 (54 PASS / 18 PENDING), then open W6-07 under the same evidence-first rule. Real H + P1 + P2 Windows rendered acceptance remains later.
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
