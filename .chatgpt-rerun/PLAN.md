# Rerun Plan — SimpleVTT Phase 13 Closeout

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Branch/ref: `main`
- Tracking issue: #104 — Phase 13 arbitrary player Character SessionProjection reconstruction
- Historical stacked Draft PR: #107 — `phase13: reconstruct arbitrary Character SessionProjection`
- Phase 12 base checkpoint: `a2b1b9cbab0f5aad9eb264d76f4098a58ca1b7c5`
- Implementation checkpoint immediately before Rerun bootstrap: `7c9440970753a370fec7830cfa691832552e1d05`
- Main promotion checkpoint before Rerun branch-coordinate reconciliation: `807670b8fb5b58d9d6fc5e13223df765b645eb1e`

## Actual project goal

Complete Phase 13 so a player can join a connected session with an arbitrary locally authored Character unknown to the DM host while preserving local Character ownership and DM-host authoritative shared-session resolution.

The host must reconstruct only an **ephemeral SessionProjection** from declarative Character source/runtime data plus exact content identities that the host can validate against its own canonical rules/content. It must not create a second permanent host Character file, trust client presentation mechanics, or accept executable content over the network.

The current conversation also established a product-quality constraint that must remain green through closeout: **character creation and level-up must use the same UI language and shared interaction primitives**, including rich spell/subclass presentation and the shared visual-dice renderer for creation, level-up HP rolls, and authoritative play resolution.

`main` is now the canonical development baseline. The prior Phase 13 stacked branch was cleanly fast-forwarded into `main` with no divergence; future branches, if any, must start from the then-current `main` unless the user explicitly chooses otherwise.

## Task 0

**task_id:** `phase13-closeout-ui-dice-regression`

### Intent

Reconcile the current Phase 13 implementation/checklist/CI state at the exact `main` head, prove the recent character-creation/level-up UI and shared-dice changes did not regress Phase 11/12/13 behavior, and close the Phase 13 handoff records if and only if all acceptance gates are supported by current evidence.

PR #107 is now historical stacked context, not the development base. Do not attempt to merge it again merely to reproduce the already-promoted code.

### Dependencies

1. Issue #104 and `.agents/PHASE13_CHECKLIST.md` remain the Phase 13 scope contract.
2. `docs/design/session-runtime.md` and any Phase 13 SessionProjection design document remain authoritative for session ownership/authority boundaries.
3. Existing canonical content/rules catalogs remain the source of mechanics; presentation fields are never authority.
4. `main` is the canonical baseline; the Phase 12 and stacked Phase 13 branches are historical ancestry, not the next-work base.
5. Current `main` GitHub Actions and Windows artifact capability must be available where workflows apply.
6. Recent UI/dice implementation must preserve the shared `OptionCard`/`SectionShell`/`SpellTile`/visual-dice primitives rather than fork another level-up-only presentation stack.

### Acceptance criteria

- Phase 13 projection contract is versioned and excludes `materializedCache.sheet`, executable content, and client-presented authoritative ActionVm/stat values.
- Host validates exact rules/content identities and reconstructs host-trusted mechanics; unsupported or incompatible mechanics reject explicitly.
- Host-unknown Character mounts ephemerally into the connected session without creating a permanent host Character-library record.
- Projected ActionRequest flows through existing host-authoritative staged resolution and committed `ResolutionEvent[]` replication.
- Character-durable host-confirmed mutations write back only to the owning client, with duplicate delivery and reconnect remaining idempotent.
- Reconnect does not overwrite host-authoritative runtime with stale client projection state; new host session clears prior ephemeral projections safely.
- Character creation and level-up remain visually/interaction consistent: focused header/stage/preview/footer flow, one active progression stage, shared option cards, shared spell tiles/search/filter/hover details, rich subclass presentation, and usable stage scrolling.
- Shared visual dice are present for creation ability rolls, level-up HP hit-die rolls, and authoritative combat/check/save/damage/healing replay without changing authoritative results.
- Current exact-head UI/typecheck/production build gates are green.
- Current exact-head Phase 11 offline walkthrough remains green.
- Current exact-head Phase 12 connected-authority regression suite remains green.
- Current exact-head Phase 13 projection/reconstruction/mount/hello/action/durable-convergence gates remain green.
- Windows Tauri transport/persistence tests and a retrievable exact-head Windows Phase 13 release artifact are green or are explicitly reconciled to the last implementation head when only coordination-doc commits followed.
- `.agents/PHASE13_CHECKLIST.md`, issue #104, and historical Draft PR #107 handoff text are reconciled to actual evidence; no unchecked item is marked complete without evidence.
- Future development work uses `main` as its base.

### Verification method

1. Fetch current `main` head and compare it with any historical stacked branch before making ancestry claims.
2. Read `.agents/PHASE13_CHECKLIST.md` plus current Phase 13/session design contracts.
3. Inspect relevant GitHub Actions runs for UI, Phase 11, Phase 12, Phase 13, Persistence/Rules/Contract gates, distinguishing implementation heads from documentation-only reconciliation commits.
4. Validate Windows artifact metadata and `BUILD.txt` source SHA for the implementation head that produced the artifact.
5. Inspect the recent level-up/creation/dice source and structure tests if CI evidence is stale or a `main` change touched those paths.
6. Only after evidence is current, update Phase 13 tracking/checklist/handoff docs. Treat #107 as historical stacked context rather than a future integration target.

## Later work

No Phase 14 or unrelated feature work is authorized by this run yet. After Task 0 reaches `complete`, wait for the controller/user to set the next task or return control to `continue` with a new authorized objective. Any subsequent implementation must begin from current `main`.