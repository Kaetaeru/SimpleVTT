# Phase 14 Production UX Redesign

## Scope

This redesign applies to production Host / Join / session operation and every non-Character application surface.

The existing Character Library, Character Sheet, Character Create/Edit, and Level-Up UI/UX are frozen for this pass. Production session entry may select an existing saved production Character, but must not redesign Character ownership or authoring flows.

## Product-level information rules

A production user should see domain language and the next useful action, not adapter/protocol language.

### Always-visible information

- Current page/task title.
- One clear primary action when the page has an obvious next step.
- Session/connection state only where it affects the current task.
- Human-readable entity, Character, Combatant, participant, action, and result names.
- Recoverable errors with an explicit recovery action.

### Conditional information

- Initiative round/current actor only during Initiative.
- Ready status only in Host preparation / Client lobby.
- Host endpoint only while hosting or joining/reconnecting.
- Action economy only while it constrains the selected actor.
- Encounter management only for DM/Host preparation and DM play.
- Rule provenance, package metadata, event details, spatial authoring, import validation, and diagnostics only when the user asks for details or opens an advanced section.

### Hide/remove from routine production UI

- Raw internal `role` values.
- Raw `compatible` / `warning` labels when no action is required.
- RulesProfile identifiers.
- Internal actor/entity/event IDs.
- `Reference`, fixture, adapter, manifest, capability, SessionProjection, or protocol implementation wording.
- Version/source/package metadata as primary card content.
- Duplicate navigation labels for the same product concept.
- Duplicate panels that present the same participant/entity set twice.
- Explanatory copy that tells the user about implementation structure rather than what they can do.
- Fixture/tutorial entities presented as live session content.
- Any routine dependency on Debug Dock or `Ctrl+Shift+D`.

## Session user mental model

A user should be able to answer these questions without understanding internal adapters, roles, manifests, fixtures, or debug state:

1. Am I offline, opening a Host, waiting in a lobby, playing, reconnecting, or disconnected?
2. What is this session called?
3. If I am hosting, what address do I give other players?
4. If I am joining, what Host address and Character am I using?
5. Who is connected and who is Ready?
6. What is the one primary action available in the current state?
7. If something failed, what should I do next?

## Session information hierarchy

### Always visible when relevant

- Human-readable session state: Offline / Host preparing / Lobby / Live / Reconnecting / Disconnected.
- Session name.
- The primary action for the current state.
- Recoverable connection or startup errors with an explicit next action.
- Participant names plus a compact connected / Ready summary once a session exists.

### State-conditional information

#### Offline

- `새 세션 만들기`
  - Session name input.
  - `세션 열기` primary action.
- `세션 참가하기`
  - Saved production Character selector using the existing production Character source.
  - Host address input.
  - `참가하기` primary action.
- Both entry paths remain available after Host stop, Client leave, or a recoverable Host/Join failure.

#### Host preparing

- Session name is editable.
- Host listening address is prominent and copyable/readable.
- Connected participant roster and Ready state.
- Encounter preparation is explicit and starts empty.
- Available Combatant definitions may be added deliberately by the DM.
- Freeform / Initiative start mode.
- `플레이 시작` and `Host 중지` actions.

#### Client lobby

- Session name and Host address.
- Selected Character identity.
- Connection problem only when attention is required.
- Ready / Ready cancel.
- Leave session.

#### Live

- Session name and connection state.
- Play mode; Initiative round/current actor only when Initiative is active.
- Participant connection summary.
- End / leave session action.
- DM-only operational controls are secondary to ordinary play and must not obscure the play workspace.

#### Reconnecting / failure

- Preserve the user's current context when possible.
- Show a clear inline message explaining whether the app is retrying or requires user action.
- Never make the Host/Join recovery form disappear because of top-level UI role state.

### Advanced or collapsed by default

- Installed/session content package metadata.
- Detailed connection diagnostics.
- Manual theater-of-mind spatial relation authoring when it is not immediately needed.

## Production state-screen model

### Offline Session page

One stable visible page owns both entry paths:

- Left: `새 세션 만들기` — session name, then Host open.
- Right: `세션 참가하기` — existing saved production Character, Host address, then Join.
- A prior stop/failure returns to this same stable surface.

### Host preparing

One visible Session workspace owns:

- editable session name;
- Host address;
- participant + Ready roster;
- empty-by-default encounter setup;
- mode selection and Start;
- Host stop.

### Client lobby

One visible Session workspace owns:

- session/Host summary;
- selected Character summary;
- Ready control;
- connection recovery state;
- leave.

### Live

The play workspace remains primary. Session management is available without a duplicate floating lifecycle card. Advanced DM spatial relation authoring is collapsed by default.

## Non-Character surface audit

### Global shell / navigation

**Primary**
- Consistent product destinations: Scene/Play, Combatants where applicable, Rules, Activity, Session, Settings.
- Current destination and only contextually useful connection/session state.

**Secondary**
- Initiative round/current actor while live.
- Connection indicator while a connected session exists or is recovering.

**Remove / change**
- Do not use different labels such as `세션` vs `연결` for the same Session destination solely because of top-level role.
- Do not show raw Player/DM implementation role as the most prominent global status when the current task already communicates the mode.
- Do not show `자유 진행` globally when there is no live session to which that mode matters.

### DM Scene / Play workspace

**Primary**
- Current scene/session name.
- Selected/current actor, valid targets, actionable actions, constrained resources/economy.
- Initiative order/round/turn only in Initiative.
- The action result/resolution and what changed.

**Secondary**
- Compact encounter participant list.
- Current target inspection.
- DM adjudication and spatial relation tools in deliberate secondary/advanced areas.

**Remove / change**
- Avoid showing the same allies/enemies/entity collection in multiple side panels simultaneously.
- Remove implementation-explanation text such as `전술 격자 아님` from the primary play stage; the interaction itself should communicate theater-of-mind play.
- Keep provenance/details on focus/expand, not as the primary reading path.

### Combatants

**Primary**
- Searchable/reusable Combatant list with name, key combat stats, and `Encounter에 추가` action.
- Current Encounter list with clear remove/manage actions during preparation.

**Secondary**
- Import/create workflow.
- Source/version and detailed actions after opening a Combatant.

**Remove / change**
- Replace `Definition` / `Instance` implementation jargon with `라이브러리` / `현재 Encounter` language.
- Do not lead every card with package source/version metadata.
- Do not imply fixture monsters are already part of a production encounter.

### Rules Catalog

**Primary**
- Search, category filter, localized rule name, short purpose/summary.
- Selected rule detail when requested.

**Secondary**
- Source/version/provenance and import management.

**Remove / change**
- IDs and package metadata should not dominate browsing cards.
- Content import validation belongs in an explicit import flow, not the default browsing path.

### Activity

**Primary**
- Chronological user-readable outcome: who acted, what happened, result/state change.
- Undo only when it is actually available/safe.

**Secondary**
- Roll components, damage breakdown, provenance, correction/undo linkage.

**Remove / change**
- Event IDs and `ResolutionEvent` terminology are detail-level diagnostics.
- Avoid an always-visible generic Undo button when the current entry cannot be meaningfully undone.

### Settings

**Primary**
- Appearance/theme, accent, motion/accessibility controls that affect the user experience.

**Secondary**
- Future network or diagnostic options only if they are real configurable settings.

**Remove / change**
- No reference/test state controls in routine Settings.
- Settings should not duplicate Session connection controls.

## Production content invariants

- Starting a production Host must not preload reference Goblin A, Goblin B, Wolf, Training Guardian, Aelar, or Mira into the live encounter.
- A fresh Host and a clean Host restart begin with an empty encounter; participants are added intentionally.
- Production encounter participants are added intentionally: remote Character projections through the existing connected-session handshake and DM Combatants through the existing preparation runtime.
- Existing Host authority, ResolutionEvent ledger, reconnect/replay, Character ownership, installed-content composition, and durable Character write-back remain unchanged.
- No new session store, protocol, fixture fallback, or Character durable source is introduced.

## Implementation sequence

1. **Session entry/lifecycle** — repair Host-stop recovery, session naming, empty encounter, stable Host/Join/lobby/live surface.
2. **Global shell/navigation** — make destinations/status consistent without touching Character screens.
3. **DM Scene/Play** — reduce duplicate panels and promote actor/action/result hierarchy.
4. **Combatants** — remove Definition/Instance jargon and separate library from active encounter clearly.
5. **Rules Catalog** — search-first browsing with detail/metadata progressive disclosure.
6. **Activity** — readable outcome-first timeline with technical detail collapsed.
7. **Settings** — retain only real user configuration and accessibility controls.
8. Run common-viewport/keyboard and Windows two-instance human acceptance again on the redesigned surfaces.

## Acceptance criteria for the current Session redesign slice

1. After Host stop, the visible Session workspace immediately exposes both `새 세션 만들기` and `세션 참가하기`; Host address input never disappears because top-level role remains DM.
2. A Host can enter a session name before opening and edit it while preparing.
3. Production Host preparation starts with no reference fixture actors/combatants in the Scene.
4. Host preparation can still deliberately add/remove a real Combatant and carry it into live play.
5. A saved non-reference Character can still Join, Ready, reconnect, and receive Host-authoritative events through existing runtime paths.
6. Routine Session UI does not show raw Role, RulesProfile, healthy manifest internals, or Reference-flow copy.
7. Host bind failure and Join/reconnect failure remain visible on the stable Session workspace with a recovery action.
8. Production mounts one visible Session lifecycle workspace; the old separate Host lifecycle and Player lobby overlays are not mounted. The current bridge integration that replaces the legacy App Session grid is transitional implementation debt and must be removed when the global shell/App route is refactored in sequence step 2.
9. Character Library / Sheet / Create/Edit / Level-Up UI/UX is unchanged by this slice.
