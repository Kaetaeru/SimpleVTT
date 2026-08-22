# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded code head: **`b2ec43f fix(campaign): use void hydration listener cleanup`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `git branch --show-current`가 `work/v1-composite`인지 확인한다.
2. `git status --short`로 사용자 변경 사항을 먼저 확인한다.
3. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
4. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 **실제 production 기능 gap**을 선택한다.
5. 현재 UI를 V1 baseline으로 보존하고 내부 wiring/authority/persistence를 우선 수정한다.
6. V1 구현을 모두 끝내기 전에는 comprehensive Codex audit를 시작하지 않는다.

## 2. 사용자 고정 목표

- V1은 체크박스 존재가 아니라 **의도된 모든 V1 기능이 실제 사용자 경로에서 정상 작동하는 상태**다.
- 현재 SimpleVTT UI 구조/스타일/내비게이션은 V1의 보호된 기준선이다.
- 기능 구현을 이유로 광범위한 UI redesign을 하지 않는다.
- 기능 하나마다 Codex 총검사로 멈추지 않는다.
- 모든 pre-release 구현이 끝난 하나의 exact canonical SHA를 동결한 뒤 V1 직전에 한 번 comprehensive Codex audit를 수행한다.

## 3. Ready / connected lifecycle 구현 상태

Ready 코드 구조는 구현 완료 상태이며 human/two-instance release evidence는 후반 acceptance에서 수행한다.

- Ready configuration은 actor별 Map으로 저장한다.
- Ready는 다음 자기 턴 시작 또는 initiative 종료에 만료된다.
- Host는 `ready-action` armed/cleared lifecycle event를 authoritative ledger에 기록한다.
- Client는 actor별 config/status/economy를 투영한다.
- A actor clear가 B actor Ready를 제거하지 않는다.
- Host UI에서 직접 trigger해도 clear event가 broadcast된다.
- session start/end/reset은 Ready transient state를 제거한다.
- reconnect는 ledger catch-up을 authority로 사용한다.
- `ready-action-v1`은 required connected capability다.
- `Start SimpleVTT Acceptance Pair.cmd`와 isolated Host/Client data roots가 구현돼 있다.

핵심 커밋: `c92093f`, `05a0ed0`, `bd13475`, `e95ef7c`, `98091e4`, `f6867c8`, `45e1c10`, `330c4cf`, `463fb6e`, `989060b`, `f3ca88d`.

## 4. 2026-08-23 Rerun checkpoint — Campaign lifecycle UX

선택한 V1 gap: `V1-11 Campaign product UI`의 lifecycle/error/destructive 상태.

### 구현 완료

1. **보관 destructive confirmation**
   - 기존 Campaign 카드의 `보관` 버튼이 즉시 `archiveCampaign()`을 호출하지 않는다.
   - `archiveTarget`을 설정하고 기존 `campaign-session-setup` overlay 스타일 안에서 명시적 확인을 요구한다.
   - 확인 화면은 Character/installed content/Campaign continuity data를 삭제하지 않고 archive 상태로만 전환한다는 의미를 설명한다.
   - 취소/닫기는 mutation 없이 종료한다.
   - UI 레이아웃/카드 구조/스타일 체계는 변경하지 않았다.

2. **Campaign startup hydration blocker UI**
   - 새 `campaignHydrationIssueAdapter.ts`가 Campaign runtime `getSnapshot` 바깥에서 다음 오류만 분류한다.
     - `CampaignMigrationRequiredError` -> `migration-required`
     - `CampaignSchemaError` -> `schema-unsupported`
     - `CampaignCorruptError` -> `corrupt`
   - 오류를 자동 삭제/reset/write 하지 않고 원래 오류를 다시 throw한다. 데이터 보존 우선이다.
   - `CampaignStartupRecoveryBridge.tsx`가 기존 `loading-screen` + `campaign-empty` UI 언어로 명시적인 blocker를 표시한다.
   - `다시 시도`는 AppProvider `refresh()`만 다시 실행한다. 자동 마이그레이션/초기화는 하지 않는다.
   - guard는 `main.tsx`에서 `AppProvider`보다 먼저 import하며, guard 자체가 `campaignRuntimeAdapter`를 먼저 설치한 뒤 wrapping한다.

### 관련 커밋

- `66ca74d` — destructive archive confirmation structure test
- `36eecfc` — archive confirmation implementation
- `b8c5eab` — Campaign startup recovery structure test
- `ba40608` — hydration issue guard
- `25a435f` — explicit startup recovery bridge
- `a1d50d6` — install guard/bridge in production entry
- `b2ec43f` — React-safe void subscription cleanup

### 검증 상태

- deterministic structure tests는 코드로 추가했다.
- 이 Rerun 실행에서는 comprehensive Codex audit를 의도적으로 실행하지 않았다.
- GitHub combined-status API는 `36eecfc`에 status/check 결과를 노출하지 않았다. 따라서 green이라고 기록하지 않는다.
- Live Development가 canonical branch를 따라가면 위 변경은 기존 UI shell 안에서 반영된다.

## 5. V1-11에서 아직 남은 실제 기능 gap

Canonical design `docs/design/campaign-systems.md`의 Campaign lifecycle DM 작업에는 **복제와 명시적 삭제**도 포함되어 있다. 현재 production Campaign screen은 create/open/archive/restore는 노출하지만 duplicate/delete는 아직 사용자 경로에 없다.

따라서 V1-11을 functional-complete로 닫기 전에 다음이 필요하다.

- Campaign duplicate command/application/runtime path.
- 복제 범위를 명시하는 confirmation UI. 최소 V1에서는 Character 파일은 복제하지 않으며 Campaign-owned continuity state 복제 여부를 명확히 해야 한다.
- explicit Campaign delete command with confirmation.
- delete가 player-owned Character/installed content를 절대 삭제하지 않음.
- active Campaign 삭제/보관 후 activeCampaignId가 유효한 상태로 정리됨.
- 저장 실패/stale revision에서 partial lifecycle mutation 없음.

현재 UI baseline을 유지하고 Campaign 카드의 secondary action/기존 overlay 패턴 안에서 최소 추가한다.

## 6. 그 이후 주요 구현 축

V1-11 lifecycle을 닫은 뒤 stale checklist를 현재 코드와 reconcile하고 다음 unblocked implementation gap을 선택한다.

현재 알려진 코드 gap:

- V1-12 declarative `module.calendar-profile` / ration provider profile (현재 UI에서 설치 필요 disabled 상태).
- V1-12 authoritative Long Rest + optional time advance + optional ration consumption compound write.
- V1-13 Party Stash / DM Library는 최근 코드에 구현이 존재하므로 TODO 표기를 그대로 믿고 재구현하지 말고 source와 current behavior를 먼저 reconcile한다.
- V1-40 Campaign-linked DM live operation.
- V1-41 provider lifecycle/stale spatial fact cleanup.
- V1-50 이후 quality/release gates.

Human-only two-instance/dice visual acceptance는 독립 구현을 막지 않으며 pre-release/final acceptance에 모아서 수행한다.

## 7. Next Exact Action

**V1-11 Campaign lifecycle의 duplicate/delete production path를 구현한다.**

1. `docs/design/campaign-runtime.md`와 `campaign-systems.md` lifecycle contract를 다시 확인한다.
2. `CampaignApplicationService`, `CampaignLibraryRepository`/contracts, `campaignRuntimeAdapter`, `AppProvider`, `CampaignScreen`의 기존 lifecycle command 흐름을 따라 duplicate/delete command를 추가한다.
3. duplicate는 Character 파일/installed content ownership을 복사하지 않는다.
4. delete는 명시적 confirmation 뒤에만 실행하고 Campaign-owned record만 제거한다.
5. current Campaign 화면/card/overlay 시각 구조를 그대로 유지한다.
6. deterministic tests를 기능과 함께 추가하되 final Codex audit는 시작하지 않는다.
