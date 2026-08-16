# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved completion

Phase 13 remains complete and is not reset by unfinished Phase 14 work.

- Phase13 implementation head `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` success.
- Preserved Windows artifact `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.
- Reusable Phase14 evidence unless its source boundary changes:
  - PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
  - Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
  - saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226` success.
  - fresh non-fixture local production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422` success.
  - repaired core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862`: UI `31970228863`/`31970230351`, Contract `31970230345`, Phase11 `31970230344`, Phase12 `31970230336`, Main `31970230364` success.

Do not repeat focused gates unless the relevant source changes.

## Phase 14 authority constraints

Normal product play must use user-created/persisted Characters and visible production UI, not Aelar/Mira/fixed goblin ids/reference shortcuts. Reuse Tauri transport, Host ledger, compatibility handshake, SessionProjection, event cursor/catch-up, ActionRequest/ResolutionEvent and owning-client durable write-back. Shared session state remains Host-authoritative; permanent Character ownership remains with the owning player. Do not add tactical map/grid/path/LOS scope.

## Ready/start implementation in this continuation

Current work head: `04ceba160ac84052866f5b7fc91e4c69ab1db527`.

The Ready/start slice was implemented on top of the existing Host-authoritative `mode-transition` path:

1. `b4d1d77e795db66afba1f28e000d17bf83706bdc` structured participant events with participant identity, connection state and explicit `ready:boolean`.
2. `99a5e01583c9d28530529bf30fc33527efce0cee` added `ready-intent` wire input without a client-supplied participant id, so the Host binds Ready to the transport peer rather than trusting spoofable identity.
3. `ae5cbd63932ef1ecc85db0d91bcdce10a75b539e` added peer->participant authority mapping and connected-session `sessionStarted` state.
4. `64f426f092e2de4678bf1b9ebafd48478b61ff5d` routes Ready through Host validation/ledger/event-batch; hello/reconnect establishes participant state with Ready reset; clients apply authoritative participant events. `ready-intent-v1` is a required connected capability.
5. `c3d6d1b5057be5309c763fab01d3983d2ff44fa1` exposed the existing Host turn/mode projection helper instead of creating a duplicate mode channel.
6. `1b88cfae5d3c8f3d1fe00dbc5b7420efc97493a7` added production `setSessionReady(ready)` and `startPreparedSession(mode)`. Host Start requires at least one non-host player and every player must be connected, Ready and bound to an accepted compatible peer manifest. Host itself is excluded from player readiness. Initiative reuses `startInitiative`; Freeform explicitly publishes the existing `mode-transition` projection.
7. `98f1820f4ee9699c121ecd3f3acba6cc8e048f64`, `1177ac2c02aac33e170eb6e02e0a1054a1abf66c`, `263ad566a37caee4af1f6db877f2261662fba063` expose the lifecycle controls through AppProvider and visible Player Ready/취소 plus Host participant readiness/mode/Start UI.
8. `83646e0071209859202a3eff6606458ee46df55a`, `5c7c1e271c4944ca8252a6cbc149c0fdc9a4ece0`, `a208f87f2e95838c3d011ac9e3420605d254c980` add wire/lifecycle authority regressions and include the production lifecycle test in the Phase12 canonical gate.

### Validation at `a208f87f...`

- Phase12 run `31970977017`, job `95223275319`: `connected-protocol` success. The Ready/start authority batch passed, then Phase11 preservation passed, then production frontend build passed.
- UI run `31970977035`, job `95223275314`: Phase14 Host/lifecycle tests, Phase09 mechanics and final TypeScript/production build all passed. The job was only completing post-actions when last fetched; all load-bearing test/build steps were success.
- Main Playable `31970977130`: full UI/build, Phase11 and Phase12 passed; only `Verify Phase 13 arbitrary Character SessionProjection` failed.

The Main failure was fixture capability drift, not a product authority failure. `connectedProjectedCharacterResolution.test.ts` hard-coded the pre-Ready capability list, so its projected remote ActionRequest omitted required `ready-intent-v1` and was correctly rejected by current production routing. `04ceba160ac84052866f5b7fc91e4c69ab1db527` migrated that test to `CONNECTED_CAPABILITIES` for both manifest and request. New exact-head Main run `31971251262` was queued at checkpoint time and must be fetched before crediting Main green or checklist completion.

## Next Exact Action

1. Fetch exact-head Main Playable run `31971251262` for `04ceba160ac84052866f5b7fc91e4c69ab1db527`. If the Phase13 arbitrary Character SessionProjection step and preceding gates are green, record the exact evidence; if red, inspect only that failing step.
2. Reconcile the exact-head Phase12/UI runs generated for `04ceba...` only if necessary. The only source difference from `a208f87f...` is the Phase13 test capability fixture, so do not rerun unrelated product gates manually.
3. Before crediting P14.8 Ready/start checklist boxes, add/verify the remaining lifecycle safety boundary: the Host transport reports aggregate `peerCount` but not the disconnected peer identity. A Host must never start from stale Ready after a player disconnects. Conservatively reset/disconnect player readiness when Host peer count drops if exact peer identity is unavailable, then require re-handshake/re-Ready. Add a focused regression.
4. Add a focused `startPreparedSession("freeform")` regression if not already covered by an equivalent production lifecycle test; Initiative is directly tested now, while the reusable mode-transition machinery already has historical Freeform coverage.
5. After disconnect stale-Ready safety and both start modes are exact-head green, update `.agents/PHASE14_CHECKLIST.md` for Ready/start only to the evidence actually proved.
6. Then continue participant late join/disconnect/reconnect, explicit session end/restart, local-active-Character projection cleanup, and Windows two-instance release walkthrough.

Known separate risk: switching two non-fixture local Characters can leave a stale previous local projection in `productionPlayRuntimeAdapter`; any fix must preserve remote ephemeral SessionProjection actors.

Draft PR #109 remains open/draft. No merge is authorized or attempted.
