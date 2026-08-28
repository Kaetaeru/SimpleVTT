# SimpleVTT V0.9 Existing UI Reuse / Replacement Map

## 0. Purpose

This document prevents the Session redesign from accidentally creating duplicate mechanics, duplicate Character state, duplicate transport behavior or parallel visual systems.

Each existing surface is classified as:
- **Keep authority** — preserve as canonical source/command path;
- **Reuse/refactor** — retain useful logic/content but change shell/layout;
- **Replace presentation** — existing visible structure conflicts with the approved UI contract;
- **Retire from normal Session flow** — keep only where still needed outside Session or for diagnostics.

---

# 1. App and state foundation

## `src/app/AppProvider.tsx`
Classification: **Keep authority**.

Keep:
- `snapshot` as the UI projection source;
- existing command functions for Character, action, initiative, combatants, session, adjudication and Undo;
- external adapter snapshot subscription.

Change only as needed to expose already-canonical operations to new UI components. Do not move Session UI-local pane state into AppProvider unless it must be shared across Session components and remains presentation-only.

Do not add:
- duplicate Character cache;
- duplicate Scene store;
- duplicate Resolution state;
- second session lifecycle.

## `src/app/contracts.ts`
Classification: **Keep canonical view contracts; extend narrowly only when real UI facts are missing**.

Existing `AppSnapshot` already exposes Character, Scene, Actions, Economy, Activity, Resolution and Session projections.

If the new UI needs a fact, prefer deriving it from these structures or adding a narrowly defined presentation fact from the existing runtime authority. Do not create a separate Session-shell domain model that copies them.

---

# 2. App shell / routing

## `src/App.tsx`
Classification: **Replace Session presentation; retain Library route responsibilities**.

Current issues:
- permanent Library sidebar remains around Play;
- Session is one route among Home/Characters/Content/Rules/Settings;
- normal flow uses `플레이로 돌아가기`;
- Character/Rules/Activity/Session are route replacements.

Target:
- AppRoot chooses LibraryModeRoot or SessionModeRoot;
- Library navigation remains for out-of-session work;
- active Session no longer renders the full Library sidebar as primary navigation;
- old Session-related route jumps become layers in SessionModeRoot.

Keep:
- Library screens until individually redesigned;
- debug shortcut as non-production diagnostic if still required.

Retire from normal Session flow:
- `플레이로 돌아가기`;
- session-time Character/Rules/Activity route round-trips.

---

# 3. Production play

## `src/ProductionPlayScreen.tsx`
Classification: **Reuse mechanics projection/helpers; replace visible shell**.

Keep/reuse:
- use of `snapshot.scene`;
- current actor/DM actor derivation;
- `OFFICIAL_PLAY_INTENTS` and `intentOptions` mapping;
- `resolveAction`, `selectDmActor`, initiative and combatant commands;
- action metadata helpers such as target/effect/resource summaries where useful;
- target selection based on `eligibleTargetIds`;
- multi-target completion semantics.

Replace/remove from permanent Freeform UI:
- `SCENE ACTORS` / Actor-card wall;
- permanent party/NPC card rows;
- permanent `공통/클래스/주문/아이템/패시브/커스텀` hotbar;
- Freeform action economy display;
- lifecycle-based `canManageEncounter` UX gate;
- empty-state copy that tells DM to wait for participants;
- any range rejection based only on absent distance facts.

Refactor target:
- split current monolith into projection/controller helpers consumed by `MainFocus`, `ActionDock`, `TargetChooser`, `DmActorSwitcher`, `EncounterPane`.

Do not copy action resolution logic into the new components.

---

# 4. Intent model

## `src/playerExperienceModel.ts`
Classification: **Keep and extend as the action vocabulary/mapping authority for UI intent grouping**.

Keep:
- official intent IDs/labels;
- skill fact mapping;
- `intentOptions` projection from existing `ActionVm[]`.

Add only if needed:
- presentation metadata such as default resting priority or icon key;
- no mechanics legality rules that duplicate `ActionVm.available` / runtime action generation.

---

# 5. Sheet layout router

## `src/CharacterSheetPlayScreen.tsx`
Classification: **Reuse layout preference; refactor wrapper**.

Keep:
- `readSheetLayoutPreference` / `persistSheetLayoutPreference`;
- SimpleVTT vs Official presentation switch over the same canonical Character.

Replace:
- route-centric props (`onScene`, `onLevelUp`, `onEdit`) as mandatory part of the shared Sheet content contract;
- standalone-only outer toolbar assumptions.

Target:
- shared `CharacterSheetWorkspace` controller with two hosts:
  - Standalone Sheet host in Library Mode;
  - In-session Full Sheet host in Session LayerHost.

---

# 6. SimpleVTT standalone sheet

## `src/LegacyCharacterSheetPlayScreen.tsx`
Classification: **Reuse data projection and sheet sections; replace navigation/presentation coupling**.

Keep/reuse:
- `projectOfficialSheet` projection;
- ability/save/skill calculations;
- attack/resource/feature/equipment/spell presentation sections;
- common dice/local roll calculation for standalone use where still appropriate.

Must remove/refactor from reusable content:
- `기기로 플레이` route button;
- direct dependence on a route callback to return to Scene;
- embedded `sheet-roll-result` + `VisualDiceTray` as the primary roll presentation.

Target extraction:
- `SimpleVttSheetContent` receives canonical Character/view and roll/action callbacks;
- host decides standalone vs in-session toolbar;
- roll events are presented by body/app-level dice/result presentation.

Important: local standalone random rolls remain local presentation behavior; connected authoritative mechanics must continue through authoritative action resolution where applicable.

---

# 7. Official-style sheet

## `src/OfficialCharacterSheetPlayScreen.tsx`
Classification: **High-value reuse; refactor controller/host boundary**.

Keep:
- `OfficialCharacterSheetPage`;
- `OfficialSpellcastingSheetPage`;
- `projectOfficialSheet`;
- item operations through existing AppProvider commands;
- page switch Character/Spellcasting;
- layout-specific content and styling.

Refactor:
- outer route toolbar;
- `기기로 플레이` button;
- edit/level-up navigation callbacks from the reusable Session content path;
- embedded `VisualDiceTray` result area.

In Session Mode:
- Official page content is mounted inside Full Sheet workspace;
- Rules may open above it;
- close returns to previous Session context;
- rolls use body/app presentation;
- Character build Edit/Level Up are not normal one-click Session actions and may remain Library/explicit advanced flows.

---

# 8. Official sheet leaf pages

## `src/OfficialCharacterSheetPage.tsx`
Classification: **Reuse**.

Keep content layout and click callbacks where they represent legitimate Sheet interactions.

Ensure callbacks are injected from the shared Sheet controller rather than requiring route ownership.

## `src/OfficialSpellcastingSheetPage.tsx`
Classification: **Reuse**.

Keep spellcasting display and canonical action references.

Add Rules deep-link affordance through the Session/Sheet host rather than navigating to Library Rules route.

---

# 9. Dice presentation

## `src/VisualDiceBridge.tsx`
Classification: **Keep app-level presentation path; retire embedded tray usage from normal Sheet roll UX**.

Keep:
- body-level/portal cinematic presentation path;
- authoritative connected result presentation semantics.

Refactor if necessary:
- expose one presentation event interface usable by standalone Sheet, in-session Sheet and action resolution.

Retire from primary Sheet UX:
- `VisualDiceTray` embedded in `sheet-roll-result` layout.

No second dice renderer should be introduced.

---

# 10. Resolution UI

## current global `ResolutionDrawer` path in `App.tsx`
Classification: **Keep resolution authority; replace presentation**.

Keep:
- `snapshot.resolution`;
- `advanceResolution`, interrupt response, adjudication and dismissal commands;
- ResolutionEvent/Undo semantics.

Replace:
- route/shell-specific drawer if it conflicts with the new transient Result/Dice layer contract.

Target:
- `ResolutionPresentationLayer` in LayerHost reads the same resolution projection.

---

# 11. Handout

## `src/SessionImageHandoutBridge.tsx`
Classification: **Keep authority/presentation state; integrate launcher/view placement**.

Keep:
- existing reveal/withdraw/dismiss/reopen/reconnect behavior;
- current transport/state adapters;
- local validated image constraints.

Change:
- DM launcher location -> Session Utility/Handout tool;
- Player reopen affordance -> Utility Rail only while a reveal exists;
- viewer -> ordered LayerHost presentation.

Do not build a new image library/manager or transport.

---

# 12. Character portrait

## `src/CharacterPortraitBridge.tsx`
Classification: **Keep durable Character authority; integrate visible controls where appropriate**.

Portrait stays part of the owning Character. Quick/Full Sheet reads it from the canonical Character projection/presentation contract.

Do not add a Session-only portrait copy.

---

# 13. Character Library selection

## `src/CharacterLibraryUxBridge.tsx`
Classification: **Keep Library-only Character selection wiring**.

Use it only before Session entry / in Library Mode as appropriate.

Player Session identity must come from the already-selected canonical Character, not a new Session-only character selector.

---

# 14. Session/network bridges

## `src/ProductionSessionWorkspaceBridge.tsx`
Classification: **Inspect/refactor visible launcher only; preserve underlying existing session operations**.

Session opening/joining UI may move into Library `Session Entry` and Session share/settings drawer.

Do not create a second lifecycle.

## `src/ProductionSessionDirectNetworkBridge.tsx`
Classification: **Keep direct-IP authority/adapter integration; move visible fields to correct entry/settings surfaces**.

Host open still creates an active DM Session immediately. Join does not add Lobby/Ready/Start UX.

---

# 15. Runtime adapters

The following categories are **keep authority** unless a concrete observed defect requires a focused fix:
- offline runtime adapters;
- connected session adapter;
- direct network adapter;
- participant idempotency;
- projection lifecycle;
- role/action/turn/correction routing;
- production session lifecycle;
- content parity;
- handout transport/state;
- Character library runtime/persistence.

The Session redesign should primarily consume these through existing projections/commands.

---

# 16. CSS/style layers

Current CSS may be reused selectively for Sheet internals and domain components, but the following shell/layout styling should be considered replaceable:
- old V1 permanent sidebar during active Session;
- production actor board/card-wall layout;
- permanent category hotbar;
- sheet-local roll frame.

New Session layout CSS must use explicit shell tokens for Session Bar, Action Dock, Utility Rail, pane widths, layer z-order and responsive transitions.

---

# 17. Migration acceptance

A redesign slice is not complete merely because the new UI exists. It must also prove that the old conflicting surface is no longer reachable in normal Session flow.

Required checks:
- no active Session uses the Library sidebar as primary navigation;
- no routine `플레이로 돌아가기`;
- no Sheet-local dice tray for primary roll presentation;
- no permanent Freeform Actor board/hotbar/economy;
- no Host Preparing/Lobby/Ready/Start user gate;
- no duplicate Character/session/action/Resolution store;
- existing runtime authority remains wired through AppProvider/adapters;
- old components may remain only where intentionally reused for standalone/diagnostic paths.