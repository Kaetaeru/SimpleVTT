# SimpleVTT V0.9 Product Reference Contract

## Purpose
V0.9 is the product-convergence milestone before v1. It must turn the already validated SimpleVTT mechanics, Character, content, persistence and connected-session engines into one coherent desktop tabletop product.

The latest interactive HTML prototype created in the originating ChatGPT conversation is a **visual and interaction reference only**. It is not production architecture and its HTML/CSS/JavaScript shell must **not** be copied wholesale into the application.

Use the prototype to answer questions such as:
- what should the user see first?
- where should a control live?
- what should a roll/action feel like?
- how should the official-sheet presentation be organized?
- what visual feedback should an attack produce?

Do **not** treat the prototype as a component hierarchy, state model, data model, networking implementation, mechanics resolver, content source, or persistence design.

Production implementation must reuse the canonical React application shell, Character store/projection, installed-content composition, Host authority, Scene/runtime APIs, ResolutionEvent/Undo, reconnect/idempotency and existing physics-dice authority boundaries.

## Design precedence
For V0.9 user experience, use this order when documents conflict:
1. the newest explicit user direction recorded in this document;
2. this `V0_9_PRODUCT_REFERENCE.md` contract;
3. `.agents/V1_PLAY_SURFACE_REVISION.md` for scene-first Play and image behavior;
4. `.agents/V1_PRODUCT_EXPERIENCE.md` for product IA and reachability;
5. `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` and `.agents/PHASE14_PRODUCTION_UX_REDESIGN.md` for preserved runtime/UX boundaries.

The old demo-specific choices `Dark / parchment / Crimson prebuilt themes`, top-level permanent `Play` navigation, raw manifest-first session UI, and CSS/pseudo-3D dice are superseded.

---

# 1. Product shell and reachability

## Stable global navigation
Routine product navigation remains:

`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

`플레이` is contextual. When a live session exists, the shell exposes a clear `플레이로 돌아가기` action. Do not add Play, Encounter, Activity, adjudication, image management or debug surfaces as permanent global destinations.

The existing desktop product shell may be restyled, but V0.9 must not replace it with the prototype's static shell or create a second route system.

## Home
Preserve the established intent-first Home concept:
- prominent SimpleVTT title/identity;
- `새 캐릭터 만들기` and `내 캐릭터 열기` as primary Character entry;
- Host/Join entry when offline;
- active-session `플레이로 돌아가기` when live;
- Content/Addons and Rules entry points;
- dismissible/reopenable first-use guidance;
- tabletop-first explanation that a Character Sheet can be used alone without a session.

Home must not expose raw protocol state, package hashes, debug concepts, fixture/reference entities or internal role values.

---

# 2. Appearance system

## Required model
V0.9 does **not** use fixed full-product theme presets such as `Dark`, `Parchment`, or `Crimson`.

Appearance consists of two independent user preferences:
1. **Mode:** `Dark` or `Light`.
2. **Main / accent color:** user-selectable accent applied to primary actions, current selection, hotbar icons, focus/highlight treatments and other product emphasis.

Provide a small curated swatch set plus a custom color picker. The exact presets are secondary; the important contract is that mode and accent are independent.

## Persistence and accessibility
- appearance preference persists across restart;
- changing appearance must not change mechanics or Character data;
- success/warning/error/hostile/ally/Natural-20/Natural-1 colors remain semantically distinguishable from the user accent;
- Light and Dark modes both preserve readable contrast and keyboard focus.

The official Character Sheet presentation is a Sheet layout mode, **not** an application theme.

---

# 3. Character Library and dual Sheet presentation

## Library
Keep the canonical Character Library/create/import/edit/level-up/persistence flows. Add a preference for the default Sheet presentation:
- `SimpleVTT` digital layout;
- `Official sheet layout`.

Both modes operate on the same canonical Character and must never create parallel Character stores.

## SimpleVTT Sheet
The application-native Sheet remains a complete standalone tabletop surface with:
- identity, portrait, class/level, species/background;
- AC, HP/temp HP, Speed, Initiative, proficiency bonus, Passive Perception;
- abilities, saves, skills;
- attacks and damage;
- resources, Hit Dice, equipment, features, spell slots/spells;
- Advantage / Normal / Disadvantage for d20 checks;
- common polyhedral dice;
- recent local roll history;
- direct interactive rolls and supported resource operations.

## Official sheet layout — layout fidelity, not theme imitation
The official-style mode must reproduce the recognizable **information layout of the standard D&D 5e paper Character Sheet**, rendered with original SimpleVTT UI/assets and without copying protected logos/artwork.

It is not acceptable to take the SimpleVTT digital dashboard and merely apply parchment, serif type or borders.

### Character Sheet page composition
The interactive layout should follow the paper Sheet structure closely:
- top Character Name area;
- top identity grid for Class & Level, Background, Player Name, Race/Species, Alignment and XP where available;
- six large vertical Ability Score blocks on the far left with interactive modifiers;
- Inspiration and Proficiency Bonus near the upper-left center;
- Saving Throws list;
- full Skills list;
- Passive Perception and proficiencies/languages;
- central combat trio: AC shield, Initiative, Speed;
- Current HP, Max HP and Temporary HP;
- Hit Dice and Death Saves;
- Attacks & Spellcasting table with interactive Attack and Damage controls;
- Equipment/currency area;
- right-side Personality Traits, Ideals, Bonds, Flaws and Features & Traits regions.

The interactive behavior must remain available in this paper layout: checks, saves, skills, Initiative, attacks, damage, Hit Dice/resources and supported equipment actions are buttons/controls, not a static PDF screenshot.

### Spellcasting Sheet composition
Provide a dedicated official-sheet-style Spellcasting page with:
- Character Name;
- Spellcasting Class;
- Spellcasting Ability;
- Spell Save DC;
- Spell Attack Bonus;
- Cantrips / level 0;
- spell sections for levels 1 through 9;
- per-level slot total and expended/remaining representation where relevant;
- known/prepared state;
- supported spell rows actionable from the Sheet.

The spell page must follow the paper spell-sheet information architecture rather than the SimpleVTT spell dashboard with paper styling.

---

# 4. Visual Dice presentation

## Core visual concept
Visual Dice are a global presentation layer shared by standalone Sheet rolls and visible runtime resolutions. The visual must feel fast and physical, not like a modal dice minigame.

The die should appear to come **from the depth/back of the scene toward the viewer**, not simply drop from the top edge to the bottom edge.

The current visual reference is:
1. a die begins small/far away behind the main UI plane;
2. it travels rapidly forward on the camera/depth axis while spinning fast;
3. the screen plane reads as a tabletop/floor;
4. the die contacts that plane, makes one or two short bounces/rolls, and rapidly loses angular velocity;
5. visible rotation changes from fast to deliberately slower before the final stop;
6. the die remains on screen briefly after resolution and then clears without blocking input.

## Timing contract
Routine rolls must resolve quickly.
- target total visual roll-to-result time: approximately 1.0–1.4 seconds;
- hard UX ceiling: **1.5 seconds** from roll trigger to settled raw result and resolved notification;
- reduced-motion mode may shorten this further while preserving result clarity.

Avoid long cinematic throws that slow routine tabletop play.

## Geometry and authority
- production uses actual WebGL polyhedral d4/d6/d8/d10/d12/d20 meshes and the production physics path;
- CSS-transform pseudo-dice do not qualify;
- standalone Sheet rolls may generate local results;
- connected runtime results remain Host-authoritative, and Visual Dice must converge/present the already-authoritative outcome rather than rerolling mechanics state.

## Mid-upper result notification
Every visible die roll is paired with a compact notification near the upper-middle of the workspace.

### Rolling state
While the die is moving:
- notification appears immediately;
- show roll/action label and die type;
- raw-result numeral cycles vertically/rapidly like a **slot-machine reel**;
- cycling is presentation only and must not imply authoritative results are changing.

### Settled state
When the physical die settles:
- reel stops on the raw result;
- notification expands horizontally to the right;
- expansion reveals the modifier/formula and final arithmetic;
- example: `d20 17 + 7 = 24`;
- for Advantage/Disadvantage, show the chosen raw die result plus a concise two-dice breakdown;
- damage/healing/multi-die formulas show their final aggregate honestly.

### Critical d20 states
- **Natural 20:** result notification uses a clearly green success/critical treatment.
- **Natural 1:** result notification uses a clearly red failure/fumble treatment.
- user-selected accent must not override these semantic states.

The final arithmetic notification is the main readable result; the die is visual feedback, not the sole source of truth.

---

# 5. Play composition

## Scene-first rule
Play must feel like a tabletop scene first and a control panel second. Do not restore permanent left/right participant, Inspector, Activity, image or debug sidebars.

## Top Initiative strip
Play reserves one compact horizontal Initiative-card strip at the top of the Play workspace.
- Freeform: quiet/collapsed/non-dominant.
- Initiative: the strip becomes the **single visible canonical turn order** with round/current-turn emphasis.
- do not show a duplicate Initiative sidebar or second tracker.

## Scene Actors theater
The scene area preserves the latest user-directed theater composition:
- NPC/hostile/scene Actors in the **upper** row/area;
- Player/party Actors in the **lower** row/area;
- readable open scene space between them;
- compact Actor cards show only useful presentation state such as portrait/identity, side, HP/status, selected/current/targetable state.

Actor cards are not inspectors and must not contain full inventory/rules/provenance metadata.

## DM image behavior
- Freeform reveal replaces the Actor scene surface while keeping header/HUD available;
- Initiative reveal opens as a focused lightbox/modal while the Initiative context remains underneath;
- player-local dismiss/minimize is distinct from DM withdraw;
- active reveal can be reopened;
- reconnect restores current reveal;
- reveal remains presentation state, not ResolutionEvent/combat mechanics state.

---

# 6. BG3-inspired bottom action HUD

Only the **bottom HUD/action-bar composition** is borrowed from the RVTT/BG3-inspired reference. Do not add party rails, top ribbons beyond the one SimpleVTT Initiative strip, minimap, tactical map, movement path, LOS/cover overlays or 3D battlefield features.

## ActiveActorPanel
Bottom-left contains the active Actor presentation:
- portrait;
- name / level / classification;
- HP / temp HP when relevant;
- movement and action economy in combat;
- spell/class resource summary;
- major status/concentration where useful.

Freeform must represent the lack of turn economy honestly rather than pretending Action/Bonus/Reaction are being spent.

## Category tabs
Bottom-center retains presentation filters:
`공통 · 클래스 · 주문 · 아이템 · 패시브 · 커스텀`

## Common shelf grouping
The `공통` tab is a curated shelf divided visibly into useful groups, including:
- basic/common actions;
- intent/situational actions;
- class/features;
- spells/cantrips;
- items/consumables.

Intent-first behavior is preserved. Influence, Search, Study, Utilize and Magic may reveal secondary skill/item/spell choices rather than exposing every skill as a top-level button.

## Icon-only controls
- action buttons are square 1:1 icon-only controls at rest;
- action name is not printed inside the button;
- every capability gets a purpose-built icon/presentation asset;
- hover and keyboard focus expose a detailed description containing name, economy/resource cost, source, public range/targeting, public formula, effect/damage/healing summary, resource state and disabled reason;
- relevant-but-unavailable actions may remain visible disabled and must still be keyboard understandable;
- production buttons are generated from canonical capability/action presentation state, not hardcoded class-name branches.

## Contextual action flow
Selecting a capability may open a compact contextual chooser for the required next decision: weapon, spell, skill, variant, slot, target or other rule-driven option. After required choices, submit through the existing authoritative action runtime.

## End Turn
A large independent End Turn control sits at the bottom-right when meaningful. It must not consume visual space in Freeform as if a turn were active.

---

# 7. Combat action VFX

## Goal
When an attack/spell is resolved in Initiative, SimpleVTT provides a short non-blocking visual motion between the acting Actor and target. VFX make the resolution legible and satisfying but never change the authoritative result.

VFX should be fast enough to coexist with the 1.5-second dice rhythm and routine combat. Avoid long cutscenes.

## Composable model
Treat **delivery / physical damage type** and **element/energy type** as separate presentation dimensions where possible.

### Delivery / physical motion family
- **Slashing:** sweeping curved slash arc(s), lateral cutting trail.
- **Piercing:** narrow fast linear thrust/projectile with a small puncture ring/impact.
- **Bludgeoning:** heavy direct impact followed by concentric shockwave and stronger short screen/stage shake.
- projectile, beam, burst/area and other delivery families may be added as needed by capability metadata.

### Element / energy visual family
Element chooses light color, particles, residue and secondary motion. Initial V0.9 profiles should include:
- Fire — orange/red/yellow heat trail and burst;
- Lightning — blue-white jagged electrical segments/arcs;
- Poison — green toxic projectile/mist/cloud;
- Cold — cyan/ice shard and frost-like impact;
- Force — violet/magenta energy projectile and pressure wave.

Architecture should permit later profiles such as Acid, Radiant, Necrotic, Thunder and Psychic without special-casing each spell screen.

### Composition example
A future flaming sword should be able to use a `Slashing` motion family plus `Fire` color/particle treatment rather than requiring a completely separate hardcoded animation.

## Runtime/metadata contract
Production VFX selection should derive from public authoritative resolution/capability presentation metadata such as attack delivery, damage component/type and spell/effect identity. Do not infer hidden resistances, secret AC or DM-only state for visuals.

For multiple damage components, choose a deterministic primary visual and optionally layer a restrained secondary element. Do not create visual noise that makes the result harder to read.

## Targeting and timing
- VFX begins only after the action has a valid source/target and the authoritative resolution path has accepted/submitted the action;
- miss/save/no-effect cases need distinct non-deceptive outcomes; do not play a full hit burst for a miss;
- hit impact may use a very short stage shake, never a disruptive camera takeover;
- reduced-motion mode replaces large motion with compact flash/line/result emphasis.

---

# 8. Session direct networking and addon parity

## Offline entry
One stable Session surface contains both:
- Host: session name, Bind/Listen IP/interface, port, `세션 열기`;
- Join: Host IP/address, port, saved Character, `참가하기`.

Do not replace these with a fake invitation code unless a real discovery/invite transport is added in addition.

## Host preparation
After opening a Host:
- show session name and copyable/readable player address;
- participants + Ready state;
- Encounter starts empty;
- DM deliberately adds/removes Combatants;
- Freeform / Initiative start mode;
- contextual image preparation;
- Start and Stop.

Fresh Host must not preload fixture Goblins/Wolves/reference actors.

## Automatic addon/content parity before Ready
The Host-required declarative content is compared automatically on Join/reconnect.

User-facing normal flow should say human-readable states such as:
`콘텐츠 확인 → 필요한 콘텐츠 받기 → 검증 → 준비 완료`

Do not lead the normal Session UI with raw `manifest`, hash, RulesProfile, protocol or package-internal terminology. Detailed package metadata may exist behind progressive disclosure for troubleshooting.

Behavior:
1. compare supported package identity/version/hash/revision;
2. receive only missing/different session-required packages;
3. validate with the existing RuleModule parser, size/type, dependency/conflict/capability and installed-content composition rules;
4. block Ready on a recoverable validation/sync failure and state the reason/action;
5. reconnect comparison is idempotent and transfers only changed/missing data.

This cannot introduce arbitrary Host-provided JavaScript/native execution, a second addon store, a second mechanics protocol or a second durable content authority.

---

# 9. Content, Rules and DM contextual tools

## Content / Addons
Keep the v1 declarative addon model:
- local RuleModule JSON picker;
- package/entry preview;
- validation before install;
- visible recoverable errors;
- explicit final install;
- installed content grouped/readable;
- compact `애드온 만드는 방법` guide.

## Rules
Rules remains search/browse of the composed installed catalog. Search/category/name/summary are primary; IDs/source/version/provenance are secondary details.

## DM tools
Encounter/Combatants, participant status, adjudication/correction, Activity/history and safe Undo are contextual live-play tools, not permanent sidebars or global nav destinations.

---

# 10. Architecture invariants — do not trade these for prototype fidelity

V0.9 visual work may not break the following:
- Host owns connected mechanics authority;
- owning Client Character Library remains durable Character source;
- Host Character projections remain ephemeral;
- existing ResolutionEvent ledger, apply-before-cursor behavior, replay/reconnect/idempotency and event-native Undo remain canonical;
- existing Scene/runtime action APIs remain the mechanics path;
- installed-content composition and declarative RuleModule validation remain content authority;
- Freeform checks do not consume Initiative economy;
- images are presentation state;
- dice/VFX are presentation and may never rewrite authoritative connected outcomes;
- official monsters/encounters are not silently rebalanced by UI work;
- no second Character store, combat resolver, content store, protocol or event ledger;
- no tactical grid, token movement, Fog of War, pathfinding, minimap, LOS/cover or cloud-account dependency for V0.9.

---

# 11. V0.9 implementation order

Implement in production architecture, not by transplanting demo markup.

1. **Reference-contract tests / presentation models**
   - codify stable nav and contextual Play;
   - codify Light/Dark + accent preference;
   - define reusable action-icon/tooltips/VFX presentation metadata contracts.
2. **Play surface**
   - top single Initiative strip;
   - NPC-above / party-below Scene Actors theater;
   - no permanent sidebars;
   - RVTT/BG3-inspired bottom ActiveActorPanel + tabs + grouped two-row icon Hotbar + contextual chooser + independent End Turn.
3. **Visual Dice presentation**
   - production physics renderer tuned to <=1.5s routine cadence;
   - depth-to-camera throw/roll visual;
   - mid-upper slot-reel notification;
   - formula expansion; Nat20 green / Nat1 red;
   - connected authoritative-result convergence.
4. **Combat VFX**
   - composable delivery + element presentation profiles;
   - Slashing/Piercing/Bludgeoning and Fire/Lightning/Poison/Cold/Force baseline;
   - hit/miss/reduced-motion behavior;
   - metadata-driven mapping and targeted tests.
5. **Appearance Settings**
   - Dark/Light;
   - curated accent swatches + custom color;
   - persistence/contrast/accessibility.
6. **Character dual Sheet**
   - preserve SimpleVTT sheet interactions;
   - implement actual official paper-sheet information layout;
   - dedicated level 0–9 Spellcasting Sheet;
   - same Character data and roll/resource services.
7. **Session**
   - direct Host/Join IP + port;
   - empty Host Encounter prep;
   - human-readable automatic content parity + Ready gating;
   - reconnect parity.
8. **Portrait and DM handout**
   - durable Character portrait;
   - local DM image reveal/withdraw/dismiss/reopen/zoom/pan/reconnect.
9. **Contextual DM tools / Rules / Content polish**
   - remove dead legacy UX and technical wording from routine paths.
10. **One exact-head V0.9 acceptance**
   - UI, TypeScript/build, mechanics, persistence, installed-content, connected authority and Windows artifact gates;
   - human Windows walkthrough for first launch, both Sheet modes, appearance modes/accent, sheet-only dice, Host/Join direct IP, addon sync, Freeform, Initiative, attack VFX and image reveal;
   - PR remains draft/unmerged until explicit authorization.

---

# 12. V0.9 Definition of Done

A V0.9 release candidate is acceptable only when one exact source SHA demonstrates all of the following together:

- Home/product shell exposes all normal workflows without Debug Dock/repository knowledge;
- stable global nav is Home/Characters/Session/Content/Rules/Settings, with contextual live Play return;
- Character create/import/edit/level-up/persistence remain functional;
- SimpleVTT Sheet and official paper-layout Sheet operate on the same Character and are both interactive;
- official Spellcasting Sheet uses level 0–9 paper-sheet structure;
- portrait is durable and safe offline/restart;
- appearance uses independent Light/Dark + main accent color, persisted and accessible;
- standalone Sheet can roll normal checks/saves/skills/Initiative/attacks/damage/Hit Dice/common dice and manage normal resources;
- Visual Dice use real 3D meshes/physics, depth-forward motion, <=1.5-second normal cadence and slot-machine/result-formula notification;
- Natural 20 is green and Natural 1 is red regardless of chosen accent;
- Play has one top Initiative order, NPCs/hostiles above, party below, no permanent Play sidebars and a bottom icon HUD generated from canonical capability state;
- icon buttons expose accessible detailed hover/focus information and disabled reasons;
- combat visual feedback supports baseline physical delivery and elemental profiles without changing mechanics outcomes;
- direct-IP Host/Join/Ready/start/stop/reconnect works;
- automatic declarative content parity is validated before Ready and does not expose internal manifest jargon as primary UX;
- fresh Host Encounter is empty and official Combatants are added intentionally with unchanged official stats;
- DM image reveal/withdraw and Client dismiss/reopen/reconnect work as presentation state;
- all touched production code is implemented using canonical React/services/runtime architecture rather than copying the reference prototype shell;
- exact-head automated gates and human Windows acceptance are green;
- no merge occurs without explicit user authorization.
