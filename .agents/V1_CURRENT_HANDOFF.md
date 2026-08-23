# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded V1-13 product source head: **`45c6dae test(campaign): include exact owner compensation contract`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 인수인계 문서다. 실행 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 제품 계약은 `docs/design/`, 작업 루트는 `CANONICAL_ROOT.md`, 현재 Rerun 실행 지점은 `.chatgpt-rerun/STATE.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. V1-12 또는 이미 source-connected된 V1-13 owner routing/journal을 validation만 얻기 위해 다시 구현하지 않는다.
4. 현재 Session UI, Player-owned remote Character durability, Host Campaign ownership을 보존한다.
5. comprehensive Codex audit는 모든 V1 implementation slice가 source-connected된 뒤 exact SHA에서 수행한다.

## 2. V1-12 보존 상태

Connected Long Rest는 normal durable-storage path 기준 **source implementation complete / validation pending**이다.

보존할 핵심:

- owner invisible durable Character prepare;
- Tauri prepared-generation write barrier;
- Host durable coordinator before Campaign global commit;
- stable Campaign commit identity;
- post-global Host/Player restart recovery;
- pre-global double-restart exact abort recovery;
- owner-aborted acknowledgement cleanup/idempotency;
- fresh owner SessionProjection -> Host remote durable refresh;
- Host는 remote Character를 자기 Character library에 저장하지 않음.

Executable/release evidence가 없으므로 V1-12 checklist는 `PARTIAL` 유지다.

## 3. V1-13 기존 기반

Release checklist의 `TODO` 표시는 실제 source보다 오래됐다. 기존 source에는 이미 다음이 있다.

- Campaign-owned Party Stash items/wallet/revision/policy;
- local Character <-> Stash item/GP movement + Campaign persistence compensation;
- connected Player self-service Stash request -> Host Campaign commit;
- custom/charged item Stash round-trip;
- Campaign DM Library custom-item Character/Stash grant, NPC instantiate, image reveal 기반;
- local deterministic Stash/DM Library tests.

새 시스템을 복제하지 않는다.

## 4. V1-13 owner durability — 현재 source-connected 경계

### Remote Character ownership

Host의 mounted remote Character inventory 변경은 owner Client로 라우팅한다.

- owner Client가 자기 Character library에 durable write;
- fresh `CharacterSessionProjectionV1`을 Host에 반환;
- Host는 projection/session inventory/accepted manifest revision만 refresh;
- Host Character library에는 remote Character copy 없음.

### Request-scoped compensation

- `undoDmInventoryAdjustment(requestId)`;
- request별 before/after;
- whole snapshot restore가 아닌 exact item/GP delta compensation;
- later unrelated mutation은 가능한 한 보존;
- unsafe divergence는 overwrite 대신 reject.

### Durable owner inventory journal

Tauri Character-library 디렉터리에 append-only journal이 추가됐다.

- base `connected-owner-inventory.<hex(requestId)>.json` — request/actor/command/before;
- `.applied` — exact after state;
- `.undoing` — exact beforeUndo + afterUndo;
- `.undone`;
- `.finalized` — `applied` 또는 `undone`.

Source:
- `src-tauri/src/connected_owner_inventory.rs`
- `src/app/connectedOwnerInventoryJournalStore.ts`
- `src/app/connectedOwnerInventoryJournalAdapter.ts`

Safety behavior:

1. journal base marker를 Character mutation 전에 기록한다.
2. Character apply 후 ack/`.applied` 전에 owner가 죽으면, 재시작 시 before/current + exact command delta로 이미 apply됐는지 판별한다.
3. 이미 apply됐으면 다시 적용하지 않고 `.applied`만 복구한다.
4. undo 전에 `.undoing`에 beforeUndo/afterUndo를 기록한다.
5. undo commit 후 `.undone` 전에 죽어도 재시작 시 current==afterUndo를 확인해 double undo 없이 `.undone`만 기록한다.
6. 이전 process의 in-memory undo record가 없어도 journal의 exact target으로 durable compensation 가능하다.
7. duplicate undo/finalize는 idempotent하다.

### Compound finalization

Host/owner finalize request/result가 추가됐다.

- direct remote DM inventory mutation은 owner ack 뒤 finalize;
- Party Stash/DM Library Character action은 Campaign-side 작업이 끝날 때까지 finalize를 defer;
- 성공 => owner journal `applied` finalize;
- compensation 성공 => `undone` finalize;
- DM Library Character grant 뒤 Campaign recents write가 실패하면 exact owner compensation을 시도한다.

### Exact Host Stash compensation

`connectedOwnerInventoryExactCompensationAdapter.ts`가 connected Host `transferPartyStash(command)` 실행 동안 정확한 `command.requestId`를 bind한다.

기존 Campaign runtime이 compatibility `undoLastDmInventoryAdjustment()`를 호출해도 connected Host에서는 `undoDmInventoryAdjustment(activeRequestId)`로 강제된다. 다른 request의 global last-undo를 잘못 취소하지 않는다.

## 5. Focused source contracts

새 source contracts:

- `connectedOwnerInventoryJournal.test.ts` — durable phase/idempotency;
- `connectedOwnerInventoryJournalStructure.test.ts` — production/Tauri wiring;
- `connectedOwnerInventoryRestart.test.ts` — apply-before-ack restart, restart undo, undo-before-sidecar restart;
- `connectedOwnerInventoryExactCompensationStructure.test.ts` — exact Host Stash request binding.

이 테스트들은 `connectedLongRestRestartDurabilityStructure.test.ts`를 통해 기존 `npm run test:campaign-rest` focused suite에 source-wired됐다.

Exact product/test head: `45c6dae19f2f6721e0fe012079cb6436f80b0938`.

## 6. Critical remaining V1-13 gap — Host process restart

**Connected Party Stash cross-store atomicity를 완료했다고 표시하지 않는다.**

Owner process restart/lost owner ack는 journal로 source-covered됐지만, 다음 Host crash window는 남아 있다.

1. owner journal/Character apply가 durable 성공;
2. Host Party Stash Campaign request가 아직 commit되지 않았거나, commit 여부를 Host가 durable하게 기억하지 못함;
3. Host process가 undo/finalize 전에 종료;
4. restarted Host에는 해당 owner request를 finalize할지 undo할지 판단할 coordinator가 없음.

Campaign request가 commit되지 않았다면 Character-only durable success가 남을 수 있다.

다음 구현은 durable Host coordinator 또는 owner-journal reconnect synchronization으로 이 상태를 회수해야 한다. Campaign idempotency(`recentRequestIds`)를 authoritative evidence로 사용한다.

- Campaign request 있음 => owner `applied` finalize;
- Campaign request 없음 => owner undo -> `undone` finalize.

Duplicate recovery/finalize delivery와 finalize-ack loss도 idempotent해야 한다.

## 7. Validation status

**NO GREEN CLAIM.**

Exact product head `45c6dae19f2f6721e0fe012079cb6436f80b0938` 기준:

- combined commit statuses: none;
- commit-associated workflow runs: none.

관찰되지 않은 실행 증거:

- `npm run test:campaign-rest`;
- `tsc --noEmit` / `npm run build`;
- Rust/Tauri build/tests;
- Windows two-instance Stash/DM Library restart/reconnect acceptance.

Source-authored tests는 실행 증거가 아니다.

## 8. Next Exact Action

1. Rerun mandatory files와 actual `work/v1-composite` HEAD를 reconcile한다.
2. exact-head 실행 증거가 없으면 V1-12와 owner journal/restart slice를 반복하지 않는다.
3. connected Party Stash Host process restart recovery를 구현한다.
4. Campaign idempotency로 `finalize applied` 대 `undo + finalize undone`을 결정한다.
5. Host restart/reconnect, duplicate recovery, finalize-ack loss deterministic tests를 추가한다.
6. 그 뒤 남은 V1-13 DM Library privacy/isolation/user-reachable UI audit를 진행한다.
7. comprehensive Codex audit는 implementation freeze 뒤 수행한다.
