# Phase 14 Player Experience Redesign

## Why this boundary is reopened
Human acceptance established that the current production experience is still shaped like a debug/runtime console rather than a tabletop tool. Two prior assumptions are explicitly withdrawn:

1. CSS perspective/transform dice are not accepted as physical 3D dice.
2. A flat action grid containing individual skill checks is not accepted as the primary exploration/combat interaction model.

The redesign must preserve the validated mechanics, Host authority, connected ledger, Character ownership, persistence, ResolutionEvent flow, reconnect/idempotency and Undo architecture while replacing the user-facing play composition.

## Product goals
SimpleVTT must support two equally valid ways to use one Character:

- **Digital sheet at a physical table:** keep only the Character Sheet open, read all normal sheet information, and roll ability checks, saving throws, skills, attacks, damage and common dice directly from the sheet without entering a VTT scene.
- **Device-native play:** join or host a session and use a purpose-built exploration/combat surface that drives the existing authoritative runtime.

The sheet and the play surface share the same Character data and dice visual language, but they are not the same workflow.

## Pillar A — real physics 3D dice
### Required
- WebGL-rendered polyhedral meshes for d4, d6, d8, d10, d12 and d20.
- Physics world with gravity, floor collision, restitution, friction and angular velocity.
- Dice must visibly tumble and settle in 3D; CSS transform-only pseudo-3D is rejected.
- Runtime authoritative results remain authoritative. Physics is presentation and must converge to the already-approved face rather than rerolling game state.
- Standalone sheet rolls may generate their own local random result, because they model a physical-table die roll rather than a connected authoritative action.
- Reduced-motion mode keeps the result readable and may shorten/skip the tumble, but must not hide the result.
- One shared renderer is used for Character creation rolls, level-up Hit Die, standalone sheet rolls and runtime Resolution replay.

### Not allowed
- six generic CSS facets pretending to be every die shape;
- fixed keyframe-only tumbling presented as physics;
- visual dice changing Host-authoritative results.

## Pillar B — Character Sheet as a complete tabletop surface
The normal Character Sheet becomes independently usable without a Scene.

### Primary information
- identity, class/level, species/background;
- AC, HP/temp HP, Speed, Initiative, Proficiency Bonus, Passive Perception;
- six abilities;
- saving throws;
- skills;
- attacks and damage;
- resources, features, equipment and spells.

### Direct interactions
- click/tap an ability modifier -> ability check;
- click/tap a saving throw -> saving throw;
- click/tap a skill -> that skill check;
- click/tap an attack -> attack roll, then damage roll when desired;
- click/tap Initiative -> Initiative roll;
- Hit Dice and spell slots can be read and adjusted from the sheet without entering a Scene;
- common dice tray for d4/d6/d8/d10/d12/d20;
- Advantage / Normal / Disadvantage selector for d20 checks;
- result history local to the sheet session.

### Information hierarchy
The sheet should look and behave like a usable digital character sheet, not a dashboard of nested windows. Rules provenance and implementation metadata stay behind progressive disclosure.

## Pillar C — exploration/freeform/combat rebuilt around intent
The current three-column Scene + ActionConsole + side Inspector composition is not the target design.

### Official action vocabulary
The primary Action chooser uses the 2024 Free Rules action vocabulary:
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

Class features, Bonus Actions, Reactions and other explicit options may appear contextually in separate compact groups.

### Crucial interaction rule
**Do not expose every skill as a top-level action.**

The user first expresses intent. The UI then asks for the relevant detail only when necessary.

Examples:
- `Influence` -> Deception / Intimidation / Performance / Persuasion or Animal Handling as appropriate.
- `Search` -> Insight / Medicine / Perception / Survival.
- `Study` -> Arcana / History / Investigation / Nature / Religion.
- `Hide` -> Stealth.
- `Attack` -> choose available weapon/unarmed attack, then target.
- `Magic` -> choose spell/magic item/feature, then target if required.
- `Utilize` -> choose a usable nonmagical item or describe the interaction.
- an improvised action that does not fit a listed action -> DM decides whether a D20 Test is required.

## Pillar D — images as tabletop presentation, not another dashboard
Images are presentation assets. They must not become rules authority, a tactical-map subsystem, or another permanently open workspace.

### Character Sheet portrait
A Character can own a portrait/image that is visible directly on the normal sheet.

Required behavior:
- choose a local PNG, JPEG or WebP image;
- preview before accepting;
- replace or remove the image;
- adjust crop/focal position so portrait-oriented and landscape source images can both fit the sheet cleanly;
- keep the portrait integrated into the sheet identity/header area instead of opening a separate image-management window;
- persist the portrait with the owning Character so the same sheet works offline and after application restart;
- preserve Character ownership: the owning Client's Character storage remains durable authority and the Host must not silently mutate the source portrait;
- if a Character portrait is projected into a connected session, it is presentation metadata only and cannot affect mechanics or Character authority;
- reject malformed/unsupported or over-limit assets with a user-facing recovery message instead of crashing or silently dropping the image.

The Character Library or compact play summaries may reuse a thumbnail of the same portrait when useful, but they must not introduce a second image source or duplicate image editor.

### DM `이미지 보여주기`
The DM needs a lightweight theater-of-mind handout/reveal action inside the production play surface.

Required behavior:
- choose a local PNG, JPEG or WebP image from the DM device;
- preview it before revealing it to players;
- optionally provide a human-readable title/caption/alt description;
- reveal the current image to all connected players with one explicit DM action;
- hide/withdraw the current reveal with one explicit DM action;
- a player may close/minimize the viewer locally without leaving the session, and can reopen the currently revealed image while it remains active;
- the viewer supports fit-to-window and user-controlled zoom/pan without changing shared game state;
- if a player reconnects while an image is currently revealed, the reconnect projection restores that current reveal instead of requiring the DM to resend it;
- revealing/hiding an image is presentation state, not a ResolutionEvent and not part of combat adjudication/Undo;
- image transfer must work over the existing connected-session path without requiring a public URL or third-party cloud host;
- malformed, unsupported or over-limit assets must fail visibly and recoverably;
- image display must remain keyboard reachable and must not trap focus.

### UX boundary for DM images
- `이미지 보여주기` is a compact contextual DM control, not a permanent side panel.
- A revealed image opens as a focused handout/lightbox layer and may be dismissed/minimized by the player.
- Exploration/combat controls remain available after dismissing the handout.
- This feature does not introduce a tactical map, token placement, grid, distance, pathing, fog of war or LOS.
- A small DM-local recent-handout/reuse list is acceptable, but it must remain secondary/progressive disclosure and must not become another primary window.

### Asset and transport safety
- Rules data and image bytes/references remain separate concerns.
- Apply explicit file type, decoded-dimension and payload-size limits before persistence or network transfer.
- Downscale/compress a session projection when needed rather than sending an unbounded original file to every Client.
- Releasing a Character, ending a session or replacing a handout must release obsolete in-memory object URLs/buffers.
- External image URLs are not required for completion and must not be the only way to use either feature.

## Experience modes
### Exploration / social / freeform
Show only:
- scene/session identity;
- the active Character summary;
- intent actions;
- nearby/known participants or targets only when relevant;
- recent result at the moment it matters.

Do not permanently reserve large panels for Initiative, inspector data, diagnostics or Activity.

### Combat / Initiative
Add only combat-specific information:
- round and whose turn;
- compact turn order;
- action / Bonus Action / Reaction / movement economy;
- target selection when an action requires it;
- HP/status summary for relevant creatures;
- Turn End control when it is actually the user's turn.

### DM
DM uses the same spatially light play surface, plus compact authority controls when needed:
- select acting creature;
- start/end Initiative and advance turn;
- reveal/hide a theater-of-mind image;
- adjudication/recovery as progressive disclosure;
- participant state when connected.

The DM should not get a permanently open inspector, Activity panel, image panel and technical metadata panel merely because they exist.

## Surface reduction
Remove from the primary play composition:
- always-visible left participant/entity list in freeform;
- always-visible right Inspector;
- always-visible recent Activity panel;
- always-visible DM image/handout manager;
- flat `all/basic/weapon/magic` action tabs as the primary navigation;
- individual skill-check actions in the main action grid;
- debug/provenance implementation wording;
- duplicate Character/target summaries that are already visible elsewhere.

## Architecture to preserve
- Host owns authoritative connected resolution.
- Client Character Library is the durable source for the owning Character.
- Host projections are ephemeral.
- Existing Scene actions, rule services and ResolutionEvent state changes remain the mechanics path.
- Existing connected replay/reconnect/idempotency remain intact.
- Image reveal is connected presentation state, not a second mechanics/event ledger.
- No tactical map/grid/path/LOS system is introduced by this redesign.
- No second Character store or second combat resolver.

## Implementation slices
1. Physics dice renderer and shared VisualDiceTray replacement.
2. Standalone interactive Character Sheet roll surface.
3. Character portrait asset persistence and sheet integration.
4. Intent/action projection model.
5. Player exploration/combat surface.
6. DM version of the same surface.
7. DM handout/reveal transport and focused player image viewer.
8. Responsive/keyboard/reduced-motion and human Windows acceptance.

## Definition of Done
Phase 14 player experience is **not complete** until all of the following are true on one exact source SHA.

### A. Character Sheet at a physical table
- The sheet alone contains the normal information needed to run the Character.
- Ability checks, saving throws, skills, Initiative, attacks, damage and common polyhedral dice can be rolled directly from the sheet.
- Hit Dice, spell slots and normal Character resources required for play are readable and operable without entering a VTT Scene.
- A portrait can be added, positioned, replaced and removed, and survives restart/offline use.
- No extra debug/runtime window is required for ordinary sheet use.

### B. Dice
- d4/d6/d8/d10/d12/d20 are real WebGL 3D meshes driven by a physics world.
- The shared dice renderer is used by sheet and runtime-visible rolls.
- Connected authoritative results are never changed by animation/physics.
- Reduced-motion still produces a clear accessible result.

### C. Exploration / social / freeform
- The normal screen is visually quiet and intent-first.
- Skills are not a wall of primary actions.
- Influence/Search/Study/Hide and other intent actions reveal the relevant secondary choice only when needed.
- Improvised actions can be described/adjudicated without inventing a second freeform mechanics engine.
- Initiative, turn economy and combat-only information do not occupy the screen before combat needs them.

### D. Combat
- Initiative adds round/current-turn/compact order/economy/target information without rebuilding the entire screen.
- Official actions, class/context actions, attacks, spells and explicit target selection drive the existing authoritative mechanics.
- DM adjudication/recovery remains available without permanent diagnostic panels.
- Existing ResolutionEvent, Undo, reconnect and state convergence contracts remain green.

### E. Character and DM images
- Character portrait persistence is durable for the owning Character and safe offline/restart.
- The DM can preview, reveal and withdraw a local image without setting up external hosting.
- Connected players receive the reveal, can dismiss/minimize/reopen it, and a reconnecting player receives the current active reveal.
- Image presentation never changes mechanics authority, Initiative, HP, targets or ResolutionEvent history.
- Image UI is contextual and temporary; it does not recreate the removed permanent-panel problem.
- File limits, invalid-image recovery, cleanup and keyboard/focus behavior are verified.

### F. Session / production quality
- Host/Join/session-name/Ready/start/stop/reconnect remain understandable and the Session route remains scrollable in constrained Windows viewports.
- A fresh Host still begins with no surprise Goblin/Wolf/reference encounter content.
- Owning-Client Character durability and ephemeral Host projection remain intact.
- No second Character store, combat resolver, mechanics protocol, tactical map or cloud-image dependency is introduced.
- TypeScript, production build, UI contracts, mechanics regressions, connected authority tests and exact-head Windows build are green.
- Human Windows acceptance covers both sheet-only tabletop use and two-instance Host/Client play, including image reveal and image reconnect behavior.

## Acceptance
- A user can keep only the Character Sheet open at a real table and make routine checks/saves/Initiative/attacks/damage rolls with physical 3D dice.
- The same standalone sheet can display and retain the Character portrait without needing a running session.
- d4/d6/d8/d10/d12/d20 are actual 3D meshes moving in a physics world.
- Runtime visual dice never alter an authoritative result.
- Freeform does not show a wall of skills; intent-first actions lead to skill choice when the rules call for it.
- Exploration UI is materially quieter than combat UI.
- Combat adds economy/turn/target information only while needed.
- The DM can reveal a theater-of-mind/reference image to all connected players and withdraw it without creating a tactical map or permanent image window.
- A reconnecting Client converges to the currently revealed image state.
- Routine play no longer requires the old ActionConsole, permanent Inspector, permanent Activity side panel or permanent image panel.
- Existing authority/persistence/mechanics tests remain green.
