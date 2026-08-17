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
- fresh Character `8b162dd3b45e77f5a742badcdd7f03d613321497`; Skills `c835963e918cce94bd535054a6553ead7e786262`; attack/Dash `5d48312289e2f01508b3860428ce98e2830d5f26`; Inventory `c61469c87f6343ff55601e60890d13a58b6a5536`; spellcasting `868b8e37127ea644444630cb45a84f36664912ed`, with recorded green gates.
- P14.8 remote Inventory `00487d6f421a43b15fb5ef77419e87d8182c35d4`; remote Fire Bolt `82933a63846dae55fd4183eef15c22ca3836f082`; remote Arcana/skill `8f9dcdd083d15be392da1bdefe1e05a9815651ea`, with their recorded Phase12/Main jobs.
- P14.7 prepared Combatant `5462d703bbb2d4d41eab934588d7638cb91f6c3e`; UI `31982491883` / `95251647686`; Main `31982512637` / `95251703554`.
- P14.7 live DM adjudication/event-native Undo `9c93ad064f8da6dc72b0d0701cc6002171ec3975`; UI `31983195850` / `95253536996`; Main `31983292944` / `95253811047`.
- P14.7 live Combatant theater-of-mind action `e102a82060954f7b3a0fe21054ed8cae4b3daa5b`; UI `31984020502` / `95255760191`; Main `31984131088` / `95256060739`.
- P14.7 Host preparation metadata/content `f155943d62efbbd6718f2b4b2b864031232d60cb`; UI `31984703963` / `95257557757`; Main `31984772749` / `95257747960`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Completed this continuation — P14.7 live mechanics continuity
Final mechanics-only work head: `fb94d8014c729be2fa39a55aca5246618fe81214`.
Test/UI boundary: `f0f12094069b3c11c33a07e3ac2c8da84dd63e37`.

### Test-first evidence
- `ac0a2cdd53a7c1230a7881015374dfe046c7b0a1` added `tests/ui/productionDmLiveMechanicsContinuity.test.ts`.
- The focused regression uses a saved non-fixture Character `char.phase14.mechanics-player` plus imported non-fixture Combatant `combatant.phase14.mechanics-scout` with its real runtime dagger (+5, 5ft, `1d4+3` piercing).
- It seeds canonical runtime effects for `grappled`, piercing resistance, and concentration; executes the imported Combatant's real dagger as an opportunity reaction; drives the Character to 0 HP; verifies typed damage adjustment, reaction economy, life state, concentration termination, Activity state changes, event-native Undo restoration, then canonical condition removal + Undo restoration.
- `f0f12094069b3c11c33a07e3ac2c8da84dd63e37` added the regression to UI.

### Outcome
- No product repair was required. The existing canonical runtime composition already preserved all listed mechanics for non-fixture live actors.
- UI `31985185688`, frontend job `95258850432` at `f0f12094069b3c11c33a07e3ac2c8da84dd63e37`: **completed success**, including the new regression, existing Phase14 batch, Phase09 mechanics, named-rule boundary and production build.
- `fb94d8014c729be2fa39a55aca5246618fe81214` added the same focused regression to Main Playable.
- Main Playable `31985232843`, playable-contract job `95258989930` at `fb94d8014c729be2fa39a55aca5246618fe81214`: **completed success** across build, Phase11/12/13 and all gated Phase14 slices.
- The Windows job from that run was not human two-instance acceptance and was not used as completion evidence.

### Proven P14.7 behavior
- A non-fixture imported Combatant uses its actual runtime attack as a reaction against a non-fixture real Character.
- Runtime typed resistance reduces authoritative damage.
- 0 HP produces authoritative unconscious/not-dead life state.
- Concentration and its dependent effect terminate authoritatively on the damaging/life-state path.
- Independent condition state remains intact until explicitly removed.
- Activity records reaction economy, life-state and concentration state changes.
- Event-native Undo restores HP, life state, reaction economy, concentration/effects and condition state exactly.
- No fixture fallback, snapshot rollback, second resolution protocol, or second event history was added.

## Completed this continuation — P14.10 production play workspace accessibility structure
Final work/PR head: `06d75afc077e6d0d4982a31710015825e4e575b2`.
Product/UI boundary: `9494bfb1e4813130be72a3bc62e87e4ee54f25ab`; final commit only adds the focused accessibility regression to Main Playable.

### Investigation and test-first evidence
- `PlaySessionDock.tsx` existed and had semantic buttons, focus-triggered action detail, explicit empty states and disabled reasons, but it was not mounted by `main.tsx`/`App.tsx` at all.
- No dedicated play-dock CSS existed, so no viewport-bounded workspace/internal-scroll/focus-visible contract existed for the dormant component.
- Existing reduced-motion CSS already disables dice animation under `prefers-reduced-motion`.
- `43c046a3ed902cf95da580f505c2cccfe4cbdae3` added `tests/ui/productionPlayWorkspaceAccessibility.test.ts`.
- `3677cbeec96871bb13c19e900fdb72d4d55d3846` added the focused UI gate.
- Test-first UI `31985442280` / job `95259543447` failed at the new step because `src/play-session-dock.css` did not exist; preceding named-rule/PlaySessionDock structure checks stayed green.
- `ffee41654fbf0ef2df90781461e0b61419ce0609` strengthened the regression to require non-reference production Character entry rather than exposing fixture Characters after mount.

### Product repair
- `9a6fe55019cae664815bc91cbf28f1939afc7d74` added `src/play-session-dock.css`:
  - fixed, viewport-bounded dock with `max-height: calc(100vh - ...)`;
  - `minmax(0,1fr)` body row plus internal `overflow-y:auto`;
  - responsive width/layout rules;
  - explicit active/selected/disabled states;
  - explicit `:focus-visible` treatment for buttons/summary/launcher;
  - internal horizontal scrolling for Character choices and responsive action/inventory layout.
- `543d62facc1663e2e0ba4d7f473c10842675863b` made `PlaySessionDock` use `productionJoinCharacters` only, prevents reference Character choice/header/action fallback, disables local start until a saved production Character is active, gives explicit no-saved-Character guidance, and clears keyboard action detail on blur.
- `9494bfb1e4813130be72a3bc62e87e4ee54f25ab` imports/mounts `PlaySessionDock` and its CSS in the real production root composition.
- UI push run `31985536934`, frontend job `95259805820` at `9494bfb1e4813130be72a3bc62e87e4ee54f25ab`: **completed success**. Accessibility structure, existing P14.7 mechanics, existing Phase14 production batch, Phase09 mechanics, named-rule boundary, TypeScript and production build all passed.
- `06d75afc077e6d0d4982a31710015825e4e575b2` adds `Verify Phase 14 production play workspace accessibility structure` to Main Playable.
- Main Playable `31985665543`, playable-contract job `95260172166` at `06d75afc077e6d0d4982a31710015825e4e575b2`: **completed success**. Full build, Phase11, Phase12, Phase13, all currently gated P14.7 slices, and the new P14.10 structure gate passed.
- Main Windows job `95260427568` was automatically running at checkpoint time. It is not the required human two-instance acceptance and is not used to close P14.10/P14.13.

### Proven P14.10 behavior
- The real production root now mounts the production Play workspace without Debug Dock access.
- Reference Aelar/Mira fixtures are not offered as production Play choices by the mounted dock.
- Saved non-reference Character selection/start guidance is explicit.
- The dock is bounded to the viewport; long play content scrolls inside the intended body rather than escaping the window.
- Tabs/actions/targets/close controls remain native keyboard-focusable controls; action hover detail is also focus-accessible and now clears on blur.
- Selected/active, disabled and focus-visible states have distinct CSS treatment.
- Existing reduced-motion CSS disables dice animation under the OS reduced-motion preference.
- Human viewport/interaction acceptance is still required; this automated structural slice does not claim the full P14.10 gate.

## Architecture constraints preserved
- Owning Client Character Library remains the durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains connected mechanics authority.
- Existing Scene/spatial/runtime, ResolutionEvent, turn-runtime effects, ledger, reconnect/idempotency and event-native Undo paths remain authoritative.
- `productionJoinCharacters` remains the normal no-fixture Character entry policy for the newly mounted Play workspace.
- No duplicate connected protocol, second durable source, tactical-map subsystem, fixture fallback, or merge was introduced.

## Checklist documentation note
`.agents/PHASE14_CHECKLIST.md` remains intentionally conservative because the connector path replaces the entire large file. Do not risk truncation. A safe full-file-preserving documentation pass may later credit directly proven P14.7 mechanics and P14.10 structural wording. Human viewport/two-instance acceptance stays open.

## Next Exact Action
1. Do not rerun remote Inventory/Fire Bolt/Arcana, local P14.6 spell, prepared Combatant, live-DM adjudication/Undo, live Combatant spatial action, Host preparation metadata, live mechanics continuity, or the mounted Play-workspace accessibility gate unless their relevant source boundary changes.
2. Continue P14.10 test-first on the remaining production UX boundary after mounting the dock: **verify role/surface scoping plus explicit loading/error/reconnecting guidance and routine no-debug operation**, ensuring the player-oriented dock does not intrude on the Host/DM preparation/live surface and all routine paths remain understandable without `Ctrl+Shift+D`.
3. Reuse existing lifecycle/connection state; patch only a real UX gap. Preserve the already-proven viewport/scroll/focus/reduced-motion behavior.
4. Record the required human viewport/keyboard interaction walkthrough separately; automated structure evidence is not a substitute for the human P14.10/P14.13 gates.
5. Then perform Windows two-instance human acceptance and, only after the source head is final, exact-head Windows artifact verification/digest/content inspection.
6. PR #109 remains draft/unmerged. No merge is authorized.
