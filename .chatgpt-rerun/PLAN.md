# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `continue`

## Authoritative product reference
Use `.agents/V0_9_PRODUCT_REFERENCE.md` (reference commit `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`). Preserve canonical React/runtime architecture, owning-Client Character durability, Host mechanics authority, ResolutionEvent/reconnect/idempotency, installed-content/RuleModule authority and existing Scene/action runtime.

## Architecture invariants
- one canonical Character; owning Client Character Library is durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/RuleModule validation remain content authority;
- no second Character/content store, resolver, network/content protocol or event ledger;
- no Host-provided arbitrary JS/native execution;
- images/portraits/handouts remain presentation state, not combat/ResolutionEvent authority;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud-account dependency;
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`af19378149db97387e3cd364b38fe17e95078b39`

Latest source commit: `Use canonical Character in parity handshake test`.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting at `e83fc37...`.
6. Direct-IP Session entry at `0b7bce05...`.
7. **Automatic validated Host-required declarative content parity before Ready** at `af193781...`:
   - Client hello advertises installed declarative content identity/revision inventory;
   - Host transfers only missing/changed installed declarative entries before participant acceptance;
   - Client validates/installs through existing `validateInstalledContentPackage` + `InstalledContentRepository` + catalog recomposition and re-handshakes;
   - re-handshake advertises the newly installed revision and refreshes the Character SessionProjection from the recomposed catalog;
   - same-qualified-identity conflicts and malformed Host payloads fail closed and keep Ready blocked;
   - matching reconnects do not re-transfer content;
   - no second content store/protocol/resolver and no Host-provided JS/native execution.

## Validation evidence
### Direct-IP head `0b7bce05...`
- UI run `32177587540` / frontend `95842950322`: **success**.
- Phase 12 run `32177587541` / connected-protocol `95842949930`: **success**.
- Windows connected playable job `95843208485`: **success**.

### Content-parity exact head `af193781...`
- Phase 12 Connected Session run `32186178904` / connected-protocol job `95870203173`: **success**.
  - connected-session authority protocol, including all 48 tests and focused parity coverage: success;
  - Phase 11 offline walkthrough: success;
  - production frontend gate: success.
- UI run `32186178947` / frontend job `95870203434`: **success**.
  - all reported UI/product regressions: success;
  - `Typecheck and build`: success.
- Same Phase 12 run Windows job `95870544914` is currently **in progress**. Record its eventual result next invocation; do not manually rerun it merely because watcher execution restarts.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if PR #109 or `main` advanced.
2. If work HEAD remains `af193781...`, do **not** repeat Play/Dice/VFX/Appearance/dual-Sheet/direct-IP/content-parity validation or design audit.
3. Check the eventual result of Windows job `95870544914` from Phase 12 run `32186178904`; record it without manually rerunning if already complete.
4. Resume the next incomplete V0.9 presentation slice: **Character portrait + DM image handout/reconnect**.
5. Character portrait requirements: local PNG/JPEG/WebP selection, bounded validation, preview, replace/remove, crop/focal preference, owning-Character persistence, offline/restart safety, and no new Character authority/store.
6. DM handout requirements: contextual `이미지 보여주기`, local validated image preview, explicit reveal/withdraw, connected Client dismiss/minimize/reopen, reconnect restoration of the active reveal, and no public URL/cloud dependency.
7. Handout state must remain connected presentation state only: no ResolutionEvent/Undo/combat semantics and no tactical map/grid/token/Fog/path/LOS behavior.
8. Add focused tests around persistence/bounds and reveal/withdraw/dismiss/reopen/reconnect, then run only affected gates first.
9. After portrait/handout exact-head green, continue contextual DM/Content/Rules polish and dead-legacy cleanup.
10. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
11. Keep PR #109 draft/unmerged.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent shell reachability; durable Character create/import/edit/level-up; both Sheet layouts; Official level 0–9 Spellcasting; portrait and standalone rolls/resources; durable appearance; production physics dice; Initiative/hotbar Play; presentation-only VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated automatic Host-required declarative content parity; empty fresh Host Encounter; DM image reveal/withdraw and Client dismiss/reopen/reconnect; automated exact-head gates and human Windows acceptance.

## Dispatch recommendation
`continue`
