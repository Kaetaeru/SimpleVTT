# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T14:24:30+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in the required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live/canonical routing was reconciled. Run/sequence/task identity is unchanged.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, and Rogue Cunning Action/Uncanny Dodge R1 remain source-complete/execution-validated. Rogue exact checkpoint remains `5bb8bfbc4753dcc15f1198a04c0982817176c644` with UI run `32932781542` and Phase 12 run `32932781591` green.

Current R1 remains Berserker `Intimidating Presence` only. During this execution several concurrent workers wrote equivalent adapter/test variants to the same branch. Reconciliation therefore took precedence over feature expansion.

Current coherent production wiring after duplicate cleanup:

- `95f471ce77d8f3c8fc295ba1213441c0a3f4998c` removed duplicate Berserker adapters.
- `src/app/offlineRuntimeAdapters.ts` currently installs only `./barbarianBerserkerIntimidatingPresenceRuntimeAdapter` for this feature.
- `package.json` currently gates `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts` through `test:berserker-presence` inside `npm run build`.
- The focused test now includes initiative projection/resource/Bonus Action/frightened/Activity/generic Undo evidence and a freeform non-stranding assertion (`f8995f60cbaddb41d0fb8c899aadb4d740858b28`).
- `ca4667662184a451107c1b2d5182b63706c8dfb7` added the smallest domain compatibility seam: `BerserkerIntimidatingPresenceRequest.useBonusActionEconomy?: boolean`, defaulting to existing behavior and omitting the Bonus Action event only when explicitly `false`.

Important remaining seam at this checkpoint:

- The currently wired `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` still calls `resolveBerserkerIntimidatingPresence(...)` without passing `useBonusActionEconomy`.
- Therefore the newly added freeform assertion is expected to remain red until the adapter passes `useBonusActionEconomy: internal.sessionMode === "initiative"` (or an equivalent minimal expression preserving initiative behavior).
- No canonical completion claim was made. Exact-head CI for the concurrent cleanup/fix chain was still running/advancing; earlier observed cleanup-head runs were UI `32933824963` and Phase 12 `32933825040` at `95f471ce...`.

Do not re-create deleted duplicate adapter/test variants. Do not expose Cutting Words as an action button. Preserve the exclusion of `Preserve Life` / `Land's Aid` until their missing allocation/point-AOE authoring inputs exist. Connected remote-owner exactly-once/reconnect remains R2.

`PLAN.md` remains unchanged.

## Next Exact Action

First reconcile the live branch because concurrent commits may have advanced past `ca4667662184a451107c1b2d5182b63706c8dfb7`. If the wired adapter has not already been fixed, make only the one minimal dispatch change so `resolveBerserkerIntimidatingPresence(...)` receives `useBonusActionEconomy: internal.sessionMode === "initiative"`. Do not create another adapter. Then use exact-head GitHub Actions evidence for canonical `npm run build`; the build-gated focused test must pass both initiative and freeform cases, including resource spend, Bonus Action semantics, frightened effect, Activity, and generic event-native Undo. Only after exact-head green evidence update canonical V1 routing, then update this STATE and `control.json` last. If a newer live commit already performs the dispatch fix, do not repeat it; verify that exact head instead.
