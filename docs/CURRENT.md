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
W6: 5/8 PASS
Official ledger score: 71.3/100.0
PASS: 53/72
Remaining gates: 19/72
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
W6 — 5/8 PASS
Next exact Gate: W6-06
```

`W6-05` is closed without product/runtime or test-implementation changes. Integration-derived exact verification SHA `945188901c106b6114e3a7f89cb1671aab6ace27` (base canonical SHA `52b6fc06b114768903887de3669f6499172afb72`) passed `W6-05 AUTO Verification` run `33711448138`, job `100511627712`, with 9/9 focused tests and production build PASS. Artifact `5808814072` (`W6-05-AUTO-945188901c106b6114e3a7f89cb1671aab6ace27`) has digest `sha256:26ce88561019490d1c8734cb838ebf6dd789c180e9e4af57974a2559439351dc`. The focused Campaign ration-conversion owners close the automation-only `MP-E14` proof for trusted capability eligibility, configured ration units, atomic Party Stash debit + Campaign ration credit, stale-provider failure isolation, duplicate-request idempotency, legacy metadata revalidation, and production Campaign reachability. Real H+P1+P2 Windows rendered acceptance remains later. The official ledger records W6-05 PASS and the first non-PASS Gate is `W6-06`.

## W6-06 exact scope

`W6-06` is `REUSE_LOCKED`. It freezes the existing **distributed Character + Campaign Long Rest and owner/Host recovery** path for `MP-F07~F09`:

- Character-owned recovery and Campaign-owned time/ration changes must participate in the existing compound rest transaction;
- partial or failed persistence must not leave one owner committed while the other is silently lost;
- retry/restart recovery must converge without duplicate rest effects;
- connected Host/owner projections must reflect the authoritative committed outcome.

Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Reuse the existing Long Rest coordinator, Character owner persistence, Campaign time/ration persistence, connected transaction/recovery, and restart owners.

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

1. Execute `W6-06`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for distributed Character + Campaign Long Rest, owner/Host persistence, recovery/retry idempotency, and restart continuity mapped to `MP-F07~F09`.
3. Run that focused set on one exact SHA and record deterministic pass/fail count plus artifact/digest before changing the official ledger.
4. If it fails or a production reachability/contract gap is reproduced, fill `roadmap/EVIDENCE_CARD.md` and repair only the smallest existing owner-path defect.
5. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
