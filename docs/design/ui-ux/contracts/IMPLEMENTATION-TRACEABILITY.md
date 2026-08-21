# SimpleVTT Accepted UI/UX — Implementation Traceability

Status: **Runtime-preparation traceability; accepted prototype mapped to authority and blockers; not Frozen**

Accepted reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
Owner acceptance: 2026-08-21
```

Purpose: give implementation agents one place to answer:

- What accepted UI behavior must be preserved?
- Which Product Decision owns it?
- Which Domain/Architecture source owns the underlying truth?
- Is a technical contract still missing?
- Is current code/test evidence known to conflict?

This file does not Freeze anything and does not authorize runtime implementation.

---

# 1. Global authority map

| Concern | Product/UI authority | Domain/Architecture authority | Runtime status |
| --- | --- | --- | --- |
| Hybrid Standalone + Connected product | `UX-01-01` | `docs/design/README.md` | Planning accepted |
| Common Product Shell + dedicated Play | `UX-01-02`, `UX-03-02`, `NAV-01-02` | session continuity contracts | Planning accepted |
| Mapless Core | integrated baseline interpretation | `docs/design/README.md`, `docs/design/movement-modules.md` | Canonical Domain boundary |
| First-run Tutorial | `NAV-01-07` | local preference/hydration implementation | Planning accepted |
| Initial Official/SimpleVTT Sheet choice | `UI-01-07` / normalized UI decision | Character presentation preference only | Planning accepted |
| Host=DM / Client=Player | `UX-02-01` | connected session authority | Planning accepted |
| Offline has no DM/Player role | `UX-02-02` | offline Character/local authority | Planning accepted |
| Actor ownership/control | `UX-02-03`, `UX-02-04`, `UX-02-05` | session control/authority | Planning accepted |
| Shared DM/Player Play skeleton | `UX-02-07` | role-scoped projections | Planning accepted |
| DM-only non-delivery | `UX-02-08`, `ORIGIN-UX-01-26`, `ORIGIN-UX-01-29` | network/event projection | **Blocked: `GAP-DM-ONLY-DELIVERY-PROTOCOL`** |
| Persistent capabilities/Hotbar | `UX-01-04`, `UX-01-05`, `UX-01-06`, `ORIGIN-UX-01-07` | capability projections | Planning accepted |
| Play Dual Anchor | `UX-01-07` | session/Actor/resolution projections | Planning accepted |
| Actor Boards | `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11`, `ORIGIN-UX-01-14` | session Actor state | Planning accepted |
| Command Center | `ORIGIN-UX-01-09` | controlled Actor/capability/resource projections | Planning accepted |
| Main Hand default hostile click | `ORIGIN-UX-01-16`, `ORIGIN-UX-01-17`, `ORIGIN-UX-01-18` | executable relation in domain/application | **Blocked: `GAP-MAIN-HAND-CANONICAL-RELATION`** |
| Target eligibility presentation | `ORIGIN-UX-01-19`, `ORIGIN-UX-01-20` | `docs/design/session-runtime.md` targeting/resolver | Product accepted; eligibility authority exists conceptually |
| Manual area targeting | integrated accepted contract | `docs/design/session-runtime.md` | Canonical mapless targeting supported |
| Selective resolution locking | `ORIGIN-UX-01-21` | command-conflict contract | **Blocked: `GAP-RESOLUTION-SAFE-INTERACTIONS`** |
| Scene/Play-integrated result | `ORIGIN-UX-01-22` | ResolutionEvent/Activity | Planning accepted |
| Physical dice presentation | `ORIGIN-UX-01-22A`, `ORIGIN-UX-01-23`, `ORIGIN-UX-01-24`, `ORIGIN-UX-01-25` | authoritative roll result from resolver | Planning accepted; visual engine still implementation work |
| Handout Overlay/Upper/Full | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | shared session presentation state | **Blocked: `GAP-HANDOUT-NETWORK-CONTRACT`** |
| Freeform/Initiative same workspace | current Product decisions + accepted contract | `docs/design/session-runtime.md` | Canonical Domain behavior aligned |
| Content package lifecycle | `CONTENT-02-*` | declarative content/module contracts | Planning accepted |
| Live content snapshot | `CONTENT-02-11` | session/content snapshot contract | Canonical behavior |
| Rules browser/lookup | `UX-03`, `NAV-01` family | authoritative composed catalog | Planning accepted |

---

# 2. Canonical Domain constraints implementation must not violate

## Product definition

`docs/design/README.md` establishes:

- local-first D&D play assistant;
- automation of routine arithmetic/bookkeeping while preserving choices;
- UI does not own rules;
- Freeform and Initiative use one engine;
- battle maps/tokens/Fog of War are deliberately excluded from Core unless later justified.

## Map/spatial ownership

`docs/design/movement-modules.md` establishes:

- Core has no movement/battle-map/token-position/grid/pathfinding/collision/LoS/3D scene system;
- no default token dragging or Core moveActor command;
- future map modules own coordinates/transforms/tokens/geometry;
- Core consumes only rules-relevant spatial facts such as pair distance/visibility/cover;
- without module, missing spatial facts reject explicitly rather than being invented.

Therefore accepted `Play Context / Tabletop Stage` is presentation space, never permission to add Core tactical coordinates.

## Session authority / targeting

`docs/design/session-runtime.md` establishes:

- Player owns permanent Character; DM Host owns authoritative shared-session ordering/state;
- UI must not infer authority from who clicked;
- Freeform has no initiative order/current turn;
- Initiative adds explicit order/turn/economy;
- both modes use the same rules/resolution/event engine;
- targeting supports multiple manual targets and area-like actions without a tactical map;
- PendingResolution is ephemeral and may pause for target/reaction/adjudication/unsupported review;
- ActionRequest does not directly mutate state.

---

# 3. Accepted surface -> runtime data needs

| Accepted UI surface | Minimum runtime projection needed | Authority owner | Readiness |
| --- | --- | --- | --- |
| Tutorial | first-use completion + Sheet presentation preference | local product preference | Needs implementation design; low-risk |
| Home | recent Character summary + live-session presence for Return to Play | local app/session context | Needs implementation design |
| Character Library | canonical Character list/identity/status | Character repository | Existing domain expected |
| Standalone Sheet | canonical Character + derived values + capabilities + local roll path | Character/rules resolver | Existing domain expected |
| Same-Sheet dice | roll result + notation/presentation plan | local resolver | UI can implement after scope ready |
| Host Setup | real transport/listen inputs + open result | session/network | Must use actual transport contract |
| Join Setup | real Host address + Character selection + sync states | session/network + Character | Must use actual transport contract |
| Play chrome | role + connection + session identity/status | session runtime | Existing/architecture projection |
| Actor Boards | Actor identity/relation/control/current turn/authorized HP/status | session runtime | Existing/needs projection audit |
| Command Center | actual controlled Actor + capabilities/resources/economy | session/rules projections | Needs projection audit |
| Hotbar eligibility | available/unavailable + reason + target mode/cost | rules/application | Must not be UI-calculated |
| Targeting | per-Actor valid/invalid + reason | resolver/application | Supported conceptually |
| Main Hand default | canonical executable Main Hand relation | domain/application | **Blocked** |
| Resolving selective lock | command-level safe/conflict flags | application/domain | **Blocked** |
| Initiative tracker | round/turn/order/initiative/status | session runtime | Canonical |
| Reaction/Concentration | PendingResolution response model | resolver/session runtime | Requires exact adapter/projection mapping |
| Connected dice | authoritative dice presentation plan/result | resolver/session event | Canonical result required |
| Result strip | committed/pending result summary + detail link | ResolutionEvent / Activity | Canonical |
| Activity | authorized event projection + correction/disclosure relation | event/network authority | Privacy split partly **blocked** |
| Handout | shared asset + presentation mode + local dismiss state + reconnect projection | session/network presentation | **Blocked** |
| Spatial facts pane | Actor pair + distance/visibility/cover/source | session/rules spatial facts | Canonical seam exists; UI mapping needed |
| Content | installed catalog/package validation/lifecycle | content subsystem | Existing contracts |
| Rules | composed authoritative catalog/search | rules/content subsystem | Existing contracts |

---

# 4. Current open technical blockers

## `GAP-MAIN-HAND-CANONICAL-RELATION`

Needed before implementing the default hostile-click attack path.

Required outcome: authoritative application/domain projection from currently controlled Actor/equipment state to executable Main Hand action identity + unavailable reason.

UI must not choose by heuristic.

## `GAP-RESOLUTION-SAFE-INTERACTIONS`

Needed before selective interaction locking can be production-correct.

Required outcome: authoritative contract/projection describing which concurrent commands/interactions conflict with the active PendingResolution.

UI must not maintain a guessed hard-coded allowlist/denylist derived from prototype fixtures.

## `GAP-HANDOUT-NETWORK-CONTRACT`

Needed before implementing shared Overlay/Upper/Full behavior and reconnect restoration.

Required outcome: authoritative shared presentation state, asset identity/reference, mode, withdraw/transition semantics and reconnect projection.

Local Player Overlay dismiss is presentation state and must remain distinct.

## `GAP-DM-ONLY-DELIVERY-PROTOCOL`

Critical before production DM-only rolls/adjudication/history.

Required outcome: role-scoped authoritative event projection where Player does not receive secret value/result/outcome/existence metadata before disclosure; later disclosure creates only the allowed public projection.

CSS hiding is not sufficient.

---

# 5. Known implementation/test drift to reconcile before touched runtime work

The repository-wide audit already identified these categories as evidence/drift, not Product truth.

| Area | Known drift | Required treatment in runtime preparation |
| --- | --- | --- |
| `src/App.tsx` | permanent left sidebar | Reconcile to accepted top Product navigation if touched |
| `src/ProductRoot.tsx` | connected mode may bypass common Product Shell | Preserve accepted common Product identity + Return to Play continuity |
| `src/V1HomeScreen.tsx` | Home guide/combined Host-Join history | Replace with Tutorial-first + distinct Host/Join when touched |
| `src/app/sheetLayoutPreferences.ts` | default may bypass initial Tutorial choice | Introduce first-use preference flow when touched |
| existing Standalone roll UI | historical tray/result/close patterns | Replace with transient same-Sheet dice behavior |
| `src/ProductionPlayScreen.tsx` | mapless evidence but historical intent-first action UI | Keep useful mapless evidence; replace primary action IA with accepted Hotbar direction |
| `src/SessionModeRoot.tsx` / `SessionMainFocus.tsx` | current connected composition differs from accepted Actor Boards/Command Center | Reconcile under scoped Work Order |
| older intent-first UI tests | assert superseded primary action model | Update/delete only with authorized touched-scope runtime work |
| `.agents/*` | historical mixed product plans | Evidence only; never implementation authority |
| `prototype/app/index.html` | rejected | Never use |
| `prototype/app/final-spec.html` | invalidated map-like candidate | Never use |

Exact changed files/tests must be re-inspected at runtime Work Order preparation; this table is not permission to edit them now.

---

# 6. Product decisions are accepted planning truth, not yet Frozen implementation dependencies

Prototype acceptance means the visual/interaction composition is approved as the reference.

It does **not** automatically change Decision lifecycle statuses.

Before a runtime Work Order:

1. identify the exact Decision IDs required by the intended implementation scope;
2. confirm their current status;
3. resolve blocking Domain/Architecture contracts for that scope;
4. explicitly Freeze only the dependencies the owner authorizes as implementation-stable;
5. record the accepted prototype reference alongside those Frozen dependencies.

Do not globally Freeze all UI/UX decisions merely because the prototype was accepted.

---

# 7. Recommended runtime preparation sequence

```text
Accepted Reference Prototype              PASS
Implementation-facing contracts           THIS DIRECTORY
-> choose first runtime implementation slice
-> inspect exact current src/tests for that slice
-> resolve slice-blocking Domain/Architecture gaps
-> reconcile stale derived docs/tests for touched scope
-> identify exact Product Decision dependencies
-> explicit scoped Freeze authorization
-> write runtime Work Order
-> explicit runtime implementation authorization
-> implementation
-> automated + visual QA against accepted reference/contracts
```

Recommended first slice should minimize unresolved architecture dependencies. Product Shell + first-run Tutorial + Character presentation preference is a safer early slice than DM-only privacy, Handout networking or selective resolution locking.

---

# 8. Runtime QA trace

Each future runtime Work Order should map acceptance to:

- exact Surface Contract sections;
- exact Component Contract sections;
- exact Interaction/State/Motion sections;
- exact canonical Decision IDs;
- exact Domain/Architecture contracts;
- exact tests to add/update;
- accepted prototype visual reference;
- accessibility/responsive checks;
- known stale tests explicitly superseded or updated.

No runtime implementation should be considered complete merely because it resembles the HTML screenshot. Behavior/authority/state contracts must also match.

---

# 9. Current readiness summary

```text
Prototype Owner Acceptance: PASS
Accepted Candidate: integrated-reference.html
Contract Extraction: MATERIALIZED
Mapless Domain Boundary: READY
First-run/Product Shell Product Intent: READY FOR SCOPED PREPARATION
Character/Standalone presentation intent: READY FOR SCOPED PREPARATION
Main Hand default attack: BLOCKED BY DOMAIN CONTRACT
Selective resolution locking: BLOCKED BY DOMAIN CONTRACT
Handout shared/reconnect: BLOCKED BY ARCHITECTURE CONTRACT
DM-only delivery/privacy: BLOCKED BY ARCHITECTURE CONTRACT
Global runtime implementation: NOT AUTHORIZED
```
