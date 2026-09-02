# Current roadmap

Updated: 2026-09-02 Asia/Seoul

This page routes to the **one active V1 execution plan**. It does not duplicate that plan.

## Active plan

[`V1_MASTER_ROADMAP.md`](V1_MASTER_ROADMAP.md)

Evidence tracking:

- [`V1_EVIDENCE_LEDGER.json`](V1_EVIDENCE_LEDGER.json)
- [`EVIDENCE_CARD.md`](EVIDENCE_CARD.md)

## Fixed V1 numbers

```text
10 workstreams: W0-W9
72 release gates
100 weighted points
120 multiplayer scenarios: MP-A01-MP-J08
18 legacy V1 release gates
13 required MP work issues: MP-01-MP-13
```

Initial repository audit classification:

```text
47/72 REUSE_LOCKED
14/72 VERIFY_ONLY
11/72 BUILD
61/72 existing implementation reused = 84.7%
```

These numbers classify the work; they are not completion credit. Completion credit comes only from the evidence ledger.

## Current evidence state

```text
W0: COMPLETE — 6/6 PASS
W1: COMPLETE — 8/8 PASS
W2: COMPLETE — 8/8 PASS
W3: COMPLETE — 8/8 PASS
W4: 7/8 PASS
Official ledger score: 48.8/100.0
PASS: 37/72
PENDING: 35/72
FAIL: 0
BLOCKED: 0
```

## Current stage

```text
Next Gate: W4-08
```

`W4-07` is PASS by exact-SHA multiplayer DM-preparation evidence. Product verification SHA `2ac28651312f1fdbe82edb74fd13f342a8f910f7` passed GitHub Actions UI run `33636100212`, job `100267245818`, including connected topology/continuity/Session-layer coverage and the frontend build. V1 Tauri Verification run `33636100197`, job `100267245684` (`tauri-w4-07-spatial`), passed the real Windows H+P1+P2 acceptance for all `MP-G01` through `MP-G09`: NPC quick-add, PC preset quick-add, validated custom JSON materialization, handout reveal/withdraw, reconnect continuity, DM-only privacy, Session-pinned lookup, mapless spatial fallback, and compatible-provider Host validation. Artifact `9849024415` (`SimpleVTT-W4-07-G01-G09-2ac28651312f1fdbe82edb74fd13f342a8f910f7`) has digest `sha256:b044f73320cd10bf2446695677ca2098c7c162d01190feed7ecc599078c656a0`. PR #249 merged the verified tree as `2ffc2004d795a350a4aa3676bcd7d4cb362f1ea1` with no file differences from the verification SHA, and PR #251 added the focused `evidence/W4-07.md` record only. No product/runtime defect was reproduced; the next exact Gate is `W4-08`.

`W4-06` is PASS by inherited exact-SHA Campaign DM Library evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`; `Run UI tests` succeeded. `campaignDmLibraryOrganizationRuntime.test.ts` and the organization structure test cover Campaign-owned private-note CRUD, folder create/rename/delete, and persisted folder/favorite placement. `campaignDmLibraryImport.test.ts` covers JSON import for feature-rich custom/magic items, arrays/NPC definitions, provenance preservation, and invalid charge/attunement rejection. Note/Library structure tests keep `dmLibrary` and `noteText` out of Session projection and the Library Host-only. `campaignDmLibraryDeleteProvenance.test.ts` proves a Character grant is an independent copy retaining provenance after the source Library definition is deleted. PR #230 records the focused acceptance mapping in `evidence/W4-06.md`. GitHub compare `5bef709f010543859e84c98ef7db8f14e5c06469...083ce354fc2c1fcfd1e1346f976f920a30ccd2c1` changes only the evidence/current docs plus the W4-06 evidence file, so the production/runtime/tests are inherited unchanged. No product code changed for W4-06.

`W4-05` is PASS by inherited exact-SHA Party Stash policy evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including `Verify Party Stash sequential transfer routing`. `campaignPersistenceContracts` fixes exactly `shared`, `dm-approval`, and `dm-managed`; `campaignPartyStashPolicyRuntimeAdapter` keeps deposits open, allows shared withdrawals, queues non-DM withdrawals for explicit DM approve/reject under approval mode, rejects non-DM withdrawals in DM-managed mode, and preserves the base transfer path for DM withdrawals. `CampaignSystemsPanel` exposes all three policies and pending approve/reject controls through the production Campaign UI. Existing `campaignSystems.test.ts` fixes durable Party Stash transfer/idempotency/failure isolation and Campaign namespace ownership. GitHub compare `5bef709f010543859e84c98ef7db8f14e5c06469...cf712116381ff8493c8eeebfad7ed8ada95b78ee` changes only the four evidence/current docs, so this production/runtime/test path is inherited unchanged. No product code changed for W4-05.

`W4-04` is PASS by inherited exact-SHA Campaign systems evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`; step `Verify Campaign lifecycle and declarative providers` succeeded. `campaignRuntimeAdapter` fixes calendar/ration provider IDs and versions, Session defaults, and the immutable `rationsVisibleToPlayers` policy in the prepared Session snapshot; Client projection omits ration details when visibility is false. `connectedCampaignSystemsRuntimeAdapter` enforces the same privacy boundary on network projection by stripping ration balances/requirements/shortage and roster ration-unit fields before broadcast when `visibleToPlayers` is false, while the Host retains the authoritative Campaign state. Existing `campaignRuntimeAdapter.test.ts`, `campaignSystems.test.ts`, and declarative provider profile/runtime/UI tests cover provider configuration, calendar/ration state, Session snapshot capture, installed provider version pinning/options, and Campaign UI/runtime ownership. The integration history from product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` through canonical `19ffc83e529e7e986f50377bfded69cb6ca33871` changes only the four evidence/current docs, so the W4-04 production/runtime/tests are inherited unchanged. No product code changed for W4-04.

`W4-03` is PASS by inherited exact-SHA Campaign continuity evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`, including `campaignRuntimeAdapter.test.ts`, which verifies Campaign-owned roster projection and immutable Session preparation snapshots. `campaignSystems.test.ts` verifies revisioned roster mutations plus `appendSessionSummary` persistence with bounded 50-entry history and `lastSessionId`. Production `main.tsx` composes `campaignSessionHistoryRuntimeAdapter`, which wraps successful Host stop, derives a summary from the captured Campaign Session snapshot and live participant/calendar/ration/stash state, persists it, then clears the snapshot. Windows Tauri run `33569954938`, job `100061523302`, at SHA `53ec501555222b60d9e856b231f4f64395f75b76` ended the Session through the rendered UI, exited, relaunched with the same data root, and observed Campaign session history `1회`; artifact `9824674856` has digest `sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034`. That Windows SHA and product merge `5bef709f010543859e84c98ef7db8f14e5c06469` share tree `0e6baadda2570b169c35c6b7436ff4e0042dfff0`, and the compare through canonical `fd14887dd286725d2ec71b48a70d121b6c63d8d6` changes only evidence/current docs. No product code changed for W4-03.

`W4-02` is PASS by inherited exact-SHA Campaign dashboard/session-binding evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`; step `Verify Campaign lifecycle and declarative providers` succeeded and includes `campaignProductUiStructure.test.ts` plus `campaignRuntimeAdapter.test.ts`. The production `ProductionSessionWorkspaceBridge` disables offline/disconnected Host without an active Campaign, calls `prepareCampaignSessionSnapshot(activeCampaign.campaignId)`, and only then calls `app.hostSession()`. The Campaign runtime rejects a missing Campaign and binds Campaign identity/revision/content-loadout revision plus an immutable Campaign settings snapshot into AppSnapshot/Session. The compare from that product SHA through canonical `c005f32e7e4f564d479771013192291d7992dff0` changes only evidence/current docs, so the verified W4-02 implementation/tests are inherited unchanged. No product code changed for W4-02.

`W4-01` is PASS by inherited exact-SHA Campaign lifecycle evidence. Product SHA `5bef709f010543859e84c98ef7db8f14e5c06469` passed GitHub Actions UI run `33570546168`, job `100063331529`; step `Verify Campaign lifecycle and declarative providers` succeeded. Existing `campaignPersistence.test.ts` covers durable create/read/update/archive/restore/duplicate/delete and reload, while `campaignLifecycleRuntime.test.ts` verifies duplicated Campaign-owned Party Stash and DM Library namespaces are independent and delete removes only the target Campaign. `src/app/campaignPersistence.ts` derives Campaign-owned stash, DM Library, and content-loadout IDs from `campaignId`. No product code changed for W4-01.

`W3-08` is PASS on exact Windows verification SHA `53ec501555222b60d9e856b231f4f64395f75b76`. GitHub Actions V1 Tauri Verification run `33569954938`, job `100061523302`, passed the complete local journey: Character -> Campaign DM-owned PC preset -> local Host -> production DM Library drop -> weapon attack + damage spell -> Long Rest (+8h) -> UI session end -> process exit -> same-data-root restart, with Campaign time `480` minutes and session history `1회`. Artifact `9824674856` (`SimpleVTT-W3-Tauri-53ec501555222b60d9e856b231f4f64395f75b76`) has digest `sha256:d51dd1d962be4533b31551f900dae26655d3a4e2b05aa8131ffa98122bb18034`. Canonical merge `5bef709f010543859e84c98ef7db8f14e5c06469` shares tree `0e6baadda2570b169c35c6b7436ff4e0042dfff0` with the verified head. W3 is complete.

`W3-07` is PASS by inherited exact-SHA event-native Undo evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`. The production Phase 09 attack adapter reverses committed `ResolutionEvent`s, preserves the original Activity as `reversed`, prepends a correction Activity with `undoOf` linkage, and rejects stale Undo after authoritative drift instead of deleting history. PR #218 records the focused evidence with no product runtime change.

`W3-06` is PASS by inherited exact-SHA condition/duration/rest/resource-recovery evidence. Rules Domain run `33342898384`, job `99341612326`, at source/check SHA `6095fe8adbe52b047ef5f6fee3413975bf02c3e0` verified the lifecycle, condition, Short/Long Rest, and recovery owners; trusted product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed UI run `33498144567`, job `99824979798`, covering production artifact lifetime/lifecycle and Character Long Rest projection. Current canonical product/tests inherit those verified paths unchanged. The focused evidence is recorded in `evidence/W3-06.md` and correction PR #210; no product runtime changed.

`W3-05` is PASS by inherited exact-SHA reaction/interruption/concentration/Ready production-path evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`; the workflow explicitly ran 11 focused production-facing tests across `c9FamilyOReadyConcentrationProduction`, `phase09ManualMovementReactionAdapter`, and `phase09ConcentrationSaveWorkflow`. Existing runtime covers authoritative reaction spend/rollback, structural Ready stored invocations, deferred concentration lifecycle, concentration saves, stale-input rejection, Activity, and Undo without partial mutation. PR #205 records the focused evidence with no product runtime change.

`W3-04` is PASS by inherited exact-SHA shared-action transaction evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`, and `npm run build` succeeded. Existing spell, feature, item, action-economy, inventory, spell-execution, and Common Play artifact coverage proves that cost, target, effect, Activity, resource spend, and item decrement share reusable atomic transaction behavior, reject invalid actions without partial mutation, and avoid double-spend. PR #203 records the focused evidence with no product runtime change.

`W3-03` is PASS by inherited exact-SHA atomic-combat evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: the combined W3 invocation passed 54/54 tests, including 23 Gate-owned attack/damage/healing tests, and `npm run build` succeeded. Existing Resolver-backed transactions handle hit/miss/critical, atomic damage + HP + economy writeback, rejection without partial mutation, runtime damage/concentration effects, event-native Activity/Undo, and atomic self-healing with economy/resource spend. PR #202 records the focused evidence with no product runtime change.

`W3-02` is PASS by inherited exact-SHA turn-lifecycle evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: the existing Phase 09 runtime orders initiative, initializes and preserves Action/Bonus Action/Reaction/movement economy, advances end-turn/begin-turn through the generic Resolver, increments rounds on wrap, refreshes the next turn from base economy, reconciles committed actions and Undo, admits new Combatants without restarting initiative, and returns to Freeform when initiative ends. Production `ProductionPlayScreen` exposes the real start/end initiative and end-turn commands. PR #201 records the focused evidence with no product runtime change.

`W3-01` is PASS by inherited exact-SHA production-authority evidence. Product SHA `1a2a5e92f34f3d1dc1a325c9dc6dd39a06eac2ff` passed GitHub Actions UI run `33498144567`, job `99824979798`: production Freeform skill actions use authoritative d20 faces and Activity, ability checks delegate to the existing real resolution service, saving throws use runtime stat sources and the canonical d20 resolver, and portable Common Play d20 definitions lower through the existing generic Resolver with rename-invariant/rejection coverage. PR #199 added `evidence/W3-01.md` only and merged as `ca6b42c47409ff7096f31aeab12624336225ab8f`; no product runtime code changed.

`W2` is complete. W2-08 passed on product SHA `699c923dc50dac5ecd266ced58568d3b647850b6` (tree `449bf34d36c7975addcc2196b87a9a026d525730`) in Windows Tauri run `33470259003`, job `99738402317`, artifact `9786387605`, digest `sha256:3077663cb94c2a444046d94808c76a677c7d92de61a0576f61d5f57b8cd1172d`. Six archetypes were created through production UI, persisted, process-restarted on the same data root, and verified in rendered Full Sheet. The run reproduced and repaired one owner-path gap: Guided Create now materializes initial class tracks and standard/pact spell capacity through the existing progression calculators. W2-01 remains inherited evidence; W2-02 through W2-07 remain verified at `ef2cdf69748195bd63c0bd7eff747420811842bf`.

`W1` is complete. W1-05 through W1-08 passed the real Windows Tauri/WebDriver journey on product SHA `c0900157560ac51a745eac687eb4fff7f2580086` (tree `75f8fc64799a98c22e980dbd102a822555d8c846`), Actions run `33409861843`, job `99546422908`, artifact `9764936861`, digest `sha256:85eda3890fdbc6d28ee0e5155617082642a4e22c1e851a5c73783be59af00b23`.

W1-02 through W1-04 reused the existing Character Creator. Exact canonical verification SHA `42305b1d2a66a976b08844509a63b5999166938a` passed GitHub Actions UI run `33387465586`; no product runtime code was changed. W1-06 alone exposed a real production gap and minimally added distinct UUID identity plus durable duplicate/delete through the existing Character Library owner path; W1-05, W1-07, and W1-08 required no product-code change.

Common Play follows the active function-first direction in `../design/ui-ux/COMMON-PLAY-FUNCTION-FIRST.md`: make the real behavior reachable and observable in Tauri before any broad shell/session visual redesign.

C9 Gate N is integrated into `work/v1-composite` and is no longer an active selection queue. Resolver execution checklists and older Phase/V0.9/V1 handoffs are architecture or historical evidence only.

## Execution rules

1. Read the master roadmap, evidence ledger, and live `work/v1-composite` HEAD before selecting work.
2. Start at the first non-`PASS` unblocked Gate; do not select work from an archived checklist.
3. Fill `EVIDENCE_CARD.md` before changing product code.
4. A `REUSE_LOCKED` or `VERIFY_ONLY` Gate cannot trigger product changes without a reproducible current-HEAD failure or explicit production reachability/contract gap.
5. Reuse the existing Tauri shell, stores, Resolver, transport, presentation pipeline, Party Stash, Long Rest, DM Library, and E2E harness.
6. Do not add branch-writing/self-publishing automation as the normal implementation loop.
7. Structural or protocol-only evidence cannot close rendered Windows behavior.
8. V1 closes only at `72/72`, `100.0/100.0`, `120/120`, all required legacy/MP issue closure, and one matching Windows artifact plus digest.
