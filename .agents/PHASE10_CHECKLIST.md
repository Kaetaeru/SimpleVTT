# Phase 10 Short-Term Checklist

Current phase: **Phase 10 — Persistence / Content Platform**

Tracking issue: #81
Branch: `agent/81-character-library-persistence`
Base checkpoint: `30bc190bc6f443ea70888762cf87ab313adc6892` (Phase 09 mandatory integration complete)

Owner progression acceptance remains separate: PR #60 stays Draft until owner Windows walkthrough verification.

## Step 1 — Local Character library persistence — IN PROGRESS

- [x] current persistence/storage inventory: no localStorage, no existing persistence service, Tauri shell has no storage commands
- [x] canonical Character lifetime/write-back documents re-read
- [x] versioned Character library contract separated from `AppSnapshot`
- [x] source/build revision separated from durable runtime revision
- [x] materialized CharacterSheet marked non-authoritative cache only
- [x] deterministic stale-writer / corrupt-newest recovery repository tests added
- [ ] Tauri immutable-generation store
- [ ] adapter hydration before first snapshot
- [ ] Character create/edit/progression direct commit persistence
- [ ] durable item/rest direct mutation persistence
- [ ] storage failure rollback preserves prior committed Character + editable draft where applicable
- [ ] schema contract validation / migration entrypoint
- [ ] frontend + Rust CI green
- [ ] Draft PR checkpoint

## Follow-up Phase 10 slices

- [ ] creation/progression draft autosave + recovery
- [ ] ResolutionEvent `writeBack: character` durable write-back
- [ ] real ContentCatalog builtin/local/homebrew composition
- [ ] module dependency/version/capability/cycle/conflict validation
- [ ] local homebrew import → validation → review → activation
- [ ] ItemInstance/spellbook/resource/feature source reconstruction without materialized-cache dependence
- [ ] atomic save failure/recovery end-to-end Windows gate

## Non-negotiable boundaries

- Do not serialize `AppSnapshot` as the durable file.
- Do not persist Scene/PendingResolution/connection/initiative/session-only effects into Character library.
- Do not silently overwrite corrupt or newer generations.
- Do not call volatile browser memory/localStorage durable persistence.
- Core remains map/grid/token/path/LOS free.
- Do not design executable external 2D/3D module loading until a real requirement exists.
