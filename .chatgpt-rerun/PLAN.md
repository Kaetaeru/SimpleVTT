# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `1`
- task_id `phase14-production-play-session-ux`
- dispatch recommendation: `continue`

## Preserved validated evidence — do not repeat unchanged boundaries
- Phase13 baseline `7c9440970753a370fec7830cfa691832552e1d05` and prior artifact evidence.
- Ready/start `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571`; UI `31971618534`; Main `31971618703`.
- disconnect/late-join/Host reconnect `84d1d39135c08a2094783fb336a606f294b1cf58`; Phase12 `31972318100`; UI `31972318109`; Main `31972318188`.
- client reconnect/idempotency `cf520d35acd1e21a0247fdeb2d3664ae8a334345`; Phase12 `31973034389`; UI `31973034337`; Main `31973034347`.
- explicit session end/restart `240592cb646bfbbfe9466f94047bc1e2f544dcf9`; Phase12 `31973878162`; Main `31973878165`.
- local projection ownership `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`; UI `31974455354`; Main `31974455339`.
- invalid-entry ghost safety `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`; Phase12 `31974996616`.
- durable-after-end rehydrate `b20ecf18015cec15ad3eb26aba5674e5c91013cb`; Phase12 `31975132450`; Main `31975132458`.
- fresh Character create/save/play/restart `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`; UI `31975560755`; Main `31975560651`.
- fresh Skills `c835963e918cce94bd535054a6553ead7e786262`; UI `31976028376`; Main `31976028381`.
- fresh attack + Dash/session economy `5d48312289e2f01508b3860428ce98e2830d5f26`; UI `31976479248`; Main `31976479264`.
- persisted non-fixture Inventory `c61469c87f6343ff55601e60890d13a58b6a5536`; Persistence `31976901167`; UI `31976901162`; Main `31976901170`.
- persisted non-fixture spellcasting `868b8e37127ea644444630cb45a84f36664912ed`; UI `31977494408`; Main `31977496228`; Contract `31977496255`; Rules `31977496204`.
- P14.8 remote Inventory: validated `00487d6f421a43b15fb5ef77419e87d8182c35d4`, product repair `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`; Phase12 `31979232001`; Main `31979231986`.
- P14.8 remote Fire Bolt: `82933a63846dae55fd4183eef15c22ca3836f082`; Phase12 `31980517723` / `95246365126`; Main `31980517740` / `95246392981`.
- P14.8 remote Arcana/skill: `8f9dcdd083d15be392da1bdefe1e05a9815651ea`; Phase12 `31981974278` / `95250255600`; Main `31981974175` / `95250270963`.
- P14.7 prepared Combatant: `5462d703bbb2d4d41eab934588d7638cb91f6c3e`; product/test `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`; UI `31982491883` / `95251647686`; Main `31982512637` / `95251703554`.
- P14.7 live DM adjudication/event-native Undo: `9c93ad064f8da6dc72b0d0701cc6002171ec3975`; product/test `19602c0b0bdd41a3f284698709c96ec21fd9f06b`; UI `31983195850` / `95253536996`; Main `31983292944` / `95253811047`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Completed this continuation — P14.7 live Combatant theater-of-mind action
Final work/PR head: `e102a82060954f7b3a0fe21054ed8cae4b3daa5b`.
Product/UI boundary: `049102bdaf21a2e9e8771fd4f01274ad9b259eb7`; final commit only adds the focused regression to Main Playable.

### Test-first evidence
- `d23e57ea51229031d7b283c76ecab607104fa5d3` added `tests/ui/productionDmLiveCombatantAction.test.ts` for a non-fixture saved Character plus an imported non-fixture Scout whose real runtime action is `단검`, attack +5, 5ft, `1d4+3` piercing.
- `cdff4069782638612854051074f93a0146f5e3fb` wired it into UI.
- UI `31983955024` / job `95255587231` failed only on the new boundary: `setTheaterOfMindSpatialRelation` did not exist and the production Host surface had no `거리 관계` authoring controls. Existing preceding regressions stayed green to that failure.

### Product repair
- `437973bb1282b09a83070a9c959bfbbd3f2106b9` added `src/app/theaterOfMindSpatialAdapter.ts` and the production `setTheaterOfMindSpatialRelation` command.
- The command requires DM/Host authority, requires Host lifecycle `live`, validates distinct existing source/target actors and a finite non-negative distance, and writes the existing directional `SceneVm.spatialByPair` contract through `setSpatialRelation` with `production:theater-of-mind` provenance.
- It takes explicit `distanceFeet`, `visible`, `cover`, and `targetCanSeeAttacker`; it does not create a silent runtime distance, grid, pathfinder, LOS engine, second Scene, or second persistence source.
- `2cd7bb738a5a3620ea820ef467196a427e6ed98e` composed the adapter into `offlineRuntimeAdapters`. UI `31983993438` / job `95255686018` then proved the real Combatant attack/damage/Activity/Undo half passed; the only remaining failure was visible Host UI exposure.
- `049102bdaf21a2e9e8771fd4f01274ad9b259eb7` added the production Host `거리 관계` surface: source actor, target actor, distance, cover, attacker visibility, target sight, explicit Apply, and refresh. No debug/reference control is required.
- `e102a82060954f7b3a0fe21054ed8cae4b3daa5b` added `Verify Phase 14 live Combatant theater-of-mind action` to Main Playable.

### Exact validation
- UI `31984020502`, frontend job `95255760191` at `049102bdaf21a2e9e8771fd4f01274ad9b259eb7`: **completed success**. New live Combatant regression, existing Phase14 production batch, Phase09 mechanics, named-rule boundary, TypeScript and production build all passed.
- Main Playable `31984131088`, playable-contract job `95256060739` at `e102a82060954f7b3a0fe21054ed8cae4b3daa5b`: **completed success**. Full build, Phase11, Phase12, Phase13, prepared Combatant, live-DM adjudication/Undo, and live Combatant theater-of-mind action all passed.
- The automatically queued Windows job is not the required human two-instance acceptance and is not used to close this slice.

### Proven P14.7 behavior
- Production Host can explicitly author the structured directional relation between a real imported Combatant and the real live Character without debug/reference setup.
- The imported Scout keeps its actual `단검` runtime facts (+5, 5ft, `1d4+3`).
- With the explicitly authored 5ft relation, canonical authoritative attack/damage resolves against the real Character and projects Activity.
- Event-native Undo restores both live Scene Character HP and owning Character HP to the exact pre-resolution value.
- Existing canonical Scene/spatial/runtime/event architecture is reused; no tactical-map scope or alternate authority path was added.

## Architecture constraints preserved
- Owning Client Character Library remains the durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains connected mechanics authority.
- Prepared/imported Combatants are ordinary existing Scene/runtime instances.
- Existing ledger, ResolutionEvent, client apply-before-cursor, duplicate request/event, reconnect, and event-native Undo semantics remain authoritative.
- No fixture fallback, duplicate connected protocol, duplicate durable source, tactical map/grid/path/LOS subsystem, or merge was introduced.

## Checklist documentation note
The authoritative `.agents/PHASE14_CHECKLIST.md` still contains conservative unchecked wording for several boundaries now proven by tests. Because the current connector write is whole-file replacement for that large checklist, do not risk truncation. Credit P14.8 remote action/Inventory/Spell/Skill plus directly proven P14.7 prepared/live-DM/spatial-action statements only when a full-file-preserving edit path is available. Keep broader UX/accessibility, concentration, equipment/attunement and human-acceptance wording open.

## Next Exact Action
1. Do not rerun remote Inventory, Fire Bolt, Arcana, local P14.6 spell, prepared Combatant, live-DM adjudication/Undo, live Combatant spatial-action, or unchanged lifecycle gates unless their relevant source boundary changes.
2. Continue P14.7 test-first at the next uncovered preparation boundary: **session name/current play-mode intent plus rules/content compatibility and active session content must be visible (and name/mode intent editable where required) in the normal Host preparation surface without debug controls**. Inspect existing production lifecycle contracts/UI first and patch only a real gap.
3. Validate only the smallest changed UI/Main boundary once. If that preparation metadata boundary is already fully present, proceed instead to focused P14.7 conditions/typed-defense/reaction/concentration/life-state coverage without repeating prior attack/adjudication tests.
4. Then complete P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head Windows artifact verification.
5. PR #109 remains draft/unmerged. No merge is authorized.
