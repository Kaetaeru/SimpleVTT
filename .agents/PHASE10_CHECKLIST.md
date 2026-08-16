# Phase 10 Short-Term Checklist

Current phase: **Phase 10 — Persistence / Content Platform**

Owner progression acceptance remains separate: PR #60 stays Draft until owner Windows walkthrough verification.

## Step 1 — Local Character library persistence — CLOSED

Tracking issue: #81
Draft PR: #82
Branch: `agent/81-character-library-persistence`
Base checkpoint: `30bc190bc6f443ea70888762cf87ab313adc6892` (Phase 09 mandatory integration complete)
Verified implementation checkpoint: `78ebfa9cb0d6911b229e9c620538aa2306168dc7`

- [x] versioned Character library contract separated from `AppSnapshot`
- [x] source/build revision separated from durable runtime revision
- [x] immutable-generation local store, stale-writer reject and corrupt-newest recovery
- [x] adapter hydration/write-through for Character creation, progression and direct durable mutations
- [x] storage failure rollback and explicit volatile browser/test store
- [x] deterministic creation/progression/item reload regressions
- [x] production build, full UI and Windows Rust gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31924337493` application-contract ✅
- Persistence workflow `31924337493` Windows `cargo test --lib` ✅
- UI workflow `31924318793` ✅

## Step 2 — Authoring draft autosave / recovery — CLOSED

Tracking issue: #83
Draft PR: #84
Branch: `agent/83-authoring-draft-persistence`
Base checkpoint: `d19b64ffcc257f854bd3f069b3c78f71c83fb259`
Verified implementation checkpoint: `78b65fa8ef70017ba7220bb49b55c48341da285c`

- [x] separate versioned `simplevtt.authoring-drafts` store
- [x] persist source intent/canonical progression input, never derived previews
- [x] autosave/recovery with stale source revision and new-creation identity preconditions
- [x] Character commit before draft clear; failed persistence keeps draft retryable
- [x] shared immutable-generation Rust primitive with separate namespaces
- [x] deterministic recovery/cross-store ordering regressions
- [x] production build, full UI and Windows Rust gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31927369690` application-contract ✅
- Persistence workflow `31927369690` Windows `cargo test --lib` ✅
- UI workflow `31927335894` ✅

## Step 3 — ResolutionEvent Character durable write-back — CLOSED

Tracking issue: #85
Draft PR: #87
Branch: `agent/85-resolution-character-writeback`
Base checkpoint: `29354fdcb3b26e62acbbdf9aeb7cdca9c59f25bd`
Verified implementation checkpoint: `dd708c5c6f2af231a54200d00aba920bdd1023dc`

- [x] current HP / Temp HP / resource / ItemInstance quantity+charges / stable-unconscious-dead life flags persist
- [x] combatant-target and session-only changes excluded
- [x] maximum-HP write-back explicitly unsupported until source ownership is modeled
- [x] one durable transaction per confirmed event-native resolution; Scene/runtime apply afterward
- [x] drift-safe event-native Undo and runtime-CAS compensation
- [x] deterministic Second Wind / potion / wand / HP-life / storage-failure regressions
- [x] existing progression source/runtime revision semantics preserved
- [x] production build, full UI/Phase09, Rules Domain and Windows Rust gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31928471561` application-contract + production build ✅
- Persistence workflow `31928471561` Windows `cargo test --lib` ✅
- UI workflow `31928471521` ✅
- Rules Domain workflow `31928471507` ✅

## Step 4 — Canonical Character source edit/revalidation — CLOSED

Tracking issue: #86
Draft PR: #88
Branch: `agent/86-canonical-character-source-edit`
Base checkpoint: `a6a3e1c9fc7e24978090fe20c7a131c2dfc146a4`
Verified implementation checkpoint: `ac79e745829d2e5170c533f7617ab79f222747f7`

- [x] explicit creation-authoring source intent persisted for newly committed Characters
- [x] edit reopen from committed source and current ChoiceDefinition/plan derivation
- [x] committed source wins over compatibility/materialized cache copies
- [x] source-only edit increments source revision without resetting unchanged durable runtime
- [x] legacy records explicitly marked `legacy-reconstructed`
- [x] additive v1 source contract and deterministic reopen/cache-authority/revision regressions
- [x] production build, full UI and Windows Rust gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31932522796` focused Character/source tests + production build ✅
- Persistence workflow `31932522796` Windows `cargo test --lib` ✅
- UI workflow `31932503877` ✅

Caveat: materialized-cache dependence still exists for other legacy/non-creation source projections.

## Step 5 — Installed ContentCatalog composition and local persistence — CLOSED

Tracking issue: #89
Draft PR: #90
Branch: `agent/89-content-catalog-composition`
Base checkpoint: `3f18c17a4d04d68082b851840edfe12a0c6961bb`
Verified implementation checkpoint: `d17c260e55d01f4afbdd638573c747dbf0966b3c`
Final branch checkpoint: `52bd63690ca5a79b20b4ff720cd19b135cbd596d`

- [x] versioned `simplevtt.installed-content` store separate from preview/session/builtin state
- [x] portable `contentId`, stable `sourceId`, display `source`, and version kept distinct
- [x] deterministic qualified resolved identity `(contentId, sourceId, version)`
- [x] builtin SRD reference identity without duplicating builtin catalogs into local storage
- [x] deterministic builtin + activated local composition; session remains separate
- [x] exact identity idempotency/conflict rules and same contentId multi-source coexistence
- [x] builtin-identity collision rejects before persistence
- [x] activation persists before catalog replacement; failure keeps preview and prior catalog
- [x] corrupt-newest / stale-writer / newer-schema recovery semantics
- [x] deterministic reload/coexistence/conflict/failure/session-exclusion regressions
- [x] production build, full UI and Windows Rust gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31933719623` application-contract + production build + Windows `cargo test --lib` ✅
- UI workflow `31933513284` ✅

Caveat: this step composes the current generic Catalog view; it does not normalize every generated SRD catalog into one universal feed.

## Step 6 — Declarative module dependency/version/capability/conflict validation — CLOSED

Tracking issue: #91
Draft PR: #92
Branch: `agent/91-module-validation`
Base checkpoint: `52bd63690ca5a79b20b4ff720cd19b135cbd596d`
Verified implementation checkpoint: `dbcdbaf2ba89c179e2c7708ccdf4ba8c02b0a299`

- [x] inventoried and reused `rule-module.schema.json`, `content-entry.schema.json`, `rules-profile.schema.json` and canonical RulesProfile JSON
- [x] additive declarative module metadata persisted with installed local entries; no executable loader
- [x] exact module dependency version validation matching current schema semantics
- [x] RulesProfile identity/version, allowed category and required capability validation
- [x] candidate and reverse module conflict validation
- [x] deterministic module dependency cycle detection
- [x] `parent` / `extends` / `replaces` relationship validation with targetVersion and extensionPoint semantics
- [x] missing/ambiguous target, extension-point/category and relationship-cycle blockers
- [x] competing replacement conflict; load order never used as resolution policy
- [x] builtin Catalog entries available as read-only relationship references without local persistence duplication
- [x] invalid reviewed manifest blocks before durable installed-content write and remains inspectable in preview
- [x] legacy flat Step 5 entries remain compatible via neutral synthetic manifests
- [x] installed-content schema describes optional declarative validation metadata
- [x] deterministic pure-validator + runtime activation regressions
- [x] full production build, UI and Windows Rust persistence gates
- [x] Contract validation gate
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31934502027` focused Character/content/module tests ✅
- Persistence workflow `31934502027` production build ✅
- Persistence workflow `31934502027` Windows `cargo test --lib` ✅
- UI workflow `31934502082` ✅
- Contract validation workflow `31934502112` ✅

Note: dependency versions are exact strings because the current RuleModule contract has exact `{moduleId, version}` references. Semver/range syntax requires explicit schema evolution and is not invented here.

## Step 7 — Local homebrew package import / review / activation UX — CLOSED

Tracking issue: #93
Draft PR: #94
Branch: `agent/93-rule-module-package-import`
Base checkpoint: `5c8c768b74967a6f4ad6333834e8c5a38ccf9e4c`
Verified implementation checkpoint: `44c81d1c547e49d3e583394c6251e5835cf19679`

- [x] inventoried the existing Catalog JSON textarea/review UI and kept this slice inside the existing in-app JSON flow without a new desktop file-picker dependency
- [x] accept a complete declarative RuleModule package shape using existing RuleModule/ContentEntry semantics while preserving legacy flat single-entry imports
- [x] keep import package/review transient; preview performs no durable installed-content write before activation
- [x] validate the package manifest and every contained entry as one candidate set using Step 6 profile/dependency/conflict/capability/category/relationship semantics
- [x] show package/module/source/profile/dependency/conflict/capability summary and per-entry validation through the existing review UX
- [x] activate the reviewed package atomically with `installMany`; one installed-content generation commits or none do
- [x] reject duplicate and changed pre-existing qualified identities explicitly before deeper module validation and before persistence
- [x] preserve the reviewed package on validation or storage failure for correction/retry
- [x] deterministic multi-entry success / invalid member / unsupported mechanics / duplicate-or-existing identity / storage failure / reload regressions
- [x] production build + full UI + Windows persistence gates
- [x] Contract validation gate
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31935767524` application-contract + production build ✅
- Persistence workflow `31935767524` Windows `cargo test --lib` ✅
- UI workflow `31935767558` ✅
- Contract validation workflow `31935874240` ✅

Note: this slice deliberately remains textarea/package-JSON only. It does not add executable module loading, arbitrary code execution, or a new Tauri file-dialog dependency.

## Follow-up A — Canonical SRD builtin generic catalog feed — CLOSED

Tracking issue: #95
Draft PR: #96
Branch: `agent/95-canonical-builtin-catalog`
Base checkpoint: `1acbe92c9a40af55e78dab926a0d82773fafe273`
Verified implementation checkpoint: `a6440f8cc925099d42a0bd2f80edfefe5b7fcd19`

- [x] deterministic build-time builtin Catalog generation added to `generate:content`; no runtime filesystem/network discovery
- [x] non-spell generic entries sourced from canonical SRD 5.2.1 RuleModules with canonical `contentId` and product source identity
- [x] complete spell feed sourced from the pinned 339-spell presentation catalog; RuleModule spell records remain mechanics backing rather than enumeration authority
- [x] pinned spell payload byte count / SHA-256 / decompressed size / RulesProfile / 339-entry integrity validated during generation
- [x] canonical `dnd.srd521.item.*` weapon/armor/ammunition/focus/tool/etc. entries projected into the existing generic `item` presentation category without rewriting identity
- [x] generated feed breadth locked to 495 entries: 12 classes / 9 species / 4 backgrounds / 17 feats / 339 spells / 114 item-like entries
- [x] `installedContentRuntimeAdapter` uses the generated feed directly as the authoritative builtin side of Phase 10 composition
- [x] builtin product content remains read-only and is never serialized into `simplevtt.installed-content`; local content still layers on top and reloads independently
- [x] builtin qualified-identity collision is surfaced explicitly before deeper module validation
- [x] legacy Step 6 builtin relationship fixture migrated to canonical Fighter `dnd.srd521.class.fighter`; validator semantics remain strict
- [x] deterministic breadth/identity/item projection/spell presentation/local reload/idempotency/conflict/storage-failure/session-exclusion regressions
- [x] production build, full UI, Rules Domain, Contract validation and Windows Rust persistence gates
- [x] Draft PR checkpoint

Verification:
- Persistence workflow `31936795709` 69/69 application-contract + production build ✅
- Persistence workflow `31936795709` Windows `cargo test --lib` ✅
- UI workflow `31936795705` ✅
- Rules Domain workflow `31936796051` ✅
- Contract validation workflow `31936795707` ✅

Note: this slice normalizes only categories with a canonical repository source and a real generic Catalog consumer. It does not fabricate subclass/monster/category data solely for presentation completeness.

## Follow-up Phase 10 slices

- [x] normalize generated builtin catalogs into the generic catalog feed where required by real consumers
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
