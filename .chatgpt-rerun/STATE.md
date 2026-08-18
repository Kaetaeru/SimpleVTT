# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

PR #109 was rechecked after the planning write and resolves to this head; it remains open, draft, mergeable and unmerged.

## Current scope
The current sequence now uses **SimpleVTT V0.9** as the product-convergence milestone toward v1. Existing Character persistence, installed-content composition, Host authority, Scene/runtime mechanics, ResolutionEvent/Undo, reconnect/idempotency and owning-Client Character architecture remain canonical.

The interactive HTML prototypes created in the originating ChatGPT conversation are **reference prototypes only**. They define intended visual hierarchy, placement, motion and interaction feel. Their HTML/CSS/JavaScript shell must not be copied wholesale into production and must not replace canonical React/application state, stores, services or runtime authority.

## New durable V0.9 reference
Added on the work branch:

- `.agents/V0_9_PRODUCT_REFERENCE.md`
- commit: `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

This is now the detailed V0.9 product-reference contract. It records and reconciles the latest prototype decisions with the existing SimpleVTT product/architecture documents.

Rerun PLAN on `main` was rewritten to make V0.9 the active milestone and to reference this document. PLAN commit:

- `e09acc2c5c83b3897654e423348bf2f4ee364e80`

## V0.9 decisions now frozen as implementation guidance
### Product shell
- stable global nav: `홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`;
- Play remains contextual and appears as `플레이로 돌아가기` only when a live session exists;
- Home remains tabletop-first and exposes Character, Host/Join, optional Addons and Rules.

### Play
- scene-first workspace with no permanent left/right Play sidebars;
- one top Initiative strip only;
- Freeform keeps Initiative quiet/collapsed;
- Initiative becomes the single canonical visible order;
- Scene Actors: NPC/hostile/scene Actors above, Player/party Actors below;
- Freeform DM image replaces Actor scene; Combat image is a lightbox over persistent Initiative context;
- DM operational tools remain contextual.

### Bottom HUD
- borrow only RVTT/BG3-inspired bottom HUD/actionbar composition;
- ActiveActorPanel left, combat ResourceRail near hotbar, tabs, grouped two-row square icon Hotbar, contextual chooser, independent End Turn;
- no RVTT party rail/minimap/tactical map/3D battlefield/LOS/path systems;
- `공통 · 클래스 · 주문 · 아이템 · 패시브 · 커스텀` presentation tabs;
- Common groups basic/intent/class/spell/item shelves;
- action controls are icon-only 1:1 buttons with detailed accessible hover/focus descriptions and disabled reasons;
- intent-first action semantics remain canonical; skills are secondary choices rather than a top-level wall.

### Visual Dice
- actual production WebGL polyhedral physics meshes;
- motion comes from scene depth/back toward the viewer rather than simple top-to-bottom falling;
- screen plane reads as tabletop/floor;
- fast initial spin, short bounce/roll, visible deceleration;
- normal roll-to-result target `1.0–1.4 s`, hard UX ceiling `1.5 s`;
- upper-middle slot-machine-style raw-result notification while rolling;
- on settle, reel stops and notification expands right to show modifier/formula/final result;
- Natural 20 green; Natural 1 red; semantic colors override user accent;
- connected visuals never change Host-authoritative results.

### Combat VFX
- presentation only after/with authoritative resolution;
- composable physical delivery + element/energy profiles;
- baseline delivery: Slashing / Piercing / Bludgeoning;
- baseline element: Fire / Lightning / Poison / Cold / Force;
- architecture should extend to Acid/Radiant/Necrotic/Thunder/Psychic without per-screen hardcoding;
- delivery and element may compose, e.g. Slashing + Fire;
- misses/saves/no-effect need honest distinct treatment; reduced-motion supported.

### Appearance
- old full-product `Dark / parchment / Crimson` presets are superseded;
- V0.9 uses independent `Dark / Light` mode + user-selectable main/accent color;
- curated swatches plus custom color picker;
- persistence and contrast required;
- accent does not override semantic success/error/hostile/ally/Natural-20/Natural-1 colors;
- official Character Sheet is a layout mode, not a theme.

### Character Sheets
- same canonical Character supports SimpleVTT digital Sheet and Official sheet layout;
- Official mode must reproduce the recognizable **paper Sheet information arrangement**, not merely parchment styling;
- includes top identity fields, six left Ability blocks, inspiration/proficiency/saves/full skills/passive/languages, central AC/Initiative/Speed/HP/Hit Dice/Death Saves/Attacks/Equipment and right personality/features regions;
- all supported rolls/resources remain interactive;
- dedicated official Spellcasting Sheet uses level `0–9` structure with spellcasting summary, slots and known/prepared state.

### Session/content parity
- Offline Session always exposes direct Host and Join IP + port paths;
- fresh Host Encounter starts empty; Combatants added intentionally;
- Client Ready waits for automatic supported declarative content parity;
- normal UI wording: `콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`;
- raw manifest/hash/RulesProfile/protocol metadata is secondary troubleshooting detail;
- existing RuleModule validation and installed-content authority remain canonical;
- no arbitrary Host-provided JS/native execution or second addon/mechanics protocol.

## Historical validation preserved
Do not repeat these unchanged boundaries unless touched:
- progression fixture repair: `1d0a132f2941b131451e5a98715a2088d614fd42`;
- clean UI baseline: `25c767893583da1809aa06bc0c875c14b8602154`;
- UI run `32162614993`, frontend job `95769907698`: progression regression, TypeScript and production build passed;
- old desktop-guide head `3a2c83541857591ecb30aa03aa0a6285e23b7677`: UI run `32163607516`, frontend job `95797936721` success.

The repository demo at `docs/design/v1-desktop-demo/` is now historical where it conflicts with `.agents/V0_9_PRODUCT_REFERENCE.md`.

## Next Exact Action
1. Read `.agents/V0_9_PRODUCT_REFERENCE.md` from `agent/108-production-play-session-ux` before code changes.
2. Do not transplant demo markup/state logic.
3. Implement the first V0.9 production slice using canonical React/runtime architecture:
   - top single Initiative strip;
   - NPC/hostile-above + party-below Scene Actors theater;
   - no permanent Play sidebars;
   - ActiveActorPanel + ResourceRail + tabs + grouped two-row icon Hotbar + contextual chooser + independent End Turn;
   - preserve `resolveAction`, `selectDmActor`, `startInitiative`, `endInitiative`, `endTurn` and Freeform non-consumption semantics.
4. Add targeted Play structural/behavioral tests.
5. Continue in order: fast depth-forward Visual Dice + result notice -> combat VFX -> Dark/Light + accent Settings -> dual Sheet true official layout/spellcasting page -> direct-IP Session + validated addon parity -> portrait/DM handout/reconnect -> contextual DM/Content/Rules cleanup.
6. Target-test touched slices; do not rerun validated historical mechanics/persistence/network boundaries unless affected.
7. Later obtain one exact-head V0.9 UI/Main/mechanics/persistence/installed-content/connected/Windows gate and human Windows acceptance.
8. PR #109 remains draft/unmerged; never merge without explicit user authorization.

## Architecture preserved
- owning Client Character Library is durable Character authority; Host projections are ephemeral;
- Host is connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains mechanics path;
- installed-content composition/RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images are presentation only;
- fresh Host remains empty and official Combatants are not silently rebalanced;
- no second store/protocol/resolver/event ledger, tactical map/Fog/path/minimap/LOS or cloud dependency.

## Dispatch recommendation
`continue`
