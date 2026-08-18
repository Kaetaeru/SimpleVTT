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
`28f3700eb92ab93bacb589dd07be792bf228b3a0`

The work branch was advanced from `af193781...` by a non-force fast-forward to `7fbb5ddb...`, followed by the narrow cleanup commit `28f3700e...`. PR #109 was rechecked before writes and remains draft/unmerged.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates reconciled to run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `3`, task `v1-product-experience-overhaul`, dispatch `continue`, starting work HEAD `af19378149db97387e3cd364b38fe17e95078b39`. Validated Play/Dice/VFX/Appearance/dual-Sheet/direct-IP/content-parity work was not repeated.

## Prior Windows result recovered
The pending same-head content-parity Windows job from the previous checkpoint completed successfully:
- Phase 12 run `32186178904`
- `windows-connected-playable` job `95870544914`: **success**
- Tauri transport/persistence verification: success
- Windows connected executable build: success
- artifact staging/upload: success

No rerun was requested or performed.

## Work completed in this execution
### Character portrait
Added presentation-only portrait support without a second Character store:
- local PNG/JPEG/WebP only, max 2 MiB;
- preview/add/replace/remove;
- horizontal/vertical focal position controls;
- same bridge appears on both normal Character Sheet layouts;
- portrait data is stored in the existing owning-Client Character Library materialized Character record;
- explicit portrait commits use the existing `CharacterLibraryRepository` and rollback/error behavior;
- portrait/focal changes do not alter mechanics source/runtime projections or Character SessionProjection revisions.

### DM image handout/reconnect
Added connected presentation state without ResolutionEvent/Undo/combat semantics:
- local PNG/JPEG/WebP only, max 4 MiB;
- contextual live-Host `이미지 보여주기` flow with preview and explicit player reveal;
- explicit withdraw;
- Client dismiss and reopen;
- active Host reveal is re-sent immediately after a final compatible reconnect `hello-ack`;
- uses the existing Tauri session channel as a bounded `presentation-handout` envelope;
- required-content warning handshake does not reveal the image before compatibility completes;
- presentation messages are consumed outside the mechanics connected-wire decoder and do not enter the Host ledger.

### Source commits
- `7fbb5ddb96862d1a696885e37ba064247c61538c` — `Add Character portrait and session image handouts`
- `28f3700eb92ab93bacb589dd07be792bf228b3a0` — `Fix handout subscription cleanup`
  - React subscription cleanup was made explicitly void-returning before final validation.

Focused tests added/wired:
- `tests/ui/characterLibraryPortraitPersistence.test.ts`
- `tests/ui/portraitAndHandoutPresentation.test.ts`
- `tests/ui/sessionImageHandoutRuntimeAdapter.test.ts`

## Validation evidence for exact head `28f3700e...`
### UI
- run `32187690842`
- frontend job `95875015492`: **success**
- portrait/handout presentation structure test: success
- all reported UI/product regression steps: success
- Typecheck and production build: success

### Persistence
- run `32187690744`
- application-contract job `95875014950`: **success**
- Character portrait persistence/restart/revision coverage plus existing persistence contracts: success
- production build: success
- tauri-storage job `95875014764`: **in progress** at checkpoint time; no Rust persistence source was changed. Do not manually rerun on watcher restart.

### Phase 12 Connected Session
- run `32187690780`
- connected-protocol job `95875015147`: **success**
- new handout reveal/withdraw/dismiss/reconnect test plus existing connected/content-parity regressions: success
- Phase 11 offline walkthrough: success
- production frontend gate: success
- windows-connected-playable job `95875316302`: **in progress** at checkpoint time. Do not manually rerun on watcher restart.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.

Watcher restart alone is not a reason to rerun these eight boundaries.

## Next Exact Action
1. Perform mandatory preflight and trust GitHub if `main`, control, or PR #109 moved.
2. If work HEAD remains `28f3700e...`, do not repeat any validated slice or portrait/handout audit.
3. Check jobs `95875316302` and `95875014764`; record final results without manually rerunning if complete.
4. Resume **contextual DM/Content/Rules polish + dead legacy cleanup**.
5. Keep routine production surfaces outcome-first and do not restore implementation/debug/provenance clutter.
6. Confirm legacy paths are genuinely unreachable before removal; preserve canonical Character/content/session authorities.
7. Run only affected gates first.
8. Later collect one exact-head full automated validation set and human Windows acceptance for standalone Sheet use and two-instance Host/Client image reveal/reconnect.
9. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN was written first on `main` as commit `0c9c85e68d389b59d64c6fe0a5556d0787803df5`.
- STATE is this durable checkpoint and is written after PLAN.
- STATUS may be refreshed next.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
