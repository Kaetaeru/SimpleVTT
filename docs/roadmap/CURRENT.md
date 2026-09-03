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
W6: 7/8 PASS
Official ledger score: 73.8/100.0
PASS: 55/72
PENDING: 17/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-08
```

`W6-07` is PASS without product/runtime or test-implementation changes. Verification head `63f6943b6c015ed24dfd405087d3d18b3d6415cd` and GitHub Actions checkout `888fe416e7653d49e93c71a6165304e3fd05a9ff` share tree `e7009e28b279b7d1a63f291bbffde5c0a33f7746`. `W6-07 AUTO Verification` run `33713348784`, job `100517304162`, passed 9/9 focused tests and the production build. Artifact `9877676750` (`W6-07-AUTO-888fe416e7653d49e93c71a6165304e3fd05a9ff`) has digest `sha256:1c9bffe62e50a4bf24f0ed94b9fe16327f3ec7053043f60d89edc9030a3cd094`. The existing DM Library import/materialization/provenance, image handout reveal/withdraw/privacy/reconnect, connected Scene topology/Host mutation, and remote fixture projection owners close the required current exact-SHA automated owner proof for `MP-G01~G09`. Historical W4-07 rendered Windows H+P1+P2 evidence remains the rendered acceptance source. The official ledger now records W6-07 PASS.

## W6-08 routing

`W6-08` is `VERIFY_ONLY`. The master roadmap requires the existing Tauri H+P1 path to verify representative DM live-operation flows across grants/revokes, Party Stash, distributed Long Rest, and handouts for Journey J5 / `MP-E~G`. P2 observer-parity final acceptance belongs only to `W9-02`.

Reuse the existing Windows Tauri H+P1 harness and production DM operation paths. Do not create a second E2E framework, alternate Session shell, replacement transaction path, or duplicate handout flow. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-08`, the first non-`PASS` Gate in the ledger.
2. Reuse the smallest existing Windows Tauri H+P1 journey that covers representative grant/revoke, Stash, Long Rest, and handout behavior across Journey J5 / `MP-E~G`.
3. Run it from one exact SHA and record the Windows artifact/digest plus rendered acceptance evidence before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing production path.
5. Do not pull P2 observer-parity final acceptance forward from `W9-02`.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
