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
W5: 9/10 PASS
Official ledger score: 63.5/100.0
PASS: 47/72
PENDING: 25/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W5-10
```

`W5-09` is PASS by canonical exact-SHA MP-J01~J08 automated UI-facing parity evidence. Verification SHA `4c93082d0af77ae79da82db711b7934c8e2f8544` passed `W5-09 AUTO Verification` run `33699407674`, job `100475234429`, with 18/18 focused tests. Artifact `9872956996` (`W5-09-AUTO-4c93082d0af77ae79da82db711b7934c8e2f8544`) has digest `sha256:5f7f708086b1c7b3e941d6d37bcac01cbded9f0fa6edea565dcbad171164463f`. The J07 current-HEAD failure was a stale test fixture and the repair was test-only; no product/runtime `src/` path changed. The official ledger records W5-09 PASS; the next exact Gate is `W5-10`.

## W5-10 routing

`W5-10` is `REUSE_LOCKED`. The master roadmap requires the existing production-adapter evidence for `MP-01` through `MP-04` to be consolidated into one exact-HEAD automated scenario map:

- `MP-01` / issue `#111`: Shared Resolution Presentation Envelope
- `MP-02` / issue `#114`: Client remote presentation queue / dice replay
- `MP-03` / issue `#112`: Three-peer authoritative action matrix
- `MP-04` / issue `#113`: Initiative / reaction / Ready / correction

The Gate reuses the existing connected action, presentation, turn/reconnect, and Undo owners already exercised across W5-04 through W5-09. It does not authorize a second multiplayer implementation path. Final rendered Windows H+P1+P2 parity remains required later and cannot be replaced by structural/protocol-only evidence.

### Next execution sequence

1. Start `W5-10`, the first non-`PASS` Gate in the ledger.
2. Map the existing tests and production adapters already cited by W5-04~W5-09 and issues #111/#114/#112/#113 into one W5-10 scenario/owner table.
3. Run that focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and mapping before changing the official ledger.
4. If a current-HEAD failure is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5-09 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
