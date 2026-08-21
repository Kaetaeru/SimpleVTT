# SimpleVTT Master User Flow

Status: **Draft derived owner view — not a canonical decision store**

This file is the owner-friendly product flow map. It summarizes made decisions, declared review structure, known gaps, and relevant canonical domain/design constraints into one readable topology view.

**Normative product behavior does not live here.** When this file conflicts with `decisions.md`, `review-plan.md`, `planning-gaps.md`, or an applicable canonical domain/architecture contract, repair this derived view instead of treating it as a second source of truth.

Canonical decisions: [`decisions.md`](decisions.md)
Undecided review structure: [`review-plan.md`](review-plan.md)
Known material gaps: [`planning-gaps.md`](planning-gaps.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Derived-view rules

- The owner may still discuss/change flow naturally through this view.
- AI translates any material flow change into the appropriate Decision Card, Decision Map item, Planning Gap, or responsible domain/architecture contract first, then refreshes this file.
- Do not Freeze this file. Freeze the applicable canonical decisions/contracts that produce it.
- Detailed state machines belong in M2 when needed.
- This map shows product flow, not final button placement.

## Flow rules currently projected from planning

- Character use and Session use are parallel first-class product paths. (`UX-01-01`)
- Home exposes direct first-class Host Session and Join Session entry paths; Character is not a universal prerequisite to Session. (`ORIGIN-FLOW-01`)
- Player Join includes Character Select as a flow-specific step. (`ORIGIN-FLOW-02`)
- If no valid Character exists, Join is blocked with Create/Import recovery actions before retry. (`SES-01-04`)
- Hosting does not create a waiting/readiness lobby. Opening a session immediately creates the live Play context; Players may join it later. (`SES-01-02`, `SES-01-05`)
- A live session provides a persistent return-to-Play continuity path from the Product Shell. (`UX-01-03`, `NAV-01-02`)
- Closing/relaunching the app begins at Home rather than auto-restoring Play. (`NAV-01-08`)
- Freeform and Initiative are modes of the same Play Workspace, not separate applications. (`docs/design/README.md`, `docs/design/session-runtime.md`)
- The content configuration captured when a session opens remains fixed for that live session. (`CONTENT-02-11`)

---

# 1. Product entry

```text
APP START
    |
    v
Bootstrap local product state
    |
    v
HOME
    |
    +--> New Character ------> Character Builder
    |
    +--> My Characters ------> Character Library
    |
    +--> Host Session -------> Host Setup
    |
    +--> Join Session -------> Join Setup
    |
    +--> Content ------------> Content / Add-ons
    |
    +--> Rules --------------> Rules Browser
    |
    +--> Settings -----------> Settings
    |
    `--> Return to Play -----> Play Workspace   [when live session exists in the running app]
```

Direct Host/Join entry is projected from `ORIGIN-FLOW-01`. `Return to Play` is contextual continuity, not a separate permanent product destination. A fresh app launch starts at Home according to `NAV-01-08`.

---

# 2. Character path

```text
HOME
  |
  +--> New Character
  |      |
  |      v
  |   Character Builder
  |      |
  |      +--> Guided / Quick / Import / Edit modes as applicable
  |      |
  |      v
  |   Creation Review
  |      |
  |      v
  |   Character Sheet
  |
  `--> My Characters
         |
         v
      Character Library
         |
         +--> Saved Character ----> Character Sheet
         |
         +--> Draft --------------> Character Builder
         `--> Import -------------> Character Builder (Import mode)
```

## Character Sheet branches

```text
Character Sheet
   |
   +--> Standalone play / roll --> Resolution / Dice --> Character Sheet
   |
   +--> Edit --------------------> Character Builder ----> Character Sheet
   |
   +--> Level Up ----------------> Level Up Flow --------> Character Sheet
   |
   `--> Session -----------------> Session path
```

Character Sheet is a first-class standalone tabletop surface, not merely a setup step for VTT Play. The product supports both Official-style and SimpleVTT-optimized sheet layouts (`UI-01-07`). Existing Character Builder and Level Up UX remain the accepted baseline (`UI-01-08`).

---

# 3. Direct Host path — immediate live session

Projected from `ORIGIN-FLOW-01`, `SES-01-02`, and `SES-01-05`.

```text
HOME / Session entry
       |
       v
    Host Setup
       |
       +--> validation failure --> remain in Host Setup + explicit recovery
       |
       `--> Open Session
                |
                v
          LIVE FREEFORM PLAY
                |
                +--> DM may play immediately
                +--> DM may edit/prepare inside the same live session
                `--> Players may join later at any time
```

There is **no separate Host Lobby / Ready / Start Session gate**. Opening the hosted session is the transition into the live session. Session content is snapshotted at this transition according to `CONTENT-02-11`.

---

# 4. Direct Join path — join an already-live session

Direct Join entry is projected from `ORIGIN-FLOW-01`; Character Select from `ORIGIN-FLOW-02`; the no-Character branch from `SES-01-04`.

```text
HOME / Session entry
       |
       v
    Join Setup
       |
       +--> connection/validation failure --> remain/recover explicitly
       |
       v
 Character Select
       |
       +--> no valid Character
       |       |
       |       +--> Create Character
       |       `--> Import Character
       |               |
       |               `--> return to product context; retry Join
       |
       v
 Connecting / Handshake
       |
       +--> recoverable connection loss --> reconnect/retry path
       |
       v
   JOIN LIVE SESSION
       |
       v
   FREEFORM / CURRENT LIVE MODE
```

There is **no separate Player Lobby/Ready stage** in v1. Late join is a normal path into an already-live session (`SES-01-05`).

---

# 5. Play Workspace

See `UX-01-07`, `UI-01`, and the migrated Play decisions in `decisions.md`.

## Freeform baseline

```text
+---------------------------------------------------+
| NPC / Neutral / Hostile Actor Board              |
+---------------------------------------------------+
| Initiative strip overlays top edge when active   |
|                                                   |
|                Scene / Table Context              |
|                                                   |
+---------------------------------------------------+
| Player / Allied Actor Board                       |
+---------------------------------------------------+
| Action-economy / resource strip                   |
| Actor status      | Action / Hotbar controls      |
+---------------------------------------------------+
```

This visualization is derived from `UX-01-07`, `UI-01-03`, `UI-01-04`, `UI-01-05`, `ORIGIN-UX-01-09`, `ORIGIN-UX-01-10`, and `ORIGIN-UX-01-11`.

Contextual Session/DM utilities open in side panes (`UI-01-06`). Important operational state may also be summarized in persistent NOTICE UI (`INT-01-07`).

## Initiative transition

```text
FREEFORM PLAY
     |
     | Start Initiative
     v
INITIATIVE PLAY
     |
     | End Initiative
     v
FREEFORM PLAY
```

Actor Boards remain and the compact top Initiative Tracker is added according to `ORIGIN-UX-01-14`, `ORIGIN-UX-01-15`, and `UI-01-04`. Authoritative mode semantics remain governed by `docs/design/session-runtime.md`.

---

# 6. Action / targeting / resolution loop

This is a derived conceptual flow. Exact guards/rollback belong in M2 and authoritative action/resolution semantics remain domain/application owned.

```text
PLAY.NORMAL
   |
   | select capability
   v
PLAY.ACTION_SELECTED
   |
   +--> no target / self target ------> authoritative resolution
   |
   `--> target required
            |
            v
       PLAY.TARGETING
            |
            +--> invalid target --> remain targeting + authoritative reason
            |
            +--> valid single target --> execute immediately
            |
            `--> multi target --> select set --> explicit Execute
                                      |
                                      v
                         authoritative resolution
                                      |
                                      +--> interrupt required
                                      |       |
                                      |       v
                                      |   Reaction / Interrupt
                                      |       |
                                      |       `--> response
                                      |
                                      v
                               Dice presentation
                                      |
                                      v
                                  Result
                                      |
                                      v
                        canonical state projection updates
                                      |
                                      v
                                    PLAY
```

Projected invariants:

- UI does not compute target legality. (`ORIGIN-UX-01-19`)
- Single-target valid click executes without an extra confirmation. (`ORIGIN-UX-01-20`)
- Multi-target requires explicit Execute. (`ORIGIN-UX-01-20`)
- Resolution does not globally disable the entire Command Center. (`ORIGIN-UX-01-21`)
- Physical dice presentation never determines gameplay result. (`ORIGIN-UX-01-24`, `ORIGIN-UX-01-25`)
- DM correction/reversal never deletes committed history. (`DM-02-05`, `docs/design/session-runtime.md`)

---

# 7. DM contextual Play flow

Reviewed placement principles plus remaining AI-managed detail:

```text
                         PLAY
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
 Actor Context         Encounter          Handout
       |                  |                  |
       |             Advanced DM tool       |
       |          distance/visibility/cover |
       +------------------+------------------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
             Activity         Adjudication
                 |                 |
                 +--------+--------+
                          |
                          v
                    same PLAY context
```

These tools remain contextual rather than global destinations (`NAV-01-05`) and use side panes where applicable (`UI-01-06`). Manual spatial-relation editing is an advanced DM tool (`DM-01-03`), not a default always-visible Play control.

DM Activity keeps one chronology with public/private marks and filtering (`DM-02-01`). DM-only records remain non-delivered to Players until explicit authorized disclosure.

---

# 8. Handout presentation branch

Derived from `ORIGIN-UX-01-12` and `ORIGIN-UX-01-13`:

```text
DM chooses presentation
        |
        +--> Overlay ------> Actor Boards remain; local Player minimize/close/reopen allowed
        |
        +--> Upper Scene --> upper scene presentation replaces upper area; Player cannot locally dismiss
        |
        `--> Full Scene ---> full scene presentation replaces relevant scene/boards; Command Center remains; Player cannot locally dismiss
```

Exact shared session/network projection remains blocked by `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 9. Content / add-on flow

v1 accepts one official SimpleVTT package format (`CONTENT-02-04`). Exact validation/dependency contracts remain internal/domain work.

```text
Content
  |
  +--> Installed Content detail
  |       |
  |       +--> Update
  |       +--> Replace
  |       +--> Disable / Enable
  |       `--> Delete / Remove
  |
  `--> Add Content
          |
          v
   SimpleVTT package file
          |
          v
        Preview
          |
          v
      Validation
       /      \
      /        \
 blocker      valid
   |            |
   v            v
recover      Install
                |
                v
          Install Result
                |
                v
             Content
```

Live-session rule (`CONTENT-02-11`):

```text
OPEN SESSION
    |
    `--> capture content configuration snapshot
              |
              v
         LIVE SESSION
              |
              +--> library install/update/replace/disable/delete may be prepared
              `--> current live-session snapshot does NOT change
```

Changes apply to later sessions, not the current live session.

---

# 10. Rules flow

Detailed Rules Browser presentation is AI-managed within the declared CONTENT-02 coverage and existing canonical rules/content contracts.

```text
Rules Browser
    |
    +--> Search / Filter
    |
    +--> Rule Detail
    |       |
    |       `--> Related Rule / Source
    |
    `--> return to previous Rules context
```

---

# 11. Connection recovery

```text
LIVE SESSION / PLAY
       |
       | transient connection lost while app remains active
       v
RECONNECTING
       |
       +--> recovered ------> restore same canonical live-session context
       |
       `--> unrecoverable --> explicit recovery / leave flow
```

Reconnect preserves authoritative/session/game state according to `UX-01-03` and `docs/design/session-runtime.md`. **App process close/relaunch is different:** the relaunched app starts at Home (`NAV-01-08`), from which the user may explicitly rejoin.

---

# 12. Exit / session-end concept

```text
PLAY / SESSION
    |
    +--> Player leaves ------> explicit leave flow ------> Product Shell
    |
    `--> Host ends session --> explicit destructive flow -> all participants leave live context
```

Exact confirmation language and low-level cleanup remain AI-managed/domain-contract detail within the existing authority model.

---

# 13. Remaining non-owner contract work

Owner material checkpoints are complete. Remaining material blockers are technical/domain or document-reconciliation work rather than preference questions:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION`

Detailed typography, component state, responsive reflow, accessibility, copy, motion, and similar low-risk rows are resolved through AI Design Defaults/contracts under `OWNER-CONTROL-POLICY.md`. They are not owner homework unless the escalation rule is triggered.
