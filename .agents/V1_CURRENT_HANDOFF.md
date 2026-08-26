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
  - Fiend Dark One's Own Luck `15681838b499e76f8558de2a52265015249e3cc0`

Historical detailed evidence remains in `CURRENT_WORK.md`, previous revisions of this handoff, and GitHub Actions. This handoff intentionally carries only the current execution pointer and exact closure facts.

## 2. Green — R2 Fiend Dark One's Own Luck

Dark One's Own Luck R2 is closed at exact green product/test head `15681838b499e76f8558de2a52265015249e3cc0`.

- Existing R1 semantics were reused: level 6+ Fiend Warlock, failed ability check/save opens the owner interrupt, accepting adds one authoritative d10 and spends one canonical use exactly once.
- The focused Host-unknown proof covers owner-only prompt routing, authoritative d10 delta, one resource spend, one Host commit, Host permanent Character-library isolation, owning Client exactly-once apply/persistence, duplicate request/event safety, reconnect/rebind, and compensating Undo/inverse owner convergence.
- First direct connected red proved a real content-authority gap rather than a fixture-only problem: `dnd.srd521.subclass.warlock.fiend-patron` was absent from canonical builtin subclass content. `83146b8ef94fa3ccc1352e544e58653096ae0cef` adds only that canonical Fiend Patron content identity; no protocol/schema change.
- The next red was test-only: the failed projected check already carried its canonical check bonus, so the proof was corrected to assert the authoritative `+10` d10 delta instead of hard-coding final total 14, and to assert a genuine failed precondition before the owner accepts.
- Exact evidence at `15681838`:
  - UI run `32983451534` / frontend job `98225539840`: **success**, including Typecheck/build.
  - Phase 12 run `32983451596` / connected-protocol job `98225541222`: **success**, including focused connected authority proof, Phase 11 walkthrough, production frontend gate.
  - Windows/Tauri child job is R3, not an R2 closure gate.

Conclusion: **Fiend Dark One's Own Luck remote-owner gap is CLOSED.**

## 3. R2 remaining scope

R2 remains **PARTIAL** until the remaining R1 feature matrix is covered. Actual Windows two-instance/restart proof remains R3.

Next remaining R1-backed slices, in current source/execution order:

1. Lore Peerless Skill
2. Lore Cutting Words

For every slice, reuse current SessionProjection/ActionRequest/ResolutionEvent/owner write-back/reconnect/Undo primitives. Do not add protocol/schema or fake action-bar commands unless a direct product requirement proves they are necessary.

## 4. Next exact action — Lore Peerless Skill remote-owner gap

R1 exact checkpoint `88bb72dc3d725af049025728003ab6e6b8db1eb0` is already local/source execution-green. Do not reimplement or rerun it merely because R2 starts.

Current production semantics to preserve:

- level 14+ College of Lore Bard only;
- after the Bard fails an ability check or attack roll, the existing owner interrupt offers Peerless Skill;
- at level 14 the existing Bardic Inspiration progression supplies a d10; the authoritative die is added to the failed total;
- Bardic Inspiration is spent only if the added die changes the result to success; if failure remains, the resource is preserved;
- attack success continues through the existing attack resolution and Activity/history path;
- existing ResolutionEvent history, Character owner write-back and generic Undo remain authoritative;
- no standalone fake action is added.

Observed content-authority fact before R2 implementation: canonical `content/modules/dnd-srd-5.2.1.subclasses/module.json` currently contains Berserker, Open Hand, Devotion and Fiend, but not `dnd.srd521.subclass.bard.college-of-lore`. Treat this as a likely real Host-unknown projection gap, but keep the fix minimal and tied to the focused proof.

Next work:

```text
reconcile live branch
-> inspect the existing Peerless Skill R1 runtime proof and one connected owner-interrupt analogue
-> add the smallest Host-unknown projected Lore Bard proof around a failed ability check first
-> preserve the existing owner interrupt, authoritative Bardic Inspiration die, success-only resource spend, one Host commit and generic Undo
-> verify Host permanent Character library isolation, owning Client exactly-once apply/persist, duplicate request/event no-op, reconnect/rebind, compensating Undo + owner inverse convergence
-> cover the attack-only branch only if the focused connected evidence shows a distinct remote-authority gap; do not duplicate R1 coverage by default
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

When the focused Lore Peerless Skill proof is added, run that proof only during iteration. On pushed source changes, GitHub Actions exact-head UI and Phase12 connected jobs are the closure evidence. Rust/Tauri/Windows evidence stays separate until R3.
