# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**  
Updated: **2026-08-23 Asia/Seoul**  
Canonical branch: **`work/v1-composite`**  
Recorded V1-13 product/test head: **`cbf20ab test(campaign): include Stash policy and provenance contracts`**

이 문서는 다음 작업 에이전트가 현재 V1 구현을 그대로 이어가기 위한 인수인계 문서다. 실행 우선순위/완료 정의는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 제품 계약은 `docs/design/`, 작업 루트는 `CANONICAL_ROOT.md`, 현재 실행 지점은 `.chatgpt-rerun/STATE.md`가 우선한다.

멀티플레이 후속 구현은 `docs/design/multiplayer-v1-scenario-catalog.md`의 H/P1/P2 시나리오와 GitHub 이슈 순서를 우선한다. 현재 authoritative state convergence는 상당 부분 존재하지만 다른 Client의 동일한 staged Resolution/physics dice/공격 연출은 완료되지 않았으므로 V1 multiplayer 완료로 선언하지 않는다.

## Resume rules

1. `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`를 먼저 reconcile한다.
2. GitHub ref가 `work/v1-composite`인지 확인한다.
3. 이미 source-connected된 V1-12, owner journal, Host/Player Stash restart recovery, item projection, DM Library grant semantics, Stash policy guards를 validation만 얻기 위해 다시 구현하지 않는다.
4. Player-owned remote Character durability와 Host-owned Campaign/Session authority를 유지한다. Host Character library에 remote Character를 복사하지 않는다.
5. comprehensive Codex audit는 V1 implementation freeze 뒤 exact SHA에서 수행한다.

## V1-12 preserved

Connected Long Rest normal durable-storage path는 **source implementation complete / validation pending**이다. 실행 증거가 없으므로 release checklist V1-12는 `PARTIAL` 유지다.

## V1-13 preserved durability boundary

- Host remote Character inventory mutation -> owning Client durable write -> fresh SessionProjection.
- request-id scoped delta compensation.
- durable owner journal with restart-safe apply/undo/finalize.
- durable Host Party Stash coordinator and Campaign-idempotency reconnect recovery.
- Player self-service Stash Host-crash recovery.
- exact Host compensation identity.
- inventory-only forward sourceRevision refresh.
- unknown Campaign custom items cross projection only as inert embedded metadata; no untrusted executable mechanics.

## V1-13 additions through `cbf20ab`

### DM Library grant semantics

`recentEntryIds` is private recents/navigation metadata, not asset ownership state.

- Character/Stash ItemInstance materialization is the asset transaction.
- If materialization succeeded but the later recents Campaign write failed, the grant remains successful rather than being compensated.
- The adapter only suppresses the later error when the exact requested definition quantity is proven to have increased by the requested amount; actual grant failures still reject.
- Connected lost finalize acknowledgement likewise does not expose a retryable user failure when the durable remote quantity is already present.
- Private DM Library definitions/index/notes remain absent from connected Campaign projection.

### Stash policy authority

The prior runtime incorrectly used only roster `stashPermission`. Current source now enforces both roster permission and Campaign Stash policy.

- `shared`: authorized Player direct deposit/withdraw.
- `dm-approval`: Player deposit allowed; direct withdrawal denied until approval flow exists.
- `dm-managed`: Player write denied; inspect only.

Host authority validates this; Client also preflights it. Player UI disables disallowed controls and explains the policy.

### Recovery checkpoint hardening

Player self-service recovery coordinator is no longer written for malformed/policy-denied requests. Before durable coordinator creation, source validates request shape/positive amounts, accepted owner identity, live Campaign identity, roster permission and Stash policy.

### Privacy/delete/provenance

Existing Campaign A/B namespace isolation and private connected projection contracts remain. A new lifecycle contract proves deleting a DM Library definition does not remove an already granted Character ItemInstance and its provenance snapshot remains.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `cbf20abf4870807348443728c6fd6022113ef14c` is source-checkpointed and returned:

- combined statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the new focused tests, `npm run test:campaign-rest`, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library scenarios.

## Critical remaining V1-13 product gap

1. **Stash policy selector is not user-reachable.** `partyStash.policy` is modeled, enforced and displayed, but current Campaign UI has no selector. New Campaigns stay on default `dm-approval`.
2. **Actual `dm-approval` queue is missing.** Player direct withdrawal is now safely denied, but Player cannot submit a pending withdrawal request for DM approve/reject/cancel.
3. Approval must not mutate assets before approval. Accepted requests must call the existing durable `transferPartyStash` transaction so current owner/Host restart recovery remains authoritative.
4. Pending approval lifetime must be explicit; V1 default should clear pending requests on Session end and avoid persisting transient reservations into Campaign state unless deliberately specified.

## Next Exact Action

1. Reconcile mandatory Rerun files and actual `work/v1-composite` HEAD.
2. Preserve all source-connected work if executable evidence is still absent.
3. Add user-reachable Campaign `shared | dm-approval | dm-managed` Stash policy configuration and persist Campaign Stash policy / Session default coherently.
4. Add Player pending withdrawal request -> DM approve/reject/cancel flow on top of the existing durable transfer path.
5. Add deterministic policy transition, duplicate request/reconnect, rejection/cancel and Session-end cleanup contracts.
6. Re-audit V1-13 after approval flow; then continue next unblocked V1 slice.
7. Keep comprehensive Codex audit deferred until implementation freeze.

