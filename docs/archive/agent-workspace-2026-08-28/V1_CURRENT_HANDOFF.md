# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-28 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항/출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 상세 구현 원장은 `CURRENT_WORK.md`와 Git history, 제품 계약은 `docs/design/`을 따른다. Resume만을 이유로 검증 완료 범위를 반복하지 않는다.

## 1. Canonical baseline

- canonical branch: `work/v1-composite`
- Gate D / Common Play Zone RuntimeArtifact merge: PR #137 -> `406a9574d249bb770ec7725efa1384808ddc9bc3`
- Gate D is closed for the current proactive Resolver program. Do not auto-activate Gate E; later Resolver gates require a concrete V1/product failure plus explicit owner reactivation.
- R1 source/execution matrix: **DONE**. 이는 V1-21 release DONE/Windows acceptance를 뜻하지 않는다.
- R1 exact checkpoints relevant to the end of R2:
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
  - Phase 12 `connected-protocol` job `98664726346` / run `33114261443`: **success**, including the focused Peerless connected proof, Phase 11 walkthrough, and production build.
  - UI `frontend` job `98664726301`: **success**.
  - The previous missing/zero-job Actions blocker is stale; **Peerless Skill R2 is CLOSED**.

## 3. R2 remaining scope

R2 remains **PARTIAL only because the final Lore Cutting Words candidate is not merged yet**.

- PR #140: `test: prove remote-owner Lore Cutting Words`
- branch: `agent/v1-lore-cutting-words-r2`
- exact green candidate: `7f4a582f00fac98f47d336f245c3cb1f73c488e5`
- PR status at checkpoint: open, mergeable, unmerged, `behind_by: 0`
- canonical diff: exactly three intended files:
  1. `.github/workflows/phase12-connected.yml`
  2. `src/app/bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts`
  3. `tests/ui/connectedProjectedCharacterCuttingWordsResolution.test.ts`

Do not mark R2 `DONE` until PR #140 is merged into `work/v1-composite`.

## 4. Lore Cutting Words — implementation/verification green on PR #140

R1 exact checkpoint `90514e44a21840070bb77ea17561036a86b2e5ca` remains the source/execution reference; existing local branches were not reimplemented.

The existing canonical R1 test already covers level eligibility, ability-check reduction, attack-to-miss reduction, staged damage reduction, Inspiration + Reaction spend, Activity/history, Undo, and the level threshold.

### Connected authority gap reproduced

Initial exact candidate `66fceede7325638429d98bb542cf0cf20c5728b0` added only the focused Host-unknown connected proof and Phase 12 wiring.

- Phase 12 run `33118589894`, connected-protocol job `98679491220`: **88/89 pass**.
- Only the new Cutting Words proof failed.
- Observed failure: the Host mounted the remote Lore Bard but never offered the Cutting Words interrupt.
- Direct cause: the existing Cutting Words follow-up adapter considered only Host `activeCharacter`; a Host-unknown projected Lore Bard was not a reaction candidate.

A broader generic projection-context experiment at `fdb0dac1d973dd48c0c0b69f90acad1f4ca88965` was rejected and fully reverted after Phase 12 run `33118780628` / job `98680120839` regressed existing Dark One's Own Luck, Peerless Skill, and Quivering Palm owner invariants. That generic port change is not present in the final diff.

### Final minimal correction

Exact candidate `7f4a582f00fac98f47d336f245c3cb1f73c488e5` keeps the correction inside the existing Cutting Words follow-up adapter:

- consider Host active Character plus mounted projected Characters as possible Cutting Words responders;
- use the selected responder's sheet/resource state through the existing resolver and Character owner write-back paths;
- keep Host permanent Character library and Host-local active Character isolated for remote responders;
- preserve existing ResolutionEvent, duplicate/retry, reconnect/rebind, and compensating Undo behavior;
- no protocol/schema change;
- no fake action-bar command;
- no generic interrupt-context rewrite;
- no unrelated cleanup.

Focused Host-unknown proof covers owner-only prompt routing, authoritative d8 reduction turning a hit into a miss, exactly one Bardic Inspiration + Reaction spend, one Host event commit, Host durable Character isolation, owning Client exactly-once persistence, duplicate interrupt/event safety, reconnect/rebind, and compensating Undo/inverse convergence.

### Exact-head evidence

At `7f4a582f00fac98f47d336f245c3cb1f73c488e5`:

- Phase 12 run `33119129767` / connected-protocol job `98681292701`: **success**.
  - connected authority suite: **89/89 pass, 0 fail**;
  - new Cutting Words proof: subtest 85, **pass**;
  - Phase 11 walkthrough inside the same job: **1/1 pass**;
  - production frontend gate `npm run build`: **success**.
- UI run `33119129773` / frontend job `98681292734`: **success**, including Typecheck/build.
- Contract run `33119129808`: **success**.

Conclusion: **Cutting Words implementation and exact-head verification are green. The only remaining R2 action is owner-approved merge of PR #140.**

## 5. Next exact action

```text
await explicit owner merge decision for PR #140
-> on approval, perform mandatory Rerun preflight
-> verify PR #140 head is still the approved exact green candidate or only coordination-only ancestry changed with the same three-file product diff
-> do not repeat Cutting Words validation unless product/runtime/test files changed after 7f4a582f00fac98f47d336f245c3cb1f73c488e5
-> merge PR #140 only after explicit approval
-> after canonical merge, mark R2 DONE and advance to R3
```

Do not merge PR #139 as part of this action; it remains separately approval-gated.

## 6. Hard boundaries

- R3: Cargo/Tauri durability, actual Windows two-instance/restart acceptance.
- R4: rendered UX/error/accessibility.
- R5: exact-SHA release regression/packaging/main/tag.
- Source-complete != release DONE.
- Missing spatial facts are not invented.
- Character owner durable write-back and Host Campaign durable write-back remain separate.
- Session transient state is not a second durable source.
- Connected retry/reconnect remains exactly-once/idempotent.
- Gate E and later Resolver expansion remain dormant until a concrete V1 failure plus explicit owner reactivation.
