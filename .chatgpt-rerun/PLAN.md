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
- P14.8 remote Inventory validated `00487d6f421a43b15fb5ef77419e87d8182c35d4`, product repair `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`; Phase12 `31979232001`; Main `31979231986`.
- P14.8 remote Fire Bolt `82933a63846dae55fd4183eef15c22ca3836f082`; Phase12 `31980517723` / job `95246365126`; Main `31980517740` / job `95246392981`.
- P14.8 remote Arcana/skill `8f9dcdd083d15be392da1bdefe1e05a9815651ea`; Phase12 `31981974278` / job `95250255600`; Main `31981974175` / job `95250270963`.
- P14.7 prepared Combatant final `5462d703bbb2d4d41eab934588d7638cb91f6c3e`; product/test `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`; UI `31982491883` / job `95251647686`; Main `31982512637` / job `95251703554`.
- P14.7 live DM adjudication/event-native Undo final `9c93ad064f8da6dc72b0d0701cc6002171ec3975`; product/test `19602c0b0bdd41a3f284698709c96ec21fd9f06b`; UI `31983195850` / job `95253536996`; Main `31983292944` / job `95253811047`.
- P14.7 live Combatant theater-of-mind action final `e102a82060954f7b3a0fe21054ed8cae4b3daa5b`; product/UI `049102bdaf21a2e9e8771fd4f01274ad9b259eb7`; UI `31984020502` / job `95255760191`; Main `31984131088` / job `95256060739`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Completed this continuation — P14.7 Host preparation metadata/rules-content visibility
Final work/PR head: `f155943d62efbbd6718f2b4b2b864031232d60cb`.
Product/test boundary: `bcb101a258ea36d7fbeaae38b2c9621b044463c2`; final commit only adds the focused regression to Main Playable.

### Investigation and test-first evidence
- The production Host surface already had an editable start-mode intent selector and visible compatibility/message, but session name was display-only and `sessionContent` was not rendered.
- The inherited MockAdapter session metadata was reference-only: name `금요일 세션` and session content `Homebrew 0.1 · 철벽 수호자`. Rendering it directly would have leaked fixture metadata into the normal production preparation path.
- `88df560cdf10fb3383e36f046ed759339d1d3bb4` added `tests/ui/productionSessionPreparationMetadata.test.ts`.
- `2d8cefab2052eba122930c5cce36fa8e4948d996` added the focused UI workflow step.
- Test-first UI `31984575423` / frontend job `95257217287` failed only at the new boundary: production Host retained the fixture name instead of `새 플레이 세션`, and the visible Host surface had no `세션 이름` control.

### Product repair
- `2feda6b8ac280c8a01752cdfc4b886b48a69ea1d` updated `productionSessionLifecycleAdapter.ts`:
  - adds preparation-only `setPreparedSessionName`, trims input and rejects empty/>80-character names or live-session edits;
  - replaces the reference/blank Host name with `새 플레이 세션` when opening a production preparation lobby;
  - exposes the real Host `rulesProfileId` from `connectedManifest`;
  - derives active session content from the existing composed catalog, excluding known reference fixture local entries instead of copying inherited `sessionContent`;
  - refreshes this metadata for Host preparing/live snapshots without adding a protocol or persistence source.
- `bcec41348cb03114febd28f4f856d2977dd89149` updated `ProductionSessionLifecycleBridge.tsx` with visible preparation-only session-name editing, RulesProfile, active-content list/empty state, labeled start-mode intent, and existing compatibility message. Hook order remains stable and existing Combatant/spatial controls are preserved.
- UI `31984659940` / job `95257442658` then passed the visible-surface assertion; its only remaining failure was test-contract-only because the new installed-content payload lacked the production-required stable `sourceId`.
- `bcb101a258ea36d7fbeaae38b2c9621b044463c2` corrected only the regression payload to use valid installed-content identity.
- `f155943d62efbbd6718f2b4b2b864031232d60cb` added `Verify Phase 14 Host preparation metadata and active content` to Main Playable.

### Exact validation
- UI `31984703963`, frontend job `95257557757` at product/test boundary `bcb101a258ea36d7fbeaae38b2c9621b044463c2`: **completed success**. Focused preparation metadata, existing Phase14 production batch, Phase09 mechanics, named-rule boundary, TypeScript and production build all passed.
- Main Playable `31984772749`, playable-contract job `95257747960` at final head `f155943d62efbbd6718f2b4b2b864031232d60cb`: **completed success**. Full build plus Phase11, Phase12, Phase13, prepared Combatant, live-DM adjudication/Undo, live Combatant spatial action, and Host preparation metadata all passed.
- The automatically queued Windows job is not the required human two-instance acceptance and is not used as completion evidence.

### Proven P14.7 behavior
- Normal production Host preparation no longer exposes the reference session name or reference local-content fixture metadata.
- Session name is visible and editable only while preparing; empty names and live-session rename attempts are rejected.
- Current play-mode intent is visible/editable before start.
- Real Host RulesProfile, compatibility result/message, and currently composed non-reference local content are visible before start.
- Existing installed-content catalog persistence remains the source of local content; session metadata is an ephemeral Host preparation projection.
- No duplicate connected protocol, second content store, fixture fallback, tactical-map scope, or merge was introduced.

## Architecture constraints preserved
- Owning Client Character Library remains the durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains connected mechanics authority.
- Existing connected ledger, ResolutionEvent, client apply-before-cursor, reconnect/idempotency and event-native Undo remain authoritative.
- Installed content remains owned by the existing installed-content repository/catalog composition; Host preparation only projects metadata from it.
- No fixture fallback, duplicate durable source, tactical map/grid/path/LOS subsystem, or merge was introduced.

## Checklist documentation note
`.agents/PHASE14_CHECKLIST.md` remains intentionally conservative because the current connector update path replaces the whole large file. Do not risk truncation. On a safe full-file-preserving edit, credit directly proven P14.7 preparation metadata, prepared/live-DM/spatial-action and P14.8 remote action/Inventory/Spell/Skill wording only; keep broader UX/accessibility, concentration, equipment/attunement and human-acceptance wording open.

## Next Exact Action
1. Do not rerun remote Inventory/Fire Bolt/Arcana, local P14.6 spell, prepared Combatant, live-DM adjudication/Undo, live Combatant spatial-action, Host preparation metadata, or unchanged lifecycle gates unless their relevant source boundary changes.
2. Continue P14.7 test-first at the remaining live-DM mechanics boundary: **conditions, typed defenses, reactions, concentration, life state, Activity, and event-native Undo must remain functional for a non-fixture real live Scene/Combatant path**.
3. Start with a focused regression that reuses existing production/domain services and real non-fixture actors. Prefer the smallest representative chain that can prove multiple listed mechanics without adding a parallel DM/runtime path; patch only gaps the regression exposes.
4. Validate only the smallest changed UI/Main boundary once.
5. Then continue P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head Windows artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.
