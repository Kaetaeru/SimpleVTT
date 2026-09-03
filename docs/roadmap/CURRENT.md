# Current roadmap

Updated: 2026-09-03 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not duplicate that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

Evidence tracking:

- [`V1_EVIDENCE_LEDGER.json`](V1_EVIDENCE_LEDGER.json)
- [`EVIDENCE_CARD.md`](EVIDENCE_CARD.md)

Multiplayer acceptance source:

- [`../design/multiplayer-v1-scenario-catalog.md`](../design/multiplayer-v1-scenario-catalog.md)

## Fixed V1 numbers

```text
10 workstreams: W0-W9
72 release gates
100 weighted points
120 multiplayer scenarios: MP-A01-MP-J08
18 legacy V1 release gates
13 required MP work issues: MP-01-MP-13
```

Initial repository audit classification:

```text
47/72 REUSE_LOCKED
14/72 VERIFY_ONLY
11/72 BUILD
61/72 existing implementation reused = 84.7%
```

These numbers classify the work; they are not completion credit. Completion credit comes only from the evidence ledger.

## Current evidence state

```text
W0: COMPLETE — 6/6 PASS
W1: COMPLETE — 8/8 PASS
W2: COMPLETE — 8/8 PASS
W3: COMPLETE — 8/8 PASS
W4: COMPLETE — 8/8 PASS
W5: COMPLETE — 10/10 PASS
W6: 4/8 PASS
Official ledger score: 70.0/100.0
PASS: 52/72
PENDING: 20/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-05
```

`W6-04` is PASS without product/runtime or test-implementation changes. Canonical exact SHA `39bcd0356ca7b9a242684538253204ae17916eb1` passed `W6-04 AUTO Verification` run `33709116187`, job `100504620599`, with 17/17 focused tests and production build PASS. Artifact `9876316867` (`W6-04-AUTO-39bcd0356ca7b9a242684538253204ae17916eb1`) has digest `sha256:f200803affd1a791b49ea02d4aad3f5d6395d31636a8a18d6ab3a63c9f5512bd`. The focused durable-write, owner-journal, Host Party Stash recovery, and forced post-commit finalize-failure owners close the exact-HEAD automated persistence/recovery proof for `MP-E12~E13`. Real H+P1+P2 Windows rendered acceptance remains later. The official ledger now records W6-04 PASS.

## W6-05 routing

`W6-05` is `REUSE_LOCKED`. The master roadmap requires the existing capability-driven item-to-rations path to prove `MP-E14`: eligibility comes from capability data and item debit plus ration credit are atomic.

Reuse the existing inventory, item-capability, Campaign ration, transaction, persistence, recovery, and connected projection owners. Do not add a parallel item-conversion table, second inventory model, or replacement ration store. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-05`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for capability-based eligibility, atomic item debit/ration credit, failure/retry idempotency, and connected projection mapped to `MP-E14`.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01 through W6-04 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
