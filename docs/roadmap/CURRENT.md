# Current roadmap

Updated: 2026-08-31 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not duplicate that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

Evidence tracking:

- [`V1_EVIDENCE_LEDGER.json`](V1_EVIDENCE_LEDGER.json)
- [`EVIDENCE_CARD.md`](EVIDENCE_CARD.md)

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
W1: 1/8 PASS
Official ledger score: 6.3/100.0
PASS: 7/72
PENDING: 65/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Wave 1
Next Gate: W1-02
```

`W1-02` is a `REUSE_LOCKED` Gate. Reconcile the existing Guided Create path for Species, Background, Class, Ability, proficiency, equipment, and applicable spell choices. **Do not reimplement Character creation without a reproduced current-HEAD failure.**

Common Play follows the active function-first direction in `../design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`: make the real behavior reachable and observable in Tauri before any broad shell/session visual redesign.

C9 Gate N is integrated into `work/v1-composite` and is no longer an active selection queue. Resolver execution checklists and older Phase/V0.9/V1 handoffs are architecture or historical evidence only.

## Execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before selecting work.
2. Start at the first non-`PASS` unblocked Gate; do not select work from an archived checklist.
3. Fill `EVIDENCE_CARD.md` before changing product code.
4. A `REUSE_LOCKED` or `VERIFY_ONLY` Gate cannot trigger product changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
5. Reuse the existing Tauri shell, stores, Resolver, transport, presentation pipeline, Party Stash, Long Rest, DM Library, and E2E harness.
6. Do not add branch-writing/self-publishing automation as the normal implementation loop.
7. Structural or protocol-only evidence cannot close rendered Windows behavior.
8. V1 closes only at `72/72`, `100.0/100.0`, `120/120`, all required legacy/MP issue closure, and one matching Windows artifact plus digest.
