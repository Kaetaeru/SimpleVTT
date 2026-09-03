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
W7: IN PROGRESS — 1/8 PASS
Official ledger score: 76.3/100.0
PASS: 57/72
PENDING: 15/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W7-02
```

`W7-01` is PASS without product/runtime or test-implementation changes. Verification head `de59dd9898dd4cf4525082f0aa623e4a86cbd74d` and GitHub Actions pull-request checkout `c713e27a0989d8cd47761133e560afe4e93b77fc` have zero changed files between them. `W7-01 AUTO Verification` run `33718558967`, job `100532788018`, passed 12/12 focused tests and the production build. Artifact `9879408309` (`W7-01-AUTO-c713e27a0989d8cd47761133e560afe4e93b77fc`) has digest `sha256:600d6153242eb621ed6eabb32f86df1ee028d6102902b02ba88bebc410269cd3`. The focused owners prove no ghost participant state, exactly-once duplicate catch-up/event application, duplicate presentation suppression without reroll, and idempotent durable retry for `MP-H01~H03`.

## W7-02 routing

`W7-02` is `REUSE_LOCKED`. The master roadmap requires reconnect, late join, and presentation catch-up to recover without reroll for `MP-H04~H08`.

Reuse the existing participant lifecycle/rebind path, accepted Client replica cursor and ordered Host catch-up, connected resolution presentation terminal catch-up, and existing durable/reconnect continuity owners. Do not create a second reconnect system, participant lifecycle, catch-up journal, presentation pipeline, or recovery path. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W7-02`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owner set for reconnect, late join, ordered catch-up, and presentation recovery without reroll mapped to `MP-H04~H08`.
3. Run that focused set on one exact SHA and record command, pass count, artifact/digest when produced, and scenario mapping before changing the ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen W0-W6 or W7-01 absent a demonstrated regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
