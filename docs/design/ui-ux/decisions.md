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

# UX-02 — User & Role Model

## UX-02-01 — Connected role mapping

- **Status:** Reviewed
- **Applies To:** Connected Session role model
- **Decision:** Connected play uses a fixed mapping between connection role and play role: **Host is always DM; Client is always Player.** Host/Player and Client/DM combinations are not supported connected-role states.
- **Why:** Host/Client and DM/Player are not independently combinable in the connected product model; the connection role determines the connected play role.
- **Affects:** UX-02-03, UX-02-05, UX-02-06, UX-02-07, UX-02-08, SES-01, SES-02, DM-01

## UX-02-02 — Offline/Standalone has no DM/Player role

- **Status:** Reviewed
- **Applies To:** Offline / Standalone use
- **Decision:** Offline/Standalone use has **no DM/Player role identity**. DM and Player roles exist only in Connected Session contexts under `UX-02-01`. Offline UI may expose local product capabilities appropriate to the current surface, but it must not invent a hidden DM/Player role merely to authorize them.
- **Why:** Standalone Character/product use is a first-class local context, not a simulated connected session.
- **Depends On:** UX-02-01
- **Affects:** DND-01, SES-02

## UX-02-03 — Character ownership establishes baseline Actor control

- **Status:** Reviewed
- **Applies To:** Connected Player Character / Actor relationship
- **Decision:** A Player who owns/selects a Character for the connected session automatically controls that Character's Actor. Character ownership therefore establishes baseline control of its corresponding Actor. Additional Actor control assigned under `UX-02-04` does **not** transfer Character ownership.
- **Why:** The Player's own Character should not require a second redundant control assignment, while additional temporary/session control must remain distinguishable from durable Character ownership.
- **Depends On:** UX-02-01
- **Affects:** UX-02-04, UX-02-05, SES-01, SES-02, DND-04

## UX-02-04 — Player defaults to one Actor; DM may assign more

- **Status:** Reviewed
- **Applies To:** Connected Player Actor control scope
- **Decision:** A Player normally controls **one Actor**: the Actor corresponding to the Player's owned/selected Character. The DM may explicitly assign additional Actors for that Player to control. Additional assignment changes session control authority only; it does not change Character ownership.
- **Why:** One default controlled Actor keeps the normal Player model simple while supporting companions, temporary control, or exceptional session needs without redefining ownership.
- **Depends On:** UX-02-03
- **Affects:** SES-01, SES-02, DND-04, INT-01

## UX-02-05 — DM may control every Actor

- **Status:** Reviewed
- **Applies To:** Connected DM Actor-control authority
- **Decision:** The DM may control **any Actor in the session**, including Actors normally controlled by Players. Player ownership/control does not remove DM control authority.
- **Why:** The Host/DM is the authoritative session operator and must be able to operate NPCs, enemies, allies, and Player-linked Actors when adjudication/session control requires it.
- **Depends On:** UX-02-03
- **Affects:** DM-01, SES-01, SES-02, DND-04, INT-01

## UX-02-06 — No live DM/Player role switching

- **Status:** Reviewed
- **Applies To:** Connected live Session
- **Decision:** A participant cannot switch between DM and Player roles while remaining in the live connection/session role. Host remains DM and Client remains Player for that live connection.
- **Why:** The fixed connected-role model in `UX-02-01` remains stable during live play and does not require authority reconciliation for role swaps.
- **Depends On:** UX-02-01
- **Affects:** SES-02

## UX-02-07 — Shared Play skeleton with role-specific tools and information

- **Status:** Reviewed
- **Applies To:** Connected DM / Player UI structure
- **Decision:** DM and Player share the same **core Play Workspace skeleton and interaction grammar**, while role-specific tools, controls, information, and contextual utilities may differ materially where authority or task needs differ. Do not create wholly unrelated DM and Player products/workspaces.
- **Why:** Shared structure preserves learnability and product coherence while allowing the DM's broader control surface and private information needs.
- **Depends On:** UX-02-01
- **Affects:** NAV-01, UI-01, SES-01, SES-02, DM-01

## UX-02-08 — Unauthorized information policy is information-specific

- **Status:** Reviewed
- **Applies To:** Connected role-scoped information
- **Decision:** The treatment of information a role is not authorized to know is defined **by information/contract type**, not by one universal hide/deliver rule. However, existing stricter privacy decisions remain binding: information classified as DM-only/secret authoritative data under `ORIGIN-UX-01-26` and `ORIGIN-UX-01-29` is **not delivered to Players at all**, including existence metadata. Other role-specific information may use its explicit domain/session presentation contract; AI must not infer a policy merely from this decision.
- **Why:** Not every role difference is secret data, but security/privacy-sensitive information requires stronger non-delivery semantics than ordinary role-specific UI differences.
- **Depends On:** UX-02-03
- **Affects:** SES-02, STATE-02, CONTENT-01

## UX-02-09 — No extra connected roles in v1

- **Status:** Reviewed
- **Applies To:** v1 Connected Session roles
- **Decision:** v1 supports only the connected roles already defined by `UX-02-01`: **Host/DM and Client/Player**. Spectator, Co-DM, Observer, or other additional roles are out of v1 scope.
- **Why:** The v1 role model stays bounded to the two actual connected authority contexts already selected.
- **Depends On:** UX-02-01
- **Affects:** SES-01, SES-02

## UX-02-09A — Extra-role permission branch not applicable in v1

- **Status:** Reviewed
- **Applies To:** v1 Connected Session roles
- **Decision:** No extra-role permission matrix is defined for v1 because `UX-02-09` excludes Spectator, Co-DM, Observer, and other additional roles. This conditional branch must be reopened if a future decision adds an extra connected role.
- **Why:** The conditional question is resolved by the false branch of `UX-02-09`; inventing unused permissions would add unsupported authority semantics.
- **Depends On:** UX-02-09
- **Affects:** SES-02

---

# UX-03 — Information Hierarchy

## UX-03-01 — Global destinations stay small
- **Status:** Reviewed
- **Decision:** Product-level global destinations are Home, Characters, Session, Content, Rules, and Settings. Activity, Encounter, Adjudication, and Session utilities remain contextual tools rather than top-level destinations.
- **Affects:** NAV-01

## UX-03-02 — Dedicated Play with persistent return path
- **Status:** Reviewed
- **Decision:** Play is a dedicated workspace, but a compact persistent entry back to the Product Shell remains available while playing.
- **Depends On:** UX-01-02
- **Affects:** NAV-01, SES-01

## UX-03-03 — Core UI persistent; supporting UI contextual
- **Status:** Reviewed
- **Decision:** Core anchors and frequently used capabilities stay visible. Detailed information, DM tools, and auxiliary utilities may open contextually when needed.
- **Depends On:** UX-01-04
- **Affects:** INT-02, SES-01, DM-01

## UX-03-04 — Turn/status joins the primary Play layer
- **Status:** Reviewed
- **Decision:** Scene/Actor Context, the Command Center, and current turn/status information are all first-priority operational information in Play. Utilities and history remain secondary.
- **Depends On:** UX-01-07
- **Affects:** UI-01, DND-04, SES-01

## UX-03-05 — Standalone Sheet prioritizes identity and use
- **Status:** Reviewed
- **Decision:** Standalone Character Sheet prioritizes Character identity, HP/core stats, and commonly used actions/rolls before lower-priority record detail. The product also supports both an Official-style sheet layout and a SimpleVTT-optimized layout as user-selectable presentation modes.
- **Affects:** UI-01, DND-01

## UX-03-06 — Hide explanation, not normal capability
- **Status:** Reviewed
- **Decision:** Progressive disclosure is used primarily for explanations and detail, not to hide normal capabilities. Where appropriate, hover may open a lightweight pointer-following explanation frame; equivalent non-pointer access can be handled by the relevant accessibility/detail contract without changing this presentation preference.
- **Depends On:** UX-01-04
- **Affects:** INT-01, CMP-01, CONTENT-01

## UX-03-07 — Contextual duplication is allowed
- **Status:** Reviewed
- **Decision:** The same canonical information may intentionally appear in multiple relevant surfaces when it helps the current task. Duplication is decided contextually per surface and must not create independent competing values.
- **Why:** The owner explicitly wants this revisitable by context rather than a rigid one-location rule.
- **Affects:** CMP-01

## UX-03-08 — Feedback follows proximity and persistence
- **Status:** Reviewed
- **Decision:** Immediate important results appear near the current task/scene; persistent problems use status/banner treatment; detailed durable history lives in Activity; toast is reserved for brief non-blocking feedback.
- **Affects:** STATE-01, DND-02, DM-02

---

# NAV-01 — Navigation

## NAV-01-01 — Global menu order
- **Status:** Reviewed
- **Decision:** Global navigation order is Home → Characters → Session → Content → Rules → Settings. Exact visual spacing/affordance is AI-managed design detail.
- **Depends On:** UX-03-01

## NAV-01-02 — Persistent Return to Play
- **Status:** Reviewed
- **Decision:** While a live session exists, global navigation always exposes a visible Return to Play entry.
- **Depends On:** UX-01-03, UX-03-02

## NAV-01-03 — Character Library is the Character hub
- **Status:** Reviewed
- **Decision:** Character Library is the Character-management hub. Opening a Character enters its Sheet; create/edit/level-up flows are launched from the Library or Sheet rather than treated as peer global destinations.
- **Affects:** DND-01

## NAV-01-04 — Utility return restores prior context
- **Status:** Reviewed
- **Decision:** Leaving Rules, Content, or Settings returns the user to the prior safe Product context and restores relevant local context where practical.

## NAV-01-05 — Activity/Encounter/Adjudication stay contextual
- **Status:** Reviewed
- **Decision:** Activity, Encounter, Adjudication, and Session utilities do not become top-level global navigation destinations; they open from the relevant task/session context.
- **Depends On:** UX-03-01

## NAV-01-06 — Back, Close, and Return are distinct
- **Status:** Reviewed
- **Decision:** Back means previous navigation context, Close dismisses the current contextual layer, and Return explicitly returns to the parent workspace/Play context. Do not collapse these into one ambiguous control.
- **Affects:** INT-02

## NAV-01-07 — First-run guidance is an overlay
- **Status:** Reviewed
- **Decision:** First launch uses a dedicated onboarding/tutorial overlay. The guidance can later be reopened from Settings or Help/Info.
- **Affects:** CONTENT-01, DND-01

## NAV-01-08 — App restart begins at Home
- **Status:** Reviewed
- **Decision:** Closing the application counts as disconnecting from any connected session. A later app launch begins at Home rather than automatically reopening the prior Play workspace. Rejoining/reconnecting is an explicit subsequent action.
- **Why:** In-app navigation continuity and process-restart behavior are intentionally different.
- **Affects:** STATE-02, SES-01, SES-02

---

# UI-01 — Layout & Grid

## UI-01-01 — Product Shell uses top navigation
- **Status:** Reviewed
- **Decision:** Normal Product Shell surfaces use top navigation/header with the main content beneath it, rather than a permanent left navigation rail.
- **Depends On:** NAV-01-01

## UI-01-02 — Scene flexes above a fixed Command Center
- **Status:** Reviewed
- **Decision:** Play uses the Scene/Table as the flexible central region and keeps the Command Center fixed along the bottom. Play regions/panels may be user-resizable where safe, with minimum usable sizes that preserve core controls and scene access.
- **Depends On:** UX-01-07
- **Affects:** PLATFORM-01, CMP-01

## UI-01-03 — Actor Boards fill space, then scroll
- **Status:** Reviewed
- **Decision:** Opposing Actor Cards remain in the upper board and allied/player Actor Cards in the lower board. Cards fill available board width; once the minimum usable card size no longer fits, overflow uses horizontal scrolling/paging instead of shrinking cards below that minimum.
- **Depends On:** ORIGIN-UX-01-10, ORIGIN-UX-01-11
- **Affects:** PLATFORM-01

## UI-01-04 — Initiative overlays the scene top edge
- **Status:** Reviewed
- **Decision:** Initiative Tracker is a compact horizontal strip at the top edge of the scene, visually overlaid while reserving enough safe area not to obscure essential scene content.
- **Depends On:** ORIGIN-UX-01-14, ORIGIN-UX-01-15

## UI-01-05 — BG3-family Command Center composition
- **Status:** Reviewed
- **Decision:** Command Center follows the selected BG3-family composition: a small upper row displays action-economy/resources; the lower-left area carries the controlled Character/Actor status; the larger right/lower area carries the action/hotbar controls. Exact spacing is an AI-managed layout detail.
- **Depends On:** ORIGIN-UX-01-07, ORIGIN-UX-01-08, ORIGIN-UX-01-09
- **Affects:** DND-03, SES-01

## UI-01-06 — Session/DM utilities use side panes
- **Status:** Reviewed
- **Decision:** Contextual Session/DM utilities open in left/right side panes while the core Scene/Actor/Command Center structure remains present.
- **Depends On:** UX-03-03
- **Affects:** INT-02, DM-01, SES-01

## UI-01-07 — Two first-class Character Sheet layouts
- **Status:** Reviewed
- **Decision:** Character Sheet supports two selectable presentation layouts: an Official-style layout and a SimpleVTT-optimized layout. The first-run tutorial asks the user which layout to start with. The SimpleVTT layout may be designed freely for stronger UX within canonical Character data/rules boundaries.
- **Depends On:** UX-03-05, NAV-01-07
- **Affects:** DND-01

## UI-01-08 — Preserve current Builder and Level Up UX
- **Status:** Reviewed
- **Decision:** Existing Character creation/builder and Level Up UX are accepted as the product baseline and are not part of the current redesign. Future work should preserve them unless the owner explicitly reopens that scope.
- **Why:** The owner explicitly judged the existing flows satisfactory.
- **Affects:** DND-01

## UI-01-09 — Major regions may scroll independently
- **Status:** Reviewed
- **Decision:** Major content regions may own independent scrolling where appropriate, while global navigation/header and the Play Command Center remain fixed/sticky anchors.
- **Affects:** PLATFORM-01

---
# INT-01 — Interaction

## INT-01-01 — Targeting outranks DM control mode, then selection
- **Status:** Reviewed
- **Decision:** When click meanings overlap, selected-action targeting has highest priority. If no targeting action owns the click, an explicitly enabled DM control mode takes priority over ordinary Actor selection/context focus.
- **Depends On:** ORIGIN-UX-01-16, UX-02-05
- **Affects:** DM-01, DND-03

## INT-01-02 — Actor Context Menu contains UI/context actions only
- **Status:** Reviewed
- **Decision:** Actor right-click Context Menu is for UI/context-management actions such as Details/Inspect and other non-gameplay contextual controls. It must not contain executable gameplay actions such as attacks, spells, items, or duplicate Hotbar capabilities.
- **Depends On:** ORIGIN-UX-01-16
- **Affects:** CMP-01

## INT-01-03 — No keyboard equivalent for Actor right-click menu
- **Status:** Reviewed
- **Decision:** v1 does not provide a keyboard shortcut/equivalent that opens the Actor right-click Context Menu. Keyboard-accessible routes to material information may exist elsewhere, but they do not need to reproduce this menu.
- **Why:** Explicit owner choice.
- **Affects:** A11Y-01

## INT-01-04 — Escape cancels active action/targeting first
- **Status:** Reviewed
- **Decision:** Escape/Back first cancels active targeting/command-selection state, then dismisses the topmost applicable layer, and only after those are clear participates in navigation/back behavior.
- **Affects:** INT-02, DND-03

## INT-01-05 — Frequent actions are directly visible
- **Status:** Reviewed
- **Decision:** Frequently used actions should be directly visible whenever practical. Context menus/secondary layers are reserved for genuinely exceptional, rare, or non-core controls.
- **Depends On:** UX-01-04
- **Affects:** CMP-01, DND-03

## INT-01-06 — Unavailable reason uses hover/focus; blockers may be inline
- **Status:** Reviewed
- **Decision:** Unavailable/invalid reasons are normally accessible through hover/focus explanation treatment; material blockers may additionally show the reason inline near the affected task/control.
- **Depends On:** UX-03-06
- **Affects:** STATE-01, CONTENT-01

## INT-01-07 — Persistent status plus interaction selection layer
- **Status:** Reviewed
- **Decision:** Controlled/current-turn information uses persistent status indicators. Targeting, selected-target, and transient interaction selection use an active interaction layer. A separate persistent **NOTICE UI** summarizes important current operational notices/state so the user does not have to infer them from card styling alone.
- **Affects:** STATE-01, CMP-01, SES-01

---

# Lightweight owner checkpoints — reviewed

## PLATFORM-01-01 — Desktop-width v1 support
- **Status:** Reviewed
- **Decision:** v1 officially supports wide, normal, and narrow **desktop-window** layouts. Mobile/touch-first UI is out of v1 scope; ordinary desktop reflow may adapt within the supported window classes.
- **Affects:** PLATFORM-01, M5

## SES-01-02 — Session opens directly into live Play
- **Status:** Reviewed
- **Decision:** Hosting does **not** create a separate waiting/readiness lobby. When the Host opens a session, the live session is immediately active and the DM can play and edit/prep within that same session context. Players may join the already-live session at any time through a mid-session join flow; there is no all-players-ready gate before Play exists.
- **Why:** The owner explicitly wants a continuously live, editable session rather than a lobby-to-start lifecycle.
- **Affects:** SES-01-05, SES-01, SES-02, R2-HOST, R2-JOIN

## SES-01-05 — No separate Player Lobby/Ready surface
- **Status:** Reviewed
- **Decision:** Because `SES-01-02` makes the hosted session live immediately, v1 has no separate Player Lobby/Ready stage. A joining Player completes connection and Character selection, then enters the already-live session when accepted/valid; late join is a normal session behavior.
- **Depends On:** SES-01-02
- **Affects:** SES-01, SES-02

## SES-01-04 — No Character blocks Join
- **Status:** Reviewed
- **Decision:** If a Client has no valid Character, Join is blocked. The UI provides clear `Create Character` / `Import Character` actions; after obtaining a valid Character, the user starts Join again rather than entering a Character-less lobby/session state.
- **Depends On:** ORIGIN-FLOW-02
- **Affects:** R2-JOIN, R6-NO-VALID-CHARACTER

## DM-01-01 — DM rolls default Public for one session
- **Status:** Reviewed
- **Decision:** A newly opened session starts with DM roll visibility set to `Public`. If the DM switches to `DM Only` or back, the selected value persists for that live session only and resets to `Public` for a new session.
- **Depends On:** ORIGIN-UX-01-27
- **Affects:** SES-02, DM-01

## DM-02-01 — Private DM Activity stays in one chronology with filters
- **Status:** Reviewed
- **Decision:** DM Activity uses one chronological history for public and DM-only adjudication records. Private entries are strongly marked for the DM and the Activity UI provides public/private visibility filtering. Private entries remain absent from Player delivery until explicitly disclosed under existing disclosure rules.
- **Depends On:** ORIGIN-UX-01-26, ORIGIN-UX-01-29
- **Affects:** R4-ACTIVITY, SES-02

## DM-01-03 — Spatial relation editor is an advanced DM tool
- **Status:** Reviewed
- **Decision:** v1 includes normal Encounter/initiative management and retains manual distance/visibility/cover authoring as an **advanced DM tool** that is opened only when needed rather than occupying the default Play surface.
- **Depends On:** UX-02-05
- **Affects:** R4-ENCOUNTER, R4-DM-SPATIAL-RELATION

## DM-02-05 — Correction history is never deleted
- **Status:** Reviewed
- **Decision:** DM correction/Undo must not erase prior committed history. A reversal or correction creates a new recorded event that references the prior result; the original calculation/event remains inspectable. Whether state can be cleanly reversed is determined by authoritative domain semantics, not by UI deletion.
- **Why:** This matches the canonical session-runtime correction/reversal model.
- **Affects:** R2-DM-UNDO, DM-02

## CONTENT-02-04 — One official SimpleVTT package format in v1
- **Status:** Reviewed
- **Decision:** v1 productizes one official **SimpleVTT package format** for add-on/content import. The product does not heuristically accept arbitrary JSON or other undeclared formats as equivalent packages.
- **Affects:** R7-FILE-INPUT, R4-IMPORT-REVIEW

## CONTENT-02-09 — Full add-on lifecycle is a v1 capability
- **Status:** Reviewed
- **Decision:** v1 product scope includes install, update, replace, disable, and delete/remove operations for installed add-on/content packages. Dependency validation, safe replacement/removal semantics, and recovery remain governed by explicit content/domain contracts rather than UI guesswork.
- **Depends On:** CONTENT-02-04
- **Affects:** CONTENT-02, INT-03

## CONTENT-02-11 — Live session content is snapshot-fixed
- **Status:** Reviewed
- **Decision:** A live session uses the content configuration captured when that session is opened. Installing, updating, disabling, replacing, or deleting content while a session is live prepares changes for later sessions but does not mutate the current session's content snapshot.
- **Why:** Live authoritative state must not change underneath an active session because the local content library changed.
- **Affects:** SES-01, SES-02, M3, R4-SESSION-SHARE

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

No undecided question bodies are stored in this ledger. The canonical review sequence and complete predeclared Decision Maps live in [`review-plan.md`](review-plan.md). When the owner answers a material owner-checkpoint item, record the resulting Decision Card here. Lower-risk design details may be resolved by the AI-managed contract/default process defined by the planning framework without creating unnecessary owner Decision Cards.