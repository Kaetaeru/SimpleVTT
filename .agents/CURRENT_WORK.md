# 현재 작업 체크리스트

이 문서는 SimpleVTT 개발에서 에이전트가 현재 상태와 다음 작업을 빠르게 파악하기 위한 살아있는 작업 체크리스트다.

- 이 문서는 **공식 제품 명세가 아니다**.
- 구현에 들어가는 항목은 GitHub Issue로 구체화하고, 전용 브랜치와 Pull Request로 처리한다.
- 공식 UX/설계 계약은 `.agents/`가 아니라 `docs/`, `schemas/`, `templates/`, `examples/` 등 프로젝트 영역에 둔다.
- 세부 구현 내용은 단기 체크리스트에만 유지하고, 장기 체크리스트는 방향과 완료 조건 중심으로 유지한다.
- 단기 항목이 완료되면 장기 항목에서 다음 작업을 끌어와 단기 목록을 갱신한다.

## 제품 중심 원칙

SimpleVTT의 핵심 목표는 **전투에서 사람이 해야 하는 산수를 압도적으로 줄이는 것**이다.

- 수학은 자동화하고 선택은 플레이어/DM에게 남긴다.
- 사용자는 가능한 한 `대상 선택 → 행동 선택 → 필요한 선택만 응답 → 결과 확인` 흐름으로 전투한다.
- 이름이 붙은 주문/기능을 코드에 하드코딩하지 않고, Action + Effect/Modifier + Resolution의 조합으로 처리한다.
- 자동 계산은 항상 펼쳐볼 수 있는 계산 내역을 남긴다.
- 주사위 애니메이션은 엔진이 이미 확정한 결과를 시각화하며 독립적인 난수를 생성하지 않는다.
- 캐릭터 원본은 플레이어 PC가 소유한다.
- DM 호스트는 영구 캐릭터 파일이 아니라 임시 세션/전투 상태를 소유한다.
- Combatant는 계산에 필요한 스탯블록 데이터를 JSON으로 Import할 수 있어야 한다.
- Combatant JSON은 스키마/템플릿/예시/설명서를 제공하여 외부 AI로도 생성하기 쉽게 만들되, 반드시 로컬 검증과 사용자 리뷰를 거친다.

## 현재 상태

- [x] `SimpleVTT` 저장소 생성
- [x] 에이전트 전용 작업 공간 `.agents/` 분리
- [x] `.agents/README.md`에 에이전트 작업 공간의 경계 정의
- [x] 현재 작업 체크리스트 작성
- [x] Issue #1: 에이전트 작업 공간 분리
- [x] Draft PR #2: 에이전트 작업 공간/체크리스트 도입
- [x] Issue #3: 전투 자동화 UX 및 도메인 계약 정의
- [x] `agent/3-combat-ux-contracts`를 PR #2 브랜치 위의 stacked branch로 시작
- [ ] Draft PR #2 검토 후 `main`에 병합
- [ ] Issue #3 설계 산출물 검증 및 별도 Draft PR 생성
- [ ] PR #2 병합 후 Issue #3 PR의 base를 `main`으로 변경
- [ ] 첫 구현 Issue를 생성하고 애플리케이션/엔진 구현 단계 시작

## 단기 체크리스트

단기 범위는 **현재 작업과 다음 2~4개의 PR**이다. 바로 Issue로 전환할 수 있을 정도로 구체적으로 관리한다.

### 1. 저장소 기반 정리 — Issue #1 / PR #2

- [x] 에이전트 지시/작업 문서를 `.agents/`로 격리
- [x] 에이전트 작업 문서와 공식 프로젝트 문서의 경계 명시
- [x] 장기/단기 개발 체크리스트 도입
- [ ] PR #2의 변경 범위와 문서 내용 최종 검토
- [ ] PR #2 병합 및 Issue #1 종료 확인

### 2. 전투 자동화 UX 및 도메인 계약 — Issue #3

- [x] 제품 목표를 `Character Sheet + Dice Roller`가 아니라 `Combat Automation` 중심으로 재정의
- [x] `docs/design/combat-automation-ux.md`에 핵심 전투 UX와 데이터 소유권 원칙 기록
- [x] Character / Combatant Definition / Combatant State / Action / Effect / Resolution / CombatEvent 경계 초안 작성
- [x] Roll20/FVTT형 compact + expandable Roll/Combat log UX 정의
- [x] 주사위 애니메이션과 authoritative dice result를 분리하는 원칙 정의
- [x] 반응/선택형 능력이 Resolution을 잠시 멈출 수 있는 흐름 정의
- [x] transaction-style Undo를 고려한 이벤트 구조 요구사항 정의
- [x] `schemas/combatant.schema.json` 초기 Draft 작성
- [x] `templates/combatant.template.json` 작성
- [x] `examples/combatant.example.json` 작성
- [x] `docs/guides/combatant-json-import.md` 및 AI 변환 프롬프트 패턴 작성
- [ ] JSON Schema 자체 유효성 검증
- [ ] template/example이 Schema를 통과하는지 검증
- [ ] Combatant 참조 무결성/Effect target 등 semantic validation 규칙의 최소 집합 확정
- [ ] Effect/Modifier 연산 우선순위와 Resolution interrupt 지점을 더 구체적으로 확정
- [ ] 초기 지원 D&D RulesProfile 버전 확정
- [ ] Issue #3 Draft PR 생성 및 설계 리뷰

### 3. 애플리케이션 골격 + 순수 도메인 패키지 — 후속 PR

Issue #3가 확정된 뒤 시작한다.

- [ ] Tauri + React + TypeScript 프로젝트 초기화
- [ ] UI와 규칙/계산 코드를 분리할 패키지 경계 작성
- [ ] RulesProfile, Dice, Action, Effect, Resolution, Event의 TypeScript 계약 생성
- [ ] 플레이어 모드와 세션 호스트 모드를 하나의 앱에서 제공할 기본 라우팅 작성
- [ ] 개발·빌드 명령 정리
- [ ] lint, typecheck, test, build 기본 검증 추가
- [ ] GitHub Actions에서 최소 검증이 PR마다 실행되도록 구성
- [ ] 루트 README에 프로젝트 목표와 개발 실행 방법 기록

### 4. 로컬 Character + Combatant 기반 — 후속 PR

- [ ] 플레이어 소유 Character 저장 스키마와 버전 정의
- [ ] Character 생성/목록/수정/삭제 및 안전한 로컬 저장 구현
- [ ] Combatant Definition 로컬 라이브러리 구현
- [ ] Combatant JSON schema validation 구현
- [ ] semantic validation과 Import review 화면 구현
- [ ] Combatant Definition에서 mutable Combatant State 생성
- [ ] 세션 없이 Character와 Combatant를 만들고 다시 열 수 있음

### 5. 첫 전투 계산 Vertical Slice — 후속 PR

하나의 실제 시나리오를 end-to-end로 통과시키되 네트워크는 아직 넣지 않는다.

- [ ] 대상 선택
- [ ] 공격 Action 선택
- [ ] 공격 굴림 + 이점/불리점 상쇄
- [ ] flat/dice attack modifier 적용
- [ ] AC 비교 및 명중 판정
- [ ] 치명타 처리
- [ ] typed damage 계산
- [ ] resistance/immunity/vulnerability 적용
- [ ] temporary HP → HP 순서 적용
- [ ] 전체 계산 내역 생성
- [ ] CombatEvent/transaction 생성
- [ ] Undo
- [ ] 같은 이벤트에서 주사위 표시와 로그 카드 재구성

## 장기 체크리스트

장기 범위는 **MVP 완성까지의 단계와 MVP 이후의 확장 후보**다. 세부 구현은 해당 단계가 단기 범위로 승격될 때 Issue에서 구체화한다.

### Phase 0 — 저장소와 개발 흐름

- [ ] `main`을 항상 실행 가능한 상태로 유지
- [ ] 기능 단위 Issue → 작업 브랜치 → Draft PR → 검증 → 병합 흐름 정착
- [ ] 의존 PR이 있을 때 stacked branch/PR을 사용하되 선행 PR 병합 후 base를 정리
- [ ] 최소 CI(lint/typecheck/test/build) 정착
- [ ] 핵심 UX/설계 결정과 변경 이유가 Issue/PR/docs에서 추적 가능

### Phase 1 — 전투 도메인 및 Import 계약

- [ ] 초기 D&D RulesProfile 확정
- [ ] Character와 Combatant의 소유권/상태 경계 확정
- [ ] Action / Effect / Modifier primitive 확정
- [ ] Resolution ordering 및 reaction/interrupt 규칙 확정
- [ ] CombatEvent와 calculation breakdown 계약 확정
- [ ] versioned Combatant JSON Schema 확정
- [ ] template/example/AI authoring guide 제공
- [ ] JSON structural validation + semantic validation 정책 확정

### Phase 2 — 오프라인 플레이어/DM 준비 앱

- [ ] 플레이어가 세션 없이 Character를 생성하고 수정할 수 있음
- [ ] Character 원본은 플레이어 PC가 소유함
- [ ] 앱 재실행 후에도 Character 상태가 유지됨
- [ ] Character 내보내기/가져오기 제공
- [ ] DM이 Combatant Definition을 JSON으로 Import/검토/저장할 수 있음
- [ ] Combatant Definition에서 encounter state를 만들 수 있음
- [ ] 저장 스키마 변경에 대비한 versioning/migration 기반 마련

### Phase 3 — Rules / Effect / Resolution Engine

- [ ] authoritative dice engine 및 기본 주사위 표현식 지원
- [ ] 일반/이점/불리점 및 상쇄 지원
- [ ] flat modifier / dice modifier / set/min/max/multiply primitive 지원
- [ ] 공격, 세이브, 피해, 치유의 기본 Resolution 지원
- [ ] typed damage와 resistance/immunity/vulnerability 지원
- [ ] 치명타와 RulesProfile별 계산 규칙 지원
- [ ] 조건/효과/자원 변화 지원
- [ ] reaction/optional choice를 위한 `awaiting_choice` Resolution 지원
- [ ] state transaction + CombatEvent 생성
- [ ] transaction-style Undo 기반 마련
- [ ] 동일 입력/주사위/선택으로 동일 calculation breakdown을 재구성 가능

### Phase 4 — Combat UX / Dice / Log

- [ ] 플레이 중 Character edit form보다 행동/상태 중심 화면을 우선 제공
- [ ] 대상 선택 → 행동 선택 → 필요한 결정 → 결과의 짧은 흐름 구현
- [ ] 시각적 주사위 굴림 제공
- [ ] 애니메이션은 엔진의 authoritative 결과를 그대로 렌더링
- [ ] 애니메이션 skip/reduced-motion 제공
- [ ] Roll20/FVTT에서 영감을 받은 compact combat log 제공
- [ ] 로그 확장 시 주사위 면, formula, modifier source, target defense, typed damage adjustment, HP 변화 표시
- [ ] `왜 +N인가`, `왜 절반인가`를 로그만 보고 추적 가능
- [ ] 효과 출처와 지속시간/상태를 전투 화면에서 빠르게 확인 가능

### Phase 5 — LAN / Hamachi Session

- [ ] 같은 Wi-Fi에서 DM PC가 세션 호스트가 될 수 있음
- [ ] Hamachi 가상 LAN에서도 동일한 접속 방식 사용
- [ ] 플레이어가 DM 주소를 입력해 한 번에 세션 연결
- [ ] Character 원본은 계속 플레이어 로컬에 유지
- [ ] DM은 session projection과 encounter state만 유지
- [ ] CombatEvent/event ID를 실시간 전송
- [ ] 주사위 결과/로그/상태 변화가 참가자 사이에서 일관되게 동기화
- [ ] 선택/반응 요청이 올바른 소유자에게 전달
- [ ] 세션 종료 또는 연결 실패가 플레이어 로컬 Character 원본을 손상시키지 않음

### Phase 6 — 안정성 및 배포

- [ ] WebSocket 연결 끊김 시 자동 재접속
- [ ] 중복/누락 event를 줄이기 위한 event ID 및 재동기화
- [ ] 잘못된 네트워크/Import 데이터가 로컬 Character 파일을 손상시키지 않도록 검증
- [ ] Schema migration 및 오래된 Combatant/Character 데이터 처리
- [ ] Windows 배포 패키지 생성
- [ ] 새 PC에서 Character 생성 → Combatant Import → 세션 참가 → 전투 Resolution 흐름 검증
- [ ] 최소 1명의 DM과 2명 이상의 플레이어 환경에서 LAN/Hamachi 실제 플레이 테스트

## MVP 완료 조건

아래 흐름이 별도 클라우드 서비스 없이 안정적으로 동작하면 첫 MVP로 본다.

- [ ] 플레이어가 자신의 PC에서 Character를 미리 생성/수정/저장할 수 있다.
- [ ] DM이 계산에 필요한 Combatant 스탯블록을 JSON으로 Import하고 검증/리뷰할 수 있다.
- [ ] 외부 AI가 제공된 Schema/Template/Guide를 이용해 Import 가능한 JSON을 생성할 수 있는 명확한 authoring path가 있다.
- [ ] DM이 자신의 PC에서 encounter/session을 연다.
- [ ] 플레이어들이 같은 Wi-Fi 또는 Hamachi를 통해 DM PC에 접속한다.
- [ ] 플레이어는 자신의 로컬 Character를 선택해 세션에 참가한다.
- [ ] 플레이어가 대상과 행동을 고르면 known modifier/effect/defense를 자동으로 수학 처리한다.
- [ ] 공격/세이브/typed damage/치명타/저항·면역·취약/temporary HP의 기본 조합을 수동 산수 없이 처리한다.
- [ ] 선택형 반응/자원 사용은 사용자에게 묻고, 선택 후 계산을 이어간다.
- [ ] 시각적 주사위가 엔진 결과를 표시하고 동일 결과가 로그에 기록된다.
- [ ] 로그를 확장하면 계산 근거와 각 modifier/effect source를 확인할 수 있다.
- [ ] 주요 상태 변경은 CombatEvent로 기록되고 안전한 범위에서 Undo할 수 있다.
- [ ] 세션 종료 후 플레이어 Character 변경사항은 로컬에 남는다.
- [ ] DM PC에는 플레이어 Character의 영구 원본이 필요하지 않다.

## MVP 이후 후보

- [ ] 같은 LAN의 세션 자동 발견
- [ ] 최근 접속한 DM 주소 기억
- [ ] GM PIN 또는 간단한 세션 접근 제어
- [ ] 더 복잡한 주사위 문법 (`kh`, `kl`, reroll 등)
- [ ] 고급 조건 predicate와 더 많은 Effect primitive
- [ ] 선택적 세션 로그 export/import
- [ ] Character/Combatant 백업/복구 UX 개선
- [ ] 사용자가 만든 Action/Effect preset 공유
- [ ] 사용자 경험이 충분히 검증된 뒤에만 추가 편의 기능 검토

## 의도적으로 제외하는 범위

아래 항목은 현재 SimpleVTT의 목표가 아니다. 별도의 강한 필요가 생기기 전에는 장기 체크리스트로도 승격하지 않는다.

- 클라우드 계정 및 중앙 Character 서버
- 친구/소셜 시스템
- 음성 또는 텍스트 채팅
- 전투 맵, 토큰, 포그 오브 워
- 캠페인 위키
- 대규모 독점 몬스터/주문 콘텐츠 데이터베이스 번들
- 앱 내부 AI 모델 또는 AI 서비스 의존
- 범용 Foundry VTT 대체 기능
