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
- adjudication/recovery as progressive disclosure;
- participant state when connected.

The DM should not get a permanently open inspector, Activity panel and technical metadata panel merely because they exist.

## Surface reduction
Remove from the primary play composition:
- always-visible left participant/entity list in freeform;
- always-visible right Inspector;
- always-visible recent Activity panel;
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
- No tactical map/grid/path/LOS system is introduced by this redesign.
- No second Character store or second combat resolver.

## Implementation slices
1. Physics dice renderer and shared VisualDiceTray replacement.
2. Standalone interactive Character Sheet roll surface.
3. Intent/action projection model.
4. Player exploration/combat surface.
5. DM version of the same surface.
6. Responsive/keyboard/reduced-motion and human Windows acceptance.

## Acceptance
- A user can keep only the Character Sheet open at a real table and make routine checks/saves/attacks/damage rolls with physical 3D dice.
- d4/d6/d8/d10/d12/d20 are actual 3D meshes moving in a physics world.
- Runtime visual dice never alter an authoritative result.
- Freeform does not show a wall of skills; intent-first actions lead to skill choice when the rules call for it.
- Exploration UI is materially quieter than combat UI.
- Combat adds economy/turn/target information only while needed.
- Routine play no longer requires the old ActionConsole, permanent Inspector or permanent Activity side panel.
- Existing authority/persistence/mechanics tests remain green.
