# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded code head: **`dc4bca6 feat(session): project ready lifecycle events`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. 이 저장소가 `work/SimpleVTT-v1` worktree인지 확인한다.
2. `git branch --show-current`가 `work/v1-composite`인지 확인한다.
3. `git status --short`로 사용자 변경 사항이 있는지 먼저 확인한다.
4. `DEFERRED_FIXES.md`의 미해결 owner-playtest blocker를 확인한다.
5. 이 문서의 **바로 다음 작업**을 수행한다.
6. 완료 후 exact SHA와 검증 결과를 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에 갱신한다.

`CURRENT_WORK.md`와 `SHORT_TERM_CHECKLIST.md`의 Phase 09 내용은 역사 자료다. 현재 다음 작업을 선택할 때 이 문서보다 우선하지 않는다.

## 2. 지금까지 구현한 현재 작업 묶음

현재 작업 축은 **공식 기본 행동의 실제 수명주기와 연결 세션 권위 처리**다.

### 로컬 세션 행동

- 행동 카테고리에서 공격, 질주, 철수, 회피, 도움, 숨기, 준비, 수색, 물체 사용을 선택한다.
- 능력 판정과 상황형 행동은 선택 창에서 실제 기술 굴림으로 이어진다.
- 도움은 다음 능력 판정 또는 다음 공격에 이점을 주고 사용 후 소모된다.
- 숨기는 임시 DC 15 판정 결과를 적용하며 공격 시 종료한다.
- 철수는 현재 턴 종료, 회피와 준비는 다음 자기 턴 시작 또는 이니셔티브 종료 시 해제된다.
- 회피 대상 공격에는 불리점, 회피 중 민첩 내성에는 이점을 적용한다.
- 준비 UI에서 실제 준비할 행동과 트리거 문구를 선택한다.
- 준비 반응은 원래 행동의 대상과 굴림을 실행하되 반응 자원을 소비한다.
- 준비 이동은 선언을 기록한다. 전투맵 provider가 없을 때 좌표를 임의로 변경하지 않는다.

### 연결 세션

- `ActionRequest`가 준비 행동 설정을 Host로 전달한다.
- Host는 요청 actor와 준비 설정 actor의 일치를 검증한다.
- Host가 `ready-action`의 `armed`/`cleared` lifecycle event를 authoritative ledger에 기록한다.
- Client는 해당 이벤트로 상태, 설정, 행동 경제를 투영한다.
- cursor replay와 중복 이벤트 적용은 idempotent하게 처리한다.

### 최근 관련 커밋

- `dc4bca6` — project ready lifecycle events
- `e986c89` — route ready config to host
- `266a6d5` — ready movement reactions
- `c3e8894` — configure prepared ready actions
- `71df1d5` — resolve dodge and ready mechanics
- `60894ff` — enforce standard action lifecycles
- `a107963` — group contextual skill actions
- `a0bc424` — place standard actions in action category
- `4e07e0c` — pin standard actions to dock
- `5c2ac11` — refine sheet and action layout

## 3. 바로 다음 작업 — Ready 만료의 네트워크 전파

현재 로컬 turn lifecycle은 다음 자기 턴 시작과 initiative 종료 때 준비 상태를 해제하지만, 연결 Host가 이 해제를 `ready-action: cleared` 이벤트로 배포하지 않는다. 따라서 원격 Client는 오래된 준비 상태를 계속 표시할 수 있다.

완료 조건:

- [ ] Host의 `endTurn` 후 준비 상태가 만료되면 `ready-action` `cleared` 이벤트를 생성한다.
- [ ] 해제 사유를 `next-turn-start`로 구분한다.
- [ ] `endInitiative`로 만료되면 해제 사유를 `initiative-ended`로 구분한다.
- [ ] mode-transition과 ready clear의 이벤트 순서를 고정한다.
- [ ] Client가 clear 이벤트를 받아 상태, 설정, 행동 경제를 함께 정리한다.
- [ ] catch-up/reconnect replay에서도 같은 결과가 재현된다.
- [ ] 이미 반응으로 발동되어 해제된 준비 행동은 두 번째 clear를 만들지 않는다.
- [ ] 중복 replay가 상태를 두 번 변경하지 않는다.

우선 확인할 파일:

- `src/app/connectedTurnRoutingAdapter.ts`
- `src/app/phase09EffectAwareTurnAdapter.ts`
- `src/app/connectedActionRoutingAdapter.ts`
- `src/app/connectedSessionRuntimeAdapter.ts`
- `src/app/connectedSessionProtocol.ts`
- `tests/ui/connectedReadyActionProjection.test.ts`
- `tests/ui/standardActionLifecycle.test.ts`

## 4. Ready 후속 구조 보강

위 만료 전파를 완료한 뒤 아래 순서로 진행한다.

- [ ] 준비 상태를 adapter당 단일 값이 아니라 actor별 상태로 변경한다.
  - 현재 `readyActionConfigurationFor(adapter)`는 actor 인자가 없어 Host의 복수 actor 준비를 정확히 표현하지 못한다.
- [ ] 세션 종료, 재시작, 연결 해제 시 준비 설정을 확실히 제거한다.
  - `resetConnectedSessionTransientState`가 현재 ready configuration을 직접 정리하지 않는다.
- [ ] `ready-action-v1` capability를 handshake에 명시할지 결정하고 필요한 호환성 테스트를 추가한다.
- [ ] Host/Client 두 인스턴스에서 준비 설정, 발동, 만료, reconnect를 실제로 증명한다.

관련 구현 파일:

- `src/app/standardActionReadyState.ts`
- `src/app/standardActionReactionAdapter.ts`
- `src/app/connectedSessionProtocol.ts`
- `src/app/connectedSessionWire.ts`
- `src/app/connectedActionRoutingAdapter.ts`
- `src/app/connectedSessionRuntimeAdapter.ts`
- `src/app/phase09RealResolutionAdapter.ts`
- `src/app/phase09EffectAwareTurnAdapter.ts`
- `src/app/productionPlayRuntimeAdapter.ts`
- `src/SessionActionDock.tsx`

## 5. 전체 V1 작업 현황 요약

정확한 gate와 의존성은 `V1_RELEASE_EXECUTION_CHECKLIST.md`를 사용한다. 아래는 현재 코드와 오래된 체크리스트 사이의 차이를 포함한 재개용 요약이다.

| 묶음 | 현재 판단 | 다음 증거/작업 |
| --- | --- | --- |
| V1-00 Git baseline | DONE | canonical marker와 branch 고정 완료 |
| V1-01 Foundation | PARTIAL | TypeScript/Vite build green; Windows Rust/Tauri 증거 필요 |
| V1-10~12 Campaign/calendar/rations | PARTIAL | 구현 존재; exact-head 회귀와 실제 저장/재실행 walkthrough 필요 |
| V1-13 Stash/DM Library | IMPLEMENTED, CHECKLIST STALE | 파티 보관함 이동, DM Library JSON/이미지/NPC/아이템 구현을 exact-head로 재검증하고 상태 갱신 |
| V1-20~21 Local play | PARTIAL | 기본 행동 수명주기 구현; 전체 세션 walkthrough와 규칙 source 보강 필요 |
| V1-30~32 Connected play | PARTIAL, ACTIVE | Ready 만료 전파, actor별 상태, reset, two-instance/reconnect 증거 필요 |
| V1-40 DM live operation | PARTIAL | 지급/회수, XP, 레벨업, stash 흐름의 exact-head 통합 검증 필요 |
| V1-41 Mapless/module | PARTIAL | provider lifecycle과 stale fact 제거 검증 필요 |
| V1-42 Dice | PARTIAL | 카메라 뒤 투척 물리 연출의 최종 acceptance 필요 |
| V1-50+ Release | TODO | 전체 회귀, Windows artifact, human acceptance, canonical promotion |

Ready 묶음 이후 권장 순서:

1. Ready actor별 상태/reset/capability/two-instance 완료.
2. `V1_RELEASE_EXECUTION_CHECKLIST.md`를 현재 exact head 증거로 조정.
3. Party Stash와 DM Library를 exact-head에서 재검증해 V1-13 상태 확정.
4. mapless provider lifecycle과 거리 blocker 비활성화를 고정.
5. Connected two-instance 전체 사용자 여정과 reconnect를 통과.
6. DM live operation, dice presentation, persistence, release gate 순으로 닫기.

## 6. 최근 검증 증거

`dc4bca6` 기준:

- Ready/connected focused test 묶음 통과.
- `tsc --noEmit` 통과.
- Vite production build 통과, 428 modules transformed.
- build의 chunk-size 경고만 존재하며 실패는 아니다.

Windows 환경에서 `tsx`가 `os.userInfo()`로 실패하면 임시 preload를 `.tmp/node-os-userinfo-workaround.cjs`에 만들고 아래 방식으로 실행한다. 임시 파일은 테스트 후 제거한다.

```powershell
$env:NODE_OPTIONS='--require ./.tmp/node-os-userinfo-workaround.cjs'
& 'C:\Users\somsn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\tsx\dist\cli.mjs --test tests/ui/connectedReadyActionProjection.test.ts tests/ui/connectedSessionWire.test.ts tests/ui/connectedSessionProtocol.test.ts tests/ui/connectedActionReservation.test.ts tests/ui/standardActionLifecycle.test.ts
```

기본 검증:

```powershell
& 'C:\Users\somsn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\typescript\bin\tsc --noEmit
& 'C:\Users\somsn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\vite\bin\vite.js build
```

## 7. 알려진 설계 주의점

- Ready configuration은 Character/Campaign durable state가 아니라 Session transient state여야 한다.
- 현재 adapter당 단일 Ready configuration은 복수 actor Host에 부족하다. 이 제한을 무시하고 connected acceptance를 완료 처리하지 않는다.
- 원격 Ready 설정은 일반 resolution이 아니라 lifecycle event로 배포하는 현재 구조가 의도된 경로다.
- 준비 이동은 map provider가 없는 경우 선언만 기록한다.
- 숨기의 고정 DC 15는 임시 구현이다. ruleset/module source가 준비되면 교체해야 한다.
- `V1_RELEASE_EXECUTION_CHECKLIST.md`의 V1-13 상태 등 일부 표시는 실제 최근 구현보다 오래되었다. 코드 존재만 보고 DONE 처리하지 말고 exact-head 테스트와 walkthrough 증거를 붙인다.

## 8. 문서 갱신 규칙

각 작업 커밋 후 다음 에이전트가 추측하지 않도록 최소한 아래를 갱신한다.

- 상단 recorded code head
- 완료된 체크박스
- 바로 다음 작업 하나
- exact test command와 결과
- 새로 발견한 제한 또는 owner-playtest blocker

