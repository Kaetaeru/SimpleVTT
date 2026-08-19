# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9 UI-first product replanning**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current planning checkpoint
새 UI-first 기획 문서를 work branch에 생성했다.

- document: `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- planning commit: `3d1507fafbfdeff27d8986fd26f9d815fb6f41dd`
- previous automated-green source: `d942d58a83eb2222ffd722d58b19c67c3dc8de13`

현재 단계는 구현 수정이 아니라 제품 UI 기획 재정립이다. 기존 자동 green evidence는 기술 경계의 기록으로 남기지만, 새 UI 계약과 충돌하는 동작을 제품 완료로 간주하지 않는다.

## Why implementation is paused
Human acceptance와 후속 소스 확인에서 여러 UI 계약 누락이 드러났다.
- 주사위는 데모의 body-level cinematic motion이 아니라 시트 내부 별도 frame으로 렌더링되고 있었다.
- 기존 multiplayer 기획이 `Host preparing / player lobby / Ready / Start`를 제품 기본 흐름으로 전제했다.
- 기본 제품이 거리/LOS를 추적하지 않기로 했는데도 demo attack eligibility가 spatial distance fact에 묶였다.

따라서 화면/행동 흐름을 먼저 확정한 뒤 구현을 재개한다.

## Newly locked product decisions
### Dice
- standalone sheet roll도 body-level cinematic overlay를 사용한다.
- 주사위는 화면 뒤/깊은 곳에서 사용자 쪽으로 날아오는 3D motion을 사용한다.
- 시트 내부에 roll 전용 dice stage/frame을 삽입하지 않는다.

### Multiplayer / DM
- DM이 세션을 여는 순간 세션은 활성 상태다.
- 세션 오픈 직후 DM workspace와 DM tools에 바로 접근한다.
- player 0명이어도 Encounter/Combatant/session editing/handout/Initiative 등 세션 편집이 가능하다.
- player lobby에서 모두 Ready를 기다린 뒤 `플레이 시작`하는 필수 흐름을 사용하지 않는다.
- 플레이어는 이미 열린 세션에 합류한다.
- 내부 handshake/content sync는 필요할 수 있지만 user-facing lobby/start gate로 확장하지 않는다.

### Range / spatial fallback
- 별도 spatial/range module이 없으면 모든 적절한 target은 사정거리 이내로 간주한다.
- `spatial data 없음`은 `out of range`가 아니다.
- 근접 공격을 `5 ft 대상 없음`으로 막지 않는다.
- range/reach/LOS/cover는 module이 authoritative facts를 제공할 때만 constraint로 적용한다.

## Existing architecture still preserved
- one canonical Character; owning Client Character Library durable authority
- Host authoritative connected resolution
- ephemeral Host projections
- ResolutionEvent ledger/reconnect/idempotency/Undo
- installed-content composition/validation
- no second Character/content store or resolver
- no built-in tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency

## Previous validation evidence
`d942d58a...`에서 UI, Rules Domain, Contract validation, Persistence/Tauri, Main Playable, Phase 11, Phase 12 Connected 및 Windows build/stage/upload가 모두 success였다.

이 evidence는 변경 전 구현의 regression 기록으로만 유지한다. UI-first replanning으로 변경되는 화면/flow는 새 acceptance 기준으로 다시 검증해야 한다.

## Next Exact Action
1. source implementation이나 CI를 재개하지 않는다.
2. 사용자와 `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`를 화면별로 계속 확정한다.
3. 우선순위는 Session/DM/Player lifecycle, Character Sheet + dice presentation, freeform/combat interaction이다.
4. 각 화면의 목적, 정보 hierarchy, primary/secondary action, states, errors, responsive/keyboard, human acceptance를 정의한다.
5. 기획 승인 후에만 같은 sequence를 `continue`로 바꾸고 구현 slice를 시작한다.
6. PR #109는 draft/unmerged 유지.

## Dispatch recommendation
`needs_user`
