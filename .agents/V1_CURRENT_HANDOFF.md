# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded provider UI/gate head: **`a285f2f ci(ui): verify declarative campaign providers`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 실제 production 기능 gap을 선택한다.
4. 현재 UI를 V1 baseline으로 보존하고 내부 wiring/authority/persistence를 우선 수정한다.
5. 이미 구현/검증된 작업은 반복하지 않는다.
6. 모든 V1 pre-release 구현이 끝나기 전 comprehensive Codex audit를 시작하지 않는다.

## 2. 보존된 완료 구현

### Ready / connected lifecycle

구조 구현 완료. actor별 Ready, 다음 자기 턴/initiative 종료 만료, Host authoritative ledger, Client projection, reconnect replay, session reset cleanup, `ready-action-v1`, isolated acceptance-pair tooling이 존재한다. Human/two-instance evidence는 후반 acceptance에서 수행한다.

### V1-11 Campaign lifecycle

Production 구현은 완료됐고 exact-head validation evidence만 남아 있다. archive/startup recovery/duplicate/delete 경로가 기존 Campaign UI와 durable application service를 통해 연결돼 있다.

## 3. V1-12 declarative Calendar/Ration provider — core/runtime

새 executable plugin runtime을 만들지 않고 기존 **RuleModule -> InstalledContent -> Catalog -> Campaign authority** 경계를 재사용했다.

- `3e364dd` / `b2244d5`: data-only Calendar/Ration provider schema, strict allowlist parser, stable providerId.
- `ad2eb02`: custom calendar absolute minute <-> era/year/month/day/time 왕복과 bounded leap cycle.
- `d1977e1` / `fc5229f`: RuleModule payload 보존 + option category/matching capability validation.
- `a2974b6`: restart decode 때 persisted provider payload 재검증.
- `2f99068` / `abee49f`: installed provider metadata를 기존 Catalog로 read-only projection.
- `412047f`: Campaign application service가 providerVersion을 pin하고 custom calendar/ration 계산을 authoritative Campaign mutation 안에서 수행.
- `386814a`: runtime이 providerId + providerVersion exact match를 우선 해석하고 missing provider는 provider-specific command에서만 실패.
- `4d14cd8`, `e686d9e`/`29e6ee9`, `dacb1fd`: parser/import/runtime focused contracts.

기본 원칙은 유지된다: 식량 부족은 warning/pending DM adjudication일 뿐 자동 damage/Exhaustion을 적용하지 않는다. OFF/missing provider는 unrelated Session/Rest/Action을 막지 않는다.

## 4. 이번 Rerun — provider production UI path 구현

### provider version selection

- `47de9a2`: `campaignProviderProfiles.ts`에 Catalog에서 같은 providerId의 **최신 설치 버전 하나**를 고르는 helper와 exact pinned version lookup을 추가했다.
- 버전 비교는 runtime과 동일하게 numeric-aware `localeCompare` 규칙을 사용한다.

### CampaignSystemsPanel

- `de40e7b`: 기존 Calendar/Ration 패널과 `<select>` 구조를 그대로 유지하면서 installed declarative providers를 실제 사용자 선택지로 연결했다.
- UI는 `snapshot.catalog`에서 provider descriptor를 파생하며 별도 provider store를 만들지 않는다.
- 새 custom provider 선택 시 providerId와 providerVersion을 함께 runtime에 전달하여 durable pin을 확정한다.
- 같은 providerId에 여러 version이 설치돼 있으면 최신 version만 일반 선택지로 표시한다.
- Campaign이 여전히 설치된 구버전에 pin돼 있으면 현재 고정 version을 명시하고 최신 version을 별도 선택 가능하게 한다.
- 현재 pin된 provider/version이 제거됐으면 unavailable 상태를 명시한다. Campaign 화면과 unrelated Session/Rest/Action은 계속 사용 가능하며, 해당 provider가 필요한 mutation만 비활성/실패한다.
- custom Calendar는 기존 직접 날짜 편집기를 그대로 사용하면서 profile months를 `연도/월/일` 입력에 투영한다. Simple Day/Gregorian 경로는 유지한다.
- custom Ration preview는 `previewCampaignDailyRations(..., selectedRationProfile)`을 사용하므로 roster-kind/global defaults가 실제 미리보기에 반영된다.
- `shortageConsequences`는 `DM 판정 제안` 텍스트로만 표시하며 Character 상태를 자동 수정하지 않는다.
- Roster, DM Library, Session history 구조는 변경하지 않았다.

### focused UI contract / canonical gate

- `3284e93` / `b624a48`: `campaignDeclarativeProviderUiStructure.test.ts`를 추가/정렬했다. latest-version dedupe, exact pinned lookup, Catalog projection, custom month editor, unavailable state, ration advisory-only 경계를 검증한다.
- `a285f2f`: canonical `.github/workflows/ui.yml` Campaign step에 provider profile/import/runtime/UI tests 네 개를 추가했다.

## 5. 검증 상태

현재 판단: **V1-12 declarative provider user path IMPLEMENTATION COMPLETE / EXACT-HEAD VALIDATION PENDING**.

- source와 canonical workflow wiring은 현재 head에 존재한다.
- GitHub connector의 combined status에는 `a285f2f`에 대한 status가 아직 노출되지 않았다.
- 사용 가능한 `fetch_commit_workflow_runs` wrapper는 PR-triggered runs만 반환하며 이 direct branch push의 run을 보여주지 못했다.
- 별도 임시 clone으로 focused tests/build를 실행하려 했으나 실행 환경에서 `github.com` DNS resolution이 차단되어 clone 전에 종료됐다. 이는 제품 test failure가 아니며 pass 증거로도 사용하지 않는다.
- 따라서 Actions green, TypeScript/build pass, V1-12 DONE을 아직 주장하지 않는다.
- comprehensive Codex audit는 계속 보류한다.

## 6. Next Exact Action

**V1-12의 남은 큰 기능 gap인 authoritative Long Rest + optional Campaign time advance + optional ration consumption compound write를 구현한다.**

1. 먼저 기존 authoritative Long Rest command/runtime/write-back 경계를 읽어 이미 구현된 회복/주문/자원 처리를 재사용한다.
2. `docs/design/campaign-systems.md`의 Rest 관계와 현재 Campaign transaction/repository 경계를 다시 대조한다.
3. UI를 재설계하지 말고 기존 Long Rest surface에 최소 preview/선택 상태만 연결한다.
4. preview는 Long Rest 자체, optional Campaign time advance, optional ration consumption을 명시적으로 보여준다. 시간/식량은 사용자가 선택했을 때만 포함한다.
5. Character durable write-back과 Campaign generation write 중 하나라도 실패하면 **partial success가 남지 않는 authoritative compound boundary**를 만든다. 단순 순차 호출 후 보상 추측으로 끝내지 않는다.
6. Calendar/Ration이 OFF이거나 provider가 unavailable이어도 Long Rest 자체는 막지 않는다. 선택 가능한 Campaign side effect만 제외/비활성화한다.
7. 시간 진행만으로 Rest 회복을 실행하지 않고 Rest만으로 날짜 진행을 강제하지 않는다.
8. deterministic failure/rollback/idempotency tests를 먼저 추가하고 production path를 연결한다.
9. provider UI의 exact-head CI 결과가 후속 실행에서 보이면 기록하되, 이를 이유로 이미 구현된 provider 코드를 반복하지 않는다.

## 7. 검증 정책

- 기존 exact-head evidence는 보존하고 반복하지 않는다.
- focused deterministic tests는 기능 구현과 함께 작성한다.
- 실제 결과를 관찰하기 전 green/DONE을 주장하지 않는다.
- comprehensive Codex audit는 V1 전체 implementation이 끝난 frozen exact SHA에서만 수행한다.
