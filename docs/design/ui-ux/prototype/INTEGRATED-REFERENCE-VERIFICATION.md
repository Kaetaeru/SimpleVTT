# Integrated Reference Prototype — Verification

Status: **STATIC REVIEW CANDIDATE PASS — BROWSER VISUAL QA PENDING**

Candidate entry:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
```

Candidate code reference commit used for this verification:

```text
4c12084bef603866b9b69f1bfd8f363146920184
```

This record verifies the rebuilt prototype against the repository-wide integrated baseline and the mapless Prototype Work Order. It does **not** claim Owner acceptance or production-runtime readiness.

---

# 1. File inventory

Verified present on `agent/108-production-play-session-ux`:

```text
app/integrated-reference.html
app/integrated-reference.css
app/integrated-reference-fixtures.js
app/integrated-reference-qa-fixtures.js
app/integrated-reference.js
app/integrated-reference-qa-fixes.js
```

The HTML loads only these prototype-local support files.

Result: **PASS**

---

# 2. First-run / Tutorial

Static source verifies:

- prototype boot calls `PROTO-SCN-01`;
- first product surface is the dedicated Tutorial/Onboarding dialog;
- Tutorial includes Standalone vs Connected orientation;
- Tutorial includes Official-style vs SimpleVTT initial Sheet choice;
- completion proceeds to Home;
- Settings/Home can reopen Tutorial.

Result: **PASS (static)**

---

# 3. Core mapless guard

The rebuilt fixture Actor records contain identity, relation, HP/status/control/initiative presentation facts only.

They do **not** contain routine Core:

- x/y Scene coordinates;
- token positions;
- map/grid cells;
- movement/path geometry;
- Fog of War / LoS geometry.

The only spatial fixture is an explicit DM-entered Actor-pair fact example:

```text
Actor A / Actor B
distanceDisplay
visibilityState
coverState
```

It contains no coordinate/geometry inference.

Central Play CSS uses a non-spatial radial/gradient presentation surface. Actors render in upper/lower Actor Boards rather than as central positioned tokens.

Result: **PASS (static)**

---

# 4. Standalone same-Sheet roll

Static source verifies:

- Sheet roll controls call one `runStandaloneRoll` path;
- the current `.sheet-workspace` remains mounted;
- the dice layer is appended inside that current Sheet workspace;
- result text updates in the same transient layer;
- the transient layer later clears without navigating/remounting the Sheet.

No ordinary Standalone roll route/modal/drawer/result window is introduced.

Result: **PASS (static)**

---

# 5. Session lifecycle

Static source verifies:

- Host and Join remain distinct entry flows;
- Host Open enters live Host/DM Freeform directly;
- Join enters current live Client/Player context;
- no normal Ready/Lobby/Start gate exists in the rebuilt prototype;
- no-Character Join exposes Create / Import recovery;
- live Product-shell navigation keeps a Return to Play path.

QA hardening additionally preserves the connected Host/DM or Client/Player role across safe Product-shell navigation so Return to Play does not accidentally demote a Host to Player.

Result: **PASS (static)**

---

# 6. Connected Play structure

Static source and CSS verify the core order:

```text
Play chrome
Upper opposing Actor Board
Central Play Context / Tabletop Stage
Lower allied Actor Board
Persistent Command Center
```

Initiative adds a compact tracker to the same central context and does not replace Actor Boards.

Freeform Command Center explicitly presents no fake turn economy.

Result: **PASS (static)**

---

# 7. Actor control / targeting

Static source verifies:

- Actor-card targeting consumes fixture-provided validity/reason values;
- all Actor Cards remain present while targeting;
- valid single target submits immediately;
- multi-target uses explicit Execute;
- no map click/position is used for targeting;
- unavailable Main Hand has an explicit no-fallback path.

QA hardening fixes the reviewed click priority for the explicit DM-control scenario:

```text
selected-action targeting
> explicit DM control mode
> ordinary Actor/default-hostile interaction
```

QA hardening also synchronizes the Command Center identity/HP context to the DM-controlled Actor and prevents Rowan's Character resource list from being misrepresented as an NPC's resources.

Result: **PASS (static)**

---

# 8. Resolution / selective locking

The base prototype preserves Actor Boards / central Play context / Command Center during resolution.

An explicit QA-only fixture now supplies:

```text
conflictingControlIds
safeControlIds
```

Scenario `PROTO-SCN-16` visualizes those supplied values. The UI does not calculate command-conflict safety.

Result: **PASS (fixture-driven static)**

Runtime remains blocked by `GAP-RESOLUTION-SAFE-INTERACTIONS`.

---

# 9. Privacy / Activity

Static fixtures separate:

- DM chronology containing public + DM-only events;
- Player chronology filtered to public events only.

No Player placeholder row is created for the private event.

Result: **PASS (prototype fixture)**

Runtime remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 10. Handout / spatial boundary

Handout is rendered only as Overlay / Upper / Full presentation inside the Play presentation system.

No token/grid/path/AoE interaction is layered on the Handout.

Advanced spatial input remains a contextual Actor-pair fact form rather than a map editor. QA hardening removes the advanced Spatial Facts launcher from routine top-level Play chrome; the named QA scenario can still open the pane directly.

Result: **PASS (static)**

Runtime reconnect/state projection remains blocked by `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 11. Product copy cleanup

The integrated plan uses `mapless` as an internal product/design guard, but routine product UI should explain what the user can do instead of repeating implementation exclusions.

QA hardening therefore changes routine user-facing prototype copy such as `MAPLESS PLAY CONTEXT`, `token position`, or `Core map` into task-oriented language such as:

- `PLAY CONTEXT`;
- shared action / dice / result / Handout;
- Actor / action / result context.

The Prototype Controls retain an explicit hard mapless guard because they are not product UI.

Result: **PASS (static)**

---

# 12. Static code checks

Executed locally in the available container:

```text
node --check integrated-reference-qa-fixtures.js
node --check integrated-reference-qa-fixes.js
```

Result:

```text
PASS
```

The GitHub-connected main candidate source was inspected by bounded source ranges for structure/event paths.

---

# 13. Browser QA limitation

A Chromium binary is available in the execution container, but the container cannot resolve `github.com` / raw GitHub hosts, so it cannot materialize the connected branch bundle directly for an exact local browser run.

Observed environment failure:

```text
fatal: unable to access 'https://github.com/Kaetaeru/SimpleVTT.git/':
Could not resolve host: github.com
```

Therefore this record intentionally does **not** claim:

- exact browser render PASS;
- pixel/layout acceptance;
- interaction timing acceptance;
- Owner visual acceptance.

Those remain pending.

---

# 14. Gate result

```text
INTEGRATED BASELINE: PASS
MAPLESS STATIC GUARD: PASS
FIRST-RUN TUTORIAL STRUCTURE: PASS
SAME-SHEET STANDALONE ROLL STRUCTURE: PASS
CONNECTED PLAY SKELETON: PASS
FIXTURE-DRIVEN TARGETING/PRIVACY/SELECTIVE LOCKING: PASS
QA AUGMENTATION JS SYNTAX: PASS
BROWSER VISUAL/INTERACTION QA: PENDING
OWNER ACCEPTANCE: PENDING
RUNTIME IMPLEMENTATION: NOT AUTHORIZED
```

The candidate is eligible for **Owner browser review**, not for production runtime implementation.
