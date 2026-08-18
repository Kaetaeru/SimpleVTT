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
`2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`

No product source write is part of this coordination-only transition. The work head remains the content-parity source commit `2c57c570...`.

## Dispatch transition
The user explicitly requested that the watcher status be changed from `blocked` to `continue` for the same run/sequence/task. This is a new work authorization under the protocol; it does not erase the prior validation history or the known CI-diagnosis precondition.

Mandatory files were re-read from `main` in exact protocol order before this transition:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates remain reconciled as:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- work head `2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`

## Current content-parity source
Source commit already on work branch:
- `2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`
- message: `Add validated session content parity`

Touched paths remain:
- `src/app/installedContentRuntimeAdapter.ts`
- `src/app/sessionContentParityRuntimeAdapter.ts`
- `src/main.tsx`
- `tests/ui/productionHelloReplayIdempotency.test.ts`

Architecture remains bounded to the existing installed-content repository/validator, existing `hello / hello-ack`, Host ledger/participant acceptance, Ready lifecycle, and reconnect path. No second store/protocol/resolver was introduced.

## Validation state
### Current content-parity head `2c57c570...`
- UI run `32178687871` / frontend job `95846416290`: **success**.
  - all reported UI/product regression steps succeeded;
  - `Typecheck and build`: **success**.
- Phase 12 Connected Session run `32178687847`:
  - connected-protocol job `95846416201`: **failure** at `Verify connected-session authority protocol`;
  - downstream Phase 11 offline walkthrough and production frontend gate were skipped;
  - Windows job `95846508836` was skipped because the prerequisite connected job failed.
- Exact failing connected test/type stack remains uninspected.

### Previously validated direct-IP head `0b7bce05...`
- UI run `32177587540` / frontend `95842950322`: **success**.
- Phase 12 run `32177587541` / connected-protocol `95842949930`: **success**.
- Windows connected playable job `95843208485`: **success**.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.

Content parity remains unvalidated until its connected gate is diagnosed and fixed.

## Known execution precondition
The GitHub plugin `gh-fix-ci` workflow requires installed/authenticated `gh` for Actions log diagnosis before source changes. The last environment check reported `gh` absent (`status 127`). This coordination transition intentionally sets dispatch back to `continue`; the next execution should attempt that prescribed diagnosis and must not guess a source fix if the prerequisite remains unavailable.

## Next Exact Action
1. Perform mandatory preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `2c57c570...`, do not repeat validated slices and do not redo the parity audit.
3. Invoke the GitHub plugin `gh-fix-ci` workflow and inspect Phase 12 run `32178687847`, job `95846416201`, capturing the exact failing test/type stack.
4. Fix only the observed failure in the newly touched parity paths unless the log proves another dependency is responsible.
5. Re-run/observe the affected Phase 12 connected gate and UI TypeScript/production build at the resulting exact head.
6. Once exact-head green, promote content parity to the validated boundary and continue Character portrait + DM image handout/reconnect, then contextual DM/Content/Rules polish and dead-legacy cleanup.
7. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN was written first for this reauthorization.
- STATE is this durable reauthorization checkpoint.
- STATUS may be refreshed for human visibility.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
