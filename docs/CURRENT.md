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
W6: 2/8 PASS
Official ledger score: 67.5/100.0
PASS: 50/72
Remaining gates: 22/72
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
W6 — 2/8 PASS
Next exact Gate: W6-03
```

`W6-02` is closed after a canonical Evidence Card reproduced the production reachability gap: the existing Campaign advancement owner already handled exact XP, multi-Character XP, immediate level-up credit, credit consumption, and durable roster level state, but the real Host/live Session UI could not invoke it. PR #294 added only the smallest Host/live advancement control and reused `grantCampaignAdvancement`; no second progression store, engine, transport, or Character write path was introduced. Verification SHA `a72387016fec255674b8132b1f8b80b08d99da25` passed `W6-02 AUTO Verification` run `33703181522`, job `100486658419`, with 13/13 focused tests and production build PASS. Artifact `9874278799` (`W6-02-AUTO-9a07c28309ffe781d4ed1e4cea33f7e8f0706577`) has digest `sha256:abc109aca9d519e96aec8e03d442a2e071151c659e658a27b99207607f93fc0c`; its name reflects the pull-request synthetic merge SHA, while run `head_sha` `a72387016fec255674b8132b1f8b80b08d99da25` is the authoritative product verification identity. PR #294 integrated the tested repair into `work/v1-composite` as merge `b11f5267121c2c4dfb11176ef6ff12841f3c877b`. The official ledger records W6-02 PASS and the first non-PASS Gate is `W6-03`.

## W6-03 exact scope

`W6-03` is `REUSE_LOCKED`. It freezes the existing Party Stash request-policy lifecycle for `MP-E06~E11`:

- shared mode permits the canonical direct withdrawal path;
- approval mode routes non-DM withdrawals through an explicit request and Host approve/reject lifecycle;
- DM-managed mode rejects unauthorized non-DM withdrawal attempts;
- accepted/rejected request state must stay Host-authoritative and use the existing connected/persistence owners rather than a Session-only parallel stash.

Before changing product code, reproduce a current-HEAD failure or document an explicit production reachability/contract gap in `roadmap/EVIDENCE_CARD.md`. Reuse the existing Party Stash policy, request, connected authority, journal/persistence, and projection owners already established by W4-05 and later multiplayer work.

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

1. Execute `W6-03`, the first non-`PASS` Gate in the ledger.
2. Identify the smallest existing automated owners for shared withdrawal, approval request/approve/reject, DM-managed rejection, connected Host authority, and request durability/reconnect behavior mapped to `MP-E06~E11`.
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
