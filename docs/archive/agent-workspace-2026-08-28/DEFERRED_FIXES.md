# Deferred Fixes / Owner Playtest Regression Queue

이 문서는 owner 실사용 테스트에서 발견되었거나 과거 `.agents` 작업 기록에서 명시적으로 보류된 수정 사항을 한곳에 모은 **Phase 09 재개 전 회귀 차단 목록**이다.

- 기준일: 2026-08-15
- 원래 테스트 기준 소스: PR #54 `agent/53-mechanics-phase09`, checkpoint `fd95ad39a527f5e1fa6535c37a15c75318f593f2`
- P0 수정 Issue: #55
- P0 수정 branch: `agent/55-progression-choice-schedule-fix`
- 자동 검증 checkpoint: `107ed5b74cbb85e7d073797b371960c609343e1a`
- 상태: **P0 IMPLEMENTED / AUTOMATED GREEN · P1 OWNER WINDOWS RETEST PENDING**
- 원칙: P1 owner-playtest gate를 닫은 뒤 Effect/Concentration 등 Phase 09 개발을 재개한다.

이 파일은 `.agents/`의 비공식 작업 연속성 문서다. 실제 수정에 착수할 때는 `.agents/README.md` 원칙대로 GitHub Issue + 전용 branch/PR로 승격한다.

---

## 1. P0 — Progression choice schedule correctness

### Owner가 실제 Windows 빌드에서 발견한 증상

1. Monk를 순차 레벨업하는 동안 **서브클래스 선택창이 실제 선택 시점에 나타나지 않았다.**
   - 현재 저장소의 Phase 08 progression 계약은 Monk의 SRD subclass 선택을 `progression.dnd.srd521.class.monk.3.subclass`로 취급한다.
   - 최소 재현은 **Monk 2 -> 3**이다.
2. **Monk 1 -> 2에서 `능력치 향상 또는 재주` 선택이 나타났다.**
   - 이 레벨에 존재하지 않아야 하는 phantom-choice 회귀였다.
3. Owner 관찰상 ASI/feat 선택이 **매 레벨마다 반복되는 것처럼 보였다.**
   - 12 classes x levels 2-20 semantic matrix로 ASI/subclass schedule을 별도 검증했다.

### 확정된 root cause

canonical SRD progression data와 rules-domain plan은 정상이다. 문제는 **production Vite route wiring**이었다.

- `vite.config.ts`가 실제 level-up route의 legacy `LevelUpScreen`을 `CharacterCreateV09.tsx`의 `LevelUpFocused`로 강제 치환하고 있었다.
- `LevelUpFocused`는 `snapshot.progressionPlan`을 사용하지 않고 legacy `LevelUpDraft.asiMode`를 기반으로 **모든 레벨에서 `능력치 향상 또는 재주` 화면을 고정 렌더링**했다.
- `LevelUpFocused`에는 subclass ChoiceDefinition을 렌더링하는 경로가 없었다.
- 동시에 `main.tsx`의 `LevelUpV10Bridge`는 legacy `.builder-screen` DOM host를 찾아 portal을 마운트하는데, `LevelUpFocused`가 route를 대체하면서 그 host 자체가 사라졌다.
- 결과적으로 authoritative `progressionPlan` 기반 V10 레벨업 UI가 production build에서 실제로는 마운트되지 않았고, stale focused UI만 보였다.

### 적용한 수정

- [x] Vite가 level-up route를 `LevelUpFocused`로 치환하지 않도록 수정.
- [x] legacy `LevelUpScreen` host는 유지하고 `LevelUpV10Bridge`가 authoritative `progressionPlan` UI를 portal로 마운트하도록 복구.
- [x] production route가 다시 `LevelUpFocused`를 연결하지 못하도록 structural regression gate 추가.
- [x] 해당 regression gate를 `.github/workflows/ui.yml` 정식 CI에 편입.

이 수정은 현재 UI bridge 구조를 보존하는 최소 P0 fix다. legacy `LevelUpScreen`/MockAdapter 계산 자체의 제거는 Phase 09 application-service convergence에서 처리한다.

### 이미 합의된 canonical UX

Issue #36의 Character Creation UX v0.9 결정:

- 현재 진행 상태에서 활성화된 Choice만 질문한다.
- level-1 생성에서 미래 subclass / feat / ASI를 미리 묻지 않는다.
- subclass 등은 **실제 unlock 시점의 `ProgressionDraft`**에서 선택한다.

따라서 이번 증상은 새 UX 요구가 아니라 **기존 canonical progression UX를 production route가 어긴 회귀**였다.

### 자동 회귀 검증 결과

`tests/ui/progressionChoiceScheduleRegression.test.ts`에서 다음을 고정했다.

#### Monk 최소/순차 재현

- [x] Monk 1 -> 2: `asi-or-feat` 없음.
- [x] Monk 1 -> 2: subclass choice 없음.
- [x] Monk 2 -> 3: required subclass choice가 정확히 1개 존재.
- [x] Monk 2 -> 3: subclass 미선택 시 commit blocking.
- [x] Monk 2 -> 3: SRD subclass 선택 후 Character에 subclass presentation이 반영.
- [x] Monk 2 -> 3: unrelated ASI/feat choice 없음.
- [x] Monk 3 -> 4: ASI가 정확히 1개, subclass choice는 재등장하지 않음.
- [x] 새 Character Creation flow로 실제 Monk 생성/finalize 후 1 -> 2 progression에서도 phantom ASI/subclass가 없음.

#### 전 클래스 semantic schedule matrix

- [x] 12 SRD classes x target levels 2-20에서 canonical ASI schedule 검증.
- [x] Fighter ASI schedule: 4/6/8/12/14/16.
- [x] Rogue ASI schedule: 4/8/10/12/16.
- [x] 나머지 SRD classes ASI schedule: 4/8/12/16.
- [x] subclass unlock은 12 classes 모두 target level 3에서 정확히 1개 `subclass` ChoiceDefinition으로 생성됨.
- [x] 그 외 레벨에는 phantom subclass choice가 없음.
- [x] generated progression row와 outermost Phase 08 plan을 함께 비교해 source row와 ChoiceDefinition schedule을 양쪽에서 검증.

추가 semantic-hardening으로 남김:

- [ ] ASI/subclass 외 class-specific choice까지 포함한 **모든 ChoiceDefinition ID/kind/count/required**의 독립 reviewed fixture를 단계적으로 확대.
- [ ] 현재 plan에 존재하지 않는 choice ID를 client가 제출할 때 silent ignore 대신 explicit reject가 필요한지 결정/검증.
- [ ] full 1 -> 20 sequential progression에서 모든 class-specific stale selection leakage를 포괄하는 장기 matrix 추가.

이 세 항목은 현재 owner가 발견한 P0 production-route 버그의 수정 완료를 막지는 않지만, Phase 09 progression application-service 수렴 때 함께 강화한다.

### 앱/adapter E2E gate

- [x] final Phase 08 adapter chain의 `snapshot.progressionPlan`에서 Monk 1->2 / 2->3 / 3->4 schedule 검증.
- [x] Phase 08 wrapper chain을 통과한 plan이 canonical ASI/subclass schedule을 보존함을 검증.
- [x] 새 생성 Character -> progression metadata handoff 검증.
- [x] subclass 선택 commit 후 다음 level-up에서 stale subclass selection이 재등장하지 않음.
- [x] production Vite route가 authoritative V10 bridge host를 보존하도록 구조 gate 추가.

### 최종 자동 검증

checkpoint `107ed5b74cbb85e7d073797b371960c609343e1a` 기준 GitHub Actions UI job:

```text
Generate content dependencies                 ✅
Progression choice schedule regression         ✅
Bard / Lore progression runtime                ✅
Draconic progression/runtime                   ✅
Wizard Evocation progression/runtime           ✅
Phase 09 real mechanics services               ✅
TypeScript + production build                  ✅
```

### 금지되는 임시 수정

- React에서 `if monk && level === ...`로 choice를 숨기거나 생성하지 않는다.
- Monk만 하드코딩해 ASI를 제거하지 않는다.
- green CI만 근거로 owner acceptance를 완료 처리하지 않는다.
- `catalog-pending === 0`을 semantic correctness와 동일시하지 않는다.

---

## 2. P1 — Owner Windows progression walkthrough / historical UX acceptance debt

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

progression 관련 후속 gate:

- Gate 07.5: Real CharacterCreationPlan + ChoiceDefinition + progression UX
- Gate 08.5: real SRD semantic catalog coverage walkthrough
- Gate 09: RealAdapter end-to-end acceptance

P0 자동 수정이 green이어도 **owner가 Windows build로 실제 flow를 확인하기 전에는 이 gate를 닫지 않는다.**

### owner 재검증 체크리스트

P0 수정 build에서 다음을 실제 확인한다.

- [ ] 새 SRD level-1 Monk Character 생성 -> finalize.
- [ ] Monk 1 -> 2: 능력치/재주 선택이 뜨지 않음.
- [ ] Monk 2 -> 3: subclass 선택이 실제로 표시되고 미선택 시 확정 불가.
- [ ] Monk 3 -> 4: ASI/feat 선택이 표시됨.
- [ ] 자동 획득과 실제 선택이 화면에서 구분됨.
- [ ] no-choice level은 정말 추가 선택 없이 진행됨.
- [ ] subclass가 unlock 시점에만 나타남.
- [ ] ASI/feat가 해당 레벨에서만 나타남.
- [ ] 선택 취소/재진입/클래스 변경 시 stale selection이 남지 않음.
- [ ] commit 후 CharacterSheet의 class level, subclass, ability/feat, HP, features가 plan과 일치.
- [ ] 최소 Monk 외에 Fighter/Rogue/주문시전자 각 1개 representative path를 확인.

owner 확인이 끝나기 전에는 P1을 닫지 않는다.

---

## 3. Carry-forward Phase 09 work — P1 이후 재개

다음 항목은 버그가 아니라 기존 Phase 09 계획이며, P1을 먼저 끝낸 뒤 재개한다.

### Runtime/event convergence

- [ ] `EffectStateChange` safe inverse용 before/after effect payload 완성.
- [ ] concentration runtime projection + event-native inverse.
- [ ] effect/concentration application path -> raw-event Activity/Undo.
- [ ] condition/effect-aware turn begin semantics가 active runtime에 완전히 수렴하는지 검증.

### Character / progression application convergence

- [ ] Character Creation 전용 choice graph -> 공용 `ChoiceDefinition` 경로로 점진 통합.
- [ ] level-up / rest-time configuration / class-feature commands -> 공용 application service로 수렴.
- [ ] progression adapter-chain의 `MockAdapter.prototype` monkey-patch 의존을 점진적으로 제거하고 하나의 authoritative application service로 수렴.
- [ ] legacy `LevelUpScreen` host / bridge 임시 구조를 제거하고 route 자체가 authoritative progression application/view-model을 직접 소비하도록 수렴.
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
P0 progression production-route regression ✅ automated
        ↓
P1 owner Windows progression walkthrough / acceptance ← current gate
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
