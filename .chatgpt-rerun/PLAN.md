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

## Completed redesign — exact work head
Final work/PR head: `f1adaae4f81ef3dd98840189b9c7c606a9133ba7`.

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

## Exact validation
- UI push `31991827858`, frontend job `95276630845` at exact head `f1adaae4f81ef3dd98840189b9c7c606a9133ba7`: **completed success**.
  - unified production Session UX contract
  - non-Character production UX contract
  - PlaySessionDock/accessibility structure
  - Host preparation metadata/content
  - live DM mechanics continuity
  - existing Phase14 production lifecycle/prepared/live/ownership/inventory/spell batch
  - creation/progression/spell regressions
  - Phase09 mechanics
  - TypeScript and production frontend build
- Main Playable `31991830233`, playable-contract job `95276638981` at the same exact head: **completed success**.
  - full production UI/rules/TypeScript build
  - Phase11 offline playable
  - Phase12 connected-session authority
  - Phase13 arbitrary Character SessionProjection
  - prepared Combatant, live DM adjudication/Undo, live Combatant theater-of-mind, Host metadata, mechanics continuity, P14.10 accessibility
- Connected authority on the final product-source boundary also passed in Phase12 run `31991736009`, job `95276378850`, including the Phase11 regression and production frontend gate.
- Exact-head Windows playable job `95276973569` in Main run `31991830233` was still running when this coordination plan was written. Automated Windows success, when available, is a test-build artifact and does not substitute for human acceptance.

## Blocking Next Exact Action — HUMAN acceptance on redesigned head
Perform the human walkthrough against exact source head `f1adaae4f81ef3dd98840189b9c7c606a9133ba7` (or a later test-first fix head if the walkthrough finds an issue):

1. Session UX walkthrough:
   - offline page shows both new-Host and Join paths;
   - enter a session name, open Host, verify address/name/participants/Ready/empty encounter;
   - deliberately add/remove a Combatant;
   - stop Host and confirm the same offline page immediately restores both Host and Join, including Host-address input;
   - verify bind/join/reconnect failures have a visible recovery action.
2. Non-Character viewport/keyboard walkthrough:
   - shell/nav, Player/DM play, Combatants, Rules, Activity, Settings;
   - common desktop viewport and narrow desktop resizing;
   - keyboard focus, selected/disabled states, internal scrolling, progressive disclosure, reduced-motion result access;
   - verify routine flows do not require Debug Dock.
3. Windows two-instance connected walkthrough:
   - actual Host bind -> named session/empty preparation -> persisted Host-unknown Client Character join -> Ready -> Freeform/Initiative start;
   - visible action -> Host-authoritative Resolution -> convergence;
   - disconnect/reconnect -> no duplicate/stale projection;
   - explicit end -> clean restart -> owning Client durable state remains correct.
4. Record exact source SHA plus concrete PASS/FAIL notes/screenshots. Any failure resumes test-first only at the affected boundary.
5. After human acceptance passes, perform final exact-head Windows artifact digest/contents verification and release decision.
6. PR #109 remains draft/unmerged. No merge is authorized.

## Dispatch recommendation
`needs_user`
