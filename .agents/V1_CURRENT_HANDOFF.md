# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded V1-13 product source head: **`05eb679 test(campaign): cover owner inventory wire validation`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 인수인계 문서다. 실행 우선순위와 완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 제품 계약은 `docs/design/`, 작업 루트는 `CANONICAL_ROOT.md`, 현재 Rerun 실행 지점은 `.chatgpt-rerun/STATE.md`가 우선한다.

## 1. 재개 절차

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이미 source-connected된 V1-12 또는 아래 V1-13 normal owner write-back을 validation을 얻기 위해 다시 구현하지 않는다.
4. 현재 Session UI와 Player-owned remote Character durability를 보존한다.
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

V1-12 executable/release evidence는 아직 없으므로 checklist 상태는 `PARTIAL` 유지다.

## 3. V1-13 actual audit result

Release checklist의 V1-13 `TODO` 표시는 실제 source보다 오래됐다. 기존 canonical source에는 이미 다음이 있었다.

- Campaign-owned Party Stash items/wallet/revision/policy;
- local Character <-> Stash item/GP movement;
- Campaign persistence failure compensation;
- connected Player self-service Stash request -> Host Campaign commit;
- catalog-less/custom charged item Stash round-trip;
- Campaign DM Library custom-item Character/Stash grant, NPC instantiate, image reveal 기반;
- local deterministic Party Stash / DM Library tests.

따라서 새 시스템을 복제하지 않는다.

## 4. 이번에 source-connected된 V1-13 경계

첫 실제 ownership gap은 Host가 mounted remote Player Character에 DM inventory mutation을 수행할 때였다.

기존 `sessionInventoryRuntimeAdapter.adjustDmInventory()`는 process-local active Character만 Character library에 durable write했고, remote mounted Character는 Host/session shadow만 바뀔 수 있었다. 이 때문에 Host-side Party Stash, GP, DM Library Character grant가 Player-owned durable Character를 우회할 수 있었다.

현재 source는 이를 다음처럼 보완한다.

### Request-scoped compensation

- `undoDmInventoryAdjustment(requestId)` 추가;
- request별 before/after record;
- whole-snapshot restore 대신 exact GP/item-instance delta 보상;
- later unrelated mutation을 가능한 한 보존;
- stale equip/attunement compensation은 덮어쓰지 않고 reject;
- `undoLastDmInventoryAdjustment()`는 compatibility wrapper로 유지.

Relevant source commit: `9f123cdde3056e253a8584e76ffff36e54624e7c`.

### Host -> owner Client durable write-back

`connectedCampaignSystemsRuntimeAdapter.ts`에 validated `campaign-owner-inventory` apply/undo/result 경로가 추가됐다.

1. Host가 mounted remote Character target을 감지한다.
2. Host shadow mutation 대신 accepted owner peer로 exact command를 보낸다.
3. owner Client가 자기 active Character에 기존 `adjustDmInventory()`를 실행하므로 Character library durable writer가 실제 write를 소유한다.
4. owner가 fresh `CharacterSessionProjectionV1`을 반환한다.
5. Host가 peer/Character/source/runtime revision을 확인한다.
6. Host는 `refreshReconstructedCharacterSessionProjection()`으로 remote durable facts만 갱신한다.
7. session-visible remote inventory와 accepted peer manifest revision도 갱신한다.
8. Host Character library에는 remote Character copy가 생기지 않는다.

Relevant source commit: `706fc1a8a55e2d9b9e6c58a09a3849fa882161a0`.

Connected Player Stash rejection/timeout rollback도 global last-undo가 아니라 exact request-id undo를 사용한다.

Focused source contracts:

- `tests/ui/sessionInventoryRuntimeAdapter.test.ts` — request-scoped delta compensation;
- `tests/ui/connectedCampaignSystemsStructure.test.ts` — owner routing/fresh Host projection boundary;
- `tests/ui/connectedCampaignOwnerInventoryWire.test.ts` — apply/undo/result wire validation.

Latest product source head for this slice: `05eb6790404ed617b8b15702b0372bd6a4bef8ee`.

## 5. Critical remaining V1-13 durability gap

**Do not mark connected Party Stash/DM Library Character mutation release-complete.**

Current request-id and undo records in `sessionInventoryRuntimeAdapter` are process memory. Failure window:

1. Host sends owner apply;
2. owner commits Character generation;
3. owner process or acknowledgement dies before Host observes success;
4. Host requests undo/compensation;
5. restarted owner lacks the exact pre-mutation journal.

A blind inverse is unsafe because Host cannot know whether apply committed before the lost ack.

Next implementation must create a durable owner inventory transaction journal/sidecar with Long-Rest-like safety properties:

- exact transaction/request identity;
- durable knowledge of prepared/applied/aborted-or-undone/finalized state;
- enough before/after data or exact generation identity for safe restart compensation;
- apply replay idempotency across owner restart;
- undo after lost ack and owner restart;
- finalize/cleanup only once Host no longer needs compensation;
- no remote Character durable copy on Host.

Also remove the remaining Host Character->Stash dependence on underlying `undoLastDmInventoryAdjustment()`; exact request identity must own the compensation path before concurrency/restart acceptance is closed.

## 6. Validation status

**NO GREEN CLAIM.**

Exact product head `05eb679` had:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the new V1-13 tests, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library scenarios. Source-authored tests are not execution evidence.

## 7. Next Exact Action

1. Reconcile Rerun mandatory files and actual `work/v1-composite` HEAD.
2. If exact-head execution evidence is still absent, preserve V1-12 and the normal V1-13 owner write-back rather than reimplementing them.
3. Implement durable owner inventory transaction journal/sidecar for `campaign-owner-inventory` apply/undo/finalize.
4. Add restart/replay tests: apply committed before lost ack; owner restart then undo; duplicate apply/undo/finalize; no Character-only/Campaign-only durable success; fresh Host projection after recovered completion.
5. Replace Host Stash global last-undo dependency with exact transaction identity.
6. Then finish remaining V1-13 DM Library privacy/isolation/user-reachable UI audit before moving to later V1 slices.
