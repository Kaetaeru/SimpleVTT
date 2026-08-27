# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-28 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항/출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 상세 구현 원장은 `CURRENT_WORK.md`와 Git history, 제품 계약은 `docs/design/`을 따른다. Resume만을 이유로 검증 완료 범위를 반복하지 않는다.

## 1. Canonical baseline

- canonical branch: `work/v1-composite`
- Gate D / Common Play Zone RuntimeArtifact merge: PR #137 -> `406a9574d249bb770ec7725efa1384808ddc9bc3`
- post-Gate-D routing commit: `a2b5f2aad728d3e62204497ce7a5bf693621c3c1`
- Gate D is closed for the current proactive Resolver program. Do not auto-activate Gate E; later Resolver gates require a concrete V1/product failure plus explicit owner reactivation.
- R1 source/execution matrix: **DONE**. 이는 V1-21 release DONE/Windows acceptance를 뜻하지 않는다.
- R1 exact checkpoints relevant to the remaining R2 order:
  - Lore Peerless Skill: `88bb72dc3d725af049025728003ab6e6b8db1eb0`
  - Lore Cutting Words: `90514e44a21840070bb77ea17561036a86b2e5ca`

Historical detailed evidence remains in `CURRENT_WORK.md`, previous revisions of this handoff, and GitHub Actions. This handoff intentionally carries only the current execution pointer and exact closure facts.

## 2. R2 validated remote-owner slices

Closed and not to be repeated without direct regression evidence:

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
- Lore Peerless Skill source/test candidate `bfc459ba35d089171d654fd27abb881309bef1fb`; closure evidence at `fa386d824658104e17ce409510b7df3e012173ec`:
  - `bfc459...` is an ancestor of current canonical; its focused connected proof remains present.
  - Phase 12 `connected-protocol` job `98664726346` / run `33114261443`: **success**. The workflow explicitly executes `tests/ui/connectedProjectedCharacterPeerlessSkillResolution.test.ts`, then Phase 11 offline walkthrough and `npm run build` in the same job.
  - UI `frontend` job `98664726301`: **success**.
  - Therefore the previous missing/zero-job GitHub Actions blocker is stale and **Peerless Skill R2 is CLOSED** without repeating its already-executed proof.

## 3. R2 remaining scope

R2 is **PARTIAL** with one remaining R1-backed remote-owner slice:

1. **Lore Cutting Words**

Actual Windows two-instance/restart proof remains R3 and is not an R2 closure gate.

## 4. Active — Lore Cutting Words remote-owner verification

R1 exact checkpoint `90514e44a21840070bb77ea17561036a86b2e5ca` remains the source/execution reference and must not be reimplemented.

Current canonical R1 proof `tests/ui/bardCollegeLoreCuttingWordsRuntime.test.ts` already covers:

- level 3+ College of Lore Bard eligibility;
- reducing another creature's successful ability check;
- turning another creature's successful attack into a miss;
- reducing staged damage before authoritative attack commit;
- Bardic Inspiration spend and Reaction spend;
- Activity/history projection;
- Undo restoring Inspiration, Reaction, and affected HP/state;
- no offer below the subclass level threshold.

There is currently **no** `tests/ui/connectedProjectedCharacterCuttingWordsResolution.test.ts` on canonical. That missing connected Host-unknown/owner-authority proof is the next R2 gap.

### Next exact action

```text
reconcile current Cutting Words runtime + connected owner interrupt/write-back primitives
-> add the smallest focused connected proof for a Host-unknown Lore Bard using existing SessionProjection / interrupt response / ResolutionEvent / owner write-back / reconnect / Undo paths
-> prove owner-only interrupt routing, authoritative Cutting Words delta, one Reaction + one Bardic Inspiration spend, one Host commit, Host permanent Character-library isolation, owning Client exactly-once persistence, duplicate request/event safety, reconnect/rebind, and compensating Undo/inverse convergence
-> reuse the existing R1 branches; add multiple connected trigger branches only if repository evidence shows materially different connected authority paths
-> add no fake action-bar command, protocol/schema change, or named-content branch unless a direct failing product requirement proves it necessary
-> run the focused test at the exact candidate SHA, then the existing Phase 12 connected production gate and UI frontend/typecheck/build
-> if the first red exposes a real product/content-authority gap, fix only that cause
-> when exact-SHA evidence is green, close Cutting Words and R2, then advance to R3
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
- Gate E and later Resolver expansion remain dormant until a concrete V1 failure plus explicit owner reactivation.

## 6. Focused verification

Use only the gate needed by the active slice plus its existing connected production gate. Do not rerun the historical full matrix for resume alone.

Cutting Words closure requires exact-candidate execution evidence for the focused connected proof, UI frontend/typecheck/build, and Phase 12 connected-protocol + Phase 11 + production frontend. Rust/Tauri/actual Windows two-instance evidence remains R3.
