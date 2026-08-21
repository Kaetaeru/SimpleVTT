# SimpleVTT Component Contract

Status: **Derived from accepted integrated reference; implementation-facing; not Frozen**

Accepted visual/interaction reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

This document defines reusable UI responsibilities and state obligations. It does **not** prescribe exact React component names, file structure or CSS architecture.

---

# 1. Component implementation rule

A production component may render canonical/application state, but must not silently become an authority source for:

- D&D legality/calculation;
- target eligibility;
- executable Main Hand relation;
- command-conflict safety;
- privacy entitlement/delivery;
- reconnect truth;
- content validation truth;
- persistence semantics.

Those values must arrive from their owning application/domain/architecture projection.

---

# 2. Global navigation

## GlobalNav

Must represent:

- Home;
- Characters;
- Session;
- Content;
- Rules;
- Settings;
- current destination;
- keyboard focus;
- constrained desktop behavior.

Must not:

- become a permanent left-side application shell in the accepted v1 IA;
- expose Play as a normal peer global destination.

## ReturnToPlay

Visible while a live session exists and the user is in a safe Product Shell destination.

Must return to the same connected session/role/context rather than create a new Play state.

---

# 3. Generic controls

## Button

Required visual/semantic variants:

- Primary;
- Secondary;
- Quiet;
- Destructive;
- Icon-only where accessibly named.

Required states where applicable:

- default;
- hover;
- focus-visible;
- pressed;
- disabled;
- pending.

Unavailable or disabled state must not hide a material reason when users need that reason to recover.

## Tabs

Used for peer presentation such as Hotbar pages.

Must expose active state clearly without implying gameplay authority transitions not present in canonical state.

## Toggle / Segmented control

Examples:

- local presentation preference;
- Public / DM Only control in DM context where the canonical state supports it;
- Activity filters.

The control reflects state; it does not invent authority.

## Input / Select / File input

Required:

- label;
- focus;
- valid/warning/blocking state;
- disabled state;
- local recovery/help where material.

Validation truth must come from the relevant application/domain contract.

---

# 4. Tutorial choice components

## TutorialChoiceCard

Used for initial Official-style / SimpleVTT Sheet presentation choice.

Must show:

- option title;
- concise explanation;
- selected state;
- keyboard focus;
- clear statement that choice is changeable later.

It must not suggest separate Character data models.

## TutorialOrientationCard

May summarize:

- Standalone Character;
- Host Session;
- Join Session;
- supporting Content/Rules orientation.

These are orientation aids, not permanent navigation architecture.

---

# 5. Character components

## CharacterCard

Required information:

- portrait or fallback;
- name;
- concise class/level/identity metadata as available;
- current status summary when useful;
- direct open/select interaction;
- selected/unavailable state where relevant.

Opening must target the exact Character represented by the card.

## CharacterSheetLayoutSwitcher

Switches only presentation between Official-style and SimpleVTT where supported.

Must not mutate canonical Character rules state.

## SheetRollTrigger

Invokes a supported local/authoritative roll from current Sheet context.

Must not navigate to a separate dice/result destination.

---

# 6. Actor Card

ActorCard is the primary Connected Play Actor object.

Required representable dimensions of state:

- allied / neutral / hostile relation;
- Player-controlled / DM-controlled where authorized/useful;
- current turn;
- selected Actor/context focus;
- valid target;
- invalid target;
- selected target;
- HP/Temp HP when authorized;
- compact condition/status information;
- hover/focus explanation;
- right-click context menu entry.

These states must remain distinguishable. Do not collapse control, selection, turn and target eligibility into one generic highlight.

ActorCard is not a tactical token and carries no implicit x/y map role.

---

# 7. Actor Board

Two structural variants:

- Upper opposing board: NPC / Neutral / Hostile;
- Lower allied board: Player / Allied.

Required behavior:

- preserve minimum useful ActorCard width;
- horizontal overflow/paging/scroll for density;
- intentional zero/few/many Actor states;
- remain present during targeting and Initiative unless an explicit accepted presentation mode says otherwise.

ActorBoard must never infer target legality from card order or visual position.

---

# 8. Command Center

Persistent bottom operational anchor.

Required regions:

1. controlled Actor summary;
2. Hotbar/capability area;
3. Resource Rail;
4. Initiative economy when Initiative is actually active;
5. contextual controls such as Execute / End Turn / Cancel.

Must preserve recognizable structure across:

- idle;
- selected action;
- targeting;
- resolving;
- interrupt/reaction;
- dice/result;
- Initiative.

Do not replace the entire Command Center with a loading spinner during routine resolution.

---

# 9. Controlled Actor summary

Must show authorized/useful:

- portrait/identity;
- name;
- HP/Temp HP;
- major status/concentration;
- concise control context.

When DM control focus changes, this summary must reflect the actual currently controlled Actor rather than remaining bound to a default Player Character.

Actor-specific resources/capabilities must come from that Actor’s authoritative projection. If unavailable, do not reuse another Actor’s resources as filler.

---

# 10. Hotbar

## HotbarPageTabs

Baseline pages:

- Mixed;
- Action;
- Spell;
- Item;
- custom pages where supported.

Automatic discovery and user customization may coexist.

## HotbarSlot

Must be able to show:

- icon/glyph;
- label;
- cost/resource marker where supplied;
- quantity/charges where supplied;
- normal;
- hover/focus;
- selected;
- unavailable with reason;
- pending/resolving presentation.

HotbarSlot must not calculate legality or choose a smart substitute action.

Its semantic icon projection uses this priority:

1. magic damage property;
2. canonical spell school when no damage property exists;
3. represented healing, physical weapon damage, Item use, or resolution kind.

The same spell property/school vocabulary is shared with Spellbook presentation. Capability names are not an icon-selection contract.

Normal capabilities must remain directly discoverable; historical intent-first funnels are not the primary default interaction.

---

# 11. Economy / Resource Rail

## InitiativeEconomy

Represents authoritative Action / Bonus Action / Reaction / Movement state only while Initiative context actually provides that economy.

Freeform must not visually pretend these are active per-turn spend resources.

## ResourceRail

Renders dynamic resource data supplied by authoritative/application projections.

It must support heterogeneous resources without hardcoding class/item-specific gameplay logic into generic presentation components.

---

# 12. Initiative Tracker

Horizontal compact top-edge tracker that coexists with Actor Boards.

InitiativeEntry may show:

- portrait/identity;
- initiative number;
- current turn;
- compact core status icons.

Do not duplicate full HP/economy/action detail already owned by ActorCard/Command Center.

---

# 13. Targeting components

## Target state on ActorCard

All cards remain visible while targeting.

Required states:

- valid;
- invalid + reason;
- selected.

The component receives eligibility/reason from authority; it does not compute range, LoS, cover or rules legality.

## Execute control

Appears for explicit multi-target submission after one or more valid targets are selected.

Single-target valid click does not require an extra normal confirmation.

## MainHand default click

If enabled by authoritative application relation:

- valid hostile click may execute canonical Main Hand action;
- unavailable relation/reason is shown;
- no smart fallback is chosen.

---

# 14. Play Context / Tabletop Stage

This is a presentation container, not a tactical map component.

May host:

- current focus/message;
- target guidance;
- NOTICE;
- required response;
- dice;
- immediate result;
- Handout.

Must not host Core tactical Actor positions, grid, movement geometry or map-derived targeting.

---

# 15. Dice presentation

## StandaloneDiceLayer

Lives over/within current Character Sheet viewport.

Requirements:

- Sheet remains mounted/visible;
- result already comes from local/authoritative roll path;
- animation is presentation only;
- clears automatically;
- no dedicated Close/Back workflow.

## ConnectedDicePresentation

Lives in Play Context / Tabletop Stage.

Requirements:

- canonical die type/count/final face/total already supplied;
- local physics/trajectory may vary;
- presentation settles to authoritative face;
- physics failure/Reduced Motion does not change mechanics state.

## ResultStrip

Immediate result summary remains in current Sheet/Play context.

Durable detail links to Activity where applicable.

---

# 16. NOTICE / feedback components

## Notice

Persistent current-condition information.

Examples:

- reconnecting;
- DM Only active;
- live content snapshot difference;
- current blocking/recovery state.

Must not become a second Activity feed.

## InlineAlert

Used for task-local warning/error near affected control.

## Banner

Used for persistent page/session warnings where a larger footprint is justified.

## Toast

Brief non-blocking acknowledgement only. Never the sole carrier of important unrecoverable information.

---

# 17. Utility launcher / pane

## UtilityLauncher

Opens contextual tools such as Activity, Encounter, Participants, Session, Rules, Quick Sheet or advanced DM facts.

Must not duplicate the entire Command Center.

## UtilityPane

Required behavior:

- title/header;
- close;
- internal scroll ownership;
- bounded desktop resize where used;
- focus restoration;
- coexistence with Play skeleton;
- constrained-desktop behavior.

Advanced DM spatial pane is fact-oriented only; no coordinate/map editor behavior.

---

# 18. Activity components

## ActivityItem

Must support:

- public event;
- DM-only event in DM view;
- later disclosure projection;
- correction/reversal relation;
- progressive detail.

Player view must not render a placeholder for undelivered DM-only authoritative events.

## ActivityFilter

DM may filter All / Public / DM Only where supported.

Filters only presentation of already-authorized DM data.

## CorrectionRelation

Shows a correction/reversal as linked history rather than deleting or rewriting the original record.

---

# 19. Handout components

## HandoutControl

DM-side author/reveal/mode/withdraw presentation as permitted by runtime contract.

## HandoutView

Modes:

- Overlay;
- Upper;
- Full.

Requirements:

- image presentation only;
- no tactical grid/token placement;
- local zoom/pan may exist;
- Overlay local Player dismiss/reopen is distinct from shared presentation state.

Network/reconnect semantics remain Architecture-owned.

---

# 20. Full / Quick Sheet live-session components

## QuickSheet

Lightweight Character detail in current Play context.

## FullSheetLayer

Large Character Sheet layer while live session remains active.

Must preserve session continuity and restore prior context on close/return.

A higher-priority required response must be able to surface without destroying the user’s Character Sheet context unnecessarily.

---

# 21. Context menu / rich explanation

## ActorContextMenu

Right-click supplementary context menu.

Allowed family:

- Inspect/details;
- context focus;
- DM control/context operations when authorized.

Must not duplicate ordinary Attack / Spell / Item actions from Hotbar.

## RichExplanation

For dense capabilities/status.

May include supplied:

- name;
- cost/resource;
- formula/effect summary;
- public target/range facts;
- source/provenance;
- unavailable reason.

Material information must have a focus/keyboard-accessible path and not exist only on pointer hover.

---

# 22. Connection/session components

## ConnectionStatus

Representable states:

- connected;
- reconnecting;
- disconnected;
- incompatible/rejected where applicable.

## SessionIdentity

Shows Host/DM or Client/Player connected context.

No Host/Player or Client/DM connected variants.

## SessionSnapshotInfo

Where useful, explains that the live Session uses the content configuration captured at open time.

This is presentation of existing session truth, not a permanent required component everywhere.

---

# 23. Content components

Content package cards/import review may display supplied:

- name/version/source;
- installed/disabled/update/unsupported state;
- validation warning/block;
- live snapshot relationship;
- install/update/replace/enable/disable/delete actions.

The UI must not imply unsupported arbitrary executable plugins.

---

# 24. Component state semantics

The following must not be conflated:

```text
hover
focus
pressed
selected
controlled
current turn
target valid
target invalid
target selected
disabled
unavailable
pending
resolving
```

Color alone is insufficient to communicate material state distinctions.

---

# 25. Component non-goals

This contract does not prescribe:

- React component filenames;
- component library technology;
- state-management library;
- CSS methodology;
- exact SVG/icon assets;
- exact pixel dimensions;
- exact animation library;
- runtime rules/network/data schemas.

Implementation may choose those details while preserving the accepted component behavior and authority boundaries.
