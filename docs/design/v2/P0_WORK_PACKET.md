# P0 — 개편 착수 작업 패킷

상태: READY TO START, 구현 미완료. 기준: [PRODUCT_RENOVATION.md](PRODUCT_RENOVATION.md).

## 목적

새 캐릭터 모델·세션 모델이 다시 별개의 HP/아이템 원본을 만들지 않음을 작은 작동 여정으로 증명한다.
동시에 기존 ToTM 기회공격 정책과 비공개 데이터 경계를 먼저 고정한다.
T2-02의 전체 주문/직업 기능군 구현이나 전체 화면 리디자인을 이 패킷에 넣지 않는다.

## 시작 전 확인

- live `work/v2-table`, #389, #390, 제품 개편 설계 PR의 head/base/병합 상태를 읽고 기록한다.
- 의존 PR이 미병합이면 그 정확한 head를 기반으로 한 stacked PR임을 명시한다.
- `src/table/{state,runtime,events,facade,project}.ts`, `src/domain/engagement.ts`,
  `src/table/handlers/act.ts`, `src/app/persistenceContracts.ts`,
  `src/app/tauriCharacterLibraryStore.ts`, `src/app/resolutionCharacterDurableProjection.ts`,
  `src/app/resolutionCharacterWriteBackPort.ts`, `src-tauri/src/character_library.rs`를 확인한다.
- 위 파일 경로가 변경됐다면 repository search로 현재 소유자를 찾는다. 동일 기능을 새로 만들지 않는다.
- 개인 생성·성장·저장 실패·연결 복구를 검증하는 기존 테스트를 목록으로 매핑한다.

## 순서와 산출물

### P0a — 재사용/이관 기준

1. 실제 스키마로 만들거나 기존 테스트에서 얻은 캐릭터 fixture를 준비한다: 일반 무기 사용자,
   슬롯 사용자, 수량/충전 아이템 소유자, 멀티클래스/상위 레벨, 누락 콘텐츠가 있는 저장본.
2. 원본·파생값·현재 사용량·출처·revision의 현재 저장 위치를 표로 적고 새 쓰기 권위를 하나씩 지정한다.
3. 새 저장 모델 필요 범위를 결정한다. 화면만을 위해 저장 스키마를 불필요하게 재작성하지 않는다.
4. 복사본 importer의 정상/누락 데이터/실패/중복 실행 테스트를 먼저 만든다. 사용자 실저장본을 수정하지 않는다.

### P0b — 교전 회귀 하나

RED: 근접 공격 빗나감 후에도 교전 쌍이 생긴다. 해당 쌍이 물러남 판단에 쓰인다.
V2의 현재 `attack.outcome === "success"` 조건과 round 정보 누락을 기존 `engagement.ts` 정책과 비교한다.
명중 때만 기록하는 별도 구현을 확장하지 말고 기존 순수 함수를 연결할 최소한의 상태를 마련한다.
근접과 원거리 구분을 단순히 `rangeFeet <= 5`로 추정하지 않고 행동 데이터의 의미를 확인한다.
범위 숫자는 콘텐츠 정보일 뿐 사용자에게 거리를 입력시키지 않는다.
관련 사망/제거/이탈/idle-round 회귀도 함께 검증하되 실제 반응 UI 전체는 P3에서 완성한다.

#### P0b 진행 기록 (2026-09-11)

- RED → GREEN: `tests/table/engagement.test.ts` 3건. 기준 head `962eb416`에서는 `TableState.engagements`가 없어 전부 실패했다.
- 상태: `Actor.engagement: string[]`를 없애고 `TableState.engagements: EngagementRecord[]`(domain 타입) 하나로 바꿨다.
  `applyEvent`는 `rules-committed` / `turn-changed` / `mode-changed`에 실린 기록을 그대로 적용하고,
  `actor-removed`는 `pruneEngagementsToPresent`로 정리한다. 되돌리기는 상태 복원이므로 교전도 함께 돌아간다.
- 근접/원거리: 사거리 숫자로 추정하지 않고 스탯 블록의 표현을 `attackMode`(`melee` / `ranged` / `melee-or-ranged`)로
  `CombatantRuntimeAttackVm` → `runtimeAttack`에 실었다(`srdMonsterCatalog.attackSpec`). 모드가 없을 때만 기존 정책(10피트 이하 = 근접)으로 되돌아간다.
  캐릭터 시트 공격은 아직 이름 기반 원거리 판별을 쓴다(시트 데이터에 공격 종류가 없음 — P1/P2의 시트 모델에서 해결).
- 연결한 순수 함수: `recordMeleeAttack`(명중·빗나감 모두, 자기 자신 제외), `clearEngagementsOf`(이탈, DM 사망 처리),
  `pruneEngagementsToPresent`(사망·제거, 커널 경로의 치명 피해 포함), `pruneIdleEngagements`(라운드 넘어갈 때),
  `engagedWith`/`isEngaged`(투영·토글). 교전 중 원거리 공격은 `engagement:ranged-in-melee` 출처의 불리로 커널에 전달한다.
- 이니셔티브 종료 시 교전은 남고 라운드 도장은 자유 진행 기준(1)으로 정규화한다. 자유 진행의 모든 기록은 1라운드다.
- 투영: 옛 화면이 읽던 `scene.engagements`와 `entity.engagedWithIds`를 채운다(`SessionActorBoards`, `SessionDmTools`가 그대로 교전 선을 그린다).
- 확인한 것: `npm run test:table`(6/6), `tsc --noEmit`, `npm run test:ui-rule-boundary`, `check-legacy-execution-boundary`(UNCLEAR 0),
  SRD 몬스터 카탈로그·옛 교전 어댑터·provider 구조 테스트, `vite build`. Windows H+P1+P2 실행은 하지 않았다(오프라인 커널 범위).
- 남은 것(P3): 물러남 선언 → 교전 상대의 기회공격 질문, 이탈 상태의 억제, 반응 UI. 이 패킷에서는 기록 집합만 고정했다.

### P0c — 개인 ↔ Host ↔ 개인의 좁은 실제 경로

1. 개인 저장본의 사용량 수정 → 저장 → 다시 로드.
2. 해당 revision으로 Host에 actor 등록. 기존 통신 인프라/메시지 라우터와 새 테이블 경계를 연결.
3. 사용량 한 종류를 Host에서 변경 → 수신자별 갱신 → 소유자 저장 확인.
4. 동일 명령 ID 재전송, ACK 손실, 소비 뒤 재접속, 소유자 저장 실패를 재현.
5. 동일 아이템/자원이 중복 적용되지 않으며 저장 확인 전 완료로 표시하지 않음을 확인.
6. 이 실험에 쓰는 UI는 실제 개인 시트/실제 세션 진입 경로의 작은 부분이어야 한다.
   테스트 전용 메모리 객체끼리의 parity만으로 여정을 완료 처리하지 않는다.

### P0d — 비공개와 연출 경계

숨은 NPC/DM Only 굴림을 가진 Host 상태에서 플레이어에게 전송되는 payload 자체를 검사한다.
플레이어 화면이 숨긴다는 이유만으로 전체 `rules`나 undo snapshot을 전송하지 않는다.
같은 event ID 재전송/재접속에서 라이브 이펙트 신호가 한 번만 발생하는지 검증한다.
관련 기존 프라이버시/재접속/연출 테스트를 새 경계에 재사용한다.

## 완료 증거

- 변경 파일과 이전→이후 행동을 보여주는 현재 SHA의 실패/성공 테스트.
- fixture 이관 보고: 보존/변환/사용자 검토 필요 항목과 원본 backup 위치.
- 명령·Host commit·수신 확인·개인 저장 확인의 순서와 중복 처리 결과.
- 실제 앱의 개인 수정→입장→변경→저장 반영 경로 evidence.
- Windows H+P1+P2가 필요한 증거는 해당 환경에서 수행하고, Linux 테스트로 대신 통과했다고 기록하지 않는다.
- 전체 CI를 매 작은 변경마다 반복하기보다 해당 owner 테스트를 실행하고,
  통합 milestone에서 기존 정상 사용자 여정과 함께 넓혀 검증한다.

## 다음

P0에서 권위/저장 경계를 정리한 뒤 P1 개인 시트와 가방을 먼저 사용자에게 작동하는 형태로 제공한다.
그때 기본 스탯 편집과 자동 파생값 읽기 전용, 두 시트 형태의 동일 기능을 검증한다.
생성/성장 공통 draft는 P2에서 확대하고, VFX는 P3의 첫 실전부터 함께 검증한다.
