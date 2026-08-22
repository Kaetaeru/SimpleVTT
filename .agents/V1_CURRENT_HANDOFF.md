# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded Tauri compound persistence head: **`fed7ed7 fix(persistence): bind compound lock guard lifetime explicitly`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 실제 production 기능 gap을 선택한다.
4. 현재 UI를 V1 baseline으로 보존하고 내부 wiring/authority/persistence를 우선 수정한다.
5. 이미 구현/검증된 작업은 반복하지 않는다.
6. 모든 V1 pre-release 구현이 끝나기 전 comprehensive Codex audit를 시작하지 않는다.

## 2. 보존된 완료/구현 상태

### Ready / connected lifecycle

구조 구현 완료. actor별 Ready, 다음 자기 턴/initiative 종료 만료, Host authoritative ledger, Client projection, reconnect replay, session reset cleanup, `ready-action-v1`, isolated acceptance-pair tooling이 존재한다. Human/two-instance evidence는 후반 acceptance에서 수행한다.

### V1-11 Campaign lifecycle

Production 구현은 완료됐고 exact-head validation evidence만 남아 있다. archive/startup recovery/duplicate/delete 경로가 기존 Campaign UI와 durable application service를 통해 연결돼 있다.

### V1-12 declarative Calendar/Ration provider

RuleModule -> InstalledContent -> Catalog -> Campaign authority 경계를 재사용한 data-only declarative provider core/runtime/UI는 code-connected다.

주요 보존 head:

- `3e364dd` / `b2244d5`: provider schema/parser/stable ID.
- `ad2eb02`: custom calendar round-trip/leap cycle.
- `d1977e1` / `fc5229f` / `a2974b6`: RuleModule 보존/검증/restart decode.
- `2f99068` / `abee49f`: Catalog projection.
- `412047f` / `386814a`: provider-aware Campaign authority and exact version resolution.
- `47de9a2` / `de40e7b`: installed provider selection and existing Campaign UI connection.
- `3284e93` / `b624a48` / `a285f2f`: provider UI contracts/canonical workflow wiring.

식량 부족은 warning/pending DM adjudication일 뿐 자동 damage/Exhaustion을 적용하지 않는다. OFF/missing provider는 unrelated Session/Rest/Action을 막지 않는다.

현재 판단: **provider user path IMPLEMENTATION COMPLETE / EXACT-HEAD VALIDATION PENDING**. 이미 구현된 provider 코드를 validation을 얻기 위해 반복하지 않는다.

## 3. Long Rest canonical authority — 보존

Production generic Long Rest surface는 아직 없지만 domain authority는 이미 존재한다.

- `src/domain/rest.ts::resolveLongRest()`가 HP 최대 회복, Temporary HP 제거, death-save/life flag reset, Hit Dice, declarative `longRest` resource recovery, rest-expired effects, Exhaustion 1단계 제거를 담당한다.
- `resolutionRestOps.ts`는 canonical `kind:"long-rest"` operation/state changes를 제공한다.
- `resources.ts`가 recovery lockout/temporary maximum까지 소유한다.
- 기존 `configureWizardLongRest`, `configurePactTomeRest`, `configureCircleLandRest`는 Rest 전체 해결이 아니라 class-specific rest configuration이다.

따라서 Campaign/UI에서 별도 회복 규칙을 만들면 안 된다.

### Character durable projection

- `98b2de9`: focused contract.
- `aeb65c1`: `characterLongRestProjection.ts`.

이 helper는 domain Rest authority를 호출해 Character-owned HP/Temporary HP/life flags/resources를 투영하고 Session effects output을 반환한다. Campaign time/rations는 의도적으로 포함하지 않는다. dead/0 HP Character를 자동 부활시키지 않는다.

## 4. Character + Campaign compound generation foundation — 보존

### TypeScript / memory

- `a7aa126` / `5c7ebbe`: prepared generation + participant failure atomicity contracts.
- `55b70c7`: `characterCampaignCompoundPersistence.ts` — Character/Campaign next immutable generation payload를 write 없이 준비하고 compound writer contract를 정의.
- `b0f5095` / `b4056e5`: Memory Character/Campaign store가 preflight/apply를 분리하며 normal single-store write도 같은 검증 경로 사용.

Memory writer는 두 participant가 모두 preflight된 뒤에만 apply한다.

## 5. 이번 Rerun — production Tauri cross-store transaction

기존 Tauri Character/Campaign generation store가 각자 독립 temp+fsync+rename을 수행하므로 순차 commit으로는 V1 no-partial-success 요구를 만족할 수 없었다. 이번 dispatch에서 recoverable cross-store commit point를 추가했다.

### generation metadata/primitives

- `cec4030`: shared generation store가 serializable `WriteGenerationRequest`, latest physical generation, final path, pruning primitive를 compound layer에 제공한다. 기존 single-store semantics는 유지된다.
- `ce7e944`: Character generation prefix/label 공개.
- `fb8c609`: Campaign generation prefix/label 공개.

### `character_campaign_compound.rs`

- `908d7e1`: 신규 transaction module.

Commit protocol:

1. pending committed transaction recovery.
2. Character/Campaign expected/next generation 모두 preflight.
3. 두 payload를 normal reader가 무시하는 `.compound.tmp`로 write + `sync_all()`.
4. 두 participant 재-preflight.
5. full request/payload를 가진 marker temp를 write+sync하고 `character-campaign-compound.commit.json`으로 rename. **이 marker rename이 compound commit point다.**
6. Character/Campaign staged payload를 각 immutable generation final path로 materialize.
7. final payload가 marker와 정확히 같은지 검증.
8. retention prune.
9. 두 participant가 모두 완료된 뒤에만 marker 제거.

Commit point 전 실패는 staging을 제거하고 기존 두 generation만 visible하다. Commit point 후 interruption은 compensation이 아니라 recovery 대상으로 취급한다.

Recovery는 한 participant가 이미 final generation으로 materialize돼 있으면 marker payload와 exact equality를 검증하고 나머지 participant를 완성한다. 불일치/복구 불가능 상태는 명시적 error로 막는다.

### deterministic Rust contracts authored

동일 module에 fault points/tests를 추가했다.

- before marker failure => 두 next generation 모두 invisible.
- immediately after marker interruption => recovery가 둘 다 next generation으로 완성.
- after Character materialization interruption => raw disk의 일시적 half-materialized 상태는 marker를 보존하고 recovery가 Campaign까지 완성.

테스트 실행 결과는 아직 관찰하지 못했으므로 pass를 주장하지 않는다.

### Tauri command / recovery fence

- `ae42e81`: `src-tauri/src/lib.rs`
  - Character/Campaign persistence용 shared process mutex 추가.
  - normal Character read/write와 Campaign read/write가 모두 같은 mutex를 잡고 pending compound `recover_at(root)`를 먼저 수행.
  - `write_character_campaign_compound` command 등록.
- `fed7ed7`: mutex guard 반환 lifetime을 explicit하게 만들어 Rust lifetime ambiguity 위험을 제거.
- `88cc8a7`: `TauriCharacterCampaignCompoundWriter` TS bridge 추가.
- `b931cdc`: existing Campaign Tauri structure regression을 새 compound/recovery boundary에 맞춤.

중요: source wiring만 확인했다. Rust/TS build/test green evidence는 아직 없다.

## 6. Production wiring inspection

Generic Rest control은 현재 다음 Session surfaces 어디에도 없다.

- `PlaySessionDock`
- `SessionActionDock`
- `SessionDmTools`
- `SessionCampaignPane`

따라서 V1 UI baseline을 보존하려면 새 별도 screen/redesign이 아니라 **기존 `SessionCampaignPane` 내부의 최소 Long Rest preview/options/action block**이 적합하다.

실제 authority 경계:

`AppProvider -> MockAdapter runtime patches -> CampaignApplicationService / Character persistence -> repositories`

- `AppProvider`는 `campaignRuntimeAdapter`를 import하고 MockAdapter Campaign API를 그대로 UI에 노출한다.
- `CampaignApplicationService`가 provider-aware Calendar/Ration mutation과 preview arithmetic을 소유한다.
- `characterLibraryRuntimeAdapter`는 private Character repository context를 소유하며 기존 durable mutation/write-back을 담당한다.
- `campaignRuntimeAdapter`는 private Campaign service context를 소유한다.
- 둘 다 테스트 store injection helper는 있지만 compound coordinator가 두 prepared generations를 동시에 만들고 성공 후 두 runtime head를 반영할 수 있는 production seam은 아직 없다.

React에서 Calendar/Ration 계산을 복제하거나 public single-store mutation 두 개를 순차 호출하지 않는다.

## 7. Current Next Exact Action

**Production Long Rest compound coordinator + minimal SessionCampaignPane control을 구현한다.**

1. Character/Campaign runtime adapter private contexts에 최소 explicit seam/registered port를 추가해 한 coordinator가 두 hydrated durable heads를 다룰 수 있게 한다. 기존 single-store paths는 유지한다.
2. preview/input 계약을 만든다:
   - Rest는 실행 대상.
   - Calendar advance는 user-selected optional effect.
   - Ration consumption도 independently optional.
3. Character candidate는 `projectCharacterLongRest`를 통해 계산한다.
4. Campaign candidate는 `CampaignApplicationService`의 provider-aware authority를 재사용해 만든다. UI 계산 금지.
5. exactly one next Character generation + exactly one next Campaign generation을 prepare한 뒤 platform compound writer 하나만 호출한다.
6. writer 성공 후에만 두 repository/runtime state를 accept/rehydrate/project한다. 실패 시 Character/Campaign/Scene/Activity partial success가 남지 않아야 한다.
7. Calendar/Rations OFF 또는 provider unavailable이면 그 optional selection만 disabled/unavailable이고 Rest 자체는 계속 실행 가능해야 한다.
8. deterministic tests: Rest-only, time only, rations only, both, unavailable provider, duplicate/idempotent request, compound writer failure.
9. existing `SessionCampaignPane`에 최소 preview/checkbox/action만 추가한다. 주변 Campaign/Session UI는 재배치/재설계하지 않는다.
10. focused Rust/TypeScript checks를 실제 관찰한 뒤에만 green을 기록한다.

## 8. 검증 정책

- 기존 exact-head evidence는 보존하고 반복하지 않는다.
- 새 source-authored tests는 실행 증거가 없으면 green으로 간주하지 않는다.
- declarative-provider exact-head CI 증거가 나중에 보이면 기록하되 이미 구현된 provider 코드를 재개하지 않는다.
- comprehensive Codex audit는 V1 전체 implementation이 끝난 frozen exact SHA에서만 수행한다.
