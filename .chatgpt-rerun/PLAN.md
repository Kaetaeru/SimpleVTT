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

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/RuleModule validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts are presentation state only; no ResolutionEvent/Undo/combat or tactical grid/token/Fog/path/LOS semantics;
- no cloud/public-URL requirement for local images;
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`28f3700eb92ab93bacb589dd07be792bf228b3a0`

Latest source commits:
- `7fbb5ddb96862d1a696885e37ba064247c61538c` — `Add Character portrait and session image handouts`
- `28f3700eb92ab93bacb589dd07be792bf228b3a0` — `Fix handout subscription cleanup`

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. **Character portrait + DM image handout/reconnect** at `28f3700e...`:
   - portrait uses local PNG/JPEG/WebP, max 2 MiB, preview/replace/remove and focal-position controls on both normal Sheet layouts;
   - portrait persists through the existing owning-Client Character Library materialized record without advancing mechanics source/runtime revisions;
   - DM handout uses local PNG/JPEG/WebP, max 4 MiB, explicit preview/reveal/withdraw;
   - Client can dismiss and reopen; a compatible reconnect hello restores the current Host reveal;
   - handout uses the existing Tauri session channel as a presentation envelope and does not enter the Host ResolutionEvent/participant ledger.

## Validation evidence
### Prior content-parity head `af193781...`
- Phase 12 run `32186178904` / connected-protocol `95870203173`: success.
- UI run `32186178947` / frontend `95870203434`: success.
- Windows connected job `95870544914`: **success**, including Tauri transport/persistence, Windows executable build, staging and artifact upload.

### Current portrait/handout head `28f3700e...`
- UI run `32187690842` / frontend `95875015492`: **success**.
  - new portrait/handout presentation structure test: success;
  - all reported product regressions: success;
  - Typecheck and production build: success.
- Persistence run `32187690744` / application-contract `95875014950`: **success**.
  - new Character portrait persistence/restart/revision test: success;
  - existing Character/content/module persistence suite: success;
  - production build: success.
- Phase 12 run `32187690780` / connected-protocol `95875015147`: **success**.
  - new handout reveal/withdraw/dismiss/reconnect integration test plus existing connected/parity suite: success;
  - Phase 11 offline walkthrough: success;
  - production frontend gate: success.
- Same-head Windows jobs are still automatic/in progress at this checkpoint:
  - Phase 12 `windows-connected-playable` job `95875316302`;
  - Persistence `tauri-storage` job `95875014764`.
  Do not manually rerun them merely because watcher execution restarts; record their eventual result next invocation.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `28f3700e...`, do not repeat any of the eight validated V0.9 slices.
3. Check final results of jobs `95875316302` and `95875014764`; record them without manual rerun if already complete.
4. Resume the remaining V0.9 convergence work: **contextual DM/Content/Rules polish + dead legacy cleanup**.
5. Keep production surfaces outcome-first; do not restore Inspector/debug/provenance/entity-list/image-manager clutter.
6. Remove only proven dead legacy paths after confirming no production import/reachability dependency.
7. Run only affected gates first; preserve exact-head validation boundaries.
8. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for both standalone Sheet-at-table and two-instance Host/Client image reveal/reconnect.
9. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
