# UI Reference Prototype — Component Catalog

Status: **Prototype component inventory**

This catalog defines reusable visual/interactive pieces the HTML prototype must demonstrate. It is not production component architecture.

Prototype code may implement these simply, but each component must expose the relevant visual states and role/context variants needed for review.

Every future prototype component SHOULD carry `data-proto-id="PROTO-CMP-*"`.

---

# 1. Global / navigation components

| ID | Component | Purpose | Must demonstrate |
| --- | --- | --- | --- |
| `PROTO-CMP-GLOBAL-NAV` | Global navigation | Home / Characters / Session / Content / Rules / Settings | active item; hover/focus; narrow desktop |
| `PROTO-CMP-RETURN-PLAY` | Return to Play control | persistent contextual return while runtime session exists in current app process | normal; attention state |
| `PROTO-CMP-PAGE-HEADER` | Page header | title, context, local primary action | normal; compact |
| `PROTO-CMP-BREADCRUMB` | Context breadcrumb/return cue | only where it improves local hierarchy | normal; long label |

---

# 2. Generic controls

## PROTO-CMP-BUTTON

Variants:

- Primary
- Secondary
- Quiet
- Destructive
- Icon

Applicable states:

- default
- hover
- focus-visible
- pressed
- disabled
- pending

Rules:

- disabled/pending must be visually distinct;
- material unavailable reason must have a discoverable explanation;
- destructive styling does not replace confirmation policy;
- icon-only controls require accessible/discoverable naming.

## PROTO-CMP-TABS

States:

- inactive
- hover/focus
- active
- disabled where valid
- overflow/compact narrow example

Use for peer content, including Hotbar page family where applicable.

## PROTO-CMP-SEGMENTED

Small exclusive mode/value set. Prototype examples: Public / DM Only, filter modes when appropriate.

## PROTO-CMP-TOGGLE

Explicit boolean/local preference. Must include label and current state.

## PROTO-CMP-INPUT

Includes text/number/search variants. Must demonstrate:

- label
- helper text
- focus
- valid
- warning
- blocking error
- disabled

## PROTO-CMP-SELECT

Desktop select/listbox example for structured option selection.

## PROTO-CMP-FILE-INPUT

Used for Character/content/portrait/handout examples. Must demonstrate choose, selected file, validation, replace/remove.

---

# 3. Character / Actor components

## PROTO-CMP-CHARACTER-CARD

Used in Character Library and Join Character Select.

Must show:

- portrait/initial fallback;
- name;
- level/class or equivalent summary mock metadata;
- source/status metadata when relevant;
- direct open/select action;
- selected state;
- invalid/unavailable state if a Character cannot be used for a mock Join case.

## PROTO-CMP-ACTOR-CARD

Core Play component.

Must be able to represent independently:

- allied / neutral / hostile relation;
- Player-controlled / DM-controlled mock indicator;
- current turn;
- selected Actor;
- contextual focus;
- valid target;
- invalid target + reason;
- HP/Temp HP mock projection;
- compact condition/status icons;
- hover/focus explanation;
- right-click context menu entry;
- narrow-board minimum size before horizontal paging/scroll.

Do not collapse all these states into one color treatment.

## PROTO-CMP-ACTOR-BOARD

Horizontal container for Actor Cards.

Variants:

- upper opposing board;
- lower allied board;
- few Actors;
- many Actors -> paging/scroll;
- zero Actors -> intentional empty state.

---

# 4. Play / Command Center components

## PROTO-CMP-COMMAND-CENTER

Persistent bottom anchor.

Required regions:

- controlled Actor summary;
- action/capability area;
- action economy;
- Resource Rail;
- contextual primary controls such as End Turn/Execute/Cancel where applicable;
- DM Public / DM Only visibility control only in DM context.

Must demonstrate stable skeleton across:

- idle;
- action selected;
- targeting;
- resolving;
- interrupt;
- result;
- Initiative.

Resolution must not replace the whole Command Center with a spinner.

## PROTO-CMP-HOTBAR-PAGE-TABS

At minimum:

- Mixed
- Action
- Spell
- Item
- custom page example

## PROTO-CMP-HOTBAR-SLOT

Must show:

- icon/label;
- shortcut hint where used;
- cost/resource marker where supplied by mock state;
- quantity/charges where supplied;
- normal;
- hover/focus;
- selected;
- unavailable + explicit reason;
- cooldown/pending style only as presentation mock, never rule calculation.

## PROTO-CMP-ECONOMY

Fixed indicators:

- Action
- Bonus Action
- Reaction
- Movement

Must show available/spent/unavailable mock projections without calculating legality.

## PROTO-CMP-RESOURCE-RAIL

Dynamic resources from mock data. Must support multiple resource types without hardcoding gameplay semantics into component logic.

---

# 5. Initiative / combat components

## PROTO-CMP-INITIATIVE-TRACKER

Horizontal top-edge tracker. Must coexist with Actor Boards.

## PROTO-CMP-INITIATIVE-ENTRY

Shows compact:

- portrait;
- order/current state;
- initiative number supplied by mock data;
- core condition/status icon(s).

Must not duplicate full HP/economy details from Actor Card/Command Center.

## PROTO-CMP-END-TURN

Contextual primary control with DM/Player variants supplied by mock scenario.

---

# 6. Status / feedback components

## PROTO-CMP-NOTICE

Persistent important-current-state region selected by the owner.

Examples:

- reconnecting;
- DM Only visibility active;
- unresolved blocking task state;
- live content snapshot notice when relevant.

Must remain compact and not become a second Activity feed.

## PROTO-CMP-STATUS-BADGE

Compact explicit state label. Examples: Connected, Reconnecting, DM Only, Current Turn.

## PROTO-CMP-BANNER

Persistent page/session warning or error with optional recovery action.

## PROTO-CMP-TOAST

Brief non-blocking acknowledgement. Must not carry essential unrecoverable information alone.

## PROTO-CMP-INLINE-ALERT

Task-local warning/error/info near the affected UI.

## PROTO-CMP-PROGRESS

Used only when real prototype interaction simulates pending work; should not imply production timing.

---

# 7. Context / utility components

## PROTO-CMP-UTILITY-LAUNCHER

Launches contextual Session/DM tools without duplicating the Command Center.

## PROTO-CMP-UTILITY-PANE

Right/side contextual pane family for:

- Activity
- Encounter
- Participants
- Session Share
- Rules
- Player Session
- advanced spatial relation tool

Must demonstrate:

- header/title;
- close;
- resize gutter where applicable;
- internal scroll ownership;
- focus return;
- narrow desktop transformation.

## PROTO-CMP-RESIZE-GUTTER

Local presentation control only. Must demonstrate pointer drag and reset affordance in prototype.

---

# 8. Layer / explanation components

## PROTO-CMP-TOOLTIP

Small label/help. Never sole source of essential information.

## PROTO-CMP-HOVER-FRAME

Rich anchored explanation frame for capabilities/status/details.

Must support:

- structured title;
- short summary;
- mock cost/resource info when supplied;
- unavailable reason when supplied;
- source/detail link affordance where relevant.

## PROTO-CMP-ACTOR-CONTEXT-MENU

Pointer-first right-click menu.

Allowed prototype command family:

- Details / Inspect
- open Character/Actor detail
- local/context-management commands
- DM context-management commands when role-appropriate

Must NOT contain ordinary Attack / Spell / Item/Hotbar gameplay actions.

No dedicated keyboard-open equivalent is required in v1 per reviewed owner decision; material information/actions must remain available through other accessible routes.

## PROTO-CMP-POPOVER

Anchored nonmodal detail/control.

## PROTO-CMP-MODAL

For confirmations/interruptive decisions only. Must demonstrate initial focus, focus containment, explicit close/cancel where valid.

---

# 9. Handout components

## PROTO-CMP-HANDOUT-CONTROL

DM authoring/reveal/withdraw/mode control mock.

## PROTO-CMP-HANDOUT-VIEW

Supports:

- Overlay
- Upper Scene
- Full Scene

Must include local zoom/pan controls in prototype.

Network semantics remain mock-only until `GAP-HANDOUT-NETWORK-CONTRACT` is resolved.

---

# 10. Activity / correction components

## PROTO-CMP-ACTIVITY-ITEM

Must support:

- public event;
- DM-only event;
- later disclosure;
- correction/reversal relation;
- result-only vs full detail mock variants;
- explicit visibility label.

Player view must not render a placeholder for mock DM-only events.

## PROTO-CMP-ACTIVITY-FILTER

DM view: All / Public / DM Only example.

## PROTO-CMP-CORRECTION-CHAIN

Visually relates correction/reversal to prior committed event without deleting history.

---

# 11. Dice / result components

## PROTO-CMP-ROLL-AREA

Broad central Scene/Table presentation region used for dice animation mock.

## PROTO-CMP-DICE-PRESENTATION

May use CSS/2D placeholder dice rather than real physics. Must communicate:

- far/back launch concept;
- movement toward near/front;
- bounce/settle concept;
- final face supplied by mock authoritative result.

## PROTO-CMP-RESULT-STRIP

Scene-integrated immediate result summary.

Must provide Activity/detail path without becoming a full-screen result page.

---

# 12. Connection / session components

## PROTO-CMP-CONNECTION-STATUS

States:

- connected
- reconnecting
- disconnected
- incompatible/rejected

## PROTO-CMP-SESSION-IDENTITY

Shows Host/DM or Client/Player context plus selected Character/Actor as appropriate.

## PROTO-CMP-SESSION-SNAPSHOT

Prototype-only/DM utility presentation of the fact that live content configuration is fixed for the session. This is not necessarily a permanent product component; use only where the UI needs to explain content state.

---

# 13. Component gallery requirement

The future prototype SHOULD contain a `Component Gallery` scene accessible only from Prototype Controls.

It must show all common states side by side for:

- Button;
- tabs;
- input;
- Actor Card;
- Character Card;
- Hotbar Slot;
- Status Badge;
- Notice;
- Banner;
- Toast;
- Utility Pane;
- Tooltip/Hover Frame;
- Modal;
- Activity Item.

This lets the owner change the design system once instead of discovering inconsistencies screen by screen.

---

# 14. Completion rule

A component is prototype-complete only when:

- normal state exists;
- applicable interactive states exist;
- applicable role/visibility variant exists;
- narrow-desktop behavior is demonstrated if material;
- no authoritative gameplay/network calculation is implemented inside the component;
- any material unavailable/error reason is visibly understandable.