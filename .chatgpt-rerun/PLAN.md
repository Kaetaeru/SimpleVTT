# Rerun Plan — SimpleVTT Phase 13 Closeout

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Branch/ref: `main`
- Tracking issue: #104 — Phase 13 arbitrary player Character SessionProjection reconstruction — **completed**
- Historical stacked Draft PR: #107 — `phase13: reconstruct arbitrary Character SessionProjection` — **closed without merge after main promotion**
- Phase 12 base checkpoint: `a2b1b9cbab0f5aad9eb264d76f4098a58ca1b7c5`
- Verified source-changing implementation checkpoint: `7c9440970753a370fec7830cfa691832552e1d05`
- Main promotion checkpoint before Rerun branch-coordinate reconciliation: `807670b8fb5b58d9d6fc5e13223df765b645eb1e`

## Actual project goal

Complete Phase 13 so a player can join a connected session with an arbitrary locally authored Character unknown to the DM host while preserving local Character ownership and DM-host authoritative shared-session resolution.

The host reconstructs only an **ephemeral SessionProjection** from declarative Character source/runtime data plus exact content identities validated against host-trusted canonical rules/content. It does not create a second permanent host Character file, trust client presentation mechanics, or accept executable content over the network.

The conversation also established a product-quality constraint preserved through closeout: **character creation and level-up use the same UI language and shared interaction primitives**, including rich spell/subclass presentation and the shared visual-dice renderer for creation, level-up HP rolls, and authoritative play resolution.

`main` is the canonical development baseline. Future branches, if any, must start from the then-current `main` unless the user explicitly chooses otherwise.

## Task 0

**task_id:** `phase13-closeout-ui-dice-regression`

**status:** **COMPLETE**

### Intent

Reconcile the Phase 13 implementation/checklist/CI state, prove the recent character-creation/level-up UI and shared-dice changes did not regress Phase 11/12/13 behavior, and close the Phase 13 handoff records only where supported by evidence.

### Acceptance result

All Task 0 acceptance criteria are satisfied:

- `CharacterSessionProjectionV1` is versioned and declarative; copied materialized sheet authority, executable content, and client-presented derived mechanics are excluded.
- Host validates exact canonical identities and reconstructs trusted mechanics; unsupported/incompatible mechanics reject explicitly.
- Host-unknown Characters mount ephemerally and do not create permanent host library records.
- Connected projected actions use the host-authoritative staged resolution and committed `ResolutionEvent[]` path.
- Character-durable state writes back only to the owning client; duplicate/reconnect handling remains idempotent.
- Reconnect preserves host-authoritative runtime rather than replacing it with stale client runtime; new host session clears prior ephemeral projections.
- Character creation and level-up share the focused flow, option/spell presentation primitives, rich hover/detail behavior, stage scrolling, and common visual-dice presentation.
- Visual dice cover creation ability rolls, level-up hit-die HP rolls, and authoritative play replay without generating or changing authoritative outcomes.
- Exact implementation-head Contract, Rules, Persistence, UI, Phase 11, Phase 12, and Phase 13 workflows are green.
- Windows Tauri transport/persistence tests and the exact implementation-head Phase 13 Windows artifact are green/retrievable.
- `.agents/PHASE13_CHECKLIST.md` is evidence-based CLOSED on `main`.
- Issue #104 is closed as completed.
- Historical Draft PR #107 is closed without merge because the implementation was already promoted to `main` through the user's explicit clean fast-forward.
- Future development uses `main` as its base.

### Verification record

Verified source-changing implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.

Workflow evidence at that exact head:

- Contract validation — `31955742556` — success
- Rules Domain — `31955742577` — success
- Persistence — `31955742563` — success
- UI — `31955742530` — success; includes UI named-rule boundary, creation ChoiceDefinition convergence, progression/subclass/spellcasting regressions, TypeScript, and production build
- Phase 11 Playable — `31955742560` — success; includes production-composed offline walkthrough and Windows playable build
- Phase 12 Connected Session — `31955742539` — success; includes connected authority protocol, Phase 11 regression, Tauri transport/persistence tests, and Windows connected build
- Phase 13 SessionProjection — `31955742524` — success; includes projection/reconstruction/mount/hello/authoritative action flow, Phase 12 regression, Phase 11 regression, production frontend, Windows Tauri transport/persistence tests, and Windows projected-character executable

Phase 13 artifact:

- name: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`
- artifact id: `9266043327`
- SHA-256: `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`

A compare from `7c944097...` to the pre-closeout `main` head showed 10 commits and only `.chatgpt-rerun/README.md`, `PLAN.md`, `STATE.md`, `STATUS.md`, and `control.json` changed. No source, test, workflow, rules, content, or runtime file changed, so previously verified implementation gates were not redundantly rerun.

## Later work

No Phase 14 or unrelated feature work is authorized by sequence 0. After this task reaches control status `complete`, wait for a new controller/user authorization. Any subsequent implementation must begin from current `main` and must reconcile the Rerun protocol before work starts.
