# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — `Phase 14: production play session UX`
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved completion history

Sequence 0 / `phase13-closeout-ui-dice-regression` remains complete and is not reset by Phase 14.

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

The later Main Playable workflow at `0ebc8b7a020b4ec64c2678b398aa5c064de46a93` produced a green Windows artifact, but manual product inspection established that those gates did not prove user-created Character -> actual session/play UI. Phase 14 exists specifically to correct that gap.

## Sequence 1 release scope

The user explicitly authorized continuation of the same run_id / sequence 1 / task. The release scope includes:

1. DM starts/stops the actual Host/server from visible UI and receives actionable listen/bind/network state.
2. DM preparation/lobby exposes Scene/Combatants, participants, compatibility, and readiness before play begins.
3. Player selects a persisted Character, joins by Host address, completes compatibility + SessionProjection, and reaches the lobby without debug controls.
4. Host-unknown Character remains an ephemeral host-authoritative projection while durable ownership remains on the player.
5. Ready/start transitions the prepared participant set into Freeform or Initiative play.
6. Actions, Skills, Spells, Inventory, targeting, Combatants, corrections, reactions, conditions/concentration, Activity/Undo, and authoritative dice share one session state.
7. Late join, disconnect/reconnect, duplicate/replayed requests/events, incompatibility, and invalid projection recover or fail safely.
8. Session end clears transient/projection state while preserving only owning-player durable Character changes.
9. Final Windows acceptance covers Host start -> preparation -> Character selection/join -> Ready/start -> play -> reconnect -> session end/restart.

## Production root cause and authority boundaries

1. Visible UI still delegates through a singleton `MockAdapter`; historical base state contains Aelar/Mira/reference Combatants and fixed action identities.
2. Phase 14 must prove newly authored/persisted Character -> live Scene/actions instead of relying on reference ids.
3. Existing Tauri Host/Join transport, compatibility handshake, Host ledger, SessionProjection acceptance, reconnect/catch-up, authoritative ActionRequest/ResolutionEvent routing, and owning-client durable write-back are real subsystems to preserve.
4. `tauriSessionTransport` already exposes `startHost`, `connectClient`, `stop`, status, and state/message listeners.
5. `connectedSessionRuntimeAdapter` already owns host/client setup, hello/hello-ack compatibility, participant projection, event catch-up, and reconnect scheduling.
6. The current visible `SessionScreen` calls `hostSession/joinSession`, but labels the path as a reference shell; no explicit preparation/lobby/ready/start/end state is modeled yet.

## Current work branch state

**Work branch/head:** `agent/108-production-play-session-ux` @ `41db6832cc0a95f085f8161bfed665dbcc71090d`.

**Checklist focus:** P14.2/P14.11 narrow PlaySessionDock validation completed; next planning boundary is explicit P14.7/P14.8 connected lifecycle decomposition before broader product code.

### Completed since previous checkpoint

- Added `tests/ui/playSessionDockStructure.test.ts`.
- The regression asserts PlaySessionDock local Hooks are established before the `snapshot === null` guard and no Hook is conditionally reached only after hydration.
- The regression asserts tab switching does not clear `pendingActionId` and the pending target picker remains wired.
- Added the Phase 14 regression to `.github/workflows/ui.yml`.
- Opened Draft PR #109 to `main` with #108, checklist, fixture-removal risk, exact-head evidence, and next lifecycle scope documented.
- Inspected the existing connected runtime/state/transport and visible SessionScreen to establish the reuse boundary before lifecycle work.

### Validation evidence

- Exact work head: `41db6832cc0a95f085f8161bfed665dbcc71090d`.
- UI workflow run `31965607635` — `success` at that exact head.
- The run includes the new Phase 14 PlaySessionDock regression and the final `npm run build` TypeScript/production build; both succeeded.
- Existing UI regression steps in that same workflow also succeeded.
- No older Phase 11/12/13 workflow was rerun because this slice did not modify those authority boundaries.
- No broad feature checkbox is awarded solely from source presence; this evidence covers only the narrow PlaySessionDock hydration/tab-context repair and its build boundary.

### Known failures / risks

1. `.agents/PHASE14_CHECKLIST.md` still phrases P14.7/P14.8 too broadly relative to the explicit release lifecycle. It must be expanded to retain server start/stop -> DM preparation/lobby -> persisted Character selection/join -> Ready/start -> participant lifecycle -> session end/restart gates without deleting existing authority gates.
2. Production `SessionScreen` currently exposes Host/Join but still describes it as a reference shell; safe stop/restart and explicit preparation/lobby/ready/start/end states are absent.
3. `ConnectedRuntimeState` tracks host/client/session ledger/replica/reconnect but not lifecycle phase/readiness, so new state must be added without moving authority into presentation code.
4. Product-realistic fresh-Character local/connected gates remain unverified.
5. The draft PR is not merge-authorized; no merge may occur without user authorization.

### Files / architecture boundaries changed in this slice

- `src/PlaySessionDock.tsx` — hydration Hook-order and tab-context repair (previous source commit, now verified).
- `tests/ui/playSessionDockStructure.test.ts` — new focused regression.
- `.github/workflows/ui.yml` — runs the focused regression before production build.
- No rules, persistence, Tauri transport, SessionProjection authority, connected event protocol, or durable write-back implementation changed in this slice.

## Rerun connectivity

Chrome Side Panel remains connected to:

- Owner: `Kaetaeru`
- Repository: `SimpleVTT`
- Branch: `main`
- Control: `.chatgpt-rerun/control.json`

The watcher reads coordination from `main`; implementation occurs on the active work branch recorded above. `continue` on the same sequence means resume from this checkpoint.

## Next Exact Action

On `agent/108-production-play-session-ux`, first reconcile `.agents/PHASE14_CHECKLIST.md` so P14.7/P14.8 explicitly enumerate server start/stop, DM preparation/lobby, persisted Character selection + join, Ready/start, late join/disconnect/reconnect, and session end/restart while preserving all existing handshake/projection/authority/error gates. Then implement the smallest lifecycle slice: add safe Host stop/restart plus explicit preparation-state surface through the existing connected runtime/`tauriSessionTransport` boundary, add a focused regression, and run only the affected UI/connected gates at the resulting exact head.

Do not rerun UI workflow `31965607635` or the PlaySessionDock regression unless a later commit changes that boundary.

## Dispatch recommendation

`continue`
