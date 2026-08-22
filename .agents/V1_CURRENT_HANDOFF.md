# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded product code head: **`f3ca88d feat(session): negotiate Ready Action capability`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `git branch --show-current`가 `work/v1-composite`인지 확인한다.
2. `git status --short`로 사용자 변경 사항을 먼저 확인한다.
3. `DEFERRED_FIXES.md`의 owner-playtest blocker를 확인한다.
4. 이 문서의 **바로 다음 작업**을 수행한다.
5. 완료 후 exact SHA와 검증 결과를 이 문서와 release checklist에 갱신한다.

`CURRENT_WORK.md`와 `SHORT_TERM_CHECKLIST.md`의 Phase 09 내용은 역사 자료다.

## 2. Ready 구현 상태 — 코드 완료, two-instance 증거 대기

### 로컬 Ready

- Ready는 실제 준비 행동과 트리거 문구를 저장한다.
- 준비 반응은 원래 행동의 대상/굴림을 실행하며 Reaction을 소비한다.
- 준비 이동은 map provider가 없으면 이동 선언만 기록하고 좌표를 만들지 않는다.
- Ready는 다음 자기 턴 시작 또는 initiative 종료 때 만료된다.
- Ready configuration은 `WeakMap<MockAdapter, Map<actorId, ReadyActionConfiguration>>`로 actor별 저장된다.
- actor 없는 getter는 configuration이 정확히 하나일 때만 호환 fallback을 반환하고, 여러 actor가 Ready면 `undefined`를 반환한다.
- `action.standard.ready.trigger` ID는 actor마다 동일하게 유지하지만 selected/current/active actor context로 disambiguate한다.
- actor별 trigger는 internal Scene과 Snapshot에 모두 투영되며 stale trigger는 snapshot projection 때 제거한다.
- Ready configuration clear API는 해당 actor의 visible `준비 행동` status도 함께 제거한다.

### Connected Ready

- `ActionRequest`가 Ready configuration을 Host에 전달한다.
- Host는 request actor와 Ready configuration actor가 일치해야 수락한다.
- Host는 `ready-action` `armed`/`cleared` lifecycle event를 authoritative ledger에 기록한다.
- Client는 actor별 Ready config/status/economy를 event로 투영한다.
- 다음 자기 턴 시작 만료는 `ready-lifecycle=next-turn-start`로 전파한다.
- initiative 종료 만료는 `ready-lifecycle=initiative-ended`로 전파한다.
- 순서는 항상 `mode-transition` 이후 actor ID 정렬된 Ready clear 이벤트다.
- Host UI에서 직접 Ready trigger를 발동해도 clear event를 broadcast한다.
- remote projected Character resolution context는 요청 character를 active/selected actor로 활성화한 뒤 복원한다.
- A actor Ready clear가 B actor Ready config/status를 제거하지 않는다.
- 새 Host/Join 세션 및 explicit session reset은 모든 Ready config/status를 제거한다.
- transient reconnect에서는 Ready를 임의 삭제하지 않고 ledger catch-up이 authority다.
- duplicate event replay는 cursor/event ID로 idempotent하다.

### Capability contract

- `ready-intent-v1`은 lobby Ready 의미이며 Ready Action과 별개다.
- **`ready-action-v1`**을 `CONNECTED_CAPABILITIES`의 required capability로 추가했다.
- protocol version은 **v1 유지**다. 기존 `compareSessionCompatibility`가 Host의 required capability가 Client에 없으면 incompatible로 거부하므로 별도 protocol bump가 필요하지 않다.
- ActionRequest도 동일한 `CONNECTED_CAPABILITIES` 목록을 보내며 Host가 required capability 누락을 거부한다.
- wire decoder는 capability를 일반 `string[]`로 검증하므로 새 wire schema version은 필요하지 않다.

## 3. 이번 Ready 슬라이스 핵심 커밋

- `c92093f` — expire local ready configuration with turn lifecycle
- `05a0ed0` — propagate lifecycle expiration through connected turns
- `bd13475` — store Ready configurations per actor
- `e95ef7c` — materialize actor triggers in runtime Scene
- `98091e4` — route connected readiness by actor
- `f6867c8` — propagate lifecycle clears for every actor
- `45e1c10` — expire turn state per actor
- `330c4cf` — isolate connected Ready state by actor/session
- `463fb6e` — broadcast Host-local trigger clears
- `989060b` — clear visible Ready status with configuration
- `f3ca88d` — negotiate `ready-action-v1`

Focused tests:

- `5ba3fbe` — local lifecycle config expiration
- `2b1fc2f` — deterministic actor-specific connected lifecycle ordering
- `b4259e3` — one actor clear preserves another actor
- `053ddfc` / `bccf9f2` — actor-specific state + session visible cleanup
- `fd04021` — required Ready capability compatibility
- `ba9e964` — runtime manifest advertises Ready capability

CI wiring:

- canonical `work/v1-composite` push is included in `.github/workflows/phase12-connected.yml`.
- focused connected suite includes Ready lifecycle, actor-specific state, protocol/session, reconnect and production connected tests.
- this session's GitHub connector does not expose push-triggered Actions check-run results, so **do not record exact-head CI as green without separate run evidence**.

## 4. 바로 다음 작업 — 실제 두 인스턴스 Ready acceptance

코드/프로토콜 구조 보강은 완료했다. 이제 실제 Windows Host/Client 두 앱에서 아래를 증명한다.

- [ ] Host와 Client가 `ready-action-v1` manifest로 compatible handshake한다.
- [ ] remote Player가 Ready 설정 → Host와 Client 양쪽에서 같은 actor/config/status/economy를 본다.
- [ ] Host local actor와 remote Player가 동시에 Ready를 보유할 수 있다.
- [ ] 한 actor만 trigger했을 때 그 actor만 Reaction 소비 + Ready clear되고 다른 actor Ready는 유지된다.
- [ ] trigger 없이 다음 자기 턴이 오면 `next-turn-start` clear가 양쪽에 동일하게 적용된다.
- [ ] initiative 종료 시 남은 모든 Ready가 deterministic clear된다.
- [ ] Client 연결을 끊고 reconnect하면 cursor catch-up 후 Ready config/status/economy가 Host와 동일하다.
- [ ] 같은 catch-up event 재수신이 상태를 두 번 변경하지 않는다.
- [ ] explicit session end/restart 후 이전 Ready config/status가 남지 않는다.

권장 다음 구현/증거 파일:

- `src/app/tauriSessionTransport.ts`
- `src/app/connectedSessionRuntimeAdapter.ts`
- `src/app/connectedActionRoutingAdapter.ts`
- `tests/ui/productionClientReconnect.test.ts`
- `tests/ui/productionHelloReplayIdempotency.test.ts`
- `tests/ui/connectedReadyActionProjection.test.ts`
- `.github/workflows/phase12-connected.yml`

가능하면 수동 반복을 줄이기 위해 two-instance acceptance launcher 또는 deterministic desktop smoke harness를 먼저 만든다.

## 5. 전체 V1 요약

| 묶음 | 현재 판단 | 다음 증거/작업 |
| --- | --- | --- |
| V1-00 Git baseline | DONE | canonical branch 고정 완료 |
| V1-01 Foundation | PARTIAL | Windows Live Dev/Tauri 실행 확인; exact-head full regression/artifact 필요 |
| V1-10~12 Campaign systems | PARTIAL | exact-head 회귀 + 저장/재실행 walkthrough 필요 |
| V1-13 Stash/DM Library | IMPLEMENTED, CHECKLIST STALE | exact-head 검증 후 checklist 갱신 |
| V1-20~21 Local play | PARTIAL | Ready mechanics 구현; 전체 session walkthrough 필요 |
| V1-30~32 Connected play | PARTIAL, ACTIVE | Ready code/capability 완료; two-instance/reconnect 증거 필요 |
| V1-40 DM live operation | PARTIAL | Campaign 연동 통합 검증 필요 |
| V1-41 Mapless/module | PARTIAL | provider lifecycle/stale fact 검증 필요 |
| V1-42 Dice | PARTIAL | 최종 human acceptance 필요 |
| V1-50+ Release | TODO | 전체 회귀, Windows artifact, acceptance, promotion |

## 6. 환경/검증 메모

- 2026-08-23 Windows 사용자 환경에서 `Start SimpleVTT Live.cmd`가 private Node/npm, private Rust/Cargo, MSVC Build Tools를 준비하고 `tauri dev`를 실행하는 것까지 확인했다.
- `.live-dev/**`는 Git/Vite watch에서 제외되어 runtime bootstrap이 auto-sync/HMR을 오염시키지 않는다.
- `src-tauri/Cargo.lock`은 현재 저장소 정책상 local generated file로 ignore한다.
- Phase 12 workflow는 Ubuntu connected protocol/build gate + Windows cargo/Tauri build gate를 가진다.
- connector가 Actions run을 노출하지 않는 한 코드 존재와 test source만으로 green/DONE을 주장하지 않는다.

## 7. 설계 주의점

- Ready는 Character/Campaign durable state가 아니라 Session transient state다.
- `ready-action-v1`과 lobby `ready-intent-v1`을 혼동하지 않는다.
- Ready Action lifecycle은 ordinary resolution state가 아니라 Host ledger lifecycle event로 배포한다.
- 준비 이동은 map provider 없이는 위치를 변경하지 않는다.
- 숨기의 DC 15는 임시 구현이다.
- release checklist 일부 상태(V1-13 등)는 최근 코드보다 오래됐다. exact-head evidence 후 갱신한다.
