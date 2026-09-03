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
W5: 8/10 PASS
Official ledger score: 62.0/100.0
PASS: 46/72
PENDING: 26/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W5-09
```

`W5-08` is PASS by exact-SHA Initiative/reaction/concentration/Ready/correction fan-out AUTO evidence. Product verification SHA `faf5331ed72cd051213ab917e3c2f402fae03087` passed `W5-08 AUTO Verification` run `33697343776`, job `100468976213`, with 11/11 focused tests. Artifact `9872255696` (`W5-08-AUTO-faf5331ed72cd051213ab917e3c2f402fae03087`) has digest `sha256:59d2924fb515ef5763c608279d71b0d92e47cee5b6266114e70eb7e63bd8b2ce`. The official ledger records W5-08 PASS; the next exact Gate is `W5-09`.

## W5-09 routing

`W5-09` is `REUSE_LOCKED` and owns automated UI-facing Actor/action/inventory/Activity parity for `MP-J01` through `MP-J08`, linked to MP-13 / GitHub issue `#189`.

The canonical scenario catalog already identifies the focused owners:

- J01-J06: `tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts`
- J07: `tests/ui/connectedSceneTopologyProjection.test.ts`, `tests/ui/connectedSceneTopologyHostMutation.test.ts`, `tests/ui/productionHostRemoteFixtureIdentityProjection.test.ts`
- J08: `tests/ui/connectedThreePeerActionMatrix.test.ts`, `tests/ui/connectedThreePeerPresentation.test.ts`, `tests/ui/connectedTurnProjection.test.ts`, `tests/ui/connectedUndoCompensation.test.ts`

The automated parity fingerprint must cover public Scene fields, Session/turn/economy state, selected Character action definitions, owner inventory/GP/items, active resolution presentation, and public Activity changes. Protocol-only or persistence-only assertions are insufficient. Final rendered Windows parity remains required by the later V1 release acceptance; do not treat structural equality as a replacement for that final Windows evidence.

### Next execution sequence

1. Start `W5-09`, the first non-`PASS` Gate in the ledger.
2. Run/map the existing MP-J parity owners on one exact SHA before authorizing any product-code change.
3. If the focused suite passes, record exact commands, counts, scenario mapping, artifact/digest, and exact SHA; then reconcile the official ledger.
4. If a current-HEAD failure is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5-08 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
