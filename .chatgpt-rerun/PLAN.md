# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Tracking issue: #108
- Draft PR: #109 — open/draft, unmerged
- Phase checklist: `.agents/PHASE14_CHECKLIST.md`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved evidence — do not repeat unchanged boundaries

- Phase13 complete baseline: `7c9440970753a370fec7830cfa691832552e1d05` with recorded regression/Windows artifact evidence.
- Ready/start: product `bd1077b9bc61b86c2c0370543a16496c72f840c2`, Phase12 `31971618571`, UI `31971618534`, Main `31971618703`.
- exact-peer disconnect/live late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`, Phase12 `31972318100`, UI `31972318109`, Main `31972318188`.
- client reconnect cursor + hello replay idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, Phase12 `31973034389`, UI `31973034337`, Main `31973034347`.
- explicit session end/restart: product `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`, Main `31973878165`.
- local active-Character projection ownership: product `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`, UI `31974455354`, Main `31974455339`.
- rejected incompatible/invalid participant entry: test boundary `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`, Phase12 `31974996616`.
- owning-client durable state through explicit end + fresh storage rehydrate: test boundary `b20ecf18015cec15ad3eb26aba5674e5c91013cb`, Phase12 `31975132450`, Main `31975132458`.

Do not rerun these gates unless their relevant product/source boundary changes.

## Latest validated slice — fresh non-fixture Character create/save -> local play -> restart

Current work head: `8b162dd3b45e77f5a742badcdd7f03d613321497`.

No product source changed. The latest slice is test/workflow only:

1. `a5386f96dd0d0ad5b71c5247d8b6645ecdadbee9` adds `tests/ui/characterLibraryProductionPlayIntegration.test.ts` using the canonical `offlineRuntimeAdapters` composition and existing Character Creation + Character library persistence paths.
2. The test completes a guided Fighter draft, calls the real `finalizeCharacterDraft()`, and uses the generated Character id rather than any fixture id.
3. It proves the newly saved Character becomes the local production Scene actor, reference Character actors are absent, and derived production actions are keyed to the generated id (including basic `action.dash` and skill `action.skill.athletics`).
4. It creates a fresh adapter backed by the same `MemoryCharacterLibraryStore`, proves active Character identity rehydrates from storage, proves the Scene projection is rebuilt during hydration, and proves the same Character can re-enter local production play.
5. `f36229fd1b794953c62ea463e459c9b5b97a17ec` adds the regression to the canonical Persistence application-contract gate.
6. `8b162dd3b45e77f5a742badcdd7f03d613321497` adds the same regression to the existing Phase14 UI lifecycle/local projection step.

### Exact validation at `8b162dd3b45e77f5a742badcdd7f03d613321497`

- Persistence `31975560620`, application-contract job `95234394249`: **completed success** — new fresh Character production-play regression + existing persistence contracts + production build green. Separate Windows Tauri storage job was still running when this checkpoint was prepared and is not acceptance evidence for this test-only slice.
- UI `31975560755`, frontend job `95234394744`: **completed success** — new fresh Character regression in the Phase14 step, all historical UI/mechanics regressions, TypeScript, and production build green.
- Main Playable `31975560651`, playable-contract job `95234395572`: **completed success** — full UI/rules/TypeScript/build + Phase11 + Phase12 + Phase13 green. Windows executable subjob is not human/final release acceptance evidence here.

The regression directly supports the P14.1/P14.7/P14.9/P14.11 baseline statements for newly authored Character persistence, live Scene materialization, derived actions, active identity rehydrate, and local-play re-entry. Do not infer broader HP/item runtime durability, full spell/inventory surfaces, or human acceptance from this baseline alone.

## P14.8 existing-evidence audit

Existing `productionSessionLifecycleAdapter.test.ts`, `ProductionPlayerLobbyBridge.tsx`, and exact UI run `31967966233` directly prove without new CI:

- a user-entered Host address is passed into production `joinSession`/transport and the visible player entry path contains no reference/debug control;
- a saved non-fixture Character enters an explicit `connecting`/compatibility state and reaches `lobby` only after a compatible `hello-ack`;
- a reference/no-valid-saved production Character is blocked before transport with an explicit “select a saved production Character” requirement, while the visible lobby warns to create/save a Character rather than falling back to a fixture.

Do not over-credit yet:

- “selected persisted Character is projected before joining” should be credited together with direct SessionProjection-send/Host mount evidence;
- complete selected identity/address/compatibility/readiness display should receive one focused visible-structure assertion before credit if the current test does not assert every field;
- Error UX items using words such as actionable/retry remain open until the visible retry/error behavior itself is directly proven.

## Architecture boundaries preserved

- Character Creation and Character library persistence remain the sole durable source for the newly authored Character.
- `offlineRuntimeAdapters` remains canonical local composition; the test did not manufacture a parallel play state.
- `productionPlayRuntimeAdapter` derives Scene/action projection from the real active Character id; no Aelar/Mira fallback is introduced.
- connected Host authority, SessionProjection ownership, reconnect, session end, and owning-client write-back are unchanged.
- no tactical map/grid/path/LOS scope expansion.

## Next Exact Action

1. Do **not** rerun the fresh Character create/save/play/restart baseline or closed connected lifecycle gates unless their source boundary changes.
2. Begin P14.3 Skills on the exact fresh Character path: inspect the current production ability-check resolution routing and extend the fresh non-fixture integration with at least two different skill actions.
3. Prove each skill action uses the generated Character id, derives the expected ability/proficiency modifier, creates an authoritative d20 Resolution/result, produces Activity/provenance, and does not consume hidden initiative economy in Freeform.
4. Start test-first. Patch product source only if the fresh Character skill regression exposes a real routing/dice/activity/economy gap.
5. Run only affected UI/Main gates once; Persistence need not repeat unless durable composition changes.
6. After Skills, continue Actions/Inventory/Spells product-realistic slices, then remaining DM/live-session coverage, Windows two-instance human acceptance, and final exact-head artifact verification.
7. PR #109 remains draft/unmerged. No merge is authorized.
