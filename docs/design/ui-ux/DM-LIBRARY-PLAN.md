# SimpleVTT DM Library — Product / UX Plan

Status: **OWNER-DIRECT REVIEWED PRODUCT DIRECTION — RUNTIME NOT YET AUTHORIZED**

Owner direction:

> DM은 혼자 액세스 가능한 전용 라이브러리 시스템이 있었어야해. 거기에 이미지와 PC액터와 NPC액터를 미리 모아두고 사용할수 있어야했어.

This document defines the missing durable DM-preparation product concept. It supplements the current UI/UX decision ledger for this domain and must be read with:

- `docs/design/ui-ux/decisions.md`;
- `docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md`;
- `docs/design/persistence.md`;
- `docs/design/session-runtime.md`;
- `docs/design/ui-ux/prototype/app/integrated-reference.html`.

The existing accepted Connected Play composition remains valid. DM Library adds preparation and invocation flows; it does not replace the accepted Play scene.

---

# 1. Product definition

**DM Library** is a durable local preparation library for the local user who may Host sessions.

It stores reusable material that the user can prepare before play and explicitly bring into a live Session.

The visible product name is `DM Library` because that is the user-facing task model. Architecturally, Offline/Standalone still has no hidden DM/Player role. Before a session is opened, this is local Host-preparation data, not connected-role authority.

DM Library is **not**:

- the Player Character Library;
- the Content/Add-on package catalog;
- current Session state;
- a battlemap asset browser;
- a network-shared directory;
- permission to deliver private preparation data to Clients.

---

# 2. Required collections

The v1 DM Library has three first-class collections.

```text
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions
```

All three collections support durable local organization and reuse.

Minimum common library affordances:

- search;
- folders/collections;
- tags;
- favorites;
- recent-use ordering;
- create/import where applicable;
- edit/duplicate/delete;
- visible validation/problem state;
- preview/details without adding the entry to a Session.

Exact metadata schema and storage limits remain Architecture concerns, not UI-derived truth.

---

# 3. Images

`Images` stores DM-prepared local presentation assets such as:

- portraits;
- letters/documents;
- illustrations;
- symbols/emblems;
- location art;
- other Handout-like visual material.

A Library image is private local preparation data until the DM explicitly uses it in a live Session.

Baseline metadata may include:

- display name;
- local asset identity/reference;
- folder;
- tags;
- favorite;
- DM-only note;
- recent-use information.

## 3.1 Live use

The canonical live flow is explicit:

```text
DM Library / Images
    -> select image
    -> preview
    -> explicit Show to Players / Reveal action
    -> existing Handout presentation mode
```

Merely opening, previewing, organizing or selecting an image in DM Library does **not** reveal or transmit it.

Handout remains image presentation only and never becomes a battlemap.

Real cross-network image transfer/reconnect still depends on `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 4. NPC Actor Definitions

`NPC Actor Definitions` is the durable reusable DM collection for prepared NPC/monster/creature Actor definitions.

Examples:

```text
Bandits/
  Nightcrow Archer
  Nightcrow Bruiser
  Nightcrow Scout

Undead/
  Skeleton
  Skeleton Warlord

Named NPC/
  Leonhardt
  Daren
```

A reusable definition may present/reference:

- portrait;
- name;
- default relation/side presentation;
- stat block identity/data;
- HP/AC and other derived/readable projections;
- actions;
- spells;
- resources;
- traits;
- reactions;
- tags;
- DM-only notes;
- installed content/rules source references where applicable.

UI must not make derived values authoritative merely because they are displayed in the library.

## 4.1 Instantiation rule

Adding an NPC from the Library to a Session **creates a new Session Actor/Combatant instance**.

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

Each Session instance receives its own runtime identity and mutable Session state.

Removing or damaging a Session Actor does not delete/change the Library entry.

Deleting or editing the Library entry after instantiation does not silently rewrite an already-live Session instance.

---

# 5. PC Actor Presets

`PC Actor Presets` are DM-prepared **player-shaped Actor templates/presets** for play situations such as:

- pre-generated guest Characters;
- temporary allies;
- companions;
- one-shot pregens;
- substitute/temporary Player-controlled Actors.

They are deliberately **not the same durable object as a Player-owned Character**.

A PC Actor Preset does not grant the DM ownership of a Player Character source file.

## 5.1 Session use

A PC Actor Preset may be instantiated into the Session as an allied/player-shaped Actor.

By default it may remain DM-controlled.

The DM may then explicitly assign Session control to a connected Player under the existing control-assignment model.

```text
PC Actor Preset
    -> instantiate Session Actor
    -> optional Assign Control to Player
```

Assigning control changes Session control authority only. It does not transfer durable Character ownership.

The Client receives only the authorized Session projection needed to operate the Actor, not the DM Library entry or its private metadata.

---

# 6. Privacy and delivery boundary

DM Library is private-by-default local preparation data.

Clients must not receive the library catalog merely because a Session exists.

This includes, unless explicitly required by a later authorized projection:

- entry names;
- folders;
- tags;
- filenames;
- unpublished portraits/images;
- unrevealed NPC definitions;
- DM-only notes;
- unused Actor presets;
- existence metadata for secret prepared assets.

The rule is:

```text
DM Library private source
        ↓ explicit DM action
Session-authorized projection/instance
        ↓ only authorized projection
Player Client
```

CSS hiding is never sufficient privacy.

---

# 7. Product navigation

DM Library does **not** become a new permanent global top-level destination.

The existing global navigation remains:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

The primary offline preparation entry lives under `Session` because it prepares connected Host/DM play.

Recommended Session destination structure:

```text
Session
├─ Host Session
├─ Join Session
└─ DM Library
   ├─ Images
   ├─ PC Actors
   └─ NPC Actors
```

This preserves `Content` for declarative packages/Add-ons rather than mixing packages with personal prepared play material.

---

# 8. Live Connected Play invocation

The accepted Connected Play skeleton is preserved.

DM Library is invoked contextually from the task that needs it.

## 8.1 Encounter

```text
Encounter
  -> Add Actor
     -> From DM Library
        -> PC Actors | NPC Actors
        -> search/filter/select
        -> quantity where applicable
        -> Add to Session
```

Adding does not navigate away from Play and does not replace the Actor Boards / Stage / Command Center skeleton.

## 8.2 Handout / Session image presentation

```text
Session / Handout
  -> Choose Image
     -> DM Library / Images
     -> preview
     -> explicit Reveal
```

No reveal occurs merely by choosing a library item.

## 8.3 Actor detail / control

After a PC Actor Preset or NPC Actor Definition is instantiated, all normal control/Encounter/Initiative behavior operates on the **Session Actor**, not on the Library source entry.

---

# 9. Separation from existing stores

SimpleVTT now has three distinct durable/transient layers that must not be collapsed.

```text
PLAYER DURABLE
Character Library
└─ Player-owned canonical Characters

LOCAL HOST PREPARATION DURABLE
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions

SESSION TRANSIENT / AUTHORITATIVE
Current Session
├─ Character SessionProjections
├─ instantiated PC/NPC Actors
├─ active/revealed Handout
├─ HP / resources / effects
├─ Initiative / economy
└─ Resolution / Activity state
```

`Content` remains a fourth separate concept: installed declarative rules/content packages and their provenance/lifecycle.

---

# 10. Organization and usability principles

The Library should support a DM preparing a large campaign without becoming a generic file manager.

Required UX principles:

1. **Fast retrieval during play** — search, recent, favorites and compact category filtering are more important than deep filesystem semantics.
2. **Preparation before play** — all material can be inspected/edited without opening a live Session.
3. **Explicit publish boundary** — private material never becomes shared merely because it is selected.
4. **Reusable source vs live instance** — runtime mutation never silently rewrites the prepared definition.
5. **Batch-friendly Encounter use** — repeated NPCs should be addable without recreating the definition.
6. **No map semantics** — Images are presentation assets and Actors remain mapless Actor entries/cards in Core.
7. **Private notes remain private** — a projected Actor can omit DM-only notes/metadata even when the Actor itself is visible to Players.

---

# 11. Initial visual model

The dedicated DM Library preparation surface uses a three-zone model:

```text
Session / DM Library
────────────────────────────────────────────────────────
Collection / folders   Library grid/list      Detail
Images                 search                 preview
PC Actors              filters                metadata
NPC Actors             cards                  actions
────────────────────────────────────────────────────────
```

Recommended detail actions depend on collection/context:

### Offline preparation

- Preview/Open;
- Edit;
- Duplicate;
- Favorite;
- Delete;
- Create/Import.

### Live DM context

Images additionally expose:

- Reveal / Show to Players.

PC/NPC Actors additionally expose:

- Add to Session;
- quantity for repeated NPC instantiation where appropriate.

The interface must visibly distinguish `Local / Not shared` from `In current Session` / `Revealed` state.

---

# 12. Initial acceptance scenarios

The prototype extension must show at minimum:

## DMLIB-SCN-01 — Offline Image Library

- Session -> DM Library;
- Images selected;
- folders/tags/search;
- image cards;
- preview/details;
- clear `Local · Not shared` state;
- no reveal button that pretends a Session exists.

## DMLIB-SCN-02 — Offline NPC Actor Library

- NPC Actors selected;
- reusable definition cards;
- one named NPC and repeated generic NPC examples;
- content validation/problem example;
- edit/duplicate flow affordances.

## DMLIB-SCN-03 — Offline PC Actor Presets

- PC Actors selected;
- clear label that these are Host-prepared Actor presets, not Player-owned Characters;
- edit/duplicate/preview.

## DMLIB-SCN-04 — Live Encounter: Add from Library

- accepted DM Play scene remains underneath;
- Encounter contextual pane open;
- Add Actor -> From DM Library;
- PC/NPC tabs/search;
- choose repeated NPC and quantity;
- explicit Add to Session;
- Session Actor appears independently from source definition.

## DMLIB-SCN-05 — Live Handout: Reveal from Library

- accepted DM Play scene remains underneath;
- choose DM Library image;
- private preview first;
- explicit Reveal;
- only after Reveal does the shared Handout presentation become active.

## DMLIB-SCN-06 — Player non-delivery

- Player Play contains no DM Library launcher/catalog;
- unrevealed image/NPC/preset names do not appear;
- only authorized Session Actor/Handout projection is visible.

---

# 13. Runtime blockers / architecture work required before implementation

Runtime implementation must not begin by inventing these contracts in React.

Required architecture work:

- durable DM Library metadata persistence contract;
- local image asset storage/lifecycle contract;
- Actor preset/definition durable schema and versioning;
- definition -> Session Actor instantiation contract;
- installed-content dependency validation at load/instantiate time;
- private library -> authorized Session projection boundary;
- Handout transfer/reconnect contract for real connected image reveal;
- explicit deletion/orphan/reference behavior for stored image assets.

Known existing blockers remain relevant:

- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL` where private connected delivery semantics overlap.

---

# 14. Scope guard

This plan does not authorize:

- a battlemap library;
- map/token placement;
- storing Scene x/y state;
- automatic live synchronization from Library definition changes;
- treating PC Actor Presets as Player-owned Characters;
- sending the entire Library manifest to Clients;
- executable plugin/runtime code inside Library entries;
- implementation of unresolved binary transport/storage details in UI code.

---

# 15. Next route

1. Architecture/persistence contract for DM Library.
2. Prototype extension covering DMLIB-SCN-01 through DMLIB-SCN-06.
3. Owner visual/flow review of the extension.
4. Update accepted prototype baseline without invalidating already-accepted unrelated scenes.
5. Materialize runtime surface/component/interaction contracts.
6. Create a scoped runtime Work Order.
7. Only then implement DM Library runtime UI/persistence/network projections.
