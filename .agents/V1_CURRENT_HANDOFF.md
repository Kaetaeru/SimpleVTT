# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded provider runtime head: **`dacb1fd test(campaign): cover declarative provider runtime path`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
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

## 3. 보존된 완료 구현

### Ready / connected lifecycle

구조 구현 완료. actor별 Ready, 다음 자기 턴/initiative 종료 만료, Host authoritative ledger, Client projection, reconnect replay, session reset cleanup, `ready-action-v1`, isolated acceptance-pair tooling이 존재한다. Human/two-instance evidence는 후반 acceptance에서 수행한다.

### V1-11 Campaign lifecycle

Production 구현은 완료됐고 exact-head validation evidence만 남아 있다.

- archive confirmation + startup migration/schema/corruption blocker.
- durable duplicate/delete service를 재사용한 production runtime path.
- current Campaign card/overlay visual language 안의 duplicate/delete confirmations.
- duplicate는 Campaign-owned continuity와 Character **참조**만 복제하며 Player-owned Character 파일/installed-content ownership/과거 Session history/transient Session은 복제하지 않는다.
- delete는 Campaign record만 삭제하며 현재 captured Session의 Campaign 삭제는 거부한다.
- canonical UI workflow에 focused Campaign lifecycle tests가 연결돼 있다.

핵심 최근 커밋: `24957b4`, `3c53424`, `d66b26b`, `477250b`.

## 4. 2026-08-23 Rerun checkpoint — V1-12 declarative Calendar/Ration provider core

Canonical `docs/design/campaign-systems.md`와 기존 RuleModule/installed-content 구조를 재확인했다. 새 plugin runtime을 만들지 않고 기존 **declarative RuleModule -> InstalledContent -> Catalog -> Campaign authority** 경계를 재사용했다.

### 이번 실행에서 구현 완료

1. **선언형 provider schema / strict parser**
   - `3e364dd`: installed-content contract에 `InstalledCampaignCalendarProfileV1`, `InstalledCampaignRationProfileV1`, union provider payload 추가.
   - `b2244d5`: `campaignProviderProfiles.ts` 추가.
   - 허용 필드 allowlist, month/day/leap/unit 범위, unique ids/remainders를 검증한다.
   - arbitrary `run`, `script` 같은 예상 밖 필드는 unsupported field로 거부한다.
   - capability는 `campaign.calendar-profile` / `campaign.ration-profile`로 분리한다.
   - stable providerId는 `module.calendar-profile:<sourceId>:<contentId>` / `module.ration-profile:<sourceId>:<contentId>`이며 version은 별도 `providerVersion`으로 pin한다.

2. **custom calendar authoritative arithmetic**
   - `ad2eb02`: `campaignCalendar.ts`가 validated custom profile을 optional 입력으로 받아 absolute minute <-> era/year/month/day/time 왕복을 수행한다.
   - variable month length와 bounded leap cycle/remainders를 지원한다.
   - profile이 없는 unknown provider는 mutation 역변환에서 명시적으로 실패한다.

3. **RuleModule import / validation / persistence boundary**
   - `d1977e1`: RuleModule `content[].campaignProvider`를 parser가 validated installed payload로 보존한다.
   - `fc5229f`: provider entry는 `option` category여야 하며 module manifest가 matching provider capability를 선언해야 한다.
   - `a2974b6`: persisted installed-content generation decode 시 provider payload도 다시 strict validation한다. 손상 payload를 restart에서 신뢰하지 않는다.
   - `2f99068` / `abee49f`: installed provider metadata를 read-only `CatalogEntry.campaignProvider` projection으로 전달한다. 별도 provider 저장소/registry를 만들지 않는다.

4. **Campaign application authority**
   - `412047f`: Campaign application service가 optional validated profiles를 받아 providerVersion을 durable capability에 저장하고 custom calendar projection/correction/undo/day advance와 ration daily calculation/consumption을 같은 Campaign generation 안에서 수행한다.
   - custom ration은 `rationUnitsPerDay` explicit override를 최우선으로 하고, 없을 때 provider의 roster-kind default -> provider global default -> builtin 1 순으로 계산한다.
   - shortage는 기존대로 warning/ledger만 생성하며 피해/소진을 자동 적용하지 않는다.
   - enabled custom provider가 unavailable이면 해당 provider-specific mutation은 명시적으로 실패한다. disabled state는 저장값을 보존할 수 있다.

5. **Production runtime provider resolution**
   - `c97a3d0`: installed catalog에서 provider descriptor를 조회할 수 있는 helper 추가.
   - `386814a`: Campaign runtime이 `providerId + providerVersion` exact match를 우선 사용하고, 새 선택 시 설치된 동일 provider의 최신 version을 결정해 pin한다.
   - calendar/ration configure, calendar advance/correct/date-time/undo, ration consume, compound day advance에 profile을 application service로 전달한다.
   - custom provider가 제거된 Campaign도 `getSnapshot()` 자체는 정상 hydrate/project한다. provider-specific mutation에서만 unavailable error가 발생한다.

### focused deterministic contracts

- `4d14cd8`: `campaignDeclarativeProviderProfile.test.ts` — parser safety + calendar roundtrip.
- `e686d9e` / `29e6ee9`: `campaignDeclarativeProviderImport.test.ts` — package payload preservation, category/capability boundary, ration profile.
- `dacb1fd`: `campaignDeclarativeProviderRuntime.test.ts` — RuleModule install -> Campaign provider selection -> providerVersion -> custom calendar correction -> ration consumption, plus restart with missing provider behavior.

### 검증 상태 / 주의

- 위 tests는 코드로 추가했지만 이 checkpoint에서는 comprehensive Codex audit를 실행하지 않았다.
- 새 provider tests를 canonical UI workflow에 연결하고 exact-head TypeScript/build 결과를 확인하는 작업은 아직 남아 있다.
- 이번 checkpoint에서는 GitHub Actions green을 주장하지 않는다.
- `CampaignSystemsPanel` UI는 아직 기존 disabled placeholder를 사용한다. 따라서 **provider core/runtime은 구현됐지만 V1-12 provider user path는 아직 미완료**다.

## 5. Next Exact Action

**현재 Campaign UI를 유지한 채 installed declarative provider를 Calendar/Ration select에 노출한다.**

1. `CampaignSystemsPanel`에서 `snapshot.catalog`의 validated provider descriptors를 읽는다.
2. 같은 providerId의 여러 installed version은 runtime 선택 규칙과 일치하게 최신 version 하나만 표시한다.
3. 기존 `<select>` 구조를 유지하고 builtin option 뒤에 installed Calendar/Ration provider options를 추가한다. 설치된 provider가 없을 때만 현재 `모듈 프로필 · 설치 필요` disabled placeholder를 유지한다.
4. custom Calendar를 선택하면 기존 직접 날짜 편집 UI에서 profile months를 사용하고 `연도/월/일`을 표시한다. Simple Day UI는 그대로 유지한다.
5. ration preview는 선택된 ration profile의 defaults를 사용하고 shortageConsequences는 **제안/설명 텍스트**로만 표시한다. 자동 피해/소진 금지.
6. installed provider가 사라진 현재 선택값은 명시적인 unavailable 상태로 표시하되 Campaign screen/session/rest/action 전체를 막지 않는다.
7. `campaignDeclarativeProviderProfile`, `campaignDeclarativeProviderImport`, `campaignDeclarativeProviderRuntime` tests를 canonical UI workflow에 추가하고 TypeScript/build evidence를 확인한다.
8. UI provider path가 닫힌 뒤 V1-12의 다음 큰 gap인 authoritative Long Rest + optional time/rations compound write를 선택한다.

## 6. 검증 정책

- 기존 exact-head green evidence는 보존하고 반복하지 않는다.
- focused deterministic tests는 기능과 함께 작성한다.
- push run/result를 실제 확인하기 전 green/DONE을 주장하지 않는다.
- comprehensive Codex audit는 V1 전체 implementation이 끝난 frozen exact SHA에서만 수행한다.
