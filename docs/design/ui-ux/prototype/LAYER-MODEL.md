# UI Reference Prototype — Layer Model

Status: **AI Design Default / prototype interaction contract**

This document defines how major UI surfaces stack and coexist in the standalone Reference Prototype. It does not define network authority or D&D rules.

The goal is to prevent ad-hoc z-index behavior and to make the owner able to see what happens when multiple surfaces compete for attention.

---

# 1. Layer families

## PROTO-LAYER-0 — Base canvas

Contains the current Product Shell page or Play Workspace canvas.

Examples:

- Home page content;
- Character page content;
- central Play Scene/Table.

Never modal.

## PROTO-LAYER-1 — Persistent product/play anchors

Always-on structural UI belonging to the current experience.

Examples:

- global navigation/header;
- Actor Boards;
- Command Center;
- Initiative Tracker;
- persistent NOTICE UI;
- persistent connection/visibility indicator.

These are not overlays merely because they sit visually above the Scene.

## PROTO-LAYER-2 — Contextual utility panes

Nonmodal contextual tools that coexist with current canonical context.

Examples:

- Activity;
- Encounter;
- Participants;
- Session Share;
- Rules pane;
- Player Session pane;
- advanced DM spatial relation tool;
- Quick Sheet.

Default behavior:

- one primary utility pane visible per side/dock region;
- switching utility normally replaces the previous pane in that region rather than stacking many panes;
- the pane may resize within defined minimum Scene/Play bounds;
- canonical Play/session state remains active behind it.

## PROTO-LAYER-3 — Anchored transient UI

Examples:

- tooltip;
- rich hover explanation frame;
- Actor Context Menu;
- small popover;
- local select/listbox popup.

Rules:

- anchored to an invoker/context;
- does not block unrelated product interaction;
- closes on Escape where keyboard-reachable;
- pointer context menu may close on outside click;
- richer explanation may remain while pointer/focus moves inside it when usable.

## PROTO-LAYER-4 — Full workspace / scene presentation

Used when a surface temporarily dominates a major region without destroying the underlying session context.

Examples:

- Full Character Sheet layer;
- Handout Full Scene;
- Handout Upper Scene as a Scene-region replacement.

Rules:

- underlying authoritative/session context is preserved;
- close/return returns to the prior context;
- only the replaced region is visually displaced unless a reviewed Decision says otherwise;
- Command Center/required session anchors are preserved when the reviewed mode requires them.

## PROTO-LAYER-5 — Resolution / interrupt presentation

Used for gameplay-resolution presentation that has higher attention priority than ordinary contextual utilities.

Examples:

- resolving state;
- reaction/interrupt prompt;
- concentration-save response;
- dice/result presentation.

Rules:

- Command Center skeleton remains visible according to `ORIGIN-UX-01-21`;
- only explicitly mock-declared conflicting controls are disabled in the prototype;
- no production safe-interaction semantics are inferred;
- interrupt/reaction presentation may visually suppress lower-priority transient popovers but should preserve orientation to Actor/Scene context.

## PROTO-LAYER-6 — Confirmation / destructive decision

Examples:

- destructive confirmation;
- unsaved-change confirmation;
- authoritative correction confirmation when required by eventual contract.

Default:

- modal;
- blocks interaction with lower layers until resolved;
- visible Cancel unless the operation genuinely has no safe cancel state;
- focus contained inside the modal;
- closes only through explicit valid action or safe Escape/Cancel.

## PROTO-LAYER-7 — System blocker

Rare highest-priority user-facing blocker.

Examples:

- app/session state cannot continue safely;
- incompatible state requiring exit/recovery.

This should not be used for ordinary validation or recoverable task errors.

---

# 2. Handout layering

Handout is special because its three reviewed modes are not interchangeable generic modals.

## Overlay

- lives above Scene/Table content but below confirmation/system blockers;
- may cover a large part of Scene;
- Player can locally dismiss/minimize and reopen;
- DM shared handout mock state remains active.

## Upper Scene

- replaces/occupies the upper Scene presentation region;
- is not locally dismissible by Player as a shared mode;
- persists until DM withdraws/changes mode;
- lower allied Actor Board and Command Center remain available according to reviewed Play structure.

## Full Scene

- becomes dominant Scene presentation;
- remains inside live Play context rather than becoming a Product route;
- DM controls shared presence/mode;
- local zoom/pan is allowed;
- Command Center and required session continuity controls remain available unless later owner feedback changes the visual composition.

Network/reconnect implementation remains mock-only until `GAP-HANDOUT-NETWORK-CONTRACT` is resolved.

---

# 3. Resolution coexistence rules

During `Resolving` / `Interrupt` / `Dice` / `Result`:

- persistent Actor/Scene orientation should remain recognizable;
- Command Center skeleton remains;
- a selected action/target state may visually freeze or transition to a submitted state;
- ordinary hover explanations may close;
- unrelated utility pane may remain visible if it does not conflict in the mock scenario;
- a modal confirmation always takes priority over normal utility panes;
- Prototype Controls may force combinations for QA even if they are not normal production sequences.

The prototype uses explicit mock flags such as `conflictsDuringResolution: true/false`; it must not derive conflict legality itself.

---

# 4. Full Sheet coexistence

Opening Full Character Sheet during a live session:

- keeps connection/session state alive;
- uses `PROTO-LAYER-4`;
- does not reset turn/Actor/resolution state;
- may visually cover most Scene content;
- preserves an obvious return/close control;
- on close, returns focus/context to the invoking location when practical.

If a higher-priority reaction/interrupt is triggered while Full Sheet is open, the prototype must demonstrate at least one reviewed-safe presentation where the interrupt becomes visible without losing the user's place.

The exact production command semantics remain domain/contract work.

---

# 5. Context menu / hover interaction

Actor Context Menu:

- right-click pointer entry;
- above Actor Cards and normal panes;
- below modal/interrupt/system blockers;
- closes on outside click or selecting a command;
- does not contain ordinary Attack/Spell/Item commands.

Hover Explanation Frame:

- may overlap nearby controls but should avoid covering the active target/critical state when possible;
- may flip left/right/up/down based on available viewport space;
- closes when pointer/focus leaves after a small grace period;
- essential unavailable reason must also be discoverable through non-hover presentation when needed.

---

# 6. NOTICE UI priority

NOTICE UI belongs to persistent Layer 1, not the modal stack.

It should surface important current conditions while allowing work to continue.

Examples:

- reconnecting;
- DM Only active;
- current session content snapshot differs from local library after a library update;
- current task has an important persistent warning.

A NOTICE may link/open a contextual Layer-2 detail surface.

It should not obscure Action Bar/Actor Cards or behave like a toast queue.

---

# 7. Focus / dismissal defaults

| Layer | Escape | Outside click | Focus trap | Return focus |
| --- | --- | --- | --- | --- |
| L2 contextual pane | closes pane when safe | normally no | no | launcher |
| L3 tooltip | closes/clears | n/a | no | unchanged |
| L3 popover/menu | closes | yes by default | no | invoker |
| L4 Full Sheet | closes/returns when safe | no | workspace-contained rather than modal trap | launcher/prior context |
| L4 Handout Upper/Full | Player Escape does not dismiss shared mode | no | no generic trap | local controls only |
| L5 interrupt/required response | only if contract allows cancel | no | may contain required-response focus | resolution context |
| L6 modal confirm | Cancel when allowed | normally no | yes | invoker/logical next |
| L7 system blocker | only explicit recovery/exit | no | yes | recovery-defined |

These are AI defaults. A canonical Product Decision or Domain/Architecture contract overrides them.

---

# 8. Narrow-desktop transformation

At the 960×700 prototype preset:

- contextual utility pane may become an overlay-like side sheet while remaining desktop-oriented;
- Actor Board keeps cards at/above minimum readable width, using horizontal scroll/paging before shrinking below usability;
- Command Center remains directly reachable;
- Full Sheet becomes single-column/stacked as necessary;
- Handout controls compact but shared mode semantics do not change;
- confirmation modal stays centered/contained within viewport;
- hover/popover placement must avoid clipping outside viewport.

---

# 9. Prototype QA combinations

The HTML prototype must intentionally test at least these combinations:

1. DM Play + Activity pane + DM Only NOTICE.
2. Player Play + Handout Overlay + local dismiss/reopen.
3. Player Initiative + targeting + invalid Actor explanation.
4. DM Initiative + advanced spatial pane.
5. Full Sheet open + connection NOTICE.
6. Resolving + reaction prompt.
7. Resolving + concentration response.
8. Result + Activity detail path.
9. Narrow desktop + utility pane + Command Center.
10. Destructive confirmation above a contextual DM pane.

Layer conflicts discovered in these scenarios are prototype/design issues; they should be fixed here before runtime implementation.