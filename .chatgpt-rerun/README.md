# ChatGPT Rerun Protocol

This directory is the repository-side coordination contract for ChatGPT Rerun on `Kaetaeru/SimpleVTT`.

## Repository binding

- Repository: `Kaetaeru/SimpleVTT`
- Canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- Branch/ref: `work/v1-composite`
- Control file: `.chatgpt-rerun/control.json`

This binding was reconciled on 2026-08-23 from actual GitHub app/tool activity in the current ChatGPT conversation and the repository routing authority in `CANONICAL_ROOT.md`. The earlier Rerun documents bound this run to `main`; that binding is historical and is superseded by the repository's current V1 canonical declaration. `main` and `work/v1-latest` remain historical/landing references until deliberate V1 promotion.

Chrome Side Panel fields are not a source of truth before the user enters and confirms these coordinates.

## Mandatory read order

Every Rerun dispatch must read these files in exactly this order before doing project work:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

`STATUS.md` is a human-facing projection only. It is never the reconciliation source of truth.

After the mandatory Rerun read order, V1 product work must also read:

1. `CANONICAL_ROOT.md`
2. `.agents/V1_CURRENT_HANDOFF.md`
3. `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`
4. relevant `docs/design/` contracts for the selected V1 item

### Product-plan authority

Rerun does not own a second copy of the V1 product plan.

- `.chatgpt-rerun/PLAN.md` is only a routing record for this run. It must point to the canonical V1 planning documents and must not restate feature scope, acceptance criteria, implementation order, or the next product slice.
- `.agents/V1_CURRENT_HANDOFF.md` owns the current V1 execution pointer.
- `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` owns the full V1 completion plan, dependency order, gates, and remaining work.
- `docs/design/` owns product behavior contracts.
- `.chatgpt-rerun/STATE.md` owns only resumable execution state and observed evidence. Its `Next Exact Action` must route back to the current canonical V1 handoff instead of copying the product plan.

If canonical V1 documents contain stale factual repository state, reconcile that fact against current GitHub and repair the canonical V1 document. Do not create a corrected duplicate inside Rerun PLAN/STATE.

## Preflight reconciliation

Before executing any task:

1. Fetch the configured repository and branch/ref from GitHub and confirm they still resolve.
2. Read the mandatory files in order.
3. Reconcile `run_id`, `sequence`, and `task_id` across control, STATE, and PLAN before changing code.
4. Treat `control.json` as the sole dispatch authorization/status record, `STATE.md` as the durable execution checkpoint, and `PLAN.md` as the router to canonical V1 planning authority. Product scope and acceptance come only from the canonical V1 documents above.
5. Never reset an existing run_id, sequence, task, checkpoint, completion record, or validation history merely because a new watcher invocation starts.
6. When `run_id`, `sequence`, and `task_id` agree and current `control.json` says `continue`, stale status wording in PLAN/STATE is not a blocker. Reconcile those durable files forward to the current GitHub state and continue from the latest unfinished checkpoint. Only an unreconcilable identity/task conflict or a real safety/permission boundary may stop execution.
7. Re-fetch `work/v1-composite` before writes when concurrent GitHub activity could have advanced it.
8. Before product edits, verify the active product ref is `work/v1-composite`; do not silently route work back to `main`.
9. Select product work from `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`; never select work from copied task prose in Rerun files.

## Dispatch and watcher semantics

Chrome Side Panel **Start/Stop controls the tab watcher only**. It is independent of GitHub control status.

- `continue` in `control.json` means work is authorized to start or resume.
- `complete`, `needs_user`, and `blocked` are waiting states only when they are the current value in `control.json`. Mirrored or historical wording in PLAN/STATE cannot override a current `continue` authorization.
- `working` is not a valid control status and must not be written.
- If a terminal/waiting status later becomes `continue` with the **same sequence**, that transition is a new work authorization. The watcher must automatically resume from the durable STATE checkpoint rather than requiring a sequence increment.
- A sequence change means the controller has intentionally advanced dispatch state; reconcile task identity before acting.

## Current V1 execution policy

The current user goal is to finish implementation of the V1 release checklist before doing the comprehensive Codex audit.

- Continue implementing the remaining V1 checklist slices in dependency order on `work/v1-composite`.
- Add implementation-level deterministic tests/fixtures when they are part of the feature, but do not stop after each slice for a separate Codex total audit.
- Do not treat the current `.agents/CODEX_VALIDATION_QUEUE.md` per-slice queue as a release gate; it is historical/superseded by the user's final-audit instruction unless explicitly re-authorized.
- When implementation reaches the V1 pre-release boundary, freeze one exact canonical SHA and only then run the comprehensive Codex audit/full regression against that SHA.
- Fix audit findings, repeat the final audit as needed, then proceed to human acceptance/release evidence.
- When a V1 slice completes, update the canonical V1 handoff/checklist. Do not mirror the completed/next feature list into Rerun PLAN.

## Execution checkpoint discipline

A single active execution has a **20 minute hard stop**. By approximately **18 minutes**, write a durable checkpoint rather than starting another risky or long operation.

Before the hard stop, STATE must capture what changed, validation evidence available so far, unresolved risks, and a concrete `Next Exact Action`. `Next Exact Action` should name the canonical V1 pointer to resume from, not duplicate its feature specification. Do not claim asynchronous/background continuation.

For long active executions, keep `STATUS.md` reasonably fresh (target about every 5 minutes), and update it immediately for meaningful state changes such as a completed implementation slice, a newly discovered blocker, task completion, or a user decision requirement.

## Authoritative write order

When Rerun routing/state/control need to change, publish them in this order:

1. `PLAN.md` — only when run identity or canonical-plan routing changes
2. `STATE.md`
3. `control.json` — **last authoritative write**

`README.md` protocol reconciliation may be published before PLAN. `STATUS.md` may be refreshed for people before or after STATE as needed, but it cannot authorize work and cannot resolve a conflict between PLAN, STATE, and control.

Never publish `control.json` first and then attempt to make PLAN/STATE catch up. The last control write is the dispatch-visible commitment that prior durable records are ready.

## Completion behavior

On a product-slice completion, record product progress and verification in the canonical V1 handoff/checklist, checkpoint the execution in STATE, update the human STATUS projection if useful, then publish control status last. Do not copy product completion or next-slice prose into Rerun PLAN. For a user decision use `needs_user`; for an external or technical blocker use `blocked`. The watcher may remain running in all three cases and should resume automatically if control later returns to `continue`.
