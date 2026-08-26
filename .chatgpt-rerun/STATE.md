# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T23:39:51+09:00`

## Durable checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live branch remains authoritative. PLAN routing/identity is unchanged. Validated R2 slices through Open Hand Quivering Palm must not be repeated without direct regression evidence.

## Devotion Smite of Protection R2 — EXECUTION GREEN

R1 exact checkpoint `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` was preserved. No standalone Smite of Protection action, protocol or schema was added.

Focused Host-unknown proof/gate chain:
- `09e114d13244422818f478cd129d1f2168314425`: added `connectedProjectedCharacterSmiteOfProtectionResolution.test.ts` using the existing projected Divine Smite -> automatic protection path.
- `81e7817ab87bebffeeee2def1c086289aefdae83`: wired only that proof into the existing Phase12 connected authority gate.
- Phase12 `32980372120` first exposed `ledger.cursor 0 !== 1`; all other connected cases were green.
- `3d124cf8c74e1b424b4002c8a9a4a4c7b9dae45b`: corrected the synthetic persisted-character fixture to include the existing class-feature Divine Smite resource. This was insufficient and therefore was not treated as the product fix.
- Root cause: a Host-reconstructed remote spellcaster does not carry the derived `spellSlotMaximums` cache. `productionSpellcasterProjectionAdapter` trusted that cache and projected no authoritative slots, so a slotted remote Divine Smite could not commit an event.
- `799fcaebd967b31c74e5520671050e81a5eb09dd`: minimal product fix. When `spellSlotMaximums` is absent, the existing spellcaster projection now derives slot maxima from `classLevels` through existing `multiclassSpellSlots`; no new durable field or SessionProjection schema was introduced.

Exact `799fcae` evidence:
- UI run `32981342812` / frontend job `98218488387`: **success**, including Typecheck/build.
- Phase12 run `32981342785` / connected-protocol job `98218488092`: **success**, including focused connected authority proof, Phase11 offline walkthrough and production frontend gate.
- Windows connected job is R3 evidence and is not an R2 closure gate.

The focused proof now covers Host-unknown Divine Smite resolution, automatic Smite of Protection effect in the same authoritative event, Host permanent Character-library isolation, owning Client exactly-once apply, duplicate request/event safety, reconnect/rebind and compensating Undo convergence.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Close Devotion Smite of Protection R2 in `.agents/V1_CURRENT_HANDOFF.md` using exact green head `799fcaebd967b31c74e5520671050e81a5eb09dd`, UI `32981342812` / `98218488387`, Phase12 `32981342785` / `98218488092`, and the derived-slot root cause above. Preserve all historical evidence; do not replace the large handoff wholesale merely to update a few lines.
3. Reconcile the stale `V1_RELEASE_EXECUTION_CHECKLIST.md` NEXT when a safe non-destructive edit path is available; that checklist itself says current immediate work comes from `V1_CURRENT_HANDOFF.md`.
4. After canonical closure, advance to the next recorded R2 slice: **Fiend Dark One's Own Luck**. Re-read live canonical state first and do not repeat Smite/Quivering or earlier validated slices.
5. Keep R3 Windows/Tauri, R4 rendered UX/accessibility and R5 packaging separate.
6. Future Rerun checkpoint order remains `PLAN -> STATE -> control.json`; with PLAN unchanged, write STATE then `control.json` LAST.
