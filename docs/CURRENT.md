# Current — SimpleVTT

Updated: 2026-08-31 Asia/Seoul

This is the human/agent entry point for **what is current now**. Live GitHub state plus this page and the active master roadmap win over older handoffs, checklists, PR bodies, archived files, and remembered status.

## Current objective

Finish SimpleVTT V1 by **reusing the existing Tauri product and proving complete user journeys on one exact SHA and one matching Windows artifact**.

This is no longer a broad mechanism-implementation phase. The work order is:

```text
reconcile existing implementation
→ migrate exact-SHA evidence
→ verify real Tauri journeys
→ repair only reproduced failures
→ expand H+P1+P2/P3 acceptance
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

The official completion score remains `0.0/100.0` until the new exact-SHA evidence ledger is created and existing proof is migrated. That score is evidence status, not an assertion that the product is unimplemented.

## Branch roles

- Product integration target: `work/v1-composite`
- Roadmap audit baseline: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`
- Current execution plan: `docs/roadmap/V1_MASTER_ROADMAP.md`
- Working branch policy: create one scoped `agent/*` branch from the latest live integration HEAD for each Gate or coherent repair; there is no permanent global active branch.
- `main`, C9 finalization branches, older V1 branches, and archived agent workspaces are historical/reference sources until deliberately promoted.

## Current stage

```text
Wave 0 — Source of truth and evidence control
Next exact Gate: W0-01
```

`W0-01` must reconcile the live integration HEAD, normal CI, and every write-capable workflow. A historical Phase 14 workflow can still commit and push to its old branch; it must not be allowed to mutate the current integration or active work branch.

After that:

1. create `docs/roadmap/V1_EVIDENCE_LEDGER.json`;
2. migrate evidence for the existing 61 `R/V` Gates;
3. update Epic `#110` from 112 to 120 scenarios and create the missing `MP-13` issue;
4. begin Tauri verification without reopening already implemented systems.

## Non-negotiable execution rules

1. Read the master roadmap and current repository state before editing.
2. Fill the roadmap's eight-field Evidence Card before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.

## Source of truth

- Branch and document routing: [`CANONICAL_ROOT.md`](../CANONICAL_ROOT.md)
- Active V1 plan: [`roadmap/V1_MASTER_ROADMAP.md`](roadmap/V1_MASTER_ROADMAP.md)
- Current roadmap pointer: [`roadmap/CURRENT.md`](roadmap/CURRENT.md)
- Multiplayer acceptance inventory: [`design/multiplayer-v1-scenario-catalog.md`](design/multiplayer-v1-scenario-catalog.md)
- Mechanism-family completion evidence: [`rules/v1-mechanism-coverage-ledger.json`](rules/v1-mechanism-coverage-ledger.json)

C9 Gate N is integrated and retained as evidence. It is not the current `NEXT` pointer.
