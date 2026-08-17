# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `1`
- task_id `phase14-production-play-session-ux`
- dispatch recommendation: `needs_user`

## Human acceptance feedback that reopened the UX boundary
The previous human walkthrough found concrete production UX failures on validated head `a750ae844c8a0ce831e4c873574d074616eab3c0`:
- after stopping a Host, the Host-address/IP join input could disappear;
- session/server naming was not presented as a normal Host setup concept;
- reference Goblin/Wolf/Character fixtures appeared as if they were real production encounter content;
- the surrounding non-Character product UI exposed too much implementation/reference language and duplicated state.

This is valid human-gate failure evidence, so the sequence resumed at the affected UI/UX boundary instead of repeating previously validated mechanics/protocol work.

## Information architecture recorded before implementation
Authoritative redesign audit: `.agents/PHASE14_PRODUCTION_UX_REDESIGN.md`.

Frozen for this redesign:
- Character Library
- Character Sheet
- Character Create/Edit
- Level-Up

Redesigned scope:
- Session entry/lifecycle
- global shell/navigation
- Player/DM play workspace
- Combatants / Encounter preparation
- Rules Catalog
- Activity
- Settings

Primary information rules:
- show the current task, human-readable session/connection state only when relevant, one clear primary action, user-facing names/results, and recoverable errors with the next action;
- show Initiative/Ready/Host endpoint/action economy/encounter management only in states where they matter;
- move provenance/package IDs/event IDs/spatial diagnostics/import detail to progressive disclosure;
- remove raw role, healthy compatibility internals, RulesProfile/internal IDs, Reference/fixture/adapter/manifest/protocol wording, Definition/Instance jargon, duplicate panels, and routine Debug Dock instructions from the primary production path.

## Completed redesign — prior exact work head
Prior redesigned work/PR head: `f1adaae4f81ef3dd98840189b9c7c606a9133ba7`.

### Session lifecycle and root-cause repair
- Replaced the visible legacy Session cards plus separate Host-lifecycle/Player-lobby overlays with one state-driven production Session workspace mounted into a dedicated Session route root.
- Removed the old CSS replacement trick that hid a legacy Join card while a portal supplied another card.
- Offline Session always presents both `새 세션 만들기` and `세션 참가하기`, including Host address input.
- Added explicit session-name input before Host open; Host-selected name is carried to Clients in the connected `hello-ack` handshake.
- Host preparation now presents session name/address, participant/Ready roster, explicit encounter preparation, mode selection, Start, and Stop.
- Client lobby/live presents the session/Host/Character summary, Ready, reconnect/recovery guidance, and leave.
- Connected-session stop now restores the default offline/player shell instead of leaving the app stranded in the previous top-level DM shell.

### Production encounter content
- Fresh production Host snapshots suppress exact reference fixture actors (`char.aelar`, `char.mira`, Goblin A/B, Wolf, Training Guardian) and the Host's automatic local Character projection.
- A fresh production Host therefore starts with an empty encounter.
- Remote ephemeral Character projections and Combatants intentionally instantiated by the DM remain on the existing authoritative runtime path.
- Empty DM scenes are now a first-class safe UI state rather than assuming at least one entity exists.

### Non-Character UX redesign
- Global shell/navigation: consistent `세션` destination, connected-session authority determines Host/Player surface, connection/mode metadata is shown only when relevant.
- Player/DM Play: reduced duplicate entity panels; actor/action/target/result hierarchy is primary; empty encounter is safe; implementation explanation removed from the primary stage.
- Combatants: `라이브러리` vs `현재 Encounter`, search, explicit `Encounter에 추가/제거`; source/action metadata is secondary detail instead of Definition/Instance jargon.
- Rules: search/category-first browsing with rule detail; source/scope/content ID/capabilities moved under `기술 정보`.
- Activity: user-readable `플레이 기록` outcome timeline; technical record details collapsed; no always-visible generic Undo control.
- Settings: real appearance/accent/accessibility/motion controls only; no Reference/Debug Dock instructions.
- Added `production-ux-redesign.css` for empty states, focused play layout, details disclosure, responsive behavior, keyboard focus, and reduced-motion safety.

## Preserved architecture
- Character Library/Sheet/Create/Edit/Level-Up UI/UX was not redesigned.
- Owning Client Character Library remains the durable Character source; Host Character projections remain ephemeral.
- Host canonical content/runtime remains mechanics authority.
- Existing connected ledger, Scene/spatial runtime, ResolutionEvent flow, reconnect/idempotency and event-native Undo remain authoritative.
- Existing installed-content composition and production Character source are reused.
- No duplicate session store, durable Character source, mechanics runtime, tactical-map system, or merge was introduced.

## Test-first / failure evidence
- Initial Session redesign test correctly failed because reference `char.aelar` was re-injected by the existing production snapshot projection layer; the production Host projection boundary was then corrected without suppressing real remote projections or explicit Combatant instances.
- UI `31991600000` / frontend `95276040404` later showed the Session redesign tests green and failed only a new shell-regression regex that did not recognize the safe optional-chain form `snapshot?.session`; the product behavior was correct and the test contract was corrected.

## Prior exact validation
- UI push `31991827858`, frontend job `95276630845` at exact head `f1adaae4f81ef3dd98840189b9c7c606a9133ba7`: **completed success**.
- Main Playable `31991830233`, playable-contract job `95276638981` at the same exact head: **completed success**.
- Connected authority on the final product-source boundary also passed in Phase12 run `31991736009`, job `95276378850`.

## Human acceptance follow-up — Session tab scrolling defect
Human validation of the redesigned Windows build found another concrete affected-boundary failure: the Session tab content could not scroll downward when its content exceeded the available viewport.

### Root cause
- The redesigned Session route still relied on the generic `.screen { height:100%; overflow:auto }` contract inside `.content`, while `.content` itself clips overflow.
- In the nested grid/Tauri WebView layout, that percentage-height contract did not provide a sufficiently robust, definite scroll viewport for the portal-mounted Session workspace.

### Test-first repair
- `c998cbe9181de242c16f5ed2f85f3692c7ece362` added a Session-specific viewport scrolling regression to `tests/ui/productionSessionWorkspaceRedesign.test.ts`.
- The regression requires `.production-session-screen` to own a definite `position:absolute; inset:0` viewport with `height:auto`, `min-height:0`, `overflow-y:auto`, contained overscroll, and stable scrollbar gutter; it also requires the Session mount to retain full-height, start-aligned content.
- `706d71ae8675f8b285e582cc48b992141a48d9b9` implements that contract in `production-session-workspace.css` without changing Session state, connected authority, mechanics, Character UI, or data ownership.

### Exact validation of scrolling repair
- UI PR run `31992965044`, frontend job `95279616079`, exact head `706d71ae8675f8b285e582cc48b992141a48d9b9`: **completed success**.
- The changed Session UX/scroll contract, non-Character UX contract, P14.10 accessibility structure, Phase14 lifecycle/ownership/inventory/spell batch, creation/progression/spell regressions, Phase09 mechanics, TypeScript, and production frontend build all passed.

## Blocking Next Exact Action — HUMAN acceptance on latest fix head
Perform the human walkthrough against exact source head `706d71ae8675f8b285e582cc48b992141a48d9b9` unless a later human-found issue creates another test-first fix head:

1. Session scrolling regression check first:
   - open Session at a viewport where preparation content exceeds the available height;
   - verify mouse wheel/trackpad/PageDown can reach the bottom of the Session workspace;
   - verify Host preparation controls, Encounter list, Start/Stop controls remain reachable;
   - verify scrolling still works after Host start/stop state transitions.
2. Continue Session UX walkthrough:
   - offline page shows both new-Host and Join paths;
   - enter a session name, open Host, verify address/name/participants/Ready/empty encounter;
   - deliberately add/remove a Combatant;
   - stop Host and confirm the same offline page immediately restores both Host and Join, including Host-address input;
   - verify bind/join/reconnect failures have a visible recovery action.
3. Non-Character viewport/keyboard walkthrough: shell/nav, Player/DM play, Combatants, Rules, Activity, Settings; keyboard/focus/selected/disabled/scroll/detail/reduced-motion behavior.
4. Windows two-instance connected walkthrough: actual Host bind -> named session/empty preparation -> persisted Host-unknown Client Character join -> Ready -> Freeform/Initiative start -> authoritative action convergence -> reconnect -> end/restart -> owning Client durable state.
5. Record exact source SHA plus concrete PASS/FAIL notes/screenshots. Any failure resumes test-first only at the affected boundary.
6. After human acceptance passes, perform final exact-head Windows artifact digest/contents verification and release decision.
7. PR #109 remains draft/unmerged. No merge is authorized.

## Dispatch recommendation
`needs_user`
