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
W6: 7/8 PASS
Official ledger score: 73.8/100.0
PASS: 55/72
Remaining gates: 17/72
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
W6 — 7/8 PASS
Next exact Gate: W6-08
```

`W6-07` is closed without product/runtime or test-implementation changes. Verification head `63f6943b6c015ed24dfd405087d3d18b3d6415cd` and GitHub Actions pull-request checkout `888fe416e7653d49e93c71a6165304e3fd05a9ff` share tree `e7009e28b279b7d1a63f291bbffde5c0a33f7746`. `W6-07 AUTO Verification` run `33713348784`, job `100517304162`, passed 9/9 focused tests and the production build. Artifact `9877676750` (`W6-07-AUTO-888fe416e7653d49e93c71a6165304e3fd05a9ff`) has digest `sha256:1c9bffe62e50a4bf24f0ed94b9fe16327f3ec7053043f60d89edc9030a3cd094`. The existing DM Library import/materialization/provenance, image-handout reveal/withdraw/privacy/reconnect, connected Scene topology/Host mutation, and remote fixture projection owners close the required current exact-SHA automated owner proof for `MP-G01~G09`. Historical W4-07 actual Windows H+P1+P2 evidence remains the rendered acceptance source. The official ledger records W6-07 PASS and the first non-PASS Gate is `W6-08`.

## W6-08 exact scope

`W6-08` is `VERIFY_ONLY`. It verifies the existing **Windows Tauri H+P1 representative DM live-operation journey** for Journey J5 / `MP-E~G`:

- representative DM grants/revokes must use the existing durable Character/Campaign owners;
- Party Stash behavior must use the existing policy/transaction/recovery path;
- distributed Long Rest must use the existing Character+Campaign coordinator and durable recovery path;
- image handout behavior must use the existing connected handout projection path;
- final P2 observer-parity acceptance is not part of this Gate and remains reserved for `W9-02`.

Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Reuse the existing Windows Tauri H+P1 harness and production paths; do not create a second E2E framework or replacement transaction/session systems.

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

1. Execute `W6-08`, the first non-`PASS` Gate in the ledger.
2. Reuse the smallest existing Windows Tauri H+P1 journey covering representative grant/revoke, Party Stash, Long Rest, and handout behavior for Journey J5 / `MP-E~G`.
3. Run it on one exact SHA and record its matching Windows artifact/digest plus rendered evidence before changing the ledger.
4. If it fails or a production reachability/contract gap is reproduced, fill `roadmap/EVIDENCE_CARD.md` and repair only the smallest existing production path.
5. Keep P2 observer-parity final acceptance in `W9-02`.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
