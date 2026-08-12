# 현재 작업 체크리스트

이 문서는 SimpleVTT 개발에서 에이전트가 현재 상태와 다음 작업을 빠르게 파악하기 위한 살아있는 작업 체크리스트다.

- 이 문서는 **공식 제품 명세가 아니다**.
- 구현에 들어가는 항목은 GitHub Issue로 구체화하고, 전용 브랜치와 Pull Request로 처리한다.
- 공식 UX/설계 계약은 `.agents/`가 아니라 `docs/`, `schemas/`, `templates/`, `examples/` 등 프로젝트 영역에 둔다.
- 세부 구현 내용은 단기 체크리스트에만 유지하고, 장기 체크리스트는 방향과 완료 조건 중심으로 유지한다.
- 단기 항목이 완료되면 장기 항목에서 다음 작업을 끌어와 단기 목록을 갱신한다.

## 제품 중심 원칙

SimpleVTT의 핵심 목표는 **전투에서 사람이 해야 하는 산수와 규칙 상태 추적을 압도적으로 줄이는 것**이다.

- 수학은 자동화하고 선택은 플레이어/DM에게 남긴다.
- 사용자는 가능한 한 `대상 선택 → 행동 선택 → 필요한 선택만 응답 → 결과 확인` 흐름으로 전투한다.
- 모든 중요한 계산값은 최종 숫자뿐 아니라 **어떤 RuleSource가 어떻게 기여했는지** 추적 가능해야 한다.
- 적용되지 않은 modifier도 stacking/predicate 등의 이유를 설명할 수 있어야 한다.
- feat, spell, equipment, condition, class feature 등은 설명문만 저장하지 않고 실제 Action/Effect/Resource/Trigger/Permission/Restriction 등의 구조화된 mechanics를 제공해야 한다.
- 이름이 붙은 주문/기능을 Resolver 코드에 하드코딩하지 않고 RuleSource + generic mechanics 조합으로 처리한다.
- 행동경제는 UI 메모가 아니라 RulesProfile이 정의하는 encounter state로 추적한다.
- Action 사용 가능 여부, action-economy cost, resource cost, restriction, reset 시점을 시스템이 판단하고 설명한다.
- 행동경제/자원 소비도 CombatEvent transaction에 포함되어 동기화와 Undo의 대상이 된다.
- 자동 계산은 항상 펼쳐볼 수 있는 계산 내역을 남긴다.
- 주사위 애니메이션은 엔진이 이미 확정한 결과를 시각화하며 독립적인 난수를 생성하지 않는다.
- 캐릭터 원본은 플레이어 PC가 소유한다.
- 캐릭터 생성에서는 source 값을 한 번만 입력하고 파생값은 RulesProfile + RuleSource가 자동 계산한다.
- Guided Creation과 Quick Create는 같은 Character 모델을 사용하며, 작성 중인 Character는 항상 로컬 draft로 자동 저장된다.
- 계산된 값의 수동 예외는 조용히 덮어쓰지 않고 명시적인 override RuleSource와 source/reason으로 남긴다.
- Character 생성 결과는 별도의 전투용 재입력 없이 구조화된 RuleSource/Action/Effect/Resource 데이터를 Resolver가 바로 사용할 수 있어야 한다.
- DM 호스트는 영구 캐릭터 파일이 아니라 임시 세션/전투 상태를 소유한다.
- Combatant는 계산에 필요한 스탯블록 데이터를 JSON으로 Import할 수 있어야 한다.
- Combatant JSON은 스키마/템플릿/예시/설명서를 제공하여 외부 AI로도 생성하기 쉽게 만들되, 반드시 로컬 검증과 사용자 리뷰를 거친다.
- Import된 Character/Combatant/rule data는 선언형 데이터이며 임의 실행 코드를 허용하지 않는다.

## 현재 상태

- [x] `SimpleVTT` 저장소 생성
- [x] Issue #1 / Draft PR #2: 에이전트 작업 공간 분리
- [x] Issue #3 / Draft PR #4: 전투 자동화 UX 및 도메인/Combatant Import 계약 초안
- [x] Issue #5 / Draft PR #6: 캐릭터 생성/편집 UX 초안
- [x] Issue #7: stat provenance / RuleSource / action economy 설계 시작
- [x] `agent/7-rule-provenance-action-economy`를 PR #6 브랜치 위의 stacked branch로 시작
- [x] `docs/design/rule-sources-provenance-action-economy.md` 초안 작성
- [x] 실수로 생성된 Issue #8/#9는 #7의 duplicate로 종료
- [ ] Draft PR #2 검토 후 `main`에 병합
- [ ] PR #2 병합 후 PR #4 base를 `main`으로 변경하고 diff 재검증
- [ ] 선행 설계 PR을 순서대로 retarget/검토
- [ ] 초기 D&D RulesProfile 확정
- [ ] Issue #3/#5/#7의 공통 domain contract 정합성 검토
- [ ] 설계 계약 정리 후 첫 구현 Issue 시작

## 단기 체크리스트

단기 범위는 **현재 설계와 다음 2~4개의 PR**이다. 바로 Issue로 전환할 수 있을 정도로 구체적으로 관리한다.

### 1. 저장소 기반 정리 — Issue #1 / PR #2

- [x] 에이전트 지시/작업 문서를 `.agents/`로 격리
- [x] 에이전트 작업 문서와 공식 프로젝트 문서의 경계 명시
- [x] 장기/단기 개발 체크리스트 도입
- [ ] PR #2의 변경 범위와 문서 내용 최종 검토
- [ ] PR #2 병합 및 Issue #1 종료 확인

### 2. 전투 자동화 UX 및 도메인 계약 — Issue #3 / PR #4

- [x] 제품 목표를 `Character Sheet + Dice Roller`가 아니라 `Combat Automation` 중심으로 재정의
- [x] `docs/design/combat-automation-ux.md`에 핵심 전투 UX와 데이터 소유권 원칙 기록
- [x] Character / Combatant Definition / Combatant State / Action / Effect / Resolution / CombatEvent 경계 초안 작성
- [x] Roll20/FVTT형 compact + expandable Roll/Combat log UX 정의
- [x] authoritative dice result와 시각적 주사위 애니메이션 분리
- [x] reaction/optional choice와 transaction-style Undo 요구사항 정의
- [x] `schemas/combatant.schema.json` 초기 Draft 작성
- [x] `templates/combatant.template.json` / `examples/combatant.example.json` 작성
- [x] `docs/guides/combatant-json-import.md` 및 AI 변환 프롬프트 패턴 작성
- [ ] JSON Schema 자체 유효성 검증
- [ ] template/example이 Schema를 통과하는지 검증
- [ ] Issue #7 RuleSource/economy 계약을 반영해 Combatant schema migration 방향 검토
- [ ] Combatant 참조 무결성/Effect target semantic validation 최소 집합 확정
- [ ] Effect/Modifier 연산 우선순위와 Resolution interrupt 지점 구체화
- [ ] 초기 지원 D&D RulesProfile 버전 확정
- [ ] PR #4 설계 리뷰

### 3. 캐릭터 생성/편집 UX — Issue #5 / PR #6

- [x] Guided Creation과 Quick Create를 같은 Character draft 모델 위에 두는 원칙 정의
- [x] source / derived / modifier / override 값의 표시 규칙 정의
- [x] draft autosave / resume / save failure UX 정의
- [x] RulesProfile-driven step/field 구조 정의
- [x] Blocking error / Warning / Info validation 레벨 정의
- [x] Final Review와 오류 항목 direct navigation 정의
- [x] Character authoring 결과가 Action/Effect/Resource를 통해 바로 combat-ready가 되어야 하는 원칙 정의
- [x] 작성 후 편집에서도 동일 section/component mental model을 유지하는 원칙 정의
- [ ] Issue #7에 맞춰 Character가 flattened total이 아니라 RuleSource/source choice를 소유하는 계약 확정
- [ ] 모든 주요 derived property가 provenance breakdown을 제공하는 UX 정합성 검토
- [ ] feat/spell/item 선택 시 실제 mechanical grants를 표시하는 UX 구체화
- [ ] 초기 RulesProfile 확정 후 Guided step과 필수 필드 구체화
- [ ] 최소 Character import/versioning 요구사항 확정
- [ ] PR #6 설계 리뷰

### 4. Stat Provenance / RuleSource / Action Economy — Issue #7

- [x] 모든 계산 가능 property가 source-by-source provenance를 제공하는 원칙 정의
- [x] applied / suppressed / superseded / failed-predicate contribution 상태 정의
- [x] override를 별도 RuleSource로 취급하는 원칙 정의
- [x] feat/spell/equipment/condition 등이 structured mechanics를 제공하는 원칙 정의
- [x] RuleSource mechanic family 초안 정의
- [x] derived property dependency graph 및 cycle validation 요구사항 정의
- [x] 제한된 expression/predicate만 허용하고 arbitrary executable code를 금지하는 원칙 정의
- [x] RulesProfile-driven economy bucket/ledger 모델 정의
- [x] Action legality / economy cost / resource cost / restriction / reset 설명 요구사항 정의
- [x] reaction/interrupt와 economy ledger 연계 정의
- [x] economy/resource 상태 변화가 CombatEvent transaction/Undo에 포함되는 원칙 정의
- [x] Character/Combatant/Combat log가 동일 provenance source IDs를 재사용하는 원칙 정의
- [ ] 초기 RulesProfile의 property-path registry 초안 확정
- [ ] stacking/priority 결정 규칙과 stable rule ID 방식 확정
- [ ] restricted formula/predicate 표현 방식 확정
- [ ] MVP mechanic primitive 정확한 최소 집합 확정
- [ ] RulesProfile lifecycle ordering(turn/round/reset/trigger) 확정
- [ ] Issue #3/#5 계약과 충돌 여부 최종 검토
- [ ] Issue #7 Draft PR 생성 및 설계 리뷰

### 5. 애플리케이션 골격 + 순수 도메인 패키지 — 후속 PR

Issue #3/#5/#7 핵심 계약과 초기 RulesProfile이 정리된 뒤 시작한다.

- [ ] Tauri + React + TypeScript 프로젝트 초기화
- [ ] UI와 규칙/계산 코드를 분리할 패키지 경계 작성
- [ ] RulesProfile / RuleSource / Property Resolution / Provenance / Economy / Action Legality / Resolution / CombatEvent 패키지 경계 작성
- [ ] React component 내부에서 핵심 rules arithmetic을 직접 계산하지 않는 구조 확립
- [ ] 플레이어 모드와 세션 호스트 모드를 하나의 앱에서 제공할 기본 라우팅 작성
- [ ] 개발·빌드 명령 정리
- [ ] lint, typecheck, test, build 기본 검증 추가
- [ ] GitHub Actions에서 최소 검증이 PR마다 실행되도록 구성
- [ ] 루트 README에 프로젝트 목표와 개발 실행 방법 기록

### 6. 로컬 Character + Combatant 기반 — 후속 PR

- [ ] 플레이어 소유 Character 저장 스키마와 버전 정의
- [ ] Character draft / finalized 상태와 안전한 로컬 저장 구현
- [ ] Guided Creation / Quick Create가 같은 draft에 읽고 쓰도록 구현
- [ ] Character가 RuleSource/source choice와 mutable state를 저장하고 derived total은 재계산 가능하도록 설계
- [ ] source 변경 시 dependency graph를 따라 derived property 자동 재계산
- [ ] 모든 주요 derived property의 provenance breakdown 구현
- [ ] explicit override RuleSource 저장/해제 구현
- [ ] feat/spell/equipment/feature의 structured mechanics 표시/편집 기반 구현
- [ ] Character 생성/목록/수정/삭제/복제 구현
- [ ] Combatant Definition 로컬 라이브러리 구현
- [ ] Combatant JSON schema + semantic validation 구현
- [ ] Combatant Definition에서 mutable Combatant State 생성

### 7. 첫 전투 계산 Vertical Slice — 후속 PR

하나의 실제 시나리오를 end-to-end로 통과시키되 네트워크는 아직 넣지 않는다.

- [ ] 완성된 Character Action이 RuleSource에서 자동으로 전투 화면에 나타남
- [ ] Action legality가 economy/resource/condition/restriction을 검사함
- [ ] 현재 action economy ledger를 전투 화면에서 확인 가능
- [ ] 대상 선택 및 Action 실행
- [ ] 공격 굴림 + 이점/불리점 상쇄
- [ ] provenance-aware attack modifier 적용
- [ ] provenance-aware target AC 계산 및 비교
- [ ] 치명타 처리
- [ ] typed damage 계산
- [ ] resistance/immunity/vulnerability 적용
- [ ] temporary HP → HP 순서 적용
- [ ] action economy/resource 소비를 결과와 같은 transaction에 포함
- [ ] 전체 계산 내역이 동일 provenance record를 사용
- [ ] CombatEvent transaction 생성
- [ ] Undo가 HP/resource/economy를 함께 복구
- [ ] 같은 이벤트에서 주사위 표시와 로그 카드 재구성

## 장기 체크리스트

### Phase 0 — 저장소와 개발 흐름

- [ ] `main`을 항상 실행 가능한 상태로 유지
- [ ] 기능 단위 Issue → 작업 브랜치 → Draft PR → 검증 → 병합 흐름 정착
- [ ] 의존 PR이 있을 때 stacked branch/PR을 사용하되 선행 PR 병합 후 base 정리
- [ ] 최소 CI(lint/typecheck/test/build) 정착
- [ ] 핵심 UX/설계 결정과 변경 이유가 Issue/PR/docs에서 추적 가능

### Phase 1 — RulesProfile / RuleSource / Domain 계약

- [ ] 초기 D&D RulesProfile 확정
- [ ] stable property-path registry 확정
- [ ] Character source/RuleSource/override 모델 확정
- [ ] Character와 Combatant의 소유권/상태 경계 확정
- [ ] RuleSource mechanic primitive MVP 집합 확정
- [ ] provenance / dependency graph 계약 확정
- [ ] stacking/priority/suppression 설명 계약 확정
- [ ] RulesProfile-driven action economy / lifecycle / reset 계약 확정
- [ ] Action legality / permission / restriction 계약 확정
- [ ] Resolution ordering 및 reaction/interrupt 규칙 확정
- [ ] CombatEvent와 calculation breakdown 계약 확정
- [ ] versioned Combatant JSON Schema를 새 계약에 맞게 확정
- [ ] template/example/AI authoring guide 제공
- [ ] JSON structural validation + semantic validation 정책 확정

### Phase 2 — 오프라인 Character / Combatant 준비 앱

- [ ] Guided Creation으로 고급 필드를 거의 보지 않고 기본 Character 생성 가능
- [ ] Quick Create로 긴 wizard 없이 동일 Character를 빠르게 생성 가능
- [ ] Character draft가 앱 재실행 후 복구됨
- [ ] Character 원본은 플레이어 PC가 소유함
- [ ] source 변경 시 dependent derived property가 자동 재계산됨
- [ ] AC/initiative/save/attack 등 주요 값의 source-by-source breakdown 확인 가능
- [ ] suppressed/inactive source도 필요한 경우 이유 확인 가능
- [ ] feat/spell/item/condition의 실제 mechanics를 확인 가능
- [ ] Final Review가 blocking issue를 직접 해당 입력으로 연결함
- [ ] 완성된 Character가 combat-ready RuleSource/Action/Effect/Resource 데이터를 보유함
- [ ] Character 내보내기/가져오기 및 versioning/migration 기반 마련
- [ ] DM이 Combatant Definition을 JSON으로 Import/검토/저장 가능
- [ ] Combatant Definition에서 encounter state 생성 가능

### Phase 3 — Rules / Provenance / Effect / Economy / Resolution Engine

- [ ] dependency graph 기반 property resolution
- [ ] provenance record 생성
- [ ] stacking/priority/suppression 처리
- [ ] authoritative dice engine 및 기본 주사위 표현식 지원
- [ ] 일반/이점/불리점 및 상쇄 지원
- [ ] flat modifier / dice modifier / set/min/max/multiply primitive 지원
- [ ] set membership/proficiency/resistance 등 non-numeric rule grants 지원
- [ ] ActionGrant / Permission / Restriction / Trigger 기반 구현
- [ ] RulesProfile-driven action economy ledger 구현
- [ ] Action legality + economy/resource cost 검증 구현
- [ ] 공격, 세이브, 피해, 치유 기본 Resolution 지원
- [ ] typed damage와 resistance/immunity/vulnerability 지원
- [ ] 치명타와 RulesProfile별 계산 규칙 지원
- [ ] 조건/효과/자원 변화 지원
- [ ] reaction/optional choice를 위한 `awaiting_choice` Resolution 지원
- [ ] state transaction + CombatEvent 생성
- [ ] transaction-style Undo 기반 마련
- [ ] 동일 입력/주사위/선택으로 동일 calculation/provenance breakdown 재구성 가능

### Phase 4 — Combat UX / Dice / Log

- [ ] 플레이 중 Character edit form보다 행동/상태 중심 화면 우선
- [ ] RulesProfile-defined action economy strip 표시
- [ ] Action card가 cost/availability/unavailable reason을 표시
- [ ] 대상 선택 → 행동 선택 → 필요한 결정 → 결과의 짧은 흐름 구현
- [ ] 시각적 주사위 굴림 제공
- [ ] 애니메이션은 authoritative 결과 그대로 렌더링
- [ ] 애니메이션 skip/reduced-motion 제공
- [ ] Roll20/FVTT에서 영감을 받은 compact combat log 제공
- [ ] 로그 확장 시 주사위 면, formula, modifier source, target defense, typed damage adjustment, HP/economy/resource 변화 표시
- [ ] `왜 +N인가`, `왜 절반인가`, `왜 지금 사용할 수 없는가`를 UI만 보고 추적 가능
- [ ] 효과 출처와 지속시간/상태를 전투 화면에서 빠르게 확인 가능

### Phase 5 — LAN / Hamachi Session

- [ ] 같은 Wi-Fi에서 DM PC가 세션 호스트가 될 수 있음
- [ ] Hamachi 가상 LAN에서도 동일한 접속 방식 사용
- [ ] 플레이어가 DM 주소를 입력해 한 번에 세션 연결
- [ ] Character 원본은 계속 플레이어 로컬에 유지
- [ ] DM은 session projection과 encounter state만 유지
- [ ] CombatEvent/event ID를 실시간 전송
- [ ] 주사위 결과/로그/stat/economy/resource 상태 변화가 참가자 사이에서 일관되게 동기화
- [ ] 선택/반응 요청이 올바른 소유자에게 전달
- [ ] 세션 종료 또는 연결 실패가 플레이어 로컬 Character 원본을 손상시키지 않음

### Phase 6 — 안정성 및 배포

- [ ] WebSocket 연결 끊김 시 자동 재접속
- [ ] 중복/누락 event를 줄이기 위한 event ID 및 재동기화
- [ ] 잘못된 네트워크/Import 데이터가 로컬 Character 파일을 손상시키지 않도록 검증
- [ ] cyclic derivation / broken reference / invalid rule mechanic 검증
- [ ] Schema migration 및 오래된 Combatant/Character 데이터 처리
- [ ] Windows 배포 패키지 생성
- [ ] 새 PC에서 Character 생성 → Combatant Import → 세션 참가 → 전투 Resolution 흐름 검증
- [ ] 최소 1명의 DM과 2명 이상의 플레이어 환경에서 LAN/Hamachi 실제 플레이 테스트

## MVP 완료 조건

- [ ] 플레이어가 Guided 또는 Quick Create로 자신의 PC에서 Character를 생성할 수 있다.
- [ ] 작성 중 종료해도 draft가 복구된다.
- [ ] source 값 변경 시 파생 계산을 다시 손으로 입력하지 않아도 된다.
- [ ] 주요 계산값은 `최종값 + source-by-source contribution`으로 확인할 수 있다.
- [ ] 적용되지 않은 contribution도 stacking/predicate 이유를 필요한 경우 확인할 수 있다.
- [ ] feat/spell/equipment/condition의 계산 가능한 능력은 structured mechanics로 관리된다.
- [ ] 완성 Character의 RuleSource/Action/Effect/Resource가 바로 전투 Resolver에 사용된다.
- [ ] 플레이어가 자신의 PC에서 Character를 수정/저장/내보내기/가져오기 할 수 있다.
- [ ] DM이 계산에 필요한 Combatant 스탯블록을 JSON으로 Import하고 검증/리뷰할 수 있다.
- [ ] 외부 AI가 제공된 Schema/Template/Guide를 이용해 Import 가능한 Combatant JSON을 생성할 수 있는 명확한 authoring path가 있다.
- [ ] DM이 자신의 PC에서 encounter/session을 연다.
- [ ] 플레이어들이 같은 Wi-Fi 또는 Hamachi를 통해 DM PC에 접속한다.
- [ ] 플레이어는 자신의 로컬 Character를 선택해 세션에 참가한다.
- [ ] 시스템이 현재 action economy와 resource 상태를 추적한다.
- [ ] Action 사용 가능 여부를 economy/resource/condition/restriction 기준으로 자동 판단하고 이유를 설명한다.
- [ ] 플레이어가 대상과 행동을 고르면 known modifier/effect/defense를 자동으로 수학 처리한다.
- [ ] 공격/세이브/typed damage/치명타/저항·면역·취약/temporary HP 기본 조합을 수동 산수 없이 처리한다.
- [ ] 선택형 반응/자원 사용은 사용자에게 묻고 선택 후 계산을 이어간다.
- [ ] action economy/resource 소비는 전투 결과와 같은 CombatEvent transaction에 기록된다.
- [ ] 시각적 주사위가 엔진 결과를 표시하고 동일 결과가 로그에 기록된다.
- [ ] 로그를 확장하면 동일 provenance data로 계산 근거와 각 RuleSource를 확인할 수 있다.
- [ ] 주요 상태 변경은 CombatEvent로 기록되고 안전한 범위에서 Undo할 수 있다.
- [ ] Undo 시 관련 HP/resource/economy 상태가 일관되게 복구된다.
- [ ] 세션 종료 후 플레이어 Character 변경사항은 로컬에 남는다.
- [ ] DM PC에는 플레이어 Character의 영구 원본이 필요하지 않다.

## MVP 이후 후보

- [ ] 같은 LAN의 세션 자동 발견
- [ ] 최근 접속한 DM 주소 기억
- [ ] GM PIN 또는 간단한 세션 접근 제어
- [ ] 더 복잡한 주사위 문법 (`kh`, `kl`, reroll 등)
- [ ] 고급 condition predicate와 더 많은 RuleSource mechanic primitive
- [ ] 선택적 세션 로그 export/import
- [ ] Character/Combatant 백업/복구 UX 개선
- [ ] 사용자가 만든 Action/Effect/RuleSource preset 공유
- [ ] Character 생성용 선택적 외부 AI authoring 보조 흐름 검토
- [ ] 사용자 경험이 충분히 검증된 뒤에만 추가 편의 기능 검토

## 의도적으로 제외하는 범위

- 클라우드 계정 및 중앙 Character 서버
- 친구/소셜 시스템
- 음성 또는 텍스트 채팅
- 전투 맵, 토큰, 포그 오브 워
- 캠페인 위키
- 대규모 독점 몬스터/주문 콘텐츠 데이터베이스 번들
- 앱 내부 AI 모델 또는 AI 서비스 의존
- arbitrary executable rule scripts
- 범용 Foundry VTT 대체 기능
