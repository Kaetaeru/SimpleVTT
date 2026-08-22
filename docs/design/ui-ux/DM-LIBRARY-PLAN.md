# SimpleVTT DM Library — Product / UX Plan

Status: **OWNER-DIRECT REVIEWED PRODUCT DIRECTION — RUNTIME NOT YET AUTHORIZED**

Owner direction:

> DM은 혼자 액세스 가능한 전용 라이브러리 시스템이 있었어야해. 거기에 이미지와 PC액터와 NPC액터를 미리 모아두고 사용할수 있어야했어.

Later live-use correction:

> 세션 내에서는 더 간단하게 액터를 추가하거나 이미지를 볼수있게 했으면 좋겠어.

This document defines the durable DM-preparation product concept and its revised low-friction live-use path.

Read with:

- `docs/design/ui-ux/CORE-SYSTEMS-UX-PLAN.md`;
- `docs/design/ui-ux/decisions.md`;
- `docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md`;
- `docs/design/dm-library-persistence.md`;
- `docs/design/session-runtime.md`;
- the Owner-accepted Connected Play reference under `prototype/app/integrated-reference.*`.

The accepted Connected Play composition remains valid. DM Library adds preparation and invocation flows; it does not replace the accepted Play scene.

---

# 1. Product definition

**DM Library** is a Campaign-scoped durable local preparation library for the local user who may Host sessions.

It stores reusable material for one Campaign that can be prepared before play and explicitly brought into a live Session launched from that Campaign. V1 does not implicitly share private entries, recents, favorites, notes, or search results across Campaigns.

The visible product name is `DM Library` because that is the user-facing task model. Architecturally, Offline/Standalone still has no hidden DM/Player role. Before a Session is opened, this is local Host-preparation data, not connected-role authority.

DM Library is not:

- the Player Character Library;
- the Content/Add-on package catalog;
- current Session state;
- a battlemap asset browser;
- a network-shared directory;
- permission to deliver private preparation data to Clients.

---

# 2. Required collections

```text
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions
```

All collections support durable local organization and reuse.

Minimum preparation affordances:

- search;
- folders/collections;
- tags;
- favorites;
- recent-use ordering;
- create/import where applicable;
- edit/duplicate/delete;
- visible validation/problem state;
- preview/details without adding/revealing anything to a Session.

Exact schema/storage limits remain Architecture concerns.

---

# 3. Images

`Images` stores local DM-prepared presentation material such as portraits, letters/documents, illustrations, symbols/emblems, location art, and other Handout-like visual assets.

A Library image remains private local preparation data until an explicit live Reveal action.

Baseline metadata may include:

- display name;
- local asset identity/reference;
- folder;
- tags;
- favorite;
- DM-only note;
- recent-use information.

## 3.1 Preparation flow

```text
Session -> DM Library -> Images
-> organize/search/open
-> private preview
-> edit metadata
```

No live Session is required.

## 3.2 Live flow — revised primary path

Primary live use is **Quick Search**, not navigating through the full Library.

```text
Ctrl+K / + Quick
-> search image
-> View      = private Host preview
-> Reveal    = explicit shared Handout action
```

Selecting a result does not reveal it.

The detailed Session/Handout browser may still open the full Library as a fallback when the DM needs filtering, metadata, or extended management.

Handout remains image presentation only and never becomes a battlemap.

Real cross-network image transfer/reconnect still depends on `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 4. NPC Actor Definitions

`NPC Actor Definitions` is the durable reusable collection for prepared NPC/monster/creature Actor definitions.

Examples:

```text
Bandits/
  Nightcrow Archer
  Nightcrow Bruiser

Undead/
  Skeleton
  Skeleton Warlord

Named NPC/
  Leonhardt
  Daren
```

A reusable definition may present/reference portrait, name, default relation/side presentation, stat block identity/data, HP/AC projections, actions, spells, resources, traits, reactions, tags, DM-only notes, and installed-content/rules source references where applicable.

UI must not make derived values authoritative merely because they are displayed in the Library.

## 4.1 Instantiation rule

Adding an NPC creates a new independent Session Actor/Combatant instance.

```text
Library Definition
Nightcrow Archer
initial HP 22

        instantiate
          ↓

Session Actor A  HP 22
Session Actor B  HP 22
Session Actor C  HP 22
```

Runtime changes to A/B/C do not mutate the Library definition.

Deleting/editing the Library source does not silently rewrite already-live Session Actors.

## 4.2 Live flow — revised primary path

Primary:

```text
Ctrl+K / + Quick
-> type Nightcrow
-> Nightcrow Archer [+1]
```

One `+1` creates one independent Session Actor immediately through the authoritative instantiation path.

Secondary `more` may offer:

- +2;
- +3;
- +5;
- custom quantity;
- other explicitly authorized spawn options;
- Open in DM Library.

The older nested flow:

```text
Encounter -> Add Actor -> From DM Library -> filters -> quantity -> Add
```

is retained only as a detailed fallback, not the normal live path.

---

# 5. PC Actor Presets

`PC Actor Presets` are DM-prepared player-shaped Actor templates for pregens, temporary allies, companions, one-shots, and substitute/temporary Player-controlled Actors.

They are deliberately not the same durable object as a Player-owned Character.

A PC Actor Preset does not grant the DM ownership of a Player Character source file.

## 5.1 Session use

```text
PC Actor Preset
-> instantiate Session Actor
-> default DM control
-> optional Assign Control to Player
```

Assigning control changes Session control authority only. It does not transfer durable Character ownership.

Quick Search may instantiate a PC Actor Preset with the same `+1` grammar as NPC definitions, while detailed assignment/control remains a Session operation after instantiation.

The Client receives only the authorized Session projection required to operate the Actor, never the private Library entry/notes.

---

# 6. Privacy and delivery boundary

DM Library is private-by-default local preparation data.

Clients must not receive the catalog merely because a Session exists.

This includes, unless explicitly projected later:

- entry names;
- folders;
- tags;
- filenames;
- unpublished portraits/images;
- unrevealed NPC definitions;
- DM-only notes;
- unused Actor presets;
- existence metadata for secret prepared assets.

```text
DM Library private source
        ↓ explicit DM action
Session-authorized projection/instance
        ↓ only authorized projection
Player Client
```

CSS hiding is never sufficient privacy.

Quick Search is Host-local UI and does not imply that its search index/catalog is sent to Players.

---

# 7. Product navigation

DM Library does not become a permanent top-level destination.

Global navigation remains:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

Offline preparation entry:

```text
Session
├─ Host Session
├─ Join Session
└─ DM Library
   ├─ Images
   ├─ PC Actors
   └─ NPC Actors
```

`Content` remains declarative package/catalog management, separate from personal prepared play material.

---

# 8. Live Connected Play invocation

The accepted Play skeleton remains underneath all DM Library invocation.

```text
Play chrome
Upper Actor Board
Mapless Stage
Lower Actor Board
Command Center
```

## 8.1 Primary — DM Quick Search

Keyboard:

```text
Ctrl+K
```

Pointer:

```text
small DM-only + / Quick control in Play chrome
```

The palette overlays Play and searches authorized Host sources.

DM Library result types use explicit action verbs:

```text
ACTOR  Nightcrow Archer  [+1] [more]
IMAGE  Sealed Letter     [View] [Reveal]
```

The broader cross-system palette may also include Item/Condition/Rule results as defined by `CORE-SYSTEMS-UX-PLAN.md`.

## 8.2 Recent/Favorites first

An empty query shows a small set of Recent/Favorites/currently relevant assets so repeat use can be:

```text
Ctrl+K -> click
```

rather than repeated navigation/search.

## 8.3 Detailed fallback

Encounter and Session/Handout panes may still expose `Open DM Library` or a compact detailed picker for management-heavy cases.

They are not the primary path for routine one-off add/reveal actions.

## 8.4 Feedback

Quick successful actions use minimal in-context acknowledgement, for example:

```text
Nightcrow Archer added   [+1 more] [Undo where canonical]
```

Do not keep the palette open as a blocking window after a routine single action unless the user intentionally pins/continues it.

---

# 9. Separation from existing stores

```text
PLAYER DURABLE
Character Library
└─ Player-owned canonical Characters

LOCAL HOST PREPARATION DURABLE
Campaign
├─ Party Stash / calendar / ration state
└─ DM Library namespace
   ├─ Images
   ├─ PC Actor Presets
   ├─ NPC Actor Definitions
   └─ Custom Item Definitions

CONTENT DEFINITIONS
ContentCatalog / packages
└─ reusable rules/items/spells/conditions/etc.

SESSION TRANSIENT / AUTHORITATIVE
Current Session
├─ Character SessionProjections
├─ instantiated PC/NPC Actors
├─ active/revealed Handout
├─ HP/resources/effects
├─ Initiative/economy
└─ Resolution/Activity
```

These layers must not be collapsed.

---

# 10. Usability principles

1. **Preparation can be deep; live retrieval must be shallow.**
2. **Quick Search is the DM's live hand; DM Library is the preparation room.**
3. **Recent/Favorites reduce repeated search.**
4. **Action verbs are explicit:** `+1`, `View`, `Reveal`, not ambiguous row clicks.
5. **Private preview is never publish.**
6. **Reusable source is never live mutable state.**
7. **Batch add is secondary:** single add stays one click; quantity lives behind `more`.
8. **No map semantics.**
9. **Private notes remain private.**
10. **Full Library remains reachable for management but should rarely interrupt play.**

---

# 11. Preparation surface visual model

The full Library still uses the three-zone preparation model:

```text
Session / DM Library
────────────────────────────────────────────────────────
Collection / folders   Library grid/list      Detail
Images                 search                 preview
PC Actors              filters                metadata
NPC Actors             cards                  actions
────────────────────────────────────────────────────────
```

This surface is optimized for preparation and editing, not live speed.

---

# 12. Revised prototype scenarios

## DMLIB-SCN-01 — Offline Image Library

- folders/tags/search;
- preview/details;
- `Local · Not shared`;
- no fake Reveal without a live Session.

## DMLIB-SCN-02 — Offline NPC Library

- reusable definition cards;
- named/repeated generic NPC examples;
- validation/problem example;
- edit/duplicate affordances.

## DMLIB-SCN-03 — Offline PC Actor Presets

- clearly Host-prepared presets, not Player-owned Characters.

## DMLIB-SCN-04 — Live Quick Actor add

- accepted DM Play scene underneath;
- Ctrl+K / Quick open;
- recent results and text search;
- `Nightcrow Archer [+1]`;
- Actor appears independently in the proper Actor Board;
- `more` exposes quantity only when requested.

## DMLIB-SCN-05 — Live Quick Image View/Reveal

- accepted DM Play scene underneath;
- Quick image result;
- `View` private preview;
- explicit `Reveal` shared Handout;
- no row-click auto reveal.

## DMLIB-SCN-06 — Player non-delivery

- no DM Library/Quick private source catalog;
- no unrevealed asset metadata/existence hints;
- only authorized Session projection.

The first DM Library candidate demonstrated the heavier nested flow and is now useful as preparation-surface evidence; live invocation review should use the broader Core Systems candidate prototype.

---

# 13. Runtime blockers

Runtime implementation must not invent these contracts in UI code:

- durable DM Library metadata persistence;
- Campaign identity, namespace isolation, and explicit duplicate/import behavior;
- local image asset storage/lifecycle;
- Actor definition/preset schema/versioning;
- definition -> Session Actor instantiation;
- installed-content dependency validation;
- private Library -> Session projection boundary;
- Handout transfer/reconnect;
- Quick Search aggregation/index privacy/caching boundaries;
- deletion/orphan/reference behavior for assets.

Known relevant gaps include:

- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL` where applicable.

---

# 14. Scope guard

This plan does not authorize:

- battlemap assets/placement;
- Scene x/y storage;
- automatic synchronization from Library definition edits into live Actors;
- treating PC Actor Presets as Player-owned Characters;
- sending the Library manifest/index to Clients;
- executable plugin code inside entries;
- auto-reveal from selection/search;
- UI-invented persistence/network semantics.

---

# 15. Next route

1. Review `CORE-SYSTEMS-UX-PLAN.md` and `prototype/app/core-systems-reference.html`.
2. Owner accepts/changes the unified Quick/Search and system placement grammar.
3. Reconcile the prior DM Library candidate: retain its preparation surface; supersede its heavy live picker as primary UX.
4. Materialize missing architecture/runtime contracts.
5. Update consolidated accepted prototype only after Owner review.
6. Create/refresh scoped runtime Work Orders.
7. Runtime implementation remains unauthorized until those gates are complete.
