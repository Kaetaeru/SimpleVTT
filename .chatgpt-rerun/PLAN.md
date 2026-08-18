# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `2`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `continue`

## Current milestone decision
The current sequence now targets **SimpleVTT V0.9** as the product-convergence milestone on the path to v1.

The interactive HTML demos created in the originating ChatGPT conversation are **reference prototypes only**. They define intended visual hierarchy, placement, motion and interaction feel, but their HTML/CSS/JavaScript shell is **not production code and must not be copied wholesale** into React/application runtime.

The latest user-approved prototype direction has been distilled into a durable product reference document on the work branch:

- `.agents/V0_9_PRODUCT_REFERENCE.md`
- reference-contract commit: `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

This document is the detailed V0.9 UX contract and should be read before implementing any new V0.9 product slice.

## Design precedence
When V0.9 UX sources conflict, use this order:
1. newest explicit user direction;
2. `.agents/V0_9_PRODUCT_REFERENCE.md`;
3. `.agents/V1_PLAY_SURFACE_REVISION.md`;
4. `.agents/V1_PRODUCT_EXPERIENCE.md`;
5. Phase 14 UX documents for preserved architecture/runtime boundaries.

The following older demo choices are explicitly superseded:
- permanent top-level `Play` destination;
- full-product fixed `Dark / parchment / Crimson` theme presets;
- official Sheet implemented as SimpleVTT layout with parchment styling;
- slow or top-to-bottom Visual Dice throws;
- raw manifest/hash/protocol-first normal Session UX;
- copying a static prototype shell directly into production.

## V0.9 product shell
Stable global navigation remains:

`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

`플레이`, Encounter/Combatants, Activity/history, DM adjudication/correction and image handouts remain contextual. A live session exposes `플레이로 돌아가기` from the product shell.

Home remains tabletop-first and must expose Character creation/opening, Host/Join, optional Addons/Content and Rules without repository knowledge or Debug Dock. A Character Sheet remains a valid standalone physical-table workflow without a VTT session.

## V0.9 Play contract
### Scene-first composition
- no permanent left/right participant, Inspector, Activity, image or debug sidebars;
- Freeform and Combat use the same primary Play workspace;
- Freeform emphasizes Scene Actors and stays materially quieter than Initiative;
- DM tools are contextual/popover/drawer surfaces only when needed.

### Single Initiative strip
- reserve one compact horizontal Initiative-card strip at the top of Play;
- Freeform: quiet/collapsed;
- Initiative: single canonical visible turn order with round/current-turn emphasis;
- never duplicate the order in another sidebar/tracker.

### Scene Actors
- NPC/hostile/scene Actors appear in the upper scene area;
- Player/party Actors appear in the lower scene area;
- central scene space stays readable;
- cards remain compact scene objects showing bounded identity/HP/status/selection/target state rather than inspector metadata.

### DM images
- Freeform reveal replaces Actor scene focus;
- Initiative reveal opens as a focused lightbox while combat context remains underneath;
- Client local dismiss/reopen and DM withdrawal are distinct;
- reconnect restores active reveal;
- image state remains presentation state, not ResolutionEvent/combat mechanics state.

## Bottom action HUD
Use only the RVTT/BG3-inspired **bottom HUD/action-bar composition**, not RVTT party rails, minimap, map/grid, movement path, LOS/cover or 3D battlefield systems.

Required anatomy:
- ActiveActorPanel on the bottom-left;
- combat ResourceRail/action economy adjacent to the hotbar;
- category tabs `공통 · 클래스 · 주문 · 아이템 · 패시브 · 커스텀`;
- default two-row square icon Hotbar;
- Common shelf visibly grouped into useful basic/intent/class/spell/item groups;
- contextual secondary chooser for weapon/spell/skill/item/variant/slot/target when required;
- independent large End Turn control when a turn is actually meaningful.

Action buttons at rest are **1:1 icon-only controls**. Hover and keyboard focus expose detailed accessible descriptions including name, economy/resource cost, source, public range/targeting, public formula, effect/damage/healing summary, resource state and disabled reason. Relevant unavailable actions may remain visible disabled but must remain understandable.

Production entries must be generated from canonical action/capability presentation data rather than hardcoded class-name UI branches.

## Intent-first action semantics
Preserve the official 2024 Free Rules intent vocabulary and existing `playerExperienceModel` semantics:
Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study and Utilize.

Do not create a top-level wall of individual skills. Influence/Search/Study/Utilize/Magic and similar intents reveal the relevant skill/item/spell/feature choice only after the intent requires it.

Freeform checks do not consume Initiative economy. Initiative actions continue through the existing authoritative runtime.

## Visual Dice — active V0.9 direction
Visual Dice are a fast global presentation layer, not a modal minigame.

### Motion
- actual WebGL polyhedral d4/d6/d8/d10/d12/d20 using production physics;
- die appears from the **depth/back of the workspace**, small/far away;
- rapidly approaches the viewer while spinning fast;
- the screen plane reads as a tabletop/floor;
- one or two short bounces/rolls;
- fast rotation transitions visibly into slower settling before stop;
- routine result must not be slowed by cinematic animation.

### Timing
- target total roll-to-result: approximately `1.0–1.4 s`;
- hard UX ceiling: **1.5 seconds** to settled raw result and resolved result notification;
- reduced-motion may resolve faster.

### Mid-upper slot result notification
While rolling:
- compact notification appears at the upper-middle of the workspace;
- action/roll label and die type visible;
- raw result cycles rapidly like a slot-machine reel.

At physical settle:
- reel stops on raw result;
- notification expands horizontally to the right;
- expose modifier/formula and final arithmetic such as `d20 17 + 7 = 24`;
- Advantage/Disadvantage and multi-die damage/healing show concise honest formula breakdowns.

Semantic d20 states override user accent:
- Natural 20 = clearly green critical/success treatment;
- Natural 1 = clearly red failure/fumble treatment.

Standalone Sheet rolls may generate local results. Connected runtime dice only present/converge to Host-authoritative results and never reroll mechanics state.

## Combat action VFX
In Initiative, accepted/resolved attacks and spells receive short non-blocking VFX between source and target.

Use a composable model:

### Delivery / physical motion
- Slashing -> sweeping curved cutting arc/trail;
- Piercing -> narrow fast straight thrust/projectile + puncture impact;
- Bludgeoning -> heavy impact + concentric shockwave + restrained short stage shake;
- projectile/beam/burst and later delivery families may be represented as metadata-driven presentation profiles.

### Element / energy treatment
Baseline V0.9 profiles:
- Fire -> orange/red/yellow heat trail and burst;
- Lightning -> blue-white jagged electrical arc;
- Poison -> green toxic projectile/mist/cloud;
- Cold -> cyan shard/frost impact;
- Force -> violet energy projectile/pressure wave.

Architecture must allow later Acid/Radiant/Necrotic/Thunder/Psychic profiles without spell-screen special cases.

Delivery and element should compose where possible. Example: a future flaming sword may use `Slashing` motion plus `Fire` color/particles.

VFX must derive from public canonical resolution/capability metadata, distinguish miss/save/no-effect from a hit, respect reduced motion, and never expose hidden AC/resistance/immunity or alter authoritative outcomes.

## Appearance Settings
The old prebuilt `Dark / parchment / Crimson` product themes are removed from the V0.9 target.

Appearance is two independent preferences:
1. `Dark` / `Light` mode;
2. user-selectable main/accent color.

Provide curated color swatches plus a custom color picker. The accent affects primary actions, current selections, hotbar icons, focus/highlights and product emphasis, but must not override semantic success/error/hostile/ally/Natural-20/Natural-1 signaling.

Mode/accent persist across restart and are presentation preferences only.

The official Character Sheet is **not a theme**.

## Character Library and dual Sheet modes
The Character Library keeps existing create/import/edit/level-up/persistence flows and exposes the preferred default Sheet presentation.

Both modes operate on the same canonical Character:
- **SimpleVTT Sheet** — application-native interactive digital layout;
- **Official sheet layout** — interactive layout reproducing the recognizable information arrangement of the standard D&D 5e paper Character Sheet using original SimpleVTT rendering/assets, not copied logos/artwork.

### Official Character Sheet layout fidelity
Do not merely apply paper colors/serif styling to the SimpleVTT dashboard. The official mode must follow the paper Sheet's composition:
- Character Name and top Class/Level, Background, Player Name, Race/Species, Alignment, XP fields;
- six vertical Ability blocks at far left;
- Inspiration, Proficiency Bonus, Saving Throws, full Skills, Passive Perception and proficiencies/languages;
- center AC shield, Initiative, Speed, HP/temp HP, Hit Dice/Death Saves;
- Attacks & Spellcasting table and Equipment/currency;
- right Personality Traits, Ideals, Bonds, Flaws, Features & Traits.

All supported checks/saves/skills/Initiative/attacks/damage/Hit Dice/resources/items remain interactive.

### Official Spellcasting Sheet
Provide a dedicated paper-layout Spellcasting page with Character Name, Spellcasting Class/Ability, Save DC, Attack Bonus and Cantrip/level `0–9` spell sections, including slot state and known/prepared state. Supported spell rows remain actionable.

## Session direct networking and addon parity
Offline Session must always expose both:
- Host: session name, Bind/Listen IP/interface, port, open/start/stop lifecycle;
- Join: Host IP/address, port, saved Character, Connect/Disconnect/Ready.

Do not replace direct IP/port with a fake invitation code unless a real discovery/invite transport is added in addition.

Host preparation:
- readable/copyable player connection address;
- participants + Ready;
- fresh Encounter starts empty;
- Combatants deliberately added/removed;
- Freeform/Initiative start mode;
- contextual image preparation/reveal;
- Start/Stop.

Before Client Ready, automatically reconcile supported declarative Host-required content using the existing RuleModule/installed-content authority. Normal UI should use human wording:

`콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`

Do not make raw manifest/hash/RulesProfile/protocol internals the normal reading path; technical details may exist behind progressive disclosure. Reconnect reconciliation is idempotent and transfers only changed/missing content. Failure blocks Ready with an actionable reason.

No arbitrary Host-provided JS/native execution, second addon store or second mechanics/content protocol.

## Content, Rules, portraits and handouts
- Content/Addons remains local validated declarative RuleModule install/preview/validation with recoverable errors and a compact creation guide;
- Rules remains search/browse over the composed installed catalog with provenance secondary;
- Character portrait remains local PNG/JPEG/WebP presentation data owned/durable with the Character, supporting preview/crop/focal/replace/remove and bounded errors;
- DM handout uses local image preview/reveal/withdraw, Client dismiss/reopen/zoom/pan and reconnect restore without public cloud URL requirements.

## Architecture invariants
Do not trade canonical architecture for prototype fidelity:
- Host remains connected mechanics authority;
- owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral;
- ResolutionEvent ledger, apply-before-cursor/replay/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains mechanics path;
- installed-content composition and RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images are presentation only;
- official monsters/encounters are not silently rebalanced;
- no second Character/content store, combat resolver, protocol or event ledger;
- no tactical grid/token movement/Fog/pathfinding/minimap/LOS/cover/cloud-account dependency.

## Existing validation evidence — do not repeat unless touched
The current historical evidence remains valid for unchanged boundaries:
- progression fixture repair at `1d0a132f2941b131451e5a98715a2088d614fd42`;
- clean UI baseline at `25c767893583da1809aa06bc0c875c14b8602154`;
- UI run `32162614993`, frontend job `95769907698`: progression regression, TypeScript and production build passed;
- prior desktop guide head `3a2c83541857591ecb30aa03aa0a6285e23b7677` had UI run `32163607516`, job `95797936721` success.

The old repository desktop guide is now **historical reference only** where it conflicts with `.agents/V0_9_PRODUCT_REFERENCE.md`.

## Current work head
`cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

This head adds the durable V0.9 product reference contract only; it does not claim the V0.9 production implementation is complete.

## Next Exact Action
1. Read `.agents/V0_9_PRODUCT_REFERENCE.md` from the work branch before implementation.
2. Treat reference demos only as visual/interaction evidence; do not transplant their shell or state model.
3. Implement the first production V0.9 slice in canonical React/runtime architecture:
   - top single Initiative strip;
   - NPC/hostile-above and party-below Scene Actors theater;
   - no permanent Play sidebars;
   - bottom ActiveActorPanel + ResourceRail + tabs + grouped two-row icon Hotbar + contextual chooser + independent End Turn;
   - preserve existing `resolveAction`, `selectDmActor`, `startInitiative`, `endInitiative`, `endTurn` and Freeform non-consumption behavior.
4. Add targeted structural/behavioral tests for that Play slice before broadening scope.
5. Then implement in order:
   - fast depth-forward Visual Dice + slot/formula notification;
   - composable combat VFX;
   - Dark/Light + accent Settings;
   - dual Character Sheet with true paper-layout official mode and level 0–9 Spellcasting Sheet;
   - direct-IP Session + automatic validated content parity;
   - portrait + DM handout/reconnect;
   - contextual DM tools/Content/Rules polish and dead-legacy cleanup.
6. Target-test each touched slice. Do not rerun validated historical boundaries unless affected.
7. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation and human Windows acceptance for V0.9.
8. Keep PR #109 draft/unmerged. Never merge without explicit user authorization.

## V0.9 Definition of Done
One exact source SHA must demonstrate together:
- coherent Home/product shell and all normal workflow reachability;
- stable global nav + contextual live Play return;
- Character create/import/edit/level-up/restart durability;
- SimpleVTT and true paper-layout official Sheet modes over one Character;
- interactive official level 0–9 Spellcasting Sheet;
- durable portrait and standalone Sheet direct rolls/resources;
- independent Light/Dark + persisted user accent color;
- real physics polyhedral Visual Dice with depth-forward throw, <=1.5 s cadence, slot-reel notification, formula expansion, Natural-20 green and Natural-1 red;
- one top Initiative order + NPC-above/party-below scene + generated icon-only accessible Hotbar;
- composable physical/elemental combat VFX that never change mechanics state;
- direct-IP Host/Join/Ready/start/stop/reconnect;
- validated automatic Host-required declarative content parity before Ready with human-readable normal UX;
- empty fresh Host Encounter with deliberate official Combatant addition and unchanged official stats;
- DM image reveal/withdraw and Client dismiss/reopen/reconnect;
- exact-head automated gates plus human Windows acceptance;
- production implementation uses canonical React/services/runtime architecture rather than copied demo markup;
- PR remains draft/unmerged until explicit merge authorization.

## Dispatch recommendation
`continue`
