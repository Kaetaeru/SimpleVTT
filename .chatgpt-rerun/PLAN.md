# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`; sequence `1`; task `phase14-production-play-session-ux`

## Preserved evidence — do not repeat unchanged boundaries
- Phase13 baseline `7c9440970753a370fec7830cfa691832552e1d05` and recorded artifact evidence.
- Ready/start: `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571`; UI `31971618534`; Main `31971618703`.
- disconnect/late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`; Phase12 `31972318100`; UI `31972318109`; Main `31972318188`.
- client reconnect/idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`; Phase12 `31973034389`; UI `31973034337`; Main `31973034347`.
- explicit session end/restart: `240592cb646bfbbfe9466f94047bc1e2f544dcf9`; Phase12 `31973878162`; Main `31973878165`.
- local projection ownership: `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`; UI `31974455354`; Main `31974455339`.
- invalid-entry ghost safety: `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`; Phase12 `31974996616`.
- durable-after-end rehydrate: `b20ecf18015cec15ad3eb26aba5674e5c91013cb`; Phase12 `31975132450`; Main `31975132458`.
- fresh Character create/save/play/restart baseline: `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`; UI `31975560755`; Main `31975560651`.

## Current validated slice — fresh Character Skills + Actions
Current exact work/product head: `5d48312289e2f01508b3860428ce98e2830d5f26`.

### Skills
`c835963e918cce94bd535054a6553ead7e786262` added `productionFreshCharacterSkills.test.ts` and wired it into the canonical UI Phase14 step. A newly created/saved non-fixture Fighter resolves one proficient and one different-ability non-proficient `action.skill.*` check with correct modifiers, generated actor id, authoritative queued d20 faces, Resolution provenance, Activity, and no Freeform action-economy consumption.

Validation at `c835963e...`: UI `31976028376` success including TypeScript/build; Main Playable `31976028381` playable-contract success including Phase11/12/13. Product source was unchanged for Skills.

### Actions and session economy repair
`da594a0858e1ee804120d6bdc807ef3d4912e241` extended the same fresh Character regression with a runtime-backed weapon attack and `action.dash`.

Two failures were diagnostic, not accepted evidence:
1. UI `31976234616` exposed an over-specific test assertion: event-native Activity state changes use target ids, not display names. `cb2427f044845ae1864f5860a31771e178a0d684` corrected only that assertion.
2. UI `31976332027` then exposed a real product bug: Dash committed, but `productionPlayRuntimeAdapter.reconcile()` reset `movementMax`/`movement` to Character speed on every snapshot, erasing session-only economy.

Product fix: remove the two unconditional movement reset lines and initialize economy from Character speed only when no economy exists. `b74d94a70e06d422e1c79f8ee6f3dff5fbf2bf2b` made that change; a whole-file write typo in one existing potion detail string was immediately repaired in `5d48312289e2f01508b3860428ce98e2830d5f26`. Final diff versus `cb2427f...` is the intended session-economy preservation only (plus file-ending newline representation).

Exact validation at `5d483122...`:
- UI `31976479248`, frontend `95236648612`: **success**. Fresh Character Skills + canonical weapon attack + Dash regression green; historical mechanics and final TypeScript/build green.
- Main Playable `31976479264`, playable-contract `95236648664`: **success**. Full UI/rules/build + Phase11 + Phase12 + Phase13 green. Windows subjob is not human/final acceptance evidence.

The action regression proves a generated Fighter attack uses its runtime-backed Character attack fact, authoritative d20/critical transaction, committed target HP event/Activity, and Freeform economy preservation; Dash commits movement state and that session-only economy now survives subsequent Character reconciliation.

## Architecture constraints preserved
- Character source/runtime facts remain canonical; no fixture fallback or hard-coded product Character id added.
- Character reconciliation no longer overwrites existing session economy; it still initializes economy for newly materialized actors.
- connected Host authority/SessionProjection/reconnect/end/write-back boundaries were untouched.
- no tactical map/grid/path/LOS expansion.

## Next Exact Action
1. Documentation-only: safely credit only directly proven checklist statements for the fresh Character baseline, P14.3 Skills gate/core statements, and P14.4 generated attack + basic Dash behavior. Do not infer visible-UI presentation, Initiative-specific behavior, expertise, Undo, or other untested statements.
2. Begin P14.5 Inventory test-first on a saved non-fixture Character. Reuse actual ItemInstance ids and existing authoritative item/healing/cost/write-back services; prove at least one supported item interaction commits atomically and persists after fresh storage rehydrate.
3. Patch product source only if the product-realistic inventory regression exposes a real gap. Run only affected UI/Persistence/Main boundaries once.
4. Then continue Spells, remaining DM/live-session and P14.8 handshake/remote-action coverage, P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
5. PR #109 remains draft/unmerged. No merge is authorized.
