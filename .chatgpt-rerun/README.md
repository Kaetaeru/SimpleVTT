# ChatGPT Rerun Protocol

This directory is the repository-side coordination contract for ChatGPT Rerun on `Kaetaeru/SimpleVTT`.

## Repository binding

- Repository: `Kaetaeru/SimpleVTT`
- Branch/ref: `main`
- Control file: `.chatgpt-rerun/control.json`

The binding above was established from GitHub app activity in the originating ChatGPT conversation. The project was promoted by a clean fast-forward from `agent/104-arbitrary-character-session-projection` to `main`; future work must treat `main` as the canonical baseline unless the user explicitly selects another ref. Chrome Side Panel fields are not a source of truth before the user enters and confirms these coordinates.

## Mandatory read order

Every Rerun dispatch must read these files in exactly this order before doing project work:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

`STATUS.md` is a human-facing projection only. It is never the reconciliation source of truth.

## Preflight reconciliation

Before executing any task:

1. Fetch the current configured repository and branch/ref from GitHub and confirm they still resolve.
2. Read the mandatory files in order.
3. Reconcile `run_id`, `sequence`, and `task_id` across control, STATE, and PLAN before changing code.
4. Treat `control.json` as the dispatch authorization/status record, `STATE.md` as the durable execution checkpoint, and `PLAN.md` as the intended task/acceptance contract.
5. Never reset an existing run_id, sequence, task, checkpoint, or validation history merely because a new watcher invocation starts.
6. If the files disagree in a way that cannot be reconciled safely, do not guess. Record the conflict in STATE/STATUS and use `needs_user` or `blocked` as appropriate.
7. Re-fetch `main` before writes when concurrent GitHub activity could have advanced it.

## Dispatch and watcher semantics

Chrome Side Panel **Start/Stop controls the tab watcher only**. It is independent of GitHub control status.

- `continue` means work is authorized to start or resume.
- `complete`, `needs_user`, and `blocked` are dispatch waiting states. They do **not** turn off the watcher; polling continues while the watcher is started.
- `working` is not a valid control status and must not be written.
- If a terminal/waiting status later becomes `continue` with the **same sequence**, that transition is a new work authorization. The watcher must automatically resume from the durable STATE checkpoint rather than requiring a sequence increment.
- A sequence change means the controller has intentionally advanced dispatch state; reconcile task identity before acting.

## Execution checkpoint discipline

A single active execution has a **20 minute hard stop**. By approximately **18 minutes**, write a durable checkpoint rather than starting another risky or long operation.

Before the hard stop, STATE must capture what changed, validation evidence, unresolved risks, and a concrete `Next Exact Action`. Do not claim asynchronous/background continuation.

For long active executions, keep `STATUS.md` reasonably fresh (target about every 5 minutes), and update it immediately for meaningful state changes such as validation success/failure, a newly discovered blocker, task completion, or a user decision requirement.

## Authoritative write order

When task/plan/state/control need to change, publish them in this order:

1. `PLAN.md`
2. `STATE.md`
3. `control.json` — **last authoritative write**

`STATUS.md` may be refreshed for people before or after STATE as needed, but it cannot authorize work and cannot resolve a conflict between PLAN, STATE, and control.

Never publish `control.json` first and then attempt to make PLAN/STATE catch up. The last control write is the dispatch-visible commitment that prior durable records are ready.

## Completion behavior

On task completion, write verification and outcome into PLAN/STATE first, update the human STATUS projection, then publish control status `complete` last. For a user decision use `needs_user`; for an external or technical blocker use `blocked`. The watcher may remain running in all three cases and should resume automatically if control later returns to `continue`.