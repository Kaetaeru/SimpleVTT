# 현재 작업 체크리스트

이 문서는 에이전트가 현재 우선순위를 빠르게 파악하기 위한 비공식 작업 문서다. 공식 제품/아키텍처 계약은 `docs/`, `rules/`, `content/`, `schemas/`, `templates/`, `examples/`에 둔다.

## 현재 상태

- [x] 제품/아키텍처 canonical 설계 통합
- [x] Common Rule Definition Specification `0.1-draft`
- [x] 초기 RulesProfile: **D&D SRD 5.2.1 / CC-BY-4.0**
- [x] RulesProfile identity: `dnd.srd-5.2.1` / `0.1-draft`
- [x] 한국어-first localization: `ko-KR`, 기준 `Kaetaeru/D-D-2024-`
- [x] Issue #34 / PR #35 executable rules contracts 병합
- [x] UI/UX canonical planning through v0.8
- [x] UI Session 01 reference HTML walkthrough design
- [x] Issue #36 작업 브랜치 `agent/36-ui-session-01` 생성
- [x] Tauri 2 + React + TypeScript application scaffold
- [x] application-facing contracts + replaceable `MockAdapter`
- [x] Player Character sheet / create / level-up UI first implementation
- [x] Player Scene / DM Session / Catalog / Activity / Session / Settings first implementation
- [x] reference-only Debug Dock separation (`Ctrl+Shift+D`)
- [ ] UI CI green
- [ ] owner Windows `tauri dev` walkthrough
- [ ] owner-requested UI revisions
- [ ] UI Session 01 explicit acceptance
- [ ] semantic validator + additional golden scenarios
- [ ] representative Korean SRD content bootstrap
- [ ] React-independent TypeScript rules/domain package
- [ ] incrementally replace MockAdapter paths with real services

## 현재 Gate

```text
Executable Contracts ✅
        ↓
UI Session 01 ← current
        ↓
Owner Windows walkthrough + revisions
        ↓
Owner explicit acceptance
        ↓
Semantic validation + representative SRD content
        ↓
Real TypeScript domain / persistence / networking adapters
```

## UI Session 01 원칙

- `main`은 안정 상태로 유지한다.
- 작업은 `agent/36-ui-session-01`에 누적한다.
- 사용자는 필요할 때 로컬에서 해당 브랜치를 pull하여 Windows/Tauri 환경으로 직접 검증한다.
- 정상 Player/DM 화면에는 reference 테스트 조작을 노출하지 않는다.
- 역할, 세션 모드, 현재 Actor, queued d20, 연결 상태 강제 변경은 Debug Dock에만 둔다.
- UI는 component-local mock fixture를 직접 변경하지 않고 application adapter 계약을 사용한다.
- UI Session 01 동안 Resolver, 실제 WebSocket, production persistence를 UI 편의를 위해 React에 임시 구현하지 않는다.
- owner 승인 전에는 Issue #36/PR을 완료 또는 merge하지 않는다.

## 다음 구현 순서

1. GitHub Actions UI typecheck/build green 만들기
2. Windows `npm run tauri:dev` owner walkthrough
3. Character create/level-up 실제 UX 수정
4. Player Scene targeting/resolution/reaction 상세화
5. DM adjudication/Undo/correction 상세화
6. Combatant JSON import/review/instantiate UI 상세화
7. Rules Catalog JSON import/validation/review UI 상세화
8. empty/error/reconnecting/unsupported edge states
9. owner acceptance

## 이후 원칙

실제 플레이/구현에서 표현 불가능하거나 불편한 경우:

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. UX는 domain contract와 가능한 한 분리해서 빠르게 수정한다.
