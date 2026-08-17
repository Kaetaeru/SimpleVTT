# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`; sequence `1`; task `phase14-production-play-session-ux`

## Preserved evidence — do not repeat unchanged boundaries
- Phase13 baseline `7c9440970753a370fec7830cfa691832552e1d05` and recorded artifact evidence.
- Ready/start: `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571`; UI `31971618534`; Main `31971618703`.
- disconnect/late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`; Phase12 `31972318100`; UI `31972318109`; Main `31972318188`.
- client reconnect/idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`; Phase12 `31973034389`; UI `31973034337`; Main `31973034347`.
- explicit session end/restart: `240592cb646bfbbfe9466f94047bc1e2f544dcf9`; Phase12 `31973878162`; Main `31973878165`.
- local projection ownership: `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`; UI `31974455354`; Main `31974455339`.
- invalid-entry ghost safety: `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`; Phase12 `31974996616`.
- durable-after-end rehydrate: `b20ecf18015cec15ad3eb26aba5674e5c91013cb`; Phase12 `31975132450`; Main `31975132458`.
- fresh Character create/save/play/restart: `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`; UI `31975560755`; Main `31975560651`.
- fresh Skills: `c835963e918cce94bd535054a6553ead7e786262`; UI `31976028376`; Main `31976028381`.
- fresh attack + Dash/session-economy: product boundary `5d48312289e2f01508b3860428ce98e2830d5f26`; UI `31976479248`; Main `31976479264`.
- persisted non-fixture Inventory: `c61469c87f6343ff55601e60890d13a58b6a5536`; Persistence `31976901167`; UI `31976901162`; Main `31976901170`.
- persisted non-fixture spellcasting: `868b8e37127ea644444630cb45a84f36664912ed`; UI `31977494408`; Main `31977496228`; Contract `31977496255`; Rules `31977496204`.
- P14.8 host-unknown remote Inventory authority: validated head `00487d6f421a43b15fb5ef77419e87d8182c35d4`; product boundary `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`; Phase12 `31979232001`; Main `31979231986`.
- P14.8 host-unknown remote Fire Bolt authority: validated head `82933a63846dae55fd4183eef15c22ca3836f082`; Phase12 `31980517723` / job `95246365126`; Main `31980517740` / job `95246392981`.
- P14.8 host-unknown remote Arcana/skill authority: validated head `8f9dcdd083d15be392da1bdefe1e05a9815651ea`; Phase12 `31981974278` / job `95250255600`; Main `31981974175` / job `95250270963`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Documentation credit
- Existing documentation-only checklist credit is at `.agents/PHASE14_CHECKLIST.md` commit `119bf5dd029ab7cd4268c908afa1cf28075d16de`.
- Additional P14.8 remote action/Inventory/Spell/Skill evidence is now proven but has not yet been safely credited in the checklist. The current connector path exposes whole-file replacement rather than a narrow patch; do not risk truncating the authoritative checklist. Perform that checkbox update only when the full file can be preserved exactly.
- Keep visible-UI/accessibility, concentration, broad equipment/attunement, Windows human acceptance, and any wording not directly proven unchecked.

## Completed this continuation — P14.7 DM prepared Combatant flow
Final work/PR head: `5462d703bbb2d4d41eab934588d7638cb91f6c3e`.
Product/test boundary is `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`; final head adds only the Main Playable gate for this regression.

### Test-first evidence
- `a41e165f17fe5f22d1b3327a1b2b2ca0c16b92fe` added `tests/ui/productionDmPreparedCombatantFlow.test.ts`.
- `70d58aee68579d0d5dd37a086dd349fe71e7d7d9` wired it into the canonical UI Phase 14 production batch.
- Test-first UI `31982279957` / job `95251090138` failed only in the new prepared-Combatant regression and exposed the intended product gaps:
  1. `removeCombatant` did not exist.
  2. visible Host preparation UI had no Combatant preparation/add/remove controls.
- Existing fresh Character, skills/actions, Inventory, Spell, connection/lobby/Ready and prior lifecycle regressions in the same batch remained green up to that focused failure.

### Product repair
- `ce5ce284c3842ad588e1ad44f0acf8ed7902350c` added `src/app/productionCombatantPreparationAdapter.ts`:
  - removal is allowed only while Host lifecycle is `preparing`;
  - only prepared `.instance-N` Combatant instances can be removed;
  - entity, `actionsByActor`, and `economyByActor` are removed together;
  - current/selected actor falls back safely if the removed Combatant was selected;
  - removal is rejected if a pending Resolution references that Combatant;
  - live-session removal is rejected rather than mutating live state.
- `44a6cddf0815f170d1deb0b52c4fb4b82407043b` exposed the operation through `AppProvider`.
- `d4141b068171c7e89a50623f28225f8d1410f2dd` added visible `Combatant 준비` controls to `ProductionSessionLifecycleBridge`: Definition-based add, prepared-instance roster with AC/HP, remove buttons, and a scroll-safe preparation panel.
- UI at `d4141b…` then proved the visible bridge half was fixed; the remaining failure was test-harness-only because the direct `MockAdapter` regression had not imported the new adapter composition.
- `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175` corrected only that regression import.
- `5462d703bbb2d4d41eab934588d7638cb91f6c3e` wired the same focused regression into Main Playable as `Verify Phase 14 DM prepared Combatant flow`.

### Validation
- UI at product/test boundary `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`: run `31982491883`, frontend job `95251647686`: **completed success**. The new prepared-Combatant regression, all existing Phase 14 production regressions, named-rule boundary, Phase09 mechanics, TypeScript and production build all passed.
- Main Playable at final head `5462d703bbb2d4d41eab934588d7638cb91f6c3e`: run `31982512637`, playable-contract job `95251703554`: **completed success**. Full UI/rules/TypeScript/build, Phase11, Phase12, Phase13, and the new Phase14 prepared-Combatant regression all passed.
- Main's Windows job may run automatically but is not the required two-instance human acceptance and is not used as completion evidence for this slice.

### Proven P14.7 boundary
- Host can enter preparation and instantiate an imported non-fixture Combatant carrying real runtime action data (`단검`, attack +5, `1d4+3`).
- Host can remove that prepared instance before start, with Scene entity/action/economy state removed together.
- Host can re-add the Combatant and start Initiative; the prepared Combatant set survives into the live Scene with runtime action and Initiative economy intact.
- Preparation-only removal is blocked after the session becomes live.
- The production Host preparation surface exposes Combatant Definition add/remove controls without debug/reference setup.
- Existing Ready/start authority and lifecycle semantics are reused; no parallel Scene or session source was introduced.

## Architecture constraints preserved
- Character Library remains the owning Client's durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains mechanics authority for connected actions.
- Prepared Combatants are ordinary existing Scene/runtime instances, not a second Scene model.
- Existing Host ledger, ResolutionEvent, client apply-before-cursor, duplicate request/event and reconnect semantics remain unchanged.
- No fixture fallback, duplicate connected protocol, duplicate Character durable source, tactical map/grid/path/LOS scope, or merge was introduced.

## Next Exact Action
1. Do not rerun remote Inventory, remote Fire Bolt, remote Arcana, local P14.6 spell, prepared-Combatant flow, or unchanged lifecycle gates unless their relevant source boundary changes.
2. When a safe full-file-preserving checklist write is available, credit only P14.8 remote action/Inventory/Spell/Skill statements and P14.7 prepared Combatant/add-remove/prepared-set statements directly proven by the recorded regressions; leave all broader wording unchecked.
3. Continue P14.7 test-first at the next uncovered DM/live-session boundary. Prefer a focused non-fixture live-DM flow proving DM selection + correction/adjudication + Activity/Undo against the actual live Scene/Combatant runtime, reusing existing domain services rather than adding a separate DM protocol.
4. Patch product only if that focused regression exposes a real gap; validate the smallest changed production boundary with UI/Main once.
5. Then continue remaining P14.7 preparation metadata/rules-content visibility if still open, P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.

## 2026-08-17 sequence 1 continuation — P14.7 live DM adjudication and event-native Undo
Final work/PR head: `9c93ad064f8da6dc72b0d0701cc6002171ec3975`.
Product/test boundary: `19602c0b0bdd41a3f284698709c96ec21fd9f06b`; final commit only wires the focused regression into Main Playable.

### Test-first progression
- `dca18fdab2faa5bb726cc2e023c5eb7a2a4f834a` added `tests/ui/productionDmLiveAdjudicationFlow.test.ts` for a non-fixture persisted Character in local production DM play plus an imported runtime Combatant.
- `9b99b1693d520f1244658b7aa35bc9415b2bb7be` wired it into UI's Phase 14 production batch.
- UI `31982909260` / job `95252768878` first exposed a test-only stage assumption: the production runtime may complete the atomic attack earlier than the fixed staged sequence expected by the new test. `6c525f0d2132794df749fdfa32228516296918b0` corrected only that test contract.
- UI `31982959450` / job `95252900407` then showed that a newly instantiated Combatant has no pairwise structured spatial relation, so canonical runtime targeting correctly rejects an attack. This is a separate live placement/spatial-input gap rather than an adjudication gap; no arbitrary product default distance was invented.
- `ef35ad26d851b19455b5ad346b1fc797c3b6c85d` supplied an explicit 5-foot structured spatial fact in the regression, but initially wrote it to a snapshot clone. UI `31983017304` / job `95253054490` confirmed that test-only mistake.
- `cfa445c86280522f270c387646e65e4bcfce20bb` applies the explicit structured relation to the authoritative adapter Scene so the regression isolates live-DM adjudication rather than map/placement behavior.
- UI `31983078395` / job `95253218046` then exposed the real product gap: canonical attack and DM damage correction both committed, but event-native Undo left Combatant HP at `10` instead of restoring `20`. The correction had directly mutated HP outside the runtime resolution event history, so the original attack event saw state drift and refused to reverse.

### Product repair
- `b21e21ac3ec1cf52923cfdbdd2cb97e97477b3aa` added `src/app/dmAdjudicationResolutionEventAdapter.ts`.
- For post-commit `damage-correction` / `healing-correction` with a matching runtime resolution history, it preserves the existing adjudication/UI Activity behavior and appends a canonical `dm-correction` ResolutionEvent to the same resolution history.
- The correction event carries explicit HP before/after and provenance. Combatant HP is session-runtime/session write-back; Character HP is character-durable/character write-back.
- Existing event-native Undo therefore validates and reverses the correction first, then the original resolution in reverse event order. No snapshot fallback, parallel DM protocol, or second event history was introduced.
- `19602c0b0bdd41a3f284698709c96ec21fd9f06b` installs the adapter in canonical `offlineRuntimeAdapters` immediately after the real runtime attack adapter.
- `9c93ad064f8da6dc72b0d0701cc6002171ec3975` adds `Verify Phase 14 live DM adjudication and Undo` to Main Playable.

### Exact validation
- UI `31983195850`, frontend job `95253536996` at product/test boundary `19602c0b0bdd41a3f284698709c96ec21fd9f06b`: **completed success**. The prepared/live-DM Phase14 production batch, existing production regressions, Phase09 mechanics, TypeScript and production build all passed.
- Main Playable `31983292944`, playable-contract job `95253811047` at final head `9c93ad064f8da6dc72b0d0701cc6002171ec3975`: **completed success**. Full UI/rules/TypeScript/build, Phase11, Phase12, Phase13, prepared Combatant, and the new live-DM adjudication/Undo step all passed.
- The automatically started Windows job is not the required human two-instance acceptance and is not used to close this slice.

### Proven P14.7 live-DM boundary
- Local production DM play does not require reference Aelar/Mira; a non-fixture saved Character is the live player actor.
- DM can safely select the real player actor and an instantiated non-fixture Combatant.
- With an explicit authoritative spatial relation supplied, the real Character's canonical runtime attack resolves against the live Combatant and projects Activity.
- DM post-commit damage correction changes the live Combatant, marks the Resolution adjudicated, and creates correction Activity with the supplied reason/ruling.
- Event-native Undo now reverses both the DM correction and the original canonical attack back to the exact pre-resolution HP, then records the Resolution Undo Activity.
- The fix extends the existing canonical runtime ResolutionEvent history rather than bypassing it.

### Explicit remaining gap discovered but not patched in this slice
- A newly instantiated Combatant does not automatically have a pairwise structured spatial relation to the live Character. Canonical runtime targeting therefore rejects an attack until an authoritative relation is supplied.
- The regression intentionally supplies a test-only structured 5-foot relation to isolate adjudication. It does **not** establish an arbitrary product distance default and does not add tactical map/grid/path/LOS scope.
- This gap directly blocks a no-debug live walkthrough in which the instantiated Combatant actually attacks a real Character, so it is the next focused P14.7 boundary.

## Next Exact Action after live-DM adjudication completion
1. Do not rerun the live-DM adjudication/Undo regression, prepared-Combatant flow, remote Inventory/Fire Bolt/Arcana, local P14.6 spell, or unchanged lifecycle gates unless their relevant source boundary changes.
2. Continue P14.7 test-first on **live Combatant action placement/targeting without debug setup**. First inspect whether an existing production theater-of-mind distance/spatial-relation input can author the required pairwise relation. If it exists, prove an instantiated non-fixture Combatant can use its actual runtime action against the real live Character through that visible/production path. If no such production path exists, add only the smallest explicit theater-of-mind relation input required for legal targeting; do not invent silent default distances and do not expand into tactical map/grid/path/LOS scope.
3. In that focused regression also verify the Combatant action uses its imported definition/runtime facts, canonical authoritative attack/damage services, Activity, and event-native Undo. Patch product only for gaps the regression actually exposes.
4. After that, continue remaining unchecked P14.7 preparation metadata/rules-content visibility and broader conditions/typed-defense/reaction/concentration/life-state coverage as directly required, then P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
5. When a safe full-file-preserving checklist write is available, credit only P14.7/P14.8 statements directly proven by recorded regressions; keep broader wording unchecked.
6. PR #109 remains draft/unmerged. No merge is authorized.
