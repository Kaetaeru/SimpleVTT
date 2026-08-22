# SimpleVTT V1 Foundation Audit

Status: IN PROGRESS
Audit base: `work/v1-composite` at `1c4e7056b95b21f614bd22d508bfddb8a29152cc`
Date: 2026-08-22

## Verified gates

- Content generation completed: 339 spells, 12 classes / 240 progression rows, 17 feats, 38 weapons, 12 classes / 18 skills, 495 builtin catalog entries.
- `tsc --noEmit` passed.
- UI named-rule boundary passed: 3 tests, no new finding beyond the 6 frozen findings.
- Domain tests passed: 334 tests across 68 files.
- UI tests passed in explicit batches after synchronizing five stale structure assertions with the integrated source: 595 tests across 148 TypeScript test files.
- Focused Session/Inventory/Dice suite passed: 40 tests.
- Vite production build passed: 410 modules transformed.

The repository-local test bootstrap is required because the bundled Node runtime throws `uv_os_get_passwd returned ENOMEM` when `tsx` asks Windows for `os.userInfo()`. Tests were therefore invoked with `node -r ./tests/tsx-os-userinfo-bootstrap.cjs --import tsx --test ...`.

## Durable stores and protocol ownership

No second durable implementation was found for the three current persisted aggregates.

| Aggregate | TypeScript owner | Platform owner |
| --- | --- | --- |
| Character Library | `CharacterLibraryRepository` | shared Rust `generation_store` through `character_library` |
| Authoring Drafts | `AuthoringDraftRepository` | shared Rust `generation_store` through `authoring_drafts` |
| Installed Content | `InstalledContentRepository` | shared Rust `generation_store` through `installed_content` |

Connected ordering is owned by one `HostSessionLedger` in `connectedSessionProtocol.ts`. Runtime turn state is separately scoped to `turnRuntimeSessionRegistry.ts`; this is transient Session authority, not a duplicate durable store.

## Production fixture and authority findings

### FND-01 — production is still rooted in `MockAdapter`

`AppProvider.tsx` imports the singleton `mockAdapter`, and `main.tsx` installs a long ordered chain of prototype overlays through `offlineRuntimeAdapters.ts` and connected adapters. Production therefore starts with fixture Characters, Scene, catalog, activity, and debug fields before outer adapters replace or persist parts of that state.

Impact: adapter import order is an implicit composition contract, and fixture state can survive whenever an outer production projection does not explicitly replace it.

### FND-02 — acceptance fixture changes production spatial legality

`offlineRuntimeAdapters.ts` imports `productionAcceptanceRuntimeAdapter.ts` outermost. That adapter recognizes `scene.ruined-gate`, changes the reference wolf distance, and removes eligible targets when `runtimeSpatialRelation` cannot provide a spatial fact.

Impact: this directly conflicts with the V1 mapless invariant that a missing spatial provider must not mean out-of-range. Removal belongs to V1-41, but the production path is now explicitly identified.

### FND-03 — debug authority is compiled into the product shell

`App.tsx` mounts a shortcut-opened Debug Panel, and `AppProvider.tsx` exposes commands for role, mode, current actor, queued d20, connection state, edge state, and reference scenarios. The browser Session preview is development-gated in `ProductRoot.tsx`, but the global Debug Panel itself is not guarded by `import.meta.env.DEV`.

Impact: release builds retain direct fixture/authority mutation controls even when hidden from normal navigation.

### FND-04 — event and runtime behavior is composed by prototype mutation

Dozens of modules wrap `MockAdapter.prototype` methods. The current tests prove the checked-in import order, but there is no declarative composition manifest preventing a new import from reordering an authority layer.

Impact: not an identified duplicate ledger today, but a high-risk boundary for Campaign and connected write-back work. New V1 work must not add a second store, resolver, protocol, or event ledger through another overlay.

## Rust/Tauri blocker

`cargo` and `rustc` are not installed or bundled in the current environment. Rust generation-store and transport tests exist in `src-tauri/src`, but `cargo test --manifest-path src-tauri/Cargo.toml` and `npm run tauri:build` cannot be executed here yet.

V1-01 remains PARTIAL until a Rust toolchain is available and those tests pass. No global tool installation was attempted.

## Required closeout

1. Install or provide a Rust toolchain with `cargo` and `rustc` on PATH.
2. Run the Rust/Tauri test suite.
3. Run the exact package build command in an environment with a working npm/tsx launcher, or make the repository test command robust to the bundled Node `os.userInfo()` failure.
4. Gate or remove FND-02 and FND-03 before release; FND-02 is also the primary input to V1-41.
