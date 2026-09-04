# Current — SimpleVTT

Updated: 2026-09-04 Asia/Seoul

This is the human/agent entry point for **what is current now**. Live GitHub state plus this page and the active master roadmap win over older handoffs, checklists, PR bodies, archived files, and remembered status.

## Current objective

Finish SimpleVTT V1 by **reusing the existing Tauri product and proving complete user journeys on one exact SHA and one matching Windows artifact**.

The canonical execution plan is `docs/roadmap/V1_MASTER_ROADMAP.md`; the authoritative score is `docs/roadmap/V1_EVIDENCE_LEDGER.json`.

## Numeric V1 baseline

```text
10 workstreams: W0-W9
72 release gates
100 weighted points
120 multiplayer scenarios: MP-A01-MP-J08
18 legacy V1 release gates
13 required MP work issues: MP-01-MP-13
```

Initial audit classification remains:

```text
47/72 REUSE_LOCKED
14/72 VERIFY_ONLY
11/72 BUILD
61/72 existing implementation reused = 84.7%
```

## Official evidence state

```text
W0: 6/6 PASS — COMPLETE
W1: 8/8 PASS — COMPLETE
W2: 8/8 PASS — COMPLETE
W3: 8/8 PASS — COMPLETE
W4: 8/8 PASS — COMPLETE
W5: 10/10 PASS — COMPLETE
W6: 8/8 PASS — COMPLETE
W7: 6/8 PASS — IN PROGRESS
Official ledger score: 82.5/100.0
PASS: 62/72
Remaining gates: 10/72
FAIL: 0
BLOCKED: 0
```

The score is evidence status, not an implementation estimate. Existing code receives completion credit only when the required exact-SHA/Tauri/Windows evidence is recorded in `roadmap/V1_EVIDENCE_LEDGER.json`.

## Current stage

```text
W0 — COMPLETE
W1 — COMPLETE (8/8 PASS)
W2 — COMPLETE (8/8 PASS)
W3 — COMPLETE (8/8 PASS)
W4 — COMPLETE (8/8 PASS)
W5 — COMPLETE (10/10 PASS)
W6 — COMPLETE (8/8 PASS)
W7 — IN PROGRESS (6/8 PASS; W7-05 repair on PR #321 awaiting Windows H+P1+P2 evidence)
Next exact Gate: W7-05 closure, then W7-08
```

`W7-06` and `W7-07` are closed on integration SHA `196266567ad61506f80d359d60224c6f8be6f186` (merge of PR #323): W7-06 capability-mismatch owners 49/49 (run `33873613714`), W7-07 accessibility/motion/diagnostics owners 38/38 plus Rust transport intake 2/2 (run `33873613866`). `W7-04` remains closed on `7d0bded27a624ed0d993d860cbd590262ed1f3a6`. `W7-05` product repair (hidden roll / selective disclosure) is on PR #321 with AUTO 5/5; its Windows H+P1+P2 observation is the remaining closure item.

## W7-05 exact scope

`W7-05` is `REUSE_LOCKED`. It requires that DM-only, hidden, and private payloads, Activities, and handout metadata never leak to unauthorized peers. The canonical mapping is `MP-B05~B07` and `MP-09`.

Reuse the existing connected privacy/redaction, Activity visibility, projection, and handout metadata paths. Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Do not introduce a second privacy policy, projection layer, Activity log, handout system, transport, or Session authority path.

## Branch roles

- Product integration target: `work/v1-composite`
- Roadmap audit baseline: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`
- Current execution plan: `docs/roadmap/V1_MASTER_ROADMAP.md`
- Evidence ledger: `docs/roadmap/V1_EVIDENCE_LEDGER.json`
- Evidence Card: `docs/roadmap/EVIDENCE_CARD.md`
- Multiplayer catalog: `docs/design/multiplayer-v1-scenario-catalog.md`
- Multiplayer Epic: GitHub issue `#110`
- Working branch policy: create one scoped `agent/*` branch from the latest live integration HEAD for each Gate or coherent repair; there is no permanent global active branch.

### Next execution sequence

1. Execute `W7-05`, now the first non-`PASS` Gate in the ledger.
2. Select the smallest existing automated privacy/redaction/handout owner set that maps to `MP-B05~B07` and `MP-09`.
3. Run the focused set on one exact integration-derived SHA and record deterministic pass count and scenario mapping.
4. If it passes, record W7-05 evidence and close the Gate without product/runtime changes.
5. If it fails, record the exact current-HEAD failure in `roadmap/EVIDENCE_CARD.md` before the smallest repair.
6. Do not reopen completed W0-W6 or W7-01~W7-04 work without a demonstrated regression.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, privacy/projection system, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior when Windows observation is required.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
