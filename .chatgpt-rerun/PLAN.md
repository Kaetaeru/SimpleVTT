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
- dispatch recommendation: `blocked`

## Authoritative product reference
Use `.agents/V0_9_PRODUCT_REFERENCE.md` (reference commit `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`). Preserve canonical React/runtime architecture, owning-Client Character durability, Host mechanics authority, ResolutionEvent/reconnect/idempotency, installed-content/RuleModule authority and existing Scene/action runtime.

## Architecture invariants
- one canonical Character; owning Client Character Library is durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance/sheet-layout preferences are presentation state only;
- no second Character/content store, resolver, network/content protocol or event ledger;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud-account dependency;
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

## Content-parity source now on the work branch
The current implementation intentionally extends the existing Session handshake rather than creating a parallel protocol:
- `installedContentRuntimeAdapter` now exposes session-safe inventory, stable canonical content revision, missing/changed comparison, and peer install helpers over the existing hydrated `InstalledContentRepository` and `validateInstalledContentPackage` authority;
- `sessionContentParityRuntimeAdapter` decorates the existing transport listener/send path so Client `hello` advertises installed declarative content revisions;
- Host intercepts only when required entries are missing/changed, sends those entries in the existing `hello-ack` envelope, and does not accept the participant before parity completes;
- Client validates/installs through the existing repository, recomposes the existing catalog, then re-sends the same `hello`;
- matching reconnects transfer nothing; conflicting same-qualified-identity payloads fail closed;
- Client Ready is gated until parity state is `ready`;
- normal compatibility text communicates `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`;
- no Host-provided JS/native execution path, second addon store, resolver or second event/network protocol was added.

Focused coverage was added to `productionHelloReplayIdempotency.test.ts` for successful missing-only transfer, re-handshake, Ready gating, reconnect idempotency, same-identity conflict rejection and malformed Host content rejection.

## Validation evidence
### Previously validated direct-IP head `0b7bce05...`
- UI workflow `32177587540` / frontend `95842950322`: **success**.
- Phase 12 Connected Session `32177587541` / connected-protocol `95842949930`: **success**.
- Its Windows job `95843208485` was still in progress at the latest observation; do not manually rerun it merely because watcher execution restarts.

### Current content-parity head `2c57c570...`
- Phase 12 Connected Session run `32178687847` started automatically.
- connected-protocol job `95846416201` failed at step `Verify connected-session authority protocol`.
- The exact failing log/root cause is **not yet inspected**. This execution environment has no `gh` CLI (`gh: not found`), and the GitHub CI-fix workflow requires authenticated `gh` log inspection before changing source. No speculative source fix was made after the failure.
- UI run `32178687871` had started but was still in progress when the blocker checkpoint was written; do not claim it green.

## Technical blocker
The active execution environment does not provide the required GitHub CLI for the prescribed GitHub Actions failure-inspection workflow. The source remains safely committed and PR #109 remains draft/unmerged, but the failing parity gate must be diagnosed before further source work.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if PR #109 or `main` advanced.
2. If control is re-authorized to `continue` and work HEAD remains `2c57c570...`, do **not** repeat Play/Dice/VFX/Appearance/dual-Sheet/direct-IP work or re-audit the parity design.
3. In an execution environment with authenticated `gh`, inspect Phase 12 run `32178687847`, connected-protocol job `95846416201` and capture the exact failing test/type error. Do not guess from the red step alone.
4. Fix only the observed failure in the new content-parity source/tests. Preserve the existing installed-content repository/validator and existing `hello / hello-ack` authority boundaries.
5. Re-run/observe the affected Phase 12 connected gate and UI TypeScript/production build at one exact head. If the failure is only in focused tests, keep the fix equally narrow.
6. Content parity becomes a validated boundary only after missing/changed-only transfer, validation/install, Ready blocking, successful re-handshake and reconnect idempotency are green.
7. After content parity is exact-head green, continue: Character portrait + DM image handout/reconnect; then contextual DM/Content/Rules polish and dead-legacy cleanup.
8. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
9. Keep PR #109 draft/unmerged.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent shell reachability; durable Character create/import/edit/level-up; both Sheet layouts; Official level 0–9 Spellcasting; portrait and standalone rolls/resources; durable appearance; production physics dice; Initiative/hotbar Play; presentation-only VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated automatic Host-required declarative content parity; empty fresh Host Encounter; DM image reveal/withdraw and Client dismiss/reopen/reconnect; automated exact-head gates and human Windows acceptance.

## Dispatch recommendation
`blocked`
