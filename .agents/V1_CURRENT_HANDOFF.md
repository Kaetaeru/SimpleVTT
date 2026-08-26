# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-26 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항/출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 상세 구현 원장은 `CURRENT_WORK.md`와 Git history, 제품 계약은 `docs/design/`을 따른다. Resume만을 이유로 아래 검증 완료 범위를 반복하지 않는다.

## 1. Canonical baseline

- canonical branch: `work/v1-composite`
- validated integration baseline: `4a4cdb195ff4544adbb3bfd49487042238b112c1`
- R1 source/execution matrix: **DONE**. 이는 V1-21 release DONE/Windows acceptance를 뜻하지 않는다.
- R1 exact checkpoints relevant to remaining R2 order:
  - Open Hand Quivering Palm: `126cd848b1b7896eaa09f8775e60dcd9638fdf72`
  - Devotion Smite of Protection: `ec89fa251d969a250c20e11f0abe6d7a4f13d58e`
  - Fiend Dark One's Own Luck: `95042b2ef3c65aef3619334c0bec1ad243d165f2`
  - Lore Peerless Skill: `88bb72dc3d725af049025728003ab6e6b8db1eb0`
  - Lore Cutting Words: `90514e44a21840070bb77ea17561036a86b2e5ca`
- R2 validated remote-owner slices, closed and not to be repeated without direct regression evidence:
  - Rage `dec4f22178b1256597c140170481025bb26f39e3`
  - Wild Shape proof `a65cbd2926032d70f47495873996653c7622cb1e`
  - Cunning Action Dash `ea96509ee0c01922d0f23926445b5a7271a45ae1`
  - Cunning Action Disengage `134e6a8d7def8711d84bb5be56186f353a4ddeb2`
  - Cunning Action Hide `7f8e9459e433164b916ee8ef12fdf3042492d9d7`
  - Uncanny Dodge `a1edf6bc869984aaabf5cf5f564f4f11c21399ad`
  - Berserker Intimidating Presence `3d3c9866fd24c15d233e8d8730e70052597e8fec`
  - Open Hand Wholeness of Body `d03adbe11c10aa394628c025c36bea9d5c27f9c5`
  - Open Hand Fleet Step `df37d8a1ec21459578d79bc076b53b58f142f39c`
  - Devotion Holy Nimbus `5ff7d00e54135bcacfc306d68467671a3a76298e`
  - Open Hand Quivering Palm `37d002862a9ac253b8b7e6b0b138369c588be17d`
  - Devotion Smite of Protection `799fcaebd967b31c74e5520671050e81a5eb09dd`

Historical detailed evidence remains in `CURRENT_WORK.md`, previous revisions of this handoff, and GitHub Actions. This handoff intentionally carries only the current execution pointer and exact closure facts.

## 2. Green — R2 Devotion Smite of Protection

Smite of Protection R2 is closed at exact green product/test head `799fcaebd967b31c74e5520671050e81a5eb09dd`.

- Existing R1 semantics were reused: level 15+ Devotion Paladin, no standalone action, committed Divine Smite automatically appends the protection effect to the same resolution.
- The focused Host-unknown proof covers the projected Divine Smite path, Host permanent Character-library isolation, owning Client exactly-once apply/persistence, duplicate request/event safety, reconnect/rebind, and compensating Undo/inverse owner convergence.
- First fixture-only correction `3d124cf8c74e1b424b4002c8a9a4a4c7b9dae45b` preserved canonical class-feature spell resources but did not close the red.
- Direct product evidence then showed reconstructed remote spellcasters could lose the derived spell-slot cache. Final fix stays local to the existing spellcaster projection path: when `spellSlotMaximums` is absent, derive canonical slots from projected `classLevels` through existing `multiclassSpellSlots`; no SessionProjection schema/protocol expansion.
- Exact evidence at `799fcae`:
  - UI run `32981342812` / frontend job `98218488387`: **success**, including Typecheck/build.
  - Phase 12 run `32981342785` / connected-protocol job `98218488092`: **success**, including focused connected authority proof, Phase 11 walkthrough, production frontend gate.
  - Windows/Tauri child job is R3, not an R2 closure gate.

Conclusion: **Devotion Smite of Protection remote-owner gap is CLOSED.**

## 3. R2 remaining scope

R2 remains **PARTIAL** until the remaining R1 feature matrix is covered. Actual Windows two-instance/restart proof remains R3.

Next remaining R1-backed slices, in current source/execution order:

1. Fiend Dark One's Own Luck
2. Lore Peerless Skill
3. Lore Cutting Words

For every slice, reuse current SessionProjection/ActionRequest/ResolutionEvent/owner write-back/reconnect/Undo primitives. Do not add protocol/schema or fake action-bar commands unless a direct product requirement proves they are necessary.

## 4. Next exact action — Fiend Dark One's Own Luck remote-owner gap

R1 exact checkpoint `95042b2ef3c65aef3619334c0bec1ad243d165f2` is already local/source execution-green. Do not reimplement or rerun it merely because R2 starts.

Current production semantics to preserve:

- level 10+ Fiend Warlock only;
- after a failed ability check or saving throw, the existing follow-up opens an owner interrupt asking whether to use Dark One's Own Luck;
- accepting spends one canonical Dark One's Own Luck resource and adds one authoritative d10 to the failed result;
- declining changes no durable/shared state;
- existing Activity/provenance, ResolutionEvent history, owner write-back and generic Undo remain authoritative;
- no standalone fake action is added.

Next work:

```text
reconcile live branch
-> inspect the existing Dark One's Own Luck R1 runtime proof and one connected owner-interrupt analogue
-> add the smallest Host-unknown projected Fiend proof around a failed ability check or save
-> verify the owner receives/accepts the authoritative interrupt, resource 1 is spent once, one d10 is applied, and the final result/event is committed once
-> verify Host permanent Character library isolation, owning Client exactly-once apply/persist, duplicate request/event no-op, reconnect/rebind, compensating Undo + owner inverse convergence
-> if first direct red appears, fix only that cause; no broad refactor and no protocol/schema/fake action without direct evidence
-> verify exact-head UI frontend + Phase12 connected production gate
-> close canonically, then re-read the canonical remaining R2 order instead of guessing
```

## 5. Hard boundaries

- R3: Cargo/Tauri durability, actual Windows two-instance/restart acceptance.
- R4: rendered UX/error/accessibility.
- R5: exact-SHA release regression/packaging/main/tag.
- Source-complete != release DONE.
- Missing spatial facts are not invented.
- Character owner durable write-back and Host Campaign durable write-back remain separate.
- Session transient state is not a second durable source.
- Connected retry/reconnect remains exactly-once/idempotent.

## 6. Focused verification

Use only the gate needed by the active slice plus its existing connected production gate. Do not rerun the historical full matrix for resume alone.

When the focused Dark One's Own Luck proof is added, run that proof only during iteration. On pushed source changes, GitHub Actions exact-head UI and Phase12 connected jobs are the closure evidence. Rust/Tauri/Windows evidence stays separate until R3.
