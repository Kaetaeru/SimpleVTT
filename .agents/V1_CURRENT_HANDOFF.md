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

Historical detailed evidence remains in `CURRENT_WORK.md`, previous revisions of this handoff, and GitHub Actions. This handoff intentionally carries only the current execution pointer and exact closure facts.

## 2. Green — R2 Open Hand Quivering Palm

Quivering Palm R2 is closed at exact green head `37d002862a9ac253b8b7e6b0b138369c588be17d`.

- Original freeform Host-unknown proof: `09d0cea3ffa010eb5b30258e9500399cba06e095`.
- Existing R1 primitives were reused: post-Unarmed-hit seed, Focus 4, single-target marker replacement, Action detonation, Constitution save, 10d12 force/save-half, Activity, ResolutionEvent/owner write-back, duplicate/reconnect, compensating Undo.
- `replace-attack` remains unsupported/unexposed; no remote-only activation path was invented.
- Initiative gap exposed a real product boundary: entering initiative recreated TurnRuntime and could lose the long-lived Quivering marker.
- Broad shared TurnRuntime persistence was tried and then removed. Final fix stays feature-local through Quivering Palm's existing `startInitiative` wrapper, preserving only the relevant marker across the mode transition.
- Exact evidence at `37d0028`:
  - UI run `32979538192` / frontend job `98212492938`: **success**, including Typecheck/build.
  - Phase 12 run `32979538159` / connected-protocol job `98212492528`: **success**, including focused connected authority proof, Phase 11 walkthrough, production frontend gate.
  - Windows/Tauri job is R3, not an R2 closure gate.
- Covered: Host-unknown seed/reseed, marker persistence across freeform -> initiative, initiative Action economy, save/damage/effect removal, Host permanent Character-library isolation, owner exactly-once convergence, duplicate request/event safety, reconnect/rebind, compensating Undo and owner inverse convergence.

Conclusion: **Open Hand Quivering Palm remote-owner gap is CLOSED.**

## 3. R2 remaining scope

R2 remains **PARTIAL** until the remaining R1 feature matrix is covered. Actual Windows two-instance/restart proof remains R3.

Next remaining R1-backed slices, in current source/execution order:

1. Devotion Smite of Protection
2. Fiend Dark One's Own Luck
3. Lore Peerless Skill
4. Lore Cutting Words

For every slice, reuse current SessionProjection/ActionRequest/ResolutionEvent/owner write-back/reconnect/Undo primitives. Do not add protocol/schema or fake action-bar commands unless a direct product requirement proves they are necessary.

## 4. Next exact action — Devotion Smite of Protection remote-owner gap

R1 exact checkpoint `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` is already local/source execution-green. Do not reimplement or rerun it merely because R2 starts.

Current production semantics to preserve:

- level 15+ Oath of Devotion only;
- no separate fake action: a committed Divine Smite automatically appends Smite of Protection to the same resolution path;
- existing marker grants half cover to self/allies in aura until the Paladin's next turn start and ends on existing termination rules;
- existing Activity/provenance, ResolutionEvent history, owner write-back and generic Undo are authoritative;
- below-level/non-Devotion stays absent.

Next work:

```text
reconcile live branch
-> inspect current Smite of Protection runtime + connected projected Paladin reconstruction + Divine Smite action path
-> add the smallest Host-unknown focused proof for committed Divine Smite automatically appending Smite of Protection
-> verify ordered spell/resource/economy + protection-effect events as applicable, Host permanent Character library isolation, owning Client exactly-once apply/persist
-> verify duplicate request/event no-op, reconnect/fresh projection, marker/expiry state convergence, compensating Undo + owner inverse convergence
-> if first direct red appears, fix only that cause; no new protocol/schema and no separate Smite-of-Protection button
-> verify exact-head UI frontend + Phase12 connected production gate
-> close canonically, then advance to Fiend Dark One's Own Luck
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

```powershell
$env:NODE_OPTIONS='--require=./tests/tsx-os-userinfo-bootstrap.cjs'
npm run test:devotion-smite-protection
npm run test:connected-ui
npm run build
```

When source changes are pushed, GitHub Actions exact-head UI and Phase12 connected jobs are the closure evidence. Rust/Tauri/Windows evidence stays separate until R3.
