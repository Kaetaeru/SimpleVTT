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
W6: 5/8 PASS
Official ledger score: 71.3/100.0
PASS: 53/72
PENDING: 19/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-06
```

`W6-05` is PASS without product/runtime or test-implementation changes. Integration-derived exact verification SHA `945188901c106b6114e3a7f89cb1671aab6ace27` (base canonical SHA `52b6fc06b114768903887de3669f6499172afb72`) passed `W6-05 AUTO Verification` run `33711448138`, job `100511627712`, with 9/9 focused tests and production build PASS. Artifact `5808814072` (`W6-05-AUTO-945188901c106b6114e3a7f89cb1671aab6ace27`) has digest `sha256:26ce88561019490d1c8734cb838ebf6dd789c180e9e4af57974a2559439351dc`. The focused Campaign ration-conversion owners prove trusted capability eligibility, configured ration units, atomic Party Stash debit + ration credit, stale-provider failure isolation, duplicate-request idempotency, legacy metadata revalidation, and production Campaign reachability for `MP-E14`. Real H+P1+P2 Windows rendered acceptance remains later. The official ledger now records W6-05 PASS.

## W6-06 routing

`W6-06` is `REUSE_LOCKED`. The master roadmap requires the existing distributed Character + Campaign Long Rest path to prove `MP-F07~F09`, including durable owner/Host recovery.

Reuse the existing Long Rest compound coordinator, Character owner persistence, Campaign time/ration persistence, connected transaction/recovery, and restart owners. Do not add a second rest coordinator, second Character persistence path, replacement Campaign clock/ration store, or parallel recovery journal. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-06`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for distributed Character + Campaign Long Rest, owner/Host persistence, recovery/retry idempotency, and restart continuity mapped to `MP-F07~F09`.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01 through W6-05 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
