# Current — SimpleVTT

Updated: 2026-09-03 Asia/Seoul

This is the human/agent entry point for **what is current now**. Live GitHub state plus this page and the active master roadmap win over older handoffs, checklists, PR bodies, archived files, and remembered status.

## Current objective

Finish SimpleVTT V1 by **reusing the existing Tauri product and proving complete user journeys on one exact SHA and one matching Windows artifact**.

The work order is:

```text
reconcile existing implementation
→ migrate exact-SHA evidence
→ verify real Tauri journeys
→ repair only reproduced failures
→ make Common Play behavior reachable before broad visual redesign
→ expand H+P1+P2/P3 acceptance
→ final UI/UX rebase from the working product
→ close the Windows release
```

## Numeric V1 baseline

```text
10 workstreams: W0-W9
72 release gates
100 weighted points
120 multiplayer scenarios: MP-A01-MP-J08
18 legacy V1 release gates
13 required MP work issues: MP-01-MP-13
```

Initial audit classification:

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
W7: 2/8 PASS — IN PROGRESS
Official ledger score: 77.5/100.0
PASS: 58/72
Remaining gates: 14/72
FAIL: 0
BLOCKED: 0
```

The score is evidence status, not a percentage estimate of how much product code exists. Existing implementation receives completion credit only when its required exact-SHA/Tauri/Windows evidence is recorded in `roadmap/V1_EVIDENCE_LEDGER.json`.

## Current stage

```text
W0 — COMPLETE
W1 — COMPLETE (8/8 PASS)
W2 — COMPLETE (8/8 PASS)
W3 — COMPLETE (8/8 PASS)
W4 — COMPLETE (8/8 PASS)
W5 — COMPLETE (10/10 PASS)
W6 — COMPLETE (8/8 PASS)
W7 — IN PROGRESS (2/8 PASS)
Next exact Gate: W7-03
```

`W7-02` is closed without product/runtime or existing test-implementation changes. Verification head `507459f208457e540beb19295dabb43e81f63b93` and GitHub Actions pull-request checkout `f1ca8d203177bb43077259dfa957fb4b5c3109ce` have zero changed files between them. `W7-02 AUTO Verification` run `33720461403`, job `100538359322`, passed 34/34 focused tests and the production build; Legacy Execution Boundary run `33720461389` and Contract validation run `33720461383` also succeeded. Artifact `9880065564` (`W7-02-AUTO-f1ca8d203177bb43077259dfa957fb4b5c3109ce`) has digest `sha256:a6e7e64721600ce77c746ae1d6a7e6a3724222a4926ff633caaeca180342bc13`. Existing reconnect, late-join, ordered catch-up, presentation replay, durable recovery, and Ready/Reaction/Concentration lifecycle owners prove the focused `MP-H04~H08` recovery set without adding a parallel recovery system.

## W7-03 exact scope

`W7-03` is `REUSE_LOCKED`. It requires Host restart and Session end to keep transient Session state dead rather than resurrecting it, mapped by the master roadmap to `MP-A08~A09` and the relevant `MP-H` recovery cases.

Reuse the existing Session-end cleanup, Host restart/rehydration, durable-owner recovery, and transient runtime/presentation/prompt lifecycle owners. Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Do not introduce a second Session lifecycle, restart journal, transient-state store, or cleanup path.

## Branch roles

- Product integration target: `work/v1-composite`
- Roadmap audit baseline: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`
- Current execution plan: `docs/roadmap/V1_MASTER_ROADMAP.md`
- Evidence ledger: `docs/roadmap/V1_EVIDENCE_LEDGER.json`
- Evidence Card: `docs/roadmap/EVIDENCE_CARD.md`
- Multiplayer catalog: `docs/design/multiplayer-v1-scenario-catalog.md`
- Multiplayer Epic: GitHub issue `#110`
- Working branch policy: create one scoped `agent/*` branch from the latest live integration HEAD for each Gate or coherent repair; there is no permanent global active branch.
- `main`, C9 finalization branches, older V1 branches, and archived agent workspaces are historical/reference sources until deliberately promoted.

### Next execution sequence

1. Execute `W7-03`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owner set proving Host restart and Session-end transient-state cleanup for `MP-A08~A09` and linked `MP-H` recovery cases.
3. Run that set on one exact SHA and record the focused command, pass count, artifact/digest when produced, and scenario mapping before changing the ledger.
4. If it fails or a production reachability/contract gap is reproduced, fill `roadmap/EVIDENCE_CARD.md` and repair only the smallest existing owner path.
5. Do not reopen completed W0-W6 or W7-01~W7-02 work without a demonstrated regression.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, request/event ledger, retry coordinator, reconnect system, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
