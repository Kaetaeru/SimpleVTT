# Current — SimpleVTT

Updated: 2026-08-31 Asia/Seoul

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
W0: 6/6 PASS
Official ledger score: 5.0/100.0
Remaining gates: 66/72
FAIL: 0
BLOCKED: 0
```

The score is evidence status, not a percentage estimate of how much product code exists. Existing implementation receives completion credit only when its required exact-SHA/Tauri/Windows evidence is recorded in `roadmap/V1_EVIDENCE_LEDGER.json`.

## Branch roles

- Product integration target: `work/v1-composite`
- Roadmap audit baseline: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`
- Current execution plan: `docs/roadmap/V1_MASTER_ROADMAP.md`
- Evidence ledger: `docs/roadmap/V1_EVIDENCE_LEDGER.json`
- Evidence Card: `docs/roadmap/EVIDENCE_CARD.md`
- Working branch policy: create one scoped `agent/*` branch from the latest live integration HEAD for each Gate or coherent repair; there is no permanent global active branch.
- `main`, C9 finalization branches, older V1 branches, and archived agent workspaces are historical/reference sources until deliberately promoted.

## Current stage

```text
Wave 0 — COMPLETE
Next exact Gate: W1-01
```

W0 established the 72-gate ledger, mandatory Evidence Card, 120-scenario multiplayer Epic, MP-13, historical/archive routing, and removal of the obsolete Phase14 self-publishing workflow.

### Next execution sequence

1. Start `W1-01` by reconciling its existing production entrypoint and focused evidence; do not rebuild Character systems.
2. Migrate reusable evidence for W1/W2 and other `REUSE_LOCKED` gates when the current path is unchanged and provenance is explicit.
3. Run the required Tauri journeys for `VERIFY_ONLY` gates.
4. Convert a gate to repair work only after a reproducible current-HEAD failure or real production reachability/contract gap is demonstrated.
5. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.

## Source of truth

- Branch and document routing: [`CANONICAL_ROOT.md`](../CANONICAL_ROOT.md)
- Active V1 plan: [`roadmap/V1_MASTER_ROADMAP.md`](roadmap/V1_MASTER_ROADMAP.md)
- Evidence ledger: [`roadmap/V1_EVIDENCE_LEDGER.json`](roadmap/V1_EVIDENCE_LEDGER.json)
- Evidence Card: [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md)
- Current roadmap pointer: [`roadmap/CURRENT.md`](roadmap/CURRENT.md)
- Common Play function-first UI direction: [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md)
- Multiplayer acceptance inventory: [`design/multiplayer-v1-scenario-catalog.md`](design/multiplayer-v1-scenario-catalog.md)
- Mechanism-family completion evidence: [`rules/v1-mechanism-coverage-ledger.json`](rules/v1-mechanism-coverage-ledger.json)

C9 Gate N is integrated and retained as evidence. It is not a current `NEXT` pointer.
