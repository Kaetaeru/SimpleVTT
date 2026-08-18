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
Use `.agents/V0_9_PRODUCT_REFERENCE.md` (reference commit `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`). Interactive HTML demos remain visual/interaction references only. Production must preserve the canonical React/runtime, Character Library, installed-content, Host-authority, ResolutionEvent/reconnect/idempotency and existing Scene/action boundaries.

## Architecture invariants
- one canonical Character; owning Client Character Library is durable Character authority;
- Host projections are ephemeral and Host is connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime is the mechanics path;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance/sheet-layout preferences are presentation state only;
- no second Character/content store, resolver, protocol or event ledger;
- no tactical grid/token movement/Fog/pathfinding/minimap/LOS/cloud-account dependency;
- PR #109 must not be merged without explicit user authorization.

## Exact work HEAD
`e83fc37f60b6f42f0ed7b8c76329465ed55e3644`

Source commit: `Implement V0.9 dual character sheet layouts`.

## Validated V0.9 slices — do not repeat unless touched
1. **Production Play** — one top Initiative strip, scene theater, no permanent sidebars, bottom actor/resource/hotbar UX, canonical action and Freeform boundaries.
2. **Fast Visual Dice** — production Three.js/cannon-es path, <=1.5 s cadence, result reel/formula expansion, Natural 20/1 semantic states, no connected reroll.
3. **Composable Combat VFX** — presentation-only delivery + element projection, no hidden-defense leakage or mechanics mutation.
4. **Appearance** — independent Dark/Light + persisted curated/custom accent with semantic colors preserved.
5. **Dual Character Sheet presentation** — exact-head validated at `e83fc37...`:
   - `SimpleVTT Sheet` remains the previously validated standalone sheet implementation; its exact source blob was retained as `LegacyCharacterSheetPlayScreen.tsx` rather than rewritten;
   - persisted presentation-only layout preference `simplevtt | official`, default `simplevtt`, safe storage failure;
   - both modes read the same `snapshot.activeCharacter`;
   - Official Character page follows the paper information arrangement with six ability blocks, saves, full skills, passive perception, AC/Initiative/Speed, HP/temp HP, Hit Dice, attacks, resources, equipment/currency and feature/roleplay regions;
   - existing item/edit/level-up and local roll handlers are reused;
   - Player Name, Alignment, XP and Death Save persistence are explicitly rendered as untracked rather than invented;
   - dedicated Official Spellcasting page renders Cantrips/level 0 plus levels 1–9, known/prepared state, projected current/max slots, projected Spell Save DC/Attack Bonus and supported local attack/damage controls;
   - Official presentation reads `projectOfficialSheet`, `sheetAbilityModifier`, `sheetSaveBonus`, `scene.spellcastingByActor` and `scene.actionsByActor`; no second Character store or spell/save mechanics arithmetic was introduced;
   - original SimpleVTT styling/assets only; no D&D logo/artwork or parchment asset transplant.

## Exact-head validation evidence
At `e83fc37f60b6f42f0ed7b8c76329465ed55e3644`:
- UI workflow run `32176685363` / frontend job `95840143821`: **success**.
- Focused `Verify Phase 14 tabletop sheet, physics dice, and intent-first play UX`: **success**; this includes the expanded `characterSheetPlayableUx.test.ts` dual-Sheet contract.
- UI named-rule boundary, v1 shell, Play structure/accessibility, Combat VFX, session UX, Host metadata, DM mechanics continuity, local Character ownership/inventory/spell regressions, creation/progression regressions, authoritative spellcasting and Phase 09 mechanics services all passed in that same exact-head frontend job.
- `Typecheck and build`: **success**.

Historical exact-head evidence for unchanged earlier slices remains reusable, including UI run `32171564923` / frontend job `95823699460` and Phase 11 offline walkthrough job `95823700000` at `669f867...`. Do not rerun historical unchanged work merely because Rerun restarts.

## Next Exact Action
1. Perform mandatory watcher preflight. Trust GitHub if the work branch moved.
2. If PR #109 still points to `e83fc37...`, do **not** reimplement or revalidate the dual-Sheet slice and do not repeat Play/Dice/VFX/Appearance work.
3. Resume the next incomplete V0.9 slice: **direct-IP Session + validated automatic content parity**.
4. Inspect only the current Session networking/content-parity paths needed for this slice: production Session workspace/lifecycle/UI state, Tauri session transport, connected protocol/wire/state, installed-content composition and RuleModule validation. Reuse prior Phase 12/14 validated mechanics/session authority rather than replacing it.
5. Ensure the normal offline Session surface exposes real Host and Join coordinates:
   - Host: session name, Bind/Listen IP/interface, port, open/start/stop lifecycle and readable/copyable player address;
   - Join: Host IP/address, port, saved Character, Connect/Disconnect/Ready;
   - no fake invite-code replacement.
6. Before Client Ready, automatically reconcile Host-required supported declarative content through the existing installed-content/RuleModule authority with normal UX: `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`.
7. Reconnect must be idempotent and transfer only missing/changed supported data. Validation/sync failure must block Ready with an actionable reason. Never execute Host-provided JS/native code or create a second addon store/mechanics protocol.
8. Add focused tests only for direct-IP field reachability, lifecycle wiring, automatic content comparison/transfer/validation, Ready gating and reconnect idempotency. Run affected targeted gates first.
9. After Session/content parity is exact-head green, continue: Character portrait + DM image handout/reconnect; contextual DM/Content/Rules polish and dead-legacy cleanup.
10. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.

## V0.9 Definition of Done
One exact source SHA must demonstrate coherent Home/shell reachability; Character create/import/edit/level-up/restart durability; both Sheet layouts over one Character; interactive official level 0–9 Spellcasting; portrait and standalone Sheet rolls/resources; durable Light/Dark + accent; production physics dice; one top Initiative order and icon hotbar; presentation-only composable VFX; direct-IP Host/Join/Ready/start/stop/reconnect; validated Host-required declarative content parity; empty fresh Host Encounter with deliberate official Combatant addition; DM image reveal/withdraw and Client dismiss/reopen/reconnect; exact-head automated gates and human Windows acceptance. PR remains draft/unmerged until explicit merge authorization.

## Dispatch recommendation
`continue`
