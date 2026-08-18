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

## Authoritative product reference
The interactive HTML demos from the originating ChatGPT conversation are visual/interaction references only. Their shell/state model is not production architecture and must not be copied wholesale.

The durable detailed V0.9 contract is:
- `.agents/V0_9_PRODUCT_REFERENCE.md`
- reference-contract commit: `cde7ec5a8f052aac7072c99a055f96c6bc5e462a`

Design precedence when sources conflict:
1. newest explicit user direction;
2. `.agents/V0_9_PRODUCT_REFERENCE.md`;
3. `.agents/V1_PLAY_SURFACE_REVISION.md`;
4. `.agents/V1_PRODUCT_EXPERIENCE.md`;
5. Phase 14 UX documents for preserved runtime/architecture boundaries.

Superseded choices remain superseded:
- no permanent top-level Play destination;
- no fixed full-product `Dark / parchment / Crimson` theme presets;
- official Sheet is not SimpleVTT dashboard plus parchment styling;
- no slow/top-to-bottom pseudo-cinematic dice;
- no raw manifest/hash/protocol-first normal Session UX;
- no prototype shell transplant.

## V0.9 product contract summary
### Product shell
Stable global navigation remains:
`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

Play, Encounter/Combatants, Activity/history, DM adjudication/correction and image handouts remain contextual. A live session exposes `플레이로 돌아가기`. Home remains tabletop-first and exposes Character creation/opening, Host/Join, optional Addons/Content and Rules without requiring repository/debug knowledge.

### Play
- scene-first workspace with no permanent participant/Inspector/Activity/image/debug sidebars;
- one compact horizontal Initiative strip at the top only;
- Freeform keeps Initiative quiet/collapsed;
- Initiative uses that strip as the single canonical visible turn order;
- NPC/hostile/scene Actors above and Player/party Actors below with open scene space between;
- Actor cards stay compact presentation objects, not inspectors;
- Freeform DM image reveal replaces scene focus; Initiative reveal is a lightbox over persistent combat context;
- Client local dismiss/reopen and DM withdraw are distinct; reconnect restores active reveal;
- image state is presentation state, not ResolutionEvent/combat mechanics state.

### Bottom action HUD
Borrow only the RVTT/BG3-inspired bottom HUD/actionbar composition:
- ActiveActorPanel bottom-left;
- combat ResourceRail/action economy near hotbar;
- tabs `공통 · 클래스 · 주문 · 아이템 · 패시브 · 커스텀`;
- default two-row square icon Hotbar;
- Common grouped into useful basic/intent/class/spell/item shelves;
- contextual secondary chooser for weapon/spell/skill/item/variant/slot/target when required;
- independent End Turn only when meaningful.

Action controls are 1:1 icon-only at rest. Hover and keyboard focus expose accessible descriptions including name, economy/resource cost, source, public range/targeting, public formula, effect/damage/healing summary, resource state and disabled reason. Relevant unavailable actions may remain visible but understandable. Production entries derive from canonical Action/capability presentation state rather than hardcoded class-name branches.

Preserve official intent vocabulary and existing `playerExperienceModel` semantics: Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study and Utilize. Skills remain secondary choices when an intent requires them. Freeform checks do not consume Initiative economy.

### Visual Dice
- actual production WebGL polyhedral d4/d6/d8/d10/d12/d20 using the existing physics path;
- depth/back-to-viewer motion, screen plane as tabletop/floor, fast spin then visible deceleration and short settle;
- target 1.0–1.4 s, hard UX ceiling 1.5 s;
- upper-middle slot-machine raw-result notice while moving;
- at settle, stop reel and expand to modifier/formula/final arithmetic;
- Natural 20 uses semantic green, Natural 1 semantic red, overriding user accent;
- standalone Sheet rolls may generate local results;
- connected runtime visuals only present/converge to Host-authoritative outcomes and never reroll mechanics state.

### Combat VFX
In Initiative, accepted/resolved attacks/spells may show short non-blocking source→target VFX.

Composable delivery/physical families:
- Slashing;
- Piercing;
- Bludgeoning;
- projectile/beam/wave/impact extension families.

Baseline elements:
- Fire;
- Lightning;
- Poison;
- Cold;
- Force;
- architecture also supports Acid/Radiant/Necrotic/Thunder/Psychic without per-spell screen special cases.

Delivery and element compose where possible. VFX derive from public canonical resolution/capability metadata, respect reduced motion, distinguish outcome honestly, do not expose hidden AC/resistance/immunity, and never alter authoritative outcomes.

### Appearance
V0.9 appearance consists of two independent presentation preferences:
1. Dark / Light mode;
2. user-selectable accent color.

Provide curated swatches plus a custom color picker. Mode/accent persist across restart. Accent affects primary actions, selection, hotbar icons and focus/highlight emphasis but must not override semantic success/error/hostile/ally/Natural-20/Natural-1 colors. Official Character Sheet is a layout mode, not a theme.

### Character Library and dual Sheet modes
The Character Library retains canonical create/import/edit/level-up/persistence flows and exposes a preferred default Sheet presentation.

Both modes use the same canonical Character:
- **SimpleVTT Sheet** — application-native interactive digital layout;
- **Official sheet layout** — interactive original SimpleVTT rendering that follows the recognizable standard D&D 5e paper Sheet information arrangement without copying logos/artwork.

Official Character Sheet layout must include:
- Character Name and top Class/Level, Background, Player Name, Race/Species, Alignment, XP fields where available;
- six vertical Ability blocks at far left;
- Inspiration, Proficiency Bonus, Saving Throws, full Skills, Passive Perception, proficiencies/languages;
- center AC shield, Initiative, Speed, HP/temp HP, Hit Dice/Death Saves;
- Attacks & Spellcasting table and Equipment/currency;
- right Personality Traits, Ideals, Bonds, Flaws, Features & Traits.

Supported checks/saves/skills/Initiative/attacks/damage/Hit Dice/resources/items remain interactive in both layouts.

Official Spellcasting Sheet must be a dedicated paper-layout page containing Character Name, Spellcasting Class/Ability, Save DC, Attack Bonus, Cantrips/level 0 and levels 1–9 with slot state and known/prepared state. Supported spell rows remain actionable. It must use the same spell/progression/resource state as the SimpleVTT Sheet.

### Session direct networking and addon parity
Offline Session always exposes both:
- Host: session name, Bind/Listen IP/interface, port, open/start/stop lifecycle;
- Join: Host IP/address, port, saved Character, Connect/Disconnect/Ready.

Do not replace direct IP/port with a fake invite code unless real discovery/invite is added separately.

Host preparation includes readable/copyable address, participants + Ready, empty fresh Encounter, deliberate Combatant add/remove, Freeform/Initiative start mode, contextual image preparation/reveal and Start/Stop.

Before Client Ready, automatically reconcile Host-required supported declarative content using the existing RuleModule/installed-content authority. Normal wording:
`콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`

Raw manifest/hash/RulesProfile/protocol detail is secondary troubleshooting information. Reconnect is idempotent and transfers only changed/missing content. Validation/sync failure blocks Ready with an actionable reason. No arbitrary Host-provided JS/native execution, second addon store or second mechanics/content protocol.

### Content, Rules, portraits and handouts
- Content/Addons remains local validated declarative RuleModule install/preview/validation with recoverable errors and compact creation help;
- Rules remains search/browse over composed installed catalog with provenance secondary;
- Character portrait is local PNG/JPEG/WebP presentation data owned/durable with the Character, with preview/crop/focal/replace/remove and bounded errors;
- DM handout uses local image preview/reveal/withdraw, Client dismiss/reopen/zoom/pan and reconnect restore without public-cloud URL requirements.

## Architecture invariants
Do not trade canonical architecture for prototype fidelity:
- Host remains connected mechanics authority;
- owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral;
- ResolutionEvent ledger, apply-before-cursor/replay/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime remains mechanics path;
- installed-content composition and RuleModule validation remain content authority;
- Freeform does not consume Initiative economy;
- dice/VFX/images/appearance are presentation only;
- official monsters/encounters are not silently rebalanced;
- no second Character/content store, combat resolver, protocol or event ledger;
- no tactical grid/token movement/Fog/pathfinding/minimap/LOS/cover/cloud-account dependency.

## Current sequence progress
The following V0.9 slices are now implemented on the work branch and are **validated on the current exact HEAD**. Do not repeat their targeted work unless later touched:

1. **Production Play**
   - one top Initiative strip;
   - NPC/hostile-above + party-below scene theater;
   - no permanent Play sidebars;
   - ActiveActorPanel + ResourceRail + grouped two-row icon Hotbar + contextual chooser + independent End Turn;
   - canonical `resolveAction`, `selectDmActor`, `startInitiative`, `endInitiative`, `endTurn` boundaries preserved;
   - Freeform non-consumption preserved.

2. **Fast Visual Dice**
   - production Three.js/cannon-es path retained;
   - depth-forward cinematic presentation within <=1.5 s;
   - slot-reel notice and formula/final result expansion;
   - Natural 20 / Natural 1 semantic states;
   - authoritative connected result boundary preserved.

3. **Composable Combat VFX**
   - presentation projection separated from mechanics;
   - delivery + element composition;
   - physical and elemental baseline families plus extension types;
   - Initiative-only bridge;
   - no hidden defense leakage and no mechanics mutation.

4. **Appearance**
   - independent Dark/Light mode + accent preference;
   - curated swatches + custom color picker;
   - startup application and restart persistence;
   - accent mapped through CSS variables while semantic good/bad states stay independent;
   - legacy fixed Theme/Accent controls retired from normal Settings reading path;
   - existing reduced-motion controls preserved.

## Exact-head validation evidence
Current work HEAD:
`669f867d3b8ce1ef94aa513e779e64c51ffa606e`

At this exact HEAD:
- UI workflow run `32171564923`, frontend job `95823699460`: **success**;
  - V0.9 product shell/appearance contract passed;
  - V0.9 Play structure/accessibility passed;
  - V0.9 Combat VFX projection/presentation boundary passed;
  - existing Phase 14/09 UI/mechanics regressions passed;
  - TypeScript + production build passed.
- Phase 11 Playable run `32171564939`, `offline-walkthrough` job `95823700000`: **success**, including full production frontend gate.
- The same run's Windows playable job `95823900153` was still building at checkpoint time; this is not a blocker for advancing the next targeted source slice and is not yet final V0.9 acceptance evidence.

Historical unchanged evidence remains valid and should not be rerun merely because a watcher invocation restarted:
- progression fixture repair `1d0a132f2941b131451e5a98715a2088d614fd42`;
- clean UI baseline `25c767893583da1809aa06bc0c875c14b8602154`;
- UI run `32162614993`, frontend job `95769907698`;
- prior desktop-guide head `3a2c83541857591ecb30aa03aa0a6285e23b7677`, UI run `32163607516`, frontend job `95797936721`.

The repository desktop demo remains historical where it conflicts with `.agents/V0_9_PRODUCT_REFERENCE.md`.

## Next Exact Action
1. Re-read `.agents/V0_9_PRODUCT_REFERENCE.md` from `agent/108-production-play-session-ux` before code changes.
2. Resume at the next incomplete V0.9 slice: **dual Character Sheet presentation**.
3. Inspect the current `CharacterSheetPlayScreen`, Character projection/state, spell projection/resources and Character Library without changing canonical Character ownership.
4. Implement a presentation preference over one Character:
   - `SimpleVTT Sheet`;
   - true paper-layout `Official sheet layout`;
   - default preference exposed from Character/Sheet UX and persisted as presentation state only.
5. Build the Official layout as real interactive React UI, not an image/PDF and not a parchment restyle of the SimpleVTT dashboard. Keep supported ability/save/skill/Initiative/attack/damage/Hit Dice/resource/item operations wired to the same existing handlers/services.
6. Add the dedicated official Spellcasting page with level 0–9 sections, spellcasting summary, slot state, known/prepared state and supported spell actions over the same canonical spell/progression/resource state.
7. Add targeted tests for:
   - both layouts reading the same Character identity/state;
   - layout preference persistence without a second Character store;
   - supported interactive controls present in Official mode;
   - spell page 0–9 structure and shared slot/spell state;
   - no mechanics arithmetic moved into presentation code.
8. Run only the affected UI/frontend gates first; do not rerun historical unchanged boundaries unless touched.
9. After dual Sheet is exact-head green, continue in order:
   - direct-IP Session + automatic validated content parity;
   - portrait + DM handout/reconnect;
   - contextual DM tools/Content/Rules polish and dead-legacy cleanup.
10. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation plus human Windows acceptance for V0.9.
11. Keep PR #109 draft/unmerged. Never merge without explicit user authorization.

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
- one top Initiative order + NPC-above/party-below scene + icon-only accessible Hotbar;
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
