# SimpleVTT Core Systems UX Plan

Status: **OWNER-DIRECT REVIEWED PRODUCT DIRECTION — PROTOTYPE CANDIDATE — RUNTIME NOT YET AUTHORIZED**

Owner direction:

> 인벤토리같은 시스템도 어떻게 하는게 좋을지도 생각해봐야겠어. 그걸 포함한 다른 공식 시스템도 고려해봐.
>
> 그래 그걸 기준으로 기획을 짜보고 UI 위치도 데모로 만들어봐.

This plan defines one shared interaction grammar for the recurring D&D-facing systems that SimpleVTT must present without turning each subsystem into a separate product.

Read with:

- `docs/design/content-modules-items.md`;
- `docs/design/session-runtime.md`;
- `docs/design/persistence.md`;
- `docs/design/ui-ux/decisions.md`;
- `docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md`;
- `docs/design/ui-ux/DM-LIBRARY-PLAN.md`;
- the Owner-accepted Connected Play reference under `prototype/app/integrated-reference.*`.

The accepted Connected Play geometry remains valid. This plan defines where system management, live execution, quick retrieval, and persistent status belong inside that accepted composition.

---

# 1. One grammar for every recurring system

SimpleVTT uses four presentation roles instead of inventing a different UX model for Inventory, Spells, Features, Conditions, Rest, loot, or DM preparation.

```text
MANAGE
Full source/owned-state inspection and editing
-> Character Sheet / dedicated Library / Party Stash detail

USE
What can be executed right now
-> Command Center / current task response

STATUS
What is currently affecting the Actor/session
-> Actor Card / Resource Rail / compact persistent chips

QUICK
Find/add/reveal/apply something without abandoning Play
-> Quick Search / Command Palette
```

A subsystem may participate in more than one role, but each role has one clear presentation responsibility.

Hard rule:

> Full collection != live action surface.

Inventory is not the Item Hotbar. Spellbook is not the Spell Hotbar. Feature list is not the executable Feature Hotbar. DM Library is not the live Quick palette.

---

# 2. Product placement map

```text
PRODUCT SHELL
Home
Characters
  -> Character Sheet
     -> Overview
     -> Inventory
     -> Spells
     -> Features
     -> Status
Session
  -> Host / Join
  -> DM Library          [offline Host preparation]
  -> Party Stash         [when a live/resumable party context supports it]
Content                  [definitions/packages, not owned instances]
Rules                    [authoritative rules browse/search]
Settings

CONNECTED PLAY
Compact Play chrome
  -> Quick (+ / Ctrl+K)  [DM when authorized; contextual Player quick lookup may be narrower]
Upper Actor Board
Mapless Stage
Lower Actor Board
Command Center
  -> Mixed
  -> Action
  -> Spell
  -> Item
  -> Custom
  -> Resource Rail
```

No new permanent global destination is added for Inventory, Spellbook, Features, Conditions, Rest, Party Stash, or DM Quick.

---

# 3. Inventory / equipment / containers

The Character Inventory is the durable owned-item management surface.

It reads/writes canonical `ItemInstance` state; it does not clone definition data into presentation-owned UI fields.

## 3.1 Inventory management view

Required play-relevant fields:

- item name/identity;
- quantity;
- equipped/wielded/active state when canonical;
- charge/resource summary;
- short mechanical summary;
- granted Action shortcut when applicable;
- container/location presentation where supported;
- weight/encumbrance projection only from canonical/profile-provided state;
- explicit unavailable/invalid source state;
- details/provenance on demand.

Recommended organization:

```text
Inventory
├─ Equipped / Active
├─ Consumables
├─ Carried containers
│  ├─ Backpack
│  └─ Bag / pouch / other profile-supported container
├─ Other carried items
└─ Not carried / stored, when the canonical model supports it
```

Common contextual operations may include:

- Use;
- Equip / Unequip;
- Wield / Stow where canonical;
- activate/deactivate/configure;
- move to container;
- split/merge stack;
- Give / transfer;
- Drop/remove;
- Details.

UI must not create separate arbitrary booleans when `ActivationState`, configuration, resource, or ownership contracts already model the concept.

## 3.2 Live Item use

Executable Item capabilities project into the Command Center `Item` page and optionally `Mixed`.

Example:

```text
Inventory source
Potion of Healing x3
      ↓ executable projection
Command Center / Item
Potion x3
      ↓ use + target + resolve
one ResolutionEvent
- healing/effect
- quantity 3 -> 2
```

Quantity/resource/effect changes from one item use commit atomically. The UI never decrements inventory separately from the action resolution.

Passive items do not occupy Hotbar space merely because they exist.

---

# 4. Spellbook / spellcasting

The full Spellbook is a management/inspection surface inside the Character Sheet.

It presents profile-provided concepts such as:

- known/available spells;
- prepared/active state where applicable;
- level/category;
- spell-slot/resource state;
- source/class/list provenance;
- concentration/ritual or other profile-provided tags;
- invalid/unavailable source state.

It does not hard-code one rules edition's preparation model into UI authority.

Executable spells project to the Command Center `Spell` page.

```text
Spellbook = what the Actor knows/owns/configures
Spell Hotbar = what the Actor can cast/use now
Resource Rail = current slots/points/charges relevant now
```

Selecting a spell may open only the choices actually required by the canonical action: slot/upcast, target, variant, resource, etc.

---

# 5. Features, traits, actions, and class resources

The Character Sheet owns the complete Features/Traits record.

Examples of presentation categories may include class, species/ancestry, feat, item-granted, temporary, and other provenance groups supplied by content/profile.

Features divide into:

```text
PASSIVE
Visible in Sheet/detail/status when useful
Does not automatically become a Hotbar slot

EXECUTABLE
Projects to Action/Mixed/Custom as appropriate

RESOURCE
Projects current count to Resource Rail when relevant

REACTIVE / CONDITIONAL
Appears when the authoritative timing/context allows it
```

`Known capability` and `currently executable capability` are not the same thing.

---

# 6. Conditions, effects, concentration, exhaustion, life state

Conditions/effects are state, not a permanent management dashboard during normal play.

## 6.1 Compact status placement

Actor Card may show a bounded set of important condition/effect indicators.

Command Center controlled-Actor summary may show:

- concentration;
- severe/important condition;
- life-state marker;
- other current high-priority state supplied by the canonical projection.

Do not overload Actor Cards with full effect text.

## 6.2 Detail

Click/focus opens detail explaining:

- effect/condition name;
- source;
- duration/expiry where known;
- relevant public mechanical summary;
- removal/recovery affordance only when authoritative/user-allowed.

## 6.3 Concentration / interrupt-like state

Concentration gets stronger persistent visibility than an ordinary passive effect because it is operationally easy to miss.

When a response is required, the current Play context presents a focused response layer. It does not navigate to a separate Condition page.

## 6.4 DM fast apply

The DM can find a condition/effect through Quick Search and explicitly `Apply` it to the current/selected Actor when the domain contract supports that operation.

Quick Search supplies the item; authoritative selection/targeting and Resolution/Adjudication semantics still own the mutation.

---

# 7. Rest and recovery

Short/Long/other profile-defined rest is modeled as an Activity/workflow, not a blind reset button.

The workflow is:

```text
Choose Rest
-> show authoritative preview of affected resources/state
-> collect real choices only (e.g. spend hit dice when applicable)
-> validate
-> explicit Complete Rest
-> commit canonical event/state changes
```

Preview may summarize:

- HP recovery;
- hit-die use/recovery;
- spell/resource recovery;
- feature recharge;
- effect/exhaustion changes;
- unresolved blockers or choices.

UI never invents which resources recover; the RulesProfile/content/runtime projection provides the effect set.

---

# 8. Party Stash / shared loot

SimpleVTT should support a shared Party Stash as a distinct Session/party-owned inventory concept when the domain persistence contract is materialized.

It is not silently embedded into one Player Character inventory.

Baseline presentation:

- shared currency/value groups when canonical;
- item stacks;
- source/provenance when useful;
- transfer destination;
- session/durable ownership state;
- explicit validation when an item cannot be durably granted.

Transfer grammar:

```text
Party Stash Potion x4
-> Give to Rowan x2
-> one validated transfer transaction
-> Party x2 / Rowan x2
```

A DM may also use Quick Search on an ItemDefinition/content entry and choose an explicit destination such as `Give` or `Party`.

Permanent Character grants require the existing durable grant/write-back semantics; session-only loot must not silently become permanent.

---

# 9. DM Quick Search / Command Palette

The full DM Library remains the preparation surface. During live play the primary retrieval path becomes **DM Quick Search**, not a nested Encounter/Library browser.

Keyboard baseline:

```text
Ctrl+K
```

Discoverable pointer baseline:

```text
small DM-only + / Quick control in Play chrome
```

Opening Quick Search overlays the current accepted Play scene without replacing it.

## 9.1 Unified result types

The palette may search authorized local/session/catalog sources and display typed actions:

```text
ACTOR      Nightcrow Archer       [+1] [more]
IMAGE      Sealed Letter          [View] [Reveal]
ITEM       Potion of Healing      [Give] [Party]
CONDITION  Poisoned               [Apply]
RULE       Poisoned               [Open]
```

The result row action verb matters more than the source store.

## 9.2 Empty query

With no query, prioritize:

- Recent;
- Favorites;
- current-session relevant entries;
- small categorized results.

The user should not need to search for the same NPC repeatedly.

## 9.3 Actor quick add

Primary path:

```text
Ctrl+K -> type name -> +1
```

One click creates one independent Session Actor.

A secondary `more` menu may expose `+2`, `+3`, `+5`, custom quantity, relation override when authorized, or `Open in DM Library`.

The old nested `Encounter -> Add Actor -> From DM Library -> quantity -> Add` path remains a detailed management fallback, not the primary live path.

## 9.4 Image quick use

Image actions are deliberately separate:

- `View` = private local preview;
- `Reveal` = explicit shared Handout action.

Selecting a result never reveals it by itself.

## 9.5 Item quick grant

Item search may offer:

- `Give` -> choose authorized Character/Actor destination;
- `Party` -> Party Stash;
- `Open` -> definition/details.

No UI-only copy may bypass content compatibility, ownership, or durable-grant validation.

## 9.6 Condition quick apply

Condition search may offer `Apply` only when an authoritative DM adjudication/action path exists. Applying still selects the target/context and creates proper state/event provenance.

## 9.7 Rule quick lookup

Rules results open lightweight contextual lookup over preserved Play, never replace current Session state.

---

# 10. Player live Quick behavior

The unified palette concept does not imply that Players receive DM Library or private content.

A future Player Quick Search may be scoped to authorized sources such as:

- own capabilities;
- own inventory/spells/features;
- public Rules lookup;
- current authorized session references.

It must not expose Host-preparation catalogs.

---

# 11. Command Center role

The Command Center is the **final live execution surface**, not a database browser.

```text
Mixed
- most relevant current executable capabilities

Action
- executable action/feature capabilities

Spell
- currently executable spells

Item
- currently executable owned item capabilities

Custom
- user-curated slots/pages only when canonical customization persistence exists
```

Resource Rail shows current operational resources; it does not replace Inventory/Spellbook/Feature details.

---

# 12. Status placement rules

Use the smallest persistent surface that prevents forgotten state.

| State | Primary live placement |
| --- | --- |
| HP / Temp HP | Actor Card + controlled Actor summary |
| Action economy | Command Center, Initiative only |
| Spell slots / class resources / charges | Resource Rail when relevant |
| Ordinary conditions | Actor Card compact badges |
| Concentration | controlled Actor summary + response when triggered |
| Severe life state | Actor Card + current response/task |
| Inventory quantity for executable consumable | Item Hotbar slot/detail |
| Full inventory location/container | Inventory management only |
| Full spell list | Spellbook only |
| Full feature list | Features management only |
| Shared loot | Party Stash / transfer workflow |

Do not duplicate every state everywhere.

---

# 13. Authority and lifetime boundaries

The UX must preserve these distinctions:

```text
Content definition
-> reusable ItemDefinition / spell / condition / rule source

Character durable
-> owned ItemInstance / selected spell/configuration / durable resources

Host preparation durable
-> DM Library images / Actor presets / NPC definitions

Session authority
-> CombatantState / instantiated Actors / initiative / session-only items/effects / Party Stash state when session-owned

Presentation
-> Hotbar ordering, open tab, palette query, preview state
```

UI must not infer or collapse these lifetimes.

---

# 14. Candidate prototype scenarios

The system-position prototype must show at least:

## SYS-SCN-00 — Product placement map

- where Character management systems live;
- where DM Library lives;
- where Party Stash lives;
- where Quick Search lives;
- where live execution/status lives.

## SYS-SCN-01 — Character Inventory management

- Equipped/Consumables/Containers/Other;
- quantity/charges;
- quick Use affordance;
- full inventory stays a Sheet management surface.

## SYS-SCN-02 — Spellbook + Features management

- complete owned/known records;
- prepared/active/resource examples;
- executable vs passive distinction.

## SYS-SCN-03 — Player live Quick Use

- accepted Play scene;
- Item and Spell Hotbar pages;
- Resource Rail;
- compact condition/concentration state;
- no full inventory/spellbook dumped into Play.

## SYS-SCN-04 — DM unified Quick Search

- accepted DM Play scene preserved;
- Ctrl+K / small Quick launcher;
- Actor/Image/Item/Condition/Rule typed results;
- direct action verbs.

## SYS-SCN-05 — Party Stash / loot transfer

- shared inventory;
- Give/transfer flow;
- before/after ownership preview;
- no implicit permanent grant.

## SYS-SCN-06 — Rest preview

- Short/Long/profile-defined Activity selector;
- affected-state preview;
- choices only where real;
- explicit Complete action.

## SYS-SCN-07 — Condition / concentration response

- compact status in normal Play;
- focused detail/response only when needed;
- DM Quick `Apply` example.

---

# 15. Prototype disposition

Candidate review entry:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

This is a **new candidate extension**. It does not replace or invalidate the existing Owner-accepted `integrated-reference.html` scenes.

The candidate is allowed to propose the new small Quick launcher and the management/detail surfaces described here. Those additions require Owner visual/flow acceptance before becoming part of the accepted consolidated reference.

---

# 16. Runtime blockers before implementation

Planning/prototype may proceed, but runtime implementation needs explicit domain/architecture support for any missing boundary, including:

- Party Stash ownership/persistence/lifetime;
- durable item transfer/grant semantics beyond existing supported paths;
- Quick Search source aggregation/indexing and privacy boundaries;
- DM Library actor/image persistence gaps already identified;
- Handout network/reconnect;
- canonical condition/effect fast-apply/adjudication path where not already represented;
- rest preview/commit projection if current runtime does not expose it;
- user Hotbar customization persistence where Custom becomes real.

Do not solve these gaps by inventing React-local authority.

---

# 17. Scope guard

This plan does not authorize:

- a tactical inventory/map relationship;
- ground-item x/y placement;
- arbitrary item code execution;
- DM access to Player-private durable Character source outside authorized projection/write-back;
- auto-reveal of private images;
- auto-application of conditions without authoritative state/event semantics;
- edition-specific hard-coded recovery rules in UI;
- one giant always-open system dashboard during Play;
- replacing the accepted Actor Boards / Mapless Stage / Command Center composition.
