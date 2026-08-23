# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded V1-13 product/test head: **`e299cf8 test(campaign): cover Player Stash Host restart checkpoint`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 인수인계 문서다. 실행 우선순위/완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 제품 계약은 `docs/design/`, 작업 루트는 `CANONICAL_ROOT.md`, 현재 실행 지점은 `.chatgpt-rerun/STATE.md`가 우선한다.

## Resume rules

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이미 source-connected된 V1-12, owner journal, Host/Player Stash recovery, item projection을 validation만 얻기 위해 다시 구현하지 않는다.
4. Player-owned remote Character durability와 Host-owned Campaign/Session authority를 유지한다. Host Character library에 remote Character를 복사하지 않는다.
5. comprehensive Codex audit는 V1 implementation freeze 뒤 exact SHA에서 수행한다.

## V1-12 preserved

Connected Long Rest normal durable-storage path는 **source implementation complete / validation pending**이다. Owner invisible prepare, Tauri write barrier, Host durable coordinator, stable Campaign commit, Host/Player restart recovery, exact abort cleanup/ack, fresh remote projection refresh를 보존한다. 실행 증거가 없으므로 release checklist V1-12는 `PARTIAL` 유지다.

## V1-13 current source boundary

Release checklist의 `TODO` 표시는 stale하다. 기존 Party Stash/DM Library runtime/UI 위에 다음 ownership/durability 경계가 source-connected됐다.

### Owner Character durability

- Host remote inventory apply/undo는 owning Client로 라우팅한다.
- owner가 Character library를 durable write하고 fresh `CharacterSessionProjectionV1`을 반환한다.
- request-id scoped delta compensation과 durable owner journal(`applied`, `undoing`, `undone`, `finalized`)이 owner restart/lost ack를 회수한다.
- unsafe later divergence는 blind overwrite 대신 reject한다.

### Party Stash Host restart

- Host-originated remote Stash는 owner/Campaign mutation 전에 Tauri Host coordinator를 durable write한다.
- coordinator identity: requestId + Campaign + Character + owner participant + full transfer command.
- reconnect recovery uses Campaign `recentRequestIds`:
  - original request committed, no `.compensate` => owner `applied`;
  - original absent or `.compensate` committed => owner `undone`.
- owner applies/undoes idempotently through its durable journal, finalizes, returns fresh Character projection, and only then Host removes coordinator.
- lost recovery/finalize acknowledgement leaves coordinator for another reconnect.

### Player self-service Stash Host restart

- incoming `campaign-stash-deposit` is checkpointed before the existing Host Campaign handler.
- compensation messages reuse the original coordinator rather than creating a second transaction.
- Client sends `campaign-party-stash-owner-complete` only after owner-side transfer/journal finalization.
- Host deletes coordinator only when Campaign idempotency agrees with Client outcome.
- this covers both Character->Stash and Stash->Character Host-crash orderings at source level.

### Remote item projection

- Character item membership may legitimately advance `sourceRevision`; Host accepts a forward revision only if all non-inventory Character source/rules identities remain unchanged.
- canonical/known item identities remain pinned to Host catalog content.
- unknown Campaign custom items may travel as embedded **inert** item metadata.
- inert custom item can preserve name/kind/charges/display passive text/provenance, but embedded `grantedActionIds` are discarded and an item without trusted Host mechanics is rejected if equipped, wielded, or attuned.

Focused source tests for owner restart, Host restart, self-service checkpointing, exact compensation, inventory-only source refresh, and inert custom item reconstruction are imported through the existing `npm run test:campaign-rest` restart module.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `e299cf876b97a6d056a10bf702ddd67888c16570` was verified as current branch head before coordination docs and has:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the new tests, `npm run test:campaign-rest`, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library recovery.

## Remaining V1-13 work

Do not mark V1-13 complete yet.

1. Audit Host-originated Campaign DM Library -> remote Character grant for Host-process crash ordering. Normal-process compensation/finalize exists, but decide whether Campaign recent-entry update is part of the required atomic transaction and add durable recovery if necessary.
2. Audit DM Library privacy/isolation: DM-only definitions/images before reveal, Campaign namespace isolation, delete/provenance behavior.
3. Audit Session-visible Stash/DM Library quick actions and shared/request/DM-managed policy denial UX against current acceptance.
4. Review malformed connected Stash request checkpoint validation so invalid remote input cannot strand a coordinator.

## Next Exact Action

1. Reconcile Rerun mandatory files and actual `work/v1-composite` HEAD.
2. If no executable evidence appeared, preserve all source-connected slices above.
3. Audit `grantCampaignDmLibraryItem` and its connected wrapper for Host-crash atomicity; implement only the smallest real durable gap.
4. Then finish V1-13 DM Library privacy/isolation/delete/provenance/user-visible UI audit with deterministic tests.
5. Keep later V1 slices behind real V1-13 gaps and keep comprehensive Codex audit deferred until implementation freeze.
