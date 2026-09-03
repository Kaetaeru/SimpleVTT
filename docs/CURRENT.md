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
W6: 6/8 PASS
Official ledger score: 72.5/100.0
PASS: 54/72
Remaining gates: 18/72
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
W6 — 6/8 PASS
Next exact Gate: W6-07
```

`W6-06` is closed without product/runtime or test-implementation changes. Integration-derived verification head `cf531f34a2c2cf85174fabafdc9092022fb0c46b` and GitHub Actions pull-request checkout `96f9e6715e32b95d6644f67fb461204661ab107c` share tree `b3607dd639fee00d42bc51f8ea88d5c6bf466cba`. `W6-06 AUTO Verification` run `33712312082`, job `100514236959`, passed 93/93 focused tests and the production build. Artifact `9877347283` (`W6-06-AUTO-96f9e6715e32b95d6644f67fb461204661ab107c`) has digest `sha256:45d257223dcb90dfefc79ab33ed51bcd6fabff0737d9e7039833c7860b5f4eb0`. The existing compound Long Rest, Character owner preparation/persistence, Campaign participant persistence, connected transaction, and Host restart recovery owners close the automation-only proof for `MP-F07~F09`: successful Character recovery plus optional Campaign effects, rejection without partial durable advance, and exactly-once owner/Host restart recovery. Real H+P1+P2 Windows rendered acceptance remains later. The official ledger records W6-06 PASS and the first non-PASS Gate is `W6-07`.

## W6-07 exact scope

`W6-07` is `REUSE_LOCKED`. It freezes the existing **connected DM Library materialization, handout, and spatial capability** paths for `MP-G01~G09`:

- DM Library definitions and materialized Session objects must reuse the existing provenance/capability path rather than a second content model;
- image handout reveal, withdraw, privacy, pinned lookup, and reconnect continuity must reuse the existing handout projection path;
- Scene topology and spatial state must remain Host-authoritative and converge through the existing connected Scene owners;
- reconnect and privacy behavior must preserve the same authoritative state without leaking Host-private facts.

Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Reuse the existing DM Library, Session materialization, handout projection, Scene topology/spatial capability, Host authority, reconnect, and privacy owners.

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

1. Execute `W6-07`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for connected DM Library materialization, handout lifecycle, Scene/spatial capabilities, reconnect continuity, and privacy mapped to `MP-G01~G09`.
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
