# Phase 14 Production UX Redesign

## Scope

This redesign applies to production Host / Join / session operation and the non-Character application shell.

The existing Character Library, Character Sheet, Character Create/Edit, and Level-Up UI/UX are frozen for this pass. Production session entry may select an existing saved production Character, but must not redesign Character ownership or authoring flows.

## User mental model

A user should be able to answer these questions without understanding internal adapters, roles, manifests, fixtures, or debug state:

1. Am I offline, opening a Host, waiting in a lobby, playing, reconnecting, or disconnected?
2. What is this session called?
3. If I am hosting, what address do I give other players?
4. If I am joining, what Host address and Character am I using?
5. Who is connected and who is Ready?
6. What is the one primary action available in the current state?
7. If something failed, what should I do next?

## Information hierarchy

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
- Connection / compatibility problem only when attention is required.
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

These can be available for diagnosis but should not compete with the primary workflow:

- RulesProfile identifier.
- Installed/session content package versions and sources.
- Compatibility manifest details when healthy.
- Low-level entity / actor identifiers.
- Detailed connection diagnostics.
- Manual theater-of-mind spatial relation authoring when it is not immediately needed.

### Remove from routine production UI

- Raw internal `role` values.
- Raw `compatible` / `warning` labels when no action is required.
- `Reference` implementation wording.
- Fixture/tutorial names presented as if they were live user content.
- Duplicate Host / Join cards from separate UI layers.
- CSS rules that hide a legacy card only so a portal can replace it.
- Floating lifecycle overlays that duplicate the Session page.
- Explanatory copy about adapter/reference implementation rather than the user's next action.
- Any routine dependency on Debug Dock or `Ctrl+Shift+D`.

## Production state-screen model

### Offline Session page

One stable page owns both entry paths:

- Left: `새 세션 만들기` — session name, then Host open.
- Right: `세션 참가하기` — existing saved production Character, Host address, then Join.
- A prior stop/failure returns to this same stable surface.

### Host preparing

One Session page owns:

- editable session name;
- Host address;
- participant + Ready roster;
- empty-by-default encounter setup;
- mode selection and Start;
- Host stop.

### Client lobby

One Session page owns:

- session/Host summary;
- selected Character summary;
- Ready control;
- connection recovery state;
- leave.

### Live

The play workspace remains primary. Session management is available from the Session page without a duplicate global lifecycle overlay.

## Production content invariants

- Starting a production Host must not preload reference Goblin A, Goblin B, Wolf, Training Guardian, Aelar, or Mira into the live encounter.
- Production encounter participants are added intentionally: remote Character projections through the existing connected-session handshake and DM Combatants through the existing preparation runtime.
- Existing Host authority, ResolutionEvent ledger, reconnect/replay, Character ownership, installed-content composition, and durable Character write-back remain unchanged.
- No new session store, protocol, fixture fallback, or Character durable source is introduced.

## Acceptance criteria for this redesign slice

1. After Host stop, the Session page immediately exposes both `새 세션 만들기` and `세션 참가하기`; Host address input never disappears because top-level role remains DM.
2. A Host can enter a session name before opening and edit it while preparing.
3. Production Host preparation starts with no reference fixture actors/combatants in the Scene.
4. Host preparation can still deliberately add/remove a real Combatant and carry it into live play.
5. A saved non-reference Character can still Join, Ready, reconnect, and receive Host-authoritative events through existing runtime paths.
6. Routine Session UI does not show raw Role, RulesProfile, healthy manifest internals, or Reference-flow copy.
7. Host bind failure and Join/reconnect failure remain visible on the stable Session page with a recovery action.
8. The Session page is the single production lifecycle surface; no portal/CSS replacement trick is required.
9. Character Library / Sheet / Create/Edit / Level-Up UI/UX is unchanged by this slice.
