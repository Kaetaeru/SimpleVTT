# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `blocked`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`

PR #109 was rechecked before and after the source write. It was fast-forwarded without force from `0b7bce05f59bed2335499b89c6357b2431f5987e` to `2c57c570...` and remains open, draft, mergeable and unmerged.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

GitHub control, STATE and PLAN agreed on `run_id=b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, `sequence=3`, `task_id=v1-product-experience-overhaul`, `status=continue`. `main` and PR #109 matched the preceding checkpoint at work HEAD `0b7bce05...`, so validated Play/Dice/VFX/Appearance/dual-Sheet/direct-IP work was not repeated.

The prior Phase 12 Windows job `95843208485` in run `32177587541` was checked first and was still in progress at `Verify Tauri session transport and persistence library`; it was not rerun.

## Work completed in this execution
### Implemented the remaining Session content-parity source slice
Source commit:
- `2c57c570b812d9cf42c6c40cb3ff8035ae7c06d7`
- message: `Add validated session content parity`

Changed/added production paths:
- `src/app/installedContentRuntimeAdapter.ts`
  - added a session-safe normalized inventory over the already hydrated installed-content document;
  - added deterministic canonical payload revision (`fnv1a64`) only for missing/changed comparison, not as a mechanics/security authority;
  - added Host requirement comparison by existing qualified identity + payload revision;
  - added peer install helper that calls the existing `validateInstalledContentPackage`, builtin-collision guard, `InstalledContentRepository.installMany`, and existing catalog recomposition path;
  - same-qualified-identity different payload remains fail-closed through the existing package/repository conflict checks.
- `src/app/sessionContentParityRuntimeAdapter.ts`
  - wraps the existing Tauri message listener/send path; it does not replace the transport or connected runtime;
  - Client `hello` is enriched with current installed declarative content identities/revisions;
  - Host intercepts only a compatible `hello` that is missing/changed content and returns only required declarative entries in the existing `hello-ack` envelope;
  - Host does not pass that first hello to normal participant acceptance until parity succeeds;
  - Client validates/installs required entries through the existing installed-content authority, recomposes the existing catalog, and re-sends the same hello;
  - a no-requirement ack marks parity Ready and then passes to the existing connected hello-ack handler;
  - reconnect uses the same inventory comparison, so already-matching content is not transferred;
  - malformed or conflicting Host content sets a human-readable parity error and blocks Ready;
  - `setSessionReady(true)` reaches the existing production lifecycle only when parity is `ready`.
- `src/main.tsx`
  - loads the parity decorator after the established production Session UI/lifecycle decorators.
- `tests/ui/productionHelloReplayIdempotency.test.ts`
  - retained the existing hello-replay idempotency test;
  - added focused successful Host-required transfer/re-handshake/Ready gating/reconnect idempotency coverage;
  - added same-qualified-identity conflict rejection without overwrite;
  - added malformed Host content rejection and Ready blocking.

### Architecture preserved
- no second installed-content store or persistence document;
- no second Session protocol, event ledger, resolver or mechanics path;
- existing `hello / hello-ack`, Host ledger, participant acceptance, Ready lifecycle and reconnect remain the underlying authority;
- peer content is JSON declarative installed-content data only; no Host-provided JS/native execution path was introduced;
- existing installed-content validator/repository/catalog composition remain authoritative.

## Validation state for exact head `2c57c570...`
Automatic workflows started after the fast-forward.

### Phase 12 Connected Session
- run `32178687847`
- connected-protocol job `95846416201`
- step `Verify connected-session authority protocol`: **failure**
- downstream Phase 11/frontend steps in that job were skipped after the failure.

The exact failure log/root cause has **not** been inspected. At the point the failure was detected, the GitHub CI-fix workflow was invoked. Its required prerequisite check showed the current execution environment has no GitHub CLI: `gh: not found`. Under that workflow, source must not be changed speculatively before authenticated `gh` log inspection. Therefore no post-failure source edit was made.

### UI
- run `32178687871`
- the run had started and was still in progress when this blocker checkpoint was prepared.
- do not claim UI TypeScript/build or product tests green for `2c57c570...` yet.

### Previously validated boundary retained
The preceding exact head `0b7bce05...` remains the last validated Session boundary:
- UI run `32177587540` / frontend `95842950322`: success.
- Phase 12 run `32177587541` / connected-protocol `95842949930`: success.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.

The new content-parity implementation is **not** in this validated list until its exact-head failure is diagnosed and fixed.

## Technical blocker
The prescribed GitHub Actions failure-inspection workflow requires authenticated `gh`, but the active execution environment reports `gh: not found`. The failing connected-protocol step therefore cannot be safely diagnosed here under the active CI-fix workflow. This is a technical execution-environment blocker, not a request for product/design clarification.

## Next Exact Action
1. Perform mandatory preflight. Trust GitHub if `main`, control, or PR #109 moved.
2. If the controller re-authorizes `continue` and work HEAD remains `2c57c570...`, do not repeat any validated V0.9 slice and do not redo the content-parity design/source audit.
3. In an execution environment with authenticated GitHub CLI, inspect Phase 12 run `32178687847`, job `95846416201`, especially `Verify connected-session authority protocol`, and capture the exact failing test/type stack.
4. Fix only that observed failure in the newly touched paths (`installedContentRuntimeAdapter.ts`, `sessionContentParityRuntimeAdapter.ts`, `main.tsx`, `productionHelloReplayIdempotency.test.ts`) unless the log proves another touched dependency is responsible.
5. Re-run/observe the affected Phase 12 connected gate and UI TypeScript/production build at the resulting exact head. Do not rerun historical unchanged gates merely because watcher ownership resumes.
6. Confirm focused behavior: missing/changed-only Host transfer; existing validator/repository install; successful re-handshake; conflict/invalid fail-closed; Ready blocked until parity; reconnect sends no already-matching content.
7. Once exact-head green, promote content parity to the validated boundary and continue Character portrait + DM image handout/reconnect, then contextual DM/Content/Rules polish and dead-legacy cleanup.
8. Later obtain one exact-head full UI/Main/mechanics/persistence/installed-content/connected/Windows validation and human Windows acceptance for V0.9.
9. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN was written first for this blocker checkpoint as commit `c0543c91328860763bceefa3334ee8813b3b9f4c`.
- STATE is this checkpoint and was written after PLAN.
- STATUS may be refreshed next for human visibility.
- control must be written last with sequence `3`, status `blocked`.

## Dispatch recommendation
`blocked`
