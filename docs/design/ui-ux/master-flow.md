# SimpleVTT Master User Flow

Status: **Draft planning baseline — not Frozen**

This file is the owner-friendly product flow map. It describes first-class entry paths and major workspace transitions. Detailed state machines belong in M2 when needed.

Canonical decisions: [`decisions.md`](decisions.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Flow rules

- Character use and Session use are parallel first-class product paths.
- A user may go directly from Home to Host or Join without first visiting Character Library.
- A live session provides a persistent return-to-Play continuity path from the Product Shell.
- Freeform and Initiative are modes of the same Play Workspace, not separate applications.
- DM contextual tools return to the same Play context unless a later Frozen decision explicitly promotes one to a standalone destination.
- This map shows product flow, not final button placement.

---

# 1. Product entry

```text
APP START
    |
    v
Bootstrap / Restore known state
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
    `--> Return to Play -----> Play Workspace   [when live session exists]
```

`Return to Play` is contextual continuity, not a separate product destination.

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

Character Sheet is a first-class standalone tabletop surface, not merely a setup step for VTT Play. See `UX-01-01`.

---

# 3. Direct Host path

```text
HOME / Session entry
       |
       v
    Host Setup
       |
       +--> validation failure --> remain in Host Setup + explicit recovery
       |
       v
 Host Lobby / Preparation
       |
       +--> participants / encounter preparation / session controls
       |
       +--> not ready -----------> remain in Lobby
       |
       `--> Start Session
                |
                v
          FREEFORM PLAY
```

The Host path is independent of the Character path unless a future explicit product decision adds a Character-related requirement for a specific host mode.

---

# 4. Direct Join path

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
       +--> no valid Character --> PLANNING GAP (do not invent fallback)
       |
       v
 Connecting / Handshake
       |
       +--> recoverable connection loss --> reconnect/retry path
       |
       v
 Player Lobby / Ready
       |
       `--> Session Start
                |
                v
          FREEFORM PLAY
```

Character selection inside Join is a task-flow requirement, not proof that Character is globally a prerequisite to entering Session.

---

# 5. Play Workspace

See `UX-01-07` and the migrated Play decisions in `decisions.md`.

## Freeform baseline

```text
+---------------------------------------------------+
| NPC / Neutral / Hostile Actor Board              |
+---------------------------------------------------+
|                                                   |
|                Scene / Table Context              |
|                                                   |
+---------------------------------------------------+
| Player / Allied Actor Board                       |
+---------------------------------------------------+
| Bottom Command Center / Hotbar / Economy          |
+---------------------------------------------------+
```

Scene/Actor Context and the Command Center are co-primary anchors.

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

Initiative keeps the shared Play Workspace, keeps Actor Boards, and adds a compact top Initiative Tracker according to the migrated reviewed decisions.

---

# 6. Action / targeting / resolution loop

This is a conceptual flow. Exact guards/rollback belong in M2.

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

Key invariants already reviewed:

- UI does not compute target legality.
- Single-target valid click executes without an extra confirmation.
- Multi-target requires explicit Execute.
- Resolution does not globally disable the entire Command Center.
- Physical dice presentation never determines gameplay result.

---

# 7. DM contextual Play flow

Current planning direction:

```text
                         PLAY
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
 Actor Context         Encounter          Handout
       |                  |                  |
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

These are contextual tools by default in the planning model. Existing implementation routes do not automatically make them final top-level destinations.

---

# 8. Handout presentation branch

```text
DM chooses presentation
        |
        +--> Overlay ------> Actor Boards remain; local Player minimize/close/reopen allowed
        |
        +--> Upper Scene --> upper scene presentation replaces upper area; Player cannot locally dismiss
        |
        `--> Full Scene ---> full scene presentation replaces relevant scene/boards; Command Center remains; Player cannot locally dismiss
```

Image + presentation mode are intended shared session presentation state; exact network contract is owned by Session/Authority planning and implementation contracts.

---

# 9. Content / add-on flow

```text
Content
  |
  +--> Installed Content detail
  |
  `--> Add Content
          |
          v
      File selection
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

No invalid/unsupported content behavior may be approximated by UI.

---

# 10. Rules flow

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
       | connection lost
       v
RECONNECTING
       |
       +--> recovered ------> restore same canonical live-session context
       |
       `--> unrecoverable --> explicit recovery / leave flow
```

Reconnect presentation must not silently reset canonical turn/combat/session state.

---

# 12. Exit / session-end concept

```text
PLAY / SESSION
    |
    +--> Player leaves ------> explicit leave flow ------> Product Shell
    |
    `--> Host ends session --> explicit destructive flow -> all participants leave live context
```

Exact confirmation wording, consequences, and authority rules remain downstream decisions.

---

# 13. Flow coverage still to materialize

Before this map can be Frozen, AI must cross-check R1-R9 and M1-M6 and explicitly account for at least:

- first-use/onboarding flow;
- no-character Join branch;
- session incompatibility and permission-denied branches;
- save failure / durable Character write-back recovery;
- detailed level-up branches;
- detailed Character import/edit recovery;
- DM-only roll and later disclosure flow;
- Undo/adjudication correction flow;
- narrow desktop and reduced-motion flow invariants where they change interaction sequence.

These omissions are tracked in [`planning-gaps.md`](planning-gaps.md) rather than guessed into this map.
