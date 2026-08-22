# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded product code head: **`463fb6e fix(ready): broadcast local host trigger clears`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. 이 저장소가 `work/SimpleVTT-v1` worktree인지 확인한다.
2. `git branch --show-current`가 `work/v1-composite`인지 확인한다.
3. `git status --short`로 사용자 변경 사항이 있는지 먼저 확인한다.
4. `DEFERRED_FIXES.md`의 미해결 owner-playtest blocker를 확인한다.
5. 이 문서의 **바로 다음 작업**을 수행한다.
6. 완료 후 exact SHA와 검증 결과를 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에 갱신한다.

`CURRENT_WORK.md`와 `SHORT_TERM_CHECKLIST.md`의 Phase 09 내용은 역사 자료다. 현재 다음 작업을 선택할 때 이 문서보다 우선하지 않는다.

## 2. 현재 Ready 작업 묶음 — 구현 완료

현재 작업 축은 **공식 기본 행동 Ready의 실제 수명주기와 연결 세션 권위 처리**다.

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
- Ready configuration은 이제 adapter당 단일 값이 아니라 **actor별 Map**으로 저장된다.
- 다중 Ready가 존재할 때 actor 없는 getter는 임의 actor를 선택하지 않고 `undefined`를 반환한다.
- 각 actor의 Ready trigger는 같은 canonical action id를 유지하되 actor별 action list에 독립적으로 투영된다.

### 연결 세션

- `ActionRequest`가 준비 행동 설정을 Host로 전달한다.
- Host는 요청 actor와 준비 설정 actor의 일치를 검증한다.
- Host가 `ready-action`의 `armed`/`cleared` lifecycle event를 authoritative ledger에 기록한다.
- Client는 해당 이벤트로 actor별 상태, 설정, 행동 경제를 투영한다.
- 다음 자기 턴 시작의 만료는 `ready-lifecycle=next-turn-start` clear로 전파한다.
- initiative 종료의 만료는 `ready-lifecycle=initiative-ended` clear로 전파한다.
- 이벤트 순서는 `mode-transition` 이후 actor-id 정렬된 `ready-action: cleared`로 결정적이다.
- Host가 자기 UI에서 직접 Ready trigger를 발동해도 clear event를 배포한다.
- Remote projected Character resolution context는 요청 actor를 `activeCharacter`와 `selectedActorId`로 활성화하므로 다중 Ready에서도 actor가 섞이지 않는다.
- cursor replay와 중복 이벤트 적용은 idempotent하게 처리한다.
- Client가 A actor clear를 적용해도 B actor Ready configuration은 유지한다.
- 새 Host/Join 세션 시작과 `resetConnectedSessionTransientState`는 이전 세션의 모든 Ready configuration을 제거한다.
- 일시적 reconnect 중에는 Ready를 임의 삭제하지 않고 authoritative ledger replay가 복구하도록 유지한다.

### 이번 슬라이스 관련 커밋

- `c92093f` — expire local ready configuration with turn lifecycle
- `05a0ed0` — propagate lifecycle expiration through connected turns
- `5ba3fbe` — cover lifecycle configuration expiration
- `4bed838` — assert connected lifecycle clear ordering
- `52954bc` — keep connected clear replay idempotent
- `398a38c` — validate canonical connected-session branch in Phase 12 CI
- `bd13475` — store Ready configurations per actor
- `e95ef7c` — materialize actor triggers in runtime Scene
- `98091e4` — route connected readiness by actor
- `f6867c8` — propagate lifecycle clears for every actor
- `45e1c10` — expire turn state per actor
- `330c4cf` — isolate connected Ready state by actor and session
- `2b1fc2f` — actor-specific lifecycle clear ordering tests
- `b4259e3` — connected actor clear preservation tests
- `053ddfc` — actor-specific state/session cleanup tests
- `1fa5fe2` — add actor-specific Ready test to canonical Phase 12 CI
- `463fb6e` — broadcast local Host trigger clears

## 3. 완료된 Ready 만료 네트워크 전파

완료 조건:

- [x] Host의 `endTurn` 후 준비 상태가 만료되면 `ready-action` `cleared` 이벤트를 생성한다.
- [x] 해제 사유를 `next-turn-start`로 구분한다.
- [x] `endInitiative`로 만료되면 해제 사유를 `initiative-ended`로 구분한다.
- [x] mode-transition과 ready clear의 이벤트 순서를 고정한다.
- [x] Client가 clear 이벤트를 받아 actor 상태, 설정, 행동 경제를 함께 정리한다.
- [x] catch-up/reconnect replay에서 같은 ledger 순서를 재생한다.
- [x] 이미 반응으로 발동되어 해제된 준비 행동은 turn lifecycle에서 두 번째 clear를 만들지 않는다.
- [x] 중복 replay가 상태를 두 번 변경하지 않는다.

주요 파일:

- `src/app/connectedTurnRoutingAdapter.ts`
- `src/app/phase09EffectAwareTurnAdapter.ts`
- `src/app/connectedActionRoutingAdapter.ts`
- `src/app/connectedSessionRuntimeAdapter.ts`
- `src/app/standardActionReadyState.ts`
- `src/app/standardActionReactionAdapter.ts`
- `tests/ui/connectedReadyActionProjection.test.ts`
- `tests/ui/connectedTurnProjection.test.ts`
- `tests/ui/readyActionActorState.test.ts`
- `tests/ui/standardActionLifecycle.test.ts`

## 4. 바로 다음 작업 — Ready capability negotiation + two-instance evidence

actor ownership과 session cleanup은 구현했다. 다음에는 protocol compatibility와 실제 두 앱 증거를 닫는다.

- [x] 준비 상태를 adapter당 단일 값이 아니라 actor별 상태로 변경한다.
- [x] 세션 종료/reset 및 새 Host/Join 세션 시작 시 준비 설정을 제거한다.
- [ ] `ready-action-v1` capability를 handshake에 명시할지 결정하고 필요한 호환성 테스트를 추가한다.
  - 현재 `CONNECTED_CAPABILITIES`에는 lobby 의미의 `ready-intent-v1`은 있으나 Ready Action lifecycle capability는 별도 선언하지 않는다.
  - protocol version을 올릴지, 기존 version 안에서 required capability로 추가할지 먼저 계약을 결정한다.
- [ ] Host/Client 두 인스턴스에서 준비 설정, 발동, 만료, reconnect를 실제로 증명한다.
  - Host local Ready와 remote Player Ready를 모두 포함한다.
  - 두 actor가 동시에 Ready인 상태에서 한 actor만 trigger/expire되는 케이스를 포함한다.
  - reconnect catch-up 뒤 상태/config/economy가 Host와 동일한지 확인한다.

관련 구현 파일:

- `src/app/connectedSessionProtocol.ts`
- `src/app/connectedSessionWire.ts`
- `src/app/connectedSessionRuntimeAdapter.ts`
- `src/app/connectedActionRoutingAdapter.ts`
- `tests/ui/connectedSessionProtocol.test.ts`
- `tests/ui/connectedSessionWire.test.ts`
- `tests/ui/connectedReadyActionProjection.test.ts`
- `.github/workflows/phase12-connected.yml`

## 5. 전체 V1 작업 현황 요약

정확한 gate와 의존성은 `V1_RELEASE_EXECUTION_CHECKLIST.md`를 사용한다. 아래는 현재 코드와 오래된 체크리스트 사이의 차이를 포함한 재개용 요약이다.

| 묶음 | 현재 판단 | 다음 증거/작업 |
| --- | --- | --- |
| V1-00 Git baseline | DONE | canonical marker와 branch 고정 완료 |
| V1-01 Foundation | PARTIAL | Windows Live Dev에서 Tauri 실행 확인; exact-head full build/regression artifact 증거는 계속 필요 |
| V1-10~12 Campaign/calendar/rations | PARTIAL | 구현 존재; exact-head 회귀와 실제 저장/재실행 walkthrough 필요 |
| V1-13 Stash/DM Library | IMPLEMENTED, CHECKLIST STALE | 파티 보관함 이동, DM Library JSON/이미지/NPC/아이템 구현을 exact-head로 재검증하고 상태 갱신 |
| V1-20~21 Local play | PARTIAL | 기본 행동/Ready lifecycle 구현; 전체 세션 walkthrough와 규칙 source 보강 필요 |
| V1-30~32 Connected play | PARTIAL, ACTIVE | Ready actor/reset 구현 완료; capability negotiation + two-instance/reconnect 증거 필요 |
| V1-40 DM live operation | PARTIAL | 지급/회수, XP, 레벨업, stash 흐름의 exact-head 통합 검증 필요 |
| V1-41 Mapless/module | PARTIAL | provider lifecycle과 stale fact 제거 검증 필요 |
| V1-42 Dice | PARTIAL | 카메라 뒤 투척 물리 연출의 최종 acceptance 필요 |
| V1-50+ Release | TODO | 전체 회귀, Windows artifact, human acceptance, canonical promotion |

Ready 묶음 이후 권장 순서:

1. Ready capability/two-instance acceptance 완료.
2. `V1_RELEASE_EXECUTION_CHECKLIST.md`를 현재 exact head 증거로 조정.
3. Party Stash와 DM Library를 exact-head에서 재검증해 V1-13 상태 확정.
4. mapless provider lifecycle과 거리 blocker 비활성화를 고정.
5. Connected two-instance 전체 사용자 여정과 reconnect를 통과.
6. DM live operation, dice presentation, persistence, release gate 순으로 닫기.

## 6. 검증 상태

현재 canonical Phase 12 workflow는 `work/v1-composite` push를 직접 검증하도록 수정되어 있으며 focused connected suite에 다음 Ready 회귀를 포함한다.

- `tests/ui/connectedTurnProjection.test.ts`
- `tests/ui/connectedReadyActionProjection.test.ts`
- `tests/ui/readyActionActorState.test.ts`
- `tests/ui/standardActionLifecycle.test.ts`
- 기존 connected protocol/session/reconnect/production suites
- `npm run build`
- Windows `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- Windows `npm run tauri:build -- --no-bundle`

이 작업 세션에서 GitHub connector의 status API는 push-triggered Actions check-run을 노출하지 않았고 workflow-run endpoint도 지원하지 않았다. 따라서 **이번 exact-head CI를 green이라고 기록하지 않는다.** 테스트 코드와 canonical CI wiring은 저장소에 존재하지만, pass/fail run evidence는 다음 작업에서 Actions UI 또는 지원되는 run API로 별도 확보한다.

별도 환경 증거:

- 2026-08-23 Windows 사용자 환경에서 SimpleVTT Live Development bootstrap이 Node/npm, Rust/Cargo, MSVC까지 구성하고 `tauri dev` 앱 실행에 성공했다.
- `.live-dev/**`는 Vite watch와 Git tracking에서 제외되어 개발 런타임 다운로드가 HMR/auto-sync를 오염시키지 않는다.

## 7. 알려진 설계 주의점

- Ready configuration은 Character/Campaign durable state가 아니라 Session transient state다.
- Ready configuration은 actor별이며, actor 없는 getter는 configuration이 정확히 하나일 때만 호환 fallback을 제공한다.
- `action.standard.ready.trigger` action id 자체는 UI/프로토콜 호환을 위해 actor마다 동일하게 유지한다. 실행 시 selected/active projected actor context로 disambiguate한다.
- 원격 projected Character context는 resolution 동안 해당 character를 selected/active actor로 올리고 종료 후 복원한다.
- 원격 Ready 설정은 일반 resolution이 아니라 lifecycle event로 배포하는 현재 구조가 의도된 경로다.
- 준비 이동은 map provider가 없는 경우 선언만 기록한다.
- 숨기의 고정 DC 15는 임시 구현이다. ruleset/module source가 준비되면 교체해야 한다.
- `V1_RELEASE_EXECUTION_CHECKLIST.md`의 V1-13 등 일부 상태는 실제 최근 구현보다 오래되었다. 코드 존재만 보고 DONE 처리하지 말고 exact-head 테스트와 walkthrough 증거를 붙인다.

## 8. 문서 갱신 규칙

각 작업 커밋 후 다음 에이전트가 추측하지 않도록 최소한 아래를 갱신한다.

- 상단 recorded code head
- 완료된 체크박스
- 바로 다음 작업 하나
- exact test command와 결과
- 새로 발견한 제한 또는 owner-playtest blocker
