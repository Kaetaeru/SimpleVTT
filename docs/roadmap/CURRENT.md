# Current roadmap

Updated: 2026-08-31 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not duplicate that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

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

These numbers classify the work; they are not completion credit. Completion credit comes only from `docs/roadmap/V1_EVIDENCE_LEDGER.json` after exact-SHA evidence is recorded.

## Current stage

```text
Wave 0
Next Gate: W0-01
Official ledger score: 0.0/100.0 until evidence migration
Roadmap audit baseline: a38b0f07ac012bc9e600a28b2630a365d1bd098b
```

C9 Gate N is integrated into `work/v1-composite` and is no longer an active selection queue. The Resolver execution checklist and older Phase/V0.9/V1 checklists remain architecture and historical evidence only.

## Execution rules

1. Read the master roadmap and live `work/v1-composite` HEAD before selecting work.
2. Start at the first non-`PASS` unblocked Gate; do not select work from an archived checklist.
3. Fill the eight-field Evidence Card before changing product code.
4. A `REUSE_LOCKED` or `VERIFY_ONLY` Gate cannot trigger product changes without a reproducible failure on the current exact HEAD.
5. Reuse the existing Tauri shell, stores, Resolver, transport, presentation pipeline, Party Stash, Long Rest, DM Library, and E2E harness.
6. Do not add branch-writing automation as the normal implementation loop.
7. V1 closes only at `72/72`, `100.0/100.0`, `120/120`, and one matching Windows artifact.
