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
`0b7bce05f59bed2335499b89c6357b2431f5987e`

PR #109 was rechecked before the write at `e83fc37f60b6f42f0ed7b8c76329465ed55e3644`, then fast-forwarded without force to `0b7bce05...`. Final reconciliation shows PR #109 open, draft, mergeable and unmerged at that exact head.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

GitHub control, STATE and PLAN agreed on `run_id=b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, `sequence=3`, `task_id=v1-product-experience-overhaul`, `status=continue`. `main` and PR #109 matched the preceding checkpoint, so validated Play/Dice/VFX/Appearance/dual-Sheet work was not repeated.

## Work completed in this execution
### Audited only the incomplete Session/content-parity paths
The source audit was restricted to the current incomplete slice. Existing findings:
- Tauri transport already accepts arbitrary Host bind endpoints and Client connect endpoints; Rust `TcpListener::bind` already uses the supplied address.
- Connected Host wrapper had been hardcoded to `0.0.0.0:3210`, while the normal Session UI did not expose Host bind IP/interface + port separately.
- existing `hello / hello-ack` handshake does not yet carry installed-content parity information.
- existing installed-content runtime already owns hydration, validation, `InstalledContentRepository`, install/uninstall and catalog recomposition; there is no need or authorization for a second addon store/protocol.

### Implemented configurable direct-IP Session entry
Source commit:
- `0b7bce05f59bed2335499b89c6357b2431f5987e`
- message: `Add configurable direct-IP session entry`

Changed/added files:
- `src/app/sessionEndpointPreferences.ts`
  - validates port range 1–65535;
  - composes explicit IPv4/hostname and bracketed IPv6 endpoints;
  - stores only a one-shot next Host bind request, not durable mechanics/session state.
- `src/app/directNetworkSessionRuntimeAdapter.ts`
  - decorates existing `tauriSessionTransport.startHost` so an explicitly requested bind endpoint replaces the old default for one Host start;
  - otherwise falls through to the existing `0.0.0.0:3210` behavior;
  - no Rust transport or wire protocol replacement.
- `src/ProductionSessionDirectNetworkBridge.tsx`
  - replaces only the offline Host/Join entry cards through a portal while leaving existing preparing/lobby/live/stop/reconnect UI untouched;
  - Host fields: session name, `Bind / Listen IP`, port, `세션 열기`;
  - Join fields: saved Character, `Host IP / 주소`, port, `참가하기`;
  - uses existing `hostSession`, `joinSession`, Character selection and prepared-session-name paths.
- `src/production-session-direct-network.css`
  - hides only the legacy offline entry grid when the new direct-network portal exists;
  - responsive endpoint field layout.
- `src/main.tsx`
  - mounts the direct-network transport decorator and UI bridge.
- `tests/ui/productionSessionWorkspaceRedesign.test.ts`
  - verifies explicit Host/Join IP+port reachability, saved Character flow, no invite-code abstraction, endpoint validation/IPv6 formatting/one-shot Host bind, runtime wiring and preserved fresh-Host empty Encounter lifecycle.

### Architecture preserved
- existing `productionSessionLifecycleAdapter` remains Session lifecycle/Ready/start/stop authority;
- existing Tauri TCP transport and Rust listener remain network transport;
- existing connected wire/protocol is unchanged by this direct-IP commit;
- owning Client Character authority, Host mechanics authority and empty fresh Encounter behavior remain unchanged;
- no second content store, network protocol or resolver was introduced.

## Validation evidence for exact head `0b7bce05...`
### UI
- workflow run `32177587540`
- frontend job `95842950322`
- conclusion: **success**
- `Verify Phase 14 unified production session UX`: success, including the direct-IP tests and existing Host lifecycle/empty Encounter check.
- existing connected/lifecycle/Host/DM/Character regressions in the same job: success.
- `Typecheck and build`: success.

### Phase 12 Connected Session
- run `32177587541`
- `connected-protocol` job `95842949930`: **success**
  - connected-session authority protocol: success;
  - Phase 11 offline walkthrough: success;
  - production frontend gate: success.
- `windows-connected-playable` job `95843208485` was still in progress at checkpoint time while verifying Tauri session transport/persistence. This is not yet recorded as final Windows evidence.

This closes the direct-IP half of the current Session slice as a validated boundary. Do not repeat it unless later touched.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.

Historical exact-head evidence remains reusable; watcher restart alone is not a reason to rerun it.

## Next Exact Action
1. Perform mandatory preflight. If PR #109 remains `0b7bce05...`, do not re-audit direct-IP Session or previously validated slices.
2. Check the eventual result of Phase 12 run `32177587541` Windows job `95843208485` and record it; do not manually rerun it if already complete.
3. Resume only the remaining Session requirement: **automatic validated Host-required declarative content parity before Ready**.
4. Reuse already-audited canonical authorities:
   - installed-content hydration/repository/`validateInstalledContentPackage` for peer content installation;
   - existing connected `hello / hello-ack` handshake for comparison/transfer;
   - production Session lifecycle for Ready/start gating.
5. Add narrowly scoped session-safe installed-content helpers:
   - snapshot normalized installed supported entries/identity revisions;
   - validate and install peer-provided entries through the same repository and validator;
   - recompute the existing catalog after install.
6. Extend the existing handshake only:
   - Client hello advertises installed supported content inventory;
   - Host computes only its required missing/changed entries;
   - hello-ack carries those supported declarative entries;
   - Client validates/installs and re-sends hello;
   - parity succeeds when the next ack has no requirements.
7. Same-identity conflicting or invalid payloads fail closed. Sync/validation failure blocks Ready with a clear human message. Never execute Host-provided JS/native content.
8. Reconnect runs the same comparison; already matching entries are not re-transferred.
9. Normal UI communicates `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`; manifest/hash/protocol detail remains secondary troubleshooting information.
10. Add focused tests for installed-content authority reuse, hello/ack missing/changed-only transfer, valid install + re-handshake, invalid/conflicting content Ready blocking, and reconnect idempotency. Run affected UI/connected/installed-content gates first.
11. After content parity is exact-head green, continue Character portrait + DM handout/reconnect, then contextual DM/Content/Rules polish and dead-legacy cleanup.
12. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation and human Windows acceptance for V0.9.
13. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN for this checkpoint was written first on `main` as commit `ae1460de572a84e7730d0e075033a3d4ee9d47a0`.
- STATE is this checkpoint and was written after PLAN.
- control must remain sequence `3`, `status=continue`, and be written last.

## Dispatch recommendation
`continue`
