# Deferred Fixes / Owner Playtest Regression Queue

이 문서는 owner 실사용 테스트에서 발견되었거나 과거 `.agents` 작업 기록에서 명시적으로 보류된 수정 사항을 한곳에 모은 **Phase 09 재개 전 회귀 차단 목록**이다.

- 기준일: 2026-08-15
- 테스트 기준 소스: PR #54 `agent/53-mechanics-phase09`, checkpoint `fd95ad39a527f5e1fa6535c37a15c75318f593f2`
- 상태: **ACTIVE / BLOCKS FURTHER PHASE 09 FEATURE WORK**
- 원칙: 이 목록의 P0/P1 owner-playtest gate를 먼저 닫고, 그 다음 Effect/Concentration 등 Phase 09 개발을 재개한다.

이 파일은 `.agents/`의 비공식 작업 연속성 문서다. 실제 수정에 착수할 때는 `.agents/README.md` 원칙대로 GitHub Issue + 전용 branch/PR로 승격한다.

---

## 1. P0 — Progression choice schedule correctness

### Owner가 실제 Windows 빌드에서 발견한 증상

1. Monk를 순차 레벨업하는 동안 **서브클래스 선택창이 실제 선택 시점에 나타나지 않았다.**
   - 현재 저장소의 Phase 08 progression 계약은 Monk의 SRD subclass 선택을 `progression.dnd.srd521.class.monk.3.subclass`로 취급한다.
   - 따라서 최소 재현은 **Monk 2 -> 3**에서 확인한다.
2. **Monk 1 -> 2에서 `능력치 향상 또는 재주` 선택이 나타났다.**
   - 이 레벨에 존재하지 않아야 하는 선택이 노출되는 phantom-choice 회귀로 취급한다.
3. Owner 관찰상 ASI/feat 선택이 **매 레벨마다 반복되는 것처럼 보였다.**
   - 아직 전 클래스/전 레벨로 확정된 사실은 아니므로, 단일 Monk 버그로 좁히지 말고 **12 classes x levels 2-20 전체 choice-schedule 회귀 가능성**으로 조사한다.

### 이미 합의된 canonical UX와 충돌

Issue #36의 Character Creation UX v0.9 결정에서 이미 다음 원칙을 고정했다.

- 현재 진행 상태에서 활성화된 Choice만 질문한다.
- level-1 생성에서 미래 subclass / feat / ASI를 미리 묻지 않는다.
- subclass 등은 **실제 unlock 시점의 `ProgressionDraft`**에서 선택한다.

따라서 이번 증상은 새 UX 요구가 아니라 **기존 canonical progression UX를 실제 구현이 어긴 회귀**다.

### 현재 코드에서 확인된 경계

- `src/domain/progression.ts`
  - 현재 target level의 `progressionRow(...).features`를 읽어 ChoiceDefinition을 만든다.
  - 정확히 `능력치 향상` feature가 있을 때만 `asi-or-feat`를 만든다.
  - `서브클래스` feature가 있을 때 required subclass choice를 만든다.
- `src/LevelUpV10.tsx`
  - React는 `progressionPlan.choices`를 렌더링할 뿐 ASI/subclass를 자체 생성하지 않는다.
  - 따라서 UI에서 숨기는 식으로 고치지 않는다. **authoritative plan이 올바르게 생성되어야 한다.**
- `src/domain/progressionPhase08MonkOpenHand.ts`
  - Monk 3레벨 subclass selection ID를 직접 기대한다.
  - Open Hand 6/11/17 mechanics도 이미 존재한다.
- `src/app/progressionRuntimeAdapter.ts` + Phase 08 progression adapters
  - 여러 adapter가 `MockAdapter.prototype.getSnapshot` / `commitLevelUp`을 순서대로 감싼다.
  - generated progression row 자체뿐 아니라 **adapter-chain에서 plan이 덮어써지거나 stale plan으로 되돌아가는지**도 조사해야 한다.

### 기존 테스트가 놓친 이유

현재 Phase 08 전체 audit은 12개 클래스 x target level 2-20을 순회하지만 핵심 assertion이 **`catalog-pending` choice가 0개인지**에 집중되어 있다.

이 검사는 다음을 보장하지 않는다.

- 필요한 subclass choice가 실제로 존재하는가.
- 존재하지 않아야 할 ASI/feat가 끼어들지 않는가.
- no-choice level이 진짜 no-choice인가.
- 해당 레벨의 expected choice IDs/kinds/counts가 정확한가.
- 순차 레벨업 후 이전 레벨의 선택이 다음 레벨 plan으로 누수되지 않는가.

또한 audit helper는 target level 3에서 subclass selection을 request에 미리 주입한다. **현재 plan에 존재하지 않는 selection을 제출해도 무시된다면**, subclass choice 자체가 빠져도 이 audit이 통과할 수 있다.

### 수정 전에 먼저 추가할 deterministic failing gates

#### Monk 최소 재현

- [ ] Monk 1 -> 2: `asi-or-feat` 없음.
- [ ] Monk 1 -> 2: subclass choice 없음.
- [ ] Monk 2 -> 3: required subclass choice가 정확히 1개 존재.
- [ ] Monk 2 -> 3: subclass 미선택 시 commit blocking.
- [ ] Monk 2 -> 3: SRD subclass 선택 후 class track / subclass stable ID / presentation이 모두 반영.
- [ ] Monk 2 -> 3: unrelated ASI/feat choice 없음.
- [ ] Monk 3 -> 4 및 이후 레벨은 **검수된 SRD progression source row와 동일한 choice schedule**을 가진다.
- [ ] Monk 1 -> 20 sequential leveling: 이전 레벨 selections가 다음 레벨에 남지 않는다.

#### 전 클래스 semantic choice-schedule matrix

- [ ] 12 SRD classes x target levels 2-20에 대해 expected choice schedule fixture를 만든다.
- [ ] 각 level의 actual `plan.choices`를 expected **ID / kind / count / required**와 비교한다.
- [ ] subclass unlock choice는 각 클래스의 canonical unlock row에서 정확히 한 번만 발생한다.
- [ ] ASI/feat는 canonical `능력치 향상` row에서만 발생한다.
- [ ] no-choice level에서는 phantom choice가 0개다.
- [ ] 필요한 ready choice가 미선택이면 반드시 commit을 막는다.
- [ ] 현재 plan에 존재하지 않는 choice ID를 client가 제출하면 silent ignore하지 말고 validation에서 잡을지 결정하고, 가능하면 explicit reject한다.
- [ ] sequential 1 -> 20 progression에서 매 commit 후 다음 plan을 다시 생성하여 stale choice/state leakage를 검사한다.

### fixture 설계 주의

생성된 `progressionCatalog.generated.json`을 다시 읽어 그 값과 자기 자신을 비교하는 순환 테스트만 만들면 안 된다. 최소한 choice schedule의 중요한 의미(subclass unlock, ASI rows, class-specific required choices)는 **검수된 canonical progression source에서 독립적으로 고정한 fixture** 또는 reviewed semantic expectation으로 검증한다.

### 앱/adapter E2E gate

- [ ] LevelUpV10이 받은 `snapshot.progressionPlan`이 같은 state/request의 authoritative domain plan과 동일한 choice IDs/kinds를 갖는다.
- [ ] Phase 08 wrapper import/monkey-patch 순서가 plan을 덮어쓰지 않는지 검증한다.
- [ ] `startLevelUp`이 새 draft를 시작할 때 이전 `progressionSelections`를 완전히 비운다.
- [ ] commit 후 다음 level-up을 시작했을 때 이전 level choice가 재등장하지 않는다.
- [ ] Monk 1 -> 2 -> 3 owner 재현 시 UI에서 2레벨 phantom ASI가 사라지고 3레벨 subclass 선택이 보인다.

### 금지되는 임시 수정

- React에서 `if monk && level === ...`로 choice를 숨기거나 생성하지 않는다.
- Monk만 하드코딩해 ASI를 제거하지 않는다.
- green CI만 근거로 progression gate를 완료 처리하지 않는다.
- `catalog-pending === 0`을 semantic correctness와 동일시하지 않는다.

---

## 2. P1 — Historical owner walkthrough / UX acceptance debt

과거 `.agents/CURRENT_WORK.md`의 UI Session 01 단계에는 다음이 미완료로 남아 있었다.

- owner full Windows walkthrough
- owner-requested final UI revisions
- UI Session 01 explicit acceptance
- owner walkthrough의 레벨업 `ProgressionDraft` 적용/취소 확인

또한 `.agents/UX_STRUCTURE_GATES.md`는 다음 순서를 요구한다.

```text
Phase implementation
-> deterministic/domain regression
-> Structure Gate
-> owner UX walkthrough
-> revise contracts/UI if needed
-> next phase
```

그리고 progression 관련 후속 gate로 다음을 명시했다.

- Gate 07.5: Real CharacterCreationPlan + ChoiceDefinition + progression UX
- Gate 08.5: real SRD semantic catalog coverage walkthrough
- Gate 09: RealAdapter end-to-end acceptance

현재 owner가 최신 Windows 빌드에서 직접 progression 문제를 발견한 것은 이 과거 acceptance debt가 실제로 남아 있었음을 보여준다. 따라서 **Phase 08의 자동 테스트가 green이었다는 이유만으로 progression UX/semantic acceptance를 완료로 간주하지 않는다.**

### owner 재검증 체크리스트

P0 수정 후 다음을 실제 Windows 빌드에서 다시 확인한다.

- [ ] 새 SRD level-1 Character 생성 -> finalize.
- [ ] 같은 Character를 2, 3, 4레벨 이상 순차 progression.
- [ ] 자동 획득과 실제 선택이 화면에서 구분됨.
- [ ] no-choice level은 정말 추가 선택 없이 진행됨.
- [ ] subclass가 unlock 시점에만 나타남.
- [ ] ASI/feat가 해당 레벨에서만 나타남.
- [ ] 선택 취소/재진입/클래스 변경 시 stale selection이 남지 않음.
- [ ] commit 후 CharacterSheet의 class level, subclass, ability/feat, HP, features가 plan과 일치.
- [ ] 최소 Monk 외에 Fighter/Rogue/주문시전자 각 1개 representative path를 확인.

owner 확인이 끝나기 전에는 이 gate를 닫지 않는다.

---

## 3. Carry-forward Phase 09 work — progression gate 이후 재개

다음 항목은 버그가 아니라 기존 Phase 09 계획이며, 위 P0/P1을 먼저 끝낸 뒤 재개한다.

### Runtime/event convergence

- [ ] `EffectStateChange` safe inverse용 before/after effect payload 완성.
- [ ] concentration runtime projection + event-native inverse.
- [ ] effect/concentration application path -> raw-event Activity/Undo.
- [ ] condition/effect-aware turn begin semantics가 active runtime에 완전히 수렴하는지 검증.

### Character / progression application convergence

- [ ] Character Creation 전용 choice graph -> 공용 `ChoiceDefinition` 경로로 점진 통합.
- [ ] level-up / rest-time configuration / class-feature commands -> 공용 application service로 수렴.
- [ ] progression adapter-chain의 `MockAdapter.prototype` monkey-patch 의존을 점진적으로 제거하고 하나의 authoritative application service로 수렴.
- [ ] 생성 -> progression -> sheet projection이 동일한 stable ID/provenance 규칙을 사용하도록 검증.

### Remaining Phase 09

- [ ] Combatant runtime actions를 authoritative spatial facts가 있는 encounter instance에 확대.
- [ ] UI component에 named-rule 계산이 재유입되지 않는 구조 gate.
- [ ] optional WebGL/physics dice renderer.

---

## 4. Carry-forward later phases

### Phase 10 — Persistence / Content Platform

- [ ] local Character library persistence.
- [ ] durable runtime/content revision 저장.
- [ ] creation/progression draft persistence + recovery.
- [ ] real ContentCatalog + builtin/local/homebrew composition.
- [ ] module dependency/version/capability/cycle/conflict validation.
- [ ] ItemInstance/spellbook/resource/feature durable state persistence.
- [ ] atomic local save + failed-save recovery.

### Phase 11 — Complete Offline Vertical Slice

- [ ] Character 생성/저장/복원.
- [ ] progression / multiclass end-to-end.
- [ ] equipment / ItemInstance / resources.
- [ ] Freeform + Initiative rules paths.
- [ ] conditions / Concentration / reactions.
- [ ] class/subclass representative E2E.
- [ ] Combatant import -> instantiate -> resolution.
- [ ] authoritative Activity/dice/provenance + safe Undo.
- [ ] deterministic offline walkthrough gate.

---

## 5. Out of scope / do not accidentally reintroduce

- Core에 battle map / token coordinate / grid / pathfinding / LOS ownership을 넣지 않는다.
- battlemap은 확정된 기능이 아니라 선택적 외부 확장 가능성일 뿐이다.
- progression 버그 수정과 movement/module 설계를 연결하지 않는다.
- 실제 외부 map module 요구가 생기기 전에는 speculative module architecture를 키우지 않는다.

---

## 6. Resume order

```text
P0 progression semantic schedule regression
        ↓
P1 owner Windows progression walkthrough / acceptance
        ↓
Phase 09 Effect / Concentration event-native convergence
        ↓
Character Creation + progression application-service convergence
        ↓
remaining Phase 09
        ↓
Phase 10 persistence
        ↓
Phase 11 offline vertical slice
```

이 순서는 owner가 명시적으로 변경하지 않는 한 후속 에이전트의 기본 우선순위로 사용한다.
