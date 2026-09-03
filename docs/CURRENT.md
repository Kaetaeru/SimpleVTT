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
W6: 3/8 PASS
Official ledger score: 68.8/100.0
PASS: 51/72
Remaining gates: 21/72
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
W6 — 3/8 PASS
Next exact Gate: W6-04
```

`W6-03` is closed without product-code changes. Canonical exact SHA `b1f54abefd7dffb2f865ccaccde31649b8080a01` passed `W6-03 AUTO Verification` run `33705306657`, job `100493052616`, with 13/13 focused tests and production build PASS. Artifact `9875022681` (`W6-03-AUTO-b1f54abefd7dffb2f865ccaccde31649b8080a01`) has digest `sha256:8f5ef938566269b624ae4eeb33c95603eee501c514f6353945e9767899058deb`. The focused Campaign/Party Stash owners cover the shared, DM-approval, and DM-managed request lifecycle plus connected owner/failure-retry behavior required by `MP-E06~E11`. PR #297 integrated the evidence as canonical merge `888defd2be7f2f08c2f721abf57f72aaac5f8f12`. The official ledger records W6-03 PASS and the first non-PASS Gate is `W6-04`.

## W6-04 exact scope

`W6-04` is `REUSE_LOCKED`. It freezes the existing Party Stash transfer transaction path for `MP-E12~E13`:

- transfer success/failure must remain atomic across the existing source/destination owners;
- transfer journal/history must record the authoritative result rather than invent a parallel Session-only ledger;
- failed or reversed work must use the existing compensation model rather than silent history deletion;
- persisted state must recover consistently after process restart/reload.

Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Reuse the existing transfer, journal, compensation, persistence, and recovery owners already established by Campaign/Party Stash work.

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

1. Execute `W6-04`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for Party Stash transfer atomicity, journal/history, compensation/Undo behavior, and restart recovery mapped to `MP-E12~E13`.
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
