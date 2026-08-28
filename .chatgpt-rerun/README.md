# ChatGPT Rerun Protocol

This directory is the repository-side coordination contract for ChatGPT Rerun on `Kaetaeru/SimpleVTT`.

## Repository binding

- Repository: `Kaetaeru/SimpleVTT`
- Canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- Product integration target: `work/v1-composite`
- Control file: `.chatgpt-rerun/control.json`

`main` is not the current product integration branch. `CANONICAL_ROOT.md` remains the repository-level authority for V1 integration history. This Rerun sequence uses the working branch above for control, state, planning-pointer, and implementation continuation until that work is deliberately integrated.

Chrome Side Panel fields are not a source of truth before the user enters and confirms these coordinates.

## Mandatory read order

Every Rerun dispatch must read these files in exactly this order before doing project work:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

`STATUS.md` is a human-facing projection only. It is never the reconciliation source of truth.

After the mandatory Rerun read order:

1. read `CANONICAL_ROOT.md` for repository/integration routing;
2. read `docs/rules/common-play-resolver-architecture-charter.md` for the non-negotiable owner intent and anti-drift architecture boundary;
3. read the product-plan document referenced by `.chatgpt-rerun/PLAN.md`;
4. read only the contracts, implementation, tests, issues, and PRs needed by that plan's current action.

The architecture charter is normative for intent. A future agent must not silently replace its philosophy during routine execution. If current repository evidence proves a material contradiction, surface that contradiction and repair the canonical plan deliberately rather than inventing a new architecture implicitly.

A later explicit owner priority change overrides older handoff or release pointers. Do not resume a stale named-feature queue merely because an older STATE, handoff, issue, or PR still describes it.

## Product-plan authority

Rerun does not own a second copy of the product plan.

- `.chatgpt-rerun/PLAN.md` is only a pointer to the canonical planning document for this run.
- The referenced product-plan document owns scope, gate order, migration order, Definition of Done, and current next action.
- `docs/rules/common-play-resolver-architecture-charter.md` owns the durable architectural intent that the product plan must preserve.
- `.chatgpt-rerun/STATE.md` owns resumable execution state and observed evidence only.
- `.chatgpt-rerun/control.json` owns dispatch authorization/status only.
- Product behavior/architecture contracts remain under `docs/rules/` and `docs/design/`.

If a planning document contains stale factual repository state, reconcile the fact against current GitHub and repair the planning document. Do not create a corrected duplicate inside Rerun PLAN/STATE.

## Preflight reconciliation

Before executing any task:

1. Fetch the configured repository and Rerun working branch/ref from GitHub and confirm they still resolve.
2. Read the mandatory files in order.
3. Reconcile `run_id`, `sequence`, and `task_id` across control, STATE, and PLAN before changing product files.
4. Treat `control.json` as dispatch authorization, `STATE.md` as durable checkpoint, and `PLAN.md` as a pointer only.
5. Never reset an existing run_id, sequence, task, checkpoint, completion record, or validation history merely because a new watcher invocation starts.
6. When identity agrees and current control says `continue`, resume from the latest unfinished checkpoint and current planning document without repeating still-valid evidence.
7. Re-fetch the working branch before writes when concurrent GitHub activity could have advanced it.
8. Do not silently route product work to `main`.
9. Integrate toward `work/v1-composite` only through an explicit integration/merge action; working-branch execution does not redefine `main` or canonical history.

## Dispatch and watcher semantics

Chrome Side Panel **Start/Stop controls the tab watcher only**. It is independent of GitHub control status.

- `continue` means work is authorized to start or resume.
- `complete`, `needs_user`, and `blocked` are waiting states only when current in `control.json`.
- `working` is not a valid control status.
- If a waiting state becomes `continue` with the same sequence, that is a new work authorization and must resume from STATE.
- A sequence change means the controller intentionally advanced dispatch state; reconcile task identity before acting.
- When current `STATE.md` and `control.json` are waiting solely for explicit merge approval of a specifically named PR, an owner command of **`Rerun 진행`** is equivalent to explicit merge approval for that PR. It authorizes the normal mandatory preflight, live diff/CI/ancestry safety checks, and merge. It is not blanket approval for unrelated PRs, later gates, or materially changed product diffs.

## Current execution policy

The current explicit owner priority is the product plan referenced by `.chatgpt-rerun/PLAN.md`.

- Select work only from that document's current next action.
- Do not copy its checklist, feature details, acceptance criteria, gate list, or architecture philosophy into Rerun files.
- Do not revive an older named-content implementation PR merely because it is green if the current architecture plan supersedes that implementation direction.
- Use ChatGPT for architecture/mechanism decisions and bounded acceptance criteria; use Codex for repository-dependent implementation after the contract is sufficiently fixed.
- If implementation discovers a need for a new primitive, undefined authority/lifetime, named-content branching, conflicting contracts, or materially different product choices, return to design review instead of inventing architecture inside the implementation task.

## Execution checkpoint discipline

A single active execution has a **20 minute hard stop**. By approximately **18 minutes**, write a durable checkpoint rather than starting another risky or long operation.

Before the hard stop, STATE must capture what changed, validation evidence available so far, unresolved risks, and a concrete `Next Exact Action` that routes back to the product-plan document rather than restating it.

For long active executions, keep `STATUS.md` reasonably fresh (target about every 5 minutes) and refresh it for meaningful state changes.

## Authoritative write order

When Rerun routing/state/control need to change, publish them in this order:

1. `PLAN.md` — only when run identity or product-plan pointer changes
2. `STATE.md`
3. `control.json` — **last authoritative write**

`README.md` protocol reconciliation may be published before PLAN. `STATUS.md` is human-facing and cannot authorize work.

Never publish `control.json` first and then attempt to make PLAN/STATE catch up.

## Completion behavior

On a product-slice completion, update the canonical product-plan/evidence first, checkpoint STATE, optionally refresh STATUS, then publish control last. For a user decision use `needs_user`; for an external/technical blocker use `blocked`; for authorized continuation use `continue`. Do not copy product-plan scope into PLAN or STATE.
