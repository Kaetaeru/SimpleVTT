# DM Library Persistence, Privacy, and Session Projection

Status: **PLANNED ARCHITECTURE CONTRACT — IMPLEMENTATION NOT YET AUTHORIZED**

Product plan:

`docs/design/ui-ux/DM-LIBRARY-PLAN.md`

This document defines the architecture boundary for durable DM-preparation material. It must remain compatible with:

- `docs/design/persistence.md`;
- `docs/design/session-runtime.md`;
- `docs/design/character-session-projection.md`;
- `docs/design/content-modules-items.md`;
- `docs/design/installed-content-catalog.md`.

It does not change the Player Character ownership model.

---

# 1. State lifetime

DM Library introduces a new lifetime/ownership family:

## HostPreparationDurable

Durable local data prepared by the local user for future Host/DM use.

Initial stored families:

- `LibraryImageAsset` metadata + local binary asset reference;
- `LibraryNpcActorDefinition`;
- `LibraryPcActorPreset`;
- folders/tags/favorites/recent-use metadata required to organize those records.

This lifetime is distinct from:

- `CharacterSource` / `CharacterRuntimeDurable`;
- `PortableDefinition` installed from Content packages;
- `SessionProjection`;
- `SessionRuntime`;
- `CombatantState`;
- `PendingResolution`;
- `EventHistory`.

DM Library records are not serialized `AppSnapshot` or Session snapshots.

---

# 2. Authority matrix extension

| State family | Offline authority | Connected authority | Persistence |
| --- | --- | --- | --- |
| Player Character source/runtime | local Player owner | Player source + Host session projection/event authority | Player durable local |
| DM Library metadata/assets | local application user | local Host only; not shared automatically | HostPreparationDurable |
| Instantiated Library Actor | n/a outside local preview | Host Session authority | Session only unless an explicit later save operation is added |
| Revealed Handout presentation | local source asset | Host controls active shared presentation | Session presentation; source asset remains HostPreparationDurable |
| DM-only Library notes | local application user | Host only | HostPreparationDurable; never Player projection by default |

The UI must not infer this matrix from visibility or role labels.

---

# 3. Separate durable store

DM Library must not be embedded in the Player Character Library document.

It must use a separate versioned durable store and namespace.

Recommended logical documents:

```text
simplevtt.dm-library-metadata
simplevtt.dm-library-assets
```

The exact physical layout is an implementation detail, but metadata and binary assets must have explicit lifecycle ownership.

The existing generation-based commit primitive SHOULD be reused for structured metadata where compatible:

```text
dm-library.17.json
dm-library.18.json.tmp
dm-library.18.json
```

A failed metadata write leaves the prior committed generation authoritative.

A corrupt newest generation must not destroy the previous valid generation.

Browser/dev fallback may be explicitly volatile but must never be presented as durable storage.

---

# 4. Metadata record model

Every durable entry needs stable identity independent from its display name or filesystem path.

Minimum shared metadata concept:

```text
LibraryEntryIdentity
- entryId
- entryKind: image | npc_actor | pc_actor_preset
- schemaVersion
- displayName
- folderId? / collectionId?
- tags[]
- favorite
- createdAt / updatedAt or equivalent durable ordering metadata
- localRevision
```

Exact field names/timestamps are not frozen by this planning document.

Names, folders and tags are presentation/organization metadata and never become Session entity identity.

---

# 5. Image asset storage

A `LibraryImageAsset` consists of structured metadata plus a local binary asset reference.

The metadata document must not duplicate arbitrarily large image bytes inline unless an explicit storage implementation proves that safe.

The binary store must eventually define:

- accepted image formats;
- maximum size/dimensions;
- validation before commit;
- stable local asset identity;
- atomic import semantics;
- deletion/garbage-collection semantics;
- behavior after metadata or binary corruption;
- duplicate handling;
- migration/version behavior.

These details are **not yet frozen**.

Until they are frozen, UI code must not invent size limits or promise content-addressed deduplication.

## 5.1 Delete behavior

Deleting a Library image removes the durable preparation entry according to the eventual asset-lifecycle transaction.

It must not retroactively mutate a previously committed Session history/event.

If a live Session is actively presenting an image whose source is being deleted, implementation must have an explicit safe policy before allowing the destructive action. Do not guess this in UI.

---

# 6. NPC Actor definition persistence

`LibraryNpcActorDefinition` is a reusable source definition, not mutable Session combat state.

The durable definition may reference installed declarative content/rules by stable qualified identities.

It may carry source data or compatible references needed to construct a valid Session Actor/Combatant.

Derived values may be cached for presentation but do not become canonical merely because they are stored.

## 6.1 Instantiation

Instantiation must create a new Session identity and mutable runtime state.

Conceptually:

```text
instantiate(libraryDefinition, sessionContext)
    -> validate referenced content/capabilities
    -> create new Session Actor identity
    -> materialize initial runtime projection
    -> commit/add through Host-authoritative Session operation
```

Each invocation is independent.

Three additions from one definition create three Session identities.

Later HP/resource/effect/economy changes affect Session instances only.

No automatic write-back to the source Library definition is allowed.

## 6.2 Missing content

If the definition references content that is missing, disabled, incompatible or invalid in the current composed catalog/session snapshot, instantiation must block or enter an explicit review path.

The UI must not silently drop unsupported actions/features and still claim the Actor is valid.

---

# 7. PC Actor preset persistence

`LibraryPcActorPreset` is HostPreparationDurable.

It is not `CharacterSource` and is not evidence of Player ownership.

Its durable schema may reuse compatible declarative Character/Actor structures where architecture permits, but ownership/lifetime remain distinct.

Instantiation creates a Session Actor.

Optional Player control assignment happens only after the Session Actor exists.

The existing rule remains:

```text
control assignment != Character ownership transfer
```

A Client must never persist a received PC Actor preset as its own Character merely because it was assigned Session control.

An explicit future `Adopt as Character` feature would require a separate product/domain contract and is out of this scope.

---

# 8. Private source vs Session projection

DM Library is not synchronized as a catalog.

The Host retains the private source locally.

Only an explicit action may create a Session projection:

```text
Library source
  -> explicit Add Actor / Reveal Image
  -> Host validates and creates Session-authorized projection
  -> Clients receive only required authorized projection
```

## 8.1 Actor projection

When a Library Actor becomes visible/controllable in Session, Clients may receive the Session Actor projection required by existing session rules.

They do not receive by default:

- Library entry ID if not required;
- folder/tag/favorite metadata;
- DM-only notes;
- unrevealed alternate images;
- other Library entries;
- source filesystem information.

## 8.2 Image projection

Selecting/preloading an image locally must not itself transmit it.

Real reveal transport is blocked until the Handout network architecture defines:

- binary transfer/session identity;
- validation;
- reconnect restoration;
- withdraw semantics;
- cache lifetime;
- privacy/non-delivery behavior.

Existing `GAP-HANDOUT-NETWORK-CONTRACT` remains authoritative.

---

# 9. Session snapshot relationship

A live Session must not depend on continued live mutation of the Library source.

When an Actor definition is instantiated, the Session receives the validated materialized Session Actor/Combatant state it needs.

Subsequent Library edits must apply only to future instantiations unless the DM performs a future explicit replacement/update operation defined by another contract.

Similarly, Content package updates do not silently rewrite the current live Session snapshot.

This prevents campaign preparation edits from mutating ongoing play unexpectedly.

---

# 10. Notes and secrecy

DM-only Library notes are private local source data.

They are never sent to a Player merely because:

- the corresponding Actor is in the Session;
- the Actor is assigned to that Player;
- the image/portrait is revealed;
- the Player opens Quick Sheet / Full Sheet.

A future explicit disclosure workflow may create authorized shared information, but it must be a separate projection operation.

CSS hiding is not a privacy mechanism.

---

# 11. Organization data

Folders, tags, favorites and recent-use information are durable preparation metadata.

They do not become gameplay rules or Session state.

Recommended semantics:

- moving an entry between folders changes only organization metadata;
- tagging does not change definition identity;
- favorite does not change source revision of gameplay data unless the storage schema intentionally has one combined local revision;
- recent-use metadata must not cause gameplay/source recompilation;
- deleting an empty folder must not delete contained entries unless the destructive operation explicitly says so.

Exact transaction granularity remains an implementation detail.

---

# 12. Import / export boundary

Import is allowed as a product direction but the final file/package schema is not frozen here.

Initial runtime work must distinguish:

- image import;
- Actor definition import;
- PC Actor preset authoring/import;
- Content/Add-on package import.

These must not be conflated into one generic executable plugin import path.

No Library import may execute arbitrary code.

Export/sharing of DM Library entries is a later capability unless separately authorized.

---

# 13. Recovery and revision

Structured DM Library metadata should follow the same broad safety principles as Character persistence:

- versioned schema;
- explicit migration;
- stable IDs;
- committed generation recovery;
- stale writer rejection where concurrent writes are possible;
- previous valid generation survives a failed commit;
- no silent reset over corrupt durable data.

Binary asset recovery requires its own finalized implementation contract before runtime work.

---

# 14. Explicit non-goals

This contract does not define or authorize:

- battlemap files as tactical Core state;
- Actor x/y coordinates;
- token placement;
- grid/path/LoS/fog persistence;
- DM ownership of Player Character files;
- automatic Client delivery of the private Library catalog;
- automatic Library write-back from Session runtime;
- arbitrary executable plugins;
- campaign journal/wiki functionality;
- cloud account synchronization.

---

# 15. Architecture gaps created by this plan

Before runtime implementation, materialize/resolve at least:

## GAP-DM-LIBRARY-METADATA-PERSISTENCE

- exact versioned document schema;
- generation/revision behavior;
- migration/recovery.

## GAP-DM-LIBRARY-ASSET-STORAGE

- binary storage representation;
- validation/limits;
- atomic import/delete;
- orphan/garbage collection.

## GAP-DM-LIBRARY-ACTOR-INSTANTIATION

- exact durable source schema for NPC/PC presets;
- validation against current content/session snapshot;
- Host-authoritative add transaction.

## GAP-DM-LIBRARY-PRIVATE-PROJECTION

- exact projection fields and non-delivery rules for private notes/source metadata.

Existing gaps that still apply:

- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 16. Implementation ordering

Recommended order:

1. structured metadata schema/store;
2. image asset store and local preview;
3. NPC Actor durable definition + local CRUD;
4. PC Actor preset durable definition + local CRUD;
5. definition -> local/Host Session Actor instantiation;
6. Encounter `Add from DM Library` UI;
7. private image selection + preview;
8. real connected Handout reveal after network contract;
9. Player control assignment for instantiated PC Actor where existing session authority supports it;
10. recovery/migration/destructive-action QA.

Do not start at step 6 by embedding fixture data in React while steps 1-5 are undefined.
