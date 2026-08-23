# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve current V1 Session UI, Player-owned remote Character durability, Campaign authority, V1-12 connected Long Rest source boundary, and the V1-13 owner-routing work. Do not route to `main`, redo source-connected work only for validation, or begin the comprehensive Codex audit before implementation freeze.

## V1-12

Connected Long Rest remains source implementation complete for the normal durable-storage path / validation pending. No exact-head executable evidence has appeared; do not rebuild it.

## V1-13 completed source slice

The release checklist's V1-13 `TODO` label remains stale relative to current source. Existing Stash/DM Library runtime/UI foundations were preserved.

Product source is now connected through exact head `45c6dae19f2f6721e0fe012079cb6436f80b0938` for the next owner-durability layer:

- request-scoped inventory compensation from the previous slice is preserved;
- Host remote Character mutations continue to execute on the owning Client and return a fresh `CharacterSessionProjectionV1`;
- `connected-owner-inventory.<request>.json` durable owner journal added in Tauri with immutable `applied`, `undoing`, `undone`, and `finalized` sidecars;
- journal records exact request/actor/command/before state before owner mutation;
- apply replay can reconcile a durable Character commit that happened before the applied sidecar/ack and does not apply twice;
- undo writes exact `beforeUndo` + `afterUndo` to the durable journal before compensation, so restart can distinguish pre-undo and post-undo Character state;
- restarted owner can compensate without the prior process's in-memory `undoByRequest` record;
- duplicate undo/finalize is idempotent at the journal layer;
- Host defers owner finalization while Party Stash or DM Library compound work is unresolved;
- normal Host Stash success finalizes `applied`; successful compensation finalizes `undone`;
- DM Library Character grant now compensates owner mutation if the later Campaign recent-entry update rejects;
- connected Host Character->Stash failure no longer depends on a global last-undo choice: the active Stash `command.requestId` is explicitly bound to `undoDmInventoryAdjustment(requestId)`;
- production `main.tsx` installs journal routing after connected Campaign systems and exact Stash compensation after the journal adapter;
- Tauri commands are registered for read/prepare/apply/undo/finalize journal phases.

Focused tests were authored and wired into the existing `test:campaign-rest` entry through the restart durability test module:

- durable journal phase/idempotency contract;
- production/Tauri structure contract;
- apply-committed-before-ack restart replay;
- owner restart then exact compensation with no in-memory undo record;
- undo committed before `.undone` sidecar recovery;
- exact Host Stash compensation binding.

## Important remaining V1-13 correctness gap

Do **not** claim cross-store atomicity or V1-13 completion yet.

The owner side now retains enough durable evidence to recover its own process restart, but the Host still lacks durable reconciliation if the **Host process** dies in this window:

1. owner journal is prepared/applied and owner Character generation is durable;
2. Host has not yet committed the Party Stash Campaign mutation, or cannot remember whether it did;
3. Host process restarts before issuing undo/finalize.

Without a Host recovery coordinator or reconnect reconciliation, this can leave a Character-only durable result. The owner journal is durable truth, but a restarted Host currently does not discover and reconcile it.

A finalize request/ack loss after both durable sides committed is retry-idempotent and does not lock normal Character persistence in the current implementation, but can leave stale journal data until the operation is retried. This is cleanup/recovery debt, not green release evidence.

The journal intentionally uses delta-safe compensation rather than blind inverse. If the same inventory asset diverges before compensation, it rejects rather than overwriting later state; Host recovery must therefore converge promptly.

## Validation status

**NO GREEN CLAIM.** Exact product head `45c6dae19f2f6721e0fe012079cb6436f80b0938` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the newly authored owner-journal tests, `npm run test:campaign-rest`, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library recovery.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. If exact-head executable evidence is still absent, preserve V1-12 and the owner-journal source slice rather than repeating them.
3. Close the Host-restart window for connected Party Stash: add durable Host transaction/reconciliation state or an owner-journal reconnect sync that can determine from Campaign idempotency whether an applied owner mutation must be finalized or undone.
4. Cover both Host restart cases deterministically: owner applied + Campaign request committed => finalize; owner applied + Campaign request absent => undo then finalize.
5. Cover duplicate reconnect/recovery messages and finalize-ack loss without double apply/undo.
6. After Host/owner cross-process recovery is source-connected, finish remaining V1-13 DM Library privacy/isolation/user-reachable UI audit.
7. Keep comprehensive Codex audit deferred until implementation freeze and retain Windows two-instance acceptance as release evidence.
