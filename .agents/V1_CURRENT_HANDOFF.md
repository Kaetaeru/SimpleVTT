# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded connected Long Rest source head: **`78e829b test(rest): lock idempotent abort acknowledgement state`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 인수인계 문서다. 실행 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 제품 계약은 `docs/design/`, 작업 루트는 `CANONICAL_ROOT.md`, 현재 Rerun 실행 지점은 `.chatgpt-rerun/STATE.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이 문서와 `V1_RELEASE_EXECUTION_CHECKLIST.md`에서 다음 실제 production gap을 고른다.
4. 이미 source-connected된 Connected Long Rest를 validation을 얻기 위해 다시 구현하지 않는다.
5. 현재 Session UI를 V1 baseline으로 보존하고 authority/persistence 경계를 우선한다.
6. 모든 V1 implementation slice가 source-connected되기 전 comprehensive Codex audit를 시작하지 않는다.

## 2. 보존된 V1 기반

다음은 다시 만들지 않는다.

- Character immutable-generation persistence / corruption recovery / stale writer protection;
- Campaign aggregate/store/application/Tauri generation persistence;
- Campaign product route/dashboard/session snapshot;
- roster, Calendar/Ration declarative provider, history;
- Ready lifecycle / connected action authority / reconnect replay;
- Host-unknown Character `SessionProjection`과 owner durable write-back;
- local authoritative Long Rest projection + Character/Campaign compound transaction;
- Party Stash / Campaign DM Library에 이미 존재하는 runtime/UI 경로 — V1-13에서는 실제 gap만 감사한다.

Remote Character durable ownership은 Player Character store에 남는다. Host는 remote Character를 자기 Character library에 복사하지 않는다.

## 3. V1-12 Connected Long Rest — source implementation complete / validation pending

`docs/design/campaign-systems.md`의 compound transaction 계약에 따라 connected Long Rest는 DM/owner 결정을 수집하고 Character-only / Campaign-only durable partial success를 허용하지 않는다.

현재 source-connected path:

1. DM이 기존 Session Campaign REST 영역에서 connected remote Character를 선택한다.
2. 기존 `+8시간` / 식량 opt-in을 그대로 사용해 exact Campaign + Character revision offer를 전송한다.
3. owner는 canonical Character Long Rest preview에서 HP/temp HP를 확인하고 Accept/Decline한다.
4. Host가 current Campaign/owner/mounted Character authority를 다시 preflight한 뒤 explicit prepare authorization을 보낸다.
5. owner는 Character next generation을 durable하지만 invisible하게 prepare한다.
6. prepared marker가 존재하는 동안 Tauri normal Character write 및 Character+Campaign compound write는 차단된다.
7. Host는 owner-prepared identity를 durable coordinator에 먼저 기록한다.
8. 그 다음에만 Campaign Calendar/Ration/idempotency participant를 global commit한다.
9. Campaign commit id는 `<transactionId>:campaign-commit-v1`로 revision 변화와 무관하게 안정적이다.
10. owner는 global commit 뒤 exact prepared Character generation을 materialize하고 fresh `CharacterSessionProjectionV1`을 보낸다.
11. Host는 remote durable Character projection만 갱신하며 initiative/status/economy 같은 Session transient authority는 보존한다.
12. owner materialization ack 뒤 Host coordinator record를 제거한다.

## 4. Restart / retry durability

### Post-global commit

- Host coordinator는 append-only immutable Tauri version files이다.
- Host restart 시 Campaign `recentRequestIds`가 transaction을 증명하면 durable record를 `committed`로 복구하고 global commit을 재전송한다.
- global commit에는 ownerParticipantId + prepared Character revision + preparationId가 포함될 수 있다.
- Player process restart로 in-memory ClientRecord가 없어도 Tauri preparation marker를 exact identity로 materialize한다.
- materialized response는 idempotent하게 다시 보낼 수 있다.

### Pre-global commit

- Host restart 시 Campaign idempotency가 없으면 durable owner-prepared record를 `aborted`로 복구한다.
- abort replay는 exact owner/Character/preparation identity를 포함한다.
- restarted Player는 ClientRecord 없이 durable Character preparation을 직접 abort한다. Character generation은 materialize되지 않는다.
- `.aborted` sidecar가 source of truth이므로 abort ack 유실 뒤 정상 Character write가 진행돼도 later abort replay는 idempotent하게 cleanup/ack할 수 있다.
- Player는 `long-rest-owner-aborted` ack를 보낸다.
- Host는 exact identity를 검증한 뒤 durable abort coordinator record를 삭제하고 in-memory record를 `aborted-complete`로 유지해 duplicate ack도 idempotent하게 수렴시킨다.

### Windows-safe markers

Owner preparation은 기존 marker overwrite rename을 사용하지 않는다.

- immutable base marker;
- immutable `.materialized` sidecar;
- immutable `.aborted` sidecar.

Host coordinator도 overwrite replacement가 아니라 append-only immutable versions를 사용한다.

## 5. Visible UI

기존 `SessionCampaignPane` 레이아웃을 유지한다.

DM:
- remote connected Player Character에 장기 휴식 제안;
- 기존 Calendar +8h / ration 선택 재사용.

Player:
- HP / Temporary HP before -> after preview;
- Accept / Decline;
- accepted / prepared / committed / complete / aborted 진행 상태;
- 제출 후 decision 변경 불가.

새 full-screen Rest route는 만들지 않았다.

## 6. Focused contracts

`npm run test:campaign-rest`에 connected Long Rest 관련 다음 계약이 포함돼 있다.

- preflight / transaction state / wire codec;
- owner durable preparation and persistence;
- Host Campaign participant global commit/idempotency;
- full distributed runtime ordering;
- visible UI structure;
- Host process-restart committed/aborted reconstruction;
- abort/global-commit restart identity;
- durable abort acknowledgement cleanup and duplicate ack idempotency;
- Tauri prepared-generation write-barrier structure.

중요: 이것들은 **source-authored tests**다. 현재 exact head에서 실행됐다는 뜻이 아니다.

## 7. Validation status

**NO GREEN CLAIM.**

Exact source head `78e829bdfa5b5c8a1de0f8b89c8493e09d7aacc0` 기준 GitHub combined status와 commit-associated workflow run은 비어 있다.

아직 관찰되지 않은 실행 증거:

- `npm run test:campaign-rest`;
- `tsc --noEmit` / `npm run build`;
- `cargo test --manifest-path src-tauri/Cargo.toml`;
- Tauri Windows build;
- Windows two-instance Host/Player restart/reconnect walkthrough.

따라서 release checklist의 V1-12는 **PARTIAL**을 유지한다. 구현은 source-complete지만 executable/release evidence가 없다.

Known exceptional-storage risk: Host가 owner prepare를 받은 직후 Host coordinator durable write 자체가 I/O failure로 실패하고 abort delivery 전에 process도 죽는 경우, Campaign global commit은 실행되지 않으므로 durable partial success는 없지만 owner prepared marker가 orphan lock으로 남을 수 있다. 정상 durable-storage path의 transaction semantics와 별개인 persistence-failure recovery UX로 추적한다. 이를 GREEN 또는 release evidence로 오인하지 않는다.

## 8. Next Exact Action

1. Rerun mandatory files와 current `work/v1-composite` head를 reconcile한다.
2. exact-head 실행 증거가 새로 생겼으면 Connected Long Rest focused suite / TypeScript / Rust부터 확인한다. 없으면 구현을 반복하지 않는다.
3. V1-13 Party Stash / Campaign DM Library를 **실제 current source 기준으로 감사**한다. Release checklist의 TODO 표시는 기존 runtime/UI 구현보다 오래됐으므로 복제 구현 금지.
4. V1-13에서 실제 user-reachable/persistence/privacy/connected gap만 deterministic contract와 함께 source-connect한다.
5. 이후 V1-40/41/42 등 남은 unblocked implementation slice를 dependency order로 진행한다.
6. comprehensive Codex audit는 V1 implementation freeze 뒤 exact SHA에서 한 번에 수행한다.
