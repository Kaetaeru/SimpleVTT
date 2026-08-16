# Local Persistence and Character Library

This document defines the Phase 10 local persistence boundary. It extends the state-lifetime rules in `character-lifecycle.md` and `session-runtime.md`.

## 1. Persistence is not AppSnapshot serialization

`AppSnapshot` mixes durable Character ownership with transient UI/session state. It is never the on-disk schema.

The local Character library persists only player-owned durable state:

- Character source/build identity and selections;
- a monotonically increasing source revision;
- Character durable runtime state such as HP, Resources and ItemInstance mutable state;
- a separate monotonically increasing runtime revision;
- RulesProfile identity/version and qualified content/source identities where available.

Scene, connection state, initiative/economy, PendingResolution, session-only effects, content-import previews, and other transient UI/session fields are not Character-library state.

## 2. Materialized cache is explicitly non-authoritative

Phase 10 begins while some current Character source graphs are still represented by legacy/application fields. The v1 record may therefore retain a materialized `CharacterSheet` cache so the current UI can be reconstructed without losing data.

That cache is not canonical source data. Revision decisions are made from the separated `source` and `runtime` projections. As ContentCatalog/source reconstruction becomes complete, the cache may be discarded and rebuilt.

Derived totals such as AC, attack modifiers, save DCs, action availability, and presentation labels must not become authoritative merely because they appear in the cache.

## 3. Revision model

Each record has independent revisions:

- `sourceRevision` changes only when durable build/source selections change;
- `runtimeRevision` changes only when durable mutable Character state changes;
- `storageRevision` belongs to the library document generation and changes for every committed file generation.

A stale writer must be rejected rather than overwriting a newer generation.

## 4. Generation-based local commit protocol

The desktop store uses immutable committed generations rather than overwriting one file in place.

```text
character-library.17.json       previous valid generation
character-library.18.json.tmp   write + flush in progress
character-library.18.json       atomically renamed committed generation
```

A read scans committed generations from newest to oldest. An unreadable/invalid newest generation does not destroy the previous valid generation; the application may recover from the older valid document and the next write advances beyond the highest physical generation.

Temporary files are never treated as committed state. Old committed generations may be pruned only after the new generation is safely committed.

## 5. Failure policy

- No valid generation + existing corrupt generations is an explicit blocker; do not silently seed a new library over the damaged data.
- A failed write leaves the previous committed generation authoritative.
- Schema/version mismatches are explicit until a migration exists.
- In browser/dev contexts, an explicitly volatile in-memory store may be used for testing/preview, but it must never be represented as durable local persistence.

## 6. Write-back roadmap

The first Phase 10 slice establishes the library contract and storage transaction. Follow-up slices connect:

1. Character creation/edit and progression commits;
2. draft autosave/recovery;
3. ResolutionEvent state changes whose `writeBack` class is `character`;
4. real ContentCatalog/local-homebrew installation state.

Session-only state remains outside the permanent Character file unless a specific rule and write-back classification says otherwise.

## 7. Movement boundary

Persistence does not add battle-map state to Core. Coordinates, tokens, grids, paths, LOS and external map-module state remain outside the core Character library unless a future optional module defines and owns its own persistence contract.
