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
W6: 3/8 PASS
Official ledger score: 68.8/100.0
PASS: 51/72
PENDING: 21/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W6-04
```

`W6-03` is PASS without product-code changes. Canonical exact SHA `b1f54abefd7dffb2f865ccaccde31649b8080a01` passed `W6-03 AUTO Verification` run `33705306657`, job `100493052616`, with 13/13 focused tests and production build PASS. Artifact `9875022681` (`W6-03-AUTO-b1f54abefd7dffb2f865ccaccde31649b8080a01`) has digest `sha256:8f5ef938566269b624ae4eeb33c95603eee501c514f6353945e9767899058deb`. The focused Campaign/Party Stash owners cover the shared, DM-approval, and DM-managed request lifecycle plus connected owner/failure-retry behavior required by `MP-E06~E11`. PR #297 integrated the evidence as canonical merge `888defd2be7f2f08c2f721abf57f72aaac5f8f12`. The official ledger now records W6-03 PASS.

## W6-04 routing

`W6-04` is `REUSE_LOCKED`. The master roadmap requires the existing Party Stash transfer path to prove atomic transfer behavior, authoritative journal/history, compensation, and restart recovery for `MP-E12~E13`.

Reuse the existing transfer, journal, compensation, persistence, and recovery owners. Do not add a second transaction system, a parallel Session-only ledger, or a replacement recovery path. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W6-04`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for transfer success/failure atomicity, journal/history, compensation/Undo behavior, and restart recovery mapped to `MP-E12~E13`.
3. Run the focused set on one exact SHA and record exact command, deterministic test count, artifact/digest, and scenario mapping before changing the official ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W1-W5 or W6-01/W6-03 evidence without a new current-HEAD regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
