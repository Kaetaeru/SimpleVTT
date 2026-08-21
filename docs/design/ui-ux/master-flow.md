# SimpleVTT Master User Flow

Status: **Derived owner view — synchronized to integrated mapless baseline**

This is a readable projection of canonical Domain contracts + `decisions.md` + `INTEGRATED-PRODUCT-UX-PLAN.md`.

It is not an independent decision store.

If this file conflicts with Domain/Architecture truth, `decisions.md`, or the integrated plan, repair this file.

---

# 0. Derived flow rules

- Standalone Character and Connected Session are parallel first-class product paths. (`UX-01-01`)
- SimpleVTT Core is mapless. (`docs/design/README.md`, `docs/design/movement-modules.md`)
- `Scene/Table/Stage` means mapless play context/presentation space, never automatic battlemap semantics.
- First run shows a dedicated Tutorial/Onboarding panel before normal Home interaction. (`NAV-01-07`)
- Initial Official-style vs SimpleVTT Sheet presentation is selected in that Tutorial. (`UI-01-07`)
- Home exposes distinct Host Session and Join Session paths. (`ORIGIN-FLOW-01`)
- Join includes Character Select; no valid Character blocks Join with Create/Import recovery. (`ORIGIN-FLOW-02`, `SES-01-04`)
- Host opens directly into an already-live Freeform session; no Lobby/Ready/Start gate. (`SES-01-02`, `SES-01-05`)
- Freeform and Initiative are states of the same Play Workspace.
- Connected Host = DM; Connected Client = Player; Offline has no DM/Player role. (`UX-02`)
- Current code/tests/history are evidence only.

---

# 1. Product start / first run

```text
APP START
   |
   v
Bootstrap / hydrate local product state
   |
   +--> first-use tutorial incomplete?
   |        |
   |        YES
   |        |
   |        v
   |   TUTORIAL / ONBOARDING WINDOW
   |        |
   |        +--> Standalone vs Connected explanation
   |        +--> choose Official-style / SimpleVTT Sheet
   |        +--> Character / Host / Join orientation
   |        +--> Content / Rules secondary orientation
   |        |
   |        `--> Complete
   |                |
   |                v
   `-------------> HOME
```

Returning launch starts Home after normal boot.

Closing the app ends the current connection context; relaunch does not silently restore live Play. (`NAV-01-08`)

Tutorial can be reopened later from Settings/Help.

---

# 2. Home / Product Shell

```text
HOME
  |
  +--> New Character ------> Character Create
  +--> Characters ---------> Character Library
  +--> Host Session -------> Host Setup
  +--> Join Session -------> Join Setup
  +--> Content ------------> Content / Add-ons
  +--> Rules --------------> Rules Browser
  `--> Settings -----------> Settings
```

Top-level navigation order:

```text
Home | Characters | Session | Content | Rules | Settings
```

When the running app still owns a live Session context, Product Shell destinations expose `Return to Play`.

---

# 3. Character path

```text
HOME / Characters
      |
      v
Character Library
      |
      +--> Create -------> canonical Character Create flow
      +--> Import -------> canonical import flow
      +--> Saved --------> Character Sheet
      `--> Draft --------> canonical Create/Edit flow
```

Character Create/Edit/Level Up uses the existing accepted canonical authoring model; broad UI redesign does not invent a replacement rules wizard. (`UI-01-08` + Character contracts)

## Character Sheet

```text
Character Sheet
  |
  +--> switch Official-style / SimpleVTT presentation
  +--> Edit ----------------> canonical Edit flow ------> Sheet
  +--> Level Up ------------> canonical Level Up -------> Sheet
  +--> Session -------------> Session entry
  `--> Roll
        |
        v
   transient cinematic dice over/within SAME SHEET
        |
        v
   compact result / optional local history
        |
        v
   SAME SHEET remains mounted
```

There is no routine Standalone `Sheet -> Resolution page/window -> Sheet` navigation.

---

# 4. Host Session — immediate live

```text
HOME / Session
      |
      v
Host Setup
  - Session name
  - real connection/listen information as applicable
      |
      +--> validation/open failure -> stay + recovery
      |
      `--> Open Session
              |
              v
       LIVE HOST / DM FREEFORM
              |
              +--> DM may play immediately
              +--> DM may edit Encounter / Combatants
              +--> DM may use Handout / Session utilities
              +--> DM may start Initiative
              `--> Players may join at any time
```

No normal:

- Host Preparing waiting screen;
- Player Ready dependency;
- Start Session gate.

Player count zero is valid.

Session content snapshot is captured at open and remains stable for that live session. (`CONTENT-02-11`)

---

# 5. Join Session — current live state

```text
HOME / Session
      |
      v
Join Setup
  - real Host address/connection info
  - local Character Select
      |
      +--> no valid Character
      |        |
      |        +--> Create Character
      |        `--> Import Character
      |                 |
      |                 `--> return / retry Join
      |
      v
Connect / content + Character sync as needed
      |
      +--> recoverable failure -> explicit retry/recovery
      |
      v
JOIN LIVE SESSION
      |
      v
CLIENT / PLAYER enters CURRENT Freeform or Initiative state
```

No Player Lobby/Ready stage.

---

# 6. Connected Play — MAPLESS core topology

```text
+-------------------------------------------------------+
| Compact Play chrome / Session status                  |
+-------------------------------------------------------+
| NPC / Neutral / Hostile Actor Board                   |
+-------------------------------------------------------+
| Initiative Tracker overlays top edge only when active |
|                                                       |
|       MAPLESS PLAY CONTEXT / TABLETOP STAGE           |
|                                                       |
|  current interaction / target summary                 |
|  PendingResolution / Reaction / Concentration         |
|  cinematic dice / immediate result / NOTICE           |
|  Handout presentation when applicable                 |
|                                                       |
|  NO map grid / Actor coordinates / map tokens          |
+-------------------------------------------------------+
| Player / Allied Actor Board                           |
+-------------------------------------------------------+
| compact economy/resources when applicable             |
| Controlled Actor | persistent Hotbar / context action |
+-------------------------------------------------------+
```

Actor Boards and Command Center are current Reviewed product structure.

The central stage is breathing/focus/presentation space, not tactical terrain.

---

# 7. Freeform / Initiative

```text
LIVE FREEFORM
    |
    | DM starts Initiative
    v
LIVE INITIATIVE
    |
    | Initiative ends
    v
LIVE FREEFORM
```

## Freeform

- same Actor Boards / mapless context / Command Center;
- no round/current-turn banner;
- no fake per-turn Action/Bonus/Reaction/Movement spend state;
- capabilities/resources may still show truthful cost/state.

## Initiative

Adds:

- round/current turn;
- compact top-edge Initiative Tracker;
- authoritative Action/Bonus/Reaction/Movement economy;
- End Turn where meaningful.

Does **not** remove Actor Boards or replace the whole Play IA.

---

# 8. Capability / targeting / resolution loop

```text
PLAY.NORMAL
   |
   | select visible capability
   v
PLAY.ACTION_SELECTED
   |
   +--> no target/self --> authoritative resolution
   |
   `--> target required
          |
          v
   ACTOR-CARD TARGETING
          |
          +--> invalid -> stay + authoritative reason
          |
          +--> single valid -> submit immediately
          |
          `--> multi -> select Actor set -> Execute
                                    |
                                    v
                           authoritative resolution
                                    |
             +----------------------+------------------+
             |                                         |
             v                                         v
        direct resolution                    Reaction / Interrupt /
                                             Concentration response
             |                                         |
             +----------------------+------------------+
                                    |
                                    v
                        physical dice presentation
                                    |
                                    v
                         scene-integrated result
                                    |
                                    v
                      canonical projection updates
                                    |
                                    v
                                  PLAY
```

Mapless targeting invariants:

- no map-position click targeting;
- no AoE map template required;
- area-like actions use manual target set/checklist;
- UI does not compute target legality from visual position;
- no smart Main Hand fallback.

---

# 9. DM contextual tools

```text
PLAY
 |
 +--> Encounter / Combatants ---- pane
 +--> Participants -------------- pane
 +--> Session Share/Settings ---- pane
 +--> Activity / Correction ----- pane
 +--> Rules Lookup -------------- pane
 +--> Handout Control ----------- pane/layer
 +--> Acting Actor / Control ---- contextual control
 `--> Advanced Spatial Facts --- pane
```

Advanced spatial facts are form/list based:

```text
Actor A
Actor B
Distance
Visibility
Cover
other authoritative/manual fact when supported
```

No coordinate/map editor.

---

# 10. Handout

```text
DM Reveal
   |
   +--> Overlay
   |      `--> Player local dismiss/reopen allowed
   |
   +--> Upper presentation
   |      `--> shared DM-controlled mode
   |
   `--> Full presentation
          `--> shared DM-controlled mode
```

Handout is image presentation, not tactical terrain.

No token/grid interaction is added to it.

Exact shared network/reconnect state remains `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 11. Activity / privacy / correction

```text
Authoritative event
   |
   +--> Public projection --------> DM + Player Activity as authorized
   |
   `--> DM Only ------------------> DM only
                                   Player receives NO placeholder/existence marker
```

Later disclosure may project authorized detail/result without rerolling.

Correction/reversal appends a linked event; original history remains.

Runtime privacy projection remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 12. Content / Rules

## Content

```text
Content
  |
  +--> Installed package detail
  |       +--> Update
  |       +--> Replace
  |       +--> Disable / Enable
  |       `--> Delete
  |
  `--> Add supported SimpleVTT package
          |
          v
        Preview
          |
          v
  validation: valid / warning / blocker / unsupported
          |
          `--> explicit install when allowed
```

Live Session snapshot does not change from local library mutation.

## Rules

Rules browse/search uses the composed authoritative catalog.

During live Play, quick Rules lookup may open contextually without abandoning Session context.

---

# 13. Connection recovery / exit

```text
LIVE PLAY
   |
   | transient connection loss
   v
RECONNECTING
   |
   +--> recovered ----> same authoritative live context
   `--> unrecoverable -> explicit retry / leave
```

```text
Player Leave ------> Product Shell
Host End Session --> explicit destructive confirmation where required --> live context ends
```

App process close is different: relaunch starts Home.

---

# 14. Remaining technical/reconciliation work

Owner material checkpoints are complete. Remaining blockers are technical/document work:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION`

Detailed layout/copy/component/accessibility/motion choices inside these boundaries are AI-managed unless Owner Control escalation is triggered.
