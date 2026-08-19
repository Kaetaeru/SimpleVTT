# Rerun Plan — SimpleVTT V0.9 complete UI-first implementation

## Coordinates and authorization
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR: #109 — keep open/draft/unmerged; **never merge without explicit user authorization**
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- current exact work-branch source checkpoint: `fbf37144d2ed56272429287419393bf221d83f44`
- previous broad automated-green pre-replan implementation: `d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- current milestone: **V0.9 continuous-session UI implementation**
- dispatch recommendation: `continue`

The user has explicitly authorized source implementation to continue on the same sequence. Resume from the durable checkpoint; do not redo already validated walking-skeleton work merely because rerun restarts.

---

# 1. Product north star

SimpleVTT V0.9 is an **always-on tabletop companion for an entire D&D session**.

Once a session is active, the user should be able to keep SimpleVTT open continuously through:
- conversation;
- exploration;
- Character reference;
- rules lookup;
- ability/save/skill checks;
- attacks, spells and other actions;
- Freeform play;
- Initiative/combat;
- DM Encounter operation;
- participants and reconnect;
- handouts;
- recent outcomes and Undo where authorized;
- session end.

The visible product contract is more important than mirroring internal runtime lifecycle states. Internal handshake/content sync/replay/reconnect mechanics remain, but healthy internals must not force the user through artificial lobby/setup screens.

Core UX test:
> During a normal session, the user should rarely need to leave the active Session Shell, and opening a Sheet/Rules/tool must not destroy the current play context.

---

# 2. Canonical architecture invariants — never violate

Preserve the existing product architecture:
- one canonical Character; owning Client Character Library remains durable authority;
- Host projections are ephemeral and Host mechanics remain authoritative;
- existing ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- existing Scene/action runtime mechanics remain canonical;
- installed-content composition and RuleModule validation remain authority;
- Freeform has no Initiative action-economy semantics;
- dice/VFX/images/appearance/sheet layout are presentation only;
- existing direct-IP/session/network/content protocol remains canonical.

Do **not** create:
- a second Character store;
- a second session lifecycle authority;
- a second action resolver;
- a second target-legality engine;
- a second event ledger/Undo system;
- a second content store/protocol;
- tactical grid/token/Fog/pathfinding/minimap/LOS/cloud as a default product subsystem.

UI components read existing `AppSnapshot` projections and send commands through existing `AppProvider` / runtime adapters.

New Session UI state may own only ephemeral presentation state such as:
- which pane/tool is open;
- intent/detail/target interaction step;
- focus restoration;
- scroll/tab state;
- responsive layout state.

---

# 3. Planning authority and conflict rule

The following work-branch documents capture the detailed approved design and remain supporting authority:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`
- `.agents/V0_9_SESSION_UI_ARCHITECTURE_CONTRACT.md`
- `.agents/V0_9_EXISTING_UI_REUSE_MAP.md`
- `.agents/V0_9_QUICK_SHEET_INFORMATION_ARCHITECTURE.md`
- `.agents/V0_9_FULL_SHEET_IN_SESSION_REUSE_CONTRACT.md`
- `.agents/V0_9_ACTION_DOCK_BEHAVIOR_MATRIX.md`

This PLAN consolidates the decisions the rerun watcher needs to execute V0.9 without depending on conversational memory.

If older Phase 14 documents, old UI, old tests, or the existing PR body conflict with this V0.9 UI-first plan, **this V0.9 plan and the V0.9 documents above win** unless the user later changes direction.

Explicitly superseded assumptions include:
- required Host Preparing page;
- Player lobby / Ready lifecycle;
- mandatory `플레이 시작` activation gate;
- no spatial fact => out of range;
- Sheet-local dice frame as primary roll presentation;
- active Play as merely one route inside the Library sidebar.

---

# 4. Top-level application modes

## Library Mode
Used when no connected/host session is active.

Independent Library pages may include:
1. Home / Launch;
2. Character Library;
3. Character Create / Edit;
4. Standalone Character Sheet;
5. Content / Add-on management;
6. full Rules Library;
7. Settings;
8. Session Entry.

Standalone Character Sheet remains useful at a physical table without a networked SimpleVTT session.

## Active Session Mode
When Host/Client session state is accepted by existing runtime facts, the app switches to one persistent `SessionModeRoot`.

Active Session is **not** a peer route alongside Home/Characters/Rules.

The dominant Library sidebar and routine `플레이로 돌아가기` navigation must disappear from normal Session use.

Session Mode remains mounted until:
- DM ends the session;
- Player explicitly leaves;
- recovery is impossible and the user explicitly exits.

---

# 5. Session entry and lifecycle

## DM / Host
`세션 열기` success means the session is already active.

Immediately after Host succeeds:
- user is DM;
- enter active DM Session workspace;
- DM tools are immediately usable;
- session editing is immediately usable;
- zero connected Players is valid;
- zero Combatants is valid;
- DM may prepare and play continuously in the same workspace.

Do not require:
- Host Preparing completion;
- Player Ready states;
- a separate `플레이 시작` button.

## Player / Client
Player selects Character + Host address and joins an already active session.

Internal connection/content parity may occur automatically, then the Player enters the current session projection.

Do not expose a mandatory long-lived Lobby/Ready screen.

## Reconnect
Reconnect restores the active current session, not a pre-start lobby.

Open Sheet/Rules state may be preserved locally when still valid after recovered authoritative snapshot reconciliation.

---

# 6. Persistent Session Shell visual contract

Desktop reference viewport: `1440 x 900`.

Persistent regions:
1. **Session Bar** — approximately 52px top;
2. **Main Focus** — largest region and visual priority;
3. **Action Dock** — approximately 64–72px resting at bottom, expanding contextually;
4. **Utility Rail** — approximately 48–56px on right desktop;
5. **Layer Host** — panes/drawers/Full Sheet/dice/result/handout/recovery over the mounted shell.

Main Focus must dominate. Tool chrome must not turn Freeform into a permanent videogame combat HUD.

Layer priority:
1. base Session Shell;
2. quick popover;
3. utility pane/drawer;
4. Full Sheet / large workspace;
5. transient dice/result/handout presentation;
6. blocking recovery/confirmation.

`Escape` closes/backtracks exactly one top layer/action step. It never leaves or ends the Session.

---

# 7. Shared DM/Player Session surfaces

Both roles share the same fundamental shell and interaction language.

Shared surfaces/states:
- Active Session Shell;
- Freeform workspace;
- Initiative expansion;
- action intent/detail/target flow;
- Rules lookup;
- Activity/recent result access;
- result presentation;
- cinematic dice layer;
- handout viewer;
- connection/recovery/error layers.

Role differences are permissions, identity, and available tools — not entirely separate products.

---

# 8. Player-specific Session contract

Session Bar always exposes the Player Character as a first-class control:
- portrait;
- Character name;
- compact HP;
- one click -> Quick Sheet;
- explicit adjacent/inside affordance -> Full Sheet.

Player Utility order on desktop:
1. Sheet;
2. Rules;
3. Activity;
4. current Handout reopen when relevant;
5. Session/connection/leave.

Player-specific flows:
- Join Session;
- active Player workspace;
- My Character quick/full reference;
- leave/reconnect.

The Character Sheet is not hidden behind a generic tool menu two levels deep.

---

# 9. DM-specific Session contract

Session Bar exposes current acting Actor identity.

DM identity behavior:
- click current Actor -> Actor Quick View;
- explicit switch affordance -> Actor Switcher.

DM Utility order on desktop:
1. Actor;
2. Rules;
3. Encounter;
4. Participants;
5. Handout;
6. Activity / Undo;
7. Session share/settings.

DM must be able to operate with zero Players.

DM workspace actions available during an active session include:
- edit session/share details;
- select acting Actor;
- add/remove/configure Combatants/Encounter where the individual operation is safe;
- start/end Initiative as needed;
- end/advance turns as authorized;
- reveal/withdraw handout;
- inspect Participants;
- resolve actions as authoritative Actor;
- adjudicate and Undo through existing mechanics authority.

Encounter editing must not be gated merely by an obsolete `preparing` lifecycle. Restrict only operations that are genuinely unsafe in the current authoritative state.

---

# 10. Freeform philosophy and Main Focus

Freeform is the default state and the state users will look at longest.

It must remain deliberately low-noise.

Do not permanently render in Freeform:
- full Scene Actor/Party card wall;
- permanent Initiative order;
- Action/Bonus/Reaction/Movement economy;
- huge spell/item/class/category hotbar;
- permanent Activity/Inspector;
- permanent Encounter editor.

Main Focus may show only meaningful current context such as:
- scene/session identity;
- most recent meaningful outcome;
- current intent/target context if one is active;
- active/reopenable handout affordance when useful;
- small DM empty-Encounter/zero-participant CTA where useful.

Whitespace is intentional. It allows the physical/voice table conversation to remain primary.

---

# 11. Quick Sheet contract

Quick Sheet is the fastest Session-time Character reference.

Desktop:
- right anchored pane;
- target width ~360px; allowed ~320–420px.

Constrained widths:
- full-height drawer.

Open:
- one click Character Identity Chip;
- Sheet rail launcher may open the same surface.

Close:
- close button;
- launcher toggle;
- Escape if top layer.

Closing restores prior Session focus/scroll/action context where still valid.

Quick Sheet reads canonical data only:
- identity/core stats from `activeCharacter`;
- session conditions/status from matching Scene entity;
- legal actions from current actor `ActionVm[]`;
- existing spell/resource projections;
- existing portrait presentation.

First viewport priority:
1. identity;
2. HP / AC;
3. Speed / Initiative / Proficiency / Passive Perception;
4. current conditions/status;
5. key resources;
6. frequent attacks;
7. quick ability/save/skill access.

Further content may include compact spells/features/items.

Rules:
- no duplicate mutable Character copy;
- no arbitrary Quick-Sheet-local HP/resource setters;
- if resource spending belongs to an action, use canonical action flow;
- attacks/spells launch the same authoritative Session action flow;
- disabled actions show a human-readable D&D-domain reason;
- recognized conditions/features/spells may deep-link into in-session Rules.

Connected Session rolls must never silently use local randomness and present it as the authoritative shared outcome.

---

# 12. Full Sheet contract

Standalone and in-session Sheet are two hosts for **one shared Character Sheet content family**.

Target architecture:
- shared Character Sheet controller/content;
- SimpleVTT presentation;
- Official-style presentation;
- standalone Library host;
- Session Full Sheet host.

Reuse:
- existing Character projections/calculations;
- SimpleVTT sheet sections;
- `OfficialCharacterSheetPage`;
- `OfficialSpellcastingSheetPage`;
- existing item commands;
- existing sheet-layout preference.

Do not create a second Session-only Character Sheet.

## Session Full Sheet
Wide desktop:
- large centered workspace overlay over mounted Session Shell;
- target ~88–94% viewport width.

Medium/narrow:
- full workspace overlay with close/back always visible.

Toolbar:
- Character identity;
- `SimpleVTT | 공식 시트 스타일`;
- Rules;
- `시트 닫기`.

Do not use:
- `기기로 플레이`;
- routine route navigation;
- `플레이로 돌아가기`.

Opening Full Sheet preserves when valid:
- Freeform/Initiative;
- current DM Actor;
- current intent/action/targets;
- Main Focus scroll;
- prior utility context.

Full Sheet preserves its own presentation state such as:
- SimpleVTT/Official layout;
- Official Character/Spellcasting page;
- sheet scroll/tab state.

Layout switch is presentation-only over the same Character.

Character Edit/Level Up are not primary Session-time actions; keep them in standalone/explicit advanced flows unless later approved.

---

# 13. Dice and roll presentation

The agreed dice UX is app/body-level cinematic presentation.

Required visual behavior:
- dice originate from visual depth/back behind the screen;
- move/tumble toward the user;
- result is temporary;
- Sheet/Main layout does not reflow or gain a permanent dice stage;
- same visual language is used for standalone and connected authoritative rolls.

Do not use embedded Sheet `VisualDiceTray` / permanent `sheet-roll-result` as the primary presentation.

Authority rules:
- connected action result remains Host/runtime authoritative;
- dice animation may never change the authoritative outcome;
- standalone physical-table Sheet may use local randomness;
- if Session needs an authoritative Sheet roll and no canonical command exists, extend existing mechanics/Resolution authority rather than creating a Sheet-only resolver.

No-roll actions must not force dice animation.

---

# 14. Rules / Activity / utility behavior

## Rules
Rules is a first-class Session tool, not a route detour.

Desktop target:
- right pane ~400–460px.

Behavior:
- search first;
- recent rules;
- results/detail;
- open directly from spells/features/items/conditions/actions where resolvable;
- preserve current action or Sheet context;
- closing returns focus to the triggering control.

Do not stack multiple narrow panes side by side and crush Main Focus. Opening Rules may replace the current utility pane or layer above Full Sheet according to LayerHost priority.

## Activity
Activity is an on-demand drawer with recent human-readable outcomes.

DM may expose Undo where valid through existing ResolutionEvent/Undo authority.

Do not make Activity a permanent feed.

---

# 15. Action Dock state machine

Primary flow:
`Resting -> Intent -> Action Detail -> Target if needed -> Pending -> Resolution`

Canonical sources:
- `OFFICIAL_PLAY_INTENTS` / `intentOptions` for grouping;
- current Actor `ActionVm[]` for legality/details;
- `ActionVm.available` and `disabledReason`;
- `ActionVm.target` / `eligibleTargetIds` / `maxTargets`;
- `resolveAction(actionId, targetIds)` for execution;
- existing `snapshot.resolution` / Activity for outcome.

The Dock must not calculate its own attack bonuses, damage, legality, action economy, resource cost, or target legality.

## Resting Freeform candidates
Keep approximately 4–6 high-frequency/contextual intents plus `모든 행동`.

Default candidates:
- Attack;
- Magic;
- Search;
- Influence;
- Help;
- All Actions.

## Resting Initiative candidates
- Attack;
- Magic;
- Dash;
- Disengage;
- Dodge;
- Help;
- All Actions.

At most 1–2 secondary slots may adapt to useful Character/Actor-specific quick actions.

`모든 행동` exposes the complete official vocabulary:
- Attack;
- Dash;
- Disengage;
- Dodge;
- Help;
- Hide;
- Influence;
- Magic;
- Ready;
- Search;
- Study;
- Utilize.

Do not restore permanent `공통/클래스/주문/아이템/패시브/커스텀` tabs.

Opening Rules/Quick Sheet/Full Sheet during an action flow preserves the action context if the authoritative action remains valid.

Changing DM acting Actor clears only actor-specific interaction state.

Pending state blocks duplicate execution and gives immediate feedback.

---

# 16. Targeting and no-spatial-module rule

V0.9 default SimpleVTT does **not** track continuous tactical distance by default.

Without an installed authoritative spatial/range module:
- otherwise-valid targets are treated as within range;
- missing distance data must never mean `out of range`;
- melee must not be disabled because no 5 ft relation exists;
- ranged actions must not invent distance-based rejection;
- UI must not invent fake distance numbers.

Canonical principle:
- `spatial data 없음 != out of range`
- `spatial data 없음 = unconstrained / in range`

The UI uses canonical `eligibleTargetIds`; it does not implement a second target engine.

If canonical runtime omits otherwise-valid targets solely because spatial facts are absent, fix the canonical eligibility source.

If a real spatial/range module is installed and explicitly supplies authoritative range/reach/LOS/cover facts, those facts may constrain eligibility.

---

# 17. Initiative/combat contract

Initiative is a mode of the same Session Shell, **not** session activation and not a separate combat page.

When Initiative starts, add a compact strip under Session Bar (~64–88px) containing as appropriate:
- round;
- compact Initiative order;
- current-turn emphasis;
- current Actor economy;
- End Turn / Next Turn control.

Main Focus, Sheet, Rules and utility behavior remain part of the same Session Mode.

When Initiative ends, the same shell returns to quiet Freeform.

Do not permanently display Action/Bonus/Reaction/Movement economy in Freeform.

---

# 18. Encounter / Combatant / Actor operation

DM Encounter is an in-session pane/tool, not a separate lifecycle screen.

Desktop target width ~420–520px.

Encounter supports:
- current Combatants;
- add/remove where safe;
- nested Combatant picker/library;
- active session editing;
- Player 0 / Combatant 0 valid empty states.

Combatant Picker is nested into Encounter workflow rather than becoming a permanent global page during Session.

Actor switch is contextual and quick; do not restore a permanent giant Actor wall.

---

# 19. Participants / Session controls

Participants pane uses compact rows:
- participant name;
- Character name when available;
- connected / reconnecting / disconnected.

Do not show Ready checkboxes.

DM Session tool exposes:
- session name/share information;
- address;
- participants;
- end session.

Player Session utility exposes:
- connection state only when useful/actionable;
- reconnect/leave.

Normal healthy handshake/content parity details remain hidden.

---

# 20. Handout contract

Keep existing handout state/transport authority.

DM flow:
- choose validated local image;
- preview;
- explicit reveal;
- explicit withdraw.

Player:
- view active reveal;
- dismiss/minimize;
- reopen while reveal remains active;
- reconnect restores current reveal.

Viewer is a transient LayerHost presentation, not a permanent image-manager screen.

Do not create cloud-hosting dependency, tactical map semantics, or a second image transport.

---

# 21. Interaction quality contract

The interface must optimize repeated table use, not merely screenshots.

One explicit action should begin common operations:
- Player Quick Sheet;
- Player Full Sheet;
- Rules;
- recent result/Activity;
- DM Actor switch;
- Encounter;
- Participants;
- Handout;
- Activity/Undo;
- Session share/settings.

Immediate feedback is required:
- selected;
- target required;
- pending;
- complete;
- disabled reason;
- connection problem.

Do not allow silent clicks.

Critical actions remain visible; do not hide essential controls behind hover-only affordances.

Focus contract:
- opening a pane moves focus into it appropriately;
- closing restores focus to launcher where practical;
- Escape closes only one top layer/interaction step;
- Session end/leave is never triggered by ordinary Escape.

Aim for primary clickable targets around 40–44px or larger where practical.

---

# 22. Responsive contract

`>=1200px`:
- fixed right Utility Rail;
- side panes;
- large Full Sheet workspace overlay.

`900–1199px`:
- panes become more drawer-like;
- Action Dock may use two rows.

`<900px` / constrained Windows viewport:
- rail may become compact/bottom utility strip;
- Quick Sheet/Rules become full-height drawers;
- Full Sheet becomes full workspace overlay;
- Action Dock expansion may become bottom-sheet style.

At all sizes:
- close/back remains inside viewport;
- primary action remains reachable;
- Session state remains mounted;
- no horizontal layout should push essential controls off-screen.

---

# 23. Error / recovery contract

Normal connection health is not a dominant badge.

Only actionable states become prominent:
- reconnecting;
- disconnected;
- save failure;
- incompatible/unsupported content;
- unrecoverable exit decision.

Reconnect is prioritized before leave.

Recovery overlays are blocking only when the user genuinely cannot continue safely.

Do not expose protocol/debug dashboards in routine production flow.

---

# 24. Explicit UI anti-patterns — do not reintroduce

Do not implement as normal Session UI:
- Library sidebar dominating active Play;
- routine `플레이로 돌아가기`;
- Host Preparing primary page;
- Player Lobby / Ready page;
- mandatory `플레이 시작` gate;
- permanent Actor card wall;
- permanent Freeform action economy;
- permanent action category hotbar;
- permanent Inspector/Activity/Handout manager;
- permanent Sheet dice window/frame;
- full-page Rules route round-trip during active Session;
- Full Sheet unmounting Session;
- Rules opening resetting action context;
- exact-distance editor/tactical map/grid/token/LOS as default;
- blocking an action solely because optional spatial data is absent;
- healthy handshake/content parity as a user approval screen.

---

# 25. Existing implementation reuse map

Keep authority / reuse rather than rebuild:
- `src/app/AppProvider.tsx` — snapshot + command boundary;
- existing runtime/network/session/content adapters;
- existing Resolution/Undo authority;
- `src/playerExperienceModel.ts` — intent grouping vocabulary;
- `OfficialCharacterSheetPage`;
- `OfficialSpellcastingSheetPage`;
- SimpleVTT sheet calculations/sections;
- sheet layout preference;
- portrait authority;
- body-level Visual Dice / Combat VFX presentation path;
- handout state/transport.

Refactor presentation:
- `src/App.tsx` remains Library-mode routing only;
- old `ProductionPlayScreen` mechanics/action helpers may be reused but its permanent shell must be replaced;
- Character Sheet route wrappers should be separated from reusable content;
- current Resolution data/commands remain but presentation moves into Session LayerHost as the redesign progresses.

Retire from normal active Session:
- old `scene` route as a peer Library route;
- `플레이로 돌아가기`;
- old permanent Actor rows;
- old category hotbar;
- old lifecycle-based Encounter UI gates;
- embedded Sheet dice tray.

---

# 26. Current implemented checkpoint — do not redo

Exact work-branch HEAD:
`fbf37144d2ed56272429287419393bf221d83f44`

Implemented and validated:
1. `ProductRoot` selects Library `App` only while `session.role === "offline"` and selects `SessionModeRoot` for Host/Client session facts.
2. Persistent Session shell exists with Session Bar, low-noise Main Focus, minimal Utility Rail, LayerHost and Action Dock shell.
3. Player Character identity chip is always visible and opens Quick Sheet in one click.
4. DM current Actor identity chip is always visible and opens Actor Quick View.
5. zero connected Players / zero Combatants are represented as valid active DM state.
6. Quick Sheet reads canonical Character/Scene/Action projections and has no duplicate Character store.
7. active Session root no longer renders dominant Library sidebar / `플레이로 돌아가기` / permanent Actor wall / permanent category hotbar.
8. Quick Sheet has no embedded `VisualDiceTray`.

Validation at this exact HEAD:
- GitHub Actions UI run: `32211000260`
- frontend job: `95943502788`
- conclusion: **SUCCESS**
- new persistent Session-root structure checks passed;
- existing Phase 14 regression checks passed;
- lifecycle/live-DM/local projection/spellcasting regressions passed;
- Phase 09 mechanics regressions passed;
- TypeScript passed;
- production build passed.

Do not rerun or rebuild this historical slice merely because watcher execution restarts unless a later change touches the relevant boundaries.

---

# 27. Remaining implementation order

Continue slice-by-slice. Validate each materially changed slice before expanding scope.

## Slice 4 — Full Sheet in-session host + shared extraction
Next exact implementation target.

Requirements:
- extract/reuse shared SimpleVTT/Official Sheet content;
- open Full Sheet inside Session LayerHost;
- same canonical Character;
- preserve Session context;
- layout switch stays presentation-only;
- remove Session dependency on `기기로 플레이` / route return;
- no embedded dice tray;
- do not create a second Sheet mechanics resolver.

Validate before proceeding.

## Slice 5 — Utility Rail + Rules pane + Activity drawer
- one-click Rules;
- Rules deep-links from Sheet/actions where possible;
- Activity on demand;
- state/focus preservation;
- no permanent feed.

## Slice 6 — Freeform Main Focus convergence
- quiet center;
- remove remaining old HUD assumptions;
- meaningful recent/session context only.

## Slice 7 — intent-first Action Dock
- Resting/Intent/Detail/Pending state;
- official intent vocabulary;
- no old category hotbar.

## Slice 8 — Detail/Target flow + canonical no-spatial fallback
- canonical `eligibleTargetIds`;
- single/multi-target behavior;
- repair runtime eligibility if optional spatial absence still blocks otherwise-valid targets;
- no UI-side second target engine.

## Slice 9 — Cinematic dice/result convergence
- body-level depth-to-user cinematic dice;
- Session Sheet rolls and action resolution share presentation language;
- authoritative result preserved;
- no layout reflow/local dice frame.

## Slice 10 — DM tools
- Encounter;
- Actor switching;
- Participants;
- Session share/settings;
- adjudication/Undo access;
- operation-safety editing rather than `preparing` lifecycle gate.

## Slice 11 — Player session utilities / reconnect
- connection/reconnect/leave;
- no Lobby/Ready return.

## Slice 12 — Initiative expansion
- compact Initiative strip;
- current turn/economy;
- same Session Shell;
- return cleanly to Freeform.

## Slice 13 — Handout integration
- DM reveal/withdraw entry in Session utility;
- Player view/dismiss/reopen;
- reconnect restoration;
- retain existing transport/state authority.

## Slice 14 — responsive / keyboard / focus pass
- desktop/medium/constrained contracts;
- Escape/focus restoration;
- no off-screen close/primary controls.

## Slice 15 — exact-head automated validation
Run the relevant full validation matrix only when source is at the intended acceptance SHA.

## Slice 16 — Windows human usability acceptance
Perform the approved real-use scenarios before calling V0.9 complete.

---

# 28. Human acceptance scenarios

At minimum verify on Windows/product build:

A. Freeform -> one-click Quick Sheet -> close -> exact Session context preserved.

B. Full Sheet -> switch SimpleVTT/Official -> roll/reference -> close -> Session context preserved, no Sheet-local dice frame.

C. Magic/action selection -> open Rules -> close -> same action remains selected if still valid.

D. DM active session with zero Players -> edit Encounter/add Combatant without a Play Start gate.

E. Freeform -> Initiative -> action/turn operation -> end Initiative -> return to quiet Freeform in same shell.

F. Sheet/Rules nested layers -> Escape closes one layer at a time; Session never exits accidentally.

G. disconnect/reconnect -> active session recovers without Lobby/Ready.

H. DM zero-Combatant state remains usable and can prepare within active session.

I. no spatial module -> valid melee/ranged target remains actionable; no fake distance and no `5 ft 내 대상 없음` solely from missing spatial facts.

J. constrained window -> Quick Sheet/Rules/Full Sheet/Action Dock remain operable; close/back/primary actions stay in viewport.

Also verify end-to-end table rhythm:
`대화 -> 주문/규칙 확인 -> 시트 확인 -> 판정 -> 전투 진입 -> 공격 -> DM Encounter 조정 -> 규칙 확인 -> 전투 종료 -> 대화`
without needing to leave the Session Shell.

---

# 29. Validation discipline

For every implementation slice:
1. re-fetch PR/head before source writes;
2. preserve fast-forward/non-force branch discipline;
3. change only the current approved slice;
4. add/update focused regression coverage for the new visible contract;
5. run relevant automation at exact head;
6. fix only observed failures;
7. checkpoint exact source SHA, validation evidence, remaining risks, and next exact action;
8. never claim a broader slice complete based only on historical green CI.

If CI fails, inspect the observed failing check/log and use the repository CI repair workflow; do not guess or refactor unrelated systems.

Never merge PR #109 without explicit user authorization.

---

# 30. Definition of V0.9 UI completion

V0.9 is complete only when one exact source SHA satisfies all of the following:
- active session is a persistent app-level Session Mode;
- DM opens directly into active/editable workspace with no lobby/start gate;
- Player joins an already active session and reconnects to it;
- Player Character Sheet is first-class and immediately accessible;
- Quick Sheet and Full Sheet use one canonical Character;
- SimpleVTT/Official layouts are presentation-only alternatives;
- Rules is available inside Session without route detour;
- Freeform remains low-noise;
- Action Dock is intent-first;
- Initiative expands the same shell;
- target selection respects canonical actions and no-spatial fallback;
- body-level cinematic dice are consistent and do not affect authority;
- DM Encounter/Actor/Participants/Handout/Activity/Undo tools work inside Session;
- responsive/keyboard/focus behavior satisfies the contracts;
- existing Host authority, ResolutionEvent/Undo, reconnect/idempotency, Character durability, installed-content authority and transport behavior remain intact;
- exact-head automated validation is green;
- Windows human acceptance A–J passes.

---

# 31. Next Exact Action

The user has reauthorized sequence 3.

1. Set control to `continue` after PLAN/STATE are durable.
2. Rerun watcher resumes from exact validated source checkpoint `fbf37144d2ed56272429287419393bf221d83f44`.
3. Implement **Slice 4: Full Sheet in-session host + shared Sheet extraction/state preservation** only.
4. Preserve one canonical Character, existing mechanics authority and body-level dice presentation.
5. Validate Slice 4 at its exact head before moving to Rules/Activity.
6. Continue the remaining slices in the approved order unless blocked by an observed technical dependency or a user decision.
7. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
