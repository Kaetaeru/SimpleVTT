# V1 Campaign Systems Specification

Date: 2026-08-22
Status: canonical product/system specification
Parent policy: `docs/design/campaign-runtime.md`

## 1. 전체 시스템 지도

V1 캠페인 기능은 하나의 거대한 상태 객체가 아니라 책임이 분리된 10개 시스템으로 구성한다.

```text
Campaign Aggregate
├─ 1. Campaign Identity / Lifecycle
├─ 2. Campaign Roster
├─ 3. Session Configuration / Snapshot
├─ 4. Calendar / World Time
├─ 5. Ration / Supply Rules
├─ 6. Party Stash / Wallet
├─ 7. Campaign DM Library
├─ 8. Session History / Campaign Journal
├─ 9. Content and Capability Loadout
└─ 10. Spatial / Battle-map Extension State
```

각 시스템은 독립된 revision을 가질 수 있지만 한 Campaign 저장 세대 안에서 원자적으로 커밋된다. UI는 이 시스템들의 직접 저장소가 아니며 명령을 제출하고 projection만 표시한다.

## 2. 공통 원칙

### 소유권

| 데이터 | 영속 소유자 | 세션에서의 권위 | 플레이어 전달 범위 |
| --- | --- | --- | --- |
| Campaign 설정/달력/식량/보관함 | Host의 Campaign 저장소 | Host Session authority | 허용된 projection만 |
| DM Library | Host의 Campaign 저장소 | 명시적 DM 작업만 Session으로 materialize | 원본/비공개 메타데이터 전달 금지 |
| Character | 해당 Player의 Character 저장소 | Session authority가 변경을 순서화 | 소유 Client가 durable write-back |
| Session transient state | 현재 Session | Host Session authority | 권한별 projection |
| Content definitions | 설치된 ContentCatalog | Session 시작 시 loadout 고정 | 호환성에 필요한 manifest/사용 중 정의 |

### 공통 명령 봉투

모든 Campaign 변경 명령은 최소한 다음 정보를 가진다.

```ts
interface CampaignCommandEnvelope<TPayload> {
  requestId: string;
  campaignId: string;
  sessionId?: string;
  initiatedByParticipantId: string;
  expectedCampaignRevision: number;
  kind: string;
  payload: TPayload;
}
```

- `requestId`는 재시도 중복 적용을 막는다.
- revision 불일치는 새 상태를 덮어쓰지 않고 명시적 stale 오류를 반환한다.
- 성공 결과는 Activity와 Campaign history에 같은 provenance로 연결한다.
- Undo는 기록 삭제가 아니라 새 검증을 거치는 보상 명령이다.

### 활성 상태 문법

선택 시스템은 단순 boolean만 저장하지 않고 상태와 공급자를 분리한다.

```ts
interface OptionalCampaignCapability {
  enabled: boolean;
  providerId: string;        // builtin 또는 module capability provider
  providerVersion: string;
  settingsRevision: number;
}
```

`enabled: false`는 저장값 삭제를 뜻하지 않는다. UI, 자동화, 경고와 관련 blocker만 중단한다.

---

# 시스템 1. Campaign Identity / Lifecycle

## 목적

DM이 여러 장기 플레이를 서로 섞지 않고 보관하고, 그 Campaign을 기준으로 세션을 반복 실행하게 한다.

## 저장 데이터

```ts
interface CampaignRecord {
  schemaVersion: number;
  campaignId: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  revision: number;
  lastOpenedAt?: string;
  lastSessionId?: string;
}
```

## DM 작업

- 캠페인 만들기;
- 이름/설명 수정;
- 열기;
- 복제;
- 보관/복원;
- 명시적 삭제.

복제 시 Character 파일은 복사하지 않는다. DM Library/보관함/달력 등을 포함할지는 복제 확인 화면에서 명시한다.

## UI

`캠페인` 화면은 최근 Campaign, 새 Campaign, 보관됨을 보여준다. Campaign 대시보드의 기본 작업은 `세션 시작`이다.

## 비활성화

핵심 시스템이므로 끌 수 없다. DM Host는 반드시 하나의 Campaign을 선택한다. Player의 `세션 참가`에는 Campaign 로컬 저장이 필요 없다.

---

# 시스템 2. Campaign Roster

## 목적

식량 소비 대상, 파티 보관함 권한, 최근 참가자, DM 준비용 파티 구성을 결정한다. Session participant와 동일한 데이터가 아니다.

## 저장 데이터

```ts
interface CampaignRosterMember {
  rosterMemberId: string;
  label: string;
  kind: "player-character-ref" | "host-preset" | "companion";
  characterRef?: { ownerHint?: string; characterId: string };
  active: boolean;
  countsForRations: boolean;
  rationUnitsPerDay?: number;
  stashPermission?: "none" | "view" | "request" | "manage";
}
```

Host가 알지 못하는 Player Character는 Join projection 이후 Campaign roster에 `참조 추가`할 수 있다. 이 작업은 Character 소유권이나 전체 Character 파일을 Host에게 넘기지 않는다.

## UI

Campaign 대시보드의 `파티` 카드에서 현재 구성원, 식량 계산 포함 여부, 보관함 권한을 편집한다. Session 준비에서는 실제 접속 참가자와 Campaign roster의 대응 상태만 보여준다.

## 연동

- 식량 시스템은 `active && countsForRations`인 명단을 기본 소비자로 사용한다.
- 보관함 정책은 roster 권한보다 Session participant capability를 다시 검증한다.
- Session 종료 시 마지막 참가 시각/요약만 갱신하며 transient Ready 상태는 저장하지 않는다.

---

# 시스템 3. Session Configuration / Snapshot

## 목적

Campaign 기본값과 이번 Session의 실제 규칙을 분리한다.

## 설정 항목

- Session 이름;
- 시작 모드: Freeform / Initiative;
- 달력 사용;
- 식량 규칙 사용;
- 파티 보관함 공개/정책;
- Campaign DM Library 사용;
- 활성 Content/rules loadout;
- 감지된 spatial capability;
- 참가/Ready 정책.

## 스냅샷

```ts
interface CampaignSessionSnapshot {
  sessionId: string;
  campaignId: string;
  campaignRevisionAtStart: number;
  settingsRevision: number;
  calendar: OptionalCampaignCapability;
  rations: OptionalCampaignCapability;
  stashPolicy: "shared" | "dm-approval" | "dm-managed";
  contentLoadoutId: string;
  spatialProviderId?: string;
  startedAt: string;
}
```

Session 시작 뒤 Campaign 기본값을 바꿔도 running Session은 자동 변경되지 않는다. 라이브 중 변경은 DM 확인, capability 재검증, Activity 기록이 있는 명시적 명령만 허용한다.

## UI

`Campaign 대시보드 -> 세션 시작`에서 한 화면으로 검토한다. 기본 설정은 접혀 있고 이번 Session에서 바꾼 항목만 `Campaign 기본값과 다름`으로 표시한다.

---

# 시스템 4. Calendar / World Time

## 목적

Campaign의 날짜와 세계 시간을 이어서 추적하되, 달력이 없는 플레이를 방해하지 않는다.

## V1 공급자 유형

1. `off` — 달력 미사용;
2. `builtin.simple-day` — `Day N`과 시각만 추적;
3. `builtin.gregorian` — 연/월/일/시각 표시;
4. `module.calendar-profile` — 선언형 월/요일/윤년/시대 정의를 사용하는 커스텀 달력.

실행 코드를 포함하는 달력 플러그인은 V1 범위가 아니다. 커스텀 달력은 검증된 선언형 profile이어야 한다.

## 저장 데이터

```ts
interface CampaignCalendarState {
  providerId: string;
  revision: number;
  absoluteMinute: number;
  displayAnchor: {
    era?: string;
    year?: number;
    monthId?: string;
    day?: number;
  };
  timeZoneLabel?: string;
  currentNote?: string;
}
```

정렬과 기간 계산은 `absoluteMinute`를 기준으로 하고 날짜 문자열을 계산 입력으로 파싱하지 않는다.

## 명령

- `시간 진행`: 분/시간/일 단위;
- `다음 날`;
- `날짜/시각 수정`: DM correction, 이전/이후 값 표시;
- `메모 추가`;
- 안전한 최근 시간 진행 Undo.

시간을 과거로 수정하는 작업은 영향 미리보기와 확인을 요구한다. 이미 만료된 효과를 자동 부활시키지 않는다.

## 휴식과의 관계

- Short/Long Rest는 기존 authoritative rest command다.
- 달력은 Rest의 필수 조건이 아니다.
- 달력이 켜져 있으면 Rest UI가 `시간도 진행`을 제안할 수 있다.
- `Rest resolution + calendar advance`는 하나의 compound transaction으로 커밋하거나 둘 다 실패한다.
- 시간 진행만으로 Rest 회복을 자동 실행하지 않는다.

## 효과 지속시간과의 관계

기존 Session `RuntimeClock.elapsedSeconds`와 Campaign 달력은 다른 clock이다. V1에서 전투/효과 clock을 Campaign 날짜에 무조건 결합하지 않는다. module/profile이 명시적으로 world-time duration capability를 제공할 때만 time advancement preview에 만료 효과를 포함한다.

## OFF 동작

- 날짜/시각 UI와 명령 숨김;
- Rest, 여행 서술, 효과 사용 가능;
- 저장된 달력 값 보존;
- 날짜 부족으로 Action/Session 진행을 막지 않음.

---

# 시스템 5. Ration / Supply Rules

## 목적

파티가 가진 식량과 하루 소비량을 가볍게 추적하고, 규칙 적용 전 DM에게 결과를 보여준다.

## V1 공급자 유형

1. `off` — 식량 규칙 미사용;
2. `builtin.tracking-only` — 잔량과 수동 소비만 추적;
3. `module.ration-profile` — 하루 요구량, 예외, 부족 결과를 선언형 규칙으로 제공.

V1 기본값은 `tracking-only`다. 기본 제품이 임의로 굶주림 피해나 Exhaustion을 부여하지 않는다.

## 저장 데이터

```ts
interface CampaignSupplyLedger {
  revision: number;
  balances: Record<string, number>; // V1 canonical key: ration
  lastConsumptionAtAbsoluteMinute?: number;
  consumptionHistory: SupplyTransactionSummary[];
}
```

V1의 표준 단위는 정수 `ration`이다. 물, 사료, 탄약, 연료 등은 같은 ledger 확장점에 추가할 수 있지만 V1 필수 구현은 아니다.

## 소비 계산

```text
활성 roster 중 countsForRations=true
-> 각 구성원의 rationUnitsPerDay 또는 provider 기본값
-> 필요량 preview
-> DM이 포함/제외/수량 수정
-> 잔량 검증
-> commit
```

소비는 자동 타이머가 아니라 명시적 transaction이다. 달력의 `다음 날` 또는 Long Rest 시 `식량 소비도 함께 처리`를 제안할 수 있지만 DM 확인 전에는 적용하지 않는다.

## 명령

- 식량 추가/차감;
- 하루치 소비 preview/commit;
- 구성원별 소비 예외;
- 최근 소비 Undo;
- 보관함의 호환 ItemInstance를 식량 단위로 `전환`.

마지막 전환은 ItemInstance 감소와 SupplyLedger 증가를 하나의 transaction으로 처리한다. 아이템 이름에 `food`가 들어간다는 이유만으로 자동 전환하지 않고 provider가 선언한 capability/tag가 필요하다.

## 부족 처리

- tracking-only: 부족 경고와 미충족 수량만 기록;
- module profile: 제안된 consequences를 pending DM adjudication으로 표시;
- DM 승인 전 Character HP, Effect, Exhaustion을 변경하지 않음;
- 부족 상태에서도 Session/Rest 자체를 막지 않음.

## OFF 동작

- 잔량, 소비, 경고, 부족 결과 UI 숨김;
- 저장 잔량/기록 보존;
- 음식 ItemInstance는 일반 인벤토리 아이템으로 유지;
- Long Rest/시간 진행/Session 시작을 막지 않음.

---

# 시스템 6. Party Stash / Wallet

## 목적

Campaign 파티가 공동으로 소유하는 아이템과 재화를 Session 사이에 보존한다.

## 저장 데이터

- Campaign 고유 `stashId`;
- ItemInstances;
- wallet balances;
- revision;
- 정책;
- reservation/pending transfer;
- 최근 transaction summary.

세부 transfer 계약은 `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`를 따른다.

## 정책

- `shared`: 권한 있는 Player가 직접 입출고;
- `dm-approval`: 출고 요청 후 DM 승인;
- `dm-managed`: DM만 이동, Player는 조회.

## UI

- Campaign 대시보드: 전체 관리;
- Session utility: 조회/빠른 입출고/승인;
- Character Inventory: `주기`/`보관함에 넣기`;
- DM Quick Search: `보관함에 지급`.

## 식량과의 관계

Party Stash와 SupplyLedger는 같은 것이 아니다. 보관함은 ItemInstance를 소유하고, 식량 ledger는 표준 소비 단위를 소유한다. 전환 transaction만 두 시스템을 함께 변경한다.

## 세션 종료

Committed transfer는 Campaign에 남고, draft offer/reservation은 정책에 따라 만료 또는 명시적으로 이월한다. V1 기본은 Session 종료 시 pending offer를 취소하고 reservation을 해제하는 것이다.

---

# 시스템 7. Campaign DM Library

## 목적

한 Campaign에서 사용할 DM 준비물을 비공개로 구성하고 Session 중 빠르게 호출한다.

## 컬렉션

- Images/Handouts;
- PC Actor Presets;
- NPC Actor Definitions;
- Custom Item Definitions;
- DM notes/folders/tags/favorites/recents.

Rulebook/installed module의 정의는 DM Library에 복사하지 않는다. 검색 결과에서 Campaign custom entry와 installed definition의 출처를 구분한다.

## UI

- Campaign 대시보드 `DM 라이브러리`에서 CRUD/정리;
- Session Quick Search에서 검색;
- Actor `+1`, Item `지급/회수`, Image `미리보기/공개`처럼 동사를 직접 표시.

## 격리

- Campaign A의 private entry는 Campaign B 검색/최근/즐겨찾기에 나타나지 않음;
- 명시적 `다른 캠페인으로 복제`만 허용;
- Client에게 catalog/index/note/existence metadata 전달 금지;
- Session에는 materialized Actor/ItemInstance/revealed Handout만 전달.

## 삭제

원본 definition을 삭제해도 이미 만들어진 Session Actor나 지급된 ItemInstance를 소급 삭제하지 않는다. 삭제 확인에는 참조 수를 표시하고 기존 instance는 provenance snapshot을 유지한다.

---

# 시스템 8. Session History / Campaign Journal

## 목적

Campaign이 어느 Session까지 진행되었는지 빠르게 기억하게 하되 전체 ResolutionEvent 원장을 중복 저장하지 않는다.

## Session 종료 요약

```ts
interface CampaignSessionSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  title: string;
  participantLabels: string[];
  calendarBefore?: string;
  calendarAfter?: string;
  rationDelta?: number;
  stashTransactionCount: number;
  dmNote?: string;
}
```

## UI

Campaign 대시보드에서 최신 Session 요약과 DM 메모를 보여준다. `다음 세션 시작`은 이전 Session의 transient Actor/Initiative/Ready/handout을 복원하지 않는다.

## 보존

V1은 bounded summary 목록을 저장한다. 세부 Activity export, full journal editor, wiki/quest tracker는 이후 확장이다.

---

# 시스템 9. Content and Capability Loadout

## 목적

Campaign이 어떤 RuleModule, calendar/ration profile, spatial provider를 사용하는지 고정하고 Session 참가 시 호환성을 검증한다.

## 분류

- RulesProfile;
- declarative RuleModules;
- calendar profile;
- ration profile;
- spatial provider capability;
- unsupported/missing capability report.

## 규칙

- Campaign은 설치된 content의 ID/version을 참조하며 패키지를 복사하지 않음;
- Session 시작 시 exact loadout snapshot 생성;
- running Session 중 package 변경은 자동 반영하지 않음;
- 필수 provider가 없으면 관련 선택 기능만 inactive/unsupported;
- 달력/식량/spatial 기능 부재가 일반 Session Host/Join을 막지 않음.

## UI

Session 설정에 `사용 가능`, `꺼짐`, `모듈 필요`, `호환되지 않음` 상태를 사람이 이해할 수 있게 표시한다. raw capability ID는 상세정보에만 둔다.

---

# 시스템 10. Spatial / Battle-map Extension State

## 목적

V1 Core는 맵을 제공하지 않지만 향후 2D/3D 모듈이 거리·시야·엄폐·이동 정보를 공급할 수 있게 한다.

## capability 예시

- `spatial.distance`;
- `spatial.visibility`;
- `spatial.cover`;
- `spatial.movement`;
- `spatial.movement-trigger`.

모듈은 일부 capability만 제공할 수 있다. 예를 들어 거리만 제공하는 모듈이 시야까지 제공한 것으로 간주하지 않는다.

## provider 없음

- 지도/토큰/이동 UI 없음;
- 거리·시야·엄폐 숫자/라벨 생성 금지;
- unknown을 out-of-range/hidden/covered로 해석 금지;
- 일반 수동 target은 선택 가능;
- 모듈 자체 operation이 필요한 기능만 `공간 모듈 필요`로 inactive.

## provider 있음

- handshake로 module id/version/capability 검증;
- facts에 provider provenance와 generation 기록;
- Core는 좌표가 아니라 rules-relevant facts만 소비;
- provider가 제공하지 않은 capability는 계속 unknown;
- unmount/disconnect/generation 교체 시 해당 facts 즉시 무효화.

## 수동 facts

DM의 고급 수동 거리/시야/엄폐 입력은 별도의 명시적 provider로 취급한다. 기본값 `5ft`를 자동 생성하지 않으며 입력 범위와 적용 수명을 보여준다.

---

# 11. 시스템 간 compound transaction

여러 시스템을 변경하는 대표 작업은 반드시 하나의 preview/commit 단위다.

## Long Rest + 시간 진행 + 식량 소비

```text
Long Rest 선택
-> Character별 rest 결과 preview
-> Calendar advance preview (enabled일 때만)
-> Ration consumption preview (enabled일 때만)
-> DM/각 소유자에게 필요한 결정 수집
-> 모두 검증
-> 하나의 authoritative event batch commit
```

어느 한 durable write-back이 실패하면 Campaign 시간/식량만 진행되거나 Character만 회복되는 부분 성공을 허용하지 않는다.

## DM 아이템 지급

```text
Campaign DM Library 또는 installed catalog 검색
-> 정의 선택
-> Character 또는 Party Stash 목적지 선택
-> 권한/수량/lifetime 검증
-> ItemInstance materialize
-> Session event + owning store write-back
```

## 하루 진행

```text
Calendar 다음 날
-> active ration consumers 계산
-> 소비 preview
-> DM 확인/예외 수정
-> Calendar + SupplyLedger commit
-> 부족 consequence는 별도 pending adjudication
```

---

# 12. Session 설정의 최종 UX

```text
세션 시작

캠페인        잿빛 해안                           [변경]
세션 이름     8회차 · 검은 등대
시작 모드     ● 자유 진행   ○ 우선권

선택 규칙
[켜짐] 세션 달력     그레고리력 · 1492-03-18 08:00
[켜짐] 식량 규칙     추적 전용 · 18식 / 오늘 필요 5식
[켜짐] 파티 보관함   DM 승인 · 아이템 24 · 132 GP

확장 기능
[없음] 전투맵/공간   거리·시야·엄폐 판정이 비활성화됩니다

콘텐츠
SRD 5.2.1 + 캠페인 모듈 2개                    [검토]

                                      [준비 화면으로]
```

토글을 끌 때는 `기록은 보존되며 이번 Session에서만 UI와 자동 규칙이 비활성화됩니다`를 표시한다.

---

# 13. V1 구현 순서

1. Campaign aggregate/store/schema/revision/migration;
2. Campaign 목록/대시보드/Session snapshot;
3. Campaign roster;
4. Calendar providers와 command/event/UI;
5. SupplyLedger와 tracking-only ration flow;
6. Campaign Party Stash 영속화와 transfer 연결;
7. DM Library Campaign namespace/custom item CRUD;
8. Session summary;
9. content/capability loadout;
10. spatial fallback 정리와 provider lifecycle;
11. compound Long Rest/day advance/grant transactions;
12. 연결 세션 replay/idempotency/privacy 및 Windows 2-instance acceptance.

---

# 14. V1 제외 범위

- Core 내장 전투맵/토큰/Fog of War/pathfinding/LOS;
- 실행 가능한 임의 third-party plugin;
- 모든 세계관을 위한 시각적 달력 제작기;
- 자동 여행 경로, 날씨, 사냥, 채집, 상점 경제;
- 칼로리/물/영양/부패를 포함한 상세 생존 시뮬레이션;
- multi-DM 동시 편집과 cloud sync;
- quest/wiki 문서 시스템;
- Campaign 간 DM Library/Party Stash 자동 공유.

이 기능들은 현재 시스템의 versioned provider/ledger/namespace 경계를 통해 나중에 확장할 수 있지만 V1 출시를 막지 않는다.
