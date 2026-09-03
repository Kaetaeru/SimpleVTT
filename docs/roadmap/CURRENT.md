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
Official ledger score: 75.0/100.0
PASS: 56/72
PENDING: 16/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W7-01
```

`W6-08` is PASS without product/runtime changes. Verification head `36a9848a025f078f60b956e05f3432cbf5b14da4` and GitHub Actions pull-request checkout `db4d81f521cf15774dcff13d3249186f0c19dde1` have zero changed files between them. `W6-08 Tauri Verification` run `33716559390`, job `100526862083`, passed the real Windows Tauri H+P1 Journey J5 flow and the production build. Artifact `9878842089` (`SimpleVTT-W6-08-Tauri-36a9848a025f078f60b956e05f3432cbf5b14da4`) has digest `sha256:b44dfe4f486409522630c632819665cee4eccdab72077857838876a33ac747b9`. The journey proves representative DM GP grant/revoke, Party Stash convergence, connected image-handout reveal/withdraw, and distributed Character+Campaign Long Rest with an enabled Campaign calendar. Final P2 observer parity is not claimed and remains `W9-02`. The official ledger records W6-08 PASS and W6 is complete.

## W7-01 routing

`W7-01` is `REUSE_LOCKED`. The master roadmap requires duplicate request, duplicate event batch, and retry handling to remain exactly-once for `MP-H01~H03`.

Reuse the existing Host request/event ledger, idempotency keys, ordered replica/catch-up, durable transaction/recovery, and retry owners. Do not create a second request ledger, event journal, retry coordinator, or parallel recovery path. A product-code change is authorized only after a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded in `EVIDENCE_CARD.md`.

### Next execution sequence

1. Execute `W7-01`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owner set for duplicate request, duplicate event batch, and retry exactly-once behavior mapped to `MP-H01~H03`.
3. Run that focused set on one exact SHA and record command, pass count, artifact/digest when produced, and scenario mapping before changing the ledger.
4. If a current-HEAD failure or reachability gap is reproduced, fill `EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen W0-W6 absent a demonstrated regression.

## Non-negotiable routing rules

- Product integration target remains `work/v1-composite`.
- Create one scoped `agent/*` branch from the latest live integration HEAD per Gate or coherent repair.
- `REUSE_LOCKED` and `VERIFY_ONLY` gates cannot trigger product-code changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
- Structural/protocol-only evidence cannot close rendered Windows behavior.
- Do not create a second shell, persistence backend, Resolver, transport, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
- V1 is complete only at 72/72 PASS, 100.0/100.0, 120/120 scenarios, 18/18 legacy gates, 13/13 MP issues, and one matching Windows release artifact plus digest.
