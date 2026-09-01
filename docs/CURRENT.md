# Current — SimpleVTT

Updated: 2026-09-02 Asia/Seoul

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
W1: 8/8 PASS — COMPLETE
W2: 8/8 PASS — COMPLETE
W3: 8/8 PASS — COMPLETE
Official ledger score: 40.0/100.0
Remaining gates: 42/72
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
W0 — COMPLETE
W1 — COMPLETE (8/8 PASS)
W2 — COMPLETE (8/8 PASS)
W3 — COMPLETE (8/8 PASS)
Next exact Gate: W4-01
```

W3-08 is closed on exact Windows verification SHA `53ec501555222b60d9e856b231f4f64395f75b76`. GitHub Actions V1 Tauri Verification run `33569954938`, job `100061523302`, passed the complete local lifecycle through the real Windows Tauri product: Character creation, Campaign DM-owned PC preset save, local Host session, production DM Library materialization, weapon attack, damage spell, Long Rest with +8h Campaign time, UI session end, process exit, same-data-root restart, Campaign time `480` minutes, and one completed session-history entry. Artifact `9824674856` (`SimpleVTT-W3-Tauri-53ec501555222b60d9e856b231f4f64395f75b76`) has digest `sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034`. Canonical merge `5bef709f010543859e84c98ef7db8f14e5c06469` shares tree `0e6baadda2570b169c35c6b7436ff4e0042dfff0` with the verified head. The first non-PASS Gate is now W4-01.

W3-07 is closed with inherited exact-SHA event-native Undo evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`. The production Phase 09 attack adapter reverses committed `ResolutionEvent`s, preserves the original Activity as `reversed`, prepends a correction Activity with `undoOf` linkage, and rejects stale Undo after authoritative drift instead of deleting history. PR #218 records the focused evidence; no product runtime code was changed.

W3-06 is closed with inherited exact-SHA condition/duration/rest/resource-recovery evidence. Rules Domain run `33342898384`, job `99341612326`, at source/check SHA `6095fe8adbe52b047ef5f6fee3413975bf02c3e0` verified lifecycle, condition, Short/Long Rest, and recovery owners; trusted product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed UI run `33498144567`, job `99824979798`, covering production artifact lifetime/lifecycle and Character Long Rest projection. Current canonical product/tests inherit those verified paths unchanged. The focused evidence is recorded in `roadmap/evidence/W3-06.md` and correction PR #210; no product runtime changed.

W3-05 is closed with inherited exact-SHA reaction/interruption/concentration/Ready production-path evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`; the workflow explicitly ran 11 focused production-facing tests across `c9FamilyOReadyConcentrationProduction`, `phase09ManualMovementReactionAdapter`, and `phase09ConcentrationSaveWorkflow`. Existing runtime covers authoritative reaction spend/rollback, structural Ready stored invocations, deferred concentration lifecycle, concentration saves, stale-input rejection, Activity, and Undo without partial mutation. PR #205 records the focused evidence; no product runtime code was changed.

W3-04 is closed with inherited exact-SHA shared-action transaction evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`, and the production build succeeded. Existing spell, feature, item, action-economy, inventory, spell-execution, and Common Play artifact coverage proves the reusable transaction path commits cost, target, effect, Activity, resource spend, and item decrement atomically, rejects invalid actions without partial mutation, and avoids double-spend. PR #203 records the focused evidence; no product runtime code was changed.

W3-03 is closed with inherited exact-SHA atomic-combat evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: the combined W3 invocation passed 54/54 tests, including 23 W3-03-owned attack/damage/healing tests, and the production build succeeded. Existing Resolver-backed transactions cover hit/miss/critical, atomic damage + HP + economy writeback, rejection without partial mutation, runtime damage/concentration effects, mapless/module targeting authority, event-native Activity/Undo, and atomic self-healing with Bonus Action/resource spend. PR #202 records this evidence; no product runtime code was changed.

W3-02 is closed with inherited exact-SHA turn-lifecycle evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: the existing Phase 09 runtime orders initiative, initializes Action/Bonus Action/Reaction/movement economy, preserves spent economy across snapshots and manual selection, advances turn boundaries through the generic Resolver, wraps rounds with base-economy refresh, reconciles committed actions and compensating Undo, admits new Combatants without restarting initiative, and releases back to Freeform when initiative ends. Production `ProductionPlayScreen` exposes the authoritative start initiative, end turn, and end initiative commands. PR #201 records the focused evidence; no product runtime code was changed.

W3-01 is closed with inherited exact-SHA production-authority evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: production Freeform skill actions use authoritative d20 faces and commit Activity, ability checks delegate to the existing real resolution service, saving throws use runtime Character/Combatant stats and the canonical d20 resolver, and portable Common Play d20 definitions lower through the existing generic Resolver with rename-invariant and explicit rejection coverage. PR #199 added the W3-01 evidence card only and merged as `ca6b42c47409ff7096f31aeab12624336225ab8f`; no product runtime code changed.

`W2` is complete. W2-08 passed on product SHA `699c923dc50dac5ecd266ced58568d3b647850b6` (tree `449bf34d36c7975addcc2196b87a9a026d525730`) in Windows Tauri run `33470259003`, job `99738402317`, artifact `9786387605`, digest `sha256:3077663cb94c2a444046d94808c76a677c7d92de61a0576f61d5f57b8cd1172d`. The six production-UI archetypes survived real process exit and same-root restart with durable identity/content and rendered Full Sheet evidence. One current-HEAD product gap was repaired at the existing Character materialization owner: initial class tracks and standard/pact spell capacity now use the existing progression calculators. W2-01 remains inherited evidence; W2-02 through W2-07 remain verified at `ef2cdf69748195bd63c0bd7eff747420811842bf`.

W1-01 is closed with focused production-route evidence on canonical SHA `9113736b5dbc565cb40d0646b0f27abdbdc6eb59`.

W1-02 through W1-04 are closed on canonical SHA `42305b1d2a66a976b08844509a63b5999166938a`. Existing Guided Create covers the full level-1 choice graph, Guided and Quick preserve one shared draft, and incomplete drafts remain blocked from commit. GitHub Actions UI run `33387465586` passed; no product runtime code was changed for these reuse gates.

W1-05 through W1-08 passed on product SHA `c0900157560ac51a745eac687eb4fff7f2580086` (tree `75f8fc64799a98c22e980dbd102a822555d8c846`) in Windows Tauri run `33409861843`, job `99546422908`, artifact `9764936861`, digest `sha256:85eda3890fdbc6d28ee0e5155617082642a4e22c1e851a5c73783be59af00b23`. The Actions synthetic merge SHA `8c68cf20d7f2287e2f0581b6725f6a20785d5dab` had the same tree.

W1-06 was the only Gate with a reproduced product gap: the real Character Library lacked complete durable duplicate/delete reachability and independent identity. Commit `736df4da679edb1b098363cdbabb174f46505841` minimally reused the existing repository/runtime and added UUID-backed identity plus duplicate/delete UI. W1-05, W1-07, and W1-08 changed only the existing E2E harness.

### Next execution sequence

1. Start `W4-01`, the first non-`PASS` Gate in the ledger.
2. Do not reopen W1-W3; reuse their recorded exact-SHA evidence unless a new current-HEAD regression is reproduced.
3. For `W4-01`, verify the existing Campaign create/read/update/archive/restore/duplicate/delete and namespace isolation paths before authorizing any product-code change.
4. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.
