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
W5: 9/10 PASS
Official ledger score: 63.5/100.0
PASS: 47/72
Remaining gates: 25/72
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
W5 — 9/10 PASS
Next exact Gate: W5-10
```

`W5-09` is closed by canonical exact-SHA MP-J01~J08 automated UI-facing parity evidence. Verification SHA `4c93082d0af77ae79da82db711b7934c8e2f8544` passed `W5-09 AUTO Verification` run `33699407674`, job `100475234429`, with 18/18 focused tests. Artifact `9872956996` (`W5-09-AUTO-4c93082d0af77ae79da82db711b7934c8e2f8544`) has digest `sha256:5f7f708086b1c7b3e941d6d37bcac01cbded9f0fa6edea565dcbad171164463f`. The reproduced J07 failure was a stale test fixture and was repaired test-only; no product/runtime `src/` path changed. The official ledger now records W5-09 PASS; the first non-PASS Gate is `W5-10`.

## W5-10 exact scope

`W5-10` is `REUSE_LOCKED`. It closes the existing production-adapter three-peer action, presentation, turn, and Undo automated evidence for the first four multiplayer work items into **one exact-HEAD scenario map**:

- `MP-01` — issue `#111`, Shared Resolution Presentation Envelope
- `MP-02` — issue `#114`, Client remote presentation queue / dice replay
- `MP-03` — issue `#112`, Three-peer authoritative action matrix
- `MP-04` — issue `#113`, Initiative / reaction / Ready / correction

This Gate is an evidence-consolidation Gate. Reuse the production adapter and automated coverage already proven across W5-04 through W5-09; do not create a second transport, resolver, presentation queue, dice/VFX path, turn engine, or Undo path. Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`.

The next useful action is to map the repository-owned automated owners for issues #111/#114/#112/#113 into one W5-10 focused command/scenario table, run that set on an exact SHA, and record the resulting count/artifact/digest. Rendered Windows three-window parity remains a later final acceptance concern and is not replaced by W5-10 AUTO evidence.

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

1. Execute `W5-10`, the first non-`PASS` Gate in the ledger, by consolidating existing MP-01~MP-04 production-adapter automation into one exact-HEAD scenario map.
2. Reuse the owners already proven by W5-04~W5-09 and issues #111/#114/#112/#113. Do not reopen W1-W5-09 unless a new current-HEAD regression is reproduced.
3. Run the focused W5-10 command on one exact SHA and record deterministic pass/fail count plus artifact/digest before changing the official ledger.
4. If it fails, fill `roadmap/EVIDENCE_CARD.md` and repair only the smallest reproduced owner-path defect.
5. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
