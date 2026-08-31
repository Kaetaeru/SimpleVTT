# Common Play Visual Reference Plan

Status: **OWNER-REQUESTED VISUAL REBASE — DRAFT / NOT RUNTIME AUTHORIZATION**  
Prepared: 2026-08-31 Asia/Seoul  
Integration baseline: `work/v1-composite` @ `f0e0197916028ae3f8ce67b5ce4e55c2d1acbf6e`

## 0. Purpose

This file is the handoff for producing the next SimpleVTT visual reference set in a separate ChatGPT conversation.

The goal is not to redesign Character Creation. The goal is to visually rebase the always-visible product/session shell and the Common Play interaction lifecycle so later runtime work has owner-approved references.

The visual work is split into exactly two classes:

1. **BASE** — UI that must exist in the normal resting state, even when no special interaction is active.
2. **REF** — transient/contextual Common Play states that appear on top of or inside a BASE composition only when required.

Do not turn every REF into a permanent panel. Do not turn every state into a separate product route.

## 1. Non-negotiable product boundaries

Every generated reference must preserve these rules:

- Core Connected Play is **mapless**. No grid, Actor x/y coordinates, draggable tactical tokens, pathfinding, range rings, Fog of War, or LoS geometry.
- The central Play Context is presentation/context space for selection, Common Play interactions, dice, results, handouts, notices, and pending resolution state. It is not a battle map.
- Player and DM use the same core Play skeleton; DM gets additional authorized tools.
- Freeform and Initiative are states of the same Play screen. Initiative adds turn/round/economy UI; it does not replace the scene.
- Freeform must not display fake per-turn Action/Bonus Action/Reaction/Movement consumption.
- Normal executable capabilities are directly discoverable from the persistent Command Center/Hotbar.
- Common Play UI must be generic. Do not create spell-name-, feat-name-, class-name-, or item-name-specific UI architecture.
- Essential state cannot be hover-only. Hover/focus is for explanation and detail.
- Connected dice are presentation of one authoritative result, never a second mechanics engine.
- DM-only/private information is not represented as a Player-visible placeholder that is merely hidden visually.
- V1 visible UI is Korean-first. Stable internal IDs remain language-neutral.
- Character Creation redesign is outside this visual rebase.

## 2. Visual work count

```text
BASE references       5
REF bundles          10
-----------------------
Total target images  15
```

The 15-image target is a planning default. A single image may contain multiple clearly labeled states when that improves comparison. Owner review may split or merge references later.

## 3. Approval state

Each item uses one of these states:

- `NOT_DRAWN` — no current candidate.
- `DRAFT` — generated candidate, not owner-reviewed.
- `REVISE` — owner requested changes.
- `APPROVED_LAYOUT` — composition/information hierarchy accepted; visual treatment may still change.
- `APPROVED_VISUAL` — visual direction accepted.
- `FROZEN_REFERENCE` — approved reference may be used as runtime implementation input.

Current status for every item in this file is `NOT_DRAWN`.

**No generated image becomes runtime authority merely because it exists. Owner approval is required.**

---

# 4. BASE — always-visible product/session compositions

## BASE-01 — Home + Global Product Shell

**Status:** `NOT_DRAWN`

**Role:** resting product entry screen and persistent global navigation language.

**Must visibly establish:**

- top navigation model;
- Home / Characters / Session / Content / Rules / Settings;
- distinct Host Session and Join Session entry;
- useful recent Character/Campaign context without debug/protocol clutter;
- connection/session continuity state where applicable;
- visible Return to Play when a live session exists and the user is outside Play;
- restrained save/sync/notification affordances when applicable.

**Must not become:**

- a dense telemetry dashboard;
- a permanent left-sidebar redesign;
- a place for Activity history or raw protocol IDs;
- a Character Creation redesign.

---

## BASE-02 — Player Session / Freeform

**Status:** `NOT_DRAWN`

**Role:** primary resting Player play screen outside Initiative.

**Always-visible skeleton:**

```text
Global / Session chrome
---------------------------------------------
Upper NPC / Neutral / Hostile Actor Board
---------------------------------------------
Mapless Play Context / Tabletop Stage
---------------------------------------------
Lower Player / Allied Actor Board
---------------------------------------------
Persistent Command Center
```

**Must visibly establish:**

- opposing Actor Board;
- allied/player Actor Board;
- Actor selected/controlled/targetable visual language;
- selected/controlled Character identity;
- HP/temp HP and compact important state;
- concentration/important conditions when applicable;
- dynamic Resource Rail;
- persistent capability Hotbar;
- Hotbar families at minimum: Mixed / Action / Spell / Item / user-custom area where supported;
- central breathing room reserved for Common Play transient states, dice, result, notice, and handout;
- Activity/utility access without permanently consuming the main play area.

**Freeform truth rule:**

Do not display round/current-turn or spent per-turn Action/Bonus Action/Reaction/Movement as though Initiative were active.

---

## BASE-03 — Player Session / Initiative

**Status:** `NOT_DRAWN`

**Role:** BASE-02 with Initiative information layered into the same scene.

**Must preserve from BASE-02:**

- same Actor Boards;
- same central Mapless Play Context;
- same Command Center;
- same Hotbar/capability organization.

**Initiative additions:**

- compact Initiative tracker;
- round;
- current turn/current Actor emphasis;
- authoritative Action / Bonus Action / Reaction / Movement economy;
- End Turn where applicable;
- Ready/Reaction/turn-sensitive state where useful.

**Must not:** replace the screen with a different combat-only layout.

---

## BASE-04 — DM Session / Freeform

**Status:** `NOT_DRAWN`

**Role:** DM resting play screen using the same core skeleton as BASE-02 with authorized operation tools.

**Must preserve:**

- same upper/lower Actor Boards;
- same Mapless Play Context;
- same Command Center grammar;
- truthful Freeform state.

**DM additions must provide shallow access to:**

- acting Actor / control switching;
- Encounter/Actor management;
- Participants / Session utilities;
- Activity and adjudication/correction entry;
- Handout reveal;
- Rules lookup;
- Quick Search / quick live DM actions where applicable;
- DM-only visibility indicators without leaking them into Player composition.

**Design goal:** DM has more control, not a completely different product.

---

## BASE-05 — DM Session / Initiative

**Status:** `NOT_DRAWN`

**Role:** BASE-04 plus Initiative operation controls.

**Must add:**

- Initiative order / round / current Actor;
- next/end turn controls;
- NPC/controlled-Actor economy state;
- Ready/Reaction/concentration visibility where authorized;
- fast correction/adjudication entry close to the active resolution/Activity context.

**Must not:** introduce a tactical battle map or replace the shared Play skeleton.

---

# 5. REF — contextual Common Play visual bundles

These are not independent permanent product screens. Each REF must be demonstrated inside or directly attached to a BASE composition.

## REF-01 — Action Interaction

**Status:** `NOT_DRAWN`

**Bundle states:**

- Hotbar hover/focus card;
- Common Action preview;
- cost/payment preview;
- unavailable/blocked reason.

**Generic data to visualize:**

- action label/category;
- economy/resource/item cost;
- target expectation;
- attack/check/save/formula/effect summary as available;
- public range/targeting fact where authoritative;
- availability;
- reset/recovery information when relevant;
- source/provenance as progressive detail.

**Key rule:** one generic presentation family must work for actions, spells, features, and executable items.

---

## REF-02 — Dynamic Choice

**Status:** `NOT_DRAWN`

**Bundle states:** show several bounded choice examples in one visual language, such as:

- damage/type choice;
- spell-slot/resource tier choice;
- mode/variant choice;
- bounded option list.

**Key rule:** ask only real choices required by the current Common Play contract. Do not build a named-content wizard.

---

## REF-03 — Targeting + Multi-target + Allocation

**Status:** `NOT_DRAWN`

**Must show distinct states:**

- valid Actor target;
- invalid Actor target with reason access;
- selected target;
- single-target immediate submit behavior;
- multi-target selected-count + explicit Execute;
- mapless area-like manual target set;
- AllocationPlan example where fixed units are distributed among selected targets.

**Key distinction:**

```text
who is selected
!=
how much is allocated to each selected target
```

No map template or positional inference.

---

## REF-04 — Pending Resolution + Reaction + Consent

**Status:** `NOT_DRAWN`

**Bundle states:**

- PendingResolution waiting state;
- Reaction/interrupt prompt;
- concentration/response variant;
- consent prompt;
- decline/cancel where legal;
- responder/authority identity where appropriate.

**Must answer visually:**

- why resolution is paused;
- who must answer;
- what can be chosen;
- what it costs, if visible;
- what happens on decline/timeout where contract supplies it.

**Payment rule:** opening the prompt does not visually imply the cost has already been consumed.

---

## REF-05 — DM Common Play Adjudication

**Status:** `NOT_DRAWN`

**Bundle states:**

- DM adjudication request generated by Common Play;
- automated-vs-DM-assisted boundary;
- fast Situation/Ruling controls;
- bounded scope controls;
- correction/Undo entry where relevant.

**Useful ruling controls to represent:**

- small situational modifiers;
- advantage/disadvantage;
- force success/failure where authorized;
- damage/heal;
- condition/effect application;
- resource/economy correction;
- scope such as this resolution / this target / this turn / this round / until cleared.

**Key rule:** do not hide the calculated engine outcome when the DM adjudicates differently.

---

## REF-06 — Authoritative Dice + Immediate Result

**Status:** `NOT_DRAWN`

**Bundle states:**

- physical dice presentation on the central mapless stage;
- single d20 result;
- advantage/disadvantage selected/discarded faces;
- grouped multi-die / damage-type presentation;
- immediate hit/miss/save/check/heal/damage result;
- compact result card remaining after motion completes.

**Key rule:** animation trajectory is presentation only; the displayed terminal face/result must match authoritative data.

---

## REF-07 — Explainability / Provenance

**Status:** `NOT_DRAWN`

**Bundle states:**

- expanded calculation detail;
- modifier contribution list;
- selected/discarded dice explanation;
- damage/healing components;
- resistance/immunity/vulnerability decision;
- resource/item/economy change explanation;
- effect added/removed/expired explanation;
- unavailable-action explanation;
- source/module/version detail as progressive information.

**The UI should be able to answer:**

- Why is this total +11?
- Why did this modifier not apply?
- Why was this damage reduced?
- Why is this action unavailable?
- Why did this effect end?

The same provenance grammar should be reusable for stat inspection and Activity detail.

---

## REF-08 — Persistent Mechanics

**Status:** `NOT_DRAWN`

**Bundle states:**

- active Effect/Condition chip or compact card;
- concentration ownership/state;
- RuntimeArtifact representation;
- duration/lifetime/remaining-use presentation;
- long CastProcess / ritual / interruptible activity status.

**Key rule:** persistent zone/object/artifact mechanics remain mapless in Core. Represent semantic state, not tactical geometry.

---

## REF-09 — Session Utility Surfaces

**Status:** `NOT_DRAWN`

**Bundle states:**

- Inventory / item resources;
- Party Stash transfer/approval state;
- Activity feed with Player vs DM information depth;
- Handout presentation modes;
- contextual drawer/pane behavior without replacing the Play screen.

**Key rule:** full management can be deep; routine live use should remain shallow.

---

## REF-10 — System Feedback / Recovery

**Status:** `NOT_DRAWN`

**Bundle states:**

- toast acknowledgement;
- persistent notice/banner;
- inline field/local failure;
- save/sync indicator;
- connection unstable/lost;
- reconnecting;
- restored + synchronized events;
- restored PendingResolution;
- unsupported mechanic;
- DM-assisted option when supported;
- retryable vs terminal failure distinction.

**Feedback lifetime rule:**

```text
brief acknowledgement -> toast
persistent problem -> notice/banner
field/local failure -> inline
history -> Activity
required decision -> response layer/modal
```

Do not duplicate one message in every channel.

---

# 6. Drawing order

Produce and review references in this order unless the owner explicitly changes it:

```text
1. BASE-01 Home + Global Product Shell
2. BASE-02 Player Freeform
3. BASE-03 Player Initiative
4. BASE-04 DM Freeform
5. BASE-05 DM Initiative

6. REF-01 Action Interaction
7. REF-02 Dynamic Choice
8. REF-03 Targeting + Allocation
9. REF-04 Pending Resolution + Reaction + Consent
10. REF-05 DM Common Play Adjudication
11. REF-06 Dice + Immediate Result
12. REF-07 Explainability / Provenance
13. REF-08 Persistent Mechanics
14. REF-09 Session Utility Surfaces
15. REF-10 System Feedback / Recovery
```

Reason: transient Common Play references must be designed against an approved BASE composition so overlays, drawers, prompts, dice, and notices have a real spatial home.

# 7. Handoff instructions for another AI conversation

When asked to create one of these references:

1. Read this file first.
2. Read `INTEGRATED-PRODUCT-UX-PLAN.md` and the relevant Common Play/domain source for the requested item.
3. Treat existing accepted prototypes/code as evidence, not permission to copy drift that conflicts with current product/domain rules.
4. Generate only the requested BASE or REF unless the owner asks for multiple.
5. Use Korean-first visible labels in the sample UI unless the owner requests otherwise.
6. Do not invent a battle map, Lobby/Ready lifecycle, content-name-specific mechanics UI, or hidden DM information on Player screens.
7. Keep the requested item in `DRAFT` until the owner explicitly approves it.
8. After owner feedback, produce a revised candidate rather than silently changing the requirements.
9. When owner approval is explicit, record whether approval is layout-only or full visual approval.
10. Do not implement production runtime UI from these references until they are `FROZEN_REFERENCE` and the V1 roadmap/runtime authorization allows it.

# 8. Minimum source map for Common Play references

| Visual item | Primary behavior source |
| --- | --- |
| BASE-01 | `INTEGRATED-PRODUCT-UX-PLAN.md` Product Shell/Home sections |
| BASE-02~05 | `INTEGRATED-PRODUCT-UX-PLAN.md` Connected Play / Freeform / Initiative / Command Center sections |
| REF-01~05 | `docs/rules/common-play-contract-v0.2.md` + `docs/design/combat-ux.md` |
| REF-06~07 | `docs/design/combat-ux.md` + `DICE-PRESENTATION.md` |
| REF-08 | `docs/rules/common-play-contract-v0.2.md` CastProcess / Artifact / Rule lifetime semantics |
| REF-09 | integrated product plan + Inventory/Stash/Handout/Activity contracts |
| REF-10 | integrated product plan feedback hierarchy + reconnect/unsupported Common Play rules |

# 9. Owner review checklist

For each reference, review only these five questions first:

1. **Hierarchy** — Is the most important current task/state obvious?
2. **Speed** — Can routine play happen without opening unnecessary modal chains?
3. **Truthfulness** — Does the UI imply only state/mechanics the system actually owns?
4. **Coexistence** — Does the transient REF fit the BASE without destroying orientation?
5. **Role clarity** — Is Player vs DM information/control separation obvious?

Visual styling, color, typography, animation polish, and micro-spacing can be refined after the owner accepts the information hierarchy.

# 10. Current handoff state

```text
BASE-01  NOT_DRAWN
BASE-02  NOT_DRAWN
BASE-03  NOT_DRAWN
BASE-04  NOT_DRAWN
BASE-05  NOT_DRAWN

REF-01   NOT_DRAWN
REF-02   NOT_DRAWN
REF-03   NOT_DRAWN
REF-04   NOT_DRAWN
REF-05   NOT_DRAWN
REF-06   NOT_DRAWN
REF-07   NOT_DRAWN
REF-08   NOT_DRAWN
REF-09   NOT_DRAWN
REF-10   NOT_DRAWN
```

Next visual action: **BASE-01**, unless the owner explicitly chooses another item.
