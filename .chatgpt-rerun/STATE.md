# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T09:30:17+09:00`

## Durable execution checkpoint

Rerun preflight was repeated in the mandatory order. The live run/sequence/task identity still matches `control.json=continue`, but the product branch had advanced well beyond the previous Rerun checkpoint while `STATE.md` and `control.json` remained stale.

The earlier STATE-only reconciliation commit `f0a4cae0da9c32cf48693600892377340376b69a` was written out of protocol order. It is superseded by this ordered checkpoint sequence, which restarted with `PLAN.md` at `d978289e8efa5162efb3b88c4ec3c1c7d61a026c` and continues with this STATE update before the final `control.json` write.

Preflight reconciliation result:

- Previous Rerun product checkpoint: `cddef0c254108fe963a92cab2da7bd991a09bc21` (Druid Wild Shape domain lifecycle core only).
- Live product/source head before Rerun metadata writes: `12834c74ee0b997d9cd28f1d6c9227e326c1fe60`.
- GitHub compare shows the live product branch ahead of `cddef0c2` and not behind it.
- The post-checkpoint commits already implement the production Wild Shape seam that the old STATE listed as Next Exact Action. Do **not** repeat those changes.

Wild Shape production source now present at the live product head:

- `src/app/druidWildShapeContracts.ts` adds the smallest explicit Character-owned known-form seam, `CharacterSheet.wildShapeKnownForms?: DruidWildShapeForm[]`; runtime code does not invent a beast catalog or fallback forms.
- `src/app/druidWildShapeRuntimeAdapter.ts` reuses the existing offline/production adapter composition and projects one executable transform action per Character-known form plus the canonical Bonus Action exit.
- Transform/exit reuse the domain Wild Shape resolution, resource and initiative economy, ResolutionEvent application, Character resolution-event write-back, runtime commit, Activity/ResolutionView recording, scene projection, and event-native Undo/compensation paths.
- Existing temporary HP is handled through the explicit keep-existing/take-new choice instead of stacking or silently overwriting.
- The adapter is installed through `src/app/offlineRuntimeAdapters.ts`; no generic shapeshift subsystem was introduced.
- `src/domain/spellcasting.ts` enforces the active `DRUID_WILD_SHAPE_TAG` spellcasting prohibition before spell economy/state mutation and permits the level-18 Beast Spells exception when the active marker records `spellcastingAllowed=true`.
- `tests/ui/druidWildShapeActionRuntime.test.ts` covers no-known-form suppression, known-form transform/exit, resource + Bonus Action + temporary HP + marker state, event-native Undo restoration, explicit temporary-HP conflict choices, and freeform/initiative economy behavior.
- `tests/domain/druidWildShapeSpellcasting.test.ts` covers rejection while shaped without Beast Spells and normal spell resolution when `spellcastingAllowed=true`.
- `package.json` adds `test:druid-wild-shape` and includes it in `npm run build`, so the focused lifecycle/action/spellcasting contract is now part of the repository build gate.
- A small intervening Rage type-narrowing fix is present at `e3e4d36aea0647c0e881bd0185f049c728fbdc59`; preserve it and do not reopen completed Rage behavior.

Validation status:

- GitHub exposes no commit statuses/checks and no workflow runs for `12834c74ee0b997d9cd28f1d6c9227e326c1fe60`.
- This watcher attempted to obtain executable evidence in a fresh container checkout, but `git ls-remote https://github.com/Kaetaeru/SimpleVTT.git refs/heads/work/v1-composite` failed with `Could not resolve host: github.com`; the container has no pre-existing SimpleVTT checkout.
- Therefore no test/build green claim is made. The committed focused tests and build hook are source evidence only, not execution evidence.
- Wild Shape is **implementation-complete for the current local R1 source seam but not yet eligible to be declared source-complete or to advance the canonical handoff**, because the prior checkpoint explicitly required executable validation first.
- Connected remote-owner parity remains R2 work and is not a reason to expand or rewrite this R1 source seam now.

## Next Exact Action

Do not reimplement Druid Wild Shape production actions, known-form projection, Undo, or spellcasting enforcement.

1. In a checkout capable of executing the repository, verify the exact current branch head and run `npm run test:druid-wild-shape` first.
2. If the focused command is green, run `npm run build` so the repository-owned build gate also exercises the Wild Shape suite.
3. If either command fails, fix only the concrete failure against the existing Wild Shape implementation; do not redesign the seam or invent a generic shapeshift/form-catalog subsystem.
4. If focused validation and build are green, update `.agents/V1_CURRENT_HANDOFF.md` and the R1 checklist to mark **Druid Wild Shape source-complete**, record the exact validated SHA/evidence, and advance the canonical R1 pointer to **Monk Focus actions/resource/economy**.
5. Keep connected Host/Client/reconnect/exactly-once parity in R2 unless validation exposes a direct R1 regression.

Keep the same run/sequence/task on `continue` until executable Wild Shape validation is captured and the canonical R1 pointer is advanced.
