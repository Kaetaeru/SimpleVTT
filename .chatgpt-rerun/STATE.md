# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- reconciled_at: `2026-08-23T03:26:00+09:00`

## Reconciliation decision

This is an existing active Rerun run. **Do not create a new run_id, do not reset sequence, and do not replace the existing task_id.**

The previous Rerun state named `main` as canonical and planned `agent/108-production-play-session-ux`. That routing is now historical. Actual GitHub tool activity in the current ChatGPT conversation and `CANONICAL_ROOT.md` establish `work/v1-composite` as the current V1 canonical implementation/build/test/release-preparation branch.

The existing task identity is retained for durable continuity, but the user's current authorized goal is broader: **finish implementation of the full V1 checklist through the pre-release boundary, then run one comprehensive Codex audit immediately before V1 acceptance/release.** Per-slice Codex total audits are not the current gate.

## Preserved completion history

Sequence 0 / `phase13-closeout-ui-dice-regression` completed successfully and is not reset by this reconciliation.

Preserved verified implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved exact-head workflow evidence:

- Contract validation `31955742556` — success
- Rules Domain `31955742577` — success
- Persistence `31955742563` — success
- UI `31955742530` — success
- Phase 11 Playable `31955742560` — success
- Phase 12 Connected Session `31955742539` — success
- Phase 13 SessionProjection `31955742524` — success

Preserved Phase 13 artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

A later `main` playable workflow produced a green Windows artifact, but subsequent product inspection established that those gates did not prove the real user-created Character -> actual session/play UI path. That historical finding remains valid context.

## Preserved sequence 1 history

The original sequence 1 authorization was Phase 14 production play/session UX. It identified a real production gap where reference-seeded MockAdapter state did not by itself prove a fresh persisted Character -> live Scene/action user journey.

The original strategy included:

1. materialize/reconcile the actual persisted Character into Scene state and derived actions;
2. provide deliberate no-session/no-actor UI and Character Sheet -> Play entry;
3. add in-session `행동 / 기술 / 주문 / 인벤토리` surfaces;
4. derive real Character skills/attacks/features/items/spells;
5. preserve authoritative item/equipment/attunement/use resolution paths;
6. converge local and connected play on the same production actor projection;
7. add fresh-Character and restart production journey gates;
8. produce an exact-head Windows playable artifact.

This history is preserved and must not be reimplemented solely because the Rerun binding changed.

## Current canonical product checkpoint

The current canonical handoff has advanced beyond the original Phase 14 checkpoint. Recent canonical work includes:

- actor-specific Ready configuration instead of one adapter-global Ready value;
- Ready expiration at next own turn / initiative end;
- Host authoritative `ready-action: cleared` propagation and deterministic ordering;
- Client actor-specific Ready config/status/economy projection and idempotent replay;
- session start/end/reset cleanup of Ready state;
- `ready-action-v1` required connected capability negotiation;
- Host-local Ready trigger clear broadcast;
- isolated two-instance acceptance tooling;
- Windows Live Development bootstrap for Node/npm, Rust/Cargo and MSVC;
- near-live Git fast-forward/HMR development loop.

The current handoff still records connected two-instance/reconnect evidence as incomplete, while the master V1 release checklist also contains additional Campaign, DM, mapless/module, dice, quality/regression and release work that must be reconciled and completed before V1.

## Current user execution policy

- Implement the remaining V1 checklist first.
- Do not stop after every feature for a Codex comprehensive audit.
- Normal focused tests/CI can still be written/run as implementation safety nets.
- `.agents/CODEX_VALIDATION_QUEUE.md` is not an active per-slice release gate unless the user explicitly re-authorizes it.
- When all pre-release implementation work is present, freeze one exact canonical SHA.
- Run the comprehensive Codex audit against that exact SHA.
- Fix findings and rerun the final audit as needed.
- Only after final audit success proceed to remaining human acceptance/release evidence and deliberate promotion.

## Risks to watch

- Prototype-composed runtime adapters are order-sensitive; avoid bypassing Phase 09-13 authority behavior.
- Rules/authority/persistence calculations must remain in canonical application/domain services, not UI presentation code.
- Connected SessionProjection authority remains host-reconstructed; client presentation data must not become authority.
- Session-transient state such as Ready must not leak into durable Character/Campaign state.
- Core V1 must remain mapless-capable; battlemap/provider integration is optional and must fail open without stale spatial blockers.
- Release checklist statuses may be stale relative to newer code; inspect before reimplementing a supposedly TODO item.
- User-only acceptance steps should not block implementation of other independent V1 slices.

## Validation policy

Preserve all historical validation evidence above. New final release evidence must come from the exact pre-V1 candidate SHA.

During implementation, focused deterministic tests and build checks are allowed when useful, but the **comprehensive Codex total audit is deferred until V1 implementation is complete.**

## Next Exact Action

On the next authorized watcher dispatch:

1. Read `.chatgpt-rerun/README.md` -> `control.json` -> `STATE.md` -> `PLAN.md` in mandatory order.
2. Confirm repository `Kaetaeru/SimpleVTT`, branch `work/v1-composite`, run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task_id `phase14-production-play-session-ux`, status `continue` still reconcile.
3. Read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` and relevant `docs/design/` contracts.
4. Reconcile stale checklist status against current source and choose the next unblocked **implementation** gap that does not require immediate user-only acceptance.
5. Continue V1 implementation on `work/v1-composite`; do **not** start the comprehensive Codex audit yet.
6. Update product handoff/checklist for meaningful implementation progress.
7. By approximately 18 minutes, stop starting long work and write the durable Rerun checkpoint; hard-stop before 20 minutes.
