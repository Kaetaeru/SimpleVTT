# SimpleVTT v1 Product Experience

## Product boundary
SimpleVTT v1 is a complete tabletop product, not a collection of development surfaces. Existing rule evaluation, Character persistence, installed-content composition, connected-session authority, ResolutionEvent history/Undo, reconnect/idempotency and combat runtime remain canonical. The v1 work replaces the user-facing shell, information architecture and screen composition around those engines.

A normal user must be able to launch the executable with no repository knowledge and discover every supported production workflow from the UI.

## Product principles
1. **Start from intent, not implementation.** Primary UI says what the user can do: create a Character, open a sheet, join a session, host a session, add an addon, search rules, play.
2. **One product shell.** No role-dependent replacement application, overlapping portal shell or hidden debug route is required for ordinary play.
3. **Context over permanent panels.** Initiative, targets, DM adjudication, Activity, Combatants and handouts appear only where the current task needs them.
4. **Progressive disclosure.** Content IDs, provenance, protocol status and validation internals are secondary details.
5. **Preserve authority.** UI never creates a second Character store, mechanics resolver, session authority, event ledger or content catalog.
6. **Tabletop-first.** A Character Sheet must work alone at a physical table; connected VTT play is an additional mode, not a prerequisite.
7. **No surprise content.** A fresh Host starts with an empty Encounter; official source Combatants retain their official statistics and are added intentionally.

## Global information architecture
The stable top-level product navigation is deliberately small:

- **홈** — title, first-run guide, Character/session/addon entry points and current-context shortcuts.
- **캐릭터** — Character Library, create/import/edit/level-up, standalone sheet.
- **캠페인·세션** — DM Campaign create/open, Campaign-based Host start, join, Ready/preparation/lifecycle/reconnect.
- **콘텐츠** — installed content and addon installation/review.
- **규칙** — browse/search the composed installed rules catalog.
- **설정** — appearance, accessibility and product preferences.

`플레이`, `Encounter`, `Activity`, DM correction and image handouts are contextual session tools, not permanent global destinations. A live session exposes a clear `플레이로 돌아가기` action from the shell.

## Launch and Home
### First launch
The first meaningful screen is a SimpleVTT title/home screen. It must answer four questions without documentation:
- 캐릭터를 만들거나 기존 시트를 열려면?
- 세션에 참가하려면?
- DM으로 세션을 만들려면?
- 애드온/콘텐츠를 추가하려면?

Primary actions:
- `새 캐릭터 만들기`
- `내 캐릭터 열기`
- `세션 참가하기`
- `세션 만들기`

Secondary actions:
- `애드온 추가`
- `규칙 찾아보기`

A concise first-run guide explains: Character -> optional content/addon -> physical-table sheet or Host/Join session. It is dismissible and can be reopened. It must not block use of the app.

### Returning Home
Show only useful current context:
- active/recent Character and `시트 열기`;
- active connected session and `플레이로 돌아가기` when applicable;
- Host/Join shortcuts when offline;
- installed-content health and `콘텐츠 관리`;
- first-use guide entry.

Do not place debug state, raw role, protocol versions, content IDs or Activity history on Home.

## Characters and standalone sheet
### Character Library
Reachable from Home and global navigation. Supports the already implemented Character creation/import/edit/level-up/persistence flows.

### Character Sheet
The Sheet is a first-class standalone tabletop surface:
- identity, class/level, species/background, portrait;
- AC, HP/temp HP, Speed, Initiative, Proficiency Bonus, Passive Perception;
- abilities, saves, skills;
- attacks/damage;
- resources, Hit Dice, equipment, features, spell slots/spells;
- direct ability/save/skill/Initiative/attack/damage/common-die rolls;
- Advantage/Normal/Disadvantage where relevant;
- recent local sheet-roll history;
- `기기로 플레이` as a contextual path into Session/Play, never a prerequisite.

Character portrait requirements remain as defined in `PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`: local PNG/JPEG/WebP, preview, crop/focal adjustment, replace/remove, owning-Character durability, offline/restart safety and bounded invalid-image handling.

## Contents / Addons
The existing installed-content architecture is the v1 addon system. v1 does **not** invent arbitrary executable plugins.

### Content screen
The `콘텐츠` screen provides:
- builtin content summary;
- locally installed content grouped by source/module where possible;
- `애드온 추가` using a local JSON package file;
- file metadata and package preview before installation;
- structural/semantic/dependency/conflict/capability validation;
- explicit final install action only when blocking validation is clear;
- visible recoverable errors;
- a compact `애드온 만드는 방법` guide based on the supported RuleModule package format.

### Supported package model
The current production importer accepts declarative RuleModule packages with `schemaVersion: "0.1-draft"`, `moduleId`, `moduleVersion`, `rulesProfile`, `defaultLocale`, `source`, optional dependency/conflict/capability metadata and a non-empty `content` array. The v1 guide must describe this supported declarative boundary honestly. Unsupported executable mechanics must not be implied to work.

Rules browsing is separate from installation: `콘텐츠` manages what is installed; `규칙` searches what the composed catalog currently exposes.

## Session lifecycle
### Offline
One Campaign/Session screen always exposes:
- `캠페인 만들기` / recent Campaign open for DM preparation;
- `세션 만들기`: select/open a Campaign, review Session settings and start Host;
- `세션 참가하기`: Host address and local Character selection.

The Campaign is the DM's durable continuity root. Its Party Stash, calendar/ration state, Session history and private DM Library survive individual Sessions and remain isolated from other Campaigns. See `docs/design/campaign-runtime.md`.

The Campaign dashboard also owns the durable party roster used for ration participation and stash policy. This roster references Player Characters without copying or taking ownership of their Character files. Detailed subsystem behavior is defined in `docs/design/campaign-systems.md`.

### Host preparation
Show only:
- selected Campaign identity;
- session name/address;
- optional `세션 달력 사용` and `식량 규칙 사용` settings captured for this Session;
- connected participants and Ready state;
- empty-by-default Encounter preparation;
- deliberate Combatant add/remove;
- mode selection (freeform/initiative) and Start;
- contextual `이미지 보여주기` preparation/reveal;
- Stop.

### Client lobby/live/recovery
Show Character, session identity, Ready, understandable reconnect/leave state and a direct path into Play. Stopping or ending a session returns to a stable offline shell with Host and Join still reachable.

## Play experience
### Exploration / social / freeform
The default production play surface is quiet. Show:
- active Character/creature summary;
- scene/session identity;
- intent actions;
- targets/participants only when an action needs them;
- the current/recent result only while useful.

Do not reserve permanent columns for entity lists, Inspector, Activity, diagnostics or image management.

### Intent-first actions
Primary official 2024 Free Rules vocabulary:
- Attack
- Dash
- Disengage
- Dodge
- Help
- Hide
- Influence
- Magic
- Ready
- Search
- Study
- Utilize

Skills are secondary choices under the relevant intent. Examples: Influence -> social skills; Search -> Perception/Insight/etc.; Study -> knowledge skills; Hide -> Stealth. Individual skill checks are not a wall of top-level actions.

### Combat / Initiative
Entering Initiative adds only combat-specific information to the same surface:
- round/current turn;
- compact turn order;
- action/Bonus Action/Reaction/movement economy;
- explicit targets when required;
- relevant HP/status summaries;
- End Turn when appropriate.

Existing authoritative attacks, saves, damage, healing, items, spells, concentration, reactions, effects, turn runtime and ResolutionEvent/Undo remain the mechanics path.

### DM contextual tools
DM controls are opened from the live play context, not global navigation:
- acting creature / turn control;
- Encounter/Combatant access;
- adjudication/correction and safe Undo/history as progressive disclosure;
- participant/Ready state where relevant;
- Campaign calendar, rations and Party Stash only when enabled/authorized;
- Campaign-scoped DM Library quick search/grant/reveal;
- `이미지 보여주기` handout/reveal.

### Mapless fallback and module capability
V1 prepares the coordinate-agnostic spatial extension seam but does not ship a battle map. Without an active compatible module, distance/visibility/cover UI and related disabled reasons are inactive. Missing distance is never interpreted as `out-of-range`; otherwise valid manual targets remain selectable. Stale facts from a removed or failed module cannot continue to block play.

## Images
### Character image
Portrait is integrated into sheet identity, not a separate manager. It follows owning-Character durability and remains presentation metadata when projected into a connected session.

### DM handout
DM can choose a local PNG/JPEG/WebP, preview, optionally title/describe it, reveal to all connected players and withdraw it. Players can dismiss/minimize/reopen the active reveal and zoom/pan locally. Reconnect restores the currently active reveal. Transfer requires no public URL or cloud host. It is connected presentation state, not ResolutionEvent/combat state.

No permanent image panel, tactical grid, token system, Fog of War, pathing or LOS is introduced.

## Real 3D dice
The shared visual dice system uses actual WebGL polyhedral meshes and physics for d4/d6/d8/d10/d12/d20. Gravity, collisions, friction/restitution and angular motion must be visible. CSS-transform pseudo-3D does not qualify.

Standalone sheet dice may create their own local result. Connected runtime dice only present already-authoritative results and may never change mechanics state. Creation, level-up, sheet rolls and runtime resolution use the same visual language.

## Feature reachability matrix
A v1 user must be able to reach these without Debug Dock or repository knowledge:

| Capability | Product entry |
| --- | --- |
| Character create/import/edit | Home -> Characters |
| Character persistence / reopen | Characters / Sheet |
| Level-up and class choices | Sheet -> Level Up |
| Standalone tabletop rolls | Sheet |
| Character portrait | Sheet identity |
| Addon install / validation | Content -> Add addon |
| Installed rules browsing | Rules |
| Host / Join / Ready / reconnect | Session |
| Campaign create/open and Campaign-based Host start | Campaign / Session |
| Calendar/ration optional rules | Session setup / contextual DM tools when enabled |
| Campaign Party Stash | Campaign / contextual Session utility |
| Campaign-scoped DM Library | Campaign preparation / DM Quick Search |
| Empty Encounter preparation | Host Session |
| Combatant library/add/remove | Host preparation / contextual DM tools |
| Exploration/freeform intents | Play |
| Initiative / turn economy | Play when Initiative is active |
| Attacks / saves / damage / healing | Play -> authoritative resolution |
| Items / spells / concentration / reactions | Sheet and contextual Play |
| Resolution history / safe Undo | contextual result/DM tools |
| Physics dice | Sheet + visible runtime resolutions |
| DM image handout | contextual DM Play |
| Appearance / reduced motion | Settings |

## UI composition rules
- One obvious primary action per task area.
- Global nav remains small and stable.
- No permanently open Inspector, Activity, entity list, image manager or debug/provenance panel in routine play.
- Drawers, popovers, details and lightboxes must be temporary/contextual and keyboard reachable.
- Every long screen owns a reliable scroll viewport; constrained Windows/Tauri viewports are first-class.
- Focus, selected, disabled, error and reconnect states must be visually distinct.
- Reduced-motion mode preserves information and results.
- Technical metadata is available when useful but never required for ordinary play.

## Non-goals for v1
- built-in tactical grid/map movement, token placement, Fog of War, pathfinding or LOS; v1 provides only the optional module capability seam and safe mapless fallback;
- full fictional-calendar authoring, automatic travel/weather/hunting/nutrition simulation or detailed encumbrance;
- cloud Campaign sync, multi-DM concurrent Campaign editing or implicit cross-Campaign DM Library sharing;
- cloud account/backend dependency;
- arbitrary executable third-party plugins;
- a second Character store, content catalog, combat resolver, connected-session protocol or event ledger;
- balance rewrites of official monsters/encounters as a UI concern.

## v1 Definition of Done
SimpleVTT v1 UX is complete only when **one exact source SHA** passes all of the following.

### Fresh-user product walkthrough
1. Launch the Windows executable with no product knowledge.
2. Home/title clearly exposes Character, Host, Join, Addon and Rules entry points.
3. First-use guidance explains the two valid play modes: standalone sheet at a physical table and connected VTT.
4. No normal workflow requires Debug Dock, editing JSON in a text area as the only file path, or repository documentation.

### Character/tabletop walkthrough
1. Create/import and persist a Character.
2. Add/position/replace/remove a portrait and verify restart durability.
3. Use only the Sheet to roll abilities, saves, skills, Initiative, attacks, damage and common dice.
4. Operate Hit Dice, spell slots and normal resources without entering a Scene.
5. Level up and reopen the resulting Character after restart.

### Addon/content walkthrough
1. Open Content from Home/global nav.
2. Pick a local supported RuleModule JSON file.
3. Review module/source/entries and validation before installation.
4. Install only when blocking validation is clear.
5. Confirm installed entries appear in the composed Rules/creation/content surfaces after restart.
6. Invalid/dependency/conflict/unsupported packages fail visibly and recoverably.

### Session/connected walkthrough
1. Create/open a Campaign, configure optional calendar/ration rules, Host a named empty Session from it and independently Join from another Windows instance.
2. Select a persisted Host-unknown Client Character, Ready and start freeform/initiative.
3. Validate authoritative actions, convergence, reconnect/idempotency, explicit end/restart and owning-Client durability.
4. Validate Campaign Party Stash/calendar/ration continuity exactly once across Session restart while transient participants/readiness/Initiative clear.
5. Session scrolling and recovery controls remain usable at constrained viewport heights.

### Play/DM walkthrough
1. Exploration is visually quiet and intent-first; skills are secondary choices.
2. Initiative adds turn/economy/target information without replacing the whole information architecture.
3. Existing attack/save/damage/healing/item/spell/concentration/reaction/effect/turn mechanics remain authoritative.
4. DM can prepare official Combatants deliberately, adjudicate/recover without permanent debug panels and safely use existing event-native Undo.
5. DM can reveal/withdraw an image; Client can dismiss/reopen it; reconnect converges to the active reveal.
6. Without a spatial module, missing distance/visibility/cover never produces an out-of-range-style blocker; with a validated provider, only its current authoritative facts affect legality.
7. Campaign-scoped DM Library search/grant does not leak private catalog data or entries from another Campaign.

### Dice and quality gates
1. d4/d6/d8/d10/d12/d20 are actual WebGL physics meshes and connected visuals never alter authoritative results.
2. TypeScript, production frontend build, UI structure/accessibility, mechanics regressions, persistence, installed-content and connected-authority suites are green at the same exact SHA.
3. Exact-head Windows executable/artifact is built and digest/contents verified.
4. Human Windows acceptance passes first-launch, standalone-sheet, addon-install and two-instance Host/Client journeys at that same SHA.
5. PR remains draft/unmerged until explicit merge authorization.
