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
W0: 6/6 PASS
W1: 8/8 PASS — COMPLETE
W2: 8/8 PASS — COMPLETE
W3: 8/8 PASS — COMPLETE
W4: 8/8 PASS — COMPLETE
W5: 6/10 PASS
Official ledger score: 59.0/100.0
PASS: 44/72
Remaining gates: 28/72
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
W4 — COMPLETE (8/8 PASS)
W5 — 6/10 PASS
Next exact Gate: W5-07
```

W5-06 is closed by inherited exact-SHA shared VisualDice and CombatVfx projection evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected/session presentation verification and the frontend build. `tests/ui/connectedResolutionPresentation.test.ts` reconstructs the remote action from the Host presentation envelope and requires `buildVisualDiceRoll(...)` and `buildCombatVfxProfile(...)` to produce outputs identical to the local projections. `src/app/diceVisuals.ts` and `src/app/combatVisuals.ts` remain the shared projection owners; connected presentation consumes Host-authored authoritative Resolution data instead of introducing a network-only renderer or mechanics path. GitHub compare `2ac28651312f1fdbe82edb74fd13f342a8f910f7...58a10dc1bf42dff79dd3f8035ea02bd9967d8f43` contains no `src/` or `tests/` changes, while PR #265 adds only `roadmap/evidence/W5-06.md`. No product/runtime defect was reproduced and no product code changed for W5-06. The first non-PASS Gate is now W5-07.

W5-05 is closed by inherited exact-SHA ordered remote presentation queue evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/Session-layer/live lifecycle verification and the frontend build. `connectedSessionRuntimeAdapter` accepts only strictly newer live presentation sequences, queues non-dice stages FIFO, replaces stale replay when a newer authoritative dice signal arrives, and applies terminal `catchup` presentation only through committed Host event history. `ClientSessionReplica` rejects duplicate event IDs, conflicting history, and sequence gaps before cursor advance; `productionClientReconnect.test.ts` proves reconnect resumes from the accepted cursor and replayed catch-up does not apply twice. GitHub issues #111 and #114 record terminal catch-up without reroll, ordered remote queue behavior, connected regression 187/187, and build success. GitHub compare `2ac28651312f1fdbe82edb74fd13f342a8f910f7...be061030081a3ba9f570a1a9a7696283d2512f36` changes only canonical evidence/current documents plus evidence records W4-07/W5-01/W5-02/W5-03/W5-04, while PR #263 adds only `roadmap/evidence/W5-05.md`; product/runtime/tests are inherited unchanged. No product/runtime defect was reproduced and no product code changed for W5-05. The first non-PASS Gate is now W5-06.

W5-04 is closed by inherited exact-SHA Resolution Presentation Envelope evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/Session-layer/live lifecycle verification and the frontend build. `connectedResolutionPresentation` fixes a schema/versioned immutable presentation with resolution identity, actor/targets/action, structured authoritative faces plus selected/discarded indices and totals, outcome semantics, cumulative timeline, public redaction, and Activity linkage. `connectedActionRoutingAdapter` publishes live stages and carries the same presentation into ordered Host resolution history for catch-up without Client mechanics rerun; owner-only interrupt/concentration prompts are targeted separately from the public envelope. GitHub issue #111 records strict schema/identity validation, structured authoritative faces, cumulative timeline, Activity linkage, public redaction, terminal catch-up without reroll, shared `VisualDiceBridge` + `CombatVfxBridge`, and connected regression 187/187 plus build success. GitHub compare `2ac28651312f1fdbe82edb74fd13f342a8f910f7...1ca6e911087a09dced61cf6a4c7e60df29e64db0` changes only canonical evidence/current documents plus evidence records W4-07/W5-01/W5-02/W5-03/W5-04, so product/runtime/tests are inherited unchanged. PR #261 added the focused `roadmap/evidence/W5-04.md` record only. No product/runtime defect was reproduced and no product code changed for W5-04. The first non-PASS Gate is now W5-05.

W5-03 is closed by inherited exact-SHA Host single-mutation-path evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/Session-layer/live lifecycle verification and the frontend build. `connectedSessionRuntimeAdapter` routes Client `action-request` traffic only through the Host message path and `connectedActionRequestPort`; unavailable routing returns an error instead of applying state. `HostSessionLedger` rejects wrong-session or stale-cursor requests, requires Host-side reservation before commit, rejects history drift and unreserved commit, and de-duplicates request IDs. `ClientSessionReplica` advances only on same-session gap-free Host event sequences and rejects conflicting or gapped history before cursor advance. GitHub compare `2ac28651312f1fdbe82edb74fd13f342a8f910f7...0ee6f493fc765ac7a617eda485392957b1874c6e` changes only canonical evidence/current documents plus evidence records W4-07/W5-01/W5-02/W5-03, so product/runtime/tests are inherited unchanged. PR #259 added the focused `roadmap/evidence/W5-03.md` record only. No product/runtime defect was reproduced and no product code changed for W5-03. The first non-PASS Gate is now W5-04.

W5-02 is closed by inherited exact-SHA trusted persisted-Character owner-projection evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including the production local-character-switch/connected ownership path. `characterSessionProjection.test.ts` fixes the trust boundary: source/runtime revisions and exact canonical content identities are bounded, AC/presented attacks are not source authority, client presentation drift cannot alter trusted payloads, injected mechanics are rejected, and impossible runtime HP is rejected. `productionParticipantLifecycle.test.ts` rejects invalid SessionProjection before participant/peer/ledger/projection/Scene ghost state; `productionLocalCharacterSwitch.test.ts` preserves remote ephemeral projection ownership while switching the local canonical Character, temporarily activates projected resolution context, and restores the previous Host/local context without overwriting projection-owned actions/economy. The same product SHA passed V1 Tauri Verification run `33636100197`, job `100267245684` (`tauri-w4-07-spatial`), with artifact `9849024415` (`SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7`), digest `sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0`. GitHub compare `2ac28651312f1fdbe82edb74fd13f342a8f910f7...761f1d08601f3f4192ec9bc1339d09b64858eafe` changes only canonical evidence/current documents and evidence records W4-07/W5-01/W5-02, so the product/runtime/tests are inherited unchanged. PR #257 added the focused `roadmap/evidence/W5-02.md` record only. No product/runtime defect was reproduced and no product code changed for W5-02. The first non-PASS Gate is now W5-03.

W5-01 is closed by inherited exact-SHA connected topology and participant-lifecycle evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/continuity/Session-layer coverage plus the live lifecycle, late-join, and connection-safety suites. `productionParticipantLifecycle.test.ts` fixes valid live late join, incompatible/invalid rejection without ghost state, replacement reconnect, and ordered Host-authoritative catch-up; `productionClientReconnect.test.ts` fixes reconnect from the accepted replica cursor with exactly-once hello-ack catch-up. On the same exact product SHA, V1 Tauri Verification run `33636100197`, job `100267245684` (`tauri-w4-07-spatial`), passed the real Windows H+P1+P2 connected topology and replacement reconnect path. Artifact `9849024415` (`SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7`) has digest `sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0`. GitHub compare from the verification SHA through canonical evidence base `8a4d279d0144abdabeb8c1402cf86c5f55defe64` changes only canonical evidence/current documents plus the W4-07 evidence record, and PR #255 adds only `roadmap/evidence/W5-01.md`, so the verified product/runtime/tests are inherited unchanged. No product/runtime defect was reproduced and no product code changed for W5-01.

W4-08 is closed by exact-SHA Windows Tauri Campaign reopen evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed V1 Tauri Verification run `33636100197`, job `100267245439` (`tauri-w3`). The existing production journey prepares a playable Character and Campaign through the real UI, saves a DM-owned PC preset, starts a local Host Session, performs play and Long Rest with +8h Campaign time, ends the Session through the production pane, exits the app process, relaunches on the same data root, reopens the Campaign, and asserts absolute time `480` minutes plus one completed session-history entry. The same job passed `tests/ui/appProviderStopSessionRefresh.test.ts` 2/2 before the Tauri journey. Artifact `9849024676` (`SimpleVTT-W3-Tauri-2ac28651312f1fdbe82edb74fd13f342a8f910f7`) has digest `sha256:40fd32b55ec3f6d92f47c29b6acff20d599e64b3b7f757ddf5c9b73e270860e3`. Actions synthetic merge `f05147605e4dce56a0552b69fa361f28d4c5cf60` has no file differences from verification head `2ac28651312f1fdbe82edb74fd13f342a8f910f7`, and the compare from that verification SHA through canonical `ceaf3ebf786ffa13d934d68c0fcebcc58cb00ae8` changes only canonical evidence/current documents plus the W4-07 evidence record. No product/runtime defect was reproduced and no product code changed for W4-08. W4 is complete.

W4-07 is closed by exact-SHA multiplayer DM-preparation evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/continuity/Session-layer coverage and the frontend build. V1 Tauri Verification run `33636100197`, job `100267245684` (`tauri-w4-07-spatial`), passed the real Windows H+P1+P2 acceptance for all `MP-G01` through `MP-G09`: NPC quick-add, PC preset quick-add, validated custom JSON materialization, handout reveal/withdraw, reconnect continuity, DM-only privacy, Session-pinned lookup, mapless spatial fallback, and compatible-provider Host validation. Artifact `9849024415` (`SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7`) has digest `sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0`. PR #249 merged the verified tree as `2ffc2004d795a350a4aa3676bcd7d4cb362f1ea1` with no file differences from the verification SHA, and PR #251 added the focused `roadmap/evidence/W4-07.md` record only. No product/runtime defect was reproduced.

W4-06 is closed by inherited exact-SHA Campaign DM Library organization/import/private-note/provenance evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`; `Run UI tests` succeeded. `campaignDmLibraryOrganizationRuntime.test.ts` and `campaignDmLibraryOrganizationStructure.test.ts` cover Campaign-owned private-note CRUD, folder create/rename/delete, and persisted folder/favorite placement. `campaignDmLibraryImport.test.ts` preserves feature-rich custom/magic item runtime fields and provenance, imports arrays/NPC definitions, and rejects invalid charge/attunement contracts. `campaignDmLibraryNoteStructure.test.ts` and `campaignDmLibraryStructure.test.ts` keep `dmLibrary` and `noteText` out of Session projection and the DM Library Host-only. `campaignDmLibraryDeleteProvenance.test.ts` proves Character grants are independent copies that retain provenance after source Library deletion. PR #230 records the focused acceptance mapping in `roadmap/evidence/W4-06.md`. GitHub compare `5bef709f010543859e84c98ef7db8f14e5c06469...083ce354fc2c1fcfd1e1346f976f920a30ccd2c1` changes only evidence/current docs plus the W4-06 evidence file, so the product/runtime/test path is inherited unchanged. No product code changed for W4-06.

W4-05 is closed by inherited exact-SHA Party Stash policy evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including `Verify Party Stash sequential transfer routing`. `campaignPersistenceContracts` fixes exactly `shared`, `dm-approval`, and `dm-managed`; `campaignPartyStashPolicyRuntimeAdapter` keeps deposits open, allows shared withdrawals, queues non-DM withdrawals for explicit DM approve/reject under approval mode, rejects non-DM withdrawals in DM-managed mode, and preserves the base transfer path for DM withdrawals. `CampaignSystemsPanel` exposes all three policies and pending approve/reject controls through the production Campaign UI. Existing `campaignSystems.test.ts` fixes durable Party Stash transfer/idempotency/failure isolation and Campaign namespace ownership. GitHub compare `5bef709f010543859e84c98ef7db8f14e5c06469...cf712116381ff8493c8eeebfad7ed8ada95b78ee` changes only the four evidence/current docs, so this production/runtime/test path is inherited unchanged. No product code changed for W4-05.

W4-04 is closed by inherited exact-SHA Campaign calendar, rations, visibility, and declarative-provider evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including `Verify Campaign lifecycle and declarative providers`. `campaignRuntimeAdapter` owns calendar/ration provider IDs and versions, Session defaults, and immutable `rationsVisibleToPlayers` snapshotting; Client snapshots omit ration detail when that policy is false. `connectedCampaignSystemsRuntimeAdapter` enforces the same boundary on transport by redacting ration balances/requirements/shortage and roster ration-unit fields from the Player projection without mutating Host authority. Existing Campaign runtime, systems, and declarative-provider tests cover provider configuration, calendar/ration behavior, Session snapshot capture, provider version pinning/options, and Campaign UI/runtime ownership. The integration history from trusted product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` through canonical `19ffc83e529e7e986f50377bfded69cb6ca33871` changes only evidence/current docs. No product code changed for W4-04.

W4-03 is closed by inherited exact-SHA Campaign roster, Session snapshot, history, and summary evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including `campaignRuntimeAdapter.test.ts`, which verifies Campaign-owned roster projection and immutable Session preparation snapshots. `campaignSystems.test.ts` verifies revisioned roster mutations plus `appendSessionSummary` persistence with bounded 50-entry history and `lastSessionId`. Production `main.tsx` composes `campaignSessionHistoryRuntimeAdapter`, which wraps successful Host stop, derives the completed Session summary from the captured Campaign snapshot and live participant/calendar/ration/stash state, persists it, and clears the Session snapshot. Windows Tauri run `33569954938`, job `100061523302`, at SHA `53ec501555222b60d9e856b231f4f64395f75b76` ended the Session through the rendered UI, exited, relaunched on the same data root, and showed one completed Campaign session-history entry. Artifact `9824674856` has digest `sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034`. The Windows SHA and canonical product merge `5bef709f010543859e84c98ef7db8f14e5c06469` share tree `0e6baadda2570b169c35c6b7436ff4e0042dfff0`; the compare through canonical `fd14887dd286725d2ec71b48a70d121b6c63d8d6` changes only evidence/current docs. No product code changed for W4-03.

W4-02 is closed by inherited exact-SHA Campaign dashboard/session-binding evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including the `Verify Campaign lifecycle and declarative providers` step. Existing `campaignProductUiStructure.test.ts` fixes Campaign as a first-class route and verifies Host requires a selected Campaign through the prepared snapshot path. `ProductionSessionWorkspaceBridge` disables offline/disconnected Host when no active Campaign exists, prepares `activeCampaign.campaignId`, and only then calls `app.hostSession()`. `campaignRuntimeAdapter` rejects a missing Campaign and binds Campaign identity/revision/content-loadout revision plus immutable Campaign settings into the AppSnapshot/Session. The lower production session lifecycle remains responsible only for transport/lifecycle rather than duplicating Campaign policy. The compare from the verified product SHA through canonical `c005f32e7e4f564d479771013192291d7992dff0` changes only evidence/current docs, so the verified W4-02 product/tests are inherited unchanged. No product code changed for W4-02.

W4-01 is closed by inherited exact-SHA Campaign lifecycle evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including the `Verify Campaign lifecycle and declarative providers` step. Existing `campaignPersistence.test.ts` covers durable create/read/update/archive/restore/duplicate/delete and reload, while `campaignLifecycleRuntime.test.ts` proves duplicated Campaign-owned Party Stash and DM Library namespaces are independent and delete removes only the intended Campaign. `src/app/campaignPersistence.ts` derives Campaign-owned stash, DM Library, and content-loadout IDs from `campaignId`. No product code changed for W4-01.

W3-08 is closed on exact Windows verification SHA `53ec501555222b60d9e856b231f4f64395f75b76`. GitHub Actions V1 Tauri Verification run `33569954938`, job `100061523302`, passed the complete local lifecycle through the real Windows Tauri product: Character creation, Campaign DM-owned PC preset save, local Host session, production DM Library materialization, weapon attack, damage spell, Long Rest with +8h Campaign time, UI session end, process exit, same-data-root restart, Campaign time `480` minutes, and one completed session-history entry. Artifact `9824674856` (`SimpleVTT-W3-Tauri-53ec501555222b60d9e856b231f4f64395f75b76`) has digest `sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034`. Canonical merge `5bef709f010543859e84c98ef7db8f14e5c06469` shares tree `0e6baadda2570b169c35c6b7436ff4e0042dfff0` with the verified head.

W3-07 is closed with inherited exact-SHA event-native Undo evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`. The production Phase 09 attack adapter reverses committed `ResolutionEvent`s, preserves the original Activity as `reversed`, prepends a correction Activity with `undoOf` linkage, and rejects stale Undo after authoritative drift instead of deleting history. PR #218 records the focused evidence; no product runtime code was changed.

W3-06 is closed with inherited exact-SHA condition/duration/rest/resource-recovery evidence. Rules Domain run `33342898384`, job `99341612326`, at source/check SHA `6095fe8adbe52b047ef5f6fee3413975bf02c3e0` verified lifecycle, condition, Short/Long Rest, and recovery owners; trusted product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed UI run `33498144567`, job `99824979798`, covering production artifact lifetime/lifecycle and Character Long Rest projection. Current canonical product/tests inherit those verified paths unchanged. The focused evidence is recorded in `roadmap/evidence/W3-06.md` and correction PR #210; no product runtime changed.

W3-05 is closed with inherited exact-SHA reaction/interruption/concentration/Ready production-path evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`; the workflow explicitly ran 11 focused production-facing tests across `c9FamilyOReadyConcentrationProduction`, `phase09ManualMovementReactionAdapter`, and `phase09ConcentrationSaveWorkflow`. Existing runtime covers authoritative reaction spend/rollback, structural Ready stored invocations, deferred concentration lifecycle, concentration saves, stale-input rejection, Activity, and Undo without partial mutation. PR #205 records the focused evidence; no product runtime changed.

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

1. Start `W5-07`, the first non-`PASS` Gate in the ledger.
2. Do not reopen W1-W5-06; reuse their recorded exact-SHA evidence unless a new current-HEAD regression is reproduced.
3. For `W5-07`, inspect only the repository-defined acceptance criterion and its existing production/test owner before authorizing any product-code change.
4. For Common Play, follow [`design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`](design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md): functional reachability first, broad UI redesign later.

## Non-negotiable execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before editing.
2. Fill [`roadmap/EVIDENCE_CARD.md`](roadmap/EVIDENCE_CARD.md) before any product-code change.
3. Do not change a `REUSE_LOCKED` or `VERIFY_ONLY` Gate without a reproducible current-HEAD failure or an explicit production reachability/contract gap.
4. Do not create a second Tauri shell, Character Creator, progression engine, Resolver, persistence backend, transport, presentation queue, dice/VFX renderer, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
5. Structural or protocol-only evidence cannot close rendered Windows behavior.
6. Do not restore branch-writing/self-publishing automation as the normal implementation loop.
7. V1 is complete only at `72/72`, `100.0/100.0`, `120/120`, `18/18`, `13/13`, and one matching Windows artifact plus digest.