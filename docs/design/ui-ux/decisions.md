# SimpleVTT UI/UX Decision Ledger

Canonical decision bodies live here unless a future split gives a decision its own canonical file. Other planning artifacts should reference these IDs rather than copy the normative decision text.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Ledger rules

- `Selected` / `Reviewed` does **not** mean Frozen.
- Do not silently renumber historical decisions. If an older origin ID moves to another review sheet, keep the origin as an alias until the destination sheet assigns its permanent ID.
- If a decision changes, preserve traceability with `Superseded` / `Superseded By` instead of deleting history.
- Compact entries are intentional. Add advanced fields only when needed for authority, legacy, scope, or change impact.

---

# UX-01 — Product Principles

## UX-01-01 — Product posture

- **Status:** Reviewed, not Frozen
- **Applies To:** Product
- **Decision:** SimpleVTT is a hybrid product. Standalone Character Sheet use and Connected VTT play are both first-class core experiences; neither is treated as an add-on to the other.
- **Why:** The product must work well both at a physical tabletop and as a connected VTT.
- **Affects:** R1 IA, R2 flows, Character, Session, Play

## UX-01-02 — Application relationship

- **Status:** Reviewed, not Frozen
- **Applies To:** Product Shell / Play
- **Decision:** Use one common Product Shell with a dedicated Play Workspace optimized for live session use.
- **Why:** Preserve one product identity while allowing Play to use a specialized high-density surface.
- **Depends On:** UX-01-01

## UX-01-03 — Play continuity

- **Status:** Reviewed, not Frozen
- **Applies To:** Leaving / returning to Play
- **Decision:** Preserve authoritative/session/game state when leaving and returning to Play. Ephemeral presentation state may reset when explicitly allowed.
- **Why:** Navigation must not reset connection, turn, Character, combat, or resolution state.

## UX-01-04 — Core capability exposure

- **Status:** Reviewed, not Frozen
- **Applies To:** Character / Play capability UI
- **Decision:** Core capabilities use persistent, directly discoverable UI. Do not hide normal actions behind intent funnels, drawers, or cleanliness-driven progressive disclosure.
- **Why:** The player should see what the controlled Actor can do without repeatedly opening menus.
- **Affects:** DND-03, SES-01, R7

## UX-01-05 — Context adaptation

- **Status:** Reviewed, not Frozen
- **Applies To:** Capability UI
- **Decision:** Keep a stable interaction skeleton while context activates, disables, adds, or removes capabilities according to canonical state.
- **Why:** Stable placement improves learnability; capability legality remains canonical rather than inferred by UI.
- **Depends On:** UX-01-04

## UX-01-06 — Discoverability and customization

- **Status:** Reviewed, not Frozen
- **Applies To:** Capability discovery / Hotbar
- **Decision:** Complete automatic capability discovery and user Hotbar customization coexist. New capabilities surface automatically, but must not silently reorder or replace user-customized Hotbar slots.
- **Why:** Discoverability and personalization are separate product needs.
- **Depends On:** UX-01-04, UX-01-05

## UX-01-07 — Play visual priority

- **Status:** Reviewed, not Frozen
- **Applies To:** Play Workspace
- **Decision:** Play uses a **Dual Anchor**: Scene/Actor Context and the bottom Command Center are co-primary. The center answers who/what is happening; the bottom answers what the current Actor can do. Neither may be demoted to temporary/supporting UI.
- **Why:** Combines scene awareness with a persistent BG3-like command surface.
- **Affects:** SES-01, DND-03, DND-04

---

# Migrated reviewed decisions

These decisions were originally explored under `UX-01` before the review process was corrected. Their content is preserved, but their permanent destination IDs are assigned only when the destination sheet's complete Decision Map is established.

## ORIGIN-UX-01-07 — Bottom Action Bar structure

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** Use one persistent BG3-family bottom Action Bar / Hotbar with at least Mixed, Action, Spell, Item page tabs plus custom pages. Economy/key state remains legible across tabs. Do not replace this with a mobile-style menu/drawer simplification.

## ORIGIN-UX-01-08 — Economy and Resource Rail

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** Keep fixed Action / Bonus Action / Reaction / Movement economy indicators plus a dynamic Resource Rail for canonical spell slots, class resources, equipment charges, counts, costs, and unavailable state.

## ORIGIN-UX-01-09 — Full Command Center

- **Status:** Reviewed, not Frozen
- **Destination:** SES-01 Session UX
- **Decision:** The bottom Command Center includes controlled Actor portrait/name/HP/Temp HP/status, Hotbar pages/slots, economy/resources, and contextual controls such as End Turn/confirm/cancel as applicable.

## ORIGIN-UX-01-10 — Freeform allied Actor Board

- **Status:** Reviewed, not Frozen
- **Destination:** SES-01 Session UX
- **Decision:** In Freeform, unless a relevant DM presentation replaces it, the lower scene area contains Player/Allied Actor Cards above the Command Center. Do not collapse this into a permanent side portrait rail.

## ORIGIN-UX-01-11 — Freeform opposing Actor Board

- **Status:** Reviewed, not Frozen
- **Destination:** SES-01 Session UX
- **Decision:** Freeform uses an upper NPC/Neutral/Hostile Actor Board and lower Player/Allied Actor Board, with the Command Center at the bottom.

## ORIGIN-UX-01-12 — Handout presentation modes

- **Status:** Reviewed, not Frozen
- **Destination:** SES-01 Session UX
- **Decision:** DM chooses among `Overlay`, `Upper Scene`, and `Full Scene` presentation modes. Mode is shared session state and reconnect restores image + mode. UI must not silently substitute another mode.

## ORIGIN-UX-01-13 — Handout dismissibility

- **Status:** Reviewed, not Frozen
- **Destination:** SES-01 Session UX
- **Decision:** Overlay may be locally closed/minimized and reopened by Player; Upper Scene and Full Scene remain until the DM withdraws/transitions the presentation. Zoom/pan may remain local presentation controls.

## ORIGIN-UX-01-14 — Initiative preserves Actor Boards

- **Status:** Reviewed, not Frozen
- **Destination:** DND-04 Combat UX
- **Decision:** Initiative keeps the Actor Boards and adds a horizontal top Initiative Tracker instead of replacing the scene with a separate combat stage.

## ORIGIN-UX-01-15 — Compact Initiative Tracker

- **Status:** Reviewed, not Frozen
- **Destination:** DND-04 Combat UX
- **Decision:** The top tracker is portrait-centered and compact: order/current/initiative/core condition icons. HP, economy/resources, and End Turn remain elsewhere, primarily Actor Cards / Command Center.

## ORIGIN-UX-01-16 — Actor Card primary/context actions

- **Status:** Reviewed, not Frozen
- **Destination:** INT-01 Interaction
- **Decision:** Left click performs the contextually appropriate primary interaction; during selected-action targeting it targets that action. In combat hostile context it may invoke the canonical default weapon attack when valid. Right click opens a vertical Actor Context Menu that does not duplicate normal Hotbar actions.

## ORIGIN-UX-01-17 — Default combat hostile click attack

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** With no selected Hotbar targeting action, a valid hostile Actor click in combat invokes the authoritative equipped Main Hand attack. It must not choose a spell/cantrip/strongest action.
- **Planning Gap:** Requires a canonical equipment-to-main-hand-attack relation; UI must not infer it.

## ORIGIN-UX-01-18 — No smart attack fallback

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** If the canonical Main Hand default is unavailable, do not silently fall back to offhand, unarmed, another weapon, cantrip, or spell. Show the authoritative unavailable reason.

## ORIGIN-UX-01-19 — Target eligibility presentation

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** When targeting begins, all Actor Cards immediately project eligibility. Valid targets are emphasized; invalid targets remain visible but disabled/dimmed, with authoritative reasons when available. UI does not calculate eligibility.

## ORIGIN-UX-01-20 — Single-target execution

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** Clicking one valid target for a selected single-target action executes immediately without an extra confirmation. Multi-target actions use explicit Execute after target selection.

## ORIGIN-UX-01-21 — Resolution interaction locking

- **Status:** Reviewed, not Frozen
- **Destination:** DND-03 Action UX
- **Decision:** Keep the Command Center skeleton visible during resolution and lock only conflicting interactions. Do not implement `resolution exists => disable entire HUD`.

## ORIGIN-UX-01-22 — Scene-integrated result feedback

- **Status:** Reviewed, not Frozen
- **Destination:** DND-02 Roll & Dice UX
- **Decision:** Resolution result feedback is integrated into the scene/play context rather than becoming a detached full-screen result experience. Detailed history remains available through Activity.

## ORIGIN-UX-01-22A — Physical tabletop dice

- **Status:** Reviewed, not Frozen
- **Destination:** DND-02 Roll & Dice UX
- **Decision:** Dice are physically thrown/rolled on the top-view tabletop plane: originate from the far/back side, move toward the viewer, impact the table plane, bounce/roll, and settle. They are not merely floating UI-number effects.

## ORIGIN-UX-01-23 — Wide central dice roll area

- **Status:** Reviewed, not Frozen
- **Destination:** DND-02 Roll & Dice UX
- **Decision:** The broad central table/scene surface is the dice Roll Area rather than a small tray or tiny HUD seam.

## ORIGIN-UX-01-24 — Authoritative result, guided final die face

- **Status:** Reviewed, not Frozen
- **Destination:** DND-02 Roll & Dice UX
- **Decision:** Rules/Host authority determines the actual roll/result first. Physical dice presentation must settle to the authoritative final face; physics never determines gameplay.

## ORIGIN-UX-01-25 — Client-local trajectories

- **Status:** Reviewed, not Frozen
- **Destination:** DND-02 Roll & Dice UX
- **Decision:** Public rolls share canonical die type/count/final face/total, but fine physics trajectory may differ by client. Physics failure/reduced motion never changes the result.
- **Depends On:** SES-02 visibility/authority decisions

## ORIGIN-UX-01-26 — Public / DM Only roll visibility

- **Status:** Reviewed, not Frozen
- **Destination:** SES-02 Multiplayer Authority UX
- **Decision:** Authoritative roll visibility includes at least `Public | DM Only`. DM Only means Players must not receive secret authoritative dice, formula/modifiers, total, outcome, or existence metadata merely to hide it in CSS.

## ORIGIN-UX-01-27 — Persistent DM visibility toggle

- **Status:** Reviewed, not Frozen
- **Destination:** DM-01 DM Controls
- **Decision:** DM Command Center exposes a persistent `Public / DM Only` roll visibility control with a strong continuous DM-only indicator. The system does not auto-switch visibility from context.
- **Planning Gap:** Initial default and exact persistence boundary remain undecided.

## ORIGIN-UX-01-28 — Later disclosure options

- **Status:** Reviewed, not Frozen
- **Destination:** DM-02 Adjudication & Undo
- **Decision:** A hidden roll may later be disclosed as either `full adjudication reveal` or `result-only reveal`. This is disclosure/projection of the original adjudication, not a reroll.

## ORIGIN-UX-01-29 — No Player trace before disclosure

- **Status:** Reviewed, not Frozen
- **Destination:** SES-02 Multiplayer Authority UX
- **Decision:** While a roll is DM Only, Players receive no dice, result strip, Activity placeholder, secret-roll marker, or existence metadata. Later disclosure creates only the authorized public projection at disclosure time.

---

# UX-02 — User & Role Model

No UX-02 individual decision is recorded yet. The complete predeclared Decision Map is preserved in planning workflow and should be materialized before review resumes.

Planned sequence:

| ID | Question |
| --- | --- |
| `UX-02-01` | Separate Play Role and Connection Role, or use one role axis? |
| `UX-02-02` | Does Offline/Standalone use have a DM/Player identity? |
| `UX-02-03` | Relationship between Character ownership and Actor control? |
| `UX-02-04` | How many Actors may a Player control in one session? |
| `UX-02-05` | DM Actor-control authority model? |
| `UX-02-06` | Is live DM <-> Player role switching allowed? |
| `UX-02-07` | How far may role-specific UI structure diverge? |
| `UX-02-08` | Default visibility principle for unauthorized information? |
| `UX-02-09` | Include Spectator / Co-DM / Observer in v1? |
| `UX-02-09A` | Conditional permission boundaries only if extra roles are included. |

Do not add additional UX-02 questions mid-sheet without first adding them visibly to the Decision Map as a Planning Gap or declared branch.
