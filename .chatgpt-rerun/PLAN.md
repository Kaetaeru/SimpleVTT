# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `1`
- task_id `phase14-production-play-session-ux`
- dispatch recommendation: `continue`

## Current product scope
Phase 14 is now a full player-experience completion pass, not only the earlier non-Character shell cleanup.

The target product must support both:
1. **Physical-table use:** a user can leave only the Character Sheet open and use it as the real play surface, including normal sheet reading, direct rolls and Character portrait.
2. **Device-native VTT use:** Host/Client session play uses a purpose-built exploration/freeform/combat experience with Host-authoritative mechanics, intent-first actions, physical 3D dice presentation and lightweight DM image handouts.

Authoritative product definition:
- `.agents/PHASE14_PRODUCTION_UX_REDESIGN.md` — earlier non-Character information architecture audit.
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` — reopened player-experience design and final Definition of Done, now including Character/DM image behavior.

## Preserved architecture
The redesign must not replace validated mechanics/data ownership:
- owning Client Character Library remains the durable Character source;
- Host Character projections remain ephemeral;
- Host canonical runtime remains connected mechanics authority;
- existing Scene actions/rule services/ResolutionEvent state changes remain the mechanics path;
- connected replay/reconnect/idempotency and event-native Undo remain canonical;
- installed content composition remains canonical;
- no second Character store, combat resolver, mechanics ledger or tactical map/grid/path/LOS subsystem;
- image assets are presentation data, not rules authority.

## Product pillars
### 1. Real physics 3D dice
- WebGL polyhedral d4/d6/d8/d10/d12/d20.
- gravity/collision/friction/restitution/angular velocity; visible physical settle.
- one shared renderer for creation/level-up/sheet/runtime-visible rolls.
- connected authoritative outcome never changes because of visual physics.
- reduced-motion preserves readable results.

### 2. Character Sheet as standalone tabletop tool
- identity, AC/HP/temp HP, Speed, Initiative, proficiency, passive perception, abilities, saves, skills, attacks/damage, resources, features, equipment and spells are usable without entering Scene.
- direct ability/save/skill/Initiative/attack/damage rolls.
- common d4/d6/d8/d10/d12/d20 tray and Advantage/Normal/Disadvantage for d20 checks.
- Hit Dice, spell slots and normal resources operable from the sheet.
- local sheet roll history.
- no debug/runtime window required for normal table use.

### 3. Character Sheet image
- local PNG/JPEG/WebP selection and preview.
- portrait integrated into sheet identity/header, not a new permanent manager window.
- replace/remove plus crop/focal-position adjustment.
- persists with owning Character and survives offline/restart.
- safe type/dimension/payload limits and visible recovery for invalid assets.
- if projected into a session, portrait remains presentation metadata and does not alter Character authority.
- compact Character/play thumbnails may reuse the same asset; no duplicate image source/editor.

### 4. Intent-first exploration/freeform/combat
Primary action vocabulary follows official action intent rather than exposing every skill as a top-level action:
- Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize.

Required interaction hierarchy:
- choose intent first;
- only then choose relevant skill/item/weapon/spell/target if that intent requires it;
- Influence/Search/Study group their appropriate skills;
- Hide resolves through Stealth;
- improvised actions can be described for DM adjudication without introducing a second mechanics engine.

Exploration/freeform stays visually quiet. Initiative adds round/current turn/compact turn order/action economy/targets only when combat needs them.

### 5. DM image reveal / handout
- compact contextual `이미지 보여주기` control in DM play, not a permanent side panel.
- local PNG/JPEG/WebP choose + preview; optional title/caption/alt description.
- explicit reveal to all connected players and explicit withdraw/hide.
- player receives a focused handout/lightbox, can close/minimize and reopen the current reveal without leaving the session.
- fit-to-window plus local zoom/pan.
- reconnecting Client converges to the currently active reveal.
- reveal/hide is connected presentation state, not ResolutionEvent/combat Undo state.
- works through the existing connected-session path without public URL/cloud hosting.
- bounded/validated/downscaled transfer; malformed/oversize assets fail recoverably.
- no token placement, grid, fog, distance, pathing or LOS.

### 6. Surface reduction
Routine production play must not restore the old window clutter:
- no permanently open left entity list in freeform;
- no permanently open Inspector;
- no permanently open Activity panel;
- no permanently open DM image manager;
- no flat wall of skill-check actions;
- no routine debug/provenance/internal metadata panels;
- duplicated Character/target summaries are removed.

## Existing validated baseline that remains relevant
Earlier broad non-Character redesign at `f1adaae4f81ef3dd98840189b9c7c606a9133ba7` had UI/Main validation green. The later Session scrolling repair at `706d71ae8675f8b285e582cc48b992141a48d9b9` also passed its UI boundary. These are historical evidence only; the reopened player-experience branch now contains later changes and must receive new exact-head validation.

## Current work branch
At scope-definition time PR #109 head is `81fe7349f45ebe7d48537faeffcecfcfff156e0f`.

Compared with the prior `706d71ae...` baseline, the branch already contains in-progress player-experience work including:
- `PhysicsDice3D.tsx` and shared VisualDice integration;
- `CharacterSheetPlayScreen.tsx`;
- `ProductionPlayScreen.tsx` and intent model;
- new UI/physics contracts and dependencies;
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`.

This current head is **not yet the release acceptance SHA**. The new Character portrait and DM image reveal requirements were defined after the initial player-experience implementation work and must be implemented/tested before completion.

## Definition of Done — one exact source SHA
Phase 14 is complete only when all of the following are true together:

### A. Sheet-only tabletop acceptance
- routine Character play is possible with only the Character Sheet visible;
- ability/save/skill/Initiative/attack/damage/common-die rolls work from the sheet;
- Hit Dice/spell slots/resources are usable;
- portrait add/position/replace/remove/persistence works offline and after restart;
- actual physical 3D dice presentation is readable and accessible.

### B. Exploration/freeform acceptance
- the surface is materially quieter than combat;
- skills are secondary choices under player intent, not a top-level action wall;
- targets/participants/results appear only when relevant;
- no permanent Inspector/Activity/debug/image panels.

### C. Combat acceptance
- Initiative adds only combat-specific round/turn/order/economy/target information;
- official/contextual actions, attacks, spells and explicit target choice drive the existing authoritative runtime;
- ResolutionEvent/Undo/reconnect/state convergence remain correct.

### D. Image acceptance
- owning Character portrait is durable and offline-safe;
- DM can preview/reveal/withdraw a local handout without external hosting;
- all connected Clients receive the reveal;
- Clients can dismiss/minimize/reopen it;
- reconnect restores the active reveal;
- invalid/oversize asset handling, cleanup, focus/keyboard and bounded network transfer are verified;
- images never alter mechanics authority/state.

### E. Session/quality acceptance
- Host/Join/session name/Ready/start/stop/reconnect remain understandable;
- Session remains scrollable in constrained Windows viewports;
- fresh Host has no surprise reference Goblin/Wolf/etc.;
- owning-Client durability/Host ephemeral projection remain intact;
- TypeScript, production build, UI contracts, mechanics regressions, connected authority tests and exact-head Windows build are green;
- human Windows validation covers both sheet-only tabletop use and two-instance Host/Client play, including DM image reveal/reconnect behavior.

## Next Exact Action
Resume on `agent/108-production-play-session-ux` from head `81fe7349f45ebe7d48537faeffcecfcfff156e0f` without repeating validated historical mechanics boundaries:

1. Reconcile current in-progress player-experience source/tests and close any existing TypeScript/build failures first.
2. Add tests first for Character portrait persistence/ownership/offline restart, image validation/cleanup, and DM reveal/hide/reconnect presentation state.
3. Implement Character portrait asset storage + sheet-integrated image UX without creating a second Character store.
4. Implement DM handout presentation transport/state and player lightbox/minimize/reopen UX without using ResolutionEvent or adding a tactical-map system.
5. Finish remaining standalone-sheet gaps (Initiative, Hit Dice, spell slots/resources) and authoritative intent-action wiring not yet complete.
6. Remove temporary integration workflow/script after they are no longer needed.
7. Run targeted tests, then UI/Main/connected exact-head validation and Windows build.
8. Perform human Windows acceptance on the same exact source SHA; failures resume test-first only at affected boundaries.
9. PR #109 stays draft/unmerged. No merge is authorized.

## Dispatch recommendation
`continue`
