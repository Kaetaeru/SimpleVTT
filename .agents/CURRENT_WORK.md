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
- [x] Player Character sheet / create / level-up UI
- [x] Character ItemInstance / inventory / provenance interaction prototype
- [x] Player Scene / DM Session / Catalog / Activity / Session / Settings UI
- [x] ViewModel-provided eligible targeting + global targeting overlay
- [x] staged Resolution UI: roll / result / interrupt / damage / apply
- [x] ability check / save / attack / critical / healing / multi-target / typed-defense mock paths
- [x] Initiative economy + Freeform persistent-resource separation
- [x] DM adjudication + real mock Undo/reversal path
- [x] Content JSON import / validation / review / activation prototype
- [x] Combatant JSON import / validation / review / instantiate prototype
- [x] Host / Join / compatibility / connection-state shell
- [x] reference-only Debug Dock separation (`Ctrl+Shift+D`)
- [x] loading / reconnecting / save-error / unsupported reference states
- [x] Light / Dark / Accent / Reduced Motion controls
- [x] responsive Scene layout + Korean IME fixes from initial Windows walkthrough
- [x] UI GitHub Actions typecheck/build green
- [ ] owner full Windows walkthrough of the completed interaction prototype
- [ ] owner-requested final UI revisions
- [ ] UI Session 01 explicit acceptance
- [ ] semantic validator + additional golden scenarios
- [ ] representative Korean SRD content bootstrap
- [ ] React-independent TypeScript rules/domain package
- [ ] incrementally replace MockAdapter paths with real services

## 현재 Gate

```text
Executable Contracts ✅
        ↓
UI Session 01 interaction prototype ✅
        ↓
Owner full Windows walkthrough + final revisions ← current
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
- 역할, 세션 모드, 현재 Actor, queued d20, 연결 상태, edge/scenario 강제 변경은 Debug Dock에만 둔다.
- Target eligibility와 Resolution state는 application adapter/ViewModel에서 제공하며 React가 규칙을 재계산하지 않는다.
- UI Session 01 동안 실제 Resolver, WebSocket, production persistence를 UI 편의를 위해 React에 임시 구현하지 않는다.
- owner 승인 전에는 Issue #36/PR을 완료 또는 merge하지 않는다.

## Owner walkthrough 순서

1. Character 생성/편집을 처음부터 검토까지 완료한다.
2. Aelar 레벨 업 ProgressionDraft를 검토하고 적용/취소를 확인한다.
3. 장비 장착/해제, 조율, 소모품/충전 아이템과 provenance를 확인한다.
4. 홈브루 subclass JSON을 검증/활성화하고 builtin class 관계를 확인한다.
5. Freeform에서 ability/action/no-roll 흐름과 Persistent Resource만 보이는지 확인한다.
6. DM에서 Initiative 시작 후 Actor/Current Turn/action economy/턴 종료를 확인한다.
7. 공격 → 주사위 → Result → Reaction → Damage → StateChange 흐름을 확인한다.
8. Multi-target save와 대상별 결과/피해 조정을 확인한다.
9. DM `상황 / 판정 수정`에서 보정/유불리/강제 결과/상태/피해/자원/대상을 수정한다.
10. Activity Log에서 계산/provenance/DM ruling/StateChange를 확인한다.
11. 안전 Undo로 HP/resource/item/economy가 판정 전 상태로 복원되는지 확인한다.
12. Combatant JSON을 검증/활성화하고 세션 Instance로 추가한다.
13. Host/Join/compatibility와 connected/reconnecting/disconnected 상태를 확인한다.
14. `Ctrl+Shift+D`에서 deterministic scenario와 targeting/resolution debug state를 확인한다.

## 이후 원칙

실제 플레이/구현에서 표현 불가능하거나 불편한 경우:

1. deterministic failing scenario를 만든다.
2. 기존 primitive로 표현 가능한지 먼저 확인한다.
3. 불가능할 때만 최소 Mechanic/Predicate/Timing/Targeting/content primitive를 추가한다.
4. persisted contract 변경이면 schema/version/capability/migration을 함께 갱신한다.
5. 전체 scenario 회귀 검증을 통과시킨다.
6. UX는 domain contract와 가능한 한 분리해서 빠르게 수정한다.
