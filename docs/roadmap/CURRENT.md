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
W6: 2/8 PASS
Official ledger score: 67.5/100.0
PASS: 50/72
PENDING: 22/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-03
```

`W6-02` is PASS after the canonical Evidence Card reproduced a production reachability gap: the Campaign advancement owner already supported exact XP, multi-Character XP, immediate level-up credit, credit consumption, and durable roster level state, but Host/live Session UI could not invoke it. PR #294 added only the smallest reachability repair by mounting a Host/live advancement panel that reuses `grantCampaignAdvancement`; it did not add a second progression store, engine, transport, or Character write path. Verification SHA `a72387016fec255674b8132b1f8b80b08d99da25` passed `W6-02 AUTO Verification` run `33703181522`, job `100486658419`, with 13/13 focused tests and production build PASS. Artifact `9874278799` (`W6-02-AUTO-9a07c28309ffe781d4ed1e4cea33f7e8f0706577`) has digest `sha256:abc109aca9d519e96aec8e03d442a2e071151c659e658a27b99207607f93fc0c`; its name uses the pull-request synthetic merge SHA, while the run `head_sha` is the authoritative product verification SHA above. PR #294 integrated the tested repair as canonical merge `b11f5267121c2c4dfb11176ef6ff12841f3c877b`. The official ledger records W6-02 PASS.

## W6-03 routing

`W6-03` is `REUSE_LOCKED`. The master roadmap requires the existing Party Stash request-policy lifecycle to prove `MP-E06~E11` across shared, approval, and DM-managed modes.

Reuse the existing Party Stash policy, request, approval/rejection, connected authority, and persistence owners already established by W4-05 and later connected work. Do not add a second transaction system or parallel Session-only stash state. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-03`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for shared withdrawal, approval request/approve/reject, DM-managed rejection, Host-authoritative connected projection, and request durability/reconnect behavior mapped to `MP-E06~E11`.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01/W6-02 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
