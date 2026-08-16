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

## Step 2 — Authoring draft autosave / recovery — CLOSED

Tracking issue: #83
Draft PR: #84
Branch: `agent/83-authoring-draft-persistence`
Base checkpoint: `d19b64ffcc257f854bd3f069b3c78f71c83fb259`
Verified implementation checkpoint: `78b65fa8ef70017ba7220bb49b55c48341da285c`

- [x] separate versioned `simplevtt.authoring-drafts` document/store from committed Character library
- [x] persist source intent for `CharacterCreationDraft` without derived/validation/final-value cache
- [x] persist canonical input for `ProgressionDraft` with base Character source revision
- [x] reconstruct current creation/progression plans from recovered intent rather than trusting persisted previews
- [x] creation draft meaningful-change autosave
- [x] progression target/HP/ChoiceDefinition meaningful-change autosave
- [x] clear corresponding authoring draft only after durable Character commit succeeds
- [x] failed Character persistence retains autosaved draft for retry
- [x] failed draft autosave preserves in-memory editable intent and previous committed draft generation
- [x] stale progression/edit draft vs changed Character source revision is explicit and never silently replayed
- [x] new creation draft uses Character-library identity precondition so commit-success/draft-clear-failure cannot replay an already committed Character
- [x] corrupt-newest / stale-writer / newer-schema migration-blocker behavior
- [x] shared immutable-generation Rust primitive with separate Character / authoring namespaces
- [x] Tauri durable authoring-draft store + browser/test explicit volatile store
- [x] deterministic recovery and cross-store ordering regressions
- [x] production build and full UI regression green
- [x] Windows Rust immutable persistence-store tests green
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31927369690` application-contract ✅
- Persistence workflow `31927369690` Windows `cargo test --lib` ✅
- UI workflow `31927335894` ✅
- UI named-rule / creation / progression / Phase 09 mechanics / TypeScript / production build ✅

## Step 3 — ResolutionEvent Character durable write-back — CLOSED

Tracking issue: #85
Draft PR: #87
Branch: `agent/85-resolution-character-writeback`
Base checkpoint: `29354fdcb3b26e62acbbdf9aeb7cdca9c59f25bd`
Verified implementation checkpoint: `dd708c5c6f2af231a54200d00aba920bdd1023dc`

- [x] inventoried `writeBack: "character"`: HP current/maximum/temp, resource, life; economy/effect/concentration stay session-only
- [x] Character-target current HP / Temp HP / resource / ItemInstance quantity+charges / stable-unconscious-dead life flags persist
- [x] combatant-target and session-only changes are excluded from the local Character store
- [x] maximum-HP event write-back explicitly rejects until a source-model ownership contract exists
- [x] one Character-library transaction per confirmed event-native resolution with any local durable changes
- [x] Scene/runtime/history apply only after Character durable commit succeeds
- [x] event-native Undo persists the drift-safe inverse before applying Scene/runtime inverse
- [x] turn-runtime attacks precheck runtime revision and compensate Character write-back if a later CAS loses the race
- [x] storage failure leaves Character/Scene/resource/economy/history uncommitted
- [x] runtime revision increments only when Character durable runtime projection changes
- [x] deterministic Second Wind HP+resource write-back/reload/Undo regression
- [x] deterministic healing-potion HP+quantity write-back/reload/Undo regression
- [x] wand charge persists while combatant HP remains Scene/session-only
- [x] direct Character HP/Temp HP/life event write-back + inverse/reload regression
- [x] persistence failure no-apply regression
- [x] existing Fighter progression source/runtime revision semantics preserved
- [x] production build + full UI/Phase09 + Rules Domain + Windows persistence tests green
- [x] persistence design updated with write-back/Undo/failure/max-HP boundaries
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31928471561` application-contract + production build ✅
- Persistence workflow `31928471561` Windows `cargo test --lib` ✅
- UI workflow `31928471521` ✅
- Rules Domain workflow `31928471507` ✅
- UI named-rule / creation / progression / Phase 09 mechanics / TypeScript / production build ✅

## Step 4 — Canonical Character source edit/revalidation — CLOSED

Tracking issue: #86
Draft PR: #88
Branch: `agent/86-canonical-character-source-edit`
Base checkpoint: `a6a3e1c9fc7e24978090fe20c7a131c2dfc146a4`
Verified implementation checkpoint: `ac79e745829d2e5170c533f7617ab79f222747f7`

- [x] inventoried authoring source needed for exact Character Creation edit reopen: rules/identity/build, ability method/input + roll identity, skills/spells/class choices, equipment, ChoiceDefinition selections, notes and overrides
- [x] newly committed Characters persist explicit `creationAuthoring` source intent without derived preview/validation authority
- [x] explicit edit reopen applies committed source intent and reruns the current normalization / ChoiceDefinition / CharacterCreationPlan derivation
- [x] explicit reopen no longer falls back to materialized `creationSelections`/notes/build intent; committed source wins over a poisoned cache copy
- [x] upstream source edits continue through existing ChoiceDefinition normalization/invalidation instead of retaining persisted preview state
- [x] source-only edit increments `sourceRevision` exactly once and preserves `runtimeRevision` when the durable runtime projection is unchanged
- [x] source-only edit preserves current HP/Temp HP/life flags and matching Resource/ItemInstance mutable state by stable IDs
- [x] legacy records without complete authoring intent are marked `legacy-reconstructed` and show an explicit review warning rather than claiming canonical source
- [x] successful reviewed legacy edit commits explicit authoring source for subsequent reopen
- [x] Character library v1/schema extension is additive; old records remain readable
- [x] deterministic exact reopen/cache-authority/source-only revision+runtime/legacy reconstruction regressions
- [x] focused persistence application-contract and full production build green
- [x] full UI/Phase09 regression green on source-edit implementation head
- [x] Windows Rust immutable persistence-store tests green
- [x] persistence design updated with source-edit/reconstruction/materialized-cache boundaries
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31932522796` focused Character/source tests ✅
- Persistence workflow `31932522796` production build ✅
- Persistence workflow `31932522796` Windows `cargo test --lib` ✅
- UI workflow `31932503877` ✅

Caveat: materialized-cache dependence still exists for other legacy/non-creation source projections. ItemInstance/spellbook/resource/feature source reconstruction remains a later Phase 10 slice; Step 4 closes the Character Creation edit/revalidation path only.

## Step 5 — Installed ContentCatalog composition and local persistence — CLOSED

Tracking issue: #89
Draft PR: #90
Branch: `agent/89-content-catalog-composition`
Base checkpoint: `3f18c17a4d04d68082b851840edfe12a0c6961bb`
Verified implementation checkpoint: `d17c260e55d01f4afbdd638573c747dbf0966b3c`
Documentation checkpoint: `ac055ff8d529d97010f8b84c02dbeb252d8686bb`

- [x] inventoried current builtin catalog, generic import preview/activation, scope/source/version fields, Catalog UI identity consumption, session-content separation, and generated builtin content inputs
- [x] versioned `simplevtt.installed-content` document/store separated from import preview, session content, builtin product content, and AppSnapshot
- [x] portable `contentId` kept separate from stable package/source `sourceId` and display `source`
- [x] deterministic qualified resolved identity `(contentId, sourceId, version)` projected as `CatalogEntry.id` for collision-safe UI keys/selection
- [x] builtin SRD seed entries resolve under stable source identity `dnd.srd-5.2.1` without duplicating builtin/generated catalogs into the local document
- [x] builtin + activated local/homebrew entries compose deterministically; session content remains separate
- [x] exact qualified identity + identical payload is idempotent with no new generation
- [x] exact qualified identity + different payload is an explicit conflict; same portable ID from different source/version identities coexists
- [x] local content claiming a builtin qualified identity rejects before persistence
- [x] generic local import requires stable `sourceId` separate from display source label
- [x] activation persists before replacing the composed catalog; storage failure/conflict keeps reviewed preview + previous catalog authoritative
- [x] corrupt-newest recovery / stale-writer reject / newer-schema migration-blocker behavior
- [x] shared immutable-generation Rust primitive in separate `installed-content` namespace; browser/test store explicitly volatile
- [x] installed document excludes ContentImportPreview and session-only content
- [x] deterministic repository/runtime reload/coexistence/idempotency/conflict/builtin-collision/sourceId/failure/session-exclusion regressions
- [x] focused Character/content persistence application-contract and production build green
- [x] full UI/creation/progression/Phase09/typecheck/build regression green
- [x] Windows Rust immutable persistence-store tests green
- [x] installed ContentCatalog design document
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31933513283` Character/content persistence tests ✅
- Persistence workflow `31933513283` production build ✅
- Persistence workflow `31933513283` Windows `cargo test --lib` ✅
- UI workflow `31933513284` ✅

Caveat: this step composes the application's current builtin Catalog view with durable local entries. It does not claim that every generated SRD catalog has already been normalized into one universal generic Catalog feed, and it deliberately does not implement dependency/range/cycle/replacement graph semantics.

## Step 6 — Module dependency/version/capability/conflict validation — NEXT

- [ ] inventory existing module manifests, content relationships, RulesProfile compatibility metadata, capability checks, and current unsupported-content behavior
- [ ] define declarative installed source/module manifest identity without introducing executable module loading
- [ ] validate required dependencies and compatible version ranges before activation
- [ ] validate required capabilities / RulesProfile compatibility explicitly
- [ ] validate relationship target existence/category compatibility and dependency ownership
- [ ] detect dependency/relationship cycles deterministically
- [ ] validate explicit `replaces` / `extends` semantics and competing replacement conflicts; never use load order as resolution policy
- [ ] preserve disabled/inspection-only status with actionable validation errors where safe instead of silently deleting content
- [ ] deterministic dependency/version/capability/cycle/replacement/conflict regressions
- [ ] production build + full UI + Windows persistence gates
- [ ] Draft PR checkpoint

## Follow-up Phase 10 slices

- [ ] local homebrew import → full manifest validation → review → activation UX
- [ ] normalize generated builtin catalogs into the generic catalog feed where required by real consumers
- [ ] ItemInstance/spellbook/resource/feature source reconstruction without materialized-cache dependence
- [ ] atomic save failure/recovery end-to-end Windows gate

## Non-negotiable boundaries

- Do not serialize `AppSnapshot` as the durable file.
- Do not persist Scene/PendingResolution/connection/initiative/session-only effects into Character library.
- Draft persistence stores user/source intent, not derived previews or validation results.
- Confirmed ResolutionEvents write back only explicitly Character-durable state; session-only state stays session-only.
- Maximum HP stays source/progression-owned until an explicit source-model write-back contract exists.
- Installed local content persists normalized declarative content, never import preview/session state or executable code.
- Load order is never conflict resolution; qualified source/version identity remains explicit.
- Do not silently overwrite corrupt or newer generations.
- Do not call volatile browser memory/localStorage durable persistence.
- Core remains map/grid/token/path/LOS free.
- Do not design executable external 2D/3D module loading until a real requirement exists.
