# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T23:57:59+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live branch remains authoritative. PLAN routing/identity is unchanged. R1 and validated R2 slices through Devotion Smite of Protection must not be repeated without direct regression evidence.

## Devotion Smite of Protection R2 — CLOSED

- Exact green product/test head: `799fcaebd967b31c74e5520671050e81a5eb09dd`.
- UI `32981342812` / frontend `98218488387`: success including Typecheck/build.
- Phase12 `32981342785` / connected-protocol `98218488092`: success including focused authority proof, Phase11 walkthrough and production frontend gate.
- Canonical handoff was updated at `23f8c0d942c5b613d28338b70fd3bd82b6efc5be` to close Smite and advance to Fiend Dark One's Own Luck.
- A handoff typo saying Dark One was level 10+ was corrected at `5824bac31674fb4e04dd8a8bcca58c4861d47299`; current R1/domain/runtime contract is Fiend Warlock level **6+**.

## Active R2 slice — Fiend Dark One's Own Luck

R1 exact checkpoint `95042b2ef3c65aef3619334c0bec1ad243d165f2` remains local/source execution-green and was not reimplemented.

Existing production semantics preserved:
- Fiend Warlock level 6+ only;
- failed ability check/save opens existing owner interrupt;
- accept spends one canonical Dark One's Own Luck resource and adds one authoritative d10;
- decline has zero durable/shared mutation;
- existing ResolutionEvent history, owner write-back, reconnect and generic Undo remain authoritative;
- no protocol/schema or standalone fake action added.

Progress:
- `4bfd642fcf746fb27f3a930fa57a8cc61f3fdc5e`: added focused Host-unknown proof `tests/ui/connectedProjectedCharacterDarkOnesOwnLuckResolution.test.ts` covering failed projected ability check -> private owner prompt -> accepted d10/resource spend -> one Host event -> owning Client exactly-once persistence -> duplicate request/event safety -> reconnect/rebind -> compensating Undo/inverse persistence.
- `428cf64b87053a8040c818d14715b2ed9545ecb3`: wired only that proof into the existing Phase12 connected authority gate.
- Phase12 `32982812730` / connected-protocol `98223393063` exposed the first direct red: production catalog lacked `dnd.srd521.subclass.warlock.fiend-patron`. This was not merely a fixture issue: `CharacterSessionProjection` requires canonical subclass identity for a real saved Fiend Character, while `content/modules/dnd-srd-5.2.1.subclasses/module.json` contained only Berserker, Open Hand and Devotion.
- `83146b8ef94fa3ccc1352e544e58653096ae0cef`: minimal product/content-authority fix adds only canonical Fiend Patron subclass content with parent Warlock. Generated builtin catalog increased from 499 to 500 entries. No schema/protocol change.
- Exact `83146b8` UI `32983111107` / frontend `98224420396`: **success** including Typecheck/build.
- Exact `83146b8` Phase12 `32983111207` / connected-protocol `98224420823`: focused suite reached Dark One and exposed the next test-only expectation error: final total was 16, not hard-coded 14, because the chosen projected check already had its canonical check bonus. All other connected cases were green.
- `bb9bcef1844690710d6aaa62a0d870b1e5444c37`: corrected proof to assert accepted Dark One adds exactly +10 to the failed total rather than hard-coding total 14.
- Current product/test head `15681838b499e76f8558de2a52265015249e3cc0`: additionally asserts the pre-use result is genuinely below the DM DC before accepting the interrupt. This is test-only strengthening after prior Actions runs completed.
- As of this checkpoint, GitHub Actions had not yet registered UI/Phase12 runs for `bb9bcef` or `15681838`. Do not claim those heads green. A local exact-head clone attempt was abandoned because this runtime cannot resolve `github.com`; no local result exists.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Inspect **only** exact-head `15681838b499e76f8558de2a52265015249e3cc0` Actions registration/results. Do not rerun R1, Smite, Quivering or the already-green historical connected matrix merely because this is a new chat.
3. If Phase12 exists and is red, inspect only the first Dark-One-related failure and make the smallest evidence-backed correction. Treat expectation/fixture failures as tests; production changes require direct evidence. No broad refactor, protocol/schema or fake action.
4. If Phase12 focused authority, Phase11 and production frontend steps are green, inspect exact-head UI frontend/Typecheck build. Windows/Tauri remains R3 and is not an R2 closure gate.
5. Closure evidence must prove: real Fiend subclass content identity, owner-only interrupt, authoritative d10 delta, one resource spend, one Host commit, permanent Host Character-library isolation, owning Client exactly-once persistence, duplicate safety, reconnect/rebind, and compensating Undo/inverse owner convergence.
6. Only after exact green evidence, update `.agents/V1_CURRENT_HANDOFF.md` to close Dark One and advance to the recorded next R2 slice: Lore Peerless Skill. Re-read canonical state before implementing it.
7. With PLAN unchanged, future checkpoint order is STATE then `control.json` LAST. R3 Windows/Tauri, R4 rendered UX/accessibility and R5 packaging remain separate.
