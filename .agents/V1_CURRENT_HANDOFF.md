# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded local Long Rest implementation head: **`7e85dc1 test(rest): wire long rest compound suite into build`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 단일 인수인계 문서다. 전체 출시 작업의 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 실제 제품 계약은 `docs/design/`, 작업 루트 판정은 저장소 루트의 `CANONICAL_ROOT.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 실제 production 기능 gap을 선택한다.
4. 현재 UI를 V1 baseline으로 보존하고 내부 wiring/authority/persistence를 우선 수정한다.
5. 이미 구현된 기능을 validation을 얻기 위해 반복하지 않는다.
6. 모든 V1 pre-release 구현이 끝나기 전 comprehensive Codex audit를 시작하지 않는다.

## 2. 보존된 구현 상태

### Ready / connected lifecycle

actor별 Ready, 다음 자기 턴/initiative 종료 만료, Host authoritative ledger, Client projection, reconnect replay, session reset cleanup, `ready-action-v1`, isolated acceptance-pair tooling이 존재한다. Human/two-instance evidence는 후반 acceptance에서 수행한다.

### V1-11 Campaign lifecycle

Production archive/startup recovery/duplicate/delete 경로가 기존 Campaign UI와 durable application service에 연결돼 있다. exact-head validation evidence는 별도 대기 상태다.

### Declarative Calendar/Ration provider

RuleModule -> InstalledContent -> Catalog -> Campaign authority 경계를 재사용한 data-only provider path는 source-connected다. Custom Calendar/Ration은 exact pinned provider version을 사용하고, missing provider는 해당 optional capability만 unavailable로 만든다. 식량 부족은 warning/adjudication 대상으로 남으며 자동 damage/Exhaustion을 만들지 않는다.

현재 판단: **IMPLEMENTATION COMPLETE / EXACT-HEAD VALIDATION PENDING**. 이 provider 구현을 다시 만들지 않는다.

## 3. Long Rest canonical authority — 보존

Long Rest 규칙은 Campaign/UI가 소유하지 않는다.

- `src/domain/rest.ts::resolveLongRest()`가 HP, Temporary HP, life/death-save flags, Hit Dice, declarative long-rest resources, rest-expired effects, Exhaustion 1단계 회복을 담당한다.
- `resolutionRestOps.ts`와 `resources.ts`가 canonical state change/recovery semantics를 제공한다.
- `characterLongRestProjection.ts`는 durable Character projection을 위해 위 authority를 재사용한다.
- Calendar advance와 Ration consumption은 Rest의 필수 효과가 아니며 각각 명시적인 opt-in Campaign side effect다.

## 4. Character + Campaign cross-store persistence — 보존

### Memory / preparation

- prepared Character/Campaign immutable generations는 production store를 변경하지 않고 생성된다.
- Memory Character/Campaign stores는 two-participant preflight/apply를 분리한다.
- Memory compound writer는 두 participant preflight 이후에만 generation을 노출한다.

### Tauri recoverable transaction

Tauri에서는 단순 Character commit -> Campaign commit을 사용하지 않는다.

보존 구현:

- `908d7e1`: `character_campaign_compound.rs`
  - 두 store preflight;
  - 두 payload invisible staging + fsync;
  - `character-campaign-compound.commit.json` marker rename을 단일 commit point로 사용;
  - committed interruption recovery;
  - 이미 한 participant가 materialize된 경우 marker payload exact equality를 확인한 뒤 나머지를 완료;
  - pre-commit failure / post-marker interruption / after-Character-materialization interruption fault tests authored.
- `ae42e81`: Character/Campaign normal Tauri I/O가 같은 mutex를 사용하고 pending compound recovery를 먼저 수행.
- `fed7ed7`: explicit Rust mutex guard lifetime.
- `88cc8a7`: `TauriCharacterCampaignCompoundWriter`.
- `b931cdc`: Tauri structure regression updated.

Rust 실행 결과는 아직 관찰하지 못했다. Source-connected 상태를 green으로 오인하지 않는다.

## 5. 이번 Rerun — local authoritative Long Rest production path

### Compound preview/commit authority

`src/app/longRestCompoundCoordinator.ts`가 local active Character + Campaign compound orchestration을 소유한다.

주요 head:

- `8ed90d2`: durable Campaign capability뿐 아니라 effective Session Calendar/Ration OFF state까지 존중.
- `c1664db`: `previewLongRestCompound()` 추가 및 commit과 동일 candidate 계산 공유.

동작:

1. master transaction/Campaign/Character identity 검증.
2. Campaign `recentRequestIds`에서 master transaction duplicate를 먼저 확인해 repeated Character Rest를 차단.
3. Character는 `projectCharacterLongRest`로만 계산.
4. Campaign candidate는 isolated Memory Campaign repository + `CampaignApplicationService`로 계산.
5. Calendar/Ration은 각각 user-selected일 때만 authoritative Campaign command를 실행.
6. effective capability OFF 또는 pinned custom provider unavailable이면 그 optional effect만 skip하고 warning 반환.
7. master transaction ID를 Campaign durable idempotency ledger에 기록.
8. one Character generation + one Campaign generation 준비.
9. one compound writer 호출.
10. writer 성공 후에만 committed candidate 반환.

Rest-only transaction도 master idempotency를 durable하게 남기기 위해 Campaign participant generation을 포함하지만 Calendar/Ration 값은 바꾸지 않는다.

### Production runtime bridge

`src/app/longRestCompoundRuntimeAdapter.ts`가 실제 runtime path를 연결한다.

주요 head:

- `1fd3071`: initial runtime bridge.
- `2f97b01`: explicit Character/Campaign store + writer boundary typing.
- `7e0e5ce`: authoritative production preview API.

동작:

- 현재 `MockAdapter` snapshot의 persisted active Character와 full Campaign records를 사용한다.
- Character durable document는 기존 Character persistence runtime context에서 가져온다.
- custom provider는 Catalog의 exact pinned descriptor를 사용한다.
- Tauri에서는 실제 platform Character/Campaign store handle + `TauriCharacterCampaignCompoundWriter`를 사용한다.
- browser/test volatile mode에서는 current durable state로 paired Memory stores를 seed하고 Memory compound writer를 사용한다.
- existing public Character mutation 후 Campaign mutation 같은 sequential commit은 호출하지 않는다.
- compound writer 성공 전에는 current Character/Campaign/Scene projection을 변경하지 않는다.
- writer 성공 후에만 두 persistence context를 committed stores로 전환하고 `adapter.getSnapshot()`으로 rehydrate한다.
- 기존 Character hydration path가 active Character와 Scene entity HP/life projection을 함께 갱신한다.
- resulting snapshot은 기존 external adapter snapshot event channel로 publish된다.

현재 bridge는 기존 context-reset helper `setCharacterLibraryStoreForTests` / `setCampaignLibraryStoreForTests`를 production seam으로 재사용한다. Semantics는 필요한 동작을 제공하지만 이름은 test-oriented다. Final freeze 전 audit에서 maintainability 문제가 되면 production-named port로 rename/refactor할 수 있다. Sequential commits로 되돌리면 안 된다.

## 6. Existing Session UI integration

기존 `SessionCampaignPane`의 Party / Advancement / Calendar / Ration 구조를 유지한 채 DM 전용 Long Rest block 하나만 추가했다.

주요 head:

- `1455b1b`: initial Rest block.
- `b99bb4c`: authoritative preview 표시.

현재 UI:

- active Character name;
- HP current -> Rest candidate;
- Temporary HP current -> candidate;
- optional `캠페인 시간 +8시간`, default OFF;
- optional `하루치 식량 소비`, default OFF;
- selected Calendar/Ration candidate 결과;
- capability/provider warning;
- 0 HP / preview failure commit disable;
- one `장기 휴식 적용` command.

Calendar/Ration controls는 effective Session capability OFF일 때 각각 disabled된다. UI는 application preview/command만 호출하고 domain arithmetic을 소유하지 않는다. 별도 screen/layout redesign/CSS-system 변경은 하지 않았다.

## 7. Focused deterministic contracts / build wiring

Source-authored tests:

- `79bd7d7`: coordinator Rest-only, Calendar-only, Ration-only, both, Session OFF, missing provider, duplicate master transaction, writer rejection atomicity.
- `12cd4f3`: preview performs no production writes and matches commit candidate.
- `c5d2bf7`: volatile production bridge rehydrate including Character/Scene/Campaign projections and no-option Rest behavior.
- existing `characterLongRestProjection.test.ts` and `characterCampaignCompoundPersistence.test.ts` remain part of the slice.

`7e85dc1` adds:

- `npm run test:campaign-rest`
- `npm run build` now invokes that focused suite after TypeScript / existing creation/rules validation and before Vite build.

## 8. Validation status

**NO GREEN CLAIM.**

Current connector evidence for the new implementation head:

- combined commit status returned no statuses;
- commit-associated workflow lookup returned no runs;
- direct Actions run listing was not available through the connector.

No observed `tsx`, `tsc`, `npm run build`, Rust tests, Tauri build, or Windows execution exists for this exact Long Rest implementation checkpoint.

Therefore:

- local active-Character Long Rest user path: **SOURCE-CONNECTED / VALIDATION PENDING**;
- Tauri compound persistence: **SOURCE-CONNECTED / VALIDATION PENDING**;
- V1-12: **PARTIAL**, not DONE;
- comprehensive Codex audit: deferred.

## 9. Remaining V1-12 boundary — connected Character ownership

`docs/design/campaign-systems.md` describes Character-by-Character Rest preview plus DM/owner decisions. The local bridge currently operates on the locally persisted active Character. It intentionally does not turn a remote host-unknown Character into a host-owned durable Character.

Next source reconciliation must determine whether V1 requires one connected DM Rest flow to include remote/host-unknown Characters.

If required:

- reuse existing connected Session Character projection, Host authority, reconnect replay, and Character write-back path;
- preserve Character ownership / participant decision semantics;
- connect durable changes through the compound transaction boundary without creating duplicate host Character records;
- keep Rest-expired Session effects transient.

If current connected contracts establish that V1 Long Rest is owner/local-Character initiated rather than one DM batch over all remote owners, document that source-backed decision instead of inventing extra scope.

## 10. Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and current `work/v1-composite` head.
2. Check for newly observable focused validation (`npm run test:campaign-rest`, TypeScript/build, Rust `character_campaign_compound` tests). If unavailable, do not redo this source-connected slice.
3. Audit existing connected Session Character authority/reconnect/write-back against the Campaign Rest owner-decision contract.
4. Implement connected Long Rest only if the current V1 contract actually requires it; never persist host-unknown remote Character data as host-owned Character data merely to reuse the local coordinator.
5. Otherwise record the scope determination and reconcile V1-12 status/evidence.
6. Then reconcile V1-13 Party Stash / Campaign DM Library against actual current source before editing. The release checklist label is stale relative to existing runtime/UI methods, so identify the real functional gaps instead of duplicating implementation.
7. Preserve the current UI and keep the comprehensive Codex audit deferred until the pre-release candidate.
