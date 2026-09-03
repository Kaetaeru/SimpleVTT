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
W6: COMPLETE — 8/8 PASS
W7: IN PROGRESS — 3/8 PASS
Official ledger score: 78.8/100.0
PASS: 59/72
PENDING: 13/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W7-04
```

`W7-03` is PASS without product/runtime or existing test-implementation changes. Verification head `4986833eb20590ec486721ef6f45b86c2b3cb021` ran through GitHub Actions pull-request checkout `9ae9615e5cf1c0377193e90e1918a9d728dadc1f`. `W7-03 AUTO Verification` run `33740111205`, job `100599791508`, passed 29/29 focused tests and the production build; Legacy Execution Boundary run `33740111146` and Contract validation run `33740110937` also succeeded. Artifact `9887399132` (`W7-03-AUTO-9ae9615e5cf1c0377193e90e1918a9d728dadc1f`) has digest `sha256:a1edb9d24fd85deb525830ae142f562aae29722bdf58a4ef89e1281b08694ea2`. Existing Session-end cleanup, stop-session refresh, lifecycle, participant, turn, presentation, approval-owner, and Ready/Concentration owners cover `MP-A08~A09`: explicit end clears transient authority while preserving durable Character state, and a fresh Host Session does not resurrect prior Session identity or transient runtime state.

## W7-04 routing

`W7-04` is `REUSE_LOCKED`. The master roadmap fixes owner writeback, Host Campaign write, and partial persistence recovery for `MP-B08` and `MP-H09~H12`.

Reuse the existing owner-writeback durability, Host Campaign persistence, idempotent durable retry/recovery, and partial-failure recovery owners. Do not create a second owner store, Campaign write path, persistence journal, retry coordinator, or recovery subsystem. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W7-04`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owner set for owner writeback, Host Campaign write, and partial persistence recovery mapped to `MP-B08` and `MP-H09~H12`.
3. Run that focused set on one exact SHA and record command, pass count, artifact/digest when produced, and scenario mapping before changing the ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen W0-W6 or W7-01~W7-03 absent a demonstrated regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
