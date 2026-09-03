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
Official ledger score: 65.0/100.0
PASS: 48/72
PENDING: 24/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-01
```

`W5-10` is PASS by canonical exact-SHA automated consolidation for MP-01 through MP-04. Verification SHA `786566303fbb6c8bac1dff6b392f65a866a1947c` passed `W5-10 AUTO Verification` run `33700245046`, job `100477769745`, with 45/45 focused tests. Artifact `9873251248` (`W5-10-AUTO-786566303fbb6c8bac1dff6b392f65a866a1947c`) has digest `sha256:189a99528d2cf6556a7c5430f3073145c91c537e1b3c354fc44e089234d3b927`. No `src/` or test implementation file changed for this Gate; the existing action, presentation, reconnect, turn, Ready/reaction/concentration, and Undo owners were reused. The official ledger records W5-10 PASS and W5 is complete at 10/10.

## W6-01 routing

`W6-01` is `REUSE_LOCKED`. The master roadmap requires the existing DM inventory/currency and owner-projection paths to prove:

- DM item grant and revoke with durable owner state and permitted Session projection refresh (`MP-E01`, `MP-E02`).
- DM GP grant and revoke with overdraft rejection and exact final balance (`MP-E03`).
- UI-facing owner inventory/GP parity after the authoritative change (`MP-J05`, `MP-J06`).

Reuse the existing Character persistence, connected owner projection, DM grant/revoke, inventory, and currency owners. Do not add a second Character write path or a parallel multiplayer inventory system. A product-code change is authorized only after a reproducible current-HEAD failure or explicit reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Start `W6-01`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for DM item grant/revoke, GP grant/revoke/overdraft, and owner projection refresh/parity.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
