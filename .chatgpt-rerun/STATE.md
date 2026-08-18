# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`af19378149db97387e3cd364b38fe17e95078b39`

PR #109 was rechecked before each source write. All writes were fast-forward contents commits on `agent/108-production-play-session-ux`; the PR remains open/draft/unmerged.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

GitHub control, STATE and PLAN reconciled to:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- dispatch `continue`
- starting work HEAD `2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`

`main` resolved to coordination commit `9b9f3e8e703deb57c6efb5f63e7190804fe5bba6`. Validated Play/Dice/VFX/Appearance/dual-Sheet/direct-IP work was not repeated and the content-parity architecture audit was not restarted.

## Work completed in this execution
### Diagnosed the exact parity CI failure
The prescribed GitHub `gh-fix-ci` skill was used. The active container still lacked `gh`; package/download attempts could not obtain it because the container could not reach external package/download hosts. The GitHub plugin available in this conversation exposes a decoded workflow-job log action, so that specific failing Actions job was inspected directly rather than guessing from the red summary.

Original content-parity HEAD `2c57c570...`, Phase 12 run `32178687847`, job `95846416201`:
- 45 existing connected tests passed;
- only the three newly added parity tests failed;
- observed failures showed the parity transport decorator was bypassed after the test fake transport replaced `send/onMessage/sendTo`.

### Narrow source/test fixes
1. `fa7a50abbbf8aea06d9c02dc4840e0a694afb71e` — `Rebind content parity transport decorator`
   - `sessionContentParityRuntimeAdapter` now re-binds its thin transport decorator at Host/Join entry if a runtime/test delegate replacement removed it;
   - production path remains a no-op when the decorator is already installed;
   - this fixed the conflict and malformed-content tests, reducing the connected gate from three failures to one.

2. `60d98601a2e2f76316f531f11b2d8b7bbfa50b1a` — `Refresh projection after content parity sync`
   - after validated installed-content sync/recomposition, the Client re-handshake rebuilds its current compatibility manifest and Character SessionProjection from the recomposed catalog.

3. `f22291a3b38a1451e54a3d76cc4fe068148f31c0` — `Send parity rehello from synced client`
   - the post-install re-handshake uses the explicit Client adapter already owned by the parity preflight rather than resolving through process-global `activeAdapter` again.

4. `af19378149db97387e3cd364b38fe17e95078b39` — `Use canonical Character in parity handshake test`
   - the focused test fixture now derives builtin class/species/background identities from the generated catalog and removes old mock-only subclass/item selections;
   - this isolates content parity from unrelated legacy Mock Character projection incompatibility while retaining the real Character SessionProjection contract.

No validator, repository, Host ledger, ResolutionEvent, Character authority, or transport protocol was replaced.

## Content-parity behavior now validated
At exact HEAD `af193781...`:
- Client hello advertises installed declarative content identity/revision inventory;
- Host compares against its installed declarative content and sends only missing/changed entries;
- Host does not accept the participant before parity completes;
- Client validates and installs through existing `validateInstalledContentPackage` + `InstalledContentRepository.installMany` + existing catalog recomposition;
- Client re-handshake advertises the newly installed revision and a refreshed Character SessionProjection;
- matching Host inventory produces no second transfer;
- same-qualified-identity different payload fails closed without overwrite;
- malformed Host declarative payload fails before install;
- Ready remains blocked until parity is ready;
- reconnect/matching replay does not change installed-content storage revision;
- peer content remains declarative JSON only; no Host-provided JS/native execution path exists.

## Validation evidence for exact head `af193781...`
### Phase 12 Connected Session
- run `32186178904`
- connected-protocol job `95870203173`: **success**
  - `Verify connected-session authority protocol`: success, including all 48 tests and focused parity cases;
  - `Verify Phase 11 offline walkthrough remains green`: success;
  - `Verify production frontend gate`: success.
- Windows connected playable job `95870544914`: **in progress** at checkpoint time. It has just started; do not rerun it manually on watcher restart. Record its eventual result next invocation.

### UI
- run `32186178947`
- frontend job `95870203434`: **success**
- all reported UI/product regression steps: success
- `Typecheck and build`: **success**

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.

Watcher restart alone is not a reason to rerun any of these seven boundaries.

## Next Exact Action
1. Perform mandatory preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `af193781...`, do not repeat any validated V0.9 slice or the parity diagnosis.
3. Check Phase 12 Windows job `95870544914` and record its final result; do not manually rerun it if already complete.
4. Resume the next incomplete V0.9 presentation slice: **Character portrait + DM image handout/reconnect**.
5. Preserve owning-Client Character persistence for portrait data and keep handout data connected presentation state only.
6. Portrait: bounded local PNG/JPEG/WebP, preview, replace/remove, crop/focal preference, durable Character persistence and offline/restart safety.
7. DM handout: contextual local image preview → explicit reveal → withdraw; Client dismiss/minimize/reopen; reconnect restores current reveal; no cloud/public URL requirement.
8. Do not introduce ResolutionEvent/Undo/combat state or tactical map/grid/token/Fog/path/LOS semantics for images.
9. Add focused tests and run only affected gates first.
10. After portrait/handout exact-head green, continue contextual DM/Content/Rules polish and dead-legacy cleanup.
11. Later obtain one full exact-head automated validation set plus human Windows acceptance.
12. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN for this checkpoint was written first on `main` as commit `61dd6787d8ff000d5d21a38a9184fcf74cfa6bb8`.
- STATE is this durable checkpoint and is written after PLAN.
- STATUS may be refreshed next for human visibility.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
