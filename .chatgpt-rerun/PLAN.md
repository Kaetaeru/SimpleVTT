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
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`

Latest source commit: `Add validated session content parity`.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting at `e83fc37...`.
6. Direct-IP Session entry at `0b7bce05...`.

The content-parity source at `2c57c570...` is **not validated yet** and is not a closed boundary.

## Content-parity source on the work branch
The current implementation extends the existing Session handshake rather than creating a parallel protocol:
- installed-content inventory/revision and missing/changed comparison use the existing hydrated installed-content document;
- Host-required declarative entries are transferred only through the existing `hello / hello-ack` path;
- Client validation/install uses existing `validateInstalledContentPackage`, `InstalledContentRepository.installMany`, and catalog recomposition;
- Ready is gated until parity completes;
- reconnect reuses the same comparison so already-matching content is not retransferred;
- same-qualified-identity conflict and malformed content fail closed.

## Validation evidence
### Direct-IP head `0b7bce05...`
- UI run `32177587540` / frontend `95842950322`: **success**.
- Phase 12 run `32177587541` / connected-protocol `95842949930`: **success**.
- Windows connected playable job `95843208485`: **success**, including Tauri session transport/persistence tests, Windows executable build, staging and artifact upload.

### Current content-parity head `2c57c570...`
- UI run `32178687871` / frontend job `95846416290`: **success**.
  - all UI/product regression steps completed successfully;
  - `Typecheck and build`: **success**.
- Phase 12 run `32178687847` / connected-protocol job `95846416201`: **failure** at `Verify connected-session authority protocol`.
  - downstream offline walkthrough/frontend steps were skipped;
  - Windows job `95846508836` was skipped because the connected job failed.
- Exact failing test/type stack is still uninspected.

## Known execution precondition
The current CI-fix workflow requires installed and authenticated GitHub CLI log inspection before source changes. The last execution environment reported `gh` unavailable (`status 127`). The user has explicitly re-authorized the same sequence to `continue`; the next execution should attempt the prescribed CI diagnosis and, if the environment still lacks authenticated `gh`, record that condition rather than guessing a fix.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if PR #109 or `main` advanced.
2. If work HEAD remains `2c57c570...`, do **not** repeat validated slices or redo content-parity design/source audit.
3. Use the GitHub plugin `gh-fix-ci` workflow to inspect Phase 12 run `32178687847`, job `95846416201`, and capture the exact failing test/type stack from `Verify connected-session authority protocol`.
4. Summarize that observed root cause and fix only the failing newly touched parity source/tests unless the log proves another dependency is responsible.
5. Re-run/observe the affected Phase 12 connected gate and UI TypeScript/production build at the resulting exact head.
6. Promote content parity to a validated boundary only when missing/changed-only transfer, existing validator/repository install, Ready blocking, re-handshake and reconnect idempotency are green.
7. Then continue Character portrait + DM image handout/reconnect, contextual DM/Content/Rules polish and dead-legacy cleanup.
8. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
9. Keep PR #109 draft/unmerged.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent shell reachability; durable Character create/import/edit/level-up; both Sheet layouts; Official level 0–9 Spellcasting; portrait and standalone rolls/resources; durable appearance; production physics dice; Initiative/hotbar Play; presentation-only VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated automatic Host-required declarative content parity; empty fresh Host Encounter; DM image reveal/withdraw and Client dismiss/reopen/reconnect; automated exact-head gates and human Windows acceptance.

## Dispatch recommendation
`continue`
