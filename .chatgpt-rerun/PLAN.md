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
Use `.agents/V0_9_PRODUCT_REFERENCE.md` (reference commit `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`). Interactive HTML demos remain references only. Preserve canonical React/runtime architecture, owning-Client Character durability, Host mechanics authority, ResolutionEvent/reconnect/idempotency, installed-content/RuleModule authority and existing Scene/action runtime.

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
`0b7bce05f59bed2335499b89c6357b2431f5987e`

Latest source commit: `Add configurable direct-IP session entry`.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting at `e83fc37...`.
6. **Direct-IP Session entry** at `0b7bce05...`:
   - Host offline entry exposes session name, explicit Bind / Listen IP/interface and port;
   - Join entry exposes saved Character, Host IP/address and port separately;
   - arbitrary IPv4/IPv6 endpoint composition uses the existing Tauri TCP transport;
   - a one-shot Host endpoint request decorates existing `tauriSessionTransport.startHost` without replacing Session lifecycle or Rust transport;
   - existing Host preparation/lobby/live/stop/reconnect UI remains unchanged after connection;
   - no invite-code abstraction and no networking protocol replacement;
   - fresh Host empty Encounter behavior is retained.

## Validation evidence
### Dual Sheet exact head `e83fc37...`
- UI run `32176685363` / frontend `95840143821`: **success** including dual-Sheet focused test and TypeScript/production build.

### Direct-IP exact head `0b7bce05...`
- UI workflow run `32177587540` / frontend job `95842950322`: **success**.
  - `Verify Phase 14 unified production session UX`: success, including direct-IP endpoint/UI tests and existing empty-Encounter lifecycle test;
  - existing connected/lifecycle/DM/Character regressions in the same frontend job: success;
  - `Typecheck and build`: success.
- Phase 12 Connected Session run `32177587541` / `connected-protocol` job `95842949930`: **success**.
  - connected-session authority protocol: success;
  - Phase 11 offline walkthrough: success;
  - production frontend gate: success.
- The same Phase 12 run's `windows-connected-playable` job `95843208485` was still building at checkpoint time. Record its eventual result next invocation; do not block the next source slice solely on this in-progress artifact build.

Historical evidence for unchanged prior slices remains reusable. Do not rerun unchanged work merely because Rerun restarts.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if the work branch moved.
2. If PR #109 still points to `0b7bce05...`, do **not** re-audit/rewrite direct-IP Session, dual Sheet, Play, Dice, VFX or Appearance.
3. Resume only the remaining half of the current Session slice: **automatic validated Host-required content parity before Ready**.
4. Reuse the already-audited boundaries:
   - `installedContentRuntimeAdapter` / `InstalledContentRepository` and `validateInstalledContentPackage` remain the only install/validation authority;
   - `connectedSessionProtocol` / `connectedSessionWire` existing `hello` / `hello-ack` remain the handshake path;
   - `productionSessionLifecycleAdapter` remains Ready/start/stop authority.
5. Add session-safe helpers to snapshot normalized installed declarative entries and install peer-provided entries through the existing repository/validator. Do not create a second addon store.
6. Extend the existing handshake, not a parallel protocol:
   - Client `hello` advertises installed supported content identity/revision inventory;
   - Host compares against its required installed supported content;
   - `hello-ack` transfers only missing/changed supported declarative entries;
   - Client validates/installs through existing authority, recomposes the catalog, then re-sends `hello`;
   - parity is complete only when the next Host ack requires no entries.
7. Same-identity conflicting/invalid payloads must fail closed and block Ready with an actionable message. Never execute Host-provided JS/native code.
8. Reconnect uses the same comparison so already-matching content is not transferred again.
9. Normal Session UX should communicate `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`; raw hash/manifest/protocol detail stays troubleshooting-only.
10. Add focused tests around installed-content helper reuse, hello/ack comparison and transfer, validation failure Ready gating, successful re-handshake and reconnect missing/changed-only behavior. Run only affected UI/connected/installed-content gates first.
11. After content parity is exact-head green, continue: Character portrait + DM image handout/reconnect; then contextual DM/Content/Rules polish and dead-legacy cleanup.
12. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
13. Keep PR #109 draft/unmerged.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent shell reachability; durable Character create/import/edit/level-up; both Sheet layouts; Official level 0–9 Spellcasting; portrait and standalone rolls/resources; durable appearance; production physics dice; Initiative/hotbar Play; presentation-only VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated automatic Host-required declarative content parity; empty fresh Host Encounter; DM image reveal/withdraw and Client dismiss/reopen/reconnect; automated exact-head gates and human Windows acceptance.

## Dispatch recommendation
`continue`
