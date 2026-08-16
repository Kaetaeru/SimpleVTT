# Phase 10 Short-Term Checklist

Current phase: **Phase 10 — Persistence / Content Platform**

Owner progression acceptance remains separate: PR #60 stays Draft until owner Windows walkthrough verification.

## Step 1 — Local Character library persistence — CLOSED

Tracking issue: #81
Draft PR: #82
Branch: `agent/81-character-library-persistence`
Base checkpoint: `30bc190bc6f443ea70888762cf87ab313adc6892` (Phase 09 mandatory integration complete)
Verified implementation checkpoint: `78ebfa9cb0d6911b229e9c620538aa2306168dc7`

- [x] current persistence/storage inventory: no localStorage, no existing persistence service, Tauri shell had no storage commands
- [x] canonical Character lifetime/write-back documents re-read
- [x] versioned Character library contract separated from `AppSnapshot`
- [x] source/build revision separated from durable runtime revision
- [x] materialized CharacterSheet marked non-authoritative cache only
- [x] deterministic stale-writer / corrupt-newest recovery repository tests
- [x] unknown/newer schema version is an explicit migration blocker instead of corruption fallback
- [x] version-aware schema migration dispatcher entrypoint
- [x] Tauri immutable-generation store with fixed app-local-data path, temp flush, rename commit, stale-generation reject, and post-commit pruning
- [x] Tauri store ignores temp files and retains previous committed generations on stale/failure paths
- [x] adapter hydration installed after existing rule/progression adapters and before first UI snapshot
- [x] direct ItemInstance equip/attunement/use mutations write through Character library
- [x] direct rest-time spell configuration methods write through the same persistence transaction
- [x] Character creation finalize and level-up commit write through the same persistence transaction
- [x] storage failure restores in-memory Character/library state; failed creation save preserves the editable draft and projects a retryable persistence error
- [x] persistence status/durability exposed as non-rule AppSnapshot metadata; browser preview store is explicitly volatile
- [x] new Character creation commit → reload regression
- [x] Fighter 5→6 progression commit → source revision increment → reload regression
- [x] item runtime mutation → runtime revision increment → reload regression
- [x] schema/application persistence regressions green
- [x] full production build green
- [x] Windows Rust immutable-generation tests green
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31924337493` application-contract ✅
- Persistence workflow `31924337493` Windows `cargo test --lib` ✅
- UI workflow `31924318793` ✅
- UI named-rule / creation / progression / Phase 09 mechanics / TypeScript / production build ✅

Note: the current creation-edit command still shares the legacy materialized authoring path. Full source-graph edit/revalidation and eventual removal of materialized-cache dependence remain Phase 10 follow-up work; this slice does not claim canonical source reconstruction is complete.

## Step 2 — Authoring draft autosave / recovery — NEXT

- [ ] persist source intent for `CharacterCreationDraft` without derived/validation cache
- [ ] persist source intent for `ProgressionDraft` with base Character source revision
- [ ] reconstruct current application plans from recovered intent rather than trusting persisted previews
- [ ] creation draft meaningful-change autosave
- [ ] progression draft meaningful-change autosave
- [ ] clear committed/cancelled drafts only after corresponding durable Character commit succeeds
- [ ] stale progression draft vs changed Character source revision explicit blocker
- [ ] corrupt-newest / stale-writer / failed-autosave recovery
- [ ] Tauri durable draft store + browser explicit volatile store
- [ ] deterministic recovery regressions + production build + Windows Rust tests
- [ ] Draft PR checkpoint

## Follow-up Phase 10 slices

- [ ] ResolutionEvent `writeBack: character` durable write-back
- [ ] existing Character source edit/revalidation + materialized-cache reduction
- [ ] real ContentCatalog builtin/local/homebrew composition
- [ ] module dependency/version/capability/cycle/conflict validation
- [ ] local homebrew import → validation → review → activation
- [ ] ItemInstance/spellbook/resource/feature source reconstruction without materialized-cache dependence
- [ ] atomic save failure/recovery end-to-end Windows gate

## Non-negotiable boundaries

- Do not serialize `AppSnapshot` as the durable file.
- Do not persist Scene/PendingResolution/connection/initiative/session-only effects into Character library.
- Draft persistence stores user/source intent, not derived previews or validation results.
- Do not silently overwrite corrupt or newer generations.
- Do not call volatile browser memory/localStorage durable persistence.
- Core remains map/grid/token/path/LOS free.
- Do not design executable external 2D/3D module loading until a real requirement exists.
