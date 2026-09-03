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
W5: 8/10 PASS
Official ledger score: 62.0/100.0
PASS: 46/72
Remaining gates: 26/72
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
W5 — 8/10 PASS
Next exact Gate: W5-09
```

`W5-08` is closed by exact-SHA Initiative/reaction/concentration/Ready/correction fan-out AUTO evidence. Product verification SHA `faf5331ed72cd051213ab917e3c2f402fae03087` passed `W5-08 AUTO Verification` run `33697343776`, job `100468976213`, with 11/11 focused tests. Artifact `9872255696` (`W5-08-AUTO-faf5331ed72cd051213ab917e3c2f402fae03087`) has digest `sha256:59d2924fb515ef5763c608279d71b0d92e47cee5b6266114e70eb7e63bd8b2ce`. The official ledger records W5-08 PASS; the first non-PASS Gate is now `W5-09`.

## W5-09 exact scope

`W5-09` is `REUSE_LOCKED`. It closes the automated UI-facing parity evidence for `MP-J01` through `MP-J08`; it does **not** authorize a new multiplayer UI or mechanics path.

Repository-defined existing evidence owners:

- J01-J06: `tests/ui/connectedPartyStashApprovalOwnerTransfer.test.ts`
- J07: `tests/ui/connectedSceneTopologyProjection.test.ts`, `tests/ui/connectedSceneTopologyHostMutation.test.ts`, `tests/ui/productionHostRemoteFixtureIdentityProjection.test.ts`
- J08: `tests/ui/connectedThreePeerActionMatrix.test.ts`, `tests/ui/connectedThreePeerPresentation.test.ts`, `tests/ui/connectedTurnProjection.test.ts`, `tests/ui/connectedUndoCompensation.test.ts`

The minimum parity fingerprint covers public Scene entity fields; Session mode/round/current Actor/economy; selected Character action definitions; owner inventory/GP/items; active resolution presentation; and public Activity state changes. A wire-message, status-code, or persistence-only assertion is insufficient. Rendered Windows motion/VFX parity remains a later final acceptance concern; W5-09 fixes the automated parity evidence first.

No product code may change for W5-09 unless a reproducible current-HEAD failure or explicit production reachability/contract gap is recorded first.

## Branch roles

- Product integration target: `work/v1-composite`
- Roadmap audit baseline: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`
- Current execution plan: `docs/roadmap/V1_MASTER_ROADMAP.md`
- Evidence ledger: `docs/roadmap/V1_EVIDENCE_LEDGER.json`
- Evidence Card: `docs/roadmap/EVIDENCE_CARD.md`
- Multiplayer catalog: `docs/design/multiplayer-v1-scenario-catalog.md`
- MP-13 parity issue: GitHub issue `#189`
- Working branch policy: create one scoped `agent/*` branch from the latest live integration HEAD for each Gate or coherent repair; there is no permanent global active branch.
- `main`, C9 finalization branches, older V1 branches, and archived agent workspaces are historical/reference sources until deliberately promoted.

### Next execution sequence

1. Execute `W5-09`, the first non-`PASS` Gate in the ledger, by mapping and running the repository-owned MP-J automated parity coverage on an exact SHA.
2. Reuse the existing owners above. Do not reopen W1-W5-08 unless a new current-HEAD regression is reproduced.
3. If the focused W5-09 suite passes, record exact-SHA commands, counts, artifact/digest evidence, and scenario mapping before changing the official ledger.
4. If it fails, fill `docs/roadmap/EVIDENCE_CARD.md` and repair only the smallest reproduced owner-path defect.
5. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
