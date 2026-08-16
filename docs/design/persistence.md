# Local Persistence and Character Library

This document defines the Phase 10 local persistence boundary. It extends the state-lifetime rules in `character-lifecycle.md` and `session-runtime.md`.

## 1. Persistence is not AppSnapshot serialization

`AppSnapshot` mixes durable Character ownership with transient UI/session state. It is never the on-disk schema.

The local Character library persists only player-owned durable state:

- Character source/build identity and selections;
- a monotonically increasing source revision;
- Character durable runtime state such as current HP, Temp HP, Resources, ItemInstance mutable state, and the explicitly modeled stable/unconscious/dead life flags;
- a separate monotonically increasing runtime revision;
- RulesProfile identity/version and qualified content/source identities where available.

Scene, connection state, initiative/economy, PendingResolution, session-only effects, content-import previews, and other transient UI/session fields are not Character-library state.

## 2. Materialized cache is explicitly non-authoritative

Phase 10 begins while some current Character source graphs are still represented by legacy/application fields. The v1 record may therefore retain a materialized `CharacterSheet` cache so the current UI can be reconstructed without losing data.

That cache is not canonical source data. Revision decisions are made from the separated `source` and `runtime` projections. As ContentCatalog/source reconstruction becomes complete, the cache may be discarded and rebuilt.

Derived totals such as AC, attack modifiers, save DCs, action availability, and presentation labels must not become authoritative merely because they appear in the cache.

## 3. Revision model

Each Character record has independent revisions:

- `sourceRevision` changes only when durable build/source selections change;
- `runtimeRevision` changes only when durable mutable Character state changes;
- `storageRevision` belongs to a persisted document generation and changes for every committed file generation.

A stale writer must be rejected rather than overwriting a newer generation.

Maximum HP is currently treated as a source/progression-derived property rather than duplicated into the runtime projection. A future ResolutionEvent that changes maximum HP therefore needs an explicit source-model contract; the runtime write-back path rejects such an event instead of silently changing revision ownership.

## 4. Generation-based local commit protocol

Desktop persistence uses immutable committed generations rather than overwriting one file in place.

```text
character-library.17.json       previous valid generation
character-library.18.json.tmp   write + flush in progress
character-library.18.json       atomically renamed committed generation
```

The Character library and authoring drafts use the same generation-store primitive but separate app-local-data directories and filename prefixes. Their generation numbers and recovery histories never share a namespace.

A read scans committed generations from newest to oldest. An unreadable/invalid newest generation does not destroy the previous valid generation; the application may recover from the older valid document and the next write advances beyond the highest physical generation.

Temporary files are never treated as committed state. Old committed generations may be pruned only after the new generation is safely committed.

## 5. Failure policy

- No valid generation + existing corrupt generations is an explicit blocker; do not silently seed new state over damaged data.
- A failed write leaves the previous committed generation authoritative.
- Schema/version mismatches are explicit until a migration exists.
- In browser/dev contexts, an explicitly volatile in-memory store may be used for testing/preview, but it must never be represented as durable local persistence.

## 6. Authoring draft persistence

Character authoring drafts are stored in a separate versioned `simplevtt.authoring-drafts` document. They are not embedded in the committed Character library and are not serialized `AppSnapshot`, `CharacterCreationPlan`, or `ProgressionPlan` values.

The creation draft stores user/source intent and the minimum recovery preconditions needed to decide whether that intent is still applicable: identity/content selections, ChoiceDefinition selections, ability input and roll-slot identity, equipment selections, notes/overrides, authoring cursor, the edited Character source revision when applicable, and the Character-library identity set that existed when a new draft began.

The progression draft stores only canonical progression input: Character ID, base Character `sourceRevision`, target progression track/class, HP input, ChoiceDefinition selections, and authoring cursor.

The following are deliberately not persisted as draft authority:

- creation `derived`, `finalAbilities`, validation output, or plan sections;
- progression `preview`, `hpGain`, validation output, legacy ASI mirror fields, or plan diffs;
- any Scene/session/resolution state.

Recovery runs only after Character-library hydration. A valid persisted intent is materialized into a draft skeleton and the current application/rules projection recomputes its derived plan. A progression/edit draft whose base source revision no longer matches is `stale` and is not silently replayed. A new creation draft whose Character-library identity precondition no longer matches is likewise stale; this protects the case where a Character commit succeeded but clearing the separate draft store failed.

Meaningful creation/progression mutations autosave the current intent. Autosave failure keeps the in-memory editable draft and the previous committed draft generation, and exposes persistence error state rather than rolling the user's current input back.

Character commit and draft clear are ordered transactions across two stores:

1. persist the Character revision successfully;
2. only then clear the corresponding authoring draft generation.

If Character persistence fails, the autosaved draft remains available for retry. If Character persistence succeeds but draft clear fails, the next boot detects the changed Character-library/source precondition and refuses to replay the old draft automatically.

## 7. ResolutionEvent Character write-back

`writeBack: "character"` is a persistence classification attached to an individual state change. It is not permission to serialize the runtime state or `AppSnapshot`.

The current Character write-back projection supports only local Character-target changes that have an explicit durable representation:

- current HP and Temp HP;
- Character resources;
- ItemInstance quantity and charge changes represented by the existing event resource bridge;
- `stable`, `unconscious`, and `dead` life flags.

Combatant-target changes are Scene/session state and are ignored by the local Character store. Economy, effects, concentration, spellcasting-turn markers, targeting/spatial facts, PendingResolution, and other session-only state remain outside the Character file even when they occur in the same ResolutionEvent batch.

A confirmed event-native resolution follows this order:

1. domain/application transaction computes the complete ResolutionEvents without mutating the committed Character;
2. the Character write-back projection filters local Character-durable changes and validates their event `before` values against the current durable Character projection;
3. all durable changes for that confirmed resolution are committed in one Character-library generation;
4. only after the durable commit succeeds does the adapter apply the corresponding Scene/runtime state and Activity/history projection.

If no local Character-durable state exists in the event batch, step 3 is a no-op; for example, enemy HP damage is not persisted merely because the local Character caused it.

Undo uses the same contract in reverse. The event-native inverse is first validated, then its Character-durable inverse is committed, and only then is the Scene/runtime inverse applied. A drift mismatch or storage failure rejects the operation rather than reporting unsaved Character state as committed.

Turn-runtime attacks add a revision precheck before Character persistence. If the runtime revision changes after Character persistence but before its compare-and-swap commit, the adapter attempts the exact inverse Character write-back as compensation and rejects the resolution. The same compensation rule is used for an Undo whose runtime compare-and-swap loses the race.

Maximum-HP ResolutionEvent write-back is deliberately rejected today. Maximum HP is source/progression-owned in the current Character model; silently placing it in the runtime projection would incorrectly increment both source and runtime revisions during level-up.

## 8. Write-back roadmap

The Character library, authoring-draft lifecycle, and current event-native Character runtime write-back are now established. Follow-up Phase 10 slices focus on:

1. existing Character source edit/revalidation and reduction of materialized-cache dependence;
2. real ContentCatalog/local-homebrew installation state;
3. additional durable state kinds only when their canonical source/runtime ownership is explicit.

Session-only state remains outside the permanent Character file unless a specific rule and write-back classification says otherwise.

## 9. Movement boundary

Persistence does not add battle-map state to Core. Coordinates, tokens, grids, paths, LOS and external map-module state remain outside the core Character library unless a future optional module defines and owns its own persistence contract.
