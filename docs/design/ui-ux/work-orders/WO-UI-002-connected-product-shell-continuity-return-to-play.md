# WO-UI-002 — Connected Product Shell Continuity / Return to Play

Status: **PREPARED — NOT AUTHORIZED FOR RUNTIME IMPLEMENTATION**

Branch context: `agent/108-production-play-session-ux`

Accepted UI reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Prerequisite runtime slice:

```text
WO-UI-001 — CLOSED / ACCEPTED
Human QA: PASS
```

This Work Order prepares the smallest bounded runtime slice that makes the accepted **one Product Shell + dedicated Connected Play workspace** model real without changing Session authority, transport, lifecycle, rules, targeting, or Connected Play mechanics.

It does **not** authorize edits under `src/` yet.

---

# 1. Objective

Implement, after separate scoped dependency authorization and runtime authorization, the connected navigation composition required by the accepted UX:

1. Connected Play remains a dedicated live workspace.
2. Play exposes a compact persistent entry back to the Product Shell.
3. While a **live** connected Session exists, safe Product Shell destinations remain available.
4. Product Shell visibly exposes `Return to Play` while that live Session exists.
5. `Return to Play` restores the same authoritative connected Session rather than opening a second/local Play implementation.
6. Host remains Host/DM and Client remains Client/Player across Product navigation.
7. SessionMode, initiative/current turn, controlled Actor where canonically stored, PendingResolution, connection state, participants, HP/resources/effects, and other authoritative Session state remain untouched by navigation.
8. Product navigation must never call `stopSession`, `hostSession`, `joinSession`, or create a replacement Session merely to change surfaces.
9. App/process restart behavior remains different: restart begins at Home and does not silently restore a prior connected Session.

This slice intentionally stops before any redesign of Connected Play internals.

---

# 2. Accepted behavior scenarios

Primary required scenario from `contracts/BEHAVIOR-SCENARIOS.md`:

- **Scenario 34 — Product navigation during live Host Session**

Required path:

```text
Host/DM live Play
-> open Product Shell
-> Rules (representative safe Product destination)
-> visible Return to Play
-> exact same live Play authority/context
```

Required preserved state:

```text
same session
same connected role
same SessionMode
same current turn
same controlled Actor where authoritative state still makes it valid
same authoritative resolution/game state
```

Adjacent scenarios that must remain green but are not redesigned here:

- Scenario 07 — Host opens Session
- Scenario 08 — Player joins live Session
- Scenario 10 — Connected Freeform baseline
- Scenario 11 — Start Initiative
- Scenario 20 — Resolving action
- Scenario 31 — Rules lookup during live Session
- Scenario 35 — Reconnecting
- Scenario 36 — Disconnected

Do not broaden WO-UI-002 to rewrite those flows.

---

# 3. Required QA rows

Primary rows:

- `QA-NAV-06` — Live Return to Play preserves context
- `QA-SES-09` — Product nav preserves role/session

Identity/composition regressions:

- `QA-NAV-05` — Global Product destination order remains unchanged
- `QA-SES-03` — Host = DM
- `QA-SES-04` — Client = Player
- `QA-PLAY-06` — DM/Player retain the same core Play skeleton
- `QA-CONN-01` — reconnecting preserves orientation where safe
- `QA-CONN-02` — UI does not invent reconnect success

Product invariant regressions:

- `QA-ID-01` — Core remains mapless
- `QA-ID-02` — Actor remains ActorCard/ActorBoard-oriented, not map-token-oriented

Explicitly not owned by this Slice:

- Connected Play Actor Board redesign
- Command Center redesign
- targeting/Main Hand
- resolution selective locking
- DM-only delivery/privacy
- Handout networking
- Host/Join lifecycle redesign

---

# 4. Product/UX dependencies

Direct dependencies:

- `UX-01-02` — one common Product Shell + dedicated Play Workspace
- `UX-01-03` — authoritative/session/game state survives leaving/returning to Play
- `UX-02-01` — Host=DM / Client=Player
- `UX-02-06` — no live DM/Player role switching
- `UX-02-07` — DM/Player share the same core Play workspace grammar
- `UX-03-01` — Product-level destinations stay Home / Characters / Session / Content / Rules / Settings
- `UX-03-02` — dedicated Play retains persistent return path to Product Shell
- `NAV-01-01` — global Product navigation order
- `NAV-01-02` — visible Return to Play while live Session exists
- `NAV-01-04` — supporting Product utilities return to a safe prior context where practical
- `NAV-01-06` — Back / Close / Return remain semantically distinct
- `NAV-01-08` — application restart begins at Home; no automatic prior Play restoration
- `UI-01-01` — Product Shell remains top-navigation based

No new Owner product choice is required for this slice.

## Scoped dependency gate

WO-UI-001 already recorded scoped stability for several overlapping Product Shell dependencies. WO-UI-002 still requires its own explicit bounded dependency authorization before runtime implementation, especially for the newly material dependencies:

```text
UX-01-03
UX-02-01
UX-02-06
UX-02-07
UX-03-02
NAV-01-02
NAV-01-06
NAV-01-08
```

Overlapping WO-UI-001 dependencies may be referenced rather than reinterpreted, but WO-UI-002 must not inherit blanket runtime implementation authorization from WO-UI-001.

---

# 5. Canonical authority boundary

Authoritative Session state remains owned by the existing application/runtime stack.

Important current composition evidence:

```text
<AppProvider>
  <ProductRoot />
  ...bridges...
</AppProvider>
```

`AppProvider` owns `snapshot`, refresh/application operations, and receives external adapter snapshot publications. Therefore ProductRoot may change which **presentation subtree** is mounted without moving Session authority into ProductRoot.

WO-UI-002 rule:

```text
navigation surface state = local UI composition
Session truth = existing AppProvider / runtime adapter snapshot
```

Do not add a second Session store.

Do not persist a fake role or SessionMode in ProductRoot merely to restore Play.

Do not use Product navigation as a disconnect/reconnect operation.

---

# 6. Current implementation evidence and classification

## 6.1 `src/ProductRoot.tsx` — PRIMARY MODIFY

Current behavior:

```text
snapshot.session.role !== "offline"
-> return <SessionModeRoot />

offline
-> return <App />
```

Current problem:

- Product Shell is completely bypassed for every connected role state;
- there is no UI-level concept of switching between the Product Shell and dedicated Connected Play;
- ProductRoot uses connection role as presentation routing rather than keeping connection truth and workspace choice separate.

Required bounded change:

- ProductRoot owns only a local presentation choice such as `product | play`;
- live connected Session becoming available may enter dedicated Play;
- explicit Play -> Product action switches only presentation;
- Product -> Return to Play switches only presentation;
- loss/end of connected live Session returns presentation safely to Product Shell;
- ordinary authoritative snapshot updates while a user is intentionally inspecting Product Shell must not keep forcing them back into Play.

Recommended transition semantics:

```text
no live connected Session
-> Product Shell

new transition into live connected Session
-> Connected Play

Connected Play + Open Product Shell
-> Product Shell, Session remains alive

Product Shell + Return to Play
-> existing Connected Play, same Session

Session ends / becomes offline
-> Product Shell
```

Use actual live-session truth (`session.role` plus canonical lifecycle/state) rather than a second UI-owned invented Session status.

## 6.2 `src/SessionModeRoot.tsx` — MODIFY, PRESENTATION ONLY

Current Play header already owns compact:

- session name;
- Freeform/Initiative state;
- connection warning;
- role controls;
- explicit Session termination for DM.

Missing accepted behavior:

- compact persistent entry from Play back to Product Shell.

Required change:

- accept a bounded presentation callback/contract from ProductRoot;
- expose a clearly named Product Shell return entry in Play chrome;
- invoking it must **not** call `stopSession()`;
- `세션 종료` remains a separate destructive/session action;
- Product Shell return and Session end must remain visually/semantically distinct.

Do not turn Product global navigation into a permanent overlay inside Play. Play stays dedicated; only the compact return entry is persistent.

## 6.3 `src/App.tsx` — MODIFY, BOUNDED CALLBACK ROUTING

Current useful behavior already present:

- global Product navigation;
- detects connected/live Session;
- shows connection/session status;
- already renders visible `플레이로 돌아가기` controls when `liveSession` is true;
- Home receives an `onPlay` callback.

Current problem once Product Shell is allowed during connection:

- Return-to-Play paths currently call `setRoute("scene")`;
- route `scene` mounts `ProductionPlayScreen`, which is **not** the dedicated accepted `SessionModeRoot` Connected Play workspace.

Required change:

- ProductRoot supplies an explicit Return-to-Connected-Play callback when appropriate;
- all connected-live Return-to-Play entry points route through that callback;
- offline/local route behavior may continue to use existing local `scene` route where still applicable;
- connected Product navigation must not accidentally mount the old `ProductionPlayScreen` as a second Connected Play implementation.

Potential affected entry points to reconcile:

- Product Shell global `Return to Play` control;
- topbar `Return to Play` control;
- Home `플레이로 돌아가기`;
- Character Sheet `onScene` path if reached during a connected Client Product Shell context.

Do not broadly rewrite App routing beyond what is required to prevent a duplicate Connected Play path.

## 6.4 `src/V1HomeScreen.tsx` — EXPECT REUSE / NO REQUIRED BEHAVIORAL CHANGE

Current correct connected behavior:

- knows whether Session is connected/live;
- shows `플레이로 돌아가기` when live;
- shows current Session entry.

Its `onPlay` callback should be supplied with the new bounded Return-to-Connected-Play behavior by `App`.

Prefer no direct session authority logic here.

## 6.5 `src/session-mode.css` — MODIFY IF REQUIRED

Add only the bounded styling needed for the compact Product Shell entry in Play chrome.

Constraints:

- preserve current compact session chrome;
- preserve role controls;
- preserve narrow desktop behavior;
- Product return control must remain keyboard reachable;
- do not create a full Product top-nav row inside Play;
- do not hide Session termination/recovery semantics behind the Product return affordance.

## 6.6 `src/app/AppProvider.tsx` — INSPECTED / NO EXPECTED CHANGE

Current Provider sits above ProductRoot and owns the authoritative/application snapshot.

WO-UI-002 must not relocate or duplicate its Session state.

Expected source change: **none**.

## 6.7 Session/network/runtime adapters — PRESERVE

No expected changes to:

```text
connectedSessionRuntimeAdapter
productionSessionLifecycleAdapter
directNetworkSessionRuntimeAdapter
connectedProjectionLifecycleAdapter
connectedRoleRoutingAdapter
connectedActionRoutingAdapter
connectedTurnRoutingAdapter
session transport/wire
```

Navigation continuity must be implemented without changing transport or authority semantics.

---

# 7. Authoritative / owning state sources

| State | Owner | WO-UI-002 behavior |
| --- | --- | --- |
| connected role | existing `snapshot.session.role` | read only; never locally rewrite |
| Session lifecycle/live truth | existing Session snapshot/runtime | read only for composition |
| SessionMode | host-authoritative runtime snapshot | preserve |
| initiative/round/current turn | host-authoritative runtime snapshot | preserve |
| controlled DM Actor | existing canonical/session selected Actor state | preserve where still valid |
| Player Character | existing active Character / connected projection | preserve |
| PendingResolution | existing runtime snapshot | preserve; navigation does not commit/cancel it |
| connection/reconnect truth | transport/runtime snapshot | preserve |
| Product destination | Product Shell local route state | presentation only |
| Product-vs-Play mounted surface | ProductRoot local presentation state | presentation only; not Session authority |
| application restart behavior | existing process/session lifecycle contract | do not persist root surface across restart |

---

# 8. Important semantic distinction

The following actions must remain different:

```text
Open Product Shell
Return to Play
End/Leave Session
Close contextual Play utility
Application exit
```

### Open Product Shell

Presentation navigation only. No Session mutation.

### Return to Play

Presentation navigation only. Reuses exact live Session.

### End/Leave Session

Calls the real Session lifecycle operation and may clean SessionRuntime according to canonical contract.

### Close contextual Play utility

Stays inside Play and restores its launcher/context.

### Application exit

Disconnect behavior follows `NAV-01-08`; next launch begins at Home.

Do not overload one control to perform multiple meanings.

---

# 9. Local Play presentation state when leaving Play

Accepted contract guarantees preservation of authoritative/session/game state.

The following SessionModeRoot-local presentation state is not itself authoritative:

- currently open L2 utility pane;
- transient tooltip/context menu;
- local focus location;
- temporary Full Sheet presentation layer;
- local Handout dismiss/zoom presentation where separately owned.

WO-UI-002 must not invent persistence for these states merely to satisfy navigation continuity.

If the implementation unmounts SessionModeRoot while Product Shell is open, such ephemeral UI may reset **only where existing contracts permit a safe reset**.

Must preserve regardless of remount:

```text
Session identity
role
SessionMode
initiative/current turn
controlled Actor when stored authoritatively
HP/resources/effects
PendingResolution authoritative state
connection state
participants
committed history
```

If implementation discovers that an apparently local presentation state is actually required to survive by another canonical contract, STOP and amend the Work Order rather than guessing.

---

# 10. Test inventory and reconciliation

## `tests/ui/v1ProductShellStructure.test.ts` — MODIFY; ONE ASSERTION IS NOW STALE

Current stale expectation:

```text
connected session -> ProductRoot always returns SessionModeRoot
```

That assertion was correct only before accepted Product Shell continuity was implemented.

Replace it with assertions that:

- AppProvider remains above ProductRoot;
- ProductRoot can compose both App and SessionModeRoot for a live connected Session;
- ProductRoot owns only local workspace/surface choice;
- Return/Open Product callbacks exist;
- navigation does not call session lifecycle creation/destruction operations.

Preserve unrelated WO-UI-001 assertions.

## New `tests/ui/connectedProductShellContinuity.test.ts` — ADD

Required structural/runtime-contract coverage:

1. ProductRoot distinguishes live connected authority truth from local product/play presentation choice.
2. entering a new live connected Session can enter Play.
3. opening Product Shell does not stop/end Session.
4. Product Shell renders a visible Return to Play while live.
5. Return to Play selects `SessionModeRoot`, not `ProductionPlayScreen`.
6. SessionModeRoot exposes a compact Product Shell entry.
7. Product entry is distinct from DM `세션 종료` and Player connection/leave controls.
8. no new Session authority store is created in ProductRoot.
9. AppProvider remains the authoritative snapshot owner above ProductRoot.
10. root presentation state is not persisted across application restart.

Prefer source-structure assertions plus existing adapter regressions rather than inventing a fake second Session runtime solely for this test.

## `tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts` — PRESERVE / MINIMAL EXTENSION IF NEEDED

If the new Play chrome entry changes responsive/focus structure, add only assertions for:

- keyboard reachability;
- constrained desktop visibility/reflow;
- no collision with role/session termination controls.

Do not redesign the entire responsive Session shell in this Slice.

## `tests/ui/productionNonCharacterUxRedesign.test.ts` — PRESERVE

Role mapping and primary-path jargon regressions remain useful.

Change only if a source-composition assertion becomes directly stale because of WO-UI-002.

## `tests/ui/productionSessionLifecycleAdapter.test.ts` — PRESERVE

This is authority/lifecycle regression evidence. Product navigation must not require changes to Host/client transport/session semantics.

Historical lifecycle assumptions inside that test are not justification to expand WO-UI-002 into a lifecycle redesign.

## Existing Session/Play regression suites — PRESERVE

Especially keep green:

- Session full/quick Sheet workspace structure;
- Session utility panes;
- Session action dock;
- Session DM tools;
- Session reconnect/recovery;
- Initiative expansion;
- Handout integration;
- production Session UX;
- connected lifecycle and authority tests;
- TypeScript / production build.

---

# 11. Expected implementation file scope

## Expected IN SCOPE

```text
src/ProductRoot.tsx
src/App.tsx
src/SessionModeRoot.tsx
src/session-mode.css                     # only bounded Play-chrome return styling

tests/ui/v1ProductShellStructure.test.ts
tests/ui/connectedProductShellContinuity.test.ts
.github/workflows/ui.yml                 # add new test to existing relevant UI gate
```

Conditional/minimal only if directly required:

```text
tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts
src/v1-product-shell.css                 # only if existing Return-to-Play presentation needs bounded correction
```

Expected **NO CHANGE**:

```text
src/app/AppProvider.tsx
src/V1HomeScreen.tsx                     # callback reuse should normally be enough
```

## OUT OF SCOPE

```text
Connected Play topology redesign
Actor Boards
Command Center
Hotbar taxonomy
targeting
Main Hand canonical relation
resolution selective locking
DM-only delivery/privacy
Handout network contract
Session authority/transport/wire
Host/Join lifecycle semantics
Lobby/Ready removal
reconnect protocol changes
content snapshot semantics
Character creation/Level Up rules
map/spatial modules
```

---

# 12. Must Not Change

- Host=DM / Client=Player authority mapping;
- actual Session identity or connection because the user opens Product Shell;
- SessionMode because the user opens Product Shell;
- current turn/initiative because the user opens Product Shell;
- HP/resources/effects/committed history because of navigation;
- connected target/action legality;
- mapless Core boundary;
- Character ownership/write-back semantics;
- application restart = disconnect/Home behavior;
- existing explicit Session end/leave semantics.

Never implement `Return to Play` as:

```text
hostSession()
joinSession(...)
set fake role
set fake SessionMode
mount ProductionPlayScreen for connected play
reload page
reconnect transport without need
```

---

# 13. Current open broad Gaps

Existing broad technical gaps remain:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

They do **not** block WO-UI-002 because this Slice changes only presentation composition/navigation and must not implement those behaviors.

Slice material Domain/Architecture blocker:

```text
NONE IDENTIFIED
```

If implementation requires changing session persistence/reconnect semantics, this conclusion becomes invalid and work must STOP for Architecture review.

---

# 14. Verification plan after runtime authorization

Targeted contract tests:

```text
npx tsx --test \
  tests/ui/connectedProductShellContinuity.test.ts \
  tests/ui/v1ProductShellStructure.test.ts \
  tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts
```

Authority/lifecycle regressions:

```text
npx tsx --test \
  tests/ui/productionSessionLifecycleAdapter.test.ts \
  tests/ui/connectedSessionRuntimeAdapter.test.ts \
  tests/ui/productionSessionWorkspaceRedesign.test.ts
```

Then run the repository UI workflow and production build gate.

Required CI evidence:

- new continuity tests green;
- existing Product Shell tests green;
- existing Session/Play regressions green;
- connected lifecycle/role regressions green;
- named-rule boundary green;
- TypeScript green;
- production build green.

---

# 15. Human QA after automated verification

Minimum manual path:

## Host

```text
open/live Host Session
-> verify Host/DM Play
-> open Product Shell
-> open Rules or Settings
-> verify visible Return to Play
-> Return to Play
```

Confirm:

- still same Session;
- still Host/DM;
- same Freeform/Initiative mode;
- current turn unchanged if Initiative;
- DM controlled Actor unchanged where valid;
- no reconnect/new Session action occurred.

## Player

```text
join live Session as Client/Player
-> open Product Shell
-> Return to Play
```

Confirm:

- still Client/Player;
- same selected Character/session projection;
- no role conversion;
- no duplicate Join;
- connection remains alive.

## Process restart distinction

Close/relaunch remains governed by `NAV-01-08`: later launch starts at Home and does not silently restore the prior live workspace.

---

# 16. Stop conditions

STOP implementation and reopen planning if any of the following becomes necessary:

1. ProductRoot must own or duplicate authoritative Session state.
2. Return to Play requires a new Host/Join/reconnect operation.
3. navigation requires modifying transport/wire schema.
4. navigation requires changing Host/Client role authority.
5. navigation requires changing Session lifecycle semantics.
6. Product Shell inspection would expose unauthorized role/private data needing a new privacy contract.
7. PendingResolution cannot survive presentation switching without domain/application changes.
8. the implementation starts redesigning Connected Play, Actor Boards, or Command Center to make navigation work.
9. a broad technical Gap above becomes material to this Slice.

---

# 17. Preparation result

```text
WO-UI-001 HUMAN QA: PASS / CLOSED
WO-UI-002 SOURCE INSPECTION: COMPLETE
WO-UI-002 TEST INSPECTION: COMPLETE
WO-UI-002 DOMAIN/ARCHITECTURE BLOCKER: NONE IDENTIFIED
WO-UI-002 WORK ORDER: PREPARED
WO-UI-002 SCOPED DEPENDENCY AUTHORIZATION: NOT YET RECORDED
WO-UI-002 RUNTIME IMPLEMENTATION AUTHORIZATION: NOT GRANTED
WO-UI-002 SRC IMPLEMENTATION: NOT STARTED
```

Next gate:

```text
WO-UI-002 scoped dependency authorization
```
