# Installed ContentCatalog Persistence

This document defines the Phase 10 installed-content boundary for the generic `ContentCatalog`. It refines `content-modules-items.md` without introducing executable module loading.

## 1. Portable content identity vs resolved catalog identity

A portable content entry keeps its stable `contentId`. A source/package also has a stable `sourceId`, separate from its human-readable `source` label, and a `version`.

The resolved catalog identity is the tuple:

```text
(contentId, sourceId, version)
```

The current application projects that tuple into a deterministic qualified `CatalogEntry.id` for UI keys and selection:

```text
content:<sourceId>@<version>#<contentId>
```

Components are escaped before construction. The portable `contentId` is retained separately and is the identity used by portable content relationships. Display names and display source labels are never identity.

This allows two entries with the same portable content ID to coexist when their source/version identities differ.

## 2. Catalog composition

The resolved `ContentCatalog` is composed deterministically from:

1. product/builtin entries supplied by the current application/profile;
2. activated local/homebrew entries loaded from the installed-content store.

Session content is mounted separately and is not part of the permanent local installation document.

Builtin content is not copied into the user's installed-content file. Existing builtin SRD presentation entries are assigned the stable builtin source identity `dnd.srd-5.2.1` when resolved.

Composition sorts by qualified identity for deterministic presentation and rejects duplicate qualified identities. Load order is not a conflict-resolution policy.

## 3. Durable installed-content document

Activated local/homebrew content is stored in a separate versioned document:

```text
schemaId: simplevtt.installed-content
schemaVersion: 1
storageRevision: N
entries: [...local installed entries...]
```

Only normalized installed local entries belong in this document. It does not contain:

- builtin generated/product catalogs;
- `ContentImportPreview` payload/review state;
- session content or session mount state;
- `AppSnapshot`;
- executable code.

Desktop storage reuses the immutable-generation protocol in its own `installed-content` namespace. Browser/test storage is explicitly volatile.

## 4. Import preview and activation transaction

Generic import review remains transient. Preview performs the existing structural/capability checks and additionally requires a stable `sourceId` distinct from the display `source` label.

Activation order is:

1. normalize the reviewed preview into an installed entry;
2. reject any local entry that claims an existing builtin qualified identity;
3. validate exact local qualified-identity conflict policy;
4. commit the new installed-content generation;
5. only after persistence succeeds, recompute the resolved ContentCatalog;
6. clear the import preview.

If storage fails, the previous installed generation and composed catalog remain authoritative and the reviewed preview stays available for retry.

## 5. Minimal conflict policy

This Phase 10 slice intentionally defines only the conflict semantics needed for durable composition:

- same qualified identity + identical normalized payload: idempotent no-op;
- same qualified identity + different normalized payload: explicit conflict/rejection;
- same portable `contentId` + different `sourceId` and/or `version`: coexist;
- local entry claiming a builtin qualified identity: reject before persistence.

Dependency ranges, replacement/extension selection, capability graphs, cycles, competing replacements, and profile compatibility beyond existing preview checks belong to the next validation slice. They must not be approximated by load order.

## 6. Recovery and concurrency

The store follows the same durability guarantees as other Phase 10 stores:

- immutable committed generations;
- stale writers cannot overwrite a newer physical generation;
- a corrupt newest generation may recover from the previous valid generation;
- a newer unsupported schema is a migration blocker rather than corruption fallback;
- failed writes leave the previous generation authoritative.

The next successful commit after corrupt-newest recovery advances beyond the highest physical generation.

## 7. Scope and ownership

`builtin`, `local`, and `session` describe mounted/installed scope, not portable content identity.

- `builtin`: product/profile-owned input to composition;
- `local`: user-owned durable installation recorded in the installed-content document;
- `session`: temporary host/session content, never silently promoted to local durable state.

This persistence boundary does not change rule ownership and does not add map/grid/token/path/LOS state to Core.
