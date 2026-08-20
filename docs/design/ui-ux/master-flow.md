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
- A live session provides a persistent return-to-Play continuity path from the Product Shell. (`UX-01-03`)
- Freeform and Initiative are modes of the same Play Workspace, not separate applications. (`docs/design/README.md`, `docs/design/session-runtime.md`)
- DM contextual tools are shown as contextual candidates in this Draft view until their topology is reviewed by the appropriate downstream Decision Maps.

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

Direct Host/Join entry is projected from `ORIGIN-FLOW-01`. `Return to Play` is contextual continuity projected from `UX-01-03`, not a separate product destination in this derived view.

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

Character Sheet is a first-class standalone tabletop surface, not merely a setup step for VTT Play. See `UX-01-01`. Detailed Character navigation remains subject to `DND-01` / `NAV-01` Decision Maps and `docs/design/character-lifecycle.md`.

---

# 3. Direct Host path

Projected from `ORIGIN-FLOW-01` at the product-entry level; exact Host Setup/Lobby details remain `SES-01` review scope.

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

A new Character requirement for hosting would change `ORIGIN-FLOW-01` or its eventual permanent destination decision and therefore must not be introduced only in this view.

---

# 4. Direct Join path

Direct Join entry is projected from `ORIGIN-FLOW-01`; Character Select is projected from `ORIGIN-FLOW-02`.

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
       +--> no valid Character --> GAP-JOIN-NO-CHARACTER
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

Character selection inside Join is flow-specific and does not make Character a product-wide prerequisite for Session. The no-valid-Character branch is explicitly unresolved by `GAP-JOIN-NO-CHARACTER`.

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

This visualization is derived from `UX-01-07`, `ORIGIN-UX-01-09`, `ORIGIN-UX-01-10`, and `ORIGIN-UX-01-11`.

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

The current view preserves Actor Boards and adds a compact top Initiative Tracker according to `ORIGIN-UX-01-14` and `ORIGIN-UX-01-15`. Authoritative Freeform/Initiative semantics remain governed by `docs/design/session-runtime.md`.

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

---

# 7. DM contextual Play flow

Current **Draft candidate topology**:

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

This section is a coverage visualization, not an approved topology decision. Existing implementation routes do not automatically make these final top-level or contextual destinations; their placement must be resolved by the applicable `NAV-01`, `SES-01`, `DM-01`, and `DM-02` Decision Maps.

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

Draft coverage view; exact CONTENT-02 decisions are not yet reviewed.

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

No invalid/unsupported content behavior may be approximated by UI; that boundary is supported by `docs/design/README.md` and applicable rules/content contracts.

---

# 10. Rules flow

Draft coverage view; exact CONTENT-02/NAV decisions are not yet reviewed.

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

Reconnect must preserve authoritative/session/game state according to `UX-01-03`; exact network/session recovery semantics remain governed by `docs/design/session-runtime.md` and future `SES-02` decisions.

---

# 12. Exit / session-end concept

Draft coverage view; exact confirmation, consequences, and authority are not yet approved.

```text
PLAY / SESSION
    |
    +--> Player leaves ------> explicit leave flow ------> Product Shell
    |
    `--> Host ends session --> explicit destructive flow -> all participants leave live context
```

Exact behavior remains downstream `SES-01`, `SES-02`, and `INT-03` decision scope.

---

# 13. Flow coverage still to materialize

The Global Planning Gate still requires explicit coverage for at least:

- first-use/onboarding flow;
- no-character Join branch;
- session incompatibility and permission-denied branches;
- save failure / durable Character write-back recovery;
- detailed level-up branches;
- detailed Character import/edit recovery;
- DM-only roll and later disclosure flow;
- Undo/adjudication correction flow;
- narrow desktop and reduced-motion flow invariants where they change interaction sequence.

These items are tracked **according to their type** in `registry.md`, `review-plan.md`, `matrices.md`, or `planning-gaps.md`. Do not create a Planning Gap merely because coverage detail is incomplete; create one when safe planning/implementation would otherwise require guessing material behavior or authority.
