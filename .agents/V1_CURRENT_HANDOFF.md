# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded product head: **`d66b26b feat(campaign): expose duplicate delete confirmations`**  
Recorded UI gate head: **`477250b ci(ui): validate canonical campaign lifecycle`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. `git branch --show-current`/GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 실제 production 기능 gap을 선택한다.
4. 현재 UI를 V1 baseline으로 보존하고 내부 wiring/authority/persistence를 우선 수정한다.
5. 이미 구현/검증된 작업은 반복하지 않는다.
6. 모든 V1 pre-release 구현이 끝나기 전 comprehensive Codex audit를 시작하지 않는다.

## 2. 사용자 고정 목표

- V1은 체크박스 존재가 아니라 **의도된 모든 V1 기능이 실제 사용자 경로에서 정상 작동하는 상태**다.
- 현재 SimpleVTT UI 구조/스타일/내비게이션은 V1의 보호된 기준선이다.
- 기능 구현을 이유로 광범위한 UI redesign을 하지 않는다.
- 기능 하나마다 Codex 총검사로 멈추지 않는다.
- 모든 pre-release 구현이 끝난 하나의 exact canonical SHA를 동결한 뒤 V1 직전에 한 번 comprehensive Codex audit를 수행한다.

## 3. Ready / connected lifecycle 구현 상태

Ready 구조 구현은 완료 상태이며 human/two-instance release evidence는 후반 acceptance에서 수행한다.

- actor별 Ready configuration.
- 다음 자기 턴/initiative 종료 만료.
- Host authoritative `ready-action` lifecycle ledger.
- Client actor별 config/status/economy projection.
- Host-local trigger clear broadcast.
- session start/end/reset transient cleanup.
- reconnect ledger catch-up + idempotent replay.
- `ready-action-v1` required capability.
- isolated `Start SimpleVTT Acceptance Pair.cmd` tooling.

핵심 기존 커밋: `c92093f`, `05a0ed0`, `bd13475`, `e95ef7c`, `98091e4`, `f6867c8`, `45e1c10`, `330c4cf`, `463fb6e`, `989060b`, `f3ca88d`.

## 4. V1-11 Campaign lifecycle — production 구현 완료, exact-head validation 대기

### 이전 checkpoint

- `66ca74d` / `36eecfc`: archive 즉시 mutation을 제거하고 기존 Campaign overlay 안에서 명시적 확인 추가.
- `b8c5eab` / `ba40608` / `25a435f` / `a1d50d6` / `b2ec43f`: Campaign schema/migration/corruption startup blocker를 자동 삭제 없이 명시적으로 표시하고 재시도만 허용.

### 이번 재개에서 완료

Canonical `campaign-systems.md`의 lifecycle contract를 재확인했다. `CampaignApplicationService`에는 이미 durable `duplicateCampaign`/`deleteCampaign` 구현이 존재했으므로 이를 재작성하지 않았다.

1. **runtime duplicate/delete 경로** — `24957b4`
   - `MockAdapter` production Campaign runtime에 `duplicateCampaign`과 `deleteCampaign`을 노출했다.
   - 기존 `CampaignApplicationService`를 그대로 authority로 사용한다.
   - duplicate는 source Campaign revision을 검증하고 새 Campaign namespace를 선택한다.
   - delete는 durable Campaign record만 제거한다.
   - 현재 captured Session이 삭제 대상 Campaign에 묶여 있으면 삭제를 거부한다.

2. **UI command facade** — `3c53424`
   - `campaignLifecycleCommands.ts`가 production singleton adapter의 lifecycle command를 얇게 노출한다.
   - UI에 persistence 계산이나 aggregate mutation 로직을 넣지 않는다.

3. **Campaign duplicate/delete UI** — `d66b26b`
   - 기존 Campaign card footer에 `복제`, `삭제` secondary action을 최소 추가했다.
   - 새 layout/navigation/style 체계를 만들지 않고 기존 `campaign-session-setup` overlay를 재사용한다.
   - duplicate 확인 화면은 실제 복제 범위를 명시한다:
     - 복제: 파티의 Character **참조**, 세션 기본값, 달력/식량 상태와 기록, Party Stash, Campaign DM Library, content loadout.
     - 새 stash/library/loadout namespace ID 사용.
     - 복제 안 함: Player-owned Character 파일, installed content 자체/소유권, 과거 Session history, running Session transient state.
   - delete 확인은 irreversible임을 명시하고 Campaign-owned 설정/continuity만 삭제한다고 설명한다.
   - Player-owned Character와 installed content는 삭제하지 않는다.

4. **focused deterministic contracts**
   - `4487ebf`: `campaignLifecycleRuntime.test.ts` — duplicate continuity/new namespace/session-history reset + delete/fallback projection 계약.
   - `dbad5bc`: `campaignLifecycleUiStructure.test.ts` — duplicate/delete/ownership/destructive confirmation 구조 계약.

5. **canonical UI validation wiring** — `477250b`
   - `.github/workflows/ui.yml`의 push branch에 `work/v1-composite`를 추가했다.
   - Campaign persistence/runtime/product/startup/lifecycle focused tests를 하나의 Campaign lifecycle step에 연결했다.
   - 이 connector에서는 push run 결과를 직접 확인하지 못했으므로 **green으로 기록하지 않는다**.

### V1-11 판단

기존 checklist의 production 기능 gap이었던 empty/error/migration/destructive lifecycle UX와 canonical design의 duplicate/delete user path는 코드상 연결됐다.

단, `DONE`은 exact-head test/build evidence가 있어야 하므로 현재 판단은 **IMPLEMENTATION COMPLETE / VALIDATION PENDING**이며 release checklist의 공식 상태 문법상 아직 PARTIAL로 유지한다.

## 5. 알려진 다음 V1-12 구현 gap

Human-only Windows two-instance/visual acceptance는 독립 구현을 막지 않는다. 다음 코드 작업은 Campaign systems의 실제 미구현 provider 계약으로 이동한다.

현재 production UI에서 확인된 gap:

- Calendar provider select에는 `module.calendar-profile`이 `설치 필요` disabled placeholder로만 존재한다.
- Ration system도 declarative module provider contract가 V1 설계에 있으나 production validation/activation 경로가 없다.
- V1은 executable calendar/ration plugin이 아니라 **검증된 declarative profile**만 허용한다.

그 이후 별도 큰 gap:

- authoritative Long Rest + optional Campaign time advance + optional ration consumption compound write; Character/Campaign 어느 write-back이라도 실패하면 partial success 금지.
- V1-13 Party Stash / DM Library는 최근 코드에 구현이 있으므로 stale TODO를 그대로 재구현하지 말고 current source를 먼저 reconcile.
- V1-40 Campaign-linked DM live operation.
- V1-41 spatial provider lifecycle/stale fact cleanup.
- V1-50 이후 quality/release gates.

## 6. 검증 정책

- 기존 Phase 13 exact-head green evidence는 보존한다.
- 이번 Campaign lifecycle slice에는 deterministic tests와 canonical UI workflow wiring이 존재한다.
- push workflow 결과가 확인되지 않은 상태에서 pass/green을 주장하지 않는다.
- comprehensive Codex audit는 아직 실행하지 않는다.
- V1 전체 implementation이 끝난 exact SHA에서만 final Codex audit를 수행한다.

## 7. Next Exact Action

**V1-12 declarative Calendar/Ration provider contract를 구현한다.**

1. `docs/design/campaign-systems.md`의 provider 문법과 현재 Content/RuleModule manifest 계약을 읽는다.
2. 이미 존재하는 module/content validation 구조를 재사용할 수 있는지 먼저 확인한다.
3. `module.calendar-profile`을 실행 코드 없는 선언형 profile로 validate/project한다.
4. ration declarative provider도 같은 capability boundary를 사용하고 arbitrary executable plugin을 허용하지 않는다.
5. provider가 없거나 invalid면 기존 OFF/builtin 경로가 정상 동작하며 session/rest/action을 막지 않아야 한다.
6. 현재 Campaign UI의 provider select 구조를 보존하고, 설치된 compatible profile이 있을 때만 선택 가능하게 한다.
7. deterministic focused tests를 함께 추가하되 comprehensive Codex audit는 시작하지 않는다.
