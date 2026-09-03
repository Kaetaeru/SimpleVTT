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
W6: 6/8 PASS
Official ledger score: 72.5/100.0
PASS: 54/72
PENDING: 18/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-07
```

`W6-06` is PASS without product/runtime or test-implementation changes. Integration-derived verification head `cf531f34a2c2cf85174fabafdc9092022fb0c46b` and GitHub Actions checkout `96f9e6715e32b95d6644f67fb461204661ab107c` share tree `b3607dd639fee00d42bc51f8ea88d5c6bf466cba`. `W6-06 AUTO Verification` run `33712312082`, job `100514236959`, passed 93/93 focused tests and the production build. Artifact `9877347283` (`W6-06-AUTO-96f9e6715e32b95d6644f67fb461204661ab107c`) has digest `sha256:45d257223dcb90dfefc79ab33ed51bcd6fabff0737d9e7039833c7860b5f4eb0`. The existing compound Long Rest, Character owner preparation/persistence, Campaign participant persistence, connected transaction, and Host restart recovery owners close the automation-only proof for `MP-F07~F09`. Real H+P1+P2 Windows rendered acceptance remains later. The official ledger now records W6-06 PASS.

## W6-07 routing

`W6-07` is `REUSE_LOCKED`. The master roadmap requires the existing connected DM Library materialization, handout, and spatial capability paths to be fixed as the automated owner set for `MP-G`.

Reuse the existing DM Library definitions/materialization path, connected image handout projection, Scene topology/spatial capability owners, Host authority, and reconnect/privacy paths. Do not add a second DM Library, handout system, Scene model, spatial transport, or presentation pipeline. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-07`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for connected DM Library materialization, handout lifecycle, Scene/spatial capabilities, reconnect continuity, and privacy mapped to `MP-G01~G09`.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01 through W6-06 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
