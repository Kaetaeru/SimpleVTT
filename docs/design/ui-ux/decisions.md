# SimpleVTT UI/UX Decision Ledger

Canonical decision bodies live here unless a future split gives a decision its own canonical file. Other planning artifacts should reference these IDs rather than copy the normative decision text.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Review order and undecided Decision Maps: [`review-plan.md`](review-plan.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)

## Ledger rules

- `Status` MUST be exactly one lifecycle enum: `Draft`, `Selected`, `Reviewed`, `Frozen`, or `Superseded`.
- `Selected` / `Reviewed` does **not** mean Frozen; do not append free-form text such as `not Frozen` to the Status value.
- This ledger contains **decisions that have actually been made**, plus preserved migrated decisions. Undecided question maps live only in `review-plan.md`.
- Do not silently renumber historical decisions. If an older origin ID moves to another review sheet, keep the origin as an alias until the destination sheet assigns its permanent ID.
- If a decision changes, preserve traceability with `Superseded` / `Superseded By` instead of deleting history.
- Compact entries are intentional. Add advanced fields only when needed for authority, legacy, scope, or change impact.
- `Depends On`, `Destination`, `Planning Gap`, and ID-based `Affects` references MUST use complete stable IDs. Do not use ranges, omitted prefixes, or prose substitutes where an ID exists.

---

# UX-01 — Product Principles

## UX-01-01 — Product posture

- **Status:** Reviewed
- **Applies To:** Product
- **Decision:** SimpleVTT is a hybrid product. Standalone Character Sheet use and Connected VTT play are both first-class core experiences; neither is treated as an add-on to the other.
- **Why:** The product must work well both at a physical tabletop and as a connected VTT.
- **Affects:** DND-01, SES-01, NAV-01

## UX-01-02 — Application relationship

- **Status:** Reviewed
- **Applies To:** Product Shell / Play
- **Decision:** Use one common Product Shell with a dedicated Play Workspace optimized for live session use.
- **Why:** Preserve one product identity while allowing Play to use a specialized high-density surface.
- **Depends On:** UX-01-01

## UX-01-03 — Play continuity

- **Status:** Reviewed
- **Applies To:** Leaving / returning to Play
- **Decision:** Preserve authoritative/session/game state when leaving and returning to Play. Ephemeral presentation state may reset when explicitly allowed.
- **Why:** Navigation must not reset connection, turn, Character, combat, or resolution state.

## UX-01-04 — Core capability exposure

- **Status:** Reviewed
- **Applies To:** Character / Play capability UI
- **Decision:** Core capabilities use persistent, directly discoverable UI. Do not hide normal actions behind intent funnels, drawers, or cleanliness-driven progressive disclosure.
- **Why:** The player should see what the controlled Actor can do without repeatedly opening menus.
- **Affects:** DND-03, SES-01, CMP-01

## UX-01-05 — Context adaptation

- **Status:** Reviewed
- **Applies To:** Capability UI
- **Decision:** Keep a stable interaction skeleton while context activates, disables, adds, or removes capabilities according to canonical state.
- **Why:** Stable placement improves learnability; capability legality remains canonical rather than inferred by UI.
- **Depends On:** UX-01-04

## UX-01-06 — Discoverability and customization

- **Status:** Reviewed
- **Applies To:** Capability discovery / Hotbar
- **Decision:** Complete automatic capability discovery and user Hotbar customization coexist. New capabilities surface automatically, but must not silently reorder or replace user-customized Hotbar slots.
- **Why:** Discoverability and personalization are separate product needs.
- **Depends On:** UX-01-04, UX-01-05

## UX-01-07 — Play visual priority

- **Status:** Reviewed
- **Applies To:** Play Workspace
- **Decision:** Play uses a **Dual Anchor**: Scene/Actor Context and the bottom Command Center are co-primary. The center answers who/what is happening; the bottom answers what the current Actor can do. Neither may be demoted to temporary/supporting UI.
- **Why:** Combines scene awareness with a persistent BG3-like command surface.
- **Affects:** SES-01, DND-03, DND-04

---

# Migrated reviewed decisions

These decisions were selected/reviewed before their final destination sheet maps were materialized. Their content is preserved under stable origin IDs; permanent destination IDs may be assigned later without losing the origin alias.

## ORIGIN-FLOW-01 — Direct first-class Session entry

- **Status:** Reviewed
- **Destination:** NAV-01, SES-01
- **Decision:** Home exposes direct first-class Host Session and Join Session entry paths. Session is not modeled as a child of Character, and visiting/creating a Character is not a universal prerequisite for entering Session.
- **Depends On:** UX-01-01

## ORIGIN-FLOW-02 — Join includes Character selection

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** Player Join includes a Character Select step before entering the Player Lobby / live Play path. This flow-specific selection requirement does not make Character a product-wide prerequisite for Session.
- **Planning Gap:** GAP-JOIN-NO-CHARACTER
- **Depends On:** ORIGIN-FLOW-01

## ORIGIN-UX-01-07 — Bottom Action Bar structure

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** Use one persistent BG3-family bottom Action Bar / Hotbar with at least Mixed, Action, Spell, Item page tabs plus custom pages. Economy/key state remains legible across tabs. Do not replace this with a mobile-style menu/drawer simplification.

## ORIGIN-UX-01-08 — Economy and Resource Rail

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** Keep fixed Action / Bonus Action / Reaction / Movement economy indicators plus a dynamic Resource Rail for canonical spell slots, class resources, equipment charges, counts, costs, and unavailable state.

## ORIGIN-UX-01-09 — Full Command Center

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** The bottom Command Center includes controlled Actor portrait/name/HP/Temp HP/status, Hotbar pages/slots, economy/resources, and contextual controls such as End Turn/confirm/cancel as applicable.

## ORIGIN-UX-01-10 — Freeform allied Actor Board

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** In Freeform, unless a relevant DM presentation replaces it, the lower scene area contains Player/Allied Actor Cards above the Command Center. Do not collapse this into a permanent side portrait rail.

## ORIGIN-UX-01-11 — Freeform opposing Actor Board

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** Freeform uses an upper NPC/Neutral/Hostile Actor Board and lower Player/Allied Actor Board, with the Command Center at the bottom.

## ORIGIN-UX-01-12 — Handout presentation modes

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** DM chooses among `Overlay`, `Upper Scene`, and `Full Scene` presentation modes. Mode is shared session state and reconnect restores image + mode. UI must not silently substitute another mode.

## ORIGIN-UX-01-13 — Handout dismissibility

- **Status:** Reviewed
- **Destination:** SES-01
- **Decision:** Overlay may be locally closed/minimized and reopened by Player; Upper Scene and Full Scene remain until the DM withdraws/transitions the presentation. Zoom/pan may remain local presentation controls.

## ORIGIN-UX-01-14 — Initiative preserves Actor Boards

- **Status:** Reviewed
- **Destination:** DND-04
- **Decision:** Initiative keeps the Actor Boards and adds a horizontal top Initiative Tracker instead of replacing the scene with a separate combat stage.

## ORIGIN-UX-01-15 — Compact Initiative Tracker

- **Status:** Reviewed
- **Destination:** DND-04
- **Decision:** The top tracker is portrait-centered and compact: order/current/initiative/core condition icons. HP, economy/resources, and End Turn remain elsewhere, primarily Actor Cards / Command Center.

## ORIGIN-UX-01-16 — Actor Card primary/context actions

- **Status:** Reviewed
- **Destination:** INT-01
- **Decision:** Left click performs the contextually appropriate primary interaction; during selected-action targeting it targets that action. In combat hostile context it may invoke the canonical default weapon attack when valid. Right click opens a vertical Actor Context Menu that does not duplicate normal Hotbar actions.

## ORIGIN-UX-01-17 — Default combat hostile click attack

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** With no selected Hotbar targeting action, a valid hostile Actor click in combat invokes the authoritative equipped Main Hand attack. It must not choose a spell/cantrip/strongest action.
- **Planning Gap:** GAP-MAIN-HAND-CANONICAL-RELATION

## ORIGIN-UX-01-18 — No smart attack fallback

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** If the canonical Main Hand default is unavailable, do not silently fall back to offhand, unarmed, another weapon, cantrip, or spell. Show the authoritative unavailable reason.

## ORIGIN-UX-01-19 — Target eligibility presentation

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** When targeting begins, all Actor Cards immediately project eligibility. Valid targets are emphasized; invalid targets remain visible but disabled/dimmed, with authoritative reasons when available. UI does not calculate eligibility.

## ORIGIN-UX-01-20 — Single-target execution

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** Clicking one valid target for a selected single-target action executes immediately without an extra confirmation. Multi-target actions use explicit Execute after target selection.

## ORIGIN-UX-01-21 — Resolution interaction locking

- **Status:** Reviewed
- **Destination:** DND-03
- **Decision:** Keep the Command Center skeleton visible during resolution and lock only conflicting interactions. Do not implement `resolution exists => disable entire HUD`.

## ORIGIN-UX-01-22 — Scene-integrated result feedback

- **Status:** Reviewed
- **Destination:** DND-02
- **Decision:** Resolution result feedback is integrated into the scene/play context rather than becoming a detached full-screen result experience. Detailed history remains available through Activity.

## ORIGIN-UX-01-22A — Physical tabletop dice

- **Status:** Reviewed
- **Destination:** DND-02
- **Decision:** Dice are physically thrown/rolled on the top-view tabletop plane: originate from the far/back side, move toward the viewer, impact the table plane, bounce/roll, and settle. They are not merely floating UI-number effects.

## ORIGIN-UX-01-23 — Wide central dice roll area

- **Status:** Reviewed
- **Destination:** DND-02
- **Decision:** The broad central table/scene surface is the dice Roll Area rather than a small tray or tiny HUD seam.

## ORIGIN-UX-01-24 — Authoritative result, guided final die face

- **Status:** Reviewed
- **Destination:** DND-02
- **Decision:** Rules/Host authority determines the actual roll/result first. Physical dice presentation must settle to the authoritative final face; physics never determines gameplay.

## ORIGIN-UX-01-25 — Client-local trajectories

- **Status:** Reviewed
- **Destination:** DND-02
- **Decision:** Public rolls share canonical die type/count/final face/total, but fine physics trajectory may differ by client. Physics failure/reduced motion never changes the result.
- **Depends On:** ORIGIN-UX-01-26

## ORIGIN-UX-01-26 — Public / DM Only roll visibility

- **Status:** Reviewed
- **Destination:** SES-02
- **Decision:** Authoritative roll visibility includes at least `Public | DM Only`. DM Only means Players must not receive secret authoritative dice, formula/modifiers, total, outcome, or existence metadata merely to hide it in CSS.

## ORIGIN-UX-01-27 — Persistent DM visibility toggle

- **Status:** Reviewed
- **Destination:** DM-01
- **Decision:** DM Command Center exposes a persistent `Public / DM Only` roll visibility control with a strong continuous DM-only indicator. The system does not auto-switch visibility from context.
- **Planning Gap:** GAP-DM-ROLL-VISIBILITY-PERSISTENCE

## ORIGIN-UX-01-28 — Later disclosure options

- **Status:** Reviewed
- **Destination:** DM-02
- **Decision:** A hidden roll may later be disclosed as either `full adjudication reveal` or `result-only reveal`. This is disclosure/projection of the original adjudication, not a reroll.

## ORIGIN-UX-01-29 — No Player trace before disclosure

- **Status:** Reviewed
- **Destination:** SES-02
- **Decision:** While a roll is DM Only, Players receive no dice, result strip, Activity placeholder, secret-roll marker, or existence metadata. Later disclosure creates only the authorized public projection at disclosure time.

---

# Pending sheets

No undecided question bodies are stored in this ledger. The canonical review sequence and complete predeclared Decision Maps live in [`review-plan.md`](review-plan.md). When the owner answers a predeclared item, record the resulting Decision Card here.
