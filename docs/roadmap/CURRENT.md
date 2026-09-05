# Current roadmap

Updated: 2026-09-04 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not replace that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

Evidence tracking:

- [`V1_EVIDENCE_LEDGER.json`](V1_EVIDENCE_LEDGER.json)
- [`EVIDENCE_CARD.md`](EVIDENCE_CARD.md)
- [`evidence/W7-04.md`](evidence/W7-04.md)

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

Initial repository audit classification remains:

```text
47/72 REUSE_LOCKED
14/72 VERIFY_ONLY
11/72 BUILD
61/72 existing implementation reused = 84.7%
```

## Current evidence state

```text
W0: COMPLETE — 6/6 PASS
W1: COMPLETE — 8/8 PASS
W2: COMPLETE — 8/8 PASS
W3: COMPLETE — 8/8 PASS
W4: COMPLETE — 8/8 PASS
W5: COMPLETE — 10/10 PASS
W6: COMPLETE — 8/8 PASS
W7: COMPLETE — 8/8 PASS
Official ledger score: 97.5/100.0
PASS: 71/72
PENDING: 1/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W9-04 final single-SHA closure
```

`W7-04` is PASS. Product verification SHA `7d0bded27a624ed0d993d860cbd590262ed1f3a6` passed GitHub Actions run `33853804394`: AUTO recovery, real Windows Tauri H+P1+P2 recovery, and Windows storage/package prerequisite jobs all succeeded. The real Windows evidence covers `MP-B08` and `MP-H09~H12`, including explicit offline-owner rejection, reconnect/retry recovery, injected persistence-failure handling, and slow-P2 observer convergence. Authoritative artifacts and digests are recorded in `evidence/W7-04.md` and `V1_EVIDENCE_LEDGER.json`.

## W7-05 routing

`W7-05` is `REUSE_LOCKED`. The master roadmap requires that DM-only, hidden, and private payloads, Activities, and handout metadata do not leak across the connected Session boundary. It maps to `MP-B05~B07` and `MP-09`.

Reuse the existing privacy projection, redaction, Activity visibility, and handout projection owners. Do not create a second privacy model, projection layer, Activity log, or handout system. No product-code change is authorized until a reproducible current-HEAD privacy failure or an explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W7-05`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owner set covering DM-only/hidden/private payloads, Activities, and handout metadata for `MP-B05~B07` and `MP-09`.
3. Run that focused set on one exact integration-derived SHA and record command, deterministic pass count, and scenario mapping.
4. If the exact-head focused verification passes, add a scoped W7-05 evidence record and close the Gate without product/runtime changes.
5. If a current-HEAD failure or reachability gap is reproduced, record it in `EVIDENCE_CARD.md` before repairing only the smallest existing owner path.
6. Do not reopen W0-W6 or W7-01~W7-04 absent a demonstrated regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior where Windows observation is required.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, privacy/projection system, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
