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
W6: 1/8 PASS
Official ledger score: 66.3/100.0
PASS: 49/72
PENDING: 23/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-02
```

`W6-01` is PASS by canonical exact-SHA automated evidence for DM item/GP grant-revoke and Character-owner projection refresh. Verification SHA `30606e6b056027a3e10ddbae70f38f428b2714b6` passed `W6-01 AUTO Verification` run `33701452879`, job `100481432959`, with 13/13 focused tests. Artifact `9873659413` (`W6-01-AUTO-30606e6b056027a3e10ddbae70f38f428b2714b6`) has digest `sha256:bb6031112dd14fedf00aa90485e7583332cdaefd1befe4f223d710e4939e2204`. No product/runtime or test implementation file changed for this Gate; the existing DM inventory/currency, DM Library materialization, connected owner wire, inventory projection refresh, and custom-item projection owners were reused. The official ledger records W6-01 PASS.

## W6-02 routing

`W6-02` is `REUSE_LOCKED`. The master roadmap requires the existing XP and level-up ownership paths to prove:

- DM grants exact XP to one or multiple Characters; the Character-owned value is durable and visible, and the grant does not require a reason (`MP-E04`).
- DM grants immediate level-up credit; an eligible owner can complete the canonical Character level-up flow during Session and persist the resulting Character state (`MP-E05`).

Reuse the existing Character persistence, XP/progression, DM grant, connected owner projection, and level-up owners. Do not add a second Character write path or a Session-only progression store. A product-code change is authorized only after a reproducible current-HEAD failure or explicit reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-02`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for exact XP grant, multi-Character XP grant, immediate level-up credit, canonical owner level-up, and durable projection/persistence.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and `MP-E04~E05` mapping before changing the official ledger.
4. If a current-HEAD failure is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
