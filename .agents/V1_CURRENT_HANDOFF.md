# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded Long Rest foundation head: **`aeb65c1 feat(rest): project domain long rest into durable Character state`**

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

## 3. V1-12 declarative Calendar/Ration provider

새 executable plugin runtime을 만들지 않고 기존 **RuleModule -> InstalledContent -> Catalog -> Campaign authority** 경계를 재사용했다.

- `3e364dd` / `b2244d5`: data-only Calendar/Ration provider schema, strict allowlist parser, stable providerId.
- `ad2eb02`: custom calendar absolute minute <-> era/year/month/day/time 왕복과 bounded leap cycle.
- `d1977e1` / `fc5229f`: RuleModule payload 보존 + option category/matching capability validation.
- `a2974b6`: restart decode 때 persisted provider payload 재검증.
- `2f99068` / `abee49f`: installed provider metadata를 기존 Catalog로 read-only projection.
- `412047f`: Campaign application service가 providerVersion을 pin하고 custom calendar/ration 계산을 authoritative Campaign mutation 안에서 수행.
- `386814a`: runtime이 providerId + providerVersion exact match를 우선 해석하고 missing provider는 provider-specific command에서만 실패.
- `47de9a2`: latest-per-providerId + exact pinned descriptor helpers.
- `de40e7b`: 기존 Calendar/Ration select UI에 installed provider를 연결하고 custom month/ration preview/unavailable 상태를 투영.
- `3284e93` / `b624a48`: provider UI structure contract.
- `a285f2f`: canonical UI workflow에 provider profile/import/runtime/UI tests 연결.

기본 원칙은 유지된다: 식량 부족은 warning/pending DM adjudication일 뿐 자동 damage/Exhaustion을 적용하지 않는다. OFF/missing provider는 unrelated Session/Rest/Action을 막지 않는다.

현재 판단: **declarative provider user path IMPLEMENTATION COMPLETE / EXACT-HEAD VALIDATION PENDING**. Direct canonical push의 Actions 결과는 현재 connector에서 관찰되지 않았으므로 green/DONE을 주장하지 않는다.

## 4. 이번 Rerun — authoritative Long Rest compound foundation

### 기존 Rest authority 재확인

소스 감사 결과 `docs/design/campaign-systems.md`의 “기존 authoritative rest command” 문구는 production UI/runtime 관점에서는 오래된 가정이었다.

- 기존 `configureWizardLongRest`, `configurePactTomeRest`, `configureCircleLandRest`는 Long Rest 자체 해결이 아니라 휴식 시 주문/선택 구성을 저장하는 class-specific command다.
- 그러나 domain authority는 이미 존재한다.
  - `src/domain/rest.ts::resolveLongRest()`는 HP 최대 회복, Temporary HP 제거, death-save/life flag reset, Hit Dice 회복, declarative `longRest` resource recovery, Rest 만료 effect, Exhaustion 1단계 제거를 처리한다.
  - `src/domain/resolutionRestOps.ts`는 이를 canonical Resolution operation `kind:"long-rest"`로 실행하고 HP/resource/life/effect/concentration state changes를 생성한다.
  - `src/domain/resources.ts`는 `recovery.longRest`, recovery lockout, temporary maximum normalization을 이미 선언형으로 처리한다.
- 따라서 Campaign/runtime/UI에서 별도 Long Rest 규칙을 발명하지 않는다.

### Character durable Long Rest projection

- `98b2de9`: `characterLongRestProjection.test.ts` failing contract 추가.
- `aeb65c1`: `characterLongRestProjection.ts` 추가.
  - canonical `resolveLongRest()`를 호출한다.
  - Character HP/Temporary HP/life flags와 `recovery.longRest`를 가진 durable resources를 결과 Character sheet에 투영한다.
  - dead/0 HP Character를 자동 부활시키지 않는다.
  - Campaign time/ration은 의도적으로 이 helper에 포함하지 않는다. Rest만으로 날짜/식량 진행을 강제하지 않기 위함이다.
  - Session effects를 optional input/output으로 유지해 이후 production coordinator가 existing domain expiry를 재사용할 수 있다.

### Character + Campaign immutable-generation compound staging

Character와 Campaign은 서로 다른 immutable generation store를 사용하고 기존 repository `commit()`은 각 store를 독립적으로 write한다. 따라서 단순 `Character commit -> Campaign commit`은 두 번째 write 실패 때 partial durable success를 남긴다.

이를 피하기 위한 기반을 추가했다.

- `a7aa126` / `5c7ebbe`: `characterCampaignCompoundPersistence.test.ts` 계약.
  - preparation은 repository head/store를 변경하지 않는다.
  - 두 번째 participant preflight 실패 시 어느 새 generation도 visible하지 않아야 한다.
  - 성공 시 두 generation을 함께 노출한 뒤 repository rehydrate로 새 head를 읽는다.
- `55b70c7`: `characterCampaignCompoundPersistence.ts` 추가.
  - `prepareCharacterLibraryGeneration()`은 current durable document와 실제 physical generation을 기준으로 next Character payload를 write 없이 생성한다.
  - `prepareCampaignLibraryGeneration()`도 next Campaign generation payload를 write 없이 생성한다.
  - recovered older generation 상황에서도 `storageRevision`은 실제 physical head + 1을 사용한다.
  - `CharacterCampaignCompoundWriter` 계약을 정의한다.
  - `MemoryCharacterCampaignCompoundWriter`는 두 store preflight가 모두 성공한 뒤에만 apply한다.
- `b0f5095`: Memory Character store의 실패/stale/next-generation 검사를 `preflightCompoundWrite()`로 분리하고 기존 단일 `writeGeneration()`도 동일 경로를 사용한다.
- `b4056e5`: Memory Campaign store도 동일하게 preflight/apply를 분리한다.
- 기존 단일-store persistence API와 repository `commit()` semantics는 변경하지 않았다.

### 중요한 원자성 경계

메모리/test 환경의 failure atomicity 기반은 구현됐지만 **Windows/Tauri cross-store writer는 아직 구현하지 않았다**. Tauri의 기존 Character/Campaign commands는 서로 다른 generation directory에 독립적으로 temp+fsync+rename한다. 따라서 production Long Rest coordinator를 연결하기 전에 cross-store transaction command가 필요하다.

Tauri writer는 다음 원칙을 따라야 한다.

1. Character/Campaign expected/next generation을 모두 preflight한다.
2. 두 payload를 모두 durable staging/fsync한 뒤에만 transaction commit point를 만든다.
3. commit point 전 실패는 두 새 generation 모두 invisible이어야 한다.
4. commit point 후 crash/interruption은 다음 read/startup recovery가 둘 다 materialize하거나 명시적 blocker를 반환해야 하며 한쪽만 정상 상태로 노출하면 안 된다.
5. 기존 single-store generation retention/corruption recovery를 깨지 않는다.
6. 단순 순차 repository commit + 추측성 보상으로 구현하지 않는다.

## 5. 검증 상태

- 새 deterministic tests는 source에 추가했으나 이 checkpoint에서 실행 결과를 관찰하지 못했다.
- GitHub direct-push Actions status는 connector에서 여전히 노출되지 않았다.
- comprehensive Codex audit는 V1 전체 구현 완료 전이므로 실행하지 않는다.
- 따라서 이번 Long Rest foundation을 green/DONE으로 주장하지 않는다.

## 6. Next Exact Action

**Tauri Character+Campaign cross-store compound generation writer를 구현한 뒤 production Long Rest coordinator를 연결한다.**

1. `src-tauri/src/generation_store.rs`의 기존 temp+fsync+rename semantics를 재사용/확장한다.
2. transaction staging + commit marker + recovery를 추가하고 Character/Campaign read 전에 committed transaction recovery를 수행한다.
3. 새 Tauri command `write_character_campaign_compound`와 TS `CharacterCampaignCompoundWriter` platform implementation을 연결한다.
4. pre-commit injected failure에서는 두 generation 모두 invisible, committed-interruption recovery에서는 두 generation 모두 최종 상태가 되는 Rust deterministic tests를 추가한다.
5. 그 뒤 production Long Rest coordinator가:
   - canonical domain Long Rest를 resolve;
   - optional Calendar advance를 사용자 선택 시에만 계산;
   - optional Ration consumption을 사용자 선택 시에만 계산;
   - Character/Campaign prepared generations를 단일 compound writer로 commit;
   - 성공 후 repository/adapter state를 rehydrate/project;
   - 실패 시 Scene/Activity/Character/Campaign 어느 쪽에도 partial success를 남기지 않도록 한다.
6. 기존 Rest surface 안에 최소 preview/checkbox/action만 추가하고 현재 UI 구조를 재설계하지 않는다.
7. Calendar/Rations OFF 또는 provider unavailable이면 해당 optional side effect만 비활성화하고 Long Rest 자체는 계속 가능해야 한다.

## 7. 검증 정책

- 기존 exact-head evidence는 보존하고 반복하지 않는다.
- focused deterministic tests는 기능 구현과 함께 작성한다.
- 실제 결과를 관찰하기 전 green/DONE을 주장하지 않는다.
- comprehensive Codex audit는 V1 전체 implementation이 끝난 frozen exact SHA에서만 수행한다.
